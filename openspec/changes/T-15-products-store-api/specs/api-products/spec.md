## Purpose

Expor pela API do V1 o catálogo de produtos de cada petshop — listar, consultar, buscar por código de barras, cadastrar, editar e excluir — com as mesmas regras que o V0 garante hoje, sempre restrito à loja do token.

## ADDED Requirements

### Requirement: Listagem dos produtos da loja
A API SHALL oferecer `GET /products`, protegido, que devolve todos os produtos do petshop do token, ordenados por nome (e pelo identificador, em caso de empate). Cada produto SHALL trazer identificador, nome, categoria, preço, código de barras (ou ausente), origem e data da última alteração. Operação sem petshop SHALL receber lista vazia.

#### Scenario: Loja com produtos
- **WHEN** um usuário da loja A lista os produtos, existindo produtos das lojas A e B
- **THEN** recebe `200` com todos os produtos de A, e só eles, em ordem alfabética de nome

#### Scenario: Loja sem produtos
- **WHEN** um usuário de uma loja sem produtos lista os produtos
- **THEN** recebe `200` com uma lista vazia

#### Scenario: Sem token
- **WHEN** alguém lista os produtos sem token
- **THEN** recebe `401`

### Requirement: Consulta de um produto
A API SHALL oferecer `GET /products/{id}`, protegido, que devolve o produto quando ele pertence ao petshop do token. Produto inexistente ou de outro petshop SHALL receber a mesma resposta: `404` com o código `product_not_found`.

#### Scenario: Produto da própria loja
- **WHEN** um usuário de A consulta um produto de A pelo identificador
- **THEN** recebe `200` com o produto

#### Scenario: Produto de outra loja
- **WHEN** um usuário de A consulta um produto de B pelo identificador
- **THEN** recebe `404` com o código `product_not_found`, igual a um identificador que não existe

### Requirement: Busca por código de barras para o scanner
A API SHALL oferecer `GET /products/by-ean/{ean}`, protegido, com os dois desfechos do scanner do V0: o produto do petshop do token com aquele código (`200`) ou `404` com o código `product_not_found`. A busca MUST NOT consultar nenhuma base externa de produtos. Código que não tenha de 8 a 14 dígitos SHALL receber `400` sem busca.

#### Scenario: Código já cadastrado na loja
- **WHEN** um usuário de A busca um código que um produto de A tem
- **THEN** recebe `200` com esse produto

#### Scenario: Código só em outra loja
- **WHEN** um usuário de A busca um código que só um produto de B tem
- **THEN** recebe `404` com o código `product_not_found`

#### Scenario: Código cadastrado por outro aparelho
- **WHEN** outro aparelho da loja A acabou de cadastrar um produto com o código e um usuário de A busca esse código
- **THEN** recebe `200` com esse produto

#### Scenario: Código inválido
- **WHEN** alguém busca o código `12345`
- **THEN** recebe `400` e nenhuma busca é feita

### Requirement: Cadastro de produto
A API SHALL oferecer `POST /products`, protegido, que recebe nome, categoria, preço, código de barras opcional e origem opcional, e grava o produto no petshop do token, respondendo `201` com o produto criado. O cliente MUST NOT informar o petshop: um identificador de petshop enviado no corpo SHALL ser ignorado. A origem SHALL aceitar `barcode` ou `manual` (padrão `manual`); `photo_ai` e `voice_ai` SHALL ser recusadas com `400` até existirem os cadastros por foto e voz. Espaços nas pontas de nome e categoria SHALL ser removidos, e código de barras vazio SHALL virar ausente.

#### Scenario: Cadastro válido sem código
- **WHEN** um usuário de A cadastra "Coleira Nylon M", categoria "Acessórios", preço 29,90 e sem código
- **THEN** recebe `201`, o produto fica no petshop A com origem `manual` e aparece na listagem de A

#### Scenario: Cadastro depois de escanear
- **WHEN** um usuário cadastra um produto com código e origem `barcode`
- **THEN** o produto é gravado com origem `barcode`

