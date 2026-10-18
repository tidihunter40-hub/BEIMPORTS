import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.document = { addEventListener() {} };
const { activeOffers, filterOffers, offerDiscount, offerCard } = await import('../ofertas-page.js');

const product = (name, changes = {}) => ({ id: name, slug: name.toLowerCase(), name, category: 'Camisas', brand: 'Marca', price: 80, compareAt: 100, stock: 3, sizes: ['M'], status: 'published', image: '/assets/example.png', createdAt: '2026-01-01T00:00:00.000Z', ...changes });

test('Ofertas mostra apenas descontos válidos, publicados e dentro do período', () => {
  const items = [
    product('Ativo'),
    product('Sem desconto', { compareAt: 80 }),
    product('Rascunho', { status: 'draft' }),
    product('Futuro', { promotionStart: '2026-12-01T00:00:00.000Z' }),
    product('Expirado', { promotionEnd: '2026-01-01T00:00:00.000Z' })
  ];
  assert.deepEqual(activeOffers(items, new Date('2026-10-17T12:00:00.000Z')).map(item => item.name), ['Ativo']);
  assert.equal(offerDiscount(items[0]), 20);
});

test('Filtros de Ofertas combinam categoria, busca, preço, desconto, estoque e ordenação', () => {
  const items = [
    product('Camisa Azul', { brand: 'Nike', price: 70, compareAt: 100, stock: 2 }),
    product('Camisa Branca', { brand: 'Adidas', price: 90, compareAt: 100, stock: 0 }),
    product('Tênis Azul', { category: 'Tênis', brand: 'Nike', price: 50, compareAt: 100, stock: 4 })
  ];
  const query = new URLSearchParams({ categoria: 'Camisas', q: 'nike', min: '60', max: '80', desconto: '25', disponivel: '1' });
  assert.deepEqual(filterOffers(items, query).map(item => item.name), ['Camisa Azul']);
  assert.deepEqual(filterOffers(items, new URLSearchParams({ ordem: 'discount-desc' })).map(item => item.name), ['Tênis Azul', 'Camisa Azul', 'Camisa Branca']);
});

test('Card de oferta exibe preço e desconto cadastrados sem habilitar compra demonstrativa', () => {
  const html = offerCard(product('Camisa Exemplo', { description: '[DEMO] Apenas prévia', stock: 0 }));
  assert.match(html, /−20%/);
  assert.match(html, /R\$\s*80,00/);
  assert.match(html, /R\$\s*100,00/);
  assert.match(html, /PRODUTO DEMONSTRATIVO/);
  assert.match(html, /Prévia sem estoque para compra/);
  assert.match(html, /VER DETALHES/);
  assert.doesNotMatch(html, /Adicionar à sacola/);
});
