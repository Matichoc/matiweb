// Modelos 3D del guardarropa: viste a un Matichico (ver js/matichico3d.js) con peinados, caras,
// sombreros, anteojos, cuello, espalda, zapatos, ropa y tono de chocolate. Solo usa primitivas
// de Three.js. `applyLook(hero, look)` deja puesto exactamente lo que dice `look` y quita lo anterior.

import { THREE, roundedBox, canvasTexture } from "./three-kit.js?v=d2f30b74ef";
import { getItem, getOutfit, EMPTY_LOOK } from "./wardrobe-data.js?v=d2f30b74ef";
import { buildPet } from "./wardrobe-pets.js?v=d2f30b74ef";

export const HEAD_W = 0.78;
export const HEAD_H = 0.72;
export const HEAD_D = 0.64;
const TOP = HEAD_H / 2;
const FZ = HEAD_D / 2;

const std = (color, rough = 0.5, extra = {}) => {
  const m = new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });
  m.userData.own = true;
  return m;
};
const basic = (color, extra = {}) => {
  const m = new THREE.MeshBasicMaterial({ color, ...extra });
  m.userData.own = true;
  return m;
};
const mesh = (geo, mat, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
};
const hex = (c) => new THREE.Color(c);

function disposeTree(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) if (m.userData && m.userData.own) { if (m.map) m.map.dispose(); m.dispose(); }
  });
}

function starShape(r1, r2, n = 5) {
  const s = new THREE.Shape();
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 ? r2 : r1;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
  }
  s.closePath();
  return s;
}

function heartShape(s = 0.1) {
  const sh = new THREE.Shape();
  sh.moveTo(0, -s);
  sh.bezierCurveTo(-s * 1.6, -s * 0.2, -s * 1.1, s * 1.1, 0, s * 0.45);
  sh.bezierCurveTo(s * 1.1, s * 1.1, s * 1.6, -s * 0.2, 0, -s);
  return sh;
}

const flat = (shape, depth = 0.02) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });

// ---------------------------------------------------------------- peinados

function buildHair(hero, params) {
  const g = new THREE.Group();
  const hairMat = hero.mats.hair;
  const cap = (h = 0.14) => {
    const c = mesh(roundedBox(HEAD_W + 0.04, h, HEAD_D + 0.04, 0.07, 0.02), hairMat, 0, TOP - h / 2 + 0.02, 0);
    g.add(c);
    return c;
  };
  const tie = (x, y, z, color = 0xd4216c) => g.add(mesh(new THREE.SphereGeometry(0.045, 8, 6), std(color, 0.4), x, y, z));
  const cone = (x, y, z, r, h, rx = 0, rz = 0) => {
    const c = mesh(new THREE.ConeGeometry(r, h, 6), hairMat, x, y, z);
    c.rotation.set(rx, 0, rz);
    g.add(c);
  };
  switch (params.style) {
    case "corto": {
      cap(0.16);
      g.add(mesh(roundedBox(0.7, 0.1, 0.06, 0.03, 0.015), hairMat, 0, TOP - 0.1, FZ + 0.02));
      break;
    }
    case "flequillo": {
      cap(0.2);
      g.add(mesh(roundedBox(HEAD_W + 0.04, 0.2, 0.07, 0.03, 0.015), hairMat, 0, TOP - 0.15, FZ + 0.03));
      for (const s of [-1, 1]) g.add(mesh(roundedBox(0.07, 0.55, 0.5, 0.03, 0.015), hairMat, s * (HEAD_W / 2 + 0.02), -0.02, -0.03));
      break;
    }
    case "colitas": {
      cap(0.14);
      for (const s of [-1, 1]) {
        const tail = mesh(new THREE.CapsuleGeometry(0.075, 0.34, 4, 8), hairMat, s * 0.47, 0.06, -0.06);
        tail.rotation.z = -s * 0.4;
        g.add(tail);
        tie(s * 0.4, 0.2, -0.05);
      }
      break;
    }
    case "monos": {
      cap(0.14);
      for (const s of [-1, 1]) {
        g.add(mesh(new THREE.SphereGeometry(0.17, 12, 10), hairMat, s * 0.25, TOP + 0.1, -0.02));
        tie(s * 0.25, TOP + 0.0, -0.02);
      }
      break;
    }
    case "rulos": {
      cap(0.12);
      const R = 0.09;
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        g.add(mesh(new THREE.SphereGeometry(R, 8, 6), hairMat, Math.cos(a) * 0.32, TOP + 0.05, Math.sin(a) * 0.25 - 0.03));
      }
      for (let i = 0; i < 5; i++) g.add(mesh(new THREE.SphereGeometry(R * 1.1, 8, 6), hairMat, (i - 2) * 0.12, TOP + 0.12, -0.02));
      for (const s of [-1, 1]) for (let k = 0; k < 3; k++) g.add(mesh(new THREE.SphereGeometry(R, 8, 6), hairMat, s * (HEAD_W / 2 + 0.05), 0.16 - k * 0.15, -0.08));
      break;
    }
    case "afro": {
      const p = mesh(new THREE.SphereGeometry(0.4, 16, 12), hairMat, 0, TOP + 0.12, -0.1);
      p.scale.set(1.1, 0.9, 1);
      g.add(p);
      break;
    }
    case "largo": {
      cap(0.16);
      g.add(mesh(roundedBox(HEAD_W + 0.06, 0.95, 0.12, 0.05, 0.02), hairMat, 0, -0.15, -FZ - 0.0));
      for (const s of [-1, 1]) g.add(mesh(roundedBox(0.08, 0.62, 0.14, 0.03, 0.015), hairMat, s * (HEAD_W / 2 + 0.01), -0.05, -0.1));
      break;
    }
    case "trenza": {
      cap(0.14);
      for (let i = 0; i < 5; i++) g.add(mesh(new THREE.SphereGeometry(0.09 - i * 0.008, 8, 6), hairMat, 0.26, -0.02 - i * 0.15, -FZ - 0.06));
      tie(0.26, -0.8, -FZ - 0.06);
      g.add(mesh(roundedBox(HEAD_W + 0.02, 0.4, 0.1, 0.04, 0.015), hairMat, 0, 0.1, -FZ + 0.01));
      break;
    }
    case "mohicano": {
      for (let i = 0; i < 6; i++) cone(0, TOP + 0.08 + (i % 2) * 0.02, 0.22 - i * 0.09, 0.06, 0.3 - i * 0.025);
      cap(0.05);
      break;
    }
    case "puas": {
      cap(0.1);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        cone(Math.cos(a) * 0.3, TOP + 0.1, Math.sin(a) * 0.22, 0.06, 0.28, Math.sin(a) * 0.5, -Math.cos(a) * 0.5);
      }
      for (let i = 0; i < 3; i++) cone((i - 1) * 0.14, TOP + 0.16, 0, 0.06, 0.32);
      break;
    }
    case "copete": {
      cap(0.14);
      const q = mesh(roundedBox(0.5, 0.17, 0.3, 0.07, 0.02), hairMat, 0, TOP + 0.1, 0.1);
      q.rotation.x = -0.3;
      g.add(q);
      break;
    }
    case "pelado":
    default:
      break;
  }
  return g;
}

