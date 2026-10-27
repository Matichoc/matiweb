// Base 3D compartida de los juegos de Matijuego: renderizador, bucle,
// calidad adaptativa, partículas, popups y utilidades de texturas.
// Los juegos 3D (Salto Choco, Autos de Chocolate, Memoria Matichoc) extienden
// Game3D y solo implementan build / reset / update.

import * as THREE from "../vendor/three.module.min.js";
import { getOutfit } from "./characters.js?v=71c9378f5b";
import { IS_DEMO, demoAllows } from "./demo.js?v=71c9378f5b";
import { addToLeaderboard, earnCoins, equippedOutfitId, getLook, reportScore, saveProgress } from "./storage.js?v=71c9378f5b";
import * as audio from "./audio.js?v=71c9378f5b";
import { recordRun, runBonus } from "./progression.js?v=71c9378f5b";
import { campaignWin, campaignMode, campaignLevel, campaign, campaignComplete, campaignStartOver, lapReward, LEVELS_PER_GAME } from "./campaign.js?v=71c9378f5b";
import { missionFor } from "./missions.js?v=71c9378f5b";
import { costOf, spendEnergy, energyOf } from "./energy.js?v=71c9378f5b";
import { vibrate } from "./native.js?v=71c9378f5b";

export { THREE };


// ---------- contextos WebGL ----------
// Cada pantalla 3D (menú, tienda, casa, pueblo y cada juego) tiene su propio contexto WebGL, y los celulares
// (sobre todo el WebView de la app) solo aguantan unos pocos a la vez: al pasar el límite, las pantallas
// quedan en blanco o "no se pudo mostrar el 3D". Aquí se mantienen vivos pocos contextos; el que hace
// más tiempo que no se usa se suelta (forceContextLoss) y se recupera solo al volver a esa pantalla.

const GL_MAX_LIVE = 3;
const glRenderers = new Set();
const glLost = (r) => { try { return r.getContext().isContextLost(); } catch (e) { return true; } };

function glEvict(keep) {
  const live = [...glRenderers].filter((r) => r === keep || !glLost(r));
  if (live.length <= GL_MAX_LIVE) return;
  live.sort((a, b) => (b.__glUse || 0) - (a.__glUse || 0));
  for (const r of live) {
    if (r === keep || live.indexOf(r) < GL_MAX_LIVE) continue;
    try { r.forceContextLoss(); } catch (e) { /* ya estaba suelto */ }
  }
}

/** Crea un renderer y lo anota; si el equipo ya no da más contextos, suelta los otros y reintenta. */
export function createRenderer(opts) {
  let r;
  try {
    r = new THREE.WebGLRenderer(opts);
  } catch (e) {
    for (const o of glRenderers) { try { o.forceContextLoss(); } catch (e2) { /* nada */ } }
    r = new THREE.WebGLRenderer(opts);
  }
  r.__glUse = performance.now();
  r.__glExt = r.getContext().getExtension("WEBGL_lose_context"); // en un contexto suelto ya no se puede pedir
  glRenderers.add(r);
  glEvict(r);
  return r;
}

/** Llamar al mostrar una pantalla 3D: recupera su contexto si se había soltado y suelta los más viejos. */
export function glAcquire(renderer) {
  if (!renderer) return;
  renderer.__glUse = performance.now();
  glRenderers.add(renderer);
  if (glLost(renderer)) {
    try { (renderer.__glExt || renderer.getContext().getExtension("WEBGL_lose_context"))?.restoreContext(); } catch (e) { /* se reintenta en el próximo cuadro */ }
  }
  glEvict(renderer);
}
export const glLiveCount = () => [...glRenderers].filter((r) => !glLost(r)).length;
if (typeof location !== "undefined" && location.search.includes("debug3d")) window.__glLive = glLiveCount; // solo para pruebas

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);

// "Look" compartido (brillo suave estilo juego moderno); cada juego puede ajustarlo.
export const LOOK = {
  bloom: { strength: 0.32, radius: 0.55, threshold: 0.92 },
  grade: { sat: 1.16, contrast: 1.06, vig: 0.22, lift: 0, tint: [1, 1, 1] },
  // ambiente "kawaii": colores pastel, negros levantados con un velo rosado y brillo suave tipo ensueño
  kawaii: { bloom: { strength: 0.2, radius: 0.5, threshold: 0.96 }, grade: { sat: 1.14, contrast: 1.0, vig: 0.16, lift: 0.025, tint: [1.0, 0.88, 0.94] } },
};

// Ajuste final de color (saturación, contraste y viñeta) sobre la imagen ya en sRGB.
const GRADE_SHADER = {
  uniforms: { tDiffuse: { value: null }, sat: { value: 1.16 }, contrast: { value: 1.06 }, vig: { value: 0.22 }, lift: { value: 0 }, tint: { value: new THREE.Vector3(1, 1, 1) } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: `uniform sampler2D tDiffuse; uniform float sat; uniform float contrast; uniform float vig; uniform float lift; uniform vec3 tint; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb = mix(vec3(l), c.rgb, sat);
      c.rgb = (c.rgb - 0.5) * contrast + 0.5;
      c.rgb *= 1.0 - vig * smoothstep(0.45, 0.98, distance(vUv, vec2(0.5)));
      c.rgb = mix(c.rgb, tint, lift * (1.0 - l * 0.6));
      gl_FragColor = c;
    }`,
};

export function loadTexture(url, { repeat = 0, anisotropy = 4 } = {}) {
  const tex = new THREE.TextureLoader().load(url);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  if (repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat, repeat);
  }
  return tex;
}

