// Arranque: PIN -> inicio -> herramienta (router por #hash).
import { isUnlocked, askPin, lock } from './pin.js';
import { TOOLS, findTool } from './tools.js';

const root = document.getElementById('app');
let cleanup = null;

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderHome() {
  document.title = 'Carmen Díaz · Herramientas';
  root.innerHTML = `
    <header class="topbar">
      <h1><span class="marca">Carmen Díaz</span></h1>
      <button type="button" class="btn btn-icono" data-salir aria-label="Bloquear">Salir</button>
    </header>
    <main class="page">
      <nav class="herramientas">
        ${TOOLS.map((t) => `
          <a class="herramienta" href="#/${t.id}">
            ${t.icono}
            <div><strong>${escapeHtml(t.nombre)}</strong><span>${escapeHtml(t.descripcion)}</span></div>
          </a>`).join('')}
      </nav>
      <p class="pie">Lencería Carmen Díaz · Valdemoro</p>
    </main>`;
  root.querySelector('[data-salir]').addEventListener('click', () => {
    lock();
    start();
  });
}

async function renderTool(tool) {
  document.title = `${tool.nombre} · Carmen Díaz`;
  root.innerHTML = `
    <header class="topbar">
      <a class="btn btn-icono" href="#/" aria-label="Volver al inicio">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>
      </a>
      <h1>${escapeHtml(tool.nombre)}</h1>
    </header>
    <main class="page" id="tool"></main>`;
  try {
    const mod = await tool.load();
    cleanup = (await mod.mount(root.querySelector('#tool'))) ?? null;
  } catch (err) {
    console.error(err);
    root.querySelector('#tool').innerHTML = '<p class="mensajes"><span class="error">No se ha podido abrir la herramienta. Comprueba la conexión y vuelve a intentarlo.</span></p>';
  }
}

function route() {
  if (typeof cleanup === 'function') cleanup();
  cleanup = null;
  window.scrollTo(0, 0);

  const id = location.hash.replace(/^#\/?/, '');
  const tool = id ? findTool(id) : null;
  if (tool) renderTool(tool);
  else renderHome();
}

async function start() {
  window.removeEventListener('hashchange', route);
  if (!isUnlocked()) await askPin(root);
  window.addEventListener('hashchange', route);
  route();
}

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch((err) => console.warn('Sin modo offline:', err));
}

start();
