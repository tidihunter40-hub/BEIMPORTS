import { escapeHtml } from './script.js';
import { mountWorkspace } from './admin-workspace.js';

const api = async (url, options = {}) => {
  const res = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Não foi possível concluir a operação.');
  return data;
};
let documentData;
let selectedId = null;
let selectedCategory = null;
let selectedShirtSubcategory = null;
let refreshPublic;
let root;
const shirtSizes = ['P', 'M', 'G', 'GG', 'G1', 'G2', 'G3'];
const shoeSizes = Array.from({ length: 13 }, (_, index) => String(index + 34));
const field = (name, label, value = '', type = 'text', extra = '') => `<label>${label}<input name="${name}" type="${type}" value="${escapeHtml(value)}" ${extra}></label>`;
const errorText = message => `<p class="admin-message" role="alert">${escapeHtml(message)}</p>`;

async function renderLogin(configured) {
  root.innerHTML = `<section class="admin-shell wrap"><div class="admin-login"><span class="eyebrow">ÁREA RESTRITA</span><h1>Painel BE IMPORTS</h1>${configured ? '<p>Entre para gerenciar os produtos e informações da loja.</p>' : '<p>Configure ADMIN_PASSWORD_HASH no servidor antes de acessar o painel.</p>'}<form id="login-form">${field('password', 'Senha', '', 'password', 'required autocomplete="current-password"')}<button class="button gold" type="submit">Entrar</button></form><div id="admin-feedback"></div></div></section>`;
  root.querySelector('#login-form').addEventListener('submit', async event => {
    event.preventDefault();
    try { await api('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: event.target.password.value }) }); await loadDashboard(); }
    catch (error) { root.querySelector('#admin-feedback').innerHTML = errorText(error.message); }
  });
}
function renderDashboard() {
  const p = documentData.products.find(item => item.id === selectedId);
  const category = documentData.categories.find(item => item.name === selectedCategory);
  const shirtSubcategory = (documentData.shirtSubcategories || []).find(item => item.name === selectedShirtSubcategory);
  const shownShirtSizes = [...shirtSizes, ...(p?.category === 'Camisas' ? (p.sizes || []).filter(size => !shirtSizes.includes(size)) : [])];
  const shownShoeSizes = [...shoeSizes, ...(p?.category === 'Tênis' ? (p.sizes || []).filter(size => !shoeSizes.includes(size)) : [])];
  root.innerHTML = `<section class="admin-shell wrap"><div class="admin-heading"><div><span class="eyebrow">ÁREA ADMINISTRATIVA</span><h1>Gerenciar loja</h1></div><button id="logout" class="text-button" type="button">Sair do painel</button></div>
    <div class="admin-layout"><aside class="admin-list"><div class="admin-list-title"><h2>Produtos (${documentData.products.length})</h2><button id="new-product" class="button gold" type="button">+ Novo</button></div>${documentData.products.length ? documentData.products.map(item => `<button type="button" data-edit="${escapeHtml(item.id)}" class="admin-list-item ${item.id === selectedId ? 'selected' : ''}"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.category)} · ${item.status === 'published' ? 'Publicado' : 'Rascunho'}</small></button>`).join('') : '<p class="admin-empty">Nenhum produto cadastrado.</p>'}</aside>
    <div class="admin-editor"><div class="admin-panel"><h2>${p ? 'Editar produto' : 'Novo produto'}</h2><p>Produtos publicados aparecem imediatamente no catálogo. Uma foto enviada pelo painel é obrigatória para publicar.</p><form id="product-form">
      ${field('name', 'Nome do produto', p?.name, 'text', 'required maxlength="140"')}
      <label>Categoria<select name="category" required><option value="">Selecione uma categoria</option>${documentData.categories.map(({ name }) => `<option value="${escapeHtml(name)}" ${p?.category === name ? 'selected' : ''}>${escapeHtml(name)}</option>`).join('')}</select></label>
      <div data-shirt-fields ${p?.category === 'Camisas' ? '' : 'hidden'}><div class="admin-row"><label>Subcategoria<select name="subcategory"><option value="">Sem subcategoria</option>${(documentData.shirtSubcategories || []).map(({ name }) => `<option value="${escapeHtml(name)}" ${p?.subcategory === name ? 'selected' : ''}>${escapeHtml(name)}</option>`).join('')}</select></label>${field('color', 'Cor (opcional)', p?.color || '', 'text', 'maxlength="40"')}</div><label>Regra de preço<select name="pricingRule"><option value="standard" ${p?.pricingRule !== 'thai' ? 'selected' : ''}>Preço cadastrado</option><option value="thai" ${p?.pricingRule === 'thai' ? 'selected' : ''}>Camisa tailandesa — tabela progressiva</option></select></label><fieldset class="admin-shirt-sizes"><legend>Estoque por tamanho — deixe em branco se não oferecer o tamanho</legend><div>${shownShirtSizes.map(size => `<label>${escapeHtml(size)}<input type="number" data-shirt-size="${escapeHtml(size)}" min="0" step="1" value="${escapeHtml(p?.stockBySize?.[size] ?? '')}"></label>`).join('')}</div></fieldset></div>
      <div data-shoe-fields ${p?.category === 'Tênis' ? '' : 'hidden'}><div class="admin-row">${field('brand', 'Marca do tênis', p?.brand || '', 'text', 'maxlength="40"')}<label>Tipo<select name="shoeType"><option value="">Selecione</option><option value="Casual" ${p?.shoeType === 'Casual' ? 'selected' : ''}>Casual</option><option value="Esportivo" ${p?.shoeType === 'Esportivo' ? 'selected' : ''}>Esportivo</option></select></label></div>${field('shoeColor', 'Cor (opcional)', p?.category === 'Tênis' ? p?.color || '' : '', 'text', 'maxlength="40"')}<fieldset class="admin-shirt-sizes"><legend>Estoque por numeração — deixe em branco se não oferecer o número</legend><div>${shownShoeSizes.map(size => `<label>${escapeHtml(size)}<input type="number" data-shoe-size="${escapeHtml(size)}" min="0" step="1" value="${escapeHtml(p?.category === 'Tênis' ? p?.stockBySize?.[size] ?? '' : '')}"></label>`).join('')}</div></fieldset></div>
      <div data-cap-fields ${p?.category === 'Bonés' ? '' : 'hidden'}><div class="admin-row">${field('capBrand', 'Marca do boné', p?.category === 'Bonés' ? p?.brand || '' : '', 'text', 'maxlength="40"')}<label>Modelo<select name="capType"><option value="">Selecione</option>${['Snapback', 'Aba Curva', 'Aba Reta', 'Trucker', 'Esportivo'].map(type => `<option value="${type}" ${p?.capType === type ? 'selected' : ''}>${type}</option>`).join('')}</select></label></div><label>Variações: uma por linha, no formato Cor | Tamanho ou ajuste | Estoque<textarea name="capVariants" rows="5" placeholder="Preto | Ajustável | 3&#10;Branco | Ajustável | 1">${escapeHtml(p?.category === 'Bonés' ? (p.capVariants || []).map(item => `${item.color} | ${item.size} | ${item.stock}`).join('\n') : '')}</textarea></label><p>Para tamanho único, deixe o campo do meio vazio: Preto | | 3. Cadastre também as variações esgotadas com estoque 0.</p></div>
      <div data-bermuda-fields ${p?.category === 'Bermudas' ? '' : 'hidden'}><div class="admin-row">${field('bermudaBrand', 'Marca da bermuda (opcional)', p?.category === 'Bermudas' ? p?.brand || '' : '', 'text', 'maxlength="40"')}<label>Modelo<select name="bermudaType"><option value="">Selecione</option>${['Moletom', 'Tactel', 'Jeans', 'Sarja', 'Esportiva', 'Praia', 'Cargo', 'Social', 'Outros'].map(type => `<option value="${type}" ${p?.bermudaType === type ? 'selected' : ''}>${type}</option>`).join('')}</select></label></div>${field('fabric', 'Material ou tecido (opcional)', p?.category === 'Bermudas' ? p?.fabric || '' : '', 'text', 'maxlength="60"')}<label>Variações: uma por linha, no formato Cor | Tamanho | Estoque<textarea name="bermudaVariants" rows="6" placeholder="Preto | P | 2&#10;Preto | M | 1&#10;Bege | 40 | 3">${escapeHtml(p?.category === 'Bermudas' ? (p.bermudaVariants || []).map(item => `${item.color} | ${item.size} | ${item.stock}`).join('\n') : '')}</textarea></label><p>Se a bermuda não tiver cor cadastrada, deixe o primeiro campo vazio. Cadastre também os tamanhos esgotados com estoque 0.</p></div>
      <div data-perfume-fields ${p?.category === 'Perfumes' ? '' : 'hidden'}><div class="admin-row">${field('perfumeBrand', 'Marca do perfume', p?.category === 'Perfumes' ? p?.brand || '' : '', 'text', 'maxlength="40"')}<label>Tipo<select name="perfumeType"><option value="">Não informado</option>${['Masculino', 'Feminino', 'Unissex'].map(value => `<option value="${value}" ${p?.perfumeType === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label></div><div class="admin-row"><label>Origem<select name="perfumeOrigin"><option value="">Não informada</option>${['Nacional', 'Importado'].map(value => `<option value="${value}" ${p?.perfumeOrigin === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label><label>Categoria especial<select name="perfumeCollection"><option value="">Nenhuma</option>${['Árabes', 'Kits e Presentes', 'Miniaturas', 'Testers', 'Outros'].map(value => `<option value="${value}" ${p?.perfumeCollection === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label></div>${field('perfumeConcentration', 'Concentração (se cadastrada)', p?.perfumeConcentration || '', 'text', 'maxlength="40"')}<label>Notas olfativas (se cadastradas)<textarea name="perfumeNotes" rows="3" maxlength="600">${escapeHtml(p?.perfumeNotes || '')}</textarea></label><label>Volumes: uma linha por frasco, no formato Volume | Estoque<textarea name="perfumeVariants" rows="5" placeholder="50 ml | 1&#10;100 ml | 3">${escapeHtml(p?.category === 'Perfumes' ? (p.sizes || []).map(size => `${size} | ${p.stockBySize?.[size] ?? 0}`).join('\n') : '')}</textarea></label><p>O estoque total será a soma dos volumes. Cadastre os volumes esgotados com estoque 0.</p></div>
      <div data-electronic-fields ${['Eletrônicos', 'Fones de ouvido'].includes(p?.category) ? '' : 'hidden'}><div class="admin-row">${field('electronicsBrand', 'Marca do eletrônico (se cadastrada)', ['Eletrônicos', 'Fones de ouvido'].includes(p?.category) ? p?.brand || '' : '', 'text', 'maxlength="40"')}${field('electronicsModel', 'Modelo (se cadastrado)', p?.electronicsModel || '', 'text', 'maxlength="80"')}</div><label>Categoria do eletrônico<select name="electronicsType"><option value="">Selecione</option>${['Celulares', 'Notebooks', 'Fones de Ouvido', 'Caixas de Som', 'Smartwatches', 'Consoles', 'Acessórios', 'Drones', 'TVs e Monitores', 'Outros'].map(value => `<option value="${value}" ${(p?.electronicsType || (p?.category === 'Fones de ouvido' ? 'Fones de Ouvido' : '')) === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label><label>Especificações técnicas cadastradas (opcional)<textarea name="electronicsSpecs" rows="5" maxlength="2000">${escapeHtml(p?.electronicsSpecs || '')}</textarea></label>${field('electronicsStock', 'Estoque total sem variações', p?.stock ?? 0, 'number', 'min="0" step="1"')}<label>Variações: uma por linha, no formato Cor | Estoque<textarea name="electronicsVariants" rows="5" placeholder="Preto | 3&#10;Prata | 2&#10;Dourado | 0">${escapeHtml(['Eletrônicos', 'Fones de ouvido'].includes(p?.category) ? (p.electronicsVariants || []).map(item => `${item.color} | ${item.stock}`).join('\n') : '')}</textarea></label><p>Se cadastrar variações, o estoque total será a soma delas. Cadastre cores esgotadas com 0.</p></div>
      <div class="admin-row">${field('price', 'Preço atual (R$)', p?.price, 'number', 'required min="0.01" step="0.01"')}${field('compareAt', 'Preço anterior (R$), se houver', p?.compareAt ?? '', 'number', 'min="0.01" step="0.01"')}</div>
      <div class="admin-row" data-non-shirt-fields ${['Camisas', 'Tênis', 'Bonés', 'Bermudas', 'Perfumes', 'Eletrônicos', 'Fones de ouvido'].includes(p?.category) ? 'hidden' : ''}>${field('stock', 'Estoque', p?.stock ?? 0, 'number', 'min="0" step="1"')}${field('sizes', 'Tamanhos (separados por vírgula)', p?.sizes?.join(', ') || '')}</div>
      <label>Descrição<textarea name="description" rows="4">${escapeHtml(p?.description || '')}</textarea></label>
      <label>Foto real do produto<input name="photo" type="file" accept="image/png,image/jpeg,image/webp"></label>
      ${p?.image ? `<label><img class="admin-preview" src="${escapeHtml(p.image)}" alt="Foto atual de ${escapeHtml(p.name)}"><span><input type="radio" name="mainImage" value="${escapeHtml(p.image)}" checked> Foto principal</span></label>` : ''}
      <label>Fotos adicionais para o carrossel (até 8)<input name="gallery" type="file" accept="image/png,image/jpeg,image/webp" multiple></label>
      ${p?.gallery?.length ? `<div class="admin-gallery">${p.gallery.map((url, index) => `<label><img class="admin-preview" src="${escapeHtml(url)}" alt="Foto adicional"><span><input type="radio" name="mainImage" value="${escapeHtml(url)}"> Usar como principal</span><span>Ordem <input type="number" data-gallery-order="${escapeHtml(url)}" min="1" max="8" value="${index + 1}"></span><span><input type="checkbox" name="removeGallery" value="${escapeHtml(url)}"> Remover</span></label>`).join('')}</div>` : ''}
      ${field('videoUrl', 'Vídeo do produto no YouTube (opcional)', p?.videoUrl || '', 'url', 'placeholder="https://youtu.be/..."')}
      <label>Status<select name="status"><option value="draft" ${p?.status !== 'published' ? 'selected' : ''}>Rascunho</option><option value="published" ${p?.status === 'published' ? 'selected' : ''}>Publicado</option></select></label>
      <div class="admin-actions"><button class="button gold" type="submit">Salvar produto</button>${p ? '<button id="delete-product" class="text-button danger" type="button">Excluir produto</button>' : ''}</div></form><div id="product-feedback"></div></div>
    <div class="admin-panel"><div class="admin-list-title"><h2>Categorias (${documentData.categories.length})</h2><button id="new-category" class="button outline" type="button">+ Nova</button></div><div class="admin-category-list">${documentData.categories.map(item => `<button type="button" data-edit-category="${escapeHtml(item.name)}" class="admin-category-item ${selectedCategory === item.name ? 'selected' : ''}">${item.image ? `<img src="${escapeHtml(item.image)}" alt="">` : '<span aria-hidden="true">BE</span>'}<strong>${escapeHtml(item.name)}</strong></button>`).join('')}</div><form id="category-form">${field('name', category ? 'Editar categoria' : 'Nova categoria', category?.name, 'text', 'required maxlength="60"')}<label>Imagem da categoria (opcional)<input name="photo" type="file" accept="image/png,image/jpeg,image/webp"></label>${category?.image ? `<img class="admin-preview" src="${escapeHtml(category.image)}" alt="Imagem atual de ${escapeHtml(category.name)}"><label class="checkbox"><input name="removeImage" type="checkbox"> Remover imagem</label>` : ''}<div class="admin-actions"><button class="button gold" type="submit">Salvar categoria</button>${category ? '<button id="delete-category" class="text-button danger" type="button">Excluir categoria</button>' : ''}</div></form><div id="category-feedback"></div></div>
    <div class="admin-panel"><div class="admin-list-title"><h2>Subcategorias de Camisas</h2><button id="new-shirt-subcategory" class="button outline" type="button">+ Nova</button></div><div class="admin-category-list">${(documentData.shirtSubcategories || []).map(item => `<button type="button" data-edit-shirt-subcategory="${escapeHtml(item.name)}" class="admin-category-item ${selectedShirtSubcategory === item.name ? 'selected' : ''}">${item.image ? `<img src="${escapeHtml(item.image)}" alt="">` : '<span aria-hidden="true">BE</span>'}<strong>${escapeHtml(item.name)}</strong></button>`).join('') || '<p>Cadastre subcategorias para exibir os filtros na página Camisas.</p>'}</div><form id="shirt-subcategory-form">${field('name', shirtSubcategory ? 'Editar subcategoria' : 'Nova subcategoria', shirtSubcategory?.name, 'text', 'required maxlength="60"')}<label>Imagem da subcategoria (opcional)<input name="photo" type="file" accept="image/png,image/jpeg,image/webp"></label>${shirtSubcategory?.image ? `<img class="admin-preview" src="${escapeHtml(shirtSubcategory.image)}" alt="Imagem atual"><label class="checkbox"><input name="removeImage" type="checkbox"> Remover imagem</label>` : ''}<div class="admin-actions"><button class="button gold" type="submit">Salvar subcategoria</button>${shirtSubcategory ? '<button id="delete-shirt-subcategory" class="text-button danger" type="button">Excluir subcategoria</button>' : ''}</div></form><div id="shirt-subcategory-feedback"></div></div>
    <div class="admin-panel"><h2>Informações da loja</h2><form id="settings-form">${field('instagram', 'Instagram oficial', documentData.settings.instagram, 'url')}${field('whatsapp', 'WhatsApp comercial (DDI + DDD + número)', documentData.settings.whatsapp, 'tel', 'placeholder="5575999999999"')}${field('address', 'Endereço', documentData.settings.address)}${field('hours', 'Horário de funcionamento', documentData.settings.hours)}<button class="button gold" type="submit">Salvar informações</button></form><div id="settings-feedback"></div></div></div></div></section>`;
  root.querySelector('#product-form').insertAdjacentHTML('afterbegin', field('sku', 'SKU (gerado automaticamente se vazio)', p?.sku || '', 'text', 'maxlength="40"'));
  root.querySelector('#product-form [name="category"]').closest('label').insertAdjacentHTML('afterend', `<label data-generic-subcategory ${p?.category && p.category !== 'Camisas' ? '' : 'hidden'}>Subcategoria<select name="genericSubcategory"><option value="">Sem subcategoria</option>${(documentData.subcategories || []).filter(item => item.category === p?.category && item.active !== false).map(item => `<option value="${escapeHtml(item.name)}" ${p?.subcategory === item.name ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}</select></label>`);
  root.querySelector('#settings-form button[type="submit"]').insertAdjacentHTML('beforebegin', `<h3>Padrões do cadastro rápido</h3><label>Categoria inicial<select name="defaultCategory"><option value="">Selecione a cada produto</option>${documentData.categories.map(item => `<option value="${escapeHtml(item.name)}" ${documentData.settings.defaultCategory === item.name ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}</select></label>${field('defaultStock', 'Estoque inicial', documentData.settings.defaultStock ?? 0, 'number', 'min="0" step="1"')}<label>Status inicial<select name="defaultStatus"><option value="draft" ${documentData.settings.defaultStatus !== 'published' ? 'selected' : ''}>Rascunho</option><option value="published" ${documentData.settings.defaultStatus === 'published' ? 'selected' : ''}>Publicado</option></select></label>`);
  root.querySelector('#logout').addEventListener('click', async () => { await api('/api/admin/logout', { method: 'POST' }); await renderLogin(true); });
  root.querySelector('#new-product').addEventListener('click', () => { selectedId = null; renderDashboard(); root.querySelector('#product-form').scrollIntoView({ behavior: 'smooth' }); });
  root.querySelectorAll('[data-edit]').forEach(button => button.addEventListener('click', () => { selectedId = button.dataset.edit; renderDashboard(); root.querySelector('#product-form').scrollIntoView({ behavior: 'smooth' }); }));
  root.querySelector('#product-form').addEventListener('submit', saveProduct);
  root.querySelector('#product-form [name="category"]').addEventListener('change', event => {
    const isShirt = event.target.value === 'Camisas';
    const isShoe = event.target.value === 'Tênis';
    const isCap = event.target.value === 'Bonés';
    const isBermuda = event.target.value === 'Bermudas';
    const isPerfume = event.target.value === 'Perfumes';
    const isElectronic = ['Eletrônicos', 'Fones de ouvido'].includes(event.target.value);
    root.querySelector('[data-shirt-fields]').hidden = !isShirt;
    root.querySelector('[data-shoe-fields]').hidden = !isShoe;
    root.querySelector('[data-cap-fields]').hidden = !isCap;
    root.querySelector('[data-bermuda-fields]').hidden = !isBermuda;
    root.querySelector('[data-perfume-fields]').hidden = !isPerfume;
    root.querySelector('[data-electronic-fields]').hidden = !isElectronic;
    root.querySelector('[data-non-shirt-fields]').hidden = isShirt || isShoe || isCap || isBermuda || isPerfume || isElectronic;
    const generic = root.querySelector('[data-generic-subcategory]'); generic.hidden = !event.target.value || isShirt;
    generic.querySelector('select').innerHTML = `<option value="">Sem subcategoria</option>${(documentData.subcategories || []).filter(item => item.category === event.target.value && item.active !== false).map(item => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)}</option>`).join('')}`;
  });
  root.querySelector('#settings-form').addEventListener('submit', saveSettings);
  root.querySelector('#delete-product')?.addEventListener('click', deleteProduct);
  root.querySelector('#new-category').addEventListener('click', () => { selectedCategory = null; renderDashboard(); root.querySelector('#category-form').scrollIntoView({ behavior: 'smooth' }); });
  root.querySelectorAll('[data-edit-category]').forEach(button => button.addEventListener('click', () => { selectedCategory = button.dataset.editCategory; renderDashboard(); root.querySelector('#category-form').scrollIntoView({ behavior: 'smooth' }); }));
  root.querySelector('#category-form').addEventListener('submit', saveCategory);
  root.querySelector('#delete-category')?.addEventListener('click', deleteCategory);
  root.querySelector('#new-shirt-subcategory').addEventListener('click', () => { selectedShirtSubcategory = null; renderDashboard(); root.querySelector('#shirt-subcategory-form').scrollIntoView({ behavior: 'smooth' }); });
  root.querySelectorAll('[data-edit-shirt-subcategory]').forEach(button => button.addEventListener('click', () => { selectedShirtSubcategory = button.dataset.editShirtSubcategory; renderDashboard(); root.querySelector('#shirt-subcategory-form').scrollIntoView({ behavior: 'smooth' }); }));
  root.querySelector('#shirt-subcategory-form').addEventListener('submit', saveShirtSubcategory);
  root.querySelector('#delete-shirt-subcategory')?.addEventListener('click', deleteShirtSubcategory);
  mountWorkspace(root, { catalog: documentData, api, upload, save: data => persist(data, '#admin-workspace-feedback'), rerender: renderDashboard, editProduct: id => { selectedId = id; renderDashboard(); root.querySelector('#product-form').scrollIntoView({ behavior: 'smooth' }); } });
}
async function persist(data, selector) {
  try {
    documentData = await api('/api/admin/catalog', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    await refreshPublic();
    return true;
  } catch (error) {
    root.querySelector(selector).innerHTML = errorText(error.message);
    return false;
  }
}
async function upload(file) {
  if (!file) return null;
  if (!['image/png','image/jpeg','image/webp'].includes(file.type) || !file.size || file.size > 5_242_880) throw new Error('Use uma foto PNG, JPEG ou WebP de até 5 MB.');
  const signature = [...new Uint8Array(await file.slice(0, 12).arrayBuffer())].map(byte => byte.toString(16).padStart(2, '0')).join('');
  const valid = file.type === 'image/png' ? signature.startsWith('89504e470d0a1a0a') : file.type === 'image/jpeg' ? signature.startsWith('ffd8ff') : signature.startsWith('52494646') && signature.slice(16, 24) === '57454250';
  if (!valid) throw new Error('Formato da foto inválido.');
  const ticket = await api('/api/admin/upload-url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: file.type }) });
  if (ticket.direct) {
    const response = await fetch(ticket.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type, 'Cache-Control': 'max-age=3600' }, body: file });
    if (!response.ok) throw new Error('Não foi possível enviar a foto ao armazenamento.');
    return ticket.url;
  }
  const image = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
  const result = await api('/api/admin/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image }) });
  return result.url;
}
async function saveProduct(event) {
  event.preventDefault();
  const form = event.target, feedback = root.querySelector('#product-feedback');
  const button = form.querySelector('[type="submit"]'); button.disabled = true; feedback.textContent = 'Salvando…';
  try {
    const old = documentData.products.find(item => item.id === selectedId);
    const get = name => form.elements.namedItem(name);
    const photo = await upload(get('photo').files[0]);
    const removed = new Set([...form.querySelectorAll('[name="removeGallery"]:checked')].map(input => input.value));
    if ((old?.gallery || []).filter(url => !removed.has(url)).length + get('gallery').files.length > 8) throw new Error('Use até 8 fotos adicionais por produto.');
    const additional = await Promise.all([...get('gallery').files].map(upload));
    const positions = new Map([...form.querySelectorAll('[data-gallery-order]')].map(input => [input.dataset.galleryOrder, Number(input.value)]));
    let gallery = [...(old?.gallery || []).filter(url => !removed.has(url)).sort((a, b) => (positions.get(a) || 0) - (positions.get(b) || 0)), ...additional];
    let mainImage = photo || old?.image || '';
    const chosenMain = form.querySelector('[name="mainImage"]:checked')?.value;
    if (!photo && chosenMain && chosenMain !== mainImage && gallery.includes(chosenMain)) {
      gallery = gallery.filter(url => url !== chosenMain);
      if (mainImage) gallery.unshift(mainImage);
      mainImage = chosenMain;
    }
    if (gallery.length > 8) throw new Error('Use até 8 fotos adicionais por produto.');
    const isShirt = get('category').value === 'Camisas';
    const isShoe = get('category').value === 'Tênis';
    const isCap = get('category').value === 'Bonés';
    const isBermuda = get('category').value === 'Bermudas';
    const isPerfume = get('category').value === 'Perfumes';
    const isElectronic = ['Eletrônicos', 'Fones de ouvido'].includes(get('category').value);
    const sizeEntries = isShirt ? [...form.querySelectorAll('[data-shirt-size]')].filter(input => input.value !== '').map(input => [input.dataset.shirtSize, Number(input.value)]) : isShoe ? [...form.querySelectorAll('[data-shoe-size]')].filter(input => input.value !== '').map(input => [input.dataset.shoeSize, Number(input.value)]) : [];
    if (sizeEntries.some(([, amount]) => !Number.isSafeInteger(amount) || amount < 0)) throw new Error('Informe quantidades inteiras e não negativas para cada tamanho.');
    const stockBySize = Object.fromEntries(sizeEntries);
    const capVariants = isCap ? get('capVariants').value.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
      const parts = line.split('|').map(part => part.trim());
      if (parts.length !== 3 || !/^\d+$/.test(parts[2]) || (!parts[0] && !parts[1])) throw new Error('Use uma variação por linha: Cor | Tamanho ou ajuste | Estoque.');
      return { color: parts[0], size: parts[1], stock: Number(parts[2]) };
    }) : [];
    const capStock = capVariants.length ? capVariants.reduce((sum, item) => sum + item.stock, 0) : old?.category === 'Bonés' ? old.stock : 0;
    const capSizes = capVariants.length ? [...new Set(capVariants.map(item => item.size).filter(Boolean))] : old?.category === 'Bonés' ? old.sizes || [] : [];
    const bermudaVariants = isBermuda ? get('bermudaVariants').value.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
      const parts = line.split('|').map(part => part.trim());
      if (parts.length !== 3 || !parts[1] || !/^\d+$/.test(parts[2])) throw new Error('Use uma variação por linha: Cor | Tamanho | Estoque.');
      return { color: parts[0], size: parts[1], stock: Number(parts[2]) };
    }) : [];
    const bermudaStock = bermudaVariants.length ? bermudaVariants.reduce((sum, item) => sum + item.stock, 0) : old?.category === 'Bermudas' ? old.stock : 0;
    const bermudaSizes = bermudaVariants.length ? [...new Set(bermudaVariants.map(item => item.size))] : old?.category === 'Bermudas' ? old.sizes || [] : [];
    const perfumeEntries = isPerfume ? get('perfumeVariants').value.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
      const parts = line.split('|').map(part => part.trim());
      if (parts.length !== 2 || !/^\d{1,3}\s?ml$/i.test(parts[0]) || !/^\d+$/.test(parts[1])) throw new Error('Use uma linha por volume: 100 ml | 3.');
      return [parts[0].replace(/\s?ml$/i, ' ml'), Number(parts[1])];
    }) : [];
    if (new Set(perfumeEntries.map(([volume]) => volume)).size !== perfumeEntries.length) throw new Error('Cada volume deve aparecer uma vez.');
    const perfumeStockBySize = Object.fromEntries(perfumeEntries);
    const perfumeStock = perfumeEntries.reduce((sum, [, amount]) => sum + amount, 0);
    const electronicsVariants = isElectronic ? get('electronicsVariants').value.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
      const parts = line.split('|').map(part => part.trim());
      if (parts.length !== 2 || !parts[0] || !/^\d+$/.test(parts[1])) throw new Error('Use uma linha por variação: Cor | Estoque.');
      return { color: parts[0], stock: Number(parts[1]) };
    }) : [];
    if (new Set(electronicsVariants.map(item => item.color.toLocaleLowerCase('pt-BR'))).size !== electronicsVariants.length) throw new Error('Cada cor deve aparecer uma vez.');
    const electronicsStock = electronicsVariants.length ? electronicsVariants.reduce((sum, item) => sum + item.stock, 0) : Number(get('electronicsStock').value);
    const product = {
      id: old?.id || crypto.randomUUID(), slug: old?.slug || '', createdAt: old?.createdAt || new Date().toISOString(),
      sku: get('sku').value.trim(),
      name: get('name').value.trim(), category: get('category').value.trim(), price: get('price').value,
      compareAt: get('compareAt').value, stock: isElectronic ? electronicsStock : isPerfume ? perfumeStock : isBermuda ? bermudaStock : isCap ? capStock : isShoe ? Object.values(stockBySize).reduce((sum, amount) => sum + amount, 0) : isShirt ? (sizeEntries.length ? Object.values(stockBySize).reduce((sum, amount) => sum + amount, 0) : old?.category === get('category').value ? old.stock : 0) : get('stock').value,
      sizes: isElectronic ? [] : isPerfume ? Object.keys(perfumeStockBySize) : isBermuda ? bermudaSizes : isCap ? capSizes : isShoe ? Object.keys(stockBySize) : isShirt ? (sizeEntries.length ? Object.keys(stockBySize) : old?.category === get('category').value ? old.sizes : []) : get('sizes').value.split(',').map(x => x.trim()).filter(Boolean),
      ...(isShirt ? { subcategory: get('subcategory').value, color: get('color').value.trim(), pricingRule: get('pricingRule').value, stockBySize } : { subcategory: get('genericSubcategory').value }),
      ...(isShoe ? { brand: get('brand').value.trim(), shoeType: get('shoeType').value, color: get('shoeColor').value.trim(), stockBySize } : {}),
      ...(isCap ? { brand: get('capBrand').value.trim(), capType: get('capType').value, color: capVariants.find(item => item.color)?.color || old?.color || '', capVariants } : {}),
      ...(isBermuda ? { brand: get('bermudaBrand').value.trim(), bermudaType: get('bermudaType').value, fabric: get('fabric').value.trim(), color: bermudaVariants.find(item => item.color)?.color || old?.color || '', bermudaVariants } : {}),
      ...(isPerfume ? { brand: get('perfumeBrand').value.trim(), perfumeType: get('perfumeType').value, perfumeOrigin: get('perfumeOrigin').value, perfumeCollection: get('perfumeCollection').value, perfumeConcentration: get('perfumeConcentration').value.trim(), perfumeNotes: get('perfumeNotes').value.trim(), stockBySize: perfumeStockBySize } : {}),
      ...(isElectronic ? { brand: get('electronicsBrand').value.trim(), electronicsType: get('electronicsType').value, electronicsModel: get('electronicsModel').value.trim(), electronicsSpecs: get('electronicsSpecs').value.trim(), electronicsVariants } : {}),
      description: get('description').value.trim(), image: mainImage, gallery, videoUrl: get('videoUrl').value.trim(), status: get('status').value
    };
    if (isShirt && product.status === 'published' && !product.description.startsWith('[DEMO]') && !product.sizes.length) throw new Error('Cadastre pelo menos um tamanho para publicar a camisa.');
    if (isShoe && product.status === 'published' && !product.description.startsWith('[DEMO]') && (!product.sizes.length || !product.brand)) throw new Error('Cadastre marca e estoque por numeração antes de publicar o tênis.');
    if (isCap && product.status === 'published' && !product.description.startsWith('[DEMO]') && (!capVariants.length || !product.brand || !product.capType)) throw new Error('Cadastre marca, modelo e variações antes de publicar o boné.');
    if (isBermuda && product.status === 'published' && !product.description.startsWith('[DEMO]') && (!product.bermudaType || !bermudaVariants.length)) throw new Error('Cadastre modelo e estoque por tamanho antes de publicar a bermuda.');
    if (isPerfume && product.status === 'published' && !product.description.startsWith('[DEMO]') && (!product.brand || !product.sizes.length)) throw new Error('Cadastre marca e pelo menos um volume antes de publicar o perfume.');
    if (isElectronic && product.category === 'Eletrônicos' && product.status === 'published' && !product.description.startsWith('[DEMO]') && !product.electronicsType) throw new Error('Selecione a categoria do eletrônico antes de publicar.');
    const next = { ...documentData, products: old ? documentData.products.map(item => item.id === old.id ? product : item) : [...documentData.products, product] };
    if (await persist(next, '#product-feedback')) { selectedId = product.id; renderDashboard(); root.querySelector('#product-feedback').innerHTML = '<p class="admin-success" role="status">Produto salvo.</p>'; }
  } catch (error) { feedback.innerHTML = errorText(error.message); }
  finally { if (button.isConnected) button.disabled = false; }
}
async function saveCategory(event) {
  event.preventDefault();
  const form = event.target, feedback = root.querySelector('#category-feedback');
  const button = form.querySelector('[type="submit"]'); button.disabled = true; feedback.textContent = 'Salvando…';
  try {
    const old = documentData.categories.find(item => item.name === selectedCategory);
    const name = form.elements.namedItem('name').value.trim();
    const uploaded = await upload(form.elements.photo.files[0]);
    const image = uploaded || (form.elements.removeImage?.checked ? '' : old?.image || '');
    const next = { ...documentData,
      categories: old ? documentData.categories.map(item => item === old ? { ...item, name, image } : item) : [...documentData.categories, { name, image, active: true }],
      products: old && name !== old.name ? documentData.products.map(item => item.category === old.name ? { ...item, category: name } : item) : documentData.products,
      subcategories: old && name !== old.name ? (documentData.subcategories || []).map(item => item.category === old.name ? { ...item, category: name } : item) : documentData.subcategories
    };
    if (await persist(next, '#category-feedback')) { selectedCategory = name; renderDashboard(); root.querySelector('#category-feedback').innerHTML = '<p class="admin-success" role="status">Categoria salva.</p>'; }
  } catch (error) { feedback.innerHTML = errorText(error.message); }
  finally { if (button.isConnected) button.disabled = false; }
}
async function deleteCategory() {
  const item = documentData.categories.find(x => x.name === selectedCategory);
  if (!item) return;
  if (documentData.products.some(product => product.category === item.name)) { root.querySelector('#category-feedback').innerHTML = errorText('Mova ou exclua os produtos dessa categoria primeiro.'); return; }
  if ((documentData.subcategories || []).some(subcategory => subcategory.category === item.name)) { root.querySelector('#category-feedback').innerHTML = errorText('Exclua as subcategorias dessa categoria primeiro.'); return; }
  if (!confirm(`Excluir a categoria ${item.name}?`)) return;
  if (await persist({ ...documentData, categories: documentData.categories.filter(x => x.name !== item.name) }, '#category-feedback')) { selectedCategory = null; renderDashboard(); }
}
async function saveShirtSubcategory(event) {
  event.preventDefault();
  const form = event.target, feedback = root.querySelector('#shirt-subcategory-feedback');
  const button = form.querySelector('[type="submit"]'); button.disabled = true; feedback.textContent = 'Salvando…';
  try {
    const old = (documentData.shirtSubcategories || []).find(item => item.name === selectedShirtSubcategory);
    const name = form.elements.namedItem('name').value.trim();
    const uploaded = await upload(form.elements.photo.files[0]);
    const image = uploaded || (form.elements.removeImage?.checked ? '' : old?.image || '');
    const shirtSubcategories = old ? documentData.shirtSubcategories.map(item => item === old ? { name, image } : item) : [...(documentData.shirtSubcategories || []), { name, image }];
    const products = old && name !== old.name ? documentData.products.map(item => item.category === 'Camisas' && item.subcategory === old.name ? { ...item, subcategory: name } : item) : documentData.products;
    if (await persist({ ...documentData, shirtSubcategories, products }, '#shirt-subcategory-feedback')) { selectedShirtSubcategory = name; renderDashboard(); root.querySelector('#shirt-subcategory-feedback').innerHTML = '<p class="admin-success" role="status">Subcategoria salva.</p>'; }
  } catch (error) { feedback.innerHTML = errorText(error.message); }
  finally { if (button.isConnected) button.disabled = false; }
}
async function deleteShirtSubcategory() {
  const item = (documentData.shirtSubcategories || []).find(value => value.name === selectedShirtSubcategory);
  if (!item) return;
  const affected = documentData.products.filter(product => product.category === 'Camisas' && product.subcategory === item.name);
  const details = affected.length ? `\n\n${affected.length} produto(s) deixarão de ter esta subcategoria: ${affected.map(product => product.name).join(', ')}. Os produtos e seus estoques serão mantidos.` : '';
  if (!confirm(`Excluir a subcategoria ${item.name}?${details}`)) return;
  const products = affected.length ? documentData.products.map(product => product.category === 'Camisas' && product.subcategory === item.name ? { ...product, subcategory: '' } : product) : documentData.products;
  if (await persist({ ...documentData, shirtSubcategories: documentData.shirtSubcategories.filter(value => value.name !== item.name), products }, '#shirt-subcategory-feedback')) { selectedShirtSubcategory = null; renderDashboard(); }
}
async function saveSettings(event) {
  event.preventDefault();
  const form = event.target;
  const get = name => form.elements.namedItem(name).value.trim();
  const next = { ...documentData, settings: { instagram: get('instagram'), whatsapp: get('whatsapp'), address: get('address'), hours: get('hours'), defaultCategory: get('defaultCategory'), defaultStock: get('defaultStock'), defaultStatus: get('defaultStatus') } };
  if (await persist(next, '#settings-feedback')) { renderDashboard(); root.querySelector('#settings-feedback').innerHTML = '<p class="admin-success" role="status">Informações salvas.</p>'; }
}
async function deleteProduct() {
  const item = documentData.products.find(x => x.id === selectedId);
  if (!item || !confirm(`Excluir ${item.name} do catálogo?`)) return;
  const next = { ...documentData, products: documentData.products.filter(x => x.id !== selectedId) };
  if (await persist(next, '#product-feedback')) { selectedId = null; renderDashboard(); }
}
async function loadDashboard() {
  try { documentData = await api('/api/admin/catalog'); renderDashboard(); }
  catch (error) { root.innerHTML = `<section class="admin-shell wrap">${errorText(error.message)}</section>`; }
}
export async function renderAdmin(container, refresh) {
  root = container; refreshPublic = refresh;
  if (!document.querySelector('link[href="/admin-workspace.css"]')) { const style = document.createElement('link'); style.rel = 'stylesheet'; style.href = '/admin-workspace.css'; document.head.append(style); }
  const session = await api('/api/admin/session');
  if (session.authenticated) await loadDashboard(); else await renderLogin(session.configured);
}
