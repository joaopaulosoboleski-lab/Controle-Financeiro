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
};

const SELECT_LANCAMENTO = `
  SELECT l.lancamento_id AS id, l.descricao, l.valor::text AS valor, l.tipo,
         to_char(l.data_lancamento, 'YYYY-MM-DD') AS data,
         cat.nome AS categoria, c.nome AS conta,
         l.categoria_id, l.conta_id, r.recorrencia_id, r.descricao AS recorrencia
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
  };
}

// Meses (YYYY-MM) que tem lancamentos, do mais recente ao mais antigo.
// cache(): resolverMes e a página pedem a lista no mesmo pedido; o banco é consultado uma vez.
export const listarMeses = cache(async (): Promise<string[]> => {
  const { rows } = await pool.query<{ mes: string }>(
    `SELECT DISTINCT to_char(data_lancamento, 'YYYY-MM') AS mes
     FROM lancamentos WHERE usuario_id = $1 ORDER BY mes DESC`,
    [await exigirUsuario()],
  );
  return rows.map((r) => r.mes);
});

// Mes valido (YYYY-MM) ou o mais recente disponivel.
export async function resolverMes(mes: string | undefined): Promise<string | undefined> {
  const meses = await listarMeses();
  return mes && meses.includes(mes) ? mes : meses[0];
}

export async function listarLancamentos(mes: string): Promise<Lancamento[]> {
  const { rows } = await pool.query<LinhaLancamento>(
    `${SELECT_LANCAMENTO}
     WHERE l.usuario_id = $1
       AND l.data_lancamento >= ($2 || '-01')::date
       AND l.data_lancamento < (($2 || '-01')::date + INTERVAL '1 month')
     ORDER BY l.data_lancamento DESC, l.lancamento_id DESC`,
    [await exigirUsuario(), mes],
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
     WHERE usuario_id = $1
       AND data_lancamento >= ($2 || '-01')::date
       AND data_lancamento < (($2 || '-01')::date + INTERVAL '1 month')`,
    [await exigirUsuario(), mes],
  );
  const entradas = Number(rows[0].entradas);
  const saidas = Number(rows[0].saidas);
  return { entradas, saidas, saldo: entradas - saidas };
}

export async function saidasPorCategoria(mes: string): Promise<TotalCategoria[]> {
  const { rows } = await pool.query<{ categoria: string; cor: string; total: string }>(
    `SELECT cat.nome AS categoria, cat.cor_hex AS cor, SUM(l.valor)::text AS total
     FROM lancamentos l
     JOIN categorias cat ON cat.categoria_id = l.categoria_id AND cat.usuario_id = l.usuario_id
     WHERE l.usuario_id = $1 AND l.tipo = 'saida'
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
