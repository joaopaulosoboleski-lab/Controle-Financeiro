import { describe, expect, it } from "vitest";
import {
  datasDaLinha,
  detectarTipo,
  interpretarComprovante,
  sugerirCategoria,
  valoresDaLinha,
} from "@/lib/ocr-entrada";

// Textos no estilo do que o Tesseract devolve: maiúsculas, quebras de linha soltas e letras no lugar de dígitos.

const PIX_NUBANK = `
Comprovante de transferência
12 JUN 2025 - 14:32:05
Valor
R$ 1.250,00
Tipo de transferência
Pix
Origem
Nome
MARIA APARECIDA SOUZA
Instituição
BANCO DO BRASIL S.A.
CPF ***.123.456-**
Destino
Nome
Claudia Marques
ID da transação: E18236120202506121432s07b0f8a1c2
`;

const PIX_RUIDOSO = `
Pix recebido
R$ l.2O0,5O
Recebido de: JOAO PEDRO LIMA
Data: 03/O5/2025 às 09:10
Tarifa R$ 0,00
`;

const TED = `
COMPROVANTE DE TRANSFERENCIA - TED
Data da transferencia: 28/02/2025
Remetente: Empresa Alfa Servicos Ltda
CNPJ: 12.345.678/0001-90
Valor: R$ 3.400,00
`;

const PIX_ENVIADO = `
Pix enviado
Você pagou
R$ 89,90
Data 10/06/2025
Para
Padaria Central
`;

const HOLERITE = `
DEMONSTRATIVO DE PAGAMENTO DE SALARIO
Empresa: ACME COMERCIO DE ALIMENTOS LTDA     CNPJ 11.222.333/0001-44
Referência: 06/2025
Cód  Descrição                 Ref      Vencimentos    Descontos
001  SALARIO BASE              30,00    5.200,00
101  INSS                      14,00                   612,40
102  IRRF                                              301,22
Total de Vencimentos  5.200,00   Total de Descontos  913,62
Líquido a Receber ->  4.286,38
Data de pagamento: 05/07/2025
`;

const HOLERITE_SEM_DATA = `
CONTRACHEQUE
Empregador
PREFEITURA MUNICIPAL DE CURITIBA
Competência JUN/2025
Valor Líquido   R$ 3.912,07
`;

const RECIBO = `
RECIBO
Valor: R$ 850,00
Recebi de Paulo Marques a importância de oitocentos e cinquenta reais
referente a: Criação de identidade visual para a padaria
Curitiba, 15 de abril de 2025
`;

const NFSE = `
NOTA FISCAL DE SERVIÇOS ELETRÔNICA - NFS-e
Data de emissão: 20/05/2025
Tomador: Clínica Bem Estar
Discriminação dos serviços:
Consultoria em planilhas financeiras
ISS retido R$ 60,00
Valor total da nota R$ 1.200,00
`;

describe("valoresDaLinha", () => {
  it.each([
    ["R$ 1.250,00", [125000]],
    ["R$1250,00", [125000]],
    ["1 234,56", [123456]],
    ["R$ l.2O0,5O", [120050]], // l -> 1, O -> 0
    ["Total 5.200,00 Descontos 913,62", [520000, 91362]],
  ])("%j", (linha, esperado) => {
    expect(valoresDaLinha(linha)).toEqual(esperado);
  });

  it("não confunde data, hora, CNPJ ou porcentagem com dinheiro", () => {
    expect(valoresDaLinha("12.06.2025 14.30")).toEqual([]);
    expect(valoresDaLinha("CNPJ 12.345.678/0001-90")).toEqual([]);
    expect(valoresDaLinha("INSS 14,00%")).toEqual([]);
  });
});

describe("datasDaLinha", () => {
  it.each([
    ["12/06/2025", "2025-06-12"],
    ["3-5-25", "2025-05-03"],
    ["12 JUN 2025 - 14:32", "2025-06-12"],
    ["15 de abril de 2025", "2025-04-15"],
    ["10/JUL/2025", "2025-07-10"],
    ["Data: 03/O5/2025", "2025-05-03"],
  ])("%j", (linha, esperado) => {
    expect(datasDaLinha(linha)[0]).toBe(esperado);
  });

  it("ignora datas impossíveis", () => {
    expect(datasDaLinha("31/02/2025")).toEqual([]);
    expect(datasDaLinha("12/06/9999")).toEqual([]);
  });
});

