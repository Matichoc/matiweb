// Modo demo de la versión web (matichoc.cl): los juegos nuevos se pueden probar un poquito y, para seguir,
// hay que descargar la app de Google Play.
//
// Está APAGADO por ahora (la web se deja completa para probar y tentar). Se enciende al compilar la web con
//   MATIJUEGO_DEMO=1 node scripts/build.mjs web      (pone data-demo="1" en <html>)
// La app de Android nunca es demo.

export const IS_DEMO = typeof document !== "undefined" && document.documentElement.dataset.demo === "1";

// Enlace a la ficha de Google Play: está en el HTML, dentro del bloque solo-web (#demo-wall-link), porque la app no lleva
// enlaces externos. Vacío = todavía no publicado.
const playStoreUrl = () => (typeof document !== "undefined" && document.getElementById("demo-wall-link")?.getAttribute("href")) || "";

// Cuánto se puede jugar en la demo, por juego: cantidad de niveles.
export const DEMO_LIMITS = { futbol: 3, dulces: 3, aventura: 2, ciudad: 2 };

// Los modos de un juego comparten límite (Fútbol tiene Penales, Tiros libres y Atajapenales: "futbol_pen", "futbol_tl"...).
const limitKey = (gameId) => (gameId in DEMO_LIMITS ? gameId : String(gameId).split("_")[0]);

/** ¿Se puede jugar este nivel? (fuera de la demo, siempre sí) */
export function demoAllows(gameId, level) {
  const k = limitKey(gameId);
  return !IS_DEMO || !(k in DEMO_LIMITS) || level <= DEMO_LIMITS[k];
}

export function demoLimit(gameId) {
  const k = limitKey(gameId);
  return IS_DEMO && k in DEMO_LIMITS ? DEMO_LIMITS[k] : Infinity;
}

/** Aviso de arriba en la demo de la web: con el enlace a la tienda (solo en la web; la app no lleva enlaces externos). */
export function showDemoBanner() {
  const b = document.getElementById("demo-banner");
  if (!b) return;
  const url = playStoreUrl();
  if (url) {
    b.innerHTML = '🧪 <b>Versión de prueba en la web:</b> algunos juegos traen solo 2 o 3 niveles. ';
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener";
    a.innerHTML = "<b>📲 Descarga el Matijuego completo en Google Play</b>";
    b.appendChild(a);
  }
  b.classList.remove("hidden");
}

/** Muestra el cartel "sigue en la app de Google Play". */
export function showDemoWall() {
  const wall = document.getElementById("demo-wall");
  if (!wall) return;
  const link = wall.querySelector("#demo-wall-link");
  if (playStoreUrl()) {
    link.textContent = "📲 Descargar en Google Play";
    link.classList.remove("disabled");
  } else {
    link.removeAttribute("href");
    link.textContent = "📲 Próximamente en Google Play";
    link.classList.add("disabled");
  }
  wall.classList.remove("hidden");
}
