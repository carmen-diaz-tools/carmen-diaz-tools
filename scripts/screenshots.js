// Prueba de extremo a extremo y capturas para el README.
// Abre la app en Edge/Chrome sin ventana, rellena el formulario, guarda capturas
// en docs/capturas/ y la etiqueta a tamaño real en docs/capturas/etiqueta-*.png.
//
// Uso: node scripts/serve.js   (en otra terminal)
//      PIN=xxxxxx node scripts/screenshots.js [ruta-al-navegador]
import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BROWSER = process.argv[2] ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const APP = process.env.APP ?? 'http://localhost:8080/';
const PIN = process.env.PIN;
if (!PIN) {
  console.error('Indica el PIN: PIN=xxxxxx node scripts/screenshots.js');
  process.exit(1);
}
const OUT = fileURLToPath(new URL('../docs/capturas/', import.meta.url));
const PORT = 9333;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const profile = join(tmpdir(), `cd-tools-shots-${Date.now()}`);
const browser = spawn(BROWSER, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--hide-scrollbars', 'about:blank',
], { stdio: 'ignore' });

async function connect() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* aún arrancando */ }
    await wait(200);
  }
  throw new Error('No arranca el navegador');
}

const ws = new WebSocket(await connect());
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0;
const pending = new Map();
const pageErrors = [];
ws.addEventListener('message', (e) => {
  const msg = JSON.parse(e.data);
  if (msg.method === 'Runtime.exceptionThrown') pageErrors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text);
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') pageErrors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
});
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const n = ++id;
    pending.set(n, (m) => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result)));
    ws.send(JSON.stringify({ id: n, method, params }));
  });
}
async function js(expression) {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
}
async function viewport(width, height, mobile) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile });
}
async function shot(name, fullPage = true) {
  const { cssContentSize } = await send('Page.getLayoutMetrics');
  const params = { format: 'png', captureBeyondViewport: fullPage };
  if (fullPage) params.clip = { x: 0, y: 0, width: cssContentSize.width, height: cssContentSize.height, scale: 1 };
  const { data } = await send('Page.captureScreenshot', params);
  await writeFile(join(OUT, `${name}.png`), Buffer.from(data, 'base64'));
  console.log(`  ${name}.png`);
}
async function go(url) {
  await send('Page.navigate', { url });
  await wait(900);
}

// Helpers dentro de la página
const fill = (sel, value) => js(`(() => { const el = document.querySelector(${JSON.stringify(sel)});
  el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); })()`);
const chip = (grupo, valor) => js(`document.querySelector('[data-grupo="${grupo}"] [data-valor="${valor}"]').click()`);
const text = (sel) => js(`document.querySelector(${JSON.stringify(sel)})?.innerText ?? ''`);
const enabled = () => js(`!document.querySelector('[data-generar]').disabled`);
async function saveLabel(name) {
  const data = await js(`document.querySelector('[data-canvas]').toDataURL('image/png')`);
  await writeFile(join(OUT, `${name}.png`), Buffer.from(data.split(',')[1], 'base64'));
  console.log(`  ${name}.png (etiqueta real 696x271)`);
}
function check(cond, msg) {
  if (!cond) throw new Error(`FALLO: ${msg}`);
  console.log(`  ok · ${msg}`);
}

