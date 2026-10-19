const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);
const amount = value => { const text = String(value ?? '').trim().replace(/R\$\s*/i, ''); return Number(text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text); };
const slug = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const newRow = () => ({ name: '', sku: '', category: '', subcategory: '', price: '', promo: '', stock: '', sizes: '', variants: '', color: '', brand: '', model: '', image: '', status: '' });
const state = { tab: 'overview', bulkMode: 'table', rows: [newRow()], selected: new Set(), photos: [], mapping: null, imported: null, review: null, duplicatePolicy: 'skip', productSearch: '', productCategory: '', productSubcategory: '', productPromotion: '', productStatus: '', productStock: '', productSort: 'newest', page: 1, selectedProducts: new Set(), quickCategory: '', quickPrevious: {}, quickPhoto: '', message: '' };
const columns = ['name', 'sku', 'category', 'subcategory', 'brand', 'model', 'color', 'price', 'promo', 'stock', 'sizes', 'variants', 'image', 'status'];
const fields = { name: 'Nome', sku: 'SKU', category: 'Categoria', subcategory: 'Subcategoria', brand: 'Marca', model: 'Modelo/tipo', color: 'Cor', price: 'Preço', promo: 'Promoção', stock: 'Estoque', sizes: 'Tamanhos/volumes', variants: 'Variações', image: 'Foto', status: 'Status' };
const aliases = { name: ['produto', 'nome', 'nome do produto', 'product'], sku: ['sku', 'codigo', 'código', 'referencia'], category: ['categoria', 'category'], subcategory: ['subcategoria', 'tipo'], brand: ['marca', 'brand'], model: ['modelo', 'tipo de produto', 'model'], color: ['cor', 'color'], price: ['preco', 'preço', 'valor', 'price'], promo: ['promocao', 'promoção', 'preco promocional', 'preço promocional'], stock: ['estoque', 'quantidade', 'stock'], sizes: ['tamanhos', 'tamanho', 'numeracao', 'numeração', 'volumes'], variants: ['variacoes', 'variações'], image: ['foto', 'imagem', 'image', 'url da foto'], status: ['status', 'situacao', 'situação'] };
const isVariantCategory = category => ['Camisas', 'Tênis', 'Bonés', 'Bermudas', 'Perfumes'].includes(category);
const makeSku = id => `BE-${id.replace(/[^a-z0-9]/gi, '').slice(0, 12).toUpperCase()}`;

