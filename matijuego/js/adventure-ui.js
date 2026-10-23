// Pantallas de la aventura en el menú: los tres accesos grandes ("Continuar mi aventura", "Jugar libremente" y
// "Mi personaje y mis espacios"), la pantalla "El gran festival", el cuadro para elegir estilos, la meta personal,
// el resumen al volver y el pago (una sola vez) de los premios de cada capítulo.
// La lógica (qué paso toca, qué se cobró) está en js/adventure.js; aquí solo se muestra y se conecta con el menú.

import {
  CHAPTERS, CHOICES, GOALS, adventureOf, currentStep, chapterDone, objective, choose, choiceOf, choiceOption, placeOpen,
  setGoal, goalStatus, returnSummary, seasonalChallenge, setTownDest, stepPlace, startAdventure, adventureComplete,
} from "./adventure.js?v=a012447234";
import { sportOf, cupsWon, cupRival, DIFF_NAMES } from "./sports-progress.js?v=a012447234";
import { activeEvent } from "./events.js?v=a012447234";
import { GAMES_CATALOG } from "./games-catalog.js?v=a012447234";
import { isUnlocked } from "./unlocks.js?v=a012447234";
import { earnCoins, saveProgress } from "./storage.js?v=a012447234";
import { addXp, onProgressEvent } from "./progression.js?v=a012447234";
import * as audio from "./audio.js?v=a012447234";

const $ = (id) => document.getElementById(id);
const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const SPORT_NAMES = { pichanga: "⚽ Pichanga 3 contra 3", basquet2v2: "🏀 Básquet 2 contra 2" };
const PLAY_ORDER = ["pichanga", "basquet2v2", "memoria", "salto", "basquet_tiros", "merge", "tetris", "recolecta", "parkour", "porristas", "autos", "futbol"];
const PLACE_INFO = {
  plaza: { key: "plaza", icon: "🌷", name: "Rincón de Bombi" },
  cancha: { key: "cancha", icon: "⚽", name: "Cancha del Pueblo" },
  aro: { key: "aro", icon: "🏀", name: "Aro del Pueblo" },
};

/** Cuántos muebles hay puestos en todos los cuartos de Mi Casa (para la meta personal). */
export function furnitureCount(progress) {
  const h = progress.house || {};
  return (h.layout || []).length + Object.values(h.roomData || {}).reduce((a, d) => a + ((d && d.layout) || []).length, 0);
}

