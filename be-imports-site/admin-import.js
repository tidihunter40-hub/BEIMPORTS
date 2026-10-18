import { inflateRawSync } from 'node:zlib';

const fail = message => Object.assign(new Error(message), { status: 400 });
const decodeXml = value => value.replace(/&#(x[0-9a-f]+|\d+);|&(amp|lt|gt|quot|apos);/gi, (_, numeric, named) => {
  if (numeric) return String.fromCodePoint(numeric[0].toLowerCase() === 'x' ? parseInt(numeric.slice(1), 16) : Number(numeric));
  return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[named.toLowerCase()];
});

export function parseCsv(source) {
  const text = source.replace(/^\uFEFF/, '');
  const firstLine = text.split(/\r?\n/, 1)[0];
  const delimiter = [';', ',', '\t'].map(char => [char, firstLine.split(char).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else if (!quoted && cell) cell += char;
      else quoted = !quoted;
    } else if (char === delimiter && !quoted) { row.push(cell); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); if (row.some(value => value.trim())) rows.push(row);
      row = []; cell = '';
    } else cell += char;
  }
  if (quoted) throw fail('A planilha CSV possui aspas sem fechamento.');
  row.push(cell); if (row.some(value => value.trim())) rows.push(row);
  return rows;
}

function unzipEntries(bytes) {
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i--) {
    if (bytes.readUInt32LE(i) === 0x06054b50) { end = i; break; }
  }
  if (end < 0) throw fail('Arquivo Excel inválido.');
  const count = bytes.readUInt16LE(end + 10);
  let offset = bytes.readUInt32LE(end + 16);
  if (count > 200 || offset >= bytes.length) throw fail('Planilha grande ou inválida.');
  const files = new Map();
  for (let i = 0; i < count; i++) {
    if (bytes.readUInt32LE(offset) !== 0x02014b50) throw fail('Arquivo Excel inválido.');
    const method = bytes.readUInt16LE(offset + 10);
    const compressed = bytes.readUInt32LE(offset + 20);
    const expanded = bytes.readUInt32LE(offset + 24);
    const nameLength = bytes.readUInt16LE(offset + 28);
    const extraLength = bytes.readUInt16LE(offset + 30);
    const commentLength = bytes.readUInt16LE(offset + 32);
    const local = bytes.readUInt32LE(offset + 42);
    const name = bytes.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
    if (expanded > 12_000_000 || local + 30 > bytes.length || bytes.readUInt32LE(local) !== 0x04034b50) throw fail('Planilha grande ou inválida.');
    const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
    if (start + compressed > bytes.length) throw fail('Arquivo Excel inválido.');
    if (/^xl\/(worksheets\/[^/]+\.xml|sharedStrings\.xml|workbook\.xml|_rels\/workbook\.xml\.rels)$/.test(name)) {
      const data = bytes.subarray(start, start + compressed);
      const output = method === 0 ? data : method === 8 ? inflateRawSync(data, { maxOutputLength: 12_000_000 }) : null;
      if (!output || output.length !== expanded) throw fail('Compactação Excel não suportada.');
      files.set(name, output.toString('utf8'));
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

const textNodes = xml => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(match => decodeXml(match[1])).join('');
const columnIndex = letters => [...letters].reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0) - 1;

export function parseXlsx(bytes) {
  const files = unzipEntries(bytes);
  const shared = [...(files.get('xl/sharedStrings.xml') || '').matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map(match => textNodes(match[1]));
  let sheetName = 'xl/worksheets/sheet1.xml';
  const book = files.get('xl/workbook.xml') || '';
  const relationship = /<sheet\b[^>]*r:id="([^"]+)"/i.exec(book)?.[1];
  if (relationship) {
    const rels = files.get('xl/_rels/workbook.xml.rels') || '';
    const tag = [...rels.matchAll(/<Relationship\b[^>]*>/gi)].map(match => match[0]).find(value => value.includes(`Id="${relationship}"`));
    const target = /Target="([^"]+)"/i.exec(tag || '')?.[1];
    if (target) sheetName = 'xl/' + target.replace(/^\/?xl\//, '').replace(/^\//, '');
  }
  const xml = files.get(sheetName) || files.get('xl/worksheets/sheet1.xml');
  if (!xml) throw fail('A planilha Excel não possui uma primeira aba legível.');
  const rows = [];
  for (const rowMatch of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row = [];
    for (const cell of rowMatch[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = /\br="([A-Z]+)\d+"/i.exec(cell[1])?.[1]?.toUpperCase();
      const index = ref ? columnIndex(ref) : row.length;
      if (index > 100) throw fail('Planilha com muitas colunas.');
      const type = /\bt="([^"]+)"/.exec(cell[1])?.[1];
      const value = /<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(cell[2] || '')?.[1];
      row[index] = type === 's' ? shared[Number(value)] || '' : type === 'inlineStr' ? textNodes(cell[2] || '') : decodeXml(value || '');
    }
    if (row.some(value => String(value || '').trim())) rows.push(row);
    if (rows.length > 2001) throw fail('Importe no máximo 2.000 produtos por arquivo.');
  }
  return rows;
}

export function parseSpreadsheet(bytes, filename) {
  const matrix = /\.xlsx$/i.test(filename) ? parseXlsx(bytes) : /\.csv$/i.test(filename) ? parseCsv(bytes.toString('utf8')) : null;
  if (!matrix || matrix.length < 2) throw fail('Envie uma planilha CSV ou XLSX com cabeçalho e pelo menos um produto.');
  const headers = matrix[0].map(value => String(value || '').trim());
  if (!headers.some(Boolean) || headers.length > 100) throw fail('Cabeçalho da planilha inválido.');
  return { headers, rows: matrix.slice(1).map(row => headers.map((_, index) => String(row[index] ?? '').trim())), count: matrix.length - 1 };
}
