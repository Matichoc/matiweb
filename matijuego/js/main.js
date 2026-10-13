import { CHARACTERS, getOutfit, renderCharacterThumb } from "./characters.js?v=64565862c1";
import { SLOTS, RARITIES, getItem, itemsOfSlot } from "./wardrobe-data.js?v=64565862c1";
import * as audio from "./audio.js?v=64565862c1";
import { bindStick, joyMode, setJoyMode } from "./stick.js?v=64565862c1";
import { UNLOCK_COST, needsUnlock, isUnlocked, unlockGame } from "./unlocks.js?v=64565862c1";
import { GAMES_CATALOG } from "./games-catalog.js?v=64565862c1";
import {
  loadProgress, saveProgress, ownsItem, getLook, equipItem, buyItem,
  getBestScore, getLeaderboard, canClaimDailyReward, claimDailyReward, claimAchievement,
} from "./storage.js?v=64565862c1";
import {
  listProfiles, createProfile, deleteProfile, updateProfileMeta,
  getLastActiveProfileId, setLastActiveProfileId, MAX_PROFILES,
} from "./profiles.js?v=64565862c1";
import { ACHIEVEMENTS, ACHIEVEMENT_CHAINS, CATEGORIES as ACH_CATEGORIES, achievementProgress } from "./achievements.js?v=64565862c1";
import { activeEvent, eventById, eventEnd, nextEvent, eventTokens, eventItemAvailable, buyEventItem } from "./events.js?v=64565862c1";
import {
  HOUSE_SPOTS, houseItemsOfSpot, getHouseItem, ownsHouseItem, buyHouseItem, placeHouseItem, placedWithDefaults,
  FURN_CATEGORIES, furnitureOf, isWallItem, houseLayout, layoutAdd, layoutRemove, buyFurniture, HOUSE_SIZES, houseSize, buyHouseSize,
} from "./house-data.js?v=64565862c1";
import {
  levelInfo, LEVEL_GIFTS, ensureDaily, missionLabel, missionProgress, missionDone, claimMission,
  canClaimChest, claimChest, hasPending, STICKERS, PAGES, ALBUM_TOTAL, albumCount, pageStatus, ALBUM_MILESTONES, openPack, onProgressEvent, GAME_NAMES,
  spareCount, sparePoints, sellValue, sellSpares, tradeFor, tradeCost, TRADE_NORMAL, TRADE_FOIL,
} from "./progression.js?v=64565862c1";
import { rankingEnabled, fetchRanking } from "./online.js?v=64565862c1";

let progress = null;
let selectedCharacter = null;
let shopCharacterId = CHARACTERS[0].id;

const screenProfiles = document.getElementById("screen-profiles");
const screenHub = document.getElementById("screen-hub");
const screenShop = document.getElementById("screen-shop");
const screenLeaderboard = document.getElementById("screen-leaderboard");
const screenAchievements = document.getElementById("screen-achievements");
const screenProgress = document.getElementById("screen-progress");
const screenHouse = document.getElementById("screen-house");
const screenFps = document.getElementById("screen-fps");
const screen3d = {
  town: document.getElementById("screen-town"),
  recolecta: document.getElementById("screen-recolecta"),
  tetris: document.getElementById("screen-tetris"),
  parkour: document.getElementById("screen-parkour"),
  porristas: document.getElementById("screen-porristas"),
  basquet_tiros: document.getElementById("screen-basquet"),
  salto: document.getElementById("screen-salto"),
  autos: document.getElementById("screen-autos"),
  memoria: document.getElementById("screen-memoria"),
  futbol: document.getElementById("screen-futbol"),
  dulces: document.getElementById("screen-dulces"),
  aventura: document.getElementById("screen-aventura"),
  ciudad: document.getElementById("screen-ciudad"),
  creador: document.getElementById("screen-creador"),
};
const ALL_SCREENS = [
  screenProfiles, screenHub, screenShop, screenLeaderboard, screenAchievements, screenProgress, screenHouse,
    screenFps,
  ...Object.values(screen3d),
].filter(Boolean); // (en la app infantil no existe la pantalla de Choco Blaster)

const grid = document.getElementById("character-grid");
const gameGrid = document.getElementById("game-grid");
const inputName = document.getElementById("input-name");
const hubTotalCoinsEl = document.getElementById("hub-total-coins");
const toastEl = document.getElementById("toast");

// Instancias únicas de cada motor, creadas recién la primera vez que se juegan
// y reutilizadas entre partidas y entre perfiles (ver rebind en playGame()).
const instances = { town: null, parkour: null, recolecta: null, tetris: null, basquet_tiros: null, porristas: null, fps: null, salto: null, autos: null, memoria: null, futbol: null, dulces: null, aventura: null, ciudad: null, creador: null };

let toastTimer = null;
function showToast(message, ms = 2600) {
  toastEl.textContent = message;
  toastEl.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.add("hidden"), ms);
}

/** Dibuja el retrato de un Matichico: primero el dibujo 2D (al instante) y luego el modelo 3D con todo lo que lleva puesto. */
function paintAvatar(canvas, char, lookOverride = null, prog = progress) {
  const look = lookOverride || getLook(prog, char.id);
  renderCharacterThumb(canvas, char, getOutfit(look.outfit));
  import("./thumb3d.js?v=64565862c1")
    .then((m) => {
      m.renderHeroThumb(canvas, char, look);
      canvas.dispatchEvent(new Event("repainted"));
    })
    .catch(() => { /* sin WebGL: se queda el dibujo 2D */ });
}

// ---------- JUEGOS QUE EXIGEN CELULAR HORIZONTAL ----------
// Los juegos con orient "landscape" no se pueden jugar con el celular parado: aparece un aviso grande.
let currentGameId = null;
const rotateOverlay = document.getElementById("rotate-overlay");
function checkOrientation() {
  if (!rotateOverlay) return;
  const entry = currentGameId && GAMES_CATALOG.find((g) => g.id === currentGameId);
  const needs = !!entry && entry.orient === "landscape";
  const touch = window.matchMedia("(pointer: coarse)").matches;
  const portrait = window.innerHeight > window.innerWidth;
  const show = needs && touch && portrait;
  rotateOverlay.classList.toggle("hidden", !show);
  if (show) rotateOverlay.querySelector(".rot-game").textContent = entry.name;
}
window.addEventListener("resize", checkOrientation);
window.addEventListener("orientationchange", checkOrientation);
try { screen.orientation?.lock?.("landscape").catch(() => {}); } catch (e) { /* solo funciona en pantalla completa / app */ }

function showScreen(target) {
  ALL_SCREENS.forEach((s) => s.classList.toggle("hidden", s !== target));
  syncLobby(target === screenHub);
}

// ---------- JOYSTICK: flotante (aparece donde pones el dedo) o fijo ----------

const btnJoystick = document.getElementById("btn-joystick");
function paintJoyButton() {
  btnJoystick.querySelector("b").textContent = joyMode() === "float" ? "flotante" : "fijo";
}
btnJoystick.addEventListener("click", () => {
  const next = joyMode() === "float" ? "fixed" : "float";
  setJoyMode(next);
  paintJoyButton();
  showToast(next === "float" ? "🕹️ Joystick flotante: aparece donde pones el dedo, en la mitad izquierda de la pantalla." : "🕹️ Joystick fijo: se queda siempre en la esquina.");
});
paintJoyButton();

// ---------- ESCENARIO 3D DEL MENÚ ----------

let lobby = null;
let lobbyFailed = false;

async function syncLobby(visible) {
  if (!visible) {
    if (lobby) lobby.setActive(false);
    return;
  }
  if (!selectedCharacter && !CHARACTERS.length) return;
  const char = selectedCharacter || CHARACTERS[0];
  const look = getLook(progress, char.id);
  const outfit = getOutfit(look.outfit);
  const key = `${char.id}|${Object.values(look).join(",")}`;
  const nameEl = document.getElementById("lb-char-name");
  if (nameEl) nameEl.textContent = selectedCharacter ? char.name : "Elige tu Matichico";
  const fb = document.getElementById("lobby-fallback");
  const cv = document.getElementById("lobby-canvas");
  const useFallback = () => {
    lobbyFailed = true;
    cv.classList.add("hidden");
    fb.classList.remove("hidden");
    paintAvatar(fb, char, look);
  };
  try {
    if (lobbyFailed) { useFallback(); return; }
    if (!lobby) {
      const { Lobby3D } = await import("./lobby3d.js?v=64565862c1");
      lobby = new Lobby3D(cv);
      lobby.init();
    }
    if (lobby.key !== key) lobby.setHero(char, look, key);
    if (!screenHub.classList.contains("hidden")) lobby.setActive(true);
  } catch (err) {
    console.warn("Escenario 3D del menú no disponible:", err);
    lobby = null;
    useFallback();
  }
}

inputName.addEventListener("input", () => {
  progress.playerName = inputName.value.trim();
  saveProgress(progress);
  if (progress.playerName) updateProfileMeta(progress._profileId, { name: progress.playerName });
  updateProfileChip();
});

/** Cartel del evento de temporada en el menú (o aviso del próximo). */
function renderEventBanner() {
  const el = document.getElementById("event-banner");
  if (!el) return;
  const e = activeEvent();
  if (e) {
    const end = eventEnd(e);
    el.innerHTML = `<span class="eb-ico">${e.icon}</span><span class="eb-body"><b>${e.name}</b><small>${e.blurb} Hasta el ${String(end.getDate()).padStart(2, "0")}/${String(end.getMonth() + 1).padStart(2, "0")}.</small></span><span class="eb-tokens">${e.token} ${eventTokens(progress, e.id)}</span><button class="btn-primary eb-go" type="button">Ir al pueblo</button>`;
    el.querySelector(".eb-go").onclick = () => playGame("town");
    el.classList.remove("hidden", "soon");
    el.style.setProperty("--ev", "#" + e.colors[0].toString(16).padStart(6, "0"));
  } else {
    const n = nextEvent();
    if (!n) { el.classList.add("hidden"); return; }
    el.innerHTML = `<span class="eb-ico">${n.event.icon}</span><span class="eb-body"><b>Próximo evento: ${n.event.name}</b><small>Empieza en ${n.days} día${n.days === 1 ? "" : "s"}. ¡Prepara tus Matipuntos!</small></span>`;
    el.onclick = null;
    el.classList.remove("hidden");
    el.classList.add("soon");
    el.style.setProperty("--ev", "#" + n.event.colors[0].toString(16).padStart(6, "0"));
  }
}

function refreshHubStats() {
  renderEventBanner();
  hubTotalCoinsEl.textContent = String(progress.coins);
  const lv = levelInfo(progress.xp);
  document.getElementById("hub-level").textContent = String(lv.level);
  document.getElementById("hub-xp-fill").style.width = `${Math.round((lv.into / lv.need) * 100)}%`;
  document.getElementById("hub-progress-dot").classList.toggle("hidden", !hasPending(progress));
  const hs = document.getElementById("house-banner-sub");
  if (hs && progress.house) {
    const n = (progress.house.layout || []).length;
    hs.textContent = `${houseSize(progress).name}${n ? ` · ${n} mueble${n > 1 ? "s" : ""}` : ""} — ¡arrastra muebles, decora y agranda tu casa!`;
  }
}

