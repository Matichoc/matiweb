// Billar de bombones (verano): en una mesa rosada, golpea el bombón blanco para meter los 7 bombones de colores en las
// 6 cajas (troneras). Arrastra el dedo hacia atrás para apuntar y elegir la fuerza; suelta para golpear.
// De a 1: mete todos con la menor cantidad de golpes. De a 2 (por turnos en el mismo celular): si metes, sigues; si no,
// le toca al otro; gana el que mete más. Si el bombón blanco cae, vuelve a su lugar y pierdes puntos (o el turno).
// La física es en 2D (círculos que chocan) y corre en cualquier celular.

import { THREE, Game3D, clamp, lerp, rand } from "./three-kit.js?v=5545779b2a";
import { createMatichico } from "./matichico3d.js?v=5545779b2a";
import * as audio from "./audio.js?v=5545779b2a";
import { BEACH, beachLights, makePalm, makeUmbrella, TwoPlayers, bindDragAim, makeAimArrow, setAimArrow } from "./verano-kit.js?v=5545779b2a";
import { celebrate } from "./celebrate.js?v=5545779b2a";

const W = 2.4; // ancho de la mesa (x)
const L = 4.4; // largo de la mesa (z)
const BR = 0.12; // radio de los bombones
const POCKET_R = 0.19;
const MAX_V = 6.5;
const MAX_SHOTS = 25;
const POCKETS = [[-W / 2, -L / 2], [W / 2, -L / 2], [-W / 2, 0], [W / 2, 0], [-W / 2, L / 2], [W / 2, L / 2]];
const COLORS = [0x5a2d14, 0xd4216c, 0x4fd09a, 0xffc800, 0xf6e7d0, 0x9a5cff, 0xff8a3d];
const HEAD = [0, L / 4]; // donde vuelve el bombón blanco

export class BillarGame extends Game3D {
  constructor(character, progress, els) {
    super("billar", character, progress, els, { fov: 45, bloom: false });
    this.kawaii = true;
    this.ambientOpts = { petals: 6, hearts: 3, stars: 6, radius: 7, height: 6 };
    this.musicTheme = "cozy";
    this.players = new TwoPlayers(this, els.q("btn-players"));
  }

  // ---------- escena ----------

