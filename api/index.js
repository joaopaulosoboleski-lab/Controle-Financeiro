import "dotenv/config";
import express from "express";
import { createClient } from "@supabase/supabase-js";
import { validarLancamento } from "./validacao.js";

// SEM AUTENTICAÇÃO (decisão do projeto, por enquanto; o token está no commit d898e80).
// - LOCAL (padrão): ouve só nesta máquina (127.0.0.1 e ::1).
// - PÚBLICO (no Railway, ou HOST=0.0.0.0): ouve na rede. ATENÇÃO: aí qualquer um que tenha a URL
//   grava em nome de qualquer usuário, com a chave que ignora o RLS.

const { SUPABASE_URL, SUPABASE_KEY } = process.env;
const PUBLICO =
  process.env.HOST === "0.0.0.0" || Boolean(process.env.RAILWAY_ENVIRONMENT_NAME || process.env.RAILWAY_ENVIRONMENT);

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Defina SUPABASE_URL e SUPABASE_KEY (no .env local ou nas Variables do Railway).");
  process.exit(1);
}

// SUPABASE_KEY é a chave service_role (ou secret): o supabase.sql liga RLS sem políticas e
// revoga anon/authenticated, então só ela consegue gravar. Por isso fica só neste servidor.
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

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

// Só diz que o serviço está de pé, sem dado nenhum.
app.get("/health", (req, res) => {
  res.status(200).json({ servico: "caderneta-api", versao: "1.0.0" });
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
if (PUBLICO) {
  // O proxy do Railway entra pela rede do contêiner, não pelo 127.0.0.1: precisa ouvir em todas.
  app.listen(PORT, "0.0.0.0", () =>
    console.warn(`API ouvindo na porta ${PORT} (modo PÚBLICO, SEM token: qualquer um com a URL grava)`),
  );
} else {
  // Só esta máquina. IPv4 e IPv6 porque, no Windows, "localhost" costuma ir primeiro para ::1.
  app.listen(PORT, "127.0.0.1", () => console.log(`API ouvindo em http://localhost:${PORT} (local, sem token)`));
  app.listen(PORT, "::1").on("error", () => {}); // sem IPv6 na máquina: segue só com o IPv4
}

