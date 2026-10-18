export function filterProducts(products, searchParams) {
  const query = searchParams instanceof URLSearchParams ? searchParams : new URLSearchParams(searchParams);
  const category = query.get('categoria') || '';
  const search = (query.get('q') || '').trim().toLocaleLowerCase('pt-BR');
  const min = Number(query.get('min') || 0);
  const max = query.get('max') ? Number(query.get('max')) : Infinity;
  const order = query.get('ordem') || 'price-asc';
  return products.filter(product =>
    (!category || product.category === category) &&
    (!search || product.name.toLocaleLowerCase('pt-BR').includes(search)) &&
    product.price >= min && product.price <= max &&
    (query.get('disponivel') !== '1' || product.stock > 0)
  ).sort((a, b) => {
    if (order === 'price-desc') return b.price - a.price;
    if (order === 'recent') return Date.parse(b.createdAt) - Date.parse(a.createdAt);
    if (order === 'name') return a.name.localeCompare(b.name, 'pt-BR');
    return a.price - b.price;
  });
}

export const THAI_SHIRT_PRICES = Object.freeze({ 1: 140, 2: 125, 3: 105, 4: 90, 5: 70 });

export const isThaiShirt = product => product?.category === 'Camisas' && product.pricingRule === 'thai';

export function shirtUnitPrice(product, quantity = 1) {
  if (!isThaiShirt(product)) return Number(product.price);
  return THAI_SHIRT_PRICES[quantity] ?? null;
}

export function shirtSizeStock(product, size) {
  const amount = product?.stockBySize?.[size];
  if (Number.isSafeInteger(amount) && amount >= 0) return amount;
  // Camisas cadastradas antes do estoque por tamanho continuam usando o estoque total.
  if (!Object.keys(product?.stockBySize || {}).length && product?.sizes?.includes(size)) return product.stock || 0;
  return 0;
}

export function filterShirts(products, searchParams) {
  const query = searchParams instanceof URLSearchParams ? searchParams : new URLSearchParams(searchParams);
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  const search = normalize(query.get('q')).trim();
  const subcategory = query.get('sub') || '';
  const size = query.get('tamanho') || '';
  const color = query.get('cor') || '';
  const min = query.get('min') ? Number(query.get('min')) : 0;
  const max = query.get('max') ? Number(query.get('max')) : Infinity;
  const order = query.get('ordem') || 'price-asc';
  return products.filter(product => {
    if (product.category !== 'Camisas' || product.status !== 'published') return false;
    const available = (product.sizes || []).some(item => shirtSizeStock(product, item) > 0);
    const price = shirtUnitPrice(product);
    return (!subcategory || product.subcategory === subcategory) &&
      (!search || normalize(`${product.name} ${product.description || ''} ${product.subcategory || ''}`).includes(search)) &&
      (!size || shirtSizeStock(product, size) > 0 || (String(product.description || '').startsWith('[DEMO]') && product.sizes?.includes(size))) &&
      (!color || product.color === color) &&
      price >= min && price <= max &&
      (query.get('disponivel') !== '1' || available);
  }).sort((a, b) => {
    if (order === 'price-desc') return shirtUnitPrice(b) - shirtUnitPrice(a);
    if (order === 'recent') return Date.parse(b.createdAt) - Date.parse(a.createdAt);
    if (order === 'name') return a.name.localeCompare(b.name, 'pt-BR');
    return shirtUnitPrice(a) - shirtUnitPrice(b);
  });
}

export function shoeSizeStock(product, size) {
  const amount = product?.stockBySize?.[size];
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : 0;
}

export function filterShoes(products, searchParams) {
  const query = searchParams instanceof URLSearchParams ? searchParams : new URLSearchParams(searchParams);
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  const search = normalize(query.get('q')).trim();
  const brand = query.get('marca') || '';
  const type = query.get('tipo') || '';
  const size = query.get('numero') || '';
  const min = query.get('min') ? Number(query.get('min')) : 0;
  const max = query.get('max') ? Number(query.get('max')) : Infinity;
  const order = query.get('ordem') || 'price-asc';
  return products.filter(product => {
    if (product.category !== 'Tênis' || product.status !== 'published') return false;
    return (!brand || (product.brand || 'Outros') === brand) &&
      (!type || product.shoeType === type) &&
      (!search || normalize(`${product.name} ${product.brand || ''} ${product.shoeType || ''}`).includes(search)) &&
      (!size || shoeSizeStock(product, size) > 0) &&
      product.price >= min && product.price <= max;
  }).sort((a, b) => {
    if (order === 'price-desc') return b.price - a.price;
    if (order === 'recent') return Date.parse(b.createdAt) - Date.parse(a.createdAt);
    if (order === 'name') return a.name.localeCompare(b.name, 'pt-BR');
    return a.price - b.price;
  });
}

