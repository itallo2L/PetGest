## Context

Motivação em `proposal.md`. Sem specs (`skip_specs: true`): os requisitos testados já estão nas specs das etapas — `tenant-data` e `auth` (arquivadas), e os deltas ainda abertos de `auth`/`app-shell` (T-05), `products` (T-06), `product-scanning` (T-07), `store-settings` (T-08), `deployment` (T-09).

- **Estado:** todas as telas do V0 implementadas; prévia da `dev` verificada (T-09 2.1–2.3); produção `pet-gest.vercel.app` sem deploy (a `main` parou no spike da T-01).
- **Já validado pelo usuário:** Android — login/cadastro (T-05), scanner real (T-07); desktop — fluxo geral. **Nunca testado:** iPhone (T-01 5.4 e T-04 a T-08), motor WASM com câmera real.
- **Pendências herdadas:** T-07 4.4 (remover `/spike` depois do iPhone); limpeza de contas de teste (T-05 4.5, T-06 3.4, T-07 4.5, T-08 3.4, T-09 4.3); proteção de prévias religada (T-09).

## Goals / Non-Goals

**Goals:**
- Evidência registrada, por aparelho, de que cada fluxo do V0 funciona em produção.
- Nenhum defeito encontrado fica sem destino (correção ou decisão explícita de aceitar).

**Non-Goals:**
- Testes automatizados de ponta a ponta, teste de carga, testes de acessibilidade formais.
- Novas funcionalidades, mesmo que o teste sugira (viram ideia pós-V0 no `ROADMAPV0.md`).

## Decisions

### D1. Merge para a `main` antes do teste, iPhone depois
Decisão do usuário: Android e desktop bastam para publicar a produção; o teste de campo precisa da URL real (sem proteção de prévia, com o domínio que o petshop vai usar). Atualiza a T-09 (D2 e tarefa 4.1). A regra "`main` = validado" continua valendo para **fechar** o V0: a T-10 não é arquivada sem o iPhone.

### D2. Roteiro e relatório como arquivos da change
`roteiro.md`: passos numerados por seção, cada um com ação e resultado esperado, apontando o requisito de spec que verifica. `relatorio.md`: tabela por passo × aparelho (Android, iPhone) com ✅/❌/— e observação; cabeçalho com aparelho, sistema, navegador, rede e data. Ficam na change e vão para o arquivo junto dela — o histórico do teste do V0 fica rastreável.

### D3. Conta de campo própria, contas de teste removidas antes
Antes do teste, o usuário apaga as contas de teste acumuladas (lista nas pendências) e roda o SQL de limpeza de lojas sem usuário; o teste cria **uma** conta de campo nova em produção, com e-mail real do usuário. Evita confundir dados de verificação com dados do teste.

### D4. Defeito → ajuste na etapa de origem
Cada ❌ vira uma linha em "Defeitos" no `relatorio.md` (passo, aparelho, o que aconteceu, print) e uma tarefa nova no `tasks.md` da change de origem (T-05 a T-09), ainda abertas — e é corrigido lá, com a verificação da própria tarefa. A T-10 só registra e reexecuta o passo depois da correção. Se a correção mudar comportamento, a change de origem ganha o delta de spec correspondente.

### D5. Medições simples
Cronometrar a mão: abertura do app em 4G até a tela Entrar (primeiro acesso e recarga), e tempo da primeira leitura pelo scanner em 3 embalagens (Android; iPhone depois, incluindo o download do `.wasm`). Sem ferramenta; números aproximados bastam para as decisões pendentes (T-01 D6: servir o `.wasm` localmente).

### D6. Fechamento do V0 em ordem
Depois do iPhone: registrar T-01 5.4 → remover `/spike` (T-07 4.4) → arquivar T-01 e T-04, depois T-05 → T-06 → T-07 → T-08 → T-09 → T-10 (os deltas de `app-shell` e `auth` dependem dessa ordem) → `ROADMAPV0.md` com o V0 concluído.

## Risks / Trade-offs

- [iPhone indisponível por tempo indeterminado] → o V0 fica "pronto no Android, pendente no iPhone"; o roteiro do iPhone está pronto para rodar em qualquer momento. Registrado no `ROADMAPV0.md`.
- [Produção publicada antes do iPhone] → um defeito exclusivo do Safari fica em produção até a correção; aceitável porque a URL ainda não é divulgada a clientes.
- [Supabase gratuito pausado entre sessões de teste] → conferir no painel antes de testar (passo de preparação).
- [Confirmação de e-mail desligada em produção] → aceito até a change própria (T-09, riscos).

## Migration Plan

Sem migração de código. Rollback de produção: "Instant Rollback" na Vercel para o deploy anterior da `main`.
