-- supabase.sql — rode por último, só no Supabase.
-- O app acessa o banco direto (usuario dono, que ignora o RLS). Já a API pública do Supabase
-- (chave publishable) enxerga o schema public; sem isto, qualquer pessoa com essa chave
-- poderia ler e alterar os dados. Aqui: RLS ligado, sem políticas (nega tudo) e acesso revogado.

ALTER TABLE usuarios     ENABLE ROW LEVEL SECURITY;
ALTER TABLE contas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias   ENABLE ROW LEVEL SECURITY;
ALTER TABLE recorrencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE lancamentos  ENABLE ROW LEVEL SECURITY;

-- Views rodam com os privilégios de quem as consulta, e não do dono.
ALTER VIEW saldo_contas          SET (security_invoker = on);
ALTER VIEW lancamentos_suspeitos SET (security_invoker = on);

REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
