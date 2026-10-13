// Estado persistente compartido entre el hub y todos los juegos (localStorage).
// El personaje, sus atuendos y las monedas Chocolate Dubai son globales a toda
// la plataforma; el puntaje y el ranking se llevan por juego (ver GAMES_CATALOG).
// Todo el progreso vive dentro de un "perfil" (ver js/profiles.js), para que
// varias personas puedan jugar desde el mismo navegador sin mezclar su avance.

import { getItem, EMPTY_LOOK } from "./wardrobe-data.js?v=ffbc2f0677";
import { queueSync } from "./online.js?v=ffbc2f0677";

const SAVE_PREFIX = "matichoc_save_v3_profile_";
const DEFAULT_OUTFIT = "polera";
const MAX_LEADERBOARD = 10;

export function storageKeyForProfile(profileId) {
  return `${SAVE_PREFIX}${profileId}`;
}

function defaultProgress() {
  return {
    playerName: "",
    selectedCharacterId: null,
    // Guardarropa (ver js/wardrobe-data.js): objetos comprados (compartidos por todos los
    // Matichicos) y lo que lleva puesto cada uno.
    wardrobe: { owned: [], looks: {} }, // looks: { [characterId]: { hair, hat, outfit, ... } }
    house: { owned: [], placed: {}, layout: null, size: 0 }, // Mi Casa (ver js/house-data.js)
    unlockedGames: [], // juegos canjeados con Matipuntos (ver js/unlocks.js)
    eventTokens: {}, // fichas de eventos de temporada: { [idEvento]: n }
    campaign: {}, // niveles por juego: { [idJuego]: { unlocked, stars: { nivel: n } } } (js/campaign.js)
    missionsDone: {}, // misiones de cada juego ya cumplidas: { [idJuego]: [n, ...] } (js/missions.js)
    xp: 0, // experiencia total (ver js/progression.js)
    packs: 1, // sobres de figuritas sin abrir (empieza con uno de regalo)
    album: {}, // { [idFigurita]: cuántas tiene }
    albumClaimed: [], // hitos del álbum ya cobrados
    daily: null, // misiones de hoy
    coins: 0, // Matipuntos: los puntos que se ganan jugando y se gastan en la tienda
    unlockedLevel: 0, // progreso dentro de "Recolecta y Corre"
    bestScores: {}, // { [gameId]: number }
    leaderboards: {}, // { [gameId]: [{ name, score, date }] }
    stats: { totalCoinsEarned: 0 },
    dailyStreak: 0,
    lastDailyRewardDate: null, // "YYYY-MM-DD"
    claimedAchievements: [], // [achievementId, ...]
    creations: [], // "Mis creaciones" de Crea tu Chocolate (ver js/creador-data.js)
    creatorChallengeDate: null, // "YYYY-MM-DD" del último reto del día cumplido
  };
}

export const MAX_CREATIONS = 12;

/** Lee el guardarropa guardado; si viene de la versión anterior (atuendos por personaje) lo migra. */
function normalizeWardrobe(parsed) {
  const w = parsed.wardrobe || {};
  const owned = new Set(Array.isArray(w.owned) ? w.owned : []);
  const looks = {};
  for (const [id, look] of Object.entries(w.looks || {})) looks[id] = { ...look };
  // migración: antes la tienda guardaba `ownedOutfits` y `equippedOutfit` por personaje
  for (const list of Object.values(parsed.ownedOutfits || {})) for (const id of list) owned.add(id);
  for (const [charId, outfitId] of Object.entries(parsed.equippedOutfit || {})) {
    if (!looks[charId]) looks[charId] = {};
    if (!looks[charId].outfit) looks[charId].outfit = outfitId;
  }
  return { owned: [...owned], looks };
}

/** Carga (o crea) el progreso de un perfil. El id queda "pegado" al objeto
 * (no enumerable, así no se guarda dentro del JSON) para que saveProgress
 * sepa a qué perfil escribir sin que cada llamador tenga que pasarlo. */
export function loadProgress(profileId) {
  let progress;
  try {
    const raw = localStorage.getItem(storageKeyForProfile(profileId));
    const parsed = raw ? JSON.parse(raw) : {};
    progress = {
      ...defaultProgress(),
      ...parsed,
      wardrobe: normalizeWardrobe(parsed),
      bestScores: { ...parsed.bestScores },
      leaderboards: { ...parsed.leaderboards },
      stats: { ...defaultProgress().stats, ...parsed.stats },
      claimedAchievements: parsed.claimedAchievements || [],
      album: { ...parsed.album },
      eventTokens: { ...parsed.eventTokens },
      campaign: JSON.parse(JSON.stringify(parsed.campaign || {})),
      missionsDone: JSON.parse(JSON.stringify(parsed.missionsDone || {})),
      house: {
        owned: [...((parsed.house && parsed.house.owned) || [])],
        placed: { ...((parsed.house && parsed.house.placed) || {}) },
        layout: parsed.house && Array.isArray(parsed.house.layout) ? parsed.house.layout.map((f) => ({ ...f })) : null,
        size: (parsed.house && parsed.house.size) || 0,
      },
      unlockedGames: Array.isArray(parsed.unlockedGames) ? [...parsed.unlockedGames] : [],
      albumClaimed: parsed.albumClaimed || [],
      packs: parsed.packs ?? 1,
      creations: Array.isArray(parsed.creations) ? parsed.creations.slice(0, MAX_CREATIONS) : [],
    };
  } catch (e) {
    progress = defaultProgress();
  }
  Object.defineProperty(progress, "_profileId", { value: profileId, enumerable: false });
  return progress;
}

