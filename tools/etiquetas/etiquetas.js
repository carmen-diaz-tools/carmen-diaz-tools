// Generador de etiquetas: formulario, vista previa y envío a iPrint&Label.
import { generate, validate, parse, normalize } from './sku.js';
import { renderLabel, loadLogo, canvasToBlob, parsePrice, ROLLS } from './label-render.js';
import { load, save } from '../../app/js/storage.js';

const OTRO = '__otro__';

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function loadDicts() {
  const get = async (name) => {
    try {
      const r = await fetch(`data/${name}.json`);
      return r.ok ? await r.json() : {};
    } catch {
      return {};
    }
  };
  const [tipos, marcas] = await Promise.all([get('tipos'), get('marcas')]);
  // Códigos añadidos desde la app en este dispositivo.
  const extra = load('diccionario-extra', { tipos: {}, marcas: {} });
  return { tipos: { ...tipos, ...extra.tipos }, marcas: { ...marcas, ...extra.marcas } };
}

// Dígito de control de EAN-8 / EAN-13 / UPC-A.
function eanValido(code) {
  if (!/^\d+$/.test(code) || ![8, 12, 13].includes(code.length)) return null;
  const digits = [...code].map(Number);
  const check = digits.pop();
  const sum = digits.reverse().reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

function options(dict, selected) {
  return Object.entries(dict)
    .sort((a, b) => a[1].localeCompare(b[1], 'es'))
    .map(([code, name]) => `<option value="${esc(code)}"${code === selected ? ' selected' : ''}>${esc(name)} (${esc(code)})</option>`)
    .join('');
}

function messages(list) {
  return list.map(([type, text]) => `<span class="${type}">${esc(text)}</span>`).join('');
}

function loadStyles() {
  if (document.querySelector('link[data-etiquetas]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'tools/etiquetas/etiquetas.css';
  link.dataset.etiquetas = '';
  document.head.append(link);
}

export async function mount(container) {
  loadStyles();
  const dicts = await loadDicts();
  const recuerdo = load('ultimo', {});

  const state = {
    tieneCodigo: null, // 'si' | 'no'
    origen: 'generar', // 'manual' | 'generar'
    codigoPropio: '',
    skuManual: '',
    gen: { tipo: recuerdo.tipo ?? '', marca: recuerdo.marca ?? '', modelo: '', talla: '', color: '' },
    nuevoTipo: { codigo: '', nombre: '' },
    nuevaMarca: { codigo: '', nombre: '' },
    etiqueta: { nombre: '', talla: '', color: '', precio: '', oferta: false, precioOferta: '' },
    tocado: new Set(), // campos de la etiqueta editados a mano
  };

  container.innerHTML = `
    <div class="etiquetas">
      <div class="etiquetas-form">
        <section class="tarjeta">
          <h2>1. Código de barras</h2>
          <div class="campo">
            <span class="etiqueta-campo">¿El producto tiene código de barras propio?</span>
            <div class="chips" data-grupo="tieneCodigo">
              <button type="button" class="chip" data-valor="si" aria-pressed="false">Sí</button>
              <button type="button" class="chip" data-valor="no" aria-pressed="false">No</button>
            </div>
          </div>

          <div data-bloque="si" hidden>
            <div class="campo">
              <label for="codigoPropio">Código de barras del producto</label>
              <input id="codigoPropio" class="mono" inputmode="numeric" autocomplete="off" placeholder="8428039051718">
              <span class="ayuda">El número que viene debajo de las barras en la etiqueta del fabricante (EAN).</span>
            </div>
          </div>

          <div data-bloque="no" hidden>
            <div class="chips" data-grupo="origen">
              <button type="button" class="chip" data-valor="generar" aria-pressed="true">Generar SKU</button>
              <button type="button" class="chip" data-valor="manual" aria-pressed="false">Ya tengo el SKU</button>
            </div>

            <div data-bloque="manual" hidden>
              <div class="campo">
                <label for="skuManual">SKU</label>
                <input id="skuManual" class="mono" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="SUJ-SEL-0MAITE-95B-TIERRA">
              </div>
            </div>

            <div data-bloque="generar">
              <div class="fila">
                <div class="campo">
                  <label for="genTipo">Tipo</label>
                  <select id="genTipo"></select>
                </div>
                <div class="campo">
                  <label for="genMarca">Marca</label>
                  <select id="genMarca"></select>
                </div>
              </div>
              <div class="fila" data-nuevo="tipo" hidden>
                <div class="campo"><label for="nuevoTipoNombre">Nombre del tipo nuevo</label><input id="nuevoTipoNombre" placeholder="Body"></div>
                <div class="campo"><label for="nuevoTipoCodigo">Código (3 letras)</label><input id="nuevoTipoCodigo" class="mono" maxlength="3" placeholder="BOD"></div>
              </div>
              <div class="fila" data-nuevo="marca" hidden>
                <div class="campo"><label for="nuevaMarcaNombre">Nombre de la marca nueva</label><input id="nuevaMarcaNombre" placeholder="Marca"></div>
                <div class="campo"><label for="nuevaMarcaCodigo">Código (3 letras)</label><input id="nuevaMarcaCodigo" class="mono" maxlength="3" placeholder="MAR"></div>
              </div>
              <div class="campo">
                <label for="genModelo">Modelo</label>
                <input id="genModelo" autocomplete="off" placeholder="Maite">
              </div>
              <div class="fila">
                <div class="campo">
                  <label for="genTalla">Talla</label>
                  <input id="genTalla" autocomplete="off" autocapitalize="characters" placeholder="95B">
                </div>
                <div class="campo">
                  <label for="genColor">Color</label>
                  <input id="genColor" autocomplete="off" placeholder="Tierra">
                </div>
              </div>
            </div>

            <div class="sku-resultado" data-sku hidden>
              <span class="etiqueta-campo">SKU</span>
              <div class="sku-linea">
                <code data-sku-texto></code>
                <button type="button" class="btn btn-secundario btn-pequeno" data-copiar>Copiar</button>
              </div>
              <dl class="sku-claro" data-sku-claro></dl>
              <p class="nota">Pon este SKU también en el campo <strong>Código de barras</strong> del producto en Shopify. Así el lector del POS lo encuentra.</p>
            </div>
          </div>

          <div class="mensajes" data-msg-codigo></div>
        </section>

        <section class="tarjeta">
          <h2>2. Datos de la etiqueta</h2>
          <div class="campo">
            <label for="nombre">Nombre del producto</label>
            <input id="nombre" autocomplete="off" placeholder="Sujetador Maite">
          </div>
          <div class="fila">
            <div class="campo"><label for="talla">Talla</label><input id="talla" autocomplete="off" placeholder="95B"></div>
            <div class="campo"><label for="color">Color</label><input id="color" autocomplete="off" placeholder="Tierra"></div>
          </div>
          <div class="campo">
            <span class="etiqueta-campo">¿Está en oferta?</span>
            <div class="chips" data-grupo="oferta">
              <button type="button" class="chip" data-valor="no" aria-pressed="true">No</button>
              <button type="button" class="chip" data-valor="si" aria-pressed="false">Sí</button>
            </div>
          </div>
          <div class="fila">
            <div class="campo">
              <label for="precio" data-label-precio>Precio (€)</label>
              <input id="precio" inputmode="decimal" autocomplete="off" placeholder="21,99">
            </div>
            <div class="campo">
              <label for="precioOferta">Precio oferta (€)</label>
              <input id="precioOferta" inputmode="decimal" autocomplete="off" placeholder="15,99" disabled>
            </div>
          </div>
          <div class="mensajes" data-msg-datos></div>
        </section>
      </div>

      <aside class="etiquetas-preview">
        <section class="tarjeta">
          <h2>3. Vista previa</h2>
          <div class="preview-marco"><canvas data-canvas aria-label="Vista previa de la etiqueta"></canvas></div>
          <p class="rollo" data-rollo></p>
          <button type="button" class="btn btn-primario btn-bloque" data-generar disabled>Generar etiqueta</button>
          <div class="mensajes" data-msg-generar></div>
        </section>
      </aside>
    </div>`;

  const $ = (sel) => container.querySelector(sel);
  const canvas = $('[data-canvas]');
  let logo = null;
  try {
    logo = await loadLogo();
  } catch {
    logo = null;
  }

  // ---------- Selects de tipo y marca
  function fillSelects() {
    $('#genTipo').innerHTML = `<option value="">Elige…</option>${options(dicts.tipos, state.gen.tipo)}<option value="${OTRO}">Otro…</option>`;
    $('#genMarca').innerHTML = `<option value="">Elige…</option>${options(dicts.marcas, state.gen.marca)}<option value="${OTRO}">Otra…</option>`;
    if (state.gen.tipo && !(state.gen.tipo in dicts.tipos)) state.gen.tipo = '';
    if (state.gen.marca && !(state.gen.marca in dicts.marcas)) state.gen.marca = '';
  }
  fillSelects();

  // ---------- Cálculo del código a imprimir
  function codigoActual() {
    const msgs = [];
    let codigo = '';
    let sku = '';

    if (state.tieneCodigo === 'si') {
      codigo = state.codigoPropio.trim();
      if (!codigo) {
        msgs.push(['ok', 'Escribe el código de barras del producto.']);
      } else if (!/^\d+$/.test(codigo)) {
        msgs.push(['aviso', 'Los códigos de fabricante suelen ser solo números. Revisa que esté bien copiado.']);
      } else {
        const ok = eanValido(codigo);
        if (ok === false) msgs.push(['aviso', 'El último dígito no cuadra con un EAN. Revisa que no falte ni sobre ningún número.']);
        if (ok === null) msgs.push(['aviso', `Tiene ${codigo.length} cifras. Un EAN normal tiene 13.`]);
      }
    } else if (state.tieneCodigo === 'no') {
      if (state.origen === 'manual') {
        const s = state.skuManual.trim().toUpperCase();
        if (s) {
          const v = validate(s, dicts);
          v.errores.forEach((e) => msgs.push(['error', e]));
          v.avisos.forEach((a) => msgs.push(['aviso', a]));
          if (!v.errores.length) sku = s;
        } else {
          msgs.push(['ok', 'Escribe el SKU.']);
        }
      } else {
        const tipo = state.gen.tipo === OTRO ? state.nuevoTipo.codigo : state.gen.tipo;
        const marca = state.gen.marca === OTRO ? state.nuevaMarca.codigo : state.gen.marca;
        const r = generate({ ...state.gen, tipo, marca }, dicts);
        // Un tipo o marca nuevo aún no está en el diccionario: no hace falta avisar.
        const avisos = state.gen.tipo === OTRO || state.gen.marca === OTRO ? [] : r.avisos;
        if (r.errores.length) msgs.push(['ok', `${r.errores.join(' · ')}.`]);
        avisos.forEach((a) => msgs.push(['aviso', a]));
        sku = r.sku;
      }
      codigo = sku;
    } else {
      msgs.push(['ok', 'Empieza contestando si el producto trae código de barras.']);
    }
    return { codigo, sku, msgs };
  }

  function datosMsgs() {
    const e = state.etiqueta;
    const msgs = [];
    const precio = parsePrice(e.precio);
    if (!e.nombre.trim()) msgs.push(['ok', 'Falta el nombre del producto.']);
    if (e.precio.trim() && precio === null) msgs.push(['error', 'El precio no es un número válido.']);
    if (!e.precio.trim()) msgs.push(['ok', 'Falta el precio.']);
    if (e.oferta) {
      const po = parsePrice(e.precioOferta);
      if (!e.precioOferta.trim()) msgs.push(['ok', 'Falta el precio de oferta.']);
      else if (po === null) msgs.push(['error', 'El precio de oferta no es un número válido.']);
      else if (precio !== null && po >= precio) msgs.push(['error', 'El precio de oferta debe ser más bajo que el precio de antes.']);
    }
    return msgs;
  }

  // Rellena talla, color y nombre desde el SKU mientras no se hayan tocado.
  function autocompletar(sku) {
    let talla = '';
    let color = '';
    let nombre = '';
    if (state.tieneCodigo === 'no' && state.origen === 'generar') {
      talla = state.gen.talla.trim().toUpperCase();
      color = state.gen.color.trim();
      const tipoNombre = state.gen.tipo === OTRO ? state.nuevoTipo.nombre : dicts.tipos[state.gen.tipo];
      nombre = [tipoNombre, state.gen.modelo.trim()].filter(Boolean).join(' ');
    } else if (state.tieneCodigo === 'no' && sku) {
      const p = parse(sku, dicts);
      if (p) {
        talla = p.talla;
        color = p.color;
        nombre = [p.tipo.nombre, p.modelo].filter(Boolean).join(' ');
      }
    } else {
      return;
    }
    const e = state.etiqueta;
    if (!state.tocado.has('talla')) { e.talla = talla; $('#talla').value = talla; }
    if (!state.tocado.has('color')) { e.color = color; $('#color').value = color; }
    if (!state.tocado.has('nombre')) { e.nombre = nombre; $('#nombre').value = nombre; }
  }

  function pintarSku(sku) {
    const box = $('[data-sku]');
    box.hidden = !sku;
    if (!sku) return;
    $('[data-sku-texto]').textContent = sku;
    const p = parse(sku, dicts);
    $('[data-sku-claro]').innerHTML = p ? `
      <div><dt>Tipo</dt><dd>${esc(p.tipo.nombre ?? p.tipo.codigo)}</dd></div>
      <div><dt>Marca</dt><dd>${esc(p.marca.nombre ?? p.marca.codigo)}</dd></div>
      <div><dt>Modelo</dt><dd>${esc(p.modelo)}</dd></div>
      <div><dt>Talla</dt><dd>${esc(p.talla)}</dd></div>
      <div><dt>Color</dt><dd>${esc(p.color)}</dd></div>` : '';
  }

  let listo = false;
  let codigoFinal = '';

  function update() {
    // Visibilidad
    $('[data-bloque="si"]').hidden = state.tieneCodigo !== 'si';
    $('[data-bloque="no"]').hidden = state.tieneCodigo !== 'no';
    $('[data-bloque="manual"]').hidden = state.origen !== 'manual';
    $('[data-bloque="generar"]').hidden = state.origen !== 'generar';
    $('[data-nuevo="tipo"]').hidden = state.gen.tipo !== OTRO;
    $('[data-nuevo="marca"]').hidden = state.gen.marca !== OTRO;
    for (const g of container.querySelectorAll('[data-grupo]')) {
      const key = g.dataset.grupo;
      const value = key === 'oferta' ? (state.etiqueta.oferta ? 'si' : 'no') : state[key];
      g.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.valor === value)));
    }
    const oferta = state.etiqueta.oferta;
    $('#precioOferta').disabled = !oferta;
    $('[data-label-precio]').textContent = oferta ? 'Precio antes (€)' : 'Precio (€)';

    const { codigo, sku, msgs } = codigoActual();
    pintarSku(state.tieneCodigo === 'no' ? sku : '');
    autocompletar(sku);
    $('[data-msg-codigo]').innerHTML = messages(msgs);

    const dmsgs = datosMsgs();
    $('[data-msg-datos]').innerHTML = messages(dmsgs);

    const roll = oferta ? ROLLS.oferta : ROLLS.normal;
    $('[data-rollo]').textContent = roll.descripcion;

    const r = renderLabel(canvas, { codigo, ...state.etiqueta }, logo);
    const renderMsgs = r.ok ? [] : [['error', r.error]];
    $('[data-msg-generar]').innerHTML = messages(renderMsgs);

    codigoFinal = codigo;
    const hayError = [...msgs, ...dmsgs, ...renderMsgs].some(([t]) => t === 'error');
    const falta = !codigo || !state.etiqueta.nombre.trim() || parsePrice(state.etiqueta.precio) === null
      || (oferta && parsePrice(state.etiqueta.precioOferta) === null);
    listo = !hayError && !falta;
    $('[data-generar]').disabled = !listo;
  }

  // ---------- Eventos
  container.addEventListener('click', async (ev) => {
    const chip = ev.target.closest('.chip');
    if (chip) {
      const key = chip.closest('[data-grupo]').dataset.grupo;
      if (key === 'oferta') state.etiqueta.oferta = chip.dataset.valor === 'si';
      else state[key] = chip.dataset.valor;
      update();
      return;
    }
    if (ev.target.closest('[data-copiar]')) {
      const btn = ev.target.closest('[data-copiar]');
      try {
        await navigator.clipboard.writeText($('[data-sku-texto]').textContent);
        btn.textContent = 'Copiado';
      } catch {
        btn.textContent = 'No se pudo copiar';
      }
      setTimeout(() => { btn.textContent = 'Copiar'; }, 1500);
      return;
    }
    if (ev.target.closest('[data-generar]')) generar();
  });

  const bind = (id, apply) => $(id).addEventListener('input', (e) => { apply(e.target.value); update(); });
  bind('#codigoPropio', (v) => { state.codigoPropio = v.replace(/\s/g, ''); });
  bind('#skuManual', (v) => { state.skuManual = v; });
  bind('#genModelo', (v) => { state.gen.modelo = v; });
  bind('#genTalla', (v) => { state.gen.talla = v; });
  bind('#genColor', (v) => { state.gen.color = v; });
  bind('#nuevoTipoNombre', (v) => {
    state.nuevoTipo.nombre = v;
    if (!$('#nuevoTipoCodigo').dataset.tocado) {
      state.nuevoTipo.codigo = normalize(v).slice(0, 3);
      $('#nuevoTipoCodigo').value = state.nuevoTipo.codigo;
    }
  });
  bind('#nuevoTipoCodigo', (v) => { state.nuevoTipo.codigo = normalize(v).slice(0, 3); $('#nuevoTipoCodigo').dataset.tocado = '1'; });
  bind('#nuevaMarcaNombre', (v) => {
    state.nuevaMarca.nombre = v;
    if (!$('#nuevaMarcaCodigo').dataset.tocado) {
      state.nuevaMarca.codigo = normalize(v).slice(0, 3);
      $('#nuevaMarcaCodigo').value = state.nuevaMarca.codigo;
    }
  });
  bind('#nuevaMarcaCodigo', (v) => { state.nuevaMarca.codigo = normalize(v).slice(0, 3); $('#nuevaMarcaCodigo').dataset.tocado = '1'; });
  $('#genTipo').addEventListener('change', (e) => { state.gen.tipo = e.target.value; update(); });
  $('#genMarca').addEventListener('change', (e) => { state.gen.marca = e.target.value; update(); });

  for (const key of ['nombre', 'talla', 'color', 'precio', 'precioOferta']) {
    $(`#${key}`).addEventListener('input', (e) => {
      state.etiqueta[key] = e.target.value;
      // Si se vacía el campo, vuelve a rellenarse solo.
      if (e.target.value) state.tocado.add(key); else state.tocado.delete(key);
      update();
    });
  }

  // Guarda en este dispositivo los tipos o marcas nuevos para la próxima vez.
  function recordarNuevos() {
    const extra = load('diccionario-extra', { tipos: {}, marcas: {} });
    let cambia = false;
    if (state.gen.tipo === OTRO && state.nuevoTipo.codigo.length === 3) {
      extra.tipos[state.nuevoTipo.codigo] = state.nuevoTipo.nombre.trim() || state.nuevoTipo.codigo;
      dicts.tipos[state.nuevoTipo.codigo] = extra.tipos[state.nuevoTipo.codigo];
      state.gen.tipo = state.nuevoTipo.codigo;
      cambia = true;
    }
    if (state.gen.marca === OTRO && state.nuevaMarca.codigo.length === 3) {
      extra.marcas[state.nuevaMarca.codigo] = state.nuevaMarca.nombre.trim() || state.nuevaMarca.codigo;
      dicts.marcas[state.nuevaMarca.codigo] = extra.marcas[state.nuevaMarca.codigo];
      state.gen.marca = state.nuevaMarca.codigo;
      cambia = true;
    }
    if (cambia) {
      save('diccionario-extra', extra);
      fillSelects();
    }
    if (state.tieneCodigo === 'no' && state.origen === 'generar') {
      save('ultimo', { tipo: state.gen.tipo, marca: state.gen.marca });
    }
  }

  async function generar() {
    update();
    if (!listo) return;
    const out = $('[data-msg-generar]');
    try {
      const blob = await canvasToBlob(canvas);
      const nombre = `etiqueta-${codigoFinal.replace(/[^A-Za-z0-9-]/g, '')}.png`;
      const file = new File([blob], nombre, { type: 'image/png' });
      recordarNuevos();

      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: nombre });
          out.innerHTML = messages([['ok', 'Listo. Elige iPrint&Label en el menú de compartir.']]);
        } catch (err) {
          if (err.name !== 'AbortError') throw err;
        }
        return;
      }
      // Sin menú de compartir (p. ej. ordenador): se descarga la imagen.
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombre;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      out.innerHTML = messages([['ok', 'Imagen descargada. Ábrela con iPrint&Label para imprimir.']]);
    } catch (err) {
      console.error(err);
      out.innerHTML = messages([['error', 'No se ha podido generar la etiqueta. Vuelve a intentarlo.']]);
    }
  }

  update();
}
