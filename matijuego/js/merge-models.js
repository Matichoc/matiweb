// Mati Merge: los productos en 3D (alfajores, cuchuflís, bombones y tabletas), con volumen y brillo como en Choco Match.
// Cada producto se arma con piezas simples (cilindros, esferas, cajas...) y se junta en UNA sola geometría con colores
// por vértice: así cada producto del tablero se dibuja en 1 paso (2 si lleva partes doradas), aunque tenga muchas piezas.
// Las geometrías se arman una vez por producto y se comparten entre todas las piezas iguales.

import { THREE, roundedBox } from "./three-kit.js?v=2926c82843";
import { itemInfo } from "./merge-data.js?v=2926c82843";

const C = {
  choc: 0x5a2c14, chocDark: 0x3e1c0c, milk: 0x8a5230, cookie: 0xd9a05a, cream: 0xfff3dc, white: 0xffffff,
  pink: 0xff7ab8, magenta: 0xd4216c, wafer: 0xe9b872, waferDark: 0xc98f4a, red: 0xe8404a, yellow: 0xffd23a,
  cacao: 0x8a4522, glass: 0xd8f2ff, pistachio: 0x8fd16a, gold: 0xffc83a, wine: 0x8a1f4a, berry: 0xe0306a,
};

/** Arma un producto con piezas sueltas y al final las junta en una geometría (y otra para las partes doradas). */
class Kit {
  constructor() {
    this.parts = [];
    this.gold = [];
    this.stack = [new THREE.Matrix4()];
  }

  /** Mueve/gira/agranda lo que se agregue dentro de `fn`. */
  at(t, fn) {
    const m = this.stack[this.stack.length - 1].clone().multiply(mat(t));
    this.stack.push(m);
    fn();
    this.stack.pop();
  }

  add(geo, color, t = {}) {
    const m = this.stack[this.stack.length - 1].clone().multiply(mat(t));
    (t.gold ? this.gold : this.parts).push({ geo, color, m });
  }

  /** Brillo: una gotita blanca aplastada sobre una superficie. */
  shine(x, y, z, s = 1) {
    this.add(new THREE.SphereGeometry(0.05 * s, 8, 6), C.white, { x, y, z, sx: 1.6, sy: 0.45, sz: 1 });
  }

  build(k = 1) {
    const out = { candy: merge(this.parts, k), gold: this.gold.length ? merge(this.gold, k) : null };
    const bb = new THREE.Box3();
    for (const g of [out.candy, out.gold]) if (g) { g.computeBoundingBox(); bb.union(g.boundingBox); }
    out.h = bb.max.y;
    out.w = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z, bb.max.y);
    return out;
  }
}

function mat({ x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1, sx = 1, sy = 1, sz = 1 } = {}) {
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s * sx, s * sy, s * sz));
}

/** Junta las piezas en una sola geometría con posición, normal y color por vértice. */
function merge(parts, k) {
  let nv = 0;
  let ni = 0;
  for (const p of parts) {
    nv += p.geo.attributes.position.count;
    ni += p.geo.index ? p.geo.index.count : p.geo.attributes.position.count;
  }
  const pos = new Float32Array(nv * 3);
  const nor = new Float32Array(nv * 3);
  const col = new Float32Array(nv * 3);
  const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  const scale = new THREE.Matrix4().makeScale(k, k, k);
  const color = new THREE.Color();
  let vo = 0;
  let io = 0;
  for (const p of parts) {
    const g = p.geo;
    g.applyMatrix4(scale.clone().multiply(p.m));
    if (!g.attributes.normal) g.computeVertexNormals();
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array.subarray(0, n * 3), vo * 3);
    nor.set(g.attributes.normal.array.subarray(0, n * 3), vo * 3);
    color.setHex(p.color);
    for (let i = 0; i < n; i++) { col[(vo + i) * 3] = color.r; col[(vo + i) * 3 + 1] = color.g; col[(vo + i) * 3 + 2] = color.b; }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx[io + i] = g.index.array[i] + vo;
    else for (let i = 0; i < n; i++) idx[io + i] = vo + i;
    io += g.index ? g.index.count : n;
    vo += n;
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  return geo;
}

// ---------- piezas de base ----------

const cyl = (rt, rb, h, seg = 22) => new THREE.CylinderGeometry(rt, rb, h, seg);
const sph = (r, w = 16, h = 12) => new THREE.SphereGeometry(r, w, h);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const tor = (R, r, seg = 22) => new THREE.TorusGeometry(R, r, 8, seg);

