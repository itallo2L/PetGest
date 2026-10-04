## Purpose

Identificar o usuário do PetGest pela API do V1 — conta com e-mail e senha criada junto com o petshop, login e sessão por token — de forma que cada requisição autenticada carregue o usuário e o petshop que o isolamento de dados (`api-tenant-data`) usa, sem depender do Supabase Auth.

## ADDED Requirements

### Requirement: Cadastro atômico de conta e petshop
A API SHALL oferecer `POST /auth/signup`, público, que recebe e-mail e senha da conta, mais nome, e-mail de contato e telefone opcional da loja, e cria numa única operação a conta, o petshop e o vínculo entre os dois. A resposta de sucesso SHALL ser `201` e já trazer uma sessão ativa. Se qualquer parte falhar, nada SHALL ficar gravado. Espaços nas pontas dos campos de texto SHALL ser removidos, e telefone vazio SHALL virar ausente.

#### Scenario: Cadastro de conta nova
- **WHEN** alguém se cadastra com um e-mail ainda não usado, senha válida e os dados da loja
- **THEN** a resposta é `201` com uma sessão cujo token traz o usuário novo e o petshop novo, e a conta, o petshop e o vínculo existem no banco

#### Scenario: E-mail já cadastrado
- **WHEN** alguém tenta se cadastrar com um e-mail que já tem conta, mesmo com letras maiúsculas e minúsculas diferentes
- **THEN** a resposta é `409` com o código `email_taken`, e nenhuma conta, petshop ou vínculo novo é criado

#### Scenario: Dados inválidos
- **WHEN** o cadastro chega com e-mail mal formado, senha com menos de 6 caracteres, ou nome ou e-mail da loja em branco
- **THEN** a resposta é `400` indicando os campos inválidos (`weak_password` para a senha), e nada é gravado

### Requirement: Login com e-mail e senha
A API SHALL oferecer `POST /auth/login`, público, que abre uma sessão para quem informar e-mail e senha corretos. Credenciais incorretas SHALL ser recusadas com a mesma resposta, exista ou não uma conta com aquele e-mail.

#### Scenario: Credenciais corretas
- **WHEN** o usuário informa o e-mail e a senha da própria conta
- **THEN** a resposta é `200` com uma sessão ativa

#### Scenario: Senha errada ou e-mail desconhecido
- **WHEN** alguém informa um e-mail cadastrado com a senha errada, ou um e-mail sem conta
- **THEN** a resposta é `401` com o código `invalid_credentials` nos dois casos, e nenhuma sessão é aberta

### Requirement: Exigência de e-mail confirmado configurável
A API SHALL ter uma configuração que liga ou desliga a exigência de e-mail confirmado para abrir sessão, desligada por padrão. Com ela ligada, login e renovação de sessão de conta com e-mail não confirmado SHALL ser recusados com `403` e o código `email_not_confirmed`, depois de as credenciais serem conferidas. Com ela desligada, contas não confirmadas SHALL abrir sessão normalmente.

#### Scenario: Exigência desligada
- **WHEN** uma conta com e-mail ainda não confirmado faz login com a exigência desligada
- **THEN** a resposta é `200` com uma sessão ativa

#### Scenario: Exigência ligada e e-mail não confirmado
- **WHEN** uma conta com e-mail não confirmado faz login com a senha certa e a exigência ligada
- **THEN** a resposta é `403` com o código `email_not_confirmed`, e nenhuma sessão é aberta

#### Scenario: Exigência ligada e senha errada
- **WHEN** uma conta com e-mail não confirmado faz login com a senha errada e a exigência ligada
- **THEN** a resposta é `401` com o código `invalid_credentials`, sem revelar o estado da confirmação

