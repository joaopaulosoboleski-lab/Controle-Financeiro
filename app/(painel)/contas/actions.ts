"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { exigirUsuario } from "@/lib/sessao";
import { validarConta, type ValoresConta } from "@/lib/validacao-cadastros";

export type EstadoConta = { erro?: string; valores?: ValoresConta };

const ERRO_GERAL = "Não foi possível salvar agora. Tente novamente.";
const ERRO_NOME = "Você já tem uma conta com esse nome.";

function lerValores(formData: FormData): ValoresConta {
  return {
    nome: String(formData.get("nome") ?? ""),
    tipo: String(formData.get("tipo") ?? ""),
    saldoInicial: String(formData.get("saldoInicial") ?? ""),
    dataAbertura: String(formData.get("dataAbertura") ?? ""),
  };
}

// 23505 = UNIQUE (usuario_id, nome).
const nomeRepetido = (e: unknown) => (e as { code?: string })?.code === "23505";

// Saldos e nomes de conta aparecem em várias telas.
function revalidarTudo() {
  revalidatePath("/", "layout");
}

export async function criarConta(_anterior: EstadoConta, formData: FormData): Promise<EstadoConta> {
  const usuarioId = await exigirUsuario();
  const valores = lerValores(formData);
  const r = validarConta(valores);
  if ("erro" in r) return { erro: r.erro, valores };
  const d = r.dados;

  try {
    await pool.query(
      "INSERT INTO contas (usuario_id, nome, tipo, saldo_inicial, data_abertura) VALUES ($1, $2, $3, $4, $5)",
      [usuarioId, d.nome, d.tipo, d.saldoInicial, d.dataAbertura],
    );
  } catch (e) {
    return { erro: nomeRepetido(e) ? ERRO_NOME : ERRO_GERAL, valores };
  }

  revalidarTudo();
  redirect("/contas");
}

export async function atualizarConta(_anterior: EstadoConta, formData: FormData): Promise<EstadoConta> {
  const usuarioId = await exigirUsuario();
  const valores = lerValores(formData);
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return { erro: "Conta não encontrada.", valores };
  const r = validarConta(valores);
  if ("erro" in r) return { erro: r.erro, valores };
  const d = r.dados;

  try {
    const resultado = await pool.query(
      `UPDATE contas SET nome = $3, tipo = $4, saldo_inicial = $5, data_abertura = $6
       WHERE conta_id = $1 AND usuario_id = $2`,
      [id, usuarioId, d.nome, d.tipo, d.saldoInicial, d.dataAbertura],
    );
    if (resultado.rowCount === 0) return { erro: "Conta não encontrada.", valores };
  } catch (e) {
    return { erro: nomeRepetido(e) ? ERRO_NOME : ERRO_GERAL, valores };
  }

  revalidarTudo();
  redirect("/contas");
}

export async function excluirConta(formData: FormData): Promise<void> {
  const usuarioId = await exigirUsuario();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) redirect("/contas");

  let erro: string | undefined;
  try {
    // R9: conta com lançamentos ou recorrências não sai (o histórico depende dela).
    const resultado = await pool.query(
      `DELETE FROM contas c WHERE c.conta_id = $1 AND c.usuario_id = $2
         AND NOT EXISTS (SELECT 1 FROM lancamentos l WHERE l.conta_id = c.conta_id AND l.usuario_id = c.usuario_id)
         AND NOT EXISTS (SELECT 1 FROM recorrencias r WHERE r.conta_id = c.conta_id AND r.usuario_id = c.usuario_id)`,
      [id, usuarioId],
    );
    if (resultado.rowCount === 0) erro = "em-uso";
  } catch (e) {
    erro = (e as { code?: string })?.code === "23503" ? "em-uso" : "falha";
  }

  // redirect() lança uma exceção interna, por isso fica fora do try/catch.
  if (erro) redirect(`/contas/${id}/editar?erro=${erro}`);
  revalidarTudo();
  redirect("/contas");
}
