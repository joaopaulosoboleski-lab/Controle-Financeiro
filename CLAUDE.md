# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Projeto

Caderneta da Cláudia: controle financeiro pessoal (Next.js 16 App Router + React 19 + PostgreSQL via `pg`, sem ORM). Código, nomes de variáveis, UI e commits em **português**. Os requisitos (R1–R12) estão em [requisitos.md](requisitos.md) e o significado de cada coluna em [dicionario.md](dicionario.md); os comentários do código citam os requisitos pelo número (ex.: "R8").

## Comandos

```
npm run dev                 # servidor em http://localhost:3000 (Turbopack)
npm run build               # build de produção (também faz a checagem de tipos)
npx tsc --noEmit -p .       # checagem de tipos rápida
npm test                    # testes (Vitest) das funções puras em testes/*.test.ts
npm run test:db             # recria o banco de TESTE (caderneta_teste) — exige DATABASE_URL_TEST
npm run test:integracao     # regras do banco (Vitest + Drizzle) no banco de teste
npm run test:e2e            # Playwright (Chrome instalado): build, sobe em :3100 e testa no banco de teste
npm run lint                # ESLint (eslint-config-next + typescript)
npm run db:start            # liga o PostgreSQL local (porta 5434 — a 5433 costuma estar com o Docker —, dados em %USERPROFILE%\caderneta-pgdata)
npm run db:stop
node --env-file=.env.local scripts/definir-senha.mjs <email> <senha>   # define a senha de um usuário
```

Testes de integração e e2e usam SÓ `DATABASE_URL_TEST` (ex.: `postgresql://postgres@127.0.0.1:5434/caderneta_teste`); `testes/db/conexao.ts` aborta se ela apontar para o mesmo banco do `DATABASE_URL`. Drizzle existe só em `testes/` — o app usa `pg`. Não rode integração e e2e juntos (limpam o mesmo banco). `NEXT_DIST_DIR` muda a pasta do build (permite um build paralelo ao do e2e). Os testes unitários cobrem só funções puras (validação, estatística, datas): não acessam banco nem servidor. Validação nova vai para um arquivo sem banco (ex.: [lib/validacao-cadastros.ts](lib/validacao-cadastros.ts)) para poder ser testada.

## Banco de dados

- Scripts SQL na raiz, nesta ordem: `schema.sql` → `dados.sql` → `ajustar_sequencias.sql` → `qualidade.sql` → `admin.sql` (adiciona `usuarios.admin` e torna o usuário 1 admin; idempotente) → `seguranca.sql` (coluna `usuarios.sessao_versao`, índice único em `lower(email)` e tabela `tentativas_login`; idempotente) → `previstos.sql` (coluna `lancamentos.previsto` e views refeitas; idempotente) → `supabase.sql` (este só no Supabase: liga RLS sem políticas e revoga `anon`/`authenticated`; o app usa o usuário dono, que ignora o RLS).
- Os `senha_hash` de `dados.sql` são fictícios: para entrar com um usuário de exemplo é preciso rodar `definir-senha.mjs`.
- `DATABASE_URL` em `.env.local` decide o banco. **Hoje aponta para o Supabase (dados reais)**, não para o local. Escrever nele afeta o ambiente de verdade.
- Supabase usa o *transaction pooler* (Supavisor): as conexões do servidor são compartilhadas entre clientes. **Nunca rode `SET` de sessão** (ex.: `SET default_transaction_read_only = on`): ele fica preso na conexão do pooler e quebra o app para todos. Para leituras seguras use `BEGIN READ ONLY … ROLLBACK`.
- [lib/db.ts](lib/db.ts) tira o `?pgbouncer=true` da URL e, para bancos não locais, exige `certs/supabase-ca.crt`. Scripts avulsos precisam fazer o mesmo.

## Arquitetura

**Modelo (schema.sql).** Toda tabela tem `usuario_id`. Lançamentos e recorrências referenciam conta e categoria por **FK composta** `(id, usuario_id)`, então o banco impede cruzar donos (R8). Não há `ON DELETE CASCADE` (R9): categoria em uso se aposenta com `ativa = false`. O saldo não é guardado; vem da view `saldo_contas` (R5). Dinheiro é `NUMERIC(10,2)`, valor sempre positivo e o sinal vem de `tipo` (`entrada`/`saida`).

**Sessão e acesso.** [lib/sessao.ts](lib/sessao.ts): cookie `sessao` = `<usuario_id>.<emitido_em>.<sessao_versao>.<HMAC-SHA256 com SESSION_SECRET>`. Expira em 7 dias no servidor e a versão é conferida no banco a cada pedido (`lerUsuarioId` usa `cache()` do React); `revogarSessoes()` soma 1 na versão e derruba todas as sessões (feito ao trocar a senha). O login bloqueia o e-mail por 15 min após 5 falhas (`tentativas_login`). Não há middleware/proxy: a proteção é `exigirUsuario()`, que redireciona para `/login`. Senhas: scrypt no formato `scrypt$<sal>$<hash>` ([lib/senha.ts](lib/senha.ts)).

