const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const demo = product => String(product.description || '').startsWith('[DEMO]');
const types = ['Celulares', 'Notebooks', 'Fones de Ouvido', 'Caixas de Som', 'Smartwatches', 'Consoles', 'Acessórios', 'Drones', 'TVs e Monitores', 'Outros'];

export function electronicType(product) {
  if (product.category === 'Fones de ouvido') return 'Fones de Ouvido';
  if (types.includes(product.electronicsType)) return product.electronicsType;
  if (demo(product)) {
    if (/smartwatch|relógio inteligente/i.test(product.name)) return 'Smartwatches';
    if (/caixa de som/i.test(product.name)) return 'Caixas de Som';
  }
  return 'Outros';
}
export function electronicVariantStock(product, color = '') {
  if (!product.electronicsVariants?.length) return color ? 0 : product.stock || 0;
  return Number(product.electronicsVariants.find(item => item.color === color)?.stock || 0);
}
export function filterElectronics(all, query) {
  const q = (query.get('q') || '').trim().toLocaleLowerCase('pt-BR');
  const matches = all.filter(product => {
    if (query.get('tipo') && electronicType(product) !== query.get('tipo')) return false;
    if (query.get('marca') && product.brand !== query.get('marca')) return false;
    if (q && !`${product.name} ${product.brand || ''} ${product.electronicsModel || ''}`.toLocaleLowerCase('pt-BR').includes(q)) return false;
    if (query.get('min') && product.price < Number(query.get('min'))) return false;
    if (query.get('max') && product.price > Number(query.get('max'))) return false;
    if (query.get('disponivel') === '1' && (demo(product) || product.stock < 1)) return false;
    return true;
  });
  const order = query.get('ordem') || 'price-asc';
  matches.sort((a, b) => order === 'price-desc' ? b.price - a.price : order === 'recent' ? String(b.createdAt).localeCompare(String(a.createdAt)) : order === 'name' ? a.name.localeCompare(b.name, 'pt-BR') : a.price - b.price);
  return matches;
}

function electronicCard(product) {
  const href = `/produto/${encodeURIComponent(product.slug)}`;
  const discount = product.compareAt > product.price ? Math.round((1 - product.price / product.compareAt) * 100) : 0;
  return `<article class="electronic-card"><a class="electronic-card-photo" href="${href}" data-link><img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy" decoding="async"></a>${discount ? `<span class="electronic-sale">−${discount}%</span>` : ''}<div class="electronic-card-body">${demo(product) ? '<span class="demo-product-label">Produto demonstrativo</span>' : ''}<h3><a href="${href}" data-link>${escapeHtml(product.name)}</a></h3><p>${escapeHtml([product.brand, product.electronicsModel, electronicType(product)].filter(Boolean).join(' · '))}</p><div class="electronic-card-price"><strong>${money(product.price)}</strong>${discount ? `<del>${money(product.compareAt)}</del>` : ''}</div><small>${demo(product) ? 'Prévia sem estoque para compra' : product.stock ? `${product.stock} em estoque` : 'Esgotado'}</small><a class="electronic-card-action" href="${href}" data-link>VER DETALHES <span aria-hidden="true">→</span></a></div></article>`;
}

