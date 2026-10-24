// Mascotas del guardarropa: criaturitas de primitivas que flotan al lado del Matichico y lo
// acompañan en todos los juegos. `buildPet(params, ticks)` devuelve el grupo ya ubicado junto
// al héroe; las animaciones (aleteo, cola, destellos) se agregan a `ticks`.

import { THREE, roundedBox } from "./three-kit.js?v=b28a0715a9";

const std = (color, rough = 0.5, extra = {}) => {
  const m = new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });
  m.userData.own = true;
  return m;
};
const basic = (color) => {
  const m = new THREE.MeshBasicMaterial({ color });
  m.userData.own = true;
  return m;
};
const mesh = (geo, mat, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
};

function starShape(r1, r2, n = 5) {
  const s = new THREE.Shape();
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 ? r2 : r1;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r); else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  return s;
}

/** Ojitos, brillo y cachetes. `z` es qué tan adelante está la cara. */
function face(g, y, z, spread = 0.11, size = 0.045) {
  const eye = std(0x1a1010, 0.3);
  const shine = basic(0xffffff);
  for (const sx of [-1, 1]) {
    g.add(mesh(new THREE.SphereGeometry(size, 10, 8), eye, sx * spread, y, z));
    g.add(mesh(new THREE.SphereGeometry(size * 0.38, 6, 6), shine, sx * spread + size * 0.25, y + size * 0.3, z + size * 0.7));
    g.add(mesh(new THREE.SphereGeometry(size * 0.9, 8, 6), std(0xff8aa8, 0.9), sx * (spread + 0.1), y - 0.06, z - 0.03));
  }
  g.add(mesh(new THREE.BoxGeometry(0.07, 0.016, 0.02), eye, 0, y - 0.07, z + 0.005));
}

