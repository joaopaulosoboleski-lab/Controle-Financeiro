// E2E de "lançamento previsto" (CA01–CA10, edição, confirmação dupla, qualidade, recorrências).
import { sql } from "drizzle-orm";
import { diaQuinzeEmMeses, hoje, mesDe, somarDias } from "../db/datas";
import { criarLancamentoDb, lerLancamento, saldoDe } from "../db/seed";
import { lancamentos, recorrencias } from "../db/schema";
import { brl, expect, hidratada, preencherLancamento, esperarNaoEncontrado, test, textoDaPagina, textoDoExcel } from "./base";

const MES = mesDe(hoje());
const DIA_15 = `${MES}-15`;
const DIA_10 = `${MES}-10`;

async function contagem(db: Parameters<typeof lerLancamento>[0]) {
  const r = await db.select().from(lancamentos);
  return r.length;
}

test.describe("CA01 — criar previsto", () => {
  test("CA01: saída prevista de R$ 300 não muda o saldo e aparece em 'Previstos' com selo", async ({ mundo, db, entrarComo }) => {
    const c = mundo.claudia;
    const page = await entrarComo(c);
    await page.goto("/contas");
    expect(await textoDaPagina(page)).toContain(brl(1000));

    await page.goto("/lancamentos/novo");
    await expect(page.getByLabel(/Ainda não aconteceu \(previsto\)/)).toBeVisible();
    await preencherLancamento(page, { descricao: "Seguro previsto", valor: "300,00", data: DIA_15, contaId: c.contaId, categoriaId: c.catSaidaId, previsto: true });
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await page.waitForURL(/\/lancamentos\?mes=.*aviso=previsto/);

    await expect(page.getByRole("heading", { name: "Previstos (não entram no saldo)" })).toBeVisible();
    const card = page.locator("li.card", { hasText: "Seguro previsto" });
    await expect(card.locator(".selo")).toHaveText("PREVISTO");
    await expect(page.getByText("Lançamento previsto salvo")).toBeVisible();

    expect(await saldoDe(db, c.contaId)).toBe(1000);
    const [linha] = await db.select().from(lancamentos);
    expect(linha.previsto).toBe(true);
    expect(linha.valor).toBe("300.00");

    await page.goto("/contas");
    const txt = await textoDaPagina(page);
    expect(txt).toContain(brl(1000));
    expect(txt).toContain(`previsto: − ${brl(300)} (não incluído)`);

    // Sem previsto marcado, o lançamento nasce realizado e conta no saldo (controle).
    await page.goto("/lancamentos/novo");
    await preencherLancamento(page, { descricao: "Compra real", valor: "100,00", data: DIA_15, contaId: c.contaId, categoriaId: c.catSaidaId });
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await page.waitForURL(/\/lancamentos\?mes=/);
    expect(await saldoDe(db, c.contaId)).toBe(900);
  });
});