#### Scenario: Petshop informado no corpo
- **WHEN** um usuário de A cadastra um produto enviando o identificador do petshop B no corpo
- **THEN** o produto é gravado no petshop A

#### Scenario: Origem de IA antes da hora
- **WHEN** alguém cadastra um produto com origem `photo_ai`
- **THEN** recebe `400` e nada é gravado

#### Scenario: Conta sem petshop
- **WHEN** uma conta sem petshop tenta cadastrar um produto
- **THEN** recebe `403` com o código `petshop_required`, e nada é gravado

### Requirement: Validação do produto
O cadastro e a edição SHALL recusar com `400`, indicando o campo e sem gravar nada: nome ou categoria vazios (ou só com espaços), nome com mais de 200 caracteres, categoria com mais de 100, preço ausente, negativo, com mais de duas casas decimais ou acima de 99.999.999,99, e código de barras que não tenha de 8 a 14 dígitos. A categoria SHALL ser texto livre, como no banco do V0: as sete categorias do V0 são uma lista do frontend.

#### Scenario: Preço negativo
- **WHEN** alguém cadastra um produto com preço -1
- **THEN** recebe `400` indicando o preço, e nada é gravado

#### Scenario: Código com tamanho inválido
- **WHEN** alguém cadastra um produto com o código `12345`
- **THEN** recebe `400` indicando o código de barras, e nada é gravado

#### Scenario: Categoria fora da lista do frontend
- **WHEN** alguém cadastra um produto com a categoria "Serviço"
- **THEN** o cadastro é aceito

### Requirement: Código de barras repetido na loja
Cadastro ou edição com um código de barras que já pertence a outro produto do mesmo petshop SHALL receber `409` com o código `ean_taken`, sem gravar nada, e a resposta SHALL trazer o identificador e o nome do produto que já tem o código. O mesmo código em outro petshop SHALL ser aceito.

#### Scenario: Código já usado na loja
- **WHEN** um usuário de A cadastra um produto com o código do produto "Ração Golden Adultos Frango 15kg", também de A
- **THEN** recebe `409` com `ean_taken`, o identificador e o nome "Ração Golden Adultos Frango 15kg", e nada é gravado

#### Scenario: Edição para um código usado
- **WHEN** um usuário de A edita um produto colocando o código de outro produto de A
- **THEN** recebe `409` com `ean_taken` e o produto editado continua como estava

#### Scenario: Mesmo código em outra loja
- **WHEN** o código informado existe só num produto de B
- **THEN** o cadastro em A é aceito

#### Scenario: Manter o próprio código na edição
- **WHEN** um usuário edita um produto mantendo o código que ele já tinha
- **THEN** a edição é aceita

### Requirement: Edição de produto
A API SHALL oferecer `PUT /products/{id}`, protegido, que substitui nome, categoria, preço e código de barras de um produto do petshop do token, com as mesmas validações do cadastro, e responde `200` com o produto atualizado (incluindo a nova data de alteração). A origem do produto SHALL ser mantida. Produto inexistente ou de outro petshop SHALL receber `404` com `product_not_found`, sem alterar nada.

#### Scenario: Salvar alterações
- **WHEN** um usuário de A muda o preço de um produto de A para 34,90
- **THEN** recebe `200` com o preço novo e a data de alteração atualizada

#### Scenario: Produto de outra loja
- **WHEN** um usuário de A tenta editar um produto de B
- **THEN** recebe `404` com `product_not_found`, e o produto de B continua como estava

### Requirement: Exclusão de produto
A API SHALL oferecer `DELETE /products/{id}`, protegido, que exclui um produto do petshop do token e responde `204`. Produto inexistente ou de outro petshop SHALL receber `404` com `product_not_found`, sem excluir nada.

#### Scenario: Excluir produto da loja
- **WHEN** um usuário de A exclui um produto de A
- **THEN** recebe `204` e o produto some da listagem

#### Scenario: Excluir produto de outra loja
- **WHEN** um usuário de A tenta excluir um produto de B
- **THEN** recebe `404` e o produto de B continua cadastrado
