// Escena 3D de "Mi Casa": un cuarto abierto por dos lados (se ve como una casita de muñecas)
// con tu Matichico y su mascota adentro. Lo que hay en cada lugar viene de
// js/house-data.js; aquí solo se dibuja. Es liviano y solo corre cuando la pantalla está visible.

import { THREE, canvasTexture, roundedBox, createRenderer, glAcquire, toonify, makeAmbient } from "./three-kit.js?v=6ffcfcb247";
import { createMatichico } from "./matichico3d.js?v=6ffcfcb247";
import { getOutfit } from "./wardrobe-data.js?v=6ffcfcb247";
import { getHouseItem, houseItemsOfSpot, isWallItem } from "./house-data.js?v=6ffcfcb247";

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
    } else if (p.kind === "flor") {
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; const pet = flat(new THREE.CircleGeometry(0.85, 24), std(i % 2 ? p.a : p.b, 0.95), 0.02 + (i % 2) * 0.004); pet.position.set(Math.cos(a) * 1.3, 0.02 + (i % 2) * 0.004, Math.sin(a) * 1.3); g.add(pet); }
      g.add(flat(new THREE.CircleGeometry(0.9, 28), std(0xffd34d, 0.9), 0.05));
    } else if (p.kind === "canchaB" || p.kind === "canchaF") {
      const basket = p.kind === "canchaB";
      const tex = canvasTexture(512, 300, (c, w, h) => {
        c.fillStyle = basket ? "#d98a3c" : "#4fb04a"; c.fillRect(0, 0, w, h);
        if (!basket) for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"; c.fillRect((i * w) / 8, 0, w / 8, h); }
        c.strokeStyle = "#ffffff"; c.lineWidth = 6;
        c.strokeRect(10, 10, w - 20, h - 20);
        c.beginPath(); c.moveTo(w / 2, 10); c.lineTo(w / 2, h - 10); c.stroke();
        c.beginPath(); c.arc(w / 2, h / 2, h * 0.2, 0, 6.3); c.stroke();
        if (basket) { c.strokeRect(10, h * 0.3, w * 0.18, h * 0.4); c.strokeRect(w - 10 - w * 0.18, h * 0.3, w * 0.18, h * 0.4); }
        else { c.strokeRect(10, h * 0.25, w * 0.16, h * 0.5); c.strokeRect(w - 10 - w * 0.16, h * 0.25, w * 0.16, h * 0.5); }
      });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 2.7), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
      m.rotation.x = -Math.PI / 2; m.position.y = 0.03; m.receiveShadow = true; g.add(m);
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
    } else if (p.kind === "princesa") { // cama con dosel
      g.add(rbox(2.6, 0.5, 3.6, 0.2, std(0xffd1e3, 0.7), 0, 0.45, 0), rbox(2.3, 0.3, 2.4, 0.15, std(0xffffff, 0.9), 0, 0.8, 0.35), rbox(2.3, 0.12, 0.7, 0.1, std(0xfff1a8, 0.8), 0, 0.98, -1.2));
      for (const [x, z] of [[-1.25, -1.7], [1.25, -1.7], [-1.25, 1.7], [1.25, 1.7]]) g.add(cyl(0.07, 0.07, 3.3, std(0xffc800, 0.3, { metalness: 0.6 }), x, 1.65, z, 8));
      const canopy = new THREE.Mesh(new THREE.ConeGeometry(2.1, 1.0, 4, 1, true), std(0xff9ec6, 0.8, { side: THREE.DoubleSide, transparent: true, opacity: 0.85 }));
      canopy.position.y = 3.65; canopy.rotation.y = Math.PI / 4; g.add(canopy);
      for (const sx of [-1, 1]) g.add(rbox(0.12, 2.6, 0.9, 0.05, std(0xffc2dc, 0.8, { transparent: true, opacity: 0.8 }), sx * 1.3, 1.9, 1.3));
      g.add(ball(0.18, std(0xffc800, 0.3, { metalness: 0.6 }), 0, 4.2, 0));
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
    } else if (p.kind === "banner") {
      g.add(cyl(0.05, 0.05, 3.4, std(0x8a5a36, 0.5), 0, 0.62, 0.1, 8).rotateZ(Math.PI / 2));
      const tex = canvasTexture(512, 200, (c, w, h) => {
        c.fillStyle = p.a; c.beginPath(); c.moveTo(0, 0); c.lineTo(w, 0); c.lineTo(w, h * 0.85); c.lineTo(w / 2, h); c.lineTo(0, h * 0.85); c.closePath(); c.fill();
        c.fillStyle = p.b; c.font = '110px "Baby Chipmunk", sans-serif'; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(p.text || "VAMOS!", w / 2, h * 0.45);
        c.strokeStyle = p.b; c.lineWidth = 6; c.strokeRect(12, 12, w - 24, h * 0.7);
      });
      const f = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.25), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }));
      f.position.set(0, -0.05, 0.12); g.add(f);
      ticks.push((t) => { f.rotation.x = Math.sin(t * 1.5) * 0.02; });
    } else if (p.kind === "aropared") {
      g.add(rbox(2.2, 1.5, 0.12, 0.05, std(0xffffff, 0.4), 0, 0.2, 0.06));
      g.add(box(0.8, 0.5, 0.02, std(0xe83a3a, 0.5), 0, 0.0, 0.13));
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.04, 8, 22), std(0xff6a1a, 0.4));
      hoop.rotation.x = Math.PI / 2; hoop.position.set(0, -0.2, 0.42); g.add(hoop);
      const net = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.18, 0.4, 10, 1, true), basic(0xffffff, { wireframe: true }));
      net.position.set(0, -0.42, 0.42); g.add(net);
    } else if (p.kind === "camiseta") {
      g.add(box(1.9, 2.3, 0.1, std(0xffc800, 0.3, { metalness: 0.6 }), 0, 0, 0));
      const tex = canvasTexture(256, 300, (c, w, h) => {
        c.fillStyle = "#fff6e6"; c.fillRect(0, 0, w, h);
        c.fillStyle = p.a; c.beginPath(); c.moveTo(70, 30); c.lineTo(110, 20); c.quadraticCurveTo(128, 50, 146, 20); c.lineTo(186, 30); c.lineTo(236, 80); c.lineTo(200, 110); c.lineTo(190, 95); c.lineTo(190, 270); c.lineTo(66, 270); c.lineTo(66, 95); c.lineTo(56, 110); c.lineTo(20, 80); c.closePath(); c.fill();
        c.fillStyle = "#ffffff"; c.font = '110px "Baby Chipmunk", sans-serif'; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("10", w / 2, 160);
      });
      const pic = new THREE.Mesh(new THREE.PlaneGeometry(1.65, 2.05), new THREE.MeshBasicMaterial({ map: tex }));
      pic.position.z = 0.06; g.add(pic);
    } else if (p.kind === "marcador") {
      g.add(rbox(3.2, 1.4, 0.2, 0.08, std(0x15151d, 0.3), 0, 0, 0));
      const tex = canvasTexture(512, 220, (c, w, h) => {
        c.fillStyle = "#0a0a12"; c.fillRect(0, 0, w, h);
        c.fillStyle = "#35f0ff"; c.font = '36px "Baby Chipmunk", sans-serif'; c.textAlign = "center"; c.fillText("LOCAL", w * 0.22, 46); c.fillText("VISITA", w * 0.78, 46);
        c.fillStyle = "#ffc800"; c.font = '120px "Baby Chipmunk", sans-serif'; c.fillText("12", w * 0.22, 160); c.fillText("10", w * 0.78, 160);
        c.fillStyle = "#ffffff"; c.font = '60px sans-serif'; c.fillText(":", w / 2, 140);
      });
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 1.2), new THREE.MeshBasicMaterial({ map: tex }));
      scr.position.z = 0.11; g.add(scr);
      const dots = [-1, 1].map((sx) => { const d = ball(0.07, basic(0xff3b3b), sx * 1.4, 0.55, 0.12); g.add(d); return d; });
      ticks.push((t) => dots.forEach((d, i) => d.material.color.setHex(Math.sin(t * 4 + i * 3) > 0 ? 0xff3b3b : 0x551111)));
    } else if (p.kind === "medallas") {
      g.add(box(3.0, 0.1, 0.2, std(0x8a5a36, 0.5), 0, 0.5, 0.1));
      [0xffc800, 0xcfd3dc, 0xc98a4b, 0xffc800, 0xff6fb0].forEach((c, i) => {
        const x = -1.2 + i * 0.6;
        g.add(box(0.1, 0.8, 0.02, std([0xd4216c, 0x2f6fd6, 0x4fd09a][i % 3], 0.6), x, 0.1, 0.18));
        const d = cyl(0.2, 0.2, 0.05, std(c, 0.25, { metalness: 0.7 }), x, -0.45, 0.2, 18).rotateX(Math.PI / 2); g.add(d);
      });
    } else if (p.kind === "pomponespared") {
      g.add(rbox(2.4, 0.3, 0.16, 0.06, std(0x8a5a36, 0.5), 0, -0.6, 0.08));
      for (const sx of [-1, 1]) {
        const m = std(sx > 0 ? 0xff6fb0 : 0xffc800, 0.9);
        for (let i = 0; i < 20; i++) { const a = i * 2.4; const y = Math.cos(i * 0.9); const r = Math.sqrt(Math.max(0, 1 - y * y)); g.add(ball(0.2, m, sx * 0.7 + Math.cos(a) * r * 0.4, 0.1 + y * 0.4, 0.25 + Math.sin(a) * r * 0.3)); }
      }
    } else if (p.kind === "mariposas") {
      const cols = [0xff6fb0, 0xb06bff, 0x6fd0ff, 0xffd34d, 0xff6fb0];
      cols.forEach((c, i) => {
        const b = new THREE.Group();
        for (const sx of [-1, 1]) { const w = new THREE.Mesh(new THREE.CircleGeometry(0.28, 14), basic(c, { side: THREE.DoubleSide })); w.scale.set(1, 1.2, 1); w.position.x = sx * 0.26; w.rotation.y = sx * 0.2; b.add(w); }
        b.add(box(0.05, 0.4, 0.02, basic(0x2a1810), 0, 0, 0.01));
        b.position.set(Math.sin(i * 2.3) * 1.2, Math.cos(i * 1.7) * 0.8, 0.1);
        b.rotation.z = Math.sin(i) * 0.5;
        g.add(b);
        ticks.push((t) => { b.scale.x = 0.7 + Math.abs(Math.sin(t * 2.2 + i * 1.3)) * 0.35; });
      });
    } else if (p.kind === "espejoCorazon") {
      const k = 1.0; const sh = new THREE.Shape();
      sh.moveTo(0, -k); sh.bezierCurveTo(-k * 1.7, -k * 0.2, -k * 1.2, k * 1.2, 0, k * 0.5); sh.bezierCurveTo(k * 1.2, k * 1.2, k * 1.7, -k * 0.2, 0, -k);
      const frame = new THREE.Mesh(new THREE.ShapeGeometry(sh), std(0xff7aa8, 0.4)); frame.position.z = 0.04; frame.scale.setScalar(1.12); g.add(frame);
      const mir = new THREE.Mesh(new THREE.ShapeGeometry(sh), std(0xd7ecff, 0.05, { metalness: 0.9 })); mir.position.z = 0.06; g.add(mir);
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
    } else if (p.kind === "heladera") {
      const body = std(p.a, 0.4);
      g.add(rbox(1.6, 3.1, 1.3, 0.14, body, 0, 1.55, 0));
      g.add(rbox(1.5, 1.0, 0.08, 0.04, std(0xdfe8f2, 0.5), 0, 2.55, 0.66), rbox(1.5, 1.75, 0.08, 0.04, std(0xdfe8f2, 0.5), 0, 1.0, 0.66));
      g.add(rbox(0.08, 0.55, 0.12, 0.03, std(0x9aa3b2, 0.3, { metalness: 0.7 }), 0.6, 2.5, 0.74), rbox(0.08, 0.9, 0.12, 0.03, std(0x9aa3b2, 0.3, { metalness: 0.7 }), 0.6, 1.35, 0.74));
      [[-0.35, 2.7, 0xff7aa8], [0.05, 2.35, 0xffd34d], [-0.2, 1.7, 0x35c8ff]].forEach(([x, y, c]) => g.add(rbox(0.28, 0.28, 0.06, 0.05, std(c, 0.5), x, y, 0.72)));
    } else if (p.kind === "cocina") {
      g.add(rbox(2.2, 1.5, 1.3, 0.1, std(p.a, 0.35, { metalness: 0.3 }), 0, 0.75, 0));
      g.add(rbox(2.3, 0.1, 1.4, 0.04, std(0x2a2a34, 0.4), 0, 1.52, 0));
      const glass = std(0x1a1a22, 0.2);
      g.add(rbox(1.5, 0.75, 0.06, 0.05, glass, 0, 0.62, 0.66));
      const fire = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.45), basic(0xff9a2a));
      fire.position.set(0, 0.6, 0.7); g.add(fire);
      g.add(rbox(1.5, 0.08, 0.08, 0.03, std(0xcfcfd4, 0.3, { metalness: 0.8 }), 0, 1.15, 0.72));
      for (const [x, z] of [[-0.55, -0.25], [0.55, -0.25], [-0.55, 0.3], [0.55, 0.3]]) g.add(cyl(0.3, 0.3, 0.05, std(0x111116, 0.4), x, 1.6, z, 20));
      for (let i = 0; i < 4; i++) g.add(ball(0.09, std(p.b, 0.4), -0.75 + i * 0.5, 1.2, 0.68));
      const pot = cyl(0.3, 0.27, 0.35, std(0xd4216c, 0.35, { metalness: 0.4 }), -0.55, 1.8, -0.25, 18);
      const lid = cyl(0.31, 0.31, 0.06, std(0xcfcfd4, 0.3, { metalness: 0.8 }), -0.55, 2.0, -0.25, 18);
      const steam = ball(0.14, std(0xffffff, 0.9, { transparent: true, opacity: 0.55 }), -0.55, 2.3, -0.25);
      g.add(pot, lid, steam);
      ticks.push((t) => { fire.material.color.setHSL(0.08 + Math.sin(t * 7) * 0.02, 1, 0.55); steam.position.y = 2.25 + ((t * 0.6) % 1) * 0.5; steam.material.opacity = 0.55 * (1 - ((t * 0.6) % 1)); });
    } else if (p.kind === "meson") {
      g.add(rbox(2.8, 1.45, 1.2, 0.08, std(p.a, 0.7), 0, 0.72, 0));
      g.add(rbox(2.9, 0.12, 1.3, 0.04, std(p.b, 0.6), 0, 1.5, 0));
      for (let i = 0; i < 3; i++) { g.add(rbox(0.8, 1.05, 0.05, 0.04, std(0xffffff, 0.6), -0.9 + i * 0.9, 0.7, 0.62)); g.add(ball(0.06, std(p.b, 0.3), -0.6 + i * 0.9, 0.9, 0.67)); }
      g.add(rbox(0.9, 0.06, 0.6, 0.04, std(0xb7bfcc, 0.25, { metalness: 0.8 }), -0.7, 1.57, 0.05));
      g.add(cyl(0.04, 0.04, 0.5, std(0xcfcfd4, 0.25, { metalness: 0.8 }), -0.7, 1.8, -0.35, 8));
      g.add(rbox(0.5, 0.2, 0.3, 0.05, std(0xff7aa8, 0.5), 0.8, 1.66, 0), cyl(0.2, 0.2, 0.25, std(0xe0b070, 0.7), 1.1, 1.7, 0.1, 14));
    } else if (p.kind === "comedor") {
      const wd = std(p.a, 0.6);
      g.add(rbox(2.6, 0.16, 1.6, 0.06, wd, 0, 1.15, 0));
      for (const [x, z] of [[-1.15, -0.65], [1.15, -0.65], [-1.15, 0.65], [1.15, 0.65]]) g.add(box(0.14, 1.1, 0.14, wd, x, 0.55, z));
      for (const z of [1.45, -1.45]) {
        const s = z > 0 ? 1 : -1;
        g.add(rbox(0.9, 0.14, 0.9, 0.05, std(p.b, 0.6), 0, 0.78, z), rbox(0.9, 0.95, 0.12, 0.05, std(p.b, 0.6), 0, 1.3, z + s * 0.42));
        for (const [x, dz] of [[-0.38, -0.38], [0.38, -0.38], [-0.38, 0.38], [0.38, 0.38]]) g.add(box(0.09, 0.78, 0.09, wd, x, 0.39, z + dz));
      }
      for (const x of [-0.7, 0.7]) { g.add(cyl(0.3, 0.3, 0.04, std(0xffffff, 0.4), x, 1.25, 0.1, 20), cyl(0.2, 0.2, 0.02, std(p.b, 0.5), x, 1.28, 0.1, 18)); }
      g.add(cyl(0.2, 0.28, 0.5, std(0xffd34d, 0.4), 0, 1.5, -0.2, 14), ball(0.2, std(0xff3b6b, 0.4), 0, 1.85, -0.2));
    } else if (p.kind === "tina") {
      g.add(rbox(3.0, 1.1, 1.7, 0.4, std(0xffffff, 0.3), 0, 0.55, 0));
      g.add(rbox(2.5, 0.06, 1.25, 0.3, std(0x9fdcff, 0.2, { transparent: true, opacity: 0.9 }), 0, 1.0, 0));
      for (let i = 0; i < 14; i++) { const a = i * 2.1; g.add(ball(0.17 + (i % 3) * 0.04, std(0xffffff, 0.9), Math.sin(a) * 0.95, 1.08 + (i % 2) * 0.08, Math.cos(a) * 0.45)); }
      g.add(cyl(0.05, 0.05, 0.55, std(0xcfcfd4, 0.25, { metalness: 0.8 }), 1.3, 1.35, -0.55, 8), box(0.35, 0.05, 0.05, std(0xcfcfd4, 0.25, { metalness: 0.8 }), 1.15, 1.62, -0.55));
      for (const sx of [-1.25, 1.25]) g.add(ball(0.15, std(0xffd34d, 0.4, { metalness: 0.6 }), sx, 0.05, 0.6));
      const bub = [];
      for (let i = 0; i < 4; i++) { const b = ball(0.1, std(0xffffff, 0.2, { transparent: true, opacity: 0.6 }), 0, 1.2, 0); g.add(b); bub.push({ b, t: i / 4 }); }
      ticks.push((t, dt) => { for (const o of bub) { o.t = (o.t + dt * 0.35) % 1; o.b.position.set(Math.sin(o.t * 9 + o.b.id) * 0.8, 1.15 + o.t * 1.1, Math.cos(o.t * 7 + o.b.id) * 0.3); o.b.material.opacity = 0.6 * (1 - o.t); } });
    } else if (p.kind === "lavabo") {
      g.add(cyl(0.3, 0.38, 1.1, std(0xffffff, 0.3), 0, 0.55, 0, 16), rbox(1.5, 0.35, 1.0, 0.2, std(0xffffff, 0.3), 0, 1.25, 0.05));
      g.add(rbox(1.0, 0.06, 0.6, 0.15, std(0x9fdcff, 0.2), 0, 1.4, 0.1));
      g.add(cyl(0.04, 0.04, 0.45, std(0xcfcfd4, 0.25, { metalness: 0.8 }), 0, 1.6, -0.3, 8), box(0.05, 0.05, 0.3, std(0xcfcfd4, 0.25, { metalness: 0.8 }), 0, 1.82, -0.18));
      const mir = rbox(1.3, 1.5, 0.08, 0.15, std(0xd7ecff, 0.08, { metalness: 0.9 }), 0, 2.7, -0.45);
      g.add(mir, rbox(1.45, 1.65, 0.05, 0.18, std(0xff7aa8, 0.5), 0, 2.7, -0.5));
    } else if (p.kind === "ropero") {
      g.add(rbox(2.3, 3.7, 1.1, 0.1, std(p.a, 0.6), 0, 1.85, 0));
      for (const sx of [-0.57, 0.57]) { g.add(rbox(1.05, 3.3, 0.06, 0.05, std(0xffffff, 0.55), sx, 1.85, 0.57)); g.add(ball(0.07, std(p.b, 0.3), sx * 0.2 * 1.0 + (sx > 0 ? 0.12 : -0.12), 1.85, 0.64)); }
      g.add(rbox(2.4, 0.14, 1.2, 0.05, std(p.b, 0.5), 0, 3.75, 0));
    } else if (p.kind === "tvmueble") {
      g.add(rbox(3.0, 0.9, 1.1, 0.08, std(p.a, 0.6), 0, 0.45, 0));
      for (let i = 0; i < 2; i++) g.add(rbox(1.3, 0.6, 0.05, 0.04, std(0xffe3b8, 0.6), -0.7 + i * 1.4, 0.45, 0.57));
      g.add(rbox(2.5, 1.5, 0.15, 0.06, std(0x15151d, 0.3), 0, 1.9, 0.0));
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.3), basic(0x35c8ff));
      scr.position.set(0, 1.9, 0.09); g.add(scr);
      g.add(cyl(0.1, 0.2, 0.4, std(0x15151d, 0.4), 0, 1.1, 0, 10));
      ticks.push((t) => { scr.material.color.setHSL((t * 0.12) % 1, 0.7, 0.55); });
    } else if (p.kind === "pompones") { // pompones gigantes sobre un soporte
      g.add(cyl(0.5, 0.6, 0.15, std(0xffffff, 0.5), 0, 0.08, 0, 20));
      for (const [sx, c] of [[-0.5, 0xff6fb0], [0.5, 0xffc800]]) {
        g.add(cyl(0.06, 0.07, 1.1, std(0xffffff, 0.5), sx, 0.7, 0, 8));
        const m = std(c, 0.9);
        for (let i = 0; i < 34; i++) { const a = i * 2.4; const y = Math.cos(i * 0.8); const r = Math.sqrt(Math.max(0, 1 - y * y)); g.add(ball(0.2, m, sx + Math.cos(a) * r * 0.5, 1.6 + y * 0.45, Math.sin(a) * r * 0.5)); }
      }
    } else if (p.kind === "colchoneta") {
      g.add(rbox(3.4, 0.28, 2.0, 0.1, std(0x2f6fd6, 0.8), 0, 0.14, 0));
      g.add(rbox(3.4, 0.05, 0.3, 0.02, std(0xffffff, 0.8), 0, 0.3, 0.6), rbox(3.4, 0.05, 0.3, 0.02, std(0xffffff, 0.8), 0, 0.3, -0.6));
      for (const sx of [-1.7, 1.7]) g.add(rbox(0.08, 0.2, 0.6, 0.03, std(0xff6fb0, 0.6), sx, 0.2, 0.8));
    } else if (p.kind === "barra") { // espejo con barra de ballet
      g.add(rbox(3.0, 3.0, 0.12, 0.06, std(0xd7ecff, 0.06, { metalness: 0.9 }), 0, 1.9, -0.1));
      g.add(rbox(3.2, 3.2, 0.08, 0.1, std(0xffc2dc, 0.5), 0, 1.9, -0.16));
      for (const sx of [-1.3, 1.3]) g.add(cyl(0.05, 0.06, 1.7, std(0xcfd3dc, 0.3, { metalness: 0.8 }), sx, 0.85, 0.5, 8));
      g.add(cyl(0.06, 0.06, 2.8, std(0xc98a4b, 0.5), 0, 1.7, 0.5, 10).rotateZ(Math.PI / 2));
    } else if (p.kind === "copa") {
      const k = p.big ? 1.5 : 1;
      const gold = std(p.silver ? 0xcfd3dc : 0xffc800, 0.2, { metalness: 0.85, emissive: p.silver ? 0x222222 : 0x6a4a00, emissiveIntensity: 0.5 });
      g.add(rbox(1.0 * k, 0.3 * k, 1.0 * k, 0.05, std(0x64321b, 0.5), 0, 0.15 * k, 0));
      g.add(cyl(0.12 * k, 0.2 * k, 0.9 * k, gold, 0, 0.75 * k, 0, 12));
      if (p.world) { g.add(ball(0.45 * k, gold, 0, 1.55 * k, 0)); for (const sx of [-1, 1]) g.add(cyl(0.1 * k, 0.16 * k, 0.8 * k, gold, sx * 0.3 * k, 1.0 * k, 0, 8)); }
      else {
        g.add(cyl(0.5 * k, 0.2 * k, 0.8 * k, gold, 0, 1.55 * k, 0, 18));
        for (const sx of [-1, 1]) { const h = new THREE.Mesh(new THREE.TorusGeometry(0.26 * k, 0.05 * k, 6, 14), gold); h.position.set(sx * 0.58 * k, 1.6 * k, 0); g.add(h); }
        const st = new THREE.Mesh(new THREE.OctahedronGeometry(0.16 * k), basic(0xffffff)); st.position.set(0, 1.55 * k, 0.45 * k); g.add(st);
        ticks.push((t) => { st.rotation.y = t * 2; });
      }
    } else if (p.kind === "aro") { // aro de básquet con soporte
      const metal = std(0x9aa3b2, 0.3, { metalness: 0.7 });
      g.add(cyl(0.7, 0.8, 0.2, std(0x2a2a34, 0.7), 0, 0.1, 0, 14), cyl(0.07, 0.07, 3.6, metal, 0, 1.9, -0.1, 8));
      g.add(rbox(2.0, 1.4, 0.12, 0.05, std(0xffffff, 0.4), 0, 3.4, 0.1), box(0.8, 0.5, 0.02, std(0xe83a3a, 0.5), 0, 3.2, 0.18));
      g.add(box(0.12, 0.12, 0.8, metal, 0, 2.95, 0.4));
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.045, 8, 22), std(0xff6a1a, 0.4)); hoop.rotation.x = Math.PI / 2; hoop.position.set(0, 2.95, 0.75); g.add(hoop);
      const net = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.2, 0.5, 10, 1, true), basic(0xffffff, { wireframe: true })); net.position.set(0, 2.68, 0.75); g.add(net);
    } else if (p.kind === "cestoBalones") {
      g.add(cyl(0.7, 0.55, 0.9, std(0x9aa3b2, 0.3, { metalness: 0.6, transparent: true, opacity: 0.55 }), 0, 0.45, 0, 16));
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.04, 6, 20), std(0x9aa3b2, 0.3, { metalness: 0.7 }));
      rim.rotation.x = Math.PI / 2; rim.position.y = 0.9; g.add(rim);
      [[-0.25, 0.85, 0.1, 0xff8a2a], [0.25, 0.9, -0.1, 0xffffff], [0, 1.1, 0.15, 0xff8a2a], [0.1, 0.85, 0.3, 0x4fd09a], [-0.15, 1.0, -0.25, 0xffffff]].forEach(([x, y, z, c]) => g.add(ball(0.28, std(c, 0.6), x, y, z)));
    } else if (p.kind === "banca") {
      g.add(rbox(3.0, 0.2, 0.9, 0.06, std(p.a || 0xc98a4b, 0.6), 0, 0.85, 0), rbox(3.0, 0.9, 0.12, 0.05, std(p.b || 0xe83a3a, 0.6), 0, 1.4, -0.4));
      for (const sx of [-1.3, 1.3]) g.add(box(0.14, 0.85, 0.8, std(0x5a3a22, 0.6), sx, 0.42, 0));
    } else if (p.kind === "arco") { // arco de fútbol
      const white = std(0xffffff, 0.4);
      for (const sx of [-1.4, 1.4]) { g.add(cyl(0.06, 0.06, 1.9, white, sx, 0.95, 0, 8)); g.add(cyl(0.04, 0.04, 1.2, white, sx, 0.05, -0.6, 6).rotateX(Math.PI / 2)); }
      g.add(cyl(0.06, 0.06, 2.9, white, 0, 1.9, 0, 8).rotateZ(Math.PI / 2));
      const net = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.9, 14, 9), basic(0xffffff, { wireframe: true, transparent: true, opacity: 0.55 }));
      net.position.set(0, 0.95, -1.2); g.add(net);
      for (const sx of [-1.4, 1.4]) { const side = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.9, 6, 9), basic(0xffffff, { wireframe: true, transparent: true, opacity: 0.4 })); side.rotation.y = Math.PI / 2; side.position.set(sx, 0.95, -0.6); g.add(side); }
      g.add(ball(0.3, std(0xffffff, 0.5), 0.5, 0.3, 1.0));
    } else if (p.kind === "futbolin") {
      g.add(rbox(3.2, 0.9, 1.9, 0.1, std(0x8a4b2c, 0.6), 0, 0.5, 0));
      g.add(box(2.9, 0.06, 1.6, std(0x4fb04a, 0.8), 0, 1.0, 0));
      for (const [i, x] of [-1.1, -0.35, 0.35, 1.1].entries()) {
        g.add(cyl(0.035, 0.035, 2.4, std(0xcfd3dc, 0.3, { metalness: 0.8 }), x, 1.3, 0, 6).rotateX(Math.PI / 2));
        for (const z of [-0.4, 0.4]) g.add(rbox(0.16, 0.34, 0.1, 0.03, std(i % 2 ? 0xe83a3a : 0x2f6fd6, 0.5), x, 1.2, z));
        g.add(ball(0.1, std(0x1c1c22, 0.5), x, 1.3, 1.25));
      }
      for (const [x, z] of [[-1.5, -0.85], [1.5, -0.85], [-1.5, 0.85], [1.5, 0.85]]) g.add(box(0.2, 0.5, 0.2, std(0x5a3a22, 0.6), x, 0.1, z));
      g.add(ball(0.09, basic(0xffffff), 0.2, 1.1, 0.1));
    } else if (p.kind === "telescopio") {
      const metal = std(0x9aa3b2, 0.3, { metalness: 0.7 });
      for (const a of [0, 2.1, 4.2]) { const leg = cyl(0.04, 0.05, 1.7, metal, Math.sin(a) * 0.35, 0.8, Math.cos(a) * 0.35, 6); leg.rotation.z = -Math.sin(a) * 0.25; leg.rotation.x = Math.cos(a) * 0.25; g.add(leg); }
      const tube = cyl(0.2, 0.28, 1.8, std(0xd4216c, 0.4), 0, 1.9, 0, 16); tube.rotation.x = -0.9; g.add(tube);
      const lens = cyl(0.25, 0.25, 0.05, std(0x9fdcff, 0.1, { metalness: 0.5 }), 0, 2.45, 0.7, 16); lens.rotation.x = -0.9; g.add(lens);
    } else if (p.kind === "acuario") {
      g.add(rbox(3.0, 0.5, 1.4, 0.06, std(0x8a4b2c, 0.6), 0, 0.25, 0));
      g.add(rbox(2.8, 1.5, 1.2, 0.04, std(0x6fd0ff, 0.1, { transparent: true, opacity: 0.4 }), 0, 1.25, 0));
      g.add(rbox(2.8, 0.2, 1.2, 0.05, std(0xf0d9a0, 0.9), 0, 0.6, 0));
      for (const x of [-1, 0.2, 1.1]) { const pl = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.8, 5), std(0x3fa24a, 0.7)); pl.position.set(x, 1.0, -0.3); g.add(pl); }
      const fish = [0xff8a2a, 0xffd34d, 0xff6fb0].map((c, i) => { const f = new THREE.Group(); f.add(ball(0.13, std(c, 0.4)), (() => { const t = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.18, 4), std(c, 0.4)); t.rotation.z = Math.PI / 2; t.position.x = -0.18; return t; })()); g.add(f); return f; });
      ticks.push((t) => fish.forEach((f, i) => { const a = t * (0.6 + i * 0.15) + i * 2; f.position.set(Math.cos(a) * 1.0, 1.2 + Math.sin(a * 1.7) * 0.3, Math.sin(a) * 0.3); f.rotation.y = -a + Math.PI; }));
    } else if (p.kind === "caballete") {
      const wd = std(0xc98a4b, 0.6);
      for (const [x, z, r] of [[-0.5, 0.3, 0.25], [0.5, 0.3, -0.25], [0, -0.4, 0]]) { const l = box(0.08, 2.4, 0.08, wd, x, 1.2, z); l.rotation.z = r; g.add(l); }
      g.add(box(1.5, 0.08, 0.5, wd, 0, 0.9, 0.35));
      const tex = canvasTexture(256, 200, (c, w, h) => { c.fillStyle = "#fff6e6"; c.fillRect(0, 0, w, h); c.fillStyle = "#ff6fb0"; c.beginPath(); c.arc(w * 0.3, h * 0.45, 40, 0, 6.3); c.fill(); c.fillStyle = "#6fd0ff"; c.fillRect(w * 0.5, h * 0.2, 80, 100); c.fillStyle = "#ffd34d"; c.beginPath(); c.arc(w * 0.78, h * 0.25, 28, 0, 6.3); c.fill(); });
      const cv = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.0), new THREE.MeshBasicMaterial({ map: tex })); cv.position.set(0, 1.7, 0.4); cv.rotation.x = -0.12; g.add(cv);
    } else if (p.kind === "escenario") {
      g.add(rbox(4.2, 0.4, 3.0, 0.08, std(0x2a1a4a, 0.6), 0, 0.2, 0), rbox(4.2, 0.06, 0.2, 0.02, std(0xff3fa4, 0.4, { emissive: 0xff3fa4, emissiveIntensity: 0.6 }), 0, 0.4, 1.45));
      const back = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.4), new THREE.MeshBasicMaterial({ map: wallTexture({ style: "estrellas", a: "#1c1a4a", b: "#ffd34d" }) })); back.position.set(0, 1.6, -1.45); g.add(back);
      g.add(cyl(0.03, 0.03, 1.6, std(0x9aa3b2, 0.3, { metalness: 0.8 }), 0.4, 1.2, 0.5, 6), ball(0.1, std(0x1c1c22, 0.4), 0.4, 2.05, 0.5));
      const lights = [-1.6, 1.6].map((x) => { const c = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.5, 12, 1, true), std(0xffe14a, 0.4, { emissive: 0xffe14a, emissiveIntensity: 0.6, side: THREE.DoubleSide })); c.position.set(x, 2.6, 0.5); c.rotation.x = Math.PI; g.add(c); return c; });
      ticks.push((t) => lights.forEach((l, i) => { l.material.emissiveIntensity = 0.4 + Math.abs(Math.sin(t * 3 + i * 2)) * 0.6; }));
    } else if (p.kind === "tobogan") {
      const red = std(0xe83a3a, 0.5);
      g.add(rbox(1.2, 0.2, 1.2, 0.05, std(0xffc800, 0.5), 0, 2.0, -0.8));
      for (const [x, z] of [[-0.5, -1.3], [0.5, -1.3], [-0.5, -0.3], [0.5, -0.3]]) g.add(box(0.1, 2.0, 0.1, std(0x2f6fd6, 0.5), x, 1.0, z));
      for (let i = 0; i < 5; i++) g.add(box(1.0, 0.07, 0.12, std(0x5a3a22, 0.6), 0, 0.4 + i * 0.35, -1.6 + i * 0.03));
      const slide = rbox(0.9, 0.1, 3.0, 0.04, red, 0, 1.05, 0.9); slide.rotation.x = 0.62; g.add(slide);
      for (const sx of [-0.5, 0.5]) { const rail = rbox(0.08, 0.2, 3.0, 0.03, std(0xffc800, 0.5), sx, 1.15, 0.9); rail.rotation.x = 0.62; g.add(rail); }
    } else if (p.kind === "piscina") {
      g.add(cyl(1.7, 1.7, 0.6, std(0xff6fb0, 0.5), 0, 0.3, 0, 32), cyl(1.5, 1.5, 0.62, std(0x6fd0ff, 0.2, { transparent: true, opacity: 0.85 }), 0, 0.31, 0, 32));
      const duck = new THREE.Group(); duck.add(ball(0.22, std(0xffd83a, 0.5)), ball(0.14, std(0xffd83a, 0.5), 0.12, 0.2, 0), (() => { const b = box(0.1, 0.04, 0.08, std(0xff8a2a, 0.5), 0.26, 0.2, 0); return b; })());
      g.add(duck);
      ticks.push((t) => { duck.position.set(Math.cos(t * 0.8) * 0.8, 0.7 + Math.sin(t * 2) * 0.03, Math.sin(t * 0.8) * 0.8); duck.rotation.y = -t * 0.8; });
    } else if (p.kind === "munecas") { // casa de muñecas
      g.add(rbox(2.4, 1.6, 1.3, 0.08, std(0xffc2dc, 0.7), 0, 0.8, 0));
      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.75, 1.0, 4), std(0xe83a6a, 0.6)); roof.position.y = 2.1; roof.rotation.y = Math.PI / 4; roof.scale.z = 0.8; g.add(roof);
      for (const x of [-0.65, 0.65]) g.add(box(0.5, 0.5, 0.04, basic(0xfff1a8), x, 1.15, 0.67), box(0.5, 0.04, 0.05, std(0xffffff), x, 1.15, 0.68), box(0.04, 0.5, 0.05, std(0xffffff), x, 1.15, 0.68));
      g.add(rbox(0.55, 0.9, 0.05, 0.05, std(0xb06bff, 0.5), 0, 0.45, 0.67), ball(0.04, std(0xffc800, 0.3), 0.15, 0.45, 0.72));
      g.add(cyl(0.12, 0.12, 0.6, std(0xb06bff, 0.6), 0.9, 2.2, -0.2, 10));
    } else if (p.kind === "tocador") {
      g.add(rbox(2.2, 0.15, 0.9, 0.05, std(0xffffff, 0.5), 0, 1.0, 0), rbox(2.0, 0.9, 0.8, 0.05, std(0xffd1e3, 0.6), 0, 0.5, 0));
      for (const sx of [-0.5, 0.5]) g.add(rbox(0.8, 0.3, 0.04, 0.03, std(0xffffff, 0.5), sx, 0.55, 0.42), ball(0.05, std(0xffc800, 0.3), sx, 0.55, 0.46));
      const mirror = new THREE.Mesh(new THREE.CircleGeometry(0.75, 28), std(0xd7ecff, 0.05, { metalness: 0.9 })); mirror.position.set(0, 2.2, -0.35); mirror.scale.set(0.85, 1.1, 1); g.add(mirror);
      const frame = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.07, 8, 28), std(0xff7aa8, 0.4)); frame.position.set(0, 2.2, -0.34); frame.scale.set(0.85, 1.1, 1); g.add(frame);
      [[-0.6, 0xff6fb0], [-0.35, 0xb06bff], [0.55, 0x6fd0ff]].forEach(([x, c]) => g.add(cyl(0.07, 0.09, 0.28, std(c, 0.3), x, 1.2, 0.1, 10)));
      g.add(cyl(0.4, 0.4, 0.15, std(0xff7aa8, 0.7), 0, 0.78, 1.0, 16), cyl(0.07, 0.07, 0.5, std(0xffffff, 0.6), 0, 0.5, 1.0, 8));
    } else if (p.kind === "mesaTe") {
      const wd = std(0xffffff, 0.5);
      g.add(cyl(0.9, 0.9, 0.1, wd, 0, 0.78, 0, 24), cyl(0.12, 0.2, 0.75, wd, 0, 0.4, 0, 10));
      for (const x of [-1.25, 1.25]) { g.add(rbox(0.6, 0.12, 0.6, 0.05, std(0xff7aa8, 0.6), x, 0.5, 0), rbox(0.6, 0.6, 0.1, 0.05, std(0xff7aa8, 0.6), x + Math.sign(x) * 0.25, 0.85, 0)); for (const [dx, dz] of [[-0.22, -0.22], [0.22, 0.22], [-0.22, 0.22], [0.22, -0.22]]) g.add(box(0.06, 0.45, 0.06, wd, x + dx, 0.22, dz)); }
      g.add(ball(0.2, std(0xb06bff, 0.4), 0, 1.03, 0), cyl(0.04, 0.06, 0.2, std(0xb06bff, 0.4), 0.2, 1.05, 0, 8).rotateZ(-0.9), ball(0.05, std(0xffd34d, 0.4), 0, 1.25, 0));
      for (const [x, z] of [[-0.55, 0.15], [0.5, 0.3], [0.1, -0.5]]) g.add(cyl(0.1, 0.07, 0.09, std(0xffffff, 0.3), x, 0.88, z, 12));
      g.add(cyl(0.2, 0.2, 0.04, std(0xffffff, 0.3), 0.55, 0.85, -0.3, 14), ball(0.07, std(0xff3b6b, 0.5), 0.55, 0.92, -0.3));
    } else if (p.kind === "caballito") {
      const arcm = std(0xc98a4b, 0.6);
      for (const sz of [-0.25, 0.25]) { const a = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.07, 6, 20, Math.PI), arcm); a.rotation.z = Math.PI; a.position.set(0, 1.0, sz); a.rotation.y = Math.PI / 2; g.add(a); }
      const horse = new THREE.Group();
      const white = std(0xffffff, 0.7);
      horse.add(rbox(1.5, 0.7, 0.55, 0.25, white, 0, 1.3, 0));
      const neck = rbox(0.4, 0.9, 0.4, 0.15, white, 0.65, 1.7, 0); neck.rotation.z = -0.4; horse.add(neck);
      horse.add(rbox(0.65, 0.4, 0.4, 0.15, white, 1.0, 2.05, 0), rbox(0.4, 0.15, 0.6, 0.05, std(0xe83a6a, 0.6), 0, 1.65, 0));
      for (const [x, c] of [[0.8, 0xff6fb0], [0.55, 0xb06bff], [0.3, 0x6fd0ff]]) horse.add(ball(0.17, std(c, 0.6), x - 0.35, 2.1 - (x - 0.55) * 0.2, 0));
      horse.add(cyl(0.05, 0.05, 1.1, white, 0.5, 0.9, 0.0, 6), cyl(0.05, 0.05, 1.1, white, -0.5, 0.9, 0.0, 6));
      horse.add(ball(0.06, basic(0x1c1c22), 1.15, 2.12, 0.2), ball(0.06, basic(0x1c1c22), 1.15, 2.12, -0.2));
      g.add(horse);
      ticks.push((t) => { horse.rotation.z = Math.sin(t * 2) * 0.07; });
    } else if (p.kind === "castillo") {
      const k = p.big ? 1.4 : 1;
      const wall2 = std(0xffc2dc, 0.7), roof2 = std(0xb06bff, 0.6);
      g.add(rbox(2.6 * k, 1.3 * k, 1.3 * k, 0.05, wall2, 0, 0.65 * k, 0));
      for (const sx of [-1.4, 1.4]) { g.add(cyl(0.38 * k, 0.4 * k, 2.0 * k, wall2, sx * k, 1.0 * k, 0, 14)); const c = new THREE.Mesh(new THREE.ConeGeometry(0.5 * k, 0.9 * k, 14), roof2); c.position.set(sx * k, 2.45 * k, 0); g.add(c); }
      const mid = new THREE.Mesh(new THREE.ConeGeometry(0.5 * k, 1.0 * k, 14), std(0xe83a6a, 0.6)); mid.position.set(0, 1.8 * k, 0); g.add(cyl(0.4 * k, 0.4 * k, 1.0 * k, wall2, 0, 1.4 * k, 0, 14), mid);
      g.add(rbox(0.6 * k, 0.9 * k, 0.06, 0.05, std(0x8a4b2c, 0.6), 0, 0.45 * k, 0.68 * k));
      for (const x of [-0.9, 0.9]) g.add(box(0.2 * k, 0.28 * k, 0.04, basic(0xfff1a8), x * k, 1.0 * k, 0.67 * k));
      const flag = box(0.4 * k, 0.22 * k, 0.02, basic(0xff3b6b), 0.2 * k, 3.1 * k, 0); g.add(cyl(0.015, 0.015, 0.7 * k, std(0xffffff), 0, 2.95 * k, 0, 4), flag);
      ticks.push((t) => { flag.rotation.y = Math.sin(t * 4) * 0.3; });
    } else if (p.kind === "cuentos") {
      g.add(rbox(2.4, 3.3, 0.8, 0.06, std(0xffffff, 0.6), 0, 1.65, 0));
      for (let r = 0; r < 4; r++) {
        g.add(box(2.2, 0.05, 0.7, std(0xffc2dc, 0.6), 0, 0.2 + r * 0.8, 0.05));
        let x = -1.0; const cols = [0xff6fb0, 0xb06bff, 0x6fd0ff, 0xffd34d, 0x4fd09a];
        for (let i = 0; i < 6; i++) { const w = 0.18 + ((i * 7 + r * 3) % 4) * 0.04; g.add(box(w, 0.55 + ((i + r) % 3) * 0.05, 0.5, std(cols[(i + r) % 5], 0.7), x + w / 2, 0.5 + r * 0.8, 0.1)); x += w + 0.04; }
      }
      const st = new THREE.Mesh(new THREE.OctahedronGeometry(0.2), basic(0xffe14a)); st.position.set(0, 3.55, 0); g.add(st);
      ticks.push((t) => { st.rotation.y = t * 2; });
    } else if (p.kind === "lamparaUnicornio") {
      g.add(cyl(0.45, 0.55, 0.15, std(0xffffff, 0.5), 0, 0.08, 0, 20), cyl(0.07, 0.07, 1.1, std(0xffffff, 0.5), 0, 0.65, 0, 8));
      const head = ball(0.42, std(0xfff1f8, 0.5, { emissive: 0xffc2e8, emissiveIntensity: 0.55 }), 0, 1.5, 0); g.add(head);
      g.add(new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.4, 8), std(0xffe08a, 0.3, { metalness: 0.5 }))).children[g.children.length - 1].position.set(0, 2.05, 0.1);
      for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 6), std(0xfff1f8, 0.5)); e.position.set(sx * 0.2, 1.85, 0); g.add(e); }
      ["#ff6fb0", "#6fd0ff", "#b06bff", "#ffd34d"].forEach((c, i) => g.add(ball(0.12, std(c, 0.5), -0.38, 1.7 - i * 0.18, -0.1)));
      g.add(ball(0.05, basic(0x2a1810), -0.16, 1.55, 0.37), ball(0.05, basic(0x2a1810), 0.16, 1.55, 0.37));
      ticks.push((t) => { head.material.emissiveIntensity = 0.45 + Math.sin(t * 2) * 0.15; });
    } else if (p.kind === "carruaje") {
      g.add(ball(1.0, std(0xffa0d0, 0.4), 0, 1.5, 0)).children[g.children.length - 1].scale.set(1.2, 1, 0.9);
      const roof3 = new THREE.Mesh(new THREE.ConeGeometry(0.7, 0.8, 12), std(0xffc800, 0.3, { metalness: 0.6 })); roof3.position.y = 2.7; g.add(roof3);
      const wheels = [];
      for (const [x, z, r] of [[-0.9, 0.9, 0.5], [0.9, 0.9, 0.5], [-0.9, -0.9, 0.5], [0.9, -0.9, 0.5]]) { const w = new THREE.Mesh(new THREE.TorusGeometry(r, 0.07, 6, 18), std(0xffc800, 0.3, { metalness: 0.6 })); w.position.set(x, 0.55, z); w.rotation.y = Math.PI / 2; g.add(w); wheels.push(w); }
      g.add(rbox(1.0, 0.7, 0.04, 0.05, std(0xbfeaff, 0.1, { metalness: 0.5 }), 0, 1.6, 0.92));
      ticks.push((t) => wheels.forEach((w) => { w.rotation.x = t * 0.5; }));
    } else if (p.kind === "mesacentro") {
      g.add(cyl(0.95, 0.95, 0.1, std(p.a, 0.5), 0, 0.62, 0, 28), cyl(0.15, 0.25, 0.55, std(p.a, 0.6), 0, 0.3, 0, 12), cyl(0.55, 0.6, 0.06, std(p.a, 0.6), 0, 0.03, 0, 20));
      g.add(cyl(0.16, 0.12, 0.2, std(0xffffff, 0.4), -0.35, 0.78, 0.1, 14), cyl(0.16, 0.12, 0.2, std(p.b, 0.4), 0.3, 0.78, -0.2, 14), ball(0.12, std(0xffd34d, 0.4), 0.1, 0.77, 0.4));
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
    } else if (p.kind === "movil") {
      g.add(cyl(0.02, 0.02, 1.2, std(0xffffff), 0, 4.6, 0, 6));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.03, 6, 24), std(0xffc800, 0.3, { metalness: 0.6 })); ring.rotation.x = Math.PI / 2; ring.position.y = 4.0; g.add(ring);
      [0xff6fb0, 0xb06bff, 0x6fd0ff, 0xffd34d, 0xff6fb0].forEach((c, i) => {
        const a = (i / 5) * Math.PI * 2; const b = new THREE.Group();
        b.add(cyl(0.005, 0.005, 0.7, std(0xffffff), 0, -0.35, 0, 4));
        for (const sx of [-1, 1]) { const w = ball(0.13, std(c, 0.5), sx * 0.1, -0.75, 0); w.scale.set(1, 1.2, 0.2); b.add(w); }
        b.position.set(Math.cos(a) * 0.8, 4.0, Math.sin(a) * 0.8); g.add(b);
        ticks.push((t) => { b.rotation.z = Math.sin(t * 1.2 + i) * 0.12; b.children[1].scale.x = 0.7 + Math.abs(Math.sin(t * 5 + i)) * 0.4; });
      });
    } else if (p.kind === "nubes") {
      [[-1.8, 4.1, 0], [0.2, 4.4, -0.4], [2.0, 4.0, 0.3]].forEach(([x, y, z], i) => {
        const c = new THREE.Group();
        for (const [dx, dy, r] of [[0, 0, 0.5], [-0.5, -0.05, 0.38], [0.5, -0.05, 0.4], [0.1, 0.25, 0.35]]) c.add(ball(r, std(0xffffff, 0.95), dx, dy, 0));
        c.position.set(x, y, z); g.add(c);
        ticks.push((t) => { c.position.y = y + Math.sin(t * 0.9 + i * 2) * 0.08; });
      });
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
    this.life = { state: "idle", t: 3, target: null, last: null, hx: 1.6, hz: 1.4, yaw: 0.5, blend: 0, stuck: 0 }; // el Matichico vive en la casa
    this.lifeOn = true;
  }

  init() {
    const canvas = this.canvas;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    this.renderer = createRenderer({ canvas, antialias: !coarse, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(20, 1, 0.1, 160); // lente "largo": se ve casi de frente y plano, como una casa de muñecas de lado
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
    this.ambient = makeAmbient(this.scene, { petals: 12, hearts: 8, stars: 30, radius: 7, height: 8 });
    this.ambientC = new THREE.Vector3(0, 0, 0);

    this._resize = () => {
      const w = Math.max(1, canvas.clientWidth);
      const h = Math.max(1, canvas.clientHeight);
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      // vista "de lado": se ve el cuarto completo y un pedacito de los vecinos
      const tv = Math.tan((this.camera.fov * Math.PI) / 360);
      const halfW = W / 2 + (this.neighbors && this.neighbors.length ? 2.7 : 0.9); // con vecinos se asoma un pedazo de ellos
      const halfH = (H + 2.6) / 2;
      this._camD = Math.max(halfH / tv, halfW / (tv * this.camera.aspect));
      this.camera.updateProjectionMatrix();
      this._placeCam();
    };
    this._camX = 0;
    new ResizeObserver(this._resize).observe(canvas);
    this._resize();
    this._loop = this._loop.bind(this);
    this.ready = true;
  }

  /**
   * Un cuarto visto "de lado", como una casa de muñecas abierta por el frente (estilo Avatar World): piso, pared del fondo,
   * paredes laterales (que separan un cuarto del vecino), techo y base. `floorMat`/`wallMat` son los materiales del piso y del fondo.
   */
  _shellGroup(w, floorMat, wallMat, castShadow = true) {
    const g = new THREE.Group();
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, w), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    const back = new THREE.Mesh(new THREE.PlaneGeometry(w, H), wallMat);
    back.position.set(0, H / 2, -w / 2);
    back.receiveShadow = true;
    const trim = std(0xffffff, 0.5);
    const frame = std(0xd4216c, 0.5);
    const t = 0.3;
    const parts = [
      box(w, 0.3, 0.2, trim, 0, 0.15, -w / 2 + 0.1), // zócalo
      box(w + 2 * t, 0.5, w + 0.3, std(0x8a5a36, 0.7), 0, -0.26, 0.05), // base de la casa
      box(t, H + 0.4, w, frame, -(w / 2 + t / 2), H / 2 + 0.2 - 0.05, 0), // paredes laterales
      box(t, H + 0.4, w, frame, w / 2 + t / 2, H / 2 + 0.2 - 0.05, 0),
      box(w + 2 * t, 0.45, 0.6, frame, 0, H + 0.22, -w / 2 + 0.3), // viga del techo (solo al fondo: así no tapa el cuarto)
    ];
    for (const m of parts.slice(2)) m.castShadow = false; // el marco no da sombra adentro
    if (!castShadow) for (const m of parts) m.castShadow = false;
    g.add(floor, back, ...parts);
    return { group: g, floor, back, parts };
  }

  _placeCam() {
    const d = this._camD || 20;
    const x = this._camX || 0;
    this.camera.position.set(x, 2.4 + d * 0.27, d * 0.96);
    this.camera.lookAt(x, 2.2, 0);
  }

  /** Arma (o rearma) el cuarto abierto para un tamaño `size` x `size`. */
  _buildShell(size) {
    if (this.shell) {
      this.scene.remove(this.shell);
      this.shell.traverse((o) => { o.geometry?.dispose?.(); });
    }
    this.size = size;
    W = size;
    const s = this._shellGroup(W, this.floor?.material || std(0xffffff, 0.7), this.back?.material || std(0xffffff, 0.9));
    this.floor = s.floor;
    this.back = s.back;
    this.shell = s.group;
    this.scene.add(this.shell);
    this._labelFor(this.roomName || "");
    // las texturas se repiten según el tamaño para que los dibujos no se estiren
    for (const m of [this.floor.material, this.back.material]) if (m.map) { m.map.wrapS = THREE.RepeatWrapping; }
    this._fitTextures();
    this.sun && Object.assign(this.sun.shadow.camera, { left: -W * 0.9, right: W * 0.9, top: W * 0.9, bottom: -W * 0.9 });
    this.sun && this.sun.shadow.camera.updateProjectionMatrix();
    this._resize && this._resize();
    if (this._nbData) this.setNeighbors(this._nbData);
  }

  _labelSprite(text) {
    const c = document.createElement("canvas");
    c.width = 512; c.height = 128;
    const x = c.getContext("2d");
    x.fillStyle = "rgba(74,36,64,0.9)";
    x.beginPath(); x.roundRect ? x.roundRect(6, 10, 500, 108, 40) : x.rect(6, 10, 500, 108); x.fill();
    x.strokeStyle = "#ffd0e6"; x.lineWidth = 6; x.stroke();
    x.font = "900 54px system-ui, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillStyle = "#fff6e6";
    x.fillText(text, 256, 66);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    sp.renderOrder = 11;
    sp.scale.set(4.2, 1.05, 1);
    return sp;
  }

  /** Cartel con el nombre del cuarto abierto. */
  _labelFor(text) {
    this.roomName = text;
    if (this.roomLabel) { this.scene.remove(this.roomLabel); this.roomLabel.material.map?.dispose(); this.roomLabel.material.dispose(); this.roomLabel = null; }
    if (!text || !this.shell) return;
    this.roomLabel = this._labelSprite(text);
    this.roomLabel.position.set(0, H + 1.15, 0);
    this.scene.add(this.roomLabel);
  }

  setRoomName(text) { this._labelFor(text); }

  // ---------- los otros cuartos de la casa, a los lados ----------

  /**
   * `list` = todos los cuartos de la casa en orden: { rid, size, name, active?, placed, layout }. El abierto (`active`) se dibuja con
   * Matichico y muebles que se pueden mover; los demás se ven quietos a los lados, cada uno con su propio tamaño.
   */
  setNeighbors(list) {
    this._nbData = list;
    for (const n of this.neighbors || []) {
      this.scene.remove(n.group);
      n.group.traverse((o) => { o.geometry?.dispose?.(); if (o.isSprite) { o.material.map?.dispose(); o.material.dispose(); } });
      n.mats.forEach((m) => { m.map?.dispose(); m.dispose(); });
    }
    this.neighbors = [];
    this.nTicks = [];
    const ai = Math.max(0, list.findIndex((r) => r.active));
    const wOf = (r) => (r.active ? W : r.size);
    // posición (en x) del centro de cada cuarto; el abierto está en 0 y cada cuarto ocupa su ancho más sus dos paredes (0.3 c/u)
    const xs = new Array(list.length).fill(0);
    for (let j = ai + 1; j < list.length; j++) xs[j] = xs[j - 1] + wOf(list[j - 1]) / 2 + 0.3 + 0.3 + wOf(list[j]) / 2;
    for (let j = ai - 1; j >= 0; j--) xs[j] = xs[j + 1] - wOf(list[j + 1]) / 2 - 0.3 - 0.3 - wOf(list[j]) / 2;
    this._roomX = Object.fromEntries(list.map((r, j) => [r.rid, xs[j]]));
    list.forEach((item, j) => {
      if (item.active) return;
      const w = item.size;
      const fl = getHouseItem((item.placed || {}).floor) || getHouseItem("fl_madera");
      const wl = getHouseItem((item.placed || {}).wall) || getHouseItem("wl_crema");
      const fm = std(0xffffff, 0.7);
      fm.map = floorTexture(fl.params);
      const wm = std(0xffffff, 0.9);
      wm.map = wallTexture(wl.params);
      for (const m of [fm, wm]) { m.map.wrapS = m.map.wrapT = THREE.RepeatWrapping; }
      fm.map.repeat.set(fm.map.repeat.x * (w / 10), fm.map.repeat.y * (w / 10));
      wm.map.repeat.set(wm.map.repeat.x * (w / 10), wm.map.repeat.y);
      const s = this._shellGroup(w, fm, wm, false);
      const g = s.group;
      g.position.set(xs[j], 0, (w - W) / 2); // las paredes del fondo quedan alineadas con la del cuarto abierto
      const half = w / 2 - 0.5;
      for (const d of item.layout || []) {
        const it = getHouseItem(d.id);
        if (!it) continue;
        const holder = new THREE.Group();
        holder.add(this._buildFurnQuiet(it));
        if (d.wall) {
          const u = Math.max(-half, Math.min(half, d.u || 0));
          holder.position.set(u, Math.max(1.4, Math.min(4.2, d.y || 2.8)), -w / 2 + 0.1);
        } else {
          holder.position.set(Math.max(-half, Math.min(half, d.x || 0)), 0, Math.max(-half, Math.min(half, d.z || 0)));
          holder.rotation.y = d.rot || 0;
        }
        holder.scale.setScalar(d.s || 1);
        g.add(holder);
      }
      const ceil = getHouseItem((item.placed || {}).ceiling);
      if (ceil && ceil.spot === "ceiling") g.add(BUILD.ceiling(ceil.params, this.nTicks));
      g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
      const label = this._labelSprite(item.name || "");
      label.position.set(0, H + 1.15, 0);
      g.add(label);
      g.userData.rid = item.rid;
      this.scene.add(g);
      this.neighbors.push({ group: g, rid: item.rid, mats: [fm, wm] });
    });
    this._toon();
    this._resize && this._resize();
  }

  _buildFurnQuiet(item) {
    const kind = isWallItem(item) ? "wall" : item.spot;
    return BUILD[kind](item.params, this.nTicks);
  }

  /** ¿Tocó un cuarto vecino? Devuelve su `rid` (o null). */
  pickRoom(clientX, clientY) {
    if (!this.ready || !this.neighbors || !this.neighbors.length) return null;
    const hit = this._ray(clientX, clientY).intersectObjects(this.neighbors.map((n) => n.group), true).find((h) => !h.object.isSprite);
    if (!hit) return null;
    let o = hit.object;
    while (o && !o.userData.rid) o = o.parent;
    return o ? o.userData.rid : null;
  }

  /** Desliza la cámara hasta el cuarto `rid`; al llegar avisa (para cambiar de cuarto). */
  slideTo(rid, done) {
    this._slide = { x: (this._roomX && this._roomX[rid]) || 0, done };
  }

  /** Vuelve la cámara al cuarto abierto de golpe (después de cambiar de cuarto). */
  snapCam() { this._slide = null; this._camX = 0; this._placeCam(); }

  /** Entra al cuarto por el lado `side` (+1 = llegó yendo hacia la derecha, entra por la izquierda) y camina hacia adentro. */
  enterRoom(side = 1) {
    const L = this.life;
    const edge = W / 2 - 0.95;
    L.hx = -side * edge; L.hz = 0.8; L.yaw = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    L.state = "idle"; L.target = null; L.cur = null; L.last = null; L.t = 0.4;
    if (this.hero) { this.hero.group.position.set(L.hx, 0, L.hz); this.hero.group.rotation.set(0, L.yaw, 0); }
    this.walkTo(-side * (edge - 2.2), 1.2);
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
    fit(this.back.material.map, k, 1);
  }

  /** Cambia el tamaño del cuarto (10, 14 o 18). */
  setSize(size) {
    if (!this.ready || size === this.size) return;
    this._buildShell(size);
  }

  /** Dibuja el Matichico (con su mascota) dentro del cuarto. */
  _toon() { toonify(this.scene); }

  setHero(character, look, key) {
    if (!this.ready) return;
    if (this.hero) this.scene.remove(this.hero.group);
    this.hero = createMatichico(character, getOutfit(look.outfit), look);
    this.hero.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.hero.group.scale.setScalar(1.7);
    this.hero.group.position.set(this.life.hx, 0, this.life.hz);
    this.hero.group.rotation.y = this.life.yaw;
    this.scene.add(this.hero.group);
    this.key = key;
    this.life.state = "idle";
    this.life.target = null;
    this.life.t = 2;
    this._toon();
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
      this.back.material.map?.dispose();
      this.back.material.map = wallTexture(wl.params);
      this.back.material.needsUpdate = true;
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
    this._toon();
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
    this._toon();
  }

  /** Vuelve a ubicar una pieza según sus datos (posición, giro, tamaño). */
  updateFurn(d) {
    const f = this.furn.get(d.uid);
    if (!f) return;
    const g = f.group;
    const half = W / 2 - 0.5;
    if (d.wall) {
      d.wall = "back"; // la casa se ve de lado: lo que estaba en la pared izquierda pasa a la del fondo
      const u = Math.max(-half, Math.min(half, d.u || 0));
      const y = Math.max(1.4, Math.min(4.2, d.y || 2.8));
      d.u = u; d.y = y;
      g.position.set(u, y, -W / 2 + 0.1);
      g.rotation.y = 0;
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

  /** Punto de la pared del fondo bajo el dedo: { wall, u, y }. */
  wallPoint(clientX, clientY) {
    const ray = this._ray(clientX, clientY).ray;
    const back = new THREE.Vector3();
    const ok = ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), W / 2), back);
    if (ok && Math.abs(back.x) <= W / 2 + 1 && back.y >= 0 && back.y <= H) return { wall: "back", u: back.x, y: back.y };
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


  // ---------- el Matichico vive en la casa ----------
  // Camina entre los muebles, esquiva lo que hay en el camino y usa lo que encuentra: se acuesta en la cama (¡y recupera
  // energía más rápido!), se sienta en sillones y sillas, escribe en el computador, juega a la arcade, toca el piano…

  /** Qué se puede hacer con un mueble (o null si es solo decoración). Las coordenadas son del mueble, sin girar. */
  _interactionOf(f) {
    const it = f.item;
    const k = it.params && it.params.kind;
    if (f.data.wall) {
      // la pantalla gigante de la pared también se puede mirar (de pie, frente a ella)
      if (k === "tv" && f.data.wall === "back") return { act: "watch", enter: [0, 0, 0], at: [0, 0, 0], face: Math.PI };
      return null;
    }
    if (it.spot === "bed") {
      const top = { simple: 0.95, nube: 1.1, cohete: 1.0, alfajor: 1.3 }[k] || 1.0;
      return { act: "sleep", enter: [1.9, 0, 0], at: [0.0, top + 0.3, 1.0], face: 0 };
    }
    if (k === "sofa") return { act: "sit", enter: [0, 0, 1.6], at: [0, 0.78, 0.15], face: 0 };
    if (k === "silla") return { act: "sit", enter: [0, 0, 1.2], at: [0, 0.88, 0.05], face: 0 };
    if (k === "escritorio") return { act: "type", enter: [-0.3, 0, 1.7], at: [-0.3, 0.64, 1.0], face: Math.PI };
    if (k === "arcade") return { act: "arcade", enter: [0, 0, 1.4], at: [0, 0, 1.2], face: Math.PI };
    if (k === "piano") return { act: "piano", enter: [0, 0, 2.8], at: [0, 0.78, 2.0], face: Math.PI };
    if (k === "trampolin") return { act: "hop", enter: [0, 0, 2.3], at: [0, 0.88, 0], face: 0 };
    if (k === "pelotero") return { act: "hop", enter: [0, 0, 2.2], at: [0, 0.35, 0], face: 0 };
    if (k === "heladera") return { act: "fridge", enter: [0, 0, 2.0], at: [0, 0, 2.0], face: Math.PI };
    if (k === "cocina") return { act: "cook", enter: [0, 0, 2.0], at: [0, 0, 1.9], face: Math.PI };
    if (k === "meson") return { act: "wash", enter: [0.7, 0, 1.9], at: [-0.7, 0, 1.9], face: Math.PI };
    if (k === "lavabo") return { act: "wash", enter: [0, 0, 1.8], at: [0, 0, 1.6], face: Math.PI };
    if (k === "comedor") return { act: "eat", enter: [0, 0, 2.9], at: [0, 0.88, 1.45], face: Math.PI };
    if (k === "tina") return { act: "bath", enter: [0, 0, 2.4], at: [0, 1.0, 0.1], face: 0 };
    if (k === "ropero") return { act: "wardrobe", enter: [0, 0, 2.0], at: [0, 0, 1.9], face: Math.PI };
    if (k === "tvmueble") return { act: "watch", enter: [0, 0, 3.6], at: [0, 0, 3.6], face: Math.PI };
    if (["planta", "estanteria", "oso", "tipi", "pastel", "cofre", "fuente", "flores", "cacao", "lampara", "mesa", "comoda", "mesacentro"].includes(k)) {
      return { act: "admire", enter: [0, 0, 1.9], at: [0, 0, 1.9], face: Math.PI };
    }
    return null;
  }

  _spots() {
    const out = [];
    for (const f of this.furn.values()) {
      const i = this._interactionOf(f);
      if (i) out.push({ f, i });
    }
    return out;
  }

  /** Punto del mundo para unas coordenadas del mueble. */
  _worldOf(f, xyz) {
    f.group.updateMatrixWorld(true);
    const inner = f.group.children[0];
    return inner.localToWorld(new THREE.Vector3(xyz[0], xyz[1], xyz[2]));
  }

  _yawOf(f, face) {
    const q = new THREE.Quaternion();
    f.group.children[0].getWorldQuaternion(q);
    const e = new THREE.Euler().setFromQuaternion(q, "YXZ");
    return e.y + face;
  }


  /** ¿Hay un mueble (de piso) tapando este punto? */
  _blockedPoint(x, z, skip) {
    for (const f of this.furn.values()) {
      if (f === skip || f.data.wall || f.item.spot === "rug") continue;
      const box = new THREE.Box3().setFromObject(f.group);
      if (box.max.y < 0.3) continue;
      if (x > box.min.x - 0.45 && x < box.max.x + 0.45 && z > box.min.z - 0.45 && z < box.max.z + 0.45) return true;
    }
    return false;
  }

  /**
   * Dónde se para el Matichico a mirar la tele: de frente a ella, a unos 2-3 pasos, siempre DENTRO de la pieza y en un lugar
   * libre (antes iba a un punto fijo que podía quedar fuera del cuarto o detrás de un sillón, y el Matichico se salía de la pieza).
   */
  _watchSpot(f) {
    const half = W / 2 - 0.9;
    f.group.updateMatrixWorld(true);
    const inner = f.group.children[0];
    const q = new THREE.Quaternion();
    inner.getWorldQuaternion(q);
    const dir = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    dir.y = 0;
    dir.normalize();
    const P = new THREE.Vector3();
    f.group.getWorldPosition(P);
    const perp = new THREE.Vector3(-dir.z, 0, dir.x);
    const clamp = (v) => Math.max(-half, Math.min(half, v));
    let best = null;
    for (const d of [3.2, 2.6, 3.8, 2.1, 1.7]) {
      for (const lat of [0, 0.9, -0.9, 1.7, -1.7, 2.6, -2.6]) {
        const x = clamp(P.x + dir.x * d + perp.x * lat);
        const z = clamp(P.z + dir.z * d + perp.z * lat);
        if (Math.hypot(x - P.x, z - P.z) < 1.5) continue; // no pegado a la tele
        if (this._blockedPoint(x, z, f)) continue;
        if (!best) best = { x, z };
        if (Math.hypot(x - (P.x + dir.x * d), z - (P.z + dir.z * d)) < 0.3) return { x, z }; // sin tener que correrse
      }
    }
    return best || { x: clamp(P.x + dir.x * 2.4), z: clamp(P.z + dir.z * 2.4) };
  }

  /** Ir a usar un mueble (por su uid). `force` = aunque esté haciendo otra cosa. */
  interact(uid, wake = true) {
    const f = this.furn.get(uid);
    if (!f || !this.hero) return false;
    const i = this._interactionOf(f);
    if (!i) return false;
    const L = this.life;
    if (L.state === "act" && wake) this._leaveAct(true);
    L.target = { uid, i, goalW: i.act === "watch" ? this._watchSpot(f) : null };
    L.state = "walk";
    L.stuck = 0;
    L.walkT = 0;
    this._clearSel?.();
    return true;
  }

  /** Ir a un punto del piso. */
  walkTo(x, z) {
    const L = this.life;
    if (!this.hero) return;
    if (L.state === "act") this._leaveAct(true);
    const half = W / 2 - 0.9;
    L.target = { uid: null, i: null, pt: { x: Math.max(-half, Math.min(half, x)), z: Math.max(-half, Math.min(half, z)) } };
    L.state = "walk";
    L.stuck = 0;
    L.walkT = 0;
  }

  /** Despierta o deja lo que hacía y se queda de pie. */
  wake() {
    if (this.life.state === "act" || this.life.state === "enter") this._leaveAct(true);
  }

  /** Para que el cuarto avise cuando el Matichico se acuesta/levanta (la energía se recarga más rápido durmiendo). */
  onLife(fn) { this._onLife = fn; }

  _leaveAct(quick = false) {
    const L = this.life;
    if (L.cur) this._onLife?.({ type: "end", act: L.cur.act });
    L.cur = null;
    L.state = "leave";
    L.blend = 0;
    L.t = 4 + Math.random() * 6;
  }

  _lifeTick(dt) {
    const L = this.life;
    const h = this.hero;
    const half = W / 2 - 0.9;
    const g = h.group;
    let mode = "idle";
    if (!this.lifeOn || (this.sel && this.freezeOnSel)) {
      h.animate(this.time, "idle", 1);
      return;
    }
    if (L.state === "idle") {
      L.t -= dt;
      g.position.set(L.hx, 0, L.hz);
      g.rotation.set(0, L.yaw + Math.sin(this.time * 0.6) * 0.15, 0);
      if (L.t <= 0) {
        const spots = this._spots().filter((s) => s.f.data.uid !== L.last);
        if (spots.length && Math.random() < 0.85) {
          const s = spots[Math.floor(Math.random() * spots.length)];
          this.interact(s.f.data.uid, false);
        } else {
          this.walkTo((Math.random() - 0.5) * (W - 3), (Math.random() - 0.5) * (W - 3));
        }
      }
    } else if (L.state === "walk") {
      const tg = L.target;
      if (!tg) { L.state = "idle"; return; }
      let goal;
      const ff = tg.uid ? this.furn.get(tg.uid) : null;
      if (tg.uid) {
        if (!ff) { L.state = "idle"; L.target = null; return; }
        const w = tg.goalW || this._worldOf(ff, tg.i.enter);
        goal = { x: Math.max(-half, Math.min(half, w.x)), z: Math.max(-half, Math.min(half, w.z)) };
      } else goal = tg.pt;
      let dx = goal.x - L.hx;
      let dz = goal.z - L.hz;
      const dist = Math.hypot(dx, dz);
      L.walkT += dt;
      if (L.walkT > 14 && dist > 1.2) { // no pudo llegar (algo lo tapa): se rinde en vez de usar el mueble desde cualquier parte
        L.state = "idle"; L.t = 2; L.target = null;
        return;
      }
      if (dist < 0.18 || L.walkT > 14) {
        if (tg.uid) { L.state = "enter"; L.blend = 0; L.enterFrom = { x: L.hx, z: L.hz, yaw: L.yaw }; this._beginAct(); }
        else { L.state = "idle"; L.t = 3 + Math.random() * 5; if (tg.door) { L.target = null; this._onDoor?.(); } }
        return;
      }
      dx /= dist; dz /= dist;
      // esquivar muebles (círculos alrededor de cada uno, menos el que quiere usar)
      let ax = 0, az = 0;
      for (const f of this.furn.values()) {
        if (f.data.wall || (ff && f === ff) || f.item.spot === "rug") continue;
        const box = new THREE.Box3().setFromObject(f.group);
        if (box.max.y < 0.3) continue;
        const c = box.getCenter(new THREE.Vector3());
        const sz = box.getSize(new THREE.Vector3());
        const r = Math.min(Math.max(sz.x, sz.z) / 2, 1.9) * 0.9 + 0.55;
        const ox = L.hx - c.x, oz = L.hz - c.z;
        const d = Math.hypot(ox, oz);
        if (d < r + 0.7 && d > 0.001) {
          const k = Math.min(1, (r + 0.7 - d) / 0.7);
          // empuja hacia afuera y un poco de lado para rodear
          ax += (ox / d) * k * 1.6 + (-oz / d) * k * 0.9;
          az += (oz / d) * k * 1.6 + (ox / d) * k * 0.9;
        }
      }
      const near = Math.min(1, dist / 1.6); // cerca de la meta ya no esquiva (si no, los muebles de al lado lo alejaban)
      ax *= near; az *= near;
      let vx = dx + ax, vz = dz + az;
      const vl = Math.hypot(vx, vz) || 1;
      vx /= vl; vz /= vl;
      const speed = 2.6;
      const nx = Math.max(-half, Math.min(half, L.hx + vx * speed * dt));
      const nz = Math.max(-half, Math.min(half, L.hz + vz * speed * dt));
      if (Math.hypot(nx - L.hx, nz - L.hz) < speed * dt * 0.2) L.stuck += dt; else L.stuck = Math.max(0, L.stuck - dt);
      L.hx = nx; L.hz = nz;
      const want = Math.atan2(vx, vz);
      let dy = want - L.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      L.yaw += dy * Math.min(1, dt * 10);
      g.position.set(L.hx, 0, L.hz);
      g.rotation.set(0, L.yaw, 0);
      mode = "walk";
      if (L.stuck > 2.5 && tg.uid) { // atascado: salta directo al mueble
        L.hx = goal.x; L.hz = goal.z; L.stuck = 0;
      }
    } else if (L.state === "enter" || L.state === "act") {
      const tg = L.target;
      const ff = tg && tg.uid ? this.furn.get(tg.uid) : null;
      if (!ff) { L.state = "idle"; L.cur = null; L.target = null; return; }
      const i = tg.i;
      const wpos = tg.goalW ? new THREE.Vector3(tg.goalW.x, 0, tg.goalW.z) : this._worldOf(ff, i.at);
      wpos.x = Math.max(-half - 0.3, Math.min(half + 0.3, wpos.x)); // nunca fuera de la pieza
      wpos.z = Math.max(-half - 0.3, Math.min(half + 0.3, wpos.z));
      const wyaw = this._yawOf(ff, i.face);
      const k = L.state === "enter" ? Math.min(1, L.blend + dt / 0.8) : 1;
      L.blend = k;
      const e = k * k * (3 - 2 * k);
      const sitY = { sit: -0.84, type: -0.84, piano: -0.84, eat: -0.84, bath: -0.84 }[i.act];
      let py = wpos.y + (sitY || 0);
      let rx = 0;
      if (i.act === "sleep") { py = wpos.y; rx = -Math.PI / 2; }
      if (i.act === "hop") py = wpos.y + Math.abs(Math.sin(this.time * 6)) * 0.55;
      let yaw = wyaw;
      let dy = yaw - L.enterFrom.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      const fx = L.enterFrom.x, fz = L.enterFrom.z;
      g.position.set(fx + (wpos.x - fx) * e, py * e, fz + (wpos.z - fz) * e);
      g.rotation.set(rx * e, L.enterFrom.yaw + dy * e, 0, "YXZ");
      mode = { sleep: "sleep", sit: "sit", type: "type", piano: "piano", arcade: "arcade", hop: "cheer", admire: "admire", fridge: "admire", cook: "dance", wash: "admire", eat: "sit", bath: "sit", wardrobe: "admire", watch: "admire" }[i.act];
      if (L.state === "enter" && k >= 1) { L.state = "act"; L.t = (i.act === "sleep" ? 30 : 8 + Math.random() * 8); this._onLife?.({ type: "start", act: i.act }); L.cur = i; }
      if (L.state === "act") {
        L.t -= dt;
        this._actTime = (this._actTime || 0) + dt;
        if (i.act === "sleep" && this._actTime > 2) { this._actTime = 0; this._onLife?.({ type: "tick", act: "sleep" }); }
        if (L.t <= 0 && !this.holdAct) this._leaveAct();
      }
    } else if (L.state === "leave") {
      // se levanta y vuelve a un punto libre junto al mueble
      L.blend += dt / 0.6;
      const tg = L.target;
      const ff = tg && tg.uid ? this.furn.get(tg.uid) : null;
      if (ff) {
        const w = tg.goalW || this._worldOf(ff, tg.i.enter);
        L.hx = Math.max(-half, Math.min(half, w.x)); L.hz = Math.max(-half, Math.min(half, w.z));
      }
      g.position.set(L.hx, 0, L.hz);
      g.rotation.set(0, L.yaw, 0);
      if (L.blend >= 1) { L.last = tg && tg.uid; L.state = "idle"; L.target = null; L.cur = null; }
    }
    h.animate(this.time, mode, 1);
    this._syncZzz(mode === "sleep", g);
  }

  _beginAct() { this._actTime = 0; }

  /** "Zzz" flotando sobre el Matichico mientras duerme. */
  _syncZzz(on, g) {
    if (!this.zzz) {
      const c = document.createElement("canvas");
      c.width = 128; c.height = 128;
      const x = c.getContext("2d");
      x.font = "900 72px system-ui, sans-serif";
      x.textAlign = "center"; x.textBaseline = "middle";
      x.lineWidth = 8; x.strokeStyle = "#3a2a8a"; x.fillStyle = "#fff6e6";
      x.strokeText("Zzz", 64, 64); x.fillText("Zzz", 64, 64);
      const tex = new THREE.CanvasTexture(c);
      this.zzz = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
      this.zzz.renderOrder = 12;
      this.zzz.scale.set(1.4, 1.4, 1);
      this.scene.add(this.zzz);
    }
    this.zzz.visible = on;
    if (on) {
      const t = this.time;
      this.zzz.position.set(g.position.x, g.position.y + 2.9 + Math.sin(t * 1.5) * 0.12, g.position.z);
      this.zzz.material.opacity = 0.6 + 0.4 * Math.abs(Math.sin(t * 1.5));
    }
  }

  setActive(on) {
    if (!this.ready) return;
    if (on && !this.active) {
      glAcquire(this.renderer);
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
    if (this.hero) this._lifeTick(dt);
    for (const f of this.ticks) f(this.time, dt);
    if (this.nTicks) for (const f of this.nTicks) f(this.time, dt);
    const sl = this._slide;
    const goal = sl ? sl.x : 0;
    if (Math.abs(this._camX - goal) > 0.01) {
      this._camX += (goal - this._camX) * Math.min(1, dt * 7) + Math.sign(goal - this._camX) * dt * 0.8;
      if (Math.abs(this._camX - goal) < 0.12) this._camX = goal;
      this._placeCam();
    }
    if (sl && this._camX === goal) { this._slide = null; sl.done && sl.done(); }
    if (this.ambient) this.ambient.update(this.time, dt, this.ambientC);
    if ((this._tt = (this._tt || 0) + dt) > 0.5) { this._tt = 0; this._toon(); } // lo nuevo (pisos, muebles, techos) también entra al estilo
    this._syncSelRing();
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this._loop);
  }
}

export { houseItemsOfSpot };