test.describe("CA02 — confirmar sem alterar", () => {
  test("CA02: saldo vai a X−300; entra no resumo, dashboard e Análise (tela, Excel)", async ({ mundo, db, entrarComo }) => {
    const c = mundo.claudia;
    await criarLancamentoDb(db, { pessoa: c, valor: "100.00", data: DIA_10, descricao: "Compra real" });
    const id = await criarLancamentoDb(db, { pessoa: c, valor: "300.00", data: DIA_15, descricao: "Passagem prevista", previsto: true, categoriaId: c.catSaida2Id });
    const page = await entrarComo(c);

    // Antes: fora de tudo.
    await page.goto(`/lancamentos?mes=${MES}`);
    expect(await textoDaPagina(page)).toContain(`Saídas ${brl(100)}`);
    expect(await textoDaPagina(page)).toContain("Previsto no mês (não incluído)");
    await page.goto("/analise");
    let txt = await textoDaPagina(page);
    expect(txt).toContain("1 lançamentos");
    expect(txt).not.toContain(c.nomeCatSaida2);
    const excelAntes = await textoDoExcel(Buffer.from(await (await page.request.get("/analise/excel")).body()));
    expect(excelAntes).not.toContain(c.nomeCatSaida2);
    expect(excelAntes).not.toContain("Passagem prevista");

    // Confirma sem alterar nada.
    await page.goto(`/lancamentos/${id}/confirmar`);
    await page.getByRole("button", { name: "Confirmar lançamento" }).click();
    await page.waitForURL(/aviso=confirmado/);
    await expect(page.getByText("Lançamento confirmado.")).toBeVisible();

    expect(await saldoDe(db, c.contaId)).toBe(600);
    const l = await lerLancamento(db, id);
    expect(l.previsto).toBe(false);
    expect(l.valor).toBe("300.00");

    // Resumo do mês, contas, dashboard.
    await page.goto(`/lancamentos?mes=${MES}`);
    txt = await textoDaPagina(page);
    expect(txt).toContain(`Saídas ${brl(400)}`);
    expect(txt).not.toContain("Previsto no mês (não incluído)");
    await expect(page.getByRole("heading", { name: /Previstos/ })).toHaveCount(0);
    await page.goto(`/dashboard?mes=${MES}`);
    txt = await textoDaPagina(page);
    expect(txt).toContain(`Saídas ${brl(400)}`);
    expect(txt).toContain(c.nomeCatSaida2);
    await page.goto("/contas");
    expect(await textoDaPagina(page)).toContain(brl(600));

    // Análise: tela, Excel e PDF (carregarAnalise).
    await page.goto("/analise");
    txt = await textoDaPagina(page);
    expect(txt).toContain("2 lançamentos");
    const excel = await textoDoExcel(Buffer.from(await (await page.request.get("/analise/excel")).body()));
    expect(excel).toContain(c.nomeCatSaida2);
    const pdf = await page.request.get("/analise/pdf");
    expect(pdf.status()).toBe(200);
    expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");
  });
});

test.describe("CA03 — confirmar ajustando", () => {
  test("CA03: valor 280, outra data e outra conta; os dois saldos ficam corretos", async ({ mundo, db, entrarComo }) => {
    const c = mundo.claudia;
    const id = await criarLancamentoDb(db, { pessoa: c, valor: "300.00", data: DIA_15, descricao: "Conta de luz", previsto: true });
    const page = await entrarComo(c);
    await page.goto(`/lancamentos/${id}/confirmar`);
    await page.getByLabel("Valor (R$)").fill("280,00");
    await page.getByLabel("Data", { exact: true }).fill(DIA_10);
    await page.getByLabel("Conta").selectOption(String(c.conta2Id));
    await page.getByRole("button", { name: "Confirmar lançamento" }).click();
    await page.waitForURL(/aviso=confirmado/);

    const l = await lerLancamento(db, id); // MESMO registro
    expect(l).toMatchObject({ previsto: false, valor: "280.00", dataLancamento: DIA_10, contaId: c.conta2Id, categoriaId: c.catSaidaId, tipo: "saida", descricao: "Conta de luz" });
    expect(await contagem(db)).toBe(1);
    expect(await saldoDe(db, c.contaId)).toBe(1000);
    expect(await saldoDe(db, c.conta2Id)).toBe(220);
    await page.goto("/contas");
    const txt = await textoDaPagina(page);
    expect(txt).toContain(brl(1000));
    expect(txt).toContain(brl(220));
  });

  test("valor-limite: '1.234,56' e 99.999.999,99 são aceitos ao confirmar", async ({ mundo, db, entrarComo }) => {
    const c = mundo.claudia;
    const a = await criarLancamentoDb(db, { pessoa: c, valor: "10.00", data: DIA_15, previsto: true });
    const b = await criarLancamentoDb(db, { pessoa: c, valor: "10.00", data: DIA_15, previsto: true });
    const page = await entrarComo(c);
    for (const [id, valor] of [[a, "1.234,56"], [b, "99.999.999,99"]] as const) {
      await page.goto(`/lancamentos/${id}/confirmar`);
      await page.getByLabel("Valor (R$)").fill(valor);
      await page.getByRole("button", { name: "Confirmar lançamento" }).click();
      await page.waitForURL(/aviso=confirmado/);
    }
    expect((await lerLancamento(db, a)).valor).toBe("1234.56");
    expect((await lerLancamento(db, b)).valor).toBe("99999999.99");
  });
});

