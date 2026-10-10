// Calcula el hash del PIN para pegarlo en app/js/config.js.
// Uso: node scripts/pin-hash.js 1234
import { createHash } from 'node:crypto';

const pin = process.argv[2] ?? '';
if (!/^\d{4}$/.test(pin)) {
  console.error('Escribe un PIN de 4 cifras: node scripts/pin-hash.js 1234');
  process.exit(1);
}
console.log(createHash('sha256').update(`carmen-diaz:${pin}`).digest('hex'));
