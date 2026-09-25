## ADDED Requirements

### Requirement: Tela de entrar
O app SHALL oferecer uma tela para entrar com e-mail e senha que valide os campos antes de enviar, SHALL mostrar em português o motivo de uma recusa e SHALL levar o usuário para dentro do app quando o login der certo.

#### Scenario: Login bem-sucedido
- **WHEN** o usuário informa e-mail e senha corretos e envia
- **THEN** entra no app, na página que tentou abrir antes do login ou em Produtos se não havia nenhuma

#### Scenario: Credenciais incorretas
- **WHEN** o usuário informa um e-mail ou uma senha que não conferem
- **THEN** continua na tela de entrar com a mensagem "E-mail ou senha incorretos." e a senha digitada é mantida para correção

#### Scenario: Campos inválidos
- **WHEN** o usuário envia com e-mail em formato inválido ou senha vazia
- **THEN** nenhuma requisição é feita e a mensagem indica qual campo corrigir

#### Scenario: Sem conexão
- **WHEN** o envio falha por falta de rede
- **THEN** a mensagem informa que não foi possível conectar e pede para tentar de novo

#### Scenario: Envio em andamento
- **WHEN** o login está sendo processado
- **THEN** o botão de enviar fica desabilitado e indica que está entrando, impedindo envio duplicado

### Requirement: Criar conta com a loja
O app SHALL permitir criar, numa única tela, a conta de acesso e o petshop, pedindo nome da loja, telefone (opcional), e-mail e senha; o e-mail informado SHALL ser usado tanto para entrar quanto como e-mail da loja.

#### Scenario: Cadastro completo
- **WHEN** alguém preenche nome da loja, e-mail ainda não cadastrado e senha válida e envia
- **THEN** a conta e o petshop são criados, o usuário já entra no app e vê o nome da loja no shell

#### Scenario: E-mail já cadastrado
- **WHEN** o e-mail informado já tem conta
- **THEN** nada é criado e a mensagem sugere entrar com essa conta, com link para a tela de entrar

#### Scenario: Senha fraca
- **WHEN** a senha não atende ao mínimo exigido pelo Supabase
- **THEN** nada é criado e a mensagem informa o tamanho mínimo da senha

#### Scenario: Nome da loja vazio
- **WHEN** o usuário envia sem o nome da loja
- **THEN** nenhuma requisição é feita e a mensagem pede o nome da loja

### Requirement: Concluir cadastro incompleto
Uma conta autenticada sem petshop vinculado SHALL ser levada a uma tela para informar os dados da loja e SHALL não acessar o shell do app até concluir.

#### Scenario: Conta criada sem a loja
- **WHEN** um usuário entra com uma conta que ainda não tem petshop
- **THEN** vê a tela "Concluir cadastro da loja" com o e-mail da conta já preenchido, e ao enviar o petshop é criado e ele entra no app

#### Scenario: Falha ao criar a loja no cadastro
- **WHEN** a conta é criada mas a criação da loja falha (por exemplo, queda de rede)
- **THEN** o usuário continua logado e vê a tela "Concluir cadastro da loja", sem precisar criar outra conta

### Requirement: Páginas protegidas por sessão
As páginas do app (Produtos, Configurações) SHALL exigir sessão ativa com petshop vinculado; sem sessão, o usuário SHALL ser levado à tela de entrar. Enquanto a sessão salva ainda está sendo verificada, o app SHALL não mostrar a tela de entrar nem o shell.

#### Scenario: Acesso sem sessão
- **WHEN** alguém sem sessão abre o endereço de uma página protegida
- **THEN** vê a tela de entrar e, após entrar, volta para aquela página

#### Scenario: Usuário logado abre a tela de entrar
- **WHEN** um usuário com sessão ativa e petshop abre a tela de entrar ou de criar conta
- **THEN** é levado para Produtos

#### Scenario: Sessão encerrada em outra aba
- **WHEN** o usuário sai do app em outra aba do mesmo navegador
- **THEN** a aba atual passa a mostrar a tela de entrar sem precisar recarregar

### Requirement: Sair
O app SHALL permitir sair a qualquer momento pelo shell, encerrando a sessão no navegador.

#### Scenario: Sair do app
- **WHEN** o usuário escolhe "Sair"
- **THEN** a sessão é encerrada, ele vê a tela de entrar e, ao recarregar a página, continua deslogado
