// Validação dos formulários de conta, categoria e recorrência (sem banco: dá para testar isolado).
import { dataValida, lerDinheiro } from "@/lib/formulario";

export const TIPOS_CONTA = {
  corrente: "Conta corrente",
  cartao: "Cartão de crédito",
  especie: "Dinheiro em espécie",
  poupanca: "Poupança",
} as const;
export type TipoConta = keyof typeof TIPOS_CONTA;
export type TipoLancamento = "entrada" | "saida";

type Resultado<T> = { dados: T } | { erro: string };

function nomeLimpo(bruto: string, rotulo: string, maximo: number): string | { erro: string } {
  const nome = bruto.trim().replace(/\s+/g, " ");
  if (!nome) return { erro: `Preencha o ${rotulo}.` };
  if (nome.length > maximo) return { erro: `O ${rotulo} pode ter no máximo ${maximo} caracteres.` };
  return nome;
}

function idPositivo(texto: string): number | undefined {
  const id = Number(texto);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

// ---------- Conta (R2) ----------

export type ValoresConta = { nome: string; tipo: string; saldoInicial: string; dataAbertura: string };
export type DadosConta = { nome: string; tipo: TipoConta; saldoInicial: string; dataAbertura: string };

export function validarConta(v: ValoresConta): Resultado<DadosConta> {
  const nome = nomeLimpo(v.nome, "nome", 60);
  if (typeof nome !== "string") return nome;
  if (!(v.tipo in TIPOS_CONTA)) return { erro: "Escolha o tipo da conta." };
  // R2: o saldo inicial pode ser zero (e negativo, como num cartão já usado), nunca em branco.
  if (!v.saldoInicial.trim()) return { erro: "Informe o saldo inicial (pode ser 0)." };
  const saldo = lerDinheiro(v.saldoInicial, { permitirNegativo: true, permitirZero: true });
  if ("erro" in saldo) return { erro: `Saldo inicial: ${saldo.erro}` };
  if (!dataValida(v.dataAbertura)) return { erro: "Informe uma data de abertura válida." };
  return { dados: { nome, tipo: v.tipo as TipoConta, saldoInicial: saldo.valor, dataAbertura: v.dataAbertura } };
}

// ---------- Categoria (R3) ----------

export type ValoresCategoria = { nome: string; tipo: string; cor: string; ativa: boolean };
export type DadosCategoria = { nome: string; tipo: TipoLancamento; cor: string; ativa: boolean };

export function validarCategoria(v: ValoresCategoria): Resultado<DadosCategoria> {
  const nome = nomeLimpo(v.nome, "nome", 40);
  if (typeof nome !== "string") return nome;
  if (v.tipo !== "entrada" && v.tipo !== "saida") return { erro: "Escolha se a categoria é de entrada ou de saída." };
  const cor = v.cor.trim().toUpperCase();
  if (!/^#[0-9A-F]{6}$/.test(cor)) return { erro: "A cor precisa estar no formato #RRGGBB." };
  return { dados: { nome, tipo: v.tipo, cor, ativa: v.ativa } };
}

// ---------- Recorrência (R6) ----------

export type ValoresRecorrencia = {
  descricao: string;
  valor: string;
  dia: string;
  contaId: string;
  categoriaId: string;
  dataInicio: string;
  dataFim: string;
};
export type DadosRecorrencia = {
  descricao: string;
  valor: string;
  dia: number;
  contaId: number;
  categoriaId: number;
  dataInicio: string;
  dataFim: string | null;
};

export function validarRecorrencia(v: ValoresRecorrencia): Resultado<DadosRecorrencia> {
  const descricao = nomeLimpo(v.descricao, "campo descrição", 100);
  if (typeof descricao !== "string") return { erro: "Preencha a descrição." };
  const valor = lerDinheiro(v.valor);
  if ("erro" in valor) return { erro: `Valor previsto: ${valor.erro}` };
  // R6: o dia precisa existir em qualquer mês, inclusive fevereiro.
  const dia = Number(v.dia);
  if (!Number.isInteger(dia) || dia < 1 || dia > 28) return { erro: "O dia do mês vai de 1 a 28 (para caber em qualquer mês)." };
  const contaId = idPositivo(v.contaId);
  if (!contaId) return { erro: "Escolha a conta." };
  const categoriaId = idPositivo(v.categoriaId);
  if (!categoriaId) return { erro: "Escolha a categoria." };
  if (!dataValida(v.dataInicio)) return { erro: "Informe uma data de início válida." };
  const dataFim = v.dataFim.trim() || null;
  if (dataFim !== null && !dataValida(dataFim)) return { erro: "Informe uma data de fim válida (ou deixe em branco)." };
  if (dataFim !== null && dataFim < v.dataInicio) return { erro: "A data de fim não pode ser antes da data de início." };
  return { dados: { descricao, valor: valor.valor, dia, contaId, categoriaId, dataInicio: v.dataInicio, dataFim } };
}

// ---------- Meses (confirmação de recorrências) ----------

export function mesValido(mes: string | undefined): mes is string {
  return !!mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes) && dataValida(`${mes}-01`);
}

export function mesVizinho(mes: string, n: number): string {
  const [a, m] = mes.split("-").map(Number);
  const t = new Date(Date.UTC(a, m - 1 + n, 1));
  return t.toISOString().slice(0, 7);
}

// Data em que a recorrência cai no mês (o dia vai de 1 a 28, então sempre existe).
export function dataNoMes(mes: string, dia: number): string {
  return `${mes}-${String(dia).padStart(2, "0")}`;
}

// Mês de hoje no fuso do Brasil.
export function mesAtual(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }).slice(0, 7);
}