function summary(catalog) {
  const products = catalog.products;
  return [
    ['Produtos', products.length], ['Publicados', products.filter(p => p.status === 'published').length],
    ['Rascunhos', products.filter(p => p.status !== 'published').length], ['Sem estoque', products.filter(p => p.stock === 0).length],
    ['Em promoção', products.filter(p => p.compareAt > p.price).length], ['Categorias', catalog.categories.length]
  ];
}
function categoryOptions(catalog, selected = '') {
  return `<option value="">Selecione</option>${catalog.categories.map(c => `<option value="${esc(c.name)}" ${c.name === selected ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}`;
}
function subcategoryOptions(catalog, category, selected = '') {
  const items = category === 'Camisas' ? catalog.shirtSubcategories || [] : (catalog.subcategories || []).filter(item => item.category === category && item.active !== false);
  return `<option value="">Sem subcategoria</option>${items.map(item => `<option value="${esc(item.name)}" ${item.name === selected ? 'selected' : ''}>${esc(item.name)}</option>`).join('')}`;
}
function notice(message, good = false) { return message ? `<p class="${good ? 'admin-success' : 'admin-message'}" role="status">${esc(message)}</p>` : ''; }
function renderOverview(catalog) {
  return `<div class="aw-view"><span class="eyebrow">PAINEL ADMINISTRATIVO</span><h2>Visão geral</h2><p class="aw-muted">Cadastre produtos em poucos passos e acompanhe a loja.</p>
    <div class="aw-metrics">${summary(catalog).map(([label, value]) => `<div><strong>${value}</strong><span>${label}</span></div>`).join('')}</div>
    <div class="aw-hero-actions"><button class="button gold" data-tab="bulk" type="button">Cadastrar em massa</button><button class="button outline" data-tab="quick" type="button">Cadastrar produto</button><button class="button outline" data-tab="products" type="button">Gerenciar produtos</button></div>
    <div class="aw-guide"><h3>Cadastro em massa</h3><p>1. Adicione linhas ou importe CSV/XLSX. 2. Revise os dados e associe fotos. 3. Salve todos de uma vez.</p></div></div>`;
}
function categoryDetails(category) {
  if (category === 'Eletrônicos' || category === 'Fones de ouvido') return `<label>Tipo de eletrônico<select name="electronicsType">${['Celulares', 'Notebooks', 'Fones de Ouvido', 'Caixas de Som', 'Smartwatches', 'Consoles', 'Acessórios', 'Drones', 'TVs e Monitores', 'Outros'].map(type => `<option value="${type}" ${type === (category === 'Fones de ouvido' ? 'Fones de Ouvido' : 'Outros') ? 'selected' : ''}>${type}</option>`).join('')}</select></label>`;
  if (category === 'Camisas' || category === 'Tênis' || category === 'Perfumes') return `<p class="aw-muted">${category === 'Perfumes' ? 'Informe volume e estoque como 50ml:2; 100ml:3.' : category === 'Tênis' ? 'Informe numeração e estoque como 38:2; 39:3.' : 'Informe tamanho e estoque como P:2; M:3.'}</p>`;
  if (category === 'Bonés' || category === 'Bermudas') return `<p class="aw-muted">Informe variações como Preto | M | 2, uma por linha.</p>`;
  return '';
}
function renderQuick(catalog) {
  const category = state.quickCategory || (catalog.categories.some(item => item.name === catalog.settings.defaultCategory) ? catalog.settings.defaultCategory : '');
  return `<div class="aw-view"><span class="eyebrow">CADASTRO RÁPIDO</span><h2>Novo produto</h2><p class="aw-muted">Preencha o essencial. Use “Mais detalhes” para variações e informações extras.</p>
    <form id="aw-quick-form" class="aw-form"><div class="aw-form-grid"><label>Nome do produto<input name="name" required maxlength="140"></label><label>Categoria<select name="category" required>${categoryOptions(catalog, category)}</select></label><label>Subcategoria<select name="subcategory">${subcategoryOptions(catalog, category, state.quickPrevious.category === category ? state.quickPrevious.subcategory : '')}</select></label><label>SKU (automático se vazio)<input name="sku" maxlength="40"></label><label>Preço normal (R$)<input name="price" inputmode="decimal" required></label><label>Preço promocional (R$), opcional<input name="promo" inputmode="decimal"></label><label>Estoque total<input name="stock" type="number" min="0" step="1" value="${esc(catalog.settings.defaultStock ?? 0)}" required></label><label>Foto principal<input name="photo" type="file" accept="image/png,image/jpeg,image/webp"></label></div>
      <div id="aw-quick-media">${state.quickPhoto ? `<img src="${esc(state.quickPhoto)}" alt="Foto escolhida"><button type="button" data-action="clear-quick-photo">Remover foto</button>` : ''}</div>
      <details><summary>Mais detalhes e variações</summary><div class="aw-form-grid"><div id="aw-category-details">${categoryDetails(category)}</div><label>Marca<input name="brand" maxlength="40" value="${esc(state.quickPrevious.brand || '')}"></label><label>Modelo ou tipo<input name="model" maxlength="80" value="${esc(state.quickPrevious.model || '')}"></label><label>Cor<input name="color" maxlength="40" value="${esc(state.quickPrevious.color || '')}"></label><label>Tamanhos/volumes com estoque (ex.: P:2; M:3)<input name="sizes"></label><label>Variações (Cor | Tamanho | Estoque)<textarea name="variants" rows="3"></textarea></label><label>Descrição<textarea name="description" rows="3"></textarea></label></div></details>
      <label>Status<select name="status"><option value="draft" ${catalog.settings.defaultStatus !== 'published' ? 'selected' : ''}>Rascunho</option><option value="published" ${catalog.settings.defaultStatus === 'published' ? 'selected' : ''}>Publicado</option></select></label><div class="aw-actions"><button class="button gold" type="submit">Salvar e cadastrar outro</button><button type="button" class="button outline" data-tab="edit">Abrir cadastro completo</button></div></form></div>`;
}
function renderBulk(catalog) {
  const count = state.rows.length;
  return `<div class="aw-view"><span class="eyebrow">CADASTRO EM MASSA</span><h2>Adicionar · Revisar · Salvar</h2><p class="aw-muted">Cada linha é um produto. Cole células do Excel, importe uma planilha ou associe fotos por SKU.</p>
    <div class="aw-switch"><button type="button" data-bulk="table" class="${state.bulkMode === 'table' ? 'active' : ''}">Tabela inteligente</button><button type="button" data-bulk="import" class="${state.bulkMode === 'import' ? 'active' : ''}">Excel / CSV</button><button type="button" data-bulk="photos" class="${state.bulkMode === 'photos' ? 'active' : ''}">Fotos em lote</button></div>
    ${state.bulkMode === 'import' ? renderImport() : ''}${state.bulkMode === 'photos' ? renderPhotos() : ''}
    <div class="aw-toolbar"><strong>${count} ${count === 1 ? 'linha' : 'linhas'}</strong><button type="button" data-action="add-row">+ Linha</button><button type="button" data-action="add-ten">+ 10 linhas</button><button type="button" data-action="remove-rows">Excluir selecionadas</button></div>
    <div class="aw-toolbar"><label>Replicar em linhas selecionadas <select id="aw-fill-field">${['category', 'subcategory', 'brand', 'model', 'color', 'price', 'promo', 'stock', 'status'].map(k => `<option value="${k}">${fields[k]}</option>`).join('')}</select></label><input id="aw-fill-value" aria-label="Valor para replicar" placeholder="Valor"><button type="button" data-action="fill-rows">Aplicar</button></div>
    <div class="aw-table-wrap"><table class="aw-bulk-table"><thead><tr><th><input id="aw-select-all" type="checkbox" aria-label="Selecionar todas"></th><th>#</th>${columns.map(k => `<th>${fields[k]}</th>`).join('')}</tr></thead><tbody>${state.rows.map((row, i) => `<tr class="${state.review?.errors[i] ? 'aw-invalid-row' : ''}"><td data-label="Sel."><input type="checkbox" data-select-row="${i}" ${state.selected.has(i) ? 'checked' : ''} aria-label="Selecionar linha ${i + 1}"></td><td data-label="Linha">${i + 1}</td>${columns.map(k => `<td data-label="${fields[k]}">${bulkCell(catalog, row, i, k)}</td>`).join('')}</tr>${state.review?.errors[i] ? `<tr class="aw-error-row"><td colspan="${columns.length + 2}">Linha ${i + 1}: ${esc(state.review.errors[i])}</td></tr>` : ''}`).join('')}</tbody></table></div>
    <p class="aw-muted">Tamanhos: P:2; M:3. Variações: Preto | M | 2 (bonés/bermudas) ou Preto | 2 (eletrônicos). Produtos sem foto podem ser salvos como rascunho.</p>
    ${state.review ? `<p class="aw-review" role="status">${state.review.ready} pronto(s), ${state.review.skipped} ignorado(s), ${Object.keys(state.review.errors).length} com correção necessária.</p>` : ''}
    <div class="aw-actions"><select id="aw-duplicate-policy" aria-label="Tratamento de SKU duplicado"><option value="skip" ${state.duplicatePolicy === 'skip' ? 'selected' : ''}>Ignorar SKUs já cadastrados</option><option value="update" ${state.duplicatePolicy === 'update' ? 'selected' : ''}>Atualizar SKUs já cadastrados</option></select><button type="button" data-action="review-bulk">2. Revisar linhas</button><button class="button gold" type="button" data-action="save-bulk">3. Salvar todos os produtos</button></div></div>`;
}
function bulkCell(catalog, row, i, k) {
  const attr = `data-row="${i}" data-field="${k}" aria-label="${fields[k]} da linha ${i + 1}"`;
  if (k === 'category') return `<select ${attr}>${categoryOptions(catalog, row.category)}</select>`;
  if (k === 'subcategory') return `<select ${attr}>${subcategoryOptions(catalog, row.category, row.subcategory)}</select>`;
  if (k === 'status') return `<select ${attr}><option value="" ${!row.status ? 'selected' : ''}>Rascunho / manter</option><option value="draft" ${row.status === 'draft' ? 'selected' : ''}>Rascunho</option><option value="published" ${row.status === 'published' ? 'selected' : ''}>Publicado</option></select>`;
  if (k === 'image') { const urls = [...new Set([...(catalog.media || []), row.image].filter(Boolean))];return `<select ${attr}><option value="">${state.photos.some(photo => photo.row === i) ? 'Foto em lote' : 'Sem foto'}</option>${urls.map(url => `<option value="${esc(url)}" ${row.image === url ? 'selected' : ''}>${esc(url.split('/').at(-1))}</option>`).join('')}</select>`; }
  return `<input ${attr} value="${esc(row[k])}" ${k === 'stock' ? 'inputmode="numeric"' : k === 'price' || k === 'promo' ? 'inputmode="decimal"' : ''} placeholder="${k === 'sizes' ? 'P:2; M:3' : k === 'variants' ? 'Cor | M | 2' : ''}">`;
}
function renderImport() {
  return `<div class="aw-import"><label>Importar planilha CSV ou XLSX<input id="aw-import-file" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"></label><div class="aw-actions"><button type="button" data-action="template-simple">Baixar modelo simples</button><button type="button" data-action="template-advanced">Baixar modelo com variações</button></div>
    ${state.imported ? `<p>${state.imported.count} linhas identificadas. Confira a associação das colunas:</p><div class="aw-map">${Object.entries(fields).map(([key, label]) => `<label>${label}<select data-map="${key}"><option value="">Não importar</option>${state.imported.headers.map((header, i) => `<option value="${i}" ${state.mapping?.[key] === i ? 'selected' : ''}>${esc(header)}</option>`).join('')}</select></label>`).join('')}</div><button class="button gold" type="button" data-action="apply-import">Usar linhas na tabela</button>` : ''}</div>`;
}
function renderPhotos() {
  return `<div class="aw-import"><label class="aw-upload-drop" data-drop-zone="batch">Arraste fotos aqui ou selecione várias<input id="aw-batch-photos" type="file" accept="image/png,image/jpeg,image/webp" multiple></label><p>Use nomes como CAM001-1.jpg e CAM001-2.jpg para associar automaticamente ao SKU CAM001. A primeira foto de cada produto será a principal. Use as setas para ordenar.</p><div class="aw-photo-list">${state.photos.map((photo, i) => `<div><img src="${esc(photo.preview)}" alt="Prévia da foto ${i + 1}"><span>${esc(photo.file.name)}</span><select data-photo-row="${i}" aria-label="Produto da foto ${i + 1}"><option value="">Sem associação</option>${state.rows.map((row, j) => `<option value="${j}" ${photo.row === j ? 'selected' : ''}>${esc(row.sku || row.name || `Linha ${j + 1}`)}</option>`).join('')}</select><button type="button" data-photo-move="${i}:up" ${i === 0 ? 'disabled' : ''} aria-label="Mover foto para cima">↑</button><button type="button" data-photo-move="${i}:down" ${i === state.photos.length - 1 ? 'disabled' : ''} aria-label="Mover foto para baixo">↓</button><button type="button" data-remove-photo="${i}">Remover</button></div>`).join('')}</div></div>`;
}
function renderProducts(catalog) {
  let products = [...catalog.products];
  const q = state.productSearch.toLocaleLowerCase('pt-BR');
  if (q) products = products.filter(p => [p.name, p.sku, p.category, p.subcategory].some(value => String(value || '').toLocaleLowerCase('pt-BR').includes(q)));
  if (state.productCategory) products = products.filter(p => p.category === state.productCategory);
  if (state.productSubcategory) products = products.filter(p => p.subcategory === state.productSubcategory);
  if (state.productPromotion) products = products.filter(p => state.productPromotion === 'yes' ? p.compareAt > p.price : !(p.compareAt > p.price));
  if (state.productStatus) products = products.filter(p => p.status === state.productStatus);
  if (state.productStock) products = products.filter(p => state.productStock === 'empty' ? p.stock === 0 : p.stock > 0);
  if (state.productSort === 'price-asc') products.sort((a, b) => a.price - b.price);
  else if (state.productSort === 'price-desc') products.sort((a, b) => b.price - a.price);
  else products.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  const pages = Math.max(1, Math.ceil(products.length / 25));state.page = Math.min(state.page, pages);
  const slice = products.slice((state.page - 1) * 25, state.page * 25);
  const subcategoryNames = [...new Set(catalog.products.filter(p => !state.productCategory || p.category === state.productCategory).map(p => p.subcategory).filter(Boolean))];
  return `<div class="aw-view"><span class="eyebrow">GERENCIAR PRODUTOS</span><h2>Produtos (${products.length})</h2><div class="aw-toolbar"><input id="aw-product-search" value="${esc(state.productSearch)}" placeholder="Buscar nome ou SKU" aria-label="Buscar produtos"><select id="aw-product-category"><option value="">Todas as categorias</option>${catalog.categories.map(c => `<option value="${esc(c.name)}" ${state.productCategory === c.name ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select><select id="aw-product-subcategory"><option value="">Todas as subcategorias</option>${subcategoryNames.map(name => `<option value="${esc(name)}" ${state.productSubcategory === name ? 'selected' : ''}>${esc(name)}</option>`).join('')}</select><select id="aw-product-promotion"><option value="">Promoção: todos</option><option value="yes" ${state.productPromotion === 'yes' ? 'selected' : ''}>Em promoção</option><option value="no" ${state.productPromotion === 'no' ? 'selected' : ''}>Sem promoção</option></select><select id="aw-product-status"><option value="">Todos os status</option><option value="published" ${state.productStatus === 'published' ? 'selected' : ''}>Publicados</option><option value="draft" ${state.productStatus === 'draft' ? 'selected' : ''}>Rascunhos</option></select><select id="aw-product-stock"><option value="">Todo estoque</option><option value="available" ${state.productStock === 'available' ? 'selected' : ''}>Disponível</option><option value="empty" ${state.productStock === 'empty' ? 'selected' : ''}>Sem estoque</option></select><select id="aw-product-sort"><option value="newest">Mais recentes</option><option value="price-asc" ${state.productSort === 'price-asc' ? 'selected' : ''}>Menor preço</option><option value="price-desc" ${state.productSort === 'price-desc' ? 'selected' : ''}>Maior preço</option></select></div>
    <div class="aw-toolbar"><strong>${state.selectedProducts.size} selecionados</strong><select id="aw-mass-action"><option value="">Ação coletiva</option><option value="category">Alterar categoria</option><option value="subcategory">Alterar subcategoria</option><option value="price">Definir preço</option><option value="promo">Aplicar promoção</option><option value="remove-promo">Remover promoção</option><option value="published">Publicar</option><option value="draft">Transformar em rascunho</option><option value="stock">Definir estoque (sem variações)</option><option value="delete">Excluir</option></select><input id="aw-mass-value" placeholder="Novo valor, quando necessário" aria-label="Valor da ação coletiva"><button type="button" data-action="mass-apply">Aplicar aos selecionados</button></div>
    <div class="aw-table-wrap"><table class="aw-products-table"><thead><tr><th>Sel.</th><th>Foto</th><th>Produto / SKU</th><th>Categoria</th><th>Preço</th><th>Estoque</th><th>Status</th><th>Ações</th></tr></thead><tbody>${slice.map(p => `<tr><td><input type="checkbox" data-select-product="${esc(p.id)}" ${state.selectedProducts.has(p.id) ? 'checked' : ''} aria-label="Selecionar ${esc(p.name)}"></td><td><img src="${esc(p.image)}" alt=""></td><td><strong>${esc(p.name)}</strong><small>${esc(p.sku || '')}</small></td><td>${esc(p.category)}</td><td><input data-inline-price="${esc(p.id)}" value="${esc(p.price)}" inputmode="decimal" aria-label="Preço de ${esc(p.name)}"></td><td>${p.stock}</td><td><select data-inline-status="${esc(p.id)}" aria-label="Status de ${esc(p.name)}"><option value="draft" ${p.status === 'draft' ? 'selected' : ''}>Rascunho</option><option value="published" ${p.status === 'published' ? 'selected' : ''}>Publicado</option></select></td><td><button type="button" data-inline-save="${esc(p.id)}">Salvar</button><button type="button" data-open-product="${esc(p.id)}">Editar</button><button type="button" data-duplicate="${esc(p.id)}">Duplicar</button></td></tr>`).join('')}</tbody></table></div><div class="aw-actions"><button type="button" data-page="prev" ${state.page <= 1 ? 'disabled' : ''}>Anterior</button><span>Página ${state.page} de ${pages}</span><button type="button" data-page="next" ${state.page >= pages ? 'disabled' : ''}>Próxima</button></div></div>`;
}
function renderCategories(catalog) {
  return `<div class="aw-view"><span class="eyebrow">CATEGORIAS</span><h2>Organizar categorias</h2><p class="aw-muted">Reordene ou desative categorias. Os formulários de edição existentes continuam abaixo.</p><div class="aw-category-order">${catalog.categories.map((c, i) => `<div><span>${i + 1}. ${esc(c.name)}</span><button type="button" data-category-move="${i}:up" ${i === 0 ? 'disabled' : ''}>↑</button><button type="button" data-category-move="${i}:down" ${i === catalog.categories.length - 1 ? 'disabled' : ''}>↓</button><label><input type="checkbox" data-category-active="${i}" ${c.active !== false ? 'checked' : ''}> Ativa</label></div>`).join('')}</div>
    <h3>Subcategorias de outras categorias</h3><form id="aw-subcategory-form" class="aw-form-grid"><label>Categoria<select name="category" required>${categoryOptions(catalog)}</select></label><label>Subcategoria<input name="name" required maxlength="60"></label><button class="button gold" type="submit">Criar subcategoria</button></form><div class="aw-category-order">${(catalog.subcategories || []).map((s, i) => `<div><span>${esc(s.category)} · ${esc(s.name)}</span><button type="button" data-subcategory-edit="${i}">Editar</button><button type="button" data-subcategory-remove="${i}">Excluir</button></div>`).join('')}</div></div>`;
}
function renderShirtSubcategories(catalog) {
  return `<div class="aw-view"><span class="eyebrow">CAMISAS</span><h2>Subcategorias de camisas</h2><p class="aw-muted">Crie novas opções e selecione uma das ${catalog.shirtSubcategories?.length || 0} existentes abaixo para editar a foto, mudar o nome ou excluir. “Todos” é o filtro fixo que mostra todas as camisas.</p></div>`;
}
function renderLibrary(catalog) {
  const urls = [...new Set([...(catalog.media || []), ...catalog.products.flatMap(p => [p.image, ...(p.gallery || [])]), ...catalog.categories.map(c => c.image), ...(catalog.shirtSubcategories || []).map(s => s.image)].filter(Boolean))];
  return `<div class="aw-view"><span class="eyebrow">GALERIA DE FOTOS</span><h2>Biblioteca (${urls.length})</h2><p class="aw-muted">Envie várias imagens ou reutilize uma foto no cadastro rápido.</p><label class="aw-upload-drop" data-drop-zone="library">Arraste imagens aqui ou selecione arquivos<input id="aw-library-upload" type="file" accept="image/png,image/jpeg,image/webp" multiple></label><div class="aw-library">${urls.map(url => `<div><img src="${esc(url)}" alt="Foto da biblioteca"><button type="button" data-use-media="${esc(url)}">Usar no cadastro</button>${(catalog.media || []).includes(url) ? `<button type="button" data-remove-media="${esc(url)}">Remover da biblioteca</button>` : ''}</div>`).join('')}</div></div>`;
}

function sizesWithStock(source) {
  const entries = String(source || '').split(/[;,\n]+/).map(value => value.trim()).filter(Boolean);
  const stockBySize = {}, sizes = [];
  for (const entry of entries) {
    const [size, raw] = entry.split(':').map(value => value.trim());
    if (!size || sizes.includes(size) || (raw != null && (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw))))) throw Error(`Tamanho ou estoque inválido: ${entry}`);
    sizes.push(size);
    if (raw != null) stockBySize[size] = Number(raw);
  }
  return { sizes, stockBySize, total: Object.values(stockBySize).reduce((sum, value) => sum + value, 0) };
}
function colorSizeVariants(source, category) {
  const lines = String(source || '').split(/\r?\n|;/).map(value => value.trim()).filter(Boolean);
  return lines.map(line => {
    const parts = line.split('|').map(value => value.trim());
    if (category === 'Eletrônicos' || category === 'Fones de ouvido') {
      if (parts.length !== 2 || !parts[0] || !/^\d+$/.test(parts[1])) throw Error(`Variação inválida: ${line}`);
      return { color: parts[0], stock: Number(parts[1]) };
    }
    if (parts.length !== 3 || !/^\d+$/.test(parts[2]) || (category === 'Bermudas' && !parts[1]) || (category === 'Bonés' && !parts[0] && !parts[1])) throw Error(`Variação inválida: ${line}`);
    return { color: parts[0], size: parts[1], stock: Number(parts[2]) };
  });
}
function buildProduct(row, catalog, previous = null, image = '', gallery = []) {
  const id = previous?.id || crypto.randomUUID();
  const sku = String(row.sku || previous?.sku || makeSku(id)).trim().toUpperCase();
  const name = String(row.name || previous?.name || '').trim(), category = String(row.category || previous?.category || '').trim();
  if (!name || !category || !catalog.categories.some(item => item.name === category)) throw Error('Informe nome e categoria cadastrada.');
  const basePrice = row.price === '' ? Number(previous?.price) : amount(row.price), promotional = row.promo === '' ? null : amount(row.promo);
  const price = row.compareAt !== undefined ? basePrice : promotional == null ? basePrice : promotional;
  const compareAt = row.compareAt !== undefined ? (row.compareAt === '' ? null : amount(row.compareAt)) : promotional == null ? (previous?.compareAt > price ? previous.compareAt : null) : basePrice;
  if (!Number.isFinite(price) || price <= 0 || (compareAt != null && (!Number.isFinite(compareAt) || compareAt <= price))) throw Error(`Preço ou promoção inválida: ${name}.`);
  let stock = row.stock === '' ? Number(previous?.stock || 0) : Number(row.stock);
  if (!Number.isSafeInteger(stock) || stock < 0) throw Error(`Estoque inválido: ${name}.`);
  const status = row.status === 'published' ? 'published' : row.status === 'draft' ? 'draft' : previous?.status || 'draft';
  const product = { ...(previous || {}), id, sku, slug: previous?.slug || `${slug(name)}-${slug(sku)}`, createdAt: previous?.createdAt || new Date().toISOString(), name, category, subcategory: row.subcategory || previous?.subcategory || '', description: row.description ?? previous?.description ?? '', price, compareAt, stock, image: image || row.image || previous?.image || '', gallery: gallery.length ? gallery : previous?.gallery || [], status };
  const previousSizes = previous?.sizes?.map(size => `${size}:${previous.stockBySize?.[size] ?? 0}`).join('; ') || '';
  const sizing = sizesWithStock(row.sizes || previousSizes);
  const previousVariants = category === 'Bonés' ? previous?.capVariants : category === 'Bermudas' ? previous?.bermudaVariants : previous?.electronicsVariants;
  const serializedVariants = previousVariants?.map(item => category === 'Eletrônicos' || category === 'Fones de ouvido' ? `${item.color} | ${item.stock}` : `${item.color} | ${item.size} | ${item.stock}`).join('\n') || '';
  const variants = colorSizeVariants(row.variants || serializedVariants, category);
  if (['Camisas', 'Tênis', 'Perfumes'].includes(category)) {
    product.sizes = sizing.sizes;
    product.stockBySize = sizing.stockBySize;
    if (Object.keys(sizing.stockBySize).length) product.stock = sizing.total;
    if (status === 'published' && (!sizing.sizes.length || Object.keys(sizing.stockBySize).length !== sizing.sizes.length)) throw Error(`Informe estoque por tamanho/volume para publicar ${name}.`);
  } else product.sizes = [];
  if (category === 'Camisas') { product.subcategory = row.subcategory || previous?.subcategory || ''; product.color = row.color || previous?.color || ''; product.pricingRule = /^tailandes/i.test(product.subcategory) ? 'thai' : previous?.pricingRule || 'standard'; }
  if (category === 'Tênis') { product.brand = row.brand || previous?.brand || ''; product.shoeType = row.model || previous?.shoeType || ''; product.color = row.color || ''; if (status === 'published' && !product.brand) throw Error(`Informe a marca de ${name}.`); }
  if (category === 'Perfumes') { product.brand = row.brand || previous?.brand || ''; if (status === 'published' && !product.brand) throw Error(`Informe a marca de ${name}.`); }
  if (category === 'Bonés') { product.brand = row.brand || previous?.brand || ''; product.capType = row.model || previous?.capType || ''; product.capVariants = variants; product.sizes = [...new Set(variants.map(v => v.size).filter(Boolean))]; if (variants.length) product.stock = variants.reduce((sum, v) => sum + v.stock, 0); if (status === 'published' && (!product.brand || !product.capType || !variants.length)) throw Error(`Informe marca, modelo e variações para publicar ${name}.`); }
  if (category === 'Bermudas') { product.brand = row.brand || previous?.brand || ''; product.bermudaType = row.model || previous?.bermudaType || ''; product.bermudaVariants = variants; product.sizes = [...new Set(variants.map(v => v.size))]; if (variants.length) product.stock = variants.reduce((sum, v) => sum + v.stock, 0); if (status === 'published' && (!product.bermudaType || !variants.length)) throw Error(`Informe modelo e variações para publicar ${name}.`); }
  if (category === 'Eletrônicos' || category === 'Fones de ouvido') { product.brand = row.brand || previous?.brand || ''; product.electronicsType = row.electronicsType || previous?.electronicsType || (category === 'Fones de ouvido' ? 'Fones de Ouvido' : 'Outros'); product.electronicsModel = row.model || previous?.electronicsModel || ''; product.electronicsVariants = variants; if (variants.length) product.stock = variants.reduce((sum, v) => sum + v.stock, 0); }
  if (status === 'published' && !product.image) throw Error(`Associe uma foto antes de publicar ${name}.`);
  return product;
}

