// Salto Choco 3D: sube sin parar rebotando en plataformas de chocolate.
// Tu Matichico (en 3D) rebota solo; tú lo mueves a los lados. Hay plataformas que
// se mueven, que se rompen y con resorte; alfajores de verdad como monedas, y el
// jetpack Matidubai. El cielo cambia del bosque de cacao a la noche con estrellas.
//
// Escalada al cielo: malvaviscos enojados que se pueden pisar (¡o te quitan un corazón!),
// bolas con pinchos, aterrizajes perfectos, combo, poderes (jetpack, imán, burbuja), cuatro
// zonas con su propia decoración (globos, aves, planetas) y música.

import { THREE, Game3D, clamp, lerp, rand, loadTexture, makeStars, roundedBox } from "./three-kit.js";
import { createMatichico } from "./matichico3d.js";
import { earnCoins, saveProgress } from "./storage.js";
import * as audio from "./audio.js";

const HALF = 4.6;
const GRAV = -30;
const BOUNCE = 14.8;
const SPRING = 25;
const JET_V = 16;
const PW = 2.0;
const PH = 0.34;
const PD = 1.3;
const TOP = 0.22;

const SKY = [
  [0, 0x9fdcf5],
  [60, 0x7ec8f0],
  [160, 0xffd0a8],
  [300, 0xe985b5],
  [480, 0x4a3a80],
  [700, 0x120d2e],
];

function skyColor(h, out) {
  for (let i = 0; i < SKY.length - 1; i++) {
    const [h0, c0] = SKY[i];
    const [h1, c1] = SKY[i + 1];
    if (h <= h1) {
      return out.setHex(c0).lerp(new THREE.Color(c1), clamp((h - h0) / (h1 - h0), 0, 1));
    }
  }
  return out.setHex(SKY[SKY.length - 1][1]);
}

const ZONES = [
  { from: 0, name: "Bosque de Cacao", ice: 0xd4216c },
  { from: 120, name: "Nubes de Algodón", ice: 0xff9ac6 },
  { from: 300, name: "Cielo de Caramelo", ice: 0xffa34a },
  { from: 520, name: "Espacio Dulce", ice: 0x7ee0ff },
];
const zoneOf = (h) => ZONES.reduce((z, e, i) => (h >= e.from ? i : z), 0);

const SPRITES = ["alf-frambuesa", "alf-menta", "alf-naranja", "alf-trufa", "alf-pie-limon", "alf-maracuya", "alf-almendra", "alf-capuchino"];

export class SaltoGame extends Game3D {
  constructor(character, progress, els) {
    super("salto", character, progress, els, { fov: 45 });
    this.musicTheme = "adventure";
    this.keys = {};
    this.pointerX = null;
    this.tmpColor = new THREE.Color();
  }

  // ---------- escena ----------

