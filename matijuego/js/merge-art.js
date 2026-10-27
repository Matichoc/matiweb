// Mati Merge: los dibujos de cada producto (se pintan en un canvas de 256x256).
// Del más chiquito al más grande: dentro de cada familia el dibujo va creciendo y, en los últimos, se vuelve dorado y brillante.
// Los productos con foto real usan assets/products/<img>.jpg.

import { CHAINS } from "./merge-data.js?v=6b749dd883";

const TAU = Math.PI * 2;

function rr(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
const fillRR = (g, x, y, w, h, r, fill, stroke) => { rr(g, x, y, w, h, r); g.fillStyle = fill; g.fill(); if (stroke) { g.strokeStyle = stroke; g.lineWidth = 3; g.stroke(); } };
const circle = (g, x, y, r, fill, stroke) => { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = fill; g.fill(); if (stroke) { g.strokeStyle = stroke; g.lineWidth = 3; g.stroke(); } };
function star(g, x, y, r, fill = "#fff") {
  g.beginPath();
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU - Math.PI / 2; const rad = i % 2 ? r * 0.28 : r; g.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); }
  g.closePath(); g.fillStyle = fill; g.fill();
}
/** Mezcla un color (0xRRGGBB) con blanco: `k` = cuánto blanco (0 = el color, 1 = blanco). */
function tint(color, k) {
  const c = [(color >> 16) & 255, (color >> 8) & 255, color & 255].map((v) => Math.round(v + (255 - v) * k));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
function goldGrad(g, x0, y0, x1, y1) {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  gr.addColorStop(0, "#fff3b0"); gr.addColorStop(0.35, "#ffd24a"); gr.addColorStop(0.7, "#d99a1a"); gr.addColorStop(1, "#ffe27a");
  return gr;
}

// ---- dibujos (el origen está en el centro; el "radio" útil es ~90) ----
const ART = {
  cookie(g) {
    circle(g, 0, 0, 50, "#c98a4b", "#8a5424");
    for (const [x, y] of [[-18, -16], [16, -22], [24, 8], [-6, 14], [-26, 20], [4, -2]]) circle(g, x, y, 7, "#4a2412");
  },
  alfmini(g) {
    fillRR(g, -52, 8, 104, 34, 17, "#d9a05a", "#8a5424");
    fillRR(g, -46, -8, 92, 20, 6, "#fff0d6", "#d8b890");
    fillRR(g, -52, -42, 104, 34, 17, "#d9a05a", "#8a5424");
    for (const x of [-30, -10, 10, 30]) circle(g, x, -26, 4.5, "#ff7aa8");
  },
  alfbox(g) {
    fillRR(g, -66, -6, 132, 70, 10, goldGrad(g, -66, -6, 66, 64), "#a56a00");
    fillRR(g, -74, -34, 148, 34, 8, goldGrad(g, -74, -34, 74, 0), "#a56a00");
    fillRR(g, -10, -34, 20, 98, 2, "#e0383a");
    circle(g, -20, -48, 17, "#e0383a", "#a01820"); circle(g, 20, -48, 17, "#e0383a", "#a01820"); circle(g, 0, -42, 9, "#ff5a5a");
    star(g, 56, -56, 14, "#fff"); star(g, -60, 30, 10, "#fff");
  },
  oblea(g) {
    g.rotate(-0.55);
    fillRR(g, -15, -66, 30, 132, 8, "#e8c88a", "#b88a48");
    g.strokeStyle = "rgba(150,100,40,0.5)"; g.lineWidth = 2;
    for (let y = -52; y < 60; y += 14) { g.beginPath(); g.moveTo(-15, y); g.lineTo(15, y); g.stroke(); }
  },
  _tube(g, len = 128, w = 30) {
    fillRR(g, -w / 2, -len / 2, w, len, w / 2, "#e8b878", "#a8742c");
    for (let i = 0; i < 5; i++) { const y = -len / 2 + 18 + i * ((len - 36) / 4); g.fillStyle = i % 2 ? "#ffd23a" : "#e0383a"; g.fillRect(-w / 2 + 1, y - 5, w - 2, 10); }
    circle(g, 0, -len / 2 + 4, w / 2 - 3, "#4a2412"); circle(g, 0, len / 2 - 4, w / 2 - 3, "#4a2412");
  },
  cuch1(g) { g.rotate(0.6); ART._tube(g); },
  cuch2(g) { for (const a of [0.9, -0.5]) { g.save(); g.rotate(a); ART._tube(g, 120, 28); g.restore(); } },
  cuch3(g) { for (const a of [-0.75, 0, 0.75]) { g.save(); g.translate(a * 18, 0); g.rotate(a); ART._tube(g, 118, 26); g.restore(); } fillRR(g, -40, 24, 80, 18, 6, "#e0383a", "#a01820"); },
  cuchjar(g) {
    for (const [x, a] of [[-20, -0.2], [0, 0.05], [20, 0.25], [-8, 0.15]]) { g.save(); g.translate(x, 6); g.rotate(a); ART._tube(g, 92, 22); g.restore(); }
    fillRR(g, -50, -46, 100, 108, 20, "rgba(190,230,255,0.45)", "#7aa8c8");
    fillRR(g, -44, -66, 88, 24, 8, "#e0383a", "#a01820");
    fillRR(g, -36, -36, 10, 84, 5, "rgba(255,255,255,0.55)");
  },
  cuchtower(g) {
    g.scale(0.9, 0.9);
    const row = (y, n) => { for (let i = 0; i < n; i++) { g.save(); g.translate((i - (n - 1) / 2) * 62, y); g.rotate(Math.PI / 2); ART._tube(g, 74, 26); g.restore(); } };
    row(40, 3); row(4, 2); row(-32, 1);
    star(g, -62, -52, 16, "#fff3b0"); star(g, 64, -30, 12, "#fff3b0"); star(g, 50, 60, 10, "#fff3b0");
  },
  bean(g) {
    g.rotate(-0.5);
    g.beginPath(); g.ellipse(0, 0, 34, 52, 0, 0, TAU); g.fillStyle = "#6b3a22"; g.fill(); g.strokeStyle = "#3a1c0e"; g.lineWidth = 3; g.stroke();
    g.beginPath(); g.moveTo(0, -46); g.bezierCurveTo(14, -16, -14, 16, 0, 46); g.strokeStyle = "#a8683c"; g.lineWidth = 4; g.stroke();
    g.beginPath(); g.ellipse(-12, -20, 6, 14, 0.2, 0, TAU); g.fillStyle = "rgba(255,255,255,0.3)"; g.fill();
  },
  bonbon(g) {
    g.fillStyle = "#ff7aa8";
    g.beginPath(); g.moveTo(-34, 0); g.lineTo(-76, -26); g.lineTo(-76, 26); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(34, 0); g.lineTo(76, -26); g.lineTo(76, 26); g.closePath(); g.fill();
    circle(g, 0, 0, 42, "#5a2d1a", "#2e150a");
    g.beginPath(); g.ellipse(-14, -16, 12, 7, -0.6, 0, TAU); g.fillStyle = "rgba(255,255,255,0.4)"; g.fill();
    fillRR(g, -10, -42, 20, 84, 6, "rgba(255,210,90,0.9)");
  },
  bonbonbox(g) {
    fillRR(g, -66, -46, 132, 96, 14, "#9a2a52", "#5a1030");
    fillRR(g, -58, -38, 116, 80, 10, "#3a1c0e");
    for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) { circle(g, -36 + c * 36, -16 + r * 38, 15, ["#8a4a2a", "#5a2d1a", "#c88a4a"][(r + c) % 3], "#2e150a"); circle(g, -40 + c * 36, -21 + r * 38, 4, "rgba(255,255,255,0.5)"); }
    fillRR(g, -74, -62, 148, 20, 8, "#ffd24a", "#c08a10");
  },
  heartbox(g) {
    g.beginPath(); g.moveTo(0, 62); g.bezierCurveTo(-110, -8, -62, -78, 0, -30); g.bezierCurveTo(62, -78, 110, -8, 0, 62); g.closePath();
    const gr = g.createLinearGradient(-60, -60, 60, 60); gr.addColorStop(0, "#ff9ec6"); gr.addColorStop(1, "#d4216c");
    g.fillStyle = gr; g.fill(); g.strokeStyle = "#8a0f45"; g.lineWidth = 4; g.stroke();
    g.save(); g.rotate(-0.6); fillRR(g, -14, -80, 28, 160, 4, "rgba(255,210,90,0.92)"); g.restore();
    circle(g, -20, -40, 12, "#ffd24a", "#c08a10"); circle(g, 20, -40, 12, "#ffd24a", "#c08a10");
    g.beginPath(); g.ellipse(-34, -26, 12, 7, -0.7, 0, TAU); g.fillStyle = "rgba(255,255,255,0.5)"; g.fill();
  },
  _bar(g, cols, rows, w, h, fill, edge, hi) {
    const cw = w / cols;
    const ch = h / rows;
    fillRR(g, -w / 2 - 5, -h / 2 - 5, w + 10, h + 10, 10, edge);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = -w / 2 + c * cw + 2;
      const y = -h / 2 + r * ch + 2;
      fillRR(g, x, y, cw - 4, ch - 4, 5, typeof fill === "function" ? fill(c, r, x, y, cw, ch) : fill);
      fillRR(g, x + 3, y + 3, (cw - 4) * 0.5, 4, 2, hi || "rgba(255,255,255,0.22)");
    }
  },
  bar1(g) { g.rotate(-0.2); ART._bar(g, 2, 1, 84, 46, "#7a4126", "#3a1c0e"); },
  bar2(g) { g.rotate(-0.12); ART._bar(g, 2, 3, 70, 104, "#7a4126", "#3a1c0e"); },
  bar3(g) { ART._bar(g, 3, 4, 90, 118, "#6b3a22", "#3a1c0e"); fillRR(g, -45, 32, 90, 28, 4, "#d4216c"); },
  bar4(g) {
    ART._bar(g, 3, 4, 94, 124, "#6b3a22", "#3a1c0e");
    g.beginPath(); g.moveTo(-52, -4); g.lineTo(52, 30); g.lineTo(52, 66); g.lineTo(-52, 66); g.closePath(); g.fillStyle = "#ffb400"; g.fill(); g.strokeStyle = "#a56a00"; g.lineWidth = 3; g.stroke();
    circle(g, 0, 40, 14, "#fff6e6", "#d4216c");
  },
  bar5(g) {
    ART._bar(g, 4, 6, 108, 150, "#5a2d1a", "#2e150a");
    fillRR(g, -60, 12, 120, 40, 6, "#e0383a", "#a01820");
    fillRR(g, -10, -80, 20, 160, 3, "#ffd24a");
    circle(g, 0, 32, 16, "#fff6e6", "#a01820");
  },
  bar6(g) {
    ART._bar(g, 4, 6, 108, 150, (c, r, x, y, cw, ch) => goldGrad(g, x, y, x + cw, y + ch), "#a56a00", "rgba(255,255,255,0.5)");
    star(g, 52, -66, 16, "#fff"); star(g, -56, 50, 12, "#fff");
  },
  dubai(g) {
    g.save(); g.shadowColor = "rgba(255,210,60,0.9)"; g.shadowBlur = 24;
    ART._bar(g, 4, 5, 112, 138, (c, r, x, y, cw, ch) => goldGrad(g, x, y, x + cw, y + ch), "#8a5a00", "rgba(255,255,255,0.6)");
    g.restore();
    for (const [x, y] of [[-33, -28], [11, -28], [-33, 18], [11, 18]]) { circle(g, x + 12, y + 10, 8, "#7ad06a", "#3a8a3a"); circle(g, x + 12, y + 10, 3, "#d8f0a0"); }
    g.beginPath(); g.moveTo(-38, -86); g.lineTo(-24, -64); g.lineTo(-12, -92); g.lineTo(0, -64); g.lineTo(12, -92); g.lineTo(24, -64); g.lineTo(38, -86); g.lineTo(34, -52); g.lineTo(-34, -52); g.closePath();
    g.fillStyle = goldGrad(g, -38, -92, 38, -52); g.fill(); g.strokeStyle = "#a56a00"; g.lineWidth = 3; g.stroke();
    for (const x of [-34, 0, 34]) circle(g, x, -88, 5, "#ff3b6b", "#a01830");
    star(g, -68, -30, 18, "#fff"); star(g, 70, 20, 16, "#fff"); star(g, 62, -64, 11, "#fff3b0"); star(g, -60, 56, 11, "#fff3b0");
  },
};

