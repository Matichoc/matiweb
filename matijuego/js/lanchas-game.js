// Lanchas en el lago (verano): tu Matichico maneja una lancha que avanza sola por el lago. Muévela a los lados
// (◀ ▶, flechas o arrastrando el dedo) para esquivar boyas y rocas de chocolate, saltar en las olas (rampas) y juntar
// alfajores. Cada choque quita un ❤ (tienes 3) y la lancha va cada vez más rápido.
// Liviano para celulares: el agua es un solo plano con una textura que se desliza, y todo lo demás se recicla.

import { THREE, Game3D, clamp, lerp, rand, canvasTexture } from "./three-kit.js?v=5545779b2a";
import { createMatichico } from "./matichico3d.js?v=5545779b2a";
import { earnCoins, saveProgress } from "./storage.js?v=5545779b2a";
import * as audio from "./audio.js?v=5545779b2a";
import { BEACH, beachLights, makePalm, makeUmbrella, alfajorMaterials } from "./verano-kit.js?v=5545779b2a";

const HALF = 5.2; // ancho del lago navegable (a cada lado)
const AHEAD = 70;

export class LanchasGame extends Game3D {
  constructor(character, progress, els) {
    super("lanchas", character, progress, els, { fov: 60, bloom: false });
    this.kawaii = true;
    this.ambientOpts = { petals: 0, hearts: 0, stars: 8, radius: 12, height: 8 };
    this.musicTheme = "race";
    this.input = 0;
    this.keys = {};
    this.pointerX = null;
  }

  // ---------- escena ----------

