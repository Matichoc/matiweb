// Barrios nuevos del Pueblo, más allá de la cerca: el Bosque de cacao, la Granja y el Lago.
// Se llega por un camino con un arco de entrada. Cada barrio se ve descuidado hasta que lo renuevas en la aventura
// (js/adventure.js: cada tarea hecha cambia algo aquí) y cada día tiene cosas para recolectar (mazorcas, huevos y
// conchitas: actividades del día en el panel ✨ y ⭐ para la aventura).
// Rendimiento (teléfonos de gama media-baja): cada barrio se dibuja solo cuando estás cerca, los árboles y cercas van
// agrupados (InstancedMesh) y no hay sombras reales nuevas.

import { THREE, canvasTexture, roundedBox, makeBunting, toonify, disposeTree } from "./three-kit.js?v=4754985988";
import { taskDone, addStars } from "./adventure.js?v=4754985988";
import { earnCoins, saveProgress } from "./storage.js?v=4754985988";
import * as audio from "./audio.js?v=4754985988";
import { binocularStand } from "./binoculars.js?v=4754985988";

const pol = (deg, r) => {
  const a = (deg * Math.PI) / 180;
  return { x: Math.sin(a) * r, z: -Math.cos(a) * r };
};

export const ZONE_R = 27; // radio caminable de cada barrio
const ZONE_DIST = 86; // distancia del centro del pueblo al centro de cada barrio
const GATE_FROM = 46;
const GATE_TO = ZONE_DIST - ZONE_R + 3;
const GATE_HALF = 3; // medio ancho del camino de entrada
const SEE_DIST = 66; // a esta distancia (o menos) del centro del barrio, se dibuja (desde la cerca ya se ve)

/** Los barrios: dónde están, quién vive ahí y qué se recolecta cada día. */
export const ZONE_DEFS = {
  bosque: {
    deg: 25, name: "Bosque de cacao", icon: "🌳", npc: "Guardabosque Maní", ground: 0x5aa84a, sign: "#3d7a2a",
    item: { id: "mazorca", icon: "🍫", name: "mazorcas de cacao", text: "Cosecha las mazorcas del Bosque de cacao" },
    spots: [[-8, 12], [9, 10], [-14, -2], [14, -6], [-6, -18], [7, -20]],
  },
  granja: {
    deg: -84, name: "La Granja", icon: "🐄", npc: "Tía Avellana", ground: 0x9ccf5a, sign: "#b5452a",
    item: { id: "huevo", icon: "🥚", name: "huevos", text: "Junta los huevos de la Granja" },
    spots: [[-4, 14], [6, 16], [-16, 2], [-3, -4], [16, -2], [3, -16]],
  },
  lago: {
    deg: -128, name: "El Lago", icon: "⛵", npc: "Capitán Almendra", ground: 0x8fd17a, sign: "#2a7fb5",
    item: { id: "conchita", icon: "🐚", name: "conchitas", text: "Busca las conchitas del Lago" },
    spots: [[-15, 6], [15, 4], [-20, -8], [20, -10], [-12, -22], [12, -22]],
  },
};
export const ZONE_IDS = Object.keys(ZONE_DEFS);
const ZONE_Y = { bosque: 0.02, granja: 0.035, lago: 0.05 };
const LAKE = { x: 0, z: -8, r: 12.6 }; // el agua del lago (coordenadas del barrio)
const DOCK = { half: 1.3, z: LAKE.z + LAKE.r - 3.5, len: 9 }; // el muelle: ancho 2.6, entra desde la orilla hacia el agua
const DOCK_END = DOCK.z - DOCK.len / 2 + 0.4; // la punta del muelle (más allá es agua)
const CREEK = { z: 2, half: 1.75 }; // el arroyo del bosque (coordenadas del barrio): de lado a lado
const BRIDGE_HALF = 1.5; // el arroyo solo se cruza por el puente (o, antes de arreglarlo, por los tablones del mismo lugar)
const DECK_TOP = 0.48; // sobre el puente y el muelle se camina por encima (bajo 0,5: se sube sin saltar)
// La casita del árbol del bosque (prueba en el celular, 30-oct: "no puedo subir, no puedo interactuar"): una terraza
// arriba, con baranda, a la que se sube por la escalera. Coordenadas del barrio: la casa mira hacia +z.
export const TREE = { porchTop: 4.7, porchZ: -9.1, porchHalfX: 1.7, wallZ: -10, frontZ: -8.2, ladderZ: -8.05, footZ: -7.2 };
const HOME = { x: 3, z: 17 }; // dónde espera el vecino de cada barrio (a la entrada, junto al camino)

/** Centro de un barrio en el mundo. */
export const zoneCenter = (id) => pol(ZONE_DEFS[id].deg, ZONE_DIST);

/** Lugares de los barrios para la aventura (flecha guía, "Llévame", casa de cada vecino). */
export function zonePlaces() {
  const out = {};
  for (const id of ZONE_IDS) {
    const d = ZONE_DEFS[id];
    const c = zoneCenter(id);
    const home = toWorld(id, HOME.x, HOME.z);
    out[id] = { deg: d.deg, x: c.x, z: c.z, r: ZONE_R, npc: d.npc, home, name: d.name };
  }
  return out;
}

/** De coordenadas del barrio (x a lo ancho, +z hacia el pueblo) a coordenadas del mundo. */
function toWorld(id, lx, lz) {
  const a = (ZONE_DEFS[id].deg * Math.PI) / 180;
  const c = zoneCenter(id);
  // el grupo del barrio gira -a: su -z local apunta hacia afuera del pueblo
  return { x: c.x + lx * Math.cos(a) - lz * Math.sin(a), z: c.z + lx * Math.sin(a) + lz * Math.cos(a) };
}
function toLocal(id, x, z) {
  const a = (ZONE_DEFS[id].deg * Math.PI) / 180;
  const c = zoneCenter(id);
  const dx = x - c.x;
  const dz = z - c.z;
  return { x: dx * Math.cos(a) + dz * Math.sin(a), z: -dx * Math.sin(a) + dz * Math.cos(a) };
}

