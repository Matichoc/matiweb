// Campaña de niveles: cada juego por niveles tiene 20, se van desbloqueando de a uno y cada nivel
// guarda sus estrellas (1 a 3). Los juegos "infinitos" no usan niveles: tienen su modo misiones
// (ver js/missions.js). Todo vive en `progress.campaign[idJuego] = { unlocked, stars: { nivel: n } }`.

import { saveProgress, earnCoins } from "./storage.js?v=c7f11ecb8c";
import { demoAllows, showDemoWall } from "./demo.js?v=c7f11ecb8c";

export const LEVELS_PER_GAME = 20;

export function campaign(progress, id) {
  progress.campaign = progress.campaign || {};
  if (!progress.campaign[id]) progress.campaign[id] = { unlocked: 1, stars: {} };
  return progress.campaign[id];
}

/** Anota un nivel ganado: desbloquea el siguiente y guarda las mejores estrellas. */
export function campaignWin(progress, id, level, stars) {
  const c = campaign(progress, id);
  c.stars[level] = Math.max(c.stars[level] || 0, stars);
  c.unlocked = Math.min(LEVELS_PER_GAME, Math.max(c.unlocked, level + 1));
  // la historia de por vida (para los logros) no se pierde aunque empieces una vuelta nueva
  c.hist = c.hist || { won: {} };
  c.hist.won = c.hist.won || {};
  c.hist.won[level] = Math.max(c.hist.won[level] || 0, stars);
  // al terminar el último nivel, la próxima vez se parte desde el principio (no desde el final)
  if (campaignComplete(progress, id)) c.selected = 1;
  saveProgress(progress);
}

/** ¿Ya se ganaron todos los niveles (al menos con una estrella)? */
export function campaignComplete(progress, id, total = LEVELS_PER_GAME) {
  const c = campaign(progress, id);
  for (let n = 1; n <= total; n++) if (!(c.stars[n] > 0)) return false;
  return true;
}

export const campaignLaps = (progress, id) => campaign(progress, id).laps || 0;

/** Lo que da empezar una vuelta nueva después de completar todos los niveles. */
export function lapReward(progress, id) {
  const stars = campaignStars(progress, id);
  return { stars, coins: 100 + stars * 3, packs: stars >= LEVELS_PER_GAME * 3 - 3 ? 2 : 1 };
}

/**
 * Empieza la campaña de cero (todos los niveles vuelven a empezar desde el 1, con sus estrellas en blanco).
 * Si ya estaba completa se entrega el premio de la vuelta (Matipuntos y sobres) y se cuenta una vuelta más;
 * si no, solo reinicia. Lo ganado antes (logros, Matipuntos, figuritas) se queda. Devuelve el premio o null.
 */
export function campaignStartOver(progress, id) {
  const c = campaign(progress, id);
  let reward = null;
  if (campaignComplete(progress, id)) {
    reward = lapReward(progress, id);
    earnCoins(progress, reward.coins);
    progress.packs = (progress.packs || 0) + reward.packs;
    c.laps = (c.laps || 0) + 1;
    c.bestLapStars = Math.max(c.bestLapStars || 0, reward.stars);
    reward.lap = c.laps + 1;
    progress.stats.laps = (progress.stats.laps || 0) + 1;
  }
  c.unlocked = 1;
  c.stars = {};
  c.selected = 1;
  if (id === "recolecta") { // Recolecta guarda además su avance aparte
    c.hist = c.hist || { won: {} };
    c.hist.rec = Math.max(c.hist.rec || 0, progress.unlockedLevel || 0);
    progress.unlockedLevel = 0;
    progress.recolectaStars = {};
  }
  saveProgress(progress);
  return reward;
}

export const campaignStars = (progress, id) => Object.values(campaign(progress, id).stars).reduce((a, b) => a + b, 0);

/**
 * Dibuja la grilla de niveles (1 a 20) en `el`. Los que aún no se desbloquean salen con candado.
 * `onSelect(n)` se llama al tocar uno disponible.
 */
