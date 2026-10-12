// Modo misiones de los juegos "sin fin" (Salto Choco, Autos y Parkour): 20 misiones por juego, de
// a una. Cada misión es una meta para una sola partida ("sube 60 metros", "junta 15 alfajores"...);
// al cumplirla aparece "¡Misión cumplida!" y se desbloquea la siguiente (ver js/campaign.js).
// Para cambiar o agregar misiones basta editar las tablas de abajo.

// Cada juego: las 5 clases de meta y sus 4 rondas de valores (de fácil a difícil).
const TABLES = {
  salto: [
    ["height", "Sube {n} metros", [60, 120, 200, 300]],
    ["items", "Junta {n} alfajores", [8, 15, 25, 40]],
    ["stomps", "Pisa {n} malvaviscos", [2, 4, 7, 10]],
    ["combo", "Haz un combo de {n}", [6, 12, 20, 30]],
    ["score", "Suma {n} puntos", [800, 1800, 3200, 5200]],
  ],
  autos: [
    ["dist", "Recorre {n} metros", [800, 1800, 3200, 5000]],
    ["items", "Junta {n} alfajores", [8, 16, 26, 40]],
    ["near", "Haz {n} roces cerca de otros autos", [3, 7, 12, 20]],
    ["combo", "Haz un combo de {n}", [6, 12, 20, 30]],
    ["score", "Suma {n} puntos", [250, 600, 1100, 1800]],
  ],
  parkour: [
    ["meters", "Corre {n} metros", [150, 300, 500, 800]],
    ["items", "Junta {n} alfajores", [10, 20, 35, 50]],
    ["worlds", "Llega al mundo {n}", [2, 3, 4, 6]],
    ["gold", "Junta {n} barras Matidubai", [1, 2, 4, 6]],
    ["score", "Suma {n} puntos", [300, 700, 1300, 2200]],
  ],
};

export const MISSION_GAMES = Object.keys(TABLES);

/** Las 20 misiones de un juego: [{ n, metric, target, text }]. */
export function missionList(gameId) {
  const table = TABLES[gameId];
  if (!table) return [];
  const out = [];
  for (let round = 0; round < 4; round++) {
    for (const [metric, text, values] of table) {
      out.push({ n: out.length + 1, metric, target: values[round], text: text.replace("{n}", values[round]) });
    }
  }
  return out;
}

export const missionFor = (gameId, n) => missionList(gameId)[n - 1] || null;
