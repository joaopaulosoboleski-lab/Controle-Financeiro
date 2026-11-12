// Interpreta o texto lido (OCR) de um comprovante de ENTRADA: PIX/TED recebido, holerite ou recibo.
// Função pura (sem banco, sem navegador): dá para testar com textos de exemplo.
// Nada aqui é salvo sozinho: o resultado só preenche o formulário, e a pessoa confere (R4).
import { dataValida } from "@/lib/formulario";

export type TipoComprovante = "pix" | "holerite" | "recibo" | "desconhecido";

export const NOMES_COMPROVANTE: Record<TipoComprovante, string> = {
  pix: "Comprovante de PIX/transferência",
  holerite: "Holerite / contracheque",
  recibo: "Recibo / nota de serviço",
  desconhecido: "Documento não reconhecido",
};

export type LeituraEntrada = {
  tipo: TipoComprovante;
  valor: string | null; // "1234,56", no formato do formulário
  data: string | null; // YYYY-MM-DD
  descricao: string;
  avisos: string[];
};

export type CategoriaOpcao = { id: number; nome: string; tipo: "entrada" | "saida" };

// ---------- Texto ----------

// Sem acento e em minúsculas, para comparar ("Líquido" = "liquido").
export function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function linhasDe(texto: string): string[] {
  return texto
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

// ---------- Valores ----------

// O OCR troca dígitos por letras parecidas ("1.2O0,0O", "R$ l50,00"). Corrige só em trechos com cara de número.
function corrigirDigitos(linha: string): string {
  return linha.replace(/[\dOoIl|SB][\dOoIl|SB.,\s]*[.,]\s?[\dOoIl|SB]{2}\b/g, (trecho) =>
    /\d/.test(trecho)
      ? trecho.replace(/[Oo]/g, "0").replace(/[Il|]/g, "1").replace(/S/g, "5").replace(/B/g, "8")
      : trecho,
  );
}

// Valores em reais de uma linha, em centavos (inteiro: sem erro de arredondamento, R10).
// Aceita "R$ 1.234,56", "1 234,56", "1234,56", "R$1.234.56" e "1,234.56".
export function valoresDaLinha(linhaBruta: string): number[] {
  const linha = corrigirDigitos(linhaBruta);
  const valores: number[] = [];
  const padrao = /(?<![\d/])(\d{1,3}(?:[.\s]\d{3})+|\d+)\s?[,.]\s?(\d{2})(?![\d/%])/g;
  for (const m of linha.matchAll(padrao)) {
    // Data (12.06.2025) ou hora (14.30) não é dinheiro: exige R$ por perto, ou separador de milhar, ou vírgula.
    const antes = linha.slice(Math.max(0, (m.index ?? 0) - 4), m.index);
    const temCifrao = /R\s?\$|RS|R5/i.test(antes);
    const temVirgula = m[0].includes(",");
    if (!temCifrao && !temVirgula) continue;
    const inteiros = Number(m[1].replace(/[.\s]/g, ""));
    const centavos = inteiros * 100 + Number(m[2]);
    if (centavos > 0 && centavos <= 9_999_999_999) valores.push(centavos);
  }
  return valores;
}

export function centavosParaTexto(centavos: number): string {
  return `${Math.floor(centavos / 100)},${String(centavos % 100).padStart(2, "0")}`;
}

// Primeiro valor da linha que casa com o rótulo; se a linha só tem o rótulo, olha as 2 seguintes.
function valorPorRotulo(linhas: string[], rotulo: RegExp, ignorar?: RegExp): number | null {
  for (let i = 0; i < linhas.length; i++) {
    const n = normalizar(linhas[i]);
    if (!rotulo.test(n) || ignorar?.test(n)) continue;
    for (let j = i; j <= Math.min(i + 2, linhas.length - 1); j++) {
      const v = valoresDaLinha(linhas[j]);
      if (v.length) return v[v.length - 1];
    }
  }
  return null;
}

function maiorValor(linhas: string[]): number | null {
  const todos = linhas.flatMap((l) => valoresDaLinha(l));
  return todos.length ? Math.max(...todos) : null;
}

// ---------- Datas ----------

const MESES: Record<string, number> = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
};

