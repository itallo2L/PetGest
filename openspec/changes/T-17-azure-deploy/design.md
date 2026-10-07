## Context

Motivação em `proposal.md`; comportamento exigido em `specs/api-platform/spec.md`.

- **Decisões que valem aqui:** App Service na região Brazil South, perto do Supabase em São Paulo; banco = Postgres do projeto Supabase, acessado pelo pooler (T-11, D2); segredos só nas configurações do App Service (`ROADMAPV1.md`, T-17).
- **Pendências herdadas:**
  - Data Protection só em memória (T-14);
  - `ForwardedHeaders` (T-14);
  - conexão ociosa derrubada → `500` na primeira consulta (teste da T-16).
- **Limites do Supabase:** projeto com 60 conexões; o pooler Supavisor em modo *session* (porta 5432) é IPv4 e mantém uma conexão de banco por cliente.
- **Quem cria os recursos:** o usuário, no portal do Azure. Esta change deixa o código, o workflow, o script do papel e o roteiro prontos, mas não cria nem paga recurso nenhum.

## Goals / Non-Goals

**Goals:**
- API publicável no App Service Linux sem mudança de código entre os ambientes, só configuração.
- Deploy automático a cada push na `dev` (ambiente `test`) e na `main` (`production`), sempre depois dos testes.
- Links enviados por e-mail continuarem válidos depois de reinício, deploy ou troca de instância.

**Non-Goals:**
- Aplicar migrations automaticamente ao subir ou no deploy. A ordem na produção importa (T-18) e o script é aplicado à mão.
- Kubernetes, filas, Redis, slots de implantação, Application Insights (`PLANOMVP.md` §4.4).
- Domínio próprio. Os endereços `*.azurewebsites.net` já têm HTTPS.

## Decisions

### D1. Chaves do Data Protection no Postgres
`PersistKeysToDbContext<AppDbContext>()`, com a tabela `identity.data_protection_keys` e o nome de aplicação fixo `petgest-api`.
- **Por quê:** é o único armazenamento que todas as instâncias e todos os deploys enxergam, e o banco já é o estado durável da API. O disco do App Service (`/home`) também persiste, mas é por app: um app novo ou recriado começaria com chaves novas.
- **Alternativa descartada:** Azure Blob Storage + Key Vault. Mais dois recursos e mais um segredo para proteger chaves que só assinam códigos de 24 horas.
- **Risco:** as chaves ficam em texto no banco. Quem lê o banco já tem acesso a tudo que esses códigos protegem, então a criptografia em repouso das chaves fica fora do escopo.

### D2. `ForwardedHeaders` ligado por configuração, só a última entrada
`ForwardedHeaders:Enabled=true` liga `UseForwardedHeaders` (X-Forwarded-For e X-Forwarded-Proto) antes de qualquer middleware que leia o IP.
- O proxy do App Service não tem IPs fixos, então `KnownIPNetworks`/`KnownProxies` ficam vazios, com `ForwardLimit = 1`: vale só a última entrada, a que o próprio proxy acrescentou. Uma entrada forjada pelo cliente fica à esquerda e é ignorada.
- **Desligado por padrão:** em desenvolvimento não há proxy, e confiar no cabeçalho deixaria qualquer cliente escolher o próprio "IP" para fugir do limite.

### D3. Padrões de conexão para o pooler, sem retry automático
`DatabaseSetup.WithDefaults` completa a string de conexão com `Keepalive=30`, `Connection Idle Lifetime=60` e `Maximum Pool Size=10`. Valor que a string já define prevalece.
- **Keepalive e vida ociosa:** a conexão parada é descartada do pool antes de o pooler ou um NAT no caminho a derrubar em silêncio, que é a causa do `500` visto na T-16.
- **Pool de 10:** uma instância B1 não precisa de mais, e o padrão do Npgsql (100) sozinho passaria do limite de 60 conexões do projeto.
- **`EnableRetryOnFailure` descartado:** o `AuthService` abre transações explícitas (cadastro e renovação), que com a estratégia de retry precisariam ser reescritas dentro de `CreateExecutionStrategy()`. O cadastro, em particular, mexe em entidades rastreadas pelo Identity, e repetir o bloco duplicaria inserções. Com as conexões ociosas tratadas na origem, o ganho não paga o risco.

### D4. Deploy como segundo job do workflow `backend`
O job `deploy` depende de `build-test` e só roda em push (ou execução manual) em `dev`/`main`:
1. `dotnet publish`;
2. `dotnet ef migrations script --idempotent` → artefato `migrations-<branch>`;
3. `azure/webapps-deploy@v3` com o perfil de publicação;
4. conferência de `/health` por até 5 minutos.

Cada branch usa um **GitHub Environment** (`dev` → `test`, `main` → `production`) com a variável `AZURE_WEBAPP_NAME` e o segredo `AZURE_WEBAPP_PUBLISH_PROFILE`. Sem a variável, os passos de publicação são pulados e o job continua verde, para a `dev` não ficar vermelha antes de o usuário criar os recursos.

**Alternativa descartada:** OIDC com service principal (`azure/login`). Evita um segredo de longa duração, mas exige criar um registro de aplicativo e atribuir papéis no Entra ID, o que é mais pesado para um projeto solo. O perfil de publicação pode ser trocado depois sem mudar o resto.

### D5. Papel `petgest_api` com `bypassrls`
`backend/deploy/petgest_api_role.sql`, idempotente e rodado como `postgres` depois das migrations:
- DML em `public.petshops`/`profiles`/`products` e em todo o schema `identity`;
- privilégios padrão para as tabelas futuras de `identity`;
- sem DDL: a API não aplica migrations;
- `bypassrls` porque o isolamento é da API (T-13). Se o Supabase recusar o atributo, a alternativa é uma política `using (true)` para o papel, comentada no script.

Ensaiado num banco local: o script roda duas vezes sem erro, o papel lê e grava as tabelas do app e recebe `permission denied` ao tentar `create table`.

### D6. Ambiente de teste: segundo projeto Supabase gratuito + App Service F1
- **Por quê:** mesmo Postgres, mesmo pooler e mesma pausa por inatividade da produção, então problemas de conexão aparecem no teste e não na virada. Custo zero.
- **Alternativa descartada:** Postgres em contêiner no Azure (Container Apps / ACI). Custo mensal e um tipo de recurso que a produção não usa.
- **Consequência:** a prévia da `dev` na Vercel ganha `VITE_BACKEND=api` e `VITE_API_URL` só no ambiente Preview, e o App Service de teste usa `Auth__FrontendBaseUrl` apontando para a prévia da `dev`.

## Risks / Trade-offs

- [F1 dorme e tem cota diária de CPU] → só para teste; a primeira chamada depois de parado pode levar alguns segundos. Produção em B1 com Always On.
- [Perfil de publicação é um segredo de longa duração] → fica só no GitHub Environment; dá para regenerar no portal e migrar para OIDC depois (D4).
- [`bypassrls` recusado no Supabase] → alternativa de política documentada no script (D5).
- [Migrations aplicadas à mão podem ser esquecidas] → o workflow publica o script como artefato a cada deploy, e o `/health` não detecta schema velho. Na T-18 o roteiro confere a tabela `__EFMigrationsHistory`.
