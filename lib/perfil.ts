import { pool } from "@/lib/db";
import { exigirUsuario } from "@/lib/sessao";

export type Perfil = {
  nome: string;
  email: string;
  criadoEm: string; // YYYY-MM-DD
  contas: number;
  categorias: number;
  recorrencias: number;
  lancamentos: number;
  primeiroLancamento: string | null; // YYYY-MM-DD
  ultimoLancamento: string | null; // YYYY-MM-DD
};

// Dados da pessoa logada e um resumo do que ela já cadastrou (R1: só os próprios dados).
export async function buscarPerfil(): Promise<Perfil | undefined> {
  const { rows } = await pool.query<{
    nome: string;
    email: string;
    criado_em: string;
    contas: number;
    categorias: number;
    recorrencias: number;
    lancamentos: number;
    primeiro: string | null;
    ultimo: string | null;
  }>(
    `SELECT u.nome, u.email, to_char(u.criado_em, 'YYYY-MM-DD') AS criado_em,
            (SELECT COUNT(*)::int FROM contas c WHERE c.usuario_id = u.usuario_id) AS contas,
            (SELECT COUNT(*)::int FROM categorias c WHERE c.usuario_id = u.usuario_id AND c.ativa) AS categorias,
            (SELECT COUNT(*)::int FROM recorrencias r WHERE r.usuario_id = u.usuario_id) AS recorrencias,
            l.quantidade AS lancamentos,
            to_char(l.primeiro, 'YYYY-MM-DD') AS primeiro,
            to_char(l.ultimo, 'YYYY-MM-DD') AS ultimo
     FROM usuarios u
     CROSS JOIN LATERAL (
       SELECT COUNT(*)::int AS quantidade, MIN(data_lancamento) AS primeiro, MAX(data_lancamento) AS ultimo
       FROM lancamentos WHERE usuario_id = u.usuario_id
     ) l
     WHERE u.usuario_id = $1`,
    [await exigirUsuario()],
  );
  const linha = rows[0];
  if (!linha) return undefined;
  return {
    nome: linha.nome,
    email: linha.email,
    criadoEm: linha.criado_em,
    contas: linha.contas,
    categorias: linha.categorias,
    recorrencias: linha.recorrencias,
    lancamentos: linha.lancamentos,
    primeiroLancamento: linha.primeiro,
    ultimoLancamento: linha.ultimo,
  };
}
