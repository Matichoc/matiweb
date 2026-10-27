// primero: si el navegador interno de la app perdió los datos, native.js restaura la copia antes de leer los perfiles
import "./native.js?v=fe581e124f";
import { CHARACTERS, getOutfit, renderCharacterThumb } from "./characters.js?v=fe581e124f";
import { SLOTS, RARITIES, getItem, itemsOfSlot, lockReason, CUSTOM_COLORS, CUSTOM_EMBLEMS, customizeOutfit, isHexColor } from "./wardrobe-data.js?v=fe581e124f";
import * as audio from "./audio.js?v=fe581e124f";
import { initSplash, markAppReady } from "./splash.js?v=fe581e124f";
import { IS_DEMO, demoAllows, showDemoWall } from "./demo.js?v=fe581e124f";
import { bindStick, joyMode, setJoyMode } from "./stick.js?v=fe581e124f";
import { UNLOCK_COST, needsUnlock, isUnlocked, unlockGame } from "./unlocks.js?v=fe581e124f";
import { GAMES_CATALOG } from "./games-catalog.js?v=fe581e124f";
import {
  loadProgress, saveProgress, storageKeyForProfile, ownsItem, getLook, equipItem, setOutfitCustom, buyItem, wearers, canWear, takeOff, wardrobeCopies,
  getBestScore, getLeaderboard, canClaimDailyReward, claimDailyReward, claimAchievement,
} from "./storage.js?v=fe581e124f";
import {
  listProfiles, createProfile, deleteProfile, updateProfileMeta,
  getLastActiveProfileId, setLastActiveProfileId, MAX_PROFILES,
} from "./profiles.js?v=fe581e124f";
import { ACHIEVEMENTS, ACHIEVEMENT_CHAINS, CATEGORIES as ACH_CATEGORIES, achievementProgress } from "./achievements.js?v=fe581e124f";
import { activeEvent, eventById, eventEnd, nextEvent, eventTokens, eventItemAvailable, buyEventItem } from "./events.js?v=fe581e124f";
import {
  HOUSE_SPOTS, houseItemsOfSpot, getHouseItem, ownsHouseItem, buyHouseItem, placeHouseItem, placedWithDefaults,
  FURN_CATEGORIES, furnitureOf, isWallItem, houseLayout, layoutAdd, layoutRemove, buyFurniture, copiesOf, placedCount, HOUSE_SIZES, houseSize, roomSizeLevel, houseSizeCost, buyHouseSize, moveRoom,
  ROOM_TYPES, MAX_ROOMS, roomType, roomsOf, nextRoomOf, roomHasBed, switchRoom, buyRoom,
} from "./house-data.js?v=fe581e124f";
import {
  levelInfo, LEVEL_GIFTS, ensureDaily, missionLabel, missionProgress, missionDone, claimMission,
  canClaimChest, claimChest, hasPending, STICKERS, PAGES, ALBUM_TOTAL, albumCount, pageStatus, ALBUM_MILESTONES, openPack, onProgressEvent, GAME_NAMES,
  spareCount, sparePoints, sellValue, sellSpares, tradeFor, tradeCost, TRADE_NORMAL, TRADE_FOIL,
  SEASON_PAGES, SEASON_STICKERS, activeSeasonPage, obtainable, buySticker, buyCost,
} from "./progression.js?v=fe581e124f";
import { rankingEnabled, fetchRanking } from "./online.js?v=fe581e124f";
import { energyInfo, claimEnergyChest, fmtSecs, ENERGY_COST, ENERGY_RULE, ENERGY_MISSION, startSleep, stopSleep, buyEnergy, buyOffer, BUY_ENERGY, REGEN_SECS, SLEEP_MULT, CHEST_EVERY, CHEST_ENERGY } from "./energy.js?v=fe581e124f";
import { monthPlan, rewardInfo, calendarOf, canClaimCalendar, claimCalendar, daysInMonth } from "./calendar.js?v=fe581e124f";
import { initAdventureUI } from "./adventure-ui.js?v=fe581e124f";
import { adventureOf } from "./adventure.js?v=fe581e124f";

let progress = null;
let selectedCharacter = null;
let shopCharacterId = CHARACTERS[0].id;

initSplash(); // sello de inicio: lo primero que se ve
if (IS_DEMO) document.getElementById("demo-banner").classList.remove("hidden"); // aviso de la versión de prueba (web)
const screenProfiles = document.getElementById("screen-profiles");
const screenHub = document.getElementById("screen-hub");
const screenShop = document.getElementById("screen-shop");
const screenLeaderboard = document.getElementById("screen-leaderboard");
const screenAchievements = document.getElementById("screen-achievements");
const screenProgress = document.getElementById("screen-progress");
const screenHouse = document.getElementById("screen-house");
const screenAdventure = document.getElementById("screen-adventure");
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
  merge: document.getElementById("screen-merge"),
  aventura: document.getElementById("screen-aventura"),
  ciudad: document.getElementById("screen-ciudad"),
  creador: document.getElementById("screen-creador"),
  pichanga: document.getElementById("screen-pichanga"),
  basquet2v2: document.getElementById("screen-bq2"),
};
const ALL_SCREENS = [
  screenProfiles, screenHub, screenShop, screenLeaderboard, screenAchievements, screenProgress, screenHouse, screenAdventure,
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
/** "Siguiente nivel": nueva vuelta si se terminó todo; en la demo de la web, el cartel de Google Play cuando el nivel de más adelante es de la app. */
function goNextLevel(game) {
  if (game._lapNext) { game.startNewLap(); return; }
  const cid = game.missionId || game.gameId;
  if (!demoAllows(cid, (game.level || 0) + 1)) { showDemoWall(); return; }
  game.nextLevel();
}

const instances = { town: null, parkour: null, recolecta: null, tetris: null, basquet_tiros: null, porristas: null, fps: null, salto: null, autos: null, memoria: null, futbol: null, dulces: null, merge: null, aventura: null, ciudad: null, creador: null, pichanga: null, basquet2v2: null };

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
  renderCharacterThumb(canvas, char, customizeOutfit(getOutfit(look.outfit), look));
  import("./thumb3d.js?v=fe581e124f")
    .then((m) => {
      m.renderHeroThumb(canvas, char, look);
      canvas.dispatchEvent(new Event("repainted"));
    })
    .catch(() => { /* sin WebGL: se queda el dibujo 2D */ });
}

// ---------- JUEGOS QUE EXIGEN CELULAR HORIZONTAL ----------
// Los juegos con orient "landscape" no se pueden jugar con el celular parado: aparece un aviso grande.
let currentGameId = null;

// ---------- MENÚ EN EL CELULAR: barra de abajo con pestañas (rediseño, maqueta 4) ----------
// Inicio (aventura, evento y juegos) · Juegos (solo la lista) · Pueblo (entra directo) · Mi Matichico (personaje, ropa,
// casa, logros, puntajes...). Solo en pantallas táctiles: en el computador el menú queda como siempre.
const lobbyEl = document.querySelector("#screen-hub .lobby");
const LOBBY_TABS = window.matchMedia("(pointer: coarse)").matches;
function setLobbyTab(tab) {
  if (!LOBBY_TABS || !lobbyEl) return;
  if (tab === "town") {
    if (!selectedCharacter) { needCharacter(); return; }
    playGame("town");
    return;
  }
  if (lobbyEl.dataset.tab === tab) return;
  lobbyEl.dataset.tab = tab;
  document.querySelectorAll("#lb-tabs [data-tab]").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
  for (const el of [document.getElementById("screen-hub"), lobbyEl]) if (el) el.scrollTop = 0;
}
if (LOBBY_TABS && lobbyEl) {
  lobbyEl.dataset.tab = "home";
  document.querySelectorAll("#lb-tabs [data-tab]").forEach((b) => b.addEventListener("click", () => setLobbyTab(b.dataset.tab)));
}
document.querySelectorAll("#lb-more [data-click]").forEach((b) => b.addEventListener("click", () => document.getElementById(b.dataset.click)?.click()));

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

/** Tocar el fondo de un cuadro lo cierra, pero solo si el toque empezó en el fondo: un botón que abre el cuadro al apoyar
 *  el dedo recibe el clic al levantarlo sobre el fondo ya abierto, y lo cerraría al instante. */
function closeOnBackdrop(dialog, close) {
  let downOnBack = false;
  dialog.addEventListener("pointerdown", (e) => { downOnBack = e.target === dialog; });
  dialog.addEventListener("click", (e) => { const ok = downOnBack; downOnBack = false; if (e.target === dialog && ok) close(); });
}

function showScreen(target) {
  // sin Matichico elegido (perfil nuevo), el menú del celular abre en "Mi Matichico", donde se elige
  if (target === screenHub && !selectedCharacter) setLobbyTab("me");
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
      const { Lobby3D } = await import("./lobby3d.js?v=fe581e124f");
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
  renderEnergy();
  const hs = document.getElementById("house-banner-sub");
  if (hs && progress.house) {
    const h = progress.house;
    const n = (h.layout || []).length + Object.values(h.roomData || {}).reduce((a, d) => a + ((d && d.layout) || []).length, 0);
    const nr = (h.rooms || []).length || 1;
    hs.textContent = `${houseSize(progress).name}${nr > 1 ? ` · ${nr} cuartos` : ""}${n ? ` · ${n} mueble${n > 1 ? "s" : ""}` : ""} — ¡decora, agranda y suma cuartos a tu casa!`;
  }
}


