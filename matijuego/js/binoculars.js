// Binoculares de los mundos abiertos (Pueblo y Ciudad): desde un mirador o la punta de un muelle se mira el horizonte
// con zoom. Mientras miras no te mueves: el joystick (o arrastrar el dedo) gira la vista; + y − acercan y alejan.
// Cada juego llama a apply(camera) en lugar de su cámara de siempre mientras `on` es verdadero.
import { THREE } from "./three-kit.js?v=5e39093371";
import * as audio from "./audio.js?v=5e39093371";

const ZOOMS = [1.8, 2.8, 4.2];
const PITCH = [-0.35, 0.25]; // cuánto se puede mirar hacia abajo y hacia arriba
const SPAN = 1.3; // cuánto se puede girar hacia cada lado desde donde mira el mirador

export class Binoculars {
  constructor(game) {
    this.g = game;
    this.on = false;
    this.el = null;
  }

  /** spot: { x, y, z, yaw } — dónde está el ojo y hacia dónde mira el mirador. */
  open(spot) {
    this.spot = spot;
    this.dyaw = 0;
    this.pitch = -0.04;
    this.zi = 1;
    this.on = true;
    this._dom();
    this.el.classList.remove("hidden");
    this.g.els.wrap.classList.add("binoc-on"); // esconde paneles y avisos del juego mientras miras
    this.g.vel && this.g.vel.set(0, 0, 0);
    audio.playWhoosh?.();
  }

  close() {
    if (!this.on) return;
    this.on = false;
    if (this.el) this.el.classList.add("hidden");
    this.g.els.wrap.classList.remove("binoc-on");
    const cam = this.g.camera;
    cam.fov = this.g.fov;
    cam.updateProjectionMatrix();
    this.g._placeCamera?.(true);
  }

  /** Mueve la vista con el joystick y deja la cámara en el ojo del binocular. */
  apply(cam, dt) {
    const j = this.g.joy || { x: 0, y: 0 };
    const k = (dt || 0.016) * 1.1 / ZOOMS[this.zi];
    this.dyaw = THREE.MathUtils.clamp(this.dyaw - j.x * k * 1.6, -SPAN, SPAN);
    this.pitch = THREE.MathUtils.clamp(this.pitch - j.y * k, PITCH[0], PITCH[1]);
    const s = this.spot;
    const yaw = s.yaw + this.dyaw;
    cam.position.set(s.x, s.y, s.z);
    const cp = Math.cos(this.pitch);
    cam.lookAt(s.x + Math.sin(yaw) * cp * 10, s.y + Math.sin(this.pitch) * 10, s.z + Math.cos(yaw) * cp * 10);
    const fov = this.g.fov / ZOOMS[this.zi];
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov += (fov - cam.fov) * Math.min(1, (dt || 0.016) * 8);
      cam.updateProjectionMatrix();
    }
  }

  _dom() {
    if (this.el) return;
    const wrap = this.g.els.wrap;
    const el = document.createElement("div");
    el.className = "binoc hidden";
    el.innerHTML = '<div class="bn-mask"></div><div class="bn-bar"><button type="button" class="bn-zoom" data-z="-1" aria-label="Alejar">−</button><span class="bn-tip">🔭 Mira el horizonte</span><button type="button" class="bn-zoom" data-z="1" aria-label="Acercar">+</button></div><button type="button" class="bn-exit">✕ Dejar de mirar</button>';
    wrap.appendChild(el);
    el.querySelector(".bn-exit").addEventListener("click", () => this.close());
    el.querySelectorAll(".bn-zoom").forEach((b) => b.addEventListener("click", () => {
      this.zi = THREE.MathUtils.clamp(this.zi + Number(b.dataset.z), 0, ZOOMS.length - 1);
      audio.playPop?.();
    }));
    // arrastrar el dedo (o el mouse) también gira la vista
    const mask = el.querySelector(".bn-mask");
    let drag = null;
    mask.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY }; mask.setPointerCapture?.(e.pointerId); });
    mask.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const z = ZOOMS[this.zi];
      this.dyaw = THREE.MathUtils.clamp(this.dyaw + (e.clientX - drag.x) * 0.004 / z, -SPAN, SPAN);
      this.pitch = THREE.MathUtils.clamp(this.pitch + (e.clientY - drag.y) * 0.004 / z, PITCH[0], PITCH[1]);
      drag = { x: e.clientX, y: e.clientY };
    });
    const end = () => { drag = null; };
    mask.addEventListener("pointerup", end);
    mask.addEventListener("pointercancel", end);
    this.el = el;
  }
}

/** Un binocular de mirador sobre un poste (para muelles y miradores). Devuelve el grupo. */
export function binocularStand() {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x2a7fb5, roughness: 0.4, metalness: 0.3 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xffc800, roughness: 0.3, metalness: 0.5 });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 1.2, 8), metal);
  post.position.y = 0.6;
  const head = new THREE.Group();
  head.position.y = 1.25;
  for (const sx of [-0.13, 0.13]) {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.42, 10), gold);
    tube.rotation.x = Math.PI / 2;
    tube.position.set(sx, 0, 0.05);
    head.add(tube);
  }
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.2, 0.22), metal);
  head.add(box);
  g.add(post, head);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
