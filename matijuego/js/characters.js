// Definición y dibujo procedural de los "Matichicos".
// Cada personaje se dibuja con canvas 2D (sin imágenes externas) para
// mantener el juego liviano y fácil de desplegar.

export const CHARACTERS = [
  {
    id: "capitan",
    name: "Matichico",
    type: "futbol_chico",
    gender: "boy",
    number: "10",
    choco: "#b8662b",
    chocoDark: "#8d4a1f",
  },
  {
    id: "estrella",
    name: "Chocolatina",
    type: "futbol_chica",
    gender: "girl",
    number: "7",
    choco: "#a9582a",
    chocoDark: "#7f4020",
  },
  {
    id: "baller",
    name: "Matichico Baller",
    type: "basket",
    gender: "boy",
    number: "12",
    choco: "#b8662b",
    chocoDark: "#8d4a1f",
  },
  {
    id: "cheer",
    name: "Chocolatina Cheer",
    type: "cheer",
    gender: "girl",
    number: "",
    choco: "#a9582a",
    chocoDark: "#7f4020",
  },
];

// Los atuendos y todo el guardarropa viven en js/wardrobe-data.js
import { getOutfit } from "./wardrobe-data.js?v=d71cbaec54";
export { OUTFITS, getOutfit } from "./wardrobe-data.js?v=d71cbaec54";

/**
 * Dibuja un Matichico dentro de un cuadro size x size, centrado en (cx, cy).
 * outfit: paleta { jersey, trim } comprada/equipada (ver OUTFITS).
 * t: tiempo en segundos (para animación de caminata/rebote).
 * moving: si el personaje se está desplazando.
 * facing: 'up' | 'down' | 'left' | 'right'
 */
