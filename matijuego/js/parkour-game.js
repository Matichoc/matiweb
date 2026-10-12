// Parkour Choco 3D (estilo "obby" de Roblox): corre, salta y esquiva por seis etapas
// de plataformas de colores con tachas, plataformas que se mueven, se rompen, parpadean,
// trampolines y molinos giratorios. Junta alfajores y barras Matidubai, activa los
// checkpoints y llega a la cumbre. Al avanzar, tu Matichico desbloquea accesorios
// (capa, gafas brillantes y corona) además del atuendo que compraste en la tienda.

import { THREE, Game3D, clamp, lerp, rand, canvasTexture, loadTexture, roundedBox, makeStars } from "./three-kit.js?v=f2916d806a";
import { createMatichico } from "./matichico3d.js?v=f2916d806a";
import { earnCoins, saveProgress } from "./storage.js?v=f2916d806a";
import { trailColors } from "./wardrobe-data.js?v=f2916d806a";
import { installInfinite, MAX_LIVES, POWERS, ZONE_LEN } from "./parkour-infinite.js?v=f2916d806a";
import * as audio from "./audio.js?v=f2916d806a";
import { campaign, renderLevelPicker } from "./campaign.js?v=f2916d806a";

const GAME_ID = "parkour";
const R = 0.34; // radio del héroe
const H = 1.55; // alto del héroe
const GRAV = 30;
const JUMP_V = 11.6;
const DOUBLE_V = 10;
const PAD_V = 21;
const RUN = 7.4;
const FALL_Y = -16;
const COYOTE = 0.12;
const BUFFER = 0.14;

