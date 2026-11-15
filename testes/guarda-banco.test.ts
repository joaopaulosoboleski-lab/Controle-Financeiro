// A trava que impede os testes de tocarem o banco de produção (testes/db/conexao.ts). Não conecta em nada.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { urlDeTeste } from "./db/conexao";

const TESTE = "postgresql://postgres@127.0.0.1:5434/caderneta_teste";

afterEach(() => vi.unstubAllEnvs());

describe("urlDeTeste (trava contra produção)", () => {
  it("aborta com DATABASE_URL_TEST vazia", () => {
    vi.stubEnv("DATABASE_URL_TEST", "");
    expect(() => urlDeTeste()).toThrow(/vazia/);
  });

  it("aborta se for igual ao DATABASE_URL", () => {
    vi.stubEnv("DATABASE_URL", TESTE);
    vi.stubEnv("DATABASE_URL_TEST", TESTE);
    expect(() => urlDeTeste()).toThrow(/mesmo banco/);
  });

  it("aborta se apontar para o mesmo host e banco do DATABASE_URL (mesmo com parâmetros ou usuário diferentes)", () => {
    vi.stubEnv("DATABASE_URL", "postgresql://outro:segredo@127.0.0.1:5434/caderneta_teste?pgbouncer=true");
    vi.stubEnv("DATABASE_URL_TEST", TESTE);
    expect(() => urlDeTeste()).toThrow(/mesmo banco/);
  });

  it("aborta se for igual ao DATABASE_URL do .env.local (comparação de texto; não conecta)", () => {
    const arquivo = join(process.cwd(), ".env.local");
    if (!existsSync(arquivo)) return;
    const m = readFileSync(arquivo, "utf8").match(/^\s*DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m);
    if (!m) return;
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("DATABASE_URL_TEST", m[1]);
    expect(() => urlDeTeste()).toThrow(/ABORTADO/);
  });

  it("aborta para banco remoto ou sem 'test' no nome", () => {
    vi.stubEnv("DATABASE_URL_TEST", "postgresql://postgres@db.exemplo.com:5432/caderneta_teste");
    expect(() => urlDeTeste()).toThrow(/local/);
    vi.stubEnv("DATABASE_URL_TEST", "postgresql://postgres@127.0.0.1:5434/caderneta");
    expect(() => urlDeTeste()).toThrow(/teste/);
  });

  it("aceita o banco de teste local", () => {
    vi.stubEnv("DATABASE_URL", "postgresql://u:p@aws-0.pooler.supabase.com:6543/postgres");
    vi.stubEnv("DATABASE_URL_TEST", TESTE);
    expect(urlDeTeste()).toBe(TESTE);
  });
});
