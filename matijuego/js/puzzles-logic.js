// Lógica pura (sin pantalla) de los juegos chicos de las puertas del Pueblo Matichoc:
// el Gato contra la máquina, el Mini Sudoku de 4×4 y el Cachipún. Se puede probar sola: scripts/qa/puzzles-logica.mjs

// ---------- Gato (tres en raya) ----------
// El tablero es un arreglo de 9 casilleros: 0 = vacío, 1 = jugador, 2 = máquina.

const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

/** Quién ganó: 1, 2, o 0 si todavía nadie. */
export function gatoWinner(b) {
  for (const [x, y, z] of LINES) if (b[x] && b[x] === b[y] && b[x] === b[z]) return b[x];
  return 0;
}

export const gatoFull = (b) => b.every((v) => v !== 0);

/** Casillero donde `who` completaría una línea (o -1). */
function finishing(b, who) {
  for (const [x, y, z] of LINES) {
    const cells = [x, y, z];
    const mine = cells.filter((i) => b[i] === who).length;
    const empty = cells.filter((i) => b[i] === 0);
    if (mine === 2 && empty.length === 1) return empty[0];
  }
  return -1;
}

/**
 * Jugada de la máquina (juega con el 2). Gana si puede, bloquea casi siempre, y si no prefiere el centro, las esquinas y los lados.
 * `mistakes` = probabilidad (0 a 1) de distraerse y jugar un casillero cualquiera: así una niña puede ganarle.
 * `rand` se puede cambiar para probar.
 */
export function gatoMachineMove(b, { mistakes = 0.2, rand = Math.random } = {}) {
  const empty = [];
  b.forEach((v, i) => { if (!v) empty.push(i); });
  if (!empty.length) return -1;
  const win = finishing(b, 2);
  if (win >= 0) return win;
  if (rand() < mistakes) return empty[Math.floor(rand() * empty.length)];
  const block = finishing(b, 1);
  if (block >= 0) return block;
  if (!b[4]) return 4;
  const corners = [0, 2, 6, 8].filter((i) => !b[i]);
  if (corners.length) return corners[Math.floor(rand() * corners.length)];
  return empty[Math.floor(rand() * empty.length)];
}

// ---------- Mini Sudoku 4×4 ----------
// Un tablero es un arreglo de 16 números (0 = vacío, 1 a 4 = dibujo). Cada fila, columna y cuadro de 2×2 lleva los 4 dibujos una sola vez.

const BASE = [1, 2, 3, 4, 3, 4, 1, 2, 2, 1, 4, 3, 4, 3, 2, 1];

function shuffled(list, rand) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** Hay algún repetido en la fila, columna o cuadro de la casilla `i`? (solo mira casilleros llenos) */
export function sudokuConflict(b, i) {
  const v = b[i];
  if (!v) return false;
  const r = Math.floor(i / 4);
  const c = i % 4;
  for (let k = 0; k < 4; k++) {
    if (k !== c && b[r * 4 + k] === v) return true;
    if (k !== r && b[k * 4 + c] === v) return true;
  }
  const br = r - (r % 2);
  const bc = c - (c % 2);
  for (let dr = 0; dr < 2; dr++) for (let dc = 0; dc < 2; dc++) {
    const j = (br + dr) * 4 + bc + dc;
    if (j !== i && b[j] === v) return true;
  }
  return false;
}

export const sudokuSolved = (b) => b.every((v) => v >= 1 && v <= 4) && b.every((_, i) => !sudokuConflict(b, i));

/** Cuenta las soluciones (se detiene al llegar a `limit`). */
export function sudokuCount(b, limit = 2) {
  const i = b.indexOf(0);
  if (i < 0) return 1;
  let n = 0;
  for (let v = 1; v <= 4 && n < limit; v++) {
    b[i] = v;
    if (!sudokuConflict(b, i)) n += sudokuCount(b, limit - n);
    b[i] = 0;
  }
  return n;
}

/** Un sudoku nuevo: { puzzle, solution } con una sola solución y entre 6 y 8 dibujos de pista. */
export function sudokuNew({ rand = Math.random, clues = 7 } = {}) {
  const sym = shuffled([1, 2, 3, 4], rand);
  const bands = rand() < 0.5 ? [0, 1] : [1, 0];
  const stacks = rand() < 0.5 ? [0, 1] : [1, 0];
  const rows = bands.flatMap((b) => (rand() < 0.5 ? [b * 2, b * 2 + 1] : [b * 2 + 1, b * 2]));
  const cols = stacks.flatMap((s) => (rand() < 0.5 ? [s * 2, s * 2 + 1] : [s * 2 + 1, s * 2]));
  const solution = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) solution.push(sym[BASE[rows[r] * 4 + cols[c]] - 1]);
  const puzzle = solution.slice();
  for (const i of shuffled([...Array(16).keys()], rand)) {
    if (puzzle.filter(Boolean).length <= clues) break;
    const keep = puzzle[i];
    puzzle[i] = 0;
    if (sudokuCount(puzzle.slice(), 2) !== 1) puzzle[i] = keep; // si deja de tener una única solución, se devuelve la pista
  }
  return { puzzle, solution };
}

// ---------- Cachipún (piedra, papel o tijera) ----------
// 0 = piedra, 1 = papel, 2 = tijera. Devuelve 1 si gana `a`, -1 si gana `b`, 0 si empatan.
export function cachipun(a, b) {
  if (a === b) return 0;
  return (a - b + 3) % 3 === 1 ? 1 : -1;
}
