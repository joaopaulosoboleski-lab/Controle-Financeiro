import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const NOME_COOKIE = "sessao";
const DURACAO_SEGUNDOS = 60 * 60 * 24 * 7;

function assinar(valor: string): string {
  const segredo = process.env.SESSION_SECRET;
  if (!segredo) throw new Error("SESSION_SECRET nao configurado");
  if (process.env.NODE_ENV === "production" && segredo.length < 32) {
    throw new Error("SESSION_SECRET precisa ter pelo menos 32 caracteres em producao");
  }
  return createHmac("sha256", segredo).update(valor).digest("hex");
}

export async function criarSessao(usuarioId: number): Promise<void> {
  const valor = String(usuarioId);
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

// Id do usuario logado, ou undefined se nao ha sessao valida.
export async function lerUsuarioId(): Promise<number | undefined> {
  const cookie = (await cookies()).get(NOME_COOKIE)?.value;
  if (!cookie) return undefined;
  const [valor, assinatura] = cookie.split(".");
  if (!valor || !assinatura) return undefined;
  const esperado = Buffer.from(assinar(valor));
  const recebido = Buffer.from(assinatura);
  if (esperado.length !== recebido.length || !timingSafeEqual(esperado, recebido)) return undefined;
  const id = Number(valor);
  return Number.isInteger(id) ? id : undefined;
}

// Usado pelas consultas: sem sessao, manda para o login.
export async function exigirUsuario(): Promise<number> {
  const id = await lerUsuarioId();
  if (id === undefined) redirect("/login");
  return id;
}
