## Purpose

Rascunhos de produto sugeridos pela IA na API do V1: a partir de uma foto da embalagem (e, na T-20, da voz), a API devolve os campos que conseguiu ler, já validados, para o usuário conferir no formulário de cadastro. O rascunho liga o produto salvo à resposta bruta da IA.

## ADDED Requirements

### Requirement: Disponibilidade do cadastro por IA
A API SHALL oferecer `GET /products/drafts/availability`, protegido, que diz se o cadastro por foto e o por voz estão disponíveis — isto é, se há um provedor de IA configurado. Sem provedor configurado, os endpoints de extração SHALL responder `503` com o código `ai_unavailable`, e o resto da API SHALL funcionar normalmente.

#### Scenario: Provedor configurado
- **WHEN** a API tem a chave do provedor de IA e um usuário consulta a disponibilidade
- **THEN** recebe que foto e voz estão disponíveis

#### Scenario: Sem provedor
- **WHEN** a API não tem a chave do provedor e um usuário envia uma foto
- **THEN** recebe `503` com o código `ai_unavailable`

### Requirement: Rascunho a partir de uma foto
A API SHALL oferecer `POST /products/drafts/photo`, protegido, que recebe uma imagem (`multipart/form-data`, campo `image`, JPEG, PNG ou WebP, até o limite configurado) e responde `200` com um rascunho: identificador do rascunho, origem `photo_ai`, nome, categoria, preço e código de barras — cada campo podendo vir ausente quando a IA não o reconhecer. A API SHALL devolver só valores que o cadastro aceitaria: categoria entre as sete do PetGest, código de barras com dígito verificador válido e preço não negativo com até duas casas. A API MUST NOT gravar produto nenhum nesta chamada nem guardar a imagem. Conta sem petshop SHALL receber `403` com `petshop_required`.

#### Scenario: Foto de uma embalagem
- **WHEN** um usuário envia a foto de um saco de ração em que nome e código estão legíveis e não há preço
- **THEN** recebe o nome, a categoria "Ração", o código e o preço ausente, com origem `photo_ai`

#### Scenario: Código lido com um dígito errado
- **WHEN** a IA lê um código cujo dígito verificador não confere
- **THEN** o rascunho vem sem código

#### Scenario: Categoria fora da lista
- **WHEN** a IA sugere uma categoria que não é uma das sete
- **THEN** o rascunho vem sem categoria

### Requirement: Arquivo recusado sem chamar a IA
A API SHALL recusar com `400` e o código `invalid_file`, sem chamar o provedor de IA: envio sem o arquivo, arquivo vazio, formato não aceito ou arquivo acima do tamanho máximo configurado.

#### Scenario: Formato não aceito
- **WHEN** um usuário envia um PDF no lugar da foto
- **THEN** recebe `400` com o código `invalid_file`, e o provedor de IA não é chamado

### Requirement: Falha do provedor de IA
Quando o provedor de IA falhar, recusar a extração, devolver uma resposta fora do formato ou não responder dentro do tempo configurado, a API SHALL responder `502` com o código `ai_failed`, sem gravar nada.

#### Scenario: Provedor fora do ar
- **WHEN** o provedor de IA responde com erro
- **THEN** o usuário recebe `502` com o código `ai_failed`

### Requirement: Limite de uso da IA por usuário
A API SHALL limitar, por usuário, o número de extrações por IA numa janela de tempo, com valores definidos pela configuração (padrão: 20 por minuto). Extrações acima do limite SHALL receber `429`, sem chamar o provedor. O limite de um usuário MUST NOT afetar outro.

#### Scenario: Usuário acima do limite
- **WHEN** um usuário passa do limite de extrações dentro da janela
- **THEN** as extrações excedentes recebem `429`, e outro usuário continua extraindo normalmente
