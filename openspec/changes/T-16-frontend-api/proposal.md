## Why

A API do V1 já faz tudo o que o V0 faz: contas e sessão (T-14), produtos e loja (T-15). Mas o frontend ainda fala direto com o Supabase em 15 pontos. Para a virada da T-18 ser só configuração, o frontend precisa saber falar com a API sem mudar nenhuma tela. Isso tem de acontecer **sem tirar a produção do V0**: a `dev` continua indo para a `main` (as correções da T-10 seguem normais) e as prévias da Vercel continuam funcionando até a API ser publicada (T-17).

## What Changes

- **Backend escolhido por configuração (decisão do usuário):**
  - a variável `VITE_BACKEND` (`supabase`, o padrão, ou `api`) decide no build com quem o app fala;
  - produção e prévias seguem em `supabase` até a T-18, que só troca a variável na Vercel, e o rollback é trocar de volta;
  - valor inválido, ou `api` sem `VITE_API_URL`, para o app no carregamento com uma mensagem que nomeia a variável, como hoje com as chaves do Supabase.
- **Uma interface de backend** (sessão, produtos e loja) usada por todas as telas, com duas implementações:
  - **Supabase:** o código de hoje, movido sem mudar comportamento;
  - **API:** um cliente HTTP novo, com tipos gerados do OpenAPI da API.

  As telas deixam de importar `supabaseClient`, `productsApi` e `petshopApi` direto. Os erros dos dois backends viram um erro comum, e as mensagens em português continuam as mesmas.
- **Sessão com a API** (design da T-14):
  - token de acesso em memória e refresh token no `localStorage`;
  - renovação automática ao receber `401`, uma de cada vez — chamadas simultâneas esperam a mesma renovação, para não acionar a detecção de reuso;
  - sincronização entre abas; "Sair" revoga a sessão na API;
  - o cadastro vira uma chamada só (`/auth/signup`), e concluir o cadastro da loja usa `POST /petshop` seguido de renovação da sessão.
- **Código repetido no produto:** no modo API, a mensagem usa o produto dono que vem no `409 ean_taken`.
- **Desenvolvimento local no modo API:** o Vite repassa `/api` para a API local. Há um modo HTTPS na rede local para rodar o roteiro da T-10 no celular contra a API local, o critério de paridade do roadmap.
- **Testes de unidade** (Vitest) do cliente da API: renovação em voo único, sincronização entre abas, tradução de erros. É o primeiro teste automatizado do frontend.
- **Fica para depois da T-18** (registrado no `ROADMAPV1.md`): remover o caminho do Supabase e o `@supabase/supabase-js`. O roadmap pedia isso na T-16, mas, com a chave de configuração, o código do Supabase é o rollback da virada.

## Capabilities

### New Capabilities
- `frontend-backend`: como o frontend se conecta ao backend — escolha do backend por configuração, sessão com a API (persistência, renovação em voo único, sincronização entre abas, saída), tradução dos erros da API para as mensagens do app e build sem o código do backend que não está em uso.

### Modified Capabilities
<!-- nenhuma — auth, products, product-scanning, store-settings e app-shell descrevem o que o usuário vê, e isso não muda: valem igual nos dois modos (é o critério de paridade). A exigência da spec auth sobre "conectar só com a chave pública" continua valendo para o modo supabase. -->

## Impact

- **Frontend:**
  - novo `src/shared/backend/` (interface, seleção, erro comum, implementações `supabase/` e `api/`, tipos gerados);
  - alterados `SessionProvider`, `sessionContext`, `LoginPage`, `SignupPage`, `CompleteSignupPage`, `Sidebar`, `authErrors`, `ProductsPage`, `ProductFormModal` e `SettingsPage`;
  - removidos `productsApi.ts` e `petshopApi.ts` (o conteúdo vai para a implementação Supabase);
  - `vite.config.ts` com o proxy e o modo HTTPS; `.env.example` e `README.md`.
- **Dependências novas (dev):** `vitest`, `openapi-typescript`, `@vitejs/plugin-basic-ssl`.
- **Backend:** sem mudança. O CORS da T-12 já aceita `localhost:5183`, e em desenvolvimento o proxy dispensa CORS.
- **Vercel:** nenhuma variável nova obrigatória (`VITE_BACKEND` ausente = `supabase`); a prévia da `dev` continua no Supabase.
- **Documentos:** `ROADMAPV1.md` (status da T-16; T-18 troca `VITE_BACKEND`/`VITE_API_URL` e remove o caminho do Supabase depois da observação) e `CLAUDE.md`.
- **Produção:** nenhum efeito enquanto `VITE_BACKEND` não for `api`.