try {
  await mkdir(OUT, { recursive: true });
  await send('Page.enable');
  await send('Runtime.enable');

  console.log('Móvil (390 px)');
  await viewport(390, 844, true);
  await go(APP);
  await shot('01-pin', false);
  const wrongPin = (PIN === '0'.repeat(PIN.length) ? '1' : '0').repeat(PIN.length);
  for (const d of wrongPin) await js(`document.querySelector('[data-n="${d}"]').click()`);
  await wait(500);
  check((await text('.pin-error')).includes('incorrecto'), 'PIN incorrecto rechazado');
  for (const d of PIN) await js(`document.querySelector('[data-n="${d}"]').click()`);
  await wait(500);
  check(await js(`!!document.querySelector('.herramienta')`), 'PIN correcto abre el inicio');
  await shot('02-inicio', false);

  await go(`${APP}#/etiquetas`);
  await wait(500);
  await shot('03-etiquetas-vacio');

  // Caso 1: generar SKU
  await chip('tieneCodigo', 'no');
  await fill('#genTipo', 'SUJ');
  await fill('#genMarca', 'SEL');
  await fill('#genModelo', 'Maite');
  await fill('#genTalla', '95B');
  await fill('#genColor', 'Tierra');
  check((await text('[data-sku-texto]')) === 'SUJ-SEL-0MAITE-95B-TIERRA', 'SKU generado');
  check((await js(`document.querySelector('#nombre').value`)) === 'Sujetador Maite', 'nombre autocompletado');
  check(!(await enabled()), 'sin precio no deja generar');
  await fill('#precio', '21,99');
  check(await enabled(), 'con todo relleno deja generar');
  await shot('04-generar-sku');
  await saveLabel('etiqueta-normal-sku');

  // Caso 2: oferta
  await chip('oferta', 'si');
  check(!(await enabled()), 'oferta sin precio oferta no deja generar');
  await fill('#precioOferta', '25');
  check((await text('[data-msg-datos]')).includes('más bajo'), 'avisa si la oferta no es más barata');
  await fill('#precioOferta', '15,99');
  check(await enabled(), 'oferta válida');
  check((await text('[data-rollo]')).includes('DK-22251'), 'indica rollo rojo');
  await shot('05-oferta');
  await saveLabel('etiqueta-oferta');

  // Caso 3: código de barras propio (EAN)
  await go(`${APP}#/`);
  await go(`${APP}#/etiquetas`);
  await wait(400);
  await chip('tieneCodigo', 'si');
  await fill('#codigoPropio', '8428039051719');
  check((await text('[data-msg-codigo]')).includes('no cuadra'), 'EAN con dígito de control mal');
  await fill('#codigoPropio', '8428039051718');
  check(!(await text('[data-msg-codigo]')), 'EAN válido sin avisos');
  await fill('#nombre', 'Sujetador Mónica Selene');
  await fill('#talla', '105C');
  await fill('#color', 'Rosé');
  await fill('#precio', '21.99');
  check(await enabled(), 'EAN listo para generar');
  await shot('06-codigo-propio');
  await saveLabel('etiqueta-normal-ean');

  // Caso 4: SKU antiguo a mano
  await chip('tieneCodigo', 'no');
  await chip('origen', 'manual');
  await fill('#skuManual', 'SUJ-SEL-BLA-90C-BLA');
  check((await text('[data-msg-codigo]')).includes('formato antiguo'), 'SKU antiguo: aviso');
  await fill('#skuManual', 'SUJ-SEL-MAITE');
  check((await text('[data-msg-codigo]')).includes('Faltan piezas'), 'SKU incompleto: error');

  console.log('Tablet / ordenador (1024 px)');
  await viewport(1024, 900, false);
  await go(`${APP}#/`);
  await go(`${APP}#/etiquetas`);
  await wait(400);
  await chip('tieneCodigo', 'no');
  await fill('#genTipo', 'BRA');
  await fill('#genMarca', 'AVE');
  await fill('#genModelo', 'Antonela');
  await fill('#genTalla', 'XL');
  await fill('#genColor', 'Azul Eléctrico');
  check((await text('[data-sku-texto]')) === 'BRA-AVE-ANTONE-0XL-AZULEL', 'SKU con recortes');
  await fill('#precio', '12,50');
  await shot('07-escritorio');

  check(pageErrors.length === 0, `sin errores en la consola ${pageErrors.join(' | ')}`);
  console.log('\nTodo correcto.');
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  ws.close();
  browser.kill();
  await wait(500);
  await rm(profile, { recursive: true, force: true }).catch(() => {});
}
