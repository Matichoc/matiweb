// Autos de Chocolate 3D: carrera infinita por la ruta de Matichoc.
// Tres carriles, curvas suaves, banderines y letreros de la marca, alfajores de
// verdad como monedas y el nitro Matidubai. Tu Matichico maneja un auto hecho
// de barra de chocolate. El día pasa de mañana a noche mientras avanzas.
//
// Gran Premio: autos rivales que hay que adelantar ("roces" dan puntos y combo), rampas para
// volar y juntar alfajores en el aire, charcos de chocolate, poderes (nitro, imán, escudo),
// combo de alfajores, un hito cada kilómetro y música.

import { THREE, Game3D, clamp, lerp, rand, loadTexture, canvasTexture, roundedBox, makeBunting, makeLogo, disposeGeometries } from "./three-kit.js?v=b23d80ca32";
import { createMatichico } from "./matichico3d.js?v=b23d80ca32";
import { earnCoins, saveProgress } from "./storage.js?v=b23d80ca32";
import * as audio from "./audio.js?v=b23d80ca32";
import { renderModePicker } from "./campaign.js?v=b23d80ca32";

const LANE_W = 2.7;
const LANES = [-LANE_W, 0, LANE_W];
const SEG_LEN = 8;
const SEG_COUNT = 34;
const AHEAD = SEG_LEN * SEG_COUNT;
const TREES = 72;
const BASE_SPEED = 19;
const MAX_SPEED = 44;
const GRAV = 24;
const ZONES = ["Mañana soleada", "Mediodía dulce", "Atardecer de caramelo", "Anochecer", "Noche de cacao", "Amanecer"];
const RIVAL_COLORS = [0x3b8cff, 0x4fd09a, 0xffc800, 0x9a5cff, 0xff8a2a, 0x35f0ff];

import { CARS, carById, garageOf, currentCar, buyCar, equipCar } from "./autos-garage.js?v=b23d80ca32";
const SPRITES = ["alf-frambuesa", "alf-menta", "alf-naranja", "alf-trufa", "alf-pie-limon", "alf-maracuya", "alf-almendra", "alf-capuchino"];

// momentos del día: [color del cielo, color de la niebla, luz del sol, intensidad hemisférica]
const DAY = [
  { sky: 0x9fdcf5, fog: 0xcfeaf5, sun: 2.5, hemi: 1.25 },
  { sky: 0x7ec8f0, fog: 0xbfe3f7, sun: 2.7, hemi: 1.3 },
  { sky: 0xffa772, fog: 0xffcfa0, sun: 1.9, hemi: 1.0 },
  { sky: 0x6a4a8f, fog: 0x8a6aa6, sun: 0.9, hemi: 0.75 },
  { sky: 0x141233, fog: 0x1f1c46, sun: 0.35, hemi: 0.5 },
  { sky: 0x4a4a8a, fog: 0x7a7ab0, sun: 0.8, hemi: 0.7 },
];

export class AutosGame extends Game3D {
  constructor(character, progress, els) {
    super("autos", character, progress, els, { fov: 62 });
    this.kawaii = true; // ambiente kawaii: pastel, sombreado por tonos, pétalos y estrellitas
    this.ambientOpts = { petals: 28, hearts: 5, stars: 18, radius: 16, height: 9 };
    this.musicTheme = "race";
    this.laneIndex = 1;
    this.tmpA = new THREE.Color();
    this.tmpB = new THREE.Color();
  }

  curv() {
    return 0.0011 * Math.sin(this.dist / 700) + 0.0006 * Math.sin(this.dist / 290 + 1.3);
  }

  bend(a) {
    return this.curvNow * a * a;
  }

  // ---------- escena ----------

