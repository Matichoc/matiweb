// Ciudad Choco 3D: una ciudad abierta para pasear a pie o en auto y ayudar a los vecinos con misiones tranquilas.
//
//   🎨 Pintar la reja de Don Pepe · 🍎 Manzanas para Doña Rosa · 🧹 Plaza limpia · 🌷 Regar las flores
//   🐶 El perrito perdido · 👵 La abuelita cruza la calle · 📦 Entrega de chocolates (en auto) · 🏁 Carrera por la ciudad
//
// Sin violencia ni choques que duelan: el auto solo rebota suave, los autos de la ciudad paran si hay alguien adelante
// y los peatones se corren. Todas las misiones dan Matipuntos (la primera vez completa; después, una propina diaria).
//
// Controles: joystick o WASD/flechas. En auto, el joystick gira (←→) y acelera/frena (↑↓). Botón de acción (E o Enter):
// hablar, subir/bajar del auto, regar. H = bocina. Arrastra para mover la cámara cuando vas a pie.

import { THREE, Game3D, clamp, lerp, rand, canvasTexture, roundedBox, makeLogo, goldCoinTexture, eatGhostClick } from "./three-kit.js?v=6b749dd883";
import { createMatichico } from "./matichico3d.js?v=6b749dd883";
import { CHARACTERS, getOutfit } from "./characters.js?v=6b749dd883";
import { ITEMS, OUTFITS } from "./wardrobe-data.js?v=6b749dd883";
import { earnCoins, saveProgress, todayKey } from "./storage.js?v=6b749dd883";
import { spendEnergy, ENERGY_MISSION } from "./energy.js?v=6b749dd883";
import { recordRun } from "./progression.js?v=6b749dd883";
import { IS_DEMO, DEMO_LIMITS, showDemoWall } from "./demo.js?v=6b749dd883";
import * as audio from "./audio.js?v=6b749dd883";
import { CiudadBarrios, BARRIO_MISSIONS, BARRIO_GIVERS, BARRIO_SAY, EXTRA_ROADS, AREAS } from "./ciudad-barrios.js?v=6b749dd883";

const GAME_ID = "ciudad";
const HALF = 60; // el anillo de calles va de -60 a 60
const RW = 11; // ancho de las calles
const LIMIT = 90; // hasta dónde se puede ir
const HERO_R = 0.45;
const CAR_R = 1.15;
const Y0 = 0.04; // altura de las veredas (todo casi plano)
const GOLD_CAP = 30; // alfajores dorados que dan Matipuntos por día
const REPEAT_CAP = 4; // pedidos repetidos que se pagan por día
const REPEAT_PAY = 0.5; // un pedido repetido paga la mitad de la recompensa

