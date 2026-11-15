// Menu hambúrguer: no celular a gaveta lateral abre/fecha (botão, Esc, fundo, troca de página);
// no computador o menu fica sempre visível, sem botão. A logo mostra o nome de quem está logado.
import { expect, test, textoDaPagina } from "./base";

const PASTA_FOTOS = process.env.FOTOS_MENU; // opcional: pasta para salvar capturas de tela

test.describe("celular", () => {
  test.use({ viewport: { width: 390, height: 780 }, hasTouch: true });

  test("gaveta abre, navega, fecha e devolve o foco", async ({ entrarComo, mundo }) => {
    const page = await entrarComo(mundo.paulo);
    await page.goto("/lancamentos");
    await textoDaPagina(page);

    const botao = page.getByRole("button", { name: "Abrir menu" });
    const gaveta = page.getByRole("navigation", { name: "Menu principal" });
    await expect(page.locator(".logo-nome")).toHaveText(`Caderneta de ${mundo.paulo.nome.split(" ")[0]}`);

    // Fechada: invisível (nem o teclado chega nos links).
    await expect(botao).toHaveAttribute("aria-expanded", "false");
    await expect(gaveta).toBeHidden();

    await botao.click();
    await expect(botao).toHaveAttribute("aria-expanded", "true");
    await expect(gaveta).toBeVisible();
    await expect(page.getByRole("button", { name: "Fechar menu" })).toBeFocused();
    await expect(gaveta.getByRole("link", { name: "Lançamentos" })).toHaveAttribute("aria-current", "page");
    await expect(gaveta.getByRole("button", { name: "Sair" })).toBeVisible();
    await expect(gaveta.getByRole("link", { name: "Usuários" })).toHaveCount(0); // Paulo não é admin
    if (PASTA_FOTOS) await page.screenshot({ path: `${PASTA_FOTOS}/celular-aberto.png` });

    // Esc fecha e o foco volta para o ☰.
    await page.keyboard.press("Escape");
    await expect(gaveta).toBeHidden();
    await expect(botao).toBeFocused();

    // Tocar no fundo escuro fecha.
    await botao.click();
    await expect(gaveta).toBeVisible();
    await page.mouse.click(20, 400);
    await expect(gaveta).toBeHidden();

    // Escolher uma tela navega e fecha a gaveta.
    await botao.click();
    await gaveta.getByRole("link", { name: "Contas" }).click();
    await expect(page).toHaveURL(/\/contas$/);
    await expect(gaveta).toBeHidden();
    await expect(botao).toHaveAttribute("aria-expanded", "false");
    if (PASTA_FOTOS) await page.screenshot({ path: `${PASTA_FOTOS}/celular-fechado.png` });

    // Sem rolagem lateral com o menu fechado.
    const largura = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(largura).toBeLessThanOrEqual(390);
  });

  test("admin vê o item Usuários", async ({ entrarComo, mundo }) => {
    const page = await entrarComo(mundo.claudia);
    await page.goto("/lancamentos");
    await textoDaPagina(page);
    await page.getByRole("button", { name: "Abrir menu" }).click();
    await expect(page.getByRole("navigation", { name: "Menu principal" }).getByRole("link", { name: "Usuários" })).toBeVisible();
  });
});

test.describe("computador", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("menu sempre visível, sem botão ☰", async ({ entrarComo, mundo }) => {
    const page = await entrarComo(mundo.paulo);
    await page.goto("/dashboard");
    await textoDaPagina(page);

    const gaveta = page.getByRole("navigation", { name: "Menu principal" });
    await expect(page.getByRole("button", { name: "Abrir menu" })).toBeHidden();
    await expect(gaveta.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    await expect(gaveta.getByRole("button", { name: "Sair" })).toBeVisible();
    if (PASTA_FOTOS) await page.screenshot({ path: `${PASTA_FOTOS}/computador.png` });

    await gaveta.getByRole("link", { name: "Análise" }).click();
    await expect(page).toHaveURL(/\/analise/);
  });
});
