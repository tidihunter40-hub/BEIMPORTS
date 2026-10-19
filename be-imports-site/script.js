import { filterProducts, filterShirts, filterShoes, filterCaps, isThaiShirt, shirtUnitPrice, shirtSizeStock, shoeSizeStock, capVariantStock, capColors, bermudaVariantStock, THAI_SHIRT_PRICES } from './catalog-filter.js?v=7';
import { bermudasPage, renderBermudaResults, bermudaDetailPage, updateBermudaDetail } from './bermudas-page.js?v=3';
import { offersPage as offersCatalogPage, renderOfferResults } from './ofertas-page.js?v=2';
import { perfumesPage, renderPerfumeResults, perfumeDetailPage, perfumeVolumeStock, updatePerfumeDetail } from './perfumes-page.js?v=1';
import { electronicsPage, renderElectronicResults, electronicDetailPage, electronicVariantStock, updateElectronicDetail } from './eletronicos-page.js?v=2';

const app = document.querySelector('#conteudo');
const nav = document.querySelector('#primary-nav');
const menuButton = document.querySelector('.menu-toggle');
let catalog = { products: [], categories: [], shirtSubcategories: [], settings: {} };
const cartKey = 'be-imports-cart-v1';
let cart = (() => { try { const value = JSON.parse(localStorage.getItem(cartKey) || '[]'); return Array.isArray(value) ? value.filter(item => item && typeof item.productId === 'string' && Number.isSafeInteger(item.quantity) && item.quantity > 0).slice(0, 50) : []; } catch { return []; } })();
let customerDraft = { name: '', city: '', postalCode: '', note: '' };
const cartCount = () => cart.reduce((sum, item) => sum + item.quantity, 0);
function saveCart() { try { localStorage.setItem(cartKey, JSON.stringify(cart)); } catch {} }

