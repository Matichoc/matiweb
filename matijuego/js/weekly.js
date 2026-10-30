// Metas de la semana (pedido de la persona dueña, 29-oct-2026): reemplazan a "Mi meta", que eran 5 fijas y sin premio.
// Cada lunes salen 3 metas nuevas, sacadas de una lista larga. Cada una mide cuánto subió un contador acumulado desde el
// lunes (partidas, Matipuntos ganados, ⭐, visitas, golosinas a la mascota, sobres...), así no hay que tocar cada juego.
// Cada meta da Matipuntos y una ⭐; las 3 cumplidas abren el cofre de la semana (más Matipuntos y un sobre de figuritas).
import { earnCoins, saveProgress } from "./storage.js?v=630e2f1eb3";
import { adventureOf, addStars } from "./adventure.js?v=630e2f1eb3";

export const GOAL_REWARD = { coins: 80, stars: 1 };
export const CHEST_REWARD = { coins: 150, packs: 1 };

const wins = (p) => Object.values(p.sports || {}).reduce((n, s) => n + ((s && s.wins) || 0), 0);
const hasPet = (p) => (p.wardrobe.owned || []).some((id) => id.startsWith("pet_") || id === "ev_fantasma" || id === "ev_nieve" || id === "ev_corazon" || id === "ev_huevo" || id === "ev_volantin" || id === "ev_globito");

/** La lista de donde salen las metas. `val` es el contador acumulado; `can` dice si se puede pedir (p. ej. tener mascota). */
export const WEEKLY_POOL = [
  { id: "runs", icon: "🎮", text: "Juega {n} partidas", need: 15, val: (p) => p.stats.totalRuns || 0 },
  { id: "coins", icon: "🍫", text: "Gana {n} Matipuntos", need: 600, val: (p) => p.stats.totalCoinsEarned || 0 },
  { id: "stars", icon: "⭐", text: "Consigue {n} ⭐ para renovar el Pueblo", need: 8, val: (p) => adventureOf(p).starsEarned || 0 },
  { id: "visits", icon: "🏠", text: "Ayuda a {n} vecinos en sus casas", need: 4, val: (p) => p.stats.visits || 0 },
  { id: "treats", icon: "🍪", text: "Dale {n} golosinas a tu mascota", need: 4, val: (p) => p.stats.petTreats || 0, can: hasPet },
  { id: "petplay", icon: "⚽", text: "Juega {n} veces a la pelota con tu mascota", need: 5, val: (p) => p.stats.petPlays || 0, can: hasPet },
  { id: "packs", icon: "📖", text: "Abre {n} sobres de figuritas", need: 3, val: (p) => p.stats.packsOpened || 0 },
  { id: "hello", icon: "👋", text: "Saluda a {n} vecinos del Pueblo", need: 10, val: (p) => p.stats.townTalks || 0 },
  { id: "alfajores", icon: "✨", text: "Junta {n} alfajores dorados en el Pueblo", need: 20, val: (p) => p.stats.townItems || 0 },
  { id: "missions", icon: "🎯", text: "Cumple {n} misiones del día", need: 6, val: (p) => p.stats.missionsClaimed || 0 },
  { id: "gold", icon: "🪙", text: "Junta {n} monedas doradas en la Ciudad", need: 15, val: (p) => p.stats.ciudadGold || 0 },
  { id: "wins", icon: "🏆", text: "Gana {n} partidos de Pichanga o Básquet 2 contra 2", need: 2, val: wins },
  { id: "parkour", icon: "🧗", text: "Termina {n} etapas de Parkour Choco", need: 3, val: (p) => p.stats.parkourFinishes || 0 },
];

const p2 = (n) => String(n).padStart(2, "0");

/** El lunes de esta semana (hora del aparato), como "YYYY-MM-DD": es la llave de la semana. */
export function weekKey(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

function seeded(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0) / 4294967296);
}

/**
 * Las metas de esta semana (las arma el lunes, o la primera vez que se abre en la semana).
 * progress.weekly = { key, goals: [{ id, base, claimed }], chest }
 */
export function weeklyState(progress, now = new Date()) {
  const key = weekKey(now);
  let w = progress.weekly;
  if (!w || w.key !== key || !Array.isArray(w.goals)) {
    const rnd = seeded(`${key}:${progress._profileId || progress.playerName || ""}`);
    const pool = WEEKLY_POOL.filter((g) => !g.can || g.can(progress));
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    // no repetir la misma meta de la semana pasada si se puede
    const last = new Set((w && w.goals || []).map((g) => g.id));
    pool.sort((a, b) => (last.has(a.id) ? 1 : 0) - (last.has(b.id) ? 1 : 0));
    w = progress.weekly = { key, goals: pool.slice(0, 3).map((g) => ({ id: g.id, base: g.val(progress), claimed: false })), chest: false };
  }
  const goals = w.goals.map((g) => {
    const def = WEEKLY_POOL.find((x) => x.id === g.id);
    if (!def) return null;
    const have = Math.max(0, Math.min(def.need, def.val(progress) - g.base));
    return { ...def, text: def.text.replace("{n}", def.need.toLocaleString("es-CL")), have, done: have >= def.need, claimed: g.claimed };
  }).filter(Boolean);
  const allClaimed = goals.length > 0 && goals.every((g) => g.claimed);
  const ends = new Date(key + "T00:00:00");
  ends.setDate(ends.getDate() + 7);
  const daysLeft = Math.max(1, Math.ceil((ends - now) / 864e5));
  return { key, goals, chestReady: allClaimed && !w.chest, chestTaken: !!w.chest, daysLeft, ready: goals.filter((g) => g.done && !g.claimed).length };
}

/** Cobra el premio de una meta cumplida. Devuelve el premio o null. */
export function claimWeekly(progress, id, now = new Date()) {
  const st = weeklyState(progress, now);
  const g = st.goals.find((x) => x.id === id);
  if (!g || !g.done || g.claimed) return null;
  progress.weekly.goals.find((x) => x.id === id).claimed = true;
  earnCoins(progress, GOAL_REWARD.coins);
  addStars(progress, GOAL_REWARD.stars);
  saveProgress(progress);
  return GOAL_REWARD;
}

/** Abre el cofre de la semana (con las 3 metas cobradas). Devuelve el premio o null. */
export function openWeeklyChest(progress, now = new Date()) {
  const st = weeklyState(progress, now);
  if (!st.chestReady) return null;
  progress.weekly.chest = true;
  earnCoins(progress, CHEST_REWARD.coins);
  progress.packs = (progress.packs || 0) + CHEST_REWARD.packs;
  saveProgress(progress);
  return CHEST_REWARD;
}