const mulberry32 = (a) => () => {
  a |= 0; a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const smooth = (t) => t * t * (3 - 2 * t);

const STAGES = [
  { name: "Pradera Matichoc", sky: 0x9fdcf5, top: 0x6cc04a, side: 0x3f8a2d, accent: 0xffc800, hemi: 1.25, sun: 2.4, night: 0, trail: [0xffc800, 0xfff6e6] },
  { name: "Camino de Caramelo", sky: 0xffc9a8, top: 0xff7aa8, side: 0xc0306a, accent: 0xfff6e6, hemi: 1.2, sun: 2.3, night: 0, trail: [0xff7aa8, 0xfff6e6] },
  { name: "Nubes Saltarinas", sky: 0xb7c8ff, top: 0xfff6e6, side: 0xb7a3e8, accent: 0xd4216c, hemi: 1.3, sun: 2.4, night: 0, trail: [0xd4216c, 0xffffff] },
  { name: "Molinos de Cacao", sky: 0xf0b27a, top: 0xc98a4b, side: 0x64321b, accent: 0xffc800, hemi: 1.15, sun: 2.2, night: 0, trail: [0xffc800, 0xe8742a] },
  { name: "Noche Neón", sky: 0x1a1240, top: 0x3a2d8a, side: 0x16103a, accent: 0x35f0ff, hemi: 0.75, sun: 0.9, night: 1, trail: [0x35f0ff, 0xff3fa4] },
  { name: "Cumbre Matichoc", sky: 0xffd77a, top: 0xffe9a8, side: 0xd4a037, accent: 0xffc800, hemi: 1.3, sun: 2.6, night: 0, trail: [0xffc800, 0xd4216c, 0xfff6e6] },
];

const SPRITES = ["alf-frambuesa", "alf-menta", "alf-naranja", "alf-trufa", "alf-pie-limon", "alf-maracuya", "alf-almendra", "alf-capuchino"];

export class ParkourGame extends Game3D {
  constructor(character, progress, els) {
    super(GAME_ID, character, progress, els, { fov: 56 });
    this.musicTheme = "adventure";
    this.q = els.q;
    this.keys = {};
    this.joy = { x: 0, y: 0 };
    this.camYaw = 0;
    this.camPitch = 0.42;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.tmpColor = new THREE.Color();
    this.tmpColor2 = new THREE.Color();
    this.hudCache = "";
    this.mode = "campaign"; // lo que eligió la jugadora: "campaign" (6 etapas) o "inf" (mundo infinito)
    this.worldMode = null; // lo que hay construido en la escena ahora
    this.power = null;
  }

  // ---------- escena ----------

  async build() {
    const s = this.scene;
    s.background = new THREE.Color(0x9fdcf5);
    s.fog = new THREE.Fog(0x9fdcf5, 34, 108);
    this.hemi = new THREE.HemisphereLight(0xcfeaff, 0xf2d8b0, 1.25);
    s.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff0d2, 2.4);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(this.coarse ? 1024 : 2048, this.coarse ? 1024 : 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -16; sc.right = 16; sc.top = 16; sc.bottom = -16; sc.near = 1; sc.far = 80;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.05;
    s.add(this.sun, this.sun.target);
    this.onLowQuality = () => { this.sun.castShadow = false; };

    this.stars = makeStars(450, 160);
    this.stars.material.transparent = true;
    this.stars.material.opacity = 0;
    s.add(this.stars);

    // textura de "tachas" estilo Roblox
    this.studTex = canvasTexture(128, 128, (g, w, h) => {
      g.fillStyle = "#ffffff"; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
        const cx = 32 + i * 64, cy = 32 + j * 64;
        const grad = g.createRadialGradient(cx - 6, cy - 6, 2, cx, cy, 24);
        grad.addColorStop(0, "#ffffff"); grad.addColorStop(0.7, "#d8d8d8"); grad.addColorStop(1, "#a8a8a8");
        g.fillStyle = grad;
        g.beginPath(); g.arc(cx, cy, 20, 0, Math.PI * 2); g.fill();
        g.strokeStyle = "rgba(0,0,0,0.25)"; g.lineWidth = 2; g.stroke();
      }
    });
    this.studTex.wrapS = this.studTex.wrapT = THREE.RepeatWrapping;
    this.studTex.anisotropy = 8;

    this.m = {
      gold: new THREE.MeshStandardMaterial({ color: 0xffc800, roughness: 0.25, metalness: 0.65, emissive: 0x6a4a00, emissiveIntensity: 0.5 }),
      cream: new THREE.MeshStandardMaterial({ color: 0xfff6e6, roughness: 0.5 }),
      pink: new THREE.MeshStandardMaterial({ color: 0xd4216c, roughness: 0.4 }),
      white: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }),
      post: new THREE.MeshStandardMaterial({ color: 0x64321b, roughness: 0.6 }),
    };
    this.sprites = {};
    for (const n of SPRITES) this.sprites[n] = loadTexture(`assets/products/${n}.jpg`);
    this.discGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.1, 24);
    this.rimGeo = new THREE.TorusGeometry(0.43, 0.05, 8, 24);
    // cosas compartidas por muchos objetos: no se liberan al borrar el recorrido
    this._shared = new Set([...Object.values(this.m), ...Object.values(this.sprites), this.discGeo, this.rimGeo, this.studTex]);
    this.studCache = new Map();
    // aro de color alrededor del héroe mientras tiene un poder
    this.aura = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false }));
    this.aura.visible = false;
    s.add(this.aura);

    // río de chocolate bajo el recorrido
    const riverTex = canvasTexture(256, 256, (g, w, h) => {
      g.fillStyle = "#4a2412"; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) {
        g.strokeStyle = i % 2 ? "rgba(255,200,120,0.18)" : "rgba(20,8,2,0.35)";
        g.lineWidth = 3 + Math.random() * 4;
        g.beginPath();
        const y = Math.random() * h;
        g.moveTo(0, y);
        g.bezierCurveTo(w * 0.3, y + 30, w * 0.6, y - 30, w, y);
        g.stroke();
      }
    });
    riverTex.wrapS = riverTex.wrapT = THREE.RepeatWrapping;
    riverTex.repeat.set(30, 90);
    this.riverTex = riverTex;
    this.river = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 1300),
      new THREE.MeshStandardMaterial({ map: riverTex, roughness: 0.18, metalness: 0.15, color: 0xffffff }),
    );
    this.river.rotation.x = -Math.PI / 2;
    this.river.position.set(0, -13, -500);
    s.add(this.river);

    this._buildCourse();
    this._buildDecor();
    this._ensureHero();
  }

  // ---------- recorrido ----------

  _buildCourse() {
    this._clearCourse();
    this.worldMode = "campaign";
    const rnd = mulberry32(2025);
    const rr = (a, b) => a + rnd() * (b - a);
    let cur = null;

    const place = (stage, type, o) => {
      const { sx, sz } = o;
      let x = 0;
      if (cur) {
        const maxdx = Math.max(0.2, (cur.sx + sx) / 2 - 0.9);
        x = clamp(cur.x + clamp(o.dx || 0, -maxdx, maxdx), -9, 9);
      }
      const top = cur ? cur.top + (o.dy || 0) : 0;
      const z = cur ? cur.z - cur.sz / 2 - (o.gap ?? 2) - sz / 2 : 0;
      const p = this._makePlatform(stage, type, { ...o, x, top, z });
      cur = { x, top, z, sx, sz };
      return p;
    };
    const stageStart = (stage, p, extra = 0) => {
      this.stageStarts.push(p.base.z);
      this.checkpoints.push({
        stage,
        spawn: new THREE.Vector3(p.base.x, p.base.y + p.h.y, p.base.z - extra),
        mesh: this._makeFlag(stage, p),
        reached: false,
      });
    };
    const item = (x, y, z, kind = "item") => this.items.push(this._makeItem(x, y, z, kind));
    const onTop = (p, n = 1, spread = 0.9) => {
      for (let i = 0; i < n; i++) item(p.base.x + (n > 1 ? (i - (n - 1) / 2) * spread : 0) * 0, p.base.y + p.h.y + 1.15, p.base.z + (n > 1 ? (i - (n - 1) / 2) * spread : 0));
    };
    const arc = (a, b) => item((a.base.x + b.base.x) / 2, Math.max(a.base.y + a.h.y, b.base.y + b.h.y) + 2.3, (a.base.z - a.h.z + b.base.z + b.h.z) / 2);

    // ---- Etapa 1: Pradera ----
    const start = place(0, "start", { sx: 10, sz: 10 });
    stageStart(0, start, 0);
    let prev = start;
    const dy1 = [0, 0.4, 0, 0.4, 0, 0.5, 0, 0.4];
    for (let i = 0; i < 8; i++) {
      const p = place(0, "normal", { sx: 4.4, sz: 4.4, gap: 1.5 + i * 0.18, dx: rr(-2.6, 2.6), dy: dy1[i] });
      onTop(p);
      if (i >= 2) arc(prev, p);
      prev = p;
    }
    // ---- Etapa 2: Camino de Caramelo ----
    let p = place(1, "normal", { sx: 7, sz: 7, gap: 2.2 });
    stageStart(1, p, 0);
    onTop(p, 2);
    prev = p;
    const s2 = [
      ["normal", 3.4], ["moving", 3.6], ["normal", 3.2], ["moving", 3.6], ["beam", 1.6], ["normal", 3.0], ["moving", 3.6], ["beam", 1.6], ["normal", 3.2],
    ];
    s2.forEach(([t, w], i) => {
      const o = { sx: w, sz: t === "beam" ? 6.5 : w, gap: t === "beam" ? 2.1 : rr(2.4, 3.0), dx: rr(-1.5, 1.5), dy: i % 3 === 1 ? 0.4 : 0 };
      if (t === "moving") Object.assign(o, { axis: "x", amp: 3.0, speed: 0.9, phase: i });
      const q = place(1, t, o);
      onTop(q, t === "beam" ? 3 : 1, 1.6);
      if (t !== "beam") arc(prev, q);
      prev = q;
    });
    // ---- Etapa 3: Nubes Saltarinas ----
    p = place(2, "normal", { sx: 7, sz: 7, gap: 2.4 });
    stageStart(2, p, 0);
    prev = p;
    for (let i = 0; i < 3; i++) {
      const q = place(2, "crumble", { sx: 3.2, sz: 3.2, gap: 2.4, dx: rr(-1.6, 1.6), dy: 0.4 });
      onTop(q);
      arc(prev, q);
      prev = q;
    }
    let q = place(2, "normal", { sx: 4.2, sz: 4.2, gap: 2.2, dx: 0, dy: 0 });
    onTop(q, 2);
    q = place(2, "pad", { sx: 3.6, sz: 3.6, gap: 2.2, dx: 0 });
    prev = q;
    q = place(2, "normal", { sx: 6, sz: 6, gap: 3.4, dx: 0, dy: 6 });
    onTop(q, 3);
    item(prev.base.x, prev.base.y + 6, prev.base.z - 2.4, "gold");
    prev = q;
    for (let i = 0; i < 3; i++) {
      q = place(2, i === 1 ? "crumble" : "normal", { sx: 3.2, sz: 3.2, gap: 2.6, dx: rr(-1.6, 1.6), dy: i === 0 ? 0.3 : 0 });
      onTop(q);
      arc(prev, q);
      prev = q;
    }
    // ---- Etapa 4: Molinos de Cacao ----
    p = place(3, "normal", { sx: 7, sz: 7, gap: 2.4 });
    stageStart(3, p, 0);
    onTop(p);
    prev = p;
    const s4 = [["spinner", 1.3], ["beam"], ["moving"], ["spinner", -1.7], ["beam"], ["normal"]];
    s4.forEach(([t, sp], i) => {
      let o;
      if (t === "spinner") o = { sx: 8.4, sz: 8.4, gap: 2.4, dx: 0 };
      else if (t === "beam") o = { sx: 1.6, sz: 7, gap: 2.0, dx: 0 };
      else if (t === "moving") o = { sx: 4, sz: 4, gap: 2.4, dx: 0, axis: "x", amp: 3.4, speed: 1.0, phase: 0 };
      else o = { sx: 5, sz: 5, gap: 2.4, dx: 0 };
      const w = place(3, t === "spinner" ? "normal" : t, o);
      if (t === "spinner") {
        this._makeSpinner(w, 6.6, sp);
        item(w.base.x, w.base.y + w.h.y + 1.7, w.base.z + 2.3);
        item(w.base.x, w.base.y + w.h.y + 1.7, w.base.z - 2.3);
      } else onTop(w, t === "beam" ? 3 : 1, 1.6);
      prev = w;
    });
    // ---- Etapa 5: Noche Neón ----
    p = place(4, "normal", { sx: 7, sz: 7, gap: 2.4 });
    stageStart(4, p, 0);
    prev = p;
    for (let i = 0; i < 10; i++) {
      const w = place(4, "blink", { sx: 2.9, sz: 2.9, gap: 2.7, dx: rr(-1.4, 1.4), dy: i % 3 === 2 ? 0.35 : 0, phase: i * 0.9 });
      onTop(w);
      prev = w;
    }
    item(prev.base.x, prev.base.y + 4.2, prev.base.z - 2.6, "gold");
    q = place(4, "normal", { sx: 2.4, sz: 2.4, gap: 2.8, dx: 0, dy: 0.5 });
    onTop(q);
    q = place(4, "normal", { sx: 2.4, sz: 2.4, gap: 2.8, dx: 1, dy: 0.5 });
    onTop(q);
    // ---- Etapa 6: Cumbre ----
    p = place(5, "normal", { sx: 7, sz: 7, gap: 2.4 });
    stageStart(5, p, 0);
    prev = p;
    const s6 = ["normal", "moving", "crumble", "normal", "moving", "crumble", "normal", "moving"];
    s6.forEach((t, i) => {
      const o = { sx: 3.4, sz: 3.4, gap: 2.5, dx: rr(-1.4, 1.4), dy: 1.0 };
      if (t === "moving") Object.assign(o, { axis: "x", amp: 2.6, speed: 1.1, phase: i });
      const w = place(5, t, o);
      onTop(w);
      arc(prev, w);
      prev = w;
    });
    for (let i = 0; i < 3; i++) {
      const w = place(5, "normal", { sx: 4.2, sz: 4.2, gap: 2.4, dx: rr(-1.2, 1.2), dy: 0 });
      onTop(w, 2);
      prev = w;
    }
    const fin = place(5, "finish", { sx: 14, sz: 14, gap: 3.0, dx: 0, dy: 0.4 });
    this.goal = { platform: fin, x: fin.base.x, z: fin.base.z, top: fin.base.y + fin.h.y };
    this._makeFinish(fin);
    item(fin.base.x - 3, this.finish.top + 1.2, fin.base.z + 2, "gold");
    this.courseEndZ = fin.base.z;
  }

  _platformColors(th, type) {
    let top = th.top;
    let side = th.side;
    if (type === "beam") { top = 0xd9a45f; side = 0x8a5a36; }
    else if (type === "crumble") { top = 0xf0b878; side = 0xa86a3a; }
    else if (type === "moving") { top = 0xffc800; side = 0xb48400; }
    else if (type === "pad") { top = 0xd4216c; side = 0x8a1648; }
    else if (type === "blink") { top = 0x35f0ff; side = 0x1c6a8a; }
    else if (type === "start") { top = 0x6cc04a; side = 0x3f8a2d; }
    return { top, side };
  }

  _makePlatform(stage, type, o) {
    const th = o.theme || STAGES[stage];
    const hy = type === "beam" ? 0.3 : 0.4;
    const col = this._platformColors(th, type);
    // la textura de tachas se comparte entre plataformas del mismo tamaño
    const texKey = `${o.sx}x${o.sz}`;
    let tex = this.studCache.get(texKey);
    if (!tex) {
      tex = this.studTex.clone();
      tex.needsUpdate = true;
      tex.repeat.set(o.sx / 2, o.sz / 2);
      this.studCache.set(texKey, tex);
      this._shared.add(tex);
    }
    const topMat = new THREE.MeshStandardMaterial({ color: col.top, map: tex, roughness: 0.42, metalness: 0.02, transparent: type === "blink", opacity: 1 });
    const sideMat = new THREE.MeshStandardMaterial({ color: col.side, roughness: 0.6, transparent: type === "blink", opacity: 1 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(o.sx, hy * 2, o.sz), [sideMat, sideMat, topMat, sideMat, sideMat, sideMat]);
    body.castShadow = true;
    body.receiveShadow = true;
    const glowCol = type === "blink" ? 0xffffff : th.accent;
    const glowMat = new THREE.MeshBasicMaterial({ color: glowCol, transparent: true, opacity: type === "blink" ? 1 : 0.95 });
    const glow = new THREE.Mesh(new THREE.BoxGeometry(o.sx + 0.12, 0.12, o.sz + 0.12), glowMat);
    glow.position.y = -hy + 0.42 > hy ? 0 : hy * 0.25;
    const group = new THREE.Group();
    group.add(body, glow);
    const p = {
      type, stage, active: true, mesh: group, topMat, sideMat, glowMat,
      c: new THREE.Vector3(o.x, o.top - hy, o.z),
      base: new THREE.Vector3(o.x, o.top - hy, o.z),
      h: { x: o.sx / 2, y: hy, z: o.sz / 2 },
      box: {}, dx: 0, dz: 0,
      axis: o.axis, amp: o.amp || 0, speed: o.speed || 1, phase: o.phase || 0,
      state: "idle", timer: 0, vy: 0, pulse: 0,
    };
    if (type === "pad") {
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.25, 0.28, 28), new THREE.MeshStandardMaterial({ color: 0xffc800, roughness: 0.25, metalness: 0.5, emissive: 0xffa800, emissiveIntensity: 0.8 }));
      disc.position.y = hy + 0.14;
      disc.castShadow = true;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.07, 8, 28), this.m.cream);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = hy + 0.3;
      group.add(disc, ring);
      p.pad = disc;
    }
    if (type === "moving") {
      for (const sx of [-1, 1]) {
        const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.55, 3), this.m.pink);
        arrow.rotation.z = -sx * Math.PI / 2;
        arrow.rotation.y = 0;
        arrow.position.set(sx * (o.sx / 2 - 0.5), hy + 0.03, 0);
        arrow.rotation.x = Math.PI / 2;
        arrow.scale.set(1, 1, 0.12);
        group.add(arrow);
      }
    }
    group.position.copy(p.c);
    this.course.add(group);
    this._updateBox(p);
    this.platforms.push(p);
    return p;
  }

  _updateBox(p) {
    const b = p.box;
    b.minX = p.c.x - p.h.x; b.maxX = p.c.x + p.h.x;
    b.minY = p.c.y - p.h.y; b.maxY = p.c.y + p.h.y;
    b.minZ = p.c.z - p.h.z; b.maxZ = p.c.z + p.h.z;
  }

  _makeSpinner(p, len, speed) {
    const g = new THREE.Group();
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(len, 0.34, 0.4),
      new THREE.MeshStandardMaterial({
        map: canvasTexture(256, 32, (c, w, h) => {
          for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? "#fff6e6" : "#d4216c"; c.fillRect((i * w) / 8, 0, w / 8, h); }
        }),
        roughness: 0.4, emissive: 0x330010, emissiveIntensity: 0.4,
      }),
    );
    bar.castShadow = true;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.9, 14), this.m.gold);
    post.castShadow = true;
    g.add(bar, post);
    const top = p.base.y + p.h.y;
    g.position.set(p.base.x, top + 0.5, p.base.z);
    bar.position.y = 0;
    post.position.y = -0.1;
    this.course.add(g);
    this.spinners.push({ platform: p, group: g, bar, len, speed, angle: 0, x: p.base.x, z: p.base.z, top });
  }

  _makeFlag(stage, p, theme) {
    const th = theme || STAGES[stage];
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.2, 8), this.m.white);
    pole.position.y = 1.6;
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.9, 6, 3), new THREE.MeshStandardMaterial({ color: 0x8a8f9b, side: THREE.DoubleSide, roughness: 0.6 }));
    cloth.position.set(0.8, 2.75, 0);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.08, 8, 40), new THREE.MeshBasicMaterial({ color: th.accent }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.12;
    g.add(pole, cloth, ring);
    g.position.set(p.base.x + (p.h.x - 0.9) * 0.8, p.base.y + p.h.y, p.base.z - p.h.z * 0.5);
    g.userData.cloth = cloth;
    g.userData.base = cloth.geometry.attributes.position.array.slice();
    g.userData.ring = ring;
    this.course.add(g);
    return g;
  }

  _makeItem(x, y, z, kind, power) {
    const g = new THREE.Group();
    if (kind === "power") {
      const def = POWERS[power];
      const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.46, 1), new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.2, emissive: def.color, emissiveIntensity: 0.9 }));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.06, 8, 28), this.m.white);
      ring.rotation.x = Math.PI / 2.4;
      g.add(orb, ring);
      g.userData.spin = ring;
    } else if (kind === "gold") {
      const bar = new THREE.Mesh(roundedBox(0.95, 0.55, 0.28, 0.1, 0.04), this.m.gold);
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.3), new THREE.MeshBasicMaterial({ map: canvasTexture(128, 64, (c, w, h) => { c.fillStyle = "#fff6e6"; c.font = '46px "Baby Chipmunk", sans-serif'; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("DUBAI", w / 2, h / 2); }), transparent: true }));
      stripe.position.z = 0.15;
      g.add(bar, stripe);
      // la luz solo en la aventura: en el infinito aparecen y desaparecen muchas barras y cambiar la cantidad de luces es caro
      if (this.worldMode !== "inf") g.add(new THREE.PointLight(0xffc800, 8, 6));
    } else {
      const tex = this.sprites[SPRITES[Math.floor(Math.random() * SPRITES.length)]];
      const disc = new THREE.Mesh(this.discGeo, [this.m.cream, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }), this.m.cream]);
      disc.rotation.x = Math.PI / 2;
      const rim = new THREE.Mesh(this.rimGeo, this.m.gold);
      rim.position.z = 0.03;
      g.add(disc, rim);
    }
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    g.position.set(x, y, z);
    this.course.add(g);
    return { kind, power, mesh: g, x, y, z, taken: false, phase: Math.random() * 6.28 };
  }

  _makeFinish(p) {
    const top = p.base.y + p.h.y;
    const g = new THREE.Group();
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(roundedBox(0.9, 7, 0.9, 0.2, 0.06), this.m.gold);
      post.position.set(sx * 4.2, 3.5, 0);
      post.castShadow = true;
      g.add(post);
    }
    const bar = new THREE.Mesh(roundedBox(9.9, 1.5, 0.9, 0.3, 0.08), this.m.pink);
    bar.position.set(0, 7.2, 0);
    bar.castShadow = true;
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(8.6, 1.2),
      new THREE.MeshBasicMaterial({ transparent: true, map: canvasTexture(1024, 144, (c, w, h) => { c.fillStyle = "#FFF6E6"; c.font = '104px "Baby Chipmunk", sans-serif'; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("¡META MATICHOC!", w / 2, h / 2 + 6); }) }),
    );
    sign.position.set(0, 7.2, 0.5);
    g.add(bar, sign);
    // barra de chocolate gigante al fondo
    const choco = new THREE.Mesh(roundedBox(5, 3.2, 1.2, 0.3, 0.1), new THREE.MeshStandardMaterial({ color: 0x64321b, roughness: 0.3, metalness: 0.1 }));
    choco.position.set(0, 1.9, -4.5);
    choco.castShadow = true;
    g.add(choco);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
      const sq = new THREE.Mesh(roundedBox(1.3, 1.2, 0.3, 0.1, 0.04), new THREE.MeshStandardMaterial({ color: 0x7a3f22, roughness: 0.3 }));
      sq.position.set((i - 1) * 1.5, 1.2 + j * 1.45, -3.85);
      g.add(sq);
    }
    g.position.set(p.base.x, top, p.base.z + 2.5);
    this.course.add(g);
    this.finishGroup = g;
  }

  _buildDecor() {
    const s = this.scene;
    // sol
    const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(9, 24, 18), new THREE.MeshBasicMaterial({ color: 0xfff1b0 }));
    sunDisc.position.set(-60, 70, -260);
    s.add(sunDisc);
    this.sunDisc = sunDisc;
    // nubes grandes de baja resolución
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true });
    this.clouds = [];
    for (let i = 0; i < 26; i++) {
      const c = new THREE.Group();
      for (let k = 0; k < 4; k++) {
        const b = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(3, 6), 0), cloudMat);
        b.position.set(k * 4 - 6, rand(-1, 1.5), rand(-2, 2));
        c.add(b);
      }
      c.position.set(rand(-90, 90), rand(-4, 30), -i * 22 - 20);
      if (Math.abs(c.position.x) < 24) c.position.x += Math.sign(c.position.x || 1) * 30;
      s.add(c);
      this.clouds.push(c);
    }
    // islas flotantes al fondo
    const rock = new THREE.MeshStandardMaterial({ color: 0x8a5a36, roughness: 0.9, flatShading: true });
    const grass = new THREE.MeshStandardMaterial({ color: 0x6cc04a, roughness: 0.9, flatShading: true });
    this.islands = [];
    for (let i = 0; i < 18; i++) {
      const isl = new THREE.Group();
      const base = new THREE.Mesh(new THREE.ConeGeometry(rand(4, 8), rand(6, 11), 7), rock);
      base.rotation.x = Math.PI;
      const topM = new THREE.Mesh(new THREE.CylinderGeometry(base.geometry.parameters.radius, base.geometry.parameters.radius, 1.1, 7), grass);
      topM.position.y = 0.55;
      base.position.y = -base.geometry.parameters.height / 2 + 0.05;
      isl.add(base, topM);
      isl.position.set((i % 2 ? 1 : -1) * rand(28, 60), rand(-6, 14), -i * 18 - 10);
      s.add(isl);
      this.islands.push(isl);
    }
  }

  // ---------- héroe y accesorios ----------

  _ensureHero() {
    if (this.hero && this.heroId === this.character.id) {
      this.hero.setLook(this.look);
      return;
    }
    if (this.hero) this.scene.remove(this.hero.group);
    this.hero = createMatichico(this.character, this.outfit, this.look);
    this.heroId = this.character.id;
    this.hero.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.hero.group.scale.setScalar(1.08);
    this.scene.add(this.hero.group);
    this._buildAccessories();
  }

  _buildAccessories() {
    const body = this.hero.bodyGroup;
    const head = this.hero.head;
    // capa
    const capeGeo = new THREE.PlaneGeometry(0.62, 0.78, 4, 6);
    capeGeo.translate(0, -0.39, 0);
    this.capeBase = capeGeo.attributes.position.array.slice();
    this.cape = new THREE.Mesh(capeGeo, new THREE.MeshStandardMaterial({ color: 0xd4216c, side: THREE.DoubleSide, roughness: 0.5, emissive: 0x500020, emissiveIntensity: 0.5 }));
    this.cape.position.set(0, 0.74, -0.2);
    this.cape.castShadow = true;
    body.add(this.cape);
    // gafas brillantes
    this.shades = new THREE.Group();
    const lens = new THREE.MeshStandardMaterial({ color: 0x111122, roughness: 0.1, metalness: 0.8, emissive: 0x35f0ff, emissiveIntensity: 0.55 });
    for (const sx of [-1, 1]) {
      const l = new THREE.Mesh(roundedBox(0.27, 0.19, 0.05, 0.06, 0.02), lens);
      l.position.set(sx * 0.17, 0.05, 0.33);
      this.shades.add(l);
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.04), lens);
    bridge.position.set(0, 0.07, 0.335);
    this.shades.add(bridge);
    head.add(this.shades);
    // corona dorada
    this.crown = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.3, 0.12, 16, 1, true), this.m.gold);
    ring.material.side = THREE.DoubleSide;
    this.crown.add(ring);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 5), this.m.gold);
      tip.position.set(Math.cos(a) * 0.28, 0.14, Math.sin(a) * 0.28);
      this.crown.add(tip);
      const gem = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xff3fa4 : 0x35f0ff }));
      gem.position.set(Math.cos(a) * 0.28, 0.27, Math.sin(a) * 0.28);
      this.crown.add(gem);
    }
    this.crown.position.set(0, 0.44, 0);
    head.add(this.crown);
    this._applyAccessories();
  }

  /** Colores de la estela: la que compraste, o la del mundo en que vas. */
  _trail() {
    if (this.look && this.look.trail) return trailColors(this.look);
    return this.worldMode === "inf" ? this.biomeAt(this.inf.zoneReached || 0).trail : STAGES[this.stageReached].trail;
  }

  _applyAccessories() {
    const st = this.stageReached || 0;
    if (!this.cape) return;
    // los premios de etapa solo aparecen si el vestuario elegido no ocupa ese lugar
    const L = this.look || {};
    this.cape.visible = st >= 1 && !L.back;
    this.shades.visible = st >= 2 && !L.glasses;
    this.crown.visible = st >= 4 && !L.hat;
  }

  // ---------- partida ----------

  // modo misiones del Mundo infinito (js/missions.js)
  getMetric(m) {
    return { meters: this.metersRun(), items: this.itemsGot, worlds: (this.inf.zoneReached || 0) + 1, gold: this.goldGot, score: this.score }[m];
  }

  /** En la tarjeta de inicio se elige la misión (la partida empieza con los botones de modo). */
  onIntro() {
    const c = campaign(this.progress, "parkour");
    renderLevelPicker(this.els.q("lvlpick"), {
      id: "parkour", progress: this.progress, selected: Math.min(c.selected || c.unlocked, c.unlocked),
      onSelect: (n) => { c.selected = n; saveProgress(this.progress); },
    });
  }

  nextLevel() { this.nextMission(); }

  reset() {
    this._ensureHero();
    if (this.mode === "inf") this._resetInfinite();
    else if (this.worldMode !== "campaign") this._buildCourse();
    if (this.mode === "inf") this.setupMission();
    else { this.mission = null; const chip = this.els.q("hud-goal"); if (chip) chip.classList.add("hidden"); }
    this.power = null;
    this.aura.visible = false;
    this.stageReached = 0;
    this.itemsGot = 0;
    this.goldGot = 0;
    this.falls = 0;
    this.runTime = 0;
    this.coinsEarned = 0;
    this.score = 0;
    this.finished = false;
    this.finishTimer = 0;
    this.coyote = 0;
    this.buffer = 0;
    this.doubleAvail = false;
    this.grounded = false;
    this.ground = null;
    this.stun = 0;
    this.invuln = 0;
    this.heroYaw = Math.PI;
    this.trailT = 0;
    this.camYaw = 0;
    this.camPitch = 0.42;
    this.hudCache = "";
    for (const c of this.checkpoints) {
      c.reached = false;
      this._paintFlag(c, false);
    }
    this.checkpoints[0].reached = true;
    this._paintFlag(this.checkpoints[0], true);
    for (const it of this.items) { it.taken = false; it.mesh.visible = true; }
    for (const p of this.platforms) {
      p.state = "idle"; p.active = true; p.c.copy(p.base); p.vy = 0; p.mesh.position.copy(p.c); p.mesh.scale.setScalar(1); p.mesh.visible = true; this._updateBox(p);
    }
    for (const sp of this.spinners) sp.angle = 0;
    this.spawn = this.checkpoints[0].spawn.clone();
    this.pos.copy(this.spawn);
    this.vel.set(0, 0, 0);
    this._applyAccessories();
    this._snapCamera();
    this.river.visible = true;
    this._showRecord();
    this._updateHud(true);
    this._syncHero(0);
  }

  /** Empieza una partida en el modo elegido ("campaign" o "inf"). */
  startMode(mode) {
    this.mode = mode;
    this.particles.clear();
    this.popups.clear();
    this.state = "intro";
    this.reset();
    this.beginPlaying();
  }

  _showRecord() {
    const el = this.q("record");
    if (!el) return;
    const best = this.progress.stats.parkourInfBest || 0;
    el.textContent = best > 0 ? `Tu récord en el mundo infinito: ${best} m` : "";
  }

  onBegin() {
    this.runTime = 0;
    if (this.worldMode === "inf") this.banner(`Mundo 1 · ${this.biomeAt(0).name}`);
    else this.banner(`Etapa 1 · ${STAGES[0].name}`);
  }

  /** Suma Matipuntos ganados en esta partida y guarda. */
  cashIn(amount, text, at) {
    earnCoins(this.progress, amount);
    this.coinsEarned += amount;
    saveProgress(this.progress);
    if (text) this.popups.add(at, text, "coin");
  }

  banner(text) {
    const el = this.els.banner;
    el.textContent = text;
    el.classList.remove("show");
    void el.offsetWidth;
    el.classList.add("show");
  }

  _paintFlag(c, on) {
    const cloth = c.mesh.userData.cloth;
    cloth.material.color.setHex(on ? 0xffc800 : 0x8a8f9b);
    cloth.material.emissive.setHex(on ? 0x6a4a00 : 0x000000);
    c.mesh.userData.ring.material.opacity = on ? 1 : 0.4;
    c.mesh.userData.ring.material.transparent = true;
  }

  // ---------- ciclo ----------

  update(dt) {
    this._animateWorld(dt);
    if (this.state === "playing") {
      this.runTime += dt;
      this.buffer = Math.max(0, this.buffer - dt);
      this.stun = Math.max(0, this.stun - dt);
      this.invuln = Math.max(0, this.invuln - dt);
      const n = Math.max(1, Math.ceil(dt / (1 / 120)));
      const h = dt / n;
      // arrastre de plataforma móvil (una vez por cuadro)
      if (this.ground && this.ground.active && this.grounded) {
        this.pos.x += this.ground.dx;
        this.pos.z += this.ground.dz;
      }
      for (let i = 0; i < n; i++) this._physics(h);
      this._spinnerHits();
      this._collect(dt);
      if (this.worldMode === "inf") {
        this._checkpointsInf();
        this._infTick(dt);
      } else {
        this._checkpoints();
        this._checkFinish();
        if (this.finishTimer > 0) {
          this.finishTimer -= dt;
          if (this.finishTimer <= 0) this.finish(this.finishText);
        }
      }
      if (this.state === "playing" && this.pos.y < FALL_Y) this._respawn();
      this.score = this.worldMode === "inf" ? this._calcScoreInf() : this._calcScore(false);
      this._updateHud();
    }
    this._syncHero(dt);
    this._updateCamera(dt);
    this._updateSky();
  }

  _input() {
    let ix = this.joy.x;
    let iy = this.joy.y; // + = adelante
    if (this.keys.left) ix -= 1;
    if (this.keys.right) ix += 1;
    if (this.keys.up) iy += 1;
    if (this.keys.down) iy -= 1;
    const m = Math.hypot(ix, iy);
    if (m > 1) { ix /= m; iy /= m; }
    const yaw = this.camYaw;
    // adelante de la cámara = (-sin, -cos); derecha = (cos, -sin)
    return { x: -Math.sin(yaw) * iy + Math.cos(yaw) * ix, z: -Math.cos(yaw) * iy - Math.sin(yaw) * ix, mag: Math.min(1, m) };
  }

  _physics(dt) {
    const P = this.pos;
    const V = this.vel;
    const inp = this.stun > 0 ? { x: 0, z: 0, mag: 0 } : this._input();
    const kind = this.power && this.power.kind;
    const speedMul = kind === "turbo" ? 1.5 : 1;
    const jumpMul = kind === "jump" ? 1.28 : 1;
    const tx = inp.x * RUN * speedMul;
    const tz = inp.z * RUN * speedMul;
    const acc = (this.grounded ? 75 : 30) * dt;
    V.x += clamp(tx - V.x, -acc, acc);
    V.z += clamp(tz - V.z, -acc, acc);
    if (inp.mag > 0.1) this.heroYaw = Math.atan2(inp.x, inp.z);

    // salto
    this.coyote = this.grounded ? COYOTE : Math.max(0, this.coyote - dt);
    if (this.buffer > 0 && this.stun <= 0) {
      if (this.coyote > 0) {
        V.y = JUMP_V * jumpMul; this.coyote = 0; this.buffer = 0; this.doubleAvail = true; this.grounded = false; this.ground = null;
        audio.playJump();
        this.particles.burst(new THREE.Vector3(P.x, P.y + 0.1, P.z), [0xfff6e6, 0xffc800], 5, 2, 0.35, 4, 0.8);
      } else if (this.doubleAvail) {
        V.y = DOUBLE_V * jumpMul; this.doubleAvail = false; this.buffer = 0;
        audio.playJump();
        this.particles.burst(new THREE.Vector3(P.x, P.y + 0.2, P.z), this._trail(), 14, 3.4, 0.5, 2, 1);
      }
    }

    V.y = Math.max(-38, V.y - GRAV * dt);
    const prevFeet = P.y;
    const prevHead = P.y + H;
    P.x += V.x * dt;
    P.y += V.y * dt;
    P.z += V.z * dt;

    let landed = null;
    for (const p of this.platforms) {
      if (!p.active) continue;
      const b = p.box;
      const cx = clamp(P.x, b.minX, b.maxX);
      const cz = clamp(P.z, b.minZ, b.maxZ);
      const dx = P.x - cx;
      const dz = P.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= R * R) continue;
      const feet = P.y;
      const head = P.y + H;
      if (feet >= b.maxY || head <= b.minY) continue;
      if (V.y <= 0 && prevFeet >= b.maxY - 0.32) {
        if (!landed || b.maxY > landed.box.maxY) landed = p;
        continue;
      }
      if (V.y > 0 && prevHead <= b.minY + 0.2) {
        P.y = b.minY - H - 0.001;
        V.y = 0;
        continue;
      }
      // choque lateral
      const d = Math.sqrt(d2);
      let nx;
      let nz;
      let push;
      if (d > 0.0001) { nx = dx / d; nz = dz / d; push = R - d; }
      else {
        const l = P.x - b.minX, r = b.maxX - P.x, f = P.z - b.minZ, bk = b.maxZ - P.z;
        const m = Math.min(l, r, f, bk);
        nx = m === l ? -1 : m === r ? 1 : 0;
        nz = m === f ? -1 : m === bk ? 1 : 0;
        push = m + R;
      }
      P.x += nx * push;
      P.z += nz * push;
      const dot = V.x * nx + V.z * nz;
      if (dot < 0) { V.x -= dot * nx; V.z -= dot * nz; }
    }

    if (landed) {
      const impact = V.y;
      P.y = landed.box.maxY;
      V.y = 0;
      const wasAir = !this.grounded;
      this.grounded = true;
      this.ground = landed;
      this.doubleAvail = true;
      this._onLand(landed, wasAir, impact);
    } else {
      this.grounded = false;
      this.ground = null;
    }
  }

  _onLand(p, wasAir, impact) {
    if (wasAir && impact < -9) {
      this.particles.burst(new THREE.Vector3(this.pos.x, this.pos.y + 0.1, this.pos.z), [0xfff6e6, 0xd8c8a8], 6, 2.2, 0.4, 3, 0.9);
    }
    if (p.type === "crumble" && p.state === "idle") { p.state = "shaking"; p.timer = 0.55; }
    if (p.type === "pad") {
      this.vel.y = PAD_V;
      this.grounded = false;
      this.ground = null;
      this.doubleAvail = true;
      p.pulse = 1;
      audio.playBounce();
      this.particles.burst(new THREE.Vector3(this.pos.x, this.pos.y + 0.2, this.pos.z), [0xffc800, 0xd4216c, 0xfff6e6], 22, 5, 0.8, 2, 1.2);
    }
  }

  _spinnerHits() {
    if (this.invuln > 0) return;
    const P = this.pos;
    for (const sp of this.spinners) {
      if (P.y > sp.top + 0.78 || P.y + H < sp.top) continue;
      const ca = Math.cos(sp.angle) * sp.len / 2;
      const sa = Math.sin(sp.angle) * sp.len / 2;
      const ax = sp.x - ca, az = sp.z - sa;
      const bx = sp.x + ca, bz = sp.z + sa;
      const abx = bx - ax, abz = bz - az;
      const t = clamp(((P.x - ax) * abx + (P.z - az) * abz) / (abx * abx + abz * abz), 0, 1);
      const qx = ax + abx * t, qz = az + abz * t;
      const dx = P.x - qx, dz = P.z - qz;
      const d = Math.hypot(dx, dz);
      if (d < R + 0.22) {
        const nx = d > 0.001 ? dx / d : 1;
        const nz = d > 0.001 ? dz / d : 0;
        this.vel.x = nx * 10;
        this.vel.z = nz * 10;
        this.vel.y = 7;
        this.grounded = false;
        this.ground = null;
        this.stun = 0.35;
        this.invuln = 0.8;
        audio.playBump();
        this.popups.add(new THREE.Vector3(P.x, P.y + 2, P.z), "¡Auch!", "kill");
        this.particles.burst(new THREE.Vector3(P.x, P.y + 0.8, P.z), [0xd4216c, 0xfff6e6], 12, 4, 0.5, 5, 1);
      }
    }
  }

  _collect(dt = 0) {
    const P = this.pos;
    const cy = P.y + 0.8;
    const magnet = this.power && this.power.kind === "magnet";
    for (const it of this.items) {
      if (it.taken) continue;
      const pull = magnet && it.kind !== "power";
      if (Math.abs(it.z - P.z) > (pull ? 6 : 1.4)) continue;
      let d = Math.hypot(it.x - P.x, it.y - cy, it.z - P.z);
      if (pull && d < 6 && d > 1.15) {
        // el imán atrae los alfajores y las barras
        const k = Math.min(1, dt * 9);
        it.x += (P.x - it.x) * k;
        it.y += (cy - it.y) * k;
        it.z += (P.z - it.z) * k;
        d = Math.hypot(it.x - P.x, it.y - cy, it.z - P.z);
      }
      if (d > 1.15) continue;
      it.taken = true;
      it.mesh.visible = false;
      const at = new THREE.Vector3(it.x, it.y + 0.4, it.z);
      if (it.kind === "power") {
        audio.playBonusCollect();
        this._givePower(it.power, at);
      } else if (it.kind === "gold") {
        this.goldGot++;
        audio.playBonusCollect();
        this.cashIn(3, "+3 🍫✨", at);
        this.particles.burst(at, [0xffc800, 0xfff6e6, 0xff3fa4], 26, 5.5, 1, 5, 1.2);
      } else {
        this.itemsGot++;
        audio.playCollect();
        this.popups.add(at, "+10", "kill");
        this.particles.burst(at, [0xffc800, 0xfff6e6, 0xd4216c], 8, 3, 0.5, 4);
      }
    }
  }

  _checkpoints() {
    const P = this.pos;
    this.checkpoints.forEach((c, i) => {
      if (c.reached) return;
      if (Math.hypot(c.spawn.x - P.x, c.spawn.z - P.z) > 4 || Math.abs(c.spawn.y - P.y) > 3) return;
      c.reached = true;
      this._paintFlag(c, true);
      this.stageReached = Math.max(this.stageReached, i);
      this.spawn = c.spawn.clone();
      audio.playMissionComplete();
      this.banner(`Etapa ${i + 1} · ${STAGES[i].name}`);
      this.particles.burst(new THREE.Vector3(c.spawn.x, c.spawn.y + 1.5, c.spawn.z), [0xffc800, 0xd4216c, 0xfff6e6, STAGES[i].accent], 44, 6, 1.2, 5, 1.2);
      const unlock = i === 1 ? "¡Capa Matichoc desbloqueada! 🦸" : i === 2 ? "¡Gafas brillantes desbloqueadas! 😎" : i === 4 ? "¡Corona dorada desbloqueada! 👑" : null;
      if (unlock) this.popups.add(new THREE.Vector3(P.x, P.y + 2.6, P.z), unlock, "combo");
      this._applyAccessories();
      this.heroMode = "cheer";
      this.heroModeT = 1.2;
    });
  }

  _checkFinish() {
    if (this.finished) return;
    const f = this.goal;
    if (Math.hypot(this.pos.x - f.x, this.pos.z - f.z) < 6.6 && this.pos.y >= f.top - 0.2 && this.pos.y < f.top + 1 && this.grounded) {
      this.finished = true;
      this.stageReached = 5;
      audio.playVictory();
      this.particles.burst(new THREE.Vector3(f.x, f.top + 3, f.z + 2), [0xffc800, 0xd4216c, 0xcfd767, 0xfff6e6, 0x35f0ff], 120, 9, 2, 5, 1.4);
      const coins = 20;
      earnCoins(this.progress, coins);
      this.progress.stats.parkourFinishes = (this.progress.stats.parkourFinishes || 0) + 1;
      this.coinsEarned += coins;
      saveProgress(this.progress);
      this.score = this._calcScore(true);
      this.heroMode = "cheer";
      this.heroModeT = 99;
      const mm = Math.floor(this.runTime / 60);
      const ss = String(Math.floor(this.runTime % 60)).padStart(2, "0");
      this.finishText = `Llegaste a la cima en ${mm}:${ss}, con ${this.itemsGot} alfajores, ${this.goldGot} barras Matidubai y ${this.falls} caídas. ¡${this.score} puntos y ${this.coinsEarned} Matipuntos!`;
      this.finishTimer = 1.6;
    }
  }

  _calcScore(done) {
    let s = this.itemsGot * 10 + this.goldGot * 50 + this.stageReached * 100 - this.falls * 10;
    if (done) s += 300 + Math.max(0, Math.round(900 - this.runTime * 3));
    return Math.max(0, s);
  }

  _respawn() {
    this.falls++;
    audio.playBump();
    if (this.worldMode === "inf") {
      if (this.power && this.power.kind === "shield") {
        this.power = null;
        this.banner("¡El escudo te salvó! 🛡️");
      } else {
        this.inf.lives--;
        if (this.inf.lives <= 0) {
          this._infGameOver();
          return;
        }
        this.banner(`¡Ups! Te quedan ${this.inf.lives} ❤️`);
      }
    } else this.banner("¡Ups! Vuelves al checkpoint");
    this._safeSpawn();
    this.pos.copy(this.spawn);
    this.vel.set(0, 0, 0);
    this.grounded = false;
    this.ground = null;
    this.invuln = 1;
    this.stun = 0;
    this.heroMode = "sad";
    this.heroModeT = 0.7;
    this.els.wrap.classList.add("pk-flash");
    setTimeout(() => this.els.wrap.classList.remove("pk-flash"), 450);
    this._snapCamera();
  }

  /** Si bajo el punto de reaparición ya no hay plataforma (nunca debería), usa la más cercana que exista. */
  _safeSpawn() {
    const sp = this.spawn;
    const under = this.platforms.some((p) => p.active && sp.x >= p.box.minX - 0.3 && sp.x <= p.box.maxX + 0.3 && sp.z >= p.box.minZ - 0.3 && sp.z <= p.box.maxZ + 0.3 && Math.abs(sp.y - p.box.maxY) < 1.5);
    if (under) return;
    let best = null;
    let bd = Infinity;
    for (const p of this.platforms) {
      if (!p.active || p.state === "falling" || p.type !== "normal") continue;
      const d = Math.hypot(p.c.x - sp.x, p.c.z - sp.z);
      if (d < bd) { bd = d; best = p; }
    }
    if (best) sp.set(best.c.x, best.box.maxY, best.c.z);
  }

  _updateHud(force = false) {
    const inf = this.worldMode === "inf";
    const stage = inf ? `Mundo ${(this.inf.zoneReached || 0) + 1} · ${this.metersRun()} m` : `Etapa ${this.stageReached + 1}/6`;
    const mm = Math.floor(this.runTime / 60);
    const ss = String(Math.floor(this.runTime % 60)).padStart(2, "0");
    const pw = this.power ? `${POWERS[this.power.kind].icon} ${Math.ceil(this.power.t)}` : "";
    const lives = inf ? this.inf.lives : 0;
    const key = `${stage}|${this.itemsGot}|${mm}:${ss}|${this.progress.coins}|${pw}|${lives}`;
    if (!force && key === this.hudCache) return;
    this.hudCache = key;
    const q = this.q;
    q("hud-stage").textContent = stage;
    q("hud-items").textContent = String(this.itemsGot);
    q("hud-time").textContent = `${mm}:${ss}`;
    q("hud-coins").textContent = String(this.progress.coins);
    const livesEl = q("hud-lives");
    if (livesEl) {
      livesEl.parentElement.classList.toggle("hidden", !inf || lives <= 0);
      livesEl.textContent = "❤️".repeat(Math.max(0, lives));
    }
    const powerEl = q("hud-power");
    if (powerEl) {
      powerEl.parentElement.classList.toggle("hidden", !pw);
      powerEl.textContent = pw;
    }
  }

  // ---------- animación del mundo ----------

  _animateWorld(dt) {
    const t = this.time;
    for (const p of this.platforms) {
      if (p.type === "moving") {
        const o = Math.sin(t * p.speed + p.phase) * p.amp;
        const nx = p.axis === "z" ? p.base.x : p.base.x + o;
        const nz = p.axis === "z" ? p.base.z + o : p.base.z;
        p.dx = nx - p.c.x;
        p.dz = nz - p.c.z;
        p.c.x = nx; p.c.z = nz;
        p.mesh.position.copy(p.c);
        this._updateBox(p);
      } else if (p.type === "blink") {
        const period = 3.2;
        const ph = (t + p.phase) % period;
        const on = ph < 2.3;
        const warn = on && ph > 1.7;
        p.active = on;
        const op = on ? (warn ? 0.45 + Math.abs(Math.sin(t * 20)) * 0.45 : 1) : 0.1;
        p.topMat.opacity = op;
        p.sideMat.opacity = op;
        p.glowMat.opacity = on ? 1 : 0.18;
      } else if (p.type === "crumble") {
        if (p.state === "shaking") {
          p.timer -= dt;
          p.mesh.position.set(p.c.x + Math.sin(t * 70) * 0.05, p.c.y, p.c.z + Math.cos(t * 63) * 0.05);
          if (p.timer <= 0) { p.state = "falling"; p.timer = 2.8; p.active = false; p.vy = 0; }
        } else if (p.state === "falling") {
          p.timer -= dt;
          p.vy -= 25 * dt;
          p.mesh.position.y += p.vy * dt;
          p.mesh.rotation.x += dt * 0.8;
          if (p.timer <= 0) { p.state = "hidden"; p.timer = 1.2; p.mesh.visible = false; }
        } else if (p.state === "hidden") {
          p.timer -= dt;
          if (p.timer <= 0) {
            p.state = "idle"; p.active = true; p.mesh.visible = true;
            p.mesh.position.copy(p.c); p.mesh.rotation.set(0, 0, 0); p.vy = 0;
            p.mesh.scale.setScalar(0.1); p.pop = 0;
          }
        } else if (p.mesh.scale.x < 1) {
          p.pop = (p.pop || 0) + dt * 4;
          p.mesh.scale.setScalar(Math.min(1, 0.1 + smooth(Math.min(1, p.pop)) * 0.9));
        }
      } else if (p.type === "pad") {
        p.pulse = Math.max(0, p.pulse - dt * 3);
        p.pad.scale.set(1 + p.pulse * 0.25, 1 - p.pulse * 0.4, 1 + p.pulse * 0.25);
        p.pad.material.emissiveIntensity = 0.6 + Math.sin(t * 5) * 0.3 + p.pulse;
      }
    }
    for (const sp of this.spinners) {
      sp.angle += sp.speed * dt;
      sp.bar.rotation.y = -sp.angle;
    }
    for (const it of this.items) {
      if (it.taken) continue;
      const m = it.mesh;
      m.position.set(it.x, it.y + Math.sin(t * 2.4 + it.phase) * 0.12, it.z);
      if (it.kind === "power") { m.rotation.y = t * 1.8; m.userData.spin.rotation.z = t * 3; }
      else if (it.kind === "gold") m.rotation.y = t * 1.8 + it.phase;
      else m.rotation.y = Math.sin(t * 1.6 + it.phase) * 0.7;
    }
    for (const c of this.checkpoints) {
      const cloth = c.mesh.userData.cloth;
      const pos = cloth.geometry.attributes.position;
      const base = c.mesh.userData.base;
      for (let i = 0; i < pos.count; i++) {
        const x = base[i * 3];
        pos.setZ(i, Math.sin(t * 5 + x * 3) * 0.12 * (x + 0.75));
      }
      pos.needsUpdate = true;
      c.mesh.userData.ring.rotation.z = t * 0.8;
    }
    this.river.position.z = this.pos.z;
    this.riverTex.offset.y = (t * 0.02) % 1;
    if (this.worldMode === "inf") {
      // nubes e islas del fondo: las que quedan atrás pasan a estar adelante
      const z = this.pos.z;
      for (const c of this.clouds) if (c.position.z > z + 70) c.position.z -= 26 * 22;
      for (const isl of this.islands) if (isl.position.z > z + 70) isl.position.z -= 18 * 18;
    }
  }

  _syncHero(dt) {
    const g = this.hero.group;
    g.position.copy(this.pos);
    g.rotation.y = lerp(g.rotation.y, this.heroYaw, 1 - Math.exp(-16 * Math.max(dt, 0.016)));
    if (this.heroModeT > 0) { this.heroModeT -= dt; if (this.heroModeT <= 0) this.heroMode = null; }
    const sp = Math.hypot(this.vel.x, this.vel.z);
    let mode = "idle";
    if (this.state === "playing" || this.state === "gameover") {
      if (!this.grounded) mode = this.vel.y > 1 || this.state === "playing" ? "jump" : "idle";
      else if (sp > 0.8) mode = "run";
    }
    if (this.heroMode) mode = this.heroMode;
    if (this.state === "gameover" && this.finished) mode = "cheer";
    this.hero.animate(this.time, mode, clamp(sp / RUN, 0.4, 1.3));
    // capa
    if (this.cape && this.cape.visible) {
      const pos = this.cape.geometry.attributes.position;
      const lift = clamp(sp / RUN, 0, 1) * 0.7 + (this.grounded ? 0 : 0.5);
      this.cape.rotation.x = 0.1 + lift * 0.9;
      for (let i = 0; i < pos.count; i++) {
        const y = this.capeBase[i * 3 + 1];
        pos.setZ(i, Math.sin(this.time * 12 + y * 5) * 0.06 * (-y) * (0.4 + lift));
      }
      pos.needsUpdate = true;
    }
    if (this.crown && this.crown.visible) this.crown.rotation.y = this.time * 1.5;
    // aro del poder activo
    const pw = this.power && this.state === "playing" ? POWERS[this.power.kind] : null;
    this.aura.visible = !!pw;
    if (pw) {
      this.aura.material.color.setHex(pw.color);
      this.aura.position.set(this.pos.x, this.pos.y + 0.85, this.pos.z);
      this.aura.scale.setScalar(1.05 + Math.sin(this.time * 6) * 0.06);
    }
    // estela
    if (this.state === "playing") {
      this.trailT -= dt;
      if (this.trailT <= 0 && sp > 2) {
        this.trailT = this.stageReached >= 4 ? 0.04 : 0.08;
        this.particles.burst(new THREE.Vector3(this.pos.x, this.pos.y + 0.12, this.pos.z), this._trail(), this.stageReached >= 4 ? 2 : 1, 0.8, 0.5, 1, 0.8);
      }
    }
  }

  // ---------- cámara / cielo ----------

  _camTarget() {
    return new THREE.Vector3(this.pos.x, this.pos.y + 1.15, this.pos.z);
  }

  _snapCamera() {
    this.camFocus = this._camTarget();
    this._placeCamera();
  }

  _updateCamera(dt) {
    const t = this._camTarget();
    if (!this.camFocus) this.camFocus = t.clone();
    const k = 1 - Math.exp(-9 * Math.max(dt, 0.001));
    this.camFocus.x = lerp(this.camFocus.x, t.x, k);
    this.camFocus.z = lerp(this.camFocus.z, t.z, k);
    this.camFocus.y = lerp(this.camFocus.y, t.y, 1 - Math.exp(-4.5 * Math.max(dt, 0.001)));
    this._placeCamera();
  }

  _placeCamera() {
    const f = this.camFocus;
    const portrait = this.camera.aspect < 0.95;
    const dist = portrait ? 11.5 : 8.6;
    const cp = Math.cos(this.camPitch);
    this.camera.position.set(f.x + Math.sin(this.camYaw) * cp * dist, f.y + Math.sin(this.camPitch) * dist, f.z + Math.cos(this.camYaw) * cp * dist);
    this.camera.lookAt(f.x, f.y + 0.2, f.z);
    this.sun.position.set(this.pos.x + 9, this.pos.y + 20, this.pos.z + 8);
    this.sun.target.position.copy(this.pos);
  }

  _updateSky() {
    const z = this.pos.z;
    const inf = this.worldMode === "inf";
    let f = 0;
    let a;
    let b;
    let u;
    if (inf) {
      f = Math.max(0, -z / ZONE_LEN);
      const i0 = Math.floor(f);
      u = smooth(clamp((f - i0 - 0.55) / 0.45, 0, 1)); // cada mundo conserva su ambiente y cambia al final
      a = this.biomeAt(i0);
      b = this.biomeAt(i0 + 1);
    } else {
      const st = this.stageStarts;
      for (let i = 0; i < st.length; i++) {
        const next = i + 1 < st.length ? st[i + 1] : this.courseEndZ;
        if (z <= st[i]) f = i + clamp((st[i] - z) / Math.max(1, st[i] - next), 0, 1);
      }
      f = clamp(f, 0, STAGES.length - 1);
      const i0 = Math.floor(f);
      const i1 = Math.min(i0 + 1, STAGES.length - 1);
      u = smooth(clamp((f - i0 - 0.55) / 0.45, 0, 1)); // cada etapa conserva su ambiente y cambia al final
      a = STAGES[i0];
      b = STAGES[i1];
    }
    this.tmpColor.setHex(a.sky).lerp(this.tmpColor2.setHex(b.sky), u);
    this.scene.background.copy(this.tmpColor);
    this.scene.fog.color.copy(this.tmpColor);
    this.hemi.intensity = lerp(a.hemi, b.hemi, u);
    this.sun.intensity = lerp(a.sun, b.sun, u);
    this.stars.material.opacity = lerp(a.night, b.night, u);
    this.stars.position.set(this.pos.x, 0, this.pos.z);
    this.sunDisc.position.set(this.pos.x - 60, 70, this.pos.z - 250);
    this.sunDisc.visible = lerp(a.night, b.night, u) < 0.6;
    const dark = lerp(a.night, b.night, u);
    this.river.material.color.setRGB(1 - dark * 0.65, 1 - dark * 0.65, 1 - dark * 0.45);
    if (this.finishGroup) this.finishGroup.visible = f > 4.2;
  }

  // ---------- entrada ----------

  async init() {
    const first = !this.ready;
    await super.init();
    if (first) this._bindInput();
  }

  _bindInput() {
    const map = { ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right", ArrowUp: "up", w: "up", W: "up", ArrowDown: "down", s: "down", S: "down" };
    window.addEventListener("keydown", (e) => {
      if (!this.running) return;
      if (e.code === "Space" || e.key === " ") {
        if (this.state === "playing") { e.preventDefault(); if (!e.repeat) this.buffer = BUFFER; }
        return;
      }
      if (e.key === "q" || e.key === "Q") this.camYaw += 0.25;
      else if (e.key === "e" || e.key === "E") this.camYaw -= 0.25;
      const k = map[e.key];
      if (k) { if (this.state === "playing") e.preventDefault(); this.keys[k] = true; }
    });
    window.addEventListener("keyup", (e) => { const k = map[e.key]; if (k) this.keys[k] = false; });
    window.addEventListener("blur", () => { this.keys = {}; });

    // cámara: arrastrar sobre el escenario
    const cv = this.els.canvas;
    let drag = null;
    cv.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY }; cv.setPointerCapture?.(e.pointerId); });
    cv.addEventListener("pointermove", (e) => {
      if (!drag) return;
      this.camYaw -= (e.clientX - drag.x) * 0.008;
      this.camPitch = clamp(this.camPitch + (e.clientY - drag.y) * 0.004, 0.12, 1.0);
      drag = { x: e.clientX, y: e.clientY };
    });
    const end = () => { drag = null; };
    cv.addEventListener("pointerup", end);
    cv.addEventListener("pointercancel", end);

    // joystick y botón de salto táctiles
    const joy = document.getElementById("parkour-joy");
    const knob = document.getElementById("parkour-knob");
    if (joy) {
      let id = null;
      const upd = (e) => {
        const r = joy.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        let dx = (e.clientX - cx) / (r.width / 2);
        let dy = (e.clientY - cy) / (r.height / 2);
        const m = Math.hypot(dx, dy);
        if (m > 1) { dx /= m; dy /= m; }
        this.joy.x = Math.abs(dx) < 0.15 ? 0 : dx;
        this.joy.y = Math.abs(dy) < 0.15 ? 0 : -dy;
        knob.style.transform = `translate(${dx * 34}px, ${dy * 34}px)`;
      };
      joy.addEventListener("pointerdown", (e) => { e.preventDefault(); id = e.pointerId; joy.setPointerCapture(id); upd(e); });
      joy.addEventListener("pointermove", (e) => { if (e.pointerId === id) upd(e); });
      const release = (e) => { if (e.pointerId !== id) return; id = null; this.joy.x = 0; this.joy.y = 0; knob.style.transform = ""; };
      joy.addEventListener("pointerup", release);
      joy.addEventListener("pointercancel", release);
    }
    document.getElementById("parkour-btn-campaign")?.addEventListener("click", () => this.startMode("campaign"));
    document.getElementById("parkour-btn-infinite")?.addEventListener("click", () => { campaign(this.progress, "parkour").mode = "inf"; this.startMode("inf"); });
    document.getElementById("parkour-btn-missions")?.addEventListener("click", () => {
      const c = campaign(this.progress, "parkour");
      c.mode = "missions";
      c.selected = Math.min(c.selected || c.unlocked, c.unlocked);
      saveProgress(this.progress);
      this.startMode("inf");
    });
    const jb = document.getElementById("parkour-btn-jump");
    if (jb) jb.addEventListener("pointerdown", (e) => { e.preventDefault(); if (this.state === "playing") this.buffer = BUFFER; });
  }

  pauseForMenu() {
    this.keys = {};
    this.joy = { x: 0, y: 0 };
    super.pauseForMenu();
  }
}

installInfinite(ParkourGame, STAGES);
