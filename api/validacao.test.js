import { test } from "node:test";
import assert from "node:assert/strict";
import { validarLancamento } from "./validacao.js";

const exemplo = {
  usuario_id: 1,
  conta_id: 1,
  categoria_id: 1,
  tipo: "saida",
  valor: 1250.8,
  data_lancamento: "2025-05-05",
  descricao: "mercado do mes",
};

test("aceita o exemplo do enunciado", () => {
  assert.deepEqual(validarLancamento(exemplo), { dados: exemplo });
});

test("descrição vazia vira null e é aparada", () => {
  assert.equal(validarLancamento({ ...exemplo, descricao: "   " }).dados.descricao, null);
  assert.equal(validarLancamento({ ...exemplo, descricao: undefined }).dados.descricao, null);
  assert.equal(validarLancamento({ ...exemplo, descricao: " a " }).dados.descricao, "a");
});

test("rejeita campos inválidos", () => {
  const casos = [
    null,
    [],
    { ...exemplo, usuario_id: "1" },
    { ...exemplo, conta_id: 0 },
    { ...exemplo, categoria_id: 1.5 },
    { ...exemplo, tipo: "Saida" },
    { ...exemplo, valor: 0 },
    { ...exemplo, valor: -10 },
    { ...exemplo, valor: "1250.80" },
    { ...exemplo, valor: 10.123 },
    { ...exemplo, valor: 100000000 },
    { ...exemplo, data_lancamento: "2025-02-30" },
    { ...exemplo, data_lancamento: "05/05/2025" },
    { ...exemplo, descricao: 123 },
  ];
  for (const corpo of casos) {
    assert.ok(validarLancamento(corpo).erro, `deveria rejeitar ${JSON.stringify(corpo)}`);
  }
});

test("aceita valores com duas casas sem erro de ponto flutuante", () => {
  assert.equal(validarLancamento({ ...exemplo, valor: 0.1 + 0.2 }).dados.valor, 0.3);
  assert.equal(validarLancamento({ ...exemplo, valor: 99999999.99 }).dados.valor, 99999999.99);
});