function heartShape(s) {
  const sh = new THREE.Shape();
  sh.moveTo(0, -0.9 * s);
  sh.bezierCurveTo(-0.15 * s, -0.7 * s, -1.0 * s, -0.25 * s, -1.0 * s, 0.25 * s);
  sh.bezierCurveTo(-1.0 * s, 0.75 * s, -0.35 * s, 0.95 * s, 0, 0.5 * s);
  sh.bezierCurveTo(0.35 * s, 0.95 * s, 1.0 * s, 0.75 * s, 1.0 * s, 0.25 * s);
  sh.bezierCurveTo(1.0 * s, -0.25 * s, 0.15 * s, -0.7 * s, 0, -0.9 * s);
  return sh;
}

function starShape(R, r) {
  const sh = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r : R;
    if (i === 0) sh.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else sh.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  return sh;
}

const extrude = (shape, depth, bevel = 0.02) => {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 10 });
  g.center();
  return g;
};

// ---------- recetas ----------

/** Alfajor bañado en chocolate: dos tapas, relleno de color y glaseado con puntitos. */
function alfajor(K, r, fill, glaze, dots, coat = C.choc) {
  K.add(cyl(r, r * 0.96, 0.12), coat, { y: 0.06 });
  K.add(cyl(r * 0.93, r * 0.93, 0.1), fill, { y: 0.16 });
  K.add(tor(r * 0.92, 0.04, 26), fill, { y: 0.17, rx: Math.PI / 2 }); // el relleno asoma por el borde
  K.add(cyl(r * 0.97, r, 0.12), coat, { y: 0.27 });
  K.add(cyl(r * 0.84, r * 0.9, 0.035), glaze, { y: 0.345 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.4;
    K.add(sph(0.035, 8, 6), dots, { x: Math.cos(a) * r * 0.55, y: 0.365, z: Math.sin(a) * r * 0.55 });
  }
  K.shine(-r * 0.35, 0.37, -r * 0.3, 1.2);
}

/** Cuchuflí: tubo de barquillo con espiral roja y amarilla y las puntas bañadas en chocolate (a lo largo del eje X). */
function cuchufli(K, len, r, t = {}) {
  K.at(t, () => {
    K.add(cyl(r, r, len, 16), C.wafer, { rz: Math.PI / 2 });
    const n = Math.max(3, Math.round(len / 0.15));
    for (let i = 0; i < n; i++) {
      const x = -len * 0.34 + (i * len * 0.68) / (n - 1);
      K.add(tor(r * 1.01, r * 0.2, 16), i % 2 ? C.yellow : C.red, { x, ry: Math.PI / 2 });
    }
    for (const sx of [-1, 1]) K.add(cyl(r * 1.08, r * 1.08, len * 0.14, 16), C.choc, { x: sx * len * 0.43, rz: Math.PI / 2 });
    K.shine(-len * 0.1, r * 0.85, -r * 0.2, 0.9);
  });
}

/** Bombón con pirotín rosado, cúpula de chocolate y un hilo blanco encima. */
function bombon(K, r, t = {}, color = C.chocDark, drizzle = C.white, cup = C.pink) {
  K.at(t, () => {
    K.add(cyl(r * 1.08, r * 0.86, r * 0.5, 14), cup, { y: r * 0.25 });
    K.add(sph(r, 16, 12), color, { y: r * 0.55, sy: 0.82 });
    K.add(tor(r * 0.48, r * 0.09, 18), drizzle, { y: r * 1.32, rx: Math.PI / 2, sz: 0.6 });
    K.shine(-r * 0.4, r * 1.15, r * 0.2, r * 2.4);
  });
}

/** Tableta de chocolate: base con cuadritos en relieve (cols x rows). */
function tableta(K, cols, rows, sq, color = C.choc, t = {}) {
  K.at(t, () => {
    const w = cols * sq + 0.03;
    const d = rows * sq + 0.03;
    K.add(roundedBox(w, 0.07, d, 0.03, 0.015), color, { y: 0.035 });
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
      K.add(box(sq * 0.8, 0.05, sq * 0.8), color, { x: (c - (cols - 1) / 2) * sq, y: 0.085, z: (r - (rows - 1) / 2) * sq });
    }
    K.shine(-w * 0.3, 0.115, -d * 0.3, 1);
  });
}

/** Moño de dos lazos con nudo (dorado o de color). */
function bow(K, color, t = {}, gold = false) {
  K.at(t, () => {
    for (const sx of [-1, 1]) K.add(tor(0.09, 0.035, 14), color, { x: sx * 0.09, rz: sx * 0.5, ry: Math.PI / 2, sx: 1.2, gold });
    K.add(sph(0.05, 10, 8), color, { gold });
  });
}

