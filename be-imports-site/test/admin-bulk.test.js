import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scryptSync } from 'node:crypto';

const testRoot = path.dirname(fileURLToPath(import.meta.url));
const temp = fs.mkdtempSync(path.join(testRoot, 'admin-bulk-tmp-'));
process.env.DATA_DIR = temp;
process.env.ADMIN_PASSWORD_HASH = `scrypt:${'b'.repeat(32)}:${scryptSync('senha-de-teste-segura', 'b'.repeat(32), 64).toString('hex')}`;
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SECRET_KEY;
const { handler } = await import('../server.js');

async function request(url, options = {}) {
  const req = { url, method: options.method || 'GET', headers: Object.fromEntries(Object.entries(options.headers || {}).map(([key, value]) => [key.toLowerCase(), value])), async *[Symbol.asyncIterator]() { if (options.body) yield Buffer.from(options.body); } };
  const res = { statusCode: 200, headers: {}, output: '', writeHead(status, headers) { this.statusCode = status; this.headers = headers; }, end(chunk = '') { this.output += chunk; } };
  await handler(req, res);
  return { status: res.statusCode, data: JSON.parse(res.output), cookie: res.headers['Set-Cookie']?.split(';')[0] };
}

test('importação exige administrador e cadastro de dez produtos é atômico', async () => {
  try {
    const csv = 'SKU;Nome;Categoria;Preço;Estoque\n' + Array.from({ length: 50 }, (_, i) => `CAM${i + 1};Camisa ${i + 1};Camisas;140;2`).join('\n');
    const previewBody = JSON.stringify({ name: 'lista.csv', data: Buffer.from(csv).toString('base64') });
    assert.equal((await request('/api/admin/import-preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: previewBody })).status, 401);
    const login = await request('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'senha-de-teste-segura' }) });
    assert.equal(login.status, 200);
    const headers = { Cookie: login.cookie, 'Content-Type': 'application/json' };
    const preview = await request('/api/admin/import-preview', { method: 'POST', headers, body: previewBody });
    assert.equal(preview.status, 200);
    assert.equal(preview.data.count, 50);
    const original = (await request('/api/admin/catalog', { headers })).data;
    const products = Array.from({ length: 10 }, (_, i) => ({ id: `bulk-item-${i}`, sku: `CAM${i}`, name: `Camisa ${i}`, category: 'Camisas', price: 140, stock: 2, status: 'draft' }));
    const saved = await request('/api/admin/catalog', { method: 'PUT', headers, body: JSON.stringify({ ...original, products }) });
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
    assert.equal(saved.data.products.length, 10);
    assert.equal(saved.data.products[0].sku, 'CAM0');
    const duplicate = await request('/api/admin/catalog', { method: 'PUT', headers, body: JSON.stringify({ ...saved.data, products: [...saved.data.products, { ...products[0], id: 'another-id' }] }) });
    assert.equal(duplicate.status, 400);
    const after = (await request('/api/admin/catalog', { headers })).data;
    assert.equal(after.products.length, 10);
    assert.equal(after.products[0].sku, 'CAM0');
    const custom = await request('/api/admin/catalog', { method: 'PUT', headers, body: JSON.stringify({ ...after, settings: { ...after.settings, defaultCategory: 'Camisas', defaultStock: 3, defaultStatus: 'draft' }, subcategories: [{ category: 'Bermudas', name: 'Jeans', active: true }], categories: after.categories.map(category => category.name === 'Bermudas' ? { ...category, active: false } : category) }) });
    assert.equal(custom.status, 200, JSON.stringify(custom.data));
    assert.equal(custom.data.subcategories[0].name, 'Jeans');
    assert.equal(custom.data.settings.defaultStock, 3);
    assert.equal((await request('/api/catalog')).data.categories.some(item => item.name === 'Bermudas'), false);
    const fifty = Array.from({ length: 50 }, (_, i) => ({ id: `import-item-${i}`, sku: `IMP${i + 1}`, name: `Produto importado ${i + 1}`, category: 'Camisas', price: 140, stock: 0, status: 'draft' }));
    const imported = await request('/api/admin/catalog', { method: 'PUT', headers, body: JSON.stringify({ ...custom.data, products: [...custom.data.products, ...fifty] }) });
    assert.equal(imported.status, 200, JSON.stringify(imported.data));
    assert.equal(imported.data.products.length, 60);
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/V9sAAAAASUVORK5CYII=';
    const imageBody = JSON.stringify({ image: `data:image/png;base64,${png}` });
    const firstImage = await request('/api/admin/upload', { method: 'POST', headers, body: imageBody });
    const secondImage = await request('/api/admin/upload', { method: 'POST', headers, body: imageBody });
    assert.equal(firstImage.status, 200);
    assert.equal(secondImage.status, 200);
    assert.notEqual(firstImage.data.url, secondImage.data.url);
    const withPhotos = await request('/api/admin/catalog', { method: 'PUT', headers, body: JSON.stringify({ ...imported.data, settings: { ...imported.data.settings, whatsapp: '5571999999999' }, products: imported.data.products.map(product => product.sku === 'IMP1' ? { ...product, image: firstImage.data.url, gallery: [secondImage.data.url], sizes: ['M'], stockBySize: { M: 1 }, stock: 1, status: 'published' } : product) }) });
    assert.equal(withPhotos.status, 200, JSON.stringify(withPhotos.data));
    assert.equal(withPhotos.data.products.find(product => product.sku === 'IMP1').gallery[0], secondImage.data.url);
    assert.equal((await request('/api/catalog')).data.products.find(product => product.sku === 'IMP1').image, firstImage.data.url);
    const checkoutBody = JSON.stringify({ customer: { name: 'Ana Lima', city: 'Salvador' }, items: [{ productId: withPhotos.data.products.find(product => product.sku === 'IMP1').id, size: 'M', quantity: 1 }] });
    assert.equal((await request('/api/checkout', { method: 'POST', headers, body: checkoutBody })).status, 200);
    const hidden = await request('/api/admin/catalog', { method: 'PUT', headers, body: JSON.stringify({ ...withPhotos.data, categories: withPhotos.data.categories.map(category => category.name === 'Camisas' ? { ...category, active: false } : category) }) });
    assert.equal(hidden.status, 200);
    assert.equal((await request('/api/catalog')).data.products.some(product => product.sku === 'IMP1'), false);
    assert.equal((await request('/api/checkout', { method: 'POST', headers, body: checkoutBody })).status, 409);
  } finally {
    if (path.resolve(temp).startsWith(path.resolve(testRoot) + path.sep)) fs.rmSync(temp, { recursive: true, force: true });
  }
});
