"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { dataValida, lerDinheiro } from "@/lib/formulario";
import { exigirUsuario } from "@/lib/sessao";
import { mesValido, validarRecorrencia, type DadosRecorrencia, type ValoresRecorrencia } from "@/lib/validacao-cadastros";

export type EstadoRecorrencia = { erro?: string; valores?: ValoresRecorrencia };

const ERRO_GERAL = "Não foi possível salvar agora. Tente novamente.";

function lerValores(formData: FormData): ValoresRecorrencia {
  const campo = (n: string) => String(formData.get(n) ?? "");
  return {
    descricao: campo("descricao"),
    valor: campo("valor"),
    dia: campo("dia"),
    contaId: campo("contaId"),
    categoriaId: campo("categoriaId"),
    dataInicio: campo("dataInicio"),
    dataFim: campo("dataFim"),
  };
}

// R8 no app (além da FK composta): conta e categoria são do usuário. Categoria arquivada
// só vale se já for a da recorrência sendo editada.
async function conferirDono(usuarioId: number, d: DadosRecorrencia, recorrenciaId?: number): Promise<string | null> {
  const conta = await pool.query("SELECT 1 FROM contas WHERE conta_id = $1 AND usuario_id = $2", [d.contaId, usuarioId]);
  if (conta.rowCount === 0) return "Conta inválida.";
  const categoria = await pool.query(
    `SELECT 1 FROM categorias WHERE categoria_id = $1 AND usuario_id = $2
       AND (ativa OR EXISTS (
         SELECT 1 FROM recorrencias WHERE recorrencia_id = $3::int AND usuario_id = $2 AND categoria_id = $1
       ))`,
    [d.categoriaId, usuarioId, recorrenciaId ?? null],
  );
  if (categoria.rowCount === 0) return "Categoria inválida.";
  return null;
}

