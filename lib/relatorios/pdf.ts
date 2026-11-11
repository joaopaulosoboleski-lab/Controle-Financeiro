import PDFDocument from "pdfkit";
import {
  conclusoes,
  formatarCompacto,
  formatarPercentual,
  lerAssimetria,
  lerTendencia,
  mesCurto,
  type Analise,
} from "@/lib/analise";
import { ticksEixo } from "@/lib/estatistica";
import { formatarData, formatarValor } from "@/lib/lancamentos";

// Cores do tema claro (as mesmas validadas para a tela).
const C = {
  tinta: "#1f2933",
  suave: "#667085",
  borda: "#e2e5ea",
  grade: "#eceae4",
  eixo: "#c3c2b7",
  entrada: "#2a78d6",
  saida: "#eb6834",
  saidaSuave: "#f5b393",
  negativo: "#e34948",
  neutro: "#c3c2b7",
  destaque: "#2f6f5e",
  fundo: "#f6f7f9",
};

const MARGEM = 42;
const LARGURA = 595.28 - MARGEM * 2; // A4

// As fontes padrão do PDF (Helvetica) usam WinAnsi: troca o que ficaria como "?".
function t(s: string): string {
  return s
    .replace(/[−–]/g, "-")
    .replace(/α/g, "alfa")
    .replace(/β/g, "beta")
    .replace(/▲/g, "+")
    .replace(/▼/g, "-")
    .replace(/[  ]/g, " ");
}

type Doc = PDFKit.PDFDocument;

function garantirEspaco(doc: Doc, altura: number) {
  if (doc.y + altura > doc.page.height - MARGEM - 20) doc.addPage();
}

// "reservar" = altura do conteúdo que vem logo abaixo, para o título não ficar sozinho no pé da página.
function tituloSecao(doc: Doc, texto: string, subtitulo?: string, reservar = 60) {
  garantirEspaco(doc, reservar + 45);
  doc.moveDown(0.6);
  doc.font("Helvetica-Bold").fontSize(13).fillColor(C.tinta).text(t(texto), MARGEM, doc.y, { width: LARGURA });
  if (subtitulo) doc.font("Helvetica").fontSize(9).fillColor(C.suave).text(t(subtitulo), { width: LARGURA });
  doc.moveDown(0.4);
}

// Coluna com ponta arredondada (4pt) e base reta.
function coluna(doc: Doc, x: number, base: number, largura: number, altura: number, cor: string) {
  if (Math.abs(altura) < 0.3) return;
  const r = Math.min(3, largura / 2, Math.abs(altura));
  if (altura > 0) {
    const topo = base - altura;
    doc.moveTo(x, base).lineTo(x, topo + r).quadraticCurveTo(x, topo, x + r, topo).lineTo(x + largura - r, topo)
      .quadraticCurveTo(x + largura, topo, x + largura, topo + r).lineTo(x + largura, base).closePath().fill(cor);
  } else {
    const fundo = base - altura;
    doc.moveTo(x, base).lineTo(x, fundo - r).quadraticCurveTo(x, fundo, x + r, fundo).lineTo(x + largura - r, fundo)
      .quadraticCurveTo(x + largura, fundo, x + largura, fundo - r).lineTo(x + largura, base).closePath().fill(cor);
  }
}

function legenda(doc: Doc, x: number, y: number, itens: { rotulo: string; cor: string; linha?: boolean }[]) {
  let cx = x;
  doc.font("Helvetica").fontSize(8);
  for (const i of itens) {
    if (i.linha) doc.rect(cx, y + 3, 10, 1.6).fill(i.cor);
    else doc.roundedRect(cx, y, 8, 8, 2).fill(i.cor);
    doc.fillColor(C.suave).text(t(i.rotulo), cx + 13, y, { lineBreak: false });
    cx += 13 + doc.widthOfString(t(i.rotulo)) + 14;
  }
}

type Eixo = { y: (v: number) => number; esquerda: number; direita: number; base: number };

