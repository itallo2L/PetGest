## Context

Motivação em `proposal.md`; comportamento exigido em `specs/frontend-backend/spec.md`. As telas continuam regidas pelas specs do V0 (`auth`, `products`, `product-scanning`, `store-settings`, `app-shell`).

- **Frontend hoje:**
  - React 19 + Vite 8 + TypeScript, sem nenhum teste automatizado; `npm run build` faz `tsc -b`, e há `oxlint`.
  - 15 pontos de contato com o Supabase:
    - `SessionProvider`: `onAuthStateChange`, `getSession` e `from('petshops')`;
    - `LoginPage`: `signInWithPassword`;
    - `SignupPage`: `signUp` + `rpc('signup_petshop')`, com tratamento de falha parcial que leva para "Concluir cadastro";
    - `CompleteSignupPage`: `rpc` e `signOut`;
    - `Sidebar`: `signOut`;
    - `productsApi.ts` (5 funções) e `petshopApi.ts` (2 funções).
  - Erros traduzidos em `authErrors.ts` (`isAuthError` + códigos do Supabase) e em `ProductFormModal`, onde `23505` vira "já pertence a {nome}" a partir da lista carregada.
  - O tipo `Session` do `supabase-js` vaza para o `sessionContext`, mas as telas só usam `session.user.email`.
- **API (T-14/T-15):**
  - `/auth/signup|login|refresh|logout|me`;
  - `/products`, `/products/by-ean/{ean}`, `/petshop` (incluindo `POST`);
  - erros em `ProblemDetails` + `code` (`409 ean_taken` traz `product: {id, name}`);
  - OpenAPI em `/openapi/v1.json` (Development);
  - CORS para `localhost:5183` e as prévias da Vercel;
  - refresh token com rotação e detecção de reuso, em que duas renovações com o mesmo token derrubam a sessão.
- **Restrições:**
  - decisão do usuário: chave de configuração, produção em `supabase` até a T-18, `dev` sempre mesclável na `main`;
  - CLAUDE.md: login e scanner se validam em celular real com HTTPS;
  - T-14: token de acesso em memória e refresh token no `localStorage`.

## Goals / Non-Goals

**Goals:**
- Nenhuma tela importa um backend concreto: trocar de backend é trocar uma variável de build.
- O modo `supabase` se comporta exatamente como hoje (o código só muda de lugar).
- A sessão no modo `api` não se perde por corrida: renovação serializada na aba e entre abas.

**Non-Goals:**
- Remover o Supabase do frontend (depois da observação pós-T-18).
- Mudar telas, textos ou fluxos. Telas novas de confirmação de e-mail e recuperação de senha são da T-22.
- Publicar a API ou configurar a Vercel para o modo `api` (T-17/T-18).

## Decisions

### D1. Seleção no carregamento com `import()` dinâmico
`src/shared/backend/index.ts` lê `import.meta.env.VITE_BACKEND`, valida, e expõe `loadBackend()`. Em modo `api` ele faz `await import('./api')`; senão, `await import('./supabase')`. O `main.tsx` chama `loadBackend()` antes do primeiro `render`, e o resto do app usa `getBackend()`, que lança erro se for chamado antes da carga.

- **Por que dinâmico:** como `VITE_BACKEND` é substituída por uma constante no build, o Rollup elimina o ramo morto. O pacote do modo `api` fica sem `supabase-js` e o do modo `supabase` sem o cliente da API (spec "Build só com o backend em uso"). Com imports estáticos, o efeito colateral do `supabaseClient.ts` (que lança erro sem as chaves) rodaria nos dois modos.
- O `supabaseClient.ts` passa para dentro da implementação Supabase e continua lançando erro se faltar chave. Só é importado no modo `supabase`.
- **Valor inválido** (`VITE_BACKEND`) ou **`VITE_API_URL` ausente no modo `api`** lança o erro na carga, que o `main.tsx` mostra no lugar do app, como já acontece hoje com as chaves do Supabase.

Alternativa descartada: um contexto React com as duas implementações importadas. Traria o `supabase-js` para o pacote do modo `api` e exigiria as chaves do Supabase nos dois modos.

