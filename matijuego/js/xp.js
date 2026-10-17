// Nivel del jugador según su XP (aparte para que cualquier módulo pueda usarlo sin depender de progression.js).

export const MAX_LEVEL = 60;
/** XP que hace falta para pasar del nivel `l` al siguiente. */
export const xpForLevel = (l) => 70 + 30 * l;

export function levelInfo(xp) {
  let level = 1;
  let left = Math.max(0, xp || 0);
  while (level < MAX_LEVEL && left >= xpForLevel(level)) { left -= xpForLevel(level); level++; }
  const need = level >= MAX_LEVEL ? 1 : xpForLevel(level);
  return { level, into: level >= MAX_LEVEL ? 1 : left, need };
}

