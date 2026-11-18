// Celebración al ganar un nivel o batir un récord: una lluvia corta de confeti de chocolate sobre la pantalla.
// Son unas pocas piezas de HTML que se mueven con CSS (solo transform y opacidad), así que no carga al juego 3D
// ni en celulares baratos, y se borran solas al terminar. Con "reducir movimiento" activado no se muestra.

const PIEZAS = ["🍫", "⭐", "🍬", "✨", "🍪", "💛"];
const COLORES = ["#ffc800", "#d4216c", "#7a4a2a", "#4fd09a", "#4fb8ff", "#ff8a3d"];

/** Lanza el confeti. `big` = más piezas (récord, todas las estrellas). */
export function celebrate({ big = false } = {}) {
  if (typeof document === "undefined") return;
  try { if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return; } catch (e) { /* sin matchMedia */ }
  document.querySelectorAll(".confetti").forEach((el) => el.remove()); // una sola a la vez
  const layer = document.createElement("div");
  layer.className = "confetti";
  layer.setAttribute("aria-hidden", "true");
  const n = big ? 34 : 20;
  for (let i = 0; i < n; i++) {
    const p = document.createElement("span");
    const emoji = i % 3 === 0;
    p.className = emoji ? "cf cf-emoji" : "cf";
    if (emoji) p.textContent = PIEZAS[i % PIEZAS.length];
    else p.style.background = COLORES[i % COLORES.length];
    p.style.left = `${4 + Math.random() * 92}%`;
    p.style.setProperty("--dx", `${Math.round((Math.random() - 0.5) * 160)}px`);
    p.style.setProperty("--rot", `${Math.round((Math.random() - 0.5) * 900)}deg`);
    p.style.animationDelay = `${(Math.random() * 0.35).toFixed(2)}s`;
    p.style.animationDuration = `${(1.5 + Math.random() * 0.9).toFixed(2)}s`;
    layer.appendChild(p);
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 2800);
}
