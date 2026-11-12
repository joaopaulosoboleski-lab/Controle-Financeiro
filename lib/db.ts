import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";

// Uma única conexão compartilhada (evita abrir várias no modo dev).
const globalParaPool = globalThis as unknown as { pool?: Pool };

// Bancos remotos (Supabase) usam TLS com certificado próprio: confiamos nele, com a verificação ligada.
function opcoesSsl() {
  const url = process.env.DATABASE_URL ?? "";
  const local = /@(127\.0\.0\.1|localhost)[:/]/.test(url);
  if (local) return undefined;
  return { ca: readFileSync(join(process.cwd(), "certs", "supabase-ca.crt"), "utf8") };
}

// Tira parâmetros como ?pgbouncer=true, que o driver pg não conhece.
function urlDoBanco(): string | undefined {
  return process.env.DATABASE_URL?.replace(/\?.*$/, "");
}

export const pool =
  globalParaPool.pool ?? new Pool({ connectionString: urlDoBanco(), ssl: opcoesSsl() });

// Uma conexão ociosa que cai (o pooler do Supabase fecha as paradas) emite "error" no pool.
// Sem este ouvinte o Node derruba o processo; o pool descarta a conexão e abre outra quando precisar.
if (!globalParaPool.pool) {
  pool.on("error", (erro) => console.error("Conexão ociosa do banco caiu:", erro.message));
}

if (process.env.NODE_ENV !== "production") {
  globalParaPool.pool = pool;
}