let logoTex = null;
/** Textura del logo de Matichoc (medallón redondo). Se comparte entre todos los juegos. */
export function logoTexture() {
  if (!logoTex) logoTex = loadTexture("assets/brand/logo-badge.png", { anisotropy: 8 });
  return logoTex;
}

/**
 * Logo de Matichoc como una lámina (para carteles, paredes, pisos y banderas). `size` es el diámetro.
 * Con `lit` se ve igual de claro en la oscuridad (no recibe luces); si no, se mezcla con la escena.
 */
export function makeLogo(size = 2, { lit = true } = {}) {
  const mat = lit
    ? new THREE.MeshBasicMaterial({ map: logoTexture(), transparent: true, side: THREE.DoubleSide })
    : new THREE.MeshStandardMaterial({ map: logoTexture(), transparent: true, side: THREE.DoubleSide, roughness: 0.6 });
  return new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
}

let coinTex = null;
/** Moneda dorada con el logo de Matichoc (se dibuja a mano; el logo se agrega cuando carga). */
export function goldCoinTexture() {
  if (coinTex) return coinTex;
  const cv = document.createElement("canvas");
  cv.width = cv.height = 128;
  coinTex = new THREE.CanvasTexture(cv);
  coinTex.colorSpace = THREE.SRGBColorSpace;
  const draw = (img) => {
    const g = cv.getContext("2d");
    g.clearRect(0, 0, 128, 128);
    const gr = g.createRadialGradient(50, 46, 8, 64, 64, 64);
    gr.addColorStop(0, "#fff0a0"); gr.addColorStop(0.6, "#ffc800"); gr.addColorStop(1, "#c98a00");
    g.fillStyle = gr; g.beginPath(); g.arc(64, 64, 62, 0, 6.3); g.fill();
    g.strokeStyle = "#fff6c8"; g.lineWidth = 5; g.beginPath(); g.arc(64, 64, 55, 0, 6.3); g.stroke();
    g.strokeStyle = "#b07a00"; g.lineWidth = 2; g.beginPath(); g.arc(64, 64, 49, 0, 6.3); g.stroke();
    if (img) { g.save(); g.beginPath(); g.arc(64, 64, 45, 0, 6.3); g.clip(); g.drawImage(img, 19, 19, 90, 90); g.restore(); }
    coinTex.needsUpdate = true;
  };
  draw(null);
  const img = new Image();
  img.onload = () => draw(img);
  img.src = "assets/brand/logo-badge.png";
  return coinTex;
}

export function canvasTexture(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** Caja con esquinas y bordes redondeados (centrada en el origen). */
export function roundedBox(w, h, d, r = 0.08, bevel = 0.03) {
  const geo = new THREE.ExtrudeGeometry(roundedRectShape(w - bevel * 2, h - bevel * 2, Math.max(0.001, r - bevel)), {
    depth: Math.max(0.001, d - bevel * 2),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 6,
  });
  geo.center();
  return geo;
}

export function makeStars(count = 400, radius = 120) {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const u = Math.random() * 0.9 + 0.05;
    const r = radius * (0.7 + Math.random() * 0.3);
    pos[i * 3] = Math.cos(a) * r * Math.sqrt(1 - u * u);
    pos[i * 3 + 1] = u * r;
    pos[i * 3 + 2] = Math.sin(a) * r * Math.sqrt(1 - u * u) - radius * 0.3;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.9, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
  return new THREE.Points(geo, mat);
}

/** Banderines de colores de marca sobre una línea (como en la web y la feria 3D). */
export function makeBunting(from, to, { count = 14, sag = 0.7, size = 0.28, colors = [0xd4216c, 0xffc800, 0xcfd767, 0xfff6e6, 0xf08a3c] } = {}) {
  const group = new THREE.Group();
  const geo = new THREE.ConeGeometry(size, size * 2, 3);
  geo.rotateX(Math.PI);
  const flags = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, side: THREE.DoubleSide }), count);
  const o = new THREE.Object3D();
  const c = new THREE.Color();
  const pts = [];
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const p = new THREE.Vector3().lerpVectors(from, to, t);
    p.y -= Math.sin(t * Math.PI) * sag;
    pts.push(p);
    if (i < count) {
      o.position.set(p.x, p.y - size, p.z);
      o.rotation.set(0, 0, 0);
      o.scale.set(1, 1, 0.25);
      o.updateMatrix();
      flags.setMatrixAt(i, o.matrix);
      c.setHex(colors[i % colors.length]);
      flags.setColorAt(i, c);
    }
  }
  group.add(flags);
  group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x4b2e2e })));
  return group;
}

