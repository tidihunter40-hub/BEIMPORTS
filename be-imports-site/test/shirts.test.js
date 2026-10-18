import test from 'node:test';
import assert from 'node:assert/strict';
import { filterShirts, shirtSizeStock, shirtUnitPrice } from '../catalog-filter.js';
import { prepareCheckout } from '../checkout.js';

const base = {
  id: 'real', name: 'Real Madrid Tailandesa', category: 'Camisas', subcategory: 'Tailandesas',
  color: 'Preta', pricingRule: 'thai', price: 140, stock: 4,
  sizes: ['P', 'M', 'G'], stockBySize: { P: 1, M: 2, G: 1 }, status: 'published', createdAt: '2026-10-01'
};
const other = {
  id: 'flamengo', name: 'Flamengo Torcedor', category: 'Camisas', subcategory: 'Times',
  color: 'Vermelha', price: 79.9, stock: 2, sizes: ['G3'], stockBySize: { G3: 2 },
  status: 'published', createdAt: '2026-09-01'
};

test('filtros de camisas combinam subcategoria, busca, tamanho, cor, preço e estoque', () => {
  const products = [base, other, { ...other, id: 'rascunho', status: 'draft' }, { ...other, id: 'bone', category: 'Bonés' }];
  const ids = query => filterShirts(products, query).map(product => product.id);
  assert.deepEqual(ids(''), ['flamengo', 'real']);
  assert.deepEqual(ids('sub=Tailandesas&q=madrid&tamanho=M&cor=Preta&min=100&max=150&disponivel=1'), ['real']);
  assert.deepEqual(ids('tamanho=G3'), ['flamengo']);
  assert.deepEqual(ids('tamanho=GG'), []);
  assert.deepEqual(ids('ordem=price-desc'), ['real', 'flamengo']);
  assert.equal(shirtSizeStock(base, 'P'), 1);
  assert.equal(shirtSizeStock(base, 'GG'), 0);
  assert.equal(shirtSizeStock({ ...base, stockBySize: {} }, 'M'), 4);
});

test('camisa tailandesa usa cada faixa aprovada e respeita estoque por tamanho no checkout', () => {
  for (const [quantity, unit] of [[1, 140], [2, 125], [3, 105], [4, 90], [5, 70]]) assert.equal(shirtUnitPrice(base, quantity), unit);
  assert.equal(shirtUnitPrice(base, 6), null);
  const catalog = { settings: { whatsapp: '5575999999999' }, products: [{ ...base, stock: 5, stockBySize: { P: 1, M: 3, G: 1 } }, other] };
  const customer = { name: 'Ana Lima', city: 'Salvador' };
  const quote = prepareCheckout({ customer, items: [
    { productId: 'real', size: 'M', quantity: 3 },
    { productId: 'real', size: 'G', quantity: 1 },
    { productId: 'flamengo', size: 'G3', quantity: 1 }
  ] }, catalog);
  assert.equal(quote.subtotal, 439.9);
  assert.equal(quote.items[0].unitPrice, 90);
  assert.equal(quote.items[1].unitPrice, 90);
  assert.equal(quote.items[2].unitPrice, 79.9);
  assert.match(decodeURIComponent(quote.whatsappUrl), /3 × R\$\s90,00/);
  assert.throws(() => prepareCheckout({ customer, items: [{ productId: 'real', size: 'P', quantity: 2 }] }, catalog), { status: 409 });
  const stockedForSix = { ...catalog, products: [{ ...catalog.products[0], stock: 6, stockBySize: { P: 1, M: 4, G: 1 } }, other] };
  assert.throws(() => prepareCheckout({ customer, items: [
    { productId: 'real', size: 'M', quantity: 4 }, { productId: 'real', size: 'G', quantity: 1 },
    { productId: 'real', size: 'P', quantity: 1 }
  ] }, stockedForSix), { status: 409 });
});