export function capVariantStock(product, color = '', size = '') {
  const variants = product?.capVariants || [];
  if (variants.length) return variants.find(item => item.color === color && item.size === size)?.stock || 0;
  if (color !== (product?.color || '')) return 0;
  if (product?.sizes?.length ? !product.sizes.includes(size) : Boolean(size)) return 0;
  return Number.isSafeInteger(product?.stock) ? product.stock : 0;
}

export function capColors(product) {
  return [...new Set(product?.capVariants?.length ? product.capVariants.map(item => item.color).filter(Boolean) : product?.color ? [product.color] : [])];
}

export function capSizes(product, color = '') {
  return [...new Set(product?.capVariants?.length ? product.capVariants.filter(item => item.color === color).map(item => item.size).filter(Boolean) : product?.sizes || [])];
}

export function filterCaps(products, searchParams) {
  const query = searchParams instanceof URLSearchParams ? searchParams : new URLSearchParams(searchParams);
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  const search = normalize(query.get('q')).trim();
  const brand = query.get('marca') || '';
  const type = query.get('tipo') || '';
  const color = query.get('cor') || '';
  const min = query.get('min') ? Number(query.get('min')) : 0;
  const max = query.get('max') ? Number(query.get('max')) : Infinity;
  const order = query.get('ordem') || 'price-asc';
  return products.filter(product => {
    if (product.category !== 'Bonés' || product.status !== 'published') return false;
    return (!brand || (product.brand || 'Outros') === brand) &&
      (!type || product.capType === type) &&
      (!color || capColors(product).includes(color)) &&
      (!search || normalize(`${product.name} ${product.brand || ''} ${product.capType || ''}`).includes(search)) &&
      product.price >= min && product.price <= max &&
      (query.get('disponivel') !== '1' || (color ? (product.capVariants?.length ? product.capVariants.some(item => item.color === color && item.stock > 0) : product.stock > 0) : product.stock > 0));
  }).sort((a, b) => {
    if (order === 'price-desc') return b.price - a.price;
    if (order === 'recent') return Date.parse(b.createdAt) - Date.parse(a.createdAt);
    if (order === 'name') return a.name.localeCompare(b.name, 'pt-BR');
    return a.price - b.price;
  });
}

export function bermudaVariantStock(product, color = '', size = '') {
  const variants = product?.bermudaVariants || [];
  if (variants.length) return variants.find(item => item.color === color && item.size === size)?.stock || 0;
  if (color !== (product?.color || '')) return 0;
  if (product?.sizes?.length ? !product.sizes.includes(size) : Boolean(size)) return 0;
  return Number.isSafeInteger(product?.stock) ? product.stock : 0;
}

export function bermudaColors(product) {
  return [...new Set(product?.bermudaVariants?.length ? product.bermudaVariants.map(item => item.color).filter(Boolean) : product?.color ? [product.color] : [])];
}

export function bermudaSizes(product) {
  return [...new Set(product?.bermudaVariants?.length ? product.bermudaVariants.map(item => item.size).filter(Boolean) : product?.sizes || [])];
}

export function filterBermudas(products, searchParams) {
  const query = searchParams instanceof URLSearchParams ? searchParams : new URLSearchParams(searchParams);
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  const search = normalize(query.get('q')).trim();
  const type = query.get('tipo') || '';
  const size = query.get('tamanho') || '';
  const color = query.get('cor') || '';
  const min = query.get('min') ? Number(query.get('min')) : 0;
  const max = query.get('max') ? Number(query.get('max')) : Infinity;
  const order = query.get('ordem') || 'price-asc';
  return products.filter(product => {
    if (product.category !== 'Bermudas' || product.status !== 'published') return false;
    const matchingVariant = product.bermudaVariants?.length
      ? product.bermudaVariants.some(item => (!size || item.size === size) && (!color || item.color === color))
      : (!size || bermudaSizes(product).includes(size)) && (!color || bermudaColors(product).includes(color));
    const variantAvailable = product.bermudaVariants?.length
      ? product.bermudaVariants.some(item => (!size || item.size === size) && (!color || item.color === color) && item.stock > 0)
      : product.stock > 0;
    return (!type || (product.bermudaType || 'Outros') === type) &&
      (!search || normalize(`${product.name} ${product.brand || ''} ${product.bermudaType || ''} ${product.fabric || ''}`).includes(search)) &&
      matchingVariant &&
      product.price >= min && product.price <= max &&
      (query.get('disponivel') !== '1' || variantAvailable);
  }).sort((a, b) => {
    if (order === 'price-desc') return b.price - a.price;
    if (order === 'recent') return Date.parse(b.createdAt) - Date.parse(a.createdAt);
    if (order === 'name') return a.name.localeCompare(b.name, 'pt-BR');
    return a.price - b.price;
  });
}
