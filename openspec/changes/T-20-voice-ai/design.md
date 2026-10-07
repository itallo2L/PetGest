## Context

Motivação em `proposal.md`; comportamento exigido em `specs/api-product-drafts/spec.md` e `specs/product-ai-capture/spec.md`.

- **Base da T-19:** `IProductDraftExtractor`, adaptador da OpenAI, normalização, rascunho em memória ligado ao produto pelo `draftId`, limite por usuário, bloco "Preencher com IA" e origem da IA ao salvar. Tudo vale igual para a voz; aqui entra só o que é próprio do áudio.
- **`PLANOMVP.md` §2.1:** gravação com `MediaRecorder` no navegador.
- **Navegadores:** o Chrome no Android grava `audio/webm;codecs=opus`; o Safari no iPhone grava `audio/mp4` (AAC). Ambos exigem HTTPS e permissão do microfone, como a câmera do scanner.

## Goals / Non-Goals

**Goals:**
- Falar o produto e ver o formulário preenchido, com o que a IA entendeu à vista.
- Microfone ligado só enquanto grava.

**Non-Goals:**
- Comandos de voz, ditado contínuo, vários produtos numa gravação.
- Transcrição no aparelho (Web Speech API): o suporte é irregular no iPhone e a qualidade em PT-BR varia; a transcrição no servidor é uma só para todos.

## Decisions

### D1. Duas etapas no servidor: transcrever, depois estruturar
`FromAudioAsync` envia o áudio para `/audio/transcriptions` (`Ai:OpenAI:TranscriptionModel`, padrão `gpt-4o-mini-transcribe`, `language = pt`) e manda o texto para o **mesmo** Chat Completions estruturado da foto (D2 da T-19), com as mesmas instruções, inclusive a de converter números falados ("cento e oitenta e nove e noventa" = 189,90).
- **Por que não um modelo de áudio de uma etapa só:** a transcrição separada é mais barata, fica disponível para mostrar ao usuário e para medir na T-21, e reaproveita o prompt e o esquema da foto.
- **Transcrição vazia (silêncio):** o modelo não é chamado e o rascunho vem vazio; o frontend avisa para tentar de novo.
- **Formato:** a OpenAI reconhece o formato pela extensão do arquivo. `AudioExtension` mapeia o tipo do `MediaRecorder` (`webm`, `ogg`, `mp4` → `m4a`, `mpeg`, `wav`). A API aceita até 10 MB (`Ai:MaxAudioBytes`), e 30 s de Opus ficam em torno de 100–200 KB.
- **Custo:** a transcrição é cobrada por minuto de áudio, mais os tokens da estruturação (só texto, bem menos que a foto). Ambos ficam na resposta bruta (`transcriptionModel`, `transcript`, `usage`).

### D2. Gravador em modal, 30 segundos, microfone solto em toda saída
`VoiceRecorder` abre por cima do formulário e pede o microfone ao abrir (`getUserMedia({ audio: true })`). O formato vem de `pickAudioMimeType`: WebM/Opus → WebM → MP4 → Ogg, ou o padrão do navegador.
- **Gravação:** cronômetro na tela; para sozinha aos 30 s (`MAX_RECORDING_SECONDS`), o bastante para nome, categoria e preço.
- **"Parar e preencher":** junta os pedaços e entrega o áudio.
- **Microfone sempre solto:** as trilhas são paradas ao parar, cancelar, fechar ou quando a página vai para o fundo (`visibilitychange`), que nesse caso descarta a gravação. É a mesma regra da câmera do scanner (T-07).
- **Sem permissão:** "Libere o microfone…". **Navegador sem `MediaRecorder`:** "Este navegador não grava áudio". O formulário continua utilizável nos dois casos.
- **Achado no ensaio:** no StrictMode de desenvolvimento o efeito monta duas vezes, e a limpeza da primeira montagem deixava a gravação marcada como "descartada"; o "Parar" não entregava o áudio. A marca agora é zerada no início do efeito.

### D3. Mostrar o que foi entendido
O aviso de preenchimento inclui "Entendemos: “…”" com a transcrição, para o usuário perceber na hora uma palavra mal entendida (marca, peso) e corrigir o campo antes de salvar. A origem ao salvar é `voice_ai`, pela mesma regra da foto (D7 da T-19).

## Risks / Trade-offs

- [Ruído do petshop] → instruções pedem `null` na dúvida; o usuário vê a transcrição; o teste de campo da T-21 grava em ambiente real.
- [Safari grava `audio/mp4` com um tipo diferente do esperado] → a API aceita as variantes comuns (`audio/mp4`, `audio/x-m4a`, `audio/aac`); outro tipo responde `invalid_file`, e a mensagem aparece no bloco.
- [Microfone esquecido ligado] → solto em toda saída (D2); conferido no ensaio (trilhas paradas ao cancelar e ao terminar).