/** Pool de partículas (confeti, chispas) reutilizable. */
export class Particles {
  constructor(scene, count = 220) {
    this.geo = new THREE.SphereGeometry(0.07, 6, 5);
    this.mats = new Map();
    this.pool = [];
    this.active = [];
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(this.geo, this._mat(0xffffff));
      m.visible = false;
      scene.add(m);
      this.pool.push(m);
    }
  }

  _mat(hex) {
    if (!this.mats.has(hex)) this.mats.set(hex, new THREE.MeshBasicMaterial({ color: hex }));
    return this.mats.get(hex);
  }

  burst(p, colors, count = 20, speed = 4, life = 0.8, gravity = 8, size = 1) {
    for (let i = 0; i < count; i++) {
      const m = this.pool.find((q) => !q.visible);
      if (!m) return;
      m.material = this._mat(colors[Math.floor(Math.random() * colors.length)]);
      m.position.copy(p);
      m.visible = true;
      m.scale.setScalar((0.6 + Math.random() * 0.9) * size);
      const a = Math.random() * Math.PI * 2;
      const e = Math.random() * 1.4 - 0.2;
      m.userData = {
        vx: Math.cos(a) * speed * (0.3 + Math.random()),
        vy: Math.sin(e) * speed + speed * 0.3,
        vz: Math.sin(a) * speed * (0.3 + Math.random()),
        life,
        max: life,
        gravity,
        size,
      };
      this.active.push(m);
    }
  }

  update(dt) {
    for (const m of this.active) {
      const u = m.userData;
      u.life -= dt;
      u.vy -= u.gravity * dt;
      m.position.x += u.vx * dt;
      m.position.y += u.vy * dt;
      m.position.z += u.vz * dt;
      if (u.life <= 0) m.visible = false;
      else m.scale.setScalar(Math.max(0.05, (u.life / u.max) * 1.2 * u.size));
    }
    this.active = this.active.filter((m) => m.visible);
  }

  clear() {
    for (const m of this.active) m.visible = false;
    this.active = [];
  }
}

/** Textos flotantes (DOM) anclados a posiciones 3D. */
export class Popups {
  constructor(container, wrap, camera) {
    this.container = container;
    this.wrap = wrap;
    this.camera = camera;
    this.items = [];
  }

  add(worldPos, text, kind = "kill") {
    const el = document.createElement("span");
    el.className = `fps-popup ${kind}`;
    el.textContent = text;
    this.container.appendChild(el);
    this.items.push({ el, pos: worldPos.clone(), life: 1 });
  }

  update(dt) {
    const w = this.wrap.clientWidth;
    const h = this.wrap.clientHeight;
    for (const p of this.items) {
      p.life -= dt;
      p.pos.y += dt * 0.9;
      const v = p.pos.clone().project(this.camera);
      const visible = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
      p.el.style.display = visible ? "block" : "none";
      p.el.style.transform = `translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h}px) translate(-50%, -50%)`;
      p.el.style.opacity = String(clamp(p.life / 0.5, 0, 1));
    }
    this.items = this.items.filter((p) => {
      if (p.life > 0) return true;
      p.el.remove();
      return false;
    });
  }

  clear() {
    for (const p of this.items) p.el.remove();
    this.items = [];
  }
}

/**
 * Base de los juegos 3D. Ciclo de vida igual al de los demás juegos
 * (startRun / beginPlaying / retry / pauseForMenu) para que main.js los trate igual.
 * Subclases: build() crea la escena, reset() prepara una partida, update(dt) la avanza.
 */
export class Game3D {
  constructor(gameId, character, progress, els, { fov = 50, bloom = true } = {}) {
    this.gameId = gameId;
    this.bloom = bloom === true ? LOOK.bloom : bloom;
    this.kawaii = false; // los mundos con estilo kawaii lo encienden en su constructor (ver kawaiiStyle)
    this.ambients = [];
    this.character = character;
    this.progress = progress;
    this.els = els;
    this.fov = fov;
    this.ready = false;
    this.running = false;
    this.state = "intro"; // intro | playing | gameover | paused
    this.time = 0;
    this.lastTs = null;
    this.frameTimes = [];
    this.qualityStep = 0;
    this.qualityDone = false;
    this.coarse = window.matchMedia("(pointer: coarse)").matches;
  }

  get outfit() {
    return getOutfit(equippedOutfitId(this.progress, this.character.id));
  }

  /** Todo lo que lleva puesto el Matichico (peinado, sombrero, ropa...; ver js/wardrobe-data.js). */
  get look() {
    return getLook(this.progress, this.character.id);
  }

  async init() {
    if (this.ready) return;
    const { canvas, wrap } = this.els;
    this.renderer = createRenderer({ canvas, antialias: !this.coarse, powerPreference: "high-performance" });
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, this.coarse ? 1.25 : 1.75);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(this.fov, 1.6, 0.1, 600);
    this.scene.add(this.camera);
    this.particles = new Particles(this.scene);
    this.popups = new Popups(this.els.popups, wrap, this.camera);

    await this.build();
    await this._setupPost();

