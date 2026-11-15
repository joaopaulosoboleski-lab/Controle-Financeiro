import { describe, expect, it } from "vitest";
import { dataValida, lerDinheiro, validar, validarConfirmacao, type ValoresFormulario } from "@/lib/formulario";

describe("lerDinheiro", () => {
  it.each([
    ["12,50", "12.50"],
    ["12.5", "12.50"],
    ["1.234,56", "1234.56"],
    [" 1 234,56 ", "1234.56"],
    ["100", "100.00"],
    ["99999999,99", "99999999.99"],
  ])("aceita %j como %s", (entrada, esperado) => {
    expect(lerDinheiro(entrada)).toMatchObject({ valor: esperado });
  });

  it.each(["", "abc", "12,345", "1,2,3", "R$ 10", "-5"])("recusa %j", (entrada) => {
    expect(lerDinheiro(entrada)).toHaveProperty("erro");
  });

  it("recusa zero e valor acima do limite de NUMERIC(10,2)", () => {
    expect(lerDinheiro("0")).toHaveProperty("erro");
    expect(lerDinheiro("100000000")).toHaveProperty("erro");
  });

  it("aceita negativo e zero só quando pedido (saldo inicial)", () => {
    expect(lerDinheiro("-150,25", { permitirNegativo: true })).toMatchObject({ valor: "-150.25", numero: -150.25 });
    expect(lerDinheiro("0", { permitirZero: true })).toMatchObject({ valor: "0.00" });
  });
});

describe("dataValida", () => {
  it("aceita datas reais", () => {
    expect(dataValida("2025-01-31")).toBe(true);
    expect(dataValida("2024-02-29")).toBe(true); // bissexto
  });

  it.each(["2025-02-29", "2025-13-01", "2025-1-1", "31/01/2025", ""])("recusa %j", (d) => {
    expect(dataValida(d)).toBe(false);
  });

  // Regressão: ano 9999 quebrava os cálculos mensais da Análise.
  it("recusa anos fora de 1900–2100", () => {
    expect(dataValida("9999-12-31")).toBe(false);
    expect(dataValida("1899-12-31")).toBe(false);
    expect(dataValida("2100-12-31")).toBe(true);
  });
});

describe("validar (lançamento)", () => {
  const base: ValoresFormulario = {
    descricao: "  mercado do mês ",
    valor: "318,45",
    tipo: "saida",
    data: "2025-05-14",
    contaId: "1",
    categoriaId: "3",
  };

  it("devolve os dados limpos", () => {
    expect(validar(base)).toEqual({
      dados: { descricao: "mercado do mês", valor: "318.45", tipo: "saida", data: "2025-05-14", contaId: 1, categoriaId: 3 },
    });
  });

  it.each<[Partial<ValoresFormulario>, RegExp]>([
    [{ descricao: "   " }, /descrição/],
    [{ descricao: "x".repeat(101) }, /100 caracteres/],
    [{ valor: "0" }, /maior que zero/],
    [{ tipo: "transferencia" }, /entrada ou saída/],
    [{ data: "2025-02-30" }, /data/],
    [{ contaId: "" }, /conta/],
    [{ categoriaId: "1.5" }, /categoria/],
  ])("recusa %j", (troca, mensagem) => {
    const r = validar({ ...base, ...troca });
    expect("erro" in r && r.erro).toMatch(mensagem);
  });
});

describe("validarConfirmacao (lançamento previsto)", () => {
  const base = { valor: "280,00", data: "2026-11-12", contaId: "3" };

  it("aceita valor, data e conta ajustados", () => {
    expect(validarConfirmacao(base)).toEqual({ dados: { valor: "280.00", data: "2026-11-12", contaId: 3 } });
  });

  it.each<[Partial<typeof base>, RegExp]>([
    [{ valor: "0" }, /maior que zero/],
    [{ valor: "-10" }, /maior que zero/],
    [{ valor: "" }, /valor válido/],
    [{ data: "" }, /data/],
    [{ data: "2026-02-30" }, /data/],
    [{ contaId: "" }, /conta/],
    [{ contaId: "abc" }, /conta/],
  ])("recusa %j", (troca, mensagem) => {
    const r = validarConfirmacao({ ...base, ...troca });
    expect("erro" in r && r.erro).toMatch(mensagem);
  });
});
