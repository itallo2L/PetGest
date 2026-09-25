## Purpose

Permitir que o usuário consulte e corrija os dados da própria loja — nome, e-mail de contato e telefone — informados no cadastro.

## ADDED Requirements

### Requirement: Consultar os dados da loja
A área Configurações SHALL mostrar um formulário "Dados da loja" preenchido com o nome, o e-mail de contato e o telefone atuais do petshop logado.

#### Scenario: Abrir Configurações
- **WHEN** o usuário abre Configurações
- **THEN** vê o nome, o e-mail e o telefone que a loja tem cadastrados, prontos para editar

#### Scenario: Falha ao carregar
- **WHEN** os dados não podem ser carregados (sem conexão)
- **THEN** a tela informa o problema e oferece "Tentar de novo", sem mostrar um formulário vazio como se a loja não tivesse dados

### Requirement: Salvar os dados da loja
O usuário SHALL poder alterar e salvar os dados da loja; ao salvar, o sistema SHALL gravar somente no petshop logado, confirmar com um aviso e atualizar o nome e as iniciais exibidos na barra lateral sem recarregar a página.

#### Scenario: Alterar o nome
- **WHEN** o usuário troca o nome para "Pet Shop Amigo Fiel" e salva
- **THEN** um aviso confirma a gravação e a barra lateral passa a mostrar "Pet Shop Amigo Fiel" e as iniciais "PS"

#### Scenario: Recarregar depois de salvar
- **WHEN** o usuário salva e recarrega a página
- **THEN** o formulário mostra os dados salvos

#### Scenario: Telefone em branco
- **WHEN** o usuário apaga o telefone e salva
- **THEN** a loja fica sem telefone cadastrado e a gravação é aceita

### Requirement: Validação dos dados da loja
O formulário SHALL recusar, sem gravar e indicando o campo, nome vazio e e-mail em formato inválido; em falha de gravação, SHALL manter os dados digitados e mostrar o motivo em português.

#### Scenario: Nome vazio
- **WHEN** o usuário apaga o nome e salva
- **THEN** nada é gravado e a mensagem pede o nome da loja

#### Scenario: E-mail inválido
- **WHEN** o usuário informa "contato@" e salva
- **THEN** nada é gravado e a mensagem pede um e-mail válido

#### Scenario: Sem conexão ao salvar
- **WHEN** o usuário salva sem conexão
- **THEN** os dados digitados continuam no formulário e a mensagem informa que não foi possível conectar

### Requirement: E-mail de contato separado do acesso
Alterar o e-mail da loja SHALL não alterar o e-mail usado para entrar no app, e o formulário SHALL deixar isso claro.

#### Scenario: Trocar o e-mail da loja
- **WHEN** o usuário troca o e-mail da loja e salva
- **THEN** continua entrando no app com o e-mail de acesso anterior
