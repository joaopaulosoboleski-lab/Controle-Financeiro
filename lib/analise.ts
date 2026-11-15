import { pool } from "@/lib/db";
import {
  assimetria,
  coeficienteVariacao,
  desvioPadrao,
  hhi,
  mad,
  media,
  mediana,
  previsaoHolt,
  quantil,
  regressaoLinear,
  soma,
  zModificado,
  type Previsao,
  type Regressao,
} from "@/lib/estatistica";
import { exigirUsuario } from "@/lib/sessao";

// ---------- Tipos ----------

export type LancamentoAnalise = {
  id: number;
  data: string; // YYYY-MM-DD
  descricao: string;
  tipo: "entrada" | "saida";
  valor: number;
  categoria: string;
  cor: string;
  conta: string;
  recorrente: boolean;
};

export type Mes = { mes: string; entradas: number; saidas: number; resultado: number; quantidade: number };

export type Categoria = {
  nome: string;
  cor: string;
  total: number;
  participacao: number; // 0..1 do total do tipo
  acumulado: number; // participação acumulada (Pareto)
  quantidade: number;
  media: number;
  mediana: number;
  desvio: number;
  cv: number;
  minimo: number;
  maximo: number;
  tendenciaMensal: number | null; // variação média por mês, em fração da média mensal
};

export type Faixa = { rotulo: string; de: number; ate: number | null; quantidade: number; total: number };

export type Distribuicao = {
  quantidade: number;
  media: number;
  mediana: number;
  desvio: number;
  cv: number;
  assimetria: number;
  minimo: number;
  q1: number;
  q3: number;
  p90: number;
  maximo: number;
  faixas: Faixa[];
};

export type DiaSemana = { dia: number; nome: string; total: number; mediaPorDia: number; quantidade: number };
export type Dia = { data: string; saidas: number; diaSemana: number };

export type Atipico = LancamentoAnalise & { z: number; medianaCategoria: number };

export type Conta = { nome: string; entradas: number; saidas: number; liquido: number; saldoAtual: number };

export type Analise = {
  de: string;
  ate: string;
  limites: { de: string; ate: string } | null; // primeiro e último lançamento da pessoa (todos os tempos)
  lancamentos: LancamentoAnalise[];
  resumo: {
    entradas: number;
    saidas: number;
    resultado: number;
    taxaPoupanca: number | null; // resultado / entradas
    quantidade: number;
    meses: number;
    mediaMensalSaidas: number;
    mediaMensalEntradas: number;
  };
  ultimoMes: { mes: string; saidas: number; variacao: number | null; anterior: string | null } | null;
  mensal: Mes[];
  tendencia: { regressao: Regressao; variacaoMensal: number; previsao: (Previsao & { mes: string }) | null } | null;
  saidasPorCategoria: Categoria[];
  entradasPorCategoria: Categoria[];
  pareto80: number; // quantas categorias somam 80% das saídas
  concentracao: number; // HHI das saídas
  distribuicao: Distribuicao | null;
  semana: DiaSemana[];
  dias: Dia[];
  atipicos: Atipico[];
  fixo: { recorrente: number; avulso: number; participacao: number };
  contas: Conta[];
};

// ---------- Período ----------

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const MAXIMO_MESES = 120; // 10 anos

function dataValida(d: string | undefined): d is string {
  if (!d || !DATA.test(d)) return false;
  // Anos de 5 dígitos (10000+) viram "+010000-..." no toISOString e quebram as comparações de texto.
  const ano = Number(d.slice(0, 4));
  if (ano < 1900 || ano > 2100) return false;
  const t = new Date(`${d}T00:00:00Z`);
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d;
}