const std = (color, rough = 0.7, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });

function signTexture(text, color) {
  return canvasTexture(512, 128, (g, w, h) => {
    g.fillStyle = color;
    g.beginPath(); g.roundRect(6, 6, w - 12, h - 12, 28); g.fill();
    g.lineWidth = 6; g.strokeStyle = "#ffc800"; g.stroke();
    g.fillStyle = "#fff6e6";
    g.font = '56px "Baby Chipmunk", "Fredoka", sans-serif';
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(text, w / 2, h / 2 + 4, w - 40);
  });
}

export class TownZones {
  constructor(town) {
    this.g = town;
    this.groups = {}; // barrio → grupo con lo que depende de la aventura (se rearma al avanzar)
    this.bases = {}; // barrio → grupo fijo (suelo, árboles, cerca)
    this.items = []; // cosas para recolectar hoy: { zone, idx, mesh, x, z }
    this.colliders = {}; // barrio → colisionadores que dependen de la aventura
    this.t = 0;
  }

  get progress() { return this.g.progress; }

  /** Estado del día (se reinicia con progress.town): qué recolectaste en cada barrio. */
  st() {
    const d = this.g._daily();
    if (!d.zones || typeof d.zones !== "object") d.zones = {};
    for (const id of ZONE_IDS) if (!Array.isArray(d.zones[id])) d.zones[id] = [];
    return d.zones;
  }

  // ---------- dónde se puede caminar ----------

  /** ¿Se puede estar en (x, z)? El pueblo, los caminos de entrada y los barrios (menos el agua del lago). */
  inside(x, z, worldR) {
    if (Math.hypot(x, z) <= worldR) return true;
    for (const id of ZONE_IDS) {
      const l = toLocal(id, x, z);
      const r = Math.hypot(l.x, l.z);
      if (r <= ZONE_R) {
        if (id === "lago" && Math.hypot(l.x - LAKE.x, l.z - LAKE.z) < LAKE.r) {
          // al agua no se entra; por el muelle sí (cuando está arreglado)
          return taskDone(this.progress, "lago.muelle") && Math.abs(l.x) < DOCK.half && l.z > DOCK_END; // antes llegaba 6 m más allá de la punta
        }
        if (id === "bosque" && Math.abs(l.z - CREEK.z) < CREEK.half && Math.abs(l.x) >= BRIDGE_HALF) return false; // al arroyo no se entra
        return true;
      }
      // el camino de entrada: de la cerca del pueblo hasta el barrio
      const a = (ZONE_DEFS[id].deg * Math.PI) / 180;
      const along = x * Math.sin(a) - z * Math.cos(a);
      const across = x * Math.cos(a) + z * Math.sin(a);
      if (along >= GATE_FROM && along <= GATE_TO && Math.abs(across) <= GATE_HALF) return true;
    }
    return false;
  }

  /** ¿(x, z) está en un camino de entrada (o a `pad` de él)? Para que no crezcan árboles encima. */
  nearGate(x, z, pad = 0) {
    return ZONE_IDS.some((id) => {
      const a = (ZONE_DEFS[id].deg * Math.PI) / 180;
      const along = x * Math.sin(a) - z * Math.cos(a);
      const across = x * Math.cos(a) + z * Math.sin(a);
      return along >= GATE_FROM - pad && along <= GATE_TO + pad && Math.abs(across) <= GATE_HALF + pad;
    });
  }

  /** ¿Este ángulo de la cerca del pueblo es una entrada? (ahí no van postes). */
  isGate(deg) {
    return ZONE_IDS.some((id) => {
      let d = Math.abs(((deg - ZONE_DEFS[id].deg) % 360 + 540) % 360 - 180);
      return d < 4.5;
    });
  }

  /** Antes de los árboles del pueblo: aparta los caminos de entrada (para que no crezca nada encima). */
  buildWorld() {
    for (const id of ZONE_IDS) {
      // solo afuera de la cerca: adentro el camino puede pasar bajo las nubes del parkour (flotan), sin quitarles su lugar
      // (los árboles igual se apartan del camino: ver nearGate)
      for (let r = 58; r <= GATE_TO + 4; r += 4) {
        const p = pol(ZONE_DEFS[id].deg, r);
        this.g.fun.claimed.push({ x: p.x, z: p.z, r: 4.5 });
      }
    }
  }

  // ---------- armar los barrios ----------

