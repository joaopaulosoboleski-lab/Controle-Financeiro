// Integração (Postgres de teste via Drizzle): regras do banco para "lançamento previsto".
import { sql } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { abrirBanco } from "../db/conexao";
import { hoje, mesDe } from "../db/datas";
import { criarLancamentoDb, lerLancamento, limpar, saldoDe, semear, type Mundo } from "../db/seed";
import { categorias, contas, lancamentos } from "../db/schema";

const { db, cliente } = abrirBanco();
let m: Mundo;

beforeEach(async () => {
  await limpar(db);
  m = await semear(db);
});
afterEach(async () => {
  await limpar(db);
});
afterAll(async () => {
  await cliente.end();
});

async function codigoDoErro(fn: () => Promise<unknown>): Promise<string | undefined> {
  try {
    await fn();
  } catch (e) {
    const err = e as { code?: string; cause?: { code?: string } };
    return err.code ?? err.cause?.code;
  }
  return undefined;
}

describe("coluna previsto", () => {
  it("é NOT NULL com default FALSE e há índice parcial", async () => {
    const col = await db.execute<{ is_nullable: string; column_default: string }>(
      sql`SELECT is_nullable, column_default FROM information_schema.columns WHERE table_name='lancamentos' AND column_name='previsto'`,
    );
    expect(col[0].is_nullable).toBe("NO");
    expect(col[0].column_default).toBe("false");
    const idx = await db.execute<{ indexdef: string }>(
      sql`SELECT indexdef FROM pg_indexes WHERE indexname='idx_lancamentos_previstos'`,
    );
    expect(idx[0].indexdef).toMatch(/WHERE previsto/i);
  });

  it("lançamento criado sem informar previsto nasce realizado", async () => {
    const [l] = await db
      .insert(lancamentos)
      .values({ usuarioId: m.claudia.id, contaId: m.claudia.contaId, categoriaId: m.claudia.catSaidaId, tipo: "saida", valor: "10.00", dataLancamento: hoje() })
      .returning();
    expect(l.previsto).toBe(false);
  });
});

describe("view saldo_contas (R5)", () => {
  it("CA01: previsto não entra no saldo; realizado entra", async () => {
    await criarLancamentoDb(db, { pessoa: m.claudia, valor: "300.00", data: hoje(), previsto: true });
    expect(await saldoDe(db, m.claudia.contaId)).toBe(1000);
    await criarLancamentoDb(db, { pessoa: m.claudia, valor: "50.00", data: hoje() });
    await criarLancamentoDb(db, { pessoa: m.claudia, tipo: "entrada", valor: "20.00", data: hoje() });
    expect(await saldoDe(db, m.claudia.contaId)).toBe(970);
  });

  it("CA02: ao virar realizado (mesmo registro), passa a contar", async () => {
    const id = await criarLancamentoDb(db, { pessoa: m.claudia, valor: "300.00", data: hoje(), previsto: true });
    await db.execute(sql`UPDATE lancamentos SET previsto = FALSE WHERE lancamento_id = ${id}`);
    expect(await saldoDe(db, m.claudia.contaId)).toBe(700);
  });

  it("previsto de entrada também não entra", async () => {
    await criarLancamentoDb(db, { pessoa: m.claudia, tipo: "entrada", valor: "5000.00", data: hoje(), previsto: true });
    expect(await saldoDe(db, m.claudia.contaId)).toBe(1000);
  });

  it("CA11: previsto de uma pessoa não mexe no saldo da outra e a conta sem lançamento mantém o saldo inicial", async () => {
    await criarLancamentoDb(db, { pessoa: m.claudia, valor: "300.00", data: hoje() });
    expect(await saldoDe(db, m.paulo.contaId)).toBe(2000);
    expect(await saldoDe(db, m.claudia.conta2Id)).toBe(500);
  });
});

describe("view lancamentos_suspeitos (qualidade)", () => {
  const suspeitos = (usuarioId: number) =>
    db.execute<{ lancamento_id: number; motivo: string }>(
      sql`SELECT lancamento_id, motivo FROM lancamentos_suspeitos WHERE usuario_id = ${usuarioId}`,
    );

  it("previsto idêntico a um realizado NÃO vira 'possivel duplicado'", async () => {
    await criarLancamentoDb(db, { pessoa: m.claudia, valor: "80.00", data: hoje(), descricao: "Padaria" });
    await criarLancamentoDb(db, { pessoa: m.claudia, valor: "80.00", data: hoje(), descricao: "Padaria", previsto: true });
    expect(await suspeitos(m.claudia.id)).toHaveLength(0);
  });

  it("dois realizados idênticos continuam sendo 'possivel duplicado' (controle)", async () => {
    await criarLancamentoDb(db, { pessoa: m.claudia, valor: "80.00", data: hoje(), descricao: "Padaria" });
    await criarLancamentoDb(db, { pessoa: m.claudia, valor: "80.00", data: hoje(), descricao: "Padaria" });
    const r = await suspeitos(m.claudia.id);
    expect(r.filter((x) => x.motivo === "possivel duplicado")).toHaveLength(2);
  });

  it("previsto sem descrição ou com categoria de outro tipo não é alerta", async () => {
    await criarLancamentoDb(db, { pessoa: m.claudia, valor: "10.00", data: hoje(), descricao: null, previsto: true });
    await criarLancamentoDb(db, { pessoa: m.claudia, tipo: "entrada", categoriaId: m.claudia.catSaidaId, valor: "10.00", data: hoje(), previsto: true });
    expect(await suspeitos(m.claudia.id)).toHaveLength(0);
  });

  it("ao confirmar um dos dois idênticos, o alerta de duplicado aparece (agora ambos são realizados)", async () => {
    await criarLancamentoDb(db, { pessoa: m.claudia, valor: "80.00", data: hoje(), descricao: "Padaria" });
    const id = await criarLancamentoDb(db, { pessoa: m.claudia, valor: "80.00", data: hoje(), descricao: "Padaria", previsto: true });
    await db.execute(sql`UPDATE lancamentos SET previsto = FALSE WHERE lancamento_id = ${id}`);
    expect((await suspeitos(m.claudia.id)).filter((x) => x.motivo === "possivel duplicado")).toHaveLength(2);
  });
});

