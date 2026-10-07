// Piezas de "Tetris de Productos": las 7 formas clásicas, cada una vestida
// con los colores de una golosina/marca de Matichoc en vez de los colores
// genéricos de Tetris.

// Cada forma tiene 4 estados de rotación, como offsets dentro de una caja 4x4.
export const SHAPES = {
  I: [
    [[0, 1], [1, 1], [2, 1], [3, 1]],
    [[2, 0], [2, 1], [2, 2], [2, 3]],
    [[0, 2], [1, 2], [2, 2], [3, 2]],
    [[1, 0], [1, 1], [1, 2], [1, 3]],
  ],
  O: [
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
  ],
  T: [
    [[1, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [1, 2]],
    [[1, 0], [0, 1], [1, 1], [1, 2]],
  ],
  S: [
    [[1, 0], [2, 0], [0, 1], [1, 1]],
    [[1, 0], [1, 1], [2, 1], [2, 2]],
    [[1, 1], [2, 1], [0, 2], [1, 2]],
    [[0, 0], [0, 1], [1, 1], [1, 2]],
  ],
  Z: [
    [[0, 0], [1, 0], [1, 1], [2, 1]],
    [[2, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [1, 2], [2, 2]],
    [[1, 0], [0, 1], [1, 1], [0, 2]],
  ],
  J: [
    [[0, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [2, 2]],
    [[1, 0], [1, 1], [0, 2], [1, 2]],
  ],
  L: [
    [[2, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [1, 2], [2, 2]],
    [[0, 1], [1, 1], [2, 1], [0, 2]],
    [[0, 0], [1, 0], [1, 1], [1, 2]],
  ],
};

export const PIECE_TYPES = Object.keys(SHAPES);

// Golosina/color asociada a cada forma (misma paleta que las canchas de
// "Recolecta y Corre" para que la plataforma se sienta consistente).
export const PIECE_STYLE = {
  I: { name: "Cuchuflín", fill: "#e0ab52", dark: "#a9702f" },
  O: { name: "Alfajor", fill: "#d9a463", dark: "#a9702f" },
  T: { name: "Barquillo", fill: "#c98a4b", dark: "#8a5a36" },
  S: { name: "Choco Claro", fill: "#8a5a36", dark: "#5e3c22" },
  Z: { name: "Choco Oscuro", fill: "#5a3320", dark: "#3a2010" },
  J: { name: "Dorado Matichoc", fill: "#FFC800", dark: "#c99900" },
  L: { name: "Cacao Fucsia", fill: "#D4216C", dark: "#9c1650" },
};

const SPECIAL_CHANCE = 1 / 12;

/** Bolsa "7-bag": cada tipo aparece exactamente una vez antes de repetirse. */
export function createBag() {
  const bag = [...PIECE_TYPES];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

export function spawnPiece(type) {
  return {
    type,
    rotation: 0,
    x: 3,
    y: -1,
    special: Math.random() < SPECIAL_CHANCE,
  };
}

export function pieceCells(piece) {
  return SHAPES[piece.type][piece.rotation];
}
