// Cosas llamativas y divertidas del Pueblo Matichoc:
//  · Faros de luz con íconos grandes sobre cada lugar importante (se ven desde lejos) y un "!" sobre los vecinos que aún no saludaste.
//  · Pista de baile con luces, trampolines con estrellas en el cielo, circuito de aros contra el reloj y tesoros escondidos (cambian cada día).
//  · "Actividades del día": 5 desafíos con guía; al completarlos hay premio (Matipuntos, sobre de figuritas y energía).
// El estado del día vive en progress.town.fun (se reinicia solo cada día, igual que el resto del pueblo).

import { THREE, canvasTexture } from "./three-kit.js?v=b28a0715a9";
import { earnCoins, saveProgress } from "./storage.js?v=b28a0715a9";
import { addEnergy } from "./energy.js?v=b28a0715a9";
import * as audio from "./audio.js?v=b28a0715a9";
import { openPuzzle, PUZZLES } from "./town-puzzles.js?v=b28a0715a9";

const pol = (deg, r) => {
  const a = (deg * Math.PI) / 180;
  return { x: Math.sin(a) * r, z: -Math.cos(a) * r };
};
const rngOf = (seedStr) => {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) { h ^= seedStr.charCodeAt(i); h = Math.imul(h, 16777619); }
  let s = (h >>> 0) % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
};

const DANCE_GOAL = 20; // segundos bailando
const JUMP_GOAL = 5;
const JUMP_WALK = 12.5; // salto normal (el de los trampolines es más alto): llega a ~3 de alto
const COURSE_COINS = 10; // premio de la cima de cada recorrido de parkour (una vez al día)
const DOORS = [
  { id: "gato", name: "El Gato", icon: "🐱", wall: 0xffb0d0, roof: 0xd4216c, sign: "#d4216c", beacon: "#ff5fa8" },
  { id: "sudoku", name: "Sudoku", icon: "🔢", wall: 0xbfe6ff, roof: 0x2a8fd6, sign: "#2a8fd6", beacon: "#35c8ff" },
  { id: "cachipun", name: "Cachipún", icon: "✊", wall: 0xd6f5b8, roof: 0x3d9a4a, sign: "#3d9a4a", beacon: "#4fd09a" },
];
const PASTEL = [0xff7aa8, 0x35c8ff, 0xffd34d, 0x9a5cff, 0x4fd09a];
const CHEST_GOAL = 3;
const HELLO_GOAL = 4;
const CHESTS_PER_DAY = 5;
const RING_COUNT = 8;
const RING_TIME = 60; // segundos para el circuito
const GRAVITY = 26;
const JUMP_V = 17;
const COMPLETE_COINS = 30;
const DAY_GOAL = 7; // actividades del día que hay que completar para el premio (hay 10: se eligen las que más gusten)

const DANCE_AT = pol(235, 16);
const PADS = [pol(28, 18), pol(76, 18), pol(-30, 18), pol(-78, 18)];
const START_AT = pol(122, 16);

/** Carita/ícono redondo con borde, para los faros. */
function iconSprite(emoji, color) {
  const tex = canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = "#fff6e6";
    g.beginPath(); g.arc(w / 2, h / 2, 56, 0, Math.PI * 2); g.fill();
    g.lineWidth = 9; g.strokeStyle = color; g.stroke();
    g.font = "62px system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(emoji, w / 2, h / 2 + 4);
  });
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  sp.renderOrder = 9;
  return sp;
}

function labelSprite(text, color) {
  const tex = canvasTexture(384, 80, (g, w, h) => {
    g.fillStyle = color;
    g.beginPath(); g.roundRect(6, 8, w - 12, h - 16, 30); g.fill();
    g.lineWidth = 6; g.strokeStyle = "#fff6e6"; g.stroke();
    g.fillStyle = "#fff";
    g.font = 'bold 38px "Baby Chipmunk", system-ui, sans-serif';
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(text, w / 2, h / 2 + 2, w - 40);
  });
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  sp.renderOrder = 9;
  return sp;
}

