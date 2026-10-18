import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { parseCsv, parseSpreadsheet } from '../admin-import.js';

function xlsxFixture(rows) {
  const sheet = `<?xml version="1.0"?><worksheet><sheetData>${rows.map((row, i) => `<row r="${i + 1}">${row.map((value, j) => `<c r="${String.fromCharCode(65 + j)}${i + 1}" t="inlineStr"><is><t>${value}</t></is></c>`).join('')}</row>`).join('')}</sheetData></worksheet>`;
  const files = [['xl/worksheets/sheet1.xml', Buffer.from(sheet)]];
  const local = [], central = [];let offset = 0;
  for (const [name, data] of files) {
    const label = Buffer.from(name), compressed = deflateRawSync(data);
    const header = Buffer.alloc(30);header.writeUInt32LE(0x04034b50, 0);header.writeUInt16LE(8, 8);header.writeUInt32LE(compressed.length, 18);header.writeUInt32LE(data.length, 22);header.writeUInt16LE(label.length, 26);
    local.push(header, label, compressed);
    const entry = Buffer.alloc(46);entry.writeUInt32LE(0x02014b50, 0);entry.writeUInt16LE(8, 10);entry.writeUInt32LE(compressed.length, 20);entry.writeUInt32LE(data.length, 24);entry.writeUInt16LE(label.length, 28);entry.writeUInt32LE(offset, 42);
    central.push(entry, label);offset += header.length + label.length + compressed.length;
  }
  const centralSize = Buffer.concat(central).length;
  const end = Buffer.alloc(22);end.writeUInt32LE(0x06054b50, 0);end.writeUInt16LE(files.length, 8);end.writeUInt16LE(files.length, 10);end.writeUInt32LE(centralSize, 12);end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, ...central, end]);
}

test('CSV lê aspas, separador e 50 produtos sem perder linhas', () => {
  const rows = Array.from({ length: 50 }, (_, i) => `"CAM${i + 1}";"Camisa ${i + 1}";"Camisas";"140,00"`).join('\r\n');
  const parsed = parseSpreadsheet(Buffer.from(`\uFEFFSKU;Nome;Categoria;Preço\r\n${rows}`), 'produtos.csv');
  assert.equal(parsed.count, 50);
  assert.deepEqual(parsed.rows[0], ['CAM1', 'Camisa 1', 'Camisas', '140,00']);
  assert.deepEqual(parseCsv('Nome,Descrição\n"Camisa, azul","Nova ""edição"""'), [['Nome', 'Descrição'], ['Camisa, azul', 'Nova "edição"']]);
});

test('XLSX lê primeira aba e células de texto', () => {
  const bytes = xlsxFixture([['SKU', 'Nome', 'Preço'], ['CAM001', 'Camisa teste', '140'], ['CAM002', 'Outra camisa', '125']]);
  const parsed = parseSpreadsheet(bytes, 'catalogo.xlsx');
  assert.deepEqual(parsed.headers, ['SKU', 'Nome', 'Preço']);
  assert.equal(parsed.count, 2);
  assert.deepEqual(parsed.rows[1], ['CAM002', 'Outra camisa', '125']);
});

test('planilha vazia ou malformada informa erro', () => {
  assert.throws(() => parseSpreadsheet(Buffer.from('Nome,Preço'), 'vazia.csv'), /cabeçalho e pelo menos um produto/);
  assert.throws(() => parseSpreadsheet(Buffer.from('invalido'), 'ruim.xlsx'), /Excel inválido/);
});