### Requirement: Sessão com token de acesso e refresh token
Toda sessão aberta pela API (cadastro, login ou renovação) SHALL ser composta de um token de acesso assinado, válido por 15 minutos, e de um refresh token opaco, válido por 30 dias. O token de acesso SHALL trazer o identificador do usuário, o e-mail e, quando a conta tem vínculo, o identificador do petshop. O banco MUST NOT guardar o refresh token em texto: só um valor derivado que não permite reconstruí-lo.

#### Scenario: Conteúdo do token de acesso
- **WHEN** uma conta vinculada ao petshop P abre uma sessão
- **THEN** o token de acesso traz o usuário, o e-mail e o petshop P, e expira 15 minutos depois de emitido

#### Scenario: Conta sem petshop
- **WHEN** uma conta sem vínculo (por exemplo, importada do V0 sem ter concluído o cadastro da loja) abre uma sessão
- **THEN** o token de acesso não traz petshop, e as consultas feitas com ele não devolvem nenhum petshop nem produto

#### Scenario: Refresh token no banco
- **WHEN** uma sessão é aberta
- **THEN** o refresh token devolvido ao cliente não aparece em texto em nenhuma tabela

### Requirement: Renovação da sessão com rotação
A API SHALL oferecer `POST /auth/refresh`, público, que troca um refresh token válido por uma sessão nova, com token de acesso novo e refresh token novo, e invalida o refresh token usado. Apresentar de novo um refresh token já usado SHALL invalidar todos os refresh tokens daquela linha de renovações. Refresh token inválido, expirado, revogado ou reusado SHALL receber `401` com o código `invalid_refresh_token`.

#### Scenario: Renovação normal
- **WHEN** o cliente envia o refresh token mais recente da sessão, ainda dentro da validade
- **THEN** a resposta é `200` com uma sessão nova, e o refresh token enviado deixa de valer

#### Scenario: Reuso de refresh token
- **WHEN** um refresh token que já foi trocado é enviado de novo
- **THEN** a resposta é `401`, e o refresh token mais recente daquela linha também deixa de valer

#### Scenario: Refresh token expirado
- **WHEN** o cliente envia um refresh token emitido há mais de 30 dias e nunca trocado
- **THEN** a resposta é `401` com o código `invalid_refresh_token`

#### Scenario: Petshop atualizado na renovação
- **WHEN** uma sessão é renovada
- **THEN** o token de acesso novo traz o petshop do vínculo atual da conta

### Requirement: Logout
A API SHALL oferecer `POST /auth/logout`, que recebe o refresh token da sessão e invalida a linha de renovações dele. A resposta SHALL ser `204` mesmo quando o token informado já não vale, para não revelar o estado de outras sessões. O token de acesso já emitido continua válido até expirar.

#### Scenario: Sair
- **WHEN** o usuário sai informando o refresh token da sessão
- **THEN** a resposta é `204`, e esse refresh token não renova mais a sessão

#### Scenario: Sair com token que já não vale
- **WHEN** alguém chama o logout com um refresh token desconhecido ou já revogado
- **THEN** a resposta é `204` e nada mais muda

### Requirement: Dados da sessão atual
A API SHALL oferecer `GET /auth/me`, protegido, que devolve o identificador do usuário, o e-mail, se o e-mail está confirmado e o identificador do petshop da sessão (ou ausente, para conta sem vínculo).

#### Scenario: Sessão válida
- **WHEN** um usuário chama `GET /auth/me` com um token de acesso válido
- **THEN** recebe `200` com os próprios dados e o petshop do token

#### Scenario: Sem token
- **WHEN** alguém chama `GET /auth/me` sem token
- **THEN** recebe `401`

### Requirement: Endpoints protegidos por padrão
Todo endpoint da API SHALL exigir um token de acesso válido, a não ser os declarados públicos: `GET /health`, os documentos OpenAPI de desenvolvimento e `POST /auth/signup`, `/auth/login`, `/auth/refresh`, `/auth/logout` e `/auth/confirm-email`. Token ausente, mal assinado, de outro emissor ou expirado SHALL receber `401`.

