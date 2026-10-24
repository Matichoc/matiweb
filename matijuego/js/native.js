// Puente con el teléfono (solo en la app de Android e iOS; en la web no hace nada).
// La app no usa empaquetador, así que no está @capacitor/core: se habla directo con el puente nativo que Capacitor
// inyecta en window.Capacitor (nativePromise / addListener), y solo con los plugins que de verdad vienen en la app.
//
// 1) Copia del progreso: el juego guarda todo en localStorage (perfiles, Matipuntos, ropa, casa, logros). Dentro de la app
//    eso vive en los datos del navegador interno, que el sistema puede borrar (en iPhone, si falta espacio, iOS puede
//    limpiar los datos de WebKit). Por eso se guarda además una copia en el almacenamiento propio de la app
//    (@capacitor/preferences: UserDefaults en iOS, SharedPreferences en Android) y, si al abrir no hay perfiles pero sí
//    copia, se restaura antes de que arranque el juego.
// 2) Vibración: en iPhone no existe navigator.vibrate; se usa @capacitor/haptics (en Android también, más suave).

const cap = typeof window !== "undefined" ? window.Capacitor : null;
const isNative = !!cap && typeof cap.isNativePlatform === "function" && cap.isNativePlatform() && typeof cap.nativePromise === "function";
const hasPlugin = (name) => isNative && (cap.PluginHeaders || []).some((h) => h.name === name);

export const NATIVE = isNative;
export const PLATFORM = isNative ? (cap.getPlatform?.() || "native") : "web";

const BACKUP_KEY = "matichoc_backup_v1";
const PREFIX = "matichoc_";
const PROFILES_KEY = "matichoc_profiles_v1"; // ver js/profiles.js
const HAS_PREFS = hasPlugin("Preferences");
const HAS_HAPTICS = hasPlugin("Haptics");

/** Todas las claves del juego (sin las copias de guardados dañados), como texto. */
function snapshot() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX) && !k.endsWith("_corrupt")) data[k] = localStorage.getItem(k);
  }
  return data;
}

let lastSaved = "";
/** Guarda la copia en el almacenamiento de la app si algo cambió desde la última vez. */
export async function backupNow() {
  if (!HAS_PREFS) return false;
  try {
    const data = snapshot();
    if (!data[PROFILES_KEY]) return false; // sin perfiles no hay nada que cuidar (y no se pisa una copia buena con una vacía)
    const txt = JSON.stringify(data);
    if (txt === lastSaved) return false;
    await cap.nativePromise("Preferences", "set", { key: BACKUP_KEY, value: JSON.stringify({ v: 1, at: Date.now(), data }) });
    lastSaved = txt;
    return true;
  } catch (e) {
    return false;
  }
}

/** Si el navegador interno perdió los datos (no hay perfiles) y hay copia, la vuelve a poner. Devuelve cuántas claves restauró. */
export async function restoreIfLost() {
  if (!HAS_PREFS) return 0;
  try {
    if (localStorage.getItem(PROFILES_KEY)) return 0;
    const r = await cap.nativePromise("Preferences", "get", { key: BACKUP_KEY });
    const saved = r && r.value ? JSON.parse(r.value) : null;
    if (!saved || !saved.data || !saved.data[PROFILES_KEY]) return 0;
    let n = 0;
    for (const [k, v] of Object.entries(saved.data)) {
      if (k.startsWith(PREFIX) && typeof v === "string") { localStorage.setItem(k, v); n++; }
    }
    lastSaved = JSON.stringify(snapshot());
    return n;
  } catch (e) {
    return 0;
  }
}

/** Vibración corta (golpes, premios). */
export function vibrate(ms = 30) {
  try {
    if (HAS_HAPTICS) {
      cap.nativePromise("Haptics", "impact", { style: ms >= 80 ? "HEAVY" : ms >= 45 ? "MEDIUM" : "LIGHT" }).catch(() => {});
      return;
    }
    navigator.vibrate?.(ms);
  } catch (e) { /* no disponible */ }
}

// Al abrir: restaurar (si hace falta) ANTES de que el juego lea los perfiles. Este módulo se importa primero en main.js
// y la espera de primer nivel hace que main.js no corra hasta que termine (en la web no espera nada).
export const restored = await restoreIfLost();

// Copia periódica (solo si cambió algo) y al salir de la app o pasarla a segundo plano.
if (HAS_PREFS) {
  setInterval(backupNow, 20000);
  // después de los demás oyentes (main.js anota la hora de salida en el progreso al ocultarse)
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") setTimeout(backupNow, 0); });
  window.addEventListener("pagehide", () => { backupNow(); });
  setTimeout(backupNow, 3000);
}