  async build() {
    const s = this.scene;
    s.background = new THREE.Color(0x9fdcf5);
    s.fog = new THREE.Fog(0x9fdcf5, 28, 95);

    this.hemi = new THREE.HemisphereLight(0xcfeaff, 0xf2d8b0, 1.25);
    s.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff0d2, 2.4);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(this.coarse ? 1024 : 2048, this.coarse ? 1024 : 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -14; sc.right = 14; sc.top = 14; sc.bottom = -14; sc.near = 1; sc.far = 60;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.04;
    s.add(this.sun);
    s.add(this.sun.target);
    this.onLowQuality = () => { this.sun.castShadow = false; };

    this.stars = makeStars(500, 150);
    s.add(this.stars);

    // materiales y geometrías compartidas de las plataformas
    const std = (color, roughness = 0.5, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
    this.m = {
      base: std(0x64321b, 0.55),
      baseWhite: std(0xf1e3cf, 0.6),
      icePink: std(0xd4216c, 0.35),
      icePista: std(0xcfd767, 0.4),
      iceCream: std(0xffffff, 0.45),
      iceGold: std(0xffc800, 0.25, { metalness: 0.5 }),
      spr: ["#ffc800", "#cfd767", "#ffffff", "#ffb3d1"].map((c) => new THREE.MeshBasicMaterial({ color: c })),
      steel: std(0xb9b0a6, 0.3, { metalness: 0.7 }),
    };
    this.g = {
      base: roundedBox(PW, PH, PD, 0.1, 0.04),
      ice: roundedBox(PW * 1.02, 0.12, PD * 1.02, 0.06, 0.03),
      sprinkle: new THREE.BoxGeometry(0.16, 0.04, 0.05),
      coil: new THREE.CylinderGeometry(0.16, 0.2, 0.34, 10),
      pom: new THREE.SphereGeometry(0.21, 12, 10),
    };

    // tipos de alfajor (fotos reales) para las monedas
    this.textures = SPRITES.map((n) => loadTexture(`assets/products/${n}.jpg`));
    this.discGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.09, 28);
    this.rimGeo = new THREE.TorusGeometry(0.41, 0.05, 8, 28);
    this.discSide = std(0xfff6e6, 0.5);

    this._ensureHero();

    this.clouds = [];
    const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, fog: false });
    this.cloudMat = cloudMat;
    this.nightCloud = new THREE.Color(0x7e6aa6);
    for (let i = 0; i < 16; i++) {
      const c = new THREE.Group();
      const puffs = 3 + Math.floor(Math.random() * 3);
      for (let p = 0; p < puffs; p++) {
        const sp = new THREE.Mesh(new THREE.SphereGeometry(rand(1.2, 2.1), 10, 8), cloudMat);
        sp.position.set(p * 1.6 - puffs * 0.8, rand(-0.2, 0.5), rand(-0.4, 0.4));
        sp.scale.y = 0.6;
        c.add(sp);
      }
      c.userData.speed = rand(0.15, 0.5);
      s.add(c);
      this.clouds.push(c);
    }

    // suelo del bosque de cacao (solo al inicio)
    this.ground = new THREE.Group();
    const grass = new THREE.Mesh(new THREE.BoxGeometry(60, 1, 24), new THREE.MeshStandardMaterial({ color: 0x8fc152, roughness: 1 }));
    grass.position.set(0, -0.55, -4);
    grass.receiveShadow = true;
    this.ground.add(grass);
    const trunk = new THREE.MeshStandardMaterial({ color: 0x64321b, roughness: 0.9 });
    const leaves = [0x6fa447, 0x8cbc55, 0x5f9640].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, flatShading: true }));
    for (let i = 0; i < 14; i++) {
      const tree = new THREE.Group();
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, 2.8, 7), trunk);
      tr.position.y = 1.4;
      tr.castShadow = true;
      tree.add(tr);
      for (let l = 0; l < 3; l++) {
        const lf = new THREE.Mesh(new THREE.IcosahedronGeometry(1.7 - l * 0.25, 0), leaves[(i + l) % 3]);
        lf.position.set(rand(-0.4, 0.4), 3.2 + l * 0.9, rand(-0.4, 0.4));
        lf.castShadow = true;
        tree.add(lf);
      }
      const pod = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), new THREE.MeshStandardMaterial({ color: i % 2 ? 0xffc800 : 0xd4216c, roughness: 0.5 }));
      pod.scale.y = 1.4;
      pod.position.set(0.9, 2.7, 0.7);
      tree.add(pod);
      tree.position.set(-24 + i * 3.7 + rand(-0.6, 0.6), 0, rand(-9, -4));
      tree.scale.setScalar(rand(0.9, 1.4));
      this.ground.add(tree);
    }
    s.add(this.ground);

    this.platforms = [];
    this.pickups = [];
    this.enemies = [];
    this.decos = [];
    this.bubbleMesh = new THREE.Mesh(new THREE.SphereGeometry(0.95, 18, 14), new THREE.MeshBasicMaterial({ color: 0x7ee0ff, transparent: true, opacity: 0.3, depthWrite: false }));
    this.bubbleMesh.visible = false;
    s.add(this.bubbleMesh);
  }

  _ensureHero() {
    if (this.hero && this.heroId === this.character.id) {
      this.hero.setLook(this.look);
      return;
    }
    if (this.hero) this.scene.remove(this.hero.group);
    this.hero = createMatichico(this.character, this.outfit, this.look);
    this.heroId = this.character.id;
    this.hero.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.scene.add(this.hero.group);
    this._buildJetpack();
  }

  _buildJetpack() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.42, 12), this.m.icePink);
    body.position.y = 0;
    g.add(body);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.18, 12), this.m.iceGold);
    nose.position.y = 0.3;
    g.add(nose);
    this.flame = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.5, 10), new THREE.MeshBasicMaterial({ color: 0xffb02e }));
    this.flame.rotation.x = Math.PI;
    this.flame.position.y = -0.46;
    g.add(this.flame);
    g.position.set(0, 0.55, -0.26);
    g.visible = false;
    this.hero.bodyGroup.add(g);
    this.jetpack = g;
  }

  onResize(w, h) {
    const aspect = w / h;
    const halfW = HALF + 1.4;
    this.dist = halfW / (Math.tan(THREE.MathUtils.degToRad(this.fov / 2)) * aspect);
    this.viewHalfH = Math.tan(THREE.MathUtils.degToRad(this.fov / 2)) * this.dist;
    this.viewHalfW = halfW;
  }

  // ---------- partida ----------

  reset() {
    for (const p of this.platforms) this.scene.remove(p.mesh);
    for (const p of this.pickups) this.scene.remove(p.mesh);
    this.platforms = [];
    this.pickups = [];
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.maxY = 0;
    this.bonus = 0;
    this.items = 0;
    this.coinsEarned = 0;
    this.jet = 0;
    this.squash = 0;
    this.camY = 0;
    this.camTarget = 0;
    this.score = 0;
    this.nextY = 2.2;
    this.lastX = 0;
    this.plain = 0;
    this.milestone = 100;
    this.hearts = 3;
    this.invuln = 0;
    this.combo = 0;
    this.comboT = 0;
    this.magnet = 0;
    this.bubble = false;
    this.stomps = 0;
    this.perfects = 0;
    this.zone = 0;
    this.nextDeco = 14;
    for (const e of this.enemies) this.scene.remove(e.mesh);
    for (const d of this.decos) this.scene.remove(d.mesh);
    this.enemies = [];
    this.decos = [];
    this.ground.visible = true;
    this._ensureHero();
    this.hero.group.position.set(0, 0, 0);
    this.hero.group.scale.setScalar(1);

    const start = this._makePlatform("start");
    start.mesh.position.set(0, -TOP + 0.02, 0);
    this.platforms.push({ mesh: start.mesh, type: "start", x: 0, y: -TOP + 0.02, vx: 0, state: "ok", w: 16 });
    this.scene.add(start.mesh);
    this._generate();
    this._updateHud();
    this._placeCamera(0);
  }

  onBegin() {
    this.vy = BOUNCE;
  }

  _makePlatform(type) {
    const g = new THREE.Group();
    const white = type === "crumble";
    const base = new THREE.Mesh(this.g.base, white ? this.m.baseWhite : this.m.base);
    base.castShadow = true;
    base.receiveShadow = true;
    let iceMat = type === "moving" ? this.m.icePista : type === "crumble" ? this.m.iceCream : type === "spring" ? this.m.iceGold : this.m.icePink;
    if (type === "normal" && this.nextY > ZONES[1].from) {
      this.zoneIce = this.zoneIce || {};
      const zi = zoneOf(this.nextY);
      iceMat = this.zoneIce[zi] || (this.zoneIce[zi] = new THREE.MeshStandardMaterial({ color: ZONES[zi].ice, roughness: 0.35 }));
    }
    const ice = new THREE.Mesh(this.g.ice, iceMat);
    ice.position.y = PH / 2 + 0.01;
    ice.castShadow = true;
    ice.receiveShadow = true;
    g.add(base, ice);
    if (type === "start") {
      base.scale.set(8, 1, 1.6);
      ice.scale.set(8, 1, 1.6);
      ice.material = new THREE.MeshStandardMaterial({ color: 0x8fc152, roughness: 1 });
    } else {
      for (let i = 0; i < 5; i++) {
        const sp = new THREE.Mesh(this.g.sprinkle, this.m.spr[i % 4]);
        sp.position.set(rand(-PW / 2 + 0.2, PW / 2 - 0.2), PH / 2 + 0.075, rand(-PD / 2 + 0.2, PD / 2 - 0.2));
        sp.rotation.y = rand(0, Math.PI);
        g.add(sp);
      }
    }
    let pom = null;
    if (type === "spring") {
      const coil = new THREE.Mesh(this.g.coil, this.m.steel);
      coil.position.y = PH / 2 + 0.2;
      coil.castShadow = true;
      pom = new THREE.Mesh(this.g.pom, this.m.icePink);
      pom.position.y = PH / 2 + 0.5;
      pom.castShadow = true;
      g.add(coil, pom);
    }
    return { mesh: g, pom };
  }

  _spawnPlatform() {
    const h = this.nextY;
    const gap = lerp(1.55, 2.85, clamp(h / 260, 0, 1)) * rand(0.88, 1.05);
    this.nextY += gap;
    let type = "normal";
    const r = Math.random();
    if (this.plain >= 2) {
      type = "normal";
    } else if (r < 0.06) {
      type = "spring";
    } else if (r < 0.06 + clamp(h / 650, 0, 0.28)) {
      type = "crumble";
    } else if (r < 0.34 + clamp(h / 520, 0, 0.1) && h > 20) {
      type = "moving";
    }
    this.plain = type === "normal" || type === "spring" ? 0 : this.plain + 1;
    const x = clamp(this.lastX + rand(-4.2, 4.2), -HALF + 0.9, HALF - 0.9);
    this.lastX = x;
    const { mesh, pom } = this._makePlatform(type);
    mesh.position.set(x, h, 0);
    this.scene.add(mesh);
    this.platforms.push({ mesh, pom, type, x, y: h, vx: type === "moving" ? rand(1.4, 2.6) * (Math.random() < 0.5 ? -1 : 1) : 0, state: "ok", w: PW, fallV: 0, spr: 0 });

    const q = Math.random();
    if (type !== "crumble") {
      if (q < 0.3) this._spawnPickup("alfajor", x, h + 1.45);
      else if (q < 0.34) this._spawnPickup("gold", x, h + 1.45);
      else if (q < 0.37 && h > 60) this._spawnPickup("jet", x, h + 1.5);
      else if (q < 0.395 && h > 40) this._spawnPickup("iman", x, h + 1.5);
      else if (q < 0.42 && h > 40) this._spawnPickup("burbuja", x, h + 1.5);
    }
    // enemigos flotando entre plataformas
    if (h > 45 && Math.random() < clamp(0.08 + h / 1800, 0, 0.26)) {
      const ex = clamp(x + (Math.random() < 0.5 ? -1 : 1) * rand(2.2, 3.6), -HALF + 0.6, HALF - 0.6);
      this._spawnEnemy(Math.random() < 0.7 - clamp(h / 1500, 0, 0.25) ? "blob" : "spike", ex, h + rand(1.2, 1.9));
    }
    // decoración de fondo según la zona
    while (this.nextDeco < this.nextY) { this._spawnDeco(this.nextDeco); this.nextDeco += rand(10, 18); }
  }

  _spawnEnemy(kind, x, y) {
    const g = new THREE.Group();
    const eye = new THREE.MeshBasicMaterial({ color: 0x1a1010 });
    if (kind === "blob") {
      const m = new THREE.MeshStandardMaterial({ color: 0xfff6ee, roughness: 0.85 });
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.7, 14), m);
      const top = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), m);
      top.position.y = 0.35;
      g.add(body, top);
      for (const sx of [-1, 1]) {
        g.add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), eye).translateX(sx * 0.17).translateY(0.28).translateZ(0.38));
        const brow = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.03), eye);
        brow.position.set(sx * 0.17, 0.43, 0.4);
        brow.rotation.z = sx * 0.45;
        g.add(brow);
      }
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.03), eye).translateY(0.1).translateZ(0.42));
    } else {
      const m = new THREE.MeshStandardMaterial({ color: 0x5a2a6a, roughness: 0.5 });
      g.add(new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), m));
      for (let i = 0; i < 12; i++) {
        const sp = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.35, 6), new THREE.MeshStandardMaterial({ color: 0xff3fa4, roughness: 0.4 }));
        const a = (i / 12) * Math.PI * 2;
        const b = (i % 3) * 1.0 - 1.0;
        sp.position.set(Math.cos(a) * 0.5, Math.sin(a * 2) * 0.35, Math.sin(a) * 0.5);
        sp.lookAt(sp.position.clone().multiplyScalar(3));
        sp.rotateX(Math.PI / 2);
        g.add(sp);
      }
      for (const sx of [-1, 1]) g.add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe14a })).translateX(sx * 0.15).translateY(0.08).translateZ(0.38));
    }
    g.position.set(x, y, 0);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.scene.add(g);
    this.enemies.push({ mesh: g, kind, x, y, baseY: y, vx: rand(0.9, 1.7) * (Math.random() < 0.5 ? -1 : 1), phase: rand(0, 6), dead: 0 });
  }

  _spawnDeco(h) {
    const zi = zoneOf(h);
    const g = new THREE.Group();
    const side = Math.random() < 0.5 ? -1 : 1;
    const std = (c, r = 0.6) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
    if (zi === 0) { // globos de fiesta
      const c = [0xff3b6b, 0xffe14a, 0x4fd0ff, 0x9a5cff][Math.floor(Math.random() * 4)];
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 10), std(c, 0.3));
      b.scale.y = 1.2;
      g.add(b, new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.2, 4), std(0xffffff)).translateY(-2));
    } else if (zi === 1) { // aves de papel / cometas
      const k = new THREE.Mesh(new THREE.OctahedronGeometry(0.8), std([0xff9ac6, 0xffe14a, 0x9fe8ff][Math.floor(Math.random() * 3)], 0.5));
      k.scale.set(1, 1.4, 0.2);
      g.add(k);
    } else if (zi === 2) { // dulces gigantes
      const c = [0xff6fb0, 0xffc800, 0x4fd09a][Math.floor(Math.random() * 3)];
      g.add(new THREE.Mesh(new THREE.SphereGeometry(0.9, 14, 10), std(c, 0.3)));
      const t = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.12, 8, 24), std(0xffffff, 0.4));
      t.rotation.x = 1.1;
      g.add(t);
    } else { // planetas y asteroides
      const c = [0x9a5cff, 0xff8a2a, 0x35f0ff, 0xff3fa4][Math.floor(Math.random() * 4)];
      g.add(new THREE.Mesh(new THREE.SphereGeometry(rand(0.9, 1.8), 16, 12), std(c, 0.5)));
      if (Math.random() < 0.5) { const t = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.08, 6, 30), std(0xffe14a, 0.4)); t.rotation.x = 1.2; g.add(t); }
    }
    g.position.set(side * rand(HALF + 2, HALF + 9), h, -rand(6, 16));
    this.scene.add(g);
    this.decos.push({ mesh: g, y: h, spin: rand(-0.6, 0.6), phase: rand(0, 6) });
  }

  _spawnPickup(kind, x, y) {
    let mesh;
    if (kind === "alfajor") {
      const top = new THREE.MeshStandardMaterial({ map: this.textures[Math.floor(Math.random() * this.textures.length)], roughness: 0.5 });
      const disc = new THREE.Mesh(this.discGeo, [this.discSide, top, this.discSide]);
      disc.rotation.x = Math.PI / 2;
      const rim = new THREE.Mesh(this.rimGeo, this.m.iceGold);
      rim.position.z = 0.03;
      mesh = new THREE.Group();
      mesh.add(disc, rim);
    } else if (kind === "gold") {
      mesh = new THREE.Group();
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.38, 0.16), this.m.iceGold);
      const pis = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.26, 0.04), this.m.icePista);
      pis.position.z = 0.09;
      mesh.add(bar, pis);
    } else if (kind === "iman" || kind === "burbuja") {
      const col = kind === "iman" ? 0xff3fa4 : 0x35f0ff;
      mesh = new THREE.Group();
      mesh.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 1), new THREE.MeshStandardMaterial({ color: col, roughness: 0.2, emissive: col, emissiveIntensity: 0.9 })));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.05, 8, 24), this.m.iceCream);
      ring.rotation.x = Math.PI / 2.4;
      mesh.add(ring);
    } else {
      mesh = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.55, 12), this.m.icePink);
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.24, 12), this.m.iceGold);
      nose.position.y = 0.4;
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.05), this.m.iceGold);
      fin.position.y = -0.2;
      mesh.add(body, nose, fin);
      mesh.scale.setScalar(1.25);
    }
    mesh.position.set(x, y, 0);
    mesh.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.scene.add(mesh);
    this.pickups.push({ mesh, kind, x, y, taken: false, baseRot: kind === "alfajor" });
  }

  _generate() {
    const need = this.camY + this.viewHalfH * 2 + 10;
    while (this.nextY < need) this._spawnPlatform();
  }

  // ---------- entrada ----------

  _keyHandlers() {
    if (this._keysBound) return;
    this._keysBound = true;
    const map = { ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right" };
    window.addEventListener("keydown", (e) => {
      if (!this.running || !map[e.code]) return;
      this.keys[map[e.code]] = true;
      e.preventDefault();
    });
    window.addEventListener("keyup", (e) => {
      if (map[e.code]) this.keys[map[e.code]] = false;
    });
    const wrap = this.els.wrap;
    const setPointer = (e) => {
      if (e.pointerType === "mouse" && e.buttons === 0) return;
      const r = wrap.getBoundingClientRect();
      const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
      this.pointerX = nx * this.viewHalfW;
    };
    wrap.addEventListener("pointerdown", (e) => { if (e.target.closest("button")) return; setPointer(e); });
    wrap.addEventListener("pointermove", setPointer);
    const release = () => { this.pointerX = null; };
    wrap.addEventListener("pointerup", release);
    wrap.addEventListener("pointercancel", release);
    wrap.addEventListener("pointerleave", release);
  }

  async init() {
    await super.init();
    this._keyHandlers();
  }

  // ---------- bucle ----------

  update(dt) {
    const playing = this.state === "playing";
    this.hero.animate(this.time, playing ? "jump" : "idle", 0.7);

    if (playing) this._step(dt);

    for (const p of this.platforms) {
      if (p.state === "breaking") {
        p.fallV += 22 * dt;
        p.y -= p.fallV * dt;
        p.mesh.rotation.z += dt * 2.5;
        p.mesh.position.y = p.y;
      } else if (p.type === "moving" && playing) {
        p.x += p.vx * dt;
        if (Math.abs(p.x) > HALF - 0.8) p.vx *= -1;
        p.mesh.position.x = p.x;
      }
      if (p.spr > 0) {
        p.spr = Math.max(0, p.spr - dt * 4);
        p.pom.position.y = PH / 2 + 0.5 + Math.sin(p.spr * Math.PI) * 0.3;
        p.pom.scale.y = 1 + Math.sin(p.spr * Math.PI) * 0.25;
      }
    }
    for (const k of this.pickups) {
      if (k.taken) continue;
      k.mesh.position.y = k.y + Math.sin(this.time * 3 + k.x) * 0.1;
      if (k.baseRot) k.mesh.rotation.y = Math.sin(this.time * 2.4 + k.x) * 0.7;
      else k.mesh.rotation.y += dt * 2.2;
    }

    for (const e of this.enemies) {
      if (e.dead > 0) {
        e.dead -= dt;
        e.mesh.scale.setScalar(Math.max(0.01, e.dead * 3));
        e.mesh.rotation.z += dt * 10;
        continue;
      }
      if (playing) {
        e.x += e.vx * dt;
        if (Math.abs(e.x) > HALF - 0.5) e.vx *= -1;
        e.y = e.baseY + (e.kind === "spike" ? Math.sin(this.time * 2 + e.phase) * 0.7 : Math.sin(this.time * 3 + e.phase) * 0.12);
      }
      e.mesh.position.set(e.x, e.y, 0);
      e.mesh.rotation.y = e.kind === "spike" ? this.time * 2 : Math.sin(this.time * 2 + e.phase) * 0.3;
      const bounce = e.kind === "blob" ? 1 + Math.sin(this.time * 6 + e.phase) * 0.06 : 1;
      e.mesh.scale.set(2 - bounce, bounce, 2 - bounce);
    }
    for (const d of this.decos) {
      d.mesh.rotation.y += d.spin * dt;
      d.mesh.position.y = d.y + Math.sin(this.time * 0.8 + d.phase) * 0.4;
    }
    this.bubbleMesh.visible = this.bubble;
    if (this.bubble) this.bubbleMesh.position.set(this.x, this.y + 0.8, 0);
    this.hero.group.visible = this.invuln <= 0 || Math.floor(this.time * 14) % 2 === 0;
    this.squash = Math.max(0, this.squash - dt * 6);
    const sq = 1 - this.squash * 0.3;
    this.hero.group.scale.set(2 - sq, sq, 2 - sq);
    this.hero.group.position.set(this.x, this.y, 0);
    const yaw = clamp(this.vx * 0.06, -0.45, 0.45);
    this.hero.group.rotation.y = lerp(this.hero.group.rotation.y, yaw, 1 - Math.exp(-10 * dt));
    this.jetpack.visible = this.jet > 0;
    if (this.jet > 0) {
      this.flame.scale.set(1, 0.8 + Math.random() * 0.6, 1);
      if (playing && Math.random() < 0.7) this.particles.burst(new THREE.Vector3(this.x, this.y + 0.4, -0.3), [0xffb02e, 0xff5fa2, 0xfff6e6], 2, 1.5, 0.45, -2, 0.8);
    }

    this._placeCamera(dt);
    this._environment();
  }

  _step(dt) {
    // movimiento horizontal: teclado, o seguir al dedo/mouse
    let target = ((this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0)) * 7.8;
    if (this.pointerX != null) target = clamp((this.pointerX - this.x) * 7, -9.5, 9.5);
    this.vx = lerp(this.vx, target, 1 - Math.exp(-13 * dt));
    this.x += this.vx * dt;
    if (this.x > HALF + 0.7) this.x = -HALF - 0.7;
    else if (this.x < -HALF - 0.7) this.x = HALF + 0.7;

    if (this.invuln > 0) this.invuln -= dt;
    if (this.magnet > 0) this.magnet -= dt;
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.combo = 0; }
    const prevY = this.y;
    if (this.jet > 0) {
      this.jet -= dt;
      this.vy = Math.max(this.vy, JET_V);
      if (this.jet <= 0) this.vy = 6;
    } else {
      this.vy += GRAV * dt;
    }
    this.y += this.vy * dt;

    if (this.vy < 0 && this.jet <= 0) {
      for (const p of this.platforms) {
        if (p.state === "breaking") continue;
        const top = p.y + TOP;
        if (prevY >= top - 0.06 && this.y <= top && Math.abs(this.x - p.x) < p.w / 2 + 0.28) {
          this._land(p, top);
          break;
        }
      }
    }

    for (const k of this.pickups) {
      if (k.taken) continue;
      if (this.magnet > 0 && (k.kind === "alfajor" || k.kind === "gold")) {
        const dx = this.x - k.x;
        const dy = this.y + 0.8 - k.y;
        const d = Math.hypot(dx, dy);
        if (d < 4.2) { const f = Math.min(1, dt * 7); k.x += dx * f; k.y += dy * f; }
      }
      if (Math.hypot(k.x - this.x, k.y - (this.y + 0.8)) < 0.95) this._collect(k);
    }
    this._enemyHits(prevY);

    if (this.y > this.maxY) {
      this.maxY = this.y;
      this.score = Math.floor(this.maxY * 10) + this.bonus;
      if (this.maxY >= this.milestone) {
        this._banner(`¡${this.milestone} m!`);
        this.particles.burst(new THREE.Vector3(this.x, this.y + 1, 0.5), [0xd4216c, 0xffc800, 0xcfd767, 0xfff6e6], 26, 6, 1, 6);
        audio.playMissionComplete();
        this.milestone += 100;
      }
      this._updateHud();
    }

    this.camTarget = Math.max(this.camTarget, this.y + 0.6);
    this._generate();
    for (let i = this.platforms.length - 1; i >= 0; i--) {
      if (this.platforms[i].y < this.camY - this.viewHalfH - 4) {
        this.scene.remove(this.platforms[i].mesh);
        this.platforms.splice(i, 1);
      }
    }
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      if (this.pickups[i].y < this.camY - this.viewHalfH - 4) {
        this.scene.remove(this.pickups[i].mesh);
        this.pickups.splice(i, 1);
      }
    }
    if (this.camY > 6) this.ground.visible = false;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      if (this.enemies[i].y < this.camY - this.viewHalfH - 4 || (this.enemies[i].dead <= 0 && this.enemies[i].gone)) { this.scene.remove(this.enemies[i].mesh); this.enemies.splice(i, 1); }
    }
    for (let i = this.decos.length - 1; i >= 0; i--) {
      if (this.decos[i].y < this.camY - this.viewHalfH - 6) { this.scene.remove(this.decos[i].mesh); this.decos.splice(i, 1); }
    }
    const z = zoneOf(this.maxY);
    if (z !== this.zone) {
      this.zone = z;
      this._banner(`Zona: ${ZONES[z].name}`);
      audio.playMissionComplete();
    }

    if (this.y < this.camY - this.viewHalfH - 1.4) this._gameOver();
  }

  _mult() {
    return 1 + Math.min(4, Math.floor(this.combo / 6));
  }

  _addCombo(n = 1) {
    const before = this._mult();
    this.combo += n;
    this.comboT = 3.2;
    if (this._mult() > before) {
      this._banner(`¡Combo x${this._mult()}!`);
      audio.playCombo(this._mult() * 2);
    }
  }

  _enemyHits(prevY) {
    for (const e of this.enemies) {
      if (e.dead > 0) continue;
      const dx = e.x - this.x;
      const dy = e.y + 0.3 - (this.y + 0.7);
      if (Math.hypot(dx, dy) > 0.95) continue;
      const stomp = e.kind === "blob" && this.vy < 0 && prevY >= e.y + 0.45;
      if (stomp) {
        e.dead = 0.35;
        e.gone = true;
        this.vy = BOUNCE * 1.12;
        this.squash = 1;
        this.stomps++;
        const pts = 30 * this._mult();
        this.bonus += pts;
        this._addCombo(2);
        this.score = Math.floor(this.maxY * 10) + this.bonus;
        const at = new THREE.Vector3(e.x, e.y + 0.5, 0.5);
        this.popups.add(at, `¡Pisotón! +${pts}`, "combo");
        this.particles.burst(at, [0xfff6ee, 0xffc800, 0xff9ac6], 18, 5, 0.7, 5);
        audio.playPop();
        this.haptic(20);
      } else if (this.invuln <= 0 && this.jet <= 0) {
        e.dead = 0.01;
        e.gone = true;
        if (this.bubble) {
          this.bubble = false;
          this.invuln = 1;
          this.popups.add(new THREE.Vector3(this.x, this.y + 1.4, 0.5), "¡Burbuja rota!", "combo");
          this.particles.burst(new THREE.Vector3(this.x, this.y + 0.8, 0.4), [0x7ee0ff, 0xffffff], 22, 5, 0.8, 5);
          audio.playCrash();
        } else {
          this.hearts--;
          this.invuln = 1.6;
          this.combo = 0;
          this.vy = Math.max(this.vy, 7);
          this.vx = -Math.sign(dx || 1) * 6;
          this.popups.add(new THREE.Vector3(this.x, this.y + 1.4, 0.5), "¡Ouch!", "kill");
          this.particles.burst(new THREE.Vector3(this.x, this.y + 0.8, 0.4), [0xd4216c, 0xffc800, 0xfff6e6], 20, 5, 0.8, 6);
          audio.playHurt();
          this.haptic(70);
          this._updateHud();
          if (this.hearts <= 0) this._gameOver();
        }
      }
    }
  }

  _land(p, top) {
    // aterrizaje perfecto: justo en el centro de la plataforma
    if (p.type !== "start" && Math.abs(this.x - p.x) < 0.3) {
      this.perfects++;
      const pts = 5 * this._mult();
      this.bonus += pts;
      this._addCombo(1);
      this.popups.add(new THREE.Vector3(this.x, top + 0.8, 0.5), `¡Perfecto! +${pts}`, "kill");
      this.particles.burst(new THREE.Vector3(this.x, top, 0.4), [0xffe14a, 0xffffff], 10, 3.5, 0.5, 5);
      audio.playCombo(this.combo);
      this.score = Math.floor(this.maxY * 10) + this.bonus;
    }
    this.y = top;
    this.squash = 1;
    const col = [0xd4216c, 0xffc800, 0xcfd767, 0xfff6e6];
    if (p.type === "spring") {
      this.vy = SPRING;
      p.spr = 1;
      audio.playBonusCollect();
      this.particles.burst(new THREE.Vector3(this.x, top, 0.4), col, 14, 5, 0.7, 8);
    } else {
      this.vy = BOUNCE;
      audio.playBounce();
      this.particles.burst(new THREE.Vector3(this.x, top, 0.4), col, 6, 2.6, 0.5, 8);
      if (p.type === "crumble") {
        p.state = "breaking";
        p.fallV = 0;
      }
    }
  }

  _collect(k) {
    k.taken = true;
    this.scene.remove(k.mesh);
    const at = new THREE.Vector3(k.x, k.y, 0.5);
    if (k.kind === "alfajor") {
      this.items++;
      this.bonus += 10 * this._mult();
      this._addCombo(1);
      this.score = Math.floor(this.maxY * 10) + this.bonus;
      this.popups.add(at, this._mult() > 1 ? `+${10 * this._mult()} x${this._mult()}` : "+10", "kill");
      this.particles.burst(at, [0xffc800, 0xfff6e6], 8, 3, 0.5, 4);
      audio.playCollect();
    } else if (k.kind === "iman") {
      this.magnet = 9;
      this.popups.add(at, "¡Imán! 🧲", "combo");
      this.particles.burst(at, [0xff3fa4, 0xfff6e6], 16, 5, 0.7, 3);
      audio.playPowerup();
    } else if (k.kind === "burbuja") {
      this.bubble = true;
      this.popups.add(at, "¡Burbuja! 🫧", "combo");
      this.particles.burst(at, [0x35f0ff, 0xfff6e6], 16, 5, 0.7, 3);
      audio.playPowerup();
    } else if (k.kind === "gold") {
      this.bonus += 50;
      this.score = Math.floor(this.maxY * 10) + this.bonus;
      earnCoins(this.progress, 2);
      this.coinsEarned += 2;
      saveProgress(this.progress);
      this.popups.add(at, "+2 🍫✨", "coin");
      this.particles.burst(at, [0xffc800, 0xcfd767, 0xffffff], 18, 5, 0.8, 5);
      audio.playBonusCollect();
    } else {
      this.jet = 3.4;
      this.popups.add(at, "¡Jetpack!", "combo");
      this.particles.burst(at, [0xffb02e, 0xff5fa2], 16, 5, 0.7, 3);
      audio.playVictory();
    }
    this._updateHud();
  }

  _gameOver() {
    audio.playLose();
    this.finish(
      `Subiste ${Math.floor(this.maxY)} metros, juntaste ${this.items} alfajores, pisaste ${this.stomps} malvaviscos y sumaste ${this.score} puntos` +
        (this.coinsEarned > 0 ? `, ganando ${this.coinsEarned} Matipuntos.` : ".")
    );
  }

  _banner(text) {
    const el = this.els.banner;
    el.textContent = text;
    el.classList.remove("show");
    void el.offsetWidth;
    el.classList.add("show");
  }

  _updateHud() {
    this.els.hudScore.textContent = String(this.score);
    this.els.hudHeight.textContent = `${Math.floor(this.maxY)} m`;
    this.els.hudCoins.textContent = String(this.progress.coins);
    if (this.els.hudHearts) this.els.hudHearts.textContent = "❤".repeat(Math.max(0, this.hearts)) + "♡".repeat(Math.max(0, 3 - this.hearts));
    if (this.els.hudCombo) this.els.hudCombo.textContent = `x${this._mult()}`;
  }

  // ---------- cámara y ambiente ----------

  _placeCamera(dt) {
    this.camY = dt ? lerp(this.camY, this.camTarget, 1 - Math.exp(-5.5 * dt)) : this.camTarget;
    const cy = this.camY + this.viewHalfH * 0.3;
    this.camera.position.set(0, cy, this.dist);
    this.camera.lookAt(0, cy, 0);
    this.sun.position.set(6, cy + 12, 11);
    this.sun.target.position.set(0, cy, 0);
  }

  _environment() {
    const h = this.camY;
    const c = skyColor(h, this.tmpColor);
    this.scene.background.copy(c);
    this.scene.fog.color.copy(c);
    const night = clamp((h - 300) / 350, 0, 1);
    this.hemi.intensity = lerp(1.25, 0.55, night);
    this.sun.intensity = lerp(2.4, 1.0, night);
    this.stars.material.opacity = clamp((h - 280) / 260, 0, 1);
    this.cloudMat.color.setHex(0xffffff).lerp(this.nightCloud, night);
    this.stars.position.set(0, this.camY, 0);
    this.clouds.forEach((cl, i) => {
      cl.position.x += cl.userData.speed * 0.016;
      if (cl.position.x > 26) cl.position.x = -26;
      if (cl.position.y < this.camY - 14 || cl.userData.init !== true) {
        cl.userData.init = true;
        cl.position.set(rand(-24, 24), this.camY + rand(-8, 28), -rand(8, 30));
        cl.scale.setScalar(rand(0.9, 1.7));
      }
    });
  }
}
