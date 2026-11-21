// Piezas comunes de los 5 juegos de verano (Torre de alfajores, Avioneta, Lanchas, Minigolf y Billar):
// la playa de fondo, palmeras, alfajores con la foto real, el modo de 2 jugadores por turnos (en el mismo celular)
// y el apuntar arrastrando el dedo (Minigolf y Billar).
// Todo está pensado para celulares de gama media-baja: pocas piezas, geometrías compartidas, una sola luz con sombra
// pequeña (que se apaga sola si el equipo va lento, ver Game3D._qualityDown) y nada de efectos de pantalla completa.

import { THREE, loadTexture, canvasTexture, rand } from "./three-kit.js?v=5545779b2a";

export const BEACH = { sky: 0x8fd3f4, sand: 0xf3d9a4, sea: 0x3fb6d8, seaDeep: 0x2a8fc0 };
export const ALFAJORES = ["alf-frambuesa", "alf-menta", "alf-naranja", "alf-trufa", "alf-pie-limon", "alf-maracuya", "alf-almendra", "alf-capuchino"];

/** Luz de playa: cielo claro y un sol con sombra chica (se apaga sola en equipos lentos). */
export function beachLights(game, { shadow = 9, mapSize = 1024 } = {}) {
  const s = game.scene;
  s.background = new THREE.Color(BEACH.sky);
  s.fog = new THREE.Fog(BEACH.sky, 40, 120);
  const hemi = new THREE.HemisphereLight(0xdff4ff, 0xf2d8b0, 1.35);
  s.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d6, 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(game.coarse ? 512 : mapSize, game.coarse ? 512 : mapSize);
  const sc = sun.shadow.camera;
  sc.left = -shadow; sc.right = shadow; sc.top = shadow; sc.bottom = -shadow; sc.near = 1; sc.far = 80;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.04;
  s.add(sun, sun.target);
  game.onLowQuality = () => { sun.castShadow = false; };
  return { hemi, sun };
}

/**
 * Junta varias piezas (geometría + posición/giro/escala) en UNA sola geometría: así una palmera o un quitasol se dibujan
 * en 1 o 2 pasadas en vez de 10 o 15 (en celulares baratos lo que más pesa es la cantidad de piezas por cuadro).
 */
export function mergeParts(parts) {
  const pos = [], nor = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  for (const { geo, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1] } of parts) {
    const g = (geo.index ? geo.toNonIndexed() : geo.clone());
    m.compose(v.set(...p), q.setFromEuler(e.set(...r)), sc.set(...s));
    g.applyMatrix4(m);
    pos.push(...g.attributes.position.array);
    nor.push(...g.attributes.normal.array);
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  out.computeBoundingSphere();
  return out;
}

const palmMats = {};
const palmGeos = []; // 3 formas de palmera (con distinta inclinación), compartidas por todas
/** Palmera low-poly: 2 piezas (tronco con cocos, y hojas). */
export function makePalm(scale = 1) {
  if (!palmMats.trunk) {
    palmMats.trunk = new THREE.MeshStandardMaterial({ color: 0x9a6b3e, roughness: 0.9, flatShading: true });
    palmMats.leaf = new THREE.MeshStandardMaterial({ color: 0x4fae4a, roughness: 0.8, flatShading: true, side: THREE.DoubleSide });
    const seg = new THREE.CylinderGeometry(0.16, 0.2, 0.7, 6), leafGeo = new THREE.ConeGeometry(0.35, 2.2, 4, 1, true), coco = new THREE.SphereGeometry(0.16, 6, 5);
    for (const lean of [-0.22, 0.05, 0.25]) {
      const trunk = [], leaves = [];
      let y = 0, x = 0;
      for (let i = 0; i < 6; i++) { x += lean * 0.12 * i; trunk.push({ geo: seg, p: [x, y + 0.35, 0], r: [0, 0, -lean * 0.3] }); y += 0.62; }
      for (let i = 0; i < 3; i++) trunk.push({ geo: coco, p: [x + Math.cos(i * 2.1) * 0.22, y - 0.15, Math.sin(i * 2.1) * 0.22] });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        leaves.push({ geo: leafGeo, p: [x + Math.cos(a) * 0.9, y + 0.1, Math.sin(a) * 0.9], r: [Math.sin(a) * 1.25, 0, -Math.cos(a) * 1.25], s: [1, 1, 0.25] });
      }
      palmGeos.push([mergeParts(trunk), mergeParts(leaves)]);
    }
  }
  const [tg, lg] = palmGeos[Math.floor(Math.random() * palmGeos.length)];
  const g = new THREE.Group();
  g.add(new THREE.Mesh(tg, palmMats.trunk), new THREE.Mesh(lg, palmMats.leaf));
  g.rotation.y = rand(0, Math.PI * 2);
  g.scale.setScalar(scale);
  return g;
}