// Grade horizontal + rótulos do eixo Y. Devolve a escala.
function grade(doc: Doc, x: number, y: number, largura: number, altura: number, minimo: number, maximo: number, formato = formatarCompacto): Eixo {
  const esquerda = x + 52;
  const direita = x + largura;
  const topo = y + 6;
  const base = y + altura - 16;
  const escala = (v: number) => base - ((v - minimo) / (maximo - minimo || 1)) * (base - topo);
  const passos = ticksEixo(Math.max(Math.abs(maximo), Math.abs(minimo)));
  const ticks = [...new Set([...passos.filter((v) => v <= maximo), ...passos.filter((v) => -v >= minimo).map((v) => -v), 0])].sort((a, b) => a - b);
  doc.font("Helvetica").fontSize(7.5);
  for (const v of ticks) {
    const yy = escala(v);
    doc.moveTo(esquerda, yy).lineTo(direita, yy).lineWidth(v === 0 ? 0.8 : 0.5).strokeColor(v === 0 ? C.eixo : C.grade).stroke();
    doc.fillColor(C.suave).text(t(formato(v)), x, yy - 3.5, { width: 46, align: "right", lineBreak: false });
  }
  return { y: escala, esquerda, direita, base };
}

function rotuloX(doc: Doc, texto: string, centro: number, y: number) {
  doc.font("Helvetica").fontSize(7.5).fillColor(C.suave);
  const w = doc.widthOfString(texto);
  doc.text(texto, centro - w / 2, y + 4, { lineBreak: false });
}

function graficoMensal(doc: Doc, a: Analise) {
  const altura = 170;
  garantirEspaco(doc, altura + 30);
  legenda(doc, MARGEM, doc.y, [{ rotulo: "Entradas", cor: C.entrada }, { rotulo: "Saídas", cor: C.saida }]);
  const y0 = doc.y + 16;
  const max = Math.max(1, ...a.mensal.flatMap((m) => [m.entradas, m.saidas]));
  const topoEscala = ticksEixo(max).at(-1) ?? max;
  const e = grade(doc, MARGEM, y0, LARGURA, altura, 0, topoEscala);
  const faixa = (e.direita - e.esquerda) / a.mensal.length;
  const w = Math.min(18, (faixa - 10) / 2);
  a.mensal.forEach((m, i) => {
    const centro = e.esquerda + faixa * i + faixa / 2;
    coluna(doc, centro - w - 1, e.base, w, e.base - e.y(m.entradas), C.entrada);
    coluna(doc, centro + 1, e.base, w, e.base - e.y(m.saidas), C.saida);
    rotuloX(doc, mesCurto(m.mes), centro, e.base);
  });
  doc.y = y0 + altura + 6;
}

function graficoResultado(doc: Doc, a: Analise) {
  const altura = 130;
  garantirEspaco(doc, altura + 10);
  const y0 = doc.y;
  const maxAbs = Math.max(1, ...a.mensal.map((m) => Math.abs(m.resultado)));
  const lim = ticksEixo(maxAbs, 2).at(-1) ?? maxAbs;
  const temPos = a.mensal.some((m) => m.resultado > 0);
  const temNeg = a.mensal.some((m) => m.resultado < 0);
  const e = grade(doc, MARGEM, y0, LARGURA, altura, temNeg ? -lim : 0, temPos ? lim : 0);
  const faixa = (e.direita - e.esquerda) / a.mensal.length;
  const w = Math.min(22, faixa - 10);
  a.mensal.forEach((m, i) => {
    const centro = e.esquerda + faixa * i + faixa / 2;
    const zero = e.y(0);
    coluna(doc, centro - w / 2, zero, w, zero - e.y(m.resultado), m.resultado >= 0 ? C.entrada : C.negativo);
    rotuloX(doc, mesCurto(m.mes), centro, e.base);
  });
  doc.y = y0 + altura + 6;
}

