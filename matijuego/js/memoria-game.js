// Memoria Matichoc 3D: encuentra las parejas de productos reales de Matichoc.
// Cartas 3D con las fotos de los alfajores, bombas y cuchuflíes sobre la mesa de
// la feria; tu Matichico te anima. 4 niveles (6 a 12 parejas) con estrellas.

import { THREE, Game3D, clamp, lerp, rand, canvasTexture, roundedBox, makeBunting } from "./three-kit.js";
import { createMatichico } from "./matichico3d.js";
import { earnCoins, saveProgress } from "./storage.js";
import * as audio from "./audio.js";

const CARD_W = 0.95;
const CARD_H = 1.3;
const GAP_X = 1.2;
const GAP_Z = 1.6;
const LEVELS = [
  { pairs: 6, cols: 4, rows: 3 },
  { pairs: 8, cols: 4, rows: 4 },
  { pairs: 10, cols: 5, rows: 4 },
  { pairs: 12, cols: 6, rows: 4 },
];

const PRODUCTS = [
  { id: "alf-capuchino", name: "Capuchino", color: "#6b3d22" },
  { id: "alf-pie-limon", name: "Pie de limón", color: "#e0b400" },
  { id: "alf-maracuya", name: "Maracuyá", color: "#f7a600" },
  { id: "alf-naranja", name: "Naranja", color: "#f08a3c" },
  { id: "alf-frambuesa", name: "Frambuesa", color: "#d4216c" },
  { id: "alf-almendra", name: "Almendra", color: "#7a4a2a" },
  { id: "alf-tradicional", name: "Tradicional", color: "#64321b" },
  { id: "alf-menta", name: "Menta", color: "#2f9e6a" },
  { id: "alf-trufa", name: "Trufa", color: "#5a2d16" },
  { id: "bomba-dorada", name: "Bomba dorada", color: "#c99900" },
  { id: "bomba-choco", name: "Bomba choco", color: "#3d1f10" },
  { id: "cuchufli", name: "Cuchuflí", color: "#d9a463" },
];

function loadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export class MemoriaGame extends Game3D {
  constructor(character, progress, els) {
    super("memoria", character, progress, els, { fov: 42 });
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.levelIndex = 0;
    this.cards = [];
    this.hover = null;
  }

  // ---------- escena ----------

  async build() {
    const s = this.scene;
    s.background = new THREE.Color(0x4b2e2e);
    s.fog = new THREE.Fog(0x4b2e2e, 26, 60);

    const [logo, ...imgs] = await Promise.all([loadImage("assets/brand/logo-badge.png"), ...PRODUCTS.map((p) => loadImage(`assets/products/${p.id}.jpg`))]);
    this.logoImg = logo;
    this.frontTex = PRODUCTS.map((p, i) => this._frontTexture(p, imgs[i]));
    this.backTex = this._backTexture(logo);

    this.hemi = new THREE.HemisphereLight(0xfff0dc, 0x6a4a3a, 1.2);
    s.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff0d2, 2.2);
    this.sun.position.set(-6, 16, 8);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(this.coarse ? 1024 : 2048, this.coarse ? 1024 : 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -12; sc.right = 12; sc.top = 12; sc.bottom = -12; sc.near = 1; sc.far = 50;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.03;
    s.add(this.sun);
    this.onLowQuality = () => { this.sun.castShadow = false; };

    const std = (color, roughness = 0.7, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });

    // piso y mesa
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 60), std(0x3a2218, 0.9));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.8;
    floor.receiveShadow = true;
    s.add(floor);
    const table = new THREE.Mesh(roundedBox(17, 0.5, 11.5, 0.2, 0.06), std(0x8a5a36, 0.7));
    table.position.y = -0.27;
    table.castShadow = true;
    table.receiveShadow = true;
    s.add(table);
    const cloth = new THREE.Mesh(
      new THREE.PlaneGeometry(16.2, 10.7),
      new THREE.MeshStandardMaterial({ map: this._clothTexture(), roughness: 0.95 })
    );
    cloth.rotation.x = -Math.PI / 2;
    cloth.position.y = 0.0;
    cloth.receiveShadow = true;
    s.add(cloth);

    // fondo: panel café con el logo y banderines
    const wall = new THREE.Mesh(new THREE.BoxGeometry(46, 16, 0.6), std(0x4b2e2e, 0.9));
    wall.position.set(0, 6, -9.5);
    s.add(wall);
    const plate = new THREE.Mesh(new THREE.CircleGeometry(2.1, 36), std(0xffffff, 0.5));
    plate.position.set(0, 8.2, -9.1);
    s.add(plate);
    if (logo) {
      const logoTex = new THREE.CanvasTexture(logo);
      logoTex.colorSpace = THREE.SRGBColorSpace;
      const lg = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 3.46), new THREE.MeshBasicMaterial({ map: logoTex, transparent: true }));
      lg.position.set(0, 8.2, -9.05);
      s.add(lg);
    }
    s.add(makeBunting(new THREE.Vector3(-16, 11.4, -9), new THREE.Vector3(16, 11.4, -9), { count: 26, sag: 1.4, size: 0.42 }));
    s.add(makeBunting(new THREE.Vector3(-16, 10.2, -8.9), new THREE.Vector3(16, 10.2, -8.9), { count: 22, sag: 1.0, size: 0.34 }));

    // decoración: pilas de alfajores en las esquinas de la mesa
    for (const [x, z] of [[-7.3, -4.4], [7.3, -4.4], [-7.4, 4.5], [7.4, 4.5]]) {
      const stack = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const tex = this.frontTex[(i * 3 + Math.abs(Math.round(x))) % PRODUCTS.length];
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.16, 20), [std(0x8a5a36, 0.6), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }), std(0x8a5a36, 0.6)]);
        disc.position.y = 0.1 + i * 0.17;
        disc.rotation.y = i * 0.6;
        disc.castShadow = true;
        stack.add(disc);
      }
      stack.position.set(x, 0, z);
      s.add(stack);
    }

    this.mascotRoot = new THREE.Group();
    s.add(this.mascotRoot);
    this.cardGeo = new THREE.BoxGeometry(CARD_W, 0.06, CARD_H);
    this.sideMat = std(0xfff6e6, 0.6);
    this.ringGeo = new THREE.RingGeometry(0.72, 0.82, 36);
    this._ensureMascot();
  }

  _clothTexture() {
    return canvasTexture(512, 340, (g, w, h) => {
      g.fillStyle = "#fff1dc";
      g.fillRect(0, 0, w, h);
      g.fillStyle = "rgba(212,33,108,0.9)";
      g.fillRect(0, 0, w, 16);
      g.fillRect(0, h - 16, w, 16);
      g.fillRect(0, 0, 16, h);
      g.fillRect(w - 16, 0, 16, h);
      g.fillStyle = "rgba(255,200,0,0.9)";
      g.fillRect(16, 16, w - 32, 6);
      g.fillRect(16, h - 22, w - 32, 6);
      g.fillStyle = "rgba(100,50,27,0.07)";
      for (let y = 40; y < h - 30; y += 44) {
        for (let x = 40 + ((y / 44) % 2) * 22; x < w - 30; x += 44) {
          g.beginPath();
          g.ellipse(x, y, 7, 11, 0.6, 0, Math.PI * 2);
          g.fill();
        }
      }
    });
  }

  _backTexture(logo) {
    return canvasTexture(256, 352, (g, w, h) => {
      const grd = g.createLinearGradient(0, 0, w, h);
      grd.addColorStop(0, "#e83a85");
      grd.addColorStop(1, "#b81a5c");
      g.fillStyle = grd;
      g.fillRect(0, 0, w, h);
      g.strokeStyle = "#FFC800";
      g.lineWidth = 8;
      g.strokeRect(10, 10, w - 20, h - 20);
      g.strokeStyle = "rgba(255,255,255,0.18)";
      g.lineWidth = 3;
      for (let i = -h; i < w + h; i += 26) {
        g.beginPath();
        g.moveTo(i, 0);
        g.lineTo(i + h, h);
        g.stroke();
      }
      g.fillStyle = "#ffffff";
      g.beginPath();
      g.arc(w / 2, h / 2, 84, 0, Math.PI * 2);
      g.fill();
      if (logo) g.drawImage(logo, w / 2 - 66, h / 2 - 69, 132, 138);
    });
  }

  _frontTexture(prod, img) {
    return canvasTexture(256, 352, (g, w, h) => {
      g.fillStyle = "#fff6e6";
      g.fillRect(0, 0, w, h);
      g.strokeStyle = prod.color;
      g.lineWidth = 12;
      g.strokeRect(6, 6, w - 12, h - 12);
      g.save();
      g.beginPath();
      g.arc(w / 2, 150, 100, 0, Math.PI * 2);
      g.clip();
      if (img) g.drawImage(img, w / 2 - 100, 50, 200, 200);
      else {
        g.fillStyle = prod.color;
        g.fillRect(0, 0, w, h);
      }
      g.restore();
      g.strokeStyle = prod.color;
      g.lineWidth = 8;
      g.beginPath();
      g.arc(w / 2, 150, 100, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = prod.color;
      g.fillRect(24, 272, w - 48, 52);
      g.fillStyle = "#ffffff";
      g.font = '30px "Baby Chipmunk", sans-serif';
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(prod.name, w / 2, 299, w - 64);
    });
  }

  _ensureMascot() {
    if (this.mascot && this.mascotId === this.character.id) {
      this.mascot.setOutfit(this.outfit);
      return;
    }
    if (this.mascot) this.mascotRoot.remove(this.mascot.group);
    this.mascot = createMatichico(this.character, this.outfit);
    this.mascotId = this.character.id;
    this.mascot.group.scale.setScalar(1.5);
    this.mascot.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.mascotRoot.add(this.mascot.group);
  }

  // ---------- partida ----------

  reset() {
    this.levelIndex = 0;
    this.totalScore = 0;
    this.score = 0;
    this.coinsEarned = 0;
    this.stars = [];
    this._ensureMascot();
    this._setupLevel();
  }

  onBegin() {
    this.timeRunning = false;
  }

  nextLevel() {
    this.levelIndex++;
    this.state = "playing";
    this.showOverlay(null);
    this._setupLevel();
  }

  _layout() {
    const lv = LEVELS[this.levelIndex];
    const portrait = this.camera.aspect < 0.95;
    return portrait ? { cols: lv.rows, rows: lv.cols } : { cols: lv.cols, rows: lv.rows };
  }

  _setupLevel() {
    for (const c of this.cards) this.scene.remove(c.mesh);
    this.cards = [];
    this.hover = null;
    const lv = LEVELS[this.levelIndex];
    this.pairsTotal = lv.pairs;
    this.matched = 0;
    this.moves = 0;
    this.seconds = 0;
    this.timeRunning = false;
    this.combo = 0;
    this.levelScore = 0;
    this.first = null;
    this.second = null;
    this.busy = 0;
    this.mismatchTimer = 0;
    this.mascotMode = "idle";
    this.mascotTimer = 0;

    const picks = shuffle(PRODUCTS.map((_, i) => i)).slice(0, lv.pairs);
    const deck = shuffle([...picks, ...picks]);
    deck.forEach((pi, idx) => {
      const mats = [this.sideMat, this.sideMat, new THREE.MeshStandardMaterial({ map: this.backTex, roughness: 0.5 }), new THREE.MeshStandardMaterial({ map: this.frontTex[pi], roughness: 0.5 }), this.sideMat, this.sideMat];
      const mesh = new THREE.Mesh(this.cardGeo, mats);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.cards.push({ mesh, pi, idx, state: "down", flip: 0, target: 0, lift: 0, glow: 0, deal: -idx * 0.05, drop: 6, x: 0, z: 0, hop: 0 });
    });
    this._placeCards();
    this._fitCamera();
    this._updateHud();
  }

  _placeCards() {
    const { cols, rows } = this._layout();
    this.cols = cols;
    this.rows = rows;
    this.cards.forEach((c, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      c.x = (col - (cols - 1) / 2) * GAP_X;
      c.z = (row - (rows - 1) / 2) * GAP_Z + 0.35;
    });
    // mascota a un costado del tablero (o arriba si es vertical)
    const w = cols * GAP_X;
    const h = rows * GAP_Z;
    const portrait = this.camera.aspect < 0.95;
    this.mascotRoot.position.set(portrait ? -w / 2 + 0.8 : -(w / 2 + 1.5), 0, portrait ? -(h / 2 + 0.45) : -h / 2 + 0.2);
    this.mascotRoot.rotation.y = portrait ? 0.15 : 0.6;
  }

  onResize() {
    if (!this.cards || !this.cards.length) return;
    this._placeCards();
    this._fitCamera();
  }

  _fitCamera() {
    const portrait = this.camera.aspect < 0.95;
    const w = this.cols * GAP_X + (portrait ? 1.0 : 3.4);
    const h = this.rows * GAP_Z + (portrait ? 3.8 : 0.9);
    const tilt = THREE.MathUtils.degToRad(64);
    const vfov = THREE.MathUtils.degToRad(this.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.camera.aspect);
    const dW = w / 2 / Math.tan(hfov / 2);
    const dH = (h / 2) * Math.sin(tilt) / Math.tan(vfov / 2) + (h / 2) * Math.cos(tilt) * 0.6;
    const d = Math.max(dW, dH) * 1.04;
    this.camTarget = new THREE.Vector3(0, 0.4, 0.2);
    this.camera.position.set(0, this.camTarget.y + d * Math.sin(tilt), this.camTarget.z + d * Math.cos(tilt));
    this.camera.lookAt(this.camTarget);
  }

  // ---------- entrada ----------

  async init() {
    await super.init();
    const canvas = this.els.canvas;
    let down = null;
    canvas.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY }; });
    canvas.addEventListener("pointerup", (e) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      if (moved < 14) this._pick(e, true);
    });
    canvas.addEventListener("pointermove", (e) => {
      if (e.pointerType === "mouse") this._pick(e, false);
    });
    canvas.addEventListener("pointerleave", () => { this.hover = null; });
  }

  _pick(e, click) {
    if (this.state !== "playing") return;
    const r = this.els.canvas.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.cards.map((c) => c.mesh), false);
    const card = hits.length ? this.cards.find((c) => c.mesh === hits[0].object) : null;
    if (!click) {
      this.hover = card && card.state === "down" ? card : null;
      this.els.canvas.style.cursor = this.hover ? "pointer" : "default";
      return;
    }
    if (card) this._flip(card);
  }

  _flip(card) {
    if (card.state !== "down" || this.busy > 0 || this.second) return;
    if (!this.timeRunning) this.timeRunning = true;
    card.state = "up";
    card.target = 1;
    audio.playJump();
    if (!this.first) {
      this.first = card;
    } else {
      this.second = card;
      this.moves++;
      if (this.first.pi === card.pi) {
        this.busy = 0.7;
        this.resolveTimer = 0.55;
        this.resolution = "match";
      } else {
        this.busy = 1.1;
        this.resolveTimer = 0.95;
        this.resolution = "miss";
      }
      this._updateHud();
    }
  }

  // ---------- bucle ----------

  update(dt) {
    const playing = this.state === "playing";
    if (playing && this.timeRunning) {
      this.seconds += dt;
      this._updateHud();
    }
    if (this.busy > 0) this.busy -= dt;
    if (this.second && this.resolveTimer !== undefined) {
      this.resolveTimer -= dt;
      if (this.resolveTimer <= 0) this._resolve();
    }

    for (const c of this.cards) {
      if (c.deal < 0) c.deal += dt;
      const dealing = c.deal < 0;
      c.drop = lerp(c.drop, dealing ? 6 : 0, 1 - Math.exp(-9 * dt));
      c.flip = lerp(c.flip, c.target, 1 - Math.exp(-11 * dt));
      const arc = Math.sin(clamp(c.flip, 0, 1) * Math.PI);
      c.hop = Math.max(0, c.hop - dt * 3);
      const hover = this.hover === c ? 0.22 : 0;
      c.lift = lerp(c.lift, hover + arc * 0.9 + (c.state === "matched" ? Math.sin(c.hop * Math.PI) * 0.5 : 0), 1 - Math.exp(-14 * dt));
      c.mesh.position.set(c.x, 0.05 + c.lift + c.drop, c.z);
      c.mesh.rotation.set(c.flip * Math.PI, 0, arc * 0.12);
      if (c.shake) {
        c.shake = Math.max(0, c.shake - dt * 3);
        c.mesh.rotation.y = Math.sin(this.time * 40) * 0.12 * c.shake;
      }
      if (c.state === "matched") {
        c.glow = lerp(c.glow, 1, 1 - Math.exp(-8 * dt));
        for (const m of c.mesh.material) if (m.emissive) m.emissive.setRGB(0.2 * c.glow, 0.15 * c.glow, 0.02 * c.glow);
      }
    }

    // mascota
    if (this.mascotTimer > 0) {
      this.mascotTimer -= dt;
      if (this.mascotTimer <= 0) this.mascotMode = "idle";
    }
    this.mascot.animate(this.time, this.state === "win" || this.state === "gameover" ? "cheer" : this.mascotMode, 1);
    this.mascotRoot.position.y = Math.sin(this.time * 2) * 0.01;
  }

  _resolve() {
    const a = this.first;
    const b = this.second;
    this.first = this.second = null;
    this.resolveTimer = undefined;
    if (this.resolution === "match") {
      a.state = b.state = "matched";
      a.hop = b.hop = 1;
      this.matched++;
      this.combo++;
      const pts = 100 + this.combo * 20;
      this.levelScore += pts;
      const at = new THREE.Vector3((a.x + b.x) / 2, 1.4, (a.z + b.z) / 2);
      this.popups.add(at, this.combo > 1 ? `¡Pareja! x${this.combo}` : "¡Pareja!", this.combo > 1 ? "combo" : "head");
      this.particles.burst(new THREE.Vector3(a.x, 0.8, a.z), [0xd4216c, 0xffc800, 0xcfd767, 0xfff6e6], 14, 4, 0.9, 6);
      this.particles.burst(new THREE.Vector3(b.x, 0.8, b.z), [0xd4216c, 0xffc800, 0xcfd767, 0xfff6e6], 14, 4, 0.9, 6);
      audio.playCollect();
      this.mascotMode = "cheer";
      this.mascotTimer = 1.1;
      this._updateHud();
      if (this.matched >= this.pairsTotal) this._levelDone();
    } else {
      a.target = b.target = 0;
      a.state = b.state = "down";
      a.shake = b.shake = 1;
      this.combo = 0;
      audio.playBump();
      this.mascotMode = "sad";
      this.mascotTimer = 1.0;
      this._updateHud();
    }
  }

  _levelDone() {
    this.timeRunning = false;
    const pairs = this.pairsTotal;
    const stars = this.moves <= pairs + 2 ? 3 : this.moves <= Math.ceil(pairs * 1.6) ? 2 : 1;
    const timeBonus = Math.max(0, Math.round((pairs * 9 - this.seconds) * 4));
    const gained = this.levelScore + timeBonus + stars * 50;
    this.totalScore += gained;
    this.score = this.totalScore;
    this.stars.push(stars);
    let coins = 0;
    if (stars === 3) {
      coins = 2;
      earnCoins(this.progress, coins);
      this.coinsEarned += coins;
      saveProgress(this.progress);
    }
    this._updateHud();
    audio.playMissionComplete();
    const all = this.levelIndex >= LEVELS.length - 1;
    for (const c of this.cards) {
      this.particles.burst(new THREE.Vector3(c.x, 1, c.z), [0xd4216c, 0xffc800, 0xcfd767, 0xfff6e6], 4, 5, 1.1, 5);
    }
    if (all) {
      audio.playVictory();
      this.finish(
        `Completaste los ${LEVELS.length} niveles con ${this.stars.reduce((a, b) => a + b, 0)} estrellas y ${this.score} puntos` +
          (this.coinsEarned > 0 ? `, ganando ${this.coinsEarned} monedas Dubai.` : ".")
      );
      return;
    }
    this.state = "win";
    this.els.stars.innerHTML = [1, 2, 3].map((n) => `<span class="${n <= stars ? "on" : "off"}">★</span>`).join("");
    this.els.winTitle.textContent = `¡Nivel ${this.levelIndex + 1} completado!`;
    this.els.winText.textContent =
      `${this.moves} intentos en ${Math.round(this.seconds)} s: +${gained} puntos` + (coins ? ` y +${coins} monedas Dubai 🍫✨.` : ".");
    this.showOverlay("win");
  }

  _updateHud() {
    const e = this.els;
    if (this.state !== "win") this.score = this.totalScore + this.levelScore;
    e.hudLevel.textContent = String(this.levelIndex + 1);
    e.hudMoves.textContent = String(this.moves);
    const s = Math.floor(this.seconds);
    e.hudTime.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    e.hudScore.textContent = String(this.totalScore + (this.state === "win" ? 0 : this.levelScore));
    e.hudCoins.textContent = String(this.progress.coins);
  }
}
