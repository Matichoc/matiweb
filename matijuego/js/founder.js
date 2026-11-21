// Regalo de fundador (versión 1.2, pedido de la persona dueña): a quienes juegan el Matijuego desde el comienzo se les
// regalan 2.000 Matipuntos para que elijan al tiro uno de los 5 juegos nuevos de verano (los otros quedan por comprar).
// No se puede saber quién es "el usuario número 50" sin enviar datos a un servidor (y el juego no envía nada: ver la
// política de privacidad), así que la regla es por fecha: cada perfil que entra al juego hasta el 31 de diciembre de
// 2026 recibe el regalo una sola vez. En la demo de la web no aparece (ahí los juegos ya se pueden probar).

import { earnCoins, saveProgress } from "./storage.js?v=5545779b2a";
import { unlockGame, UNLOCK_COST } from "./unlocks.js?v=5545779b2a";
import { GAMES_CATALOG } from "./games-catalog.js?v=5545779b2a";
import { IS_DEMO } from "./demo.js?v=5545779b2a";
import * as audio from "./audio.js?v=5545779b2a";
import { celebrate } from "./celebrate.js?v=5545779b2a";

export const FOUNDER_UNTIL = "2026-12-31"; // último día (hora del celular) en que se entrega
export const FOUNDER_COINS = 2000;
export const SUMMER_GAMES = ["torre", "avioneta", "lanchas", "minigolf", "billar"];

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** ¿Le toca el regalo a este perfil? */
const skipForTests = () => { try { return localStorage.getItem("matichoc_sin_regalo_fundador") === "1"; } catch (e) { return false; } };

export function founderGiftDue(progress) {
  // (las pruebas automáticas la apagan con matichoc_sin_regalo_fundador: ver scripts/qa/lib.cjs)
  return !IS_DEMO && !!progress && !progress.founderGift && today() <= FOUNDER_UNTIL && !skipForTests();
}

/**
 * Si le toca, muestra la ventana del regalo cuando no haya otra ventana abierta y `ready()` diga que sí (el jugador ya
 * eligió su Matichico y está en el menú). `onChange` se llama después de entregar el regalo, para refrescar el menú.
 */
export function offerFounderGift(progress, { onChange, ready } = {}) {
  if (!founderGiftDue(progress)) return;
  let tries = 0;
  const wait = () => {
    if (!founderGiftDue(progress) || document.querySelector(".founder-modal")) return;
    // espera a que el jugador ya tenga su Matichico y esté en el menú, sin otra ventana abierta
    const busy = document.querySelectorAll(".modal:not(.hidden)").length > 0 || (ready && !ready());
    if (busy) { if (tries++ < 1800) setTimeout(wait, 700); return; }
    show(progress, onChange);
  };
  setTimeout(wait, 1200);
}

function show(progress, onChange) {
  const games = SUMMER_GAMES.map((id) => GAMES_CATALOG.find((g) => g.id === id)).filter(Boolean);
  const modal = document.createElement("div");
  modal.className = "modal founder-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.innerHTML = `
    <div class="modal-card joy-card founder-card">
      <h2>🎁 ¡Regalo de fundador!</h2>
      <p>Gracias por ser de los primeros en jugar el Matijuego. Te regalamos <b>${FOUNDER_COINS.toLocaleString("es-CL")} Matipuntos</b> para que elijas <b>uno de los 5 juegos nuevos de verano</b> y lo juegues al tiro:</p>
      <div class="founder-games">${games.map((g) => `<button type="button" class="founder-game" data-id="${g.id}"><span>${g.icon}</span><b>${g.name}</b></button>`).join("")}</div>
      <button type="button" class="btn-secondary founder-keep" data-back>Prefiero guardar los Matipuntos</button>
    </div>`;
  document.body.appendChild(modal);
  const done = (choice) => {
    progress.founderGift = { date: today(), choice: choice || null };
    earnCoins(progress, FOUNDER_COINS);
    let unlocked = null;
    if (choice && (UNLOCK_COST[choice] || 0) <= FOUNDER_COINS) unlocked = unlockGame(progress, choice) ? choice : null;
    saveProgress(progress);
    modal.remove();
    audio.playVictory();
    celebrate({ big: true });
    onChange?.(unlocked);
  };
  modal.querySelectorAll(".founder-game").forEach((b) => b.addEventListener("click", () => done(b.dataset.id)));
  modal.querySelector(".founder-keep").addEventListener("click", () => done(null));
}
