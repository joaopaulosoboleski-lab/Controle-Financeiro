import { cache } from "react";
import { pool } from "@/lib/db";
import { exigirUsuario } from "@/lib/sessao";

export type Lancamento = {
  id: number;
  descricao: string;
  valor: number;
  tipo: "entrada" | "saida";
  data: string; // YYYY-MM-DD
  categoria: string;
  conta: string;
  categoriaId: number;
  contaId: number;
  // R7: recorrência que originou o lançamento (null = avulso).
  recorrenciaId: number | null;
  recorrencia: string | null;
  // Previsto: ainda não aconteceu; fica fora do saldo e dos totais até ser confirmado.
  previsto: boolean;
  vencido: boolean; // previsto com data anterior a hoje (fuso do Brasil)
};

export type Resumo = { entradas: number; saidas: number; saldo: number };
export type TotalCategoria = { categoria: string; cor: string; total: number };
export type SaldoConta = { conta: string; saldo: number };

type LinhaLancamento = {
  id: number;
  descricao: string | null;
  valor: string;
  tipo: "entrada" | "saida";
  data: string;
  categoria: string;
  conta: string;
  categoria_id: number;
  conta_id: number;
  recorrencia_id: number | null;
  recorrencia: string | null;
  previsto: boolean;
  vencido: boolean;
};

// "Hoje" no fuso do Brasil, calculado no banco (sem SET TIME ZONE: o pooler é compartilhado).
const HOJE_SQL = "(now() AT TIME ZONE 'America/Sao_Paulo')::date";

const SELECT_LANCAMENTO = `
  SELECT l.lancamento_id AS id, l.descricao, l.valor::text AS valor, l.tipo,
         to_char(l.data_lancamento, 'YYYY-MM-DD') AS data,
         cat.nome AS categoria, c.nome AS conta,
         l.categoria_id, l.conta_id, r.recorrencia_id, r.descricao AS recorrencia,
         l.previsto, (l.previsto AND l.data_lancamento < ${HOJE_SQL}) AS vencido
  FROM lancamentos l
  JOIN categorias cat ON cat.categoria_id = l.categoria_id AND cat.usuario_id = l.usuario_id
  JOIN contas c ON c.conta_id = l.conta_id AND c.usuario_id = l.usuario_id
  LEFT JOIN recorrencias r ON r.recorrencia_id = l.recorrencia_id AND r.usuario_id = l.usuario_id
`;

function paraLancamento(linha: LinhaLancamento): Lancamento {
  return {
    id: linha.id,
    descricao: linha.descricao?.trim() || "(sem descrição)",
    valor: Number(linha.valor),
    tipo: linha.tipo,
    data: linha.data,
    categoria: linha.categoria,
    conta: linha.conta,
    categoriaId: linha.categoria_id,
    contaId: linha.conta_id,
    recorrenciaId: linha.recorrencia_id,
    recorrencia: linha.recorrencia,
    previsto: linha.previsto,
    vencido: linha.vencido,
  };
}

