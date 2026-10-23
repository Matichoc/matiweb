// Estado persistente compartido entre el hub y todos los juegos (localStorage).
// El personaje, sus atuendos y las monedas Chocolate Dubai son globales a toda
// la plataforma; el puntaje y el ranking se llevan por juego (ver GAMES_CATALOG).
// Todo el progreso vive dentro de un "perfil" (ver js/profiles.js), para que
// varias personas puedan jugar desde el mismo navegador sin mezclar su avance.

import { getItem, EMPTY_LOOK, lockReason, isHexColor, CUSTOM_EMBLEMS } from "./wardrobe-data.js?v=6ffcfcb247";
import { queueSync } from "./online.js?v=6ffcfcb247";
import { addEnergy } from "./energy.js?v=6ffcfcb247";
import { normalizeAdventure } from "./adventure.js?v=6ffcfcb247";
import { normalizeSports } from "./sports-progress.js?v=6ffcfcb247";

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
    wardrobe: { owned: [], looks: {}, copies: {} }, // looks: { [characterId]: { hair, hat, outfit, ... } }
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
    adventure: normalizeAdventure(null), // aventura del festival (js/adventure.js): NO se reinicia cada día
    sports: normalizeSports(null), // Pichanga 3 contra 3 y Básquet 2 contra 2 (js/sports-progress.js)
  };
}

export const MAX_CREATIONS = 12;

/** Un guardado dañado o editado a mano no debe dejar números raros (NaN, negativos, textos). */
function sanitizeNumbers(p) {
  for (const k of ["coins", "xp", "packs", "unlockedLevel", "dailyStreak"]) {
    const n = Number(p[k]);
    p[k] = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  }
  for (const k of ["unlockedGames", "claimedAchievements", "albumClaimed"]) if (!Array.isArray(p[k])) p[k] = [];
  for (const k of ["bestScores", "leaderboards", "album", "eventTokens", "campaign", "missionsDone"]) {
    if (!p[k] || typeof p[k] !== "object" || Array.isArray(p[k])) p[k] = {};
  }
  for (const [id, c] of Object.entries(p.album)) { const v = Math.floor(Number(c)); if (!(v > 0)) delete p.album[id]; else p.album[id] = v; }
  if (!p.stats || typeof p.stats !== "object") p.stats = { totalCoinsEarned: 0 };
  const t = Number(p.stats.totalCoinsEarned);
  p.stats.totalCoinsEarned = Number.isFinite(t) && t > 0 ? Math.floor(t) : 0;
}

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
  const copies = {};
  for (const [id, n] of Object.entries(w.copies || {})) { const k = Math.floor(Number(n)); if (k > 1) copies[id] = k; }
  return { owned: [...owned], looks, copies };
}

/** Carga (o crea) el progreso de un perfil. El id queda "pegado" al objeto
 * (no enumerable, así no se guarda dentro del JSON) para que saveProgress
 * sepa a qué perfil escribir sin que cada llamador tenga que pasarlo. */
export function loadProgress(profileId) {
  let progress;
  try {
    const raw = localStorage.getItem(storageKeyForProfile(profileId));
    let parsed = {};
    if (raw) {
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        try { localStorage.setItem(storageKeyForProfile(profileId) + "_corrupt", raw); } catch (e2) { /* sin espacio */ }
      }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) parsed = {};
    }
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
        starterBed: !!(parsed.house && parsed.house.starterBed),
        copies: parsed.house && parsed.house.copies && typeof parsed.house.copies === "object" ? { ...parsed.house.copies } : {}, // cuántas unidades tienes de cada mueble (por defecto 1)
        // habitaciones extra (ver js/house-data.js): lista, cuál está abierta y lo guardado de las que no están abiertas
        rooms: parsed.house && Array.isArray(parsed.house.rooms) ? parsed.house.rooms.map((r) => ({ ...r })) : null,
        roomData: parsed.house && parsed.house.roomData && typeof parsed.house.roomData === "object" ? JSON.parse(JSON.stringify(parsed.house.roomData)) : {},
        curRoom: (parsed.house && parsed.house.curRoom) || "r0",
      },
      unlockedGames: Array.isArray(parsed.unlockedGames) ? [...parsed.unlockedGames] : [],
      albumClaimed: parsed.albumClaimed || [],
      packs: parsed.packs ?? 1,
      creations: Array.isArray(parsed.creations) ? parsed.creations.slice(0, MAX_CREATIONS) : [],
      // aventura del festival y deportes nuevos: estados versionados; la migración es idempotente y no borra avance
      // (un perfil antiguo, sin estos campos, parte con la aventura sin empezar)
      adventure: normalizeAdventure(parsed.adventure),
      sports: normalizeSports(parsed.sports),
    };
    sanitizeNumbers(progress);
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

