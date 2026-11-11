// Tipos e validação do formulário de lançamento (sem biblioteca externa).

export type ValoresFormulario = {
  descricao: string;
  valor: string;
  tipo: string;
  data: string;
  contaId: string;
  categoriaId: string;
};

export type EstadoFormulario = {
  erro?: string;
  valores?: ValoresFormulario;
};

export type DadosLancamento = {
  descricao: string;
  valor: string; // "12.50", pronto para NUMERIC
  tipo: "entrada" | "saida";
  data: string;
  contaId: number;
  categoriaId: number;
};

const VALOR_MAXIMO = 99999999.99; // limite de NUMERIC(10,2)

function texto(formData: FormData, campo: string): string {
  return String(formData.get(campo) ?? "");
}

export function lerValores(formData: FormData): ValoresFormulario {
  return {
    descricao: texto(formData, "descricao"),
    valor: texto(formData, "valor"),
    tipo: texto(formData, "tipo"),
    data: texto(formData, "data"),
    contaId: texto(formData, "contaId"),
    categoriaId: texto(formData, "categoriaId"),
  };
}

function dataValida(data: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
  const d = new Date(`${data}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === data;
}

// Devolve os dados limpos ou a mensagem do primeiro erro encontrado.
export function validar(v: ValoresFormulario): { dados: DadosLancamento } | { erro: string } {
  const descricao = v.descricao.trim();
  if (!descricao) return { erro: "Preencha a descrição." };
  if (descricao.length > 100) return { erro: "A descrição pode ter no máximo 100 caracteres." };

  const textoValor = v.valor.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(textoValor)) {
    return { erro: "Informe um valor válido, com no máximo 2 casas decimais." };
  }
  const numero = Number(textoValor);
  if (numero <= 0) return { erro: "O valor deve ser maior que zero." };
  if (numero > VALOR_MAXIMO) return { erro: "O valor é grande demais." };

  if (v.tipo !== "entrada" && v.tipo !== "saida") return { erro: "Escolha entrada ou saída." };
  if (!dataValida(v.data)) return { erro: "Informe uma data válida." };

  const contaId = Number(v.contaId);
  const categoriaId = Number(v.categoriaId);
  if (!Number.isInteger(contaId) || contaId <= 0) return { erro: "Escolha a conta." };
  if (!Number.isInteger(categoriaId) || categoriaId <= 0) return { erro: "Escolha a categoria." };

  return {
    dados: { descricao, valor: numero.toFixed(2), tipo: v.tipo, data: v.data, contaId, categoriaId },
  };
}
