// Aventura Choco 3D: plataformas de avance lateral (tipo Mario Bros) con tu Matichico.
// Corre, salta (mantén apretado para saltar más alto), pisa a los malvaviscos, junta alfajores, golpea los bloques ?
// desde abajo y llega a la bandera. 5 mundos x 4 niveles = 20 niveles; el cuarto de cada mundo termina con un JEFE
// que hay que pisar 3 veces. Los niveles se arman solos a partir de tramos (con una semilla por nivel), así que
// cada uno siempre es el mismo y se puede pasar (los saltos nunca superan lo que puedes saltar).
//
// Controles: ← → / A D para moverte, ESPACIO / ↑ / W para saltar. En el celular: ◀ ▶ y ⤴.

import { THREE, Game3D, clamp, lerp, rand, canvasTexture, loadTexture, roundedBox, makeLogo, goldCoinTexture } from "./three-kit.js?v=ffbc2f0677";
import { createMatichico } from "./matichico3d.js?v=ffbc2f0677";
import { saveProgress } from "./storage.js?v=ffbc2f0677";
import * as audio from "./audio.js?v=ffbc2f0677";
import { campaign, campaignWin, renderLevelPicker, LEVELS_PER_GAME } from "./campaign.js?v=ffbc2f0677";

const GAME_ID = "aventura";
const H = 18; // alto del mapa en casillas
const GRAV = 30;
const GRAV_FALL = 38;
const JUMP_V = 15;
const RUN_V = 7.4;
const PW = 0.5; // ancho del Matichico (casillas)
const PH = 1.05; // alto
const COYOTE = 0.1;
const BUFFER = 0.13;
const BIG_V = 6; // rebote al pisar

const WORLDS = [
  { name: "Pradera Cacao", sky: 0x7ec8f0, fog: 0xbfe3f7, dirt: 0x8a5a36, grass: 0x6fc24a, brick: 0xc86a3a, hill: 0x8cd05a, hill2: 0x6fb24a, music: "adventure" },
  { name: "Desierto de Azúcar", sky: 0xffd9a0, fog: 0xffe8c4, dirt: 0xe0b878, grass: 0xf6e0a0, brick: 0xd4916a, hill: 0xf2c878, hill2: 0xe0aa5a, music: "adventure" },
  { name: "Cueva de Chocolate", sky: 0x3a2318, fog: 0x4a2c1e, dirt: 0x5a3320, grass: 0x8a5a36, brick: 0x7a4a2a, hill: 0x4e2c1c, hill2: 0x3e2216, music: "chill" },
  { name: "Cielo de Algodón", sky: 0xffc2dc, fog: 0xffdcea, dirt: 0xf7e6f0, grass: 0xffffff, brick: 0xd4216c, hill: 0xffe0ee, hill2: 0xffc8de, music: "chill" },
  { name: "Castillo Dulce", sky: 0x5a3a8a, fog: 0x7a5aa6, dirt: 0x6a4a8a, grass: 0x9a7ac0, brick: 0xd4216c, hill: 0x4a2a6a, hill2: 0x3a1f5a, music: "sport" },
];

