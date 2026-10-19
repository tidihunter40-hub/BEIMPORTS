const CATEGORY_NAMES = ['Camisas', 'Tênis', 'Bonés', 'Bermudas', 'Perfumes', 'Eletrônicos', 'Acessórios'];
const CATEGORY_IMAGES = { Camisas: 'camisas', 'Tênis': 'tenis', 'Bonés': 'bones', Bermudas: 'bermudas', Perfumes: 'perfumes', 'Eletrônicos': 'eletronicos', 'Acessórios': 'acessorios' };
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const demo = product => String(product.description || '').startsWith('[DEMO]');
const normalized = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
export const offerDiscount = product => Math.round((1 - Number(product.price) / Number(product.compareAt)) * 100);

export function activeOffers(products, now = new Date()) {
  return products.filter(product => {
    if (product.status !== 'published' || !(Number(product.compareAt) > Number(product.price))) return false;
    if (product.promotionStart && new Date(product.promotionStart) > now) return false;
    if (product.promotionEnd && new Date(product.promotionEnd) < now) return false;
    return true;
  });
}

export function filterOffers(products, params) {
  const query = params instanceof URLSearchParams ? params : new URLSearchParams(params);
  const category = query.get('categoria') || '';
  const search = normalized(query.get('q')).trim();
  const min = query.get('min') === null ? 0 : Number(query.get('min'));
  const max = query.get('max') === null ? Infinity : Number(query.get('max'));
  const discount = Number(query.get('desconto') || 0);
  const order = query.get('ordem') || 'price-asc';
  return activeOffers(products).filter(product =>
    (!category || product.category === category) &&
    (!search || normalized(`${product.name} ${product.brand || ''} ${product.shoeType || ''} ${product.capType || ''} ${product.bermudaType || ''} ${product.subcategory || ''}`).includes(search)) &&
    Number(product.price) >= min && Number(product.price) <= max &&
    offerDiscount(product) >= discount &&
    (query.get('disponivel') !== '1' || (!demo(product) && Number(product.stock) > 0))
  ).sort((a, b) => {
    if (order === 'price-desc') return b.price - a.price;
    if (order === 'discount-desc') return offerDiscount(b) - offerDiscount(a) || a.price - b.price;
    if (order === 'recent') return Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0);
    if (order === 'name') return a.name.localeCompare(b.name, 'pt-BR');
    return a.price - b.price;
  });
}

function variants(product) {
  if (product.category === 'Bonés') return [...new Set((product.capVariants || []).filter(item => demo(product) || item.stock > 0).flatMap(item => [item.color, item.size]).filter(Boolean))];
  if (product.category === 'Bermudas') return [...new Set((product.bermudaVariants || []).filter(item => demo(product) || item.stock > 0).flatMap(item => [item.color, item.size]).filter(Boolean))];
  if (product.category === 'Camisas' || product.category === 'Tênis') return (product.sizes || []).filter(size => demo(product) || !product.stockBySize || !Object.keys(product.stockBySize).length || product.stockBySize[size] > 0);
  return product.sizes || [];
}

export function offerCard(product) {
  const href = `/produto/${encodeURIComponent(product.slug)}`;
  const choices = variants(product);
  return `<article class="offer-card"><a class="offer-card-photo" href="${href}" data-link><img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy" decoding="async"></a><span class="offer-discount">−${offerDiscount(product)}%</span><div class="offer-card-body">${demo(product) ? '<span class="offer-demo">PRODUTO DEMONSTRATIVO</span>' : ''}<small>${escapeHtml(product.category)}</small><h3><a href="${href}" data-link>${escapeHtml(product.name)}</a></h3><div class="offer-price"><strong>${money(product.price)}</strong><del>${money(product.compareAt)}</del></div><div class="offer-variants">${choices.length ? choices.slice(0, 7).map(choice => `<span>${escapeHtml(choice)}</span>`).join('') : '<span>Sem variações disponíveis</span>'}</div><p class="offer-stock">${demo(product) ? 'Prévia sem estoque para compra' : product.stock > 0 ? `${product.stock} ${product.stock === 1 ? 'unidade disponível' : 'unidades disponíveis'}` : 'Esgotado'}</p><a class="offer-card-action" href="${href}" data-link>VER DETALHES <span aria-hidden="true">→</span></a></div></article>`;
}

