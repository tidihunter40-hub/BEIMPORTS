import test from 'node:test';
import assert from 'node:assert/strict';
import { filterShoes, shoeSizeStock } from '../catalog-filter.js';
import { prepareCheckout } from '../checkout.js';

const nike = {
  id: 'nike', name: 'Tênis Branco', category: 'Tênis', brand: 'Nike', shoeType: 'Casual',
  color: 'Branco', price: 399.9, stock: 3, sizes: ['38', '39'],
  stockBySize: { 38: 1, 39: 2 }, status: 'published', createdAt: '2026-10-01'
};
const adidas = {
  ...nike, id: 'adidas', name: 'Tênis Preto', brand: 'Adidas', shoeType: 'Esportivo',
  color: 'Preto', price: 299.9, stock: 1, sizes: ['42'], stockBySize: { 42: 1 },
  createdAt: '2026-10-10'
};

test('catálogo de tênis combina filtros e só oferece numerações com estoque', () => {
  const products = [nike, adidas, { ...nike, id: 'draft', status: 'draft' }];
  const ids = query => filterShoes(products, query).map(product => product.id);
  assert.deepEqual(ids(''), ['adidas', 'nike']);
  assert.deepEqual(ids('marca=Nike&tipo=Casual&numero=39&q=BRANCO&min=300&max=400'), ['nike']);
  assert.deepEqual(ids('numero=42'), ['adidas']);
  assert.deepEqual(ids('numero=40'), []);
  assert.deepEqual(ids('ordem=price-desc'), ['nike', 'adidas']);
  assert.equal(shoeSizeStock(nike, '38'), 1);
  assert.equal(shoeSizeStock({ ...nike, stockBySize: {} }, '38'), 0);
});

test('checkout de tênis valida estoque por número e informa frete a combinar com CEP', () => {
  const catalog = { settings: { whatsapp: '5571992417737' }, products: [nike, adidas] };
  const customer = { name: 'Ana Lima', city: 'Salvador', postalCode: '40000000' };
  const quote = prepareCheckout({ customer, items: [{ productId: 'nike', size: '39', quantity: 2 }] }, catalog);
  assert.equal(quote.subtotal, 799.8);
  assert.deepEqual(quote.shipping, { status: 'pending', label: 'Frete a combinar' });
  assert.match(decodeURIComponent(quote.whatsappUrl), /tamanho 39/);
  assert.match(decodeURIComponent(quote.whatsappUrl), /CEP: 40000-000/);
  assert.throws(() => prepareCheckout({ customer, items: [{ productId: 'nike', size: '38', quantity: 2 }] }, catalog), { status: 409 });
  assert.throws(() => prepareCheckout({ customer, items: [{ productId: 'nike', size: '40', quantity: 1 }] }, catalog), { status: 409 });
  assert.throws(() => prepareCheckout({ customer, items: [{ productId: 'nike', size: '', quantity: 1 }] }, catalog), { status: 409 });
});
