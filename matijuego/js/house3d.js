// Escena 3D de "Mi Casa": un cuarto abierto por dos lados (se ve como una casita de muñecas)
// con tu Matichico y su mascota adentro. Lo que hay en cada lugar viene de
// js/house-data.js; aquí solo se dibuja. Es liviano y solo corre cuando la pantalla está visible.

import { THREE, canvasTexture, roundedBox } from "./three-kit.js?v=1140a83fef";
import { createMatichico } from "./matichico3d.js?v=1140a83fef";
import { getOutfit } from "./wardrobe-data.js?v=1140a83fef";
import { getHouseItem, houseItemsOfSpot, isWallItem } from "./house-data.js?v=1140a83fef";

let W = 10; // ancho del cuarto (10, 14 o 18 según cuánto lo agrandes); el alto es siempre 5.2
const H = 5.2;

const std = (color, rough = 0.6, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });
const basic = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, ...extra });
const box = (w, h, d, mat, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};
const rbox = (w, h, d, r, mat, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(roundedBox(w, h, d, r, r * 0.4), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};
const ball = (r, mat, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
};
const cyl = (r1, r2, h, mat, x = 0, y = 0, z = 0, seg = 18) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
};

// ---------- texturas de piso y paredes ----------

function floorTexture(p) {
  const t = canvasTexture(256, 256, (g, w, h) => {
    if (p.style === "madera") {
      for (let i = 0; i < 8; i++) {
        g.fillStyle = i % 2 ? p.a : p.b;
        g.fillRect(0, (i * h) / 8, w, h / 8 - 2);
        g.fillStyle = "rgba(0,0,0,0.08)";
        g.fillRect(((i * 53) % w), (i * h) / 8, 3, h / 8);
      }
    } else if (p.style === "damero") {
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? p.a : p.b; g.fillRect((x * w) / 8, (y * h) / 8, w / 8, h / 8); }
    } else if (p.style === "cesped") {
      g.fillStyle = p.a; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 500; i++) { g.fillStyle = i % 2 ? p.b : "rgba(255,255,255,0.12)"; g.fillRect(Math.random() * w, Math.random() * h, 3, 5); }
    } else if (p.style === "choco") {
      g.fillStyle = p.b; g.fillRect(0, 0, w, h);
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
        g.fillStyle = p.a; g.beginPath(); g.roundRect((x * w) / 4 + 4, (y * h) / 4 + 4, w / 4 - 8, h / 4 - 8, 8); g.fill();
        g.fillStyle = "rgba(255,255,255,0.12)"; g.fillRect((x * w) / 4 + 8, (y * h) / 4 + 8, w / 4 - 28, 6);
      }
    } else if (p.style === "nubes") {
      g.fillStyle = p.a; g.fillRect(0, 0, w, h);
      g.fillStyle = p.b;
      for (let i = 0; i < 14; i++) { g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 16 + Math.random() * 22, 0, 6.3); g.fill(); }
    } else {
      g.fillStyle = p.a; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 80; i++) { g.fillStyle = Math.random() < 0.3 ? p.b : "#ffffff"; g.globalAlpha = 0.5 + Math.random() * 0.5; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
      g.globalAlpha = 1;
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(p.style === "damero" ? 2 : 1.4, p.style === "damero" ? 2 : 1.4);
  return t;
}

/** Paredes con diseño: el lienzo tiene la misma proporción que la pared (10 x 5.2) para no deformar los dibujos. */
function wallTexture(p) {
  const Wd = 1024;
  const Hd = 512; // casi la proporción de la pared (10 x 5.2) y potencia de 2 para que no brille al verse de lado
  return canvasTexture(Wd, Hd, (g, w, h) => {
    const rail = Math.round(h * 0.34); // altura del zócalo decorado
    const shade = (hex, k) => {
      const n = parseInt(hex.slice(1), 16);
      const f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
      return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
    };
    // fondo con degradé suave (más claro arriba)
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, p.a); grd.addColorStop(1, shade(p.a, 0.93));
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    const tile = (step, draw) => { for (let y = 0, r = 0; y < h - rail + step; y += step, r++) for (let x = (r % 2) * (step / 2); x < w + step; x += step) draw(x, y, r); };
    const heart = (x, y, s) => { g.beginPath(); g.moveTo(x, y + s * 0.35); g.bezierCurveTo(x - s, y - s * 0.4, x - s * 0.5, y - s, x, y - s * 0.4); g.bezierCurveTo(x + s * 0.5, y - s, x + s, y - s * 0.4, x, y + s * 0.35); g.fill(); };
    const star = (x, y, s) => { g.beginPath(); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2; const r = i % 2 ? s * 0.45 : s; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath(); g.fill(); };
    const cloud = (x, y, s) => { g.beginPath(); for (const [dx, dy, r] of [[0, 0, 1], [-1, 0.25, 0.7], [1, 0.25, 0.75], [0.5, -0.4, 0.7], [-0.5, -0.35, 0.65]]) g.arc(x + dx * s, y + dy * s, r * s, 0, 6.3); g.fill(); };
    let wainscot = true;
    if (p.style === "liso") {
      // papel tapiz sutil de rombos + florcitas
      g.strokeStyle = shade(p.a, 0.9); g.lineWidth = 2; g.globalAlpha = 0.7;
      for (let i = -h; i < w + h; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke(); g.beginPath(); g.moveTo(i, h); g.lineTo(i + h, 0); g.stroke(); }
      g.globalAlpha = 1; g.fillStyle = p.b;
      tile(128, (x, y) => { g.globalAlpha = 0.55; for (let k = 0; k < 5; k++) { const a = (k / 5) * 6.283; g.beginPath(); g.arc(x + Math.cos(a) * 9, y + Math.sin(a) * 9, 6, 0, 6.3); g.fill(); } g.globalAlpha = 0.9; g.beginPath(); g.arc(x, y, 5, 0, 6.3); g.fill(); });
      g.globalAlpha = 1;
    } else if (p.style === "rayas") {
      const n = 14, sw = w / n;
      for (let i = 0; i < n; i += 2) { g.fillStyle = p.b; g.fillRect(i * sw, 0, sw, h); g.fillStyle = "rgba(255,255,255,0.25)"; g.fillRect(i * sw + sw * 0.1, 0, 4, h); }
    } else if (p.style === "lunares") {
      g.fillStyle = p.b;
      tile(96, (x, y, r) => { g.beginPath(); g.arc(x, y, r % 2 ? 14 : 22, 0, 6.3); g.fill(); });
    } else if (p.style === "corazones") {
      g.fillStyle = p.b;
      tile(110, (x, y, r) => { g.globalAlpha = 0.9; heart(x, y, r % 2 ? 22 : 30); });
      g.globalAlpha = 1;
    } else if (p.style === "nubes") {
      g.fillStyle = "rgba(255,255,255,0.9)";
      [[180, 140, 50], [520, 90, 40], [820, 190, 55], [330, 300, 38], [700, 330, 45], [960, 70, 30], [80, 330, 34]].forEach(([x, y, s]) => cloud(x, y, s));
      wainscot = false;
    } else if (p.style === "ladrillos") {
      const bw = 128, bh = 52;
      for (let y = 0, r = 0; y < h; y += bh, r++) for (let x = -(r % 2) * (bw / 2); x < w; x += bw) {
        g.fillStyle = (x / bw + r) % 3 ? p.a : shade(p.a, 0.88);
        g.fillRect(x + 3, y + 3, bw - 6, bh - 6);
        g.fillStyle = "rgba(255,255,255,0.1)"; g.fillRect(x + 3, y + 3, bw - 6, 6);
      }
      wainscot = false;
    } else if (p.style === "flores") {
      for (let i = 0; i < 26; i++) {
        const x = (i * 197) % w, y = ((i * 89) % (h - rail - 40)) + 30, r = 12 + (i % 3) * 5;
        g.fillStyle = ["#ff7aa8", "#ffd34d", "#fff6e6", "#b69cff"][i % 4];
        for (let k = 0; k < 5; k++) { const a = (k / 5) * 6.283; g.beginPath(); g.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.8, 0, 6.3); g.fill(); }
        g.fillStyle = "#ffb000"; g.beginPath(); g.arc(x, y, r * 0.6, 0, 6.3); g.fill();
      }
      g.strokeStyle = p.b; g.lineWidth = 5; g.globalAlpha = 0.6;
      for (let x = 40; x < w; x += 120) { g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 30, h * 0.2, x - 30, h * 0.4, x, h - rail); g.stroke(); }
      g.globalAlpha = 1;
    } else if (p.style === "estrellas") {
      g.fillStyle = "#fff8d0"; g.beginPath(); g.arc(w * 0.82, h * 0.25, 52, 0, 6.3); g.fill();
      g.fillStyle = p.a; g.beginPath(); g.arc(w * 0.82 + 22, h * 0.25 - 8, 46, 0, 6.3); g.fill();
      for (let i = 0; i < 90; i++) { g.fillStyle = p.b; g.globalAlpha = 0.35 + Math.random() * 0.65; star(Math.random() * w, Math.random() * (h - 20), 3 + Math.random() * 9); }
      g.globalAlpha = 1;
      wainscot = false;
    }
    if (wainscot) {
      // zócalo con paneles y moldura
      g.fillStyle = shade(p.a, 0.86); g.fillRect(0, h - rail, w, rail);
      g.fillStyle = "rgba(255,255,255,0.55)"; g.fillRect(0, h - rail - 6, w, 14);
      g.fillStyle = "rgba(0,0,0,0.12)"; g.fillRect(0, h - rail + 8, w, 4);
      for (let x = 24; x < w - 60; x += 168) {
        g.strokeStyle = "rgba(255,255,255,0.6)"; g.lineWidth = 5; g.strokeRect(x, h - rail + 34, 144, rail - 64);
        g.strokeStyle = "rgba(0,0,0,0.12)"; g.lineWidth = 2; g.strokeRect(x + 8, h - rail + 42, 128, rail - 80);
      }
    }
  });
}

