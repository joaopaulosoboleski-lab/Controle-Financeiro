// Cria (do zero) o banco de teste a partir dos .sql da raiz. NUNCA toca em DATABASE_URL.
// Uso: DATABASE_URL_TEST=postgresql://postgres@127.0.0.1:5434/caderneta_teste node testes/db/criar-banco.mjs
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

const url = process.env.DATABASE_URL_TEST;
if (!url) throw new Error("ABORTADO: DATABASE_URL_TEST vazia.");
const alvo = new URL(url);
const nome = alvo.pathname.slice(1);
if (!["127.0.0.1", "localhost"].includes(alvo.hostname) || !/test/i.test(nome)) {
  throw new Error("ABORTADO: o banco de teste precisa ser local e ter 'teste' no nome.");
}
const norm = (u) => {
  const x = new URL(u.replace(/\?.*$/, ""));
  return `${x.hostname}:${x.port}${x.pathname}`;
};
// Só compara com o DATABASE_URL para recusar produção; nunca conecta nele.
const proibidas = [process.env.DATABASE_URL];
if (existsSync(".env.local")) {
  const m = readFileSync(".env.local", "utf8").match(/^\s*DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m);
  if (m) proibidas.push(m[1]);
}
for (const p of proibidas.filter(Boolean)) {
  if (norm(p) === norm(url)) throw new Error("ABORTADO: igual ao DATABASE_URL (produção).");
}

const admin = postgres(new URL("/postgres", url).toString(), { max: 1, onnotice: () => {} });
await admin.unsafe(`DROP DATABASE IF EXISTS "${nome}" WITH (FORCE)`);
await admin.unsafe(`CREATE DATABASE "${nome}"`);
await admin.end();

const db = postgres(url, { max: 1, onnotice: () => {} });
for (const arq of ["schema.sql", "qualidade.sql", "admin.sql", "seguranca.sql", "previstos.sql"]) {
  await db.file(join(process.cwd(), arq));
  console.log("aplicado:", arq);
}
await db.end();
console.log(`Banco ${nome} pronto.`);
