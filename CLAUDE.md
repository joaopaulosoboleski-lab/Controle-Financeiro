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
npm run db:start            # liga o PostgreSQL local (porta 5433, dados em %USERPROFILE%\caderneta-pgdata)
npm run db:stop
node --env-file=.env.local scripts/definir-senha.mjs <email> <senha>   # define a senha de um usuário
```

Não há testes automatizados nem linter configurados.

## Banco de dados

- Scripts SQL na raiz, nesta ordem: `schema.sql` → `dados.sql` → `ajustar_sequencias.sql` → `qualidade.sql` → `admin.sql` (adiciona `usuarios.admin` e torna o usuário 1 admin; idempotente) → `supabase.sql` (este só no Supabase: liga RLS sem políticas e revoga `anon`/`authenticated`; o app usa o usuário dono, que ignora o RLS).
- Os `senha_hash` de `dados.sql` são fictícios: para entrar com um usuário de exemplo é preciso rodar `definir-senha.mjs`.
- `DATABASE_URL` em `.env.local` decide o banco. **Hoje aponta para o Supabase (dados reais)**, não para o local. Escrever nele afeta o ambiente de verdade.
- Supabase usa o *transaction pooler* (Supavisor): as conexões do servidor são compartilhadas entre clientes. **Nunca rode `SET` de sessão** (ex.: `SET default_transaction_read_only = on`): ele fica preso na conexão do pooler e quebra o app para todos. Para leituras seguras use `BEGIN READ ONLY … ROLLBACK`.
- [lib/db.ts](lib/db.ts) tira o `?pgbouncer=true` da URL e, para bancos não locais, exige `certs/supabase-ca.crt`. Scripts avulsos precisam fazer o mesmo.

## Arquitetura

**Modelo (schema.sql).** Toda tabela tem `usuario_id`. Lançamentos e recorrências referenciam conta e categoria por **FK composta** `(id, usuario_id)`, então o banco impede cruzar donos (R8). Não há `ON DELETE CASCADE` (R9): categoria em uso se aposenta com `ativa = false`. O saldo não é guardado; vem da view `saldo_contas` (R5). Dinheiro é `NUMERIC(10,2)`, valor sempre positivo e o sinal vem de `tipo` (`entrada`/`saida`).

**Sessão e acesso.** [lib/sessao.ts](lib/sessao.ts): cookie `sessao` = `<usuario_id>.<HMAC-SHA256 com SESSION_SECRET>`. Não há middleware/proxy: a proteção é `exigirUsuario()`, que redireciona para `/login`. Senhas: scrypt no formato `scrypt$<sal>$<hash>` ([lib/senha.ts](lib/senha.ts)).

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

**Formulários cliente** em `components/` usam `useActionState` + `useFormStatus` e recebem a action por prop ou importam de `actions.ts`.

## Ao testar pelo HTTP

- Como existe `app/loading.tsx`, a resposta começa a ser enviada antes do `notFound()`/`redirect()`: eles chegam com **HTTP 200** e o HTML do layout (menu incluso), com `NEXT_REDIRECT;replace;/login` ou a página "não encontrada" no corpo. Confira o corpo, não o status.
- POST de Server Action sem JavaScript precisa do cabeçalho `Origin` e dos campos ocultos `$ACTION_*` do form certo. O primeiro form da página é o "Sair" do menu, e a ordem dos forms no HTML não é a da tela.