test.describe("CA04 — confirmação inválida é recusada", () => {
  const casos: { nome: string; campo: "valor" | "data"; valor: string; erro: RegExp }[] = [
    { nome: "valor 0", campo: "valor", valor: "0", erro: /maior que zero/ },
    { nome: "valor negativo", campo: "valor", valor: "-50", erro: /maior que zero/ },
    { nome: "valor vazio", campo: "valor", valor: "", erro: /valor válido/ },
    { nome: "valor texto", campo: "valor", valor: "abc", erro: /valor válido/ },
    { nome: "valor com 3 casas", campo: "valor", valor: "10,999", erro: /valor válido/ },
    { nome: "valor acima de 99.999.999,99", campo: "valor", valor: "100.000.000,00", erro: /grande demais/ },
    { nome: "data vazia", campo: "data", valor: "", erro: /data válida/ },
    { nome: "data inexistente (30/02)", campo: "data", valor: "2026-02-30", erro: /data válida/ },
    { nome: "data antes de 1900", campo: "data", valor: "1899-12-31", erro: /data válida/ },
    { nome: "data depois de 2100", campo: "data", valor: "2101-01-01", erro: /data válida/ },
    { nome: "data em formato errado", campo: "data", valor: "31/12/2026", erro: /data válida/ },
  ];
  for (const caso of casos) {
    test(`CA04: ${caso.nome} → recusado, continua previsto`, async ({ mundo, db, entrarComo }) => {
      const c = mundo.claudia;
      const id = await criarLancamentoDb(db, { pessoa: c, valor: "300.00", data: DIA_15, previsto: true });
      const page = await entrarComo(c);
      await page.goto(`/lancamentos/${id}/confirmar`);
      // Desliga a validação do navegador para o servidor ser quem decide.
      await hidratada(page);
    await page.evaluate(
        ({ campo, valor }) => {
          const form = document.querySelector<HTMLFormElement>("form.formulario")!;
          form.noValidate = true;
          form.querySelectorAll("[required]").forEach((e) => e.removeAttribute("required"));
          const input = form.querySelector<HTMLInputElement>(`[name=${campo}]`)!;
          if (campo === "data") input.type = "text";
          input.value = valor;
        },
        { campo: caso.campo, valor: caso.valor },
      );
      await page.getByRole("button", { name: "Confirmar lançamento" }).click();
      await expect(page.locator("p[role=alert]")).toContainText(caso.erro);
      const l = await lerLancamento(db, id);
      expect(l).toMatchObject({ previsto: true, valor: "300.00", dataLancamento: DIA_15, contaId: c.contaId });
      expect(await saldoDe(db, c.contaId)).toBe(1000);
    });
  }
});

test.describe("CA05 — conta de outro usuário", () => {
  test("CA05: confirmar com a conta do Paulo → 'Conta inválida.' e nada muda", async ({ mundo, db, entrarComo }) => {
    const c = mundo.claudia;
    const id = await criarLancamentoDb(db, { pessoa: c, valor: "300.00", data: DIA_15, previsto: true });
    const page = await entrarComo(c);
    await page.goto(`/lancamentos/${id}/confirmar`);
    await hidratada(page);
    await page.evaluate((contaAlheia) => {
      const sel = document.querySelector<HTMLSelectElement>("select[name=contaId]")!;
      sel.add(new Option("alheia", String(contaAlheia)));
      sel.value = String(contaAlheia);
    }, mundo.paulo.contaId);
    await page.getByRole("button", { name: "Confirmar lançamento" }).click();
    await expect(page.locator("p[role=alert]")).toHaveText("Conta inválida.");
    expect(await lerLancamento(db, id)).toMatchObject({ previsto: true, valor: "300.00", contaId: c.contaId });
    expect(await saldoDe(db, mundo.paulo.contaId)).toBe(2000);
    expect(await saldoDe(db, c.contaId)).toBe(1000);
  });
});