### D2. Interface `Backend` e o que cada implementação faz
`src/shared/backend/types.ts`:

```ts
interface Backend {
  auth: {
    restore(): Promise<AuthUser | null>              // sessão salva, no carregamento
    subscribe(listener: (user: AuthUser | null) => void): () => void
    signIn(email: string, password: string): Promise<void>
    signUp(input: SignupInput): Promise<{ storeError?: BackendError }>
    completeSignup(store: StoreInput): Promise<void>  // conta sem loja
    currentPetshop(): Promise<Petshop | null>        // {id, name} ou null = sem loja
    signOut(): Promise<void>
  }
  products: { list(); findByEan(ean); create(input, source); update(id, input); remove(id) }
  petshop:  { get(); update(input) }
}
```

`AuthUser = { id, email }` substitui o `Session` do `supabase-js` no `sessionContext`. As telas só usavam o e-mail.

| Operação | Supabase (código de hoje, movido) | API |
|---|---|---|
| `restore` / `subscribe` | `getSession` / `onAuthStateChange` | refresh token salvo → `/auth/refresh` → `/auth/me`; emissor interno + evento `storage` |
| `signIn` | `signInWithPassword` | `POST /auth/login` |
| `signUp` | `signUp` + `rpc('signup_petshop')`; falha no `rpc` → `storeError` (fluxo de "Concluir cadastro" de hoje) | `POST /auth/signup`: atômico, nunca há `storeError` |
| `completeSignup` | `rpc('signup_petshop')` (23505 = sucesso) | `POST /petshop` (`409 petshop_exists` = sucesso) + renovação para o token trazer a loja |
| `currentPetshop` | `from('petshops').select('id, name')` | `GET /petshop` (`404` = sem loja) |
| `signOut` | `auth.signOut()` | `POST /auth/logout` (falha de rede ignorada) + apaga o refresh token |
| `products.*` / `petshop.*` | `productsApi.ts` / `petshopApi.ts` de hoje | `/products…` / `/petshop` |

O e-mail da loja no cadastro continua sendo o e-mail da conta, como o `SignupPage` faz hoje. O tipo `Product` passa a usar `updatedAt`, que nenhuma tela lê; a implementação Supabase faz a conversão de `updated_at`.

### D3. Erro comum `BackendError`
`BackendError extends Error` com `kind`:
- `invalid_credentials`, `email_taken`, `weak_password`, `rate_limited`, `email_not_confirmed`;
- `ean_taken` (com `owner?: {id, name}`), `not_found`, `network`, `unknown`.

Cada implementação converte os erros dela:
- **Supabase:** os códigos que o `authErrors.ts` já reconhece, `23505` e erro de rede;
- **API:** `status` + `code` do `ProblemDetails`, `429` → `rate_limited`, e `TypeError` do `fetch` → `network`.

O `toFormMessage` passa a receber `BackendError`, mantendo os mesmos textos e acrescentando `email_not_confirmed`. O `ProductFormModal` usa `owner` quando vem, que é o caso do modo `api`. Quando não vem, que é o caso do modo `supabase`, procura o dono na lista carregada, como hoje.

### D4. Cliente HTTP da API e sessão
`src/shared/backend/api/client.ts`:
- **Base e JSON:** base em `VITE_API_URL`, JSON nas duas direções e `Authorization: Bearer` com o token de acesso em memória.
- **Renovação em voo único:** uma resposta `401` numa chamada autenticada dispara `refresh()` e repete a chamada **uma** vez. O `refresh()` guarda a promessa em andamento, e quem chega durante a renovação espera a mesma promessa.
- **Entre abas:** a renovação roda dentro de `navigator.locks.request('petgest-refresh')`. Dentro do lock, o refresh token é **relido do `localStorage`**: se outra aba acabou de renovar, a renovação usa o token novo, que é o válido, em vez do antigo, que dispararia a detecção de reuso. Sem a Web Locks API (testes em Node), a promessa em voo único basta.
- **Armazenamento:** o refresh token fica em `localStorage['petgest.auth.refreshToken']`. O evento `storage` dessa chave, quando ela é apagada, avisa os `subscribe` de que a sessão acabou, e a outra aba sai do app. O token de acesso nunca vai para o armazenamento.
- **Falha da renovação:** recusa (`401`) apaga o refresh token e avisa `null`. Falha de rede não apaga nada e propaga `network`, e a tela mostra "Tentar de novo".