// ---------------------------------------------------------------- caras

const eyeX = 0.17;
const eyeY = 0.05;

function buildFace(hero, p) {
  const g = new THREE.Group();
  const dark = basic(0x2b1a10);
  const z = FZ + 0.006;
  const hideEyes = p.eyes !== "normal" ? [0, 1] : [];
  if (p.eyes === "guino") hideEyes.splice(0, 2, 1); // solo el ojo derecho
  hideEyes.forEach((i) => { if (hero.eyes[i]) hero.eyes[i].visible = false; });
  const hideBrows = p.eyes !== "normal";
  if (hideBrows) hero.brows.forEach((b) => (b.visible = false));

  const arc = (x, up) => {
    const a = mesh(new THREE.TorusGeometry(0.075, 0.02, 6, 14, Math.PI), dark, x, eyeY + (up ? -0.03 : 0.03), z);
    if (!up) a.rotation.z = Math.PI;
    a.castShadow = false;
    g.add(a);
  };
  const eyeShape = (x, geo, mat) => {
    const m = mesh(geo, mat, x, eyeY, z + 0.004);
    m.castShadow = false;
    g.add(m);
    return m;
  };
  for (const sx of [-1, 1]) {
    const x = sx * eyeX;
    if (p.eyes === "feliz") arc(x, true);
    else if (p.eyes === "dormido") arc(x, false);
    else if (p.eyes === "guino" && sx === 1) arc(x, true);
    else if (p.eyes === "estrella") {
      const geo = flat(starShape(0.12, 0.05), 0.02);
      geo.translate(0, 0, -0.01);
      eyeShape(x, geo, std(0xffc800, 0.3, { emissive: 0xffa800, emissiveIntensity: 0.7 }));
    } else if (p.eyes === "corazon") {
      const geo = flat(heartShape(0.1), 0.02);
      eyeShape(x, geo, std(0xff3b6e, 0.3, { emissive: 0xaa1030, emissiveIntensity: 0.6 }));
    }
  }

  // boca
  if (p.mouth !== "sonrisa") {
    if (p.mouth !== "lengua") hero.mouth.visible = false;
    if (p.mouth === "grande") {
      const m = mesh(new THREE.CircleGeometry(0.13, 18, Math.PI, Math.PI), dark, 0, -0.07, z);
      m.castShadow = false;
      g.add(m);
      const t = mesh(new THREE.CircleGeometry(0.07, 14, Math.PI, Math.PI), basic(0xff6f8e), 0, -0.1, z + 0.002);
      t.castShadow = false;
      g.add(t);
    } else if (p.mouth === "lengua") {
      const t = mesh(new THREE.SphereGeometry(0.05, 10, 8), std(0xff6f8e, 0.5), 0.05, -0.17, z + 0.01);
      t.scale.set(1, 1.35, 0.4);
      g.add(t);
    } else if (p.mouth === "gato") {
      for (const sx of [-1, 1]) {
        const a = mesh(new THREE.TorusGeometry(0.045, 0.014, 6, 12, Math.PI), dark, sx * 0.045, -0.09, z);
        a.rotation.z = Math.PI;
        a.castShadow = false;
        g.add(a);
      }
    } else if (p.mouth === "o") {
      const o = mesh(new THREE.TorusGeometry(0.04, 0.016, 6, 12), dark, 0, -0.12, z);
      o.castShadow = false;
      g.add(o);
    }
  }

  for (const ex of p.extras || []) {
    if (ex === "pecas") {
      const fm = basic(0x6b3d22);
      for (const sx of [-1, 1]) for (const [dx, dy] of [[0, 0], [0.05, 0.03], [-0.04, 0.04], [0.02, -0.03]]) {
        const d = mesh(new THREE.CircleGeometry(0.014, 6), fm, sx * 0.26 + dx, -0.04 + dy, z);
        d.castShadow = false;
        g.add(d);
      }
    } else if (ex === "mejillas") {
      for (const sx of [-1, 1]) {
        const c = mesh(new THREE.CircleGeometry(0.06, 14), basic(0xd4216c, { transparent: true, opacity: 0.45 }), sx * 0.3, -0.07, z - 0.001);
        c.castShadow = false;
        g.add(c);
      }
    } else if (ex === "bigotes") {
      for (const sx of [-1, 1]) for (const k of [-1, 0, 1]) {
        const w = mesh(new THREE.BoxGeometry(0.16, 0.008, 0.008), dark, sx * 0.36, -0.1 + k * 0.035, z + 0.004);
        w.rotation.z = sx * k * 0.18;
        w.castShadow = false;
        g.add(w);
      }
    } else if (ex === "bigote") {
      const mm = std(0x3b2414, 0.7);
      for (const sx of [-1, 1]) {
        const c = mesh(new THREE.CapsuleGeometry(0.03, 0.15, 4, 8), mm, sx * 0.08, -0.045, z + 0.02);
        c.rotation.z = Math.PI / 2 - sx * 0.35;
        g.add(c);
      }
    }
  }
  return g;
}