export function initAdventureUI(ctx) {
  const P = () => ctx.getProgress();
  const screen = $("screen-adventure");
  const choiceDlg = $("adv-choice");
  const meDlg = $("me-dialog");

  const gameLabel = (id) => {
    if (SPORT_NAMES[id]) return SPORT_NAMES[id];
    const e = GAMES_CATALOG.find((g) => g.id === id);
    return e ? `${e.icon} ${e.name}` : id;
  };
  /** ¿Se puede jugar ya este juego? (los bloqueados nunca se ofrecen como camino de la aventura) */
  const playable = (id) => {
    const p = P();
    if (id === "pichanga") return placeOpen(p, "cancha") || isUnlocked(p, "futbol");
    if (id === "basquet2v2") return true; // está dentro de Lanzamientos de Básquet, que es libre
    const e = GAMES_CATALOG.find((g) => g.id === id);
    return !!e && e.status === "available" && isUnlocked(p, id);
  };

  const goTown = (place) => {
    setTownDest(place);
    ctx.playGame("town");
  };

  // ---------- premios y avisos ----------

  window.addEventListener("adventure-changed", (e) => {
    const p = P();
    if (!p) return;
    const r = e.detail && e.detail.reward;
    if (r) {
      // el premio ya quedó marcado como cobrado en js/adventure.js: se paga aquí, en el mismo instante, y se guarda
      earnCoins(p, r.coins);
      addXp(p, r.xp);
      audio.playVictory();
      ctx.queueToast(`🎉 ¡Capítulo completo! +${r.coins} 🍫✨ y +${r.xp} XP ⭐`);
    }
    saveProgress(p);
    renderPaths();
    if (!screen.classList.contains("hidden")) render();
  });
  window.addEventListener("adventure-choose", (e) => openChoice(e.detail.key));
  onProgressEvent((ev) => {
    if (ev.type === "adventure") {
      const obj = objective(P());
      ctx.queueToast(`🎪 ¡Conseguiste lo que faltaba!${obj.done ? "" : ` Ahora: ${obj.text.toLowerCase()}`}`);
      renderPaths();
    } else if (ev.type === "season") ctx.queueToast(`${ev.event.icon} ¡Reto de ${ev.event.name} cumplido! +${ev.tokens} ${ev.event.token}`);
  });

  // ---------- elegir el estilo de un lugar ----------

  function openChoice(key) {
    const p = P();
    const def = CHOICES[key];
    if (!def) return;
    const current = choiceOf(p, key);
    $("adv-choice-title").textContent = def.title;
    $("adv-choice-icon").textContent = PLACE_INFO[key === "plaza" ? "plaza" : key === "cancha" ? "cancha" : "aro"].icon;
    const box = $("adv-choice-options");
    box.innerHTML = "";
    for (const o of def.options) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `adv-opt${o.id === current ? " on" : ""}`;
      b.innerHTML = `<span class="ao-ico"></span><b></b><small></small>`;
      b.querySelector(".ao-ico").textContent = o.icon;
      b.querySelector("b").textContent = o.name;
      b.querySelector("small").textContent = o.text;
      if (o.color != null) b.style.setProperty("--ao", `#${o.color.toString(16).padStart(6, "0")}`);
      b.addEventListener("click", () => {
        const r = choose(p, key, o.id);
        if (!r.ok) return;
        saveProgress(p);
        choiceDlg.classList.add("hidden");
        audio.playPurchase();
        ctx.showToast(r.advanced ? `${o.icon} ¡${o.name}! Mira cómo quedó en el Pueblo.` : `${o.icon} Cambiaste a ${o.name}.`);
        window.dispatchEvent(new CustomEvent("adventure-changed", { detail: { chose: key } }));
      });
      box.appendChild(b);
    }
    choiceDlg.classList.remove("hidden");
    box.querySelector("button")?.focus();
  }
  $("adv-choice-close").addEventListener("click", () => choiceDlg.classList.add("hidden"));

  // ---------- menú: los tres caminos ----------

  function renderPaths() {
    const p = P();
    if (!p) return;
    const sub = $("lp-adv-sub");
    const btn = $("btn-path-adventure");
    const a = adventureOf(p);
    if (!ctx.getCharacter()) {
      sub.textContent = "Primero elige tu Matichico";
      btn.classList.remove("lp-pulse");
    } else {
      const obj = objective(p);
      sub.textContent = obj.done ? "¡Festival listo! Copas y lugares del Pueblo" : `Capítulo ${obj.chapter.n} de 3 · ${obj.text}`;
      btn.classList.toggle("lp-pulse", !a.started && !REDUCED);
    }
    const g = goalStatus(p, { furniture: furnitureCount(p), cups: { pichanga: cupsWon(p, "pichanga"), basquet2v2: cupsWon(p, "basquet2v2") } });
    const goalEl = $("lb-goal");
    goalEl.classList.toggle("hidden", !g);
    if (g) goalEl.textContent = g.done ? `${g.icon} ¡Meta cumplida: ${g.text.toLowerCase()}! Elige otra en tu aventura.` : `${g.icon} Mi meta: ${g.text} (${g.have}/${g.need})`;
  }

  /** Resumen corto al volver después de un rato (no es un cuadro que tape: una franja que se cierra). */
  function showWelcome() {
    const p = P();
    if (!p) return;
    const s = returnSummary(p);
    saveProgress(p);
    const el = $("lb-welcome");
    if (!s) { el.classList.add("hidden"); return; }
    $("lb-welcome-text").textContent = s.text;
    el.classList.remove("hidden");
  }
  $("lb-welcome-ok").addEventListener("click", () => { $("lb-welcome").classList.add("hidden"); open(); });

  $("btn-path-adventure").addEventListener("click", () => {
    if (!ctx.getCharacter()) { ctx.needCharacter(); return; }
    open();
  });
  $("btn-path-free").addEventListener("click", () => {
    const t = $("game-feature");
    t.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "start" });
    $("lb-games-title").focus({ preventScroll: true });
  });
  $("btn-path-me").addEventListener("click", () => meDlg.classList.remove("hidden"));
  $("me-close").addEventListener("click", () => meDlg.classList.add("hidden"));
  $("me-shop").addEventListener("click", () => { meDlg.classList.add("hidden"); $("btn-open-shop").click(); });
  $("me-house").addEventListener("click", () => { meDlg.classList.add("hidden"); $("btn-open-house").click(); });
  $("me-char").addEventListener("click", () => { meDlg.classList.add("hidden"); ctx.needCharacter(true); });
  $("me-town").addEventListener("click", () => { meDlg.classList.add("hidden"); open("built"); });

  // ---------- pantalla "El gran festival" ----------

  function open(section) {
    const p = P();
    startAdventure(p);
    saveProgress(p);
    ctx.showScreen(screen);
    render();
    renderPaths();
    const target = section === "built" ? $("adv-built") : $("adv-now");
    target.scrollIntoView({ block: "nearest" });
  }
  $("btn-adventure-back").addEventListener("click", () => { ctx.refreshHub(); ctx.showScreen(ctx.screenHub); });

  const btn = (text, cls, onClick) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = cls;
    b.textContent = text;
    b.addEventListener("click", onClick);
    return b;
  };

  function render() {
    const p = P();
    const cur = currentStep(p);
    // capítulos
    const list = $("adv-chapters");
    list.innerHTML = "";
    for (const ch of CHAPTERS) {
      const li = document.createElement("li");
      const done = chapterDone(p, ch.id);
      const now = cur && cur.chapter.id === ch.id;
      li.className = `adv-ch${done ? " done" : now ? " now" : " later"}`;
      li.innerHTML = `<span class="ac-ico"></span><span class="ac-txt"><b></b><small></small></span>`;
      li.querySelector(".ac-ico").textContent = done ? "✅" : ch.icon;
      li.querySelector("b").textContent = `${ch.n}. ${ch.title}`;
      li.querySelector("small").textContent = done ? "¡Terminado!" : now ? `Con ${ch.npc}` : "Después";
      list.appendChild(li);
    }
    // lo que toca ahora
    const nowEl = $("adv-now");
    nowEl.innerHTML = "";
    if (!cur) {
      nowEl.appendChild(Object.assign(document.createElement("h2"), { textContent: "🎉 ¡El gran festival está listo!" }));
      nowEl.appendChild(Object.assign(document.createElement("p"), { textContent: "Los vecinos recuerdan todo lo que hiciste. La cancha y el aro del Pueblo quedan abiertos: juega partidos y copas cuando quieras." }));
      const row = document.createElement("div");
      row.className = "adv-actions";
      row.append(btn("🏘️ Ir al Pueblo", "btn-primary", () => goTown("fuente")), btn(SPORT_NAMES.pichanga, "btn-secondary", () => ctx.playGame("pichanga")), btn(SPORT_NAMES.basquet2v2, "btn-secondary", () => ctx.playGame("basquet2v2")));
      nowEl.appendChild(row);
    } else {
      const ch = cur.chapter;
      const h = document.createElement("h2");
      h.textContent = `${ch.icon} Capítulo ${ch.n}: ${ch.title}`;
      const need = document.createElement("p");
      need.className = "adv-need";
      need.textContent = ch.need;
      const steps = document.createElement("ol");
      steps.className = "adv-steps";
      for (const s of ch.steps) {
        const li = document.createElement("li");
        const done = !!adventureOf(p).steps[s.id];
        li.className = done ? "done" : s.id === cur.id ? "now" : "later";
        li.textContent = `${done ? "✓" : s.id === cur.id ? "▶" : "○"} ${s.text}`;
        steps.appendChild(li);
      }
      const row = document.createElement("div");
      row.className = "adv-actions";
      const place = stepPlace(p);
      if (cur.kind === "choose") {
        row.append(btn("🎨 Elegir el estilo", "btn-primary", () => openChoice(cur.choice)), btn(`🏘️ Ir con ${ch.npc}`, "btn-secondary", () => goTown(place)));
      } else if (cur.kind === "play") {
        const games = PLAY_ORDER.filter((g) => cur.games.includes(g) && playable(g)).slice(0, 4);
        games.forEach((g, i) => row.appendChild(btn(`▶ ${gameLabel(g)}`, i ? "btn-secondary" : "btn-primary", () => ctx.playGame(g))));
        const hint = document.createElement("p");
        hint.className = "adv-hint";
        hint.textContent = "Sirve cualquier resultado: lo importante es jugar la partida hasta el final.";
        nowEl.append(h, need, steps, row, hint);
        renderRest(p);
        return;
      } else if (place === "fuente") {
        row.appendChild(btn("🎉 Ir a la fuente a celebrar", "btn-primary", () => goTown("fuente")));
      } else {
        row.appendChild(btn(`🏘️ Ir al Pueblo con ${ch.npc}`, "btn-primary", () => goTown(place)));
      }
      nowEl.append(h, need, steps, row);
    }
    renderRest(p);
  }

  function renderRest(p) {
    // lugares construidos
    const built = $("adv-built");
    built.innerHTML = "";
    for (const id of ["plaza", "cancha", "aro"]) {
      const info = PLACE_INFO[id];
      const style = choiceOption(info.key, choiceOf(p, info.key));
      const card = document.createElement("div");
      card.className = `adv-place${style ? "" : " off"}`;
      const t = document.createElement("span");
      t.innerHTML = "<b></b><small></small>";
      t.querySelector("b").textContent = `${info.icon} ${info.name}`;
      t.querySelector("small").textContent = style ? `${style.icon} ${style.name}` : "Todavía sin arreglar";
      card.appendChild(t);
      if (style) card.appendChild(btn("🎨 Cambiar estilo", "btn-tiny", () => openChoice(info.key)));
      built.appendChild(card);
    }
    // deportes
    const sp = $("adv-sports");
    sp.innerHTML = "";
    for (const id of ["pichanga", "basquet2v2"]) {
      const s = sportOf(p, id);
      const rival = cupRival(p, id);
      const card = document.createElement("div");
      card.className = "adv-sport";
      const t = document.createElement("span");
      t.innerHTML = "<b></b><small></small><small class='adv-cups'></small>";
      t.querySelector("b").textContent = SPORT_NAMES[id];
      t.querySelector("small").textContent = `Partidos: ${s.played} · Ganados: ${s.wins} · Copa: ${rival.roundName} contra ${rival.name}`;
      const cups = Object.entries(s.cups).filter(([, n]) => n > 0).map(([d, n]) => `🏆 ${DIFF_NAMES[d]} x${n}`).join("  ");
      t.querySelector(".adv-cups").textContent = cups || "Todavía sin copas";
      card.appendChild(t);
      if (playable(id)) card.appendChild(btn("▶ Jugar", "btn-primary btn-small", () => ctx.playGame(id)));
      else card.appendChild(Object.assign(document.createElement("small"), { className: "adv-lock", textContent: "Se abre en el capítulo 2 (cancha del Pueblo)" }));
      sp.appendChild(card);
    }
    const medals = adventureOf(p).medals;
    if (medals.length) {
      const m = document.createElement("p");
      m.className = "adv-medals";
      m.textContent = `🏅 Medallas: ${medals.map((x) => ({ pichanga_desafio: "Copa Pichanga en Desafío", basquet2v2_desafio: "Copa de Básquet en Desafío" }[x] || x)).join(" · ")}`;
      sp.appendChild(m);
    }
    // meta personal
    const goals = $("adv-goals");
    goals.innerHTML = "";
    const st = goalStatus(p, { furniture: furnitureCount(p), cups: { pichanga: cupsWon(p, "pichanga"), basquet2v2: cupsWon(p, "basquet2v2") } });
    const intro = document.createElement("p");
    intro.className = "adv-hint";
    intro.textContent = st ? (st.done ? `${st.icon} ¡Cumpliste tu meta! Puedes elegir otra.` : `${st.icon} Vas ${st.have} de ${st.need}. La verás en el menú.`) : "Elige una meta propia (si quieres): la verás en el menú.";
    goals.appendChild(intro);
    const cur = adventureOf(p).goal;
    for (const g of GOALS) {
      const b = btn(`${g.icon} ${g.text}`, `adv-goal${cur === g.id ? " on" : ""}`, () => {
        setGoal(p, cur === g.id ? null : g.id);
        saveProgress(p);
        renderRest(p);
        renderPaths();
      });
      b.setAttribute("aria-pressed", String(cur === g.id));
      goals.appendChild(b);
    }
    // temporada
    const seasonEl = $("adv-season");
    const ev = activeEvent();
    const ch = seasonalChallenge(p, ev);
    seasonEl.classList.toggle("hidden", !ch);
    if (ch) {
      seasonEl.innerHTML = "<h2></h2><p></p>";
      seasonEl.querySelector("h2").textContent = `${ev.icon} ${ev.name} (opcional)`;
      seasonEl.querySelector("p").textContent = ch.done ? `✅ ¡Reto cumplido! Ganaste ${ch.tokens} ${ev.token}. El festival y todo tu avance siguen igual cuando termine la temporada.` : `${ch.text} Premio: ${ch.tokens} ${ev.token}. Es opcional: nada se pierde si no lo haces.`;
    }
  }

  return { renderPaths, showWelcome, open, render, isOpen: () => !screen.classList.contains("hidden"), complete: () => adventureComplete(P()) };
}
