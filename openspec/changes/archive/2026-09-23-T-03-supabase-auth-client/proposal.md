## Why

T-05 (login, cadastro de petshop e proteção de rota) precisa de duas coisas que ainda não existem: um Supabase Auth configurado para e-mail/senha que deixe o usuário entrar logo depois de criar a conta, e um client `supabase-js` no frontend lendo as credenciais do projeto. Criar isso agora, isolado, separa "a conexão e a configuração estão certas" de "a tela de login funciona" e evita que T-05 descubra problemas de ambiente no meio da UI.

## What Changes

- **Supabase Auth (painel, feito pelo usuário):** provedor e-mail/senha ativo, cadastro de novos usuários permitido e **confirmação de e-mail desativada** por enquanto (reativar antes de uso com clientes reais — `PLANOMVP.md` §3.9).
- **Frontend:** instalar `@supabase/supabase-js` em `frontend/`.
- Novo `frontend/src/shared/supabaseClient.ts`: único client Supabase do app, lendo `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`; se alguma faltar, falha na hora com mensagem clara em vez de gerar erros confusos de rede depois.
- Tipagem das duas variáveis em `frontend/src/vite-env.d.ts`.
- Novo `frontend/.env.example` (versionado) com os nomes das variáveis e exceção no `.gitignore` para ele; os valores reais ficam em `frontend/.env.local`, que não é versionado.
- Verificação ponta a ponta com um script descartável (fora do repositório): criar conta de teste → sessão devolvida na hora → login com a mesma senha → usuário sem petshop não vê nenhuma linha.
- `ROADMAPV0.md`: status de T-03.

Fora desta etapa: telas de login/cadastro, `onAuthStateChange`, proteção de rota (T-05); tipos gerados do banco (T-06); variáveis de ambiente na Vercel (T-09); e-mails de confirmação, recuperação de senha, Site URL / Redirect URLs (só fazem sentido quando a confirmação de e-mail for reativada).

## Capabilities

### New Capabilities
- `auth`: conta e sessão do usuário no Supabase Auth — criação de conta com e-mail/senha já autenticada, login, sessão persistida no navegador, e o frontend conectado ao projeto só com a chave pública.

### Modified Capabilities
<!-- nenhuma — tenant-data não muda -->

## Impact

- **Dependência nova:** `@supabase/supabase-js` em `frontend/package.json`.
- **Arquivos novos:** `frontend/src/shared/supabaseClient.ts`, `frontend/src/vite-env.d.ts`, `frontend/.env.example`.
- **Arquivo alterado:** `.gitignore` da raiz (exceção `!.env.example` — hoje `.env*` ignora tudo).
- **Documentos:** `ROADMAPV0.md` (status de T-03).
- **Sistemas externos:** configuração de Authentication no painel do Supabase (projeto criado em T-02).
- **App atual:** o spike do scanner (T-01) não importa o client, então continua funcionando e fazendo deploy na Vercel sem as variáveis novas.
