## Why

A T-14 deixou a confirmação de e-mail com envio só para o log e tirou a recuperação de senha do escopo. Sem envio real, ninguém confirma o e-mail, e a T-18 liga a exigência de e-mail confirmado na virada: por isso esta tarefa é pré-requisito da T-18 (`ROADMAPV1.md`, T-22). Sem recuperação de senha, quem esquece a senha perde o acesso à loja, e o V0 (Supabase) também não oferecia esse caminho nas telas.

## What Changes

- **Provedor de e-mail escolhido:** Azure Communication Services (ACS) Email, com o domínio gerenciado do Azure (`*.azurecomm.net`), pela API REST com assinatura HMAC (`AcsEmailSender`). `Email:Provider` escolhe `log` (desenvolvimento) ou `acs`; configuração incompleta impede a API de subir.
- **Recuperação de senha:**
  - `POST /auth/forgot-password` responde `202` exista ou não a conta, e envia o link `/redefinir-senha` (válido por 1 hora, uso único);
  - `POST /auth/reset-password` troca a senha, confirma o e-mail e encerra todas as sessões abertas da conta.
- **Reenvio da confirmação:** `POST /auth/resend-confirmation`, também `202` sempre.
- **Textos definitivos dos e-mails** em PT-BR, em texto e em HTML simples.
- **Limite de tentativas** passa a valer também para os três endpoints novos.
- **Frontend (modo `api`):**
  - telas `/esqueci-senha`, `/redefinir-senha` e `/confirmar-email`;
  - link "Esqueci minha senha" na tela de entrar;
  - reenvio da confirmação quando o login responde "e-mail não confirmado".
  - No modo `supabase` (produção do V0) nada disso aparece.

## Capabilities

### New Capabilities
- `account-links`: telas do frontend que tratam dos links enviados por e-mail — pedir e usar o link de redefinição de senha, confirmar o e-mail e pedir um link de confirmação novo.

### Modified Capabilities
- `api-auth`: recuperação de senha, reenvio da confirmação, envio pelo provedor configurado e limite de tentativas nos endpoints novos.

## Impact

- **Backend, arquivos novos:** `Services/EmailSettings.cs`, `AcsEmailSender.cs`, `EmailTemplates.cs`, `PasswordResetTokenProvider.cs`; testes `PasswordResetTests`, `ResendConfirmationTests` e `EmailProviderTests`.
- **Backend, arquivos alterados:** `AuthService`, `AuthEndpoints`, `AuthModels`, `AuthResult`, `AuthSetup`, `EmailSender`, `Program.cs`; `ProtectedEndpointTests` (três rotas públicas novas) e `RateLimitTests`.
- **Frontend, arquivos novos:** `ForgotPasswordPage`, `ResetPasswordPage`, `ConfirmEmailPage`, `ResendConfirmation`, `shared/backend/api/account.ts` e o teste dele.
- **Frontend, arquivos alterados:** `App.tsx`, `LoginPage`, `PasswordField`, `authErrors`, `auth.css`, `shared/backend/types.ts`, `errors.ts`, `api/client.ts` (resposta `202` sem corpo), `api/index.ts`, `schema.ts` (regerado).
- **Banco:** nenhuma migration (as chaves do Data Protection já estão no banco desde a T-17).
- **Dependências:** nenhuma nova.
- **Produção:** nenhum efeito. O recurso do ACS e as configurações `Email__*` são criados pelo usuário (`backend/DEPLOY.md`).
