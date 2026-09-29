# api-platform Specification

## Purpose

Comportamento de base da API própria do PetGest (V1), independente de regra de negócio: dizer se ela está de pé e alcança o banco, aceitar chamadas de navegador só das origens do frontend e publicar o contrato da API para o frontend gerar os próprios tipos.

## Requirements

### Requirement: Verificação de saúde da API e do banco
A API SHALL expor `GET /health`, sem exigir autenticação, respondendo `200` quando o processo está de pé e consegue consultar o banco de dados configurado, e `503` quando o banco não responde. A resposta MUST NOT conter string de conexão, host do banco, credenciais nem mensagem de exceção.

#### Scenario: API e banco disponíveis
- **WHEN** alguém chama `GET /health` com a API rodando e o banco acessível
- **THEN** a resposta é `200` com o estado `Healthy`

#### Scenario: Banco indisponível
- **WHEN** alguém chama `GET /health` com a API rodando e o banco parado ou inalcançável
- **THEN** a resposta é `503` com o estado `Unhealthy`, sem detalhes da conexão nem da exceção

#### Scenario: Chamada sem credenciais
- **WHEN** alguém chama `GET /health` sem nenhum cabeçalho de autenticação
- **THEN** a resposta não é `401` nem `403`

### Requirement: CORS restrito às origens do frontend
A API SHALL aceitar requisições de navegador (incluindo o *preflight* `OPTIONS`) apenas das origens do frontend do PetGest: o domínio de produção `https://pet-gest.vercel.app`, as URLs de prévia da Vercel do próprio projeto e `http://localhost:5183`. Requisições de qualquer outra origem MUST receber resposta sem o cabeçalho `Access-Control-Allow-Origin`. A lista de origens MUST vir da configuração da API, não do código, e a API MUST NOT permitir credenciais de navegador (cookies) nas requisições entre origens.

#### Scenario: Origem de produção
- **WHEN** um navegador em `https://pet-gest.vercel.app` faz uma requisição à API
- **THEN** a resposta traz `Access-Control-Allow-Origin: https://pet-gest.vercel.app`

#### Scenario: Frontend local
- **WHEN** um navegador em `http://localhost:5183` faz o *preflight* `OPTIONS` de uma requisição à API
- **THEN** o *preflight* é aceito e a resposta traz `Access-Control-Allow-Origin: http://localhost:5183`

#### Scenario: Prévia da Vercel do projeto
- **WHEN** um navegador numa URL de prévia da Vercel do projeto PetGest faz uma requisição à API
- **THEN** a resposta traz `Access-Control-Allow-Origin` com essa mesma origem

#### Scenario: Origem desconhecida
- **WHEN** um navegador em qualquer outra origem (ex.: `https://exemplo.com` ou a prévia de outro projeto na Vercel) faz uma requisição à API
- **THEN** a resposta não traz `Access-Control-Allow-Origin` e o navegador bloqueia a leitura

#### Scenario: Credenciais entre origens
- **WHEN** uma origem permitida faz uma requisição à API
- **THEN** a resposta não traz `Access-Control-Allow-Credentials: true`

### Requirement: Contrato OpenAPI publicado em desenvolvimento
Em ambiente de desenvolvimento, a API SHALL publicar um documento OpenAPI em JSON descrevendo todos os endpoints expostos, e uma interface de navegação desse documento. Fora do ambiente de desenvolvimento, o documento e a interface MUST NOT ser servidos.

#### Scenario: Documento em desenvolvimento
- **WHEN** alguém pede o documento OpenAPI à API rodando em desenvolvimento
- **THEN** recebe `200` com um JSON OpenAPI válido que inclui a operação `GET /health`

#### Scenario: Interface em desenvolvimento
- **WHEN** alguém abre a interface de navegação do OpenAPI na API rodando em desenvolvimento
- **THEN** a página carrega e lista os endpoints do documento

#### Scenario: Produção não expõe o contrato
- **WHEN** alguém pede o documento OpenAPI ou a interface à API rodando fora de desenvolvimento
- **THEN** a resposta é `404`
