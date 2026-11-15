// CA11–CA13 (inegociável): ninguém vê nem edita lançamento (previsto ou realizado) de outra pessoa.
// Roda nas duas direções: Paulo -> Cláudia e Cláudia (admin, não-dona) -> Paulo.
import { createHmac } from "node:crypto";
import { asc } from "drizzle-orm";
import { hoje, mesDe } from "../db/datas";
import { criarLancamentoDb, SENHA_TESTE, type Pessoa } from "../db/seed";
import { lancamentos } from "../db/schema";
import { esperarNaoEncontrado, expect, hidratada, test, textoDaPagina, textoDoExcel, textoDoPdf } from "./base";

const MES = mesDe(hoje());
const DIA = `${MES}-15`;

type Direcao = { intruso: "paulo" | "claudia"; dono: "paulo" | "claudia"; rotulo: string };
const DIRECOES: Direcao[] = [
  { intruso: "paulo", dono: "claudia", rotulo: "Paulo → Cláudia" },
  { intruso: "claudia", dono: "paulo", rotulo: "Cláudia (admin, não-dona) → Paulo" },
];

// Cada pessoa tem um previsto e um realizado com marcas e valores únicos.
const MARCAS = {
  claudia: { prev: "SEGREDO-CLAUDIA-PREV", real: "SEGREDO-CLAUDIA-REAL", vPrev: "777.77", vReal: "555.55", tPrev: "777,77", tReal: "555,55" },
  paulo: { prev: "SEGREDO-PAULO-PREV", real: "SEGREDO-PAULO-REAL", vPrev: "333.33", vReal: "222.22", tPrev: "333,33", tReal: "222,22" },
} as const;

async function montar(mundo: { claudia: Pessoa; paulo: Pessoa }, db: Parameters<typeof criarLancamentoDb>[0]) {
  const ids = {} as Record<"claudia" | "paulo", { prev: number; real: number }>;
  for (const quem of ["claudia", "paulo"] as const) {
    const p = mundo[quem];
    const k = MARCAS[quem];
    ids[quem] = {
      // O previsto usa a 2ª categoria de saída, que só existe como dado do dono.
      prev: await criarLancamentoDb(db, { pessoa: p, valor: k.vPrev, data: DIA, descricao: k.prev, previsto: true, categoriaId: p.catSaida2Id }),
      real: await criarLancamentoDb(db, { pessoa: p, valor: k.vReal, data: DIA, descricao: k.real }),
    };
  }
  return ids;
}

async function fotografia(db: Parameters<typeof criarLancamentoDb>[0]) {
  return db.select().from(lancamentos).orderBy(asc(lancamentos.lancamentoId));
}