const SOLID = new Set(["#", "B", "?", "U", "P"]);

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Arma el mapa de un nivel (1 a 20). map[y][x], y = 0 abajo. Devuelve { map, W, start, flag, boss, checkpoints }. */
export function buildLevel(L) {
  const world = Math.floor((L - 1) / 4);
  const idx = (L - 1) % 4; // 0..3 dentro del mundo
  const isBoss = idx === 3;
  const diff = (L - 1) / (LEVELS_PER_GAME - 1); // 0..1
  const rng = mulberry32(L * 7919 + 13);
  const ri = (a, b) => a + Math.floor(rng() * (b - a + 1));
  const chance = (p) => rng() < p;
  const W = (isBoss ? 90 : 150 + L * 4) + 40;
  const map = Array.from({ length: H }, () => new Array(W + 20).fill("."));
  const set = (x, y, ch) => { if (x >= 0 && x < W + 20 && y >= 0 && y < H) map[y][x] = ch; };
  const ground = (x0, x1, h = 2) => { for (let x = x0; x < x1; x++) for (let y = 0; y < h; y++) set(x, y, "#"); };
  const coins = [];
  const enemies = [];
  const coin = (x, y) => { set(x, y, "o"); coins.push([x, y]); };
  const arc = (x0, n, y0, height) => { for (let i = 0; i < n; i++) coin(x0 + i, Math.round(y0 + Math.sin((i / Math.max(1, n - 1)) * Math.PI) * height)); };
  const checkpoints = [];
  let x = 0;
  let gh = 2; // altura actual del suelo

  // inicio
  ground(0, 10, gh);
  const start = { x: 2, y: gh };
  x = 10;

  const enemy = (ex, ey, type = "E") => enemies.push({ x: ex, y: ey, type });

  const chunks = {
    flat() {
      const n = ri(6, 11);
      ground(x, x + n, gh);
      if (chance(0.7)) arc(x + 1, Math.min(n - 2, 5), gh + 1, 1.4);
      if (chance(0.35 + diff * 0.3)) enemy(x + ri(3, n - 4), gh);
      x += n;
    },
    gap() {
      const g = clamp(ri(2, 2 + Math.round(diff * 2)), 2, 4);
      arc(x, g, gh + 1, 2.2);
      x += g; // sin suelo
      const n = ri(4, 7);
      ground(x, x + n, gh);
      x += n;
    },
    steps() {
      const up = chance(0.5);
      const n = ri(2, 3);
      for (let i = 0; i < n; i++) {
        const nh = clamp(gh + (up ? 1 : -1), 1, 6);
        gh = nh;
        ground(x, x + 3, gh);
        if (chance(0.5)) coin(x + 1, gh + 1);
        x += 3;
      }
      if (gh > 4 || gh < 2) { const back = 2; ground(x, x + 4, back); gh = back; x += 4; }
      ground(x, x + 3, gh); // tramo plano para recuperar el aliento antes de lo que sigue
      x += 3;
    },
    platforms() {
      const n = ri(8, 12);
      ground(x, x + n, gh);
      const py = gh + 2;
      const px = x + ri(1, 3);
      for (let i = 0; i < 3; i++) set(px + i, py, "=");
      arc(px, 3, py + 1, 0.4);
      if (chance(0.5)) { for (let i = 0; i < 3; i++) set(px + 5 + i, py + 1, "="); arc(px + 5, 3, py + 2, 0.4); }
      if (chance(0.4 + diff * 0.3)) enemy(x + n - 4, gh);
      x += n;
    },
    qblocks() {
      const n = ri(8, 11);
      ground(x, x + n, gh);
      const by = gh + 3;
      const bx = x + ri(2, 4);
      const cnt = ri(1, 3);
      for (let i = 0; i < cnt; i++) set(bx + i * 2, by, chance(0.5) ? "?" : "B");
      set(bx + 1, by, "?");
      if (chance(0.5)) enemy(x + n - 4, gh);
      x += n;
    },
    pipe() {
      const n = ri(9, 12);
      ground(x, x + n, gh);
      const h = ri(2, 3);
      const px = x + ri(3, 4);
      for (let y = gh; y < gh + h; y++) set(px, y, "P");
      arc(px - 1, 3, gh + h + 1, 0.8);
      if (chance(0.5 + diff * 0.3) && px + 3 < x + n - 3) enemy(px + 2, gh);
      x += n;
    },
    spikes() {
      const n = ri(9, 12);
      ground(x, x + n, gh);
      const k = ri(1, 1 + Math.round(diff * 2));
      const sx = x + ri(3, 5);
      for (let i = 0; i < k; i++) set(sx + i, gh, "^");
      arc(sx - 1, k + 2, gh + 1, 2.2);
      x += n;
    },
    corridor() {
      const n = ri(10, 14);
      ground(x, x + n, gh);
      const k = ri(2, 2 + Math.round(diff * 2));
      for (let i = 0; i < k && 3 + i * 2.6 < n - 3; i++) enemy(x + 3 + Math.round(i * 2.6), gh, diff > 0.25 && chance(0.35) ? "X" : "E");
      x += n;
    },
    tower() {
      const n = ri(9, 12);
      ground(x, x + n, gh);
      const tx = x + 3;
      for (let i = 0; i < 3; i++) for (let y = gh; y < gh + 3; y++) set(tx + i, y, "B");
      coin(tx + 1, gh + 4);
      coin(tx, gh + 4); coin(tx + 2, gh + 4);
      x += n;
    },
    flyers() {
      const n = ri(10, 14);
      ground(x, x + n, gh);
      enemy(x + 4, gh + 3, "V");
      if (diff > 0.5) enemy(x + 8, gh + 3, "V");
      arc(x + 1, 4, gh + 1, 1);
      x += n;
    },
  };

  let pool = ["flat", "gap", "steps", "platforms", "qblocks", "pipe", "corridor"];
  if (world >= 1) pool.push("spikes", "tower");
  if (world >= 2) pool.push("gap", "spikes");
  if (world >= 3) pool.push("flyers", "gap");
  if (world >= 4) pool.push("flyers", "corridor", "spikes");

  if (isBoss) {
    // tramo corto y luego la arena del jefe
    chunks.flat(); chunks.platforms(); chunks.gap(); chunks.flat();
    checkpoints.push(x);
    gh = 2;
    const ax = x;
    ground(ax, ax + 34, 2);
    for (let y = 2; y < 9; y++) set(ax + 33, y, "#");
    set(ax + 10, 5, "?"); set(ax + 22, 5, "?"); // dos bloques ? por si necesitas un corazón
    for (let i = 0; i < 3; i++) set(ax + 15 + i, 7, "=");
    for (let y = 2; y < 6; y++) set(ax + 30, y, "."); // salida cerrada por la pared hasta vencer
    x = ax + 34;
    ground(x, x + 12, 2);
    const boss = { x: ax + 24, y: 2 };
    const flagX = x + 8;
    return finish({ boss, flagX, arenaX: ax, arenaW: 34 });
  }

  const target = 150 + L * 4;
  let guardN = 0;
  while (x < target && guardN++ < 80) {
    chunks[pool[ri(0, pool.length - 1)]]();
    if (x - (checkpoints[checkpoints.length - 1] || 0) > 46 && x < target - 20) {
      checkpoints.push(x);
      ground(x, x + 4, gh);
      x += 4;
    }
    // a veces, bloques de ? sueltos con alfajores
    if (chance(0.25)) {
      const bx = x - ri(4, 8);
      set(bx, gh + 3, chance(0.5) ? "?" : "B");
    }
  }
  ground(x, x + 14, 2);
  gh = 2;
  const flagX = x + 9;
  return finish({ boss: null, flagX });

  function finish(extra) {
    const maxX = extra.flagX + 8;
    for (let xx = maxX; xx < W + 20; xx++) for (let y = 0; y < 2; y++) set(xx, y, "#");
    return { map, W: maxX + 4, start, coins, enemies, checkpoints, ...extra, world, isBoss };
  }
}

function questionTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = "#ffc800"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#a06a00"; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8);
    g.fillStyle = "#6a3a00"; g.font = '90px "Baby Chipmunk", sans-serif'; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText("?", w / 2, h / 2 + 6);
  });
}

export class AventuraGame extends Game3D {
  constructor(character, progress, els) {
    super(GAME_ID, character, progress, els, { fov: 40 });
    this.musicTheme = "adventure";
    this.q = els.q;
    this.keys = { left: false, right: false, jump: false };
    this.level = 1;
    this.camX = 0;
    this.camY = 3;
  }

  // ---------- escena ----------

  async build() {
    const s = this.scene;
    s.background = new THREE.Color(0x7ec8f0);
    s.fog = new THREE.Fog(0xbfe3f7, 30, 70);
    s.add(new THREE.HemisphereLight(0xffffff, 0x8a6a50, 1.2));
    this.sun = new THREE.DirectionalLight(0xfff0d2, 2.2);
    this.sun.position.set(-6, 14, 12);
    this.sun.castShadow = true;
    const sm = this.coarse ? 1024 : 2048;
    this.sun.shadow.mapSize.set(sm, sm);
    const sc = this.sun.shadow.camera;
    sc.left = -14; sc.right = 14; sc.top = 10; sc.bottom = -8; sc.near = 1; sc.far = 50;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.04;
    s.add(this.sun, this.sun.target);
    this.onLowQuality = () => { this.sun.castShadow = false; };

    this.levelGroup = new THREE.Group();
    s.add(this.levelGroup);
    this.bg = new THREE.Group();
    s.add(this.bg);
    this.qTex = questionTexture();
    this.coinTex = goldCoinTexture();
    this.partGroup = new THREE.Group();
    s.add(this.partGroup);
    this.hero = null;
    this._ensureHero();
  }

  _ensureHero() {
    if (this.hero && this.heroId === this.character.id) { this.hero.setLook(this.look); return; }
    if (this.hero) this.scene.remove(this.hero.group);
    this.hero = createMatichico(this.character, this.outfit, this.look);
    this.heroId = this.character.id;
    this.hero.group.scale.setScalar(0.74);
    this.hero.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.scene.add(this.hero.group);
  }

