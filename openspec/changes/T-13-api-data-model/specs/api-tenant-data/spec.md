## Purpose

Guardar, pela API do V1, os dados de cada petshop (dados da loja, produtos e o vínculo do usuário com a loja) de forma que um petshop nunca veja nem altere os dados de outro, com a garantia feita pela própria API — que acessa o banco com um papel que ignora o RLS do V0 — e não pelo frontend.

## ADDED Requirements

### Requirement: Petshop da requisição vem só do token
A API SHALL determinar o usuário e o petshop de cada operação exclusivamente a partir das *claims* do token da requisição (identificador do usuário e identificador do petshop). Um identificador de petshop enviado no corpo, na rota ou na query MUST NOT ser usado para decidir quais dados são lidos ou gravados. Requisição sem token, ou com token sem identificador de petshop válido, SHALL ser tratada como "sem petshop".

#### Scenario: Token com usuário e petshop
- **WHEN** uma operação é feita com um token que traz o usuário U e o petshop P
- **THEN** a operação acontece em nome de U, restrita ao petshop P

#### Scenario: Token sem petshop
- **WHEN** uma operação é feita com um token sem identificador de petshop, ou com um valor que não é um identificador válido
- **THEN** a operação é tratada como de um usuário sem petshop

#### Scenario: Requisição anônima
- **WHEN** uma operação é feita sem token
- **THEN** a operação é tratada como sem usuário e sem petshop

### Requirement: Leitura isolada por petshop
Toda consulta da API a petshops, produtos ou vínculos SHALL devolver apenas as linhas do petshop da requisição (no caso dos vínculos, apenas o vínculo do próprio usuário), sem que o código de cada consulta precise filtrar por petshop. Operações sem petshop SHALL não ver nenhuma linha.

#### Scenario: Listagem de produtos
- **WHEN** um usuário do petshop B lista produtos sem nenhum filtro, existindo produtos dos petshops A e B
- **THEN** recebe apenas os produtos do petshop B

#### Scenario: Busca por código de barras
- **WHEN** os petshops A e B têm um produto com o mesmo código de barras e um usuário de B busca por esse código
- **THEN** recebe apenas o produto de B

#### Scenario: Dados da loja e vínculo
- **WHEN** um usuário do petshop B consulta petshops e vínculos
- **THEN** recebe só o petshop B e só o próprio vínculo

#### Scenario: Produto de outro petshop pelo id
- **WHEN** um usuário de B procura um produto de A informando o id dele
- **THEN** o produto não é encontrado

#### Scenario: Usuário sem petshop ou anônimo
- **WHEN** uma operação sem petshop consulta petshops, produtos ou vínculos
- **THEN** nenhuma linha é devolvida

### Requirement: Gravação sempre no próprio petshop
Ao cadastrar um produto, a API SHALL associá-lo ao petshop da requisição sem que o cliente informe o petshop. A API SHALL recusar, sem gravar nada, qualquer operação que: cadastre produto informando outro petshop; mova um produto para outro petshop; altere ou exclua produto de outro petshop; altere os dados de outro petshop; ou cadastre produto numa operação sem petshop.

#### Scenario: Cadastro sem informar o petshop
- **WHEN** um usuário de A cadastra um produto informando só nome, categoria, preço e, opcionalmente, código de barras
- **THEN** o produto é gravado no petshop A

#### Scenario: Cadastro informando outro petshop
- **WHEN** um usuário de B cadastra um produto com o id do petshop A
- **THEN** a operação é recusada e nenhum produto é gravado em A

#### Scenario: Mover produto para outro petshop
- **WHEN** um usuário de B altera o petshop de um produto próprio para A
- **THEN** a operação é recusada e o produto continua em B

#### Scenario: Alterar ou excluir produto alheio
- **WHEN** um usuário de B tenta alterar ou excluir um produto de A
- **THEN** a operação é recusada e o produto de A continua intacto

#### Scenario: Alterar os dados da própria loja
- **WHEN** um usuário de B altera o telefone do petshop B
- **THEN** a alteração é gravada

#### Scenario: Cadastro sem petshop
- **WHEN** uma operação sem petshop tenta cadastrar um produto
- **THEN** a operação é recusada

### Requirement: Vínculo usuário → petshop imutável
O petshop ao qual um usuário está vinculado MUST NOT ser alterado por nenhuma operação da API depois de criado, e cada usuário SHALL ter no máximo um vínculo.

