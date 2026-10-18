const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const demo = product => String(product.description || '').startsWith('[DEMO]');
const groups = [
  ['Masculinos', 'tipo', 'Masculino'], ['Femininos', 'tipo', 'Feminino'],
  ['Importados', 'origem', 'Importado'], ['Nacionais', 'origem', 'Nacional'],
  ['Unissex', 'tipo', 'Unissex'], ['Árabes', 'colecao', 'Árabes'],
  ['Kits e Presentes', 'colecao', 'Kits e Presentes'], ['Miniaturas', 'colecao', 'Miniaturas'],
  ['Testers', 'colecao', 'Testers']
];
const groupMatch = (product, key) => {
  if (!key) return true;
  if (key === 'outros') return product.perfumeCollection === 'Outros' || (!product.perfumeType && !product.perfumeOrigin && !product.perfumeCollection);
  const [field, value] = key.split(':');
  return (field === 'tipo' ? product.perfumeType : field === 'origem' ? product.perfumeOrigin : product.perfumeCollection) === value;
};
export const perfumeVolumes = product => {
  if (product.sizes?.length) return product.sizes;
  if (product.perfumeVolume) return [product.perfumeVolume];
  const fromName = String(product.name || '').match(/\b\d{1,3}\s?ml\b/i);
  return fromName ? [fromName[0].replace(/\s?ml/i, ' ml')] : [];
};
export const perfumeVolumeStock = (product, volume) => {
  if (!product.sizes?.length) return product.stock || 0;
  return Number(product.stockBySize?.[volume] || 0);
};
const unique = values => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
const valuesOf = (all, field) => unique(all.map(product => product[field]));
const selected = (query, key, value) => query.get(key) === value ? ' selected' : '';
const option = (value, query, key) => `<option value="${escapeHtml(value)}"${selected(query, key, value)}>${escapeHtml(value)}</option>`;

export function filterPerfumes(all, query) {
  const q = (query.get('q') || '').trim().toLocaleLowerCase('pt-BR');
  const min = Number(query.get('min'));
  const max = Number(query.get('max'));
  const matches = all.filter(product => {
    if (!groupMatch(product, query.get('grupo') || '')) return false;
    if (q && !`${product.name} ${product.brand || ''} ${product.description || ''}`.toLocaleLowerCase('pt-BR').includes(q)) return false;
    if (query.get('marca') && product.brand !== query.get('marca')) return false;
    if (query.get('tipo') && product.perfumeType !== query.get('tipo')) return false;
    if (query.get('origem') && product.perfumeOrigin !== query.get('origem')) return false;
    if (query.get('volume') && !perfumeVolumes(product).includes(query.get('volume'))) return false;
    if (query.get('concentracao') && product.perfumeConcentration !== query.get('concentracao')) return false;
    if (query.get('min') && product.price < min) return false;
    if (query.get('max') && product.price > max) return false;
    if (query.get('disponivel') === '1' && (demo(product) || product.stock < 1)) return false;
    return true;
  });
  const order = query.get('ordem') || 'price-asc';
  matches.sort((a, b) => order === 'price-desc' ? b.price - a.price : order === 'recent' ? String(b.createdAt).localeCompare(String(a.createdAt)) : order === 'name' ? a.name.localeCompare(b.name, 'pt-BR') : a.price - b.price);
  return matches;
}

function perfumeCard(product) {
  const href = `/produto/${encodeURIComponent(product.slug)}`;
  const sale = product.compareAt > product.price ? Math.round((1 - product.price / product.compareAt) * 100) : 0;
  const meta = [product.brand, perfumeVolumes(product).join(' · '), product.perfumeConcentration].filter(Boolean).join(' · ');
  return `<article class="perfume-card"><a class="perfume-card-photo" href="${href}" data-link><img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy" decoding="async"></a>${sale ? `<span class="perfume-sale">−${sale}%</span>` : ''}<div class="perfume-card-body">${demo(product) ? '<span class="demo-product-label">Produto demonstrativo</span>' : ''}<h3><a href="${href}" data-link>${escapeHtml(product.name)}</a></h3>${meta ? `<p>${escapeHtml(meta)}</p>` : ''}<div class="perfume-card-price"><strong>${money(product.price)}</strong>${sale ? `<del>${money(product.compareAt)}</del>` : ''}</div><small>${demo(product) ? 'Prévia sem estoque para compra' : product.stock ? `${product.stock} em estoque` : 'Esgotado'}</small><a class="perfume-card-action" href="${href}" data-link>VER DETALHES <span aria-hidden="true">→</span></a></div></article>`;
}

