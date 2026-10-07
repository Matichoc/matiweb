// Saltos de Porristas 3D: tu Matichica rebota en una rebotadora (trampolín) sobre el
// escenario del gimnasio. Mueve la rebotadora para que quede justo debajo cada vez que
// cae; rebotar centrado suma combo (¡y hace volteretas!), los pompones dan puntos extra.
// Si cae fuera de la rebotadora, se acaba la partida. Las reglas son las de siempre.

import { THREE, Game3D, clamp, lerp, rand, canvasTexture, roundedBox, makeBunting, makeStars } from "./three-kit.js";
import { createMatichico } from "./matichico3d.js";
import { saveProgress, earnCoins } from "./storage.js";
import * as audio from "./audio.js";

const GAME_ID = "porristas";
const PX_W = 800;
const GRAVITY = 900;
const BASE_BOUNCE = 560;
const PADDLE_Y = 420;
const PADDLE_SPEED = 300;
const PADDLE_BASE_W = 110;
const PADDLE_MIN_W = 70;
const U = 0.0195; // unidades 3D por píxel de la versión 2D
const wx = (px) => (px - PX_W / 2) * U;
const wy = (py) => (PADDLE_Y - py) * U + 0.62; // 0.62 = altura de la rebotadora

export class Porristas3DGame extends Game3D {
  constructor(character, progress, els) {
    super(GAME_ID, character, progress, els, { fov: 40 });
    this.keys = {};
    this.pointerX = null;
    this.dip = 0;
    this.cheer = 0;
    this.flipT = 0;
  }

  // ---------- escena ----------

  async build() {
    const s = this.scene;
    s.background = new THREE.Color(0x1e0f2a);
    s.fog = new THREE.Fog(0x1e0f2a, 30, 70);
    s.add(new THREE.HemisphereLight(0xffe9f2, 0x5a2a40, 1.15));
    this.key = new THREE.DirectionalLight(0xfff0d2, 2.2);
    this.key.position.set(-5, 14, 12);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(this.coarse ? 1024 : 2048, this.coarse ? 1024 : 2048);
    const sc = this.key.shadow.camera;
    sc.left = -12; sc.right = 12; sc.top = 12; sc.bottom = -4; sc.near = 2; sc.far = 40;
    this.key.shadow.bias = -0.0005;
    this.key.shadow.normalBias = 0.04;
    s.add(this.key, this.key.target);
    this.key.target.position.set(0, 3, 0);
    this.onLowQuality = () => { this.key.castShadow = false; };
    // focos de escenario
    this.spots = [];
    for (const [x, c] of [[-6, 0xd4216c], [0, 0xffc800], [6, 0xcfd767]]) {
      const sp = new THREE.SpotLight(c, 90, 40, 0.32, 0.6, 1.2);
      sp.position.set(x, 14, 6);
      sp.target.position.set(x * 0.3, 1, 0);
      s.add(sp, sp.target);
      this.spots.push(sp);
    }

    this.m = {
      pink: new THREE.MeshStandardMaterial({ color: 0xd4216c, roughness: 0.4 }),
      gold: new THREE.MeshStandardMaterial({ color: 0xffc800, roughness: 0.25, metalness: 0.7, emissive: 0x6a4a00, emissiveIntensity: 0.4 }),
      cream: new THREE.MeshStandardMaterial({ color: 0xfff6e6, roughness: 0.5 }),
      steel: new THREE.MeshStandardMaterial({ color: 0xcfcfd4, roughness: 0.25, metalness: 0.85 }),
    };

    this._buildStage();
    this._buildTrampoline();
    this._buildPompoms();
    this._ensureHero();
  }

  _buildStage() {
    const s = this.scene;
    // piso del escenario brillante
    const floorTex = canvasTexture(1024, 512, (g, w, h) => {
      g.fillStyle = "#3a1a0e"; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 16; i++) {
        g.fillStyle = i % 2 ? "#4a2414" : "#52291a";
        g.fillRect((i * w) / 16, 0, w / 16 + 1, h);
      }
      g.fillStyle = "rgba(255,200,0,0.9)";
      g.font = '70px "Baby Chipmunk", sans-serif';
      g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText("MATICHOC", w / 2, h / 2);
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(36, 16), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.28, metalness: 0.25 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 2);
    floor.receiveShadow = true;
    s.add(floor);
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(80, 60), new THREE.MeshStandardMaterial({ color: 0x2a120a, roughness: 0.4, metalness: 0.2 }));
    apron.rotation.x = -Math.PI / 2;
    apron.position.set(0, -0.01, 30);
    apron.receiveShadow = true;
    s.add(apron);

