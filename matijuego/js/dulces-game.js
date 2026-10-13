// Choco Match 3D: juntar piezas de 3 en línea (tipo Candy Crush) con los productos reales de Matichoc
// (alfajores de frambuesa, menta, maracuyá y naranja, bombas de chocolate y cuchuflís).
// Desliza una pieza hacia una vecina (o toca una y luego la otra) para intercambiarlas y juntar 3 o más iguales.
//   · 4 en línea → pieza rayada (borra toda su fila o columna); 5 en línea → bomba de color; L o T → pieza envuelta (explota 3x3).
//   · Cada nivel pide algo distinto: llegar a un puntaje, juntar cierto dulce o romper las coberturas de chocolate duro.
//   · Cada 5 niveles aparece un JEFE: lo derrotas juntando piezas (le duele más su color débil) y él te lanza coberturas.
// 20 niveles con estrellas por movimientos que te sobran.

import { THREE, Game3D, clamp, lerp, rand, canvasTexture, loadTexture, roundedBox, makeBunting, makeLogo } from "./three-kit.js?v=d2f30b74ef";
import { saveProgress } from "./storage.js?v=d2f30b74ef";
import * as audio from "./audio.js?v=d2f30b74ef";
import { campaign, campaignWin, renderLevelPicker, LEVELS_PER_GAME } from "./campaign.js?v=d2f30b74ef";

const GAME_ID = "dulces";
const COLS = 7;
const ROWS = 7;
const CELL = 1.12;
const NTYPES = 6;
const SWAP_T = 0.17;
const POP_T = 0.2;

// Las seis piezas son productos de Matichoc con su foto real (assets/products/<img>.jpg).
const TYPES = [
  { name: "Alfajor de Frambuesa", short: "Frambuesa", img: "alf-frambuesa", color: 0xd4216c, icon: "🩷", shape: "disc" },
  { name: "Alfajor de Menta", short: "Menta", img: "alf-menta", color: 0x2fd08a, icon: "💚", shape: "disc" },
  { name: "Alfajor de Maracuyá", short: "Maracuyá", img: "alf-maracuya", color: 0xffc800, icon: "💛", shape: "disc" },
  { name: "Alfajor de Naranja", short: "Naranja", img: "alf-naranja", color: 0xff7a1a, icon: "🧡", shape: "disc" },
  { name: "Bomba de Chocolate", short: "Bomba", img: "bomba-choco", color: 0x5a2d16, icon: "🍫", shape: "ball" },
  { name: "Cuchuflí", short: "Cuchuflí", img: "cuchufli", color: 0xd9a463, icon: "🥖", shape: "tube" },
];

const BOSSES = [
  { name: "Don Cacao", color: 0x7a3f22, hp: 140, moves: 24, atk: 4, gum: 2 },
  { name: "Reina Frambuesa", color: 0xd4216c, hp: 160, moves: 25, atk: 4, gum: 2 },
  { name: "Rey Maracuyá", color: 0xffc800, hp: 175, moves: 27, atk: 3, gum: 3 },
  { name: "Dragón de Trufa", color: 0x4a2412, hp: 200, moves: 28, atk: 3, gum: 3 },
];

/** Qué pide cada nivel (1 a 20). */
export function levelSpec(L) {
  if (L % 5 === 0) {
    const b = BOSSES[L / 5 - 1];
    return { kind: "boss", boss: L / 5 - 1, moves: b.moves, hp: b.hp, atk: b.atk, gum: b.gum, name: b.name };
  }
  const t = (L - 1) / (LEVELS_PER_GAME - 1);
  const moves = Math.round(25 - t * 6);
  const kind = ["score", "collect", "gum"][(L - 1) % 3];
  // calibrado con un bot: la dificultad sube pareja (cuánto hay que hacer por cada movimiento), sin saltos entre tipos de nivel
  if (kind === "score") return { kind, moves, target: Math.round((moves * (38 + 1.3 * (L - 1))) / 10) * 10 };
  if (kind === "collect") return { kind, moves, color: (L * 2) % NTYPES, n: Math.round(moves * (0.36 + 0.03 * (L - 1))) };
  return { kind, moves, gum: 4 + Math.floor(L / 2.25) };
}

const key = (r, c) => r * COLS + c;
const worldX = (c) => (c - (COLS - 1) / 2) * CELL;
const worldZ = (r) => (r - (ROWS - 1) / 2) * CELL;

