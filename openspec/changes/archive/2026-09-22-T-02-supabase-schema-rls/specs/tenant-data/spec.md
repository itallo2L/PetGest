## Purpose

Guardar os dados de cada petshop (dados da loja e produtos) de forma que um petshop nunca veja nem altere os dados de outro, com a garantia feita pelo banco e não pelo frontend.

## ADDED Requirements

### Requirement: Cadastro atômico de petshop e usuário
O sistema SHALL criar o petshop e o vínculo do usuário autenticado a ele numa única operação, e SHALL recusar o cadastro para usuário anônimo ou para usuário que já tem petshop.

#### Scenario: Primeiro cadastro de um usuário autenticado
- **WHEN** um usuário recém-criado no Auth chama o cadastro com nome, e-mail e telefone da loja
- **THEN** um petshop é criado, o usuário fica vinculado a ele e o id do petshop é devolvido

#### Scenario: Usuário que já tem petshop tenta cadastrar outro
- **WHEN** um usuário já vinculado chama o cadastro de novo
- **THEN** a operação falha com erro de duplicidade e nenhum petshop novo é criado

#### Scenario: Chamada anônima
- **WHEN** o cadastro é chamado sem usuário autenticado
- **THEN** a operação é recusada

### Requirement: Isolamento total por petshop
Um usuário autenticado SHALL ler e alterar somente o próprio petshop e os produtos do próprio petshop; usuários anônimos ou sem petshop SHALL não ver nenhum dado.

#### Scenario: Listagem de produtos
- **WHEN** um usuário lista produtos sem nenhum filtro
- **THEN** recebe apenas os produtos do próprio petshop

#### Scenario: Tentativa de gravar em outro petshop
- **WHEN** um usuário tenta inserir um produto informando o id de outro petshop, ou mover um produto próprio para outro petshop
- **THEN** a operação é recusada

#### Scenario: Tentativa de trocar o próprio vínculo
- **WHEN** um usuário tenta alterar o petshop ao qual está vinculado
- **THEN** o vínculo permanece inalterado

#### Scenario: Usuário sem petshop ou anônimo
- **WHEN** um usuário sem vínculo ou uma requisição anônima consulta petshops ou produtos
- **THEN** nenhuma linha é devolvida

### Requirement: Produto sem precisar informar o petshop
Ao cadastrar um produto, o sistema SHALL associá-lo automaticamente ao petshop do usuário logado, sem que o cliente envie o id do petshop.

#### Scenario: Cadastro de produto pelo app
- **WHEN** o usuário cadastra um produto informando só nome, categoria, preço e, opcionalmente, código de barras
- **THEN** o produto é gravado no petshop do usuário

### Requirement: Código de barras único por petshop
O sistema SHALL impedir o mesmo código de barras duas vezes no mesmo petshop, SHALL permitir o mesmo código em petshops diferentes e SHALL permitir vários produtos sem código.

#### Scenario: Código repetido no mesmo petshop
- **WHEN** o usuário cadastra um produto com um código que já existe no próprio petshop
- **THEN** a operação falha com erro de duplicidade

#### Scenario: Mesmo código em petshops diferentes
- **WHEN** dois petshops cadastram o mesmo código
- **THEN** ambos os cadastros são aceitos

### Requirement: Data de atualização automática
O sistema SHALL atualizar a data de última alteração de um produto sempre que ele for editado, independentemente do que o cliente enviar.

#### Scenario: Edição de produto
- **WHEN** um produto é editado
- **THEN** sua data de atualização passa a ser o momento da edição
