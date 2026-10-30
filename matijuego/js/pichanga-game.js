// Pichanga Choco: partido de fútbol 3 contra 3 en una cancha chica, con cámara elevada.
// Manejas a uno de tus dos jugadores de campo (anillo dorado y flecha); tu compañero, los arqueros y los rivales son IA local.
// La simulación (reglas, IA, pelota) está en js/pichanga-sim.js; aquí se dibuja y se controla.
//
// Controles: mover con el joystick o WASD/flechas · Pase (Espacio/J): pasa; sin la pelota quita o la pide · Tiro (K/L) ·
// Cambiar (Q/E/Tab): pasa al otro jugador de campo · Pausa (P/Esc).

import { THREE, clamp, canvasTexture, makeBunting, makeLogo } from "./three-kit.js?v=630e2f1eb3";
import { createMatichico } from "./matichico3d.js?v=630e2f1eb3";
import { CHARACTERS, getOutfit } from "./characters.js?v=630e2f1eb3";
import { choiceOf, choiceOption } from "./adventure.js?v=630e2f1eb3";
import { MatchGame } from "./match-game.js?v=630e2f1eb3";
import { createMatch, stepMatch, PITCH } from "./pichanga-sim.js?v=630e2f1eb3";
import * as audio from "./audio.js?v=630e2f1eb3";

const GAME_ID = "pichanga";
const L = PITCH.L;
const W = PITCH.W;
const RESTART_NAMES = { kickoff: "Saque inicial", kickin: "Saque de banda", goalkick: "Saque de arco", corner: "Córner" };

function pitchTexture() {
  return canvasTexture(1536, 1024, (g, w, h) => {
    const mx = (x) => ((x + L / 2 + 1.5) / (L + 3)) * w;
    const mz = (z) => ((z + W / 2 + 1.5) / (W + 3)) * h;
    for (let i = 0; i < 12; i++) { g.fillStyle = i % 2 ? "#4fae4f" : "#46a347"; g.fillRect((i * w) / 12, 0, w / 12 + 1, h); }
    g.strokeStyle = "rgba(255,255,255,0.95)";
    g.lineWidth = 8;
    g.strokeRect(mx(-L / 2), mz(-W / 2), mx(L / 2) - mx(-L / 2), mz(W / 2) - mz(-W / 2));
    g.beginPath(); g.moveTo(mx(0), mz(-W / 2)); g.lineTo(mx(0), mz(W / 2)); g.stroke();
    g.beginPath(); g.arc(mx(0), mz(0), (3 / (L + 3)) * w, 0, Math.PI * 2); g.stroke();
    for (const s of [-1, 1]) {
      const x0 = mx(s * L / 2);
      const x1 = mx(s * (L / 2 - PITCH.boxX));
      g.strokeRect(Math.min(x0, x1), mz(-PITCH.boxZ), Math.abs(x1 - x0), mz(PITCH.boxZ) - mz(-PITCH.boxZ));
    }
    g.fillStyle = "#fff";
    g.beginPath(); g.arc(mx(0), mz(0), 9, 0, Math.PI * 2); g.fill();
  });
}

function ballTexture() {
  return canvasTexture(256, 128, (g, w, h) => {
    g.fillStyle = "#fff6e6";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#3a1a08";
    for (const [x, y] of [[0.12, 0.3], [0.37, 0.7], [0.62, 0.3], [0.87, 0.7], [0.5, 0.1]]) {
      g.beginPath();
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 - Math.PI / 2; g.lineTo(w * x + Math.cos(a) * 14, h * y + Math.sin(a) * 14); }
      g.fill();
    }
  });
}

export class PichangaGame extends MatchGame {
  constructor(character, progress, els) {
    super(GAME_ID, "pichanga", character, progress, els, { fov: 46 });
    this.kawaii = true;
    this.ambientOpts = { petals: 18, hearts: 0, stars: 10, radius: 18, height: 9 };
    this.musicTheme = "sport";
    this.m = null;
    this.camFocus = new THREE.Vector3();
  }

  // ---------- escena ----------

