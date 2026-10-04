# PetGest

SaaS de gestão para petshops. V0: cadastro de produto via leitor de código de
barras + dados da loja. Projeto solo, sem equipe.

## Estado atual do repositório

- `frontend/` — o app do V0 (React + TypeScript + Vite), em produção em
  `pet-gest.vercel.app`: login/cadastro reais no Supabase Auth, scanner
  com câmera (`barcode-detector`), produtos e dados da loja persistidos
  no Supabase. Instruções de execução e variáveis de ambiente em
  `frontend/README.md`.
- `supabase/` — `schema.sql` (tabelas, RLS, `signup_petshop`) e
  `tests/` (testes das políticas de RLS).
- `openspec/` — specs vigentes em `openspec/specs/` e uma change por
  tarefa dos roadmaps. Arquivadas até agora: T-02, T-03, T-11, T-12, T-13 e T-14; as changes
  T-01, T-04 a T-10 e T-15 ainda estão abertas em `openspec/changes/`.
- `index.html` / `script.js` / `style.css` na raiz — o **protótipo
  navegável original**, sem backend (login fake, scanner que sorteia
  resultados, produtos em memória). Serviu de referência visual para o
  `frontend/`; não é mais onde o desenvolvimento acontece.
- `backend/` — API do **V1** (ASP.NET Core, .NET 10), criada na T-12:
  `/health`, CORS, OpenAPI e, desde a T-13, o modelo de dados do V0 em
  EF Core (migrations `V0Schema` e `ProductSourceAi`) com isolamento por
  petshop feito pela API (claims `sub`/`petshop_id`, filtros globais e
  `TenantWriteGuard`) e, desde a T-14, contas do Identity com sessão por
  JWT + refresh token (`/auth/*`), todo endpoint protegido por padrão, e,
  desde a T-15, produtos e loja (`/products`, `/petshop`). O frontend ainda
  fala com o Supabase até a T-16. Postgres 17 local via Docker Compose e testes em `Api.Tests/`,
  rodados pelo GitHub Actions (`.github/workflows/backend.yml`). Não é
  publicada nem toca a produção. Instruções em `backend/README.md`.

## Fase atual: V1 em desenvolvimento, produção no V0

- **Produção** (`pet-gest.vercel.app`) continua no **V0** (Supabase Auth +
  Postgres + RLS, frontend na Vercel) até a virada da T-18. Tudo o que
  este arquivo diz sobre o V0 (escopo, RLS, testes) segue valendo para a
  produção enquanto ela estiver no V0.
- **V1 em desenvolvimento** (T-11 aprovada em 2026-09-29, ver
  `openspec/changes/T-11-v1-entry-decisions/design.md`): API própria em
  ASP.NET Core (.NET 10) + Identity/JWT sobre o **Postgres do projeto
  Supabase**, que passa a ser só banco; deploy da API no Azure App Service
  (Brazil South). Gatilho: cadastro por foto/voz + IA.
- **T-10 continua aberta em paralelo** (falta o teste no iPhone).
  Defeitos do V0 são corrigidos no V0, e a T-18 não começa antes de a
  T-10 ser arquivada.

## Fluxo de branches

- `dev` é onde toda funcionalidade nova ou correção é desenvolvida.
  Trabalhar sempre a partir dela, nunca direto em `main`.
- `main` só recebe o que já foi validado em `dev` — não commitar nem
  abrir PR direto para `main`.

## Documentos de decisão (ler antes de propor mudanças de arquitetura)

- `PLANOMVP.md` — plano único de stack e entregáveis, com duas fases:
  - **Seção 3 (V0, ativa agora):** Supabase + Vercel — schema SQL
    completo, políticas de RLS, roadmap de migração do protótipo.
  - **Seção 4 (V1, em desenvolvimento):** ASP.NET Core + Identity/JWT +
    Azure App Service, sobre o Postgres do Supabase (decisões da T-11).
    Vale para o código novo do V1; a produção só muda na T-18.
