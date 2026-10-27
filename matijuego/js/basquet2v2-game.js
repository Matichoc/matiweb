// Básquet 2 contra 2 en media cancha: tú y un compañero (IA) contra dos rivales (IA local).
// La simulación (reglas, IA, pelota) está en js/basquet2v2-sim.js; aquí se dibuja y se controla.
// Si en la aventura ya armaste el "Aro del Pueblo", la cancha usa el estilo que elegiste.
//
// Controles: mover con el joystick o WASD/flechas · Pase (Espacio/J); sin la pelota: Robar · Tiro (K): mantén y suelta
// cuando la barra está en verde; sin la pelota: Saltar (tapar o rebote) · Cambiar (Q/E/Tab) · Pausa (P/Esc).

import { THREE, clamp, canvasTexture, makeBunting } from "./three-kit.js?v=a4d43c7898";
import { createMatichico } from "./matichico3d.js?v=a4d43c7898";
import { CHARACTERS, getOutfit } from "./characters.js?v=a4d43c7898";
import { choiceOf, choiceOption } from "./adventure.js?v=a4d43c7898";
import { MatchGame } from "./match-game.js?v=a4d43c7898";
import { createMatch, stepMatch, COURT } from "./basquet2v2-sim.js?v=a4d43c7898";
import * as audio from "./audio.js?v=a4d43c7898";

const GAME_ID = "basquet2v2";
const HX = COURT.W / 2;
const STYLES = {
  clasico: { floor: "#d9a066", line: "#ffffff", rim: 0xff7a1a },
  dorado: { floor: "#6b3a22", line: "#ffc800", rim: 0xffc800 },
  arcoiris: { floor: "#f3e6ff", line: "#9a5cff", rim: 0x9a5cff },
};

function courtTexture(st) {
  return canvasTexture(1024, 1024, (g, w, h) => {
    const sx = (x) => ((x + HX + 1) / (COURT.W + 2)) * w;
    const sz = (z) => ((z + 1) / (COURT.D + 2)) * h;
    const k = w / (COURT.W + 2);
    g.fillStyle = st.floor;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 24; i++) { g.fillStyle = i % 2 ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)"; g.fillRect((i * w) / 24, 0, w / 24, h); }
    g.strokeStyle = st.line;
    g.lineWidth = 7;
    g.strokeRect(sx(-HX), sz(0), sx(HX) - sx(-HX), sz(COURT.D) - sz(0));
    // la pintura y el círculo de tiro libre
    g.fillStyle = "rgba(212,33,108,0.25)";
    g.fillRect(sx(-2.45), sz(0), sx(2.45) - sx(-2.45), sz(5.8) - sz(0));
    g.strokeRect(sx(-2.45), sz(0), sx(2.45) - sx(-2.45), sz(5.8) - sz(0));
    g.beginPath(); g.arc(sx(0), sz(5.8), 1.8 * k, 0, Math.PI); g.stroke();
    // línea de 3: rectas en las esquinas y el arco
    const r = COURT.three;
    const zc = COURT.hoopZ;
    const xs = r * 0.92;
    const zs = zc + Math.sqrt(r * r - xs * xs);
    g.beginPath();
    g.moveTo(sx(-xs), sz(0)); g.lineTo(sx(-xs), sz(zs));
    g.arc(sx(0), sz(zc), r * k, Math.PI - Math.asin((zs - zc) / r), Math.asin((zs - zc) / r), true);
    g.lineTo(sx(xs), sz(0));
    g.stroke();
    // punto de saque arriba
    g.fillStyle = st.line;
    g.beginPath(); g.arc(sx(0), sz(COURT.topZ), 10, 0, Math.PI * 2); g.fill();
  });
}