### D5. Tipos gerados do OpenAPI
`openapi-typescript` gera `src/shared/backend/api/schema.ts` a partir de `http://localhost:5080/openapi/v1.json` (`npm run api:types`, com a API rodando). O arquivo é **versionado**, para o build da Vercel não depender da API. O cliente usa `components['schemas'][...]` para corpos e respostas, sem gerador de cliente: são 13 chamadas.

### D6. Desenvolvimento local: proxy e HTTPS na rede
- **Proxy:** o `vite.config.ts` repassa `/api/*` para `http://localhost:5080/*`. No modo `api` local, `VITE_API_URL=/api`: mesma origem, sem CORS e sem conteúdo misto.
- **HTTPS na rede local:** `npm run dev:lan` (`vite --mode lan`) liga `@vitejs/plugin-basic-ssl` e `--host`. O celular abre `https://<ip-da-máquina>:5183`, aceita o certificado local e tem câmera e API pelo mesmo proxy.

Esse é o caminho para rodar o roteiro da T-10 no celular contra a API local, como o roadmap pede, sem esperar a publicação da T-17.

### D7. Testes
**Unidade (Vitest, ambiente `node`, `fetch` e `localStorage` falsos):**
- o cliente da API: renovação em voo único com várias chamadas simultâneas, nova tentativa única, recusa da renovação levando a `null`;
- a releitura do refresh token mudado por "outra aba", o evento `storage` de saída;
- a tradução `ProblemDetails` → `BackendError` e o sair sem rede;
- a seleção de backend (valor inválido, falta de `VITE_API_URL`).

**Integração manual (desktop, navegador do Claude):**
- modo `api` contra a API local: cadastro, sair, entrar, recarregar, produtos (lista, cadastro, código repetido, edição, exclusão), scanner pelo campo de digitar, configurações, duas abas;
- modo `supabase`: o app carrega até a tela de entrar. Não gravamos nada, porque o `.env.local` aponta para o Supabase de produção.

**Campo (usuário):** o roteiro da T-10 no Android pelo `dev:lan` no modo `api`. O iPhone fica registrado como pendente, junto da T-10.

## Risks / Trade-offs

- [Duas implementações divergirem até a T-18] → a mesma interface tipada; a implementação Supabase é o código de hoje só movido; o roteiro de paridade roda no modo `api`. Remover o caminho Supabase fica registrado no `ROADMAPV1.md`.
- [Corrida de renovação entre abas sem Web Locks] → a API existe em todos os navegadores atuais (Chrome, Safari 15.4+, Firefox). Sem ela, o pior caso é deslogar quando duas abas renovam no mesmo milissegundo.
- [Certificado autoassinado no celular] → aceitar o aviso uma vez por aparelho. No iPhone, se o Safari não liberar a câmera com certificado local, o roteiro no iPhone espera a prévia publicada da T-17 (registrado como pendente).
- [`schema.ts` desatualizado em relação à API] → `npm run api:types` faz parte da lista de verificação de qualquer change que mude contrato; o `tsc -b` do build pega uso de campo que não existe mais.
- [Mudança no `main.tsx` (carga assíncrona antes do render) afetar o modo `supabase`] → a verificação do modo `supabase` (o app abre na tela de entrar) e a prévia da Vercel da `dev` conferem antes do merge.

## Migration Plan

Sem efeito em produção: a Vercel não define `VITE_BACKEND`, então o build continua em `supabase`.

Na T-18:
1. definir `VITE_BACKEND=api` e `VITE_API_URL=<URL da API>` em Production na Vercel;
2. fazer um Redeploy.

Rollback: remover `VITE_BACKEND` (ou voltar para `supabase`) e fazer um Redeploy, ou usar o Instant Rollback.

## Open Questions

- O Safari do iPhone libera a câmera em `https://<ip-local>` com certificado autoassinado aceito? Se não liberar, o roteiro no iPhone fica para a prévia publicada (T-17); isso não muda o desenho.