test.describe("CA06 / CA09 — vencido e exclusão", () => {
  const ontem = somarDias(hoje(), -1);

  test("CA06: previsto de ontem fica fora do saldo, com selo VENCIDO, aviso no dashboard, e é confirmável", async ({ mundo, db, entrarComo }) => {
    const c = mundo.claudia;
    const id = await criarLancamentoDb(db, { pessoa: c, valor: "300.00", data: ontem, descricao: "Boleto vencido", previsto: true });
    const page = await entrarComo(c);

    expect(await saldoDe(db, c.contaId)).toBe(1000);
    await page.goto(`/lancamentos?mes=${mesDe(ontem)}`);
    const card = page.locator("li.card", { hasText: "Boleto vencido" });
    await expect(card.locator(".selo")).toHaveText("VENCIDO");
    await expect(card).toContainText("Venceu em");
    await expect(card.getByRole("link", { name: /Confirmar/ })).toBeVisible();

    await page.goto(`/dashboard?mes=${mesDe(ontem)}`);
    await expect(page.locator("p[role=alert]")).toContainText("1 lançamento(s) previsto(s) vencido(s)");
    await page.goto("/contas");
    expect(await textoDaPagina(page)).toContain(brl(1000));

    // continua confirmável
    await page.goto(`/lancamentos/${id}/confirmar`);
    await page.getByRole("button", { name: "Confirmar lançamento" }).click();
    await page.waitForURL(/aviso=confirmado/);
    expect(await saldoDe(db, c.contaId)).toBe(700);
    await page.goto(`/dashboard?mes=${mesDe(ontem)}`);
    await expect(page.getByText("previsto(s) vencido(s)")).toHaveCount(0);
  });

  for (const [nome, data] of [["CA06: vencido", ontem], ["CA09: previsto futuro", DIA_15]] as const) {
    test(`${nome} é excluível; some e saldo/totais não mudam`, async ({ mundo, db, entrarComo }) => {
      const c = mundo.claudia;
      await criarLancamentoDb(db, { pessoa: c, valor: "50.00", data: DIA_10, descricao: "Compra real" });
      const id = await criarLancamentoDb(db, { pessoa: c, valor: "300.00", data, descricao: "Para excluir", previsto: true });
      const page = await entrarComo(c);
      page.on("dialog", (d) => d.accept());
      await page.goto(`/lancamentos/${id}/editar`);
      await page.getByRole("button", { name: "Excluir lançamento" }).click();
      await page.waitForURL(/\/lancamentos$/);

      expect(await db.select().from(lancamentos).where(sql`${lancamentos.lancamentoId} = ${id}`)).toHaveLength(0);
      expect(await saldoDe(db, c.contaId)).toBe(950);
      await page.goto(`/lancamentos?mes=${mesDe(data)}`);
      const txt = await textoDaPagina(page);
      expect(txt).not.toContain("Para excluir");
      expect(txt).not.toContain("Previsto no mês");
      await page.goto(`/lancamentos/${id}`);
      await esperarNaoEncontrado(page);
    });
  }
});

