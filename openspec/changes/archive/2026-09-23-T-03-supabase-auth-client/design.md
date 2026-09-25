## Context

Motivação em `proposal.md`. Requisitos em `specs/auth/spec.md`.

- Projeto Supabase já existe (T-02, `sa-east-1`) com `schema.sql` aplicado; o RLS de `tenant-data` já garante que conta sem petshop não vê nada.
- `frontend/` (T-01) é Vite + React 19 + TS, `tsconfig.app.json` com `types: ["vite/client"]`, sem `vite-env.d.ts` e sem pasta `shared/`. O app hoje é só o spike do scanner, publicado na Vercel.
- `.gitignore` da raiz ignora `.env*`; o de `frontend/` ignora `*.local`.
- Variáveis `VITE_*` são embutidas no bundle na hora do build — são públicas por definição. A chave pública do Supabase é segura no navegador porque quem protege os dados é o RLS (`PLANOMVP.md` §3.6).

## Goals / Non-Goals

**Goals:**
- Um único ponto de criação do client, importável por todas as features a partir de T-05.
- Erro de configuração aparece no primeiro uso, com o nome da variável que falta.
- Configuração do Auth verificada contra o projeto real antes de existir tela.

**Non-Goals:**
- Provider React / contexto de sessão — T-05 decide como expor a sessão às telas.
- Testes automatizados no repositório para o client (não há runner de testes no `frontend/` ainda; não vale introduzir um só para isso).

## Decisions

### D1. Client como singleton de módulo em `shared/supabaseClient.ts`
`createClient(url, key)` executado uma vez no carregamento do módulo e exportado como `supabase`. Mantém as opções padrão de auth do `supabase-js` (`persistSession`, `autoRefreshToken` ligados; sessão em `localStorage`), que já atendem ao requisito de sessão persistida.
Alternativa descartada: criar o client dentro de um Provider React — duplicaria instâncias em Strict Mode/HMR e contraria a regra do `CLAUDE.md` de um só client importado de `shared/`.

### D2. Falhar cedo quando faltar variável
O módulo lê `import.meta.env.VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` e lança `Error` nomeando a(s) variável(is) ausente(s) antes de chamar `createClient`.
Alternativa descartada: só avisar no console e seguir — o `createClient` com URL vazia gera erros de rede difíceis de relacionar com a causa, principalmente no celular, onde não há console à mão.
Consequência: enquanto nada importar o módulo (caso do spike atual), a ausência das variáveis não afeta o app nem o deploy.

### D3. Manter o nome `VITE_SUPABASE_ANON_KEY` mesmo se o painel mostrar "Publishable key"
O painel do Supabase pode exibir a chave pública como `anon` (formato JWT, legado) ou como *publishable key* (`sb_publishable_...`); o `supabase-js` aceita as duas no mesmo parâmetro. O nome da variável segue `PLANOMVP.md` §3.6 e `ROADMAPV0.md` T-09 para não espalhar renomeações. Regra prática: usar a chave pública que o painel oferecer; **nunca** a `service_role` nem uma *secret key* (`sb_secret_...`).

### D4. Client sem tipos do banco por enquanto
`createClient` sem o genérico `Database`. Gerar tipos (`supabase gen types`) exige Supabase CLI autenticada; tipos escritos à mão derivariam do `schema.sql`. Como T-03 não faz nenhuma query, a tipagem entra em T-06, junto das primeiras consultas a `products`.

### D5. `.env.example` versionado, valores em `.env.local`
`frontend/.env.example` com as duas chaves vazias documenta o que é necessário; o `.gitignore` da raiz ganha `!.env.example`. Valores reais em `frontend/.env.local` (já ignorado por `.env*` e `*.local`). `vite-env.d.ts` declara `ImportMetaEnv` com as duas variáveis como `string` para o TypeScript acusar erro de digitação no nome.

### D6. Verificação por script descartável, fora do repositório
Um script Node no scratchpad da sessão importa `@supabase/supabase-js` do `frontend/node_modules`, lê `frontend/.env.local` e roda contra o projeto real:
1. `signUp` com e-mail descartável → `data.session` não nulo (prova que a confirmação está desligada).
2. `signUp` repetido com o mesmo e-mail → sem conta nova.
3. `signInWithPassword` com senha errada → erro de credenciais; com a certa → sessão.
4. `select` em `petshops` e `products` com essa sessão → zero linhas.

Depois, o usuário apaga a conta de teste em Authentication > Users (o script não tem permissão para isso — só a chave pública — e deve continuar assim).
Alternativa descartada: página de teste no app — seria código a remover em T-05. Persistência da sessão após recarregar (requisito "Sessão persistida") é comportamento padrão do client e é verificada no navegador em T-05, quando existir tela de login.

## Risks / Trade-offs

- [Confirmação de e-mail desligada permite contas com e-mail de terceiros ou inexistente] → aceitável só em fase de testes; reativar antes de clientes reais (`PLANOMVP.md` §3.9) e, nesse momento, configurar Site URL / Redirect URLs com o domínio da Vercel.
- [Chave errada colada no `.env.local` (secret em vez de pública)] → D3 + tarefa de conferência que procura `service_role`/`sb_secret_` nos arquivos versionados e no `dist/`.
- [Variáveis `VITE_*` são fixadas no build] → mudar a chave exige novo deploy; registrar em T-09 ao configurar a Vercel.
- [Script de verificação deixa conta de teste no projeto] → tarefa explícita para o usuário apagar; conta sem petshop não vê dados de ninguém (RLS de T-02).
- [Tamanho mínimo de senha padrão do Supabase (6)] → mantido no V0; a mensagem de erro do Supabase chega à tela em T-05. Reavaliar junto com a confirmação de e-mail.

## Migration Plan

Sem migração de dados. Rollback: desinstalar `@supabase/supabase-js`, remover os arquivos novos; no painel, reativar "Confirm email". Nada em produção depende do client ainda.