    this._onResize = () => {
      const w = Math.max(1, wrap.clientWidth);
      const h = Math.max(1, wrap.clientHeight);
      this.renderer.setSize(w, h, false);
      if (this.composer) {
        this.composer.setPixelRatio(this.renderer.getPixelRatio());
        this.composer.setSize(w, h);
      }
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.onResize?.(w, h);
    };
    new ResizeObserver(this._onResize).observe(wrap);
    this._onResize();
    this._loop = this._loop.bind(this);
    // App en segundo plano (llamada, cambio de app): se guarda lo jugado y, al volver, hay una pausa corta
    // para que el niño no pierda la partida de golpe.
    this._onVis = () => {
      if (document.visibilityState === "hidden") {
        if (this.running && this.state === "playing") {
          audio.stopMusic();
          if (this.progress) saveProgress(this.progress);
          this._wasHidden = true;
        }
      } else if (this._wasHidden) {
        this._wasHidden = false;
        if (this.running && this.state === "playing") {
          this._freeze = 1.6;
          this.lastTs = null;
          this.banner("⏸ ¡Seguimos en un momento!");
          if (this.musicTheme) audio.startMusic(this.musicTheme);
        }
      }
    };
    document.addEventListener("visibilitychange", this._onVis);
    this.ready = true;
  }

  /** Brillo suave (bloom) con degradación automática si el equipo va lento. */
  async _setupPost() {
    if (!this.bloom) return;
    try {
      const base = "../vendor/three-examples/";
      const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }, { ShaderPass }] = await Promise.all([
        import(`${base}postprocessing/EffectComposer.js`),
        import(`${base}postprocessing/RenderPass.js`),
        import(`${base}postprocessing/UnrealBloomPass.js`),
        import(`${base}postprocessing/OutputPass.js`),
        import(`${base}postprocessing/ShaderPass.js`),
      ]);
      const w = Math.max(1, this.els.wrap.clientWidth);
      const h = Math.max(1, this.els.wrap.clientHeight);
      const target = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: this.coarse ? 0 : 4 });
      this.composer = new EffectComposer(this.renderer, target);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      const bl = this.kawaii ? LOOK.kawaii.bloom : this.bloom;
      this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), bl.strength, bl.radius, bl.threshold);
      this.composer.addPass(this.bloomPass);
      this.composer.addPass(new OutputPass());
      const grade = new ShaderPass(GRADE_SHADER);
      const gr = this.kawaii ? LOOK.kawaii.grade : LOOK.grade;
      grade.uniforms.sat.value = gr.sat;
      grade.uniforms.contrast.value = gr.contrast;
      grade.uniforms.vig.value = gr.vig;
      grade.uniforms.lift.value = gr.lift || 0;
      grade.uniforms.tint.value.set(...(gr.tint || [1, 1, 1]));
      this.composer.addPass(grade);
    } catch (e) {
      console.warn("Postprocesado no disponible:", e);
      this.composer = null;
    }
  }

  async startRun(character, progress) {
    this.character = character;
    if (progress) this.progress = progress;
    await this.init();
    glAcquire(this.renderer);
    this.particles.clear();
    this.popups.clear();
    this.state = "intro";
    this.reset();
    if (this.kawaii) this._kawaiiScene();
    this.showOverlay("intro");
    this.onIntro?.();
    this.warmUp();
    this._held = false;
    this.running = true;
    this.lastTs = null;
    requestAnimationFrame(this._loop);
  }

  /** Prepara de una vez, con la tarjeta de inicio en pantalla, todos los sombreadores y texturas de la escena, también lo
   * que todavía no se ve (barrios lejanos, el castillo de la meta, premios escondidos). Si no, el celular los prepara la
   * primera vez que aparecen y el juego se congela un momento justo ahí (medido: +2 programas y +2 texturas al llegar a la
   * bandera de Aventura; lo mismo al cruzar a la playa de la Ciudad). Se dibuja un cuadro con todo y luego el normal. */
  warmUp() {
    if (!this.renderer || !this.scene || !this.camera) return;
    const shown = [];
    const culled = [];
    this.scene.traverse((o) => {
      if (!o.visible) { o.visible = true; shown.push(o); }
      if (o.frustumCulled) { o.frustumCulled = false; culled.push(o); }
    });
    try {
      this.renderer.compile(this.scene, this.camera);
      if (this.composer) this.composer.render(0);
      else this.renderer.render(this.scene, this.camera);
    } catch (e) { /* si algo falla, se prepara solo la primera vez que aparezca, como antes */ }
    for (const o of shown) o.visible = false;
    for (const o of culled) o.frustumCulled = true;
    try {
      if (this.composer) this.composer.render(0);
      else this.renderer.render(this.scene, this.camera);
    } catch (e) { /* el próximo cuadro dibuja igual */ }
  }

  /** Estilo kawaii del escenario: sombreado por tonos (no a los personajes) y pétalos/estrellitas flotando. */
  _kawaiiScene() {
    toonify(this.scene);
    if (!this.ambient) this.ambient = makeAmbient(this.scene, this.ambientOpts || {});
  }

  beginPlaying() {
    if (this.state === "playing") return;
    if (!this._payEnergy()) return;
    this._em = {}; // contadores del gasto por acción (ver meterEnergy / countEnergy)
    this._ec = {};
    this._eT = 0;
    this._lowWarned = false;
    this.state = "playing";
    this.showOverlay(null);
    if (this.musicTheme) audio.startMusic(this.musicTheme);
    this.onBegin?.();
    if (this.mission) this.banner(`🎯 Misión ${this.mission.n}: ${this.mission.text}`);
  }

  /** Cada partida gasta energía (ver js/energy.js). Sin energía no empieza: se avisa y se queda en la tarjeta de inicio. */
  _payEnergy() {
    const cost = costOf(this.gameId);
    if (!(cost > 0) || !this.progress) return true;
    if (spendEnergy(this.progress, cost)) return true;
    try { window.dispatchEvent(new CustomEvent("no-energy", { detail: { need: cost, game: this.gameId } })); } catch (e) { /* sin ventana */ }
    return false;
  }

  /**
   * Gasto de energía DURANTE la partida (además de la entrada): cada tiro, cada pieza, cada movimiento, cada tanto
   * de camino... Devuelve false si no alcanzó (la partida termina con un aviso amable y se conserva el puntaje).
   */
  spendAction(n = 1) {
    if (!(n > 0) || !this.progress || this.state !== "playing") return true;
    if (spendEnergy(this.progress, n)) {
      this._showSpend(n);
      return true;
    }
    this._outOfEnergy();
    return false;
  }

  /** Gasta `cost` cada vez que `value` cruza un múltiplo de `every` (distancia, altura, piezas, rebotes...). */
  meterEnergy(key, value, every, cost = 1) {
    if (this.state !== "playing") return true;
    if (!this._em) this._em = {};
    const k = Math.floor(value / every);
    while ((this._em[key] || 0) < k && this.state === "playing") {
      this._em[key] = (this._em[key] || 0) + 1;
      if (!this.spendAction(cost)) return false;
    }
    return true;
  }

  /** Cuenta una acción (un tiro, una pieza...) y gasta `cost` cada `every` veces. */
  countEnergy(key, every = 1, cost = 1) {
    if (this.state !== "playing") return true;
    if (!this._ec) this._ec = {};
    this._ec[key] = (this._ec[key] || 0) + 1;
    return this._ec[key] % every === 0 ? this.spendAction(cost) : true;
  }

  _outOfEnergy() {
    try { window.dispatchEvent(new CustomEvent("no-energy", { detail: { need: 1, game: this.gameId, mid: true } })); } catch (e) { /* sin ventana */ }
    this.haptic(60);
    if (this.onNoEnergy) this.onNoEnergy();
    else this.finish("😴 ¡Matichico se quedó sin energía! Descansa un ratito (o duerme en tu casa) y sigue jugando.");
  }

  /** Cartelito "-1 ⚡ 73" arriba al centro cada vez que se gasta, y aviso cuando queda poca. */
  _showSpend(n) {
    const left = Math.floor(energyOf(this.progress).v);
    let el = document.getElementById("game-energy");
    if (!el) {
      el = document.createElement("div");
      el.id = "game-energy";
      el.className = "game-energy hidden";
      document.body.appendChild(el);
    }
    el.innerHTML = `<b>-${n}</b> ⚡ <span>${left}</span>`;
    el.classList.toggle("low", left <= 10);
    el.classList.remove("hidden", "pop");
    void el.offsetWidth;
    el.classList.add("pop");
    clearTimeout(this._enHide);
    this._enHide = setTimeout(() => el.classList.add("hidden"), 2600);
    if (left <= 10 && !this._lowWarned) {
      this._lowWarned = true;
      this.banner(`🔋 ¡Poca energía! Te quedan ${left} ⚡`);
    }
  }

  // ---------- modo misiones (juegos sin fin) ----------
  // Cada juego trae `missionId` (clave en js/missions.js) y `getMetric(nombre)`; aquí se revisa la meta.

  /** Llamar desde reset(): deja lista la misión elegida (o ninguna, en modo infinito). */
  setupMission() {
    const id = this.missionId || this.gameId;
    this.mission = campaignMode(this.progress, id, "missions") === "missions" ? missionFor(id, campaignLevel(this.progress, id)) : null;
    this._missionWon = false;
    this._mt = 0;
    const chip = this.els.q && this.els.q("hud-goal");
    if (chip) {
      chip.classList.toggle("hidden", !this.mission);
      this._goalText = chip.querySelector("span");
      if (this.mission && this._goalText) this._goalText.textContent = `${this.mission.text} · 0/${this.mission.target}`;
    }
  }

  _missionTick(dt) {
    if (!this.mission || this.state !== "playing" || !this.getMetric) return;
    this._mt -= dt;
    if (this._mt > 0) return;
    this._mt = 0.2;
    const v = Math.floor(this.getMetric(this.mission.metric) || 0);
    if (this._goalText) this._goalText.textContent = `${this.mission.text} · ${Math.min(v, this.mission.target)}/${this.mission.target}`;
    if (v >= this.mission.target) {
      this._missionWon = true;
      const n = this.mission.n;
      if (n >= LEVELS_PER_GAME) {
        campaignWin(this.progress, this.missionId || this.gameId, n, 3);
        const t = this.els.q("gameover-title");
        if (t) t.textContent = `¡Completaste las ${LEVELS_PER_GAME} misiones! 🏆`;
        audio.playVictory();
        this.finish(`Cumpliste la misión final: ${this.mission.text.toLowerCase()}.`);
      } else this.levelWin({ level: n, stars: 3, text: `¡Misión cumplida: ${this.mission.text.toLowerCase()}!`, title: `¡Misión ${n} cumplida!` });
    }
  }

  /** Pasa a la siguiente misión (botón "Siguiente" de la tarjeta de misión cumplida). */
  nextMission() {
    const id = this.missionId || this.gameId;
    campaign(this.progress, id).selected = Math.min(LEVELS_PER_GAME, (this.mission ? this.mission.n : 1) + 1);
    this.particles.clear();
    this.popups.clear();
    this.state = "intro";
    this.reset();
    this.beginPlaying();
  }

  /** Cartel grande en el centro del escenario ("¡Zona 2!", "¡Combo x5!"...). */
  banner(text) {
    const el = this.els.banner;
    if (!el) return;
    el.textContent = text;
    el.classList.remove("show");
    void el.offsetWidth;
    el.classList.add("show");
  }

  /** Vibración corta en el celular (golpes, premios). */
  haptic(ms = 30) {
    vibrate(ms); // en la app: vibración nativa (también en iPhone); en la web: navigator.vibrate si existe
  }

  /** Pausa del cuadro ⏸: el juego queda quieto (no avanza el tiempo ni la física) hasta que se suelte. */
  setPaused(on) {
    this._held = !!on;
  }

  retry() {
    this.particles.clear();
    this.popups.clear();
    this.state = "intro";
    this.reset();
    this.beginPlaying();
  }

  pauseForMenu() {
    audio.stopMusic();
    if (this.running) reportScore(this.progress, this.gameId, this.score || 0);
    this._held = false;
    this.running = false;
    this.state = "paused";
  }

  showOverlay(name) {
    Object.entries(this.els.overlays).forEach(([key, el]) => el.classList.toggle("hidden", key !== name));
    if (!name) Object.values(this.els.overlays).forEach((el) => el.classList.add("hidden"));
  }

  /**
   * Nivel de la campaña ganado (no es el final de la partida): desbloquea el siguiente, guarda
   * estrellas, da puntos/XP y muestra la tarjeta "¡Nivel completado!" (overlay "win").
   */
  levelWin({ level, stars, text, title }) {
    if (this.state === "gameover") return;
    audio.stopMusic();
    audio.playMissionComplete();
    this.state = "win";
    campaignWin(this.progress, this.missionId || this.gameId, level, stars);
    reportScore(this.progress, this.gameId, this.score || 0);
    const bonus = runBonus(this.gameId, this.score || 0) + stars;
    earnCoins(this.progress, bonus);
    const run = recordRun(this.progress, this.gameId, this.score || 0, this.runInfo || {});
    this.runInfo = null;
    saveProgress(this.progress);
    const e = this.els;
    if (e.stars) e.stars.innerHTML = [1, 2, 3].map((n) => `<span class="${n <= stars ? "on" : "off"}">★</span>`).join("");
    if (e.winTitle) e.winTitle.textContent = title || `¡Nivel ${level} completado!`;
    if (e.winText) e.winText.textContent = `${text} +${bonus} Matipuntos 🍫✨ +${run.xp} XP${run.stars ? ` +${run.stars} ⭐` : ""}`;
    // al terminar el último nivel el botón pasa a ser "Nueva vuelta" (con premio) en vez de repetir el nivel 20
    const campId = this.missionId || this.gameId;
    const nb = e.q && e.q("btn-next");
    this._lapNext = level >= LEVELS_PER_GAME && campaignComplete(this.progress, campId);
    if (nb) {
      if (!nb.dataset.orig) nb.dataset.orig = nb.textContent;
      if (this._lapNext) {
        const r = lapReward(this.progress, campId);
        nb.textContent = `🔄 Nueva vuelta (🍫✨ ${r.coins} y ${r.packs} 🎴)`;
        if (e.winTitle) e.winTitle.textContent = "🏆 ¡Completaste todos los niveles!";
      } else if (IS_DEMO && !demoAllows(campId, level + 1)) nb.textContent = "📲 Sigue en la app";
      else nb.textContent = nb.dataset.orig;
    }
    this.haptic(60);
    this.showOverlay("win");
  }

  /** Después del último nivel: empieza una vuelta nueva (premio + niveles desde el 1). */
  startNewLap() {
    const got = campaignStartOver(this.progress, this.missionId || this.gameId);
    this._lapNext = false;
    if (got) { try { window.dispatchEvent(new CustomEvent("lap-start", { detail: got })); } catch (e) { /* sin ventana */ } }
    this.retry(); // arranca otra vez, ahora desde el nivel 1
  }

  /** Cierra la partida: guarda puntaje/ranking y muestra el resumen. */
  finish(text) {
    if (this.state === "gameover") return; // ya terminó (p. ej. se acabó la energía justo antes)
    audio.stopMusic();
    this.state = "gameover";
    if (this.mission && !this._missionWon) text = `🎯 Misión ${this.mission.n} (${this.mission.text.toLowerCase()}): ¡todavía no! ${text}`;
    reportScore(this.progress, this.gameId, this.score);
    addToLeaderboard(this.progress, this.gameId, this.progress.playerName, this.score);
    // Matipuntos por terminar la partida, según el puntaje (cada juego puntúa distinto)
    const bonus = Math.round(runBonus(this.gameId, this.score) * (this.bonusMult || 1)); // algunos juegos dan más con mejoras (p. ej. autos del garaje)
    if (bonus > 0) {
      earnCoins(this.progress, bonus);
      saveProgress(this.progress);
      text += ` Por jugar ganas +${bonus} Matipuntos 🍫✨.`;
    }
    const run = recordRun(this.progress, this.gameId, this.score, this.runInfo || {});
    this.runInfo = null;
    text += ` +${run.xp} XP${run.stars ? ` +${run.stars} ⭐` : ""}`;
    if (run.tokens) text += ` +${run.tokens} ${run.eventToken}`;
    if (this.els.gameoverText) this.els.gameoverText.textContent = text;
    this.showOverlay("gameover");
  }

  _loop(ts) {
    if (!this.running) return;
    this.renderer.__glUse = ts; // es el juego en uso: si hace falta soltar un contexto, que sea otro (ver glEvict)
    if (this._held) { this.lastTs = null; requestAnimationFrame(this._loop); return; } // en pausa: quieto, sin gastar
    if (this.lastTs == null) this.lastTs = ts;
    const dt = Math.min(0.05, (ts - this.lastTs) / 1000);
    this.lastTs = ts;
    if (this._freeze > 0) {
      this._freeze -= dt;
      if (this.composer) this.composer.render(dt);
      else this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(this._loop);
      return;
    }
    this.time += dt;
    this._adaptQuality(dt);
    this.update(dt);
    this._missionTick(dt);
    if (this.state === "playing" && this.energyEvery) {
      // juegos de correr/avanzar sin acciones claras: gastan 1 cada cierto tiempo
      this._eT = (this._eT || 0) + dt;
      if (this._eT >= this.energyEvery) { this._eT -= this.energyEvery; this.spendAction(1); }
    }
    if (this.state === "playing" && this.progress) {
      // tiempo jugado (para los logros de constancia); se guarda cada ~10 s
      this._playAcc = (this._playAcc || 0) + dt;
      if (this._playAcc >= 10) {
        this.progress.stats.playSecs = (this.progress.stats.playSecs || 0) + this._playAcc;
        this._playAcc = 0;
        saveProgress(this.progress);
      }
    }
    if (this.ambient) this.ambient.update(this.time, dt, this.camera.position);
    this.particles.update(dt);
    this.popups.update(dt);
    if (this.composer) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this._loop);
  }

  _adaptQuality(dt) {
    if (this.qualityStep >= 3) return; // ya está en lo mínimo (sin brillo, menos resolución y sin sombras)
    if (this.qualityDone && this.state !== "playing") return;
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 90) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes = [];
    if (!this.qualityDone) {
      // calibración al empezar: baja un escalón cada ~3 s mientras vaya lento
      if (avg <= 0.034) this.qualityDone = true;
      else this._qualityDown();
      return;
    }
    // y después sigue mirando: si el juego se pone pesado más adelante (otra zona del mapa, el final de un nivel),
    // con dos tramos lentos seguidos (~6 s bajo 24 cuadros por segundo) baja otro escalón
    if (avg > 0.042) {
      this._slowSpans = (this._slowSpans || 0) + 1;
      if (this._slowSpans >= 2) { this._slowSpans = 0; this._qualityDown(); }
    } else this._slowSpans = 0;
  }

  _qualityDown() {
    this.qualityStep++;
    if (this.qualityStep === 1 && this.composer) {
      this.composer = null; // 1) sin brillo
    } else if (this.qualityStep <= 2) {
      this.composer = null;
      this.pixelRatio = Math.max(0.6, this.pixelRatio * 0.75); // 2) menos resolución
      this.renderer.setPixelRatio(this.pixelRatio);
      this._onResize();
    } else {
      this.onLowQuality?.(); // 3) sin sombras
      this.qualityStep = 3;
      this.qualityDone = true;
    }
  }

  playSound(name) {
    audio[name]?.();
  }
}

