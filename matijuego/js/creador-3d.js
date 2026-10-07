// Construye en 3D la creación del usuario ("Crea tu Chocolate"): el producto,
// sus toppings, el envoltorio y la etiqueta como sticker. Solo primitivas.

import { THREE, roundedBox, canvasTexture } from "./three-kit.js";
import { getChocolate, getFlavor, getTopping, getWrapColor, comboKey } from "./creador-data.js";

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedOf(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const glossy = (hex, rough = 0.32) => new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: 0.06 });
const matte = (hex, rough = 0.7) => new THREE.MeshStandardMaterial({ color: hex, roughness: rough });
const shade = (hex, amt) => new THREE.Color(hex).offsetHSL(0, 0, amt);

let waferTex = null;
function getWaferTexture() {
  if (!waferTex) {
    waferTex = canvasTexture(128, 128, (g, w, h) => {
      g.fillStyle = "#d9a463";
      g.fillRect(0, 0, w, h);
      g.strokeStyle = "#a9702f";
      g.lineWidth = 3;
      for (let i = -h; i < w + h; i += 22) {
        g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke();
        g.beginPath(); g.moveTo(i, h); g.lineTo(i + h, 0); g.stroke();
      }
    });
    waferTex.wrapS = waferTex.wrapT = THREE.RepeatWrapping;
    waferTex.repeat.set(3, 2);
  }
  return waferTex;
}

function disc(r, h, mat) {
  const pts = [
    new THREE.Vector2(0, 0), new THREE.Vector2(r - 0.12, 0), new THREE.Vector2(r, 0.08),
    new THREE.Vector2(r, h - 0.08), new THREE.Vector2(r - 0.12, h), new THREE.Vector2(0, h),
  ];
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 44), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function cast(o) {
  o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return o;
}

// ---------- productos: devuelven { group, top, dims } ----------