const labelTexture = (text, bg, fg = "#ffffff", size = 90) => canvasTexture(256, 256, (g, w, h) => {
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.fillStyle = fg; g.font = `${size}px "Baby Chipmunk", sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(text, w / 2, h / 2 + 6);
});

// ---------- objetos de cada lugar ----------
// Cada constructor devuelve un grupo ubicado en el origen del lugar (el piso es y = 0,
// "mirando" hacia +z). `ticks` recibe animaciones.

const BUILD = {
  rug(p) {
    const g = new THREE.Group();
    const flat = (geo, mat, y = 0) => { const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.y = y; m.receiveShadow = true; return m; };
    if (p.kind === "redonda") { g.add(flat(new THREE.CircleGeometry(2.2, 40), std(p.a, 0.95), 0.02), flat(new THREE.CircleGeometry(1.5, 40), std(p.b, 0.95), 0.03)); }
    else if (p.kind === "arcoiris") { ["#ff3b3b", "#ffa800", "#ffe14a", "#4fd09a", "#3b8cff", "#9a5cff"].forEach((c, i) => g.add(flat(new THREE.CircleGeometry(2.3 - i * 0.36, 40), std(c, 0.95), 0.02 + i * 0.004))); }
    else if (p.kind === "estrella") {
      const s = new THREE.Shape();
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + Math.PI / 2; const r = i % 2 ? 1.05 : 2.4; (i ? s.lineTo : s.moveTo).call(s, Math.cos(a) * r, Math.sin(a) * r); }
      g.add(flat(new THREE.ShapeGeometry(s), std(p.a, 0.8, { metalness: 0.3 }), 0.02));
    } else if (p.kind === "corazon") {
      const s = new THREE.Shape(); const k = 1.5;
      s.moveTo(0, -k); s.bezierCurveTo(-k * 1.7, -k * 0.2, -k * 1.2, k * 1.2, 0, k * 0.5); s.bezierCurveTo(k * 1.2, k * 1.2, k * 1.7, -k * 0.2, 0, -k);
      g.add(flat(new THREE.ShapeGeometry(s), std(p.a, 0.9), 0.02));
    } else { // alfajor gigante
      g.add(flat(new THREE.CircleGeometry(2.4, 40), std(0x64321b, 0.8), 0.02), flat(new THREE.CircleGeometry(2.0, 40), std(0xe0b070, 0.9), 0.03), flat(new THREE.CircleGeometry(1.2, 40), std(0xfff0d0, 0.9), 0.04));
    }
    return g;
  },

  bed(p) {
    const g = new THREE.Group();
    g.rotation.y = Math.PI / 2; // la cabecera mira hacia la pared izquierda
    const frame = std(0xc98a4b, 0.6);
    if (p.kind === "simple") {
      g.add(rbox(2.1, 0.5, 3.2, 0.1, frame, 0, 0.35, 0));
      g.add(rbox(1.9, 0.35, 2.9, 0.12, std(p.b, 0.9), 0, 0.72, 0));
      g.add(rbox(1.9, 0.3, 1.9, 0.12, std(p.a, 0.85), 0, 0.9, 0.5));
      g.add(rbox(1.2, 0.28, 0.7, 0.12, std(0xffffff, 0.9), 0, 0.95, -1.05));
      g.add(rbox(2.1, 1.3, 0.2, 0.08, frame, 0, 0.9, -1.65));
    } else if (p.kind === "nube") {
      const m = std(0xffffff, 0.95);
      g.add(rbox(2.2, 0.4, 3.2, 0.2, std(0xbfe3ff, 0.9), 0, 0.25, 0));
      for (let i = 0; i < 5; i++) g.add(ball(0.7, m, -0.7 + (i % 3) * 0.7, 0.75 + (i % 2) * 0.1, -1.1 + i * 0.5));
      g.add(rbox(1.2, 0.3, 0.7, 0.12, std(0xffd1e3, 0.9), 0, 1.15, -1.1));
    } else if (p.kind === "cohete") {
      const red = std(0xe83a3a, 0.4);
      g.add(rbox(1.9, 0.5, 2.9, 0.2, std(0xdfe6f2, 0.3, { metalness: 0.5 }), 0, 0.5, 0));
      g.add(rbox(1.7, 0.3, 2.6, 0.12, std(0x3b8cff, 0.8), 0, 0.85, 0.1));
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.95, 1.6, 20), red);
      nose.rotation.x = -Math.PI / 2; nose.position.set(0, 0.7, 2.2); nose.castShadow = true; g.add(nose);
      for (const sx of [-1, 1]) { const fin = box(0.1, 0.9, 0.9, red, sx * 1.05, 0.7, -1.1); fin.rotation.z = sx * 0.3; g.add(fin); }
      g.add(rbox(1.0, 0.28, 0.6, 0.12, std(0xffffff, 0.9), 0, 1.05, -1.0));
      g.add(ball(0.22, basic(0x35f0ff), 0, 0.85, 1.1));
    } else {
      g.add(cyl(1.7, 1.7, 0.35, std(0x64321b, 0.5), 0, 0.3, 0.2, 30));
      g.add(cyl(1.55, 1.55, 0.3, std(0xe0b070, 0.8), 0, 0.6, 0.2, 30));
      g.add(cyl(1.6, 1.6, 0.22, std(0xfff0d0, 0.7), 0, 0.85, 0.2, 30));
      g.add(cyl(1.5, 1.5, 0.3, std(0xe0b070, 0.8), 0, 1.1, 0.2, 30));
      g.add(rbox(1.1, 0.3, 0.7, 0.12, std(0xffd1e3, 0.9), 0, 1.4, -0.7));
    }
    return g;
  },

  left(p, ticks) {
    const g = new THREE.Group();
    g.rotation.y = Math.PI / 2;
    const wood = std(0xc98a4b, 0.6);
    if (p.kind === "planta") {
      g.add(cyl(0.55, 0.42, 0.8, std(0xd4216c, 0.5), 0, 0.4, 0));
      for (let i = 0; i < 7; i++) { const l = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.5, 6), std(i % 2 ? 0x3fa24a : 0x58c060, 0.7)); l.position.set(Math.sin(i * 0.9) * 0.35, 1.5, Math.cos(i * 0.9) * 0.35); l.rotation.set(Math.cos(i * 0.9) * 0.4, 0, -Math.sin(i * 0.9) * 0.4); l.castShadow = true; g.add(l); }
    } else if (p.kind === "escritorio") {
      g.add(box(2.4, 0.12, 1.1, wood, 0, 1.2, 0));
      for (const [x, z] of [[-1.1, -0.45], [1.1, -0.45], [-1.1, 0.45], [1.1, 0.45]]) g.add(box(0.1, 1.2, 0.1, wood, x, 0.6, z));
      g.add(box(0.9, 0.05, 0.6, std(0xbfc5d2, 0.3, { metalness: 0.6 }), -0.3, 1.28, 0.1));
      const screen = box(0.9, 0.55, 0.05, std(0x2a2a3a, 0.3), -0.3, 1.58, -0.2);
      screen.rotation.x = -0.15;
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.45), basic(0x35f0ff));
      glow.position.set(-0.3, 1.59, -0.17); glow.rotation.x = -0.15;
      g.add(screen, glow, ball(0.18, std(0xffc800, 0.4), 0.8, 1.38, 0.1), cyl(0.12, 0.1, 0.22, std(0xd4216c), 0.9, 1.37, -0.3));
      g.add(rbox(0.9, 0.12, 0.8, 0.05, std(0xd4216c, 0.6), 0, 0.55, 1.0));
      ticks.push((t) => { glow.material.color.setHSL(0.5 + Math.sin(t) * 0.05, 0.9, 0.6); });
    } else if (p.kind === "estanteria") {
      g.add(box(2.2, 3.0, 0.5, wood, 0, 1.5, 0));
      const cols = [0xff6fb0, 0xffc800, 0x4fd09a, 0x3b8cff, 0xe8742a];
      for (let r = 0; r < 3; r++) {
        g.add(box(2.05, 0.06, 0.55, std(0xa86a3a, 0.6), 0, 0.55 + r * 0.95, 0.02));
        for (let i = 0; i < 5; i++) g.add(rbox(0.32, 0.5, 0.3, 0.05, std(cols[(i + r) % 5], 0.5), -0.8 + i * 0.4, 0.88 + r * 0.95, 0.05));
      }
    } else if (p.kind === "oso") {
      const m = std(0xb97a4a, 0.95);
      g.add(ball(0.9, m, 0, 0.9, 0), ball(0.62, m, 0, 2.0, 0.05), ball(0.25, m, -0.45, 2.55, 0), ball(0.25, m, 0.45, 2.55, 0), ball(0.3, std(0xf0d0a8, 0.95), 0, 1.95, 0.5));
      g.add(ball(0.08, std(0x1a1010, 0.3), -0.2, 2.1, 0.58), ball(0.08, std(0x1a1010, 0.3), 0.2, 2.1, 0.58), ball(0.09, std(0x1a1010, 0.3), 0, 1.98, 0.78));
      g.add(ball(0.32, m, -0.85, 1.1, 0.35), ball(0.32, m, 0.85, 1.1, 0.35), ball(0.35, m, -0.45, 0.25, 0.5), ball(0.35, m, 0.45, 0.25, 0.5));
      g.add(rbox(0.9, 0.18, 0.18, 0.06, std(0xd4216c, 0.6), 0, 1.45, 0.4));
    } else { // arcade
      g.add(rbox(1.5, 3.0, 1.1, 0.15, std(0x3a2a8a, 0.4), 0, 1.5, 0));
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.9), basic(0x35f0ff));
      scr.position.set(0, 2.2, 0.56);
      g.add(scr, rbox(1.4, 0.35, 0.9, 0.08, std(0xd4216c, 0.4), 0, 1.3, 0.35), ball(0.1, std(0xffc800, 0.3), -0.3, 1.5, 0.45), ball(0.1, std(0x35f0ff, 0.3), 0.3, 1.5, 0.45));
      g.add(rbox(1.3, 0.35, 0.1, 0.05, std(0xffc800, 0.3), 0, 2.85, 0.5));
      ticks.push((t) => { scr.material.color.setHSL((t * 0.3) % 1, 0.9, 0.55); });
    }
    return g;
  },

  right(p, ticks) {
    const g = new THREE.Group();
    if (p.kind === "lampara") {
      g.add(cyl(0.45, 0.5, 0.1, std(0x2a1810), 0, 0.05, 0), cyl(0.05, 0.05, 2.8, std(0x2a1810), 0, 1.45, 0));
      const shade = cyl(0.45, 0.7, 0.7, std(0xfff1b0, 0.6, { emissive: 0xffd34d, emissiveIntensity: 0.6, side: THREE.DoubleSide }), 0, 3.0, 0);
      g.add(shade);
      ticks.push((t) => { shade.material.emissiveIntensity = 0.55 + Math.sin(t * 2) * 0.08; });
    } else if (p.kind === "flores") {
      g.add(cyl(0.6, 0.45, 0.85, std(0xff8a2a, 0.5), 0, 0.42, 0));
      for (let i = 0; i < 6; i++) {
        const a = i * 1.05;
        g.add(cyl(0.025, 0.025, 1.2 + (i % 3) * 0.3, std(0x3fa24a), Math.sin(a) * 0.25, 1.4, Math.cos(a) * 0.25, 6));
        g.add(ball(0.2, std([0xff6fb0, 0xffc800, 0xffffff][i % 3], 0.5), Math.sin(a) * 0.3, 2.1 + (i % 3) * 0.3, Math.cos(a) * 0.3));
      }
    } else if (p.kind === "cacao") {
      g.add(cyl(0.18, 0.28, 2.4, std(0x64321b, 0.8), 0, 1.2, 0), ball(1.0, std(0x3d9a5a, 0.8), 0, 2.9, 0), ball(0.7, std(0x58c060, 0.8), -0.5, 2.4, 0.4));
      for (const [x, y, z] of [[-0.5, 2.5, 0.8], [0.5, 2.8, 0.7], [0.1, 2.1, 0.9]]) { const pod = ball(0.2, std(0xe8742a, 0.6), x, y, z); pod.scale.set(0.8, 1.2, 0.8); g.add(pod); }
    } else if (p.kind === "cofre") {
      g.add(rbox(1.5, 0.8, 1.0, 0.1, std(0x8a5a36, 0.6), 0, 0.4, 0));
      const lid = cyl(0.5, 0.5, 1.5, std(0x8a5a36, 0.6), 0, 0.85, 0, 16); lid.rotation.z = Math.PI / 2; g.add(lid);
      g.add(box(1.52, 0.12, 1.02, std(0xffc800, 0.3, { metalness: 0.7 }), 0, 0.5, 0), rbox(0.25, 0.3, 0.1, 0.04, std(0xffc800, 0.3, { metalness: 0.7 }), 0, 0.7, 0.52));
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.2), std(0x7ff0ff, 0.15, { emissive: 0x25b8d8, emissiveIntensity: 0.9 }));
      gem.position.set(0, 1.5, 0); g.add(gem);
      ticks.push((t) => { gem.rotation.y = t * 2; gem.position.y = 1.5 + Math.sin(t * 2) * 0.08; });
    } else { // mini fuente
      g.add(cyl(0.95, 1.05, 0.4, std(0xfff6e6, 0.5), 0, 0.2, 0, 24), cyl(0.8, 0.8, 0.06, std(0x4a2412, 0.2, { metalness: 0.2 }), 0, 0.4, 0, 24));
      g.add(cyl(0.3, 0.4, 0.8, std(0xffc800, 0.3, { metalness: 0.6 }), 0, 0.8, 0), cyl(0.45, 0.6, 0.15, std(0x5a2a14, 0.2), 0, 1.25, 0), ball(0.2, std(0xffc800, 0.3, { metalness: 0.6 }), 0, 1.5, 0));
      const drops = [];
      for (let i = 0; i < 8; i++) { const d = ball(0.06, std(0x5a2a14, 0.2), 0, 1.4, 0); g.add(d); drops.push({ d, a: (i / 8) * 6.28, t: i / 8 }); }
      ticks.push((t, dt) => { for (const o of drops) { o.t = (o.t + dt * 0.7) % 1; const r = 0.15 + o.t * 0.6; o.d.position.set(Math.sin(o.a) * r, 1.45 + Math.sin(o.t * 3.14) * 0.35 - o.t * o.t * 0.9, Math.cos(o.a) * r); } });
    }
    return g;
  },

  // cosas que cuelgan de una pared: el grupo mira hacia +z y se coloca pegado a la pared
  wall(p, ticks) {
    const g = new THREE.Group();
    const frame = std(0x8a5a36, 0.5);
    if (p.kind === "ventana") {
      g.add(box(2.0, 2.2, 0.12, frame, 0, 0, 0));
      const sky = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.9), p.night ? new THREE.MeshBasicMaterial({ map: wallTexture({ style: "estrellas", a: "#0f0e30", b: "#fff1a8" }) }) : basic(p.a));
      sky.position.z = 0.07; g.add(sky);
      g.add(box(0.08, 1.9, 0.1, frame, 0, 0, 0.08), box(1.7, 0.08, 0.1, frame, 0, 0, 0.08));
      if (p.night) g.add(ball(0.18, basic(0xfff1b0), 0.4, 0.5, 0.1));
      else { const sun = ball(0.2, basic(0xffe14a), -0.4, 0.5, 0.1); g.add(sun); }
      if (p.curtains) for (const sx of [-1, 1]) g.add(rbox(0.5, 2.4, 0.12, 0.05, std(0xd4216c, 0.9), sx * 1.15, 0, 0.12));
    } else if (p.kind === "reloj") {
      g.add(cyl(0.8, 0.8, 0.12, frame, 0, 0, 0.06, 28).rotateX(Math.PI / 2));
      const face = new THREE.Mesh(new THREE.CircleGeometry(0.7, 28), basic(0xfff6e6)); face.position.z = 0.13; g.add(face);
      const hand = box(0.06, 0.5, 0.03, std(0x2a1810), 0, 0.2, 0.15); const pivotH = new THREE.Group(); pivotH.position.z = 0.15; pivotH.add(hand); g.add(pivotH);
      const hand2 = box(0.04, 0.35, 0.03, std(0xd4216c), 0, 0.14, 0.16); const pivotM = new THREE.Group(); pivotM.position.z = 0.16; pivotM.add(hand2); g.add(pivotM);
      ticks.push((t) => { pivotH.rotation.z = -t * 0.02; pivotM.rotation.z = -t * 0.3; });
    } else if (p.kind === "poster") {
      g.add(box(1.7, 2.3, 0.08, frame, 0, 0, 0));
      const pic = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.1), new THREE.MeshBasicMaterial({ map: labelTexture(p.icon, p.a, "#fff6e6", 150) }));
      pic.position.z = 0.05; g.add(pic);
    } else if (p.kind === "estrellas") {
      for (let i = 0; i < 7; i++) { const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.14 + (i % 3) * 0.05), basic(i % 2 ? 0xffe14a : 0x9fe8ff)); s.position.set(Math.sin(i * 2.1) * 1.1, Math.cos(i * 1.7) * 1.0, 0.1); g.add(s); ticks.push((t) => { s.rotation.y = t + i; s.scale.setScalar(0.8 + Math.sin(t * 2 + i) * 0.25); }); }
    } else if (p.kind === "cuadro") {
      g.add(box(2.3, 1.7, 0.1, std(0xffc800, 0.3, { metalness: 0.6 }), 0, 0, 0));
      const pic = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.4), new THREE.MeshBasicMaterial({ map: canvasTexture(256, 180, (c, w, h) => { c.fillStyle = "#b8e8ff"; c.fillRect(0, 0, w, h); c.fillStyle = "#6cc04a"; c.fillRect(0, h * 0.7, w, h * 0.3); c.fillStyle = "#64321b"; c.fillRect(w * 0.4, h * 0.35, w * 0.2, h * 0.45); c.fillStyle = "#ffffff"; c.beginPath(); c.arc(w * 0.46, h * 0.5, 7, 0, 6.3); c.arc(w * 0.54, h * 0.5, 7, 0, 6.3); c.fill(); c.fillStyle = "#000"; c.fillRect(w * 0.45, h * 0.49, 4, 5); c.fillRect(w * 0.53, h * 0.49, 4, 5); c.fillStyle = "#ffe14a"; c.beginPath(); c.arc(w * 0.85, h * 0.2, 16, 0, 6.3); c.fill(); }) }));
      pic.position.z = 0.06; g.add(pic);
    } else if (p.kind === "arcoiris") {
      ["#ff3b3b", "#ffa800", "#ffe14a", "#4fd09a", "#3b8cff", "#9a5cff"].forEach((c, i) => { const r = new THREE.Mesh(new THREE.TorusGeometry(1.7 - i * 0.18, 0.1, 6, 30, Math.PI), basic(c)); r.position.set(0, -0.7, 0.05); g.add(r); });
    } else if (p.kind === "trofeos") {
      g.add(box(3.0, 0.12, 0.5, frame, 0, -0.3, 0.25));
      for (const [i, x] of [-1, 0, 1].entries()) {
        g.add(cyl(0.26, 0.15, 0.45, std(0xffc800, 0.25, { metalness: 0.8 }), x * 0.9, 0.0 + i * 0.03, 0.25), cyl(0.12, 0.12, 0.15, std(0xffc800, 0.25, { metalness: 0.8 }), x * 0.9, -0.2, 0.25));
      }
      g.add(box(3.0, 0.12, 0.5, frame, 0, 0.9, 0.25), ball(0.28, std(0xffffff, 0.4), -0.9, 1.2, 0.25), rbox(0.6, 0.5, 0.3, 0.08, std(0xd4216c, 0.5), 0.2, 1.2, 0.25));
    } else if (p.kind === "tv") {
      g.add(rbox(3.4, 2.0, 0.2, 0.1, std(0x1a1a24, 0.3), 0, 0, 0));
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 1.7), basic(0x4fd0ff)); scr.position.z = 0.12; g.add(scr);
      ticks.push((t) => { scr.material.color.setHSL((0.55 + Math.sin(t * 0.7) * 0.2 + 1) % 1, 0.8, 0.55 + Math.sin(t * 3) * 0.05); });
    } else if (p.kind === "neon") {
      const m = basic(0xff3fa4);
      const s = new THREE.Shape(); const k = 0.7;
      s.moveTo(0, -k); s.bezierCurveTo(-k * 1.7, -k * 0.2, -k * 1.2, k * 1.2, 0, k * 0.5); s.bezierCurveTo(k * 1.2, k * 1.2, k * 1.7, -k * 0.2, 0, -k);
      const heart = new THREE.Mesh(new THREE.ShapeGeometry(s), m); heart.position.z = 0.05; g.add(heart);
      const outline = new THREE.Mesh(new THREE.ShapeGeometry(s), basic(0xffffff, { transparent: true, opacity: 0.35 })); outline.scale.setScalar(1.25); outline.position.z = 0.03; g.add(outline);
      ticks.push((t) => { heart.scale.setScalar(1 + Math.sin(t * 3) * 0.06); m.color.setHSL(0.9, 1, 0.6 + Math.sin(t * 3) * 0.08); });
    } else if (p.kind === "corazones") {
      for (let i = 0; i < 6; i++) {
        const k = 0.18 + (i % 3) * 0.05; const s = new THREE.Shape();
        s.moveTo(0, -k); s.bezierCurveTo(-k * 1.7, -k * 0.2, -k * 1.2, k * 1.2, 0, k * 0.5); s.bezierCurveTo(k * 1.2, k * 1.2, k * 1.7, -k * 0.2, 0, -k);
        const h = new THREE.Mesh(new THREE.ShapeGeometry(s), basic([0xff3b6b, 0xff9ab8, 0xffffff][i % 3])); h.position.set(Math.sin(i * 2.4) * 1.0, Math.cos(i * 1.9) * 0.8, 0.06); g.add(h);
      }
    } else if (p.kind === "repisa") {
      g.add(box(2.6, 0.12, 0.5, frame, 0, 0, 0.25));
      for (let i = 0; i < 3; i++) { g.add(cyl(0.2, 0.15, 0.3, std(0xd4216c, 0.5), -0.8 + i * 0.8, 0.2, 0.25)); for (let k = 0; k < 4; k++) { const l = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.5, 5), std(0x3fa24a)); l.position.set(-0.8 + i * 0.8 + Math.sin(k * 1.6) * 0.1, 0.6, 0.25 + Math.cos(k * 1.6) * 0.1); l.rotation.z = Math.sin(k * 1.6) * 0.4; g.add(l); } }
    } else if (p.kind === "luces") {
      const pts = [];
      for (let i = 0; i <= 12; i++) { const x = -1.9 + i * (3.8 / 12); const y = Math.sin((i / 12) * Math.PI) * -0.5; pts.push([x, y]); }
      const bulbs = [];
      pts.forEach(([x, y], i) => { const b = ball(0.09, basic([0xff3fa4, 0xffe14a, 0x4fd0ff, 0x9a5cff][i % 4]), x, y, 0.1); b.castShadow = false; g.add(b); bulbs.push(b); });
      ticks.push((t) => bulbs.forEach((b, i) => b.scale.setScalar(0.8 + Math.abs(Math.sin(t * 3 + i * 0.7)) * 0.5)));
    }
    return g;
  },

  free(p, ticks) {
    const g = new THREE.Group();
    const wood = std(p.a || 0xc98a4b, 0.6);
    if (p.kind === "sofa") {
      const main = std(p.a, 0.8);
      g.add(rbox(3.0, 0.6, 1.3, 0.15, main, 0, 0.45, 0));
      g.add(rbox(3.0, 1.0, 0.4, 0.15, main, 0, 1.0, -0.55));
      for (const sx of [-1.4, 1.4]) g.add(rbox(0.4, 0.9, 1.3, 0.15, main, sx, 0.75, 0));
      for (const sx of [-0.7, 0.7]) g.add(rbox(1.2, 0.3, 0.95, 0.12, std(p.b, 0.85), sx, 0.85, 0.12));
      for (const sx of [-1.15, 1.15]) g.add(rbox(0.55, 0.5, 0.2, 0.1, std(0xffd34d, 0.8), sx, 1.1, 0.2));
    } else if (p.kind === "mesa") {
      g.add(cyl(1.1, 1.1, 0.15, wood, 0, 1.05, 0, 28));
      g.add(cyl(0.18, 0.28, 1.0, wood, 0, 0.5, 0, 12));
      g.add(cyl(0.7, 0.8, 0.1, wood, 0, 0.05, 0, 20));
      [0xff3b6b, 0xffe14a, 0x4fd0ff, 0xb9f0a8, 0xff9ac8].forEach((c, i) => { const a = i * 1.25; g.add(ball(0.17, std(c, 0.3), Math.sin(a) * 0.55, 1.3, Math.cos(a) * 0.55)); });
      g.add(cyl(0.3, 0.3, 0.12, std(p.b, 0.4), 0, 1.18, 0, 16));
    } else if (p.kind === "silla") {
      g.add(rbox(0.9, 0.15, 0.9, 0.06, wood, 0, 0.8, 0));
      g.add(rbox(0.9, 1.0, 0.14, 0.06, wood, 0, 1.3, -0.4));
      g.add(rbox(0.7, 0.08, 0.12, 0.03, std(p.b, 0.4), 0, 1.6, -0.34));
      for (const [x, z] of [[-0.38, -0.38], [0.38, -0.38], [-0.38, 0.38], [0.38, 0.38]]) g.add(box(0.1, 0.8, 0.1, wood, x, 0.4, z));
    } else if (p.kind === "comoda") {
      g.add(rbox(2.2, 1.5, 1.0, 0.08, std(p.a, 0.7), 0, 0.8, 0));
      for (let i = 0; i < 3; i++) {
        g.add(rbox(1.95, 0.4, 0.06, 0.04, std(0xffffff, 0.6), 0, 0.35 + i * 0.45, 0.52));
        g.add(ball(0.07, std(p.b, 0.3), 0, 0.35 + i * 0.45, 0.58));
      }
      g.add(rbox(2.3, 0.1, 1.1, 0.04, std(p.b, 0.5), 0, 1.58, 0));
    } else if (p.kind === "pelotero") {
      g.add(cyl(1.6, 1.6, 0.6, std(0x4fd0ff, 0.5), 0, 0.3, 0, 32));
      g.add(cyl(1.4, 1.4, 0.62, std(0x1f2a44, 0.9), 0, 0.31, 0, 32));
      const cols = [0xff3b6b, 0xffe14a, 0x4fd0ff, 0x4fd09a, 0x9a5cff];
      for (let i = 0; i < 46; i++) { const a = i * 2.4, r = Math.sqrt((i + 1) / 46) * 1.25; g.add(ball(0.2, std(cols[i % 5], 0.3), Math.cos(a) * r, 0.55 + (i % 3) * 0.12, Math.sin(a) * r)); }
    } else if (p.kind === "tipi") {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1.5, 3.0, 5, 1, true), std(p.a, 0.9, { side: THREE.DoubleSide, flatShading: true }));
      cone.position.y = 1.5; cone.castShadow = true; g.add(cone);
      const door = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.6), std(0x3a2218, 0.9, { side: THREE.DoubleSide }));
      door.position.set(0, 0.8, 0.78); door.rotation.x = -0.28; g.add(door);
      for (let i = 0; i < 5; i++) { const a = (i / 5) * 6.283; g.add(cyl(0.04, 0.04, 3.4, wood, Math.sin(a) * 0.12, 1.7, Math.cos(a) * 0.12, 6).rotateZ(0)); }
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.97, 1.05, 0.2, 5, 1, true), std(p.b, 0.7, { side: THREE.DoubleSide }));
      band.position.y = 1.5; g.add(band);
      g.add(rbox(2.3, 0.08, 2.3, 0.04, std(0xffd34d, 0.9), 0, 0.04, 0.4));
    } else if (p.kind === "piano") {
      const black = std(0x1c1c26, 0.25, { metalness: 0.2 });
      g.add(rbox(2.4, 0.9, 3.0, 0.12, black, 0, 1.0, 0));
      g.add(rbox(2.0, 0.12, 0.7, 0.03, std(0xffffff, 0.4), 0, 1.5, 1.3));
      for (let i = 0; i < 7; i++) g.add(box(0.12, 0.1, 0.45, black, -0.8 + i * 0.27, 1.58, 1.15));
      for (const [x, z] of [[-1.0, -1.2], [1.0, -1.2], [0, 1.2]]) g.add(cyl(0.1, 0.12, 0.9, black, x, 0.45, z, 10));
      const lid = rbox(2.2, 0.05, 2.0, 0.02, black, 0, 1.55, -0.3); lid.rotation.x = -0.4; lid.position.y = 1.7; g.add(lid);
      g.add(rbox(0.9, 0.12, 0.5, 0.04, std(0x8a4b2c, 0.5), 0, 0.7, 2.0), cyl(0.04, 0.04, 0.5, black, 0, 0.45, 2.0, 6));
    } else if (p.kind === "pastel") {
      g.add(cyl(1.1, 1.1, 0.12, std(0xffffff, 0.5), 0, 1.0, 0, 28), cyl(0.15, 0.2, 1.0, std(0xd9a066, 0.6), 0, 0.5, 0, 12));
      g.add(cyl(0.95, 0.95, 0.4, std(0xff9ac8, 0.6), 0, 1.3, 0, 24), cyl(0.7, 0.7, 0.35, std(0xfff6e6, 0.6), 0, 1.68, 0, 24), cyl(0.45, 0.45, 0.3, std(0x8a4b2c, 0.6), 0, 2.0, 0, 20));
      for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.283; g.add(ball(0.1, std(0xff3b6b, 0.3), Math.sin(a) * 0.95, 1.52, Math.cos(a) * 0.95)); }
      g.add(cyl(0.03, 0.03, 0.35, std(0xffffff), 0, 2.3, 0, 6), ball(0.07, basic(0xffe14a), 0, 2.5, 0));
      ticks.push((t) => { g.children[g.children.length - 1].scale.setScalar(1 + Math.sin(t * 9) * 0.25); });
    } else if (p.kind === "trampolin") {
      g.add(cyl(1.6, 1.6, 0.18, std(0x1c1c26, 0.8), 0, 0.75, 0, 32), cyl(1.35, 1.35, 0.2, std(0xff7aa8, 0.6), 0, 0.77, 0, 32));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.1, 8, 32), std(0xffc800, 0.4, { metalness: 0.5 }));
      ring.rotation.x = Math.PI / 2; ring.position.y = 0.8; g.add(ring);
      for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.283; g.add(cyl(0.07, 0.07, 0.75, std(0xcfcfd4, 0.3, { metalness: 0.8 }), Math.sin(a) * 1.55, 0.38, Math.cos(a) * 1.55, 8)); }
    }
    return g;
  },

  ceiling(p, ticks) {
    const g = new THREE.Group();
    if (p.kind === "lampara") {
      g.add(cyl(0.02, 0.02, 1.5, std(0x2a1810), 0, 4.45, 0, 6));
      const sh = new THREE.Mesh(new THREE.ConeGeometry(0.8, 0.7, 20, 1, true), std(0xff8ab8, 0.6, { side: THREE.DoubleSide, emissive: 0xff5a9a, emissiveIntensity: 0.4 }));
      sh.position.y = 3.35; g.add(sh, ball(0.2, basic(0xfff1b0), 0, 3.25, 0));
    } else if (p.kind === "globos") {
      [[-1.5, 0xff3b6b], [-0.6, 0xffe14a], [0.3, 0x4fd0ff], [1.2, 0x9a5cff], [1.9, 0x4fd09a]].forEach(([x, c], i) => {
        const b = ball(0.5, std(c, 0.3), x, 3.9 + (i % 2) * 0.4, (i - 2) * 0.4); b.scale.y = 1.2; g.add(b);
        const line = cyl(0.01, 0.01, 1.3, std(0xffffff), x, 3.1 + (i % 2) * 0.4, (i - 2) * 0.4, 4); g.add(line);
        ticks.push((t) => { b.position.y = 3.9 + (i % 2) * 0.4 + Math.sin(t * 1.4 + i) * 0.1; });
      });
    } else if (p.kind === "banderines") {
      const cols = [0xff3b6b, 0xffe14a, 0x4fd0ff, 0x9a5cff, 0x4fd09a, 0xff8a2a];
      for (let i = 0; i < 12; i++) {
        const x = -4 + i * 0.7; const y = 4.7 - Math.sin((i / 11) * Math.PI) * 0.7;
        const f = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.45, 3), std(cols[i % 6], 0.7, { side: THREE.DoubleSide })); f.rotation.z = Math.PI; f.position.set(x, y - 0.2, -4.2); g.add(f);
      }
    } else if (p.kind === "luna") {
      const moon = ball(0.7, std(0xfff1b0, 0.5, { emissive: 0xffd34d, emissiveIntensity: 0.5 }), 0, 3.6, 0);
      g.add(cyl(0.02, 0.02, 1.7, std(0xffffff), 0, 4.45, 0, 6), moon);
      for (let i = 0; i < 4; i++) { g.add(cyl(0.01, 0.01, 0.8 + i * 0.3, std(0xffffff), -1.5 + i, 4.8 - i * 0.1, 0.4, 4)); const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.2), basic(0xffe14a)); s.position.set(-1.5 + i, 4.2 - i * 0.2 - 0.3, 0.4); g.add(s); ticks.push((t) => { s.rotation.y = t * 1.5 + i; }); }
    } else {
      const disco = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 1), std(0xdfe6f2, 0.15, { metalness: 0.95, flatShading: true }));
      disco.position.set(0, 3.5, 0); g.add(cyl(0.02, 0.02, 1.7, std(0xffffff), 0, 4.45, 0, 6), disco);
      const pl = new THREE.PointLight(0xff5ac8, 6, 9); pl.position.set(0, 3.2, 0); g.add(pl);
      ticks.push((t) => { disco.rotation.y = t * 0.8; pl.color.setHSL((t * 0.2) % 1, 1, 0.6); });
    }
    return g;
  },
};

export class House3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.active = false;
    this.ready = false;
    this.time = 0;
    this.key = "";
    this.spotObjs = {};
    this.ticks = [];
    this.dragYaw = 0;
    this.furn = new Map(); // uid -> { group, data }
    this.sel = null;
    this.size = 10;
  }

  init() {
    const canvas = this.canvas;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !coarse, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 80);
    this.hemi = new THREE.HemisphereLight(0xfff0e0, 0x8a5a60, 1.35);
    this.scene.add(this.hemi);
    const sun = new THREE.DirectionalLight(0xfff3dc, 2.4);
    this.sun = sun;
    sun.position.set(6, 10, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 30 });
    sun.shadow.bias = -0.0008;
    this.scene.add(sun);

    this.shell = null;
    this._buildShell(10);

    this._resize = () => {
      const w = Math.max(1, canvas.clientWidth);
      const h = Math.max(1, canvas.clientHeight);
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      const fit = Math.max(1, 1.35 / this.camera.aspect);
      const d = 17.5 * fit * (this.size / 10);
      this.camera.position.set(d * 0.62, d * 0.46, d * 0.7);
      this.camera.lookAt(0, 1.9, 0);
      this.camera.updateProjectionMatrix();
    };
    new ResizeObserver(this._resize).observe(canvas);
    this._resize();
    this._loop = this._loop.bind(this);
    this.ready = true;
  }

  /** Arma (o rearma) piso, paredes y marcos para un cuarto de `size` x `size`. */
  _buildShell(size) {
    if (this.shell) {
      this.scene.remove(this.shell);
      this.shell.traverse((o) => { o.geometry?.dispose?.(); });
    }
    this.size = size;
    W = size;
    const shell = new THREE.Group();
    const keepFloor = this.floor?.material;
    const keepWall = this.back?.material;
    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(W, W), keepFloor || std(0xffffff, 0.7));
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.receiveShadow = true;
    this.back = new THREE.Mesh(new THREE.PlaneGeometry(W, H), keepWall || std(0xffffff, 0.9));
    this.back.position.set(0, H / 2, -W / 2);
    this.back.receiveShadow = true;
    this.left = new THREE.Mesh(new THREE.PlaneGeometry(W, H), this.left?.material || std(0xffffff, 0.9));
    this.left.position.set(-W / 2, H / 2, 0);
    this.left.rotation.y = Math.PI / 2;
    this.left.receiveShadow = true;
    const trim = std(0xffffff, 0.5);
    const base1 = box(W, 0.3, 0.2, trim, 0, 0.15, -W / 2 + 0.1);
    const base2 = box(0.2, 0.3, W, trim, -W / 2 + 0.1, 0.15, 0);
    const slab = box(W + 0.6, 0.5, W + 0.6, std(0x8a5a36, 0.7), 0, -0.26, 0);
    const edge1 = box(W + 0.6, H + 0.5, 0.3, std(0xd4216c, 0.5), 0, H / 2 - 0.01, -W / 2 - 0.19);
    const edge2 = box(0.3, H + 0.5, W + 0.6, std(0xd4216c, 0.5), -W / 2 - 0.19, H / 2 - 0.01, 0);
    shell.add(this.floor, this.back, this.left, base1, base2, slab, edge1, edge2);
    this.shell = shell;
    this.scene.add(shell);
    // las texturas se repiten según el tamaño para que los dibujos no se estiren
    for (const m of [this.floor.material, this.back.material, this.left.material]) if (m.map) { m.map.wrapS = THREE.RepeatWrapping; }
    this._fitTextures();
    this.sun && Object.assign(this.sun.shadow.camera, { left: -W * 0.9, right: W * 0.9, top: W * 0.9, bottom: -W * 0.9 });
    this.sun && this.sun.shadow.camera.updateProjectionMatrix();
    this._resize && this._resize();
  }

  _fitTextures() {
    const k = W / 10;
    const fit = (map, kx, ky) => {
      if (!map) return;
      map.userData.base = map.userData.base || map.repeat.clone();
      map.wrapS = map.wrapT = THREE.RepeatWrapping;
      map.repeat.set(map.userData.base.x * kx, map.userData.base.y * ky);
    };
    fit(this.floor.material.map, k, k);
    for (const m of [this.back, this.left]) fit(m.material.map, k, 1);
  }

  /** Cambia el tamaño del cuarto (10, 14 o 18). */
  setSize(size) {
    if (!this.ready || size === this.size) return;
    this._buildShell(size);
  }

  /** Dibuja el Matichico (con su mascota) dentro del cuarto. */
  setHero(character, look, key) {
    if (!this.ready) return;
    if (this.hero) this.scene.remove(this.hero.group);
    this.hero = createMatichico(character, getOutfit(look.outfit), look);
    this.hero.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.hero.group.scale.setScalar(1.7);
    this.hero.group.position.set(1.6, 0, 1.4);
    this.hero.group.rotation.y = 0.5;
    this.scene.add(this.hero.group);
    this.key = key;
  }

  /** `placed` = { lugar: idObjeto } con lo que hay en cada rincón. */
  setPlaced(placed) {
    if (!this.ready) return;
    this.ticks = [];
    // paredes y piso
    const fl = getHouseItem(placed.floor);
    const wl = getHouseItem(placed.wall);
    if (fl) {
      const t = floorTexture(fl.params);
      this.floor.material.map?.dispose();
      this.floor.material.map = t;
      this.floor.material.needsUpdate = true;
    }
    if (wl) {
      for (const m of [this.back, this.left]) {
        m.material.map?.dispose();
        m.material.map = wallTexture(wl.params);
        m.material.needsUpdate = true;
      }
    }
    this._fitTextures();
    for (const [spot, obj] of Object.entries(this.spotObjs)) { this.scene.remove(obj); obj.traverse((o) => { o.geometry?.dispose?.(); }); delete this.spotObjs[spot]; }
    const anchors = {
      rug: [0.2, 0.0, 1.0, 0],
      bed: [-3.4, 0, -2.2, 0],
      left: [-4.0, 0, 2.8, 0],
      right: [3.7, 0, -3.8, 0],
      ceiling: [0, 0, 0, 0],
    };
    const wallAnchors = { wallL: [-4.9, 2.7, 0.4, Math.PI / 2], wallC: [0.3, 2.8, -4.9, 0], wallR: [3.4, 2.7, -4.9, 0] };
    for (const spot of Object.keys(anchors).concat(Object.keys(wallAnchors))) {
      const item = getHouseItem(placed[spot]);
      if (!item || item.spot !== spot) continue;
      const kind = anchors[spot] ? spot : "wall";
      const g = BUILD[kind](item.params, this.ticks);
      const a = anchors[spot] || wallAnchors[spot];
      const holder = new THREE.Group();
      holder.position.set(a[0], a[1], a[2]);
      holder.rotation.y = a[3];
      holder.add(g);
      this.scene.add(holder);
      this.spotObjs[spot] = holder;
    }
    if (this.layoutData) this.setLayout(this.layoutData); // las piezas libres vuelven a armarse (sus animaciones usan `ticks`)
  }

  // ---------- decorar libre ----------

  _buildFurn(item) {
    const kind = item.spot.startsWith("wall") && item.spot.length === 5 ? "wall" : item.spot;
    return BUILD[kind](item.params, this.ticks);
  }

  /** Pone en el cuarto todas las piezas del `layout` (ver houseLayout en house-data.js). */
  setLayout(layout) {
    if (!this.ready) return;
    this.layoutData = layout;
    for (const { group } of this.furn.values()) { this.scene.remove(group); group.traverse((o) => { o.geometry?.dispose?.(); }); }
    this.furn.clear();
    for (const d of layout) this._addFurn(d);
  }

  _addFurn(d) {
    const item = getHouseItem(d.id);
    if (!item) return;
    const holder = new THREE.Group();
    const inner = this._buildFurn(item);
    holder.add(inner);
    holder.userData.uid = d.uid;
    this.scene.add(holder);
    this.furn.set(d.uid, { group: holder, data: d, item });
    this.updateFurn(d);
  }

  /** Vuelve a ubicar una pieza según sus datos (posición, giro, tamaño). */
  updateFurn(d) {
    const f = this.furn.get(d.uid);
    if (!f) return;
    const g = f.group;
    const half = W / 2 - 0.5;
    if (d.wall) {
      const u = Math.max(-half, Math.min(half, d.u));
      const y = Math.max(1.4, Math.min(4.2, d.y));
      d.u = u; d.y = y;
      if (d.wall === "back") { g.position.set(u, y, -W / 2 + 0.1); g.rotation.y = 0; }
      else { g.position.set(-W / 2 + 0.1, y, u); g.rotation.y = Math.PI / 2; }
    } else {
      d.x = Math.max(-half, Math.min(half, d.x));
      d.z = Math.max(-half, Math.min(half, d.z));
      g.position.set(d.x, 0, d.z);
      g.rotation.y = d.rot || 0;
    }
    g.scale.setScalar(d.s || 1);
  }

  removeFurn(uid) {
    const f = this.furn.get(uid);
    if (!f) return;
    this.scene.remove(f.group);
    f.group.traverse((o) => { o.geometry?.dispose?.(); });
    this.furn.delete(uid);
    if (this.sel === uid) this.setSelected(null);
  }

  addFurn(d) { this._addFurn(d); }

  _ray(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    return ray;
  }

  /** ¿Qué pieza hay bajo el dedo? (devuelve su uid o null) */
  pick(clientX, clientY) {
    if (!this.ready) return null;
    const hit = this._ray(clientX, clientY).intersectObjects([...this.furn.values()].map((f) => f.group), true)[0];
    if (!hit) return null;
    let o = hit.object;
    while (o && !o.userData.uid) o = o.parent;
    return o ? o.userData.uid : null;
  }

  /** Punto del piso bajo el dedo: { x, z } o null si apunta fuera. */
  floorPoint(clientX, clientY) {
    const p = new THREE.Vector3();
    const ok = this._ray(clientX, clientY).ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p);
    return ok ? { x: p.x, z: p.z } : null;
  }

  /** Punto de pared bajo el dedo: { wall, u, y } (la más cercana de las dos paredes visibles). */
  wallPoint(clientX, clientY) {
    const ray = this._ray(clientX, clientY).ray;
    const back = new THREE.Vector3();
    const left = new THREE.Vector3();
    const okB = ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), W / 2), back);
    const okL = ray.intersectPlane(new THREE.Plane(new THREE.Vector3(1, 0, 0), W / 2), left);
    const inB = okB && Math.abs(back.x) <= W / 2 && back.y >= 0 && back.y <= H;
    const inL = okL && Math.abs(left.z) <= W / 2 && left.y >= 0 && left.y <= H;
    if (inB && (!inL || back.y >= 0)) return { wall: "back", u: back.x, y: back.y };
    if (inL) return { wall: "left", u: left.z, y: left.y };
    return null;
  }

  /** Marca una pieza (aro dorado en el piso); `null` quita la marca. */
  setSelected(uid) {
    this.sel = uid;
    if (!this.selRing) {
      this.selRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.05, 40), new THREE.MeshBasicMaterial({ color: 0xffc800, side: THREE.DoubleSide, transparent: true, opacity: 0.95, depthTest: false }));
      this.selRing.rotation.x = -Math.PI / 2;
      this.selRing.renderOrder = 10;
      this.scene.add(this.selRing);
    }
    this.selRing.visible = !!uid && this.furn.has(uid);
  }

  _syncSelRing() {
    if (!this.selRing || !this.sel) return;
    const f = this.furn.get(this.sel);
    if (!f) { this.selRing.visible = false; return; }
    const g = f.group;
    const box3 = new THREE.Box3().setFromObject(g);
    const sz = box3.getSize(new THREE.Vector3());
    const c = box3.getCenter(new THREE.Vector3());
    const r = Math.max(sz.x, sz.z) / 2 + 0.25;
    this.selRing.position.set(c.x, f.data.wall ? 0.05 : 0.06, c.z);
    this.selRing.scale.setScalar(r / 0.97 * (1 + Math.sin(this.time * 6) * 0.03));
    this.selRing.visible = !f.data.wall;
  }

  setActive(on) {
    if (!this.ready) return;
    if (on && !this.active) {
      this.active = true;
      this._last = null;
      requestAnimationFrame(this._loop);
    } else if (!on) this.active = false;
  }

  _loop(ts) {
    if (!this.active) return;
    if (this._last == null) this._last = ts;
    const dt = Math.min(0.05, (ts - this._last) / 1000);
    this._last = ts;
    this.time += dt;
    if (this.hero) {
      this.hero.animate(this.time, "idle", 1);
      this.hero.group.rotation.y = 0.5 + Math.sin(this.time * 0.6) * 0.3;
    }
    for (const f of this.ticks) f(this.time, dt);
    this._syncSelRing();
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this._loop);
  }
}

export { houseItemsOfSpot };
