## Context

Motivação em `proposal.md`; comportamento exigido em `specs/api-auth/spec.md`.

- **API hoje (T-12, T-13):** `AppDbContext : DbContext` com `Petshop`/`Profile`/`Product`, filtros globais por `CurrentPetshopId`/`CurrentUserId` e o `TenantWriteGuard`. `ClaimsTenantContext` lê `sub` (ou `NameIdentifier`) e `petshop_id` de um usuário **autenticado**. `profiles.id` está sem FK. Migrations `V0Schema` e `ProductSourceAi`. Ainda não há autenticação, autorização nem rate limit no `Program.cs`. Testes contra Postgres real: `petgest_tests` (fixture), `petgest_v0`/`petgest_v0_ef` (ensaio da T-18).
- **Frontend do V0** (fica igual até a T-16): senha mínima de 6 caracteres (`MIN_PASSWORD_LENGTH`), códigos de erro do Supabase mapeados em `authErrors.ts` (`invalid_credentials`, `email_exists`, `weak_password`, `over_request_rate_limit`), cadastro em dois passos (`signUp` + `rpc('signup_petshop')`).
- **Decisões herdadas:** Identity com `Guid`, papel único, JWT curto + refresh com rotação guardado com hash (T-11 D3); importação dos usuários com o hash bcrypt e regravação no login (T-11 D4); tabelas do Identity no schema `identity` (T-11 D2); FK de `profiles.id` vinda da T-13 (D6 de lá).
- **Decisões do usuário para esta change:**
  - e-mail real, recuperação de senha e reenvio de confirmação vão para a T-22;
  - a exigência de e-mail confirmado já existe, mas fica desligada até a T-18;
  - o refresh token fica no `localStorage` do frontend.

## Goals / Non-Goals

**Goals:**
- A T-15 só precisa escrever endpoints: qualquer rota nova nasce protegida, e o token já traz o petshop que os filtros da T-13 usam.
- A T-18 vira operação de dados: importar `auth.users` para `identity.users` entre duas migrations já ensaiadas, sem código novo de autenticação.
- Tokens e senhas guardados de um jeito que um vazamento do banco não abra sessões: refresh só como hash e senha só como hash.

**Non-Goals:**
- Provedor de e-mail real, recuperação de senha, reenvio de confirmação e telas do frontend (T-22, T-16).
- Persistência das chaves de Data Protection e do segredo JWT no Azure, `ForwardedHeaders` atrás do proxy do App Service (T-17).
- Bloqueio de conta por tentativas (lockout), 2FA, papéis, login social (§4.2).
- Importar usuários ou mexer no projeto Supabase (T-18).

## Decisions

### D1. Identity "core", sem cookies nem papéis: `IdentityUserContext<AppUser, Guid>`
`AppDbContext` passa a herdar de `IdentityUserContext<AppUser, Guid>`, que traz usuários, claims, logins e tokens, sem as tabelas de papéis, já que o papel é único. `AppUser : IdentityUser<Guid>`. Registro com `AddIdentityCore<AppUser>()` + `AddEntityFrameworkStores<AppDbContext>()` + `AddDefaultTokenProviders()`, que dá os códigos de confirmação de e-mail. Usamos só o `UserManager`; o `SignInManager` é pensado para cookies.

Opções:
- senha com mínimo de 6 caracteres e sem regras de composição — paridade com o V0 (`MIN_PASSWORD_LENGTH = 6`), para os usuários importados e as mensagens atuais continuarem valendo;
- `RequireUniqueEmail = true` e `UserName = email`;
- `SignIn.RequireConfirmedEmail = false` no Identity, porque a regra do V1 é a nossa configuração (D6);
- lockout desligado.

Mapeamento (em `Data/Configurations/`): schema `identity`, tabelas `users`, `user_claims`, `user_logins`, `user_tokens`, `refresh_tokens`, com colunas em *snake_case* pela convenção da T-13. O índice de `normalized_email` passa a ser **único**: o Identity cria esse índice não único e só confere duplicidade antes de gravar, o que deixa passar dois cadastros simultâneos.

Os filtros globais da T-13 continuam só nas tabelas da loja. As tabelas do Identity não têm filtro, porque o login precisa achar o usuário sem tenant.