function buildProduct(cfg) {
  const choc = getChocolate(cfg.chocolate).color;
  const fill = getFlavor(cfg.flavor).color;
  const mat = glossy(choc);
  const lighter = glossy(shade(choc, 0.05));
  const fillMat = matte(fill, 0.55);
  const g = new THREE.Group();

  if (cfg.product === "barra") {
    const slab = new THREE.Mesh(roundedBox(3.0, 0.3, 4.2, 0.14, 0.04), mat);
    slab.position.y = 0.15;
    g.add(slab);
    for (let c = 0; c < 3; c++) {
      for (let r = 0; r < 4; r++) {
        const x = (c - 1) * 0.95;
        const z = (r - 1.5) * 0.98;
        if (c === 2 && r === 0) {
          const bite = new THREE.Mesh(roundedBox(0.82, 0.1, 0.82, 0.08, 0.03), fillMat);
          bite.position.set(x, 0.3, z);
          g.add(bite);
          continue;
        }
        const sq = new THREE.Mesh(roundedBox(0.82, 0.12, 0.82, 0.1, 0.03), lighter);
        sq.position.set(x, 0.36, z);
        g.add(sq);
      }
    }
    cast(g);
    return { group: g, top: { shape: "rect", y: 0.44, rx: 1.15, rz: 1.65, cx: 0, cz: 0.15 }, dims: { shape: "box", w: 3.0, h: 0.5, d: 4.2, cy: 0.25 } };
  }

  if (cfg.product === "alfajor") {
    const bottom = disc(1.15, 0.4, mat);
    const top = disc(1.15, 0.4, mat);
    top.position.y = 0.78;
    const filling = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 1.08, 0.42, 40), fillMat);
    filling.position.y = 0.6;
    g.add(bottom, filling, top);
    cast(g);
    return { group: g, top: { shape: "ellipse", y: 1.18, rx: 0.88, rz: 0.88, cx: 0, cz: 0 }, dims: { shape: "disc", r: 1.15, h: 1.18, cy: 0.59 } };
  }

  if (cfg.product === "cuchufli") {
    const wafer = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 3.4, 28), new THREE.MeshStandardMaterial({ map: getWaferTexture(), roughness: 0.8 }));
    wafer.rotation.z = Math.PI / 2;
    const coat = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 2.1, 30), mat);
    coat.rotation.z = Math.PI / 2;
    coat.position.x = -0.65;
    const fd = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 24), fillMat);
    fd.rotation.z = Math.PI / 2;
    fd.position.x = 1.69;
    g.add(wafer, coat, fd);
    const drizzle = [0xffc800, 0xd4216c, 0xfff6e6];
    for (let i = 0; i < 6; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.405, 0.03, 6, 28), glossy(drizzle[i % 3], 0.4));
      ring.rotation.y = Math.PI / 2;
      ring.position.x = -1.5 + i * 0.36;
      g.add(ring);
    }
    g.position.y = 0.42;
    g.rotation.y = -0.45;
    const wrap = new THREE.Group();
    wrap.add(g);
    cast(wrap);
    return { group: wrap, top: { shape: "rect", y: 0.84, rx: 0.95, rz: 0.12, cx: -0.65, cz: 0, rotY: -0.45 }, dims: { shape: "tube", len: 3.4, r: 0.42, cy: 0.42, rotY: -0.45 } };
  }

  if (cfg.product === "bomba") {
    const ball = new THREE.Mesh(new THREE.SphereGeometry(1.05, 40, 28), mat);
    ball.position.y = 1.05;
    g.add(ball);
    const dr = [0xffc800, 0xfff6e6, 0xd4216c, 0xffc800];
    for (let i = 0; i < 4; i++) {
      const arc = new THREE.Mesh(new THREE.TorusGeometry(1.07, 0.035, 6, 36, Math.PI * 1.1), glossy(dr[i], 0.4));
      arc.position.y = 1.05;
      arc.rotation.set(0.5 + i * 0.35, i * 0.8, i * 0.5);
      g.add(arc);
    }
    const crater = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.1, 28), fillMat);
    crater.position.y = 2.04;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.07, 8, 28), mat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 2.03;
    g.add(crater, rim);
    cast(g);
    return { group: g, top: { shape: "ellipse", y: 2.1, rx: 0.42, rz: 0.42, cx: 0, cz: 0 }, dims: { shape: "sphere", r: 1.05, cy: 1.05 } };
  }

  // cono
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.45, 0.5, 18), matte(0xd4216c, 0.5));
  cup.position.y = 0.25;
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.95, 2.6, 30, 1, true), new THREE.MeshStandardMaterial({ map: getWaferTexture(), roughness: 0.8, side: THREE.DoubleSide }));
  cone.rotation.x = Math.PI;
  cone.position.y = 1.8;
  const rimT = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.1, 10, 34), mat);
  rimT.rotation.x = Math.PI / 2;
  rimT.position.y = 3.1;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.93, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), fillMat);
  dome.scale.y = 0.72;
  dome.position.y = 3.1;
  g.add(cup, cone, rimT, dome);
  for (let i = 0; i < 4; i++) {
    const st = new THREE.Mesh(new THREE.TorusGeometry(0.7 - i * 0.12, 0.03, 6, 26), mat);
    st.rotation.x = Math.PI / 2;
    st.position.y = 3.1 + Math.sqrt(Math.max(0, 1 - ((0.7 - i * 0.12) / 0.93) ** 2)) * 0.67 * 0.93;
    g.add(st);
  }
  cast(g);
  return { group: g, top: { shape: "ellipse", y: 3.74, rx: 0.34, rz: 0.34, cx: 0, cz: 0 }, dims: { shape: "cone", r: 0.95, h: 3.8, cy: 1.9 } };
}

// ---------- toppings ----------

