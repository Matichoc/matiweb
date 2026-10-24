// Fútbol Choco 3D: tres modos en el mismo juego.
//   🥅 Penales: tanda de 5 tiros contra un arquero que cada nivel lee mejor tus tiros.
//   🎯 Tiros libres: la pelota está lejos, hay una barrera de defensas (que a veces saltan) y un arquero.
//   🧤 Atajapenales: ahora tú eres el arquero: mira al delantero (¡su cuerpo avisa a qué lado va a patear!) y toca dónde lanzarte.
// Cada modo tiene 20 niveles con estrellas, divididos en 4 copas de 5 partidos con rivales con nombre.
// Tiros y tiros libres: efecto (curva) con los botones ↶ ↷ (o Q / E) y dianas doradas en los ángulos del arco.
//
// Cómo se patea (mouse, dedo o teclado): se mueve el puntero para apuntar a un lugar del arco, se MANTIENE apretado
// para cargar la potencia y se SUELTA para patear. Con potencia alta la pelota va rápida y plana (pero se puede ir
// afuera); con potencia baja va lenta y en arco (así se pasa por encima de la barrera, pero el arquero llega).

import { THREE, Game3D, clamp, lerp, rand, canvasTexture, makeBunting, makeLogo } from "./three-kit.js?v=b28a0715a9";
import { createMatichico } from "./matichico3d.js?v=b28a0715a9";
import { CHARACTERS, getOutfit } from "./characters.js?v=b28a0715a9";
import { saveProgress } from "./storage.js?v=b28a0715a9";
import * as audio from "./audio.js?v=b28a0715a9";
import { campaign, campaignWin, renderLevelPicker, LEVELS_PER_GAME } from "./campaign.js?v=b28a0715a9";

const GAME_ID = "futbol";
const GW = 6; // ancho del arco
const GH = 2.2; // alto del arco
const POST_R = 0.07;
const BALL_R = 0.22;
const G = 9.8;
const KEEPER_Z = 0.3; // dónde se para el arquero (delante de la línea)
const KICKS = 5;
const PEN_Z = 9; // distancia del penal
const MODES = {
  pen: { id: "futbol_pen", name: "Penales", icon: "🥅" },
  tl: { id: "futbol_tl", name: "Tiros libres", icon: "🎯" },
  ata: { id: "futbol_ata", name: "Atajapenales", icon: "🧤" },
};
// cuatro copas de cinco partidos: el último de cada copa es la final
const CUPS = [
  { cup: "Copa Alfajor", keeper: "Guantes de Seda", striker: "Tito Tiro", jersey: 0xff8a1f },
  { cup: "Copa Frambuesa", keeper: "Muralla Frambuesa", striker: "Pancho Cañón", jersey: 0xd4216c },
  { cup: "Copa Menta", keeper: "Pulpo Menta", striker: "Rayo Verde", jersey: 0x2fd08a },
  { cup: "Copa Cacao de Oro", keeper: "El Gigante Dorado", striker: "Don Misil", jersey: 0xffc800 },
];
const cupOf = (level) => CUPS[Math.min(CUPS.length - 1, Math.floor((level - 1) / 5))];
const DIANA = { x: 2.45, y: 1.72, r: 0.46 }; // dianas doradas en los ángulos del arco
const CURL_DEV = { pen: 0.9, tl: 1.9 }; // cuánto se abre la curva a mitad de camino (m)

const ping = (x) => 1 - Math.abs(((x % 2) + 2) % 2 - 1); // 0 → 1 → 0

/** Lo que pide cada nivel (1 a 20) en cada modo. */
function levelSpec(mode, level) {
  const t = (level - 1) / (LEVELS_PER_GAME - 1);
  if (mode === "pen") {
    return {
      need: 2, // goles que hay que meter de 5 (la dificultad sube con el arquero, no con la meta: así no hay saltos bruscos)
      read: lerp(0.08, 0.34, t), // qué tan seguido el arquero adivina a dónde vas
      react: lerp(0.4, 0.14, t),
      speed: lerp(3.4, 7.2, t),
      leap: t > 0.3,
      wobble: 0.02 + 0.1 * t, // temblor de la mira
      wall: 0,
    };
  }
  if (mode === "ata") {
    return {
      need: 2, // atajadas que hay que lograr de 5 tiros (la dificultad sube con el tiro, no con la meta)
      T: lerp(1.3, 0.85, t), // lo que demora la pelota en llegar al arco
      tell: lerp(1, 0.5, t), // qué tan claro avisa el delantero con su cuerpo
      feint: lerp(0, 0.3, t), // probabilidad de que el delantero te engañe
      corner: lerp(0.25, 0.6, t), // tiros a los ángulos
      reach: lerp(1.25, 1.02, t), // alcance de tus guantes
    };
  }
  return {
    need: 1,
    read: lerp(0.05, 0.3, t),
    react: lerp(0.45, 0.16, t),
    speed: lerp(3.2, 7, t),
    leap: t > 0.35,
    wobble: 0.03 + 0.1 * t,
    wall: 2 + Math.floor(t * 3.5), // defensas en la barrera (2 a 5)
    jump: t > 0.35 ? 0.15 + 0.35 * t : 0, // probabilidad de que cada defensa salte
  };
}

function pitchTexture() {
  // 40 x 40 m: línea de gol en z = 6 de la textura (6 m detrás del arco empieza el pasto); bandas de pasto
  return canvasTexture(2048, 2048, (g, w, h) => {
    const mx = (x) => ((x + 20) / 40) * w;
    const mz = (z) => ((z + 6) / 40) * h; // z de mundo: -6 (fondo) a 34 (cerca de la cámara)
    for (let i = 0; i < 20; i++) {
      g.fillStyle = i % 2 ? "#3f9a45" : "#37903d";
      g.fillRect(0, (i * h) / 20, w, h / 20 + 1);
    }
    g.strokeStyle = "rgba(255,255,255,0.92)";
    g.lineWidth = 9;
    g.lineJoin = "round";
    g.beginPath(); g.moveTo(mx(-20), mz(0)); g.lineTo(mx(20), mz(0)); g.stroke(); // línea de gol
    g.strokeRect(mx(-5), mz(0), mx(5) - mx(-5), mz(3.2) - mz(0)); // área chica
    g.strokeRect(mx(-12), mz(0), mx(12) - mx(-12), mz(13.5) - mz(0)); // área grande
    g.beginPath(); g.arc(mx(0), mz(PEN_Z), 7, 0.22 * Math.PI, 0.78 * Math.PI); g.stroke(); // medialuna (aprox.)
    g.fillStyle = "#fff";
    g.beginPath(); g.arc(mx(0), mz(PEN_Z), 11, 0, Math.PI * 2); g.fill(); // punto penal
    g.fillStyle = "rgba(255,255,255,0.9)";
    g.font = '80px "Baby Chipmunk", sans-serif';
    g.textAlign = "center";
    g.fillText("MATICHOC", mx(0), mz(22));
  });
}

function ballTexture() {
  return canvasTexture(512, 256, (g, w, h) => {
    g.fillStyle = "#fff6e6";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#3a1a08";
    const pent = (cx, cy, r) => {
      g.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      g.closePath();
      g.fill();
    };
    for (const [x, y] of [[0.12, 0.3], [0.37, 0.7], [0.62, 0.3], [0.87, 0.7], [0.5, 0.12], [0.25, 0.9], [0.75, 0.9]]) pent(w * x, h * y, 28);
    g.fillStyle = "#D4216C";
    pent(w * 0.5, h * 0.55, 20);
  });
}

function crowdTexture() {
  return canvasTexture(1024, 256, (g, w, h) => {
    g.fillStyle = "#2a1713";
    g.fillRect(0, 0, w, h);
    const cols = ["#d4216c", "#ffc800", "#fff6e6", "#8a5a36", "#cfd767", "#3b8cff", "#ff8a2a", "#64321b"];
    for (let i = 0; i < 1500; i++) {
      g.fillStyle = cols[Math.floor(Math.random() * cols.length)];
      g.beginPath();
      g.arc(Math.random() * w, Math.random() * h, 5 + Math.random() * 4, 0, Math.PI * 2);
      g.fill();
    }
  });
}

