## 1. Configurar o Auth no Supabase (usuário)

- [x] 1.1 (Usuário) Authentication > Sign In / Providers: provedor **Email** ativo, "Allow new users to sign up" ligado e **"Confirm email" desligado** (`PLANOMVP.md` §3.9); verificar que as três opções continuam assim depois de salvar e recarregar a página
- [x] 1.2 (Usuário) Project Settings > API Keys: copiar o Project URL e a chave **pública** (`anon` ou *publishable* `sb_publishable_...` — design D3) para `frontend/.env.local` como `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`; verificar que o valor colado **não** é `service_role` nem `sb_secret_...` e que `git status` não mostra o `.env.local`

## 2. Client no frontend

- [x] 2.1 Instalar `@supabase/supabase-js` em `frontend/`; verificar que aparece em `dependencies` do `package.json` e que `npm run build` continua passando
- [x] 2.2 Criar `frontend/src/vite-env.d.ts` declarando `ImportMetaEnv` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (design D5); verificar com `npx tsc -b` sem erros
- [x] 2.3 Criar `frontend/src/shared/supabaseClient.ts` exportando o client único, com as opções de auth padrão e erro nomeando a variável ausente (design D1, D2); verificar com `npm run build` e `npm run lint` sem erros
- [x] 2.4 Criar `frontend/.env.example` com as duas variáveis vazias e adicionar `!.env.example` ao `.gitignore` da raiz; verificar que `git status` lista `.env.example` e continua sem listar `.env.local`
- [x] 2.5 Verificar a falha cedo (design D2): com o dev server rodando e o `.env.local` temporariamente renomeado, `await import('/src/shared/supabaseClient.ts')` no console do navegador deve lançar erro citando a variável ausente; restaurar o `.env.local` e confirmar que o mesmo import resolve sem erro

## 3. Verificação contra o projeto real

- [x] 3.1 Rodar o script descartável do design D6 (no scratchpad, não versionado) e verificar: cadastro devolve sessão na hora; cadastro repetido com o mesmo e-mail não cria conta nova; senha errada é recusada e a certa abre sessão; `petshops` e `products` voltam com zero linhas para a conta nova
- [x] 3.2 (Usuário) Authentication > Users: apagar a(s) conta(s) de teste criadas no 3.1; verificar que a lista volta ao estado anterior
- [x] 3.3 Conferir que nenhuma chave secreta vazou: procurar **valores** de chave secreta (`sb_secret_<token>` ou JWT) nos arquivos versionados e a versionar e em `frontend/dist/` após o build, e a chave pública fora do `.env.local`; verificar que não há ocorrências (a menção literal a `service_role` nos documentos e no comentário do client é intencional)

## 4. Fechamento

- [x] 4.1 Atualizar `ROADMAPV0.md` com o status de T-03 (e nota de que a persistência da sessão após recarregar é verificada em T-05); verificar que o texto aponta para esta change
- [x] 4.2 (Usuário) Commitar em `dev` e fazer push