**Administrador.** Só quem tem `usuarios.admin = true` acessa `/usuarios` (cadastrar, editar e excluir usuários). O papel é lido do banco a cada pedido, nunca do cookie. Toda página e action do painel começa com `exigirAdmin()` ([lib/usuarios.ts](lib/usuarios.ts)), que responde "não encontrado" para quem não é admin; o menu usa `ehAdmin()`. Regras: o admin não pode se excluir nem tirar o próprio admin (garante que sempre exista um), e usuário com qualquer conta, categoria, recorrência ou lançamento não pode ser excluído (R9). A validação de nome, e-mail e senha também fica em `lib/usuarios.ts` e é compartilhada com `/perfil`.

**Camada de dados em `lib/`.** Cada função de consulta chama `exigirUsuario()` por conta própria e filtra por `usuario_id`; as páginas nunca recebem nem passam o id do usuário. Convenções nas consultas: `NUMERIC` sai como `::text` e vira `Number` no JS; datas saem com `to_char(..., 'YYYY-MM-DD')` (strings, sem `Date`, para evitar fuso). Formatação pt-BR em `formatarValor`/`formatarData`/`formatarMes` ([lib/lancamentos.ts](lib/lancamentos.ts)).

**Escritas = Server Actions** em `actions.ts` ao lado da rota (`app/(painel)/<rota>/actions.ts`). Padrão:
- validação manual em [lib/formulario.ts](lib/formulario.ts) (sem biblioteca), devolvendo a primeira mensagem de erro;
- `conferirDono` confere no app que conta/categoria são do usuário (além da FK composta) e que o tipo da categoria bate com o do lançamento;
- `UPDATE`/`DELETE` sempre com `WHERE ... AND usuario_id = $n`; `rowCount === 0` = "não encontrado";
- o estado devolvido (`{ erro?, sucesso?, valores? }`) traz `valores` para repreencher o formulário, porque o React 19 limpa o form após a action;
- `revalidatePath` das telas afetadas e `redirect()` **fora** do `try/catch` (ele lança uma exceção interna).

**Rotas.** `app/(painel)/` é o grupo autenticado; seu `layout.tsx` tem o menu. `app/login` fica fora dele. Lista e dashboard são filtrados por mês via `?mes=YYYY-MM` (`resolverMes` cai no mês mais recente com lançamentos).

**Aba Análise (`/analise`).** Um único cálculo alimenta tela, Excel e PDF: `carregarAnalise(de, ate)` em [lib/analise.ts](lib/analise.ts) busca os lançamentos do período e devolve tudo pronto (mensal, Pareto, distribuição, atípicos, previsão, conclusões em texto). As fórmulas estatísticas puras ficam em [lib/estatistica.ts](lib/estatistica.ts). Os gráficos são SVG feitos à mão no servidor ([components/graficos/](components/graficos/)), sem biblioteca; as cores são tokens `--g-*`/`--seq-*` em `globals.css`, com paleta validada para daltonismo nos dois temas; a dica ao passar o mouse vem de `data-dica` lido por um único componente cliente (`Dicas.tsx`). As exportações são rotas GET (`/analise/excel`, `/analise/pdf`) com `exceljs` e `pdfkit`, ambos em `serverExternalPackages` no `next.config.ts` (o pdfkit lê as fontes .afm do node_modules). No PDF, as fontes padrão são WinAnsi: texto passa por `t()` para trocar caracteres como `−`, `α`, `▲`.

**Cadastros.** `/contas`, `/categorias` e `/recorrencias` seguem o mesmo padrão de lançamentos (consultas em [lib/cadastros.ts](lib/cadastros.ts), validação em `lib/validacao-cadastros.ts`). Regras: conta/categoria/recorrência em uso não se exclui (R9); categoria em uso não troca entre entrada e saída e é **arquivada** (`ativa = false`), saindo dos formulários mas ficando nas edições que já a usam; saldo inicial aceita zero e negativo. Estas actions usam `revalidatePath("/", "layout")`, porque nomes e saldos aparecem em quase todas as telas.

**Confirmação de recorrências (R6/R7).** `/recorrencias/confirmar?mes=YYYY-MM` lista as recorrências vigentes no mês (início antes do fim do mês; fim, se houver, a partir do dia 1) e o lançamento que já saiu de cada uma. Confirmar faz um `INSERT ... SELECT` com `recorrencia_id`, tipo vindo da categoria e `NOT EXISTS` no mês, dentro de uma transação com `pg_advisory_xact_lock` por usuário (cliques simultâneos não duplicam). A data confirmada precisa estar dentro do mês, porque é assim que se sabe se o mês já foi lançado. A FK `lancamentos.recorrencia_id` é simples (não composta): o dono é conferido no `WHERE r.usuario_id = $1`.