/** Libera de la GPU todo lo que cuelga de un objeto (geometrías, materiales y sus texturas). Si algo
 * compartido se vuelve a usar, three.js lo sube de nuevo solo; lo importante es no acumular al reiniciar. */
export function disposeTree(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of mats) {
      for (const k of ["map", "emissiveMap", "alphaMap", "normalMap", "roughnessMap"]) if (m[k]) m[k].dispose();
      m.dispose();
    }
  });
}

/** Libera solo las geometrías de un objeto (para lo que se crea y se quita todo el rato, con materiales compartidos). */
export function disposeGeometries(obj) {
  obj.traverse((o) => { if (o.geometry && !o.isSprite) o.geometry.dispose(); }); // los sprites comparten una sola geometría
}

// ---------- estilo "anime": sombreado por tonos (cel-shading) y contorno ----------
let toonGradTex = null;
function toonGradient() {
  if (!toonGradTex) {
    const c = document.createElement("canvas");
    c.width = 4;
    c.height = 1;
    const x = c.getContext("2d");
    ["#7a6c94", "#b3a6c8", "#dcd2e8", "#f4eef9"].forEach((col, i) => { x.fillStyle = col; x.fillRect(i, 0, 1, 1); });
    toonGradTex = new THREE.CanvasTexture(c);
    toonGradTex.minFilter = THREE.NearestFilter;
    toonGradTex.magFilter = THREE.NearestFilter;
    toonGradTex.generateMipmaps = false;
  }
  return toonGradTex;
}