for (const d of DIRECOES) {
  test.describe(`Isolamento: ${d.rotulo}`, () => {
    test("abrir pela URL detalhe, editar e confirmar de previsto e realizado alheios → não encontrado", async ({ mundo, db, entrarComo }) => {
      const ids = await montar(mundo, db);
      const k = MARCAS[d.dono];
      const page = await entrarComo(mundo[d.intruso]);
      for (const id of [ids[d.dono].prev, ids[d.dono].real]) {
        for (const sufixo of ["", "/editar", "/confirmar"]) {
          await page.goto(`/lancamentos/${id}${sufixo}`);
          await esperarNaoEncontrado(page);
          const txt = await textoDaPagina(page);
          expect(txt).not.toContain(k.prev);
          expect(txt).not.toContain(k.real);
          expect(txt).not.toContain(k.tPrev);
          expect(txt).not.toContain(k.tReal);
          expect(txt).not.toContain("já foi confirmado");
        }
      }
    });

    test("enviar 'confirmar' trocando o id pelo alheio → 'Lançamento não encontrado.' (nunca 'já confirmado') e nada muda", async ({ mundo, db, entrarComo }) => {
      const ids = await montar(mundo, db);
      const proprio = ids[d.intruso].prev;
      const page = await entrarComo(mundo[d.intruso]);
      for (const alvo of [ids[d.dono].prev, ids[d.dono].real]) {
        const antes = await fotografia(db);
        await page.goto(`/lancamentos/${proprio}/confirmar`);
        await hidratada(page);
    await page.evaluate((id) => {
          document.querySelector<HTMLInputElement>("input[name=id]")!.value = String(id);
        }, alvo);
        await page.getByLabel("Valor (R$)").fill("1,00");
        await page.getByRole("button", { name: "Confirmar lançamento" }).click();
        await expect(page.locator("p[role=alert]")).toHaveText("Lançamento não encontrado.");
        expect(await fotografia(db)).toEqual(antes);
      }
    });

    test("enviar 'editar' trocando o id pelo alheio → 'Lançamento não encontrado.' e nada muda", async ({ mundo, db, entrarComo }) => {
      const ids = await montar(mundo, db);
      const proprio = ids[d.intruso].prev;
      const page = await entrarComo(mundo[d.intruso]);
      for (const alvo of [ids[d.dono].prev, ids[d.dono].real]) {
        const antes = await fotografia(db);
        await page.goto(`/lancamentos/${proprio}/editar`);
        await hidratada(page);
    await page.evaluate((id) => {
          document.querySelector<HTMLInputElement>("form.formulario input[name=id]")!.value = String(id);
        }, alvo);
        await page.getByLabel("Descrição").fill("INVADIDO");
        await page.getByLabel("Valor (R$)").fill("1,00");
        await page.getByRole("button", { name: "Salvar alterações" }).click();
        await expect(page.locator("p[role=alert]")).toHaveText("Lançamento não encontrado.");
        expect(await fotografia(db)).toEqual(antes);
      }
    });

    test("enviar 'excluir' trocando o id pelo alheio → não encontrado e o registro continua no banco", async ({ mundo, db, entrarComo }) => {
      const ids = await montar(mundo, db);
      const proprio = ids[d.intruso].prev;
      const page = await entrarComo(mundo[d.intruso]);
      page.on("dialog", (x) => x.accept());
      for (const alvo of [ids[d.dono].prev, ids[d.dono].real]) {
        const antes = await fotografia(db);
        await page.goto(`/lancamentos/${proprio}/editar`);
        await hidratada(page);
    await page.evaluate((id) => {
          const botao = [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("Excluir lançamento"))!;
          botao.closest("form")!.querySelector<HTMLInputElement>("input[name=id]")!.value = String(id);
        }, alvo);
        await page.getByRole("button", { name: "Excluir lançamento" }).click();
        await page.waitForURL(new RegExp(`/lancamentos/${alvo}$`));
        await esperarNaoEncontrado(page);
        expect(await fotografia(db)).toEqual(antes);
      }
    });

    test("não cria previsto (nem realizado) com conta ou categoria alheias", async ({ mundo, db, entrarComo }) => {
      await montar(mundo, db);
      const eu = mundo[d.intruso];
      const alheio = mundo[d.dono];
      const page = await entrarComo(eu);
      const antes = await fotografia(db);

      for (const previsto of [true, false]) {
        for (const [campo, valorAlheio, erro] of [
          ["contaId", alheio.contaId, "Conta inválida."],
          ["categoriaId", alheio.catSaidaId, "Categoria inválida."],
        ] as const) {
          await page.goto("/lancamentos/novo");
          await page.getByLabel("Descrição").fill("Tentativa");
          await page.getByLabel("Valor (R$)").fill("10,00");
          await page.getByLabel("Data", { exact: true }).fill(DIA);
          await page.getByLabel("Conta").selectOption(String(eu.contaId));
          await page.getByLabel("Categoria").selectOption(String(eu.catSaidaId));
          if (previsto) await page.getByLabel(/Ainda não aconteceu/).check();
          await hidratada(page);
    await page.evaluate(([nome, id]) => {
            const sel = document.querySelector<HTMLSelectElement>(`select[name=${nome}]`)!;
            sel.add(new Option("alheio", String(id)));
            sel.value = String(id);
          }, [campo, valorAlheio] as const);
          await page.getByRole("button", { name: "Salvar", exact: true }).click();
          await expect(page.locator("p[role=alert]")).toHaveText(erro);
          expect(await fotografia(db)).toEqual(antes);
        }
      }
    });

    test("listas, dashboard, contas, análise, Excel e PDF não contêm dado do dono", async ({ mundo, db, entrarComo }) => {
      await montar(mundo, db);
      const k = MARCAS[d.dono];
      const meu = MARCAS[d.intruso];
      const eu = mundo[d.intruso];
      const dono = mundo[d.dono];
      const proibidos = [k.prev, k.real, k.tPrev, k.tReal, dono.nomeCatSaida2, `Mercado ${dono.nome.split(" ")[0]}`, dono.nome];
      const page = await entrarComo(eu);

      const rotas = [
        `/lancamentos?mes=${MES}`, "/lancamentos", `/dashboard?mes=${MES}`, "/dashboard", "/contas", "/categorias",
        "/analise", "/recorrencias/confirmar?mes=" + MES, `/lancamentos/${(await fotografia(db))[0].lancamentoId}`,
      ];
      for (const rota of rotas) {
        await page.goto(rota);
        const txt = await textoDaPagina(page);
        for (const p of proibidos) expect(txt, `${rota} vazou "${p}"`).not.toContain(p);
      }

      // O que é meu aparece e os totais são só meus (previsto e realizado separados).
      await page.goto(`/lancamentos?mes=${MES}`);
      let txt = await textoDaPagina(page);
      expect(txt).toContain(meu.real);
      expect(txt).toContain(meu.prev);
      expect(txt).toContain(`Saídas R$ ${meu.tReal}`);
      expect(txt).toContain(`R$ ${meu.tPrev}`);
      await page.goto(`/dashboard?mes=${MES}`);
      txt = await textoDaPagina(page);
      expect(txt).toContain(`Saídas R$ ${meu.tReal}`);
      expect(txt).toContain(`− R$ ${meu.tPrev}`);
      expect(txt).toContain(`Mercado ${d.intruso === "paulo" ? "Paulo" : "Claudia"}`);
      await page.goto("/analise");
      expect(await textoDaPagina(page)).toContain("1 lançamentos");

      const excel = await page.request.get("/analise/excel");
      expect(excel.status()).toBe(200);
      const planilha = await textoDoExcel(Buffer.from(await excel.body()));
      for (const p of proibidos) expect(planilha, `excel vazou "${p}"`).not.toContain(p);
      expect(planilha).toContain(`Mercado ${d.intruso === "paulo" ? "Paulo" : "Claudia"}`);

      const pdf = await page.request.get("/analise/pdf");
      expect(pdf.status()).toBe(200);
      const corpoPdf = Buffer.from(await pdf.body());
      expect(corpoPdf.subarray(0, 4).toString()).toBe("%PDF");
      const textoPdf = await textoDoPdf(corpoPdf);
      expect(textoPdf.length, "não conseguiu extrair texto do PDF").toBeGreaterThan(50);
      for (const p of proibidos) expect(textoPdf, `pdf vazou "${p}"`).not.toContain(p);
    });
  });
}

