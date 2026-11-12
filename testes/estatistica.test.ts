import { describe, expect, it } from "vitest";
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
  ticksEixo,
  zModificado,
} from "@/lib/estatistica";

describe("medidas básicas", () => {
  it("soma e média (lista vazia dá 0)", () => {
    expect(soma([1, 2, 3.5])).toBe(6.5);
    expect(media([2, 4, 9])).toBe(5);
    expect(media([])).toBe(0);
  });

  it("quantil igual ao QUARTIL.INC do Excel", () => {
    expect(quantil([1, 2, 3, 4], 0.25)).toBeCloseTo(1.75);
    expect(quantil([1, 2, 3, 4], 0.75)).toBeCloseTo(3.25);
    expect(quantil([7], 0.9)).toBe(7);
    expect(mediana([5, 1, 3])).toBe(3); // não depende da ordem
    expect(mediana([1, 2, 3, 4])).toBe(2.5);
  });

  it("desvio padrão amostral (n − 1), igual ao DESVPAD do Excel", () => {
    expect(desvioPadrao([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.13809, 4);
    expect(desvioPadrao([10])).toBe(0);
  });

  it("coeficiente de variação", () => {
    expect(coeficienteVariacao([10, 10, 10])).toBe(0);
    expect(coeficienteVariacao([0, 0])).toBe(0); // média zero não divide por zero
    expect(coeficienteVariacao([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.13809 / 5, 4);
  });

  it("assimetria: zero quando simétrico, positiva com cauda à direita", () => {
    expect(assimetria([1, 2, 3, 4, 5])).toBeCloseTo(0);
    expect(assimetria([1, 2, 3, 10])).toBeCloseTo(1.7638, 3); // DISTORÇÃO do Excel
    expect(assimetria([1, 2])).toBe(0);
  });
});

describe("valores atípicos", () => {
  it("MAD é a mediana dos desvios absolutos", () => {
    expect(mad([1, 1, 2, 2, 4, 6, 9])).toBe(1);
  });

  it("z modificado marca o extremo e não divide por zero", () => {
    expect(zModificado(9, 2, 1)).toBeCloseTo(4.7215);
    expect(zModificado(9, 2, 0)).toBe(0);
  });
});

describe("tendência e previsão", () => {
  it("regressão sobre uma reta perfeita", () => {
    const r = regressaoLinear([1, 3, 5, 7]);
    expect(r.inclinacao).toBeCloseTo(2);
    expect(r.intercepto).toBeCloseTo(1);
    expect(r.r2).toBeCloseTo(1);
  });

  it("regressão com um ponto só não quebra", () => {
    expect(regressaoLinear([42])).toEqual({ inclinacao: 0, intercepto: 42, r2: 0 });
  });

  it("Holt continua uma série linear e precisa de 3 meses", () => {
    const p = previsaoHolt([10, 20, 30, 40, 50]);
    expect(p?.valor).toBeCloseTo(60);
    expect(p?.erroMedio).toBeCloseTo(0);
    expect(previsaoHolt([10, 20])).toBeNull();
  });

  it("Holt nunca prevê gasto negativo", () => {
    const p = previsaoHolt([300, 200, 100, 10]);
    expect(p?.valor).toBeGreaterThanOrEqual(0);
    expect(p?.minimo).toBeGreaterThanOrEqual(0);
  });
});

describe("concentração e eixos", () => {
  it("HHI vai de 0 a 10.000", () => {
    expect(hhi([1])).toBeCloseTo(10000);
    expect(hhi([0.5, 0.5])).toBeCloseTo(5000);
    expect(hhi([0.25, 0.25, 0.25, 0.25])).toBeCloseTo(2500);
  });

  it("ticks redondos cobrindo o máximo", () => {
    expect(ticksEixo(100)).toEqual([0, 25, 50, 75, 100]);
    expect(ticksEixo(0)).toEqual([0]);
    const t = ticksEixo(1234);
    expect(t[t.length - 1]).toBeGreaterThanOrEqual(1234);
  });
});
