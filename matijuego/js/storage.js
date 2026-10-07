// Estado persistente compartido entre el hub y todos los juegos (localStorage).
// El personaje, sus atuendos y las monedas Chocolate Dubai son globales a toda
// la plataforma; el puntaje y el ranking se llevan por juego (ver GAMES_CATALOG).
// Todo el progreso vive dentro de un "perfil" (ver js/profiles.js), para que
// varias personas puedan jugar desde el mismo navegador sin mezclar su avance.

const SAVE_PREFIX = "matichoc_save_v3_profile_";
const DEFAULT_OUTFIT = "liga";
const MAX_LEADERBOARD = 10;

export function storageKeyForProfile(profileId) {
  return `${SAVE_PREFIX}${profileId}`;
}

function defaultProgress() {
  return {
    playerName: "",
    selectedCharacterId: null,
    equippedOutfit: {}, // { [characterId]: outfitId }
    ownedOutfits: {}, // { [characterId]: [outfitId, ...] }
    coins: 0,
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
      equippedOutfit: { ...parsed.equippedOutfit },
      ownedOutfits: { ...parsed.ownedOutfits },
      bestScores: { ...parsed.bestScores },
      leaderboards: { ...parsed.leaderboards },
      stats: { ...defaultProgress().stats, ...parsed.stats },
      claimedAchievements: parsed.claimedAchievements || [],
      creations: Array.isArray(parsed.creations) ? parsed.creations.slice(0, MAX_CREATIONS) : [],
    };
  } catch (e) {
    progress = defaultProgress();
  }
  Object.defineProperty(progress, "_profileId", { value: profileId, enumerable: false });
  return progress;
}

export function saveProgress(progress) {
  try {
    localStorage.setItem(storageKeyForProfile(progress._profileId), JSON.stringify(progress));
  } catch (e) {
    /* almacenamiento no disponible: se ignora silenciosamente */
  }
}

export function ownsOutfit(progress, characterId, outfitId) {
  if (outfitId === DEFAULT_OUTFIT) return true;
  return (progress.ownedOutfits[characterId] || []).includes(outfitId);
}

export function equippedOutfitId(progress, characterId) {
  return progress.equippedOutfit[characterId] || DEFAULT_OUTFIT;
}

export function buyOutfit(progress, characterId, outfit) {
  if (progress.coins < outfit.price) return false;
  if (ownsOutfit(progress, characterId, outfit.id)) return false;
  progress.coins -= outfit.price;
  if (!progress.ownedOutfits[characterId]) progress.ownedOutfits[characterId] = [];
  progress.ownedOutfits[characterId].push(outfit.id);
  progress.equippedOutfit[characterId] = outfit.id;
  saveProgress(progress);
  return true;
}

export function equipOutfit(progress, characterId, outfitId) {
  progress.equippedOutfit[characterId] = outfitId;
  saveProgress(progress);
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