const RECIPES = {
  // --- alfajores ---
  1: (K) => { // galletita con chispas
    K.add(cyl(0.3, 0.3, 0.1, 24), C.cookie, { y: 0.05 });
    K.add(sph(0.29, 20, 8), C.cookie, { y: 0.09, sy: 0.12 });
    [[0.1, 0.08], [-0.12, 0.1], [0.02, -0.13], [-0.14, -0.08], [0.16, -0.06], [0, 0.18]].forEach(([x, z]) => K.add(sph(0.045, 8, 6), C.chocDark, { x, y: 0.125, z, sy: 0.7 }));
    K.shine(-0.12, 0.13, -0.1);
  },
  2: (K) => alfajor(K, 0.28, C.cream, 0xfff6e6, C.pink),
  3: (K) => alfajor(K, 0.4, 0x7fe0b0, 0xa8f0cf, C.white),
  4: (K) => alfajor(K, 0.4, 0xff9a3c, 0xffbf73, C.chocDark),
  5: (K) => alfajor(K, 0.4, 0xffd34d, 0xffe48a, C.choc),
  6: (K) => alfajor(K, 0.4, 0xff5f9e, 0xff8fbf, C.white),
  7: (K) => { // caja de alfajores con cinta dorada
    K.add(roundedBox(0.8, 0.3, 0.8, 0.08, 0.03), C.pink, { y: 0.15 });
    K.add(roundedBox(0.84, 0.08, 0.84, 0.08, 0.03), 0xff9ccb, { y: 0.32 });
    K.add(box(0.86, 0.36, 0.11), C.gold, { y: 0.18, gold: true });
    K.add(box(0.11, 0.36, 0.86), C.gold, { y: 0.18, gold: true });
    bow(K, C.gold, { y: 0.4 }, true);
    K.at({ x: 0.2, y: 0.36, z: 0.22, s: 0.45 }, () => alfajor(K, 0.4, 0xff5f9e, 0xff8fbf, C.white));
  },
  // --- cuchuflís ---
  11: (K) => { // obleas
    for (const [y, ry] of [[0.03, 0], [0.09, 0.35]]) K.at({ y, ry }, () => {
      K.add(roundedBox(0.56, 0.05, 0.56, 0.05, 0.015), C.wafer);
      for (let i = -1; i <= 1; i++) {
        K.add(box(0.5, 0.012, 0.025), C.waferDark, { y: 0.028, z: i * 0.15 });
        K.add(box(0.025, 0.012, 0.5), C.waferDark, { y: 0.028, x: i * 0.15 });
      }
    });
  },
  12: (K) => cuchufli(K, 0.74, 0.14, { y: 0.15, ry: 0.5 }),
  13: (K) => { cuchufli(K, 0.74, 0.14, { y: 0.15, z: -0.13, ry: 0.35 }); cuchufli(K, 0.74, 0.14, { y: 0.15, z: 0.15, ry: 0.55 }); },
  14: (K) => { // atado con cinta
    K.at({ ry: 0.45 }, () => {
      cuchufli(K, 0.78, 0.13, { y: 0.14, z: -0.14 });
      cuchufli(K, 0.78, 0.13, { y: 0.14, z: 0.14 });
      cuchufli(K, 0.78, 0.13, { y: 0.37 });
      K.add(tor(0.29, 0.035, 22), C.pink, { y: 0.24, ry: Math.PI / 2, sx: 1.25 });
      bow(K, C.pink, { y: 0.55, z: 0.02, s: 0.9 });
    });
  },
  15: (K) => { // frasco con cuchuflís asomando
    K.add(cyl(0.3, 0.29, 0.5, 22), C.glass, { y: 0.25 });
    K.add(tor(0.29, 0.035, 22), 0xffffff, { y: 0.5, rx: Math.PI / 2 });
    K.add(cyl(0.305, 0.305, 0.16, 22), C.pink, { y: 0.24 });
    K.add(cyl(0.08, 0.08, 0.02, 12), C.yellow, { y: 0.24, z: 0.305, rx: Math.PI / 2 });
    [[-0.1, -0.06, 0.15], [0.1, -0.04, -0.12], [0, 0.1, 0.05], [-0.04, -0.14, -0.2]].forEach(([x, z, rz]) => cuchufli(K, 0.5, 0.075, { x, y: 0.58, z, rz: Math.PI / 2 + rz }));
    K.add(box(0.05, 0.3, 0.02), C.white, { x: -0.14, y: 0.3, z: 0.26, ry: -0.5 });
  },
  16: (K) => { // torre de cuchuflís con estrella dorada
    K.add(cyl(0.42, 0.44, 0.06, 26), C.gold, { y: 0.03, gold: true });
    for (let l = 0; l < 4; l++) for (const o of [-0.12, 0.12]) cuchufli(K, 0.62, 0.1, l % 2 ? { x: o, y: 0.15 + l * 0.18, ry: Math.PI / 2 } : { z: o, y: 0.15 + l * 0.18 });
    K.add(extrude(starShape(0.16, 0.07), 0.04), C.gold, { y: 0.98, gold: true });
  },
  // --- bombones ---
  21: (K) => { // granos de cacao
    for (const [x, z, ry] of [[-0.12, 0.02, 0.4], [0.13, -0.04, -0.5]]) K.at({ x, z, ry, y: 0.1 }, () => {
      K.add(sph(0.2, 14, 10), C.cacao, { sx: 0.75, sy: 0.55, sz: 1.25 });
      K.add(box(0.025, 0.02, 0.4), 0x5a2a12, { y: 0.105 });
      K.shine(-0.06, 0.1, -0.08, 0.8);
    });
  },
  22: (K) => bombon(K, 0.27),
  23: (K) => { // bomba de chocolate con hilos dorados
    K.add(sph(0.38, 22, 16), C.choc, { y: 0.38 });
    for (const k of [-1, 0, 1]) {
      const rr = Math.sqrt(0.38 * 0.38 - (k * 0.17) ** 2);
      K.add(tor(rr + 0.004, 0.018, 28), C.gold, { y: 0.38 + k * 0.17, rx: Math.PI / 2, gold: true });
    }
    K.shine(-0.15, 0.6, 0.15, 1.6);
  },
  24: (K) => { // caja de bombones
    K.add(roundedBox(0.82, 0.16, 0.82, 0.08, 0.03), C.wine, { y: 0.08 });
    K.add(roundedBox(0.72, 0.03, 0.72, 0.06, 0.01), C.cream, { y: 0.17 });
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([x, z], i) => bombon(K, 0.14, { x: x * 0.18, y: 0.18, z: z * 0.18 }, i % 2 ? C.milk : C.chocDark, i % 2 ? C.white : C.pink, 0xffffff));
  },
  25: (K) => { // corazón de bombones
    K.add(extrude(heartShape(0.42), 0.14), C.berry, { y: 0.09, rx: -Math.PI / 2 });
    K.add(extrude(heartShape(0.36), 0.03), 0xffd0e2, { y: 0.17, rx: -Math.PI / 2 });
    [[-0.17, -0.1], [0.17, -0.1], [0, 0.04], [0, 0.22]].forEach(([x, z], i) => bombon(K, 0.11, { x, y: 0.18, z: -z }, i % 2 ? C.milk : C.chocDark, C.white, C.pink));
    bow(K, C.gold, { x: 0.3, y: 0.24, z: 0.2, s: 0.8 }, true);
  },
  26: (K) => { // bomba dorada con chispas de colores
    K.add(sph(0.42, 24, 18), C.gold, { y: 0.42, gold: true });
    const cols = [0xff4a8a, 0x2fd08a, 0xff7a1a, 0xffffff, 0x9a5cff, 0x4ab8ff];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const e = (i % 3) * 0.35 + 0.15;
      K.add(sph(0.05, 8, 6), cols[i % cols.length], { x: Math.cos(a) * Math.cos(e) * 0.42, y: 0.42 + Math.sin(e) * 0.42, z: Math.sin(a) * Math.cos(e) * 0.42 });
    }
  },
  // --- tabletas ---
  31: (K) => tableta(K, 2, 2, 0.16, C.choc, { ry: 0.4 }),
  32: (K) => K.at({ ry: -0.5 }, () => { // barrita con envoltorio
    tableta(K, 1, 4, 0.17);
    K.add(roundedBox(0.22, 0.13, 0.3, 0.04, 0.02), C.magenta, { y: 0.06, z: 0.21 });
    K.add(box(0.225, 0.135, 0.05), C.white, { y: 0.06, z: 0.18 });
  }),
  33: (K) => K.at({ ry: -0.35 }, () => { // tableta con envoltorio
    tableta(K, 3, 4, 0.16);
    K.add(roundedBox(0.53, 0.14, 0.34, 0.05, 0.02), C.magenta, { y: 0.07, z: 0.17 });
    K.add(box(0.535, 0.145, 0.06), C.white, { y: 0.07, z: 0.14 });
  }),
  34: (K) => K.at({ ry: -0.35 }, () => { // tableta rellena: se ve la capa de relleno
    K.add(roundedBox(0.53, 0.07, 0.67, 0.03, 0.015), C.choc, { y: 0.035 });
    K.add(box(0.5, 0.06, 0.64), 0xff8fbf, { y: 0.1 });
    tableta(K, 3, 4, 0.16, C.choc, { y: 0.13 });
    for (const x of [-0.17, 0, 0.17]) K.add(sph(0.03, 8, 6), 0xff8fbf, { x, y: 0.09, z: 0.33, sy: 1.5 });
  }),
  35: (K) => K.at({ ry: -0.3 }, () => { // tableta gigante con banda dorada
    tableta(K, 4, 5, 0.155);
    K.add(roundedBox(0.66, 0.15, 0.36, 0.05, 0.02), C.magenta, { y: 0.075, z: 0.22 });
    K.add(box(0.665, 0.155, 0.07), C.gold, { y: 0.075, z: 0.17, gold: true });
  }),
  36: (K) => K.at({ ry: -0.3 }, () => { // tableta de oro con cinta rosada
    K.add(roundedBox(0.6, 0.14, 0.76, 0.05, 0.025), C.gold, { y: 0.07, gold: true });
    K.add(box(0.62, 0.15, 0.09), C.pink, { y: 0.07 });
    K.add(box(0.09, 0.15, 0.78), C.pink, { y: 0.07 });
    bow(K, C.pink, { y: 0.17 });
  }),
  37: (K) => { // ¡Mati Dubai!: tableta partida con relleno de pistacho, hojitas de oro y corona
    K.add(cyl(0.45, 0.47, 0.05, 28), C.gold, { y: 0.025, gold: true });
    K.at({ y: 0.05, ry: -0.3 }, () => {
      K.at({ x: -0.15 }, () => {
        K.add(roundedBox(0.34, 0.07, 0.66, 0.03, 0.015), C.choc, { y: 0.035 });
        K.add(box(0.32, 0.08, 0.63), C.pistachio, { y: 0.1 });
        tableta(K, 2, 4, 0.16, C.choc, { y: 0.13 });
      });
      K.at({ x: 0.2, y: 0.12, rz: -0.5 }, () => {
        K.add(roundedBox(0.3, 0.07, 0.66, 0.03, 0.015), C.choc, { y: 0.035 });
        K.add(box(0.28, 0.08, 0.63), C.pistachio, { y: 0.1 });
        tableta(K, 2, 4, 0.14, C.choc, { y: 0.13 });
      });
      [[-0.2, -0.2], [-0.08, 0.15], [-0.22, 0.25], [0.15, -0.1]].forEach(([x, z], i) => K.add(box(0.06, 0.012, 0.05), C.gold, { x, y: 0.3, z, ry: i, gold: true }));
    });
    K.at({ y: 0.42, x: -0.12 }, () => {
      K.add(cyl(0.13, 0.14, 0.1, 10), C.gold, { gold: true });
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        K.add(new THREE.ConeGeometry(0.035, 0.1, 6), C.gold, { x: Math.cos(a) * 0.12, y: 0.09, z: Math.sin(a) * 0.12, gold: true });
      }
      K.add(sph(0.03, 8, 6), C.berry, { y: 0.01, z: 0.135 });
    });
  },
};

