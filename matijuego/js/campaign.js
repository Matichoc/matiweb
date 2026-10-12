// Campaña de niveles: cada juego por niveles tiene 20, se van desbloqueando de a uno y cada nivel
// guarda sus estrellas (1 a 3). Los juegos "infinitos" no usan niveles: tienen su modo misiones
// (ver js/missions.js). Todo vive en `progress.campaign[idJuego] = { unlocked, stars: { nivel: n } }`.

import { saveProgress } from "./storage.js?v=f2916d806a";

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
  saveProgress(progress);
}

export const campaignStars = (progress, id) => Object.values(campaign(progress, id).stars).reduce((a, b) => a + b, 0);

/**
 * Dibuja la grilla de niveles (1 a 20) en `el`. Los que aún no se desbloquean salen con candado.
 * `onSelect(n)` se llama al tocar uno disponible.
 */
export function renderLevelPicker(el, { id, progress, selected, onSelect, total = LEVELS_PER_GAME, open = false }) {
  if (!el) return;
  const c = campaign(progress, id);
  el.innerHTML = "";
  const stars = campaignStars(progress, id);
  // plegado: una sola línea con el nivel elegido (ahorra espacio); se despliega para elegir otro
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "lvl-toggle";
  toggle.innerHTML = `<b>Nivel ${selected} de ${total}</b><span>⭐ ${stars} / ${total * 3} · ${open ? "Cerrar ▴" : "Cambiar ▾"}</span>`;
  toggle.addEventListener("click", () => renderLevelPicker(el, { id, progress, selected, onSelect, total, open: !open }));
  el.appendChild(toggle);
  if (!open) return;
  const grid = document.createElement("div");
  grid.className = "lvl-grid";
  for (let n = 1; n <= total; n++) {
    const ok = n <= c.unlocked;
    const b = document.createElement("button");
    b.type = "button";
    b.className = `lvl-btn${n === selected ? " sel" : ""}${ok ? "" : " locked"}`;
    const st = c.stars[n] || 0;
    b.innerHTML = ok ? `<b>${n}</b><i>${"★".repeat(st)}${"☆".repeat(3 - st)}</i>` : `<b>🔒</b><i>${n}</i>`;
    b.disabled = !ok;
    b.addEventListener("click", () => { onSelect(n); renderLevelPicker(el, { id, progress, selected: n, onSelect, total, open: false }); });
    grid.appendChild(b);
  }
  el.appendChild(grid);
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
