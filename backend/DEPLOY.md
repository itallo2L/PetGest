# Deploy da API no Azure (T-17)

Como publicar a API do V1 no **Azure App Service** com deploy pelo GitHub
Actions. Decisões em
`openspec/changes/T-17-azure-deploy/design.md`; contexto em
[`PLANOMVP.md`](../PLANOMVP.md) §4.4 e [`ROADMAPV1.md`](../ROADMAPV1.md) (T-17).

> Nada aqui toca a produção do V0. A produção só passa a usar a API na
> **T-18**, com o roteiro próprio dela.

## Ambientes

| Ambiente | Branch | App Service | Banco | Frontend que usa |
|---|---|---|---|---|
| `test` | `dev` | `petgest-api-test` (plano **F1**, gratuito) | segundo projeto Supabase gratuito (`petgest-test`) | prévias da Vercel (`pet-gest-git-dev-…`) |
| `production` | `main` | `petgest-api` (plano **B1**) | projeto Supabase de produção | `pet-gest.vercel.app` (a partir da T-18) |

Os nomes `petgest-api-test` e `petgest-api` são sugestões: o nome vira o
endereço (`https://<nome>.azurewebsites.net`) e precisa ser único no Azure. Se
estiver ocupado, use outro e ajuste a variável `AZURE_WEBAPP_NAME` e os
endereços abaixo.

## 1. Criar os recursos no Azure (uma vez por ambiente)

