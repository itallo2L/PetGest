## Purpose

Permitir que o usuário aponte a câmera do celular para o código de barras de um produto e chegue direto ao produto da loja (se já existe) ou ao cadastro com o código preenchido (se não existe), com a digitação do código sempre disponível como alternativa.

## ADDED Requirements

### Requirement: Escanear a partir da lista de produtos
A área Produtos SHALL oferecer um botão "Escanear" que abre o leitor; ao ler um código válido, o sistema SHALL procurar o código entre os produtos da loja logada e seguir um de dois desfechos, sem nenhuma base de produtos externa.

#### Scenario: Código já cadastrado na loja
- **WHEN** o usuário escaneia o código de um produto que a loja já cadastrou
- **THEN** o leitor mostra "Produto já cadastrado" com o nome e o preço do produto e oferece "Editar produto", que abre o formulário de edição desse produto

#### Scenario: Código não encontrado
- **WHEN** o usuário escaneia um código que a loja ainda não cadastrou
- **THEN** o leitor fecha e o formulário "Cadastrar produto" abre com o código preenchido e os demais campos vazios

#### Scenario: Código cadastrado só em outra loja
- **WHEN** o código lido existe apenas em outro petshop
- **THEN** o desfecho é "não encontrado"

#### Scenario: Produto cadastrado por outro aparelho
- **WHEN** outro aparelho da mesma loja cadastrou o produto depois que a lista foi carregada e o usuário escaneia esse código
- **THEN** o desfecho é "Produto já cadastrado"

### Requirement: Escanear dentro do formulário de produto
O campo de código de barras do formulário SHALL ter um botão "Escanear" que abre o leitor e, ao ler, preenche o campo; se o código já pertencer a outro produto da loja, o leitor SHALL avisar qual e oferecer abrir esse produto em vez de preencher.

#### Scenario: Preencher o código pelo leitor
- **WHEN** o usuário, cadastrando um produto, toca em "Escanear" e lê um código ainda não usado na loja
- **THEN** o leitor fecha e o campo de código fica preenchido, com os demais campos preservados

#### Scenario: Código já usado por outro produto
- **WHEN** o código lido já pertence a outro produto da loja
- **THEN** o leitor mostra "Produto já cadastrado" com o nome desse produto e oferece abri-lo, sem alterar o formulário atual

### Requirement: Origem do cadastro
Um produto cadastrado a partir de um código lido pela câmera SHALL ser registrado com origem "código de barras"; um produto cujo código foi digitado ou que não tem código SHALL continuar com origem "manual".

#### Scenario: Cadastro depois de escanear
- **WHEN** o usuário escaneia um código não encontrado e conclui o cadastro sem alterar o código
- **THEN** o produto é gravado com origem "código de barras"

#### Scenario: Código trocado à mão depois de escanear
- **WHEN** o usuário escaneia, mas depois apaga ou altera o código no formulário e salva
- **THEN** o produto é gravado com origem "manual"

### Requirement: Leitura confiável
O leitor SHALL aceitar apenas códigos EAN-13 ou EAN-8 com dígito verificador válido e lidos de forma idêntica em leituras consecutivas, e SHALL confirmar a leitura aceita com vibração quando o aparelho permitir.

#### Scenario: Leitura com dígito verificador inválido
- **WHEN** a câmera decodifica um código cujo dígito verificador não confere
- **THEN** a leitura é ignorada e o leitor continua procurando

#### Scenario: Leitura instável
- **WHEN** a câmera decodifica um código diferente a cada quadro
- **THEN** nenhum código é aceito até que o mesmo valor seja lido nas leituras consecutivas exigidas

#### Scenario: EAN-8
- **WHEN** o usuário escaneia um código EAN-8 válido
- **THEN** o código de 8 dígitos é aceito e segue os mesmos desfechos

### Requirement: Digitar o código no leitor
O leitor SHALL oferecer, em todos os estados antes da leitura (inclusive câmera negada ou indisponível), um campo "Ou digite o código" que segue os mesmos desfechos de uma leitura, recusando códigos que não tenham de 8 a 14 dígitos.

#### Scenario: Câmera negada
- **WHEN** o usuário nega o acesso à câmera
- **THEN** o leitor explica como liberar a câmera e continua oferecendo o campo para digitar o código

#### Scenario: Código digitado inválido
- **WHEN** o usuário digita "12345" e confirma
- **THEN** o leitor mostra que o código precisa ter de 8 a 14 dígitos e não procura nada

### Requirement: Estados e mensagens do leitor
O leitor SHALL mostrar em português o estado atual: pedindo permissão, lendo (vídeo da câmera traseira com a área de mira), permissão negada, câmera indisponível ou sem HTTPS, e código lido.

#### Scenario: Pedindo permissão
- **WHEN** o leitor abre pela primeira vez
- **THEN** mostra "Liberando a câmera…" até o navegador responder

#### Scenario: Aparelho sem câmera ou sem HTTPS
- **WHEN** o navegador não oferece câmera
- **THEN** o leitor informa que a câmera não está disponível e mantém o campo de digitar o código

### Requirement: Lanterna quando disponível
O leitor SHALL oferecer um botão de lanterna somente quando o aparelho e o navegador permitirem controlá-la, e SHALL apagá-la ao fechar o leitor.

#### Scenario: Aparelho sem suporte
- **WHEN** o navegador não expõe controle da lanterna (ex.: iPhone)
- **THEN** o botão de lanterna não aparece

### Requirement: Liberar a câmera
O leitor SHALL desligar a câmera (e a lanterna) sempre que fechar — por leitura concluída, cancelamento, Esc, toque fora ou saída da página.

#### Scenario: Fechar o leitor
- **WHEN** o usuário fecha o leitor por qualquer caminho
- **THEN** o indicador de câmera em uso do celular apaga
