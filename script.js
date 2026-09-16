/* ==========================================================================
   PetGest V0 — Protótipo navegável
   --------------------------------------------------------------------------
   Recorte do protótipo original: só as telas de Produtos (cadastro por
   código de barras) e Configurações (dados da loja) fazem parte do V0.
   Mesma base (HTML/CSS/JS vanilla, sem backend, dados em memória) e o mesmo
   leitor de código de barras original (BarcodeDetector nativo do navegador,
   com fallback para digitação manual quando a câmera/API não está
   disponível).

   Organização do arquivo:
     1. Utilitários
     2. Dados (mock em memória)
     3. Estado da aplicação
     4. Navegação entre telas
     5. Renderização — Produtos
     6. Cadastro / edição de produto
     7. Leitor de código de barras
     8. Modais
     9. Notificações (toasts)
    10. Sidebar mobile
    11. Renderização — Configurações
    12. Autenticação (tela de login)
    13. Eventos e inicialização
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

  var currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  function formatCurrency(value) { return currencyFormatter.format(Number(value) || 0); }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function icon(name, modifier) {
    return '<svg class="icon' + (modifier ? " " + modifier : "") +
      '" aria-hidden="true"><use href="#' + name + '"></use></svg>';
  }

  function plural(count, singular, pluralWord) { return count === 1 ? singular : pluralWord; }

  /** Fecha um EAN-13 calculando o dígito verificador dos 12 primeiros dígitos. */
  function ean13(base12) {
    var soma = 0;
    for (var i = 0; i < 12; i++) soma += Number(base12.charAt(i)) * (i % 2 === 0 ? 1 : 3);
    return base12 + String((10 - (soma % 10)) % 10);
  }

  /** Só dígitos, para comparar códigos vindos da câmera e da digitação. */
  function normalizeBarcode(value) { return String(value || "").replace(/\D/g, ""); }

  /** Minúsculas e sem acento — "ração" e "racao" encontram o mesmo produto. */
  function normalize(value) {
    return String(value).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  /** Destaca o trecho que casa com a busca, escapando cada pedaço. */
  function highlight(text, term) {
    var needle = normalize(String(term).trim());
    if (!needle) return escapeHtml(text);
    var from = normalize(text).indexOf(needle);
    if (from === -1) return escapeHtml(text);
    return escapeHtml(text.slice(0, from)) +
      "<mark>" + escapeHtml(text.slice(from, from + needle.length)) + "</mark>" +
      escapeHtml(text.slice(from + needle.length));
  }

  /* ========================================================================
     2. DADOS (mock em memória — recarregar a página restaura o estado)
     ======================================================================== */

  var settings = {
    storeName: "Pet Shop Amigo Fiel",
    email: "contato@petshopamigofiel.com.br",
    phone: "(63) 99845-1200"
  };

  var CATEGORIES = ["Ração", "Medicamento", "Higiene", "Acessórios", "Petiscos", "Jardinagem", "Agropecuário"];

  /* name, category, price */
  var PRODUCT_SEED = [
    ["Ração Golden Adultos Frango 15kg", "Ração", 119.9],
    ["Ração Premier Cães Filhotes 10,1kg", "Ração", 179.9],
    ["Ração GranPlus Gatos Castrados 10,1kg", "Ração", 134.9],
    ["Ração Whiskas Peixe 10,1kg", "Ração", 109.9],
    ["Ração Pedigree Adultos 15kg", "Ração", 99.9],
    ["Vermífugo Drontal Plus 10kg", "Medicamento", 59.9],
    ["Antipulgas Bravecto 20-40kg", "Medicamento", 199.9],
    ["Antipulgas Simparic 10-20kg", "Medicamento", 139.9],
    ["Shampoo Pet Clean Neutro 500ml", "Higiene", 27.9],
    ["Tapete Higiênico Super Seco 30un", "Higiene", 69.9],
    ["Areia Higiênica Pipicat 4kg", "Higiene", 21.9],
    ["Coleira Nylon Ajustável M", "Acessórios", 29.9],
    ["Guia Retrátil 5m", "Acessórios", 74.9],
    ["Comedouro Inox 500ml", "Acessórios", 32.9],
    ["Petisco Dental Fresh M 7un", "Petiscos", 32.9],
    ["Osso Natural Defumado", "Petiscos", 14.9],
    ["Sachê Whiskas Frango 85g", "Petiscos", 4.9],
    ["Adubo NPK 10-10-10 1kg", "Jardinagem", 17.9],
    ["Ração Galinhas Poedeiras 25kg", "Agropecuário", 118.0]
  ];

  var products = PRODUCT_SEED.map(function (row, index) {
    return {
      id: "p" + (index + 1),
      // 789 é o prefixo GS1 do Brasil; o corpo é derivado do índice — como no
      // protótipo original.
      barcode: ean13("789" + String(100000000 + index * 4517).slice(0, 9)),
      name: row[0],
      category: row[1],
      price: row[2]
    };
  });

  var productSeq = products.length;

  /**
   * Base de referência fictícia: códigos que NÃO estão no catálogo da loja.
   * Faz o papel de uma base de produtos do setor — ao ler um destes, o
   * formulário de cadastro se preenche sozinho (nome e categoria).
   */
  var REFERENCE_SEED = [
    ["7891000315507", "Ração Golden Fórmula Mini Bits 10,1kg", "Ração"],
    ["7896029083871", "Antipulgas NexGard 10-25kg", "Medicamento"],
    ["7896183201234", "Shampoo Sanol Dog Antipulgas 500ml", "Higiene"],
    ["7898927117016", "Tapete Higiênico Chalesco 80un", "Higiene"],
    ["7891234000019", "Brinquedo Kong Classic M", "Acessórios"],
    ["7896029087732", "Petisco Dentastix Médio 7un", "Petiscos"],
    ["7891107101019", "Sal Mineral Fosbovi 20 30kg", "Agropecuário"],
    ["7898132440015", "Vermífugo Ourofino Pet 10 comp.", "Medicamento"],
    ["7896004400112", "Substrato para Plantas 5kg", "Jardinagem"],
    ["7898657871011", "Coleira Antipulgas Seresto G", "Acessórios"]
  ];

  var referenceCatalog = REFERENCE_SEED.map(function (row) {
    return { barcode: row[0], name: row[1], category: row[2] };
  });

  function findProductByBarcode(code) {
    var alvo = normalizeBarcode(code);
    if (!alvo) return null;
    for (var i = 0; i < products.length; i++) {
      if (normalizeBarcode(products[i].barcode) === alvo) return products[i];
    }
    return null;
  }

  function findReference(code) {
    var alvo = normalizeBarcode(code);
    for (var i = 0; i < referenceCatalog.length; i++) {
      if (referenceCatalog[i].barcode === alvo) return referenceCatalog[i];
    }
    return null;
  }

  function findProduct(id) {
    for (var i = 0; i < products.length; i++) {
      if (products[i].id === id) return products[i];
    }
    return null;
  }

  /* ========================================================================
     3. ESTADO DA APLICAÇÃO
     ======================================================================== */

  var state = {
    view: "produtos",
    currentProductId: null,
    productFormMode: "edit",
    returnToProductForm: false,
    scannedProductId: null,
    openModalId: null,
    lastFocused: null,
    filters: { search: "", category: "all", sort: "name" }
  };

  var FILTER_DEFAULTS = { category: "all", sort: "name" };

  var VIEWS = {
    produtos: { title: "Produtos", subtitle: "Gerencie os produtos cadastrados" },
    configuracoes: { title: "Configurações", subtitle: "Dados do seu petshop" }
  };

  var VIEW_ELEMENTS = { produtos: "view-produtos", configuracoes: "view-configuracoes" };

  /* ========================================================================
     4. NAVEGAÇÃO
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

    var targetId = VIEW_ELEMENTS[viewKey];
    $$(".view").forEach(function (view) { view.classList.toggle("is-active", view.id === targetId); });

    if (viewKey === "produtos") renderProducts();
    if (viewKey === "configuracoes") renderSettings();

    closeSidebar();
    $("#content").scrollTop = 0;
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  /* ========================================================================
     5. RENDERIZAÇÃO — PRODUTOS
     ======================================================================== */

  /** Aplica busca, categoria e ordenação. */
  function filterProducts() {
    var f = state.filters;
    var term = normalize(f.search.trim());

    var list = products.filter(function (p) {
      if (f.category !== "all" && p.category !== f.category) return false;
      if (term && normalize(p.name).indexOf(term) === -1 &&
          normalize(p.barcode || "").indexOf(term) === -1) return false;
      return true;
    });

    var sorters = {
      name: function (a, b) { return a.name.localeCompare(b.name, "pt-BR"); },
      category: function (a, b) {
        return a.category.localeCompare(b.category, "pt-BR") || a.name.localeCompare(b.name, "pt-BR");
      }
    };

    return list.sort(sorters[f.sort] || sorters.name);
  }

  function renderProducts() {
    renderProductsTable();
    renderFilterState();
  }

  function recordCard(p, term) {
    return (
      '<li class="record record--tappable" data-product-id="' + p.id + '">' +
        '<div class="record__head">' +
          '<span class="record__icon">' + icon("i-box") + "</span>" +
          '<span class="record__ident">' +
            '<span class="record__title">' + highlight(p.name, term) + "</span>" +
            '<span class="record__meta">' + escapeHtml(p.category) +
              (p.barcode ? " · " + highlight(p.barcode, term) : "") + "</span>" +
          "</span>" +
          '<span class="record__chevron">' + icon("i-arrow-right", "icon--sm") + "</span>" +
        "</div>" +
        '<div class="record__foot"><strong>' + formatCurrency(p.price) + "</strong></div>" +
      "</li>"
    );
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

      body.innerHTML = '<tr><td colspan="5"><div class="table-empty">' + vazio + "</div></td></tr>";
      cards.innerHTML = '<li class="table-empty">' + vazio + "</li>";
    } else {
      cards.innerHTML = list.map(function (p) { return recordCard(p, term); }).join("");

      body.innerHTML = list.map(function (p) {
        return (
          '<tr data-product-id="' + p.id + '" tabindex="0">' +
            '<td class="col-product"><div class="cell-product">' +
              '<span class="cell-product__icon">' + icon("i-box") + "</span>" +
              "<span><span class=\"cell-product__name\">" + highlight(p.name, term) + "</span></span>" +
            "</div></td>" +
            '<td><span class="cell-category">' + escapeHtml(p.category) + "</span></td>" +
            "<td>" + (p.barcode
              ? ('<span class="cell-muted">' + highlight(p.barcode, term) + "</span>")
              : ('<span class="cell-muted">sem codigo</span>')) + "</td>" +
            '<td class="num"><span class="cell-strong">' + formatCurrency(p.price) + "</span></td>" +
            '<td class="right"><button type="button" class="btn btn--link" data-action="edit-product" data-product-id="' + p.id + '">' +
              "Editar</button></td>" +
          "</tr>"
        );
      }).join("");
    }

    $("#productsSummary").innerHTML = list.length
      ? "Mostrando <strong>" + list.length + "</strong> de <strong>" + products.length +
        "</strong> " + plural(products.length, "produto cadastrado", "produtos cadastrados") + "."
      : "Nenhum resultado para os filtros atuais.";
  }

  function renderFilterState() {
    var f = state.filters;
    if ($("#productSearch").value !== f.search) $("#productSearch").value = f.search;
    $("#productSearchClear").hidden = !f.search;
    $("#filterCategory").value = f.category;
    $("#filterSort").value = f.sort;

    var active = Object.keys(FILTER_DEFAULTS).filter(function (key) { return f[key] !== FILTER_DEFAULTS[key]; }).length;
    var badge = $("#filterCount");
    badge.textContent = active;
    badge.hidden = active === 0;
  }

  function setFilter(key, value) { state.filters[key] = value; renderProducts(); }

  function clearFilters() {
    state.filters.search = "";
    state.filters.category = FILTER_DEFAULTS.category;
    state.filters.sort = FILTER_DEFAULTS.sort;
    renderProducts();
    $("#productSearch").focus();
  }

  function populateFilterSelects() {
    $("#filterCategory").innerHTML =
      '<option value="all">Todas as categorias</option>' +
      CATEGORIES.map(function (c) { return '<option value="' + c + '">' + c + "</option>"; }).join("");
  }

  /* ========================================================================
     6. CADASTRO / EDIÇÃO DE PRODUTO
     ======================================================================== */

  /** Um único formulário atende cadastro e edição. */
  function openProductForm(mode, productId) {
    var isCreate = mode === "create";
    var p = isCreate ? null : findProduct(productId);
    if (!isCreate && !p) return;

    state.productFormMode = mode;
    state.currentProductId = isCreate ? null : p.id;

    $("#editCategory").innerHTML = CATEGORIES.map(function (c) {
      return '<option value="' + c + '">' + c + "</option>";
    }).join("");

    $("#editModalTitle").textContent = isCreate ? "Cadastrar produto" : "Editar produto";
    $("#editSubmitLabel").textContent = isCreate ? "Cadastrar produto" : "Salvar alterações";
    $("#editModalMeta").textContent = isCreate
      ? "Adicione um item ao catálogo da loja"
      : p.category;

    if (isCreate) {
      $("#editName").value = "";
      $("#editCategory").value = CATEGORIES[0];
      $("#editPrice").value = "";
      $("#editBarcode").value = "";
    } else {
      $("#editName").value = p.name;
      $("#editCategory").value = p.category;
      $("#editPrice").value = p.price;
      $("#editBarcode").value = p.barcode || "";
    }

    hideError("#editError");
    openModal("modal-edit");
  }

  function submitProductForm() {
    return state.productFormMode === "create" ? createProduct() : saveProductEdit();
  }

  function createProduct() {
    var name = $("#editName").value.trim();
    var category = $("#editCategory").value;
    var barcode = normalizeBarcode($("#editBarcode").value);
    var price = parseFloat($("#editPrice").value);

    if (!name) {
      showError("#editError", "Informe o nome do produto.");
      $("#editName").focus();
      return false;
    }
    if (barcode && findProductByBarcode(barcode)) {
      showError("#editError",
        "O código de barras " + barcode + " já pertence a " + findProductByBarcode(barcode).name + ".");
      $("#editBarcode").focus();
      return false;
    }
    if (isNaN(price) || price < 0) {
      showError("#editError", "Informe o preço de venda.");
      $("#editPrice").focus();
      return false;
    }

    var product = { id: "p" + ++productSeq, barcode: barcode, name: name, category: category, price: price };
    products.push(product);

    hideError("#editError");
    renderProducts();

    showToast({ type: "success", title: "Produto cadastrado", text: product.name });
    return true;
  }

  function saveProductEdit() {
    var p = findProduct(state.currentProductId);
    if (!p) return false;

    var name = $("#editName").value.trim();
    var price = parseFloat($("#editPrice").value);

    if (!name) {
      showError("#editError", "Informe o nome do produto.");
      return false;
    }
    if (isNaN(price) || price < 0) {
      showError("#editError", "O preço de venda deve ser um valor válido.");
      return false;
    }

    var novoBarcode = normalizeBarcode($("#editBarcode").value);
    var donoDoCodigo = novoBarcode ? findProductByBarcode(novoBarcode) : null;
    if (donoDoCodigo && donoDoCodigo.id !== p.id) {
      showError("#editError", "O código de barras " + novoBarcode + " já pertence a " + donoDoCodigo.name + ".");
      return false;
    }

    p.name = name;
    p.category = $("#editCategory").value;
    p.price = price;
    p.barcode = novoBarcode;

    hideError("#editError");
    renderProducts();

    showToast({ type: "success", title: "Produto atualizado", text: p.name });
    return true;
  }

  /* ========================================================================
     7. LEITOR DE CÓDIGO DE BARRAS (protótipo visual)
     --------------------------------------------------------------------------
     Este protótipo é só de tela: não liga a câmera de verdade. Em vez disso
     reproduz a experiência visual de apontar a câmera para um código de
     barras — moldura de mira e linha de varredura (ambas já existiam no
     protótipo original) sobre uma etiqueta de produto com um código de
     barras desenhado — e, depois de um instante, "detecta" um código de
     demonstração, reaproveitando a mesma lógica de desfecho (produto já
     cadastrado / código da base de referência / código desconhecido) que
     valeria para uma leitura de verdade.

     Para ligar a câmera de verdade depois, basta trocar o corpo de
     iniciarCamera() por getUserMedia + BarcodeDetector: o resto do fluxo
     (aplicarCodigo, estados do modal, entrada manual) não muda.
     ======================================================================== */

  var scanner = { askingId: null, loopId: null };

  // A cada abertura do leitor, alterna entre os três desfechos possíveis,
  // só para a demonstração passear pelos três casos.
  var DEMO_SCAN_CODES = [
    products[0].barcode,                              // já cadastrado
    REFERENCE_SEED[0][0],                              // base de referência
    ean13("789" + String(900000001).slice(0, 9))       // desconhecido
  ];
  var demoScanIndex = 0;

  /** Desenha uma etiqueta de produto com um código de barras (barras com
   *  largura derivada dos próprios dígitos, só para parecer autêntico). */
  function mockBarcodeMarkup(code) {
    var bars = String(code).split("").map(function (d, i) {
      var w = 2 + (Number(d) % 4) + (i % 2);
      return '<span style="width:' + w + 'px"></span>';
    }).join("");

    return (
      '<div class="mock-package">' +
        '<div class="mock-barcode-bars">' + bars + "</div>" +
        '<span class="mock-barcode-code">' + escapeHtml(code) + "</span>" +
      "</div>"
    );
  }

  function openScanner() {
    state.returnToProductForm = state.openModalId === "modal-edit";
    $("#scannerManualInput").value = "";
    hideError("#scannerError");
    openModal("modal-scanner");
    iniciarCamera();
  }

  /** Simula a liberação da câmera e, em seguida, a leitura do código. */
  function iniciarCamera() {
    setScannerState("asking", "Liberando a câmera…", "Confirme o acesso à câmera para ler o código.");

    scanner.askingId = window.setTimeout(function () {
      var code = DEMO_SCAN_CODES[demoScanIndex % DEMO_SCAN_CODES.length];
      demoScanIndex++;

      $("#scannerVideo").innerHTML = mockBarcodeMarkup(code);
      setScannerState("scanning");

      scanner.loopId = window.setTimeout(function () { aplicarCodigo(code, true); }, 1500);
    }, 550);
  }

  function pararCamera() {
    window.clearTimeout(scanner.askingId);
    window.clearTimeout(scanner.loopId);
    scanner.askingId = null;
    scanner.loopId = null;
  }

  function setScannerState(nextState, title, text) {
    $("#scanner").setAttribute("data-state", nextState);
    if (title) $("#scannerNoticeTitle").textContent = title;
    if (text) $("#scannerNoticeText").textContent = text;
    $("#scannerSubtitle").textContent = nextState === "scanning"
      ? "Aponte a câmera para o código do produto"
      : "Escaneie com a câmera ou digite o código";
  }

  /**
   * Três desfechos para um código lido:
   *   1. já existe no catálogo  -> avisa e oferece editar o produto
   *   2. está na base de referência -> preenche nome e categoria
   *   3. desconhecido -> preenche só o código
   */
  function aplicarCodigo(codigo, viaCamera) {
    var limpo = normalizeBarcode(codigo);

    if (limpo.length < 8) {
      showError("#scannerError", "Código inválido: informe ao menos 8 dígitos.");
      return false;
    }

    if (viaCamera && navigator.vibrate) navigator.vibrate(60);

    hideError("#scannerError");
    $("#scannerResultCode").textContent = limpo;

    var existente = findProductByBarcode(limpo);
    var resultado = $("#scanner").querySelector(".scanner__result");

    if (existente) {
      state.scannedProductId = existente.id;
      resultado.classList.add("scanner__result--info");
      $("#scannerResultIcon").innerHTML = icon("i-alert");
      $("#scannerResultTitle").textContent = "Produto já cadastrado";
      $("#scannerResultText").textContent = existente.name + " · " + formatCurrency(existente.price) + ".";

      setScannerState("found");
      $("#scannerOpenProduct").hidden = false;
      return true;
    }

    state.scannedProductId = null;
    resultado.classList.remove("scanner__result--info");
    $("#scannerResultIcon").innerHTML = icon("i-check-circle");

    var referencia = findReference(limpo);
    $("#editBarcode").value = limpo;

    if (referencia) {
      $("#editName").value = referencia.name;
      $("#editCategory").value = referencia.category;
      $("#scannerResultTitle").textContent = "Produto identificado";
      $("#scannerResultText").textContent = referencia.name + " — nome e categoria preenchidos.";
    } else {
      $("#scannerResultTitle").textContent = "Código aplicado";
      $("#scannerResultText").textContent = "Produto novo: complete os dados do cadastro.";
    }

    setScannerState("found");

    window.setTimeout(function () {
      if (state.openModalId === "modal-scanner") closeModal("modal-scanner");
      showToast({
        type: "success",
        title: referencia ? "Produto identificado" : "Código aplicado",
        text: referencia
          ? referencia.name + " veio da base de referência."
          : "Código " + limpo + " preenchido no cadastro."
      });
    }, 1100);

    return true;
  }

  /* ========================================================================
     8. MODAIS
     ======================================================================== */

  function openModal(id) {
    var modal = document.getElementById(id);
    if (!modal) return;

    if (state.openModalId && state.openModalId !== id) hideModal(state.openModalId);
    if (!state.openModalId) state.lastFocused = document.activeElement;

    modal.hidden = false;
    state.openModalId = id;
    document.body.classList.add("is-locked");

    var target = modal.querySelector("[data-autofocus]") || modal.querySelector(".modal__dialog");
    if (target) {
      if (!target.hasAttribute("data-autofocus")) target.setAttribute("tabindex", "-1");
      window.setTimeout(function () { target.focus(); }, 40);
    }
  }

  function hideModal(id) { var modal = document.getElementById(id); if (modal) modal.hidden = true; }

  function closeModal(id) {
    var target = id || state.openModalId;
    if (!target) return;

    hideModal(target);
    state.openModalId = null;
    document.body.classList.remove("is-locked");

    if (target === "modal-scanner") pararCamera();

    var backToForm = state.returnToProductForm && target === "modal-scanner";
    state.returnToProductForm = false;

    if (backToForm) { openModal("modal-edit"); return; }

    if (state.lastFocused && typeof state.lastFocused.focus === "function") {
      state.lastFocused.focus();
      state.lastFocused = null;
    }
  }

  /* ========================================================================
     9. NOTIFICAÇÕES (TOASTS)
     ======================================================================== */

  var TOAST_ICONS = { success: "i-check-circle", warning: "i-alert", danger: "i-ban", info: "i-bell" };

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
      window.setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 200);
    }, 4200);
  }

  function showError(selector, message) {
    var el = $(selector);
    if (!el) return;
    el.innerHTML = icon("i-alert", "icon--sm") + "<span>" + escapeHtml(message) + "</span>";
    el.hidden = false;
  }

  function hideError(selector) { var el = $(selector); if (el) el.hidden = true; }

  /* ========================================================================
     10. SIDEBAR MOBILE
     ======================================================================== */

  function openSidebar() {
    $("#sidebar").classList.add("is-open");
    $("#sidebarBackdrop").hidden = false;
    $("#menuToggle").setAttribute("aria-expanded", "true");
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
     11. RENDERIZAÇÃO — CONFIGURAÇÕES
     ======================================================================== */

  function initials(text) {
    return String(text).trim().split(/\s+/)
      .filter(function (w) { return w.length > 2; })
      .slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); })
      .join("") || "PG";
  }

  /** Reflete os dados da loja na barra lateral. */
  function applyIdentity() {
    $("#storeChipName").textContent = settings.storeName;
    $("#storeAvatar").textContent = initials(settings.storeName);
  }

  function renderSettings() {
    $("#setStoreName").value = settings.storeName;
    $("#setEmail").value = settings.email;
    $("#setPhone").value = settings.phone;
  }

  function saveStoreSettings() {
    var name = $("#setStoreName").value.trim();
    var email = $("#setEmail").value.trim();
    var phone = $("#setPhone").value.trim();

    if (!name || !email || !phone) {
      showError("#storeError", "Nome, e-mail e telefone são obrigatórios.");
      return;
    }

    settings.storeName = name;
    settings.email = email;
    settings.phone = phone;

    hideError("#storeError");
    applyIdentity();

    showToast({ type: "success", title: "Dados da loja salvos", text: settings.storeName });
  }

  /* ========================================================================
     12. AUTENTICAÇÃO (TELA DE LOGIN — protótipo visual)
     --------------------------------------------------------------------------
     Mesma ideia do leitor de código de barras: só a experiência de tela.
     Não há verificação de credenciais nem sessão de verdade — qualquer
     e-mail (em formato válido) e qualquer senha preenchida entram, só com
     uma pequena espera simulada para parecer uma chamada de verdade.
     ======================================================================== */

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var loginTimeoutId = null;

  function openLoginScreen() {
    var screen = $("#authScreen");
    window.clearTimeout(loginTimeoutId);
    screen.hidden = false;
    screen.classList.remove("is-leaving");

    $("#loginForm").reset();
    $("#loginRemember").checked = true;
    if ($("#loginPassword").type === "text") togglePasswordVisibility();
    hideError("#loginError");
    setLoginLoading(false);

    window.setTimeout(function () { $("#loginEmail").focus(); }, 60);
  }

  function closeLoginScreen() {
    var screen = $("#authScreen");
    screen.classList.add("is-leaving");
    window.setTimeout(function () { screen.hidden = true; }, 260);
  }

  function setLoginLoading(isLoading) {
    $("#loginSubmit").disabled = isLoading;
    $("#loginSubmitLabel").textContent = isLoading ? "Entrando…" : "Entrar";
  }

  function submitLogin() {
    var email = $("#loginEmail").value.trim();
    var password = $("#loginPassword").value;

    if (!email || !EMAIL_RE.test(email)) {
      showError("#loginError", "Informe um e-mail válido.");
      $("#loginEmail").focus();
      return;
    }
    if (!password) {
      showError("#loginError", "Informe sua senha.");
      $("#loginPassword").focus();
      return;
    }

    hideError("#loginError");
    setLoginLoading(true);

    // Sem backend: qualquer e-mail/senha válidos entram — só simula a
    // espera de uma chamada de autenticação de verdade.
    loginTimeoutId = window.setTimeout(function () {
      setLoginLoading(false);
      closeLoginScreen();
      showToast({ type: "success", title: "Bem-vindo(a) de volta", text: settings.storeName });
    }, 700);
  }

  function togglePasswordVisibility() {
    var input = $("#loginPassword");
    var btn = $("#togglePassword");
    var showing = input.type === "text";

    input.type = showing ? "password" : "text";
    btn.setAttribute("aria-pressed", String(!showing));
    btn.setAttribute("aria-label", showing ? "Mostrar senha" : "Ocultar senha");
    btn.innerHTML = icon(showing ? "i-eye" : "i-eye-off", "icon--sm");
  }

  function logout() {
    window.clearTimeout(loginTimeoutId);
    closeModal();
    closeSidebar();
    openLoginScreen();
  }

  /* ========================================================================
     13. EVENTOS E INICIALIZAÇÃO
     ======================================================================== */

  function handleAction(action, element) {
    switch (action) {
      case "scan-barcode": openScanner(); break;
      case "scanner-retry": iniciarCamera(); break;
      case "scanner-open-product": {
        var alvo = state.scannedProductId;
        state.returnToProductForm = false;
        closeModal("modal-scanner");
        if (alvo) openProductForm("edit", alvo);
        break;
      }
      case "edit-product":
        openProductForm("edit", element.getAttribute("data-product-id"));
        break;
      case "new-product":
        openProductForm("create");
        break;
      case "toggle-filters": {
        var panel = $("#filterPanel");
        panel.hidden = !panel.hidden;
        $("#filterToggle").setAttribute("aria-expanded", String(!panel.hidden));
        if (!panel.hidden) $("#filterCategory").focus();
        break;
      }
      case "clear-filters": clearFilters(); break;
      case "toggle-password": togglePasswordVisibility(); break;
      case "forgot-password":
        showToast({
          type: "info",
          title: "Recuperação de senha",
          text: "Funcionalidade fora do escopo deste protótipo visual."
        });
        break;
      case "logout": logout(); break;
      default: break;
    }
    void element;
  }

  function bindEvents() {
    document.addEventListener("click", function (event) {
      var closer = event.target.closest("[data-close-modal]");
      if (closer) { closeModal(); return; }

      var actionEl = event.target.closest("[data-action]");
      if (actionEl) { handleAction(actionEl.getAttribute("data-action"), actionEl); return; }

      var viewEl = event.target.closest("[data-view]");
      if (viewEl) { navigateTo(viewEl.getAttribute("data-view")); return; }

      var productEl = event.target.closest("[data-product-id]");
      if (productEl) openProductForm("edit", productEl.getAttribute("data-product-id"));
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        if (state.openModalId) closeModal();
        else if ($("#sidebar").classList.contains("is-open")) closeSidebar();
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        var row = event.target.closest("tr[data-product-id]");
        if (row && event.target === row) {
          event.preventDefault();
          openProductForm("edit", row.getAttribute("data-product-id"));
        }
      }
    });

    $("#menuToggle").addEventListener("click", toggleSidebar);
    $("#sidebarBackdrop").addEventListener("click", closeSidebar);
    $("#sidebarClose").addEventListener("click", closeSidebar);

    $("#editForm").addEventListener("submit", function (event) {
      event.preventDefault();
      if (submitProductForm()) closeModal("modal-edit");
    });

    $("#scannerManualForm").addEventListener("submit", function (event) {
      event.preventDefault();
      var digitado = $("#scannerManualInput").value;
      if (!normalizeBarcode(digitado)) {
        showError("#scannerError", "Informe o código de barras para continuar.");
        $("#scannerManualInput").focus();
        return;
      }
      aplicarCodigo(digitado, false);
    });

    $("#productSearch").addEventListener("input", function () { setFilter("search", this.value); });
    $("#productSearch").addEventListener("keydown", function (event) {
      if (event.key === "Escape" && this.value) { event.stopPropagation(); setFilter("search", ""); }
    });
    $("#productSearchClear").addEventListener("click", function () {
      setFilter("search", "");
      $("#productSearch").focus();
    });

    $("#filterCategory").addEventListener("change", function () { setFilter("category", this.value); });
    $("#filterSort").addEventListener("change", function () { setFilter("sort", this.value); });

    $("#storeForm").addEventListener("submit", function (event) {
      event.preventDefault();
      saveStoreSettings();
    });

    $("#loginForm").addEventListener("submit", function (event) {
      event.preventDefault();
      submitLogin();
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 1024) closeSidebar();
    });
  }

  function init() {
    applyIdentity();
    populateFilterSelects();
    bindEvents();
    navigateTo("produtos");
    openLoginScreen();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
