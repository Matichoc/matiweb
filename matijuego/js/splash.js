// Sello de inicio: "Desarrollado por Matichoc · Pasión por el cacao", como cuando se prende una consola.
// Sale al abrir la app y también al volver después de un buen rato sin usarla. Si pasaron muchas horas
// (por ejemplo, de un día para otro) la app se reinicia sola, como si se hubiera cerrado, y vuelve a mostrarse.

import * as audio from "./audio.js?v=71b37ac21d";

const SHOW_AFTER_MS = 20 * 60 * 1000; // volver después de 20 minutos: se muestra el sello
const RESTART_AFTER_MS = 3 * 60 * 60 * 1000; // después de 3 horas: se reinicia la app
const HOLD_MS = 3300; // cuánto dura el sello antes de desvanecerse
const MIN_TAP_MS = 900; // se puede saltar tocándolo, pero no al instante

let el = null;
let timer = null;
let shownAt = 0;

function hide() {
  if (!el || el.classList.contains("out")) return;
  clearTimeout(timer);
  el.classList.add("out");
  setTimeout(() => { if (el.classList.contains("out")) el.classList.add("gone"); }, 700);
}

/** Muestra el sello desde el principio. */
export function showSplash() {
  el = el || document.getElementById("splash");
  if (!el) return;
  clearTimeout(timer);
  el.classList.remove("out", "gone", "play");
  void el.offsetWidth; // reinicia las animaciones
  el.classList.add("play");
  shownAt = Date.now();
  audio.playIntro();
  timer = setTimeout(hide, HOLD_MS);
}

export function initSplash() {
  el = document.getElementById("splash");
  if (!el) return;
  // para las pruebas automáticas (?debug3d o ?nosplash) no estorba
  if (/[?&](debug3d|nosplash)\b/.test(location.search)) { el.classList.add("gone"); return; }
  el.addEventListener("pointerdown", () => { if (Date.now() - shownAt >= MIN_TAP_MS) hide(); });
  showSplash();
  let hiddenAt = 0;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") { hiddenAt = Date.now(); return; }
    if (!hiddenAt) return;
    const away = Date.now() - hiddenAt;
    hiddenAt = 0;
    if (away >= RESTART_AFTER_MS) location.reload();
    else if (away >= SHOW_AFTER_MS) showSplash();
  });
}