#### Scenario: Token expirado
- **WHEN** alguém chama um endpoint protegido com um token de acesso emitido há mais de 15 minutos
- **THEN** a resposta é `401`

#### Scenario: Token com assinatura inválida
- **WHEN** alguém chama um endpoint protegido com um token alterado ou assinado com outra chave
- **THEN** a resposta é `401`

#### Scenario: Endpoint público
- **WHEN** alguém chama `GET /health` sem token
- **THEN** a resposta não é `401` nem `403`

### Requirement: Confirmação de e-mail
Ao criar uma conta, a API SHALL gerar um link de confirmação, válido por 24 horas, apontando para o endereço do frontend configurado, e entregá-lo ao mecanismo de envio de e-mail configurado. A API SHALL oferecer `POST /auth/confirm-email`, público, que recebe o identificador do usuário e o código do link e marca o e-mail como confirmado. Código inválido, expirado ou de outro usuário SHALL receber `400` com o código `invalid_confirmation`; confirmar de novo um e-mail já confirmado, com código válido, SHALL responder `204` sem outro efeito. Falha no envio do e-mail MUST NOT desfazer o cadastro.

#### Scenario: Link gerado no cadastro
- **WHEN** uma conta é criada
- **THEN** o mecanismo de envio recebe, para o e-mail da conta, um link com o endereço do frontend, o usuário e o código

#### Scenario: Confirmação válida
- **WHEN** o identificador e o código do link da conta são enviados para `/auth/confirm-email`
- **THEN** a resposta é `204`, o e-mail passa a constar como confirmado e, com a exigência ligada, a conta passa a abrir sessão

#### Scenario: Código inválido
- **WHEN** um código alterado, ou o código de outra conta, é enviado
- **THEN** a resposta é `400` com o código `invalid_confirmation`, e o e-mail continua não confirmado

### Requirement: Senhas das contas importadas do V0
A API SHALL aceitar, no login, a senha de uma conta cujo hash armazenado está no formato bcrypt usado pelo Supabase Auth (prefixos `$2a$`/`$2b$`/`$2y$`), e SHALL regravar esse hash no formato padrão da API no primeiro login bem-sucedido. Senha errada para esse tipo de conta SHALL ser recusada como qualquer outra.

#### Scenario: Primeiro login de conta importada
- **WHEN** uma conta com hash bcrypt faz login com a senha correta
- **THEN** a resposta é `200`, e o hash guardado deixa de ser bcrypt

#### Scenario: Senha errada em conta importada
- **WHEN** uma conta com hash bcrypt faz login com a senha errada
- **THEN** a resposta é `401` com o código `invalid_credentials`, e o hash continua o mesmo

### Requirement: Limite de tentativas
A API SHALL limitar, por endereço de origem, o número de chamadas a cadastro, login e confirmação de e-mail numa janela de tempo, com valores definidos pela configuração (padrão: 10 por minuto). Chamadas acima do limite SHALL receber `429`.

#### Scenario: Excesso de tentativas de login
- **WHEN** o mesmo endereço faz mais chamadas de login do que o limite configurado dentro da janela
- **THEN** as chamadas excedentes recebem `429` até a janela seguinte

### Requirement: Contas fora do schema exposto e vínculo com integridade
As contas, os refresh tokens e os demais dados de autenticação SHALL ficar num schema próprio do banco (`identity`), separado do schema das tabelas da loja. O vínculo usuário → petshop SHALL referenciar a conta com integridade referencial, e excluir a conta SHALL excluir o vínculo.

#### Scenario: Vínculo para conta inexistente
- **WHEN** se tenta gravar um vínculo cujo usuário não existe entre as contas
- **THEN** o banco recusa a gravação

#### Scenario: Exclusão de conta
- **WHEN** uma conta é excluída
- **THEN** o vínculo dela com o petshop é excluído junto