function scatter(group, area, toppings, rng) {
  const place = () => {
    for (let i = 0; i < 40; i++) {
      const x = (rng() * 2 - 1) * area.rx;
      const z = (rng() * 2 - 1) * area.rz;
      if (area.shape === "ellipse" && (x / area.rx) ** 2 + (z / area.rz) ** 2 > 1) continue;
      const cos = Math.cos(area.rotY || 0);
      const sin = Math.sin(area.rotY || 0);
      return [area.cx + x * cos - z * sin, area.cz + x * sin + z * cos];
    }
    return [area.cx, area.cz];
  };
  const make = (geo, mat, count, setup) => {
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(geo, mat);
      const [x, z] = place();
      m.position.set(x, area.y + 0.035 + rng() * 0.05, z);
      setup(m, i);
      m.castShadow = true;
      group.add(m);
    }
  };
  for (const id of toppings) {
    const color = getTopping(id).color;
    if (id === "pistacho") make(new THREE.BoxGeometry(0.11, 0.07, 0.1), matte(color, 0.6), 26, (m) => (m.rotation.y = rng() * 6));
    else if (id === "kataifi") make(new THREE.CylinderGeometry(0.014, 0.014, 0.36, 5), matte(color, 0.7), 26, (m) => { m.rotation.set(0, rng() * 6, Math.PI / 2); });
    else if (id === "almendras") make(new THREE.SphereGeometry(0.1, 10, 8), matte(color, 0.75), 14, (m) => { m.scale.set(1.5, 0.7, 0.95); m.rotation.y = rng() * 6; });
    else if (id === "coco") make(new THREE.SphereGeometry(0.05, 6, 5), matte(color, 0.9), 40, () => {});
    else if (id === "chispas") {
      const cols = [0xff6fa8, 0xffc800, 0x4cc3ff, 0x7bd85a, 0xffffff];
      make(new THREE.CylinderGeometry(0.03, 0.03, 0.14, 6), matte(0xffffff, 0.5), 34, (m, i) => {
        m.material = matte(cols[i % cols.length], 0.5);
        m.rotation.set(Math.PI / 2, 0, rng() * 6);
      });
    } else if (id === "frambuesa") make(new THREE.SphereGeometry(0.075, 8, 6), matte(color, 0.8), 14, (m) => m.scale.set(1, 0.8, 1));
    else if (id === "oro") make(new THREE.BoxGeometry(0.15, 0.012, 0.15), new THREE.MeshStandardMaterial({ color: 0xffc800, roughness: 0.2, metalness: 0.8 }), 22, (m) => { m.rotation.set(rng() * 0.6, rng() * 6, rng() * 0.6); });
  }
}

// ---------- etiqueta ----------

export function makeLabelMesh(texture, size) {
  const g = new THREE.Group();
  const back = new THREE.Mesh(new THREE.CircleGeometry(size / 2, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
  const face = new THREE.Mesh(new THREE.CircleGeometry(size / 2, 40), new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide }));
  face.position.z = 0.004;
  g.add(back, face);
  return g;
}

// ---------- envoltorios ----------

