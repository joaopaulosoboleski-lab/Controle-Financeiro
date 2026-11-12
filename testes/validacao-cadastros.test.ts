import { describe, expect, it } from "vitest";
import {
  dataNoMes,
  mesValido,
  mesVizinho,
  validarCategoria,
  validarConta,
  validarRecorrencia,
  type ValoresRecorrencia,
} from "@/lib/validacao-cadastros";

const erro = (r: { erro: string } | { dados: unknown }) => ("erro" in r ? r.erro : "");

describe("validarConta (R2)", () => {
  const base = { nome: " Conta  Corrente ", tipo: "corrente", saldoInicial: "1.500,00", dataAbertura: "2025-01-01" };

  it("limpa o nome e converte o saldo", () => {
    expect(validarConta(base)).toEqual({
      dados: { nome: "Conta Corrente", tipo: "corrente", saldoInicial: "1500.00", dataAbertura: "2025-01-01" },
    });
  });

  it("aceita saldo zero e negativo, mas não em branco", () => {
    expect(validarConta({ ...base, saldoInicial: "0" })).toHaveProperty("dados");
    expect(validarConta({ ...base, saldoInicial: "-320,10" })).toMatchObject({ dados: { saldoInicial: "-320.10" } });
    expect(erro(validarConta({ ...base, saldoInicial: " " }))).toMatch(/pode ser 0/);
  });

  it("recusa tipo desconhecido e data inválida", () => {
    expect(erro(validarConta({ ...base, tipo: "investimento" }))).toMatch(/tipo/);
    expect(erro(validarConta({ ...base, dataAbertura: "" }))).toMatch(/data/);
  });
});

describe("validarCategoria (R3)", () => {
  it("normaliza a cor para maiúsculas", () => {
    expect(validarCategoria({ nome: "Mercado", tipo: "saida", cor: "#e53935", ativa: true })).toEqual({
      dados: { nome: "Mercado", tipo: "saida", cor: "#E53935", ativa: true },
    });
  });

  it.each(["e53935", "#E5393", "#GGGGGG", "red"])("recusa a cor %j", (cor) => {
    expect(erro(validarCategoria({ nome: "Mercado", tipo: "saida", cor, ativa: true }))).toMatch(/#RRGGBB/);
  });

  it("recusa tipo que não seja entrada ou saída", () => {
    expect(erro(validarCategoria({ nome: "X", tipo: "outro", cor: "#000000", ativa: true }))).toMatch(/entrada ou de saída/);
  });
});

describe("validarRecorrencia (R6)", () => {
  const base: ValoresRecorrencia = {
    descricao: "Aluguel",
    valor: "2.350,00",
    dia: "5",
    contaId: "1",
    categoriaId: "3",
    dataInicio: "2025-01-01",
    dataFim: "",
  };

  it("aceita sem data de fim", () => {
    expect(validarRecorrencia(base)).toMatchObject({ dados: { valor: "2350.00", dia: 5, dataFim: null } });
  });

  it("o dia precisa caber em qualquer mês (1 a 28)", () => {
    expect(validarRecorrencia({ ...base, dia: "28" })).toHaveProperty("dados");
    expect(erro(validarRecorrencia({ ...base, dia: "29" }))).toMatch(/1 a 28/);
    expect(erro(validarRecorrencia({ ...base, dia: "0" }))).toMatch(/1 a 28/);
  });

  it("a data de fim não pode ser antes do início", () => {
    expect(validarRecorrencia({ ...base, dataFim: "2025-01-01" })).toHaveProperty("dados");
    expect(erro(validarRecorrencia({ ...base, dataFim: "2024-12-31" }))).toMatch(/antes da data de início/);
  });

  it("valor previsto precisa ser positivo", () => {
    expect(erro(validarRecorrencia({ ...base, valor: "0" }))).toMatch(/Valor previsto/);
  });
});

describe("meses", () => {
  it("mesVizinho atravessa a virada do ano", () => {
    expect(mesVizinho("2025-12", 1)).toBe("2026-01");
    expect(mesVizinho("2025-01", -1)).toBe("2024-12");
    expect(mesVizinho("2025-06", -12)).toBe("2024-06");
  });

  it("mesValido", () => {
    expect(mesValido("2025-06")).toBe(true);
    expect(mesValido("2025-13")).toBe(false);
    expect(mesValido("2025-6")).toBe(false);
    expect(mesValido("9999-01")).toBe(false);
    expect(mesValido(undefined)).toBe(false);
  });

  it("dataNoMes completa o dia com zero", () => {
    expect(dataNoMes("2025-02", 5)).toBe("2025-02-05");
    expect(dataNoMes("2025-02", 28)).toBe("2025-02-28");
  });
});