Alternativas descartadas:
- `MapIdentityApi` do .NET 8+: emite token opaco próprio (não JWT), não cria o petshop junto e fixa rotas e formatos;
- `IdentityDbContext` completo: tabelas de papéis sem uso.

### D2. Duas migrations: `IdentitySchema` e `ProfilesUserFk`
- **`IdentitySchema`:** `create schema identity` e as cinco tabelas. Gerada com o modelo **ainda sem** o relacionamento `Profile → AppUser`.
- **`ProfilesUserFk`:** `alter table profiles drop constraint if exists profiles_id_fkey` (a FK do V0 para `auth.users`, que só existe no banco de produção) e cria `profiles_id_fkey → identity.users(id) on delete cascade` (mesmo nome e comportamento do V0).

Separadas para a ordem da T-18 funcionar: `IdentitySchema` → importar `auth.users` para `identity.users` com os mesmos ids → `ProfilesUserFk`. Numa migration só, a FK seria criada antes de os usuários existirem e falharia em produção.

O `SchemaCompatibilityTests` passa a ensaiar essa sequência no `petgest_v0`:
1. baseline da `V0Schema`;
2. migrar até `IdentitySchema`;
3. inserir em `identity.users` um usuário com o mesmo id de uma linha de `auth.users` que tem vínculo, com hash bcrypt;
4. migrar o resto;
5. conferir que `profiles_id_fkey` aponta para `identity.users`.

### D3. Token de acesso: JWT HS256 de 15 minutos
Emitido pelo `JsonWebTokenHandler` (vem com o pacote `JwtBearer`), assinado com HMAC-SHA256 usando a chave `Jwt:SigningKey`, de pelo menos 32 bytes. Sem chave, ou com chave curta, a API não sobe e a mensagem nomeia a chave, como já acontece com `ConnectionStrings:Default`.

Claims:
- `sub` (usuário), `email`, `petshop_id` (omitida para conta sem vínculo);
- `jti`, `iat`, `exp`, `iss` (`Jwt:Issuer`) e `aud` (`Jwt:Audience`).

O petshop vem do vínculo lido na emissão. A emissão roda numa requisição anônima, então o filtro de `Profile` esconderia o vínculo: a leitura usa `IgnoreQueryFilters()` com filtro explícito pelo id do usuário. Essa é uma das exceções que a T-13 previu ("só o cadastro da T-14"), e fica isolada no serviço de sessão.

Validação: `AddJwtBearer` com `MapInboundClaims = false`, para `sub` continuar `sub`; emissor, audiência, assinatura e validade obrigatórios; `ClockSkew = 0`, porque há um servidor só e a spec diz "15 minutos", não 20.

Simétrica e não RS256 porque quem emite e quem valida é o mesmo processo; uma chave assimétrica só faz sentido quando terceiros validam. Trocar depois é configuração.

### D4. Refresh token opaco, guardado como SHA-256, com rotação por família
O refresh token tem 32 bytes aleatórios em base64url. A tabela `identity.refresh_tokens` guarda:
- `id`, `user_id` (FK em cascata), `token_hash` (SHA-256, único) e `family_id`;
- `created_at`, `expires_at`, `revoked_at` e `replaced_by_id`.

O valor tem entropia alta, então um hash sem sal não é reversível na prática, e a busca é por igualdade. A validade é de **30 dias desde a emissão de cada token**: a rotação renova o prazo, e quem fica 30 dias sem abrir o app faz login de novo. É o comportamento que o usuário percebe hoje no V0.

`POST /auth/refresh`, numa transação:
1. procura o token pelo hash;
2. inexistente ou expirado → `401`;
3. já revogado → **reuso**: revoga todos os tokens ativos da família e responde `401`;
4. válido → revoga o token, emite um novo na mesma família (`replaced_by_id`) e um JWT novo, com o petshop relido do vínculo.

O logout revoga a família do token informado e sempre responde `204`. O cadastro e o login começam uma família nova.

O relógio vem de um `TimeProvider` registrado no DI, para os testes avançarem 30 dias sem esperar.

Alternativa descartada: refresh token como JWT (sem estado) — não dá para revogar no logout nem detectar reuso sem guardar estado, que é justamente o que ele evitaria.