function graficoTendencia(doc: Doc, a: Analise) {
  const tend = a.tendencia;
  if (!tend) return;
  const altura = 170;
  garantirEspaco(doc, altura + 30);
  const prev = tend.previsao;
  legenda(doc, MARGEM, doc.y, [
    { rotulo: "Saídas do mês", cor: C.saida, linha: true },
    { rotulo: "Tendência linear", cor: C.suave, linha: true },
    ...(prev ? [{ rotulo: "Previsão (faixa de 80%)", cor: C.saidaSuave }] : []),
  ]);
  const y0 = doc.y + 16;
  const max = Math.max(1, ...a.mensal.map((m) => m.saidas), prev?.maximo ?? 0);
  const topoEscala = ticksEixo(max).at(-1) ?? max;
  const e = grade(doc, MARGEM, y0, LARGURA, altura, 0, topoEscala);
  const n = a.mensal.length + (prev ? 1 : 0);
  const passo = (e.direita - e.esquerda) / n;
  const x = (i: number) => e.esquerda + passo * i + passo / 2;
  const ultimo = a.mensal.length - 1;
  const { inclinacao, intercepto } = tend.regressao;

  if (prev) {
    doc.roundedRect(x(a.mensal.length) - 10, e.y(prev.maximo), 20, Math.max(1, e.y(prev.minimo) - e.y(prev.maximo)), 3).fillOpacity(0.35).fill(C.saidaSuave).fillOpacity(1);
    doc.moveTo(x(ultimo), e.y(a.mensal[ultimo].saidas)).lineTo(x(a.mensal.length), e.y(prev.valor)).dash(3, { space: 3 }).lineWidth(1.6).strokeColor(C.saida).stroke().undash();
  }
  doc.moveTo(x(0), e.y(intercepto)).lineTo(x(ultimo), e.y(intercepto + inclinacao * ultimo)).lineWidth(1.2).strokeColor(C.suave).stroke();
  a.mensal.forEach((m, i) => {
    if (i === 0) doc.moveTo(x(i), e.y(m.saidas));
    else doc.lineTo(x(i), e.y(m.saidas));
  });
  doc.lineWidth(1.8).lineJoin("round").strokeColor(C.saida).stroke();
  a.mensal.forEach((m, i) => {
    doc.circle(x(i), e.y(m.saidas), 3.2).lineWidth(1.5).fillAndStroke(C.saida, "#ffffff");
    rotuloX(doc, mesCurto(m.mes), x(i), e.base);
  });
  if (prev) {
    doc.circle(x(a.mensal.length), e.y(prev.valor), 3.2).lineWidth(1.5).fillAndStroke("#ffffff", C.saida);
    rotuloX(doc, mesCurto(prev.mes), x(a.mensal.length), e.base);
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(C.tinta);
    const rotulo = t(formatarCompacto(prev.valor));
    doc.text(rotulo, x(a.mensal.length) - doc.widthOfString(rotulo) / 2, e.y(prev.maximo) - 11, { lineBreak: false });
  }
  doc.y = y0 + altura + 6;
}

// Barras horizontais ranqueadas (Pareto): até 12 categorias, o resto vira "Outras".
function graficoCategorias(doc: Doc, a: Analise) {
  const lista = a.saidasPorCategoria;
  if (!lista.length) return;
  const mostrar = lista.slice(0, 12).map((c, i) => ({ ...c, essencial: i === 0 || lista[i - 1].acumulado < 0.8 }));
  if (lista.length > 12) {
    const resto = lista.slice(12);
    mostrar.push({ ...resto[0], nome: `Outras (${resto.length})`, total: resto.reduce((s, c) => s + c.total, 0), participacao: resto.reduce((s, c) => s + c.participacao, 0), essencial: false });
  }
  const alturaLinha = 17;
  garantirEspaco(doc, mostrar.length * alturaLinha + 30);
  legenda(doc, MARGEM, doc.y, [{ rotulo: "Categorias que somam 80% dos gastos", cor: C.saida }, { rotulo: "Demais", cor: C.neutro }]);
  let y = doc.y + 16;
  const xNome = MARGEM;
  const xBarra = MARGEM + 120;
  const larguraBarra = LARGURA - 120 - 95;
  const max = Math.max(...mostrar.map((c) => c.total));
  for (const c of mostrar) {
    doc.font("Helvetica").fontSize(8.5).fillColor(C.tinta).text(t(c.nome), xNome, y + 2, { width: 114, ellipsis: true, lineBreak: false });
    const comprimento = Math.max(1, (c.total / max) * larguraBarra);
    const r = Math.min(3, comprimento);
    doc.moveTo(xBarra, y + 2).lineTo(xBarra + comprimento - r, y + 2).quadraticCurveTo(xBarra + comprimento, y + 2, xBarra + comprimento, y + 2 + r)
      .lineTo(xBarra + comprimento, y + 12 - r).quadraticCurveTo(xBarra + comprimento, y + 12, xBarra + comprimento - r, y + 12).lineTo(xBarra, y + 12).closePath()
      .fill(c.essencial ? C.saida : C.neutro);
    doc.font("Helvetica").fontSize(8.5).fillColor(C.tinta).text(t(`${formatarCompacto(c.total)}  ${formatarPercentual(c.participacao, 0)}`), xBarra + larguraBarra + 6, y + 2, { width: 89, align: "right", lineBreak: false });
    y += alturaLinha;
  }
  doc.y = y + 4;
}

