## MODIFIED Requirements

### Requirement: Cadastro de produto
A API SHALL oferecer `POST /products`, protegido, que recebe nome, categoria, preço, código de barras opcional, origem opcional e, para as origens de IA, o identificador do rascunho, e grava o produto no petshop do token, respondendo `201` com o produto criado. O cliente MUST NOT informar o petshop: um identificador de petshop enviado no corpo SHALL ser ignorado. A origem SHALL aceitar `barcode`, `manual` (padrão), `photo_ai` ou `voice_ai`; outro valor SHALL ser recusado com `400`. Com origem `photo_ai` ou `voice_ai` e o identificador de um rascunho da mesma loja e da mesma origem, ainda válido, a API SHALL gravar no produto a resposta bruta da IA daquele rascunho, que então deixa de valer; sem rascunho válido, o produto SHALL ser gravado sem a resposta bruta. Espaços nas pontas de nome e categoria SHALL ser removidos, e código de barras vazio SHALL virar ausente.

#### Scenario: Cadastro válido sem código
- **WHEN** um usuário de A cadastra "Coleira Nylon M", categoria "Acessórios", preço 29,90 e sem código
- **THEN** recebe `201`, o produto fica no petshop A com origem `manual` e aparece na listagem de A

#### Scenario: Cadastro depois de escanear
- **WHEN** um usuário cadastra um produto com código e origem `barcode`
- **THEN** o produto é gravado com origem `barcode`

#### Scenario: Petshop informado no corpo
- **WHEN** um usuário de A cadastra um produto enviando o identificador do petshop B no corpo
- **THEN** o produto é gravado no petshop A

#### Scenario: Cadastro a partir de uma foto
- **WHEN** um usuário de A confere o rascunho de uma foto, completa o preço e cadastra com origem `photo_ai` e o identificador do rascunho
- **THEN** o produto é gravado com origem `photo_ai` e com a resposta bruta da IA

#### Scenario: Rascunho de outra loja
- **WHEN** um usuário de B cadastra um produto com o identificador de um rascunho criado por A
- **THEN** o produto é gravado em B sem a resposta bruta do rascunho de A

#### Scenario: Origem de IA antes da hora
- **WHEN** alguém cadastra um produto com origem `photo_ai` sem o identificador de um rascunho (até a T-19 essa origem era recusada)
- **THEN** recebe `201` e o produto é gravado com origem `photo_ai`, sem resposta bruta da IA

#### Scenario: Origem desconhecida
- **WHEN** alguém cadastra um produto com origem `qualquer`
- **THEN** recebe `400` e nada é gravado

#### Scenario: Conta sem petshop
- **WHEN** uma conta sem petshop tenta cadastrar um produto
- **THEN** recebe `403` com o código `petshop_required`, e nada é gravado
