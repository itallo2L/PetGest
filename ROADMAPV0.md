# ROADMAPV0 — Roadmap de implementação do V0

> Quebra o roadmap de `PLANOMVP.md` §3.7 em conjuntos de tarefas
> numerados. Cada tarefa `T-0X` deve virar (ou já é) uma change do
> `openspec/` com o **mesmo número no nome da pasta**, para rastrear
> proposta → design → specs → tasks de cada etapa sem ambiguidade:
>
> ```
> openspec/changes/T-0X-<slug-da-tarefa>/
> ```
>
> Exemplo: `T-01` já existe como
> `openspec/changes/T-01-scaffold-frontend-scanner-spike/` — ao criar as
> próximas changes, prefixar a pasta com `T-02-`, `T-03-` etc.

## Ordem e dependências

```
T-01 ──> T-02 ──> T-03 ──┬──> T-05 ──> T-06 ──> T-07 ──┐
                          └──> T-04 ─────────────────────┴──> T-08 ──> T-09 ──> T-10
```

- T-01 (spike do scanner) e T-02 (schema) já têm change em `openspec/`.
- T-02 e T-03 (Supabase) podem começar em paralelo com T-04 (design
  system), mas nada de T-05 em diante avança sem T-01+T-02+T-03 prontos.
- T-09 (deploy) e T-10 (teste de campo) fecham o V0.

---

## T-01 — Scaffold frontend com scanner spike

**Status:** em andamento — já existe a change
`openspec/changes/T-01-scaffold-frontend-scanner-spike/`.

Cria a pasta `frontend/` definitiva (React + TS + Vite) e valida, isolado
de tudo o mais, se o `barcode-detector` lê um EAN-13 de forma confiável em
Android e iPhone reais. É o risco técnico mais caro do projeto — por isso
vem antes de auth, banco e telas.

- Ref: `PLANOMVP.md` §2.2 (scanner) e §3.7 passo 4 (só a parte de criar
  `frontend/` com Vite+React+TS e instalar `barcode-detector` — o
  `@supabase/supabase-js` desse mesmo passo fica para T-03).
- Entregável: URL HTTPS na Vercel com uma tela única de spike, testada em
  celular real, motor (nativo/WASM) e `firstReadMs` registrados.

## T-02 — Setup do Supabase (schema, RLS, signup_petshop)

**Status:** concluída no Supabase (2026-09-22) — projeto criado em São
Paulo, `supabase/schema.sql` aplicado e `supabase/tests/rls_test.sql`
retornando "RLS OK". Change arquivada em
`openspec/changes/archive/2026-09-22-T-02-supabase-schema-rls/`; spec
principal em `openspec/specs/tenant-data/`.

Cria o projeto no Supabase e aplica a base de dados que sustenta o V0
inteiro.

- Criar o projeto Supabase (tier gratuito); guardar `Project URL` e
  `anon key`.
- Rodar o schema completo (`petshops`, `profiles`, `products`, índice
  único `(petshop_id, ean)`) — SQL pronto em `PLANOMVP.md` §3.2.
- Ativar RLS nas três tabelas e aplicar as políticas (§3.2).
- Criar a função `signup_petshop` (`security definer`) (§3.2).
- Versionar tudo em `supabase/schema.sql` no repositório.
- Ref: `PLANOMVP.md` §3.1, §3.2, §3.7 passos 1–2.

## T-03 — Configuração de autenticação (Supabase Auth)

**Status:** concluída (2026-09-23) — provedor e-mail/senha ativo com
"Confirm email" desligado, `@supabase/supabase-js` instalado e
`frontend/src/shared/supabaseClient.ts` criado (variáveis em
`frontend/.env.local`, modelo em `frontend/.env.example`). Verificado
contra o projeto real: cadastro devolve sessão na hora, e-mail repetido e
senha errada recusados, conta sem petshop não vê dados. A persistência da
sessão após recarregar a página fica para verificar em T-05, quando houver
tela de login. Change: `openspec/changes/T-03-supabase-auth-client/`.

Prepara o provedor de auth para os fluxos reais de login/cadastro que
T-05 vai consumir.

- Configurar o provedor de e-mail/senha no Auth do Supabase.
- Desativar a exigência de confirmação de e-mail por enquanto (reavaliar
  antes de produção — ver `PLANOMVP.md` §3.9).
- Instalar `@supabase/supabase-js` em `frontend/` e criar
  `shared/supabaseClient.ts` (único client do app).
- Ref: `PLANOMVP.md` §3.3, §3.7 passo 3.

## T-04 — Porte do design system e estrutura de features