export function drawCharacter(ctx, char, outfit, cx, cy, size, t, moving, facing = "down") {
  const bob = moving ? Math.sin(t * 12) * size * 0.03 : Math.sin(t * 3) * size * 0.01;
  const legSwing = moving ? Math.sin(t * 12) * size * 0.12 : 0;
  const flip = facing === "left" ? -1 : 1;

  ctx.save();
  ctx.translate(cx, cy + bob);
  ctx.scale(flip, 1);

  const headW = size * 0.66;
  const headH = size * 0.66;
  const bodyW = size * 0.56;
  const bodyH = size * 0.34;

  // Sombra (degradado radial para un contacto con el suelo más suave)
  ctx.save();
  ctx.translate(0, size * 0.46 - bob);
  ctx.scale(1, 0.35);
  const shadowGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.34);
  shadowGrad.addColorStop(0, "rgba(0,0,0,0.32)");
  shadowGrad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.34, 0, Math.PI * 2);
  ctx.fillStyle = shadowGrad;
  ctx.fill();
  ctx.restore();

  // Piernas
  ctx.fillStyle = char.chocoDark;
  ctx.fillRect(-bodyW * 0.28 - legSwing * 0.3, size * 0.14, size * 0.16, size * 0.22);
  ctx.fillRect(bodyW * 0.12 + legSwing * 0.3, size * 0.14, size * 0.16, size * 0.22);
  // Calzado
  ctx.fillStyle = "#2a2a2a";
  ctx.fillRect(-bodyW * 0.30 - legSwing * 0.3, size * 0.33, size * 0.2, size * 0.07);
  ctx.fillRect(bodyW * 0.10 + legSwing * 0.3, size * 0.33, size * 0.2, size * 0.07);

  // Cuerpo / jersey (degradado para dar volumen en vez de un color plano)
  roundRect(ctx, -bodyW / 2, -size * 0.06, bodyW, bodyH, size * 0.12);
  const jerseyGrad = ctx.createLinearGradient(0, -size * 0.06, 0, -size * 0.06 + bodyH);
  jerseyGrad.addColorStop(0, shadeColor(outfit.jersey, 18));
  jerseyGrad.addColorStop(1, shadeColor(outfit.jersey, -12));
  ctx.fillStyle = jerseyGrad;
  ctx.fill();
  ctx.lineWidth = size * 0.03;
  ctx.strokeStyle = outfit.trim;
  ctx.stroke();

  // Falda (solo cheer) para reforzar la silueta femenina del uniforme
  if (char.type === "cheer") {
    ctx.beginPath();
    ctx.moveTo(-bodyW / 2, size * 0.1);
    ctx.lineTo(bodyW / 2, size * 0.1);
    ctx.lineTo(bodyW / 2 + size * 0.05, size * 0.2);
    ctx.lineTo(-bodyW / 2 - size * 0.05, size * 0.2);
    ctx.closePath();
    ctx.fillStyle = outfit.trim;
    ctx.fill();
  }

  // Número en el jersey
  if (char.number) {
    ctx.fillStyle = outfit.trim;
    ctx.font = `${size * 0.16}px "Baby Chipmunk", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(char.number, 0, size * 0.1);
  }

  // Brazos
  ctx.fillStyle = char.choco;
  const armSwing = moving ? Math.sin(t * 12 + Math.PI) * size * 0.08 : 0;
  ctx.beginPath();
  ctx.arc(-bodyW / 2 - size * 0.03, size * 0.02 + armSwing, size * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(bodyW / 2 + size * 0.03, size * 0.02 - armSwing, size * 0.08, 0, Math.PI * 2);
  ctx.fill();

  // Cabeza tipo "barra de chocolate"
  ctx.save();
  ctx.translate(0, -size * 0.32);
  roundRect(ctx, -headW / 2, -headH / 2, headW, headH, size * 0.14);
  const headGrad = ctx.createLinearGradient(0, -headH / 2, 0, headH / 2);
  headGrad.addColorStop(0, shadeColor(char.choco, 14));
  headGrad.addColorStop(1, char.chocoDark);
  ctx.fillStyle = headGrad;
  ctx.fill();

  // Ranuras de chocolate
  ctx.strokeStyle = char.chocoDark;
  ctx.lineWidth = size * 0.02;
  ctx.beginPath();
  ctx.moveTo(-headW * 0.16, -headH / 2 + size * 0.03);
  ctx.lineTo(-headW * 0.16, headH / 2 - size * 0.03);
  ctx.moveTo(headW * 0.16, -headH / 2 + size * 0.03);
  ctx.lineTo(headW * 0.16, headH / 2 - size * 0.03);
  ctx.stroke();

  drawHairBase(ctx, char, size);
  drawFace(ctx, char, size, t);
  drawHairAccessory(ctx, char, outfit, size);
  ctx.restore();

  ctx.restore();
}

function drawHairBase(ctx, char, size) {
  // Peinado corto de base para los personajes varones, para que se lean
  // claramente como "matichicos" y no queden con cabeza pelada.
  // Nota: estas coordenadas son locales a la cabeza (centro en 0,0,
  // mitad de alto ≈ size*0.31), por eso el flequillo va pegado al borde superior.
  if (char.gender !== "boy" || char.type !== "futbol_chico") return;
  ctx.fillStyle = "#2a180d";
  ctx.beginPath();
  ctx.moveTo(-size * 0.29, -size * 0.3);
  ctx.quadraticCurveTo(0, -size * 0.4, size * 0.29, -size * 0.3);
  ctx.lineTo(size * 0.29, -size * 0.2);
  ctx.quadraticCurveTo(0, -size * 0.3, -size * 0.29, -size * 0.2);
  ctx.closePath();
  ctx.fill();
}

function drawFace(ctx, char, size, t = 0) {
  const eyeY = -size * 0.03;
  const eyeDX = size * 0.13;
  const eyeR = size * 0.105;
  const isGirl = char.gender === "girl";

  // Rubor (solo personajes femeninos, para un look más tierno)
  if (isGirl) {
    ctx.fillStyle = "rgba(212,33,108,0.3)";
    ctx.beginPath();
    ctx.arc(-eyeDX - eyeR * 1.4, eyeY + eyeR * 1.4, eyeR * 0.55, 0, Math.PI * 2);
    ctx.arc(eyeDX + eyeR * 1.4, eyeY + eyeR * 1.4, eyeR * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }

  // Parpadeo periódico: un abrir/cerrar breve cada pocos segundos le da vida
  // al personaje aunque esté quieto (t=0 en las miniaturas nunca parpadea).
  const cycle = t % 3.6;
  const blinking = cycle > 3.45 && cycle < 3.6;

  if (blinking) {
    ctx.strokeStyle = char.chocoDark;
    ctx.lineWidth = size * 0.02;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-eyeDX - eyeR * 0.8, eyeY);
    ctx.quadraticCurveTo(-eyeDX, eyeY + eyeR * 0.3, -eyeDX + eyeR * 0.8, eyeY);
    ctx.moveTo(eyeDX - eyeR * 0.8, eyeY);
    ctx.quadraticCurveTo(eyeDX, eyeY + eyeR * 0.3, eyeDX + eyeR * 0.8, eyeY);
    ctx.stroke();
  } else {
    // Ojos (blanco)
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(-eyeDX, eyeY, eyeR, 0, Math.PI * 2);
    ctx.arc(eyeDX, eyeY, eyeR, 0, Math.PI * 2);
    ctx.fill();

    // Iris
    ctx.fillStyle = char.type === "basket" ? "#2f6fd6" : "#2b1a10";
    ctx.beginPath();
    ctx.arc(-eyeDX + size * 0.02, eyeY, eyeR * 0.55, 0, Math.PI * 2);
    ctx.arc(eyeDX + size * 0.02, eyeY, eyeR * 0.55, 0, Math.PI * 2);
    ctx.fill();

    // Brillo
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(-eyeDX + size * 0.04, eyeY - size * 0.02, eyeR * 0.18, 0, Math.PI * 2);
    ctx.arc(eyeDX + size * 0.04, eyeY - size * 0.02, eyeR * 0.18, 0, Math.PI * 2);
    ctx.fill();
  }

  // Cejas
  ctx.strokeStyle = char.chocoDark;
  ctx.lineWidth = size * 0.025;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-eyeDX - eyeR * 0.8, eyeY - eyeR * 1.5);
  ctx.lineTo(-eyeDX + eyeR * 0.7, eyeY - eyeR * 1.8);
  ctx.moveTo(eyeDX - eyeR * 0.7, eyeY - eyeR * 1.8);
  ctx.lineTo(eyeDX + eyeR * 0.8, eyeY - eyeR * 1.5);
  ctx.stroke();

  // Sonrisa
  ctx.beginPath();
  ctx.arc(0, size * 0.08, size * 0.12, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();

  if (char.type === "cheer") {
    // lentes
    ctx.strokeStyle = "#5a3320";
    ctx.lineWidth = size * 0.02;
    ctx.beginPath();
    ctx.arc(-eyeDX, eyeY, eyeR * 1.15, 0, Math.PI * 2);
    ctx.arc(eyeDX, eyeY, eyeR * 1.15, 0, Math.PI * 2);
    ctx.moveTo(-eyeDX + eyeR * 1.1, eyeY);
    ctx.lineTo(eyeDX - eyeR * 1.1, eyeY);
    ctx.stroke();
  }

  if (isGirl) {
    // pestañas: marca femenina común a ambas matichicas
    ctx.strokeStyle = "#2b1a10";
    ctx.lineWidth = size * 0.015;
    [-1, 1].forEach((side) => {
      ctx.beginPath();
      ctx.moveTo(side * eyeDX - eyeR * 0.7, eyeY - eyeR * 0.9);
      ctx.lineTo(side * eyeDX - eyeR, eyeY - eyeR * 1.4);
      ctx.stroke();
    });
  }
}

function drawHairAccessory(ctx, char, outfit, size) {
  ctx.fillStyle = "#3b2414";
  if (char.type === "futbol_chica") {
    // cola de caballo
    ctx.beginPath();
    ctx.moveTo(size * 0.24, -size * 0.28);
    ctx.quadraticCurveTo(size * 0.46, -size * 0.1, size * 0.34, size * 0.16);
    ctx.quadraticCurveTo(size * 0.28, -size * 0.05, size * 0.2, -size * 0.24);
    ctx.closePath();
    ctx.fill();
    // moño sobre la cola, en zona sólida de cabello (no sobre el borde redondeado de la cabeza)
    ctx.fillStyle = outfit.jersey;
    ctx.beginPath();
    ctx.arc(size * 0.3, -size * 0.06, size * 0.045, 0, Math.PI * 2);
    ctx.fill();
  } else if (char.type === "basket") {
    // mechón/copete
    ctx.beginPath();
    ctx.moveTo(-size * 0.02, -size * 0.3);
    ctx.quadraticCurveTo(size * 0.02, -size * 0.46, size * 0.08, -size * 0.3);
    ctx.quadraticCurveTo(size * 0.03, -size * 0.36, -size * 0.02, -size * 0.3);
    ctx.fill();
  } else if (char.type === "cheer") {
    // chongo con moño
    ctx.beginPath();
    ctx.arc(0, -size * 0.36, size * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = outfit.jersey;
    ctx.beginPath();
    ctx.moveTo(size * 0.06, -size * 0.46);
    ctx.lineTo(size * 0.2, -size * 0.52);
    ctx.lineTo(size * 0.18, -size * 0.4);
    ctx.closePath();
    ctx.moveTo(-size * 0.06, -size * 0.46);
    ctx.lineTo(-size * 0.2, -size * 0.52);
    ctx.lineTo(-size * 0.18, -size * 0.4);
    ctx.closePath();
    ctx.fill();
  }
}

/** Aclara (percent>0) u oscurece (percent<0) un color hexadecimal, para degradados. */
function shadeColor(hex, percent) {
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const r = Math.min(255, Math.max(0, (num >> 16) + amt));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amt));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amt));
  return `rgb(${r},${g},${b})`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Dibuja una miniatura de personaje en un canvas pequeño (para el selector/tienda). */
export function renderCharacterThumb(canvas, char, outfit = getOutfit("polera")) {
  const ctx = canvas.getContext("2d");
  const size = canvas.width;
  ctx.clearRect(0, 0, size, size);
  drawCharacter(ctx, char, outfit, size / 2, size * 0.6, size * 0.8, 0, false, "down");
}
