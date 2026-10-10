// SKU de la tienda: TIPO(3)-MARCA(3)-MODELO(6)-TALLA(3)-COLOR(6)
// Ejemplo: SUJ-SEL-0MAITE-95B-TIERRA
//
// Reglas al generar:
// - Mayúsculas, sin tildes, sin espacios ni símbolos.
// - Si falta longitud se rellena con 0 por delante (MAITE -> 0MAITE).
// - Si sobra, la talla se queda con el final (100B -> 00B) y el resto con el
//   principio (ANTONELA -> ANTONE).
//
// Los SKU antiguos (SUJ-SEL-BLA-90C-BLA) tienen otras longitudes, así que un
// SKU nuevo nunca puede coincidir con uno antiguo.

export const PARTS = [
  { key: 'tipo', label: 'Tipo', length: 3, keep: 'start' },
  { key: 'marca', label: 'Marca', length: 3, keep: 'start' },
  { key: 'modelo', label: 'Modelo', length: 6, keep: 'start' },
  { key: 'talla', label: 'Talla', length: 3, keep: 'end' },
  { key: 'color', label: 'Color', length: 6, keep: 'start' },
];

const NEW_FORMAT = /^[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{6}-[A-Z0-9]{3}-[A-Z0-9]{6}$/;
const OLD_FORMAT = /^[A-Z0-9]+(-[A-Z0-9]+){4}$/;

// Tallas de letras: al leer un SKU se les quitan los ceros de relleno (00M -> M).
const LETTER_SIZES = new Set(['XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', '4XL', 'P', 'G', 'EG', 'XEG', 'UNI']);

export function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function fit(value, length, keep = 'start') {
  const v = normalize(value);
  if (v.length > length) return keep === 'end' ? v.slice(-length) : v.slice(0, length);
  return v.padStart(length, '0');
}

// datos: { tipo, marca, modelo, talla, color }
// dicts: { tipos: {SUJ: 'Sujetador'}, marcas: {SEL: 'Selene'} } (opcional)
export function generate(datos, dicts = {}) {
  const errores = [];
  const avisos = [];
  const piezas = [];

  for (const part of PARTS) {
    const raw = normalize(datos?.[part.key]);
    if (!raw) {
      errores.push(`Falta ${part.label.toLowerCase()}`);
      continue;
    }
    if ((part.key === 'tipo' || part.key === 'marca') && raw.length !== 3) {
      errores.push(`${part.label} debe tener 3 letras (has puesto "${raw}")`);
      continue;
    }
    piezas.push(fit(raw, part.length, part.keep));
  }

  if (errores.length) return { sku: '', errores, avisos };

  const [tipo, marca] = piezas;
  if (dicts.tipos && !(tipo in dicts.tipos)) avisos.push(`El tipo ${tipo} no está en el diccionario`);
  if (dicts.marcas && !(marca in dicts.marcas)) avisos.push(`La marca ${marca} no está en el diccionario`);

  return { sku: piezas.join('-'), errores, avisos };
}

// Devuelve { formato: 'nuevo' | 'antiguo' | 'invalido', errores, avisos }
export function validate(sku, dicts = {}) {
  const s = String(sku ?? '').trim().toUpperCase();
  const errores = [];
  const avisos = [];

  if (!s) return { formato: 'invalido', errores: ['Falta el SKU'], avisos };

  let formato;
  if (NEW_FORMAT.test(s)) {
    formato = 'nuevo';
  } else if (OLD_FORMAT.test(s)) {
    formato = 'antiguo';
    avisos.push('Este SKU tiene el formato antiguo. Se puede imprimir igualmente.');
  } else {
    const n = s.split('-').length;
    errores.push(n < 5
      ? `Faltan piezas: el SKU debe tener 5 partes separadas por guiones (tiene ${n})`
      : 'El SKU solo puede tener letras, números y 5 partes separadas por guiones');
    return { formato: 'invalido', errores, avisos };
  }

  const [tipo, marca] = s.split('-');
  if (dicts.tipos && !(tipo in dicts.tipos)) avisos.push(`El tipo ${tipo} no está en el diccionario`);
  if (dicts.marcas && !(marca in dicts.marcas)) avisos.push(`La marca ${marca} no está en el diccionario`);

  return { formato, errores, avisos };
}

function stripPadding(v) {
  return v.replace(/^0+(?=.)/, '');
}

function capitalize(v) {
  return v ? v[0] + v.slice(1).toLowerCase() : v;
}

// Traduce un SKU a texto claro. Devuelve null si no tiene 5 partes.
export function parse(sku, dicts = {}) {
  const s = String(sku ?? '').trim().toUpperCase();
  if (!OLD_FORMAT.test(s)) return null;
  const [tipo, marca, modelo, talla, color] = s.split('-');

  const tallaLimpia = stripPadding(talla);
  return {
    tipo: { codigo: tipo, nombre: dicts.tipos?.[tipo] ?? null },
    marca: { codigo: marca, nombre: dicts.marcas?.[marca] ?? null },
    modelo: capitalize(stripPadding(modelo)),
    talla: LETTER_SIZES.has(tallaLimpia) ? tallaLimpia : talla,
    color: capitalize(stripPadding(color)),
  };
}
