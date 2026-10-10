// Configuración general de la app.

// Hash del PIN de acceso (nunca el PIN en claro).
// Para cambiarlo: node scripts/pin-hash.js 1234  y pega aquí el resultado.
// Ojo: el código de la app es público, así que el PIN solo evita entradas por
// casualidad. No protege datos; cuando haya datos (Supabase) irán con login real.
export const PIN_HASH = 'b17bc168c5c4f0f9d072194944c025722781e7ad81d2e9037d1b24a7a7f71731';
export const PIN_LENGTH = 4;

// Días que un dispositivo recuerda el PIN.
export const PIN_REMEMBER_DAYS = 30;

export const APP_NAME = 'Carmen Díaz · Herramientas';