function paperShape(dims, mat, ruffle) {
  const g = new THREE.Group();
  if (dims.shape === "box") {
    const w = new THREE.Mesh(roundedBox(dims.w + 0.3, dims.h + 0.35, dims.d + 0.3, 0.16, 0.05), mat);
    w.position.y = dims.cy + 0.08;
    g.add(w);
    const band = new THREE.Mesh(roundedBox(dims.w + 0.34, dims.h + 0.38, 1.0, 0.1, 0.03), matte(0xfff6e6, 0.6));
    band.position.y = dims.cy + 0.08;
    g.add(band);
  } else if (dims.shape === "disc") {
    const geo = new THREE.IcosahedronGeometry(dims.r + 0.3, 3);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const k = 1 + (Math.sin(i * 12.9898) * 43758.5453 % 1) * 0.07;
      p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k);
    }
    geo.computeVertexNormals();
    const w = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: mat.color, roughness: mat.roughness, flatShading: true, transparent: mat.transparent, opacity: mat.opacity, depthWrite: mat.depthWrite }));
    w.scale.set(1, 0.62, 1);
    w.position.y = dims.cy + 0.1;
    g.add(w);
  } else if (dims.shape === "tube") {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(dims.r + 0.14, dims.r + 0.14, dims.len + 0.3, 24), mat);
    w.rotation.z = Math.PI / 2;
    w.position.y = dims.cy;
    g.add(w);
    for (const s of [-1, 1]) {
      const tw = new THREE.Mesh(new THREE.ConeGeometry(dims.r + 0.12, 0.7, 14), mat);
      tw.rotation.z = -s * Math.PI / 2;
      tw.position.set(s * (dims.len / 2 + 0.5), dims.cy, 0);
      tw.scale.set(1, 1, 0.45);
      g.add(tw);
    }
    g.rotation.y = dims.rotY || 0;
  } else if (dims.shape === "sphere") {
    const w = new THREE.Mesh(new THREE.SphereGeometry(dims.r + 0.28, 32, 22), mat);
    w.position.y = dims.cy;
    g.add(w);
    const tw = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.8, 14), mat);
    tw.position.y = dims.cy + dims.r + 0.65;
    g.add(tw);
  } else {
    const w = new THREE.Mesh(new THREE.ConeGeometry(1.12, 3.9, 28, 1, true), new THREE.MeshStandardMaterial({ color: mat.color, roughness: mat.roughness, side: THREE.DoubleSide, transparent: mat.transparent, opacity: mat.opacity, depthWrite: mat.depthWrite }));
    w.rotation.x = Math.PI;
    w.position.y = 1.95;
    g.add(w);
    const rf = new THREE.Mesh(new THREE.TorusGeometry(1.12, 0.14, 10, 30), mat);
    rf.rotation.x = Math.PI / 2;
    rf.position.y = 3.9;
    g.add(rf);
    if (ruffle) {
      const fan = new THREE.Mesh(new THREE.ConeGeometry(1.25, 0.6, 28, 1, true), new THREE.MeshStandardMaterial({ color: mat.color, side: THREE.DoubleSide, roughness: 0.6 }));
      fan.position.y = 4.15;
      g.add(fan);
    }
  }
  return g;
}

/**
 * Arma toda la creación. labelTexture es la textura del sticker.
 * Devuelve { group, height } (height: alto aproximado para encuadrar).
 */
