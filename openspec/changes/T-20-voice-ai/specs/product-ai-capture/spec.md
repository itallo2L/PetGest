## ADDED Requirements

### Requirement: Cadastro por voz
Com a IA disponível, o bloco "Preencher com IA" SHALL ter o botão "Voz", que abre um gravador: o app pede o microfone, grava mostrando o tempo decorrido e um exemplo do que falar, e para sozinho em 30 segundos ou quando o usuário toca em "Parar e preencher". O áudio SHALL ser enviado à API enquanto o botão mostra "Ouvindo…", e os campos reconhecidos SHALL ser preenchidos como na foto, com o aviso mostrando a transcrição ("Entendemos: …"). O microfone SHALL ser liberado ao parar, ao cancelar, ao fechar o gravador e quando o app sai da tela, e cancelar MUST NOT enviar nada à API. Microfone bloqueado ou navegador sem gravação SHALL mostrar uma mensagem que explique o que fazer, mantendo o formulário.

#### Scenario: Produto falado
- **WHEN** o usuário toca em "Voz", fala o produto e toca em "Parar e preencher"
- **THEN** o gravador fecha, os campos reconhecidos são preenchidos e o aviso mostra o que foi entendido

#### Scenario: Cancelar a gravação
- **WHEN** o usuário cancela o gravador no meio da gravação
- **THEN** o microfone é liberado, nada é enviado e o formulário continua como estava

#### Scenario: Microfone bloqueado
- **WHEN** o navegador nega o microfone
- **THEN** o gravador explica como liberar o microfone para o site