// ---------------------------------------------------------------- sombreros

function stripeTexture(a, b) {
  const t = canvasTexture(64, 64, (c, w, h) => {
    c.fillStyle = a; c.fillRect(0, 0, w, h);
    c.fillStyle = b;
    for (let i = -h; i < w + h; i += 16) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + 8, 0); c.lineTo(i + 8 + h, h); c.lineTo(i + h, h); c.fill(); }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function buildHat(hero, p, ticks) {
  const g = new THREE.Group();
  const col = p.color || "#d4216c";
  switch (p.kind) {
    case "bruja": {
      const dark = std(0x2a1840, 0.7);
      g.add(mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.03, 24), dark, 0, TOP + 0.02, 0));
      const cone = mesh(new THREE.ConeGeometry(0.28, 0.75, 16), dark, 0.03, TOP + 0.4, 0);
      cone.rotation.z = -0.15;
      g.add(cone, mesh(new THREE.TorusGeometry(0.285, 0.04, 6, 20), std(0xff8a2a, 0.5), 0, TOP + 0.1, 0).rotateX(Math.PI / 2));
      g.add(mesh(new THREE.BoxGeometry(0.1, 0.1, 0.03), std(0xffc800, 0.3, { metalness: 0.6 }), 0, TOP + 0.1, 0.29));
      break;
    }
    case "santa": {
      const red = std(0xe83a3a, 0.8);
      const white = std(0xffffff, 0.95);
      const cone = mesh(new THREE.ConeGeometry(0.3, 0.6, 16), red, -0.03, TOP + 0.3, 0);
      cone.rotation.z = 0.25;
      g.add(cone, mesh(new THREE.TorusGeometry(0.3, 0.06, 8, 20), white, 0, TOP + 0.04, 0).rotateX(Math.PI / 2), mesh(new THREE.SphereGeometry(0.08, 10, 8), white, -0.2, TOP + 0.58, 0));
      break;
    }
    case "chupalla": {
      const straw = std(0xe8c27a, 0.9);
      g.add(mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.04, 24), straw, 0, TOP + 0.02, 0));
      g.add(mesh(new THREE.CylinderGeometry(0.24, 0.27, 0.22, 20), straw, 0, TOP + 0.14, 0));
      for (const [i, c] of [0xd52b1e, 0xffffff, 0x0039a6].entries()) g.add(mesh(new THREE.TorusGeometry(0.265, 0.018, 6, 20), std(c, 0.6), 0, TOP + 0.08 + i * 0.03, 0).rotateX(Math.PI / 2));
      break;
    }
    case "rosas": {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        g.add(mesh(new THREE.SphereGeometry(0.075, 8, 6), std(i % 3 === 0 ? 0xff9ab8 : 0xe83a6a, 0.6), Math.cos(a) * 0.3, TOP + 0.05, Math.sin(a) * 0.27));
        if (i % 2) g.add(mesh(new THREE.ConeGeometry(0.04, 0.1, 4), std(0x3fa24a, 0.7), Math.cos(a + 0.2) * 0.31, TOP + 0.04, Math.sin(a + 0.2) * 0.28));
      }
      break;
    }
    case "gorra": {
      const dome = mesh(new THREE.SphereGeometry(0.43, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), std(col, 0.5), 0, TOP - 0.06, -0.01);
      dome.scale.set(1, 0.8, 0.95);
      g.add(dome, mesh(roundedBox(0.5, 0.04, 0.3, 0.02, 0.01), std(col, 0.5), 0, TOP - 0.03, FZ + 0.14), mesh(new THREE.SphereGeometry(0.04, 8, 6), std(0xffffff, 0.4), 0, TOP + 0.27, 0));
      break;
    }
    case "gorro": {
      const dome = mesh(new THREE.SphereGeometry(0.42, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), std(col, 0.9), 0, TOP - 0.05, 0);
      dome.scale.set(1, 0.9, 0.95);
      const rim = mesh(new THREE.TorusGeometry(0.4, 0.06, 8, 24), std(0xfff6e6, 0.9), 0, TOP - 0.04, 0);
      rim.rotation.x = Math.PI / 2;
      rim.scale.set(1, 0.95, 1);
      g.add(dome, rim, mesh(new THREE.SphereGeometry(0.1, 10, 8), std(0xffffff, 0.95), 0, TOP + 0.36, 0));
      break;
    }
    case "fiesta": {
      const cone = mesh(new THREE.ConeGeometry(0.22, 0.55, 16), std(0xffffff, 0.5, { map: stripeTexture(p.a || "#d4216c", p.b || "#ffc800") }), 0.0, TOP + 0.27, 0);
      cone.rotation.z = 0.12;
      g.add(cone, mesh(new THREE.SphereGeometry(0.07, 8, 6), std(0xcfd767, 0.6), 0.07, TOP + 0.55, 0));
      break;
    }
    case "chef": {
      g.add(mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.2, 18), std(0xffffff, 0.8), 0, TOP + 0.08, 0));
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.add(mesh(new THREE.SphereGeometry(0.15, 10, 8), std(0xffffff, 0.8), Math.cos(a) * 0.17, TOP + 0.28, Math.sin(a) * 0.17)); }
      g.add(mesh(new THREE.SphereGeometry(0.18, 10, 8), std(0xffffff, 0.8), 0, TOP + 0.36, 0));
      break;
    }
    case "galera": {
      g.add(mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.04, 22), std(0x1c1c22, 0.4), 0, TOP + 0.0, 0), mesh(new THREE.CylinderGeometry(0.27, 0.29, 0.38, 20), std(0x1c1c22, 0.4), 0, TOP + 0.2, 0), mesh(new THREE.CylinderGeometry(0.295, 0.295, 0.07, 20), std(0xd4216c, 0.4), 0, TOP + 0.06, 0));
      break;
    }
    case "orejas": {
      const band = mesh(new THREE.TorusGeometry(0.4, 0.03, 6, 20, Math.PI), std(0x3b2414, 0.6), 0, TOP - 0.18, 0);
      band.rotation.y = Math.PI / 2;
      band.rotation.z = 0;
      g.add(band);
      for (const s of [-1, 1]) {
        const ear = mesh(new THREE.ConeGeometry(0.11, 0.24, 4), std(col, 0.6), s * 0.24, TOP + 0.13, 0);
        ear.rotation.z = -s * 0.2;
        g.add(ear, mesh(new THREE.ConeGeometry(0.06, 0.14, 4), std(0xffd0e0, 0.6), s * 0.24, TOP + 0.1, 0.05));
      }
      break;
    }
    case "conejo": {
      for (const s of [-1, 1]) {
        const ear = mesh(new THREE.CapsuleGeometry(0.075, 0.42, 4, 8), std(p.color || 0xfff6e6, 0.8), s * 0.15, TOP + 0.36, 0);
        ear.rotation.z = -s * 0.18;
        g.add(ear);
        const inner = mesh(new THREE.CapsuleGeometry(0.035, 0.3, 4, 8), std(0xff9fc0, 0.8), s * 0.15, TOP + 0.36, 0.05);
        inner.rotation.z = -s * 0.18;
        g.add(inner);
      }
      break;
    }
    case "flor": {
      const f = new THREE.Group();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const pt = mesh(new THREE.SphereGeometry(0.06, 8, 6), std(0xffffff, 0.6), Math.cos(a) * 0.09, Math.sin(a) * 0.09, 0);
        pt.scale.set(1, 1, 0.5);
        f.add(pt);
      }
      f.add(mesh(new THREE.SphereGeometry(0.06, 8, 6), std(0xffc800, 0.5), 0, 0, 0.02));
      f.position.set(0.27, TOP - 0.02, 0.18);
      f.rotation.set(-0.5, 0.4, 0);
      g.add(f);
      break;
    }
    case "alfajor": {
      const stack = new THREE.Group();
      const cookie = std(0xd9a463, 0.7);
      stack.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.07, 22), cookie, 0, 0, 0), mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.1, 22), std(0x8a4f1d, 0.5), 0, 0.085, 0), mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.07, 22), cookie, 0, 0.17, 0));
      const coat = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 22), std(0x4a2514, 0.3), 0, 0.2, 0);
      stack.add(coat);
      for (let i = 0; i < 12; i++) { const a = i * 2.4; stack.add(mesh(new THREE.BoxGeometry(0.03, 0.012, 0.012), std([0xffc800, 0xd4216c, 0xcfd767][i % 3], 0.5), Math.cos(a) * 0.15 * (0.4 + (i % 3) * 0.3), 0.222, Math.sin(a) * 0.15 * (0.4 + (i % 3) * 0.3)));}
      stack.position.set(0, TOP + 0.08, 0);
      stack.rotation.z = 0.08;
      g.add(stack);
      break;
    }
    case "antenas": {
      const ants = [];
      for (const s of [-1, 1]) {
        const a = new THREE.Group();
        a.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.34, 6), std(0x8a8f9b, 0.4), 0, 0.17, 0), mesh(new THREE.SphereGeometry(0.06, 10, 8), std(0x7dff6a, 0.3, { emissive: 0x2fc020, emissiveIntensity: 0.9 }), 0, 0.36, 0));
        a.position.set(s * 0.16, TOP - 0.02, 0);
        a.rotation.z = -s * 0.25;
        g.add(a);
        ants.push(a);
      }
      ticks.push((t) => ants.forEach((a, i) => (a.rotation.x = Math.sin(t * 5 + i) * 0.18)));
      break;
    }
    case "astronauta": {
      const glass = new THREE.Mesh(new THREE.SphereGeometry(0.58, 20, 16), new THREE.MeshPhysicalMaterial({ color: 0xcfe9ff, transparent: true, opacity: 0.2, roughness: 0.05, metalness: 0.1, clearcoat: 1, depthWrite: false }));
      glass.material.userData.own = true;
      const ring = mesh(new THREE.TorusGeometry(0.46, 0.06, 8, 24), std(0xe8e8ee, 0.35, { metalness: 0.3 }), 0, -0.34, 0);
      ring.rotation.x = Math.PI / 2;
      g.add(glass, ring, mesh(new THREE.SphereGeometry(0.04, 8, 6), std(0xff3b3b, 0.3, { emissive: 0xff0000, emissiveIntensity: 0.6 }), 0.45, 0.2, 0.15));
      break;
    }
    case "corona": {
      const crown = new THREE.Group();
      const gold = std(0xffc800, 0.25, { metalness: 0.7, emissive: 0x6a4a00, emissiveIntensity: 0.5, side: THREE.DoubleSide });
      crown.add(mesh(new THREE.CylinderGeometry(0.27, 0.3, 0.12, 16, 1, true), gold));
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        crown.add(mesh(new THREE.ConeGeometry(0.07, 0.2, 5), gold, Math.cos(a) * 0.28, 0.14, Math.sin(a) * 0.28), mesh(new THREE.SphereGeometry(0.035, 8, 6), basic(i % 2 ? 0xff3fa4 : 0x35f0ff), Math.cos(a) * 0.28, 0.27, Math.sin(a) * 0.28));
      }
      crown.position.set(0, TOP + 0.08, 0);
      g.add(crown);
      ticks.push((t) => (crown.rotation.y = t * 1.2));
      break;
    }
    case "aureola": {
      const h = mesh(new THREE.TorusGeometry(0.22, 0.03, 8, 28), std(0xffe27a, 0.3, { emissive: 0xffc800, emissiveIntensity: 1.1 }), 0, TOP + 0.32, 0);
      h.rotation.x = Math.PI / 2;
      g.add(h);
      ticks.push((t) => (h.position.y = TOP + 0.32 + Math.sin(t * 2.4) * 0.03));
      break;
    }
    default:
      break;
  }
  return g;
}