function netTexture() {
  return canvasTexture(256, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = "rgba(255,255,255,0.75)";
    g.lineWidth = 2;
    for (let x = 0; x <= w; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y <= h; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  });
}

export class FutbolGame extends Game3D {
  constructor(character, progress, els) {
    super(GAME_ID, character, progress, els, { fov: 48 });
    this.kawaii = true; // ambiente kawaii: pastel, sombreado por tonos, pétalos y estrellitas
    this.ambientOpts = { petals: 28, hearts: 5, stars: 18, radius: 12, height: 9 };
    this.musicTheme = "sport";
    this.q = els.q;
    this.mode = "pen";
    this.level = 1;
    this.phase = "idle";
    this.aim = { x: 0, y: 1.1 };
    this.pointer = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();
    this.goalPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    this.camPos = new THREE.Vector3(0, 2.2, PEN_Z + 3.6);
    this.camLook = new THREE.Vector3(0, 1.2, 0);
    this.net = { t: 0, x: 0, y: 1 };
    this.keys = {};
    this.charging = false;
  }

  // ---------- escena ----------

  async build() {
    const s = this.scene;
    s.background = new THREE.Color(0x6aa8d8);
    s.fog = new THREE.Fog(0x9cc6e4, 40, 95);

    s.add(new THREE.HemisphereLight(0xfff6e0, 0x4a7a40, 1.15));
    this.sun = new THREE.DirectionalLight(0xfff0d2, 2.4);
    this.sun.position.set(-8, 16, 14);
    this.sun.castShadow = true;
    const sm = this.coarse ? 1024 : 2048;
    this.sun.shadow.mapSize.set(sm, sm);
    const sc = this.sun.shadow.camera;
    sc.left = -13; sc.right = 13; sc.top = 15; sc.bottom = -15; sc.near = 1; sc.far = 60;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.04;
    s.add(this.sun, this.sun.target);
    this.sun.target.position.set(0, 0, 9);
    this.onLowQuality = () => { this.sun.castShadow = false; };

    this.m = {
      white: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.2 }),
      gold: new THREE.MeshStandardMaterial({ color: 0xffc800, roughness: 0.3, metalness: 0.6, emissive: 0x6a4a00, emissiveIntensity: 0.35 }),
      pink: new THREE.MeshStandardMaterial({ color: 0xd4216c, roughness: 0.45 }),
      cone: new THREE.MeshStandardMaterial({ color: 0xff6a1a, roughness: 0.5 }),
    };

    const pitch = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ map: pitchTexture(), roughness: 0.95 }));
    pitch.rotation.x = -Math.PI / 2;
    pitch.position.set(0, 0, 14);
    pitch.receiveShadow = true;
    s.add(pitch);
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), new THREE.MeshStandardMaterial({ color: 0x2f7a38, roughness: 1 }));
    outer.rotation.x = -Math.PI / 2;
    outer.position.set(0, -0.02, 14);
    s.add(outer);

    this._buildGoal();
    this._buildStadium();
    // el logo de Matichoc en el centro de la cancha (en el pasto, mirando al cielo) y grande en la tribuna del fondo
    const lg = makeLogo(7);
    lg.rotation.x = -Math.PI / 2;
    lg.position.set(0, 0.03, 25);
    s.add(lg);
    const lg2 = makeLogo(5.5);
    lg2.position.set(0, 3.3, -6.25);
    s.add(lg2);

    // pelota y sombra
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 28, 20), new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: 0.5 }));
    this.ball.castShadow = true;
    s.add(this.ball);
    this.ballV = new THREE.Vector3();
    this.ballShadow = new THREE.Mesh(new THREE.CircleGeometry(0.3, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false }));
    this.ballShadow.rotation.x = -Math.PI / 2;
    s.add(this.ballShadow);

    // mira (anillo en el plano del arco)
    this.reticle = new THREE.Group();
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffc800, depthTest: false, transparent: true, opacity: 0.95 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.035, 8, 32), ringMat);
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.05, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false }));
    ring.renderOrder = 10;
    dot.renderOrder = 10;
    this.reticle.add(ring, dot);
    this.reticle.position.set(0, 1.1, 0.05);
    s.add(this.reticle);

    // dianas doradas en los ángulos: dan puntos extra
    this.dianas = new THREE.Group();
    for (const sx of [-1, 1]) {
      const d = new THREE.Group();
      for (const [r0, r1, col] of [[0.14, 0.2, 0xffc800], [0.3, 0.37, 0xffffff], [0.4, 0.46, 0xd4216c]]) {
        d.add(new THREE.Mesh(new THREE.RingGeometry(r0, r1, 28), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8, depthWrite: false })));
      }
      d.add(new THREE.Mesh(new THREE.CircleGeometry(0.1, 14), new THREE.MeshBasicMaterial({ color: 0xffc800, transparent: true, opacity: 0.9, depthWrite: false })));
      d.position.set(sx * DIANA.x, DIANA.y, 0.04);
      this.dianas.add(d);
    }
    s.add(this.dianas);
    // puntitos que muestran la curva del efecto
    this.pathDots = [];
    const dotGeo = new THREE.SphereGeometry(0.075, 8, 6);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xfff6e6, transparent: true, opacity: 0.9, depthTest: false });
    for (let i = 0; i < 16; i++) { const d = new THREE.Mesh(dotGeo, dotMat); d.renderOrder = 9; d.visible = false; s.add(d); this.pathDots.push(d); }
    this.curl = 0;

    // arquero
    this.keeper = this._makePlayer("baller", 0xff8a1f, 1.32);
    this.keeper.group.position.set(0, 0, KEEPER_Z);
    this.keeperPos = { x: 0, dive: 0, leap: 0, dir: 0 };
    this.wall = [];
    this.shooter = this._makePlayer("estrella", 0xd4216c, 1.15); // el delantero rival del modo atajapenales
    this.shooter.group.visible = false;
    this._ensureHero();
  }

  _makePlayer(charId, jersey, scale = 1) {
    const ch = CHARACTERS.find((c) => c.id === charId) || CHARACTERS[0];
    const p = createMatichico(ch, getOutfit("polera"));
    p.setOutfit({ jersey, trim: 0xffffff });
    p.group.scale.setScalar(scale);
    p.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.scene.add(p.group);
    return p;
  }

  _ensureHero() {
    if (this.hero && this.heroId === this.character.id) {
      this.hero.setLook(this.look);
      return;
    }
    if (this.hero) this.scene.remove(this.hero.group);
    this.hero = createMatichico(this.character, this.outfit, this.look);
    this.heroId = this.character.id;
    this.hero.group.scale.setScalar(1.1);
    this.hero.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.scene.add(this.hero.group);
  }

  _buildGoal() {
    const s = this.scene;
    const goal = new THREE.Group();
    const post = (x, h) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(POST_R, POST_R, h, 12), this.m.white);
      m.position.set(x, h / 2, 0);
      m.castShadow = true;
      goal.add(m);
    };
    post(-GW / 2, GH);
    post(GW / 2, GH);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(POST_R, POST_R, GW + POST_R * 2, 12), this.m.white);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, GH, 0);
    bar.castShadow = true;
    goal.add(bar);
    // redes: fondo (se mueve cuando entra un gol), techo y costados
    const nt = netTexture();
    nt.wrapS = nt.wrapT = THREE.RepeatWrapping;
    const netMat = new THREE.MeshBasicMaterial({ map: nt, transparent: true, side: THREE.DoubleSide, depthWrite: false });
    const DEPTH = 1.8;
    nt.repeat.set(GW / 0.9, GH / 0.9);
    this.netBack = new THREE.Mesh(new THREE.PlaneGeometry(GW, GH, 14, 8), netMat);
    this.netBack.position.set(0, GH / 2, -DEPTH);
    this.netBackBase = Float32Array.from(this.netBack.geometry.attributes.position.array);
    goal.add(this.netBack);
    const nt2 = nt.clone();
    nt2.needsUpdate = true;
    nt2.wrapS = nt2.wrapT = THREE.RepeatWrapping;
    nt2.repeat.set(DEPTH / 0.9, GH / 0.9);
    const sideMat = new THREE.MeshBasicMaterial({ map: nt2, transparent: true, side: THREE.DoubleSide, depthWrite: false });
    for (const sx of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.PlaneGeometry(DEPTH, GH), sideMat);
      side.rotation.y = Math.PI / 2;
      side.position.set(sx * GW / 2, GH / 2, -DEPTH / 2);
      goal.add(side);
    }
    const nt3 = nt.clone();
    nt3.needsUpdate = true;
    nt3.wrapS = nt3.wrapT = THREE.RepeatWrapping;
    nt3.repeat.set(GW / 0.9, DEPTH / 0.9);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(GW, DEPTH), new THREE.MeshBasicMaterial({ map: nt3, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    top.rotation.x = Math.PI / 2;
    top.position.set(0, GH, -DEPTH / 2);
    goal.add(top);
    this.goalDepth = DEPTH;
    this.netShell = [top, ...goal.children.filter((c) => c.rotation.y === Math.PI / 2)];
    s.add(goal);
  }

  _buildStadium() {
    const s = this.scene;
    const crowd = crowdTexture();
    crowd.wrapS = crowd.wrapT = THREE.RepeatWrapping;
    crowd.repeat.set(5, 1.5);
    this.crowdTex = crowd;
    const crowdMat = new THREE.MeshBasicMaterial({ map: crowd, color: 0xaaaaaa });
    // tribuna del fondo (inclinada) y las laterales
    const back = new THREE.Mesh(new THREE.PlaneGeometry(70, 12), crowdMat);
    back.position.set(0, 6.2, -11);
    back.rotation.x = -0.38;
    s.add(back);
    for (const sx of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.PlaneGeometry(50, 10), crowdMat);
      side.position.set(sx * 22, 5.2, 12);
      side.rotation.set(-0.2, -sx * Math.PI / 2 + sx * 0.4, 0);
      s.add(side);
    }
    // vallas de publicidad
    const mkBoard = (x, z, ry, text, color) => {
      const b = new THREE.Mesh(
        new THREE.PlaneGeometry(5.2, 1.1),
        new THREE.MeshStandardMaterial({
          map: canvasTexture(512, 108, (g, w, h) => {
            g.fillStyle = color; g.fillRect(0, 0, w, h);
            g.fillStyle = "#FFF6E6"; g.font = '70px "Baby Chipmunk", sans-serif'; g.textAlign = "center"; g.textBaseline = "middle";
            g.fillText(text, w / 2, h / 2 + 4);
          }),
          roughness: 0.6,
        }),
      );
      b.position.set(x, 0.55, z);
      b.rotation.y = ry;
      s.add(b);
    };
    [-12, -6.4, -0.8, 4.8, 10.4].forEach((x, i) => mkBoard(x, -6.3, 0, i % 2 ? "ALFAJORES" : "MATICHOC", i % 2 ? "#3d1f10" : "#D4216C"));
    s.add(makeBunting(new THREE.Vector3(-16, 4.2, -6.2), new THREE.Vector3(16, 4.2, -6.2), { count: 30, sag: 1.2, size: 0.5 }));
    // focos del estadio (brillan con el bloom)
    const lamp = new THREE.MeshBasicMaterial({ color: 0xfff3d6 });
    for (const x of [-18, 18]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 16, 8), new THREE.MeshStandardMaterial({ color: 0x555555 }));
      pole.position.set(x, 8, -4);
      const head = new THREE.Mesh(new THREE.BoxGeometry(4, 1.4, 0.4), lamp);
      head.position.set(x, 16.4, -3.8);
      s.add(pole, head);
    }
  }

  // ---------- partida ----------

  reset() {
    const modeId = this._modeKey();
    this.mode = modeId;
    this.missionId = MODES[modeId].id; // levelWin() guarda las estrellas en la campaña de este modo
    const c = campaign(this.progress, MODES[modeId].id);
    this.level = Math.min(c.selected || c.unlocked, c.unlocked);
    this.spec = levelSpec(modeId, this.level);
    this.cup = cupOf(this.level);
    this.keeper.setOutfit({ jersey: this.cup.jersey, trim: 0xffffff });
    this.shooter.setOutfit({ jersey: this.cup.jersey, trim: 0xffffff });
    this.keeper.group.visible = modeId !== "ata";
    this.shooter.group.visible = modeId === "ata";
    this.dianas.visible = modeId !== "ata";
    for (const n of this.netShell) n.visible = modeId !== "ata";
    this.netBack.visible = modeId !== "ata";
    this.curl = 0;
    this.dive = null;
    this.dianaHits = 0;
    this.kickIdx = 0;
    this.goals = 0;
    this.results = [];
    this.score = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.saves = 0;
    this.phase = "idle";
    this.charging = false;
    this.power = 0;
    this.aim.x = 0;
    this.aim.y = 1.1;
    this.net.t = 0;
    this.shake = 0;
    this._ensureHero();
    this._buildWall();
    this._setupKick();
    this._updateHud();
  }

  _modeKey() {
    const m = this.progress.futbolMode;
    return m === "tl" || m === "ata" ? m : "pen";
  }

  /** Ubica la pelota, el Matichico y la barrera para el siguiente tiro. */
  _setupKick() {
    if (this.mode === "ata") { this._setupAta(); return; }
    this.curl = 0;
    this._syncCurlUi();
    this.hero.group.rotation.set(0, 0, 0);
    const pen = this.mode === "pen";
    let bx = 0;
    let bz = PEN_Z;
    if (!pen) {
      // tiro libre: lejos del arco, a un lado u otro
      const side = this.kickIdx % 2 === 0 ? 1 : -1;
      bx = side * rand(2.5, 9) * (this.kickIdx === 0 ? 0.6 : 1);
      bz = rand(14, 19);
    }
    this.ballStart = new THREE.Vector3(bx, BALL_R, bz);
    this.ball.position.copy(this.ballStart);
    this.ballV.set(0, 0, 0);
    this.ballLive = false;
    this.resultT = 0;
    // dirección de la pelota al arco: el Matichico se para detrás
    const dir = new THREE.Vector3(-bx, 0, -bz).normalize();
    this.shotDir = dir;
    const side = new THREE.Vector3(dir.z, 0, -dir.x); // a la izquierda de la pelota, para no taparla
    this.heroHome = new THREE.Vector3(bx - dir.x * 1.7 + side.x * 0.95, 0, bz - dir.z * 1.7 + side.z * 0.95);
    this.hero.group.position.copy(this.heroHome);
    this.hero.group.rotation.y = Math.atan2(dir.x, dir.z);
    this.kickAnim = -1;
    this.runT = -1;
    // arquero: vuelve al centro
    this.keeperPos = { x: 0, dive: 0, leap: 0, dir: 0, target: 0, start: 0, diveT: -1, diveDur: 0.3, goalX: 0 };
    this.keeper.group.position.set(0, 0, KEEPER_Z);
    this.keeper.group.rotation.set(0, 0, 0);
    // barrera de defensas (solo tiros libres)
    this._placeWall();
    this.camTarget = this._camFor();
    if (!this.camInit) { this.camPos.copy(this.camTarget.pos); this.camLook.copy(this.camTarget.look); this.camInit = true; }
    this.aim.x = clamp(this.aim.x, -3.6, 3.6);
    this.phase = "aim";
    const hint = this.q("hint");
    if (hint) hint.textContent = pen ? `Penal ${this.kickIdx + 1} de ${KICKS}: apunta, mantén para cargar y suelta` : `Tiro libre ${this.kickIdx + 1} de ${KICKS}: ¡pasa la barrera!`;
  }

  /** Atajapenales: el Matichico es el arquero y el delantero rival se prepara para patear. */
  _setupAta() {
    const sp = this.spec;
    this.ballStart = new THREE.Vector3(0, BALL_R, PEN_Z);
    this.ball.position.copy(this.ballStart);
    this.ballV.set(0, 0, 0);
    this.ballLive = false;
    this.resultT = 0;
    this.shotDir = new THREE.Vector3(0, 0, -1);
    this.keeperPos = { x: 0, dive: 0, leap: 0, dir: 0, target: 0, start: 0, diveT: -1, diveDur: 0.3, goalX: 0 };
    this.keeper.group.visible = false;
    this.shooter.group.visible = true;
    this.shooter.group.position.set(0, 0, PEN_Z + 2.4);
    this.shooter.group.rotation.set(0, Math.PI, 0);
    this.shooter.animate(0, "idle", 1);
    this.hero.group.position.set(0, 0, KEEPER_Z);
    this.hero.group.rotation.set(0, 0, 0);
    this.kickAnim = -1;
    this.runT = -1;
    this.dive = null;
    this.curl = 0;
    this._syncCurlUi();
    // a dónde va a patear (y si el delantero va a tratar de engañarte)
    let tx;
    let ty;
    if (Math.random() < sp.corner) {
      tx = (Math.random() < 0.5 ? -1 : 1) * rand(1.9, 2.65);
      ty = Math.random() < 0.55 ? rand(1.45, 2.0) : rand(0.3, 0.7);
    } else {
      tx = rand(-1.2, 1.2);
      ty = rand(0.4, 1.7);
    }
    const fake = Math.random() < sp.feint;
    this.ataShot = { tx, ty, fake, lean: (fake ? -Math.sign(tx || 1) * rand(0.6, 1) : tx / 2.65) * sp.tell };
    this.ataT = 0;
    this.camTarget = this._camFor();
    if (!this.camInit) { this.camPos.copy(this.camTarget.pos); this.camLook.copy(this.camTarget.look); this.camInit = true; }
    this.phase = "aim";
    const hint = this.q("hint");
    if (hint) hint.textContent = `Atajada ${this.kickIdx + 1} de ${KICKS}: mira al delantero y toca dónde lanzarte`;
  }

  _buildWall() {
    for (const w of this.wall) this.scene.remove(w.p.group);
    this.wall = [];
    const n = this.spec.wall || 0;
    const colors = [0x3b8cff, 0x4fd09a, 0x9a5cff, 0x35c0ff, 0xff5a8a, 0xffc800];
    for (let i = 0; i < n; i++) {
      const p = this._makePlayer(i % 2 ? "estrella" : "capitan", colors[i % colors.length], 1.18);
      this.wall.push({ p, jump: 0, jumpT: -1 });
    }
  }

  _placeWall() {
    const n = this.wall.length;
    if (!n) return;
    // a ~7.5 m de la pelota en la línea hacia el arco
    const c = new THREE.Vector3().copy(this.ballStart).addScaledVector(this.shotDir, 7.5);
    const perp = new THREE.Vector3(this.shotDir.z, 0, -this.shotDir.x);
    this.wall.forEach((w, i) => {
      const off = (i - (n - 1) / 2) * 0.62;
      w.p.group.position.set(c.x + perp.x * off, 0, c.z + perp.z * off);
      w.p.group.rotation.y = Math.atan2(-this.shotDir.x, -this.shotDir.z);
      w.jump = 0;
      w.jumpT = -1;
      w.p.animate(0, "idle", 1);
    });
    this.wallC = c;
  }

  _camFor() {
    const b = this.ballStart;
    const d = this.shotDir;
    const setFov = (f) => { if (this.camera.fov !== f) { this.camera.fov = f; this.camera.updateProjectionMatrix(); } };
    if (this.mode === "ata") {
      // detrás del arco, lo bastante lejos (y con más ángulo en vertical) para ver todo el ancho del arco
      const cv = this.els.canvas;
      const aspect = (cv.clientWidth || 1) / (cv.clientHeight || 1);
      const W = 3.8;
      const t24 = Math.tan((24 * Math.PI) / 180);
      const d = clamp(W / (t24 * aspect), 6, 8.8);
      const tanNeed = W / (d * aspect);
      setFov(tanNeed > t24 ? clamp((2 * Math.atan(tanNeed) * 180) / Math.PI, 48, 84) : 48);
      return { pos: new THREE.Vector3(0, 2.6 + d * 0.14, KEEPER_Z - d), look: new THREE.Vector3(0, 0.8, 7) };
    }
    setFov(48);
    if (this.mode === "pen") {
      return { pos: new THREE.Vector3(1.0, 2.35, b.z + 3.7), look: new THREE.Vector3(0, 1.15, 0) };
    }
    const perp = new THREE.Vector3(d.z, 0, -d.x);
    return { pos: new THREE.Vector3(b.x - d.x * 5 - perp.x * 1.1, 3.3, b.z - d.z * 5 - perp.z * 1.1), look: new THREE.Vector3(0, 1.3, 0) };
  }

  // ---------- entrada ----------

  async init() {
    const first = !this.ready;
    await super.init();
    if (first) this._bindInput();
  }

  _aimFromPointer(e) {
    const r = this.els.canvas.getBoundingClientRect();
    const lift = e.pointerType === "touch" ? clamp(r.height * 0.1, 18, 46) : 0; // con el dedo, la mira queda un poco arriba para verla
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - lift - r.top) / r.height) * 2 - 1));
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.goalPlane, hit)) {
      this.aim.x = clamp(hit.x, -GW / 2 - 1.4, GW / 2 + 1.4);
      this.aim.y = clamp(hit.y, 0.1, GH + 1.1);
    }
  }

  _startCharge() {
    if (this.state !== "playing" || this.phase !== "aim") return;
    this.charging = true;
    this.chargeT = 0;
    this.power = 0;
  }

  _release() {
    if (!this.charging) return;
    this.charging = false;
    if (this.state !== "playing" || this.phase !== "aim") return;
    this._kick(Math.max(0.12, this.power));
  }

  _bindInput() {
    const wrap = this.els.wrap;
    let id = null;
    wrap.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button, .overlay")) return;
      if (this.state !== "playing") return;
      id = e.pointerId;
      wrap.setPointerCapture?.(id);
      if (this.mode === "ata") { this._ataTap(e); e.preventDefault(); return; }
      this._aimFromPointer(e);
      this._startCharge();
      e.preventDefault();
    });
    wrap.addEventListener("pointermove", (e) => {
      if (this.state !== "playing" || this.phase !== "aim" || this.mode === "ata") return;
      if (e.pointerType === "mouse" || e.pointerId === id) this._aimFromPointer(e);
    });
    const up = (e) => { if (e.pointerId !== id) return; id = null; this._release(); };
    wrap.addEventListener("pointerup", up);
    wrap.addEventListener("pointercancel", up);
    window.addEventListener("keydown", (e) => {
      if (!this.running) return;
      const k = e.code;
      if (this.mode === "ata") {
        // teclado: ← → para lanzarte a un lado, ↑ para saltar, Q / E a los ángulos altos, abajo/espacio al centro
        const dives = { ArrowLeft: [-2.3, 1.1], KeyA: [-2.3, 1.1], ArrowRight: [2.3, 1.1], KeyD: [2.3, 1.1], ArrowUp: [0, 2.0], KeyW: [0, 2.0], KeyQ: [-2.4, 1.9], KeyE: [2.4, 1.9], ArrowDown: [0, 0.5], KeyS: [0, 0.5], Space: [0, 1.0] };
        if (dives[k] && !e.repeat) { this._ataDive(...dives[k]); e.preventDefault(); }
        return;
      }
      if (k === "KeyQ" && !e.repeat) { this._setCurl(-1); return; }
      if (k === "KeyE" && !e.repeat) { this._setCurl(1); return; }
      if (k === "Space") { if (!e.repeat) this._startCharge(); e.preventDefault(); }
      else if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "KeyA", "KeyD", "KeyW", "KeyS"].includes(k)) { this.keys[k] = true; e.preventDefault(); }
    });
    window.addEventListener("keyup", (e) => {
      if (e.code === "Space") this._release();
      this.keys[e.code] = false;
    });
    window.addEventListener("blur", () => { this.keys = {}; });
    for (const [id2, v] of [["btn-curl-l", -1], ["btn-curl-r", 1]]) {
      const b = this.q(id2);
      if (b) b.addEventListener("click", (e) => { e.preventDefault(); this._setCurl(v); });
    }
    const shoot = this.q("btn-shoot");
    if (shoot) {
      shoot.addEventListener("pointerdown", (e) => { e.preventDefault(); this._startCharge(); });
      shoot.addEventListener("pointerup", (e) => { e.preventDefault(); this._release(); });
      shoot.addEventListener("pointercancel", () => { this.charging = false; });
    }
  }

  // ---------- efecto (curva) ----------

  _setCurl(v) {
    if (this.mode === "ata" || this.phase !== "aim") return;
    this.curl = this.curl === v ? 0 : v;
    audio.playPop();
    this._syncCurlUi();
  }

  _syncCurlUi() {
    const l = this.q("btn-curl-l");
    const r = this.q("btn-curl-r");
    if (l) l.classList.toggle("sel", this.curl < 0);
    if (r) r.classList.toggle("sel", this.curl > 0);
    const box = this.q("curl");
    if (box) box.classList.toggle("hidden", this.mode === "ata");
  }

  /** Puntitos que muestran por dónde irá la pelota con efecto. */
  _updatePathDots() {
    const show = this.curl !== 0 && this.state === "playing" && this.phase === "aim" && this.mode !== "ata";
    for (const d of this.pathDots) d.visible = show;
    if (!show) return;
    const b = this.ballStart;
    const tx = this.aim.x;
    const ty = this.aim.y;
    const dist = Math.hypot(tx - b.x, b.z);
    const T = dist / lerp(11, 27, 0.6);
    const dxz = new THREE.Vector2(tx - b.x, -b.z);
    const right = new THREE.Vector2(-dxz.y, dxz.x).normalize();
    const dev = this.curl * CURL_DEV[this.mode];
    const n = this.pathDots.length;
    for (let i = 0; i < n; i++) {
      const f = (i + 1) / (n + 1);
      const bulge = -4 * f * (1 - f) * dev; // la curva se abre del lado contrario y vuelve a la mira
      const y = lerp(b.y, ty, f) + 0.5 * G * T * T * f * (1 - f);
      this.pathDots[i].position.set(lerp(b.x, tx, f) + right.x * bulge, y, lerp(b.z, 0, f) + right.y * bulge);
    }
  }

  // ---------- atajapenales: el Matichico es el arquero ----------

  _ataTap(e) {
    if (this.state !== "playing") return;
    const r = this.els.canvas.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.goalPlane, hit)) return;
    this._ataDive(hit.x, hit.y);
  }

  _ataDive(x, y) {
    if (this.mode !== "ata" || this.dive || this.state !== "playing") return;
    if (this.phase !== "aim" && this.phase !== "runup" && this.phase !== "flight") return;
    const tx = clamp(x, -3.3, 3.3);
    const ty = clamp(y, 0.35, 2.3);
    this.dive = { t: 0, tx, ty, dur: 0.3 + Math.abs(tx) * 0.02 };
    audio.playWhoosh();
  }

  _ataLaunch() {
    const sp = this.spec;
    const sh = this.ataShot;
    const b = this.ballStart;
    const T = sp.T;
    this.ballV.set((sh.tx - b.x) / T, (sh.ty - b.y + 0.5 * G * T * T) / T, -b.z / T);
    this.ballLive = true;
    this.ballPrevZ = b.z;
    this.keeperSaved = false;
    this.flightT = 0;
    this.ballAcc = null;
    this.phase = "flight";
    this.kickAnim = 0;
    audio.playShoot();
  }

  /** Dónde están los guantes del arquero cuando la pelota cruza la línea. */
  _handPos() {
    const d = this.dive;
    if (!d) return { x: 0, y: 1.0, e: 0 };
    const f = clamp(d.t / d.dur, 0, 1);
    const e = 1 - (1 - f) * (1 - f);
    return { x: lerp(0, d.tx, e), y: lerp(1.0, d.ty, e), e };
  }

  // ---------- el tiro ----------

  _kick(power) {
    if (!this.spendAction(1)) return; // cada tiro gasta 1 ⚡
    this.phase = "runup";
    this.runT = 0;
    this.kickPower = power;
    this.kickAim = { x: this.aim.x, y: this.aim.y };
    audio.playWhoosh();
  }

  _launch() {
    const p = this.kickPower;
    const sp = this.spec;
    // error del tiro: demasiado fuerte o demasiado suave se desvía; la mira temblorosa también
    const sweetLow = this.mode === "pen" ? 0.5 : 0.3;
    const over = Math.max(0, p - 0.86) / 0.14;
    const weak = Math.max(0, sweetLow - p) / sweetLow;
    const sd = 0.04 + 0.5 * over + 0.2 * weak + sp.wobble * 0.5 + (this.curl ? 0.07 : 0);
    const tx = this.kickAim.x + (Math.random() - 0.5) * 2 * sd;
    const ty = clamp(this.kickAim.y + (Math.random() - 0.5) * 2 * sd * 0.8, 0.05, 4);
    const speed = lerp(11, 27, p);
    const b = this.ballStart;
    const dist = Math.hypot(tx - b.x, b.z);
    const T = dist / speed;
    this.ballV.set((tx - b.x) / T, (ty - b.y + 0.5 * G * T * T) / T, -b.z / T);
    // efecto: una aceleración de lado que curva la pelota y la deja igual en la mira
    this.ballAcc = null;
    if (this.curl) {
      const rx = b.z;
      const rz = tx - b.x;
      const rl = Math.hypot(rx, rz) || 1;
      const a = (this.curl * 8 * CURL_DEV[this.mode]) / (T * T);
      this.ballAcc = { x: (rx / rl) * a, z: (rz / rl) * a };
      this.ballV.x -= 0.5 * this.ballAcc.x * T;
      this.ballV.z -= 0.5 * this.ballAcc.z * T;
    }
    this.ballLive = true;
    this.ballPrevZ = b.z;
    this.keeperSaved = false;
    this.wallHit = false;
    this.flightT = 0;
    this.launchInfo = { tx, ty, T };
    this._keeperDecide(tx, ty, T);
    this.phase = "flight";
    audio.playShoot();
    this.haptic(25);
    // la barrera salta
    for (const w of this.wall) if (Math.random() < (sp.jump || 0)) { w.jumpT = 0; w.jumpDelay = 0.08 + Math.random() * 0.08; }
  }

  _keeperDecide(tx, ty, T) {
    const sp = this.spec;
    const k = this.keeperPos;
    const read = Math.random() < sp.read * (this.curl ? 0.55 : 1); // con efecto, el arquero se confunde
    k.start = k.x;
    k.target = read ? clamp(tx + rand(-0.22, 0.22), -GW / 2 - 0.2, GW / 2 + 0.2) : pick3();
    k.leapTo = sp.leap && (read ? ty > 1.55 : Math.random() < 0.25);
    k.react = sp.react;
    k.diveT = -sp.react; // arranca a lanzarse pasado el tiempo de reacción
    const dist = Math.abs(k.target - k.start);
    k.diveDur = clamp(dist / sp.speed, 0.18, 0.5);
    k.dir = Math.sign(k.target - k.start) || 0;
    k.big = dist > 0.9;
    function pick3() { const r = Math.random(); return r < 0.34 ? -rand(1.3, 2.4) : r < 0.68 ? rand(1.3, 2.4) : rand(-0.4, 0.4); }
  }

  // ---------- bucle ----------

  update(dt) {
    this._updateAim(dt);
    this._updatePhase(dt);
    this._updateKeeper(dt);
    this._updateWall(dt);
    this._updateBall(dt);
    this._updateNet(dt);
    this._updateCamera(dt);
    this.crowdTex.offset.y = Math.sin(this.time * (this.cheerT > 0 ? 12 : 1.6)) * (this.cheerT > 0 ? 0.012 : 0.003);
    if (this.cheerT > 0) this.cheerT -= dt;
  }

  _updateAim(dt) {
    if (this.state === "playing" && this.phase === "aim" && this.mode !== "ata") {
      const sp = 2.6 * dt;
      if (this.keys.ArrowLeft || this.keys.KeyA) this.aim.x -= sp;
      if (this.keys.ArrowRight || this.keys.KeyD) this.aim.x += sp;
      if (this.keys.ArrowUp || this.keys.KeyW) this.aim.y += sp * 0.8;
      if (this.keys.ArrowDown || this.keys.KeyS) this.aim.y -= sp * 0.8;
      this.aim.x = clamp(this.aim.x, -GW / 2 - 1.4, GW / 2 + 1.4);
      this.aim.y = clamp(this.aim.y, 0.1, GH + 1.1);
      if (this.charging) {
        this.chargeT += dt;
        this.power = ping(this.chargeT * 0.9);
      }
    }
    const show = this.state === "playing" && this.phase === "aim" && this.mode !== "ata";
    this.reticle.visible = show;
    this._updatePathDots();
    if (show) {
      const wob = this.spec.wobble * (this.charging ? 1.6 : 0.6);
      this.reticle.position.set(this.aim.x + Math.sin(this.time * 7.3) * wob, this.aim.y + Math.cos(this.time * 6.1) * wob, 0.05);
      const sc = 1 + this.power * 0.5;
      this.reticle.scale.setScalar(sc);
      this.reticle.children[0].material.color.setHex(this.power > 0.86 ? 0xff4a3a : this.power > 0.5 ? 0xcfd767 : 0xffc800);
    }
    const bar = this.q("power-fill");
    if (bar) bar.style.height = `${Math.round(this.power * 100)}%`;
    const pw = this.q("power");
    if (pw) pw.classList.toggle("hidden", !(this.state === "playing" && this.phase === "aim" && this.mode !== "ata"));
  }

  _updateAta(dt) {
    const hero = this.hero;
    const sh = this.shooter;
    const sp = this.spec;
    const shot = this.ataShot;
    if (!shot) return;
    // el delantero avisa con el cuerpo a qué lado va a patear (y a veces trata de engañarte)
    const yaw = Math.PI - shot.lean * 0.55;
    if (this.phase === "aim") {
      this.ataT += dt;
      if (this.state === "playing") sh.group.rotation.y = lerp(sh.group.rotation.y, yaw, 1 - Math.exp(-6 * dt));
      sh.animate(this.time, "idle", 1);
      if (this.ataT >= 1.25 && this.state === "playing") { this.phase = "runup"; this.runT = 0; }
    } else if (this.phase === "runup") {
      this.runT += dt;
      const k = clamp(this.runT / 0.42, 0, 1);
      sh.group.position.set(lerp(0, -shot.lean * 0.5, k), 0, lerp(PEN_Z + 2.4, PEN_Z + 0.7, k));
      sh.group.rotation.y = yaw;
      sh.animate(this.time, "run", 1.1);
      if (k >= 1) this._ataLaunch();
    } else if (this.phase === "flight" || this.phase === "result") {
      if (this.kickAnim >= 0 && this.kickAnim < 1) {
        this.kickAnim += dt / 0.3;
        sh.animate(this.time, "kick", Math.min(1, this.kickAnim));
      } else sh.animate(this.time, this.resultKind === "goal" ? "cheer" : "idle", 1);
    }
    // el arquero (el Matichico): se lanza hacia donde tocaste
    const h = this._handPos();
    if (this.dive) this.dive.t += dt;
    const lean = this.dive ? Math.sign(this.dive.tx) * Math.min(1, Math.abs(this.dive.tx) / 1.6) : 0;
    hero.group.position.set(h.x * 0.85, Math.max(0, (h.y - 1.0) * 0.5) * h.e, KEEPER_Z);
    hero.group.rotation.z = -lean * 1.1 * h.e;
    let mode = "idle";
    if (this.dive && h.e > 0.2 && h.e < 1) mode = "jump";
    if (this.phase === "result") mode = this.resultKind === "save" ? "cheer" : this.dive && h.e > 0.2 ? "jump" : "sad";
    hero.animate(this.time, mode, 1);
    if (this.phase === "result") {
      this.resultT -= dt;
      if (this.resultT <= 0) this._nextKick();
    }
  }

  _updatePhase(dt) {
    if (this.mode === "ata") { this._updateAta(dt); return; }
    const hero = this.hero;
    if (this.phase === "aim") {
      hero.animate(this.time, "idle", 1);
    } else if (this.phase === "runup") {
      this.runT += dt;
      const k = clamp(this.runT / 0.32, 0, 1);
      const from = this.heroHome;
      const to = this.ballStart.clone().addScaledVector(this.shotDir, -0.6);
      hero.group.position.lerpVectors(from, to, k);
      hero.animate(this.time, "run", 1.1);
      if (k >= 1) { this._launch(); this.kickAnim = 0; }
    } else if (this.phase === "flight" || this.phase === "result") {
      if (this.kickAnim >= 0 && this.kickAnim < 1) {
        this.kickAnim += dt / 0.3;
        hero.animate(this.time, "kick", Math.min(1, this.kickAnim));
      } else if (this.resultMood === "cheer") hero.animate(this.time, "cheer", 1);
      else if (this.resultMood === "sad") hero.animate(this.time, "sad", 1);
      else hero.animate(this.time, "idle", 1);
    }
    if (this.phase === "result") {
      this.resultT -= dt;
      if (this.resultT <= 0) this._nextKick();
    }
  }

  _updateKeeper(dt) {
    const k = this.keeperPos;
    const g = this.keeper.group;
    if ((this.phase === "flight" || this.phase === "result") && k.diveT !== undefined && k.diveT > -10) {
      k.diveT += dt;
      if (k.diveT > 0) {
        const f = clamp(k.diveT / k.diveDur, 0, 1);
        const e = 1 - (1 - f) * (1 - f);
        k.x = lerp(k.start, k.target, e);
        k.dive = e * (k.big ? 1 : 0.45);
        k.leap = k.leapTo ? e : 0;
      }
    } else if (this.phase === "aim" || this.phase === "runup") {
      // el arquero se mueve un poquito mientras apuntas
      k.x = Math.sin(this.time * 1.7) * 0.35;
      k.dive = 0;
      k.leap = 0;
    }
    g.position.set(k.x, k.leap * 0.55, KEEPER_Z);
    g.rotation.z = -k.dir * 1.15 * k.dive;
    const mode = k.dive > 0.3 ? "jump" : "idle";
    this.keeper.animate(this.time, mode, 1);
  }

  _updateWall(dt) {
    for (const w of this.wall) {
      if (w.jumpT >= 0) {
        w.jumpT += dt;
        const t = w.jumpT - (w.jumpDelay || 0);
        if (t > 0) w.jump = Math.max(0, Math.sin(t * Math.PI / 0.55)) * 0.4;
        if (t > 0.55) { w.jumpT = -1; w.jump = 0; }
      }
      w.p.group.position.y = w.jump;
      w.p.animate(this.time, w.jump > 0.05 ? "jump" : "idle", 1);
    }
  }

  _updateBall(dt) {
    const b = this.ball;
    if (this.ballLive) {
      const v = this.ballV;
      this.flightT += dt;
      const prev = b.position.clone();
      v.y -= G * dt;
      if (this.ballAcc && this.phase === "flight") { v.x += this.ballAcc.x * dt; v.z += this.ballAcc.z * dt; }
      b.position.addScaledVector(v, dt);
      if (b.position.y < BALL_R) {
        b.position.y = BALL_R;
        v.y = Math.abs(v.y) * 0.5;
        v.x *= 0.92;
        v.z *= 0.92;
        if (Math.abs(v.y) < 0.8) v.y = 0;
      }
      b.rotation.x -= v.z * dt * 1.4;
      b.rotation.z += v.x * dt * 1.4;
      if (this.phase === "flight") this._checkFlight(prev);
      // la pelota termina rebotando en la red o rodando
      if (this.phase === "result" && b.position.z < -this.goalDepth + BALL_R && this.resultKind === "goal") {
        b.position.z = -this.goalDepth + BALL_R;
        v.z *= -0.25; v.x *= 0.5; v.y = Math.max(v.y, 0);
      }
      if (this.phase === "result" && this.resultKind !== "goal") { v.x *= 0.995; }
      if (b.position.z > 40 || b.position.z < -12) this.ballLive = false;
    }
    this.ballShadow.position.set(b.position.x, 0.02, b.position.z);
    this.ballShadow.scale.setScalar(clamp(1 - b.position.y * 0.12, 0.45, 1));
  }

  _checkFlightAta(prev) {
    const b = this.ball.position;
    const v = this.ballV;
    if (prev.z > KEEPER_Z && b.z <= KEEPER_Z) {
      const f = (prev.z - KEEPER_Z) / (prev.z - b.z || 1);
      const x = lerp(prev.x, b.x, f);
      const y = lerp(prev.y, b.y, f);
      const h = this._handPos();
      const R = this.spec.reach;
      const dx = (x - h.x) / R;
      const dy = (y - h.y) / (R * 0.95);
      // el cuerpo quieto también tapa un poco el centro
      const body = this.dive ? 0 : 1;
      const bodyHit = body && Math.abs(x) < 0.5 && y < 1.7;
      if (dx * dx + dy * dy < 1 || bodyHit) {
        this.saves++;
        this.keeperSaved = true;
        v.set(rand(-4, 4), rand(2, 4.5), rand(4, 7)); // la desvía
        this.ball.position.z = KEEPER_Z + 0.05;
        audio.playBump();
        this._result("save", { x, y });
        return;
      }
    }
    if (prev.z > 0 && b.z <= 0) {
      const f = prev.z / (prev.z - b.z || 1);
      const x = lerp(prev.x, b.x, f);
      const y = lerp(prev.y, b.y, f);
      this.net.t = 1; this.net.x = clamp(x, -GW / 2, GW / 2); this.net.y = clamp(y, 0.1, GH);
      this._result("goal", { x, y });
      return;
    }
    if (this.flightT > 3) this._result("out");
  }

  _checkFlight(prev) {
    if (this.mode === "ata") { this._checkFlightAta(prev); return; }
    const b = this.ball.position;
    const v = this.ballV;
    // barrera
    if (!this.wallHit) {
      for (const w of this.wall) {
        const wp = w.p.group.position;
        const h = 1.7 + w.jump;
        if (Math.hypot(b.x - wp.x, b.z - wp.z) < 0.52 && b.y < h && b.y > w.jump - 0.1) {
          this.wallHit = true;
          v.set(rand(-3, 3), rand(2, 4), Math.abs(v.z) * 0.4); // rebota de vuelta
          audio.playBump();
          this._result("wall");
          return;
        }
      }
    }
    // arquero: cuando la pelota pasa su plano
    if (!this.keeperSaved && prev.z > KEEPER_Z && b.z <= KEEPER_Z) {
      const k = this.keeperPos;
      const f = (prev.z - KEEPER_Z) / (prev.z - b.z || 1);
      const x = lerp(prev.x, b.x, f);
      const y = lerp(prev.y, b.y, f);
      const kx = k.x + k.dir * k.dive * 0.75;
      const ky = 0.95 + k.leap * 0.7 + k.dive * 0.1;
      const rx = 0.5 + 0.95 * k.dive + (k.dive > 0.2 ? 0.2 : 0);
      const ry = 1.0 + k.leap * 0.35;
      const inside = Math.abs(x) < GW / 2 + 0.3 && y < GH + 0.2;
      if (inside && ((x - kx) / rx) ** 2 + ((y - ky) / ry) ** 2 < 1) {
        this.keeperSaved = true;
        this.saves++;
        v.set(rand(-4, 4), rand(1.5, 4), rand(3, 6)); // la desvía
        this.ball.position.z = KEEPER_Z + 0.05;
        audio.playBump();
        this._result("save");
        return;
      }
    }
    // línea de gol
    if (prev.z > 0 && b.z <= 0) {
      const f = prev.z / (prev.z - b.z || 1);
      const x = lerp(prev.x, b.x, f);
      const y = lerp(prev.y, b.y, f);
      const nearPost = Math.abs(Math.abs(x) - GW / 2) < POST_R + BALL_R * 0.55 && y < GH + 0.1;
      const nearBar = Math.abs(y - GH) < POST_R + BALL_R * 0.55 && Math.abs(x) < GW / 2 + 0.1;
      if (nearPost || nearBar) {
        v.z = Math.abs(v.z) * 0.45; v.x = rand(-3, 3); v.y = rand(1, 3);
        audio.playBounce();
        this._result("post");
      } else if (Math.abs(x) < GW / 2 && y > 0 && y < GH) {
        this.net.t = 1; this.net.x = x; this.net.y = y;
        this._result("goal", { x, y });
      } else {
        this._result("out");
      }
      return;
    }
    // se fue por cualquier otro lado
    if (this.flightT > 3) this._result("out");
  }

  _updateNet(dt) {
    if (this.net.t > 0) {
      this.net.t = Math.max(0, this.net.t - dt * 0.9);
    }
    const pos = this.netBack.geometry.attributes.position;
    const base = this.netBackBase;
    const amp = this.net.t * 0.9;
    for (let i = 0; i < pos.count; i++) {
      const bx = base[i * 3] + 0;
      const by = base[i * 3 + 1] + GH / 2;
      const d = Math.hypot(bx - this.net.x, by - this.net.y);
      pos.setZ(i, -amp * Math.exp(-d * d * 0.5) * Math.cos((1 - this.net.t) * 14));
    }
    pos.needsUpdate = true;
  }

  _updateCamera(dt) {
    if (!this.camTarget) return;
    const k = 1 - Math.exp(-3.2 * dt);
    this.camPos.lerp(this.camTarget.pos, k);
    this.camLook.lerp(this.camTarget.look, k);
    const sh = this.shake > 0 ? this.shake : 0;
    this.camera.position.set(this.camPos.x + (sh ? rand(-sh, sh) : 0), this.camPos.y + (sh ? rand(-sh, sh) : 0), this.camPos.z);
    this.camera.lookAt(this.camLook);
    this.shake = Math.max(0, this.shake - dt * 2);
  }

  // ---------- resultados ----------

  _result(kind, info) {
    if (this.phase === "result") return;
    this.phase = "result";
    this.resultKind = kind;
    this.resultT = kind === "goal" ? 1.9 : 1.5;
    const ata = this.mode === "ata";
    const scored = ata ? kind === "save" : kind === "goal"; // en atajapenales, "acierto" = atajada
    this.results.push(scored ? "g" : kind === "save" ? "s" : kind === "wall" ? "w" : "m");
    if (scored && ata) {
      this.goals++;
      this.streak++;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      const hard = Math.abs(info.x) > 1.8 || info.y > 1.5 || info.y < 0.6;
      const pts = 100 + (hard ? 60 : 0) + (this.streak >= 2 ? 25 * this.streak : 0);
      this.score += pts;
      this.resultMood = "cheer";
      this.cheerT = 1.8;
      this.banner(hard ? "¡ATAJADÓN!" : "¡Atajó el Matichico!");
      this.popups.add(new THREE.Vector3(clamp(info.x, -2.8, 2.8), clamp(info.y, 0.4, 2.2) + 0.3, 0.2), `+${pts}`, "combo");
      this.particles.burst(new THREE.Vector3(info.x, info.y, 0.4), [0xffc800, 0x35f0ff, 0xfff6e6], 26, 5, 0.9, 4);
      audio.playMissionComplete();
      audio.playCombo(this.streak);
      this.haptic(40);
    } else if (scored) {
      this.goals++;
      this.streak++;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      const diana = this.dianas && [-1, 1].some((sx) => Math.hypot(info.x - sx * DIANA.x, info.y - DIANA.y) < DIANA.r);
      const corner = Math.abs(info.x) > GW / 2 - 0.9 && info.y > GH - 0.8;
      if (diana) this.dianaHits++;
      const pts = 100 + (diana ? 150 : corner ? 60 : 0) + (this.streak >= 2 ? 25 * this.streak : 0) + (this.mode === "tl" ? 60 : 0) + (this.ballAcc ? 40 : 0);
      this.score += pts;
      this.resultMood = "cheer";
      this.cheerT = 1.8;
      this.banner(diana ? "¡DIANA!" : this.ballAcc ? "¡GOLAZO DE EFECTO!" : corner ? "¡GOLAZO!" : "¡GOOOL!");
      this.popups.add(new THREE.Vector3(info.x, info.y + 0.3, 0.2), `+${pts}`, "combo");
      this.particles.burst(new THREE.Vector3(info.x, info.y, -0.6), [0xffc800, 0xd4216c, 0xfff6e6, 0x35f0ff], 36, 6, 1, 4);
      audio.playMissionComplete();
      audio.playCombo(this.streak);
      this.shake = 0.12;
      this.haptic(40);
    } else {
      this.streak = 0;
      this.resultMood = "sad";
      this.banner(ata ? "¡Gol del rival!" : { save: "¡Atajó el arquero!", wall: "¡Pegó en la barrera!", post: "¡Al palo!", out: "¡Afuera!" }[kind]);
      if (kind === "out") audio.playLose();
    }
    this._updateHud();
  }

  _nextKick() {
    this.kickIdx++;
    this.resultMood = "";
    this.kickAnim = -1;
    if (this.kickIdx >= KICKS) { this._levelDone(); return; }
    // si ya no se puede llegar a la meta, se termina antes
    const left = KICKS - this.kickIdx;
    if (this.goals + left < this.spec.need) { this._levelDone(); return; }
    this._setupKick();
    this._updateHud();
  }

  _levelDone() {
    const id = MODES[this.mode].id;
    this.phase = "done";
    this.reticle.visible = false;
    const need = this.spec.need;
    const won = this.goals >= need;
    const stars = this.goals >= Math.min(KICKS, need + 2) ? 3 : this.goals >= need + 1 ? 2 : 1;
    const ata = this.mode === "ata";
    const txt = ata ? `${this.goals} atajadas de ${KICKS} tiros (la meta era ${need}).` : `${this.goals} goles de ${KICKS} tiros (la meta era ${need}).`;
    this.runInfo = { goals: ata ? 0 : this.goals, saves: ata ? this.goals : this.saves, mode: this.mode, level: this.level, perfect: this.goals === KICKS, bestStreak: this.bestStreak, dianas: this.dianaHits };
    if (won) {
      if (this.level % 5 === 0 && this.level < LEVELS_PER_GAME) {
        this.levelWin({ level: this.level, stars, text: `${txt} ¡Ganaste la ${this.cup.cup}! 🏆`, title: `¡${this.cup.cup} ganada! 🏆` });
      } else if (this.level >= LEVELS_PER_GAME) {
        campaignWin(this.progress, id, this.level, stars);
        const t = this.els.q("gameover-title");
        if (t) t.textContent = `¡Completaste los ${LEVELS_PER_GAME} niveles de ${MODES[this.mode].name}! 🏆`;
        audio.playVictory();
        this.finish(txt);
      } else {
        this.levelWin({ level: this.level, stars, text: txt, title: `¡Nivel ${this.level} superado!` });
      }
    } else {
      audio.playLose();
      const t = this.els.q("gameover-title");
      if (t) t.textContent = "¡Casi!";
      this.finish(`${txt} Necesitas ${need}. ¡Inténtalo otra vez!`);
    }
  }

  nextLevel() {
    const id = MODES[this.mode].id;
    campaign(this.progress, id).selected = Math.min(LEVELS_PER_GAME, this.level + 1);
    this.particles.clear();
    this.popups.clear();
    this.state = "intro";
    this.reset();
    this.beginPlaying();
  }

  onIntro() {
    this._renderIntro();
  }

  _renderIntro() {
    const mp = this.q("modepick");
    if (mp) {
      mp.innerHTML = "";
      const row = document.createElement("div");
      row.className = "mode-row";
      for (const [key, m] of Object.entries(MODES)) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = `mode-btn${this._modeKey() === key ? " sel" : ""}`;
        b.textContent = `${m.icon} ${m.name}`;
        b.addEventListener("click", () => { this.progress.futbolMode = key; saveProgress(this.progress); this.reset(); this._renderIntro(); });
        row.appendChild(b);
      }
      mp.appendChild(row);
    }
    const id = MODES[this._modeKey()].id;
    const c = campaign(this.progress, id);
    c.selected = Math.min(c.selected || c.unlocked, c.unlocked);
    renderLevelPicker(this.q("lvlpick"), { id, progress: this.progress, selected: c.selected, onSelect: (n) => { c.selected = n; saveProgress(this.progress); this.reset(); } });
    const txt = this.q("intro-text");
    if (txt) {
      const sp = this.spec;
      const mk = this._modeKey();
      const cup = this.cup || cupOf(this.level);
      const final = this.level % 5 === 0 ? " ¡ES LA FINAL!" : "";
      const who = mk === "ata" ? `Delantero rival: ${cup.striker}.` : `Arquero rival: ${cup.keeper}.`;
      const goal = mk === "pen"
        ? `Penales · nivel ${this.level}: mete ${sp.need} goles de ${KICKS} tiros.`
        : mk === "tl"
          ? `Tiros libres · nivel ${this.level}: mete ${sp.need} gol${sp.need > 1 ? "es" : ""} de ${KICKS} tiros pasando la barrera de ${sp.wall} defensas.`
          : `Atajapenales · nivel ${this.level}: ataja ${sp.need} de ${KICKS} tiros.`;
      txt.textContent = `🏆 ${cup.cup}, partido ${((this.level - 1) % 5) + 1} de 5.${final} ${who} ${goal}`;
    }
  }

  // ---------- pantalla ----------

  _updateHud() {
    const e = this.els;
    const set = (id, v) => { const el = this.q(id); if (el) el.textContent = v; };
    set("hud-score", this.score);
    set("hud-coins", this.progress.coins);
    set("hud-goals", `${this.goals}/${this.spec ? this.spec.need : 0}`);
    const dots = [];
    for (let i = 0; i < KICKS; i++) {
      const r = this.results[i];
      dots.push(r === "g" ? (this.mode === "ata" ? "🧤" : "⚽") : r ? "❌" : i === this.kickIdx ? "🟡" : "⚪");
    }
    set("hud-kicks", dots.join(" "));
    const lvl = this.q("hud-mode");
    if (lvl) lvl.textContent = `${MODES[this.mode].icon} ${MODES[this.mode].name} · nivel ${this.level}`;
  }

  onBegin() {
    this.phase = "aim";
    this.ataT = 0;
    if (this.cup) this.banner(this.mode === "ata" ? `¡Delantero: ${this.cup.striker}!` : `¡Rival: ${this.cup.keeper}!`);
    this._updateHud();
  }

  onResize() {
    if (this.mode === "ata" && this.camTarget) this.camTarget = this._camFor();
  }

  pauseForMenu() {
    this.charging = false;
    this.keys = {};
    super.pauseForMenu();
  }
}
