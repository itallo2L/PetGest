## Purpose

Permite ler o código de barras EAN-13 de um produto usando a câmera do celular, direto no navegador, para que o cadastro de produto do petshop comece pelo código impresso na embalagem em vez de digitação.

## ADDED Requirements

### Requirement: Solicitar acesso à câmera traseira
O sistema SHALL solicitar permissão de câmera ao usuário quando ele iniciar a leitura e SHALL preferir a câmera traseira do aparelho quando houver mais de uma.

#### Scenario: Usuário concede permissão
- **WHEN** o usuário inicia a leitura e concede acesso à câmera
- **THEN** o vídeo da câmera traseira é exibido na tela e a detecção de código começa

#### Scenario: Usuário nega permissão
- **WHEN** o usuário inicia a leitura e nega o acesso à câmera
- **THEN** o sistema exibe uma mensagem clara de que a câmera foi negada e como liberar, sem travar a tela

#### Scenario: Aparelho sem câmera ou contexto inseguro
- **WHEN** o navegador não expõe câmera (sem hardware, sem suporte ou página servida sem HTTPS fora de localhost)
- **THEN** o sistema exibe uma mensagem explicando que a câmera não está disponível nesse contexto

### Requirement: Detectar EAN-13 continuamente sobre o vídeo
Enquanto a câmera estiver ativa, o sistema SHALL analisar os quadros do vídeo de forma contínua em busca de códigos no formato EAN-13 e SHALL ignorar códigos de outros formatos.

#### Scenario: Código EAN-13 enquadrado
- **WHEN** um código de barras EAN-13 legível entra no campo de visão da câmera
- **THEN** o sistema exibe os 13 dígitos lidos na tela em até poucos segundos, sem que o usuário precise tocar em nada

#### Scenario: Código de outro formato enquadrado
- **WHEN** um QR code ou outro formato que não seja EAN-13 entra no campo de visão
- **THEN** nada é exibido como resultado e a detecção continua

#### Scenario: Mesmo código mantido no enquadramento
- **WHEN** o mesmo EAN-13 permanece visível por vários quadros seguidos
- **THEN** o resultado exibido não pisca nem se repete em lista — o código aparece uma única vez

### Requirement: Funcionar em Android e iPhone
O sistema SHALL ler EAN-13 tanto em navegadores com suporte nativo à detecção de código de barras (Chrome/Edge no Android) quanto em navegadores sem esse suporte (Safari no iOS, Firefox), usando um motor de fallback quando necessário.

#### Scenario: Navegador com detecção nativa
- **WHEN** a página abre em um navegador que oferece detecção nativa de EAN-13
- **THEN** a leitura funciona e a tela indica que o motor nativo está em uso

#### Scenario: Navegador sem detecção nativa
- **WHEN** a página abre em um navegador sem detecção nativa (ex.: Safari no iPhone)
- **THEN** a leitura funciona por meio do motor de fallback e a tela indica que o fallback está em uso

### Requirement: Liberar a câmera ao encerrar
O sistema SHALL desligar a câmera (parar a captura de vídeo) quando o usuário encerrar a leitura ou sair da tela, para que o indicador de câmera do aparelho apague e a bateria não seja consumida.

#### Scenario: Usuário encerra a leitura
- **WHEN** o usuário toca em parar/encerrar
- **THEN** o vídeo some, o indicador de câmera do sistema apaga e a tela volta ao estado inicial pronta para iniciar de novo

#### Scenario: Usuário sai da tela com a câmera ligada
- **WHEN** a tela de leitura é fechada ou a página é deixada com a câmera ativa
- **THEN** a captura de vídeo é interrompida sem deixar a câmera ligada em segundo plano
