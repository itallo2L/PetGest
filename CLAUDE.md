# PetGest

SaaS de gestão para petshops. V0: cadastro de produto via leitor de código de
barras + dados da loja. Projeto solo, sem equipe.

## Estado atual do repositório

O que existe hoje em `index.html` / `script.js` / `style.css` é um
**protótipo navegável, sem backend** — login não valida credenciais de
verdade, o scanner sorteia um de três resultados fake (não liga a câmera),
produtos vivem num array em memória. Ver `README.md` para o detalhe de
cada tela.

O corte das telas para o escopo do V0 (Login, Produtos, Configurações)
já foi commitado e enviado ao repositório remoto — esse é o ponto de
partida atual para a migração para React.

## Fluxo de branches

- `dev` é onde toda funcionalidade nova ou correção é desenvolvida.
  Trabalhar sempre a partir dela, nunca direto em `main`.
- `main` só recebe o que já foi validado em `dev` — não commitar nem
  abrir PR direto para `main`.

## Documentos de decisão (ler antes de propor mudanças de arquitetura)

- `PLANOMVP.md` — plano único de stack e entregáveis, com duas fases:
  - **Seção 3 (V0, ativa agora):** Supabase + Vercel — schema SQL
    completo, políticas de RLS, roadmap de migração do protótipo.
  - **Seção 4 (futura, pós-V0):** ASP.NET Core + Identity/JWT + Azure App
    Service — reservada para quando o produto justificar uma API própria
    (ver gatilhos na seção 4.5). Não seguir essa stack agora.
- `ROADMAPV0.md` — roadmap do V0 quebrado em tarefas numeradas (`T-01`,
  `T-02`, ...). Cada change em `openspec/changes/` deve prefixar a pasta
  com o número da tarefa correspondente (`T-0X-<slug>`) para rastrear
  proposta/design/specs/tasks de cada etapa.

## Stack alvo do V0 (ver `PLANOMVP.md` §2 e §3 para o detalhe completo)

- Frontend: React + TypeScript + Vite (SPA), sem Next.js
- Sem API própria de longa duração: Supabase é todo o "backend"
  (Auth + Postgres + Row Level Security)
- Scanner: pacote `barcode-detector` (API nativa no Android/Chrome,
  fallback WASM no Safari/iOS — a Apple não implementa a API nativa)
- Deploy: Vercel (frontend), projeto Supabase (banco/auth)
- ASP.NET Core + Identity/JWT + Azure **não** é a stack do V0 — é a
  arquitetura da fase futura (`PLANOMVP.md` §4), reservada para quando o
  produto justificar uma API própria.

## Estrutura de pastas alvo (ainda não migrada)

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
supabase/
  schema.sql      (tabelas + RLS + função signup_petshop, versionado)
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
