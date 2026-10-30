// Cuidar a la mascota (la que lleva puesta el Matichico): tiene 🍗 hambre y 💖 ánimo, que bajan solos con las horas.
// Se le dan golosinas (se compran con Matipuntos), se la acaricia y se juega a tirarle la pelota. Cuando está feliz
// (bien comida y contenta) baila y a veces encuentra Matipuntos (hasta 3 veces al día).
// El estado de cada mascota se guarda en progress.petCare[idDeLaMascota] = { food, joy, at, day, pats, plays, finds }.
import { earnCoins, spendCoins, saveProgress, todayKey } from "./storage.js?v=cfffb722e8";

export const TREATS = [
  { id: "galleta", icon: "🍪", name: "Galletita", cost: 15, food: 30, joy: 0 },
  { id: "bombon", icon: "🍫", name: "Bombón", cost: 35, food: 60, joy: 15 },
];

const FOOD_PER_HOUR = 4; // con la pancita llena (100) tiene hambre (<25) en ~19 horas
const JOY_PER_HOUR = 5; // y se aburre (<30) en ~14 horas sin jugar
const PAT_JOY = 6;
const PLAY_JOY = 12;
const PATS_A_DAY = 10; // caricias que suben el ánimo cada día (después igual la quiere, pero ya no cuenta)
const PLAYS_A_DAY = 8;
const FINDS_A_DAY = 3;

const clamp100 = (v) => Math.max(0, Math.min(100, v));

/** El estado guardado de la mascota, ya con lo que bajó desde la última vez. */
function care(progress, petId, now = Date.now()) {
  progress.petCare = progress.petCare || {};
  let s = progress.petCare[petId];
  if (!s) s = progress.petCare[petId] = { food: 70, joy: 70, at: now, day: "", pats: 0, plays: 0, finds: 0 };
  const h = Math.max(0, (now - (s.at || now)) / 3600000);
  if (h > 0) {
    s.food = clamp100(s.food - h * FOOD_PER_HOUR);
    s.joy = clamp100(s.joy - h * JOY_PER_HOUR);
    s.at = now;
  }
  const day = todayKey();
  if (s.day !== day) { s.day = day; s.pats = 0; s.plays = 0; s.finds = 0; }
  return s;
}

/** Cómo está: { food, joy, mood, ask, label } — ask es lo que pide en su globito (o null). */
export function petState(progress, petId, now) {
  const s = care(progress, petId, now);
  const food = Math.round(s.food);
  const joy = Math.round(s.joy);
  if (food < 25) return { food, joy, mood: "hambre", ask: "🍪", label: "Tiene hambre" };
  if (joy < 30) return { food, joy, mood: "aburrida", ask: "⚽", label: "Quiere jugar" };
  if (food >= 60 && joy >= 70) return { food, joy, mood: "feliz", ask: null, label: "¡Está feliz!" };
  return { food, joy, mood: "bien", ask: null, label: "Está bien" };
}

/** Después de cuidarla: si quedó feliz, a veces encuentra Matipuntos. Devuelve cuántos (0 si nada). */
function maybeFind(progress, petId, s, rnd) {
  if (s.food < 60 || s.joy < 70 || s.finds >= FINDS_A_DAY) return 0;
  if (rnd() > 0.35) return 0;
  s.finds++;
  const coins = 10 + Math.floor(rnd() * 3) * 5; // 10, 15 o 20
  earnCoins(progress, coins);
  return coins;
}

/** Darle una golosina (se paga con Matipuntos). { ok, need?, full?, found } */
export function feedPet(progress, petId, treatId, rnd = Math.random) {
  const t = TREATS.find((x) => x.id === treatId);
  if (!t) return { ok: false };
  const s = care(progress, petId);
  if (s.food >= 95) return { ok: false, full: true };
  if (!spendCoins(progress, t.cost)) return { ok: false, need: t.cost - progress.coins };
  s.food = clamp100(s.food + t.food);
  s.joy = clamp100(s.joy + t.joy);
  if (progress.stats) progress.stats.petTreats = (progress.stats.petTreats || 0) + 1; // metas de la semana
  const found = maybeFind(progress, petId, s, rnd);
  saveProgress(progress);
  return { ok: true, treat: t, found };
}

/** Acariciarla. { ok, found } */
export function patPet(progress, petId, rnd = Math.random) {
  const s = care(progress, petId);
  if (s.pats < PATS_A_DAY) { s.pats++; s.joy = clamp100(s.joy + PAT_JOY); }
  const found = maybeFind(progress, petId, s, rnd);
  saveProgress(progress);
  return { ok: true, found };
}

/** Trajo la pelota de vuelta. { ok, found } */
export function playedWithPet(progress, petId, rnd = Math.random) {
  const s = care(progress, petId);
  if (s.plays < PLAYS_A_DAY) { s.plays++; s.joy = clamp100(s.joy + PLAY_JOY); }
  s.food = clamp100(s.food - 2); // jugar da hambre
  if (progress.stats) progress.stats.petPlays = (progress.stats.petPlays || 0) + 1; // metas de la semana
  const found = maybeFind(progress, petId, s, rnd);
  saveProgress(progress);
  return { ok: true, found };
}
