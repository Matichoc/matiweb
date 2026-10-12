// Joystick táctil compartido (Recolecta, Parkour y Pueblo): círculo + perilla dorada.
// `onChange(x, y)` recibe valores de -1 a 1 (x: derecha +, y: arriba +). Al soltar vuelve a (0, 0).
//
// Dos modos (se elige en el menú, botón "🕹️ Joystick"):
//  - "float" (por defecto): al tocar la mitad izquierda de la pantalla el joystick aparece justo donde pones el dedo.
//  - "fixed": solo se usa tocando el círculo, que se queda siempre en su esquina.

const KEY = "matichoc_joystick";

export function joyMode() {
  try { return localStorage.getItem(KEY) === "fixed" ? "fixed" : "float"; } catch (e) { return "float"; }
}

export function setJoyMode(mode) {
  try { localStorage.setItem(KEY, mode === "fixed" ? "fixed" : "float"); } catch (e) { /* sin almacenamiento */ }
}

/**
 * @param joy      el círculo del joystick (con un hijo .pk-knob)
 * @param onChange recibe (x, y)
 * @param area     zona donde se puede tocar para que aparezca el joystick (por defecto, el escenario del juego)
 */
export function bindStick(joy, onChange, area = joy.closest(".canvas-wrap") || joy.parentElement) {
  const knob = joy.querySelector(".pk-knob");
  let id = null;

  const set = (e) => {
    const r = joy.getBoundingClientRect();
    let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    let dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const m = Math.hypot(dx, dy);
    if (m > 1) { dx /= m; dy /= m; }
    if (knob) knob.style.transform = `translate(${dx * r.width * 0.3}px, ${dy * r.height * 0.3}px)`;
    onChange(Math.abs(dx) < 0.14 ? 0 : dx, Math.abs(dy) < 0.14 ? 0 : -dy);
  };

  /** Pone el joystick con el centro en el dedo (sin salirse del escenario). */
  const moveTo = (e) => {
    const a = area.getBoundingClientRect();
    const w = joy.offsetWidth || 116;
    const x = Math.min(Math.max(e.clientX, a.left + w / 2 + 6), a.right - w / 2 - 6);
    const y = Math.min(Math.max(e.clientY, a.top + w / 2 + 6), a.bottom - w / 2 - 6);
    joy.style.position = "fixed";
    joy.style.left = `${x - w / 2}px`;
    joy.style.top = `${y - w / 2}px`;
    joy.style.margin = "0";
    joy.style.zIndex = "6";
  };

  const home = () => {
    joy.style.position = joy.style.left = joy.style.top = joy.style.margin = joy.style.zIndex = "";
    joy.classList.remove("on");
  };

  const end = (e) => {
    if (e.pointerId !== id) return;
    id = null;
    if (knob) knob.style.transform = "";
    home();
    onChange(0, 0);
  };

  const start = (e) => {
    if (id !== null) return; // ya hay un dedo en el joystick
    id = e.pointerId;
    e.currentTarget.setPointerCapture?.(id);
    joy.classList.add("on");
    if (e.target !== joy && !joy.contains(e.target)) moveTo(e);
    else if (joyMode() === "float") moveTo(e);
    set(e);
    e.preventDefault();
    e.stopPropagation(); // que no se mueva también la cámara
  };

  // Se escucha en la fase de captura para ganarle al arrastre de cámara del canvas.
  const down = (e) => {
    if (e.pointerType === "mouse" && !joy.contains(e.target)) return;
    if (e.target.closest && e.target.closest("button, .overlay, .town-dialog")) return;
    if (joy.contains(e.target)) return start(e);
    if (joyMode() !== "float") return;
    const a = area.getBoundingClientRect();
    if (e.clientX > a.left + a.width * 0.55) return; // la mitad derecha queda para botones y cámara
    if (e.clientY < a.top + a.height * 0.12) return;
    start(e);
  };
  const move = (e) => { if (e.pointerId === id) set(e); };
  // el escenario, y el propio círculo por si queda fuera del escenario (Recolecta lo tiene en una barra aparte)
  for (const el of area.contains(joy) ? [area] : [area, joy]) {
    el.addEventListener("pointerdown", down, true);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
  }
}
