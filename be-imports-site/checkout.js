import { isThaiShirt, shirtUnitPrice, shirtSizeStock, shoeSizeStock, capVariantStock, bermudaVariantStock } from './catalog-filter.js';

const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const isElectronic = product => ['Eletrônicos', 'Fones de ouvido'].includes(product?.category);

export function prepareCheckout(payload, catalog) {
  const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
  const number = String(catalog.settings?.whatsapp || '');
  if (!/^\d{12,13}$/.test(number)) fail(503, 'O WhatsApp comercial ainda não foi configurado.');
  if (!Array.isArray(payload?.items) || !payload.items.length || payload.items.length > 50) fail(400, 'O carrinho está vazio ou inválido.');
  const customer = payload.customer || {};
  const name = String(customer.name || '').trim().slice(0, 100);
  const city = String(customer.city || '').trim().slice(0, 100);
  const postalCode = String(customer.postalCode || '').replace(/\D/g, '');
  const note = String(customer.note || '').trim().slice(0, 300);
  if (name.length < 2 || city.length < 2) fail(400, 'Informe seu nome e sua cidade.');
  if (postalCode && !/^\d{8}$/.test(postalCode)) fail(400, 'Informe um CEP com 8 números ou deixe o campo vazio.');
  const used = new Set();
  const counts = new Map();
  const sizeCounts = new Map();
  const items = payload.items.map(raw => {
    if (!raw || typeof raw !== 'object') fail(400, 'Confira os itens do carrinho.');
    const id = String(raw.productId || '');
    const size = String(raw.size || '').trim();
    const color = String(raw.color || '').trim();
    const quantity = Number(raw.quantity);
    const key = `${id}\u0000${size}\u0000${color}`;
    if (used.has(key) || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99) fail(400, 'Confira as quantidades e variações do carrinho.');
    used.add(key);
    const product = catalog.products.find(p => p.id === id && p.status === 'published');
    if (!product) fail(409, 'Um produto não está mais disponível. Atualize o carrinho.');
    if (!['Bonés', 'Bermudas'].includes(product.category) && product.sizes?.length && !product.sizes.includes(size)) fail(409, `Selecione um tamanho válido para ${product.name}.`);
    if (!['Bonés', 'Bermudas'].includes(product.category) && !product.sizes?.length && size) fail(400, `O produto ${product.name} não possui tamanho.`);
    if (!['Bonés', 'Bermudas'].includes(product.category) && !isElectronic(product) && color) fail(400, `O produto ${product.name} não possui variação de cor.`);
    counts.set(id, (counts.get(id) || 0) + quantity);
    if (counts.get(id) > product.stock) fail(409, `O estoque de ${product.name} mudou. Atualize o carrinho.`);
    if (product.category === 'Camisas') {
      sizeCounts.set(key, (sizeCounts.get(key) || 0) + quantity);
      if (!size || sizeCounts.get(key) > shirtSizeStock(product, size)) fail(409, `O tamanho ${size || 'selecionado'} de ${product.name} não possui estoque suficiente.`);
    }
    if (product.category === 'Tênis') {
      sizeCounts.set(key, (sizeCounts.get(key) || 0) + quantity);
      if (!size || sizeCounts.get(key) > shoeSizeStock(product, size)) fail(409, `A numeração ${size || 'selecionada'} de ${product.name} não possui estoque suficiente.`);
    }
    if (product.category === 'Bonés') {
      sizeCounts.set(key, (sizeCounts.get(key) || 0) + quantity);
      if (sizeCounts.get(key) > capVariantStock(product, color, size)) fail(409, `A variação selecionada de ${product.name} não possui estoque suficiente.`);
    }
    if (product.category === 'Bermudas') {
      sizeCounts.set(key, (sizeCounts.get(key) || 0) + quantity);
      if (!size || sizeCounts.get(key) > bermudaVariantStock(product, color, size)) fail(409, `A variação selecionada de ${product.name} não possui estoque suficiente.`);
    }
    if (product.category === 'Perfumes' && product.sizes?.length) {
      sizeCounts.set(key, (sizeCounts.get(key) || 0) + quantity);
      if (!size || sizeCounts.get(key) > Number(product.stockBySize?.[size] || 0)) fail(409, `O volume ${size || 'selecionado'} de ${product.name} não possui estoque suficiente.`);
    }
    if (isElectronic(product)) {
      const variants = product.electronicsVariants || [];
      const available = variants.length ? Number(variants.find(item => item.color === color)?.stock || 0) : color ? 0 : product.stock;
      sizeCounts.set(key, (sizeCounts.get(key) || 0) + quantity);
      if ((variants.length && !color) || size || sizeCounts.get(key) > available) fail(409, `A variação de ${product.name} não possui estoque suficiente.`);
    }
    return { productId: id, name: product.name, size, color, quantity, unitPrice: product.price, total: 0 };
  });
  for (const item of items) {
    const product = catalog.products.find(p => p.id === item.productId);
    const unit = shirtUnitPrice(product, counts.get(item.productId));
    if (unit == null && isThaiShirt(product)) fail(409, `A tabela aprovada de ${product.name} cobre de 1 a 5 unidades.`);
    item.unitPrice = unit;
    item.total = Math.round(unit * item.quantity * 100) / 100;
  }
  const subtotal = Math.round(items.reduce((sum, item) => sum + item.total, 0) * 100) / 100;
  const lines = items.map((item, index) => `${index + 1}. ${item.name}${item.color ? ` — cor ${item.color}` : ''}${item.size ? ` — ${catalog.products.find(product => product.id === item.productId)?.category === 'Bonés' ? 'tamanho/ajuste' : catalog.products.find(product => product.id === item.productId)?.category === 'Perfumes' ? 'volume' : 'tamanho'} ${item.size}` : ''}\n${item.quantity} × ${money(item.unitPrice)} = ${money(item.total)}`).join('\n\n');
  const message = `Olá, BE IMPORTS! Gostaria de confirmar este pedido:\n\n${lines}\n\nSubtotal dos produtos: ${money(subtotal)}\nFrete e total final: a combinar\n\nCliente: ${name}\nCidade: ${city}${postalCode ? `\nCEP: ${postalCode.slice(0, 5)}-${postalCode.slice(5)}` : ''}${note ? `\nObservação: ${note}` : ''}\n\nAguardo a confirmação de disponibilidade, entrega e pagamento.`;
  return { items, subtotal, shipping: { status: 'pending', label: 'Frete a combinar' }, total: null, whatsappUrl: `https://wa.me/${number}?text=${encodeURIComponent(message)}` };
}
