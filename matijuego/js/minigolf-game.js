// Minigolf en la playa (verano): 9 hoyos con castillos de arena, palmeras, trampas de arena y cangrejos que se
// mueven. Arrastra el dedo hacia atrás (como una honda) para apuntar y elegir la fuerza, y suelta para golpear.
// Se puede jugar de a 1 (puntos según los golpes) o de a 2 por turnos en el mismo celular (gana el de menos golpes).
// La física es en 2D sobre el suelo (rápida en cualquier celular) y cada hoyo es un rectángulo con obstáculos.

import { THREE, Game3D, clamp, lerp, rand } from "./three-kit.js?v=5545779b2a";
import { createMatichico } from "./matichico3d.js?v=5545779b2a";
import * as audio from "./audio.js?v=5545779b2a";
import { BEACH, beachLights, makePalm, makeUmbrella, TwoPlayers, bindDragAim, makeAimArrow, setAimArrow } from "./verano-kit.js?v=5545779b2a";
import { celebrate } from "./celebrate.js?v=5545779b2a";

const BALL_R = 0.14;
const CUP_R = 0.24;
const MAX_V = 9.5;
const MAX_STROKES = 7;

// Cada hoyo: cancha w×d (centrada en 0,0), salida y hoyo, par, paredes (rectángulos x,z,w,d), obstáculos redondos
// (castillos, palmeras, rocas: x,z,r,tipo), arena (rectángulos que frenan) y cangrejos (van y vienen entre a y b).
const HOLES = [
  { w: 3.2, d: 9, tee: [0, 3.6], cup: [0, -3.5], par: 2 },
  { w: 4, d: 9, tee: [0, 3.6], cup: [0, -3.4], par: 3, walls: [[0, 0, 2.6, 0.3]] },
  { w: 4, d: 9, tee: [0, 3.6], cup: [0, -3.4], par: 2, round: [[0, 0, 0.75, "castle"]], sand: [[-1.3, -1.6, 1.2, 1.6], [1.3, 1.4, 1.2, 1.6]] },
  { w: 4, d: 10, tee: [-1.2, 4.2], cup: [1.2, -4.1], par: 3, walls: [[-0.7, 1.6, 2.6, 0.3], [0.7, -1.4, 2.6, 0.3]] },
  { w: 3.6, d: 9, tee: [0, 3.6], cup: [0, -3.5], par: 2, crabs: [[-1.4, 0, 1.4, 0, 1.6]] },
  { w: 6, d: 8, tee: [-2.3, 3], cup: [2.3, -2.9], par: 3, round: [[-0.8, 0.6, 0.5, "palm"], [1, 1.4, 0.5, "palm"], [0.4, -1.3, 0.5, "palm"]] },
  { w: 3, d: 11, tee: [0, 4.6], cup: [0, -4.5], par: 3, round: [[-0.75, 1.5, 0.35, "rock"], [0.75, -0.5, 0.35, "rock"], [-0.6, -2.6, 0.35, "rock"]], sand: [[0, 3, 3, 0.9]] },
  { w: 4.4, d: 10, tee: [0, 4.2], cup: [0, -4.2], par: 3, round: [[0, -1.6, 0.6, "castle"]], crabs: [[-1.6, 1.3, 1.6, 1.3, 1.4], [1.6, -3, -1.6, -3, 1.9]] },
  { w: 4.4, d: 14, tee: [-1.4, 6.2], cup: [1.4, -6.1], par: 4, walls: [[-0.8, 3.4, 2.8, 0.3], [0.8, 0.2, 2.8, 0.3], [-0.8, -2.9, 2.8, 0.3]], crabs: [[-1.6, -4.7, 1.6, -4.7, 2.2]] },
];

export class MinigolfGame extends Game3D {
  constructor(character, progress, els) {
    super("minigolf", character, progress, els, { fov: 45, bloom: false });
    this.kawaii = true;
    this.ambientOpts = { petals: 8, hearts: 3, stars: 6, radius: 9, height: 7 };
    this.musicTheme = "chill";
    this.players = new TwoPlayers(this, els.q("btn-players"));
  }

