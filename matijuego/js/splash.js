// Pantalla de carga del juego (no es la pantalla inicial de Android: esa la muestra el sistema antes de abrir la app).
// Sello de inicio "Desarrollado por Matichoc · Pasión por el cacao", como cuando se prende una consola, y debajo un
// indicador de carga de verdad: dice "Cargando…" mientras el juego arranca y se va solo cuando ya está listo.
// En una temporada con arte (js/season-art.js, según el evento activo de js/events.js) el sello lleva la imagen de la
// temporada; si no hay arte o la imagen no carga, se ve el sello de siempre.
// Sale al abrir la app y también al volver después de un buen rato sin usarla. Si pasaron muchas horas
// (por ejemplo, de un día para otro) la app se reinicia sola, como si se hubiera cerrado, y vuelve a mostrarse.

import * as audio from "./audio.js?v=a4d43c7898";
import { seasonArt } from "./season-art.js?v=a4d43c7898";

const SHOW_AFTER_MS = 20 * 60 * 1000; // volver después de 20 minutos: se muestra el sello
const RESTART_AFTER_MS = 3 * 60 * 60 * 1000; // después de 3 horas: se reinicia la app
const HOLD_MS = 3300; // cuánto dura el sello como mínimo antes de desvanecerse
const MIN_TAP_MS = 900; // se puede saltar tocándolo (cuando el juego ya cargó), pero no al instante
const ART_WAIT_MS = 1500; // cuánto se espera la imagen de la temporada antes de seguir sin ella
const MAX_WAIT_MS = 15000; // por si algo falla al arrancar: no dejar la pantalla de carga para siempre

let el = null;
let timer = null;
let shownAt = 0;
let ready = false; // el juego terminó de arrancar (lo avisa main.js con markAppReady)
let held = false; // ya pasó el tiempo mínimo del sello

function hide() {
  if (!el || el.classList.contains("out")) return;
  clearTimeout(timer);
  el.classList.add("out");
  setTimeout(() => { if (el.classList.contains("out")) el.classList.add("gone"); }, 700);
}

function tryHide() {
  if (ready && held) hide();
}

function setStatus() {
  if (!el) return;
  el.classList.toggle("ready", ready);
  const txt = el.querySelector(".sp-loading-text");
  if (txt) txt.textContent = ready ? "¡Listo!" : "Cargando…";
}

/** Pone (o quita) el arte de la temporada activa. Devuelve una promesa que se cumple cuando la imagen cargó o se descartó. */
function applySeason() {
  const box = el.querySelector(".sp-season");
  const art = seasonArt();
  el.classList.remove("season");
  delete el.dataset.season;
  if (!box) return Promise.resolve(null);
  box.hidden = true;
  if (!art) return Promise.resolve(null);
  const main = box.querySelector(".sp-season-art");
  const blur = box.querySelector(".sp-season-bg");
  el.style.setProperty("--season-bg", art.bg || "#24123d");
  const load = (img, src) => new Promise((res) => {
    if (!img || !src) { res(false); return; }
    if (img.getAttribute("src") === src && img.complete && img.naturalWidth) { res(true); return; }
    img.onload = () => res(true);
    img.onerror = () => res(false);
    img.src = src;
  });
  const wait = new Promise((res) => setTimeout(() => res("tarde"), ART_WAIT_MS));
  return Promise.race([Promise.all([load(main, art.loading), load(blur, art.loadingBlur)]), wait]).then((r) => {
    const ok = Array.isArray(r) && r[0];
    if (ok) {
      el.classList.add("season");
      el.dataset.season = art.id;
      box.hidden = false;
    } else if (r === "tarde") {
      // la imagen llegó tarde: se agrega apenas termine de cargar, sin cortar la animación
      main.addEventListener("load", () => { if (!el.classList.contains("gone")) { el.classList.add("season"); el.dataset.season = art.id; box.hidden = false; } }, { once: true });
    }
    return ok ? art.id : null;
  });
}

/** Muestra el sello desde el principio (y vuelve a mirar qué temporada corresponde: puede haber cambiado el día). */
export function showSplash() {
  el = el || document.getElementById("splash");
  if (!el) return;
  clearTimeout(timer);
  el.classList.remove("out", "gone", "play");
  held = false;
  setStatus();
  applySeason().then(() => {
    void el.offsetWidth; // reinicia las animaciones
    el.classList.add("play");
    shownAt = Date.now();
    audio.playIntro();
    timer = setTimeout(() => { held = true; tryHide(); }, HOLD_MS);
  });
}

/** Lo llama main.js cuando el juego ya arrancó: el indicador pasa a "¡Listo!" y el sello se va al cumplir su tiempo. */
export function markAppReady() {
  const done = () => {
    if (ready) return;
    ready = true;
    setStatus();
    tryHide();
  };
  // también se esperan las tipografías, para que el menú no aparezca con letras cambiando
  const fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  Promise.race([fonts, new Promise((r) => setTimeout(r, 3000))]).then(done, done);
}

export function initSplash() {
  el = document.getElementById("splash");
  if (!el) return;
  // para las pruebas automáticas (?debug3d o ?nosplash) no estorba
  if (/[?&](debug3d|nosplash)\b/.test(location.search)) { el.classList.add("gone"); return; }
  el.addEventListener("pointerdown", () => { if (ready && Date.now() - shownAt >= MIN_TAP_MS) hide(); });
  setTimeout(() => { if (!ready) { ready = true; setStatus(); tryHide(); } }, MAX_WAIT_MS);
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