// ---------- ENERGÍA ----------
const enDlg = document.getElementById("energy-dialog");
let enOpen = false;
function renderEnergy() {
  if (!progress) return;
  const i = energyInfo(progress);
  document.getElementById("hub-energy").textContent = String(i.v);
  document.getElementById("hub-energy-max").textContent = String(i.max);
  const he = document.getElementById("house-energy-v");
  if (he) he.textContent = String(i.v);
  const hm = document.getElementById("house-energy-max");
  if (hm) hm.textContent = String(i.max);
  document.getElementById("hub-energy-next").textContent = i.v < i.max ? `+1 en ${fmtSecs(i.nextInSecs)}` : "";
  document.getElementById("hub-energy-dot").classList.toggle("hidden", !i.chestReady);
  document.getElementById("btn-energy").classList.toggle("low", i.v < 5);
  if (!enOpen) return;
  document.getElementById("en-fill").style.width = `${Math.min(100, Math.round((i.v / i.max) * 100))}%`;
  document.getElementById("en-count").textContent = i.v > i.max ? `${i.v} (¡extra!)` : `${i.v}/${i.max}`;
  document.getElementById("en-next").textContent = i.v >= i.max ? "¡Energía llena!" : `${i.sleeping ? "😴 Durmiendo: " : ""}+1 ⚡ en ${fmtSecs(i.nextInSecs)} · llena en ${fmtSecs(i.fullInSecs)}`;
  document.getElementById("en-chest").classList.toggle("hidden", !i.chestReady);
  renderEnergyWays(i);
}
const enWaysEl = document.getElementById("en-ways");
const enChestResultEl = document.getElementById("en-chest-wait");
const enMissEl = document.getElementById("en-miss");
let enNeed = 0;
let enGame = "";
/** ¿Estamos en el menú (o en una pantalla fuera de un juego)? Solo ahí se puede "ir" a otro lugar desde el aviso. */
const enCanGo = () => !screenHub.classList.contains("hidden");
function renderEnergyWays(i) {
  // cuánto falta
  const miss = enNeed ? Math.max(0, enNeed - i.v) : 0;
  enMissEl.classList.toggle("hidden", !enNeed);
  if (enNeed) enMissEl.innerHTML = miss > 0 ? `Necesitas <b>${enNeed} ⚡</b> y tienes <b>${i.v}</b>: te faltan <b>${miss} ⚡</b>.` : `¡Ya tienes la energía que necesitas (${enNeed} ⚡)!`;
  enWaysEl.innerHTML = "";
  const row = (ico, html, btnText, fn, disabled = false) => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="ew-ico">${ico}</span><span class="ew-txt">${html}</span>`;
    if (btnText) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ew-go";
      b.textContent = btnText;
      b.disabled = disabled;
      b.addEventListener("click", fn);
      li.appendChild(b);
    }
    enWaysEl.appendChild(li);
  };
  const go = (btnId) => () => { closeEnergy(); document.getElementById(btnId).click(); };
  const hub = enCanGo();
  const perHour = Math.round(3600 / REGEN_SECS);
  row("⏳", `<b>Esperar</b> · gratis · +1 ⚡ cada ${REGEN_SECS / 60} min (${perHour} por hora)${i.v < i.max ? ` · llena en ${fmtSecs(i.fullInSecs)}` : ""}`);
  row("😴", `<b>Dormir en tu cama</b> · gratis · ${SLEEP_MULT} veces más rápido (+1 ⚡ cada ${REGEN_SECS / 60 / SLEEP_MULT} min)`, i.v < i.max && hub ? "Ir a dormir" : "", () => {
    closeEnergy();
    window.__sleepOnEnter = true;
    document.getElementById("btn-open-house").click();
  });
  row("🎁", `<b>Cofre del tesoro</b> · gratis · +${CHEST_ENERGY} ⚡ cada ${CHEST_EVERY / 60000} min${i.chestReady ? " · ¡ya está listo!" : ` · en ${fmtSecs(i.chestInSecs)}`}`);
  row("📋", `<b>Misiones diarias</b> · +5 ⚡ cada una y +15 ⚡ el cofre del día`, hub ? "Ver misiones" : "", go("btn-open-progress"));
  row("🏅", `<b>Logros</b> · +5 ⚡ (+10 ⚡ los grandes) · y <b>subir de nivel</b> +10 ⚡`, hub ? "Ver logros" : "", go("btn-open-achievements"));
  row("🏘️", `<b>Actividades del Pueblo</b> (pasear, ayudar a los vecinos) · +10 ⚡`);
  const offer = buyOffer(progress);
  const full = offer.n <= 0;
  row("🍫✨", `<b>Comprar energía</b> · +${BUY_ENERGY.amount} ⚡ por 🍫✨ ${BUY_ENERGY.price}, solo hasta llegar a ${i.max} ⚡ · hasta ${BUY_ENERGY.perDay} veces al día (te quedan <b>${i.buysLeft}</b>)`,
    i.buysLeft <= 0 ? "Vuelve mañana" : full ? "Ya tienes 100" : progress.coins < offer.price ? `Faltan ${offer.price - progress.coins} 🍫✨` : `+${offer.n} ⚡ · 🍫✨ ${offer.price}`,
    () => {
      const n = buyEnergy(progress);
      if (!n) return;
      audio.playPurchase();
      refreshHubStats();
      renderEnergy();
    }, !(i.buysLeft > 0 && !full && progress.coins >= offer.price));
  // lo que gasta cada juego
  const costs = document.getElementById("en-costs");
  if (!costs.childElementCount) {
    for (const g of GAMES_CATALOG) {
      if (g.status !== "available" || !(g.id in ENERGY_COST)) continue;
      const li = document.createElement("li");
      const c = ENERGY_COST[g.id];
      const rule = ENERGY_RULE[g.id];
      li.innerHTML = `<span>${g.icon} ${g.name}</span><b>${c ? `${c} ⚡ al entrar` : "gratis al entrar"}${rule ? ` · ${rule}` : g.id === "ciudad" ? ` · misión ${ENERGY_MISSION} ⚡` : ""}</b>`;
      costs.appendChild(li);
    }
  }
}
function openEnergy(need = 0, game = "", mid = false) {
  if (!progress) return;
  enNeed = need;
  enGame = game;
  enChestResultEl.textContent = "";
  const i = energyInfo(progress);
  document.getElementById("en-icon").textContent = need ? "😴" : "⚡";
  document.getElementById("en-title").textContent = need ? "¡Matichico está cansado!" : "Tu energía";
  document.getElementById("en-text").textContent = need && mid
    ? `Se acabó la energía en plena partida (tienes ${i.v} ⚡). Tu puntaje quedó guardado. Para recargar:`
    : need
    ? `Para jugar ${game ? "esto " : ""}necesitas ${need} ⚡ y tienes ${i.v}. Mientras tanto puedes decorar tu casa, vestir a tu Matichico o pasear por el Pueblo y Ciudad Choco (¡eso no gasta!). Para recargar:`
    : `Cada juego gasta energía al entrar y mientras juegas (mira abajo cuánto). Pueblo, Ciudad, casa y vestuario no gastan. Para conseguir más:`;
  enOpen = true;
  enDlg.classList.remove("hidden");
  renderEnergy();
}
function closeEnergy() { enOpen = false; enDlg.classList.add("hidden"); }
document.getElementById("btn-energy").addEventListener("click", () => openEnergy());
document.getElementById("en-close").addEventListener("click", closeEnergy);
document.getElementById("en-chest").addEventListener("click", () => {
  const r = claimEnergyChest(progress);
  if (!r) return;
  audio.playPurchase();
  const msg = r.energy ? `🎁 ¡Cofre del tesoro! +${r.energy} ⚡ y +${r.coins} 🍫✨` : `🎁 ¡Cofre! Tu energía ya está en el tope (${energyInfo(progress).cap}), así que te da +${r.coins} 🍫✨`;
  enChestResultEl.textContent = msg; // queda escrito en el diálogo (el aviso de abajo se tapaba con la ventana)
  showToast(msg, 3500);
  refreshHubStats();
  renderEnergy();
});
window.addEventListener("lap-start", (e) => { showToast(`🎉 ¡Vuelta ${e.detail.lap}! +${e.detail.coins} 🍫✨ y ${e.detail.packs} sobre${e.detail.packs > 1 ? "s" : ""} 🎴`, 4200); refreshHubStats(); });
window.addEventListener("no-energy", (e) => openEnergy(e.detail.need, e.detail.game, !!e.detail.mid));
window.addEventListener("energy-gain", (e) => { showToast(`⚡ +${e.detail.n} energía${e.detail.reason ? ` (${e.detail.reason})` : ""}`); renderEnergy(); });
setInterval(renderEnergy, 1000);

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
  advUI.showWelcome(); // al volver después de un rato: resumen corto del avance y del siguiente objetivo
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
  advUI.renderPaths();
}

/** Sin Matichico elegido: se pide con un aviso amable y se muestra dónde elegirlo (antes era una alerta del navegador). */
function needCharacter(change = false) {
  setLobbyTab("me"); // en el celular, el escenario del Matichico está en la pestaña "Mi Matichico"
  const g = document.getElementById("character-grid");
  showToast(change ? "🔄 Toca el Matichico con el que quieres jugar" : "👇 Primero elige tu Matichico: toca uno de estos", 3200);
  g.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
  g.classList.remove("need-pick");
  void g.offsetWidth;
  g.classList.add("need-pick");
  setTimeout(() => g.classList.remove("need-pick"), 3200);
}

// ---------- RECOMPENSA DIARIA ----------

const btnDailyReward = document.getElementById("btn-daily-reward");

function updateDailyRewardButton() {
  const can = canClaimDailyReward(progress) || canClaimCalendar(progress);
  btnDailyReward.disabled = false;
  btnDailyReward.classList.toggle("daily-ready", can); // sin cobrar: dorado, brillando y con puntito rojo
  btnDailyReward.textContent = can
    ? "🎁 ¡Cobra tu recompensa!"
    : `🎁 Calendario (racha ${progress.dailyStreak} día${progress.dailyStreak === 1 ? "" : "s"})`;
}

// ---------- CALENDARIO DE RECOMPENSAS DEL MES ----------
const calDlg = document.getElementById("calendar-dialog");
function renderCalendar(lastResult = null) {
  const now = new Date();
  const plan = monthPlan(now);
  const cal = calendarOf(progress, now);
  const today = now.getDate();
  const first = new Date(now.getFullYear(), now.getMonth(), 1).getDay(); // 0 = domingo
  const monthName = now.toLocaleDateString("es-CL", { month: "long", year: "numeric" });
  document.getElementById("cal-title").textContent = `🎁 Recompensas de ${monthName}`;
  document.getElementById("cal-sub").textContent = `Racha: ${progress.dailyStreak || 0} día${progress.dailyStreak === 1 ? "" : "s"} 🔥 · Cobraste ${cal.claimed.length} de ${daysInMonth(now)}. ¡Hay días especiales con 100 de energía! 🔋`;
  const grid = document.getElementById("cal-grid");
  grid.innerHTML = "";
  for (const d of ["D", "L", "M", "M", "J", "V", "S"]) { const h = document.createElement("div"); h.className = "cal-dow"; h.textContent = d; grid.appendChild(h); }
  for (let i = 0; i < first; i++) grid.appendChild(document.createElement("div"));
  plan.forEach((r, i) => {
    const day = i + 1;
    const info = rewardInfo(r.type, progress);
    const claimed = cal.claimed.includes(day);
    const cell = document.createElement("div");
    const state = claimed ? "claimed" : day === today ? "today" : day < today ? "missed" : "future";
    cell.className = `cal-day ${state}${r.special ? " special" : ""}`;
    // los días que faltan son sorpresa (solo se ven los especiales); hoy y los pasados se ven
    const show = day <= today || claimed;
    cell.innerHTML = `<b>${day}</b><span class="cal-ic">${claimed ? "✅" : show ? info.icon : r.special ? "🔋" : "🎁"}</span><small>${show ? info.short : r.special ? "100" : "?"}</small>`;
    cell.title = show ? info.label : r.special ? "¡Día especial: 100 de energía!" : "Sorpresa";
    grid.appendChild(cell);
  });
  const can = canClaimCalendar(progress, now);
  const todayInfo = rewardInfo(plan[today - 1].type, progress);
  const box = document.getElementById("cal-today");
  box.innerHTML = lastResult
    ? `<b>🎉 ¡Hoy te tocó ${lastResult.icon} ${lastResult.label}!</b>`
    : can ? `Hoy te espera: <b>${todayInfo.icon} ${todayInfo.label}</b>` : `Hoy ya cobraste ✅ · Vuelve mañana por otra sorpresa`;
  const btn = document.getElementById("cal-claim");
  btn.disabled = !can && !canClaimDailyReward(progress);
  btn.classList.toggle("hidden", !can && !canClaimDailyReward(progress));
}
function openCalendar() { renderCalendar(); calDlg.classList.remove("hidden"); }
document.getElementById("cal-close").addEventListener("click", () => calDlg.classList.add("hidden"));
document.getElementById("cal-claim").addEventListener("click", () => {
  const streak = claimDailyReward(progress); // racha y Matipuntos base de siempre
  const cal = claimCalendar(progress); // la sorpresa del día
  if (!streak && !cal) return;
  audio.playPurchase();
  refreshHubStats();
  updateDailyRewardButton();
  renderCalendar(cal);
  showToast(`🎁 ${cal ? `${cal.icon} ${cal.label}` : ""}${streak ? ` · +${streak.reward} Matipuntos (racha de ${streak.streak} día${streak.streak === 1 ? "" : "s"} 🔥)` : ""}`, 4200);
  try { renderProgress(); } catch (e) { /* la pantalla de progreso aún no está abierta */ }
});
btnDailyReward.addEventListener("click", openCalendar);

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
let houseMode = "live";
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
  if (house3d) { house3d.holdAct = false; house3d.wake(); house3d.setActive(false); }
  if (progress) stopSleep(progress);
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
      const { House3D } = await import("./house3d.js?v=fe581e124f");
      house3d = new House3D(document.getElementById("house-canvas"));
      house3d.init();
      bindHouseDrag();
      if (location.search.includes("debug3d")) window.__house = house3d; // solo para pruebas
    }
    const look = getLook(progress, selectedCharacter.id);
    const key = `${selectedCharacter.id}|${JSON.stringify(look)}`;
    if (house3d.key !== key) house3d.setHero(selectedCharacter, look, key);
    house3d.setSize(houseSize(progress).size);
    // si venía a dormir y este cuarto no tiene cama, pasa al cuarto que sí la tenga
    if (window.__sleepOnEnter && !roomHasBed(progress, progress.house.curRoom)) {
      const r = roomsOf(progress).find((x) => roomHasBed(progress, x.rid));
      if (r) switchRoom(progress, r.rid);
    }
    house3d.layoutData = houseLayout(progress);
    house3d.setPlaced(housePlaced());
    refreshNeighbors();
    house3d.setSelected(houseSel);
    house3d.freezeOnSel = true;
    if (!house3d.pet) house3d.setPetCare(() => progress, () => { if (houseMode === "live") renderPetCardHouse(); document.getElementById("house-coins").textContent = String(progress.coins); }, (t) => showToast(t));
    if (!house3d._lifeBound) {
      house3d._lifeBound = true;
      house3d.onLife((ev) => {
        if (!progress) return;
        if (ev.act !== "sleep") return;
        if (ev.type === "start" || ev.type === "tick") {
          startSleep(progress, 90);
          { const ei = energyInfo(progress); if (ei.v >= ei.max) house3d.holdAct = false; }
          renderEnergy();
        } else if (ev.type === "end") { stopSleep(progress); house3d.holdAct = false; renderEnergy(); }
      });
    }
    house3d.setActive(true);
    if (houseMode === "live") renderHouse(); // ahora que están los muebles, se arma la lista de cosas para hacer
    if (window.__sleepOnEnter) {
      window.__sleepOnEnter = false;
      houseMode = "live";
      const bed = [...house3d.furn.values()].find((f) => f.item.spot === "bed");
      if (bed) { house3d.holdAct = true; house3d.interact(bed.data.uid); }
      else showToast("Pon una cama en Decorar para poder dormir 🛏️");
    }
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
    if (houseMode === "live") {
      // tocar otro cuarto de la casa (a los lados): pasa a ese cuarto
      const nb = house3d.pickRoom(e.clientX, e.clientY);
      if (nb) { openRoom(nb); return; }
      // tocar un mueble: lo usa; tocar el piso: camina hasta ahí (y se levanta si dormía)
      const u = house3d.pick(e.clientX, e.clientY);
      if (u && house3d.interact(u)) return;
      const fp = house3d.floorPoint(e.clientX, e.clientY);
      if (fp) house3d.walkTo(fp.x, fp.z);
      return;
    }
    if (houseMode !== "decor") return;
    house3d.wake();
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
  for (const [id, icon, name] of [["live", "🧸", "Vivir"], ["decor", "🛋️", "Decorar"], ["style", "🎨", "Piso y paredes"], ["size", "🏡", "Agrandar"], ["rooms", "🚪", "Cuartos"]]) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "sh-mode" + (id === houseMode ? " active" : "");
    b.innerHTML = `<span>${icon}</span> ${name}`;
    b.addEventListener("click", () => { houseMode = id; houseBuying = null; houseTrial = {}; houseRoomLook = null; clearFurniturePreview(); clearSizePreview(); if (id !== "decor") selectPiece(null); renderHouse(); house3d && house3d.setPlaced(housePlaced()); });
    houseModesEl.appendChild(b);
  }
  renderHouseTools();
  renderRoomStrip();
  const noViews = houseMode === "size" || houseMode === "live" || houseMode === "rooms";
  houseViewsEl.classList.toggle("hidden", noViews);
  if (!noViews) {
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
  if (houseMode === "live") renderHouseLive();
  else if (houseMode === "decor") renderHouseDecor();
  else if (houseMode === "style") renderHouseStyle();
  else if (houseMode === "rooms") renderHouseRooms();
  else renderHouseSize();
}

// ---------- varios cuartos ----------
let houseRoomLook = null; // tipo de cuarto que se está mirando para comprar
const roomsStripEl = document.getElementById("house-rooms");

function renderRoomStrip() {
  if (!roomsStripEl) return;
  const rooms = roomsOf(progress);
  roomsStripEl.innerHTML = "";
  for (const r of rooms) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "hr-pill" + (r.rid === progress.house.curRoom ? " active" : "");
    b.innerHTML = `<span>${roomType(r.type).icon}</span> ${r.name}`;
    b.addEventListener("click", () => openRoom(r.rid));
    roomsStripEl.appendChild(b);
  }
  if (rooms.length < MAX_ROOMS) {
    const add = document.createElement("button");
    add.type = "button";
    add.className = "hr-pill hr-add";
    add.textContent = "➕ Cuarto";
    add.addEventListener("click", () => { houseMode = "rooms"; houseBuying = null; clearFurniturePreview(); selectPiece(null); renderHouse(); });
    roomsStripEl.appendChild(add);
  }
}

/** Los cuartos que no están abiertos se ven a los lados (la casa de lado, como en Avatar World) y las flechas dicen a cuál van. */
function refreshNeighbors() {
  if (!house3d) return;
  const h = progress.house;
  const rooms = roomsOf(progress);
  const cur = rooms.findIndex((r) => r.rid === h.curRoom);
  house3d.setRoomName(`${roomType(rooms[cur].type).icon} ${rooms[cur].name}`);
  house3d.setNeighbors(rooms.map((r) => {
    const d = h.roomData[r.rid] || {};
    return { rid: r.rid, size: HOUSE_SIZES[roomSizeLevel(progress, r.rid)].size, active: r.rid === h.curRoom, name: `${roomType(r.type).icon} ${r.name}`, placed: d.placed || {}, layout: d.layout || [] };
  }));
  renderRoomArrows();
}

const arrowPrev = document.getElementById("house-prev");
const arrowNext = document.getElementById("house-next");
function renderRoomArrows() {
  const rooms = roomsOf(progress);
  const cur = rooms.findIndex((r) => r.rid === progress.house.curRoom);
  const prev = rooms[cur - 1];
  const next = rooms[cur + 1];
  arrowPrev.classList.toggle("hidden", !prev);
  if (prev) arrowPrev.innerHTML = `◀ <span>${roomType(prev.type).icon} ${prev.name}</span>`;
  const canAdd = rooms.length < MAX_ROOMS;
  arrowNext.classList.toggle("hidden", !next && !canAdd);
  arrowNext.innerHTML = next ? `<span>${roomType(next.type).icon} ${next.name}</span> ▶` : `<span>➕ Cuarto nuevo</span>`;
}
arrowPrev.addEventListener("click", () => { const r = roomsOf(progress); const i = r.findIndex((x) => x.rid === progress.house.curRoom); if (r[i - 1]) openRoom(r[i - 1].rid); });
arrowNext.addEventListener("click", () => {
  const r = roomsOf(progress);
  const i = r.findIndex((x) => x.rid === progress.house.curRoom);
  if (r[i + 1]) openRoom(r[i + 1].rid);
  else { houseMode = "rooms"; houseBuying = null; clearFurniturePreview(); selectPiece(null); renderHouse(); }
});

/** Muestra en 3D el cuarto que está abierto (muebles, piso y paredes) y los vecinos a los lados. */
function refreshRoom3d(enterSide = 0) {
  if (!house3d) return;
  house3d.setSize(houseSize(progress).size);
  house3d.layoutData = houseLayout(progress);
  house3d.setPlaced(housePlaced());
  refreshNeighbors();
  house3d.setSelected(null);
  house3d.snapCam();
  if (enterSide) house3d.enterRoom(enterSide);
}

/** Pasa a otro cuarto: la cámara se desliza hasta él (los cuartos están uno al lado del otro). */
let roomMoving = false;
function openRoom(rid) {
  if (!progress || roomMoving || rid === progress.house.curRoom) return;
  const rooms = roomsOf(progress);
  const from = rooms.findIndex((r) => r.rid === progress.house.curRoom);
  const to = rooms.findIndex((r) => r.rid === rid);
  if (to < 0) return;
  houseSel = null;
  houseTrial = {};
  houseBuying = null;
  clearFurniturePreview();
  if (house3d) house3d.wake();
  const go = () => {
    roomMoving = false;
    if (!switchRoom(progress, rid)) return;
    refreshRoom3d(to > from ? 1 : -1);
    renderHouse();
  };
  if (house3d && house3d.ready) { roomMoving = true; house3d.slideTo(rid, go); } else go();
}

function renderHouseRooms() {
  const rooms = roomsOf(progress);
  const full = rooms.length >= MAX_ROOMS;
  if (rooms.length > 1) {
    const ord = document.createElement("div");
    ord.className = "sh-order";
    ord.innerHTML = `<b>Orden de tus cuartos</b> (de izquierda a derecha)`;
    rooms.forEach((r, i) => {
      const chip = document.createElement("div");
      chip.className = "so-chip" + (r.rid === progress.house.curRoom ? " open" : "");
      const mv = (dir, txt) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = txt;
        b.setAttribute("aria-label", dir < 0 ? "Mover a la izquierda" : "Mover a la derecha");
        b.disabled = dir < 0 ? i === 0 : i === rooms.length - 1;
        b.addEventListener("click", () => { if (moveRoom(progress, r.rid, dir)) { refreshNeighbors(); renderHouse(); } });
        return b;
      };
      const nm = document.createElement("span");
      nm.textContent = `${roomType(r.type).icon} ${r.name}`;
      chip.append(mv(-1, "◀"), nm, mv(1, "▶"));
      ord.appendChild(chip);
    });
    houseGridEl.appendChild(ord);
  }
  for (const t of ROOM_TYPES.slice(1)) {
    const have = rooms.filter((r) => r.type === t.id).length;
    const card = document.createElement("button");
    card.type = "button";
    card.className = "sh-card sh-size" + (houseRoomLook === t.id ? " trying" : "");
    card.innerHTML = `<span class="sh-ico">${t.icon}</span><span class="sh-name">${t.name}</span><small>${have ? `Tienes ${have}` : "Nuevo"}</small><span class="sh-price">🍫✨ ${t.price}</span>`;
    card.addEventListener("click", () => { houseRoomLook = t.id; renderHouse(); });
    houseGridEl.appendChild(card);
  }
  const t = houseRoomLook && roomType(houseRoomLook);
  if (t) {
    const need = t.price - progress.coins;
    const txt = document.createElement("div");
    txt.className = "sh-bar-txt";
    txt.innerHTML = `<b>${t.icon} ${t.name}</b> — ${t.blurb} Viene con sus muebles de regalo.`;
    const buy = document.createElement("button");
    buy.className = "btn-primary";
    buy.textContent = full ? "Ya tienes todos los cuartos que caben" : need > 0 ? `Te faltan ${need} 🍫✨` : `Comprar · 🍫✨ ${t.price}`;
    buy.disabled = full || need > 0;
    buy.addEventListener("click", () => {
      const rid = buyRoom(progress, t.id);
      if (!rid) return;
      audio.playPurchase();
      showToast(`¡Nuevo cuarto: ${t.name}! 🎉 Ya viene amoblado.`);
      houseRoomLook = null;
      houseMode = "live";
      openRoom(rid);
      refreshHubStats();
    });
    const cancel = document.createElement("button");
    cancel.className = "btn-secondary";
    cancel.textContent = "Cerrar";
    cancel.addEventListener("click", () => { houseRoomLook = null; renderHouse(); });
    houseBarEl.append(txt, buy, cancel);
  } else {
    houseBarEl.className = "sh-bar hint";
    houseBarEl.innerHTML = `<div class="sh-bar-txt">Tu casa tiene <b>${rooms.length}</b> cuarto${rooms.length > 1 ? "s" : ""} (máximo ${MAX_ROOMS}). Con ◀ ▶ cambias el <b>orden</b>; pasas de un cuarto a otro con las flechas o las pestañas de arriba.</div>`;
  }
}


const LIVE_ICONS = { sleep: "😴", sit: "🛋️", type: "💻", arcade: "🕹️", piano: "🎹", hop: "🤸", admire: "👀", fridge: "🧊", cook: "🍳", wash: "🚰", eat: "🍽️", bath: "🛁", wardrobe: "👗", watch: "📺" };
const LIVE_NAMES = { sleep: "Dormir", sit: "Sentarse", type: "Usar el computador", arcade: "Jugar a la arcade", piano: "Tocar el piano", hop: "Saltar", admire: "Mirar", fridge: "Abrir la heladera", cook: "Cocinar", wash: "Lavar", eat: "Comer", bath: "Darse un baño", wardrobe: "Mirar el ropero", watch: "Ver tele" };
/** Modo "Vivir": el Matichico camina por la casa y usa los muebles. */
/** La tarjeta "Mi mascota" arriba de las cosas para hacer (solo si el Matichico lleva una mascota puesta). */
function renderPetCardHouse() {
  if (!house3d || !house3d.pet) return;
  let card = houseGridEl.querySelector(".pet-card");
  if (!house3d.pet.item) { card?.remove(); return; }
  if (!card) {
    card = document.createElement("div");
    card.className = "pet-card";
    houseGridEl.prepend(card);
  }
  house3d.petCard(card, (msg) => showToast(msg));
}

function renderHouseLive() {
  const i = energyInfo(progress);
  houseBarEl.innerHTML = `<div class="sh-bar-txt">Tu Matichico vive aquí: <b>toca un mueble</b> y irá a usarlo, o <b>toca el piso</b> para que camine. ${i.v < i.max ? `Si duerme en su cama, ¡la energía vuelve 3 veces más rápido! (⚡ ${i.v}/${i.max})` : ""}</div>`;
  const spots = house3d ? house3d._spots() : [];
  const ACTS = ["sleep", "sit", "type", "arcade", "piano", "hop", "fridge", "cook", "wash", "eat", "bath", "wardrobe", "watch", "admire"];
  const cats = Object.fromEntries(ACTS.map((a) => [a, []]));
  for (const { f, i: it } of spots) cats[it.act].push(f);
  const mk = (act, f) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "sh-card";
    b.innerHTML = `<span class="sh-ico">${LIVE_ICONS[act]}</span><span class="sh-name">${LIVE_NAMES[act]}</span><span class="sh-price">${f.item.name}</span>`;
    b.addEventListener("click", () => house3d && house3d.interact(f.data.uid));
    houseGridEl.appendChild(b);
  };
  for (const act of ACTS) for (const f of cats[act]) mk(act, f);
  if (!spots.length) houseGridEl.innerHTML = `<div class="sh-empty">Aún no hay muebles para usar. ¡Pon una cama, un sillón o un computador en <b>Decorar</b>!</div>`;
  renderPetCardHouse();
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
    const total = copiesOf(progress, item.id);
    const placed = placedCount(progress, item.id);
    const free = total - placed; // unidades guardadas listas para poner
    const card = document.createElement("button");
    card.type = "button";
    card.className = "sh-card" + (!owned ? " locked" : "") + (houseBuying === item.id ? " trying" : "");
    card.style.setProperty("--rar", RARITIES[item.rarity].color);
    card.innerHTML = `<span class="sh-ico">${item.icon}</span><span class="sh-name">${item.name}</span>` +
      `<span class="sh-price">${!owned ? (item.soon ? "🔜 Próximamente" : `🍫✨ ${item.price}`) : free > 0 ? `＋ Poner${total > 1 ? ` (${free} libre${free > 1 ? "s" : ""})` : ""}` : item.price > 0 ? `✓ Puesto · 🍫✨ ${item.price} otro` : "✓ Puesto"}</span>`;
    card.addEventListener("click", () => {
      if (card.dataset.dragged) { delete card.dataset.dragged; return; }
      if (owned && free > 0) { clearFurniturePreview(); houseBuying = null; placeFurniture(item.id); renderHouse(); }
      else if (owned && item.price <= 0) showToast(`${item.icon} ${item.name} ya está puesto. Tócalo en el cuarto para moverlo o quitarlo.`);
      else if (owned) { houseBuying = item.id; startFurniturePreview(item.id); showToast(`Ya tienes puesto ${item.name}. Si quieres otro igual, puedes comprarlo 🍫✨ ${item.price}`); renderHouse(); }
      else { houseBuying = item.id; startFurniturePreview(item.id); renderHouse(); }
    });
    if (owned && free > 0) bindCardDrag(card, item.id);
    houseGridEl.appendChild(card);
  });
  const bi = houseBuying && getHouseItem(houseBuying);
  if (bi) {
    const need = bi.price - progress.coins;
    const txt = document.createElement("div");
    txt.className = "sh-bar-txt";
    txt.innerHTML = `<b>${bi.icon} ${bi.name}</b> <i style="color:${RARITIES[bi.rarity].color}">${RARITIES[bi.rarity].name}</i>` + (bi.soon ? ` · <small>🔜 Próximamente: puedes verlo en tu cuarto, pero todavía no se vende</small>` : "");
    const buy = document.createElement("button");
    buy.className = "btn-primary";
    const another = ownsHouseItem(progress, bi.id);
    buy.textContent = bi.soon ? "🔜 Próximamente" : need > 0 ? `Te faltan ${need} 🍫✨ para comprarlo` : `${another ? "Comprar otro" : "Comprar"} · 🍫✨ ${bi.price}`;
    buy.disabled = need > 0 || !!bi.soon;
    buy.addEventListener("click", () => {
      if (!buyFurniture(progress, bi.id)) return;
      audio.playPurchase();
      showToast(another ? `¡Compraste otro ${bi.name}! 🎉` : `¡Compraste ${bi.name}! 🎉 Ahora está en 🎒 Lo que tengo`);
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
    houseBarEl.innerHTML = `<div class="sh-bar-txt">${houseView === "own" ? "Toca un mueble tuyo para ponerlo (o arrástralo al cuarto). Cada compra se puede poner una sola vez." : "Toca un mueble para verlo en tu cuarto antes de comprarlo."} Toca uno puesto para moverlo, girarlo, cambiarle el tamaño o quitarlo (🗑 lo guarda en Lo que tengo).</div>`;
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
      const had = ownsHouseItem(progress, titem.id);
      if (!buyHouseItem(progress, titem.id)) return;
      delete houseTrial[houseSpot];
      audio.playPurchase();
      showToast(had ? `¡Compraste otro ${titem.name}! 🎉` : `¡Compraste ${titem.name}! 🎉 Ahora está en 🎒 Lo que tengo`);
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
  const room = roomsOf(progress).find((r) => r.rid === progress.house.curRoom);
  HOUSE_SIZES.forEach((sz) => {
    const owned = sz.level <= cur.level;
    const looking = housePreviewSize === sz.size;
    const card = document.createElement("button");
    card.type = "button";
    card.className = "sh-card sh-size" + (sz.level === cur.level ? " equipped" : "") + (looking ? " trying" : "") + (!owned ? " locked" : "");
    card.innerHTML = `<span class="sh-ico">${sz.icon}</span><span class="sh-name">${sz.name}</span><small>${sz.size} × ${sz.size}</small>` +
      `<span class="sh-price">${sz.level === cur.level ? "✓ Este cuarto" : owned ? "Ya lo superó" : `🍫✨ ${houseSizeCost(progress, sz.level)}`}</span>`;
    card.addEventListener("click", () => {
      // siempre se puede mirar cómo se vería (aunque todavía no alcance para comprarlo)
      housePreviewSize = owned ? null : sz.size;
      house3d && house3d.setSize(owned ? cur.size : sz.size); // tocar el que ya tienes vuelve a tu cuarto
      renderHouse();
    });
    houseGridEl.appendChild(card);
  });
  const look = housePreviewSize && HOUSE_SIZES.find((z) => z.size === housePreviewSize);
  if (look) {
    const cost = houseSizeCost(progress, look.level);
    const need = cost - progress.coins;
    const txt = document.createElement("div");
    txt.className = "sh-bar-txt";
    txt.innerHTML = `<b>${look.icon} ${look.name}</b> · ${look.size} × ${look.size} para <b>${room.name}</b> — ${look.blurb}`;
    const buy = document.createElement("button");
    buy.className = "btn-primary";
    buy.textContent = need > 0 ? `Te faltan ${need} 🍫✨` : `Comprar · 🍫✨ ${cost}`;
    buy.disabled = need > 0;
    buy.addEventListener("click", () => {
      if (!buyHouseSize(progress, look.level)) return;
      audio.playPurchase();
      showToast(`¡${room.name} ahora es ${look.name.toLowerCase()}! 🎉`);
      housePreviewSize = null;
      houseMode = "decor";
      renderHouse();
      refreshHubStats();
    });
    const cancel = document.createElement("button");
    cancel.className = "btn-secondary";
    cancel.textContent = "Volver a como estaba";
    cancel.addEventListener("click", () => { clearSizePreview(); renderHouse(); });
    houseBarEl.append(txt, buy, cancel);
  } else {
    houseBarEl.className = "sh-bar hint";
    houseBarEl.innerHTML = `<div class="sh-bar-txt">El tamaño es de <b>cada cuarto</b>: ahora estás en <b>${room.name}</b> (${cur.name.toLowerCase()}). Toca un tamaño para <b>verlo</b> antes de comprarlo; para otro cuarto, ábrelo primero con las flechas.</div>`;
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
  document.getElementById("pg-packs-text").textContent = "Ganas sobres al subir de nivel, cada 5 partidas y con el cofre del día. Cada sobre trae 3 figuritas al azar. ¿Te falta una? Tócala: la puedes cambiar por repetidas o comprar con Matipuntos.";
  const albumEl = document.getElementById("pg-album");
  albumEl.innerHTML = "";
  const pts = sparePoints(progress);
  const season = activeSeasonPage();
  const drawPage = (pg, list, extra = "") => {
    const st = pageStatus(progress, pg);
    albumEl.appendChild(el("h3", "pg-page-title" + (st.have >= st.total ? " ok" : "") + (pg.event ? " season" : ""), `${pg.icon} ${pg.title} · ${st.have}/${st.total}${st.have >= st.total ? " ✅" : ` (premio: +${pg.reward} 🍫✨)`}${extra}`));
    const grid = el("div", "pg-album-grid");
    list.forEach((st2) => {
      const n = (progress.album || {})[st2.id] || 0;
      const can = !n && obtainable(st2);
      const canTrade = can && pts >= tradeCost(st2);
      const card = el("div", "pg-sticker" + (n ? " got" : "") + (st2.foil ? " foil" : "") + (canTrade ? " tradable" : "") + (can ? " missing" : ""));
      if (n) {
        card.appendChild(stickerArt(st2));
        if (n > 1) card.appendChild(el("b", "pg-s-n", `x${n}`));
      } else card.appendChild(el("span", "pg-s-q", st2.foil ? "✨?" : "?"));
      card.appendChild(el("span", "pg-s-name", n ? st2.name : !can ? "Vuelve en su temporada" : canTrade ? "🔄 ¡Cámbiala!" : st2.foil ? "Brillante" : "Sin descubrir"));
      if (can) {
        card.setAttribute("role", "button");
        card.tabIndex = 0;
        card.title = "Cambiarla por repetidas o comprarla";
        card.addEventListener("click", () => openStickerDialog(st2));
      }
      grid.appendChild(card);
    });
    albumEl.appendChild(grid);
  };
  // la página del evento activo va primero; las de otras temporadas, al final (si ya tienes alguna)
  if (season) drawPage(season, SEASON_STICKERS.filter((x) => x.page === season.id), ` · solo hasta el ${fmtDay(eventEnd(activeEvent()))}`);
  for (const pg of PAGES) drawPage(pg, STICKERS.filter((x) => x.page === pg.id));
  for (const pg of SEASON_PAGES) {
    if (season && pg.id === season.id) continue;
    const list = SEASON_STICKERS.filter((x) => x.page === pg.id);
    if (list.some((x) => (progress.album || {})[x.id] > 0)) drawPage(pg, list, " · vuelve en su temporada");
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
      // si todavía faltan figuritas, las repetidas sirven para cambiarlas: se avisa antes de venderlas
      const faltan = [...STICKERS, ...SEASON_STICKERS].filter((x) => !((progress.album || {})[x.id] > 0) && obtainable(x)).length;
      const ojo = faltan && pts >= TRADE_NORMAL ? `\n\nOjo: te faltan ${faltan} figuritas y con estas repetidas puedes cambiar ${Math.floor(pts / TRADE_NORMAL)} de ellas (toca la que te falta).` : "";
      if (!window.confirm(`¿Vender ${spare} repetidas por ${sellValue(progress)} Matipuntos? (Te quedas con una de cada figurita)${ojo}`)) return;
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
document.getElementById("pg-daily").addEventListener("click", openCalendar);

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

// ---- figurita que falta: taller (repetidas) o kiosco (Matipuntos) ----
const stickerDialog = document.getElementById("sticker-dialog");
let stickerTarget = null;
function fmtDay(d) { return d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit" }); }
function openStickerDialog(s) {
  stickerTarget = s;
  const art = document.getElementById("sk-art");
  art.replaceChildren(stickerArt(s));
  art.classList.toggle("foil", !!s.foil);
  document.getElementById("sk-title").textContent = s.name;
  const pts = sparePoints(progress);
  const tc = tradeCost(s);
  const bc = buyCost(s);
  document.getElementById("sk-text").textContent = s.event
    ? "Figurita de temporada: se consigue solo mientras dura el evento."
    : s.foil ? "Una brillante: sale poco en los sobres." : "Te falta esta figurita.";
  const trade = document.getElementById("sk-trade");
  trade.disabled = pts < tc;
  trade.textContent = pts >= tc ? `🔄 Cambiar por ${tc} repetidas` : `🔄 Cambiar: tienes ${pts} de ${tc} repetidas`;
  const buy = document.getElementById("sk-buy");
  buy.disabled = progress.coins < bc;
  buy.textContent = progress.coins >= bc ? `🛒 Comprar por ${bc.toLocaleString("es-CL")} 🍫` : `🛒 ${bc.toLocaleString("es-CL")} 🍫 · te faltan ${(bc - progress.coins).toLocaleString("es-CL")}`;
  stickerDialog.classList.remove("hidden");
}
function stickerGot(r, how) {
  stickerDialog.classList.add("hidden");
  if (!r) return;
  audio.playBonusCollect();
  showToast(`${how} ¡Conseguiste «${r.sticker.name}»!${r.rewards.length ? " " + r.rewards.map((m) => `🏆 ${m.text}: +${m.coins} 🍫✨`).join(" · ") : ""}`);
  refreshHubStats();
  renderProgress();
}
document.getElementById("sk-trade").addEventListener("click", () => stickerTarget && stickerGot(tradeFor(progress, stickerTarget.id), "🔄"));
document.getElementById("sk-buy").addEventListener("click", () => stickerTarget && stickerGot(buySticker(progress, stickerTarget.id), "🛒"));
document.getElementById("sk-close").addEventListener("click", () => stickerDialog.classList.add("hidden"));
closeOnBackdrop(stickerDialog, () => stickerDialog.classList.add("hidden"));

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
  document.querySelectorAll("details.how").forEach((d) => { d.open = !touch && !d.closest(".ic-play"); });
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
  const first = !selectedCharacter;
  selectedCharacter = char;
  progress.selectedCharacterId = char.id;
  saveProgress(progress);
  updateProfileMeta(progress._profileId, { characterId: char.id });
  renderCharacterGrid();
  renderGameGrid();
  updateProfileChip();
  syncLobby(true);
  advUI.renderPaths();
  if (first) { setLobbyTab("home"); showToast(`¡Hola, ${char.name}! Ahora toca «Continuar mi aventura» para empezar 🎪`, 4200); }
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
  ori.textContent = entry.orient === "landscape" ? "📱 Horizontal" : entry.id === "merge" ? "📱 Mejor vertical" : "📱 Vertical u horizontal";
  wrap.appendChild(ori);
  if (entry.id in ENERGY_COST && (ENERGY_COST[entry.id] > 0 || ENERGY_RULE[entry.id])) {
    const en = document.createElement("span");
    en.className = "gorient gen";
    en.textContent = `⚡ ${ENERGY_COST[entry.id] > 0 ? ENERGY_COST[entry.id] : ""}${ENERGY_COST[entry.id] > 0 && ENERGY_RULE[entry.id] ? " + " : ""}${ENERGY_RULE[entry.id] || ""}`;
    wrap.appendChild(en);
  }
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
    // en celular, en vez de los carteles sobre la foto: una línea corta con la energía y si va acostado
    const meta = document.createElement("span");
    meta.className = "gmeta";
    const cost = ENERGY_COST[entry.id] || 0;
    meta.textContent = [cost > 0 ? `⚡ ${cost}` : "", entry.orient === "landscape" ? "📱 acostado" : ""].filter(Boolean).join(" · ");
    if (meta.textContent) body.appendChild(meta);

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

// Juego bloqueado (rediseño, maqueta 5): la imagen del juego, cuánto te falta con una barra y, si todavía no alcanza,
// un botón que te lleva a ganar Matipuntos (al último juego que jugaste, o al Pueblo) en vez de un botón gris.
const fmtN = (n) => Math.round(n).toLocaleString("es-CL");
function openUnlockDialog(entry) {
  unlockTarget = entry;
  toastEl.classList.add("hidden"); // que el aviso de bienvenida no tape los botones del cuadro
  const cost = UNLOCK_COST[entry.id];
  const missing = cost - progress.coins;
  document.getElementById("um-art").style.backgroundImage = `url("assets/games/${entry.id}.jpg")`;
  document.getElementById("um-icon").textContent = missing > 0 ? "🔒" : "🔓";
  document.getElementById("um-title").textContent = entry.name;
  document.getElementById("um-text").textContent = missing > 0
    ? `${entry.tagline} ${missing <= cost * 0.3 ? "¡Te falta poquito!" : "¡Sigue jugando para juntarlos!"}`
    : `${entry.tagline} ¿Lo canjeas? Es tuyo para siempre.`;
  document.getElementById("um-fill").style.width = `${Math.min(100, (progress.coins / cost) * 100)}%`;
  document.getElementById("um-count").textContent = missing > 0
    ? `${fmtN(progress.coins)} / ${fmtN(cost)} 🍫 · te faltan ${fmtN(missing)}`
    : `Tienes ${fmtN(progress.coins)} 🍫 · cuesta ${fmtN(cost)}`;
  const buy = document.getElementById("um-buy");
  buy.textContent = missing > 0 ? "🎮 Ganar Matipuntos" : `🔓 Canjear por ${fmtN(cost)} 🍫`;
  buy.disabled = false;
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
  if (!unlockTarget) return;
  if (progress.coins < UNLOCK_COST[unlockTarget.id]) {
    // todavía no alcanza: a jugar para juntar (el último juego jugado, si está libre; si no, el Pueblo y sus actividades)
    unlockTarget = null;
    unlockDialog.classList.add("hidden");
    const last = progress.lastGameId && GAMES_CATALOG.find((g) => g.id === progress.lastGameId && isUnlocked(progress, g.id));
    playGame(last ? last.id : "town");
    return;
  }
  if (!unlockGame(progress, unlockTarget.id)) return;
  const entry = unlockTarget;
  unlockTarget = null;
  unlockDialog.classList.add("hidden");
  audio.playPurchase();
  showToast(`¡Desbloqueaste ${entry.name}! 🎉`);
  refreshHubStats();
  renderGameGrid();
  playGame(entry.id);
});
document.getElementById("demo-wall-close")?.addEventListener("click", () => document.getElementById("demo-wall").classList.add("hidden"));

// ---- Privacidad y créditos/licencias: se leen dentro del juego (iframe con privacy.html / licenses.html), sin abrir el navegador ----
{
  const dialog = document.getElementById("legal-dialog");
  const frame = document.getElementById("legal-frame");
  const title = document.getElementById("legal-title");
  const swap = document.getElementById("legal-switch");
  const PAGES = { privacy: ["Privacidad", "privacy.html", "📜 Créditos y licencias", "licenses"], licenses: ["Créditos y licencias", "licenses.html", "🔒 Privacidad", "privacy"] };
  let current = "privacy";
  const show = (which) => {
    const [t, url, label] = PAGES[which];
    current = which;
    title.textContent = t;
    swap.textContent = label;
    frame.src = url;
    dialog.classList.remove("hidden");
    document.getElementById("legal-close").focus();
  };
  const close = () => { dialog.classList.add("hidden"); frame.src = "about:blank"; };
  document.querySelectorAll(".legal-open").forEach((b) => b.addEventListener("click", () => show(b.dataset.legal)));
  swap.addEventListener("click", () => show(PAGES[current][3]));
  document.getElementById("legal-close").addEventListener("click", close);
  closeOnBackdrop(dialog, close);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !dialog.classList.contains("hidden")) close(); });
}

// ---- Botón "atrás" del celular (solo en la app Android; en la web no existe window.Capacitor) ----
// Cuadro abierto: lo cierra. Pantalla interna (tienda, casa…): vuelve al menú. Dentro de un juego: avisa y, al tocar otra vez, vuelve al menú.
// En el menú: avisa y, al tocar otra vez, sale de la app.
// La app no usa empaquetador, así que no está @capacitor/core (ni su registerPlugin): se habla directo con el puente nativo
// que Android inyecta en window.Capacitor (addListener / nativeCallback), y solo si el plugin App viene en la app.
{
  const cap = window.Capacitor;
  const hasApp = !!cap && cap.isNativePlatform?.() && typeof cap.addListener === "function" && typeof cap.nativeCallback === "function"
    && (cap.PluginHeaders || []).some((h) => h.name === "App");
  if (hasApp) {
    const INNER_BACK = [[screenAdventure, "btn-adventure-back"], [screenHouse, "btn-house-back"], [screenProgress, "btn-progress-back"], [screenAchievements, "btn-achievements-back"], [screenShop, "btn-shop-back"], [screenLeaderboard, "btn-leaderboard-back"]];
    const exitApp = () => cap.nativeCallback("App", "exitApp", {});
    let armedAt = 0;
    const twice = (message, action) => {
      if (Date.now() - armedAt < 2000) { armedAt = 0; action(); return; }
      armedAt = Date.now();
      showToast(message, 2000);
    };
    try {
      cap.addListener("App", "backButton", () => {
        const modal = [...document.querySelectorAll(".modal:not(.hidden)")].pop();
        // cada cuadro marca su botón de cierre con data-back: se pulsa ese botón para que corra su propio cierre (y su estado, como enOpen)
        if (modal) { const close = modal.querySelector("[data-back]"); if (close) close.click(); else modal.classList.add("hidden"); return; }
        const visible = ALL_SCREENS.find((s) => !s.classList.contains("hidden"));
        const inner = INNER_BACK.find(([s]) => s === visible);
        if (inner) { document.getElementById(inner[1]).click(); return; }
        // dentro de un juego, "atrás" abre la pausa (seguir · sonido · salir); con la pausa abierta, la cierra (ver arriba: cuadro abierto)
        if (visible && visible.classList.contains("game-screen")) { if (activeGame && activeGame.running) openPause(activeGame); else twice("Toca otra vez para volver al menú", goToHub); }
        else twice("Toca otra vez para salir", exitApp);
      });
    } catch (e) { /* si el puente falla, Android se encarga del botón como siempre */ }
  }
}

function playGame(gameId) {
  if (!selectedCharacter) {
    needCharacter();
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

// ---------- PAUSA (botón ⏸ de cada juego y "atrás" del celular) ----------
const pauseDialog = document.getElementById("pause-dialog");
const pauseSound = document.getElementById("pause-sound");
let pausedGame = null;
function syncSoundLabels() {
  const muted = audio.isMuted();
  pauseSound.textContent = muted ? "🔇 Sin sonido" : "🔊 Con sonido";
  document.querySelectorAll('[id$="-btn-mute"]').forEach((b) => { b.textContent = muted ? "🔇" : "🔊"; });
}
function openPause(game) {
  if (!pauseDialog.classList.contains("hidden")) return;
  pausedGame = game || null;
  pausedGame?.setPaused?.(true);
  syncSoundLabels();
  pauseDialog.classList.remove("hidden");
}
function closePause() {
  pauseDialog.classList.add("hidden");
  pausedGame?.setPaused?.(false);
  pausedGame = null;
}
document.getElementById("pause-resume").addEventListener("click", closePause);
pauseSound.addEventListener("click", () => { audio.setMuted(!audio.isMuted()); syncSoundLabels(); });
document.getElementById("pause-exit").addEventListener("click", () => { closePause(); goToHub(); });
closeOnBackdrop(pauseDialog, closePause);
let activeGame = null; // el juego 3D en pantalla (para que el "atrás" del celular abra su pausa)

// ---------- TARJETA DE INICIO DE CADA JUEGO (rediseño, maqueta 3) ----------
// A cualquier tarjeta de inicio le agrega la imagen del juego con su nombre a la izquierda (arriba en el celular de pie),
// deja a la derecha solo lo que se toca (modos, niveles, botón de jugar) y pasa "Cómo se juega" a un botón "?" junto al
// botón de jugar; las descripciones largas se mueven dentro de ese "?", así no se pierde nada.
const INTRO_ART = { pichanga: "futbol", basquet2v2: "basquet_tiros" };
function decorateIntro(key, pre) {
  const card = document.querySelector(`#${pre}-overlay-intro > .overlay-card`);
  if (!card || card.classList.contains("intro-card")) return;
  const entry = GAMES_CATALOG.find((g) => g.id === (INTRO_ART[key] || key));
  const h2 = card.querySelector(":scope > h2");
  const tag = card.querySelector(":scope > .fps-tag");
  card.classList.add("intro-card");
  const art = document.createElement("div");
  art.className = "ic-art";
  art.style.backgroundImage = `url("assets/games/${INTRO_ART[key] || key}.jpg")`;
  const t = document.createElement("h3");
  // el nombre del catálogo (el título de la tarjeta a veces es el del nivel); Pichanga y Básquet 2v2 usan el suyo
  t.textContent = ((INTRO_ART[key] ? h2?.textContent : entry?.name) || h2?.textContent || "").replace(/\s*3D\b/, "").trim();
  const s = document.createElement("p");
  s.textContent = tag ? tag.textContent : entry?.tag || "";
  art.append(t, s);
  const body = document.createElement("div");
  body.className = "ic-body";
  while (card.firstChild) body.appendChild(card.firstChild);
  card.append(art, body);
  const how = body.querySelector(":scope > details.how");
  // descripciones sueltas (párrafos sin id ni clase) → dentro del "?"
  const loose = [...body.querySelectorAll(":scope > p:not([id]):not([class])")];
  if (how) for (const p of loose.reverse()) how.querySelector("summary").after(p);
  const start = body.querySelector(':scope > .btn-primary[id$="-btn-start"], :scope > [data-action="begin"]');
  if (how) {
    // en la tarjeta la ayuda es un panel que tapa las opciones: empieza cerrada (se abre con el "?")
    how.open = false;
    const sum = how.querySelector("summary");
    sum.setAttribute("aria-label", "Cómo se juega");
    sum.textContent = "?";
    const hb = document.createElement("div");
    hb.className = "how-body";
    for (const n of [...how.childNodes]) if (n !== sum) hb.appendChild(n);
    how.appendChild(hb);
    const row = document.createElement("div");
    row.className = "ic-play";
    if (start) { start.before(row); row.append(how, start); } else { body.appendChild(row); row.append(how); }
  }
}

