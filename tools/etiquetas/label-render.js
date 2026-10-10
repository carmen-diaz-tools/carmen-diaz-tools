// Dibuja la etiqueta en un <canvas>. La misma función sirve para la vista
// previa y para el archivo que se imprime, así lo que se ve es lo que sale.
//
// Tamaño: 696 x 271 px = área imprimible de la DK-11209 (62x29 mm) a 300 dpi.
// El rollo continuo DK-22251 tiene el mismo ancho imprimible (696 px), así que
// la etiqueta de oferta usa el mismo tamaño. Imprimir al 100 % = 1 px por punto.

import { encode, totalModules, QUIET_ZONE } from './code128.js';
import { LOGO_SRC, LOGO_WIDTH, LOGO_HEIGHT } from './logo.js';

export const WIDTH = 696;
export const HEIGHT = 271;
export const RED = '#FF0000';
const BLACK = '#000000';
const MARGIN = 10;
const MAX_MODULE = 4;
const FONT = 'Helvetica, Arial, sans-serif';
const MONO = '"Courier New", Courier, monospace';

export const ROLLS = {
  normal: { id: 'DK-11209', descripcion: 'Rollo DK-11209 · 62×29 mm · negro' },
  oferta: { id: 'DK-22251', descripcion: 'Rollo DK-22251 · 62 mm continuo · negro y rojo' },
};

// "21,99" / "21.99" / "21" -> 21.99 ; vacío o inválido -> null
export function parsePrice(value) {
  const s = String(value ?? '').trim().replace(/\s|€/g, '').replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

export function formatPrice(n) {
  return `${n.toFixed(2).replace('.', ',')} €`;
}

let logoPromise = null;
export function loadLogo() {
  logoPromise ??= new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se ha podido cargar el logo'));
    img.src = LOGO_SRC;
  });
  return logoPromise;
}

// Elige la anchura de módulo (en px enteros) más gruesa que quepa con sus
// zonas en blanco. Devuelve 0 si el código es demasiado largo.
export function moduleWidth(widths, available = WIDTH) {
  const modules = totalModules(widths) + 2 * QUIET_ZONE;
  return Math.min(MAX_MODULE, Math.floor(available / modules));
}

function fitText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

// La térmica solo imprime negro (y rojo en DK-22251): se quitan los grises del
// suavizado para que el texto no salga borroso o con puntos sueltos.
function toPrinterColors(ctx, allowRed) {
  const img = ctx.getImageData(0, 0, WIDTH, HEIGHT);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const [r, g, b] = [d[i], d[i + 1], d[i + 2]];
    const isRed = allowRed && r > 150 && g < 140 && b < 140;
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (isRed) { d[i] = 255; d[i + 1] = 0; d[i + 2] = 0; } else {
      const v = lum < 150 ? 0 : 255;
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

// datos: { codigo, nombre, talla, color, precio, oferta, precioOferta }
// Devuelve { ok, error } — si el código no cabe, ok = false.
export function renderLabel(canvas, datos, logo) {
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.textBaseline = 'alphabetic';

  const oferta = Boolean(datos.oferta);
  const precio = parsePrice(datos.precio);
  const precioOferta = parsePrice(datos.precioOferta);

  // --- Logo
  if (logo) ctx.drawImage(logo, MARGIN, 6, LOGO_WIDTH, LOGO_HEIGHT);

  // --- Precio (arriba a la derecha)
  const right = WIDTH - MARGIN;
  if (oferta && precioOferta !== null) {
    ctx.font = `bold 50px ${FONT}`;
    ctx.fillStyle = RED;
    ctx.textAlign = 'right';
    const ahora = formatPrice(precioOferta);
    ctx.fillText(ahora, right, 54);
    const ahoraW = ctx.measureText(ahora).width;

    if (precio !== null) {
      ctx.font = `28px ${FONT}`;
      ctx.fillStyle = BLACK;
      const antes = formatPrice(precio);
      const antesRight = right - ahoraW - 14;
      ctx.fillText(antes, antesRight, 50);
      const w = ctx.measureText(antes).width;
      ctx.fillRect(Math.round(antesRight - w - 2), 39, Math.round(w + 4), 3);
    }
  } else if (precio !== null) {
    ctx.font = `bold 46px ${FONT}`;
    ctx.fillStyle = BLACK;
    ctx.textAlign = 'right';
    ctx.fillText(formatPrice(precio), right, 52);
  }

  // --- Nombre y talla · color
  ctx.textAlign = 'left';
  ctx.fillStyle = BLACK;
  ctx.font = `bold 30px ${FONT}`;
  ctx.fillText(fitText(ctx, String(datos.nombre ?? '').trim(), WIDTH - 2 * MARGIN), MARGIN, 102);

  const detalle = [
    datos.talla ? `Talla ${String(datos.talla).trim()}` : '',
    String(datos.color ?? '').trim(),
  ].filter(Boolean).join(' · ');
  ctx.font = `26px ${FONT}`;
  ctx.fillText(fitText(ctx, detalle, WIDTH - 2 * MARGIN), MARGIN, 134);

  // --- Código de barras
  const codigo = String(datos.codigo ?? '').trim();
  let result = { ok: true, error: null };
  if (codigo) {
    try {
      const { widths } = encode(codigo);
      const m = moduleWidth(widths);
      if (m < 1) {
        result = { ok: false, error: 'El código es demasiado largo para caber en la etiqueta' };
      } else {
        const barsW = totalModules(widths) * m;
        let x = Math.floor((WIDTH - barsW) / 2);
        const top = 144;
        const h = 90;
        ctx.fillStyle = BLACK;
        widths.forEach((w, i) => {
          if (i % 2 === 0) ctx.fillRect(x, top, w * m, h);
          x += w * m;
        });
        ctx.font = `bold 24px ${MONO}`;
        ctx.textAlign = 'center';
        ctx.fillText(codigo, WIDTH / 2, 260);
      }
    } catch (err) {
      result = { ok: false, error: err.message };
    }
  }

  toPrinterColors(ctx, oferta);
  return result;
}

export function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se ha podido crear la imagen'))), 'image/png');
  });
}
