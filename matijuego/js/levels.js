// Definición de niveles/mapas: tema visual, camino guiado, obstáculos,
// coleccionables y misión. Cada nivel define un "camino" (polilínea) que se
// convierte en un corredor transitable rodeado de muros generados
// automáticamente — así se avanza por una ruta clara con obstáculos
// simples en el camino, en vez de deambular por un campo abierto.

export const CANVAS_W = 800;
export const CANVAS_H = 480;

/** Tipos de golosinas coleccionables (variedad visual, mismo valor en puntos). */
export const COLLECTIBLE_KINDS = ["choco", "alfajor", "cuchuflin", "barquillo"];

const BORDER = [
  { x: 0, y: 0, w: 800, h: 24 },
  { x: 0, y: 456, w: 800, h: 24 },
  { x: 0, y: 0, w: 24, h: 480 },
  { x: 776, y: 0, w: 24, h: 480 },
];

export const LEVELS = [
  {
    id: "liga",
    name: "Nivel 1 · Cancha La Liga",
    theme: "field",
    missionText: "Sigue el camino y recolecta 8 golosinas antes de que se acabe el tiempo.",
    target: 8,
    timeLimit: 45,
    chocoCount: 10,
    requiresFlag: false,
    path: [
      { x: 120, y: 410 },
      { x: 120, y: 120 },
      { x: 400, y: 120 },
      { x: 400, y: 410 },
      { x: 680, y: 410 },
    ],
    corridorWidth: 130,
    obstacles: [
      { x: 105, y: 250, w: 30, h: 30 },
      { x: 385, y: 250, w: 30, h: 30 },
      { x: 630, y: 300, w: 30, h: 30 },
    ],
  },
  {
    id: "basket",
    name: "Nivel 2 · Cancha de Básquet",
    theme: "court",
    missionText: "Sigue el camino, recolecta 10 golosinas y esquiva los conos que se mueven.",
    target: 10,
    timeLimit: 42,
    chocoCount: 12,
    requiresFlag: false,
    path: [
      { x: 120, y: 410 },
      { x: 120, y: 120 },
      { x: 680, y: 120 },
      { x: 680, y: 410 },
    ],
    corridorWidth: 120,
    guards: [{ t0: 0.55, speed: 60 }],
    obstacles: [],
    movingObstacles: [
      { x: 120, y: 280, w: 26, h: 26, axis: "x", range: 45, speed: 70 },
      { x: 400, y: 120, w: 26, h: 26, axis: "y", range: 45, speed: 80 },
      { x: 680, y: 220, w: 26, h: 26, axis: "x", range: 45, speed: 75 },
      { x: 680, y: 340, w: 26, h: 26, axis: "x", range: 45, speed: 65 },
    ],
  },
  {
    id: "cheer",
    name: "Nivel 3 · Gimnasio Cheer",
    theme: "gym",
    missionText: "Sigue el camino, recolecta las 12 golosinas y llega a la meta.",
    target: 12,
    timeLimit: 50,
    chocoCount: 12,
    requiresFlag: true,
    path: [
      { x: 120, y: 410 },
      { x: 120, y: 150 },
      { x: 400, y: 150 },
      { x: 400, y: 60 },
      { x: 700, y: 60 },
    ],
    corridorWidth: 110,
    guards: [{ t0: 0.45, speed: 65 }],
    flag: { x: 690, y: 28, w: 36, h: 36 },
    obstacles: [
      { x: 105, y: 260, w: 30, h: 30 },
      { x: 385, y: 100, w: 30, h: 30 },
      { x: 560, y: 45, w: 30, h: 30 },
    ],
  },
  {
    id: "liga_dificil",
    name: "Nivel 4 · Revancha en La Liga",
    theme: "field",
    missionText: "Camino más largo y angosto: recolecta 10 golosinas. Usa ESPACIO para saltar las vallas.",
    target: 10,
    timeLimit: 42,
    chocoCount: 12,
    requiresFlag: false,
    path: [
      { x: 120, y: 410 },
      { x: 120, y: 280 },
      { x: 300, y: 280 },
      { x: 300, y: 120 },
      { x: 550, y: 120 },
      { x: 550, y: 350 },
      { x: 690, y: 350 },
    ],
    corridorWidth: 100,
    guards: [{ t0: 0.4, speed: 70 }],
    obstacles: [
      { x: 70, y: 345, w: 100, h: 16, jumpable: true },
      { x: 202, y: 230, w: 16, h: 100, jumpable: true },
      { x: 500, y: 235, w: 100, h: 16, jumpable: true },
      { x: 285, y: 190, w: 30, h: 30 },
    ],
    movingObstacles: [
      { x: 550, y: 220, w: 24, h: 24, axis: "x", range: 35, speed: 70 },
    ],
  },
  {
    id: "basket_pro",
    name: "Nivel 5 · Básquet Pro",
    theme: "court",
    missionText: "Camino angosto y conos veloces: recolecta 12 golosinas. Salta con ESPACIO.",
    target: 12,
    timeLimit: 42,
    chocoCount: 13,
    requiresFlag: false,
    path: [
      { x: 110, y: 410 },
      { x: 110, y: 250 },
      { x: 300, y: 250 },
      { x: 300, y: 110 },
      { x: 690, y: 110 },
      { x: 690, y: 410 },
    ],
    corridorWidth: 90,
    guards: [{ t0: 0.3, speed: 75 }, { t0: 0.75, speed: 70 }],
    obstacles: [
      { x: 262, y: 165, w: 16, h: 90, jumpable: true },
      { x: 645, y: 300, w: 90, h: 16, jumpable: true },
    ],
    movingObstacles: [
      { x: 110, y: 330, w: 24, h: 24, axis: "x", range: 30, speed: 95 },
      { x: 500, y: 110, w: 24, h: 24, axis: "y", range: 30, speed: 100 },
      { x: 690, y: 250, w: 24, h: 24, axis: "x", range: 30, speed: 90 },
    ],
  },
  {
    id: "cheer_final",
    name: "Nivel 6 · Gran Final Cheer",
    theme: "gym",
    missionText: "La rutina final: salta cada valla con ESPACIO y recolecta 14 pompones antes de llegar a la meta.",
    target: 14,
    timeLimit: 55,
    chocoCount: 15,
    requiresFlag: true,
    path: [
      { x: 110, y: 410 },
      { x: 110, y: 300 },
      { x: 280, y: 300 },
      { x: 280, y: 150 },
      { x: 480, y: 150 },
      { x: 480, y: 320 },
      { x: 690, y: 320 },
      { x: 690, y: 60 },
    ],
    corridorWidth: 90,
    guards: [{ t0: 0.35, speed: 75 }, { t0: 0.8, speed: 70 }],
    flag: { x: 672, y: 28, w: 36, h: 36 },
    obstacles: [
      { x: 65, y: 355, w: 90, h: 16, jumpable: true },
      { x: 187, y: 255, w: 16, h: 90, jumpable: true },
      { x: 235, y: 225, w: 90, h: 16, jumpable: true },
      { x: 372, y: 105, w: 16, h: 90, jumpable: true },
      { x: 435, y: 235, w: 90, h: 16, jumpable: true },
      { x: 577, y: 275, w: 16, h: 90, jumpable: true },
      { x: 645, y: 190, w: 90, h: 16, jumpable: true },
    ],
  },
  {
    id: "fabrica",
    name: "Nivel 7 · Fábrica de Chocolate",
    theme: "factory",
    missionText: "Las cintas transportadoras te empujan: recolecta 12 golosinas, salta las vallas y llega a la meta.",
    target: 12,
    timeLimit: 50,
    chocoCount: 14,
    requiresFlag: true,
    path: [
      { x: 110, y: 410 },
      { x: 110, y: 110 },
      { x: 400, y: 110 },
      { x: 400, y: 370 },
      { x: 690, y: 370 },
      { x: 690, y: 90 },
    ],
    corridorWidth: 100,
    flag: { x: 672, y: 72, w: 36, h: 36 },
    guards: [{ t0: 0.5, speed: 70 }],
    conveyors: [
      { x: 60, y: 180, w: 100, h: 120, dx: 0, dy: -1 },
      { x: 350, y: 200, w: 100, h: 140, dx: 0, dy: 1 },
      { x: 640, y: 160, w: 100, h: 140, dx: 0, dy: 1 },
    ],
    obstacles: [
      { x: 95, y: 340, w: 30, h: 30 },
      { x: 385, y: 260, w: 30, h: 30 },
      { x: 250, y: 60, w: 16, h: 100, jumpable: true },
      { x: 540, y: 320, w: 16, h: 100, jumpable: true },
    ],
    movingObstacles: [
      { x: 690, y: 330, w: 24, h: 24, axis: "x", range: 32, speed: 80 },
    ],
  },
  {
    id: "gran_final",
    name: "Nivel 8 · Gran Final del Cacao",
    theme: "cacao",
    missionText: "El circuito más largo: 16 golosinas, vallas, guardias y cintas. ¡Usa el impulso (Shift) para escapar!",
    target: 16,
    timeLimit: 62,
    chocoCount: 18,
    requiresFlag: true,
    path: [
      { x: 100, y: 420 },
      { x: 100, y: 330 },
      { x: 300, y: 330 },
      { x: 300, y: 200 },
      { x: 100, y: 200 },
      { x: 100, y: 100 },
      { x: 400, y: 100 },
      { x: 400, y: 380 },
      { x: 700, y: 380 },
      { x: 700, y: 100 },
    ],
    corridorWidth: 84,
    flag: { x: 682, y: 82, w: 36, h: 36 },
    guards: [{ t0: 0.25, speed: 78 }, { t0: 0.7, speed: 72 }],
    conveyors: [
      { x: 360, y: 150, w: 80, h: 100, dx: 0, dy: 1 },
      { x: 660, y: 260, w: 80, h: 100, dx: 0, dy: 1 },
    ],
    obstacles: [
      { x: 196, y: 288, w: 16, h: 84, jumpable: true },
      { x: 196, y: 158, w: 16, h: 84, jumpable: true },
      { x: 240, y: 58, w: 16, h: 84, jumpable: true },
      { x: 540, y: 338, w: 16, h: 84, jumpable: true },
      { x: 358, y: 280, w: 84, h: 16, jumpable: true },
      { x: 658, y: 200, w: 84, h: 16, jumpable: true },
    ],
    movingObstacles: [
      { x: 320, y: 100, w: 24, h: 24, axis: "y", range: 28, speed: 90 },
      { x: 600, y: 380, w: 24, h: 24, axis: "y", range: 28, speed: 95 },
    ],
  },
];