// ---------- PERFILES ("¿Quién juega?") ----------

const profileGridEl = document.getElementById("profile-grid");
const newProfileForm = document.getElementById("new-profile-form");
const newProfileNameInput = document.getElementById("new-profile-name");

function renderProfileScreen() {
  profileGridEl.innerHTML = "";
  newProfileForm.classList.add("hidden");
  const profiles = listProfiles();

  profiles.forEach((p) => {
    const card = document.createElement("div");
    card.className = "profile-card";

    const char = CHARACTERS.find((c) => c.id === p.characterId);
    if (char) {
      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 128;
      paintAvatar(canvas, char, null, loadProgress(p.id));
      card.appendChild(canvas);
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "profile-placeholder";
      placeholder.textContent = "🍫";
      card.appendChild(placeholder);
    }

    const name = document.createElement("span");
    name.className = "pname";
    name.textContent = p.name;
    card.appendChild(name);

    const delBtn = document.createElement("button");
    delBtn.className = "btn-delete-profile";
    delBtn.textContent = "✕";
    delBtn.title = "Eliminar perfil";
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (window.confirm(`¿Eliminar el perfil de ${p.name}? Se borrará todo su progreso.`)) {
        deleteProfile(p.id);
        renderProfileScreen();
      }
    });
    card.appendChild(delBtn);

    card.addEventListener("click", () => chooseProfile(p.id));
    profileGridEl.appendChild(card);
  });

  if (profiles.length < MAX_PROFILES) {
    const addCard = document.createElement("div");
    addCard.className = "profile-card add-profile";
    const plus = document.createElement("span");
    plus.className = "plus-icon";
    plus.textContent = "+";
    const label = document.createElement("span");
    label.textContent = "Nuevo jugador";
    addCard.appendChild(plus);
    addCard.appendChild(label);
    addCard.addEventListener("click", () => {
      newProfileForm.classList.remove("hidden");
      newProfileNameInput.value = "";
      newProfileNameInput.focus();
    });
    profileGridEl.appendChild(addCard);
  }
}

document.getElementById("btn-create-profile").addEventListener("click", () => {
  const name = newProfileNameInput.value.trim() || "Jugador";
  const p = createProfile(name);
  chooseProfile(p.id);
});
document.getElementById("btn-cancel-profile").addEventListener("click", () => {
  newProfileForm.classList.add("hidden");
});

function chooseProfile(id) {
  setLastActiveProfileId(id);
  progress = loadProgress(id);
  if (location.search.includes("debug3d")) window.__progress = () => progress; // solo para pruebas
  // el apodo del perfil es el que ve el creador (y el ranking, si se abre): se mantiene al día
  const meta = listProfiles().find((x) => x.id === id);
  if (meta && meta.name && progress.playerName !== meta.name) progress.playerName = meta.name;
  selectedCharacter = CHARACTERS.find((c) => c.id === progress.selectedCharacterId) || null;
  shopCharacterId = (selectedCharacter && selectedCharacter.id) || CHARACTERS[0].id;
  bootHub();
  showScreen(screenHub);
}

function goToProfiles() {
  Object.values(instances).forEach((instance) => instance && instance.pauseForMenu());
  renderProfileScreen();
  showScreen(screenProfiles);
}

document.getElementById("btn-switch-profile").addEventListener("click", goToProfiles);

function updateProfileChip() {
  const profiles = listProfiles();
  const current = profiles.find((p) => p.id === progress._profileId);
  document.getElementById("hub-profile-name").textContent = (current && current.name) || progress.playerName || "Jugador";
  const avatarImg = document.getElementById("hub-profile-avatar");
  if (selectedCharacter) {
    const c = document.createElement("canvas");
    c.width = 80;
    c.height = 80;
    c.addEventListener("repainted", () => (avatarImg.src = c.toDataURL()));
    paintAvatar(c, selectedCharacter);
    avatarImg.src = c.toDataURL();
  }
}

function bootHub() {
  inputName.value = progress.playerName || "";
  renderCharacterGrid();
  renderGameGrid();
  refreshHubStats();
  updateDailyRewardButton();
  updateProfileChip();
}

// ---------- RECOMPENSA DIARIA ----------

const btnDailyReward = document.getElementById("btn-daily-reward");

function updateDailyRewardButton() {
  const can = canClaimDailyReward(progress);
  btnDailyReward.disabled = !can;
  btnDailyReward.classList.toggle("daily-ready", can); // sin cobrar: dorado, brillando y con puntito rojo
  btnDailyReward.textContent = can
    ? "🎁 ¡Cobra tu recompensa!"
    : `🎁 Reclamado (racha ${progress.dailyStreak} día${progress.dailyStreak === 1 ? "" : "s"})`;
}

btnDailyReward.addEventListener("click", () => {
  const result = claimDailyReward(progress);
  if (!result) return;
  audio.playPurchase();
  refreshHubStats();
  updateDailyRewardButton();
  showToast(`¡+${result.reward} Matipuntos! Racha de ${result.streak} día${result.streak === 1 ? "" : "s"} 🔥`);
});

// ---------- "Tienda" y "Lo que tengo": lo comprado va aparte de lo que falta por comprar ----------

/** Dos botones: lo que se puede comprar y lo que ya es tuyo (con la cantidad de cada uno). */
function renderViewToggle(el, view, counts, onPick) {
  el.innerHTML = "";
  for (const [id, label] of [["buy", "🛍️ Por comprar"], ["own", "🎒 Lo que tengo"]]) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "sh-mode sh-view" + (id === view ? " active" : "");
    b.innerHTML = `${label} <i class="sh-count">${counts[id]}</i>`;
    b.addEventListener("click", () => { if (id !== view) onPick(id); });
    el.appendChild(b);
  }
}

function addEmptyNote(grid, view, textBuy, textOwn, goOther) {
  const d = document.createElement("div");
  d.className = "sh-empty";
  d.innerHTML = `<p>${view === "buy" ? textBuy : textOwn}</p>`;
  const b = document.createElement("button");
  b.type = "button";
  b.className = "btn-secondary";
  b.textContent = view === "buy" ? "🎒 Ver lo que tengo" : "🛍️ Ir a comprar";
  b.addEventListener("click", goOther);
  d.appendChild(b);
  grid.appendChild(d);
}

// ---------- MI CASA ----------
// Tres modos: "decor" (poner y arrastrar muebles donde quieras), "style" (piso, paredes y techo)
// y "size" (agrandar la casa). Todo se paga con los Matipuntos que se ganan jugando.

const houseTabsEl = document.getElementById("house-tabs");
const houseGridEl = document.getElementById("house-grid");
const houseBarEl = document.getElementById("house-bar");
const houseModesEl = document.getElementById("house-modes");
const houseToolsEl = document.getElementById("house-tools");
const STYLE_SPOTS = HOUSE_SPOTS.filter((s) => ["floor", "wall", "ceiling"].includes(s.id));
let houseMode = "decor";
let houseSpot = "floor";
let houseCat = FURN_CATEGORIES[0].id;
let houseView = "buy"; // "buy" = lo que falta por comprar, "own" = lo que ya tengo
const houseViewsEl = document.getElementById("house-views");
let houseTrial = {}; // objetos de estilo que se están probando y todavía no son tuyos: { [lugar]: idObjeto }
let houseBuying = null; // mueble que se está mirando para comprar
let houseSel = null; // uid de la pieza seleccionada
let housePreview = null; // vista previa de un mueble que todavía no es tuyo (no se guarda): se puede mover, girar y agrandar
let housePreviewSize = null; // tamaño de casa que se está mirando antes de comprarlo
let house3d = null;

document.getElementById("btn-house-banner").addEventListener("click", () => document.getElementById("btn-open-house").click());
document.getElementById("btn-open-house").addEventListener("click", () => {
  houseTrial = {};
  houseBuying = null;
  houseSel = null;
  housePreview = null;
  housePreviewSize = null;
  showScreen(screenHouse);
  renderHouse();
  openHousePreview();
});
document.getElementById("btn-house-back").addEventListener("click", () => {
  houseTrial = {};
  houseBuying = null;
  clearFurniturePreview();
  clearSizePreview();
  if (house3d) house3d.setActive(false);
  refreshHubStats();
  if (fromTown) goToHub();
  else showScreen(screenHub);
});

function housePlaced() {
  return { ...placedWithDefaults(progress), ...houseTrial };
}

async function openHousePreview() {
  try {
    if (!house3d) {
      const { House3D } = await import("./house3d.js?v=64565862c1");
      house3d = new House3D(document.getElementById("house-canvas"));
      house3d.init();
      bindHouseDrag();
      if (location.search.includes("debug3d")) window.__house = house3d; // solo para pruebas
    }
    const look = getLook(progress, selectedCharacter.id);
    const key = `${selectedCharacter.id}|${JSON.stringify(look)}`;
    if (house3d.key !== key) house3d.setHero(selectedCharacter, look, key);
    house3d.setSize(houseSize(progress).size);
    house3d.layoutData = houseLayout(progress);
    house3d.setPlaced(housePlaced());
    house3d.setSelected(houseSel);
    house3d.setActive(true);
  } catch (err) {
    console.error(err);
    showToast("Tu dispositivo no pudo mostrar la casa en 3D.");
  }
}

/** La pieza (puesta o de vista previa) con ese uid. */
function pieceById(uid) {
  if (uid === "preview") return housePreview;
  return houseLayout(progress).find((f) => f.uid === uid);
}

/** Muestra el mueble en el cuarto ANTES de comprarlo, para tentar: se puede mover y girar. */
function startFurniturePreview(id) {
  clearFurniturePreview();
  const item = getHouseItem(id);
  housePreview = isWallItem(item) ? { uid: "preview", id, wall: "back", u: 0, y: 2.8, s: 1 } : { uid: "preview", id, x: 0, z: 1.5, rot: 0, s: 1 };
  house3d && house3d.addFurn(housePreview);
  house3d && house3d.updateFurn(housePreview);
  selectPiece("preview");
  showToast(`👀 Vista previa de ${item.name}: muévelo, gíralo y, si te gusta, ¡cómpralo!`);
}

function clearFurniturePreview() {
  if (!housePreview) return;
  house3d && house3d.removeFurn("preview");
  housePreview = null;
  if (houseSel === "preview") selectPiece(null);
}

/** Vuelve a mostrar la casa con el tamaño que de verdad tienes. */
function clearSizePreview() {
  if (housePreviewSize === null) return;
  housePreviewSize = null;
  house3d && house3d.setSize(houseSize(progress).size);
}

function selectPiece(uid) {
  houseSel = uid;
  house3d && house3d.setSelected(uid);
  renderHouseTools();
}

