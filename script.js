/* ==========================================================================
   PetGest — Protótipo navegável
   --------------------------------------------------------------------------
   Organização do arquivo:
     1. Utilitários
     2. Dados (mock em memória)
     3. Estado da aplicação
     4. Regras de negócio (status, métricas, estoque)
     5. Navegação entre telas
     6. Renderização — Dashboard
     7. Renderização — Detalhes do produto
     8. Movimentações (entrada / saída)
     9. Edição de produto e estoque mínimo
    10. Modais
    11. Notificações (toasts)
    12. Eventos e inicialização
   ========================================================================== */

(function () {
  "use strict";

  /* ========================================================================
     1. UTILITÁRIOS
     ======================================================================== */

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  };

  var currencyFormatter = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  });

  function formatCurrency(value) {
    return currencyFormatter.format(Number(value) || 0);
  }

  function pad(n) { return String(n).padStart(2, "0"); }

  /** 10/09 */
  function formatDateShort(date) {
    return pad(date.getDate()) + "/" + pad(date.getMonth() + 1);
  }

  /** 10/09/2026 */
  function formatDateFull(date) {
    return formatDateShort(date) + "/" + date.getFullYear();
  }

  /** 09:35 */
  function formatTime(date) {
    return pad(date.getHours()) + ":" + pad(date.getMinutes());
  }

  function daysAgo(n, hour, minute) {
    var d = new Date();
    d.setHours(hour === undefined ? 9 : hour, minute || 0, 0, 0);
    d.setDate(d.getDate() - n);
    return d;
  }

  /**
   * Data de exemplo que nunca cai no futuro.
   * Se o protótipo for aberto de manhã cedo, os horários comerciais de "hoje"
   * ainda não aconteceram; recuamos alguns minutos preservando a ordem dos
   * lançamentos, para que uma movimentação nova sempre apareça no topo.
   */
  function seedMoment(n, hour, minute) {
    var moment = daysAgo(n, hour, minute);
    var now = new Date();

    if (moment > now) {
      moment = new Date(now.getTime() - (24 - hour) * 60000);
    }
    return moment;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function icon(name, modifier) {
    return (
      '<svg class="icon' + (modifier ? " " + modifier : "") +
      '" aria-hidden="true"><use href="#' + name + '"></use></svg>'
    );
  }

  function plural(count, singular, pluralWord) {
    return count === 1 ? singular : pluralWord;
  }

  /* ========================================================================
     2. DADOS (mock em memória — recarregar a página restaura o estado)
     ======================================================================== */

  /* Preferências da loja — alteradas na tela de Configurações. */
  var settings = {
    storeName: "Pet Shop Amigo Fiel",
    ownerName: "Carlos",
    phone: "(63) 99845-1200",
    city: "Palmas — TO",
    plan: "Plano Essencial",
    defaultMin: 5,
    suggestionFactor: 2,
    alertOut: true,
    alertLow: true,
    dailyDigest: false,
    accent: "teal"
  };

  /* Paletas prontas: cada uma sobrescreve as variáveis de marca no :root. */
  var ACCENTS = [
    { id: "teal", label: "Verde-água", primary: "#108B91", hover: "#0C6F74", active: "#0A5B5F", soft: "#E4F2F3", softStrong: "#C9E5E7" },
    { id: "green", label: "Verde", primary: "#2E7D32", hover: "#276A2A", active: "#1F5622", soft: "#E9F3EA", softStrong: "#CFE5D1" },
    { id: "blue", label: "Azul", primary: "#2563EB", hover: "#1D4FC4", active: "#1A45AB", soft: "#E9EFFD", softStrong: "#CFDDFB" },
    { id: "violet", label: "Roxo", primary: "#7C3AED", hover: "#6A2FD0", active: "#5B28B3", soft: "#F2EAFE", softStrong: "#E0D1FC" },
    { id: "clay", label: "Terracota", primary: "#C2571E", hover: "#A4491A", active: "#883C15", soft: "#FAEEE6", softStrong: "#F2DAC8" }
  ];

  var CATEGORIES = [
    "Ração",
    "Medicamento",
    "Higiene",
    "Acessórios",
    "Petiscos",
    "Jardinagem",
    "Agropecuário"
  ];

  var suppliers = [
    {
      id: "s1", name: "Distribuidora Pet Norte", contact: "(63) 99912-4455",
      person: "Marina Alves", email: "comercial@petnorte.com.br",
      city: "Palmas — TO", leadTime: 3, sinceDays: 940, active: true
    },
    {
      id: "s2", name: "Agro Tocantins Distribuidora", contact: "(63) 98871-2030",
      person: "Rubens Prado", email: "vendas@agrotocantins.com.br",
      city: "Porto Nacional — TO", leadTime: 5, sinceDays: 720, active: true
    },
    {
      id: "s3", name: "VetSupply Distribuidora", contact: "(61) 99654-1187",
      person: "Dra. Helena Souza", email: "pedidos@vetsupply.com.br",
      city: "Brasília — DF", leadTime: 7, sinceDays: 520, active: true
    },
    {
      id: "s4", name: "Campo Verde Insumos", contact: "(63) 98123-7744",
      person: "Joaquim Ferreira", email: "campoverde@insumos.com.br",
      city: "Paraíso do Tocantins — TO", leadTime: 4, sinceDays: 365, active: true
    },
    {
      id: "s5", name: "Nutrianimal Palmas", contact: "(63) 99230-8866",
      person: "Tereza Lima", email: "atendimento@nutrianimal.com.br",
      city: "Palmas — TO", leadTime: 2, sinceDays: 210, active: false
    }
  ];

  /* name, category, unit, stock, min, supplier, cost, price */
  var PRODUCT_SEED = [
    ["RAC-0142", "Ração Golden Adultos Frango 15kg", "Ração", "un", 4, 10, "s1", 89.9, 119.9],
    ["RAC-0118", "Ração Premier Cães Filhotes 10,1kg", "Ração", "un", 18, 8, "s1", 132.4, 179.9],
    ["RAC-0155", "Ração GranPlus Gatos Castrados 10,1kg", "Ração", "un", 5, 8, "s5", 96.5, 134.9],
    ["RAC-0163", "Ração Whiskas Peixe 10,1kg", "Ração", "un", 16, 8, "s5", 78.2, 109.9],
    ["RAC-0171", "Ração Pedigree Adultos 15kg", "Ração", "un", 22, 10, "s1", 74.9, 99.9],
    ["RAC-0188", "Ração Equilíbrio Cães Sênior 15kg", "Ração", "un", 14, 6, "s5", 105.3, 145.0],
    ["RAC-0194", "Ração Golden Gatos Castrados 10,1kg", "Ração", "un", 11, 6, "s1", 112.0, 152.9],
    ["MED-0203", "Vermífugo Drontal Plus 10kg", "Medicamento", "cx", 0, 5, "s3", 38.5, 59.9],
    ["MED-0217", "Antipulgas Bravecto 20-40kg", "Medicamento", "cx", 12, 4, "s3", 145.0, 199.9],
    ["MED-0225", "Antipulgas Simparic 10-20kg", "Medicamento", "cx", 2, 6, "s3", 98.7, 139.9],
    ["MED-0231", "Vermífugo Endal Cães 10 comp.", "Medicamento", "cx", 20, 6, "s3", 22.4, 36.9],
    ["MED-0248", "Pomada Cicatrizante Unguento 500g", "Medicamento", "un", 9, 4, "s2", 31.9, 49.9],
    ["HIG-0302", "Shampoo Pet Clean Neutro 500ml", "Higiene", "un", 3, 8, "s1", 14.9, 27.9],
    ["HIG-0311", "Condicionador Pet Clean 500ml", "Higiene", "un", 15, 6, "s1", 16.4, 29.9],
    ["HIG-0324", "Tapete Higiênico Super Seco 30un", "Higiene", "pct", 4, 9, "s1", 42.0, 69.9],
    ["HIG-0330", "Areia Higiênica Pipicat 4kg", "Higiene", "un", 26, 10, "s5", 11.8, 21.9],
    ["HIG-0347", "Talco Desodorante Pet 100g", "Higiene", "un", 0, 6, "s1", 9.4, 18.9],
    ["ACE-0405", "Coleira Nylon Ajustável M", "Acessórios", "un", 7, 12, "s4", 12.5, 29.9],
    ["ACE-0412", "Guia Retrátil 5m", "Acessórios", "un", 10, 4, "s4", 38.0, 74.9],
    ["ACE-0420", "Comedouro Inox 500ml", "Acessórios", "un", 24, 8, "s4", 15.9, 32.9],
    ["ACE-0433", "Cama Pet Retangular M", "Acessórios", "un", 6, 3, "s4", 68.0, 129.9],
    ["ACE-0441", "Caixa de Transporte N2", "Acessórios", "un", 1, 3, "s4", 79.9, 149.9],
    ["PET-0508", "Petisco Dental Fresh M 7un", "Petiscos", "pct", 9, 15, "s1", 17.3, 32.9],
    ["PET-0515", "Bifinho Sabor Carne 500g", "Petiscos", "pct", 8, 14, "s5", 19.9, 34.9],
    ["PET-0522", "Osso Natural Defumado", "Petiscos", "un", 30, 10, "s5", 6.5, 14.9],
    ["PET-0536", "Sachê Whiskas Frango 85g", "Petiscos", "un", 48, 20, "s5", 2.3, 4.9],
    ["AGR-0601", "Ração Galinhas Poedeiras 25kg", "Agropecuário", "sc", 12, 5, "s2", 86.0, 118.0],
    ["AGR-0614", "Sal Mineral Bovinos 30kg", "Agropecuário", "sc", 2, 5, "s2", 92.5, 129.0],
    ["AGR-0627", "Milho Triturado 30kg", "Agropecuário", "sc", 3, 6, "s2", 64.0, 89.9],
    ["AGR-0639", "Vermífugo Bovino Injetável 50ml", "Agropecuário", "un", 8, 3, "s3", 54.7, 84.9],
    ["JAR-0702", "Adubo NPK 10-10-10 1kg", "Jardinagem", "un", 6, 10, "s4", 8.9, 17.9],
    ["JAR-0715", "Semente Grama Esmeralda 1kg", "Jardinagem", "un", 0, 4, "s4", 34.0, 59.9],
    ["JAR-0723", "Terra Vegetal Adubada 20kg", "Jardinagem", "sc", 17, 6, "s4", 12.0, 24.9],
    ["JAR-0736", "Inseticida Jardim Concentrado 1L", "Jardinagem", "un", 9, 4, "s2", 28.5, 52.9]
  ];

  var products = PRODUCT_SEED.map(function (row, index) {
    var createdAt = daysAgo(180 - index * 3);
    return {
      id: "p" + (index + 1),
      sku: row[0],
      name: row[1],
      category: row[2],
      unit: row[3],
      stock: row[4],
      min: row[5],
      supplierId: row[6],
      cost: row[7],
      price: row[8],
      active: true,
      createdAt: createdAt,
      updatedAt: daysAgo(index % 9),
      history: [
        { date: createdAt, text: "Produto cadastrado no sistema por " + settings.ownerName + "." },
        {
          date: daysAgo(150 - index * 2),
          text: "Estoque mínimo definido em " + row[5] + " " + row[3] + "."
        }
      ]
    };
  });

  var productSeq = products.length;
  var movementSeq = 0;

  /* [dias atrás, tipo, motivo, sku, quantidade, observação] */
  var MOVEMENT_SEED = [
    [0, "out", "Venda", "RAC-0142", 2, "Venda no balcão"],
    [0, "out", "Venda", "PET-0536", 6, "Venda no balcão"],
    [0, "in", "Compra", "ACE-0420", 12, "Nota fiscal 3391"],
    [1, "out", "Venda", "RAC-0142", 1, "Venda no balcão"],
    [1, "out", "Venda", "HIG-0330", 3, ""],
    [1, "out", "Perda", "MED-0203", 1, "Lote vencido"],
    [2, "in", "Compra", "RAC-0142", 10, "Nota fiscal 3372"],
    [2, "out", "Venda", "HIG-0302", 2, ""],
    [3, "out", "Venda", "AGR-0614", 2, "Cliente Sítio Boa Vista"],
    [3, "in", "Compra", "RAC-0171", 20, "Nota fiscal 3350"],
    [4, "out", "Venda", "PET-0508", 3, ""],
    [4, "out", "Venda", "ACE-0405", 2, ""],
    [5, "in", "Compra", "MED-0217", 8, "Nota fiscal 3318"],
    [5, "out", "Ajuste", "JAR-0702", 2, "Ajuste de inventário"],
    [6, "out", "Venda", "RAC-0118", 1, ""],
    [7, "in", "Compra", "HIG-0330", 24, "Nota fiscal 3290"],
    // Venda maior que explica o consumo da compra de 10 un da Ração Golden:
    // sem ela, o saldo reconstruído antes daquela entrada ficaria negativo.
    [1, "out", "Venda", "RAC-0142", 6, "Venda para o canil São Francisco"]
  ];

  var movements = MOVEMENT_SEED.map(function (row, index) {
    var product = findProductBySku(row[3]);
    return {
      id: "m" + ++movementSeq,
      // Horários espalhados pelo expediente deixam o extrato mais realista.
      date: seedMoment(row[0], 8 + (index * 3) % 10, (index * 17) % 60),
      type: row[1],
      reason: row[2],
      productId: product ? product.id : null,
      qty: row[4],
      note: row[5],
      user: settings.ownerName
    };
  }).filter(function (m) { return m.productId; });

  /**
   * Histórico mais antigo (8 a 50 dias atrás), gerado de forma determinística
   * para que os relatórios de 30 e 90 dias tenham série temporal.
   *
   * O saldo é reconstruído de trás para frente a partir do estoque atual: uma
   * venda antiga sempre aumenta o saldo anterior (seguro), enquanto uma compra
   * antiga o reduz — por isso só entra quando houver saldo suficiente, para que
   * a coluna "saldo após" nunca exiba número negativo.
   */
  (function seedOlderMovements() {
    var running = {};
    products.forEach(function (p) { running[p.id] = p.stock; });

    movements.slice().sort(sortMovementsDesc).forEach(function (m) {
      running[m.productId] -= (m.type === "in" ? m.qty : -m.qty);
    });

    var pool = products.filter(function (p) { return p.active; });
    var drafts = [];

    for (var day = 8; day <= 50; day++) {
      var perDay = 1 + (day % 2);

      for (var k = 0; k < perDay; k++) {
        var product = pool[(day * 7 + k * 11) % pool.length];
        var isPurchase = (day + k) % 9 === 0;
        var qty = isPurchase ? product.min * 2 : 1 + ((day + k) % 3);

        if (isPurchase) {
          if (running[product.id] < qty) continue;
          running[product.id] -= qty;
        } else {
          running[product.id] += qty;
        }

        drafts.push({
          date: daysAgo(day, 8 + ((day + k) % 10), (day + k * 17) % 60),
          type: isPurchase ? "in" : "out",
          reason: isPurchase ? "Compra" : "Venda",
          productId: product.id,
          qty: qty,
          note: isPurchase ? "Reposição programada" : ""
        });
      }
    }

    drafts
      .sort(function (a, b) { return a.date - b.date; })
      .forEach(function (draft) {
        movements.push({
          id: "m" + ++movementSeq,
          date: draft.date,
          type: draft.type,
          reason: draft.reason,
          productId: draft.productId,
          qty: draft.qty,
          note: draft.note,
          user: settings.ownerName
        });
      });
  })();

  /* Pedidos de compra já abertos — usados pelo indicador "Para reposição".
     Um pedido por fornecedor, como acontece na prática. */
  var orderSeq = 120;

  function buildOrder(id, supplierId, skus, days) {
    return {
      id: id,
      supplierId: supplierId,
      status: "open",
      createdAt: daysAgo(days, 10, 30),
      items: skus.map(function (sku) {
        var p = findProductBySku(sku);
        return p ? { productId: p.id, qty: suggestedPurchase(p) } : null;
      }).filter(Boolean)
    };
  }

  var purchaseOrders = [
    buildOrder("PO-2026-118", "s1", ["PET-0508", "HIG-0324", "HIG-0347"], 2),
    buildOrder("PO-2026-119", "s4", ["ACE-0405", "JAR-0702", "JAR-0715"], 2),
    buildOrder("PO-2026-120", "s5", ["PET-0515"], 1)
  ];

  function findProductBySku(sku) {
    for (var i = 0; i < products.length; i++) {
      if (products[i].sku === sku) return products[i];
    }
    return null;
  }

  function findProduct(id) {
    for (var i = 0; i < products.length; i++) {
      if (products[i].id === id) return products[i];
    }
    return null;
  }

  function supplierName(id) {
    for (var i = 0; i < suppliers.length; i++) {
      if (suppliers[i].id === id) return suppliers[i].name;
    }
    return "Não informado";
  }

  /* ========================================================================
     3. ESTADO DA APLICAÇÃO
     ======================================================================== */

  var state = {
    view: "dashboard",
    currentProductId: null,   // produto aberto no modal de detalhes
    currentSupplierId: null,  // fornecedor aberto no modal de detalhes
    currentOrderId: null,     // pedido em recebimento
    productTab: "info",       // aba ativa nos detalhes do produto
    supplierTab: "orders",    // aba ativa nos detalhes do fornecedor
    returnToProduct: false,   // reabrir detalhes ao fechar entrada/saída
    returnToSupplier: false,  // reabrir fornecedor ao fechar o recebimento
    productFormMode: "edit",  // "edit" ou "create" no formulário de produto
    openModalId: null,
    lastFocused: null,
    // Filtros da tela de Produtos
    filters: {
      search: "",
      status: "all",
      category: "all",
      supplier: "all",
      sort: "name"
    },
    // Filtros da tela de Estoque
    stockFilters: {
      period: "30",
      type: "all"
    },
    // Tela de Relatórios
    reportPeriod: "30",
    // Tela de Reposição
    replenishment: {
      scope: "pending",   // "pending" | "ordered" | "all"
      selected: {}        // productId -> true
    }
  };

  var FILTER_DEFAULTS = { category: "all", supplier: "all", sort: "name" };

  var VIEWS = {
    dashboard: { title: "Dashboard", subtitle: "Visão geral do seu estoque" },
    produtos: { title: "Produtos", subtitle: "Gerencie os produtos cadastrados" },
    estoque: { title: "Estoque", subtitle: "Acompanhe entradas, saídas e saldos" },
    reposicao: { title: "Reposição", subtitle: "Veja quais produtos precisam ser comprados" },
    fornecedores: { title: "Fornecedores", subtitle: "Seus parceiros de compra" },
    relatorios: { title: "Relatórios", subtitle: "Números do seu estoque no período" },
    configuracoes: { title: "Configurações", subtitle: "Preferências da sua loja" }
  };

  /* Telas já implementadas; as demais caem no estado "em construção". */
  var VIEW_ELEMENTS = {
    dashboard: "view-dashboard",
    produtos: "view-produtos",
    estoque: "view-estoque",
    reposicao: "view-reposicao",
    fornecedores: "view-fornecedores",
    relatorios: "view-relatorios",
    configuracoes: "view-configuracoes"
  };

  /* ========================================================================
     4. REGRAS DE NEGÓCIO
     ======================================================================== */

  var STATUS = {
    ok: { key: "ok", label: "Normal", className: "badge--ok", fill: "gauge__fill--ok" },
    low: { key: "low", label: "Baixo", className: "badge--low", fill: "gauge__fill--low" },
    out: { key: "out", label: "Em falta", className: "badge--out", fill: "gauge__fill--out" }
  };

  /** NORMAL: estoque >= mínimo | BAIXO: 0 < estoque < mínimo | EM FALTA: estoque = 0 */
  function getProductStatus(product) {
    if (product.stock <= 0) return STATUS.out;
    if (product.stock < product.min) return STATUS.low;
    return STATUS.ok;
  }

  function isBelowMinimum(product) {
    return getProductStatus(product).key !== "ok";
  }

  /** Pedido de compra aberto que já contempla o produto, se existir. */
  function findOpenOrder(productId) {
    for (var i = 0; i < purchaseOrders.length; i++) {
      var order = purchaseOrders[i];
      if (order.status !== "open") continue;
      for (var j = 0; j < order.items.length; j++) {
        if (order.items[j].productId === productId) return order;
      }
    }
    return null;
  }

  function hasOpenOrder(productId) {
    return findOpenOrder(productId) !== null;
  }

  /** Produtos abaixo do mínimo que ainda não estão em um pedido de compra aberto. */
  function productsToReplenish() {
    return products.filter(function (p) {
      return p.active && isBelowMinimum(p) && !hasOpenOrder(p.id);
    });
  }

  function calculateDashboardMetrics() {
    var active = products.filter(function (p) { return p.active; });
    var low = active.filter(function (p) { return getProductStatus(p).key === "low"; });
    var out = active.filter(function (p) { return getProductStatus(p).key === "out"; });
    var categories = active.reduce(function (acc, p) {
      if (acc.indexOf(p.category) === -1) acc.push(p.category);
      return acc;
    }, []);
    var stockValue = active.reduce(function (sum, p) { return sum + p.stock * p.cost; }, 0);

    return {
      total: active.length,
      low: low.length,
      out: out.length,
      replenish: productsToReplenish().length,
      categories: categories.length,
      stockValue: stockValue
    };
  }

  /**
   * Sugestão de compra: recompor o estoque até o múltiplo do mínimo definido
   * em Configurações, nunca sugerindo menos que o próprio mínimo.
   */
  function suggestedPurchase(product) {
    var target = Math.ceil(product.min * settings.suggestionFactor);
    return Math.max(target - product.stock, product.min);
  }

  function movementsOf(productId) {
    return movements
      .filter(function (m) { return m.productId === productId; })
      .sort(sortMovementsDesc);
  }

  function sortMovementsDesc(a, b) {
    var diff = b.date - a.date;
    if (diff !== 0) return diff;
    return Number(b.id.slice(1)) - Number(a.id.slice(1));
  }

  function addMovement(data) {
    var movement = {
      id: "m" + ++movementSeq,
      date: new Date(),
      type: data.type,
      reason: data.reason,
      productId: data.productId,
      qty: data.qty,
      note: data.note || "",
      user: settings.ownerName
    };
    movements.push(movement);
    return movement;
  }

  /* ========================================================================
     5. NAVEGAÇÃO
     ======================================================================== */

  function navigateTo(viewKey) {
    var meta = VIEWS[viewKey];
    if (!meta) return;

    state.view = viewKey;

    $$(".nav__item").forEach(function (item) {
      item.classList.toggle("is-active", item.getAttribute("data-view") === viewKey);
    });

    $("#pageTitle").textContent = meta.title;
    $("#pageSubtitle").textContent = meta.subtitle;

    var targetId = VIEW_ELEMENTS[viewKey] || "view-placeholder";
    $$(".view").forEach(function (view) {
      view.classList.toggle("is-active", view.id === targetId);
    });

    if (targetId === "view-placeholder") {
      $("#placeholderTitle").textContent = meta.title + " — em construção";
      $("#placeholderText").textContent =
        "A tela de " + meta.title + " já está no mapa do PetGest, mas ainda não " +
        "entrou nesta versão do protótipo. Volte ao Dashboard para " +
        "seguir com a demonstração.";
    }

    if (viewKey === "dashboard") renderDashboard();
    if (viewKey === "produtos") renderProducts();
    if (viewKey === "estoque") renderStock();
    if (viewKey === "reposicao") renderReplenishment();
    if (viewKey === "fornecedores") renderSuppliers();
    if (viewKey === "relatorios") renderReports();
    if (viewKey === "configuracoes") renderSettings();

    closeSidebar();
    $("#content").scrollTop = 0;
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  /* ========================================================================
     6. RENDERIZAÇÃO — DASHBOARD
     ======================================================================== */

  function renderDashboard() {
    renderKpis();
    renderAttentionTable();
    renderRecentMovements();
    renderNavBadge();
  }

  function renderKpis() {
    var m = calculateDashboardMetrics();

    var cards = [
      {
        icon: "i-box",
        modifier: "",
        label: "Produtos cadastrados",
        value: m.total,
        hint: m.categories + " " + plural(m.categories, "categoria ativa", "categorias ativas")
      },
      {
        icon: "i-alert",
        modifier: "kpi--warning",
        label: "Estoque baixo",
        value: m.low,
        hint: "Abaixo do estoque mínimo"
      },
      {
        icon: "i-ban",
        modifier: "kpi--danger",
        label: "Em falta",
        value: m.out,
        hint: "Sem unidades disponíveis"
      },
      {
        icon: "i-cart",
        modifier: "kpi--info",
        label: "Para reposição",
        value: m.replenish,
        hint: m.replenish === 0 ? "Tudo com pedido em andamento" : "Ainda sem pedido de compra"
      }
    ];

    $("#kpiGrid").innerHTML = cards.map(renderKpiCard).join("");
  }

  /**
   * Card de indicador, compartilhado pelo Dashboard, Estoque e Relatórios.
   * A marcação é plana de propósito: o CSS reposiciona as partes com grid,
   * mostrando "ícone + rótulo / número" no desktop e "número + ícone / rótulo"
   * no celular, onde o número precisa vir primeiro na hierarquia.
   */
  function renderKpiCard(card) {
    // Valores longos (moeda) ganham a linha inteira nos breakpoints de celular.
    var wide = String(card.value).length > 6 ? " kpi--wide" : "";

    return (
      '<article class="kpi ' + card.modifier + wide + '">' +
        '<span class="kpi__icon">' + icon(card.icon) + "</span>" +
        '<strong class="kpi__value">' + card.value + "</strong>" +
        '<span class="kpi__label">' + card.label + "</span>" +
        '<p class="kpi__hint">' + card.hint + "</p>" +
      "</article>"
    );
  }

  function renderAttentionTable() {
    // Mesma ordem de urgência usada na tela de Reposição.
    var rows = belowMinimumList().slice(0, 6);

    var body = $("#attentionBody");
    var cards = $("#attentionCards");

    if (!rows.length) {
      var vazio =
        "<strong>Tudo em ordem por aqui.</strong><br />" +
        "Nenhum produto está abaixo do estoque mínimo.";
      body.innerHTML = '<tr><td colspan="6"><div class="table-empty">' + vazio + "</div></td></tr>";
      cards.innerHTML = '<li class="table-empty">' + vazio + "</li>";
      return;
    }

    cards.innerHTML = rows.map(recordCard).join("");

    body.innerHTML = rows.map(function (p) {
      var status = getProductStatus(p);
      return (
        '<tr data-product-id="' + p.id + '" tabindex="0">' +
          '<td class="col-product">' +
            '<div class="cell-product">' +
              '<span class="cell-product__icon">' + icon("i-box") + "</span>" +
              "<span>" +
                '<span class="cell-product__name">' + escapeHtml(p.name) + "</span><br />" +
                '<span class="cell-product__sku">' + p.sku + "</span>" +
              "</span>" +
            "</div>" +
          "</td>" +
          '<td><span class="cell-category">' + p.category + "</span></td>" +
          '<td class="num"><span class="cell-strong ' +
            (status.key === "out" ? "text-danger" : "text-warning") + '">' + p.stock + "</span></td>" +
          '<td class="num"><span class="cell-muted">' + p.min + "</span></td>" +
          '<td><span class="badge ' + status.className + '">' + status.label + "</span></td>" +
          '<td class="right">' +
            '<button type="button" class="btn btn--link" data-product-id="' + p.id + '">Ver produto</button>' +
          "</td>" +
        "</tr>"
      );
    }).join("");
  }

  /**
   * Versão em card de uma linha de produto, usada nos breakpoints de celular
   * no lugar da rolagem horizontal da tabela.
   *
   * options.term         destaca o trecho buscado no nome e no código
   * options.quickActions acrescenta os atalhos de entrada e saída
   */
  function recordCard(p, options) {
    var opts = options || {};
    var term = opts.term || "";
    var comAcao = opts.action !== false;
    var status = getProductStatus(p);
    var stockClass = status.key === "out"
      ? "text-danger"
      : (status.key === "low" ? "text-warning" : "");

    var quick = opts.quickActions
      ? '<button type="button" class="record__quick record__quick--in" ' +
          'data-action="row-entry" data-product-id="' + p.id + '" ' +
          'aria-label="Registrar entrada de ' + escapeHtml(p.name) + '">' +
          icon("i-plus", "icon--sm") + "</button>" +
        '<button type="button" class="record__quick record__quick--out" ' +
          'data-action="row-exit" data-product-id="' + p.id + '" ' +
          'aria-label="Registrar saída de ' + escapeHtml(p.name) + '"' +
          (p.stock === 0 ? " disabled" : "") + ">" +
          icon("i-minus", "icon--sm") + "</button>"
      : "";

    return (
      '<li class="record" data-product-id="' + p.id + '">' +
        '<div class="record__head">' +
          '<span class="record__icon">' + icon("i-box") + "</span>" +
          '<span class="record__ident">' +
            '<span class="record__title">' + highlight(p.name, term) + "</span>" +
            '<span class="record__meta">' + highlight(p.sku, term) + " · " + p.category +
              (p.active ? "" : " · inativo") + "</span>" +
          "</span>" +
          '<span class="badge ' + status.className + '">' + status.label + "</span>" +
        "</div>" +

        '<dl class="record__stats">' +
          "<div>" +
            "<dt>Estoque</dt>" +
            '<dd class="' + stockClass + '">' + p.stock +
              ' <span class="record__unit">' + p.unit + "</span></dd>" +
          "</div>" +
          "<div>" +
            "<dt>Mínimo</dt>" +
            "<dd>" + p.min + ' <span class="record__unit">' + p.unit + "</span></dd>" +
          "</div>" +
        "</dl>" +

        (comAcao
          ? '<div class="record__actions">' +
            '<button type="button" class="btn btn--outline record__action" ' +
              'data-action="view-product" data-product-id="' + p.id + '">' +
              "Ver produto" + icon("i-arrow-right", "icon--sm") +
            "</button>" + quick +
            "</div>"
          : "") +
      "</li>"
    );
  }

  /**
   * Versão em card de uma movimentação, para quando não há largura para as
   * seis colunas do extrato. Mantém data, produto, tipo, observação,
   * quantidade e saldo — nada é omitido.
   */
  function movementCard(m, balance) {
    var product = findProduct(m.productId);
    var isIn = m.type === "in";
    var unit = product ? product.unit : "";

    return (
      '<li class="record record--tappable" data-product-id="' + m.productId + '">' +
        '<div class="record__head">' +
          '<span class="record__icon record__icon--' + (isIn ? "in" : "out") + '">' +
            icon(isIn ? "i-arrow-down" : "i-arrow-up") +
          "</span>" +
          '<span class="record__ident">' +
            '<span class="record__title">' +
              escapeHtml(product ? product.name : "Produto removido") + "</span>" +
            '<span class="record__meta">' + (product ? product.sku : "—") + " · " +
              formatDateFull(m.date) + " " + formatTime(m.date) + "</span>" +
          "</span>" +
          '<span class="record__chevron">' + icon("i-arrow-right", "icon--sm") + "</span>" +
        "</div>" +

        '<dl class="record__stats">' +
          "<div>" +
            "<dt>Quantidade</dt>" +
            '<dd class="' + (isIn ? "text-success" : "text-danger") + '">' +
              (isIn ? "+" : "−") + m.qty +
              ' <span class="record__unit">' + unit + "</span></dd>" +
          "</div>" +
          "<div>" +
            "<dt>Saldo após</dt>" +
            "<dd>" + (balance === undefined ? "—" : balance) +
              ' <span class="record__unit">' + unit + "</span></dd>" +
          "</div>" +
        "</dl>" +

        '<div class="record__foot">' +
          '<span class="badge ' + (isIn ? "badge--ok" : "badge--out") + '">' +
            escapeHtml(m.reason) + "</span>" +
          '<span class="record__note">' +
            (m.note ? escapeHtml(m.note) + " · " : "") + escapeHtml(m.user) +
          "</span>" +
        "</div>" +
      "</li>"
    );
  }

  function renderRecentMovements() {
    var list = movements.slice().sort(sortMovementsDesc).slice(0, 7);
    var target = $("#movementsList");

    if (!list.length) {
      target.innerHTML =
        '<li class="table-empty">Nenhuma movimentação registrada ainda.</li>';
      return;
    }

    target.innerHTML = list.map(function (m) {
      var product = findProduct(m.productId);
      var isIn = m.type === "in";
      return (
        '<li class="timeline__item">' +
          '<span class="timeline__icon timeline__icon--' + (isIn ? "in" : "out") + '">' +
            icon(isIn ? "i-arrow-down" : "i-arrow-up") +
          "</span>" +
          '<span class="timeline__body">' +
            '<span class="timeline__title">' + escapeHtml(product ? product.name : "Produto removido") + "</span>" +
            '<span class="timeline__meta">' + formatDateShort(m.date) + " · " + escapeHtml(m.reason) + "</span>" +
          "</span>" +
          '<span class="timeline__qty timeline__qty--' + (isIn ? "in" : "out") + '">' +
            (isIn ? "+" : "−") + m.qty +
          "</span>" +
        "</li>"
      );
    }).join("");
  }

  function renderNavBadge() {
    var badge = $("#navBadgeReposicao");
    var count = productsToReplenish().length;
    badge.textContent = count;
    badge.hidden = count === 0;
  }

  /* ========================================================================
     6b. RENDERIZAÇÃO — PRODUTOS
     ======================================================================== */

  /** Minúsculas e sem acento — "ração" e "racao" encontram o mesmo produto. */
  function normalize(value) {
    return String(value)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
  }

  /** Destaca o trecho que casa com a busca, escapando cada pedaço. */
  function highlight(text, term) {
    var needle = normalize(String(term).trim());
    if (!needle) return escapeHtml(text);

    var from = normalize(text).indexOf(needle);
    if (from === -1) return escapeHtml(text);

    // A normalização acima preserva o comprimento, então os índices
    // continuam válidos no texto original.
    return escapeHtml(text.slice(0, from)) +
      "<mark>" + escapeHtml(text.slice(from, from + needle.length)) + "</mark>" +
      escapeHtml(text.slice(from + needle.length));
  }

  /** Aplica busca, status, categoria, fornecedor e ordenação. */
  function filterProducts() {
    var f = state.filters;
    var term = normalize(f.search.trim());

    var list = products.filter(function (p) {
      if (f.status !== "all" && getProductStatus(p).key !== f.status) return false;
      if (f.category !== "all" && p.category !== f.category) return false;
      if (f.supplier !== "all" && p.supplierId !== f.supplier) return false;
      if (term && normalize(p.name).indexOf(term) === -1 &&
          normalize(p.sku).indexOf(term) === -1) return false;
      return true;
    });

    var sorters = {
      name: function (a, b) { return a.name.localeCompare(b.name, "pt-BR"); },
      "stock-asc": function (a, b) { return a.stock - b.stock; },
      "stock-desc": function (a, b) { return b.stock - a.stock; },
      category: function (a, b) {
        return a.category.localeCompare(b.category, "pt-BR") ||
          a.name.localeCompare(b.name, "pt-BR");
      }
    };

    return list.sort(sorters[f.sort] || sorters.name);
  }

  function renderProducts() {
    renderStatusChips();
    renderProductsTable();
    renderFilterState();
  }

  function renderStatusChips() {
    var counts = { all: products.length, ok: 0, low: 0, out: 0 };
    products.forEach(function (p) { counts[getProductStatus(p).key]++; });

    $("#countAll").textContent = counts.all;
    $("#countOk").textContent = counts.ok;
    $("#countLow").textContent = counts.low;
    $("#countOut").textContent = counts.out;

    $$(".chip").forEach(function (chip) {
      chip.classList.toggle("is-active", chip.getAttribute("data-status") === state.filters.status);
    });
  }

  function renderProductsTable() {
    var list = filterProducts();
    var term = state.filters.search.trim();
    var body = $("#productsBody");
    var cards = $("#productsCards");

    if (!list.length) {
      var vazio =
        "<strong>Nenhum produto encontrado.</strong><br />" +
        (term
          ? "Nada corresponde a “" + escapeHtml(term) + "” com os filtros atuais."
          : "Tente ajustar os filtros aplicados.") +
        '<br /><button type="button" class="btn btn--link" data-action="clear-filters">' +
        "Limpar busca e filtros</button>";

      body.innerHTML = '<tr><td colspan="6"><div class="table-empty">' + vazio + "</div></td></tr>";
      cards.innerHTML = '<li class="table-empty">' + vazio + "</li>";
    } else {
      cards.innerHTML = list.map(function (p) {
        return recordCard(p, { term: term, quickActions: true });
      }).join("");

      body.innerHTML = list.map(function (p) {
        var status = getProductStatus(p);
        var stockClass = status.key === "out"
          ? "text-danger"
          : (status.key === "low" ? "text-warning" : "");

        return (
          '<tr data-product-id="' + p.id + '" tabindex="0">' +
            '<td class="col-product">' +
              '<div class="cell-product">' +
                '<span class="cell-product__icon">' + icon("i-box") + "</span>" +
                "<span>" +
                  '<span class="cell-product__name">' + highlight(p.name, term) + "</span><br />" +
                  '<span class="cell-product__sku">' + highlight(p.sku, term) +
                    (p.active ? "" : " · inativo") + "</span>" +
                "</span>" +
              "</div>" +
            "</td>" +
            '<td><span class="cell-category">' + p.category + "</span></td>" +
            '<td class="num"><span class="cell-strong ' + stockClass + '">' + p.stock +
              '</span> <span class="cell-muted">' + p.unit + "</span></td>" +
            '<td class="num"><span class="cell-muted">' + p.min + "</span></td>" +
            '<td><span class="badge ' + status.className + '">' + status.label + "</span></td>" +
            '<td class="right">' +
              '<span class="row-actions">' +
                '<button type="button" class="row-btn row-btn--in" data-action="row-entry" ' +
                  'data-product-id="' + p.id + '" title="Registrar entrada" ' +
                  'aria-label="Registrar entrada de ' + escapeHtml(p.name) + '">' +
                  icon("i-plus", "icon--sm") + "</button>" +
                '<button type="button" class="row-btn row-btn--out" data-action="row-exit" ' +
                  'data-product-id="' + p.id + '" title="Registrar saída" ' +
                  'aria-label="Registrar saída de ' + escapeHtml(p.name) + '"' +
                  (p.stock === 0 ? " disabled" : "") + ">" +
                  icon("i-minus", "icon--sm") + "</button>" +
                '<button type="button" class="btn btn--link" data-product-id="' + p.id + '">' +
                  "Ver produto</button>" +
              "</span>" +
            "</td>" +
          "</tr>"
        );
      }).join("");
    }

    $("#productsSummary").innerHTML = list.length
      ? "Mostrando <strong>" + list.length + "</strong> de <strong>" + products.length +
        "</strong> " + plural(products.length, "produto cadastrado", "produtos cadastrados") + "."
      : "Nenhum resultado para os filtros atuais.";
  }

  /** Mantém busca, selects e contador do botão "Filtro" em sincronia com o estado. */
  function renderFilterState() {
    var f = state.filters;

    if ($("#productSearch").value !== f.search) $("#productSearch").value = f.search;
    $("#productSearchClear").hidden = !f.search;
    $("#filterCategory").value = f.category;
    $("#filterSupplier").value = f.supplier;
    $("#filterSort").value = f.sort;

    var active = Object.keys(FILTER_DEFAULTS).filter(function (key) {
      return f[key] !== FILTER_DEFAULTS[key];
    }).length;

    var badge = $("#filterCount");
    badge.textContent = active;
    badge.hidden = active === 0;
  }

  function setFilter(key, value) {
    state.filters[key] = value;
    renderProducts();
  }

  function clearFilters() {
    state.filters.search = "";
    state.filters.status = "all";
    state.filters.category = FILTER_DEFAULTS.category;
    state.filters.supplier = FILTER_DEFAULTS.supplier;
    state.filters.sort = FILTER_DEFAULTS.sort;
    renderProducts();
    $("#productSearch").focus();
  }

  function populateFilterSelects() {
    $("#filterCategory").innerHTML =
      '<option value="all">Todas as categorias</option>' +
      CATEGORIES.map(function (c) {
        return '<option value="' + c + '">' + c + "</option>";
      }).join("");

    $("#filterSupplier").innerHTML =
      '<option value="all">Todos os fornecedores</option>' +
      suppliers.map(function (s) {
        return '<option value="' + s.id + '">' + escapeHtml(s.name) + "</option>";
      }).join("");
  }

  /* ========================================================================
     6c. RENDERIZAÇÃO — ESTOQUE
     ======================================================================== */

  /**
   * Saldo do produto logo após cada movimentação.
   * Reconstruído de trás para frente a partir do estoque atual.
   */
  function calculateBalances() {
    var balances = {};
    var byProduct = {};

    movements.forEach(function (m) {
      (byProduct[m.productId] = byProduct[m.productId] || []).push(m);
    });

    Object.keys(byProduct).forEach(function (productId) {
      var product = findProduct(productId);
      if (!product) return;

      var running = product.stock;
      byProduct[productId].slice().sort(sortMovementsDesc).forEach(function (m) {
        balances[m.id] = running;
        running -= (m.type === "in" ? m.qty : -m.qty);
      });
    });

    return balances;
  }

  /** Movimentações do período selecionado (ignora o filtro de tipo). */
  function movementsInPeriod() {
    var period = state.stockFilters.period;
    if (period === "all") return movements.slice();

    var limit = new Date();
    limit.setHours(0, 0, 0, 0);
    limit.setDate(limit.getDate() - (Number(period) - 1));

    return movements.filter(function (m) { return m.date >= limit; });
  }

  function renderStock() {
    renderStockKpis();
    renderStockMovements();
  }

  function renderStockKpis() {
    var active = products.filter(function (p) { return p.active; });
    var inStock = active.filter(function (p) { return p.stock > 0; }).length;
    var low = active.filter(function (p) { return getProductStatus(p).key === "low"; }).length;
    var out = active.filter(function (p) { return getProductStatus(p).key === "out"; }).length;
    var value = active.reduce(function (sum, p) { return sum + p.stock * p.cost; }, 0);
    var units = active.reduce(function (sum, p) { return sum + p.stock; }, 0);
    var coverage = active.length ? Math.round((inStock / active.length) * 100) : 0;

    $("#stockValue").textContent = formatCurrency(value);

    var cards = [
      {
        icon: "i-box",
        modifier: "",
        label: "Total de produtos",
        value: active.length,
        hint: units + " " + plural(units, "unidade no estoque", "unidades no estoque")
      },
      {
        icon: "i-layers",
        modifier: "kpi--info",
        label: "Produtos em estoque",
        value: inStock,
        hint: coverage + "% do catálogo com saldo"
      },
      {
        icon: "i-alert",
        modifier: "kpi--warning",
        label: "Abaixo do mínimo",
        value: low,
        hint: "Precisam de reposição"
      },
      {
        icon: "i-ban",
        modifier: "kpi--danger",
        label: "Em falta",
        value: out,
        hint: "Sem unidades disponíveis"
      }
    ];

    $("#stockKpis").innerHTML = cards.map(renderKpiCard).join("");
  }

  function renderStockMovements() {
    var period = movementsInPeriod();
    var type = state.stockFilters.type;
    var balances = calculateBalances();

    var counts = {
      all: period.length,
      in: period.filter(function (m) { return m.type === "in"; }).length,
      out: period.filter(function (m) { return m.type === "out"; }).length
    };

    $("#countMovAll").textContent = counts.all;
    $("#countMovIn").textContent = counts.in;
    $("#countMovOut").textContent = counts.out;

    $$("#view-estoque .chip").forEach(function (chip) {
      chip.classList.toggle("is-active", chip.getAttribute("data-type") === type);
    });

    var list = period
      .filter(function (m) { return type === "all" || m.type === type; })
      .sort(sortMovementsDesc);

    var body = $("#stockMovementsBody");
    var cards = $("#stockMovementsCards");

    if (!list.length) {
      var vazio =
        "<strong>Nenhuma movimentação no período.</strong><br />" +
        "Registre uma entrada ou saída, ou amplie o período consultado.";

      body.innerHTML = '<tr><td colspan="6"><div class="table-empty">' + vazio + "</div></td></tr>";
      cards.innerHTML = '<li class="table-empty">' + vazio + "</li>";
    } else {
      cards.innerHTML = list.map(function (m) {
        return movementCard(m, balances[m.id]);
      }).join("");

      body.innerHTML = list.map(function (m) {
        var product = findProduct(m.productId);
        var isIn = m.type === "in";
        var balance = balances[m.id];

        return (
          '<tr data-product-id="' + m.productId + '" tabindex="0">' +
            "<td>" +
              '<span class="cell-strong">' + formatDateFull(m.date) + "</span><br />" +
              '<span class="cell-product__sku">' + formatTime(m.date) + " · " +
                escapeHtml(m.user) + "</span>" +
            "</td>" +
            '<td class="col-product">' +
              '<span class="cell-product__name">' +
                escapeHtml(product ? product.name : "Produto removido") + "</span><br />" +
              '<span class="cell-product__sku">' + (product ? product.sku : "—") + "</span>" +
            "</td>" +
            '<td><span class="badge ' + (isIn ? "badge--ok" : "badge--out") + '">' +
              escapeHtml(m.reason) + "</span></td>" +
            "<td>" + (m.note ? escapeHtml(m.note) : '<span class="cell-muted">—</span>') + "</td>" +
            '<td class="num"><span class="cell-strong ' +
              (isIn ? "text-success" : "text-danger") + '">' +
              (isIn ? "+" : "−") + m.qty + "</span></td>" +
            '<td class="num"><span class="cell-muted">' +
              (balance === undefined ? "—" : balance + " " + (product ? product.unit : "")) +
              "</span></td>" +
          "</tr>"
        );
      }).join("");
    }

    var totalIn = list.reduce(function (sum, m) {
      return sum + (m.type === "in" ? m.qty : 0);
    }, 0);
    var totalOut = list.reduce(function (sum, m) {
      return sum + (m.type === "out" ? m.qty : 0);
    }, 0);

    $("#stockSummary").innerHTML = list.length
      ? "<strong>" + list.length + "</strong> " +
        plural(list.length, "movimentação", "movimentações") + " no período · " +
        '<span class="text-success">+' + totalIn + "</span> " +
        plural(totalIn, "unidade recebida", "unidades recebidas") + " · " +
        '<span class="text-danger">−' + totalOut + "</span> " +
        plural(totalOut, "unidade baixada", "unidades baixadas")
      : "Nenhuma movimentação no período selecionado.";
  }

  /* ========================================================================
     6d. RENDERIZAÇÃO — REPOSIÇÃO
     ======================================================================== */

  /** Todos os produtos abaixo do mínimo, do mais urgente para o menos. */
  function belowMinimumList() {
    return products
      .filter(function (p) { return p.active && isBelowMinimum(p); })
      .sort(function (a, b) {
        var sa = getProductStatus(a).key === "out" ? 0 : 1;
        var sb = getProductStatus(b).key === "out" ? 0 : 1;
        if (sa !== sb) return sa - sb;

        var shortfall = (b.min - b.stock) - (a.min - a.stock);
        if (shortfall !== 0) return shortfall;

        return a.name.localeCompare(b.name, "pt-BR");
      });
  }

  function replenishmentScopeList(scope) {
    return belowMinimumList().filter(function (p) {
      if (scope === "pending") return !hasOpenOrder(p.id);
      if (scope === "ordered") return hasOpenOrder(p.id);
      return true;
    });
  }

  /** Só produtos ainda selecionáveis contam como selecionados. */
  function selectedForOrder() {
    return belowMinimumList().filter(function (p) {
      return state.replenishment.selected[p.id] && !hasOpenOrder(p.id);
    });
  }

  function renderReplenishment() {
    pruneSelection();
    renderReplenishTable();
    renderSelectionBar();
    renderOrders();
  }

  /** Remove da seleção itens que saíram da lista (repostos ou já pedidos). */
  function pruneSelection() {
    var valid = {};
    selectedForOrder().forEach(function (p) { valid[p.id] = true; });
    state.replenishment.selected = valid;
  }

  function renderReplenishTable() {
    var scope = state.replenishment.scope;
    var all = belowMinimumList();
    var pending = all.filter(function (p) { return !hasOpenOrder(p.id); });

    $("#countBelow").textContent = all.length;
    $("#countPending").textContent = pending.length;
    $("#countOrdered").textContent = all.length - pending.length;

    $$("#view-reposicao .chip").forEach(function (chip) {
      chip.classList.toggle("is-active", chip.getAttribute("data-scope") === scope);
    });

    var list = replenishmentScopeList(scope);
    var body = $("#replenishBody");
    var cards = $("#replenishCards");

    if (!list.length) {
      var vazio =
        "<strong>" + (scope === "ordered"
          ? "Nenhum produto aguardando pedido."
          : "Nada para comprar agora.") + "</strong><br />" +
        (scope === "ordered"
          ? "Os produtos abaixo do mínimo ainda não entraram em um pedido."
          : "Todos os produtos estão no ou acima do estoque mínimo.");

      body.innerHTML = '<tr><td colspan="7"><div class="table-empty">' + vazio + "</div></td></tr>";
      cards.innerHTML = '<li class="table-empty">' + vazio + "</li>";
    } else {
      cards.innerHTML = list.map(replenishCard).join("");

      body.innerHTML = list.map(function (p) {
        var status = getProductStatus(p);
        var order = findOpenOrder(p.id);
        var suggestion = suggestedPurchase(p);
        var isSelected = !!state.replenishment.selected[p.id];

        return (
          // A linha inteira alterna a seleção; "Ver produto" abre os detalhes.
          '<tr data-product-id="' + p.id + '" data-action="toggle-select"' +
            (isSelected ? ' class="is-selected"' : "") + ">" +
            '<td class="check">' +
              '<input type="checkbox" class="checkbox" data-action="toggle-select" ' +
                'data-product-id="' + p.id + '"' +
                (isSelected ? " checked" : "") +
                (order ? " disabled" : "") +
                ' aria-label="Selecionar ' + escapeHtml(p.name) + '" />' +
            "</td>" +
            '<td class="col-product">' +
              '<div class="cell-product">' +
                '<span class="cell-product__icon">' + icon("i-box") + "</span>" +
                "<span>" +
                  '<span class="cell-product__name">' + escapeHtml(p.name) + "</span><br />" +
                  '<span class="cell-product__sku">' + p.sku + " · " +
                    '<span class="badge ' + status.className + ' badge--plain">' +
                    status.label + "</span></span>" +
                "</span>" +
              "</div>" +
            "</td>" +
            '<td class="num"><span class="cell-strong ' +
              (status.key === "out" ? "text-danger" : "text-warning") + '">' + p.stock +
              '</span> <span class="cell-muted">' + p.unit + "</span></td>" +
            '<td class="num"><span class="cell-muted">' + p.min + "</span></td>" +
            '<td class="num"><span class="cell-strong">' + suggestion +
              '</span> <span class="cell-muted">' + p.unit + "</span></td>" +
            '<td class="col-supplier">' + escapeHtml(supplierName(p.supplierId)) + "</td>" +
            '<td class="right">' +
              (order
                ? '<span class="badge badge--neutral" title="Já incluído no pedido ' +
                  order.id + '">' + order.id + "</span>"
                : '<button type="button" class="btn btn--link" data-action="view-product" ' +
                  'data-product-id="' + p.id + '">Ver produto</button>') +
            "</td>" +
          "</tr>"
        );
      }).join("");
    }

    var cost = pending.reduce(function (sum, p) {
      return sum + suggestedPurchase(p) * p.cost;
    }, 0);
    $("#replenishCost").textContent = formatCurrency(cost);

    var selectable = list.filter(function (p) { return !hasOpenOrder(p.id); });
    var box = $("#selectAll");
    box.disabled = selectable.length === 0;
    box.checked = selectable.length > 0 &&
      selectable.every(function (p) { return state.replenishment.selected[p.id]; });

    $("#replenishSummary").innerHTML = list.length
      ? "<strong>" + list.length + "</strong> " +
        plural(list.length, "produto listado", "produtos listados") + " · " +
        "<strong>" + pending.length + "</strong> " +
        plural(pending.length, "aguarda pedido", "aguardam pedido")
      : "Nenhum produto nesta lista.";
  }

  /**
   * Card de um produto a repor. Mantém a seleção por checkbox: o card inteiro
   * alterna a marcação, e itens já pedidos abrem o produto em vez disso.
   */
  function replenishCard(p) {
    var status = getProductStatus(p);
    var order = findOpenOrder(p.id);
    var suggestion = suggestedPurchase(p);
    var isSelected = !!state.replenishment.selected[p.id];

    return (
      '<li class="record record--tappable' + (isSelected ? " is-selected" : "") + '" ' +
        'data-action="' + (order ? "view-product" : "toggle-select") + '" ' +
        'data-product-id="' + p.id + '">' +

        '<div class="record__head">' +
          '<input type="checkbox" class="checkbox record__check" data-action="toggle-select" ' +
            'data-product-id="' + p.id + '"' +
            (isSelected ? " checked" : "") + (order ? " disabled" : "") +
            ' aria-label="Selecionar ' + escapeHtml(p.name) + '" />' +
          '<span class="record__ident">' +
            '<span class="record__title">' + escapeHtml(p.name) + "</span>" +
            '<span class="record__meta">' + p.sku + "</span>" +
          "</span>" +
          '<span class="badge ' + status.className + '">' + status.label + "</span>" +
        "</div>" +

        '<dl class="record__stats record__stats--3">' +
          "<div><dt>Estoque</dt>" +
            '<dd class="' + (status.key === "out" ? "text-danger" : "text-warning") + '">' +
            p.stock + ' <span class="record__unit">' + p.unit + "</span></dd></div>" +
          "<div><dt>Mínimo</dt><dd>" + p.min +
            ' <span class="record__unit">' + p.unit + "</span></dd></div>" +
          "<div><dt>Sugestão</dt>" +
            '<dd class="text-primary">' + suggestion +
            ' <span class="record__unit">' + p.unit + "</span></dd></div>" +
        "</dl>" +

        '<div class="record__foot">' +
          '<span class="record__note">' + icon("i-truck", "icon--sm") +
            escapeHtml(supplierName(p.supplierId)) + "</span>" +
        "</div>" +

        (order
          ? '<div class="record__actions"><span class="badge badge--neutral record__action-flat">' +
            "Já no pedido " + order.id + "</span></div>"
          : '<div class="record__actions">' +
            '<button type="button" class="btn btn--outline record__action" ' +
              'data-action="view-product" data-product-id="' + p.id + '">' +
              "Ver produto" + icon("i-arrow-right", "icon--sm") + "</button></div>") +
      "</li>"
    );
  }

  /**
   * Card de um pedido de compra.
   * options.showSupplier = false dentro do modal do fornecedor, onde o nome
   * dele já está no cabeçalho.
   */
  function orderCard(order, options) {
    var opts = options || {};
    var units = orderUnits(order);
    var value = orderValue(order);
    var aberto = order.status === "open";
    var comFornecedor = opts.showSupplier !== false;

    return (
      '<li class="record">' +
        '<div class="record__head">' +
          '<span class="record__icon">' + icon("i-cart") + "</span>" +
          '<span class="record__ident">' +
            '<span class="record__title">' + order.id + "</span>" +
            '<span class="record__meta">' +
              (comFornecedor ? escapeHtml(supplierName(order.supplierId)) + " · " : "") +
              order.items.length + " " + plural(order.items.length, "item", "itens") +
              " · " + formatDateFull(order.createdAt) + "</span>" +
          "</span>" +
          orderStatusBadge(order) +
        "</div>" +

        '<dl class="record__stats">' +
          "<div><dt>Unidades</dt><dd>" + units + "</dd></div>" +
          '<div><dt>Valor estimado</dt><dd class="record__money">' +
            formatCurrency(value) + "</dd></div>" +
        "</dl>" +

        '<div class="record__actions">' +
          (aberto
            ? '<button type="button" class="btn btn--primary record__action" ' +
              'data-action="receive-order" data-order-id="' + order.id + '">' +
              icon("i-arrow-down", "icon--sm") + "Receber pedido</button>"
            : '<span class="record__note record__action-flat">Recebido em ' +
              formatDateFull(order.receivedAt) +
              (order.invoice ? " · NF " + escapeHtml(order.invoice) : "") + "</span>") +
        "</div>" +
      "</li>"
    );
  }

  function renderSelectionBar() {
    var count = selectedForOrder().length;

    $("#btnCreateOrder").disabled = count === 0;
    $("#btnClearSelection").hidden = count === 0;

    var badge = $("#selectionCount");
    badge.textContent = count;
    badge.hidden = count === 0;
  }

  function renderOrders() {
    var body = $("#ordersBody");
    var cards = $("#ordersCards");

    if (!purchaseOrders.length) {
      var vazio = "Nenhum pedido de compra gerado até agora.";
      body.innerHTML = '<tr><td colspan="7"><div class="table-empty">' + vazio + "</div></td></tr>";
      cards.innerHTML = '<li class="table-empty">' + vazio + "</li>";
      return;
    }

    var list = purchaseOrders.slice().sort(function (a, b) {
      if ((a.status === "open") !== (b.status === "open")) return a.status === "open" ? -1 : 1;
      return b.createdAt - a.createdAt;
    });

    cards.innerHTML = list.map(orderCard).join("");

    body.innerHTML = list.map(function (order) {
      return (
        "<tr>" +
          "<td>" +
            '<span class="cell-strong">' + order.id + "</span><br />" +
            '<span class="cell-product__sku">' + formatDateFull(order.createdAt) +
              (order.invoice ? " · NF " + escapeHtml(order.invoice) : "") + "</span>" +
          "</td>" +
          '<td class="col-supplier">' + escapeHtml(supplierName(order.supplierId)) + "</td>" +
          '<td class="num"><span class="cell-muted">' + order.items.length + "</span></td>" +
          '<td class="num"><span class="cell-muted">' + orderUnits(order) + "</span></td>" +
          '<td class="num"><span class="cell-strong">' + formatCurrency(orderValue(order)) + "</span></td>" +
          "<td>" + orderStatusBadge(order) + "</td>" +
          '<td class="right">' + orderAction(order) + "</td>" +
        "</tr>"
      );
    }).join("");
  }

  /* --- Seleção e criação do pedido --- */

  function toggleSelection(productId, checked) {
    if (checked) state.replenishment.selected[productId] = true;
    else delete state.replenishment.selected[productId];
    renderReplenishTable();
    renderSelectionBar();
  }

  function toggleSelectAll(checked) {
    replenishmentScopeList(state.replenishment.scope)
      .filter(function (p) { return !hasOpenOrder(p.id); })
      .forEach(function (p) {
        if (checked) state.replenishment.selected[p.id] = true;
        else delete state.replenishment.selected[p.id];
      });

    renderReplenishTable();
    renderSelectionBar();
  }

  function clearSelection() {
    state.replenishment.selected = {};
    renderReplenishTable();
    renderSelectionBar();
  }

  /** Agrupa os produtos selecionados por fornecedor: um pedido para cada. */
  function groupSelectionBySupplier() {
    var groups = [];

    selectedForOrder().forEach(function (p) {
      var group = groups.filter(function (g) { return g.supplierId === p.supplierId; })[0];
      if (!group) {
        group = { supplierId: p.supplierId, items: [] };
        groups.push(group);
      }
      group.items.push({ product: p, qty: suggestedPurchase(p) });
    });

    return groups;
  }

  function openOrderModal() {
    var groups = groupSelectionBySupplier();
    if (!groups.length) return;

    var totalItems = selectedForOrder().length;

    $("#orderModalMeta").textContent = groups.length === 1
      ? "Revise as quantidades antes de gerar o pedido"
      : totalItems + " produtos de " + groups.length +
        " fornecedores — será gerado um pedido para cada um";

    $("#orderModalBody").innerHTML = groups.map(function (group) {
      return (
        '<div class="order-group">' +
          '<div class="order-group__head">' +
            '<span class="order-group__supplier">' + icon("i-truck", "icon--sm") +
              escapeHtml(supplierName(group.supplierId)) + "</span>" +
            '<span class="order-group__meta">' + group.items.length + " " +
              plural(group.items.length, "item", "itens") + "</span>" +
          "</div>" +
          group.items.map(function (item) {
            var p = item.product;
            return (
              '<div class="order-item">' +
                '<span class="order-item__info">' +
                  '<span class="order-item__name">' + escapeHtml(p.name) + "</span><br />" +
                  '<span class="order-item__meta">' + p.sku + " · estoque " + p.stock +
                    " de " + p.min + " " + p.unit + " · " + formatCurrency(p.cost) +
                    " por " + p.unit + "</span>" +
                "</span>" +
                '<span class="order-item__qty">' +
                  '<input type="number" class="input" min="1" step="1" value="' + item.qty +
                    '" data-order-qty="' + p.id + '" data-cost="' + p.cost +
                    '" aria-label="Quantidade de ' + escapeHtml(p.name) + '" />' +
                  '<span class="order-item__unit">' + p.unit + "</span>" +
                "</span>" +
                '<span class="order-item__cost" data-order-line="' + p.id + '">' +
                  formatCurrency(item.qty * p.cost) + "</span>" +
              "</div>"
            );
          }).join("") +
        "</div>"
      );
    }).join("");

    hideError("#orderError");
    updateOrderTotal();
    openModal("modal-order");
  }

  function updateOrderTotal() {
    var total = 0;
    var units = 0;

    $$("#orderModalBody [data-order-qty]").forEach(function (input) {
      var qty = parseInt(input.value, 10);
      if (isNaN(qty) || qty < 0) qty = 0;

      var lineCost = qty * parseFloat(input.getAttribute("data-cost"));
      total += lineCost;
      units += qty;

      var line = $('[data-order-line="' + input.getAttribute("data-order-qty") + '"]');
      if (line) line.textContent = formatCurrency(lineCost);
    });

    $("#orderTotal").innerHTML =
      units + " " + plural(units, "unidade", "unidades") +
      " · total estimado <strong>" + formatCurrency(total) + "</strong>";
  }

  function confirmOrder() {
    var inputs = $$("#orderModalBody [data-order-qty]");
    var quantities = {};
    var invalid = false;

    inputs.forEach(function (input) {
      var qty = parseInt(input.value, 10);
      if (isNaN(qty) || qty < 1) invalid = true;
      quantities[input.getAttribute("data-order-qty")] = qty;
    });

    if (invalid) {
      showError("#orderError", "Todas as quantidades devem ser de pelo menos 1 unidade.");
      return false;
    }

    var groups = groupSelectionBySupplier();
    if (!groups.length) return false;

    var created = [];
    var now = new Date();

    groups.forEach(function (group) {
      var order = {
        id: "PO-" + now.getFullYear() + "-" + ++orderSeq,
        supplierId: group.supplierId,
        status: "open",
        createdAt: now,
        items: group.items.map(function (item) {
          return { productId: item.product.id, qty: quantities[item.product.id] };
        })
      };

      purchaseOrders.push(order);
      created.push(order);

      order.items.forEach(function (item) {
        var p = findProduct(item.productId);
        if (!p) return;
        p.history.push({
          date: now,
          text: "Incluído no pedido de compra " + order.id + " (" + item.qty + " " +
            p.unit + ") para " + supplierName(order.supplierId) + "."
        });
      });
    });

    clearSelection();
    hideError("#orderError");
    refreshAll();

    showToast({
      type: "success",
      title: "Pedido criado com sucesso",
      text: created.length === 1
        ? created[0].id + " enviado para " + supplierName(created[0].supplierId) + "."
        : created.length + " pedidos criados: " +
          created.map(function (o) { return o.id; }).join(", ") + "."
    });

    return true;
  }

  /* ========================================================================
     6e. RENDERIZAÇÃO — FORNECEDORES
     ======================================================================== */

  function findSupplier(id) {
    for (var i = 0; i < suppliers.length; i++) {
      if (suppliers[i].id === id) return suppliers[i];
    }
    return null;
  }

  function productsOfSupplier(supplierId) {
    return products.filter(function (p) { return p.supplierId === supplierId; });
  }

  function ordersOfSupplier(supplierId, status) {
    return purchaseOrders.filter(function (order) {
      return order.supplierId === supplierId && (!status || order.status === status);
    });
  }

  function orderUnits(order) {
    return order.items.reduce(function (sum, item) { return sum + item.qty; }, 0);
  }

  function orderValue(order) {
    return order.items.reduce(function (sum, item) {
      var p = findProduct(item.productId);
      return sum + (p ? p.cost * item.qty : 0);
    }, 0);
  }

  function renderSuppliers() {
    var openValue = purchaseOrders
      .filter(function (o) { return o.status === "open"; })
      .reduce(function (sum, o) { return sum + orderValue(o); }, 0);

    $("#supplierOpenValue").textContent = formatCurrency(openValue);
    $("#suppliersCards").innerHTML = suppliers.map(supplierCard).join("");

    $("#suppliersBody").innerHTML = suppliers.map(function (s) {
      var owned = productsOfSupplier(s.id);
      var open = ordersOfSupplier(s.id, "open");

      return (
        '<tr data-action="view-supplier" data-supplier-id="' + s.id + '" tabindex="0">' +
          '<td class="col-product">' +
            '<div class="cell-product">' +
              '<span class="cell-product__icon">' + icon("i-truck") + "</span>" +
              "<span>" +
                '<span class="cell-product__name">' + escapeHtml(s.name) + "</span><br />" +
                '<span class="cell-product__sku">' + escapeHtml(s.city) + "</span>" +
              "</span>" +
            "</div>" +
          "</td>" +
          "<td>" +
            '<span class="cell-strong">' + s.contact + "</span><br />" +
            '<span class="cell-product__sku">' + escapeHtml(s.person) + "</span>" +
          "</td>" +
          '<td class="num"><span class="cell-strong">' + owned.length + "</span> " +
            '<span class="cell-muted">' + plural(owned.length, "produto", "produtos") + "</span></td>" +
          '<td class="num">' + (open.length
            ? '<span class="badge badge--low">' + open.length + " " +
              plural(open.length, "pedido", "pedidos") + "</span>"
            : '<span class="cell-muted">—</span>') + "</td>" +
          '<td><span class="badge ' + (s.active ? "badge--ok" : "badge--neutral") + '">' +
            (s.active ? "Ativo" : "Inativo") + "</span></td>" +
          '<td class="right">' +
            '<button type="button" class="btn btn--link" data-action="view-supplier" ' +
              'data-supplier-id="' + s.id + '">Ver detalhes</button>' +
          "</td>" +
        "</tr>"
      );
    }).join("");

    var active = suppliers.filter(function (s) { return s.active; }).length;
    var openOrders = purchaseOrders.filter(function (o) { return o.status === "open"; }).length;

    $("#suppliersSummary").innerHTML =
      "<strong>" + suppliers.length + "</strong> " +
      plural(suppliers.length, "fornecedor cadastrado", "fornecedores cadastrados") + " · " +
      "<strong>" + active + "</strong> " + plural(active, "ativo", "ativos") + " · " +
      "<strong>" + openOrders + "</strong> " +
      plural(openOrders, "pedido em aberto", "pedidos em aberto");
  }

  /** Card de um fornecedor, para quando a tabela não cabe. */
  function supplierCard(s) {
    var owned = productsOfSupplier(s.id);
    var open = ordersOfSupplier(s.id, "open");

    return (
      '<li class="record">' +
        '<div class="record__head">' +
          '<span class="record__icon">' + icon("i-truck") + "</span>" +
          '<span class="record__ident">' +
            '<span class="record__title">' + escapeHtml(s.name) + "</span>" +
            '<span class="record__meta">' + escapeHtml(s.city) + "</span>" +
          "</span>" +
          '<span class="badge ' + (s.active ? "badge--ok" : "badge--neutral") + '">' +
            (s.active ? "Ativo" : "Inativo") + "</span>" +
        "</div>" +

        '<dl class="record__stats">' +
          "<div><dt>Produtos</dt><dd>" + owned.length + "</dd></div>" +
          "<div><dt>Pedidos em aberto</dt>" +
            '<dd class="' + (open.length ? "text-warning" : "") + '">' +
            open.length + "</dd></div>" +
        "</dl>" +

        '<div class="record__foot">' +
          '<span class="record__note">' + icon("i-phone", "icon--sm") +
            s.contact + " · " + escapeHtml(s.person) + "</span>" +
        "</div>" +

        '<div class="record__actions">' +
          '<button type="button" class="btn btn--outline record__action" ' +
            'data-action="view-supplier" data-supplier-id="' + s.id + '">' +
            "Ver detalhes" + icon("i-arrow-right", "icon--sm") +
          "</button>" +
        "</div>" +
      "</li>"
    );
  }

  function openSupplierDetails(supplierId) {
    if (!findSupplier(supplierId)) return;

    state.currentSupplierId = supplierId;
    state.supplierTab = "orders";
    renderSupplierDetails(supplierId);
    openModal("modal-supplier");
  }

  function renderSupplierDetails(supplierId) {
    var s = findSupplier(supplierId);
    if (!s) return;

    var owned = productsOfSupplier(s.id);
    var below = owned.filter(isBelowMinimum).length;
    var value = owned.reduce(function (sum, p) { return sum + p.stock * p.cost; }, 0);
    var open = ordersOfSupplier(s.id, "open");

    $("#supplierModalTitle").textContent = s.name;
    $("#supplierModalMeta").textContent =
      escapeHtml(s.city) + " · fornecedor desde " + formatDateFull(daysAgo(s.sinceDays)) +
      " · entrega em cerca de " + s.leadTime + " dias";

    $("#supplierModalBody").innerHTML =
      '<div class="contact-list">' +
        contactItem("i-user", "Responsável", s.person) +
        contactItem("i-phone", "Telefone", s.contact) +
        contactItem("i-mail", "E-mail", s.email) +
      "</div>" +

      '<div class="stat-grid">' +
        '<div class="stat"><p class="stat__label">Produtos</p>' +
          '<p class="stat__value">' + owned.length + "</p></div>" +
        '<div class="stat' + (below ? " stat--low" : "") + '">' +
          '<p class="stat__label">Abaixo do mínimo</p>' +
          '<p class="stat__value">' + below + "</p></div>" +
        '<div class="stat"><p class="stat__label">Valor em estoque</p>' +
          '<p class="stat__value">' + formatCurrency(value) + "</p></div>" +
        '<div class="stat"><p class="stat__label">Pedidos em aberto</p>' +
          '<p class="stat__value">' + open.length + "</p></div>" +
      "</div>" +

      '<div class="tabs" role="tablist">' +
        supplierTabButton("orders", "Pedidos") +
        supplierTabButton("products", "Produtos") +
      "</div>" +

      '<div class="tab-panel' + (state.supplierTab === "orders" ? " is-active" : "") +
        '" data-panel="orders">' + renderSupplierOrders(s) + "</div>" +
      '<div class="tab-panel' + (state.supplierTab === "products" ? " is-active" : "") +
        '" data-panel="products">' + renderSupplierProducts(owned) + "</div>";
  }

  function contactItem(iconName, label, value) {
    return (
      '<div class="contact-list__item">' + icon(iconName, "icon--sm") +
        "<span>" +
          '<span class="contact-list__label">' + label + "</span><br />" +
          '<span class="contact-list__value">' + escapeHtml(value) + "</span>" +
        "</span>" +
      "</div>"
    );
  }

  function supplierTabButton(key, label) {
    return (
      '<button type="button" class="tab' + (state.supplierTab === key ? " is-active" : "") +
      '" data-tab="' + key + '" role="tab">' + label + "</button>"
    );
  }

  function renderSupplierOrders(supplier) {
    var list = ordersOfSupplier(supplier.id).sort(function (a, b) {
      return b.createdAt - a.createdAt;
    });

    if (!list.length) {
      return '<div class="table-empty">Nenhum pedido de compra para este fornecedor.</div>';
    }

    return (
      '<ul class="record-list record-list--flush">' +
        list.map(function (order) { return orderCard(order, { showSupplier: false }); }).join("") +
      "</ul>" +
      '<div class="table-wrap table-wrap--stacks"><table class="table">' +
        "<thead><tr>" +
          '<th scope="col">Pedido</th>' +
          '<th scope="col" class="num">Itens</th>' +
          '<th scope="col" class="num">Valor</th>' +
          '<th scope="col">Status</th>' +
          '<th scope="col" class="right">Ação</th>' +
        "</tr></thead><tbody>" +
        list.map(function (order) {
          return (
            "<tr>" +
              '<td><span class="cell-strong">' + order.id + "</span><br />" +
                '<span class="cell-product__sku">' + formatDateFull(order.createdAt) + "</span></td>" +
              '<td class="num"><span class="cell-muted">' + order.items.length + "</span></td>" +
              '<td class="num"><span class="cell-strong">' + formatCurrency(orderValue(order)) + "</span></td>" +
              "<td>" + orderStatusBadge(order) + "</td>" +
              '<td class="right">' + orderAction(order) + "</td>" +
            "</tr>"
          );
        }).join("") +
      "</tbody></table></div>"
    );
  }

  function renderSupplierProducts(owned) {
    if (!owned.length) {
      return '<div class="table-empty">Nenhum produto associado a este fornecedor.</div>';
    }

    var sorted = owned.slice().sort(function (a, b) {
      return a.name.localeCompare(b.name, "pt-BR");
    });

    return (
      '<ul class="record-list record-list--flush">' +
        sorted.map(function (p) { return recordCard(p, { action: false }); }).join("") +
      "</ul>" +
      '<div class="table-wrap table-wrap--stacks"><table class="table">' +
        "<thead><tr>" +
          '<th scope="col" class="col-product">Produto</th>' +
          '<th scope="col" class="num">Estoque</th>' +
          '<th scope="col" class="num">Mínimo</th>' +
          '<th scope="col">Status</th>' +
        "</tr></thead><tbody>" +
        sorted.map(function (p) {
          var status = getProductStatus(p);
          return (
            "<tr>" +
              '<td class="col-product">' +
                '<span class="cell-product__name">' + escapeHtml(p.name) + "</span><br />" +
                '<span class="cell-product__sku">' + p.sku + "</span></td>" +
              '<td class="num"><span class="cell-strong">' + p.stock + "</span> " +
                '<span class="cell-muted">' + p.unit + "</span></td>" +
              '<td class="num"><span class="cell-muted">' + p.min + "</span></td>" +
              '<td><span class="badge ' + status.className + '">' + status.label + "</span></td>" +
            "</tr>"
          );
        }).join("") +
      "</tbody></table></div>"
    );
  }

  /* ========================================================================
     6f. RECEBIMENTO DE PEDIDOS
     ======================================================================== */

  function findOrder(orderId) {
    for (var i = 0; i < purchaseOrders.length; i++) {
      if (purchaseOrders[i].id === orderId) return purchaseOrders[i];
    }
    return null;
  }

  function orderStatusBadge(order) {
    return order.status === "received"
      ? '<span class="badge badge--ok">Recebido</span>'
      : '<span class="badge badge--low">Em aberto</span>';
  }

  function orderAction(order) {
    return order.status === "received"
      ? '<span class="cell-muted">' + formatDateFull(order.receivedAt) + "</span>"
      : '<button type="button" class="btn btn--link" data-action="receive-order" ' +
        'data-order-id="' + order.id + '">Receber</button>';
  }

  function openReceiveModal(orderId) {
    var order = findOrder(orderId);
    if (!order || order.status !== "open") return;

    state.currentOrderId = orderId;
    // Aberto de dentro do fornecedor? Voltamos para lá ao fechar.
    state.returnToSupplier = state.openModalId === "modal-supplier";

    $("#receiveModalMeta").textContent =
      order.id + " · " + supplierName(order.supplierId) + " · pedido em " +
      formatDateFull(order.createdAt);

    $("#receiveModalBody").innerHTML = order.items.map(function (item) {
      var p = findProduct(item.productId);
      if (!p) return "";

      return (
        '<div class="order-item">' +
          '<span class="order-item__info">' +
            '<span class="order-item__name">' + escapeHtml(p.name) + "</span><br />" +
            '<span class="order-item__meta">' + p.sku + " · estoque atual " + p.stock +
              " " + p.unit + " · pedido de " + item.qty + " " + p.unit + "</span>" +
          "</span>" +
          '<span class="order-item__qty">' +
            '<input type="number" class="input" min="0" step="1" value="' + item.qty +
              '" data-receive-qty="' + p.id + '" data-cost="' + p.cost +
              '" aria-label="Quantidade recebida de ' + escapeHtml(p.name) + '" />' +
            '<span class="order-item__unit">' + p.unit + "</span>" +
          "</span>" +
          '<span class="order-item__cost" data-receive-line="' + p.id + '">' +
            formatCurrency(item.qty * p.cost) + "</span>" +
        "</div>"
      );
    }).join("");

    $("#receiveInvoice").value = "";
    hideError("#receiveError");
    updateReceiveTotal();
    openModal("modal-receive");
  }

  function updateReceiveTotal() {
    var total = 0;
    var units = 0;

    $$("#receiveModalBody [data-receive-qty]").forEach(function (input) {
      var qty = parseInt(input.value, 10);
      if (isNaN(qty) || qty < 0) qty = 0;

      var lineCost = qty * parseFloat(input.getAttribute("data-cost"));
      total += lineCost;
      units += qty;

      var line = $('[data-receive-line="' + input.getAttribute("data-receive-qty") + '"]');
      if (line) line.textContent = formatCurrency(lineCost);
    });

    $("#receiveTotal").innerHTML =
      units + " " + plural(units, "unidade recebida", "unidades recebidas") +
      " · <strong>" + formatCurrency(total) + "</strong>";
  }

  function confirmReceive() {
    var order = findOrder(state.currentOrderId);
    if (!order || order.status !== "open") return false;

    var quantities = {};
    var invalid = false;
    var total = 0;

    $$("#receiveModalBody [data-receive-qty]").forEach(function (input) {
      var qty = parseInt(input.value, 10);
      if (isNaN(qty) || qty < 0) invalid = true;
      quantities[input.getAttribute("data-receive-qty")] = qty;
      total += qty || 0;
    });

    if (invalid) {
      showError("#receiveError", "As quantidades recebidas não podem ficar em branco nem negativas.");
      return false;
    }
    if (total === 0) {
      showError("#receiveError", "Informe ao menos uma unidade recebida para encerrar o pedido.");
      return false;
    }

    var invoice = $("#receiveInvoice").value.trim();
    var note = "Recebimento do pedido " + order.id + (invoice ? " · NF " + invoice : "");
    var receivedItems = 0;

    order.items.forEach(function (item) {
      var qty = quantities[item.productId];
      var product = findProduct(item.productId);
      if (!product || !qty) return;

      applyEntry(product, qty, "Compra", note);
      receivedItems++;
    });

    order.status = "received";
    order.receivedAt = new Date();
    order.receivedQty = quantities;
    if (invoice) order.invoice = invoice;

    hideError("#receiveError");
    refreshAll();

    showToast({
      type: "success",
      title: "Pedido recebido",
      text: order.id + ": " + total + " " + plural(total, "unidade entrou", "unidades entraram") +
        " no estoque em " + receivedItems + " " +
        plural(receivedItems, "produto", "produtos") + "."
    });

    return true;
  }

  /* ========================================================================
     6g. RENDERIZAÇÃO — RELATÓRIOS
     ======================================================================== */

  /** Início do dia, N dias atrás. */
  function startOfDaysAgo(n) {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - n);
    return d;
  }

  function reportPeriodDays() {
    return Number(state.reportPeriod) || 30;
  }

  function movementsInReportPeriod() {
    var from = startOfDaysAgo(reportPeriodDays() - 1);
    return movements.filter(function (m) { return m.date >= from; });
  }

  /**
   * Divide o período em no máximo 6 colunas (ou 1 por dia, em 7 dias),
   * somando entradas e saídas de cada faixa.
   */
  function periodBuckets() {
    var days = reportPeriodDays();
    var size = days <= 7 ? 1 : Math.ceil(days / 6);
    var count = Math.ceil(days / size);
    var buckets = [];

    for (var i = count - 1; i >= 0; i--) {
      var end = new Date();
      end.setHours(23, 59, 59, 999);
      end.setDate(end.getDate() - i * size);

      var start = new Date(end);
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - (size - 1));

      buckets.push({
        start: start,
        end: end,
        label: formatDateShort(size === 1 ? end : start),
        inQty: 0,
        outQty: 0
      });
    }

    movements.forEach(function (m) {
      for (var i = 0; i < buckets.length; i++) {
        if (m.date >= buckets[i].start && m.date <= buckets[i].end) {
          if (m.type === "in") buckets[i].inQty += m.qty;
          else buckets[i].outQty += m.qty;
          return;
        }
      }
    });

    return buckets;
  }

  function renderReports() {
    var days = reportPeriodDays();
    $("#reportRange").textContent =
      formatDateFull(startOfDaysAgo(days - 1)) + " a " + formatDateFull(new Date());

    renderReportKpis();
    renderFlowChart();
    renderStatusChart();
    renderCategoryChart();
    renderTopChart();
  }

  function renderReportKpis() {
    var active = products.filter(function (p) { return p.active; });
    var out = active.filter(function (p) { return getProductStatus(p).key === "out"; }).length;
    var low = active.filter(function (p) { return getProductStatus(p).key === "low"; }).length;
    var period = movementsInReportPeriod();
    var value = active.reduce(function (sum, p) { return sum + p.stock * p.cost; }, 0);
    var sale = active.reduce(function (sum, p) { return sum + p.stock * p.price; }, 0);

    $("#reportKpis").innerHTML = [
      {
        icon: "i-ban", modifier: "kpi--danger",
        label: "Produtos em falta", value: out,
        hint: out ? "Reponha o quanto antes" : "Nenhum produto zerado"
      },
      {
        icon: "i-alert", modifier: "kpi--warning",
        label: "Abaixo do mínimo", value: low,
        hint: "Precisam de reposição"
      },
      {
        icon: "i-refresh", modifier: "kpi--info",
        label: "Movimentações no período", value: period.length,
        hint: "Últimos " + reportPeriodDays() + " dias"
      },
      {
        icon: "i-chart", modifier: "",
        label: "Valor estimado do estoque", value: formatCurrency(value),
        hint: "A preço de venda: " + formatCurrency(sale)
      }
    ].map(renderKpiCard).join("");
  }

  function renderFlowChart() {
    var buckets = periodBuckets();
    var max = buckets.reduce(function (top, b) {
      return Math.max(top, b.inQty, b.outQty);
    }, 0);

    var totalIn = buckets.reduce(function (sum, b) { return sum + b.inQty; }, 0);
    var totalOut = buckets.reduce(function (sum, b) { return sum + b.outQty; }, 0);

    if (!max) {
      $("#chartFlow").innerHTML =
        '<div class="table-empty">Nenhuma movimentação registrada no período.</div>';
      return;
    }

    var bar = function (qty, kind, label) {
      var height = Math.max((qty / max) * 100, qty > 0 ? 4 : 0);
      return (
        '<span class="bars__bar bars__bar--' + (qty > 0 ? kind : "empty") + '" ' +
        'style="height:' + height + '%" title="' + label + ': ' + qty + ' un"></span>'
      );
    };

    $("#chartFlow").innerHTML =
      '<div class="bars">' +
        buckets.map(function (b) {
          return (
            '<span class="bars__group">' +
              bar(b.inQty, "in", "Entradas em " + b.label) +
              bar(b.outQty, "out", "Saídas em " + b.label) +
            "</span>"
          );
        }).join("") +
      "</div>" +
      '<div class="bars-axis">' +
        buckets.map(function (b) {
          return '<span class="bars-axis__label">' + b.label + "</span>";
        }).join("") +
      "</div>" +
      '<p class="chart-note">' +
        "Entraram <strong>" + totalIn + "</strong> " +
        plural(totalIn, "unidade", "unidades") + " e saíram <strong>" + totalOut +
        "</strong> no período · saldo <strong>" +
        (totalIn - totalOut >= 0 ? "+" : "−") + Math.abs(totalIn - totalOut) +
        "</strong> " + plural(Math.abs(totalIn - totalOut), "unidade", "unidades") +
      "</p>";
  }

  function renderStatusChart() {
    var active = products.filter(function (p) { return p.active; });
    var counts = { ok: 0, low: 0, out: 0 };
    active.forEach(function (p) { counts[getProductStatus(p).key]++; });

    var segments = [
      { key: "ok", label: "Normal", value: counts.ok, color: "var(--success)" },
      { key: "low", label: "Baixo", value: counts.low, color: "var(--warning)" },
      { key: "out", label: "Em falta", value: counts.out, color: "var(--danger)" }
    ];

    var radius = 60;
    var circumference = 2 * Math.PI * radius;
    var offset = 0;

    var arcs = segments.map(function (s) {
      var length = active.length ? (s.value / active.length) * circumference : 0;
      var arc =
        '<circle class="donut__segment" cx="75" cy="75" r="' + radius + '" fill="none" ' +
        'stroke="' + s.color + '" stroke-width="18" ' +
        'stroke-dasharray="' + length.toFixed(2) + " " + (circumference - length).toFixed(2) + '" ' +
        'stroke-dashoffset="' + (-offset).toFixed(2) + '">' +
        "<title>" + s.label + ": " + s.value + "</title></circle>";
      offset += length;
      return arc;
    }).join("");

    var legendClass = { ok: "ok", low: "low", out: "out-stock" };

    $("#chartStatus").innerHTML =
      '<div class="donut">' +
        '<div class="donut__figure">' +
          '<svg class="donut__svg" viewBox="0 0 150 150" role="img" ' +
            'aria-label="Distribuição dos produtos por situação de estoque">' +
            '<circle cx="75" cy="75" r="' + radius + '" fill="none" ' +
              'stroke="var(--surface-secondary)" stroke-width="18"></circle>' +
            arcs +
          "</svg>" +
          '<span class="donut__center">' +
            '<strong class="donut__value">' + active.length + "</strong>" +
            '<span class="donut__label">produtos</span>' +
          "</span>" +
        "</div>" +
        '<ul class="donut__legend">' +
          segments.map(function (s) {
            var percent = active.length ? Math.round((s.value / active.length) * 100) : 0;
            return (
              '<li class="legend-item legend-item--' + legendClass[s.key] + '">' +
                s.label + "<span>" + s.value + " · " + percent + "%</span>" +
              "</li>"
            );
          }).join("") +
        "</ul>" +
      "</div>";
  }

  function horizontalBars(rows, modifier) {
    if (!rows.length) {
      return '<div class="table-empty">Sem dados para o período.</div>';
    }

    var max = rows.reduce(function (top, r) { return Math.max(top, r.value); }, 0) || 1;

    return (
      '<div class="hbars">' +
        rows.map(function (r) {
          return (
            "<div>" +
              '<div class="hbar__head">' +
                '<span class="hbar__label">' + escapeHtml(r.label) + "</span>" +
                '<span class="hbar__value">' + r.display + "</span>" +
              "</div>" +
              '<div class="hbar__track">' +
                '<div class="hbar__fill' + (modifier || "") + '" style="width:' +
                  Math.max((r.value / max) * 100, 2) + '%"></div>' +
              "</div>" +
            "</div>"
          );
        }).join("") +
      "</div>"
    );
  }

  function renderCategoryChart() {
    var totals = {};

    products.filter(function (p) { return p.active; }).forEach(function (p) {
      totals[p.category] = (totals[p.category] || 0) + p.stock * p.cost;
    });

    var rows = Object.keys(totals)
      .map(function (category) {
        return {
          label: category,
          value: totals[category],
          display: formatCurrency(totals[category])
        };
      })
      .sort(function (a, b) { return b.value - a.value; });

    $("#chartCategory").innerHTML = horizontalBars(rows, "");
  }

  function renderTopChart() {
    var totals = {};

    movementsInReportPeriod().forEach(function (m) {
      if (m.type !== "out") return;
      totals[m.productId] = (totals[m.productId] || 0) + m.qty;
    });

    var rows = Object.keys(totals)
      .map(function (productId) {
        var p = findProduct(productId);
        return {
          label: p ? p.name : "Produto removido",
          value: totals[productId],
          display: totals[productId] + " " + (p ? p.unit : "un")
        };
      })
      .sort(function (a, b) { return b.value - a.value; })
      .slice(0, 6);

    $("#chartTop").innerHTML = horizontalBars(rows, " hbar__fill--alt");
  }

  /* ========================================================================
     6h. RENDERIZAÇÃO — CONFIGURAÇÕES
     ======================================================================== */

  function initials(text) {
    return String(text)
      .trim()
      .split(/\s+/)
      .filter(function (word) { return word.length > 2; })
      .slice(0, 2)
      .map(function (word) { return word.charAt(0).toUpperCase(); })
      .join("") || "PG";
  }

  /** Reflete os dados da loja na barra lateral e no topo. */
  function applyIdentity() {
    $(".store-chip__info strong").textContent = settings.storeName;
    $(".store-chip__info small").textContent = settings.plan;
    $(".store-chip__avatar").textContent = initials(settings.storeName);

    $(".user-chip__hello").innerHTML = "Olá, <strong>" + escapeHtml(settings.ownerName) + "</strong>";
    $(".user-chip__avatar").textContent = settings.ownerName.charAt(0).toUpperCase();
  }

  /** O ponto vermelho do sino só aparece se houver alerta ativo e pendente. */
  function updateAlertDot() {
    var m = calculateDashboardMetrics();
    var hasAlert = (settings.alertOut && m.out > 0) || (settings.alertLow && m.low > 0);
    $("#btnNotifications").classList.toggle("has-dot", hasAlert);
  }

  function applyAccent(accentId) {
    var accent = ACCENTS.filter(function (a) { return a.id === accentId; })[0] || ACCENTS[0];
    var root = document.documentElement;

    root.style.setProperty("--primary", accent.primary);
    root.style.setProperty("--primary-hover", accent.hover);
    root.style.setProperty("--primary-active", accent.active);
    root.style.setProperty("--primary-soft", accent.soft);
    root.style.setProperty("--primary-soft-strong", accent.softStrong);

    settings.accent = accent.id;
  }

  function renderSettings() {
    $("#setStoreName").value = settings.storeName;
    $("#setOwnerName").value = settings.ownerName;
    $("#setPhone").value = settings.phone;
    $("#setCity").value = settings.city;

    $("#setDefaultMin").value = settings.defaultMin;
    $("#setFactor").value = String(settings.suggestionFactor);
    renderFactorPreview();

    $("#setAlertOut").checked = settings.alertOut;
    $("#setAlertLow").checked = settings.alertLow;
    $("#setDigest").checked = settings.dailyDigest;

    renderSwatches();
    renderDemoSummary();
  }

  /** Mostra o efeito prático do multiplicador em um produto real da lista. */
  function renderFactorPreview() {
    var sample = belowMinimumList()[0] || products[0];
    var factor = Number($("#setFactor").value);
    var target = Math.ceil(sample.min * factor);
    var suggestion = Math.max(target - sample.stock, sample.min);

    $("#factorPreview").textContent =
      "Ex.: " + sample.name + " tem " + sample.stock + " de " + sample.min + " " +
      sample.unit + " — sugestão de " + suggestion + " " + sample.unit + ".";
  }

  function renderSwatches() {
    $("#swatches").innerHTML = ACCENTS.map(function (accent) {
      return (
        '<button type="button" class="swatch' +
          (settings.accent === accent.id ? " is-active" : "") +
          '" data-action="set-accent" data-accent="' + accent.id + '" role="radio" ' +
          'aria-checked="' + (settings.accent === accent.id) + '">' +
          '<span class="swatch__dot" style="background:' + accent.primary + '">' +
            icon("i-check") + "</span>" +
          '<span class="swatch__label">' + accent.label + "</span>" +
        "</button>"
      );
    }).join("");
  }

  function renderDemoSummary() {
    var openOrders = purchaseOrders.filter(function (o) { return o.status === "open"; }).length;

    $("#demoSummary").innerHTML =
      "Agora há <strong>" + products.length + "</strong> " +
      plural(products.length, "produto", "produtos") + ", <strong>" + movements.length +
      "</strong> " + plural(movements.length, "movimentação", "movimentações") +
      ", <strong>" + suppliers.length + "</strong> " +
      plural(suppliers.length, "fornecedor", "fornecedores") + " e <strong>" +
      purchaseOrders.length + "</strong> " +
      plural(purchaseOrders.length, "pedido de compra", "pedidos de compra") +
      " (" + openOrders + " em aberto). Nada é gravado em servidor: recarregar a " +
      "página devolve o sistema ao estado inicial da demonstração.";
  }

  function saveStoreSettings() {
    var name = $("#setStoreName").value.trim();
    var owner = $("#setOwnerName").value.trim();

    if (!name || !owner) {
      showError("#storeError", "Nome do estabelecimento e responsável são obrigatórios.");
      return;
    }

    settings.storeName = name;
    settings.ownerName = owner;
    settings.phone = $("#setPhone").value.trim();
    settings.city = $("#setCity").value.trim();

    hideError("#storeError");
    applyIdentity();

    showToast({
      type: "success",
      title: "Dados da loja salvos",
      text: settings.storeName + " · responsável " + settings.ownerName + "."
    });
  }

  function saveStockPreferences() {
    var min = parseInt($("#setDefaultMin").value, 10);

    if (isNaN(min) || min < 0) {
      showError("#prefsError", "O estoque mínimo padrão deve ser zero ou mais.");
      return;
    }

    settings.defaultMin = min;
    settings.suggestionFactor = Number($("#setFactor").value);

    hideError("#prefsError");
    renderFactorPreview();
    refreshAll();

    showToast({
      type: "success",
      title: "Preferências salvas",
      text: "Mínimo padrão de " + min + " un e sugestão de compra até " +
        String(settings.suggestionFactor).replace(".", ",") + "× o mínimo."
    });
  }

  /** Ponto único de atualização: qualquer mudança nos dados passa por aqui. */
  function refreshAll() {
    renderDashboard();
    updateAlertDot();
    if (state.view === "produtos") renderProducts();
    if (state.view === "estoque") renderStock();
    if (state.view === "reposicao") renderReplenishment();
    if (state.view === "fornecedores") renderSuppliers();
    if (state.view === "relatorios") renderReports();
    if (state.view === "configuracoes") renderDemoSummary();
    if (state.currentProductId && state.openModalId === "modal-product") {
      renderProductDetails(state.currentProductId);
    }
  }

  /* ========================================================================
     7. RENDERIZAÇÃO — DETALHES DO PRODUTO
     ======================================================================== */

  function openProductDetails(productId) {
    var product = findProduct(productId);
    if (!product) return;

    state.currentProductId = productId;
    state.productTab = "info";
    renderProductDetails(productId);
    openModal("modal-product");
  }

  function renderProductDetails(productId) {
    var p = findProduct(productId);
    if (!p) return;

    var status = getProductStatus(p);
    var fillPercent = p.min > 0
      ? Math.min(Math.round((p.stock / p.min) * 100), 100)
      : (p.stock > 0 ? 100 : 0);
    var margin = p.cost > 0 ? ((p.price - p.cost) / p.cost) * 100 : 0;

    $("#productModalTitle").textContent = p.name;
    $("#productModalMeta").textContent =
      p.sku + " · " + p.category + " · " + supplierName(p.supplierId);

    $("#productModalBody").innerHTML =
      '<div class="product-hero">' +
        '<div class="product-hero__left">' +
          '<span class="badge ' + status.className + '">' + status.label + "</span>" +
          '<span class="badge badge--neutral badge--plain">' +
            (p.active ? "Ativo" : "Inativo") + "</span>" +
          '<span class="badge badge--neutral badge--plain">' +
            "Atualizado em " + formatDateFull(p.updatedAt) + "</span>" +
        "</div>" +
      "</div>" +

      '<div class="stat-grid">' +
        '<div class="stat stat--' + status.key + '">' +
          '<p class="stat__label">Estoque atual</p>' +
          '<p class="stat__value">' + p.stock + ' <span class="stat__unit">' + p.unit + "</span></p>" +
        "</div>" +
        '<div class="stat">' +
          '<p class="stat__label">Estoque mínimo</p>' +
          '<p class="stat__value">' + p.min + ' <span class="stat__unit">' + p.unit + "</span></p>" +
        "</div>" +
        '<div class="stat">' +
          '<p class="stat__label">Preço de custo</p>' +
          '<p class="stat__value">' + formatCurrency(p.cost) + "</p>" +
        "</div>" +
        '<div class="stat">' +
          '<p class="stat__label">Preço de venda</p>' +
          '<p class="stat__value">' + formatCurrency(p.price) + "</p>" +
        "</div>" +
      "</div>" +

      '<div class="gauge">' +
        '<div class="gauge__head">' +
          "<span>Nível em relação ao mínimo</span>" +
          "<strong>" + p.stock + " de " + p.min + " " + p.unit + "</strong>" +
        "</div>" +
        '<div class="gauge__track">' +
          '<div class="gauge__fill ' + status.fill + '" style="width:' + fillPercent + '%"></div>' +
        "</div>" +
      "</div>" +

      '<div class="tabs" role="tablist">' +
        tabButton("info", "Informações") +
        tabButton("history", "Histórico") +
        tabButton("movements", "Movimentações") +
      "</div>" +

      '<div class="tab-panel' + (state.productTab === "info" ? " is-active" : "") + '" data-panel="info">' +
        renderInfoPanel(p, margin) +
      "</div>" +
      '<div class="tab-panel' + (state.productTab === "history" ? " is-active" : "") + '" data-panel="history">' +
        renderHistoryPanel(p) +
      "</div>" +
      '<div class="tab-panel' + (state.productTab === "movements" ? " is-active" : "") + '" data-panel="movements">' +
        renderMovementsPanel(p) +
      "</div>";
  }

  function tabButton(key, label) {
    return (
      '<button type="button" class="tab' + (state.productTab === key ? " is-active" : "") +
      '" data-tab="' + key + '" role="tab">' + label + "</button>"
    );
  }

  function renderInfoPanel(p, margin) {
    var fields = [
      ["Categoria", p.category],
      ["Código interno", p.sku],
      ["Fornecedor", supplierName(p.supplierId)],
      ["Unidade de medida", p.unit],
      ["Margem sobre o custo", margin.toFixed(0) + "%"],
      ["Valor em estoque", formatCurrency(p.stock * p.cost)]
    ];

    return (
      '<div class="info-grid">' +
        fields.map(function (f) {
          return (
            "<div>" +
              '<p class="info__label">' + f[0] + "</p>" +
              '<p class="info__value">' + escapeHtml(f[1]) + "</p>" +
            "</div>"
          );
        }).join("") +
      "</div>" +

      '<div class="inline-edit">' +
        '<div class="inline-edit__text">' +
          "<strong>Alterar estoque mínimo</strong>" +
          "<span>O status do produto é recalculado na hora.</span>" +
        "</div>" +
        '<div class="field">' +
          '<label class="field__label" for="inlineMin">Novo mínimo</label>' +
          '<input class="input" type="number" id="inlineMin" min="0" step="1" value="' + p.min + '" />' +
        "</div>" +
        '<button type="button" class="btn btn--outline" data-action="save-min">Salvar</button>' +
      "</div>"
    );
  }

  function renderHistoryPanel(p) {
    var items = p.history.slice().sort(function (a, b) { return b.date - a.date; });

    if (!items.length) {
      return '<div class="table-empty">Nenhum registro no histórico deste produto.</div>';
    }

    return (
      '<ul class="history">' +
        items.map(function (h) {
          return (
            '<li class="history__item">' +
              '<span class="history__dot"></span>' +
              "<span>" +
                '<span class="history__text">' + escapeHtml(h.text) + "</span><br />" +
                '<span class="history__date">' + formatDateFull(h.date) + "</span>" +
              "</span>" +
            "</li>"
          );
        }).join("") +
      "</ul>"
    );
  }

  function renderMovementsPanel(p) {
    var list = movementsOf(p.id);

    if (!list.length) {
      return '<div class="table-empty">Este produto ainda não teve movimentações.</div>';
    }

    return (
      '<div class="table-wrap"><table class="table">' +
        "<thead><tr>" +
          '<th scope="col">Data</th>' +
          '<th scope="col">Tipo</th>' +
          '<th scope="col">Observação</th>' +
          '<th scope="col" class="num">Quantidade</th>' +
        "</tr></thead><tbody>" +
        list.map(function (m) {
          var isIn = m.type === "in";
          return (
            "<tr>" +
              '<td class="cell-muted">' + formatDateFull(m.date) + "</td>" +
              '<td><span class="badge ' + (isIn ? "badge--ok" : "badge--out") + '">' +
                escapeHtml(m.reason) + "</span></td>" +
              "<td>" + (m.note ? escapeHtml(m.note) : '<span class="cell-muted">—</span>') + "</td>" +
              '<td class="num"><span class="cell-strong ' +
                (isIn ? "text-success" : "text-danger") + '">' +
                (isIn ? "+" : "−") + m.qty + "</span></td>" +
            "</tr>"
          );
        }).join("") +
        "</tbody></table></div>"
    );
  }

  /** Alterna abas dentro do modal em que o botão foi clicado. */
  function switchTab(tabButton) {
    var root = tabButton.closest(".modal__body") || document;
    var key = tabButton.getAttribute("data-tab");

    $$(".tab", root).forEach(function (tab) {
      tab.classList.toggle("is-active", tab === tabButton);
    });
    $$(".tab-panel", root).forEach(function (panel) {
      panel.classList.toggle("is-active", panel.getAttribute("data-panel") === key);
    });

    if (root.id === "supplierModalBody") state.supplierTab = key;
    else state.productTab = key;
  }

  /* ========================================================================
     8. MOVIMENTAÇÕES — ENTRADA E SAÍDA
     ======================================================================== */

  function fillProductSelect(select, selectedId) {
    var sorted = products.slice().sort(function (a, b) {
      return a.name.localeCompare(b.name, "pt-BR");
    });

    select.innerHTML = sorted.map(function (p) {
      return (
        '<option value="' + p.id + '">' +
        escapeHtml(p.name) + " — " + p.stock + " " + p.unit + " em estoque" +
        "</option>"
      );
    }).join("");

    if (selectedId) select.value = selectedId;
  }

  function fillSupplierSelect(select, selectedId) {
    select.innerHTML = suppliers.map(function (s) {
      return '<option value="' + s.id + '">' + escapeHtml(s.name) + "</option>";
    }).join("");
    if (selectedId) select.value = selectedId;
  }

  function openEntryModal(productId, returnToProduct) {
    var product = findProduct(productId) || products[0];

    fillProductSelect($("#entryProduct"), product.id);
    fillSupplierSelect($("#entrySupplier"), product.supplierId);
    $("#entryQty").value = Math.max(suggestedPurchase(product), 1);
    $("#entryNote").value = "";
    hideError("#entryError");

    state.returnToProduct = !!returnToProduct;
    updateEntryPreview();
    openModal("modal-entry");
  }

  function openExitModal(productId, returnToProduct) {
    var product = findProduct(productId) || products[0];

    fillProductSelect($("#exitProduct"), product.id);
    $("#exitQty").value = 1;
    $("#exitReason").value = "Venda";
    $("#exitNote").value = "";
    hideError("#exitError");

    state.returnToProduct = !!returnToProduct;
    updateExitPreview();
    openModal("modal-exit");
  }

  function previewMarkup(current, delta, unit, kind) {
    var next = Math.max(current + delta, 0);
    return (
      '<span class="preview__step">' +
        '<span class="preview__label">Estoque atual</span>' +
        '<span class="preview__value">' + current + " " + unit + "</span>" +
      "</span>" +
      '<span class="preview__arrow">' + icon("i-arrow-right", "icon--sm") + "</span>" +
      '<span class="preview__step">' +
        '<span class="preview__label">' + (kind === "in" ? "Entrada" : "Saída") + "</span>" +
        '<span class="preview__value preview__value--' + kind + '">' +
          (kind === "in" ? "+" : "−") + Math.abs(delta) +
        "</span>" +
      "</span>" +
      '<span class="preview__arrow">' + icon("i-arrow-right", "icon--sm") + "</span>" +
      '<span class="preview__step">' +
        '<span class="preview__label">Novo estoque</span>' +
        '<span class="preview__value">' + next + " " + unit + "</span>" +
      "</span>"
    );
  }

  function updateEntryPreview() {
    var product = findProduct($("#entryProduct").value);
    var qty = parseInt($("#entryQty").value, 10);
    var box = $("#entryPreview");

    if (!product || !qty || qty < 1) { box.hidden = true; return; }

    box.innerHTML = previewMarkup(product.stock, qty, product.unit, "in");
    box.hidden = false;
  }

  function updateExitPreview() {
    var product = findProduct($("#exitProduct").value);
    var qty = parseInt($("#exitQty").value, 10);
    var box = $("#exitPreview");

    if (!product || !qty || qty < 1) { box.hidden = true; return; }

    // Estoque nunca fica negativo: acima do disponível mostramos só o alerta.
    if (qty > product.stock) {
      box.hidden = true;
      showError("#exitError",
        "Não é possível retirar " + qty + " " + product.unit + ": há apenas " +
        product.stock + " em estoque.");
      return;
    }

    hideError("#exitError");
    box.innerHTML = previewMarkup(product.stock, -qty, product.unit, "out");
    box.hidden = false;
  }

  /**
   * Núcleo da entrada de estoque: soma, registra a movimentação e o histórico.
   * Usado tanto pelo modal de entrada quanto pelo recebimento de pedidos.
   */
  function applyEntry(product, qty, reason, note) {
    var previous = product.stock;

    product.stock += qty;
    product.updatedAt = new Date();

    addMovement({
      type: "in",
      reason: reason,
      productId: product.id,
      qty: qty,
      note: note
    });

    product.history.push({
      date: new Date(),
      text: "Entrada de " + qty + " " + product.unit + " (" + reason.toLowerCase() + ")" +
        (note ? " — " + note : "") + ". Estoque: " + previous + " → " + product.stock + "."
    });

    return previous;
  }

  function registerEntry(productId, qty, supplierId, note) {
    var product = findProduct(productId);
    if (!product) return false;

    if (supplierId) product.supplierId = supplierId;
    var previous = applyEntry(product, qty, "Entrada", note);

    refreshAll();

    showToast({
      type: "success",
      title: "Entrada registrada",
      text: product.name + ": " + previous + " → " + product.stock + " " + product.unit +
        " · status " + getProductStatus(product).label.toLowerCase() + "."
    });

    return true;
  }

  function registerExit(productId, qty, reason, note) {
    var product = findProduct(productId);
    if (!product) return false;

    if (qty > product.stock) {
      showToast({
        type: "danger",
        title: "Saída não registrada",
        text: "O estoque de " + product.name + " tem apenas " + product.stock + " " +
          product.unit + "."
      });
      return false;
    }

    var previous = product.stock;
    product.stock -= qty;
    product.updatedAt = new Date();

    addMovement({
      type: "out",
      reason: reason,
      productId: product.id,
      qty: qty,
      note: note
    });

    product.history.push({
      date: new Date(),
      text: "Saída de " + qty + " " + product.unit + " (" + reason.toLowerCase() +
        ") registrada por " + settings.ownerName + ". Estoque: " + previous + " → " + product.stock + "."
    });

    refreshAll();

    var status = getProductStatus(product);
    showToast({
      type: status.key === "ok" ? "success" : "warning",
      title: "Saída registrada",
      text: product.name + ": " + previous + " → " + product.stock + " " + product.unit +
        " · status " + status.label.toLowerCase() + "."
    });

    return true;
  }

  /* ========================================================================
     9. EDIÇÃO DE PRODUTO / ESTOQUE MÍNIMO
     ======================================================================== */

  function updateMinimumStock(productId, newMin) {
    var product = findProduct(productId);
    if (!product) return;

    var previous = product.min;
    if (previous === newMin) {
      showToast({ type: "info", title: "Nada a alterar", text: "O estoque mínimo já era " + newMin + "." });
      return;
    }

    product.min = newMin;
    product.updatedAt = new Date();
    product.history.push({
      date: new Date(),
      text: "Estoque mínimo alterado de " + previous + " para " + newMin + " " + product.unit + "."
    });

    refreshAll();

    showToast({
      type: "success",
      title: "Estoque mínimo atualizado",
      text: product.name + " agora é considerado " +
        getProductStatus(product).label.toLowerCase() + " com " + product.stock + " " +
        product.unit + "."
    });
  }

  var SKU_PREFIX = {
    "Ração": "RAC",
    "Medicamento": "MED",
    "Higiene": "HIG",
    "Acessórios": "ACE",
    "Petiscos": "PET",
    "Agropecuário": "AGR",
    "Jardinagem": "JAR"
  };

  /** Gera o próximo código interno livre para a categoria (ex.: RAC-0195). */
  function generateSku(category) {
    var prefix = SKU_PREFIX[category] || "PRD";
    var greatest = 0;

    products.forEach(function (p) {
      var match = /^([A-Z]{3})-(\d+)$/.exec(p.sku);
      if (match && match[1] === prefix) {
        greatest = Math.max(greatest, Number(match[2]));
      }
    });

    return prefix + "-" + String(greatest + 1).padStart(4, "0");
  }

  function applyFormMode(mode) {
    $$("#modal-edit [data-only]").forEach(function (el) {
      el.classList.toggle("is-hidden", el.getAttribute("data-only") !== mode);
    });
  }

  /** Um único formulário atende cadastro e edição; os campos mudam por modo. */
  function openProductForm(mode, productId) {
    var isCreate = mode === "create";
    var p = isCreate ? null : findProduct(productId);
    if (!isCreate && !p) return;

    state.productFormMode = mode;
    applyFormMode(mode);

    $("#editCategory").innerHTML = CATEGORIES.map(function (c) {
      return '<option value="' + c + '">' + c + "</option>";
    }).join("");

    $("#editModalTitle").textContent = isCreate ? "Cadastrar produto" : "Editar produto";
    $("#editSubmitLabel").textContent = isCreate ? "Cadastrar produto" : "Salvar alterações";
    $("#editModalMeta").textContent = isCreate
      ? "Adicione um item ao catálogo da loja"
      : p.sku + " · " + p.category;

    if (isCreate) {
      $("#editName").value = "";
      $("#editCategory").value = CATEGORIES[0];
      fillSupplierSelect($("#editSupplier"), suppliers[0].id);
      $("#editSku").value = "";
      $("#editSku").placeholder = generateSku(CATEGORIES[0]);
      $("#editUnit").value = "un";
      $("#editStock").value = 0;
      $("#editMin").value = settings.defaultMin;
      $("#editCost").value = "";
      $("#editPrice").value = "";
      $("#editStatus").value = "true";
    } else {
      $("#editName").value = p.name;
      $("#editCategory").value = p.category;
      fillSupplierSelect($("#editSupplier"), p.supplierId);
      $("#editMin").value = p.min;
      $("#editStatus").value = String(p.active);
      $("#editCost").value = p.cost;
      $("#editPrice").value = p.price;
    }

    hideError("#editError");
    state.returnToProduct = !isCreate;
    openModal("modal-edit");
  }

  function submitProductForm() {
    return state.productFormMode === "create" ? createProduct() : saveProductEdit();
  }

  function createProduct() {
    var name = $("#editName").value.trim();
    var category = $("#editCategory").value;
    var sku = $("#editSku").value.trim().toUpperCase() || generateSku(category);
    var stock = parseInt($("#editStock").value, 10);
    var min = parseInt($("#editMin").value, 10);
    var cost = parseFloat($("#editCost").value);
    var price = parseFloat($("#editPrice").value);

    if (!name) {
      showError("#editError", "Informe o nome do produto.");
      $("#editName").focus();
      return false;
    }
    if (findProductBySku(sku)) {
      showError("#editError", "Já existe um produto com o código " + sku + ".");
      $("#editSku").focus();
      return false;
    }
    if (isNaN(stock) || stock < 0 || isNaN(min) || min < 0) {
      showError("#editError", "Estoque inicial e mínimo devem ser números iguais ou maiores que zero.");
      return false;
    }
    if (isNaN(cost) || cost < 0 || isNaN(price) || price < 0) {
      showError("#editError", "Informe os preços de custo e de venda.");
      $("#editCost").focus();
      return false;
    }

    var now = new Date();
    var product = {
      id: "p" + ++productSeq,
      sku: sku,
      name: name,
      category: category,
      unit: $("#editUnit").value,
      stock: stock,
      min: min,
      supplierId: $("#editSupplier").value,
      cost: cost,
      price: price,
      active: true,
      createdAt: now,
      updatedAt: now,
      history: [{ date: now, text: "Produto cadastrado no sistema por " + settings.ownerName + "." }]
    };

    products.push(product);

    if (stock > 0) {
      addMovement({
        type: "in",
        reason: "Estoque inicial",
        productId: product.id,
        qty: stock,
        note: "Cadastro do produto"
      });
      product.history.push({
        date: now,
        text: "Estoque inicial de " + stock + " " + product.unit + " lançado no cadastro."
      });
    }

    hideError("#editError");
    refreshAll();

    showToast({
      type: "success",
      title: "Produto cadastrado",
      text: product.name + " (" + product.sku + ") entrou no catálogo com " +
        product.stock + " " + product.unit + "."
    });

    // Abre os detalhes do novo produto ao fechar o formulário.
    state.currentProductId = product.id;
    state.returnToProduct = true;
    return true;
  }

  function saveProductEdit() {
    var p = findProduct(state.currentProductId);
    if (!p) return false;

    var name = $("#editName").value.trim();
    var min = parseInt($("#editMin").value, 10);
    var cost = parseFloat($("#editCost").value);
    var price = parseFloat($("#editPrice").value);

    if (!name) {
      showError("#editError", "Informe o nome do produto.");
      return false;
    }
    if (isNaN(min) || min < 0) {
      showError("#editError", "O estoque mínimo deve ser um número igual ou maior que zero.");
      return false;
    }
    if (isNaN(cost) || cost < 0 || isNaN(price) || price < 0) {
      showError("#editError", "Os preços devem ser valores válidos.");
      return false;
    }

    var changes = [];
    if (p.name !== name) changes.push("nome");
    if (p.category !== $("#editCategory").value) changes.push("categoria");
    if (p.supplierId !== $("#editSupplier").value) changes.push("fornecedor");
    if (p.min !== min) changes.push("estoque mínimo (" + p.min + " → " + min + ")");
    if (p.cost !== cost) changes.push("preço de custo");
    if (p.price !== price) changes.push("preço de venda");
    if (p.active !== ($("#editStatus").value === "true")) changes.push("situação");

    p.name = name;
    p.category = $("#editCategory").value;
    p.supplierId = $("#editSupplier").value;
    p.min = min;
    p.cost = cost;
    p.price = price;
    p.active = $("#editStatus").value === "true";
    p.updatedAt = new Date();

    if (changes.length) {
      p.history.push({
        date: new Date(),
        text: "Cadastro atualizado por " + settings.ownerName + ": " + changes.join(", ") + "."
      });
    }

    hideError("#editError");
    refreshAll();

    showToast({
      type: "success",
      title: "Produto atualizado",
      text: changes.length
        ? p.name + " — " + changes.length + " " + plural(changes.length, "alteração salva", "alterações salvas") + "."
        : "Nenhuma alteração foi necessária."
    });

    return true;
  }

  /* ========================================================================
     10. MODAIS
     ======================================================================== */

  function openModal(id) {
    var modal = document.getElementById(id);
    if (!modal) return;

    if (state.openModalId && state.openModalId !== id) {
      hideModal(state.openModalId);
    }
    if (!state.openModalId) {
      state.lastFocused = document.activeElement;
    }

    modal.hidden = false;
    state.openModalId = id;
    document.body.classList.add("is-locked");

    // Foca o primeiro campo do formulário; em modais sem formulário
    // (detalhes do produto) foca o próprio diálogo, sem anel de foco visível.
    var target = modal.querySelector("[data-autofocus]") ||
      modal.querySelector(".modal__dialog");

    if (target) {
      if (!target.hasAttribute("data-autofocus")) target.setAttribute("tabindex", "-1");
      window.setTimeout(function () { target.focus(); }, 40);
    }
  }

  function hideModal(id) {
    var modal = document.getElementById(id);
    if (modal) modal.hidden = true;
  }

  function closeModal(id) {
    var target = id || state.openModalId;
    if (!target) return;

    hideModal(target);
    state.openModalId = null;
    document.body.classList.remove("is-locked");

    var backToProduct = state.returnToProduct &&
      (target === "modal-entry" || target === "modal-exit" || target === "modal-edit");
    var backToSupplier = state.returnToSupplier && target === "modal-receive";

    state.returnToProduct = false;
    state.returnToSupplier = false;

    if (backToProduct && state.currentProductId) {
      openProductDetails(state.currentProductId);
      return;
    }
    if (backToSupplier && state.currentSupplierId) {
      openSupplierDetails(state.currentSupplierId);
      return;
    }

    if (target === "modal-product") state.currentProductId = null;
    if (target === "modal-supplier") state.currentSupplierId = null;
    if (target === "modal-receive") state.currentOrderId = null;

    if (state.lastFocused && typeof state.lastFocused.focus === "function") {
      state.lastFocused.focus();
      state.lastFocused = null;
    }
  }

  /* ========================================================================
     11. NOTIFICAÇÕES (TOASTS)
     ======================================================================== */

  var TOAST_ICONS = {
    success: "i-check-circle",
    warning: "i-alert",
    danger: "i-ban",
    info: "i-bell"
  };

  function showToast(options) {
    var stack = $("#toastStack");
    var type = options.type || "info";

    var toast = document.createElement("div");
    toast.className = "toast toast--" + type;
    toast.setAttribute("role", "status");
    toast.innerHTML =
      '<span class="toast__icon">' + icon(TOAST_ICONS[type] || TOAST_ICONS.info) + "</span>" +
      "<span>" +
        '<span class="toast__title">' + escapeHtml(options.title) + "</span><br />" +
        '<span class="toast__text">' + escapeHtml(options.text || "") + "</span>" +
      "</span>";

    stack.appendChild(toast);

    window.setTimeout(function () {
      toast.classList.add("is-leaving");
      window.setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 200);
    }, 4200);
  }

  function showError(selector, message) {
    var el = $(selector);
    if (!el) return;
    el.innerHTML = icon("i-alert", "icon--sm") + "<span>" + escapeHtml(message) + "</span>";
    el.hidden = false;
  }

  function hideError(selector) {
    var el = $(selector);
    if (el) el.hidden = true;
  }

  /* ========================================================================
     12. SIDEBAR MOBILE
     ======================================================================== */

  function openSidebar() {
    $("#sidebar").classList.add("is-open");
    $("#sidebarBackdrop").hidden = false;
    $("#menuToggle").setAttribute("aria-expanded", "true");
    // Trava a rolagem do conteúdo atrás da gaveta, como em um app.
    document.body.classList.add("is-locked");
    window.setTimeout(function () { $("#sidebarClose").focus(); }, 60);
  }

  function closeSidebar() {
    var wasOpen = $("#sidebar").classList.contains("is-open");

    $("#sidebar").classList.remove("is-open");
    $("#sidebarBackdrop").hidden = true;
    $("#menuToggle").setAttribute("aria-expanded", "false");

    if (wasOpen && !state.openModalId) document.body.classList.remove("is-locked");
    if (wasOpen) $("#menuToggle").focus();
  }

  function toggleSidebar() {
    if ($("#sidebar").classList.contains("is-open")) closeSidebar();
    else openSidebar();
  }

  /* ========================================================================
     13. EVENTOS
     ======================================================================== */

  function handleAction(action, element) {
    switch (action) {
      case "open-entry":
        openEntryModal(products[0].id, false);
        break;
      case "open-exit":
        openExitModal(products[0].id, false);
        break;
      case "entry-current":
        openEntryModal(state.currentProductId, true);
        break;
      case "exit-current":
        openExitModal(state.currentProductId, true);
        break;
      case "edit-product":
        openProductForm("edit", state.currentProductId);
        break;
      case "new-product":
        openProductForm("create");
        break;
      case "row-entry":
        openEntryModal(element.getAttribute("data-product-id"), false);
        break;
      case "row-exit":
        openExitModal(element.getAttribute("data-product-id"), false);
        break;
      case "filter-status":
        setFilter("status", element.getAttribute("data-status"));
        break;
      case "filter-movement":
        state.stockFilters.type = element.getAttribute("data-type");
        renderStockMovements();
        break;
      case "filter-replenish":
        state.replenishment.scope = element.getAttribute("data-scope");
        renderReplenishTable();
        renderSelectionBar();
        break;
      case "toggle-select": {
        var productId = element.getAttribute("data-product-id");
        if (!productId || hasOpenOrder(productId)) return;
        // No checkbox o navegador já inverteu o estado; na linha, invertemos nós.
        var checked = element.type === "checkbox"
          ? element.checked
          : !state.replenishment.selected[productId];
        toggleSelection(productId, checked);
        break;
      }
      case "view-product":
        openProductDetails(element.getAttribute("data-product-id"));
        break;
      case "view-supplier":
        openSupplierDetails(element.getAttribute("data-supplier-id"));
        break;
      case "receive-order":
        openReceiveModal(element.getAttribute("data-order-id"));
        break;
      case "clear-selection":
        clearSelection();
        break;
      case "set-accent":
        applyAccent(element.getAttribute("data-accent"));
        renderSwatches();
        break;
      case "reset-demo":
        showToast({
          type: "info",
          title: "Restaurando demonstração",
          text: "Recarregando os dados iniciais…"
        });
        window.setTimeout(function () { window.location.reload(); }, 500);
        break;
      case "open-order":
        openOrderModal();
        break;
      case "toggle-filters": {
        var panel = $("#filterPanel");
        panel.hidden = !panel.hidden;
        $("#filterToggle").setAttribute("aria-expanded", String(!panel.hidden));
        if (!panel.hidden) $("#filterCategory").focus();
        break;
      }
      case "clear-filters":
        clearFilters();
        break;
      case "save-min": {
        var input = $("#inlineMin");
        var value = parseInt(input.value, 10);
        if (isNaN(value) || value < 0) {
          showToast({
            type: "danger",
            title: "Valor inválido",
            text: "Informe um estoque mínimo igual ou maior que zero."
          });
          input.focus();
          return;
        }
        updateMinimumStock(state.currentProductId, value);
        break;
      }
      default:
        break;
    }
    void element;
  }

  function bindEvents() {
    /* --- Clique global (delegação) --- */
    document.addEventListener("click", function (event) {
      var closer = event.target.closest("[data-close-modal]");
      if (closer) {
        closeModal();
        return;
      }

      var tab = event.target.closest("[data-tab]");
      if (tab) {
        switchTab(tab);
        return;
      }

      var actionEl = event.target.closest("[data-action]");
      if (actionEl) {
        handleAction(actionEl.getAttribute("data-action"), actionEl);
        return;
      }

      var viewEl = event.target.closest("[data-view]");
      if (viewEl) {
        navigateTo(viewEl.getAttribute("data-view"));
        return;
      }

      var productEl = event.target.closest("[data-product-id]");
      if (productEl) {
        openProductDetails(productEl.getAttribute("data-product-id"));
      }
    });

    /* --- Linhas da tabela acessíveis pelo teclado --- */
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        if (state.openModalId) {
          closeModal();
        } else if ($("#sidebar").classList.contains("is-open")) {
          closeSidebar();
        }
        return;
      }

      if (event.key === "Enter" || event.key === " ") {
        var row = event.target.closest("tr[data-product-id]");
        if (row && event.target === row) {
          event.preventDefault();
          openProductDetails(row.getAttribute("data-product-id"));
        }
      }
    });

    /* --- Sidebar mobile --- */
    $("#menuToggle").addEventListener("click", toggleSidebar);
    $("#sidebarBackdrop").addEventListener("click", closeSidebar);
    $("#sidebarClose").addEventListener("click", closeSidebar);

    /* --- Notificações do topo (respeitam as preferências de alerta) --- */
    $("#btnNotifications").addEventListener("click", function () {
      var m = calculateDashboardMetrics();
      var partes = [];

      if (settings.alertOut) {
        partes.push(m.out + " " + plural(m.out, "produto em falta", "produtos em falta"));
      }
      if (settings.alertLow) {
        partes.push(m.low + " com estoque baixo");
      }

      if (!partes.length) {
        showToast({
          type: "info",
          title: "Alertas desativados",
          text: "Ative os avisos em Configurações para acompanhar o estoque por aqui."
        });
        return;
      }

      showToast({
        type: settings.alertOut && m.out > 0 ? "danger" : "warning",
        title: "Alertas de estoque",
        text: partes.join(" e ") + "." +
          (settings.dailyDigest ? " Resumo diário ativo." : "")
      });
    });

    /* --- Formulário de entrada --- */
    $("#entryProduct").addEventListener("change", function () {
      var product = findProduct(this.value);
      if (product) {
        $("#entrySupplier").value = product.supplierId;
        $("#entryQty").value = Math.max(suggestedPurchase(product), 1);
      }
      updateEntryPreview();
    });
    $("#entryQty").addEventListener("input", updateEntryPreview);

    $("#entryForm").addEventListener("submit", function (event) {
      event.preventDefault();
      var productId = $("#entryProduct").value;
      var qty = parseInt($("#entryQty").value, 10);

      if (isNaN(qty) || qty < 1) {
        showError("#entryError", "Informe uma quantidade de pelo menos 1 unidade.");
        $("#entryQty").focus();
        return;
      }

      hideError("#entryError");
      if (registerEntry(productId, qty, $("#entrySupplier").value, $("#entryNote").value.trim())) {
        closeModal("modal-entry");
      }
    });

    /* --- Formulário de saída --- */
    $("#exitProduct").addEventListener("change", updateExitPreview);
    $("#exitQty").addEventListener("input", updateExitPreview);

    $("#exitForm").addEventListener("submit", function (event) {
      event.preventDefault();
      var productId = $("#exitProduct").value;
      var product = findProduct(productId);
      var qty = parseInt($("#exitQty").value, 10);

      if (isNaN(qty) || qty < 1) {
        showError("#exitError", "Informe uma quantidade de pelo menos 1 unidade.");
        $("#exitQty").focus();
        return;
      }

      if (!product || qty > product.stock) {
        showError("#exitError",
          "Você tentou retirar " + qty + " " + (product ? product.unit : "un") +
          ", mas há apenas " + (product ? product.stock : 0) +
          " em estoque. Ajuste a quantidade para continuar.");
        $("#exitQty").focus();
        return;
      }

      hideError("#exitError");
      if (registerExit(productId, qty, $("#exitReason").value, $("#exitNote").value.trim())) {
        closeModal("modal-exit");
      }
    });

    /* --- Formulário de produto (cadastro e edição) --- */
    $("#editForm").addEventListener("submit", function (event) {
      event.preventDefault();
      if (submitProductForm()) closeModal("modal-edit");
    });

    // No cadastro, o código sugerido acompanha a categoria escolhida.
    $("#editCategory").addEventListener("change", function () {
      if (state.productFormMode === "create") {
        $("#editSku").placeholder = generateSku(this.value);
      }
    });

    /* --- Busca e filtros da tela de Produtos --- */
    $("#productSearch").addEventListener("input", function () {
      setFilter("search", this.value);
    });

    $("#productSearch").addEventListener("keydown", function (event) {
      if (event.key === "Escape" && this.value) {
        event.stopPropagation();
        setFilter("search", "");
      }
    });

    $("#productSearchClear").addEventListener("click", function () {
      setFilter("search", "");
      $("#productSearch").focus();
    });

    $("#filterCategory").addEventListener("change", function () {
      setFilter("category", this.value);
    });
    $("#filterSupplier").addEventListener("change", function () {
      setFilter("supplier", this.value);
    });
    $("#filterSort").addEventListener("change", function () {
      setFilter("sort", this.value);
    });

    /* --- Período da tela de Estoque --- */
    $("#stockPeriod").addEventListener("change", function () {
      state.stockFilters.period = this.value;
      renderStockMovements();
    });

    /* --- Reposição: seleção e pedido de compra --- */
    $("#selectAll").addEventListener("change", function () {
      toggleSelectAll(this.checked);
    });

    $("#orderModalBody").addEventListener("input", updateOrderTotal);

    $("#orderForm").addEventListener("submit", function (event) {
      event.preventDefault();
      if (confirmOrder()) closeModal("modal-order");
    });

    /* --- Período dos relatórios --- */
    $("#reportPeriod").addEventListener("change", function () {
      state.reportPeriod = this.value;
      renderReports();
    });

    /* --- Configurações --- */
    $("#storeForm").addEventListener("submit", function (event) {
      event.preventDefault();
      saveStoreSettings();
    });

    $("#stockPrefsForm").addEventListener("submit", function (event) {
      event.preventDefault();
      saveStockPreferences();
    });

    $("#setFactor").addEventListener("change", renderFactorPreview);

    [
      ["#setAlertOut", "alertOut", "Avisos de produto em falta"],
      ["#setAlertLow", "alertLow", "Avisos de estoque baixo"],
      ["#setDigest", "dailyDigest", "Resumo diário por e-mail"]
    ].forEach(function (row) {
      $(row[0]).addEventListener("change", function () {
        settings[row[1]] = this.checked;
        updateAlertDot();
        showToast({
          type: "info",
          title: this.checked ? row[2] + " ativados" : row[2] + " desativados",
          text: "Preferência aplicada imediatamente."
        });
      });
    });

    /* --- Recebimento de pedido --- */
    $("#receiveModalBody").addEventListener("input", updateReceiveTotal);

    $("#receiveForm").addEventListener("submit", function (event) {
      event.preventDefault();
      if (confirmReceive()) closeModal("modal-receive");
    });

    /* --- Fecha a sidebar ao voltar para desktop --- */
    window.addEventListener("resize", function () {
      if (window.innerWidth > 1024) closeSidebar();
    });
  }

  /* ========================================================================
     14. INICIALIZAÇÃO
     ======================================================================== */

  function init() {
    applyIdentity();
    applyAccent(settings.accent);
    updateAlertDot();
    populateFilterSelects();
    bindEvents();
    navigateTo("dashboard");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