const beamTexture = (() => {
  let t = null;
  return () => t || (t = canvasTexture(8, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, h, 0, 0);
    gr.addColorStop(0, "rgba(255,255,255,0.85)");
    gr.addColorStop(0.55, "rgba(255,255,255,0.28)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  }));
})();

export class TownFun {
  constructor(game) {
    this.g = game;
    this.beacons = [];
    this.pads = [];
    this.stars = [];
    this.chests = [];
    this.rings = [];
    this.platforms = []; // plataformas de parkour: { x, z, top, r }
    this.pillars = []; // columnas de las torres: { x, z, r, top }
    this.courses = []; // recorridos: { id, name, start, top: { x, z, top, r }, done }
    this.doorSpots = [];
    this.puzzleOpen = false;
    this.groundY = 0;
    this.claimed = []; // lugares ya usados por las casitas y los recorridos
    this.circuit = null; // { idx, t } mientras corre
    this.danceT = 0;
    this.heroMode = null;
    this.vy = 0;
    this.tip = "";
    this.tipT = 0;
    this._last = "";
  }

  // ---------- estado del día ----------

  st() {
    const d = this.g._daily();
    if (!d.fun) d.fun = { dance: 0, danceCoins: 0, jumps: 0, circuit: 0, best: 0, chests: [], stars: 0, done: false };
    d.fun.doors = d.fun.doors || {}; // puertas de juegos ganadas hoy
    d.fun.courses = d.fun.courses || {}; // recorridos de parkour completados hoy
    return d.fun;
  }

  /** Casitas con puertas y recorridos de parkour: se arman antes que los árboles (ver TownGame.build). */
  buildWorld() {
    this._buildDoors();
    this._buildCourses();
  }

  build() {
    this._buildBeacons();
    this._buildDance();
    this._buildPads();
    this._buildRingsAndFlag();
    this._buildChests();
    this._buildMarkers();
    this._buildArrow();
    this._buildPanel();
  }

  // ---------- faros de luz ----------

  _beacon(x, z, color, emoji, label, { h = 26, r = 1.3 } = {}) {
    const g = this.g;
    const grp = new THREE.Group();
    grp.position.set(x, 0, z);
    const col = new THREE.Color(color);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r * 1.35, h, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: col, map: beamTexture(), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }),
    );
    beam.position.y = h / 2;
    beam.userData.noToon = true;
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.6, 2.1, 40), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.07;
    const icon = iconSprite(emoji, color);
    icon.scale.set(3.4, 3.4, 1);
    icon.position.y = 8.4;
    const tag = labelSprite(label, "#" + col.getHexString());
    tag.scale.set(7.2, 1.5, 1);
    tag.position.y = 6.2;
    grp.add(beam, ring, icon, tag);
    g.scene.add(grp);
    const b = { grp, beam, ring, icon, tag, x, z, ph: Math.random() * 6 };
    this.beacons.push(b);
    return b;
  }

  _buildBeacons() {
    const g = this.g;
    const spec = { shop: ["#ff5fa8", "👕", "Boutique"], creador: ["#ff9a3c", "🏭", "Fábrica"], album: ["#ffc800", "📖", "Figuritas"], house: ["#3fd0a8", "🏠", "Mi Casa"] };
    for (const it of g.interact) {
      const s = it.beacon || spec[it.kind];
      if (!s || it.fun) continue;
      if (it.label.includes("misiones")) { this._beacon(it.x - 1, it.z - 3, "#ff9a3c", "🎯", "Misiones", { h: 20 }); continue; }
      this._beacon(it.x, it.z, s[0], s[1], s[2]);
    }
    const a = pol(123, 44);
    this._beacon(a.x, a.z, "#9a5cff", "🎮", "Arcade", { h: 30, r: 2.2 });
    this._beacon(DANCE_AT.x, DANCE_AT.z, "#ff4fd0", "💃", "Pista de baile", { h: 20 });
    this._beacon(START_AT.x, START_AT.z, "#4fd09a", "🏁", "Circuito", { h: 20 });
    PADS.forEach((p) => this._beacon(p.x, p.z, "#35c8ff", "🎈", "Trampolín", { h: 12, r: 0.9 }));
    for (const c of this.courses) this._beacon(c.start.x, c.start.z, "#ff9a3c", "🧗", c.name, { h: 24, r: 1.1 });
  }

  // ---------- "!" sobre los vecinos que faltan por saludar ----------

  _buildMarkers() {
    for (const n of this.g.npcs) {
      const s = iconSprite("❗", "#ff4f6a");
      s.scale.set(1.1, 1.1, 1);
      s.position.set(0, 3.9, 0);
      n.hero.group.add(s);
      n.mark = s;
    }
  }

  // ---------- pista de baile ----------

  _buildDance() {
    const g = this.g;
    const grp = new THREE.Group();
    grp.position.set(DANCE_AT.x, 0, DANCE_AT.z);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.4, 0.22, 36), new THREE.MeshStandardMaterial({ color: 0x2a1a4a, roughness: 0.4 }));
    base.position.y = 0.11;
    base.receiveShadow = true;
    grp.add(base);
    this.tiles = [];
    const N = 12;
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * Math.PI * 2;
      const tile = new THREE.Mesh(new THREE.CircleGeometry(4.9, 4, a0, (Math.PI * 2) / N * 0.92), new THREE.MeshBasicMaterial({ color: 0xff4fd0, side: THREE.DoubleSide }));
      tile.rotation.x = -Math.PI / 2;
      tile.position.y = 0.24;
      grp.add(tile);
      this.tiles.push(tile);
    }
    // bola disco
    this.ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.15, flatShading: true, emissive: 0x6a4a8a, emissiveIntensity: 0.6 }));
    this.ball.position.y = 7;
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    rope.position.y = 10;
    grp.add(this.ball, rope);
    // parlantes
    for (const sx of [-1, 1]) {
      const sp = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 1.0), new THREE.MeshStandardMaterial({ color: 0x1c1c26, roughness: 0.6 }));
      sp.position.set(sx * 5.6, 1.1, -1.5);
      const cone = new THREE.Mesh(new THREE.CircleGeometry(0.38, 16), new THREE.MeshBasicMaterial({ color: 0xff4fd0 }));
      cone.position.set(sx * 5.6, 1.3, -0.99);
      grp.add(sp, cone);
      (this.speakers ||= []).push(cone);
    }
    g.scene.add(grp);
    this.danceGrp = grp;
  }

  // ---------- trampolines y estrellas ----------

  _buildPads() {
    const g = this.g;
    const cols = [0xff7aa8, 0x35c8ff, 0xffd34d, 0x9a5cff];
    PADS.forEach((p, i) => {
      const grp = new THREE.Group();
      grp.position.set(p.x, 0, p.z);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.3, 28), new THREE.MeshStandardMaterial({ color: cols[i], roughness: 0.4, emissive: cols[i], emissiveIntensity: 0.25 }));
      top.position.y = 0.45;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.16, 8, 28), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }));
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.55;
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 0.3, 20), new THREE.MeshStandardMaterial({ color: 0x4a3a6a, roughness: 0.6 }));
      base.position.y = 0.15;
      top.castShadow = true;
      grp.add(base, top, rim);
      g.scene.add(grp);
      this.pads.push({ grp, top, x: p.x, z: p.z, squash: 0 });
      // estrellas en el cielo (en arco)
      [[4.6, 0], [7.6, 1.4], [10.6, -1.4]].forEach(([y, dx], k) => {
        const s = iconSprite("⭐", "#ffc800");
        s.scale.set(1.9, 1.9, 1);
        s.position.set(p.x + dx, y, p.z + (k === 1 ? 1 : k === 2 ? -1 : 0));
        g.scene.add(s);
        this.stars.push({ s, x: s.position.x, y: s.position.y, z: s.position.z, taken: false, respawn: 0, ph: Math.random() * 6 });
      });
    });
  }

  // ---------- circuito de aros ----------

  _buildRingsAndFlag() {
    const g = this.g;
    for (let i = 0; i < RING_COUNT; i++) {
      const p = pol(10 + i * 45, 26);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.22, 10, 28), new THREE.MeshBasicMaterial({ color: 0x4fd09a, transparent: true, opacity: 0.35 }));
      ring.position.set(p.x, 2.4, p.z);
      ring.lookAt(0, 2.4, 0); // el aro mira al centro: se cruza "dando la vuelta" a la plaza
      ring.rotateY(Math.PI / 2);
      ring.userData.noToon = true;
      g.scene.add(ring);
      this.rings.push({ mesh: ring, x: p.x, z: p.z });
    }
    // bandera de salida
    const flag = new THREE.Group();
    flag.position.set(START_AT.x, 0, START_AT.z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 4.4, 8), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    pole.position.y = 2.2;
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.3), new THREE.MeshBasicMaterial({ map: canvasTexture(128, 64, (c, w, h) => { for (let i = 0; i < 8; i++) for (let j = 0; j < 4; j++) { c.fillStyle = (i + j) % 2 ? "#fff" : "#1c1c26"; c.fillRect(i * 16, j * 16, 16, 16); } }), side: THREE.DoubleSide }));
    cloth.position.set(1.15, 3.7, 0);
    flag.add(pole, cloth);
    g.scene.add(flag);
    g.interact.push({ kind: "ring", x: START_AT.x, z: START_AT.z + 2.4, radius: 4.2, label: "🏁 ¡Empezar el circuito!", fun: true });
  }

  startCircuit() {
    if (this.circuit) return;
    this.circuit = { idx: 0, t: 0 };
    this._say("🏁 ¡Vamos! Cruza los aros en orden", 2.4);
    audio.playPowerup?.();
  }

  // ---------- tesoros escondidos ----------

  _buildChests() {
    const g = this.g;
    const rnd = rngOf(`tesoros-${g._daily().date}`);
    const st = this.st();
    for (let i = 0; i < CHESTS_PER_DAY; i++) {
      let x = 0, z = 0;
      for (let k = 0; k < 80; k++) {
        const r = 24 + rnd() * 24;
        const a = rnd() * Math.PI * 2;
        x = Math.sin(a) * r;
        z = Math.cos(a) * r;
        if (!g._nearStructure(x, z, 3) && !this._nearActivity(x, z)) break;
      }
      const grp = new THREE.Group();
      grp.position.set(x, 0, z);
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.9, 1.0), new THREE.MeshStandardMaterial({ color: 0xb9774a, roughness: 0.6 }));
      body.position.y = 0.45;
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.5, 12, 1, false, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0xa8683c, roughness: 0.6 }));
      lid.rotation.z = Math.PI / 2;
      lid.position.y = 0.9;
      const band = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.22, 1.04), new THREE.MeshStandardMaterial({ color: 0xffc800, metalness: 0.6, roughness: 0.3 }));
      band.position.y = 0.55;
      const lock = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffc800 }));
      lock.position.set(0, 0.8, 0.52);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.5, 7, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe14a, map: beamTexture(), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      beam.position.y = 3.5;
      beam.userData.noToon = true;
      grp.add(body, lid, band, lock, beam);
      grp.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      g.scene.add(grp);
      const c = { grp, beam, x, z, id: i, open: st.chests.includes(i) };
      if (c.open) { grp.visible = false; }
      this.chests.push(c);
    }
  }

  _nearActivity(x, z) {
    const pts = [DANCE_AT, START_AT, ...PADS];
    return pts.some((p) => Math.hypot(x - p.x, z - p.z) < 8);
  }

  // ---------- lugares libres ----------

  /** ¿Se puede construir algo en (x, z)? Lejos de edificios, caminos, trampolines, pista de baile y de lo que ya se puso. */
  _free(x, z, margin) {
    if (this.g._nearStructure(x, z, margin) || this._nearActivity(x, z)) return false;
    return !this.claimed.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + margin);
  }

  /** Busca (siempre igual, no al azar) un lugar libre: prueba ángulos y radios hasta que `pointsAt(deg, r)` quede todo libre. */
  _findSpot(pointsAt, margin, radii) {
    for (const m of [margin, margin * 0.7]) {
      for (const r of radii) {
        for (let deg = 190; deg < 190 + 360; deg += 3) {
          const pts = pointsAt(deg % 360, r);
          if (pts.every((p) => this._free(p.x, p.z, m))) return { deg: deg % 360, r };
        }
      }
    }
    return null;
  }

  // ---------- casitas con puertas de juegos (Gato, Sudoku, Cachipún) ----------

  _buildDoors() {
    const g = this.g;
    const SPACING = 15; // grados entre casitas
    const spot = this._findSpot((deg, r) => DOORS.map((_, k) => pol(deg + k * SPACING, r)), 7.5, [41, 37, 33]);
    if (!spot) return;
    DOORS.forEach((def, k) => {
      const deg = spot.deg + k * SPACING;
      const p = pol(deg, spot.r);
      this.claimed.push({ x: p.x, z: p.z, r: 5 });
      g._addBuilding({ deg, r: spot.r, w: 7, d: 6, h: 4.5, color: def.wall, roof: def.roof, name: def.name, icon: def.icon, signColor: def.sign, kind: "puzzle", label: `🚪 Entrar: ${def.name}` });
      const it = g.interact[g.interact.length - 1];
      it.puzzle = def.id;
      it.beacon = [def.beacon, def.icon, def.name];
      this.doorSpots.push({ id: def.id, x: it.x, z: it.z });
    });
  }

  /** Abre una puerta: un cuadro con el juego. El premio del día se entrega solo la primera vez que se gana. */
  openDoor(id) {
    const g = this.g;
    this.puzzleOpen = true;
    g.keys = {};
    g.joy = { x: 0, y: 0 };
    const st = this.st();
    const ok = openPuzzle(id, {
      onWin: (kind) => {
        if (st.doors[kind]) return "(Ya tienes el premio de hoy: ¡juega por diversión!)";
        st.doors[kind] = true;
        const coins = PUZZLES[kind].reward;
        earnCoins(g.progress, coins);
        saveProgress(g.progress);
        g.popups.add(new THREE.Vector3(g.pos.x, 3.2, g.pos.z), `+${coins} 🍫✨`, "coin");
        return `+${coins} 🍫✨ (premio del día)`;
      },
      onClose: () => { this.puzzleOpen = false; },
    });
    if (!ok) this.puzzleOpen = false;
  }

  // ---------- parkour: una torre en espiral y una escalera de nubes ----------

  _platform(x, z, top, r, mesh) {
    this.platforms.push({ x, z, top, r });
    this.g.scene.add(mesh);
  }

  _candyDisc(x, z, top, r, color) {
    const grp = new THREE.Group();
    grp.position.set(x, 0, z);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.5, 24), new THREE.MeshStandardMaterial({ color, roughness: 0.45, emissive: color, emissiveIntensity: 0.18 }));
    disc.position.y = top - 0.25;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.1, 8, 28), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = top;
    disc.castShadow = disc.receiveShadow = true;
    grp.add(disc, rim);
    return grp;
  }

  _cloud(x, z, top, r) {
    const grp = new THREE.Group();
    grp.position.set(x, top - r * 0.3, z);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, emissive: 0xbfe6ff, emissiveIntensity: 0.15 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), mat);
    body.scale.set(1, 0.3, 1);
    grp.add(body);
    for (const [dx, dz, k] of [[0.55, 0.2, 0.55], [-0.5, -0.3, 0.5], [0.1, -0.6, 0.45]]) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(r * k, 12, 9), mat);
      puff.position.set(dx * r, -r * 0.05, dz * r);
      puff.scale.set(1, 0.45, 1);
      grp.add(puff);
    }
    grp.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return grp;
  }

  _trophy(x, z, top) {
    const s = iconSprite("🏆", "#ffc800");
    s.scale.set(2.6, 2.6, 1);
    s.position.set(x, top + 2.2, z);
    this.g.scene.add(s);
    return s;
  }

  _buildCourses() {
    this._buildTower();
    this._buildClouds();
  }

  _buildTower() {
    const g = this.g;
    const N = 11;
    const R = 6.2;
    const spot = this._findSpot((deg, r) => { const c = pol(deg, r); return [c, ...[0, 90, 180, 270].map((a) => ({ x: c.x + Math.sin((a * Math.PI) / 180) * 8, z: c.z - Math.cos((a * Math.PI) / 180) * 8 }))]; }, 5, [40, 35, 44]);
    if (!spot) return;
    const c = pol(spot.deg, spot.r);
    this.claimed.push({ x: c.x, z: c.z, r: 9 });
    const topY = 1.2 + N * 1.0;
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.9, topY, 16), g.m.choco);
    pillar.position.set(c.x, topY / 2, c.z);
    pillar.castShadow = true;
    g.scene.add(pillar);
    this.pillars.push({ x: c.x, z: c.z, r: 1.9, top: topY }); // choca solo por debajo de la cima (arriba se puede caminar por toda la plataforma dorada)
    const a0 = (spot.deg * Math.PI) / 180 + Math.PI; // la espiral empieza mirando a la plaza
    let start = null;
    for (let i = 0; i < N; i++) {
      const ang = a0 + i * 0.66;
      const x = c.x + Math.sin(ang) * R;
      const z = c.z - Math.cos(ang) * R;
      const top = 1.2 + i * 1.0;
      this._platform(x, z, top, 1.9, this._candyDisc(x, z, top, 1.9, PASTEL[i % PASTEL.length]));
      if (i === 0) start = { x, z };
    }
    this._platform(c.x, c.z, topY, 2.7, this._candyDisc(c.x, c.z, topY, 2.7, 0xffc800));
    const trophy = this._trophy(c.x, c.z, topY);
    this.courses.push({ id: "tower", name: "Torre de Cacao", start, top: { x: c.x, z: c.z, top: topY, r: 2.7 }, trophy });
  }

  _buildClouds() {
    const g = this.g;
    const N = 8;
    const STEP = 4.3;
    const spot = this._findSpot((deg, r) => {
      // la escalera corre en la dirección de un círculo (tangente) y mide ~36 de largo
      const out = [];
      for (let k = 0; k <= N; k++) out.push(pol(deg + k * ((STEP * 180) / (Math.PI * r)), r));
      return out;
    }, 3, [46, 44, 40, 36, 32]);
    if (!spot) return;
    const dDeg = (STEP * 180) / (Math.PI * spot.r);
    let start = null;
    let last = null;
    for (let k = 0; k < N; k++) {
      const p = pol(spot.deg + k * dDeg, spot.r - (k % 2 ? 1.7 : -1.7));
      const top = 1.0 + k * 0.95;
      this._platform(p.x, p.z, top, 2.1, this._cloud(p.x, p.z, top, 2.1));
      this.claimed.push({ x: p.x, z: p.z, r: 3 });
      if (k === 0) start = { x: p.x, z: p.z };
      last = { x: p.x, z: p.z, top };
    }
    const end = pol(spot.deg + N * dDeg, spot.r);
    const topY = last.top + 1.0;
    this._platform(end.x, end.z, topY, 2.8, this._cloud(end.x, end.z, topY, 2.8));
    this.claimed.push({ x: end.x, z: end.z, r: 4 });
    const trophy = this._trophy(end.x, end.z, topY);
    this.courses.push({ id: "clouds", name: "Escalera de Nubes", start, top: { x: end.x, z: end.z, top: topY, r: 2.8 }, trophy });
  }

  /** Altura del piso bajo (x, z): la plataforma más alta que está a los pies (o hasta 0,5 sobre ellos, como un escalón). */
  _groundAt(x, z, y) {
    let top = 0;
    for (const p of this.platforms) {
      if (p.top <= y + 0.5 && p.top > top && Math.hypot(x - p.x, z - p.z) < p.r) top = p.top;
    }
    return top;
  }

  /** Gravedad: el Matichico cae al piso o a la plataforma que tenga abajo (las plataformas se atraviesan al subir). */
  _physics(dt) {
    const P = this.g.pos;
    for (const c of this.pillars) {
      if (P.y >= c.top - 0.2) continue;
      const dx = P.x - c.x, dz = P.z - c.z, d = Math.hypot(dx, dz), min = c.r + 0.45;
      if (d < min) { const k = d > 1e-4 ? min / d : 1; P.x = c.x + (d > 1e-4 ? dx * k : min); P.z = c.z + (d > 1e-4 ? dz * k : 0); }
    }
    const gy = this._groundAt(P.x, P.z, P.y);
    this.groundY = gy;
    if (this.vy > 0 || P.y > gy + 0.001) {
      this.vy -= GRAVITY * dt;
      const ny = P.y + this.vy * dt;
      if (this.vy <= 0 && ny <= gy) { P.y = gy; this.vy = 0; } else P.y = ny;
    } else { P.y = gy; this.vy = 0; }
  }

  /** Salto del botón ⤴️ / Espacio: solo desde el piso o desde una plataforma. */
  jump() {
    const g = this.g;
    if (g.state !== "playing" || this.puzzleOpen) return;
    if (this.vy <= 0 && g.pos.y <= this.groundY + 0.08) {
      this.vy = JUMP_WALK;
      g.pos.y = this.groundY + 0.05;
      audio.playJump?.();
    }
  }

  _updateCourses(dt, st) {
    const g = this.g;
    const t = g.time;
    for (const c of this.courses) {
      c.trophy.position.y = c.top.top + 2.2 + Math.sin(t * 2.5) * 0.25;
      c.trophy.visible = !st.courses[c.id];
      if (st.courses[c.id]) continue;
      const T = c.top;
      if (Math.hypot(g.pos.x - T.x, g.pos.z - T.z) < T.r && g.pos.y >= T.top - 0.1 && this.vy <= 0 && this.groundY >= T.top - 0.1) {
        st.courses[c.id] = true;
        earnCoins(g.progress, COURSE_COINS);
        saveProgress(g.progress);
        g.particles.burst(new THREE.Vector3(T.x, T.top + 1.4, T.z), [0xffe14a, 0xff4fd0, 0x35f0ff, 0xffffff], 40, 6, 1.2, 5);
        g.popups.add(new THREE.Vector3(T.x, T.top + 3.4, T.z), `+${COURSE_COINS} 🍫✨`, "combo");
        audio.playVictory?.();
        this._say(`🏆 ¡Llegaste a la cima de ${c.name}! +${COURSE_COINS} 🍫✨`, 3.6);
      }
    }
  }

  // ---------- flecha guía y panel ----------

  _buildArrow() {
    const g = this.g;
    const arrow = new THREE.Group();
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.1, 12), new THREE.MeshBasicMaterial({ color: 0xffd34d }));
    cone.rotation.x = Math.PI / 2; // apunta hacia +z
    cone.userData.noToon = true;
    arrow.add(cone);
    arrow.visible = false;
    g.scene.add(arrow);
    this.arrow = arrow;
    this.guide = null;
  }

  _tasks() {
    const st = this.st();
    const g = this.g;
    return [
      { id: "dance", icon: "💃", text: "Baila en la pista", cur: Math.min(DANCE_GOAL, Math.floor(st.dance)), goal: DANCE_GOAL, unit: " s", at: () => DANCE_AT },
      { id: "jump", icon: "🎈", text: "Salta en los trampolines", cur: Math.min(JUMP_GOAL, st.jumps), goal: JUMP_GOAL, at: () => this._nearest(PADS) },
      { id: "ring", icon: "🏁", text: "Completa el circuito de aros", cur: st.circuit ? 1 : 0, goal: 1, at: () => START_AT },
      { id: "parkour", icon: "🧗", text: "Sube a la cima de la Torre y las Nubes", cur: this.courses.filter((c) => st.courses[c.id]).length, goal: Math.max(1, this.courses.length), at: () => this._nearest(this.courses.filter((c) => !st.courses[c.id]).map((c) => c.start)) },
      { id: "doors", icon: "🚪", text: "Gana en las 3 puertas de juegos", cur: Object.keys(st.doors).filter((k) => st.doors[k]).length, goal: DOORS.length, at: () => this._nearest(this.doorSpots.filter((d) => !st.doors[d.id])) },
      { id: "chest", icon: "🧰", text: "Encuentra tesoros escondidos", cur: Math.min(CHEST_GOAL, st.chests.length), goal: CHEST_GOAL, hot: true },
      { id: "hello", icon: "👋", text: "Saluda a los vecinos", cur: Math.min(HELLO_GOAL, g._daily().talked.length), goal: HELLO_GOAL, at: () => { const n = g.npcs.filter((x) => !g._daily().talked.includes(x.def.name)); return this._nearest(n); } },
      ...(g.zones ? g.zones.tasks() : []), // lo que se recolecta cada día en el bosque, la granja y el lago
    ];
  }

  _nearest(list) {
    let best = null, bd = Infinity;
    for (const p of list) {
      const d = Math.hypot(p.x - this.g.pos.x, p.z - this.g.pos.z);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  _buildPanel() {
    const wrap = this.g.els.wrap;
    const el = document.createElement("div");
    el.className = "tf-guide";
    el.innerHTML = `<button type="button" class="tf-head">✨ Actividades <b class="tf-n">0/5</b></button><div class="tf-list"></div><div class="tf-hot hidden"></div>`;
    wrap.appendChild(el);
    this.panel = el;
    this.listEl = el.querySelector(".tf-list");
    this.hotEl = el.querySelector(".tf-hot");
    this.nEl = el.querySelector(".tf-n");
    this.open = !this.g.coarse;
    el.classList.toggle("open", this.open);
    el.querySelector(".tf-head").addEventListener("click", () => { this.open = !this.open; el.classList.toggle("open", this.open); });
    const timer = document.createElement("div");
    timer.className = "tf-timer hidden";
    wrap.appendChild(timer);
    this.timerEl = timer;
    const tip = document.createElement("div");
    tip.className = "tf-tip hidden";
    wrap.appendChild(tip);
    this.tipEl = tip;
  }

  _renderPanel() {
    const tasks = this._tasks();
    const done = tasks.filter((t) => t.cur >= t.goal).length;
    const key = tasks.map((t) => t.cur).join(",") + `|${this.guide || ""}`;
    if (key === this._last) return;
    this._last = key;
    this.nEl.textContent = `${Math.min(done, DAY_GOAL)}/${Math.min(DAY_GOAL, tasks.length)}`; // hay más actividades que las que se piden: se eligen
    this.listEl.innerHTML = "";
    for (const t of tasks) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "tf-task" + (t.cur >= t.goal ? " done" : "") + (this.guide === t.id ? " on" : "");
      b.innerHTML = `<span class="tf-ic">${t.cur >= t.goal ? "✅" : t.icon}</span><span class="tf-tx">${t.text}</span><small>${t.cur}/${t.goal}${t.unit || ""}</small>`;
      b.addEventListener("click", () => { this.guide = this.guide === t.id ? null : t.id; this._last = ""; this._renderPanel(); });
      this.listEl.appendChild(b);
    }
  }

  _say(text, secs = 2.2) {
    this.tip = text;
    this.tipT = secs;
    this.tipEl.textContent = text;
    this.tipEl.classList.remove("hidden");
  }

  // ---------- ciclo ----------

  update(dt) {
    const g = this.g;
    const t = g.time;
    const P = g.pos;
    const st = this.st();

    // faros: pulsan, el ícono flota, y se atenúan cuando estás encima para no tapar la vista
    for (const b of this.beacons) {
      const d = Math.hypot(b.x - P.x, b.z - P.z);
      const near = Math.min(1, Math.max(0.18, (d - 4) / 14));
      b.beam.material.opacity = 0.55 * near;
      const s = 1 + Math.sin(t * 2.4 + b.ph) * 0.08;
      b.ring.scale.setScalar(1 + ((t * 0.7 + b.ph) % 1) * 0.9);
      b.ring.material.opacity = 0.8 * (1 - ((t * 0.7 + b.ph) % 1));
      b.icon.position.y = 8.4 + Math.sin(t * 2 + b.ph) * 0.5;
      b.icon.scale.set(3.4 * s, 3.4 * s, 1);
      b.tag.material.opacity = Math.min(1, 0.35 + d / 18);
    }
    // vecinos sin saludar
    const talked = g._daily().talked;
    for (const n of g.npcs) if (n.mark) {
      n.mark.visible = !talked.includes(n.def.name);
      n.mark.position.y = 3.9 + Math.sin(t * 5 + n.x) * 0.2;
    }

    this._updateDance(dt, st);
    this._updatePads(dt, st);
    this._updateCourses(dt, st);
    this._updateCircuit(dt, st);
    this._updateChests(dt, st);
    this._updateGuide(dt);
    this._checkComplete(st);
    this._renderPanel();
    if (this.tipT > 0) { this.tipT -= dt; if (this.tipT <= 0) this.tipEl.classList.add("hidden"); }
  }

  _updateDance(dt, st) {
    const g = this.g;
    const t = g.time;
    // luces
    this.tiles.forEach((tile, i) => tile.material.color.setHSL(((t * 0.4 + i / this.tiles.length) % 1), 0.9, this.dancing ? 0.6 : 0.5));
    this.ball.rotation.y = t * 1.2;
    this.speakers.forEach((c) => c.scale.setScalar(1 + Math.max(0, Math.sin(t * 8)) * (this.dancing ? 0.5 : 0.15)));
    const d = Math.hypot(g.pos.x - DANCE_AT.x, g.pos.z - DANCE_AT.z);
    const speed = Math.hypot(g.vel.x, g.vel.z);
    const on = d < 5 && g.pos.y < 0.6 && speed < 2.2;
    if (on && !this.dancing) { this.dancing = true; this._say("💃 ¡A bailar!", 1.8); }
    if (!on && this.dancing) this.dancing = false;
    this.heroMode = this.dancing ? "dance" : null;
    if (this.dancing) {
      g.heroYaw += dt * 1.6;
      st.dance += dt;
      this.danceT += dt;
      if (this.danceT >= 5) {
        this.danceT = 0;
        if (st.danceCoins < 10) {
          st.danceCoins++;
          earnCoins(g.progress, 1);
          g.popups.add(new THREE.Vector3(g.pos.x, 3.2, g.pos.z), "+1 🍫✨", "coin");
        }
        g.particles.burst(new THREE.Vector3(g.pos.x, 2.4, g.pos.z), [0xff4fd0, 0xffd34d, 0x35f0ff, 0xffffff], 18, 4, 0.9, 5);
        saveProgress(g.progress);
      }
    }
  }

  _updatePads(dt, st) {
    const g = this.g;
    const P = g.pos;
    const t = g.time;
    // física vertical del salto (piso y plataformas de parkour)
    this._physics(dt);
    for (const p of this.pads) {
      p.squash = Math.max(0, p.squash - dt * 4);
      p.top.scale.y = 1 - p.squash * 0.5;
      const d = Math.hypot(P.x - p.x, P.z - p.z);
      if (d < 1.9 && P.y < 0.9 && this.vy <= 0) {
        this.vy = JUMP_V;
        P.y = Math.max(P.y, 0.6);
        p.squash = 1;
        st.jumps++;
        audio.playBounce?.();
        g.particles.burst(new THREE.Vector3(p.x, 0.8, p.z), [0xffffff, 0x35c8ff, 0xffd34d], 16, 5, 0.7, 5);
        saveProgress(g.progress);
      }
    }
    this.airborne = P.y > this.groundY + 0.25;
    for (const s of this.stars) {
      if (s.taken) { s.respawn -= dt; if (s.respawn <= 0) { s.taken = false; s.s.visible = true; } continue; }
      s.s.position.y = s.y + Math.sin(t * 2.5 + s.ph) * 0.25;
      const sc = 1.9 + Math.sin(t * 5 + s.ph) * 0.2;
      s.s.scale.set(sc, sc, 1);
      if (Math.abs(s.x - P.x) < 1.7 && Math.abs(s.z - P.z) < 1.7 && Math.abs(s.s.position.y - (P.y + 1.3)) < 1.8) {
        s.taken = true;
        s.respawn = 30;
        s.s.visible = false;
        st.stars = (st.stars || 0) + 1;
        if (st.stars <= 15) { earnCoins(g.progress, 1); g.popups.add(new THREE.Vector3(s.x, s.y + 1, s.z), "+1 ⭐", "coin"); }
        audio.playBonusCollect?.();
        g.particles.burst(new THREE.Vector3(s.x, s.y, s.z), [0xffe14a, 0xffffff], 12, 3.5, 0.7, 4);
        saveProgress(g.progress);
      }
    }
  }

  _updateCircuit(dt, st) {
    const g = this.g;
    const c = this.circuit;
    const t = g.time;
    this.rings.forEach((r, i) => {
      const next = c && c.idx === i;
      const passed = c && i < c.idx;
      r.mesh.material.opacity = next ? 0.95 : passed ? 0.08 : 0.35;
      r.mesh.material.color.setHex(next ? 0xffe14a : 0x4fd09a);
      const s = next ? 1 + Math.sin(t * 8) * 0.1 : 1;
      r.mesh.scale.setScalar(s);
    });
    if (!c) { this.timerEl.classList.add("hidden"); return; }
    c.t += dt;
    this.timerEl.classList.remove("hidden");
    this.timerEl.textContent = `🏁 Aro ${Math.min(c.idx + 1, RING_COUNT)}/${RING_COUNT} · ⏱ ${Math.max(0, RING_TIME - c.t).toFixed(1)} s`;
    const r = this.rings[c.idx];
    if (r && Math.hypot(g.pos.x - r.x, g.pos.z - r.z) < 2.8 && g.pos.y < 4.2) {
      c.idx++;
      audio.playBonusCollect?.();
      g.particles.burst(new THREE.Vector3(r.x, 2.4, r.z), [0xffe14a, 0x4fd09a, 0xffffff], 16, 4, 0.8, 5);
      if (c.idx >= RING_COUNT) {
        const secs = c.t;
        this.circuit = null;
        const reward = secs < 35 ? 20 : secs < 45 ? 12 : 6;
        earnCoins(g.progress, reward);
        st.circuit = (st.circuit || 0) + 1;
        const rec = !st.best || secs < st.best;
        if (rec) st.best = secs;
        this._say(`🏆 ¡Circuito en ${secs.toFixed(1)} s! +${reward} 🍫✨${rec ? " ¡Nuevo récord!" : ""}`, 4);
        audio.playVictory?.();
        g.popups.add(new THREE.Vector3(g.pos.x, 3.4, g.pos.z), `+${reward} 🍫✨`, "coin");
        saveProgress(g.progress);
      }
    } else if (c.t > RING_TIME) {
      this.circuit = null;
      this._say("⏱ ¡Se acabó el tiempo! Inténtalo otra vez", 3);
    }
  }

  _updateChests(dt, st) {
    const g = this.g;
    const t = g.time;
    for (const c of this.chests) {
      if (c.open) continue;
      c.beam.material.opacity = 0.4 + Math.sin(t * 3 + c.id) * 0.15;
      c.grp.children[1].rotation.x = 0; // tapa
      if (Math.hypot(g.pos.x - c.x, g.pos.z - c.z) < 1.8 && g.pos.y < 1.4) {
        c.open = true;
        c.grp.visible = false;
        st.chests.push(c.id);
        const coins = 5;
        earnCoins(g.progress, coins);
        g.particles.burst(new THREE.Vector3(c.x, 1.2, c.z), [0xffe14a, 0xffffff, 0xff7aa8, 0x35f0ff], 30, 6, 1.1, 6);
        g.popups.add(new THREE.Vector3(c.x, 2.6, c.z), `¡Tesoro! +${coins} 🍫✨`, "combo");
        audio.playPurchase?.();
        this._say(`🧰 ¡Encontraste un tesoro! (${st.chests.length}/${CHESTS_PER_DAY})`, 2.6);
        saveProgress(g.progress);
      }
    }
  }

  /** Flecha sobre el Matichico hacia lo que elegiste en la lista; para los tesoros, dice "frío/caliente". */
  _updateGuide() {
    const g = this.g;
    const task = this.guide && this._tasks().find((x) => x.id === this.guide);
    this.arrow.visible = false;
    this.hotEl.classList.add("hidden");
    if (!task || task.cur >= task.goal) return;
    if (task.hot) {
      const left = this.chests.filter((c) => !c.open);
      const c = this._nearest(left);
      if (c) {
        const d = Math.hypot(c.x - g.pos.x, c.z - g.pos.z);
        this.hotEl.textContent = d < 8 ? "🔥 ¡Muy cerca!" : d < 18 ? "♨️ Caliente…" : d < 32 ? "🌤️ Tibio" : "❄️ Lejos";
        this.hotEl.classList.remove("hidden");
      }
      return;
    }
    const tg = task.at && task.at();
    if (!tg) return;
    const dx = tg.x - g.pos.x, dz = tg.z - g.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 5) return;
    this.arrow.visible = true;
    this.arrow.position.set(g.pos.x, g.pos.y + 3.3 + Math.sin(g.time * 4) * 0.15, g.pos.z);
    this.arrow.rotation.y = Math.atan2(dx, dz);
  }

  _checkComplete(st) {
    if (st.done) return;
    const tasks = this._tasks();
    if (tasks.filter((t) => t.cur >= t.goal).length < Math.min(DAY_GOAL, tasks.length)) return;
    st.done = true;
    const g = this.g;
    earnCoins(g.progress, COMPLETE_COINS);
    g.progress.packs = (g.progress.packs || 0) + 1;
    addEnergy(g.progress, 10, "actividades del pueblo");
    saveProgress(g.progress);
    this._say(`🎉 ¡Actividades del día completas! +${COMPLETE_COINS} 🍫✨, un sobre y ⚡ de energía`, 5);
    audio.playVictory?.();
    g.particles.burst(new THREE.Vector3(g.pos.x, 2.6, g.pos.z), [0xffe14a, 0xff4fd0, 0x35f0ff, 0x7ddc4a], 50, 7, 1.4, 6);
  }
}