function adicionarDias(d: string, n: number): string {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

export function adicionarMeses(mes: string, n: number): string {
  const [a, m] = mes.split("-").map(Number);
  const t = new Date(Date.UTC(a, m - 1 + n, 1));
  return t.toISOString().slice(0, 7);
}

function mesesEntre(de: string, ate: string): string[] {
  const meses: string[] = [];
  for (let m = de.slice(0, 7); m <= ate.slice(0, 7); m = adicionarMeses(m, 1)) meses.push(m);
  return meses;
}

// Seg = 0 ... Dom = 6 (semana brasileira começando na segunda).
function diaDaSemana(d: string): number {
  return (new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7;
}

export const NOMES_DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
export const NOMES_DIAS_LONGOS = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"];

async function limitesDoUsuario(usuarioId: number) {
  const { rows } = await pool.query<{ de: string | null; ate: string | null }>(
    `SELECT to_char(MIN(data_lancamento), 'YYYY-MM-DD') AS de, to_char(MAX(data_lancamento), 'YYYY-MM-DD') AS ate
     FROM lancamentos WHERE usuario_id = $1 AND NOT previsto`,
    [usuarioId],
  );
  return rows[0].de && rows[0].ate ? { de: rows[0].de, ate: rows[0].ate } : null;
}

// Atalhos de período, relativos ao último lançamento (os dados podem ser de outro ano).
export function atalhosDePeriodo(limites: { de: string; ate: string }) {
  const ultimoMes = limites.ate.slice(0, 7);
  const inicio = (meses: number) => {
    const d = `${adicionarMeses(ultimoMes, -(meses - 1))}-01`;
    return d < limites.de ? limites.de : d;
  };
  const todos = [
    { rotulo: "Tudo", de: limites.de, ate: limites.ate },
    { rotulo: "Últimos 12 meses", de: inicio(12), ate: limites.ate },
    { rotulo: "Últimos 6 meses", de: inicio(6), ate: limites.ate },
    { rotulo: "Últimos 3 meses", de: inicio(3), ate: limites.ate },
    { rotulo: "Último mês", de: inicio(1), ate: limites.ate },
  ];
  // Some com atalhos que dariam o mesmo período de um anterior (ex.: dados de só 6 meses).
  return todos.filter((p, i) => !todos.slice(0, i).some((q) => q.de === p.de && q.ate === p.ate));
}

// ---------- Cálculo ----------

function porCategoria(itens: LancamentoAnalise[], meses: string[]): Categoria[] {
  const grupos = new Map<string, LancamentoAnalise[]>();
  for (const l of itens) grupos.set(l.categoria, [...(grupos.get(l.categoria) ?? []), l]);
  const total = soma(itens.map((l) => l.valor));

  const categorias = [...grupos.entries()].map(([nome, ls]) => {
    const valores = ls.map((l) => l.valor);
    const somaCat = soma(valores);
    const porMes = meses.map((m) => soma(ls.filter((l) => l.data.startsWith(m)).map((l) => l.valor)));
    const mediaMes = media(porMes);
    return {
      nome,
      cor: ls[0].cor,
      total: somaCat,
      participacao: total ? somaCat / total : 0,
      acumulado: 0,
      quantidade: ls.length,
      media: media(valores),
      mediana: mediana(valores),
      desvio: desvioPadrao(valores),
      cv: coeficienteVariacao(valores),
      minimo: Math.min(...valores),
      maximo: Math.max(...valores),
      tendenciaMensal: meses.length >= 3 && mediaMes ? regressaoLinear(porMes).inclinacao / mediaMes : null,
    };
  });

  categorias.sort((a, b) => b.total - a.total);
  let acumulado = 0;
  for (const c of categorias) {
    acumulado += c.participacao;
    c.acumulado = acumulado;
  }
  return categorias;
}

// Faixas em escala 1-2,5-5 (quase logarítmica): os valores são muito assimétricos,
// então faixas de largura igual esconderiam quase tudo na primeira barra.
const LIMITES_FAIXAS = [0, 25, 50, 100, 250, 500, 1000, 2500, 5000];

function distribuir(valores: number[]): Distribuicao | null {
  if (!valores.length) return null;
  const faixas: Faixa[] = LIMITES_FAIXAS.map((de, i) => {
    const ate = LIMITES_FAIXAS[i + 1] ?? null;
    const dentro = valores.filter((v) => v >= de && (ate === null || v < ate));
    // Rótulos curtos ("1–2,5 mil") para caberem embaixo de cada coluna.
    const curto = (v: number) => (v >= 1000 ? (v / 1000).toLocaleString("pt-BR") : String(v));
    const rotulo =
      ate === null
        ? `${curto(de)}${de >= 1000 ? " mil" : ""}+`
        : `${curto(de)}–${curto(ate)}${ate >= 1000 ? " mil" : ""}`;
    return { rotulo, de, ate, quantidade: dentro.length, total: soma(dentro) };
  });
  return {
    quantidade: valores.length,
    media: media(valores),
    mediana: mediana(valores),
    desvio: desvioPadrao(valores),
    cv: coeficienteVariacao(valores),
    assimetria: assimetria(valores),
    minimo: Math.min(...valores),
    q1: quantil(valores, 0.25),
    q3: quantil(valores, 0.75),
    p90: quantil(valores, 0.9),
    maximo: Math.max(...valores),
    faixas,
  };
}

// Valores atípicos por categoria, com o escore z modificado (mediana e MAD, robustos a extremos).
// Só olha os gastos avulsos: os recorrentes (aluguel, escola) são previstos, não anomalias,
// e misturá-los com os avulsos da mesma categoria faria todo mês "parecer" atípico.
function encontrarAtipicos(saidas: LancamentoAnalise[]): Atipico[] {
  const grupos = new Map<string, LancamentoAnalise[]>();
  for (const l of saidas) {
    if (!l.recorrente) grupos.set(l.categoria, [...(grupos.get(l.categoria) ?? []), l]);
  }
  const atipicos: Atipico[] = [];
  for (const ls of grupos.values()) {
    if (ls.length < 5) continue; // poucos dados para dizer o que é "normal"
    const valores = ls.map((l) => l.valor);
    const med = mediana(valores);
    const m = mad(valores);
    if (!m) continue;
    for (const l of ls) {
      const z = zModificado(l.valor, med, m);
      if (z > 3.5) atipicos.push({ ...l, z, medianaCategoria: med });
    }
  }
  return atipicos.sort((a, b) => b.z - a.z);
}

export async function carregarAnalise(dePedido?: string, atePedido?: string): Promise<Analise> {
  const usuarioId = await exigirUsuario();
  const limites = await limitesDoUsuario(usuarioId);

  let de = dataValida(dePedido) ? dePedido : (limites?.de ?? new Date().toISOString().slice(0, 10));
  let ate = dataValida(atePedido) ? atePedido : (limites?.ate ?? de);
  if (de > ate) [de, ate] = [ate, de];
  // Os cálculos percorrem os lançamentos uma vez por mês do período: um intervalo absurdo
  // (ex.: 1900 a 2100) pesaria na tela e nas exportações. Primeiro aproxima o período de onde há
  // lançamentos; se ainda passar de MAXIMO_MESES, fica com os últimos MAXIMO_MESES até "ate".
  if (limites && de < limites.de && ate >= limites.de) de = limites.de;
  if (limites && ate > limites.ate && de <= limites.ate) ate = limites.ate;
  const inicioPermitido = `${adicionarMeses(ate.slice(0, 7), -(MAXIMO_MESES - 1))}-01`;
  if (de < inicioPermitido) de = inicioPermitido;

  const [{ rows }, { rows: contasLinhas }] = await Promise.all([
    pool.query<{
      id: number;
      data: string;
      descricao: string | null;
      tipo: "entrada" | "saida";
      valor: string;
      categoria: string;
      cor: string;
      conta: string;
      recorrente: boolean;
    }>(
      `SELECT l.lancamento_id AS id, to_char(l.data_lancamento, 'YYYY-MM-DD') AS data, l.descricao, l.tipo,
              l.valor::text AS valor, cat.nome AS categoria, cat.cor_hex AS cor, c.nome AS conta,
              (l.recorrencia_id IS NOT NULL) AS recorrente
       FROM lancamentos l
       JOIN categorias cat ON cat.categoria_id = l.categoria_id AND cat.usuario_id = l.usuario_id
       JOIN contas c ON c.conta_id = l.conta_id AND c.usuario_id = l.usuario_id
       WHERE l.usuario_id = $1 AND NOT l.previsto AND l.data_lancamento BETWEEN $2::date AND $3::date
       ORDER BY l.data_lancamento, l.lancamento_id`,
      [usuarioId, de, ate],
    ),
    pool.query<{ nome: string; saldo_atual: string }>(
      "SELECT nome, saldo_atual::text FROM saldo_contas WHERE usuario_id = $1 ORDER BY conta_id",
      [usuarioId],
    ),
  ]);

  const lancamentos: LancamentoAnalise[] = rows.map((r) => ({
    id: r.id,
    data: r.data,
    descricao: r.descricao?.trim() || "(sem descrição)",
    tipo: r.tipo,
    valor: Number(r.valor),
    categoria: r.categoria,
    cor: r.cor,
    conta: r.conta,
    recorrente: r.recorrente,
  }));

  const entradas = lancamentos.filter((l) => l.tipo === "entrada");
  const saidas = lancamentos.filter((l) => l.tipo === "saida");
  const totalEntradas = soma(entradas.map((l) => l.valor));
  const totalSaidas = soma(saidas.map((l) => l.valor));
  const meses = mesesEntre(de, ate);

  const mensal: Mes[] = meses.map((mes) => {
    const doMes = lancamentos.filter((l) => l.data.startsWith(mes));
    const e = soma(doMes.filter((l) => l.tipo === "entrada").map((l) => l.valor));
    const s = soma(doMes.filter((l) => l.tipo === "saida").map((l) => l.valor));
    return { mes, entradas: e, saidas: s, resultado: e - s, quantidade: doMes.length };
  });

  const saidasMensais = mensal.map((m) => m.saidas);
  const regressao = regressaoLinear(saidasMensais);
  const mediaSaidas = media(saidasMensais);
  const holt = previsaoHolt(saidasMensais);

  const ultimo = mensal[mensal.length - 1];
  const penultimo = mensal[mensal.length - 2];

  // Dias do período (inclusive os sem gasto, que contam como zero).
  const totalPorDia = new Map<string, number>();
  for (const l of saidas) totalPorDia.set(l.data, (totalPorDia.get(l.data) ?? 0) + l.valor);
  const dias: Dia[] = [];
  for (let d = de; d <= ate; d = adicionarDias(d, 1)) {
    dias.push({ data: d, saidas: totalPorDia.get(d) ?? 0, diaSemana: diaDaSemana(d) });
  }

  const semana: DiaSemana[] = NOMES_DIAS.map((nome, dia) => {
    const doDia = dias.filter((d) => d.diaSemana === dia);
    const total = soma(doDia.map((d) => d.saidas));
    return {
      dia,
      nome,
      total,
      mediaPorDia: doDia.length ? total / doDia.length : 0,
      quantidade: saidas.filter((l) => diaDaSemana(l.data) === dia).length,
    };
  });

  const saidasPorCategoria = porCategoria(saidas, meses);
  const recorrente = soma(saidas.filter((l) => l.recorrente).map((l) => l.valor));

  const contas: Conta[] = contasLinhas.map((c) => {
    const daConta = lancamentos.filter((l) => l.conta === c.nome);
    const e = soma(daConta.filter((l) => l.tipo === "entrada").map((l) => l.valor));
    const s = soma(daConta.filter((l) => l.tipo === "saida").map((l) => l.valor));
    return { nome: c.nome, entradas: e, saidas: s, liquido: e - s, saldoAtual: Number(c.saldo_atual) };
  });

  return {
    de,
    ate,
    limites,
    lancamentos,
    resumo: {
      entradas: totalEntradas,
      saidas: totalSaidas,
      resultado: totalEntradas - totalSaidas,
      taxaPoupanca: totalEntradas ? (totalEntradas - totalSaidas) / totalEntradas : null,
      quantidade: lancamentos.length,
      meses: meses.length,
      mediaMensalSaidas: mediaSaidas,
      mediaMensalEntradas: media(mensal.map((m) => m.entradas)),
    },
    ultimoMes: ultimo
      ? {
          mes: ultimo.mes,
          saidas: ultimo.saidas,
          anterior: penultimo?.mes ?? null,
          variacao: penultimo?.saidas ? ultimo.saidas / penultimo.saidas - 1 : null,
        }
      : null,
    mensal,
    tendencia:
      meses.length >= 3
        ? {
            regressao,
            variacaoMensal: mediaSaidas ? regressao.inclinacao / mediaSaidas : 0,
            previsao: holt ? { ...holt, mes: adicionarMeses(meses[meses.length - 1], 1) } : null,
          }
        : null,
    saidasPorCategoria,
    entradasPorCategoria: porCategoria(entradas, meses),
    pareto80: saidasPorCategoria.findIndex((c) => c.acumulado >= 0.8) + 1,
    concentracao: hhi(saidasPorCategoria.map((c) => c.participacao)),
    distribuicao: distribuir(saidas.map((l) => l.valor)),
    semana,
    dias,
    atipicos: encontrarAtipicos(saidas),
    fixo: { recorrente, avulso: totalSaidas - recorrente, participacao: totalSaidas ? recorrente / totalSaidas : 0 },
    contas,
  };
}

// ---------- Formatação ----------

export function formatarPercentual(x: number, casas = 1): string {
  return x.toLocaleString("pt-BR", { style: "percent", minimumFractionDigits: casas, maximumFractionDigits: casas });
}

export function formatarCompacto(v: number): string {
  const abs = Math.abs(v);
  const sinal = v < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sinal}R$ ${(abs / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (abs >= 1_000) return `${sinal}R$ ${(abs / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return `${sinal}R$ ${abs.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function mesCurto(mes: string): string {
  const [a, m] = mes.split("-");
  return `${MESES_CURTOS[Number(m) - 1]}/${a.slice(2)}`;
}

// Interpretações em português simples, usadas na página e no PDF.
export function lerTendencia(t: NonNullable<Analise["tendencia"]>): string {
  const forca = t.regressao.r2 >= 0.6 ? "clara" : t.regressao.r2 >= 0.3 ? "moderada" : "fraca";
  if (Math.abs(t.variacaoMensal) < 0.01) return `Os gastos estão estáveis (tendência ${forca}, R² = ${t.regressao.r2.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}).`;
  const direcao = t.variacaoMensal > 0 ? "sobem" : "caem";
  return `Os gastos ${direcao} em média ${formatarPercentual(Math.abs(t.variacaoMensal))} por mês (tendência ${forca}, R² = ${t.regressao.r2.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}).`;
}

export function lerConcentracao(indice: number): string {
  if (indice < 1500) return "gastos bem distribuídos entre as categorias";
  if (indice < 2500) return "concentração moderada em poucas categorias";
  return "gastos muito concentrados em poucas categorias";
}

// As frases de "Principais conclusões" (página, Excel e PDF usam as mesmas).
export function conclusoes(a: Analise): string[] {
  const lista: string[] = [];
  const { resumo } = a;
  const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  if (resumo.taxaPoupanca !== null) {
    lista.push(
      resumo.resultado >= 0
        ? `Sobrou ${brl(resumo.resultado)} no período: ${formatarPercentual(resumo.taxaPoupanca)} do que entrou.`
        : `Saiu ${brl(-resumo.resultado)} a mais do que entrou: as saídas foram ${formatarPercentual(resumo.saidas / resumo.entradas)} das entradas.`,
    );
  }
  if (a.tendencia) lista.push(lerTendencia(a.tendencia));
  if (a.tendencia?.previsao) {
    const p = a.tendencia.previsao;
    lista.push(
      `Previsão de saídas para ${mesCurto(p.mes)}: ${brl(p.valor)} (80% de chance entre ${formatarCompacto(p.minimo)} e ${formatarCompacto(p.maximo)}).`,
    );
  }
  if (a.pareto80 > 0) {
    lista.push(
      `${a.pareto80} de ${a.saidasPorCategoria.length} categorias concentram 80% dos gastos (${lerConcentracao(a.concentracao)}; IHH = ${Math.round(a.concentracao).toLocaleString("pt-BR")}).`,
    );
  }
  if (a.fixo.recorrente > 0) {
    lista.push(`Custos recorrentes são ${formatarPercentual(a.fixo.participacao)} das saídas; o restante é gasto variável.`);
  }
  const maiorDia = a.semana.reduce((x, y) => (y.mediaPorDia > x.mediaPorDia ? y : x), a.semana[0]);
  if (maiorDia?.mediaPorDia) lista.push(`${NOMES_DIAS_LONGOS[maiorDia.dia]} é o dia de maior gasto médio (${brl(maiorDia.mediaPorDia)} por dia).`);
  if (a.mensal.length > 1) {
    const pior = a.mensal.reduce((x, y) => (y.resultado < x.resultado ? y : x));
    lista.push(`O mês mais apertado foi ${mesCurto(pior.mes)}, com resultado de ${brl(pior.resultado)}.`);
  }
  if (a.atipicos.length) {
    lista.push(`${a.atipicos.length} gasto(s) fogem muito do padrão da própria categoria e merecem revisão.`);
  }
  return lista;
}

export function lerAssimetria(a: number): string {
  if (a > 1) return "fortemente assimétrica à direita: muitos gastos pequenos e alguns muito grandes";
  if (a > 0.5) return "moderadamente assimétrica à direita";
  if (a < -0.5) return "assimétrica à esquerda";
  return "aproximadamente simétrica";
}