function renderHouseTools() {
  houseToolsEl.innerHTML = "";
  const d = houseSel && pieceById(houseSel);
  houseToolsEl.classList.toggle("hidden", !d || houseMode !== "decor");
  if (!d) return;
  const item = getHouseItem(d.id);
  const isPreview = d.uid === "preview";
  const add = (label, title, fn) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.title = title;
    b.addEventListener("click", () => { fn(); house3d && house3d.updateFurn(d); if (!isPreview) saveProgress(progress); });
    houseToolsEl.appendChild(b);
  };
  const name = document.createElement("span");
  name.className = "ht-name";
  name.textContent = isPreview ? `👀 Vista previa: ${item.name}` : `${item.icon} ${item.name}`;
  houseToolsEl.appendChild(name);
  if (d.wall) add("↔", "Cambiar de pared", () => { d.wall = d.wall === "back" ? "left" : "back"; });
  else add("⟳", "Girar", () => { d.rot = ((d.rot || 0) + Math.PI / 4) % (Math.PI * 2); });
  add("➖", "Más chico", () => { d.s = Math.max(0.5, Math.round(((d.s || 1) - 0.15) * 100) / 100); });
  add("➕", "Más grande", () => { d.s = Math.min(2.2, Math.round(((d.s || 1) + 0.15) * 100) / 100); });
  if (isPreview) {
    const no = document.createElement("button");
    no.type = "button";
    no.textContent = "✖";
    no.title = "Quitar la vista previa";
    no.addEventListener("click", () => { houseBuying = null; clearFurniturePreview(); renderHouse(); });
    houseToolsEl.appendChild(no);
    return;
  }
  const del = document.createElement("button");
  del.type = "button";
  del.textContent = "🗑";
  del.title = "Guardar en el baúl";
  del.addEventListener("click", () => { layoutRemove(progress, d.uid); house3d && house3d.removeFurn(d.uid); selectPiece(null); audio.playBump(); });
  houseToolsEl.appendChild(del);
  const ok = document.createElement("button");
  ok.type = "button";
  ok.textContent = "✔";
  ok.title = "Listo";
  ok.addEventListener("click", () => selectPiece(null));
  houseToolsEl.appendChild(ok);
}

/** Arrastrar muebles dentro del cuarto (mouse o dedo). */
function bindHouseDrag() {
  const cv = document.getElementById("house-canvas");
  let drag = null;
  const point = (e, d) => (d.wall ? house3d.wallPoint(e.clientX, e.clientY) : house3d.floorPoint(e.clientX, e.clientY));
  const snap = (v) => Math.round(v * 4) / 4;
  cv.addEventListener("pointerdown", (e) => {
    if (houseMode !== "decor") return;
    const uid = house3d.pick(e.clientX, e.clientY);
    if (!uid) { if (houseSel) selectPiece(null); return; }
    const d = pieceById(uid);
    if (!d) return;
    selectPiece(uid);
    const p = point(e, d);
    drag = { d, id: e.pointerId, off: p && !d.wall ? { x: d.x - p.x, z: d.z - p.z } : { x: 0, z: 0 } };
    cv.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  cv.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const p = point(e, drag.d);
    if (!p) return;
    if (drag.d.wall) {
      drag.d.wall = p.wall;
      drag.d.u = snap(p.u);
      drag.d.y = snap(p.y);
    } else {
      drag.d.x = snap(p.x + drag.off.x);
      drag.d.z = snap(p.z + drag.off.z);
    }
    house3d.updateFurn(drag.d);
  });
  const end = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const wasPreview = drag.d.uid === "preview";
    drag = null;
    if (!wasPreview) saveProgress(progress);
  };
  cv.addEventListener("pointerup", end);
  cv.addEventListener("pointercancel", end);
}

/** Pone una copia de un mueble que ya es tuyo (en el centro, o donde lo soltaste). */
function placeFurniture(id, at = null, base = null) {
  const item = getHouseItem(id);
  const piece = layoutAdd(progress, id);
  if (!piece) return;
  if (base) {
    // viene de la vista previa: queda justo como lo habías puesto
    for (const k of ["x", "z", "rot", "s", "wall", "u", "y"]) if (base[k] !== undefined) piece[k] = base[k];
    saveProgress(progress);
  }
  if (at && !piece.wall) { piece.x = at.x; piece.z = at.z; }
  if (at && piece.wall && at.wall) { piece.wall = at.wall; piece.u = at.u; piece.y = at.y; }
  house3d && house3d.addFurn(piece);
  house3d && house3d.updateFurn(piece);
  selectPiece(piece.uid);
  audio.playJump();
  showToast(`${item.icon} ${item.name} puesto: ¡arrástralo donde quieras!`);
}

/** Arrastrar una tarjeta de mueble hasta el cuarto (también funciona con un toque). */
function bindCardDrag(card, id) {
  let start = null;
  card.addEventListener("pointerdown", (e) => { start = { x: e.clientX, y: e.clientY, moved: false }; });
  card.addEventListener("pointermove", (e) => { if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 12) start.moved = true; });
  card.addEventListener("pointerup", (e) => {
    if (!start) return;
    const s = start;
    start = null;
    if (!s.moved) return;
    const r = document.getElementById("house-canvas").getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
    const item = getHouseItem(id);
    const at = isWallItem(item) ? house3d.wallPoint(e.clientX, e.clientY) : house3d.floorPoint(e.clientX, e.clientY);
    card.dataset.dragged = "1";
    placeFurniture(id, at);
    renderHouse();
  });
  card.addEventListener("pointercancel", () => { start = null; });
}

function renderHouse() {
  document.getElementById("house-coins").textContent = String(progress.coins);
  // modos
  houseModesEl.innerHTML = "";
  for (const [id, icon, name] of [["decor", "🛋️", "Decorar"], ["style", "🎨", "Piso y paredes"], ["size", "🏡", "Agrandar casa"]]) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "sh-mode" + (id === houseMode ? " active" : "");
    b.innerHTML = `<span>${icon}</span> ${name}`;
    b.addEventListener("click", () => { houseMode = id; houseBuying = null; houseTrial = {}; clearFurniturePreview(); clearSizePreview(); if (id !== "decor") selectPiece(null); renderHouse(); house3d && house3d.setPlaced(housePlaced()); });
    houseModesEl.appendChild(b);
  }
  renderHouseTools();
  houseViewsEl.classList.toggle("hidden", houseMode === "size");
  if (houseMode !== "size") {
    const mine = (x) => ownsHouseItem(progress, x.id);
    const pool = houseMode === "decor" ? FURN_CATEGORIES.flatMap((c) => furnitureOf(c.id)) : STYLE_SPOTS.flatMap((sp) => houseItemsOfSpot(sp.id));
    const own = pool.filter(mine).length;
    renderViewToggle(houseViewsEl, houseView, { buy: pool.length - own, own }, (v) => {
      houseView = v; houseBuying = null; houseTrial = {};
      clearFurniturePreview(); renderHouse(); house3d && house3d.setPlaced(housePlaced());
    });
  }
  houseTabsEl.innerHTML = "";
  houseGridEl.innerHTML = "";
  houseBarEl.innerHTML = "";
  houseBarEl.className = "sh-bar";
  if (houseMode === "decor") renderHouseDecor();
  else if (houseMode === "style") renderHouseStyle();
  else renderHouseSize();
}

function renderHouseDecor() {
  const wantOwn = houseView === "own";
  FURN_CATEGORIES.forEach((c) => {
    const n = furnitureOf(c.id).filter((i) => ownsHouseItem(progress, i.id) === wantOwn).length;
    const btn = document.createElement("button");
    btn.className = "sh-tab" + (c.id === houseCat ? " active" : "");
    btn.innerHTML = `<span>${c.icon}</span><b>${c.name}</b><i class="sh-count">${n}</i>`;
    btn.addEventListener("click", () => { houseCat = c.id; houseBuying = null; clearFurniturePreview(); renderHouse(); });
    houseTabsEl.appendChild(btn);
  });
  const shown = furnitureOf(houseCat).filter((i) => ownsHouseItem(progress, i.id) === wantOwn);
  if (!shown.length) addEmptyNote(houseGridEl, houseView, "¡Ya tienes todo de esta categoría! 🎉", "Aquí aún no tienes nada. ¡Mira lo que hay por comprar!", () => { houseView = wantOwn ? "buy" : "own"; houseBuying = null; clearFurniturePreview(); renderHouse(); });
  shown.forEach((item) => {
    const owned = ownsHouseItem(progress, item.id);
    const count = houseLayout(progress).filter((f) => f.id === item.id).length;
    const card = document.createElement("button");
    card.type = "button";
    card.className = "sh-card" + (!owned ? " locked" : "") + (houseBuying === item.id ? " trying" : "");
    card.style.setProperty("--rar", RARITIES[item.rarity].color);
    card.innerHTML = `<span class="sh-ico">${item.icon}</span><span class="sh-name">${item.name}</span>` +
      `<span class="sh-price">${owned ? `＋ Poner${count ? ` (${count} puesto${count > 1 ? "s" : ""})` : ""}` : `🍫✨ ${item.price}`}</span>`;
    card.addEventListener("click", () => {
      if (card.dataset.dragged) { delete card.dataset.dragged; return; }
      if (owned) { clearFurniturePreview(); houseBuying = null; placeFurniture(item.id); renderHouse(); } else { houseBuying = item.id; startFurniturePreview(item.id); renderHouse(); }
    });
    if (owned) bindCardDrag(card, item.id);
    houseGridEl.appendChild(card);
  });
  const bi = houseBuying && getHouseItem(houseBuying);
  if (bi) {
    const need = bi.price - progress.coins;
    const txt = document.createElement("div");
    txt.className = "sh-bar-txt";
    txt.innerHTML = `<b>${bi.icon} ${bi.name}</b> <i style="color:${RARITIES[bi.rarity].color}">${RARITIES[bi.rarity].name}</i>`;
    const buy = document.createElement("button");
    buy.className = "btn-primary";
    buy.textContent = need > 0 ? `Te faltan ${need} 🍫✨ para comprarlo` : `Comprar · 🍫✨ ${bi.price}`;
    buy.disabled = need > 0;
    buy.addEventListener("click", () => {
      if (!buyFurniture(progress, bi.id)) return;
      audio.playPurchase();
      showToast(`¡Compraste ${bi.name}! 🎉 Ahora está en 🎒 Lo que tengo`);
      const where = housePreview ? { ...housePreview } : null;
      houseBuying = null;
      clearFurniturePreview();
      placeFurniture(bi.id, null, where);
      renderHouse();
      refreshHubStats();
    });
    const cancel = document.createElement("button");
    cancel.className = "btn-secondary";
    cancel.textContent = "Cancelar";
    cancel.addEventListener("click", () => { houseBuying = null; clearFurniturePreview(); renderHouse(); });
    houseBarEl.append(txt, buy, cancel);
  } else {
    houseBarEl.className = "sh-bar hint";
    houseBarEl.innerHTML = `<div class="sh-bar-txt">${houseView === "own" ? "Toca un mueble tuyo para ponerlo (o arrástralo al cuarto)." : "Toca un mueble para verlo en tu cuarto antes de comprarlo."} Toca uno puesto para moverlo, girarlo o cambiarle el tamaño.</div>`;
  }
}

