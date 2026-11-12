-- seguranca.sql — rode depois do admin.sql (e pode rodar de novo sem problema).
-- No Supabase, rode o supabase.sql DE NOVO depois deste (liga o RLS da tabela nova).

-- Sessões revogáveis: o cookie carrega esta versão; somar 1 derruba todas as sessões da pessoa
-- (feito ao trocar a senha).
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS sessao_versao INTEGER NOT NULL DEFAULT 0;

-- O login compara em minúsculas; o UNIQUE (email) original diferencia caixa.
-- Este índice garante a unicidade do jeito que o app compara e acelera o login.
-- Se falhar, há e-mails repetidos com caixa diferente: corrija-os antes.
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_email_minusculo ON usuarios (lower(email));

-- Tentativas de login que falharam, para bloquear quem tenta adivinhar senhas.
CREATE TABLE IF NOT EXISTS tentativas_login (
  email     TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tentativas_login_email ON tentativas_login (email, criado_em);
