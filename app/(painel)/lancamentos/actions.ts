"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import {
  lerValores,
  validar,
  type DadosLancamento,
  type EstadoFormulario,
} from "@/lib/formulario";
import { exigirUsuario } from "@/lib/sessao";

const ERRO_GERAL = "Não foi possível salvar agora. Tente novamente.";

// Confere que conta e categoria são do usuário e que a categoria combina com o tipo.
async function conferirDono(usuarioId: number, dados: DadosLancamento): Promise<string | null> {
  const conta = await pool.query("SELECT 1 FROM contas WHERE conta_id = $1 AND usuario_id = $2", [
    dados.contaId,
    usuarioId,
  ]);
  if (conta.rowCount === 0) return "Conta inválida.";

  const categoria = await pool.query<{ tipo: string }>(
    "SELECT tipo FROM categorias WHERE categoria_id = $1 AND usuario_id = $2",
    [dados.categoriaId, usuarioId],
  );
  if (categoria.rowCount === 0) return "Categoria inválida.";
  if (categoria.rows[0].tipo !== dados.tipo) {
    return "A categoria escolhida não é do mesmo tipo (entrada ou saída) do lançamento.";
  }
  return null;
}

export async function criarLancamento(
  _anterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const usuarioId = await exigirUsuario();
  const valores = lerValores(formData);

  const resultado = validar(valores);
  if ("erro" in resultado) return { erro: resultado.erro, valores };
  const { dados } = resultado;

  try {
    const erroDono = await conferirDono(usuarioId, dados);
    if (erroDono) return { erro: erroDono, valores };

    await pool.query(
      `INSERT INTO lancamentos
         (usuario_id, conta_id, categoria_id, tipo, valor, data_lancamento, descricao)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [usuarioId, dados.contaId, dados.categoriaId, dados.tipo, dados.valor, dados.data, dados.descricao],
    );
  } catch {
    return { erro: ERRO_GERAL, valores };
  }

  revalidatePath("/lancamentos");
  revalidatePath("/dashboard");
  // Abre a lista no mês do lançamento, para ele aparecer mesmo que não seja o mês mais recente.
  redirect(`/lancamentos?mes=${dados.data.slice(0, 7)}`);
}

export async function atualizarLancamento(
  _anterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const usuarioId = await exigirUsuario();
  const valores = lerValores(formData);
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return { erro: "Lançamento não encontrado.", valores };

  const resultado = validar(valores);
  if ("erro" in resultado) return { erro: resultado.erro, valores };
  const { dados } = resultado;

  try {
    const erroDono = await conferirDono(usuarioId, dados);
    if (erroDono) return { erro: erroDono, valores };

    const atualizado = await pool.query(
      `UPDATE lancamentos
       SET conta_id = $3, categoria_id = $4, tipo = $5, valor = $6, data_lancamento = $7, descricao = $8
       WHERE lancamento_id = $1 AND usuario_id = $2`,
      [id, usuarioId, dados.contaId, dados.categoriaId, dados.tipo, dados.valor, dados.data, dados.descricao],
    );
    if (atualizado.rowCount === 0) return { erro: "Lançamento não encontrado.", valores };
  } catch {
    return { erro: ERRO_GERAL, valores };
  }

  revalidatePath("/lancamentos");
  revalidatePath(`/lancamentos/${id}`);
  revalidatePath("/dashboard");
  redirect(`/lancamentos?mes=${dados.data.slice(0, 7)}`);
}

export async function excluirLancamento(formData: FormData): Promise<void> {
  const usuarioId = await exigirUsuario();
  const id = Number(formData.get("id"));

  let falhou = !Number.isInteger(id);
  if (!falhou) {
    try {
      await pool.query("DELETE FROM lancamentos WHERE lancamento_id = $1 AND usuario_id = $2", [
        id,
        usuarioId,
      ]);
    } catch {
      falhou = true;
    }
  }

  // redirect() lança uma exceção interna, por isso fica fora do try/catch.
  if (falhou) redirect(`/lancamentos/${id}/editar?erro=exclusao`);

  revalidatePath("/lancamentos");
  revalidatePath("/dashboard");
  redirect("/lancamentos");
}
