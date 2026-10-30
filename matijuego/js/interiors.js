// Visitas por dentro (Pueblo y Ciudad), al estilo de las casas de Pokémon: en la puerta aparece «🚪 Visitar a …» y el
// Matichico entra a una pieza 3D con el vecino y sus muebles. Se puede mirar lo que hay («👀 Mirar») y cada lugar tiene una
// misión chica al día: el vecino perdió 3 cosas; al encontrarlas y volver a hablarle, da Matipuntos y una ⭐ de la aventura.
// Hay varios tipos de pieza (LAYOUTS): casa, kiosco, panadería, fábrica y sala de clases, cada una con sus muebles,
// escondites y cosas para mirar. La pieza se arma lejos del mundo solo mientras dura la visita y se desarma al salir.
// Cada juego entrega sus "ganchos": hablar (say), crear al vecino (makeHost), mostrar un aviso (popup) y su suelo (y0).
import { THREE, roundedBox, canvasTexture, emojiSprite, makeLogo } from "./three-kit.js?v=6d55b24c3a";
import * as audio from "./audio.js?v=6d55b24c3a";
import { earnCoins, saveProgress, todayKey } from "./storage.js?v=6d55b24c3a";
import { addStars } from "./adventure.js?v=6d55b24c3a";

const O = { x: 0, z: -900 }; // dónde se arma la pieza (lejos de todo)
const REWARD = 40; // Matipuntos por la misión del día (y una ⭐), salvo que el lugar diga otra cosa

