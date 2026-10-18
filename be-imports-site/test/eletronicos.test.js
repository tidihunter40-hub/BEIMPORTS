import test from 'node:test';
import assert from 'node:assert/strict';
import { electronicType, electronicVariantStock, filterElectronics, electronicsPage, electronicDetailPage } from '../eletronicos-page.js';
import { prepareCheckout } from '../checkout.js';

const watch = { id: 'watch', slug: 'watch', name: 'Relógio Solar', category: 'Eletrônicos', electronicsType: 'Smartwatches', brand: 'Marca A', electronicsModel: 'Solar', electronicsSpecs: 'Bateria: 7 dias', electronicsVariants: [{ color: 'Preto', stock: 2 }, { color: 'Prata', stock: 1 }, { color: 'Dourado', stock: 0 }], description: 'Relógio conectado.', image: '/uploads/watch.png', gallery: ['/uploads/watch-side.png'], price: 229.9, compareAt: 279.9, stock: 3, sizes: [], status: 'published', createdAt: '2026-10-01' };
const headphones = { ...watch, id: 'fone', slug: 'fone', name: 'Fone Bluetooth', category: 'Fones de ouvido', electronicsType: '', brand: 'Marca B', electronicsModel: 'TWS', electronicsVariants: [], price: 99.9, stock: 1, createdAt: '2026-10-10' };

test('Eletrônicos mostra apenas tipos cadastrados e combina filtros com menor preço padrão', () => {
  const all = [watch, headphones];
  const names = query => filterElectronics(all, new URLSearchParams(query)).map(item => item.name);
  assert.deepEqual(names(''), ['Fone Bluetooth', 'Relógio Solar']);
  assert.deepEqual(names('tipo=Smartwatches&marca=Marca+A&q=solar&min=200&max=300&disponivel=1'), ['Relógio Solar']);
  assert.deepEqual(names('ordem=price-desc'), ['Relógio Solar', 'Fone Bluetooth']);
  assert.equal(electronicType(headphones), 'Fones de Ouvido');
  assert.equal(electronicVariantStock(watch, 'Dourado'), 0);
  const html = electronicsPage(all, new URLSearchParams(), '');
  assert.match(html, /data-electronic-type="Smartwatches"/);
  assert.match(html, /data-electronic-type="Fones de Ouvido"/);
  assert.doesNotMatch(html, /data-electronic-type="Drones"/);
  assert.match(html, /href="#catalogo-eletronicos"/);
  assert.match(electronicDetailPage(watch, 0, ''), /name="color"/);
});

test('sacola de eletrônicos limita cada variação e descreve cor e CEP no WhatsApp', () => {
  const catalog = { settings: { whatsapp: '5571992417737' }, products: [watch] };
  const customer = { name: 'Ana Lima', city: 'Salvador', postalCode: '40000000' };
  const quote = prepareCheckout({ customer, items: [{ productId: watch.id, color: 'Prata', size: '', quantity: 1 }] }, catalog);
  assert.equal(quote.subtotal, 229.9);
  assert.equal(quote.shipping.label, 'Frete a combinar');
  assert.match(decodeURIComponent(quote.whatsappUrl), /cor Prata/);
  assert.match(decodeURIComponent(quote.whatsappUrl), /CEP: 40000-000/);
  assert.throws(() => prepareCheckout({ customer, items: [{ productId: watch.id, color: 'Prata', size: '', quantity: 2 }] }, catalog), { status: 409 });
  assert.throws(() => prepareCheckout({ customer, items: [{ productId: watch.id, color: 'Dourado', size: '', quantity: 1 }] }, catalog), { status: 409 });
});
