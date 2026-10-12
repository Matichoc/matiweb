// Pueblo Matichoc: un mundo abierto para pasear con tu Matichico.
//
// Hay una plaza con una fuente de chocolate, la Boutique (Vestuario y Tienda), la Fábrica de
// Chocolate, el Quiosco de figuritas (Mi aventura), un tablero de misiones, el Arcade con una
// puerta mágica por cada juego, vecinos con quienes conversar y alfajores dorados flotando por
// ahí. Cada vez que algo se puede "usar" aparece un botón; el menú escucha el evento
// "town-action" y abre lo que corresponda.

import { THREE, Game3D, clamp, lerp, canvasTexture, loadTexture, roundedBox, makeStars } from "./three-kit.js?v=6a6ce838a4";
import { createMatichico } from "./matichico3d.js?v=6a6ce838a4";
import { CHARACTERS, getOutfit } from "./characters.js?v=6a6ce838a4";
import { ITEMS, OUTFITS } from "./wardrobe-data.js?v=6a6ce838a4";
import { GAMES_CATALOG } from "./games-catalog.js?v=6a6ce838a4";
import { earnCoins, saveProgress, todayKey } from "./storage.js?v=6a6ce838a4";
import { activeEvent, addEventTokens, eventTokens } from "./events.js?v=6a6ce838a4";
import { levelInfo } from "./progression.js?v=6a6ce838a4";
import { bindStick } from "./stick.js?v=6a6ce838a4";
import * as audio from "./audio.js?v=6a6ce838a4";

const GAME_ID = "town";
const SPEED = 6.4;
// Formas de moverse: se desbloquean subiendo de nivel (el botón 🛼 cambia entre las que ya tienes).
const MOVES = [
  { id: "walk", name: "Caminar", icon: "🚶", speed: SPEED, level: 1 },
  { id: "run", name: "Correr", icon: "🏃", speed: 10.5, level: 1 },
  { id: "skates", name: "Patines", icon: "🛼", speed: 15, level: 4 },
  { id: "board", name: "Monopatín cohete", icon: "🛹", speed: 21, level: 9 },
];
const HERO_R = 0.45;
const WORLD_R = 52; // hasta dónde se puede caminar
const DAY_SECS = 300;
const COLLECT_CAP = 25; // alfajores dorados que dan Matipuntos por día
const EVENT_CAP = 40; // fichas del evento que se pueden juntar por día en el pueblo
const NPC_GIFT = 3; // Matipuntos por saludar a cada vecino la primera vez del día

const SPRITES = ["alf-frambuesa", "alf-menta", "alf-naranja", "alf-trufa", "alf-pie-limon", "alf-maracuya", "alf-almendra", "alf-capuchino"];

// cielo según la hora: [fracción del día, color, luz ambiente, sol, noche]
const SKY = [
  [0.0, 0xffc9a8, 0.9, 1.4, 0.2],
  [0.2, 0x9fdcf5, 1.3, 2.5, 0],
  [0.45, 0xb7e6ff, 1.3, 2.5, 0],
  [0.55, 0xff9a6a, 1.0, 1.5, 0.15],
  [0.65, 0x3a2d6a, 0.7, 0.7, 0.8],
  [0.8, 0x14103a, 0.6, 0.5, 1],
  [0.93, 0x3a2d6a, 0.7, 0.7, 0.8],
  [1.0, 0xffc9a8, 0.9, 1.4, 0.2],
];

const NEIGHBORS = [
  { name: "Mati Cacao", say: ["¡Hola! Bienvenida al Pueblo Matichoc 🍫", "En la Boutique hay peinados, capas y alas. ¡Pruébate todo antes de comprar!", "Los alfajores dorados que flotan por el pueblo dan Matipuntos ✨"] },
  { name: "Choco Lola", say: ["¿Ya viste el tablero de misiones? Cada día hay 3 nuevas 🎯", "Si completas las 3 misiones, ¡te dan un cofre!", "Mi alfajor favorito es el de maracuyá. ¿Y el tuyo?"] },
  { name: "Don Cuchufli", say: ["En el Parkour infinito hay poderes: 🧲 imán, 🛡️ escudo, ⚡ turbo y 🦘 súper salto.", "¡Llega lejos en el Mundo infinito y bate tu récord de metros!", "De noche se prenden los faroles, ¡qué bonito se ve!"] },
  { name: "Bombi", say: ["¿Has visto la fuente de chocolate? ¡Es la más rica del mundo!", "Cada sobre trae 3 figuritas. ¡Completa tu álbum! 📖", "Dicen que las figuritas brillantes son muy difíciles de conseguir ✨"] },
  { name: "Trufita", say: ["En la Fábrica puedes inventar tu propio chocolate 🏭", "Me encanta jugar Memoria Matichoc. ¡Mi mejor racha es de 6!", "Si subes de nivel, ¡te regalan cosas para vestirte!"] },
  { name: "Capi Menta", say: ["Los juegos del Arcade están allá, con puertas brillantes 🎮", "Cada día que juegas, tu racha crece 🔥", "¡Corre por la plaza, no hay prisa! 😄"] },
];

const pol = (deg, r) => {
  const a = (deg * Math.PI) / 180;
  return { x: Math.sin(a) * r, z: -Math.cos(a) * r };
};

export class TownGame extends Game3D {
  constructor(character, progress, els) {
    super(GAME_ID, character, progress, els, { fov: 56 });
    this.musicTheme = "chill";
    this.q = els.q;
    this.keys = {};
    this.joy = { x: 0, y: 0 };
    this.moveIdx = 1; // empieza corriendo
    this.camYaw = 0;
    this.camPitch = 0.46;
    this.pos = new THREE.Vector3(0, 0, 16);
    this.vel = new THREE.Vector3();
    this.heroYaw = Math.PI;
    this.colliders = [];
    this.interact = [];
    this.npcs = [];
    this.collect = [];
    this.target = null;
    this.dayT = 0.2 * DAY_SECS;
    this.seenIntro = false;
    this.tmpColor = new THREE.Color();
    this.tmpColor2 = new THREE.Color();
    this.hudCache = "";
  }

  // ---------- estado diario del pueblo ----------

  _daily() {
    const t = todayKey();
    if (!this.progress.town || this.progress.town.date !== t) this.progress.town = { date: t, collected: 0, talked: [], evCollected: 0 };
    return this.progress.town;
  }

  // ---------- escena ----------

  async build() {
    const s = this.scene;
    s.background = new THREE.Color(0x9fdcf5);
    s.fog = new THREE.Fog(0x9fdcf5, 50, 150);
    this.hemi = new THREE.HemisphereLight(0xcfeaff, 0xf2d8b0, 1.3);
    s.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff0d2, 2.5);
    this.sun.castShadow = true;
    const sz = this.coarse ? 1024 : 2048;
    this.sun.shadow.mapSize.set(sz, sz);
    const sc = this.sun.shadow.camera;
    sc.left = -24; sc.right = 24; sc.top = 24; sc.bottom = -24; sc.near = 1; sc.far = 90;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.05;
    s.add(this.sun, this.sun.target);
    this.onLowQuality = () => { this.sun.castShadow = false; };
    this.stars = makeStars(450, 170);
    this.stars.material.transparent = true;
    this.stars.material.opacity = 0;
    s.add(this.stars);