describe("detectarTipo", () => {
  it("reconhece cada documento", () => {
    expect(detectarTipo(PIX_NUBANK)).toBe("pix");
    expect(detectarTipo(TED)).toBe("pix");
    expect(detectarTipo(HOLERITE)).toBe("holerite");
    expect(detectarTipo(HOLERITE_SEM_DATA)).toBe("holerite");
    expect(detectarTipo(RECIBO)).toBe("recibo");
    expect(detectarTipo(NFSE)).toBe("recibo");
    expect(detectarTipo("lista de compras\nleite\npão")).toBe("desconhecido");
  });
});

describe("interpretarComprovante", () => {
  it("PIX do Nubank: valor, data e quem pagou", () => {
    expect(interpretarComprovante(PIX_NUBANK)).toMatchObject({
      tipo: "pix",
      valor: "1250,00",
      data: "2025-06-12",
      descricao: "PIX de Maria Aparecida Souza",
      avisos: [],
    });
  });

  it("PIX com ruído de OCR", () => {
    expect(interpretarComprovante(PIX_RUIDOSO)).toMatchObject({
      valor: "1200,50",
      data: "2025-05-03",
      descricao: "PIX de Joao Pedro Lima",
    });
  });

  it("TED: ignora o CNPJ e usa o valor do rótulo", () => {
    expect(interpretarComprovante(TED)).toMatchObject({
      tipo: "pix",
      valor: "3400,00",
      data: "2025-02-28",
      descricao: "TED de Empresa Alfa Servicos Ltda",
    });
  });

  it("PIX enviado gera aviso de que é saída", () => {
    const r = interpretarComprovante(PIX_ENVIADO);
    expect(r.avisos.join(" ")).toMatch(/saída/);
    expect(r.valor).toBe("89,90");
  });

  it("holerite: líquido a receber, data do pagamento, referência e empresa", () => {
    expect(interpretarComprovante(HOLERITE)).toMatchObject({
      tipo: "holerite",
      valor: "4286,38",
      data: "2025-07-05",
      descricao: "Salário 06/2025 – Acme Comercio de Alimentos Ltda",
      avisos: [],
    });
  });

  it("holerite sem data avisa e usa a competência na descrição", () => {
    const r = interpretarComprovante(HOLERITE_SEM_DATA);
    expect(r).toMatchObject({ valor: "3912,07", data: null, descricao: "Salário 06/2025 – Prefeitura Municipal de Curitiba" });
    expect(r.avisos.join(" ")).toMatch(/data/);
  });

  it("recibo: valor, data por extenso e serviço", () => {
    expect(interpretarComprovante(RECIBO)).toMatchObject({
      tipo: "recibo",
      valor: "850,00",
      data: "2025-04-15",
      descricao: "Recibo – Criação de identidade visual para a padaria",
    });
  });

  it("NFS-e: valor total, não o imposto", () => {
    expect(interpretarComprovante(NFSE)).toMatchObject({
      valor: "1200,00",
      data: "2025-05-20",
      descricao: "Recibo – Consultoria em planilhas financeiras",
    });
  });

  it("texto sem nada útil não quebra e avisa", () => {
    const r = interpretarComprovante("");
    expect(r).toMatchObject({ tipo: "desconhecido", valor: null, data: null });
    expect(r.avisos.length).toBeGreaterThan(0);
  });
});

describe("sugerirCategoria", () => {
  const categorias = [
    { id: 1, nome: "Mercado", tipo: "saida" as const },
    { id: 7, nome: "Salário", tipo: "entrada" as const },
    { id: 8, nome: "Freelas", tipo: "entrada" as const },
    { id: 9, nome: "Outras entradas", tipo: "entrada" as const },
  ];

  it("escolhe pelo tipo do documento", () => {
    expect(sugerirCategoria("holerite", categorias)).toBe(7);
    expect(sugerirCategoria("recibo", categorias)).toBe(8);
    expect(sugerirCategoria("pix", categorias)).toBe(9);
  });

  it("nunca sugere categoria de saída, e fica sem sugestão se não houver parecida", () => {
    expect(sugerirCategoria("holerite", [{ id: 1, nome: "Salário", tipo: "saida" }])).toBeUndefined();
  });
});
