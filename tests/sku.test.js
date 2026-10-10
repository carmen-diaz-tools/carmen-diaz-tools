import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalize, fit, generate, validate, parse } from '../tools/etiquetas/sku.js';

const dicts = {
  tipos: JSON.parse(readFileSync(new URL('../data/tipos.json', import.meta.url))),
  marcas: JSON.parse(readFileSync(new URL('../data/marcas.json', import.meta.url))),
};

test('normalize quita tildes, espacios y símbolos', () => {
  assert.equal(normalize('Rosé'), 'ROSE');
  assert.equal(normalize('Azul Eléctrico'), 'AZULELECTRICO');
  assert.equal(normalize('Mónica-Ñ 2'), 'MONICAN2');
  assert.equal(normalize(null), '');
});

test('fit rellena con ceros delante y recorta', () => {
  assert.equal(fit('MAITE', 6), '0MAITE');
  assert.equal(fit('ANTONELA', 6), 'ANTONE');
  assert.equal(fit('100B', 3, 'end'), '00B');
  assert.equal(fit('95B', 3, 'end'), '95B');
  assert.equal(fit('XL', 3, 'end'), '0XL');
  assert.equal(fit('M', 3, 'end'), '00M');
});

test('generate: ejemplo del enunciado', () => {
  const r = generate({ tipo: 'SUJ', marca: 'SEL', modelo: 'Maite', talla: '95B', color: 'Tierra' }, dicts);
  assert.equal(r.sku, 'SUJ-SEL-0MAITE-95B-TIERRA');
  assert.deepEqual(r.errores, []);
  assert.deepEqual(r.avisos, []);
});

test('generate: recortes y tildes', () => {
  const r = generate({ tipo: 'suj', marca: 'sel', modelo: 'Antonela', talla: '100B', color: 'Azul Eléctrico' }, dicts);
  assert.equal(r.sku, 'SUJ-SEL-ANTONE-00B-AZULEL');
});

test('generate: avisa de las piezas que faltan', () => {
  const r = generate({ tipo: 'SUJ', marca: '', modelo: 'Maite', talla: '', color: 'Negro' }, dicts);
  assert.equal(r.sku, '');
  assert.deepEqual(r.errores, ['Falta marca', 'Falta talla']);
});

test('generate: tipo y marca deben tener 3 letras', () => {
  const r = generate({ tipo: 'SU', marca: 'SEL', modelo: 'X', talla: 'M', color: 'Negro' }, dicts);
  assert.match(r.errores[0], /Tipo debe tener 3 letras/);
});

test('generate: avisa si el código no está en el diccionario', () => {
  const r = generate({ tipo: 'ZZZ', marca: 'QQQ', modelo: 'X', talla: 'M', color: 'Negro' }, dicts);
  assert.equal(r.sku, 'ZZZ-QQQ-00000X-00M-0NEGRO');
  assert.equal(r.avisos.length, 2);
});

test('validate: formato nuevo, antiguo e inválido', () => {
  assert.equal(validate('SUJ-SEL-0MAITE-95B-TIERRA', dicts).formato, 'nuevo');
  assert.equal(validate('suj-sel-0maite-95b-tierra', dicts).formato, 'nuevo');

  const antiguo = validate('SUJ-SEL-BLA-90C-BLA', dicts);
  assert.equal(antiguo.formato, 'antiguo');
  assert.deepEqual(antiguo.errores, []);
  assert.equal(antiguo.avisos.length, 1);

  const corto = validate('SUJ-SEL-MAITE', dicts);
  assert.equal(corto.formato, 'invalido');
  assert.match(corto.errores[0], /Faltan piezas/);

  assert.equal(validate('', dicts).formato, 'invalido');
  assert.equal(validate('SUJ-SEL-MA TE-95B-TIERRA', dicts).formato, 'invalido');
});

test('validate: avisa de tipo o marca desconocidos', () => {
  const r = validate('XXX-SEL-0MAITE-95B-TIERRA', dicts);
  assert.equal(r.formato, 'nuevo');
  assert.match(r.avisos[0], /tipo XXX/);
});

test('parse: traduce el SKU a texto claro', () => {
  assert.deepEqual(parse('SUJ-SEL-0MAITE-95B-TIERRA', dicts), {
    tipo: { codigo: 'SUJ', nombre: 'Sujetador' },
    marca: { codigo: 'SEL', nombre: 'Selene' },
    modelo: 'Maite',
    talla: '95B',
    color: 'Tierra',
  });
  assert.equal(parse('SUJ-SEL-0MAITE-00M-0NEGRO', dicts).talla, 'M');
  assert.equal(parse('SUJ-SEL-0MAITE-00M-0NEGRO', dicts).color, 'Negro');
  // 00B viene de 100B: se deja tal cual para no inventar
  assert.equal(parse('SUJ-SEL-0MAITE-00B-0NEGRO', dicts).talla, '00B');
  assert.equal(parse('SUJ-SEL', dicts), null);
});

test('ida y vuelta: generar y parsear', () => {
  const datos = { tipo: 'BRA', marca: 'AVE', modelo: 'Lola', talla: 'XL', color: 'Beige' };
  const { sku } = generate(datos, dicts);
  const p = parse(sku, dicts);
  assert.equal(p.tipo.nombre, 'Braga');
  assert.equal(p.marca.nombre, 'Avet');
  assert.equal(p.modelo, 'Lola');
  assert.equal(p.talla, 'XL');
  assert.equal(p.color, 'Beige');
});
