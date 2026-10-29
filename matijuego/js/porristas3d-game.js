// Saltos de Porristas 3D: una rutina de porristas al ritmo de la música (pedido de la persona dueña, 29-oct-2026).
// Tu Matichica es la "voladora" de un equipo: las bases la cargan, la lanzan, hace una figura en el aire (estrella,
// giro, split...) y la reciben; al final arman una pirámide. Se juega tocando (la pantalla, el botón 👏 o la barra
// espaciadora) justo cuando lo marca el ritmo: ¡Arriba! (lanzar), la figura (en lo más alto) y ¡Atrapa! (recibirla).
// Si no la reciben a tiempo se pierde un ❤️; con los 3 ❤️ perdidos se acaba. En los 20 niveles hay que terminar la
// rutina; en el modo infinito la música se va apurando.
//
// Para cuidar los celulares de gama media-baja, las compañeras del equipo se dibujan con piezas agrupadas
// (InstancedMesh: una sola llamada de dibujo por pieza para todo el equipo) y solo la Matichica es un personaje completo.

import { THREE, Game3D, clamp, rand, canvasTexture, roundedBox, makeBunting, makeStars, makeLogo } from "./three-kit.js?v=fe364939c0";
import { createMatichico } from "./matichico3d.js?v=fe364939c0";
import { saveProgress, earnCoins } from "./storage.js?v=fe364939c0";
import * as audio from "./audio.js?v=fe364939c0";
import { campaignWin, campaign, campaignMode, campaignLevel, renderModePicker, LEVELS_PER_GAME } from "./campaign.js?v=fe364939c0";

const GAME_ID = "porristas";
const HEARTS = 3;
const PERFECT = 0.085; // segundos de diferencia con el tiempo justo
const GOOD = 0.19;
const EARLY = 0.4; // tocar antes de esto cuenta como "muy pronto" (así no sirve tocar sin parar)
// Ajuste del ritmo a cada celular (prueba en el celular, 29-oct: "los tiempos medio desfasados"). Lo que suena se programa
// con el reloj del audio y se adelanta lo que tarda el parlante en sonar (AUDIO_LAG), así se oye justo cuando el aro se
// cierra. Además, el juego aprende con los toques cuánto se atrasa (o adelanta) la persona y lo descuenta (offset).
const MAX_LAG = 0.25;
const OFFSET_RANGE = [-0.08, 0.3];
const SQ = 1.15; // tamaño de las compañeras
const SHOULDER = (0.75 + 0.55) * SQ; // altura de los hombros (≈1.5)
const ARM = 0.55 * SQ;
const HOLD_Y = 1.1; // altura de las manos de las bases con la voladora cargada
const EXT_Y = 2.05; // brazos estirados (cuando la sueltan y cuando la reciben)
const PEAK = 2.6; // cuánto sube sobre EXT_Y en el lanzamiento
const PYR_MID_Y = 1.45; // la fila del medio de la pirámide, parada en los hombros de la de abajo
const PYR_TOP_Y = PYR_MID_Y + SHOULDER + ARM * 0.98;

/** Las figuras en el aire; `from` es el nivel desde el que aparecen. */
const FIGS = [
  { id: "estrella", name: "Estrella", icon: "⭐", from: 1 },
  { id: "giro", name: "Giro", icon: "🌀", from: 1 },
  { id: "split", name: "Split", icon: "🤸", from: 2 },
  { id: "doble", name: "Doble giro", icon: "💫", from: 5 },
  { id: "mortal", name: "Mortal", icon: "🔄", from: 8 },
];

const ease = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
/** Ángulo del brazo (0 = abajo, π = arriba) para que la mano quede a la altura `y` desde un hombro a `sh`. */
const armFor = (y, sh) => Math.acos(clamp((sh - y) / ARM, -1, 1));

export class Porristas3DGame extends Game3D {
  constructor(character, progress, els) {
    super(GAME_ID, character, progress, els, { fov: 40 });
    this.kawaii = true; // ambiente kawaii: pastel, sombreado por tonos, pétalos y estrellitas
    this.ambientOpts = { petals: 18, hearts: 5, stars: 13, radius: 9, height: 9 };
    this.cheer = 0;
    this.musicTheme = null; // la música la marca el juego tiempo a tiempo (ver audio.playCheerBeat)
    this.taps = 0;
  }

  // ---------- escena ----------

  async build() {
    const s = this.scene;
    s.background = new THREE.Color(0x1e0f2a);
    s.fog = new THREE.Fog(0x1e0f2a, 30, 70);
    s.add(new THREE.HemisphereLight(0xffe9f2, 0x5a2a40, 1.15));
    this.key = new THREE.DirectionalLight(0xfff0d2, 2.2);
    this.key.position.set(-5, 14, 12);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(this.coarse ? 1024 : 2048, this.coarse ? 1024 : 2048);
    const sc = this.key.shadow.camera;
    sc.left = -9; sc.right = 9; sc.top = 10; sc.bottom = -3; sc.near = 2; sc.far = 40;
    this.key.shadow.bias = -0.0005;
    this.key.shadow.normalBias = 0.04;
    s.add(this.key, this.key.target);
    this.key.target.position.set(0, 2, 0);
    this.onLowQuality = () => { this.key.castShadow = false; };
    // focos de escenario
    this.spots = [];
    for (const [x, c] of [[-6, 0xd4216c], [0, 0xffc800], [6, 0xcfd767]]) {
      const sp = new THREE.SpotLight(c, 90, 40, 0.32, 0.6, 1.2);
      sp.position.set(x, 14, 6);
      sp.target.position.set(x * 0.3, 1, 0);
      s.add(sp, sp.target);
      this.spots.push(sp);
    }
    this._buildStage();
    this._buildSquad();
    this._buildCue();
    this._ensureHero();
  }

