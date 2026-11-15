import ExcelJS from "exceljs";
import { conclusoes, mesCurto, NOMES_DIAS, type Analise } from "@/lib/analise";
import { formatarData } from "@/lib/lancamentos";

// Formatos de número do Excel (o Excel aplica a vírgula e o ponto do idioma de quem abrir).
const BRL = '"R$" #,##0.00;[Red]-"R$" #,##0.00';
const PCT = "0.0%";
const INT = "0";
const DEC = "0.00";
const DATA = "dd/mm/yyyy";

const AZUL = "FF2A78D6";
const LARANJA = "FFEB6834";
const TINTA = "FF1F2933";
const SUAVE = "FF667085";

type Coluna = { nome: string; largura: number; formato?: string; total?: "sum" | "average" | "count" };

const paraData = (d: string) => new Date(`${d}T00:00:00Z`);

// R10: dinheiro exato. As somas em JavaScript (ponto flutuante) deixam resíduos como 19436,899999;
// a célula guarda o valor já arredondado ao centavo.
function centavos(v: ExcelJS.CellValue): ExcelJS.CellValue {
  return typeof v === "number" ? Math.round(v * 100) / 100 : v;
}

// Folha com título, subtítulo e uma Tabela do Excel (filtro, faixas alternadas e totais).
function folhaComTabela(
  wb: ExcelJS.Workbook,
  aba: string,
  titulo: string,
  subtitulo: string,
  nomeTabela: string,
  colunas: Coluna[],
  linhas: ExcelJS.CellValue[][],
): ExcelJS.Worksheet {
  const ws = wb.addWorksheet(aba, { views: [{ state: "frozen", ySplit: 4 }] });
  ws.getCell("A1").value = titulo;
  ws.getCell("A1").font = { size: 14, bold: true, color: { argb: TINTA } };
  ws.getCell("A2").value = subtitulo;
  ws.getCell("A2").font = { color: { argb: SUAVE } };

  colunas.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    col.width = c.largura;
    if (c.formato) col.numFmt = c.formato;
  });

  const temTotal = colunas.some((c) => c.total);
  ws.addTable({
    name: nomeTabela,
    ref: "A4",
    headerRow: true,
    totalsRow: temTotal,
    style: { theme: "TableStyleMedium2", showRowStripes: true },
    columns: colunas.map((c, i) => ({
      name: c.nome,
      filterButton: true,
      ...(c.total ? { totalsRowFunction: c.total } : i === 0 && temTotal ? { totalsRowLabel: "Total" } : {}),
    })),
    rows: linhas.length
      ? linhas.map((linha) => linha.map((v, i) => (colunas[i]?.formato === BRL ? centavos(v) : v)))
      : [colunas.map(() => null)],
  });
  return ws;
}

// Barras de dados (como um gráfico de barras dentro da célula).
function barrasDeDados(ws: ExcelJS.Worksheet, ref: string, cor: string) {
  ws.addConditionalFormatting({
    ref,
    rules: [
      {
        type: "dataBar",
        priority: 1,
        gradient: false,
        cfvo: [{ type: "min" }, { type: "max" }],
        // A cor da barra é aceita pelo exceljs, mas não está na tipagem.
        ...({ color: { argb: cor } } as object),
      } as ExcelJS.DataBarRuleType,
    ],
  });
}

// Escala de cor de um tom só (claro = pouco, escuro = muito).
function escalaDeCor(ws: ExcelJS.Worksheet, ref: string) {
  ws.addConditionalFormatting({
    ref,
    rules: [
      {
        type: "colorScale",
        priority: 2,
        cfvo: [{ type: "min" }, { type: "percentile", value: 50 }, { type: "max" }],
        color: [{ argb: "FFF0EFEC" }, { argb: "FF6DA7EC" }, { argb: "FF184F95" }],
      },
    ],
  });
}

