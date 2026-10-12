import { CHARACTERS, OUTFITS, getOutfit, renderCharacterThumb } from "./characters.js";
import * as audio from "./audio.js";
import { GAMES_CATALOG } from "./games-catalog.js";
import {
  loadProgress, saveProgress, ownsOutfit, equippedOutfitId, buyOutfit, equipOutfit,
  getBestScore, getLeaderboard, canClaimDailyReward, claimDailyReward, claimAchievement,
} from "./storage.js";
import {
  listProfiles, createProfile, deleteProfile, updateProfileMeta,
  getLastActiveProfileId, setLastActiveProfileId, MAX_PROFILES,
} from "./profiles.js";
import { ACHIEVEMENTS } from "./achievements.js";

let progress = null;
let selectedCharacter = null;
let shopCharacterId = CHARACTERS[0].id;

const screenProfiles = document.getElementById("screen-profiles");
const screenHub = document.getElementById("screen-hub");
const screenShop = document.getElementById("screen-shop");
const screenLeaderboard = document.getElementById("screen-leaderboard");
const screenAchievements = document.getElementById("screen-achievements");
const screenFps = document.getElementById("screen-fps");
const screen3d = {
  recolecta: document.getElementById("screen-recolecta"),
  tetris: document.getElementById("screen-tetris"),
  parkour: document.getElementById("screen-parkour"),
  porristas: document.getElementById("screen-porristas"),
  basquet_tiros: document.getElementById("screen-basquet"),
  salto: document.getElementById("screen-salto"),
  autos: document.getElementById("screen-autos"),
  memoria: document.getElementById("screen-memoria"),
  creador: document.getElementById("screen-creador"),
};
const ALL_SCREENS = [
  screenProfiles, screenHub, screenShop, screenLeaderboard, screenAchievements,
    screenFps,
  ...Object.values(screen3d),
];

const grid = document.getElementById("character-grid");
const gameGrid = document.getElementById("game-grid");
const inputName = document.getElementById("input-name");
const hubTotalCoinsEl = document.getElementById("hub-total-coins");
const toastEl = document.getElementById("toast");

// Instancias únicas de cada motor, creadas recién la primera vez que se juegan
// y reutilizadas entre partidas y entre perfiles (ver rebind en playGame()).
const instances = { parkour: null, recolecta: null, tetris: null, basquet_tiros: null, porristas: null, fps: null, salto: null, autos: null, memoria: null, creador: null };

let toastTimer = null;
function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.add("hidden"), 2600);
}

