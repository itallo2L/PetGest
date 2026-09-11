# PetGest

> Mais tempo para o que importa

Protótipo navegável de um SaaS de **gestão de estoque para pequenos pet shops e
comércios agropecuários**.

É uma maquete funcional de interface: tudo é clicável e os números reagem às
ações, mas não há servidor nem banco de dados por trás. O objetivo é permitir
demonstrar o sistema a clientes potenciais e validar fluxo e experiência antes
de escrever o produto de verdade.

---

## O problema

Pequenos estabelecimentos costumam controlar estoque em papel ou planilha, e
disso vêm as dores que o PetGest endereça:

- não saber quanto existe em estoque;
- produtos que acabam sem ninguém perceber;
- dificuldade para decidir quando comprar de novo;
- falta de visibilidade sobre o que está abaixo do estoque mínimo;
- entradas e saídas sem registro confiável.

A interface foi pensada para transmitir simplicidade e organização — a sensação
alvo é *"isso parece simples, eu consigo aprender a usar"*.

## Como executar

Abra o **`index.html`** no navegador. Só isso.

Não há instalação, dependências, build nem servidor. O único recurso externo é
a fonte Inter, carregada do Google Fonts; sem internet o sistema cai para a
fonte padrão e continua funcionando normalmente.

## Telas

| Tela | O que faz |
|---|---|
| **Dashboard** | Indicadores do estoque, produtos que precisam de atenção, movimentações recentes e atalhos de entrada/saída. |
| **Produtos** | Catálogo com busca por nome ou código (ignora acento), filtros por status, categoria e fornecedor, cadastro e edição. |
| **Estoque** | Visão operacional com extrato de movimentações, saldo do produto após cada lançamento e filtros por tipo e período. |
| **Reposição** | Produtos abaixo do mínimo, sugestão de compra calculada e geração de pedidos — um por fornecedor. |
| **Fornecedores** | Parceiros de compra, seus produtos, pedidos em aberto e **recebimento de pedido**, que dá entrada automática no estoque. |
| **Relatórios** | Indicadores do período e gráficos (colunas, rosca e barras) feitos em HTML/CSS/SVG puros, sem biblioteca. |
| **Configurações** | Dados da loja, estoque mínimo padrão, multiplicador da sugestão de compra, alertas e cor principal do sistema. |

### Fluxo de demonstração

Um roteiro curto que exercita o sistema inteiro:

1. No **Dashboard**, veja que a Ração Golden está com 4 unidades para um mínimo de 10;
2. abra o produto e **registre uma entrada de 20** — o estoque vai a 24 e o status muda para Normal;
3. volte ao Dashboard: os indicadores já refletem a mudança;
4. em **Reposição**, o produto não aparece mais entre os que precisam de compra;
5. selecione os itens restantes e **crie um pedido**;
6. em **Fornecedores**, abra o fornecedor e **receba o pedido** — as quantidades entram no estoque;
7. em **Relatórios**, as movimentações do período acompanham tudo isso.

## Dados

Os dados são fictícios e vivem em memória: **34 produtos** em 7 categorias
(ração, medicamento, higiene, acessórios, petiscos, jardinagem e agropecuário),
5 fornecedores, cerca de 80 movimentações espalhadas pelos últimos 50 dias e
pedidos de compra em aberto.

Tudo o que você fizer altera esse estado durante a sessão. **Recarregar a página
devolve o sistema ao ponto inicial** — útil para repetir uma demonstração. Há
também um botão "Restaurar dados iniciais" em Configurações.

## Estrutura

```
PetGest/
├── index.html   marcação das 7 telas, dos modais e o sprite de ícones SVG
├── style.css    design system e estilos
└── script.js    dados fictícios, estado, regras de estoque e renderização
```

Apenas **HTML5, CSS3 e JavaScript vanilla** — sem framework, sem build, sem
backend.

### Identidade visual

Todas as cores, espaçamentos, raios, sombras e tipografia estão centralizados em
variáveis CSS no bloco `:root` do `style.css`. Trocar a identidade visual é
alterar esse bloco — e a tela de Configurações demonstra isso na prática, com um
seletor que troca a cor principal do sistema inteiro em tempo real.

As cores de status (verde, âmbar e vermelho) têm significado funcional e não
mudam com o tema:

- **Normal** — estoque maior ou igual ao mínimo
- **Baixo** — estoque acima de zero e abaixo do mínimo
- **Em falta** — estoque zerado

### Responsividade

O sistema foi adaptado para uso em celular, não apenas reduzido. As listas são
tabelas no desktop e **viram cards verticais quando não há largura para a
tabela** — a decisão é tomada por *container query*, com base no espaço real
disponível para cada lista, e não pela largura da janela. Isso garante que
nenhum tamanho de tela exija arrastar a interface para os lados.

Os limiares de cada lista estão documentados em comentário no `style.css`, junto
com a largura mínima medida de cada tabela.

## O que não está incluído

Por ser um protótipo de interface e fluxo, ficaram de fora de propósito:

- backend, banco de dados e API;
- autenticação e login real;
- persistência de dados entre sessões;
- emissão de NF-e e integrações fiscais;
- integração com sistemas de fornecedores.
