import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scryptSync } from 'node:crypto';
import { filterProducts } from '../catalog-filter.js';

const tempRoot = path.dirname(fileURLToPath(import.meta.url));
const temp = fs.mkdtempSync(path.join(tempRoot, 'tmp-'));
process.env.DATA_DIR = temp;
process.env.ADMIN_PASSWORD_HASH = `scrypt:${'a'.repeat(32)}:${scryptSync('uma-senha-de-teste-segura', 'a'.repeat(32), 64).toString('hex')}`;
const { handler } = await import('../server.js');
const request = async (url, options = {}) => {
  const req = {
    url, method: options.method || 'GET', headers: Object.fromEntries(Object.entries(options.headers || {}).map(([key, value]) => [key.toLowerCase(), value])),
    async *[Symbol.asyncIterator]() { if (options.body) yield Buffer.from(options.body); }
  };
  const res = {
    statusCode: 200, headers: {}, output: '',
    writeHead(status, headers) { this.statusCode = status; this.headers = headers; },
    end(chunk = '') { this.output += chunk; }
  };
  await handler(req, res);
  return { status: res.statusCode, data: JSON.parse(res.output), headers: { get: name => Object.entries(res.headers).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1] } };
};

test('catálogo público, autenticação, publicação e atualização', async () => {
  try {
    let result = await request('/api/catalog');
    assert.equal(result.status, 200);
    assert.deepEqual(result.data.products, []);
    assert.deepEqual(result.data.categories.map(item => item.name), ['Camisas', 'Bermudas', 'Bonés', 'Perfumes', 'Fones de ouvido', 'Roupas', 'Acessórios']);
    assert.equal((await request('/api/admin/catalog')).status, 401);
    const login = await request('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'uma-senha-de-teste-segura' }) });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const adminHeaders = { Cookie: cookie, 'Content-Type': 'application/json' };
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/V9sAAAAASUVORK5CYII=';
    const upload = await request('/api/admin/upload', { method: 'POST', headers: adminHeaders, body: JSON.stringify({ image: `data:image/png;base64,${png}` }) });
    assert.equal(upload.status, 200);
    const admin = await request('/api/admin/catalog', { headers: { Cookie: cookie } });
    assert.equal(admin.data.categories.length, 7);
    const item = { name: 'Camisa teste', category: 'Camisas', subcategory: 'Times', price: 90, compareAt: 120, stock: 2, image: upload.data.url, gallery: [upload.data.url], videoUrl: 'https://youtu.be/dQw4w9WgXcQ', sizes: ['M', 'G'], status: 'published' };
    const saved = await request('/api/admin/catalog', { method: 'PUT', headers: adminHeaders, body: JSON.stringify({ ...admin.data, shirtSubcategories: [{ name: 'Times', image: '' }], settings: { ...admin.data.settings, whatsapp: '5575999999999' }, categories: admin.data.categories.map(category => category.name === 'Camisas' ? { ...category, image: upload.data.url } : category), products: [item] }) });
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
    result = await request('/api/catalog');
    assert.equal(result.data.products.length, 1);
    assert.equal(result.data.products[0].category, 'Camisas');
    assert.equal(result.data.products[0].subcategory, 'Times');
    assert.deepEqual(result.data.shirtSubcategories.map(item => item.name), ['Times']);
    assert.equal(result.data.products[0].compareAt, 120);
    assert.deepEqual(result.data.products[0].gallery, [upload.data.url]);
    assert.equal(result.data.products[0].videoUrl, 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    assert.equal(result.data.categories.find(category => category.name === 'Camisas').image, upload.data.url);
    const checkout = async items => request('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer: { name: 'Ana Lima', city: 'Salvador', postalCode: '40000000' }, items }) });
    const quote = await checkout([{ productId: saved.data.products[0].id, size: 'M', quantity: 2 }]);
    assert.equal(quote.status, 200);
    assert.equal(quote.data.subtotal, 180);
    assert.equal(quote.data.total, null);
    assert.equal(quote.data.shipping.status, 'pending');
    assert.match(decodeURIComponent(quote.data.whatsappUrl), /Camisa teste/);
    assert.equal((await checkout([{ productId: saved.data.products[0].id, size: 'M', quantity: 3 }])).status, 409);
    assert.equal((await checkout([{ productId: saved.data.products[0].id, size: 'G', quantity: 1, price: 1 }])).data.subtotal, 90);
    assert.equal((await checkout([{ productId: saved.data.products[0].id, size: 'P', quantity: 1 }])).status, 409);
    assert.equal((await checkout([null])).status, 400);
    assert.equal((await checkout([{ productId: 'desconhecido', size: '', quantity: 1 }])).status, 409);
    const duplicate = await request('/api/admin/catalog', { method: 'PUT', headers: adminHeaders, body: JSON.stringify({ ...saved.data, categories: [...saved.data.categories, { name: 'camisas', image: '' }] }) });
    assert.equal(duplicate.status, 400);
    const unknown = await request('/api/admin/catalog', { method: 'PUT', headers: adminHeaders, body: JSON.stringify({ ...saved.data, products: [{ ...saved.data.products[0], category: 'Outra' }] }) });
    assert.equal(unknown.status, 400);
    const unsafeVideo = await request('/api/admin/catalog', { method: 'PUT', headers: adminHeaders, body: JSON.stringify({ ...saved.data, products: [{ ...saved.data.products[0], videoUrl: 'https://example.com/video' }] }) });
    assert.equal(unsafeVideo.status, 400);
    const conflict = await request('/api/admin/catalog', { method: 'PUT', headers: adminHeaders, body: JSON.stringify({ ...admin.data, shirtSubcategories: saved.data.shirtSubcategories, products: [item] }) });
    assert.equal(conflict.status, 409);
    const draft = await request('/api/admin/catalog', { method: 'PUT', headers: adminHeaders, body: JSON.stringify({ ...saved.data, products: [{ ...saved.data.products[0], status: 'draft' }] }) });
    assert.equal(draft.status, 200);
    assert.deepEqual((await request('/api/catalog')).data.products, []);
    const renamed = await request('/api/admin/catalog', { method: 'PUT', headers: adminHeaders, body: JSON.stringify({ ...draft.data, categories: draft.data.categories.map(category => category.name === 'Camisas' ? { ...category, name: 'Camisas premium' } : category), products: draft.data.products.map(product => ({ ...product, category: 'Camisas premium', status: 'published' })) }) });
    assert.equal(renamed.status, 200);
    result = await request('/api/catalog');
    assert.equal(result.data.products[0].category, 'Camisas premium');
    assert.equal(result.data.categories.find(category => category.name === 'Camisas premium').image, upload.data.url);
    const bermuda = { name: 'Bermuda de teste', category: 'Bermudas', brand: 'Marca de teste', bermudaType: 'Tactel', fabric: 'Poliéster', color: 'Preto', price: 90, stock: 2, sizes: ['P', 'M'], bermudaVariants: [{ color: 'Preto', size: 'P', stock: 2 }, { color: 'Preto', size: 'M', stock: 0 }], image: upload.data.url, status: 'published' };
    const bermudasSaved = await request('/api/admin/catalog', { method: 'PUT', headers: adminHeaders, body: JSON.stringify({ ...renamed.data, products: [...renamed.data.products, bermuda] }) });
    assert.equal(bermudasSaved.status, 200, JSON.stringify(bermudasSaved.data));
    const publishedBermuda = (await request('/api/catalog')).data.products.find(product => product.category === 'Bermudas');
    assert.equal(publishedBermuda.bermudaType, 'Tactel');
    assert.deepEqual(publishedBermuda.bermudaVariants.map(item => item.stock), [2, 0]);
    assert.equal((await checkout([{ productId: publishedBermuda.id, color: 'Preto', size: 'P', quantity: 2 }])).status, 200);
    assert.equal((await checkout([{ productId: publishedBermuda.id, color: 'Preto', size: 'M', quantity: 1 }])).status, 409);
    const invalidBermuda = await request('/api/admin/catalog', { method: 'PUT', headers: adminHeaders, body: JSON.stringify({ ...bermudasSaved.data, products: bermudasSaved.data.products.map(product => product.id === publishedBermuda.id ? { ...product, bermudaVariants: [] } : product) }) });
    assert.equal(invalidBermuda.status, 400);
    const removed = await request('/api/admin/catalog', { method: 'PUT', headers: adminHeaders, body: JSON.stringify({ ...bermudasSaved.data, categories: bermudasSaved.data.categories.filter(category => category.name !== 'Bermudas'), products: bermudasSaved.data.products.filter(product => product.category !== 'Bermudas') }) });
    assert.equal(removed.status, 200);
    assert.equal((await request('/api/catalog')).data.categories.some(category => category.name === 'Bermudas'), false);
    const shoe = { name: 'Tênis de teste', category: 'Tênis', brand: 'Marca de teste', shoeType: 'Casual', color: 'Preto', price: 200, stock: 2, sizes: ['39', '40'], stockBySize: { 39: 2, 40: 0 }, image: upload.data.url, status: 'published' };
    const shoesSaved = await request('/api/admin/catalog', { method: 'PUT', headers: adminHeaders, body: JSON.stringify({ ...removed.data, categories: [...removed.data.categories, { name: 'Tênis', image: '' }], products: [...removed.data.products, shoe] }) });
    assert.equal(shoesSaved.status, 200, JSON.stringify(shoesSaved.data));
    const publishedShoe = (await request('/api/catalog')).data.products.find(product => product.category === 'Tênis');
    assert.equal(publishedShoe.brand, 'Marca de teste');
    assert.deepEqual(publishedShoe.stockBySize, { 39: 2, 40: 0 });
    assert.equal((await checkout([{ productId: publishedShoe.id, size: '39', quantity: 2 }])).status, 200);
    assert.equal((await checkout([{ productId: publishedShoe.id, size: '40', quantity: 1 }])).status, 409);
    const cap = { name: 'Boné de teste', category: 'Bonés', brand: 'Marca de teste', capType: 'Aba Curva', color: 'Preto', price: 100, stock: 3, sizes: ['Ajustável'], capVariants: [{ color: 'Preto', size: 'Ajustável', stock: 2 }, { color: 'Branco', size: 'Ajustável', stock: 1 }, { color: 'Azul', size: 'Ajustável', stock: 0 }], image: upload.data.url, status: 'published' };
    const capsSaved = await request('/api/admin/catalog', { method: 'PUT', headers: adminHeaders, body: JSON.stringify({ ...shoesSaved.data, products: [...shoesSaved.data.products, cap] }) });
    assert.equal(capsSaved.status, 200, JSON.stringify(capsSaved.data));
    const publishedCap = (await request('/api/catalog')).data.products.find(product => product.category === 'Bonés');
    assert.equal(publishedCap.capType, 'Aba Curva');
    assert.deepEqual(publishedCap.capVariants.map(item => item.stock), [2, 1, 0]);
    assert.equal((await checkout([{ productId: publishedCap.id, color: 'Preto', size: 'Ajustável', quantity: 2 }])).status, 200);
    assert.equal((await checkout([{ productId: publishedCap.id, color: 'Azul', size: 'Ajustável', quantity: 1 }])).status, 409);
    const missingCapVariants = await request('/api/admin/catalog', { method: 'PUT', headers: adminHeaders, body: JSON.stringify({ ...capsSaved.data, products: capsSaved.data.products.map(product => product.id === publishedCap.id ? { ...product, capVariants: [] } : product) }) });
    assert.equal(missingCapVariants.status, 400);
    const perfume = { name: 'Perfume de teste', category: 'Perfumes', brand: 'Marca de teste', perfumeType: 'Feminino', perfumeOrigin: 'Importado', perfumeConcentration: 'EDP', perfumeNotes: 'Notas florais', price: 180, stock: 4, sizes: ['50 ml', '100 ml'], stockBySize: { '50 ml': 1, '100 ml': 3 }, image: upload.data.url, status: 'published' };
    const perfumesSaved = await request('/api/admin/catalog', { method: 'PUT', headers: adminHeaders, body: JSON.stringify({ ...capsSaved.data, products: [...capsSaved.data.products, perfume] }) });
    assert.equal(perfumesSaved.status, 200, JSON.stringify(perfumesSaved.data));
    const publishedPerfume = (await request('/api/catalog')).data.products.find(product => product.category === 'Perfumes');
    assert.equal(publishedPerfume.brand, 'Marca de teste');
    assert.equal(publishedPerfume.perfumeConcentration, 'EDP');
    assert.deepEqual(publishedPerfume.stockBySize, { '50 ml': 1, '100 ml': 3 });
    assert.equal((await checkout([{ productId: publishedPerfume.id, size: '50 ml', quantity: 1 }])).status, 200);
    assert.equal((await checkout([{ productId: publishedPerfume.id, size: '50 ml', quantity: 2 }])).status, 409);
    const electronic = { name: 'Relógio teste', category: 'Eletrônicos', brand: 'Marca teste', electronicsType: 'Smartwatches', electronicsModel: 'Solar', electronicsSpecs: 'Bateria: 7 dias', electronicsVariants: [{ color: 'Preto', stock: 2 }, { color: 'Prata', stock: 0 }], price: 230, stock: 2, sizes: [], image: upload.data.url, status: 'published' };
    const electronicsSaved = await request('/api/admin/catalog', { method: 'PUT', headers: adminHeaders, body: JSON.stringify({ ...perfumesSaved.data, categories: [...perfumesSaved.data.categories, { name: 'Eletrônicos', image: '' }], products: [...perfumesSaved.data.products, electronic] }) });
    assert.equal(electronicsSaved.status, 200, JSON.stringify(electronicsSaved.data));
    const publishedElectronic = (await request('/api/catalog')).data.products.find(product => product.category === 'Eletrônicos');
    assert.equal(publishedElectronic.electronicsModel, 'Solar');
    assert.equal(publishedElectronic.electronicsSpecs, 'Bateria: 7 dias');
    assert.deepEqual(publishedElectronic.electronicsVariants, [{ color: 'Preto', stock: 2 }, { color: 'Prata', stock: 0 }]);
    assert.equal((await checkout([{ productId: publishedElectronic.id, color: 'Preto', quantity: 2 }])).status, 200);
    assert.equal((await checkout([{ productId: publishedElectronic.id, color: 'Prata', quantity: 1 }])).status, 409);
  } finally { if (path.resolve(temp).startsWith(path.resolve(tempRoot) + path.sep)) fs.rmSync(temp, { recursive: true, force: true }); }
});

test('busca, categoria, preço efetivo, disponibilidade e ordenações', () => {
  const items = [
    { name: 'Camisa B', category: 'Camisas', price: 80, compareAt: 120, stock: 2, createdAt: '2026-01-01' },
    { name: 'Camisa A', category: 'Camisas', price: 50, compareAt: null, stock: 0, createdAt: '2026-03-01' },
    { name: 'Fone C', category: 'Fones de ouvido', price: 150, compareAt: 200, stock: 3, createdAt: '2026-02-01' }
  ];
  const names = query => filterProducts(items, query).map(item => item.name);
  assert.deepEqual(names(''), ['Camisa A', 'Camisa B', 'Fone C']);
  assert.deepEqual(names('categoria=Camisas'), ['Camisa A', 'Camisa B']);
  for (const category of ['Bermudas', 'Bonés', 'Perfumes', 'Roupas', 'Acessórios']) assert.deepEqual(names(`categoria=${encodeURIComponent(category)}`), []);
  assert.deepEqual(names('categoria=Fones%20de%20ouvido'), ['Fone C']);
  assert.deepEqual(names('q=camisa'), ['Camisa A', 'Camisa B']);
  assert.deepEqual(names('min=60&max=100'), ['Camisa B']);
  assert.deepEqual(names('disponivel=1'), ['Camisa B', 'Fone C']);
  assert.deepEqual(names('ordem=price-desc'), ['Fone C', 'Camisa B', 'Camisa A']);
  assert.deepEqual(names('ordem=recent'), ['Camisa A', 'Fone C', 'Camisa B']);
  assert.deepEqual(names('ordem=name'), ['Camisa A', 'Camisa B', 'Fone C']);
  assert.deepEqual(names('categoria=Camisas&q=zzz'), []);
});
