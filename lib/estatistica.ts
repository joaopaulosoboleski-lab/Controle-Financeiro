// Funções estatísticas puras (sem dependências). Usadas pela aba Análise, pelo Excel e pelo PDF.

export function soma(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

export function media(xs: number[]): number {
  return xs.length ? soma(xs) / xs.length : 0;
}

// Quantil com interpolação linear (o "tipo 7", padrão do R e do Excel QUARTIL.INC).
export function quantil(xs: number[], p: number): number {
  if (!xs.length) return 0;
  const ord = [...xs].sort((a, b) => a - b);
  const pos = (ord.length - 1) * p;
  const base = Math.floor(pos);
  const resto = pos - base;
  return ord[base + 1] !== undefined ? ord[base] + resto * (ord[base + 1] - ord[base]) : ord[base];
}

export function mediana(xs: number[]): number {
  return quantil(xs, 0.5);
}

// Desvio padrão amostral (n - 1).
export function desvioPadrao(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = media(xs);
  return Math.sqrt(soma(xs.map((x) => (x - m) ** 2)) / (xs.length - 1));
}

// Coeficiente de variação: desvio / média. Mede a volatilidade relativa (sem unidade).
export function coeficienteVariacao(xs: number[]): number {
  const m = media(xs);
  return m ? desvioPadrao(xs) / m : 0;
}

// Assimetria amostral ajustada (Fisher-Pearson, a mesma de DISTORÇÃO do Excel).
export function assimetria(xs: number[]): number {
  const n = xs.length;
  if (n < 3) return 0;
  const m = media(xs);
  const s = desvioPadrao(xs);
  if (!s) return 0;
  return (n / ((n - 1) * (n - 2))) * soma(xs.map((x) => ((x - m) / s) ** 3));
}

// Desvio absoluto mediano: a versão robusta do desvio padrão (não se deixa levar por extremos).
export function mad(xs: number[]): number {
  const med = mediana(xs);
  return mediana(xs.map((x) => Math.abs(x - med)));
}

// Escore z modificado (Iglewicz & Hoaglin, 1993). |z| > 3,5 sugere valor atípico.
export function zModificado(x: number, med: number, madValor: number): number {
  return madValor ? (0.6745 * (x - med)) / madValor : 0;
}

export type Regressao = { inclinacao: number; intercepto: number; r2: number };

// Mínimos quadrados ordinários de y sobre x = 0, 1, 2, ...
export function regressaoLinear(ys: number[]): Regressao {
  const n = ys.length;
  if (n < 2) return { inclinacao: 0, intercepto: ys[0] ?? 0, r2: 0 };
  const xs = ys.map((_, i) => i);
  const mx = media(xs);
  const my = media(ys);
  const sxy = soma(xs.map((x, i) => (x - mx) * (ys[i] - my)));
  const sxx = soma(xs.map((x) => (x - mx) ** 2));
  const inclinacao = sxx ? sxy / sxx : 0;
  const intercepto = my - inclinacao * mx;
  const sqt = soma(ys.map((y) => (y - my) ** 2));
  const sqr = soma(ys.map((y, i) => (y - (intercepto + inclinacao * i)) ** 2));
  return { inclinacao, intercepto, r2: sqt ? 1 - sqr / sqt : 0 };
}

export type Previsao = {
  valor: number;
  minimo: number; // intervalo de previsão de 80%
  maximo: number;
  alfa: number;
  beta: number;
  erroMedio: number; // raiz do erro quadrático médio das previsões um passo à frente
};

// Suavização exponencial de Holt (nível + tendência), com alfa e beta escolhidos
// por busca em grade minimizando o erro das previsões um passo à frente.
export function previsaoHolt(ys: number[]): Previsao | null {
  if (ys.length < 3) return null;
  let melhor: { sse: number; alfa: number; beta: number; nivel: number; tendencia: number; erros: number[] } | null =
    null;
  for (let a = 1; a <= 19; a++) {
    for (let b = 1; b <= 19; b++) {
      const alfa = a / 20;
      const beta = b / 20;
      let nivel = ys[0];
      let tendencia = ys[1] - ys[0];
      const erros: number[] = [];
      for (let t = 1; t < ys.length; t++) {
        const previsto = nivel + tendencia;
        erros.push(ys[t] - previsto);
        const novoNivel = alfa * ys[t] + (1 - alfa) * (nivel + tendencia);
        tendencia = beta * (novoNivel - nivel) + (1 - beta) * tendencia;
        nivel = novoNivel;
      }
      const sse = soma(erros.map((e) => e * e));
      if (!melhor || sse < melhor.sse) melhor = { sse, alfa, beta, nivel, tendencia, erros };
    }
  }
  if (!melhor) return null;
  const erroMedio = Math.sqrt(melhor.sse / melhor.erros.length);
  const valor = Math.max(0, melhor.nivel + melhor.tendencia);
  const z80 = 1.2816; // quantil 90% da normal: intervalo central de 80%
  return {
    valor,
    minimo: Math.max(0, valor - z80 * erroMedio),
    maximo: valor + z80 * erroMedio,
    alfa: melhor.alfa,
    beta: melhor.beta,
    erroMedio,
  };
}

// Índice de Herfindahl-Hirschman (0 a 10.000): concentração dos gastos entre categorias.
export function hhi(participacoes: number[]): number {
  return soma(participacoes.map((p) => (p * 100) ** 2));
}

// Ticks "redondos" para um eixo de 0 até max (1, 2, 2,5 ou 5 × 10^k).
export function ticksEixo(max: number, alvo = 4): number[] {
  if (max <= 0) return [0];
  const bruto = max / alvo;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * potencia).find((p) => p >= bruto) ?? bruto;
  const ticks: number[] = [];
  for (let v = 0; v <= max + passo * 0.001; v += passo) ticks.push(Math.round(v * 100) / 100);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + passo);
  return ticks;
}
