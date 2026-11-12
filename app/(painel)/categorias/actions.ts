"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { exigirUsuario } from "@/lib/sessao";
import { validarCategoria, type ValoresCategoria } from "@/lib/validacao-cadastros";

export type EstadoCategoria = { erro?: string; valores?: ValoresCategoria };

const ERRO_GERAL = "Não foi possível salvar agora. Tente novamente.";
const ERRO_NOME = "Você já tem uma categoria com esse nome.";

function lerValores(formData: FormData, edicao: boolean): ValoresCategoria {
  return {
    nome: String(formData.get("nome") ?? ""),
    tipo: String(formData.get("tipo") ?? ""),
    cor: String(formData.get("cor") ?? ""),
    // Na criação, toda categoria nasce ativa.
    ativa: edicao ? formData.get("ativa") === "on" : true,
  };
}

const nomeRepetido = (e: unknown) => (e as { code?: string })?.code === "23505";

export async function criarCategoria(_anterior: EstadoCategoria, formData: FormData): Promise<EstadoCategoria> {
  const usuarioId = await exigirUsuario();
  const valores = lerValores(formData, false);
  const r = validarCategoria(valores);
  if ("erro" in r) return { erro: r.erro, valores };
  const d = r.dados;

  try {
    await pool.query("INSERT INTO categorias (usuario_id, nome, tipo, cor_hex) VALUES ($1, $2, $3, $4)", [
      usuarioId,
      d.nome,
      d.tipo,
      d.cor,
    ]);
  } catch (e) {
    return { erro: nomeRepetido(e) ? ERRO_NOME : ERRO_GERAL, valores };
  }

  revalidatePath("/", "layout");
  redirect("/categorias");
}

export async function atualizarCategoria(_anterior: EstadoCategoria, formData: FormData): Promise<EstadoCategoria> {
  const usuarioId = await exigirUsuario();
  const valores = lerValores(formData, true);
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return { erro: "Categoria não encontrada.", valores };
  const r = validarCategoria(valores);
  if ("erro" in r) return { erro: r.erro, valores };
  const d = r.dados;

  try {
    // Trocar entrada/saída de uma categoria já usada deixaria lançamentos e recorrências
    // com o tipo diferente do da categoria: só vale enquanto ela não tem uso.
    const resultado = await pool.query(
      `UPDATE categorias c SET nome = $3, tipo = $4, cor_hex = $5, ativa = $6
       WHERE c.categoria_id = $1 AND c.usuario_id = $2
         AND (c.tipo = $4 OR (
           NOT EXISTS (SELECT 1 FROM lancamentos l WHERE l.categoria_id = c.categoria_id AND l.usuario_id = c.usuario_id)
           AND NOT EXISTS (SELECT 1 FROM recorrencias r WHERE r.categoria_id = c.categoria_id AND r.usuario_id = c.usuario_id)
         ))`,
      [id, usuarioId, d.nome, d.tipo, d.cor, d.ativa],
    );
    if (resultado.rowCount === 0) {
      const existe = await pool.query("SELECT 1 FROM categorias WHERE categoria_id = $1 AND usuario_id = $2", [id, usuarioId]);
      return {
        erro: existe.rowCount
          ? "Esta categoria já foi usada: não dá para trocar entre entrada e saída. Crie uma categoria nova."
          : "Categoria não encontrada.",
        valores,
      };
    }
  } catch (e) {
    return { erro: nomeRepetido(e) ? ERRO_NOME : ERRO_GERAL, valores };
  }

  revalidatePath("/", "layout");
  redirect("/categorias");
}

export async function excluirCategoria(formData: FormData): Promise<void> {
  const usuarioId = await exigirUsuario();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) redirect("/categorias");

  let erro: string | undefined;
  try {
    // R9: categoria usada não se apaga (arquiva-se), para não perder o histórico.
    const resultado = await pool.query(
      `DELETE FROM categorias c WHERE c.categoria_id = $1 AND c.usuario_id = $2
         AND NOT EXISTS (SELECT 1 FROM lancamentos l WHERE l.categoria_id = c.categoria_id AND l.usuario_id = c.usuario_id)
         AND NOT EXISTS (SELECT 1 FROM recorrencias r WHERE r.categoria_id = c.categoria_id AND r.usuario_id = c.usuario_id)`,
      [id, usuarioId],
    );
    if (resultado.rowCount === 0) erro = "em-uso";
  } catch (e) {
    erro = (e as { code?: string })?.code === "23503" ? "em-uso" : "falha";
  }

  if (erro) redirect(`/categorias/${id}/editar?erro=${erro}`);
  revalidatePath("/", "layout");
  redirect("/categorias");
}
