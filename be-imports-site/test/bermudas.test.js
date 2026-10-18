import test from 'node:test';
import assert from 'node:assert/strict';
import { bermudaColors, bermudaSizes, bermudaVariantStock, filterBermudas } from '../catalog-filter.js';
import { bermudasPage, bermudaDetailPage } from '../bermudas-page.js';
import { prepareCheckout } from '../checkout.js';

const shorts = {
  id: 'bermuda', slug: 'bermuda-teste', name: 'Bermuda Tactel', category: 'Bermudas',
  brand: 'Marca A', bermudaType: 'Tactel', fabric: 'Poliéster', price: 89.9, stock: 3,
  sizes: ['P', 'M'], image: '/uploads/bermuda.png', gallery: [], status: 'published', createdAt: '2026-10-01',
  bermudaVariants: [
    { color: 'Preto', size: 'P', stock: 2 },
    { color: 'Preto', size: 'M', stock: 0 },
    { color: 'Bege', size: 'M', stock: 1 }
  ]
};
const other = { ...shorts, id: 'sarja', slug: 'bermuda-sarja', name: 'Bermuda Sarja', brand: '', bermudaType: 'Sarja', price: 109.9, stock: 1, sizes: ['40'], bermudaVariants: [{ color: '', size: '40', stock: 1 }], createdAt: '2026-10-10' };

test('catálogo de bermudas mostra as opções e combina filtros reais', () => {
  const products = [shorts, other, { ...shorts, id: 'draft', status: 'draft' }];
  const ids = query => filterBermudas(products, query).map(product => product.id);
  assert.deepEqual(ids(''), ['bermuda', 'sarja']);
  assert.deepEqual(ids('tipo=Tactel&tamanho=M&cor=Bege&q=MARCA%20A&min=80&max=100&disponivel=1'), ['bermuda']);
  assert.deepEqual(ids('tipo=Tactel&tamanho=M&cor=Preto&disponivel=1'), []);
  assert.deepEqual(ids('tipo=Tactel&tamanho=P&cor=Bege'), []);
  assert.deepEqual(ids('ordem=price-desc'), ['sarja', 'bermuda']);
  assert.deepEqual(bermudaColors(shorts), ['Preto', 'Bege']);
  assert.deepEqual(bermudaSizes(shorts), ['P', 'M']);
  const html = bermudasPage([shorts, other], new URLSearchParams(), '');
  for (const type of ['Moletom', 'Tactel', 'Jeans', 'Sarja', 'Esportiva', 'Praia', 'Cargo', 'Social', 'Outros']) assert.match(html, new RegExp(`data-bermuda-type="${type}"`));
  assert.match(html, /href="#catalogo-bermudas"/);
  assert.match(bermudaDetailPage(shorts, 0, ''), /name="color"/);
});

test('checkout de bermudas bloqueia variações esgotadas e informa cor e tamanho', () => {
  const catalog = { settings: { whatsapp: '5571992417737' }, products: [shorts] };
  const customer = { name: 'Ana Lima', city: 'Salvador', postalCode: '40000000' };
  const quote = prepareCheckout({ customer, items: [{ productId: 'bermuda', color: 'Bege', size: 'M', quantity: 1 }] }, catalog);
  assert.equal(quote.subtotal, 89.9);
  assert.match(decodeURIComponent(quote.whatsappUrl), /cor Bege/);
  assert.match(decodeURIComponent(quote.whatsappUrl), /tamanho M/);
  assert.equal(bermudaVariantStock(shorts, 'Preto', 'M'), 0);
  assert.throws(() => prepareCheckout({ customer, items: [{ productId: 'bermuda', color: 'Preto', size: 'M', quantity: 1 }] }, catalog), { status: 409 });
  assert.throws(() => prepareCheckout({ customer, items: [{ productId: 'bermuda', color: 'Bege', size: 'M', quantity: 2 }] }, catalog), { status: 409 });
});