// ---------------------------------------------------------------- anteojos

function buildGlasses(hero, p) {
  const g = new THREE.Group();
  const z = FZ + 0.035;
  const col = p.color || "#222233";
  const bridge = (c) => g.add(mesh(new THREE.BoxGeometry(0.09, 0.025, 0.025), c, 0, eyeY + 0.03, z));
  const arms = (c) => { for (const s of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.02, 0.02, 0.5), c, s * 0.39, eyeY + 0.03, z - 0.25)); };
  switch (p.kind) {
    case "redondos": {
      const fm = std(col, 0.4);
      for (const s of [-1, 1]) g.add(mesh(new THREE.TorusGeometry(0.135, 0.016, 6, 22), fm, s * eyeX, eyeY, z));
      bridge(fm);
      arms(fm);
      break;
    }
    case "sol": {
      const lens = std(0x111122, 0.1, { metalness: 0.8, emissive: 0x35f0ff, emissiveIntensity: 0.25 });
      for (const s of [-1, 1]) g.add(mesh(roundedBox(0.27, 0.19, 0.05, 0.06, 0.02), lens, s * eyeX, eyeY, z));
      bridge(lens);
      arms(lens);
      break;
    }
    case "cuadrados": {
      const fm = std(col, 0.4);
      const lens = std(0xdff3ff, 0.1, { transparent: true, opacity: 0.45 });
      for (const s of [-1, 1]) { g.add(mesh(roundedBox(0.29, 0.22, 0.02, 0.04, 0.01), fm, s * eyeX, eyeY, z)); g.add(mesh(roundedBox(0.22, 0.15, 0.02, 0.03, 0.01), lens, s * eyeX, eyeY, z + 0.014)); }
      bridge(fm);
      arms(fm);
      break;
    }
    case "estrella": {
      const m = std(0xffc800, 0.3, { transparent: true, opacity: 0.85, emissive: 0xffa800, emissiveIntensity: 0.4 });
      for (const s of [-1, 1]) { const geo = flat(starShape(0.17, 0.075), 0.03); geo.translate(0, 0, -0.015); g.add(mesh(geo, m, s * eyeX, eyeY, z)); }
      bridge(std(0xffc800, 0.4));
      arms(std(0xffc800, 0.4));
      break;
    }
    case "corazon": {
      const m = std(0xff4f8a, 0.3, { transparent: true, opacity: 0.85, emissive: 0xaa1040, emissiveIntensity: 0.4 });
      for (const s of [-1, 1]) { const geo = flat(heartShape(0.14), 0.03); geo.translate(0, 0.0, -0.015); g.add(mesh(geo, m, s * eyeX, eyeY, z)); }
      bridge(std(0xff4f8a, 0.4));
      arms(std(0xff4f8a, 0.4));
      break;
    }
    case "esqui": {
      const lens = std(0x3b8cff, 0.1, { metalness: 0.9, emissive: 0x1040a0, emissiveIntensity: 0.3 });
      g.add(mesh(roundedBox(0.7, 0.24, 0.07, 0.09, 0.03), lens, 0, eyeY, z + 0.01));
      const strap = mesh(new THREE.TorusGeometry(0.4, 0.04, 6, 24), std(0x222233, 0.7), 0, eyeY, 0);
      strap.rotation.x = Math.PI / 2;
      strap.scale.set(1, 0.85, 1);
      g.add(strap);
      break;
    }
    default:
      break;
  }
  return g;
}

