## Purpose

Garantir como o PetGest chega ao usuário em produção: publicado a partir da branch validada, por HTTPS, com qualquer endereço do app abrindo diretamente e sem nenhuma credencial capaz de contornar o isolamento por petshop.

## ADDED Requirements

### Requirement: Produção publicada a partir da main
A versão de produção SHALL ser publicada a partir da branch `main`, por HTTPS, num endereço estável; alterações na `dev` SHALL gerar apenas deploys de prévia, sem mudar a produção.

#### Scenario: Push na dev
- **WHEN** um commit é enviado para a `dev`
- **THEN** a Vercel gera um deploy de prévia e o endereço de produção continua servindo a versão anterior

#### Scenario: Merge na main
- **WHEN** a `dev` validada é mesclada na `main`
- **THEN** o endereço de produção passa a servir a nova versão, por HTTPS

### Requirement: Endereços diretos abrem o app
Qualquer endereço do app aberto diretamente, recarregado ou compartilhado SHALL carregar o app na tela correspondente, e não uma página de erro do servidor.

#### Scenario: Abrir Produtos pelo endereço
- **WHEN** alguém abre `<produção>/produtos` diretamente no navegador
- **THEN** o app carrega e, sem sessão, mostra a tela de entrar; com sessão, mostra Produtos

#### Scenario: Endereço inexistente
- **WHEN** alguém abre um caminho que o app não conhece
- **THEN** o app carrega e leva para Produtos (ou para entrar, sem sessão)

### Requirement: Nenhuma chave de serviço entregue ao navegador
O conteúdo publicado e as variáveis de ambiente do deploy SHALL conter apenas o endereço do projeto Supabase e a chave pública; nenhuma chave de serviço ou secreta SHALL estar presente.

#### Scenario: Inspecionar o bundle de produção
- **WHEN** os arquivos JavaScript servidos em produção são inspecionados
- **THEN** não contêm chave `service_role` nem `sb_secret_`, e a única chave do Supabase presente é a pública

#### Scenario: Conferir o painel da Vercel
- **WHEN** as variáveis de ambiente do projeto na Vercel são listadas
- **THEN** existem apenas `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com a chave pública