export async function gerarExcel(a: Analise, nomePessoa: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = `Caderneta de ${nomePessoa}`;
  wb.created = new Date();
  const periodo = `${formatarData(a.de)} a ${formatarData(a.ate)}`;
  const n = (i: number) => i + 5; // primeira linha de dados das tabelas (título, subtítulo, vazio, cabeçalho)

  // ----- Resumo (com fórmulas vivas sobre a aba Lançamentos) -----
  const resumo = wb.addWorksheet("Resumo");
  resumo.getColumn(1).width = 34;
  resumo.getColumn(2).width = 22;
  resumo.getCell("A1").value = "Análise dos lançamentos";
  resumo.getCell("A1").font = { size: 16, bold: true, color: { argb: TINTA } };
  resumo.getCell("A2").value = `${nomePessoa} · ${periodo} · gerado em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`;
  resumo.getCell("A2").font = { color: { argb: SUAVE } };

  const L = "'Lançamentos'!";
  const indicadores: [string, ExcelJS.CellValue, string][] = [
    ["Entradas", { formula: `SUMIFS(${L}$E:$E,${L}$D:$D,"Entrada")`, result: a.resumo.entradas }, BRL],
    ["Saídas", { formula: `SUMIFS(${L}$E:$E,${L}$D:$D,"Saída")`, result: a.resumo.saidas }, BRL],
    ["Resultado (entradas − saídas)", { formula: "B4-B5", result: a.resumo.resultado }, BRL],
    ["Taxa de poupança", { formula: 'IF(B4=0,"",B6/B4)', result: a.resumo.taxaPoupanca ?? "" }, PCT],
    ["Lançamentos", { formula: `COUNTIFS(${L}$D:$D,"Entrada")+COUNTIFS(${L}$D:$D,"Saída")`, result: a.resumo.quantidade }, INT],
    ["Meses no período", a.resumo.meses, INT],
    ["Média mensal de entradas", a.resumo.mediaMensalEntradas, BRL],
    ["Média mensal de saídas", a.resumo.mediaMensalSaidas, BRL],
    ["Custos recorrentes (% das saídas)", a.fixo.participacao, PCT],
    ["Categorias que somam 80% das saídas", a.pareto80, INT],
    ["Concentração (IHH, 0 a 10.000)", Math.round(a.concentracao), INT],
  ];
  if (a.tendencia) {
    indicadores.push(["Tendência das saídas (por mês)", a.tendencia.variacaoMensal, PCT]);
    indicadores.push(["R² da tendência", a.tendencia.regressao.r2, DEC]);
    if (a.tendencia.previsao) {
      const p = a.tendencia.previsao;
      indicadores.push([`Previsão de saídas para ${mesCurto(p.mes)}`, p.valor, BRL]);
      indicadores.push(["Previsão: mínimo (80%)", p.minimo, BRL]);
      indicadores.push(["Previsão: máximo (80%)", p.maximo, BRL]);
    }
  }
  indicadores.forEach(([rotulo, valor, formato], i) => {
    const linha = resumo.getRow(4 + i);
    linha.getCell(1).value = rotulo;
    // Fórmulas guardam também o resultado já calculado; ele recebe o mesmo arredondamento.
    const formula = valor as { formula?: string; result?: ExcelJS.CellValue } | null;
    linha.getCell(2).value =
      formato !== BRL
        ? valor
        : formula && typeof formula === "object" && "formula" in formula
          ? ({ formula: formula.formula, result: centavos(formula.result ?? null) } as ExcelJS.CellValue)
          : centavos(valor);
    linha.getCell(2).numFmt = formato;
    linha.getCell(2).font = { bold: true };
  });

  let r = 4 + indicadores.length + 1;
  resumo.getCell(`A${r}`).value = "Principais conclusões";
  resumo.getCell(`A${r}`).font = { size: 12, bold: true };
  for (const c of conclusoes(a)) {
    r++;
    resumo.getCell(`A${r}`).value = `• ${c}`;
    resumo.mergeCells(`A${r}:F${r}`);
    resumo.getCell(`A${r}`).alignment = { wrapText: true, vertical: "top" };
    resumo.getRow(r).height = 30;
  }
  r += 2;
  resumo.getCell(`A${r}`).value = "Os totais acima são fórmulas sobre a aba Lançamentos: se você corrigir um valor lá, eles recalculam.";
  resumo.getCell(`A${r}`).font = { italic: true, color: { argb: SUAVE } };

  // ----- Mensal -----
  const mensal = folhaComTabela(
    wb,
    "Mensal",
    "Entradas e saídas por mês",
    a.tendencia ? "Inclui a reta de tendência das saídas (mínimos quadrados) e a previsão de Holt para o mês seguinte." : periodo,
    "Mensal",
    [
      { nome: "Mês", largura: 12 },
      { nome: "Entradas", largura: 16, formato: BRL, total: "sum" },
      { nome: "Saídas", largura: 16, formato: BRL, total: "sum" },
      { nome: "Resultado", largura: 16, formato: BRL, total: "sum" },
      { nome: "Lançamentos", largura: 13, formato: INT, total: "sum" },
      { nome: "Tendência das saídas", largura: 20, formato: BRL },
    ],
    a.mensal.map((m, i) => [
      mesCurto(m.mes),
      m.entradas,
      m.saidas,
      m.resultado,
      m.quantidade,
      a.tendencia ? a.tendencia.regressao.intercepto + a.tendencia.regressao.inclinacao * i : null,
    ]),
  );
  barrasDeDados(mensal, `B${n(0)}:B${n(a.mensal.length - 1)}`, AZUL);
  barrasDeDados(mensal, `C${n(0)}:C${n(a.mensal.length - 1)}`, LARANJA);
  if (a.tendencia?.previsao) {
    const p = a.tendencia.previsao;
    const linha = n(a.mensal.length) + 2;
    mensal.getCell(`A${linha}`).value = `Previsão ${mesCurto(p.mes)}`;
    mensal.getCell(`C${linha}`).value = centavos(p.valor);
    mensal.getCell(`D${linha}`).value = `faixa de 80%: ${p.minimo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} a ${p.maximo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`;
    mensal.getCell(`A${linha}`).font = { italic: true };
  }

  // ----- Categorias -----
  const cats = folhaComTabela(
    wb,
    "Categorias",
    "Saídas por categoria",
    "Ordenado do maior para o menor total. Acumulado = curva de Pareto. CV = desvio ÷ média (volatilidade).",
    "Categorias",
    [
      { nome: "Categoria", largura: 22 },
      { nome: "Total", largura: 15, formato: BRL, total: "sum" },
      { nome: "% do total", largura: 11, formato: PCT },
      { nome: "% acumulado", largura: 12, formato: PCT },
      { nome: "Lançamentos", largura: 12, formato: INT, total: "sum" },
      { nome: "Média", largura: 13, formato: BRL },
      { nome: "Mediana", largura: 13, formato: BRL },
      { nome: "Desvio padrão", largura: 14, formato: BRL },
      { nome: "CV", largura: 9, formato: PCT },
      { nome: "Mínimo", largura: 12, formato: BRL },
      { nome: "Máximo", largura: 12, formato: BRL },
      { nome: "Tendência por mês", largura: 17, formato: PCT },
    ],
    a.saidasPorCategoria.map((c) => [
      c.nome, c.total, c.participacao, c.acumulado, c.quantidade, c.media, c.mediana, c.desvio, c.cv, c.minimo, c.maximo, c.tendenciaMensal,
    ]),
  );
  if (a.saidasPorCategoria.length) {
    barrasDeDados(cats, `B${n(0)}:B${n(a.saidasPorCategoria.length - 1)}`, LARANJA);
    escalaDeCor(cats, `I${n(0)}:I${n(a.saidasPorCategoria.length - 1)}`);
  }

  folhaComTabela(
    wb,
    "Entradas por categoria",
    "Entradas por categoria",
    periodo,
    "Entradas",
    [
      { nome: "Categoria", largura: 22 },
      { nome: "Total", largura: 15, formato: BRL, total: "sum" },
      { nome: "% do total", largura: 11, formato: PCT },
      { nome: "Lançamentos", largura: 12, formato: INT, total: "sum" },
      { nome: "Média", largura: 13, formato: BRL },
      { nome: "Mediana", largura: 13, formato: BRL },
    ],
    a.entradasPorCategoria.map((c) => [c.nome, c.total, c.participacao, c.quantidade, c.media, c.mediana]),
  );

  // ----- Distribuição -----
  if (a.distribuicao) {
    const d = a.distribuicao;
    const dist = folhaComTabela(
      wb,
      "Distribuição",
      "Distribuição dos valores das saídas",
      "Faixas em escala 1-2,5-5 (quase logarítmica), porque os valores são muito assimétricos.",
      "Distribuicao",
      [
        { nome: "Faixa (R$)", largura: 16 },
        { nome: "Lançamentos", largura: 13, formato: INT, total: "sum" },
        { nome: "% dos lançamentos", largura: 17, formato: PCT },
        { nome: "Soma", largura: 16, formato: BRL, total: "sum" },
      ],
      d.faixas.map((f) => [f.rotulo, f.quantidade, f.quantidade / d.quantidade, f.total]),
    );
    barrasDeDados(dist, `B${n(0)}:B${n(d.faixas.length - 1)}`, LARANJA);
    const inicio = n(d.faixas.length) + 3;
    dist.getCell(`A${inicio}`).value = "Estatísticas descritivas";
    dist.getCell(`A${inicio}`).font = { bold: true, size: 12 };
    const est: [string, number, string][] = [
      ["Quantidade", d.quantidade, INT],
      ["Média", d.media, BRL],
      ["Mediana", d.mediana, BRL],
      ["Desvio padrão (amostral)", d.desvio, BRL],
      ["Coeficiente de variação", d.cv, PCT],
      ["Assimetria", d.assimetria, DEC],
      ["Mínimo", d.minimo, BRL],
      ["1º quartil", d.q1, BRL],
      ["3º quartil", d.q3, BRL],
      ["Amplitude interquartil", d.q3 - d.q1, BRL],
      ["90º percentil", d.p90, BRL],
      ["Máximo", d.maximo, BRL],
    ];
    est.forEach(([rotulo, valor, formato], i) => {
      dist.getCell(`A${inicio + 1 + i}`).value = rotulo;
      const c = dist.getCell(`B${inicio + 1 + i}`);
      c.value = formato === BRL ? centavos(valor) : valor;
      c.numFmt = formato;
      c.font = { bold: true };
    });
  }

  // ----- Dia da semana -----
  const semana = folhaComTabela(
    wb,
    "Dia da semana",
    "Gasto por dia da semana",
    "Média por dia = total de saídas do dia da semana ÷ quantos desses dias o período tem.",
    "DiaSemana",
    [
      { nome: "Dia", largura: 10 },
      { nome: "Média por dia", largura: 15, formato: BRL },
      { nome: "Total", largura: 15, formato: BRL, total: "sum" },
      { nome: "Lançamentos", largura: 12, formato: INT, total: "sum" },
    ],
    a.semana.map((d) => [d.nome, d.mediaPorDia, d.total, d.quantidade]),
  );
  barrasDeDados(semana, `B${n(0)}:B${n(6)}`, LARANJA);

  // ----- Calendário (mapa de calor: semanas × dias) -----
  const cal = wb.addWorksheet("Calendário", { views: [{ state: "frozen", xSplit: 1, ySplit: 4 }] });
  cal.getCell("A1").value = "Calendário de gastos (mapa de calor)";
  cal.getCell("A1").font = { size: 14, bold: true };
  cal.getCell("A2").value = "Cada linha é uma semana; quanto mais escura a célula, mais se gastou no dia.";
  cal.getCell("A2").font = { color: { argb: SUAVE } };
  cal.getColumn(1).width = 16;
  const cabecalho = cal.getRow(4);
  cabecalho.getCell(1).value = "Semana de";
  NOMES_DIAS.forEach((nome, i) => {
    cabecalho.getCell(i + 2).value = nome;
    cal.getColumn(i + 2).width = 12;
    cal.getColumn(i + 2).numFmt = BRL;
  });
  cabecalho.font = { bold: true };
  let linhaCal = 4;
  for (const dia of a.dias) {
    if (dia.diaSemana === 0 || linhaCal === 4) {
      linhaCal++;
      const segunda = new Date(paraData(dia.data).getTime() - dia.diaSemana * 86_400_000);
      cal.getCell(linhaCal, 1).value = segunda;
      cal.getCell(linhaCal, 1).numFmt = DATA;
    }
    cal.getCell(linhaCal, dia.diaSemana + 2).value = centavos(dia.saidas);
  }
  if (linhaCal > 4) escalaDeCor(cal, `B5:H${linhaCal}`);

  // ----- Atípicos -----
  folhaComTabela(
    wb,
    "Atípicos",
    "Gastos atípicos",
    "Escore z modificado (Iglewicz & Hoaglin) acima de 3,5 dentro da própria categoria: mediana e desvio absoluto mediano. Só gastos avulsos (os recorrentes são previstos).",
    "Atipicos",
    [
      { nome: "Data", largura: 12, formato: DATA },
      { nome: "Descrição", largura: 30 },
      { nome: "Categoria", largura: 20 },
      { nome: "Conta", largura: 22 },
      { nome: "Valor", largura: 14, formato: BRL },
      { nome: "Mediana da categoria", largura: 20, formato: BRL },
      { nome: "Vezes a mediana", largura: 15, formato: DEC },
      { nome: "Escore z", largura: 10, formato: DEC },
    ],
    a.atipicos.map((l) => [paraData(l.data), l.descricao, l.categoria, l.conta, l.valor, l.medianaCategoria, l.valor / l.medianaCategoria, l.z]),
  );

  // ----- Contas -----
  folhaComTabela(
    wb,
    "Contas",
    "Movimento por conta",
    `Entradas e saídas em ${periodo}; o saldo atual considera todos os lançamentos.`,
    "Contas",
    [
      { nome: "Conta", largura: 26 },
      { nome: "Entradas", largura: 15, formato: BRL, total: "sum" },
      { nome: "Saídas", largura: 15, formato: BRL, total: "sum" },
      { nome: "Movimento líquido", largura: 18, formato: BRL, total: "sum" },
      { nome: "Saldo atual", largura: 15, formato: BRL, total: "sum" },
    ],
    a.contas.map((c) => [c.nome, c.entradas, c.saidas, c.liquido, c.saldoAtual]),
  );

  // ----- Lançamentos (dados brutos; as fórmulas do Resumo leem daqui) -----
  folhaComTabela(
    wb,
    "Lançamentos",
    "Todos os lançamentos do período",
    "Use os filtros do cabeçalho para recortar por mês, tipo, categoria ou conta.",
    "Lancamentos",
    [
      { nome: "Data", largura: 12, formato: DATA },
      { nome: "Mês", largura: 9 },
      { nome: "Descrição", largura: 32 },
      { nome: "Tipo", largura: 10 },
      { nome: "Valor", largura: 14, formato: BRL },
      { nome: "Categoria", largura: 20 },
      { nome: "Conta", largura: 22 },
      { nome: "Origem", largura: 13 },
    ],
    a.lancamentos.map((l) => [
      paraData(l.data),
      l.data.slice(0, 7),
      l.descricao,
      l.tipo === "entrada" ? "Entrada" : "Saída",
      l.valor,
      l.categoria,
      l.conta,
      l.recorrente ? "Recorrência" : "Avulso",
    ]),
  );

  // ----- Metodologia -----
  const met = wb.addWorksheet("Metodologia");
  met.getColumn(1).width = 120;
  [
    "Metodologia",
    "",
    "Quartis e percentis: interpolação linear (equivale a QUARTIL.INC / PERCENTIL.INC).",
    "Desvio padrão: amostral, n − 1 (DESVPAD.A). Assimetria: Fisher-Pearson ajustada (DISTORÇÃO).",
    "Coeficiente de variação: desvio padrão ÷ média; mede o quanto o gasto é imprevisível.",
    "Tendência: regressão linear por mínimos quadrados sobre o total mensal (INCLINAÇÃO / RQUAD).",
    "Previsão: suavização exponencial de Holt (nível + tendência), α e β pela menor soma dos erros quadráticos um mês à frente; faixa de 80% = ±1,2816 × erro médio.",
    "Gastos atípicos: escore z modificado = 0,6745 × (valor − mediana) ÷ desvio absoluto mediano, por categoria com 5+ lançamentos avulsos (os recorrentes ficam de fora, pois são previstos); atípico acima de 3,5.",
    "Concentração: índice de Herfindahl-Hirschman = soma dos quadrados das participações (em %) das categorias.",
    "Meses incompletos no início ou no fim do período entram com o que tiverem e puxam média e tendência para baixo.",
  ].forEach((texto, i) => {
    const c = met.getCell(`A${i + 1}`);
    c.value = texto;
    c.alignment = { wrapText: true };
    if (i === 0) c.font = { size: 14, bold: true };
  });

  return Buffer.from(await wb.xlsx.writeBuffer());
}