// ---------------------------------------------------------------- cuello

function buildNeck(hero, p, ticks) {
  const g = new THREE.Group();
  const col = p.color || "#d4216c";
  switch (p.kind) {
    case "bufanda": {
      const ring = mesh(new THREE.TorusGeometry(0.22, 0.075, 8, 22), std(col, 0.9), 0, 0.76, 0);
      ring.rotation.x = Math.PI / 2;
      ring.scale.set(1.15, 0.8, 1);
      const tail = mesh(roundedBox(0.12, 0.34, 0.05, 0.03, 0.015), std(col, 0.9), 0.13, 0.62, 0.18);
      tail.rotation.z = -0.12;
      g.add(ring, tail, mesh(roundedBox(0.12, 0.05, 0.052, 0.02, 0.01), std(0xfff6e6, 0.9), 0.13, 0.52, 0.18));
      break;
    }
    case "corbatin": {
      const m = std(0xd4216c, 0.5);
      for (const s of [-1, 1]) { const w = mesh(new THREE.ConeGeometry(0.07, 0.14, 4), m, s * 0.09, 0.74, 0.18); w.rotation.z = -s * Math.PI / 2; g.add(w); }
      g.add(mesh(new THREE.SphereGeometry(0.035, 8, 6), std(0xffc800, 0.4), 0, 0.74, 0.18));
      break;
    }
    case "medalla": {
      const rib = std(0xd4216c, 0.6);
      for (const s of [-1, 1]) { const r = mesh(new THREE.BoxGeometry(0.035, 0.28, 0.01), rib, s * 0.06, 0.66, 0.19); r.rotation.z = s * 0.25; g.add(r); }
      const disc = mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.025, 18), std(0xffc800, 0.25, { metalness: 0.7, emissive: 0x6a4a00, emissiveIntensity: 0.5 }), 0, 0.52, 0.2);
      disc.rotation.x = Math.PI / 2;
      g.add(disc);
      break;
    }
    case "flores": {
      const colors = [0xff6fb0, 0xffc800, 0xffffff, 0x9a5cff];
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.add(mesh(new THREE.SphereGeometry(0.05, 8, 6), std(colors[i % 4], 0.6), Math.cos(a) * 0.24, 0.74, Math.sin(a) * 0.19)); }
      break;
    }
    case "cascabel": {
      const ring = mesh(new THREE.TorusGeometry(0.21, 0.018, 6, 22), std(0xd4216c, 0.5), 0, 0.75, 0);
      ring.rotation.x = Math.PI / 2;
      ring.scale.set(1.1, 0.85, 1);
      const bell = mesh(new THREE.SphereGeometry(0.06, 12, 10), std(0xffc800, 0.25, { metalness: 0.7 }), 0, 0.64, 0.17);
      g.add(ring, bell);
      ticks.push((t, mode) => (bell.rotation.z = mode === "run" || mode === "cheer" ? Math.sin(t * 20) * 0.5 : 0));
      break;
    }
    case "diamante": {
      const chain = mesh(new THREE.TorusGeometry(0.21, 0.012, 6, 22), std(0xe8e8ee, 0.2, { metalness: 0.8 }), 0, 0.75, 0);
      chain.rotation.x = Math.PI / 2;
      chain.scale.set(1.1, 0.85, 1);
      const gem = mesh(new THREE.OctahedronGeometry(0.075), std(0x7ff0ff, 0.15, { emissive: 0x25b8d8, emissiveIntensity: 0.9 }), 0, 0.6, 0.19);
      g.add(chain, gem);
      ticks.push((t) => (gem.rotation.y = t * 2));
      break;
    }
    default:
      break;
  }
  // los accesorios de cuello se ven muy chicos: agrandar manteniendo la altura del cuello
  g.scale.setScalar(1.4);
  g.position.set(0, 0.74 * (1 - 1.4), 0.01);
  return g;
}

