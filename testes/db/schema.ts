// Espelho do schema.sql para os testes (se divergir, vale o schema.sql).
import { boolean, date, integer, numeric, pgTable, text } from "drizzle-orm/pg-core";

export const usuarios = pgTable("usuarios", {
  usuarioId: integer("usuario_id").primaryKey().generatedByDefaultAsIdentity(),
  nome: text("nome").notNull(),
  email: text("email").notNull(),
  senhaHash: text("senha_hash").notNull(),
  admin: boolean("admin").notNull().default(false),
  sessaoVersao: integer("sessao_versao").notNull().default(0),
});

export const contas = pgTable("contas", {
  contaId: integer("conta_id").primaryKey().generatedByDefaultAsIdentity(),
  usuarioId: integer("usuario_id").notNull(),
  nome: text("nome").notNull(),
  tipo: text("tipo").notNull(),
  saldoInicial: numeric("saldo_inicial", { precision: 10, scale: 2 }).notNull(),
  dataAbertura: date("data_abertura", { mode: "string" }).notNull(),
});

export const categorias = pgTable("categorias", {
  categoriaId: integer("categoria_id").primaryKey().generatedByDefaultAsIdentity(),
  usuarioId: integer("usuario_id").notNull(),
  nome: text("nome").notNull(),
  tipo: text("tipo").notNull(),
  corHex: text("cor_hex").notNull(),
  ativa: boolean("ativa").notNull().default(true),
});

export const recorrencias = pgTable("recorrencias", {
  recorrenciaId: integer("recorrencia_id").primaryKey().generatedByDefaultAsIdentity(),
  usuarioId: integer("usuario_id").notNull(),
  contaId: integer("conta_id").notNull(),
  categoriaId: integer("categoria_id").notNull(),
  descricao: text("descricao").notNull(),
  valorPrevisto: numeric("valor_previsto", { precision: 10, scale: 2 }).notNull(),
  diaDoMes: integer("dia_do_mes").notNull(),
  dataInicio: date("data_inicio", { mode: "string" }).notNull(),
  dataFim: date("data_fim", { mode: "string" }),
});

export const lancamentos = pgTable("lancamentos", {
  lancamentoId: integer("lancamento_id").primaryKey().generatedByDefaultAsIdentity(),
  usuarioId: integer("usuario_id").notNull(),
  contaId: integer("conta_id").notNull(),
  categoriaId: integer("categoria_id").notNull(),
  recorrenciaId: integer("recorrencia_id"),
  tipo: text("tipo").notNull(),
  valor: numeric("valor", { precision: 10, scale: 2 }).notNull(),
  dataLancamento: date("data_lancamento", { mode: "string" }).notNull(),
  descricao: text("descricao"),
  previsto: boolean("previsto").notNull().default(false),
});