function montarData(dia: number, mes: number, ano: number): string | null {
  if (ano < 100) ano += 2000;
  const d = `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  return dataValida(d) ? d : null;
}

// Datas completas de uma linha: 12/06/2025, 12-06-25, 12.06.2025, "12 jun 2025", "12 de junho de 2025", 12/JUN/2025.
export function datasDaLinha(linhaBruta: string): string[] {
  const linha = normalizar(linhaBruta).replace(/[oO](?=\d)|(?<=\d)[oO]/g, "0");
  const datas: string[] = [];
  for (const m of linha.matchAll(/(?<!\d)(\d{1,2})\s?[/.-]\s?(\d{1,2})\s?[/.-]\s?(\d{4}|\d{2})(?!\d)/g)) {
    const d = montarData(Number(m[1]), Number(m[2]), Number(m[3]));
    if (d) datas.push(d);
  }
  for (const m of linha.matchAll(/(?<!\d)(\d{1,2})\s?(?:de\s|\/|-|\s)?\s?(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*\.?\s?(?:de\s|\/|-|\s)?\s?(\d{4})/g)) {
    const d = montarData(Number(m[1]), MESES[m[2]], Number(m[3]));
    if (d) datas.push(d);
  }
  return datas;
}

function dataPorRotulo(linhas: string[], rotulo: RegExp): string | null {
  for (let i = 0; i < linhas.length; i++) {
    if (!rotulo.test(normalizar(linhas[i]))) continue;
    for (let j = i; j <= Math.min(i + 1, linhas.length - 1); j++) {
      const d = datasDaLinha(linhas[j]);
      if (d.length) return d[0];
    }
  }
  return null;
}

function primeiraData(linhas: string[]): string | null {
  for (const l of linhas) {
    const d = datasDaLinha(l);
    if (d.length) return d[0];
  }
  return null;
}

// Mês de referência do holerite: "Referência: 06/2025", "Competência JUN/2025", "Mês: junho de 2025".
function referencia(linhas: string[]): string | null {
  for (const l of linhas) {
    const n = normalizar(l);
    if (!/referencia|competencia|mes\b|periodo/.test(n)) continue;
    const num = n.match(/(?<![\d/])(0?[1-9]|1[0-2])\s?\/\s?(\d{4})(?!\d)/);
    if (num) return `${num[1].padStart(2, "0")}/${num[2]}`;
    const nome = n.match(/(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*\.?\s?(?:de\s|\/|-)?\s?(\d{4})/);
    if (nome) return `${String(MESES[nome[1]]).padStart(2, "0")}/${nome[2]}`;
  }
  return null;
}

// ---------- Nomes (pagador, empresa, serviço) ----------

function limparNome(s: string): string {
  return s
    .replace(/^[\s:–—-]+/, "")
    .replace(/\s*(cpf|cnpj|ag[eê]ncia|conta|institui[cç][aã]o|banco)\b.*$/i, "")
    .replace(/[*•]+/g, "")
    .trim()
    .slice(0, 60);
}

function pareceNome(s: string): boolean {
  const letras = s.replace(/[^A-Za-zÀ-ÿ]/g, "").length;
  return letras >= 3 && letras >= s.replace(/\s/g, "").length * 0.6;
}

// Texto depois do rótulo, na mesma linha ou nas próximas (pulando rótulos como "Nome").
function textoPorRotulo(linhas: string[], rotulo: RegExp): string | null {
  for (let i = 0; i < linhas.length; i++) {
    const n = normalizar(linhas[i]);
    const m = n.match(rotulo);
    if (!m || m.index === undefined) continue;
    const resto = limparNome(linhas[i].slice(m.index + m[0].length));
    if (resto && pareceNome(resto) && !/^nome$/i.test(resto)) return resto.replace(/^nome\s*:?\s*/i, "");
    for (let j = i + 1; j <= Math.min(i + 3, linhas.length - 1); j++) {
      const candidata = limparNome(linhas[j].replace(/^nome\s*:?\s*/i, ""));
      if (candidata && pareceNome(candidata) && !/^(nome|cpf|cnpj|institui|banco|agencia|conta|tipo|chave)/i.test(normalizar(candidata)))
        return candidata;
    }
  }
  return null;
}

// "FULANO DE TAL" -> "Fulano de Tal" (o OCR costuma devolver nomes em maiúsculas).
function formatarNome(s: string): string {
  if (s !== s.toUpperCase()) return s;
  return s
    .toLowerCase()
    .split(" ")
    .map((p, i) => (i > 0 && /^(de|da|do|das|dos|e)$/.test(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ");
}

// ---------- Tipo do documento ----------

export function detectarTipo(texto: string): TipoComprovante {
  const n = normalizar(texto);
  if (/holerite|contracheque|contra-cheque|demonstrativo de pagamento|recibo de pagamento de salario|liquido a receber|total de vencimentos|salario base/.test(n))
    return "holerite";
  if (/\bpix\b|transferencia|\bted\b|comprovante de transf|chave pix|id da transacao|e2e/.test(n)) return "pix";
  if (/recibo|nota fiscal|nfs-?e|prestacao de servico|prestador|tomador/.test(n)) return "recibo";
  return "desconhecido";
}

// ---------- Interpretação ----------

export function interpretarComprovante(texto: string): LeituraEntrada {
  const linhas = linhasDe(texto);
  const tipo = detectarTipo(texto);
  const avisos: string[] = [];
  const n = normalizar(texto);
  let valor: number | null = null;
  let data: string | null = null;
  let descricao = "";

  if (tipo === "holerite") {
    valor =
      valorPorRotulo(linhas, /liquido a receber|valor liquido|total liquido|liquido\b/) ?? maiorValor(linhas);
    data = dataPorRotulo(linhas, /pagamento|credito|data/) ?? primeiraData(linhas);
    const ref = referencia(linhas);
    const empresa = textoPorRotulo(linhas, /(empresa|empregador|razao social)\s*:?/);
    descricao = ["Salário", ref].filter(Boolean).join(" ") + (empresa ? ` – ${formatarNome(empresa)}` : "");
  } else if (tipo === "pix") {
    // Comprovante de PIX ENVIADO é uma saída: avisa em vez de adivinhar.
    if (/pix enviado|transferencia enviada|pagamento enviado|voce (pagou|enviou|transferiu)/.test(n)) {
      avisos.push("Parece um PIX que você enviou (saída), não uma entrada. Confira o tipo.");
    }
    valor = valorPorRotulo(linhas, /\bvalor\b/, /tarifa|taxa|juros|multa/) ?? maiorValor(linhas);
    data = dataPorRotulo(linhas, /data|realizad|efetuad|em\b/) ?? primeiraData(linhas);
    // Rótulo no começo da linha: "de" solto casaria com "Comprovante de transferência".
    const pagador = textoPorRotulo(linhas, /^(origem|pagador|remetente|quem (pagou|enviou)|enviado por|recebido de|de)\b\s*:?/);
    const meio = /\bted\b/.test(n) ? "TED" : /\bdoc\b/.test(n) ? "DOC" : /\bpix\b/.test(n) ? "PIX" : "Transferência";
    descricao = pagador ? `${meio} de ${formatarNome(pagador)}` : `${meio} recebido`;
  } else if (tipo === "recibo") {
    valor =
      valorPorRotulo(linhas, /valor total|total|valor liquido|importancia|quantia|\bvalor\b/, /imposto|iss\b|inss|irrf|desconto/) ??
      maiorValor(linhas);
    data = dataPorRotulo(linhas, /emissao|data|recebi|pagamento/) ?? primeiraData(linhas);
    const servico = textoPorRotulo(linhas, /(referente (a|ao|a os|as)?|servicos? prestados?|descricao( do servico)?|discriminacao( dos servicos)?)\s*:?/);
    descricao = servico ? `Recibo – ${servico}` : "Recibo de serviço";
  } else {
    valor = maiorValor(linhas);
    data = primeiraData(linhas);
    descricao = "";
    avisos.push("Não reconheci o tipo do documento: confira todos os campos.");
  }

  if (valor === null) avisos.push("Não encontrei o valor: digite-o.");
  if (data === null) avisos.push("Não encontrei a data: ficou a de hoje, confira.");

  return {
    tipo,
    valor: valor === null ? null : centavosParaTexto(valor),
    data,
    descricao: descricao.slice(0, 100),
    avisos,
  };
}

// Categoria de entrada com nome parecido com o tipo do documento (ex.: "Salário" para holerite).
export function sugerirCategoria(tipo: TipoComprovante, categorias: CategoriaOpcao[]): number | undefined {
  const palavras: Record<TipoComprovante, RegExp> = {
    holerite: /salari|ordenado|holerite|pagamento/,
    recibo: /freela|servic|autonom|extra|bico|trabalho/,
    pix: /pix|transfer|recebid|outr/,
    desconhecido: /outr/,
  };
  const entradas = categorias.filter((c) => c.tipo === "entrada");
  return entradas.find((c) => palavras[tipo].test(normalizar(c.nome)))?.id;
}
