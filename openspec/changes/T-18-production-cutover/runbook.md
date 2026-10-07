# Roteiro da virada da produção (T-18)

Leva `pet-gest.vercel.app` do V0 (Supabase Auth + Data API) para o V1 (API no
Azure), no **mesmo banco**. Decisões em `design.md`; scripts em
[`backend/deploy/t18/`](../../../backend/deploy/t18/). Os scripts foram ensaiados
pelo `T18RehearsalTests` num banco montado como o de produção.

> **Não comece antes de todos os pré-requisitos.** Em especial: a T-10 precisa
> estar arquivada (`CLAUDE.md`).

## 0. Pré-requisitos (dias antes)

- [ ] **T-10 arquivada** (teste de campo do V0 no iPhone) — `ROADMAPV0.md` com o V0 concluído.
- [ ] **Projeto Supabase no plano Pro**: no gratuito ele pausa depois de 7 dias sem uso, e com a API em cima uma pausa derruba a loja.
- [ ] **T-17:**
  - App Service `production` (B1, Always On) criado, com o GitHub Environment `production`;
  - a `main` publicada e `GET https://<app>.azurewebsites.net/health` respondendo `Healthy`. Antes da virada isso falha por não ter o papel no banco, o que é esperado; confira só que a API sobe (ver o log do App Service).
- [ ] **T-22:** recurso de e-mail (ACS) criado e testado na API de teste (e-mail de confirmação recebido de verdade).
- [ ] **Testes no ambiente `test`:** roteiro da T-10 completo no modo `api` (T-16 tarefa 4.4) pela prévia da `dev`, sem defeito aberto.
- [ ] **`dev` mesclada na `main`** com tudo do V1 validado.
- [ ] **Passo 5 em dia:** se entrou migration nova depois de 2026-10-07, regerar `05-migrations-depois-da-importacao.sql` (comando no cabeçalho) e rodar `dotnet test` (o `T18RehearsalTests` confere).
- [ ] **Avisar os petshops** (hoje: a "Rusticão") com 2–3 dias de antecedência:
  > "No dia X, entre H1 e H2, o PetGest fica alguns minutos em manutenção. Depois, entre com o mesmo e-mail e a mesma senha. Se não conseguir, use 'Esqueci minha senha' na tela de entrar."

## 1. Janela de virada (~1 hora, em horário de pouco uso)

Abra o SQL Editor do projeto Supabase **de produção**. Rode cada arquivo inteiro,
nesta ordem, e confira o resultado antes de seguir.

| # | Arquivo | Conferir | Se der errado |
|---|---|---|---|
| 1 | `01-conferencia-antes.sql` | Prefixos `$2a$10$` (ou `$2b$`); item 2b **vazio**; **guarde** o item 3 (produtos por loja) | Prefixo diferente → plano B (abaixo). Item 2b com linhas → pare e decida o que fazer com essas contas, sem apagar nada |
| 2 | `02-baseline.sql` | Lista só `20261003210743_V0Schema` | Pode rodar de novo |
| 3 | `03-migrations-antes-da-importacao.sql` | Sem erro; schema `identity` criado | Rodar de novo é seguro (idempotente) |
| 4 | `04-importar-contas.sql` | `contas_no_supabase` = `contas_no_identity` | Rodar de novo é seguro |
| 5 | `05-migrations-depois-da-importacao.sql` | Sem erro | Erro de FK = um vínculo sem conta importada: volte ao passo 1, item 2b |
| 6 | `06-conferencia-depois.sql` | Itens 1 e 2 vazios; item 3 = `identity.users`; item 4 igual ao item 3 do passo 1 | Pare e compare antes de virar o frontend |

Depois dos scripts:

7. Rode [`backend/deploy/petgest_api_role.sql`](../../../backend/deploy/petgest_api_role.sql) com uma senha forte (`DEPLOY.md` §2).
8. **App Service `production`**, *Variáveis de ambiente*:
   - `ConnectionStrings__Default`: pooler em modo session, com o papel `petgest_api` (`DEPLOY.md` §2);
   - `Jwt__SigningKey`: segredo novo;
   - `Auth__FrontendBaseUrl` = `https://pet-gest.vercel.app`;
   - `Auth__RequireConfirmedEmail` = `true`;
   - `ForwardedHeaders__Enabled` = `true`;
   - `Email__Provider` = `acs`, `Email__AcsConnectionString`, `Email__Sender`;
   - opcional (T-19/T-20): `Ai__OpenAI__ApiKey`.
   
   Salve; o App Service reinicia.
9. Confira `GET https://<app>.azurewebsites.net/health` → `Healthy`.
10. **Vercel**, projeto `pet-gest`, *Settings > Environment Variables*, ambiente **Production**:
    - `VITE_BACKEND` = `api`;
    - `VITE_API_URL` = `https://<app>.azurewebsites.net`.
    
    Depois, *Deployments > (deploy de produção atual) > Redeploy*.
11. **Teste rápido no celular (Android)**, em `pet-gest.vercel.app`, com a conta de campo:
    - entrar;
    - ver os produtos;
    - escanear um código já cadastrado;
    - cadastrar um produto;
    - sair.
12. Teste com a conta de um petshop real só se o dono estiver junto. Senão, peça para ele entrar depois e avisar.

## 2. Depois da janela (mesmo dia)

- [ ] Roteiro da T-10 (`openspec/changes/archive/…-T-10-field-test/roteiro.md`) completo em **Android e iPhone**, em produção, com rede móvel. Use o "Pet Shop Amigo Fiel".
- [ ] "Esqueci minha senha" com um e-mail real, do pedido até entrar com a senha nova.
- [ ] No SQL Editor: as contas que já entraram ficaram com o hash fora do formato bcrypt (re-hash no primeiro login).

  ```sql
  select email, left(password_hash, 4) from identity.users;
  ```

## 3. Observação (sugestão: 7 dias)

- Acompanhar o log do App Service (*Log stream*) e o `/health`.
- Manter o Supabase Auth e a Data API **como estão**: são o caminho de volta.

## 4. Depois da observação

1. `depois-da-observacao/fechar-data-api.sql` (conferência: tudo `false`).
2. Supabase, *Authentication > Providers > Email*: desligar novos cadastros (*Allow new users to sign up*). O Supabase Auth fica sem uso.
3. Nova change para tirar do frontend o caminho Supabase (`shared/backend/supabase/`, `VITE_SUPABASE_*`, `@supabase/supabase-js`), como a T-16 previu.
4. Arquivar a T-18.

## Rollback

| Quando | Como |
|---|---|
| Problema nos passos 1–6 | Pare. O V0 continua funcionando (nada do V0 foi alterado até o passo 5; depois dele, só cadastros novos no V0 falham). Corrija e rode de novo o passo que falhou |
| Problema depois do passo 10 | Vercel: remover `VITE_BACKEND` e `VITE_API_URL` de Production e Redeploy, ou *Instant Rollback* para o último deploy do V0. O app volta a usar o Supabase direto |
| Depois do passo 4.1 (Data API fechada) | Rodar `depois-da-observacao/reabrir-data-api.sql` e depois o rollback da Vercel |

Num rollback para o V0, senhas trocadas pela API não valem (o V0 lê o hash do
`auth.users`), e contas criadas pela API não existem no V0. Avise quem estiver
nesse caso para usar a senha antiga.

## Plano B: hash em formato inesperado

Se o passo 1 mostrar um prefixo diferente de `$2a$`/`$2b$`/`$2y$`:

1. Rode o passo 4 assim mesmo: a conta é importada com o hash copiado, que a API não vai aceitar.
2. Avise os petshops para usar **"Esqueci minha senha"** no primeiro acesso. A redefinição grava uma senha nova e confirma o e-mail (T-22).