- `ROADMAPV0.md` — roadmap do V0 quebrado em tarefas numeradas (`T-01`,
  `T-02`, ...). Cada change em `openspec/changes/` deve prefixar a pasta
  com o número da tarefa correspondente (`T-0X-<slug>`) para rastrear
  proposta/design/specs/tasks de cada etapa.
- `ROADMAPV1.md` — roadmap do V1 (T-11 a T-22; a T-22 saiu da T-14 e vem
  antes da T-18), mesma convenção de pastas (`T-1X-<slug>`).

## Stack alvo do V0 (ver `PLANOMVP.md` §2 e §3 para o detalhe completo)

- Frontend: React + TypeScript + Vite (SPA), sem Next.js
- Sem API própria de longa duração: Supabase é todo o "backend"
  (Auth + Postgres + Row Level Security)
- Scanner: pacote `barcode-detector` (API nativa no Android/Chrome,
  fallback WASM no Safari/iOS — a Apple não implementa a API nativa)
- Deploy: Vercel (frontend), projeto Supabase (banco/auth)
- ASP.NET Core + Identity/JWT + Azure **não** é a stack do V0 (que está
  em produção) — é a stack do V1, em desenvolvimento desde a T-11
  (`PLANOMVP.md` §4, `ROADMAPV1.md`).

## Estrutura de pastas

```
frontend/
  src/
    features/
      auth/       (login, cadastro, sessão, proteção de rota)
      scanner/    (câmera + barcode-detector)
      products/   (listagem, cadastro/edição)
      petshop/    (dados da loja)
    shared/
      supabaseClient.ts   (único client Supabase do app — sempre usar este)
      ui/                 (componentes e CSS compartilhados: shell, modal, toast, tokens)
supabase/
  schema.sql      (tabelas + RLS + função signup_petshop, versionado)
  tests/          (rls_test.sql — roteiro de teste das políticas)
backend/          (V1 — deploy independente do frontend, PLANOMVP.md §4.3)
  Api/            (projeto único ASP.NET Core, minimal APIs)
    Endpoints/    (um arquivo por área: MapXxxEndpoints())
    Services/     (regras de negócio)
    Data/         (AppDbContext, isolamento por petshop, Entities/,
                   Configurations/ com os nomes do schema do V0, Migrations/)
    Models/       (DTOs de request/response)
  Api.Tests/      (xUnit + WebApplicationFactory, contra Postgres real;
                   Data/ com isolamento, invariantes e compatibilidade com o V0)
  docker-compose.yml  (Postgres 17 de desenvolvimento, porta 5450)
```

## Modelo de dados (Supabase/Postgres)

Três tabelas: `petshops`, `profiles` (liga `auth.users` a um petshop),
`products`. RLS ativado nas três — **nunca filtrar `petshop_id` manualmente
nas queries**, as políticas já isolam por petshop logado.

Cadastro de petshop + usuário é atômico via função SQL
`signup_petshop` (`security definer`) — não criar uma Vercel Function
para isso, a decisão já foi tomada em `PLANOMVP.md` §3.1.

Índice único composto `(petshop_id, ean)`, ignorando `ean IS NULL` — mesmo
EAN pode repetir entre petshops diferentes, não dentro do mesmo.

## Escopo do V0 — não adicionar de volta

Fora de escopo, mesmo que o protótipo original (antes do corte) tivesse:
estoque, estoque mínimo, fornecedores, relatórios, dashboard de
indicadores, situação (ativo/inativo), preço de custo, unidade de medida,
código interno/SKU. Ver `PLANOMVP.md` §3.8 para o motivo de cada corte.

Produto no V0 tem só: nome, categoria, preço, ean (opcional), source
(`barcode` | `manual`).

Scanner no V0 real tem só dois desfechos: código já cadastrado naquele
petshop (abre para edição), ou não encontrado (preenche só o código,
completa manualmente). Não existe base de referência externa de produtos.

## Testes

Login/scanner dependem de câmera e HTTPS — sempre validar em celular real
(Android e iPhone), nunca só em localhost/desktop.
