// Base 3D compartida de los juegos de Matijuego: renderizador, bucle,
// calidad adaptativa, partículas, popups y utilidades de texturas.
// Los juegos 3D (Salto Choco, Autos de Chocolate, Memoria Matichoc) extienden
// Game3D y solo implementan build / reset / update.

import * as THREE from "../vendor/three.module.min.js";
import { getOutfit } from "./characters.js";
import { addToLeaderboard, equippedOutfitId, reportScore } from "./storage.js";
import * as audio from "./audio.js";

export { THREE };

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);

// "Look" compartido (brillo suave estilo juego moderno); cada juego puede ajustarlo.
export const LOOK = { bloom: { strength: 0.32, radius: 0.55, threshold: 0.92 }, grade: { sat: 1.16, contrast: 1.06, vig: 0.22 } };

// Ajuste final de color (saturación, contraste y viñeta) sobre la imagen ya en sRGB.
const GRADE_SHADER = {
  uniforms: { tDiffuse: { value: null }, sat: { value: 1.16 }, contrast: { value: 1.06 }, vig: { value: 0.22 } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: `uniform sampler2D tDiffuse; uniform float sat; uniform float contrast; uniform float vig; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb = mix(vec3(l), c.rgb, sat);
      c.rgb = (c.rgb - 0.5) * contrast + 0.5;
      c.rgb *= 1.0 - vig * smoothstep(0.45, 0.98, distance(vUv, vec2(0.5)));
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
export function makeBunting(from, to, { count = 14, sag = 0.7, size = 0.28 } = {}) {
  const group = new THREE.Group();
  const colors = [0xd4216c, 0xffc800, 0xcfd767, 0xfff6e6, 0xf08a3c];
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

  async init() {
    if (this.ready) return;
    const { canvas, wrap } = this.els;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !this.coarse, powerPreference: "high-performance" });
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
      this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), this.bloom.strength, this.bloom.radius, this.bloom.threshold);
      this.composer.addPass(this.bloomPass);
      this.composer.addPass(new OutputPass());
      const grade = new ShaderPass(GRADE_SHADER);
      grade.uniforms.sat.value = LOOK.grade.sat;
      grade.uniforms.contrast.value = LOOK.grade.contrast;
      grade.uniforms.vig.value = LOOK.grade.vig;
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
    this.particles.clear();
    this.popups.clear();
    this.state = "intro";
    this.reset();
    this.showOverlay("intro");
    this.running = true;
    this.lastTs = null;
    requestAnimationFrame(this._loop);
  }

  beginPlaying() {
    if (this.state === "playing") return;
    this.state = "playing";
    this.showOverlay(null);
    this.onBegin?.();
  }

  retry() {
    this.particles.clear();
    this.popups.clear();
    this.state = "intro";
    this.reset();
    this.beginPlaying();
  }

  pauseForMenu() {
    if (this.running) reportScore(this.progress, this.gameId, this.score || 0);
    this.running = false;
    this.state = "paused";
  }

  showOverlay(name) {
    Object.entries(this.els.overlays).forEach(([key, el]) => el.classList.toggle("hidden", key !== name));
    if (!name) Object.values(this.els.overlays).forEach((el) => el.classList.add("hidden"));
  }

  /** Cierra la partida: guarda puntaje/ranking y muestra el resumen. */
  finish(text) {
    this.state = "gameover";
    reportScore(this.progress, this.gameId, this.score);
    addToLeaderboard(this.progress, this.gameId, this.progress.playerName, this.score);
    if (this.els.gameoverText) this.els.gameoverText.textContent = text;
    this.showOverlay("gameover");
  }

  _loop(ts) {
    if (!this.running) return;
    if (this.lastTs == null) this.lastTs = ts;
    const dt = Math.min(0.05, (ts - this.lastTs) / 1000);
    this.lastTs = ts;
    this.time += dt;
    this._adaptQuality(dt);
    this.update(dt);
    this.particles.update(dt);
    this.popups.update(dt);
    if (this.composer) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this._loop);
  }

  _adaptQuality(dt) {
    if (this.qualityDone) return;
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 90) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes = [];
    if (avg <= 0.034) {
      this.qualityDone = true;
      return;
    }
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
      this.qualityDone = true;
    }
  }

  playSound(name) {
    audio[name]?.();
  }
}
