// Motor de "Choco Blaster 3D": propuesta de juego en primera persona (Three.js).
// Disparas chocolate con el Choco Blaster a malvaviscos traviesos que se
// acercan por oleadas. Sin violencia: cada impacto los baña de chocolate y al
// completar el baño estallan en confeti. Ver docs/PROPUESTA-3D.md.

import * as THREE from "../vendor/three.module.min.js";
import { buildWorld, rayAabb, ARENA_HALF } from "./fps-world.js";
import { createEnemy, applyChocolate, hitSpheres, animateEnemy } from "./fps-enemies.js";
import { getOutfit } from "./characters.js";
import { saveProgress, addToLeaderboard, equippedOutfitId, reportScore, earnCoins } from "./storage.js";
import * as audio from "./audio.js";

const GAME_ID = "fps3d";
const EYE = 1.65;
const PLAYER_R = 0.4;
const MAG = 12;
const FIRE_DELAY = 0.17;
const RELOAD_TIME = 1.1;
const MAX_HEARTS = 5;
const START_HEARTS = 3;
const LOOK_SENS = 0.0022;
const TOUCH_LOOK_SENS = 0.0052;
const COMBO_WINDOW = 3.2;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function raySphere(o, d, s) {
  const ox = o.x - s.x;
  const oy = o.y - s.y;
  const oz = o.z - s.z;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const c = ox * ox + oy * oy + oz * oz - s.r * s.r;
  const disc = b * b - c;
  if (disc < 0) return Infinity;
  const sq = Math.sqrt(disc);
  const t = -b - sq;
  if (t >= 0) return t;
  return -b + sq >= 0 ? 0 : Infinity;
}

export class FpsGame {
  constructor(character, progress, els) {
    this.character = character;
    this.progress = progress;
    this.els = els;

    this.ready = false;
    this.running = false;
    this.state = "intro"; // intro | playing | paused | gameover
    this.time = 0;
    this.lastTs = null;
    this.keys = {};
    this.fireHeld = false;
    this.locked = false;
    this.touchMove = { x: 0, y: 0 };
    this.enemies = [];
    this.particles = [];
    this.tracers = [];
    this.popups = [];
    this.pos = new THREE.Vector3(0, 0, 13);
    this.coarse = window.matchMedia("(pointer: coarse)").matches;
    this.frameTimes = [];
    this.qualityStep = 0;
  }

  get outfit() {
    return getOutfit(equippedOutfitId(this.progress, this.character.id));
  }