// ---------- los tipos de pieza ----------
// W×D: ancho y fondo (el frente queda abierto hacia la cámara, como una casa de muñecas). host: dónde espera el vecino.
// solids: muebles que no se atraviesan (centro y medio ancho/fondo). hide: escondites posibles (se eligen 3 por día).
// looks: cosas que se pueden mirar (el botón aparece cerca de ese punto). bench: dónde sentarse (si hay).
export const LAYOUTS = {
  home: {
    W: 12, D: 9, floor: "wood",
    host: { x: -0.6, z: -2.4 },
    bench: { x: -3.6, z: -3.3, yaw: 0, seat: 0.56 },
    solids: [
      { x: -3.6, z: -3.5, hw: 1.3, hd: 0.6 }, // sillón (se sienta desde adelante)
      { x: 2.6, z: 0.2, hw: 1, hd: 0.65 }, // mesa
      { x: 4.6, z: -3.9, hw: 1.1, hd: 0.4 }, // repisa
      { x: 4.8, z: 2.6, hw: 1, hd: 1.4 }, // cama
    ],
    hide: [[-4.6, -2.6], [4.8, -3.4], [-5.1, 2.1], [5, 0.4], [1.6, 0.6], [-1.8, 3.2], [2.8, -3.6], [-3.2, -0.4]],
    looks: [
      { x: 4.6, z: -3.1, text: "🧸 Una repisa llena de cositas de colores. ¡Qué ordenada!" },
      { x: 3.4, z: 2.6, text: "🛏️ La cama está bien hecha… ¡casi!" },
      { x: 1.8, z: -3.6, text: "🪟 Por la ventana se ve la calle y pasa un perrito." },
    ],
    build(k, def) {
      const { box, g, mat } = k;
      // ventana con luz del día
      const win = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.5), new THREE.MeshBasicMaterial({ color: 0xbfe6ff }));
      win.position.set(1.8, 2.4, -this.D / 2 + 0.17);
      g.add(win);
      box(2.7, 0.14, 0.12, 0xffffff, 1.8, 3.2, -this.D / 2 + 0.2, 0.5);
      box(2.7, 0.14, 0.12, 0xffffff, 1.8, 1.6, -this.D / 2 + 0.2, 0.5);
      // alfombra redonda
      const rug = new THREE.Mesh(new THREE.CircleGeometry(2.2, 28), mat(def.accent, 0.95));
      rug.rotation.x = -Math.PI / 2;
      rug.position.set(0, 0.03, 0.4);
      g.add(rug);
      // sillón contra la pared del fondo, a la izquierda
      box(2.4, 0.5, 0.9, def.accent, -3.6, 0.3, -3.3, 0.8);
      box(2.4, 0.8, 0.25, def.accent, -3.6, 0.85, -3.75, 0.8);
      for (const sx of [-1.15, 1.15]) box(0.25, 0.7, 0.9, def.accent, -3.6 + sx, 0.45, -3.3, 0.8);
      // mesa con dos sillas
      box(1.8, 0.12, 1.1, 0x8a5a2a, 2.6, 0.85, 0.2, 0.6);
      for (const [x, z] of [[1.9, -0.2], [3.3, -0.2], [1.9, 0.6], [3.3, 0.6]]) box(0.1, 0.8, 0.1, 0x6b3a1e, x, 0.42, z, 0.6);
      for (const sx of [1.6, 3.6]) { box(0.6, 0.08, 0.6, 0x6b3a1e, sx, 0.5, 1.2, 0.6); box(0.6, 0.6, 0.08, 0x6b3a1e, sx, 0.85, 1.48, 0.6); }
      // repisa con cositas de colores
      box(2, 2.2, 0.5, 0x7a3f22, 4.6, 1.1, -3.9, 0.6);
      [0xff3b6b, 0xffe14a, 0x4fd09a, 0x4fd0ff, 0x9a5cff].forEach((c, i) => box(0.24, 0.5, 0.3, c, 3.9 + i * 0.32, 1.65, -3.75, 0.6));
      // cama a la derecha, adelante
      box(1.8, 0.5, 2.6, 0xffffff, 4.8, 0.3, 2.6, 0.8);
      box(1.8, 0.12, 2.0, def.accent, 4.8, 0.6, 2.9, 0.9);
      box(1.2, 0.2, 0.5, 0xfff6e6, 4.8, 0.65, 1.6, 0.9);
      k.plants([[-5.3, -3.9], [-5.3, 3.6]]);
    },
  },

  // la casita del árbol del bosque (Pueblo): chiquita, de madera, con ventana redonda entre las hojas
  treehouse: {
    W: 9, D: 7, floor: "wood",
    host: { x: 2.6, z: -2.3 }, // al fondo a la derecha: deja libre mirar el mapa y el baúl
    bench: { x: -2.9, z: -2.2, yaw: 0, seat: 0.5 },
    solids: [
      { x: -2.9, z: -2.4, hw: 0.9, hd: 0.55 }, // cojines
      { x: 0.2, z: -2.6, hw: 0.8, hd: 0.45 }, // mesita con el mapa
      { x: 3.6, z: 1.6, hw: 0.6, hd: 0.45 }, // baúl
      { x: -3.7, z: 1.2, hw: 0.35, hd: 0.35 }, // catalejo
    ],
    hide: [[-3.6, -0.4], [3.8, -2.7], [-1.6, 2.4], [1.6, 0.6], [-0.8, -1.2], [3.4, 0.2], [-2.6, 1.9], [0.6, 2.6]],
    looks: [
      { x: -3.7, z: 0.5, text: "🔭 Por el catalejo se ve todo el Pueblo… ¡y la fuente de chocolate brillando en la plaza!" },
      { x: 0.2, z: -1.8, text: "🗺️ Un mapa del bosque con una X dibujada: «aquí escondí mis bellotas». ¡Qué ardilla!" },
      { x: 3.6, z: 0.8, text: "📦 Un baúl lleno de piñas, plumas y piedritas brillantes. Tesoros del bosque." },
      { x: 0, z: -2.8, text: "🪟 Por la ventana redonda se mueven las hojas del árbol grande." },
    ],
    build(k, def) {
      const { box, g, mat, cyl } = k;
      // ventana redonda con hojas
      const win = new THREE.Mesh(new THREE.CircleGeometry(0.9, 24), new THREE.MeshBasicMaterial({ color: 0x8fd18a }));
      win.position.set(0, 2.3, -this.D / 2 + 0.17);
      g.add(win);
      const frame = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.1, 8, 24), mat(0x7a4a22, 0.7));
      frame.position.copy(win.position);
      g.add(frame);
      // una rama que entra por la pared
      const branch = cyl(0.18, 3.4, 0x7a4a22, -3.2, 3.2, -2.6);
      branch.rotation.z = 1.2;
      for (const [x, y] of [[-4.1, 3.6], [-2.4, 2.8]]) {
        const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 0), mat(0x3fae4a, 0.8));
        leaf.position.set(x, y, -2.6);
        g.add(leaf);
      }
      // cojines para sentarse
      box(1.8, 0.4, 1.1, def.accent, -2.9, 0.2, -2.4, 0.9);
      box(1.8, 0.6, 0.3, 0xffd34d, -2.9, 0.5, -2.95, 0.9);
      // mesita con el mapa
      box(1.6, 0.1, 0.9, 0x8a5a2a, 0.2, 0.7, -2.6, 0.6);
      for (const [x, z] of [[-0.45, -2.95], [0.85, -2.95], [-0.45, -2.25], [0.85, -2.25]]) box(0.1, 0.65, 0.1, 0x6b3a1e, x, 0.33, z, 0.6);
      box(1.1, 0.02, 0.7, 0xf3dcb0, 0.2, 0.77, -2.6, 0.9);
      // baúl
      box(1.2, 0.7, 0.9, 0x8a4a22, 3.6, 0.35, 1.6, 0.7);
      box(1.24, 0.12, 0.94, 0xffc800, 3.6, 0.72, 1.6, 0.4);
      // catalejo en su trípode
      for (const r of [0, 2.1, 4.2]) { const leg = cyl(0.04, 1.3, 0x6b3a1e, -3.7 + Math.sin(r) * 0.25, 0.6, 1.2 + Math.cos(r) * 0.25); leg.rotation.set(Math.cos(r) * 0.25, 0, -Math.sin(r) * 0.25); }
      const tube = cyl(0.12, 1.1, 0xc9a24a, -3.7, 1.35, 1.2, 0.3, { metalness: 0.6 });
      tube.rotation.x = 1.2;
      // guirnalda de lucecitas
      const cols = [0xffe14a, 0xff6fb0, 0x6fd8ff, 0xb9ff6a];
      for (let i = 0; i < 10; i++) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: cols[i % 4] }));
        b.position.set(-4 + i * 0.9, 3.5 - Math.sin((i / 9) * Math.PI) * 0.35, -this.D / 2 + 0.25);
        g.add(b);
      }
    },
  },

  shop: {
    W: 10, D: 8, floor: "tiles",
    host: { x: 0, z: -2.9 },
    solids: [
      { x: 0, z: -1.9, hw: 2.6, hd: 0.45 }, // mesón
      { x: 0, z: -3.6, hw: 4, hd: 0.3 }, // estantes del fondo
      { x: 4, z: -1, hw: 0.7, hd: 0.5 }, // refrigerador
      { x: -4, z: -1, hw: 0.6, hd: 0.3 }, // revistero
    ],
    hide: [[-3.8, 1.8], [3.8, 1.6], [-1.5, 2.6], [1.8, 0.4], [-4.2, -2.4], [4.2, 0.6], [0, 1], [-2.6, -0.6]],
    looks: [
      { x: 3.6, z: 0, text: "🧃 Jugos y leche con chocolate bien heladitos." },
      { x: -4, z: -0.2, text: "📰 La revista del Pueblo: «¡Gran festival de Matichoc este fin de semana!»" },
      { x: -1.6, z: -1.1, text: "🍬 Frascos llenos de dulces de todos los colores." },
    ],
    build(k, def) {
      const { box, cyl } = k;
      // mesón con frascos de dulces
      box(5.2, 1.1, 0.9, def.accent, 0, 0.55, -1.9, 0.6);
      box(5.4, 0.1, 1.05, 0xfff6e6, 0, 1.15, -1.9, 0.4);
      [0xff3b6b, 0xffe14a, 0x4fd09a, 0x4fd0ff].forEach((c, i) => {
        cyl(0.22, 0.45, 0xe8f6ff, -1.8 + i * 0.5, 1.43, -1.9, 0.1, { transparent: true, opacity: 0.55 });
        cyl(0.17, 0.3, c, -1.8 + i * 0.5, 1.38, -1.9, 0.5);
      });
      // estantes del fondo con productos
      box(8, 2.6, 0.5, 0x8a5a2a, 0, 1.3, -3.6, 0.6);
      const cols = [0xd4216c, 0xffc800, 0x2fa86a, 0x2c6fb7, 0xe8742a, 0x9a5cff];
      for (let r = 0; r < 3; r++) for (let i = 0; i < 8; i++) box(0.5, 0.45, 0.3, cols[(i + r) % cols.length], -3.5 + i, 0.55 + r * 0.8, -3.35, 0.5);
      // refrigerador y revistero
      box(1.4, 2.4, 1, 0xdff4ff, 4, 1.2, -1, 0.3);
      box(0.06, 1.4, 0.05, 0x8a8a96, 3.45, 1.5, -0.48, 0.3);
      box(1.2, 1.4, 0.6, 0xb5523a, -4, 0.7, -1, 0.7);
      ["#d4216c", "#2c6fb7", "#2fa86a"].forEach((c, i) => { const m = box(0.9, 0.06, 0.4, Number(c.replace("#", "0x")), -4, 1.45 + i * 0.07, -0.95 + i * 0.05, 0.6); m.rotation.y = (i - 1) * 0.15; });
      k.plants([[-4.4, 3.2], [4.4, 3.2]]);
    },
  },

  bakery: {
    W: 12, D: 9, floor: "tiles",
    host: { x: -1.2, z: -2.6 },
    solids: [
      { x: -3.5, z: -3.6, hw: 1.6, hd: 0.8 }, // horno
      { x: 2.5, z: -1.4, hw: 2.2, hd: 0.5 }, // vitrina
      { x: 3.8, z: -4, hw: 1.3, hd: 0.35 }, // repisa de panes
      { x: -3.6, z: 1.6, hw: 1.05, hd: 0.65 }, // mesa con masa
      { x: 5.1, z: 2.7, hw: 0.7, hd: 0.7 }, // sacos de harina
    ],
    hide: [[-5.2, -1.5], [0.2, -3.6], [5.3, -2.4], [-1.8, 2.8], [1.4, 1.6], [4.6, 0.6], [-4.8, 3.6], [2.6, 3.4]],
    looks: [
      { x: -3.5, z: -2.4, text: "🔥 El horno está calentito: huele a pan recién hecho." },
      { x: 2.5, z: -0.5, text: "🥐 Medialunas, berlines, pan amasado y queques de chocolate." },
      { x: -3.6, z: 2.7, text: "🫓 Masa reposando: hay que esperar que suba." },
    ],
    build(k, def) {
      const { box, cyl, g, mat } = k;
      // horno de ladrillo con la boca encendida
      box(3.2, 2.6, 1.6, 0xb5523a, -3.5, 1.3, -3.6, 0.9);
      const mouth = new THREE.Mesh(new THREE.CircleGeometry(0.6, 20, 0, Math.PI), new THREE.MeshBasicMaterial({ color: 0xffa040 }));
      mouth.position.set(-3.5, 0.9, -2.78);
      g.add(mouth);
      box(0.6, 1.6, 0.6, 0x8a3a2a, -4.4, 3.2, -3.9, 0.9);
      // vitrina con panes
      box(4.4, 1.1, 1, def.accent, 2.5, 0.55, -1.4, 0.6);
      box(4.5, 0.08, 1.05, 0xfff6e6, 2.5, 1.14, -1.4, 0.3);
      const bread = mat(0xd9a05b, 0.8);
      for (let i = 0; i < 6; i++) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), bread);
        b.scale.set(1.5, 0.7, 1);
        b.position.set(0.9 + i * 0.62, 1.32, -1.4 + (i % 2) * 0.2);
        b.castShadow = true;
        g.add(b);
      }
      // repisa de panes al fondo
      box(2.6, 2.4, 0.6, 0x8a5a2a, 3.8, 1.2, -4, 0.6);
      for (let r = 0; r < 3; r++) for (let i = 0; i < 3; i++) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), bread);
        b.scale.set(1.6, 0.8, 1);
        b.position.set(3 + i * 0.8, 0.6 + r * 0.75, -3.75);
        g.add(b);
      }
      // mesa con masa y sacos de harina
      box(2, 0.9, 1.2, 0xc98a5a, -3.6, 0.45, 1.6, 0.7);
      const dough = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 10), mat(0xfff0d6, 0.9));
      dough.scale.set(1.3, 0.6, 1);
      dough.position.set(-3.6, 1.05, 1.6);
      g.add(dough);
      for (const [x, z] of [[4.8, 2.4], [5.4, 2.9], [4.9, 3.1]]) cyl(0.38, 0.9, 0xf2e6cf, x, 0.45, z, 0.95);
      k.plants([[-5.3, -0.4]]);
    },
  },

  factory: {
    W: 20, D: 12, floor: "concrete",
    host: { x: -1.6, z: -1 },
    solids: [
      { x: -6, z: -3.5, hw: 1.5, hd: 1.5 }, // tanque 1
      { x: -2.6, z: -3.5, hw: 1.5, hd: 1.5 }, // tanque 2
      { x: 2.6, z: -3.6, hw: 1.6, hd: 1.1 }, // máquina templadora
      { x: 3.5, z: 0.6, hw: 4.6, hd: 0.65 }, // cinta transportadora
      { x: 8, z: 3.5, hw: 1.2, hd: 0.8 }, // mesa de empaque
      { x: -8, z: 3.5, hw: 1.2, hd: 0.9 }, // sacos de cacao
    ],
    hide: [[-8.6, -1.2], [-4.4, 2.4], [0.4, -2.2], [6.4, -3.6], [8.6, -0.6], [0.8, 3.6], [-1.8, 4.4], [5.2, 4.2]],
    looks: [
      { x: -6, z: -1.5, text: "🍫 Chocolate derretido dando vueltas en los tanques: ¡qué olor!" },
      { x: 3.5, z: 1.8, text: "📦 Las barras salen por la cinta y van directo a las cajas." },
      { x: 2.6, z: -2.1, text: "⚙️ La máquina templadora enfría el chocolate para que quede brillante y crujiente." },
    ],
    build(k, def) {
      const { box, cyl, g, mat, anims } = k;
      // franjas amarillas de seguridad en el piso
      for (const z of [-1.7, 1.7]) {
        const s = new THREE.Mesh(new THREE.PlaneGeometry(18, 0.2), mat(0xffc800, 0.6));
        s.rotation.x = -Math.PI / 2;
        s.position.set(0, 0.03, z);
        g.add(s);
      }
      // tanques de chocolate con cañerías
      for (const x of [-6, -2.6]) {
        cyl(1.4, 2.6, 0xc9ced6, x, 1.3, -3.5, 0.3, { metalness: 0.6 });
        cyl(1.25, 0.06, 0x5a2d16, x, 2.62, -3.5, 0.2);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.08, 6, 24), mat(0x8a8a96, 0.3));
        rim.rotation.x = Math.PI / 2;
        rim.position.set(x, 2.62, -3.5);
        g.add(rim);
      }
      const pipe = cyl(0.16, 7.6, 0x8a8a96, -0.2, 3.1, -3.5, 0.3, { metalness: 0.5 });
      pipe.rotation.z = Math.PI / 2;
      // máquina con panel de luces
      box(3.2, 2.4, 2.2, def.accent, 2.6, 1.2, -3.6, 0.5);
      [0xff3b3b, 0xffc800, 0x4fd09a].forEach((c, i) => {
        const l = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshBasicMaterial({ color: c }));
        l.position.set(1.8 + i * 0.5, 1.7, -2.48);
        g.add(l);
        anims.push((t) => { l.visible = Math.floor(t * 2 + i) % 3 !== 0; });
      });
      // cinta transportadora con barras que avanzan
      box(9.2, 0.8, 1.3, 0x55555f, 3.5, 0.4, 0.6, 0.4);
      box(9, 0.04, 1.05, 0x2a2a30, 3.5, 0.82, 0.6, 0.6);
      const barMat = mat(0x5a2d16, 0.35);
      const bars = [];
      for (let i = 0; i < 6; i++) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.14, 0.4), barMat);
        b.castShadow = true;
        g.add(b);
        bars.push(b);
      }
      anims.push((t) => bars.forEach((b, i) => { const u = ((t * 0.12 + i / 6) % 1); b.position.set(-0.8 + u * 8.6, 0.92, 0.6); }));
      // mesa de empaque con cajas y sacos de cacao
      box(2.4, 0.9, 1.6, 0x8a5a2a, 8, 0.45, 3.5, 0.7);
      for (let i = 0; i < 3; i++) box(0.6, 0.5, 0.5, 0xd9b27a, 7.3 + i * 0.7, 1.15, 3.5, 0.8);
      for (const [x, z] of [[-8.6, 3.2], [-7.6, 3.3], [-8.1, 4.1], [-8.1, 3.6]]) cyl(0.42, 0.9, 0xb08a5a, x, 0.45 + (z === 3.6 ? 0.8 : 0), z, 0.95);
      // el logo en la pared del fondo
      const logo = makeLogo(3.4);
      logo.position.set(-4.3, 4.6, -this.D / 2 + 0.2);
      g.add(logo);
    },
  },

  school: {
    W: 16, D: 10, floor: "wood",
    host: { x: 2.4, z: -3.3 },
    solids: [
      { x: 0, z: -3, hw: 1.25, hd: 0.6 }, // escritorio de la profesora
      ...[-5, -1.6, 1.8].flatMap((x) => [-0.4, 2.2].map((z) => ({ x, z, hw: 0.75, hd: 0.5 }))), // bancos
      { x: 7.4, z: -1.5, hw: 0.3, hd: 1.6 }, // biblioteca
      { x: -6.6, z: -3.6, hw: 0.5, hd: 0.5 }, // globo terráqueo
    ],
    hide: [[-6.8, -1.2], [-3.3, 0.9], [0.1, 3.6], [3.6, 0.9], [6.8, 2.2], [-6.6, 3.8], [5.2, -3.8], [-2.6, -3.6]],
    looks: [
      { x: -1.4, z: -3.8, text: "📝 En la pizarra dice: «¡Hola, Matichicos! 2 + 2 = 4 🍫»" },
      { x: -6.6, z: -2.6, text: "🌎 Un globo terráqueo: ahí está Chile, larguito." },
      { x: 6.6, z: -1.5, text: "📚 Cuentos, diccionarios y… ¡un libro de recetas de chocolate!" },
    ],
    build(k, def) {
      const { box, g, mat } = k;
      // pizarra con tiza
      box(6.4, 2.6, 0.12, 0x8a5a2a, 0, 2.3, -this.D / 2 + 0.2, 0.7);
      const board = new THREE.Mesh(new THREE.PlaneGeometry(6, 2.2), new THREE.MeshBasicMaterial({ map: canvasTexture(512, 192, (c, w, h) => {
        c.fillStyle = "#2f5a3a"; c.fillRect(0, 0, w, h);
        c.fillStyle = "#f4f4ec"; c.font = "bold 40px sans-serif"; c.textAlign = "center";
        c.fillText("¡Hola, Matichicos!", w / 2, 70); c.fillText("2 + 2 = 4  🍫", w / 2, 140);
      }) }));
      board.position.set(0, 2.3, -this.D / 2 + 0.27);
      g.add(board);
      // escritorio de la profesora con una manzana
      box(2.5, 1, 1.2, 0x7a3f22, 0, 0.5, -3, 0.6);
      const apple = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), mat(0xe22a2a, 0.35));
      apple.position.set(0.6, 1.16, -3);
      g.add(apple);
      // bancos de los alumnos con sus sillas
      for (const x of [-5, -1.6, 1.8]) for (const z of [-0.4, 2.2]) {
        box(1.5, 0.08, 0.9, 0xd9a05b, x, 0.8, z, 0.6);
        for (const sx of [-0.65, 0.65]) box(0.08, 0.8, 0.8, 0x8a8a96, x + sx, 0.4, z, 0.4);
        box(0.7, 0.06, 0.6, def.accent, x, 0.48, z + 0.8, 0.6);
      }
      // biblioteca y globo terráqueo
      box(0.5, 2.4, 3.2, 0x8a5a2a, 7.4, 1.2, -1.5, 0.6);
      const cols = [0xd4216c, 0xffc800, 0x2fa86a, 0x2c6fb7, 0xe8742a];
      for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) box(0.3, 0.55, 0.22, cols[(i + r) % 5], 7.15, 0.5 + r * 0.75, -2.7 + i * 0.48, 0.6);
      box(0.9, 0.9, 0.9, 0x7a3f22, -6.6, 0.45, -3.6, 0.6);
      const globe = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), mat(0x4fb3ff, 0.5));
      globe.position.set(-6.6, 1.4, -3.6);
      g.add(globe);
      k.anims.push((t) => { globe.rotation.y = t * 0.5; });
      k.plants([[-7.3, 4.2], [7.3, 4.2]]);
    },
  },
};

