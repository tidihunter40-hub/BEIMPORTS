import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHmac, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { prepareCheckout } from './checkout.js';
import { parseSpreadsheet } from './admin-import.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const localFile = path.join(process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(root, 'data'), 'catalog.json');
const exampleFile = path.join(root, 'data', 'catalog.example.json');
const uploadDir = path.join(process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : root, 'uploads');
const hosted = process.env.VERCEL === '1';
const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
const secret = process.env.SUPABASE_SECRET_KEY;
const bucket = 'be-imports-products';
const photoBase = supabaseUrl ? `${supabaseUrl}/storage/v1/object/public/${bucket}/` : '';
const initialCategories = ['Camisas', 'Bermudas', 'Bonés', 'Perfumes', 'Fones de ouvido', 'Roupas', 'Acessórios'];
const hash = process.env.ADMIN_PASSWORD_HASH || '';
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon' };

if (hosted && (!supabaseUrl || !secret || !hash)) throw new Error('Configure SUPABASE_URL, SUPABASE_SECRET_KEY e ADMIN_PASSWORD_HASH na Vercel.');
if (supabaseUrl && !/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl)) throw new Error('SUPABASE_URL inválida.');
if (Boolean(supabaseUrl) !== Boolean(secret)) throw new Error('Configure as duas variáveis do Supabase.');

