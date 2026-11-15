// Seed e limpeza dos testes. Cada teste cria os próprios dados e limpa no afterEach.
import { randomBytes, scrypt } from "node:crypto";
import { sql } from "drizzle-orm";
import type { abrirBanco } from "./conexao";
import { categorias, contas, lancamentos, recorrencias, usuarios } from "./schema";

type Db = ReturnType<typeof abrirBanco>["db"];

export const SENHA_TESTE = "senha-de-teste-123";

// Mesmo formato de lib/senha.ts: scrypt$<sal hex>$<hash hex> (64 bytes).
export function hashScrypt(senha: string): Promise<string> {
  const sal = randomBytes(16);
  return new Promise((resolve, reject) =>
    scrypt(senha, sal, 64, (e, chave) =>
      e ? reject(e) : resolve(`scrypt$${sal.toString("hex")}$${chave.toString("hex")}`),
    ),
  );
}

export type Pessoa = {
  id: number;
  email: string;
  nome: string;
  contaId: number; // "Corrente"
  conta2Id: number; // "Poupanca"
  catSaidaId: number; // "Mercado"
  catEntradaId: number; // "Salario"
  catSaida2Id: number; // "Viagem" (segunda categoria de saída)
  nomeCatSaida2: string;
};

export type Mundo = { claudia: Pessoa; paulo: Pessoa };

async function criarPessoa(
  db: Db,
  nome: string,
  email: string,
  admin: boolean,
  saldo1: string,
  saldo2: string,
  sufixo: string,
): Promise<Pessoa> {
  const [u] = await db
    .insert(usuarios)
    .values({ nome, email, senhaHash: await hashScrypt(SENHA_TESTE), admin })
    .returning();
  const abertura = "2020-01-01";
  const [c1] = await db
    .insert(contas)
    .values({ usuarioId: u.usuarioId, nome: `Corrente ${sufixo}`, tipo: "corrente", saldoInicial: saldo1, dataAbertura: abertura })
    .returning();
  const [c2] = await db
    .insert(contas)
    .values({ usuarioId: u.usuarioId, nome: `Poupanca ${sufixo}`, tipo: "poupanca", saldoInicial: saldo2, dataAbertura: abertura })
    .returning();
  const [cs] = await db
    .insert(categorias)
    .values({ usuarioId: u.usuarioId, nome: `Mercado ${sufixo}`, tipo: "saida", corHex: "#336699" })
    .returning();
  const [ce] = await db
    .insert(categorias)
    .values({ usuarioId: u.usuarioId, nome: `Salario ${sufixo}`, tipo: "entrada", corHex: "#339966" })
    .returning();
  const [cs2] = await db
    .insert(categorias)
    .values({ usuarioId: u.usuarioId, nome: `Viagem ${sufixo}`, tipo: "saida", corHex: "#993366" })
    .returning();
  return {
    id: u.usuarioId,
    email,
    nome,
    contaId: c1.contaId,
    conta2Id: c2.contaId,
    catSaidaId: cs.categoriaId,
    catEntradaId: ce.categoriaId,
    catSaida2Id: cs2.categoriaId,
    nomeCatSaida2: `Viagem ${sufixo}`,
  };
}

// Cláudia (admin): Corrente 1000,00 e Poupanca 500,00. Paulo: Corrente 2000,00 e Poupanca 100,00.
export async function semear(db: Db): Promise<Mundo> {
  const claudia = await criarPessoa(db, "Claudia Teste", "claudia@teste.local", true, "1000.00", "500.00", "Claudia");
  const paulo = await criarPessoa(db, "Paulo Teste", "paulo@teste.local", false, "2000.00", "100.00", "Paulo");
  return { claudia, paulo };
}

// Apaga na ordem das FKs: lançamentos -> recorrências -> categorias -> contas -> usuários.
export async function limpar(db: Db): Promise<void> {
  await db.delete(lancamentos);
  await db.delete(recorrencias);
  await db.delete(categorias);
  await db.delete(contas);
  await db.execute(sql`DELETE FROM tentativas_login`);
  await db.delete(usuarios);
}

type NovoLancamento = {
  pessoa: Pessoa;
  tipo?: "entrada" | "saida";
  valor: string;
  data: string;
  descricao?: string | null;
  previsto?: boolean;
  contaId?: number;
  categoriaId?: number;
  recorrenciaId?: number;
};

export async function criarLancamentoDb(db: Db, n: NovoLancamento): Promise<number> {
  const tipo = n.tipo ?? "saida";
  const [l] = await db
    .insert(lancamentos)
    .values({
      usuarioId: n.pessoa.id,
      contaId: n.contaId ?? n.pessoa.contaId,
      categoriaId: n.categoriaId ?? (tipo === "saida" ? n.pessoa.catSaidaId : n.pessoa.catEntradaId),
      recorrenciaId: n.recorrenciaId,
      tipo,
      valor: n.valor,
      dataLancamento: n.data,
      descricao: n.descricao === undefined ? "Item de teste" : n.descricao,
      previsto: n.previsto ?? false,
    })
    .returning({ id: lancamentos.lancamentoId });
  return l.id;
}

export async function saldoDe(db: Db, contaId: number): Promise<number> {
  const r = await db.execute<{ saldo_atual: string }>(
    sql`SELECT saldo_atual::text AS saldo_atual FROM saldo_contas WHERE conta_id = ${contaId}`,
  );
  return Number(r[0].saldo_atual);
}

export async function lerLancamento(db: Db, id: number) {
  const r = await db.select().from(lancamentos).where(sql`${lancamentos.lancamentoId} = ${id}`);
  return r[0];
}