Porta o visual do protótipo (`style.css`) para dentro do `frontend/` já
criado em T-01, e organiza as pastas por feature antes de portar telas.

- Portar as variáveis CSS (cores, espaçamento, tipografia, sprite de
  ícones) do `style.css` do protótipo para `frontend/src/index.css` /
  tokens.
- Criar a estrutura `frontend/src/features/{auth,scanner,products,petshop}/`
  e `shared/ui/` conforme `CLAUDE.md` / `PLANOMVP.md` §3.5.
- Não portar lógica ainda — só estilo e esqueleto de pastas.
- Ref: `PLANOMVP.md` §3.5, §3.8 (tokens visuais a reaproveitar).

## T-05 — Login, cadastro de petshop e proteção de rota

Primeira tela real conectada ao Supabase — substitui a simulação do
protótipo.

- Tela de login usando `supabase.auth.signInWithPassword`.
- Logout usando `supabase.auth.signOut`.
- Proteção de rota via `supabase.auth.onAuthStateChange` (sem sessão →
  tela de login).
- Fluxo de "criar conta": `supabase.auth.signUp` seguido de
  `supabase.rpc('signup_petshop', ...)` no mesmo formulário.
- Depende de: T-03 (client e provedor configurados) e T-04 (telas com
  estilo para portar).
- Ref: `PLANOMVP.md` §3.3, §3.7 passos 6–7.

## T-06 — Tela de Produtos (CRUD real)

Troca o array de produtos em memória do protótipo por operações reais no
Supabase.

- Listagem, busca e filtro por categoria consultando `products` (RLS
  isola por petshop automaticamente — nunca filtrar `petshop_id` na
  query).
- Cadastro e edição manual de produto (nome, categoria, preço, ean
  opcional, `source: 'manual'`).
- Ainda **sem** o botão "Escanear" funcional — isso é T-07.
- Depende de: T-05 (usuário autenticado e `petshop_id` disponível via
  sessão).
- Ref: `PLANOMVP.md` §3.2 (schema), §3.7 passo 8, §3.8 (o que manter/
  remover da tela do protótipo).

## T-07 — Scanner real integrado ao cadastro de produto

Junta o resultado validado em T-01 (câmera + `barcode-detector`) com a
tela de Produtos de T-06.

- Botão "Escanear" abre a câmera real (`getUserMedia` + `barcode-detector`,
  reaproveitando `createDetector`/hook validados em T-01).
- Consulta `products` por `(petshop_id, ean)` via `supabase-js` ao ler um
  código.
- Dois desfechos apenas: código já cadastrado no petshop → abre para
  edição; código não encontrado → preenche só o campo `ean`, resto
  manual. **Sem** base de referência externa de produtos.
- Entrada manual do código continua funcionando como alternativa à
  câmera.
- Depende de: T-01 (motor validado em campo) e T-06 (tela de produtos
  existente).
- Ref: `PLANOMVP.md` §3.4, §3.9 (riscos do scanner).

## T-08 — Tela de Configurações (dados da loja)

- Formulário de "Dados da loja" (nome, e-mail, telefone) lendo/gravando
  `petshops` via Supabase, restrito ao petshop do usuário logado (RLS).
- Sem estoque mínimo, multiplicador de sugestão de compra ou alertas —
  fora do escopo do V0.
- Depende de: T-05 (sessão/petshop_id disponível).
- Ref: `PLANOMVP.md` §3.8 (o que manter em Configurações).

## T-09 — Deploy do app completo (Vercel + Supabase)

- Conectar o repositório na Vercel (build Vite, root `frontend/`).
- Configurar variáveis de ambiente `VITE_SUPABASE_URL` e
  `VITE_SUPABASE_ANON_KEY`.
- Confirmar que nenhuma *service role key* do Supabase vai para o
  frontend/Vercel.
- Depende de: T-02 a T-08 (schema aplicado e todas as telas prontas).
- Ref: `PLANOMVP.md` §3.6, §3.7 passo 10.

## T-10 — Teste ponta a ponta em campo

- Testar login, cadastro de petshop, scanner e cadastro/edição de
  produto em celular real (Android e iPhone), contra a URL publicada
  (não localhost) — HTTPS, câmera real, latência de rede real.
- Repetir os testes de erro do scanner (permissão negada, código
  desconhecido) e de auth (senha errada, e-mail inválido).
- Fecha o V0: qualquer problema encontrado aqui vira ajuste pontual nas
  tarefas anteriores, não uma nova tarefa.
- Depende de: T-09.
- Ref: `PLANOMVP.md` §3.7 passo 11, `CLAUDE.md` §Testes.
