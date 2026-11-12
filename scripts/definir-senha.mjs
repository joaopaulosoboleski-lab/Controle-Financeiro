// Uso: node --env-file=.env.local scripts/definir-senha.mjs email@exemplo.com senha
import { randomBytes, scryptSync } from "node:crypto";
import { readFileSync } from "node:fs";
import pg from "pg";

const [email, senha] = process.argv.slice(2);
if (!email || !senha) {
  console.error("Uso: node --env-file=.env.local scripts/definir-senha.mjs <email> <senha>");
  process.exit(1);
}

const sal = randomBytes(16);
const hash = `scrypt$${sal.toString("hex")}$${scryptSync(senha, sal, 64).toString("hex")}`;

const url = process.env.DATABASE_URL ?? "";
const local = /@(127\.0\.0\.1|localhost)[:/]/.test(url);
const pool = new pg.Pool({
  connectionString: url.replace(/\?.*$/, ""),
  ssl: local ? undefined : { ca: readFileSync("certs/supabase-ca.crt", "utf8") },
});
// Mesma comparação do login (minúsculas); a senha nova derruba as sessões abertas.
const { rowCount } = await pool.query(
  "UPDATE usuarios SET senha_hash = $1, sessao_versao = sessao_versao + 1 WHERE lower(email) = lower($2)",
  [hash, email.trim()],
);
console.log(rowCount ? `Senha definida para ${email}` : `Usuario nao encontrado: ${email}`);
await pool.end();
