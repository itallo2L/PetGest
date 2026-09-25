## 1. Configuração (usuário, com conferência)

- [x] 1.1 (Usuário) Vercel > Settings: conferir Root Directory `frontend`, Framework Preset Vite, **Production Branch `main`**, e Environment Variables `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` em Production e na prévia `dev` (design D1); verificar que não há nenhuma outra variável com `service_role`/`sb_secret_` e anotar a URL de produção (`<projeto>.vercel.app`)
- [x] 1.2 (Usuário) Supabase > Authentication > URL Configuration: Site URL = URL de produção; Redirect URLs = produção, prévias `https://*-<time>.vercel.app/**` e `http://localhost:5183/**`; "Confirm email" continua desligado (design D3); verificar salvando e recarregando a página do painel

## 2. Verificação na prévia de `dev`

- [x] 2.1 Baixar os `.js` de `/assets/` da prévia e procurar `service_role`, `sb_secret_` e JWT com `role=service_role`; confirmar que a chave presente é a `sb_publishable_…` do `.env.local` (design D4); verificar que não há ocorrências proibidas
- [x] 2.2 Abrir direto na prévia `/entrar`, `/produtos`, `/configuracoes`, `/spike` e `/qualquer-coisa` (design D5); verificar que todos carregam o app (status 200 e a tela esperada), nenhum dá 404 da Vercel
- [x] 2.3 Criar uma conta de teste na prévia, sair e entrar de novo; verificar que cadastro e login funcionam contra o Supabase e que a loja aparece na barra lateral

## 3. Documentação

- [x] 3.1 Reescrever `frontend/README.md` (design D6); verificar que os comandos citados funcionam como descritos (`npm install`, `npm run dev` na 5183, `npm run build`, `npm run lint`)
- [x] 3.2 Atualizar `ROADMAPV0.md` com o status de T-09, a URL de produção e o risco de pausa do Supabase gratuito; verificar que aponta para esta change

## 4. Produção

- [ ] 4.1 (Usuário) Abrir o PR `dev` → `main` no GitHub e mesclar — antecipado para antes do iPhone, ver design D2 e T-10 (tarefa 1.3); verificar que o deploy de produção da `main` fica **Ready** na Vercel
- [ ] 4.2 Teste de fumaça na URL de produção: repetir 2.1 e 2.2 contra produção; verificar que passam
- [ ] 4.3 (Usuário) Apagar a conta/loja de teste criada em 2.3
