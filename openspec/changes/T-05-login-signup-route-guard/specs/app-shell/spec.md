## Purpose

Estrutura de navegação do app autenticado: dá acesso às áreas do V0 (Produtos e Configurações), identifica a loja logada e se adapta ao celular, além de manter uma rota pública para o spike do scanner enquanto ele estiver em teste.

## ADDED Requirements

### Requirement: Navegação entre as áreas do V0
O shell SHALL oferecer navegação entre Produtos e Configurações, indicando qual área está aberta, e cada área SHALL ter endereço próprio, de modo que recarregar a página ou usar o botão voltar mantenha a área correta.

#### Scenario: Trocar de área
- **WHEN** o usuário escolhe Configurações na navegação
- **THEN** a área de Configurações abre, o item fica marcado como ativo e o título da página muda para "Configurações"

#### Scenario: Recarregar numa área
- **WHEN** o usuário recarrega a página estando em Configurações
- **THEN** continua em Configurações

#### Scenario: Endereço raiz
- **WHEN** um usuário logado abre o endereço raiz do app
- **THEN** vê a área de Produtos

### Requirement: Identificação da loja
O shell SHALL mostrar o nome do petshop do usuário logado e suas iniciais.

#### Scenario: Loja logada
- **WHEN** o usuário da loja "Pet Shop Amigo Fiel" está no app
- **THEN** o shell mostra "Pet Shop Amigo Fiel" e as iniciais "PS" (primeira letra das duas primeiras palavras)

### Requirement: Áreas ainda não implementadas
Enquanto Produtos e Configurações não estiverem prontas, cada área SHALL mostrar um aviso de que está em construção, sem dados fictícios.

#### Scenario: Abrir Produtos antes de T-06
- **WHEN** o usuário abre Produtos
- **THEN** vê um estado vazio dizendo que a área está em construção, sem lista de produtos simulada

### Requirement: Navegação no celular
Em telas estreitas, a navegação SHALL ficar recolhida numa gaveta aberta por um botão de menu, e SHALL fechar ao escolher um item, ao tocar fora dela ou ao pressionar Esc.

#### Scenario: Abrir e escolher item no celular
- **WHEN** o usuário, num celular, toca no botão de menu e escolhe Configurações
- **THEN** a gaveta abre, e ao escolher o item ela fecha e Configurações é exibida

#### Scenario: Fechar tocando fora
- **WHEN** a gaveta está aberta e o usuário toca na área escurecida ao lado
- **THEN** a gaveta fecha e o foco volta para o botão de menu

### Requirement: Spike do scanner público
Enquanto o scanner não estiver integrado ao cadastro de produto, a tela de spike SHALL continuar acessível num endereço próprio sem exigir login.

#### Scenario: Abrir o spike sem conta
- **WHEN** alguém sem sessão abre o endereço do spike
- **THEN** vê a tela de spike do scanner, sem ser levado à tela de entrar
