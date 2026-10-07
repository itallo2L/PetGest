## Purpose

Telas do frontend que tratam dos links enviados por e-mail pela API do V1: pedir e usar o link de redefinição de senha, confirmar o e-mail da conta e pedir um link de confirmação novo. Só existem no modo `api`; no modo `supabase` (V0) nada disso aparece.

## ADDED Requirements

### Requirement: Esqueci minha senha
No modo `api`, a tela de entrar SHALL mostrar o link "Esqueci minha senha", que leva a uma tela onde o usuário informa o e-mail da conta. Ao enviar um e-mail válido, a tela SHALL mostrar a mesma confirmação exista ou não uma conta com ele, dizendo que o link vale por 1 hora e para conferir a caixa de spam. E-mail em formato inválido SHALL ser recusado sem chamar o backend.

#### Scenario: Pedido enviado
- **WHEN** o usuário informa o e-mail da conta e envia
- **THEN** a tela diz que, se houver uma conta com aquele e-mail, um link foi enviado

#### Scenario: Modo Supabase
- **WHEN** o app roda no modo `supabase`
- **THEN** a tela de entrar não mostra "Esqueci minha senha"

### Requirement: Criar senha nova pelo link
A tela aberta pelo link de redefinição SHALL pedir a senha nova (com o mínimo de caracteres da conta) e, ao salvar com sucesso, SHALL encerrar a sessão deste navegador e oferecer a entrada com a senha nova. Link inválido, expirado ou já usado SHALL levar a uma mensagem que explique a validade do link e ofereça pedir um link novo. A tela SHALL funcionar com ou sem sessão aberta no navegador.

#### Scenario: Senha alterada
- **WHEN** o usuário abre o link e salva uma senha nova válida
- **THEN** a tela confirma a troca e oferece "Entrar com a senha nova"

#### Scenario: Link usado de novo
- **WHEN** o mesmo link é aberto e usado outra vez
- **THEN** a tela mostra "Link inválido" com a opção de pedir um link novo

### Requirement: Confirmar o e-mail pelo link
A tela aberta pelo link de confirmação SHALL confirmar o e-mail sozinha, sem pedir nada ao usuário, e mostrar o resultado: confirmado — com o caminho para o app, se houver sessão, ou para entrar, se não houver —, ou link inválido, com um formulário para pedir um link novo. Falha de conexão SHALL oferecer "Tentar de novo".

#### Scenario: Link válido com sessão aberta
- **WHEN** um usuário logado abre o link de confirmação da conta
- **THEN** a tela mostra "E-mail confirmado" com o botão "Ir para o PetGest"

#### Scenario: Link inválido
- **WHEN** o link de confirmação é inválido ou expirou
- **THEN** a tela mostra "Link inválido" e permite pedir um link novo informando o e-mail

### Requirement: Reenvio da confirmação ao entrar
Quando o login for recusado porque o e-mail da conta não foi confirmado, a tela de entrar SHALL mostrar, além da mensagem, a opção de reenviar o e-mail de confirmação para o e-mail digitado. A confirmação do reenvio SHALL ser a mesma exista ou não a conta.

#### Scenario: E-mail não confirmado
- **WHEN** o usuário tenta entrar com uma conta cujo e-mail não foi confirmado, com a exigência ligada
- **THEN** a tela mostra a mensagem de confirmação pendente e o botão "Reenviar e-mail de confirmação"
