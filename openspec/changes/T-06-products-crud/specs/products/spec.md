## Purpose

Catálogo de produtos de cada petshop: o usuário lista, encontra, cadastra, edita e exclui os produtos da própria loja, com os dados que o V0 guarda (nome, categoria, preço e código de barras opcional).

## ADDED Requirements

### Requirement: Listagem dos produtos da loja
A área Produtos SHALL listar todos os produtos do petshop logado, mostrando nome, categoria, código de barras (ou a indicação de que não tem) e preço em reais, e SHALL informar quantos produtos estão sendo mostrados do total cadastrado.

#### Scenario: Loja com produtos
- **WHEN** o usuário abre Produtos numa loja com produtos cadastrados
- **THEN** vê todos eles ordenados por nome, cada um com categoria, código e preço no formato "R$ 119,90", e o texto "Mostrando 19 de 19 produtos cadastrados"

#### Scenario: Loja sem produtos
- **WHEN** o usuário abre Produtos numa loja sem nenhum produto
- **THEN** vê um estado vazio convidando a cadastrar o primeiro produto, com o botão de cadastro

#### Scenario: Produtos de outra loja
- **WHEN** existem produtos cadastrados por outro petshop
- **THEN** nenhum deles aparece na lista

#### Scenario: Celular
- **WHEN** a tela não tem largura para a tabela
- **THEN** cada produto aparece como um card tocável com nome, categoria, código e preço

#### Scenario: Falha ao carregar
- **WHEN** a lista não pode ser carregada (sem conexão)
- **THEN** a tela informa o problema e oferece "Tentar de novo", sem mostrar uma lista vazia como se a loja não tivesse produtos

### Requirement: Busca, filtro e ordenação
O usuário SHALL poder buscar produtos por parte do nome ou do código de barras, sem diferenciar maiúsculas nem acentos, filtrar por uma categoria e ordenar por nome ou por categoria; SHALL poder limpar busca e filtros de uma vez.

#### Scenario: Buscar por nome sem acento
- **WHEN** o usuário digita "racao" na busca
- **THEN** a lista mostra só os produtos cujo nome contém "ração" (ou "racao"), com o trecho encontrado destacado

#### Scenario: Buscar por código
- **WHEN** o usuário digita parte de um código de barras
- **THEN** a lista mostra só os produtos cujo código contém esses dígitos

#### Scenario: Filtrar por categoria
- **WHEN** o usuário escolhe a categoria "Higiene"
- **THEN** só produtos de Higiene aparecem e o botão de filtro indica 1 filtro ativo

#### Scenario: Nada encontrado
- **WHEN** a busca e os filtros não encontram nenhum produto
- **THEN** a tela diz que nenhum produto foi encontrado e oferece "Limpar busca e filtros"

### Requirement: Cadastro manual de produto
O usuário SHALL poder cadastrar um produto informando nome, categoria (uma das categorias do V0), preço de venda e, opcionalmente, código de barras; o produto SHALL ficar registrado como de origem manual e aparecer na lista em seguida.

#### Scenario: Cadastro válido
- **WHEN** o usuário cadastra "Coleira Nylon M", categoria Acessórios, preço "29,90" e sem código
- **THEN** o produto é gravado, o formulário fecha, um aviso confirma o cadastro e o produto aparece na lista

#### Scenario: Categorias disponíveis
- **WHEN** o usuário abre o campo de categoria
- **THEN** as opções são exatamente Ração, Medicamento, Higiene, Acessórios, Petiscos, Jardinagem e Agropecuário

### Requirement: Validação do formulário de produto
O formulário SHALL recusar, com mensagem que indica o campo, nome vazio, preço vazio, negativo ou não numérico, e código de barras que não tenha de 8 a 14 dígitos; SHALL aceitar preço com vírgula ou ponto decimal; e SHALL recusar um código de barras que já pertença a outro produto da mesma loja, dizendo qual.

#### Scenario: Preço com vírgula
- **WHEN** o usuário informa o preço "12,5"
- **THEN** o produto é gravado com preço R$ 12,50

#### Scenario: Código com tamanho inválido
- **WHEN** o usuário informa o código "12345"
- **THEN** nada é gravado e a mensagem pede um código de barras de 8 a 14 dígitos

#### Scenario: Código já usado na loja
- **WHEN** o usuário informa um código que já pertence ao produto "Ração Golden Adultos Frango 15kg" da mesma loja
- **THEN** nada é gravado e a mensagem diz "O código de barras … já pertence a Ração Golden Adultos Frango 15kg."

#### Scenario: Mesmo código em outra loja
- **WHEN** o código informado existe apenas em outro petshop
- **THEN** o cadastro é aceito

### Requirement: Edição de produto
O usuário SHALL poder abrir qualquer produto da lista e alterar nome, categoria, preço e código de barras, com as mesmas validações do cadastro.

#### Scenario: Salvar alterações
- **WHEN** o usuário abre um produto, muda o preço para "34,90" e salva
- **THEN** o formulário fecha, um aviso confirma a alteração e a lista mostra o novo preço

#### Scenario: Cancelar
- **WHEN** o usuário altera campos e fecha o formulário sem salvar
- **THEN** nada muda no produto

### Requirement: Exclusão de produto
O usuário SHALL poder excluir um produto a partir do formulário de edição, somente após confirmar a exclusão.

#### Scenario: Excluir com confirmação
- **WHEN** o usuário escolhe "Excluir produto" e confirma
- **THEN** o produto é removido, some da lista e um aviso confirma a exclusão

#### Scenario: Desistir da exclusão
- **WHEN** o usuário escolhe "Excluir produto" e não confirma
- **THEN** o produto continua cadastrado e o formulário continua aberto

### Requirement: Falha ao gravar
Quando cadastrar, salvar ou excluir falhar, o formulário SHALL continuar aberto com os dados digitados e mostrar o motivo em português.

#### Scenario: Sem conexão ao salvar
- **WHEN** o usuário salva um produto sem conexão
- **THEN** o formulário continua aberto com os dados e informa que não foi possível conectar