export function buildCreation(cfg, labelTexture) {
  const root = new THREE.Group();
  const rng = mulberry(seedOf(comboKey(cfg)));
  const product = buildProduct(cfg);
  scatter(product.group, product.top, cfg.toppings, rng);
  root.add(product.group);
  const d = product.dims;
  const paperColor = getWrapColor(cfg.wrapColor).color;
  const paperMat = glossy(paperColor, 0.55);
  let labelSize = 1.5;
  const label = makeLabelMesh(labelTexture, 1.5);

  const front = { pos: new THREE.Vector3(), rotX: 0, rotY: 0 };
  const top = d.shape === "cone" ? 3.9 : d.shape === "sphere" ? 2.4 : d.shape === "tube" ? 1.0 : d.shape === "disc" ? 1.3 : 0.55;

  if (cfg.wrap === "ninguno") {
    front.pos.set(1.55, 0.85, 2.2);
    front.rotY = -0.25;
    labelSize = 1.5;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.03, 8, 40), glossy(0xffc800, 0.3));
    rim.position.copy(front.pos);
    rim.rotation.y = front.rotY;
    root.add(rim);
    label.scale.setScalar(1.12);
  } else if (cfg.wrap === "papel") {
    product.group.visible = false;
    root.add(paperShape(d, paperMat, true));
    label.scale.setScalar(d.shape === "box" ? 1.05 : d.shape === "tube" ? 0.75 : 0.95);
    if (d.shape === "box") { front.pos.set(0, d.cy + 0.08 + (d.h + 0.35) / 2 + 0.02, 0.2); front.rotX = -Math.PI / 2 + 0.25; }
    else if (d.shape === "disc") { front.pos.set(0, d.cy + 0.78, 0.45); front.rotX = -0.75; }
    else if (d.shape === "tube") { front.pos.set(0, d.cy + 0.02, d.r + 0.2); front.rotY = 0; }
    else if (d.shape === "sphere") { front.pos.set(0, d.cy + 0.1, d.r + 0.3); }
    else { front.pos.set(0, 2.55, 0.86); front.rotX = 0.28; label.scale.setScalar(1.05); }
  } else if (cfg.wrap === "bolsa") {
    const clear = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.15, transparent: true, opacity: 0.2, depthWrite: false });
    const bag = paperShape(d, clear, false);
    root.add(bag);
    const ribY = d.shape === "cone" ? 4.35 : top + 0.45;
    const neck = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.9, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false }));
    neck.position.y = ribY + 0.1;
    neck.rotation.x = Math.PI;
    if (d.shape !== "tube") root.add(neck);
    const ribbon = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.06, 8, 22), glossy(paperColor, 0.4));
    ribbon.rotation.x = Math.PI / 2;
    ribbon.position.y = ribY - 0.12;
    if (d.shape !== "tube") root.add(ribbon);
    for (const s of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 4), glossy(paperColor, 0.4));
      wing.position.set(s * 0.3, ribY - 0.12, 0.34);
      wing.rotation.z = -s * Math.PI / 2;
      root.add(wing);
    }
    label.scale.setScalar(0.7);
    front.pos.set(0, ribY - 0.95, 0.9);
    if (d.shape === "tube") front.pos.set(0, d.cy + 0.9, 0.9);
    const string = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.6, 5), matte(0x4b2e2e));
    string.position.set(0, front.pos.y + 0.55, 0.62);
    if (d.shape !== "tube") root.add(string);
  } else {
    // caja
    const bw = Math.max(3.4, d.shape === "box" ? d.w + 0.5 : d.shape === "tube" ? 3.8 : d.shape === "disc" ? d.r * 2 + 0.6 : d.shape === "sphere" ? 2.7 : 2.7);
    const bd = d.shape === "box" ? 4.5 : 3.0;
    const bh = d.shape === "cone" ? 1.4 : 1.3;
    const boxMat = glossy(paperColor, 0.5);
    const wall = (w, h, dd, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, dd), boxMat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      root.add(m);
    };
    wall(bw, 0.1, bd, 0, 0.05 - 0.02, 0);
    wall(bw, bh, 0.1, 0, bh / 2, bd / 2);
    wall(bw, bh, 0.1, 0, bh / 2, -bd / 2);
    wall(0.1, bh, bd, bw / 2, bh / 2, 0);
    wall(0.1, bh, bd, -bw / 2, bh / 2, 0);
    product.group.position.y = 0.1;
    const tissue = new THREE.Mesh(new THREE.CylinderGeometry(bw / 2 - 0.15, bw / 2 - 0.15, 0.12, 4), matte(0xfff6e6, 0.9));
    tissue.rotation.y = Math.PI / 4;
    tissue.scale.z = bd / bw;
    tissue.position.y = 0.12;
    root.add(tissue);
    const lid = new THREE.Group();
    const lidTop = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.2, 0.14, bd + 0.2), boxMat);
    lidTop.castShadow = true;
    lid.add(lidTop);
    const rib1 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, bd + 0.24), glossy(0xffc800, 0.3));
    lid.add(rib1);
    lid.position.set(0, 1.2, -bd / 2 - 0.9);
    lid.rotation.x = -1.2;
    root.add(lid);
    label.scale.setScalar(0.95);
    front.pos.set(0, 1.2 + 0.1, -bd / 2 - 0.9 + 0.17);
    front.rotX = -1.2;
    front.pos.add(new THREE.Vector3(0, 0.42, 0.9));
    front.pos.set(0, 2.25, -bd / 2 - 0.35);
    front.rotX = -0.28;
  }

  label.position.copy(front.pos);
  label.rotation.set(front.rotX, front.rotY, 0);
  root.add(label);
  return { group: root, height: Math.max(top, d.shape === "cone" ? 4.5 : top + 0.8) };
}