export class DulcesGame extends Game3D {
  constructor(character, progress, els) {
    super(GAME_ID, character, progress, els, { fov: 42 });
    this.musicTheme = "chill";
    this.q = els.q;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.25);
    this.g = [];
    this.pieces = new Set();
    this.phase = "input";
    this.level = 1;
  }

  // ---------- escena ----------

  async build() {
    const s = this.scene;
    s.background = new THREE.Color(0x3a1f2c);
    s.fog = new THREE.Fog(0x3a1f2c, 22, 46);
    s.add(new THREE.HemisphereLight(0xffe8f0, 0x5a2a3a, 1.15));
    this.sun = new THREE.DirectionalLight(0xfff0d2, 2.2);
    this.sun.position.set(-5, 14, 8);
    this.sun.castShadow = true;
    const sm = this.coarse ? 1024 : 2048;
    this.sun.shadow.mapSize.set(sm, sm);
    const sc = this.sun.shadow.camera;
    sc.left = -8; sc.right = 8; sc.top = 8; sc.bottom = -8; sc.near = 1; sc.far = 40;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;
    s.add(this.sun);
    this.onLowQuality = () => { this.sun.castShadow = false; };
    const spot = new THREE.PointLight(0xff9ad0, 30, 24, 1.4);
    spot.position.set(0, 6, -3);
    s.add(spot);

    // mesón de la chocolatería y bandeja del tablero
    const std = (color, roughness = 0.6, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), std(0x4a2a35, 0.9));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.7;
    floor.receiveShadow = true;
    s.add(floor);
    const counter = new THREE.Mesh(roundedBox(COLS * CELL + 1.6, 0.7, ROWS * CELL + 1.6, 0.3, 0.08), std(0x64321b, 0.5));
    counter.position.y = -0.2;
    counter.castShadow = true;
    counter.receiveShadow = true;
    s.add(counter);
    const tray = new THREE.Mesh(roundedBox(COLS * CELL + 0.5, 0.18, ROWS * CELL + 0.5, 0.2, 0.05), std(0x2a140c, 0.7));
    tray.position.y = 0.06;
    tray.receiveShadow = true;
    s.add(tray);
    // casillas claras y oscuras
    const tileGeo = new THREE.PlaneGeometry(CELL * 0.96, CELL * 0.96);
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const t = new THREE.Mesh(tileGeo, new THREE.MeshStandardMaterial({ color: (r + c) % 2 ? 0x4b2a1c : 0x5c3524, roughness: 0.9 }));
      t.rotation.x = -Math.PI / 2;
      t.position.set(worldX(c), 0.16, worldZ(r));
      t.receiveShadow = true;
      s.add(t);
    }
    // pared del fondo: repisas con frascos
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(60, 22), std(0x6a3a4a, 0.9));
    wall.position.set(0, 9, -12);
    s.add(wall);
    const jarColors = [0xd4216c, 0xffc800, 0x2fd08a, 0xff7a1a, 0x3b8cff, 0xfff6e6];
    for (const y of [3.2, 6.2]) {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(34, 0.25, 1.4), std(0x8a5a36));
      shelf.position.set(0, y, -11.2);
      s.add(shelf);
      for (let i = -7; i <= 7; i++) {
        const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.3, 14), new THREE.MeshStandardMaterial({ color: jarColors[(i + 9 + (y > 5 ? 2 : 0)) % jarColors.length], roughness: 0.2, transparent: true, opacity: 0.9 }));
        jar.position.set(i * 2.2, y + 0.78, -11.2);
        s.add(jar);
      }
    }
    s.add(makeBunting(new THREE.Vector3(-13, 9.6, -11), new THREE.Vector3(13, 9.6, -11), { count: 28, sag: 1.4, size: 0.5 }));
    // el logo de Matichoc grande en la pared del fondo
    const wallLogo = makeLogo(5);
    wallLogo.position.set(0, 7.2, -11.8);
    s.add(wallLogo);

    this._makeAssets();
    this.boss = null;

    // selector (anillo)
    this.sel = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 8, 28), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    this.sel.rotation.x = Math.PI / 2;
    this.sel.visible = false;
    s.add(this.sel);
  }

  _makeAssets() {
    const std = (color, roughness = 0.35, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
    this.mats = TYPES.map((t) => std(t.color, 0.3, { emissive: t.color, emissiveIntensity: 0.18 }));
    this.cream = std(0xfff6e6, 0.5);
    this.gold = std(0xffc800, 0.25, { metalness: 0.5, emissive: 0x6a4a00, emissiveIntensity: 0.4 });
    this.gumMat = std(0x3a1c0e, 0.22, { metalness: 0.15, emissive: 0x1a0a04, emissiveIntensity: 0.3 });
    const std2 = (c, r = 0.35, ex = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, ...ex });
    this.cookie = std2(0xd9a05a, 0.7);
    this.cookieGeo = new THREE.CylinderGeometry(0.43, 0.43, 0.11, 30);
    this.fillGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.2, 30);
    this.glazeGeo = new THREE.CylinderGeometry(0.37, 0.37, 0.04, 30);
    this.glazes = TYPES.map((t) => std2(new THREE.Color(t.color).lerp(new THREE.Color(0xffffff), 0.25), 0.15, { metalness: 0.1, emissive: t.color, emissiveIntensity: 0.15 }));
    this.accents = [0x8a0f45, 0xffffff, 0x4a2c10, 0xfff0c8, 0xffffff, 0xffffff].map((c) => std2(c, 0.4));
    this.dotGeo = new THREE.SphereGeometry(0.045, 8, 6);
    this.wafer = new THREE.CylinderGeometry(0.2, 0.2, 0.84, 18);
    this.waferMat = std2(0xe3b478, 0.55);
    this.stripeRing = new THREE.TorusGeometry(0.206, 0.045, 6, 20);
    this.redMat = std2(0xe0383a, 0.3);
    this.yellowMat = std2(0xffd23a, 0.3);
    this.capGeo = new THREE.CircleGeometry(0.2, 16);
    this.darkMat = std2(0x3a1c0e, 0.4);
    this.ballGeo = new THREE.SphereGeometry(0.42, 28, 20);
    this.ballMat = std2(0x4e2813, 0.18, { metalness: 0.12, emissive: 0x1a0a04, emissiveIntensity: 0.25 });
    this.stripeGeo = new THREE.BoxGeometry(0.9, 0.03, 0.09);
    this.ringGeo = new THREE.TorusGeometry(0.5, 0.06, 8, 24);
    this.shineGeo = new THREE.SphereGeometry(0.07, 8, 6);
    this.shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 });
  }

  _makePieceMesh(type, sp, gum) {
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    if (gum) {
      const m = new THREE.Mesh(roundedBox(0.92, 0.62, 0.92, 0.14, 0.04), this.gumMat);
      m.position.y = 0.33;
      m.castShadow = true;
      body.add(m);
      for (const z of [-0.2, 0.2]) {
        const line = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.03, 0.05), std2(0xfff6e6));
        line.position.set(0, 0.65, z);
        body.add(line);
      }
      const lg = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), new THREE.MeshBasicMaterial({ map: this.gumLogo || (this.gumLogo = loadTexture("assets/brand/logo-badge.png")), transparent: true }));
      lg.rotation.x = -Math.PI / 2;
      lg.position.set(0, 0.645, 0.02);
      lg.rotation.z = 0;
      body.add(lg);
      root.userData.body = body;
      return root;
    }
    if (sp === "bomb") {
      // bomba dorada de Matichoc: la pieza de 5 en línea
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.46, 26, 18), new THREE.MeshStandardMaterial({ color: 0xffd04a, roughness: 0.2, metalness: 0.6, emissive: 0x8a5a00, emissiveIntensity: 0.5 }));
      m.position.y = 0.36;
      m.castShadow = true;
      body.add(m);
      const cols = [0xff4a8a, 0xffc800, 0x2fd08a, 0xff7a1a, 0xffffff, 0x9a5cff];
      cols.forEach((c, i) => {
        const a = (i / cols.length) * Math.PI * 2;
        const sp2 = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), new THREE.MeshBasicMaterial({ color: c }));
        sp2.position.set(Math.cos(a) * 0.5, 0.36 + Math.sin(a * 2) * 0.18, Math.sin(a) * 0.5);
        body.add(sp2);
      });
      root.userData.body = body;
      root.userData.spin = true;
      return root;
    }
    // piezas hechas a mano (sin fotos): alfajor de dos galletas con relleno y glaseado, bomba de chocolate con hilos de oro y cuchuflí
    const shape = TYPES[type].shape;
    const flavor = TYPES[type].color;
    const core = new THREE.Group();
    body.add(core);
    const mk = (geo, mat, x, y, z) => { const mm = new THREE.Mesh(geo, mat); mm.position.set(x, y, z); mm.castShadow = true; core.add(mm); return mm; };
    if (shape === "disc") {
      mk(this.cookieGeo, this.cookie, 0, 0.07, 0);
      mk(this.fillGeo, this.mats[type], 0, 0.22, 0);
      mk(this.cookieGeo, this.cookie, 0, 0.37, 0);
      const glaze = mk(this.glazeGeo, this.glazes[type], 0, 0.435, 0);
      glaze.castShadow = false;
      const lg = makeLogo(0.4);
      lg.rotation.x = -Math.PI / 2;
      lg.position.set(0, 0.465, 0);
      core.add(lg);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.3;
        mk(this.dotGeo, this.accents[type], Math.cos(a) * 0.3, 0.47, Math.sin(a) * 0.3);
      }
    } else if (shape === "tube") {
      core.position.y = 0.27;
      core.rotation.y = 0.5;
      const w = mk(this.wafer, this.waferMat, 0, 0, 0);
      w.rotation.z = Math.PI / 2;
      for (let i = 0; i < 5; i++) {
        const r = mk(this.stripeRing, i % 2 ? this.yellowMat : this.redMat, -0.3 + i * 0.15, 0, 0);
        r.rotation.y = Math.PI / 2;
      }
      for (const sx of [-1, 1]) {
        const c = mk(this.capGeo, this.darkMat, sx * 0.43, 0, 0);
        c.rotation.y = sx * Math.PI / 2;
      }
    } else {
      core.position.y = 0.42;
      mk(this.ballGeo, this.ballMat, 0, 0, 0);
      for (const k of [-1, 0, 1]) {
        const rr = Math.sqrt(0.42 * 0.42 - (k * 0.2) ** 2);
        const t = mk(new THREE.TorusGeometry(rr + 0.004, 0.017, 6, 28), this.gold, 0, k * 0.2 + 0.02 * k, 0);
        t.rotation.x = Math.PI / 2;
        t.castShadow = false;
      }
      mk(this.shineGeo, this.shineMat, -0.17, 0.2, 0.2).castShadow = false;
    }
    if (sp === "h" || sp === "v") {
      for (const o of [-0.16, 0.16]) {
        const st = new THREE.Mesh(this.stripeGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
        st.position.set(sp === "h" ? 0 : o, 0.63, sp === "h" ? o : 0);
        if (sp === "v") st.rotation.y = Math.PI / 2;
        body.add(st);
      }
      core.scale.set(1, 1.2, 1);
    } else if (sp === "wrap") {
      const ring = new THREE.Mesh(this.ringGeo, this.gold);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.3;
      body.add(ring);
      const ring2 = new THREE.Mesh(this.ringGeo, this.gold);
      ring2.rotation.set(0, 0, Math.PI / 2);
      ring2.position.y = 0.3;
      body.add(ring2);
    }
    root.userData.body = body;
    return root;
    function std2(c) { return new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 }); }
  }

  _newPiece(r, c, type, sp = null, gum = false, fromAbove = 0) {
    const mesh = this._makePieceMesh(type, sp, gum);
    const p = { type: gum ? -1 : sp === "bomb" ? -2 : type, sp, gum, mesh, r, c, x: worldX(c), z: worldZ(r), y: fromAbove, scale: 1, pop: -1, grow: sp ? 0.001 : 1 };
    mesh.position.set(p.x, p.y, p.z);
    this.scene.add(mesh);
    this.pieces.add(p);
    return p;
  }

  _removePiece(p) {
    this.scene.remove(p.mesh);
    this.pieces.delete(p);
  }

  // ---------- partida ----------

  reset() {
    for (const p of this.pieces) this.scene.remove(p.mesh);
    this.pieces.clear();
    const c = campaign(this.progress, GAME_ID);
    this.level = Math.min(c.selected || c.unlocked, c.unlocked);
    this.spec = levelSpec(this.level);
    this.missionId = GAME_ID;
    this.moves = this.spec.moves;
    this.score = 0;
    this.combo = 0;
    this.collected = new Array(NTYPES).fill(0);
    this.gumCleared = 0;
    this.moveCount = 0;
    this.selected = null;
    this.drag = null;
    this.idle = 0;
    this.hintMove = null;
    this.phase = "input";
    this.phaseT = 0;
    this.bestCombo = 0;
    this.specialsMade = 0;
    this.bossHp = this.spec.kind === "boss" ? this.spec.hp : 0;
    this.weak = 0;
    this._buildBoss();
    this._fit();
    this._fillBoard();
    if (this.spec.kind === "gum") this._addGum(this.spec.gum);
    this.gumTotal = this.spec.kind === "gum" ? this.spec.gum : 0;
    this._updateHud();
  }

  _fillBoard() {
    this.g = Array.from({ length: ROWS }, () => new Array(COLS).fill(null));
    for (let guard = 0; guard < 60; guard++) {
      for (const p of [...this.pieces]) this._removePiece(p);
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        let t;
        let tries = 0;
        do {
          t = Math.floor(Math.random() * NTYPES);
          tries++;
        } while (tries < 20 && ((c >= 2 && this.g[r][c - 1] && this.g[r][c - 2] && this.g[r][c - 1].type === t && this.g[r][c - 2].type === t) || (r >= 2 && this.g[r - 1][c] && this.g[r - 2][c] && this.g[r - 1][c].type === t && this.g[r - 2][c].type === t)));
        const p = this._newPiece(r, c, t);
        this.g[r][c] = p;
      }
      if (this._hasMove()) break;
    }
    // las piezas "caen" al empezar
    for (const p of this.pieces) p.y = 3 + p.r * 0.4;
  }

  _addGum(n) {
    const cells = [];
    for (let r = 1; r < ROWS; r++) for (let c = 0; c < COLS; c++) cells.push([r, c]);
    for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
    for (const [r, c] of cells.slice(0, n)) this._makeGum(r, c);
  }

  _makeGum(r, c) {
    const old = this.g[r][c];
    if (!old || old.gum) return false;
    this._removePiece(old);
    const p = this._newPiece(r, c, -1, null, true);
    p.grow = 0.3;
    this.g[r][c] = p;
    return true;
  }

  // ---------- jefe ----------

  _buildBoss() {
    if (this.boss) { this.scene.remove(this.boss.group); this.boss = null; }
    const bar = this.q("boss");
    if (this.spec.kind !== "boss") { if (bar) bar.classList.add("hidden"); return; }
    const info = BOSSES[this.spec.boss];
    const grp = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: info.color, roughness: 0.45 });
    const body = new THREE.Group();
    grp.add(body);
    const k = this.spec.boss;
    let head;
    if (k === 0) { head = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 3.2, 24), mat); head.position.y = 1.7; }
    else if (k === 1) { head = new THREE.Mesh(new THREE.ConeGeometry(1.7, 3.6, 24), mat); head.position.y = 1.9; head.rotation.z = 0.04; }
    else if (k === 2) { head = new THREE.Mesh(new THREE.SphereGeometry(1.7, 28, 20), mat); head.position.y = 1.9; }
    else { head = new THREE.Mesh(new THREE.SphereGeometry(1.7, 28, 20), mat); head.position.y = 1.9; head.scale.set(1.2, 1, 1); }
    head.castShadow = true;
    body.add(head);
    const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1c0f07, roughness: 0.4 });
    const fy = 2.1;
    for (const sx of [-0.62, 0.62]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 12), white);
      eye.position.set(sx, fy, 1.38);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10), dark);
      pupil.position.set(sx * 0.9, fy - 0.02, 1.7);
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.12), dark);
      brow.position.set(sx, fy + 0.5, 1.5);
      brow.rotation.z = -Math.sign(sx) * 0.4;
      body.add(eye, pupil, brow);
    }
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.35, 0.2), dark);
    mouth.position.set(0, 1.15, 1.55);
    body.add(mouth);
    for (const x of [-0.35, 0, 0.35]) {
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.1), white);
      tooth.position.set(x, 1.25, 1.62);
      body.add(tooth);
    }
    if (k === 1) { // glaseado rosa
      const top = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.28, 10, 20), new THREE.MeshStandardMaterial({ color: 0xfff6e6, roughness: 0.4 }));
      top.rotation.x = Math.PI / 2; top.position.y = 3.7;
      body.add(top);
    } else if (k === 2) { // corona
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.1, 0.7, 7), this.gold);
      crown.position.y = 3.7;
      body.add(crown);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.5, 6), this.gold);
        tip.position.set(Math.cos(a) * 1.0, 4.2, Math.sin(a) * 1.0);
        body.add(tip);
      }
    } else if (k === 3) { // cuernos y alas
      for (const sx of [-1, 1]) {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.3, 10), new THREE.MeshStandardMaterial({ color: 0xfff6e6 }));
        horn.position.set(sx * 1.1, 3.4, 0);
        horn.rotation.z = -sx * 0.4;
        const wing = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.2, 1.6), new THREE.MeshStandardMaterial({ color: 0x7a3f22 }));
        wing.position.set(sx * 2.6, 2.4, -0.3);
        wing.rotation.z = sx * 0.5;
        body.add(horn, wing);
      }
    }
    grp.position.set(0, 0, -6.4);
    grp.scale.setScalar(0.6);
    grp.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.scene.add(grp);
    this.boss = { group: grp, body, mat, info, hitT: 0, atkT: 0, deadT: -1, baseColor: new THREE.Color(info.color), scale: 0.6, z: -6.4 };
    if (bar) {
      bar.classList.remove("hidden");
      const nm = this.q("boss-name");
      if (nm) nm.textContent = info.name;
    }
    this._bossWeak();
  }

  _bossWeak() {
    this.weak = Math.floor(Math.random() * NTYPES);
    const w = this.q("boss-weak");
    if (w) w.textContent = `Le duele: ${TYPES[this.weak].icon} ${TYPES[this.weak].short}`;
  }

  _hurtBoss(n) {
    if (!this.boss || this.bossHp <= 0) return;
    this.bossHp = Math.max(0, this.bossHp - n);
    this.boss.hitT = 0.4;
    audio.playHitEnemy();
    this._updateHud();
  }

  // ---------- entrada ----------

  async init() {
    const first = !this.ready;
    await super.init();
    if (first) this._bindInput();
  }

  _cellAt(e) {
    const r = this.els.canvas.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.plane, hit)) return null;
    const c = Math.round(hit.x / CELL + (COLS - 1) / 2);
    const rr = Math.round(hit.z / CELL + (ROWS - 1) / 2);
    if (c < 0 || c >= COLS || rr < 0 || rr >= ROWS) return null;
    return { r: rr, c, hx: hit.x, hz: hit.z };
  }

  _bindInput() {
    const wrap = this.els.wrap;
    wrap.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button, .overlay") || this.state !== "playing" || this.phase !== "input") return;
      const cell = this._cellAt(e);
      if (!cell) return;
      this.idle = 0;
      this.hintMove = null;
      // si ya había una elegida y esta es vecina: intercambiar
      if (this.selected && Math.abs(this.selected.r - cell.r) + Math.abs(this.selected.c - cell.c) === 1) {
        const a = this.selected;
        this.selected = null;
        this._trySwap(a.r, a.c, cell.r, cell.c);
        this.drag = null;
        return;
      }
      this.selected = { r: cell.r, c: cell.c };
      this.drag = { id: e.pointerId, x: cell.hx, z: cell.hz, r: cell.r, c: cell.c };
      wrap.setPointerCapture?.(e.pointerId);
      audio.playPop();
    });
    wrap.addEventListener("pointermove", (e) => {
      if (!this.drag || e.pointerId !== this.drag.id || this.phase !== "input") return;
      const cell = this._cellAt(e);
      if (!cell) return;
      const dx = cell.hx - this.drag.x;
      const dz = cell.hz - this.drag.z;
      if (Math.max(Math.abs(dx), Math.abs(dz)) < CELL * 0.45) return;
      let r2 = this.drag.r;
      let c2 = this.drag.c;
      if (Math.abs(dx) > Math.abs(dz)) c2 += Math.sign(dx);
      else r2 += Math.sign(dz);
      const a = { r: this.drag.r, c: this.drag.c };
      this.drag = null;
      this.selected = null;
      this._trySwap(a.r, a.c, r2, c2);
    });
    const end = (e) => { if (this.drag && e.pointerId === this.drag.id) this.drag = null; };
    wrap.addEventListener("pointerup", end);
    wrap.addEventListener("pointercancel", end);
  }

  // ---------- lógica de piezas ----------

  _typeAt(grid, r, c) {
    const p = grid[r] && grid[r][c];
    return p ? p.type : null;
  }

  /** Corridas de 3+ iguales (horizontales y verticales). */
  _runs() {
    const runs = [];
    for (let r = 0; r < ROWS; r++) {
      let c = 0;
      while (c < COLS) {
        const t = this._typeAt(this.g, r, c);
        let e = c + 1;
        while (t !== null && t >= 0 && e < COLS && this._typeAt(this.g, r, e) === t) e++;
        if (t !== null && t >= 0 && e - c >= 3) runs.push({ dir: "h", t, cells: Array.from({ length: e - c }, (_, i) => [r, c + i]) });
        c = e;
      }
    }
    for (let c = 0; c < COLS; c++) {
      let r = 0;
      while (r < ROWS) {
        const t = this._typeAt(this.g, r, c);
        let e = r + 1;
        while (t !== null && t >= 0 && e < ROWS && this._typeAt(this.g, e, c) === t) e++;
        if (t !== null && t >= 0 && e - r >= 3) runs.push({ dir: "v", t, cells: Array.from({ length: e - r }, (_, i) => [r + i, c]) });
        r = e;
      }
    }
    return runs;
  }

  /** ¿Hay alguna jugada posible? (también cuenta intercambiar una pieza especial) */
  _hasMove() { return !!this._findMove(); }

  _findMove() {
    const dirs = [[0, 1], [1, 0]];
    const moves = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      for (const [dr, dc] of dirs) {
        const r2 = r + dr;
        const c2 = c + dc;
        if (r2 >= ROWS || c2 >= COLS) continue;
        const a = this.g[r][c];
        const b = this.g[r2][c2];
        if (!a || !b || a.gum || b.gum) continue;
        if (a.sp || b.sp) { moves.push([r, c, r2, c2]); continue; }
        this.g[r][c] = b; this.g[r2][c2] = a;
        const ok = this._runs().length > 0;
        this.g[r][c] = a; this.g[r2][c2] = b;
        if (ok) moves.push([r, c, r2, c2]);
      }
    }
    return moves.length ? moves[Math.floor(Math.random() * moves.length)] : null;
  }

  _trySwap(r1, c1, r2, c2) {
    if (this.phase !== "input" || this.state !== "playing") return false;
    if (r2 < 0 || r2 >= ROWS || c2 < 0 || c2 >= COLS) return false;
    const a = this.g[r1][c1];
    const b = this.g[r2][c2];
    if (!a || !b) return false;
    if (a.gum || b.gum) { this.shake = 0.15; audio.playBump(); return false; }
    this.g[r1][c1] = b; this.g[r2][c2] = a;
    a.r = r2; a.c = c2; b.r = r1; b.c = c1;
    this.swapInfo = { a, b, from: [r1, c1], to: [r2, c2] };
    const valid = !!(a.sp || b.sp) || this._runs().length > 0;
    this.phase = "swap";
    this.phaseT = SWAP_T;
    this.swapValid = valid;
    audio.playWhoosh();
    return true;
  }

  _afterSwap() {
    const { a, b, from, to } = this.swapInfo;
    if (!this.swapValid) {
      // jugada inválida: vuelven a su lugar
      this.g[from[0]][from[1]] = a; this.g[to[0]][to[1]] = b;
      a.r = from[0]; a.c = from[1]; b.r = to[0]; b.c = to[1];
      this.phase = "swapback";
      this.phaseT = SWAP_T;
      audio.playBump();
      return;
    }
    this.moves--;
    this.moveCount++;
    this.combo = 0;
    // piezas especiales intercambiadas se activan solas
    this.forced = new Set();
    for (const [p, other] of [[a, b], [b, a]]) {
      if (p.sp) this.forced.add(p), p.other = other;
    }
    this._resolve();
  }

  /** Busca qué se limpia ahora (matches + especiales) y empieza la animación de "pop". */
  _resolve() {
    const runs = this._runs();
    const clear = new Set();
    const create = [];
    const lastMoved = this.swapInfo ? [this.swapInfo.a, this.swapInfo.b] : [];
    const inH = new Set();
    const inV = new Set();
    for (const run of runs) for (const [r, c] of run.cells) (run.dir === "h" ? inH : inV).add(key(r, c));
    for (const run of runs) {
      for (const [r, c] of run.cells) clear.add(this.g[r][c]);
      if (run.cells.length >= 5) {
        const pick = this._pickCell(run, lastMoved);
        create.push({ r: pick[0], c: pick[1], sp: "bomb", t: run.t });
      } else if (run.cells.length === 4) {
        const pick = this._pickCell(run, lastMoved);
        create.push({ r: pick[0], c: pick[1], sp: run.dir === "h" ? "h" : "v", t: run.t });
      }
    }
    for (const k of inH) if (inV.has(k)) {
      const r = Math.floor(k / COLS);
      const c = k % COLS;
      create.push({ r, c, sp: "wrap", t: this.g[r][c].type });
    }
    // especiales forzados por el intercambio (se activan aunque no haya 3 en línea)
    const trig = [];
    for (const p of clear) if (p.sp) trig.push(p);
    for (const p of this.forced || []) { if (!clear.has(p)) clear.add(p); trig.push(p); }
    this.forced = null;
    // expandir efectos de las piezas especiales (en cadena)
    const done = new Set();
    while (trig.length) {
      const p = trig.pop();
      if (done.has(p)) continue;
      done.add(p);
      const add = (r, c) => { const q = this.g[r] && this.g[r][c]; if (q && !clear.has(q)) { clear.add(q); if (q.sp) trig.push(q); } else if (q && q.sp && !done.has(q)) trig.push(q); };
      if (p.sp === "h") for (let c = 0; c < COLS; c++) add(p.r, c);
      else if (p.sp === "v") for (let r = 0; r < ROWS; r++) add(r, p.c);
      else if (p.sp === "wrap") for (let r = p.r - 1; r <= p.r + 1; r++) for (let c = p.c - 1; c <= p.c + 1; c++) add(r, c);
      else if (p.sp === "bomb") {
        const o = p.other && p.other.type >= 0 ? p.other.type : this._commonType();
        for (const q of this.pieces) if (q.type === o && !q.sp) { clear.add(q); } else if (q.type === o && q.sp && !clear.has(q)) { clear.add(q); trig.push(q); }
      }
      if (p.other) p.other = null;
    }
    // las coberturas pegadas a algo que se limpia también se van
    for (const p of [...clear]) {
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const q = this.g[p.r + dr] && this.g[p.r + dr][p.c + dc];
        if (q && q.gum) clear.add(q);
      }
    }
    // las piezas que se vuelven especiales no se limpian
    const keepAt = new Set(create.map((x) => key(x.r, x.c)));
    for (const x of create) { const q = this.g[x.r][x.c]; if (q) clear.delete(q); }
    if (!clear.size && !create.length) { this._endTurn(); return; }
    this.combo++;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    const mult = 1 + (this.combo - 1) * 0.5;
    let pts = 0;
    let dmg = 0;
    let gums = 0;
    for (const p of clear) {
      if (p.gum) { gums++; pts += 20; continue; }
      pts += 10;
      dmg += p.type === this.weak && this.spec.kind === "boss" ? 2 : 1;
      if (p.type >= 0) this.collected[p.type]++;
      p.pop = POP_T;
      this.particles.burst(new THREE.Vector3(worldX(p.c), 0.5, worldZ(p.r)), [p.type >= 0 ? TYPES[p.type].color : 0xffc800, 0xffffff], 6, 3, 0.5, 4);
    }
    for (const p of clear) if (p.gum) { p.pop = POP_T; this.particles.burst(new THREE.Vector3(worldX(p.c), 0.5, worldZ(p.r)), [0x3a1c0e, 0x7a3f22], 8, 3, 0.5, 4); }
    this.gumCleared += gums;
    for (const x of create) { pts += 40; this.specialsMade++; }
    pts = Math.round(pts * mult);
    this.score += pts;
    if (this.spec.kind === "boss") this._hurtBoss(Math.round(dmg * mult) + create.length * 3);
    const mid = [...clear][0] || this.g[create[0].r][create[0].c];
    this.popups.add(new THREE.Vector3(worldX(mid.c), 1.2, worldZ(mid.r)), this.combo > 1 ? `x${this.combo}  +${pts}` : `+${pts}`, "combo");
    if (this.combo >= 2) { this.banner(["", "", "¡Cadena!", "¡Súper!", "¡Increíble!", "¡Deliciosos!"][Math.min(5, this.combo)]); audio.playCombo(this.combo); }
    else audio.playCollect();
    if (create.length) audio.playPowerup();
    this.pendingCreate = create;
    this.clearing = clear;
    this.phase = "pop";
    this.phaseT = POP_T;
    this._updateHud();
  }

  _commonType() {
    const count = new Array(NTYPES).fill(0);
    for (const p of this.pieces) if (p.type >= 0) count[p.type]++;
    return count.indexOf(Math.max(...count));
  }

  _pickCell(run, lastMoved) {
    for (const p of lastMoved) for (const [r, c] of run.cells) if (p && p.r === r && p.c === c) return [r, c];
    return run.cells[Math.floor(run.cells.length / 2)];
  }

  _afterPop() {
    for (const p of this.clearing) {
      this.g[p.r][p.c] = null;
      this._removePiece(p);
    }
    this.clearing = null;
    // piezas especiales nuevas
    for (const x of this.pendingCreate || []) {
      const old = this.g[x.r][x.c];
      if (old) this._removePiece(old);
      const np = this._newPiece(x.r, x.c, x.t >= 0 ? x.t : 0, x.sp);
      this.g[x.r][x.c] = np;
    }
    this.pendingCreate = null;
    this._gravity();
    this.phase = "fall";
    this.phaseT = 0.15;
  }

  _gravity() {
    for (let c = 0; c < COLS; c++) {
      let write = ROWS - 1;
      for (let r = ROWS - 1; r >= 0; r--) {
        const p = this.g[r][c];
        if (p) {
          if (write !== r) { this.g[write][c] = p; this.g[r][c] = null; p.r = write; }
          write--;
        }
      }
      let drop = 0;
      for (let r = write; r >= 0; r--) {
        drop++;
        const p = this._newPiece(r, c, Math.floor(Math.random() * NTYPES), null, false, 0);
        p.y = 0.6 + drop * CELL * 1.1 + (ROWS - 1 - r) * 0.2;
        p.mesh.position.y = p.y;
        this.g[r][c] = p;
      }
    }
  }

  _settled() {
    for (const p of this.pieces) {
      if (Math.abs(p.x - worldX(p.c)) > 0.02 || Math.abs(p.z - worldZ(p.r)) > 0.02 || Math.abs(p.y) > 0.02 || p.pop >= 0) return false;
    }
    return true;
  }

  _endTurn() {
    this.swapInfo = null;
    this.phase = "input";
    this.idle = 0;
    // ¿se cumplió el objetivo?
    const sp = this.spec;
    let won = false;
    if (sp.kind === "score") won = this.score >= sp.target;
    else if (sp.kind === "collect") won = this.collected[sp.color] >= sp.n;
    else if (sp.kind === "gum") won = this.gumCleared >= this.gumTotal;
    else if (sp.kind === "boss") won = this.bossHp <= 0;
    if (won) { this._win(); return; }
    if (this.moves <= 0) { this._lose(); return; }
    // el jefe contraataca y cambia su punto débil
    if (sp.kind === "boss" && this.moveCount > 0 && this.moveCount % sp.atk === 0 && !this._bossActed) {
      this._bossActed = true;
      this.boss.atkT = 1;
      this.banner(`¡${BOSSES[sp.boss].name} te lanza coberturas de chocolate!`);
      this._bossWeak();
      const free = [];
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { const p = this.g[r][c]; if (p && !p.gum && !p.sp) free.push([r, c]); }
      for (let i = 0; i < sp.gum && free.length; i++) { const [r, c] = free.splice(Math.floor(Math.random() * free.length), 1)[0]; this._makeGum(r, c); }
      audio.playHurt();
      this.shake = 0.3;
      this.phase = "fall";
      this.phaseT = 0.6;
      return;
    }
    this._bossActed = false;
    // sin jugadas: se mezclan las piezas
    if (!this._hasMove()) { this._shuffle(); }
    this._updateHud();
  }

  _shuffle() {
    this.banner("¡Sin jugadas! Mezclando…");
    const movable = [...this.pieces].filter((p) => !p.gum && !p.sp);
    for (let guard = 0; guard < 60; guard++) {
      const types = movable.map((p) => p.type);
      for (let i = types.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [types[i], types[j]] = [types[j], types[i]]; }
      movable.forEach((p, i) => { p.type = types[i]; });
      if (this._runs().length === 0 && this._hasMove()) break;
    }
    // las mallas se rehacen con el nuevo tipo
    for (const p of movable) {
      const m = this._makePieceMesh(p.type, null, false);
      m.position.set(p.x, p.y, p.z);
      this.scene.remove(p.mesh);
      this.scene.add(m);
      p.mesh = m;
    }
  }

  _win() {
    this.phase = "done";
    this.sel.visible = false;
    const sp = this.spec;
    const left = this.moves / sp.moves;
    const stars = left >= 0.45 ? 3 : left >= 0.2 ? 2 : 1;
    const txt = `¡Objetivo cumplido con ${this.moves} movimiento${this.moves === 1 ? "" : "s"} de sobra! Puntaje: ${this.score}.`;
    this.runInfo = { level: this.level, kind: sp.kind, stars, bestCombo: this.bestCombo, specials: this.specialsMade, boss: sp.kind === "boss" ? 1 : 0 };
    if (sp.kind === "boss" && this.boss) { this.boss.deadT = 0; this.banner(`¡Derrotaste a ${BOSSES[sp.boss].name}!`); }
    this.score += this.moves * 60; // bonus por movimientos que sobran
    setTimeout(() => {
      if (this.state !== "playing") return;
      if (this.level >= LEVELS_PER_GAME) {
        campaignWin(this.progress, GAME_ID, this.level, stars);
        const t = this.els.q("gameover-title");
        if (t) t.textContent = `¡Completaste los ${LEVELS_PER_GAME} niveles! 🏆`;
        audio.playVictory();
        this.finish(txt);
      } else this.levelWin({ level: this.level, stars, text: txt, title: sp.kind === "boss" ? `¡Jefe derrotado!` : `¡Nivel ${this.level} superado!` });
    }, sp.kind === "boss" ? 1400 : 500);
  }

  _lose() {
    this.phase = "done";
    this.sel.visible = false;
    const sp = this.spec;
    this.runInfo = { level: this.level, kind: sp.kind, lost: 1 };
    const goal = sp.kind === "score" ? `Llevas ${this.score} de ${sp.target} puntos.` : sp.kind === "collect" ? `Juntaste ${this.collected[sp.color]} de ${sp.n} ${TYPES[sp.color].short}.` : sp.kind === "gum" ? `Quedan ${this.gumTotal - this.gumCleared} coberturas.` : `Al jefe le quedan ${this.bossHp} de vida.`;
    setTimeout(() => {
      if (this.state !== "playing") return;
      audio.playLose();
      const t = this.els.q("gameover-title");
      if (t) t.textContent = "¡Se acabaron los movimientos!";
      this.finish(`${goal} ¡Inténtalo otra vez!`);
    }, 500);
  }

  nextLevel() {
    campaign(this.progress, GAME_ID).selected = Math.min(LEVELS_PER_GAME, this.level + 1);
    this.particles.clear();
    this.popups.clear();
    this.state = "intro";
    this.reset();
    this.beginPlaying();
  }

  onIntro() {
    const c = campaign(this.progress, GAME_ID);
    c.selected = Math.min(c.selected || c.unlocked, c.unlocked);
    renderLevelPicker(this.q("lvlpick"), { id: GAME_ID, progress: this.progress, selected: c.selected, onSelect: (n) => { c.selected = n; saveProgress(this.progress); this.reset(); this._intro(); } });
    this._intro();
  }

  _intro() {
    const t = this.q("intro-text");
    if (t) t.textContent = `Nivel ${this.level}: ${this._goalText()} Tienes ${this.spec.moves} movimientos.`;
  }

  _goalText() {
    const sp = this.spec;
    if (sp.kind === "score") return `llega a ${sp.target} puntos.`;
    if (sp.kind === "collect") return `junta ${sp.n} ${TYPES[sp.color].icon} ${TYPES[sp.color].short}.`;
    if (sp.kind === "gum") return `rompe las ${sp.gum} coberturas de chocolate duro (se rompen si limpias piezas al lado).`;
    return `¡derrota a ${sp.name}! Cada pieza que juntas le baja la vida.`;
  }

  // ---------- bucle ----------

  onResize() { this._fit(); }

  _fit() {
    if (!this.camera) return;
    // que el tablero entre completo a lo ancho y a lo alto
    const aspect = this.camera.aspect;
    const vf = (this.camera.fov * Math.PI) / 180;
    const boss = this.spec && this.spec.kind === "boss";
    const needH = (ROWS * CELL * 0.82 + (boss ? 5.2 : 1.5)) / 2;
    const needW = (COLS * CELL + 1.0) / 2 / aspect;
    const half = Math.max(needH, needW);
    const dist = half / Math.tan(vf / 2);
    const tilt = 0.72; // radianes desde la vertical (se ve desde arriba y un poco de frente)
    this.camBase = new THREE.Vector3(0, Math.cos(tilt) * dist, Math.sin(tilt) * dist + 0.4);
    this.camera.position.copy(this.camBase);
    this.camLook = new THREE.Vector3(0, 0, boss ? -1.5 : -0.6);
    this.camera.lookAt(this.camLook);
  }

  update(dt) {
    // intercambio, pops y caídas
    if (this.phase === "swap" || this.phase === "swapback") {
      this.phaseT -= dt;
      if (this.phaseT <= 0) {
        if (this.phase === "swap") this._afterSwap();
        else { this.phase = "input"; }
      }
    } else if (this.phase === "pop") {
      this.phaseT -= dt;
      if (this.phaseT <= 0) this._afterPop();
    } else if (this.phase === "fall") {
      this.phaseT -= dt;
      if (this.phaseT <= 0 && this._settled()) this._resolve_or_end();
    }
    this._animatePieces(dt);
    this._updateBoss(dt);
    // pista si el jugador se queda quieto
    if (this.state === "playing" && this.phase === "input") {
      this.idle += dt;
      if (this.idle > 6 && !this.hintMove) this.hintMove = this._findMove();
    }
    const hm = this.hintMove;
    if (hm && this.phase === "input") {
      for (const [r, c] of [[hm[0], hm[1]], [hm[2], hm[3]]]) {
        const p = this.g[r][c];
        if (p) p.mesh.position.y = Math.abs(Math.sin(this.time * 6)) * 0.22;
      }
    }
    if (this.selected && this.phase === "input" && this.state === "playing") {
      this.sel.visible = true;
      this.sel.position.set(worldX(this.selected.c), 0.2, worldZ(this.selected.r));
      this.sel.scale.setScalar(1 + Math.sin(this.time * 8) * 0.06);
    } else this.sel.visible = false;
    // cámara con un temblor suave
    if (this.camBase) {
      const sh = this.shake > 0 ? this.shake : 0;
      this.camera.position.set(this.camBase.x + (sh ? rand(-sh, sh) * 0.4 : 0), this.camBase.y + (sh ? rand(-sh, sh) * 0.4 : 0), this.camBase.z);
      this.camera.lookAt(this.camLook);
      this.shake = Math.max(0, this.shake - dt * 1.5);
    }
  }

  _resolve_or_end() {
    // después de caer: ¿hay más combinaciones (cadena)?
    if (this._runs().length) { this._resolve(); } else this._endTurn();
  }

  _animatePieces(dt) {
    const k = 1 - Math.exp(-16 * dt);
    for (const p of this.pieces) {
      p.x = lerp(p.x, worldX(p.c), k);
      p.z = lerp(p.z, worldZ(p.r), k);
      // caída: sube/baja con aceleración suave
      if (p.y > 0.001) p.y = Math.max(0, p.y - (4 + p.y * 9) * dt);
      else p.y = 0;
      if (p.pop >= 0) {
        p.pop -= dt;
        p.scale = Math.max(0, p.pop / POP_T);
        if (p.pop < 0) p.scale = 0;
      }
      if (p.grow < 1) p.grow = Math.min(1, p.grow + dt * 4);
      const m = p.mesh;
      if (!(this.hintMove && this.phase === "input")) m.position.set(p.x, p.y, p.z);
      else m.position.set(p.x, p.y > 0.001 ? p.y : m.position.y, p.z);
      const sc = p.scale * (p.sp ? 0.7 + 0.3 * p.grow : 1) * (p.gum ? p.grow : 1);
      m.scale.setScalar(Math.max(0.001, sc));
      // vida: respira suave, se aplasta al caer y salta contenta cuando la eligen
      if (p.y > 0.05) p.fell = true;
      else if (p.fell) { p.fell = false; p.sq = 0.28; }
      let sq = 0;
      if (p.sq > 0) { p.sq -= dt; sq = 0.2 * Math.sin((Math.max(0, p.sq) / 0.28) * Math.PI); }
      const idle = p.pop < 0 && !p.gum ? Math.sin(this.time * 2.6 + p.r * 1.3 + p.c * 0.7) : 0;
      const sel = this.selected && this.selected.r === p.r && this.selected.c === p.c ? Math.abs(Math.sin(this.time * 9)) * 0.18 : 0;
      const bd = m.userData.body;
      bd.scale.set(1 + sq - idle * 0.025, 1 - sq + idle * 0.035 + sel * 0.3, 1 + sq - idle * 0.025);
      bd.position.y = sel * 0.6 + Math.max(0, idle) * 0.02;
      if (p.sp) m.userData.body.rotation.y += dt * (p.sp === "bomb" ? 2.2 : 1.1);
      else if (p.pop < 0) m.userData.body.rotation.y = Math.sin(this.time * 1.5 + p.r + p.c) * 0.15;
      if (p.pop >= 0) m.userData.body.rotation.y += dt * 9;
    }
  }

  _updateBoss(dt) {
    const b = this.boss;
    if (!b) return;
    const g = b.group;
    b.hitT = Math.max(0, b.hitT - dt);
    b.atkT = Math.max(0, b.atkT - dt);
    if (b.deadT >= 0) {
      b.deadT += dt;
      g.rotation.y += dt * 9;
      g.scale.setScalar(Math.max(0.001, b.scale * (1 - b.deadT / 1.3)));
      return;
    }
    g.position.y = Math.abs(Math.sin(this.time * 2.2)) * 0.25;
    g.rotation.z = b.hitT > 0 ? Math.sin(this.time * 50) * 0.12 : Math.sin(this.time * 1.4) * 0.03;
    g.position.z = b.z + (b.atkT > 0 ? Math.sin(Math.min(1, 1 - b.atkT) * Math.PI) * 2.2 : 0);
    b.mat.emissive.setHex(b.hitT > 0 ? 0xff2a2a : 0x000000);
    b.mat.emissiveIntensity = b.hitT > 0 ? 0.8 : 0;
  }

  // ---------- pantalla ----------

  _updateHud() {
    const set = (id, v) => { const el = this.q(id); if (el) el.textContent = v; };
    set("hud-moves", this.moves);
    set("hud-score", this.score);
    set("hud-coins", this.progress.coins);
    const sp = this.spec;
    if (sp) {
      let goal = "";
      if (sp.kind === "score") goal = `${Math.min(this.score, sp.target)}/${sp.target}`;
      else if (sp.kind === "collect") goal = `${TYPES[sp.color].icon} ${Math.min(this.collected[sp.color], sp.n)}/${sp.n}`;
      else if (sp.kind === "gum") goal = `🍫 ${this.gumCleared}/${this.gumTotal}`;
      else goal = `👹 ${this.bossHp}`;
      set("hud-goal", goal);
      set("hud-level", `Nivel ${this.level}`);
      const fill = this.q("boss-fill");
      if (fill && sp.kind === "boss") fill.style.width = `${Math.round((this.bossHp / sp.hp) * 100)}%`;
    }
  }

  onBegin() {
    this._updateHud();
    if (this.spec.kind === "boss") this.banner(`¡Jefe: ${this.spec.name}!`);
    else this.banner(this._goalText());
  }

  pauseForMenu() {
    this.drag = null;
    this.selected = null;
    super.pauseForMenu();
  }

  /** Para pruebas automáticas: hace una jugada válida al azar. */
  autoMove() {
    const m = this._findMove();
    if (!m) return false;
    return this._trySwap(...m);
  }
}
