"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import {
  lerValores,
  validar,
  validarConfirmacao,
  type DadosLancamento,
  type EstadoConfirmacao,
  type EstadoFormulario,
} from "@/lib/formulario";
import { exigirUsuario } from "@/lib/sessao";

const ERRO_GERAL = "Não foi possível salvar agora. Tente novamente.";

// Um lançamento mexe em saldo, totais, dashboard, contas e Análise ao mesmo tempo.
function revalidarTudo() {
  revalidatePath("/", "layout");
}

// Confere que conta e categoria são do usuário e que a categoria combina com o tipo.
// Categoria arquivada (R9) só vale se já for a do lançamento sendo editado.
async function conferirDono(
  usuarioId: number,
  dados: DadosLancamento,
  lancamentoId?: number,
): Promise<string | null> {
  const conta = await pool.query("SELECT 1 FROM contas WHERE conta_id = $1 AND usuario_id = $2", [
    dados.contaId,
    usuarioId,
  ]);
  if (conta.rowCount === 0) return "Conta inválida.";

  const categoria = await pool.query<{ tipo: string }>(
    `SELECT tipo FROM categorias
     WHERE categoria_id = $1 AND usuario_id = $2
       AND (ativa OR EXISTS (
         SELECT 1 FROM lancamentos
         WHERE lancamento_id = $3::int AND usuario_id = $2 AND categoria_id = $1
       ))`,
    [dados.categoriaId, usuarioId, lancamentoId ?? null],
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
  // "previsto" só existe na criação: depois, o lançamento só deixa de ser previsto ao ser confirmado.
  const previsto = formData.get("previsto") === "on";
  const valores = { ...lerValores(formData), previsto };

  const resultado = validar(valores);
  if ("erro" in resultado) return { erro: resultado.erro, valores };
  const { dados } = resultado;

  try {
    const erroDono = await conferirDono(usuarioId, dados);
    if (erroDono) return { erro: erroDono, valores };

    await pool.query(
      `INSERT INTO lancamentos
         (usuario_id, conta_id, categoria_id, tipo, valor, data_lancamento, descricao, previsto)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [usuarioId, dados.contaId, dados.categoriaId, dados.tipo, dados.valor, dados.data, dados.descricao, previsto],
    );
  } catch {
    return { erro: ERRO_GERAL, valores };
  }

  revalidarTudo();
  // Abre a lista no mês do lançamento, para ele aparecer mesmo que não seja o mês mais recente.
  redirect(`/lancamentos?mes=${dados.data.slice(0, 7)}${previsto ? "&aviso=previsto" : ""}`);
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
    const erroDono = await conferirDono(usuarioId, dados, id);
    if (erroDono) return { erro: erroDono, valores };

    // Não mexe em "previsto": editar um previsto o mantém previsto (só confirmar muda isso).
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

  revalidarTudo();
  redirect(`/lancamentos?mes=${dados.data.slice(0, 7)}`);
}

export async function excluirLancamento(formData: FormData): Promise<void> {
  const usuarioId = await exigirUsuario();
  const id = Number(formData.get("id"));

  if (!Number.isInteger(id)) redirect("/lancamentos");

  let resultado: "ok" | "nao-encontrado" | "falhou" = "ok";
  try {
    const excluido = await pool.query("DELETE FROM lancamentos WHERE lancamento_id = $1 AND usuario_id = $2", [
      id,
      usuarioId,
    ]);
    if (excluido.rowCount === 0) resultado = "nao-encontrado";
  } catch {
    resultado = "falhou";
  }

  // redirect() lança uma exceção interna, por isso fica fora do try/catch.
  if (resultado === "falhou") redirect(`/lancamentos/${id}/editar?erro=exclusao`);
  // A página do lançamento responde "não encontrado" (não existe, ou é de outra pessoa).
  if (resultado === "nao-encontrado") redirect(`/lancamentos/${id}`);

  revalidarTudo();
  redirect("/lancamentos");
}

// Confirma um previsto: o MESMO registro vira realizado e passa a contar no saldo.
// Pode ajustar valor, data e conta; tipo e categoria ficam como estavam.
export async function confirmarLancamento(
  _anterior: EstadoConfirmacao,
  formData: FormData,
): Promise<EstadoConfirmacao> {
  const usuarioId = await exigirUsuario();
  const valores = {
    valor: String(formData.get("valor") ?? ""),
    data: String(formData.get("data") ?? ""),
    contaId: String(formData.get("contaId") ?? ""),
  };
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return { erro: "Lançamento não encontrado.", valores };

  const resultado = validarConfirmacao(valores);
  if ("erro" in resultado) return { erro: resultado.erro, valores };
  const { dados } = resultado;

  try {
    // R8 no app (além da FK composta): a conta escolhida é da própria pessoa.
    const conta = await pool.query("SELECT 1 FROM contas WHERE conta_id = $1 AND usuario_id = $2", [
      dados.contaId,
      usuarioId,
    ]);
    if (conta.rowCount === 0) return { erro: "Conta inválida.", valores };

    // "AND usuario_id": registro de outra pessoa não é tocado. "AND previsto": dois cliques não confirmam duas vezes.
    const confirmado = await pool.query(
      `UPDATE lancamentos SET previsto = FALSE, valor = $3, data_lancamento = $4, conta_id = $5
       WHERE lancamento_id = $1 AND usuario_id = $2 AND previsto`,
      [id, usuarioId, dados.valor, dados.data, dados.contaId],
    );
    if (confirmado.rowCount === 0) {
      // Só diz "já confirmado" se o registro for da própria pessoa: o de outra cai em "não encontrado",
      // igual a um id que não existe (não revela que ele existe).
      const atual = await pool.query("SELECT 1 FROM lancamentos WHERE lancamento_id = $1 AND usuario_id = $2", [
        id,
        usuarioId,
      ]);
      return { erro: atual.rowCount ? "Este lançamento já foi confirmado." : "Lançamento não encontrado.", valores };
    }
  } catch {
    return { erro: "Não foi possível confirmar agora. Tente novamente.", valores };
  }

  revalidarTudo();
  redirect(`/lancamentos?mes=${dados.data.slice(0, 7)}&aviso=confirmado`);
}
