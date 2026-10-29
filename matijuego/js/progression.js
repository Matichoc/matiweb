// Progresión: lo que hace que dé ganas de volver todos los días.
//   · XP y niveles (cada partida da XP; cada nivel da Matipuntos, un sobre y a veces un regalo)
//   · 3 misiones diarias distintas cada día
//   · Álbum de Chocolates: figuritas de los productos Matichoc que salen de los sobres
//
// Todo se guarda por perfil dentro de `progress` (xp, packs, album, daily) y se paga solo
// con Matipuntos, sin compras reales.

import { earnCoins, saveProgress, todayKey, getBestScore } from "./storage.js?v=fe364939c0";
import { addEnergy } from "./energy.js?v=fe364939c0";
import { getItem } from "./wardrobe-data.js?v=fe364939c0";
import { activeEvent, addEventTokens } from "./events.js?v=fe364939c0";
import { isUnlocked } from "./unlocks.js?v=fe364939c0";

// ---------- partidas ----------

/** Puntaje que equivale a 1 Matipunto al terminar una partida (cada juego puntúa distinto). */
export const RUN_DIVISOR = { tetris: 40, basquet_tiros: 12, porristas: 8, salto: 25, autos: 30, memoria: 10, parkour: 40, futbol: 10, dulces: 15, merge: 300, aventura: 20, ciudad: 12, pichanga: 10, basquet2v2: 6 };
const RUN_BONUS_CAP = 60;

export function runBonus(gameId, score) {
  if (!(score > 0)) return 0;
  return Math.max(1, Math.min(RUN_BONUS_CAP, Math.floor(score / (RUN_DIVISOR[gameId] || 20))));
}

export const GAME_NAMES = {
  parkour: "Parkour Choco", recolecta: "Recolecta y Corre", salto: "Salto Choco", autos: "Autos de Chocolate",
  tetris: "Bloques de Productos", memoria: "Memoria Matichoc", basquet_tiros: "Lanzamientos de Básquet",
  porristas: "Saltos de Porristas", creador: "Crea tu Chocolate", fps3d: "Choco Blaster",
  futbol: "Fútbol Choco", dulces: "Choco Match", merge: "Mati Merge", aventura: "Aventura Choco", ciudad: "Ciudad Choco",
  pichanga: "Pichanga Choco", basquet2v2: "Básquet 2 contra 2",
};

// ---------- niveles ----------

import { MAX_LEVEL, xpForLevel, levelInfo } from "./xp.js?v=fe364939c0";
import { onGamePlayed, seasonalOnPlay } from "./adventure.js?v=fe364939c0";
export { MAX_LEVEL, xpForLevel, levelInfo };

/** Regalos de nivel: objetos del guardarropa que se desbloquean gratis. */
export const LEVEL_GIFTS = {
  3: "hair_colitas", 5: "hat_gorro", 8: "gl_estrella", 10: "back_capa_rosa", 12: "pet_alfajorito", 13: "neck_bufanda",
  15: "sh_neon", 18: "face_estrellas", 20: "back_alas", 25: "hat_galera", 30: "hc_oro", 35: "pet_nubi", 40: "trail_arcoiris", 50: "hat_corona",
};