export function electronicsPage(all, query, footer) {
  const availableTypes = types.filter(type => all.some(product => electronicType(product) === type));
  const brands = [...new Set(all.map(product => product.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const chip = (label, value) => `<button type="button" class="electronic-chip${(query.get('tipo') || '') === value ? ' is-current' : ''}" data-electronic-type="${escapeHtml(value)}" aria-pressed="${(query.get('tipo') || '') === value}"><span aria-hidden="true">✦</span>${escapeHtml(label)}</button>`;
  return `<div class="electronics-page"><section class="electronics-hero" aria-labelledby="electronics-title"><img class="electronics-hero-scene" src="/assets/eletronicos-hero-scene.png" alt="Representante da BE IMPORTS com visor espelhado e camiseta listrada em uma loja de eletrônicos" width="1983" height="793" fetchpriority="high"><div class="electronics-hero-shade"></div><div class="electronics-hero-content wrap"><div class="electronics-hero-copy"><div class="electronics-breadcrumb"><a href="/" data-link>INÍCIO</a><span aria-hidden="true">›</span><strong>ELETRÔNICOS</strong></div><h1 id="electronics-title">ELETRÔNICOS</h1><p>TECNOLOGIA <b>•</b> PRATICIDADE <b>•</b> INOVAÇÃO<br>PARA O SEU DIA A DIA</p><a class="electronics-hero-button" href="#catalogo-eletronicos" data-link>VER PRODUTOS <span aria-hidden="true">→</span></a></div><p class="electronics-hero-tagline">Tecnologia que facilita<br>a sua <em>vida!</em></p></div></section><section class="electronics-catalog" id="catalogo-eletronicos"><div class="wrap electronics-wrap"><div class="electronics-heading"><span class="eyebrow">CATÁLOGO DE ELETRÔNICOS</span><h2>ENCONTRE A TECNOLOGIA IDEAL PARA VOCÊ</h2><p>Os melhores produtos para conectar, facilitar e transformar seu dia a dia.</p></div><nav class="electronics-subnav" aria-label="Categorias de eletrônicos">${chip('Todos', '')}${availableTypes.map(type => chip(type, type)).join('')}</nav><div class="electronics-layout"><aside class="electronics-filter-panel"><button type="button" id="electronic-filter-toggle" aria-expanded="false" aria-controls="electronic-filters">Filtrar por <span aria-hidden="true">⌄</span></button><form id="electronic-filters"><label>Buscar<input name="q" type="search" value="${escapeHtml(query.get('q') || '')}" placeholder="Nome, marca ou modelo" autocomplete="off"></label><label>Categoria<select name="tipo"><option value="">Todas</option>${availableTypes.map(type => `<option value="${escapeHtml(type)}" ${query.get('tipo') === type ? 'selected' : ''}>${escapeHtml(type)}</option>`).join('')}</select></label>${brands.length ? `<label>Marca<select name="marca"><option value="">Todas</option>${brands.map(brand => `<option value="${escapeHtml(brand)}" ${query.get('marca') === brand ? 'selected' : ''}>${escapeHtml(brand)}</option>`).join('')}</select></label>` : ''}<div class="electronics-price-fields"><label>Preço mínimo<input name="min" type="number" min="0" step="0.01" value="${escapeHtml(query.get('min') || '')}" placeholder="R$ 0"></label><label>Preço máximo<input name="max" type="number" min="0" step="0.01" value="${escapeHtml(query.get('max') || '')}" placeholder="Sem limite"></label></div><label class="electronics-availability"><input name="disponivel" type="checkbox" ${query.get('disponivel') === '1' ? 'checked' : ''}> Somente disponíveis</label><button type="button" id="electronic-clear-filters">Limpar filtros</button></form></aside><div class="electronics-main"><div class="electronics-toolbar"><p id="electronic-result-count" aria-live="polite"></p><label>Ordenar por <select id="electronic-sort"><option value="price-asc" ${!query.get('ordem') || query.get('ordem') === 'price-asc' ? 'selected' : ''}>Menor preço</option><option value="price-desc" ${query.get('ordem') === 'price-desc' ? 'selected' : ''}>Maior preço</option><option value="recent" ${query.get('ordem') === 'recent' ? 'selected' : ''}>Mais recentes</option><option value="name" ${query.get('ordem') === 'name' ? 'selected' : ''}>Nome A–Z</option></select></label></div><div id="electronic-results" class="electronics-grid"></div></div></div></div></section>${footer}</div>`;
}
export function renderElectronicResults(all, query, root = document) {
  const grid = root.querySelector('#electronic-results');
  if (!grid) return;
  const matches = filterElectronics(all, query);
  root.querySelector('#electronic-result-count').textContent = `${matches.length} ${matches.length === 1 ? 'produto encontrado' : 'produtos encontrados'}`;
  grid.innerHTML = matches.length ? matches.map(electronicCard).join('') : `<div class="electronics-empty">${all.length ? 'Nenhum eletrônico corresponde aos filtros. Ajuste ou limpe a busca.' : 'Os eletrônicos cadastrados e publicados aparecerão aqui.'}</div>`;
}
export function electronicDetailPage(product, cartCount, postalCode) {
  const media = [product.image, ...(product.gallery || [])];
  const variants = product.electronicsVariants || [];
  const available = !demo(product) && product.stock > 0 && (!variants.length || variants.some(item => item.stock > 0));
  return `<section class="electronic-detail wrap"><div class="electronic-detail-gallery"><div class="electronic-detail-main" id="detail-media-main"><img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}"></div>${media.length > 1 ? `<div class="electronic-detail-thumbs">${media.map((src, index) => `<button type="button" data-electronic-photo="${escapeHtml(src)}" aria-label="Ver foto ${index + 1} de ${escapeHtml(product.name)}" aria-pressed="${index === 0}"><img src="${escapeHtml(src)}" alt=""></button>`).join('')}</div>` : ''}</div><div class="electronic-detail-info"><a class="back-link" href="/?categoria=Eletr%C3%B4nicos#catalogo-eletronicos" data-link>← Voltar aos eletrônicos</a><span class="eyebrow">ELETRÔNICOS · ${escapeHtml(electronicType(product))}</span>${demo(product) ? '<span class="demo-product-label">Produto demonstrativo</span>' : ''}<h1>${escapeHtml(product.name)}</h1>${product.brand || product.electronicsModel ? `<p class="electronic-detail-meta">${escapeHtml([product.brand, product.electronicsModel].filter(Boolean).join(' · '))}</p>` : ''}<div class="electronic-detail-price"><strong>${money(product.price)}</strong>${product.compareAt > product.price ? `<del>${money(product.compareAt)}</del>` : ''}</div><p class="electronic-detail-stock">${demo(product) ? 'Prévia demonstrativa — sem estoque para compra.' : product.stock ? `${product.stock} em estoque` : 'Esgotado no momento.'}</p>${product.description ? `<p class="electronic-detail-description">${escapeHtml(product.description.replace(/^\[DEMO\]\s*/, ''))}</p>` : ''}${product.electronicsSpecs ? `<div class="electronic-specs"><h2>Especificações cadastradas</h2><p>${escapeHtml(product.electronicsSpecs)}</p></div>` : ''}${available ? `<form id="add-to-cart" data-product-id="${escapeHtml(product.id)}" class="electronic-buy-form">${variants.length ? `<label>Cor ou variação<select name="color" required><option value="">Selecione a variação</option>${variants.map(item => `<option value="${escapeHtml(item.color)}" ${item.stock ? '' : 'disabled'}>${escapeHtml(item.color)}${item.stock ? '' : ' — esgotado'}</option>`).join('')}</select></label>` : '<input type="hidden" name="color" value="">'}<label>Quantidade<input name="quantity" type="number" min="1" max="${product.stock}" value="1" required></label><p id="electronic-stock-label" role="status">${variants.length ? 'Selecione uma variação para ver o estoque.' : `${product.stock} unidades disponíveis.`}</p><label>CEP para consultar a entrega (opcional)<input name="postalCode" inputmode="numeric" pattern="[0-9]{5}-?[0-9]{3}" placeholder="00000-000" value="${escapeHtml(postalCode)}"></label><p>O frete será confirmado pela loja no WhatsApp.</p><button class="electronic-card-action" type="submit">ADICIONAR À SACOLA</button></form>` : ''}<a class="catalog-cart-link" href="/carrinho" data-link>Ver sacola (${cartCount}) ↗</a><p id="cart-feedback" role="status"></p></div></section>`;
}
export function updateElectronicDetail(form, product, cart) {
  if (!form || !product) return;
  const color = form.elements.namedItem('color').value;
  const inCart = cart.filter(item => item.productId === product.id && (item.color || '') === color).reduce((sum, item) => sum + item.quantity, 0);
  const totalInCart = cart.filter(item => item.productId === product.id).reduce((sum, item) => sum + item.quantity, 0);
  const remaining = Math.max(0, Math.min(electronicVariantStock(product, color) - inCart, product.stock - totalInCart));
  form.elements.namedItem('quantity').max = String(Math.max(1, remaining));
  form.querySelector('#electronic-stock-label').textContent = product.electronicsVariants?.length && !color ? 'Selecione uma variação para ver o estoque.' : `${remaining} ${remaining === 1 ? 'unidade disponível' : 'unidades disponíveis'}${color ? ` em ${color}` : ''}.`;
  const quantity = Number(form.elements.namedItem('quantity').value);
  form.querySelector('[type="submit"]').disabled = (product.electronicsVariants?.length && !color) || quantity < 1 || quantity > remaining;
}
