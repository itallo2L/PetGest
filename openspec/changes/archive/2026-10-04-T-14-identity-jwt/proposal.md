## Why

A T-13 deixou o isolamento por petshop pronto, lendo `sub` e `petshop_id` das claims, mas nenhum token é emitido ainda. Sem autenticação própria, a T-15 não pode expor produtos nem loja, e o V1 continuaria preso ao Supabase Auth, que a T-11 decidiu trocar por ASP.NET Core Identity + JWT (D3). Esta change cria contas, login e sessão na API, com o mesmo comportamento que a spec `auth` do V0 garante hoje na produção.

## What Changes

- **ASP.NET Core Identity** com chave `Guid` (o mesmo tipo de `auth.users.id`, T-11 D4) e papel único, com as tabelas no schema `identity`, fora do schema exposto pela Data API do Supabase.
- **FK de `profiles.id` para a tabela de usuários do Identity**, vinda da T-13 (design D6 de lá). Fica numa migration separada para a T-18 poder importar os usuários antes de criá-la.
- **Endpoints `/auth`:**
  - cadastro atômico de conta + petshop + vínculo numa transação (sucessor de `signup_petshop`), já devolvendo a sessão;
  - login, renovação de sessão (refresh com rotação e detecção de reuso), logout e `GET /auth/me`;
  - confirmação de e-mail.
- **Sessão:**
  - token de acesso JWT de vida curta, com as claims `sub`, `petshop_id` e `email`, que o isolamento da T-13 já lê;
  - refresh token opaco, guardado só como hash, que o frontend da T-16 vai manter no `localStorage` (decisão do usuário: cookie entre domínios não funciona no Safari sem domínio próprio).
- **Confirmação de e-mail com regra liga/desliga:**
  - o cadastro gera o link de confirmação e o entrega a uma interface de envio que, nesta etapa, só grava no log;
  - a exigência de e-mail confirmado no login existe, mas **desligada por configuração** até a T-18 (decisão do usuário).
- **Senhas importadas do Supabase:** um verificador de senha aceita o hash bcrypt de `auth.users` e regrava no formato do Identity no primeiro login (T-11 D4). Assim, a T-18 vira só importação de dados.
- **Proteção:**
  - todo endpoint exige token, a não ser os declarados públicos (`/health` e os de `/auth` que abrem sessão);
  - limite simples de tentativas no login e no cadastro (§4.2).
- **Fora desta change, numa tarefa nova (T-22, antes da T-18; decisão do usuário):** provedor de e-mail real, recuperação de senha, reenvio de confirmação e as telas do frontend que abrem esses links. O `ROADMAPV1.md` ganha a T-22, e a T-18 passa a depender dela.
- Nenhuma mudança no frontend nem no projeto Supabase. A produção continua no V0.

## Capabilities

### New Capabilities
- `api-auth`: identificação do usuário pela API do V1 — conta com e-mail e senha criada junto com o petshop, login, sessão por token de acesso + refresh token com rotação, logout, confirmação de e-mail, endpoints protegidos por padrão, limite de tentativas e compatibilidade com as senhas das contas do V0.

### Modified Capabilities
<!-- nenhuma — `auth` continua descrevendo o V0 em produção (Supabase Auth) e é reconciliada com api-auth na T-18; api-tenant-data não muda: o token só passa a carregar as claims que ela já exigia -->

## Impact

- **Arquivos novos:** `backend/Api/Endpoints/AuthEndpoints.cs`; serviços de autenticação, tokens e e-mail em `backend/Api/Services/`; DTOs em `backend/Api/Models/`; entidades do Identity e de refresh token em `backend/Api/Data/`; duas migrations; testes em `backend/Api.Tests/`.
- **Arquivos alterados:** `AppDbContext` (passa a herdar do contexto do Identity), `Program.cs` (autenticação, autorização, rate limit), `appsettings*.json` (seções `Jwt`, `Auth`, `RateLimit`), `backend/README.md`, `ROADMAPV1.md`, `CLAUDE.md`, `SchemaCompatibilityTests` (o ensaio da T-18 passa a incluir a importação de usuários).
- **Dependências novas (NuGet):** `Microsoft.AspNetCore.Identity.EntityFrameworkCore`, `Microsoft.AspNetCore.Authentication.JwtBearer` e `BCrypt.Net-Next`; nos testes, `Microsoft.Extensions.TimeProvider.Testing`.
- **Configuração nova:** `Jwt:SigningKey` (segredo; em desenvolvimento só um valor local, e no Azure pela T-17), `Jwt:Issuer`/`Audience`, `Auth:RequireConfirmedEmail` (desligado) e `Auth:FrontendBaseUrl`.
- **Produção:** nenhum efeito. A API continua sem publicação e sem acesso ao banco de produção.
