## Purpose

Definir como o frontend do PetGest se conecta ao backend durante a transição do V0 para o V1: qual backend é usado, como a sessão com a API própria é mantida no navegador e como os erros do backend chegam ao usuário — sem mudar nenhuma tela nem regra que as specs do V0 descrevem.

## ADDED Requirements

### Requirement: Backend escolhido por configuração
O frontend SHALL usar um único backend por build, escolhido pela variável `VITE_BACKEND`: `supabase` (o padrão quando ausente) ou `api`. No modo `api`, o endereço da API SHALL vir de `VITE_API_URL`. Valor de `VITE_BACKEND` fora desses dois, ou o modo `api` sem `VITE_API_URL`, SHALL fazer o app parar no carregamento com uma mensagem que nomeie a variável, em vez de tentar requisições. Cada modo SHALL exigir só as variáveis que usa.

#### Scenario: Sem configuração de backend
- **WHEN** o app é compilado sem `VITE_BACKEND`
- **THEN** usa o Supabase, como o V0

#### Scenario: Modo API configurado
- **WHEN** o app é compilado com `VITE_BACKEND=api` e `VITE_API_URL` definido
- **THEN** todas as operações de sessão, produtos e loja vão para a API, e o app não exige as variáveis do Supabase

#### Scenario: Valor inválido
- **WHEN** o app é compilado com `VITE_BACKEND=firebase`
- **THEN** o carregamento para com uma mensagem que nomeia `VITE_BACKEND` e os valores aceitos

#### Scenario: Modo API sem endereço
- **WHEN** o app é compilado com `VITE_BACKEND=api` e sem `VITE_API_URL`
- **THEN** o carregamento para com uma mensagem que nomeia `VITE_API_URL`

### Requirement: Mesmo comportamento nos dois backends
Tudo o que as specs `auth`, `products`, `product-scanning`, `store-settings` e `app-shell` descrevem SHALL valer igual no modo `supabase` e no modo `api`: mesmas telas, mesmos fluxos, mesmos desfechos do scanner e as mesmas mensagens em português. O isolamento entre petshops SHALL continuar garantido pelo backend nos dois modos, nunca pelo frontend.

#### Scenario: Roteiro de campo no modo API
- **WHEN** o roteiro de teste da T-10 é executado num celular contra o app no modo `api`
- **THEN** cada passo tem o mesmo resultado que no modo `supabase`

#### Scenario: Código já usado na loja
- **WHEN** o usuário salva um produto com um código que já pertence ao produto "Ração Golden Adultos Frango 15kg" da mesma loja, em qualquer um dos modos
- **THEN** a mensagem diz "O código de barras … já pertence a Ração Golden Adultos Frango 15kg."

### Requirement: Sessão com a API persistida no navegador
No modo `api`, o frontend SHALL guardar o token de acesso só em memória e o refresh token no armazenamento local do navegador, e SHALL restaurar a sessão no carregamento a partir do refresh token, sem pedir a senha de novo. Refresh token recusado pela API no carregamento SHALL levar à tela de entrar, sem mensagem de erro.

#### Scenario: Recarregar a página logado
- **WHEN** um usuário logado no modo `api` recarrega o app
- **THEN** continua na mesma loja, sem informar a senha

#### Scenario: Sessão expirada no carregamento
- **WHEN** o app carrega com um refresh token que a API recusa (expirado ou revogado)
- **THEN** o usuário vê a tela de entrar e o refresh token é apagado do navegador

#### Scenario: Token de acesso fora do armazenamento
- **WHEN** um usuário está logado no modo `api`
- **THEN** o token de acesso não aparece no armazenamento local do navegador

### Requirement: Renovação transparente e em voo único
No modo `api`, uma chamada que receber `401` SHALL disparar a renovação da sessão e SHALL ser repetida uma única vez com o token novo, sem o usuário perceber. Chamadas que recebem `401` ao mesmo tempo SHALL esperar a mesma renovação: nunca SHALL haver duas renovações simultâneas com o mesmo refresh token. Se a renovação falhar por sessão inválida, o usuário SHALL sair do app e ver a tela de entrar.

#### Scenario: Token de acesso expirado
- **WHEN** o token de acesso expira e o usuário abre a lista de produtos
- **THEN** a lista carrega normalmente, depois de uma renovação feita em segundo plano

#### Scenario: Várias chamadas com o token vencido
- **WHEN** várias chamadas recebem `401` ao mesmo tempo
- **THEN** exatamente uma renovação é enviada à API, e todas as chamadas são repetidas com o token novo

#### Scenario: Sessão revogada
- **WHEN** a renovação é recusada pela API
- **THEN** o usuário vê a tela de entrar

### Requirement: Sessão sincronizada entre abas
No modo `api`, abas do app no mesmo navegador SHALL compartilhar a sessão: uma renovação feita numa aba SHALL ser aproveitada pelas outras, e sair numa aba SHALL tirar o usuário do app nas demais.

#### Scenario: Renovação em outra aba
- **WHEN** uma aba renova a sessão e outra aba faz uma chamada logo depois
- **THEN** a segunda aba usa o refresh token novo, sem ser deslogada pela detecção de reuso

#### Scenario: Sair em uma aba
- **WHEN** o usuário sai numa aba
- **THEN** as outras abas abertas vão para a tela de entrar

### Requirement: Sair encerra a sessão no backend
"Sair" SHALL encerrar a sessão também no backend: no modo `api`, o refresh token SHALL ser revogado na API e apagado do navegador. Falha de rede ao revogar MUST NOT impedir a saída local.

#### Scenario: Sair
- **WHEN** o usuário toca em "Sair" no modo `api`
- **THEN** vê a tela de entrar, e o refresh token que estava salvo não renova mais a sessão

#### Scenario: Sair sem conexão
- **WHEN** o usuário toca em "Sair" sem conexão
- **THEN** sai do app mesmo assim, e o refresh token é apagado do navegador

### Requirement: Erros do backend em português
Os erros dos dois backends SHALL ser traduzidos para as mesmas mensagens da tela: credenciais inválidas, e-mail já cadastrado (com o atalho para entrar), senha fraca, excesso de tentativas, sem conexão, código de barras já usado na loja e erro inesperado. No modo `api`, a tradução SHALL usar o campo `code` das respostas de erro da API, e a recusa por e-mail não confirmado SHALL pedir a confirmação do e-mail.

#### Scenario: Senha errada
- **WHEN** o usuário entra com a senha errada, em qualquer modo
- **THEN** vê "E-mail ou senha incorretos."

#### Scenario: Muitas tentativas na API
- **WHEN** a API responde `429` ao login
- **THEN** o usuário vê "Muitas tentativas. Aguarde um minuto e tente de novo."

#### Scenario: E-mail não confirmado
- **WHEN** a API recusa o login com `email_not_confirmed`
- **THEN** o usuário vê uma mensagem pedindo para confirmar o e-mail

#### Scenario: Sem conexão
- **WHEN** a API não responde por falta de rede
- **THEN** o usuário vê "Não foi possível conectar. Verifique a internet e tente de novo."

### Requirement: Build só com o backend em uso
O build de produção SHALL conter apenas a implementação do backend escolhido: no modo `api`, o pacote gerado MUST NOT conter o cliente do Supabase nem exigir chaves do Supabase. No modo `supabase`, a regra da spec `auth` sobre usar só a chave pública continua valendo.

#### Scenario: Build no modo API
- **WHEN** o frontend é compilado com `VITE_BACKEND=api`
- **THEN** o pacote gerado não contém o cliente do Supabase
