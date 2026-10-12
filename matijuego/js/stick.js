// Joystick táctil compartido: todos los juegos con movimiento usan el mismo (círculo + perilla dorada).
// `onChange(x, y)` recibe valores de -1 a 1 (x: derecha +, y: arriba +). Al soltar vuelve a (0, 0).

export function bindStick(joy, onChange) {
  const knob = joy.querySelector(".pk-knob");
  let id = null;
  const set = (e) => {
    const r = joy.getBoundingClientRect();
    let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    let dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const m = Math.hypot(dx, dy);
    if (m > 1) { dx /= m; dy /= m; }
    if (knob) knob.style.transform = `translate(${dx * r.width * 0.3}px, ${dy * r.height * 0.3}px)`;
    onChange(Math.abs(dx) < 0.12 ? 0 : dx, Math.abs(dy) < 0.12 ? 0 : -dy);
  };
  const end = (e) => {
    if (e.pointerId !== id) return;
    id = null;
    if (knob) knob.style.transform = "";
    onChange(0, 0);
  };
  joy.addEventListener("pointerdown", (e) => { e.preventDefault(); id = e.pointerId; joy.setPointerCapture(id); set(e); });
  joy.addEventListener("pointermove", (e) => { if (e.pointerId === id) set(e); });
  joy.addEventListener("pointerup", end);
  joy.addEventListener("pointercancel", end);
}