  _clearLevel() {
    for (const g of [this.levelGroup, this.bg]) {
      while (g.children.length) g.remove(g.children[0]);
    }
  }

  /** Construye todas las mallas del nivel a partir del mapa. */
  _buildScene() {
    this._clearLevel();
    const L = this.lv;
    const th = WORLDS[L.world];
    this.theme = th;
    this.scene.background.setHex(th.sky);
    this.scene.fog.color.setHex(th.fog);
    const std = (c, r = 0.7, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, ...extra });
    const dirtMat = std(th.dirt, 0.9);
    const grassMat = std(th.grass, 0.8);
    const brickMat = std(th.brick, 0.6);
    this._brickMat = brickMat;
    const pipeMat = std(0x2fb85a, 0.4);
    const box = new THREE.BoxGeometry(1, 1, 1.5);
    const cap = new THREE.BoxGeometry(1.02, 0.22, 1.54);
    const map = L.map;
    const W = L.W + 10;
    const dirt = [];
    const grass = [];
    const brick = [];
    const pipes = [];
    const plats = [];
    this.solidMeshes = {};
    this.qBlocks = [];
    this.spikes = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const ch = map[y][x];
      if (ch === "#") { dirt.push([x, y]); if (!SOLID.has(map[y + 1] && map[y + 1][x])) grass.push([x, y]); }
      else if (ch === "B") brick.push([x, y]);
      else if (ch === "P") pipes.push([x, y]);
      else if (ch === "=") plats.push([x, y]);
      else if (ch === "?") this.qBlocks.push({ x, y, used: false, mesh: null });
      else if (ch === "^") this.spikes.push([x, y]);
    }
    const inst = (geo, mat, list, dy = 0.5, cast = true) => {
      if (!list.length) return null;
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      const m4 = new THREE.Matrix4();
      list.forEach(([x, y], i) => { m4.makeTranslation(x + 0.5, y + dy, 0); im.setMatrixAt(i, m4); });
      im.castShadow = cast;
      im.receiveShadow = true;
      this.levelGroup.add(im);
      return im;
    };
    inst(box, dirtMat, dirt);
    inst(cap, grassMat, grass, 1.0 - 0.02, false);
    inst(box, brickMat, brick);
    inst(new THREE.CylinderGeometry(0.5, 0.5, 1, 14), pipeMat, pipes);
    inst(new THREE.BoxGeometry(1, 0.28, 1.4), std(0xfff6e6, 0.5), plats, 0.86);
    // bloques ?
    const qMat = new THREE.MeshStandardMaterial({ map: this.qTex, roughness: 0.4, emissive: 0x6a4a00, emissiveIntensity: 0.3 });
    this.usedMat = std(0x8a7a6a, 0.8);
    for (const qb of this.qBlocks) {
      const m = new THREE.Mesh(box, qMat);
      m.position.set(qb.x + 0.5, qb.y + 0.5, 0);
      m.castShadow = true;
      this.levelGroup.add(m);
      qb.mesh = m;
    }
    // pinchos
    const spikeGeo = new THREE.ConeGeometry(0.2, 0.55, 8);
    const spikeMat = std(0xe8e8f0, 0.3, { metalness: 0.4 });
    for (const [x, y] of this.spikes) {
      for (const dx of [0.2, 0.5, 0.8]) {
        const sp = new THREE.Mesh(spikeGeo, spikeMat);
        sp.position.set(x + dx, y + 0.3, 0);
        sp.castShadow = true;
        this.levelGroup.add(sp);
      }
    }
    // alfajores (monedas)
    this.coinList = L.coins.map(([x, y]) => ({ x: x + 0.5, y: y + 0.5, got: false }));
    const coinGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.1, 18);
    const creamM = std(0xe0a800, 0.3, { metalness: 0.6, emissive: 0x5a3a00, emissiveIntensity: 0.35 });
    const coinMats = [creamM, new THREE.MeshStandardMaterial({ map: this.coinTex, roughness: 0.35, metalness: 0.3 }), creamM];
    this.coinMesh = new THREE.InstancedMesh(coinGeo, coinMats, Math.max(1, this.coinList.length));
    this.coinMesh.frustumCulled = false;
    this.levelGroup.add(this.coinMesh);
    // bandera de meta y castillo
    this._buildFlag(L.flagX);
    // fondo con paralaje
    this._buildBackground(th, W);
    // enemigos
    this.enemies = [];
    for (const e of L.enemies) this._spawnEnemy(e.x + 0.5, e.y, e.type);
    this.boss = null;
    if (L.boss) this._spawnBoss(L.boss.x + 0.5, L.boss.y);
    // puertas del jefe: pared que se abre al vencerlo
    this.bossWall = [];
    if (L.isBoss) {
      for (let y = 2; y < 6; y++) { this.bossWall.push([L.arenaX + 33, y]); }
    }
    this._refreshCoins();
  }

  _buildFlag(fx) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 6, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.5, roughness: 0.3 }));
    pole.position.set(fx, 2 + 3, 0);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), new THREE.MeshStandardMaterial({ color: 0xffc800, metalness: 0.6, roughness: 0.3, emissive: 0x6a4a00, emissiveIntensity: 0.4 }));
    ball.position.set(fx, 8.1, 0);
    const flagTex = canvasTexture(256, 160, (c, w, h) => {
      c.fillStyle = "#D4216C"; c.fillRect(0, 0, w, h);
      c.fillStyle = "#FFC800"; c.font = '70px "Baby Chipmunk", sans-serif'; c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText("M", w / 2, h / 2 + 4);
    });
    // el logo de Matichoc: en la bandera (arriba del poste) y sobre la puerta del castillo
    const flagLogo = makeLogo(1.6);
    flagLogo.position.set(fx + 0.95, 7.35, 0.05);
    const doorLogo = makeLogo(1.5);
    doorLogo.position.set(fx + 5, 4.35, 0.6);
    g.add(flagLogo, doorLogo);
    this.flagCloth = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.05, 8, 1), new THREE.MeshBasicMaterial({ map: flagTex, side: THREE.DoubleSide }));
    this.flagCloth.position.set(fx + 0.9, 7.3, 0);
    this.flagBase = Float32Array.from(this.flagCloth.geometry.attributes.position.array);
    // castillo de chocolate
    const castle = new THREE.Group();
    const wall = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 2), new THREE.MeshStandardMaterial({ color: 0xc9a27a, roughness: 0.7 }));
    wall.position.set(fx + 5, 3.5, -0.5);
    castle.add(wall);
    for (const dx of [-1.5, 0, 1.5]) {
      const tw = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 2), new THREE.MeshStandardMaterial({ color: 0xc9a27a }));
      tw.position.set(fx + 5 + dx, 5.35, -0.5);
      castle.add(tw);
    }
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.6, 0.1), new THREE.MeshStandardMaterial({ color: 0x3d1f10 }));
    door.position.set(fx + 5, 2.8, 0.55);
    castle.add(door);
    g.add(pole, ball, this.flagCloth, castle);
    this.levelGroup.add(g);
  }

  _buildBackground(th, W) {
    const std = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1, fog: true });
    for (let i = -2; i < Math.ceil(W / 14) + 2; i++) {
      const h1 = new THREE.Mesh(new THREE.SphereGeometry(5 + (i % 3) * 1.2, 18, 10), std(i % 2 ? th.hill : th.hill2));
      h1.scale.set(1.7, 0.75, 0.5);
      h1.position.set(i * 13, -2.2 + (i % 2) * 0.8, -16);
      this.bg.add(h1);
    }
    const cloud = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: this.lv.world === 2 ? 0 : this.lv.world === 4 ? 0.25 : 0.85, fog: false });
    for (let i = 0; i < Math.ceil(W / 9) + 4; i++) {
      const c = new THREE.Group();
      for (let k = 0; k < 3; k++) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(1 + k * 0.1, 10, 8), cloud);
        b.position.set(k * 1.1, (k % 2) * 0.3, 0);
        b.scale.y = 0.7;
        c.add(b);
      }
      c.position.set(i * 9 + (i % 3) * 2, 8 + (i % 4) * 1.4, -22);
      this.bg.add(c);
    }
  }

  _spawnEnemy(x, y, type) {
    const g = new THREE.Group();
    const white = new THREE.MeshStandardMaterial({ color: type === "X" ? 0xff7a8a : 0xfff6e6, roughness: 0.5 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1c0f07 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.4, 0.62, 14), white);
    body.position.y = 0.34;
    body.castShadow = true;
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.38, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), white);
    top.position.y = 0.65;
    g.add(body, top);
    for (const sx of [-0.14, 0.14]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), dark);
      eye.position.set(sx, 0.55, 0.36);
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.04), dark);
      brow.position.set(sx, 0.67, 0.37);
      brow.rotation.z = -Math.sign(sx) * 0.4;
      g.add(eye, brow);
    }
    if (type === "X") {
      for (const dx of [-0.2, 0, 0.2]) {
        const sp = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.28, 6), new THREE.MeshStandardMaterial({ color: 0xe8e8f0, metalness: 0.4 }));
        sp.position.set(dx, 0.98, 0);
        g.add(sp);
      }
    }
    if (type === "V") {
      for (const sx of [-1, 1]) {
        const w = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.3), new THREE.MeshStandardMaterial({ color: 0xffb3d1 }));
        w.position.set(sx * 0.5, 0.6, 0);
        g.add(w);
        g.userData.wings = g.userData.wings || [];
        g.userData.wings.push(w);
      }
    }
    g.position.set(x, y, 0);
    this.levelGroup.add(g);
    this.enemies.push({ type, mesh: g, x, y, vx: -1.5 - (this.lv.world * 0.15), vy: 0, w: 0.7, h: type === "X" ? 0.95 : 0.75, dead: 0, baseY: y, t: Math.random() * 6, stompable: type !== "X" });
  }

  _spawnBoss(x, y) {
    const world = this.lv.world;
    const cols = [0xfff6e6, 0xffd9a0, 0x7a4a2a, 0xffc2dc, 0x9a7ac0];
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: cols[world], roughness: 0.45 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1c0f07 });
    const white = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.0, 1.5, 20), mat);
    body.position.y = 0.85;
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.9, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat);
    top.position.y = 1.6;
    g.add(body, top);
    for (const sx of [-0.33, 0.33]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), white);
      eye.position.set(sx, 1.35, 0.8);
      const pu = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), dark);
      pu.position.set(sx, 1.33, 0.98);
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.08, 0.08), dark);
      brow.position.set(sx, 1.68, 0.86);
      brow.rotation.z = -Math.sign(sx) * 0.45;
      g.add(eye, pu, brow);
    }
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.62, 0.35, 7), new THREE.MeshStandardMaterial({ color: 0xffc800, metalness: 0.5, roughness: 0.3 }));
    crown.position.y = 2.45;
    g.add(crown);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    g.position.set(x, y, 0);
    this.levelGroup.add(g);
    this.boss = { mesh: g, mat, x, y, vx: -2.2, vy: 0, w: 1.7, h: 2.2, hp: 3, stun: 0, hurtT: 0, jumpT: 2, dead: 0, charge: 0 };
  }

  // ---------- partida ----------

  reset() {
    const c = campaign(this.progress, GAME_ID);
    this.level = Math.min(c.selected || c.unlocked, c.unlocked);
    this.missionId = GAME_ID;
    this.lv = buildLevel(this.level);
    this._ensureHero();
    this._buildScene();
    const p = (this.player = {
      x: this.lv.start.x + 0.5, y: this.lv.start.y, vx: 0, vy: 0, face: 1, ground: false, coyote: 0, buffer: 0, jumpHeld: false,
      invuln: 0, dead: false, deadT: 0, win: false, winT: 0, anim: "idle",
    });
    this.spawn = { x: p.x, y: p.y };
    this.hearts = 3;
    this.maxHearts = 3;
    this.coins = 0;
    this.score = 0;
    this.stomps = 0;
    this.hurtCount = 0;
    this.hurtLog = [];
    this.checkpointIdx = -1;
    this.t = 0;
    this.camX = p.x + 2;
    this.camY = 4;
    this.timeLeft = 0;
    this.bossWallOpen = false;
    this.keys = { left: false, right: false, jump: false };
    this.hitQ = new Set();
    this._applyBossWall(true);
    this._fit();
    this._updateHud();
    this._placeHero();
  }

  /** La pared de la arena del jefe se pone/abre. */
  _applyBossWall(closed) {
    if (!this.lv.isBoss) return;
    const x = this.lv.arenaX + 33;
    for (let y = 2; y < 9; y++) this.lv.map[y][x] = closed ? "#" : ".";
    if (!this._bossWallMesh) this._bossWallMesh = null;
    if (this._bossWallMesh) { this.levelGroup.remove(this._bossWallMesh); this._bossWallMesh = null; }
    if (closed) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1, 7, 1.5), new THREE.MeshStandardMaterial({ color: 0x8a5a36, roughness: 0.8 }));
      m.position.set(x + 0.5, 2 + 3.5, 0);
      this.levelGroup.add(m);
      this._bossWallMesh = m;
    }
  }

  _tile(x, y) {
    const tx = Math.floor(x);
    const ty = Math.floor(y);
    if (ty < 0) return "."; // los pozos no tienen fondo
    if (tx < 0) return "#";
    if (ty >= H || tx >= this.lv.map[0].length) return ".";
    return this.lv.map[ty][tx];
  }

  _solid(x, y) { return SOLID.has(this._tile(x, y)); }

  // ---------- entrada ----------

  async init() {
    const first = !this.ready;
    await super.init();
    if (first) this._bindInput();
  }

  _bindInput() {
    const km = { ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", ArrowUp: "jump", KeyW: "jump", Space: "jump", KeyK: "jump" };
    window.addEventListener("keydown", (e) => {
      if (!this.running) return;
      const k = km[e.code];
      if (!k) return;
      e.preventDefault();
      if (k === "jump" && !this.keys.jump && this.state === "playing") this.player.buffer = BUFFER;
      this.keys[k] = true;
    });
    window.addEventListener("keyup", (e) => { const k = km[e.code]; if (k) this.keys[k] = false; });
    window.addEventListener("blur", () => { this.keys = { left: false, right: false, jump: false }; });
    const hold = (id, k) => {
      const b = this.q(id);
      if (!b) return;
      const on = (e) => { e.preventDefault(); if (k === "jump" && !this.keys.jump && this.state === "playing") this.player.buffer = BUFFER; this.keys[k] = true; };
      const off = (e) => { e.preventDefault(); this.keys[k] = false; };
      b.addEventListener("pointerdown", on);
      b.addEventListener("pointerup", off);
      b.addEventListener("pointercancel", off);
      b.addEventListener("pointerleave", off);
    };
    hold("btn-left", "left");
    hold("btn-right", "right");
    hold("btn-jump", "jump");
  }

  // ---------- bucle ----------

  update(dt) {
    dt = Math.min(dt, 1 / 30);
    this.t += dt;
    const playing = this.state === "playing";
    if (playing) {
      this._updatePlayer(dt);
      this._updateEnemies(dt);
      this._updateBoss(dt);
      this._collect();
      this._checkGoal(dt);
    }
    this._placeHero(dt);
    this._animateWorld(dt);
    this._updateCamera(dt);
  }

  _updatePlayer(dt) {
    const p = this.player;
    if (p.dead) {
      p.deadT += dt;
      p.vy -= GRAV * dt;
      p.y += p.vy * dt;
      return;
    }
    if (p.win) {
      p.winT += dt;
      p.vx = 0;
      return;
    }
    p.invuln = Math.max(0, p.invuln - dt);
    p.buffer = Math.max(0, p.buffer - dt);
    p.coyote = p.ground ? COYOTE : Math.max(0, p.coyote - dt);
    // movimiento horizontal
    const dir = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0);
    const target = dir * RUN_V;
    const acc = (p.ground ? 70 : 42) * dt;
    if (dir === 0) p.vx = Math.abs(p.vx) <= 80 * dt ? 0 : p.vx - Math.sign(p.vx) * 80 * dt;
    else p.vx += clamp(target - p.vx, -acc * 1.2, acc);
    if (dir) p.face = dir;
    // salto
    if (p.buffer > 0 && p.coyote > 0) {
      p.vy = JUMP_V;
      p.ground = false;
      p.coyote = 0;
      p.buffer = 0;
      p.jumpHeld = true;
      audio.playJump();
      this.particles.burst(new THREE.Vector3(p.x, p.y + 0.1, 0.5), [0xfff6e6, 0xffc800], 4, 2, 0.3, 4, 0.8);
    }
    if (!this.keys.jump) p.jumpHeld = false;
    // gravedad (más corta si sueltas el salto)
    if (p.vy > 0 && !p.jumpHeld) p.vy -= GRAV * 2.2 * dt;
    else p.vy -= (p.vy < 0 ? GRAV_FALL : GRAV) * dt;
    p.vy = Math.max(p.vy, -26);
    // mover en X con colisión
    p.x += p.vx * dt;
    this._collideX(p);
    const prevY = p.y;
    p.y += p.vy * dt;
    p.ground = false;
    this._collideY(p, prevY);
    p.x = clamp(p.x, 0.4, this.lv.W - 0.4);
    // al pie de los pinchos
    for (const [sx, sy] of this.spikes) {
      if (p.x + PW / 2 > sx + 0.12 && p.x - PW / 2 < sx + 0.88 && p.y < sy + 0.5 && p.y + PH > sy) this._hurt(0, true);
    }
    // se cayó a un pozo
    if (p.y < -2.5) this._fall();
    p.anim = !p.ground ? "jump" : Math.abs(p.vx) > 0.8 ? "run" : "idle";
    // checkpoints
    this.lv.checkpoints.forEach((cx, i) => { if (i > this.checkpointIdx && p.x > cx + 1) { this.checkpointIdx = i; this.spawn = { x: cx + 1.5, y: this._groundY(cx + 1.5) }; this.banner("¡Punto de control!"); audio.playPowerup(); } });
    // jefe: cuando entras a la arena se cierra la puerta de atrás (ya está) y suena la música
    if (this.lv.isBoss && !this.bossIntro && p.x > this.lv.arenaX + 3) { this.bossIntro = true; this.banner("¡Jefe del mundo!"); }
  }

  _groundY(x) {
    for (let y = H - 1; y >= 0; y--) if (SOLID.has(this._tile(x, y))) return y + 1;
    return 0;
  }

  _collideX(p) {
    const hw = PW / 2;
    for (const yy of [p.y + 0.1, p.y + PH * 0.5, p.y + PH - 0.1]) {
      const edge = p.vx > 0 ? p.x + hw : p.x - hw;
      if (this._solid(edge, yy)) {
        p.x = p.vx > 0 ? Math.floor(edge) - hw - 0.001 : Math.floor(edge) + 1 + hw + 0.001;
        p.vx = 0;
        break;
      }
    }
  }

  _collideY(p, prevY) {
    const hw = PW / 2 - 0.05;
    if (p.vy <= 0) {
      // suelo (también plataformas de una vía '=')
      for (const xx of [p.x - hw, p.x, p.x + hw]) {
        const ty = Math.floor(p.y);
        const ch = this._tile(xx, p.y);
        const top = ty + 1;
        if (SOLID.has(ch)) { p.y = top; p.vy = 0; p.ground = true; break; }
        if (ch === "=" && prevY >= top - 0.001) { p.y = top; p.vy = 0; p.ground = true; break; } // plataforma de una vía
      }
    } else {
      // cabeza: golpea bloques
      for (const xx of [p.x - hw, p.x, p.x + hw]) {
        const ch = this._tile(xx, p.y + PH);
        if (SOLID.has(ch)) {
          const ty = Math.floor(p.y + PH);
          p.y = ty - PH - 0.001;
          p.vy = 0;
          this._hitBlock(Math.floor(xx), ty);
          break;
        }
      }
    }
  }

  _hitBlock(tx, ty) {
    const ch = this.lv.map[ty] && this.lv.map[ty][tx];
    if (ch === "?") {
      const qb = this.qBlocks.find((b) => b.x === tx && b.y === ty);
      if (!qb || qb.used) return;
      qb.used = true;
      this.lv.map[ty][tx] = "U";
      qb.mesh.material = this.usedMat;
      qb.bump = 0.25;
      const heart = this.hearts < this.maxHearts && Math.random() < 0.45;
      if (heart) { this.hearts++; this.popups.add(new THREE.Vector3(tx + 0.5, ty + 1.4, 0.5), "❤ +1", "combo"); audio.playPowerup(); }
      else { this.coins += 3; this.score += 150; this.popups.add(new THREE.Vector3(tx + 0.5, ty + 1.4, 0.5), "+3 🍫", "combo"); audio.playCollect(); }
      this.particles.burst(new THREE.Vector3(tx + 0.5, ty + 1, 0.6), [0xffc800, 0xfff6e6], 12, 4, 0.6, 6);
      this._updateHud();
    } else if (ch === "B") {
      // los ladrillos se rompen
      this.lv.map[ty][tx] = ".";
      this.score += 20;
      this.particles.burst(new THREE.Vector3(tx + 0.5, ty + 0.5, 0.6), [WORLDS[this.lv.world].brick, 0xfff6e6], 14, 5, 0.7, 12);
      audio.playBump();
      this._rebuildBricks();
    } else audio.playBump();
  }

  _rebuildBricks() {
    // las instancias de ladrillo se rehacen (pocas veces)
    const keep = [];
    this.levelGroup.children.forEach((c) => { if (c.isInstancedMesh && c.material === this._brickMat) keep.push(c); });
    for (const c of keep) this.levelGroup.remove(c);
    const list = [];
    const map = this.lv.map;
    for (let y = 0; y < H; y++) for (let x = 0; x < map[0].length; x++) if (map[y][x] === "B") list.push([x, y]);
    if (!list.length) return;
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1.5), this._brickMat, list.length);
    const m4 = new THREE.Matrix4();
    list.forEach(([x, y], i) => { m4.makeTranslation(x + 0.5, y + 0.5, 0); im.setMatrixAt(i, m4); });
    im.castShadow = true;
    this.levelGroup.add(im);
  }

  _updateEnemies(dt) {
    const p = this.player;
    for (const e of this.enemies) {
      if (e.dead > 0) { e.dead += dt; e.mesh.scale.y = Math.max(0.05, 1 - e.dead * 5); e.mesh.scale.x = 1 + e.dead * 3; if (e.dead > 0.35) { this.levelGroup.remove(e.mesh); e.gone = true; } continue; }
      e.t += dt;
      if (Math.abs(e.x - p.x) > 22) continue; // lejos: dormidos
      if (e.type === "V") {
        e.x += e.vx * dt * 0.9;
        e.y = e.baseY + Math.sin(e.t * 2.2) * 1.2;
        if (Math.sin(e.t * 0.7) > 0.95 || this._solid(e.x + Math.sign(e.vx) * 0.5, e.y + 0.3)) e.vx = -e.vx;
        if (e.t % 3 < 0.02) e.vx = -e.vx;
        for (const w of e.mesh.userData.wings || []) w.rotation.z = Math.sin(e.t * 18) * 0.5 * Math.sign(w.position.x);
      } else {
        e.vy -= GRAV * dt;
        e.x += e.vx * dt;
        const front = e.x + Math.sign(e.vx) * (e.w / 2 + 0.05);
        const wallAhead = this._solid(front, e.y + 0.3);
        const floorAhead = this._solid(front, e.y - 0.2) || this._tile(front, e.y - 0.2) === "=";
        if (wallAhead || (!floorAhead && e.onGround)) e.vx = -e.vx;
        e.y += e.vy * dt;
        e.onGround = false;
        if (e.vy <= 0 && (this._solid(e.x, e.y) || this._solid(e.x - 0.25, e.y) || this._solid(e.x + 0.25, e.y))) { e.y = Math.floor(e.y) + 1; e.vy = 0; e.onGround = true; }
        if (e.y < -4) { e.dead = 1; e.gone = true; this.levelGroup.remove(e.mesh); }
      }
      e.mesh.position.set(e.x, e.y, 0);
      e.mesh.rotation.y = e.vx > 0 ? 0.5 : -0.5;
      // contacto con el Matichico
      if (!p.dead && !p.win && Math.abs(p.x - e.x) < (PW + e.w) / 2 && p.y < e.y + e.h && p.y + PH > e.y) {
        if (p.vy < -1 && p.y > e.y + e.h * 0.45 && e.stompable) {
          e.dead = 0.001;
          p.vy = this.keys.jump ? BIG_V * 2.1 : BIG_V * 1.5;
          p.jumpHeld = this.keys.jump;
          this.stomps++;
          this.score += 100;
          this.popups.add(new THREE.Vector3(e.x, e.y + 1, 0.5), "+100", "combo");
          this.particles.burst(new THREE.Vector3(e.x, e.y + 0.4, 0.6), [0xfff6e6, 0xffc800], 10, 4, 0.5, 8);
          audio.playHitEnemy();
          this._updateHud();
        } else if (p.invuln <= 0) this._hurt(Math.sign(p.x - e.x) || 1, false);
      }
    }
    this.enemies = this.enemies.filter((e) => !e.gone);
  }

  _updateBoss(dt) {
    const b = this.boss;
    if (!b) return;
    const p = this.player;
    if (b.dead > 0) {
      b.dead += dt;
      b.mesh.rotation.y += dt * 10;
      b.mesh.scale.setScalar(Math.max(0.001, 1 - b.dead / 1.2));
      if (b.dead > 1.2 && b.mesh.parent) {
        this.levelGroup.remove(b.mesh);
        this.bossWallOpen = true;
        this._applyBossWall(false);
        this.banner("¡Jefe derrotado! El camino se abrió");
      }
      return;
    }
    b.hurtT = Math.max(0, b.hurtT - dt);
    b.stun = Math.max(0, b.stun - dt);
    const ax = this.lv.arenaX;
    const active = p.x > ax + 2;
    if (active && b.stun <= 0) {
      const sp = 3 + (3 - b.hp) * 1.2 + this.lv.world * 0.4;
      b.vx = Math.sign(b.vx || -1) * sp;
      b.x += b.vx * dt;
      if (b.x < ax + 2.5) { b.x = ax + 2.5; b.vx = Math.abs(b.vx); }
      if (b.x > ax + 31.5) { b.x = ax + 31.5; b.vx = -Math.abs(b.vx); }
      b.jumpT -= dt;
      if (b.jumpT <= 0 && b.y <= 2.01) { b.vy = 11; b.jumpT = 1.6 + Math.random() * 1.5 - (3 - b.hp) * 0.3; }
    }
    b.vy -= GRAV * dt;
    b.y = Math.max(2, b.y + b.vy * dt);
    if (b.y <= 2) b.vy = Math.max(0, b.vy);
    b.mesh.position.set(b.x, b.y, 0);
    b.mesh.rotation.y = b.vx > 0 ? 0.4 : -0.4;
    b.mesh.rotation.z = b.stun > 0 ? Math.sin(this.t * 30) * 0.15 : 0;
    b.mat.emissive.setHex(b.hurtT > 0 ? 0xff2a2a : 0);
    b.mat.emissiveIntensity = b.hurtT > 0 ? 0.8 : 0;
    // contacto
    if (!p.dead && !p.win && Math.abs(p.x - b.x) < (PW + b.w) / 2 && p.y < b.y + b.h && p.y + PH > b.y) {
      if (p.vy < -1 && p.y > b.y + b.h * 0.55 && b.hurtT <= 0) {
        b.hp--;
        b.hurtT = 1.2;
        b.stun = 1.0;
        p.vy = 14;
        this.score += 300;
        this.shake = 0.3;
        this.popups.add(new THREE.Vector3(b.x, b.y + 2.6, 0.5), b.hp > 0 ? `¡Pisotón! ${b.hp} más` : "¡Último!", "combo");
        this.particles.burst(new THREE.Vector3(b.x, b.y + 2, 0.6), [0xffc800, 0xfff6e6, 0xd4216c], 20, 6, 0.8, 8);
        audio.playHeadshot();
        if (b.hp <= 0) { b.dead = 0.001; this.score += 800; audio.playVictory(); }
        this._updateHud();
      } else if (p.invuln <= 0 && b.hurtT <= 0 && b.stun <= 0) this._hurt(Math.sign(p.x - b.x) || 1, false);
    }
  }

  _hurt(dir, spikes) {
    const p = this.player;
    if (p.invuln > 0 || p.dead || p.win) return;
    this.hearts--;
    this.hurtCount++;
    (this.hurtLog = this.hurtLog || []).push(`${spikes ? "pinchos" : "enemigo"}@${p.x.toFixed(0)}`);
    p.invuln = 1.6;
    p.vy = 9;
    p.vx = dir ? dir * 7 : 0;
    p.ground = false;
    this.shake = 0.25;
    audio.playHurt();
    this.haptic(40);
    if (spikes) { p.vy = 12; }
    if (this.hearts <= 0) { this._die(); }
    this._updateHud();
  }

  _fall() {
    const p = this.player;
    if (p.dead) return;
    this.hearts--;
    this.hurtCount++;
    (this.hurtLog = this.hurtLog || []).push(`pozo@${p.x.toFixed(0)}`);
    audio.playHurt();
    this.haptic(40);
    this._updateHud();
    if (this.hearts <= 0) { this._die(); return; }
    p.x = this.spawn.x; p.y = this.spawn.y + 0.5; p.vx = 0; p.vy = 0; p.invuln = 2;
    this.camX = p.x + 2;
  }

  _die() {
    const p = this.player;
    p.dead = true;
    p.vy = 11;
    p.deadT = 0;
    audio.playLose();
    this.runInfo = { level: this.level, lost: 1, coins: this.coins };
    setTimeout(() => {
      if (this.state !== "playing") return;
      const t = this.els.q("gameover-title");
      if (t) t.textContent = "¡Oh no! Te quedaste sin corazones";
      this.finish(`Llegaste a ${Math.round((p.x / this.lv.flagX) * 100)}% del camino y juntaste ${this.coins} alfajores. ¡Inténtalo otra vez!`);
    }, 1200);
  }

  _collect() {
    const p = this.player;
    let changed = false;
    for (const c of this.coinList) {
      if (c.got) continue;
      if (Math.abs(c.x - p.x) < 0.65 && c.y > p.y - 0.2 && c.y < p.y + PH + 0.3) {
        c.got = true;
        this.coins++;
        this.score += 10;
        audio.playCollect();
        this.particles.burst(new THREE.Vector3(c.x, c.y, 0.5), [0xffc800, 0xfff6e6], 6, 3, 0.4, 2);
        changed = true;
      }
    }
    if (changed) { this._refreshCoins(); this._updateHud(); }
  }

  _refreshCoins() {
    const m4 = new THREE.Matrix4();
    this.coinList.forEach((c, i) => {
      m4.compose(new THREE.Vector3(c.x, c.y, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)), new THREE.Vector3(c.got ? 0.0001 : 1, c.got ? 0.0001 : 1, c.got ? 0.0001 : 1));
      this.coinMesh.setMatrixAt(i, m4);
    });
    this.coinMesh.instanceMatrix.needsUpdate = true;
  }

  _checkGoal(dt) {
    const p = this.player;
    if (p.dead) return;
    if (!p.win && p.x > this.lv.flagX - 0.3 && (!this.lv.isBoss || this.bossWallOpen)) {
      p.win = true;
      p.winT = 0;
      this.banner("¡META!");
      audio.playMissionComplete();
      this.particles.burst(new THREE.Vector3(this.lv.flagX, 7, 0.6), [0xffc800, 0xd4216c, 0xfff6e6, 0x35f0ff], 40, 7, 1.2, 4);
    }
    if (p.win && p.winT > 1.3 && !this._won) { this._won = true; this._win(); }
  }

  _win() {
    const total = this.coinList.length;
    const ratio = total ? this.coins / total : 1;
    const stars = 1 + (ratio >= 0.7 ? 1 : 0) + (this.hurtCount === 0 || ratio >= 0.97 ? 1 : 0);
    this.score += this.hearts * 100;
    const txt = `¡Llegaste a la meta! Juntaste ${this.coins} de ${total} alfajores y te quedan ${this.hearts} corazón${this.hearts === 1 ? "" : "es"}.`;
    this.runInfo = { level: this.level, coins: this.coins, total, stars, stomps: this.stomps, boss: this.lv.isBoss ? 1 : 0, perfect: this.hurtCount === 0 ? 1 : 0 };
    if (this.level >= LEVELS_PER_GAME) {
      campaignWin(this.progress, GAME_ID, this.level, stars);
      const t = this.els.q("gameover-title");
      if (t) t.textContent = `¡Completaste las ${LEVELS_PER_GAME} aventuras! 🏆`;
      audio.playVictory();
      this.finish(txt);
    } else this.levelWin({ level: this.level, stars, text: txt, title: this.lv.isBoss ? "¡Mundo completado!" : `¡Nivel ${this.level} superado!` });
  }

  retry() {
    this._won = false;
    this.bossIntro = false;
    super.retry();
  }

  nextLevel() {
    campaign(this.progress, GAME_ID).selected = Math.min(LEVELS_PER_GAME, this.level + 1);
    this._won = false;
    this.bossIntro = false;
    this.particles.clear();
    this.popups.clear();
    this.state = "intro";
    this.reset();
    this.beginPlaying();
  }

  onIntro() {
    this._won = false;
    const c = campaign(this.progress, GAME_ID);
    c.selected = Math.min(c.selected || c.unlocked, c.unlocked);
    renderLevelPicker(this.q("lvlpick"), { id: GAME_ID, progress: this.progress, selected: c.selected, onSelect: (n) => { c.selected = n; saveProgress(this.progress); this.reset(); this._intro(); } });
    this._intro();
  }

  _intro() {
    const t = this.q("intro-text");
    const w = WORLDS[this.lv.world];
    if (t) t.textContent = `Mundo ${this.lv.world + 1}: ${w.name} · nivel ${(this.level - 1) % 4 + 1} de 4${this.lv.isBoss ? " · ¡JEFE!" : ""}`;
  }

  // ---------- pantalla ----------

  _fit() {
    if (!this.camera) return;
    const aspect = this.camera.aspect;
    const vf = (this.camera.fov * Math.PI) / 180;
    const halfH = 4.1;
    const halfW = 7.2 / 1; // mínimo de casillas visibles a cada lado
    const dist = Math.max(halfH / Math.tan(vf / 2), (halfW * 0.62) / (Math.tan(vf / 2) * aspect));
    this.camDist = dist;
  }

  onResize() { this._fit(); }

  _updateCamera(dt) {
    if (!this.player || !this.camDist) return;
    const p = this.player;
    const tx = clamp(p.x + p.face * 2.2, 5, this.lv.W - 4);
    const ty = Math.max(3.4, p.y + 1.8);
    const k = 1 - Math.exp(-5 * dt);
    this.camX = lerp(this.camX, tx, k);
    this.camY = lerp(this.camY, ty, 1 - Math.exp(-3 * dt));
    const sh = this.shake > 0 ? this.shake : 0;
    this.camera.position.set(this.camX + (sh ? rand(-sh, sh) * 0.5 : 0), this.camY + 1 + (sh ? rand(-sh, sh) * 0.5 : 0), this.camDist);
    this.camera.lookAt(this.camX, this.camY, 0);
    this.shake = Math.max(0, (this.shake || 0) - dt * 1.6);
    this.sun.position.set(this.camX - 6, 14, 12);
    this.sun.target.position.set(this.camX, 3, 0);
    this.bg.position.x = this.camX * 0.72;
    this.bg.position.y = (this.camY - 4) * 0.5;
  }

  _placeHero() {
    const p = this.player;
    if (!p) return;
    const h = this.hero;
    h.group.position.set(p.x, p.y, 0);
    h.group.rotation.y = Math.PI / 2 * p.face + (p.dead ? Math.sin(p.deadT * 10) * 0.3 : 0);
    if (p.win) h.animate(this.time, "cheer", 1);
    else if (p.dead) h.animate(this.time, "sad", 1);
    else h.animate(this.time, p.anim, p.anim === "run" ? Math.min(1.4, Math.abs(p.vx) / RUN_V + 0.3) : 1);
    h.group.visible = !(p.invuln > 0 && Math.floor(this.time * 18) % 2 === 0);
  }

  _animateWorld(dt) {
    // alfajores girando y bloques que rebotan
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const sc = new THREE.Vector3();
    const pos = new THREE.Vector3();
    this.coinList.forEach((c, i) => {
      if (c.got) return;
      e.set(Math.PI / 2, 0, this.time * 2.4 + i);
      q.setFromEuler(e);
      sc.set(1, 1, 1);
      pos.set(c.x, c.y + Math.sin(this.time * 3 + i) * 0.06, 0);
      m4.compose(pos, q, sc);
      this.coinMesh.setMatrixAt(i, m4);
    });
    this.coinMesh.instanceMatrix.needsUpdate = true;
    for (const qb of this.qBlocks) {
      if (qb.bump > 0) { qb.bump = Math.max(0, qb.bump - dt * 1.2); qb.mesh.position.y = qb.y + 0.5 + Math.sin((qb.bump / 0.25) * Math.PI) * 0.22; }
      else qb.mesh.position.y = qb.y + 0.5;
    }
    // bandera ondeando
    if (this.flagCloth) {
      const pos2 = this.flagCloth.geometry.attributes.position;
      for (let i = 0; i < pos2.count; i++) {
        const bx = this.flagBase[i * 3];
        pos2.setZ(i, Math.sin(this.time * 5 + bx * 3) * 0.12 * (bx + 0.85));
      }
      pos2.needsUpdate = true;
    }
  }

  _updateHud() {
    const set = (id, v) => { const el = this.q(id); if (el) el.textContent = v; };
    set("hud-hearts", "❤".repeat(Math.max(0, this.hearts)) + "🤍".repeat(Math.max(0, this.maxHearts - this.hearts)));
    set("hud-coins", this.coins);
    set("hud-score", this.score);
    set("hud-level", `Mundo ${this.lv.world + 1}-${(this.level - 1) % 4 + 1}`);
    set("hud-boss", this.boss && this.boss.dead <= 0 ? `👑 ${"●".repeat(this.boss.hp)}${"○".repeat(3 - this.boss.hp)}` : "");
    const bossChip = this.q("hud-boss-chip");
    if (bossChip) bossChip.classList.toggle("hidden", !(this.boss && this.boss.dead <= 0));
  }

  onBegin() {
    this._won = false;
    this._updateHud();
    const w = WORLDS[this.lv.world];
    this.banner(`${w.name} ${this.lv.world + 1}-${(this.level - 1) % 4 + 1}`);
    this.musicTheme = w.music;
  }

  pauseForMenu() {
    this.keys = { left: false, right: false, jump: false };
    super.pauseForMenu();
  }
}