function goToHub() {
  if (fromTown) {
    fromTown = false;
    playGame("town");
    return;
  }
  Object.values(instances).forEach((instance) => instance && instance.pauseForMenu());
  currentGameId = null;
  setLobbyTab("home");
  checkOrientation();
  refreshHubStats();
  renderCharacterGrid();
  renderGameGrid();
  updateDailyRewardButton();
  advUI.renderPaths();
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
      const { Lobby3D } = await import("./lobby3d.js?v=fe581e124f");
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
    // una prenda comprada solo la lleva un Matichico a la vez: si otro la tiene, hay que quitársela o comprar otra
    const busy = owned && item && !canWear(progress, ch.id, id);
    const usedBy = busy ? wearers(progress, id).map((cid) => (CHARACTERS.find((c) => c.id === cid) || {}).name || "otro").join(", ") : "";
    const lock = !owned && item ? lockReason(progress, item) : "";
    const card = document.createElement("button");
    card.type = "button";
    card.className = "sh-card" + (equipped ? " equipped" : "") + (trying ? " trying" : "") + (!owned ? " locked" : "") + (busy ? " busy" : "");
    if (item) card.style.setProperty("--rar", RARITIES[item.rarity].color);
    card.innerHTML = `<span class="sh-ico">${item ? item.icon : "🚫"}</span><span class="sh-name">${item ? item.name : "Normal"}</span>` +
      `<span class="sh-price">${equipped ? (item && item.price > 0 && !item.event ? `✓ Puesto · 🍫✨ ${item.price} otro` : "✓ Puesto") : busy ? `Lo usa ${usedBy}` : owned ? (item && item.price ? "Tuyo" : "Gratis") : lock ? (item.soon ? "🔜 Próximamente" : `🔒 ${lock}`) : priceLabel(item)}</span>`;
    card.addEventListener("click", () => {
      if (busy) {
        shopTrial[shopSlot] = id; // se mira puesto y abajo salen las opciones
      } else if (equipped && item && item.price > 0 && !item.event) {
        shopTrial[shopSlot] = id; // ya lo lleva puesto: abajo sale la opción de comprar otro igual
      } else if (owned) {
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
  if (titem && ownsItem(progress, titem.id) && !canWear(progress, ch.id, titem.id)) {
    // ya es tuyo pero lo lleva otro Matichico
    const who = wearers(progress, titem.id);
    const names = who.map((cid) => (CHARACTERS.find((c) => c.id === cid) || {}).name || "otro").join(" y ");
    const txt = document.createElement("div");
    txt.className = "sh-bar-txt";
    txt.innerHTML = `<b>${titem.icon} ${titem.name}</b> — lo está usando <b>${names}</b>. Solo uno a la vez: pásalo a ${ch.name} o compra otro.`;
    const pass = document.createElement("button");
    pass.className = "btn-primary";
    pass.textContent = `Pasárselo a ${ch.name}`;
    pass.addEventListener("click", () => {
      for (const cid of who) takeOff(progress, cid, titem.id);
      equipItem(progress, ch.id, shopSlot, titem.id);
      delete shopTrial[shopSlot];
      audio.playJump();
      renderShop();
      refreshShopPreview();
    });
    shopBarEl.append(txt, pass);
    if (!titem.event && titem.price > 0) {
      const need = titem.price - progress.coins;
      const more = document.createElement("button");
      more.className = "btn-secondary";
      more.textContent = need > 0 ? `Comprar otro (faltan ${need} 🍫✨)` : `Comprar otro · 🍫✨ ${titem.price}`;
      more.disabled = need > 0;
      more.addEventListener("click", () => {
        if (!buyItem(progress, titem.id)) return;
        equipItem(progress, ch.id, shopSlot, titem.id);
        delete shopTrial[shopSlot];
        audio.playPurchase();
        showToast(`¡Compraste otro ${titem.name}! 🎉`);
        renderShop();
        refreshShopPreview();
        refreshHubStats();
      });
      shopBarEl.append(more);
    }
    const cancel = document.createElement("button");
    cancel.className = "btn-secondary";
    cancel.textContent = "Cancelar";
    cancel.addEventListener("click", () => { delete shopTrial[shopSlot]; renderShop(); refreshShopPreview(); });
    shopBarEl.append(cancel);
  } else if (titem) {
    const evt = titem.event ? eventById(titem.event) : null;
    const avail = !evt || eventItemAvailable(titem);
    const need = evt ? titem.tokens - eventTokens(progress, evt.id) : titem.price - progress.coins;
    const lock = lockReason(progress, titem);
    const had = ownsItem(progress, titem.id);
    const txt = document.createElement("div");
    txt.className = "sh-bar-txt";
    txt.innerHTML = `<b>${titem.icon} ${titem.name}</b> <i style="color:${RARITIES[titem.rarity].color}">${RARITIES[titem.rarity].name}</i>` + (evt ? ` · <small>Exclusivo de ${evt.name}</small>` : "") +
      (had ? ` · <small>Ya lo tienes puesto. ¿Quieres otro igual para otro Matichico?</small>` : titem.soon ? ` · <small>🔜 Próximamente: lo puedes probar, pero todavía no se vende</small>` : lock ? ` · <small>🔒 Exclusivo: ${lock}</small>` : "");
    const buy = document.createElement("button");
    buy.className = "btn-primary";
    if (lock) buy.textContent = titem.soon ? "🔜 Próximamente" : `🔒 ${lock}`;
    else if (!avail) buy.textContent = `Vuelve en ${evt.name} ${evt.icon}`;
    else if (evt) buy.textContent = need > 0 ? `Te faltan ${need} fichas ${evt.token}` : `Comprar · ${evt.token} ${titem.tokens}`;
    else buy.textContent = need > 0 ? `Te faltan ${need} Matipuntos` : `${had ? "Comprar otro" : "Comprar"} · 🍫✨ ${titem.price}`;
    buy.disabled = !!lock || !avail || need > 0;
    buy.addEventListener("click", () => {
      if (!(evt ? buyEventItem(progress, titem.id) : buyItem(progress, titem.id))) return;
      equipItem(progress, ch.id, shopSlot, titem.id);
      delete shopTrial[shopSlot];
      audio.playPurchase();
      showToast(had ? `¡Compraste otro ${titem.name}! 🎉` : `¡Compraste ${titem.name}! 🎉 Ahora está en 🎒 Lo que tengo`);
      renderShop();
      refreshShopPreview();
      refreshHubStats();
    });
    const cancel = document.createElement("button");
    cancel.className = "btn-secondary";
    cancel.textContent = had ? "Cerrar" : "Quitar";
    cancel.addEventListener("click", () => {
      delete shopTrial[shopSlot];
      renderShop();
      refreshShopPreview();
    });
    shopBarEl.append(txt, buy, cancel);
  } else {
    shopBarEl.innerHTML = `<div class="sh-bar-txt">${wantOwn ? "Toca uno de tus objetos para ponértelo." : "Toca un objeto para probártelo antes de comprarlo. ¡Gana más Matipuntos jugando!"}</div>`;
  }
  renderShopCustom(ch);
}

/** Prendas "a tu gusto" (como el Uniforme Cheer): con una sola compra eliges el color (cualquiera) y la figura del centro. */
function renderShopCustom(ch) {
  const box = document.getElementById("shop-custom");
  if (!box) return;
  const cur = shopTrial.outfit || getLook(progress, ch.id).outfit;
  const item = shopSlot === "outfit" ? getItem(cur) : null;
  box.classList.toggle("hidden", !(item && item.custom));
  if (!(item && item.custom)) return;
  const look = getLook(progress, ch.id);
  const color = isHexColor(look.outfitColor) ? look.outfitColor.toUpperCase() : item.jersey.toUpperCase();
  const emblem = CUSTOM_EMBLEMS.some((e) => e.id === look.outfitEmblem) ? look.outfitEmblem : item.params.emblem;
  box.innerHTML = "";
  const apply = (patch) => { setOutfitCustom(progress, ch.id, patch); renderShop(); refreshShopPreview(); };
  const row1 = document.createElement("div");
  row1.className = "sc-row";
  row1.innerHTML = `<b>🎨 Color</b>`;
  for (const c of CUSTOM_COLORS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "sc-sw" + (c.toUpperCase() === color ? " on" : "");
    b.style.background = c;
    b.setAttribute("aria-label", `Color ${c}`);
    b.addEventListener("click", () => apply({ outfitColor: c }));
    row1.appendChild(b);
  }
  const pick = document.createElement("label");
  pick.className = "sc-pick";
  pick.title = "Cualquier color";
  pick.innerHTML = `🌈 <span>Otro</span><input type="color" value="${color.toLowerCase()}" aria-label="Elegir cualquier color">`;
  pick.querySelector("input").addEventListener("change", (e) => apply({ outfitColor: e.target.value }));
  row1.appendChild(pick);
  const row2 = document.createElement("div");
  row2.className = "sc-row";
  row2.innerHTML = `<b>✨ Figura del centro</b>`;
  for (const e of CUSTOM_EMBLEMS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "sc-em" + (e.id === emblem ? " on" : "");
    b.innerHTML = `<span>${e.icon}</span><small>${e.name}</small>`;
    b.addEventListener("click", () => apply({ outfitEmblem: e.id }));
    row2.appendChild(b);
  }
  box.append(row1, row2);
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
      const { FpsGame } = await import("./fps-game.js?v=fe581e124f");
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
  town: { module: "./town-game.js?v=fe581e124f", cls: "TownGame", hud: [] },
  recolecta: { module: "./recolecta-game.js?v=fe581e124f", cls: "RecolectaGame", hud: [] },
  basquet_tiros: { module: "./basquet3d-game.js?v=fe581e124f", cls: "Basquet3DGame", hud: [], prefix: "basquet" },
  porristas: { module: "./porristas3d-game.js?v=fe581e124f", cls: "Porristas3DGame", hud: ["score", "combo", "coins"] },
  parkour: { module: "./parkour-game.js?v=fe581e124f", cls: "ParkourGame", hud: [] },
  tetris: { module: "./tetris3d-game.js?v=fe581e124f", cls: "Tetris3DGame", hud: ["score", "lines", "level", "combo", "coins"] },
  salto: { module: "./salto-game.js?v=fe581e124f", cls: "SaltoGame", hud: ["score", "height", "hearts", "combo", "coins"] },
  autos: { module: "./autos-game.js?v=fe581e124f", cls: "AutosGame", hud: ["score", "speed", "hearts", "combo", "power", "coins"] },
  memoria: { module: "./memoria-game.js?v=fe581e124f", cls: "MemoriaGame", hud: ["level", "moves", "time", "score", "coins"] },
  futbol: { module: "./futbol-game.js?v=fe581e124f", cls: "FutbolGame", hud: [] },
  dulces: { module: "./dulces-game.js?v=fe581e124f", cls: "DulcesGame", hud: [] },
  merge: { module: "./merge-game.js?v=fe581e124f", cls: "MergeGame", hud: [] },
  aventura: { module: "./aventura-game.js?v=fe581e124f", cls: "AventuraGame", hud: [] },
  ciudad: { module: "./ciudad-game.js?v=fe581e124f", cls: "CiudadGame", hud: [] },
  creador: { module: "./creador-game.js?v=fe581e124f", cls: "CreadorGame", hud: ["score", "count", "coins"] },
  pichanga: { module: "./pichanga-game.js?v=fe581e124f", cls: "PichangaGame", hud: [] },
  basquet2v2: { module: "./basquet2v2-game.js?v=fe581e124f", cls: "Basquet2v2Game", hud: [], prefix: "bq2" },
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
      decorateIntro(key, pre);
      if (location.search.includes("debug3d")) (window.__g3d = window.__g3d || {})[key] = game; // solo para pruebas

      if (q("btn-start")) q("btn-start").addEventListener("click", () => game.beginPlaying());
      if (q("btn-retry")) q("btn-retry").addEventListener("click", () => game.retry());
      if (q("btn-menu")) {
        q("btn-menu").textContent = "⏸";
        q("btn-menu").title = "Pausa";
        q("btn-menu").setAttribute("aria-label", "Pausa");
        q("btn-menu").addEventListener("click", () => openPause(game));
      }
      if (q("btn-gameover-menu")) q("btn-gameover-menu").addEventListener("click", goToHub);
      if (q("btn-next")) q("btn-next").addEventListener("click", () => goNextLevel(game));
      if (q("btn-win-menu")) q("btn-win-menu").addEventListener("click", goToHub);
      // Convención nueva: cualquier botón con data-action dentro de la pantalla.
      const actions = { begin: () => game.beginPlaying(), next: () => goNextLevel(game), retry: () => game.retry(), restart: () => game.restart?.() ?? game.startRun(selectedCharacter, progress), menu: goToHub };
      document.getElementById(`screen-${pre}`).querySelectorAll("[data-action]").forEach((btn) => {
        btn.addEventListener("click", () => actions[btn.dataset.action]?.());
      });
      const joy = q("joy");
      if (joy) bindStick(joy, (x, y) => game.setStick?.(x, y), document.getElementById(`${pre}-canvas-wrap`));
      const btnMute = q("btn-mute");
      btnMute.addEventListener("click", () => {
        audio.setMuted(!audio.isMuted());
        syncSoundLabels();
      });
    }
    activeGame = instances[key];
    await instances[key].startRun(selectedCharacter, progress);
  } catch (err) {
    console.error(err);
    showToast(`Tu dispositivo no pudo cargar el modo 3D. [${key}: ${errDetail(err)}]`, 9000);
    instances[key] = null;
    goToHub();
  }
}

// ---------- AVENTURA DEL FESTIVAL (menú y pantalla; ver js/adventure-ui.js) ----------
const advUI = initAdventureUI({
  getProgress: () => progress,
  getCharacter: () => selectedCharacter,
  playGame,
  showScreen,
  screenHub,
  showToast,
  queueToast,
  needCharacter,
  refreshHub: () => { refreshHubStats(); advUI.renderPaths(); },
});
// los modos nuevos también se abren desde las tarjetas de Fútbol y de Lanzamientos
document.getElementById("futbol-btn-pichanga")?.addEventListener("click", () => playGame("pichanga"));
document.getElementById("basquet-btn-2v2")?.addEventListener("click", () => playGame("basquet2v2"));
// app en segundo plano: se anota cuándo te fuiste (para el resumen al volver); al volver al menú se muestra si corresponde
document.addEventListener("visibilitychange", () => {
  if (!progress) return;
  if (document.visibilityState === "hidden") {
    // solo se anota la hora de salida dentro del guardado (no se reescribe todo: lo demás ya se guardó al cambiar)
    const now = Date.now();
    adventureOf(progress).lastSeen = now;
    try {
      const k = storageKeyForProfile(progress._profileId);
      const saved = JSON.parse(localStorage.getItem(k) || "null");
      if (saved && typeof saved === "object" && saved.adventure && typeof saved.adventure === "object") { saved.adventure.lastSeen = now; localStorage.setItem(k, JSON.stringify(saved)); }
    } catch (e) { /* sin almacenamiento: no pasa nada, solo no habrá resumen al volver */ }
  }
  else if (!screenHub.classList.contains("hidden")) advUI.showWelcome();
});

// ---------- ARRANQUE ----------

const existingProfiles = listProfiles();
const lastActiveId = getLastActiveProfileId();
if (lastActiveId && existingProfiles.some((p) => p.id === lastActiveId)) {
  chooseProfile(lastActiveId);
} else {
  goToProfiles();
}
markAppReady(); // el menú ya está listo: la pantalla de carga puede irse