function renderHouseStyle() {
  const wantOwn = houseView === "own";
  STYLE_SPOTS.forEach((s) => {
    const n = houseItemsOfSpot(s.id).filter((i) => ownsHouseItem(progress, i.id) === wantOwn).length;
    const btn = document.createElement("button");
    btn.className = "sh-tab" + (s.id === houseSpot ? " active" : "");
    btn.innerHTML = `<span>${s.icon}</span><b>${s.name}</b><i class="sh-count">${n}</i>`;
    btn.addEventListener("click", () => { houseSpot = s.id; renderHouse(); });
    houseTabsEl.appendChild(btn);
  });
  if (!STYLE_SPOTS.some((s) => s.id === houseSpot)) houseSpot = "floor";
  const placed = placedWithDefaults(progress);
  const addCard = (item) => {
    const id = item ? item.id : "";
    const owned = !item || ownsHouseItem(progress, id);
    const equipped = (placed[houseSpot] || "") === id && !houseTrial[houseSpot];
    const trying = houseTrial[houseSpot] === id && id !== "";
    const card = document.createElement("button");
    card.type = "button";
    card.className = "sh-card" + (equipped ? " equipped" : "") + (trying ? " trying" : "") + (!owned ? " locked" : "");
    if (item) card.style.setProperty("--rar", RARITIES[item.rarity].color);
    card.innerHTML = `<span class="sh-ico">${item ? item.icon : "🚫"}</span><span class="sh-name">${item ? item.name : "Nada"}</span>` +
      `<span class="sh-price">${equipped ? "✓ Puesto" : owned ? (item && item.price ? "Tuyo" : "Gratis") : `🍫✨ ${item.price}`}</span>`;
    card.addEventListener("click", () => {
      if (owned) {
        placeHouseItem(progress, houseSpot, id);
        delete houseTrial[houseSpot];
        audio.playJump();
      } else houseTrial[houseSpot] = id;
      renderHouse();
      house3d && house3d.setPlaced(housePlaced());
    });
    houseGridEl.appendChild(card);
  };
  if (wantOwn && houseSpot !== "floor" && houseSpot !== "wall") addCard(null);
  const listed = houseItemsOfSpot(houseSpot).filter((i) => ownsHouseItem(progress, i.id) === wantOwn);
  if (!listed.length && !(wantOwn && houseSpot !== "floor" && houseSpot !== "wall")) addEmptyNote(houseGridEl, houseView, "¡Ya tienes todo de esta categoría! 🎉", "Aquí aún no tienes nada. ¡Mira lo que hay por comprar!", () => { houseView = wantOwn ? "buy" : "own"; houseTrial = {}; renderHouse(); house3d && house3d.setPlaced(housePlaced()); });
  listed.forEach(addCard);

  const tid = houseTrial[houseSpot];
  const titem = tid ? getHouseItem(tid) : null;
  if (titem) {
    const need = titem.price - progress.coins;
    const txt = document.createElement("div");
    txt.className = "sh-bar-txt";
    txt.innerHTML = `<b>${titem.icon} ${titem.name}</b> <i style="color:${RARITIES[titem.rarity].color}">${RARITIES[titem.rarity].name}</i>`;
    const buy = document.createElement("button");
    buy.className = "btn-primary";
    buy.textContent = need > 0 ? `Te faltan ${need} Matipuntos` : `Comprar · 🍫✨ ${titem.price}`;
    buy.disabled = need > 0;
    buy.addEventListener("click", () => {
      if (!buyHouseItem(progress, titem.id)) return;
      delete houseTrial[houseSpot];
      audio.playPurchase();
      showToast(`¡Compraste ${titem.name}! 🎉 Ahora está en 🎒 Lo que tengo`);
      renderHouse();
      house3d && house3d.setPlaced(housePlaced());
      refreshHubStats();
    });
    const cancel = document.createElement("button");
    cancel.className = "btn-secondary";
    cancel.textContent = "Quitar";
    cancel.addEventListener("click", () => { delete houseTrial[houseSpot]; renderHouse(); house3d && house3d.setPlaced(housePlaced()); });
    houseBarEl.append(txt, buy, cancel);
  } else {
    houseBarEl.innerHTML = `<div class="sh-bar-txt">${houseView === "own" ? "Toca uno de los tuyos para ponerlo." : "Toca uno para verlo puesto antes de comprarlo; si te gusta, lo compras con Matipuntos."}</div>`;
  }
}

function renderHouseSize() {
  const cur = houseSize(progress);
  HOUSE_SIZES.forEach((sz) => {
    const owned = sz.level <= cur.level;
    const next = sz.level === cur.level + 1;
    const looking = housePreviewSize === sz.size;
    const card = document.createElement("button");
    card.type = "button";
    card.className = "sh-card sh-size" + (sz.level === cur.level ? " equipped" : "") + (looking ? " trying" : "") + (!owned ? " locked" : "");
    card.innerHTML = `<span class="sh-ico">${sz.icon}</span><span class="sh-name">${sz.name}</span><small>${sz.size} × ${sz.size}</small>` +
      `<span class="sh-price">${sz.level === cur.level ? "✓ Tu casa" : owned ? "Tuya" : `🍫✨ ${sz.price}`}</span>`;
    card.addEventListener("click", () => {
      // siempre se puede mirar cómo se vería (aunque todavía no alcance para comprarla)
      housePreviewSize = owned ? null : sz.size;
      house3d && house3d.setSize(owned ? cur.size : sz.size); // tocar una que ya tienes vuelve a tu casa
      renderHouse();
    });
    houseGridEl.appendChild(card);
  });
  const look = housePreviewSize && HOUSE_SIZES.find((z) => z.size === housePreviewSize);
  if (look) {
    const next = look.level === cur.level + 1;
    const need = look.price - progress.coins;
    const txt = document.createElement("div");
    txt.className = "sh-bar-txt";
    txt.innerHTML = `<b>${look.icon} ${look.name}</b> · ${look.size} × ${look.size} — ${look.blurb}`;
    const buy = document.createElement("button");
    buy.className = "btn-primary";
    buy.textContent = !next ? "🔒 Compra primero la anterior" : need > 0 ? `Te faltan ${need} 🍫✨` : `Comprar · 🍫✨ ${look.price}`;
    buy.disabled = !next || need > 0;
    buy.addEventListener("click", () => {
      if (!buyHouseSize(progress, look.level)) return;
      audio.playPurchase();
      showToast(`¡Ahora tienes una ${look.name.toLowerCase()}! 🎉`);
      housePreviewSize = null;
      houseMode = "decor";
      renderHouse();
      refreshHubStats();
    });
    const cancel = document.createElement("button");
    cancel.className = "btn-secondary";
    cancel.textContent = "Volver a mi casa";
    cancel.addEventListener("click", () => { clearSizePreview(); renderHouse(); });
    houseBarEl.append(txt, buy, cancel);
  } else {
    houseBarEl.className = "sh-bar hint";
    houseBarEl.innerHTML = `<div class="sh-bar-txt">Toca una casa para <b>verla</b> antes de comprarla. ${cur.level >= HOUSE_SIZES.length - 1 ? "¡Ya tienes la más grande!" : `Próxima: <b>${HOUSE_SIZES[cur.level + 1].name}</b> por 🍫✨ ${HOUSE_SIZES[cur.level + 1].price}.`}</div>`;
  }
}

// ---------- MI AVENTURA: nivel, misiones, racha y álbum ----------

// avisos que llegan desde cualquier juego (subir de nivel, misión cumplida...)
const toastQueue = [];
function queueToast(msg) {
  toastQueue.push(msg);
  if (toastQueue.length === 1) drainToasts();
}
function drainToasts() {
  if (!toastQueue.length) return;
  showToast(toastQueue[0]);
  setTimeout(() => { toastQueue.shift(); drainToasts(); }, 2800);
}
onProgressEvent((ev) => {
  if (ev.type === "level") queueToast(`⭐ ¡Nivel ${ev.level}! +${ev.coins} Matipuntos` + (ev.gift ? ` · Regalo: ${ev.gift.icon || "🎁"} ${ev.gift.name}` : "") + " · +1 sobre 📦");
  else if (ev.type === "mission") queueToast(`🎯 ¡Misión cumplida! Reclámala en Mi aventura (${ev.missions.length})`);
  else if (ev.type === "pack") queueToast("📦 ¡Ganaste un sobre de figuritas!");
  if (progress) { refreshHubStats(); }
});

const pgMissionsEl = document.getElementById("pg-missions");
const pgChestBtn = document.getElementById("pg-chest");
const pgOpenPackBtn = document.getElementById("pg-open-pack");
const packOverlay = document.getElementById("pack-overlay");