No [portal do Azure](https://portal.azure.com):

1. **Grupo de recursos** `petgest`, região **Brazil South**.
2. **App Service** (*Aplicativo Web*):
   - Publicar: **Código**; pilha: **.NET 10 (LTS)**; sistema: **Linux**;
     região: **Brazil South**.
   - Plano: **F1** para `test`, **B1** para `production` (o F1 desliga a
     API depois de um tempo parado e tem cota diária de CPU — serve para
     teste, não para a loja).
   - Implantação contínua: **desabilitada** (o deploy vem do workflow).
3. No App Service criado:
   - *Configurações > Configuração > Configurações gerais*: **HTTPS
     Only = Ativado**; em `production`, **Always On = Ativado** (não existe
     no F1).
   - *Monitoramento > Verificação de integridade*: caminho **`/health`**.
   - *Visão geral > Baixar perfil de publicação*: guarde o arquivo
     `.PublishSettings` para o passo 3 (é um segredo).

> Se o download do perfil estiver bloqueado, ative *Configuração >
> Configurações gerais > Credenciais de publicação de autenticação básica do
> SCM*.

## 2. Banco do ambiente

### `test`: segundo projeto Supabase

1. No [Supabase](https://supabase.com/dashboard), crie o projeto
   `petgest-test` na região **South America (São Paulo)**, plano gratuito.
2. Aplique o schema do V1: baixe o artefato `migrations-dev` da última
   execução do workflow **backend** (aba *Actions* do GitHub) e rode o
   `migrations.sql` no *SQL Editor* do projeto. O script é idempotente.
3. Rode [`deploy/petgest_api_role.sql`](deploy/petgest_api_role.sql) no
   *SQL Editor*, trocando a senha de exemplo por uma senha forte.

> O projeto gratuito pausa depois de ~7 dias sem uso. Se a API de teste
> começar a responder `503` em `/health`, reative o projeto no painel.

### `production`: o projeto Supabase atual

Só na T-18, pelo roteiro dela (a ordem das migrations e a importação das
contas importam). **Não** aplique o `migrations.sql` na produção antes disso.

### String de conexão

Use o **pooler em modo session** (porta **5432**, IPv4), em *Project Settings >
Database > Connection string > Session pooler*. Com o papel da API:

```text
Host=aws-0-sa-east-1.pooler.supabase.com;Port=5432;Database=postgres;Username=petgest_api.<ref-do-projeto>;Password=<senha do papel>;SSL Mode=Require
```

O host exato (`aws-0-…` ou `aws-1-…`) é o que o painel mostrar. A API
completa a string com `Keepalive=30`, `Connection Idle Lifetime=60` e
`Maximum Pool Size=10`, se ela não disser outra coisa (design D3).

## 3. Configurar o GitHub (uma vez por ambiente)

No repositório: *Settings > Environments > New environment*, um para `test` e
outro para `production`. Em cada um:

| Tipo | Nome | Valor |
|---|---|---|
| Variable | `AZURE_WEBAPP_NAME` | nome do App Service do ambiente |
| Secret | `AZURE_WEBAPP_PUBLISH_PROFILE` | conteúdo inteiro do `.PublishSettings` |

Sem `AZURE_WEBAPP_NAME`, o job **deploy** só gera o `migrations.sql` e pula a
publicação. Em `production`, vale ativar *Required reviewers* para o deploy
esperar uma aprovação manual.

## 4. Configurações da API no App Service

Em *Configurações > Variáveis de ambiente > Configurações de aplicativo*.
**Segredos ficam só aqui**, nunca no repositório, no frontend ou na Vercel.

| Nome | `test` | `production` |
|---|---|---|
| `ASPNETCORE_ENVIRONMENT` | `Production` | `Production` |
| `ConnectionStrings__Default` | string do passo 2 (projeto `petgest-test`) | string do passo 2 (produção) |
| `Jwt__SigningKey` | segredo aleatório, 48+ caracteres | **outro** segredo aleatório |
| `Auth__FrontendBaseUrl` | `https://pet-gest-git-dev-itallo2ls-projects.vercel.app` | `https://pet-gest.vercel.app` |
| `ForwardedHeaders__Enabled` | `true` | `true` |

Para gerar um segredo no PowerShell:

```powershell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }))
```

As configurações de e-mail (T-22) e de IA (T-19/T-20) estão na seção
[Configurações das tarefas seguintes](#configurações-das-tarefas-seguintes).

O CORS já aceita `https://pet-gest.vercel.app`, as prévias
`https://pet-gest-…-itallo2ls-projects.vercel.app` e `http://localhost:5183`
(`appsettings.json`). Outro endereço de frontend precisa entrar em
`Cors:AllowedOrigins` (variável `Cors__AllowedOrigins__2`, por exemplo).

## 5. Publicar

Um push na `dev` (com mudança em `backend/`) roda o workflow **backend**:
testes → deploy no ambiente `test` → conferência de `/health`. Para publicar
sem mudança de código: *Actions > backend > Run workflow*, escolhendo a branch.

Conferir:

```bash
curl https://petgest-api-test.azurewebsites.net/health
```

Resposta esperada: `Healthy` (status 200). `Unhealthy` (503) = a API está no
ar mas não alcança o banco (string de conexão, senha do papel ou projeto
pausado).

## 6. Prévia do frontend apontando para a API de teste

Na Vercel, projeto `pet-gest`, *Settings > Environment Variables*, só no
ambiente **Preview** e na branch `dev`:

| Nome | Valor |
|---|---|
| `VITE_BACKEND` | `api` |
| `VITE_API_URL` | `https://petgest-api-test.azurewebsites.net` |

Depois, *Deployments > (última prévia da dev) > Redeploy*. Production
continua sem essas variáveis até a T-18 (sem `VITE_BACKEND`, o build é
`supabase`).

## Configurações das tarefas seguintes

Valem para os dois ambientes, cada um com os próprios valores:

| Nome | Tarefa | Valor |
|---|---|---|
| `Email__Provider` | T-22 | `acs` (sem ele, os e-mails só vão para o log da API) |
| `Email__AcsConnectionString` | T-22 | *Keys > Connection string* do recurso Communication Services |
| `Email__Sender` | T-22 | `DoNotReply@<domínio>.azurecomm.net` (domínio gerenciado do Azure) |
| `Ai__OpenAI__ApiKey` | T-19/T-20 | chave da API da OpenAI (sem ela, foto e voz ficam indisponíveis) |

Detalhes em `openspec/changes/T-22-transactional-email/design.md` e
`openspec/changes/T-19-photo-ai/design.md`.

## Problemas comuns

- **`500` logo depois de um tempo parado:** conexão ociosa derrubada pelo
  pooler. Os padrões do design D3 tratam isso; se voltar, reduza
  `Connection Idle Lifetime` na string de conexão.
- **`429` para todo mundo no login:** `ForwardedHeaders__Enabled` ausente — a
  API conta todos os clientes como o IP do proxy do Azure.
- **Links de e-mail inválidos depois de um deploy:** a tabela
  `identity.data_protection_keys` não existe ou o papel não tem acesso a ela
  (rode de novo o `migrations.sql` e o `petgest_api_role.sql`).