test.describe("CA07 / CA10 — outro mês e mês só com previstos", () => {
  test("CA07: previsto em outro mês aparece só no mês da data; nunca nos totais reais; padrão abre o mês com realizado", async ({ mundo, db, entrarComo }) => {
    const c = mundo.claudia;
    const futuro = diaQuinzeEmMeses(hoje(), 2);
    await criarLancamentoDb(db, { pessoa: c, valor: "100.00", data: DIA_10, descricao: "Compra real" });
    await criarLancamentoDb(db, { pessoa: c, valor: "999.00", data: futuro, descricao: "Viagem futura", previsto: true });
    const page = await entrarComo(c);

    // Padrão (sem ?mes): mês mais recente com realizado, não o futuro.
    await page.goto("/lancamentos");
    await expect(page.locator(".meses strong")).toHaveText(new RegExp(`de ${MES.slice(0, 4)}$`));
    let txt = await textoDaPagina(page);
    expect(txt).toContain("Compra real");
    expect(txt).not.toContain("Viagem futura");
    expect(txt).toContain(`Saídas ${brl(100)}`);
    // O mês futuro aparece no seletor.
    await expect(page.locator(`.meses a[href="/lancamentos?mes=${mesDe(futuro)}"]`)).toBeVisible();

    await page.goto("/dashboard");
    txt = await textoDaPagina(page);
    expect(txt).toContain(`Saídas ${brl(100)}`);
    expect(txt).not.toContain("Viagem futura");
    expect(txt).not.toContain(brl(999));

    // No mês da data: aparece na seção Previstos; totais reais zero.
    await page.goto(`/lancamentos?mes=${mesDe(futuro)}`);
    await expect(page.getByRole("heading", { name: "Previstos (não entram no saldo)" })).toBeVisible();
    await expect(page.locator("li.card", { hasText: "Viagem futura" }).locator(".selo")).toBeVisible();
    txt = await textoDaPagina(page);
    expect(txt).toContain(`Entradas ${brl(0)}`);
    expect(txt).toContain(`Saídas ${brl(0)}`);
    expect(txt).toContain("Previsto no mês (não incluído)");

    expect(await saldoDe(db, c.contaId)).toBe(900);
    await page.goto("/analise");
    expect(await textoDaPagina(page)).toContain("1 lançamentos");
  });

  test("CA10: mês só com previstos → totais zero sem erro e a seção Previstos lista", async ({ mundo, db, entrarComo }) => {
    const c = mundo.claudia;
    const futuro = diaQuinzeEmMeses(hoje(), 3);
    await criarLancamentoDb(db, { pessoa: c, valor: "250.00", data: futuro, descricao: "Só previsto", previsto: true });
    await criarLancamentoDb(db, { pessoa: c, tipo: "entrada", valor: "800.00", data: futuro, descricao: "Entrada prevista", previsto: true });
    const page = await entrarComo(c);

    for (const rota of ["/lancamentos", "/dashboard", `/lancamentos?mes=${mesDe(futuro)}`, `/dashboard?mes=${mesDe(futuro)}`]) {
      const resposta = await page.goto(rota);
      expect(resposta?.status()).toBe(200);
      const txt = await textoDaPagina(page);
      expect(txt).not.toMatch(/Application error|Internal Server Error|Algo deu errado/i);
      expect(txt).toContain(`Entradas ${brl(0)}`);
      expect(txt).toContain(`Saídas ${brl(0)}`);
      expect(txt).toContain("Previsto no mês (não incluído)");
    }
    await page.goto("/lancamentos");
    await expect(page.getByRole("heading", { name: "Previstos (não entram no saldo)" })).toBeVisible();
    await expect(page.locator("li.card")).toHaveCount(2);
    await page.goto("/analise");
    expect(await textoDaPagina(page)).toContain("Ainda não há lançamentos para analisar");
    const excel = await page.request.get("/analise/excel");
    expect(excel.status()).toBeLessThan(500);
    expect(await saldoDe(db, c.contaId)).toBe(1000);
  });
});

