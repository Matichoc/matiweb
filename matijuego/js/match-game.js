// Base común de los partidos nuevos (Pichanga 3 contra 3 y Básquet 2 contra 2): modo amistoso o copa, dificultad,
// controles (joystick o teclado + botones grandes), pausa, y el cierre del partido (avance guardado, premio de la copa una
// sola vez y la tarjeta final). Cada deporte pone su escena, su simulación y su cámara.

import { THREE, Game3D } from "./three-kit.js?v=4754985988";
import { saveProgress, earnCoins } from "./storage.js?v=4754985988";
import { addMedal } from "./adventure.js?v=4754985988";
import { sportOf, setDifficulty, recordMatch, cupRival, DIFFS, DIFF_NAMES, CUP_ROUNDS, ROUND_NAMES } from "./sports-progress.js?v=4754985988";
import * as audio from "./audio.js?v=4754985988";

const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export class MatchGame extends Game3D {
  constructor(gameId, sportId, character, progress, els, opts) {
    // en celulares los partidos parten sin brillo (bloom): son pasadas de pantalla completa caras para una GPU modesta
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    super(gameId, character, progress, els, coarse ? { ...opts, bloom: false } : opts);
    this.sportId = sportId;
    this.q = els.q;
    this.mode = "amistoso";
    this.keys = {};
    this.stick = { x: 0, y: 0 };
    this.edges = { pass: false, shoot: false, switch: false };
    this.held = { shoot: false }; // botón de tiro apretado (el básquet tira al soltar)
    this.paused = false;
    this.reduced = REDUCED;
    this._tmpV = new THREE.Vector3();
    // celulares y tablets (gama media-baja incluida): sin sombras reales; cada jugador lleva una sombra redonda simple.
    // Las sombras reales obligan a dibujar dos veces a cada personaje (son decenas de piezas cada uno).
    this.lite = this.coarse;
  }

  /** Sombras redondas bajo los jugadores: una sola pieza para todos (InstancedMesh = un solo dibujo). */
  _makeBlobs(n) {
    const geo = new THREE.CircleGeometry(0.42, 16);
    geo.rotateX(-Math.PI / 2);
    this.blobs = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }), n);
    this.blobs.renderOrder = 3;
    this.blobs.frustumCulled = false;
    this.blobs.visible = this.lite;
    this.scene.add(this.blobs);
    this._blobO = new THREE.Object3D();
  }

  _updateBlobs(players) {
    if (!this.blobs || !this.blobs.visible) return;
    const o = this._blobO;
    players.forEach((p, i) => {
      o.position.set(p.x, 0.025, p.z);
      o.scale.setScalar(1 - Math.min(0.4, (p.jh || 0) * 0.4));
      o.updateMatrix();
      this.blobs.setMatrixAt(i, o.matrix);
    });
    this.blobs.instanceMatrix.needsUpdate = true;
  }

  get diff() { return sportOf(this.progress, this.sportId).diff; }

  async init() {
    const first = !this.ready;
    await super.init();
    if (first) this._bindCommon();
  }

  /** Joystick (lo conecta el menú con bindStick). */
  setStick(x, y) { this.stick.x = x; this.stick.y = y; }

  _bindCommon() {
    const q = this.q;
    const map = { ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right", ArrowUp: "up", w: "up", W: "up", ArrowDown: "down", s: "down", S: "down" };
    const active = () => this.running && !document.querySelector(".modal:not(.hidden)");
    window.addEventListener("keydown", (e) => {
      if (!active()) return;
      if ((e.key === "Escape" || e.key === "p" || e.key === "P") && (this.state === "playing")) { e.preventDefault(); this.togglePause(); return; }
      if (this.state !== "playing" || this.paused) return;
      const k = map[e.key];
      if (k) { e.preventDefault(); this.keys[k] = true; return; }
      if (e.repeat) return;
      if (e.code === "Space" || e.key === "j" || e.key === "J") { e.preventDefault(); this.edges.pass = true; }
      else if (e.key === "k" || e.key === "K" || e.key === "l" || e.key === "L") { e.preventDefault(); this.edges.shoot = true; this.held.shoot = true; }
      else if (e.key === "q" || e.key === "Q" || e.key === "e" || e.key === "E" || e.key === "Tab") { e.preventDefault(); this.edges.switch = true; }
    });
    window.addEventListener("keyup", (e) => {
      const k = map[e.key];
      if (k) this.keys[k] = false;
      if (e.key === "k" || e.key === "K" || e.key === "l" || e.key === "L") this.held.shoot = false;
    });
    window.addEventListener("blur", () => { this.keys = {}; this.held.shoot = false; });
    const tap = (id, fn) => {
      const b = q(id);
      if (!b) return;
      b.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); if (this.state === "playing" && !this.paused) fn(); });
      b.addEventListener("click", (e) => e.preventDefault());
    };
    tap("btn-pass", () => { this.edges.pass = true; });
    tap("btn-shoot", () => { this.edges.shoot = true; this.held.shoot = true; });
    const shootBtn = q("btn-shoot");
    if (shootBtn) for (const t of ["pointerup", "pointercancel", "pointerleave", "lostpointercapture"]) shootBtn.addEventListener(t, () => { this.held.shoot = false; });
    tap("btn-switch", () => { this.edges.switch = true; });
    q("btn-pause")?.addEventListener("click", () => { if (this.state === "playing") this.togglePause(); });
    q("btn-resume")?.addEventListener("click", () => this.togglePause(false));
    q("btn-quit")?.addEventListener("click", () => { this.togglePause(false); q("btn-menu")?.click(); });
  }

  togglePause(on = !this.paused) {
    this.paused = on;
    this.keys = {};
    this.held.shoot = false;
    this.q("overlay-pause")?.classList.toggle("hidden", !on);
    if (on) audio.stopMusic();
    else if (this.musicTheme && this.state === "playing") audio.startMusic(this.musicTheme);
  }

  /** Lo que apretó quien juega, con la dirección pasada a la cancha según hacia dónde mira la cámara. */
  _readInput() {
    let sx = this.stick.x;
    let sy = this.stick.y;
    if (this.keys.left) sx -= 1;
    if (this.keys.right) sx += 1;
    if (this.keys.up) sy += 1;
    if (this.keys.down) sy -= 1;
    const mag = Math.min(1, Math.hypot(sx, sy));
    const e = this.camera.matrixWorld.elements;
    let rx = e[0], rz = e[2]; // derecha de la cámara
    let fx = -e[8], fz = -e[10]; // hacia adelante (sin la inclinación)
    const rl = Math.hypot(rx, rz) || 1;
    const fl = Math.hypot(fx, fz) || 1;
    rx /= rl; rz /= rl; fx /= fl; fz /= fl;
    let mx = rx * sx + fx * sy;
    let mz = rz * sx + fz * sy;
    const ml = Math.hypot(mx, mz);
    if (ml > 1e-3) { mx = (mx / ml) * mag; mz = (mz / ml) * mag; }
    const input = { mx, mz, pass: this.edges.pass, shoot: this.edges.shoot, shootPress: this.edges.shoot, shootHold: this.held.shoot, switch: this.edges.switch, power: 0.8 };
    this.edges.pass = this.edges.shoot = this.edges.switch = false;
    return input;
  }

  // ---------- tarjeta de inicio: modo y dificultad ----------

  _renderOptions() {
    const box = this.q("intro-opts");
    if (!box) return;
    const s = sportOf(this.progress, this.sportId);
    const rival = cupRival(this.progress, this.sportId);
    box.innerHTML = "";
    const row = (label) => {
      const r = document.createElement("div");
      r.className = "mt-row";
      const l = document.createElement("span");
      l.className = "mt-label";
      l.textContent = label;
      r.appendChild(l);
      box.appendChild(r);
      return r;
    };
    // cada opción es una ficha con su dibujito y su color (verde para aprender, amarillo normal, naranja desafío...)
    const opt = (r, icon, title, sub, tone, on, fn) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `mode-btn mt-chip${on ? " sel" : ""}`;
      b.dataset.tone = tone;
      const i = document.createElement("i");
      i.textContent = icon;
      const t = document.createElement("span");
      t.textContent = title;
      b.append(i, t);
      if (sub) { const sm = document.createElement("small"); sm.textContent = sub; b.appendChild(sm); }
      b.setAttribute("aria-pressed", String(on));
      b.addEventListener("click", () => { fn(); saveProgress(this.progress); this.reset(); this._renderOptions(); this.onOptions?.(); });
      r.appendChild(b);
      return b;
    };
    const r1 = row("Partido");
    opt(r1, "🤝", "Amistoso", "para jugar tranqui", "blue", this.mode === "amistoso", () => { this.mode = "amistoso"; });
    opt(r1, "🏆", "Copa", rival.roundName, "gold", this.mode === "copa", () => { this.mode = "copa"; });
    const r2 = row("Dificultad");
    const DIFF_LOOK = { accesible: ["🌱", "para aprender", "mint"], normal: ["⭐", "", "yellow"], desafio: ["🔥", "", "orange"] };
    for (const d of DIFFS) {
      const [icon, sub, tone] = DIFF_LOOK[d] || ["⭐", "", "yellow"];
      opt(r2, icon, DIFF_NAMES[d], sub, tone, s.diff === d, () => setDifficulty(this.progress, this.sportId, d));
    }
    const info = document.createElement("p");
    info.className = "mt-info";
    const cups = DIFFS.filter((d) => s.cups[d] > 0).map((d) => `🏆 ${DIFF_NAMES[d]} x${s.cups[d]}`).join(" · ");
    info.textContent = this.mode === "copa"
      ? `Copa de ${CUP_ROUNDS} partidos: ${ROUND_NAMES.join(" → ")}. Ahora: ${rival.roundName} contra ${rival.name}. Si pierdes, repites el mismo partido (no se pierde nada).${cups ? ` Tus copas: ${cups}.` : ""}`
      : `Partido amistoso contra ${rival.name}.${cups ? ` Tus copas: ${cups}.` : ""}`;
    box.appendChild(info);
  }

  onIntro() {
    this.paused = false;
    this.q("overlay-pause")?.classList.add("hidden");
    this._renderOptions();
  }

  /** El rival de este partido (el de la ronda de copa, o el de la ronda actual en un amistoso). */
  rival() { return cupRival(this.progress, this.sportId); }

  /**
   * Fin del partido: guarda el resultado, paga (una vez) el premio de la copa y muestra la tarjeta final.
   * Matipuntos y XP del partido los paga finish() como en todos los juegos (y eso también avanza la aventura).
   */
  endMatch(my, their, extra = "") {
    if (this.state !== "playing") return;
    const mode = this.mode;
    const diff = this.diff;
    const rival = this.rival();
    const r = recordMatch(this.progress, this.sportId, { mode, diff, my, their });
    let text = `${my} a ${their} contra ${rival.name}.`;
    if (extra) text += ` ${extra}`;
    if (mode === "copa") {
      if (r.cupWon) {
        text += ` 🏆 ¡Ganaste la copa en dificultad ${DIFF_NAMES[diff]}!`;
        if (r.reward) { earnCoins(this.progress, r.reward); text += ` Premio: +${r.reward} 🍫✨.`; }
        if (diff === "desafio" && addMedal(this.progress, `${this.sportId}_desafio`)) text += " 🏅 ¡Nueva medalla!";
      } else if (r.result === "win") text += ` ¡Pasas a la ${ROUND_NAMES[r.nextRound].toLowerCase()}!`;
      else text += " Puedes volver a jugar este partido de la copa cuando quieras.";
    }
    saveProgress(this.progress);
    this.score = my * 30 + (r.result === "win" ? 60 : r.result === "draw" ? 25 : 10) + their * 0;
    this.runInfo = this.sportId === "pichanga" ? { goals: my } : {};
    const title = this.q("gameover-title");
    if (title) title.textContent = r.cupWon ? "🏆 ¡Campeones!" : r.result === "win" ? "🎉 ¡Ganaste!" : r.result === "draw" ? "🤝 ¡Empate!" : "💪 ¡Buen partido!";
    const again = this.q("btn-retry");
    if (again) again.textContent = mode === "copa" && r.result === "win" && !r.cupWon ? "▶ Siguiente partido de la copa" : "🔄 Jugar otra vez";
    if (r.result === "win") audio.playVictory(); else audio.playMissionComplete();
    this.lastResult = r;
    this.finish(text);
  }

  pauseForMenu() {
    this.keys = {};
    this.stick.x = this.stick.y = 0;
    this.held.shoot = false;
    this.paused = false;
    this.q("overlay-pause")?.classList.add("hidden");
    super.pauseForMenu();
  }
}