  async build() {
    const s = this.scene;
    const { sun } = beachLights(this, { shadow: 4 });
    this.sun = sun;
    // terraza de playa: piso de madera, palmeras y quitasoles detrás
    const deck = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0xc89b6a, roughness: 0.9 }));
    deck.rotation.x = -Math.PI / 2;
    deck.receiveShadow = true;
    s.add(deck);
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ color: BEACH.sand, roughness: 1 }));
    sand.rotation.x = -Math.PI / 2;
    sand.position.y = -0.02;
    s.add(sand);
    for (const [x, z, k] of [[-6, -4, 1.5], [-6.5, 3, 1.7], [-7, 9, 1.4], [-7, -10, 1.6]]) { const p = makePalm(k); p.position.set(x, 0, z); s.add(p); }
    for (const [x, z] of [[-4.2, -2.8], [-4.4, 2.6]]) { const u = makeUmbrella(1.05); u.position.set(x, 0, z); s.add(u); }
    // mesa: patas y marco de chocolate, paño rosado, troneras (cajitas doradas)
    const choco = new THREE.MeshStandardMaterial({ color: 0x5a2d14, roughness: 0.55 });
    const felt = new THREE.MeshStandardMaterial({ color: 0xe86aa0, roughness: 0.95 });
    const T = 0.16, H = 0.85;
    const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; s.add(m); return m; };
    add(new THREE.BoxGeometry(W, 0.06, L), felt, 0, H, 0).castShadow = false;
    add(new THREE.BoxGeometry(W + 2 * T, 0.12, L + 2 * T), choco, 0, H - 0.08, 0);
    add(new THREE.BoxGeometry(T, 0.12, L + 2 * T), choco, -W / 2 - T / 2, H + 0.06, 0);
    add(new THREE.BoxGeometry(T, 0.12, L + 2 * T), choco, W / 2 + T / 2, H + 0.06, 0);
    add(new THREE.BoxGeometry(W, 0.12, T), choco, 0, H + 0.06, -L / 2 - T / 2);
    add(new THREE.BoxGeometry(W, 0.12, T), choco, 0, H + 0.06, L / 2 + T / 2);
    for (const [x, z] of [[-1, -1.9], [1, -1.9], [-1, 1.9], [1, 1.9]]) add(new THREE.BoxGeometry(0.18, H - 0.1, 0.18), choco, x, (H - 0.1) / 2, z);
    const gold = new THREE.MeshStandardMaterial({ color: 0xffc800, roughness: 0.3, metalness: 0.6 });
    const hole = new THREE.MeshBasicMaterial({ color: 0x1b120c });
    for (const [x, z] of POCKETS) {
      add(new THREE.CylinderGeometry(POCKET_R + 0.04, POCKET_R + 0.04, 0.14, 16), gold, x, H + 0.02, z);
      add(new THREE.CylinderGeometry(POCKET_R, POCKET_R, 0.15, 16), hole, x, H + 0.03, z);
    }
    this.tableY = H + 0.03 + BR;
    this.ballGeo = new THREE.SphereGeometry(BR, 16, 12);
    this.ballMats = COLORS.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.3 }));
    this.cueMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
    this.arrow = makeAimArrow();
    s.add(this.arrow);
    this.balls = [];
    this.hero = null;
    this._ensureHero();
    bindDragAim(this, {
      planeY: this.tableY,
      maxPx: 200,
      canAim: () => this.still && this.state === "playing",
      onAim: (dir, power) => setAimArrow(this.arrow, this.cue.mesh.position, dir, power, 1.6),
      onShoot: (dir, power) => this._shoot(dir, power),
      onCancel: () => { this.arrow.visible = false; },
    });
    // cámara de costado: la mesa cruza la pantalla acostada
    this.camera.position.set(3.7, 4.0, 0);
    this.camera.lookAt(-0.3, H, 0);
  }

  _ensureHero() {
    if (this.hero && this.heroId === this.character.id) { this.hero.setLook(this.look); return; }
    if (this.hero) this.scene.remove(this.hero.group);
    this.hero = createMatichico(this.character, this.outfit, this.look);
    this.heroId = this.character.id;
    this.hero.group.scale.setScalar(0.85);
    this.hero.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.scene.add(this.hero.group);
  }

  setupMission() { this.mission = null; this._missionWon = false; }

  // ---------- partida ----------

  reset() {
    for (const b of this.balls) this.scene.remove(b.mesh);
    this.balls = [];
    const mk = (x, z, mat, cue) => {
      const m = new THREE.Mesh(this.ballGeo, mat);
      m.castShadow = true;
      m.position.set(x, this.tableY, z);
      this.scene.add(m);
      const b = { mesh: m, x, z, vx: 0, vz: 0, cue, in: false };
      this.balls.push(b);
      return b;
    };
    this.cue = mk(HEAD[0], HEAD[1], this.cueMat, true);
    // triángulo de 7 (fila de 1, 2, 4... recortado a 7)
    const rows = [[0], [-1, 1], [-2, 0, 2], [-1, 1]];
    let k = 0;
    rows.forEach((row, r) => row.forEach((c) => { if (k < 7) mk(c * BR * 1.02, -L / 4 - r * BR * 1.75, this.ballMats[k++], false); }));
    this.players.reset();
    this.pocketedBy = [0, 0];
    this.shots = 0;
    this.score = 0;
    this.still = true;
    this.shotPocketed = 0;
    this.scratch = false;
    this.arrow.visible = false;
    this.cheer = 0;
    this._ensureHero();
    this._placeHero();
    this._updateHud();
  }

  onBegin() { if (this.players.n === 2) this.banner(`🎱 Parte ${this.players.name}`); this._updateHud(); }

  _placeHero() {
    // al otro lado de la mesa (no tapa la vista), frente al bombón blanco
    this.hero.group.position.set(-W / 2 - 0.65, 0, clamp(this.cue.z, -L / 2 + 0.3, L / 2 - 0.3));
    this.hero.group.rotation.y = Math.PI / 2;
  }

  _shoot(dir, power) {
    this.arrow.visible = false;
    if (!this.still || this.state !== "playing") return;
    if (!this.countEnergy("tiros", 3)) return; // 1 de energía cada 3 tiros
    const v = 0.6 + power * (MAX_V - 0.6);
    this.cue.vx = dir.x * v; this.cue.vz = dir.z * v;
    this.still = false;
    this.shots++;
    this.shotPocketed = 0;
    this.scratch = false;
    this.kick = 0.35;
    audio.playBounce();
    this.haptic(15);
    this._updateHud();
  }

  _physics(dt) {
    const sub = 6, sdt = dt / sub;
    const live = this.balls.filter((b) => !b.in);
    for (let s = 0; s < sub; s++) {
      for (const b of live) {
        if (b.in) continue; // ya cayó en una caja
        const sp = Math.hypot(b.vx, b.vz);
        if (sp > 0) { const ns = Math.max(0, sp - (0.7 + sp * 0.22) * sdt); b.vx *= ns / sp; b.vz *= ns / sp; }
        b.x += b.vx * sdt; b.z += b.vz * sdt;
        // troneras
        for (const [px, pz] of POCKETS) if (Math.hypot(b.x - px, b.z - pz) < POCKET_R) { this._pocket(b); break; }
        if (b.in) continue;
        // bandas
        const X = W / 2 - BR, Z = L / 2 - BR;
        if (b.x < -X) { b.x = -X; b.vx = Math.abs(b.vx) * 0.8; this._clack(b); }
        if (b.x > X) { b.x = X; b.vx = -Math.abs(b.vx) * 0.8; this._clack(b); }
        if (b.z < -Z) { b.z = -Z; b.vz = Math.abs(b.vz) * 0.8; this._clack(b); }
        if (b.z > Z) { b.z = Z; b.vz = -Math.abs(b.vz) * 0.8; this._clack(b); }
      }
      // choques entre bombones (masas iguales)
      for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
        const a = live[i], c = live[j];
        if (a.in || c.in) continue;
        const dx = c.x - a.x, dz = c.z - a.z, d = Math.hypot(dx, dz);
        if (d >= 2 * BR || d === 0) continue;
        const nx = dx / d, nz = dz / d, over = 2 * BR - d;
        a.x -= nx * over / 2; a.z -= nz * over / 2; c.x += nx * over / 2; c.z += nz * over / 2;
        const rv = (c.vx - a.vx) * nx + (c.vz - a.vz) * nz;
        if (rv < 0) {
          const imp = -rv * 0.97;
          a.vx -= imp * nx; a.vz -= imp * nz; c.vx += imp * nx; c.vz += imp * nz;
          if (-rv > 0.6) audio.playPop();
        }
      }
    }
    for (const b of live) if (Math.hypot(b.vx, b.vz) < 0.03) { b.vx = 0; b.vz = 0; }
    if (live.every((b) => b.in || (b.vx === 0 && b.vz === 0))) this._settled();
  }

  _clack(b) { if (Math.hypot(b.vx, b.vz) > 0.8) audio.playBump(); }

  _pocket(b) {
    b.in = true; b.vx = 0; b.vz = 0;
    b.mesh.visible = false;
    this.particles.burst(b.mesh.position.clone(), [0xffc800, 0xd4216c, 0xfff6e6], 14, 2.5, 0.5, 3);
    if (b.cue) { this.scratch = true; audio.playLose(); this.banner("¡Se cayó el bombón blanco!"); return; }
    this.shotPocketed++;
    this.pocketedBy[this.players.turn]++;
    this.score += 100 + (this.shotPocketed > 1 ? 60 * (this.shotPocketed - 1) : 0);
    audio.playStar();
    this.haptic(30);
    this.cheer = 1.2;
    this.banner(this.shotPocketed > 1 ? `¡Doble! x${this.shotPocketed}` : "¡Adentro! 🍫");
    this._updateHud();
  }

  _settled() {
    if (this.still) return;
    this.still = true;
    if (this.scratch) {
      // el bombón blanco vuelve a su lugar
      this.cue.in = false; this.cue.mesh.visible = true;
      this.cue.x = HEAD[0]; this.cue.z = HEAD[1];
      for (const b of this.balls) if (!b.in && !b.cue && Math.hypot(b.x - this.cue.x, b.z - this.cue.z) < 2.2 * BR) this.cue.z += 3 * BR;
      if (this.players.n === 1) this.score = Math.max(0, this.score - 50);
    }
    const left = this.balls.filter((b) => !b.in && !b.cue).length;
    if (left === 0) return this._end();
    if (this.players.n === 1 && this.shots >= MAX_SHOTS) return this._end();
    if (this.players.n === 2 && (this.shotPocketed === 0 || this.scratch)) {
      this.players.next();
      this.banner(`Turno de ${this.players.name}`);
    }
    this._placeHero();
    this._updateHud();
  }

  _end() {
    const t = this.els.q("gameover-title");
    audio.playVictory();
    celebrate({ big: true });
    if (this.players.n === 2) {
      const [a, b] = this.pocketedBy, [na, nb] = this.players.names;
      if (t) t.textContent = a === b ? "¡Empate!" : `¡Ganó ${a > b ? na : nb}!`;
      this.score = Math.max(a, b) * 100;
      this.finish(`${na} metió ${a} bombones y ${nb} metió ${b}.`);
    } else {
      const left = this.balls.filter((x) => !x.in && !x.cue).length;
      if (left === 0) this.score += Math.max(0, (20 - this.shots) * 25);
      if (t) t.textContent = left === 0 ? "¡Mesa limpia! 🍫" : "¡Se acabaron los tiros!";
      this.finish(`Metiste ${7 - left} de 7 bombones en ${this.shots} tiros: ${this.score} puntos.`);
    }
  }

  _updateHud() {
    const e = this.els;
    if (e.hudBalls) e.hudBalls.textContent = this.players.n === 2 ? `${this.pocketedBy[0]} · ${this.pocketedBy[1]}` : `${this.pocketedBy[0]}/7`;
    if (e.hudShots) e.hudShots.textContent = this.players.n === 2 ? String(this.shots) : `${this.shots}/${MAX_SHOTS}`;
    if (e.hudScore) e.hudScore.textContent = String(this.score);
    const sub = e.q && e.q("hud-sub");
    if (sub) sub.textContent = this.players.n === 2 ? `Turno de ${this.players.name}` : "Arrastra hacia atrás y suelta para golpear";
  }

  // ---------- bucle ----------

  update(dt) {
    if (this.state === "playing" && !this.still) this._physics(dt);
    for (const b of this.balls) if (!b.in) { b.mesh.position.set(b.x, this.tableY, b.z); b.mesh.rotation.x += b.vz * dt / BR; b.mesh.rotation.z -= b.vx * dt / BR; }
    this.kick = Math.max(0, (this.kick || 0) - dt);
    this.cheer = Math.max(0, (this.cheer || 0) - dt);
    this.hero.animate(this.time, this.cheer > 0 ? "cheer" : this.kick > 0 ? "kick" : "idle", 1);
    if (this.sun) { this.sun.position.set(3, 10, 3); this.sun.target.position.set(0, 0, 0); }
  }
}
