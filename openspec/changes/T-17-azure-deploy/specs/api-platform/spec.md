## ADDED Requirements

### Requirement: Códigos assinados válidos entre reinícios e instâncias
As chaves que assinam os códigos enviados por e-mail (confirmação de e-mail e, a partir da T-22, redefinição de senha) SHALL ficar no banco de dados da API, para que um código gerado antes de um reinício, de um novo deploy ou em outra instância da API continue válido dentro do prazo.

#### Scenario: Código confirmado depois de um novo deploy
- **WHEN** uma conta é criada, a API é reiniciada ou publicada de novo, e o usuário abre o link de confirmação dentro de 24 horas
- **THEN** o e-mail é confirmado

### Requirement: IP do cliente atrás de proxy
Quando a configuração indicar que a API roda atrás de um proxy (`ForwardedHeaders:Enabled`), a API SHALL tomar como IP do cliente a última entrada do cabeçalho `X-Forwarded-For`, de modo que o limite de tentativas conte cada cliente separadamente. Entradas anteriores do cabeçalho MUST NOT ser usadas. Sem essa configuração, o cabeçalho MUST ser ignorado.

#### Scenario: Dois clientes atrás do mesmo proxy
- **WHEN** a API está atrás do proxy e o cliente A esgota o limite de tentativas de login
- **THEN** o cliente B, com outro IP, continua conseguindo tentar

#### Scenario: Cabeçalho forjado pelo cliente
- **WHEN** um cliente que esgotou o limite manda um `X-Forwarded-For` com um IP inventado antes do IP que o proxy acrescentou
- **THEN** continua recebendo `429`

#### Scenario: Sem proxy configurado
- **WHEN** a API não está configurada para proxy e um cliente varia o `X-Forwarded-For` a cada tentativa
- **THEN** todas as tentativas contam para o mesmo limite

### Requirement: Conexão com o banco adequada ao pooler
A API SHALL descartar conexões ociosas e manter as conexões ativas vivas antes que o pooler do banco as derrube, e SHALL limitar o número de conexões abertas por instância, usando padrões próprios sempre que a string de conexão não definir esses valores. Valores definidos na string de conexão SHALL prevalecer.

#### Scenario: String de conexão sem ajustes
- **WHEN** a API é configurada só com host, banco, usuário e senha
- **THEN** usa keepalive de 30 s, descarta conexões ociosas há 60 s e abre no máximo 10 conexões

#### Scenario: Ajuste explícito
- **WHEN** a string de conexão define outro limite de conexões
- **THEN** a API usa o valor da string