/** Los lugares que se pueden visitar. `item` es lo que el vecino perdió (un emoji, o varios: `emojis`). */
export const VISITS = {
  // ----- Pueblo -----
  bombi: {
    host: "Bombi", wall: 0xffd6e8, accent: 0xd4216c, item: { emoji: "📚", one: "libro", many: "libros" },
    hello: ["¡Hola! Pasa, pasa, estás en tu casa 🌷", "Me encanta leer en mi rincón… pero se me desordenó todo."],
    ask: "Perdí 3 libros por aquí. ¿Me ayudas a encontrarlos? Brillan un poquito ✨",
    done: ["¡Mis libros! Ya puedo seguir mi cuento 📚", "Toma, por ayudarme 💝"],
    after: ["¡Gracias por la visita! Vuelve mañana, que siempre se me pierde algo 😅"],
  },
  capi: {
    host: "Capi Menta", wall: 0xd6f5e0, accent: 0x2fa86a, item: { emoji: "⚽", one: "pelota", many: "pelotas" },
    hello: ["¡Bienvenida a mi casa, campeona! ⚽", "Aquí guardo todo lo del equipo… o eso intento."],
    ask: "Se me arrancaron 3 pelotas por la pieza. ¿Las buscas conmigo?",
    done: ["¡Todas! Ahora sí podemos entrenar 💪", "Esto es para ti 🏆"],
    after: ["¡Gracias! Mañana entrenamos otra vez 😄"],
  },
  cuchufli: {
    host: "Don Cuchufli", wall: 0xffefc2, accent: 0xe8742a, item: { emoji: "🍫", one: "cuchuflí", many: "cuchuflís" },
    hello: ["¡Qué alegría una visita! 🍫", "Estaba preparando cuchuflís para el festival."],
    ask: "Se me cayeron 3 cuchuflís y rodaron por toda la casa. ¿Me ayudas?",
    done: ["¡Justo los que faltaban! Quedaron perfectos 😋", "Toma tu premio, ayudante 🍫"],
    after: ["¡Gracias! Mañana hago más, pasa a verme 😊"],
  },
  casita: {
    layout: "treehouse", place: "Casita del árbol", host: "Ardilla Nuez", reward: 30, wall: 0xd9a066, accent: 0x3fae4a,
    item: { emoji: "🌰", one: "bellota", many: "bellotas" },
    hello: ["¡Hola! ¿Subiste hasta aquí arriba? 🐿️", "Esta es mi casita en el árbol grande. Desde aquí cuido todo el bosque."],
    ask: "Escondí 3 bellotas para el invierno… y ahora no me acuerdo dónde 😅 ¿Me ayudas a buscarlas?",
    done: ["¡Mis bellotas! Ya tengo para todo el invierno 🌰", "Toma, por tu ayuda. ¡Vuelve cuando quieras!"],
    after: ["¡Gracias por subir a visitarme! Mañana escondo otras, ya verás 🐿️"],
  },
  // ----- Ciudad: vecinos con misión -----
  rosa: {
    host: "Doña Rosa", npc: "rosa", wall: 0xe8f7d4, accent: 0x2fa86a, item: { emoji: "🌱", one: "semilla", many: "semillas" },
    hello: ["¡Hola, mi niña! Pasa a mi casita 🌻", "Estaba ordenando las semillas para el huerto."],
    ask: "Se me volaron 3 bolsitas de semillas por la pieza. ¿Las buscamos?",
    done: ["¡Esas son! Mañana las plantamos 🌱", "Toma, por tu ayuda 💚"],
    after: ["¡Gracias por venir! Vuelve mañana 🌻"],
  },
  pepe: {
    host: "Don Pepe", npc: "pepe", wall: 0xdde8ff, accent: 0x2c6fb7, item: { emoji: "🖌️", one: "pincel", many: "pinceles" },
    hello: ["¡Adelante! Esta es mi casa-taller 🎨", "Estoy pintando un cuadro de la ciudad."],
    ask: "Perdí 3 pinceles entre tanto cachureo. ¿Me ayudas a encontrarlos?",
    done: ["¡Mis pinceles! Ya puedo terminar el cuadro 🖼️", "Toma, por ayudarme 🎨"],
    after: ["¡Gracias! Mañana te muestro el cuadro terminado 😄"],
  },
  // ----- Ciudad: las casas del barrio -----
  lucho: {
    host: "Lucho", char: 1, seed: 71, reward: 25, wall: 0xffe9c4, accent: 0xe8742a, item: { emoji: "🧸", one: "peluche", many: "peluches" },
    hello: ["¡Hola, vecina! Pasa, no te fijes en el desorden 😅", "Mi hermanita jugó a las escondidas con mis peluches."],
    ask: "Escondió 3 peluches por la casa. ¿Me ayudas a encontrarlos?",
    done: ["¡Ahí estaban! Gracias, ahora sí duermo tranquilo 🧸", "Toma, te lo ganaste"],
    after: ["¡Vuelve mañana! Mi hermanita siempre esconde algo 😄"],
  },
  vale: {
    host: "Vale", char: 2, seed: 72, reward: 25, wall: 0xe0d6ff, accent: 0x8e44ad, item: { emoji: "🎀", one: "moño", many: "moños" },
    hello: ["¡Qué bueno que viniste! 🎀", "Me estoy arreglando para la fiesta del barrio."],
    ask: "No encuentro mis 3 moños favoritos. ¿Los buscamos?",
    done: ["¡Perfectos! Ya estoy lista para la fiesta 💃", "Esto es para ti, gracias"],
    after: ["¡Gracias! Te cuento mañana cómo me fue 💜"],
  },
  nibs: {
    host: "Tío Nibs", char: 0, seed: 73, reward: 25, wall: 0xd6f0ff, accent: 0x16a085, item: { emoji: "🔑", one: "llave", many: "llaves" },
    hello: ["¡Pasa, pasa! Justo iba a salir… si encuentro las llaves 🔑"],
    ask: "Perdí 3 llaves: la de la casa, la del auto y la del candado. ¿Me echas una mano?",
    done: ["¡Las tres! Ahora sí puedo salir 🚗", "Toma, por salvarme el día"],
    after: ["Gracias por la ayuda. ¡Mañana seguro las pierdo de nuevo! 😂"],
  },
  mimi: {
    host: "Señora Mimí", char: 3, seed: 74, reward: 25, wall: 0xffdce8, accent: 0xc0392b, item: { emoji: "🧶", one: "ovillo", many: "ovillos" },
    hello: ["¡Hola, preciosa! Pasa, que hace frío 🧶", "Estoy tejiendo una bufanda para el invierno."],
    ask: "Mi gato se llevó 3 ovillos de lana por toda la casa. ¿Me los traes?",
    done: ["¡Gracias! Ahora termino la bufanda 🧣", "Toma, para ti"],
    after: ["¡Vuelve mañana! Te muestro la bufanda terminada 😊"],
  },
  pancho: {
    host: "Pancho", char: 1, seed: 75, reward: 25, wall: 0xfff0a8, accent: 0xd35400, item: { emoji: "🧩", one: "pieza", many: "piezas" },
    hello: ["¡Hola! Estoy armando un puzle gigante de la Ciudad 🧩"],
    ask: "Me faltan 3 piezas y no sé dónde quedaron. ¿Me ayudas a buscarlas?",
    done: ["¡Calzan perfecto! Ya está completo 🎉", "Esto es para ti"],
    after: ["Mañana empiezo uno nuevo. ¡Vuelve a ayudarme!"],
  },
  // ----- Ciudad: los lugares -----
  kiosco: {
    layout: "shop", place: "Kiosco del Parque", host: "Kiosquera Pía", char: 2, seed: 76, wall: 0xfff3c4, accent: 0xd4216c, item: { emoji: "🍬", one: "dulce", many: "dulces" },
    hello: ["¡Bienvenida al Kiosco del Parque! 🍬", "Aquí hay de todo: dulces, jugos y la revista del Pueblo."],
    ask: "Se me cayó un frasco y 3 dulces rodaron por el piso. ¿Me ayudas a juntarlos?",
    done: ["¡Gracias! Ninguno se perdió 🍬", "Toma, por tu ayuda"],
    after: ["¡Vuelve mañana, que llegan dulces nuevos! 😄"],
  },
  panaderia: {
    layout: "bakery", place: "Panadería", host: "Panadero Hugo", char: 0, seed: 77, wall: 0xffe6d6, accent: 0xd4216c, item: { emoji: "🥐", one: "medialuna", many: "medialunas" },
    hello: ["¡Buenos días! Pasa a la Panadería 🥖", "Acabo de sacar pan del horno, ¡siente ese olor!"],
    ask: "Se me cayó una bandeja y 3 medialunas salieron rodando. ¿Las buscamos?",
    done: ["¡Todas enteritas! Gracias, ayudante 🥐", "Toma tu premio, y una medialuna de regalo 😋"],
    after: ["¡Vuelve mañana temprano, que el pan sale calentito!"],
  },
  fabrica: {
    layout: "factory", place: "Fábrica Matichoc", host: "Ingeniera Coco", char: 3, seed: 78, wall: 0xf4e6d4, accent: 0x7a3a22,
    item: { emojis: ["🫘", "🥛", "🍬"], one: "ingrediente", many: "ingredientes" },
    hello: ["¡Bienvenida a la Fábrica Matichoc! 🏭", "Aquí el cacao se vuelve chocolate: se tuesta, se muele, se mezcla y se templa."],
    ask: "Para la barra de hoy me faltan 3 ingredientes: cacao, leche y azúcar. ¿Los traes desde la bodega?",
    done: ["¡Perfecto! Cacao, leche y azúcar a la máquina… ¡y sale una barra nueva! 🍫", "Toma, la primera barra del día es para ti"],
    after: ["¡Gracias por la ayuda! Vuelve mañana a hacer otra barra 🍫"],
  },
  colegio: {
    layout: "school", place: "Colegio Choco", host: "Profesora Paz", npc: "paz", wall: 0xfff6e0, accent: 0x2c6fb7, item: { emoji: "✏️", one: "lápiz", many: "lápices" },
    hello: ["¡Hola! Bienvenida a la sala de clases ✏️", "Mañana tenemos prueba de dibujo y quiero tener todo listo."],
    ask: "Se me desparramaron 3 lápices por la sala. ¿Me ayudas a encontrarlos?",
    done: ["¡Gracias! Ya están todos en el tarro ✏️", "Toma, te ganaste una estrellita 🌟"],
    after: ["¡Nos vemos mañana en clases! 📚"],
  },
};