function showScreen(target) {
  ALL_SCREENS.forEach((s) => s.classList.toggle("hidden", s !== target));
  syncLobby(target === screenHub);
}

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
  const outfit = getOutfit(equippedOutfitId(progress, char.id));
  const key = `${char.id}|${outfit.id}`;
  const nameEl = document.getElementById("lb-char-name");
  if (nameEl) nameEl.textContent = selectedCharacter ? char.name : "Elige tu Matichico";
  const fb = document.getElementById("lobby-fallback");
  const cv = document.getElementById("lobby-canvas");
  const useFallback = () => {
    lobbyFailed = true;
    cv.classList.add("hidden");
    fb.classList.remove("hidden");
    renderCharacterThumb(fb, char, outfit);
  };
  try {
    if (lobbyFailed) { useFallback(); return; }
    if (!lobby) {
      const { Lobby3D } = await import("./lobby3d.js");
      lobby = new Lobby3D(cv);
      lobby.init();
    }
    if (lobby.key !== key) lobby.setHero(char, outfit, key);
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

function refreshHubStats() {
  hubTotalCoinsEl.textContent = String(progress.coins);
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
      renderCharacterThumb(canvas, char, getOutfit("liga"));
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
    renderCharacterThumb(c, selectedCharacter, getOutfit(equippedOutfitId(progress, selectedCharacter.id)));
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
  btnDailyReward.textContent = can
    ? "🎁 Recompensa diaria"
    : `🎁 Reclamado (racha ${progress.dailyStreak} día${progress.dailyStreak === 1 ? "" : "s"})`;
}

btnDailyReward.addEventListener("click", () => {
  const result = claimDailyReward(progress);
  if (!result) return;
  audio.playPurchase();
  refreshHubStats();
  updateDailyRewardButton();
  showToast(`¡+${result.reward} monedas! Racha de ${result.streak} día${result.streak === 1 ? "" : "s"} 🔥`);
});

// ---------- LOGROS ----------

const achievementListEl = document.getElementById("achievement-list");

document.getElementById("btn-open-achievements").addEventListener("click", () => {
  showScreen(screenAchievements);
  renderAchievements();
});
document.getElementById("btn-achievements-back").addEventListener("click", () => showScreen(screenHub));

function renderAchievements() {
  achievementListEl.innerHTML = "";
  ACHIEVEMENTS.forEach((a) => {
    const done = a.isDone(progress);
    const claimed = progress.claimedAchievements.includes(a.id);

    const card = document.createElement("div");
    card.className = "achievement-card" + (done ? " done" : "");

    const icon = document.createElement("span");
    icon.className = "aicon";
    icon.textContent = a.icon;

    const body = document.createElement("div");
    body.className = "abody";
    const name = document.createElement("span");
    name.className = "aname";
    name.textContent = a.name;
    const desc = document.createElement("div");
    desc.className = "adesc";
    desc.textContent = `${a.desc} (+${a.reward} 🍫✨)`;
    body.appendChild(name);
    body.appendChild(desc);

    const button = document.createElement("button");
    if (claimed) {
      button.textContent = "Reclamado ✓";
      button.disabled = true;
    } else if (done) {
      button.textContent = "Reclamar";
      button.addEventListener("click", () => {
        if (claimAchievement(progress, a)) {
          audio.playPurchase();
          refreshHubStats();
          renderAchievements();
          showToast(`¡Logro cumplido! +${a.reward} monedas 🎉`);
        }
      });
    } else {
      button.textContent = "Bloqueado";
      button.disabled = true;
    }

    card.appendChild(icon);
    card.appendChild(body);
    card.appendChild(button);
    achievementListEl.appendChild(card);
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
  renderCharacterThumb(canvas, char, getOutfit(equippedOutfitId(progress, char.id)));

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
  const play = document.createElement("span");
  play.className = "gplay";
  play.textContent = "▶ Jugar";
  wrap.appendChild(play);
  return wrap;
}

function renderGameGrid() {
  gameGrid.innerHTML = "";
  const featureEl = document.getElementById("game-feature");
  featureEl.innerHTML = "";
  const available = GAMES_CATALOG.filter((g) => g.status === "available");
  const last = available.find((g) => g.id === progress.lastGameId);
  const featured = last || available.find((g) => g.id === "parkour") || available[0];

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
    card.className = `game-card ${entry.status}`;
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

function playGame(gameId) {
  if (!selectedCharacter) {
    window.alert("Elige primero a tu Matichico.");
    return;
  }
  if (!progress.playerName) {
    progress.playerName = "Jugador";
    inputName.value = progress.playerName;
    saveProgress(progress);
  }

  progress.lastGameId = gameId;
  saveProgress(progress);

  // Nunca deben quedar dos juegos "activos" a la vez (evita que uno siga
  // corriendo lógica de fondo mientras se muestra el otro).
  Object.values(instances).forEach((instance) => instance && instance.pauseForMenu());

  if (gameId === "fps3d") {
    showScreen(screenFps);
    launchOrResumeFps();
  } else if (GAMES_3D[gameId]) {
    showScreen(screen3d[gameId]);
    launchOrResume3d(gameId);
  }
}

function goToHub() {
  Object.values(instances).forEach((instance) => instance && instance.pauseForMenu());
  refreshHubStats();
  renderCharacterGrid();
  renderGameGrid();
  updateDailyRewardButton();
  showScreen(screenHub);
}

// ---------- TIENDA ----------

const btnOpenShop = document.getElementById("btn-open-shop");
const btnShopBack = document.getElementById("btn-shop-back");
const shopCoinsEl = document.getElementById("shop-coins");
const shopCharacterSwitcher = document.getElementById("shop-character-switcher");
const shopCharacterNameEl = document.getElementById("shop-character-name");
const outfitGrid = document.getElementById("outfit-grid");

btnOpenShop.addEventListener("click", () => {
  showScreen(screenShop);
  renderShopSwitcher();
  renderShop();
});

btnShopBack.addEventListener("click", () => showScreen(screenHub));

function renderShopSwitcher() {
  shopCharacterSwitcher.innerHTML = "";
  CHARACTERS.forEach((char) => {
    const btn = document.createElement("button");
    btn.className = "shop-switch-btn" + (char.id === shopCharacterId ? " active" : "");
    const canvas = document.createElement("canvas");
    canvas.width = 96;
    canvas.height = 96;
    renderCharacterThumb(canvas, char, getOutfit(equippedOutfitId(progress, char.id)));
    btn.appendChild(canvas);
    btn.addEventListener("click", () => {
      shopCharacterId = char.id;
      renderShopSwitcher();
      renderShop();
    });
    shopCharacterSwitcher.appendChild(btn);
  });
}

function renderShop() {
  const shopCharacter = CHARACTERS.find((c) => c.id === shopCharacterId);
  shopCoinsEl.textContent = String(progress.coins);
  shopCharacterNameEl.textContent = `Atuendos de ${shopCharacter.name}`;
  outfitGrid.innerHTML = "";

  OUTFITS.forEach((outfit) => {
    const owned = ownsOutfit(progress, shopCharacter.id, outfit.id);
    const equipped = equippedOutfitId(progress, shopCharacter.id) === outfit.id;
    const affordable = progress.coins >= outfit.price;

    const card = document.createElement("div");
    card.className = "outfit-card" + (equipped ? " equipped" : "") + (!owned && !affordable ? " locked" : "");

    if (equipped) {
      const ribbon = document.createElement("span");
      ribbon.className = "oribbon";
      ribbon.textContent = "EQUIPADO";
      card.appendChild(ribbon);
    }

    const canvas = document.createElement("canvas");
    canvas.width = 192;
    canvas.height = 192;
    renderCharacterThumb(canvas, shopCharacter, outfit);

    const name = document.createElement("span");
    name.className = "oname";
    name.textContent = outfit.name;

    const price = document.createElement("span");
    price.className = "oprice" + (owned ? " owned" : "");
    price.textContent = owned ? (equipped ? "Equipado" : "Adquirido") : `🍫✨ ${outfit.price}`;

    const button = document.createElement("button");
    if (equipped) {
      button.textContent = "Equipado";
      button.disabled = true;
    } else if (owned) {
      button.textContent = "Equipar";
      button.classList.add("equip-btn");
      button.addEventListener("click", () => {
        equipOutfit(progress, shopCharacter.id, outfit.id);
        renderShopSwitcher();
        renderShop();
      });
    } else {
      button.textContent = affordable ? "Comprar" : "🔒 Bloqueado";
      button.disabled = !affordable;
      button.addEventListener("click", () => {
        if (buyOutfit(progress, shopCharacter.id, outfit)) {
          audio.playPurchase();
          renderShopSwitcher();
          renderShop();
          refreshHubStats();
          showToast(`¡Compraste ${outfit.name}!`);
        }
      });
    }

    card.appendChild(canvas);
    card.appendChild(name);
    card.appendChild(price);
    card.appendChild(button);
    outfitGrid.appendChild(card);
  });
}

// ---------- TABLA DE PUNTAJES ----------

const btnOpenLeaderboard = document.getElementById("btn-open-leaderboard");
const btnLeaderboardBack = document.getElementById("btn-leaderboard-back");
const leaderboardTabs = document.getElementById("leaderboard-tabs");
const leaderboardList = document.getElementById("leaderboard-list");
const leaderboardEmpty = document.getElementById("leaderboard-empty");

const availableGames = GAMES_CATALOG.filter((g) => g.status === "available");
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
  renderCharacterThumb(avatarCanvas, character, getOutfit(equippedOutfitId(progress, character.id)));
  hudAvatar.src = avatarCanvas.toDataURL();
}

// ---------- JUEGO: "CHOCO BLASTER 3D" (primera persona, carga perezosa) ----------

async function launchOrResumeFps() {
  updateHudAvatar("fps-hud-avatar", selectedCharacter);
  try {
    if (!instances.fps) {
      showToast("Cargando el mundo 3D…");
      const { FpsGame } = await import("./fps-game.js");
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
    showToast("Tu dispositivo no pudo cargar el modo 3D.");
    instances.fps = null;
    goToHub();
  }
}

// ---------- JUEGOS 3D (Salto Choco, Autos de Chocolate, Memoria Matichoc) ----------
// Los tres comparten la base Game3D y la misma convención de ids en index.html:
// "<prefijo>-canvas", "-hud-<nombre>", "-overlay-<intro|win|gameover>", "-btn-*".

const GAMES_3D = {
  recolecta: { module: "./recolecta-game.js", cls: "RecolectaGame", hud: [] },
  basquet_tiros: { module: "./basquet3d-game.js", cls: "Basquet3DGame", hud: [], prefix: "basquet" },
  porristas: { module: "./porristas3d-game.js", cls: "Porristas3DGame", hud: ["score", "combo", "coins"] },
  parkour: { module: "./parkour-game.js", cls: "ParkourGame", hud: [] },
  tetris: { module: "./tetris3d-game.js", cls: "Tetris3DGame", hud: ["score", "lines", "level", "coins"] },
  salto: { module: "./salto-game.js", cls: "SaltoGame", hud: ["score", "height", "coins"] },
  autos: { module: "./autos-game.js", cls: "AutosGame", hud: ["score", "speed", "hearts", "coins"] },
  memoria: { module: "./memoria-game.js", cls: "MemoriaGame", hud: ["level", "moves", "time", "score", "coins"] },
  creador: { module: "./creador-game.js", cls: "CreadorGame", hud: ["score", "count", "coins"] },
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
    showToast("Tu dispositivo no pudo cargar el modo 3D.");
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
