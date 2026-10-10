// Pantalla de PIN. Se recuerda en el dispositivo durante PIN_REMEMBER_DAYS.
import { PIN_HASH, PIN_LENGTH, PIN_REMEMBER_DAYS } from './config.js';
import { load, save } from './storage.js';

const KEY = 'pin-ok-hasta';

async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function isUnlocked() {
  return Number(load(KEY, 0)) > Date.now();
}

export function lock() {
  save(KEY, 0);
}

// Muestra el teclado en `root` y resuelve cuando el PIN es correcto.
export function askPin(root) {
  return new Promise((resolve) => {
    root.innerHTML = `
      <main class="pin">
        <img src="assets/icons/icon-192.png" alt="" width="120" height="120">
        <div>
          <h1>Lencería Carmen Díaz</h1>
          <p class="ayuda">Introduce el código para entrar</p>
        </div>
        <div class="pin-puntos" aria-hidden="true">${'<span></span>'.repeat(PIN_LENGTH)}</div>
        <div class="pin-error" role="alert"></div>
        <div class="pin-teclado">
          ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button type="button" data-n="${n}">${n}</button>`).join('')}
          <span></span>
          <button type="button" data-n="0">0</button>
          <button type="button" class="sin-borde" data-borrar aria-label="Borrar">Borrar</button>
        </div>
      </main>`;

    const dots = root.querySelector('.pin-puntos');
    const error = root.querySelector('.pin-error');
    let value = '';
    let checking = false;

    const paint = () => {
      [...dots.children].forEach((d, i) => d.classList.toggle('lleno', i < value.length));
    };

    async function press(key) {
      if (checking) return;
      if (key === 'borrar') value = value.slice(0, -1);
      else if (value.length < PIN_LENGTH) value += key;
      error.textContent = '';
      paint();
      if (value.length < PIN_LENGTH) return;

      checking = true;
      const ok = (await sha256(`carmen-diaz:${value}`)) === PIN_HASH;
      if (ok) {
        save(KEY, Date.now() + PIN_REMEMBER_DAYS * 864e5);
        document.removeEventListener('keydown', onKey);
        resolve();
        return;
      }
      error.textContent = 'Código incorrecto';
      dots.classList.remove('mal');
      void dots.offsetWidth;
      dots.classList.add('mal');
      value = '';
      setTimeout(paint, 300);
      checking = false;
    }

    function onKey(e) {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('borrar');
    }

    root.querySelector('.pin-teclado').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      press(b.hasAttribute('data-borrar') ? 'borrar' : b.dataset.n);
    });
    document.addEventListener('keydown', onKey);
  });
}