function ballTexture() {
  return canvasTexture(256, 128, (g, w, h) => {
    g.fillStyle = "#f07a1e";
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "#3a1a08";
    g.lineWidth = 5;
    g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
    for (const x of [w / 4, (3 * w) / 4]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  });
}

export class Basquet2v2Game extends MatchGame {
  constructor(character, progress, els) {
    super(GAME_ID, "basquet2v2", character, progress, els, { fov: 50 });
    this.kawaii = true;
    this.ambientOpts = { petals: 14, hearts: 0, stars: 10, radius: 14, height: 9 };
    this.musicTheme = "sport";
    this.m = null;
    this.camFocus = new THREE.Vector3();
  }

  _style() {
    const id = choiceOf(this.progress, "aro");
    return { id: id || "clasico", ...(STYLES[id] || STYLES.clasico) };
  }

  async build() {
    const s = this.scene;
    s.background = new THREE.Color(0x9fd8f5);
    s.fog = new THREE.Fog(0xb7e6ff, 40, 100);
    s.add(new THREE.HemisphereLight(0xfff6e0, 0x6a5a40, 1.25));
    this.sun = new THREE.DirectionalLight(0xfff0d2, 2.2);
    this.sun.position.set(-8, 20, 16);
    this.sun.castShadow = !this.lite; // en celulares, sombras simples (ver MatchGame._makeBlobs)
    const sm = this.coarse ? 1024 : 2048;
    this.sun.shadow.mapSize.set(sm, sm);
    const sc = this.sun.shadow.camera;
    sc.left = -12; sc.right = 12; sc.top = 12; sc.bottom = -12; sc.near = 1; sc.far = 60;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.04;
    s.add(this.sun, this.sun.target);
    this.sun.target.position.set(0, 0, 6);
    this.onLowQuality = () => { this.sun.castShadow = false; if (this.blobs) this.blobs.visible = true; };

    const grass = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshStandardMaterial({ color: 0x7cc65a, roughness: 1 }));
    grass.rotation.x = -Math.PI / 2;
    grass.position.y = -0.02;
    s.add(grass);
    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(COURT.W + 2, COURT.D + 2), new THREE.MeshStandardMaterial({ roughness: 0.75 }));
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.set(0, 0.01, COURT.D / 2);
    this.floor.receiveShadow = true;
    s.add(this.floor);
    // arco de la línea de 3 que brilla cuando hay que sacar la pelota
    const arcPts = [];
    for (let i = 0; i <= 40; i++) { const a = (i / 40) * Math.PI; arcPts.push(new THREE.Vector3(Math.cos(a) * COURT.three, 0.04, COURT.hoopZ + Math.sin(a) * COURT.three)); }
    this.clearArc = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arcPts), 40, 0.09, 6, false), new THREE.MeshBasicMaterial({ color: 0xffd400, transparent: true, opacity: 0.85 }));
    this.clearArc.visible = false;
    s.add(this.clearArc);

    // aro: poste detrás de la línea de fondo, brazo, tablero, aro y red
    const hoop = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: 0x3a3a46, roughness: 0.4, metalness: 0.4 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 3.9, 12), metal);
    pole.position.set(0, 1.95, -0.6);
    pole.castShadow = true;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, COURT.hoopZ + 0.2), metal);
    arm.position.set(0, 3.55, (COURT.hoopZ - 0.6) / 2 - 0.2);
    this.board = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.05, 0.06), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, transparent: true, opacity: 0.92 }));
    this.board.position.set(0, 3.45, COURT.hoopZ - 0.42);
    this.board.castShadow = true;
    this.boardMark = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.45), new THREE.MeshBasicMaterial({ color: 0xd4216c }));
    this.boardMark.position.set(0, 3.3, COURT.hoopZ - 0.385);
    this.rimMat = new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.35, metalness: 0.4 });
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.025, 8, 28), this.rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(0, COURT.rimH, COURT.hoopZ);
    this.net = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.15, 0.42, 14, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true }));
    this.net.position.set(0, COURT.rimH - 0.22, COURT.hoopZ);
    hoop.add(pole, arm, this.board, this.boardMark, rim, this.net);
    s.add(hoop);
    // banderines y bancas alrededor
    s.add(makeBunting(new THREE.Vector3(-HX - 1.4, 3.6, 0), new THREE.Vector3(-HX - 1.4, 3.6, COURT.D), { count: 18, sag: 0.8 }));
    s.add(makeBunting(new THREE.Vector3(HX + 1.4, 3.6, 0), new THREE.Vector3(HX + 1.4, 3.6, COURT.D), { count: 18, sag: 0.8 }));
    for (const sx of [-1, 1]) for (const z of [0, COURT.D]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.8, 8), new THREE.MeshStandardMaterial({ color: 0x4b2e1e }));
      p.position.set(sx * (HX + 1.4), 1.9, z);
      s.add(p);
    }

    this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 14), new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: 0.6 }));
    this.ball.castShadow = !this.lite;
    s.add(this.ball);
    this.ballShadow = new THREE.Mesh(new THREE.CircleGeometry(0.22, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }));
    this.ballShadow.rotation.x = -Math.PI / 2;
    s.add(this.ballShadow);

    const ringGeo = new THREE.RingGeometry(0.5, 0.68, 32);
    ringGeo.rotateX(-Math.PI / 2);
    this.activeRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd400, transparent: true, opacity: 0.95, depthWrite: false }));
    this.activeRing.renderOrder = 5;
    s.add(this.activeRing);
    this.activeArrow = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.48, 4), new THREE.MeshBasicMaterial({ color: 0xffd400 }));
    this.activeArrow.rotation.x = Math.PI;
    s.add(this.activeArrow);
    this.teamRingGeo = new THREE.RingGeometry(0.48, 0.58, 28);
    this.teamRingGeo.rotateX(-Math.PI / 2);
    this._makeBlobs(4);
    this._applyStyle();
  }

  _applyStyle() {
    const st = this._style();
    if (this.styleId === st.id) return;
    this.styleId = st.id;
    if (this.floor.material.map) this.floor.material.map.dispose();
    this.floor.material.map = courtTexture(st);
    this.floor.material.needsUpdate = true;
    this.rimMat.color.setHex(st.rim);
  }

  _makePlayers() {
    const rival = this.rival();
    const mine = choiceOption("cancha", choiceOf(this.progress, "cancha"));
    const cols = [mine ? mine.color : 0xd4216c, rival.color];
    if (cols[1] === cols[0]) cols[1] = 0x7a3f22;
    const key = `${this.character.id}|${cols.join(",")}|${Object.values(this.look).join(",")}`;
    if (this.models && this.modelKey === key) return;
    if (this.models) for (const md of this.models) this.scene.remove(md.group, md.ring);
    this.modelKey = key;
    const others = CHARACTERS.filter((c) => c.id !== this.character.id);
    const charFor = [this.character, others[0 % others.length], others[1 % others.length], others[2 % others.length]];
    this.models = this.m.players.map((p, i) => {
      const own = i === 0;
      const hero = own ? createMatichico(charFor[i], this.outfit, this.look) : createMatichico(charFor[i], getOutfit("polera"));
      if (!own) hero.setOutfit({ jersey: cols[p.team], trim: 0xffffff });
      hero.group.scale.setScalar(1.05);
      if (!this.lite) hero.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      hero.group.userData.noToon = true;
      this.scene.add(hero.group);
      const ring = new THREE.Mesh(this.teamRingGeo, new THREE.MeshBasicMaterial({ color: cols[p.team], transparent: true, opacity: 0.8, depthWrite: false }));
      ring.renderOrder = 4;
      this.scene.add(ring);
      return { group: hero.group, hero, ring, actT: 0, mood: null };
    });
  }

  reset() {
    this._applyStyle();
    this.m = createMatch({ difficulty: this.diff, golden: this.mode === "copa", seed: (Date.now() & 0xffff) + 7 });
    this.m.events.length = 0;
    this._makePlayers();
    this.score = 0;
    this.paused = false;
    this.endShown = false;
    this._sync(0, true);
    this._camera(0, true);
    this._hud(true);
  }

  onBegin() {
    this.banner(this.mode === "copa" ? `🏆 ${this.rival().roundName}: ¡a jugar!` : "🏀 ¡A jugar!");
    audio.playCountdown(true);
    this._hint(`Gana quien llega a ${this.m.target} puntos o va arriba al final. Mantén Tiro y suelta en el verde.`, 4);
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
        this.endMatch(m.score[0], m.score[1], `Canastas: ${st.made[0]} de ${st.att[0]} tiros · Rebotes: ${st.reb[0]} · Robos: ${st.steals[0]}.`);
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
    const at = (id) => { const p = m.players[id]; return new THREE.Vector3(p.x, 2.4, p.z); };
    const rim = new THREE.Vector3(0, COURT.rimH, COURT.hoopZ);
    if (e.type === "score") {
      this.banner(mine ? (e.pts === 3 ? "🔥 ¡TRIPLE!" : "🏀 ¡Canasta!") : `Canasta de ${this.rival().name}`);
      this.particles.burst(rim, mine ? [0xffc800, 0xd4216c, 0xffffff] : [0xaaaaaa, 0xffffff], mine ? 30 : 10, 4, 1, 4, 1);
      if (mine) { audio.playCombo(e.pts); this.haptic(60); } else audio.playBump();
      this.netT = 0.6;
      for (let i = 0; i < 4; i++) this.models[i].mood = m.players[i].team === e.team ? "cheer" : null;
      this._moodT = 1.4;
    } else if (e.type === "shot") {
      const md = this.models[e.from];
      if (md) md.actT = 0.45;
      audio.playWhoosh();
    } else if (e.type === "rim") audio.playBounce();
    else if (e.type === "block") { this.popups.add(rim.clone().setY(2.6), "¡Tapón!", "combo"); audio.playBump(); }
    else if (e.type === "steal") { if (mine) this.popups.add(at(e.by), "¡Robo!", "coin"); audio.playPop(); }
    else if (e.type === "rebound" && mine) this.popups.add(at(e.by), "¡Rebote!", "coin");
    else if (e.type === "pass") audio.playBounce();
    else if (e.type === "turnover" && e.team === 0) this._hint("¡Recuperaron! Saquen la pelota detrás de la línea de 3 antes de tirar", 3);
    else if (e.type === "mustclear") this._hint("Primero saca la pelota detrás de la línea de 3 (la línea amarilla)", 2.5);
    else if (e.type === "out") this._hint("Pelota afuera: saca el otro equipo desde arriba", 2.2);
    else if (e.type === "check" && this.state === "playing") this._hint(e.team === 0 ? "Saque desde arriba: ¡ataca!" : `Saca ${this.rival().name} desde arriba: ¡a defender!`, 1.8);
    else if (e.type === "timing") { if (e.q > 1.1) this.popups.add(at(m.players.find((p) => p === m.human)?.id ?? 0), "¡Justo!", "combo"); }
    else if (e.type === "golden") { this.banner("⚡ ¡La próxima canasta gana!"); audio.playPowerup(); }
    else if (e.type === "switch") audio.playPop();
  }

  _sync(dt, snap = false) {
    const m = this.m;
    const t = this.time;
    if (this._moodT > 0) { this._moodT -= dt; if (this._moodT <= 0) for (const md of this.models) md.mood = null; }
    m.players.forEach((p, i) => {
      const md = this.models[i];
      const g = md.group;
      g.position.set(p.x, p.jh, p.z);
      const yaw = Math.atan2(p.fx, p.fz);
      g.rotation.y = snap ? yaw : g.rotation.y + Math.atan2(Math.sin(yaw - g.rotation.y), Math.cos(yaw - g.rotation.y)) * Math.min(1, dt * 14);
      md.actT = Math.max(0, md.actT - dt);
      const sp = Math.hypot(p.vx, p.vz);
      let mode = sp > 0.6 ? "run" : "idle";
      if (p.jh > 0.05 || md.actT > 0) mode = "jump";
      if (md.mood) mode = md.mood;
      if (p.stun > 0.2) mode = "sad";
      md.hero.animate(t + i, mode, mode === "run" ? clamp(sp / 5, 0.5, 1.4) : 1);
      md.ring.position.set(p.x, 0.04, p.z);
      md.ring.visible = p !== m.human;
    });
    this._updateBlobs(m.players);
    const b = m.ball;
    let bh = b.h;
    if (b.owner && !(b.owner.charge >= 0) && b.owner.jh <= 0.05) bh = 0.2 + Math.abs(Math.sin(t * 8.5)) * 0.8; // botando
    else if (b.owner && b.owner.charge >= 0) bh = 2.0 + b.owner.jh;
    this.ball.position.set(b.x, bh + 0.17, b.z);
    this.ball.rotation.x += dt * 6;
    this.ballShadow.position.set(b.x, 0.03, b.z);
    this.ballShadow.scale.setScalar(1 / (1 + bh * 0.35));
    if (this.netT > 0) { this.netT -= dt; this.net.scale.set(1, 1 + Math.sin(this.netT * 20) * 0.15, 1); } else this.net.scale.set(1, 1, 1);
    const h = m.human;
    if (h) {
      this.activeRing.position.set(h.x, 0.05, h.z);
      this.activeArrow.position.set(h.x, 2.9 + h.jh + (this.reduced ? 0 : Math.sin(t * 5) * 0.12), h.z);
    }
    this.clearArc.visible = m.mustClear === 0;
  }

  _camera(dt, snap = false) {
    const m = this.m;
    const b = m.ball;
    const h = m.human || b;
    const portrait = this.camera.aspect < 0.95;
    // entre la pelota, tu jugador y el aro: el aro siempre a la vista
    const fx = clamp(b.x * 0.4 + h.x * 0.2, -3, 3);
    const fz = clamp(b.z * 0.35 + h.z * 0.2 + 2.2, 3.4, 7.5);
    this._tmpV.set(fx, 0, fz);
    if (snap) this.camFocus.copy(this._tmpV);
    else this.camFocus.lerp(this._tmpV, 1 - Math.exp(-3.5 * Math.max(dt, 0.001)));
    const f = this.camFocus;
    if (portrait) {
      this.camera.position.set(f.x * 0.6, 13.5, f.z + 13);
      this.camera.lookAt(f.x * 0.8, 0.6, f.z - 0.6);
    } else {
      this.camera.position.set(f.x * 0.8, 8.8, f.z + 10.5);
      this.camera.lookAt(f.x, 1.0, f.z - 1.2);
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
    const clock = m.goldenOn ? "Canasta de oro" : `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
    const key = `${m.score.join("-")}|${clock}`;
    if (force || key !== this._hudKey) {
      this._hudKey = key;
      const sc = this.q("hud-score");
      if (sc) sc.textContent = `Tú ${m.score[0]} – ${m.score[1]} ${this.rival().name}`;
      const ck = this.q("hud-clock");
      if (ck) ck.textContent = `${clock} · a ${m.target}`;
      const md = this.q("hud-mode");
      if (md) md.textContent = `${this.mode === "copa" ? `Copa · ${this.rival().roundName}` : "Amistoso"} · ${({ accesible: "Accesible", normal: "Normal", desafio: "Desafío" })[this.diff]}`;
    }
    const b = m.ball;
    const h = m.human;
    const has = h && b.owner === h;
    const pass = has ? "Pase" : b.owner && h && b.owner.team !== h.team ? "Robar" : "Pase";
    const shoot = has ? "Tiro" : "Saltar";
    if (pass !== this._passLabel) { this._passLabel = pass; const el = this.q("pass-label"); if (el) el.textContent = pass; }
    if (shoot !== this._shootLabel) { this._shootLabel = shoot; const el = this.q("shoot-label"); if (el) el.textContent = shoot; }
    // barra del tiro
    const meter = this.q("meter");
    if (meter) {
      const c = has ? h.charge : -1;
      meter.classList.toggle("hidden", !(c >= 0));
      if (c >= 0) meter.querySelector("i").style.height = `${Math.round(clamp(c / 1.15, 0, 1) * 100)}%`;
    }
  }

  onResize() {
    if (this.m) this._camera(0, true);
  }
}
