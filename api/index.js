import "dotenv/config";
import { timingSafeEqual } from "node:crypto";
import express from "express";
import { createClient } from "@supabase/supabase-js";
import { validarLancamento } from "./validacao.js";

const { SUPABASE_URL, SUPABASE_KEY, API_TOKEN } = process.env;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Defina SUPABASE_URL e SUPABASE_KEY no arquivo .env (veja .env.example).");
  process.exit(1);
}
if (!API_TOKEN || API_TOKEN.length < 32) {
  console.error("Defina API_TOKEN no arquivo .env com pelo menos 32 caracteres (veja .env.example).");
  process.exit(1);
}

// SUPABASE_KEY é a chave service_role (ou secret): o supabase.sql liga RLS sem políticas e
// revoga anon/authenticated, então só ela consegue gravar. Por isso fica só neste servidor.
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const tokenEsperado = Buffer.from(API_TOKEN);

function tokenConfere(cabecalho) {
  const [esquema, token] = (cabecalho ?? "").split(" ");
  if (esquema !== "Bearer" || !token) return false;
  const recebido = Buffer.from(token);
  return recebido.length === tokenEsperado.length && timingSafeEqual(recebido, tokenEsperado);
}

// Mesma regra do conferirDono do app (R8): conta e categoria do usuário, categoria ativa
// e do mesmo tipo do lançamento. Devolve { erro, status } ou null.
async function conferirDono({ usuario_id, conta_id, categoria_id, tipo }) {
  const conta = await supabase
    .from("contas")
    .select("conta_id")
    .eq("conta_id", conta_id)
    .eq("usuario_id", usuario_id)
    .maybeSingle();
  if (conta.error) return { status: 500, erro: conta.error.message };
  if (!conta.data) return { status: 400, erro: "Conta inválida." };

  const categoria = await supabase
    .from("categorias")
    .select("tipo")
    .eq("categoria_id", categoria_id)
    .eq("usuario_id", usuario_id)
    .eq("ativa", true)
    .maybeSingle();
  if (categoria.error) return { status: 500, erro: categoria.error.message };
  if (!categoria.data) return { status: 400, erro: "Categoria inválida." };
  if (categoria.data.tipo !== tipo) {
    return { status: 400, erro: "A categoria escolhida não é do mesmo tipo (entrada ou saída) do lançamento." };
  }
  return null;
}

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "10kb" }));

app.use((req, res, next) => {
  if (!tokenConfere(req.get("authorization"))) {
    return res.status(401).json({ erro: "Não autorizado." });
  }
  next();
});

app.post("/lancamentos", async (req, res) => {
  const { erro, dados } = validarLancamento(req.body);
  if (erro) return res.status(400).json({ erro });

  try {
    const problema = await conferirDono(dados);
    if (problema) return res.status(problema.status).json({ erro: problema.erro });

    const { data, error } = await supabase
      .from("lancamentos")
      .insert(dados)
      .select("lancamento_id")
      .single();

    if (error) return res.status(500).json({ erro: error.message });
    return res.status(201).json({ lancamento_id: data.lancamento_id });
  } catch (e) {
    // Falha de rede/conexão com o Supabase: nunca responde sucesso.
    return res.status(500).json({ erro: e instanceof Error ? e.message : "Erro inesperado." });
  }
});

app.use((req, res) => res.status(404).json({ erro: "Rota não encontrada." }));

// JSON malformado ou corpo grande demais chegam aqui pelo express.json().
// O Express só trata como erro o middleware de 4 parâmetros, por isso _next fica.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err, req, res, _next) => {
  const status = err.status ?? err.statusCode ?? 500;
  res.status(status).json({ erro: status === 500 ? "Erro inesperado." : "Corpo JSON inválido." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API ouvindo na porta ${PORT}`));