// ---------------------------------------------------------------- espalda

function wing(shape, color, extra = {}) {
  const geo = flat(shape, 0.012);
  return mesh(geo, std(color, 0.4, { side: THREE.DoubleSide, ...extra }));
}

function buildBack(hero, p, ticks) {
  const g = new THREE.Group();
  const col = p.color || "#d4216c";
  switch (p.kind) {
    case "murcielago": {
      const wings = [];
      for (const s of [-1, 1]) {
        const sh = new THREE.Shape();
        sh.moveTo(0, 0); sh.lineTo(0.55, 0.42); sh.lineTo(0.5, 0.12); sh.lineTo(0.7, 0.02); sh.lineTo(0.46, -0.1); sh.lineTo(0.52, -0.32); sh.lineTo(0.22, -0.16); sh.closePath();
        const w1 = wing(sh, 0x2a1840);
        w1.scale.x = s;
        const holder = new THREE.Group();
        holder.add(w1);
        holder.position.set(s * 0.08, 0.7, -0.22);
        g.add(holder);
        wings.push([holder, s]);
      }
      ticks.push((t, mode) => wings.forEach(([h, s]) => (h.rotation.y = s * (0.35 + Math.sin(t * (mode === "run" || mode === "jump" ? 12 : 4)) * 0.4))));
      break;
    }
    case "globos": {
      const cols = [0xff3b6b, 0xffe14a, 0x4fd0ff];
      const balloons = cols.map((c, i) => {
        const b = mesh(new THREE.SphereGeometry(0.2, 12, 10), std(c, 0.3), (i - 1) * 0.28, 1.75 + (i % 2) * 0.15, -0.3);
        b.scale.y = 1.2;
        g.add(b);
        const string = mesh(new THREE.CylinderGeometry(0.005, 0.005, 1.0 + (i % 2) * 0.15, 4), std(0xffffff, 0.8), (i - 1) * 0.14, 1.2 + (i % 2) * 0.07, -0.27);
        string.rotation.z = -(i - 1) * 0.15;
        g.add(string);
        return b;
      });
      ticks.push((t) => balloons.forEach((b, i) => { b.position.y = 1.75 + (i % 2) * 0.15 + Math.sin(t * 2 + i) * 0.04; }));
      break;
    }
    case "canasta": {
      const basket = mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.2, 14), std(0xc98a4b, 0.9), 0.46, 0.4, 0.02);
      g.add(basket);
      const handle = mesh(new THREE.TorusGeometry(0.17, 0.015, 6, 14, Math.PI), std(0xa86a3a, 0.9), 0.46, 0.5, 0.02);
      g.add(handle);
      [0xff9ab8, 0xffe14a, 0x9fe8ff, 0xb9f0a8].forEach((c, i) => {
        const egg = mesh(new THREE.SphereGeometry(0.07, 10, 8), std(c, 0.4), 0.4 + (i % 2) * 0.1, 0.52 + (i > 1 ? 0.04 : 0), -0.05 + (i % 3) * 0.05);
        egg.scale.y = 1.25;
        g.add(egg);
      });
      break;
    }
    case "capa": {
      const geo = new THREE.PlaneGeometry(0.62, 0.78, 4, 6);
      geo.translate(0, -0.39, 0);
      const base = geo.attributes.position.array.slice();
      const cape = mesh(geo, std(col, 0.5, { side: THREE.DoubleSide, emissive: p.shine ? 0x6a4a00 : 0x300010, emissiveIntensity: p.shine ? 0.7 : 0.35, metalness: p.shine ? 0.5 : 0 }), 0, 0.74, -0.2);
      g.add(cape);
      ticks.push((t, mode, speed) => {
        const lift = (mode === "run" ? 0.8 : mode === "jump" ? 1 : mode === "drive" ? 0.6 : 0.1) * Math.min(1.2, speed || 1);
        cape.rotation.x = 0.1 + lift * 0.7;
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) { const y = base[i * 3 + 1]; pos.setZ(i, Math.sin(t * 12 + y * 5) * 0.05 * -y * (0.4 + lift)); }
        pos.needsUpdate = true;
      });
      break;
    }
    case "mochila": {
      g.add(mesh(roundedBox(0.34, 0.4, 0.16, 0.06, 0.02), std(col, 0.6), 0, 0.55, -0.28), mesh(roundedBox(0.24, 0.14, 0.03, 0.03, 0.01), std(0xffc800, 0.6), 0, 0.5, -0.37));
      for (const s of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.04, 0.34, 0.02), std(0x222233, 0.7), s * 0.14, 0.58, 0.19));
      break;
    }
    case "cacao": {
      const pod = mesh(new THREE.CapsuleGeometry(0.14, 0.18, 6, 10), std(0x7a3f22, 0.6), 0, 0.55, -0.3);
      pod.scale.set(1, 1.3, 0.85);
      g.add(pod);
      for (const x of [-0.07, 0, 0.07]) g.add(mesh(new THREE.BoxGeometry(0.014, 0.5, 0.01), std(0x4a2514, 0.7), x, 0.55, -0.4));
      const leaf = mesh(new THREE.ConeGeometry(0.06, 0.16, 4), std(0x8fc152, 0.6), 0, 0.88, -0.3);
      g.add(leaf);
      break;
    }
    case "alas": {
      const wings = [];
      for (const s of [-1, 1]) {
        const w = new THREE.Group();
        for (let i = 0; i < 4; i++) {
          const f = mesh(new THREE.CapsuleGeometry(0.045, 0.3 + i * 0.07, 4, 8), std(0xffffff, 0.5, { emissive: 0xaaccff, emissiveIntensity: 0.25 }), s * (0.12 + i * 0.07), 0.06 - i * 0.06, 0);
          f.rotation.z = -s * (0.9 + i * 0.12);
          w.add(f);
        }
        w.position.set(s * 0.1, 0.68, -0.22);
        g.add(w);
        wings.push([w, s]);
      }
      ticks.push((t, mode) => wings.forEach(([w, s]) => (w.rotation.y = s * (0.3 + Math.sin(t * (mode === "jump" || mode === "cheer" ? 14 : 3)) * 0.35))));
      break;
    }
    case "mariposa": {
      const sh = new THREE.Shape();
      sh.moveTo(0, 0);
      sh.bezierCurveTo(0.1, 0.3, 0.45, 0.4, 0.4, 0.1);
      sh.bezierCurveTo(0.38, 0.0, 0.2, -0.02, 0.15, -0.02);
      sh.bezierCurveTo(0.34, -0.1, 0.34, -0.38, 0.14, -0.3);
      sh.bezierCurveTo(0.06, -0.28, 0.02, -0.12, 0, 0);
      const wings = [];
      for (const s of [-1, 1]) {
        const w = wing(sh, 0xb06bff, { emissive: 0x5a20a0, emissiveIntensity: 0.35 });
        w.scale.x = s;
        const spot = mesh(new THREE.CircleGeometry(0.045, 10), basic(0xffc800), 0.27, 0.15, 0.01);
        spot.scale.x = 1;
        w.add(spot);
        const holder = new THREE.Group();
        holder.add(w);
        holder.position.set(s * 0.06, 0.6, -0.22);
        g.add(holder);
        wings.push([holder, s]);
      }
      ticks.push((t, mode) => wings.forEach(([w, s]) => (w.rotation.y = s * (0.5 + Math.sin(t * (mode === "jump" || mode === "cheer" ? 12 : 4)) * 0.4))));
      break;
    }
    case "cohete": {
      const flames = [];
      for (const s of [-1, 1]) {
        g.add(mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.42, 12), std(0xd8d8e0, 0.3, { metalness: 0.6 }), s * 0.1, 0.56, -0.3), mesh(new THREE.ConeGeometry(0.075, 0.14, 12), std(0xd4216c, 0.4), s * 0.1, 0.84, -0.3));
        const fl = mesh(new THREE.ConeGeometry(0.06, 0.26, 10), basic(0xffa000), s * 0.1, 0.22, -0.3);
        fl.rotation.x = Math.PI;
        g.add(fl);
        flames.push(fl);
      }
      ticks.push((t, mode) => flames.forEach((f, i) => { const k = mode === "jump" || mode === "run" ? 1.4 : 0.7; f.scale.set(1, k * (0.8 + Math.sin(t * 30 + i) * 0.25), 1); f.position.y = 0.24 - (k - 0.7) * 0.08; }));
      break;
    }
    default:
      break;
  }
  return g;
}