export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const products = () => catalog.products || [];
const categories = () => catalog.categories || [];
const offers = () => products().filter(p => Number(p.compareAt) > Number(p.price));
const discount = p => Math.round((1 - p.price / p.compareAt) * 100);
const isDemoProduct = p => String(p.description || '').startsWith('[DEMO]');
const isElectronic = p => ['Eletrônicos', 'Fones de ouvido'].includes(p?.category);
const electronicProducts = () => products().filter(product => isElectronic(product) && product.status === 'published');
const homeCategoryNames = ['Camisas', 'Tênis', 'Bonés', 'Bermudas', 'Perfumes', 'Eletrônicos', 'Acessórios'];
const homeCategoryImages = {
  Camisas: 'camisas', 'Tênis': 'tenis', 'Bonés': 'bones', Bermudas: 'bermudas',
  Perfumes: 'perfumes', 'Eletrônicos': 'eletronicos', 'Acessórios': 'acessorios'
};
const homeCategories = () => homeCategoryNames.map(name => categories().find(category => category.name === name)).filter(Boolean);
const selectedHomeCategory = () => {
  const name = new URLSearchParams(location.search).get('categoria');
  return homeCategoryNames.includes(name) ? name : '';
};
const homeCategoryHref = name => `/?categoria=${encodeURIComponent(name)}`;
const currentNavKey = () => {
  if (location.pathname === '/') return selectedHomeCategory() || 'inicio';
  if (location.pathname === '/ofertas') return 'ofertas';
  if (location.pathname === '/produtos') {
    const name = new URLSearchParams(location.search).get('categoria');
    return homeCategoryNames.includes(name) ? name : '';
  }
  if (location.pathname.startsWith('/produto/')) {
    const slug = decodeURIComponent(location.pathname.slice(9));
    const name = products().find(product => product.slug === slug)?.category;
    return name === 'Fones de ouvido' ? 'Eletrônicos' : homeCategoryNames.includes(name) ? name : '';
  }
  return '';
};
const contactUrl = (message = 'Olá! Gostaria de falar com a BE IMPORTS.') => catalog.settings.whatsapp ? `https://wa.me/${catalog.settings.whatsapp}?text=${encodeURIComponent(message)}` : '';
const mapsUrl = () => catalog.settings.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(catalog.settings.address)}` : '';
const instagram = () => catalog.settings.instagram || 'https://www.instagram.com/beimportsreserva/';

function closeMenu() {
  nav.classList.remove('is-open'); menuButton.setAttribute('aria-expanded', 'false'); menuButton.setAttribute('aria-label', 'Abrir menu');
}
function activeNav() {
  const active = currentNavKey();
  document.querySelectorAll('[data-nav]').forEach(link => {
    const selected = Boolean(active) && link.dataset.nav === active;
    link.classList.toggle('is-current', selected);
    if (selected) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
}
function updateHeader() {
  activeNav();
  const supportLabel = document.querySelector('.home-header-assurances span:last-child')?.lastChild;
  if (supportLabel) supportLabel.textContent = catalog.settings.whatsapp ? 'via WhatsApp' : 'da loja';
  const cartBadge = document.querySelector('#header-cart-count');
  cartBadge.textContent = String(cartCount());
  cartBadge.parentElement.setAttribute('aria-label', `Ver carrinho com ${cartCount()} ${cartCount() === 1 ? 'item' : 'itens'}`);
  document.querySelector('#floating-contact').innerHTML = contactUrl() ? `<a class="whatsapp-float" href="${contactUrl()}" target="_blank" rel="noopener noreferrer" aria-label="Conversar pelo WhatsApp">WhatsApp</a>` : '';
}
function productCard(p) {
  return `<article class="product-card">
    <a class="product-image" href="/produto/${encodeURIComponent(p.slug)}" data-link><img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" loading="lazy" decoding="async"></a>
    ${p.compareAt > p.price ? `<span class="discount-tag">−${discount(p)}%</span>` : ''}
    <div class="product-info"><span class="product-category">${escapeHtml(p.category)}</span>${isDemoProduct(p) ? '<span class="demo-product-label">Produto demonstrativo</span>' : ''}<h3><a href="/produto/${encodeURIComponent(p.slug)}" data-link>${escapeHtml(p.name)}</a></h3>
    <div class="price-line">${p.compareAt > p.price ? `<del>${money(p.compareAt)}</del>` : ''}<strong>${money(p.price)}</strong></div>
    <span class="stock-status ${p.stock > 0 ? '' : 'out'}">${isDemoProduct(p) ? 'Indisponível para compra' : p.stock > 0 ? 'Disponível' : 'Indisponível'}</span>
    <a class="text-action" href="/produto/${encodeURIComponent(p.slug)}" data-link>VER PRODUTO <span aria-hidden="true">↗</span></a></div>
  </article>`;
}
function emptyState(title, text, link = '') {
  return `<div class="empty-state"><span class="empty-mark">BE</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(text)}</p>${link ? `<a class="button gold" href="${link}" data-link>Explorar produtos <span aria-hidden="true">↗</span></a>` : ''}</div>`;
}
function homeFooter() {
  const categoryLinks = homeCategories().map(({ name }) => `<a href="${homeCategoryHref(name)}" data-link>${escapeHtml(name)}</a>`).join('');
  const serviceLinks = [
    catalog.settings.whatsapp ? `<a href="${escapeHtml(contactUrl())}" target="_blank" rel="noopener noreferrer">WhatsApp ↗</a>` : '',
    catalog.settings.instagram ? `<a href="${escapeHtml(catalog.settings.instagram)}" target="_blank" rel="noopener noreferrer">Instagram ↗</a>` : '',
    catalog.settings.address ? `<a href="${escapeHtml(mapsUrl())}" target="_blank" rel="noopener noreferrer">${escapeHtml(catalog.settings.address)}</a>` : '',
    catalog.settings.hours ? `<span class="home-footer-hours">${escapeHtml(catalog.settings.hours)}</span>` : ''
  ].filter(Boolean).join('');
  return `<footer class="home-footer"><div class="wrap home-footer-grid">
    <div class="home-footer-brand"><img src="/assets/logo-original.webp" alt="BE IMPORTS" width="1774" height="887" loading="lazy"><p>Moda, perfumes, tecnologia e acessórios em um só lugar. Com você, sempre.</p></div>
    <nav aria-label="Institucional"><h3>Institucional</h3><a href="/" data-link>Início</a><a href="/nossa-loja" data-link>Nossa Loja</a><a href="/contato" data-link>Contato</a><a href="/#ofertas" data-link>Produtos</a></nav>
    <nav aria-label="Categorias da página inicial"><h3>Categorias</h3>${categoryLinks || '<span>Categorias em breve.</span>'}</nav>
    <div class="home-footer-service"><h3>Atendimento</h3>${serviceLinks || '<span>Informações em atualização.</span>'}</div>
  </div><div class="wrap home-footer-bottom"><span>© ${new Date().getFullYear()} BE IMPORTS. Todos os direitos reservados.</span><span>Ribeira do Pombal, BA</span></div></footer>`;
}
function homeCategoryCards() {
  return homeCategories().map(category => {
    const label = escapeHtml(category.name);
    const href = homeCategoryHref(category.name);
    const image = `/assets/home-reference/categoria-${homeCategoryImages[category.name]}.png`;
    return `<a class="home-category-card" href="${href}" data-link aria-label="Explorar ${label}">
      <span class="home-category-image"><img src="${image}" alt="" loading="lazy" decoding="async"></span>
      <span class="home-category-info"><strong>${label}</strong><span class="home-category-action">VER PRODUTOS <span aria-hidden="true">→</span></span></span>
    </a>`;
  }).join('');
}
function homeOfferCard(product) {
  const href = `/produto/${encodeURIComponent(product.slug)}`;
  return `<article class="home-offer-card">
    <a class="home-offer-image" href="${href}" data-link aria-label="Ver demonstração de ${escapeHtml(product.name)}"><img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy" decoding="async"></a>
    <span class="home-offer-discount">−${discount(product)}%</span>
    <div class="home-offer-info"><span class="home-demo-label">Produto demonstrativo</span><h3><a href="${href}" data-link>${escapeHtml(product.name)}</a></h3><div class="home-offer-price"><del>${money(product.compareAt)}</del><strong>${money(product.price)}</strong></div><a class="home-offer-action" href="${href}" data-link>VER DEMONSTRAÇÃO <span aria-hidden="true">→</span></a></div>
  </article>`;
}
function publicNav() {
  const active = currentNavKey();
  const items = [
    ['inicio', 'Início', '/'],
    ...homeCategoryNames.map(name => [name, name, homeCategoryHref(name)]),
    ['ofertas', 'Ofertas', '/ofertas']
  ];
  return `<nav class="home-nav" aria-label="Categorias e ofertas"><div class="wrap home-nav-inner">${items.map(([key, label, href]) => `<a href="${href}" data-link class="${active === key ? 'is-current' : ''}" ${active === key ? 'aria-current="page"' : ''}>${escapeHtml(label)}</a>`).join('')}</div></nav>`;
}
function homeHero(selectedCategory, serviceText) {
  return `<section class="home-hero"><div class="home-visual"><img src="/assets/home-reference/hero-fachada-enviada.webp" alt="Fachada da BE IMPORTS" width="1150" height="776" fetchpriority="high"></div><div class="wrap home-hero-grid"><div class="home-copy"><span class="eyebrow">MODA <b>•</b> PERFUMES <b>•</b> TECNOLOGIA <b>•</b> ACESSÓRIOS</span><h1>BE IMPORTS</h1><p class="hero-lead">Seu estilo, suas escolhas,<br>seu lugar.</p><p class="hero-description">Roupas, perfumes, tecnologia, acessórios e muito mais, com qualidade, bom preço e atendimento que você confia.</p><div class="hero-actions"><a class="button gold" href="${selectedCategory ? `${homeCategoryHref(selectedCategory)}#ofertas` : '/#ofertas'}" data-link>VER PRODUTOS <span aria-hidden="true">→</span></a></div><div class="hero-points"><span><svg class="icon"><use href="#icon-truck"></use></svg>Qualidade e<br>variedade</span><span><svg class="icon"><use href="#icon-shield"></use></svg>Compra<br>segura</span><span><svg class="icon"><use href="#icon-headset"></use></svg>Atendimento<br>${serviceText}</span></div></div></div></section>`;
}
function home() {
  const selectedCategory = selectedHomeCategory();
  if (selectedCategory === 'Camisas') return shirtsPage();
  if (selectedCategory === 'Tênis') return shoesPage();
  if (selectedCategory === 'Bonés') return capsPage();
  if (selectedCategory === 'Bermudas') return bermudasPage(products().filter(product => product.category === 'Bermudas' && product.status === 'published'), new URLSearchParams(location.search), homeFooter());
  if (selectedCategory === 'Perfumes') return perfumesPage(products().filter(product => product.category === 'Perfumes' && product.status === 'published'), new URLSearchParams(location.search), homeFooter());
  if (selectedCategory === 'Eletrônicos') return electronicsPage(electronicProducts(), new URLSearchParams(location.search), homeFooter());
  const promoted = offers().filter(isDemoProduct).filter(product => !selectedCategory || product.category === selectedCategory).slice(0, 6);
  const serviceText = catalog.settings.whatsapp ? 'via WhatsApp' : 'da loja';
  return `${homeHero(selectedCategory, serviceText)}
  <section class="home-categories"><div class="wrap"><div class="home-section-heading"><div><span class="eyebrow">CATEGORIAS</span><h2>Tudo o que você precisa em um só lugar.</h2></div><a class="home-section-link" href="/categorias" data-link>VER TODAS AS CATEGORIAS <span aria-hidden="true">→</span></a></div>${homeCategories().length ? `<div class="home-category-grid">${homeCategoryCards()}</div>` : emptyState('Categorias em breve', 'As categorias aparecerão aqui quando forem cadastradas.')}</div></section>
  <section class="home-offers" id="ofertas"><div class="wrap"><div class="home-section-heading"><div><span class="eyebrow">${selectedCategory ? 'CATEGORIA SELECIONADA' : 'OFERTAS ESPECIAIS'}</span><h2>${selectedCategory ? `${escapeHtml(selectedCategory)} <em>em destaque</em>` : 'Produtos em <em>promoção</em>'}</h2></div><a class="home-section-link" href="${selectedCategory ? '/#ofertas' : '/ofertas'}" data-link>VER TODAS AS OFERTAS <span aria-hidden="true">→</span></a></div>${promoted.length ? `<div class="home-offer-grid${selectedCategory ? ' is-filtered' : ''}">${promoted.map(homeOfferCard).join('')}</div>` : emptyState('Nenhum produto nesta categoria', 'Confira as outras categorias ou veja todas as ofertas.', '/#ofertas')}</div></section>
  <div class="home-trust"><div class="wrap home-trust-grid"><span><svg class="icon"><use href="#icon-truck"></use></svg>Qualidade e variedade</span><span><svg class="icon"><use href="#icon-shield"></use></svg>Compra segura</span><span><svg class="icon"><use href="#icon-headset"></use></svg>Atendimento ${serviceText}</span></div></div>${homeFooter()}`;
}
const shirtProducts = () => products().filter(product => product.category === 'Camisas' && product.status === 'published');
function updatePerfumeQuery(changes) {
  const query = new URLSearchParams(location.search);
  query.set('categoria', 'Perfumes');
  for (const [key, value] of Object.entries(changes)) value ? query.set(key, value) : query.delete(key);
  history.replaceState({}, '', `/?${query}#catalogo-perfumes`);
  renderPerfumeResults(products().filter(product => product.category === 'Perfumes' && product.status === 'published'), query);
  document.querySelectorAll('[data-perfume-group]').forEach(button => {
    const active = button.dataset.perfumeGroup === (query.get('grupo') || '');
    button.classList.toggle('is-current', active);
    button.setAttribute('aria-pressed', String(active));
  });
}
function updateElectronicQuery(changes) {
  const query = new URLSearchParams(location.search);
  query.set('categoria', 'Eletrônicos');
  for (const [key, value] of Object.entries(changes)) value ? query.set(key, value) : query.delete(key);
  history.replaceState({}, '', `/?${query}#catalogo-eletronicos`);
  renderElectronicResults(electronicProducts(), query);
  const typeSelect = document.querySelector('#electronic-filters [name="tipo"]');
  if (typeSelect) typeSelect.value = query.get('tipo') || '';
  document.querySelectorAll('[data-electronic-type]').forEach(button => {
    const active = button.dataset.electronicType === (query.get('tipo') || '');
    button.classList.toggle('is-current', active);
    button.setAttribute('aria-pressed', String(active));
  });
}
function shirtCard(product) {
  const price = shirtUnitPrice(product);
  const sizes = (product.sizes || []).map(size => `<span class="${shirtSizeStock(product, size) || isDemoProduct(product) ? '' : 'is-unavailable'}" title="${shirtSizeStock(product, size) ? `${shirtSizeStock(product, size)} em estoque` : isDemoProduct(product) ? 'Tamanho ilustrativo' : 'Esgotado'}">${escapeHtml(size)}</span>`).join('');
  return `<article class="shirt-card"><a class="shirt-card-image" href="/produto/${encodeURIComponent(product.slug)}" data-link><img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy" decoding="async"></a>${product.compareAt > price && !isThaiShirt(product) ? `<span class="shirt-sale">−${Math.round((1 - price / product.compareAt) * 100)}%</span>` : ''}<div class="shirt-card-copy">${product.subcategory ? `<span class="shirt-card-kind">${escapeHtml(product.subcategory)}</span>` : ''}${isDemoProduct(product) ? '<span class="demo-product-label">Produto demonstrativo</span>' : ''}<h3><a href="/produto/${encodeURIComponent(product.slug)}" data-link>${escapeHtml(product.name)}</a></h3><div class="shirt-card-price"><strong>${money(price)}</strong>${product.compareAt > price && !isThaiShirt(product) ? `<del>${money(product.compareAt)}</del>` : ''}</div>${isThaiShirt(product) ? '<small>Preço para 1 unidade · tabela progressiva</small>' : ''}<div class="shirt-card-sizes" aria-label="${isDemoProduct(product) ? 'Tamanhos ilustrativos' : 'Tamanhos disponíveis'}">${sizes || '<small>Tamanhos não cadastrados</small>'}</div><a class="shirt-card-action" href="/produto/${encodeURIComponent(product.slug)}" data-link>VER DETALHES <span aria-hidden="true">→</span></a></div></article>`;
}
function shirtsHero() {
  return `<section class="shirts-hero" aria-labelledby="shirts-title"><div class="shirts-hero-art"><div class="shirts-hero-reference" aria-hidden="true"><img src="/assets/camisas-layout-referencia.png" alt="" width="1536" height="1024"></div><img class="shirts-hero-scene" src="/assets/camisas-hero-oficial.png" alt="Representante da BE IMPORTS apresentando uma camisa em uma loja" width="1983" height="793" fetchpriority="high"><div class="shirts-hero-shade" aria-hidden="true"></div><div class="shirts-hero-content"><div class="shirts-hero-copy"><div class="shirts-breadcrumb"><a href="/" data-link>INÍCIO</a><span aria-hidden="true">›</span><strong>CAMISAS</strong></div><h1 id="shirts-title">CAMISAS</h1><p>TIMES <b>•</b> ESTILO <b>•</b> TAILANDESAS<br>QUALIDADE <b>•</b> PRONTA ENTREGA</p><a class="shirts-hero-button" href="#catalogo-camisas" data-link>VER PRODUTOS <span aria-hidden="true">→</span></a></div></div></div></section>`;
}
function shirtsPage() {
  const query = new URLSearchParams(location.search);
  const subcategories = catalog.shirtSubcategories || [];
  const sizes = [...new Set(shirtProducts().flatMap(product => product.sizes || []))];
  const colors = [...new Set(shirtProducts().map(product => product.color).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  return `<div class="shirts-page">${shirtsHero()}<section class="shirts-catalog" id="catalogo-camisas"><div class="wrap"><div class="shirts-heading"><span class="eyebrow">CATÁLOGO DE CAMISAS</span><h1>ENCONTRE SUA CAMISA IDEAL</h1><p>Escolha seu estilo, encontre seu tamanho e aproveite nossas opções.</p></div><nav class="shirts-subnav" aria-label="Subcategorias de camisas"><button type="button" data-shirt-sub="" aria-pressed="${!query.get('sub')}" class="${!query.get('sub') ? 'is-current' : ''}"><img src="/assets/categorias/camisas.jpg" alt="" loading="lazy">Todos</button>${subcategories.map(item => `<button type="button" data-shirt-sub="${escapeHtml(item.name)}" aria-pressed="${query.get('sub') === item.name}" class="${query.get('sub') === item.name ? 'is-current' : ''}">${item.image ? `<img src="${escapeHtml(item.image)}" alt="" loading="lazy">` : ''}${escapeHtml(item.name)}</button>`).join('')}</nav><div class="shirts-layout"><aside class="shirts-filter-panel"><button type="button" id="shirt-filter-toggle" aria-expanded="false" aria-controls="shirt-filters">Filtrar por <span aria-hidden="true">⌄</span></button><form id="shirt-filters"><label>Buscar por time ou modelo<input name="q" type="search" value="${escapeHtml(query.get('q') || '')}" placeholder="Nome, time ou modelo" autocomplete="off"></label><label>Subcategoria<select name="sub"><option value="">Todas</option>${subcategories.map(item => `<option value="${escapeHtml(item.name)}" ${query.get('sub') === item.name ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}</select></label><label>Tamanho<select name="tamanho"><option value="">Todos os tamanhos</option>${sizes.map(size => `<option value="${escapeHtml(size)}" ${query.get('tamanho') === size ? 'selected' : ''}>${escapeHtml(size)}</option>`).join('')}</select></label>${colors.length ? `<label>Cor<select name="cor"><option value="">Todas as cores</option>${colors.map(color => `<option value="${escapeHtml(color)}" ${query.get('cor') === color ? 'selected' : ''}>${escapeHtml(color)}</option>`).join('')}</select></label>` : ''}<div class="shirts-price-fields"><label>Preço mínimo<input name="min" type="number" min="0" step="0.01" value="${escapeHtml(query.get('min') || '')}" placeholder="R$ 0"></label><label>Preço máximo<input name="max" type="number" min="0" step="0.01" value="${escapeHtml(query.get('max') || '')}" placeholder="Sem limite"></label></div><label class="shirts-check"><input name="disponivel" type="checkbox" ${query.get('disponivel') === '1' ? 'checked' : ''}> Somente disponíveis</label><button type="button" id="shirt-clear-filters">Limpar filtros</button></form></aside><div class="shirts-main"><div class="shirts-toolbar"><p id="shirt-result-count" aria-live="polite"></p><label>Ordenar por <select id="shirt-sort"><option value="price-asc" ${!query.get('ordem') || query.get('ordem') === 'price-asc' ? 'selected' : ''}>Menor preço</option><option value="price-desc" ${query.get('ordem') === 'price-desc' ? 'selected' : ''}>Maior preço</option><option value="recent" ${query.get('ordem') === 'recent' ? 'selected' : ''}>Mais recentes</option><option value="name" ${query.get('ordem') === 'name' ? 'selected' : ''}>Nome A–Z</option></select></label></div><div id="shirt-results" class="shirts-grid"></div></div></div></div></section>${homeFooter()}</div>`;
}
function renderShirtResults() {
  const grid = document.querySelector('#shirt-results');
  if (!grid) return;
  const query = new URLSearchParams(location.search);
  const matches = filterShirts(shirtProducts(), query);
  document.querySelector('#shirt-result-count').textContent = `${matches.length} ${matches.length === 1 ? 'camisa encontrada' : 'camisas encontradas'}`;
  grid.innerHTML = matches.length ? matches.map(shirtCard).join('') : `<div class="shirts-empty">${shirtProducts().length ? 'Nenhuma camisa corresponde aos filtros. Ajuste ou limpe a busca.' : 'As camisas cadastradas e publicadas aparecerão aqui.'}</div>`;
  document.querySelectorAll('[data-shirt-sub]').forEach(button => { const selected = button.dataset.shirtSub === (query.get('sub') || ''); button.classList.toggle('is-current', selected); button.setAttribute('aria-pressed', String(selected)); });
  document.querySelectorAll('#shirt-filters input, #shirt-filters select').forEach(input => {
    const selected = input.type === 'checkbox' ? input.checked : Boolean(input.value);
    input.classList.toggle('is-active', selected);
    input.closest('label')?.classList.toggle('is-active', selected);
  });
}
function updateShirtQuery(changes) {
  const query = new URLSearchParams(location.search);
  query.set('categoria', 'Camisas');
  for (const [key, value] of Object.entries(changes)) value ? query.set(key, value) : query.delete(key);
  history.replaceState({}, '', `/?${query}${location.hash}`);
  renderShirtResults();
}

const shoeProducts = () => products().filter(product => product.category === 'Tênis' && product.status === 'published');
const shoeBrand = product => product.brand || 'Outros';
function shoeCard(product) {
  const sizes = (product.sizes || []).filter(size => shoeSizeStock(product, size) > 0);
  return `<article class="shoe-card"><a class="shoe-card-photo" href="/produto/${encodeURIComponent(product.slug)}" data-link><img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy" decoding="async"></a>${product.compareAt > product.price ? `<span class="shoe-sale">−${discount(product)}%</span>` : ''}<div class="shoe-card-body">${isDemoProduct(product) ? '<span class="demo-product-label">Produto demonstrativo</span>' : ''}<h3><a href="/produto/${encodeURIComponent(product.slug)}" data-link>${escapeHtml(product.name)}</a></h3><p>${escapeHtml(shoeBrand(product))}${product.color ? ` · ${escapeHtml(product.color)}` : ''}</p><div class="shoe-card-price"><strong>${money(product.price)}</strong>${product.compareAt > product.price ? `<del>${money(product.compareAt)}</del>` : ''}</div><div class="shoe-card-sizes" aria-label="Numerações disponíveis">${sizes.length ? sizes.map(size => `<span>${escapeHtml(size)}</span>`).join('') : '<small>Sem numerações em estoque</small>'}</div><a class="shoe-card-action" href="/produto/${encodeURIComponent(product.slug)}" data-link>VER DETALHES <span aria-hidden="true">→</span></a></div></article>`;
}
function shoesPage() {
  const query = new URLSearchParams(location.search);
  const all = shoeProducts();
  const types = [...new Set(all.map(product => product.shoeType).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const brands = [...new Set(all.map(shoeBrand))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const sizes = [...new Set(all.flatMap(product => (product.sizes || []).filter(size => shoeSizeStock(product, size) > 0)))].sort((a, b) => Number(a) - Number(b));
  const chip = (label, attribute, value, image = '') => `<button type="button" ${attribute}="${escapeHtml(value)}" class="shoe-chip" aria-pressed="false">${image ? `<img src="${escapeHtml(image)}" alt="" loading="lazy">` : ''}<span>${escapeHtml(label)}</span></button>`;
  return `<div class="shoes-page"><section class="shoes-hero" aria-labelledby="shoes-title"><img class="shoes-hero-scene" src="/assets/tenis-hero-scene.png?v=2" alt="Representante da BE IMPORTS com visor espelhado, segurando um tênis em uma loja iluminada" width="1983" height="793" fetchpriority="high"><div class="shoes-hero-shade"></div><div class="shoes-hero-content wrap"><div class="shoes-hero-copy"><div class="shoes-breadcrumb"><a href="/" data-link>INÍCIO</a><span aria-hidden="true">›</span><strong>TÊNIS</strong></div><h1 id="shoes-title">TÊNIS</h1><p>ESTILO <b>•</b> CONFORTO <b>•</b> QUALIDADE<br>MODELOS EXCLUSIVOS</p><a class="shoes-hero-button" href="#catalogo-tenis" data-link>VER PRODUTOS <span aria-hidden="true">→</span></a></div><p class="shoes-hero-tagline">Os melhores modelos<br>para o seu <em>estilo.</em></p></div></section><section class="shoes-catalog" id="catalogo-tenis"><div class="wrap shoes-wrap"><nav class="shoes-subnav" aria-label="Tipos e marcas de tênis">${chip('Todos', 'data-shoe-all', '', all[0]?.image)}${types.map(type => chip(type, 'data-shoe-type', type, all.find(product => product.shoeType === type)?.image)).join('')}${brands.map(brand => chip(brand, 'data-shoe-brand', brand, all.find(product => shoeBrand(product) === brand)?.image)).join('')}</nav><div class="shoes-layout"><aside class="shoes-filter-panel"><button type="button" id="shoe-filter-toggle" aria-expanded="false" aria-controls="shoe-filters">Filtrar por <span aria-hidden="true">⌄</span></button><form id="shoe-filters"><label>Buscar<input name="q" type="search" value="${escapeHtml(query.get('q') || '')}" placeholder="Nome, marca ou modelo" autocomplete="off"></label><fieldset><legend>Marca</legend><div class="shoes-brand-options"><label><input type="radio" name="marca" value="" ${!query.get('marca') ? 'checked' : ''}> Todas</label>${brands.map(brand => `<label><input type="radio" name="marca" value="${escapeHtml(brand)}" ${query.get('marca') === brand ? 'checked' : ''}> ${escapeHtml(brand)} <span>(${all.filter(product => shoeBrand(product) === brand).length})</span></label>`).join('')}</div></fieldset><fieldset><legend>Numeração disponível</legend><div class="shoes-size-options">${sizes.length ? sizes.map(size => `<button type="button" data-shoe-size="${escapeHtml(size)}" aria-pressed="${query.get('numero') === size}" class="${query.get('numero') === size ? 'is-current' : ''}">${escapeHtml(size)}</button>`).join('') : '<small>As numerações aparecem quando houver estoque cadastrado.</small>'}</div></fieldset><div class="shoes-price-fields"><label>Preço mínimo<input name="min" type="number" min="0" step="0.01" value="${escapeHtml(query.get('min') || '')}" placeholder="R$ 0"></label><label>Preço máximo<input name="max" type="number" min="0" step="0.01" value="${escapeHtml(query.get('max') || '')}" placeholder="Sem limite"></label></div><button type="button" id="shoe-clear-filters">Limpar filtros</button></form></aside><div class="shoes-main"><div class="shoes-toolbar"><p id="shoe-result-count" aria-live="polite"></p><label>Ordenar por <select id="shoe-sort"><option value="price-asc" ${!query.get('ordem') || query.get('ordem') === 'price-asc' ? 'selected' : ''}>Menor preço</option><option value="price-desc" ${query.get('ordem') === 'price-desc' ? 'selected' : ''}>Maior preço</option><option value="recent" ${query.get('ordem') === 'recent' ? 'selected' : ''}>Mais recentes</option><option value="name" ${query.get('ordem') === 'name' ? 'selected' : ''}>Nome A–Z</option></select></label></div><div id="shoe-results" class="shoes-grid"></div></div></div></div></section>${homeFooter()}</div>`;
}
function renderShoeResults() {
  const grid = document.querySelector('#shoe-results');
  if (!grid) return;
  const query = new URLSearchParams(location.search);
  const matches = filterShoes(shoeProducts(), query);
  document.querySelector('#shoe-result-count').textContent = `${matches.length} ${matches.length === 1 ? 'tênis encontrado' : 'tênis encontrados'}`;
  grid.innerHTML = matches.length ? matches.map(shoeCard).join('') : `<div class="shoes-empty">${shoeProducts().length ? 'Nenhum tênis corresponde aos filtros. Ajuste ou limpe a busca.' : 'Os tênis cadastrados e publicados aparecerão aqui.'}</div>`;
  document.querySelectorAll('[data-shoe-all],[data-shoe-type],[data-shoe-brand]').forEach(button => {
    const selected = button.hasAttribute('data-shoe-all') ? !query.get('tipo') && !query.get('marca') : button.hasAttribute('data-shoe-type') ? button.dataset.shoeType === query.get('tipo') : button.dataset.shoeBrand === query.get('marca');
    button.classList.toggle('is-current', selected); button.setAttribute('aria-pressed', String(selected));
  });
  document.querySelectorAll('[data-shoe-size]').forEach(button => { const selected = button.dataset.shoeSize === query.get('numero'); button.classList.toggle('is-current', selected); button.setAttribute('aria-pressed', String(selected)); });
  document.querySelectorAll('#shoe-filters [name="marca"]').forEach(input => { input.checked = input.value === (query.get('marca') || ''); });
}
function updateShoeQuery(changes) {
  const query = new URLSearchParams(location.search);
  query.set('categoria', 'Tênis');
  for (const [key, value] of Object.entries(changes)) value ? query.set(key, value) : query.delete(key);
  history.replaceState({}, '', `/?${query}#catalogo-tenis`);
  renderShoeResults();
}
const capProducts = () => products().filter(product => product.category === 'Bonés' && product.status === 'published');
const capBrand = product => product.brand || 'Outros';
function capCard(product) {
  const colors = capColors(product);
  const price = money(product.price);
  return `<article class="cap-card"><a class="cap-card-photo" href="/produto/${encodeURIComponent(product.slug)}" data-link><img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy" decoding="async"></a>${product.compareAt > product.price ? `<span class="cap-sale">−${discount(product)}%</span>` : ''}<div class="cap-card-body">${isDemoProduct(product) ? '<span class="demo-product-label">Produto demonstrativo</span>' : ''}<h3><a href="/produto/${encodeURIComponent(product.slug)}" data-link>${escapeHtml(product.name)}</a></h3><p>${escapeHtml(capBrand(product))}${product.capType ? ` · ${escapeHtml(product.capType)}` : ''}</p>${colors.length ? `<small>Cores: ${escapeHtml(colors.join(', '))}</small>` : ''}<div class="cap-card-price"><strong>${price}</strong>${product.compareAt > product.price ? `<del>${money(product.compareAt)}</del>` : ''}</div><small>${isDemoProduct(product) ? 'Prévia sem estoque para compra' : product.stock ? `${product.stock} em estoque` : 'Esgotado'}</small><a class="cap-card-action" href="/produto/${encodeURIComponent(product.slug)}" data-link>VER DETALHES <span aria-hidden="true">→</span></a></div></article>`;
}
function capsPage() {
  const query = new URLSearchParams(location.search);
  const all = capProducts();
  const listedTypes = ['Snapback', 'Aba Curva', 'Aba Reta', 'Trucker', 'Esportivo'];
  const types = [...listedTypes, ...[...new Set(all.map(product => product.capType).filter(type => type && !listedTypes.includes(type)))].sort((a, b) => a.localeCompare(b, 'pt-BR'))];
  const listedBrands = ['Nike', 'Adidas', 'New Era', 'Oakley', 'Lacoste'];
  const brands = [...listedBrands, ...[...new Set(all.map(capBrand).filter(brand => brand !== 'Outros' && !listedBrands.includes(brand)))].sort((a, b) => a.localeCompare(b, 'pt-BR')), 'Outros'];
  const colors = [...new Set(all.flatMap(capColors))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const chip = (label, attribute, value, image = '') => `<button type="button" ${attribute}="${escapeHtml(value)}" class="cap-chip" aria-pressed="false">${image ? `<img src="${escapeHtml(image)}" alt="" loading="lazy">` : `<svg class="cap-chip-icon" viewBox="0 0 48 36" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M8 24c1-12 8-19 17-19s16 7 17 19M8 24c11 2 24 2 34 0M8 24c-3 1-5 4-5 7 12 2 26 2 39 0 2-1 3-3 3-5-1-2-2-3-3-2"/></svg>`}<span>${escapeHtml(label)}</span></button>`;
  return `<div class="caps-page"><section class="caps-hero" aria-labelledby="caps-title"><img class="caps-hero-scene" src="/assets/bones-hero-scene.png" alt="Representante da BE IMPORTS com visor espelhado apresentando um boné na loja" width="1983" height="793" fetchpriority="high"><div class="caps-hero-shade"></div><img class="caps-hero-logo" src="/assets/logo-original.webp" alt="" aria-hidden="true"><div class="caps-hero-content wrap"><div class="caps-hero-copy"><div class="caps-breadcrumb"><a href="/" data-link>INÍCIO</a><span aria-hidden="true">›</span><strong>BONÉS</strong></div><h1 id="caps-title">BONÉS</h1><p>ESTILO <b>•</b> QUALIDADE <b>•</b> VARIEDADE<br>DAS MELHORES MARCAS</p><a class="caps-hero-button" href="#catalogo-bones" data-link>VER PRODUTOS <span aria-hidden="true">→</span></a></div><p class="caps-hero-tagline">Vários modelos<br>para o seu <em>estilo.</em></p></div></section><section class="caps-catalog" id="catalogo-bones"><div class="wrap caps-wrap"><nav class="caps-subnav" aria-label="Modelos e marcas de bonés">${chip('Todos', 'data-cap-all', '', all[0]?.image)}${types.map(type => chip(type, 'data-cap-type', type, all.find(product => product.capType === type)?.image)).join('')}${brands.map(brand => chip(brand, 'data-cap-brand', brand, all.find(product => capBrand(product) === brand)?.image)).join('')}</nav><div class="caps-layout"><aside class="caps-filter-panel"><button type="button" id="cap-filter-toggle" aria-expanded="false" aria-controls="cap-filters">Filtrar por <span aria-hidden="true">⌄</span></button><form id="cap-filters"><label>Buscar<input name="q" type="search" value="${escapeHtml(query.get('q') || '')}" placeholder="Nome, marca ou modelo" autocomplete="off"></label><fieldset><legend>Marca</legend><div class="caps-options"><label><input type="radio" name="marca" value="" ${!query.get('marca') ? 'checked' : ''}> Todas</label>${brands.map(brand => `<label><input type="radio" name="marca" value="${escapeHtml(brand)}" ${query.get('marca') === brand ? 'checked' : ''}> ${escapeHtml(brand)} <span>(${all.filter(product => capBrand(product) === brand).length})</span></label>`).join('')}</div></fieldset><fieldset><legend>Modelo</legend><div class="caps-options"><label><input type="radio" name="tipo" value="" ${!query.get('tipo') ? 'checked' : ''}> Todos</label>${types.map(type => `<label><input type="radio" name="tipo" value="${escapeHtml(type)}" ${query.get('tipo') === type ? 'checked' : ''}> ${escapeHtml(type)}</label>`).join('')}</div></fieldset>${colors.length ? `<label>Cor<select name="cor"><option value="">Todas as cores</option>${colors.map(color => `<option value="${escapeHtml(color)}" ${query.get('cor') === color ? 'selected' : ''}>${escapeHtml(color)}</option>`).join('')}</select></label>` : ''}<div class="caps-price-fields"><label>Preço mínimo<input name="min" type="number" min="0" step="0.01" value="${escapeHtml(query.get('min') || '')}" placeholder="R$ 0"></label><label>Preço máximo<input name="max" type="number" min="0" step="0.01" value="${escapeHtml(query.get('max') || '')}" placeholder="Sem limite"></label></div><label class="caps-availability"><input name="disponivel" type="checkbox" ${query.get('disponivel') === '1' ? 'checked' : ''}> Só disponíveis</label><button type="button" id="cap-clear-filters">Limpar filtros</button></form></aside><div class="caps-main"><div class="caps-toolbar"><p id="cap-result-count" aria-live="polite"></p><label>Ordenar por <select id="cap-sort"><option value="price-asc" ${!query.get('ordem') || query.get('ordem') === 'price-asc' ? 'selected' : ''}>Menor preço</option><option value="price-desc" ${query.get('ordem') === 'price-desc' ? 'selected' : ''}>Maior preço</option><option value="recent" ${query.get('ordem') === 'recent' ? 'selected' : ''}>Mais recentes</option><option value="name" ${query.get('ordem') === 'name' ? 'selected' : ''}>Nome A–Z</option></select></label></div><div id="cap-results" class="caps-grid"></div></div></div></div></section>${homeFooter()}</div>`;
}
function renderCapResults() {
  const grid = document.querySelector('#cap-results');
  if (!grid) return;
  const query = new URLSearchParams(location.search);
  const matches = filterCaps(capProducts(), query);
  document.querySelector('#cap-result-count').textContent = `${matches.length} ${matches.length === 1 ? 'boné encontrado' : 'bonés encontrados'}`;
  grid.innerHTML = matches.length ? matches.map(capCard).join('') + (matches.length === 1 && isDemoProduct(matches[0]) ? '<div class="caps-demo-note"><strong>Catálogo em preparação</strong><p>Os bonés reais aparecerão aqui quando forem publicados com foto, variações e estoque no painel.</p></div>' : '') : `<div class="caps-empty">${capProducts().length ? 'Nenhum boné corresponde aos filtros. Ajuste ou limpe a busca.' : 'Os bonés cadastrados e publicados aparecerão aqui.'}</div>`;
  document.querySelectorAll('[data-cap-all],[data-cap-type],[data-cap-brand]').forEach(button => {
    const selected = button.hasAttribute('data-cap-all') ? !query.get('tipo') && !query.get('marca') : button.hasAttribute('data-cap-type') ? button.dataset.capType === query.get('tipo') : button.dataset.capBrand === query.get('marca');
    button.classList.toggle('is-current', selected); button.setAttribute('aria-pressed', String(selected));
  });
  document.querySelectorAll('#cap-filters [name="marca"]').forEach(input => { input.checked = input.value === (query.get('marca') || ''); });
  document.querySelectorAll('#cap-filters [name="tipo"]').forEach(input => { input.checked = input.value === (query.get('tipo') || ''); });
}
function updateCapQuery(changes) {
  const query = new URLSearchParams(location.search);
  query.set('categoria', 'Bonés');
  for (const [key, value] of Object.entries(changes)) value ? query.set(key, value) : query.delete(key);
  history.replaceState({}, '', `/?${query}#catalogo-bones`);
  renderCapResults();
}
function updateBermudaQuery(changes) {
  const query = new URLSearchParams(location.search);
  query.set('categoria', 'Bermudas');
  for (const [key, value] of Object.entries(changes)) value ? query.set(key, value) : query.delete(key);
  history.replaceState({}, '', `/?${query}#catalogo-bermudas`);
  renderBermudaResults(products().filter(product => product.category === 'Bermudas' && product.status === 'published'), query);
}
function catalogFilters() {
  const query = new URLSearchParams(location.search);
  return `<div class="catalog-controls"><label class="catalog-search">Pesquisar produto<input id="catalog-search" type="search" value="${escapeHtml(query.get('q') || '')}" placeholder="Digite o nome do produto" autocomplete="off"></label><div class="catalog-toolbar"><p id="result-count" aria-live="polite"></p><label>Ordenar por <select id="sort"><option value="price-asc">Menor preço</option><option value="price-desc">Maior preço</option><option value="recent">Mais recentes</option><option value="name">Nome A–Z</option></select></label></div></div><div class="catalog-layout"><aside class="filter-panel"><button id="filter-toggle" class="filter-toggle" type="button" aria-expanded="false" aria-controls="filters">Filtros <span aria-hidden="true">⌄</span></button><form id="filters"><label>Categoria<select name="categoria"><option value="">Todos os produtos</option>${categories().map(({ name }) => `<option value="${escapeHtml(name)}" ${query.get('categoria') === name ? 'selected' : ''}>${escapeHtml(name)}</option>`).join('')}</select></label><label>Preço mínimo<input name="min" type="number" min="0" step="0.01" value="${escapeHtml(query.get('min') || '')}" placeholder="R$ 0"></label><label>Preço máximo<input name="max" type="number" min="0" step="0.01" value="${escapeHtml(query.get('max') || '')}" placeholder="Sem limite"></label><label class="checkbox"><input name="disponivel" type="checkbox" ${query.get('disponivel') === '1' ? 'checked' : ''}> Apenas disponíveis</label><button class="clear-button" type="button" id="clear-filters">LIMPAR FILTROS</button></form></aside><div class="catalog-main"><div id="product-results"></div></div></div>`;
}
function categoryIllustration(name) {
  const drawings = {
    Camisas: '<path d="M46 19 34 24 18 42 31 53 40 44 40 79 80 79 80 44 89 53 102 42 86 24 74 19 67 27 53 27Z"/><path d="M53 27q7 10 14 0" fill="none"/>',
    Bermudas: '<path d="M32 20h56l-4 54H66l-6-23-6 23H36Z"/><path d="M33 31h54M60 31v20" fill="none"/>',
    'Bonés': '<path d="M28 55c1-21 14-33 33-33s32 12 33 33Z"/><path d="M29 55c22 4 47 4 65 0 8 1 14 5 17 11-24 7-52 6-80-4Z"/><path d="M61 23v31" fill="none"/>',
    'Tênis': '<path d="m19 61 22-14 12 8 18 3 12-2 9 9 13 5v9H17l-3-11Z"/><path d="M19 72h86M46 56l11 7m-2-12 11 11m-1-8 11 10" fill="none"/>',
    Perfumes: '<rect x="37" y="33" width="46" height="45" rx="6"/><path d="M45 33v-9h30v9M53 24v-8h14v8"/><path d="M48 48h24v17H48z" fill="none"/><path d="M56 57h8" fill="none"/>',
    'Fones de ouvido': '<path d="M31 55V45a29 29 0 0 1 58 0v10" fill="none"/><rect x="25" y="50" width="15" height="26" rx="6"/><rect x="80" y="50" width="15" height="26" rx="6"/><path d="M89 76q-4 8-17 8" fill="none"/>',
    'Roupas': '<path d="M46 19 34 24 18 42 31 53 40 44 40 79 80 79 80 44 89 53 102 42 86 24 74 19 67 27 53 27Z"/><path d="M53 27q7 10 14 0" fill="none"/>',
    Smartwatch: '<path d="M47 13h26l3 17H44Zm-3 53h32l-3 17H47Z"/><rect x="35" y="29" width="50" height="39" rx="10"/><circle cx="60" cy="48" r="11" fill="none"/><path d="M60 41v8l5 3" fill="none"/>',
    'Óculos': '<path d="m12 42 11-3 4 5m70-2-11-3-4 5M49 46q11-7 22 0" fill="none"/><rect x="23" y="41" width="30" height="27" rx="11"/><rect x="67" y="41" width="30" height="27" rx="11"/>',
    'Acessórios': '<rect x="22" y="29" width="76" height="49" rx="7"/><path d="M22 42h54m0 0h22" fill="none"/><rect x="69" y="47" width="29" height="22" rx="4"/><circle cx="81" cy="58" r="2"/>',
    '': '<rect x="22" y="18" width="30" height="25" rx="4"/><rect x="68" y="18" width="30" height="25" rx="4"/><rect x="22" y="55" width="30" height="25" rx="4"/><rect x="68" y="55" width="30" height="25" rx="4"/>'
  };
  return `<svg class="category-illustration" viewBox="0 0 120 96" aria-hidden="true" focusable="false"><ellipse cx="60" cy="86" rx="42" ry="4" fill="#B5A06B30" stroke="none"/><g fill="#111722" stroke="#D6C390" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">${drawings[name] || drawings['']}</g></svg>`;
}
const categoryArt = {
  Camisas: '/assets/categorias/camisas.jpg', Bermudas: '/assets/categorias/bermudas.jpg',
  'Bonés': '/assets/categorias/bones.jpg', Perfumes: '/assets/categorias/perfumes.jpg',
  'Fones de ouvido': '/assets/categorias/eletronicos.jpg',
  'Acessórios': '/assets/categorias/acessorios.jpg'
};
function categoryCards() {
  const selected = new URLSearchParams(location.search).get('categoria') || '';
  const card = (name, image = '') => { const art = image || categoryArt[name]; return `<button type="button" data-category="${escapeHtml(name)}" class="catalog-category ${selected === name ? 'selected' : ''}" aria-pressed="${selected === name}"><span class="category-visual">${art ? `<img src="${escapeHtml(art)}" alt="" loading="lazy" decoding="async">` : categoryIllustration(name)}</span><strong>${escapeHtml(name || 'TODOS')}</strong></button>`; };
  return `<div class="catalog-category-grid" aria-label="Categorias de produtos">${card('')} ${categories().map(({ name, image }) => card(name, image)).join('')}<a class="catalog-category" href="/ofertas" data-link><span class="category-visual">${categoryIllustration('')}</span><strong>Ofertas</strong></a></div>`;
}
function productsPage() {
  return `<section class="product-hero" aria-labelledby="products-title">
    <div class="campaign-scene" aria-hidden="true"><img src="/assets/loja-cenario-produtos.jpg" alt="" width="1600" height="900"></div>
    <div class="wrap campaign-grid">
      <div class="campaign-visual"><img class="campaign-products" src="/assets/produtos-primeiro-plano.png" alt="" width="1672" height="941" aria-hidden="true"><img class="campaign-mascot" src="/assets/mascote-produtos.png" alt="Representante da BE IMPORTS com viseira multicolorida, apontando e segurando sacolas da loja" width="1672" height="941" fetchpriority="high"></div>
      <div class="campaign-copy"><span class="eyebrow">TUDO EM UM SÓ LUGAR</span><h1 id="products-title">Produtos</h1><h2>QUALIDADE E ESTILO<br><em>PARA O SEU DIA A DIA</em></h2><p>Camisas, bermudas, bonés, perfumes, fones de ouvido, roupas e acessórios. Produtos selecionados para acompanhar seu estilo.</p><a class="button gold product-hero-cta" href="#catalogo" data-hero-catalog>VER TODOS OS PRODUTOS <span class="campaign-arrow" aria-hidden="true">➜</span></a><div class="product-hero-benefits"><span>✦ CATÁLOGO ATUALIZADO PELA LOJA</span><span>✦ ESTOQUE VISÍVEL</span><span>✦ ATENDIMENTO DIRETO</span></div></div>
    </div>
  </section><section class="products-categories wrap" id="categorias"><div class="products-heading"><span class="eyebrow">EXPLORE A LOJA</span><h2>CATEGORIAS</h2><p>Escolha uma categoria para filtrar o catálogo.</p></div>${categoryCards()}</section><section class="products-collection wrap" id="catalogo"><div class="products-heading"><span class="eyebrow">ESCOLHAS PARA VOCÊ</span><h2>NOSSA COLEÇÃO</h2><p>Encontre seu próximo favorito.</p><a class="catalog-cart-link" href="/carrinho" data-link>Ver carrinho (${cartCount()}) ↗</a></div>${catalogFilters()}</section>`;
}
function filteredProducts() {
  return filterProducts(products(), new URLSearchParams(location.search));
}
function renderResults() {
  const count = document.querySelector('#result-count'), grid = document.querySelector('#product-results');
  if (!count || !grid) return;
  const list = filteredProducts();
  count.textContent = `${list.length} ${list.length === 1 ? 'produto encontrado' : 'produtos encontrados'}`;
  grid.innerHTML = list.length ? `<div class="product-grid">${list.map(productCard).join('')}</div>` : products().length ? emptyState('Nenhum resultado para os filtros', 'Experimente outra categoria, busca ou faixa de preço.') : emptyState('Novidades chegando em breve!', 'Ainda não há produtos publicados. Acompanhe as próximas novidades da BE IMPORTS.');
  document.querySelector('#sort').value = new URLSearchParams(location.search).get('ordem') || 'price-asc';
  document.querySelectorAll('#filters input, #filters select').forEach(input => {
    const active = input.type === 'checkbox' ? input.checked : Boolean(input.value);
    input.classList.toggle('is-active', active);
    input.closest('label')?.classList.toggle('is-active', active);
  });
}
function categoryPage() {
  return `<section class="page-intro wrap"><span class="eyebrow">ENCONTRE O QUE PROCURA</span><h1>Categorias<span>.</span></h1><p>Explore as linhas disponíveis no catálogo da BE IMPORTS.</p></section><section class="section wrap topless">${categories().length ? `<div class="category-grid">${categories().map(({ name }, i) => `<a class="category-tile" href="${homeCategoryNames.includes(name) ? homeCategoryHref(name) : `/produtos?categoria=${encodeURIComponent(name)}#catalogo`}" data-link><span>${String(i + 1).padStart(2, '0')} / CATEGORIA</span><strong>${escapeHtml(name)}</strong><small>${products().filter(p => p.category === name).length} produtos</small><b aria-hidden="true">↗</b></a>`).join('')}<a class="category-tile" href="/ofertas" data-link><span>08 / CATEGORIA</span><strong>Ofertas</strong><small>${offers().length} produtos</small><b aria-hidden="true">↗</b></a></div>` : emptyState('Categorias em breve', 'As categorias aparecem aqui quando forem cadastradas.', '/produtos')}</section>`;
}
function offersPage() {
  return offersCatalogPage(products(), categories(), new URLSearchParams(location.search), homeFooter());
}
function storePage() {
  return `<section class="store-hero wrap"><div><span class="eyebrow">A BE IMPORTS DE PERTO</span><h1>Nossa <em>Loja.</em></h1><p>A BE IMPORTS tem um espaço físico em Ribeira do Pombal, Bahia. A identidade da fachada e o atendimento próximo fazem parte da nossa história.</p><div class="hero-actions"><a class="button gold" href="${instagram()}" target="_blank" rel="noopener noreferrer">Acompanhar no Instagram ↗</a>${contactUrl() ? `<a class="button outline" href="${contactUrl()}" target="_blank" rel="noopener noreferrer">Falar no WhatsApp ↗</a>` : ''}</div></div><img src="/assets/fachada-tratada.webp" alt="Fachada da BE IMPORTS" width="941" height="1672"></section><section class="section wrap"><div class="section-title"><div><span class="eyebrow">NOSSO ESPAÇO</span><h2>Uma identidade<br><em>que você reconhece.</em></h2></div><p>Fotos reais da fachada da BE IMPORTS.</p></div><div class="store-gallery"><img src="/assets/fachada-01.webp" alt="Fachada real da BE IMPORTS vista de frente" loading="lazy"><img src="/assets/fachada-02.webp" alt="Entrada da loja BE IMPORTS" loading="lazy"></div></section><section class="store-details"><div class="wrap"><h2>Venha nos visitar.</h2><p>${escapeHtml(catalog.settings.address || 'Ribeira do Pombal, BA')}</p>${mapsUrl() ? `<a class="button gold" href="${mapsUrl()}" target="_blank" rel="noopener noreferrer">Abrir no Google Maps ↗</a>` : ''}</div></section>`;
}
function contactPage() {
  return `<section class="page-intro wrap"><span class="eyebrow">FALE COM A GENTE</span><h1>Contato<span>.</span></h1><p>Escolha o canal de atendimento e venha conhecer a BE IMPORTS.</p></section><section class="section wrap top-less contact-grid"><div class="contact-card"><span>01 / REDES SOCIAIS</span><h2>Instagram</h2><p>Novidades e conteúdo da loja.</p><a class="underlined" href="${instagram()}" target="_blank" rel="noopener noreferrer">@beimportsreserva ↗</a></div>${contactUrl() ? `<div class="contact-card"><span>02 / ATENDIMENTO</span><h2>WhatsApp</h2><p>Converse com a nossa equipe.</p><a class="underlined" href="${contactUrl()}" target="_blank" rel="noopener noreferrer">Abrir conversa ↗</a></div>` : ''}<div class="contact-card"><span>${contactUrl() ? '03' : '02'} / LOJA FÍSICA</span><h2>Visite-nos</h2><p>${escapeHtml(catalog.settings.address || 'Ribeira do Pombal, BA')}</p>${mapsUrl() ? `<a class="underlined" href="${mapsUrl()}" target="_blank" rel="noopener noreferrer">Abrir localização ↗</a>` : ''}</div><div class="contact-card"><span>${contactUrl() ? '04' : '03'} / HORÁRIO</span><h2>Funcionamento</h2><p>${escapeHtml(catalog.settings.hours || 'Consulte o Instagram para o horário atualizado.')}</p></div></section>`;
}
function detailPage(slug) {
  const p = products().find(item => item.slug === slug);
  if (!p) return emptyState('Produto não encontrado', 'Este produto pode ter sido removido do catálogo.', '/produtos');
  if (p.category === 'Camisas') return shirtDetailPage(p);
  if (p.category === 'Tênis') return shoeDetailPage(p);
  if (p.category === 'Bonés') return capDetailPage(p);
  if (p.category === 'Bermudas') return bermudaDetailPage(p, cartCount(), customerDraft.postalCode);
  if (p.category === 'Perfumes') return perfumeDetailPage(p, cartCount(), customerDraft.postalCode);
  if (isElectronic(p)) return electronicDetailPage(p, cartCount(), customerDraft.postalCode);
  const media = [{ type: 'image', src: p.image }, ...(p.gallery || []).map(src => ({ type: 'image', src })), ...(p.videoUrl ? [{ type: 'video', src: p.videoUrl }] : [])];
  const gallery = `<div class="detail-photo"><div id="detail-media-main" class="detail-media-main"><img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}"></div>${media.length > 1 ? `<div class="detail-media-controls"><button type="button" data-media-step="-1" aria-label="Mídia anterior">‹</button><div class="detail-media-thumbs">${media.map((item, index) => `<button type="button" data-detail-media="${index}" data-media-type="${item.type}" data-media-src="${escapeHtml(item.src)}" data-media-alt="${escapeHtml(p.name)}" aria-label="${item.type === 'video' ? 'Vídeo' : 'Foto'} ${index + 1}" aria-pressed="${index === 0}">${item.type === 'video' ? '▶ Vídeo' : `<img src="${escapeHtml(item.src)}" alt="">`}</button>`).join('')}</div><button type="button" data-media-step="1" aria-label="Próxima mídia">›</button></div>` : ''}</div>`;
  return `<section class="section wrap detail-layout">${gallery}<div class="detail-copy"><a class="back-link" href="/produtos" data-link>← Voltar aos produtos</a><span class="eyebrow">${escapeHtml(p.category)}</span>${isDemoProduct(p) ? '<span class="demo-product-label">Produto demonstrativo</span>' : ''}<h1>${escapeHtml(p.name)}</h1><div class="detail-price">${p.compareAt > p.price ? `<del>${money(p.compareAt)}</del><span class="discount-pill">−${discount(p)}%</span>` : ''}<strong>${money(p.price)}</strong></div><p class="detail-stock ${p.stock ? '' : 'out'}">${isDemoProduct(p) ? 'Produto demonstrativo — compra indisponível' : p.stock ? `${p.stock} em estoque` : 'Indisponível no momento'}</p>${p.description ? `<p class="detail-description">${escapeHtml(p.description.replace(/^\[DEMO\]\s*/, ''))}</p>` : ''}${p.stock && !isDemoProduct(p) ? `<form id="add-to-cart" data-product-id="${escapeHtml(p.id)}" class="add-cart-form">${p.sizes?.length ? `<label>Tamanho<select name="size" required><option value="">Selecione</option>${p.sizes.map(size => `<option value="${escapeHtml(size)}">${escapeHtml(size)}</option>`).join('')}</select></label>` : ''}<label>Quantidade<input name="quantity" type="number" min="1" max="${p.stock}" value="1" required></label><button class="button gold" type="submit">Adicionar ao carrinho</button></form>` : ''}${isDemoProduct(p) ? '' : `<a class="catalog-cart-link" href="/carrinho" data-link>Ver carrinho (${cartCount()}) ↗</a>`}<p id="cart-feedback" role="status"></p></div></section>`;
}
function shoeDetailPage(p) {
  const media = [p.image, ...(p.gallery || [])];
  const available = !isDemoProduct(p) && (p.sizes || []).some(size => shoeSizeStock(p, size) > 0);
  const sizes = (p.sizes || []).map(size => `<option value="${escapeHtml(size)}" ${shoeSizeStock(p, size) ? '' : 'disabled'}>${escapeHtml(size)}${shoeSizeStock(p, size) ? ` — ${shoeSizeStock(p, size)} disponíveis` : ' — esgotado'}</option>`).join('');
  return `<section class="shoe-detail wrap"><div class="shoe-detail-gallery"><div class="shoe-detail-main" id="detail-media-main"><img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}"></div>${media.length > 1 ? `<div class="shoe-detail-thumbs">${media.map((src, index) => `<button type="button" data-shoe-photo="${escapeHtml(src)}" aria-label="Ver foto ${index + 1} de ${escapeHtml(p.name)}" aria-pressed="${index === 0}"><img src="${escapeHtml(src)}" alt=""></button>`).join('')}</div>` : ''}</div><div class="shoe-detail-info"><a class="back-link" href="/?categoria=T%C3%AAnis#catalogo-tenis" data-link>← Voltar aos tênis</a><span class="eyebrow">${escapeHtml(shoeBrand(p))}${p.shoeType ? ` · ${escapeHtml(p.shoeType)}` : ''}</span>${isDemoProduct(p) ? '<span class="demo-product-label">Produto demonstrativo</span>' : ''}<h1>${escapeHtml(p.name)}</h1>${p.color ? `<p class="shoe-detail-color">Cor: ${escapeHtml(p.color)}</p>` : ''}<div class="shoe-detail-price"><strong>${money(p.price)}</strong>${p.compareAt > p.price ? `<del>${money(p.compareAt)}</del>` : ''}</div>${p.description ? `<p class="shoe-detail-description">${escapeHtml(p.description.replace(/^\[DEMO\]\s*/, ''))}</p>` : ''}${available ? `<form id="add-to-cart" data-product-id="${escapeHtml(p.id)}" class="shoe-buy-form"><label>Numeração<select name="size" required><option value="">Escolha sua numeração</option>${sizes}</select></label><label>Quantidade<input name="quantity" type="number" min="1" max="${p.stock}" value="1" required></label><p id="shoe-stock-label" role="status">Selecione uma numeração para ver o estoque.</p><label>CEP para consultar a entrega (opcional)<input name="postalCode" inputmode="numeric" pattern="[0-9]{5}-?[0-9]{3}" placeholder="00000-000" value="${escapeHtml(customerDraft.postalCode)}"></label><p class="shoe-shipping-note">O frete será confirmado pela loja no WhatsApp.</p><button class="button gold" type="submit">Adicionar à sacola</button></form>` : `<p class="shoe-out-of-stock">${isDemoProduct(p) ? 'Produto demonstrativo — sem estoque para compra.' : 'Sem numerações em estoque no momento.'}</p>`}<a class="catalog-cart-link" href="/carrinho" data-link>Ver sacola (${cartCount()}) ↗</a><p id="cart-feedback" role="status"></p></div></section>`;
}
function capDetailPage(p) {
  const media = [p.image, ...(p.gallery || [])];
  const colors = capColors(p);
  const sizes = [...new Set(p.capVariants?.length ? p.capVariants.map(item => item.size).filter(Boolean) : p.sizes || [])];
  const available = !isDemoProduct(p) && p.stock > 0;
  return `<section class="cap-detail wrap"><div class="cap-detail-gallery"><div class="cap-detail-main" id="detail-media-main"><img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}"></div>${media.length > 1 ? `<div class="cap-detail-thumbs">${media.map((src, index) => `<button type="button" data-cap-photo="${escapeHtml(src)}" aria-label="Ver foto ${index + 1} de ${escapeHtml(p.name)}" aria-pressed="${index === 0}"><img src="${escapeHtml(src)}" alt=""></button>`).join('')}</div>` : ''}</div><div class="cap-detail-info"><a class="back-link" href="/?categoria=Bon%C3%A9s#catalogo-bones" data-link>← Voltar aos bonés</a><span class="eyebrow">${escapeHtml(capBrand(p))}${p.capType ? ` · ${escapeHtml(p.capType)}` : ''}</span>${isDemoProduct(p) ? '<span class="demo-product-label">Produto demonstrativo</span>' : ''}<h1>${escapeHtml(p.name)}</h1><div class="cap-detail-price"><strong>${money(p.price)}</strong>${p.compareAt > p.price ? `<del>${money(p.compareAt)}</del>` : ''}</div>${p.description ? `<p class="cap-detail-description">${escapeHtml(p.description.replace(/^\[DEMO\]\s*/, ''))}</p>` : ''}${available ? `<form id="add-to-cart" data-product-id="${escapeHtml(p.id)}" class="cap-buy-form">${colors.length ? `<label>Cor<select name="color" required><option value="">Escolha a cor</option>${colors.map(color => `<option value="${escapeHtml(color)}" ${p.capVariants?.length && !p.capVariants.some(item => item.color === color && item.stock > 0) ? 'disabled' : ''}>${escapeHtml(color)}${p.capVariants?.length && !p.capVariants.some(item => item.color === color && item.stock > 0) ? ' — esgotada' : ''}</option>`).join('')}</select></label>` : '<input type="hidden" name="color" value="">'}${sizes.length ? `<label>Tamanho ou ajuste<select name="size" required><option value="">Escolha o tamanho</option>${sizes.map(size => `<option value="${escapeHtml(size)}">${escapeHtml(size)}</option>`).join('')}</select></label>` : '<input type="hidden" name="size" value="">'}<label>Quantidade<input name="quantity" type="number" min="1" max="${p.stock}" value="1" required></label><p id="cap-stock-label" role="status">Selecione a variação para ver o estoque.</p><label>CEP para consultar a entrega (opcional)<input name="postalCode" inputmode="numeric" pattern="[0-9]{5}-?[0-9]{3}" placeholder="00000-000" value="${escapeHtml(customerDraft.postalCode)}"></label><p class="cap-shipping-note">O frete será confirmado pela loja no WhatsApp.</p><button class="button gold" type="submit">Adicionar à sacola</button></form>` : `<p class="cap-out-of-stock">${isDemoProduct(p) ? 'Produto demonstrativo — sem estoque para compra.' : 'Boné esgotado no momento.'}</p>`}<a class="catalog-cart-link" href="/carrinho" data-link>Ver sacola (${cartCount()}) ↗</a><p id="cart-feedback" role="status"></p></div></section>`;
}
function updateCapDetail() {
  const form = document.querySelector('#add-to-cart.cap-buy-form');
  if (!form) return;
  const product = products().find(item => item.id === form.dataset.productId);
  if (!product) return;
  const color = form.elements.namedItem('color').value;
  const sizeSelect = form.elements.namedItem('size');
  if (sizeSelect.tagName === 'SELECT') {
    [...sizeSelect.options].filter(option => option.value).forEach(option => { option.disabled = Boolean(color || !capColors(product).length) && capVariantStock(product, color, option.value) < 1; });
    if (sizeSelect.selectedOptions[0]?.disabled) sizeSelect.value = '';
  }
  const size = sizeSelect.value;
  const inCart = cart.filter(item => item.productId === product.id && (item.color || '') === color && item.size === size).reduce((sum, item) => sum + item.quantity, 0);
  const remaining = Math.max(0, capVariantStock(product, color, size) - inCart);
  const totalRemaining = Math.max(0, product.stock - cart.filter(item => item.productId === product.id).reduce((sum, item) => sum + item.quantity, 0));
  const allowed = Math.min(remaining, totalRemaining);
  form.elements.namedItem('quantity').max = String(Math.max(1, allowed));
  document.querySelector('#cap-stock-label').textContent = (capColors(product).length && !color) || (sizeSelect.tagName === 'SELECT' && !size) ? 'Selecione a variação para ver o estoque.' : `${allowed} ${allowed === 1 ? 'unidade disponível' : 'unidades disponíveis'} nesta variação`;
  const quantity = Number(form.elements.namedItem('quantity').value);
  form.querySelector('[type="submit"]').disabled = (capColors(product).length && !color) || (sizeSelect.tagName === 'SELECT' && !size) || quantity < 1 || quantity > allowed;
}
function shirtDetailPage(p) {
  const media = [p.image, ...(p.gallery || [])];
  const sizes = (p.sizes || []).map(size => `<option value="${escapeHtml(size)}" ${shirtSizeStock(p, size) ? '' : 'disabled'}>${escapeHtml(size)}${shirtSizeStock(p, size) ? ` — ${shirtSizeStock(p, size)} disponíveis` : ' — esgotado'}</option>`).join('');
  const available = !isDemoProduct(p) && (p.sizes || []).some(size => shirtSizeStock(p, size) > 0);
  const price = shirtUnitPrice(p);
  return `<section class="shirt-detail wrap"><div class="shirt-detail-gallery"><div class="shirt-detail-main" id="detail-media-main"><img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}"></div>${media.length > 1 ? `<div class="shirt-detail-thumbs">${media.map((src, index) => `<button type="button" data-shirt-photo="${escapeHtml(src)}" aria-label="Ver foto ${index + 1} de ${escapeHtml(p.name)}" aria-pressed="${index === 0}"><img src="${escapeHtml(src)}" alt=""></button>`).join('')}</div>` : ''}</div><div class="shirt-detail-info"><a class="back-link" href="/?categoria=Camisas#catalogo-camisas" data-link>← Voltar às camisas</a><span class="eyebrow">${escapeHtml(p.subcategory || 'CAMISAS')}</span>${isDemoProduct(p) ? '<span class="demo-product-label">Produto demonstrativo</span>' : ''}<h1>${escapeHtml(p.name)}</h1><div class="shirt-detail-price"><strong id="shirt-unit-price">${money(price)}</strong>${p.compareAt > price && !isThaiShirt(p) ? `<del>${money(p.compareAt)}</del>` : ''}</div>${p.description ? `<p>${escapeHtml(p.description.replace(/^\[DEMO\]\s*/, ''))}</p>` : ''}${isThaiShirt(p) ? `<div class="shirt-tier-note"><strong>Preço progressivo por modelo</strong><span>1: R$ 140 · 2: R$ 125 cada · 3: R$ 105 cada · 4: R$ 90 cada · 5: R$ 70 cada</span></div>` : ''}${available ? `<form id="add-to-cart" data-product-id="${escapeHtml(p.id)}" class="shirt-buy-form"><label>Tamanho<select name="size" required><option value="">Escolha seu tamanho</option>${sizes}</select></label><label>Quantidade<input name="quantity" type="number" min="1" max="${isThaiShirt(p) ? 5 : p.stock}" value="1" required></label><p id="shirt-stock-label" role="status">Selecione um tamanho para ver o estoque.</p><p id="shirt-price-summary" role="status">Subtotal: ${money(price)}</p>${isThaiShirt(p) ? '<p id="shirt-discount" role="status"></p>' : ''}<div class="shirt-buy-actions"><button class="button gold" type="submit" name="purchaseAction" value="cart">Colocar na sacola</button><button class="button outline" type="submit" name="purchaseAction" value="whatsapp">Comprar pelo WhatsApp</button></div></form>` : isDemoProduct(p) ? `<div class="shirt-demo-actions"><p>Prévia demonstrativa: sem estoque cadastrado. As opções abaixo mostram como será a compra quando este produto estiver disponível.</p><div class="shirt-buy-actions"><button class="button gold" type="button" data-demo-intent="cart">Colocar na sacola</button><button class="button outline" type="button" data-demo-intent="whatsapp">Comprar pelo WhatsApp</button></div></div>` : `<p class="detail-stock out">Sem tamanhos disponíveis no momento</p>`}<a class="catalog-cart-link" href="/carrinho" data-link>Ver sacola (${cartCount()}) ↗</a><p id="cart-feedback" role="status"></p></div></section>`;
}
function updateShoeDetail() {
  const form = document.querySelector('#add-to-cart.shoe-buy-form');
  if (!form) return;
  const product = products().find(item => item.id === form.dataset.productId);
  if (!product) return;
  const size = form.elements.size.value;
  const inCart = cart.filter(item => item.productId === product.id && item.size === size).reduce((sum, item) => sum + item.quantity, 0);
  const remaining = Math.max(0, shoeSizeStock(product, size) - inCart);
  form.elements.quantity.max = String(Math.max(1, Math.min(remaining, product.stock - cart.filter(item => item.productId === product.id).reduce((sum, item) => sum + item.quantity, 0))));
  document.querySelector('#shoe-stock-label').textContent = size ? `${remaining} ${remaining === 1 ? 'par disponível' : 'pares disponíveis'} nesta numeração` : 'Selecione uma numeração para ver o estoque.';
  const quantity = Number(form.elements.quantity.value);
  form.querySelector('[type="submit"]').disabled = !size || quantity < 1 || quantity > remaining;
}
function updateShirtDetailPrice() {
  const form = document.querySelector('#add-to-cart.shirt-buy-form');
  if (!form) return;
  const product = products().find(item => item.id === form.dataset.productId);
  const size = form.elements.size.value;
  const inCart = cart.filter(item => item.productId === product.id && item.size === size).reduce((sum, item) => sum + item.quantity, 0);
  const remaining = Math.max(0, shirtSizeStock(product, size) - inCart);
  form.elements.quantity.max = String(Math.min(remaining || 1, isThaiShirt(product) ? 5 : 99));
  document.querySelector('#shirt-stock-label').textContent = size ? `${remaining} ${remaining === 1 ? 'unidade disponível' : 'unidades disponíveis'} neste tamanho` : 'Selecione um tamanho para ver o estoque.';
  const quantity = Number(form.elements.quantity.value);
  const totalQuantity = quantity + cart.filter(item => item.productId === product.id).reduce((sum, item) => sum + item.quantity, 0);
  const unit = shirtUnitPrice(product, totalQuantity);
  document.querySelector('#shirt-unit-price').textContent = unit == null ? 'Consulte a loja' : money(unit);
  document.querySelector('#shirt-price-summary').textContent = unit == null ? 'A tabela aprovada cobre de 1 a 5 unidades deste modelo.' : `Subtotal do modelo na sacola: ${money(unit * totalQuantity)}${totalQuantity > quantity ? ` (${totalQuantity} peças)` : ''}`;
  const discount = document.querySelector('#shirt-discount');
  if (discount) discount.textContent = unit != null && totalQuantity > 1 ? `Desconto aplicado: ${money((THAI_SHIRT_PRICES[1] - unit) * totalQuantity)}` : '';
  form.querySelectorAll('[type="submit"]').forEach(button => { button.disabled = !size || quantity < 1 || quantity > remaining || unit == null; });
}
function cartPage() {
  const quantityFor = id => cart.filter(entry => entry.productId === id).reduce((sum, entry) => sum + entry.quantity, 0);
  let hasInvalid = false;
  const rows = cart.map((entry, index) => {
    const p = products().find(item => item.id === entry.productId);
    const unit = p ? shirtUnitPrice(p, quantityFor(p.id)) : null;
    const sizeTotal = p ? cart.filter(item => item.productId === p.id && item.size === entry.size).reduce((sum, item) => sum + item.quantity, 0) : 0;
    const capTotal = ['Bonés', 'Bermudas'].includes(p?.category) ? cart.filter(item => item.productId === p.id && item.size === entry.size && (item.color || '') === (entry.color || '')).reduce((sum, item) => sum + item.quantity, 0) : 0;
    const electronicColorTotal = isElectronic(p) ? cart.filter(item => item.productId === p.id && (item.color || '') === (entry.color || '')).reduce((sum, item) => sum + item.quantity, 0) : 0;
    const invalid = !p || quantityFor(p.id) > p.stock || (!['Bonés', 'Bermudas'].includes(p.category) && (p.sizes?.length ? !p.sizes.includes(entry.size) : Boolean(entry.size))) || (p?.category === 'Camisas' && (sizeTotal > shirtSizeStock(p, entry.size) || unit == null)) || (p?.category === 'Tênis' && (!entry.size || sizeTotal > shoeSizeStock(p, entry.size))) || (p?.category === 'Bonés' && capTotal > capVariantStock(p, entry.color || '', entry.size || '')) || (p?.category === 'Bermudas' && (!entry.size || capTotal > bermudaVariantStock(p, entry.color || '', entry.size || ''))) || (p?.category === 'Perfumes' && sizeTotal > perfumeVolumeStock(p, entry.size)) || (isElectronic(p) && (Boolean(entry.size) || electronicColorTotal > electronicVariantStock(p, entry.color || '')));
    if (invalid) hasInvalid = true;
    const max = p?.category === 'Camisas' ? Math.min(shirtSizeStock(p, entry.size), isThaiShirt(p) ? 5 : 99) : p?.category === 'Tênis' ? shoeSizeStock(p, entry.size) : p?.category === 'Bonés' ? capVariantStock(p, entry.color || '', entry.size || '') : p?.category === 'Bermudas' ? bermudaVariantStock(p, entry.color || '', entry.size || '') : p?.category === 'Perfumes' ? perfumeVolumeStock(p, entry.size) : isElectronic(p) ? electronicVariantStock(p, entry.color || '') : p?.stock || 99;
    return `<article class="cart-item ${invalid ? 'cart-item-invalid' : ''}">${p ? `<img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}">` : '<span class="cart-missing">BE</span>'}<div><h2>${escapeHtml(p?.name || 'Produto indisponível')}</h2><p>${entry.color ? `Cor ${escapeHtml(entry.color)} · ` : ''}${entry.size ? `${p?.category === 'Bonés' ? 'Ajuste' : p?.category === 'Perfumes' ? 'Volume' : 'Tamanho'} ${escapeHtml(entry.size)} · ` : ''}${unit == null ? 'Preço a confirmar' : money(unit)}${isThaiShirt(p) ? ' por peça · tabela progressiva' : ''}</p>${invalid ? '<p class="cart-warning">Atualize ou remova este item antes de finalizar.</p>' : ''}<div class="cart-item-actions"><label>Quantidade <input type="number" data-cart-quantity="${index}" min="1" max="${max}" value="${entry.quantity}"></label><button type="button" data-cart-remove="${index}">Remover</button></div></div><strong>${unit == null ? '—' : money(unit * entry.quantity)}</strong></article>`;
  });
  const subtotal = cart.reduce((sum, entry) => { const p = products().find(item => item.id === entry.productId); return sum + (p ? shirtUnitPrice(p, quantityFor(p.id)) || 0 : 0) * entry.quantity; }, 0);
  return `<section class="cart-page wrap"><span class="eyebrow">SEU PEDIDO</span><h1>Carrinho<span>.</span></h1>${cart.length ? `<div class="cart-layout"><div class="cart-list">${rows.join('')}</div><div class="cart-summary"><h2>Resumo</h2><p>Produtos <strong>${cartCount()}</strong></p><p>Subtotal <strong>${money(subtotal)}</strong></p><p>Frete <strong>A combinar</strong></p><small>O valor final, a disponibilidade e a entrega serão confirmados pela loja.</small><h3>Seus dados</h3><form id="checkout-form"><label>Nome<input name="name" value="${escapeHtml(customerDraft.name)}" autocomplete="name" maxlength="100" required></label><label>Cidade<input name="city" value="${escapeHtml(customerDraft.city)}" autocomplete="address-level2" maxlength="100" required></label><label>CEP para consultar a entrega (opcional)<input name="postalCode" value="${escapeHtml(customerDraft.postalCode)}" inputmode="numeric" pattern="[0-9]{5}-?[0-9]{3}" placeholder="00000-000"></label><label>Observação (opcional)<textarea name="note" maxlength="300">${escapeHtml(customerDraft.note)}</textarea></label><button class="button gold" type="submit" ${!contactUrl() || hasInvalid ? 'disabled' : ''}>Preparar pedido pelo WhatsApp</button></form>${!contactUrl() ? '<p class="cart-warning">O WhatsApp comercial ainda não foi configurado. Você pode montar o carrinho e falar com a loja pelo Instagram.</p>' : ''}<div id="checkout-feedback" role="status"></div></div></div>` : `<div class="cart-empty">${emptyState('Seu carrinho está vazio', 'Escolha os produtos que deseja consultar.', '/produtos')}</div>`}</section>`;
}
export function navigate(url, replace = false) {
  const target = new URL(url, location.origin);
  if (target.origin !== location.origin) return;
  history[replace ? 'replaceState' : 'pushState']({}, '', target.pathname + target.search + target.hash);
  closeMenu(); render();
  if (target.hash) requestAnimationFrame(() => document.querySelector(target.hash)?.scrollIntoView({ behavior: 'smooth' }));
  else scrollTo(0, 0);
}
async function render() {
  updateHeader();
  const path = location.pathname;
  if (path === '/admin') {
    document.title = 'Painel — BE IMPORTS';
    const { renderAdmin } = await import('/admin.js');
    await renderAdmin(app, async () => { const response = await fetch('/api/catalog', { cache: 'no-store' }); if (!response.ok) throw new Error('Não foi possível atualizar a vitrine.'); catalog = await response.json(); });
    return;
  }
  const page = path === '/' ? home() : path === '/produtos' ? productsPage() : path === '/categorias' ? categoryPage() : path === '/ofertas' ? offersPage() : path === '/nossa-loja' ? storePage() : path === '/contato' ? contactPage() : path === '/carrinho' ? cartPage() : path.startsWith('/produto/') ? detailPage(decodeURIComponent(path.slice(9))) : emptyState('Página não encontrada', 'Volte ao início para continuar.', '/');
  app.innerHTML = publicNav() + page;
  const navStrip = app.querySelector('.home-nav-inner');
  const selectedTab = navStrip.querySelector('.is-current');
  if (selectedTab) navStrip.scrollLeft = selectedTab.getBoundingClientRect().left - navStrip.getBoundingClientRect().left + navStrip.scrollLeft - (navStrip.clientWidth - selectedTab.clientWidth) / 2;
  if (path === '/produtos') renderResults();
  if (path === '/ofertas') renderOfferResults(products(), new URLSearchParams(location.search));
  if (path === '/' && selectedHomeCategory() === 'Camisas') renderShirtResults();
  if (path === '/' && selectedHomeCategory() === 'Tênis') renderShoeResults();
  if (path === '/' && selectedHomeCategory() === 'Bonés') renderCapResults();
  if (path === '/' && selectedHomeCategory() === 'Bermudas') renderBermudaResults(products().filter(product => product.category === 'Bermudas' && product.status === 'published'), new URLSearchParams(location.search));
  if (path === '/' && selectedHomeCategory() === 'Perfumes') renderPerfumeResults(products().filter(product => product.category === 'Perfumes' && product.status === 'published'), new URLSearchParams(location.search));
  if (path === '/' && selectedHomeCategory() === 'Eletrônicos') renderElectronicResults(electronicProducts(), new URLSearchParams(location.search));
  if (app.querySelector('.shirt-buy-form')) updateShirtDetailPrice();
  if (app.querySelector('.shoe-buy-form')) updateShoeDetail();
  if (app.querySelector('.cap-buy-form')) updateCapDetail();
  if (app.querySelector('.bermuda-buy-form')) { const form = app.querySelector('.bermuda-buy-form'); updateBermudaDetail(form, products().find(product => product.id === form.dataset.productId), cart); }
  if (app.querySelector('.perfume-buy-form')) { const form = app.querySelector('.perfume-buy-form'); updatePerfumeDetail(form, products().find(product => product.id === form.dataset.productId), cart); }
  if (app.querySelector('.electronic-buy-form')) { const form = app.querySelector('.electronic-buy-form'); updateElectronicDetail(form, products().find(product => product.id === form.dataset.productId), cart); }
  document.title = `${({ '/': 'Início', '/produtos': 'Produtos', '/categorias': 'Categorias', '/ofertas': 'Ofertas', '/nossa-loja': 'Nossa Loja', '/contato': 'Contato', '/carrinho': 'Carrinho' })[path] || 'Produto'} — BE IMPORTS`;
}
async function refresh() {
  if (location.pathname === '/' && ['', 'Acessórios'].includes(selectedHomeCategory())) {
    app.innerHTML = `${homeHero(selectedHomeCategory(), 'da loja')}<div class="loading-state">Carregando produtos…</div>`;
  }
  if (location.pathname === '/produtos') app.innerHTML = '<section class="products-collection wrap" aria-label="Carregando produtos"><div class="products-heading"><span class="eyebrow">CATÁLOGO</span><h2>Carregando produtos…</h2></div><div class="catalog-skeleton" aria-hidden="true"><div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div></div></section>';
  try {
    const res = await fetch('/api/catalog', { cache: 'no-store' });
    if (!res.ok) throw new Error('catalog');
    catalog = await res.json(); await render();
    if (location.hash) requestAnimationFrame(() => document.querySelector(location.hash)?.scrollIntoView());
  } catch { app.innerHTML = emptyState('Não foi possível carregar a loja', 'Houve um erro de conexão. Tente atualizar a página em alguns instantes.'); }
}

menuButton.addEventListener('click', () => { const open = menuButton.getAttribute('aria-expanded') !== 'true'; nav.classList.toggle('is-open', open); menuButton.setAttribute('aria-expanded', String(open)); menuButton.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu'); });
document.addEventListener('click', event => {
  const electronicPhoto = event.target.closest('[data-electronic-photo]');
  if (electronicPhoto) { document.querySelector('#detail-media-main').innerHTML = `<img src="${escapeHtml(electronicPhoto.dataset.electronicPhoto)}" alt="Foto de ${escapeHtml(document.querySelector('.electronic-detail-info h1')?.textContent || 'eletrônico')}">`; document.querySelectorAll('[data-electronic-photo]').forEach(button => button.setAttribute('aria-pressed', String(button === electronicPhoto))); return; }
  const electronicChip = event.target.closest('[data-electronic-type]');
  if (electronicChip) { updateElectronicQuery({ tipo: electronicChip.dataset.electronicType }); return; }
  if (event.target.closest('#electronic-filter-toggle')) { const button = event.target.closest('#electronic-filter-toggle'); button.setAttribute('aria-expanded', String(button.getAttribute('aria-expanded') !== 'true')); return; }
  if (event.target.id === 'electronic-clear-filters') { navigate('/?categoria=Eletr%C3%B4nicos#catalogo-eletronicos', true); return; }
  const perfumePhoto = event.target.closest('[data-perfume-photo]');
  if (perfumePhoto) { document.querySelector('#detail-media-main').innerHTML = `<img src="${escapeHtml(perfumePhoto.dataset.perfumePhoto)}" alt="Foto de ${escapeHtml(document.querySelector('.perfume-detail-info h1')?.textContent || 'perfume')}">`; document.querySelectorAll('[data-perfume-photo]').forEach(button => button.setAttribute('aria-pressed', String(button === perfumePhoto))); return; }
  const perfumeChip = event.target.closest('[data-perfume-group]');
  if (perfumeChip) { updatePerfumeQuery({ grupo: perfumeChip.dataset.perfumeGroup }); return; }
  if (event.target.closest('#perfume-filter-toggle')) { const button = event.target.closest('#perfume-filter-toggle'); button.setAttribute('aria-expanded', String(button.getAttribute('aria-expanded') !== 'true')); return; }
  if (event.target.id === 'perfume-clear-filters') { navigate('/?categoria=Perfumes#catalogo-perfumes', true); return; }
  const bermudaPhoto = event.target.closest('[data-bermuda-photo]');
  if (bermudaPhoto) { document.querySelector('#detail-media-main').innerHTML = `<img src="${escapeHtml(bermudaPhoto.dataset.bermudaPhoto)}" alt="Foto de ${escapeHtml(document.querySelector('.bermuda-detail-info h1')?.textContent || 'bermuda')}">`; document.querySelectorAll('[data-bermuda-photo]').forEach(button => button.setAttribute('aria-pressed', String(button === bermudaPhoto))); return; }
  const bermudaChip = event.target.closest('[data-bermuda-type]');
  if (bermudaChip) { const type = bermudaChip.dataset.bermudaType; updateBermudaQuery({ tipo: new URLSearchParams(location.search).get('tipo') === type ? '' : type }); return; }
  if (event.target.closest('#bermuda-filter-toggle')) { const button = event.target.closest('#bermuda-filter-toggle'); button.setAttribute('aria-expanded', String(button.getAttribute('aria-expanded') !== 'true')); return; }
  if (event.target.id === 'bermuda-clear-filters') { navigate('/?categoria=Bermudas#catalogo-bermudas', true); return; }
  const capPhoto = event.target.closest('[data-cap-photo]');
  if (capPhoto) { document.querySelector('#detail-media-main').innerHTML = `<img src="${escapeHtml(capPhoto.dataset.capPhoto)}" alt="Foto de ${escapeHtml(document.querySelector('.cap-detail-info h1')?.textContent || 'boné')}">`; document.querySelectorAll('[data-cap-photo]').forEach(button => button.setAttribute('aria-pressed', String(button === capPhoto))); return; }
  const capChip = event.target.closest('[data-cap-all],[data-cap-type],[data-cap-brand]');
  if (capChip) { const query = new URLSearchParams(location.search); if (capChip.hasAttribute('data-cap-all')) updateCapQuery({ tipo: '', marca: '' }); else if (capChip.hasAttribute('data-cap-type')) updateCapQuery({ tipo: query.get('tipo') === capChip.dataset.capType ? '' : capChip.dataset.capType }); else updateCapQuery({ marca: query.get('marca') === capChip.dataset.capBrand ? '' : capChip.dataset.capBrand }); return; }
  if (event.target.closest('#cap-filter-toggle')) { const button = event.target.closest('#cap-filter-toggle'); button.setAttribute('aria-expanded', String(button.getAttribute('aria-expanded') !== 'true')); return; }
  if (event.target.id === 'cap-clear-filters') { navigate('/?categoria=Bon%C3%A9s#catalogo-bones', true); return; }
  const shoePhoto = event.target.closest('[data-shoe-photo]');
  if (shoePhoto) { document.querySelector('#detail-media-main').innerHTML = `<img src="${escapeHtml(shoePhoto.dataset.shoePhoto)}" alt="Foto de ${escapeHtml(document.querySelector('.shoe-detail-info h1')?.textContent || 'tênis')}">`; document.querySelectorAll('[data-shoe-photo]').forEach(button => button.setAttribute('aria-pressed', String(button === shoePhoto))); return; }
  const shoeChip = event.target.closest('[data-shoe-all],[data-shoe-type],[data-shoe-brand]');
  if (shoeChip) { if (shoeChip.hasAttribute('data-shoe-all')) updateShoeQuery({ tipo: '', marca: '' }); else if (shoeChip.hasAttribute('data-shoe-type')) updateShoeQuery({ tipo: shoeChip.dataset.shoeType, marca: '' }); else updateShoeQuery({ tipo: '', marca: shoeChip.dataset.shoeBrand }); return; }
  const shoeSize = event.target.closest('[data-shoe-size]');
  if (shoeSize) { updateShoeQuery({ numero: new URLSearchParams(location.search).get('numero') === shoeSize.dataset.shoeSize ? '' : shoeSize.dataset.shoeSize }); return; }
  if (event.target.id === 'shoe-filter-toggle') { const button = event.target; button.setAttribute('aria-expanded', String(button.getAttribute('aria-expanded') !== 'true')); return; }
  if (event.target.id === 'shoe-clear-filters') { navigate('/?categoria=T%C3%AAnis#catalogo-tenis', true); return; }
  const demoIntent = event.target.closest('[data-demo-intent]');
  if (demoIntent) { document.querySelector('#cart-feedback').textContent = demoIntent.dataset.demoIntent === 'whatsapp' ? 'Esta camisa é demonstrativa e ainda não pode ser solicitada pelo WhatsApp.' : 'Esta camisa é demonstrativa e ainda não pode ser adicionada à sacola.'; return; }
  const shirtPhoto = event.target.closest('[data-shirt-photo]');
  if (shirtPhoto) { document.querySelector('#detail-media-main').innerHTML = `<img src="${escapeHtml(shirtPhoto.dataset.shirtPhoto)}" alt="Foto de ${escapeHtml(document.querySelector('.shirt-detail-info h1')?.textContent || 'camisa')}">`; document.querySelectorAll('[data-shirt-photo]').forEach(button => button.setAttribute('aria-pressed', String(button === shirtPhoto))); return; }
  if (event.target.closest('#shirt-filter-toggle')) { const button = event.target.closest('#shirt-filter-toggle'); button.setAttribute('aria-expanded', String(button.getAttribute('aria-expanded') !== 'true')); return; }
  const shirtSub = event.target.closest('[data-shirt-sub]');
  if (shirtSub) { document.querySelector('#shirt-filters [name="sub"]').value = shirtSub.dataset.shirtSub; updateShirtQuery({ sub: shirtSub.dataset.shirtSub }); return; }
  if (event.target.id === 'shirt-clear-filters') { history.replaceState({}, '', '/?categoria=Camisas#catalogo-camisas'); render(); document.querySelector('#catalogo-camisas')?.scrollIntoView(); return; }
  if (event.target.closest('[data-header-search]')) { event.preventDefault(); navigate('/produtos#catalogo'); requestAnimationFrame(() => document.querySelector('#catalog-search')?.focus()); return; }
  const categoryStep = event.target.closest('[data-home-category-step]');
  if (categoryStep) { const track = document.querySelector('.home-category-track'); const card = track?.querySelector('.home-category-card'); if (track && card) track.scrollBy({ left: Number(categoryStep.dataset.homeCategoryStep) * (card.getBoundingClientRect().width + 16), behavior: 'smooth' }); return; }
  const mediaStep = event.target.closest('[data-media-step]');
  const mediaChoice = event.target.closest('[data-detail-media]');
  if (mediaStep || mediaChoice) {
    const choices = [...document.querySelectorAll('[data-detail-media]')];
    const current = choices.findIndex(button => button.getAttribute('aria-pressed') === 'true');
    const selected = mediaChoice || choices[(current + Number(mediaStep.dataset.mediaStep) + choices.length) % choices.length];
    choices.forEach(button => button.setAttribute('aria-pressed', String(button === selected)));
    const src = escapeHtml(selected.dataset.mediaSrc);
    const alt = escapeHtml(selected.dataset.mediaAlt);
    document.querySelector('#detail-media-main').innerHTML = selected.dataset.mediaType === 'video' ? `<iframe src="${src}" title="Vídeo de ${alt}" loading="lazy" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>` : `<img src="${src}" alt="${alt}">`;
    return;
  }
  const remove = event.target.closest('[data-cart-remove]');
  if (remove) { cart.splice(Number(remove.dataset.cartRemove), 1); saveCart(); render(); return; }
  if (event.target.closest('[data-hero-catalog]')) { event.preventDefault(); navigate('/produtos#catalogo', true); return; }
  if (event.target.closest('#filter-toggle')) { const button = event.target.closest('#filter-toggle'); button.setAttribute('aria-expanded', String(button.getAttribute('aria-expanded') !== 'true')); return; }
  const link = event.target.closest('a[data-link]');
  if (link && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); navigate(link.href); return; }
  const chip = event.target.closest('[data-category]');
  if (chip) { const q = new URLSearchParams(location.search); chip.dataset.category ? q.set('categoria', chip.dataset.category) : q.delete('categoria'); navigate(`/produtos${q.size ? `?${q}` : ''}#catalogo`, true); return; }
  if (event.target.id === 'clear-filters') { navigate('/produtos', true); document.querySelector('#catalogo')?.scrollIntoView(); }
});
document.addEventListener('change', event => {
  if (event.target.closest('#add-to-cart.electronic-buy-form')) { const form = event.target.closest('.electronic-buy-form'); updateElectronicDetail(form, products().find(product => product.id === form.dataset.productId), cart); return; }
  if (event.target.closest('#electronic-filters') || event.target.id === 'electronic-sort') { const form = document.querySelector('#electronic-filters'); const values = {}; for (const name of ['q', 'tipo', 'marca', 'min', 'max']) values[name] = form.elements.namedItem(name)?.value.trim() || ''; values.disponivel = form.elements.namedItem('disponivel').checked ? '1' : ''; values.ordem = document.querySelector('#electronic-sort').value === 'price-asc' ? '' : document.querySelector('#electronic-sort').value; updateElectronicQuery(values); return; }
  if (event.target.closest('#add-to-cart.perfume-buy-form')) { const form = event.target.closest('.perfume-buy-form'); updatePerfumeDetail(form, products().find(product => product.id === form.dataset.productId), cart); return; }
  if (event.target.closest('#perfume-filters') || event.target.id === 'perfume-sort') { const form = document.querySelector('#perfume-filters'); const values = {}; for (const name of ['q', 'marca', 'tipo', 'origem', 'volume', 'concentracao', 'min', 'max']) values[name] = form.elements.namedItem(name)?.value.trim() || ''; values.disponivel = form.elements.namedItem('disponivel').checked ? '1' : ''; values.ordem = document.querySelector('#perfume-sort').value === 'price-asc' ? '' : document.querySelector('#perfume-sort').value; updatePerfumeQuery(values); return; }
  if (event.target.closest('#add-to-cart.bermuda-buy-form')) { const form = event.target.closest('.bermuda-buy-form'); updateBermudaDetail(form, products().find(product => product.id === form.dataset.productId), cart); return; }
  if (event.target.closest('#bermuda-filters') || event.target.id === 'bermuda-sort') { const form = document.querySelector('#bermuda-filters'); const values = {}; for (const name of ['q', 'tamanho', 'cor', 'min', 'max']) values[name] = form.elements.namedItem(name).value.trim(); values.tipo = form.elements.namedItem('tipo').value; values.disponivel = form.elements.namedItem('disponivel').checked ? '1' : ''; values.ordem = document.querySelector('#bermuda-sort').value === 'price-asc' ? '' : document.querySelector('#bermuda-sort').value; updateBermudaQuery(values); return; }
  if (event.target.closest('#add-to-cart.cap-buy-form')) { updateCapDetail(); return; }
  if (event.target.closest('#cap-filters') || event.target.id === 'cap-sort') { const form = document.querySelector('#cap-filters'); const values = {}; for (const name of ['q', 'min', 'max']) values[name] = form.elements.namedItem(name).value.trim(); values.marca = form.elements.namedItem('marca').value; values.tipo = form.elements.namedItem('tipo').value; values.cor = form.elements.namedItem('cor')?.value || ''; values.disponivel = form.elements.namedItem('disponivel').checked ? '1' : ''; values.ordem = document.querySelector('#cap-sort').value === 'price-asc' ? '' : document.querySelector('#cap-sort').value; updateCapQuery(values); return; }
  if (event.target.closest('#add-to-cart.shoe-buy-form')) { updateShoeDetail(); return; }
  if (event.target.closest('#add-to-cart.shirt-buy-form')) { updateShirtDetailPrice(); return; }
  if (event.target.closest('#shoe-filters') || event.target.id === 'shoe-sort') { const form = document.querySelector('#shoe-filters'); const values = {}; for (const name of ['q', 'min', 'max']) values[name] = form.elements.namedItem(name).value.trim(); values.marca = form.elements.namedItem('marca').value; values.ordem = document.querySelector('#shoe-sort').value === 'price-asc' ? '' : document.querySelector('#shoe-sort').value; updateShoeQuery(values); return; }
  if (event.target.closest('#shirt-filters') || event.target.id === 'shirt-sort') { const form = document.querySelector('#shirt-filters'); const values = {}; for (const name of ['q', 'sub', 'tamanho', 'cor', 'min', 'max']) { const input = form.elements.namedItem(name); if (input) values[name] = input.value.trim(); } values.disponivel = form.elements.disponivel.checked ? '1' : ''; values.ordem = document.querySelector('#shirt-sort').value === 'price-asc' ? '' : document.querySelector('#shirt-sort').value; updateShirtQuery(values); return; }
  if (event.target.matches('[data-cart-quantity]')) {
    const entry = cart[Number(event.target.dataset.cartQuantity)];
    const product = products().find(p => p.id === entry?.productId);
    if (entry && product) { const cap = product.category === 'Camisas' ? Math.min(shirtSizeStock(product, entry.size), isThaiShirt(product) ? 5 - cart.filter((item, at) => at !== Number(event.target.dataset.cartQuantity) && item.productId === product.id).reduce((sum, item) => sum + item.quantity, 0) : 99) : product.category === 'Tênis' ? shoeSizeStock(product, entry.size) : product.category === 'Bonés' || product.category === 'Bermudas' ? Math.min(product.category === 'Bonés' ? capVariantStock(product, entry.color || '', entry.size || '') : bermudaVariantStock(product, entry.color || '', entry.size || ''), product.stock - cart.filter((item, at) => at !== Number(event.target.dataset.cartQuantity) && item.productId === product.id).reduce((sum, item) => sum + item.quantity, 0)) : product.category === 'Perfumes' ? Math.min(perfumeVolumeStock(product, entry.size), product.stock - cart.filter((item, at) => at !== Number(event.target.dataset.cartQuantity) && item.productId === product.id).reduce((sum, item) => sum + item.quantity, 0)) : isElectronic(product) ? Math.min(electronicVariantStock(product, entry.color || ''), product.stock - cart.filter((item, at) => at !== Number(event.target.dataset.cartQuantity) && item.productId === product.id).reduce((sum, item) => sum + item.quantity, 0)) : product.stock || 1; entry.quantity = Math.max(1, Math.min(cap, Number(event.target.value) || 1)); }
    saveCart(); render(); return;
  }
  if (event.target.closest('#filters') || event.target.id === 'sort') {
    const q = new URLSearchParams(location.search), form = document.querySelector('#filters');
    for (const name of ['categoria', 'min', 'max']) { const value = form.elements[name].value; value ? q.set(name, value) : q.delete(name); }
    form.elements.disponivel.checked ? q.set('disponivel', '1') : q.delete('disponivel');
    event.target.id === 'sort' ? q.set('ordem', event.target.value) : null;
    history.replaceState({}, '', `/produtos${q.size ? `?${q}` : ''}`);
    if (event.target.name === 'categoria') { render(); } else renderResults();
  }
});
let searchTimer;
document.addEventListener('input', event => {
  if (event.target.closest('#add-to-cart.electronic-buy-form') && event.target.name === 'quantity') { const form = event.target.closest('.electronic-buy-form'); updateElectronicDetail(form, products().find(product => product.id === form.dataset.productId), cart); return; }
  if (event.target.closest('#electronic-filters') && event.target.name === 'q') { clearTimeout(searchTimer); const value = event.target.value.trim(); searchTimer = setTimeout(() => updateElectronicQuery({ q: value }), 180); return; }
  if (event.target.closest('#add-to-cart.perfume-buy-form') && event.target.name === 'quantity') { const form = event.target.closest('.perfume-buy-form'); updatePerfumeDetail(form, products().find(product => product.id === form.dataset.productId), cart); return; }
  if (event.target.closest('#perfume-filters') && event.target.name === 'q') { clearTimeout(searchTimer); const value = event.target.value.trim(); searchTimer = setTimeout(() => updatePerfumeQuery({ q: value }), 180); return; }
  if (event.target.closest('#add-to-cart.bermuda-buy-form') && event.target.name === 'quantity') { const form = event.target.closest('.bermuda-buy-form'); updateBermudaDetail(form, products().find(product => product.id === form.dataset.productId), cart); return; }
  if (event.target.closest('#bermuda-filters') && event.target.name === 'q') { clearTimeout(searchTimer); const value = event.target.value.trim(); searchTimer = setTimeout(() => updateBermudaQuery({ q: value }), 180); return; }
  if (event.target.closest('#add-to-cart.cap-buy-form') && event.target.name === 'quantity') { updateCapDetail(); return; }
  if (event.target.closest('#cap-filters') && event.target.name === 'q') { clearTimeout(searchTimer); const value = event.target.value.trim(); searchTimer = setTimeout(() => updateCapQuery({ q: value }), 180); return; }
  if (event.target.closest('#add-to-cart.shoe-buy-form') && event.target.name === 'quantity') { updateShoeDetail(); return; }
  if (event.target.closest('#add-to-cart.shirt-buy-form')) { updateShirtDetailPrice(); return; }
  if (event.target.closest('#shoe-filters') && event.target.name === 'q') { clearTimeout(searchTimer); const value = event.target.value.trim(); searchTimer = setTimeout(() => updateShoeQuery({ q: value }), 180); return; }
  if (event.target.closest('#shirt-filters') && event.target.name === 'q') { clearTimeout(searchTimer); const value = event.target.value.trim(); searchTimer = setTimeout(() => updateShirtQuery({ q: value }), 180); return; }
  if (event.target.closest('#checkout-form') && event.target.name in customerDraft) {
    customerDraft[event.target.name] = event.target.value;
    const feedback = document.querySelector('#checkout-feedback');
    if (feedback?.querySelector('a')) feedback.textContent = 'Dados alterados. Prepare o pedido novamente.';
  }
  if (event.target.id !== 'catalog-search') return;
  clearTimeout(searchTimer);
  const value = event.target.value;
  searchTimer = setTimeout(() => { const q = new URLSearchParams(location.search); value.trim() ? q.set('q', value.trim()) : q.delete('q'); history.replaceState({}, '', `/produtos${q.size ? `?${q}` : ''}`); renderResults(); }, 180);
});
document.addEventListener('submit', async event => {
  if (event.target.matches('.home-search-form')) {
    event.preventDefault();
    const query = event.target.elements.q.value.trim();
    navigate(`/produtos${query ? `?q=${encodeURIComponent(query)}` : ''}#catalogo`);
    return;
  }
  if (event.target.id === 'add-to-cart') {
    event.preventDefault();
    const form = event.target;
    const product = products().find(p => p.id === form.dataset.productId);
    if (!product || isDemoProduct(product) || product.stock < 1) return;
    const size = form.elements.namedItem('size')?.value || '';
    const color = ['Bonés', 'Bermudas'].includes(product.category) || isElectronic(product) ? form.elements.namedItem('color')?.value || '' : '';
    const quantity = Number(form.elements.namedItem('quantity').value);
    if ((product.sizes?.length && !product.sizes.includes(size)) || !Number.isSafeInteger(quantity) || quantity < 1) return;
    const current = cart.find(item => item.productId === product.id && item.size === size && (item.color || '') === color);
    const total = cart.filter(item => item.productId === product.id).reduce((sum, item) => sum + item.quantity, 0);
    if (product.category === 'Camisas' && (current?.quantity || 0) + quantity > shirtSizeStock(product, size)) { document.querySelector('#cart-feedback').textContent = 'Quantidade acima do estoque deste tamanho.'; return; }
    if (product.category === 'Tênis' && (!size || (current?.quantity || 0) + quantity > shoeSizeStock(product, size))) { document.querySelector('#cart-feedback').textContent = 'Quantidade acima do estoque desta numeração.'; return; }
    if (product.category === 'Bonés' && (current?.quantity || 0) + quantity > capVariantStock(product, color, size)) { document.querySelector('#cart-feedback').textContent = 'Quantidade acima do estoque desta variação.'; return; }
    if (product.category === 'Bermudas' && (!size || (current?.quantity || 0) + quantity > bermudaVariantStock(product, color, size))) { document.querySelector('#cart-feedback').textContent = 'Quantidade acima do estoque desta variação.'; return; }
    if (product.category === 'Perfumes' && (product.sizes?.length && !size || (current?.quantity || 0) + quantity > perfumeVolumeStock(product, size))) { document.querySelector('#cart-feedback').textContent = 'Quantidade acima do estoque deste volume.'; return; }
    if (isElectronic(product) && ((product.electronicsVariants?.length && !color) || (current?.quantity || 0) + quantity > electronicVariantStock(product, color))) { document.querySelector('#cart-feedback').textContent = 'Quantidade acima do estoque desta variação.'; return; }
    if (isThaiShirt(product) && shirtUnitPrice(product, total + quantity) == null) { document.querySelector('#cart-feedback').textContent = 'A tabela aprovada cobre de 1 a 5 camisas deste modelo.'; return; }
    if (total + quantity > product.stock) { document.querySelector('#cart-feedback').textContent = 'Quantidade acima do estoque disponível.'; return; }
    if (event.submitter?.value === 'whatsapp' && product.category === 'Camisas') {
      const url = contactUrl(`Olá! Tenho interesse em ${product.name}, tamanho ${size}, ${quantity} ${quantity === 1 ? 'unidade' : 'unidades'}. Valor exibido: ${money(shirtUnitPrice(product, quantity) * quantity)}. Pode confirmar a disponibilidade e a entrega?`);
      if (!url) { document.querySelector('#cart-feedback').textContent = 'O WhatsApp comercial ainda não foi configurado pela loja.'; return; }
      window.open(url, '_blank', 'noopener,noreferrer');
      document.querySelector('#cart-feedback').textContent = 'Conversa do WhatsApp aberta para confirmar o pedido com a loja.';
      return;
    }
    if (product.category === 'Tênis') customerDraft.postalCode = form.elements.namedItem('postalCode')?.value.trim() || customerDraft.postalCode;
    if (product.category === 'Bonés') customerDraft.postalCode = form.elements.namedItem('postalCode')?.value.trim() || customerDraft.postalCode;
    if (product.category === 'Bermudas') customerDraft.postalCode = form.elements.namedItem('postalCode')?.value.trim() || customerDraft.postalCode;
    if (product.category === 'Perfumes') customerDraft.postalCode = form.elements.namedItem('postalCode')?.value.trim() || customerDraft.postalCode;
    if (isElectronic(product)) customerDraft.postalCode = form.elements.namedItem('postalCode')?.value.trim() || customerDraft.postalCode;
    if (current) current.quantity += quantity; else cart.push({ productId: product.id, size, ...(['Bonés', 'Bermudas'].includes(product.category) || isElectronic(product) ? { color } : {}), quantity });
    saveCart(); navigate('/carrinho'); return;
  }
  if (event.target.id === 'checkout-form') {
    event.preventDefault();
    const feedback = document.querySelector('#checkout-feedback');
    const button = event.target.querySelector('[type="submit"]');
    button.disabled = true; feedback.textContent = 'Conferindo produtos e estoque…';
    try {
      const response = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: cart, customer: customerDraft }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível preparar o pedido.');
      feedback.innerHTML = `<p>Pedido conferido. Subtotal: <strong>${money(result.subtotal)}</strong>. Frete a combinar.</p><a class="button gold" href="${escapeHtml(result.whatsappUrl)}" target="_blank" rel="noopener noreferrer">Abrir WhatsApp e enviar pedido ↗</a>`;
    } catch (error) { feedback.textContent = error.message; }
    finally { if (button.isConnected) button.disabled = false; }
  }
});
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
window.addEventListener('popstate', render);
document.querySelector('#year').textContent = new Date().getFullYear();
refresh();
