# auth Specification

## Purpose

Identificar o usuário do PetGest por e-mail e senha e manter a sessão dele no navegador, com o frontend conectado ao Supabase apenas pela chave pública do projeto.

## Requirements

### Requirement: Conta com e-mail e senha já autenticada
O sistema SHALL permitir criar uma conta com e-mail e senha e SHALL devolver uma sessão ativa na própria resposta do cadastro, sem exigir confirmação de e-mail, enquanto o V0 estiver em fase de testes.

#### Scenario: Cadastro de conta nova
- **WHEN** alguém cria uma conta com um e-mail ainda não cadastrado e uma senha válida
- **THEN** a conta é criada e a resposta já traz uma sessão ativa, sem nenhum e-mail de confirmação pendente

#### Scenario: E-mail já cadastrado
- **WHEN** alguém tenta criar uma conta com um e-mail que já tem conta
- **THEN** nenhuma conta nova é criada

### Requirement: Login com e-mail e senha
O sistema SHALL abrir uma sessão para quem informar e-mail e senha corretos e SHALL recusar credenciais incorretas.

#### Scenario: Credenciais corretas
- **WHEN** o usuário informa o e-mail e a senha da própria conta
- **THEN** recebe uma sessão ativa

#### Scenario: Senha errada
- **WHEN** o usuário informa um e-mail cadastrado com a senha errada
- **THEN** o login é recusado com erro de credenciais inválidas e nenhuma sessão é aberta

### Requirement: Sessão persistida no navegador
A sessão SHALL continuar ativa depois de recarregar a página ou reabrir o app no mesmo navegador, até o usuário sair.

#### Scenario: Recarregar a página logado
- **WHEN** um usuário com sessão ativa recarrega o app
- **THEN** continua com a mesma sessão, sem precisar informar a senha de novo

### Requirement: Conta nova sem petshop não vê dados
Uma conta autenticada que ainda não concluiu o cadastro do petshop SHALL não enxergar nenhum petshop nem produto.

#### Scenario: Consulta logo após criar a conta
- **WHEN** uma conta recém-criada, sem petshop vinculado, consulta petshops e produtos
- **THEN** nenhuma linha é devolvida

### Requirement: Frontend conectado só com a chave pública
O frontend SHALL se conectar ao Supabase usando apenas o endereço do projeto e a chave pública, e SHALL recusar iniciar a conexão, com uma mensagem que nomeie a configuração ausente, quando algum desses valores não estiver definido. A chave de serviço (que ignora o RLS) SHALL nunca fazer parte do frontend.

#### Scenario: Configuração ausente
- **WHEN** o app é iniciado sem o endereço do projeto ou sem a chave pública configurados e tenta usar o Supabase
- **THEN** a inicialização falha com uma mensagem dizendo qual variável falta, em vez de tentar requisições

#### Scenario: Build de produção
- **WHEN** o frontend é compilado para produção
- **THEN** o pacote gerado não contém a chave de serviço do Supabase
