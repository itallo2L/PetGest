# PetGest — frontend

SPA do PetGest (React + TypeScript + Vite). Fala com **um de dois backends**,
escolhido no build pela variável `VITE_BACKEND` (T-16):

- `supabase` (padrão) — o **V0 em produção**: Supabase Auth + Postgres com Row
  Level Security, sem API própria.
- `api` — a **API do V1** (ASP.NET Core, em [`backend/`](../backend/README.md)),
  ainda não publicada. A produção troca para ela na virada da T-18.

As telas são as mesmas nos dois modos. Decisões em [`PLANOMVP.md`](../PLANOMVP.md),
etapas em [`ROADMAPV0.md`](../ROADMAPV0.md) e [`ROADMAPV1.md`](../ROADMAPV1.md).

## Rodar localmente

```bash
npm install
cp .env.example .env.local   # e preencha as chaves do Supabase
npm run dev                  # http://localhost:5183 — modo supabase
```

### Modo `api` (contra a API local)

Com o Postgres e a API rodando ([`backend/README.md`](../backend/README.md)):

```bash
npm run dev:api              # http://localhost:5183 — modo api
```

`npm run dev:api` (`vite --mode api`) lê `frontend/.env.api.local`, que você cria
uma vez com:

```
VITE_BACKEND=api
VITE_API_URL=/api
```

O Vite repassa `/api/*` para `http://localhost:5080` (proxy em
[`vite.config.ts`](vite.config.ts)): mesma origem, sem CORS. O seu `.env.local`
(Supabase) continua intacto e o `npm run dev` normal segue no Supabase.

### No celular (rede local, HTTPS)

A câmera do scanner só funciona em HTTPS. Para testar no celular contra a API local:

1. Crie `frontend/.env.lan.local` com as mesmas duas linhas do modo `api`.
2. Com a API rodando, `npm run dev:lan` — HTTPS com certificado local e acesso pela
   rede. O Vite mostra o endereço (`https://<ip>:5183`).
3. No celular, no **mesmo Wi-Fi**, abra o endereço e aceite o aviso de certificado
   uma vez (Chrome: *Avançado → Continuar*). Se o Windows perguntar, libere o
   Node.js no firewall em redes privadas.

Se a rede isolar os aparelhos (Wi-Fi corporativo/visitantes), use o cabo USB no
Android: depuração USB ligada, `npm run dev:api` e `adb reverse tcp:5183 tcp:5183`;
no celular, `http://localhost:5183` (o navegador trata `localhost` como seguro).

## Variáveis

| Variável | Modo | Valor |
|---|---|---|
| `VITE_BACKEND` | — | `supabase` (padrão, se ausente) ou `api`. Outro valor para o app no carregamento com a mensagem |
| `VITE_SUPABASE_URL` | supabase | Project URL do Supabase, só a base: `https://<ref>.supabase.co` (sem `/rest/v1`) |
| `VITE_SUPABASE_ANON_KEY` | supabase | Chave **pública** (`sb_publishable_…` ou `anon`) — Project Settings > API Keys |
| `VITE_API_URL` | api | Endereço da API. Em desenvolvimento, `/api` (proxy do Vite) |

Cada modo exige só as suas variáveis; sem elas o app para no carregamento com uma
mensagem dizendo qual falta. O build leva só o código do backend escolhido (o do
modo `api` não contém o cliente do Supabase).

> **Nunca** use a `service_role` nem uma `sb_secret_…` aqui ou na Vercel: elas
> ignoram o RLS. Tudo que começa com `VITE_` vai para o navegador.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Desenvolvimento na porta 5183 (modo do `.env.local`, normalmente supabase) |
| `npm run dev:api` | Desenvolvimento no modo `api` (lê `.env.api.local`) |
| `npm run dev:lan` | HTTPS na rede local, para o celular (lê `.env.lan.local`) |
| `npm run build` | Checagem de tipos (`tsc -b`) e build de produção em `dist/` |
| `npm test` | Testes de unidade (Vitest) — seleção do backend e cliente da API |
| `npm run lint` | Oxlint |
| `npm run preview` | Serve o `dist/` localmente |
| `npm run api:types` | Regera `src/shared/backend/api/schema.ts` a partir do OpenAPI da API local (`http://localhost:5080`). Rode quando um contrato da API mudar e versione o arquivo |

## Estrutura do backend no frontend

```text
src/shared/backend/
  index.ts        loadBackend() / getBackend() — único acesso das telas
  config.ts       validação de VITE_BACKEND / VITE_API_URL
  types.ts        interface Backend (auth, products, petshop) e tipos das telas
  errors.ts       BackendError (kind) — authErrors.ts traduz para as mensagens
  supabase/       implementação do V0 (Supabase Auth + Postgres/RLS)
  api/            implementação do V1: client.ts (sessão), auth.ts, catalog.ts,
                  schema.ts (tipos gerados do OpenAPI)
```

As telas nunca importam `supabase-js` nem fazem `fetch` direto: usam
`getBackend()`.

### Sessão no modo `api`

- Token de acesso só em memória; refresh token e usuário (`id`, `email`) no
  `localStorage` (`petgest.auth.*`).
- Ao recarregar, o app usa o usuário salvo e renova a sessão na primeira chamada.
- `401` → uma renovação para todas as chamadas que estiverem esperando (e entre
  abas, via Web Locks) e uma nova tentativa. Duas renovações com o mesmo token
  derrubariam a sessão (detecção de reuso da API).
- Sair revoga o refresh token na API; sair numa aba tira o usuário das outras.

## Deploy (Vercel)

- Root Directory `frontend`; build, saída (`dist`) e rewrite de SPA definidos em
  [`vercel.json`](vercel.json).
- Push na `dev` → deploy de **prévia**. `main` → **produção**. A `main` só
  recebe o que foi validado na `dev` (PR `dev` → `main`).
- Variáveis na Vercel (Production e prévia da `dev`): `VITE_SUPABASE_URL` e
  `VITE_SUPABASE_ANON_KEY`. **`VITE_BACKEND` não é definida** — produção e prévias
  ficam no Supabase até a T-18, que define `VITE_BACKEND=api` e `VITE_API_URL`.
  Como `VITE_*` entra no build, mudar um valor exige novo deploy (Redeploy).
- Câmera (scanner) só funciona em HTTPS: no celular, use a URL da Vercel ou o
  `dev:lan`, não `http://<ip>`.

## Supabase

- Schema, RLS e a função `signup_petshop` em [`supabase/schema.sql`](../supabase/schema.sql);
  roteiro de teste do RLS em [`supabase/tests/rls_test.sql`](../supabase/tests/rls_test.sql).
- Confirmação de e-mail **desligada** durante os testes do V0 — reativar antes
  de clientes reais.
- O plano gratuito **pausa o projeto após ~7 dias sem uso**; se o app parar de
  carregar dados, reative o projeto no painel do Supabase.