  _buildStage() {
    const s = this.scene;
    // piso del escenario brillante
    const floorTex = canvasTexture(1024, 512, (g, w, h) => {
      g.fillStyle = "#3a1a0e"; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 16; i++) {
        g.fillStyle = i % 2 ? "#4a2414" : "#52291a";
        g.fillRect((i * w) / 16, 0, w / 16 + 1, h);
      }
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(36, 16), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.28, metalness: 0.25 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 2);
    floor.receiveShadow = true;
    s.add(floor);
    // colchoneta de la rutina (una caja con alto: no se pelea con el piso) y el logo de Matichoc pintado encima
    const matTex = canvasTexture(1024, 512, (g, w, h) => {
      g.fillStyle = "#2f7fd0"; g.fillRect(0, 0, w, h);
      g.strokeStyle = "rgba(255,255,255,0.35)"; g.lineWidth = 6;
      for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo((i * w) / 6, 0); g.lineTo((i * w) / 6, h); g.stroke(); }
      g.fillStyle = "#d4216c"; g.fillRect(0, 0, w, 26); g.fillRect(0, h - 26, w, 26);
    });
    const mat = new THREE.Mesh(roundedBox(9, 0.08, 4.2, 0.04, 0.02), new THREE.MeshStandardMaterial({ map: matTex, roughness: 0.7 }));
    mat.position.set(0, 0.04, 0.6);
    mat.receiveShadow = true;
    s.add(mat);
    const floorLogo = makeLogo(3.2, { lit: false });
    floorLogo.rotation.x = -Math.PI / 2;
    floorLogo.position.set(0, 0.085, 1.6);
    s.add(floorLogo);
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(80, 60), new THREE.MeshStandardMaterial({ color: 0x2a120a, roughness: 0.4, metalness: 0.2 }));
    apron.rotation.x = -Math.PI / 2;
    apron.position.set(0, -0.01, 30);
    apron.receiveShadow = true;
    s.add(apron);

    // cortina del fondo
    const curtain = new THREE.Mesh(
      new THREE.PlaneGeometry(44, 22),
      new THREE.MeshStandardMaterial({
        map: canvasTexture(1024, 512, (g, w, h) => {
          const grad = g.createLinearGradient(0, 0, 0, h);
          grad.addColorStop(0, "#7d1445"); grad.addColorStop(1, "#3a0a22");
          g.fillStyle = grad; g.fillRect(0, 0, w, h);
          for (let i = 0; i < 40; i++) {
            g.fillStyle = i % 2 ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.07)";
            g.fillRect((i * w) / 40, 0, w / 40, h);
          }
        }),
        roughness: 0.9,
      }),
    );
    curtain.position.set(0, 10, -5);
    s.add(curtain);

    // letras luminosas
    const word = new THREE.Mesh(
      new THREE.PlaneGeometry(11, 1.9),
      new THREE.MeshBasicMaterial({
        transparent: true,
        map: canvasTexture(1400, 240, (g, w, h) => {
          g.font = '150px "Baby Chipmunk", sans-serif'; g.letterSpacing = '6px';
          g.textAlign = "center"; g.textBaseline = "middle";
          g.shadowColor = "#FFC800"; g.shadowBlur = 36; g.fillStyle = "#FFC800";
          g.fillText("LA LIGA CHEER", w / 2, h / 2 + 10);
        }),
      }),
    );
    word.position.set(0, 9.3, -4.8);
    s.add(word);
    for (const lx of [-9.5, 9.5]) {
      const lg = makeLogo(3.6);
      lg.position.set(lx, 9.3, -4.75);
      s.add(lg);
    }
    s.add(makeBunting(new THREE.Vector3(-16, 13.5, -4.5), new THREE.Vector3(16, 13.5, -4.5), { count: 34, sag: 1.6, size: 0.65 }));
    s.add(makeStars(120, 50));

    // hinchada
    const palette = [0xd4216c, 0xffc800, 0xcfd767, 0xfff6e6, 0x2fa8d6];
    const crowdGeo = new THREE.BoxGeometry(0.7, 0.8, 0.5);
    const headGeo = new THREE.SphereGeometry(0.28, 10, 8);
    const n = 70;
    this.crowdBody = new THREE.InstancedMesh(crowdGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }), n);
    this.crowdHead = new THREE.InstancedMesh(headGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }), n);
    const skin = [0x64321b, 0x8a5a36, 0xc98a4b, 0xe0ab72];
    const col = new THREE.Color();
    this.crowd = [];
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / 24);
      const idx = i % 24;
      this.crowd.push({ x: -13.5 + idx * 1.18 + rand(-0.15, 0.15), z: -3.4 - row * 0.9, y: 0.4 + row * 0.55, phase: rand(0, 6.28) });
      this.crowdBody.setColorAt(i, col.setHex(palette[Math.floor(Math.random() * palette.length)]));
      this.crowdHead.setColorAt(i, col.setHex(skin[Math.floor(Math.random() * skin.length)]));
    }
    this.crowdBody.instanceColor.needsUpdate = true;
    this.crowdHead.instanceColor.needsUpdate = true;
    s.add(this.crowdBody, this.crowdHead);
    this._dummy = new THREE.Object3D();
    this._animateCrowd();
  }

  _animateCrowd() {
    const d = this._dummy;
    this.crowd.forEach((p, i) => {
      const bob = Math.max(0, Math.sin(this.time * 6 + p.phase)) * (0.05 + this.cheer * 0.4);
      d.position.set(p.x, p.y + bob, p.z);
      d.updateMatrix();
      this.crowdBody.setMatrixAt(i, d.matrix);
      d.position.y = p.y + 0.62 + bob;
      d.updateMatrix();
      this.crowdHead.setMatrixAt(i, d.matrix);
    });
    this.crowdBody.instanceMatrix.needsUpdate = true;
    this.crowdHead.instanceMatrix.needsUpdate = true;
  }

  /**
   * El equipo: 2 bases (se miran, cargan y lanzan), 1 de atrás (ayuda y recibe) y 2 a los lados (animan con pompones y
   * suben a la fila del medio de la pirámide). Cada compañera es un esqueleto de Object3D sin mallas; sus piezas se
   * dibujan con un InstancedMesh por pieza (13 dibujos para las 5).
   */
  _buildSquad() {
    const std = (c, r = 0.6) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
    const choco = std(0x6b3a1e, 0.55);
    const leg = new THREE.CapsuleGeometry(0.095, 0.56, 4, 8).translate(0, -0.37, 0);
    const arm = new THREE.CapsuleGeometry(0.065, 0.4, 4, 8).translate(0, -0.27, 0);
    const face = canvasTexture(256, 256, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.fillStyle = "#2b1a10";
      for (const x of [0.32, 0.68]) { g.beginPath(); g.ellipse(w * x, h * 0.45, 16, 24, 0, 0, 7); g.fill(); }
      g.fillStyle = "#fff"; for (const x of [0.34, 0.7]) { g.beginPath(); g.arc(w * x, h * 0.4, 6, 0, 7); g.fill(); }
      g.strokeStyle = "#2b1a10"; g.lineWidth = 9; g.lineCap = "round";
      g.beginPath(); g.arc(w / 2, h * 0.6, 26, 0.2, Math.PI - 0.2); g.stroke();
      g.fillStyle = "rgba(212,33,108,0.45)"; for (const x of [0.2, 0.8]) { g.beginPath(); g.arc(w * x, h * 0.62, 18, 0, 7); g.fill(); }
    });
    const pom = new THREE.IcosahedronGeometry(0.17, 1);
    const PARTS = {
      leg: [leg, choco], shoe: [roundedBox(0.17, 0.09, 0.28, 0.04, 0.02).translate(0, 0, 0.04), std(0xfff6e6)],
      skirt: [new THREE.CylinderGeometry(0.24, 0.36, 0.26, 12, 1, true), new THREE.MeshStandardMaterial({ color: 0xffc800, roughness: 0.5, side: THREE.DoubleSide })],
      torso: [roundedBox(0.46, 0.5, 0.3, 0.09, 0.03), std(0xd4216c, 0.5)],
      arm: [arm, choco],
      pomL: [pom, new THREE.MeshStandardMaterial({ color: 0xffc800, roughness: 0.8, flatShading: true, emissive: 0xffc800, emissiveIntensity: 0.25 })],
      pomR: [pom, new THREE.MeshStandardMaterial({ color: 0xd4216c, roughness: 0.8, flatShading: true, emissive: 0xd4216c, emissiveIntensity: 0.25 })],
      head: [roundedBox(0.5, 0.44, 0.36, 0.12, 0.04), choco],
      face: [new THREE.PlaneGeometry(0.36, 0.3), new THREE.MeshBasicMaterial({ map: face, transparent: true })],
      bow: [new THREE.TorusGeometry(0.09, 0.04, 6, 12), std(0xfff6e6, 0.5)],
    };
    const N = 5;
    this.inst = {};
    for (const [k, [geo, m]] of Object.entries(PARTS)) {
      const im = new THREE.InstancedMesh(geo, m, k === "leg" || k === "shoe" || k === "arm" ? N * 2 : N);
      im.castShadow = k !== "face" && k !== "bow";
      im.frustumCulled = false; // se mueven por todo el escenario (y suben en la pirámide)
      this.scene.add(im);
      this.inst[k] = im;
    }
    const slot = (parent, part, x = 0, y = 0, z = 0) => {
      const o = new THREE.Object3D();
      o.position.set(x, y, z);
      o.userData.part = part;
      parent.add(o);
      return o;
    };
    this.squad = [];
    for (let i = 0; i < N; i++) {
      const root = new THREE.Object3D();
      root.scale.setScalar(SQ);
      const legs = [-1, 1].map((sx) => {
        const p = slot(root, null, sx * 0.11, 0.75, 0);
        slot(p, "leg");
        slot(p, "shoe", 0, -0.72, 0);
        return p;
      });
      const hips = slot(root, null, 0, 0.75, 0);
      slot(hips, "skirt", 0, 0.05, 0);
      slot(hips, "torso", 0, 0.33, 0);
      const arms = [-1, 1].map((sx) => {
        const p = slot(hips, null, sx * 0.29, 0.55, 0);
        slot(p, "arm");
        slot(p, sx < 0 ? "pomL" : "pomR", 0, -0.6, 0);
        return p;
      });
      const head = slot(hips, null, 0, 0.84, 0);
      slot(head, "head");
      slot(head, "face", 0, 0.01, 0.182);
      const bow = slot(head, "bow", 0, 0.27, -0.02);
      bow.scale.set(1.4, 0.8, 1);
      const slots = [];
      root.traverse((o) => { if (o.userData.part) slots.push(o); });
      this.squad.push({ root, legs, hips, arms, head, slots, x: 0, y: 0, z: 0, yaw: 0, from: null });
    }
    this._squadPose(0);
  }

  /** Pasa los esqueletos del equipo a las piezas agrupadas. */
  _flushSquad() {
    const count = {};
    for (const m of this.squad) {
      m.root.position.set(m.x, m.y + 0.08, m.z);
      m.root.rotation.y = m.yaw;
      m.root.updateMatrixWorld(true);
      for (const s of m.slots) {
        const k = s.userData.part;
        const i = count[k] || 0;
        this.inst[k].setMatrixAt(i, s.matrixWorld);
        count[k] = i + 1;
      }
    }
    for (const im of Object.values(this.inst)) im.instanceMatrix.needsUpdate = true;
  }

  /** Aro que se va cerrando hasta el aro fijo: cuando calzan, ¡hay que tocar! */
  _buildCue() {
    const ringMat = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthTest: false, side: THREE.DoubleSide });
    this.cueTarget = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 40), ringMat(0xfff6e6, 0.5));
    this.cueRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 40), ringMat(0xffc800, 0.95));
    for (const r of [this.cueTarget, this.cueRing]) { r.renderOrder = 20; r.visible = false; this.scene.add(r); }
  }

  _ensureHero() {
    if (this.hero && this.heroId === this.character.id) {
      this.hero.setLook(this.look);
      return;
    }
    if (this.hero) this.scene.remove(this.heroPivot);
    this.hero = createMatichico(this.character, this.outfit, this.look);
    this.heroId = this.character.id;
    this.hero.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.hero.group.scale.setScalar(1.3);
    // pompones en las manos
    this.hero.arms.forEach((arm, i) => {
      const g = new THREE.Group();
      const m = new THREE.MeshStandardMaterial({ color: i ? 0xffc800 : 0xd4216c, roughness: 0.8, flatShading: true, emissive: i ? 0xffc800 : 0xd4216c, emissiveIntensity: 0.3 });
      for (let k = 0; k < 3; k++) {
        const b = new THREE.Mesh(new THREE.IcosahedronGeometry(k ? 0.1 : 0.14, 1), m);
        if (k) b.position.set(rand(-0.07, 0.07), rand(-0.07, 0.07), rand(-0.07, 0.07));
        b.castShadow = true;
        g.add(b);
      }
      g.position.set(0, -0.42, 0);
      arm.add(g);
    });
    this.hero.group.position.y = -0.95;
    this.heroPivot = new THREE.Group();
    this.heroPivot.add(this.hero.group);
    this.scene.add(this.heroPivot);
  }

  onResize(w, h) {
    const aspect = w / h;
    const vfov = THREE.MathUtils.degToRad(this.fov / 2);
    // de la colchoneta (abajo queda la barrita del ritmo) hasta la cabeza de la Matichica en lo más alto del lanzamiento
    const needW = 10.4;
    const needH = 9.6;
    this.camDist = Math.max(needH / 2 / Math.tan(vfov), needW / 2 / (Math.tan(vfov) * aspect));
    this.camera.position.set(0, 3.7, this.camDist);
    this.camera.lookAt(0, 3.3, 0);
  }

  // ---------- partida ----------

  reset() {
    this.score = 0;
    this.combo = 0;
    this.coinsEarned = 0;
    this.mode = campaignMode(this.progress, GAME_ID);
    this.level = this.mode === "levels" ? campaignLevel(this.progress, GAME_ID) : 0;
    this.goal = this.level ? 3 + Math.ceil(this.level / 2.5) : 0; // figuras antes de la pirámide (4 a 11)
    this.stunts = 0; // figuras ya hechas
    this.pyramids = 0;
    this.hearts = HEARTS;
    this.hits = { perfect: 0, good: 0, miss: 0 };
    this.rt = 0; // tiempo de la rutina (segundos)
    this._rtAt = 0;
    this.audioLag = clamp(audio.latency(), 0, MAX_LAG);
    this.offset = clamp(Number(this.progress.porristasOffset) || 0, OFFSET_RANGE[0], OFFSET_RANGE[1]);
    this.parts = [];
    this.lastFig = null;
    this.endT = 0;
    this.fail = false;
    this.cheer = 0;
    this.taps = 0;
    this.wobble = 0;
    this.fly = { x: 0, y: HOLD_Y, z: 0.05 };
    this._ensureHero();
    this._addPart("count");
    this._renderStrip();
    this._updateHud();
    this._sync(0);
  }

  _bpm() {
    if (this.level) return Math.min(132, 86 + this.level * 2.3);
    return Math.min(140, 88 + Math.floor(this.stunts / 2) * 3);
  }

  _pickFig() {
    const top = this.level || 1 + Math.floor(this.stunts / 2);
    const pool = FIGS.filter((f) => f.from <= top && f !== this.lastFig);
    const f = pool[Math.floor(Math.random() * pool.length)];
    this.lastFig = f;
    return f;
  }

  /** Agrega el siguiente tramo de la rutina: "count" (5, 6, 7, 8), "stunt" (una figura) o "pyramid". */
  _addPart(kind) {
    const prev = this.parts[this.parts.length - 1];
    const spb = 60 / this._bpm();
    const t0 = prev ? prev.t0 + prev.beats * prev.spb : 0.6;
    const beats = kind === "count" ? 4 : 8;
    const part = { kind, t0, spb, beats, hits: [], started: false, lastBeat: -1 };
    const hit = (beat, label, icon, y) => part.hits.push({ beat, t: t0 + beat * spb, label, icon, y, res: null });
    if (kind === "stunt") {
      part.fig = this._pickFig();
      hit(2, "¡Arriba!", "👐", EXT_Y + 0.9);
      hit(4, part.fig.name, part.fig.icon, EXT_Y + PEAK + 0.9);
      hit(6, "¡Atrapa!", "🤲", EXT_Y + 0.9);
    } else if (kind === "pyramid") {
      hit(1, "¡Base!", "🧱", 1.3);
      hit(3, "¡Suben!", "⬆️", PYR_MID_Y + 1.2);
      hit(5, "¡A la cima!", "🔺", PYR_TOP_Y + 0.9);
      hit(7, "¡Ta-dá!", "🎉", PYR_TOP_Y + 1.2);
    }
    this.parts.push(part);
    return part;
  }

  /** Qué viene después de un tramo. */
  _nextKind() {
    if (this.level) return this.stunts >= this.goal ? (this.pyramids ? null : "pyramid") : "stunt";
    return this.stunts > 0 && this.stunts % 5 === 0 && this.pyramids < this.stunts / 5 ? "pyramid" : "stunt";
  }

  _part() {
    for (const p of this.parts) if (this.rt < p.t0 + p.beats * p.spb) return p;
    return this.parts[this.parts.length - 1];
  }

  update(dt) {
    this.cheer = Math.max(0, this.cheer - dt * 0.8);
    this.wobble = Math.max(0, this.wobble - dt * 1.4);
    this._animateCrowd();
    const wob = Math.sin(this.time * 0.9);
    this.spots.forEach((sp, i) => { sp.target.position.x = (i - 1) * 2 + wob * 2 * (i - 1 || 1); });

    if (this.state === "playing") {
      if (this.endT > 0) {
        this.endT -= dt;
        if (this.endT <= 0) { if (this.fail) this._onFail(); else this._levelDone(); return; }
      } else {
        this.rt += dt;
        this._rtAt = performance.now();
        this._tick();
      }
    }
    this._sync(dt);
  }

  /** Avanza la rutina: suena cada tiempo, se marcan los toques que pasaron de largo y se arma el tramo siguiente. */
  _tick() {
    const part = this._part();
    if (!part.started) this._startPart(part);
    const u = (this.rt - part.t0) / part.spb;
    const beat = Math.floor(u);
    this._scheduleBeats();
    if (beat !== part.lastBeat && beat >= 0 && beat < part.beats) {
      part.lastBeat = beat;
      if (part.kind === "count") this.popups.add(new THREE.Vector3(0, EXT_Y + 2.6, 0.5), String(beat + 5), "combo");
      this._renderStrip();
    }
    for (const h of part.hits) if (!h.res && this.rt > h.t + this.offset + GOOD) this._judge(h, null);
    // el tramo que sigue se arma un poco antes, para que su primer toque ya se vea venir
    const end = part.t0 + part.beats * part.spb;
    if (part === this.parts[this.parts.length - 1] && this.rt > end - part.spb * 1.5) {
      if (part.kind === "stunt") this.stunts++;
      if (part.kind === "pyramid") this.pyramids++;
      if (part.kind === "stunt") this.countEnergy("fig", 2); // 1 ⚡ cada 2 figuras
      const next = this._nextKind();
      if (next) this._addPart(next);
      else part.last = true;
      if (this.parts.length > 4) this.parts.shift(); // los tramos viejos ya no hacen falta
      this._updateHud();
    }
    if (part.last && this.rt >= end - 0.05 && !this.fail) this.endT = 0.9;
  }

  /**
   * Programa los tiempos de la música un poco antes de que toquen, con el reloj del audio (no depende de cuándo se dibuja
   * el cuadro) y adelantados lo que tarda el parlante, para que se oigan justo a tiempo.
   */
  _scheduleBeats() {
    const lead = this.audioLag + 0.12;
    for (const p of this.parts) {
      if (!p.sched) p.sched = [];
      for (let b = 0; b < p.beats; b++) {
        if (p.sched[b]) continue;
        const ahead = p.t0 + b * p.spb - this.rt;
        if (ahead > lead) break;
        p.sched[b] = true;
        if (ahead < -0.06) continue; // ya pasó (por ejemplo, al volver de una pausa)
        audio.playCheerBeat(b, p.hits.some((h) => h.beat === b), Math.max(0, ahead - this.audioLag));
      }
    }
  }

  _startPart(part) {
    part.started = true;
    part.flyFrom = { ...this.fly };
    for (const m of this.squad) m.from = { x: m.x, y: m.y, z: m.z };
    if (part.kind === "pyramid") this.banner("¡Ahora la pirámide! 🔺");
  }

  /** Toque del jugador (pantalla, botón 👏 o teclado). */
  tap() {
    if (this.state !== "playing" || this.endT > 0) return;
    this.taps++;
    // el toque se mide descontando lo que esta persona (y su celular) suele atrasarse
    const raw = this.rt + clamp((performance.now() - this._rtAt) / 1000, 0, 0.05);
    const t = raw - this.offset;
    let best = null;
    for (const p of this.parts) for (const h of p.hits) {
      if (h.res || h.t - t > EARLY) continue;
      if (!best || Math.abs(h.t - t) < Math.abs(best.t - t)) best = h;
    }
    if (!best) return;
    const d = Math.abs(best.t - t);
    if (d <= GOOD + 0.08) this._learn(raw - best.t);
    if (d <= GOOD) this._judge(best, d <= PERFECT ? "perfect" : "good");
    else if (best.t > t) this._judge(best, null, "¡Muy pronto!");
  }

  /** Aprende de a poco cuánto se atrasa la persona al tocar (sonido del celular + pantalla + reflejos). */
  _learn(delta) {
    this.offset = clamp(this.offset + (delta - this.offset) * 0.3, OFFSET_RANGE[0], OFFSET_RANGE[1]);
    this.progress.porristasOffset = Math.round(this.offset * 1000) / 1000;
  }

  _judge(h, res, why) {
    h.res = res || "miss";
    this.hits[h.res]++;
    const at = new THREE.Vector3(1.6, h.y + 0.3, 0.6);
    if (res) {
      this.combo++;
      const pts = res === "perfect" ? 10 + Math.min(this.combo, 10) : 6 + Math.floor(Math.min(this.combo, 10) / 2);
      this.score += pts;
      this.popups.add(at, `${res === "perfect" ? "¡Perfecto!" : "¡Bien!"} +${pts}`, res === "perfect" ? "combo" : "kill");
      this.particles.burst(new THREE.Vector3(0, h.y, 0.4), res === "perfect" ? [0xffc800, 0xd4216c, 0xfff6e6] : [0xfff6e6, 0x7ddc4a], res === "perfect" ? 18 : 9, 4, 0.7, 6, 1);
      if (res === "perfect") audio.playCombo(Math.min(this.combo, 12));
      else audio.playBounce();
      if (this.combo >= 5 && this.combo % 5 === 0) {
        this.cheer = 1;
        this.banner(this.combo >= 20 ? `¡Súper estrella! x${this.combo} 🌟` : this.combo >= 10 ? `¡Increíble! x${this.combo} 🔥` : `¡Racha de ${this.combo}!`);
        this.haptic(40);
      }
      if (h.label === "¡Ta-dá!") {
        this.cheer = 1;
        audio.playStar();
        this.particles.burst(new THREE.Vector3(0, PYR_TOP_Y + 1, 0.4), [0xffc800, 0xd4216c, 0x2fa8d6, 0xfff6e6], 40, 6, 1.2, 5, 1.3);
        if (this.parts.find((p) => p.hits.includes(h)).hits.every((x) => x.res && x.res !== "miss")) {
          earnCoins(this.progress, 10); // pirámide sin errores: premio como el pompón dorado de antes
          this.coinsEarned += 10;
          saveProgress(this.progress);
          this.popups.add(new THREE.Vector3(-1.6, PYR_TOP_Y + 1.4, 0.6), "+10 🍫✨", "coin");
        }
      }
    } else {
      this.combo = 0;
      this.popups.add(at, why || "¡Fuera de ritmo!", "kill");
      audio.playBump();
      if (h.label === "¡Atrapa!") {
        // no alcanzaron a recibirla bien: se tambalea y se pierde un ❤️
        this.hearts--;
        this.wobble = 1;
        this.haptic(60);
        this.banner(this.hearts > 0 ? `¡Uy, casi se cae! Te quedan ${"❤️".repeat(this.hearts)}` : "¡Se cayó!");
        if (this.hearts <= 0) { this.fail = true; this.endT = 1.1; audio.playLose(); }
      }
    }
    this._renderStrip();
    this._updateHud();
  }

  /** En la tarjeta de inicio se elige entre "Infinito" y los 20 niveles. */
  onIntro() {
    renderModePicker(this.els.q("lvlpick"), { id: GAME_ID, progress: this.progress, onChange: () => this.reset() });
  }

  nextLevel() {
    campaign(this.progress, GAME_ID).selected = Math.min(LEVELS_PER_GAME, this.level + 1);
    this.particles.clear();
    this.popups.clear();
    this.state = "intro";
    this.reset();
    this.beginPlaying();
  }

  _accuracy() {
    const n = this.hits.perfect + this.hits.good + this.hits.miss;
    return n ? (this.hits.perfect + this.hits.good * 0.6) / n : 0;
  }

  _levelDone() {
    saveProgress(this.progress); // guarda el ajuste del ritmo aprendido
    if (!this.level) return;
    const ratio = this._accuracy();
    const stars = ratio >= 0.8 ? 3 : ratio >= 0.55 ? 2 : 1;
    this.cheer = 1;
    const text = `${this.stunts} figuras y la pirámide: ${this.hits.perfect} perfectos, ${this.hits.good} bien y ${this.hits.miss} fuera de ritmo. ${this.score} puntos.`;
    if (this.level >= LEVELS_PER_GAME) {
      campaignWin(this.progress, GAME_ID, this.level, stars);
      const t = this.els.q("gameover-title");
      if (t) t.textContent = `¡Completaste los ${LEVELS_PER_GAME} niveles! 🏆`;
      audio.playVictory();
      this.finish(text);
      return;
    }
    this.levelWin({ level: this.level, stars, text });
  }

  _onFail() {
    saveProgress(this.progress);
    this.cheer = 0;
    const t = this.els.q("gameover-title");
    if (t) t.textContent = "¡Se cayó!";
    this.finish(`${this.level ? `Nivel ${this.level}: ` : ""}hiciste ${this.stunts} figuras y ${this.score} puntos` + (this.coinsEarned > 0 ? `, ganando ${this.coinsEarned} Matipuntos.` : "."));
  }

  _updateHud() {
    this.els.hudScore.textContent = this.goal ? `${Math.min(this.stunts, this.goal)}/${this.goal}` : String(this.score);
    this.els.hudCombo.textContent = String(this.combo);
    this.els.hudCoins.textContent = String(this.progress.coins);
    const hearts = this.els.q && this.els.q("hearts");
    if (hearts) hearts.textContent = "❤️".repeat(Math.max(0, this.hearts)) + "🤍".repeat(Math.max(0, HEARTS - this.hearts));
  }

  /** La barrita de abajo: los 8 tiempos del tramo, el que suena ahora y en cuáles hay que tocar. */
  _renderStrip() {
    const wrap = this.els.q && this.els.q("rhythm");
    if (!wrap) return;
    const part = this.parts.length ? this._part() : null;
    if (!part) return;
    const beats = this.els.q("beats");
    const now = part.lastBeat;
    let html = "";
    for (let b = 0; b < part.beats; b++) {
      const h = part.hits.find((x) => x.beat === b);
      const cls = ["pr-beat", b === now ? "now" : "", h ? "hit" : "", h && h.res ? h.res : ""].join(" ");
      html += `<span class="${cls}">${h ? h.icon : part.kind === "count" ? b + 5 : b + 1}</span>`;
    }
    beats.innerHTML = html;
    const next = part.hits.find((x) => !x.res) || this.parts.flatMap((p) => p.hits).find((x) => !x.res);
    this.els.q("cue").textContent = part.kind === "count" ? "¡Prepárate! 5, 6, 7, 8…" : next ? `Toca en ${next.icon}: ${next.label}` : part.hits.some((x) => x.res === "miss") ? "¡Sigue el ritmo!" : "¡Bien hecho!";
  }

  // ---------- sincronizar 3D ----------

  _showStrip(vis) {
    if (vis === this._stripVis || !this.els.q) return;
    this._stripVis = vis;
    const wrap = this.els.q("rhythm");
    if (wrap) wrap.classList.toggle("hidden", !vis);
  }

  _sync(dt) {
    this._showStrip(this.state === "playing" && !(this.endT > 0));
    const playing = (this.state === "playing" || this.endT > 0) && this.parts.length;
    const part = playing ? this._part() : null;
    const u = part ? clamp((this.rt - part.t0) / part.spb, 0, part.beats) : 0;
    this._squadPose(dt, part, u);
    this._flyerPose(part, u);
    this._flushSquad();
    this._cue(part);
  }

  /** Dónde va cada compañera según el tramo y el tiempo (u en tiempos dentro del tramo). */
  _squadPose(dt, part, u) {
    const sq = this.squad;
    if (!sq) return;
    const t = this.time;
    const kind = part ? part.kind : "idle";
    const wob = this.wobble * Math.sin(t * 22) * 0.12;
    // formación de las figuras: bases enfrentadas, la de atrás y las dos de los lados
    const home = [
      { x: -0.62, z: 0.05, yaw: Math.PI / 2 }, { x: 0.62, z: 0.05, yaw: -Math.PI / 2 }, { x: 0, z: -0.72, yaw: 0 },
      { x: -3.1, z: 0.5, yaw: 0.25 }, { x: 3.1, z: 0.5, yaw: -0.25 },
    ];
    const hands = this._handY(part, u);
    sq.forEach((m, i) => {
      let tx = home[i].x, ty = 0, tz = home[i].z, yaw = home[i].yaw;
      let dip = 0, aL = 0.2, aR = 0.2, sL = -0.15, sR = 0.15, leg = 0;
      if (kind === "pyramid") {
        const k1 = ease(clamp(u, 0, 1)), k2 = ease(clamp(u - 2, 0, 1));
        if (i < 3) {
          // fila de abajo: las tres de frente, hombro con hombro, brazos arriba sujetando a las de arriba
          const px = [-1.25, 1.25, 0][i];
          tx = lerp(m.from.x, px, k1); tz = lerp(m.from.z, 0.05, k1); yaw = lerp(home[i].yaw, 0, k1);
          dip = 0.12 * k1;
          aL = aR = lerp(0.2, 2.95, k2);
          sL = -0.05; sR = 0.05;
        } else {
          // fila del medio: se acercan por atrás, suben a los hombros y estiran el brazo de afuera
          const px = i === 3 ? -0.62 : 0.62;
          const k0 = ease(clamp(u - 0.6, 0, 1.4) / 1.4);
          tx = lerp(m.from.x, px, k0); tz = lerp(m.from.z, -0.45, k0); yaw = lerp(home[i].yaw, 0, k0);
          ty = PYR_MID_Y * k2 + Math.sin(k2 * Math.PI) * 0.6;
          tz = lerp(tz, 0.02, k2);
          const inner = lerp(0.3, 3.0, ease(clamp(u - 4, 0, 1)));
          const outer = lerp(0.3, 2.45, k2);
          if (i === 3) { aR = inner; sR = 0.35; aL = 0; sL = -outer; } else { aL = inner; sL = -0.35; aR = 0; sR = outer; }
          leg = Math.sin(k2 * Math.PI) * -0.8;
        }
        if (u > 7) { const c = Math.sin(t * 9) * 0.15; sL -= c; sR += c; }
      } else if (i < 3) {
        // bases y la de atrás: las manos siguen a los pies de la voladora
        if (part && part.flyFrom && kind !== "count" && m.from) {
          const k = ease(clamp(u, 0, 1));
          tx = lerp(m.from.x, home[i].x, k); tz = lerp(m.from.z, home[i].z, k); ty = lerp(m.from.y, 0, k);
        }
        dip = hands.dip;
        const reach = armFor(hands.y, SHOULDER - dip);
        aL = aR = i === 2 ? Math.min(reach + 0.1, 3) : reach;
        sL = -0.08; sR = 0.08;
        if (hands.free) { aL = aR = 0.25; sL = -0.25 - Math.max(0, Math.sin(t * 8)) * 0.6; sR = -sL; }
      } else {
        // las de los lados animan: saltitos al ritmo y pompones arriba
        if (part && m.from && kind !== "count") {
          const k = ease(clamp(u, 0, 1));
          tx = lerp(m.from.x, home[i].x, k); tz = lerp(m.from.z, home[i].z, k); ty = lerp(m.from.y, 0, k);
        }
        const bt = part ? (u % 1) : (t * 1.6) % 1;
        const hop = Math.max(0, Math.sin(bt * Math.PI)) * (0.12 + this.cheer * 0.35);
        ty += hop;
        sL = -2.3 - Math.sin(t * 6 + i) * 0.4; sR = 2.3 + Math.sin(t * 6 + i) * 0.4;
        aL = aR = 0.3;
        leg = hop * 1.5;
      }
      m.x = tx + (i < 2 ? wob : 0); m.y = ty; m.z = tz; m.yaw = yaw;
      const spread = Math.acos(clamp((0.75 - dip / SQ) / 0.75, -1, 1));
      for (const lg of m.legs) lg.position.y = 0.75 - dip / SQ;
      m.legs[0].rotation.set(leg, 0, -spread);
      m.legs[1].rotation.set(-leg, 0, spread);
      m.hips.position.y = 0.75 - dip / SQ;
      m.hips.rotation.x = dip * 0.6;
      m.head.rotation.x = -dip * 0.5;
      m.arms[0].rotation.set(-aL, 0, sL);
      m.arms[1].rotation.set(-aR, 0, sR);
    });
  }

  /** Altura de las manos de las bases (y cuánto se agachan) en un tramo de figura. free = tienen las manos libres. */
  _handY(part, u) {
    const kind = part ? part.kind : "idle";
    if (kind === "idle" || kind === "count") return { y: HOLD_Y + Math.sin(this.time * 4) * 0.03, dip: 0.05 };
    if (kind !== "stunt") return { y: HOLD_Y, dip: 0 };
    if (u < 1.4) return { y: lerp(HOLD_Y, HOLD_Y - 0.25, ease(clamp(u / 1.4, 0, 1))), dip: 0.28 * ease(clamp(u / 1.4, 0, 1)) }; // cargan
    if (u < 2) { const k = ease((u - 1.4) / 0.6); return { y: lerp(HOLD_Y - 0.25, EXT_Y, k), dip: 0.28 * (1 - k) }; } // ¡arriba!
    if (u < 2.6) return { y: lerp(EXT_Y, HOLD_Y, ease((u - 2) / 0.6)), dip: 0 };
    if (u < 5) return { y: HOLD_Y, dip: 0, free: u > 2.6 && u < 4.8 };
    if (u < 6) return { y: lerp(HOLD_Y, EXT_Y, ease(u - 5)), dip: 0 }; // preparan los brazos para recibirla
    if (u < 7) { const k = ease(u - 6); return { y: lerp(EXT_Y, HOLD_Y, k), dip: 0.25 * Math.sin(k * Math.PI) }; } // la reciben y amortiguan
    return { y: HOLD_Y, dip: 0 };
  }

  /** La voladora: parada en las manos, en el aire (con su figura) o en la cima de la pirámide. */
  _flyerPose(part, u) {
    const h = this.hero;
    if (!h) return;
    const kind = part ? part.kind : "idle";
    let x = 0, y = HOLD_Y, z = 0.05, rx = 0, ry = 0, rz = 0, mode = "cheer";
    let legsZ = [0, 0], legsX = null, armsZ = null;
    if (kind === "stunt") {
      const hands = this._handY(part, u);
      const figHit = part.hits[1];
      if (u < 2) { y = hands.y; mode = u > 1.3 ? "jump" : "idle"; }
      else if (u < 6) {
        const k = (u - 4) / 2;
        y = EXT_Y + PEAK * (1 - k * k);
        mode = "jump";
        const f = clamp((u - 3.3) / 1.6, 0, 1); // la figura dura de 3,3 a 4,9 tiempos
        if (f > 0 && f < 1 && figHit.res && figHit.res !== "miss") {
          const id = part.fig.id;
          const s = Math.sin(f * Math.PI);
          if (id === "estrella") { armsZ = [-2.4 * s - 0.2, 2.4 * s + 0.2]; legsZ = [-0.6 * s, 0.6 * s]; legsX = [0, 0]; }
          else if (id === "giro") { ry = ease(f) * Math.PI * 2; armsZ = [-0.25, 0.25]; legsX = [0, 0]; }
          else if (id === "doble") { ry = ease(f) * Math.PI * 4; armsZ = [-0.2, 0.2]; legsX = [0, 0]; }
          else if (id === "split") { legsX = [-1.45 * s, 1.35 * s]; armsZ = [-1.6, 1.6]; }
          else if (id === "mortal") { rx = -ease(f) * Math.PI * 2; legsX = [-1.3 * s, -1.3 * s]; }
        }
      } else { y = hands.y; mode = u < 7 ? "jump" : "cheer"; }
      if (this.wobble > 0) rz = Math.sin(this.time * 18) * 0.35 * this.wobble;
    } else if (kind === "pyramid") {
      // baja de un saltito a la colchoneta (adelante) mientras se arma la base, y en el 5 salta a la cima
      const from = part.flyFrom || this.fly;
      if (u < 1) { const k = ease(u); y = lerp(from.y, 0, k) + Math.sin(k * Math.PI) * 0.5; z = lerp(from.z, 0.95, k); mode = "jump"; }
      else if (u < 4) { y = 0; z = 0.95; mode = "cheer"; }
      else if (u < 5) { const k = ease(u - 4); y = lerp(0, PYR_TOP_Y, k) + Math.sin(k * Math.PI) * 1.2; z = lerp(0.95, -0.1, k); mode = "jump"; }
      else { y = PYR_TOP_Y; z = -0.1; mode = u > 7 ? "cheer" : "idle"; if (u > 5 && u < 7) armsZ = [-2.3, 2.3]; }
    } else {
      // tramo de cuenta / antes de empezar: arriba de las manos, animando; al pasar de la pirámide a una figura, baja
      if (part && part.flyFrom && part.flyFrom.y > HOLD_Y + 0.5) {
        const k = ease(clamp(u, 0, 1));
        y = lerp(part.flyFrom.y, HOLD_Y, k) + Math.sin(k * Math.PI) * 0.5;
      }
    }
    if (kind === "stunt" && part.flyFrom && part.flyFrom.y > HOLD_Y + 0.5 && u < 1.4) {
      // venía de la cima de la pirámide: baja de un salto a las manos de las bases
      const k = ease(clamp(u / 1.2, 0, 1));
      y = lerp(part.flyFrom.y, y, k) + Math.sin(k * Math.PI) * 0.5;
      z = lerp(part.flyFrom.z, z, k);
    }
    if (this.fail && this.endT > 0) {
      // se cae a la colchoneta
      const k = clamp(1 - this.endT / 1.1, 0, 1);
      y = lerp(this.fly.y, 0.1, ease(k));
      mode = "sad";
      rz = 0.4 * k;
    } else this.fly = { x, y, z };
    this.heroPivot.position.set(x, y + 0.95 + 0.08, z);
    this.heroPivot.rotation.set(rx, ry, rz);
    h.group.rotation.y = 0;
    h.animate(this.time, this.state === "gameover" ? "sad" : mode, 1);
    if (legsX) { h.legs[0].rotation.x = legsX[0]; h.legs[1].rotation.x = legsX[1]; }
    h.legs[0].rotation.z = legsZ[0];
    h.legs[1].rotation.z = legsZ[1];
    if (armsZ) { h.arms[0].rotation.set(0, 0, armsZ[0]); h.arms[1].rotation.set(0, 0, armsZ[1]); }
  }

  /** El aro que se cierra hacia el próximo toque (desde un tiempo y medio antes). */
  _cue(part) {
    const next = part && this.state === "playing" && this.endT <= 0 ? this.parts.flatMap((p) => p.hits).find((x) => !x.res) : null;
    const spb = part ? part.spb : 0.6;
    const lead = next ? (next.t - this.rt) / (spb * 1.5) : 2;
    const show = next && lead <= 1 && lead > -0.4;
    this.cueRing.visible = this.cueTarget.visible = !!show;
    if (!show) return;
    const r = 0.75;
    this.cueTarget.position.set(0, next.y, 0.9);
    this.cueTarget.scale.setScalar(r);
    this.cueRing.position.set(0, next.y, 0.9);
    this.cueRing.scale.setScalar(r * (1 + Math.max(0, lead) * 1.8));
    const near = Math.abs(next.t - this.rt) <= GOOD;
    this.cueRing.material.color.setHex(near ? 0x7ddc4a : next.label === "¡Atrapa!" ? 0x4fd0ff : 0xffc800);
    this.cueTarget.material.opacity = near ? 0.9 : 0.45;
  }

  // ---------- entrada ----------

  async init() {
    const first = !this.ready;
    await super.init();
    if (first) this._bindInput();
  }

  beginPlaying() {
    super.beginPlaying();
    this.audioLag = clamp(audio.latency(), 0, MAX_LAG); // recién aquí existe el audio (después de tocar «¡Vamos!»)
    this._showStrip(this.state === "playing");
    this._renderStrip();
  }

  _bindInput() {
    window.addEventListener("keydown", (e) => {
      if (!this.running || e.repeat) return;
      if ([" ", "Spacebar", "Enter", "ArrowUp", "ArrowDown", "w", "W", "s", "S"].includes(e.key)) {
        if (this.state === "playing") e.preventDefault();
        this.tap();
      }
    });
    const btn = document.getElementById("porristas-btn-tap");
    if (btn) btn.addEventListener("pointerdown", (e) => { e.preventDefault(); this.tap(); });
    this.els.canvas.addEventListener("pointerdown", () => this.tap());
  }
}
