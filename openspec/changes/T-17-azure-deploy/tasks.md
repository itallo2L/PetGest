## 1. Código

- [x] 1.1 Persistir as chaves do Data Protection no `AppDbContext` (`IDataProtectionKeyContext`, tabela `identity.data_protection_keys`, migration `DataProtectionKeys`, nome de aplicação `petgest-api`) (design D1); verificar com um teste que um código de confirmação gerado por uma instância da API é aceito por outra — _verificado em 2026-10-07: `DataProtectionKeyTests` verde_
- [x] 1.2 `ProxySetup` com `ForwardedHeaders:Enabled`, `ForwardLimit = 1` e listas de proxies conhecidos vazias, antes do rate limit (design D2); verificar com testes: clientes diferentes atrás do proxy com limites separados, entrada forjada ignorada, cabeçalho ignorado com a opção desligada — _verificado em 2026-10-07: `ProxyTests` (3) verdes_
- [x] 1.3 `DatabaseSetup.WithDefaults` (keepalive 30 s, vida ociosa 60 s, pool 10, valores explícitos prevalecem) aplicado no registro do `AppDbContext` (design D3); verificar com testes de unidade — _verificado em 2026-10-07: `DatabaseSetupTests` (3) verdes; o Npgsql não aceita `Max Pool Size`, só `Maximum Pool Size`/`MaxPoolSize`_

## 2. Deploy

- [x] 2.1 Job `deploy` no workflow `backend` (depois de `build-test`, só em push/manual em `dev`/`main`, GitHub Environment por branch, `dotnet publish`, artefato `migrations.sql` idempotente, `azure/webapps-deploy@v3` e conferência de `/health`, publicação pulada sem `AZURE_WEBAPP_NAME`) (design D4); verificar que o YAML é válido — _verificado em 2026-10-07: YAML lido por parser (`jobs: build-test, deploy`); a execução real depende do push na `dev` e dos recursos do Azure (tarefas 3.x)_
- [x] 2.2 Script `backend/deploy/petgest_api_role.sql` (papel com `bypassrls`, DML nas tabelas do app, privilégios padrão em `identity`, idempotente) (design D5); verificar num banco local com as migrations aplicadas — _verificado em 2026-10-07 no Postgres 17 local: script rodado 2× sem erro; como `petgest_api`, insert/delete em `public.petshops` e insert em `identity.data_protection_keys` ok; `create table` → `permission denied for schema public`_
- [x] 2.3 Roteiro `backend/DEPLOY.md` (recursos, ambientes `test`/`production`, string do pooler, GitHub Environments, configurações e segredos do App Service, prévia da Vercel apontando para a API de teste, problemas comuns) (design D6) e atualização do `backend/README.md` e do `ROADMAPV1.md`

## 3. Publicação (usuário)

- [ ] 3.1 (Usuário) Criar o projeto Supabase `petgest-test`, aplicar o `migrations.sql` e o `petgest_api_role.sql`, criar o App Service `petgest-api-test` (F1) e o GitHub Environment `test`, seguindo o `DEPLOY.md` §1–§4; verificar `GET /health` → `200 Healthy` depois do primeiro deploy pela `dev`
- [ ] 3.2 (Usuário) Configurar `VITE_BACKEND=api` e `VITE_API_URL` no ambiente Preview da Vercel (branch `dev`) e fazer Redeploy (`DEPLOY.md` §6); verificar no celular, pela prévia da `dev`, que criar conta, cadastrar produto e escanear funcionam contra a API de teste
- [ ] 3.3 (Usuário) Criar o App Service `petgest-api` (B1, Always On) e o GitHub Environment `production`, sem apontar a produção do frontend para ele — a virada é da T-18
