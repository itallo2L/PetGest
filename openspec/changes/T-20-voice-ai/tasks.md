## 1. Backend

- [x] 1.1 `FromAudioAsync` no adaptador da OpenAI (transcrição em PT-BR com o nome de arquivo pela extensão do formato, depois o Chat Completions estruturado; silêncio não chama o modelo; transcrição e modelo na resposta bruta) e `POST /products/drafts/voice` (design D1); verificar com testes: multipart com `filename=audio.webm`, modelo e idioma; texto da transcrição no prompt; áudio sem fala → uma só chamada; extensão por formato; endpoint com extrator falso devolvendo preço e transcrição, `502` em falha — _verificado em 2026-10-07: `OpenAiExtractorTests` e `ProductDraftsApiTests` verdes (suíte 252/252). Ajuste feito aqui: `MediaTypeHeaderValue` não aceita `;codecs=opus` no construtor, trocado por `Parse`_

## 2. Frontend

- [x] 2.1 `VoiceRecorder` (permissão, `pickAudioMimeType`, cronômetro, parada aos 30 s, microfone solto em toda saída, mensagens de microfone bloqueado e de navegador sem gravação) e botão "Voz" com a transcrição no aviso (design D2, D3); verificar no navegador no modo `api` com a API apontando para o servidor falso no formato da OpenAI e o microfone simulado por um oscilador do `AudioContext` — _verificado em 2026-10-07 (DOM): "Gravando… 2s de 30s" → "Parar e preencher" → nome "Petisco Dreamies Salmão 60g", categoria "Petiscos", preço "9,90" e "Entendemos: “Petisco Dreamies salmão…”"; salvo com `source = voice_ai` e `transcript`/`transcriptionModel` na resposta bruta; cancelar no meio → trilhas paradas e nenhuma chamada de transcrição a mais; microfone negado → "O microfone foi bloqueado…". Defeito achado e corrigido aqui: no StrictMode o "Parar" não entregava o áudio (marca de descarte da primeira montagem)_

## 3. No celular (usuário)

- [ ] 3.1 (Usuário) Com a chave da IA configurada (tarefa 3.2 da T-19), no celular pela prévia da `dev`: tocar "Voz", permitir o microfone, falar um produto com preço e conferir o formulário preenchido — no Android (Chrome) e no iPhone (Safari, que grava em MP4); conferir que o indicador de microfone do sistema apaga ao parar e ao cancelar
- [ ] 3.2 (Usuário) Incluir ~10 áudios gravados no petshop no teste de bancada da T-19 (tarefa 3.1 de lá) e anotar o acerto da transcrição e dos campos