// ---------- CAMINO / CORREDOR ----------

function distToSegment(px, py, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy || 1;
  let t = ((px - a.x) * dx + (py - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = a.x + t * dx, cy = a.y + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function distToPath(px, py, path) {
  let min = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    min = Math.min(min, distToSegment(px, py, path[i], path[i + 1]));
  }
  return min;
}

/**
 * Genera los muros que rodean el camino: toda celda de una grilla gruesa
 * que quede más lejos que corridorWidth/2 del camino se convierte en pared.
 * Al basarse en distancia (no en tramos rectos por separado), los recodos
 * del camino quedan bien cerrados sin huecos ni bloqueos accidentales.
 */
export function buildCorridorWalls(path, corridorWidth, cell = 40) {
  const walls = [];
  const left = 24, top = 24, right = CANVAS_W - 24, bottom = CANVAS_H - 24;
  for (let y = top; y < bottom; y += cell) {
    for (let x = left; x < right; x += cell) {
      const cx = Math.min(x + cell, right) - (Math.min(x + cell, right) - x) / 2;
      const cy = Math.min(y + cell, bottom) - (Math.min(y + cell, bottom) - y) / 2;
      if (distToPath(cx, cy, path) > corridorWidth / 2) {
        walls.push({
          x, y,
          w: Math.min(cell, right - x),
          h: Math.min(cell, bottom - y),
          corridor: true,
        });
      }
    }
  }
  return walls;
}

function levelObstacles(level) {
  if (!level._resolvedObstacles) {
    const corridor = level.path ? buildCorridorWalls(level.path, level.corridorWidth) : [];
    level._resolvedObstacles = [...BORDER, ...corridor, ...(level.obstacles || [])];
  }
  return level._resolvedObstacles;
}

export function getObstacles(level) {
  return levelObstacles(level);
}

export function getSpawn(level) {
  return level.path ? { x: level.path[0].x, y: level.path[0].y } : { x: CANVAS_W / 2, y: CANVAS_H - 70 };
}

/** Punto aleatorio dentro del corredor transitable (con margen respecto a los muros). */
function randomPointInCorridor(level, margin = 24) {
  if (!level.path) {
    return { x: 50 + Math.random() * (CANVAS_W - 100), y: 50 + Math.random() * (CANVAS_H - 100) };
  }
  const path = level.path;
  const segLengths = [];
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const len = Math.hypot(path[i + 1].x - path[i].x, path[i + 1].y - path[i].y);
    segLengths.push(len);
    total += len;
  }
  let t = Math.random() * total;
  let segIndex = 0;
  while (segIndex < segLengths.length - 1 && t > segLengths[segIndex]) {
    t -= segLengths[segIndex];
    segIndex++;
  }
  const a = path[segIndex], b = path[segIndex + 1];
  const segLen = segLengths[segIndex] || 1;
  const frac = t / segLen;
  const baseX = a.x + (b.x - a.x) * frac;
  const baseY = a.y + (b.y - a.y) * frac;

  // desplazamiento perpendicular al tramo, acotado al ancho del corredor
  const maxOffset = level.corridorWidth / 2 - margin;
  const offset = (Math.random() * 2 - 1) * Math.max(0, maxOffset);
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const perpX = -dy / len, perpY = dx / len;
  return { x: baseX + perpX * offset, y: baseY + perpY * offset };
}

/** Genera posiciones de coleccionables a lo largo del camino del nivel. */
export function generateChocolates(level) {
  const chocolates = [];
  const obstacles = levelObstacles(level);
  let attempts = 0;
  while (chocolates.length < level.chocoCount && attempts < 400) {
    attempts++;
    const { x, y } = randomPointInCorridor(level, 22);
    const collides = obstacles.some((o) => rectContains(o, x, y, 20));
    const tooClose = chocolates.some((c) => dist(c.x, c.y, x, y) < 42);
    if (!collides && !tooClose) {
      const kind = COLLECTIBLE_KINDS[Math.floor(Math.random() * COLLECTIBLE_KINDS.length)];
      chocolates.push({ x, y, taken: false, bobSeed: Math.random() * 10, kind });
    }
  }
  return chocolates;
}

/** Busca una posición libre dentro del camino para el bonus especial. */
export function findFreeSpot(level, avoid) {
  const obstacles = levelObstacles(level);
  for (let attempts = 0; attempts < 150; attempts++) {
    const { x, y } = randomPointInCorridor(level, 26);
    const collides = obstacles.some((o) => rectContains(o, x, y, 24));
    const tooCloseToAvoid = avoid && dist(avoid.x, avoid.y, x, y) < 80;
    if (!collides && !tooCloseToAvoid) return { x, y };
  }
  return null;
}

function rectContains(rect, x, y, pad) {
  return (
    x + pad > rect.x &&
    x - pad < rect.x + rect.w &&
    y + pad > rect.y &&
    y - pad < rect.y + rect.h
  );
}

function dist(x1, y1, x2, y2) {
  return Math.hypot(x1 - x2, y1 - y2);
}

/** Posición sobre el camino a `s` píxeles desde el inicio (para los guardias que patrullan). */
export function pathLength(path) {
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) total += Math.hypot(path[i + 1].x - path[i].x, path[i + 1].y - path[i].y);
  return total;
}

export function pointOnPath(path, s) {
  let left = Math.max(0, s);
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (left <= len) return { x: a.x + ((b.x - a.x) * left) / len, y: a.y + ((b.y - a.y) * left) / len };
    left -= len;
  }
  return { ...path[path.length - 1] };
}
