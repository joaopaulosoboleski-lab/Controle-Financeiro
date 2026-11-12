"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { conferirSenha, gerarHash } from "@/lib/senha";
import { criarSessao, encerrarSessao } from "@/lib/sessao";

// Depois de MAXIMO_FALHAS erros seguidos no mesmo e-mail, o login fica bloqueado por JANELA_MINUTOS.
const MAXIMO_FALHAS = 5;
const JANELA_MINUTOS = 15;

// Hash de uma senha aleatória: conferido quando o e-mail não existe, para a resposta demorar
// o mesmo que com e-mail cadastrado (sem isso, o tempo revela quem tem conta).
let hashFicticio: Promise<string> | undefined;

export async function entrar(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const senha = String(formData.get("senha") ?? "");

  const { rows: falhas } = await pool.query<{ quantidade: number }>(
    `SELECT COUNT(*)::int AS quantidade FROM tentativas_login
     WHERE email = $1 AND criado_em > now() - make_interval(mins => $2)`,
    [email, JANELA_MINUTOS],
  );
  if (falhas[0].quantidade >= MAXIMO_FALHAS) redirect("/login?erro=bloqueado");

  const { rows } = await pool.query<{ usuario_id: number; senha_hash: string }>(
    "SELECT usuario_id, senha_hash FROM usuarios WHERE lower(email) = $1",
    [email],
  );
  const usuario = rows[0];
  hashFicticio ??= gerarHash(randomBytes(16).toString("hex"));
  const certa = await conferirSenha(senha, usuario?.senha_hash ?? (await hashFicticio));

  if (!usuario || !certa) {
    // Aproveita para limpar tentativas antigas (a tabela não cresce sem limite).
    await pool.query(
      `WITH limpeza AS (DELETE FROM tentativas_login WHERE criado_em < now() - INTERVAL '1 day')
       INSERT INTO tentativas_login (email) VALUES ($1)`,
      [email],
    );
    redirect("/login?erro=1");
  }

  await pool.query("DELETE FROM tentativas_login WHERE email = $1", [email]);
  await criarSessao(usuario.usuario_id);
  redirect("/lancamentos");
}

export async function sair() {
  await encerrarSessao();
  redirect("/login");
}