const rnd = (() => { let s = 77; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();

const MISSIONS = [
  { id: "reja", icon: "🎨", title: "Pintar la reja de Don Pepe", reward: 40, giver: "pepe", level: "Fácil" },
  { id: "manzanas", icon: "🍎", title: "Manzanas para Doña Rosa", reward: 45, giver: "rosa", level: "Fácil" },
  { id: "plaza", icon: "🧹", title: "Plaza limpia", reward: 45, giver: "beto", level: "Fácil" },
  { id: "flores", icon: "🌷", title: "Regar las flores", reward: 50, giver: "flora", level: "Fácil" },
  { id: "perrito", icon: "🐶", title: "El perrito perdido", reward: 55, giver: "lola", level: "Media" },
  { id: "abuelita", icon: "👵", title: "La abuelita cruza la calle", reward: 60, giver: "tita", level: "Media" },
  { id: "entrega", icon: "📦", title: "Entrega de chocolates (en auto)", reward: 70, giver: "ana", level: "Media" },
  { id: "carrera", icon: "🏁", title: "Carrera por la ciudad (en auto)", reward: 80, giver: "rayo", level: "Difícil" },
  ...BARRIO_MISSIONS, // parque, playa y colegio (js/ciudad-barrios.js)
];

// vecinos que dan misiones
const GIVERS = {
  pepe: { name: "Don Pepe", x: -31, z: -35.2, yaw: 0, char: 0 },
  rosa: { name: "Doña Rosa", x: -30, z: 45.2, yaw: Math.PI, char: 3 },
  beto: { name: "Beto el Barrendero", x: 17, z: 12.8, yaw: 0, char: 1 },
  flora: { name: "Flora la Jardinera", x: 31, z: 12.8, yaw: 0, char: 2 },
  lola: { name: "Lola", x: 15, z: -11.5, yaw: Math.PI * 0.6, char: 3 },
  tita: { name: "Abuelita Tita", x: -22, z: 53.2, yaw: 0, char: 2 },
  ana: { name: "Ana la Chocolatera", x: 28, z: 40.6, yaw: 0, char: 3 },
  rayo: { name: "Piloto Rayo", x: 8.6, z: 28, yaw: Math.PI * 1.5, char: 0 },
  ...BARRIO_GIVERS,
};

const SAY = {
  pepe: {
    ask: ["¡Hola! Mi reja está toda gris y fea 🙁", "¿Me ayudas a pintarla de rosado? Toma mi brocha mágica 🖌️", "Solo camina junto a los tablones grises y se pintan solitos."],
    wait: ["Camina junto a los tablones grises de mi reja y se pintan solos 🎨"],
    done: ["¡Qué reja más linda! Está rosadita como un alfajor de frambuesa 😍", "Toma tus Matipuntos. ¡Gracias, vecino!"],
  },
  rosa: {
    ask: ["¡Buenos días! Quiero hacer un queque de manzana 🍎", "¿Me traes 10 manzanas del huerto? Están en los manzanos de aquí al lado.", "Acércate a los árboles y las manzanas caen solas."],
    wait: ["Junta 10 manzanas en el huerto, ¡están en los manzanos grandes! 🍎"],
    done: ["¡Qué manzanas tan ricas! Voy a hacer el queque ahora mismo 🎂", "Toma, esto es para ti. ¡Gracias!"],
  },
  beto: {
    ask: ["¡Ay, la plaza está llena de papeles! 😮", "¿Me ayudas a limpiarla? Junta 8 papeles y llévalos a un basurero.", "Los verás brillar un poquito en el suelo."],
    wait: ["Junta los papeles que brillan y llévalos al basurero 🗑️"],
    done: ["¡La plaza quedó impecable! 🌟", "Cuidar la ciudad es cosa de todos. ¡Gracias!"],
  },
  flora: {
    ask: ["¡Mis maceteros están todos tristes! 🥀", "Necesitan agua. ¿Los riegas por mí? Son 6 por toda la plaza.", "Acércate a uno y aprieta el botón 💧"],
    wait: ["Busca los maceteros marchitos de la plaza y riégalos con el botón 💧"],
    done: ["¡Mira cuántas flores! 🌷🌼🌸", "¡Eres un gran jardinero! Toma tu premio."],
  },
  lola: {
    ask: ["Buuu… se me perdió mi perrito Choco 🐶😢", "Estaba jugando en el parque y se escondió.", "¿Me ayudas a buscarlo? Te iré diciendo si estás frío o caliente."],
    wait: ["Choco está escondido en el parque. ¡Fíjate si estás frío o caliente! 🔥"],
    done: ["¡Choco! ¡Mi perrito! 🐶💖", "¡Muchas gracias! Toma tu premio."],
  },
  tita: {
    ask: ["Ay, mijito, los autos pasan tan rápido… 😟", "¿Me acompañas a cruzar la calle hasta la casa de mi amiga?", "Camina a mi lado, yo te sigo. ¡Los autos nos van a esperar!"],
    wait: ["Camina a mi lado, yo te sigo. Crucemos juntos por el paso de cebra 🦓"],
    done: ["¡Llegamos! Gracias por cuidarme 💕", "Toma, un premio para ti."],
  },
  ana: {
    ask: ["¡Hola! Hoy hay que repartir 3 cajas de chocolates 🍫", "Súbete al auto y entrégalas en las casas marcadas.", "El auto está en la avenida. ¡Maneja con cuidado!"],
    wait: ["Reparte las cajas en los lugares marcados. ¡Con el auto es más rápido! 🚗"],
    done: ["¡Entregas listas! Los vecinos están felices 🍫", "Toma tu pago. ¡Eres el mejor repartidor!"],
  },
  rayo: {
    ask: ["¡Soy Rayo, el piloto más veloz de la ciudad! 🏎️", "¿Te atreves a dar una vuelta completa por las calles?", "Sube al auto, pasa por los 8 aros y termina la vuelta. ¡Cuenta el tiempo!"],
    wait: ["Sube al auto y ve al aro de partida (el amarillo). ¡Son 8 aros! 🏁"],
    done: ["¡Qué vuelta! Eres un crack del volante 🏆"],
  },
  ...BARRIO_SAY,
};

const PED_CHATS = [
  "¡Qué lindo día para pasear!", "¿Ya probaste los alfajores de la Fábrica?", "Cuidado con los autos 🚗", "¡Hola, vecino!", "Me encanta esta ciudad 💕",
  "En el parque hay patitos 🦆", "Los manzanos del huerto están llenos 🍎", "¡Vamos a la plaza!",
];

// camino que siguen los autos de la ciudad (sentido del reloj, por el carril derecho)
function buildPath() {
  const r = HALF - 2.75;
  const R = 9;
  const pts = [];
  const arc = (cx, cz, a0) => { for (let i = 0; i <= 6; i++) { const a = a0 + (i / 6) * (Math.PI / 2); pts.push([cx + Math.cos(a) * R, cz + Math.sin(a) * R]); } };
  arc(r - R, -r + R, -Math.PI / 2); // esquina noreste (va hacia el sur)
  arc(r - R, r - R, 0); // sureste
  arc(-r + R, r - R, Math.PI / 2); // suroeste
  arc(-r + R, -r + R, Math.PI); // noroeste
  pts.push(pts[0]);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, cum, len: cum[cum.length - 1] };
}
const PATH = buildPath();
function pathAt(s) {
  s = ((s % PATH.len) + PATH.len) % PATH.len;
  let i = 1;
  while (i < PATH.cum.length - 1 && PATH.cum[i] < s) i++;
  const a = PATH.pts[i - 1];
  const b = PATH.pts[i];
  const k = (s - PATH.cum[i - 1]) / (PATH.cum[i] - PATH.cum[i - 1] || 1);
  return { x: lerp(a[0], b[0], k), z: lerp(a[1], b[1], k), yaw: Math.atan2(b[0] - a[0], b[1] - a[1]) };
}

const ROADS = [
  { x0: -HALF - RW / 2, x1: HALF + RW / 2, z0: -HALF - RW / 2, z1: -HALF + RW / 2 },
  { x0: -HALF - RW / 2, x1: HALF + RW / 2, z0: HALF - RW / 2, z1: HALF + RW / 2 },
  { x0: -HALF - RW / 2, x1: -HALF + RW / 2, z0: -HALF - RW / 2, z1: HALF + RW / 2 },
  { x0: HALF - RW / 2, x1: HALF + RW / 2, z0: -HALF - RW / 2, z1: HALF + RW / 2 },
  { x0: -RW / 2, x1: RW / 2, z0: -HALF, z1: HALF },
  { x0: -HALF, x1: HALF, z0: -RW / 2, z1: RW / 2 },
  ...EXTRA_ROADS, // las calles del centro siguen hasta los barrios nuevos
];
const onRoad = (x, z) => ROADS.some((r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1);

// los 8 aros de la carrera: salida en el sur, vuelta en el sentido del reloj (por el carril derecho) y llegada en la salida
const GATES = [[-38, 57.25], [-57.25, 15], [-57.25, -38], [-20, -57.25], [38, -57.25], [57.25, -15], [57.25, 38], [0, 57.25]];

const hash01 = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

function signTexture(text, bg = "#D4216C", fg = "#FFF6E6", w = 512, h = 128, font = 70) {
  return canvasTexture(w, h, (g) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "#FFC800";
    g.lineWidth = 8;
    g.strokeRect(5, 5, w - 10, h - 10);
    g.fillStyle = fg;
    g.font = `${font}px "Baby Chipmunk", sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, w / 2, h / 2 + 4, w - 30);
  });
}

function labelSprite(text, color = "#ffc800") {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: canvasTexture(256, 64, (g, w, h) => {
      g.fillStyle = "rgba(40,20,10,0.78)";
      g.beginPath();
      g.roundRect(4, 8, w - 8, h - 16, 22);
      g.fill();
      g.fillStyle = color;
      g.font = 'bold 30px "Baby Chipmunk", sans-serif';
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(text, w / 2, h / 2 + 2, w - 24);
    }),
    depthTest: false,
    transparent: true,
  }));
  s.scale.set(3.2, 0.8, 1);
  s.renderOrder = 10;
  return s;
}

/** Auto de juguete (el frente mira hacia +z). */
function buildCar({ body = 0xd4216c, roof = 0x64321b, trim = 0xffc800, logo = true } = {}) {
  const car = new THREE.Group();
  const std = (c, r = 0.45, x = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, ...x });
  const sh = (m) => { m.castShadow = true; return m; };
  const chassis = sh(new THREE.Mesh(roundedBox(1.9, 0.7, 4.0, 0.25, 0.06), std(body)));
  chassis.position.y = 0.72;
  const cab = sh(new THREE.Mesh(roundedBox(1.62, 0.62, 1.9, 0.22, 0.05), std(roof)));
  cab.position.set(0, 1.28, -0.2);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.4, 1.56), std(0x9fe8ff, 0.1, { transparent: true, opacity: 0.55 }));
  glass.position.set(0, 1.3, -0.2);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 3.7), std(trim, 0.3, { metalness: 0.4 }));
  stripe.position.set(0, 1.08, 0);
  car.add(chassis, cab, glass, stripe);
  const wheels = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const w = new THREE.Group();
    w.position.set(sx * 0.98, 0.42, sz * 1.3);
    const tire = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.34, 16), std(0x1c1c20, 0.8)));
    tire.rotation.z = Math.PI / 2;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.36, 10), std(trim, 0.3, { metalness: 0.5 }));
    cap.rotation.z = Math.PI / 2;
    w.add(tire, cap);
    car.add(w);
    wheels.push({ g: w, front: sz > 0 });
  }
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff3b3b });
  for (const sx of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), headMat);
    hl.position.set(sx * 0.62, 0.8, 2.02);
    const tl = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), tailMat);
    tl.position.set(sx * 0.66, 0.82, -2.02);
    car.add(hl, tl);
  }
  if (logo) {
    for (const sx of [-1, 1]) {
      const lg = makeLogo(0.62);
      lg.position.set(sx * 0.96, 0.78, 0.2);
      lg.rotation.y = sx * Math.PI / 2;
      car.add(lg);
    }
  }
  return { group: car, wheels };
}

export class CiudadGame extends Game3D {
  constructor(character, progress, els) {
    super(GAME_ID, character, progress, els, { fov: 55, near: 0.3 });
    this.musicTheme = "chill";
    this.kawaii = true;
    this.ambientOpts = { petals: 34, hearts: 6, stars: 18, radius: 22, height: 11 };
    this.q = els.q;
    this.keys = {};
    this.joy = { x: 0, y: 0 };
    this.colliders = [];
    this.pos = new THREE.Vector3(0, Y0, 14);
    this.vel = new THREE.Vector3();
    this.heroYaw = Math.PI;
    this.camYaw = 0;
    this.camPitch = 0.42;
    this.inCar = false;
    this.car = { x: 3.4, z: 8, heading: Math.PI, speed: 0, steer: 0, wob: 0 };
    this.active = null;
    this.target = null;
    this.score = 0;
    this.shake = 0;
    this.stats = { km: 0 };
    this.dialog = null;
    this.hudCache = "";
  }

  // ---------- datos guardados ----------

  get save() {
    const p = this.progress;
    if (!p.ciudad) p.ciudad = { done: {}, gDay: "", gCount: 0, rDay: "", rCount: 0, medal: 0 };
    const c = p.ciudad;
    c.done = c.done || {};
    c.last = c.last || {}; // día en que se completó por última vez cada misión
    return c;
  }

  /** ¿El vecino tiene un pedido para hoy? Una misión nueva siempre; una ya hecha, otra vez cada día (hasta el tope diario). */
  _available(m) {
    const sv = this.save;
    if (this.active && this.active.id === m.id) return false;
    if (!sv.done[m.id]) return true;
    const today = todayKey();
    if (sv.last[m.id] === today) return false;
    return sv.rDay !== today || sv.rCount < REPEAT_CAP;
  }

  // ---------- el mundo ----------

  async build() {
    const s = this.scene;
    s.background = new THREE.Color(0xbfe3ff);
    s.fog = new THREE.Fog(0xf3dcf7, 60, 190); // niebla lila-rosada, como un sueño
    s.add(new THREE.HemisphereLight(0xfff6e0, 0x6a9a50, 1.25));
    this.sun = new THREE.DirectionalLight(0xfff0d2, 2.5);
    this.sun.position.set(-30, 50, 25);
    this.sun.castShadow = true;
    const sm = this.coarse ? 1024 : 2048;
    this.sun.shadow.mapSize.set(sm, sm);
    const sc = this.sun.shadow.camera;
    sc.left = -34; sc.right = 34; sc.top = 34; sc.bottom = -34; sc.near = 5; sc.far = 130;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.05;
    s.add(this.sun, this.sun.target);
    this.onLowQuality = () => { this.sun.castShadow = false; };

    this.m = {
      grass: new THREE.MeshStandardMaterial({ color: 0xa6e592, roughness: 1 }),
      lawn: new THREE.MeshStandardMaterial({ color: 0x8fd67a, roughness: 1 }),
      road: new THREE.MeshStandardMaterial({ color: 0x53535c, roughness: 0.95 }),
      pad: new THREE.MeshStandardMaterial({ color: 0xe9dcc4, roughness: 0.9 }),
      white: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }),
      brown: new THREE.MeshStandardMaterial({ color: 0x64321b, roughness: 0.7 }),
      pink: new THREE.MeshStandardMaterial({ color: 0xd4216c, roughness: 0.5 }),
      gold: new THREE.MeshStandardMaterial({ color: 0xffc800, roughness: 0.3, metalness: 0.5, emissive: 0x5a4000, emissiveIntensity: 0.4 }),
      trunk: new THREE.MeshStandardMaterial({ color: 0x7a4a2a, roughness: 0.9 }),
    };
    this.apples = [];
    this.trash = [];
    this.pots = [];
    this.panels = [];
    this.stops = [];
    this.bins = [];
    this.golds = [];
    this.peds = [];
    this.npcs = {};
    this.traffic = [];
    this.markers = [];

    this._buildGround();
    this._buildBlocks();
    this._buildNorthWest();
    this._buildNorthEast();
    this._buildSouthWest();
    this._buildSouthEast();
    this.barrios = new CiudadBarrios(this); // parque, playa con muelle y colegio, fuera del anillo
    this.barrios.build();
    this._buildTrees();
    this._buildLamps();
    this._buildMarkers();
    this._buildCars();
    this._buildPeople();
    this._buildGolds();
    this._buildMinimap();
    this._ensureHero();
    return true;
  }

  _box(w, h, d, mat, x, y, z, { cast = true, parent = this.scene } = {}) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = cast;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  _std(c, r = 0.6, x = {}) { return new THREE.MeshStandardMaterial({ color: c, roughness: r, ...x }); }

  _buildGround() {
    const s = this.scene;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(520, 520), this.m.grass);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    s.add(ground);
    // calles
    for (const r of ROADS) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(r.x1 - r.x0, 0.06, r.z1 - r.z0), this.m.road);
      m.position.set((r.x0 + r.x1) / 2, 0.0, (r.z0 + r.z1) / 2);
      m.receiveShadow = true;
      s.add(m);
    }
    // rayas amarillas del centro (discontinuas) y bordes blancos
    const dashTex = canvasTexture(64, 128, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = "#ffd23a"; g.fillRect(w / 2 - 5, 8, 10, 60); });
    dashTex.wrapS = dashTex.wrapT = THREE.RepeatWrapping;
    const mk = (len, horizontal, cx, cz) => {
      const t = dashTex.clone();
      t.needsUpdate = true;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(1, len / 4);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.4, len), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
      m.rotation.x = -Math.PI / 2;
      if (horizontal) m.rotation.z = Math.PI / 2;
      m.position.set(cx, 0.045, cz);
      s.add(m);
    };
    mk(2 * HALF + RW, true, 0, -HALF);
    mk(2 * HALF + RW, true, 0, HALF);
    mk(2 * HALF + RW, false, -HALF, 0);
    mk(2 * HALF + RW, false, HALF, 0);
    mk(2 * HALF - RW, false, 0, 0);
    mk(2 * HALF - RW, true, 0, 0);
    // pasos de cebra (todos juntos en una malla con instancias)
    // [x, z, horiz]: horiz = la franja se extiende a lo ancho (en x) porque cruza una calle que va de norte a sur; si no, cruza una calle de este a oeste.
    const zebraSpots = [[-22, HALF, false], [22, -HALF, false], [HALF, -22, true], [-HALF, 22, true], [0, 12, true], [0, -12, true], [12, 0, false], [-12, 0, false], [HALF - 14, 0, false]];
    const zg = new THREE.BoxGeometry(0.7, 0.02, 2.6);
    const zebra = new THREE.InstancedMesh(zg, new THREE.MeshBasicMaterial({ color: 0xffffff }), zebraSpots.length * 9);
    const mat = new THREE.Matrix4();
    let zi = 0;
    for (const [cx, cz, horiz] of zebraSpots) {
      for (let i = 0; i < 9; i++) {
        const off = (i - 4) * 1.15;
        const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), horiz ? Math.PI / 2 * 0 : Math.PI / 2);
        // horiz = el paso cruza una calle que corre de este a oeste: las rayas son largas en z y se reparten en x
        const px = horiz ? cx + off : cx;
        const pz = horiz ? cz : cz + off;
        mat.compose(new THREE.Vector3(px, 0.05, pz), q, new THREE.Vector3(1, 1, 1));
        zebra.setMatrixAt(zi++, mat);
      }
    }
    s.add(zebra);
    // grandes manchas de pasto más claro afuera, para no ver un plano liso
    // (nunca sobre la playa, el parque ni el colegio, ni en el mar: antes asomaban sobre la arena)
    const hillMat = new THREE.MeshStandardMaterial({ color: 0x74c262, roughness: 1 });
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const r = rand(9, 16);
      const x = Math.cos(a) * rand(112, 130);
      const z = Math.sin(a) * rand(112, 130);
      const m = r + 4;
      if (x > 62 - m || AREAS.some((b) => x > b.x0 - m && x < b.x1 + m && z > b.z0 - m && z < b.z1 + m)) continue;
      const hill = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), hillMat);
      hill.scale.y = rand(0.25, 0.45);
      hill.position.set(x, -1, z);
      s.add(hill);
    }
  }

  /** Cuatro manzanas con vereda clara y pasto adentro. */
  _buildBlocks() {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const c = 30;
      const pad = new THREE.Mesh(new THREE.BoxGeometry(49, 0.1, 49), this.m.pad);
      pad.position.set(sx * 30, 0.0, sz * 30);
      pad.receiveShadow = true;
      this.scene.add(pad);
      const lawn = new THREE.Mesh(new THREE.PlaneGeometry(45, 45), this.m.lawn);
      lawn.rotation.x = -Math.PI / 2;
      lawn.position.set(sx * 30, 0.075, sz * 30); // 0.025 sobre la vereda (0.05): con menos, el celular dibuja rayas
      lawn.receiveShadow = true;
      this.scene.add(lawn);
    }
    // veredas por fuera del anillo
    for (const [w, d, x, z] of [[2 * HALF + 2 * RW + 6, 2.2, 0, -HALF - RW / 2 - 1.1], [2 * HALF + 2 * RW + 6, 2.2, 0, HALF + RW / 2 + 1.1], [2.2, 2 * HALF + RW, -HALF - RW / 2 - 1.1, 0], [2.2, 2 * HALF + RW, HALF + RW / 2 + 1.1, 0]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), this.m.pad);
      m.position.set(x, 0, z);
      m.receiveShadow = true;
      this.scene.add(m);
    }
  }

  _wallMat(color, w, h) {
    this._wallTex = this._wallTex || {};
    const key = color;
    if (!this._wallTex[key]) {
      const css = `#${color.toString(16).padStart(6, "0")}`;
      this._wallTex[key] = canvasTexture(128, 128, (g, tw, th) => {
        g.fillStyle = css; g.fillRect(0, 0, tw, th);
        g.fillStyle = "rgba(255,255,255,0.14)"; g.fillRect(0, 0, tw, 14);
        g.fillStyle = "#9fe3ff"; g.strokeStyle = "#fff6e6"; g.lineWidth = 6;
        g.fillRect(22, 40, 34, 46); g.strokeRect(22, 40, 34, 46);
        g.fillRect(74, 40, 34, 46); g.strokeRect(74, 40, 34, 46);
      });
    }
    const t = this._wallTex[key].clone();
    t.needsUpdate = true;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(Math.max(1, Math.round(w / 4.2)), Math.max(1, Math.round(h / 3.4)));
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 });
  }

  /** Casa con techo, puerta y ventanas. `face`: "s" (puerta al sur) o "n". Es un obstáculo. */
  _house(x, z, w, d, h, wall, roof, face = "s") {
    const g = new THREE.Group();
    const mats = [this._wallMat(wall, d, h), this._wallMat(wall, d, h), this._std(wall), this._std(wall), this._wallMat(wall, w, h), this._wallMat(wall, w, h)];
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
    body.position.y = h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    const rg = new THREE.ConeGeometry(1, h * 0.42, 4);
    rg.rotateY(Math.PI / 4); // la base queda alineada con las paredes (si se girara la malla entera, el techo de una casa larga saldría torcido)
    const rf = new THREE.Mesh(rg, this._std(roof, 0.6));
    rf.scale.set(w * 0.78, 1, d * 0.78);
    rf.position.y = h + h * 0.21;
    rf.castShadow = true;
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.1, 0.12), this.m.brown);
    const dz = (face === "s" ? 1 : -1) * (d / 2 + 0.02);
    door.position.set(0, 1.05, dz);
    g.add(body, rf, door);
    g.position.set(x, Y0, z);
    this.scene.add(g);
    this.colliders.push({ type: "b", x, z, hw: w / 2, hd: d / 2 });
    return g;
  }

  _fencePanel(x, z, yaw, paintable) {
    // una sola malla por tablón: un plano con la reja dibujada (muchísimo más barato que armarla con cajitas)
    if (!this.fenceTex) {
      this.fenceTex = canvasTexture(256, 128, (g, w, h) => {
        g.clearRect(0, 0, w, h);
        g.fillStyle = "#ffffff";
        g.fillRect(0, 34, w, 12);
        g.fillRect(0, 80, w, 12);
        for (let i = 0; i < 10; i++) {
          const px = i * 25.6 + 4;
          g.beginPath();
          g.moveTo(px, 118); g.lineTo(px, 22); g.lineTo(px + 9, 8); g.lineTo(px + 18, 22); g.lineTo(px + 18, 118);
          g.closePath();
          g.fill();
        }
      });
    }
    const col = paintable ? 0x9a9a9a : 0xfff6e6;
    const mat = new THREE.MeshStandardMaterial({ map: this.fenceTex, color: col, roughness: 0.8, alphaTest: 0.5, side: THREE.DoubleSide });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), mat);
    m.position.set(x, Y0 + 0.6, z);
    m.rotation.y = yaw;
    this.scene.add(m);
    if (paintable) this.panels.push({ g: m, mat, x, z, paint: 0, done: false });
    return m;
  }

  _sign(text, x, y, z, w, h, bg, font = 70, ry = 0) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: signTexture(text, bg, "#FFF6E6", 512, Math.round(512 * h / w), font), side: THREE.DoubleSide }));
    m.position.set(x, y, z);
    m.rotation.y = ry;
    this.scene.add(m);
    return m;
  }

  _tree(x, z, s = 1, collide = true) {
    this.treeSpots.push([x, z, s]);
    if (collide) this.colliders.push({ type: "c", x, z, r: 0.55 * s });
  }

  _bench(x, z, yaw) {
    const g = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2, 0.12, 0.6), this.m.brown);
    seat.position.y = 0.55;
    const back = new THREE.Mesh(new THREE.BoxGeometry(2, 0.5, 0.1), this.m.brown);
    back.position.set(0, 0.9, -0.28);
    g.add(seat, back);
    for (const sx of [-0.85, 0.85]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.55, 0.5), this.m.gold); l.position.set(sx, 0.28, 0); g.add(l); }
    g.position.set(x, Y0, z);
    g.rotation.y = yaw;
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.scene.add(g);
    this.colliders.push({ type: "c", x, z, r: 0.8 });
  }

  _bin(x, z) {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.34, 0.95, 12), this._std(0x2fa86a, 0.5));
    b.position.y = 0.48;
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.1, 12), this._std(0x1f7a4a, 0.5));
    lid.position.y = 1.0;
    g.add(b, lid);
    g.position.set(x, Y0, z);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.scene.add(g);
    this.colliders.push({ type: "c", x, z, r: 0.5 });
    this.bins.push({ x, z });
  }

  // --- esquina noroeste: el barrio de casas ---

  _buildNorthWest() {
    this.treeSpots = this.treeSpots || [];
    const colors = [0xffd9a8, 0xbfe6ff, 0xffc2dc, 0xcfeec0, 0xfff0a8, 0xe0c8ff];
    const roofs = [0xc0392b, 0x2c6fb7, 0x8e44ad, 0xd35400, 0x16a085, 0xc0392b];
    const row = (z, face) => [-45, -31, -17].forEach((x, i) => this._house(x, z, 8, 6.5, 4.2, colors[(i + (z > -30 ? 3 : 0)) % 6], roofs[(i + 1) % 6], face));
    row(-47, "s");
    row(-14, "n");
    // el patio de Don Pepe: reja a pintar en U delante de su casa (la del medio, arriba)
    const px = -31;
    for (let i = 0; i < 5; i++) this._fencePanel(px - 4.8 + i * 2.4, -37.4, 0, true);
    for (let i = 0; i < 2; i++) { this._fencePanel(px - 6.0, -39.2 - i * 2.4 + 0.0, Math.PI / 2, true); this._fencePanel(px + 6.0, -39.2 - i * 2.4, Math.PI / 2, true); }
    // rejas ya pintadas de los vecinos y jardines
    for (const hx of [-45, -17]) for (let i = 0; i < 3; i++) this._fencePanel(hx - 2.4 + i * 2.4, -37.4, 0, false);
    for (const hx of [-45, -31, -17]) for (let i = 0; i < 3; i++) this._fencePanel(hx - 2.4 + i * 2.4, -23.6, 0, false);
    // arbolitos y bancas
    for (const [x, z] of [[-50, -30], [-10, -30], [-38, -30], [-24, -30], [-50, -52], [-10, -52], [-38, -10], [-24, -10]]) this._tree(x, z, rand(0.9, 1.2));
    this._bench(-31, -29.5, 0);
    this.deliverySpots = [{ x: -45, z: -38.6, name: "la Casa Azul" }];
  }

  // --- esquina noreste: el parque ---

  _buildNorthEast() {
    const s = this.scene;
    const pond = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 7.5, 0.1, 28), this._std(0x6fd0ff, 0.15, { metalness: 0.2 }));
    pond.position.set(32, 0.07, -30);
    s.add(pond);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(7.6, 0.35, 8, 36), this._std(0xcab89a, 0.9));
    rim.rotation.x = Math.PI / 2;
    rim.position.set(32, 0.12, -30);
    s.add(rim);
    this.colliders.push({ type: "c", x: 32, z: -30, r: 7.4 });
    // patitos
    this.ducks = [];
    for (let i = 0; i < 4; i++) {
      const d = new THREE.Group();
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), this._std(0xffe14a, 0.5));
      b.scale.set(1, 0.75, 1.25);
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), this._std(0xffe14a, 0.5));
      h.position.set(0, 0.3, 0.3);
      const bk = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.18), this._std(0xff8a1f, 0.5));
      bk.position.set(0, 0.28, 0.5);
      d.add(b, h, bk);
      d.position.set(32, 0.2, -30);
      s.add(d);
      this.ducks.push({ g: d, a: (i / 4) * 6.28, r: 3 + i * 0.9, sp: 0.2 + i * 0.05 });
    }
    // árboles del parque, bancas y quiosco
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + 0.2;
      this._tree(32 + Math.cos(a) * 14.5 + rand(-1, 1), -30 + Math.sin(a) * 14.5 + rand(-1, 1), rand(1, 1.4));
    }
    for (const [x, z] of [[14, -45], [50, -45], [50, -16], [20, -20], [44, -20], [16, -36], [46, -36]]) this._tree(x, z, rand(1, 1.3));
    this._bench(32, -20.8, Math.PI);
    this._bench(32, -39.4, 0);
    this._bench(22.4, -30, Math.PI / 2);
    this._bench(41.6, -30, -Math.PI / 2);
    const k = this._house(14, -14, 4.5, 3.6, 3, 0xffe9a8, 0xd4216c, "s");
    this._sign("KIOSCO", 14, 3.4, -12.1, 3.4, 0.9, "#D4216C", 60);
    this.deliverySpots.push({ x: 14, z: -10.2, name: "el Kiosco del Parque" });
    // escondites del perrito
    this.dogSpots = [[44, -44], [18, -44], [47, -22], [22, -24]];
  }

  // --- esquina suroeste: el huerto de manzanas ---

  _buildSouthWest() {
    this.appleTrees = [];
    const xs = [-45, -35, -25, -15];
    const zs = [20, 30, 40];
    for (const x of xs) for (const z of zs) {
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, 2.4, 8), this.m.trunk);
      trunk.position.y = 1.2;
      trunk.castShadow = true;
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(2.0, 1), this._std(0x3aa84a, 0.8));
      crown.position.y = 3.6;
      crown.scale.set(1, 0.85, 1);
      crown.castShadow = true;
      g.add(trunk, crown);
      g.position.set(x, Y0, z);
      this.scene.add(g);
      this.colliders.push({ type: "c", x, z, r: 0.5 });
      this.appleTrees.push({ g, x, z, shake: 0 });
      for (let i = 0; i < 4; i++) {
        const a = rnd() * 6.28;
        const r = 1.2 + rnd() * 0.9;
        const apple = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), this._std(0xe22a2a, 0.35, { emissive: 0x4a0808, emissiveIntensity: 0.3 }));
        apple.position.set(Math.cos(a) * r, 3.3 + rnd() * 1.1, Math.sin(a) * r);
        g.add(apple);
        this.apples.push({ mesh: apple, tree: g, x: x + Math.cos(a) * r, z: z + Math.sin(a) * r, got: false, fly: 0 });
      }
    }
    // manzanas caídas en el pasto
    for (let i = 0; i < 6; i++) {
      const x = -48 + rnd() * 36;
      const z = 16 + rnd() * 30;
      const apple = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), this._std(0xe22a2a, 0.35, { emissive: 0x4a0808, emissiveIntensity: 0.3 }));
      apple.position.set(x, 0.25, z);
      this.scene.add(apple);
      this.apples.push({ mesh: apple, tree: null, x, z, got: false, fly: 0 });
    }
    // la casita de Doña Rosa y un cartel
    this._house(-30, 50, 9, 5, 4, 0xffe0c0, 0x2c6fb7, "n");
    this._sign("HUERTO ROSA", -30, 5.3, 47.4, 4.6, 1.15, "#2fa86a", 52);
    this.deliverySpots.push({ x: -30, z: 46.8, name: "la Granja de Doña Rosa" });
    for (let x = -49; x <= -11; x += 2.4) this._fencePanel(x, 15.6, 0, false);
    this._tree(-52, 18, 1.1); this._tree(-10, 18, 1.1); this._tree(-52, 48, 1.2); this._tree(-10, 48, 1.2);
  }

  // --- esquina sureste: la plaza y la Fábrica ---

  _buildSouthEast() {
    const s = this.scene;
    // fuente de chocolate
    const fx = 24;
    const fz = 24;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.6, 0.8, 24), this._std(0xe9dcc4, 0.7));
    base.position.set(fx, 0.4, fz);
    const choc = new THREE.Mesh(new THREE.CylinderGeometry(3.7, 3.7, 0.12, 24), this._std(0x5a2d16, 0.12, { metalness: 0.15 }));
    choc.position.set(fx, 0.82, fz);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 2.4, 12), this._std(0xd4216c, 0.5));
    col.position.set(fx, 1.8, fz);
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.9, 14, 10), this._std(0x5a2d16, 0.15));
    top.position.set(fx, 3.2, fz);
    for (const m of [base, col, top]) m.castShadow = true;
    s.add(base, choc, col, top);
    const lg = makeLogo(2.2);
    lg.position.set(fx, 2.0, fz + 0.9);
    s.add(lg);
    this.colliders.push({ type: "c", x: fx, z: fz, r: 4.5 });
    this.fountainTop = top;
    // macetas (misión de regar): 6 alrededor de la plaza
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      const x = fx + Math.cos(a) * 9.2;
      const z = fz + Math.sin(a) * 9.2;
      const g = new THREE.Group();
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.4, 0.7, 12), this._std(0xc4572b, 0.7));
      pot.position.y = 0.35;
      g.add(pot);
      const stem = new THREE.Group();
      g.add(stem);
      const wilt = new THREE.Group();
      for (let k = 0; k < 3; k++) {
        const st = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.6, 5), this._std(0x8a6a3a, 0.9));
        st.position.set((k - 1) * 0.15, 0.95, 0);
        st.rotation.z = (k - 1) * 0.8;
        wilt.add(st);
      }
      g.add(wilt);
      const bloom = new THREE.Group();
      const pc = [0xff4a8a, 0xffc800, 0xff7a1a, 0xb06aff, 0xffffff, 0xff4a8a][i];
      for (let k = 0; k < 3; k++) {
        const st = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.8, 5), this._std(0x3aa84a, 0.7));
        st.position.set((k - 1) * 0.2, 1.05, 0);
        const fl = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), this._std(pc, 0.4, { emissive: pc, emissiveIntensity: 0.25 }));
        fl.position.set((k - 1) * 0.2, 1.5, 0);
        bloom.add(st, fl);
      }
      bloom.visible = false;
      g.add(bloom);
      g.position.set(x, Y0, z);
      g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      s.add(g);
      this.colliders.push({ type: "c", x, z, r: 0.6 });
      this.pots.push({ g, wilt, bloom, x, z, watered: false });
    }
    // basureros y papeles
    for (const [x, z] of [[14.5, 14.5], [35, 33], [12.5, 36]]) this._bin(x, z);
    for (let i = 0; i < 12; i++) {
      const a = rnd() * 6.28;
      const r = 6 + rnd() * 22;
      const x = clamp(fx + Math.cos(a) * r, 9, 51);
      const z = clamp(fz + Math.sin(a) * r * 0.9, 9, 40);
      if (Math.hypot(x - fx, z - fz) < 5.5) { i--; continue; }
      const p = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24, 0), this._std(0xfff6e6, 0.7, { emissive: 0xfff0a0, emissiveIntensity: 0.55 }));
      p.position.set(x, 0.3, z);
      s.add(p);
      this.trash.push({ mesh: p, x, z, got: false, fly: 0 });
    }
    // la Fábrica de Chocolate
    const fac = this._house(28, 47, 26, 9, 8, 0xf4cba4, 0x7a3a22, "n");
    this._sign("FÁBRICA MATICHOC", 28, 7.3, 42.4, 12, 1.9, "#64321B", 64);
    const chim = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 6, 10), this._std(0xb5523a, 0.8));
    chim.position.set(37, 11, 49);
    chim.castShadow = true;
    s.add(chim);
    const logoF = makeLogo(5);
    logoF.position.set(19, 4.4, 42.4);
    s.add(logoF);
    const logoG = makeLogo(5);
    logoG.position.set(37, 4.4, 42.4);
    s.add(logoG);
    this.deliverySpots.push({ x: 28, z: 39.6, name: "la Fábrica" });
    this.smoke = [];
    for (let i = 0; i < 5; i++) {
      const sm = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }));
      sm.position.set(37, 14 + i, 49);
      s.add(sm);
      this.smoke.push({ m: sm, t: i / 5 });
    }
    // casita de la panadería y bancas
    this._house(46, 14, 8, 6, 3.6, 0xffc2dc, 0xd4216c, "s");
    this._sign("PANADERÍA", 46, 4.1, 17.1, 5.4, 1.2, "#D4216C", 58);
    this._bench(14, 22, Math.PI / 2);
    this._bench(34, 22, -Math.PI / 2);
    for (const [x, z] of [[10, 10], [50, 10], [10, 52], [52, 52], [41, 24], [40, 33]]) this._tree(x, z, rand(1, 1.3));
  }

  _buildTrees() {
    // árboles de afuera de la ciudad, para que el mundo no se vea vacío
    // (en un cuadrado alrededor de las calles, bien separados de ellas: nunca sobre la calzada ni la vereda)
    for (let i = 0; i < 90; i++) {
      const a = rnd() * 6.28;
      const dx = Math.cos(a);
      const dz = Math.sin(a);
      const d = Math.min(125, (76 + rnd() * 18) / Math.max(Math.abs(dx), Math.abs(dz)));
      this._tree(dx * d, dz * d, 0.9 + rnd() * 0.9, false);
    }
    const n = this.treeSpots.length;
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.26, 1.8, 6);
    const crownGeo = new THREE.IcosahedronGeometry(1.35, 0);
    const trunks = new THREE.InstancedMesh(trunkGeo, this.m.trunk, n);
    const crowns = new THREE.InstancedMesh(crownGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, flatShading: true }), n);
    const greens = [0x9be39a, 0xb7ecaa, 0x86d9b0, 0xffc2dc, 0xffa8cc, 0xffd9a0, 0xffb8d6]; // verdes suaves y sakura
    const mat = new THREE.Matrix4();
    const col = new THREE.Color();
    this.treeSpots.forEach(([x, z, sc], i) => {
      mat.compose(new THREE.Vector3(x, 0.9 * sc, z), new THREE.Quaternion(), new THREE.Vector3(sc, sc, sc));
      trunks.setMatrixAt(i, mat);
      mat.compose(new THREE.Vector3(x, 2.6 * sc, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), hash01(i) * 6), new THREE.Vector3(sc * 1.1, sc * 1.2, sc * 1.1));
      crowns.setMatrixAt(i, mat);
      col.setHex(greens[hash01(i + 9) < 0.86 ? Math.floor(hash01(i + 3) * 4) : 4 + Math.floor(hash01(i + 5) * 2)]);
      crowns.setColorAt(i, col);
    });
    trunks.castShadow = true;
    crowns.castShadow = true;
    this.scene.add(trunks, crowns);
  }

  _buildLamps() {
    const spots = [];
    for (const t of [-50, -25, 25, 50]) {
      for (const sg of [-1, 1]) {
        spots.push([t, sg * (HALF - RW / 2 - 0.9)], [t, sg * (HALF + RW / 2 + 0.9)]);
        spots.push([sg * (HALF - RW / 2 - 0.9), t], [sg * (HALF + RW / 2 + 0.9), t]);
      }
    }
    const post = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.14, 4.4, 6), this._std(0x3a3a44, 0.6), spots.length);
    const bulb = new THREE.InstancedMesh(new THREE.SphereGeometry(0.34, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff1b0 }), spots.length);
    const mat = new THREE.Matrix4();
    spots.forEach(([x, z], i) => {
      mat.makeTranslation(x, 2.2, z);
      post.setMatrixAt(i, mat);
      mat.makeTranslation(x, 4.5, z);
      bulb.setMatrixAt(i, mat);
      this.colliders.push({ type: "c", x, z, r: 0.2 });
    });
    this.scene.add(post, bulb);
  }

  // ---------- marcadores, autos y gente ----------

  _buildMarkers() {
    // haz de luz que marca a dónde ir
    const g = new THREE.Group();
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 60, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xffc800, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.y = 30;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.16, 8, 32), new THREE.MeshBasicMaterial({ color: 0xffc800 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.2;
    g.add(beam, ring);
    g.visible = false;
    this.scene.add(g);
    this.beacon = { g, ring };
    // signo "!" sobre los vecinos con misiones
    this.bangTex = canvasTexture(64, 64, (c, w, h) => {
      c.fillStyle = "#ffc800"; c.beginPath(); c.arc(w / 2, h / 2, 28, 0, 6.3); c.fill();
      c.strokeStyle = "#fff"; c.lineWidth = 4; c.stroke();
      c.fillStyle = "#64321b"; c.font = "bold 44px sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("!", w / 2, h / 2 + 3);
    });
    // aros de la carrera
    this.gateMeshes = GATES.map(([x, z], i) => {
      const r = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.28, 8, 28), new THREE.MeshBasicMaterial({ color: i === GATES.length - 1 ? 0xffffff : 0xffc800 }));
      r.position.set(x, 3.2, z);
      r.visible = false;
      this.scene.add(r);
      return r;
    });
  }

  _buildCars() {
    const hc = buildCar({ body: 0xd4216c, roof: 0x64321b, trim: 0xffc800 });
    this.heroCar = hc;
    this.scene.add(hc.group);
    const cols = [[0x3b8cff, 0xfff6e6], [0x2fd08a, 0x64321b], [0xffc800, 0xd4216c], [0xff7a1a, 0xfff6e6]];
    this.traffic = cols.map(([body, roof], i) => {
      const c = buildCar({ body, roof, trim: 0xffffff, logo: i % 2 === 0 });
      this.scene.add(c.group);
      return { ...c, s: (PATH.len / 4) * i + 10, v: 0, x: 0, z: 0, yaw: 0, wait: 0, honk: 0 };
    });
  }

  _makeNpc(charIdx, seed, name) {
    const pool = ITEMS.filter((i) => ["hair", "hat", "glasses", "neck", "back", "shoes", "face"].includes(i.slot));
    const slots = ["hair", "hat", "glasses", "neck", "back", "shoes", "face"];
    const r = (() => { let s = seed * 97 + 13; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
    const char = CHARACTERS[charIdx % CHARACTERS.length];
    const look = { hair: "", hairColor: "", face: "", hat: "", glasses: "", neck: "", back: "", outfit: OUTFITS[Math.floor(r() * OUTFITS.length)].id, shoes: "", skin: "", trail: "" };
    for (const slot of slots) {
      const opts = pool.filter((it) => it.slot === slot && it.rarity !== "legendario");
      if (opts.length && r() < (slot === "hat" ? 0.5 : 0.35)) look[slot] = opts[Math.floor(r() * opts.length)].id;
    }
    const h = createMatichico(char, getOutfit(look.outfit), look);
    h.group.scale.setScalar(1.08);
    // cada personaje tiene ~70 mallas: los vecinos no tiran sombra para cuidar el celular
    this.scene.add(h.group);
    if (name) {
      const lab = labelSprite(name);
      lab.position.set(0, 3.15, 0);
      h.group.add(lab);
    }
    return h;
  }

  _buildPeople() {
    // vecinos con misiones
    let i = 0;
    for (const [id, d] of Object.entries(GIVERS)) {
      const h = this._makeNpc(d.char, 40 + i, d.name);
      h.group.position.set(d.x, Y0, d.z);
      h.group.rotation.y = d.yaw;
      const bang = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.bangTex, depthTest: false, transparent: true }));
      bang.scale.set(0.9, 0.9, 1);
      bang.position.set(0, 3.95, 0);
      bang.renderOrder = 11;
      h.group.add(bang);
      this.npcs[id] = { id, h, x: d.x, z: d.z, yaw: d.yaw, bang, home: { x: d.x, z: d.z }, anim: "idle" };
      i++;
    }
    // la abuelita se mueve: la tratamos aparte
    this.tita = this.npcs.tita;
    // gente que pasea por las veredas
    const blocks = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    for (let k = 0; k < 5; k++) {
      const [sx, sz] = blocks[k % 4];
      const lo = 6.8;
      const hi = 53.2;
      const corners = [[sx * lo, sz * lo], [sx * hi, sz * lo], [sx * hi, sz * hi], [sx * lo, sz * hi]];
      const dir = k < 4 ? 1 : -1;
      if (k === 4) { /* el quinto camina al revés por el primer bloque */ }
      const h = this._makeNpc(k + 1, 100 + k);
      const start = corners[k % 4];
      h.group.position.set(start[0], Y0, start[1]);
      this.peds.push({ h, corners, i: k % 4, dir, x: start[0], z: start[1], v: 1.6 + rnd() * 0.6, pause: rnd() * 3, push: { x: 0, z: 0, t: 0 }, say: 0, chat: PED_CHATS[k % PED_CHATS.length] });
    }
    // el perrito Choco
    const dog = new THREE.Group();
    const bm = this._std(0xa8672e, 0.7);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.45, 0.95), bm);
    body.position.y = 0.55;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.4, 0.42), bm);
    head.position.set(0, 0.85, 0.55);
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.22), this._std(0x5a2d16, 0.7));
    snout.position.set(0, 0.8, 0.82);
    dog.add(body, head, snout);
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.2), this._std(0x5a2d16, 0.7));
      ear.position.set(sx * 0.24, 0.92, 0.5);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.4, 0.14), bm);
      leg.position.set(sx * 0.2, 0.2, 0.3);
      const leg2 = leg.clone();
      leg2.position.z = -0.3;
      dog.add(ear, leg, leg2);
    }
    this.tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.4), bm);
    this.tail.position.set(0, 0.8, -0.65);
    dog.add(this.tail);
    dog.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    dog.visible = false;
    this.scene.add(dog);
    this.dog = { g: dog, x: 0, z: 0, state: "hidden", t: 0 };
  }

  _buildGolds() {
    const tex = goldCoinTexture();
    const spots = [];
    for (let i = 0; i < 26; i++) {
      // sobre las calles, veredas y parques: puntos repartidos por la ciudad
      const k = i % 4;
      let x;
      let z;
      if (k === 0) { x = rand(-56, 56); z = (rnd() < 0.5 ? -1 : 1) * 57.25; }
      else if (k === 1) { z = rand(-56, 56); x = (rnd() < 0.5 ? -1 : 1) * 57.25; }
      else if (k === 2) { x = (rnd() < 0.5 ? -1 : 1) * rand(10, 50); z = (rnd() < 0.5 ? -1 : 1) * rand(10, 50); }
      else { x = rand(-4, 4); z = rand(-50, 50); }
      if (this.colliders.some((c) => (c.type === "c" ? Math.hypot(c.x - x, c.z - z) < c.r + 0.8 : Math.abs(c.x - x) < c.hw + 0.8 && Math.abs(c.z - z) < c.hd + 0.8))) { i--; continue; }
      spots.push([x, z]);
    }
    for (const [x, z] of spots) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex }));
      sp.scale.set(1.0, 1.0, 1);
      sp.position.set(x, 1.3, z);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 6, 20), new THREE.MeshBasicMaterial({ color: 0xffc800 }));
      ring.position.set(x, 1.3, z);
      this.scene.add(sp, ring);
      this.golds.push({ sp, ring, x, z, got: false, ph: rnd() * 6 });
    }
  }

  _buildMinimap() {
    const S = 132;
    const sc = S / 300; // el mapa muestra -150..150 (el centro y los barrios nuevos)
    const c = document.createElement("canvas");
    c.width = c.height = S;
    const g = c.getContext("2d");
    g.fillStyle = "#6fbf5f"; g.fillRect(0, 0, S, S);
    const X = (x) => S / 2 + x * sc;
    // barrios nuevos: parque, playa (con el mar) y colegio
    const tint = { parque: "#8fdc72", playa: "#f6dfa4", colegio: "#b8d98f" };
    for (const a of AREAS) { g.fillStyle = tint[a.id]; g.fillRect(X(a.x0), X(a.z0), (a.x1 - a.x0) * sc, (a.z1 - a.z0) * sc); }
    g.fillStyle = "#3ea8e0"; g.fillRect(X(128), X(-48), 22 * sc, 96 * sc);
    g.fillStyle = "#5ab8e8"; g.beginPath(); g.arc(X(0), X(-108), 12 * sc, 0, 6.3); g.fill();
    g.fillStyle = "#4b4b55";
    for (const r of ROADS) g.fillRect(X(r.x0), X(r.z0), (r.x1 - r.x0) * sc, (r.z1 - r.z0) * sc);
    g.fillStyle = "#e9dcc4";
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.fillRect(X(sx * 30 - 24.5), X(sz * 30 - 24.5), 49 * sc, 49 * sc);
    g.fillStyle = "#8fd67a";
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.fillRect(X(sx * 30 - 22.5), X(sz * 30 - 22.5), 45 * sc, 45 * sc);
    g.fillStyle = "#6fd0ff"; g.beginPath(); g.arc(X(32), X(-30), 7.5 * sc, 0, 6.3); g.fill();
    g.fillStyle = "#c8643a";
    for (const c2 of this.colliders) if (c2.type === "b") g.fillRect(X(c2.x - c2.hw), X(c2.z - c2.hd), c2.hw * 2 * sc, c2.hd * 2 * sc);
    g.fillStyle = "#3aa84a";
    for (const a of this.appleTrees) { g.beginPath(); g.arc(X(a.x), X(a.z), 1.6 * sc, 0, 6.3); g.fill(); }
    g.fillStyle = "#5a2d16"; g.beginPath(); g.arc(X(24), X(24), 4 * sc, 0, 6.3); g.fill();
    this.mapBase = c;
    this.mapScale = sc;
    this.mapEl = this.q("minimap");
    this.mapCtx = this.mapEl ? this.mapEl.getContext("2d") : null;
    if (this.mapEl) { this.mapEl.width = this.mapEl.height = S; }
  }

  _ensureHero() {
    if (this.hero && this.heroId === this.character.id) {
      this.hero.setLook(this.look);
      return;
    }
    if (this.hero) this.scene.remove(this.hero.group);
    this.hero = createMatichico(this.character, this.outfit, this.look);
    this.heroId = this.character.id;
    this.hero.group.scale.setScalar(1.08);
    this.hero.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.scene.add(this.hero.group);
  }

  // ---------- partida ----------

  reset() {
    this._ensureHero();
    if (this.inCar) this._leaveCar(true);
    this.car = { x: 4.2, z: 8, heading: Math.PI, speed: 0, steer: 0 };
    this.pos.set(0, Y0, 16);
    this.vel.set(0, 0, 0);
    this.heroYaw = Math.PI;
    this.camYaw = 0;
    this.camFocus = null;
    this.active = null;
    this.target = null;
    this.wayTo = null;
    this.dialog = null;
    this.score = 0;
    this.lock = 0;
    this.joy.x = this.joy.y = 0;
    this.keys = {};
    this.hero.group.rotation.set(0, this.heroYaw, 0);
    this.hero.group.scale.setScalar(1.08);
    this.scene.add(this.hero.group);
    const done = this.save.done;
    this._paintPanels(!!done.reja);
    for (const a of this.apples) { if (!a.home) a.home = a.mesh.position.clone(); a.got = false; a.fly = 0; a.mesh.visible = true; a.mesh.scale.setScalar(1); a.mesh.position.copy(a.home); }
    for (const t of this.trash) { if (!t.home) t.home = t.mesh.position.clone(); t.got = false; t.fly = 0; t.mesh.visible = true; t.mesh.scale.setScalar(1); t.mesh.position.copy(t.home); }
    for (const p of this.pots) this._waterPot(p, !!done.flores, true);
    if (this.barrios) this.barrios.setDone(done);
    for (const g of this.golds) { g.got = false; g.sp.visible = g.ring.visible = true; }
    this.tita.x = this.tita.home.x;
    this.tita.z = this.tita.home.z;
    this.tita.h.group.position.set(this.tita.x, Y0, this.tita.z);
    this.tita.h.group.rotation.y = this.tita.yaw;
    this.dog.g.visible = false;
    this.dog.state = "hidden";
    this.beacon.g.visible = false;
    for (const g of this.gateMeshes) g.visible = false;
    this.shake = 0;
    this._updateBangs();
    this._closeList();
    const dlg = this.q("dialog");
    if (dlg) dlg.classList.add("hidden");
    this._updateHud(true);
  }

  onBegin() {
    this.banner("¡Bienvenido a Ciudad Choco! 🏙️");
    this._updateHud(true);
  }

  pauseForMenu() {
    this._flush();
    this.keys = {};
    this.joy.x = this.joy.y = 0;
    super.pauseForMenu();
  }

  _flush() {
    saveProgress(this.progress);
  }

  _paintPanels(done) {
    for (const p of this.panels) {
      p.done = done;
      p.paint = done ? 1 : 0;
      p.mat.color.setHex(done ? 0xff7ab0 : 0x9a9a9a);
    }
  }

  _waterPot(p, on, silent = false) {
    p.watered = on;
    p.wilt.visible = !on;
    p.bloom.visible = on;
    if (on && !silent) {
      this.particles.burst(new THREE.Vector3(p.x, 1.1, p.z), [0x6fd0ff, 0xffffff, 0xff4a8a, 0xffc800], 22, 3.5, 0.9, 5);
      audio.playPowerup();
    }
  }

  _updateBangs() {
    for (const m of MISSIONS) {
      const n = this.npcs[m.giver];
      if (!n) continue;
      n.bang.visible = this._available(m);
    }
  }

  // ---------- bucle ----------

  update(dt) {
    const playing = this.state === "playing";
    if (playing) {
      if (this.lock > 0) this.lock -= dt;
      if (this.inCar) this._driveCar(dt);
      else this._walk(dt);
      this._golds(dt);
      this._missionTick(dt);
      this._pickTarget();
    }
    if (this.barrios) this.barrios.update(dt, this._playerXZ());
    this._traffic(dt);
    this._people(dt);
    this._animateWorld(dt);
    this._syncHero(dt);
    this._updateCamera(dt);
    this._updateSun();
    this._updateBeacon(dt);
    this._updateHud();
    this._drawMinimap();
  }

  _playerXZ() {
    return this.inCar ? { x: this.car.x, z: this.car.z } : { x: this.pos.x, z: this.pos.z };
  }

  _input() {
    let ix = this.joy.x;
    let iy = this.joy.y;
    if (this.keys.left) ix -= 1;
    if (this.keys.right) ix += 1;
    if (this.keys.up) iy += 1;
    if (this.keys.down) iy -= 1;
    const m = Math.hypot(ix, iy);
    if (m > 1) { ix /= m; iy /= m; }
    return { ix, iy, mag: Math.min(1, m) };
  }

  setStick(x, y) {
    this.joy.x = x;
    this.joy.y = y;
  }

  _walk(dt) {
    if (this.dialog) { this.vel.multiplyScalar(0.8); return; }
    const inp = this._input();
    const yaw = this.camYaw;
    const dx = -Math.sin(yaw) * inp.iy + Math.cos(yaw) * inp.ix;
    const dz = -Math.cos(yaw) * inp.iy - Math.sin(yaw) * inp.ix;
    const top = (this.keys.sprint ? 9 : 4.6 + 3.2 * Math.max(0, inp.mag - 0.55) / 0.45) * Math.min(1, inp.mag / 0.55 + 0.35);
    const acc = 46 * dt;
    this.vel.x += clamp(dx * top - this.vel.x, -acc, acc);
    this.vel.z += clamp(dz * top - this.vel.z, -acc, acc);
    if (inp.mag > 0.1) this.heroYaw = Math.atan2(dx, dz);
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this._collide(this.pos, HERO_R);
    // el auto es un obstáculo para quien va a pie
    for (const c of this._carCircles(this.car)) this._pushCircle(this.pos, HERO_R, c.x, c.z, c.r);
    for (const t of this.traffic) this._pushCircle(this.pos, HERO_R, t.x, t.z, 1.6);
    this._limit(this.pos, 1);
  }

  /** No salirse de la ciudad: el centro (un círculo) y los barrios nuevos (rectángulos; el mar no, salvo el muelle). */
  _limit(p, k) {
    const r = Math.hypot(p.x, p.z);
    if (r <= LIMIT * k) return;
    if (this.barrios && this.barrios.inBarrio(p.x, p.z)) return;
    const rx = (p.x * LIMIT * k) / r;
    const rz = (p.z * LIMIT * k) / r;
    const c = this.barrios ? this.barrios.clampInto(p) : null;
    if (c && c.d < Math.hypot(rx - p.x, rz - p.z)) { p.x = c.x; p.z = c.z; } else { p.x = rx; p.z = rz; }
  }

  _pushCircle(p, rad, cx, cz, cr) {
    const dx = p.x - cx;
    const dz = p.z - cz;
    const d = Math.hypot(dx, dz);
    const min = cr + rad;
    if (d < min) {
      const k = d > 1e-4 ? min / d : 1;
      p.x = cx + (d > 1e-4 ? dx * k : min);
      p.z = cz + (d > 1e-4 ? dz * k : 0);
      return true;
    }
    return false;
  }

  _collide(p, rad) {
    let hit = false;
    for (const c of this.colliders) {
      if (c.type === "c") {
        if (this._pushCircle(p, rad, c.x, c.z, c.r)) hit = true;
      } else {
        const ox = c.hw + rad - Math.abs(p.x - c.x);
        const oz = c.hd + rad - Math.abs(p.z - c.z);
        if (ox > 0 && oz > 0) {
          if (ox < oz) p.x = c.x + Math.sign(p.x - c.x || 1) * (c.hw + rad);
          else p.z = c.z + Math.sign(p.z - c.z || 1) * (c.hd + rad);
          hit = true;
        }
      }
    }
    return hit;
  }

  _carCircles(c) {
    const s = Math.sin(c.heading);
    const co = Math.cos(c.heading);
    return [{ x: c.x + s * 1.1, z: c.z + co * 1.1, r: CAR_R }, { x: c.x - s * 1.1, z: c.z - co * 1.1, r: CAR_R }];
  }

  // ---------- el auto ----------

  _driveCar(dt) {
    const c = this.car;
    const inp = this._input();
    let thr = inp.iy;
    let steer = inp.ix;
    // pedales de la pantalla: ⛽ acelera; 🛑 frena y, si ya estás detenido y lo mantienes un ratito, da reversa
    if (this.keys.gas) thr = 1;
    if (this.keys.stop) {
      this._revT = (this._revT || 0) + dt;
      if (c.speed > 0.5) thr = -1;
      else thr = this._revT > 0.6 ? -0.7 : 0;
    } else this._revT = 0;
    if (this.keys.brake) thr = Math.min(thr, -0.001);
    if (this.dialog || this.lock > 0) { thr = 0; steer = 0; }
    const road = onRoad(c.x, c.z);
    const maxV = road ? 25 : 13;
    if (thr > 0.08) {
      if (c.speed < -0.5) c.speed += 34 * dt;
      else c.speed += thr * 15 * dt * clamp(1 - Math.max(0, c.speed) / (maxV + 4), 0, 1);
    } else if (thr < -0.08) {
      if (c.speed > 0.5) c.speed -= 30 * dt;
      else c.speed = Math.max(-8, c.speed + thr * 10 * dt);
    } else {
      const f = 6 * dt;
      c.speed -= Math.sign(c.speed) * Math.min(Math.abs(c.speed), f);
    }
    if (this.keys.hand) c.speed -= Math.sign(c.speed) * Math.min(Math.abs(c.speed), 34 * dt);
    if (c.speed > maxV) c.speed -= 16 * dt;
    c.steer = lerp(c.steer, steer, 1 - Math.exp(-10 * dt));
    const turn = c.steer * 1.95 * clamp(Math.abs(c.speed) / 4, 0, 1) / (1 + Math.abs(c.speed) / 28);
    c.heading -= turn * Math.sign(c.speed || 1) * dt;
    const ox = c.x;
    const oz = c.z;
    c.x += Math.sin(c.heading) * c.speed * dt;
    c.z += Math.cos(c.heading) * c.speed * dt;
    // choques suaves con casas, árboles y otros autos
    let bumped = false;
    for (const circ of this._carCircles(c)) {
      const p = { x: circ.x, z: circ.z };
      const mx = p.x;
      const mz = p.z;
      if (this._collide(p, circ.r)) { c.x += p.x - mx; c.z += p.z - mz; bumped = true; }
    }
    for (const t of this.traffic) {
      for (const circ of this._carCircles(c)) {
        const dx = circ.x - t.x;
        const dz = circ.z - t.z;
        const d = Math.hypot(dx, dz) || 1;
        if (d < circ.r + 1.5) {
          const push = (circ.r + 1.5 - d) * 0.6;
          c.x += (dx / d) * push;
          c.z += (dz / d) * push;
          bumped = true;
        }
      }
    }
    if (bumped && Math.abs(c.speed) > 2.5) {
      if (!this._bumpCool || this._bumpCool <= 0) { audio.playBump(); this.shake = Math.min(0.5, 0.1 + Math.abs(c.speed) * 0.015); this._bumpCool = 0.35; this.haptic(25); }
      c.speed *= 0.4;
    }
    if (this._bumpCool > 0) this._bumpCool -= dt;
    this._limit(c, 1);
    this.stats.km += Math.hypot(c.x - ox, c.z - oz) / 1000;
    this.progress.stats.ciudadKm = (this.progress.stats.ciudadKm || 0) + Math.hypot(c.x - ox, c.z - oz) / 1000;
    // los peatones se corren
    for (const p of this.peds) {
      const d = Math.hypot(p.x - c.x, p.z - c.z);
      if (d < 3.4 && Math.abs(c.speed) > 3) { const k = 1 / (d || 1); p.push = { x: (p.x - c.x) * k, z: (p.z - c.z) * k, t: 0.6 }; }
    }
    this.pos.set(c.x, Y0, c.z);
    this.heroYaw = c.heading;
  }

  _enterCar() {
    if (this.inCar) return;
    this.inCar = true;
    this.vel.set(0, 0, 0);
    const g = this.hero.group;
    this.heroCar.group.add(g);
    g.position.set(0, 0.62, -0.1);
    g.rotation.set(0, 0, 0);
    g.scale.setScalar(0.64);
    audio.playPowerup();
    this._setDriveUi(true);
    this.banner("🚗 ¡A manejar! Gira con el volante y mantén ⛽ para avanzar");
  }

  /** En el auto, el joystick pasa a ser un volante (solo gira) y aparecen los pedales: ⛽ acelerar y 🛑 frenar. */
  _setDriveUi(on) {
    const joy = this.q("joy");
    if (joy) { joy.classList.toggle("steer", on); joy.style.setProperty("--steer", "0"); }
    this.els.wrap?.classList.toggle("driving", on);
    for (const id of ["btn-gas", "btn-stop"]) this.q(id)?.classList.toggle("hidden", !on);
    this.joy.x = 0; this.joy.y = 0;
    this.keys.gas = false; this.keys.stop = false;
  }

  _leaveCar(silent = false) {
    if (!this.inCar) return;
    this._setDriveUi(false);
    const c = this.car;
    this.inCar = false;
    const g = this.hero.group;
    this.scene.add(g);
    g.scale.setScalar(1.08);
    // baja por la puerta derecha
    const rx = -Math.cos(c.heading) * 2.4;
    const rz = Math.sin(c.heading) * 2.4;
    this.pos.set(c.x + rx, Y0, c.z + rz);
    this._collide(this.pos, HERO_R);
    c.speed = 0;
    this.heroYaw = c.heading;
    g.position.copy(this.pos);
    if (!silent) audio.playPop();
  }

  // ---------- autos de la ciudad, gente y mundo ----------

  _traffic(dt) {
    const pl = this._playerXZ();
    const tita = this.tita;
    this.traffic.forEach((c, idx) => {
      const p = pathAt(c.s);
      const fx = Math.sin(p.yaw);
      const fz = Math.cos(p.yaw);
      let block = false;
      const things = [{ x: this.pos.x, z: this.pos.z }, { x: this.car.x, z: this.car.z }, { x: tita.x, z: tita.z }, ...this.traffic.filter((o) => o !== c).map((o) => ({ x: o.x, z: o.z }))];
      for (const b of things) {
        const dx = b.x - p.x;
        const dz = b.z - p.z;
        const f = dx * fx + dz * fz;
        const l = dx * fz - dz * fx;
        if (f > 0.8 && f < 5.5 + c.v * 0.9 && Math.abs(l) < 2.3) { block = true; break; }
      }
      const want = block ? 0 : 7.5 + (idx % 2);
      c.v += clamp(want - c.v, -22 * dt, 5 * dt);
      c.s += c.v * dt;
      const q = pathAt(c.s);
      c.x = q.x;
      c.z = q.z;
      let dy = q.yaw - c.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      c.yaw += dy * Math.min(1, dt * 8);
      c.group.position.set(c.x, Y0, c.z);
      c.group.rotation.y = c.yaw;
      for (const w of c.wheels) w.g.rotation.x += (c.v * dt) / 0.42;
      if (block && c.v < 0.5) c.wait += dt; else c.wait = 0;
    });
    void pl;
  }

  _people(dt) {
    const me = this._playerXZ();
    for (const p of this.peds) {
      const g = p.h.group;
      const far = Math.hypot(p.x - me.x, p.z - me.z) > 48;
      g.visible = !far;
      if (far) { this._pedStep(p, dt); continue; }
      if (p.push.t > 0) {
        p.push.t -= dt;
        p.x += p.push.x * 6 * dt;
        p.z += p.push.z * 6 * dt;
        g.position.set(p.x, Y0 + Math.sin(p.push.t * 10) * 0.2, p.z);
        p.h.animate(this.time, "jump", 1);
        continue;
      }
      if (p.pause > 0) { p.pause -= dt; p.h.animate(this.time, "idle", 1); g.position.set(p.x, Y0, p.z); continue; }
      const tgt = p.corners[(p.i + p.dir + 4) % 4];
      const dx = tgt[0] - p.x;
      const dz = tgt[1] - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.5) { p.i = (p.i + p.dir + 4) % 4; if (rnd() < 0.5) p.pause = 1 + rnd() * 3; continue; }
      p.x += (dx / d) * p.v * dt;
      p.z += (dz / d) * p.v * dt;
      g.position.set(p.x, Y0, p.z);
      g.rotation.y = lerp(g.rotation.y, Math.atan2(dx, dz), 1 - Math.exp(-8 * dt));
      p.h.animate(this.time, "run", 0.5);
    }
    // vecinos de las misiones: se quedan en su lugar mirando al jugador si están cerca
    const pl = this._playerXZ();
    for (const n of Object.values(this.npcs)) {
      if (n === this.tita && this.active && this.active.id === "abuelita") continue;
      const g = n.h.group;
      const d = Math.hypot(pl.x - n.x, pl.z - n.z);
      g.visible = d < 70;
      if (d > 70) continue;
      if (d < 7) g.rotation.y = lerp(g.rotation.y, Math.atan2(pl.x - n.x, pl.z - n.z), 1 - Math.exp(-5 * dt));
      n.h.animate(this.time, "idle", 1);
      n.bang.position.y = 3.95 + Math.sin(this.time * 4 + n.x) * 0.12;
    }
  }

  /** Gente lejana: solo avanza por la vereda, sin dibujarse ni animarse. */
  _pedStep(p, dt) {
    const tgt = p.corners[(p.i + p.dir + 4) % 4];
    const dx = tgt[0] - p.x;
    const dz = tgt[1] - p.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.5) { p.i = (p.i + p.dir + 4) % 4; return; }
    p.x += (dx / d) * p.v * dt;
    p.z += (dz / d) * p.v * dt;
    p.h.group.position.set(p.x, Y0, p.z);
  }

  _golds(dt) {
    const pl = this._playerXZ();
    const today = todayKey();
    const sv = this.save;
    if (sv.gDay !== today) { sv.gDay = today; sv.gCount = 0; }
    for (const g of this.golds) {
      if (g.got) continue;
      g.sp.position.y = 1.3 + Math.sin(this.time * 2.4 + g.ph) * 0.18;
      g.ring.position.y = g.sp.position.y;
      g.ring.rotation.set(this.time * 1.6 + g.ph, this.time, 0);
      if (Math.hypot(pl.x - g.x, pl.z - g.z) < (this.inCar ? 2.4 : 1.6)) {
        g.got = true;
        g.sp.visible = g.ring.visible = false;
        if (sv.gCount < GOLD_CAP) {
          sv.gCount++;
          earnCoins(this.progress, 2);
          this.progress.stats.ciudadGold = (this.progress.stats.ciudadGold || 0) + 1;
          this.popups.add(new THREE.Vector3(g.x, 2.2, g.z), "+2", "combo");
          audio.playCollect();
        } else if (!this._goldFull) {
          this._goldFull = true;
          this.banner("Hoy ya juntaste muchos alfajores dorados ✨");
        }
        this.particles.burst(new THREE.Vector3(g.x, 1.3, g.z), [0xffc800, 0xfff6e6], 10, 3, 0.6, 4);
      }
    }
  }

  _animateWorld(dt) {
    for (const d of this.ducks || []) {
      d.a += d.sp * dt;
      d.g.position.set(32 + Math.cos(d.a) * d.r, 0.2 + Math.sin(this.time * 2 + d.r) * 0.03, -30 + Math.sin(d.a) * d.r);
      d.g.rotation.y = -d.a + Math.PI / 2 + (d.sp > 0 ? Math.PI : 0);
    }
    for (const s of this.smoke || []) {
      s.t = (s.t + dt * 0.18) % 1;
      s.m.position.set(37 + s.t * 3, 14 + s.t * 7, 49);
      s.m.scale.setScalar(0.6 + s.t * 1.8);
      s.m.material.opacity = 0.55 * (1 - s.t);
    }
    if (this.fountainTop) this.fountainTop.position.y = 3.2 + Math.sin(this.time * 2) * 0.06;
    for (const t of this.appleTrees) {
      if (t.shake > 0) { t.shake -= dt; t.g.rotation.z = Math.sin(t.shake * 40) * 0.05 * t.shake * 2; } else t.g.rotation.z = 0;
    }
    // manzanas y papeles que vuelan hacia el jugador cuando se recogen
    const pl = this._playerXZ();
    for (const list of [this.apples, this.trash]) {
      for (const a of list) {
        if (a.fly > 0) {
          a.fly -= dt;
          const k = 1 - Math.max(0, a.fly) / 0.4;
          const wp = new THREE.Vector3();
          a.mesh.getWorldPosition(wp);
          a.mesh.position.lerp(a.mesh.parent === this.scene ? new THREE.Vector3(pl.x, 1.4, pl.z) : new THREE.Vector3(pl.x - a.mesh.parent.position.x, 1.4, pl.z - a.mesh.parent.position.z), 0.25 + k * 0.4);
          a.mesh.scale.setScalar(Math.max(0.05, 1 - k));
          if (a.fly <= 0) a.mesh.visible = false;
        } else if (!a.got && a.mesh.visible && list === this.trash) {
          a.mesh.rotation.y += dt * 2;
          a.mesh.position.y = 0.32 + Math.sin(this.time * 3 + a.x) * 0.08;
        }
      }
    }
    // perrito
    const d = this.dog;
    if (d.g.visible) {
      if (d.state === "follow" || d.state === "home") {
        const tx = d.state === "home" ? GIVERS.lola.x + 1.2 : pl.x - Math.sin(this.heroYaw) * 1.8;
        const tz = d.state === "home" ? GIVERS.lola.z + 0.5 : pl.z - Math.cos(this.heroYaw) * 1.8;
        const dx = tx - d.x;
        const dz = tz - d.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.4) {
          const sp = Math.min(dist * 3, 9);
          d.x += (dx / dist) * sp * dt;
          d.z += (dz / dist) * sp * dt;
          d.g.rotation.y = Math.atan2(dx, dz);
          d.g.position.y = Y0 + Math.abs(Math.sin(this.time * 14)) * 0.12;
        } else d.g.position.y = Y0;
        d.g.position.x = d.x;
        d.g.position.z = d.z;
      } else d.g.position.y = Y0;
      this.tail.rotation.y = Math.sin(this.time * 18) * 0.7;
    }
  }

  _syncHero(dt) {
    if (this.inCar) {
      const c = this.car;
      const g = this.heroCar.group;
      g.position.set(c.x, Y0, c.z);
      g.rotation.y = c.heading;
      g.rotation.z = -c.steer * Math.min(1, Math.abs(c.speed) / 25) * 0.07;
      g.rotation.x = clamp(-(c.speed - (this._lastSpeed || 0)) * 0.01, -0.04, 0.04);
      this._lastSpeed = c.speed;
      for (const w of this.heroCar.wheels) {
        w.g.rotation.x += (c.speed * dt) / 0.42;
        if (w.front) w.g.rotation.y = c.steer * 0.45;
      }
      this.hero.animate(this.time, "drive", 1);
      return;
    }
    const g = this.hero.group;
    g.position.copy(this.pos);
    g.rotation.y = lerp(g.rotation.y, this.heroYaw, 1 - Math.exp(-16 * Math.max(dt, 0.016)));
    const sp = Math.hypot(this.vel.x, this.vel.z);
    this.hero.animate(this.time, sp > 0.8 ? "run" : "idle", clamp(sp / 5.2, 0.4, 1.6));
    // el auto estacionado
    const c = this.car;
    const cg = this.heroCar.group;
    cg.position.set(c.x, Y0, c.z);
    cg.rotation.set(0, c.heading, 0);
    if (Math.abs(c.speed) > 0.05) { c.speed *= 0.9; c.x += Math.sin(c.heading) * c.speed * dt; c.z += Math.cos(c.heading) * c.speed * dt; }
  }

  _placeCamera(snap = false) {
    const portrait = this.camera.aspect < 0.95;
    if (this.inCar) {
      const c = this.car;
      const want = c.heading + Math.PI + (this.camOff || 0);
      if (this._camCarYaw == null || snap) this._camCarYaw = want;
      let dy = want - this._camCarYaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      this._camCarYaw += dy * 0.06;
      this.camYaw = this._camCarYaw; // sirve para el joystick al bajar
      const dist = (portrait ? 13 : 10.5) + Math.abs(c.speed) * 0.1;
      const f = this.camFocus || new THREE.Vector3(c.x, 1.2, c.z);
      this.camera.position.set(f.x + Math.sin(this._camCarYaw) * dist, f.y + 4.3 + Math.abs(c.speed) * 0.03, f.z + Math.cos(this._camCarYaw) * dist);
      this.camera.lookAt(f.x - Math.sin(this._camCarYaw) * 3, f.y + 0.6, f.z - Math.cos(this._camCarYaw) * 3);
      return;
    }
    this._camCarYaw = null;
    const f = this.camFocus || new THREE.Vector3(this.pos.x, 1.4, this.pos.z);
    const dist = portrait ? 12 : 9;
    const cp = Math.cos(this.camPitch);
    this.camera.position.set(f.x + Math.sin(this.camYaw) * cp * dist, f.y + Math.sin(this.camPitch) * dist, f.z + Math.cos(this.camYaw) * cp * dist);
    this.camera.lookAt(f.x, f.y + 0.2, f.z);
  }

  _updateCamera(dt) {
    const k = 1 - Math.exp(-(this.inCar ? 14 : 9) * Math.max(dt, 0.001));
    const t = this.inCar ? new THREE.Vector3(this.car.x, 1.2, this.car.z) : new THREE.Vector3(this.pos.x, 1.4, this.pos.z);
    if (!this.camFocus) this.camFocus = t.clone();
    this.camFocus.lerp(t, k);
    this._placeCamera();
    if (this.shake > 0) {
      this.camera.position.x += rand(-this.shake, this.shake) * 0.5;
      this.camera.position.y += rand(-this.shake, this.shake) * 0.5;
      this.shake = Math.max(0, this.shake - dt * 1.6);
    }
    // al soltar el arrastre la cámara de auto vuelve sola detrás
    if (this.inCar && this.camOff && !this._dragging) this.camOff *= 0.96;
  }

  _updateSun() {
    const p = this._playerXZ();
    this.sun.target.position.set(p.x, 0, p.z);
    this.sun.position.set(p.x - 30, 50, p.z + 25);
  }

  _updateBeacon(dt) {
    const t = this.target;
    const b = this.beacon;
    b.g.visible = !!t && this.state === "playing";
    if (t) {
      b.g.position.set(t.x, Y0, t.z);
      const k = 1 + Math.sin(this.time * 4) * 0.1;
      b.ring.scale.setScalar(k * (t.r || 1));
    }
    void dt;
  }

  // ---------- misiones ----------

  _giverMission(id) { return MISSIONS.find((m) => m.giver === id); }

  _startMission(id) {
    const m = MISSIONS.find((x) => x.id === id);
    if (!spendEnergy(this.progress, ENERGY_MISSION)) {
      this._toast("😴 Sin energía para otra misión. ¡Recarga en el cofre, duerme en tu casa o espera un ratito!");
      try { window.dispatchEvent(new CustomEvent("no-energy", { detail: { need: ENERGY_MISSION, game: "ciudad" } })); } catch (e) { /* sin ventana */ }
      return;
    }
    this.active = { id, step: "do", n: 0, data: {} };
    this.wayTo = null;
    const init = {
      reja: () => { this._paintPanels(false); },
      manzanas: () => { for (const a of this.apples) { a.got = false; a.fly = 0; a.mesh.visible = true; a.mesh.scale.setScalar(1); if (a.home) a.mesh.position.copy(a.home); } },
      plaza: () => { for (const t of this.trash) { t.got = false; t.fly = 0; t.mesh.visible = true; t.mesh.scale.setScalar(1); if (t.home) t.mesh.position.copy(t.home); } },
      flores: () => { for (const p of this.pots) this._waterPot(p, false, true); },
      perrito: () => {
        const spot = this.dogSpots[Math.floor(Math.random() * this.dogSpots.length)];
        this.dog.x = spot[0];
        this.dog.z = spot[1];
        this.dog.state = "hidden";
        this.dog.g.visible = true;
        this.dog.g.position.set(spot[0], Y0, spot[1]);
        this.dog.g.rotation.y = rand(0, 6);
      },
      abuelita: () => { this.active.data.say = 0; },
      entrega: () => { this.active.data.order = [1, 0, 2].map((i) => this.deliverySpots[i]).filter(Boolean); this.active.data.i = 0; },
      carrera: () => { this.active.data = { phase: "goto", gate: 0, t: 0, count: 0, away: 0 }; },
    };
    init[id]?.();
    if (this.barrios.isMission(id)) this.barrios.reset(id);
    this._updateBangs();
    this.banner(`${m.icon} Misión: ${m.title}`);
    audio.playPowerup();
  }

  _cancelMission(silent = false) {
    if (!this.active) return;
    const id = this.active.id;
    this.active = null;
    this.target = null;
    this.dog.g.visible = false;
    this.dog.state = "hidden";
    for (const g of this.gateMeshes) g.visible = false;
    this.lock = 0;
    this._updateBangs();
    if (!silent) this.banner("Misión cancelada. ¡Puedes retomarla cuando quieras!");
    void id;
  }

  _completeMission(extra = {}) {
    const a = this.active;
    if (!a) return;
    const m = MISSIONS.find((x) => x.id === a.id);
    const sv = this.save;
    const before = sv.done[m.id] || 0;
    let reward = m.reward;
    let text = "";
    if (m.id === "carrera") {
      const medal = extra.medal || 0; // 0 sin medalla, 1 bronce, 2 plata, 3 oro
      const table = [20, 40, 60, 90];
      const prev = sv.medal || 0;
      reward = medal > prev ? table[medal] - (prev ? table[prev] : 0) : Math.round(table[medal] * 0.2);
      if (medal > prev) sv.medal = medal;
      text = ` ${["Sin medalla", "🥉 Bronce", "🥈 Plata", "🥇 Oro"][medal]} · ${extra.time.toFixed(1)} s`;
      if (!before && medal === 0) reward = 20;
    } else if (before) {
      // repetir una misión paga la mitad (con tope de pedidos pagados por día)
      const today = todayKey();
      if (sv.rDay !== today) { sv.rDay = today; sv.rCount = 0; }
      if (sv.rCount < REPEAT_CAP) { sv.rCount++; reward = Math.round(m.reward * REPEAT_PAY); } else reward = 0;
    }
    sv.done[m.id] = before + 1;
    sv.last[m.id] = todayKey();
    if (reward > 0) earnCoins(this.progress, reward);
    this.score += reward * 10;
    const run = recordRun(this.progress, GAME_ID, Math.max(40, reward * 10), { missions: before ? 0 : 1, mission: m.id, medal: extra.medal || 0 });
    saveProgress(this.progress);
    this.active = null;
    this.target = null;
    if (m.id === "perrito") this.dog.state = "home"; else this.dog.g.visible = false;
    for (const g of this.gateMeshes) g.visible = false;
    this._updateBangs();
    this.banner(`¡Misión cumplida! ${m.icon}`);
    this.popups.add(new THREE.Vector3(this.pos.x, 2.8, this.pos.z), reward ? `+${reward}` : "¡Gracias!", "combo");
    this._toast(`${m.icon} ${m.title}: ${reward ? `+${reward} Matipuntos 🍫✨` : "¡Gracias! Hoy ya hiciste muchos pedidos; mañana habrá más 🌙"}${text} · +${run.xp} XP${run.stars ? ` · +${run.stars} ⭐ para el Pueblo` : ""}`);
    this.particles.burst(new THREE.Vector3(this.pos.x, 1.5, this.pos.z), [0xffc800, 0xd4216c, 0xfff6e6, 0x35f0ff], 40, 6, 1.1, 4);
    audio.playMissionComplete();
    this.haptic(60);
    this._updateHud(true);
  }

  _toast(text) {
    const el = this.q("toast");
    if (!el) return;
    el.textContent = text;
    el.classList.remove("hidden", "show");
    void el.offsetWidth;
    el.classList.add("show");
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => el.classList.add("hidden"), 5200);
  }

  _missionTick(dt) {
    const a = this.active;
    if (!a) { this.target = this.wayTo ? { x: GIVERS[this.wayTo].x, z: GIVERS[this.wayTo].z } : null; return; }
    const pl = this._playerXZ();
    const m = MISSIONS.find((x) => x.id === a.id);
    const giver = GIVERS[m.giver];
    const toGiver = { x: giver.x, z: giver.z, r: 0.8 };
    const dist = (p, q) => Math.hypot(p.x - q.x, p.z - q.z);
    const nearest = (list) => list.reduce((b, p) => (!b || dist(pl, p) < dist(pl, b) ? p : b), null);
    switch (a.id) {
      case "reja": {
        if (a.step === "do") {
          if (!this.inCar) for (const p of this.panels) {
            if (p.done) continue;
            if (Math.hypot(this.pos.x - p.x, this.pos.z - p.z) < 2.0) {
              p.paint = Math.min(1, p.paint + dt / 0.7);
              p.mat.color.setHex(0x9a9a9a).lerp(new THREE.Color(0xff7ab0), p.paint);
              if (p.paint >= 1) { p.done = true; this.particles.burst(new THREE.Vector3(p.x, 0.9, p.z), [0xff7ab0, 0xffffff, 0xffc800], 14, 3, 0.7, 4); audio.playPop(); }
            }
          }
          a.n = this.panels.filter((p) => p.done).length;
          const left = this.panels.filter((p) => !p.done);
          if (!left.length) { a.step = "report"; this.banner("¡Reja lista! Habla con Don Pepe 🎨"); }
          else this.target = { x: nearest(left).x, z: nearest(left).z, r: 0.6 };
        }
        if (a.step === "report") this.target = toGiver;
        break;
      }
      case "manzanas": {
        if (a.step === "do") {
          for (const ap of this.apples) {
            if (ap.got) continue;
            if (!this.inCar && Math.hypot(this.pos.x - ap.x, this.pos.z - ap.z) < (ap.tree ? 2.4 : 1.4)) {
              ap.got = true; ap.fly = 0.4; a.n++;
              const t = this.appleTrees.find((q) => q.g === ap.tree);
              if (t) t.shake = 0.5;
              audio.playCollect();
              this.popups.add(new THREE.Vector3(ap.x, 2.2, ap.z), `🍎 ${a.n}/10`, "combo");
            }
          }
          if (a.n >= 10) { a.step = "report"; this.banner("¡10 manzanas! Llévaselas a Doña Rosa 🍎"); }
          else { const left = this.apples.filter((q) => !q.got); const nr = nearest(left); this.target = nr ? { x: nr.x, z: nr.z, r: 0.6 } : toGiver; }
        }
        if (a.step === "report") this.target = toGiver;
        break;
      }
      case "plaza": {
        if (a.step === "do") {
          for (const t of this.trash) {
            if (t.got) continue;
            if (Math.hypot(pl.x - t.x, pl.z - t.z) < (this.inCar ? 2.2 : 1.5)) { t.got = true; t.fly = 0.4; a.n++; audio.playCollect(); this.popups.add(new THREE.Vector3(t.x, 1.6, t.z), `🗑️ ${a.n}/8`, "combo"); }
          }
          if (a.n >= 8) { a.step = "bin"; this.banner("¡Ya tienes 8! Llévalos a un basurero 🗑️"); }
          else { const left = this.trash.filter((q) => !q.got); const nr = nearest(left); this.target = nr ? { x: nr.x, z: nr.z, r: 0.6 } : toGiver; }
        }
        if (a.step === "bin") {
          const b = nearest(this.bins);
          this.target = { x: b.x, z: b.z, r: 0.8 };
          if (dist(pl, b) < 2.4) this._completeMission();
        }
        break;
      }
      case "flores": {
        a.n = this.pots.filter((p) => p.watered).length;
        const left = this.pots.filter((p) => !p.watered);
        if (!left.length) { this._completeMission(); break; }
        const nr = nearest(left);
        this.target = { x: nr.x, z: nr.z, r: 0.7 };
        break;
      }
      case "perrito": {
        const d = this.dog;
        const dd = Math.hypot(pl.x - d.x, pl.z - d.z);
        if (a.step === "do") {
          this.target = null;
          a.data.hint = dd < 9 ? "¡Caliente! 🔥" : dd < 20 ? "Tibio 🙂" : dd < 36 ? "Frío 🥶" : "¡Helado! 🧊";
          a.data.bark = (a.data.bark || 0) - dt;
          if (dd < 14 && a.data.bark <= 0) { a.data.bark = 1.6 - Math.min(1, (14 - dd) / 14) * 0.9; audio.playBounce(); this.popups.add(new THREE.Vector3(d.x, 1.6, d.z), "¡Guau!", "combo"); }
          if (dd < 3.2) { d.state = "follow"; a.step = "report"; this.banner("¡Encontraste a Choco! 🐶 Llévalo con Lola"); audio.playPowerup(); }
        } else {
          this.target = toGiver;
        }
        break;
      }
      case "abuelita": {
        const t = this.tita;
        const dest = { x: -22, z: 67.2 };
        this.target = { x: dest.x, z: dest.z, r: 0.9 };
        const near = Math.hypot(pl.x - t.x, pl.z - t.z) < 5;
        const inRoad = t.z > 53.6 && t.z < 66.4;
        let carNear = false;
        if (inRoad || t.z < 54) {
          for (const c of [...this.traffic, { x: this.car.x, z: this.car.z, v: Math.abs(this.car.speed) }]) {
            if (Math.hypot(c.x - t.x, c.z - t.z) < 8 && (c.v || 0) > 1.5 && Math.abs(c.z - t.z) < 3.2 + 0 && Math.abs(c.x - t.x) < 8) carNear = true;
          }
        }
        a.data.say = (a.data.say || 0) - dt;
        if (!near) { if (a.data.say <= 0) { a.data.say = 4; this.popups.add(new THREE.Vector3(t.x, 3.4, t.z), "¡Espérame!", "combo"); } t.h.animate(this.time, "idle", 1); }
        else if (carNear && t.z < 54.2) { if (a.data.say <= 0) { a.data.say = 3; this.popups.add(new THREE.Vector3(t.x, 3.4, t.z), "¡Cuidado, viene un auto!", "combo"); } t.h.animate(this.time, "idle", 1); }
        else {
          t.z += 1.9 * dt;
          t.h.group.rotation.y = 0;
          t.h.animate(this.time, "run", 0.35);
        }
        t.h.group.position.set(t.x, Y0, t.z);
        if (t.z >= dest.z - 0.2) { t.h.animate(this.time, "cheer", 1); this._completeMission(); }
        break;
      }
      case "entrega": {
        const d = a.data;
        const stop = d.order[d.i];
        this.target = { x: stop.x, z: stop.z, r: 1.1 };
        if (dist(pl, stop) < 4.6) {
          d.i++;
          this.particles.burst(new THREE.Vector3(stop.x, 1.4, stop.z), [0xffc800, 0x7a3f22, 0xffffff], 28, 5, 0.9, 5);
          audio.playCollect();
          this.popups.add(new THREE.Vector3(stop.x, 2.6, stop.z), `📦 ${d.i}/${d.order.length}`, "combo");
          if (d.i >= d.order.length) this._completeMission();
        }
        a.n = d.i;
        break;
      }
      case "carrera": {
        const d = a.data;
        const start = { x: GATES[GATES.length - 1][0], z: GATES[GATES.length - 1][1], r: 1.4 };
        if (d.phase === "goto") {
          this.target = start;
          this.gateMeshes[GATES.length - 1].visible = true;
          if (this.inCar && dist(pl, start) < 7) { d.phase = "count"; d.t = 3.4; this.lock = 3.4; this.banner("¡Prepárate! 3…"); }
        } else if (d.phase === "count") {
          this.target = start;
          const before = Math.ceil(d.t);
          d.t -= dt;
          const now = Math.ceil(d.t);
          if (now !== before && now > 0) { this.banner(`${now}…`); audio.playCountdown(false); }
          if (d.t <= 0) { d.phase = "race"; d.t = 0; d.gate = 0; this.banner("¡YA! 🏁"); audio.playCountdown(true); this.gateMeshes[GATES.length - 1].visible = false; }
        } else if (d.phase === "race") {
          d.t += dt;
          const g = GATES[d.gate];
          this.target = { x: g[0], z: g[1], r: 1.4 };
          this.gateMeshes.forEach((m, i) => { m.visible = i === d.gate || i === d.gate + 1; m.scale.setScalar(i === d.gate ? 1 + Math.sin(this.time * 6) * 0.06 : 0.8); });
          d.away = this.inCar ? 0 : d.away + dt;
          if (d.away > 6) { this._cancelMission(true); this.banner("Carrera cancelada: bajaste del auto 🙁"); break; }
          if (Math.hypot(this.car.x - g[0], this.car.z - g[1]) < 6.2) {
            d.gate++;
            audio.playCollect();
            if (d.gate >= GATES.length) {
              const t = d.t;
              const medal = t <= 52 ? 3 : t <= 68 ? 2 : t <= 90 ? 1 : 0;
              this._completeMission({ medal, time: t });
            } else this.banner(`Aro ${d.gate}/${GATES.length}`);
          }
        }
        break;
      }
      default: {
        // misiones de los barrios (patos, quitasoles, libros): juntar o hacer algo en varios lugares y volver
        if (this.barrios && this.barrios.isMission(a.id)) {
          const t = this.barrios.tick(a, dt, pl, this.inCar);
          this.target = a.step === "report" ? toGiver : t || toGiver;
        }
        break;
      }
    }
  }

  // ---------- botón de acción ----------

  _pickTarget() {
    const pl = this._playerXZ();
    let t = null;
    if (this.dialog) { this.actionTarget = { label: "Seguir ▶", icon: "▶", short: "Seguir", fn: () => this._advanceDialog() }; this._updateActionBtn(); return; }
    if (this.inCar) {
      if (Math.abs(this.car.speed) < 7) t = { label: "🚪 Bajar del auto", icon: "🚪", short: "Bajar", fn: () => this._leaveCar() };
    } else {
      const a = this.active;
      if (a && a.id === "flores") {
        let best = null;
        for (const p of this.pots) if (!p.watered && Math.hypot(pl.x - p.x, pl.z - p.z) < 2.8 && (!best || Math.hypot(pl.x - p.x, pl.z - p.z) < Math.hypot(pl.x - best.x, pl.z - best.z))) best = p;
        if (best) t = { label: "💧 Regar", icon: "💧", short: "Regar", fn: () => this._waterPot(best, true) };
      }
      if (!t) {
        let bestN = null;
        let bd = 3.6;
        for (const n of Object.values(this.npcs)) {
          const d = Math.hypot(pl.x - n.x, pl.z - n.z);
          if (d < bd) { bd = d; bestN = n; }
        }
        if (bestN) t = { label: `💬 Hablar con ${GIVERS[bestN.id].name}`, icon: "💬", short: "Hablar", fn: () => this._talk(bestN.id) };
      }
      if (!t && Math.hypot(pl.x - this.car.x, pl.z - this.car.z) < 3.8) t = { label: "🚗 Subir al auto", icon: "🚗", short: "Subir", fn: () => this._enterCar() };
      if (!t) {
        for (const p of this.peds) if (Math.hypot(pl.x - p.x, pl.z - p.z) < 2.6) { t = { label: "👋 Saludar", icon: "👋", short: "Saludar", fn: () => this._pedSay(p) }; break; }
      }
    }
    this.actionTarget = t;
    this._updateActionBtn();
  }

  _updateActionBtn() {
    const b = this.q("btn-action");
    if (!b) return;
    const t = this.actionTarget;
    b.classList.toggle("hidden", !t || this.state !== "playing");
    // en el celular es un botón redondo (ícono + palabra corta); con mouse se ve la frase completa
    if (t && b.dataset.label !== t.label) {
      b.dataset.label = t.label;
      b.innerHTML = `<span class="ab-full">${t.label}</span><span class="ab-i">${t.icon || "✋"}</span><small>${t.short || ""}</small>`;
      b.setAttribute("aria-label", t.label);
    }
  }

  act() {
    if (this.state !== "playing") return;
    if (this.dialog) { this._advanceDialog(); return; }
    if (this.actionTarget) this.actionTarget.fn();
  }

  horn() {
    if (!this.inCar) return;
    audio.playHorn();
    for (const p of this.peds) {
      const d = Math.hypot(p.x - this.car.x, p.z - this.car.z);
      if (d < 12) p.pause = Math.max(p.pause, 0.8);
    }
  }

  _pedSay(p) {
    const el = this.q("dialog");
    this._openDialog("Vecino", [p.chat]);
    void el;
  }

  _talk(id) {
    const m = this._giverMission(id);
    if (IS_DEMO && MISSIONS.indexOf(m) >= DEMO_LIMITS.ciudad && !this.save.done[m.id]) { showDemoWall(); return; } // en la demo de la web solo las primeras misiones
    const say = SAY[id];
    const name = GIVERS[id].name;
    const a = this.active;
    if (a && a.id === m.id) {
      if (a.step === "report") this._openDialog(name, say.done, () => this._completeMission());
      else this._openDialog(name, say.wait);
    } else if (a) {
      const cur = MISSIONS.find((x) => x.id === a.id);
      this._openDialog(name, [`Primero termina tu misión: ${cur.title} 😊`]);
    } else {
      const again = this.save.done[m.id] ? [`¡Hola otra vez! ¿Me ayudas de nuevo con "${m.title.toLowerCase()}"?`] : say.ask;
      this._openDialog(name, again, () => this._startMission(m.id));
    }
  }

  _openDialog(name, lines, onEnd) {
    this.dialog = { name, lines, i: 0, onEnd };
    this._showDialog();
    audio.playPop();
  }

  _showDialog() {
    const el = this.q("dialog");
    if (!el) return;
    el.classList.remove("hidden");
    el.querySelector(".td-name").textContent = this.dialog.name;
    el.querySelector(".td-text").textContent = this.dialog.lines[this.dialog.i];
  }

  _advanceDialog() {
    const d = this.dialog;
    if (!d) return;
    d.i++;
    if (d.i >= d.lines.length) {
      this.dialog = null;
      const el = this.q("dialog");
      if (el) el.classList.add("hidden");
      d.onEnd?.();
    } else {
      this._showDialog();
      audio.playPop();
    }
  }

  // ---------- lista de misiones ----------

  openList() {
    const el = this.q("list");
    if (!el || this.state !== "playing") return;
    const done = this.save.done;
    const rows = MISSIONS.map((m, i) => {
      const act = this.active && this.active.id === m.id;
      const medal = m.id === "carrera" && this.save.medal ? ` ${["", "🥉", "🥈", "🥇"][this.save.medal]}` : "";
      return `<div class="cl-row${act ? " on" : ""}"><span class="cl-ic">${m.icon}</span><span class="cl-tt"><b>${i + 1}. ${m.title}</b><small>${m.level} · +${m.reward} 🍫✨ · con ${GIVERS[m.giver].name}</small></span><span class="cl-st">${this._available(m) ? (done[m.id] ? "🔔" : "") : "✅" + medal}</span><button type="button" class="btn-secondary cl-go" data-go="${m.giver}">${act ? "Ver" : "Ir"}</button></div>`;
    }).join("");
    el.querySelector(".cl-rows").innerHTML = rows;
    el.querySelectorAll(".cl-go").forEach((b) => b.addEventListener("click", () => { this.wayTo = b.dataset.go; this._closeList(); this.banner("📍 Sigue la flecha hasta el vecino con el ❗"); }));
    el.querySelector(".cl-cancel").classList.toggle("hidden", !this.active);
    el.classList.remove("hidden");
    this.listOpen = true;
  }

  _closeList() {
    const el = this.q("list");
    if (el) el.classList.add("hidden");
    this.listOpen = false;
  }

  // ---------- pantalla ----------

  _updateHud(force = false) {
    const q = this.q;
    const sv = this.save;
    const nDone = MISSIONS.filter((m) => sv.done[m.id]).length;
    const a = this.active;
    let qt = "";
    let qs = "";
    if (a) {
      const m = MISSIONS.find((x) => x.id === a.id);
      qt = `${m.icon} ${m.title}`;
      const d = a.data;
      const need = { reja: this.panels.length, manzanas: 10, plaza: 8, flores: this.pots.length, entrega: 3 }[a.id] || m.need;
      if (a.id === "carrera") {
        qs = d.phase === "goto" ? "Sube al auto y ve al aro blanco de salida 🏁" : d.phase === "count" ? "¡Prepárate!" : `Aro ${d.gate + 1}/${GATES.length} · ⏱️ ${d.t.toFixed(1)} s`;
      } else if (a.id === "perrito") qs = a.step === "do" ? `Buscando a Choco… ${d.hint || ""}` : "Lleva a Choco con Lola 🐶";
      else if (a.id === "abuelita") qs = "Camina junto a la abuelita y crucen por el paso de cebra 🦓";
      else if (a.step === "report") qs = `Vuelve con ${GIVERS[m.giver].name} 💬`;
      else if (a.step === "bin") qs = "Lleva los papeles al basurero 🗑️";
      else qs = `${a.n || 0}/${need}${a.id === "entrega" && d.order[d.i] ? " · entrega en " + d.order[d.i].name : ""}`;
    }
    const key = `${this.progress.coins}|${nDone}|${qt}|${qs}|${this.inCar ? Math.round(Math.abs(this.car.speed) * 3.6) : -1}`;
    if (!force && key === this.hudCache) return;
    this.hudCache = key;
    q("hud-coins").textContent = String(this.progress.coins);
    q("hud-missions").textContent = `${nDone}/${MISSIONS.length}`;
    const sp = q("hud-speed");
    if (sp) { sp.parentElement.classList.toggle("hidden", !this.inCar); sp.textContent = String(Math.round(Math.abs(this.car.speed) * 3.6)); }
    const quest = q("quest");
    if (quest) {
      quest.classList.toggle("hidden", !a);
      quest.querySelector(".qt").textContent = qt;
      quest.querySelector(".qs").textContent = qs;
    }
    const horn = q("btn-horn");
    if (horn) horn.classList.toggle("hidden", !this.inCar);
  }

  _drawMinimap() {
    const g = this.mapCtx;
    if (!g) return;
    this._mmT = (this._mmT || 0) + 1;
    if (this._mmT % 3) return;
    const S = this.mapEl.width;
    const sc = this.mapScale;
    const X = (v) => S / 2 + v * sc;
    g.drawImage(this.mapBase, 0, 0);
    // dónde ir
    if (this.target) {
      g.fillStyle = "#ffc800";
      g.strokeStyle = "#3d1f10";
      g.lineWidth = 2;
      g.beginPath(); g.arc(X(this.target.x), X(this.target.z), 5, 0, 6.3); g.fill(); g.stroke();
    }
    // vecinos con misión
    g.fillStyle = "#ff9a1f";
    for (const m of MISSIONS) {
      if (!this._available(m)) continue;
      const n = GIVERS[m.giver];
      g.beginPath(); g.arc(X(n.x), X(n.z), 3, 0, 6.3); g.fill();
    }
    // auto estacionado
    if (!this.inCar) { g.fillStyle = "#d4216c"; g.fillRect(X(this.car.x) - 3, X(this.car.z) - 3, 6, 6); }
    // el jugador
    const p = this._playerXZ();
    g.save();
    g.translate(X(p.x), X(p.z));
    g.rotate(-this.heroYaw + Math.PI);
    g.fillStyle = "#ffffff";
    g.strokeStyle = "#3d1f10";
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 6); g.lineTo(0, 3); g.lineTo(-5, 6); g.closePath(); g.fill(); g.stroke();
    g.restore();
    // brújula
    const cp = this.q("compass");
    if (cp) {
      const t = this.target;
      cp.classList.toggle("hidden", !t || this.state !== "playing");
      if (t) {
        const dx = t.x - p.x;
        const dz = t.z - p.z;
        const yaw = this.inCar ? this._camCarYaw ?? this.camYaw : this.camYaw;
        const fx = -Math.sin(yaw);
        const fz = -Math.cos(yaw);
        const rx = Math.cos(yaw);
        const rz = -Math.sin(yaw);
        const ang = Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz);
        cp.querySelector(".cp-arrow").style.transform = `rotate(${ang}rad)`;
        cp.querySelector(".cp-dist").textContent = `${Math.round(Math.hypot(dx, dz))} m`;
      }
    }
  }

  // ---------- entrada ----------

  async init() {
    const first = !this.ready;
    await super.init();
    if (first) this._bindInput();
  }

  _bindInput() {
    const map = { ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down" };
    window.addEventListener("keydown", (e) => {
      if (!this.running) return;
      if (e.code === "KeyE" || e.code === "Enter") { if (this.state === "playing") { e.preventDefault(); if (!e.repeat) this.act(); } return; }
      if (e.code === "Space") { if (this.state === "playing") { e.preventDefault(); if (this.inCar) this.keys.hand = true; else if (!e.repeat) this.act(); } return; }
      if (e.code === "KeyH") { if (!e.repeat) this.horn(); return; }
      if (e.code === "KeyM") { if (!e.repeat) (this.listOpen ? this._closeList() : this.openList()); return; }
      if (e.code === "KeyQ") { this.camYaw += 0.25; return; }
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") { this.keys.sprint = true; return; }
      const k = map[e.code];
      if (k) { if (this.state === "playing") e.preventDefault(); this.keys[k] = true; }
    });
    window.addEventListener("keyup", (e) => {
      const k = map[e.code];
      if (k) this.keys[k] = false;
      if (e.code === "Space") this.keys.hand = false;
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") this.keys.sprint = false;
    });
    window.addEventListener("blur", () => { this.keys = {}; this.q("btn-gas")?.classList.remove("down"); this.q("btn-stop")?.classList.remove("down"); });

    const cv = this.els.canvas;
    let drag = null;
    cv.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY }; this._dragging = true; cv.setPointerCapture?.(e.pointerId); });
    cv.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      if (this.inCar) this.camOff = clamp((this.camOff || 0) - dx * 0.008, -2.6, 2.6);
      else {
        this.camYaw -= dx * 0.008;
        this.camPitch = clamp(this.camPitch + (e.clientY - drag.y) * 0.004, 0.15, 1.1);
      }
      drag = { x: e.clientX, y: e.clientY };
    });
    const end = () => { drag = null; this._dragging = false; };
    cv.addEventListener("pointerup", end);
    cv.addEventListener("pointercancel", end);

    const on = (id, fn) => { const b = this.q(id); if (b) b.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); eatGhostClick(e); fn(); }); };
    on("btn-action", () => this.act());
    on("btn-horn", () => this.horn());
    on("btn-missions", () => (this.listOpen ? this._closeList() : this.openList()));
    for (const [id, key] of [["btn-gas", "gas"], ["btn-stop", "stop"]]) {
      const b = this.q(id);
      if (!b) continue;
      b.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); try { b.setPointerCapture?.(e.pointerId); } catch (err) { /* sin captura */ } this.keys[key] = true; b.classList.add("down"); });
      const up = () => { this.keys[key] = false; b.classList.remove("down"); };
      b.addEventListener("pointerup", up);
      b.addEventListener("pointercancel", up);
      b.addEventListener("lostpointercapture", up);
    }
    on("btn-brake", () => { this.keys.hand = true; });
    const brake = this.q("btn-brake");
    if (brake) { const up = () => { this.keys.hand = false; }; brake.addEventListener("pointerup", up); brake.addEventListener("pointercancel", up); brake.addEventListener("pointerleave", up); }
    this.q("dialog")?.addEventListener("pointerdown", (e) => { e.stopPropagation(); this._advanceDialog(); });
    this.q("list")?.querySelector(".cl-close")?.addEventListener("click", () => this._closeList());
    this.q("list")?.querySelector(".cl-cancel")?.addEventListener("click", () => { this._cancelMission(); this._closeList(); });
  }
}
