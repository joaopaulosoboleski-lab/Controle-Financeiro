// Consultas de contas, categorias e recorrências. Como em lib/lancamentos.ts, cada função
// descobre o usuário pela sessão e filtra por usuario_id (R1/R8): as páginas nunca passam o id.
import { pool } from "@/lib/db";
import { exigirUsuario } from "@/lib/sessao";
import type { TipoConta, TipoLancamento } from "@/lib/validacao-cadastros";

// ---------- Contas (R2) ----------

export type Conta = {
  id: number;
  nome: string;
  tipo: TipoConta;
  saldoInicial: number;
  dataAbertura: string; // YYYY-MM-DD
  saldoAtual: number; // R5: calculado pela view saldo_contas
  lancamentos: number;
  recorrencias: number;
};

type LinhaConta = {
  id: number;
  nome: string;
  tipo: TipoConta;
  saldo_inicial: string;
  data_abertura: string;
  saldo_atual: string;
  lancamentos: number;
  recorrencias: number;
};

const SELECT_CONTA = `
  SELECT c.conta_id AS id, c.nome, c.tipo, c.saldo_inicial::text AS saldo_inicial,
         to_char(c.data_abertura, 'YYYY-MM-DD') AS data_abertura, s.saldo_atual::text AS saldo_atual,
         (SELECT COUNT(*)::int FROM lancamentos l WHERE l.conta_id = c.conta_id AND l.usuario_id = c.usuario_id) AS lancamentos,
         (SELECT COUNT(*)::int FROM recorrencias r WHERE r.conta_id = c.conta_id AND r.usuario_id = c.usuario_id) AS recorrencias
  FROM contas c
  JOIN saldo_contas s ON s.conta_id = c.conta_id
`;

function paraConta(l: LinhaConta): Conta {
  return {
    id: l.id,
    nome: l.nome,
    tipo: l.tipo,
    saldoInicial: Number(l.saldo_inicial),
    dataAbertura: l.data_abertura,
    saldoAtual: Number(l.saldo_atual),
    lancamentos: l.lancamentos,
    recorrencias: l.recorrencias,
  };
}

export async function listarContasCompletas(): Promise<Conta[]> {
  const { rows } = await pool.query<LinhaConta>(`${SELECT_CONTA} WHERE c.usuario_id = $1 ORDER BY lower(c.nome)`, [
    await exigirUsuario(),
  ]);
  return rows.map(paraConta);
}

export async function buscarConta(id: number): Promise<Conta | undefined> {
  if (!Number.isInteger(id)) return undefined;
  const { rows } = await pool.query<LinhaConta>(`${SELECT_CONTA} WHERE c.usuario_id = $1 AND c.conta_id = $2`, [
    await exigirUsuario(),
    id,
  ]);
  return rows[0] ? paraConta(rows[0]) : undefined;
}

// ---------- Categorias (R3) ----------

export type Categoria = {
  id: number;
  nome: string;
  tipo: TipoLancamento;
  cor: string;
  ativa: boolean;
  lancamentos: number;
  recorrencias: number;
};

const SELECT_CATEGORIA = `
  SELECT cat.categoria_id AS id, cat.nome, cat.tipo, cat.cor_hex AS cor, cat.ativa,
         (SELECT COUNT(*)::int FROM lancamentos l WHERE l.categoria_id = cat.categoria_id AND l.usuario_id = cat.usuario_id) AS lancamentos,
         (SELECT COUNT(*)::int FROM recorrencias r WHERE r.categoria_id = cat.categoria_id AND r.usuario_id = cat.usuario_id) AS recorrencias
  FROM categorias cat
`;

export async function listarCategoriasCompletas(): Promise<Categoria[]> {
  const { rows } = await pool.query<Categoria>(
    `${SELECT_CATEGORIA} WHERE cat.usuario_id = $1 ORDER BY cat.ativa DESC, cat.tipo DESC, lower(cat.nome)`,
    [await exigirUsuario()],
  );
  return rows;
}

export async function buscarCategoria(id: number): Promise<Categoria | undefined> {
  if (!Number.isInteger(id)) return undefined;
  const { rows } = await pool.query<Categoria>(`${SELECT_CATEGORIA} WHERE cat.usuario_id = $1 AND cat.categoria_id = $2`, [
    await exigirUsuario(),
    id,
  ]);
  return rows[0];
}

// ---------- Recorrências (R6/R7) ----------

export type Recorrencia = {
  id: number;
  descricao: string;
  valor: number;
  dia: number;
  contaId: number;
  conta: string;
  categoriaId: number;
  categoria: string;
  cor: string;
  tipo: TipoLancamento; // vem da categoria
  dataInicio: string;
  dataFim: string | null;
  lancamentos: number;
};