export function perfumesPage(all, query, footer) {
  const availableGroups = groups.filter(([, field, value]) => all.some(product => groupMatch(product, `${field}:${value}`)));
  if (all.some(product => groupMatch(product, 'outros'))) availableGroups.push(['Outros', '', 'outros']);
  const chip = (label, key) => `<button type="button" class="perfume-chip${(query.get('grupo') || '') === key ? ' is-current' : ''}" data-perfume-group="${escapeHtml(key)}" aria-pressed="${(query.get('grupo') || '') === key}"><span class="perfume-chip-icon" aria-hidden="true">✦</span>${escapeHtml(label)}</button>`;
  const brands = valuesOf(all, 'brand');
  const types = valuesOf(all, 'perfumeType');
  const origins = valuesOf(all, 'perfumeOrigin');
  const volumes = unique(all.flatMap(perfumeVolumes));
  const concentrations = valuesOf(all, 'perfumeConcentration');
  const select = (label, key, values) => values.length ? `<label>${label}<select name="${key}"><option value="">Todos</option>${values.map(value => option(value, query, key)).join('')}</select></label>` : '';
  return `<div class="perfumes-page"><section class="perfumes-hero" aria-labelledby="perfumes-title"><img class="perfumes-hero-scene" src="/assets/perfumes-hero-scene.png" alt="Representante da BE IMPORTS com visor espelhado apresentando um frasco em uma perfumaria" width="1983" height="793" fetchpriority="high"><div class="perfumes-hero-shade"></div><div class="perfumes-hero-content wrap"><div class="perfumes-hero-copy"><div class="perfumes-breadcrumb"><a href="/" data-link>INÍCIO</a><span aria-hidden="true">›</span><strong>PERFUMES</strong></div><h1 id="perfumes-title">PERFUMES</h1><p>MARCAS FAMOSAS <b>•</b> FRAGRÂNCIAS EXCLUSIVAS<br>QUALIDADE E SOFISTICAÇÃO</p><a class="perfumes-hero-button" href="#catalogo-perfumes" data-link>VER PRODUTOS <span aria-hidden="true">→</span></a></div><p class="perfumes-hero-tagline">As melhores fragrâncias<br>para o seu <em>estilo.</em></p></div></section><section class="perfumes-catalog" id="catalogo-perfumes"><div class="wrap perfumes-wrap"><div class="perfumes-heading"><span class="eyebrow">CATÁLOGO DE PERFUMES</span><h2>ENCONTRE SUA FRAGRÂNCIA IDEAL</h2><p>Perfumes para diferentes estilos, ocasiões e preferências.</p></div><nav class="perfumes-subnav" aria-label="Categorias de perfumes">${chip('Todos', '')}${availableGroups.map(([label, field, value]) => chip(label, value === 'outros' ? 'outros' : `${field}:${value}`)).join('')}</nav><div class="perfumes-layout"><aside class="perfumes-filter-panel"><button type="button" id="perfume-filter-toggle" aria-expanded="false" aria-controls="perfume-filters">Filtrar por <span aria-hidden="true">⌄</span></button><form id="perfume-filters"><label>Buscar<input name="q" type="search" value="${escapeHtml(query.get('q') || '')}" placeholder="Nome, marca ou modelo" autocomplete="off"></label>${select('Marca', 'marca', brands)}${select('Tipo', 'tipo', types)}${select('Origem', 'origem', origins)}${select('Volume', 'volume', volumes)}${select('Concentração', 'concentracao', concentrations)}<div class="perfumes-price-fields"><label>Preço mínimo<input name="min" type="number" min="0" step="0.01" value="${escapeHtml(query.get('min') || '')}" placeholder="R$ 0"></label><label>Preço máximo<input name="max" type="number" min="0" step="0.01" value="${escapeHtml(query.get('max') || '')}" placeholder="Sem limite"></label></div><label class="perfumes-availability"><input name="disponivel" type="checkbox" ${query.get('disponivel') === '1' ? 'checked' : ''}> Somente disponíveis</label><button type="button" id="perfume-clear-filters">Limpar filtros</button></form></aside><div class="perfumes-main"><div class="perfumes-toolbar"><p id="perfume-result-count" aria-live="polite"></p><label>Ordenar por <select id="perfume-sort"><option value="price-asc" ${!query.get('ordem') || query.get('ordem') === 'price-asc' ? 'selected' : ''}>Menor preço</option><option value="price-desc" ${query.get('ordem') === 'price-desc' ? 'selected' : ''}>Maior preço</option><option value="recent" ${query.get('ordem') === 'recent' ? 'selected' : ''}>Mais recentes</option><option value="name" ${query.get('ordem') === 'name' ? 'selected' : ''}>Nome A–Z</option></select></label></div><div id="perfume-results" class="perfumes-grid"></div></div></div></div></section>${footer}</div>`;
}

export function renderPerfumeResults(all, query, root = document) {
  const grid = root.querySelector('#perfume-results');
  if (!grid) return;
  const matches = filterPerfumes(all, query);
  root.querySelector('#perfume-result-count').textContent = `${matches.length} ${matches.length === 1 ? 'perfume encontrado' : 'perfumes encontrados'}`;
  grid.innerHTML = matches.length ? matches.map(perfumeCard).join('') : `<div class="perfumes-empty">${all.length ? 'Nenhum perfume corresponde aos filtros. Ajuste ou limpe a busca.' : 'Os perfumes cadastrados e publicados aparecerão aqui.'}</div>`;
}

