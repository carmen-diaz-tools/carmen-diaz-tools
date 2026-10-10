// Almacenamiento local del dispositivo.
//
// Todo lo que la app guarda pasa por aquí, para que el día que haya que
// compartir datos entre dispositivos (p. ej. Supabase) solo cambie este archivo.
// localStorage puede fallar (modo privado, almacenamiento bloqueado), así que
// cualquier error se trata como "no hay nada guardado".

const PREFIX = 'cd-tools:';

export function load(key, fallback = null) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Sin almacenamiento: la app sigue funcionando, solo no recuerda.
  }
}

export function remove(key) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // nada
  }
}
