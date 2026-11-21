// Torre de alfajores (verano): un alfajor va y viene sobre la torre; con un toque se suelta y cae. Si queda bien
// encima, la torre sube; si queda justo al centro es "¡Perfecto!" (combo). Si queda muy corrido se cae (pierdes un ❤),
// y si la torre entera queda muy cargada hacia un lado, se derrumba (fin de la partida).
// Cada 15 pisos cae un alfajor dorado (Mati Dubai) que da Matipuntos extra. Liviano para celulares: una geometría
// compartida para todos los alfajores, sombra chica y la cámara solo sube.

import { THREE, Game3D, clamp, lerp, rand } from "./three-kit.js?v=5545779b2a";
import { createMatichico } from "./matichico3d.js?v=5545779b2a";
import { earnCoins, saveProgress } from "./storage.js?v=5545779b2a";
import * as audio from "./audio.js?v=5545779b2a";
import { BEACH, beachLights, makePalm, makeUmbrella, alfajorMaterials, HIDDEN } from "./verano-kit.js?v=5545779b2a";

const R = 1.0; // radio del alfajor
const H = 0.34; // alto del alfajor
const PERFECT = 0.14; // corrimiento máximo para un ¡Perfecto!
const SLIDE_OFF = R * 0.92; // más corrido que esto, el alfajor se cae
const TOPPLE = R * 0.95; // si el centro de la torre se corre más que esto, se derrumba
const GOLD_EVERY = 15;
const BASE_Y = 1.0; // altura del plato

export class TorreGame extends Game3D {
  constructor(character, progress, els) {
    super("torre", character, progress, els, { fov: 42, bloom: false });
    this.kawaii = true;
    this.ambientOpts = { petals: 10, hearts: 4, stars: 8, radius: 8, height: 10 };
    this.musicTheme = "cozy";
  }

  // ---------- escena ----------

