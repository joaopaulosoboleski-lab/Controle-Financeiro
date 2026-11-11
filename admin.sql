-- admin.sql — rode depois do dados.sql (e pode rodar de novo sem problema).
-- Papel de administrador: só admin cadastra, edita e exclui usuários no painel /usuarios.
-- Os demais continuam enxergando apenas os próprios dados (R1).
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Cláudia é quem administra a Caderneta da família.
UPDATE usuarios SET admin = TRUE WHERE usuario_id = 1;