function downloadTemplate(advanced) {
  const headers = advanced ? ['SKU', 'Nome', 'Categoria', 'Subcategoria', 'Marca', 'Modelo', 'Cor', 'Preço', 'Promoção', 'Estoque', 'Tamanhos', 'Variações', 'Status'] : ['SKU', 'Nome', 'Categoria', 'Preço', 'Estoque', 'Status'];
  const sample = advanced ? ['CAM001', 'Camisa exemplo', 'Camisas', 'Tailandesas', '', '', 'Azul', '140', '', '5', 'P:2; M:3', '', 'draft'] : ['CAM001', 'Camisa exemplo', 'Camisas', '140', '5', 'draft'];
  const csv = '\uFEFF' + [headers, sample].map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = advanced ? 'modelo-be-imports-variacoes.csv' : 'modelo-be-imports.csv'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function importedRows() {
  if (!state.imported) return [];
  const result = state.imported.rows.map(values => {
    const row = newRow();
    for (const key of columns) if (state.mapping?.[key] != null) row[key] = values[state.mapping[key]] ?? '';
    row.status = ['published', 'draft'].includes(row.status) ? row.status : '';
    return row;
  });
  return result;
}
function autoPhotoRow(file) {
  const name = file.name.toUpperCase();
  return state.rows.findIndex(row => row.sku && (name.startsWith(row.sku.toUpperCase() + '-') || name.startsWith(row.sku.toUpperCase() + '_')));
}
async function optimizedPhoto(file) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw Error(`Formato inválido: ${file.name}. Use PNG, JPEG ou WebP.`);
  if (file.size <= 1_500_000) return file;
  const source = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = source; await image.decode();
    const scale = Math.min(1, 1800 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas'); canvas.width = Math.round(image.naturalWidth * scale); canvas.height = Math.round(image.naturalHeight * scale);
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', .86));
    if (blob && blob.size < file.size) return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.webp', { type: 'image/webp' });
    return file;
  } catch { return file; }
  finally { URL.revokeObjectURL(source); }
}
async function uploadPhoto(file, upload) {
  const optimized = await optimizedPhoto(file);
  if (optimized.size > 5_242_880) throw Error(`Foto ${file.name} ultrapassa 5 MB mesmo após otimização.`);
  return upload(optimized);
}
function addBatchPhotos(files) {
  const list = [...files].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }));
  for (const file of list) if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw Error(`Foto inválida: ${file.name}. Use PNG, JPEG ou WebP.`);
  for (const file of list) {
    state.photos.push({ file, preview: URL.createObjectURL(file), row: autoPhotoRow(file) });
  }
}
function reviewBulk(catalog, policy) {
  const existing = new Map(catalog.products.map(product => [(product.sku || makeSku(product.id)).toUpperCase(), product]));
  const seen = new Set(), errors = {};
  let ready = 0, skipped = 0;
  state.rows.forEach((row, i) => {
    if (!row.name && !row.sku && !row.category && !row.price) return;
    const sku = row.sku.trim().toUpperCase(), old = sku ? existing.get(sku) : null;
    try {
      if (sku && !/^[A-Z0-9_-]{3,40}$/.test(sku)) throw Error('SKU deve ter de 3 a 40 letras, números, _ ou -.');
      if (sku && seen.has(sku)) throw Error('SKU duplicado nas linhas.');
      if (sku) seen.add(sku);
      if (old && policy === 'skip') { skipped++;return; }
      const files = state.photos.filter(photo => photo.row === i);
      if ((old?.gallery?.length || 0) + Math.max(0, files.length - 1) > 8) throw Error('Use até 8 fotos adicionais.');
      buildProduct(row, catalog, old, files.length ? '/uploads/preflight.jpg' : '');
      ready++;
    } catch (error) { errors[i] = error.message; }
  });
  if (state.photos.some(photo => photo.row < 0 || !state.rows[photo.row])) errors.photos = 'Associe todas as fotos a um produto.';
  return { ready, skipped, errors };
}
async function saveBulk(catalog, api, upload, save, refresh) {
  const rows = state.rows.filter(row => row.name || row.sku || row.category || row.price);
  if (!rows.length) throw Error('Adicione pelo menos um produto.');
  const policy = state.duplicatePolicy;
  state.review = reviewBulk(catalog, policy);
  if (Object.keys(state.review.errors).length) throw Error(`${state.review.ready} pronto(s); ${Object.keys(state.review.errors).length} precisam de correção. ${Object.values(state.review.errors).slice(0, 3).join(' ')}`);
  const existing = new Map(catalog.products.map(product => [(product.sku || makeSku(product.id)).toUpperCase(), product]));
  const rowSkus = new Set(), jobs = [], errors = [];
  for (const [index, row] of rows.entries()) {
    const sku = row.sku.trim().toUpperCase();
    if (sku && rowSkus.has(sku)) { errors.push(`Linha ${index + 1}: SKU duplicado na planilha.`); continue; }
    if (sku) rowSkus.add(sku);
    const old = sku ? existing.get(sku) : null;
    if (old && policy === 'skip') continue;
    try {
      const files = state.photos.filter(photo => photo.row === state.rows.indexOf(row));
      if ((old?.gallery?.length || 0) + Math.max(0, files.length - 1) > 8) throw Error('Use até 8 fotos adicionais por produto.');
      const product = buildProduct(row, catalog, old, files.length ? '/uploads/preflight.jpg' : '');
      if (row.status === 'published' && !product.image && !files.length) throw Error('Foto principal obrigatória para publicar.');
      jobs.push({ row, old, product, files });
    } catch (error) { errors.push(`Linha ${index + 1}: ${error.message}`); }
  }
  if (errors.length) throw Error(`${jobs.length} prontos; ${errors.length} precisam de correção. ${errors.slice(0, 5).join(' ')}`);
  if (!jobs.length) throw Error('Nenhum produto novo para salvar. Confira a opção para SKUs repetidos.');
  if (catalog.products.length + jobs.filter(job => !job.old).length > 2000) throw Error('O catálogo aceita no máximo 2.000 produtos.');
  const updates = jobs.filter(job => job.old).length;
  if (!confirm(`${jobs.length} produto(s) serão salvos, incluindo ${updates} atualização(ões). Confirmar?`)) return;
  const latest = await api('/api/admin/catalog');
  if (String(latest.revision) !== String(catalog.revision)) throw Error('O catálogo mudou. Recarregue o painel antes de salvar.');
  for (const job of jobs) {
    if (!job.files.length) continue;
    const images = [];
    for (const photo of job.files) images.push(await uploadPhoto(photo.file, upload));
    job.product.image = images[0]; job.product.gallery = [...(job.old?.gallery || []), ...images.slice(1)];
  }
  const changed = new Map(jobs.filter(job => job.old).map(job => [job.old.id, job.product]));
  const products = [...catalog.products.map(product => changed.get(product.id) || product), ...jobs.filter(job => !job.old).map(job => job.product)];
  if (!await save({ ...catalog, products })) return;
  state.rows = [newRow()]; state.selected.clear();state.review = null;state.photos.forEach(photo => URL.revokeObjectURL(photo.preview));state.photos = [];
  state.message = `${jobs.length} produto(s) salvos. ${updates} atualizado(s).`;
  refresh();
}