  async build() {
    const s = this.scene;
    s.background = new THREE.Color(0x8fd0f2);
    s.fog = new THREE.Fog(0x9fd8f5, 45, 110);
    s.add(new THREE.HemisphereLight(0xfff6e0, 0x4a7a40, 1.2));
    this.sun = new THREE.DirectionalLight(0xfff0d2, 2.3);
    this.sun.position.set(-10, 22, 14);
    this.sun.castShadow = !this.lite; // en celulares, sombras simples (ver MatchGame._makeBlobs)
    const sm = this.coarse ? 1024 : 2048;
    this.sun.shadow.mapSize.set(sm, sm);
    const sc = this.sun.shadow.camera;
    sc.left = -19; sc.right = 19; sc.top = 14; sc.bottom = -14; sc.near = 1; sc.far = 70;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.04;
    s.add(this.sun, this.sun.target);
    this.onLowQuality = () => { this.sun.castShadow = false; if (this.blobs) this.blobs.visible = true; };

    const pitch = new THREE.Mesh(new THREE.PlaneGeometry(L + 3, W + 3), new THREE.MeshStandardMaterial({ map: pitchTexture(), roughness: 0.95 }));
    pitch.rotation.x = -Math.PI / 2;
    pitch.receiveShadow = true;
    s.add(pitch);
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0x7cc65a, roughness: 1 }));
    outer.rotation.x = -Math.PI / 2;
    outer.position.y = -0.02;
    s.add(outer);
    const lg = makeLogo(4);
    lg.rotation.x = -Math.PI / 2;
    lg.position.set(0, 0.03, 0);
    lg.scale.setScalar(0.55);
    s.add(lg);
    // tablas bajas alrededor, de colores
    const boardMat = [new THREE.MeshStandardMaterial({ color: 0xd4216c, roughness: 0.6 }), new THREE.MeshStandardMaterial({ color: 0xffc800, roughness: 0.6 })];
    const boards = [];
    for (let i = 0; i < 16; i++) {
      const x = -L / 2 - 1 + (i + 0.5) * ((L + 2) / 16);
      for (const sz of [-1, 1]) boards.push([x, sz * (W / 2 + 1.4), (L + 2) / 16 - 0.1, 0.12, i % 2]);
    }
    for (let i = 0; i < 10; i++) {
      const z = -W / 2 - 1.4 + (i + 0.5) * ((W + 2.8) / 10);
      if (Math.abs(z) < PITCH.goalW / 2 + 0.8) continue;
      for (const sx of [-1, 1]) boards.push([sx * (L / 2 + 1.4), z, 0.12, (W + 2.8) / 10 - 0.1, i % 2]);
    }
    // todas las tablas de un color en una sola pieza (un dibujo por color en vez de uno por tabla)
    const unit = new THREE.BoxGeometry(1, 0.55, 1);
    const tmp = new THREE.Object3D();
    for (const c of [0, 1]) {
      const list = boards.filter((bd) => bd[4] === c);
      const inst = new THREE.InstancedMesh(unit, boardMat[c], list.length);
      list.forEach(([x, z, w, d], i) => { tmp.position.set(x, 0.27, z); tmp.scale.set(w, 1, d); tmp.updateMatrix(); inst.setMatrixAt(i, tmp.matrix); });
      inst.castShadow = !this.lite;
      s.add(inst);
    }
    s.add(makeBunting(new THREE.Vector3(-L / 2, 3.4, -W / 2 - 2.2), new THREE.Vector3(L / 2, 3.4, -W / 2 - 2.2), { count: 26, sag: 0.9 }));
    for (const x of [-L / 2, 0, L / 2]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.6, 8), new THREE.MeshStandardMaterial({ color: 0x4b2e1e }));
      pole.position.set(x, 1.8, -W / 2 - 2.2);
      s.add(pole);
    }
    this._buildGoal(-1);
    this._buildGoal(1);

    this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.24, 22, 16), new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: 0.5 }));
    this.ball.castShadow = !this.lite;
    s.add(this.ball);
    this.ballShadow = new THREE.Mesh(new THREE.CircleGeometry(0.3, 18), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }));
    this.ballShadow.rotation.x = -Math.PI / 2;
    s.add(this.ballShadow);

    // indicadores: anillo dorado + flecha sobre el jugador que manejas; anillos finos del color de cada equipo
    const ringGeo = new THREE.RingGeometry(0.55, 0.72, 32);
    ringGeo.rotateX(-Math.PI / 2);
    this.activeRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd400, transparent: true, opacity: 0.95, depthWrite: false }));
    this.activeRing.renderOrder = 5;
    s.add(this.activeRing);
    this.activeArrow = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.5, 4), new THREE.MeshBasicMaterial({ color: 0xffd400 }));
    this.activeArrow.rotation.x = Math.PI;
    s.add(this.activeArrow);
    this.teamRingGeo = new THREE.RingGeometry(0.5, 0.6, 28);
    this.teamRingGeo.rotateX(-Math.PI / 2);
    this._makeBlobs(6);
  }

  _buildGoal(side) {
    const g = new THREE.Group();
    g.position.set(side * L / 2, 0, 0);
    const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 });
    const gw = PITCH.goalW;
    const gh = PITCH.goalH;
    for (const sz of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, gh, 10), white);
      post.position.set(0, gh / 2, sz * gw / 2);
      post.castShadow = true;
      g.add(post);
    }
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, gw, 10), white);
    bar.rotation.x = Math.PI / 2;
    bar.position.y = gh;
    g.add(bar);
    const netMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(gw, gh), netMat);
    back.rotation.y = Math.PI / 2;
    back.position.set(side * 1.1, gh / 2, 0);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(1.1, gw), netMat);
    top.rotation.x = -Math.PI / 2;
    top.position.set(side * 0.55, gh, 0);
    g.add(back, top);
    for (const sz of [-1, 1]) {
      const sideNet = new THREE.Mesh(new THREE.PlaneGeometry(1.1, gh), netMat);
      sideNet.position.set(side * 0.55, gh / 2, sz * gw / 2);
      g.add(sideNet);
    }
    this.scene.add(g);
  }

  _teamColors() {
    const mine = choiceOption("cancha", choiceOf(this.progress, "cancha"));
    const rival = this.rival();
    let rc = rival.color;
    const my = mine ? mine.color : 0xd4216c;
    if (rc === my) rc = 0x7a3f22;
    return [my, rc];
  }

  /** Arma (o rearma) los 6 jugadores: tu Matichico es el jugador 1 de tu equipo. */
  _makePlayers() {
    const cols = this._teamColors();
    const key = `${this.character.id}|${cols.join(",")}|${Object.values(this.look).join(",")}`;
    if (this.models && this.modelKey === key) return;
    if (this.models) for (const md of this.models) this.scene.remove(md.group, md.ring);
    this.modelKey = key;
    const others = CHARACTERS.filter((c) => c.id !== this.character.id);
    const pick = (i) => others[i % others.length];
    const charFor = [pick(0), this.character, pick(1), pick(2), pick(3), pick(4)];
    this.models = this.m.players.map((p, i) => {
      const ch = charFor[i];
      const mine = p.team === 0 && i === 1;
      const hero = mine ? createMatichico(ch, this.outfit, this.look) : createMatichico(ch, getOutfit("polera"));
      const jersey = p.role === "gk" ? (p.team === 0 ? 0x35c0ff : 0x9a5cff) : cols[p.team];
      if (!mine) hero.setOutfit({ jersey, trim: 0xffffff });
      hero.group.scale.setScalar(1.02);
      if (!this.lite) hero.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      hero.group.userData.noToon = true;
      this.scene.add(hero.group);
      const ring = new THREE.Mesh(this.teamRingGeo, new THREE.MeshBasicMaterial({ color: p.role === "gk" ? 0xffffff : cols[p.team], transparent: true, opacity: 0.75, depthWrite: false }));
      ring.renderOrder = 4;
      this.scene.add(ring);
      return { group: hero.group, hero, ring, kickT: 0, mood: null };
    });
  }

  // ---------- partida ----------

  reset() {
    this.m = createMatch({ difficulty: this.diff, golden: this.mode === "copa", seed: (Date.now() & 0xffff) + 1 });
    this.m.events.length = 0;
    this._makePlayers();
    this.score = 0;
    this.paused = false;
    this.endShown = false;
    this._sync(0, true);
    this._camera(0, true);
    this._hud(true);
    this._passLabel = "";
  }

  onBegin() {
    this.banner(this.mode === "copa" ? `🏆 ${this.rival().roundName}: ¡a jugar!` : "⚽ ¡A jugar!");
    audio.playCountdown(true);
    this._hint(this.diff === "accesible" ? "Tu jugador tiene el anillo dorado. Para quitar, ¡choca al rival que tiene la pelota!" : "Tu jugador tiene el anillo dorado. ¡Pasa la pelota y busca el arco!", 3.5);
  }

  update(dt) {
    const m = this.m;
    if (!m) return;
    if (this.state === "playing" && !this.paused) {
      stepMatch(m, dt, this._readInput());
      for (const e of m.events.splice(0)) this._onEvent(e);
      if (m.over && !this.endShown) {
        this.endShown = true;
        const st = m.stats;
        const poss = Math.round((100 * st.poss[0]) / Math.max(1, st.poss[0] + st.poss[1]));
        this.endMatch(m.score[0], m.score[1], `Tiros: ${st.shots[0]} · Pases: ${st.passes[0]} · Tenencia: ${poss} %.`);
      }
    }
    this._sync(dt);
    this._camera(dt);
    this._hud();
    if (this._hintT > 0) { this._hintT -= dt; if (this._hintT <= 0) this._hint(""); }
  }

  _onEvent(e) {
    const m = this.m;
    const mine = e.team === 0;
    const pos = (id) => { const p = m.players[id]; return new THREE.Vector3(p.x, 2.2, p.z); };
    if (e.type === "goal") {
      const gx = e.team === 0 ? L / 2 : -L / 2;
      this.banner(mine ? "⚽ ¡GOOOL!" : `Gol de ${this.rival().name}`);
      this.particles.burst(new THREE.Vector3(gx, 1.2, 0), mine ? [0xffc800, 0xd4216c, 0xffffff] : [0xaaaaaa, 0xffffff], mine ? 40 : 14, 6, 1.2, 5, 1.2);
      if (mine) { audio.playCombo(3); this.haptic(70); } else audio.playBump();
      for (let i = 0; i < 6; i++) this.models[i].mood = m.players[i].team === e.team ? "cheer" : "sad";
      this._moodT = 2.2;
    } else if (e.type === "save") {
      this.popups.add(pos(m.players.find((p) => p.team === e.team && p.role === "gk").id), e.catch ? "¡Atajada!" : "¡La desvió!", "combo");
      audio.playBump();
    } else if (e.type === "tackle") {
      if (mine) this.popups.add(pos(e.by), "¡Robo!", "coin");
      audio.playPop();
    } else if (e.type === "pass" || e.type === "shot") {
      const md = this.models[e.from];
      if (md) md.kickT = 0.3;
      if (e.type === "shot") audio.playWhoosh(); else audio.playBounce();
    } else if (e.type === "restart" && e.kind !== "kickoff") {
      this._hint(`${RESTART_NAMES[e.kind]} para ${e.team === 0 ? "tu equipo" : this.rival().name}${e.team === 0 && m.restart && m.restart.taker === m.human ? ": toca Pase o Tiro" : ""}`, 2.4);
    } else if (e.type === "switch") audio.playPop();
    else if (e.type === "golden") { this.banner("⚡ ¡Gol de oro! El que marque gana"); audio.playPowerup(); }
    else if (e.type === "tacklefail" && mine) this.popups.add(pos(m.human.id), "¡Uy!", "kill");
  }

  _sync(dt, snap = false) {
    const m = this.m;
    const t = this.time;
    if (this._moodT > 0) { this._moodT -= dt; if (this._moodT <= 0) for (const md of this.models) md.mood = null; }
    m.players.forEach((p, i) => {
      const md = this.models[i];
      const g = md.group;
      g.position.set(p.x, 0, p.z);
      const yaw = Math.atan2(p.fx, p.fz);
      g.rotation.y = snap ? yaw : g.rotation.y + Math.atan2(Math.sin(yaw - g.rotation.y), Math.cos(yaw - g.rotation.y)) * Math.min(1, dt * 14);
      md.kickT = Math.max(0, md.kickT - dt);
      const sp = Math.hypot(p.vx, p.vz);
      let mode = sp > 0.6 ? "run" : "idle";
      if (md.kickT > 0) mode = "kick";
      if (md.mood) mode = md.mood;
      if (p.stun > 0.2) mode = "sad";
      md.hero.animate(t + i, mode, mode === "run" ? clamp(sp / 5, 0.5, 1.4) : 1);
      md.ring.position.set(p.x, 0.04, p.z);
      md.ring.visible = p !== m.human;
    });
    this._updateBlobs(m.players);
    const b = m.ball;
    this.ball.position.set(b.x, 0.24 + b.h, b.z);
    const sp = Math.hypot(b.vx, b.vz);
    if (sp > 0.05) {
      this.ball.rotation.z -= (b.vx * dt) / 0.24;
      this.ball.rotation.x += (b.vz * dt) / 0.24;
    }
    this.ballShadow.position.set(b.x, 0.03, b.z);
    this.ballShadow.scale.setScalar(1 / (1 + b.h * 0.4));
    const h = m.human;
    if (h) {
      this.activeRing.visible = this.activeArrow.visible = true;
      this.activeRing.position.set(h.x, 0.05, h.z);
      this.activeArrow.position.set(h.x, 2.75 + (this.reduced ? 0 : Math.sin(t * 5) * 0.12), h.z);
    }
  }

  _camera(dt, snap = false) {
    const m = this.m;
    const b = m.ball;
    const h = m.human || b;
    const portrait = this.camera.aspect < 0.95;
    // se sigue a la pelota, con un poco de tu jugador
    const fx = clamp(b.x * 0.75 + h.x * 0.25, -L / 2 + (portrait ? 4 : 8.5), L / 2 - (portrait ? 4 : 8.5));
    const fz = clamp(b.z * 0.6 + h.z * 0.2, -W / 2 + 4, W / 2 - 4);
    this._tmpV.set(fx, 0, fz);
    if (snap) this.camFocus.copy(this._tmpV);
    else this.camFocus.lerp(this._tmpV, 1 - Math.exp(-4 * Math.max(dt, 0.001)));
    const f = this.camFocus;
    if (portrait) {
      // celular parado: la cámara mira a lo largo de la cancha, desde atrás de tu arco
      this.camera.position.set(f.x - 11, 15, f.z);
      this.camera.lookAt(f.x + 2.5, 0, f.z);
    } else {
      this.camera.position.set(f.x, 12, f.z + 10);
      this.camera.lookAt(f.x, 0, f.z + 0.8);
    }
  }

  _hint(text, secs = 0) {
    const el = this.q("hint");
    if (!el) return;
    el.textContent = text;
    el.classList.toggle("hidden", !text);
    this._hintT = secs;
  }

  _hud(force = false) {
    const m = this.m;
    const secs = Math.ceil(m.time);
    const clock = m.goldenOn ? "Gol de oro" : `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
    const key = `${m.score.join("-")}|${clock}`;
    if (force || key !== this._hudKey) {
      this._hudKey = key;
      const sc = this.q("hud-score");
      if (sc) sc.textContent = `Tú ${m.score[0]} – ${m.score[1]} ${this.rival().name}`;
      const ck = this.q("hud-clock");
      if (ck) ck.textContent = clock;
      const md = this.q("hud-mode");
      if (md) md.textContent = `${this.mode === "copa" ? `Copa · ${this.rival().roundName}` : "Amistoso"} · ${({ accesible: "Accesible", normal: "Normal", desafio: "Desafío" })[this.diff]}`;
    }
    // el botón de pase dice lo que va a hacer
    const b = m.ball;
    const h = m.human;
    const label = !h ? "Pase" : b.owner === h ? "Pase" : b.owner && b.owner.team !== h.team ? "Quitar" : b.owner && b.owner.team === h.team ? "¡Pásala!" : "Pase";
    if (label !== this._passLabel) {
      this._passLabel = label;
      const el = this.q("pass-label");
      if (el) el.textContent = label;
    }
  }

  onResize() {
    if (this.m) this._camera(0, true);
  }
}
