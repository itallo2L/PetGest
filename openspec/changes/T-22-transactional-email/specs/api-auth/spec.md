## ADDED Requirements

### Requirement: Envio de e-mail pelo provedor configurado
A API SHALL entregar os e-mails de confirmação e de redefinição de senha ao provedor indicado pela configuração: em desenvolvimento, só no log; nos ambientes publicados, um provedor real de e-mail. Cada e-mail SHALL ter texto puro e HTML, em português, informando a validade do link e o que fazer se a pessoa não fez o pedido. A API MUST NOT subir com a configuração de e-mail incompleta, nem com a exigência de e-mail confirmado ligada fora de desenvolvimento e o envio só no log.

#### Scenario: Provedor real configurado
- **WHEN** a API está configurada com o provedor real e uma conta é criada
- **THEN** o provedor recebe o e-mail de confirmação, com texto e HTML, para o e-mail da conta

#### Scenario: Configuração incompleta
- **WHEN** a API é iniciada com o provedor real sem as credenciais ou sem o remetente
- **THEN** a inicialização falha com uma mensagem que nomeia a configuração que falta

### Requirement: Recuperação de senha
A API SHALL oferecer `POST /auth/forgot-password`, público, que recebe um e-mail e responde `202` sempre — exista ou não uma conta com ele —, enviando para a conta existente um link `{endereço do frontend}/redefinir-senha` com o identificador do usuário e um código válido por 1 hora. A API SHALL oferecer `POST /auth/reset-password`, público, que recebe o identificador, o código e a senha nova e responde `204` trocando a senha. Depois da troca, o mesmo código SHALL deixar de valer, o e-mail da conta SHALL constar como confirmado e todas as sessões abertas da conta SHALL ser encerradas. Código inválido, expirado, já usado ou de outra conta SHALL receber `400` com o código `invalid_reset`; senha nova abaixo do mínimo SHALL receber `400` com o código `weak_password`, mantendo o código válido.

#### Scenario: Pedido para e-mail sem conta
- **WHEN** alguém pede a redefinição para um e-mail sem conta
- **THEN** a resposta é `202`, igual à de um e-mail com conta, e nenhum e-mail é enviado

#### Scenario: Senha redefinida
- **WHEN** o dono da conta usa o link recebido com uma senha nova válida
- **THEN** a resposta é `204`, a senha antiga deixa de entrar, a nova entra e o refresh token de uma sessão aberta antes é recusado

#### Scenario: Link usado de novo
- **WHEN** o mesmo link é usado uma segunda vez
- **THEN** a resposta é `400` com o código `invalid_reset`

#### Scenario: Link vencido
- **WHEN** o link é usado mais de 1 hora depois do pedido
- **THEN** a resposta é `400` com o código `invalid_reset`

#### Scenario: Senha nova fraca
- **WHEN** o link é usado com uma senha nova de 3 caracteres
- **THEN** a resposta é `400` com o código `weak_password`, e o mesmo link ainda aceita uma senha válida

### Requirement: Reenvio da confirmação de e-mail
A API SHALL oferecer `POST /auth/resend-confirmation`, público, que recebe um e-mail e responde `202` sempre, enviando um link de confirmação novo somente se existir uma conta com aquele e-mail e ela ainda não estiver confirmada.

#### Scenario: Conta não confirmada
- **WHEN** uma conta ainda não confirmada pede o reenvio
- **THEN** recebe um link novo, que confirma o e-mail

#### Scenario: Conta já confirmada ou inexistente
- **WHEN** o reenvio é pedido para uma conta já confirmada ou para um e-mail sem conta
- **THEN** a resposta é `202` e nenhum e-mail é enviado

## MODIFIED Requirements

### Requirement: Limite de tentativas
A API SHALL limitar, por endereço de origem, o número de chamadas a cadastro, login, confirmação de e-mail, pedido e uso do link de redefinição de senha e reenvio da confirmação numa janela de tempo, com valores definidos pela configuração (padrão: 10 por minuto). Chamadas acima do limite SHALL receber `429`.

#### Scenario: Excesso de tentativas de login
- **WHEN** o mesmo endereço faz mais chamadas de login do que o limite configurado dentro da janela
- **THEN** as chamadas excedentes recebem `429` até a janela seguinte

#### Scenario: Excesso de pedidos de redefinição
- **WHEN** o mesmo endereço pede a redefinição de senha mais vezes do que o limite configurado dentro da janela
- **THEN** os pedidos excedentes recebem `429` e nenhum e-mail é enviado por eles