function duplicateProduct(product) {
  const id = crypto.randomUUID();
  const clone = structuredClone(product);
  clone.id = id; clone.sku = makeSku(id); clone.slug = `${slug(product.name)}-copia-${id.slice(0, 8)}`; clone.name = `Cópia de ${product.name}`; clone.createdAt = new Date().toISOString(); clone.status = 'draft'; clone.stock = 0;
  if (clone.stockBySize) clone.stockBySize = Object.fromEntries(Object.keys(clone.stockBySize).map(size => [size, 0]));
  for (const key of ['capVariants', 'bermudaVariants', 'electronicsVariants']) if (clone[key]) clone[key] = clone[key].map(item => ({ ...item, stock: 0 }));
  return clone;
}

export function mountWorkspace(root, { catalog, api, upload, save, rerender, editProduct }) {
  const legacy = root.querySelector('.admin-layout');
  const shell = document.createElement('div');
  shell.className = 'aw-shell';
  shell.innerHTML = `<nav class="aw-nav" aria-label="Navegação do painel">${[
    ['overview', 'Visão geral'], ['quick', 'Cadastro rápido'], ['bulk', 'Cadastrar em massa'],
    ['products', 'Produtos'], ['categories', 'Categorias'], ['shirt-subcategories', 'Subcategorias de camisas'], ['library', 'Galeria de fotos'],
    ['edit', 'Cadastro completo'], ['settings', 'Configurações']
  ].map(([key, label]) => `<button type="button" data-tab="${key}">${label}</button>`).join('')}</nav><main class="aw-main"><div id="admin-workspace-feedback"></div><div class="aw-screen"></div></main>`;
  legacy.before(shell);
  shell.querySelector('.aw-main').append(legacy);
  const screen = shell.querySelector('.aw-screen');
  const view = () => {
    shell.dataset.tab = state.tab;
    shell.querySelectorAll('.aw-nav [data-tab]').forEach(button => button.classList.toggle('active', button.dataset.tab === state.tab));
    screen.innerHTML = notice(state.message, true) + (state.tab === 'overview' ? renderOverview(catalog) : state.tab === 'quick' ? renderQuick(catalog) : state.tab === 'bulk' ? renderBulk(catalog) : state.tab === 'products' ? renderProducts(catalog) : state.tab === 'categories' ? renderCategories(catalog) : state.tab === 'shirt-subcategories' ? renderShirtSubcategories(catalog) : state.tab === 'library' ? renderLibrary(catalog) : '');
    const visible = ['edit', 'categories', 'shirt-subcategories', 'settings'].includes(state.tab);
    legacy.style.display = visible ? '' : 'none';
    legacy.querySelector('.admin-list').style.display = state.tab === 'edit' ? '' : 'none';
    const panels = legacy.querySelectorAll('.admin-panel');
    panels.forEach((panel, index) => { panel.style.display = state.tab === 'edit' && index === 0 || state.tab === 'categories' && index === 1 || state.tab === 'shirt-subcategories' && index === 2 || state.tab === 'settings' && index === 3 ? '' : 'none'; });
    if (state.tab !== 'edit') legacy.style.gridTemplateColumns = '1fr';
  };
  const message = (value, good = false) => {
    const target = shell.querySelector('#admin-workspace-feedback') || screen;
    target.innerHTML = notice(value, good);
  };
  const persist = async next => { if (await save(next)) { state.message = 'Alterações salvas.'; rerender(); return true; } return false; };
  view();

  shell.addEventListener('click', async event => {
    const button = event.target.closest('button'); if (!button || !shell.contains(button)) return;
    try {
      if (button.dataset.tab) { state.tab = button.dataset.tab; state.message = ''; view(); return; }
      if (button.dataset.bulk) { state.bulkMode = button.dataset.bulk; view(); return; }
      if (button.dataset.page) { state.page += button.dataset.page === 'next' ? 1 : -1; view(); return; }
      if (button.dataset.openProduct) { state.tab = 'edit'; editProduct(button.dataset.openProduct); return; }
      if (button.dataset.inlineSave) {
        const id = button.dataset.inlineSave, original = catalog.products.find(p => p.id === id);
        const price = amount(shell.querySelector(`[data-inline-price="${CSS.escape(id)}"]`).value);
        const status = shell.querySelector(`[data-inline-status="${CSS.escape(id)}"]`).value;
        if (!Number.isFinite(price) || price <= 0) throw Error('Informe um preço válido.');
        const updated = { ...original, price, status, compareAt: original.compareAt > price ? original.compareAt : null };
        if (await persist({ ...catalog, products: catalog.products.map(p => p.id === id ? updated : p) })) view();
        return;
      }
      if (button.dataset.duplicate) {
        const source = catalog.products.find(p => p.id === button.dataset.duplicate);
        if (!source || !confirm(`Duplicar ${source.name} como rascunho, com estoque zerado?`)) return;
        const clone = duplicateProduct(source);
        if (await persist({ ...catalog, products: [...catalog.products, clone] })) { state.tab = 'edit'; editProduct(clone.id); }
        return;
      }
      if (button.dataset.categoryMove) {
        const [from, direction] = button.dataset.categoryMove.split(':'); const to = Number(from) + (direction === 'up' ? -1 : 1);
        const categories = [...catalog.categories];[categories[from], categories[to]] = [categories[to], categories[from]];
        if (await persist({ ...catalog, categories })) view(); return;
      }
      if (button.dataset.subcategoryEdit != null) {
        const i = Number(button.dataset.subcategoryEdit), old = catalog.subcategories[i];
        const name = prompt('Novo nome da subcategoria:', old.name)?.trim();if (!name || name === old.name) return;
        const subcategories = catalog.subcategories.map((item, index) => index === i ? { ...item, name } : item);
        const products = catalog.products.map(p => p.category === old.category && p.subcategory === old.name ? { ...p, subcategory: name } : p);
        if (await persist({ ...catalog, subcategories, products })) view(); return;
      }
      if (button.dataset.subcategoryRemove != null) {
        const i = Number(button.dataset.subcategoryRemove), old = catalog.subcategories[i];
        if (catalog.products.some(p => p.category === old.category && p.subcategory === old.name)) throw Error('Mova os produtos desta subcategoria antes de excluí-la.');
        if (!confirm(`Excluir ${old.name}?`)) return;
        if (await persist({ ...catalog, subcategories: catalog.subcategories.filter((_, index) => index !== i) })) view();return;
      }
      if (button.dataset.removePhoto != null) { const i = Number(button.dataset.removePhoto);URL.revokeObjectURL(state.photos[i].preview);state.photos.splice(i, 1);state.review = null;view();return; }
      if (button.dataset.photoMove) { const [from, direction] = button.dataset.photoMove.split(':');const i = Number(from), to = i + (direction === 'up' ? -1 : 1);[state.photos[i], state.photos[to]] = [state.photos[to], state.photos[i]];state.review = null;view();return; }
      if (button.dataset.useMedia) { state.quickPhoto = button.dataset.useMedia;state.tab = 'quick';view();return; }
      if (button.dataset.removeMedia) {
        const url = button.dataset.removeMedia;
        const used = catalog.products.some(p => p.image === url || (p.gallery || []).includes(url)) || catalog.categories.some(c => c.image === url) || (catalog.shirtSubcategories || []).some(s => s.image === url);
        if (used) throw Error('Esta foto está em uso. Troque a imagem no produto ou categoria antes de remover.');
        if (!confirm('Remover esta foto da biblioteca? O arquivo armazenado permanecerá disponível.')) return;
        if (await persist({ ...catalog, media: (catalog.media || []).filter(item => item !== url) })) view();return;
      }
      if (button.dataset.action === 'clear-quick-photo') { state.quickPhoto = '';view();return; }
      if (button.dataset.action === 'template-simple' || button.dataset.action === 'template-advanced') { downloadTemplate(button.dataset.action === 'template-advanced');return; }
      if (button.dataset.action === 'add-row' || button.dataset.action === 'add-ten') { const n = button.dataset.action === 'add-ten' ? 10 : 1;for (let i = 0; i < n; i++) state.rows.push(newRow());state.review = null;view();return; }
      if (button.dataset.action === 'remove-rows') { state.rows = state.rows.filter((_, i) => !state.selected.has(i));if (!state.rows.length) state.rows = [newRow()];state.selected.clear();state.photos.forEach(photo => URL.revokeObjectURL(photo.preview));state.photos = [];state.review = null;view();return; }
      if (button.dataset.action === 'fill-rows') {
        const field = shell.querySelector('#aw-fill-field').value, value = shell.querySelector('#aw-fill-value').value;
        for (const i of state.selected) state.rows[i][field] = value;
        state.review = null;view();return;
      }
      if (button.dataset.action === 'apply-import') {
        if (state.mapping?.name == null || state.mapping?.category == null || state.mapping?.price == null) throw Error('Associe pelo menos Nome, Categoria e Preço.');
        const rows = importedRows();state.rows = [...state.rows.filter(row => Object.values(row).some(value => value && value !== 'draft' && value !== '0')), ...rows];
        state.bulkMode = 'table';state.selected.clear();state.review = null;view();return;
      }
      if (button.dataset.action === 'review-bulk') { state.review = reviewBulk(catalog, state.duplicatePolicy);view();return; }
      if (button.dataset.action === 'save-bulk') { button.disabled = true;message('Validando e salvando…', true);try { await saveBulk(catalog, api, upload, persist, rerender); } finally { button.disabled = false; }return; }
      if (button.dataset.action === 'mass-apply') { await massApply(catalog, shell, persist, rerender);return; }
    } catch (error) { if (button.dataset.action === 'save-bulk') view();message(error.message); }
  });

  shell.addEventListener('input', event => {
    const input = event.target;
    if (input.dataset.row != null && input.dataset.field) { state.rows[Number(input.dataset.row)][input.dataset.field] = input.value;state.review = null;return; }
    if (input.id === 'aw-product-search') {
      state.productSearch = input.value;const position = input.selectionStart;view();
      const replacement = shell.querySelector('#aw-product-search');replacement?.focus();replacement?.setSelectionRange(position, position);
    }
  });
  shell.addEventListener('paste', event => {
    const input = event.target;
    if (input.dataset.row == null || !input.dataset.field) return;
    const text = event.clipboardData?.getData('text/plain') || '';
    if (!text.includes('\t') && !text.includes('\n')) return;
    event.preventDefault();
    const startRow = Number(input.dataset.row), startCol = columns.indexOf(input.dataset.field);
    for (const [r, line] of text.trimEnd().split(/\r?\n/).entries()) {
      if (startRow + r >= 2000) break;
      while (state.rows.length <= startRow + r) state.rows.push(newRow());
      for (const [c, value] of line.split('\t').entries()) if (columns[startCol + c]) state.rows[startRow + r][columns[startCol + c]] = value.trim();
    }
    state.review = null;
    view();
  });
  shell.addEventListener('change', async event => {
    const input = event.target;
    try {
      if (input.dataset.row != null && input.dataset.field) { state.rows[Number(input.dataset.row)][input.dataset.field] = input.value;state.review = null;if (input.dataset.field === 'category') { state.rows[Number(input.dataset.row)].subcategory = '';view(); }return; }
      if (input.dataset.selectRow != null) { const i = Number(input.dataset.selectRow);input.checked ? state.selected.add(i) : state.selected.delete(i);return; }
      if (input.id === 'aw-select-all') { state.selected = input.checked ? new Set(state.rows.map((_, i) => i)) : new Set();view();return; }
      if (input.dataset.selectProduct) { input.checked ? state.selectedProducts.add(input.dataset.selectProduct) : state.selectedProducts.delete(input.dataset.selectProduct);return; }
      if (input.dataset.map) { state.mapping[input.dataset.map] = input.value === '' ? null : Number(input.value);return; }
      if (input.dataset.photoRow != null) { state.photos[Number(input.dataset.photoRow)].row = input.value === '' ? -1 : Number(input.value);state.review = null;return; }
      if (input.id === 'aw-duplicate-policy') { state.duplicatePolicy = input.value;state.review = null;return; }
      if (input.dataset.categoryActive != null) {
        const categories = catalog.categories.map((item, i) => i === Number(input.dataset.categoryActive) ? { ...item, active: input.checked } : item);
        if (await persist({ ...catalog, categories })) view();return;
      }
      if (input.id === 'aw-product-category' || input.id === 'aw-product-subcategory' || input.id === 'aw-product-promotion' || input.id === 'aw-product-status' || input.id === 'aw-product-stock' || input.id === 'aw-product-sort') {
        state[{ 'aw-product-category': 'productCategory', 'aw-product-subcategory': 'productSubcategory', 'aw-product-promotion': 'productPromotion', 'aw-product-status': 'productStatus', 'aw-product-stock': 'productStock', 'aw-product-sort': 'productSort' }[input.id]] = input.value;
        if (input.id === 'aw-product-category') state.productSubcategory = '';
        state.page = 1;view();return;
      }
      if (input.name === 'category' && input.closest('#aw-quick-form')) { state.quickCategory = input.value;input.form.elements.subcategory.innerHTML = subcategoryOptions(catalog, input.value);input.form.querySelector('#aw-category-details').innerHTML = categoryDetails(input.value);return; }
      if (input.id === 'aw-import-file' && input.files[0]) {
        const file = input.files[0];if (file.size > 2_500_000) throw Error('A planilha deve ter até 2,5 MB.');
        message('Lendo planilha…', true);
        const encoded = await new Promise((resolve, reject) => { const reader = new FileReader();reader.onload = () => resolve(String(reader.result).split(',')[1]);reader.onerror = reject;reader.readAsDataURL(file); });
        state.imported = await api('/api/admin/import-preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: file.name, data: encoded }) });
        state.mapping = Object.fromEntries(Object.entries(aliases).map(([key, options]) => [key, state.imported.headers.findIndex(header => options.includes(header.toLocaleLowerCase('pt-BR').trim()))]).map(([key, index]) => [key, index < 0 ? null : index]));
        view();return;
      }
      if (input.id === 'aw-batch-photos') {
        addBatchPhotos(input.files);
        state.review = null;
        view();return;
      }
      if (input.id === 'aw-library-upload') {
        const files = [...input.files];if (!files.length) return;
        message(`Enviando ${files.length} foto(s)…`, true);
        const urls = [];for (const file of files) urls.push(await uploadPhoto(file, upload));
        if (await persist({ ...catalog, media: [...new Set([...(catalog.media || []), ...urls])] })) view();return;
      }
    } catch (error) { message(error.message); }
  });
  shell.addEventListener('submit', async event => {
    const form = event.target;
    if (!['aw-quick-form', 'aw-subcategory-form'].includes(form.id)) return;
    event.preventDefault();const submit = form.querySelector('[type="submit"]');submit.disabled = true;
    try {
      if (form.id === 'aw-subcategory-form') {
        const category = form.elements.category.value, name = form.elements.name.value.trim();
        if (!category || !name) throw Error('Informe categoria e subcategoria.');
        if (await persist({ ...catalog, subcategories: [...(catalog.subcategories || []), { category, name, active: true }] })) view();
      } else {
        const data = Object.fromEntries(new FormData(form));
        const row = { ...newRow(), ...data, category: form.elements.category.value, subcategory: form.elements.subcategory.value, status: form.elements.status.value };
        const file = form.elements.photo.files[0];
        const product = buildProduct(row, catalog, null, state.quickPhoto || (file ? '/uploads/preflight.jpg' : ''));
        if (file) product.image = await uploadPhoto(file, upload);
        if (await persist({ ...catalog, products: [...catalog.products, product] })) { state.quickCategory = product.category;state.quickPrevious = { category: product.category, subcategory: product.subcategory, brand: row.brand, model: row.model, color: row.color };state.quickPhoto = '';state.message = 'Produto salvo. Você já pode cadastrar o próximo.';rerender(); }
      }
    } catch (error) { message(error.message); }
    finally { submit.disabled = false; }
  });
  shell.addEventListener('dragover', event => { if (event.target.closest('[data-drop-zone]')) event.preventDefault(); });
  shell.addEventListener('drop', async event => {
    const zone = event.target.closest('[data-drop-zone]');if (!zone) return;
    event.preventDefault();
    try {
      const files = [...event.dataTransfer.files];
      if (zone.dataset.dropZone === 'batch') { addBatchPhotos(files);state.review = null;view(); }
      else if (files.length) {
        message(`Enviando ${files.length} foto(s)…`, true);
        const urls = [];for (const file of files) urls.push(await uploadPhoto(file, upload));
        if (await persist({ ...catalog, media: [...new Set([...(catalog.media || []), ...urls])] })) view();
      }
    } catch (error) { message(error.message); }
  });
}

async function massApply(catalog, shell, save, view) {
  const selected = catalog.products.filter(product => state.selectedProducts.has(product.id));
  if (!selected.length) throw Error('Selecione pelo menos um produto.');
  const action = shell.querySelector('#aw-mass-action').value, value = shell.querySelector('#aw-mass-value').value.trim();
  if (!action) throw Error('Selecione uma ação coletiva.');
  if (!confirm(`${action === 'delete' ? 'EXCLUIR' : 'Alterar'} ${selected.length} produto(s) com a ação “${action}”${value ? ` e valor “${value}”` : ''}?`)) return;
  const selectedIds = new Set(selected.map(product => product.id));
  const products = action === 'delete' ? catalog.products.filter(product => !selectedIds.has(product.id)) : catalog.products.map(product => {
    if (!selectedIds.has(product.id)) return product;
    const p = { ...product };
    if (action === 'category') { if (!catalog.categories.some(item => item.name === value)) throw Error('Categoria não cadastrada.');if (p.category !== value && (isVariantCategory(p.category) || isVariantCategory(value) || ['Eletrônicos', 'Fones de ouvido'].includes(p.category) || ['Eletrônicos', 'Fones de ouvido'].includes(value))) throw Error(`Revise ${p.name} no cadastro completo antes de mudar entre categorias com variações.`);p.category = value;p.status = 'draft'; }
    else if (action === 'subcategory') p.subcategory = value;
    else if (action === 'price') { p.price = amount(value);p.compareAt = p.compareAt > p.price ? p.compareAt : null; }
    else if (action === 'promo') { const promotional = amount(value);if (!(promotional > 0 && promotional < p.price)) throw Error('Preço promocional deve ser menor que o atual.');p.compareAt = p.price;p.price = promotional; }
    else if (action === 'remove-promo') { if (p.compareAt > p.price) p.price = p.compareAt;p.compareAt = null; }
    else if (action === 'published' || action === 'draft') p.status = action;
    else if (action === 'stock') { if (isVariantCategory(p.category) || ['Eletrônicos', 'Fones de ouvido'].includes(p.category) && p.electronicsVariants?.length) throw Error(`Edite as variações de ${p.name} individualmente para não perder o controle de estoque.`);p.stock = Number(value); }
    return p;
  });
  if (await save({ ...catalog, products })) { state.selectedProducts.clear();view(); }
}
