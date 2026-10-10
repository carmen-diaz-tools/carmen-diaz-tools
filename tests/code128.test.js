import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PATTERNS, encode, checksum, totalModules, START_B, START_C, CODE_B, CODE_C, STOP,
} from '../tools/etiquetas/code128.js';

// Decodificador mínimo para comprobar la ida y vuelta.
function decode(widths) {
  const byPattern = new Map(PATTERNS.map((p, v) => [p, v]));
  const values = [];
  let i = 0;
  while (i < widths.length) {
    const size = widths.length - i === 7 ? 7 : 6;
    const v = byPattern.get(widths.slice(i, i + size).join(''));
    assert.notEqual(v, undefined, `patrón desconocido en la posición ${i}`);
    values.push(v);
    i += size;
  }
  assert.equal(values.at(-1), STOP);
  assert.equal(values.at(-2), checksum(values.slice(0, -2)), 'checksum');

  let set = values[0] === START_C ? 'C' : 'B';
  let out = '';
  for (const v of values.slice(1, -2)) {
    if (set === 'B' && v === CODE_C) set = 'C';
    else if (set === 'C' && v === CODE_B) set = 'B';
    else if (set === 'B') out += String.fromCharCode(v + 32);
    else out += String(v).padStart(2, '0');
  }
  return out;
}

test('la tabla de patrones es coherente', () => {
  assert.equal(PATTERNS.length, 107);
  assert.equal(new Set(PATTERNS).size, 107, 'patrones únicos');
  PATTERNS.forEach((p, v) => {
    const digits = [...p].map(Number);
    const sum = digits.reduce((a, b) => a + b, 0);
    assert.equal(sum, v === STOP ? 13 : 11, `ancho del valor ${v}`);
    const bars = digits.filter((_, i) => i % 2 === 0).reduce((a, b) => a + b, 0);
    assert.equal(bars % 2, 0, `paridad de barras del valor ${v}`);
    assert.ok(digits.every((d) => d >= 1 && d <= 4), `anchos 1-4 en el valor ${v}`);
  });
});

test('checksum del ejemplo de referencia "PJJ123C"', () => {
  const { values } = encode('PJJ123C');
  // Solo hay 3 dígitos seguidos: todo en juego B.
  assert.equal(values[0], START_B);
  assert.equal(values.at(-2), 55); // 879 mod 103
});

test('SKU nuevo: ida y vuelta, todo en B', () => {
  const sku = 'SUJ-SEL-0MAITE-95B-TIERRA';
  const { values, widths } = encode(sku);
  assert.equal(values[0], START_B);
  assert.equal(values.length, sku.length + 3);
  assert.equal(decode(widths), sku);
  assert.equal(totalModules(widths), (sku.length + 2) * 11 + 13);
});

test('EAN-13 usa juego C y ocupa menos', () => {
  const ean = '8428039051718';
  const { values, widths } = encode(ean);
  assert.equal(decode(widths), ean);
  assert.ok(values.includes(CODE_C) || values[0] === START_C);
  // inicio + 1 dígito en B + cambio + 6 pares + checksum + parada
  assert.equal(values.length, 11);
});

test('número par empieza directamente en C', () => {
  const { values, widths } = encode('12345678');
  assert.equal(values[0], START_C);
  assert.equal(decode(widths), '12345678');
});

test('mezcla con tramo numérico en medio vuelve a B', () => {
  const text = 'AB123456CD';
  const { values, widths } = encode(text);
  assert.ok(values.includes(CODE_C));
  assert.ok(values.includes(CODE_B));
  assert.equal(decode(widths), text);
});

test('SKU antiguo y códigos cortos', () => {
  for (const t of ['SUJ-SEL-BLA-90C-BLA', 'SLI-ABA-A0525-060-BLA', '1', '12', '123', 'A']) {
    assert.equal(decode(encode(t).widths), t);
  }
});

test('rechaza vacío y caracteres fuera de ASCII', () => {
  assert.throws(() => encode(''));
  assert.throws(() => encode('ROSÉ'));
});
