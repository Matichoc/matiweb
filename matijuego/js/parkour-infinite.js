// Parkour Choco: modo "Mundo infinito".
//
// El recorrido se genera sin fin mientras el Matichico avanza: cada ~140 m hay un mundo
// nuevo (10 ambientes que se repiten cada vez más difíciles), con checkpoint, premios y
// poderes. Lo que queda muy atrás se borra para que el juego no se ponga pesado.
//
// Se agrega como "mixin" a ParkourGame (ver el final de parkour-game.js) y usa sus
// métodos de siempre (_makePlatform, _makeItem, _makeFlag, _makeSpinner...).

import { THREE, clamp, lerp } from "./three-kit.js?v=64565862c1";
import * as audio from "./audio.js?v=64565862c1";

export const ZONE_LEN = 140; // metros por mundo
export const MAX_LIVES = 5;
const AHEAD = 150; // cuánto recorrido se genera por delante
const BEHIND = 50; // cuánto se conserva por detrás del último checkpoint

const mulberry32 = (a) => () => {
  a |= 0; a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** Los 4 ambientes nuevos (los otros 6 vienen de las etapas de la aventura). */
const EXTRA_BIOMES = {
  bosque: { name: "Bosque de Cacao", sky: 0xcfe8c0, top: 0x8a5a36, side: 0x4a2a14, accent: 0xff9a3c, hemi: 1.2, sun: 2.2, night: 0, trail: [0xff9a3c, 0x8bd45a] },
  desierto: { name: "Desierto de Galleta", sky: 0xffe2a8, top: 0xe8c27a, side: 0xb8863a, accent: 0xd4216c, hemi: 1.25, sun: 2.5, night: 0, trail: [0xd4216c, 0xffe2a8] },
  menta: { name: "Mar de Menta", sky: 0xb8f0e0, top: 0x7fe8c8, side: 0x2a9a8a, accent: 0xffffff, hemi: 1.3, sun: 2.3, night: 0, trail: [0x7fe8c8, 0xffffff] },
  galaxia: { name: "Galaxia Dulce", sky: 0x120a2e, top: 0x6a3ab8, side: 0x2a1060, accent: 0xff3fa4, hemi: 0.8, sun: 1.0, night: 1, trail: [0xff3fa4, 0x9a5cff, 0x35f0ff] },
};
// qué adornos flotan a los lados y qué tipo de plataformas abundan en cada ambiente
const META = {
  "Pradera Matichoc": { prop: "tree", favor: ["moving"] },
  "Camino de Caramelo": { prop: "candy", favor: ["moving", "beam"] },
  "Nubes Saltarinas": { prop: "cloud", favor: ["crumble", "pad"] },
  "Bosque de Cacao": { prop: "tree", favor: ["beam", "crumble"] },
  "Molinos de Cacao": { prop: "mill", favor: ["spinner", "beam"] },
  "Desierto de Galleta": { prop: "candy", favor: ["crumble", "moving"] },
  "Mar de Menta": { prop: "crystal", favor: ["moving", "pad"] },
  "Noche Neón": { prop: "pillar", favor: ["blink"] },
  "Galaxia Dulce": { prop: "planet", favor: ["blink", "spinner"] },
  "Cumbre Matichoc": { prop: "crystal", favor: ["crumble", "moving", "spinner"] },
};

export const POWERS = {
  magnet: { icon: "🧲", name: "¡Imán de alfajores!", color: 0xff3fa4, secs: 9 },
  shield: { icon: "🛡️", name: "¡Escudo! Te salva de una caída", color: 0x35f0ff, secs: 25 },
  turbo: { icon: "⚡", name: "¡Turbo!", color: 0xff9a1f, secs: 7 },
  jump: { icon: "🦘", name: "¡Súper salto!", color: 0x9a5cff, secs: 8 },
};

export function installInfinite(Cls, STAGES) {
  const P = Cls.prototype;
  const biomes = [STAGES[0], STAGES[1], STAGES[2], EXTRA_BIOMES.bosque, STAGES[3], EXTRA_BIOMES.desierto, EXTRA_BIOMES.menta, STAGES[4], EXTRA_BIOMES.galaxia, STAGES[5]]
    .map((b) => ({ ...b, ...META[b.name] }));

  P.biomeAt = function biomeAt(i) {
    return biomes[((Math.floor(i) % biomes.length) + biomes.length) % biomes.length];
  };

  /** Libera lo que dibuja un objeto (menos lo compartido entre muchos). */
  P._disposeTree = function _disposeTree(obj) {
    obj.traverse((o) => {
      if (o.isSprite) return;
      if (o.geometry && !this._shared.has(o.geometry)) o.geometry.dispose();
      for (const m of [].concat(o.material || [])) {
        if (this._shared.has(m)) continue;
        if (m.map && !this._shared.has(m.map)) m.map.dispose();
        m.dispose();
      }
    });
  };

  /** Borra el recorrido actual (aventura o infinito) y deja el grupo vacío. */
  P._clearCourse = function _clearCourse() {
    if (this.course) {
      this._disposeTree(this.course);
      this.scene.remove(this.course);
    }
    this.platforms = [];
    this.spinners = [];
    this.items = [];
    this.checkpoints = [];
    this.stageStarts = [];
    this.props = [];
    this.course = new THREE.Group();
    this.scene.add(this.course);
    this.finishGroup = null;
    this.goal = null;
  };

  // ---------- generación ----------

  P._resetInfinite = function _resetInfinite() {
    this._clearCourse();
    this.worldMode = "inf";
    this.inf = {
      rnd: mulberry32((Math.random() * 1e9) | 0),
      cur: null, zone: 0, count: 0, sinceGold: 0, sincePower: 3, lastHard: false, lives: MAX_LIVES, maxZ: 0, cullT: 0,
    };
    const start = this._infPlace("start", { sx: 10, sz: 10 });
    this._infCheckpoint(start, 0);
    this.pos.set(start.base.x, start.base.y + start.h.y, start.base.z);
    this._extendWorld();
  };

  P._infPlace = function _infPlace(type, o) {
    const inf = this.inf;
    const cur = inf.cur;
    const { sx, sz } = o;
    let x = 0;
    if (cur) {
      const maxdx = Math.max(0.2, (cur.sx + sx) / 2 - 0.9);
      x = clamp(cur.x + clamp(o.dx || 0, -maxdx, maxdx), -9, 9);
    }
    const top = cur ? cur.top + (o.dy || 0) : 0;
    const z = cur ? cur.z - cur.sz / 2 - (o.gap ?? 2) - sz / 2 : 0;
    const zone = Math.floor(-z / ZONE_LEN);
    const p = this._makePlatform(zone, type, { ...o, x, top, z, theme: this.biomeAt(zone) });
    p.zone = zone;
    inf.cur = { x, top, z, sx, sz };
    inf.n = (inf.n || 0) + 1;
    if (inf.n % 2 === 0) this._infProp(p, zone); // un adorno flotante cada dos plataformas
    return p;
  };

  P._infCheckpoint = function _infCheckpoint(p, zone) {
    const theme = this.biomeAt(zone);
    this.checkpoints.push({
      stage: zone, zone, theme,
      spawn: new THREE.Vector3(p.base.x, p.base.y + p.h.y, p.base.z),
      mesh: this._makeFlag(zone, p, theme),
      reached: false,
    });
  };

  P._extendWorld = function _extendWorld() {
    for (let i = 0; i < 40 && this.inf.cur.z > this.pos.z - AHEAD; i++) this._genNext();
  };

  P._genNext = function _genNext() {
    const inf = this.inf;
    const rnd = inf.rnd;
    const rr = (a, b) => a + rnd() * (b - a);
    const cur = inf.cur;
    const zf = -cur.z / ZONE_LEN;
    const zone = Math.floor(zf);
    const d = clamp(zf / 9, 0, 1); // dificultad: sube en los primeros 9 mundos y ahí se queda alta
    const theme = this.biomeAt(zone);
    const item = (x, y, z, kind = "item", power) => this.items.push(this._makeItem(x, y, z, kind, power));
    const onTop = (p, n = 1, spread = 0.9) => {
      for (let i = 0; i < n; i++) item(p.base.x, p.base.y + p.h.y + 1.15, p.base.z + (n > 1 ? (i - (n - 1) / 2) * spread : 0));
    };

    // mundo nuevo: plataforma amplia de descanso con checkpoint
    if (zone > inf.zone) {
      inf.zone = zone;
      const p = this._infPlace("normal", { sx: 7, sz: 7, gap: 2.4, dx: 0, dy: 0 });
      this._infCheckpoint(p, p.zone);
      onTop(p, 2, 1.6);
      inf.lastHard = false;
      return;
    }

    // qué plataforma toca
    const w = { normal: lerp(6, 2.2, d), moving: 1 + 1.6 * d };
    if (zone >= 1) { w.beam = 1.2 + d; w.crumble = 1.2 + d; }
    if (zone >= 2 && cur.top <= 3) w.pad = 0.9;
    if (zone >= 3) w.spinner = 0.8 + 0.8 * d;
    if (zone >= 4) w.blink = 0.9 + d;
    for (const k of theme.favor || []) if (w[k]) w[k] *= 2.2;
    if (inf.lastHard) w.normal = (w.normal || 1) * 3;
    const entries = Object.entries(w);
    let r = rnd() * entries.reduce((s, [, v]) => s + v, 0);
    let type = "normal";
    for (const [k, v] of entries) { r -= v; if (r <= 0) { type = k; break; } }
    if (inf.count++ < 3) type = "normal"; // el comienzo siempre es tranquilo

    const size = Math.round((lerp(4.4, 3.0, d) + rr(-0.3, 0.4)) * 5) / 5;
    const gap = lerp(1.5, 3.2, d) + rr(0, 0.5);
    const dxMax = lerp(2.4, 3.6, d);
    let dy = rr(-0.3, 0.5);
    if (cur.top > 6) dy = rr(-2.2, -0.4);
    else if (cur.top < -2) dy = rr(0.3, 0.9);
    const base = { gap, dx: rr(-dxMax, dxMax), dy };

    let p;
    let hard = false;
    switch (type) {
      case "moving":
        p = this._infPlace("moving", { ...base, sx: size + 0.6, sz: size + 0.6, dx: rr(-1, 1), dy: 0, axis: "x", amp: lerp(2.0, 3.2, d), speed: lerp(0.8, 1.25, d), phase: rr(0, 6) });
        if (rnd() < 0.6) onTop(p);
        break;
      case "beam":
        p = this._infPlace("beam", { ...base, sx: 1.6, sz: 6.5, gap: 2.0, dx: rr(-0.6, 0.6), dy: 0 });
        onTop(p, 3, 1.6);
        hard = true;
        break;
      case "crumble":
        p = this._infPlace("crumble", { ...base, sx: Math.max(3, size), sz: Math.max(3, size) });
        if (rnd() < 0.7) onTop(p);
        hard = true;
        break;
      case "blink":
        p = this._infPlace("blink", { ...base, sx: 2.9, sz: 2.9, gap: Math.max(gap, 2.4), phase: rr(0, 6) });
        if (rnd() < 0.6) onTop(p);
        hard = true;
        break;
      case "spinner":
        p = this._infPlace("normal", { sx: 8.4, sz: 8.4, gap: 2.4, dx: 0, dy: 0 });
        this._makeSpinner(p, 6.6, (rnd() < 0.5 ? -1 : 1) * lerp(1.1, 2.0, d));
        item(p.base.x, p.base.y + p.h.y + 1.7, p.base.z + 2.3);
        item(p.base.x, p.base.y + p.h.y + 1.7, p.base.z - 2.3);
        hard = true;
        break;
      case "pad": {
        const pad = this._infPlace("pad", { sx: 3.6, sz: 3.6, gap: 2.2, dx: 0, dy: 0 });
        item(pad.base.x, pad.base.y + 5.5, pad.base.z - 2.4, "gold");
        p = this._infPlace("normal", { sx: 7, sz: 7, gap: 3.0, dx: 0, dy: 5.5 });
        onTop(p, 3, 1.6);
        break;
      }
      default:
        p = this._infPlace("normal", { ...base, sx: size, sz: size });
        if (rnd() < 0.55) onTop(p);
        break;
    }
    inf.lastHard = hard;

    // barras Matidubai y poderes de vez en cuando
    if (type !== "spinner" && type !== "pad") {
      if (++inf.sinceGold >= 14 + rnd() * 8) { inf.sinceGold = 0; item(p.base.x, p.base.y + p.h.y + 3.3, p.base.z, "gold"); }
      else if (++inf.sincePower >= 9 + rnd() * 6) {
        inf.sincePower = 0;
        const kinds = Object.keys(POWERS);
        item(p.base.x, p.base.y + p.h.y + 1.5, p.base.z, "power", kinds[Math.floor(rnd() * kinds.length)]);
      }
    }
  };

  /** Quita lo que quedó muy atrás (siempre conserva desde el último checkpoint). */
  P._cullWorld = function _cullWorld() {
    // lo que quede detrás del último checkpoint (o de la jugadora, si va más atrás) se puede borrar;
    // OJO: z crece hacia atrás, así que lo que hay que conservar es el MAYOR de los dos
    const cullZ = Math.max(this.pos.z, this.spawn.z) + BEHIND;
    const gone = (z) => z > cullZ;
    const drop = (arr, test, get) => {
      const keep = [];
      for (const e of arr) {
        if (test(e)) { const m = get(e); this.course.remove(m); this._disposeTree(m); } else keep.push(e);
      }
      return keep;
    };
    this.platforms = drop(this.platforms, (p) => gone(p.base.z - p.h.z), (p) => p.mesh);
    this.items = drop(this.items, (it) => gone(it.z), (it) => it.mesh);
    this.checkpoints = drop(this.checkpoints, (c) => gone(c.spawn.z + 2), (c) => c.mesh);
    const spinners = [];
    for (const sp of this.spinners) {
      if (gone(sp.z)) { this.course.remove(sp.group); this._disposeTree(sp.group); } else spinners.push(sp);
    }
    this.spinners = spinners;
    this.props = drop(this.props, (pr) => gone(pr.z + 20), (pr) => pr.mesh);
  };

  // ---------- adornos flotantes a los lados ----------

  P._infProp = function _infProp(p, zone) {
    const inf = this.inf;
    const theme = this.biomeAt(zone);
    const rnd = inf.rnd;
    const G = this._pgeo();
    const mat = (hex) => this._pmat(hex);
    const g = new THREE.Group();
    const add = (geo, m, x, y, z, sx, sy = sx, sz = sx) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(x, y, z);
      mesh.scale.set(sx, sy, sz);
      g.add(mesh);
      return mesh;
    };
    // isla pequeña de apoyo
    const r = 2.2 + rnd() * 1.6;
    add(G.cone, mat(theme.side), 0, -r * 0.9, 0, r, r * 1.8, r).rotation.x = Math.PI;
    add(G.cyl, mat(theme.top), 0, 0.15, 0, r, 0.3, r);
    switch (theme.prop) {
      case "tree":
        add(G.cyl, mat(0x64321b), 0, 1.7, 0, 0.35, 3.2, 0.35);
        add(G.sphere, mat(0x4aa84a), 0, 4, 0, 1.8, 1.5, 1.8);
        break;
      case "candy":
        add(G.cyl, mat(0xfff6e6), 0, 2.2, 0, 0.26, 4.2, 0.26);
        add(G.sphere, mat(theme.accent === 0xfff6e6 ? 0xff7aa8 : theme.accent), 0, 4.6, 0, 1.3);
        break;
      case "cloud":
        add(G.sphere, mat(0xffffff), 0, 1.2, 0, 1.5);
        add(G.sphere, mat(0xffffff), 1.3, 0.9, 0.3, 1.1);
        add(G.sphere, mat(0xffffff), -1.2, 0.9, -0.2, 1.2);
        break;
      case "mill": {
        add(G.cyl, mat(0xc98a4b), 0, 2, 0, 0.9, 4, 0.9);
        add(G.sphere, mat(0x64321b), 0, 4.2, 0.9, 0.35);
        for (let k = 0; k < 4; k++) {
          const a = (k * Math.PI) / 2 + 0.4;
          const blade = add(G.box, mat(k % 2 ? 0xfff6e6 : 0xd4216c), -Math.sin(a) * 1.3, 4.2 + Math.cos(a) * 1.3, 1, 0.35, 2.6, 0.08);
          blade.rotation.z = a;
        }
        break;
      }
      case "pillar":
        add(G.box, mat(theme.accent), 0, 3, 0, 0.7, 6, 0.7);
        add(G.octa, mat(0xff3fa4), 0, 6.6, 0, 0.7);
        break;
      case "crystal":
        add(G.octa, mat(theme.accent === 0xffffff ? 0x7fe8c8 : theme.accent), 0, 2.2, 0, 1, 2.2, 1);
        add(G.octa, mat(0xffffff), 1.2, 1.2, 0.4, 0.5, 1.1, 0.5);
        break;
      case "planet": {
        add(G.sphere, mat(0xff3fa4), 0, 3, 0, 1.7);
        const ring = add(G.torus, mat(0xffc800), 0, 3, 0, 2.6);
        ring.rotation.x = 1.2;
        break;
      }
      default:
        break;
    }
    const side = rnd() < 0.5 ? -1 : 1;
    const s = 0.8 + rnd() * 0.7;
    g.scale.setScalar(s);
    const z = p.base.z + (rnd() - 0.5) * 6;
    g.position.set(side * (14 + rnd() * 12), p.base.y - 4 + (rnd() - 0.5) * 8, z);
    this.course.add(g);
    this.props.push({ mesh: g, z });
  };

  P._pgeo = function _pgeo() {
    if (!this._pg) {
      this._pg = {
        sphere: new THREE.SphereGeometry(1, 10, 8),
        cyl: new THREE.CylinderGeometry(1, 1, 1, 10),
        cone: new THREE.ConeGeometry(1, 1, 8),
        octa: new THREE.OctahedronGeometry(1),
        torus: new THREE.TorusGeometry(1, 0.12, 6, 20),
        box: new THREE.BoxGeometry(1, 1, 1),
      };
      for (const g of Object.values(this._pg)) this._shared.add(g);
    }
    return this._pg;
  };

  P._pmat = function _pmat(hex) {
    this._pm = this._pm || new Map();
    let m = this._pm.get(hex);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.75, flatShading: true });
      this._pm.set(hex, m);
      this._shared.add(m);
    }
    return m;
  };

  // ---------- reglas del modo ----------

  /** Al pasar por un checkpoint de un mundo nuevo. */
  P._checkpointsInf = function _checkpointsInf() {
    const P0 = this.pos;
    for (const c of this.checkpoints) {
      if (c.reached) continue;
      if (Math.hypot(c.spawn.x - P0.x, c.spawn.z - P0.z) > 4 || Math.abs(c.spawn.y - P0.y) > 3) continue;
      c.reached = true;
      this._paintFlag(c, true);
      this.spawn = c.spawn.clone();
      this.inf.zoneReached = c.zone;
      this.stageReached = Math.min(5, c.zone);
      audio.playMissionComplete();
      this.banner(`Mundo ${c.zone + 1} · ${c.theme.name}`);
      this.particles.burst(new THREE.Vector3(c.spawn.x, c.spawn.y + 1.5, c.spawn.z), [0xffc800, 0xd4216c, 0xfff6e6, c.theme.accent], 44, 6, 1.2, 5, 1.2);
      this.cashIn(2, "+2 🍫✨", new THREE.Vector3(P0.x, P0.y + 2.2, P0.z));
      if (c.zone % 3 === 0 && this.inf.lives < MAX_LIVES) {
        this.inf.lives++;
        this.popups.add(new THREE.Vector3(P0.x, P0.y + 3, P0.z), "¡+1 vida! ❤️", "combo");
      }
      this._applyAccessories();
      this.heroMode = "cheer";
      this.heroModeT = 1.2;
    }
  };

  P.metersRun = function metersRun() {
    return Math.max(0, Math.floor(-this.inf.maxZ));
  };

  P._calcScoreInf = function _calcScoreInf() {
    return this.metersRun() + this.itemsGot * 10 + this.goldGot * 50 + (this.inf.zoneReached || 0) * 100;
  };

  P._infTick = function _infTick(dt) {
    const inf = this.inf;
    inf.maxZ = Math.min(inf.maxZ, this.pos.z);
    this._extendWorld();
    inf.cullT -= dt;
    if (inf.cullT <= 0) { inf.cullT = 0.5; this._cullWorld(); }
    if (this.power) {
      this.power.t -= dt;
      if (this.power.t <= 0) this.power = null;
    }
  };

  P._givePower = function _givePower(kind, at) {
    const def = POWERS[kind];
    this.power = { kind, t: def.secs };
    this.popups.add(at, `${def.icon} ${def.name}`, "combo");
    this.particles.burst(at, [def.color, 0xfff6e6], 24, 4.5, 0.9, 4, 1.1);
  };

  /** Fin de la partida en el mundo infinito (se acabaron las vidas). */
  P._infGameOver = function _infGameOver() {
    const m = this.metersRun();
    const stats = this.progress.stats;
    const record = m > (stats.parkourInfBest || 0);
    if (record) stats.parkourInfBest = m;
    stats.parkourInfRuns = (stats.parkourInfRuns || 0) + 1;
    stats.parkourInfWorlds = Math.max(stats.parkourInfWorlds || 0, (this.inf.zoneReached || 0) + 1);
    this.score = this._calcScoreInf();
    this.runInfo = { meters: m };
    this.els.banner.classList.remove("show");
    this.power = null;
    this.heroMode = "sad";
    this.heroModeT = 99;
    const title = this.q("gameover-title");
    if (title) title.textContent = record && m > 0 ? "¡Nuevo récord! 🏆" : "¡Buen recorrido! 🍫";
    this._updateHud(true);
    this.finish(
      `Corriste ${m} m y llegaste al Mundo ${(this.inf.zoneReached || 0) + 1} con ${this.itemsGot} alfajores y ${this.goldGot} barras Matidubai. ` +
      (record ? "¡Es tu mejor marca!" : `Tu récord es ${stats.parkourInfBest} m.`),
    );
  };
}
