// Fixtures dos testes e2e: banco de teste semeado a cada teste e sessão por cookie assinado.
import { createHmac } from "node:crypto";
import { test as base, expect, type BrowserContext, type Page } from "@playwright/test";
import { abrirBanco } from "../db/conexao";
import { limpar, semear, type Mundo, type Pessoa } from "../db/seed";

const SEGREDO = "segredo-de-teste-com-mais-de-32-caracteres-ok";

type Fixtures = {
  db: ReturnType<typeof abrirBanco>["db"];
  mundo: Mundo;
  /** Abre o navegador já logado como a pessoa (cookie assinado igual ao do app). */
  entrarComo: (pessoa: Pessoa, contexto?: BrowserContext) => Promise<Page>;
};

export const test = base.extend<Fixtures>({
  db: async ({}, usar) => {
    const { db, cliente } = abrirBanco();
    await usar(db);
    await cliente.end();
  },
  mundo: async ({ db }, usar) => {
    await limpar(db);
    const mundo = await semear(db);
    await usar(mundo);
    await limpar(db);
  },
  entrarComo: async ({ context, mundo }, usar) => {
    void mundo; // garante o seed antes do login
    await usar(async (pessoa, contexto = context) => {
      const emitido = Math.floor(Date.now() / 1000);
      const valor = `${pessoa.id}.${emitido}.0`;
      const assinatura = createHmac("sha256", SEGREDO).update(valor).digest("hex");
      await contexto.addCookies([
        { name: "sessao", value: `${valor}.${assinatura}`, url: "http://127.0.0.1:3100" },
      ]);
      return contexto.newPage();
    });
  },
});

export { expect };

/** Texto da página com espaços (inclusive NBSP do pt-BR) normalizados. */
export async function textoDaPagina(page: Page): Promise<string> {
  // app/loading.tsx mostra "Carregando..." até a página real chegar.
  await page.waitForFunction(() => !document.body.innerText.includes("Carregando..."));
  return (await page.locator("body").innerText()).replace(/\s+/g, " ");
}

/** "R$ 1.234,56" como o app formata. */
export function brl(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/\s+/g, " ");
}

/** Preenche o formulário de novo lançamento (campos pelo rótulo). */
export async function preencherLancamento(
  page: Page,
  v: { descricao: string; valor: string; tipo?: "saida" | "entrada"; data: string; contaId: number; categoriaId: number; previsto?: boolean },
) {
  await page.getByLabel("Descrição").fill(v.descricao);
  await page.getByLabel("Valor (R$)").fill(v.valor);
  await page.getByLabel("Tipo").selectOption(v.tipo ?? "saida");
  await page.getByLabel("Data", { exact: true }).fill(v.data);
  await page.getByLabel("Conta").selectOption(String(v.contaId));
  await page.getByLabel("Categoria").selectOption(String(v.categoriaId));
  if (v.previsto) await page.getByLabel(/Ainda não aconteceu/).check();
}

/** O servidor responde "não encontrado" com a página do not-found (HTTP 200 por causa do loading.tsx). */
export async function esperarNaoEncontrado(page: Page) {
  await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
}

/** Todo o texto/números das células de um .xlsx. */
export async function textoDoExcel(arquivo: Buffer): Promise<string> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(arquivo as unknown as ArrayBuffer);
  const partes: string[] = [];
  wb.eachSheet((ws) => {
    partes.push(ws.name);
    ws.eachRow((linha) =>
      linha.eachCell((cel) => {
        const v = cel.value;
        partes.push(typeof v === "object" && v !== null ? JSON.stringify(v) : String(v));
      }),
    );
  });
  return partes.join("\n");
}

/** Texto de um PDF do pdfkit: infla os streams e junta as strings hex (fontes padrão, WinAnsi). */
export async function textoDoPdf(arquivo: Buffer): Promise<string> {
  const { inflateSync } = await import("node:zlib");
  const bruto = arquivo.toString("latin1");
  const saida: string[] = [];
  const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(bruto))) {
    let conteudo: string;
    try {
      conteudo = inflateSync(Buffer.from(m[1], "latin1")).toString("latin1");
    } catch {
      continue;
    }
    // Cada linha de texto: [<hex> n <hex> ...] TJ  ou  <hex> Tj
    for (const linha of conteudo.split(/\r?\n/)) {
      if (!/T[jJ]\s*$/.test(linha)) continue;
      const hexes = [...linha.matchAll(/<([0-9a-fA-F]*)>/g)].map((x) => Buffer.from(x[1], "hex").toString("latin1"));
      if (hexes.length) saida.push(hexes.join(""));
    }
  }
  return saida.join("\n");
}

/**
 * Espera o React hidratar os formulários da página. Sem isso, mudar o DOM à mão (id oculto, opção de
 * select) pode ser desfeito pela hidratação e o teste enviaria o formulário original.
 */
export async function hidratada(page: Page) {
  await page.waitForFunction(() => {
    const forms = [...document.querySelectorAll("main form")];
    return forms.length > 0 && forms.every((f) => Object.keys(f).some((k) => k.startsWith("__reactProps")));
  });
}
