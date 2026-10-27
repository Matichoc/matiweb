// Barrios nuevos de la Ciudad Choco, fuera del anillo de calles: el Parque Grande (norte), la Playa con su muelle (este)
// y el Colegio (oeste). Se llega por las calles del centro, que ahora siguen hasta cada barrio. Cada uno tiene un vecino
// con una misión que se renueva cada día como las demás: dar pan a los patos, abrir los quitasoles y encontrar los libros.
// Rendimiento (teléfonos de gama media-baja): cada barrio se dibuja solo cuando estás cerca, los árboles y adornos van
// agrupados (InstancedMesh) y no hay sombras reales nuevas.

import { THREE, canvasTexture, roundedBox } from "./three-kit.js?v=73aaf47357";
import * as audio from "./audio.js?v=73aaf47357";
import { binocularStand } from "./binoculars.js?v=73aaf47357";

const RW = 11; // ancho de las calles (igual que en ciudad-game.js)
const SEE = 100; // a esta distancia (o menos) del centro del barrio, se dibuja

/** Dónde se puede caminar o manejar además del centro: un rectángulo por barrio (y su calle de entrada). */
export const AREAS = [
  { id: "parque", x0: -48, x1: 48, z0: -142, z1: -62, cx: 0, cz: -105 },
  { id: "playa", x0: 62, x1: 150, z0: -48, z1: 48, cx: 100, cz: 0 },
  { id: "colegio", x0: -150, x1: -62, z0: -48, z1: 48, cx: -102, cz: 0 },
];
/** Calles nuevas: siguen las del centro hasta cada barrio. */
export const EXTRA_ROADS = [
  { x0: -RW / 2, x1: RW / 2, z0: -92, z1: -60 },
  { x0: 60, x1: 84, z0: -RW / 2, z1: RW / 2 },
  { x0: -84, x1: -60, z0: -RW / 2, z1: RW / 2 },
];
const SEA_X = 128; // desde aquí hacia el este es mar (menos el muelle)
// suelo de los barrios: sobre el pasto (0) y bajo las calles (tope 0.03). Dos pisos a la misma altura se ven como rayas que parpadean en el celular
const GROUND_Y = 0.015;
const PIER = { x0: 122, x1: 146, z0: 8, z1: 13 };

/** Vecinos de los barrios (se agregan a los de ciudad-game.js). */
export const BARRIO_GIVERS = {
  patricio: { name: "Don Patricio", x: 9, z: -96, yaw: Math.PI, char: 1 },
  marina: { name: "Salvavidas Marina", x: 92, z: 4, yaw: -Math.PI / 2, char: 2 },
  paz: { name: "Profesora Paz", x: -90, z: 8, yaw: Math.PI / 2, char: 3 },
};

/** Misiones de los barrios (se renuevan cada día, como las demás). `need` = cuántas cosas hay que hacer. */
export const BARRIO_MISSIONS = [
  { id: "patos", icon: "🦆", title: "Pan para los patos del parque", reward: 50, giver: "patricio", level: "Fácil", need: 5 },
  { id: "quitasoles", icon: "⛱️", title: "Abrir los quitasoles de la playa", reward: 55, giver: "marina", level: "Fácil", need: 6 },
  { id: "libros", icon: "📚", title: "Libros perdidos del colegio", reward: 65, giver: "paz", level: "Media", need: 6 },
];

export const BARRIO_SAY = {
  patricio: {
    ask: ["¡Hola! Soy Don Patricio y cuido los patos del Parque Grande 🦆", "Hoy no he podido darles de comer… ¿me ayudas?", "Acércate a cada familia de patos de la laguna y les tiras pan solito 🍞"],
    wait: ["Acércate a cada familia de patos de la laguna para darles pan 🍞"],
    done: ["¡Mira qué contentos están! Cuac cuac 🦆💛", "Toma, un premio para ti. ¡Gracias!"],
  },
  marina: {
    ask: ["¡Hola! Soy Marina, la salvavidas de la playa 🛟", "Viene mucha gente y los quitasoles están todos cerrados.", "¿Los abres? Camina junto a cada uno y se abre solito ⛱️"],
    wait: ["Camina junto a cada quitasol cerrado de la playa y se abre ⛱️"],
    done: ["¡La playa quedó preciosa! Ahora todos tienen sombrita 😎", "Toma tus Matipuntos. ¡Gracias!"],
  },
  paz: {
    ask: ["¡Hola! Soy la profesora Paz 📚", "Se volaron los libros de la biblioteca: hay en el patio del colegio, en el parque y en la playa.", "Acércate a los libros que brillan y vuelven solitos a tu mochila 🎒"],
    wait: ["Busca los libros que brillan: en el colegio, en el parque y en la playa 📚"],
    done: ["¡Están todos! La biblioteca está completa otra vez 📚✨", "Toma, un premio por ser tan buen ayudante."],
  },
};

