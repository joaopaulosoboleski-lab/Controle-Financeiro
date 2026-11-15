import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Integração: regras do banco de teste (DATABASE_URL_TEST) via Drizzle. Arquivos em série (banco compartilhado).
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: { include: ["testes/integracao/**/*.test.ts"], fileParallelism: false, hookTimeout: 30000, testTimeout: 30000 },
});
