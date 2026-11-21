// Avioneta Choco (verano): tu Matichico vuela una avioneta sobre el mar. Mantén apretado para subir y suelta para
// bajar. Pasa por los aros dorados (+puntos y combo), junta alfajores y esquiva los globos y las gaviotas. Si tocas el
// agua o chocas, pierdes un ❤ (tienes 3). Va cada vez más rápido: ¿hasta cuántos metros llegas?
// Liviano para celulares: pocas piezas que se reciclan, geometrías compartidas y sombra chica.

import { THREE, Game3D, clamp, lerp, rand } from "./three-kit.js?v=5545779b2a";
import { createMatichico } from "./matichico3d.js?v=5545779b2a";
import { earnCoins, saveProgress } from "./storage.js?v=5545779b2a";
import * as audio from "./audio.js?v=5545779b2a";
import { BEACH, beachLights, makePalm, alfajorMaterials } from "./verano-kit.js?v=5545779b2a";

const CEIL = 10; // techo
const WATER = 0.55; // nivel del agua
const SPAWN_AHEAD = 46;
const GRAV = -17;
const LIFT = 24;
const MAXV = 8;

export class AvionetaGame extends Game3D {
  constructor(character, progress, els) {
    super("avioneta", character, progress, els, { fov: 50, bloom: false });
    this.kawaii = true;
    this.ambientOpts = { petals: 0, hearts: 0, stars: 10, radius: 12, height: 10 };
    this.musicTheme = "adventure";
    this.hold = false;
  }

  // ---------- escena ----------

