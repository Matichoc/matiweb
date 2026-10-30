// Calendario de recompensas del mes: cada día hay una sorpresa distinta (Matipuntos, energía, un sobre de figuritas,
// un cofre del tesoro listo, XP…) y un par de días especiales con 100 de energía. El reparto es al azar pero es el mismo
// para todos los jugadores ese mes (se genera con el mes como semilla), y los premios crecen un poco con tu nivel.
// Solo se puede cobrar el de hoy: los días que pasaron sin entrar se pierden (así da gusto volver todos los días).

import { saveProgress, earnCoins } from "./storage.js?v=4754985988";
import { addEnergy, energyOf } from "./energy.js?v=4754985988";
import { levelInfo, addXp } from "./progression.js?v=4754985988";

const rngOf = (str) => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  let s = (h >>> 0) % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
};

export const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
export const daysInMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();

/** El plan de premios del mes: un arreglo con un premio por día (índice 0 = día 1). */
export function monthPlan(date = new Date()) {
  const n = daysInMonth(date);
  const rnd = rngOf(`calendario-${monthKey(date)}`);
  // se reparte una "baraja" con proporciones parejas (para que ningún mes salga muy pobre ni muy rico) y se baraja al azar
  const share = [["coins", 0.34], ["energy25", 0.24], ["pack", 0.14], ["chest", 0.12], ["xp", 0.09], ["bigcoins", 0.07]];
  const deck = [];
  for (const [t, f] of share) for (let i = 0; i < Math.round(n * f); i++) deck.push(t);
  while (deck.length < n) deck.push("coins");
  deck.length = n;
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  const plan = deck.map((type) => ({ type }));
  // dos días especiales con 100 de energía (uno en la 2ª semana y otro en la 4ª)
  const special = [6 + Math.floor(rnd() * 5), 20 + Math.floor(rnd() * 6)].filter((i) => i < n);
  for (const i of special) plan[i] = { type: "energy100", special: true };
  return plan;
}

/** Lo que vale cada premio para este jugador (crece con el nivel). */
export function rewardInfo(type, progress) {
  const lv = progress ? levelInfo(progress.xp).level : 1;
  const k = 1 + Math.min(lv, 40) * 0.03;
  const r5 = (x) => Math.round((x * k) / 5) * 5;
  switch (type) {
    case "coins": return { type, icon: "🍫✨", label: `${r5(30)} Matipuntos`, short: `${r5(30)}`, n: r5(30) };
    case "bigcoins": return { type, icon: "💰", label: `${r5(120)} Matipuntos`, short: `${r5(120)}`, n: r5(120) };
    case "energy25": return { type, icon: "⚡", label: "25 de energía", short: "25", n: 25 };
    case "energy100": return { type, icon: "🔋", label: "¡100 de energía!", short: "100", n: 100 };
    case "pack": return { type, icon: "🎴", label: "Un sobre de figuritas", short: "sobre", n: 1 };
    case "chest": return { type, icon: "🧰", label: "Un cofre del tesoro", short: "cofre", n: 1 };
    case "xp": return { type, icon: "⭐", label: `${Math.round(60 * k)} de XP`, short: `${Math.round(60 * k)}`, n: Math.round(60 * k) };
    default: return { type: "coins", icon: "🍫✨", label: "Matipuntos", short: "?", n: 20 };
  }
}

/** Estado del calendario del jugador (se reinicia solo al cambiar de mes). */
export function calendarOf(progress, date = new Date()) {
  const mk = monthKey(date);
  if (!progress.calendar || progress.calendar.month !== mk) progress.calendar = { month: mk, claimed: [] };
  if (!Array.isArray(progress.calendar.claimed)) progress.calendar.claimed = [];
  return progress.calendar;
}

export function canClaimCalendar(progress, date = new Date()) {
  return !calendarOf(progress, date).claimed.includes(date.getDate());
}

/** Cobra el premio de hoy. Devuelve { type, icon, label, ... } o null si ya lo cobraste. */
export function claimCalendar(progress, date = new Date()) {
  const cal = calendarOf(progress, date);
  const day = date.getDate();
  if (cal.claimed.includes(day)) return null;
  const type = monthPlan(date)[day - 1].type;
  const info = rewardInfo(type, progress);
  cal.claimed.push(day);
  let gained = info.n;
  if (type === "coins" || type === "bigcoins") earnCoins(progress, info.n);
  else if (type === "energy25" || type === "energy100") gained = addEnergy(progress, info.n, "calendario", { calendar: true });
  else if (type === "pack") progress.packs = (progress.packs || 0) + 1;
  else if (type === "chest") energyOf(progress).chestAt = Date.now() - 1; // el cofre del tesoro queda listo para abrir
  else if (type === "xp") addXp(progress, info.n);
  saveProgress(progress);
  return { ...info, gained, day };
}
