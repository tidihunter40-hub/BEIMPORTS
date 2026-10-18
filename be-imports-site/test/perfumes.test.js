import test from 'node:test';
import assert from 'node:assert/strict';
import { filterPerfumes, perfumeVolumeStock, perfumesPage, perfumeDetailPage } from '../perfumes-page.js';
import { prepareCheckout } from '../checkout.js';

const perfume = {
  id: 'perfume-teste', slug: 'perfume-teste', name: 'Perfume Aurora', category: 'Perfumes',
  brand: 'Marca A', perfumeType: 'Feminino', perfumeOrigin: 'Importado',
  perfumeConcentration: 'EDP', perfumeNotes: 'Rosas e âmbar',
  description: 'Fragrância floral.', image: '/uploads/perfume.png', gallery: ['/uploads/perfume-lado.png'],
  price: 180, compareAt: 200, stock: 4, sizes: ['50 ml', '100 ml'],
  stockBySize: { '50 ml': 1, '100 ml': 3 }, status: 'published', createdAt: '2026-10-01'
};
const other = { ...perfume, id: 'outro', slug: 'outro', name: 'Perfume Outro', brand: 'Marca B', perfumeType: '', perfumeOrigin: '', perfumeCollection: 'Outros', price: 90, stock: 0, sizes: ['30 ml'], stockBySize: { '30 ml': 0 }, createdAt: '2026-10-10' };

test('Perfumes usa categorias e filtros cadastrados e ordena por menor preço', () => {
  const all = [perfume, other];
  const names = query => filterPerfumes(all, new URLSearchParams(query)).map(item => item.name);
  assert.deepEqual(names(''), ['Perfume Outro', 'Perfume Aurora']);
  assert.deepEqual(names('marca=Marca+A&tipo=Feminino&origem=Importado&volume=50+ml&q=aurora&min=100&max=200&disponivel=1'), ['Perfume Aurora']);
  assert.deepEqual(names('grupo=outros'), ['Perfume Outro']);
  assert.deepEqual(names('ordem=price-desc'), ['Perfume Aurora', 'Perfume Outro']);
  const page = perfumesPage(all, new URLSearchParams(), '');
  assert.match(page, /data-perfume-group="tipo:Feminino"/);
  assert.match(page, /data-perfume-group="outros"/);
  assert.doesNotMatch(page, /data-perfume-group="tipo:Masculino"/);
  assert.match(page, /href="#catalogo-perfumes"/);
  assert.match(perfumeDetailPage(perfume, 0, ''), /name="size"/);
  assert.equal(perfumeVolumeStock(perfume, '50 ml'), 1);
});

test('checkout de perfume respeita estoque por volume e informa volume e CEP no WhatsApp', () => {
  const catalog = { settings: { whatsapp: '5571992417737' }, products: [perfume] };
  const customer = { name: 'Ana Lima', city: 'Salvador', postalCode: '40000000' };
  const quote = prepareCheckout({ customer, items: [{ productId: perfume.id, size: '50 ml', quantity: 1 }] }, catalog);
  assert.equal(quote.subtotal, 180);
  assert.equal(quote.shipping.label, 'Frete a combinar');
  assert.match(decodeURIComponent(quote.whatsappUrl), /volume 50 ml/);
  assert.match(decodeURIComponent(quote.whatsappUrl), /CEP: 40000-000/);
  assert.throws(() => prepareCheckout({ customer, items: [{ productId: perfume.id, size: '50 ml', quantity: 2 }] }, catalog), { status: 409 });
  assert.throws(() => prepareCheckout({ customer, items: [{ productId: perfume.id, size: '75 ml', quantity: 1 }] }, catalog), { status: 409 });
});
