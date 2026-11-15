import { defineConfig } from "@playwright/test";
import { urlDeTeste } from "./testes/db/conexao";

// Aborta (lança erro) se DATABASE_URL_TEST estiver vazia ou for o banco de produção.
const URL_TESTE = urlDeTeste();
export const SESSION_SECRET_TESTE = "segredo-de-teste-com-mais-de-32-caracteres-ok";
const PORTA = 3100;

export default defineConfig({
  testDir: "./testes/e2e",
  // Um único banco compartilhado: um teste por vez, cada um semeia e limpa o próprio estado.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORTA}`,
    channel: "chrome", // Chrome instalado, sem baixar navegador
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
  },
  webServer: {
    // Porta 3000 costuma ter um `next dev` do usuário: o app de teste sobe em outra porta, em modo produção.
    command: `npx next build && npx next start -p ${PORTA} -H 127.0.0.1`,
    url: `http://127.0.0.1:${PORTA}/login`,
    timeout: 300_000,
    reuseExistingServer: false,
    env: {
      DATABASE_URL: URL_TESTE,
      SESSION_SECRET: SESSION_SECRET_TESTE,
      NODE_ENV: "production",
    },
  },
});