export function perfumeDetailPage(product, cartCount, postalCode) {
  const media = [product.image, ...(product.gallery || [])];
  const volumes = perfumeVolumes(product);
  const available = !demo(product) && product.stock > 0 && (!product.sizes?.length || product.sizes.some(volume => perfumeVolumeStock(product, volume) > 0));
  const meta = [product.brand, product.perfumeType, product.perfumeOrigin, product.perfumeConcentration].filter(Boolean);
  return `<section class="perfume-detail wrap"><div class="perfume-detail-gallery"><div class="perfume-detail-main" id="detail-media-main"><img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}"></div>${media.length > 1 ? `<div class="perfume-detail-thumbs">${media.map((src, index) => `<button type="button" data-perfume-photo="${escapeHtml(src)}" aria-label="Ver foto ${index + 1} de ${escapeHtml(product.name)}" aria-pressed="${index === 0}"><img src="${escapeHtml(src)}" alt=""></button>`).join('')}</div>` : ''}</div><div class="perfume-detail-info"><a class="back-link" href="/?categoria=Perfumes#catalogo-perfumes" data-link>← Voltar aos perfumes</a><span class="eyebrow">PERFUMES${product.brand ? ` · ${escapeHtml(product.brand)}` : ''}</span>${demo(product) ? '<span class="demo-product-label">Produto demonstrativo</span>' : ''}<h1>${escapeHtml(product.name)}</h1>${meta.length ? `<p class="perfume-detail-meta">${meta.map(escapeHtml).join(' · ')}</p>` : ''}${volumes.length ? `<p>Volume: ${escapeHtml(volumes.join(' · '))}</p>` : ''}<div class="perfume-detail-price"><strong>${money(product.price)}</strong>${product.compareAt > product.price ? `<del>${money(product.compareAt)}</del>` : ''}</div><p class="perfume-detail-stock">${demo(product) ? 'Prévia demonstrativa — sem estoque para compra.' : product.stock ? `${product.stock} em estoque` : 'Esgotado no momento.'}</p>${product.description ? `<p class="perfume-detail-description">${escapeHtml(product.description.replace(/^\[DEMO\]\s*/, ''))}</p>` : ''}${product.perfumeNotes ? `<p><strong>Notas olfativas:</strong> ${escapeHtml(product.perfumeNotes)}</p>` : ''}${available ? `<form id="add-to-cart" data-product-id="${escapeHtml(product.id)}" class="perfume-buy-form">${product.sizes?.length ? `<label>Volume<select name="size" required><option value="">Selecione o volume</option>${product.sizes.map(volume => `<option value="${escapeHtml(volume)}" ${perfumeVolumeStock(product, volume) ? '' : 'disabled'}>${escapeHtml(volume)}${perfumeVolumeStock(product, volume) ? '' : ' — esgotado'}</option>`).join('')}</select></label>` : '<input type="hidden" name="size" value="">'}<label>Quantidade<input name="quantity" type="number" min="1" max="${product.stock}" value="1" required></label><p id="perfume-stock-label" role="status">${product.sizes?.length ? 'Selecione o volume para ver o estoque.' : `${product.stock} unidades disponíveis.`}</p><label>CEP para consultar a entrega (opcional)<input name="postalCode" inputmode="numeric" pattern="[0-9]{5}-?[0-9]{3}" placeholder="00000-000" value="${escapeHtml(postalCode)}"></label><p>O frete será confirmado pela loja no WhatsApp.</p><button class="perfume-card-action" type="submit">ADICIONAR À SACOLA</button></form>` : ''}<a class="catalog-cart-link" href="/carrinho" data-link>Ver sacola (${cartCount}) ↗</a><p id="cart-feedback" role="status"></p></div></section>`;
}

export function updatePerfumeDetail(form, product, cart) {
  if (!form || !product) return;
  const volume = form.elements.namedItem('size').value;
  const inCart = cart.filter(item => item.productId === product.id && item.size === volume).reduce((sum, item) => sum + item.quantity, 0);
  const totalInCart = cart.filter(item => item.productId === product.id).reduce((sum, item) => sum + item.quantity, 0);
  const remaining = Math.max(0, Math.min(perfumeVolumeStock(product, volume) - inCart, product.stock - totalInCart));
  form.elements.namedItem('quantity').max = String(Math.max(1, remaining));
  form.querySelector('#perfume-stock-label').textContent = product.sizes?.length && !volume ? 'Selecione o volume para ver o estoque.' : `${remaining} ${remaining === 1 ? 'unidade disponível' : 'unidades disponíveis'}${volume ? ` em ${volume}` : ''}.`;
  const quantity = Number(form.elements.namedItem('quantity').value);
  form.querySelector('[type="submit"]').disabled = (product.sizes?.length && !volume) || quantity < 1 || quantity > remaining;
}