  build() {
    const s = this.g.scene;
    // caminos de entrada con su arco
    const pathMat = std(0xe9d2a2, 0.9);
    for (const id of ZONE_IDS) {
      const d = ZONE_DEFS[id];
      const a = (d.deg * Math.PI) / 180;
      const mid = pol(d.deg, (GATE_FROM + GATE_TO) / 2);
      const path = new THREE.Mesh(new THREE.BoxGeometry(GATE_HALF * 2 - 0.6, 0.2, GATE_TO - GATE_FROM + 4), pathMat);
      path.position.set(mid.x, 0.03, mid.z);
      path.rotation.y = -a;
      path.receiveShadow = true;
      s.add(path);
      const arch = new THREE.Group();
      const at = pol(d.deg, 55);
      arch.position.set(at.x, 0, at.z);
      arch.rotation.y = -a;
      for (const sx of [-GATE_HALF, GATE_HALF]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 4.4, 8), this.g.m.choco);
        post.position.set(sx, 2.2, 0);
        arch.add(post);
      }
      // el cartel se lee de los dos lados (al entrar y al volver al pueblo)
      const signMat = new THREE.MeshBasicMaterial({ map: signTexture(`${d.icon} ${d.name}`, d.sign), transparent: true });
      for (const back of [0, 1]) {
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 1.65), signMat);
        sign.position.set(0, 4.5, 0);
        sign.rotation.y = back ? Math.PI : 0;
        arch.add(sign);
      }
      s.add(arch);
      this.g.colliders.push(...[-GATE_HALF, GATE_HALF].map((sx) => { const w = pol(d.deg, 55); return { type: "c", x: w.x + Math.cos(a) * sx, z: w.z + Math.sin(a) * sx, r: 0.35 }; }));
    }
    for (const id of ZONE_IDS) this._buildBase(id);
    this._buildItems();
    this.refresh();
  }

  _group(id) {
    const c = zoneCenter(id);
    const grp = new THREE.Group();
    grp.position.set(c.x, 0, c.z);
    grp.rotation.y = (-ZONE_DEFS[id].deg * Math.PI) / 180;
    return grp;
  }

  _mesh(grp, geo, mat, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    grp.add(m);
    return m;
  }

  /** Lo fijo de un barrio: suelo, cerca (con la entrada abierta), árboles y su cartel. */
  _buildBase(id) {
    const d = ZONE_DEFS[id];
    const grp = this._group(id);
    // cada barrio a su altura: los suelos de barrios vecinos se tocan y a la misma altura parpadean en el celular
    const ground = this._mesh(grp, new THREE.CircleGeometry(ZONE_R + 5, 40), std(d.ground, 0.95), 0, ZONE_Y[id], 0);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    // cerca alrededor (sin postes en la entrada, que mira al pueblo: +z)
    const posts = [];
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      const x = Math.sin(a) * (ZONE_R + 1.2);
      const z = Math.cos(a) * (ZONE_R + 1.2);
      if (z > 0 && Math.abs(x) < GATE_HALF + 0.5) continue;
      posts.push([x, z]);
    }
    const fence = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.2, 1.3, 6), this.g.m.cream, posts.length);
    const m4 = new THREE.Matrix4();
    posts.forEach(([x, z], i) => { m4.makeTranslation(x, 0.65, z); fence.setMatrixAt(i, m4); });
    grp.add(fence);
    let seed = { bosque: 3, granja: 5, lago: 9 }[id];
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    if (id === "bosque") {
      // arroyo que cruza el bosque
      const water = this._mesh(grp, new THREE.PlaneGeometry(ZONE_R * 2 + 6, 3.4), std(0x5ab8e8, 0.2, { metalness: 0.1, emissive: 0x1a5a8a, emissiveIntensity: 0.25 }), 0, 0.06, 2);
      water.rotation.x = -Math.PI / 2;
      // cacaotales: troncos, copas y mazorcas, todos agrupados (3 dibujos)
      const spots = [];
      for (let i = 0; i < 46; i++) {
        const a = rnd() * Math.PI * 2;
        const r = 6 + rnd() * (ZONE_R - 7);
        const x = Math.sin(a) * r;
        const z = Math.cos(a) * r;
        if (Math.abs(x) < 4.5 || Math.abs(z - 2) < 3.2 || Math.hypot(x, z + 14) < 7 || Math.hypot(x - HOME.x, z - HOME.z) < 7 || d.spots.some(([sx, sz]) => Math.hypot(x - sx, z - sz) < 3)) continue; // sendero, arroyo, árbol grande, el guardabosque y las mazorcas del día
        spots.push([x, z, 0.8 + rnd() * 0.5]);
      }
      const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.35, 2.6, 6), std(0x6b3a1e), spots.length);
      const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.9, 0), std(0x3f9a4a, 0.85), spots.length);
      const pods = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 8, 6), std(0xd9822b, 0.5), spots.length * 2);
      const o = new THREE.Object3D();
      spots.forEach(([x, z, s], i) => {
        o.position.set(x, 1.3 * s, z); o.scale.setScalar(s); o.rotation.set(0, 0, 0); o.updateMatrix(); trunks.setMatrixAt(i, o.matrix);
        o.position.set(x, 3.3 * s, z); o.rotation.set(0, i, 0); o.updateMatrix(); crowns.setMatrixAt(i, o.matrix);
        for (const k of [0, 1]) { o.position.set(x + (k ? 0.36 : -0.34) * s, 1.4 * s, z + 0.2); o.scale.set(s, s * 1.5, s); o.updateMatrix(); pods.setMatrixAt(i * 2 + k, o.matrix); }
        this.g.colliders.push({ type: "c", ...toWorld(id, x, z), r: 0.45 * s });
      });
      grp.add(trunks, crowns, pods);
      // el árbol grande del fondo (ahí va la casita)
      this._mesh(grp, new THREE.CylinderGeometry(0.9, 1.3, 7, 10), std(0x5a2e14), 0, 3.5, -14);
      this._mesh(grp, new THREE.IcosahedronGeometry(4.6, 1), std(0x2f8a3e, 0.85), 0, 8.4, -14);
      this.g.colliders.push({ type: "c", ...toWorld(id, 0, -14), r: 1.4 });
    } else if (id === "granja") {
      // campos de cultivo al fondo (franjas)
      const rows = new THREE.InstancedMesh(new THREE.BoxGeometry(2.4, 0.5, 14), std(0x8a5a2a, 0.95), 7);
      const o = new THREE.Object3D();
      for (let i = 0; i < 7; i++) { o.position.set(-10 + i * 3.3, 0.25, -20); o.updateMatrix(); rows.setMatrixAt(i, o.matrix); }
      grp.add(rows);
      const wheat = new THREE.InstancedMesh(new THREE.ConeGeometry(0.35, 1.3, 5), std(0xf2c94c, 0.8), 42);
      for (let i = 0; i < 42; i++) { o.position.set(-10 + (i % 7) * 3.3 + (rnd() - 0.5) * 0.6, 1.1, -26 + Math.floor(i / 7) * 2.3); o.updateMatrix(); wheat.setMatrixAt(i, o.matrix); }
      grp.add(wheat);
      // camino de tierra
      this._mesh(grp, new THREE.BoxGeometry(4, 0.1, ZONE_R + 4), std(0xd9b27a, 0.95), 0, 0.05, 10);
      // algunos árboles frutales
      const tr = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.6, 0), std(0x6cc04a, 0.85), 8);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.3; o.position.set(Math.sin(a) * 23, 2.6, Math.cos(a) * 23 - 1); o.updateMatrix(); tr.setMatrixAt(i, o.matrix); if (Math.cos(a) * 23 - 1 < 18) this.g.colliders.push({ type: "c", ...toWorld(id, Math.sin(a) * 23, Math.cos(a) * 23 - 1), r: 0.6 }); }
      grp.add(tr);
    } else {
      // el lago: arena alrededor y agua
      this._mesh(grp, new THREE.CircleGeometry(LAKE.r + 3, 40), std(0xf2dca0, 0.95), LAKE.x, 0.065, LAKE.z).rotation.x = -Math.PI / 2;
      const water = this._mesh(grp, new THREE.CircleGeometry(LAKE.r, 40), std(0x4fb3e8, 0.15, { metalness: 0.15, emissive: 0x13507a, emissiveIntensity: 0.3 }), LAKE.x, 0.085, LAKE.z);
      water.rotation.x = -Math.PI / 2;
      this.water = water;
      // juncos y piedras en la orilla
      const reeds = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.08, 1.4, 4), std(0x4a8a3a), 30);
      const o = new THREE.Object3D();
      for (let i = 0; i < 30; i++) { const a = rnd() * Math.PI * 2; const r = LAKE.r + 0.6 + rnd() * 1.2; o.position.set(LAKE.x + Math.sin(a) * r, 0.7, LAKE.z + Math.cos(a) * r); o.rotation.z = (rnd() - 0.5) * 0.4; o.updateMatrix(); reeds.setMatrixAt(i, o.matrix); }
      grp.add(reeds);
      const pines = new THREE.InstancedMesh(new THREE.ConeGeometry(1.5, 4.2, 7), std(0x2f7a4a, 0.9), 12);
      for (let i = 0; i < 12; i++) { const a = Math.PI * 0.55 + (i / 11) * Math.PI * 0.9 + (i % 2) * 0.05; const x = Math.sin(a) * 24; const z = Math.cos(a) * 24; o.position.set(x, 2.1, z); o.rotation.set(0, 0, 0); o.updateMatrix(); pines.setMatrixAt(i, o.matrix); }
      grp.add(pines);
    }
    if (this.g.kawaii) toonify(grp);
    grp.userData.zone = id;
    this.g.scene.add(grp);
    this.bases[id] = grp;
  }

  // ---------- lo que cambia con la aventura ----------

  refresh() {
    for (const id of ZONE_IDS) this._zone(id);
  }

  /** Pisos elevados (puente y muelle) para la gravedad del Pueblo: { x, z, top, r } como las plataformas de parkour. */
  get decks() {
    return Object.values(this._decks || {}).flat();
  }

  /** La casita del árbol (si ya se construyó): puntos en el mundo para la escalera y la puerta. Si no, null. */
  get treehouse() {
    if (!this._treeOn) return null;
    const w = (x, z) => toWorld("bosque", x, z);
    const T = TREE;
    return {
      foot: w(0, T.footZ), // al pie de la escalera
      face: w(0, T.ladderZ + 0.35), // pegado a la escalera
      top: w(0, T.frontZ - 0.55), // arriba, en la terraza junto a la escalera
      door: w(0, T.wallZ + 0.45), // frente a la puerta
      porchTop: T.porchTop,
      yaw: Math.atan2(w(0, -1).x - w(0, 0).x, w(0, -1).z - w(0, 0).z), // mirando hacia la casa
    };
  }

  /** Arriba en la terraza no se cae: la baranda la rodea (se baja por la escalera). */
  clampPorch(p) {
    if (!this._treeOn || p.y < TREE.porchTop - 0.6) return;
    const l = toLocal("bosque", p.x, p.z);
    if (Math.abs(l.x) > 3.5 || l.z < TREE.wallZ - 1.5 || l.z > TREE.frontZ + 1.5) return;
    const x = Math.min(TREE.porchHalfX - 0.35, Math.max(-(TREE.porchHalfX - 0.35), l.x));
    const z = Math.min(TREE.frontZ - 0.3, Math.max(TREE.wallZ + 0.3, l.z));
    const w = toWorld("bosque", x, z);
    p.x = w.x;
    p.z = w.z;
  }

  /** Lugares con binoculares: { x, z, eye: { x, y, z, yaw } } en coordenadas del mundo. */
  get binocSpots() {
    return Object.values(this._binoc || {}).flat();
  }

  _setBinoc(id, list) {
    this._binoc = this._binoc || {};
    const a = (ZONE_DEFS[id].deg * Math.PI) / 180;
    this._binoc[id] = list.map(({ at, eye, y, look }) => {
      const w = toWorld(id, at[0], at[1]);
      const e = toWorld(id, eye[0], eye[1]);
      // la dirección local (look) girada como el barrio
      const dx = look[0] * Math.cos(a) - look[1] * Math.sin(a);
      const dz = look[0] * Math.sin(a) + look[1] * Math.cos(a);
      return { x: w.x, z: w.z, eye: { x: e.x, y, z: e.z, yaw: Math.atan2(dx, dz) } };
    });
  }

  _setDecks(id, list) {
    this._decks = this._decks || {};
    this._decks[id] = list.map(([lx, lz, r, top]) => ({ ...toWorld(id, lx, lz), top: top ?? DECK_TOP, r }));
  }

  _flags(id) {
    const t = (k) => (taskDone(this.progress, `${id}.${k}`) ? 1 : 0);
    if (id === "bosque") return { sendero: t("sendero"), puente: t("puente"), casita: t("casita"), luces: t("luces") };
    if (id === "granja") return { granero: t("granero"), molino: t("molino"), huerto: t("huerto"), corral: t("corral") };
    return { muelle: t("muelle"), botes: t("botes"), mirador: t("mirador"), fuegos: t("fuegos") };
  }

  _zone(id) {
    const f = this._flags(id);
    const key = JSON.stringify(f);
    const old = this.groups[id];
    if (old && old.userData.key === key) return;
    const prev = old ? old.userData.flags : null;
    if (old) { this.g.scene.remove(old); disposeTree(old); }
    for (const c of this.colliders[id] || []) { const i = this.g.colliders.indexOf(c); if (i >= 0) this.g.colliders.splice(i, 1); }
    this.colliders[id] = [];
    const grp = this._group(id);
    grp.userData.key = key;
    grp.userData.flags = f;
    grp.userData.zone = id;
    this.pops = this.pops || [];
    const mark = (obj, flag) => { if (prev && !prev[flag] && f[flag]) this.pops.push({ obj, t: 0 }); }; // lo recién hecho aparece con un salto
    const col = (lx, lz, r) => { const c = { type: "c", ...toWorld(id, lx, lz), r }; this.g.colliders.push(c); this.colliders[id].push(c); };
    if (id === "bosque") this._bosque(grp, f, mark, col);
    else if (id === "granja") this._granja(grp, f, mark, col);
    else this._lago(grp, f, mark, col);
    // se camina por encima del puente y del muelle (círculos que cubren la tabla)
    if (id === "bosque") {
      const decks = f.puente ? [0.4, 1.47, 2.53, 3.6].map((z) => [0, z, 1.2]) : [];
      if (f.casita) for (const [x, z] of [[-0.9, -9.1], [0.9, -9.1], [0, -8.75], [0, -9.45]]) decks.push([x, z, 0.95, TREE.porchTop]); // la terraza de la casita (cubierta entera)
      this._setDecks(id, decks);
      this._treeOn = !!f.casita;
    }
    if (id === "lago") this._setDecks(id, f.muelle ? [-2.8, -1.6, -0.4, 0.8, 2, 3.2, 4.4].map((z) => [0, z, 1.25]) : []);
    // binoculares: en la punta del muelle (mirando el lago) y desde arriba del mirador
    if (id === "lago") this._setBinoc(id, [
      ...(f.muelle ? [{ at: [0, DOCK_END + 1.2], eye: [0, DOCK_END - 0.2], y: 2.2, look: [0, -1] }] : []),
      ...(f.mirador ? [{ at: [-17 + 2.6, 2], eye: [-17, 2], y: 6.4, look: [17, -10] }] : []),
    ]);
    if (this.g.kawaii) toonify(grp);
    this.g.scene.add(grp);
    this.groups[id] = grp;
  }

  _bosque(grp, f, mark, col) {
    if (!f.sendero) {
      // troncos caídos y arbustos tapando el sendero
      [[0.5, 16, 0.4], [-0.8, 9, -0.3], [0.6, -6, 0.2]].forEach(([x, z, r]) => { const m = this._mesh(grp, new THREE.CylinderGeometry(0.4, 0.45, 4.2, 8), std(0x6b3a1e), x, 0.4, z); m.rotation.set(0, r, Math.PI / 2); });
      for (const [x, z] of [[-1.6, 13], [1.8, 4], [-1.2, -9]]) this._mesh(grp, new THREE.IcosahedronGeometry(1, 0), std(0x3f7a2a, 0.9), x, 0.7, z);
    } else {
      const path = new THREE.Group();
      this._mesh(path, new THREE.BoxGeometry(3.2, 0.08, 24), std(0xd9b27a, 0.95), 0, 0.06, 12);
      this._mesh(path, new THREE.BoxGeometry(3.2, 0.08, 9), std(0xd9b27a, 0.95), 0, 0.06, -6);
      const stones = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.35, 0.4, 0.1, 7), std(0xbfb3a0, 0.9), 14);
      const o = new THREE.Object3D();
      for (let i = 0; i < 14; i++) { o.position.set((i % 2 ? 1 : -1) * 0.7, 0.12, 22 - i * 1.6 - (i > 10 ? 4 : 0)); o.updateMatrix(); stones.setMatrixAt(i, o.matrix); }
      path.add(stones);
      grp.add(path);
      mark(path, "sendero");
    }
    // el puente sobre el arroyo
    if (!f.puente) {
      for (const [x, r] of [[-1.2, 0.3], [1.1, -0.4]]) { const p = this._mesh(grp, new THREE.BoxGeometry(0.5, 0.12, 2.2), std(0x8a5a2a), x, 0.15, 2.4); p.rotation.y = r; }
    } else {
      const br = new THREE.Group();
      this._mesh(br, roundedBox(3.4, 0.25, 5, 0.06), std(0xa8743a, 0.7), 0, 0.45, 2);
      for (const sx of [-1.6, 1.6]) {
        this._mesh(br, new THREE.BoxGeometry(0.12, 0.12, 5), std(0x7a4a22), sx, 1.4, 2);
        for (const z of [-0.2, 2, 4.2]) this._mesh(br, new THREE.CylinderGeometry(0.08, 0.08, 1, 6), std(0x7a4a22), sx, 0.95, z);
      }
      grp.add(br);
      mark(br, "puente");
    }
    // la casita del árbol grande
    if (f.casita) {
      const h = new THREE.Group();
      this._mesh(h, roundedBox(4.4, 3, 4, 0.12), std(0xc9844a, 0.7), 0, 6.2, -12);
      const roof = this._mesh(h, new THREE.ConeGeometry(3.6, 2.2, 4), std(0xd4216c, 0.6), 0, 8.8, -12);
      roof.rotation.y = Math.PI / 4;
      this._mesh(h, new THREE.BoxGeometry(1.1, 1.6, 0.1), std(0x5a2e14), 0, 5.6, -9.95);
      this._mesh(h, new THREE.BoxGeometry(0.9, 0.9, 0.1), std(0xbfe6ff, 0.2), 1.4, 6.6, -9.95);
      // la terraza (se camina encima) con su baranda, y la escalera para subir
      const T = TREE;
      const wood = std(0xa8743a, 0.7);
      const dark = std(0x7a4a22);
      this._mesh(h, roundedBox(T.porchHalfX * 2, 0.2, T.frontZ - T.wallZ, 0.05), wood, 0, T.porchTop - 0.1, T.porchZ);
      for (const sx of [-1, 1]) {
        this._mesh(h, new THREE.BoxGeometry(0.1, 0.1, T.frontZ - T.wallZ), dark, sx * (T.porchHalfX - 0.05), T.porchTop + 0.8, T.porchZ);
        this._mesh(h, new THREE.BoxGeometry(0.1, 0.1, 1.15), dark, sx * 1.15, T.porchTop + 0.8, T.frontZ + 0.02);
        for (const z of [T.wallZ + 0.1, T.frontZ]) this._mesh(h, new THREE.CylinderGeometry(0.06, 0.06, 0.8, 6), dark, sx * (T.porchHalfX - 0.05), T.porchTop + 0.4, z);
        this._mesh(h, new THREE.CylinderGeometry(0.06, 0.06, 0.8, 6), dark, sx * 0.6, T.porchTop + 0.4, T.frontZ);
      }
      for (let i = 0; i < 9; i++) this._mesh(h, new THREE.BoxGeometry(1, 0.1, 0.1), dark, 0, 0.45 + i * 0.52, T.ladderZ);
      for (const sx of [-0.5, 0.5]) this._mesh(h, new THREE.BoxGeometry(0.1, T.porchTop + 0.9, 0.1), dark, sx, (T.porchTop + 0.9) / 2, T.ladderZ);
      grp.add(h);
      mark(h, "casita");
    }
    if (f.luces) {
      const lights = new THREE.Group();
      const cols = [0xffe14a, 0xff6fb0, 0x6fd8ff, 0xb9ff6a];
      const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), 24);
      const o = new THREE.Object3D();
      const c = new THREE.Color();
      for (let i = 0; i < 24; i++) { const side = i % 2 ? 1 : -1; o.position.set(side * 2.4, 2.4 + Math.sin(i) * 0.2, 22 - Math.floor(i / 2) * 2.2); o.updateMatrix(); bulbs.setMatrixAt(i, o.matrix); bulbs.setColorAt(i, c.setHex(cols[i % 4])); }
      lights.add(bulbs);
      bulbs.userData.noToon = true;
      grp.add(lights);
      mark(lights, "luces");
    }
    col(0, -14, 1.4);
  }

  _granja(grp, f, mark, col) {
    // el granero
    const barn = new THREE.Group();
    barn.position.set(-11, 0, -7);
    const wall = f.granero ? 0xd23a2a : 0x8a7a70;
    this._mesh(barn, roundedBox(8, 5, 7, 0.1), std(wall, 0.75), 0, 2.5, 0);
    const roof = this._mesh(barn, new THREE.CylinderGeometry(4.2, 4.2, 7.4, 3, 1), std(f.granero ? 0x5a2a1a : 0x5a5450, 0.7), 0, 5.6, 0);
    roof.rotation.set(Math.PI / 2, 0, Math.PI / 2);
    roof.scale.set(1, 1, 0.6);
    if (f.granero) {
      this._mesh(barn, new THREE.BoxGeometry(3, 3.4, 0.12), std(0xfff6e6, 0.6), 0, 1.7, 3.52);
      for (const r of [0.85, -0.85]) { const x = this._mesh(barn, new THREE.BoxGeometry(0.2, 4.4, 0.06), std(0xd23a2a), 0, 1.7, 3.6); x.rotation.z = r; }
    } else {
      this._mesh(barn, new THREE.BoxGeometry(1.4, 1.2, 0.1), std(0x2a1810), 1.8, 4, 3.52); // agujero
      roof.rotation.y = 0.15; // techo chueco
    }
    grp.add(barn);
    mark(barn, "granero");
    col(-11, -7, 4.6);
    // el molino
    const mill = new THREE.Group();
    mill.position.set(12, 0, -10);
    this._mesh(mill, new THREE.CylinderGeometry(1.4, 2.2, 8, 8), std(0xf3e2c4, 0.8), 0, 4, 0);
    this._mesh(mill, new THREE.ConeGeometry(2, 2, 8), std(0x8a3a22, 0.7), 0, 9, 0);
    const blades = new THREE.Group();
    blades.position.set(0, 7.5, 1.9);
    const n = f.molino ? 4 : 2;
    for (let i = 0; i < n; i++) { const b = this._mesh(blades, new THREE.BoxGeometry(0.7, 4.6, 0.08), std(f.molino ? 0xfff6e6 : 0x9a8f86, 0.7), 0, 2.3, 0); const piv = new THREE.Group(); piv.rotation.z = (i / n) * Math.PI * 2 + (f.molino ? 0 : 0.6); piv.add(b); blades.add(piv); }
    mill.add(blades);
    this.mill = f.molino ? blades : null;
    grp.add(mill);
    mark(mill, "molino");
    col(12, -10, 2.4);
    // el huerto
    if (f.huerto) {
      const h = new THREE.Group();
      this._mesh(h, new THREE.BoxGeometry(9, 0.3, 7), std(0x6b3f1e, 0.95), 10, 0.15, 7);
      const carrots = new THREE.InstancedMesh(new THREE.ConeGeometry(0.18, 0.6, 6), std(0xff7a1a, 0.5), 15);
      const leaves = new THREE.InstancedMesh(new THREE.SphereGeometry(0.42, 8, 6), std(0x4fbf4a, 0.7), 15);
      const o = new THREE.Object3D();
      for (let i = 0; i < 15; i++) {
        const x = 6.6 + (i % 5) * 1.7;
        const z = 4.6 + Math.floor(i / 5) * 2.4;
        o.position.set(x, 0.5, z); o.rotation.set(Math.PI, 0, 0); o.scale.setScalar(1); o.updateMatrix(); carrots.setMatrixAt(i, o.matrix);
        o.position.set(x + 0.8, 0.55, z); o.rotation.set(0, 0, 0); o.scale.set(1, 0.6, 1); o.updateMatrix(); leaves.setMatrixAt(i, o.matrix);
      }
      h.add(carrots, leaves);
      grp.add(h);
      mark(h, "huerto");
    } else {
      for (const [x, z] of [[8, 6], [11.5, 8], [9.5, 4]]) this._mesh(grp, new THREE.CylinderGeometry(1.1, 1.2, 0.15, 10), std(0x8a6a3a, 0.95), x, 0.08, z);
    }
    // el corral con animales
    const pen = new THREE.Group();
    pen.position.set(-11, 0, 9);
    const rails = f.corral ? 16 : 6;
    for (let i = 0; i < rails; i++) {
      const a = (i / 16) * Math.PI * 2;
      const p = this._mesh(pen, new THREE.CylinderGeometry(0.1, 0.12, 1.2, 6), std(0xfff6e6), Math.sin(a) * 4.5, 0.6, Math.cos(a) * 4.5);
      if (!f.corral) p.rotation.z = 0.5;
    }
    if (f.corral) {
      const rail = this._mesh(pen, new THREE.TorusGeometry(4.5, 0.07, 5, 32), std(0xfff6e6), 0, 1, 0);
      rail.rotation.x = Math.PI / 2;
      [[-1.5, -0.8, 0xffffff], [1.4, 1, 0xffffff], [0.2, -2, 0x3a2a22]].forEach(([x, z, c], i) => {
        const an = new THREE.Group();
        an.position.set(x, 0, z);
        an.rotation.y = i * 1.7;
        this._mesh(an, new THREE.SphereGeometry(0.75, 10, 8), std(c, 0.95), 0, 0.9, 0).scale.set(1.3, 0.9, 0.9);
        this._mesh(an, new THREE.SphereGeometry(0.4, 8, 6), std(c === 0xffffff ? 0xf2d6c4 : 0x2a1a12, 0.9), 0.95, 1.05, 0);
        for (const [lx, lz] of [[-0.5, -0.35], [-0.5, 0.35], [0.5, -0.35], [0.5, 0.35]]) this._mesh(an, new THREE.CylinderGeometry(0.1, 0.1, 0.5, 5), std(0x2a1a12), lx, 0.25, lz);
        pen.add(an);
      });
    }
    grp.add(pen);
    mark(pen, "corral");
  }

  _lago(grp, f, mark, col) {
    // el muelle
    const dock = new THREE.Group();
    if (f.muelle) {
      this._mesh(dock, roundedBox(DOCK.half * 2, 0.2, DOCK.len, 0.05), std(0xa8743a, 0.7), 0, 0.45, DOCK.z);
      const stand = binocularStand(); // binoculares en la punta, mirando el lago
      stand.position.set(0, 0.55, DOCK_END + 0.1);
      stand.rotation.y = Math.PI;
      dock.add(stand);
      for (const z of [-1, 1.6, 4.2]) for (const sx of [-1.2, 1.2]) this._mesh(dock, new THREE.CylinderGeometry(0.12, 0.12, 1, 6), std(0x6b3a1e), sx, 0.3, DOCK.z + z);
    } else {
      for (const [x, z] of [[-1, 4], [1.1, 3], [-0.9, 1.5]]) this._mesh(dock, new THREE.CylinderGeometry(0.12, 0.12, 0.9, 6), std(0x6b3a1e), x, 0.3, z);
      const plank = this._mesh(dock, new THREE.BoxGeometry(2.2, 0.1, 0.5), std(0x8a5a2a), 0.4, 0.12, 6.5);
      plank.rotation.y = 0.6;
    }
    grp.add(dock);
    mark(dock, "muelle");
    // los botes
    this.boats = [];
    const boatCols = f.botes ? [0xff5f9e, 0x4fb3ff, 0xffd34d] : [0x8a8078, 0x8a8078];
    boatCols.forEach((c, i) => {
      const b = new THREE.Group();
      const onWater = f.botes;
      b.position.set(onWater ? [-5, 5, -2][i] : [-9, 9][i], onWater ? 0.2 : 0.3, onWater ? [-6, -4, -14][i] : [5, 6][i]);
      b.rotation.y = i * 1.3;
      const hull = this._mesh(b, new THREE.CylinderGeometry(0.9, 0.5, 3, 8, 1, false, 0, Math.PI), std(c, 0.6), 0, 0.2, 0);
      hull.rotation.set(Math.PI / 2, 0, Math.PI);
      if (!onWater) b.rotation.z = Math.PI; // dado vuelta en la orilla
      else this._mesh(b, new THREE.CylinderGeometry(0.05, 0.05, 2, 6), std(0xfff6e6), 0, 1.1, 0);
      grp.add(b);
      if (onWater) this.boats.push(b);
    });
    // el mirador
    if (f.mirador) {
      const t = new THREE.Group();
      t.position.set(-17, 0, 2);
      for (const [x, z] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) this._mesh(t, new THREE.CylinderGeometry(0.15, 0.18, 5, 6), std(0x7a4a22), x, 2.5, z);
      this._mesh(t, roundedBox(3.4, 0.25, 3.4, 0.06), std(0xa8743a), 0, 5, 0);
      const roof = this._mesh(t, new THREE.ConeGeometry(2.8, 1.8, 4), std(0x2a7fb5, 0.6), 0, 6.8, 0);
      roof.rotation.y = Math.PI / 4;
      this._mesh(t, new THREE.CylinderGeometry(0.15, 0.2, 0.9, 8), std(0xffc800, 0.3, { metalness: 0.5 }), 0.8, 5.6, 0.8).rotation.z = 0.8;
      grp.add(t);
      mark(t, "mirador");
      col(-17, 2, 2);
    }
    if (f.fuegos) {
      const fest = new THREE.Group();
      fest.add(makeBunting(new THREE.Vector3(-8, 3.2, 8), new THREE.Vector3(8, 3.2, 8), { count: 14, sag: 0.8, size: 0.26 }));
      for (const sx of [-8, 8]) this._mesh(fest, new THREE.CylinderGeometry(0.1, 0.12, 3.4, 6), this.g.m.dark, sx, 1.7, 8);
      grp.add(fest);
      mark(fest, "fuegos");
    }
    this.fireworks = !!f.fuegos;
  }

  // ---------- cosas para recolectar cada día ----------

  _itemMesh(kind) {
    const g = new THREE.Group();
    if (kind === "mazorca") {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), std(0xe0862b, 0.45));
      m.scale.set(0.75, 1.25, 0.75);
      g.add(m);
      for (const r of [0, 1.05, 2.1]) { const s = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.035, 4, 12), std(0xa8541a)); s.rotation.set(Math.PI / 2, r, 0); s.scale.set(1, 1, 1.5); g.add(s); }
    } else if (kind === "huevo") {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 10), std(0xfff3dc, 0.4));
      m.scale.set(0.85, 1.15, 0.85);
      g.add(m);
    } else {
      const m = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.5, 9), std(0xff9ec4, 0.4));
      m.rotation.x = Math.PI;
      g.add(m);
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), std(0xffd6e6, 0.4));
      b.position.y = 0.25;
      g.add(b);
    }
    const halo = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.75, 20), new THREE.MeshBasicMaterial({ color: 0xffe14a, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = -0.55;
    g.add(halo);
    g.userData.noToon = true;
    return g;
  }

  _buildItems() {
    const st = this.st();
    for (const id of ZONE_IDS) {
      const d = ZONE_DEFS[id];
      d.spots.forEach(([lx, lz], idx) => {
        const w = toWorld(id, lx, lz);
        const mesh = this._itemMesh(d.item.id);
        mesh.position.set(w.x, 0.9, w.z);
        const got = st[id].includes(idx);
        mesh.visible = false; // se muestra solo cerca de su barrio (ver update)
        this.g.scene.add(mesh);
        this.items.push({ zone: id, idx, mesh, x: w.x, z: w.z, got });
      });
    }
  }

  /** Para el panel ✨ Actividades: una tarea por barrio (se reinician cada día). */
  tasks() {
    const st = this.st();
    return ZONE_IDS.map((id) => {
      const d = ZONE_DEFS[id];
      return {
        id: `zone-${id}`, icon: d.item.icon, text: d.item.text, cur: st[id].length, goal: d.spots.length,
        at: () => { const left = this.items.filter((it) => it.zone === id && !it.got); return left.length ? left[0] : zoneCenter(id); },
      };
    });
  }

  // ---------- cada cuadro ----------

  update(dt) {
    this.t += dt;
    const P = this.g.pos;
    // cada barrio se dibuja solo cuando estás cerca (y sus vecinos y lo que se recolecta, también)
    const near = {};
    for (const id of ZONE_IDS) {
      const c = zoneCenter(id);
      near[id] = Math.hypot(P.x - c.x, P.z - c.z) < SEE_DIST;
      if (this.bases[id]) this.bases[id].visible = near[id];
      if (this.groups[id]) this.groups[id].visible = near[id];
    }
    for (const n of this.g.npcs) {
      const z = ZONE_IDS.find((id) => ZONE_DEFS[id].npc === n.def.name);
      if (z) { const c = zoneCenter(z); n.hero.group.visible = Math.hypot(P.x - c.x, P.z - c.z) < SEE_DIST; }
    }
    // lo recién construido aparece con un salto
    if (this.pops) for (const p of this.pops) {
      p.t += dt;
      const k = Math.min(1, p.t / 0.6);
      const s = k < 1 ? 0.2 + 0.8 * k + Math.sin(k * Math.PI) * 0.25 : 1;
      p.obj.scale.setScalar(s);
    }
    if (this.pops) this.pops = this.pops.filter((p) => p.t < 0.6);
    if (this.mill) this.mill.rotation.z += dt * 0.9;
    if (this.boats) this.boats.forEach((b, i) => { b.position.y = 0.2 + Math.sin(this.t * 1.6 + i) * 0.08; b.rotation.z = Math.sin(this.t * 1.2 + i) * 0.05; });
    if (this.water) this.water.material.emissiveIntensity = 0.28 + Math.sin(this.t * 1.5) * 0.06;
    // fuegos artificiales sobre el lago (de vez en cuando, si está cerca)
    if (this.fireworks && this.bases.lago && this.bases.lago.visible) {
      this.fwT = (this.fwT || 0) - dt;
      if (this.fwT <= 0) {
        this.fwT = 1.6 + Math.random() * 1.4;
        const w = toWorld("lago", (Math.random() - 0.5) * 14, LAKE.z - Math.random() * 6);
        this.g.particles.burst(new THREE.Vector3(w.x, 10 + Math.random() * 4, w.z), [[0xff4fa8, 0xffe14a], [0x4fd0ff, 0xffffff], [0x7ddc4a, 0xffc800]][Math.floor(Math.random() * 3)], 26, 6, 1.4, 1.5, 1.2);
      }
    }
    // recolectar
    const st = this.st();
    for (const it of this.items) {
      it.mesh.visible = !it.got && near[it.zone];
      if (!it.mesh.visible) continue;
      it.mesh.rotation.y += dt * 1.8;
      it.mesh.position.y = 0.9 + Math.sin(this.t * 3 + it.idx) * 0.15;
      if (Math.hypot(P.x - it.x, P.z - it.z) > 1.6) continue;
      it.got = true;
      it.mesh.visible = false;
      if (st[it.zone].includes(it.idx)) continue;
      st[it.zone].push(it.idx);
      const d = ZONE_DEFS[it.zone];
      earnCoins(this.progress, 2);
      audio.playCollect();
      this.g.particles.burst(new THREE.Vector3(it.x, 1.2, it.z), [0xffe14a, 0xffffff, 0xff9ec4], 12, 3, 0.7, 4);
      const left = d.spots.length - st[it.zone].length;
      if (left === 0) {
        const got = addStars(this.progress, 1); // juntar todo lo de un barrio también da ⭐ para la aventura
        this.g.popups.add(new THREE.Vector3(it.x, 2.4, it.z), `¡Todas las ${d.item.name}! +${got} ⭐`, "combo");
        window.dispatchEvent(new CustomEvent("adventure-changed", { detail: { stars: got } }));
      } else this.g.popups.add(new THREE.Vector3(it.x, 2.2, it.z), `${d.item.icon} +2 🍫✨ · faltan ${left}`, "coin");
      saveProgress(this.progress);
    }
  }
}