const umbrellaCache = {};
/** Quitasol de playa a rayas (rosado y blanco): 2 piezas. */
export function makeUmbrella(scale = 1, colors = [0xd4216c, 0xfff6e6]) {
  const key = colors.join("-");
  if (!umbrellaCache[key]) {
    const parts = [[], []];
    parts[1].push({ geo: new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), p: [0, 1.2, 0] });
    for (let i = 0; i < 8; i++) parts[i % 2].push({ geo: new THREE.ConeGeometry(1.4, 0.55, 3, 1, true, (i / 8) * Math.PI * 2, Math.PI / 4), p: [0, 2.45, 0] });
    umbrellaCache[key] = parts.map((list, k) => [mergeParts(list), new THREE.MeshStandardMaterial({ color: colors[k], side: THREE.DoubleSide, roughness: 0.7 })]);
  }
  const g = new THREE.Group();
  for (const [geo, mat] of umbrellaCache[key]) g.add(new THREE.Mesh(geo, mat));
  g.scale.setScalar(scale);
  return g;
}

/** Material que no se dibuja (para caras de una pieza que nunca se ven). */
export const HIDDEN = new THREE.MeshBasicMaterial({ visible: false });

let alfTex = null;
let alfSide = null;
/** Materiales de un alfajor: canto de galleta con su capa de manjar al medio, y tapa con la foto real del producto. */
export function alfajorMaterials() {
  if (!alfTex) alfTex = ALFAJORES.map((n) => loadTexture(`assets/products/${n}.jpg`));
  if (!alfSide) {
    alfSide = canvasTexture(64, 64, (g, w, h) => {
      g.fillStyle = "#e3b878"; g.fillRect(0, 0, w, h); // galleta
      g.fillStyle = "#8a4b22"; g.fillRect(0, h * 0.4, w, h * 0.2); // manjar
      g.fillStyle = "rgba(255,255,255,0.18)"; g.fillRect(0, h * 0.05, w, h * 0.08); // brillo del borde
    });
  }
  const side = new THREE.MeshStandardMaterial({ map: alfSide, roughness: 0.75 });
  // la cara de abajo nunca se ve (en la torre está apoyada; las monedas miran a la cámara): no se dibuja
  return alfTex.map((t) => [side, new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }), HIDDEN]);
}

// ---------------------------------------------------------------- 2 jugadores por turnos (Minigolf y Billar)

/**
 * Botón "👤 1 jugador / 👥 2 jugadores" de la tarjeta de inicio y el estado de los turnos.
 * El segundo jugador se llama "Invitado" (no se guarda nada de él: juega en el mismo celular).
 */
