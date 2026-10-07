// Autos de Chocolate 3D: carrera infinita por la ruta de Matichoc.
// Tres carriles, curvas suaves, banderines y letreros de la marca, alfajores de
// verdad como monedas y el nitro Matidubai. Tu Matichico maneja un auto hecho
// de barra de chocolate. El día pasa de mañana a noche mientras avanzas.

import { THREE, Game3D, clamp, lerp, rand, loadTexture, canvasTexture, roundedBox, makeBunting } from "./three-kit.js";
import { createMatichico } from "./matichico3d.js";
import { earnCoins, saveProgress } from "./storage.js";
import * as audio from "./audio.js";

const LANE_W = 2.7;
const LANES = [-LANE_W, 0, LANE_W];
const SEG_LEN = 8;
const SEG_COUNT = 34;
const AHEAD = SEG_LEN * SEG_COUNT;
const TREES = 72;
const BASE_SPEED = 19;
const MAX_SPEED = 44;

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
      road: std(0x4a3a36, 0.95),
      curbA: std(0xd4216c, 0.6),
      curbB: std(0xfff6e6, 0.6),
      dash: std(0xfff6e6, 0.7),
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

    this.obstacles = [];
    this.pickups = [];
  }

  _buildRoad() {
    this.segments = [];
    const grassGeo = new THREE.PlaneGeometry(140, SEG_LEN + 1.2);
    grassGeo.rotateX(-Math.PI / 2);
    const roadGeo = new THREE.PlaneGeometry(LANE_W * 3 + 0.6, SEG_LEN + 1.2);
    roadGeo.rotateX(-Math.PI / 2);
    const curbGeo = new THREE.BoxGeometry(0.55, 0.12, SEG_LEN + 1.2);
    const dashGeo = new THREE.BoxGeometry(0.16, 0.02, SEG_LEN * 0.45);
    for (let i = 0; i < SEG_COUNT; i++) {
      const g = new THREE.Group();
      const grass = new THREE.Mesh(grassGeo, this.m.grassA);
      grass.receiveShadow = true;
      const road = new THREE.Mesh(roadGeo, this.m.road);
      road.position.y = 0.02;
      road.receiveShadow = true;
      const curbL = new THREE.Mesh(curbGeo, this.m.curbA);
      const curbR = new THREE.Mesh(curbGeo, this.m.curbA);
      curbL.position.set(-(LANE_W * 1.5 + 0.55), 0.05, 0);
      curbR.position.set(LANE_W * 1.5 + 0.55, 0.05, 0);
      const d1 = new THREE.Mesh(dashGeo, this.m.dash);
      const d2 = new THREE.Mesh(dashGeo, this.m.dash);
      d1.position.set(-LANE_W / 2 - 0.0, 0.04, 0);
      d2.position.set(LANE_W / 2, 0.04, 0);
      g.add(grass, road, curbL, curbR, d1, d2);
      g.userData = { grass, curbL, curbR, d1, d2, k: -1 };
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
    const chassis = sh(new THREE.Mesh(roundedBox(1.7, 0.55, 3.3, 0.2, 0.05), this.m.brown));
    chassis.position.y = 0.58;
    car.add(chassis);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 3.1), this.m.gold);
    stripe.position.set(0, 0.87, 0);
    car.add(stripe);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const fender = sh(new THREE.Mesh(roundedBox(0.16, 0.34, 1.05, 0.06, 0.02), this.m.pink));
        fender.position.set(sx * 0.9, 0.62, sz * 1.0);
        car.add(fender);
      }
    }
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.04, 1.25), std2(0x3a2010));
    seat.position.set(0, 0.88, 0.35);
    car.add(seat);
    const rim = sh(new THREE.Mesh(roundedBox(1.35, 0.14, 1.55, 0.05, 0.02), this.m.pink));
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
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.36, 12), this.m.gold);
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
    const spoiler = sh(new THREE.Mesh(roundedBox(1.7, 0.07, 0.42, 0.03, 0.015), this.m.pink));
    spoiler.position.set(0, 1.28, 1.55);
    car.add(spoiler);
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.4, 0.07), this.m.gold);
      post.position.set(sx * 0.6, 1.08, 1.5);
      car.add(post);
    }
    const plate = new THREE.Mesh(new THREE.CircleGeometry(0.32, 20), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    plate.position.set(0, 0.62, 1.67);
    const logo = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.52), new THREE.MeshBasicMaterial({ map: this.logoTex, transparent: true }));
    logo.position.set(0, 0.62, 1.675);
    car.add(plate, logo);

    this.car = car;
    this.scene.add(car);
    this._ensureDriver();
  }

  _ensureDriver() {
    if (this.driver && this.driverId === this.character.id) {
      this.driver.setOutfit(this.outfit);
      return;
    }
    if (this.driver) this.car.remove(this.driver.group);
    this.driver = createMatichico(this.character, this.outfit);
    this.driverId = this.character.id;
    this.driver.group.scale.setScalar(0.62);
    this.driver.group.position.set(0, 0.72, 0.4);
    this.driver.group.rotation.y = Math.PI;
    this.driver.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.car.add(this.driver.group);
  }

  // ---------- partida ----------

  reset() {
    for (const o of this.obstacles) this.scene.remove(o.mesh);
    for (const o of this.pickups) this.scene.remove(o.mesh);
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
    this.curvNow = lerp(this.curvNow, this.curv(), 1 - Math.exp(-2 * dt));

    // carril
    const targetX = LANES[this.laneIndex];
    const prevX = this.carX;
    this.carX = lerp(this.carX, targetX, 1 - Math.exp(-13 * dt));
    const vx = (this.carX - prevX) / Math.max(dt, 0.0001);

    this._updateRoad();
    this._updateTrees();
    this._updateArches();

    if (playing) {
      this._spawn();
      this._updateObjects(dt);
      this.score = Math.floor(this.dist / 4) + this.bonus;
      if (this.boost > 0) this.boost -= dt;
      if (this.invuln > 0) this.invuln -= dt;
      this.shake = Math.max(0, this.shake - dt * 3);
      this._updateHud();
    }

    // auto
    this.car.position.set(this.carX, 0, 0);
    this.car.rotation.y = clamp(-vx * 0.03, -0.35, 0.35);
    this.car.rotation.z = clamp(-vx * 0.012, -0.12, 0.12);
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
      const r = Math.random();
      const lanes = [0, 1, 2];
      if (r < 0.42) {
        this._addObstacle(lanes.filter((l) => l !== free)[Math.floor(Math.random() * 2)], this.nextRow);
      } else if (r < 0.42 + 0.3 + diff * 0.2) {
        for (const l of lanes) if (l !== free) this._addObstacle(l, this.nextRow);
      }
      const q = Math.random();
      if (q < 0.5) {
        for (let i = 0; i < 5; i++) this._addPickup("alfajor", free, this.nextRow + i * 4.2);
      } else if (q < 0.55 && this.dist > 300) {
        this._addPickup("nitro", free, this.nextRow + 6);
      }
      this.nextRow += lerp(30, 15, diff) * rand(0.85, 1.15);
    }
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
    mesh.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
    this.scene.add(mesh);
    this.obstacles.push({ mesh, lane, d, hit: false });
  }

  _addPickup(kind, lane, d) {
    let mesh;
    if (kind === "alfajor") {
      const top = new THREE.MeshStandardMaterial({ map: this.textures[Math.floor(Math.random() * this.textures.length)], roughness: 0.5 });
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 26), [this.m.cream, top, this.m.cream]);
      disc.rotation.x = Math.PI / 2;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.05, 8, 26), this.m.gold);
      rim.position.z = 0.03;
      mesh = new THREE.Group();
      mesh.add(disc, rim);
    } else {
      mesh = new THREE.Group();
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.2), this.m.gold);
      const pis = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.34, 0.05), new THREE.MeshStandardMaterial({ color: 0xcfd767, roughness: 0.4 }));
      pis.position.z = 0.12;
      mesh.add(bar, pis);
      mesh.scale.setScalar(1.3);
    }
    this.scene.add(mesh);
    this.pickups.push({ mesh, kind, lane, d, taken: false });
  }

  _updateObjects(dt) {
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i];
      const a = o.d - this.dist;
      if (a < -12) {
        this.scene.remove(o.mesh);
        this.obstacles.splice(i, 1);
        continue;
      }
      o.mesh.position.set(this.bend(a) + LANES[o.lane], 0, -a);
      o.mesh.rotation.y = -Math.atan(2 * this.curvNow * a);
      if (!o.hit && a < 1.6 && a > -1.7 && Math.abs(LANES[o.lane] - this.carX) < 1.2) {
        o.hit = true;
        this._crash(o);
      }
    }
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const k = this.pickups[i];
      const a = k.d - this.dist;
      if (a < -12 || k.taken) {
        this.scene.remove(k.mesh);
        this.pickups.splice(i, 1);
        continue;
      }
      k.mesh.position.set(this.bend(a) + LANES[k.lane], 0.95 + Math.sin(this.time * 4 + k.d) * 0.08, -a);
      if (k.kind === "alfajor") k.mesh.rotation.y = Math.sin(this.time * 2.6 + k.d) * 0.7;
      else k.mesh.rotation.y += dt * 2.5;
      if (a < 1.5 && a > -1.5 && Math.abs(LANES[k.lane] - this.carX) < 1.35) this._collect(k);
    }
  }

  _collect(k) {
    k.taken = true;
    const at = this.car.position.clone();
    at.set(this.carX, 1.6, -0.5);
    this.headTurn = 0.7;
    if (k.kind === "alfajor") {
      this.items++;
      this.bonus += 10;
      if (this.time - this.lastPop > 0.35) {
        this.lastPop = this.time;
        this.popups.add(at, "+10", "kill");
      }
      this.particles.burst(at, [0xffc800, 0xfff6e6], 8, 3.5, 0.5, 4);
      audio.playCollect();
    } else {
      this.boost = 3.2;
      this.bonus += 60;
      earnCoins(this.progress, 2);
      this.coinsEarned += 2;
      saveProgress(this.progress);
      this.popups.add(at, "¡Nitro! +2 🍫✨", "combo");
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
    this.hearts--;
    this.invuln = 1.7;
    this.shake = 1;
    this.speed *= 0.55;
    audio.playHurt();
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
      `Recorriste ${Math.floor(this.dist)} metros, juntaste ${this.items} alfajores y sumaste ${this.score} puntos` +
        (this.coinsEarned > 0 ? `, ganando ${this.coinsEarned} monedas Dubai.` : ".")
    );
  }

  _updateHud() {
    this.els.hudScore.textContent = String(this.score);
    this.els.hudSpeed.textContent = `${Math.round(this.speed * 4)} km/h`;
    this.els.hudHearts.textContent = "❤".repeat(Math.max(0, this.hearts)) + "♡".repeat(Math.max(0, 3 - this.hearts));
    this.els.hudCoins.textContent = String(this.progress.coins);
  }

  // ---------- cámara y ambiente ----------

  _placeCamera(dt) {
    const sh = this.shake * 0.12;
    this.camera.position.set(
      this.carX * 0.62 + (Math.random() - 0.5) * sh,
      3.5 + (Math.random() - 0.5) * sh,
      7.4 + (this.boost > 0 ? 0.8 : 0)
    );
    this.camera.lookAt(this.carX * 0.3, 1.1, -16);
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