#### Scenario: Tentativa de trocar o próprio vínculo
- **WHEN** um usuário de B tenta alterar o próprio vínculo para o petshop A
- **THEN** a operação é recusada e o vínculo continua apontando para B

#### Scenario: Segundo vínculo para o mesmo usuário
- **WHEN** se tenta gravar um segundo vínculo para um usuário que já tem um
- **THEN** a operação falha com erro de duplicidade

### Requirement: Invariantes do produto garantidas pelo banco
O banco SHALL recusar produto com nome ou categoria vazios (ou só com espaços), preço negativo, ou código de barras que não tenha de 8 a 14 dígitos numéricos; SHALL impedir o mesmo código de barras duas vezes no mesmo petshop; SHALL permitir o mesmo código em petshops diferentes e vários produtos sem código no mesmo petshop.

#### Scenario: Código repetido no mesmo petshop
- **WHEN** um usuário cadastra um produto com um código que já existe no próprio petshop
- **THEN** a operação falha com erro de duplicidade

#### Scenario: Mesmo código em petshops diferentes
- **WHEN** os petshops A e B cadastram o mesmo código
- **THEN** ambos os cadastros são aceitos

#### Scenario: Vários produtos sem código
- **WHEN** um petshop cadastra dois produtos sem código de barras
- **THEN** ambos os cadastros são aceitos

#### Scenario: Valores inválidos
- **WHEN** se tenta gravar um produto com preço negativo, nome em branco ou código `123`
- **THEN** a operação é recusada pelo banco

### Requirement: Origem do produto e resposta bruta da IA
Cada produto SHALL registrar sua origem como um destes valores: `barcode`, `manual`, `photo_ai` ou `voice_ai`, sendo `manual` quando não informada. Produtos com origem `photo_ai` ou `voice_ai` SHALL poder guardar a resposta bruta da IA como JSON ao lado dos campos confirmados; produtos `barcode` ou `manual` MUST NOT ter resposta da IA. Produtos gravados pelo V0 (`barcode`/`manual`, sem resposta da IA) SHALL continuar válidos e legíveis.

#### Scenario: Produto de foto com resposta da IA
- **WHEN** um produto é gravado com origem `photo_ai` e um JSON de resposta da IA
- **THEN** o produto e o JSON são gravados e lidos de volta iguais

#### Scenario: Produto manual com resposta da IA
- **WHEN** se tenta gravar um produto com origem `manual` ou `barcode` e uma resposta da IA
- **THEN** a operação é recusada pelo banco

#### Scenario: Origem desconhecida
- **WHEN** se tenta gravar um produto com uma origem fora da lista
- **THEN** a operação é recusada

#### Scenario: Produto do V0
- **WHEN** a API lê um produto com origem `barcode` gravado com o schema do V0
- **THEN** o produto é lido com origem `barcode` e sem resposta da IA

### Requirement: Datas de criação e atualização automáticas
O banco SHALL preencher a data de criação de petshops, vínculos e produtos e SHALL atualizar a data de última alteração de um produto a cada edição, independentemente dos valores que a aplicação enviar.

#### Scenario: Edição de produto
- **WHEN** um produto é editado e a operação tenta gravar uma data de atualização antiga
- **THEN** a data de atualização passa a ser o momento da edição

### Requirement: Schema versionado compatível com o banco do V0
A estrutura do banco usada pela API SHALL ser criada e evoluída apenas por migrations versionadas no repositório, aplicáveis do zero num Postgres vazio. As tabelas `petshops`, `profiles` e `products`, suas colunas, o índice único de código de barras e as constraints de validação SHALL ter os mesmos nomes e tipos de `supabase/schema.sql`, de modo que o banco do V0 possa receber as migrations sem recriar tabelas nem perder dados.

#### Scenario: Banco vazio
- **WHEN** as migrations são aplicadas num Postgres 17 vazio
- **THEN** as três tabelas são criadas com as invariantes desta capacidade e o banco fica pronto para a API

#### Scenario: Comparação com o schema do V0
- **WHEN** a estrutura criada pela migration inicial é comparada com `supabase/schema.sql`
- **THEN** tabelas, colunas, tipos, índice único e constraints de validação coincidem, com exceção dos objetos específicos do Supabase (RLS, `grant`s, funções que usam `auth.uid()` e a FK para `auth.users`)
