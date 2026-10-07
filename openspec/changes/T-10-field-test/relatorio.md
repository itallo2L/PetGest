# Relatório do teste de campo — V0

Roteiro: `roteiro.md`. Legenda: ✅ passou · ❌ falhou · — não se aplica ·
(vazio) não executado.

## Aparelhos

| | Android | iPhone |
|---|---|---|
| Data | 2026-10-06 | |
| Aparelho (modelo) | Samsung Galaxy A15 | |
| Sistema (versão) | Android 16 | |
| Navegador (versão) | Chrome 154.0.8037.94 | Safari |
| Rede (operadora, 4G/5G) | Claro, 4G | |
| Versão testada (commit da `main`) | `79bf0f5` | `79bf0f5` |

## Resultados

| Passo | Android | iPhone | Observação |
|-------|---------|--------|------------|
| 0.1 | ✅ | ✅ | 2026-10-06: projeto ativo. Conta "Rusticão" mantida de propósito (não é de teste). Conta de teste "Pet test" apagada no painel, mas a linha dela em `petshops` ficou órfã (apagar o usuário não apaga a loja) |
| 0.2 | ✅ | | |
| 0.3 | ✅ | | |
| 0.4 | ✅ | | |
| 1.1 | ✅ | | Entrar apareceu praticamente na hora (~1 s) |
| 1.2 | ✅ | | ~1 s |
| 1.3 | ✅ | | ~1 s |
| 2.1 | ✅ | | |
| 2.2 | ✅ | | |
| 2.3 | ✅ | | Conta criada com senha de 6 caracteres: o mínimo do app é 6 (`MIN_PASSWORD_LENGTH`, padrão do Supabase). O "8+" do roteiro estava errado e foi corrigido |
| 2.4 | ✅ | | |
| 3.1 | ✅ | | |
| 3.2 | ✅ | | |
| 3.3 | ✅ | | |
| 3.4 | ✅ | | |
| 4.1 | ✅ | | |
| 4.2 | ✅ | | |
| 4.3 | ✅ | | |
| 4.4 | ✅ | | |
| 4.5 | ✅ | | |
| 4.6 | ✅ | | |
| 4.7 | ✅ | | |
| 4.8 | ✅ | | |
| 4.9 | ✅ | | |
| 4.10 | ✅ | | |
| 4.11 | ✅ | | "Limpar busca e filtros" / "Limpar filtros" foca a busca e abre o teclado (ver Usabilidade U1) |
| 4.12 | ✅ | | Abrir o produto foca "Nome do produto" e abre o teclado (ver Usabilidade U1) |
| 4.13 | ✅ | | |
| 4.14 | ✅ | | |
| 4.15 | ✅ | | |
| 5.1 | | | |
| 5.2 | ✅ | | Negar a câmera foi respeitado |
| 5.3 | | | |
| 5.4 | ✅ | | Liberar a câmera depois foi respeitado |
| 5.5 | ✅ | | O código já cadastrado foi reconhecido |
| 5.6 | ✅ | | Sabonete facial (EAN-13 7898670904093) foi lido e o cadastro abriu com o código |
| 5.7 | ✅ | | Sabonete facial gravado com `source = barcode` (conferido no banco) |
| 5.8 |  | | Não há produto com código trocado à mão depois de escanear: o passo parece não ter sido feito |
| 5.9 | | | |
| 5.10 | | | |
| 5.11 | ✅ | | Rexona: EAN-8 `78924383` lido pela câmera (dígito verificador confere) e gravado com `source = barcode`. Depois foi editado à mão para 9 dígitos, e a origem continua `barcode` porque a edição não muda a origem (de propósito, `ProductFormModal.tsx`) |
| 5.12 | | | |
| 5.13 | | | |
| 5.14 | | | |
| 6.1 | ✅ | |  |
| 6.2 | ✅ | | O campo inválido recebe foco, o teclado abre e cobre a mensagem de erro (ver U1) |
| 6.3 | ✅ | |  |
| 6.4 | ✅ | |  |
| 7.1 | ✅ | | Depois de sair, o campo E-mail já vem com foco e o teclado aberto (ver U1) |
| 7.2 | ✅ | |  |
| 7.3 | ✅ | |  |
| 7.4 | ✅ | |  |
| 7.5 | ✅ | |  |
| 7.6 | ✅ | |  |
| 7.7 | ✅ | |  |
| 8.1 | ✅ | |  |
| 8.2 | ✅ | |  |
| 8.3 | ✅ | |  |
| 8.4 | ✅ | | Testado sem recarregar (Configurações → modo avião → Produtos pelo menu): "Carregando produtos…" por ~7 s, aparecendo no canto superior esquerdo, depois a falha com "Tentar de novo". Sem o modo avião, "Tentar de novo" trouxe a lista. Recarregar sem rede mostra o dinossauro do Chrome (sem cache offline, esperado no V0) |
| 9.1 | | | |
| 9.2 | | | |
| 9.3 | | | |
| 9.4 | | | |
| 9.5 | | | |
| 10.1 |  | | B (Sabonete facial) = `barcode` ✅. C não existe (ver 5.8) |
| 10.2 | ✅ | | Conta de campo mantida por enquanto |