const toonOf = new WeakMap();
function toToon(m) {
  if (!m || m.isMeshToonMaterial || !m.isMeshStandardMaterial) return m;
  if (toonOf.has(m)) return toonOf.get(m);
  const t = new THREE.MeshToonMaterial({
    color: m.color, map: m.map, emissive: m.emissive, emissiveIntensity: m.emissiveIntensity, emissiveMap: m.emissiveMap,
    transparent: m.transparent, opacity: m.opacity, side: m.side, alphaTest: m.alphaTest, vertexColors: m.vertexColors,
    flatShading: false, gradientMap: toonGradient(),
  });
  t.color = m.color; // se comparten los colores: si el original cambia (ropa, pelo), el nuevo también
  t.emissive = m.emissive;
  toonOf.set(m, t);
  return t;
}

/** Convierte los materiales estándar de una escena u objeto en materiales "anime" (sombras por tonos, colores planos). */
export function toonify(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (let a = o; a; a = a.parent) if (a.userData && a.userData.noToon) return; // los personajes se quedan como son
    if (Array.isArray(o.material)) o.material = o.material.map(toToon);
    else o.material = toToon(o.material);
  });
}

const outlineMat = new THREE.MeshBasicMaterial({ color: 0x2a1410, side: THREE.BackSide });
outlineMat.onBeforeCompile = (sh) => {
  sh.uniforms.thick = { value: 0.018 };
  sh.vertexShader = sh.vertexShader.replace("void main() {", "uniform float thick;\nvoid main() {").replace("#include <begin_vertex>", "vec3 transformed = position + normalize(normal) * thick;");
};

