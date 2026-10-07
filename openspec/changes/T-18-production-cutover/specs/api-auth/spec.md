## ADDED Requirements

### Requirement: Importação das contas do V0
Na virada da produção, cada conta ativa do Supabase Auth (não apagada, não anônima e com e-mail) SHALL ser importada como uma conta da API com o mesmo identificador, o e-mail em minúsculas, o mesmo estado de confirmação e a mesma senha (hash bcrypt), de modo que o dono continue entrando com a senha de sempre e veja a mesma loja e os mesmos produtos. Contas apagadas ou anônimas no Supabase MUST NOT ser importadas. A importação SHALL poder ser repetida sem duplicar nem alterar contas já importadas, e MUST NOT apagar lojas, vínculos ou produtos.

#### Scenario: Dono do V0 depois da virada
- **WHEN** o dono de uma loja do V0 entra na API com o e-mail (em qualquer caixa) e a senha que usava no V0
- **THEN** a resposta é `200` e ele vê os produtos da própria loja

#### Scenario: Conta apagada no Supabase
- **WHEN** uma conta apagada no Supabase tenta entrar depois da virada
- **THEN** a resposta é `401` com o código `invalid_credentials`

#### Scenario: Importação repetida
- **WHEN** os scripts da virada são executados uma segunda vez
- **THEN** o número de contas, lojas e produtos não muda