  async build() {
    const s = this.scene;
    s.background = new THREE.Color(DAY[0].sky);
    s.fog = new THREE.Fog(DAY[0].fog, 60, AHEAD * 0.95);

    this.hemi = new THREE.HemisphereLight(0xcfeaff, 0xf2d8b0, 1.25);
    s.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff0d2, 2.5);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(this.coarse ? 1024 : 2048, this.coarse ? 1024 : 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -12; sc.right = 12; sc.top = 26; sc.bottom = -14; sc.near = 1; sc.far = 80;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.05;
    s.add(this.sun, this.sun.target);
    this.onLowQuality = () => { this.sun.castShadow = false; };
    this.headlight = new THREE.PointLight(0xfff0c0, 0, 22, 1.6);
    s.add(this.headlight);

    const std = (color, roughness = 0.6, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
    this.m = {
      grassA: std(0x8fc152, 1),
      grassB: std(0x84b84a, 1),
      road: std(0x6b7185, 0.95),
      roadLane: std(0x646a7e, 0.95),
      curbA: std(0xd4216c, 0.6),
      curbB: std(0xfff6e6, 0.6),
      dash: new THREE.MeshBasicMaterial({ color: 0xffffff }),
      edgeLine: new THREE.MeshBasicMaterial({ color: 0xffe14a }),
      chevron: new THREE.MeshBasicMaterial({ color: 0xffe14a, transparent: true, opacity: 0.8, depthWrite: false }),
      danger: new THREE.MeshBasicMaterial({ map: this._dangerTex(), transparent: true, depthWrite: false }),
      brown: std(0x64321b, 0.5),
      brownLight: std(0x8a5a36, 0.5),
      pink: std(0xd4216c, 0.4),
      gold: std(0xffc800, 0.25, { metalness: 0.5 }),
      cream: std(0xfff6e6, 0.5),
      black: std(0x222222, 0.8),
      glass: new THREE.MeshStandardMaterial({ color: 0xbfe6ff, roughness: 0.1, transparent: true, opacity: 0.4 }),
      trunk: std(0x64321b, 0.9),
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
    this.textures = SPRITES.map((n) => loadTexture(`assets/products/${n}.jpg`));
    this.logoTex = loadTexture("assets/brand/logo-badge.png");

    this._buildRoad();
    this._buildTrees();
    this._buildArches();
    this._buildBackdrop();
    this._buildCar();
    this.shieldMesh = new THREE.Mesh(new THREE.SphereGeometry(1.7, 20, 14), new THREE.MeshBasicMaterial({ color: 0x35f0ff, transparent: true, opacity: 0.28, depthWrite: false }));
    this.shieldMesh.position.y = 0.9;
    this.shieldMesh.visible = false;
    this.car.add(this.shieldMesh);
    this.rampTex = canvasTexture(128, 128, (g, w, h) => {
      g.fillStyle = "#ffc800"; g.fillRect(0, 0, w, h);
      g.fillStyle = "#d4216c";
      for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(0, i * 36); g.lineTo(w / 2, i * 36 - 22); g.lineTo(w, i * 36); g.lineTo(w, i * 36 + 14); g.lineTo(w / 2, i * 36 - 8); g.lineTo(0, i * 36 + 14); g.fill(); }
    });
    this.obstacles = [];
    this.pickups = [];
  }

  /** Mancha roja bajo los obstáculos: avisa "aquí no" aunque el color sea parecido al camino. */
  _dangerTex() {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");
    const gr = g.createRadialGradient(64, 64, 8, 64, 64, 62);
    gr.addColorStop(0, "rgba(255,40,70,0.85)");
    gr.addColorStop(0.65, "rgba(255,40,70,0.5)");
    gr.addColorStop(1, "rgba(255,40,70,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  _addDanger(g, w = 2.3, l = 2.3) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), this.m.danger);
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.045;
    m.renderOrder = 2;
    g.add(m);
  }

  _buildRoad() {
    this.segments = [];
    const roadW = LANE_W * 3 + 0.6;
    const grassGeo = new THREE.PlaneGeometry(140, SEG_LEN + 1.2);
    grassGeo.rotateX(-Math.PI / 2);
    const roadGeo = new THREE.PlaneGeometry(roadW, SEG_LEN + 1.2);
    roadGeo.rotateX(-Math.PI / 2);
    const laneGeo = new THREE.PlaneGeometry(LANE_W - 0.3, SEG_LEN + 1.2);
    laneGeo.rotateX(-Math.PI / 2);
    const curbGeo = new THREE.BoxGeometry(0.8, 0.14, SEG_LEN + 1.2);
    const dashGeo = new THREE.BoxGeometry(0.3, 0.02, SEG_LEN * 0.55);
    const edgeGeo = new THREE.BoxGeometry(0.22, 0.02, SEG_LEN + 1.2);
    // flechas hacia adelante en el centro de cada carril
    const sh = new THREE.Shape();
    sh.moveTo(0, 1.1); sh.lineTo(0.95, -0.1); sh.lineTo(0.5, -0.1); sh.lineTo(0, 0.5);
    sh.lineTo(-0.5, -0.1); sh.lineTo(-0.95, -0.1); sh.closePath();
    const chevGeo = new THREE.ShapeGeometry(sh);
    chevGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < SEG_COUNT; i++) {
      const g = new THREE.Group();
      const grass = new THREE.Mesh(grassGeo, this.m.grassA);
      grass.receiveShadow = true;
      const road = new THREE.Mesh(roadGeo, this.m.road);
      road.position.y = 0.02;
      road.receiveShadow = true;
      const curbL = new THREE.Mesh(curbGeo, this.m.curbA);
      const curbR = new THREE.Mesh(curbGeo, this.m.curbA);
      curbL.position.set(-(LANE_W * 1.5 + 0.7), 0.06, 0);
      curbR.position.set(LANE_W * 1.5 + 0.7, 0.06, 0);
      const d1 = new THREE.Mesh(dashGeo, this.m.dash);
      const d2 = new THREE.Mesh(dashGeo, this.m.dash);
      d1.position.set(-LANE_W / 2, 0.045, 0);
      d2.position.set(LANE_W / 2, 0.045, 0);
      const eL = new THREE.Mesh(edgeGeo, this.m.edgeLine);
      const eR = new THREE.Mesh(edgeGeo, this.m.edgeLine);
      eL.position.set(-(LANE_W * 1.5 + 0.12), 0.045, 0);
      eR.position.set(LANE_W * 1.5 + 0.12, 0.045, 0);
      const lanes = [-1, 0, 1].map((l) => {
        const m = new THREE.Mesh(laneGeo, this.m.roadLane);
        m.position.set(l * LANE_W, 0.03, 0);
        return m;
      });
      const chev = [-1, 0, 1].map((l) => {
        const m = new THREE.Mesh(chevGeo, this.m.chevron);
        m.position.set(l * LANE_W, 0.05, 0.4);
        m.renderOrder = 1;
        return m;
      });
      g.add(grass, road, lanes[0], lanes[2], curbL, curbR, d1, d2, eL, eR, ...chev);
      g.userData = { grass, curbL, curbR, d1, d2, chev, k: -1 };
      this.scene.add(g);
      this.segments.push(g);
    }
  }

  _buildTrees() {
    const trunkGeo = new THREE.CylinderGeometry(0.3, 0.42, 2.6, 7);
    trunkGeo.translate(0, 1.3, 0);
    const leafGeo = new THREE.IcosahedronGeometry(1.7, 0);
    this.trunkIM = new THREE.InstancedMesh(trunkGeo, this.m.trunk, TREES);
    const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, flatShading: true });
    this.leafA = new THREE.InstancedMesh(leafGeo, leafMat, TREES);
    this.leafB = new THREE.InstancedMesh(leafGeo, leafMat, TREES);
    const greens = [0x6fa447, 0x8cbc55, 0x5f9640].map((c) => new THREE.Color(c));
    this.trees = [];
    for (let i = 0; i < TREES; i++) {
      this.trees.push({ d: (i / TREES) * AHEAD * 1.05, side: i % 2 ? 1 : -1, off: rand(8, 22), sc: rand(0.9, 1.5), rot: rand(0, 6) });
      this.leafA.setColorAt(i, greens[i % 3]);
      this.leafB.setColorAt(i, greens[(i + 1) % 3]);
    }
    this.leafA.castShadow = false;
    this.scene.add(this.trunkIM, this.leafA, this.leafB);
    this.dummy = new THREE.Object3D();
  }

  _buildArches() {
    this.arches = [];
    const bannerTex = canvasTexture(512, 160, (g, w, h) => {
      g.fillStyle = "#4B2E2E"; g.fillRect(0, 0, w, h);
      g.strokeStyle = "#FFC800"; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12);
      g.fillStyle = "#D4216C"; g.font = '70px "Baby Chipmunk", sans-serif'; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText("Matichoc", w / 2, 62);
      g.fillStyle = "#CFD767"; g.font = '38px "Adorable Mother Script", cursive';
      g.fillText("pasión por el cacao", w / 2, 122);
    });
    const poleGeo = new THREE.CylinderGeometry(0.14, 0.18, 6.2, 10);
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Group();
      for (const sx of [-1, 1]) {
        const pole = new THREE.Mesh(poleGeo, this.m.brown);
        pole.position.set(sx * (LANE_W * 1.5 + 1.6), 3.1, 0);
        pole.castShadow = true;
        const ball = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), this.m.gold);
        ball.position.set(sx * (LANE_W * 1.5 + 1.6), 6.3, 0);
        g.add(pole, ball);
      }
      const bun = makeBunting(new THREE.Vector3(-(LANE_W * 1.5 + 1.6), 6.0, 0), new THREE.Vector3(LANE_W * 1.5 + 1.6, 6.0, 0), { count: 16, sag: 0.8, size: 0.3 });
      g.add(bun);
      const banner = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.62), new THREE.MeshStandardMaterial({ map: bannerTex, roughness: 0.7, side: THREE.DoubleSide }));
      banner.position.set(0, 4.6, 0.05);
      g.add(banner);
      for (const sx of [-1, 1]) {
        const lg = makeLogo(1.7);
        lg.position.set(sx * 3.45, 4.6, 0.06);
        g.add(lg);
      }
      this.scene.add(g);
      this.arches.push({ g, d: 90 + i * 130 });
    }
  }

  _buildBackdrop() {
    this.backdrop = new THREE.Group();
    const hillMat = new THREE.MeshStandardMaterial({ color: 0x86b64c, roughness: 1, fog: false });
    for (let i = 0; i < 9; i++) {
      const hill = new THREE.Mesh(new THREE.SphereGeometry(rand(28, 50), 18, 12), hillMat);
      hill.scale.y = rand(0.5, 0.8);
      hill.position.set(-240 + i * 60 + rand(-10, 10), -12, -330);
      this.backdrop.add(hill);
    }
    this.sunDisc = new THREE.Mesh(new THREE.CircleGeometry(26, 32), new THREE.MeshBasicMaterial({ color: 0xfff1c0, fog: false, transparent: true, opacity: 0.9 }));
    this.sunDisc.position.set(70, 70, -340);
    this.backdrop.add(this.sunDisc);
    this.cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, fog: false });
    for (let i = 0; i < 10; i++) {
      const c = new THREE.Group();
      for (let p = 0; p < 4; p++) {
        const sp = new THREE.Mesh(new THREE.SphereGeometry(rand(7, 12), 10, 8), this.cloudMat);
        sp.position.set(p * 11 - 16, rand(-2, 3), rand(-3, 3));
        sp.scale.y = 0.55;
        c.add(sp);
      }
      c.position.set(rand(-260, 260), rand(55, 110), -320);
      this.backdrop.add(c);
    }
    this.scene.add(this.backdrop);
  }

  _buildCar() {
    const car = new THREE.Group();
    const sh = (m) => { m.castShadow = true; return m; };
    // materiales propios del auto (así cada auto del garaje puede tener sus colores sin cambiar los obstáculos)
    this.carM = { body: std2(0x64321b, 0.5), trim: std2(0xd4216c, 0.4), accent: new THREE.MeshStandardMaterial({ color: 0xffc800, roughness: 0.25, metalness: 0.5 }) };
    const chassis = sh(new THREE.Mesh(roundedBox(1.7, 0.55, 3.3, 0.2, 0.05), this.carM.body));
    chassis.position.y = 0.58;
    car.add(chassis);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 3.1), this.carM.accent);
    stripe.position.set(0, 0.87, 0);
    car.add(stripe);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const fender = sh(new THREE.Mesh(roundedBox(0.16, 0.34, 1.05, 0.06, 0.02), this.carM.trim));
        fender.position.set(sx * 0.9, 0.62, sz * 1.0);
        car.add(fender);
      }
    }
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.04, 1.25), std2(0x3a2010));
    seat.position.set(0, 0.88, 0.35);
    car.add(seat);
    const rim = sh(new THREE.Mesh(roundedBox(1.35, 0.14, 1.55, 0.05, 0.02), this.carM.trim));
    rim.position.set(0, 0.9, 0.35);
    car.add(rim);
    const wind = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.5), this.m.glass);
    wind.position.set(0, 1.16, -0.5);
    wind.rotation.x = -0.55;
    car.add(wind);

    this.wheels = [];
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const w = new THREE.Group();
        w.position.set(sx * 0.96, 0.38, sz * 1.05);
        const tire = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.34, 18), this.m.black));
        tire.rotation.z = Math.PI / 2;
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.36, 12), this.carM.accent);
        cap.rotation.z = Math.PI / 2;
        w.add(tire, cap);
        car.add(w);
        this.wheels.push(w);
      }
    }
    const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c0 });
    const tailMat = new THREE.MeshBasicMaterial({ color: 0xff3b3b });
    for (const sx of [-1, 1]) {
      const hl = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), headMat);
      hl.position.set(sx * 0.55, 0.65, -1.66);
      const tl = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), tailMat);
      tl.position.set(sx * 0.62, 0.68, 1.66);
      car.add(hl, tl);
    }
    const spoiler = sh(new THREE.Mesh(roundedBox(1.7, 0.07, 0.42, 0.03, 0.015), this.carM.trim));
    spoiler.position.set(0, 1.28, 1.55);
    car.add(spoiler);
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.4, 0.07), this.carM.accent);
      post.position.set(sx * 0.6, 1.08, 1.5);
      car.add(post);
    }
    const plate = new THREE.Mesh(new THREE.CircleGeometry(0.32, 20), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    plate.position.set(0, 0.62, 1.67);
    const logo = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.52), new THREE.MeshBasicMaterial({ map: this.logoTex, transparent: true }));
    logo.position.set(0, 0.62, 1.675);
    car.add(plate, logo);

    // brillo de neón bajo el auto y corona (solo en los autos que los traen)
    this.carGlow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 4.2), new THREE.MeshBasicMaterial({ map: this._glowTex(), color: 0x35f0ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.carGlow.rotation.x = -Math.PI / 2;
    this.carGlow.position.y = 0.06;
    this.carGlow.visible = false;
    this.crown = new THREE.Group();
    const cb = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.2, 5), this.carM.accent);
    this.crown.add(cb);
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; const sp = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.26, 6), this.carM.accent); sp.position.set(Math.sin(a) * 0.32, 0.2, Math.cos(a) * 0.32); this.crown.add(sp); }
    this.crown.position.set(0, 1.95, 0.4);
    this.crown.visible = false;
    car.add(this.carGlow, this.crown);

    this.car = car;
    this.scene.add(car);
    this._ensureDriver();
  }

  /** Resplandor suave (círculo difuso) para halos y luces. */
  _glowTex() {
    if (this._glowT) return this._glowT;
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
    gr.addColorStop(0, "rgba(255,255,255,1)");
    gr.addColorStop(0.4, "rgba(255,255,255,0.5)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    this._glowT = new THREE.CanvasTexture(c);
    return this._glowT;
  }

  /** Viste el auto con el modelo elegido en el garaje y fija sus ventajas. */
  _applyCar() {
    const def = currentCar(this.progress);
    this.perk = def;
    this.bonusMult = def.coin;
    if (!this.carM) return;
    this.carM.body.color.setHex(def.body);
    this.carM.trim.color.setHex(def.trim);
    this.carM.accent.color.setHex(def.accent);
    this.carGlow.visible = !!def.glow;
    if (def.glow) this.carGlow.material.color.setHex(def.glow);
    this.crown.visible = !!def.crown;
  }

  _ensureDriver() {
    if (this.driver && this.driverId === this.character.id) {
      this.driver.setLook(this.look);
      return;
    }
    if (this.driver) this.car.remove(this.driver.group);
    this.driver = createMatichico(this.character, this.outfit, this.look);
    this.driverId = this.character.id;
    this.driver.group.scale.setScalar(0.62);
    this.driver.group.position.set(0, 0.72, 0.4);
    this.driver.group.rotation.y = Math.PI;
    this.driver.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.car.add(this.driver.group);
  }

  // ---------- partida ----------

  reset() {
    for (const o of this.obstacles) { this.scene.remove(o.mesh); disposeGeometries(o.mesh); }
    for (const o of this.pickups) { this.scene.remove(o.mesh); disposeGeometries(o.mesh); }
    this.obstacles = [];
    this.pickups = [];
    this._ensureDriver();
    this.dist = 0;
    this.speed = 7;
    this.laneIndex = 1;
    this.carX = 0;
    this.hearts = 3;
    this.invuln = 0;
    this.boost = 0;
    this.bonus = 0;
    this.items = 0;
    this.coinsEarned = 0;
    this.score = 0;
    this.nextRow = 70;
    this.carY = 0;
    this.vy = 0;
    this.flip = 0;
    this.airFromRamp = false;
    this.combo = 0;
    this.comboT = 0;
    this._applyCar();
    this.power = null;
    this.shield = !!this.perk.shield; // algunos autos del garaje parten con escudo
    this.km = 0;
    this.zoneIdx = -1;
    this.nearMisses = 0;
    this.bestCombo = 0;
    this.setupMission();
    this.vxLean = 0;
    this.shake = 0;
    this.lastPop = 0;
    this.headTurn = 0;
    this.curvNow = this.curv();
    this.fovBase = 62;
    this._updateHud();
  }

  onBegin() {
    this.speed = BASE_SPEED * 0.7;
  }

  // ---------- entrada ----------

  async init() {
    await super.init();
    this._bindInput();
  }

  _changeLane(dir) {
    if (this.state !== "playing") return;
    const next = clamp(this.laneIndex + dir, 0, 2);
    if (next !== this.laneIndex) {
      this.laneIndex = next;
      audio.playJump();
    }
  }

  /** Joystick táctil: al empujarlo hacia un lado cambia de carril (una vez por empujón). */
  setStick(x) {
    const dir = x > 0.55 ? 1 : x < -0.55 ? -1 : 0;
    if (dir && dir !== this.stickDir) this._changeLane(dir);
    if (Math.abs(x) < 0.3) this.stickDir = 0;
    else if (dir) this.stickDir = dir;
  }

  _bindInput() {
    window.addEventListener("keydown", (e) => {
      if (!this.running) return;
      if (e.code === "ArrowLeft" || e.code === "KeyA") { this._changeLane(-1); e.preventDefault(); }
      else if (e.code === "ArrowRight" || e.code === "KeyD") { this._changeLane(1); e.preventDefault(); }
    });
    const wrap = this.els.wrap;
    let start = null;
    wrap.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button")) return;
      start = { x: e.clientX, id: e.pointerId, done: false };
    });
    wrap.addEventListener("pointermove", (e) => {
      if (!start || start.done || e.pointerId !== start.id) return;
      const dx = e.clientX - start.x;
      if (Math.abs(dx) > 36) {
        this._changeLane(dx > 0 ? 1 : -1);
        start.x = e.clientX;
      }
    });
    wrap.addEventListener("pointerup", (e) => {
      if (!start || e.pointerId !== start.id) return;
      if (Math.abs(e.clientX - start.x) < 12 && this.state === "playing") {
        const r = wrap.getBoundingClientRect();
        this._changeLane(e.clientX < r.left + r.width / 2 ? -1 : 1);
      }
      start = null;
    });
    wrap.addEventListener("pointercancel", () => { start = null; });
    const t = this.els.touch;
    if (t && t.left) {
      t.left.addEventListener("pointerdown", (e) => { e.preventDefault(); this._changeLane(-1); });
      t.right.addEventListener("pointerdown", (e) => { e.preventDefault(); this._changeLane(1); });
    }
  }

  // ---------- bucle ----------

  update(dt) {
    const playing = this.state === "playing";
    if (playing) {
      const target = (this.boost > 0 ? MAX_SPEED * 1.0 : BASE_SPEED + Math.min(1, this.dist / 5000) * (MAX_SPEED - BASE_SPEED - 8)) * (this.boost > 0 ? 1.1 : 1);
      this.speed = lerp(this.speed, target, 1 - Math.exp(-0.9 * dt));
    } else if (this.state === "intro") {
      this.speed = 7;
    } else {
      this.speed = lerp(this.speed, 0, 1 - Math.exp(-2.5 * dt));
    }
    this.dist += this.speed * dt;
    this.meterEnergy("dist", this.dist, 250); // 1 ⚡ cada 250 m
    this.curvNow = lerp(this.curvNow, this.curv(), 1 - Math.exp(-2 * dt));

    // carril
    const targetX = LANES[this.laneIndex];
    const prevX = this.carX;
    this.carX = lerp(this.carX, targetX, 1 - Math.exp(-13 * dt));
    const vx = (this.carX - prevX) / Math.max(dt, 0.0001);
    this.vxLean = lerp(this.vxLean, vx, 1 - Math.exp(-8 * dt));

    this._updateRoad();
    this._updateTrees();
    this._updateArches();

    if (playing) {
      this._spawn();
      this._updateObjects(dt);
      this.score = Math.floor(this.dist / 4) + this.bonus;
      if (this.boost > 0) this.boost -= dt;
      if (this.invuln > 0) this.invuln -= dt;
      if (this.power) { this.power.t -= dt; if (this.power.t <= 0) this.power = null; }
      if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.combo = 0; }
      this._updateAir(dt);
      this._milestones();
      this.shake = Math.max(0, this.shake - dt * 3);
      this._updateHud();
    }

    // auto
    this.car.position.set(this.carX, this.carY, 0);
    this.car.rotation.y = clamp(-vx * 0.03, -0.35, 0.35);
    this.car.rotation.z = clamp(-vx * 0.012, -0.12, 0.12);
    if (this.carY > 0.05) this.car.rotation.z = this.flip; // voltereta lateral en el aire
    this.shieldMesh.visible = this.shield;
    if (this.shield) this.shieldMesh.material.opacity = 0.22 + Math.sin(this.time * 6) * 0.06;
    this.car.visible = this.invuln <= 0 || Math.floor(this.time * 14) % 2 === 0;
    for (const w of this.wheels) w.children[0].rotation.x += this.speed * dt / 0.4;
    this.headTurn = Math.max(0, this.headTurn - dt);
    this.driver.head.rotation.y = lerp(this.driver.head.rotation.y, this.headTurn > 0 ? Math.PI * 0.85 : 0, 1 - Math.exp(-9 * dt));
    this.driver.animate(this.time, this.state === "gameover" ? "sad" : "drive", 1);
    this.driver.head.rotation.y = lerp(this.driver.head.rotation.y, this.headTurn > 0 ? Math.PI * 0.85 : 0, 1);
    if (this.boost > 0 && Math.random() < 0.8) {
      this.particles.burst(new THREE.Vector3(this.carX + rand(-0.4, 0.4), 0.7, 1.8), [0x7ee0ff, 0xffffff, 0xcfd767], 2, 3, 0.4, 0, 1);
    }

    this._placeCamera(dt);
    this._environment();
  }

  // ---------- vuelo (rampas) ----------

  _updateAir(dt) {
    if (this.carY <= 0 && this.vy <= 0) return;
    this.vy -= GRAV * dt;
    this.carY += this.vy * dt;
    this.flip = Math.min(Math.PI * 2, this.flip + dt * 7.5);
    if (this.carY <= 0) {
      this.carY = 0;
      this.vy = 0;
      this.flip = 0;
      if (this.airFromRamp) {
        this.airFromRamp = false;
        this.bonus += 50 * this._mult();
        this.popups.add(new THREE.Vector3(this.carX, 2, -1), `¡Aterrizaje! +${50 * this._mult()}`, "combo");
        this.particles.burst(new THREE.Vector3(this.carX, 0.3, 0), [0xfff6e6, 0xffc800, 0xd4216c], 22, 5, 0.7, 4);
        this.shake = Math.max(this.shake, 0.35);
        audio.playBounce();
      }
    }
  }

  _launch() {
    this.vy = 9.2;
    this.carY = 0.01;
    this.flip = 0;
    this.airFromRamp = true;
    audio.playJump();
    audio.playWhoosh();
    this.popups.add(new THREE.Vector3(this.carX, 2.2, -1), "¡Vuelo!", "combo");
  }

  _mult() {
    return 1 + Math.min(4, Math.floor(this.combo / 8));
  }

  // modo misiones (js/missions.js)
  getMetric(m) {
    return { dist: this.dist, items: this.items, near: this.nearMisses, combo: this.bestCombo, score: this.score }[m];
  }

  onIntro() {
    this._applyCar();
    this.renderGarage();
    renderModePicker(this.els.q("lvlpick"), { id: "autos", progress: this.progress, kind: "missions", onChange: () => this.reset() });
  }

  nextLevel() { this.nextMission(); }

  /** El garaje de la tarjeta de inicio: ver los autos, comprar con Matipuntos y elegir cuál usar. */
  renderGarage() {
    const el = this.els.q("garage");
    if (!el) return;
    const g = garageOf(this.progress);
    el.innerHTML = "";
    for (const c of CARS) {
      const owned = g.owned.includes(c.id);
      const b = document.createElement("button");
      b.type = "button";
      b.className = "gar-card" + (g.car === c.id ? " on" : "") + (!owned ? " locked" : "");
      b.innerHTML = `<span class="gar-ic">${c.icon}</span><b>${c.name}</b><small>${c.perks}</small><em>${g.car === c.id ? "✔ En uso" : owned ? "Usar" : `🍫✨ ${c.price}`}</em>`;
      b.addEventListener("click", () => {
        if (owned) equipCar(this.progress, c.id);
        else if (buyCar(this.progress, c.id)) { audio.playPurchase(); this.banner(`¡Nuevo auto: ${c.name}! ${c.icon}`); }
        else { this.banner(`Te faltan Matipuntos para ${c.name}`); audio.playBump(); return; }
        this._applyCar();
        this.renderGarage();
        this._updateHud?.();
      });
      el.appendChild(b);
    }
  }

  _addCombo(n = 1) {
    const before = this._mult();
    this.combo += n;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.comboT = 2.6;
    const after = this._mult();
    if (after > before) {
      this.banner(`¡Combo x${after}!`);
      audio.playCombo(after * 2);
    }
  }

  /** Cada kilómetro hay premio, y cambia el momento del día. */
  _milestones() {
    const km = Math.floor(this.dist / 1000);
    if (km > this.km) {
      this.km = km;
      const b = 100 * km;
      this.bonus += b;
      this.banner(`¡${km} km! +${b}`);
      audio.playMissionComplete();
      this.haptic(60);
      const kc = Math.round(3 * this.perk.coin);
      earnCoins(this.progress, kc);
      this.coinsEarned += kc;
      saveProgress(this.progress);
      this.particles.burst(new THREE.Vector3(this.carX, 3, -2), [0xffc800, 0xd4216c, 0x35f0ff, 0xfff6e6], 40, 7, 1.1, 5);
    }
    const zone = Math.floor(((this.dist / 2600) % 1) * ZONES.length);
    if (zone !== this.zoneIdx) {
      if (this.zoneIdx >= 0) this.banner(ZONES[zone]);
      this.zoneIdx = zone;
    }
  }

  _updateRoad() {
    const k0 = Math.floor(this.dist / SEG_LEN);
    for (let i = 0; i < SEG_COUNT; i++) {
      const g = this.segments[i];
      const k = k0 + i;
      const d = k * SEG_LEN + SEG_LEN / 2;
      const a = d - this.dist;
      g.position.set(this.bend(a), 0, -a);
      g.rotation.y = -Math.atan(2 * this.curvNow * a);
      if (g.userData.k !== k) {
        g.userData.k = k;
        const even = k % 2 === 0;
        g.userData.grass.material = even ? this.m.grassA : this.m.grassB;
        g.userData.curbL.material = g.userData.curbR.material = even ? this.m.curbA : this.m.curbB;
        g.userData.d1.visible = g.userData.d2.visible = even;
        for (const c of g.userData.chev) c.visible = k % 3 === 0;
      }
    }
  }

  _updateTrees() {
    const dummy = this.dummy;
    for (let i = 0; i < TREES; i++) {
      const t = this.trees[i];
      let a = t.d - this.dist;
      if (a < -14) {
        t.d += AHEAD * 1.05;
        t.off = rand(8, 22);
        t.sc = rand(0.9, 1.5);
        a = t.d - this.dist;
      }
      const x = this.bend(a) + t.side * (LANE_W * 1.5 + t.off);
      dummy.position.set(x, 0, -a);
      dummy.rotation.set(0, t.rot, 0);
      dummy.scale.setScalar(t.sc);
      dummy.updateMatrix();
      this.trunkIM.setMatrixAt(i, dummy.matrix);
      dummy.position.y = 3.3 * t.sc;
      dummy.updateMatrix();
      this.leafA.setMatrixAt(i, dummy.matrix);
      dummy.position.y = 4.5 * t.sc;
      dummy.scale.setScalar(t.sc * 0.72);
      dummy.updateMatrix();
      this.leafB.setMatrixAt(i, dummy.matrix);
    }
    this.trunkIM.instanceMatrix.needsUpdate = true;
    this.leafA.instanceMatrix.needsUpdate = true;
    this.leafB.instanceMatrix.needsUpdate = true;
    if (this.leafA.instanceColor) { this.leafA.instanceColor.needsUpdate = true; this.leafB.instanceColor.needsUpdate = true; }
  }

  _updateArches() {
    for (const ar of this.arches) {
      let a = ar.d - this.dist;
      if (a < -10) {
        ar.d += 130 * 3;
        a = ar.d - this.dist;
      }
      ar.g.position.set(this.bend(a), 0, -a);
      ar.g.rotation.y = -Math.atan(2 * this.curvNow * a);
    }
  }

  // ---------- obstáculos y monedas ----------

  _spawn() {
    while (this.nextRow - this.dist < AHEAD * 0.85) {
      const diff = clamp(this.dist / 6000, 0, 1);
      const free = Math.floor(Math.random() * 3);
      const lanes = [0, 1, 2];
      const others = lanes.filter((l) => l !== free);
      const r = Math.random();
      let airArc = false;
      if (r < 0.26) {
        this._addObstacle(others[Math.floor(Math.random() * 2)], this.nextRow);
      } else if (r < 0.26 + 0.2 + diff * 0.14) {
        for (const l of others) this._addObstacle(l, this.nextRow);
      } else if (r < 0.7 + diff * 0.14 && this.dist > 250) {
        this._addRival(others[Math.floor(Math.random() * 2)], this.nextRow);
        if (Math.random() < 0.5) this._addRival(free === 1 ? 0 : 1, this.nextRow + rand(10, 22));
      } else if (r < 0.8 + diff * 0.1 && this.dist > 450) {
        this._addRamp(free, this.nextRow);
        airArc = true;
        for (const l of others) if (Math.random() < 0.6) this._addObstacle(l, this.nextRow + 6);
      } else if (r < 0.9 && this.dist > 300) {
        this._addPuddle(others[Math.floor(Math.random() * 2)], this.nextRow);
      }
      const q = Math.random();
      if (airArc) {
        // alfajores en el aire: solo se juntan si vuelas
        const flightT = (2 * 9.2) / GRAV;
        const reach = Math.max(this.speed, BASE_SPEED) * flightT;
        for (let i = 0; i < 6; i++) {
          const t = (i + 0.7) / 7;
          this._addPickup("alfajor", free, this.nextRow + 2 + reach * t, 0.95 + 4 * 1.7 * t * (1 - t) * 1.05);
        }
      } else if (q < 0.5) {
        for (let i = 0; i < 5; i++) this._addPickup("alfajor", free, this.nextRow + i * 4.2);
      } else if (q < 0.55 && this.dist > 300) {
        this._addPickup("nitro", free, this.nextRow + 6);
      } else if (q < 0.6 && this.dist > 400) {
        this._addPickup("iman", free, this.nextRow + 6);
      } else if (q < 0.65 && this.dist > 400) {
        this._addPickup("escudo", free, this.nextRow + 6);
      }
      this.nextRow += lerp(30, 15, diff) * rand(0.85, 1.15);
    }
  }

  // ---------- que se vea bien qué es cada cosa ----------

  _glyphTex(glyph, color) {
    this._glyphs = this._glyphs || {};
    const key = glyph + color;
    if (this._glyphs[key]) return this._glyphs[key];
    const hex = "#" + new THREE.Color(color).getHexString();
    const t = canvasTexture(96, 96, (g, w, h) => {
      g.fillStyle = hex;
      g.beginPath(); g.arc(w / 2, h / 2, 42, 0, Math.PI * 2); g.fill();
      g.lineWidth = 7; g.strokeStyle = "#fff"; g.stroke();
      g.fillStyle = "#fff";
      g.font = "900 54px system-ui, 'Apple Color Emoji', sans-serif";
      g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(glyph, w / 2, h / 2 + 3);
    });
    this._glyphs[key] = t;
    return t;
  }

  /** Halo luminoso (se ve de lejos y da el color de lo que es). */
  _halo(color, size) {
    this._haloMats = this._haloMats || {};
    const m = this._haloMats[color] || (this._haloMats[color] = new THREE.SpriteMaterial({ map: this._glowTex(), color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    const sp = new THREE.Sprite(m);
    sp.scale.set(size, size, 1);
    return sp;
  }

  /** Columna de luz + ícono sobre algo importante (peligro rojo, rampa celeste…). */
  _addBeacon(g, color, glyph, { h = 5, y = 3.4, size = 1.5 } = {}) {
    this._colMats = this._colMats || {};
    const mat = this._colMats[color] || (this._colMats[color] = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.55, h, 12, 1, true), mat);
    col.position.y = h / 2;
    col.userData.noToon = true;
    const ic = new THREE.Sprite(new THREE.SpriteMaterial({ map: this._glyphTex(glyph, color), transparent: true, depthTest: false }));
    ic.scale.set(size, size, 1);
    ic.position.y = y;
    ic.renderOrder = 9;
    g.add(col, ic);
  }

  _addRival(lane, d) {
    const g = new THREE.Group();
    const color = RIVAL_COLORS[Math.floor(Math.random() * RIVAL_COLORS.length)];
    const body = new THREE.Mesh(roundedBox(1.6, 0.55, 3.0, 0.2, 0.05), new THREE.MeshStandardMaterial({ color, roughness: 0.4 }));
    body.position.y = 0.55;
    const cab = new THREE.Mesh(roundedBox(1.2, 0.5, 1.4, 0.15, 0.04), new THREE.MeshStandardMaterial({ color: 0xfff6e6, roughness: 0.4 }));
    cab.position.set(0, 1.05, 0.1);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.3, 1.0), this.m.glass);
    glass.position.set(0, 1.1, 0.12);
    g.add(body, cab, glass);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.3, 14), this.m.black);
      w.rotation.z = Math.PI / 2;
      w.position.set(sx * 0.85, 0.36, sz * 1.0);
      g.add(w);
    }
    for (const sx of [-1, 1]) {
      const tl = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3b3b }));
      tl.position.set(sx * 0.58, 0.62, 1.52);
      g.add(tl);
    }
    this._addDanger(g, 3, 4.4);
    this._addBeacon(g, 0xff3b5c, "⚠", { h: 6, y: 3.2, size: 1.7 });
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.scene.add(g);
    this.obstacles.push({ mesh: g, lane, d, hit: false, kind: "rival", v: rand(9, 15), prevA: d - this.dist, passed: false });
  }

  _addRamp(lane, d) {
    const g = new THREE.Group();
    const slab = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.2, 3.6), new THREE.MeshStandardMaterial({ map: this.rampTex, roughness: 0.5 }));
    slab.rotation.x = 0.28;
    slab.position.y = 0.45;
    const side = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.6, 0.15), this.m.pink);
    side.position.set(0, 0.3, -1.65);
    g.add(slab, side);
    this._addBeacon(g, 0x35c8ff, "▲", { h: 4, y: 2.8, size: 1.4 });
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.scene.add(g);
    this.obstacles.push({ mesh: g, lane, d, hit: false, kind: "ramp" });
  }

  _addPuddle(lane, d) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(1.25, 24), new THREE.MeshStandardMaterial({ color: 0x2a0f05, roughness: 0.08, metalness: 0.3 }));
    m.rotation.x = -Math.PI / 2;
    m.scale.set(1, 1.5, 1);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.25, 1.5, 24), new THREE.MeshBasicMaterial({ color: 0xffe14a, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.scale.set(1, 1.5, 1);
    const g = new THREE.Group();
    m.position.y = 0.05;
    ring.position.y = 0.049;
    g.add(m, ring);
    this._addBeacon(g, 0xffa83c, "💧", { h: 3, y: 2.2, size: 1.2 });
    this.scene.add(g);
    this.obstacles.push({ mesh: g, lane, d, hit: false, kind: "puddle" });
  }

  _addObstacle(lane, d) {
    const type = ["cone", "barrel", "crate"][Math.floor(Math.random() * 3)];
    let mesh;
    if (type === "cone") {
      mesh = new THREE.Group();
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.2, 14), this.m.pink);
      cone.position.y = 0.6;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.37, 0.18, 14), this.m.cream);
      band.position.y = 0.55;
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.1, 1.0), this.m.pink);
      base.position.y = 0.05;
      mesh.add(cone, band, base);
    } else if (type === "barrel") {
      mesh = new THREE.Group();
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 1.15, 16), this.m.brownLight);
      b.position.y = 0.58;
      mesh.add(b);
      for (const y of [0.25, 0.9]) {
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.525, 0.045, 6, 18), this.m.gold);
        band.rotation.x = Math.PI / 2;
        band.position.y = y;
        mesh.add(band);
      }
    } else {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.25, 1.25), this.m.crate);
      mesh.position.y = 0.62;
      const wrapG = new THREE.Group();
      wrapG.add(mesh);
      mesh = wrapG;
    }
    this._addDanger(mesh, 2.8, 2.8);
    this._addBeacon(mesh, 0xff3b5c, "⚠", { h: 5, y: 2.6, size: 1.5 });
    mesh.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
    this.scene.add(mesh);
    this.obstacles.push({ mesh, lane, d, hit: false });
  }

  _addPickup(kind, lane, d, y = 0.95) {
    let mesh;
    if (kind === "alfajor") {
      const top = new THREE.MeshStandardMaterial({ map: this.textures[Math.floor(Math.random() * this.textures.length)], roughness: 0.5 });
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 26), [this.m.cream, top, this.logoBack || (this.logoBack = new THREE.MeshStandardMaterial({ map: this.logoTex, roughness: 0.5 }))]);
      disc.rotation.x = Math.PI / 2;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.05, 8, 26), this.m.gold);
      rim.position.z = 0.03;
      mesh = new THREE.Group();
      mesh.add(disc, rim);
    } else if (kind === "iman" || kind === "escudo") {
      const col = kind === "iman" ? 0xff3fa4 : 0x35f0ff;
      mesh = new THREE.Group();
      const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), new THREE.MeshStandardMaterial({ color: col, roughness: 0.2, emissive: col, emissiveIntensity: 0.9 }));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.06, 8, 24), this.m.cream);
      ring.rotation.x = Math.PI / 2.4;
      mesh.add(orb, ring);
    } else {
      mesh = new THREE.Group();
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.2), this.m.gold);
      const pis = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.34, 0.05), new THREE.MeshStandardMaterial({ color: 0xcfd767, roughness: 0.4 }));
      pis.position.z = 0.12;
      mesh.add(bar, pis);
      mesh.scale.setScalar(1.3);
    }
    // más visibles: halo del color de cada cosa, anillo en el camino (marca el carril) y, en los poderes, columna de luz
    const hue = { alfajor: 0xffd34d, iman: 0xff3fa4, escudo: 0x35f0ff }[kind] || 0xff9a3c;
    mesh.add(this._halo(hue, kind === "alfajor" ? 2.7 : 3.6));
    const gr = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.78, 24), new THREE.MeshBasicMaterial({ color: hue, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    gr.rotation.x = -Math.PI / 2;
    gr.position.y = -y + 0.07;
    mesh.add(gr);
    if (kind !== "alfajor") {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 5, 10, 1, true), new THREE.MeshBasicMaterial({ color: hue, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      col.position.y = -y + 2.5;
      mesh.add(col);
    }
    if (kind === "alfajor") mesh.scale.setScalar(1.35);
    this.scene.add(mesh);
    this.pickups.push({ mesh, kind, lane, d, y, x: LANES[lane], taken: false });
  }

  _updateObjects(dt) {
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i];
      if (o.kind === "rival") o.d += o.v * dt;
      const a = o.d - this.dist;
      if (a < -12) {
        this.scene.remove(o.mesh);
        disposeGeometries(o.mesh);
        this.obstacles.splice(i, 1);
        continue;
      }
      o.mesh.position.set(this.bend(a) + LANES[o.lane], 0, -a);
      o.mesh.rotation.y = -Math.atan(2 * this.curvNow * a);
      const dx = Math.abs(LANES[o.lane] - this.carX);
      const reachF = o.kind === "rival" ? 2.3 : o.kind === "ramp" ? 1.8 : 1.6;
      const reachB = o.kind === "rival" ? 2.3 : o.kind === "ramp" ? 1.4 : 1.7;
      if (!o.hit && a < reachF && a > -reachB && dx < (o.kind === "rival" ? 1.5 : 1.2)) {
        if (o.kind === "ramp") { o.hit = true; if (this.carY <= 0.05) this._launch(); }
        else if (o.kind === "puddle") { o.hit = true; if (this.carY <= 0.05) this._splash(o); }
        else if (this.carY < 0.9) { o.hit = true; this._crash(o); }
      }
      // roce: pasar muy cerca de un auto rival sin chocar
      if (o.kind === "rival" && !o.hit && !o.passed && o.prevA > 0 && a <= 0) {
        o.passed = true;
        if (dx > 1.2 && dx < 3.6) this._nearMiss(o);
      }
      o.prevA = a;
    }
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const k = this.pickups[i];
      const a = k.d - this.dist;
      if (a < -12 || k.taken) {
        this.scene.remove(k.mesh);
        disposeGeometries(k.mesh);
        this.pickups.splice(i, 1);
        continue;
      }
      if (this.power && this.power.kind === "iman" && k.kind === "alfajor" && a > -1 && a < 26) k.x = lerp(k.x, this.carX, 1 - Math.exp(-7 * dt));
      k.mesh.position.set(this.bend(a) + k.x, k.y + Math.sin(this.time * 4 + k.d) * 0.08, -a);
      if (k.kind === "alfajor") k.mesh.rotation.y = Math.sin(this.time * 2.6 + k.d) * 0.7;
      else k.mesh.rotation.y += dt * 2.5;
      const dy = Math.abs(k.y - (this.carY + 0.95));
      if (a < 1.5 && a > -1.5 && Math.abs(k.x - this.carX) < 1.35 && dy < 1.25) this._collect(k);
    }
  }

  _splash(o) {
    this.speed *= 0.72;
    this.shake = Math.max(this.shake, 0.4);
    this.combo = Math.max(0, this.combo - 4);
    this.popups.add(new THREE.Vector3(this.carX, 1.6, -1), "¡Resbalón!", "kill");
    this.particles.burst(new THREE.Vector3(this.carX, 0.4, 0), [0x5a2d16, 0x7a3f22, 0xfff6e6], 20, 4, 0.8, 5);
    audio.playBump();
  }

  _nearMiss(o) {
    this.nearMisses++;
    const m = this._mult();
    const pts = 25 * m;
    this.bonus += pts;
    this._addCombo(2);
    this.popups.add(new THREE.Vector3(this.carX, 1.9, -1), `¡Roce! +${pts}`, "combo");
    audio.playWhoosh();
    audio.playCombo(this.combo);
    this.haptic(15);
  }

  _collect(k) {
    k.taken = true;
    const at = new THREE.Vector3(this.carX, 1.6 + this.carY, -0.5);
    this.headTurn = 0.7;
    if (k.kind === "alfajor") {
      this.items++;
      const m = this._mult();
      this.bonus += 10 * m;
      this._addCombo(1);
      if (this.time - this.lastPop > 0.35) {
        this.lastPop = this.time;
        this.popups.add(at, m > 1 ? `+${10 * m} x${m}` : "+10", "kill");
      }
      this.particles.burst(at, [0xffc800, 0xfff6e6], 8, 3.5, 0.5, 4);
      audio.playCollect();
    } else if (k.kind === "iman") {
      this.power = { kind: "iman", t: 9 * this.perk.magnet };
      this.bonus += 40;
      this.popups.add(at, "¡Imán! 🧲", "combo");
      this.particles.burst(at, [0xff3fa4, 0xfff6e6], 20, 5, 0.8, 3);
      audio.playPowerup();
    } else if (k.kind === "escudo") {
      this.shield = true;
      this.bonus += 40;
      this.popups.add(at, "¡Escudo! 🛡️", "combo");
      this.particles.burst(at, [0x35f0ff, 0xfff6e6], 20, 5, 0.8, 3);
      audio.playPowerup();
    } else {
      this.boost = 3.2 * this.perk.nitro;
      this.bonus += 60;
      const nc = Math.round(2 * this.perk.coin);
      earnCoins(this.progress, nc);
      this.coinsEarned += nc;
      saveProgress(this.progress);
      this.popups.add(at, `¡Nitro! +${nc} 🍫✨`, "combo");
      this.particles.burst(at, [0x7ee0ff, 0xcfd767, 0xffc800, 0xffffff], 22, 6, 0.8, 3);
      audio.playBonusCollect();
    }
  }

  _crash(o) {
    if (this.boost > 0) {
      this.particles.burst(new THREE.Vector3(LANES[o.lane] + this.bend(o.d - this.dist), 1, -(o.d - this.dist)), [0xd4216c, 0xffc800, 0xfff6e6], 20, 6, 0.8, 8);
      this.scene.remove(o.mesh);
      o.d = -9999;
      this.popups.add(new THREE.Vector3(this.carX, 1.8, -1), "¡Bum!", "combo");
      audio.playBounce();
      return;
    }
    if (this.invuln > 0) return;
    if (this.shield) {
      this.shield = false;
      this.invuln = 1;
      this.shake = 0.6;
      this.scene.remove(o.mesh);
      o.mesh.visible = false;
      this.popups.add(new THREE.Vector3(this.carX, 1.8, -1), "¡Escudo roto!", "combo");
      this.particles.burst(new THREE.Vector3(this.carX, 1, 0), [0x35f0ff, 0xffffff], 26, 6, 0.8, 5);
      audio.playCrash();
      return;
    }
    this.combo = 0;
    this.hearts--;
    this.invuln = 1.7;
    this.shake = 1;
    this.speed *= 0.55;
    audio.playHurt();
    audio.playCrash();
    this.haptic(80);
    const at = new THREE.Vector3(this.carX, 1, -1);
    this.particles.burst(at, [0x5a2d16, 0xd4216c, 0xffc800, 0xfff6e6], 24, 6, 0.9, 9);
    this.popups.add(at, "¡Ouch!", "kill");
    this.scene.remove(o.mesh);
    o.mesh.visible = false;
    this._updateHud();
    if (this.hearts <= 0) this._gameOver();
  }

  _gameOver() {
    audio.playLose();
    this.finish(
      `Recorriste ${Math.floor(this.dist)} metros, juntaste ${this.items} alfajores, hiciste ${this.nearMisses} roces y sumaste ${this.score} puntos` +
        (this.coinsEarned > 0 ? `, ganando ${this.coinsEarned} Matipuntos.` : ".")
    );
  }

  _updateHud() {
    this.els.hudScore.textContent = String(this.score);
    this.els.hudSpeed.textContent = `${Math.round(this.speed * 4)} km/h`;
    this.els.hudHearts.textContent = "❤".repeat(Math.max(0, this.hearts)) + "♡".repeat(Math.max(0, 3 - this.hearts));
    this.els.hudCoins.textContent = String(this.progress.coins);
    if (this.els.hudCombo) this.els.hudCombo.textContent = this._mult() > 1 || this.combo >= 3 ? `x${this._mult()} (${this.combo})` : "x1";
    if (this.els.hudPower) {
      const p = this.power ? `🧲 ${Math.ceil(this.power.t)}` : "";
      const sh = this.shield ? "🛡️" : "";
      this.els.hudPower.parentElement.classList.toggle("hidden", !p && !sh);
      this.els.hudPower.textContent = `${sh} ${p}`.trim();
    }
  }

  // ---------- cámara y ambiente ----------

  _placeCamera(dt) {
    const sh = this.shake * 0.12;
    this.camera.position.set(
      this.carX * 0.62 + (Math.random() - 0.5) * sh,
      3.5 + this.carY * 0.55 + (Math.random() - 0.5) * sh,
      7.4 + (this.boost > 0 ? 0.8 : 0)
    );
    this.camera.lookAt(this.carX * 0.3, 1.1, -16);
    this.camera.rotateZ(clamp(-this.vxLean * 0.004, -0.06, 0.06));
    const targetFov = this.fovBase + clamp(this.speed - BASE_SPEED, 0, 25) * 0.45 + (this.boost > 0 ? 10 : 0);
    this.camera.fov = lerp(this.camera.fov, targetFov, 1 - Math.exp(-4 * dt));
    this.camera.updateProjectionMatrix();
    this.sun.position.set(this.carX + 8, 20, 9);
    this.sun.target.position.set(this.carX, 0, -6);
    this.headlight.position.set(this.carX, 1.2, -4);
    this.backdrop.position.set(this.carX * 0.6, 0, 0);
  }

  _environment() {
    const phase = (this.dist / 2600) % 1;
    const f = phase * DAY.length;
    const i = Math.floor(f) % DAY.length;
    const j = (i + 1) % DAY.length;
    const t = f - Math.floor(f);
    const A = DAY[i];
    const B = DAY[j];
    this.tmpA.setHex(A.sky).lerp(this.tmpB.setHex(B.sky), t);
    this.scene.background.copy(this.tmpA);
    this.tmpA.setHex(A.fog).lerp(this.tmpB.setHex(B.fog), t);
    this.scene.fog.color.copy(this.tmpA);
    const sun = lerp(A.sun, B.sun, t);
    this.sun.intensity = sun;
    this.hemi.intensity = lerp(A.hemi, B.hemi, t);
    const night = clamp(1 - sun / 1.2, 0, 1);
    this.headlight.intensity = night * 14;
    this.cloudMat.color.setHex(0xffffff).lerp(this.tmpB.setHex(0x6a5a96), night);
    this.sunDisc.material.opacity = clamp(1.1 - night * 1.4, 0, 0.9);
  }
}

function std2(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
}
