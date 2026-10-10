// Registro de herramientas. Para añadir una nueva:
//   1. Crea tools/<id>/<id>.js con `export function mount(container) { ... }`
//      (puede devolver una función de limpieza).
//   2. Añade aquí una entrada.
//   3. Añade sus archivos a la lista de sw.js para que funcione sin conexión.

const ICONO_ETIQUETA = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M3 12.6V4a1 1 0 0 1 1-1h8.6a1 1 0 0 1 .7.3l7.4 7.4a1 1 0 0 1 0 1.4l-8.6 8.6a1 1 0 0 1-1.4 0L3.3 13.3a1 1 0 0 1-.3-.7z"/>
    <circle cx="7.5" cy="7.5" r="1.5"/>
    <path d="M10 13l1-1M12 15l2.5-2.5M14 17l1-1"/>
  </svg>`;

export const TOOLS = [
  {
    id: 'etiquetas',
    nombre: 'Generador de etiquetas',
    descripcion: 'Etiquetas con código de barras para la Brother QL-810WC',
    icono: ICONO_ETIQUETA,
    load: () => import('../../tools/etiquetas/etiquetas.js'),
  },
];

export function findTool(id) {
  return TOOLS.find((t) => t.id === id) ?? null;
}