    this.m = {
      cream: new THREE.MeshStandardMaterial({ color: 0xfff6e6, roughness: 0.6 }),
      gold: new THREE.MeshStandardMaterial({ color: 0xffc800, roughness: 0.25, metalness: 0.65, emissive: 0x6a4a00, emissiveIntensity: 0.5 }),
      choco: new THREE.MeshStandardMaterial({ color: 0x64321b, roughness: 0.35, metalness: 0.1 }),
      pink: new THREE.MeshStandardMaterial({ color: 0xd4216c, roughness: 0.45 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x2a1810, roughness: 0.8 }),
      lamp: new THREE.MeshStandardMaterial({ color: 0xfff1b0, emissive: 0xffd34d, emissiveIntensity: 0.2, roughness: 0.4 }),
    };
    this.discGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.1, 24);
    this.rimGeo = new THREE.TorusGeometry(0.43, 0.05, 8, 24);
    this.sprites = {};
    for (const n of SPRITES) this.sprites[n] = loadTexture(`assets/products/${n}.jpg`);

    this._buildGround();
    this._buildFountain();
    this._buildBuildings();
    this._buildArcade();
    this._buildDecor();
    this._buildCollectibles();
    this._buildNeighbors();
    this._buildEvent();
    this._ensureHero();
  }

  _signTexture(text, color, icon) {
    return canvasTexture(512, 128, (g, w, h) => {
      g.fillStyle = color;
      g.beginPath();
      g.roundRect(6, 6, w - 12, h - 12, 28);
      g.fill();
      g.lineWidth = 6;
      g.strokeStyle = "#ffc800";
      g.stroke();
      g.fillStyle = "#fff6e6";
      g.font = '58px "Baby Chipmunk", "Fredoka", sans-serif';
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(`${icon} ${text}`, w / 2, h / 2 + 4, w - 40);
    });
  }

  _buildGround() {
    const s = this.scene;
    const grassTex = canvasTexture(256, 256, (g, w, h) => {
      g.fillStyle = "#7cc65a";
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 400; i++) {
        g.fillStyle = i % 2 ? "rgba(255,255,255,0.07)" : "rgba(30,90,20,0.12)";
        g.fillRect(Math.random() * w, Math.random() * h, 3, 3);
      }
    });
    grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
    grassTex.repeat.set(16, 16);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(70, 48), new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.95 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    s.add(ground);
    // plaza empedrada
    const cobble = canvasTexture(256, 256, (g, w, h) => {
      g.fillStyle = "#f3dfb8";
      g.fillRect(0, 0, w, h);
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        g.fillStyle = (x + y) % 2 ? "#ead2a2" : "#f7e6c4";
        g.beginPath();
        g.roundRect(x * 32 + 2 + (y % 2) * 8, y * 32 + 2, 28, 28, 6);
        g.fill();
      }
    });
    cobble.wrapS = cobble.wrapT = THREE.RepeatWrapping;
    cobble.repeat.set(8, 8);
    const plaza = new THREE.Mesh(new THREE.CylinderGeometry(19, 19.4, 0.3, 48), new THREE.MeshStandardMaterial({ map: cobble, roughness: 0.8 }));
    plaza.position.y = 0.05;
    plaza.receiveShadow = true;
    s.add(plaza);
    // caminos hacia cada zona
    const path = new THREE.MeshStandardMaterial({ map: cobble, roughness: 0.85 });
    const pathTo = (deg, from, to) => {
      const a = pol(deg, (from + to) / 2);
      const len = to - from;
      const m = new THREE.Mesh(new THREE.BoxGeometry(5, 0.2, len), path);
      m.position.set(a.x, 0.04, a.z);
      m.rotation.y = -(deg * Math.PI) / 180;
      m.receiveShadow = true;
      s.add(m);
    };
    for (const d of [0, 50, -50, -100, 123]) pathTo(d, 16, d === 123 ? 40 : 30);
    // cerca de postes alrededor del borde
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.4, 6), this.m.cream);
    const N = 90;
    this.fence = new THREE.InstancedMesh(post.geometry, this.m.cream, N);
    const mat = new THREE.Matrix4();
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      mat.makeTranslation(Math.sin(a) * (WORLD_R + 3), 0.7, Math.cos(a) * (WORLD_R + 3));
      this.fence.setMatrixAt(i, mat);
    }
    s.add(this.fence);
    const rail = new THREE.Mesh(new THREE.TorusGeometry(WORLD_R + 3, 0.09, 6, 120), this.m.gold);
    rail.rotation.x = Math.PI / 2;
    rail.position.y = 1.2;
    s.add(rail);
  }

  _buildFountain() {
    const g = new THREE.Group();
    const choco = new THREE.MeshStandardMaterial({ color: 0x5a2a14, roughness: 0.2, metalness: 0.2, emissive: 0x1a0a04, emissiveIntensity: 0.4 });
    this.fountainTex = canvasTexture(128, 128, (c, w, h) => {
      c.fillStyle = "#4a2412";
      c.fillRect(0, 0, w, h);
      for (let i = 0; i < 18; i++) {
        c.strokeStyle = i % 2 ? "rgba(255,200,120,0.25)" : "rgba(20,8,2,0.4)";
        c.lineWidth = 3;
        c.beginPath();
        const y = Math.random() * h;
        c.moveTo(0, y);
        c.bezierCurveTo(w * 0.3, y + 14, w * 0.6, y - 14, w, y);
        c.stroke();
      }
    });
    this.fountainTex.wrapS = this.fountainTex.wrapT = THREE.RepeatWrapping;
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.6, 1, 32), this.m.cream);
    basin.position.y = 0.5;
    basin.castShadow = true;
    const liquid = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 3.8, 0.1, 32), new THREE.MeshStandardMaterial({ map: this.fountainTex, roughness: 0.15, metalness: 0.2 }));
    liquid.position.y = 0.95;
    const t1 = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.1, 1.1, 24), this.m.gold);
    t1.position.y = 1.4;
    const t2 = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.3, 1.0, 24), choco);
    t2.position.y = 2.4;
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.7, 20, 14), this.m.gold);
    top.position.y = 3.4;
    // gotas de chocolate cayendo
    this.drops = [];
    const dropGeo = new THREE.SphereGeometry(0.12, 8, 6);
    for (let i = 0; i < 16; i++) {
      const d = new THREE.Mesh(dropGeo, choco);
      g.add(d);
      this.drops.push({ m: d, a: (i / 16) * Math.PI * 2, t: Math.random() });
    }
    for (const n of [basin, t1, t2, top]) n.castShadow = true;
    g.add(basin, liquid, t1, t2, top);
    this.scene.add(g);
    this.colliders.push({ type: "c", x: 0, z: 0, r: 4.9 });
    this.interact.push({ kind: "fountain", x: 0, z: 0, radius: 7.5, label: "🍫 Probar el chocolate de la fuente" });
  }

  _addBuilding({ deg, r, w, d, h, color, roof, name, icon, signColor, kind, label, extra }) {
    const p = pol(deg, r);
    const g = new THREE.Group();
    g.position.set(p.x, 0, p.z);
    g.rotation.y = Math.atan2(-p.x, -p.z); // la puerta mira hacia la plaza
    const wall = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
    const body = new THREE.Mesh(roundedBox(w, h, d, 0.3, 0.06), wall);
    body.position.y = h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    const roofM = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.78, h * 0.55, 4), new THREE.MeshStandardMaterial({ color: roof, roughness: 0.6 }));
    roofM.position.y = h + h * 0.27;
    roofM.rotation.y = Math.PI / 4;
    roofM.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d));
    roofM.castShadow = true;
    const door = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.4, 0.2), this.m.choco);
    door.position.set(0, 1.7, d / 2 + 0.05);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.9, 3.8, 0.12), this.m.gold);
    frame.position.set(0, 1.9, d / 2);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.6), new THREE.MeshBasicMaterial({ map: this._signTexture(name, signColor, icon), transparent: true }));
    sign.position.set(0, 4.9, d / 2 + 0.2);
    g.add(body, roofM, frame, door, sign);
    for (const sx of [-1, 1]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 0.15), new THREE.MeshStandardMaterial({ color: 0xcff0ff, emissive: 0xffe9a8, emissiveIntensity: 0.15, roughness: 0.2 }));
      win.position.set(sx * (w / 2 - 1.6), 2.6, d / 2 + 0.05);
      g.add(win);
      (this.windows ||= []).push(win.material);
    }
    if (extra) extra(g, { w, d, h });
    this.scene.add(g);
    this.colliders.push({ type: "b", x: p.x, z: p.z, yaw: g.rotation.y, hw: w / 2, hd: d / 2 });
    // punto de uso: delante de la puerta
    const fx = p.x + Math.sin(g.rotation.y) * (d / 2 + 2.6);
    const fz = p.z + Math.cos(g.rotation.y) * (d / 2 + 2.6);
    this.interact.push({ kind, x: fx, z: fz, radius: 4.2, label });
    return g;
  }

  _buildBuildings() {
    this._addBuilding({ deg: 0, r: 36, w: 13, d: 10, h: 6, color: 0xff8ab8, roof: 0xd4216c, name: "Boutique", icon: "👕", signColor: "#d4216c", kind: "shop", label: "👕 Entrar a la Boutique" });
    this._addBuilding({
      deg: 52, r: 36, w: 13, d: 10, h: 6, color: 0xb9774a, roof: 0x5a2a14, name: "Fábrica", icon: "🏭", signColor: "#7a3f22", kind: "creador", label: "🏭 Crear un chocolate",
      extra: (g, { w, h }) => {
        const chim = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 4, 12), this.m.dark);
        chim.position.set(w / 2 - 2, h + 2, -2);
        chim.castShadow = true;
        g.add(chim);
        this.smoke = [];
        for (let i = 0; i < 5; i++) {
          const puff = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, roughness: 1 }));
          puff.userData = { base: new THREE.Vector3(w / 2 - 2, h + 4.2, -2), t: i / 5 };
          g.add(puff);
          this.smoke.push(puff);
        }
      },
    });
    this._addBuilding({
      deg: -52, r: 36, w: 11, d: 9, h: 5.5, color: 0xffd34d, roof: 0xe8742a, name: "Figuritas", icon: "📖", signColor: "#e8742a", kind: "album", label: "📖 Mi álbum y misiones",
    });
    this._addBuilding({
      deg: -100, r: 37, w: 12, d: 10, h: 5.5, color: 0x9ad8c0, roof: 0x3d9a8a, name: "Mi Casa", icon: "🏠", signColor: "#3d9a8a", kind: "house", label: "🏠 Entrar a Mi Casa",
    });
    // tablero de misiones cerca de la entrada
    const p = pol(205, 14);
    const board = new THREE.Group();
    board.position.set(p.x, 0, p.z);
    board.rotation.y = 0.35; // mira hacia donde llega la gente
    const legs = [-1, 1].map((sx) => {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.2, 0.3), this.m.choco);
      l.position.set(sx * 1.7, 1.6, 0);
      return l;
    });
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.4), new THREE.MeshBasicMaterial({ map: this._signTexture("Misiones", "#cf8a00", "🎯"), transparent: true }));
    panel.position.set(0, 2.5, 0.2);
    const back = new THREE.Mesh(new THREE.BoxGeometry(4.4, 2.6, 0.2), this.m.choco);
    back.position.set(0, 2.5, 0);
    board.add(...legs, back, panel);
    board.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.scene.add(board);
    this.colliders.push({ type: "c", x: p.x, z: p.z, r: 2.4 });
    this.interact.push({ kind: "album", x: p.x + 1, z: p.z + 3, radius: 4.2, label: "🎯 Ver las misiones de hoy" });
  }

  _buildArcade() {
    const games = GAMES_CATALOG.filter((g) => g.status === "available" && g.id !== GAME_ID && g.id !== "creador");
    const colors = [0xff3fa4, 0x35f0ff, 0xffc800, 0x9a5cff, 0x4fd09a, 0xff8a2a, 0x3b8cff, 0xff6fb0, 0xcfd767];
    const n = games.length;
    this.portals = [];
    games.forEach((game, i) => {
      const deg = 78 + (i * (168 - 78)) / Math.max(1, n - 1);
      const p = pol(deg, 44);
      const col = colors[i % colors.length];
      const g = new THREE.Group();
      g.position.set(p.x, 0, p.z);
      g.rotation.y = Math.atan2(-p.x, -p.z);
      const m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.4, emissive: col, emissiveIntensity: 0.25 });
      for (const sx of [-1, 1]) {
        const pillar = new THREE.Mesh(roundedBox(0.9, 5, 0.9, 0.25, 0.06), m);
        pillar.position.set(sx * 2.2, 2.5, 0);
        pillar.castShadow = true;
        g.add(pillar);
      }
      const beam = new THREE.Mesh(roundedBox(5.6, 1, 0.9, 0.3, 0.06), m);
      beam.position.set(0, 5.2, 0);
      beam.castShadow = true;
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.15), new THREE.MeshBasicMaterial({ map: this._signTexture(game.name, "#2e1a18", game.icon), transparent: true }));
      sign.position.set(0, 6.5, 0.1);
      const portal = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 4.6), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
      portal.position.set(0, 2.5, 0);
      g.add(beam, sign, portal);
      this.portals.push(portal);
      this.scene.add(g);
      this.interact.push({ kind: "game", game: game.id, x: p.x + Math.sin(g.rotation.y) * 2.2, z: p.z + Math.cos(g.rotation.y) * 2.2, radius: 3.4, label: `▶ Jugar ${game.name}` });
    });
    // cartel grande del arcade
    const c = pol(123, 34);
    const big = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.25), new THREE.MeshBasicMaterial({ map: this._signTexture("Arcade Matichoc", "#d4216c", "🎮"), transparent: true }));
    big.position.set(c.x, 7.2, c.z);
    big.rotation.y = Math.atan2(-c.x, -c.z);
    this.scene.add(big);
  }

  _buildDecor() {
    const s = this.scene;
    // faroles alrededor de la plaza
    const poleGeo = new THREE.CylinderGeometry(0.1, 0.14, 4, 8);
    const bulbGeo = new THREE.SphereGeometry(0.34, 12, 10);
    for (let i = 0; i < 12; i++) {
      const p = pol(i * 30 + 15, 21.5);
      const pole = new THREE.Mesh(poleGeo, this.m.dark);
      pole.position.set(p.x, 2, p.z);
      const bulb = new THREE.Mesh(bulbGeo, this.m.lamp);
      bulb.position.set(p.x, 4.1, p.z);
      s.add(pole, bulb);
    }
    // árboles (instanciados, livianos) en el borde y entre las zonas
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const spots = [];
    for (let i = 0; i < 80; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 46 + rnd() * 18;
      spots.push([Math.sin(a) * r, Math.cos(a) * r, 0.9 + rnd() * 0.9]);
    }
    for (let i = 0; i < 26; i++) { // algunos dentro, lejos de edificios y caminos
      const deg = 20 + rnd() * 40 + (i % 2 ? 180 : 0) + (i % 3 ? 0 : 60);
      const p = pol(deg, 26 + rnd() * 14);
      spots.push([p.x, p.z, 0.8 + rnd() * 0.6]);
    }
    const good = spots.filter(([x, z]) => !this._nearStructure(x, z, 6));
    const trunkGeo = new THREE.CylinderGeometry(0.28, 0.4, 2.4, 6);
    const crownGeo = new THREE.IcosahedronGeometry(1.7, 0);
    const trunks = new THREE.InstancedMesh(trunkGeo, this.m.choco, good.length);
    const crowns = new THREE.InstancedMesh(crownGeo, new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), good.length);
    const mat = new THREE.Matrix4();
    const col = new THREE.Color();
    const palette = [0x4aa84a, 0x5fc25a, 0x3d9a5a, 0xe8742a, 0xff8ab8];
    good.forEach(([x, z, sc], i) => {
      mat.makeScale(sc, sc, sc).setPosition(x, 1.2 * sc, z);
      trunks.setMatrixAt(i, mat);
      mat.makeScale(sc, sc * 0.9, sc).setPosition(x, 3.4 * sc, z);
      crowns.setMatrixAt(i, mat);
      crowns.setColorAt(i, col.setHex(palette[Math.floor(rnd() * (i % 9 === 0 ? 5 : 3))]));
    });
    trunks.castShadow = crowns.castShadow = true;
    s.add(trunks, crowns);
    // nubes
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true });
    this.clouds = [];
    for (let i = 0; i < 12; i++) {
      const c = new THREE.Group();
      for (let k = 0; k < 4; k++) {
        const b = new THREE.Mesh(new THREE.IcosahedronGeometry(3 + rnd() * 3, 0), cloudMat);
        b.position.set(k * 4 - 6, rnd() * 2, rnd() * 3);
        c.add(b);
      }
      c.position.set((rnd() - 0.5) * 220, 38 + rnd() * 18, (rnd() - 0.5) * 220);
      s.add(c);
      this.clouds.push(c);
    }
  }

  _nearStructure(x, z, margin) {
    for (const c of this.colliders) {
      const dx = x - c.x;
      const dz = z - c.z;
      const reach = c.type === "c" ? c.r : Math.hypot(c.hw, c.hd);
      if (Math.hypot(dx, dz) < reach + margin) return true;
    }
    for (const it of this.interact) if (Math.hypot(x - it.x, z - it.z) < 5) return true;
    // caminos
    for (const d of [0, 50, -50, -100, 123]) {
      const p = pol(d, 28);
      const ux = p.x / 28;
      const uz = p.z / 28;
      const along = x * ux + z * uz;
      const across = Math.abs(x * -uz + z * ux);
      if (along > 14 && along < 44 && across < 4) return true;
    }
    return Math.hypot(x, z) < 21;
  }

  _buildCollectibles() {
    this.collect = [];
    let seed = 99;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 16; i++) {
      let x = 0;
      let z = 0;
      for (let k = 0; k < 40; k++) {
        const a = rnd() * Math.PI * 2;
        const r = 8 + rnd() * 38;
        x = Math.sin(a) * r;
        z = Math.cos(a) * r;
        if (!this._nearStructure(x, z, 2.5) || Math.hypot(x, z) < 19 && Math.hypot(x, z) > 7) break;
      }
      const g = new THREE.Group();
      const tex = this.sprites[SPRITES[i % SPRITES.length]];
      const disc = new THREE.Mesh(this.discGeo, [this.m.cream, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }), this.m.cream]);
      disc.rotation.x = Math.PI / 2;
      const rim = new THREE.Mesh(this.rimGeo, this.m.gold);
      rim.position.z = 0.03;
      g.add(disc, rim);
      g.scale.setScalar(1.3);
      g.position.set(x, 1.2, z);
      this.scene.add(g);
      this.collect.push({ mesh: g, x, z, taken: false, respawn: 0, phase: rnd() * 6.28 });
    }
  }

  _buildNeighbors() {
    const pool = ITEMS.filter((i) => ["hair", "hat", "glasses", "neck", "back", "shoes", "face"].includes(i.slot));
    const slots = ["hair", "hat", "glasses", "neck", "back", "shoes", "face"];
    let seed = 31;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    NEIGHBORS.forEach((n, i) => {
      const char = CHARACTERS[i % CHARACTERS.length];
      const look = { hair: "", hairColor: "", face: "", hat: "", glasses: "", neck: "", back: "", outfit: OUTFITS[Math.floor(rnd() * OUTFITS.length)].id, shoes: "", skin: "", trail: "" };
      for (const slot of slots) {
        const opts = pool.filter((it) => it.slot === slot && it.rarity !== "legendario");
        if (opts.length && rnd() < (slot === "hat" ? 0.55 : 0.4)) look[slot] = opts[Math.floor(rnd() * opts.length)].id;
      }
      const hero = createMatichico(char, getOutfit(look.outfit), look);
      hero.group.scale.setScalar(1.08);
      hero.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTexture(256, 64, (g, w, h) => {
        g.fillStyle = "rgba(40,20,10,0.78)";
        g.beginPath();
        g.roundRect(4, 8, w - 8, h - 16, 22);
        g.fill();
        g.fillStyle = "#ffc800";
        g.font = 'bold 30px "Baby Chipmunk", sans-serif';
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(n.name, w / 2, h / 2 + 2, w - 24);
      }), depthTest: false, transparent: true }));
      label.scale.set(3, 0.75, 1);
      label.position.set(0, 3.1, 0);
      label.renderOrder = 10;
      hero.group.add(label);
      const a = (i / NEIGHBORS.length) * Math.PI * 2;
      const start = { x: Math.sin(a) * (11 + rnd() * 5), z: Math.cos(a) * (11 + rnd() * 5) };
      hero.group.position.set(start.x, 0, start.z);
      this.scene.add(hero.group);
      const npc = { hero, def: n, x: start.x, z: start.z, yaw: rnd() * 6, tx: start.x, tz: start.z, wait: 1 + rnd() * 3, said: 0, speaking: 0 };
      this.npcs.push(npc);
    });
  }

  // ---------- evento de temporada ----------

  /** Un coleccionable del evento (calabaza, regalo, corazón, huevo, volantín o globo). */
  _eventPickup(kind, color) {
    const g = new THREE.Group();
    const std = (c, r = 0.5, x = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, ...x });
    const add = (geo, mat, x = 0, y = 0, z = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      g.add(m);
      return m;
    };
    if (kind === "pumpkin") {
      const p = add(new THREE.SphereGeometry(0.5, 14, 10), std(0xff8a2a, 0.55), 0, 0, 0);
      p.scale.y = 0.8;
      add(new THREE.CylinderGeometry(0.06, 0.09, 0.22, 6), std(0x3fa24a), 0, 0.42, 0);
      for (const sx of [-1, 1]) add(new THREE.ConeGeometry(0.09, 0.14, 3), std(0xffe14a, 0.3, { emissive: 0xffa800, emissiveIntensity: 0.9 }), sx * 0.17, 0.05, 0.43).rotation.x = Math.PI / 2;
    } else if (kind === "gift") {
      const c = [0xe83a3a, 0x2f9a4a, 0x4fd0ff][Math.floor(Math.random() * 3)];
      add(new THREE.BoxGeometry(0.8, 0.7, 0.8), std(c, 0.5), 0, 0, 0);
      add(new THREE.BoxGeometry(0.84, 0.74, 0.14), std(0xffe14a, 0.4), 0, 0, 0);
      add(new THREE.BoxGeometry(0.14, 0.74, 0.84), std(0xffe14a, 0.4), 0, 0, 0);
      add(new THREE.TorusGeometry(0.16, 0.05, 6, 12), std(0xffe14a, 0.4), 0, 0.42, 0);
    } else if (kind === "heart") {
      const s = new THREE.Shape();
      const k = 0.4;
      s.moveTo(0, -k);
      s.bezierCurveTo(-k * 1.6, -k * 0.2, -k * 1.1, k * 1.1, 0, k * 0.45);
      s.bezierCurveTo(k * 1.1, k * 1.1, k * 1.6, -k * 0.2, 0, -k);
      const geo = new THREE.ExtrudeGeometry(s, { depth: 0.16, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2 });
      geo.translate(0, 0, -0.08);
      add(geo, std(0xe83a6a, 0.3, { emissive: 0x7a0a2a, emissiveIntensity: 0.5 }), 0, 0, 0);
    } else if (kind === "egg") {
      const c = [0xff9ab8, 0xffe14a, 0x9fe8ff, 0xb9f0a8][Math.floor(Math.random() * 4)];
      const e = add(new THREE.SphereGeometry(0.4, 14, 10), std(c, 0.35), 0, 0, 0);
      e.scale.y = 1.3;
      add(new THREE.TorusGeometry(0.4, 0.04, 6, 18), std(0xffffff, 0.4), 0, 0.05, 0).rotation.x = Math.PI / 2;
    } else if (kind === "kite") {
      const s = new THREE.Shape();
      s.moveTo(0, 0.55); s.lineTo(0.38, 0); s.lineTo(0, -0.55); s.lineTo(-0.38, 0); s.closePath();
      add(new THREE.ShapeGeometry(s), std(0xd52b1e, 0.6, { side: THREE.DoubleSide }), 0, 0, 0);
      const h = new THREE.Shape();
      h.moveTo(-0.38, 0); h.lineTo(0, 0.55); h.lineTo(0, 0); h.closePath();
      add(new THREE.ShapeGeometry(h), std(0x0039a6, 0.6, { side: THREE.DoubleSide }), 0, 0, 0.01);
      add(new THREE.BoxGeometry(0.03, 1.1, 0.03), std(0xffffff), 0, 0, 0.02);
    } else {
      const b = add(new THREE.SphereGeometry(0.42, 14, 10), std(color || 0xff3b6b, 0.25), 0, 0.15, 0);
      b.scale.y = 1.15;
      add(new THREE.CylinderGeometry(0.01, 0.01, 0.7, 4), std(0xffffff), 0, -0.5, 0);
    }
    g.scale.setScalar(1.25);
    return g;
  }

  _buildEvent() {
    const e = (this.event = activeEvent());
    this.eventPickups = [];
    if (!e) return;
    const s = this.scene;
    // banderines entre los faroles de la plaza
    const N = 60;
    const flags = new THREE.InstancedMesh(new THREE.ConeGeometry(0.28, 0.6, 3), new THREE.MeshStandardMaterial({ roughness: 0.7, side: THREE.DoubleSide }), N);
    const mat = new THREE.Matrix4();
    const rot = new THREE.Matrix4();
    const col = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const seg = (i % 5) / 5;
      mat.makeTranslation(Math.sin(a) * 21.5, 3.9 - Math.sin(seg * Math.PI) * 0.7, -Math.cos(a) * 21.5);
      rot.makeRotationZ(Math.PI);
      mat.multiply(rot);
      flags.setMatrixAt(i, mat);
      flags.setColorAt(i, col.setHex(e.colors[i % e.colors.length]));
    }
    s.add(flags);
    // clima: nieve, corazones, brasas o confeti
    const n = 260;
    const pos = new Float32Array(n * 3);
    const cols = new Float32Array(n * 3);
    this.weather = { n, pos, kind: e.weather, seed: [] };
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 44;
      pos[i * 3 + 1] = Math.random() * 22;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 44;
      const c = e.weather === "snow" ? 0xffffff : e.weather === "hearts" ? (i % 2 ? 0xff3b6b : 0xff9ab8) : e.weather === "embers" ? (i % 3 ? 0xff8a2a : 0xffd34d) : e.colors[i % e.colors.length];
      col.setHex(c);
      cols[i * 3] = col.r;
      cols[i * 3 + 1] = col.g;
      cols[i * 3 + 2] = col.b;
      this.weather.seed.push(0.6 + Math.random() * 0.8);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(cols, 3));
    this.weather.points = new THREE.Points(geo, new THREE.PointsMaterial({ size: e.weather === "hearts" ? 0.34 : 0.24, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false }));
    this.weather.points.frustumCulled = false;
    s.add(this.weather.points);
    // coleccionables del evento repartidos por el pueblo
    let seed = 4242;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 16; i++) {
      let x = 0;
      let z = 0;
      for (let k = 0; k < 40; k++) {
        const a = rnd() * Math.PI * 2;
        const r = 6 + rnd() * 42;
        x = Math.sin(a) * r;
        z = Math.cos(a) * r;
        if (!this._nearStructure(x, z, 2.5) || (Math.hypot(x, z) < 19 && Math.hypot(x, z) > 7)) break;
      }
      const mesh = this._eventPickup(e.collect, e.colors[i % e.colors.length]);
      mesh.position.set(x, 1.3, z);
      s.add(mesh);
      this.eventPickups.push({ mesh, x, z, taken: false, respawn: 0, phase: rnd() * 6.28 });
    }
  }

  // ---------- héroe ----------

  _ensureHero() {
    if (this.hero && this.heroId === this.character.id) {
      this.hero.setLook(this.look);
      return;
    }
    if (this.hero) this.scene.remove(this.hero.group);
    this.hero = createMatichico(this.character, this.outfit, this.look);
    this.heroId = this.character.id;
    this.hero.group.scale.setScalar(1.08);
    this.hero.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.scene.add(this.hero.group);
  }

  // ---------- partida ----------

  reset() {
    this._ensureHero();
    this._daily();
    this.hudCache = "";
    this.camPitch = 0.46;
    if (!this.seenIntro) {
      this.pos.set(0, 0, 16);
      this.heroYaw = Math.PI;
      this.camYaw = 0;
    }
    this.vel.set(0, 0, 0);
    this._syncHero(0);
    this._placeCamera(true);
    this._updateHud(true);
  }

  async startRun(character, progress) {
    await super.startRun(character, progress);
    // al volver de un juego no se repite la tarjeta de bienvenida
    if (this.seenIntro) this.beginPlaying();
  }

  onBegin() {
    this.seenIntro = true;
    const el = this.els.banner;
    el.textContent = "Pueblo Matichoc";
    el.classList.remove("show");
    void el.offsetWidth;
    el.classList.add("show");
    this._updateMoveBtn(MOVES.find((m) => m.level > levelInfo(this.progress.xp).level));
  }

  /** El pueblo no tiene puntaje: al salir solo se pausa. */
  pauseForMenu() {
    audio.stopMusic();
    this.keys = {};
    this.joy = { x: 0, y: 0 };
    this.running = false;
    this.state = "paused";
    this._closeDialog();
  }

  retry() {}

  // ---------- ciclo ----------

  update(dt) {
    this.dayT = (this.dayT + dt) % DAY_SECS;
    if (this.state === "playing") {
      this._move(dt);
      this._updateNeighbors(dt);
      this._collectItems(dt);
      this._collectEvent(dt);
      this._pickTarget();
    } else {
      this._updateNeighbors(dt);
    }
    this._animateWorld(dt);
    this._syncHero(dt);
    this._updateCamera(dt);
    this._updateSky();
    this._updateHud();
  }

  _input() {
    let ix = this.joy.x;
    let iy = this.joy.y;
    if (this.keys.left) ix -= 1;
    if (this.keys.right) ix += 1;
    if (this.keys.up) iy += 1;
    if (this.keys.down) iy -= 1;
    const m = Math.hypot(ix, iy);
    if (m > 1) { ix /= m; iy /= m; }
    const yaw = this.camYaw;
    return { x: -Math.sin(yaw) * iy + Math.cos(yaw) * ix, z: -Math.cos(yaw) * iy - Math.sin(yaw) * ix, mag: Math.min(1, m) };
  }

  _move(dt) {
    const inp = this._input();
    const mv = this._move_();
    const top = mv.speed * (this.keys.sprint ? 1.35 : 1);
    const acc = (mv.id === "skates" || mv.id === "board" ? 34 : 60) * dt;
    this.vel.x += clamp(inp.x * top - this.vel.x, -acc, acc);
    this.vel.z += clamp(inp.z * top - this.vel.z, -acc, acc);
    if (inp.mag > 0.1) this.heroYaw = Math.atan2(inp.x, inp.z);
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this._collide(this.pos, HERO_R);
    const r = Math.hypot(this.pos.x, this.pos.z);
    if (r > WORLD_R) { this.pos.x *= WORLD_R / r; this.pos.z *= WORLD_R / r; }
  }

  /** Formas de moverse ya desbloqueadas según el nivel. */
  _unlockedMoves() {
    const lv = levelInfo(this.progress.xp).level;
    return MOVES.filter((m) => lv >= m.level);
  }

  _move_() {
    const list = this._unlockedMoves();
    if (this.moveIdx >= list.length) this.moveIdx = list.length - 1;
    return list[this.moveIdx];
  }

  /** Botón 🛼: pasa a la siguiente forma de moverse (y avisa cuál se desbloquea después). */
  cycleMove() {
    const list = this._unlockedMoves();
    this.moveIdx = (this.moveIdx + 1) % list.length;
    const mv = list[this.moveIdx];
    this.banner(`${mv.icon} ${mv.name}`);
    audio.playPowerup();
    const next = MOVES.find((m) => m.level > levelInfo(this.progress.xp).level);
    this._updateMoveBtn(next);
  }

  _updateMoveBtn(next) {
    const btn = document.getElementById("town-btn-speed");
    if (!btn) return;
    const mv = this._move_();
    btn.textContent = mv.icon;
    btn.title = `${mv.name}${next ? ` · próximo: ${next.name} (nivel ${next.level})` : ""}`;
    const lock = document.getElementById("town-speed-hint");
    if (lock) lock.textContent = next ? `🔒 ${next.icon} ${next.name}: nivel ${next.level}` : "";
  }

  /** Ruedas / monopatín bajo los pies según cómo te muevas. */
  _syncRide(dt) {
    const mv = this._move_();
    if (!this.ride) {
      const grp = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: 0x2a2a38, roughness: 0.5 });
      const hot = new THREE.MeshStandardMaterial({ color: 0xff3fa4, roughness: 0.4, emissive: 0xff3fa4, emissiveIntensity: 0.5 });
      this.rideSkates = new THREE.Group();
      for (const sx of [-0.2, 0.2]) {
        for (const sz of [-0.2, 0.2]) {
          const w = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 10), hot);
          w.rotation.z = Math.PI / 2;
          w.position.set(sx, 0.1, sz);
          this.rideSkates.add(w);
        }
        const boot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.5), mat);
        boot.position.set(sx, 0.22, 0);
        this.rideSkates.add(boot);
      }
      this.rideBoard = new THREE.Group();
      const deck = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 1.5), hot);
      deck.position.y = 0.2;
      this.rideBoard.add(deck);
      for (const sz of [-0.5, 0.5]) for (const sx of [-0.22, 0.22]) {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.08, 10), mat);
        w.rotation.z = Math.PI / 2;
        w.position.set(sx, 0.11, sz);
        this.rideBoard.add(w);
      }
      this.rideFlame = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.8, 8), new THREE.MeshBasicMaterial({ color: 0xffa21f }));
      this.rideFlame.rotation.x = -Math.PI / 2;
      this.rideFlame.position.set(0, 0.2, 1.1);
      this.rideBoard.add(this.rideFlame);
      grp.add(this.rideSkates, this.rideBoard);
      this.ride = grp;
      this.scene.add(grp);
    }
    this.ride.visible = mv.id === "skates" || mv.id === "board";
    this.rideSkates.visible = mv.id === "skates";
    this.rideBoard.visible = mv.id === "board";
    this.ride.position.copy(this.pos);
    this.ride.rotation.y = this.hero.group.rotation.y;
    if (this.rideFlame) this.rideFlame.scale.set(1, 0.7 + Math.random() * 0.8, 1);
    // polvito de velocidad
    const sp = Math.hypot(this.vel.x, this.vel.z);
    if (this.ride.visible && sp > 6 && Math.random() < 0.5) {
      this.particles.burst(new THREE.Vector3(this.pos.x, 0.15, this.pos.z), mv.id === "board" ? [0xffa21f, 0xfff6e6] : [0xfff6e6, 0xff9ac8], 2, 1.5, 0.4, 3);
    }
  }

  /** Saca a `p` de cualquier edificio o adorno sólido. */
  _collide(p, rad) {
    for (const c of this.colliders) {
      if (c.type === "c") {
        const dx = p.x - c.x;
        const dz = p.z - c.z;
        const d = Math.hypot(dx, dz);
        const min = c.r + rad;
        if (d < min) {
          const k = d > 1e-4 ? min / d : 1;
          p.x = c.x + (d > 1e-4 ? dx * k : min);
          p.z = c.z + (d > 1e-4 ? dz * k : 0);
        }
      } else {
        const sin = Math.sin(c.yaw);
        const cos = Math.cos(c.yaw);
        const dx = p.x - c.x;
        const dz = p.z - c.z;
        const lx = dx * cos - dz * sin;
        const lz = dx * sin + dz * cos;
        const ox = c.hw + rad - Math.abs(lx);
        const oz = c.hd + rad - Math.abs(lz);
        if (ox > 0 && oz > 0) {
          let nlx = lx;
          let nlz = lz;
          if (ox < oz) nlx = Math.sign(lx || 1) * (c.hw + rad);
          else nlz = Math.sign(lz || 1) * (c.hd + rad);
          p.x = c.x + nlx * cos + nlz * sin;
          p.z = c.z - nlx * sin + nlz * cos;
        }
      }
    }
  }

  // ---------- vecinos ----------

  _updateNeighbors(dt) {
    for (const n of this.npcs) {
      const dx = this.pos.x - n.x;
      const dz = this.pos.z - n.z;
      const near = Math.hypot(dx, dz) < 4;
      let mode = "idle";
      if (near || n.speaking > 0) {
        n.yaw = lerp(n.yaw, Math.atan2(dx, dz), 1 - Math.exp(-8 * dt));
        n.speaking = Math.max(0, n.speaking - dt);
        if (n.speaking > 0) mode = "cheer";
      } else if (n.wait > 0) {
        n.wait -= dt;
      } else {
        const tx = n.tx - n.x;
        const tz = n.tz - n.z;
        const d = Math.hypot(tx, tz);
        if (d < 0.6) {
          n.wait = 1.5 + Math.random() * 4;
          const a = Math.random() * Math.PI * 2;
          const r = 6 + Math.random() * 40;
          n.tx = Math.sin(a) * r;
          n.tz = Math.cos(a) * r;
        } else {
          n.x += (tx / d) * 1.9 * dt;
          n.z += (tz / d) * 1.9 * dt;
          n.yaw = Math.atan2(tx, tz);
          mode = "run";
          const p = { x: n.x, z: n.z };
          this._collide(p, 0.5);
          if (Math.hypot(p.x - n.x, p.z - n.z) > 0.001) { n.wait = 0.3; n.tx = n.x; n.tz = n.z; }
          n.x = p.x;
          n.z = p.z;
        }
      }
      const g = n.hero.group;
      g.position.set(n.x, 0, n.z);
      g.rotation.y = n.yaw;
      n.hero.animate(this.time + n.def.name.length, mode, mode === "run" ? 0.45 : 1);
    }
  }

  _collectEvent(dt) {
    const e = this.event;
    if (!e) return;
    const daily = this._daily();
    for (const it of this.eventPickups) {
      if (it.taken) {
        it.respawn -= dt;
        if (it.respawn <= 0) { it.taken = false; it.mesh.visible = true; }
        continue;
      }
      if (Math.abs(it.x - this.pos.x) > 1.8 || Math.abs(it.z - this.pos.z) > 1.8) continue;
      if (Math.hypot(it.x - this.pos.x, it.z - this.pos.z) > 1.6) continue;
      it.taken = true;
      it.respawn = 40;
      it.mesh.visible = false;
      const at = new THREE.Vector3(it.x, 1.8, it.z);
      audio.playBonusCollect();
      if ((daily.evCollected || 0) < EVENT_CAP) {
        daily.evCollected = (daily.evCollected || 0) + 1;
        addEventTokens(this.progress, e.id, 1);
        this.popups.add(at, `+1 ${e.token}`, "combo");
      } else this.popups.add(at, "¡Qué lindo!", "kill");
      this.particles.burst(at, e.colors, 14, 3.5, 0.7, 4);
    }
  }

  // ---------- alfajores dorados ----------

  _collectItems(dt) {
    const daily = this._daily();
    for (const it of this.collect) {
      if (it.taken) {
        it.respawn -= dt;
        if (it.respawn <= 0) { it.taken = false; it.mesh.visible = true; }
        continue;
      }
      if (Math.abs(it.x - this.pos.x) > 1.6 || Math.abs(it.z - this.pos.z) > 1.6) continue;
      if (Math.hypot(it.x - this.pos.x, it.z - this.pos.z) > 1.4) continue;
      it.taken = true;
      it.respawn = 50;
      it.mesh.visible = false;
      const at = new THREE.Vector3(it.x, 1.6, it.z);
      if (daily.collected < COLLECT_CAP) {
        daily.collected++;
        this.progress.stats.townItems = (this.progress.stats.townItems || 0) + 1;
        earnCoins(this.progress, 1);
        saveProgress(this.progress);
        audio.playCollect();
        this.popups.add(at, "+1 🍫✨", "coin");
      } else {
        audio.playCollect();
        this.popups.add(at, "¡Qué rico!", "kill");
      }
      this.particles.burst(at, [0xffc800, 0xfff6e6, 0xd4216c], 10, 3, 0.6, 4);
    }
  }

  // ---------- interacción ----------

  _pickTarget() {
    let best = null;
    let bestD = Infinity;
    const P = this.pos;
    for (const it of this.interact) {
      const d = Math.hypot(it.x - P.x, it.z - P.z);
      if (d < it.radius && d < bestD) { best = it; bestD = d; }
    }
    for (const n of this.npcs) {
      const d = Math.hypot(n.x - P.x, n.z - P.z);
      if (d < 3.4 && d < bestD) { best = { kind: "npc", npc: n, label: `💬 Hablar con ${n.def.name}` }; bestD = d; }
    }
    const key = best ? best.label : "";
    if (key !== (this.target ? this.target.label : "")) {
      this.target = best;
      const btn = this.q("btn-action");
      if (btn) {
        btn.textContent = best ? best.label : "";
        btn.classList.toggle("hidden", !best);
      }
    } else this.target = best;
  }

  /** Botón o tecla de acción: usa lo que tienes cerca. */
  act() {
    if (this.state !== "playing") return;
    if (this.dialogOpen) { this._closeDialog(); return; }
    const t = this.target;
    if (!t) return;
    audio.playPurchase();
    if (t.kind === "npc") this._talk(t.npc);
    else if (t.kind === "fountain") {
      this.popups.add(new THREE.Vector3(0, 4.6, 0), "¡Mmm, qué rico! 🍫", "combo");
      this.particles.burst(new THREE.Vector3(0, 3.6, 0), [0x64321b, 0xffc800, 0xfff6e6], 22, 4, 1, 4, 1);
    } else {
      window.dispatchEvent(new CustomEvent("town-action", { detail: { kind: t.kind, game: t.game } }));
    }
  }

  _talk(n) {
    const daily = this._daily();
    const say = n.def.say;
    let text = say[n.said % say.length];
    n.said++;
    n.speaking = 2.5;
    if (!daily.talked.includes(n.def.name)) {
      daily.talked.push(n.def.name);
      this.progress.stats.townTalks = (this.progress.stats.townTalks || 0) + 1;
      earnCoins(this.progress, NPC_GIFT);
      saveProgress(this.progress);
      text += `  (¡Regalo por saludarme hoy: +${NPC_GIFT} 🍫✨!)`;
      this.popups.add(new THREE.Vector3(n.x, 3.4, n.z), `+${NPC_GIFT} 🍫✨`, "coin");
    }
    const box = this.q("dialog");
    if (box) {
      box.querySelector(".td-name").textContent = n.def.name;
      box.querySelector(".td-text").textContent = text;
      box.classList.remove("hidden");
      this.dialogOpen = true;
      clearTimeout(this._dialogTimer);
      this._dialogTimer = setTimeout(() => this._closeDialog(), 6500);
    }
  }

  _closeDialog() {
    this.dialogOpen = false;
    clearTimeout(this._dialogTimer);
    const box = this.q("dialog");
    if (box) box.classList.add("hidden");
  }

  // ---------- animación y entorno ----------

  _animateWorld(dt) {
    const t = this.time;
    this.fountainTex.offset.y = (t * 0.05) % 1;
    for (const d of this.drops) {
      d.t = (d.t + dt * 0.7) % 1;
      const f = d.t;
      const r = 0.7 + f * 3.0;
      d.m.position.set(Math.sin(d.a) * r, 3.4 + Math.sin(f * Math.PI) * 1.2 - f * f * 2.8, Math.cos(d.a) * r);
    }
    for (const it of this.collect) {
      if (it.taken) continue;
      it.mesh.position.y = 1.3 + Math.sin(t * 2.4 + it.phase) * 0.18;
      it.mesh.rotation.y = t * 1.6 + it.phase;
    }
    this.portals.forEach((p, i) => { p.material.opacity = 0.28 + Math.sin(t * 2.4 + i) * 0.1; });
    if (this.smoke) {
      for (const s of this.smoke) {
        s.userData.t = (s.userData.t + dt * 0.18) % 1;
        const f = s.userData.t;
        s.position.set(s.userData.base.x + f * 2, s.userData.base.y + f * 5, s.userData.base.z);
        s.scale.setScalar(0.6 + f * 1.2);
        s.material.opacity = 0.6 * (1 - f);
      }
    }
    for (const it of this.eventPickups) {
      if (it.taken) continue;
      it.mesh.position.y = 1.4 + Math.sin(t * 2.2 + it.phase) * 0.2;
      it.mesh.rotation.y = t * 1.4 + it.phase;
    }
    if (this.weather) {
      const w = this.weather;
      const rise = w.kind === "hearts" || w.kind === "embers";
      for (let i = 0; i < w.n; i++) {
        const k = w.seed[i];
        w.pos[i * 3 + 1] += (rise ? 1.1 : -2.2) * k * dt;
        w.pos[i * 3] += Math.sin(t * 0.8 + i) * 0.4 * dt;
        if (w.pos[i * 3 + 1] > 22) w.pos[i * 3 + 1] = 0;
        if (w.pos[i * 3 + 1] < 0) w.pos[i * 3 + 1] = 22;
      }
      w.points.geometry.attributes.position.needsUpdate = true;
      w.points.position.set(Math.round(this.pos.x / 44) * 44, 0, Math.round(this.pos.z / 44) * 44);
    }
    for (const c of this.clouds) { c.position.x += dt * 0.6; if (c.position.x > 120) c.position.x = -120; }
  }

  _updateSky() {
    const f = this.dayT / DAY_SECS;
    let i = 0;
    while (i < SKY.length - 2 && f > SKY[i + 1][0]) i++;
    const a = SKY[i];
    const b = SKY[i + 1];
    const u = clamp((f - a[0]) / (b[0] - a[0]), 0, 1);
    this.tmpColor.setHex(a[1]).lerp(this.tmpColor2.setHex(b[1]), u);
    if (this.event) this.tmpColor.lerp(this.tmpColor2.setHex(this.event.tint), 0.22);
    this.scene.background.copy(this.tmpColor);
    this.scene.fog.color.copy(this.tmpColor);
    this.hemi.intensity = lerp(a[2], b[2], u);
    this.sun.intensity = lerp(a[3], b[3], u);
    const night = lerp(a[4], b[4], u);
    this.stars.material.opacity = night;
    this.stars.position.set(this.pos.x, 0, this.pos.z);
    this.m.lamp.emissiveIntensity = 0.2 + night * 2.2;
    for (const w of this.windows || []) w.emissiveIntensity = 0.15 + night * 1.4;
    const ang = f * Math.PI * 2;
    this.sun.position.set(this.pos.x + Math.cos(ang) * 14, this.pos.y + 22, this.pos.z + 12);
    this.sun.target.position.copy(this.pos);
  }

  _syncHero(dt) {
    const g = this.hero.group;
    g.position.copy(this.pos);
    g.rotation.y = lerp(g.rotation.y, this.heroYaw, 1 - Math.exp(-16 * Math.max(dt, 0.016)));
    const sp = Math.hypot(this.vel.x, this.vel.z);
    const mv = this._move_();
    const riding = mv.id === "skates" || mv.id === "board";
    this.hero.animate(this.time, sp > 0.8 ? (riding ? "jump" : "run") : "idle", riding ? 0.7 : clamp(sp / SPEED, 0.4, 1.4));
    this._syncRide(dt);
  }

  _placeCamera(snap = false) {
    const target = new THREE.Vector3(this.pos.x, 1.4, this.pos.z);
    if (!this.camFocus || snap) this.camFocus = target.clone();
    const portrait = this.camera.aspect < 0.95;
    const dist = portrait ? 12.5 : 9.5;
    const cp = Math.cos(this.camPitch);
    const f = this.camFocus;
    this.camera.position.set(f.x + Math.sin(this.camYaw) * cp * dist, f.y + Math.sin(this.camPitch) * dist, f.z + Math.cos(this.camYaw) * cp * dist);
    this.camera.lookAt(f.x, f.y + 0.2, f.z);
  }

  _updateCamera(dt) {
    const k = 1 - Math.exp(-9 * Math.max(dt, 0.001));
    const t = new THREE.Vector3(this.pos.x, 1.4, this.pos.z);
    if (!this.camFocus) this.camFocus = t.clone();
    this.camFocus.lerp(t, k);
    this._placeCamera();
  }

  _updateHud(force = false) {
    const daily = this._daily();
    const lv = levelInfo(this.progress.xp);
    const hour = Math.floor(((this.dayT / DAY_SECS) * 24 + 6) % 24);
    const evTok = this.event ? eventTokens(this.progress, this.event.id) : 0;
    const key = `${this.progress.coins}|${lv.level}|${daily.collected}|${hour}|${evTok}`;
    if (!force && key === this.hudCache) return;
    this.hudCache = key;
    const q = this.q;
    q("hud-coins").textContent = String(this.progress.coins);
    q("hud-level").textContent = `Nv ${lv.level}`;
    q("hud-items").textContent = `${daily.collected}/${COLLECT_CAP}`;
    q("hud-time").textContent = `${String(hour).padStart(2, "0")}:00`;
    const evEl = q("hud-event");
    if (evEl) {
      evEl.parentElement.classList.toggle("hidden", !this.event);
      if (this.event) evEl.textContent = `${this.event.token} ${evTok}`;
    }
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
      if (e.key === "e" || e.key === "E" || e.key === "Enter" || e.code === "Space") {
        if (this.state === "playing") { e.preventDefault(); if (!e.repeat) this.act(); }
        return;
      }
      if (e.key === "q" || e.key === "Q") { this.camYaw += 0.25; return; }
      if (e.key === "Shift") { this.keys.sprint = true; return; }
      if (e.key === "r" || e.key === "R") { if (!e.repeat && this.state === "playing") this.cycleMove(); return; }
      const k = map[e.key];
      if (k) { if (this.state === "playing") e.preventDefault(); this.keys[k] = true; }
    });
    window.addEventListener("keyup", (e) => { const k = map[e.key]; if (k) this.keys[k] = false; if (e.key === "Shift") this.keys.sprint = false; });
    window.addEventListener("blur", () => { this.keys = {}; });

    const cv = this.els.canvas;
    let drag = null;
    cv.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY }; cv.setPointerCapture?.(e.pointerId); });
    cv.addEventListener("pointermove", (e) => {
      if (!drag) return;
      this.camYaw -= (e.clientX - drag.x) * 0.008;
      this.camPitch = clamp(this.camPitch + (e.clientY - drag.y) * 0.004, 0.15, 1.1);
      drag = { x: e.clientX, y: e.clientY };
    });
    const end = () => { drag = null; };
    cv.addEventListener("pointerup", end);
    cv.addEventListener("pointercancel", end);

    const joy = document.getElementById("town-joy");
    if (joy) bindStick(joy, (x, y) => { this.joy.x = x; this.joy.y = y; });
    const spd = document.getElementById("town-btn-speed");
    if (spd) spd.addEventListener("pointerdown", (e) => { e.preventDefault(); this.cycleMove(); });
    const act = document.getElementById("town-btn-action");
    if (act) act.addEventListener("pointerdown", (e) => { e.preventDefault(); this.act(); });
    document.getElementById("town-dialog")?.addEventListener("pointerdown", () => this._closeDialog());
  }
}