  async build() {
    const s = this.scene;
    const { sun } = beachLights(this, { shadow: 7 });
    this.sun = sun;
    s.fog = new THREE.Fog(BEACH.sky, 30, 95);
    // mar (se mueve con la avioneta) y una franja de playa al fondo
    this.sea = new THREE.Mesh(new THREE.PlaneGeometry(240, 120), new THREE.MeshStandardMaterial({ color: BEACH.sea, roughness: 0.3, metalness: 0.1 }));
    this.sea.rotation.x = -Math.PI / 2;
    this.sea.position.y = 0;
    this.sea.receiveShadow = true;
    s.add(this.sea);
    this.shore = new THREE.Mesh(new THREE.PlaneGeometry(240, 14), new THREE.MeshStandardMaterial({ color: BEACH.sand, roughness: 1 }));
    this.shore.rotation.x = -Math.PI / 2;
    this.shore.position.set(0, 0.03, -34);
    s.add(this.shore);
    // islas con palmeras (decoración que se recicla)
    this.isles = [];
    const isleMat = new THREE.MeshStandardMaterial({ color: BEACH.sand, roughness: 1 });
    for (let i = 0; i < 6; i++) {
      const g = new THREE.Group();
      const isle = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3, 0.8, 10), isleMat);
      isle.position.y = 0.2;
      g.add(isle);
      const palm = makePalm(1.2);
      palm.position.y = 0.5;
      g.add(palm);
      g.position.set(i * 22, 0, -rand(14, 26));
      s.add(g);
      this.isles.push(g);
    }
    // nubes
    this.clouds = [];
    const cm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, fog: false });
    const cg = new THREE.SphereGeometry(1, 10, 8);
    for (let i = 0; i < 10; i++) {
      const c = new THREE.Group();
      for (let k = 0; k < 3; k++) { const p = new THREE.Mesh(cg, cm); p.position.set(k * 1.5 - 1.5, rand(-0.2, 0.3), 0); p.scale.set(rand(1.2, 1.8), rand(0.7, 1), 1); c.add(p); }
      c.position.set(i * 14, rand(11, 17), -rand(18, 40));
      s.add(c);
      this.clouds.push(c);
    }

    // avioneta (rosado Matichoc, alas amarillas) con el Matichico de piloto
    this.plane = new THREE.Group();
    const pink = new THREE.MeshStandardMaterial({ color: 0xd4216c, roughness: 0.4 });
    const yellow = new THREE.MeshStandardMaterial({ color: 0xffc800, roughness: 0.4 });
    const white = new THREE.MeshStandardMaterial({ color: 0xfff6e6, roughness: 0.5 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 1.8, 6, 12), pink);
    body.rotation.z = Math.PI / 2;
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 3.6), yellow);
    wing.position.set(0.15, -0.1, 0);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 1.4), yellow);
    tail.position.set(-1.25, 0.12, 0);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.6, 0.06), pink);
    fin.position.set(-1.3, 0.45, 0);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), white);
    nose.position.x = 1.35;
    this.prop = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.3, 0.14), white);
    this.prop.position.x = 1.5;
    for (const m of [body, wing, tail, fin, nose]) { m.castShadow = true; this.plane.add(m); }
    this.plane.add(this.prop);
    s.add(this.plane);

    // piezas que se reciclan: aros, alfajores, globos y gaviotas
    this.ringGeo = new THREE.TorusGeometry(1.25, 0.14, 8, 24);
    this.ringMat = new THREE.MeshStandardMaterial({ color: 0xffc800, roughness: 0.3, metalness: 0.6, emissive: 0x5a3a00, emissiveIntensity: 0.35 });
    this.coinGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.14, 20);
    this.coinMats = alfajorMaterials();
    this.balloonGeo = new THREE.SphereGeometry(1, 14, 12);
    this.basketGeo = new THREE.BoxGeometry(0.5, 0.4, 0.5);
    this.balloonMats = [0xd4216c, 0x4fb8ff, 0x4fd09a, 0xff8a3d, 0x9a5cff].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 }));
    this.basketMat = new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.9 });
    this.gullMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
    this.gullBeak = new THREE.MeshStandardMaterial({ color: 0xffa000 });
    this.things = [];

    this.hero = null;
    this._ensureHero();
    this._bindInput();
  }

  _ensureHero() {
    if (this.hero && this.heroId === this.character.id) { this.hero.setLook(this.look); return; }
    if (this.hero) this.plane.remove(this.hero.group);
    this.hero = createMatichico(this.character, this.outfit, this.look);
    this.heroId = this.character.id;
    this.hero.group.scale.setScalar(0.42);
    this.hero.group.position.set(0.1, 0.2, 0);
    this.hero.group.rotation.y = Math.PI / 2;
    this.plane.add(this.hero.group);
  }

  _bindInput() {
    const wrap = this.els.wrap;
    const down = (e) => { if (e.target.closest && e.target.closest("button, .overlay:not(.hidden)")) return; this.hold = true; };
    const up = () => { this.hold = false; };
    wrap.addEventListener("pointerdown", down);
    wrap.addEventListener("pointerup", up);
    wrap.addEventListener("pointercancel", up);
    wrap.addEventListener("pointerleave", up);
    window.addEventListener("keydown", (e) => { if (this.running && (e.code === "Space" || e.code === "ArrowUp")) { e.preventDefault(); this.hold = true; } });
    window.addEventListener("keyup", (e) => { if (e.code === "Space" || e.code === "ArrowUp") this.hold = false; });
  }

  setupMission() { this.mission = null; this._missionWon = false; }

  // ---------- partida ----------

  reset() {
    for (const t of this.things || []) this.scene.remove(t.mesh);
    this.things = [];
    this.x = 0;
    this.y = 4;
    this.vy = 0;
    this.speed = 8;
    this.dist = 0;
    this.score = 0;
    this.hearts = 3;
    this.invuln = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.rings = 0;
    this.items = 0;
    this.coinsEarned = 0;
    this.nextSpawn = -30; // lo primero aparece apenas parte
    this.hold = false;
    this.flyT = 0;
    this.camX = 0;
    this.camY = 4.5;
    this._ensureHero();
    this.plane.position.set(0, this.y, 0);
    this.plane.rotation.set(0, 0, 0);
    this.plane.visible = true;
    this._updateHud();
    this._placeCamera(0);
  }

  _spawn() {
    const x = this.x + SPAWN_AHEAD;
    const lvl = Math.min(1, this.dist / 1500); // dificultad 0..1
    const r = Math.random();
    if (r < 0.42) {
      // aro dorado, con alfajores en fila antes
      const y = rand(2.4, CEIL - 2);
      const m = new THREE.Mesh(this.ringGeo, this.ringMat);
      m.rotation.y = 1.05; // de lado, pero que se vea el círculo desde la cámara
      m.position.set(x, y, 0);
      this.scene.add(m);
      this.things.push({ kind: "ring", mesh: m, x, y });
      for (let i = 1; i <= 3; i++) this._coin(x - i * 2.2, y);
    } else if (r < 0.75) {
      // globo aerostático (sube y baja despacio)
      const y = rand(2.5, CEIL - 1.5);
      const g = new THREE.Group();
      const b = new THREE.Mesh(this.balloonGeo, this.balloonMats[Math.floor(Math.random() * this.balloonMats.length)]);
      b.scale.set(1.15, 1.35, 1.15);
      b.castShadow = true;
      const k = new THREE.Mesh(this.basketGeo, this.basketMat);
      k.position.y = -1.75;
      g.add(b, k);
      g.position.set(x, y, 0);
      this.scene.add(g);
      this.things.push({ kind: "balloon", mesh: g, x, y, y0: y, ph: rand(0, 6), amp: 0.6 + lvl * 1.4, r: 1.25 });
    } else if (r < 0.9) {
      // gaviota que vuela hacia ti
      const y = rand(2, CEIL - 1);
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), this.gullMat);
      body.scale.set(1.6, 0.8, 0.8);
      const wl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 1.6), this.gullMat);
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.25, 6), this.gullBeak);
      beak.rotation.z = Math.PI / 2;
      beak.position.x = -0.5;
      g.add(body, wl, beak);
      g.position.set(x, y, 0);
      this.scene.add(g);
      this.things.push({ kind: "gull", mesh: g, wing: wl, x, y, vx: -(2 + lvl * 3), r: 0.6 });
    } else {
      // fila de alfajores en curva
      const y0 = rand(2.5, CEIL - 2.5);
      for (let i = 0; i < 5; i++) this._coin(x + i * 1.8, y0 + Math.sin(i * 0.9) * 1.4);
    }
    this.nextSpawn = this.x + rand(8, 13) - lvl * 3;
  }

  _coin(x, y) {
    const m = new THREE.Mesh(this.coinGeo, this.coinMats[Math.floor(Math.random() * this.coinMats.length)]);
    m.rotation.x = Math.PI / 2;
    m.position.set(x, y, 0);
    this.scene.add(m);
    this.things.push({ kind: "coin", mesh: m, x, y });
  }

  _hit(why) {
    if (this.invuln > 0) return;
    this.hearts--;
    this.invuln = 1.6;
    this.combo = 0;
    audio.playBump();
    this.haptic(80);
    this.particles.burst(this.plane.position.clone(), [0xffffff, 0xd4216c, 0xffc800], 18, 4, 0.6, 4);
    this.banner(this.hearts > 0 ? `${why} 💔` : "¡Aterrizaje forzoso!");
    this._updateHud();
    if (this.hearts <= 0) this._gameOver();
  }

  _gameOver() {
    if (this.state !== "playing") return;
    audio.playLose();
    this.state = "ending";
    setTimeout(() => this.finish(`Volaste ${Math.floor(this.dist)} metros, pasaste por ${this.rings} aros (mejor combo x${this.bestCombo}) y juntaste ${this.items} alfajores: ${this.score} puntos` +
      (this.coinsEarned > 0 ? `, y ganaste ${this.coinsEarned} Matipuntos.` : ".")), 900);
  }

  _updateHud() {
    const e = this.els;
    if (e.hudScore) e.hudScore.textContent = String(this.score);
    if (e.hudDist) e.hudDist.textContent = `${Math.floor(this.dist)} m`;
    if (e.hudHearts) e.hudHearts.textContent = "❤".repeat(Math.max(0, this.hearts)) + "♡".repeat(Math.max(0, 3 - this.hearts));
    if (e.hudCombo) e.hudCombo.textContent = `x${Math.max(1, this.combo)}`;
    if (e.hudCoins) e.hudCoins.textContent = String(this.progress.coins);
  }

  // ---------- bucle ----------

  update(dt) {
    const playing = this.state === "playing";
    if (playing) this._step(dt);
    else if (this.state === "intro") { this.y = 4 + Math.sin(this.time * 1.5) * 0.3; }
    else if (this.state === "ending" || this.state === "gameover") { this.vy = Math.max(-8, this.vy + GRAV * dt); this.y = Math.max(WATER - 0.2, this.y + this.vy * dt); }
    this.plane.position.set(this.x, this.y, 0);
    this.plane.rotation.z = lerp(this.plane.rotation.z, clamp(this.vy * 0.07, -0.5, 0.5), 1 - Math.exp(-8 * dt));
    this.plane.visible = this.invuln <= 0 || Math.floor(this.time * 14) % 2 === 0;
    this.prop.rotation.x += dt * 40;
    this.hero.animate(this.time, "drive", 1);
    for (const t of this.things) {
      if (t.kind === "balloon") { t.y = t.y0 + Math.sin(this.time * 0.9 + t.ph) * t.amp; t.mesh.position.y = t.y; }
      else if (t.kind === "gull") { if (playing) t.x += t.vx * dt; t.mesh.position.set(t.x, t.y + Math.sin(this.time * 6) * 0.1, 0); t.wing.rotation.x = Math.sin(this.time * 14) * 0.6; }
      else if (t.kind === "coin") t.mesh.rotation.y += dt * 3; // gira mostrando la foto del alfajor
      else if (t.kind === "ring") t.mesh.rotation.x = Math.sin(this.time * 2) * 0.12;
    }
    // decoración que acompaña
    for (const isle of this.isles) if (isle.position.x < this.x - 30) isle.position.x += 22 * this.isles.length;
    for (const c of this.clouds) if (c.position.x < this.x - 40) c.position.x += 14 * this.clouds.length;
    this.sea.position.x = this.x;
    this.shore.position.x = this.x;
    this._placeCamera(dt);
  }

  _step(dt) {
    this.speed = Math.min(16, 8 + this.dist / 160);
    this.x += this.speed * dt;
    this.dist += this.speed * dt;
    this.flyT = (this.flyT || 0) + dt;
    const grav = this.flyT < 1.0 ? 0 : this.flyT < 2.2 ? GRAV * 0.45 : GRAV; // al partir planea un segundo y después cae despacito
    this.vy = clamp(this.vy + (this.hold ? LIFT : grav) * dt, -MAXV, MAXV);
    this.y += this.vy * dt;
    if (this.y > CEIL) { this.y = CEIL; this.vy = Math.min(0, this.vy); }
    if (this.invuln > 0) this.invuln -= dt;
    if (this.y < WATER + 0.3) {
      this.y = WATER + 0.3;
      this.vy = 7; // rebota en el agua
      this.particles.burst(new THREE.Vector3(this.x, WATER, 0), [0xffffff, 0x9fe8ff], 22, 4, 0.6, 6);
      this._hit("¡Al agua!");
      if (this.state !== "playing") return;
    }
    if (this.x >= this.nextSpawn) this._spawn();
    // choques y premios
    const px = this.x + 0.3, py = this.y;
    for (const t of this.things) {
      if (t.done) continue;
      const dx = t.x - px, dy = (t.kind === "balloon" ? t.y : t.y) - py;
      if (t.kind === "coin") {
        if (dx * dx + dy * dy < 1.1) {
          t.done = true; t.mesh.visible = false; this.items++; this.score += 10; audio.playCollect();
          if (this.items % 10 === 0) { earnCoins(this.progress, 2); this.coinsEarned += 2; saveProgress(this.progress); }
        }
      } else if (t.kind === "ring") {
        if (Math.abs(dx) < 0.35) {
          t.done = true;
          if (Math.abs(dy) < 1.05) {
            this.rings++; this.combo++; this.bestCombo = Math.max(this.bestCombo, this.combo);
            this.score += 50 * this.combo;
            audio.playStar(); this.haptic(20);
            this.particles.burst(new THREE.Vector3(t.x, t.y, 0), [0xffc800, 0xfff6e6, 0xd4216c], 20, 4, 0.6, 2);
            if (this.combo > 1) this.banner(`¡Aro x${this.combo}!`);
            t.mesh.material = this.ringMat; t.mesh.scale.setScalar(1.25);
          } else { this.combo = 0; }
        }
      } else if (dx * dx + dy * dy < (t.r + 0.55) ** 2) {
        t.done = true;
        this._hit(t.kind === "gull" ? "¡Una gaviota!" : "¡Chocaste un globo!");
        if (this.state !== "playing") return;
      }
    }
    // reciclar lo que quedó atrás
    for (let i = this.things.length - 1; i >= 0; i--) if (this.things[i].x < this.x - 20) { this.scene.remove(this.things[i].mesh); this.things.splice(i, 1); }
    this.meterEnergy("metros", this.dist, 150); // 1 de energía cada 150 m
    if (Math.floor(this.dist / 250) > Math.floor((this.dist - this.speed * dt) / 250)) { this.banner(`✈️ ¡${Math.floor(this.dist / 250) * 250} m!`); audio.playPowerup(); }
    this._updateHud();
  }

  _placeCamera(dt) {
    const tx = this.x + 4, ty = clamp(this.y * 0.5 + 2.6, 3.2, 7);
    this.camX = dt ? lerp(this.camX, tx, 1 - Math.exp(-6 * dt)) : tx;
    this.camY = dt ? lerp(this.camY, ty, 1 - Math.exp(-3 * dt)) : ty;
    this.camera.position.set(this.camX - 2, this.camY + 1.2, 15);
    this.camera.lookAt(this.camX, this.camY, 0);
    if (this.sun) { this.sun.position.set(this.x + 4, 18, 10); this.sun.target.position.set(this.x + 2, 0, 0); }
  }
}
