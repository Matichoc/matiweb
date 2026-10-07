// Perfiles de jugador: permite que varias personas usen el mismo navegador
// sin mezclar su progreso (personaje, monedas, puntajes). Cada perfil guarda
// su propio progreso bajo storageKeyForProfile(id) (ver js/storage.js).

import { storageKeyForProfile } from "./storage.js";

const PROFILES_KEY = "matichoc_profiles_v1";
const LEGACY_FLAT_KEY = "matichoc_save_v3"; // guardado de antes de que existieran los perfiles
const LAST_ACTIVE_KEY = "matichoc_last_active_profile";

export const MAX_PROFILES = 4;

function readProfilesRaw() {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function writeProfilesRaw(list) {
  try {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(list));
  } catch (e) {
    /* almacenamiento no disponible: se ignora silenciosamente */
  }
}

/** Si existe un guardado de antes de los perfiles, lo convierte en el primer perfil. */
function migrateLegacyIfNeeded() {
  const existing = readProfilesRaw();
  if (existing) return existing;
  try {
    const legacyRaw = localStorage.getItem(LEGACY_FLAT_KEY);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw);
      const id = "p1";
      localStorage.setItem(storageKeyForProfile(id), legacyRaw);
      localStorage.removeItem(LEGACY_FLAT_KEY);
      const list = [{
        id,
        name: legacy.playerName || "Jugador 1",
        characterId: legacy.selectedCharacterId || null,
        createdAt: Date.now(),
      }];
      writeProfilesRaw(list);
      return list;
    }
  } catch (e) {
    /* ignorar guardado corrupto */
  }
  return [];
}

export function listProfiles() {
  return migrateLegacyIfNeeded();
}

export function getLastActiveProfileId() {
  try {
    return localStorage.getItem(LAST_ACTIVE_KEY);
  } catch (e) {
    return null;
  }
}

export function setLastActiveProfileId(id) {
  try {
    localStorage.setItem(LAST_ACTIVE_KEY, id);
  } catch (e) {
    /* ignorar */
  }
}

export function createProfile(name) {
  const list = listProfiles();
  const id = "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const profile = { id, name: (name || "Jugador").slice(0, 16), characterId: null, createdAt: Date.now() };
  list.push(profile);
  writeProfilesRaw(list);
  return profile;
}

/** Actualiza nombre/personaje mostrados en la tarjeta del perfil (no el progreso en sí). */
export function updateProfileMeta(id, patch) {
  const list = listProfiles();
  const idx = list.findIndex((p) => p.id === id);
  if (idx === -1) return;
  list[idx] = { ...list[idx], ...patch };
  writeProfilesRaw(list);
}

export function deleteProfile(id) {
  const list = listProfiles().filter((p) => p.id !== id);
  writeProfilesRaw(list);
  try {
    localStorage.removeItem(storageKeyForProfile(id));
  } catch (e) {
    /* ignorar */
  }
  if (getLastActiveProfileId() === id) setLastActiveProfileId(null);
}