/** Número fijo por día y casa (las cosas quedan en los mismos lugares durante el día). */
function seedOf(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0) / 4294967296);
}

const layoutOf = (def) => LAYOUTS[def.layout || "home"];

export class Interiors {
  /** hooks: { say(name, lines, onEnd), makeHost(key) → Object3D, popup(text, kind), y0, addBench(b), removeBench(b), onLeave(), onReward() } */
  constructor(game, hooks) {
    this.g = game;
    this.h = hooks;
    this.active = null; // { key, def, L, room, host, items, benches, back, anims }
  }

  /** ¿Ya hizo hoy la misión de este lugar? */
  doneToday(key) {
    return ((this.g.progress.visits || {})[key] || "") === todayKey();
  }

  /** Entra al lugar `key`. `back` = { x, z, yaw }: dónde vuelve a quedar al salir. */
  enter(key, back) {
    const def = VISITS[key];
    if (!def || this.active) return;
    const L = layoutOf(def);
    const y0 = this.h.y0 || 0;
    const anims = [];
    const room = this._buildRoom(def, L, y0, anims);
    this.g.scene.add(room);
    const host = this.h.makeHost(key);
    host.position.set(O.x + L.host.x, y0, O.z + L.host.z);
    host.rotation.y = 0;
    if (host.parent !== this.g.scene) this.g.scene.add(host);
    // donde sentarse (se suma a las bancas del juego mientras dura la visita)
    const benches = [];
    if (L.bench) { const b = { ...L.bench, x: O.x + L.bench.x, z: O.z + L.bench.z }; this.h.addBench(b); benches.push(b); }
    this.active = { key, def, L, room, host, items: [], started: false, benches, back, t: 0, anims };
    this._cam = null;
    const p = this.g.pos;
    p.set(O.x, p.y, O.z + L.D / 2 - 1.2);
    this.g.vel && this.g.vel.set(0, 0, 0);
    this.g.heroYaw = Math.PI;
    audio.playPop?.();
    this.h.popup(def.place ? `📍 ${def.place}` : `🏠 Casa de ${def.host}`, "combo");
  }

