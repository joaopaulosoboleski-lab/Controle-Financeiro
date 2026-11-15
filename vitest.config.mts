import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Testes das funções puras (validação, estatística, datas). Nada aqui acessa o banco.
// Integração (testes/integracao) e e2e (testes/e2e) têm scripts próprios: npm run test:integracao / test:e2e.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: { include: ["testes/**/*.test.ts"], exclude: ["testes/integracao/**", "testes/e2e/**", "**/node_modules/**"] },
});
