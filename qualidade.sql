-- qualidade.sql — rode depois do dados.sql.
-- Aponta lancamentos que merecem revisao, SEM alterar nem apagar nada.
CREATE VIEW lancamentos_suspeitos AS
WITH base AS (
  SELECT l.lancamento_id, l.usuario_id, l.tipo, l.descricao, cat.tipo AS tipo_categoria,
         COUNT(*) OVER (
           PARTITION BY l.usuario_id, l.conta_id, l.data_lancamento, l.valor, l.descricao
         ) AS repeticoes
  FROM lancamentos l
  JOIN categorias cat ON cat.categoria_id = l.categoria_id AND cat.usuario_id = l.usuario_id
  WHERE NOT l.previsto -- previsto ainda pode mudar (coluna criada no schema.sql / previstos.sql)
)
SELECT lancamento_id, usuario_id, 'sem descricao' AS motivo
FROM base WHERE descricao IS NULL OR btrim(descricao) = ''
UNION ALL
SELECT lancamento_id, usuario_id, 'possivel duplicado'
FROM base WHERE repeticoes > 1 AND btrim(COALESCE(descricao, '')) <> ''
UNION ALL
SELECT lancamento_id, usuario_id, 'tipo diferente da categoria'
FROM base WHERE tipo <> tipo_categoria;