export function offersPage(products, categories, query, footer = '') {
  const all = activeOffers(products);
  const names = CATEGORY_NAMES.filter(name => categories.some(category => category.name === name));
  const categoryButton = (name, label) => `<button type="button" class="offer-chip" data-offer-category="${escapeHtml(name)}" aria-pressed="false">${name ? `<img src="/assets/home-reference/categoria-${CATEGORY_IMAGES[name]}.png" alt="" loading="lazy">` : '<span class="offer-chip-all" aria-hidden="true">%</span>'}<span>${escapeHtml(label)}</span></button>`;
  const counts = name => all.filter(product => product.category === name).length;
  const discountOptions = [10, 20, 30, 40, 50].filter(threshold => all.some(product => offerDiscount(product) >= threshold));
  return `<div class="offers-page"><section class="offers-hero" aria-labelledby="offers-title"><img class="offers-hero-scene" src="/assets/ofertas-hero-scene.png" alt="Loja de moda iluminada em dourado, com o mascote usando visor multicolorido e camisa quadriculada segurando uma sacola" width="1983" height="793" fetchpriority="high"><div class="offers-hero-shade"></div><img class="offers-bag-logo" src="/assets/logo-original.webp" alt="" aria-hidden="true"><img class="offers-shirt-logo" src="/assets/logo-original.webp" alt="" aria-hidden="true"><div class="offers-hero-content"><div class="offers-hero-copy"><div class="offers-breadcrumb"><a href="/" data-link>INÍCIO</a><span aria-hidden="true">›</span><strong>OFERTAS</strong></div><h1 id="offers-title">OFERTAS</h1><p>PRODUTOS SELECIONADOS<br>COM PREÇOS ESPECIAIS</p><a class="offers-hero-button" href="#catalogo-ofertas" data-link>APROVEITAR OFERTAS <span aria-hidden="true">→</span></a></div><p class="offers-hero-tagline">QUALIDADE,<br><em>ESTILO</em><br>E PREÇO BAIXO<br><em>EM UM SÓ LUGAR!</em></p></div></section><section class="offers-catalog" id="catalogo-ofertas"><div class="offers-wrap"><div class="offers-heading"><span>OFERTAS ESPECIAIS</span><h2>🔥 APROVEITE NOSSAS OFERTAS</h2><p>Seus produtos favoritos com preços especiais. Encontre sua próxima compra!</p></div><nav class="offers-subnav" aria-label="Categorias em oferta">${categoryButton('', 'Todos')}${names.map(name => categoryButton(name, name)).join('')}</nav><div class="offers-layout"><aside class="offers-filter-panel"><button type="button" id="offer-filter-toggle" aria-expanded="false" aria-controls="offer-filters">Filtrar por <span aria-hidden="true">⌄</span></button><form id="offer-filters"><label>Buscar produtos<input name="q" type="search" value="${escapeHtml(query.get('q') || '')}" placeholder="Nome, marca ou modelo" autocomplete="off"></label><fieldset><legend>Categorias</legend><div class="offer-options"><label><input type="radio" name="categoria" value="" ${!query.get('categoria') ? 'checked' : ''}> Todos <span>(${all.length})</span></label>${names.map(name => `<label><input type="radio" name="categoria" value="${escapeHtml(name)}" ${query.get('categoria') === name ? 'checked' : ''}> ${escapeHtml(name)} <span>(${counts(name)})</span></label>`).join('')}</div></fieldset><fieldset><legend>Faixa de preço</legend><div class="offer-price-fields"><label>Mínimo<input name="min" type="number" min="0" step="0.01" value="${escapeHtml(query.get('min') || '')}" placeholder="R$ 0"></label><label>Máximo<input name="max" type="number" min="0" step="0.01" value="${escapeHtml(query.get('max') || '')}" placeholder="Sem limite"></label></div></fieldset>${discountOptions.length ? `<label>Desconto mínimo<select name="desconto"><option value="">Todos os descontos</option>${discountOptions.map(value => `<option value="${value}" ${query.get('desconto') === String(value) ? 'selected' : ''}>${value}% ou mais</option>`).join('')}</select></label>` : ''}<label class="offer-availability"><input type="checkbox" name="disponivel" value="1" ${query.get('disponivel') === '1' ? 'checked' : ''}> Apenas em estoque</label><button type="button" id="offer-clear-filters">LIMPAR FILTROS</button></form></aside><div class="offers-main"><div class="offers-toolbar"><p id="offer-result-count" role="status"></p><label>Ordenar por: <select id="offer-sort"><option value="price-asc">Menor preço</option><option value="price-desc">Maior preço</option><option value="discount-desc">Maior desconto</option><option value="recent">Mais recentes</option><option value="name">Nome A–Z</option></select></label><div class="offers-view" aria-label="Visualização"><button type="button" data-offer-view="grid" aria-label="Visualização em grade" aria-pressed="true">▦</button><button type="button" data-offer-view="list" aria-label="Visualização em lista" aria-pressed="false">☷</button></div></div><div id="offer-results" class="offers-grid"></div></div></div></div></section>${footer}</div>`;
}

