# PetGest — frontend

SPA do PetGest V0 (React + TypeScript + Vite). O "backend" é o Supabase
(Auth + Postgres + Row Level Security); não há API própria. Decisões de
arquitetura em [`PLANOMVP.md`](../PLANOMVP.md) e etapas em
[`ROADMAPV0.md`](../ROADMAPV0.md).

## Rodar localmente

```bash
npm install
cp .env.example .env.local   # e preencha os dois valores
npm run dev                  # http://localhost:5183
```

`.env.local` (não versionado):

| Variável | Valor |
|---|---|
| `VITE_SUPABASE_URL` | Project URL do Supabase, só a base: `https://<ref>.supabase.co` (sem `/rest/v1`) |
| `VITE_SUPABASE_ANON_KEY` | Chave **pública** (`sb_publishable_…` ou `anon`) — Project Settings > API Keys |

Sem as duas, o app para no carregamento com uma mensagem dizendo qual falta.

> **Nunca** use a `service_role` nem uma `sb_secret_…` aqui ou na Vercel: elas
> ignoram o RLS. Tudo que começa com `VITE_` vai para o navegador. A chave
> pública é segura porque quem isola os dados de cada petshop é o RLS do banco.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento na porta 5183 |
| `npm run build` | Checagem de tipos (`tsc -b`) e build de produção em `dist/` |
| `npm run lint` | Oxlint |
| `npm run preview` | Serve o `dist/` localmente |

## Deploy (Vercel)

- Root Directory `frontend`; build, saída (`dist`) e rewrite de SPA definidos em
  [`vercel.json`](vercel.json).
- Push na `dev` → deploy de **prévia**. `main` → **produção**. A `main` só
  recebe o que foi validado na `dev` (PR `dev` → `main`).
- Variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` cadastradas na Vercel
  em Production e na prévia da `dev`. Como `VITE_*` entra no build, mudar um
  valor exige novo deploy (Redeploy).
- Câmera (scanner) só funciona em HTTPS: teste no celular pela URL da Vercel,
  não pelo IP da máquina.

## Supabase

- Schema, RLS e a função `signup_petshop` em [`supabase/schema.sql`](../supabase/schema.sql);
  roteiro de teste do RLS em [`supabase/tests/rls_test.sql`](../supabase/tests/rls_test.sql).
- Confirmação de e-mail **desligada** durante os testes do V0 — reativar antes
  de clientes reais.
- O plano gratuito **pausa o projeto após ~7 dias sem uso**; se o app parar de
  carregar dados, reative o projeto no painel do Supabase.