export function saveProgress(progress) {
  queueSync(progress); // ranking del creador (apagado mientras js/online-config.js esté vacío)
  try {
    localStorage.setItem(storageKeyForProfile(progress._profileId), JSON.stringify(progress));
  } catch (e) {
    /* almacenamiento no disponible: se ignora silenciosamente */
  }
}

/** ¿Es del jugador este objeto del guardarropa? ("" = el estilo normal, siempre disponible). */
export function ownsItem(progress, itemId) {
  if (!itemId) return true;
  const item = getItem(itemId);
  if (!item) return false;
  return item.price === 0 || progress.wardrobe.owned.includes(itemId);
}

/** Lo que lleva puesto un Matichico (con los valores por defecto para lo que no se haya elegido). */
export function getLook(progress, characterId) {
  return { ...EMPTY_LOOK, ...(progress.wardrobe.looks[characterId] || {}) };
}

export function equippedOutfitId(progress, characterId) {
  return getLook(progress, characterId).outfit || "polera";
}

/** Se pone (o se quita, con itemId "") un objeto en la categoría `slot` del Matichico. */
export function equipItem(progress, characterId, slot, itemId) {
  if (!ownsItem(progress, itemId)) return false;
  if (!progress.wardrobe.looks[characterId]) progress.wardrobe.looks[characterId] = {};
  progress.wardrobe.looks[characterId][slot] = itemId;
  saveProgress(progress);
  return true;
}

/** Gasta Matipuntos. Punto único de pago: aquí se sumarán otras monedas en el futuro. */
export function spendCoins(progress, amount) {
  if (progress.coins < amount) return false;
  progress.coins -= amount;
  return true;
}

export function buyItem(progress, itemId) {
  const item = getItem(itemId);
  if (!item || item.event || ownsItem(progress, itemId)) return false; // los de evento se compran con fichas
  if (!spendCoins(progress, item.price)) return false;
  progress.wardrobe.owned.push(itemId);
  saveProgress(progress);
  return true;
}

export function getBestScore(progress, gameId) {
  return progress.bestScores[gameId] || 0;
}

/** Actualiza el mejor puntaje de un juego si corresponde; devuelve true si mejoró. */
export function reportScore(progress, gameId, score) {
  if (score > getBestScore(progress, gameId)) {
    progress.bestScores[gameId] = score;
    saveProgress(progress);
    return true;
  }
  return false;
}

export function getLeaderboard(progress, gameId) {
  return progress.leaderboards[gameId] || [];
}

export function addToLeaderboard(progress, gameId, name, score) {
  if (!progress.leaderboards[gameId]) progress.leaderboards[gameId] = [];
  const board = progress.leaderboards[gameId];
  board.push({ name: name || "Jugador", score, date: new Date().toISOString() });
  board.sort((a, b) => b.score - a.score);
  progress.leaderboards[gameId] = board.slice(0, MAX_LEADERBOARD);
  saveProgress(progress);
}

/** Suma monedas y lleva la cuenta de cuántas se han ganado en total (para logros). */
export function earnCoins(progress, amount) {
  progress.coins += amount;
  progress.stats.totalCoinsEarned += amount;
}

/** Reclama un logro (ver js/achievements.js) si está cumplido y no reclamado. */
export function claimAchievement(progress, achievement) {
  if (progress.claimedAchievements.includes(achievement.id)) return false;
  if (!achievement.isDone(progress)) return false;
  progress.claimedAchievements.push(achievement.id);
  earnCoins(progress, achievement.reward);
  saveProgress(progress);
  return true;
}

export function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function canClaimDailyReward(progress) {
  return progress.lastDailyRewardDate !== todayKey();
}

/** Reclama la recompensa diaria (si corresponde) y devuelve { reward, streak }, o null si ya se reclamó hoy. */
export function claimDailyReward(progress) {
  if (!canClaimDailyReward(progress)) return null;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  progress.dailyStreak = progress.lastDailyRewardDate === yesterday ? progress.dailyStreak + 1 : 1;
  progress.stats.bestStreak = Math.max(progress.stats.bestStreak || 0, progress.dailyStreak); // para los logros de constancia
  const reward = Math.min(10 + (progress.dailyStreak - 1) * 5, 50);
  earnCoins(progress, reward);
  progress.lastDailyRewardDate = todayKey();
  saveProgress(progress);
  return { reward, streak: progress.dailyStreak };
}

export { DEFAULT_OUTFIT };

/** Guarda una creación en el perfil (las más nuevas primero, hasta MAX_CREATIONS). */
export function saveCreation(progress, creation) {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  progress.creations.unshift({ ...creation, id, date: new Date().toISOString() });
  progress.creations = progress.creations.slice(0, MAX_CREATIONS);
  saveProgress(progress);
  return id;
}

export function deleteCreation(progress, id) {
  progress.creations = progress.creations.filter((c) => c.id !== id);
  saveProgress(progress);
}