export function buildPet(p, ticks) {
  const g = new THREE.Group();
  switch (p.kind) {
    case "alfajor": {
      // dos galletas con crema y borde de chocolate; el eje del disco mira al frente
      const disc = new THREE.Group();
      for (const y of [-0.09, 0.09]) disc.add(mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.09, 22), std(0xe0b070, 0.8), 0, y, 0));
      disc.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 22), std(0xfff0d0, 0.7), 0, 0, 0));
      const ring = mesh(new THREE.TorusGeometry(0.3, 0.025, 6, 24), std(0x64321b, 0.5), 0, 0, 0);
      ring.rotation.x = Math.PI / 2;
      disc.add(ring);
      disc.rotation.x = Math.PI / 2;
      g.add(disc);
      face(g, 0.02, 0.15, 0.1);
      break;
    }
    case "patito": {
      const yel = std(0xffd83a, 0.6);
      g.add(mesh(new THREE.SphereGeometry(0.3, 16, 12), yel, 0, 0, 0));
      g.add(mesh(new THREE.SphereGeometry(0.2, 14, 10), yel, 0, 0.3, 0.05));
      g.add(mesh(new THREE.BoxGeometry(0.14, 0.05, 0.1), std(0xff8a2a, 0.5), 0, 0.28, 0.24));
      face(g, 0.34, 0.2, 0.09, 0.035);
      const w1 = mesh(new THREE.SphereGeometry(0.1, 8, 6), yel, -0.3, 0, 0);
      const w2 = mesh(new THREE.SphereGeometry(0.1, 8, 6), yel, 0.3, 0, 0);
      g.add(w1, w2);
      ticks.push((t) => { w1.rotation.z = Math.sin(t * 8) * 0.4; w2.rotation.z = -Math.sin(t * 8) * 0.4; });
      break;
    }
    case "gota": {
      const m = std(0x5a2a14, 0.25, { metalness: 0.15 });
      g.add(mesh(new THREE.SphereGeometry(0.28, 16, 12), m, 0, -0.04, 0));
      g.add(mesh(new THREE.ConeGeometry(0.2, 0.34, 14), m, 0, 0.3, 0));
      face(g, 0.0, 0.26, 0.1);
      break;
    }
    case "nube": {
      const m = std(0xffffff, 0.9);
      g.add(mesh(new THREE.SphereGeometry(0.24, 14, 10), m, 0, 0, 0));
      g.add(mesh(new THREE.SphereGeometry(0.18, 12, 8), m, -0.24, -0.04, 0));
      g.add(mesh(new THREE.SphereGeometry(0.2, 12, 8), m, 0.24, -0.02, 0));
      g.add(mesh(new THREE.SphereGeometry(0.15, 10, 8), m, 0.05, 0.2, 0));
      face(g, 0.0, 0.22, 0.09, 0.04);
      const drop = mesh(new THREE.SphereGeometry(0.035, 6, 6), std(0x6ab8ff, 0.2), 0.2, -0.3, 0.1);
      g.add(drop);
      ticks.push((t) => { const f = (t * 0.9) % 1; drop.position.y = -0.24 - f * 0.3; drop.visible = f < 0.9; });
      break;
    }
    case "cuchu": {
      g.add(mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.55, 16), std(0xe2b06a, 0.6), 0, 0, 0));
      for (let i = 0; i < 4; i++) {
        const ring = mesh(new THREE.TorusGeometry(0.152, 0.025, 6, 16), std(0x64321b, 0.5), 0, -0.2 + i * 0.13, 0);
        ring.rotation.x = Math.PI / 2;
        g.add(ring);
      }
      face(g, 0.12, 0.14, 0.06, 0.035);
      g.rotation.z = 0.35;
      break;
    }
    case "gato": {
      const m = std(0x7a4a2a, 0.6);
      g.add(mesh(new THREE.SphereGeometry(0.3, 16, 12), m, 0, 0, 0));
      for (const sx of [-1, 1]) {
        const ear = mesh(new THREE.ConeGeometry(0.1, 0.18, 4), m, sx * 0.17, 0.28, 0);
        ear.rotation.z = -sx * 0.25;
        g.add(ear);
        g.add(mesh(new THREE.ConeGeometry(0.05, 0.1, 4), std(0xff8aa8, 0.8), sx * 0.17, 0.27, 0.05));
      }
      face(g, 0.04, 0.26, 0.11);
      const tail = mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.4, 8), m, -0.3, -0.1, 0);
      tail.rotation.z = 0.8;
      g.add(tail);
      ticks.push((t) => { tail.rotation.z = 0.8 + Math.sin(t * 4) * 0.25; });
      break;
    }
    case "robot": {
      const m = std(0xbfc5d2, 0.3, { metalness: 0.7 });
      g.add(mesh(roundedBox(0.46, 0.4, 0.4, 0.08, 0.02), m, 0, 0, 0));
      const eyeM = basic(0x35f0ff);
      for (const sx of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.09, 0.09, 0.02), eyeM, sx * 0.1, 0.04, 0.21));
      g.add(mesh(new THREE.BoxGeometry(0.16, 0.025, 0.02), basic(0xff3fa4), 0, -0.08, 0.21));
      g.add(mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.14, 6), m, 0, 0.27, 0));
      const bulb = mesh(new THREE.SphereGeometry(0.04, 8, 6), basic(0xff3fa4), 0, 0.36, 0);
      g.add(bulb);
      ticks.push((t) => bulb.scale.setScalar(0.8 + Math.abs(Math.sin(t * 5)) * 0.6));
      break;
    }
    case "estrella": {
      const geo = new THREE.ExtrudeGeometry(starShape(0.34, 0.16), { depth: 0.1, bevelEnabled: false });
      geo.translate(0, 0, -0.05);
      const star = mesh(geo, std(0xffc800, 0.25, { metalness: 0.6, emissive: 0xaa7a00, emissiveIntensity: 0.7 }), 0, 0, 0);
      g.add(star);
      face(g, 0.02, 0.07, 0.08, 0.035);
      ticks.push((t) => { star.rotation.y = Math.sin(t * 1.5) * 0.5; });
      break;
    }
    case "unicornio": {
      const white = std(0xffffff, 0.5);
      g.add(mesh(new THREE.SphereGeometry(0.28, 16, 12), white, 0, 0, 0));
      g.add(mesh(new THREE.SphereGeometry(0.2, 14, 10), white, 0, 0.3, 0.1));
      const horn = mesh(new THREE.ConeGeometry(0.05, 0.28, 8), std(0xffc800, 0.2, { metalness: 0.7, emissive: 0x6a4a00, emissiveIntensity: 0.6 }), 0, 0.58, 0.14);
      horn.rotation.x = 0.2;
      g.add(horn);
      for (const sx of [-1, 1]) g.add(mesh(new THREE.ConeGeometry(0.06, 0.12, 4), white, sx * 0.12, 0.5, 0.05));
      [0xff3fa4, 0x9a5cff, 0x35f0ff].forEach((c, i) => g.add(mesh(new THREE.SphereGeometry(0.1, 8, 6), std(c, 0.5), -0.1 + i * 0.02, 0.4 - i * 0.1, -0.12)));
      face(g, 0.33, 0.28, 0.08, 0.035);
      const tail = mesh(new THREE.SphereGeometry(0.12, 8, 6), std(0xff3fa4, 0.5), 0, -0.02, -0.3);
      g.add(tail);
      ticks.push((t) => { tail.position.x = Math.sin(t * 3) * 0.08; });
      break;
    }
    case "dragon": {
      const m = std(0x7a3a1c, 0.5);
      g.add(mesh(new THREE.SphereGeometry(0.3, 16, 12), m, 0, 0, 0));
      g.add(mesh(new THREE.SphereGeometry(0.22, 14, 10), m, 0, 0.3, 0.12));
      g.add(mesh(new THREE.BoxGeometry(0.2, 0.1, 0.16), m, 0, 0.26, 0.3));
      for (const sx of [-1, 1]) g.add(mesh(new THREE.ConeGeometry(0.05, 0.16, 6), std(0xffc800, 0.3, { metalness: 0.5 }), sx * 0.11, 0.55, 0.08));
      face(g, 0.34, 0.3, 0.09, 0.035);
      const wingM = std(0xd4216c, 0.5, { side: THREE.DoubleSide });
      const wing = (sx) => {
        const s = new THREE.Shape();
        s.moveTo(0, 0); s.lineTo(sx * 0.4, 0.28); s.lineTo(sx * 0.3, 0); s.lineTo(sx * 0.4, -0.2); s.closePath();
        return mesh(new THREE.ShapeGeometry(s), wingM, sx * 0.25, 0.05, -0.1);
      };
      const w1 = wing(-1);
      const w2 = wing(1);
      g.add(w1, w2);
      const tail = mesh(new THREE.ConeGeometry(0.08, 0.4, 8), m, 0, -0.1, -0.35);
      tail.rotation.x = -1.2;
      g.add(tail);
      const flame = mesh(new THREE.ConeGeometry(0.04, 0.12, 6), basic(0xffa800), 0, 0.24, 0.42);
      flame.rotation.x = Math.PI / 2;
      g.add(flame);
      ticks.push((t) => {
        w1.rotation.y = Math.sin(t * 7) * 0.5;
        w2.rotation.y = -Math.sin(t * 7) * 0.5;
        flame.scale.setScalar(0.7 + Math.abs(Math.sin(t * 9)) * 0.7);
      });
      break;
    }
    case "fantasma": {
      const m = std(0xffffff, 0.8, { transparent: true, opacity: 0.92 });
      g.add(mesh(new THREE.SphereGeometry(0.3, 16, 12), m, 0, 0.05, 0));
      const skirt = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.3, 16, 1, true), std(0xffffff, 0.8, { side: THREE.DoubleSide, transparent: true, opacity: 0.92 }), 0, -0.1, 0);
      g.add(skirt);
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; g.add(mesh(new THREE.SphereGeometry(0.09, 8, 6), m, Math.cos(a) * 0.22, -0.26, Math.sin(a) * 0.22)); }
      face(g, 0.08, 0.27, 0.1);
      ticks.push((t) => { g.scale.y = 1 + Math.sin(t * 3) * 0.05; });
      break;
    }
    case "nieve": {
      const w = std(0xffffff, 0.9);
      g.add(mesh(new THREE.SphereGeometry(0.28, 14, 10), w, 0, -0.2, 0), mesh(new THREE.SphereGeometry(0.2, 14, 10), w, 0, 0.18, 0));
      face(g, 0.22, 0.17, 0.07, 0.03);
      const nose = mesh(new THREE.ConeGeometry(0.03, 0.14, 6), std(0xff8a2a, 0.6), 0, 0.17, 0.22);
      nose.rotation.x = Math.PI / 2;
      g.add(nose, mesh(new THREE.TorusGeometry(0.17, 0.035, 6, 14), std(0xe83a3a, 0.8), 0, 0.02, 0).rotateX(Math.PI / 2));
      g.add(mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.16, 12), std(0x2a1810, 0.7), 0, 0.46, 0));
      break;
    }
    case "corazon": {
      const sh = new THREE.Shape(); const k = 0.3;
      sh.moveTo(0, -k); sh.bezierCurveTo(-k * 1.6, -k * 0.2, -k * 1.1, k * 1.1, 0, k * 0.45); sh.bezierCurveTo(k * 1.1, k * 1.1, k * 1.6, -k * 0.2, 0, -k);
      const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.14, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 });
      geo.translate(0, 0, -0.07);
      const heart = mesh(geo, std(0xe83a6a, 0.35, { emissive: 0x7a0a2a, emissiveIntensity: 0.4 }), 0, 0, 0);
      g.add(heart);
      face(g, 0.02, 0.13, 0.09, 0.035);
      ticks.push((t) => heart.scale.setScalar(1 + Math.abs(Math.sin(t * 3)) * 0.1));
      break;
    }
    case "huevo": {
      const egg = mesh(new THREE.SphereGeometry(0.28, 16, 12), std(0xff9ab8, 0.4), 0, 0, 0);
      egg.scale.y = 1.3;
      g.add(egg);
      for (const [y, c] of [[-0.12, 0xffe14a], [0.12, 0x9fe8ff]]) { const band = mesh(new THREE.TorusGeometry(Math.sqrt(0.28 * 0.28 - (y / 1.3) * (y / 1.3)) + 0.003, 0.02, 6, 20), std(c, 0.4), 0, y, 0); band.rotation.x = Math.PI / 2; g.add(band); }
      face(g, 0.0, 0.27, 0.09, 0.035);
      break;
    }
    case "volantin": {
      const sh = new THREE.Shape(); sh.moveTo(0, 0.4); sh.lineTo(0.28, 0); sh.lineTo(0, -0.4); sh.lineTo(-0.28, 0); sh.closePath();
      g.add(mesh(new THREE.ShapeGeometry(sh), std(0xd52b1e, 0.6, { side: THREE.DoubleSide }), 0, 0, 0));
      const bar = new THREE.Shape(); bar.moveTo(-0.28, 0); bar.lineTo(0, 0.4); bar.lineTo(0, 0); bar.lineTo(-0.28, 0);
      g.add(mesh(new THREE.ShapeGeometry(bar), std(0x0039a6, 0.6, { side: THREE.DoubleSide }), 0, 0, 0.005));
      g.add(mesh(new THREE.BoxGeometry(0.02, 0.8, 0.02), std(0xffffff, 0.8), 0, 0, 0.01), mesh(new THREE.BoxGeometry(0.56, 0.02, 0.02), std(0xffffff, 0.8), 0, 0, 0.01));
      face(g, 0.05, 0.02, 0.07, 0.03);
      const tail = [];
      for (let i = 0; i < 4; i++) { const t1 = mesh(new THREE.BoxGeometry(0.1, 0.05, 0.01), std([0xd52b1e, 0xffffff, 0x0039a6][i % 3], 0.6), 0, -0.5 - i * 0.12, 0); g.add(t1); tail.push(t1); }
      ticks.push((t) => tail.forEach((s, i) => { s.position.x = Math.sin(t * 4 + i) * 0.06; s.rotation.z = Math.sin(t * 4 + i) * 0.3; }));
      break;
    }
    case "globito": {
      const b = mesh(new THREE.SphereGeometry(0.3, 16, 12), std(0xff3b6b, 0.25, { emissive: 0x4a0a1a, emissiveIntensity: 0.3 }), 0, 0.1, 0);
      b.scale.y = 1.15;
      g.add(b, mesh(new THREE.ConeGeometry(0.05, 0.08, 6), std(0xff3b6b, 0.3), 0, -0.27, 0).rotateX(Math.PI), mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.4, 4), std(0xffffff, 0.8), 0, -0.5, 0));
      face(g, 0.12, 0.28, 0.1, 0.04);
      break;
    }
    case "osito": {
      const fur = std(0xff9ec0, 0.9);
      g.add(mesh(new THREE.SphereGeometry(0.26, 14, 10), fur, 0, -0.04, 0), mesh(new THREE.SphereGeometry(0.2, 14, 10), fur, 0, 0.26, 0.03));
      for (const sx of [-1, 1]) g.add(mesh(new THREE.SphereGeometry(0.075, 8, 6), fur, sx * 0.16, 0.42, 0), mesh(new THREE.SphereGeometry(0.09, 8, 6), fur, sx * 0.25, 0.0, 0.05), mesh(new THREE.SphereGeometry(0.09, 8, 6), fur, sx * 0.15, -0.28, 0.06));
      g.add(mesh(new THREE.SphereGeometry(0.07, 8, 6), std(0xffe0e8, 0.8), 0, 0.22, 0.2));
      face(g, 0.3, 0.2, 0.08, 0.035);
      const bow = new THREE.Group();
      for (const sx of [-1, 1]) { const w = mesh(new THREE.ConeGeometry(0.05, 0.1, 3), std(0xe83a6a, 0.5), sx * 0.06, 0, 0); w.rotation.z = -sx * Math.PI / 2; bow.add(w); }
      bow.position.set(0, 0.1, 0.2);
      g.add(bow);
      ticks.push((t) => { g.rotation.z = Math.sin(t * 2) * 0.05; });
      break;
    }
    case "conejita": {
      const fur = std(0xffffff, 0.9);
      g.add(mesh(new THREE.SphereGeometry(0.27, 14, 10), fur, 0, -0.05, 0), mesh(new THREE.SphereGeometry(0.2, 14, 10), fur, 0, 0.26, 0.04));
      const ears = [];
      for (const sx of [-1, 1]) {
        const e = new THREE.Group();
        e.add(mesh(new THREE.CapsuleGeometry(0.06, 0.28, 4, 8), fur, 0, 0.2, 0), mesh(new THREE.CapsuleGeometry(0.03, 0.2, 4, 6), std(0xff9ec0, 0.8), 0, 0.2, 0.04));
        e.position.set(sx * 0.1, 0.4, 0);
        e.rotation.z = -sx * 0.18;
        g.add(e);
        ears.push(e);
      }
      g.add(mesh(new THREE.SphereGeometry(0.09, 8, 6), fur, 0, -0.1, -0.27));
      face(g, 0.3, 0.22, 0.08, 0.035);
      ticks.push((t) => { ears.forEach((e, i) => { e.rotation.z = (i ? 1 : -1) * (0.18 + Math.sin(t * 3 + i) * 0.08); }); });
      break;
    }
    case "mariposa": {
      const wings = [];
      for (const sx of [-1, 1]) {
        const w = new THREE.Group();
        const top = mesh(new THREE.SphereGeometry(0.22, 12, 8), std(0xff6fb0, 0.4, { emissive: 0x801050, emissiveIntensity: 0.3 }), sx * 0.2, 0.1, 0);
        top.scale.set(1, 1.1, 0.12);
        const bot = mesh(new THREE.SphereGeometry(0.15, 12, 8), std(0xb06bff, 0.4, { emissive: 0x401080, emissiveIntensity: 0.3 }), sx * 0.15, -0.14, 0);
        bot.scale.set(1, 1.1, 0.12);
        w.add(top, bot);
        g.add(w);
        wings.push([w, sx]);
      }
      g.add(mesh(new THREE.CapsuleGeometry(0.05, 0.3, 4, 8), std(0x2a1810, 0.6), 0, 0, 0));
      g.add(mesh(new THREE.SphereGeometry(0.07, 8, 6), std(0x2a1810, 0.6), 0, 0.24, 0));
      for (const sx of [-1, 1]) { const a = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.18, 4), std(0x2a1810, 0.6), sx * 0.05, 0.36, 0); a.rotation.z = -sx * 0.4; g.add(a); }
      ticks.push((t) => { for (const [w, sx] of wings) w.rotation.y = sx * (0.2 + Math.abs(Math.sin(t * 7)) * 0.9); });
      break;
    }
    case "hada": {
      const wings = [];
      for (const sx of [-1, 1]) {
        const w = mesh(new THREE.SphereGeometry(0.2, 12, 8), std(0xbfeaff, 0.2, { transparent: true, opacity: 0.75, emissive: 0x6fd0ff, emissiveIntensity: 0.3 }), sx * 0.2, 0.08, -0.08);
        w.scale.set(1, 1.5, 0.1);
        g.add(w);
        wings.push([w, sx]);
      }
      g.add(mesh(new THREE.SphereGeometry(0.2, 12, 10), std(0xffd1e3, 0.6), 0, -0.1, 0), mesh(new THREE.SphereGeometry(0.16, 12, 10), std(0xffe0c8, 0.6), 0, 0.17, 0.03), mesh(new THREE.ConeGeometry(0.22, 0.3, 10), std(0xff7aa8, 0.6), 0, -0.27, 0));
      g.add(mesh(new THREE.SphereGeometry(0.12, 10, 8), std(0xffd34d, 0.5), 0, 0.27, -0.03));
      face(g, 0.18, 0.15, 0.06, 0.03);
      const star = mesh(new THREE.ExtrudeGeometry(starShape(0.07, 0.03), { depth: 0.02, bevelEnabled: false }), std(0xffc800, 0.25, { emissive: 0xaa7a00, emissiveIntensity: 0.9 }), 0.3, 0.1, 0.1);
      g.add(star);
      ticks.push((t) => { for (const [w, sx] of wings) w.rotation.y = sx * Math.sin(t * 9) * 0.5; star.rotation.y = t * 3; });
      break;
    }
    case "balon": { // balón de fútbol que rebota
      const b = new THREE.Group();
      b.add(mesh(new THREE.SphereGeometry(0.3, 16, 12), std(0xffffff, 0.45), 0, 0, 0));
      const dark = std(0x1c1c22, 0.5);
      for (const d of [[0, 1, 0], [0.95, 0.3, 0.2], [-0.95, 0.3, 0.2], [0.55, -0.6, 0.55], [-0.55, -0.6, 0.55], [0, -1, 0], [0, 0.2, -1]]) {
        const v = new THREE.Vector3(...d).normalize();
        const patch = mesh(new THREE.CircleGeometry(0.095, 5), dark, v.x * 0.302, v.y * 0.302, v.z * 0.302);
        patch.lookAt(v.x * 2, v.y * 2, v.z * 2);
        b.add(patch);
      }
      g.add(b);
      face(g, 0.0, 0.28, 0.1, 0.04);
      ticks.push((t) => { const k = Math.abs(Math.sin(t * 3.2)); b.scale.set(1 + (1 - k) * 0.06, 0.92 + k * 0.1, 1 + (1 - k) * 0.06); b.position.y = k * 0.06; });
      break;
    }
    case "basquet": { // pelota de básquet
      const b = new THREE.Group();
      b.add(mesh(new THREE.SphereGeometry(0.3, 16, 12), std(0xff8a2a, 0.7), 0, 0, 0));
      const line = std(0x2a1810, 0.6);
      for (const r of [0, Math.PI / 2]) b.add(mesh(new THREE.TorusGeometry(0.301, 0.012, 5, 28), line, 0, 0, 0).rotateY(r));
      b.add(mesh(new THREE.TorusGeometry(0.301, 0.012, 5, 28), line, 0, 0, 0).rotateX(Math.PI / 2));
      g.add(b);
      face(g, 0.0, 0.28, 0.1, 0.04);
      ticks.push((t) => { b.rotation.z = Math.sin(t * 2) * 0.2; b.position.y = Math.abs(Math.sin(t * 3)) * 0.07; });
      break;
    }
    case "pompon": { // pompón de cheer
      const m = std(0xff6fb0, 0.9);
      const blob = new THREE.Group();
      for (let i = 0; i < 26; i++) {
        const a = i * 2.4;
        const y = Math.cos(i * 0.9) * 0.9;
        const r = Math.sqrt(1 - y * y);
        blob.add(mesh(new THREE.SphereGeometry(0.1, 8, 6), i % 3 ? m : std(0xffc800, 0.9), Math.cos(a) * r * 0.22, y * 0.2 + 0.05, Math.sin(a) * r * 0.22));
      }
      g.add(blob, mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.25, 10), std(0xffffff, 0.5), 0, -0.27, 0));
      face(g, 0.06, 0.28, 0.1, 0.04);
      ticks.push((t) => { blob.rotation.z = Math.sin(t * 6) * 0.12; blob.scale.setScalar(1 + Math.sin(t * 9) * 0.03); });
      break;
    }
    case "trofeo": { // copita dorada
      const gold = std(0xffc800, 0.25, { metalness: 0.75, emissive: 0x6a4a00, emissiveIntensity: 0.45 });
      g.add(mesh(new THREE.CylinderGeometry(0.28, 0.14, 0.4, 16), gold, 0, 0.08, 0), mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.2, 8), gold, 0, -0.2, 0), mesh(new THREE.BoxGeometry(0.34, 0.07, 0.24), std(0x64321b, 0.5), 0, -0.33, 0));
      for (const sx of [-1, 1]) g.add(mesh(new THREE.TorusGeometry(0.1, 0.03, 6, 12), gold, sx * 0.31, 0.1, 0));
      const star = new THREE.ExtrudeGeometry(starShape(0.07, 0.032), { depth: 0.02, bevelEnabled: false });
      g.add(mesh(star, std(0xffffff, 0.3), 0, 0.2, 0.26));
      face(g, 0.02, 0.2, 0.1, 0.04);
      ticks.push((t) => { g.rotation.z = Math.sin(t * 2.4) * 0.06; });
      break;
    }
    default:
      break;
  }
  g.scale.setScalar(0.8);
  // flota a la derecha del Matichico, subiendo y bajando un poco
  const holder = new THREE.Group();
  holder.position.set(0.95, 1.35, 0.05);
  holder.add(g);
  const baseY = holder.position.y;
  ticks.push((t, mode) => {
    holder.position.y = baseY + Math.sin(t * 2.2) * 0.07 + (mode === "jump" ? 0.12 : 0);
    g.rotation.y = Math.sin(t * 1.3) * 0.25;
  });
  return holder;
}