  /** Sale y vuelve a la puerta. */
  leave() {
    const a = this.active;
    if (!a) return;
    if (this.g.sitting && a.benches.includes(this.g.sitting)) this.g.sitting = null;
    for (const b of a.benches) this.h.removeBench(b);
    this.g.scene.remove(a.room);
    if (a.host.parent) a.host.parent.remove(a.host);
    a.room.traverse((o) => { if (o.isMesh || o.isSprite) { o.geometry?.dispose(); if (o.material?.map) o.material.map.dispose(); o.material?.dispose(); } });
    this.active = null;
    const p = this.g.pos;
    p.set(a.back.x, p.y, a.back.z);
    this.g.vel && this.g.vel.set(0, 0, 0);
    if (a.back.yaw != null) this.g.heroYaw = a.back.yaw;
    this.h.onLeave?.();
    this.g._placeCamera?.(true);
  }

  /** La base común (piso, tres paredes, zócalo, felpudo de salida) y los muebles del tipo de pieza. */
  _buildRoom(def, L, y0, anims) {
    const g = new THREE.Group();
    g.position.set(O.x, y0, O.z);
    const mat = (c, r = 0.7, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, ...extra });
    const box = (w, h, d, c, x, y, z, r) => { const m = new THREE.Mesh(roundedBox(w, h, d, Math.min(0.06, w / 4, h / 4, d / 4)), mat(c, r)); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
    const cyl = (r, h, c, x, y, z, rough = 0.6, extra = {}) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 18), mat(c, rough, extra)); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
    const plants = (spots) => {
      for (const [x, z] of spots) {
        box(0.6, 0.6, 0.6, 0xc4572b, x, 0.3, z, 0.8);
        const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), mat(0x3fae4a, 0.8));
        leaf.position.set(x, 1, z);
        g.add(leaf);
      }
    };
    const { W, D } = L;
    const floorTex = canvasTexture(256, 256, (c, w, h) => {
      if (L.floor === "tiles") { for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { c.fillStyle = (i + j) % 2 ? "#f4ead8" : "#e3cfae"; c.fillRect(i * 32, j * 32, 32, 32); } }
      else if (L.floor === "concrete") { c.fillStyle = "#b9bcc2"; c.fillRect(0, 0, w, h); c.fillStyle = "#a7abb2"; for (let i = 0; i < 4; i++) { c.fillRect(i * 64, 0, 2, h); c.fillRect(0, i * 64, w, 2); } }
      else { c.fillStyle = "#c98a5a"; c.fillRect(0, 0, w, h); c.fillStyle = "#b67646"; for (let i = 0; i < 8; i++) c.fillRect(0, i * 32, w, 3); }
    });
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(W / 6, D / 4.5);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.8 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.01;
    floor.receiveShadow = true;
    g.add(floor);
    const H = L.W > 14 ? 5.5 : 4;
    box(W, H, 0.3, def.wall, 0, H / 2, -D / 2, 0.9);
    box(0.3, H, D, def.wall, -W / 2, H / 2, 0, 0.9);
    box(0.3, H, D, def.wall, W / 2, H / 2, 0, 0.9);
    box(W, 0.25, 0.34, def.accent, 0, 0.12, -D / 2 + 0.02, 0.6);
    L.build({ g, box, cyl, mat, plants, anims }, def);
    // la salida: felpudo con la puerta
    const mat2 = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.9), mat(0x8a5a2a, 0.95));
    mat2.rotation.x = -Math.PI / 2;
    mat2.position.set(0, 0.03, D / 2 - 0.5);
    g.add(mat2);
    const exit = emojiSprite("🚪", 0.9);
    exit.position.set(0, 1.6, D / 2 - 0.4);
    g.add(exit);
    return g;
  }

  /** Mantiene al Matichico dentro de la pieza y fuera de los muebles (y del vecino). */
  clamp(p) {
    const a = this.active;
    const L = a ? a.L : LAYOUTS.home;
    let x = THREE.MathUtils.clamp(p.x - O.x, -L.W / 2 + 0.6, L.W / 2 - 0.6);
    let z = THREE.MathUtils.clamp(p.z - O.z, -L.D / 2 + 0.6, L.D / 2 - 0.3);
    for (const s of [...L.solids, { x: L.host.x, z: L.host.z, hw: 0.45, hd: 0.45 }]) {
      const r = 0.4;
      const dx = x - s.x, dz = z - s.z;
      const ox = s.hw + r - Math.abs(dx), oz = s.hd + r - Math.abs(dz);
      if (ox > 0 && oz > 0) { if (ox < oz) x += Math.sign(dx || 1) * ox; else z += Math.sign(dz || 1) * oz; }
    }
    p.x = O.x + x;
    p.z = O.z + z;
  }

  /** Qué ofrece el botón de acción adentro: hablar con el vecino, mirar algo o salir. { label, icon, short, fn, d } */
  target(p) {
    const a = this.active;
    if (!a) return null;
    const L = a.L;
    const lx = p.x - O.x, lz = p.z - O.z;
    const dHost = Math.hypot(lx - L.host.x, lz - L.host.z);
    if (dHost < 2.1) return { label: `💬 Hablar con ${a.def.host}`, icon: "💬", short: "Hablar", fn: () => this._talk(), d: dHost };
    const dExit = Math.hypot(lx, lz - (L.D / 2 - 0.7));
    if (dExit < 1.6) return { label: `🚪 Salir${a.def.place ? "" : " de la casa"}`, icon: "🚪", short: "Salir", fn: () => this.leave(), d: dExit };
    let best = null;
    for (const lk of L.looks || []) {
      const d = Math.hypot(lx - lk.x, lz - lk.z);
      if (d < 1.5 && (!best || d < best.d)) best = { label: "👀 Mirar", icon: "👀", short: "Mirar", fn: () => this.h.say("👀", [lk.text]), d };
    }
    return best;
  }

  _talk() {
    const a = this.active;
    const def = a.def;
    if (this.doneToday(a.key)) { this.h.say(def.host, def.after); return; }
    if (!a.started) {
      this.h.say(def.host, [...def.hello, def.ask], () => this._hide());
      return;
    }
    const left = a.items.filter((i) => !i.got).length;
    if (left > 0) { this.h.say(def.host, [`Te ${left === 1 ? "falta" : "faltan"} ${left} ${left === 1 ? def.item.one : def.item.many}. ¡Busca bien por ${def.place ? "aquí" : "la pieza"}! ✨`]); return; }
    this.h.say(def.host, def.done, () => this._reward());
  }

  /** Esconde las 3 cosas del día (siempre en los mismos lugares durante el día). */
  _hide() {
    const a = this.active;
    if (!a || a.started) return;
    a.started = true;
    const rnd = seedOf(`${a.key}:${todayKey()}`);
    const spots = a.L.hide.slice();
    for (let i = spots.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [spots[i], spots[j]] = [spots[j], spots[i]]; }
    spots.slice(0, 3).forEach(([x, z], i) => {
      const emoji = a.def.item.emojis ? a.def.item.emojis[i % a.def.item.emojis.length] : a.def.item.emoji;
      const s = emojiSprite(emoji, 0.7);
      s.position.set(x, 0.6, z);
      a.room.add(s);
      a.items.push({ s, x, z, emoji, got: false, ph: rnd() * 6 });
    });
    this.h.popup(`🔍 Busca ${a.def.item.many}: 0/3`, "combo");
  }

  _reward() {
    const a = this.active;
    const pr = this.g.progress;
    const coins = a.def.reward ?? REWARD;
    pr.visits = pr.visits || {};
    pr.visits[a.key] = todayKey();
    pr.stats.visits = (pr.stats.visits || 0) + 1; // para las metas de la semana (js/weekly.js)
    earnCoins(pr, coins);
    addStars(pr, 1);
    saveProgress(pr);
    audio.playVictory?.();
    this.h.popup(`+${coins} 🍫✨  +1 ⭐`, "coin");
    this.h.onReward?.();
  }

  /** Cada cuadro: las cosas flotan y brillan; al pasar cerca se recogen. El vecino mira al Matichico. */
  update(dt, p) {
    const a = this.active;
    if (!a) return;
    a.t += dt;
    const lx = p.x - O.x, lz = p.z - O.z;
    let got = a.items.filter((i) => i.got).length;
    for (const it of a.items) {
      if (it.got) continue;
      it.s.position.y = 0.6 + Math.sin(a.t * 3 + it.ph) * 0.12;
      if (Math.hypot(lx - it.x, lz - it.z) < 1) {
        it.got = true;
        got++;
        it.s.visible = false;
        audio.playCollect?.();
        this.h.popup(`${it.emoji} ${got}/3`, "coin");
        if (got === 3) this.h.popup(`¡Listo! Vuelve con ${a.def.host} 💬`, "combo");
      }
    }
    for (const f of a.anims) f(a.t);
    a.host.rotation.y = Math.atan2(lx - a.L.host.x, lz - a.L.host.z);
    a.host.userData.anim?.(a.t);
  }

  /** Cámara de casa de muñecas: desde el frente abierto, siguiendo un poco al Matichico. Se aleja en las piezas grandes. */
  camera(cam, p, dt) {
    const L = this.active ? this.active.L : LAYOUTS.home;
    const k = L.W / 12;
    const portrait = cam.aspect < 0.95;
    // en vertical no cabe toda la pieza: la cámara sigue más al Matichico hacia los lados
    const span = L.W / 2 - 2;
    const lx = portrait ? THREE.MathUtils.clamp(p.x - O.x, -span, span) * 0.85 : THREE.MathUtils.clamp(p.x - O.x, -span, span) * 0.35;
    const back = portrait ? 11 * k : 4.5 * k + (L.W - 12) * 0.3;
    const up = portrait ? 11 * k : 7 * k;
    const want = new THREE.Vector3(O.x + lx, (this.h.y0 || 0) + up, O.z + L.D / 2 + back);
    if (!this._cam) this._cam = want.clone();
    this._cam.lerp(want, 1 - Math.exp(-6 * Math.max(dt || 0.016, 0.001)));
    cam.position.copy(this._cam);
    cam.lookAt(O.x + lx, (this.h.y0 || 0) + 0.6, O.z - 0.2 * k);
  }
}
