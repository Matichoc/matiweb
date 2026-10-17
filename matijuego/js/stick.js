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

  // con la clase "steer" el círculo es un volante: solo gira a los lados (sirve para manejar el auto) y se queda fijo en su esquina
  const steer = () => joy.classList.contains("steer");

  const set = (e) => {
    const r = joy.getBoundingClientRect();
    let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    let dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    if (steer()) {
      dx = Math.max(-1, Math.min(1, dx * 1.25)); // el volante llega al tope antes de llegar al borde
      joy.style.setProperty("--steer", String(dx));
      onChange(Math.abs(dx) < 0.1 ? 0 : dx, 0);
      return;
    }
    const m = Math.hypot(dx, dy);
    if (m > 1) { dx /= m; dy /= m; }
    if (knob) knob.style.transform = `translate(${dx * r.width * 0.3}px, ${dy * r.height * 0.3}px)`;
    onChange(Math.abs(dx) < 0.14 ? 0 : dx, Math.abs(dy) < 0.14 ? 0 : -dy);
  };

  /**
   * Pone el joystick con el centro en el dedo (sin salirse del escenario). Se mueve con transform, así sigue
   * ocupando su lugar y los botones de al lado (Saltar, Impulso) no se corren.
   */
  const moveTo = (e) => {
    joy.style.transform = "";
    const h = joy.getBoundingClientRect();
    const a = area.getBoundingClientRect();
    const w = h.width || 116;
    const x = Math.min(Math.max(e.clientX, a.left + w / 2 + 6), a.right - w / 2 - 6);
    const y = Math.min(Math.max(e.clientY, a.top + w / 2 + 6), a.bottom - w / 2 - 6);
    joy.style.transform = `translate(${x - (h.left + h.width / 2)}px, ${y - (h.top + h.height / 2)}px)`;
  };

  const home = () => {
    joy.style.transform = "";
    joy.classList.remove("on");
  };

  const end = (e) => {
    if (e.pointerId !== id) return;
    id = null;
    if (knob) knob.style.transform = "";
    joy.style.setProperty("--steer", "0");
    home();
    onChange(0, 0);
  };

  const start = (e) => {
    if (id !== null) return; // ya hay un dedo en el joystick
    id = e.pointerId;
    try { e.currentTarget.setPointerCapture?.(id); } catch (err) { /* el puntero ya no está activo */ }
    joy.classList.add("on");
    if (steer()) { /* el volante no se mueve */ }
    else if (e.target !== joy && !joy.contains(e.target)) moveTo(e);
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
    if (steer() || joyMode() !== "float") return;
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
