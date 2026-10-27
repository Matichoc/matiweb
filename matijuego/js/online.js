// Ranking y monitoreo del creador: manda al servidor SOLO el apodo del perfil, un identificador al azar y el avance de juego
// (puntajes, nivel, partidas y tiempo jugado). Nada de datos personales. Está apagado hasta que js/online-config.js tenga datos.
// La tabla no se puede leer desde la app: el creador la ve desde admin/ranking.html y decide si se la muestra a los jugadores.
import { ONLINE } from "./online-config.js?v=73aaf47357";

const url = String(ONLINE.url || "").replace(/\/$/, "");
const SYNC_EVERY = 90 * 1000; // como mucho una actualización cada 90 s
let last = 0;
let timer = null;
let lastProgress = null;
let lastNick = "";
let sessionCounted = false;
let ver = "";
try { ver = new URL(import.meta.url).searchParams.get("v") || ""; } catch (e) { /* sin versión */ }

export const onlineEnabled = () => !!(url && ONLINE.anonKey);

async function rpc(name, body, keepalive = false) {
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: ONLINE.anonKey, Authorization: `Bearer ${ONLINE.anonKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    keepalive,
  });
  if (!res.ok) throw new Error(`${name}: ${res.status}`);
  const txt = await res.text();
  return txt ? JSON.parse(txt) : null;
}

function newId() {
  if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 3) | 8).toString(16);
  });
}

function payload(p) {
  const st = p.stats || {};
  const done = (p.ciudad && p.ciudad.done) || {};
  return {
    id: p.onlineId,
    nick: String(p.playerName || "Jugador").trim().slice(0, 24) || "Jugador",
    platform: document.documentElement.dataset.app ? "app" : "web",
    xp: Math.max(0, Math.round(p.xp || 0)),
    plays: Math.max(0, Math.round(st.totalRuns || 0)),
    play_secs: Math.max(0, Math.round(st.playSecs || 0)),
    coins: Math.max(0, Math.round(p.coins || 0)),
    best: p.bestScores || {},
    extra: {
      unlocked: (p.unlockedGames || []).length,
      achievements: (p.claimedAchievements || []).length,
      ciudad_missions: Object.keys(done).filter((k) => done[k]).length,
      ciudad_medal: (p.ciudad && p.ciudad.medal) || 0,
      play_days: st.playDays || 0,
      days: (st.playDayList || []).slice(-30), // días en que jugó (últimos 30)
      sessions: st.sessions || 0, // veces que abrió el juego
      runs_by: st.runsBy || {}, // partidas por juego
      energy: p.energy ? Math.round(p.energy.v || 0) : 100, // energía que le queda
      ver, // versión de los archivos (para saber si ya tiene la última)
    },
  };
}

/** Se llama cada vez que se guarda el progreso; solo envía de vez en cuando (o de inmediato con `force`). */
export function queueSync(progress, force = false) {
  if (!onlineEnabled() || !progress || !progress._profileId) return;
  lastProgress = progress;
  if (!progress.onlineId) progress.onlineId = newId(); // queda guardado con el progreso
  if (!sessionCounted) { sessionCounted = true; progress.stats.sessions = (progress.stats.sessions || 0) + 1; force = true; } // una sesión por cada vez que se abre el juego
  const nick = String(progress.playerName || "").trim();
  if (nick !== lastNick) { lastNick = nick; force = true; } // si cambia el apodo se actualiza de inmediato
  const now = Date.now();
  if (!force && now - last < SYNC_EVERY) {
    if (!timer) timer = setTimeout(() => { timer = null; queueSync(progress, true); }, SYNC_EVERY - (now - last));
    return;
  }
  last = now;
  rpc("mj_upsert_player", { p: payload(progress) }, force).catch(() => { /* sin internet: se reintenta en el próximo guardado */ });
}

/** ¿El creador ya decidió mostrar el ranking a los jugadores? */
export async function rankingEnabled() {
  if (!onlineEnabled()) return false;
  try { return (await rpc("mj_ranking_enabled", {})) === true; } catch (e) { return false; }
}

/** Los mejores puntajes de un juego: [{ nick, score }] (vacío si el ranking no está abierto al público). */
export async function fetchRanking(game, limit = 20) {
  if (!onlineEnabled()) return [];
  try { return (await rpc("mj_public_ranking", { g: game, lim: limit })) || []; } catch (e) { return []; }
}

// al cerrar o cambiar de app, se manda lo último
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden" && lastProgress) queueSync(lastProgress, true); });
}