document.getElementById("btn-open-progress").addEventListener("click", () => {
  showScreen(screenProgress);
  renderProgress();
});
document.getElementById("btn-progress-back").addEventListener("click", () => {
  refreshHubStats();
  if (fromTown) goToHub();
  else showScreen(screenHub);
});

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function renderProgress() {
  document.getElementById("pg-coins").textContent = String(progress.coins);
  // nivel
  const lv = levelInfo(progress.xp);
  document.getElementById("pg-level").textContent = String(lv.level);
  document.getElementById("pg-level-name").textContent = `Nivel ${lv.level}`;
  document.getElementById("pg-xp-fill").style.width = `${Math.round((lv.into / lv.need) * 100)}%`;
  document.getElementById("pg-xp-text").textContent = `${lv.into} / ${lv.need} XP`;
  const nextGift = Object.keys(LEVEL_GIFTS).map(Number).filter((l) => l > lv.level).sort((a, b) => a - b)[0];
  const giftItem = nextGift ? getItem(LEVEL_GIFTS[nextGift]) : null;
  document.getElementById("pg-level-next").textContent = giftItem ? `Próximo regalo en el nivel ${nextGift}: ${giftItem.icon || "🎁"} ${giftItem.name}` : "¡Tienes todos los regalos de nivel!";

  // misiones
  const d = ensureDaily(progress);
  pgMissionsEl.innerHTML = "";
  d.missions.forEach((m, i) => {
    const prog = missionProgress(progress, m);
    const done = missionDone(progress, m);
    const card = el("div", "pg-mission" + (m.claimed ? " claimed" : done ? " done" : ""));
    const body = el("div", "pg-m-body");
    body.appendChild(el("div", "pg-m-name", missionLabel(m)));
    const bar = el("div", "pg-m-bar");
    const fill = el("i");
    fill.style.width = `${Math.round((prog / m.target) * 100)}%`;
    bar.appendChild(fill);
    bar.appendChild(el("span", null, `${prog} / ${m.target}`));
    body.appendChild(bar);
    body.appendChild(el("div", "pg-m-reward", `+${m.coins} 🍫✨  +${m.xp} XP`));
    const btn = el("button", done && !m.claimed ? "btn-primary" : "btn-secondary", m.claimed ? "Reclamada ✓" : done ? "Reclamar" : "En curso");
    btn.disabled = m.claimed || !done;
    btn.addEventListener("click", () => {
      const r = claimMission(progress, i);
      if (!r) return;
      audio.playPurchase();
      showToast(`¡+${r.coins} Matipuntos y +${r.xp} XP! 🎉`);
      refreshHubStats();
      renderProgress();
    });
    card.appendChild(body);
    card.appendChild(btn);
    pgMissionsEl.appendChild(card);
  });
  pgChestBtn.disabled = !canClaimChest(progress);
  pgChestBtn.textContent = d.chest ? "🎁 Cofre del día abierto ✓" : "🎁 Cofre del día (completa las 3 misiones)";

  // racha y recompensa diaria
  const streak = progress.dailyStreak || 0;
  const claimedToday = !canClaimDailyReward(progress);
  document.getElementById("pg-streak-text").textContent = streak > 0 ? `🔥 Racha: ${streak} día${streak === 1 ? "" : "s"} seguidos` : "🔥 ¡Empieza tu racha hoy!";
  const days = document.getElementById("pg-streak-days");
  days.innerHTML = "";
  const filled = claimedToday ? ((streak - 1) % 7) + 1 : streak % 7;
  for (let i = 0; i < 7; i++) {
    const reward = Math.min(10 + i * 5, 50);
    const day = el("div", "pg-day" + (i < filled ? " on" : ""), i < filled ? "🔥" : String(i + 1));
    day.title = `Día ${i + 1}: +${reward}`;
    days.appendChild(day);
  }
  const dailyBtn = document.getElementById("pg-daily");
  dailyBtn.disabled = claimedToday;
  dailyBtn.textContent = claimedToday ? "🎁 Recompensa de hoy reclamada ✓" : "🎁 Reclamar recompensa diaria";

  // álbum
  const have = albumCount(progress);
  document.getElementById("pg-album-count").textContent = `${have} / ${ALBUM_TOTAL}`;
  const packs = progress.packs || 0;
  pgOpenPackBtn.disabled = packs <= 0;
  pgOpenPackBtn.textContent = packs > 0 ? `📦 Abrir sobre (${packs})` : "📦 Sin sobres";
  document.getElementById("pg-packs-text").textContent = "Ganas sobres al subir de nivel, cada 5 partidas y con el cofre del día. Cada sobre trae 3 figuritas al azar.";
  const albumEl = document.getElementById("pg-album");
  albumEl.innerHTML = "";
  const pts = sparePoints(progress);
  for (const pg of PAGES) {
    const st = pageStatus(progress, pg);
    albumEl.appendChild(el("h3", "pg-page-title" + (st.have >= st.total ? " ok" : ""), `${pg.icon} ${pg.title} · ${st.have}/${st.total}${st.have >= st.total ? " ✅" : ` (premio: +${pg.reward} 🍫✨)`}`));
    const grid = el("div", "pg-album-grid");
    STICKERS.filter((x) => x.page === pg.id).forEach((st2) => {
      const n = (progress.album || {})[st2.id] || 0;
      const canTrade = !n && pts >= tradeCost(st2);
      const card = el("div", "pg-sticker" + (n ? " got" : "") + (st2.foil ? " foil" : "") + (canTrade ? " tradable" : ""));
      if (n) {
        card.appendChild(stickerArt(st2));
        if (n > 1) card.appendChild(el("b", "pg-s-n", `x${n}`));
      } else card.appendChild(el("span", "pg-s-q", st2.foil ? "✨?" : "?"));
      card.appendChild(el("span", "pg-s-name", n ? st2.name : st2.foil ? "Brillante" : "Sin descubrir"));
      if (canTrade) {
        card.title = `Cambiar ${tradeCost(st2)} repetidas por esta figurita`;
        card.addEventListener("click", () => {
          if (!window.confirm(`¿Cambiar ${tradeCost(st2)} repetidas por «${st2.name}»?`)) return;
          const r = tradeFor(progress, st2.id);
          if (!r) return;
          audio.playBonusCollect();
          showToast(`🔄 ¡Conseguiste «${st2.name}»!${r.rewards.length ? " " + r.rewards.map((m) => `🏆 ${m.text}: +${m.coins} 🍫✨`).join(" · ") : ""}`);
          refreshHubStats();
          renderProgress();
        });
      }
      grid.appendChild(card);
    });
    albumEl.appendChild(grid);
  }
  const tools = document.getElementById("pg-album-tools");
  if (tools) {
    const spare = spareCount(progress);
    tools.innerHTML = "";
    tools.appendChild(el("div", "pg-hint", spare ? `♻️ Tienes ${spare} figuritas repetidas (valen ${pts} puntos de cambio). Véndelas por Matipuntos, o toca una figurita que te falte para cambiarla: ${TRADE_NORMAL} repetidas por una normal, ${TRADE_FOIL} por una brillante (una brillante repetida vale 3).` : "♻️ Aquí aparecen tus repetidas: las puedes vender por Matipuntos o cambiarlas por las figuritas que te faltan."));
    const sell = el("button", "btn-secondary", `💰 Vender repetidas (+${sellValue(progress)} 🍫✨)`);
    sell.type = "button";
    sell.disabled = spare <= 0;
    sell.addEventListener("click", () => {
      if (!window.confirm(`¿Vender ${spare} repetidas por ${sellValue(progress)} Matipuntos? (Te quedas con una de cada figurita)`)) return;
      const r = sellSpares(progress);
      if (!r) return;
      audio.playPurchase();
      showToast(`💰 Vendiste ${r.n} repetidas: +${r.coins} Matipuntos`);
      refreshHubStats();
      renderProgress();
    });
    tools.appendChild(sell);
  }
  const ms = document.getElementById("pg-milestones");
  ms.innerHTML = "";
  ALBUM_MILESTONES.forEach((m) => {
    const ok = (progress.albumClaimed || []).includes(m.at);
    const item = m.item ? getItem(m.item) : null;
    ms.appendChild(el("div", "pg-ms" + (ok ? " ok" : ""), `${ok ? "✅" : "🔒"} ${m.text}: +${m.coins} 🍫✨${item ? ` y ${item.name}` : ""}`));
  });
}

document.getElementById("pg-chest").addEventListener("click", () => {
  const r = claimChest(progress);
  if (!r) return;
  audio.playVictory();
  showToast(`🎁 ¡Cofre abierto! +${r.coins} Matipuntos, +${r.xp} XP y un sobre`);
  refreshHubStats();
  renderProgress();
});
document.getElementById("pg-daily").addEventListener("click", () => {
  const result = claimDailyReward(progress);
  if (!result) return;
  audio.playPurchase();
  refreshHubStats();
  updateDailyRewardButton();
  showToast(`¡+${result.reward} Matipuntos! Racha de ${result.streak} día${result.streak === 1 ? "" : "s"} 🔥`);
  renderProgress();
});

/** Dibujo de una figurita: foto del producto, o un emoji sobre un fondo de color. */
function stickerArt(s) {
  const d = el("div", "stk-art");
  d.style.background = `radial-gradient(circle at 30% 25%, ${s.color}cc, ${s.color})`;
  if (s.img) {
    // la foto va en un círculo con marco dorado, sobre un fondo de color (se ve más cuidado que la foto cruda)
    const img = document.createElement("img");
    img.src = s.img;
    img.alt = s.name;
    img.className = s.logo ? "stk-photo stk-logo" : "stk-photo";
    d.appendChild(img);
  } else d.textContent = s.emoji || "⭐";
  return d;
}

pgOpenPackBtn.addEventListener("click", () => {
  const r = openPack(progress);
  if (!r) return;
  audio.playBonusCollect();
  const wrap = document.getElementById("pack-cards");
  wrap.innerHTML = "";
  r.stickers.forEach((s, i) => {
    const card = el("div", "pk-card" + (s.foil ? " foil" : ""));
    card.style.animationDelay = `${i * 0.35}s`;
    card.appendChild(stickerArt(s));
    card.appendChild(el("span", "pk-c-name", s.name));
    if (s.isNew) card.appendChild(el("b", "pk-c-new", "¡NUEVA!"));
    wrap.appendChild(card);
  });
  document.getElementById("pack-rewards").textContent = r.rewards.length
    ? r.rewards.map((m) => `🏆 ${m.text}: +${m.coins} Matipuntos${m.item ? ` y ${getItem(m.item)?.name}` : ""}`).join(" · ")
    : "";
  packOverlay.classList.remove("hidden");
  refreshHubStats();
  renderProgress();
});
document.getElementById("pack-close").addEventListener("click", () => packOverlay.classList.add("hidden"));

// En el celular las secciones secundarias empiezan plegadas (más espacio); en el computador, abiertas.
function foldSecondary() {
  const touch = window.matchMedia("(pointer: coarse)").matches;
  document.querySelectorAll("details.how").forEach((d) => { d.open = !touch; });
  const album = document.getElementById("pg-album-fold");
  if (album) album.open = !touch;
}
foldSecondary();

// ---------- LOGROS ----------

const achievementListEl = document.getElementById("achievement-list");

document.getElementById("btn-open-achievements").addEventListener("click", () => {
  showScreen(screenAchievements);
  renderAchievements();
});
document.getElementById("btn-achievements-back").addEventListener("click", () => showScreen(screenHub));

