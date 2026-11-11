"use server";

import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { conferirSenha } from "@/lib/senha";
import { criarSessao, encerrarSessao } from "@/lib/sessao";

export async function entrar(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const senha = String(formData.get("senha") ?? "");

  const { rows } = await pool.query<{ usuario_id: number; senha_hash: string }>(
    "SELECT usuario_id, senha_hash FROM usuarios WHERE lower(email) = $1",
    [email],
  );
  const usuario = rows[0];

  if (!usuario || !(await conferirSenha(senha, usuario.senha_hash))) {
    redirect("/login?erro=1");
  }

  await criarSessao(usuario.usuario_id);
  redirect("/lancamentos");
}

export async function sair() {
  await encerrarSessao();
  redirect("/login");
}
