// Conexão do banco de TESTE (Drizzle + driver "postgres"). Só testes e seeds usam isto.
// Aborta se a URL de teste estiver vazia ou puder ser o banco de produção.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Só COMPARA com o DATABASE_URL (do ambiente ou do .env.local) para recusar produção.
// Nunca conecta nele e nunca usa o .env.local como fonte da URL de teste.
function urlsProibidas(): string[] {
  const urls: string[] = [];
  if (process.env.DATABASE_URL) urls.push(process.env.DATABASE_URL);
  const arquivo = join(process.cwd(), ".env.local");
  if (existsSync(arquivo)) {
    const m = readFileSync(arquivo, "utf8").match(/^\s*DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m);
    if (m) urls.push(m[1]);
  }
  return urls;
}

function hostEBanco(url: string): string {
  const u = new URL(url.replace(/\?.*$/, ""));
  return `${u.hostname}:${u.port || "5432"}${u.pathname}`.toLowerCase();
}

export function urlDeTeste(): string {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) throw new Error("ABORTADO: DATABASE_URL_TEST está vazia. Aponte para um banco de teste separado.");
  const alvo = hostEBanco(url);
  for (const proibida of urlsProibidas()) {
    if (url === proibida || alvo === hostEBanco(proibida)) {
      throw new Error("ABORTADO: DATABASE_URL_TEST aponta para o mesmo banco do DATABASE_URL (produção).");
    }
  }
  const u = new URL(url.replace(/\?.*$/, ""));
  if (!["127.0.0.1", "localhost"].includes(u.hostname)) {
    throw new Error("ABORTADO: o banco de teste precisa ser local (127.0.0.1/localhost).");
  }
  if (!/test/i.test(u.pathname)) {
    throw new Error("ABORTADO: o nome do banco de teste precisa conter 'teste'/'test'.");
  }
  return url;
}

export function abrirBanco() {
  const cliente = postgres(urlDeTeste(), { max: 4, onnotice: () => {} });
  return { cliente, db: drizzle(cliente, { schema }) };
}
