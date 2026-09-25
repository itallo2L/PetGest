## Why

Cada etapa do V0 (T-01 a T-09) foi verificada isoladamente — boa parte no navegador do desktop, com câmera simulada. O V0 só está pronto quando o fluxo inteiro funciona no aparelho do petshop: celular real, HTTPS da URL publicada, câmera de verdade lendo embalagens reais, rede móvel. Esta etapa faz esse teste de ponta a ponta e fecha o V0.

## What Changes

- **Produção antes do teste:** o merge `dev` → `main` sai agora (Android e desktop já validaram) e o teste roda em **https://pet-gest.vercel.app**. Isso antecipa a decisão D2 da T-09 (antes: merge só depois do iPhone).
- **Roteiro de teste de campo** versionado nesta change (`roteiro.md`): preparação, autenticação, navegação, produtos, scanner (incluindo os erros: permissão negada, código desconhecido), configurações e medições (tempo de carregamento, primeira leitura), com resultado esperado por passo.
- **Execução no Android agora**, com registro dos resultados num relatório (`relatorio.md`) — passou/falhou, aparelho, navegador, observações.
- **Problemas encontrados viram ajustes pontuais** na change da etapa de origem (T-05 a T-08), não tarefas novas no roadmap — conforme `ROADMAPV0.md`.
- **iPhone bloqueia o fechamento:** o roteiro do iPhone (o mesmo, mais a medição do motor WASM da T-01 5.4) fica pronto; a T-10 e o V0 só são arquivados depois dele. Sem exceção à regra do `CLAUDE.md`.
- **Fechamento do V0** (depois do iPhone): remoção do `/spike` (T-07 4.4), arquivamento das changes na ordem certa e `ROADMAPV0.md` marcando o V0 como concluído.

Fora desta etapa: reativar confirmação de e-mail, recuperação de senha, domínio próprio, melhorias que não sejam correção de defeito encontrado no teste.

## Capabilities

### New Capabilities
<!-- nenhuma -->

### Modified Capabilities
<!-- nenhuma -->

Esta change declara `skip_specs: true`: é validação, sem comportamento novo. Se um defeito exigir mudar um requisito, a correção leva um delta de spec na change da etapa de origem.

## Impact

- **Git/Vercel:** PR `dev` → `main` (usuário) → primeiro deploy de produção; teste de fumaça da T-09 (4.2) em produção.
- **Documentos:** `openspec/changes/T-10-field-test/roteiro.md` e `relatorio.md`; `ROADMAPV0.md` (status de T-09/T-10 e do V0); T-09 (`design.md` D2 e `tasks.md` 4.1) ajustada para o merge antecipado.
- **Dados:** uma conta/loja de campo criada em produção (mantida ou apagada ao final, a critério do usuário); contas de teste antigas removidas antes.
- **Código:** só se o teste encontrar defeitos.
