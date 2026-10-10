// Codificador Code 128 (juegos B y C) sin dependencias.
//
// encode(texto) devuelve los valores de símbolo (con inicio, checksum y parada)
// y los anchos de barras/espacios en módulos, empezando siempre por barra.
// Los tramos numéricos largos se codifican en el juego C (dos dígitos por
// símbolo), así un EAN-13 sale más corto y con barras más gruesas.

// Anchos (barra, espacio, barra, espacio, barra, espacio) de cada valor 0-106.
// El 106 es la parada y tiene una barra final extra.
export const PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];

export const CODE_B = 100; // cambiar a juego B (estando en C)
export const CODE_C = 99; // cambiar a juego C (estando en B)
export const START_B = 104;
export const START_C = 105;
export const STOP = 106;

// Zona en blanco mínima a cada lado, en módulos (la norma pide 10).
export const QUIET_ZONE = 10;

function digitRun(text, from) {
  let i = from;
  while (i < text.length && text[i] >= '0' && text[i] <= '9') i++;
  return i - from;
}

function codeB(ch) {
  const c = ch.charCodeAt(0);
  if (c < 32 || c > 127) {
    throw new Error(`Carácter no válido para el código de barras: "${ch}"`);
  }
  return c - 32;
}

export function encode(text) {
  text = String(text ?? '');
  if (!text) throw new Error('No hay nada que codificar');

  const values = [];
  let set = null;
  let i = 0;

  while (i < text.length) {
    const run = digitRun(text, i);
    // Al principio o al final compensa C desde 4 dígitos; en medio, desde 6.
    const atEdge = i === 0 || i + run === text.length;
    const useC = run >= (atEdge ? 4 : 6);

    if (useC) {
      // Si el tramo es impar, el primer dígito va en B.
      if (run % 2 === 1) {
        if (set !== 'B') values.push(set === null ? START_B : CODE_B);
        set = 'B';
        values.push(codeB(text[i]));
        i++;
      }
      values.push(set === null ? START_C : CODE_C);
      set = 'C';
      const end = i + (run - (run % 2));
      for (; i < end; i += 2) values.push(Number(text.slice(i, i + 2)));
    } else {
      if (set !== 'B') values.push(set === null ? START_B : CODE_B);
      set = 'B';
      values.push(codeB(text[i]));
      i++;
    }
  }

  values.push(checksum(values));
  values.push(STOP);

  return { values, widths: toWidths(values) };
}

// Suma ponderada módulo 103: el inicio pesa 1 y cada símbolo su posición.
export function checksum(values) {
  let sum = values[0];
  for (let i = 1; i < values.length; i++) sum += values[i] * i;
  return sum % 103;
}

export function toWidths(values) {
  const widths = [];
  for (const v of values) {
    for (const d of PATTERNS[v]) widths.push(Number(d));
  }
  return widths;
}

// Ancho total en módulos, sin zonas en blanco.
export function totalModules(widths) {
  return widths.reduce((a, b) => a + b, 0);
}