export function renderLevelPicker(el, { id, progress, selected, onSelect, total = LEVELS_PER_GAME, open = false, note = "" }) {
  if (!el) return;
  const c = campaign(progress, id);
  el.innerHTML = "";
  const stars = campaignStars(progress, id);
  const laps = campaignLaps(progress, id);
  const again = (n, note = "") => { onSelect(n); renderLevelPicker(el, { id, progress, selected: n, onSelect, total, open: false, note }); };
  // ¡completaste todo! → se ofrece una vuelta nueva con premio
  if (campaignComplete(progress, id, total)) {
    const r = lapReward(progress, id);
    const lap = document.createElement("button");
    lap.type = "button";
    lap.className = "lvl-lap";
    lap.innerHTML = `<b>🏆 ¡Completaste los ${total} niveles!</b><span>🔄 Empezar la vuelta ${laps + 2} · premio: 🍫✨ ${r.coins}${r.packs ? ` y ${r.packs} 🎴` : ""}</span>`;
    lap.addEventListener("click", () => {
      const got = campaignStartOver(progress, id);
      again(1, got ? `🎉 ¡Vuelta ${got.lap}! Ganaste 🍫✨ ${got.coins} y ${got.packs} sobre${got.packs > 1 ? "s" : ""} 🎴` : "");
    });
    el.appendChild(lap);
  }
  if (note) { const n = document.createElement("div"); n.className = "lvl-note"; n.textContent = note; el.appendChild(n); }
  // plegado: una sola línea con el nivel elegido (ahorra espacio); se despliega para elegir otro
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "lvl-toggle";
  toggle.innerHTML = `<b>Nivel ${selected} de ${total}${laps ? ` · vuelta ${laps + 1}` : ""}</b><span>⭐ ${stars} / ${total * 3} · ${open ? "Cerrar ▴" : "Cambiar ▾"}</span>`;
  toggle.addEventListener("click", () => renderLevelPicker(el, { id, progress, selected, onSelect, total, open: !open }));
  el.appendChild(toggle);
  if (!open) return;
  const grid = document.createElement("div");
  grid.className = "lvl-grid";
  for (let n = 1; n <= total; n++) {
    const demoOk = demoAllows(id, n); // en la demo de la web solo se juegan los primeros niveles
    const ok = n <= c.unlocked;
    const b = document.createElement("button");
    b.type = "button";
    b.className = `lvl-btn${n === selected ? " sel" : ""}${ok && demoOk ? "" : " locked"}`;
    const st = c.stars[n] || 0;
    b.innerHTML = !demoOk ? `<b>📲</b><i>${n}</i>` : ok ? `<b>${n}</b><i>${"★".repeat(st)}${"☆".repeat(3 - st)}</i>` : `<b>🔒</b><i>${n}</i>`;
    b.disabled = !ok && demoOk;
    b.addEventListener("click", () => { if (!demoOk) { showDemoWall(); return; } onSelect(n); renderLevelPicker(el, { id, progress, selected: n, onSelect, total, open: false }); });
    grid.appendChild(b);
  }
  el.appendChild(grid);
  // empezar de cero (sin premio) cuando aún no se completa todo; pide un segundo toque para no borrar por error
  if (Object.keys(c.stars).length > 0 && !campaignComplete(progress, id, total)) {
    const rs = document.createElement("button");
    rs.type = "button";
    rs.className = "lvl-reset";
    rs.textContent = "🔄 Empezar los niveles de cero";
    let armed = null;
    rs.addEventListener("click", () => {
      if (!armed) { rs.textContent = "¿Seguro? Se borran las estrellas de esta vuelta. Toca otra vez"; armed = setTimeout(() => { armed = null; rs.textContent = "🔄 Empezar los niveles de cero"; }, 4000); return; }
      clearTimeout(armed);
      campaignStartOver(progress, id);
      again(1, "🔄 Empezaste de nuevo desde el nivel 1");
    });
    el.appendChild(rs);
  }
}

/**
 * Selector completo para juegos con dos modos: "♾️ Infinito" (como siempre) y "🏆 20 niveles".
 * Guarda el modo elegido y el nivel; `onChange()` avisa al juego para que reinicie con lo elegido.
 */
export function renderModePicker(el, { id, progress, onChange, kind = "levels" }) {
  if (!el) return;
  const c = campaign(progress, id);
  c.mode = c.mode || kind;
  if (kind === "missions" && c.mode === "levels") c.mode = "missions";
  if (kind === "levels" && c.mode === "missions") c.mode = "levels";
  c.selected = Math.min(c.selected || c.unlocked, c.unlocked);
  el.innerHTML = "";
  const row = document.createElement("div");
  row.className = "mode-row";
  for (const [mode, label] of [[kind, kind === "missions" ? "🎯 20 misiones" : "🏆 20 niveles"], ["inf", "♾️ Infinito"]]) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `mode-btn${c.mode === mode ? " sel" : ""}`;
    b.textContent = label;
    b.addEventListener("click", () => { c.mode = mode; saveProgress(progress); renderModePicker(el, { id, progress, onChange, kind }); onChange(); });
    row.appendChild(b);
  }
  el.appendChild(row);
  if (c.mode === kind) {
    const box = document.createElement("div");
    el.appendChild(box);
    renderLevelPicker(box, { id, progress, selected: c.selected, onSelect: (n) => { c.selected = n; saveProgress(progress); onChange(); } });
  }
}

export const campaignMode = (progress, id, def = "levels") => campaign(progress, id).mode || def;
export const campaignLevel = (progress, id) => { const c = campaign(progress, id); return Math.min(c.selected || c.unlocked, c.unlocked); };
