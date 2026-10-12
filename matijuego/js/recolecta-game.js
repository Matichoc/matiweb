// Recolecta y Corre 3D: recorre cada cancha por un camino guiado juntando
// golosinas (fotos reales de productos Matichoc) contra el reloj. Mismos 6
// niveles y reglas de siempre (js/levels.js); ahora en 3D con cámara en tercera
// persona, tu Matichico corriendo y saltando las vallas, y canchas con público.

import { THREE, Game3D, clamp, lerp, rand, loadTexture, canvasTexture, roundedBox, makeBunting } from "./three-kit.js";
import { createMatichico } from "./matichico3d.js";
import { LEVELS, CANVAS_W, CANVAS_H, generateChocolates, findFreeSpot, getObstacles, getSpawn } from "./levels.js";
import { saveProgress, addToLeaderboard, reportScore, earnCoins } from "./storage.js";
import * as audio from "./audio.js";

const GAME_ID = "recolecta";
const S = 0.04; // píxeles del nivel -> unidades 3D
const wx = (px) => px * S - (CANVAS_W * S) / 2;
const wz = (py) => py * S - (CANVAS_H * S) / 2;
const WALL_H = 0.85;

const PRODUCT_SPRITES = {
  choco: ["bomba-choco", "bomba-dorada"],
  alfajor: ["alf-frambuesa", "alf-menta", "alf-naranja", "alf-trufa", "alf-maracuya", "alf-pie-limon"],
  cuchuflin: ["cuchufli"],
  barquillo: ["alf-almendra", "alf-capuchino", "alf-tradicional"],
};

