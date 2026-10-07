## Why

O V1 só fica pronto com celular real, rede real e embalagens reais, a mesma regra do V0 (T-09/T-10, `CLAUDE.md` §Testes). Foto e voz ainda dependem do ambiente: luz, ruído do petshop, câmera e microfone de cada aparelho. A T-11 também pediu medir o acerto da IA e o custo real por cadastro contra a estimativa. Esta tarefa fecha o V1.

## What Changes

- **Roteiro de campo do V1** (`roteiro-v1.md`), que estende o da T-10 com:
  - conta e e-mail (T-22): confirmação, recuperação de senha, reenvio;
  - cadastro por foto (T-19) e por voz (T-20) em Android e iPhone, com embalagens reais e ambiente com ruído;
  - medições: acerto por campo, tempo de resposta e custo por cadastro, este pela resposta bruta da IA (consulta SQL pronta).
- **Relatório** (`relatorio-v1.md`) no formato do da T-10.
- **Guia para testar já** (`como-testar-agora.md`): rodar a API e o frontend no computador e testar pelo celular na mesma rede, antes de existir o ambiente publicado (T-17).
- Ao final, arquivar as changes T-11 a T-22 e marcar o V1 como concluído no `ROADMAPV1.md`.

## Capabilities

### New Capabilities
<!-- nenhuma — teste de campo, sem comportamento novo -->

### Modified Capabilities
<!-- nenhuma — defeito achado aqui vira ajuste na change de origem (mesma regra da T-10) -->

## Impact

- **Arquivos novos:** `roteiro-v1.md`, `relatorio-v1.md` e `como-testar-agora.md` nesta change.
- **Código:** nenhum. Defeitos viram tarefa na change de origem (T-16 a T-22).
- **Produção:** o roteiro roda em produção depois da T-18; antes disso, no ambiente de teste ou pela rede local.
