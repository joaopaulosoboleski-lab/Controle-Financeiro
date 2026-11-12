import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Testes das funções puras (validação, estatística, datas). Nada aqui acessa o banco.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: { include: ["testes/**/*.test.ts"] },
});