let offerProducts = [];
let searchTimer;
let offerView = 'grid';
export function renderOfferResults(products, query = new URLSearchParams(location.search), root = document) {
  offerProducts = products;
  const results = root.querySelector('#offer-results');
  if (!results) return;
  const matches = filterOffers(products, query);
  const total = activeOffers(products);
  root.querySelector('#offer-result-count').textContent = `${matches.length} ${matches.length === 1 ? 'produto em oferta' : 'produtos em oferta'}`;
  results.classList.toggle('is-list', offerView === 'list');
  results.innerHTML = matches.length ? matches.map(offerCard).join('') : total.length && query.size ? '<div class="offers-empty"><h3>Nenhum resultado para esses filtros</h3><p>Experimente outra categoria, preço ou desconto.</p><button type="button" id="offer-empty-clear">LIMPAR FILTROS</button></div>' : '<div class="offers-empty"><h3>NOVAS OFERTAS EM BREVE! 🔥</h3><p>Estamos preparando oportunidades especiais para você. Continue acompanhando a BE IMPORTS!</p><a href="/produtos" data-link>EXPLORAR PRODUTOS <span aria-hidden="true">→</span></a></div>';
  root.querySelectorAll('[data-offer-category]').forEach(button => { const selected = button.dataset.offerCategory === (query.get('categoria') || ''); button.classList.toggle('is-current', selected); button.setAttribute('aria-pressed', String(selected)); });
  root.querySelectorAll('#offer-filters [name="categoria"]').forEach(input => { input.checked = input.value === (query.get('categoria') || ''); });
  root.querySelector('#offer-sort').value = query.get('ordem') || 'price-asc';
  root.querySelectorAll('[data-offer-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.offerView === offerView)));
}

function updateOfferQuery(changes, clear = false) {
  const query = clear ? new URLSearchParams() : new URLSearchParams(location.search);
  for (const [name, value] of Object.entries(changes)) value === '' || value == null ? query.delete(name) : query.set(name, value);
  history.replaceState({}, '', `/ofertas${query.size ? `?${query}` : ''}#catalogo-ofertas`);
  if (clear) document.querySelector('#offer-filters')?.reset();
  renderOfferResults(offerProducts, query);
}

document.addEventListener('click', event => {
  if (!event.target.closest('.offers-page')) return;
  const category = event.target.closest('[data-offer-category]');
  if (category) { updateOfferQuery({ categoria: category.dataset.offerCategory }); return; }
  const view = event.target.closest('[data-offer-view]');
  if (view) { offerView = view.dataset.offerView; renderOfferResults(offerProducts); return; }
  if (event.target.closest('#offer-filter-toggle')) { const button = event.target.closest('#offer-filter-toggle'); button.setAttribute('aria-expanded', String(button.getAttribute('aria-expanded') !== 'true')); return; }
  if (event.target.closest('#offer-clear-filters, #offer-empty-clear')) updateOfferQuery({}, true);
});
document.addEventListener('change', event => {
  if (!event.target.closest('.offers-page')) return;
  const input = event.target;
  if (input.id === 'offer-sort') { updateOfferQuery({ ordem: input.value === 'price-asc' ? '' : input.value }); return; }
  if (input.closest('#offer-filters')) updateOfferQuery({ [input.name]: input.type === 'checkbox' ? input.checked ? '1' : '' : input.value });
});
document.addEventListener('input', event => {
  if (!event.target.closest('.offers-page #offer-filters') || event.target.name !== 'q') return;
  const value = event.target.value.trim();
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => updateOfferQuery({ q: value }), 180);
});
