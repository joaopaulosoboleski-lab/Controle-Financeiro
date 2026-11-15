-- previstos.sql — rode depois do seguranca.sql (e pode rodar de novo sem problema).
-- No Supabase, rode o supabase.sql DE NOVO depois deste: o CREATE OR REPLACE VIEW abaixo
-- apaga a opção security_invoker das views, que o supabase.sql liga de volta.
--
-- Lançamento previsto: registrado antes de acontecer; não entra no saldo nem em nenhum total
-- até ser confirmado (aí vira realizado, no mesmo registro). Os existentes são realizados.

ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS previsto BOOLEAN NOT NULL DEFAULT FALSE;

-- "Previstos de uma pessoa num mês" e "quantos estão vencidos" (índice parcial: são poucos).
CREATE INDEX IF NOT EXISTS idx_lancamentos_previstos
  ON lancamentos (usuario_id, data_lancamento) WHERE previsto;

-- R5: saldo = saldo inicial + entradas − saídas, só dos lançamentos REALIZADOS.
CREATE OR REPLACE VIEW saldo_contas AS
SELECT c.conta_id,
       c.usuario_id,
       c.nome,
       c.saldo_inicial
         + COALESCE(SUM(CASE WHEN l.tipo = 'entrada' THEN l.valor ELSE -l.valor END), 0) AS saldo_atual
FROM contas c
LEFT JOIN lancamentos l ON l.conta_id = c.conta_id AND NOT l.previsto
GROUP BY c.conta_id, c.usuario_id, c.nome, c.saldo_inicial;

-- Alertas de qualidade olham só o que aconteceu (previsto ainda pode mudar até ser confirmado).
CREATE OR REPLACE VIEW lancamentos_suspeitos AS
WITH base AS (
  SELECT l.lancamento_id, l.usuario_id, l.tipo, l.descricao, cat.tipo AS tipo_categoria,
         COUNT(*) OVER (
           PARTITION BY l.usuario_id, l.conta_id, l.data_lancamento, l.valor, l.descricao
         ) AS repeticoes
  FROM lancamentos l
  JOIN categorias cat ON cat.categoria_id = l.categoria_id AND cat.usuario_id = l.usuario_id
  WHERE NOT l.previsto
)
SELECT lancamento_id, usuario_id, 'sem descricao' AS motivo
FROM base WHERE descricao IS NULL OR btrim(descricao) = ''
UNION ALL
SELECT lancamento_id, usuario_id, 'possivel duplicado'
FROM base WHERE repeticoes > 1 AND btrim(COALESCE(descricao, '')) <> ''
UNION ALL
SELECT lancamento_id, usuario_id, 'tipo diferente da categoria'
FROM base WHERE tipo <> tipo_categoria;
