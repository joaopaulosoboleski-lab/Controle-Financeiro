import { notFound } from "next/navigation";
import { pool } from "@/lib/db";
import { exigirUsuario, lerUsuarioId } from "@/lib/sessao";

// ---------- Validação compartilhada (perfil e painel de usuários) ----------

export const SENHA_MINIMA = 8;
export const ERRO_EMAIL_EM_USO = "Este e-mail já está em uso por outra pessoa.";
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// O login compara em minúsculas; guardar assim evita dois e-mails "iguais" com caixa diferente.
export function validarNomeEmail(
  nomeBruto: string,
  emailBruto: string,
): { nome: string; email: string } | { erro: string } {
  const nome = nomeBruto.trim();
  const email = emailBruto.trim().toLowerCase();
  if (!nome) return { erro: "Preencha o nome." };
  if (nome.length > 80) return { erro: "O nome pode ter no máximo 80 caracteres." };
  if (!EMAIL_VALIDO.test(email) || email.length > 254) return { erro: "Informe um e-mail válido." };
  return { nome, email };
}

// Mensagem de erro, ou null se a senha serve.
export function validarNovaSenha(nova: string, confirmacao: string): string | null {
  if (nova.length < SENHA_MINIMA) return `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`;
  if (nova.length > 200) return "A senha é longa demais.";
  if (nova !== confirmacao) return "A confirmação não é igual à senha.";
  return null;
}

export async function emailEmUso(email: string, exceto?: number): Promise<boolean> {
  const { rowCount } = await pool.query(
    "SELECT 1 FROM usuarios WHERE lower(email) = $1 AND usuario_id <> $2",
    [email, exceto ?? 0],
  );
  return Boolean(rowCount);
}

// 23505 = violou um UNIQUE (aqui, o do e-mail, salvo ao mesmo tempo por outra pessoa).
export function violouUnico(erro: unknown): boolean {
  return (erro as { code?: string })?.code === "23505";
}

// ---------- Papel de administrador ----------

// Lido do banco a cada pedido (e não do cookie): tirar o admin vale na hora.
export async function ehAdmin(): Promise<boolean> {
  const id = await lerUsuarioId();
  if (id === undefined) return false;
  const { rows } = await pool.query<{ admin: boolean }>("SELECT admin FROM usuarios WHERE usuario_id = $1", [id]);
  return rows[0]?.admin === true;
}

// Para as telas e actions do painel de usuários. Quem não é admin recebe "não encontrado",
// sem revelar que a área existe.
export async function exigirAdmin(): Promise<number> {
  const id = await exigirUsuario();
  const { rows } = await pool.query<{ admin: boolean }>("SELECT admin FROM usuarios WHERE usuario_id = $1", [id]);
  if (rows[0]?.admin !== true) notFound();
  return id;
}

// ---------- Consultas do painel (só admin) ----------

export type UsuarioResumo = {
  id: number;
  nome: string;
  email: string;
  criadoEm: string; // YYYY-MM-DD
  admin: boolean;
  registros: number; // contas + categorias + recorrências + lançamentos
};

export type UsuarioDetalhe = UsuarioResumo & {
  contas: number;
  categorias: number;
  recorrencias: number;
  lancamentos: number;
};

type LinhaUsuario = {
  id: number;
  nome: string;
  email: string;
  criado_em: string;
  admin: boolean;
  contas: number;
  categorias: number;
  recorrencias: number;
  lancamentos: number;
};

const SELECT_USUARIO = `
  SELECT u.usuario_id AS id, u.nome, u.email, to_char(u.criado_em, 'YYYY-MM-DD') AS criado_em, u.admin,
         (SELECT COUNT(*)::int FROM contas       x WHERE x.usuario_id = u.usuario_id) AS contas,
         (SELECT COUNT(*)::int FROM categorias   x WHERE x.usuario_id = u.usuario_id) AS categorias,
         (SELECT COUNT(*)::int FROM recorrencias x WHERE x.usuario_id = u.usuario_id) AS recorrencias,
         (SELECT COUNT(*)::int FROM lancamentos  x WHERE x.usuario_id = u.usuario_id) AS lancamentos
  FROM usuarios u
`;

function paraUsuario(l: LinhaUsuario): UsuarioDetalhe {
  return {
    id: l.id,
    nome: l.nome,
    email: l.email,
    criadoEm: l.criado_em,
    admin: l.admin,
    contas: l.contas,
    categorias: l.categorias,
    recorrencias: l.recorrencias,
    lancamentos: l.lancamentos,
    registros: l.contas + l.categorias + l.recorrencias + l.lancamentos,
  };
}

export async function listarUsuarios(): Promise<UsuarioResumo[]> {
  await exigirAdmin();
  const { rows } = await pool.query<LinhaUsuario>(`${SELECT_USUARIO} ORDER BY lower(u.nome), u.usuario_id`);
  return rows.map(paraUsuario);
}

export async function buscarUsuario(id: number): Promise<UsuarioDetalhe | undefined> {
  await exigirAdmin();
  if (!Number.isInteger(id)) return undefined;
  const { rows } = await pool.query<LinhaUsuario>(`${SELECT_USUARIO} WHERE u.usuario_id = $1`, [id]);
  return rows[0] ? paraUsuario(rows[0]) : undefined;
}
