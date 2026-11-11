"use server";

import { revalidatePath } from "next/cache";
import { pool } from "@/lib/db";
import { conferirSenha, gerarHash } from "@/lib/senha";
import { exigirUsuario } from "@/lib/sessao";
import {
  ERRO_EMAIL_EM_USO,
  emailEmUso,
  validarNomeEmail,
  validarNovaSenha,
  violouUnico,
} from "@/lib/usuarios";

export type EstadoPerfil = {
  erro?: string;
  sucesso?: string;
  valores?: { nome: string; email: string };
};

export type EstadoSenha = { erro?: string; sucesso?: string };

const ERRO_GERAL = "Não foi possível salvar agora. Tente novamente.";

export async function atualizarPerfil(
  _anterior: EstadoPerfil,
  formData: FormData,
): Promise<EstadoPerfil> {
  const usuarioId = await exigirUsuario();
  const valores = {
    nome: String(formData.get("nome") ?? ""),
    email: String(formData.get("email") ?? ""),
  };

  const limpo = validarNomeEmail(valores.nome, valores.email);
  if ("erro" in limpo) return { erro: limpo.erro, valores };
  const { nome, email } = limpo;

  try {
    if (await emailEmUso(email, usuarioId)) return { erro: ERRO_EMAIL_EM_USO, valores };
    await pool.query("UPDATE usuarios SET nome = $2, email = $3 WHERE usuario_id = $1", [
      usuarioId,
      nome,
      email,
    ]);
  } catch (erro) {
    return { erro: violouUnico(erro) ? ERRO_EMAIL_EM_USO : ERRO_GERAL, valores };
  }

  revalidatePath("/perfil");
  revalidatePath("/usuarios");
  return { sucesso: "Dados atualizados.", valores: { nome, email } };
}

export async function trocarSenha(_anterior: EstadoSenha, formData: FormData): Promise<EstadoSenha> {
  const usuarioId = await exigirUsuario();
  const atual = String(formData.get("atual") ?? "");
  const nova = String(formData.get("nova") ?? "");
  const confirmacao = String(formData.get("confirmacao") ?? "");

  if (!atual) return { erro: "Informe a senha atual." };
  const erroSenha = validarNovaSenha(nova, confirmacao);
  if (erroSenha) return { erro: erroSenha };
  if (nova === atual) return { erro: "A nova senha precisa ser diferente da atual." };

  try {
    const { rows } = await pool.query<{ senha_hash: string }>(
      "SELECT senha_hash FROM usuarios WHERE usuario_id = $1",
      [usuarioId],
    );
    if (!rows[0] || !(await conferirSenha(atual, rows[0].senha_hash))) {
      return { erro: "A senha atual está incorreta." };
    }
    await pool.query("UPDATE usuarios SET senha_hash = $2 WHERE usuario_id = $1", [
      usuarioId,
      await gerarHash(nova),
    ]);
  } catch {
    return { erro: ERRO_GERAL };
  }

  return { sucesso: "Senha alterada." };
}
