import test from 'node:test';
import assert from 'node:assert/strict';
import { capColors, capVariantStock, filterCaps } from '../catalog-filter.js';
import { prepareCheckout } from '../checkout.js';

const cap = {
  id: 'cap', name: 'Boné Ajustável', category: 'Bonés', brand: 'Marca A', capType: 'Aba Curva',
  price: 119.9, stock: 3, sizes: ['Ajustável'], color: 'Preto',
  capVariants: [
    { color: 'Preto', size: 'Ajustável', stock: 2 },
    { color: 'Branco', size: 'Ajustável', stock: 1 },
    { color: 'Azul', size: 'Ajustável', stock: 0 }
  ], status: 'published', createdAt: '2026-10-01'
};
const other = { ...cap, id: 'other', name: 'Boné Preto', brand: 'Marca B', capType: 'Trucker', price: 89.9, stock: 1, sizes: [], color: 'Preto', capVariants: [{ color: 'Preto', size: '', stock: 1 }], createdAt: '2026-10-10' };

test('filtros de bonés combinam marca, modelo, cor, busca, preço e disponibilidade', () => {
  const products = [cap, other, { ...cap, id: 'draft', status: 'draft' }];
  const ids = query => filterCaps(products, query).map(product => product.id);
  assert.deepEqual(ids(''), ['other', 'cap']);
  assert.deepEqual(ids('marca=Marca%20A&tipo=Aba%20Curva&cor=Branco&q=AJUSTAVEL&min=100&max=120&disponivel=1'), ['cap']);
  assert.deepEqual(ids('tipo=Trucker&marca=Marca%20B'), ['other']);
  assert.deepEqual(ids('cor=Azul'), ['cap']);
  assert.deepEqual(ids('cor=Azul&disponivel=1'), []);
  assert.deepEqual(ids('ordem=price-desc'), ['cap', 'other']);
  assert.deepEqual(capColors(cap), ['Preto', 'Branco', 'Azul']);
});

test('checkout de bonés respeita estoque por cor e ajuste e envia a variação ao WhatsApp', () => {
  const catalog = { settings: { whatsapp: '5571992417737' }, products: [cap, other] };
  const customer = { name: 'Ana Lima', city: 'Salvador', postalCode: '40000000' };
  const quote = prepareCheckout({ customer, items: [
    { productId: 'cap', color: 'Preto', size: 'Ajustável', quantity: 2 },
    { productId: 'cap', color: 'Branco', size: 'Ajustável', quantity: 1 }
  ] }, catalog);
  assert.equal(quote.subtotal, 359.7);
  assert.match(decodeURIComponent(quote.whatsappUrl), /cor Branco/);
  assert.match(decodeURIComponent(quote.whatsappUrl), /tamanho\/ajuste Ajustável/);
  assert.equal(capVariantStock(cap, 'Azul', 'Ajustável'), 0);
  assert.throws(() => prepareCheckout({ customer, items: [{ productId: 'cap', color: 'Branco', size: 'Ajustável', quantity: 2 }] }, catalog), { status: 409 });
  assert.throws(() => prepareCheckout({ customer, items: [{ productId: 'cap', color: 'Azul', size: 'Ajustável', quantity: 1 }] }, catalog), { status: 409 });
  assert.throws(() => prepareCheckout({ customer, items: [{ productId: 'cap', color: 'Preto', size: 'G', quantity: 1 }] }, catalog), { status: 409 });
});