const cache = new Map();

/**
 * Geometrías de un producto: { candy, gold|null, h } (la altura sirve para la sombra y el salto).
 * Los productos más avanzados de cada familia se ven un poco más grandes.
 */
export function itemGeometry(code) {
  let g = cache.get(code);
  if (g) return g;
  const info = itemInfo(code);
  const K = new Kit();
  (RECIPES[code] || RECIPES[1])(K);
  g = K.build(1.12 + 0.2 * ((info.t - 1) / Math.max(1, info.max - 1)));
  cache.set(code, g);
  return g;
}

let mats = null;
/** Materiales compartidos: dulce brillante (colores por vértice) y dorado metálico. */
export function itemMaterials() {
  if (!mats) {
    mats = {
      candy: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.34, metalness: 0.04 }),
      gold: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.22, metalness: 0.6, emissive: 0x7a5200, emissiveIntensity: 0.45 }),
    };
  }
  return mats;
}

/** Un producto listo para poner en la escena (grupo con 1 o 2 mallas). */
export function makeItemMesh(code) {
  const g = itemGeometry(code);
  const m = itemMaterials();
  const root = new THREE.Group();
  root.add(new THREE.Mesh(g.candy, m.candy));
  if (g.gold) root.add(new THREE.Mesh(g.gold, m.gold));
  root.userData.noToon = true;
  root.userData.h = g.h;
  root.userData.w = g.w;
  return root;
}