// quien quiera enterarse de lo que pasa (subir de nivel, misión cumplida...) se suscribe aquí
const listeners = new Set();
export function onProgressEvent(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
const emit = (ev) => listeners.forEach((fn) => { try { fn(ev); } catch (e) { /* un aviso que falla no debe romper el juego */ } });

export function addXp(progress, amount) {
  const before = levelInfo(progress.xp).level;
  progress.xp = (progress.xp || 0) + amount;
  const after = levelInfo(progress.xp).level;
  const ups = [];
  for (let l = before + 1; l <= after; l++) {
    const coins = 20 + 5 * l;
    earnCoins(progress, coins);
    progress.packs = (progress.packs || 0) + 1;
    const giftId = LEVEL_GIFTS[l];
    let gift = null;
    if (giftId && getItem(giftId)) {
      if (!progress.wardrobe.owned.includes(giftId)) progress.wardrobe.owned.push(giftId);
      gift = getItem(giftId);
    }
    addEnergy(progress, 10, "nivel");
    ups.push({ level: l, coins, gift });
    emit({ type: "level", level: l, coins, gift });
  }
  return ups;
}

// ---------- misiones diarias ----------

const SCORE_BASE = { tetris: 250, basquet_tiros: 60, salto: 700, autos: 700, parkour: 300, porristas: 60, memoria: 100, recolecta: 80, futbol: 400, dulces: 1500, aventura: 800, ciudad: 600 };
const PLAY_GAMES = ["parkour", "salto", "autos", "tetris", "memoria", "basquet_tiros", "porristas", "recolecta", "futbol", "dulces", "aventura", "ciudad"];

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function missionText(m) {
  switch (m.kind) {
    case "plays": return `Juega ${m.target} partidas`;
    case "diverse": return `Prueba ${m.target} juegos distintos`;
    case "game": return `Juega ${GAME_NAMES[m.game]}`;
    case "score": return `Consigue ${m.target} puntos en ${GAME_NAMES[m.game]}`;
    case "meters": return `Corre ${m.target} m en el Mundo infinito`;
    case "coins": return `Gana ${m.target} Matipuntos hoy`;
    default: return "Misión";
  }
}
export const missionLabel = missionText;

function makeMissions(progress, today) {
  const r = rng(hashStr(`${progress._profileId || "p"}|${today}`));
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  // los juegos que se canjean con Matipuntos solo salen en las misiones si ya los desbloqueaste
  const playable = PLAY_GAMES.filter((g) => isUnlocked(progress, g));
  const g1 = pick(playable);
  let g2 = pick(playable.filter((g) => g !== g1));
  const scoreGame = pick(Object.keys(SCORE_BASE).filter((g) => isUnlocked(progress, g)));
  const best = getBestScore(progress, scoreGame) || 0;
  const base = SCORE_BASE[scoreGame];
  const target = Math.min(base * 3, Math.max(base, Math.round((best * 0.7) / 10) * 10));
  const bank = [
    { kind: "plays", target: 3, coins: 15, xp: 30 },
    { kind: "diverse", target: 2, coins: 15, xp: 30 },
    { kind: "game", game: g1, target: 1, coins: 10, xp: 25 },
    { kind: "score", game: scoreGame, target, coins: 25, xp: 45 },
    { kind: "meters", target: 150 + 50 * Math.floor(r() * 4), coins: 25, xp: 45 },
    { kind: "coins", target: 30, coins: 20, xp: 35 },
  ];
  // una de "jugar", una de "puntaje/metros" y una de variedad
  const a = pick([bank[0], bank[1]]);
  const b = pick([bank[3], bank[4]]);
  const c = pick([bank[2], bank[5], { kind: "game", game: g2, target: 1, coins: 10, xp: 25 }]);
  return [a, b, c].map((m, i) => ({ id: `${today}-${i}`, ...m, claimed: false }));
}

/** Deja listas las misiones de hoy (si es un día nuevo, genera otras y reinicia los contadores). */
export function ensureDaily(progress) {
  const today = todayKey();
  if (!progress.daily || progress.daily.date !== today) {
    progress.daily = {
      date: today,
      plays: 0, games: [], best: {}, meters: 0, coinsStart: progress.stats.totalCoinsEarned || 0,
      chest: false,
      missions: makeMissions(progress, today),
    };
    saveProgress(progress);
  }
  return progress.daily;
}

export function missionProgress(progress, m) {
  const d = ensureDaily(progress);
  switch (m.kind) {
    case "plays": return Math.min(m.target, d.plays);
    case "diverse": return Math.min(m.target, d.games.length);
    case "game": return d.games.includes(m.game) ? 1 : 0;
    case "score": return Math.min(m.target, d.best[m.game] || 0);
    case "meters": return Math.min(m.target, d.meters);
    case "coins": return Math.min(m.target, Math.max(0, (progress.stats.totalCoinsEarned || 0) - d.coinsStart));
    default: return 0;
  }
}
export const missionDone = (progress, m) => missionProgress(progress, m) >= m.target;

/** Reclama una misión cumplida: Matipuntos + XP. */
export function claimMission(progress, index) {
  const d = ensureDaily(progress);
  const m = d.missions[index];
  if (!m || m.claimed || !missionDone(progress, m)) return null;
  m.claimed = true;
  progress.stats.missionsClaimed = (progress.stats.missionsClaimed || 0) + 1;
  earnCoins(progress, m.coins);
  addEnergy(progress, 5, "misión");
  const ups = addXp(progress, m.xp);
  saveProgress(progress);
  return { coins: m.coins, xp: m.xp, ups };
}

export function canClaimChest(progress) {
  const d = ensureDaily(progress);
  return !d.chest && d.missions.every((m) => m.claimed);
}
/** Cofre por completar las 3 misiones del día. */
export function claimChest(progress) {
  if (!canClaimChest(progress)) return null;
  progress.daily.chest = true;
  earnCoins(progress, 30);
  addEnergy(progress, 15, "cofre del día");
  progress.packs = (progress.packs || 0) + 1;
  const ups = addXp(progress, 40);
  saveProgress(progress);
  return { coins: 30, xp: 40, packs: 1, ups };
}

/** ¿Hay algo para reclamar? (para el puntito de aviso del menú) */
export function hasPending(progress) {
  const d = ensureDaily(progress);
  return (progress.packs || 0) > 0 || canClaimChest(progress) || d.missions.some((m) => !m.claimed && missionDone(progress, m));
}

// ---------- álbum ----------
// Las figuritas, los sobres y las repetidas viven en js/album.js (aquí se re-exportan para el resto de la app).
export { STICKERS, PAGES, TOTAL as ALBUM_TOTAL, albumCount, pageStatus, ALBUM_MILESTONES, openPack, spareCount, sparePoints, sellValue, sellSpares, tradeFor, tradeCost, spareOf, SELL_NORMAL, SELL_FOIL, TRADE_NORMAL, TRADE_FOIL, SEASON_PAGES, SEASON_STICKERS, activeSeasonPage, obtainable, buySticker, buyCost } from "./album.js?v=fe364939c0";

// ---------- el gancho que se llama al terminar una partida ----------

/**
 * Registra una partida terminada: da XP, avanza las misiones del día y de vez en cuando
 * regala un sobre. Devuelve lo que ganó para mostrarlo.
 * `info` puede traer datos del modo de juego (por ejemplo { meters } en el Mundo infinito).
 */
export function recordRun(progress, gameId, score, info = {}) {
  const d = ensureDaily(progress);
  const first = d.plays === 0;
  d.plays++;
  if (!d.games.includes(gameId)) d.games.push(gameId);
  // contadores de por vida para los logros (js/achievements.js)
  const st = progress.stats;
  st.runsBy = st.runsBy || {};
  st.runsBy[gameId] = (st.runsBy[gameId] || 0) + 1;
  if (st.lastPlayDay !== d.date) {
    st.lastPlayDay = d.date;
    st.playDays = (st.playDays || 0) + 1;
    st.playDayList = [...(st.playDayList || []), d.date].slice(-30); // para ver en qué días jugó (panel del creador)
  }
  d.best[gameId] = Math.max(d.best[gameId] || 0, Math.round(score || 0));
  if (info.meters) d.meters = Math.max(d.meters, info.meters);
  progress.stats.totalRuns = (progress.stats.totalRuns || 0) + 1;
  // contadores de los juegos nuevos (para sus logros)
  if (info.goals) st.goalsTotal = (st.goalsTotal || 0) + info.goals;
  if (info.dianas) st.dianasTotal = (st.dianasTotal || 0) + info.dianas;
  if (info.mode === "ata" && info.saves) st.ataSaves = (st.ataSaves || 0) + info.saves;
  if (info.stomps) st.stompsTotal = (st.stompsTotal || 0) + info.stomps;
  if (info.coins && gameId === "aventura") st.aventuraCoins = (st.aventuraCoins || 0) + info.coins;
  if (info.specials) st.dulcesSpecials = (st.dulcesSpecials || 0) + info.specials;

  let xp = 20 + Math.min(40, Math.floor(((score || 0) / (RUN_DIVISOR[gameId] || 20)) * 0.8));
  if (first) xp += 20; // primera partida del día
  let pack = false;
  if (progress.stats.totalRuns % 5 === 0) { progress.packs = (progress.packs || 0) + 1; pack = true; }
  const ups = addXp(progress, xp);
  // durante un evento de temporada cada partida también da fichas del evento
  const ev = activeEvent();
  let tokens = 0;
  if (ev) { tokens = 2; addEventTokens(progress, ev.id, tokens); }

  const done = d.missions.filter((m) => !m.claimed && !m.notified && missionDone(progress, m));
  for (const m of done) m.notified = true;
  if (done.length) emit({ type: "mission", missions: done });
  if (pack) emit({ type: "pack" });
  // aventura "Renovar el Pueblo": cada partida (gane o pierda) da ⭐ para las tareas de las zonas
  const stars = onGamePlayed(progress, gameId);
  if (stars) emit({ type: "stars", stars });
  // reto opcional de la temporada (una vez por evento y por año): da fichas del evento de siempre, no una moneda nueva
  const seasonTokens = seasonalOnPlay(progress, ev, gameId);
  if (seasonTokens) { addEventTokens(progress, ev.id, seasonTokens); emit({ type: "season", event: ev, tokens: seasonTokens }); }
  saveProgress(progress);
  return { xp, first, ups, pack, missionsDone: done.length, tokens, eventToken: ev ? ev.token : "", stars };
}
