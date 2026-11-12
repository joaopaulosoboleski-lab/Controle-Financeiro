"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { gerarHash } from "@/lib/senha";
import { criarSessao, revogarSessoes } from "@/lib/sessao";
import {
  ERRO_EMAIL_EM_USO,
  emailEmUso,
  exigirAdmin,
  validarNomeEmail,
  validarNovaSenha,
  violouUnico,
} from "@/lib/usuarios";

export type ValoresUsuario = { nome: string; email: string; admin: boolean };
export type EstadoUsuario = { erro?: string; valores?: ValoresUsuario };

const ERRO_GERAL = "Não foi possível salvar agora. Tente novamente.";

function lerValores(formData: FormData): ValoresUsuario {
  return {
    nome: String(formData.get("nome") ?? ""),
    email: String(formData.get("email") ?? ""),
    admin: formData.get("admin") === "on",
  };
}

export async function criarUsuario(_anterior: EstadoUsuario, formData: FormData): Promise<EstadoUsuario> {
  await exigirAdmin();
  const valores = lerValores(formData);

  const limpo = validarNomeEmail(valores.nome, valores.email);
  if ("erro" in limpo) return { erro: limpo.erro, valores };
  const erroSenha = validarNovaSenha(String(formData.get("senha") ?? ""), String(formData.get("confirmacao") ?? ""));
  if (erroSenha) return { erro: erroSenha, valores };

  try {
    if (await emailEmUso(limpo.email)) return { erro: ERRO_EMAIL_EM_USO, valores };
    await pool.query("INSERT INTO usuarios (nome, email, senha_hash, admin) VALUES ($1, $2, $3, $4)", [
      limpo.nome,
      limpo.email,
      await gerarHash(String(formData.get("senha"))),
      valores.admin,
    ]);
  } catch (erro) {
    return { erro: violouUnico(erro) ? ERRO_EMAIL_EM_USO : ERRO_GERAL, valores };
  }

  revalidatePath("/usuarios");
  redirect("/usuarios");
}

export async function atualizarUsuario(_anterior: EstadoUsuario, formData: FormData): Promise<EstadoUsuario> {
  const adminId = await exigirAdmin();
  const valores = lerValores(formData);
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return { erro: "Usuário não encontrado.", valores };

  const limpo = validarNomeEmail(valores.nome, valores.email);
  if ("erro" in limpo) return { erro: limpo.erro, valores };

  // Senha é opcional na edição: em branco, fica a atual.
  const senha = String(formData.get("senha") ?? "");
  if (senha) {
    const erroSenha = validarNovaSenha(senha, String(formData.get("confirmacao") ?? ""));
    if (erroSenha) return { erro: erroSenha, valores };
  }

  // Sem isto, um admin poderia se rebaixar e deixar a Caderneta sem nenhum administrador.
  if (id === adminId && !valores.admin) {
    return { erro: "Você não pode tirar o seu próprio acesso de administrador.", valores };
  }

  try {
    if (await emailEmUso(limpo.email, id)) return { erro: ERRO_EMAIL_EM_USO, valores };
    const resultado = await pool.query(
      `UPDATE usuarios
       SET nome = $2, email = $3, admin = $4, senha_hash = COALESCE($5, senha_hash)
       WHERE usuario_id = $1`,
      [id, limpo.nome, limpo.email, valores.admin, senha ? await gerarHash(senha) : null],
    );
    if (resultado.rowCount === 0) return { erro: "Usuário não encontrado.", valores };
    // Senha trocada pelo admin: a pessoa precisa entrar de novo em todos os aparelhos.
    if (senha) {
      await revogarSessoes(id);
      if (id === adminId) await criarSessao(id); // o próprio admin continua logado aqui
    }
  } catch (erro) {
    return { erro: violouUnico(erro) ? ERRO_EMAIL_EM_USO : ERRO_GERAL, valores };
  }

  revalidatePath("/usuarios");
  revalidatePath("/perfil");
  redirect("/usuarios");
}

export async function excluirUsuario(formData: FormData): Promise<void> {
  const adminId = await exigirAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) redirect("/usuarios");
  if (id === adminId) redirect(`/usuarios/${id}/editar?erro=proprio`);

  let erro: string | undefined;
  try {
    // R9: só exclui quem não tem nenhum dado; o NOT EXISTS evita apagar se algo foi criado nesse meio-tempo.
    const resultado = await pool.query(
      `DELETE FROM usuarios u
       WHERE u.usuario_id = $1
         AND NOT EXISTS (SELECT 1 FROM contas       x WHERE x.usuario_id = u.usuario_id)
         AND NOT EXISTS (SELECT 1 FROM categorias   x WHERE x.usuario_id = u.usuario_id)
         AND NOT EXISTS (SELECT 1 FROM recorrencias x WHERE x.usuario_id = u.usuario_id)
         AND NOT EXISTS (SELECT 1 FROM lancamentos  x WHERE x.usuario_id = u.usuario_id)`,
      [id],
    );
    if (resultado.rowCount === 0) erro = "com-dados";
  } catch (e) {
    // 23503 = ainda há registros apontando para o usuário (a FK bloqueou).
    erro = (e as { code?: string })?.code === "23503" ? "com-dados" : "falha";
  }

  // redirect() lança uma exceção interna, por isso fica fora do try/catch.
  if (erro) redirect(`/usuarios/${id}/editar?erro=${erro}`);

  revalidatePath("/usuarios");
  redirect("/usuarios");
}
