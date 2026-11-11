-- ajustar_sequencias.sql — rode depois do dados.sql.
-- O dados.sql insere ids explicitos; isto alinha os contadores para os proximos INSERTs.
SELECT setval(pg_get_serial_sequence('usuarios', 'usuario_id'), (SELECT MAX(usuario_id) FROM usuarios));
SELECT setval(pg_get_serial_sequence('contas', 'conta_id'), (SELECT MAX(conta_id) FROM contas));
SELECT setval(pg_get_serial_sequence('categorias', 'categoria_id'), (SELECT MAX(categoria_id) FROM categorias));
SELECT setval(pg_get_serial_sequence('recorrencias', 'recorrencia_id'), (SELECT MAX(recorrencia_id) FROM recorrencias));
SELECT setval(pg_get_serial_sequence('lancamentos', 'lancamento_id'), (SELECT MAX(lancamento_id) FROM lancamentos));