export class TwoPlayers {
  constructor(game, btn) {
    this.game = game;
    this.btn = btn;
    this.n = 1;
    this.turn = 0;
    this.scores = [0, 0];
    if (btn) {
      btn.addEventListener("click", () => { this.n = this.n === 1 ? 2 : 1; this.paint(); game.reset(); });
      this.paint();
    }
  }
  get names() { return [this.game.progress.playerName || "Jugador", "Invitado"]; }
  get name() { return this.names[this.turn]; }
  paint() {
    if (!this.btn) return;
    this.btn.textContent = this.n === 1 ? "👤 1 jugador · toca para jugar de a 2" : "👥 2 jugadores por turnos (en este celular)";
    this.btn.setAttribute("aria-pressed", String(this.n === 2));
  }
  reset() { this.turn = 0; this.scores = [0, 0]; }
  next() { if (this.n === 2) this.turn = 1 - this.turn; return this.turn; }
}

// ---------------------------------------------------------------- apuntar arrastrando (Minigolf y Billar)

/**
 * Arrastrar desde cualquier parte de la pantalla: la dirección es la contraria al arrastre (como una honda) y la
 * fuerza es el largo del arrastre. `onAim(dir, power)` mientras se arrastra (power 0..1), `onShoot(dir, power)` al
 * soltar (si el arrastre fue muy corto, se cancela). La dirección se calcula en el plano del suelo (y = planeY).
 */
export function bindDragAim(game, { planeY = 0, maxPx = 220, canAim, onAim, onShoot, onCancel }) {
  const wrap = game.els.wrap;
  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY);
  const ndc = new THREE.Vector2();
  const hit = new THREE.Vector3();
  let start = null; // { x, y, world }
  const toWorld = (cx, cy, out) => {
    const r = wrap.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, game.camera);
    return ray.ray.intersectPlane(plane, out) ? out : null;
  };
  const calc = (e) => {
    const w = toWorld(e.clientX, e.clientY, new THREE.Vector3());
    if (!w || !start.world) return null;
    const dir = start.world.clone().sub(w);
    dir.y = 0;
    const px = Math.hypot(e.clientX - start.x, e.clientY - start.y);
    const power = Math.min(1, px / maxPx);
    if (dir.lengthSq() < 1e-6) return { dir: null, power: 0 };
    return { dir: dir.normalize(), power };
  };
  wrap.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button, .overlay:not(.hidden)")) return;
    if (game.state !== "playing" || (canAim && !canAim())) return;
    start = { x: e.clientX, y: e.clientY, world: toWorld(e.clientX, e.clientY, hit.clone()) };
    try { wrap.setPointerCapture(e.pointerId); } catch (err) { /* nada */ }
  });
  wrap.addEventListener("pointermove", (e) => {
    if (!start) return;
    const a = calc(e);
    if (a && a.dir) onAim(a.dir, a.power);
  });
  const end = (e, cancel) => {
    if (!start) return;
    const a = cancel ? null : calc(e);
    start = null;
    if (a && a.dir && a.power > 0.06) onShoot(a.dir, a.power);
    else onCancel?.();
  };
  wrap.addEventListener("pointerup", (e) => end(e, false));
  wrap.addEventListener("pointercancel", (e) => end(e, true));
}

/** Flecha de apuntar (se estira según la fuerza). */
export function makeAimArrow(color = 0xffc800) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false });
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 1), mat);
  shaft.position.z = 0.5;
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.4, 3), mat);
  head.rotation.x = Math.PI / 2;
  head.position.z = 1.15;
  g.add(shaft, head);
  g.visible = false;
  g.userData = { shaft, head, mat };
  return g;
}

/** Orienta y estira la flecha desde `from`, en la dirección `dir` (y = 0), con largo según `power`. */
export function setAimArrow(arrow, from, dir, power, maxLen = 3) {
  const len = 0.4 + power * maxLen;
  arrow.visible = true;
  arrow.position.copy(from);
  arrow.rotation.set(0, Math.atan2(dir.x, dir.z), 0);
  arrow.userData.shaft.scale.z = len;
  arrow.userData.shaft.position.z = len / 2;
  arrow.userData.head.position.z = len + 0.15;
  arrow.userData.mat.color.setHSL(0.15 - power * 0.15, 1, 0.55); // amarillo → rojo con más fuerza
}