  async build() {
    const s = this.scene;
    const { sun } = beachLights(this, { shadow: 6 });
    this.sun = sun;
    // arena, mar al fondo y un par de palmeras y quitasoles
    const sand = new THREE.Mesh(new THREE.CircleGeometry(40, 32), new THREE.MeshStandardMaterial({ color: BEACH.sand, roughness: 1 }));
    sand.rotation.x = -Math.PI / 2;
    sand.receiveShadow = true;
    s.add(sand);
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(200, 60), new THREE.MeshStandardMaterial({ color: BEACH.sea, roughness: 0.35, metalness: 0.1 }));
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(0, 0.02, -40);
    s.add(sea);
    for (const [x, z, k] of [[-7, -6, 1.3], [8, -8, 1.5], [-12, -14, 1.7], [13, -15, 1.4]]) {
      const p = makePalm(k);
      p.position.set(x, 0, z);
      s.add(p);
    }
    const um = makeUmbrella(1.1);
    um.position.set(4.5, 0, -2.5);
    s.add(um);
    // mesa con plato dorado: la base de la torre
    const wood = new THREE.MeshStandardMaterial({ color: 0x7a4a2a, roughness: 0.8 });
    const table = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.16, 28), wood);
    table.position.y = BASE_Y - 0.2;
    table.castShadow = table.receiveShadow = true;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, BASE_Y - 0.2, 10), wood);
    leg.position.y = (BASE_Y - 0.2) / 2;
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.1, 0.08, 32), new THREE.MeshStandardMaterial({ color: 0xffc800, roughness: 0.3, metalness: 0.6 }));
    plate.position.y = BASE_Y - 0.08;
    plate.receiveShadow = true;
    s.add(table, leg, plate);

    this.geo = new THREE.CylinderGeometry(R, R, H, 32);
    this.mats = alfajorMaterials();
    const gold = new THREE.MeshStandardMaterial({ color: 0xffc800, roughness: 0.25, metalness: 0.7, emissive: 0x5a3a00, emissiveIntensity: 0.4 });
    this.goldMats = [gold, gold, HIDDEN];
    this.tower = new THREE.Group(); // se mece un poquito según lo cargada que esté
    s.add(this.tower);
    this.falling = []; // alfajores que se caen (solo animación)
    this.hero = null;
    this._ensureHero();
    this._bindInput();
  }

  _ensureHero() {
    if (this.hero && this.heroId === this.character.id) { this.hero.setLook(this.look); return; }
    if (this.hero) this.scene.remove(this.hero.group);
    this.hero = createMatichico(this.character, this.outfit, this.look);
    this.heroId = this.character.id;
    this.hero.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.hero.group.position.set(-2.6, 0, 0.8);
    this.hero.group.rotation.y = 0.5;
    this.scene.add(this.hero.group);
  }

  _bindInput() {
    const drop = (e) => {
      if (e && e.target && e.target.closest && e.target.closest("button, .overlay:not(.hidden)")) return;
      if (this.state === "playing") this._drop();
    };
    this.els.wrap.addEventListener("pointerdown", drop);
    window.addEventListener("keydown", (e) => {
      if (!this.running || this.state !== "playing") return;
      if (e.code === "Space" || e.code === "Enter" || e.code === "ArrowDown") { e.preventDefault(); this._drop(); }
    });
  }

  setupMission() { this.mission = null; this._missionWon = false; }

  // ---------- partida ----------

  reset() {
    for (const p of [...(this.pieces || []), ...this.falling]) this.tower.remove(p.mesh), this.scene.remove(p.mesh);
    this.pieces = []; // { mesh, x }
    this.falling = [];
    this.score = 0;
    this.floors = 0;
    this.hearts = 3;
    this.combo = 0;
    this.bestCombo = 0;
    this.perfects = 0;
    this.golds = 0;
    this.coinsEarned = 0;
    this.camY = BASE_Y + 2;
    this.sway = 0;
    this.cheer = 0;
    this.tower.rotation.z = 0;
    this._ensureHero();
    this._newPiece();
    this._updateHud();
    this._placeCamera(0);
  }

  get topY() { return BASE_Y + this.pieces.length * H; }
  get topX() { return this.pieces.length ? this.pieces[this.pieces.length - 1].x : 0; }

  _newPiece() {
    const n = this.pieces.length;
    const gold = (this.floors + 1) % GOLD_EVERY === 0;
    const mesh = new THREE.Mesh(this.geo, gold ? this.goldMats : this.mats[Math.floor(Math.random() * this.mats.length)]);
    mesh.castShadow = true;
    mesh.rotation.y = rand(0, Math.PI * 2);
    this.scene.add(mesh);
    const speed = Math.min(5.4, 2.0 + n * 0.09); // va más rápido a medida que sube
    this.cur = { mesh, x: Math.random() < 0.5 ? -3.2 : 3.2, dir: Math.random() < 0.5 ? 1 : -1, speed, y: this.topY + 1.3, vy: 0, dropping: false, gold };
    mesh.position.set(this.cur.x, this.cur.y, 0);
  }

  _drop() {
    if (!this.cur || this.cur.dropping) return;
    this.cur.dropping = true;
    this.cur.vy = -2;
    audio.playWhoosh();
  }

  _land() {
    const c = this.cur;
    const d = c.x - this.topX;
    if (Math.abs(d) > SLIDE_OFF) {
      // quedó muy corrido: se cae de la torre
      this.falling.push({ mesh: c.mesh, vx: Math.sign(d) * 2.5, vy: 1.5, spin: Math.sign(d) * 4 });
      this.cur = null;
      this.combo = 0;
      this.hearts--;
      audio.playBump();
      this.haptic(60);
      this.banner(this.hearts > 0 ? "¡Uy! Se cayó 💔" : "¡Se acabaron los ❤!");
      this._updateHud();
      if (this.hearts <= 0) return this._gameOver(`Se cayeron tres alfajores.`);
      setTimeout(() => { if (this.state === "playing") this._newPiece(); }, 450);
      return;
    }
    let x = c.x;
    const perfect = Math.abs(d) <= PERFECT;
    if (perfect) {
      x = this.topX; // al centro exacto
      this.combo++;
      this.perfects++;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      this.score += 25 * this.combo;
      this.banner(this.combo > 1 ? `¡Perfecto x${this.combo}!` : "¡Perfecto!");
      audio.playCombo(Math.min(8, this.combo));
      this.particles.burst(new THREE.Vector3(x, this.topY + H, 0), [0xffc800, 0xfff6e6, 0xd4216c], 18, 3.5, 0.6, 4);
      this.cheer = 1.2;
    } else {
      this.combo = 0;
      this.score += 10;
      audio.playCollect();
    }
    // el alfajor de abajo queda tapado: ya no se dibuja su tapa (en celulares cuenta cada pieza dibujada)
    const under = this.pieces[this.pieces.length - 1];
    if (under) under.mesh.material = [under.mesh.material[0], HIDDEN, HIDDEN];
    // queda pegado a la torre
    this.scene.remove(c.mesh);
    this.tower.add(c.mesh);
    c.mesh.position.set(x, this.topY + H / 2, 0);
    this.pieces.push({ mesh: c.mesh, x });
    this.floors++;
    if (c.gold) {
      this.golds++;
      earnCoins(this.progress, 10);
      this.coinsEarned += 10;
      saveProgress(this.progress);
      this.banner("✨ ¡Alfajor Mati Dubai! +10 Matipuntos");
      audio.playBonusCollect();
    }
    if (this.floors % 10 === 0) { this.banner(`🏆 ¡${this.floors} pisos!`); audio.playStar(); this.cheer = 1.5; }
    this.cur = null;
    this.haptic(perfect ? 25 : 12);
    this.countEnergy("pisos", 8); // 1 de energía cada 8 pisos
    // ¿la torre quedó muy cargada hacia un lado? (centro de todo lo que está encima del plato)
    const com = this.pieces.reduce((a, p) => a + p.x, 0) / this.pieces.length;
    this.lean = com;
    this._updateHud();
    if (Math.abs(com) > TOPPLE) return this._collapse(com);
    if (this.state === "playing") this._newPiece();
  }

  _collapse(com) {
    audio.playCrash();
    this.haptic(120);
    this.banner("¡Se derrumbó la torre!");
    const dir = Math.sign(com) || 1;
    this.pieces.forEach((p, i) => {
      const wp = new THREE.Vector3();
      p.mesh.getWorldPosition(wp);
      this.tower.remove(p.mesh);
      this.scene.add(p.mesh);
      p.mesh.position.copy(wp);
      this.falling.push({ mesh: p.mesh, vx: dir * rand(1.5, 4) * (0.5 + i / this.pieces.length), vy: rand(0.5, 3), spin: dir * rand(2, 6) });
    });
    this.pieces = [];
    this._gameOver("¡La torre quedó muy chueca y se derrumbó!");
  }

  _gameOver(why) {
    if (this.state !== "playing") return;
    audio.playLose();
    setTimeout(() => {
      this.finish(`${why} Llegaste a ${this.floors} pisos, con ${this.perfects} ¡Perfectos! (mejor combo x${this.bestCombo}) y ${this.score} puntos` +
        (this.coinsEarned > 0 ? `, y ganaste ${this.coinsEarned} Matipuntos con los alfajores dorados.` : "."));
    }, 900);
    this.state = "ending";
  }

  _updateHud() {
    const e = this.els;
    if (e.hudScore) e.hudScore.textContent = String(this.score);
    if (e.hudFloors) e.hudFloors.textContent = String(this.floors);
    if (e.hudHearts) e.hudHearts.textContent = "❤".repeat(Math.max(0, this.hearts)) + "♡".repeat(Math.max(0, 3 - this.hearts));
    if (e.hudCombo) e.hudCombo.textContent = `x${Math.max(1, this.combo)}`;
    if (e.hudCoins) e.hudCoins.textContent = String(this.progress.coins);
  }

  // ---------- bucle ----------

  update(dt) {
    const playing = this.state === "playing";
    const c = this.cur;
    if (c) {
      if (!c.dropping) {
        if (playing) {
          c.x += c.dir * c.speed * dt;
          if (c.x > 3.4) { c.x = 3.4; c.dir = -1; }
          if (c.x < -3.4) { c.x = -3.4; c.dir = 1; }
        }
        c.y = this.topY + 1.3 + Math.sin(this.time * 4) * 0.05;
      } else {
        c.vy -= 30 * dt;
        c.y += c.vy * dt;
        const floor = this.topY + H / 2;
        if (c.y <= floor) { c.y = floor; c.mesh.position.set(c.x, c.y, 0); this._land(); }
      }
      if (this.cur) this.cur.mesh.position.set(c.x, c.y, 0);
    }
    for (const f of this.falling) {
      f.vy -= 22 * dt;
      f.mesh.position.x += f.vx * dt;
      f.mesh.position.y += f.vy * dt;
      f.mesh.rotation.z += f.spin * dt;
      if (f.mesh.position.y < -5) f.mesh.visible = false;
    }
    // la torre se mece según qué tan cargada está hacia un lado
    const target = clamp((this.lean || 0) * -0.05, -0.08, 0.08);
    this.sway = lerp(this.sway, target, 1 - Math.exp(-3 * dt));
    this.tower.rotation.z = this.sway + Math.sin(this.time * 2.2) * Math.abs(this.lean || 0) * 0.012;
    this.cheer = Math.max(0, this.cheer - dt);
    this.hero.animate(this.time, this.cheer > 0 ? "cheer" : this.state === "gameover" ? "sad" : "idle", 1);
    this._placeCamera(dt);
  }

  _placeCamera(dt) {
    const target = Math.max(BASE_Y + 2, this.topY + 0.8);
    this.camY = dt ? lerp(this.camY, target, 1 - Math.exp(-3 * dt)) : target;
    const back = 9.5 + Math.min(4, this.pieces.length * 0.04);
    this.camera.position.set(0, this.camY + 2.2, back);
    this.camera.lookAt(0, this.camY - 0.6, 0);
    if (this.sun) { this.sun.position.set(5, this.camY + 10, 8); this.sun.target.position.set(0, this.camY - 2, 0); }
  }
}