// Data de hoje (YYYY-MM-DD) no fuso do Brasil, no servidor.
export function hojeEmSaoPaulo(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

// Meses (YYYY-MM) com lançamentos (realizados ou previstos) e se cada um tem algum realizado.
// cache(): resolverMes e a página pedem a lista no mesmo pedido; o banco é consultado uma vez.
const mesesComLancamento = cache(async (): Promise<{ mes: string; temRealizado: boolean }[]> => {
  const { rows } = await pool.query<{ mes: string; tem_realizado: boolean }>(
    `SELECT to_char(data_lancamento, 'YYYY-MM') AS mes, bool_or(NOT previsto) AS tem_realizado
     FROM lancamentos WHERE usuario_id = $1 GROUP BY 1 ORDER BY mes DESC`,
    [await exigirUsuario()],
  );
  return rows.map((r) => ({ mes: r.mes, temRealizado: r.tem_realizado }));
});

// Meses do seletor, do mais recente ao mais antigo. Inclui mês só com previstos
// (senão um previsto num mês futuro ficaria invisível).
export async function listarMeses(): Promise<string[]> {
  return (await mesesComLancamento()).map((m) => m.mes);
}

// Mês pedido, se existir; senão o mais recente com algo REALIZADO (não abre por padrão
// um mês futuro que só tem previstos), e só sem nenhum realizado o mais recente de todos.
export async function resolverMes(mes: string | undefined): Promise<string | undefined> {
  const meses = await mesesComLancamento();
  if (mes && meses.some((m) => m.mes === mes)) return mes;
  return (meses.find((m) => m.temRealizado) ?? meses[0])?.mes;
}

// Realizados do mês (mais recentes primeiro) ou previstos do mês (por data, os mais próximos primeiro).
export async function listarLancamentos(mes: string, { previsto = false } = {}): Promise<Lancamento[]> {
  const ordem = previsto ? "l.data_lancamento ASC, l.lancamento_id ASC" : "l.data_lancamento DESC, l.lancamento_id DESC";
  const { rows } = await pool.query<LinhaLancamento>(
    `${SELECT_LANCAMENTO}
     WHERE l.usuario_id = $1 AND l.previsto = $3
       AND l.data_lancamento >= ($2 || '-01')::date
       AND l.data_lancamento < (($2 || '-01')::date + INTERVAL '1 month')
     ORDER BY ${ordem}`,
    [await exigirUsuario(), mes, previsto],
  );
  return rows.map(paraLancamento);
}

export async function buscarLancamento(id: number): Promise<Lancamento | undefined> {
  if (!Number.isInteger(id)) return undefined;
  const { rows } = await pool.query<LinhaLancamento>(
    `${SELECT_LANCAMENTO} WHERE l.usuario_id = $1 AND l.lancamento_id = $2`,
    [await exigirUsuario(), id],
  );
  return rows[0] ? paraLancamento(rows[0]) : undefined;
}

export async function resumoDoMes(mes: string): Promise<Resumo> {
  const { rows } = await pool.query<{ entradas: string; saidas: string }>(
    `SELECT COALESCE(SUM(valor) FILTER (WHERE tipo = 'entrada'), 0)::text AS entradas,
            COALESCE(SUM(valor) FILTER (WHERE tipo = 'saida'), 0)::text AS saidas
     FROM lancamentos
     WHERE usuario_id = $1 AND NOT previsto
       AND data_lancamento >= ($2 || '-01')::date
       AND data_lancamento < (($2 || '-01')::date + INTERVAL '1 month')`,
    [await exigirUsuario(), mes],
  );
  const entradas = Number(rows[0].entradas);
  const saidas = Number(rows[0].saidas);
  return { entradas, saidas, saldo: entradas - saidas };
}

export type ResumoPrevisto = { entradas: number; saidas: number; quantidade: number };

// Previstos do mês, à parte dos totais reais.
export async function resumoPrevistoDoMes(mes: string): Promise<ResumoPrevisto> {
  const { rows } = await pool.query<{ entradas: string; saidas: string; quantidade: number }>(
    `SELECT COALESCE(SUM(valor) FILTER (WHERE tipo = 'entrada'), 0)::text AS entradas,
            COALESCE(SUM(valor) FILTER (WHERE tipo = 'saida'), 0)::text AS saidas,
            COUNT(*)::int AS quantidade
     FROM lancamentos
     WHERE usuario_id = $1 AND previsto
       AND data_lancamento >= ($2 || '-01')::date
       AND data_lancamento < (($2 || '-01')::date + INTERVAL '1 month')`,
    [await exigirUsuario(), mes],
  );
  return { entradas: Number(rows[0].entradas), saidas: Number(rows[0].saidas), quantidade: rows[0].quantidade };
}

// Previstos cuja data já passou e ainda não foram confirmados, com o mês do mais antigo (para o link).
export async function previstosVencidos(): Promise<{ quantidade: number; mesMaisAntigo: string | null }> {
  const { rows } = await pool.query<{ quantidade: number; mes: string | null }>(
    `SELECT COUNT(*)::int AS quantidade, to_char(MIN(data_lancamento), 'YYYY-MM') AS mes
     FROM lancamentos WHERE usuario_id = $1 AND previsto AND data_lancamento < ${HOJE_SQL}`,
    [await exigirUsuario()],
  );
  return { quantidade: rows[0].quantidade, mesMaisAntigo: rows[0].mes };
}

export async function saidasPorCategoria(mes: string): Promise<TotalCategoria[]> {
  const { rows } = await pool.query<{ categoria: string; cor: string; total: string }>(
    `SELECT cat.nome AS categoria, cat.cor_hex AS cor, SUM(l.valor)::text AS total
     FROM lancamentos l
     JOIN categorias cat ON cat.categoria_id = l.categoria_id AND cat.usuario_id = l.usuario_id
     WHERE l.usuario_id = $1 AND l.tipo = 'saida' AND NOT l.previsto
       AND l.data_lancamento >= ($2 || '-01')::date
       AND l.data_lancamento < (($2 || '-01')::date + INTERVAL '1 month')
     GROUP BY cat.nome, cat.cor_hex
     ORDER BY SUM(l.valor) DESC`,
    [await exigirUsuario(), mes],
  );
  return rows.map((r) => ({ categoria: r.categoria, cor: r.cor, total: Number(r.total) }));
}

export async function saldosDasContas(): Promise<SaldoConta[]> {
  const { rows } = await pool.query<{ nome: string; saldo_atual: string }>(
    `SELECT nome, saldo_atual::text FROM saldo_contas WHERE usuario_id = $1 ORDER BY conta_id`,
    [await exigirUsuario()],
  );
  return rows.map((r) => ({ conta: r.nome, saldo: Number(r.saldo_atual) }));
}

export type OpcaoConta = { id: number; nome: string };
export type OpcaoCategoria = { id: number; nome: string; tipo: "entrada" | "saida" };

export async function listarContas(): Promise<OpcaoConta[]> {
  const { rows } = await pool.query<OpcaoConta>(
    "SELECT conta_id AS id, nome FROM contas WHERE usuario_id = $1 ORDER BY nome",
    [await exigirUsuario()],
  );
  return rows;
}

// Categorias ativas; na edição inclui também a categoria atual, mesmo se arquivada.
export async function listarCategorias(incluirId?: number): Promise<OpcaoCategoria[]> {
  const { rows } = await pool.query<OpcaoCategoria>(
    `SELECT categoria_id AS id, nome, tipo FROM categorias
     WHERE usuario_id = $1 AND (ativa OR categoria_id = $2::int)
     ORDER BY tipo, nome`,
    [await exigirUsuario(), incluirId ?? null],
  );
  return rows;
}

export type Alerta = { motivo: string; quantidade: number };

// Lancamentos que merecem revisao (nada e alterado ou apagado).
export async function alertasDeQualidade(): Promise<Alerta[]> {
  const { rows } = await pool.query<{ motivo: string; quantidade: number }>(
    `SELECT motivo, COUNT(*)::int AS quantidade
     FROM lancamentos_suspeitos WHERE usuario_id = $1 GROUP BY motivo ORDER BY motivo`,
    [await exigirUsuario()],
  );
  return rows;
}

export function formatarValor(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatarData(data: string): string {
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

const NOMES_MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function formatarMes(mes: string): string {
  const [ano, m] = mes.split("-");
  return `${NOMES_MESES[Number(m) - 1]} de ${ano}`;
}