  async build() {
    const s = this.scene;
    const { sun } = beachLights(this, { shadow: 8 });
    this.sun = sun;
    s.fog = new THREE.Fog(BEACH.sky, 40, 110);
    // agua con olitas dibujadas que se deslizan (da la sensación de velocidad)
    this.waterTex = canvasTexture(128, 128, (g, w, h) => {
      g.fillStyle = "#3fb6d8"; g.fillRect(0, 0, w, h);
      g.strokeStyle = "rgba(255,255,255,0.35)"; g.lineWidth = 3;
      for (let i = 0; i < 9; i++) {
        const y = (i * h) / 9 + 6, x = (i * 37) % w;
        g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 10, y - 5, x + 20, y); g.stroke();
      }
    });
    this.waterTex.wrapS = this.waterTex.wrapT = THREE.RepeatWrapping;
    this.waterTex.repeat.set(6, 30);
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(40, 200), new THREE.MeshStandardMaterial({ map: this.waterTex, roughness: 0.3, metalness: 0.05 }));
    this.water.rotation.x = -Math.PI / 2;
    this.water.receiveShadow = true;
    s.add(this.water);
    // orillas de arena con palmeras y quitasoles que se reciclan
    const sandMat = new THREE.MeshStandardMaterial({ color: BEACH.sand, roughness: 1 });
    this.shores = [];
    for (const side of [-1, 1]) {
      const sh = new THREE.Mesh(new THREE.BoxGeometry(14, 0.6, 200), sandMat);
      sh.position.set(side * (HALF + 8.2), 0.1, 0);
      s.add(sh);
      this.shores.push(sh);
    }
    this.decos = [];
    for (let i = 0; i < 14; i++) {
      const side = i % 2 ? 1 : -1;
      const d = i % 3 === 0 ? makeUmbrella(0.9) : makePalm(rand(1.1, 1.5));
      d.position.set(side * rand(HALF + 2.5, HALF + 6), 0.4, -i * 9);
      s.add(d);
      this.decos.push(d);
    }
    // lancha rosada con el Matichico manejando
    this.boat = new THREE.Group();
    const pink = new THREE.MeshStandardMaterial({ color: 0xd4216c, roughness: 0.4 });
    const white = new THREE.MeshStandardMaterial({ color: 0xfff6e6, roughness: 0.5 });
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 3.0), pink);
    hull.position.y = 0.3;
    const bow = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.2, 4), pink);
    bow.rotation.set(-Math.PI / 2, Math.PI / 4, 0);
    bow.scale.set(1.4, 1, 0.55);
    bow.position.set(0, 0.3, -2.05);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.12, 3.02), white);
    stripe.position.y = 0.45;
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.45, 0.08), new THREE.MeshStandardMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.6 }));
    glass.position.set(0, 0.8, -0.55);
    glass.rotation.x = -0.4;
    for (const m of [hull, bow, stripe]) { m.castShadow = true; this.boat.add(m); }
    this.boat.add(glass);
    s.add(this.boat);

    // piezas que se reciclan
    this.buoyGeo = new THREE.SphereGeometry(0.5, 12, 10);
    this.buoyMats = [new THREE.MeshStandardMaterial({ color: 0xe8352e, roughness: 0.5 }), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 })];
    this.rockGeo = new THREE.DodecahedronGeometry(0.9, 0);
    this.rockMat = new THREE.MeshStandardMaterial({ color: 0x5c3317, roughness: 0.7, flatShading: true });
    this.rampGeo = new THREE.BoxGeometry(2.6, 0.3, 2.4);
    this.rampMat = new THREE.MeshStandardMaterial({ color: 0x8fe3ff, roughness: 0.3, transparent: true, opacity: 0.85 });
    this.coinGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.14, 20);
    this.coinMats = alfajorMaterials();
    this.things = [];
    this.hero = null;
    this._ensureHero();
    this._bindInput();
  }

  _ensureHero() {
    if (this.hero && this.heroId === this.character.id) { this.hero.setLook(this.look); return; }
    if (this.hero) this.boat.remove(this.hero.group);
    this.hero = createMatichico(this.character, this.outfit, this.look);
    this.heroId = this.character.id;
    this.hero.group.scale.setScalar(0.5);
    this.hero.group.position.set(0, 0.55, 0.35);
    this.hero.group.rotation.y = Math.PI;
    this.boat.add(this.hero.group);
  }

  _bindInput() {
    const wrap = this.els.wrap;
    const L = this.els.touch && this.els.touch.left, Rb = this.els.touch && this.els.touch.right;
    const hold = (btn, key) => {
      if (!btn) return;
      btn.addEventListener("pointerdown", (e) => { e.preventDefault(); this.keys[key] = true; });
      for (const ev of ["pointerup", "pointercancel", "pointerleave"]) btn.addEventListener(ev, () => { this.keys[key] = false; });
    };
    hold(L, "left");
    hold(Rb, "right");
    window.addEventListener("keydown", (e) => {
      if (!this.running) return;
      if (e.code === "ArrowLeft" || e.code === "KeyA") this.keys.left = true;
      if (e.code === "ArrowRight" || e.code === "KeyD") this.keys.right = true;
    });
    window.addEventListener("keyup", (e) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") this.keys.left = false;
      if (e.code === "ArrowRight" || e.code === "KeyD") this.keys.right = false;
    });
    // arrastrar el dedo en el agua: la lancha sigue al dedo
    let drag = null;
    wrap.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button, .overlay:not(.hidden)")) return;
      drag = { x0: e.clientX, bx: this.bx };
    });
    wrap.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const w = wrap.clientWidth || 800;
      this.pointerX = clamp(drag.bx + ((e.clientX - drag.x0) / w) * 14, -HALF, HALF);
    });
    for (const ev of ["pointerup", "pointercancel"]) wrap.addEventListener(ev, () => { drag = null; this.pointerX = null; });
  }

  setupMission() { this.mission = null; this._missionWon = false; }

  // ---------- partida ----------

  reset() {
    for (const t of this.things || []) this.scene.remove(t.mesh);
    this.things = [];
    this.bx = 0;
    this.vx = 0;
    this.bz = 0;
    this.by = 0;
    this.vy = 0;
    this.speed = 12;
    this.dist = 0;
    this.score = 0;
    this.hearts = 3;
    this.invuln = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.items = 0;
    this.jumps = 0;
    this.coinsEarned = 0;
    this.nextSpawn = -20;
    this.keys = {};
    this.pointerX = null;
    this._ensureHero();
    this.boat.position.set(0, 0, 0);
    this.boat.rotation.set(0, 0, 0);
    this.boat.visible = true;
    this.decos.forEach((d, i) => { d.position.z = -i * 9; });
    this._updateHud();
    this._placeCamera(0);
  }

  _spawn() {
    const z = this.bz - AHEAD;
    const lvl = Math.min(1, this.dist / 2500);
    const r = Math.random();
    if (r < 0.45) {
      // fila de boyas con un hueco (por donde se pasa)
      const gap = rand(-HALF + 1.5, HALF - 1.5);
      for (let x = -HALF + 0.6; x <= HALF - 0.6; x += 1.6) {
        if (Math.abs(x - gap) < 1.6 - lvl * 0.4) continue;
        if (Math.random() < 0.35) continue;
        const g = new THREE.Group();
        const top = new THREE.Mesh(this.buoyGeo, this.buoyMats[0]);
        const band = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.16, 12), this.buoyMats[1]);
        band.position.y = -0.05;
        top.castShadow = true;
        g.add(top, band);
        g.position.set(x, 0.3, z);
        this.scene.add(g);
        this.things.push({ kind: "buoy", mesh: g, x, z, r: 0.55, ph: rand(0, 6) });
      }
    } else if (r < 0.65) {
      const x = rand(-HALF + 1, HALF - 1);
      const m = new THREE.Mesh(this.rockGeo, this.rockMat);
      m.position.set(x, 0.2, z);
      m.rotation.set(rand(0, 3), rand(0, 3), 0);
      m.castShadow = true;
      this.scene.add(m);
      this.things.push({ kind: "rock", mesh: m, x, z, r: 0.95 });
    } else if (r < 0.8) {
      // ola-rampa: se salta y da puntos; con alfajores en el aire
      const x = rand(-HALF + 1.5, HALF - 1.5);
      const m = new THREE.Mesh(this.rampGeo, this.rampMat);
      m.position.set(x, 0.12, z);
      m.rotation.x = 0.28;
      this.scene.add(m);
      this.things.push({ kind: "ramp", mesh: m, x, z, r: 1.3 });
      for (let i = 1; i <= 3; i++) this._coin(x, z - 3 - i * 2.2, 1.6 + Math.sin((i / 4) * Math.PI) * 1.2);
    } else {
      // camino de alfajores
      const x0 = rand(-HALF + 1, HALF - 1);
      for (let i = 0; i < 6; i++) this._coin(clamp(x0 + Math.sin(i * 0.7) * 1.6, -HALF + 0.5, HALF - 0.5), z - i * 2.4, 0.7);
    }
    this.nextSpawn = this.bz - rand(13, 19) + lvl * 5;
  }

  _coin(x, z, y) {
    const m = new THREE.Mesh(this.coinGeo, this.coinMats[Math.floor(Math.random() * this.coinMats.length)]);
    m.position.set(x, y, z);
    m.rotation.x = Math.PI / 2;
    this.scene.add(m);
    this.things.push({ kind: "coin", mesh: m, x, z, y });
  }

  _hit(why) {
    if (this.invuln > 0) return;
    this.hearts--;
    this.invuln = 1.5;
    this.combo = 0;
    this.speed = Math.max(12, this.speed * 0.75);
    audio.playCrash();
    this.haptic(80);
    this.particles.burst(new THREE.Vector3(this.bx, 0.6, this.bz), [0xffffff, 0x9fe8ff, 0xd4216c], 20, 4, 0.6, 5);
    this.banner(this.hearts > 0 ? `${why} 💔` : "¡La lancha quedó en pana!");
    this._updateHud();
    if (this.hearts <= 0) this._gameOver();
  }

  _gameOver() {
    if (this.state !== "playing") return;
    audio.playLose();
    this.state = "ending";
    setTimeout(() => this.finish(`Navegaste ${Math.floor(this.dist)} metros, saltaste ${this.jumps} olas y juntaste ${this.items} alfajores: ${this.score} puntos` +
      (this.coinsEarned > 0 ? `, y ganaste ${this.coinsEarned} Matipuntos.` : ".")), 900);
  }

  _updateHud() {
    const e = this.els;
    if (e.hudScore) e.hudScore.textContent = String(this.score);
    if (e.hudDist) e.hudDist.textContent = `${Math.floor(this.dist)} m`;
    if (e.hudSpeed) e.hudSpeed.textContent = `${Math.round(this.speed * 3.6)} km/h`;
    if (e.hudHearts) e.hudHearts.textContent = "❤".repeat(Math.max(0, this.hearts)) + "♡".repeat(Math.max(0, 3 - this.hearts));
    if (e.hudCoins) e.hudCoins.textContent = String(this.progress.coins);
  }

  // ---------- bucle ----------

  update(dt) {
    const playing = this.state === "playing";
    if (playing) this._step(dt);
    this.boat.position.set(this.bx, this.by + Math.sin(this.time * 6) * 0.04, this.bz);
    this.boat.rotation.z = lerp(this.boat.rotation.z, -this.vx * 0.05, 1 - Math.exp(-8 * dt));
    this.boat.rotation.x = this.by > 0.05 ? lerp(this.boat.rotation.x, 0.25, 1 - Math.exp(-6 * dt)) : lerp(this.boat.rotation.x, 0.04, 1 - Math.exp(-8 * dt));
    this.boat.visible = this.invuln <= 0 || Math.floor(this.time * 14) % 2 === 0;
    this.hero.animate(this.time, "drive", 1);
    for (const t of this.things) {
      if (t.kind === "buoy") t.mesh.position.y = 0.3 + Math.sin(this.time * 2.5 + t.ph) * 0.08;
      else if (t.kind === "coin") t.mesh.rotation.y += dt * 3;
    }
    // la estela
    if (playing && this.by <= 0.02 && Math.random() < 0.6) this.particles.burst(new THREE.Vector3(this.bx + rand(-0.5, 0.5), 0.15, this.bz + 1.7), [0xffffff, 0xd8f6ff], 2, 1.2, 0.5, 1, 0.8);
    // el agua y las orillas acompañan a la lancha; la textura se desliza
    this.water.position.z = this.bz - 60;
    for (const sh of this.shores) sh.position.z = this.bz - 60;
    this.waterTex.offset.y = (-this.bz / 200) * 30 % 1;
    for (const d of this.decos) if (d.position.z > this.bz + 12) d.position.z -= 9 * this.decos.length;
    this._placeCamera(dt);
  }

  _step(dt) {
    this.speed = Math.min(28, this.speed + dt * 0.35);
    this.bz -= this.speed * dt;
    this.dist += this.speed * dt;
    // dirección: dedo (posición), botones o flechas (velocidad)
    let tvx = ((this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0)) * 9;
    if (this.pointerX != null) tvx = clamp((this.pointerX - this.bx) * 8, -11, 11);
    this.vx = lerp(this.vx, tvx, 1 - Math.exp(-10 * dt));
    this.bx = clamp(this.bx + this.vx * dt, -HALF, HALF);
    // salto (después de una ola-rampa)
    if (this.by > 0 || this.vy > 0) {
      this.vy -= 26 * dt;
      this.by = Math.max(0, this.by + this.vy * dt);
      if (this.by === 0 && this.vy < 0) { this.vy = 0; this.particles.burst(new THREE.Vector3(this.bx, 0.2, this.bz), [0xffffff, 0x9fe8ff], 16, 3, 0.5, 4); audio.playBounce(); }
    }
    if (this.invuln > 0) this.invuln -= dt;
    if (this.bz <= this.nextSpawn) this._spawn();
    for (const t of this.things) {
      if (t.done) continue;
      const dx = t.x - this.bx, dz = t.z - this.bz;
      if (Math.abs(dz) > 2.2) continue;
      if (t.kind === "coin") {
        const dy = t.y - (this.by + 0.8);
        if (dx * dx + dz * dz + dy * dy < 1.6) {
          t.done = true; t.mesh.visible = false; this.items++; this.score += 10;
          this.combo++; this.bestCombo = Math.max(this.bestCombo, this.combo);
          audio.playCollect();
          if (this.items % 10 === 0) { earnCoins(this.progress, 2); this.coinsEarned += 2; saveProgress(this.progress); }
        }
      } else if (t.kind === "ramp") {
        if (Math.abs(dx) < 1.4 && Math.abs(dz) < 1.2 && this.by === 0) {
          t.done = true; this.vy = 11; this.by = 0.01; this.jumps++; this.score += 40;
          this.banner("¡Al aire! 🌊"); audio.playJump(); this.haptic(25);
        }
      } else if (this.by < 0.6 && dx * dx + dz * dz < (t.r + 0.75) ** 2) {
        t.done = true;
        this._hit(t.kind === "rock" ? "¡Una roca de chocolate!" : "¡Chocaste una boya!");
        if (this.state !== "playing") return;
      }
    }
    for (let i = this.things.length - 1; i >= 0; i--) if (this.things[i].z > this.bz + 8) { this.scene.remove(this.things[i].mesh); this.things.splice(i, 1); }
    this.meterEnergy("metros", this.dist, 250); // 1 de energía cada 250 m
    if (Math.floor(this.dist / 500) > Math.floor((this.dist - this.speed * dt) / 500)) { this.banner(`🚤 ¡${Math.floor(this.dist / 500) * 500} m!`); audio.playPowerup(); this.score += 100; }
    this._updateHud();
  }

  _placeCamera(dt) {
    const tx = this.bx * 0.6;
    const cx = dt ? lerp(this.camera.position.x, tx, 1 - Math.exp(-5 * dt)) : tx;
    this.camera.position.set(cx, 3.6 + this.by * 0.4, this.bz + 7.2);
    this.camera.lookAt(this.bx * 0.4, 0.6 + this.by * 0.3, this.bz - 8);
    if (this.sun) { this.sun.position.set(this.bx + 6, 14, this.bz + 4); this.sun.target.position.set(this.bx, 0, this.bz - 6); }
  }
}