**Entrada por foto (`/lancamentos/comprovante`).** OCR no próprio celular com `tesseract.js` (português; núcleo e idioma baixados da CDN jsDelivr no 1º uso e guardados em cache). [components/LeitorComprovante.tsx](components/LeitorComprovante.tsx) abre a câmera (`capture="environment"`) ou a galeria, reduz a foto e passa para cinza antes de ler. [lib/ocr-entrada.ts](lib/ocr-entrada.ts) é puro e testado: reconhece PIX/TED, holerite e recibo/NFS-e e extrai valor (em centavos), data, descrição e categoria sugerida. A foto não é enviada nem guardada (anexos estão fora do escopo); o resultado só preenche o `FormularioLancamento`, e quem salva é a action `criarLancamento` de sempre.

**Lançamento previsto.** `lancamentos.previsto = true`: ainda não aconteceu, fica FORA de saldo (`saldo_contas`), totais, dashboard, Análise/Excel/PDF e alertas (`lancamentos_suspeitos`); aparece à parte (seção "Previstos", "Previsto no mês", previsto por conta, aviso de vencidos). Só nasce previsto na criação (checkbox); `confirmarLancamento` vira realizado no mesmo registro (`UPDATE ... AND usuario_id = $2 AND previsto`), podendo ajustar valor, data e conta. Toda consulta de total real precisa de `NOT previsto`. Recriar uma view apaga `security_invoker`: rode `supabase.sql` de novo depois.

**PWA.** `app/manifest.ts`, ícones em `public/icones/` + `app/icon.png`/`app/apple-icon.png`, `viewport` com `themeColor` e `viewportFit: cover` em `app/layout.tsx`. `public/sw.js` (registrado só em produção por `components/RegistrarServiceWorker.tsx`) guarda apenas `public/offline.html` e mostra essa página quando a navegação falha — nunca guarda páginas nem dados. Ao mudar `sw.js`/`offline.html`, suba a versão em `CACHE`. Menu em `components/MenuPrincipal.tsx`: abaixo de 900px é um botão ☰ com gaveta lateral (Esc, toque no fundo e troca de página fecham; foco preso e devolvido), a partir de 900px fica sempre visível em linha; o "Sair" (Server Action) entra pela prop `rodape`. Testes em `testes/e2e/menu.spec.ts`, logo em `components/Logo.tsx` (também `public/logo.svg`).

**API HTTP (`api/`).** Projeto Node separado (Express 5 + `@supabase/supabase-js`, ESM, `package.json` próprio): `POST /lancamentos` grava direto no Supabase e responde 201 com `lancamento_id`. **Está SEM autenticação por decisão do usuário** (o token Bearer está no commit `d898e80`). Local, ouve só em `127.0.0.1`/`::1`; no Railway (detectado por `RAILWAY_ENVIRONMENT_NAME`) ou com `HOST=0.0.0.0`, ouve em `0.0.0.0` e fica aberta: qualquer um com a URL grava em nome de qualquer usuário. O serviço da API no Railway precisa de `api` como Root Directory (na raiz ele rodaria o app Next). `GET /health` responde nome e versão; `SUPABASE_KEY` tem de ser a service_role (a anon é revogada pelo `supabase.sql`). Repete as regras do `conferirDono` (conta/categoria do usuário, categoria ativa e do mesmo tipo); validação pura em `api/validacao.js`, testada com `node --test` (`cd api && npm test`). Configuração em `api/.env` (modelo em `api/.env.example`). Pedidos de teste (Thunder Client/Postman) em `api/thunder/`: a coleção usa `{{baseUrl}}` (modelo em `ambiente.example`). As pastas 1–2 não gravam; a 3 grava em dados reais. Não há banco de teste para ela: qualquer POST grava em dados reais.

**Formulários cliente** em `components/` usam `useActionState` + `useFormStatus` e recebem a action por prop ou importam de `actions.ts`.

## Ao testar pelo HTTP

- Como existe `app/loading.tsx`, a resposta começa a ser enviada antes do `notFound()`/`redirect()`: eles chegam com **HTTP 200** e o HTML do layout (menu incluso), com `NEXT_REDIRECT;replace;/login` ou a página "não encontrada" no corpo. Confira o corpo, não o status.
- POST de Server Action sem JavaScript precisa do cabeçalho `Origin` e dos campos ocultos `$ACTION_*` do form certo. O primeiro form da página é o "Sair" do menu, e a ordem dos forms no HTML não é a da tela.