function json(res, status, value, extra = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra });
  res.end(JSON.stringify(value));
}
function fail(status, message) { return Object.assign(new Error(message), { status }); }
async function body(req, max = 7_000_000) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw fail(415, 'Envie JSON.');
  let size = 0, chunks = [];
  for await (const chunk of req) { size += chunk.length; if (size > max) throw fail(413, 'Arquivo ou solicitação grande demais.'); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw fail(400, 'JSON inválido.'); }
}
function checkOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return;
  const expected = process.env.PUBLIC_SITE_URL || `https://${req.headers.host}`;
  if (new URL(origin).origin !== new URL(expected).origin && new URL(origin).origin !== `http://${req.headers.host}`) throw fail(403, 'Origem não permitida.');
}
async function supa(route, options = {}) {
  let res;
  try { res = await fetch(`${supabaseUrl}${route}`, { ...options, headers: { apikey: secret, ...options.headers }, signal: AbortSignal.timeout(15000) }); }
  catch { throw fail(503, 'Não foi possível conectar ao banco de dados.'); }
  if (!res.ok) throw fail(503, `Banco de dados recusou a operação (${res.status}).`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}
async function readCatalog() {
  if (!supabaseUrl) return withCategories(JSON.parse(fs.readFileSync(fs.existsSync(localFile) ? localFile : exampleFile, 'utf8')));
  const rows = await supa('/rest/v1/be_imports_catalog?id=eq.1&select=document,updated_at');
  return withCategories(rows[0] ? { ...rows[0].document, revision: rows[0].updated_at } : JSON.parse(fs.readFileSync(exampleFile, 'utf8')));
}
function withCategories(catalog) {
  if (Array.isArray(catalog.categories)) return { ...catalog, shirtSubcategories: Array.isArray(catalog.shirtSubcategories) ? catalog.shirtSubcategories : [], subcategories: Array.isArray(catalog.subcategories) ? catalog.subcategories : [], media: Array.isArray(catalog.media) ? catalog.media : [] };
  const names = [...initialCategories];
  for (const product of catalog.products || []) if (product.category && !names.some(name => name.toLocaleLowerCase('pt-BR') === product.category.toLocaleLowerCase('pt-BR'))) names.push(product.category);
  return { ...catalog, categories: names.map(name => ({ name, image: '' })), shirtSubcategories: Array.isArray(catalog.shirtSubcategories) ? catalog.shirtSubcategories : [], subcategories: [], media: [] };
}
async function writeCatalog(next, expectedRevision) {
  if (!supabaseUrl) {
    const old = await readCatalog();
    if (String(old.revision) !== String(expectedRevision)) throw fail(409, 'O catálogo mudou. Recarregue o painel.');
    next.revision = Number(old.revision || 0) + 1;
    fs.mkdirSync(path.dirname(localFile), { recursive: true });
    const temp = `${localFile}.${randomUUID()}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(next, null, 2));
    fs.renameSync(temp, localFile);
    return next;
  }
  const update = { document: { settings: next.settings, categories: next.categories, shirtSubcategories: next.shirtSubcategories, subcategories: next.subcategories, media: next.media, products: next.products }, updated_at: new Date().toISOString() };
  if (expectedRevision && expectedRevision !== '0') {
    const filter = new URLSearchParams({ id: 'eq.1', updated_at: `eq.${expectedRevision}` });
    const rows = await supa(`/rest/v1/be_imports_catalog?${filter}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(update) });
    if (!rows.length) throw fail(409, 'O catálogo mudou. Recarregue o painel.');
  } else {
    const existing = await supa('/rest/v1/be_imports_catalog?id=eq.1&select=id');
    if (existing.length) throw fail(409, 'O catálogo mudou. Recarregue o painel.');
    await supa('/rest/v1/be_imports_catalog', { method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ id: 1, ...update }) });
  }
  return { ...next, revision: update.updated_at };
}
function validPhone(value) { return !value || /^\d{12,13}$/.test(value); }
function validImage(value) { return /^\/uploads\/[a-f0-9-]+\.(png|jpg|webp)$/.test(value) || Boolean(photoBase && value.startsWith(photoBase) && /^[a-f0-9-]+\.(png|jpg|webp)$/.test(value.slice(photoBase.length))); }
function cleanCatalog(input) {
  if (!input || !Array.isArray(input.products) || input.products.length > 2000 || !input.settings || typeof input.settings !== 'object') throw fail(400, 'Catálogo inválido.');
  if (!Array.isArray(input.categories) || input.categories.length > 200) throw fail(400, 'Categorias inválidas.');
  const settings = {
    instagram: String(input.settings.instagram || '').trim(),
    whatsapp: String(input.settings.whatsapp || '').replace(/\D/g, ''),
    address: String(input.settings.address || '').trim().slice(0, 250),
    hours: String(input.settings.hours || '').trim().slice(0, 250),
    defaultCategory: String(input.settings.defaultCategory || '').trim().slice(0, 60),
    defaultStock: input.settings.defaultStock == null ? 0 : Number(input.settings.defaultStock),
    defaultStatus: input.settings.defaultStatus === 'published' ? 'published' : 'draft'
  };
  if (!Number.isSafeInteger(settings.defaultStock) || settings.defaultStock < 0 || settings.defaultStock > 999999) throw fail(400, 'Estoque padrão inválido.');
  if (settings.instagram && !/^https:\/\/www\.instagram\.com\/[a-zA-Z0-9._]+\/?$/.test(settings.instagram)) throw fail(400, 'Instagram inválido.');
  if (!validPhone(settings.whatsapp)) throw fail(400, 'WhatsApp deve ter DDI, DDD e número.');
  if (input.shirtSubcategories != null && (!Array.isArray(input.shirtSubcategories) || input.shirtSubcategories.length > 30)) throw fail(400, 'Subcategorias de camisas inválidas.');
  const shirtNames = new Set();
  const shirtSubcategories = (input.shirtSubcategories || []).map(raw => {
    const name = String(raw.name || '').trim().slice(0, 60);
    const image = String(raw.image || '').trim();
    const key = name.toLocaleLowerCase('pt-BR');
    if (!name || shirtNames.has(key) || (image && !validImage(image))) throw fail(400, 'Subcategoria de camisas duplicada ou imagem inválida.');
    shirtNames.add(key);
    return { name, image };
  });
  const ids = new Set(), slugs = new Set(), skus = new Set();
  const products = input.products.map(raw => {
    const p = {
      id: String(raw.id || randomUUID()), slug: String(raw.slug || '').trim().toLowerCase(),
      sku: String(raw.sku || '').trim().toUpperCase(),
      name: String(raw.name || '').trim().slice(0, 140), category: String(raw.category || '').trim().slice(0, 60),
      description: String(raw.description || '').trim().slice(0, 3000), image: String(raw.image || '').trim(),
      gallery: Array.isArray(raw.gallery) ? raw.gallery.map(value => String(value || '').trim()).filter(Boolean) : [],
      videoUrl: String(raw.videoUrl || '').trim(),
      price: Number(raw.price), compareAt: raw.compareAt === '' || raw.compareAt == null ? null : Number(raw.compareAt),
      stock: Number(raw.stock), sizes: Array.isArray(raw.sizes) ? raw.sizes.map(x => String(x).trim().slice(0, 20)).filter(Boolean).slice(0, 30) : [],
      subcategory: String(raw.subcategory || '').trim().slice(0, 60), color: String(raw.color || '').trim().slice(0, 40),
      brand: String(raw.brand || '').trim().slice(0, 40), shoeType: String(raw.shoeType || '').trim().slice(0, 30),
      perfumeType: String(raw.perfumeType || '').trim().slice(0, 30), perfumeOrigin: String(raw.perfumeOrigin || '').trim().slice(0, 30),
      perfumeCollection: String(raw.perfumeCollection || '').trim().slice(0, 40), perfumeConcentration: String(raw.perfumeConcentration || '').trim().slice(0, 40),
      perfumeNotes: String(raw.perfumeNotes || '').trim().slice(0, 600),
      electronicsType: String(raw.electronicsType || '').trim().slice(0, 40), electronicsModel: String(raw.electronicsModel || '').trim().slice(0, 80),
      electronicsSpecs: String(raw.electronicsSpecs || '').trim().slice(0, 2000), electronicsVariants: [],
      capType: String(raw.capType || '').trim().slice(0, 30), capVariants: [],
      bermudaType: String(raw.bermudaType || '').trim().slice(0, 30), fabric: String(raw.fabric || '').trim().slice(0, 60), bermudaVariants: [],
      pricingRule: raw.pricingRule === 'thai' ? 'thai' : 'standard', stockBySize: {},
      status: raw.status === 'published' ? 'published' : 'draft', createdAt: String(raw.createdAt || new Date().toISOString())
    };
    if (['Camisas', 'Tênis', 'Perfumes'].includes(p.category) && raw.stockBySize && typeof raw.stockBySize === 'object' && !Array.isArray(raw.stockBySize)) {
      for (const [size, value] of Object.entries(raw.stockBySize)) {
        const amount = Number(value);
        if (!p.sizes.includes(size) || !Number.isSafeInteger(amount) || amount < 0) throw fail(400, `Estoque por tamanho inválido: ${p.name}.`);
        p.stockBySize[size] = amount;
      }
    }
    if (p.category === 'Bonés' && raw.capVariants != null) {
      if (!Array.isArray(raw.capVariants) || raw.capVariants.length > 100) throw fail(400, `Variações inválidas: ${p.name}.`);
      const variantKeys = new Set();
      p.capVariants = raw.capVariants.map(item => {
        const color = String(item?.color || '').trim().slice(0, 40);
        const size = String(item?.size || '').trim().slice(0, 20);
        const stock = Number(item?.stock);
        const key = `${color.toLocaleLowerCase('pt-BR')}\u0000${size.toLocaleLowerCase('pt-BR')}`;
        if ((!color && !size) || variantKeys.has(key) || !Number.isSafeInteger(stock) || stock < 0) throw fail(400, `Cor, ajuste ou estoque inválido: ${p.name}.`);
        variantKeys.add(key);
        return { color, size, stock };
      });
    }
    if (p.category === 'Bermudas' && raw.bermudaVariants != null) {
      if (!Array.isArray(raw.bermudaVariants) || raw.bermudaVariants.length > 100) throw fail(400, `Variações inválidas: ${p.name}.`);
      const variantKeys = new Set();
      p.bermudaVariants = raw.bermudaVariants.map(item => {
        const color = String(item?.color || '').trim().slice(0, 40);
        const size = String(item?.size || '').trim().slice(0, 20);
        const stock = Number(item?.stock);
        const key = `${color.toLocaleLowerCase('pt-BR')}\u0000${size.toLocaleLowerCase('pt-BR')}`;
        if (!size || variantKeys.has(key) || !Number.isSafeInteger(stock) || stock < 0) throw fail(400, `Cor, tamanho ou estoque inválido: ${p.name}.`);
        variantKeys.add(key);
        return { color, size, stock };
      });
    }
    if (['Eletrônicos', 'Fones de ouvido'].includes(p.category) && raw.electronicsVariants != null) {
      if (!Array.isArray(raw.electronicsVariants) || raw.electronicsVariants.length > 30) throw fail(400, `Variações inválidas: ${p.name}.`);
      const colors = new Set();
      p.electronicsVariants = raw.electronicsVariants.map(item => {
        const color = String(item?.color || '').trim().slice(0, 40);
        const stock = Number(item?.stock);
        const key = color.toLocaleLowerCase('pt-BR');
        if (!color || colors.has(key) || !Number.isSafeInteger(stock) || stock < 0) throw fail(400, `Cor ou estoque inválido: ${p.name}.`);
        colors.add(key);
        return { color, stock };
      });
    }
    if (!p.slug) p.slug = p.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (!p.sku) p.sku = `BE-${p.id.replace(/[^a-z0-9]/gi, '').slice(0, 12).toUpperCase()}`;
    if (!p.name || !p.category || !p.slug || !/^[a-z0-9-]+$/.test(p.slug) || ids.has(p.id) || slugs.has(p.slug)) throw fail(400, 'Nome, categoria ou identificador duplicado/inválido.');
    if (!/^[A-Z0-9_-]{3,40}$/.test(p.sku) || skus.has(p.sku)) throw fail(400, `SKU duplicado ou inválido: ${p.name}.`);
    if (!Number.isFinite(p.price) || p.price <= 0 || (p.compareAt != null && (!Number.isFinite(p.compareAt) || p.compareAt <= p.price))) throw fail(400, `Preço inválido: ${p.name}.`);
    if (!Number.isSafeInteger(p.stock) || p.stock < 0) throw fail(400, `Estoque inválido: ${p.name}.`);
    if (p.category === 'Camisas') {
      if (p.subcategory && !shirtNames.has(p.subcategory.toLocaleLowerCase('pt-BR'))) throw fail(400, `Cadastre a subcategoria de ${p.name} antes de salvar.`);
      if (Object.keys(p.stockBySize).length && (Object.keys(p.stockBySize).length !== p.sizes.length || Object.values(p.stockBySize).reduce((sum, value) => sum + value, 0) !== p.stock)) throw fail(400, `O estoque total de ${p.name} deve ser a soma dos tamanhos.`);
      delete p.brand; delete p.shoeType; delete p.capType; delete p.capVariants; delete p.bermudaType; delete p.fabric; delete p.bermudaVariants;
    } else if (p.category === 'Tênis') {
      if (p.sizes.some(size => !/^\d{1,2}$/.test(size))) throw fail(400, `Numeração inválida: ${p.name}.`);
      if (Object.keys(p.stockBySize).length && (Object.keys(p.stockBySize).length !== p.sizes.length || Object.values(p.stockBySize).reduce((sum, value) => sum + value, 0) !== p.stock)) throw fail(400, `O estoque total de ${p.name} deve ser a soma das numerações.`);
      if (p.status === 'published' && !p.description.startsWith('[DEMO]') && (!p.brand || !p.sizes.length || Object.keys(p.stockBySize).length !== p.sizes.length)) throw fail(400, `Cadastre marca e estoque por numeração antes de publicar ${p.name}.`);
      delete p.pricingRule; delete p.capType; delete p.capVariants; delete p.bermudaType; delete p.fabric; delete p.bermudaVariants;
    } else if (p.category === 'Bonés') {
      if (p.status === 'published' && !p.description.startsWith('[DEMO]') && (!p.brand || !p.capType || !p.capVariants.length)) throw fail(400, `Cadastre marca, modelo e variações antes de publicar ${p.name}.`);
      if (p.capVariants.length && p.capVariants.reduce((sum, item) => sum + item.stock, 0) !== p.stock) throw fail(400, `O estoque total de ${p.name} deve ser a soma das variações.`);
      if (p.capVariants.some(item => item.size) && p.capVariants.some(item => !item.size)) throw fail(400, `Use tamanho ou ajuste em todas as variações de ${p.name}, ou em nenhuma.`);
      if (p.capVariants.length && (p.sizes.length !== new Set(p.capVariants.map(item => item.size).filter(Boolean)).size || p.sizes.some(size => !p.capVariants.some(item => item.size === size)))) throw fail(400, `Os tamanhos de ${p.name} devem corresponder às variações.`);
      delete p.shoeType; delete p.pricingRule; delete p.stockBySize; delete p.bermudaType; delete p.fabric; delete p.bermudaVariants;
    } else if (p.category === 'Bermudas') {
      if (p.status === 'published' && !p.description.startsWith('[DEMO]') && (!p.bermudaType || !p.bermudaVariants.length)) throw fail(400, `Cadastre modelo e estoque por tamanho antes de publicar ${p.name}.`);
      if (p.bermudaVariants.length && p.bermudaVariants.reduce((sum, item) => sum + item.stock, 0) !== p.stock) throw fail(400, `O estoque total de ${p.name} deve ser a soma das variações.`);
      if (p.bermudaVariants.some(item => item.color) && p.bermudaVariants.some(item => !item.color)) throw fail(400, `Use cor em todas as variações de ${p.name}, ou em nenhuma.`);
      if (p.bermudaVariants.length && (p.sizes.length !== new Set(p.bermudaVariants.map(item => item.size)).size || p.sizes.some(size => !p.bermudaVariants.some(item => item.size === size)))) throw fail(400, `Os tamanhos de ${p.name} devem corresponder às variações.`);
      delete p.shoeType; delete p.capType; delete p.capVariants; delete p.pricingRule; delete p.stockBySize;
    } else if (p.category === 'Perfumes') {
      if (p.sizes.some(size => !/^\d{1,3}\s?ml$/i.test(size))) throw fail(400, `Volume inválido: ${p.name}.`);
      if (p.sizes.length && (Object.keys(p.stockBySize).length !== p.sizes.length || Object.values(p.stockBySize).reduce((sum, amount) => sum + amount, 0) !== p.stock)) throw fail(400, `O estoque total de ${p.name} deve ser a soma dos volumes.`);
      if (p.status === 'published' && !p.description.startsWith('[DEMO]') && (!p.brand || !p.sizes.length)) throw fail(400, `Cadastre marca e volume antes de publicar ${p.name}.`);
      delete p.color; delete p.shoeType; delete p.capType; delete p.capVariants; delete p.bermudaType; delete p.fabric; delete p.bermudaVariants; delete p.pricingRule;
    } else if (['Eletrônicos', 'Fones de ouvido'].includes(p.category)) {
      const validTypes = ['Celulares', 'Notebooks', 'Fones de Ouvido', 'Caixas de Som', 'Smartwatches', 'Consoles', 'Acessórios', 'Drones', 'TVs e Monitores', 'Outros'];
      if (p.electronicsType && !validTypes.includes(p.electronicsType)) throw fail(400, `Categoria de eletrônico inválida: ${p.name}.`);
      if (p.sizes.length || (p.electronicsVariants.length && p.electronicsVariants.reduce((sum, item) => sum + item.stock, 0) !== p.stock)) throw fail(400, `O estoque de ${p.name} deve corresponder às variações.`);
      if (p.status === 'published' && !p.description.startsWith('[DEMO]') && p.category === 'Eletrônicos' && !p.electronicsType) throw fail(400, `Selecione o tipo de eletrônico antes de publicar ${p.name}.`);
      delete p.color; delete p.shoeType; delete p.capType; delete p.capVariants; delete p.bermudaType; delete p.fabric; delete p.bermudaVariants; delete p.pricingRule; delete p.stockBySize;
    } else { delete p.color; delete p.brand; delete p.shoeType; delete p.capType; delete p.capVariants; delete p.bermudaType; delete p.fabric; delete p.bermudaVariants; delete p.pricingRule; delete p.stockBySize; }
    if (p.category !== 'Perfumes') { delete p.perfumeType; delete p.perfumeOrigin; delete p.perfumeCollection; delete p.perfumeConcentration; delete p.perfumeNotes; }
    if (!['Eletrônicos', 'Fones de ouvido'].includes(p.category)) { delete p.electronicsType; delete p.electronicsModel; delete p.electronicsSpecs; delete p.electronicsVariants; }
    if (p.image && !validImage(p.image)) throw fail(400, `Envie a foto pelo painel: ${p.name}.`);
    if (p.gallery.length > 8 || p.gallery.some(image => !validImage(image))) throw fail(400, `Use até 8 fotos adicionais enviadas pelo painel: ${p.name}.`);
    if (p.videoUrl) {
      const match = /^(?:https:\/\/(?:www\.)?youtube\.com\/watch\?v=|https:\/\/youtu\.be\/|https:\/\/www\.youtube-nocookie\.com\/embed\/)([a-zA-Z0-9_-]{11})(?:[&#?].*)?$/.exec(p.videoUrl);
      if (!match) throw fail(400, `Use um link válido do YouTube para o vídeo de ${p.name}.`);
      p.videoUrl = `https://www.youtube-nocookie.com/embed/${match[1]}`;
    }
    if (p.status === 'published' && !p.image) throw fail(400, `Adicione uma foto antes de publicar: ${p.name}.`);
    ids.add(p.id); slugs.add(p.slug); skus.add(p.sku);
    return p;
  });
  const names = new Set();
  const categories = input.categories.map(raw => {
    const name = String(raw.name || '').trim().slice(0, 60);
    const image = String(raw.image || '').trim();
    const key = name.toLocaleLowerCase('pt-BR');
    if (!name || names.has(key) || (image && !validImage(image))) throw fail(400, 'Categoria duplicada ou imagem inválida.');
    names.add(key);
    return { name, image, active: raw.active !== false };
  });
  if (products.some(product => !names.has(product.category.toLocaleLowerCase('pt-BR')))) throw fail(400, 'Cadastre a categoria do produto antes de salvá-lo.');
  for (const product of products) product.category = categories.find(category => category.name.toLocaleLowerCase('pt-BR') === product.category.toLocaleLowerCase('pt-BR')).name;
  if (input.subcategories != null && (!Array.isArray(input.subcategories) || input.subcategories.length > 200)) throw fail(400, 'Subcategorias inválidas.');
  const subKeys = new Set();
  const subcategories = (input.subcategories || []).map(raw => {
    const category = String(raw.category || '').trim(), name = String(raw.name || '').trim().slice(0, 60);
    const key = `${category.toLocaleLowerCase('pt-BR')}\u0000${name.toLocaleLowerCase('pt-BR')}`;
    if (!names.has(category.toLocaleLowerCase('pt-BR')) || !name || subKeys.has(key)) throw fail(400, 'Subcategoria duplicada ou inválida.');
    subKeys.add(key);
    return { category, name, active: raw.active !== false };
  });
  if (products.some(product => product.category !== 'Camisas' && product.subcategory && !shirtNames.has(product.subcategory.toLocaleLowerCase('pt-BR')) && !subKeys.has(`${product.category.toLocaleLowerCase('pt-BR')}\u0000${product.subcategory.toLocaleLowerCase('pt-BR')}`))) throw fail(400, 'Cadastre a subcategoria do produto antes de salvá-lo.');
  if (input.media != null && (!Array.isArray(input.media) || input.media.length > 2000)) throw fail(400, 'Biblioteca de fotos inválida.');
  const media = [...new Set(input.media || [])].map(value => String(value || '').trim());
  if (media.some(value => !validImage(value))) throw fail(400, 'Biblioteca de fotos inválida.');
  return { settings, categories, shirtSubcategories, subcategories, media, products };
}
function sign(payload) { return createHmac('sha256', hash).update(payload).digest('hex'); }
function authenticated(req) {
  if (!hash) return false;
  const token = /(?:^|;\s*)be_imports_session=([^;]+)/.exec(req.headers.cookie || '')?.[1];
  if (!token) return false;
  const [time, signature] = token.split('.');
  if (!/^\d+$/.test(time) || !/^[a-f0-9]{64}$/.test(signature) || Date.now() - Number(time) > 12 * 3600_000 || Number(time) > Date.now()) return false;
  return timingSafeEqual(Buffer.from(signature), Buffer.from(sign(time)));
}
function verifyPassword(password) {
  const [algorithm, salt, saved] = hash.split(':');
  if (algorithm !== 'scrypt' || !/^[a-f0-9]{32}$/.test(salt || '') || !/^[a-f0-9]{128}$/.test(saved || '')) return false;
  const derived = scryptSync(String(password), salt, 64);
  return timingSafeEqual(derived, Buffer.from(saved, 'hex'));
}
function publicCatalog(catalog) {
  const categories = catalog.categories.filter(category => category.active !== false);
  const active = new Set(categories.map(category => category.name));
  return { settings: catalog.settings, categories, shirtSubcategories: catalog.shirtSubcategories || [], products: catalog.products.filter(p => p.status === 'published' && active.has(p.category)) };
}
function serveFile(res, pathname) {
  const safe = pathname === '/' || !path.extname(pathname) ? '/index.html' : pathname;
  const relative = decodeURIComponent(safe).replace(/^\/+/, '');
  const isUpload = relative.startsWith('uploads/');
  const base = isUpload ? uploadDir : root;
  const absolute = isUpload ? path.resolve(uploadDir, relative.slice('uploads/'.length)) : path.resolve(root, relative);
  const allowed = ['index.html', 'offline.html', 'styles.css', 'pwa-responsive.css', 'script.js', 'pwa.js', 'bermudas-page.js', 'ofertas-page.js', 'perfumes-page.js', 'perfumes-page.css', 'eletronicos-page.js', 'eletronicos-page.css', 'hero-polish.css', 'catalog-filter.js', 'admin.js', 'admin-workspace.js', 'admin-workspace.css', 'favicon.ico', 'manifest.webmanifest', 'sw.js'].includes(relative) || relative.startsWith('assets/') || relative.startsWith('uploads/');
  if (!absolute.startsWith(base + path.sep) || /(^|[\\/])\./.test(relative) || !allowed) throw fail(404, 'Arquivo não encontrado.');
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) throw fail(404, 'Arquivo não encontrado.');
  res.writeHead(200, { 'Content-Type': mime[path.extname(absolute)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': ['.html', '.js', '.css', '.webmanifest'].includes(path.extname(absolute)) ? 'no-cache' : 'public, max-age=3600' });
  fs.createReadStream(absolute).pipe(res);
}
export async function handler(req, res) {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname === '/api/catalog' && req.method === 'GET') return json(res, 200, publicCatalog(await readCatalog()));
    if (pathname === '/api/checkout' && req.method === 'POST') {
      checkOrigin(req);
      const payload = await body(req, 20_000);
      return json(res, 200, prepareCheckout(payload, publicCatalog(await readCatalog())));
    }
    if (pathname === '/api/admin/session' && req.method === 'GET') return json(res, 200, { authenticated: authenticated(req), configured: Boolean(hash) });
    if (pathname === '/api/admin/login' && req.method === 'POST') {
      checkOrigin(req);
      const data = await body(req, 2000);
      if (!verifyPassword(data.password)) throw fail(401, 'Senha incorreta ou painel não configurado.');
      const time = String(Date.now());
      return json(res, 200, { ok: true }, { 'Set-Cookie': `be_imports_session=${time}.${sign(time)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${hosted ? '; Secure' : ''}` });
    }
    if (pathname === '/api/admin/logout' && req.method === 'POST') { checkOrigin(req); return json(res, 200, { ok: true }, { 'Set-Cookie': 'be_imports_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' }); }
    if (pathname.startsWith('/api/admin/')) {
      if (!authenticated(req)) throw fail(401, 'Entre no painel.');
      if (pathname === '/api/admin/catalog' && req.method === 'GET') return json(res, 200, await readCatalog());
      if (pathname === '/api/admin/import-preview' && req.method === 'POST') {
        checkOrigin(req);
        const input = await body(req, 4_000_000);
        const name = String(input.name || '');
        const encoded = String(input.data || '');
        if (!/\.(csv|xlsx)$/i.test(name) || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw fail(400, 'Envie um arquivo CSV ou XLSX válido.');
        const bytes = Buffer.from(encoded, 'base64');
        if (!bytes.length || bytes.length > 2_500_000) throw fail(413, 'A planilha deve ter até 2,5 MB.');
        return json(res, 200, parseSpreadsheet(bytes, name));
      }
      if (pathname === '/api/admin/catalog' && req.method === 'PUT') {
        checkOrigin(req);
        const data = await body(req, 3_000_000);
        const next = cleanCatalog(data);
        return json(res, 200, await writeCatalog(next, data.revision));
      }
      if (pathname === '/api/admin/upload-url' && req.method === 'POST') {
        checkOrigin(req);
        if (!hosted) return json(res, 200, { direct: false });
        const data = await body(req, 2000);
        const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[data.type];
        if (!ext) throw fail(400, 'Use PNG, JPEG ou WebP.');
        const name = `${randomUUID()}.${ext}`;
        const signed = await supa(`/storage/v1/object/upload/sign/${bucket}/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        const uploadUrl = new URL(`${supabaseUrl}/storage/v1${signed?.url || ''}`);
        if (uploadUrl.pathname !== `/storage/v1/object/upload/sign/${bucket}/${name}` || !uploadUrl.searchParams.get('token')) throw fail(503, 'Não foi possível preparar o envio da foto.');
        return json(res, 200, { direct: true, uploadUrl: uploadUrl.href, url: photoBase + name });
      }
      if (pathname === '/api/admin/upload' && req.method === 'POST') {
        checkOrigin(req);
        const data = await body(req);
        if (!/^data:image\/(png|jpeg|webp);base64,/.test(data.image || '')) throw fail(400, 'Use PNG, JPEG ou WebP.');
        const match = /^data:image\/(png|jpeg|webp);base64,(.*)$/.exec(data.image);
        const bytes = Buffer.from(match[2], 'base64');
        if (!bytes.length || bytes.length > 5_242_880) throw fail(413, 'A foto deve ter até 5 MB.');
        const signature = bytes.subarray(0, 12).toString('hex');
        const valid = match[1] === 'png' ? signature.startsWith('89504e470d0a1a0a') : match[1] === 'jpeg' ? signature.startsWith('ffd8ff') : signature.startsWith('52494646') && bytes.subarray(8, 12).toString() === 'WEBP';
        if (!valid) throw fail(400, 'Formato da foto inválido.');
        const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
        const name = `${randomUUID()}.${ext}`;
        if (supabaseUrl) {
          await supa(`/storage/v1/object/${bucket}/${name}`, { method: 'POST', headers: { 'Content-Type': `image/${match[1]}`, 'x-upsert': 'false' }, body: bytes });
          return json(res, 200, { url: photoBase + name });
        }
        fs.mkdirSync(uploadDir, { recursive: true });
        fs.writeFileSync(path.join(uploadDir, name), bytes);
        return json(res, 200, { url: `/uploads/${name}` });
      }
    }
    if (pathname.startsWith('/api/')) throw fail(404, 'Rota não encontrada.');
    if (req.method !== 'GET' && req.method !== 'HEAD') throw fail(405, 'Método não permitido.');
    return serveFile(res, pathname);
  } catch (error) { if (!error.status) console.error('BE IMPORTS server error:', error); return json(res, error.status || 500, { error: error.status ? error.message : 'Erro interno do servidor.' }); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  http.createServer(handler).listen(Number(process.env.PORT || 3000), process.env.HOST || '127.0.0.1', () => console.log(`BE IMPORTS: http://127.0.0.1:${process.env.PORT || 3000}`));
}