// Cada prenda comprada se puede usar en UN Matichico a la vez (los mismos objetos pueden pasar de uno a otro, pero no estar
// puestos en dos al mismo tiempo): para que dos la lleven hay que comprar otra. Lo que viene gratis no tiene límite.

/** Cuántas unidades tienes de un objeto del guardarropa (Infinity si es gratis). */
export function wardrobeCopies(progress, itemId) {
  const item = getItem(itemId);
  if (!item) return 0;
  if (item.price === 0) return Infinity;
  if (!progress.wardrobe.owned.includes(itemId)) return 0;
  return Math.max(1, Math.floor(Number((progress.wardrobe.copies || {})[itemId])) || 1);
}

/** Ids de los Matichicos que lo llevan puesto ahora. */
export function wearers(progress, itemId) {
  return Object.entries(progress.wardrobe.looks).filter(([, look]) => Object.values(look).includes(itemId)).map(([charId]) => charId);
}

/** ¿Puede este Matichico ponérselo ahora? (si ya lo lleva, o si queda una unidad libre) */
export function canWear(progress, characterId, itemId) {
  if (!itemId) return true;
  const w = wearers(progress, itemId);
  return w.includes(characterId) || w.length < wardrobeCopies(progress, itemId);
}

/** Le saca el objeto a otro Matichico (queda con el normal de esa categoría). */
export function takeOff(progress, characterId, itemId) {
  const look = progress.wardrobe.looks[characterId];
  if (!look) return;
  for (const [slot, id] of Object.entries(look)) if (id === itemId) look[slot] = EMPTY_LOOK[slot] ?? "";
  saveProgress(progress);
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
  if (!canWear(progress, characterId, itemId)) return false; // otro Matichico lo está usando y no hay otra unidad
  if (!progress.wardrobe.looks[characterId]) progress.wardrobe.looks[characterId] = {};
  progress.wardrobe.looks[characterId][slot] = itemId;
  saveProgress(progress);
  return true;
}

/** Guarda el color y/o la figura elegidos para la prenda "a tu gusto" de un Matichico. */
export function setOutfitCustom(progress, characterId, patch) {
  if (!progress.wardrobe.looks[characterId]) progress.wardrobe.looks[characterId] = {};
  const look = progress.wardrobe.looks[characterId];
  if (patch.outfitColor !== undefined && isHexColor(patch.outfitColor)) look.outfitColor = patch.outfitColor.toUpperCase();
  if (patch.outfitEmblem !== undefined && CUSTOM_EMBLEMS.some((e) => e.id === patch.outfitEmblem)) look.outfitEmblem = patch.outfitEmblem;
  saveProgress(progress);
}

/** Gasta Matipuntos. Punto único de pago: aquí se sumarán otras monedas en el futuro. */
export function spendCoins(progress, amount) {
  if (!Number.isFinite(amount) || amount < 0 || progress.coins < amount) return false;
  progress.coins -= amount;
  return true;
}

/** Compra un objeto (o "otro igual" si ya lo tienes: cada compra es una unidad más). */
export function buyItem(progress, itemId) {
  const item = getItem(itemId);
  if (!item || item.event || item.price <= 0) return false; // los de evento se compran con fichas
  if (lockReason(progress, item)) return false; // lo exclusivo pide nivel o un logro
  const had = progress.wardrobe.owned.includes(itemId);
  if (!spendCoins(progress, item.price)) return false;
  if (!had) progress.wardrobe.owned.push(itemId);
  progress.wardrobe.copies = progress.wardrobe.copies || {};
  progress.wardrobe.copies[itemId] = had ? wardrobeCopies(progress, itemId) + 1 : 1;
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
  if (!Number.isFinite(amount) || amount <= 0) return;
  progress.coins += amount;
  progress.stats.totalCoinsEarned += amount;
}

/** Reclama un logro (ver js/achievements.js) si está cumplido y no reclamado. */
export function claimAchievement(progress, achievement) {
  if (progress.claimedAchievements.includes(achievement.id)) return false;
  if (!achievement.isDone(progress)) return false;
  progress.claimedAchievements.push(achievement.id);
  earnCoins(progress, achievement.reward);
  addEnergy(progress, achievement.reward >= 150 ? 10 : 5, "logro");
  saveProgress(progress);
  return true;
}

/** "YYYY-MM-DD" según la hora local del aparato (con la hora UTC el "día nuevo" empezaba a las 21:00 en Chile). */
export function dayKey(date = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

export function todayKey() {
  return dayKey();
}

export function canClaimDailyReward(progress) {
  return progress.lastDailyRewardDate !== todayKey();
}

/** Reclama la recompensa diaria (si corresponde) y devuelve { reward, streak }, o null si ya se reclamó hoy. */
export function claimDailyReward(progress) {
  if (!canClaimDailyReward(progress)) return null;
  const yesterday = dayKey(new Date(Date.now() - 86400000));
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