const std = (c, r = 0.7, x = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, ...x });

function signTex(text, bg) {
  return canvasTexture(512, 128, (g, w, h) => {
    g.fillStyle = bg;
    g.beginPath(); g.roundRect(6, 6, w - 12, h - 12, 28); g.fill();
    g.lineWidth = 6; g.strokeStyle = "#ffc800"; g.stroke();
    g.fillStyle = "#fff6e6";
    g.font = '56px "Baby Chipmunk", "Fredoka", sans-serif';
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(text, w / 2, h / 2 + 4, w - 40);
  });
}

export class CiudadBarrios {
  constructor(game) {
    this.g = game;
    this.groups = {};
    this.items = { patos: [], quitasoles: [], libros: [] };
    this.t = 0;
  }

  /** ¿Se puede estar en (x, z) dentro de un barrio? (el mar no, salvo el muelle) */
  inBarrio(x, z) {
    if (x > SEA_X && !(x < PIER.x1 && z > PIER.z0 && z < PIER.z1)) {
      if (x < 150 && z > -48 && z < 48) return false;
    }
    return AREAS.some((a) => x >= a.x0 && x <= a.x1 && z >= a.z0 && z <= a.z1);
  }

  /** El punto permitido más cercano dentro de los barrios (para no salirse). */
  clampInto(p) {
    let best = null;
    let bd = Infinity;
    for (const a of AREAS) {
      let x = Math.min(a.x1, Math.max(a.x0, p.x));
      const z = Math.min(a.z1, Math.max(a.z0, p.z));
      if (a.id === "playa" && x > SEA_X && !(z > PIER.z0 && z < PIER.z1)) x = SEA_X;
      if (a.id === "playa" && x > PIER.x1) x = PIER.x1;
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < bd) { bd = d; best = { x, z, d }; }
    }
    return best;
  }

  build() {
    this._parque();
    this._playa();
    this._colegio();
  }

  _group(id) {
    const g = new THREE.Group();
    g.userData.area = AREAS.find((a) => a.id === id);
    this.g.scene.add(g);
    this.groups[id] = g;
    return g;
  }

  _mesh(grp, geo, mat, x, y, z) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    grp.add(m);
    return m;
  }

  _sign(grp, text, bg, x, z, yaw) {
    // el cartel se lee de los dos lados (dos caras, no una con DoubleSide, que se vería al revés por detrás)
    const mat = new THREE.MeshBasicMaterial({ map: signTex(text, bg), transparent: true });
    for (const back of [0, 1]) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.75), mat);
      s.position.set(x, 4.4, z);
      s.rotation.y = yaw + (back ? Math.PI : 0);
      grp.add(s);
    }
    for (const sx of [-3, 3]) {
      const post = this._mesh(grp, new THREE.CylinderGeometry(0.15, 0.18, 4.4, 8), this.g.m.brown, x + Math.cos(yaw) * sx, 2.2, z - Math.sin(yaw) * sx);
      this.g.colliders.push({ type: "c", x: post.position.x, z: post.position.z, r: 0.3 });
    }
  }

  _trees(grp, spots, color = 0x5fbf5a) {
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.3, 0.42, 2.6, 7), this.g.m.trunk, spots.length);
    const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(2.1, 0), std(color, 0.9), spots.length);
    const o = new THREE.Object3D();
    spots.forEach(([x, z, s], i) => {
      o.position.set(x, 1.3 * s, z); o.scale.setScalar(s); o.rotation.set(0, i, 0); o.updateMatrix(); trunks.setMatrixAt(i, o.matrix);
      o.position.set(x, 3.6 * s, z); o.updateMatrix(); crowns.setMatrixAt(i, o.matrix);
      this.g.colliders.push({ type: "c", x, z, r: 0.5 * s });
    });
    grp.add(trunks, crowns);
  }

  // ---------- Parque Grande (norte) ----------

  _parque() {
    const g = this._group("parque");
    const lawn = this._mesh(g, new THREE.PlaneGeometry(92, 76), std(0x8fdc72, 1), 0, GROUND_Y, -103);
    lawn.rotation.x = -Math.PI / 2;
    // sendero circular
    const ring = this._mesh(g, new THREE.RingGeometry(20, 23.5, 48), std(0xe9d2a2, 0.95), 0, 0.05, -108);
    ring.rotation.x = -Math.PI / 2;
    // laguna con patos
    const pond = this._mesh(g, new THREE.CircleGeometry(12, 40), std(0x5ab8e8, 0.2, { metalness: 0.1, emissive: 0x13507a, emissiveIntensity: 0.25 }), 0, 0.07, -108);
    pond.rotation.x = -Math.PI / 2;
    this.g.colliders.push({ type: "c", x: 0, z: -108, r: 11.6 });
    // juegos: resbalín y columpios
    const play = new THREE.Group();
    play.position.set(-30, 0, -84);
    this._mesh(play, roundedBox(3, 3, 3, 0.1), std(0xff5f9e, 0.6), 0, 1.5, 0);
    const slide = this._mesh(play, new THREE.BoxGeometry(1.4, 0.15, 5.4), std(0xffd34d, 0.4), 0, 1.6, 3.6);
    slide.rotation.x = -0.55;
    for (const sx of [5, 9]) {
      this._mesh(play, new THREE.CylinderGeometry(0.1, 0.1, 3.4, 6), std(0x4fb3ff), sx - 1.2, 1.7, 0).rotation.z = 0.15;
      this._mesh(play, new THREE.CylinderGeometry(0.1, 0.1, 3.4, 6), std(0x4fb3ff), sx + 1.2, 1.7, 0).rotation.z = -0.15;
      this._mesh(play, new THREE.BoxGeometry(2.6, 0.12, 0.12), std(0x4fb3ff), sx, 3.3, 0);
      this._mesh(play, new THREE.BoxGeometry(0.8, 0.1, 0.5), std(0xd4216c), sx, 0.8, 0);
    }
    g.add(play);
    this.g.colliders.push({ type: "c", x: -30, z: -84, r: 2.2 });
    // árboles alrededor
    const spots = [];
    let s = 13;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 34; i++) {
      const x = -44 + r() * 88;
      const z = -140 + r() * 70;
      const d = Math.hypot(x, z + 108);
      if (d < 26 || Math.abs(x) < 7 || Math.hypot(x + 30, z + 84) < 8 || Math.hypot(x - BARRIO_GIVERS.patricio.x, z - BARRIO_GIVERS.patricio.z) < 5) continue;
      spots.push([x, z, 0.85 + r() * 0.5]);
    }
    this._trees(g, spots, 0x66c45a);
    this._sign(g, "🌳 Parque Grande", "#3d8a3a", 0, -72, 0);
    // patos: 5 familias alrededor de la laguna
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.4;
      const x = Math.sin(a) * 13.6;
      const z = -108 + Math.cos(a) * 13.6;
      const fam = new THREE.Group();
      fam.position.set(x, 0.1, z);
      fam.rotation.y = a + Math.PI;
      for (let k = 0; k < 3; k++) {
        const duck = new THREE.Group();
        duck.position.set((k - 1) * 0.9, 0, (k % 2) * 0.5);
        this._mesh(duck, new THREE.SphereGeometry(k ? 0.32 : 0.45, 10, 8), std(k ? 0xffe14a : 0xffffff, 0.6), 0, 0.35, 0).scale.set(1, 0.8, 1.3);
        this._mesh(duck, new THREE.SphereGeometry(k ? 0.2 : 0.26, 8, 6), std(k ? 0xffe14a : 0x2f9a4a, 0.6), 0, 0.72, 0.32);
        this._mesh(duck, new THREE.ConeGeometry(0.08, 0.22, 6), std(0xff8a2a, 0.5), 0, 0.7, 0.58).rotation.x = Math.PI / 2;
        fam.add(duck);
      }
      g.add(fam);
      this.items.patos.push({ x, z, mesh: fam, got: false, r: 3.2, base: 0.1 });
    }
  }

  // ---------- Playa con muelle (este) ----------

  _playa() {
    const g = this._group("playa");
    const sand = this._mesh(g, new THREE.PlaneGeometry(SEA_X - 62, 96), std(0xf6dfa4, 0.95), (62 + SEA_X) / 2, GROUND_Y, 0);
    sand.rotation.x = -Math.PI / 2;
    const sea = this._mesh(g, new THREE.PlaneGeometry(160, 260), std(0x3ea8e0, 0.15, { metalness: 0.15, emissive: 0x0f4a78, emissiveIntensity: 0.3 }), SEA_X + 80, 0.02, 0);
    sea.rotation.x = -Math.PI / 2;
    this.sea = sea;
    // espuma en la orilla
    // franja de arena por toda la orilla (fuera de la playa el pasto llegaba directo al agua)
    for (const sz of [-1, 1]) {
      const strip = this._mesh(g, new THREE.PlaneGeometry(SEA_X - 100, 130 - 48), sand.material, (100 + SEA_X) / 2, GROUND_Y, sz * (48 + 130) / 2);
      strip.rotation.x = -Math.PI / 2;
    }
    const foam = this._mesh(g, new THREE.PlaneGeometry(2, 260), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }), SEA_X + 0.6, 0.05, 0);
    foam.rotation.x = -Math.PI / 2;
    this.foam = foam;
    // el muelle
    this._mesh(g, roundedBox(PIER.x1 - PIER.x0, 0.3, PIER.z1 - PIER.z0, 0.06), std(0xa8743a, 0.7), (PIER.x0 + PIER.x1) / 2, 0.5, (PIER.z0 + PIER.z1) / 2);
    // binoculares en la punta del muelle: miran mar adentro
    const bz = (PIER.z0 + PIER.z1) / 2;
    const stand = binocularStand();
    stand.position.set(PIER.x1 - 1.2, 0.65, bz);
    stand.rotation.y = Math.PI / 2;
    g.add(stand);
    (this.g.binocSpots = this.g.binocSpots || []).push({ x: PIER.x1 - 2.2, z: bz, eye: { x: PIER.x1 - 1.1, y: 2.3, z: bz, yaw: Math.PI / 2 } });
    const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18, 0.18, 1.6, 6), std(0x6b3a1e), 14);
    const o = new THREE.Object3D();
    for (let i = 0; i < 14; i++) { o.position.set(PIER.x0 + 1 + Math.floor(i / 2) * 3.6, 0, i % 2 ? PIER.z1 : PIER.z0); o.updateMatrix(); posts.setMatrixAt(i, o.matrix); }
    g.add(posts);
    // torre del salvavidas
    const tw = new THREE.Group();
    tw.position.set(100, 0, -6);
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) this._mesh(tw, new THREE.CylinderGeometry(0.12, 0.14, 3.4, 6), std(0xffffff), x, 1.7, z);
    this._mesh(tw, roundedBox(2.8, 1.4, 2.8, 0.08), std(0xe8404a, 0.6), 0, 4, 0);
    const roof = this._mesh(tw, new THREE.ConeGeometry(2.4, 1.2, 4), std(0xffffff, 0.6), 0, 5.3, 0);
    roof.rotation.y = Math.PI / 4;
    g.add(tw);
    this.g.colliders.push({ type: "c", x: 100, z: -6, r: 1.8 });
    // palmeras
    const palms = [[74, -38], [80, 36], [112, -40], [116, 40], [70, 20], [72, -20]];
    for (const [x, z] of palms) {
      const p = new THREE.Group();
      p.position.set(x, 0, z);
      const trunk = this._mesh(p, new THREE.CylinderGeometry(0.25, 0.4, 6, 7), std(0xa8743a), 0, 3, 0);
      trunk.rotation.z = 0.12;
      for (let k = 0; k < 5; k++) { const l = this._mesh(p, new THREE.BoxGeometry(3.4, 0.08, 0.9), std(0x3fae4a), 0, 6.1, 0); l.rotation.set(0.3, (k / 5) * Math.PI * 2, -0.35); l.translateX(1.4); }
      g.add(p);
      this.g.colliders.push({ type: "c", x, z, r: 0.5 });
    }
    this._sign(g, "🏖️ Playa Choco", "#2a7fb5", 66, 0, -Math.PI / 2);
    // quitasoles (cerrados hasta la misión) con sus toallas
    const cols = [0xff5f9e, 0xffd34d, 0x4fb3ff, 0x7ddc4a, 0xff8a2a, 0x9a7cff];
    const spots = [[84, -24], [96, -30], [108, -18], [86, 24], [100, 30], [112, 20]];
    spots.forEach(([x, z], i) => {
      const u = new THREE.Group();
      u.position.set(x, 0, z);
      this._mesh(u, new THREE.CylinderGeometry(0.07, 0.07, 3.2, 6), std(0xffffff), 0, 1.6, 0);
      const top = this._mesh(u, new THREE.ConeGeometry(2.2, 1, 12, 1, true), std(cols[i], 0.5, { side: THREE.DoubleSide }), 0, 3.1, 0);
      const towel = this._mesh(u, new THREE.BoxGeometry(1.4, 0.04, 2.6), std(cols[(i + 2) % cols.length], 0.8), 1.6, 0.06, 0.4);
      void towel;
      g.add(u);
      this.g.colliders.push({ type: "c", x, z, r: 0.3 });
      this.items.quitasoles.push({ x, z, mesh: u, top, got: false, r: 2.6 });
    });
  }

  // ---------- Colegio (oeste) ----------

  _colegio() {
    const g = this._group("colegio");
    const yard = this._mesh(g, new THREE.PlaneGeometry(86, 94), std(0xb8d98f, 1), -106, GROUND_Y, 0);
    yard.rotation.x = -Math.PI / 2;
    // el edificio con su reloj y techo rojo
    const b = new THREE.Group();
    b.position.set(-128, 0, 0);
    this._mesh(b, roundedBox(14, 9, 34, 0.15), std(0xffe9c4, 0.75), 0, 4.5, 0);
    const roof = this._mesh(b, new THREE.CylinderGeometry(8, 8, 35, 3, 1), std(0xc8443a, 0.6), 0, 10.4, 0);
    roof.rotation.x = Math.PI / 2;
    roof.scale.set(1, 1, 0.45);
    const clock = this._mesh(b, new THREE.CylinderGeometry(1.6, 1.6, 0.3, 24), std(0xffffff, 0.4), 7.1, 7.6, 0);
    clock.rotation.z = Math.PI / 2;
    this._mesh(b, new THREE.BoxGeometry(0.1, 1.2, 0.18), std(0x2a1810), 7.3, 8, 0);
    this._mesh(b, new THREE.BoxGeometry(0.1, 0.18, 0.9), std(0x2a1810), 7.3, 7.6, 0.4);
    const winTex = canvasTexture(64, 64, (c, w, h) => { c.fillStyle = "#8fd0ff"; c.fillRect(0, 0, w, h); c.strokeStyle = "#ffffff"; c.lineWidth = 6; c.strokeRect(3, 3, w - 6, h - 6); c.beginPath(); c.moveTo(w / 2, 0); c.lineTo(w / 2, h); c.stroke(); });
    const wins = new THREE.InstancedMesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: winTex }), 14);
    const o = new THREE.Object3D();
    for (let i = 0; i < 14; i++) { o.position.set(7.05, i < 7 ? 3 : 6.6, -13.5 + (i % 7) * 4.5); o.rotation.set(0, Math.PI / 2, 0); o.updateMatrix(); wins.setMatrixAt(i, o.matrix); }
    b.add(wins);
    this._mesh(b, new THREE.BoxGeometry(0.2, 3.6, 3.4), std(0x7a3f22), 7.05, 1.8, 0);
    g.add(b);
    this.g.colliders.push({ type: "b", x: -128, z: 0, hw: 7.4, hd: 17.4, yaw: 0 });
    // cancha del patio y asta de bandera
    const court = this._mesh(g, new THREE.PlaneGeometry(18, 12), std(0x4fb3ff, 0.7), -102, 0.05, -28);
    court.rotation.x = -Math.PI / 2;
    for (const sx of [-8.6, 8.6]) this._mesh(g, new THREE.BoxGeometry(0.2, 2.2, 3), std(0xffffff), -102 + sx, 1.1, -28);
    this._mesh(g, new THREE.CylinderGeometry(0.1, 0.12, 8, 8), std(0xdddddd, 0.3, { metalness: 0.5 }), -96, 4, 22);
    const flag = this._mesh(g, new THREE.PlaneGeometry(2.4, 1.5), std(0xd4216c, 0.6, { side: THREE.DoubleSide }), -94.8, 7.2, 22);
    this.flag = flag;
    this.g.colliders.push({ type: "c", x: -96, z: 22, r: 0.3 });
    // paradero del bus
    this._mesh(g, roundedBox(4, 0.15, 1.6, 0.05), std(0xffd34d, 0.6), -78, 2.6, -10);
    for (const sx of [-1.8, 1.8]) this._mesh(g, new THREE.CylinderGeometry(0.08, 0.08, 2.6, 6), std(0x3a3a46), -78 + sx, 1.3, -10);
    this._sign(g, "🏫 Colegio Choco", "#c8443a", -66, 0, Math.PI / 2);
    // árboles del borde
    const spots = [];
    for (let i = 0; i < 10; i++) spots.push([-146 + (i % 2) * 4, -44 + i * 9.5, 1]);
    for (let i = 0; i < 6; i++) spots.push([-112 + i * 7, 44 - (i % 2) * 3, 0.9]);
    this._trees(g, spots, 0x5fbf5a);
    // libros perdidos: en el colegio, en el parque y en la playa
    const bookCols = [0xe8404a, 0x4fb3ff, 0xffd34d, 0x7ddc4a, 0x9a7cff, 0xff8a2a];
    [[-100, -12], [-86, 30], [-118, 34], [26, -126], [-20, -76], [120, -34]].forEach(([x, z], i) => {
      const bk = new THREE.Group();
      bk.position.set(x, 1, z);
      this._mesh(bk, new THREE.BoxGeometry(0.9, 0.22, 1.2), std(bookCols[i], 0.6), 0, 0, 0);
      this._mesh(bk, new THREE.BoxGeometry(0.82, 0.18, 1.14), std(0xfff6e6, 0.8), 0.05, 0, 0);
      const halo = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.05, 24), new THREE.MeshBasicMaterial({ color: 0xffe14a, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
      halo.rotation.x = -Math.PI / 2;
      halo.position.y = -0.9;
      bk.add(halo);
      bk.visible = false;
      this.g.scene.add(bk); // (algunos están en otros barrios: van sueltos en la escena)
      this.items.libros.push({ x, z, mesh: bk, got: true, r: 1.8 });
    });
  }

  // ---------- misiones ----------

  /** Al empezar una misión de los barrios: todo vuelve a su lugar. */
  reset(id) {
    if (id === "patos") for (const it of this.items.patos) { it.got = false; it.mesh.scale.setScalar(1); }
    if (id === "quitasoles") for (const it of this.items.quitasoles) { it.got = false; it.top.scale.set(0.28, 1.6, 0.28); it.top.position.y = 2.4; }
    if (id === "libros") for (const it of this.items.libros) { it.got = false; it.mesh.visible = true; it.mesh.scale.setScalar(1); }
  }

  /** Al cargar la ciudad: quitasoles cerrados (abiertos si ya hiciste la misión alguna vez) y libros guardados. */
  setDone(done) {
    for (const it of this.items.quitasoles) {
      it.got = !!done.quitasoles;
      it.top.scale.set(done.quitasoles ? 1 : 0.28, done.quitasoles ? 1 : 1.6, done.quitasoles ? 1 : 0.28);
      it.top.position.y = done.quitasoles ? 3.1 : 2.4;
    }
    for (const it of this.items.libros) { it.got = true; it.mesh.visible = false; }
  }

  isMission(id) { return id in this.items; }

  /**
   * Avanza una misión de los barrios. `a` = la misión activa; devuelve el próximo objetivo ({x, z}) o null.
   * Cuando está todo, pasa a "report" (volver con quien te la pidió).
   */
  tick(a, dt, pl, inCar) {
    const list = this.items[a.id];
    if (!list || a.step !== "do") return null;
    for (const it of list) {
      if (it.got || inCar) continue;
      if (Math.hypot(pl.x - it.x, pl.z - it.z) > it.r) continue;
      it.got = true;
      it.anim = 0;
      a.n = (a.n || 0) + 1;
      audio.playCollect();
      const label = { patos: "🍞🦆", quitasoles: "⛱️", libros: "📚" }[a.id];
      this.g.popups.add(new THREE.Vector3(it.x, 2.6, it.z), `${label} ${a.n}/${list.length}`, "combo");
      this.g.particles.burst(new THREE.Vector3(it.x, 1.4, it.z), [0xffe14a, 0xffffff, 0xff9ec4], 14, 3, 0.8, 4);
    }
    if (list.every((it) => it.got)) {
      a.step = "report";
      const m = BARRIO_MISSIONS.find((x) => x.id === a.id);
      this.g.banner(`¡Listo! Vuelve con ${BARRIO_GIVERS[m.giver].name} 💬`);
      return null;
    }
    let best = null;
    for (const it of list) if (!it.got && (!best || Math.hypot(pl.x - it.x, pl.z - it.z) < Math.hypot(pl.x - best.x, pl.z - best.z))) best = it;
    return best ? { x: best.x, z: best.z, r: 0.8 } : null;
  }

  // ---------- cada cuadro ----------

  update(dt, pl) {
    this.t += dt;
    for (const [id, g] of Object.entries(this.groups)) {
      const a = g.userData.area;
      g.visible = Math.hypot(pl.x - a.cx, pl.z - a.cz) < SEE;
    }
    // patos que nadan un poquito; los que comieron saltan de alegría
    for (const it of this.items.patos) {
      it.mesh.position.y = it.base + Math.sin(this.t * 2 + it.x) * 0.06;
      if (it.got && it.anim != null && it.anim < 1) { it.anim += dt * 1.6; it.mesh.position.y += Math.sin(it.anim * Math.PI) * 0.8; }
    }
    // quitasoles que se abren
    for (const it of this.items.quitasoles) {
      if (!it.got || it.anim == null || it.anim >= 1) continue;
      it.anim = Math.min(1, it.anim + dt * 2.2);
      const k = it.anim;
      it.top.scale.set(0.28 + 0.72 * k + Math.sin(k * Math.PI) * 0.15, 1.6 - 0.6 * k, 0.28 + 0.72 * k + Math.sin(k * Math.PI) * 0.15);
      it.top.position.y = 2.4 + 0.7 * k;
    }
    // libros que flotan y se van volando a la mochila
    for (const it of this.items.libros) {
      if (!it.mesh.visible) continue;
      if (it.got) {
        it.anim = (it.anim || 0) + dt * 2;
        it.mesh.position.y = 1 + it.anim * 3;
        it.mesh.scale.setScalar(Math.max(0.01, 1 - it.anim));
        if (it.anim >= 1) it.mesh.visible = false;
      } else {
        it.mesh.rotation.y += dt * 1.5;
        it.mesh.position.y = 1 + Math.sin(this.t * 3 + it.x) * 0.2;
      }
    }
    if (this.sea) this.sea.material.emissiveIntensity = 0.28 + Math.sin(this.t * 1.2) * 0.05;
    if (this.foam) this.foam.material.opacity = 0.55 + Math.sin(this.t * 2.4) * 0.2;
    if (this.flag) this.flag.rotation.y = Math.sin(this.t * 3) * 0.25;
  }
}
