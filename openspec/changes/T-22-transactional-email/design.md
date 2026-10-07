## Context

Motivação em `proposal.md`; comportamento exigido em `specs/api-auth/spec.md` e `specs/account-links/spec.md`.

- **O que já existe (T-14):**
  - `IEmailSender` com `LogEmailSender`;
  - link de confirmação `{Auth:FrontendBaseUrl}/confirmar-email?user=…&code=…` (24 horas) e `POST /auth/confirm-email`;
  - `Auth:RequireConfirmedEmail`, desligado até a T-18;
  - rate limit `auth` por IP.
- **Desde a T-17:** as chaves do Data Protection estão no banco, então os códigos sobrevivem a reinícios e deploys.
- **Pendência herdada:** a escolha do provedor estava "em aberto desde a T-11 (ex.: Azure Communication Services, Resend)", com remetente e domínio verificados (SPF/DKIM).
- **Restrição:** o projeto não tem domínio próprio; o frontend está em `pet-gest.vercel.app`.

## Goals / Non-Goals

**Goals:**
- Envio real de e-mail nos ambientes publicados, trocando só o registro de DI (o que a T-14 previu).
- Recuperar a senha sem revelar quais e-mails têm conta.
- Telas para os dois links, no padrão visual das telas de entrar.

**Non-Goals:**
- Domínio próprio, marca no remetente, templates com imagens.
- Fila de envio, reenvio automático em caso de falha, webhooks de entrega.
- Trocar o e-mail de acesso da conta, 2FA (`PLANOMVP.md` §4.2).
- Recuperação de senha no modo `supabase`: a produção do V0 não ganha recurso novo.

## Decisions

### D1. Provedor: Azure Communication Services Email, pela API REST
- **Por quê:**
  - o **domínio gerenciado do Azure** (`<id>.azurecomm.net`) já vem com SPF/DKIM configurados, sem domínio próprio, e é o que o roadmap pede;
  - fica na mesma conta e fatura do App Service;
  - custo por e-mail irrisório no volume de uma loja.
- **Alternativa descartada:** Resend. Mais simples de começar, mas sem domínio próprio só envia para o e-mail do dono da conta, o que não serve para clientes.
- **Por que REST e não o SDK `Azure.Communication.Email`:** é uma chamada só (`POST /emails:send`, api-version `2023-03-31`), com assinatura HMAC-SHA256 documentada:
  - `x-ms-date`, `x-ms-content-sha256` e `Authorization: HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=…`;
  - texto assinado: `VERBO\ncaminho?query\ndata;host;hash`.
  
  Com `HttpClient` o adaptador é testável com um `HttpMessageHandler` falso, que confere a assinatura byte a byte, e o projeto não ganha dependência nova. O envio responde `202`; não acompanhamos a operação (`operation-location`), porque falha de entrega não muda nenhuma regra.
- **Configuração:**
  - `Email:Provider` = `log` (padrão) | `acs`;
  - `Email:AcsConnectionString` (segredo);
  - `Email:Sender`.
  
  `EmailSettings.Validate` impede a API de subir quando: o provedor é desconhecido; `acs` está sem connection string válida ou sem remetente; ou `RequireConfirmedEmail` está ligado fora de Development com envio só no log (todas as contas novas ficariam trancadas).

### D2. Respostas que não revelam contas
`forgot-password` e `resend-confirmation` respondem `202` sempre: com ou sem conta, já confirmada ou não, e mesmo se o envio falhar (falha só vai para o log).
- **Limite conhecido:** quando há conta, o envio acrescenta a latência do provedor. Aceito, como no `MapIdentityApi` do próprio ASP.NET Core; uma fila só para igualar o tempo de resposta não paga a complexidade.
- Os três endpoints entram no rate limit `auth` (D8 da T-14), o que também limita o uso da API para mandar e-mails em massa.

### D3. Código de redefinição próprio: 1 hora, uso único, relógio injetável
`PasswordResetTokenProvider` (`IUserTwoFactorTokenProvider<AppUser>`, registrado como `Tokens.PasswordResetTokenProvider`) protege, com o Data Protection, a data de criação, o id do usuário, a finalidade e o carimbo de segurança.
- **Por que não o provedor padrão do Identity:**
  - o `DataProtectorTokenProvider` tem **um** prazo para todos os códigos, e a confirmação precisa de 24 horas;
  - ele lê o relógio do sistema por dentro, então a expiração não seria testável com o `FakeTimeProvider` dos testes.
- **Uso único:** a troca de senha muda o carimbo de segurança, e o código antigo deixa de conferir.
- **Senha fraca com link válido:** o `ResetPasswordAsync` do Identity confere o código, depois a senha, e só troca o carimbo quando dá certo. O mesmo link continua valendo para tentar de novo.
- **Ao redefinir:**
  - o e-mail fica confirmado, porque o link chegou nele (isso também destrava as contas importadas na T-18 que nunca confirmaram);
  - todos os refresh tokens ativos da conta são revogados, e as sessões abertas caem na próxima renovação.

### D4. Textos dos e-mails
`EmailTemplates` com dois e-mails (confirmação e redefinição), cada um em texto puro e HTML com estilos inline, sem imagens. As cores são as do app (`--primary` #108B91), e cada e-mail diz a validade do link e o que fazer se não foi a pessoa que pediu.

### D5. Frontend: `AccountBackend` opcional
- **Interface:** `Backend.account?`, com `requestPasswordReset`, `resetPassword`, `confirmEmail` e `resendConfirmation`. Só a implementação da API tem; no Supabase é `undefined`, e as telas escondem o link "Esqueci minha senha" e o reenvio. Assim a produção do V0 não muda.
- **Erros:** `invalid_reset` e `invalid_confirmation` viram o mesmo `kind` `invalid_link`, porque as duas telas mostram "link inválido" com a saída certa:
  - na redefinição, "Pedir um link novo";
  - na confirmação, o reenvio.
- **Rotas:**
  - `/esqueci-senha` fica sob `PublicOnly`;
  - `/redefinir-senha` e `/confirmar-email` ficam **fora** das guardas, porque o link pode ser aberto logado ou não. Depois de redefinir, a tela chama `signOut()`, já que a API encerrou as sessões.
- **Correção no cliente:** `request()` só tratava `204` como resposta sem corpo; o `202` vazio dos endpoints novos quebrava o `response.json()`. Agora qualquer resposta de sucesso sem corpo resolve `undefined`. O defeito foi achado pelo teste de unidade.

## Risks / Trade-offs

- [E-mail do domínio `azurecomm.net` cair no spam] → as telas dizem para conferir o spam; domínio próprio fica para quando houver um.
- [Cota do domínio gerenciado do ACS (limite baixo de envios por hora)] → suficiente para cadastro e recuperação de uma loja; trocar para domínio próprio aumenta a cota.
- [Latência revela que o e-mail tem conta] → D2; mitigado pelo rate limit.
- [Sessão encerrada em outros aparelhos depois de redefinir] → é o comportamento desejado; o texto da tela de sucesso avisa.