let achOpen = null; // categorías de logros abiertas (null = decidir al abrir por primera vez)
function renderAchievements() {
  achievementListEl.innerHTML = "";
  const isClaimed = (a) => progress.claimedAchievements.includes(a.id);
  const total = ACHIEVEMENTS.length;
  const claimedN = ACHIEVEMENTS.filter(isClaimed).length;
  const ready = ACHIEVEMENTS.filter((a) => !isClaimed(a) && a.isDone(progress)).length;
  const sum = document.createElement("div");
  sum.className = "ach-summary";
  sum.innerHTML = `<b>🏅 ${claimedN} / ${total}</b> logros reclamados` + (ready ? ` · <span class="ach-ready">🎁 ${ready} por reclamar</span>` : "");
  achievementListEl.appendChild(sum);

  // una lista desplegable por categoría (se abren las que tienen premios por reclamar)
  const groups = new Map();
  const groupFor = (catId) => {
    if (groups.has(catId)) return groups.get(catId);
    const cat = ACH_CATEGORIES.find((c) => c.id === catId);
    const catChains = ACHIEVEMENT_CHAINS.filter((c) => c.cat === catId);
    const catTiers = catChains.flatMap((c) => c.tiers);
    const catReady = catTiers.filter((t) => !isClaimed(t) && t.isDone(progress)).length;
    const catDone = catTiers.filter(isClaimed).length;
    const det = document.createElement("details");
    det.className = "ach-group";
    if (achOpen === null) achOpen = new Set(ACH_CATEGORIES.filter((c) => ACHIEVEMENTS.some((t) => t.cat === c.id && !isClaimed(t) && t.isDone(progress))).map((c) => c.id));
    det.open = achOpen.has(catId);
    det.addEventListener("toggle", () => { if (det.open) achOpen.add(catId); else achOpen.delete(catId); });
    const sm = document.createElement("summary");
    sm.innerHTML = `<span>${cat.icon} ${cat.name}</span><span class="ach-count">${catDone}/${catTiers.length}</span>` + (catReady ? `<span class="ach-ready">🎁 ${catReady}</span>` : "");
    det.appendChild(sm);
    const body = document.createElement("div");
    body.className = "ach-body";
    det.appendChild(body);
    achievementListEl.appendChild(det);
    groups.set(catId, body);
    return body;
  };

  ACHIEVEMENT_CHAINS.forEach((chain) => {
    const container = groupFor(chain.cat);
    // el escalón que toca: el primero sin reclamar (si ya están todos, el último)
    const idx = chain.tiers.findIndex((t) => !isClaimed(t));
    const complete = idx === -1;
    const a = chain.tiers[complete ? chain.tiers.length - 1 : idx];
    const done = a.isDone(progress);
    const claimed = isClaimed(a);
    const pr = achievementProgress(a, progress);

    const card = document.createElement("div");
    card.className = "achievement-card" + (done ? " done" : "") + (complete ? " complete" : "");
    const icon = document.createElement("span");
    icon.className = "aicon";
    icon.textContent = a.icon;
    const body = document.createElement("div");
    body.className = "abody";
    const name = document.createElement("span");
    name.className = "aname";
    name.textContent = chain.tiers.length > 1 ? a.name : chain.name;
    const desc = document.createElement("div");
    desc.className = "adesc";
    desc.textContent = complete ? `¡Cadena completa! ${a.desc}` : `${a.desc} (+${a.reward} 🍫✨)`;
    body.append(name, desc);
    if (!complete) {
      const bar = document.createElement("div");
      bar.className = "abar";
      bar.innerHTML = `<i style="width:${Math.round((pr.cur / pr.max) * 100)}%"></i><span>${Math.floor(pr.cur).toLocaleString("es-CL")} / ${pr.max.toLocaleString("es-CL")}</span>`;
      body.appendChild(bar);
    }
    if (chain.tiers.length > 1) {
      const dots = document.createElement("div");
      dots.className = "adots";
      dots.textContent = chain.tiers.map((t) => (isClaimed(t) ? "●" : "○")).join(" ");
      body.appendChild(dots);
    }

    const button = document.createElement("button");
    if (complete || claimed) {
      button.textContent = "Reclamado ✓";
      button.disabled = true;
    } else if (done) {
      button.textContent = "Reclamar";
      button.addEventListener("click", () => {
        if (claimAchievement(progress, a)) {
          audio.playPurchase();
          refreshHubStats();
          renderAchievements();
          showToast(`¡Logro cumplido! +${a.reward} Matipuntos 🎉`);
        }
      });
    } else {
      button.textContent = "Bloqueado";
      button.disabled = true;
    }
    card.append(icon, body, button);
    container.appendChild(card);
  });
}

// ---------- SELECCIÓN DE PERSONAJE ----------

function characterCard(char) {
  const card = document.createElement("div");
  card.className = "character-card";
  card.tabIndex = 0;

  const canvas = document.createElement("canvas");
  canvas.width = 192;
  canvas.height = 192;
  paintAvatar(canvas, char);

  const label = document.createElement("span");
  label.className = "cname";
  label.textContent = char.name;

  card.appendChild(canvas);
  card.appendChild(label);
  card.addEventListener("click", () => selectCharacter(char));
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") selectCharacter(char);
  });

  return card;
}

function renderCharacterGrid() {
  grid.innerHTML = "";
  CHARACTERS.forEach((char) => {
    const card = characterCard(char);
    if (selectedCharacter && selectedCharacter.id === char.id) card.classList.add("selected");
    grid.appendChild(card);
  });
}

function selectCharacter(char) {
  selectedCharacter = char;
  progress.selectedCharacterId = char.id;
  saveProgress(progress);
  updateProfileMeta(progress._profileId, { characterId: char.id });
  renderCharacterGrid();
  renderGameGrid();
  updateProfileChip();
  syncLobby(true);
}

// ---------- SELECCIÓN DE JUEGO ----------

function gameThumb(entry) {
  const wrap = document.createElement("div");
  wrap.className = "gthumb";
  const img = document.createElement("img");
  img.src = `assets/games/${entry.id}.jpg`;
  img.alt = "";
  img.loading = "lazy";
  img.addEventListener("error", () => { img.remove(); wrap.textContent = entry.icon; wrap.style.cssText = "display:flex;align-items:center;justify-content:center;font-size:3rem"; });
  wrap.appendChild(img);
  if (entry.tag) {
    const tag = document.createElement("span");
    tag.className = "gtag";
    tag.textContent = entry.tag;
    wrap.appendChild(tag);
  }
  const ori = document.createElement("span");
  ori.className = `gorient ${entry.orient === "landscape" ? "land" : "any"}`;
  ori.textContent = entry.orient === "landscape" ? "📱 Horizontal" : "📱 Vertical u horizontal";
  wrap.appendChild(ori);
  const play = document.createElement("span");
  play.className = "gplay";
  play.textContent = "▶ Jugar";
  wrap.appendChild(play);
  if (needsUnlock(entry.id) && !isUnlocked(progress, entry.id)) {
    const lock = document.createElement("span");
    const can = progress.coins >= UNLOCK_COST[entry.id];
    lock.className = `glock${can ? " ready" : ""}`;
    lock.textContent = can ? `🔓 ¡Canjéalo! ${UNLOCK_COST[entry.id]} 🍫✨` : `🔒 ${UNLOCK_COST[entry.id]} 🍫✨`;
    wrap.appendChild(lock);
  }
  return wrap;
}

function renderGameGrid() {
  gameGrid.innerHTML = "";
  const featureEl = document.getElementById("game-feature");
  featureEl.innerHTML = "";
  const available = GAMES_CATALOG.filter((g) => g.status === "available" && isUnlocked(progress, g.id));
  const last = available.find((g) => g.id === progress.lastGameId);
  const featured = last || available.find((g) => g.id === "town") || available[0];

  if (featured) {
    featureEl.style.backgroundImage = `url("assets/games/${featured.id}.jpg")`;
    const best = getBestScore(progress, featured.id);
    featureEl.innerHTML = `<div class="lf-body"><span class="lf-kicker">${last ? "Seguir jugando" : "¡Novedad!"}</span>` +
      `<span class="lf-name"></span><span class="lf-tag"></span>` +
      (best > 0 ? `<span class="lf-best">Tu mejor: ${best} pts</span>` : "") +
      `<button class="btn-primary" type="button">▶ ¡Jugar!</button></div>`;
    featureEl.querySelector(".lf-name").textContent = `${featured.icon} ${featured.name}`;
    featureEl.querySelector(".lf-tag").textContent = featured.tagline;
    featureEl.onclick = () => playGame(featured.id);
  }

  GAMES_CATALOG.forEach((entry) => {
    if (featured && entry.id === featured.id) return;
    const card = document.createElement("div");
    const locked = needsUnlock(entry.id) && !isUnlocked(progress, entry.id);
    card.className = `game-card ${entry.status}${locked ? " locked" : ""}`;
    card.appendChild(gameThumb(entry));

    const body = document.createElement("div");
    body.className = "gbody";
    const name = document.createElement("span");
    name.className = "gname";
    name.textContent = `${entry.icon} ${entry.name}`;
    const tagline = document.createElement("span");
    tagline.className = "gtagline";
    tagline.textContent = entry.tagline;
    body.append(name, tagline);

    if (entry.status === "available") {
      const best = getBestScore(progress, entry.id);
      if (best > 0) {
        const bestEl = document.createElement("span");
        bestEl.className = "gbest";
        bestEl.textContent = `Tu mejor: ${best} pts`;
        body.appendChild(bestEl);
      }
      card.addEventListener("click", () => playGame(entry.id));
    }
    card.appendChild(body);
    gameGrid.appendChild(card);
  });
}

// ---------- CANJE DE JUEGOS CON MATIPUNTOS ----------

const unlockDialog = document.getElementById("unlock-dialog");
let unlockTarget = null;

function openUnlockDialog(entry) {
  unlockTarget = entry;
  const cost = UNLOCK_COST[entry.id];
  const missing = cost - progress.coins;
  document.getElementById("um-icon").textContent = entry.icon;
  document.getElementById("um-title").textContent = entry.name;
  document.getElementById("um-text").textContent = missing > 0
    ? `${entry.tagline} Se desbloquea con ${cost} Matipuntos 🍫✨. Tienes ${progress.coins}: te faltan ${missing}. ¡Sigue jugando para juntarlos!`
    : `${entry.tagline} ¿Lo canjeas por ${cost} Matipuntos 🍫✨? Es tuyo para siempre.`;
  const buy = document.getElementById("um-buy");
  buy.textContent = missing > 0 ? `Te faltan ${missing} 🍫✨` : `🔓 Canjear por ${cost} 🍫✨`;
  buy.disabled = missing > 0;
  unlockDialog.classList.remove("hidden");
}

