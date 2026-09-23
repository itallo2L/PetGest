## 1. Base: CSS, roteamento e sessão

- [x] 1.1 Portar para `shared/ui/` os blocos de CSS do design D6 (`layout.css`, `buttons.css`, `forms.css`, `empty-state.css`) e para `features/auth/auth.css` a tela de login sem os elementos removidos; verificar com um diff contra os trechos do `style.css` que só mudou o que o D6 lista, e `npm run build` sem erros
- [x] 1.2 Instalar `react-router`, montar as rotas do design D1 em `App.tsx` com o spike em `/spike`; verificar no dev server que `/spike` abre o spike sem login e que um caminho desconhecido cai em `/produtos`
- [x] 1.3 Criar `features/auth/SessionProvider` (design D2) e `authErrors.ts` (design D5); verificar com `npx tsc -b` e `npm run lint`, e no console do dev server que o status vai de `loading` para `signed-out` sem sessão
- [x] 1.4 Criar as guardas `RequireReady`, `PublicOnly` e `RequireNoPetshop` (design D3) com a tela de carregamento; verificar sem sessão que `/produtos` e `/configuracoes` levam a `/entrar` e que `/concluir-cadastro` leva a `/entrar`

## 2. Telas de autenticação

- [x] 2.1 Tela "Entrar" portada do protótipo (sem "Manter conectado" e "Esqueci minha senha"), com validação local, estado "Entrando…", mostrar/ocultar senha e erros do D5; verificar no dev server: senha errada mostra "E-mail ou senha incorretos." e mantém a senha; e-mail inválido não gera requisição (aba Network); login certo abre `/produtos`; acessar `/configuracoes` deslogado e entrar volta para `/configuracoes`
- [x] 2.2 Tela "Criar conta" (design D4) com link para "Entrar" e vice-versa; verificar no dev server: cadastro novo entra direto em `/produtos` com o nome da loja no shell, sem passar por `/concluir-cadastro`; e-mail repetido mostra a mensagem com link "Entrar"; senha de 5 caracteres mostra o mínimo; nome vazio não gera requisição
- [x] 2.3 Tela "Concluir cadastro da loja" (`/concluir-cadastro`) com o e-mail da conta preenchido; verificar criando uma conta só com `signUp` (script descartável, sem `rpc`) e entrando com ela: cai na tela, conclui e abre `/produtos`

## 3. Shell

- [x] 3.1 `AppShell`, `Sidebar` e `Topbar` (design D7) com Produtos e Configurações, nome e iniciais da loja, título por rota e estado vazio "em construção" em cada área; verificar no dev server: item ativo e título mudam ao navegar, recarregar em `/configuracoes` mantém a área, voltar do navegador retorna à área anterior
- [x] 3.2 Gaveta no celular (design D7); verificar em 375 px de largura: menu abre a gaveta com foco no fechar, escolher item fecha e navega, tocar no backdrop e Esc fecham e o foco volta ao menu, e o fundo não rola com a gaveta aberta
- [x] 3.3 "Sair" com `signOut`; verificar que volta para `/entrar`, que recarregar continua deslogado e que sair numa aba leva a outra aba aberta para `/entrar` sem recarregar

## 4. Verificação e fechamento

- [x] 4.1 Conferir sessão persistida (requisito de T-03): logado, recarregar e fechar/reabrir a aba mantêm o usuário em `/produtos`; e conferir que nenhum arquivo de `features/scanner/` mudou (`git diff --stat`)
- [ ] 4.2 (Usuário) Vercel > projeto > Settings > Environment Variables: adicionar `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (mesmos valores do `.env.local`, chave pública) em Preview e Production **antes do push** (design D8); verificar que nenhuma `service_role`/`sb_secret_` foi cadastrada
- [x] 4.3 Atualizar `ROADMAPV0.md` com o status de T-05 e a nova URL do spike (`/spike`) na seção de T-01; verificar que os dois trechos apontam para esta change
- [ ] 4.4 (Usuário) Commitar em `dev`, fazer push e, no deploy, testar em **Android (Chrome) e iPhone (Safari)**: criar conta, sair, entrar, senha errada, recarregar logado, gaveta de navegação e `/spike` sem login
- [ ] 4.5 (Usuário) Authentication > Users: apagar as contas `t05-teste-...` criadas nas verificações; verificar que a lista não tem mais contas de teste
