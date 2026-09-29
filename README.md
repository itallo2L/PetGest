# PetGest

SaaS de gestão para petshops. O V0 cobre login e cadastro de petshop,
cadastro de produto pelo leitor de código de barras (ou digitação manual)
e os dados da loja.

- **Produção:** https://pet-gest.vercel.app (V0)
- **Em desenvolvimento:** V1 — API própria em ASP.NET Core + Identity/JWT
  sobre o Postgres do Supabase, para o cadastro por foto e voz com IA.

## Estrutura

| Pasta / arquivo | O que é |
|---|---|
| [`frontend/`](frontend/) | App do V0 (React + TypeScript + Vite), publicado na Vercel. Como rodar, variáveis de ambiente e deploy em [`frontend/README.md`](frontend/README.md). |
| [`supabase/`](supabase/) | `schema.sql` (tabelas, RLS, função `signup_petshop`) e `tests/rls_test.sql`. |
| [`openspec/`](openspec/) | Specs vigentes e uma change por tarefa dos roadmaps (`T-XX-<slug>`). |
| `index.html`, `script.js`, `style.css` | Protótipo navegável original — ver abaixo. |

Ainda não existe `backend/`: ele entra na T-12 do `ROADMAPV1.md`.

## Documentos de decisão

- [`PLANOMVP.md`](PLANOMVP.md) — stack e entregáveis: §3 é o V0 (Supabase +
  Vercel), §4 é o V1 (ASP.NET Core + Azure App Service).
- [`ROADMAPV0.md`](ROADMAPV0.md) — tarefas T-01 a T-10 do V0.
- [`ROADMAPV1.md`](ROADMAPV1.md) — tarefas T-11 a T-21 do V1.

## Protótipo original (raiz do repositório)

`index.html` / `script.js` / `style.css` são o protótipo em HTML/CSS/JS
puro que serviu de referência visual para o `frontend/`. Abre direto no
navegador, sem instalação. **Não tem backend:** o login aceita qualquer
e-mail e senha, o leitor de código de barras não liga a câmera (sorteia
resultados de demonstração) e os produtos vivem só em memória.

Não é mais onde o desenvolvimento acontece — fica no repositório só como
referência.