// ---- ranking de todos los jugadores: el botón solo aparece si el creador abrió el ranking en el servidor ----
const btnWorldRanking = document.getElementById("btn-world-ranking");
const worldRanking = document.getElementById("world-ranking");
async function showWorldRanking() {
  const sel = document.getElementById("wr-game");
  const list = document.getElementById("wr-list");
  const load = async () => {
    list.innerHTML = "<li>Cargando…</li>";
    const rows = await fetchRanking(sel.value, 20);
    list.innerHTML = rows.length ? rows.map((r) => `<li><span>${escapeHtml(r.nick)}</span><b>${Math.round(r.score)}</b></li>`).join("") : "<li>Todavía no hay puntajes aquí.</li>";
  };
  if (!sel.options.length) {
    for (const [id, name] of Object.entries(GAME_NAMES)) if (id !== "fps3d" && id !== "creador" && id !== "ciudad") sel.add(new Option(name, id));
    sel.addEventListener("change", load);
  }
  worldRanking.classList.remove("hidden");
  load();
}
if (btnWorldRanking) {
  btnWorldRanking.addEventListener("click", showWorldRanking);
  document.getElementById("wr-close").addEventListener("click", () => worldRanking.classList.add("hidden"));
  rankingEnabled().then((on) => btnWorldRanking.classList.toggle("hidden", !on));
}
function escapeHtml(t) { return String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

document.getElementById("um-cancel").addEventListener("click", () => { unlockDialog.classList.add("hidden"); unlockTarget = null; });
document.getElementById("um-buy").addEventListener("click", () => {
  if (!unlockTarget || !unlockGame(progress, unlockTarget.id)) return;
  const entry = unlockTarget;
  unlockTarget = null;
  unlockDialog.classList.add("hidden");
  audio.playPurchase();
  showToast(`¡Desbloqueaste ${entry.name}! 🎉`);
  refreshHubStats();
  renderGameGrid();
  playGame(entry.id);
});
document.getElementById("demo-wall-close").addEventListener("click", () => document.getElementById("demo-wall").classList.add("hidden"));

function playGame(gameId) {
  if (!selectedCharacter) {
    window.alert("Elige primero a tu Matichico.");
    return;
  }
  const entry = GAMES_CATALOG.find((g) => g.id === gameId);
  if (entry && needsUnlock(gameId) && !isUnlocked(progress, gameId)) {
    openUnlockDialog(entry);
    return;
  }
  if (!progress.playerName) {
    progress.playerName = "Jugador";
    inputName.value = progress.playerName;
    saveProgress(progress);
  }

  if (gameId !== "town") progress.lastGameId = gameId;
  saveProgress(progress);

  // Nunca deben quedar dos juegos "activos" a la vez (evita que uno siga
  // corriendo lógica de fondo mientras se muestra el otro).
  Object.values(instances).forEach((instance) => instance && instance.pauseForMenu());

  currentGameId = gameId;
  checkOrientation();
  if (gameId === "fps3d") {
    showScreen(screenFps);
    launchOrResumeFps();
  } else if (GAMES_3D[gameId]) {
    showScreen(screen3d[gameId]);
    launchOrResume3d(gameId);
  }
}

// Si saliste del pueblo para jugar o comprar algo, al terminar vuelves al pueblo y no al menú.
let fromTown = false;
window.addEventListener("town-action", (e) => {
  const { kind, game } = e.detail;
  fromTown = true;
  if (kind === "game") playGame(game);
  else if (kind === "creador") playGame("creador");
  else if (kind === "shop") btnOpenShop.click();
  else if (kind === "album") document.getElementById("btn-open-progress").click();
  else if (kind === "house") document.getElementById("btn-open-house").click();
});

function goToHub() {
  if (fromTown) {
    fromTown = false;
    playGame("town");
    return;
  }
  Object.values(instances).forEach((instance) => instance && instance.pauseForMenu());
  currentGameId = null;
  checkOrientation();
  refreshHubStats();
  renderCharacterGrid();
  renderGameGrid();
  updateDailyRewardButton();
  showScreen(screenHub);
}

// ---------- TIENDA / VESTUARIO ----------
// Se elige un objeto para probárselo en el avatar grande; si ya es tuyo se pone de una,
// si no, se puede comprar con Matipuntos. Todo se paga con los puntos que se ganan jugando.

const btnOpenShop = document.getElementById("btn-open-shop");
const btnShopBack = document.getElementById("btn-shop-back");
const shopCoinsEl = document.getElementById("shop-coins");
const shopCharacterSwitcher = document.getElementById("shop-character-switcher");
const shopCharacterNameEl = document.getElementById("shop-character-name");
const shopTabsEl = document.getElementById("shop-tabs");
const shopGridEl = document.getElementById("shop-grid");
const shopBarEl = document.getElementById("shop-bar");

let shopSlot = SLOTS[0].id;
let shopView = "buy"; // "buy" = lo que falta por comprar, "own" = lo que ya tengo
let shopTrial = {}; // objetos que se están probando y todavía no son tuyos: { [slot]: itemId }
let shopLobby = null;

btnOpenShop.addEventListener("click", () => {
  shopTrial = {};
  shopView = "buy";
  showScreen(screenShop);
  renderShop();
  openShopPreview();
});

btnShopBack.addEventListener("click", () => {
  shopTrial = {};
  if (shopLobby) shopLobby.setActive(false);
  refreshHubStats();
  renderCharacterGrid();
  if (fromTown) goToHub();
  else showScreen(screenHub);
});

function shopChar() {
  return CHARACTERS.find((c) => c.id === shopCharacterId) || CHARACTERS[0];
}

function shopLook() {
  return { ...getLook(progress, shopChar().id), ...shopTrial };
}

async function openShopPreview() {
  try {
    if (!shopLobby) {
      const { Lobby3D } = await import("./lobby3d.js?v=64565862c1");
      shopLobby = new Lobby3D(document.getElementById("shop-canvas"));
      shopLobby.init();
    }
    refreshShopPreview(true);
    shopLobby.setActive(true);
  } catch (err) {
    console.warn("Vista previa 3D no disponible:", err);
  }
}

function refreshShopPreview(force = false) {
  if (!shopLobby || !shopLobby.ready) return;
  const look = shopLook();
  const key = `${shopChar().id}|${Object.values(look).join(",")}`;
  if (force || shopLobby.key !== key) shopLobby.setHero(shopChar(), look, key);
  shopLobby.setView(shopSlot === "back" ? Math.PI : 0);
}

/** Lo que se muestra como precio de un objeto (Matipuntos, o fichas si es de un evento). */
function priceLabel(item) {
  if (!item.event) return `🍫✨ ${item.price}`;
  const e = eventById(item.event);
  return eventItemAvailable(item) ? `${e.token} ${item.tokens}` : `🔒 ${e.icon} ${e.name}`;
}

function renderShop() {
  const ch = shopChar();
  shopCoinsEl.textContent = String(progress.coins);
  shopCharacterNameEl.textContent = ch.name;

  shopCharacterSwitcher.innerHTML = "";
  CHARACTERS.forEach((c) => {
    const btn = document.createElement("button");
    btn.className = "shop-switch-btn" + (c.id === shopCharacterId ? " active" : "");
    btn.title = c.name;
    const canvas = document.createElement("canvas");
    canvas.width = 96;
    canvas.height = 96;
    paintAvatar(canvas, c);
    btn.appendChild(canvas);
    btn.addEventListener("click", () => {
      shopCharacterId = c.id;
      shopTrial = {};
      renderShop();
      refreshShopPreview(true);
    });
    shopCharacterSwitcher.appendChild(btn);
  });

  const wantOwn = shopView === "own";
  const allItems = SLOTS.flatMap((s) => itemsOfSlot(s.id));
  const nOwn = allItems.filter((i) => ownsItem(progress, i.id)).length;
  renderViewToggle(document.getElementById("shop-views"), shopView, { buy: allItems.length - nOwn, own: nOwn }, (v) => {
    shopView = v; shopTrial = {}; renderShop(); refreshShopPreview();
  });
  shopTabsEl.innerHTML = "";
  SLOTS.forEach((s) => {
    const n = itemsOfSlot(s.id).filter((i) => ownsItem(progress, i.id) === wantOwn).length;
    const btn = document.createElement("button");
    btn.className = "sh-tab" + (s.id === shopSlot ? " active" : "");
    btn.innerHTML = `<span>${s.icon}</span><b>${s.name}</b><i class="sh-count">${n}</i>`;
    btn.addEventListener("click", () => {
      shopSlot = s.id;
      renderShop();
      refreshShopPreview();
    });
    shopTabsEl.appendChild(btn);
  });

  const look = getLook(progress, ch.id);
  const items = itemsOfSlot(shopSlot).filter((i) => ownsItem(progress, i.id) === wantOwn);
  shopGridEl.innerHTML = "";
  const addCard = (item) => {
    const id = item ? item.id : "";
    const owned = ownsItem(progress, id);
    const equipped = (look[shopSlot] || "") === id && !shopTrial[shopSlot];
    const trying = shopTrial[shopSlot] === id && id !== "";
    const card = document.createElement("button");
    card.type = "button";
    card.className = "sh-card" + (equipped ? " equipped" : "") + (trying ? " trying" : "") + (!owned ? " locked" : "");
    if (item) card.style.setProperty("--rar", RARITIES[item.rarity].color);
    card.innerHTML = `<span class="sh-ico">${item ? item.icon : "🚫"}</span><span class="sh-name">${item ? item.name : "Normal"}</span>` +
      `<span class="sh-price">${equipped ? "✓ Puesto" : owned ? (item && item.price ? "Tuyo" : "Gratis") : priceLabel(item)}</span>`;
    card.addEventListener("click", () => {
      if (owned) {
        equipItem(progress, ch.id, shopSlot, id);
        delete shopTrial[shopSlot];
        audio.playJump();
      } else {
        shopTrial[shopSlot] = id;
      }
      renderShop();
      refreshShopPreview();
    });
    shopGridEl.appendChild(card);
  };
  if (wantOwn && shopSlot !== "outfit") addCard(null);
  if (!items.length && !(wantOwn && shopSlot !== "outfit")) addEmptyNote(shopGridEl, shopView, "¡Ya compraste todo de esta categoría! 🎉", "Aquí aún no tienes nada. ¡Mira lo que hay por comprar!", () => { shopView = wantOwn ? "buy" : "own"; shopTrial = {}; renderShop(); refreshShopPreview(); });
  items.forEach(addCard);

  // barra inferior: comprar lo que se está probando
  shopBarEl.innerHTML = "";
  const tid = shopTrial[shopSlot];
  const titem = tid ? getItem(tid) : null;
  if (titem) {
    const evt = titem.event ? eventById(titem.event) : null;
    const avail = !evt || eventItemAvailable(titem);
    const need = evt ? titem.tokens - eventTokens(progress, evt.id) : titem.price - progress.coins;
    const txt = document.createElement("div");
    txt.className = "sh-bar-txt";
    txt.innerHTML = `<b>${titem.icon} ${titem.name}</b> <i style="color:${RARITIES[titem.rarity].color}">${RARITIES[titem.rarity].name}</i>` + (evt ? ` · <small>Exclusivo de ${evt.name}</small>` : "");
    const buy = document.createElement("button");
    buy.className = "btn-primary";
    if (!avail) buy.textContent = `Vuelve en ${evt.name} ${evt.icon}`;
    else if (evt) buy.textContent = need > 0 ? `Te faltan ${need} fichas ${evt.token}` : `Comprar · ${evt.token} ${titem.tokens}`;
    else buy.textContent = need > 0 ? `Te faltan ${need} Matipuntos` : `Comprar · 🍫✨ ${titem.price}`;
    buy.disabled = !avail || need > 0;
    buy.addEventListener("click", () => {
      if (!(evt ? buyEventItem(progress, titem.id) : buyItem(progress, titem.id))) return;
      equipItem(progress, ch.id, shopSlot, titem.id);
      delete shopTrial[shopSlot];
      audio.playPurchase();
      showToast(`¡Compraste ${titem.name}! 🎉 Ahora está en 🎒 Lo que tengo`);
      renderShop();
      refreshShopPreview();
      refreshHubStats();
    });
    const cancel = document.createElement("button");
    cancel.className = "btn-secondary";
    cancel.textContent = "Quitar";
    cancel.addEventListener("click", () => {
      delete shopTrial[shopSlot];
      renderShop();
      refreshShopPreview();
    });
    shopBarEl.append(txt, buy, cancel);
  } else {
    shopBarEl.innerHTML = `<div class="sh-bar-txt">${wantOwn ? "Toca uno de tus objetos para ponértelo." : "Toca un objeto para probártelo antes de comprarlo. ¡Gana más Matipuntos jugando!"}</div>`;
  }
}

// ---------- TABLA DE PUNTAJES ----------

const btnOpenLeaderboard = document.getElementById("btn-open-leaderboard");
const btnLeaderboardBack = document.getElementById("btn-leaderboard-back");
const leaderboardTabs = document.getElementById("leaderboard-tabs");
const leaderboardList = document.getElementById("leaderboard-list");
const leaderboardEmpty = document.getElementById("leaderboard-empty");

const availableGames = GAMES_CATALOG.filter((g) => g.status === "available" && !g.noScore);
let leaderboardGameId = availableGames[0]?.id;

btnOpenLeaderboard.addEventListener("click", () => {
  showScreen(screenLeaderboard);
  renderLeaderboardTabs();
  renderLeaderboard();
});

btnLeaderboardBack.addEventListener("click", () => showScreen(screenHub));

function renderLeaderboardTabs() {
  leaderboardTabs.innerHTML = "";
  availableGames.forEach((g) => {
    const tab = document.createElement("button");
    tab.className = "leaderboard-tab" + (g.id === leaderboardGameId ? " active" : "");
    tab.textContent = `${g.icon} ${g.name}`;
    tab.addEventListener("click", () => {
      leaderboardGameId = g.id;
      renderLeaderboardTabs();
      renderLeaderboard();
    });
    leaderboardTabs.appendChild(tab);
  });
}

function renderLeaderboard() {
  leaderboardList.innerHTML = "";
  const board = getLeaderboard(progress, leaderboardGameId);
  const isEmpty = board.length === 0;
  leaderboardEmpty.classList.toggle("hidden", !isEmpty);
  leaderboardList.classList.toggle("hidden", isEmpty);
  if (isEmpty) return;
  board.forEach((entry) => {
    const li = document.createElement("li");
    const name = document.createElement("span");
    name.className = "lb-name";
    name.textContent = entry.name;
    const score = document.createElement("span");
    score.className = "lb-score";
    score.textContent = `${entry.score} pts`;
    li.appendChild(name);
    li.appendChild(score);
    leaderboardList.appendChild(li);
  });
}

// ---------- JUEGO: "RECOLECTA Y CORRE" ----------

function updateHudAvatar(imgId, character) {
  const hudAvatar = document.getElementById(imgId);
  const avatarCanvas = document.createElement("canvas");
  avatarCanvas.width = 80;
  avatarCanvas.height = 80;
  avatarCanvas.addEventListener("repainted", () => (hudAvatar.src = avatarCanvas.toDataURL()));
  paintAvatar(avatarCanvas, character);
  hudAvatar.src = avatarCanvas.toDataURL();
}

// ---------- JUEGO: "CHOCO BLASTER 3D" (primera persona, carga perezosa) ----------

async function launchOrResumeFps() {
  updateHudAvatar("fps-hud-avatar", selectedCharacter);
  try {
    if (!instances.fps) {
      showToast("Cargando el mundo 3D…");
      const { FpsGame } = await import("./fps-game.js?v=64565862c1");
      const q = (id) => document.getElementById(id);
      const els = {
        wrap: q("fps-canvas-wrap"),
        canvas: q("fps-canvas"),
        hudScore: q("fps-hud-score"),
        hudWave: q("fps-hud-wave"),
        hudCombo: q("fps-hud-combo"),
        hudCoins: q("fps-hud-coins"),
        hudHearts: q("fps-hearts"),
        hudAmmo: q("fps-ammo"),
        reloadBar: q("fps-reload-bar"),
        banner: q("fps-banner"),
        hitmarker: q("fps-hitmarker"),
        vignette: q("fps-vignette"),
        popups: q("fps-popups"),
        gameoverText: q("fps-gameover-text"),
        overlays: {
          intro: q("fps-overlay-intro"),
          paused: q("fps-overlay-paused"),
          gameover: q("fps-overlay-gameover"),
        },
        touch: {
          joyZone: q("fps-joy-zone"),
          joyKnob: q("fps-joy-knob"),
          lookZone: q("fps-look-zone"),
          btnFire: q("fps-btn-fire"),
          btnJump: q("fps-btn-jump"),
          btnReload: q("fps-btn-reload"),
        },
      };
      const fps = new FpsGame(selectedCharacter, progress, els);
      instances.fps = fps;

      q("fps-btn-start").addEventListener("click", () => fps.beginPlaying());
      q("fps-btn-resume").addEventListener("click", () => fps.resume());
      q("fps-btn-retry").addEventListener("click", () => fps.retry());
      q("fps-btn-menu").addEventListener("click", goToHub);
      q("fps-btn-paused-menu").addEventListener("click", goToHub);
      q("fps-btn-gameover-menu").addEventListener("click", goToHub);
      q("fps-btn-full").addEventListener("click", () => {
        if (document.fullscreenElement) document.exitFullscreen();
        else els.wrap.requestFullscreen?.();
      });
      const btnMute = q("fps-btn-mute");
      btnMute.addEventListener("click", () => {
        const next = !audio.isMuted();
        audio.setMuted(next);
        btnMute.textContent = next ? "🔇" : "🔊";
      });
    }
    await instances.fps.startRun(selectedCharacter, progress);
  } catch (err) {
    console.error(err);
    showToast(`Tu dispositivo no pudo cargar el modo 3D. [fps: ${errDetail(err)}]`, 9000);
    instances.fps = null;
    goToHub();
  }
}

/** Texto corto del error para mostrarlo en el aviso (sirve para saber qué falló en cada dispositivo). */
function errDetail(err) {
  const m = String((err && err.message) || err || "error").replace(/\s+/g, " ");
  return m.length > 90 ? `${m.slice(0, 90)}…` : m;
}

// ---------- JUEGOS 3D (Salto Choco, Autos de Chocolate, Memoria Matichoc) ----------
// Los tres comparten la base Game3D y la misma convención de ids en index.html:
// "<prefijo>-canvas", "-hud-<nombre>", "-overlay-<intro|win|gameover>", "-btn-*".

const GAMES_3D = {
  town: { module: "./town-game.js?v=64565862c1", cls: "TownGame", hud: [] },
  recolecta: { module: "./recolecta-game.js?v=64565862c1", cls: "RecolectaGame", hud: [] },
  basquet_tiros: { module: "./basquet3d-game.js?v=64565862c1", cls: "Basquet3DGame", hud: [], prefix: "basquet" },
  porristas: { module: "./porristas3d-game.js?v=64565862c1", cls: "Porristas3DGame", hud: ["score", "combo", "coins"] },
  parkour: { module: "./parkour-game.js?v=64565862c1", cls: "ParkourGame", hud: [] },
  tetris: { module: "./tetris3d-game.js?v=64565862c1", cls: "Tetris3DGame", hud: ["score", "lines", "level", "combo", "coins"] },
  salto: { module: "./salto-game.js?v=64565862c1", cls: "SaltoGame", hud: ["score", "height", "hearts", "combo", "coins"] },
  autos: { module: "./autos-game.js?v=64565862c1", cls: "AutosGame", hud: ["score", "speed", "hearts", "combo", "power", "coins"] },
  memoria: { module: "./memoria-game.js?v=64565862c1", cls: "MemoriaGame", hud: ["level", "moves", "time", "score", "coins"] },
  futbol: { module: "./futbol-game.js?v=64565862c1", cls: "FutbolGame", hud: [] },
  dulces: { module: "./dulces-game.js?v=64565862c1", cls: "DulcesGame", hud: [] },
  aventura: { module: "./aventura-game.js?v=64565862c1", cls: "AventuraGame", hud: [] },
  ciudad: { module: "./ciudad-game.js?v=64565862c1", cls: "CiudadGame", hud: [] },
  creador: { module: "./creador-game.js?v=64565862c1", cls: "CreadorGame", hud: ["score", "count", "coins"] },
};

async function launchOrResume3d(key) {
  const cfg = GAMES_3D[key];
  const pre = cfg.prefix || key; // prefijo de ids en index.html
  updateHudAvatar(`${pre}-hud-avatar`, selectedCharacter);
  try {
    if (!instances[key]) {
      showToast("Cargando el mundo 3D…");
      const mod = await import(cfg.module);
      const q = (id) => document.getElementById(`${pre}-${id}`);
      const els = {
        wrap: q("canvas-wrap"),
        canvas: q("canvas"),
        banner: q("banner"),
        popups: q("popups"),
        gameoverText: q("gameover-text"),
        overlays: { intro: q("overlay-intro"), gameover: q("overlay-gameover") },
        touch: { left: q("btn-left"), right: q("btn-right") },
        panel: q("panel"),
        q,
        winTitle: q("win-title"),
        winText: q("win-text"),
        stars: q("stars"),
      };
      for (const name of ["win", "lose", "victory"]) if (q(`overlay-${name}`)) els.overlays[name] = q(`overlay-${name}`);
      if (!els.overlays.gameover) delete els.overlays.gameover;
      for (const name of cfg.hud) els[`hud${name[0].toUpperCase()}${name.slice(1)}`] = q(`hud-${name}`);
      const game = new mod[cfg.cls](selectedCharacter, progress, els);
      instances[key] = game;
      if (location.search.includes("debug3d")) (window.__g3d = window.__g3d || {})[key] = game; // solo para pruebas

      if (q("btn-start")) q("btn-start").addEventListener("click", () => game.beginPlaying());
      if (q("btn-retry")) q("btn-retry").addEventListener("click", () => game.retry());
      if (q("btn-menu")) q("btn-menu").addEventListener("click", goToHub);
      if (q("btn-gameover-menu")) q("btn-gameover-menu").addEventListener("click", goToHub);
      if (q("btn-next")) q("btn-next").addEventListener("click", () => game.nextLevel());
      if (q("btn-win-menu")) q("btn-win-menu").addEventListener("click", goToHub);
      // Convención nueva: cualquier botón con data-action dentro de la pantalla.
      const actions = { begin: () => game.beginPlaying(), next: () => game.nextLevel(), retry: () => game.retry(), restart: () => game.restart?.() ?? game.startRun(selectedCharacter, progress), menu: goToHub };
      document.getElementById(`screen-${pre}`).querySelectorAll("[data-action]").forEach((btn) => {
        btn.addEventListener("click", () => actions[btn.dataset.action]?.());
      });
      const joy = q("joy");
      if (joy) bindStick(joy, (x, y) => game.setStick?.(x, y), document.getElementById(`${pre}-canvas-wrap`));
      const btnMute = q("btn-mute");
      btnMute.addEventListener("click", () => {
        const next = !audio.isMuted();
        audio.setMuted(next);
        btnMute.textContent = next ? "🔇" : "🔊";
      });
    }
    await instances[key].startRun(selectedCharacter, progress);
  } catch (err) {
    console.error(err);
    showToast(`Tu dispositivo no pudo cargar el modo 3D. [${key}: ${errDetail(err)}]`, 9000);
    instances[key] = null;
    goToHub();
  }
}

// ---------- ARRANQUE ----------

const existingProfiles = listProfiles();
const lastActiveId = getLastActiveProfileId();
if (lastActiveId && existingProfiles.some((p) => p.id === lastActiveId)) {
  chooseProfile(lastActiveId);
} else {
  goToProfiles();
}