type LinhaRecorrencia = Omit<Recorrencia, "valor" | "contaId" | "categoriaId" | "dataInicio" | "dataFim"> & {
  valor: string;
  conta_id: number;
  categoria_id: number;
  data_inicio: string;
  data_fim: string | null;
};

const SELECT_RECORRENCIA = `
  SELECT r.recorrencia_id AS id, r.descricao, r.valor_previsto::text AS valor, r.dia_do_mes AS dia,
         r.conta_id, c.nome AS conta, r.categoria_id, cat.nome AS categoria, cat.cor_hex AS cor, cat.tipo,
         to_char(r.data_inicio, 'YYYY-MM-DD') AS data_inicio, to_char(r.data_fim, 'YYYY-MM-DD') AS data_fim,
         (SELECT COUNT(*)::int FROM lancamentos l WHERE l.recorrencia_id = r.recorrencia_id AND l.usuario_id = r.usuario_id) AS lancamentos
  FROM recorrencias r
  JOIN contas c ON c.conta_id = r.conta_id AND c.usuario_id = r.usuario_id
  JOIN categorias cat ON cat.categoria_id = r.categoria_id AND cat.usuario_id = r.usuario_id
`;

function paraRecorrencia(l: LinhaRecorrencia): Recorrencia {
  return {
    id: l.id,
    descricao: l.descricao,
    valor: Number(l.valor),
    dia: l.dia,
    contaId: l.conta_id,
    conta: l.conta,
    categoriaId: l.categoria_id,
    categoria: l.categoria,
    cor: l.cor,
    tipo: l.tipo,
    dataInicio: l.data_inicio,
    dataFim: l.data_fim,
    lancamentos: l.lancamentos,
  };
}

export async function listarRecorrencias(): Promise<Recorrencia[]> {
  const { rows } = await pool.query<LinhaRecorrencia>(
    `${SELECT_RECORRENCIA} WHERE r.usuario_id = $1
     ORDER BY (r.data_fim IS NULL OR r.data_fim >= CURRENT_DATE) DESC, r.dia_do_mes, lower(r.descricao)`,
    [await exigirUsuario()],
  );
  return rows.map(paraRecorrencia);
}

export async function buscarRecorrencia(id: number): Promise<Recorrencia | undefined> {
  if (!Number.isInteger(id)) return undefined;
  const { rows } = await pool.query<LinhaRecorrencia>(`${SELECT_RECORRENCIA} WHERE r.usuario_id = $1 AND r.recorrencia_id = $2`, [
    await exigirUsuario(),
    id,
  ]);
  return rows[0] ? paraRecorrencia(rows[0]) : undefined;
}

export type RecorrenciaDoMes = Recorrencia & {
  lancamentoId: number | null; // lançamento já confirmado neste mês (R7)
  valorLancado: number | null;
  dataLancada: string | null;
};

// Recorrências vigentes no mês (início até o fim do mês; fim, se houver, a partir do 1º dia),
// com o lançamento que já saiu delas no mês, se existir.
export async function recorrenciasDoMes(mes: string): Promise<RecorrenciaDoMes[]> {
  const { rows } = await pool.query<
    LinhaRecorrencia & { lancamento_id: number | null; valor_lancado: string | null; data_lancada: string | null }
  >(
    `WITH periodo AS (SELECT ($2 || '-01')::date AS inicio, (($2 || '-01')::date + INTERVAL '1 month')::date AS fim)
     SELECT base.*, l.lancamento_id, l.valor::text AS valor_lancado, to_char(l.data_lancamento, 'YYYY-MM-DD') AS data_lancada
     FROM (${SELECT_RECORRENCIA}) base
     JOIN recorrencias r2 ON r2.recorrencia_id = base.id
     CROSS JOIN periodo p
     LEFT JOIN LATERAL (
       SELECT lancamento_id, valor, data_lancamento FROM lancamentos
       WHERE recorrencia_id = base.id AND usuario_id = $1
         AND data_lancamento >= p.inicio AND data_lancamento < p.fim
       ORDER BY data_lancamento LIMIT 1
     ) l ON TRUE
     WHERE r2.usuario_id = $1 AND r2.data_inicio < p.fim AND (r2.data_fim IS NULL OR r2.data_fim >= p.inicio)
     ORDER BY base.dia, lower(base.descricao)`,
    [await exigirUsuario(), mes],
  );
  return rows.map((l) => ({
    ...paraRecorrencia(l),
    lancamentoId: l.lancamento_id,
    valorLancado: l.valor_lancado === null ? null : Number(l.valor_lancado),
    dataLancada: l.data_lancada,
  }));
}