// ---------------------------------------------------------------- aplicar

function rainbowTexture() {
  return canvasTexture(64, 64, (c, w, h) => {
    const cols = ["#ff3b3b", "#ff8a2a", "#ffc800", "#4fd09a", "#3b8cff", "#9a5cff"];
    cols.forEach((col, i) => { c.fillStyle = col; c.fillRect(0, (i * h) / cols.length, w, h / cols.length + 1); });
  });
}
function galaxyTexture() {
  return canvasTexture(64, 64, (c, w, h) => {
    c.fillStyle = "#3a2d8a"; c.fillRect(0, 0, w, h);
    c.fillStyle = "#ffffff";
    for (let i = 0; i < 18; i++) { c.beginPath(); c.arc((i * 37) % w, (i * 23) % h, 1 + (i % 3), 0, 6.3); c.fill(); }
    c.fillStyle = "#35f0ff";
    for (let i = 0; i < 6; i++) { c.beginPath(); c.arc((i * 53 + 9) % w, (i * 31 + 5) % h, 2, 0, 6.3); c.fill(); }
  });
}

/** Deja puesto en `hero` exactamente lo que dice `look` (ver EMPTY_LOOK en wardrobe-data.js). */
export function applyLook(hero, look = {}) {
  const L = { ...EMPTY_LOOK, ...look };
  // quitar lo anterior
  for (const o of hero.worn || []) { o.parent && o.parent.remove(o); disposeTree(o); }
  hero.worn = [];
  const ticks = [];
  const { mats } = hero;
  const defaults = hero.defaults;

  // ropa (colores de la camiseta + texturas especiales)
  const outfit = getOutfit(L.outfit);
  hero.setOutfit(outfit);
  if (mats.jersey.map && mats.jersey.map.userData.own) { mats.jersey.map.dispose(); }
  mats.jersey.map = null;
  mats.jersey.metalness = 0;
  mats.jersey.emissive.set(0x000000);
  if (outfit.params.rainbow) { mats.jersey.map = rainbowTexture(); mats.jersey.map.userData.own = true; mats.jersey.color.set(0xffffff); }
  else if (outfit.params.stars) { mats.jersey.map = galaxyTexture(); mats.jersey.map.userData.own = true; mats.jersey.color.set(0xffffff); }
  if (outfit.params.shine) { mats.jersey.metalness = 0.45; mats.jersey.roughness = 0.25; mats.jersey.emissive.set(0x300010); }
  mats.jersey.needsUpdate = true;

  // tono de chocolate
  const skin = getItem(L.skin);
  mats.choco.color.set(skin ? skin.params.color : defaults.choco);
  mats.chocoDark.color.set(skin ? skin.params.dark : defaults.chocoDark);
  const metalSkin = !!(skin && skin.params.metal);
  mats.choco.metalness = metalSkin ? 0.65 : 0;
  mats.choco.roughness = metalSkin ? 0.3 : 0.55;

  // color de pelo
  const hc = getItem(L.hairColor);
  mats.hair.color.set(hc ? hc.params.color : defaults.hair);
  mats.hair.metalness = hc && hc.params.metal ? 0.7 : 0;
  mats.hair.roughness = hc && hc.params.metal ? 0.3 : 0.7;

  // zapatos
  const shoe = getItem(L.shoes);
  mats.shoe.color.set(shoe ? shoe.params.color : defaults.shoe);
  mats.shoe.metalness = shoe && shoe.params.metal ? 0.7 : 0;
  mats.shoe.emissive.set(shoe && shoe.params.glow ? shoe.params.glow : 0x000000);
  mats.shoe.emissiveIntensity = shoe && shoe.params.glow ? 0.7 : 0;

  const add = (parent, obj) => { parent.add(obj); hero.worn.push(obj); return obj; };

  // peinado: cualquier peinado reemplaza al original del personaje
  const hair = getItem(L.hair);
  hero.defaultStyle.forEach((o) => (o.visible = !hair));
  if (hair) add(hero.head, buildHair(hero, hair.params));
  const glasses = getItem(L.glasses);
  hero.defaultStyle.forEach((o) => { if (o.userData.defaultGlasses) o.visible = !hair && !glasses; });

  // cara
  hero.eyes.forEach((e) => (e.visible = true));
  hero.brows.forEach((b) => (b.visible = true));
  hero.mouth.visible = true;
  const face = getItem(L.face);
  if (face) add(hero.head, buildFace(hero, face.params));

  const hat = getItem(L.hat);
  if (hat) add(hero.head, buildHat(hero, hat.params, ticks));
  if (glasses) add(hero.head, buildGlasses(hero, glasses.params));
  const neck = getItem(L.neck);
  if (neck) add(hero.bodyGroup, buildNeck(hero, neck.params, ticks));
  const back = getItem(L.back);
  if (back) add(hero.bodyGroup, buildBack(hero, back.params, ticks));
  const pet = getItem(L.pet);
  if (pet) add(hero.group, buildPet(pet.params, ticks));

  hero.tick = ticks.length ? (t, mode, speed) => ticks.forEach((f) => f(t, mode, speed)) : null;
  hero.look = L;
}