function graficoColunasSimples(doc: Doc, rotulos: string[], valores: number[], destaque: number, formato: (v: number) => string, rotuloDestaque: string) {
  const altura = 130;
  garantirEspaco(doc, altura + 10);
  const y0 = doc.y;
  const max = Math.max(1, ...valores);
  const topoEscala = ticksEixo(max, 3).at(-1) ?? max;
  const e = grade(doc, MARGEM, y0, LARGURA, altura, 0, topoEscala, formato);
  const faixa = (e.direita - e.esquerda) / valores.length;
  const w = Math.min(28, faixa - 4);
  valores.forEach((v, i) => {
    const centro = e.esquerda + faixa * i + faixa / 2;
    coluna(doc, centro - w / 2, e.base, w, e.base - e.y(v), i === destaque ? C.saida : C.saidaSuave);
    rotuloX(doc, rotulos[i], centro, e.base);
    if (i === destaque) {
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor(C.tinta);
      const r = t(rotuloDestaque);
      doc.text(r, centro - doc.widthOfString(r) / 2, e.y(v) - 11, { lineBreak: false });
    }
  });
  doc.y = y0 + altura + 6;
}

type ColunaTabela = { titulo: string; largura: number; alinhar?: "left" | "right" };

function tabela(doc: Doc, colunas: ColunaTabela[], linhas: string[][]) {
  const total = colunas.reduce((s, c) => s + c.largura, 0);
  const fator = LARGURA / total;
  const larguras = colunas.map((c) => c.largura * fator);
  const alturaLinha = 15;

  const cabecalho = () => {
    let x = MARGEM;
    const y0 = doc.y; // fixo: cada text() move o cursor
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(C.suave);
    colunas.forEach((c, i) => {
      doc.text(t(c.titulo), x + 3, y0, { width: larguras[i] - 6, align: c.alinhar ?? "right", lineBreak: false });
      x += larguras[i];
    });
    const y = y0 + 11;
    doc.moveTo(MARGEM, y).lineTo(MARGEM + LARGURA, y).lineWidth(0.6).strokeColor(C.eixo).stroke();
    doc.y = y + 3;
  };

  garantirEspaco(doc, alturaLinha * 3);
  cabecalho();
  linhas.forEach((linha, li) => {
    if (doc.y + alturaLinha > doc.page.height - MARGEM - 20) {
      doc.addPage();
      cabecalho();
    }
    const y = doc.y;
    if (li % 2 === 1) doc.rect(MARGEM, y - 2, LARGURA, alturaLinha).fill(C.fundo);
    let x = MARGEM;
    doc.font("Helvetica").fontSize(8).fillColor(C.tinta);
    linha.forEach((celula, i) => {
      doc.text(t(celula), x + 3, y + 2, { width: larguras[i] - 6, align: colunas[i].alinhar ?? "right", lineBreak: false, ellipsis: true });
      x += larguras[i];
    });
    doc.y = y + alturaLinha;
  });
  doc.x = MARGEM;
}