    // cortina del fondo
    const curtain = new THREE.Mesh(
      new THREE.PlaneGeometry(44, 22),
      new THREE.MeshStandardMaterial({
        map: canvasTexture(1024, 512, (g, w, h) => {
          const grad = g.createLinearGradient(0, 0, 0, h);
          grad.addColorStop(0, "#7d1445"); grad.addColorStop(1, "#3a0a22");
          g.fillStyle = grad; g.fillRect(0, 0, w, h);
          for (let i = 0; i < 40; i++) {
            g.fillStyle = i % 2 ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.07)";
            g.fillRect((i * w) / 40, 0, w / 40, h);
          }
        }),
        roughness: 0.9,
      }),
    );
    curtain.position.set(0, 10, -5);
    s.add(curtain);

    // letras luminosas
    const word = new THREE.Mesh(
      new THREE.PlaneGeometry(11, 1.9),
      new THREE.MeshBasicMaterial({
        transparent: true,
        map: canvasTexture(1400, 240, (g, w, h) => {
          g.font = '150px "Baby Chipmunk", sans-serif'; g.letterSpacing = '6px';
          g.textAlign = "center"; g.textBaseline = "middle";
          g.shadowColor = "#FFC800"; g.shadowBlur = 36; g.fillStyle = "#FFC800";
          g.fillText("LA LIGA CHEER", w / 2, h / 2 + 10);
        }),
      }),
    );
    word.position.set(0, 9.3, -4.8);
    s.add(word);
    s.add(makeBunting(new THREE.Vector3(-16, 13.5, -4.5), new THREE.Vector3(16, 13.5, -4.5), { count: 34, sag: 1.6, size: 0.65 }));
    s.add(makeStars(120, 50));

    // pompones gigantes decorativos a los lados + hinchada
    const palette = [0xd4216c, 0xffc800, 0xcfd767, 0xfff6e6, 0x2fa8d6];
    const crowdGeo = new THREE.BoxGeometry(0.7, 0.8, 0.5);
    const headGeo = new THREE.SphereGeometry(0.28, 10, 8);
    const n = 70;
    this.crowdBody = new THREE.InstancedMesh(crowdGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }), n);
    this.crowdHead = new THREE.InstancedMesh(headGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }), n);
    const skin = [0x64321b, 0x8a5a36, 0xc98a4b, 0xe0ab72];
    const col = new THREE.Color();
    this.crowd = [];
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / 24);
      const idx = i % 24;
      this.crowd.push({ x: -13.5 + idx * 1.18 + rand(-0.15, 0.15), z: -3.4 - row * 0.9, y: 0.4 + row * 0.55, phase: rand(0, 6.28) });
      this.crowdBody.setColorAt(i, col.setHex(palette[Math.floor(Math.random() * palette.length)]));
      this.crowdHead.setColorAt(i, col.setHex(skin[Math.floor(Math.random() * skin.length)]));
    }
    this.crowdBody.instanceColor.needsUpdate = true;
    this.crowdHead.instanceColor.needsUpdate = true;
    s.add(this.crowdBody, this.crowdHead);
    this._dummy = new THREE.Object3D();
    this._animateCrowd();
  }

  _animateCrowd() {
    const d = this._dummy;
    this.crowd.forEach((p, i) => {
      const bob = Math.max(0, Math.sin(this.time * 6 + p.phase)) * (0.05 + this.cheer * 0.4);
      d.position.set(p.x, p.y + bob, p.z);
      d.updateMatrix();
      this.crowdBody.setMatrixAt(i, d.matrix);
      d.position.y = p.y + 0.62 + bob;
      d.updateMatrix();
      this.crowdHead.setMatrixAt(i, d.matrix);
    });
    this.crowdBody.instanceMatrix.needsUpdate = true;
    this.crowdHead.instanceMatrix.needsUpdate = true;
  }

  _buildTrampoline() {
    // 1 unidad de ancho = 110 px (ancho base); se escala según el ancho de la rebotadora
    const g = new THREE.Group();
    const W = PADDLE_BASE_W * U;
    const D = 2.2;
    this.matGroup = new THREE.Group();
    const mat = new THREE.Mesh(roundedBox(W, 0.12, D, 0.1, 0.04), new THREE.MeshStandardMaterial({ color: 0x1c1c26, roughness: 0.7 }));
    mat.receiveShadow = true;
    const top = new THREE.Mesh(roundedBox(W - 0.3, 0.05, D - 0.3, 0.08, 0.02), new THREE.MeshStandardMaterial({ color: 0xfff6e6, roughness: 0.55 }));
    top.position.y = 0.075;
    top.receiveShadow = true;
    this.matGroup.add(mat, top);
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.5, 0.35), new THREE.MeshBasicMaterial({ color: 0xd4216c }));
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.y = 0.102;
    this.matGroup.add(stripe);
    this.matGroup.position.y = 0.5;
    // marco dorado
    const frame = new THREE.Mesh(roundedBox(W + 0.3, 0.22, D + 0.3, 0.15, 0.05), this.m.gold);
    frame.position.y = 0.36;
    frame.castShadow = true;
    // patas
    const legs = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.4, 10), this.m.pink);
      leg.position.set(sx * (W / 2 + 0.05), 0.2, sz * (D / 2 - 0.1));
      leg.castShadow = true;
      legs.push(leg);
    }
    // resortes
    this.springs = [];
    const sGeo = new THREE.TorusGeometry(0.07, 0.015, 6, 10);
    for (let i = 0; i < 8; i++) {
      const sp = new THREE.Mesh(sGeo, this.m.steel);
      sp.position.set(-W / 2 + ((i + 0.5) / 8) * W, 0.4, D / 2 + 0.1);
      sp.rotation.y = Math.PI / 2;
      g.add(sp);
      this.springs.push(sp);
    }
    g.add(this.matGroup, frame, ...legs);
    this.tramp = g;
    this.tramp.userData.W = W;
    this.scene.add(g);

    this.blob = new THREE.Mesh(new THREE.CircleGeometry(0.7, 22), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
    this.blob.rotation.x = -Math.PI / 2;
    this.blob.position.y = 0.66;
    this.scene.add(this.blob);
  }

  _fluffy(color, size, emissive = 0) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.8, flatShading: true, emissive: color, emissiveIntensity: emissive });
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(size * (i === 0 ? 1 : 0.7), 1), mat);
      if (i) m.position.set(rand(-1, 1) * size * 0.5, rand(-1, 1) * size * 0.5, rand(-1, 1) * size * 0.5);
      m.castShadow = true;
      g.add(m);
    }
    return g;
  }

  _buildPompoms() {
    this.pompomMesh = new THREE.Group();
    this.pompomMesh.visible = false;
    this.pomNormal = this._fluffy(0xd4216c, 0.38, 0.25);
    this.pomGold = this._fluffy(0xffc800, 0.38, 0.8);
    this.pompomMesh.add(this.pomNormal, this.pomGold);
    this.pomLight = new THREE.PointLight(0xffc800, 0, 5);
    this.pompomMesh.add(this.pomLight);
    this.scene.add(this.pompomMesh);
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
    this.hero.group.scale.setScalar(1.45);
    // pompones en las manos
    this.hero.arms.forEach((arm, i) => {
      const p = this._fluffy(i ? 0xffc800 : 0xd4216c, 0.14, 0.3);
      p.position.set(0, -0.3, 0);
      arm.add(p);
    });
    this.hero.group.position.y = -0.95;
    this.heroPivot = new THREE.Group();
    this.heroPivot.add(this.hero.group);
    this.scene.add(this.heroPivot);
  }

  onResize(w, h) {
    const aspect = w / h;
    const vfov = THREE.MathUtils.degToRad(this.fov / 2);
    const needW = 15.8;
    const needH = 10.2;
    this.camDist = Math.max(needH / 2 / Math.tan(vfov), needW / 2 / (Math.tan(vfov) * aspect));
    this.camera.position.set(0, 4.3, this.camDist);
    this.camera.lookAt(0, aspect < 0.9 ? 4.9 : 3.55, 0);
  }

  // ---------- partida ----------

  reset() {
    this.score = 0;
    this.combo = 0;
    this.coinsEarned = 0;
    this.paddle = { x: PX_W / 2, w: PADDLE_BASE_W };
    this.pompom = null;
    this.pompomTimer = rand(3, 5);
    this.char = { x: PX_W / 2, y: 120, vx: rand(-60, 60), vy: 0 };
    this.dip = 0;
    this.cheer = 0;
    this.flipT = 0;
    this.flip = false;
    this.pointerX = null;
    this.keys = {};
    this.pompomMesh.visible = false;
    this._ensureHero();
    this._updateHud();
    this._sync(0);
  }

  _driftRange() { return Math.min(200, 60 + this.score * 4); }
  _bounceStrength() { return Math.min(720, BASE_BOUNCE + this.score * 4); }

  update(dt) {
    this.cheer = Math.max(0, this.cheer - dt * 0.8);
    this._animateCrowd();
    const wob = Math.sin(this.time * 0.9);
    this.spots.forEach((sp, i) => { sp.target.position.x = (i - 1) * 2 + wob * 2 * (i - 1 || 1); });

    if (this.state === "playing") {
      this.paddle.w = Math.max(PADDLE_MIN_W, PADDLE_BASE_W - this.score * 1.2);
      const halfW = this.paddle.w / 2;
      if (this.keys.left) this.paddle.x -= PADDLE_SPEED * dt;
      if (this.keys.right) this.paddle.x += PADDLE_SPEED * dt;
      if (this.pointerX != null && !this.keys.left && !this.keys.right) {
        const d = this.pointerX - this.paddle.x;
        this.paddle.x += clamp(d, -PADDLE_SPEED * 1.4 * dt, PADDLE_SPEED * 1.4 * dt);
      }
      this.paddle.x = clamp(this.paddle.x, 40 + halfW, PX_W - 40 - halfW);

      const c = this.char;
      c.vy += GRAVITY * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      if (c.x < 30 || c.x > PX_W - 30) c.vx *= -1;
      c.x = clamp(c.x, 30, PX_W - 30);

      this._updatePompom(dt);

      if (c.vy > 0 && c.y >= PADDLE_Y) {
        if (Math.abs(c.x - this.paddle.x) <= this.paddle.w / 2 + 14) this._onBounce();
        else this._onMiss();
      }
    }
    this._sync(dt);
  }

  _updatePompom(dt) {
    if (this.pompom) {
      const d = Math.hypot(this.pompom.x - this.char.x, this.pompom.y - this.char.y);
      if (d < 30) {
        const golden = this.pompom.golden;
        this.score += golden ? 15 : 5;
        if (golden) {
          earnCoins(this.progress, 10);
          this.coinsEarned += 10;
          saveProgress(this.progress);
        }
        audio.playBonusCollect();
        const at = new THREE.Vector3(wx(this.pompom.x), wy(this.pompom.y) + 0.8, 0.6);
        this.popups.add(at, golden ? "+10 🍫✨" : "+5", golden ? "coin" : "kill");
        this.particles.burst(new THREE.Vector3(wx(this.pompom.x), wy(this.pompom.y), 0.3), golden ? [0xffc800, 0xfff6e6] : [0xd4216c, 0xfff6e6], 22, 4.5, 0.9, 6, 1.2);
        this._updateHud();
        this.pompom = null;
        this.pompomTimer = rand(4, 7);
        return;
      }
      this.pompom.timer -= dt;
      if (this.pompom.timer <= 0) {
        this.pompom = null;
        this.pompomTimer = rand(3, 6);
      }
    } else {
      this.pompomTimer -= dt;
      if (this.pompomTimer <= 0) {
        this.pompom = { x: rand(80, PX_W - 80), y: rand(140, 260), timer: 5, golden: Math.random() < 0.25 };
      }
    }
  }

  _onBounce() {
    const c = this.char;
    c.y = PADDLE_Y;
    c.vy = -this._bounceStrength();
    const centered = Math.abs(c.x - this.paddle.x) <= this.paddle.w * 0.3;
    this.combo = centered ? this.combo + 1 : 0;
    const gained = 10 + (centered ? Math.min(this.combo * 2, 20) : 0);
    this.score += gained;
    c.vx = rand(-this._driftRange(), this._driftRange());
    audio.playBounce();
    this.dip = 1;
    this.flip = this.combo >= 2;
    const at = new THREE.Vector3(wx(c.x), wy(PADDLE_Y) + 1.4, 0.6);
    this.popups.add(at, this.combo >= 3 ? `x${this.combo} +${gained}` : `+${gained}`, this.combo >= 3 ? "combo" : "kill");
    this.particles.burst(new THREE.Vector3(wx(c.x), 0.75, 0.3), centered ? [0xffc800, 0xd4216c, 0xfff6e6] : [0xfff6e6], centered ? 14 : 6, 4, 0.6, 7, 1);
    if (this.combo >= 5 && this.combo % 5 === 0) this.cheer = 1;
    this._updateHud();
  }

  _onMiss() {
    audio.playLose();
    this.cheer = 0;
    this.finish(`Llegaste a ${this.score} puntos rebotando` + (this.coinsEarned > 0 ? `, ganando ${this.coinsEarned} monedas Dubai.` : "."));
  }

  _updateHud() {
    this.els.hudScore.textContent = String(this.score);
    this.els.hudCombo.textContent = String(this.combo);
    this.els.hudCoins.textContent = String(this.progress.coins);
  }

  // ---------- sincronizar 3D ----------

  _sync(dt) {
    const c = this.char;
    // rebotadora
    const sx = this.paddle.w / PADDLE_BASE_W;
    this.dip = Math.max(0, this.dip - dt * 4.5);
    const dipY = Math.sin(this.dip * Math.PI) * 0.22;
    this.tramp.position.x = wx(this.paddle.x);
    this.tramp.scale.x = sx;
    this.matGroup.position.y = 0.5 - dipY;
    this.springs.forEach((sp) => { sp.scale.y = 1 - dipY * 1.4; });
    // personaje
    const feet = wy(c.y);
    const rising = c.vy < 0;
    let squash = 1;
    if (this.dip > 0.4) squash = 0.82;
    this.heroPivot.position.set(wx(c.x), feet - dipY * 0.8 + 0.95, 0);
    this.heroPivot.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
    const B = this._bounceStrength();
    const t = clamp((c.vy + B) / (2 * B), 0, 1); // 0 = recién rebotó, 1 = por caer
    this.heroPivot.rotation.x = this.flip && this.state === "playing" ? -t * Math.PI * 2 : 0;
    this.hero.group.rotation.y = Math.sin(this.time * 2) * 0.1 + clamp(c.vx / 400, -0.5, 0.5);
    const mode = this.state === "gameover" ? "sad" : this.cheer > 0.2 ? "cheer" : rising || t < 0.85 ? "jump" : "cheer";
    this.hero.animate(this.time, mode, 1);
    // sombra
    const h = clamp((PADDLE_Y - c.y) * U, 0, 8);
    this.blob.position.set(wx(c.x), 0.68, 0);
    this.blob.scale.setScalar(clamp(1 - h / 9, 0.3, 1));
    this.blob.material.opacity = 0.35 * clamp(1 - h / 9, 0.2, 1);
    // pompón
    if (this.pompom) {
      this.pompomMesh.visible = true;
      this.pompomMesh.position.set(wx(this.pompom.x), wy(this.pompom.y) + Math.sin(this.time * 4) * 0.12, 0);
      this.pompomMesh.rotation.y += dt * 2;
      this.pomGold.visible = this.pompom.golden;
      this.pomNormal.visible = !this.pompom.golden;
      this.pomLight.intensity = this.pompom.golden ? 18 : 0;
      this.pompomMesh.scale.setScalar(this.pompom.timer < 1.2 ? 0.7 + Math.abs(Math.sin(this.time * 18)) * 0.3 : 1);
    } else {
      this.pompomMesh.visible = false;
    }
  }

  // ---------- entrada ----------

  async init() {
    const first = !this.ready;
    await super.init();
    if (first) this._bindInput();
  }

  _bindInput() {
    const setKey = (key, value) => {
      if (key === "ArrowLeft" || key === "a" || key === "A") this.keys.left = value;
      if (key === "ArrowRight" || key === "d" || key === "D") this.keys.right = value;
    };
    window.addEventListener("keydown", (e) => {
      if (!this.running) return;
      if (["ArrowLeft", "ArrowRight", "a", "A", "d", "D"].includes(e.key)) e.preventDefault();
      setKey(e.key, true);
    });
    window.addEventListener("keyup", (e) => setKey(e.key, false));

    const bindHold = (id, dir) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      const press = (e) => { e.preventDefault(); this.keys[dir] = true; this.pointerX = null; };
      const release = (e) => { e.preventDefault(); this.keys[dir] = false; };
      btn.addEventListener("pointerdown", press);
      btn.addEventListener("pointerup", release);
      btn.addEventListener("pointerleave", release);
      btn.addEventListener("pointercancel", release);
    };
    bindHold("porristas-btn-left", "left");
    bindHold("porristas-btn-right", "right");

    // arrastrar con el dedo / mouse sobre el escenario
    const cv = this.els.canvas;
    const toPx = (e) => {
      const r = cv.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width; // 0..1 en pantalla
      // proyecta con la cámara al plano z=0
      const v = new THREE.Vector3((nx * 2 - 1), 0, 0.5).unproject(this.camera);
      const dir = v.sub(this.camera.position).normalize();
      const k = -this.camera.position.z / dir.z;
      const wxPos = this.camera.position.x + dir.x * k;
      return wxPos / U + PX_W / 2;
    };
    let down = false;
    cv.addEventListener("pointerdown", (e) => { down = true; this.pointerX = toPx(e); });
    cv.addEventListener("pointermove", (e) => { if (down) this.pointerX = toPx(e); });
    const up = () => { down = false; this.pointerX = null; };
    cv.addEventListener("pointerup", up);
    cv.addEventListener("pointercancel", up);
    cv.addEventListener("pointerleave", up);
  }
}