const BOXES = {};
/** Tamaño real (en píxeles del dibujo sin escalar) de un dibujo: se pinta una vez aparte y se mira qué casilleros quedaron pintados. */
function measure(name) {
  if (BOXES[name] !== undefined) return BOXES[name];
  let box = null;
  try {
    const c = document.createElement("canvas");
    c.width = c.height = 400;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.translate(200, 200);
    ART[name](g);
    const d = g.getImageData(0, 0, 400, 400).data;
    let x0 = 400, y0 = 400, x1 = -1, y1 = -1;
    for (let y = 0; y < 400; y++) for (let x = 0; x < 400; x++) if (d[(y * 400 + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 > x0 && y1 > y0) box = { w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2 - 200, cy: (y0 + y1) / 2 - 200 };
  } catch (e) { /* sin medir: se usa el tamaño de siempre */ }
  BOXES[name] = box;
  return box;
}

/** Pinta el producto `info` (de merge-data.js) en un canvas de 256x256. `images` = { nombre: Image } con las fotos ya cargadas. */
export function drawItem(canvas, info, images = {}) {
  const g = canvas.getContext("2d");
  const S = 256;
  g.clearRect(0, 0, S, S);
  const chain = CHAINS[info.c];
  const col = `#${chain.color.toString(16).padStart(6, "0")}`;
  g.save();
  g.translate(S / 2, S / 2);
  // aro de color de la familia (dorado y con brillo en los productos más especiales)
  if (info.gold) { g.shadowColor = "rgba(255,200,40,0.95)"; g.shadowBlur = 18; }
  const grd = info.gold ? goldGrad(g, -128, -128, 128, 128) : (() => { const gr = g.createRadialGradient(-40, -50, 20, 0, 0, 128); gr.addColorStop(0, "#fff"); gr.addColorStop(1, col); return gr; })();
  circle(g, 0, 0, 120, grd);
  g.shadowBlur = 0;
  // fondo del casillero con un tono claro de la familia (así se distinguen de lejos: naranja, amarillo, malva, rosa)
  circle(g, 0, 0, 100, info.top ? "#fff7d0" : tint(chain.color, 0.8));
  // dibujo (crece con el nivel)
  g.save();
  g.beginPath(); g.arc(0, 0, 96, 0, TAU); g.clip();
  const img = info.img && images[info.img];
  if (info.img) {
    if (img && img.width) g.drawImage(img, -96, -96, 192, 192);
    else circle(g, 0, 0, 96, col);
  } else {
    // el dibujo se mide y se ajusta para llenar el círculo; crece con el nivel (de ~65 % a ~95 % del círculo)
    const frac = (info.t - 1) / Math.max(1, info.max - 1);
    const want = 125 + 65 * frac;
    const box = measure(info.art);
    const s = box ? Math.min(want / Math.max(box.w, box.h), 2.2) : 1;
    g.scale(s, s);
    if (box) g.translate(-box.cx, -box.cy);
    ART[info.art](g);
  }
  g.restore();
  // número del nivel
  g.restore();
  g.fillStyle = "#4a2440";
  g.beginPath(); g.arc(204, 204, 40, 0, TAU); g.fill();
  g.strokeStyle = "#fff"; g.lineWidth = 5; g.stroke();
  g.fillStyle = "#fff"; g.font = "bold 50px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(String(info.t), 204, 207);
  return canvas;
}

export function loadProductImages(names) {
  const out = {};
  return Promise.all([...new Set(names)].map((n) => new Promise((res) => {
    const im = new Image();
    im.onload = () => { out[n] = im; res(); };
    im.onerror = () => res();
    im.src = `assets/products/${n}.jpg`;
  }))).then(() => out);
}