  // ---------- escena ----------

  async build() {
    const s = this.scene;
    const { sun } = beachLights(this, { shadow: 9 });
    this.sun = sun;
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ color: BEACH.sand, roughness: 1 }));
    sand.rotation.x = -Math.PI / 2;
    sand.position.y = -0.02;
    sand.receiveShadow = true;
    s.add(sand);
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(200, 60), new THREE.MeshStandardMaterial({ color: BEACH.sea, roughness: 0.35 }));
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(-48, 0.0, 0);
    sea.rotation.z = Math.PI / 2;
    s.add(sea);
    for (const [x, z, k] of [[-9, -6, 1.4], [-11, 3, 1.6], [-10, 9, 1.3], [-7, -12, 1.8], [-12, -3, 1.5], [-8, 13, 1.7]]) {
      const p = makePalm(k);
      p.position.set(x, 0, z);
      s.add(p);
    }
    // detrás de la cancha (arriba en la pantalla): quitasoles, palmeras y una pelota de playa
    for (const [x, z, k] of [[-5.2, -4.5, 1], [-5.6, 3.5, 1.1]]) { const u = makeUmbrella(k); u.position.set(x, 0, z); s.add(u); }
    for (const [x, z, k] of [[-7.5, 0, 1.4], [-7, -8, 1.6], [-7.2, 8, 1.5]]) { const pm = makePalm(k); pm.position.set(x, 0, z); s.add(pm); }
    const beachBall = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 10), new THREE.MeshStandardMaterial({ color: 0x4fb8ff, roughness: 0.4 }));
    beachBall.position.set(-4.6, 0.4, -0.5);
    beachBall.castShadow = true;
    s.add(beachBall);
    this.course = new THREE.Group();
    s.add(this.course);
    this.mats = {
      turf: new THREE.MeshStandardMaterial({ color: 0x4fbf5a, roughness: 0.95 }),
      wall: new THREE.MeshStandardMaterial({ color: 0xd4216c, roughness: 0.5 }),
      wall2: new THREE.MeshStandardMaterial({ color: 0xfff6e6, roughness: 0.5 }),
      sand: new THREE.MeshStandardMaterial({ color: 0xf6e2b3, roughness: 1 }),
      cup: new THREE.MeshBasicMaterial({ color: 0x1b120c }),
      castle: new THREE.MeshStandardMaterial({ color: 0xe9c98b, roughness: 1, flatShading: true }),
      rock: new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.8, flatShading: true }),
      crab: new THREE.MeshStandardMaterial({ color: 0xff5a3c, roughness: 0.5 }),
      white: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }),
      flag: new THREE.MeshStandardMaterial({ color: 0xffc800, side: THREE.DoubleSide }),
    };
    // pelota (un bombón blanco con brillo) y la flecha de apuntar
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 16, 12), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 }));
    this.ball.castShadow = true;
    s.add(this.ball);
    this.arrow = makeAimArrow();
    s.add(this.arrow);
    this.hero = null;
    this._ensureHero();
    bindDragAim(this, {
      planeY: 0.05,
      canAim: () => this.ballStill && !this.inCup && this.state === "playing",
      onAim: (dir, power) => { this.aim = { dir, power }; setAimArrow(this.arrow, this.ball.position, dir, power); },
      onShoot: (dir, power) => this._shoot(dir, power),
      onCancel: () => { this.arrow.visible = false; },
    });
  }

  _ensureHero() {
    if (this.hero && this.heroId === this.character.id) { this.hero.setLook(this.look); return; }
    if (this.hero) this.scene.remove(this.hero.group);
    this.hero = createMatichico(this.character, this.outfit, this.look);
    this.heroId = this.character.id;
    this.hero.group.scale.setScalar(0.7);
    this.hero.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.scene.add(this.hero.group);
  }

  setupMission() { this.mission = null; this._missionWon = false; }

  onBegin() {
    this.banner(`⛳ Hoyo 1 · par ${HOLES[0].par}${this.players.n === 2 ? ` · turno de ${this.players.name}` : ""}`);
    this._updateHud();
  }

  // ---------- cancha ----------

  _buildHole(n) {
    const h = HOLES[n];
    this.hole = h;
    for (const c of [...this.course.children]) this.course.remove(c);
    const box = (w, hgt, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, d), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; this.course.add(m); return m; };
    box(h.w, 0.1, h.d, this.mats.turf, 0, 0.0, 0).castShadow = false;
    // bordes a rayas (rosado y blanco)
    const T = 0.25;
    box(h.w + 2 * T, 0.3, T, this.mats.wall, 0, 0.15, -h.d / 2 - T / 2);
    box(h.w + 2 * T, 0.3, T, this.mats.wall, 0, 0.15, h.d / 2 + T / 2);
    box(T, 0.3, h.d, this.mats.wall2, -h.w / 2 - T / 2, 0.15, 0);
    box(T, 0.3, h.d, this.mats.wall2, h.w / 2 + T / 2, 0.15, 0);
    for (const [x, z, w, d] of h.walls || []) box(w, 0.3, d, this.mats.wall, x, 0.15, z);
    for (const [x, z, w, d] of h.sand || []) { const m = box(w, 0.02, d, this.mats.sand, x, 0.06, z); m.castShadow = false; }
    for (const [x, z, r, kind] of h.round || []) this.course.add(this._roundObstacle(x, z, r, kind));
    // hoyo con bandera
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(CUP_R, CUP_R, 0.02, 20), this.mats.cup);
    cup.position.set(h.cup[0], 0.06, h.cup[1]);
    this.course.add(cup);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.4, 6), this.mats.white);
    pole.position.set(h.cup[0], 0.75, h.cup[1]);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.32), this.mats.flag);
    flag.position.set(h.cup[0] + 0.26, 1.28, h.cup[1]);
    this.flag = flag;
    this.course.add(pole, flag);
    // cangrejos
    this.crabs = (h.crabs || []).map(([ax, az, bx, bz, sp]) => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), this.mats.crab);
      body.scale.set(1.3, 0.6, 1);
      for (const sx of [-1, 1]) {
        const claw = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), this.mats.crab);
        claw.position.set(sx * 0.38, 0.05, -0.18);
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), this.mats.white);
        eye.position.set(sx * 0.1, 0.2, -0.15);
        g.add(claw, eye);
      }
      g.add(body);
      g.position.set(ax, 0.2, az);
      this.course.add(g);
      return { mesh: g, a: [ax, az], b: [bx, bz], sp, t: rand(0, 1), x: ax, z: az, r: 0.36 };
    });
    // cámara de costado (la cancha cruza toda la pantalla acostada: la salida a la izquierda y el hoyo a la derecha)
    const size = Math.max(h.d, h.w * 1.8);
    this.camGoal = { pos: new THREE.Vector3(h.w / 2 + size * 0.5 + 1, size * 0.5 + 1.5, 0), look: new THREE.Vector3(-0.8, 0, 0) };
  }

  _roundObstacle(x, z, r, kind) {
    const g = new THREE.Group();
    if (kind === "castle") {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.1, 0.6, 8), this.mats.castle);
      base.position.y = 0.3;
      g.add(base);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const tw = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.28, r * 0.3, 0.9, 6), this.mats.castle);
        tw.position.set(Math.cos(a) * r * 0.7, 0.45, Math.sin(a) * r * 0.7);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(r * 0.32, 0.3, 6), this.mats.wall);
        roof.position.set(tw.position.x, 1.05, tw.position.z);
        g.add(tw, roof);
      }
    } else if (kind === "palm") {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.4, r * 0.5, 0.4, 8), this.mats.rock);
      trunk.position.y = 0.2;
      g.add(trunk);
      const p = makePalm(0.6);
      p.position.y = 0.2;
      g.add(p);
    } else {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), this.mats.rock);
      rock.position.y = r * 0.6;
      g.add(rock);
    }
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    g.position.set(x, 0, z);
    return g;
  }

  // ---------- partida ----------

  reset() {
    this.players.reset();
    this.holeN = 0;
    this.strokesBy = [[], []]; // golpes de cada jugador en cada hoyo
    this.score = 0;
    this.holesInOne = 0;
    this.camPos = null;
    this._ensureHero();
    this._startHole();
  }

  _startHole() {
    this._buildHole(this.holeN);
    const h = this.hole;
    this.bx = h.tee[0]; this.bz = h.tee[1];
    this.vx = 0; this.vz = 0;
    this.ballStill = true;
    this.inCup = false;
    this.strokes = 0;
    this.arrow.visible = false;
    this.ball.visible = true;
    this.ball.position.set(this.bx, BALL_R + 0.05, this.bz);
    this.cheer = 0;
    this._placeHero();
    this._updateHud();
    if (this.state === "playing") this.banner(`⛳ Hoyo ${this.holeN + 1} · par ${h.par}${this.players.n === 2 ? ` · turno de ${this.players.name}` : ""}`);
  }

  _placeHero() {
    const h = this.hole;
    const dx = h.cup[0] - this.bx, dz = h.cup[1] - this.bz;
    const a = Math.atan2(dx, dz);
    this.hero.group.position.set(this.bx - Math.cos(a) * 0.55, 0.05, this.bz + Math.sin(a) * 0.55);
    this.hero.group.rotation.y = a + Math.PI / 2;
  }

  _shoot(dir, power) {
    this.arrow.visible = false;
    if (!this.ballStill || this.inCup || this.state !== "playing") return;
    if (!this.countEnergy("golpes", 3)) return; // 1 de energía cada 3 golpes
    const v = 1.2 + power * (MAX_V - 1.2);
    this.vx = dir.x * v; this.vz = dir.z * v;
    this.ballStill = false;
    this.strokes++;
    this.kick = 0.35;
    audio.playBounce();
    this.haptic(20);
    this._updateHud();
  }

  _physics(dt) {
    const h = this.hole;
    const sub = 4, sdt = dt / sub;
    for (let i = 0; i < sub && !this.inCup; i++) {
      const sp = Math.hypot(this.vx, this.vz);
      if (sp > 0) {
        // roce: más en la arena
        let fr = 2.4 + sp * 0.35;
        for (const [x, z, w, d] of h.sand || []) if (Math.abs(this.bx - x) < w / 2 && Math.abs(this.bz - z) < d / 2) fr = 9 + sp * 1.5;
        const ns = Math.max(0, sp - fr * sdt);
        this.vx *= ns / sp; this.vz *= ns / sp;
      }
      this.bx += this.vx * sdt; this.bz += this.vz * sdt;
      // bordes de la cancha
      const X = h.w / 2 - BALL_R, Z = h.d / 2 - BALL_R;
      if (this.bx < -X) { this.bx = -X; this.vx = Math.abs(this.vx) * 0.78; this._bump(); }
      if (this.bx > X) { this.bx = X; this.vx = -Math.abs(this.vx) * 0.78; this._bump(); }
      if (this.bz < -Z) { this.bz = -Z; this.vz = Math.abs(this.vz) * 0.78; this._bump(); }
      if (this.bz > Z) { this.bz = Z; this.vz = -Math.abs(this.vz) * 0.78; this._bump(); }
      // paredes interiores (rectángulos)
      for (const [x, z, w, d] of h.walls || []) this._rect(x, z, w, d);
      // obstáculos redondos y cangrejos
      for (const [x, z, r] of h.round || []) this._circle(x, z, r);
      for (const c of this.crabs) this._circle(c.x, c.z, c.r);
      // ¿al hoyo?
      const cx = this.bx - h.cup[0], cz = this.bz - h.cup[1];
      const dc = Math.hypot(cx, cz);
      const v = Math.hypot(this.vx, this.vz);
      if (dc < CUP_R) {
        if (v < 4.2) { this._holed(); return; }
        // muy rápido: pasa de largo y se desvía un poco
        this.vx += (-cx / (dc || 1)) * 0.4; this.vz += (-cz / (dc || 1)) * 0.4;
      } else if (dc < CUP_R * 2.2 && v < 1.6) {
        // cerca y lento: el hoyo la "chupa" un poquito
        this.vx -= (cx / dc) * 1.6 * sdt; this.vz -= (cz / dc) * 1.6 * sdt;
      }
    }
    if (Math.hypot(this.vx, this.vz) < 0.06 && !this.inCup) {
      this.vx = 0; this.vz = 0;
      if (!this.ballStill) {
        this.ballStill = true;
        if (this.strokes >= MAX_STROKES) { this.banner("Máximo de golpes: ¡al siguiente!"); this._holed(true); return; }
        this._placeHero();
      }
    }
  }

  _bump() { if (Math.hypot(this.vx, this.vz) > 1.2) audio.playBump(); }

  _rect(x, z, w, d) {
    const px = clamp(this.bx, x - w / 2, x + w / 2), pz = clamp(this.bz, z - d / 2, z + d / 2);
    const dx = this.bx - px, dz = this.bz - pz;
    const dist = Math.hypot(dx, dz);
    if (dist >= BALL_R || dist === 0) return;
    const nx = dx / dist, nz = dz / dist;
    this.bx = px + nx * BALL_R; this.bz = pz + nz * BALL_R;
    const vn = this.vx * nx + this.vz * nz;
    if (vn < 0) { this.vx -= 1.78 * vn * nx; this.vz -= 1.78 * vn * nz; this._bump(); }
  }

  _circle(x, z, r) {
    const dx = this.bx - x, dz = this.bz - z;
    const dist = Math.hypot(dx, dz), min = r + BALL_R;
    if (dist >= min || dist === 0) return;
    const nx = dx / dist, nz = dz / dist;
    this.bx = x + nx * min; this.bz = z + nz * min;
    const vn = this.vx * nx + this.vz * nz;
    if (vn < 0) { this.vx -= 1.75 * vn * nx; this.vz -= 1.75 * vn * nz; this._bump(); }
  }

  _holed(max = false) {
    this.inCup = true;
    this.ballStill = true;
    this.vx = 0; this.vz = 0;
    const h = this.hole;
    const p = this.players.turn;
    this.strokesBy[p][this.holeN] = this.strokes;
    if (!max) {
      this.ball.position.set(h.cup[0], 0.0, h.cup[1]);
      const diff = this.strokes - h.par;
      const msg = this.strokes === 1 ? "⛳ ¡HOYO EN UNO!" : diff <= -2 ? "🦅 ¡Águila!" : diff === -1 ? "🐦 ¡Birdie!" : diff === 0 ? "👍 ¡Par!" : `+${diff} sobre el par`;
      this.banner(msg);
      if (this.strokes === 1) { this.holesInOne++; celebrate({ big: true }); audio.playVictory(); this.haptic(80); }
      else if (diff <= 0) { audio.playStar(); celebrate(); }
      else audio.playCollect();
      this.particles.burst(new THREE.Vector3(h.cup[0], 0.3, h.cup[1]), [0xffc800, 0xd4216c, 0xfff6e6], 24, 4, 0.7, 4);
      this.cheer = 1.6;
    }
    // puntos (modo de 1 jugador): mejor que el par = más puntos
    if (this.players.n === 1) this.score += Math.max(10, (h.par + 3 - this.strokes) * 30) + (this.strokes === 1 ? 150 : 0);
    this._updateHud();
    setTimeout(() => this._afterHole(), 1600);
  }

  _afterHole() {
    if (this.state !== "playing") return;
    if (this.players.n === 2 && this.players.turn === 0) {
      this.players.next(); // ahora juega el Invitado el mismo hoyo
      this._startHole();
      return;
    }
    if (this.players.n === 2) this.players.turn = 0;
    this.holeN++;
    if (this.holeN >= HOLES.length) return this._end();
    this._startHole();
  }

  _end() {
    const tot = (p) => this.strokesBy[p].reduce((a, b) => a + (b || 0), 0);
    const par = HOLES.reduce((a, h) => a + h.par, 0);
    audio.playVictory();
    celebrate({ big: true });
    if (this.players.n === 2) {
      const [a, b] = [tot(0), tot(1)];
      const [na, nb] = this.players.names;
      const win = a === b ? "¡Empate!" : `¡Ganó ${a < b ? na : nb}!`;
      const t = this.els.q("gameover-title");
      if (t) t.textContent = win;
      this.score = Math.max(0, (par * 2 - Math.min(a, b)) * 10);
      this.finish(`${na}: ${a} golpes · ${nb}: ${b} golpes (par de la cancha: ${par}).`);
    } else {
      const t = this.els.q("gameover-title");
      if (t) t.textContent = "¡Terminaste los 9 hoyos!";
      const a = tot(0);
      this.finish(`Hiciste ${a} golpes (par ${par}${a - par > 0 ? `, +${a - par}` : a - par < 0 ? `, ${a - par}` : ""})${this.holesInOne ? ` con ${this.holesInOne} hoyo${this.holesInOne > 1 ? "s" : ""} en uno` : ""}: ${this.score} puntos.`);
    }
  }

  _updateHud() {
    const e = this.els;
    if (e.hudHole) e.hudHole.textContent = `${this.holeN + 1}/9`;
    if (e.hudStrokes) e.hudStrokes.textContent = String(this.strokes || 0);
    const tot = (p) => this.strokesBy[p].reduce((a, b) => a + (b || 0), 0) + (this.players.turn === p && !this.inCup ? this.strokes || 0 : 0);
    if (e.hudTotal) e.hudTotal.textContent = this.players.n === 2 ? `${tot(0)} · ${tot(1)}` : String(tot(0));
    if (e.hudScore) e.hudScore.textContent = String(this.score);
    const sub = e.q && e.q("hud-sub");
    if (sub) sub.textContent = this.players.n === 2 ? `Turno de ${this.players.name}` : "Arrastra hacia atrás y suelta para golpear";
  }

  // ---------- bucle ----------

  update(dt) {
    const playing = this.state === "playing";
    if (this.hole) {
      for (const c of this.crabs) {
        if (playing) c.t += dt / c.sp;
        const k = (Math.sin(c.t * Math.PI) + 1) / 2;
        c.x = lerp(c.a[0], c.b[0], k); c.z = lerp(c.a[1], c.b[1], k);
        c.mesh.position.set(c.x, 0.2 + Math.abs(Math.sin(c.t * 12)) * 0.04, c.z);
      }
      if (playing && !this.ballStill) this._physics(dt);
      if (!this.inCup) this.ball.position.set(this.bx, BALL_R + 0.05, this.bz);
      if (this.flag) this.flag.rotation.y = Math.sin(this.time * 3) * 0.25;
    }
    this.kick = Math.max(0, (this.kick || 0) - dt);
    this.cheer = Math.max(0, (this.cheer || 0) - dt);
    this.hero.animate(this.time, this.cheer > 0 ? "cheer" : this.kick > 0 ? "kick" : "idle", 1);
    // cámara
    if (this.camGoal) {
      if (!this.camPos) this.camPos = this.camGoal.pos.clone();
      this.camPos.lerp(this.camGoal.pos, 1 - Math.exp(-3 * dt));
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(this.camGoal.look);
      if (this.sun) { this.sun.position.set(4, 14, 6); this.sun.target.position.set(0, 0, 0); }
    }
  }
}
