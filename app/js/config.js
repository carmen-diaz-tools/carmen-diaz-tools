// Configuración general de la app.

// Hash del PIN de acceso (nunca el PIN en claro).
// Para cambiarlo: node scripts/pin-hash.js 123456  y pega aquí el resultado.
// Ojo: el código de la app es público, así que el PIN solo evita entradas por
// casualidad. No protege datos; cuando haya datos (Supabase) irán con login real.
export const PIN_HASH = '0374ea550d574fb81dc434e122624f8813ef4311667aae44636dce26705c2c65';
export const PIN_LENGTH = 6;

// Días que un dispositivo recuerda el PIN.
export const PIN_REMEMBER_DAYS = 30;

export const APP_NAME = 'Carmen Díaz · Herramientas';