const THEMES = {
  field: {
    sky: 0x9fdcf5, ground: 0x7fb84a, outdoor: true, hemi: 1.25, sun: 2.5,
    wallSide: 0x2f7a3a, wallTop: 0x57b04c,
    floor(g, k) {
      g.fillStyle = "#2f8f3e";
      g.fillRect(0, 0, 800 * k, 480 * k);
      for (let x = 0; x < 800; x += 80) {
        g.fillStyle = (x / 80) % 2 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)";
        g.fillRect(x * k, 0, 80 * k, 480 * k);
      }
      g.strokeStyle = "rgba(232,245,232,0.85)";
      g.lineWidth = 3 * k;
      g.beginPath(); g.arc(400 * k, 240 * k, 50 * k, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(400 * k, 24 * k); g.lineTo(400 * k, 456 * k); g.stroke();
      g.strokeRect(24 * k, 150 * k, 90 * k, 180 * k);
      g.strokeRect(686 * k, 150 * k, 90 * k, 180 * k);
    },
  },
  court: {
    sky: 0x2a1c26, ground: 0x3a2418, outdoor: false, hemi: 1.0, sun: 2.0,
    wallSide: 0x64321b, wallTop: 0xd4216c,
    floor(g, k) {
      g.fillStyle = "#c98a4b";
      g.fillRect(0, 0, 800 * k, 480 * k);
      for (let x = 0; x < 800; x += 40) {
        g.fillStyle = "rgba(0,0,0,0.05)";
        g.fillRect(x * k, 0, 2 * k, 480 * k);
        if ((x / 40) % 2) { g.fillStyle = "rgba(255,230,180,0.05)"; g.fillRect(x * k, 0, 40 * k, 480 * k); }
      }
      g.strokeStyle = "#3a2411";
      g.lineWidth = 3 * k;
      g.beginPath(); g.arc(400 * k, 240 * k, 60 * k, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(400 * k, 24 * k); g.lineTo(400 * k, 456 * k); g.stroke();
      g.strokeRect(24 * k, 170 * k, 130 * k, 140 * k);
      g.strokeRect(646 * k, 170 * k, 130 * k, 140 * k);
    },
  },
  gym: {
    sky: 0x3a2430, ground: 0x4a3038, outdoor: false, hemi: 1.1, sun: 2.0,
    wallSide: 0xd4216c, wallTop: 0xff6fa8,
    floor(g, k) {
      g.fillStyle = "#f7ecd9";
      g.fillRect(0, 0, 800 * k, 480 * k);
      g.strokeStyle = "rgba(0,0,0,0.05)";
      g.lineWidth = 1.5 * k;
      for (let x = 0; x < 800; x += 48) for (let y = 0; y < 480; y += 48) g.strokeRect(x * k, y * k, 48 * k, 48 * k);
      g.fillStyle = "rgba(212,33,108,0.12)";
      g.fillRect(0, 30 * k, 800 * k, 16 * k);
      g.fillStyle = "rgba(212,33,108,0.5)";
      for (let x = 50; x < 760; x += 70) g.fillRect(x * k, 434 * k, 6 * k, 22 * k);
    },
  },
};

function mergeWalls(cells) {
  // une celdas contiguas en rectángulos grandes (menos mallas)
  const rows = new Map();
  for (const c of cells) {
    if (!rows.has(c.y)) rows.set(c.y, []);
    rows.get(c.y).push(c);
  }
  const strips = [];
  for (const [y, list] of rows) {
    list.sort((a, b) => a.x - b.x);
    let cur = null;
    for (const c of list) {
      if (cur && cur.x + cur.w === c.x && cur.h === c.h) cur.w += c.w;
      else { if (cur) strips.push(cur); cur = { x: c.x, y, w: c.w, h: c.h }; }
    }
    if (cur) strips.push(cur);
  }
  strips.sort((a, b) => a.x - b.x || a.w - b.w || a.y - b.y);
  const out = [];
  for (const s of strips) {
    const last = out[out.length - 1];
    if (last && last.x === s.x && last.w === s.w && last.y + last.h === s.y) last.h += s.h;
    else out.push({ ...s });
  }
  return out;
}

export class RecolectaGame extends Game3D {
  constructor(character, progress, els) {
    super(GAME_ID, character, progress, els, { fov: 46 });
    this.keys = {};
    this.levelIndex = 0;
    this.q = els.q;
    this.p = { x: 0, y: 0, radius: 16, speed: 190, facing: 0, isMoving: false, isJumping: false, jumpTimer: 0, jumpDuration: 0.45, jumpCooldown: 0 };
  }

  // ---------- escena ----------

  async build() {
    const s = this.scene;
    s.background = new THREE.Color(0x9fdcf5);
    s.fog = new THREE.Fog(0x9fdcf5, 38, 95);
    this.hemi = new THREE.HemisphereLight(0xcfeaff, 0xf2d8b0, 1.25);
    s.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff0d2, 2.5);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(this.coarse ? 1024 : 2048, this.coarse ? 1024 : 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -15; sc.right = 15; sc.top = 15; sc.bottom = -15; sc.near = 1; sc.far = 70;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.05;
    s.add(this.sun, this.sun.target);
    this.onLowQuality = () => { this.sun.castShadow = false; };

    const std = (c, r = 0.6, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, ...extra });
    this.m = {
      pink: std(0xd4216c, 0.4),
      cream: std(0xfff6e6, 0.5),
      gold: std(0xffc800, 0.25, { metalness: 0.5 }),
      brown: std(0x64321b, 0.5),
      red: std(0xc0261c, 0.5),
      white: std(0xffffff, 0.5),
      steel: std(0xb9b0a6, 0.3, { metalness: 0.6 }),
      crate: new THREE.MeshStandardMaterial({
        map: canvasTexture(128, 128, (g, w, h) => {
          g.fillStyle = "#9a6a3f"; g.fillRect(0, 0, w, h);
          g.strokeStyle = "#6e4624"; g.lineWidth = 5;
          for (let y = 0; y <= h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
          g.strokeRect(3, 3, w - 6, h - 6);
          g.fillStyle = "#D4216C"; g.fillRect(0, 48, w, 32);
          g.fillStyle = "#FFF6E6"; g.font = '22px "Baby Chipmunk", sans-serif'; g.textAlign = "center"; g.textBaseline = "middle";
          g.fillText("MATICHOC", w / 2, 65);
        }),
        roughness: 0.85,
      }),
    };
    this.sprites = {};
    for (const list of Object.values(PRODUCT_SPRITES)) for (const n of list) if (!this.sprites[n]) this.sprites[n] = loadTexture(`assets/products/${n}.jpg`);
    this.discGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 26);
    this.rimGeo = new THREE.TorusGeometry(0.51, 0.055, 8, 26);

    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), std(0x7fb84a, 1));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.06;
    this.ground.receiveShadow = true;
    s.add(this.ground);

    this._ensureHero();
    this.levelGroup = new THREE.Group();
    s.add(this.levelGroup);
    this.particleHost = new THREE.Group();
    this.bonusMesh = null;
  }

  _ensureHero() {
    if (this.hero && this.heroId === this.character.id) {
      this.hero.setOutfit(this.outfit);
      return;
    }
    if (this.hero) this.scene.remove(this.hero.group);
    this.hero = createMatichico(this.character, this.outfit);
    this.heroId = this.character.id;
    this.hero.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.hero.group.scale.setScalar(1.25);
    this.scene.add(this.hero.group);
  }

  async init() {
    await super.init();
    this._bindInput();
  }

  // ---------- niveles ----------

  _clearLevel() {
    this.scene.remove(this.levelGroup);
    this.levelGroup = new THREE.Group();
    this.scene.add(this.levelGroup);
    this.hurdles = [];
    this.coneMeshes = [];
    this.chocoMeshes = [];
  }

  _theme() {
    return THEMES[this.level.theme];
  }

  _buildLevel() {
    this._clearLevel();
    const level = this.level;
    const th = this._theme();
    const g = this.levelGroup;
    const std = (c, r = 0.6) => new THREE.MeshStandardMaterial({ color: c, roughness: r });

    this.scene.background.setHex(th.sky);
    this.scene.fog.color.setHex(th.sky);
    this.ground.material.color.setHex(th.ground);
    this.hemi.intensity = th.hemi;
    this.sun.intensity = th.sun;
    this.hemi.color.setHex(th.outdoor ? 0xcfeaff : 0xffe2cf);

    // piso con las marcas de la cancha
    const k = 2;
    const floorTex = canvasTexture(800 * k, 480 * k, (c) => th.floor(c, k));
    floorTex.anisotropy = 8;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(CANVAS_W * S, CANVAS_H * S), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.85 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    g.add(floor);

    // muros: celdas del corredor unidas en bloques + borde
    const all = getObstacles(level);
    const cells = all.filter((o) => o.corridor).map((o) => ({ x: o.x, y: o.y, w: o.w, h: o.h }));
    const border = all.filter((o) => !o.corridor && (o.w >= CANVAS_W || o.h >= CANVAS_H));
    const solids = all.filter((o) => !o.corridor && o.w < CANVAS_W && o.h < CANVAS_H);
    const sideMat = std(th.wallSide, 0.7);
    const topMat = std(th.wallTop, 0.5);
    const blobs = [];
    const addWall = (r, h) => {
      const w = r.w * S;
      const d = r.h * S;
      const base = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), sideMat);
      base.position.set(wx(r.x + r.w / 2), h / 2, wz(r.y + r.h / 2));
      base.castShadow = true;
      base.receiveShadow = true;
      const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, 0.22, d + 0.08), topMat);
      cap.position.set(base.position.x, h + 0.08, base.position.z);
      cap.castShadow = true;
      g.add(base, cap);
      if (level.theme === "field") {
        const n = Math.max(1, Math.round((w + d) / 1.7));
        for (let i = 0; i < n; i++) blobs.push([base.position.x + rand(-w / 2, w / 2), h + 0.2, base.position.z + rand(-d / 2, d / 2), rand(0.35, 0.7)]);
      } else {
        const band = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.2, d + 0.04), level.theme === "court" ? this.m.pink : this.m.cream);
        band.position.set(base.position.x, h * 0.55, base.position.z);
        g.add(band);
      }
    };
    mergeWalls(cells).forEach((r) => addWall(r, WALL_H));
    border.forEach((r) => addWall(r, WALL_H + 0.5));
    if (blobs.length) {
      const bush = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, flatShading: true }), blobs.length);
      const dummy = new THREE.Object3D();
      const col = new THREE.Color();
      const greens = [0x3f9a45, 0x57b04c, 0x2f7a3a];
      blobs.forEach(([x, y, z, sc], i) => {
        dummy.position.set(x, y, z);
        dummy.scale.setScalar(sc);
        dummy.rotation.set(rand(0, 3), rand(0, 3), 0);
        dummy.updateMatrix();
        bush.setMatrixAt(i, dummy.matrix);
        bush.setColorAt(i, col.setHex(greens[i % 3]));
      });
      bush.castShadow = true;
      g.add(bush);
    }

    // obstáculos fijos: vallas saltables y conos/cajones
    for (const o of solids) {
      if (o.jumpable) this._addHurdle(g, o);
      else if (level.theme === "field") g.add(this._cone(wx(o.x + o.w / 2), wz(o.y + o.h / 2)));
      else {
        const crate = new THREE.Mesh(new THREE.BoxGeometry(o.w * S * 0.95, o.w * S * 0.95, o.h * S * 0.95), this.m.crate);
        crate.position.set(wx(o.x + o.w / 2), (o.w * S * 0.95) / 2, wz(o.y + o.h / 2));
        crate.castShadow = true;
        crate.receiveShadow = true;
        g.add(crate);
      }
    }
    // conos móviles
    this.moving = (level.movingObstacles || []).map((m) => ({ ...m, t: Math.random() * 10, baseX: m.x, baseY: m.y }));
    for (const m of this.moving) {
      m.mesh = this._cone(0, 0);
      g.add(m.mesh);
    }

    // guía del camino: puntos brillantes sobre el piso
    const pts = [];
    for (let i = 0; i < level.path.length - 1; i++) {
      const a = level.path[i];
      const b = level.path[i + 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      for (let d = 0; d < len; d += 56) pts.push([a.x + ((b.x - a.x) * d) / len, a.y + ((b.y - a.y) * d) / len]);
    }
    const dots = new THREE.InstancedMesh(new THREE.CircleGeometry(0.16, 12), new THREE.MeshBasicMaterial({ color: level.theme === "gym" ? 0xd4216c : 0xfff6e6, transparent: true, opacity: 0.55 }), pts.length);
    const dm = new THREE.Object3D();
    pts.forEach(([x, y], i) => {
      dm.position.set(wx(x), 0.02, wz(y));
      dm.rotation.set(-Math.PI / 2, 0, 0);
      dm.updateMatrix();
      dots.setMatrixAt(i, dm.matrix);
    });
    g.add(dots);

    this._buildSurroundings(g, level.theme);

    // bandera de meta
    if (level.flag) {
      const f = level.flag;
      const flag = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 3.4, 10), this.m.steel);
      pole.position.y = 1.7;
      const top = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), this.m.gold);
      top.position.y = 3.45;
      const clothGeo = new THREE.PlaneGeometry(1.5, 0.95, 10, 4);
      this.flagCloth = new THREE.Mesh(clothGeo, new THREE.MeshStandardMaterial({ color: 0x8a8f9b, roughness: 0.6, side: THREE.DoubleSide }));
      this.flagCloth.position.set(0.8, 3.0, 0);
      this.flagBase = clothGeo.attributes.position.array.slice();
      this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 14, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xffc800, transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      this.beam.position.y = 7;
      flag.add(pole, top, this.flagCloth, this.beam);
      flag.position.set(wx(f.x + f.w / 2), 0, wz(f.y + f.h / 2));
      g.add(flag);
    } else {
      this.flagCloth = null;
      this.beam = null;
    }
  }

  _cone(x, z) {
    const g = new THREE.Group();
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.3, 16), this.m.pink);
    cone.position.y = 0.7;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, 0.2, 16), this.m.cream);
    band.position.y = 0.62;
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.1, 1.1), this.m.pink);
    base.position.y = 0.05;
    g.add(cone, band, base);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    g.position.set(x, 0, z);
    return g;
  }

  _addHurdle(g, o) {
    const horizontal = o.w >= o.h;
    const len = (horizontal ? o.w : o.h) * S;
    const grp = new THREE.Group();
    const segs = Math.max(3, Math.round(len / 0.5));
    for (let i = 0; i < segs; i++) {
      const seg = new THREE.Mesh(new THREE.BoxGeometry(len / segs, 0.2, 0.2), i % 2 ? this.m.white : this.m.red);
      seg.position.set(-len / 2 + (i + 0.5) * (len / segs), 0.72, 0);
      seg.castShadow = true;
      grp.add(seg);
    }
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.05, 8), this.m.brown);
      post.position.set(s * (len / 2 + 0.05), 0.52, 0);
      post.castShadow = true;
      grp.add(post);
    }
    grp.position.set(wx(o.x + o.w / 2), 0, wz(o.y + o.h / 2));
    if (!horizontal) grp.rotation.y = Math.PI / 2;
    g.add(grp);
    this.hurdles.push(grp);
  }

  /** Público, tribunas y decoración alrededor de la cancha. */
  _buildSurroundings(g, theme) {
    const W = CANVAS_W * S;
    const H = CANVAS_H * S;
    const colors = [0xd4216c, 0xffc800, 0xcfd767, 0xfff6e6, 0xf08a3c, 0x4cc3ff];
    const rows = 4;
    const seats = [];
    const addStand = (cx, cz, length, alongX, dir) => {
      for (let r = 0; r < rows; r++) {
        for (let i = 0; i < length; i++) {
          const t = (i + 0.5) / length - 0.5;
          const off = 2.6 + r * 1.05;
          const x = alongX ? cx + t * length * 1.0 : cx + dir * off;
          const z = alongX ? cz + dir * off : cz + t * length * 1.0;
          seats.push([x, 0.55 + r * 0.75, z, Math.random()]);
        }
      }
    };
    addStand(0, -H / 2, Math.ceil(W), true, -1);
    addStand(0, H / 2, Math.ceil(W), true, 1);
    addStand(-W / 2, 0, Math.ceil(H), false, -1);
    addStand(W / 2, 0, Math.ceil(H), false, 1);
    const crowd = new THREE.InstancedMesh(new THREE.BoxGeometry(0.62, 0.7, 0.62), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }), seats.length);
    const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }), seats.length);
    const dm = new THREE.Object3D();
    const col = new THREE.Color();
    const skin = [0x8a5a36, 0xa9714a, 0x6b3d22, 0xd9a07a];
    seats.forEach(([x, y, z, r], i) => {
      dm.position.set(x, y, z);
      dm.scale.set(1, 1, 1);
      dm.updateMatrix();
      crowd.setMatrixAt(i, dm.matrix);
      crowd.setColorAt(i, col.setHex(colors[Math.floor(r * 97) % colors.length]));
      dm.position.y = y + 0.55;
      dm.updateMatrix();
      heads.setMatrixAt(i, dm.matrix);
      heads.setColorAt(i, col.setHex(skin[Math.floor(r * 31) % skin.length]));
    });
    g.add(crowd, heads);
    // gradas (escalones)
    const stepMat = new THREE.MeshStandardMaterial({ color: theme === "field" ? 0x8a8f9b : 0x5a3a2a, roughness: 0.8 });
    for (let r = 0; r < rows; r++) {
      const h = 0.3 + r * 0.75;
      const mk = (w, d, x, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), stepMat); m.position.set(x, h / 2 - 0.2, z); m.receiveShadow = true; g.add(m); };
      const off = 2.6 + r * 1.05;
      mk(W + 6, 1.0, 0, -H / 2 - off);
      mk(W + 6, 1.0, 0, H / 2 + off);
      mk(1.0, H + 6, -W / 2 - off, 0);
      mk(1.0, H + 6, W / 2 + off, 0);
    }
    // banderines de marca sobre la cancha
    const y = 6.2;
    g.add(makeBunting(new THREE.Vector3(-W / 2 - 2, y, -H / 2 - 2), new THREE.Vector3(W / 2 + 2, y, -H / 2 - 2), { count: 30, sag: 1.2, size: 0.4 }));
    g.add(makeBunting(new THREE.Vector3(-W / 2 - 2, y, H / 2 + 2), new THREE.Vector3(W / 2 + 2, y, H / 2 + 2), { count: 30, sag: 1.2, size: 0.4 }));
    if (theme === "court") {
      for (const s of [-1, 1]) {
        const hoop = new THREE.Group();
        const board = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.2, 3.2), this.m.white);
        board.position.set(0, 4.4, 0);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 8, 24), new THREE.MeshStandardMaterial({ color: 0xe8622c, roughness: 0.4 }));
        rim.rotation.x = Math.PI / 2;
        rim.position.set(-s * 0.7, 3.7, 0);
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 4.4, 10), this.m.steel);
        post.position.set(s * 0.6, 2.2, 0);
        hoop.add(board, rim, post);
        hoop.position.set(s * (W / 2 + 1.4), 0, 0);
        g.add(hoop);
      }
    }
    if (theme === "gym") {
      for (let i = -3; i <= 3; i++) {
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.15, 0.6), new THREE.MeshBasicMaterial({ color: 0xfff1c0 }));
        lamp.position.set(i * 5, 9, -H / 2 - 4);
        g.add(lamp);
      }
    }
    if (theme === "field") {
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        const tree = new THREE.Group();
        const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 2.8, 7), this.m.brown);
        tr.position.y = 1.4;
        const lf = new THREE.Mesh(new THREE.IcosahedronGeometry(1.8, 0), new THREE.MeshStandardMaterial({ color: 0x5f9640, roughness: 0.85, flatShading: true }));
        lf.position.y = 3.6;
        tree.add(tr, lf);
        tree.position.set(Math.cos(a) * (W / 2 + 14 + rand(0, 6)), 0, Math.sin(a) * (H / 2 + 14 + rand(0, 6)));
        tree.scale.setScalar(rand(1.0, 1.7));
        g.add(tree);
      }
    }
  }

  // ---------- partida ----------

  loadLevel(index) {
    this.levelIndex = index;
    const level = LEVELS[index];
    this.level = level;
    this._ensureHero();
    this._buildLevel();

    this.chocolates = generateChocolates(level);
    this.chocoMeshes = this.chocolates.map((c) => {
      const kind = c.kind || "choco";
      const list = PRODUCT_SPRITES[kind] || PRODUCT_SPRITES.choco;
      const tex = this.sprites[list[Math.floor(Math.random() * list.length)]];
      const disc = new THREE.Mesh(this.discGeo, [this.m.cream, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }), this.m.cream]);
      disc.rotation.x = Math.PI / 2;
      const rim = new THREE.Mesh(this.rimGeo, this.m.gold);
      rim.position.z = 0.03;
      const holder = new THREE.Group();
      holder.add(disc, rim);
      holder.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      holder.position.set(wx(c.x), 0.9, wz(c.y));
      this.levelGroup.add(holder);
      return holder;
    });
    this.collected = 0;
    this.timeLeft = level.timeLimit;
    const spawn = getSpawn(level);
    Object.assign(this.p, { x: spawn.x, y: spawn.y, isJumping: false, jumpTimer: 0, jumpCooldown: 0, facing: 0 });
    this.flagActive = false;
    this.bonus = null;
    this.bonusMesh = null;
    this.bonusSpawnTimer = rand(6, 10);
    this.state = "intro";

    const q = this.q;
    q("hud-level").textContent = level.name;
    q("hud-mission").textContent = level.missionText;
    q("hud-target").textContent = String(level.target);
    q("hud-choco").textContent = "0";
    q("hud-timer").textContent = String(level.timeLimit).padStart(2, "0");
    q("hud-timer-chip").classList.remove("low");
    q("intro-title").textContent = level.name;
    q("intro-text").textContent = level.missionText;
    this._updateHud();
    this.showOverlay("intro");
    this._snapCamera();
  }

  reset() {
    this.score = 0;
    this.loadLevel(0);
  }

  retry() {
    this.loadLevel(this.levelIndex);
    this.beginPlaying();
  }

  restart() {
    this.score = 0;
    this.loadLevel(0);
    this.beginPlaying();
  }

  nextLevel() {
    this.loadLevel(this.levelIndex + 1);
    this.beginPlaying();
  }

  pauseForMenu() {
    if (this.running) reportScore(this.progress, GAME_ID, this.score);
    this.running = false;
    this.state = "paused";
  }

  _updateHud() {
    this.q("hud-score").textContent = String(this.score);
    this.q("hud-coins").textContent = String(this.progress.coins);
  }

  // ---------- entrada ----------

  _bindInput() {
    const map = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", KeyW: "up", KeyS: "down", KeyA: "left", KeyD: "right" };
    window.addEventListener("keydown", (e) => {
      if (!this.running) return;
      if (map[e.code]) { this.keys[map[e.code]] = true; e.preventDefault(); }
      if (e.code === "Space") { this._tryJump(); e.preventDefault(); }
    });
    window.addEventListener("keyup", (e) => { if (map[e.code]) this.keys[map[e.code]] = false; });
    const root = document.getElementById("recolecta-touch");
    if (root) {
      root.querySelectorAll(".dpad-btn[data-dir]").forEach((btn) => {
        const dir = btn.dataset.dir;
        btn.addEventListener("pointerdown", (e) => { e.preventDefault(); this.keys[dir] = true; });
        const up = (e) => { e.preventDefault(); this.keys[dir] = false; };
        btn.addEventListener("pointerup", up);
        btn.addEventListener("pointerleave", up);
        btn.addEventListener("pointercancel", up);
      });
      const j = root.querySelector("#recolecta-btn-jump");
      if (j) j.addEventListener("pointerdown", (e) => { e.preventDefault(); this._tryJump(); });
    }
  }

  _tryJump() {
    if (this.state !== "playing") return;
    const p = this.p;
    if (p.isJumping || p.jumpCooldown > 0) return;
    p.isJumping = true;
    p.jumpTimer = p.jumpDuration;
    p.jumpCooldown = p.jumpDuration + 0.15;
    audio.playJump();
  }

  // ---------- física (mismas reglas que la versión 2D, en píxeles del nivel) ----------

  _hits(x, y, includeMoving) {
    const r = this.p.radius * 0.8;
    const list = includeMoving ? [...getObstacles(this.level), ...this.moving] : getObstacles(this.level);
    for (const o of list) {
      if (o.jumpable && this.p.isJumping) continue;
      if (x + r > o.x && x - r < o.x + o.w && y + r > o.y && y - r < o.y + o.h) return o;
    }
    return null;
  }

  _onObstacleHit(o) {
    if (this.moving.includes(o)) {
      const dx = this.p.x - (o.x + o.w / 2);
      const dy = this.p.y - (o.y + o.h / 2);
      const len = Math.hypot(dx, dy) || 1;
      const nx = clamp(this.p.x + (dx / len) * 14, 26, CANVAS_W - 26);
      const ny = clamp(this.p.y + (dy / len) * 14, 26, CANVAS_H - 26);
      if (!this._hits(nx, this.p.y, false)) this.p.x = nx;
      if (!this._hits(this.p.x, ny, false)) this.p.y = ny;
      audio.playBounce();
    } else {
      audio.playBump();
    }
  }

  update(dt) {
    const playing = this.state === "playing";
    const p = this.p;

    if (this.moving) {
      for (const m of this.moving) {
        if (playing) m.t += dt;
        const off = Math.sin(m.t * (m.speed / 40)) * m.range;
        if (m.axis === "y") m.y = m.baseY + off; else m.x = m.baseX + off;
        m.mesh.position.set(wx(m.x + m.w / 2), 0, wz(m.y + m.h / 2));
      }
    }

    if (playing) {
      if (p.jumpCooldown > 0) p.jumpCooldown -= dt;
      if (p.isJumping) {
        p.jumpTimer -= dt;
        if (p.jumpTimer <= 0) p.isJumping = false;
      }
      this._movePlayer(dt);
      this._checkChocolates();
      this._updateBonus(dt);
      this._checkFlag();
      this.timeLeft -= dt;
      this.q("hud-timer-chip").classList.toggle("low", this.timeLeft <= 10);
      this.q("hud-timer").textContent = String(Math.max(0, Math.ceil(this.timeLeft))).padStart(2, "0");
      if (this.timeLeft <= 0) this._onLose();
    }

    // dibujo del héroe
    const jp = p.isJumping ? 1 - p.jumpTimer / p.jumpDuration : 0;
    const jy = p.isJumping ? Math.sin(jp * Math.PI) * 1.3 : 0;
    this.hero.group.position.set(wx(p.x), jy, wz(p.y));
    this.hero.group.rotation.y = lerp(this.hero.group.rotation.y, p.facing, 1 - Math.exp(-14 * dt));
    this.hero.animate(this.time, p.isJumping ? "jump" : p.isMoving ? "run" : "idle", 0.9);

    // coleccionables, bonus y bandera
    this.chocoMeshes.forEach((m, i) => {
      const c = this.chocolates[i];
      m.visible = !c.taken;
      m.position.y = 0.95 + Math.sin(this.time * 4 + c.bobSeed) * 0.12;
      m.rotation.y = Math.sin(this.time * 2.4 + c.bobSeed) * 0.8;
    });
    if (this.bonusMesh) {
      this.bonusMesh.rotation.y += dt * 2.5;
      this.bonusMesh.position.y = 1.0 + Math.sin(this.time * 6) * 0.1;
      this.bonusMesh.scale.setScalar(1 + Math.sin(this.time * 10) * 0.07);
    }
    if (this.flagCloth) {
      const pos = this.flagCloth.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const bx = this.flagBase[i * 3];
        pos.setZ(i, Math.sin(this.time * 5 + bx * 3) * 0.16 * (bx + 0.75));
      }
      pos.needsUpdate = true;
      this.flagCloth.material.color.setHex(this.flagActive ? 0xffc800 : 0x8a8f9b);
      this.flagCloth.material.emissive.setHex(this.flagActive ? 0x6a4a00 : 0x000000);
      this.beam.material.opacity = this.flagActive ? 0.28 + Math.sin(this.time * 4) * 0.08 : 0;
    }

    this._followCamera(dt);
  }

  _movePlayer(dt) {
    const p = this.p;
    let vx = 0;
    let vy = 0;
    if (this.keys.up) vy -= 1;
    if (this.keys.down) vy += 1;
    if (this.keys.left) vx -= 1;
    if (this.keys.right) vx += 1;
    p.isMoving = vx !== 0 || vy !== 0;
    if (p.isMoving) {
      const len = Math.hypot(vx, vy);
      p.facing = Math.atan2(vx, vy);
      vx = (vx / len) * p.speed * dt;
      vy = (vy / len) * p.speed * dt;
      const nx = p.x + vx;
      const hitX = this._hits(nx, p.y, true);
      if (!hitX) p.x = nx; else this._onObstacleHit(hitX);
      const ny = p.y + vy;
      const hitY = this._hits(p.x, ny, true);
      if (!hitY) p.y = ny; else this._onObstacleHit(hitY);
    }
    p.x = clamp(p.x, 26, CANVAS_W - 26);
    p.y = clamp(p.y, 26, CANVAS_H - 26);
  }

  _checkChocolates() {
    const p = this.p;
    this.chocolates.forEach((c, i) => {
      if (c.taken) return;
      if (Math.hypot(c.x - p.x, c.y - p.y) < p.radius + 14) {
        c.taken = true;
        this.collected++;
        this.score += 10;
        audio.playCollect();
        const at = new THREE.Vector3(wx(c.x), 1.4, wz(c.y));
        this.popups.add(at, "+10", "kill");
        this.particles.burst(at, [0xffc800, 0xfff6e6, 0xd4216c], 8, 3, 0.5, 4);
        this.q("hud-choco").textContent = String(this.collected);
        this._updateHud();
        if (this.collected >= this.level.target) {
          if (this.level.requiresFlag) {
            this.flagActive = true;
            this.popups.add(new THREE.Vector3(wx(p.x), 2.6, wz(p.y)), "¡A la meta!", "combo");
          } else this._onWin();
        }
      }
    });
  }

  _updateBonus(dt) {
    const p = this.p;
    if (this.bonus) {
      this.bonus.timer -= dt;
      if (Math.hypot(this.bonus.x - p.x, this.bonus.y - p.y) < p.radius + 16) {
        earnCoins(this.progress, this.bonus.value);
        this.score += 30;
        const at = new THREE.Vector3(wx(this.bonus.x), 1.6, wz(this.bonus.y));
        this.popups.add(at, `+${this.bonus.value} 🍫✨`, "coin");
        this.particles.burst(at, [0xcfd767, 0xffc800, 0xffffff], 18, 4.5, 0.8, 4);
        audio.playBonusCollect();
        saveProgress(this.progress);
        this._clearBonus();
        this.bonusSpawnTimer = rand(10, 16);
        this._updateHud();
        return;
      }
      if (this.bonus.timer <= 0) {
        this._clearBonus();
        this.bonusSpawnTimer = rand(8, 14);
      }
    } else {
      this.bonusSpawnTimer -= dt;
      if (this.bonusSpawnTimer <= 0) {
        const spot = findFreeSpot(this.level, p);
        if (spot) {
          this.bonus = { x: spot.x, y: spot.y, timer: 3, value: 8 };
          const m = new THREE.Group();
          const bar = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.6, 0.22), this.m.gold);
          const pis = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.42, 0.05), new THREE.MeshStandardMaterial({ color: 0xcfd767, roughness: 0.4, emissive: 0x4a5a10 }));
          pis.position.z = 0.13;
          const halo = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.05, 8, 28), new THREE.MeshBasicMaterial({ color: 0xffe066 }));
          m.add(bar, pis, halo);
          m.position.set(wx(spot.x), 1.0, wz(spot.y));
          this.levelGroup.add(m);
          this.bonusMesh = m;
        }
        this.bonusSpawnTimer = rand(10, 16);
      }
    }
  }

  _clearBonus() {
    this.bonus = null;
    if (this.bonusMesh) this.levelGroup.remove(this.bonusMesh);
    this.bonusMesh = null;
  }

  _checkFlag() {
    if (!this.flagActive || !this.level.flag) return;
    const f = this.level.flag;
    if (Math.hypot(f.x + f.w / 2 - this.p.x, f.y + f.h / 2 - this.p.y) < this.p.radius + 20) this._onWin();
  }

  _onWin() {
    this.state = "win";
    audio.playMissionComplete();
    const isLast = this.levelIndex === LEVELS.length - 1;
    this.progress.unlockedLevel = Math.max(this.progress.unlockedLevel, this.levelIndex + 1);
    reportScore(this.progress, GAME_ID, this.score);
    saveProgress(this.progress);
    const p = this.p;
    this.particles.burst(new THREE.Vector3(wx(p.x), 1.5, wz(p.y)), [0xd4216c, 0xffc800, 0xcfd767, 0xfff6e6], 50, 7, 1.4, 6);
    if (isLast) {
      this.q("victory-text").textContent = `Completaste las ${LEVELS.length} canchas con ${this.score} puntos y ${this.progress.coins} monedas Dubai. ¡Toda La Liga te aplaude!`;
      audio.playVictory();
      addToLeaderboard(this.progress, GAME_ID, this.progress.playerName, this.score);
      this.showOverlay("victory");
    } else {
      this.q("win-text").textContent = `¡Cumpliste la misión con ${this.score} puntos! Prepárate para el siguiente reto.`;
      this.showOverlay("win");
    }
  }

  _onLose() {
    this.state = "lose";
    audio.playLose();
    reportScore(this.progress, GAME_ID, this.score);
    this.q("lose-text").textContent = `Recolectaste ${this.collected} de ${this.level.target} golosinas. ¡Tú puedes lograrlo!`;
    this.showOverlay("lose");
  }

  // ---------- cámara ----------

  _followCamera(dt) {
    const tx = wx(this.p.x);
    const tz = wz(this.p.y);
    const k = dt ? 1 - Math.exp(-5 * dt) : 1;
    this.camFocus.x = lerp(this.camFocus.x, tx, k);
    this.camFocus.z = lerp(this.camFocus.z, tz, k);
    this._placeCamera();
  }

  _snapCamera() {
    this.camFocus = new THREE.Vector3(wx(this.p.x), 0, wz(this.p.y));
    this._placeCamera();
  }

  _placeCamera() {
    const f = this.camFocus;
    const portrait = this.camera.aspect < 0.95;
    const h = portrait ? 11.5 : 8.2;
    const back = portrait ? 7.4 : 6.6;
    this.camera.position.set(f.x, h, f.z + back);
    this.camera.lookAt(f.x, 0.4, f.z - 0.8);
    this.sun.position.set(f.x + 8, 18, f.z + 10);
    this.sun.target.position.set(f.x, 0, f.z);
  }
}