/** Contorno fino oscuro alrededor de las mallas de un objeto (casco invertido). Solo para personajes y objetos clave. */
export function addOutline(root, thick = 0.018) {
  const add = [];
  root.traverse((o) => { if (o.isMesh && !o.userData.isOutline && !o.userData.noOutline && !o.isInstancedMesh && !o.isSkinnedMesh) add.push(o); });
  for (const m of add) {
    const mat = outlineMat.clone();
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.thick = { value: thick };
      sh.vertexShader = sh.vertexShader.replace("void main() {", "uniform float thick;\nvoid main() {").replace("#include <begin_vertex>", "vec3 transformed = position + normalize(normal) * thick;");
    };
    const ol = new THREE.Mesh(m.geometry, mat);
    ol.userData.isOutline = true;
    ol.castShadow = false;
    ol.receiveShadow = false;
    m.add(ol);
  }
}

// ---------- ambiente flotante: pétalos, corazoncitos y estrellitas ----------
function sparkleTexture(kind) {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const x = c.getContext("2d");
  x.translate(32, 32);
  if (kind === "petal") {
    x.fillStyle = "#ffc2dc";
    x.beginPath();
    x.ellipse(0, 0, 11, 19, 0.5, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = "rgba(255,255,255,0.55)";
    x.beginPath();
    x.ellipse(-3, -5, 3, 8, 0.5, 0, Math.PI * 2);
    x.fill();
  } else if (kind === "heart") {
    x.fillStyle = "#ff8fb8";
    x.beginPath();
    x.moveTo(0, 14);
    x.bezierCurveTo(-26, -4, -12, -22, 0, -8);
    x.bezierCurveTo(12, -22, 26, -4, 0, 14);
    x.fill();
  } else {
    x.fillStyle = "#fff6c8";
    x.beginPath();
    for (let i = 0; i < 8; i++) { const r = i % 2 ? 6 : 22; const a = (i / 8) * Math.PI * 2 - Math.PI / 2; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    x.closePath();
    x.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Pétalos que caen despacito, corazoncitos y estrellitas que titilan alrededor de la cámara. `update(t, dt, centro)` cada cuadro. */
export function makeAmbient(parent, { petals = 36, hearts = 10, stars = 26, radius = 16, height = 11, floor = 0 } = {}) {
  const layers = [];
  const mk = (kind, n, size, fall, twinkle) => {
    if (n <= 0) return;
    const pos = new Float32Array(n * 3);
    const off = [];
    for (let i = 0; i < n; i++) off.push({ x: (Math.random() * 2 - 1) * radius, y: Math.random() * height, z: (Math.random() * 2 - 1) * radius, ph: Math.random() * 6.28, v: fall * (0.6 + Math.random() * 0.8) });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ map: sparkleTexture(kind), size, transparent: true, depthWrite: false, opacity: 0.95, sizeAttenuation: true });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    pts.renderOrder = 8;
    pts.userData.noToon = true;
    parent.add(pts);
    layers.push({ pts, geo, mat, off, fall, twinkle, base: size });
  };
  mk("petal", petals, 0.8, 0.5, false);
  mk("heart", hearts, 0.7, 0.28, false);
  mk("star", stars, 0.5, 0.0, true);
  return {
    update(t, dt, c) {
      for (const L of layers) {
        const a = L.geo.attributes.position.array;
        L.off.forEach((o, i) => {
          if (L.fall) {
            o.y -= o.v * dt;
            if (o.y < 0) { o.y = height; o.x = (Math.random() * 2 - 1) * radius; o.z = (Math.random() * 2 - 1) * radius; }
          }
          const sway = Math.sin(t * 0.8 + o.ph) * (L.fall ? 0.8 : 0.15);
          a[i * 3] = c.x + o.x + sway;
          a[i * 3 + 1] = floor + o.y * (L.fall ? 1 : 0.5) + (L.fall ? 0 : 0.6);
          a[i * 3 + 2] = c.z + o.z + Math.cos(t * 0.6 + o.ph) * (L.fall ? 0.6 : 0.1);
        });
        L.geo.attributes.position.needsUpdate = true;
        if (L.twinkle) L.mat.opacity = 0.35 + 0.3 * Math.sin(t * 2.2);
      }
    },
  };
}