function caixasKpi(doc: Doc, itens: [string, string, string][]) {
  const porLinha = 3;
  const vao = 8;
  const w = (LARGURA - vao * (porLinha - 1)) / porLinha;
  const h = 50;
  // Posição fixa por caixa: cada text() do pdfkit move o cursor, então não dá para depender de doc.y.
  const y0 = doc.y;
  itens.forEach(([rotulo, valor, nota], i) => {
    const col = i % porLinha;
    const x = MARGEM + col * (w + vao);
    const y = y0 + Math.floor(i / porLinha) * (h + vao);
    doc.roundedRect(x, y, w, h, 6).lineWidth(0.7).strokeColor(C.borda).stroke();
    doc.font("Helvetica").fontSize(8).fillColor(C.suave).text(t(rotulo), x + 10, y + 8, { width: w - 20, lineBreak: false });
    doc.font("Helvetica-Bold").fontSize(13).fillColor(C.tinta).text(t(valor), x + 10, y + 20, { width: w - 20, lineBreak: false });
    doc.font("Helvetica").fontSize(7.5).fillColor(C.suave).text(t(nota), x + 10, y + 37, { width: w - 20, lineBreak: false });
  });
  doc.y = y0 + Math.ceil(itens.length / porLinha) * (h + vao) + 2;
  doc.x = MARGEM;
}

