// Juegos que se canjean con Matipuntos: al juntar suficientes, el jugador los desbloquea desde el menú.
// Los precios viven aquí, en un solo lugar.
//
// Precio: ~1 semana de juego (se ganan unos 250–350 Matipuntos al día; ver docs/ECONOMIA.md).
// Para probar rápido se puede bajar a 300 (una sola línea: UNLOCK_PRICE).

import { spendCoins, saveProgress } from "./storage.js?v=b28a0715a9";
import { IS_DEMO } from "./demo.js?v=b28a0715a9";

const UNLOCK_PRICE = 2000; // ≈ una semana de juego

export const UNLOCK_COST = {
  futbol: UNLOCK_PRICE,
  dulces: UNLOCK_PRICE,
  aventura: UNLOCK_PRICE,
  ciudad: UNLOCK_PRICE,
};

export const needsUnlock = (gameId) => gameId in UNLOCK_COST;

/** En la demo de la web los juegos nuevos se pueden probar sin canje (con pocos niveles; ver js/demo.js). */
export function isUnlocked(progress, gameId) {
  if (!needsUnlock(gameId) || IS_DEMO) return true;
  return (progress.unlockedGames || []).includes(gameId);
}

/** Canjea el juego con Matipuntos. Devuelve true si se pudo. */
export function unlockGame(progress, gameId) {
  if (!needsUnlock(gameId) || isUnlocked(progress, gameId)) return false;
  if (!spendCoins(progress, UNLOCK_COST[gameId])) return false;
  progress.unlockedGames = [...(progress.unlockedGames || []), gameId];
  saveProgress(progress);
  return true;
}