export async function criarRecorrencia(_anterior: EstadoRecorrencia, formData: FormData): Promise<EstadoRecorrencia> {
  const usuarioId = await exigirUsuario();
  const valores = lerValores(formData);
  const r = validarRecorrencia(valores);
  if ("erro" in r) return { erro: r.erro, valores };
  const d = r.dados;

  try {
    const erroDono = await conferirDono(usuarioId, d);
    if (erroDono) return { erro: erroDono, valores };
    await pool.query(
      `INSERT INTO recorrencias (usuario_id, conta_id, categoria_id, descricao, valor_previsto, dia_do_mes, data_inicio, data_fim)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [usuarioId, d.contaId, d.categoriaId, d.descricao, d.valor, d.dia, d.dataInicio, d.dataFim],
    );
  } catch {
    return { erro: ERRO_GERAL, valores };
  }

  revalidatePath("/", "layout");
  redirect("/recorrencias");
}

export async function atualizarRecorrencia(_anterior: EstadoRecorrencia, formData: FormData): Promise<EstadoRecorrencia> {
  const usuarioId = await exigirUsuario();
  const valores = lerValores(formData);
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return { erro: "Recorrência não encontrada.", valores };
  const r = validarRecorrencia(valores);
  if ("erro" in r) return { erro: r.erro, valores };
  const d = r.dados;

  try {
    const erroDono = await conferirDono(usuarioId, d, id);
    if (erroDono) return { erro: erroDono, valores };
    // Os lançamentos já confirmados não mudam: guardam o valor e a data reais (R7).
    const resultado = await pool.query(
      `UPDATE recorrencias
       SET conta_id = $3, categoria_id = $4, descricao = $5, valor_previsto = $6, dia_do_mes = $7, data_inicio = $8, data_fim = $9
       WHERE recorrencia_id = $1 AND usuario_id = $2`,
      [id, usuarioId, d.contaId, d.categoriaId, d.descricao, d.valor, d.dia, d.dataInicio, d.dataFim],
    );
    if (resultado.rowCount === 0) return { erro: "Recorrência não encontrada.", valores };
  } catch {
    return { erro: ERRO_GERAL, valores };
  }

  revalidatePath("/", "layout");
  redirect("/recorrencias");
}

export async function excluirRecorrencia(formData: FormData): Promise<void> {
  const usuarioId = await exigirUsuario();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) redirect("/recorrencias");

  let erro: string | undefined;
  try {
    // R7: se já gerou lançamentos, apagar tiraria a origem deles. Nesse caso, encerra-se com data de fim.
    const resultado = await pool.query(
      `DELETE FROM recorrencias r WHERE r.recorrencia_id = $1 AND r.usuario_id = $2
         AND NOT EXISTS (SELECT 1 FROM lancamentos l WHERE l.recorrencia_id = r.recorrencia_id)`,
      [id, usuarioId],
    );
    if (resultado.rowCount === 0) erro = "em-uso";
  } catch (e) {
    erro = (e as { code?: string })?.code === "23503" ? "em-uso" : "falha";
  }

  if (erro) redirect(`/recorrencias/${id}/editar?erro=${erro}`);
  revalidatePath("/", "layout");
  redirect("/recorrencias");
}

// ---------- Confirmação do mês (R6: o sistema não lança sozinho; R7: guarda a origem) ----------

// Insere o lançamento da recorrência no mês, só se ela for da pessoa, estiver vigente no mês
// e ainda não tiver lançamento nele.
// O tipo vem da categoria, e a descrição, da recorrência.
const INSERIR_DA_RECORRENCIA = `
  INSERT INTO lancamentos (usuario_id, conta_id, categoria_id, recorrencia_id, tipo, valor, data_lancamento, descricao)
  SELECT r.usuario_id, r.conta_id, r.categoria_id, r.recorrencia_id, cat.tipo,
         COALESCE($4::numeric, r.valor_previsto),
         COALESCE($5::date, ($3 || '-' || lpad(r.dia_do_mes::text, 2, '0'))::date),
         r.descricao
  FROM recorrencias r
  JOIN categorias cat ON cat.categoria_id = r.categoria_id AND cat.usuario_id = r.usuario_id
  WHERE r.usuario_id = $1
    AND ($2::int IS NULL OR r.recorrencia_id = $2::int)
    AND r.data_inicio < ($3 || '-01')::date + INTERVAL '1 month'
    AND (r.data_fim IS NULL OR r.data_fim >= ($3 || '-01')::date)
    AND NOT EXISTS (
      SELECT 1 FROM lancamentos l
      WHERE l.recorrencia_id = r.recorrencia_id AND l.usuario_id = r.usuario_id
        AND l.data_lancamento >= ($3 || '-01')::date
        AND l.data_lancamento < ($3 || '-01')::date + INTERVAL '1 month'
    )
`;

// O NOT EXISTS sozinho não segura dois pedidos ao mesmo tempo (ambos veriam "ainda não lançado").
// A trava por usuário (liberada no fim da transação) faz o segundo esperar e então não achar nada a lançar.
async function inserirDaRecorrencia(parametros: unknown[]): Promise<number> {
  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");
    await cliente.query("SELECT pg_advisory_xact_lock(hashtext('recorrencias'), $1)", [parametros[0]]);
    const resultado = await cliente.query(INSERIR_DA_RECORRENCIA, parametros);
    await cliente.query("COMMIT");
    return resultado.rowCount ?? 0;
  } catch (e) {
    await cliente.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    cliente.release();
  }
}

function voltar(mes: string, aviso: string): never {
  redirect(`/recorrencias/confirmar?mes=${mes}&aviso=${aviso}`);
}

export async function confirmarRecorrencia(formData: FormData): Promise<void> {
  const usuarioId = await exigirUsuario();
  const mes = String(formData.get("mes") ?? "");
  if (!mesValido(mes)) redirect("/recorrencias/confirmar");
  const id = Number(formData.get("recorrenciaId"));
  if (!Number.isInteger(id)) voltar(mes, "invalida");

  const valor = lerDinheiro(String(formData.get("valor") ?? ""));
  if ("erro" in valor) voltar(mes, "valor");
  // A data precisa ficar dentro do mês: é assim que se sabe se o mês já foi lançado.
  const data = String(formData.get("data") ?? "");
  if (!dataValida(data) || data.slice(0, 7) !== mes) voltar(mes, "data");

  let aviso = "confirmada";
  try {
    const inseridos = await inserirDaRecorrencia([usuarioId, id, mes, valor.valor, data]);
    if (inseridos === 0) aviso = "ja-lancada";
  } catch {
    aviso = "falha";
  }

  revalidatePath("/", "layout");
  voltar(mes, aviso);
}

export async function confirmarTodas(formData: FormData): Promise<void> {
  const usuarioId = await exigirUsuario();
  const mes = String(formData.get("mes") ?? "");
  if (!mesValido(mes)) redirect("/recorrencias/confirmar");

  let aviso = "todas";
  try {
    // Valor previsto e o dia de cada recorrência.
    await inserirDaRecorrencia([usuarioId, null, mes, null, null]);
  } catch {
    aviso = "falha";
  }

  revalidatePath("/", "layout");
  voltar(mes, aviso);
}