test.describe("Edição de previsto e realizado", () => {
  test("editar um previsto o mantém previsto; a tela de editar não tem o checkbox", async ({ mundo, db, entrarComo }) => {
    const c = mundo.claudia;
    const id = await criarLancamentoDb(db, { pessoa: c, valor: "300.00", data: DIA_15, descricao: "Antes", previsto: true });
    const page = await entrarComo(c);
    await page.goto(`/lancamentos/${id}/editar`);
    await expect(page.getByLabel(/Ainda não aconteceu/)).toHaveCount(0);
    await page.getByLabel("Descrição").fill("Depois");
    await page.getByLabel("Valor (R$)").fill("310,00");
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await page.waitForURL(/\/lancamentos\?mes=/);
    expect(await lerLancamento(db, id)).toMatchObject({ previsto: true, valor: "310.00", descricao: "Depois" });
    expect(await saldoDe(db, c.contaId)).toBe(1000);
  });

  test("realizado nunca vira previsto: mandar previsto=on no editar não muda nada", async ({ mundo, db, entrarComo }) => {
    const c = mundo.claudia;
    const id = await criarLancamentoDb(db, { pessoa: c, valor: "300.00", data: DIA_15, descricao: "Real" });
    const page = await entrarComo(c);
    await page.goto(`/lancamentos/${id}/editar`);
    await expect(page.getByLabel(/Ainda não aconteceu/)).toHaveCount(0);
    await hidratada(page);
    await page.evaluate(() => {
      const form = document.querySelector<HTMLFormElement>("form.formulario")!;
      const i = document.createElement("input");
      i.type = "hidden";
      i.name = "previsto";
      i.value = "on";
      form.appendChild(i);
    });
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await page.waitForURL(/\/lancamentos\?mes=/);
    expect((await lerLancamento(db, id)).previsto).toBe(false);
    expect(await saldoDe(db, c.contaId)).toBe(700);
  });

  test("confirmar um realizado não o altera: 'já foi confirmado'", async ({ mundo, db, entrarComo }) => {
    const c = mundo.claudia;
    const id = await criarLancamentoDb(db, { pessoa: c, valor: "300.00", data: DIA_15, descricao: "Real" });
    const page = await entrarComo(c);
    await page.goto(`/lancamentos/${id}/confirmar`);
    await expect(page.locator("p[role=alert]")).toHaveText("Este lançamento já foi confirmado.");
  });

  test("confirmar duas vezes: a segunda dá 'já foi confirmado' e o saldo muda só uma vez", async ({ mundo, db, entrarComo }) => {
    const c = mundo.claudia;
    const id = await criarLancamentoDb(db, { pessoa: c, valor: "300.00", data: DIA_15, previsto: true });
    const um = await entrarComo(c);
    const dois = await um.context().newPage();
    await um.goto(`/lancamentos/${id}/confirmar`);
    await dois.goto(`/lancamentos/${id}/confirmar`);
    await um.getByRole("button", { name: "Confirmar lançamento" }).click();
    await um.waitForURL(/aviso=confirmado/);
    await dois.getByRole("button", { name: "Confirmar lançamento" }).click();
    await expect(dois.locator("p[role=alert]")).toHaveText("Este lançamento já foi confirmado.");
    expect(await saldoDe(db, c.contaId)).toBe(700);
  });
});

test.describe("Qualidade e recorrências", () => {
  test("previsto idêntico a um realizado não vira 'possível duplicado' no dashboard", async ({ mundo, db, entrarComo }) => {
    const c = mundo.claudia;
    await criarLancamentoDb(db, { pessoa: c, valor: "80.00", data: DIA_10, descricao: "Padaria" });
    await criarLancamentoDb(db, { pessoa: c, valor: "80.00", data: DIA_10, descricao: "Padaria", previsto: true });
    const page = await entrarComo(c);
    await page.goto(`/dashboard?mes=${MES}`);
    const txt = await textoDaPagina(page);
    expect(txt).not.toContain("possivel duplicado");
    expect(txt).not.toContain("Para revisar");
  });

  test("recorrência do mês: um previsto avulso não a faz parecer 'já lançada' e confirmar continua funcionando", async ({ mundo, db, entrarComo }) => {
    const c = mundo.claudia;
    await db.insert(recorrencias).values({
      usuarioId: c.id, contaId: c.contaId, categoriaId: c.catSaidaId, descricao: "Aluguel", valorPrevisto: "300.00",
      diaDoMes: 5, dataInicio: "2020-01-01",
    });
    const idPrevisto = await criarLancamentoDb(db, { pessoa: c, valor: "300.00", data: `${MES}-05`, descricao: "Aluguel", previsto: true });
    const page = await entrarComo(c);
    await page.goto(`/recorrencias/confirmar?mes=${MES}`);
    await expect(page.getByRole("heading", { name: "A confirmar (1)" })).toBeVisible();
    await page.getByRole("button", { name: "Confirmar", exact: true }).click();
    await page.waitForURL(/aviso=confirmada/);
    const todos = await db.select().from(lancamentos);
    expect(todos).toHaveLength(2);
    expect(todos.filter((l) => l.recorrenciaId !== null && !l.previsto)).toHaveLength(1);
    expect((await lerLancamento(db, idPrevisto)).previsto).toBe(true);
    expect(await saldoDe(db, c.contaId)).toBe(700);
  });
});