  async init() {
    if (this.ready) return;
    const { canvas } = this.els;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !this.coarse, powerPreference: "high-performance" });
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, this.coarse ? 1.25 : 1.75);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.world = await buildWorld(THREE, { tier: this.coarse ? "medium" : "high" });
    this.scene = this.world.scene;

    this.camera = new THREE.PerspectiveCamera(78, 1.6, 0.05, 500);
    this.camera.rotation.order = "YXZ";
    this.scene.add(this.camera);

    this._buildWeapon();
    this._buildPools();
    this._bindInput();
    this._bindTouch();

    this._resize = this._resize.bind(this);
    new ResizeObserver(this._resize).observe(this.els.wrap);
    this._resize();

    this._loop = this._loop.bind(this);
    this.ready = true;
  }

  _resize() {
    const w = Math.max(1, this.els.wrap.clientWidth);
    const h = Math.max(1, this.els.wrap.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this._fitWeapon();
  }

  // En pantallas angostas (celular vertical) el arma se achica y se acerca al centro para no salirse.
  _fitWeapon() {
    if (!this.weapon) return;
    const k = Math.min(1, Math.max(0.4, this.camera.aspect / 1.6));
    this.weaponBase.x = 0.17 * k;
    this.weapon.scale.setScalar(0.46 * (0.62 + 0.38 * k));
  }

  // ---------- arma en primera persona ----------

  _buildWeapon() {
    const w = new THREE.Group();
    const brown = new THREE.MeshStandardMaterial({ color: 0x64321b, roughness: 0.45 });
    this.stripeMat = new THREE.MeshStandardMaterial({ color: 0xd4216c, roughness: 0.4 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xffc800, roughness: 0.25, metalness: 0.6 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.17, 0.5), brown);
    w.add(body);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.156, 0.05, 0.36), this.stripeMat);
    stripe.position.set(0, 0.02, 0.02);
    w.add(stripe);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.055, 0.34, 12), gold);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, -0.4);
    w.add(barrel);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.052, 12, 10), new THREE.MeshBasicMaterial({ color: 0xff5fa2 }));
    tip.position.set(0, 0.02, -0.58);
    w.add(tip);
    const hopper = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.17, 0.22), brown);
    hopper.position.set(0, 0.17, 0.02);
    w.add(hopper);
    for (const dz of [-0.06, 0.06]) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.124, 0.02, 0.02), gold);
      line.position.set(0, 0.2, 0.02 + dz);
      w.add(line);
    }
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.2, 0.09), brown);
    grip.position.set(0, -0.16, 0.14);
    grip.rotation.x = 0.25;
    w.add(grip);

    this.handMat = new THREE.MeshStandardMaterial({ color: 0x6b3d22, roughness: 0.6 });
    const handR = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), this.handMat);
    handR.position.set(0, -0.25, 0.16);
    w.add(handR);
    const handL = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), this.handMat);
    handL.position.set(-0.03, -0.09, -0.2);
    w.add(handL);

    const flashCanvas = document.createElement("canvas");
    flashCanvas.width = flashCanvas.height = 64;
    const g = flashCanvas.getContext("2d");
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,240,180,1)");
    grad.addColorStop(0.4, "rgba(255,160,60,0.8)");
    grad.addColorStop(1, "rgba(255,120,40,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    this.flash = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(flashCanvas), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })
    );
    this.flash.scale.setScalar(0.35);
    this.flash.position.set(0, 0.02, -0.7);
    this.flash.visible = false;
    w.add(this.flash);

    w.traverse((o) => {
      if (o.isMesh) o.castShadow = false;
    });
    w.scale.setScalar(0.46);
    this.weaponBase = new THREE.Vector3(0.17, -0.19, -0.4);
    w.position.copy(this.weaponBase);
    this.weapon = w;
    this.camera.add(w);
    this._fitWeapon();
  }

  _applyOutfit() {
    this.stripeMat.color.set(this.outfit.jersey);
    this.handMat.color.set(this.character.choco);
  }

  _buildPools() {
    this.partGeo = new THREE.SphereGeometry(0.07, 6, 5);
    this.partMats = new Map();
    this.partPool = [];
    for (let i = 0; i < 220; i++) {
      const m = new THREE.Mesh(this.partGeo, this._partMat(0xffffff));
      m.visible = false;
      this.scene.add(m);
      this.partPool.push(m);
    }
    this.tracerGeo = new THREE.CylinderGeometry(0.014, 0.014, 1, 5);
    this.tracerGeo.translate(0, 0.5, 0);
    this.tracerMat = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true });
    this.tracerPool = [];
    for (let i = 0; i < 10; i++) {
      const t = new THREE.Mesh(this.tracerGeo, this.tracerMat.clone());
      t.visible = false;
      this.scene.add(t);
      this.tracerPool.push(t);
    }
  }

  _partMat(hex) {
    if (!this.partMats.has(hex)) this.partMats.set(hex, new THREE.MeshBasicMaterial({ color: hex }));
    return this.partMats.get(hex);
  }

  _burst(p, colors, count, speed, life = 0.7, gravity = 9) {
    for (let i = 0; i < count; i++) {
      const m = this.partPool.find((q) => !q.visible);
      if (!m) return;
      m.material = this._partMat(colors[Math.floor(Math.random() * colors.length)]);
      m.position.copy(p);
      m.visible = true;
      m.scale.setScalar(0.6 + Math.random() * 0.9);
      const a = Math.random() * Math.PI * 2;
      const e = Math.random() * 1.2 - 0.2;
      m.userData = {
        vx: Math.cos(a) * speed * (0.4 + Math.random()),
        vy: Math.sin(e) * speed + speed * 0.3,
        vz: Math.sin(a) * speed * (0.4 + Math.random()),
        life,
        max: life,
        gravity,
      };
      this.particles.push(m);
    }
  }

  _updateParticles(dt) {
    for (const m of this.particles) {
      const u = m.userData;
      u.life -= dt;
      u.vy -= u.gravity * dt;
      m.position.x += u.vx * dt;
      m.position.y += u.vy * dt;
      m.position.z += u.vz * dt;
      if (m.position.y < 0.03) {
        m.position.y = 0.03;
        u.vy *= -0.3;
        u.vx *= 0.7;
        u.vz *= 0.7;
      }
      if (u.life <= 0) m.visible = false;
      else m.scale.setScalar(Math.max(0.05, (u.life / u.max) * 1.2));
    }
    this.particles = this.particles.filter((m) => m.visible);
    for (const t of this.tracers) {
      t.life -= dt;
      t.mesh.material.opacity = Math.max(0, t.life / 0.09);
      if (t.life <= 0) t.mesh.visible = false;
    }
    this.tracers = this.tracers.filter((t) => t.mesh.visible);
  }

  _tracer(from, to) {
    const mesh = this.tracerPool.find((t) => !t.visible);
    if (!mesh) return;
    const dir = to.clone().sub(from);
    const len = dir.length();
    mesh.position.copy(from);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    mesh.scale.set(1, len, 1);
    mesh.visible = true;
    this.tracers.push({ mesh, life: 0.09 });
  }

  // ---------- entrada ----------

  _bindInput() {
    const map = { KeyW: "up", ArrowUp: "up", KeyS: "down", ArrowDown: "down", KeyA: "left", ArrowLeft: "left", KeyD: "right", ArrowRight: "right" };
    window.addEventListener("keydown", (e) => {
      if (!this.running || this.state !== "playing") return;
      if (map[e.code]) { this.keys[map[e.code]] = true; e.preventDefault(); }
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") this.keys.sprint = true;
      if (e.code === "Space") { this.keys.jump = true; e.preventDefault(); }
      if (e.code === "KeyR") this._startReload();
    });
    window.addEventListener("keyup", (e) => {
      if (map[e.code]) this.keys[map[e.code]] = false;
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") this.keys.sprint = false;
      if (e.code === "Space") this.keys.jump = false;
    });

    const { canvas } = this.els;
    canvas.addEventListener("mousedown", (e) => {
      if (!this.running || this.state !== "playing" || e.button !== 0) return;
      if (!this.locked && !this.coarse) {
        canvas.requestPointerLock?.();
        return;
      }
      this.fireHeld = true;
    });
    window.addEventListener("mouseup", () => { this.fireHeld = false; });
    window.addEventListener("mousemove", (e) => {
      if (!this.locked || this.state !== "playing") return;
      this.yaw -= e.movementX * LOOK_SENS;
      this.pitch = clamp(this.pitch - e.movementY * LOOK_SENS, -1.45, 1.45);
    });
    document.addEventListener("pointerlockchange", () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked && this.state === "playing" && !this.coarse) {
        this.fireHeld = false;
        this.state = "paused";
        this._showOverlay("paused");
      }
    });
  }

  _bindTouch() {
    const t = this.els.touch;
    if (!t) return;

    let joyId = null;
    let joyOrigin = null;
    t.joyZone.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      joyId = e.pointerId;
      joyOrigin = { x: e.clientX, y: e.clientY };
      t.joyZone.setPointerCapture(e.pointerId);
    });
    t.joyZone.addEventListener("pointermove", (e) => {
      if (e.pointerId !== joyId) return;
      const dx = clamp(e.clientX - joyOrigin.x, -50, 50);
      const dy = clamp(e.clientY - joyOrigin.y, -50, 50);
      this.touchMove.x = dx / 50;
      this.touchMove.y = dy / 50;
      t.joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    });
    const joyEnd = (e) => {
      if (e.pointerId !== joyId) return;
      joyId = null;
      this.touchMove.x = this.touchMove.y = 0;
      t.joyKnob.style.transform = "translate(0,0)";
    };
    t.joyZone.addEventListener("pointerup", joyEnd);
    t.joyZone.addEventListener("pointercancel", joyEnd);

    let lookId = null;
    let last = null;
    t.lookZone.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      lookId = e.pointerId;
      last = { x: e.clientX, y: e.clientY };
      t.lookZone.setPointerCapture(e.pointerId);
    });
    t.lookZone.addEventListener("pointermove", (e) => {
      if (e.pointerId !== lookId || this.state !== "playing") return;
      this.yaw -= (e.clientX - last.x) * TOUCH_LOOK_SENS;
      this.pitch = clamp(this.pitch - (e.clientY - last.y) * TOUCH_LOOK_SENS, -1.45, 1.45);
      last = { x: e.clientX, y: e.clientY };
    });
    const lookEnd = (e) => { if (e.pointerId === lookId) lookId = null; };
    t.lookZone.addEventListener("pointerup", lookEnd);
    t.lookZone.addEventListener("pointercancel", lookEnd);

    t.btnFire.addEventListener("pointerdown", (e) => { e.preventDefault(); this.fireHeld = true; });
    const fireEnd = () => { this.fireHeld = false; };
    t.btnFire.addEventListener("pointerup", fireEnd);
    t.btnFire.addEventListener("pointerleave", fireEnd);
    t.btnFire.addEventListener("pointercancel", fireEnd);
    t.btnJump.addEventListener("pointerdown", (e) => { e.preventDefault(); this.keys.jump = true; });
    t.btnJump.addEventListener("pointerup", () => { this.keys.jump = false; });
    t.btnReload.addEventListener("pointerdown", (e) => { e.preventDefault(); this._startReload(); });
  }

  // ---------- ciclo de vida ----------

  _showOverlay(name) {
    Object.entries(this.els.overlays).forEach(([key, el]) => el.classList.toggle("hidden", key !== name));
    if (!name) Object.values(this.els.overlays).forEach((el) => el.classList.add("hidden"));
  }

  _clearEnemies() {
    for (const e of this.enemies) this.scene.remove(e.group);
    this.enemies = [];
    for (const m of this.particles) m.visible = false;
    this.particles = [];
    for (const p of this.popups) p.el.remove();
    this.popups = [];
  }

  _resetRun() {
    this._clearEnemies();
    this._applyOutfit();
    this.pos.set(0, 0, 13);
    this.yaw = 0;
    this.pitch = 0;
    this.vy = 0;
    this.onGround = true;
    this.bob = 0;
    this.health = START_HEARTS;
    this.invuln = 0;
    this.ammo = MAG;
    this.reloading = 0;
    this.fireCd = 0;
    this.kick = 0;
    this.shake = 0;
    this.flashT = 0;
    this.score = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.kills = 0;
    this.heads = 0;
    this.coinsEarned = 0;
    this.wave = 0;
    this.waveState = { quota: 0, spawned: 0, spawnTimer: 0, goldenDone: false, intermission: 0 };
    this.fireHeld = false;
    this.keys = {};
    this.state = "intro";
    this.weapon.visible = false;
    this._updateHud();
    this._showOverlay("intro");
  }

  /** Lanza (o relanza, p. ej. tras cambiar de perfil) una partida con el personaje/progreso dados. */
  async startRun(character, progress) {
    this.character = character;
    if (progress) this.progress = progress;
    await this.init();
    this._resetRun();
    this.running = true;
    this.lastTs = null;
    requestAnimationFrame(this._loop);
  }

  beginPlaying() {
    if (this.state === "playing") return;
    this.state = "playing";
    this.weapon.visible = true;
    this._showOverlay(null);
    if (!this.coarse) this.els.canvas.requestPointerLock?.();
    if (this.wave === 0) this._startWave(1);
  }

  resume() {
    this.state = "playing";
    this._showOverlay(null);
    if (!this.coarse) this.els.canvas.requestPointerLock?.();
  }

  retry() {
    this._resetRun();
    this.beginPlaying();
  }

  pauseForMenu() {
    if (this.running) reportScore(this.progress, GAME_ID, this.score || 0);
    this.running = false;
    this.fireHeld = false;
    if (document.pointerLockElement === this.els.canvas) document.exitPointerLock();
    this.state = "paused";
  }

  // ---------- oleadas ----------

  _startWave(n) {
    this.wave = n;
    this.waveState = { quota: Math.min(40, 4 + 3 * n), spawned: 0, spawnTimer: 1.2, goldenDone: false, intermission: 0 };
    this._banner(`¡Oleada ${n}!`);
    audio.playWave();
    this._updateHud();
  }

  _completeWave() {
    const bonus = 150 * this.wave;
    this.score += bonus;
    this.health = Math.min(MAX_HEARTS, this.health + 1);
    this.ammo = MAG;
    this.reloading = 0;
    this._banner(`¡Oleada ${this.wave} superada!  +${bonus}`);
    audio.playMissionComplete();
    this.waveState.intermission = 3.6;
    this._updateHud();
  }

  _pickType() {
    const ws = this.waveState;
    if (this.wave >= 2 && !ws.goldenDone && ws.spawned >= Math.floor(ws.quota / 2)) {
      ws.goldenDone = true;
      return "dorado";
    }
    const r = Math.random();
    if (this.wave >= 3 && r < 0.14) return "grande";
    if (this.wave >= 2 && r < 0.38) return "rapido";
    return "normal";
  }

  _spawnEnemy() {
    const pts = this.world.spawnPoints;
    let p = pts[Math.floor(Math.random() * pts.length)];
    for (let i = 0; i < 8; i++) {
      const c = pts[Math.floor(Math.random() * pts.length)];
      if (Math.hypot(c.x - this.pos.x, c.z - this.pos.z) > 14) { p = c; break; }
    }
    const e = createEnemy(THREE, this._pickType());
    e.speed *= 1 + Math.min(0.5, this.wave * 0.04);
    e.group.position.set(p.x, 0, p.z);
    this.scene.add(e.group);
    this.enemies.push(e);
    this.waveState.spawned++;
  }

  _banner(text) {
    const el = this.els.banner;
    el.textContent = text;
    el.classList.remove("show");
    void el.offsetWidth;
    el.classList.add("show");
  }

  // ---------- colisiones ----------

  _resolveCircle(pos, r, y) {
    for (const o of this.world.obstacles) {
      if (y >= o.maxY - 0.05) continue;
      const cx = clamp(pos.x, o.minX, o.maxX);
      const cz = clamp(pos.z, o.minZ, o.maxZ);
      const dx = pos.x - cx;
      const dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        pos.x += (dx / d) * (r - d);
        pos.z += (dz / d) * (r - d);
      } else {
        const l = pos.x - o.minX;
        const rt = o.maxX - pos.x;
        const u = pos.z - o.minZ;
        const dn = o.maxZ - pos.z;
        const m = Math.min(l, rt, u, dn);
        if (m === l) pos.x = o.minX - r;
        else if (m === rt) pos.x = o.maxX + r;
        else if (m === u) pos.z = o.minZ - r;
        else pos.z = o.maxZ + r;
      }
    }
    const lim = ARENA_HALF - r;
    pos.x = clamp(pos.x, -lim, lim);
    pos.z = clamp(pos.z, -lim, lim);
  }

  _groundHeight(x, z, y) {
    let g = 0;
    for (const o of this.world.obstacles) {
      if (x > o.minX - 0.15 && x < o.maxX + 0.15 && z > o.minZ - 0.15 && z < o.maxZ + 0.15 && y >= o.maxY - 0.3) g = Math.max(g, o.maxY);
    }
    return g;
  }

  // ---------- bucle ----------

  _loop(ts) {
    if (!this.running) return;
    if (this.lastTs == null) this.lastTs = ts;
    const dt = Math.min(0.05, (ts - this.lastTs) / 1000);
    this.lastTs = ts;
    this.time += dt;

    this._adaptQuality(dt);
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this._loop);
  }

  _adaptQuality(dt) {
    if (this.qualityStep >= 2) return;
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 90) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes = [];
    if (avg <= 0.034) { this.qualityStep = 2; return; }
    this.qualityStep++;
    if (this.qualityStep === 1) {
      this.pixelRatio = Math.max(0.6, this.pixelRatio * 0.75);
      this.renderer.setPixelRatio(this.pixelRatio);
      this._resize();
    } else {
      this.world.sun.castShadow = false;
    }
  }

  update(dt) {
    this.world.update(dt, this.time, this.camera);
    this._updateParticles(dt);
    this._updatePopups(dt);

    if (this.state === "paused") return;
    if (this.state === "intro" || this.state === "gameover") {
      const a = this.time * 0.22;
      this.camera.position.set(Math.cos(a) * 17, 4.8, Math.sin(a) * 17);
      this.camera.lookAt(0, 1.8, 0);
      for (const e of this.enemies) animateEnemy(e, dt, false);
      return;
    }

    this._updatePlayer(dt);
    this._updateWeapon(dt);
    this._updateWaves(dt);
    this._updateEnemies(dt);

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) { this.combo = 0; this._updateHud(); }
    }
    if (this.invuln > 0) this.invuln -= dt;
    this.els.vignette.style.opacity = String(clamp(this.invuln / 1.4, 0, 1) * 0.85);
    if (this.health === 1) this.els.vignette.style.opacity = String(Math.max(parseFloat(this.els.vignette.style.opacity), 0.28 + Math.sin(this.time * 6) * 0.08));
  }

  _updatePlayer(dt) {
    let mx = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0) + this.touchMove.x;
    let mz = (this.keys.down ? 1 : 0) - (this.keys.up ? 1 : 0) + this.touchMove.y;
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    const speed = (this.keys.sprint ? 8.2 : 6) * (this.reloading > 0 ? 0.9 : 1);
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    this.pos.x += (mx * cos + mz * sin) * speed * dt;
    this.pos.z += (-mx * sin + mz * cos) * speed * dt;
    this._resolveCircle(this.pos, PLAYER_R, this.pos.y);

    if (this.keys.jump && this.onGround) {
      this.vy = 6.6;
      this.onGround = false;
    }
    this.vy -= 19 * dt;
    this.pos.y += this.vy * dt;
    const g = this._groundHeight(this.pos.x, this.pos.z, this.pos.y);
    if (this.pos.y <= g) {
      this.pos.y = g;
      this.vy = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }

    const moving = len > 0.1 && this.onGround;
    if (moving) this.bob += dt * speed * 1.6;
    this.moving = len > 0.1;
    const bobY = moving ? Math.sin(this.bob) * 0.035 : 0;

    this.shake = Math.max(0, this.shake - dt * 3.5);
    const sh = this.shake * 0.05;
    this.camera.position.set(
      this.pos.x + (Math.random() - 0.5) * sh,
      this.pos.y + EYE + bobY + (Math.random() - 0.5) * sh,
      this.pos.z + (Math.random() - 0.5) * sh
    );
    this.camera.rotation.set(this.pitch + this.kick * 0.012, this.yaw, 0);
  }

  _updateWeapon(dt) {
    this.fireCd -= dt;
    this.kick = Math.max(0, this.kick - dt * 6);
    if (this.flashT > 0) {
      this.flashT -= dt;
      if (this.flashT <= 0) this.flash.visible = false;
    }

    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) {
        this.ammo = MAG;
        this.reloading = 0;
        this._updateHud();
      }
    } else if (this.fireHeld && this.fireCd <= 0 && this.ammo > 0) {
      this._fire();
    } else if (this.ammo === 0) {
      this._startReload();
    }

    const dip = this.reloading > 0 ? Math.sin((1 - this.reloading / RELOAD_TIME) * Math.PI) : 0;
    const sway = this.moving ? Math.sin(this.bob * 1) * 0.012 : Math.sin(this.time * 1.6) * 0.004;
    this.weapon.position.set(
      this.weaponBase.x + sway,
      this.weaponBase.y - dip * 0.28 + Math.abs(sway) * 0.5,
      this.weaponBase.z + this.kick * 0.12
    );
    this.weapon.rotation.set(this.kick * 0.22 + dip * 0.9, 0.04, 0);
    this.els.reloadBar.style.transform = `scaleX(${this.reloading > 0 ? 1 - this.reloading / RELOAD_TIME : 0})`;
    this.els.reloadBar.parentElement.classList.toggle("active", this.reloading > 0);
  }

  _startReload() {
    if (this.reloading > 0 || this.ammo >= MAG || this.state !== "playing") return;
    this.reloading = RELOAD_TIME;
    audio.playReload();
    this._updateHud();
  }

  _fire() {
    this.fireCd = FIRE_DELAY;
    this.ammo--;
    this.kick = 1;
    this.shake = Math.min(1, this.shake + 0.35);
    this.pitch = clamp(this.pitch + 0.006, -1.45, 1.45);
    this.flash.visible = true;
    this.flashT = 0.045;
    audio.playShoot();

    const origin = this.camera.getWorldPosition(new THREE.Vector3());
    const dir = this.camera.getWorldDirection(new THREE.Vector3());
    const spread = 0.004 + (this.moving ? 0.012 : 0);
    dir.x += (Math.random() - 0.5) * spread;
    dir.y += (Math.random() - 0.5) * spread;
    dir.z += (Math.random() - 0.5) * spread;
    dir.normalize();

    let best = { t: 70, enemy: null, head: false, kind: "air" };
    for (const o of this.world.obstacles) {
      const t = rayAabb(origin, dir, o);
      if (t < best.t) best = { t, enemy: null, head: false, kind: "wall" };
    }
    if (dir.y < -0.0001) {
      const t = -origin.y / dir.y;
      if (t > 0 && t < best.t) best = { t, enemy: null, head: false, kind: "ground" };
    }
    for (const e of this.enemies) {
      const s = hitSpheres(e);
      const th = raySphere(origin, dir, s.head);
      const tb = raySphere(origin, dir, s.body);
      if (th < best.t && th <= tb + 0.6) best = { t: th, enemy: e, head: true, kind: "enemy" };
      else if (tb < best.t) best = { t: tb, enemy: e, head: false, kind: "enemy" };
    }

    const hit = origin.clone().add(dir.clone().multiplyScalar(best.t));
    const muzzle = this.weapon.localToWorld(new THREE.Vector3(0, 0.02, -0.62));
    this._tracer(muzzle, hit);

    if (best.kind === "enemy") {
      this._burst(hit, [0x5a2d16, 0x7a4326, 0xffffff], 7, 3, 0.5);
      this._damageEnemy(best.enemy, best.head ? 2 : 1, best.head, hit);
    } else if (best.kind !== "air") {
      this._burst(hit, [0x5a2d16, 0xffc800], 4, 2.2, 0.4);
    }
    this._updateHud();
  }

  _damageEnemy(e, dmg, head, hit) {
    e.hp -= dmg;
    e.hitFlash = 1;
    applyChocolate(e, THREE);
    this._hitmarker(head, e.hp <= 0);
    if (e.hp > 0) {
      e.stun = Math.max(e.stun, 0.12);
      if (head) {
        this.heads++;
        this._popup(hit, "¡Cabezazo!", "head");
        audio.playHeadshot();
      } else {
        audio.playHitEnemy();
      }
      return;
    }
    if (head) {
      this.heads++;
      audio.playHeadshot();
    }
    this._killEnemy(e, head);
  }

  _killEnemy(e, head) {
    this.scene.remove(e.group);
    this.enemies = this.enemies.filter((x) => x !== e);
    const p = e.group.position.clone();
    p.y += 1.0;
    this._burst(p, [0xd4216c, 0xffc800, 0xcfd767, 0xfff6e6, 0x5a2d16], 26, 5.5, 0.9, 7);
    audio.playPop();
    this.kills++;
    this.combo++;
    this.comboTimer = COMBO_WINDOW;
    const mult = 1 + Math.min(4, Math.floor((this.combo - 1) / 3));
    const pts = Math.round(e.type.points * mult * (head ? 1.5 : 1));
    this.score += pts;
    this._popup(p, `+${pts}${mult > 1 ? `  x${mult}` : ""}`, mult > 1 ? "combo" : "kill");
    if (e.type.coins) {
      earnCoins(this.progress, e.type.coins);
      this.coinsEarned += e.type.coins;
      saveProgress(this.progress);
      const q = p.clone();
      q.y += 0.6;
      this._popup(q, `+${e.type.coins} 🍫✨`, "coin");
      audio.playBonusCollect();
    }
    this._updateHud();
  }

  _hitmarker(head, kill) {
    const el = this.els.hitmarker;
    el.classList.remove("hit", "head", "kill");
    void el.offsetWidth;
    el.classList.add("hit");
    if (head) el.classList.add("head");
    if (kill) el.classList.add("kill");
  }

  // ---------- enemigos ----------

  _updateWaves(dt) {
    const ws = this.waveState;
    if (ws.intermission > 0) {
      ws.intermission -= dt;
      if (ws.intermission <= 0) this._startWave(this.wave + 1);
      return;
    }
    if (ws.spawned < ws.quota) {
      ws.spawnTimer -= dt;
      const active = Math.min(ws.quota, 4 + this.wave * 1.5);
      if (ws.spawnTimer <= 0 && this.enemies.length < active) {
        this._spawnEnemy();
        ws.spawnTimer = Math.max(0.45, 1.6 - this.wave * 0.1);
      }
    } else if (this.enemies.length === 0) {
      this._completeWave();
    }
  }

  _updateEnemies(dt) {
    for (const e of [...this.enemies]) {
      const p = e.group.position;
      e.life -= dt;
      if (e.life <= 0) {
        this.scene.remove(e.group);
        this.enemies = this.enemies.filter((x) => x !== e);
        const q = p.clone();
        q.y += 1.5;
        this._popup(q, "¡Se escapó!", "kill");
        continue;
      }

      const dx = this.pos.x - p.x;
      const dz = this.pos.z - p.z;
      const dist = Math.hypot(dx, dz) || 0.0001;
      let moving = false;
      if (e.stun <= 0) {
        let dirx = dx / dist;
        let dirz = dz / dist;
        if (e.type.flees) {
          dirx = -dirx + (-dirz) * 0.6;
          dirz = -dirz + dirx * 0.1;
          const m = Math.hypot(p.x, p.z);
          if (m > ARENA_HALF - 5) { dirx -= (p.x / m) * 1.2; dirz -= (p.z / m) * 1.2; }
          const l = Math.hypot(dirx, dirz) || 1;
          dirx /= l;
          dirz /= l;
        }
        p.x += dirx * e.speed * dt;
        p.z += dirz * e.speed * dt;
        moving = true;
        const target = Math.atan2(dirx, dirz);
        let da = target - e.group.rotation.y;
        da = Math.atan2(Math.sin(da), Math.cos(da));
        e.group.rotation.y += da * Math.min(1, dt * 10);
      }
      this._resolveCircle(p, e.radius, 0);
      for (const o of this.enemies) {
        if (o === e) continue;
        const ox = p.x - o.group.position.x;
        const oz = p.z - o.group.position.z;
        const od = Math.hypot(ox, oz);
        const min = (e.radius + o.radius) * 0.9;
        if (od > 0.0001 && od < min) {
          p.x += (ox / od) * (min - od) * 0.5;
          p.z += (oz / od) * (min - od) * 0.5;
        }
      }
      animateEnemy(e, dt, moving);

      if (!e.type.flees && this.invuln <= 0 && dist < e.radius + PLAYER_R + 0.2 && this.pos.y < 1.2) {
        this._hurt(e, dx / dist, dz / dist);
        if (this.state !== "playing") return;
      }
    }
  }

  _hurt(e, nx, nz) {
    this.health--;
    this.invuln = 1.4;
    this.shake = 1;
    this.combo = 0;
    e.stun = 1;
    e.group.position.x -= nx * 1.6;
    e.group.position.z -= nz * 1.6;
    this._resolveCircle(e.group.position, e.radius, 0);
    audio.playHurt();
    this._updateHud();
    if (this.health <= 0) this._gameOver();
  }

  _gameOver() {
    this.state = "gameover";
    this.fireHeld = false;
    this.weapon.visible = false;
    if (document.pointerLockElement === this.els.canvas) document.exitPointerLock();
    this.els.vignette.style.opacity = "0";
    audio.playLose();
    reportScore(this.progress, GAME_ID, this.score);
    addToLeaderboard(this.progress, GAME_ID, this.progress.playerName, this.score);
    this.els.gameoverText.textContent =
      `Llegaste a la oleada ${this.wave}, bañaste ${this.kills} malvaviscos (${this.heads} cabezazos) y sumaste ${this.score} puntos` +
      (this.coinsEarned > 0 ? `, ganando ${this.coinsEarned} monedas Dubai.` : ".");
    this._showOverlay("gameover");
  }

  // ---------- HUD ----------

  _updateHud() {
    const e = this.els;
    e.hudScore.textContent = String(this.score);
    e.hudWave.textContent = String(this.wave);
    e.hudCombo.textContent = this.combo > 1 ? `x${1 + Math.min(4, Math.floor((this.combo - 1) / 3))}` : "x1";
    e.hudCoins.textContent = String(this.progress.coins);
    e.hudHearts.textContent = "❤".repeat(this.health) + "♡".repeat(Math.max(0, MAX_HEARTS - this.health));
    e.hudAmmo.textContent = this.reloading > 0 ? "Recargando…" : `${this.ammo}/${MAG}`;
  }

  _popup(worldPos, text, kind) {
    const el = document.createElement("span");
    el.className = `fps-popup ${kind}`;
    el.textContent = text;
    this.els.popups.appendChild(el);
    this.popups.push({ el, pos: worldPos.clone(), life: 1 });
  }

  _updatePopups(dt) {
    const w = this.els.wrap.clientWidth;
    const h = this.els.wrap.clientHeight;
    for (const p of this.popups) {
      p.life -= dt;
      p.pos.y += dt * 1.1;
      const v = p.pos.clone().project(this.camera);
      const visible = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
      p.el.style.display = visible ? "block" : "none";
      p.el.style.transform = `translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h}px) translate(-50%, -50%)`;
      p.el.style.opacity = String(clamp(p.life / 0.5, 0, 1));
    }
    this.popups = this.popups.filter((p) => {
      if (p.life > 0) return true;
      p.el.remove();
      return false;
    });
  }
}
