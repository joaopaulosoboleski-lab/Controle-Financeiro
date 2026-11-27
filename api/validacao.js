// Validação pura do corpo de POST /lancamentos (sem banco), para poder ser testada.
// Segue as regras de schema.sql: valor NUMERIC(10,2) positivo, tipo entrada/saida, data real.

const VALOR_MAXIMO = 99999999.99; // NUMERIC(10,2)

function idValido(v) {
  return Number.isInteger(v) && v > 0;
}

function dataValida(texto) {
  if (typeof texto !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const [ano, mes, dia] = texto.split("-").map(Number);
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  // Rejeita datas que o Date "conserta", como 2025-02-30.
  return d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}

function duasCasas(v) {
  return Math.abs(v * 100 - Math.round(v * 100)) < 1e-6;
}

// Número (325.5) ou texto com ponto decimal ("325.00"). Recusa o resto, inclusive o formato
// brasileiro "1.250,80" (ali o ponto é milhar: ambíguo) e o que o Number() aceitaria
// sem querer, como "1e3", "0x10", "" ou true.
function lerValor(valor) {
  if (typeof valor === "number") return valor;
  if (typeof valor === "string" && /^\d+(\.\d+)?$/.test(valor.trim())) return Number(valor);
  return NaN;
}

// Devolve { erro } com a primeira mensagem de erro, ou { dados } pronto para o insert.
export function validarLancamento(corpo) {
  if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) {
    return { erro: "Envie um objeto JSON." };
  }
  const { usuario_id, conta_id, categoria_id, tipo, data_lancamento, descricao } = corpo;
  const valor = lerValor(corpo.valor);

  if (!idValido(usuario_id)) return { erro: "usuario_id inválido." };
  if (!idValido(conta_id)) return { erro: "conta_id inválido." };
  if (!idValido(categoria_id)) return { erro: "categoria_id inválido." };
  if (tipo !== "entrada" && tipo !== "saida") return { erro: "tipo deve ser 'entrada' ou 'saida'." };
  if (!Number.isFinite(valor) || valor <= 0) {
    return { erro: "valor deve ser um número maior que zero (ex.: 325.00 ou \"325.00\")." };
  }
  if (valor > VALOR_MAXIMO) return { erro: "valor acima do máximo permitido." };
  if (!duasCasas(valor)) return { erro: "valor aceita no máximo duas casas decimais." };
  if (!dataValida(data_lancamento)) return { erro: "data_lancamento deve ser uma data AAAA-MM-DD válida." };
  if (descricao != null && typeof descricao !== "string") return { erro: "descricao deve ser texto." };

  const texto = typeof descricao === "string" ? descricao.trim() : "";
  return {
    dados: {
      usuario_id,
      conta_id,
      categoria_id,
      tipo,
      valor: Math.round(valor * 100) / 100,
      data_lancamento,
      descricao: texto === "" ? null : texto,
    },
  };
}