export async function gerarPdf(a: Analise, nomePessoa: string): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    margin: MARGEM,
    bufferPages: true,
    info: { Title: "Análise dos lançamentos", Author: "Caderneta da Cláudia", Subject: `${nomePessoa}: ${a.de} a ${a.ate}` },
  });
  const partes: Buffer[] = [];
  doc.on("data", (p: Buffer) => partes.push(p));
  const fim = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(partes))));

  // Cabeçalho
  doc.rect(0, 0, doc.page.width, 6).fill(C.destaque);
  doc.font("Helvetica").fontSize(9).fillColor(C.suave).text("CADERNETA DA CLÁUDIA · RELATÓRIO DE ANÁLISE", MARGEM, MARGEM - 8);
  doc.font("Helvetica-Bold").fontSize(20).fillColor(C.tinta).text("Análise dos lançamentos");
  doc.font("Helvetica").fontSize(10).fillColor(C.suave).text(
    t(`${nomePessoa} · ${formatarData(a.de)} a ${formatarData(a.ate)} · ${a.resumo.quantidade} lançamentos · gerado em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`),
  );
  doc.moveDown(1);

  if (!a.resumo.quantidade) {
    doc.font("Helvetica").fontSize(11).fillColor(C.tinta).text("Nenhum lançamento neste período.");
  } else {
    const r = a.resumo;
    caixasKpi(doc, [
      ["Entradas", formatarValor(r.entradas), `média ${formatarCompacto(r.mediaMensalEntradas)}/mês`],
      ["Saídas", formatarValor(r.saidas), `média ${formatarCompacto(r.mediaMensalSaidas)}/mês`],
      ["Resultado", formatarValor(r.resultado), "entradas - saídas"],
      ["Taxa de poupança", r.taxaPoupanca === null ? "-" : formatarPercentual(r.taxaPoupanca), "resultado ÷ entradas"],
      ["Custos recorrentes", formatarPercentual(a.fixo.participacao), "das saídas"],
      ["Concentração (IHH)", Math.round(a.concentracao).toLocaleString("pt-BR"), `${a.pareto80} categorias = 80% dos gastos`],
    ]);

    tituloSecao(doc, "Principais conclusões");
    doc.font("Helvetica").fontSize(9.5).fillColor(C.tinta);
    for (const c of conclusoes(a)) {
      garantirEspaco(doc, 16);
      doc.text(t(`•  ${c}`), MARGEM, doc.y, { width: LARGURA, paragraphGap: 3 });
    }

    tituloSecao(doc, "Entradas e saídas por mês", undefined, 200);
    graficoMensal(doc, a);

    tituloSecao(doc, "Resultado de cada mês", "Entradas menos saídas. Abaixo de zero, o mês fechou no vermelho.", 140);
    graficoResultado(doc, a);

    if (a.tendencia) {
      const p = a.tendencia.previsao;
      tituloSecao(
        doc,
        "Tendência e previsão das saídas",
        `${lerTendencia(a.tendencia)}${p ? ` Previsão de Holt para ${mesCurto(p.mes)}: ${formatarValor(p.valor)} (80%: ${formatarCompacto(p.minimo)} a ${formatarCompacto(p.maximo)}).` : ""}`,
        200,
      );
      graficoTendencia(doc, a);
    }

    tituloSecao(doc, "Para onde vai o dinheiro", `Saídas por categoria. ${a.pareto80} categoria(s) somam 80% do total (Pareto).`, Math.min(13, a.saidasPorCategoria.length) * 17 + 30);
    graficoCategorias(doc, a);

    if (a.distribuicao) {
      const d = a.distribuicao;
      const mediana = d.faixas.findIndex((f) => d.mediana >= f.de && (f.ate === null || d.mediana < f.ate));
      tituloSecao(doc, "Distribuição dos valores das saídas", `Lançamentos por faixa de valor (R$). A distribuição é ${lerAssimetria(d.assimetria)}.`, 190);
      graficoColunasSimples(doc, d.faixas.map((f) => f.rotulo), d.faixas.map((f) => f.quantidade), mediana, (v) => v.toLocaleString("pt-BR"), `mediana ${formatarCompacto(d.mediana)}`);
      tabela(
        doc,
        [{ titulo: "Média", largura: 1 }, { titulo: "Mediana", largura: 1 }, { titulo: "Desvio padrão", largura: 1 }, { titulo: "CV", largura: 0.7 }, { titulo: "1º quartil", largura: 1 }, { titulo: "3º quartil", largura: 1 }, { titulo: "P90", largura: 1 }, { titulo: "Assimetria", largura: 0.8 }],
        [[formatarValor(d.media), formatarValor(d.mediana), formatarValor(d.desvio), formatarPercentual(d.cv, 0), formatarValor(d.q1), formatarValor(d.q3), formatarValor(d.p90), d.assimetria.toLocaleString("pt-BR", { maximumFractionDigits: 2 })]],
      );
    }

    const maior = a.semana.reduce((x, y) => (y.mediaPorDia > x.mediaPorDia ? y : x), a.semana[0]);
    tituloSecao(doc, "Gasto médio por dia da semana", "Total de saídas de cada dia da semana dividido por quantos desses dias o período tem.", 140);
    graficoColunasSimples(doc, a.semana.map((d) => d.nome), a.semana.map((d) => d.mediaPorDia), maior.dia, formatarCompacto, formatarCompacto(maior.mediaPorDia));

    tituloSecao(doc, "Entradas e saídas por mês (tabela)");
    tabela(
      doc,
      [{ titulo: "Mês", largura: 1, alinhar: "left" }, { titulo: "Entradas", largura: 1.3 }, { titulo: "Saídas", largura: 1.3 }, { titulo: "Resultado", largura: 1.3 }, { titulo: "Lançamentos", largura: 1 }],
      a.mensal.map((m) => [mesCurto(m.mes), formatarValor(m.entradas), formatarValor(m.saidas), formatarValor(m.resultado), String(m.quantidade)]),
    );

    tituloSecao(doc, "Estatísticas por categoria (saídas)", "CV = desvio ÷ média (quanto maior, mais imprevisível). Tendência = variação média do total mensal por mês.");
    tabela(
      doc,
      [
        { titulo: "Categoria", largura: 1.7, alinhar: "left" }, { titulo: "Lanç.", largura: 0.6 }, { titulo: "Total", largura: 1.25 }, { titulo: "%", largura: 0.6 },
        { titulo: "Média", largura: 1.05 }, { titulo: "Mediana", largura: 1.05 }, { titulo: "Desvio", largura: 1.05 }, { titulo: "CV", largura: 0.6 }, { titulo: "Tend./mês", largura: 0.85 },
      ],
      a.saidasPorCategoria.map((c) => [
        c.nome, String(c.quantidade), formatarValor(c.total), formatarPercentual(c.participacao, 0), formatarValor(c.media), formatarValor(c.mediana), formatarValor(c.desvio),
        formatarPercentual(c.cv, 0), c.tendenciaMensal === null ? "-" : `${c.tendenciaMensal > 0 ? "+" : "-"}${formatarPercentual(Math.abs(c.tendenciaMensal))}`,
      ]),
    );

    tituloSecao(doc, "Gastos atípicos", "Gastos avulsos muito acima do normal da própria categoria: escore z modificado (mediana e desvio absoluto mediano) acima de 3,5.");
    if (a.atipicos.length) {
      tabela(
        doc,
        [{ titulo: "Data", largura: 0.9, alinhar: "left" }, { titulo: "Descrição", largura: 2, alinhar: "left" }, { titulo: "Categoria", largura: 1.4, alinhar: "left" }, { titulo: "Valor", largura: 1.1 }, { titulo: "Normal", largura: 1.1 }, { titulo: "z", largura: 0.5 }],
        a.atipicos.slice(0, 25).map((l) => [formatarData(l.data), l.descricao, l.categoria, formatarValor(l.valor), formatarValor(l.medianaCategoria), l.z.toLocaleString("pt-BR", { maximumFractionDigits: 1 })]),
      );
    } else {
      doc.font("Helvetica").fontSize(9).fillColor(C.tinta).text("Nenhum gasto atípico no período.");
    }

    tituloSecao(doc, "Contas");
    tabela(
      doc,
      [{ titulo: "Conta", largura: 1.8, alinhar: "left" }, { titulo: "Entradas", largura: 1.2 }, { titulo: "Saídas", largura: 1.2 }, { titulo: "Líquido", largura: 1.2 }, { titulo: "Saldo atual", largura: 1.2 }],
      a.contas.map((c) => [c.nome, formatarValor(c.entradas), formatarValor(c.saidas), formatarValor(c.liquido), formatarValor(c.saldoAtual)]),
    );

    tituloSecao(doc, "Metodologia");
    doc.font("Helvetica").fontSize(8.5).fillColor(C.tinta);
    [
      "Quartis e percentis por interpolação linear (QUARTIL.INC). Desvio padrão amostral (n - 1). Assimetria de Fisher-Pearson ajustada.",
      "Tendência: regressão linear por mínimos quadrados sobre o total mensal; R² entre 0 e 1 mede quanto a reta explica.",
      "Previsão: suavização exponencial de Holt (nível + tendência), alfa e beta pelo menor erro um mês à frente; faixa de 80% = ±1,28 × erro médio. Com poucos meses, é indicativa.",
      "Atípicos: escore z modificado de Iglewicz e Hoaglin = 0,6745 × (valor - mediana) ÷ desvio absoluto mediano, por categoria com 5+ lançamentos avulsos (recorrentes ficam de fora, pois são previstos).",
      "Concentração: índice de Herfindahl-Hirschman (soma dos quadrados das participações em %). Abaixo de 1.500: distribuído; acima de 2.500: concentrado.",
      "Meses incompletos no início ou no fim do período entram com o que tiverem e puxam média e tendência para baixo.",
    ].forEach((linha) => {
      garantirEspaco(doc, 14);
      doc.text(t(`•  ${linha}`), MARGEM, doc.y, { width: LARGURA, paragraphGap: 2 });
    });
  }

  // Rodapé com numeração em todas as páginas.
  const paginas = doc.bufferedPageRange();
  for (let i = 0; i < paginas.count; i++) {
    doc.switchToPage(paginas.start + i);
    // O rodapé fica dentro da margem inferior; sem zerá-la, o pdfkit abriria uma página nova.
    doc.page.margins.bottom = 0;
    const y = doc.page.height - MARGEM + 10;
    doc.font("Helvetica").fontSize(7.5).fillColor(C.suave);
    doc.text(t(`Caderneta da Cláudia · ${formatarData(a.de)} a ${formatarData(a.ate)}`), MARGEM, y, { width: LARGURA / 2, lineBreak: false });
    doc.text(`Página ${i + 1} de ${paginas.count}`, MARGEM + LARGURA / 2, y, { width: LARGURA / 2, align: "right", lineBreak: false });
  }

  doc.end();
  return fim;
}