describe("R8: FK composta vale também para previsto (CA05/CA13)", () => {
  it("previsto de Paulo com conta da Cláudia é recusado pelo banco (23503)", async () => {
    const codigo = await codigoDoErro(() =>
      criarLancamentoDb(db, { pessoa: m.paulo, valor: "10.00", data: hoje(), previsto: true, contaId: m.claudia.contaId }),
    );
    expect(codigo).toBe("23503");
  });

  it("previsto de Paulo com categoria da Cláudia é recusado pelo banco (23503)", async () => {
    const codigo = await codigoDoErro(() =>
      criarLancamentoDb(db, { pessoa: m.paulo, valor: "10.00", data: hoje(), previsto: true, categoriaId: m.claudia.catSaidaId }),
    );
    expect(codigo).toBe("23503");
  });

  it("confirmar movendo para conta de outro dono (UPDATE conta_id) é recusado pelo banco", async () => {
    const id = await criarLancamentoDb(db, { pessoa: m.paulo, valor: "10.00", data: hoje(), previsto: true });
    const codigo = await codigoDoErro(
      () => db.execute(sql`UPDATE lancamentos SET previsto = FALSE, conta_id = ${m.claudia.contaId} WHERE lancamento_id = ${id}`),
    );
    expect(codigo).toBe("23503");
    expect((await lerLancamento(db, id)).previsto).toBe(true);
  });
});

describe("CHECK de valor (CA04) vale para previsto", () => {
  it.each(["0", "-5.00"])("valor %s recusado (23514)", async (valor) => {
    const codigo = await codigoDoErro(() =>
      criarLancamentoDb(db, { pessoa: m.claudia, valor, data: hoje(), previsto: true }),
    );
    expect(codigo).toBe("23514");
  });

  it("valor acima de 99.999.999,99 estoura NUMERIC(10,2) (22003)", async () => {
    const codigo = await codigoDoErro(() =>
      criarLancamentoDb(db, { pessoa: m.claudia, valor: "100000000.00", data: hoje(), previsto: true }),
    );
    expect(codigo).toBe("22003");
  });

  it("valor máximo 99.999.999,99 é aceito", async () => {
    const id = await criarLancamentoDb(db, { pessoa: m.claudia, valor: "99999999.99", data: hoje(), previsto: true });
    expect((await lerLancamento(db, id)).valor).toBe("99999999.99");
  });
});

describe("R9: previsto conta como 'em uso'", () => {
  it("excluir conta, categoria ou usuário com previsto é recusado (23503)", async () => {
    await criarLancamentoDb(db, { pessoa: m.claudia, valor: "10.00", data: hoje(), previsto: true });
    expect(await codigoDoErro(() => db.delete(contas).where(sql`${contas.contaId} = ${m.claudia.contaId}`))).toBe("23503");
    expect(await codigoDoErro(() => db.delete(categorias).where(sql`${categorias.categoriaId} = ${m.claudia.catSaidaId}`))).toBe("23503");
  });

  it("arquivar categoria usada por previsto funciona", async () => {
    await criarLancamentoDb(db, { pessoa: m.claudia, valor: "10.00", data: hoje(), previsto: true });
    await db.update(categorias).set({ ativa: false }).where(sql`${categorias.categoriaId} = ${m.claudia.catSaidaId}`);
    const r = await db.select().from(categorias).where(sql`${categorias.categoriaId} = ${m.claudia.catSaidaId}`);
    expect(r[0].ativa).toBe(false);
  });
});

describe("agregados por mês (base de CA07/CA10)", () => {
  it("meses só com previstos existem na tabela, mas a soma de realizados do mês é zero", async () => {
    const futuro = `${Number(mesDe(hoje()).slice(0, 4)) + 1}-03-10`;
    await criarLancamentoDb(db, { pessoa: m.claudia, valor: "123.00", data: futuro, previsto: true });
    const r = await db.execute<{ total: string }>(
      sql`SELECT COALESCE(SUM(valor) FILTER (WHERE NOT previsto), 0)::text AS total FROM lancamentos WHERE usuario_id = ${m.claudia.id} AND to_char(data_lancamento,'YYYY-MM') = ${mesDe(futuro)}`,
    );
    expect(Number(r[0].total)).toBe(0);
  });
});
