import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { pool } from "@/lib/db";

const NOME_COOKIE = "sessao";
const DURACAO_SEGUNDOS = 60 * 60 * 24 * 7;

// Cookie: <usuario_id>.<emitido em, segundos>.<sessao_versao>.<HMAC dos três>
// - "emitido em" faz a sessão expirar no servidor, não só no navegador;
// - "sessao_versao" é conferida no banco: somar 1 nela derruba as sessões abertas.

function assinar(valor: string): string {
  const segredo = process.env.SESSION_SECRET;
  if (!segredo) throw new Error("SESSION_SECRET nao configurado");
  if (process.env.NODE_ENV === "production" && segredo.length < 32) {
    throw new Error("SESSION_SECRET precisa ter pelo menos 32 caracteres em producao");
  }
  return createHmac("sha256", segredo).update(valor).digest("hex");
}

function agora(): number {
  return Math.floor(Date.now() / 1000);
}

export async function criarSessao(usuarioId: number): Promise<void> {
  const { rows } = await pool.query<{ sessao_versao: number }>(
    "SELECT sessao_versao FROM usuarios WHERE usuario_id = $1",
    [usuarioId],
  );
  const valor = `${usuarioId}.${agora()}.${rows[0]?.sessao_versao ?? 0}`;
  (await cookies()).set(NOME_COOKIE, `${valor}.${assinar(valor)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DURACAO_SEGUNDOS,
  });
}

export async function encerrarSessao(): Promise<void> {
  (await cookies()).delete(NOME_COOKIE);
}

// Derruba todas as sessões da pessoa (em todos os aparelhos).
export async function revogarSessoes(usuarioId: number): Promise<void> {
  await pool.query("UPDATE usuarios SET sessao_versao = sessao_versao + 1 WHERE usuario_id = $1", [usuarioId]);
}

// Id do usuario logado, ou undefined se nao ha sessao valida.
// cache(): as funções de lib/ chamam isto várias vezes por pedido; o banco é consultado uma vez só.
export const lerUsuarioId = cache(async (): Promise<number | undefined> => {
  const cookie = (await cookies()).get(NOME_COOKIE)?.value;
  if (!cookie) return undefined;
  const partes = cookie.split(".");
  if (partes.length !== 4) return undefined;
  const [idTexto, emitidoTexto, versaoTexto, assinatura] = partes;

  const esperado = Buffer.from(assinar(`${idTexto}.${emitidoTexto}.${versaoTexto}`));
  const recebido = Buffer.from(assinatura);
  if (esperado.length !== recebido.length || !timingSafeEqual(esperado, recebido)) return undefined;

  const id = Number(idTexto);
  const emitido = Number(emitidoTexto);
  const versao = Number(versaoTexto);
  if (!Number.isInteger(id) || !Number.isInteger(emitido) || !Number.isInteger(versao)) return undefined;
  if (agora() - emitido > DURACAO_SEGUNDOS) return undefined;

  // Também recusa sessão de usuário excluído.
  const { rows } = await pool.query<{ sessao_versao: number }>(
    "SELECT sessao_versao FROM usuarios WHERE usuario_id = $1",
    [id],
  );
  return rows[0]?.sessao_versao === versao ? id : undefined;
});

// Usado pelas consultas: sem sessao, manda para o login.
export async function exigirUsuario(): Promise<number> {
  const id = await lerUsuarioId();
  if (id === undefined) redirect("/login");
  return id;
}