## Medições

| Medição | Android | iPhone |
|---------|---------|--------|
| M1 — primeiro acesso até Entrar (s) | ~1 | |
| M2 — reabrir logado até a lista (s) | | |
| M3 — primeira leitura, embalagem 1 (s) | | |
| M3 — primeira leitura, embalagem 2 (s) | | |
| M3 — primeira leitura, embalagem 3 (s) | | |
| `/spike` — motor exibido | | |
| `/spike` — `firstReadMs` | | |
| `/spike?engine=wasm` — `firstReadMs` | | — |

## Defeitos

Cada ❌ vira uma linha aqui e uma tarefa no `tasks.md` da change de origem
(design D4). Reexecutar o passo depois da correção e atualizar a tabela de
resultados.

| # | Passo | Aparelho | O que aconteceu | Esperado | Change de origem / tarefa | Situação |
|---|-------|----------|-----------------|----------|---------------------------|----------|
| D1 | 5.x | Android | De 4 embalagens, a câmera só leu 2; detalhes por embalagem pendentes | Leitura confiável de EAN-13/EAN-8 | T-07 (product-scanning › Leitura confiável) | Aberto: falta detalhar |

## Usabilidade

Comportamentos que não violam nenhum requisito, mas atrapalham no celular.
Decidir se viram tarefa.

| # | Passo | Aparelho | O que acontece | Causa | Situação |
|---|-------|----------|----------------|-------|----------|
| U1 | 4.11, 4.12, 6.2, 7.1 | Android | O teclado abre sozinho ao tocar em "Limpar filtros" / "Limpar busca e filtros" (foco na busca), ao abrir um produto para edição (foco em "Nome do produto") e na tela Entrar (foco no E-mail). Em Configurações, o foco vai ao campo inválido e o teclado **cobre a mensagem de erro** | Intencional, design D9 da T-06: o modal foca o primeiro campo ao abrir (`Modal.tsx`) e o "Limpar" devolve o foco à busca (`ProductsPage.tsx`); os formulários focam o campo inválido (`SettingsPage.tsx`, `ProductFormModal.tsx`, `SignupPage.tsx`, `LoginPage.tsx`); a tela Entrar usa `autoFocus`. Bom no desktop, ruim em tela de toque | Corrigido em `b65f729` (foco automático desligado em tela de toque; o erro fecha o teclado e rola para a tela). Retestado em 2026-10-06 no Android pela prévia da `dev` (4.11, 4.12, 6.2, 7.1): passou | 

## Decisões

- Conta de campo (passo 10.2): mantida por enquanto (loja "Pet Shop Amigo Fiel"), decisão de 2026-10-06.