test.describe("Acesso sem login", () => {
  test("rotas protegidas mandam para /login (corpo com NEXT_REDIRECT; HTTP 200 pelo loading.tsx)", async ({ request }) => {
    for (const rota of ["/lancamentos", "/lancamentos/novo", "/lancamentos/1", "/lancamentos/1/editar", "/lancamentos/1/confirmar", "/dashboard", "/contas", "/analise"]) {
      const r = await request.get(rota);
      expect(await r.text(), rota).toContain("NEXT_REDIRECT;replace;/login");
    }
  });

  test("Excel e PDF sem login não entregam planilha/PDF", async ({ request }) => {
    for (const rota of ["/analise/excel", "/analise/pdf"]) {
      const r = await request.get(rota, { maxRedirects: 0 });
      const corpo = (await r.body()).subarray(0, 4).toString();
      expect(corpo, rota).not.toBe("%PDF");
      expect(corpo, rota).not.toBe("PK\u0003\u0004");
      expect(r.headers()["location"] ?? (await r.text()), rota).toContain("/login");
    }
  });

  test("navegador sem sessão cai em /login ao abrir a confirmação", async ({ page }) => {
    await page.goto("/lancamentos/1/confirmar");
    await page.waitForURL(/\/login/);
  });

  test("cookie com assinatura adulterada é recusado", async ({ mundo, context, page }) => {
    const emitido = Math.floor(Date.now() / 1000);
    const valor = `${mundo.claudia.id}.${emitido}.0`;
    const falsa = createHmac("sha256", "outro-segredo").update(valor).digest("hex");
    await context.addCookies([{ name: "sessao", value: `${valor}.${falsa}`, url: "http://127.0.0.1:3100" }]);
    await page.goto("/lancamentos");
    await page.waitForURL(/\/login/);
  });

  test("login real pela tela (hash scrypt do seed) leva a /lancamentos", async ({ mundo, page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(mundo.paulo.email);
    await page.getByLabel("Senha").fill(SENHA_TESTE);
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForURL(/\/lancamentos/);
  });
});
