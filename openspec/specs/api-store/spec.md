# api-store Specification

## Purpose

Expor pela API do V1 os dados da loja de cada conta — consultar e salvar nome, e-mail de contato e telefone — e permitir que uma conta autenticada sem loja crie a sua, sempre restrito à loja do token.

## Requirements


### Requirement: Consultar os dados da loja
A API SHALL oferecer `GET /petshop`, protegido, que devolve identificador, nome, e-mail de contato e telefone (ou ausente) do petshop do token. Uma conta sem petshop SHALL receber `404` com o código `petshop_not_found`.

#### Scenario: Conta com loja
- **WHEN** um usuário da loja A consulta os dados da loja
- **THEN** recebe `200` com o nome, o e-mail e o telefone de A

#### Scenario: Conta sem loja
- **WHEN** uma conta sem petshop consulta os dados da loja
- **THEN** recebe `404` com o código `petshop_not_found`

### Requirement: Salvar os dados da loja
A API SHALL oferecer `PUT /petshop`, protegido, que substitui nome, e-mail de contato e telefone do petshop do token e responde `200` com os dados gravados. A gravação SHALL acontecer somente no petshop do token, mesmo que o corpo traga outro identificador. Telefone vazio ou ausente SHALL deixar a loja sem telefone, e espaços nas pontas SHALL ser removidos. Alterar o e-mail da loja MUST NOT alterar o e-mail usado para entrar.

#### Scenario: Alterar o nome
- **WHEN** um usuário de A troca o nome para "Pet Shop Amigo Fiel"
- **THEN** recebe `200` com o nome novo, e uma consulta seguinte devolve o nome novo

#### Scenario: Telefone em branco
- **WHEN** um usuário de A salva a loja com o telefone vazio
- **THEN** a loja fica sem telefone

#### Scenario: Identificador de outra loja no corpo
- **WHEN** um usuário de A salva os dados enviando o identificador da loja B no corpo
- **THEN** só a loja A é alterada, e B continua como estava

#### Scenario: E-mail da loja separado do acesso
- **WHEN** um usuário troca o e-mail da loja
- **THEN** continua entrando na conta com o e-mail de acesso anterior

#### Scenario: Conta sem loja
- **WHEN** uma conta sem petshop tenta salvar os dados da loja
- **THEN** recebe `404` com o código `petshop_not_found`

### Requirement: Validação dos dados da loja
Salvar ou criar a loja SHALL recusar com `400`, indicando o campo e sem gravar nada: nome vazio (ou só com espaços) ou com mais de 200 caracteres, e-mail vazio ou em formato inválido, e telefone com mais de 40 caracteres.

#### Scenario: Nome vazio
- **WHEN** alguém salva a loja com o nome em branco
- **THEN** recebe `400` indicando o nome, e nada é gravado

#### Scenario: E-mail inválido
- **WHEN** alguém salva a loja com o e-mail "contato@"
- **THEN** recebe `400` indicando o e-mail, e nada é gravado

### Requirement: Criar a loja de uma conta sem loja
A API SHALL oferecer `POST /petshop`, protegido, que cria o petshop e o vínculo para a conta do token quando ela ainda não tem um, e responde `201` com os dados da loja. Conta que já tem loja SHALL receber `409` com o código `petshop_exists`, sem criar nada. O token usado na chamada continua sem petshop: a resposta SHALL deixar claro que a sessão precisa ser renovada (`/auth/refresh`) para o token passar a trazer a loja nova.

#### Scenario: Conta sem loja conclui o cadastro
- **WHEN** uma conta autenticada sem petshop cria a loja com nome, e-mail e telefone
- **THEN** recebe `201`, a loja e o vínculo existem, e a renovação da sessão devolve um token com o petshop novo

#### Scenario: Conta que já tem loja
- **WHEN** uma conta que já tem petshop chama a criação de loja
- **THEN** recebe `409` com o código `petshop_exists`, e nenhum petshop novo é criado