### D5. Cadastro atômico no `AuthService`
`POST /auth/signup`, numa transação explícita do `AppDbContext` (o `UserManager` usa o mesmo contexto):
1. valida o formato (DTO com DataAnnotations e a validação embutida de minimal APIs do .NET 10, `AddValidation()`);
2. `UserManager.CreateAsync` — e-mail repetido vira `409 email_taken`, senha fora da regra vira `400 weak_password`;
3. cria `Petshop` (nome e e-mail sem espaços nas pontas, telefone vazio → `null`) e `Profile`. A requisição é anônima, e o `TenantWriteGuard` da T-13 já permite inserir `Petshop`/`Profile`;
4. abre a sessão (D3/D4);
5. commit;
6. **depois do commit**, gera o código de confirmação e entrega o link ao `IEmailSender` (D6). Uma falha aí vai para o log e não desfaz o cadastro (spec).

Erros no formato `ProblemDetails` com uma extensão `code`: `email_taken`, `weak_password`, `invalid_credentials`, `email_not_confirmed`, `invalid_refresh_token`, `invalid_confirmation`. São os nomes que a T-16 vai mapear para as mensagens que o frontend já tem.

### D6. Confirmação de e-mail com envio de desenvolvimento e regra liga/desliga
`Services/IEmailSender` (interface própria, com `SendAsync(para, assunto, corpo)`) e `LogEmailSender`, que grava destinatário, assunto e link no log em `Information`. A T-22 troca pelo adaptador do provedor real só no registro de DI.

Link: `{Auth:FrontendBaseUrl}/confirmar-email?user={id}&code={código em base64url}`. O código vem de `GenerateEmailConfirmationTokenAsync`, do provedor padrão de Data Protection, com validade configurada para 24 horas.

`POST /auth/confirm-email` decodifica e chama `ConfirmEmailAsync`; falha → `400 invalid_confirmation`. Confirmar de novo com código válido é inofensivo (`204`).

`Auth:RequireConfirmedEmail` (padrão `false`) é conferido **depois** da senha no login, e também na renovação, para uma conta não confirmada não manter a sessão indefinidamente quando a regra for ligada. Ligado e não confirmado → `403 email_not_confirmed`. Na T-18, a configuração é ligada no App Service.

### D7. Hasher compatível com o bcrypt do Supabase
`CompatPasswordHasher : PasswordHasher<AppUser>` sobrescreve `VerifyHashedPassword`:
- hash começando com `$2a$`/`$2b$`/`$2y$` → `BCrypt.Net.BCrypt.Verify` → `SuccessRehashNeeded` ou `Failed`;
- qualquer outro → comportamento padrão (PBKDF2).

O `UserManager.CheckPasswordAsync` já regrava o hash quando recebe `SuccessRehashNeeded`.

Entra agora, e não na T-18, porque é código de autenticação testável hoje: o teste grava um usuário com hash bcrypt gerado pelo próprio `BCrypt.Net-Next` e faz login pela API. A T-18 fica só com a conferência dos hashes reais.

### D8. Protegido por padrão, rate limit e OpenAPI
- **Autorização:** `AddAuthorization` com `FallbackPolicy = RequireAuthenticatedUser`. Ficam explicitamente anônimos `/health` (já tinha `AllowAnonymous`), os endpoints públicos de `/auth` e `MapOpenApi()`. O Swagger UI é middleware e continua antes de `UseAuthentication`/`UseAuthorization`. Ordem: `UseCors` → Swagger (Development) → atalho de `404` → `UseRateLimiter` → `UseAuthentication` → `UseAuthorization` → endpoints. O atalho foi decidido na implementação: a política de fallback também vale para requisições **sem** endpoint, e sem ele uma rota inexistente responderia `401` em vez do `404` que a spec `api-platform` exige (o teste de OpenAPI em `Production` pegou).
- **Rate limit:** política `auth` de janela fixa, particionada pelo IP remoto, com `RateLimit:Auth:PermitLimit` (10) e `RateLimit:Auth:WindowSeconds` (60). Aplicada em signup, login e confirm-email; acima do limite → `429`. Atrás do proxy do App Service, o IP certo depende de `ForwardedHeaders`, que é da T-17.
- **OpenAPI:** esquema de segurança Bearer no documento, para o Swagger UI ter o botão *Authorize* e a T-16 gerar o cliente sabendo quais rotas exigem token.

### D9. Testes
Em `Api.Tests/Auth/`, pela API (`ApiFactory`) contra o `petgest_tests`, na coleção `Database` da T-13 (a fixture migra antes):
- **`ApiFactory`** ganha a chave JWT de teste, `RateLimit:Auth:PermitLimit` alto (as suítes fazem muitos logins pelo mesmo "IP" do `TestServer`), um `CapturingEmailSender` no lugar do `LogEmailSender` e, quando preciso, um `FakeTimeProvider`. A chave JWT entra em **todos** os ambientes do factory, porque o teste de OpenAPI com ambiente `Production` precisa que a API suba.
- **`SignupTests`, `LoginTests`, `RefreshTests`, `LogoutAndMeTests`, `ConfirmEmailTests`, `ProtectedEndpointTests`, `RateLimitTests`, `PasswordCompatibilityTests`:** um arquivo por requisito da spec.
- **Protegido por padrão:** como o `/auth/me` já responde `401` sozinho sem usuário, um teste HTTP não perceberia a remoção da política de fallback. Por isso `ProtectedEndpointTests` também audita o `EndpointDataSource`: confere que a política de fallback exige autenticação e que só as rotas públicas da spec têm `AllowAnonymous` (decidido na implementação; a sabotagem da 4.4 quebra esse teste).
- **Token expirado** é montado no teste com `exp` no passado e a mesma chave, sem depender de relógio. **Refresh expirado** usa o `FakeTimeProvider` avançado 30 dias.
- **De ponta a ponta com a T-13:** a T-14 não tem endpoint de dados, então a ligação com o isolamento é provada por dois cadastros pela API: o `GET /auth/me` de cada um devolve o próprio petshop, lido pelo `ClaimsTenantContext` real a partir do token, e as claims decodificadas batem com o vínculo gravado.
- **`SchemaCompatibilityTests`:** ensaio do D2.

## Risks / Trade-offs

- [Refresh token no `localStorage` é legível por um XSS no frontend] → aceito pelo usuário. O efeito é limitado pela rotação com detecção de reuso (um token roubado e usado derruba a família inteira) e pelos 15 minutos do token de acesso. CSP no frontend fica como melhoria da T-16.
- [Duas abas renovando ao mesmo tempo disparam a detecção de reuso e deslogam o usuário] → a T-16 faz a renovação em voo único (uma promessa compartilhada entre as chamadas) e sincroniza abas pelo evento `storage`. Registrado aqui para a T-16 não descobrir em campo.
- [Token de acesso continua valendo até 15 minutos depois do logout] → aceito. O logout revoga o refresh, e a T-15 não tem operação sensível a ponto de exigir lista de bloqueio.
- [Chaves de Data Protection voláteis (códigos de confirmação invalidados ao reiniciar)] → irrelevante em desenvolvimento. No App Service, a persistência das chaves entra no checklist da T-17.
- [Rate limit por IP com todos os clientes atrás de um NAT (wi-fi do petshop)] → 10 por minuto é folgado para uma loja. O valor é configurável.
- [Leitura do vínculo com `IgnoreQueryFilters()`] → só no serviço de sessão, com filtro explícito pelo usuário e um teste que confere o petshop do token.
- [Hash bcrypt com custo ou prefixo diferente do esperado] → o hasher aceita `$2a$`/`$2b$`/`$2y$`. A conferência dos hashes reais continua no checklist da T-18.

## Migration Plan

Nada vai para produção. Em desenvolvimento, `dotnet ef database update` aplica `IdentitySchema` e `ProfilesUserFk`. Na T-18 (ensaiado pelo `SchemaCompatibilityTests`):
1. baseline da `V0Schema`;
2. `ProductSourceAi` + `IdentitySchema`;
3. importar `auth.users` → `identity.users` (mesmo id, e-mail, `email_confirmed_at` → `email_confirmed`, `encrypted_password` → `password_hash`);
4. `ProfilesUserFk`;
5. ligar `Auth:RequireConfirmedEmail`.

Rollback desta change: reverter os commits e recriar o banco local.

## Open Questions

- Texto e formatação do e-mail de confirmação — hoje é só um link no log; o conteúdo definitivo é da T-22, junto com o provedor.
