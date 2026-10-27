// Pantallas de la aventura "Renovar el Pueblo" en el menú: los tres accesos grandes ("Continuar mi aventura", "Jugar
// libremente" y "Mi personaje y mis espacios"), la lista de tareas de la zona (cada una cuesta ⭐, como en los juegos de
// renovar), el cuadro para elegir estilos, la pantalla "Mis lugares y copas", la meta personal, el resumen al volver y el
// pago (una sola vez) de los premios de cada zona.
// La lógica (qué tarea toca, cuántas ⭐ hay, qué se cobró) está en js/adventure.js; aquí solo se muestra y se conecta.

import {
  ZONES, CHOICES, GOALS, adventureOf, currentTask, zoneDone, zoneProgress, objective, doTask, choose, choiceOf, choiceOption,
  placeOpen, setGoal, goalStatus, returnSummary, seasonalChallenge, setTownDest, stepPlace, startAdventure, adventureComplete,
  markIntroSeen, starsOf, taskDone,
} from "./adventure.js?v=c7f11ecb8c";
import { paintNeighbor } from "./neighbors.js?v=c7f11ecb8c";
import { sportOf, cupsWon, cupRival, DIFF_NAMES } from "./sports-progress.js?v=c7f11ecb8c";
import { activeEvent } from "./events.js?v=c7f11ecb8c";
import { GAMES_CATALOG } from "./games-catalog.js?v=c7f11ecb8c";
import { isUnlocked } from "./unlocks.js?v=c7f11ecb8c";
import { earnCoins, saveProgress } from "./storage.js?v=c7f11ecb8c";
import { addXp, onProgressEvent } from "./progression.js?v=c7f11ecb8c";
import * as audio from "./audio.js?v=c7f11ecb8c";

const $ = (id) => document.getElementById(id);
const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const SPORT_NAMES = { pichanga: "⚽ Pichanga 3 contra 3", basquet2v2: "🏀 Básquet 2 contra 2" };
/** Un juego rápido para ganar ⭐ desde cada zona (sirve cualquiera; estos están libres en un perfil nuevo). */
const QUICK = { plaza: "memoria", cancha: "pichanga", aro: "basquet2v2", festival: "porristas", bosque: "recolecta", granja: "merge", lago: "salto" };
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
      const z = ZONES.find((x) => x.id === r.zone);
      ctx.queueToast(`🎉 ¡Zona renovada${z ? `: ${z.title}` : ""}! +${r.coins} 🍫✨ y +${r.xp} XP`);
    }
    saveProgress(p);
    renderPaths();
    if (!screen.classList.contains("hidden")) render();
  });
  window.addEventListener("adventure-choose", (e) => openChoice(e.detail.key));
  onProgressEvent((ev) => {
    if (ev.type === "stars") {
      const p = P();
      const obj = objective(p);
      if (adventureOf(p).introSeen) ctx.queueToast(`⭐ +${ev.stars} para el Pueblo (tienes ${starsOf(p)})${!obj.done && obj.can ? ` · ¡Ya puedes: ${obj.task.text.toLowerCase()}!` : ""}`);
      renderPaths();
    } else if (ev.type === "season") ctx.queueToast(`${ev.event.icon} ¡Reto de ${ev.event.name} cumplido! +${ev.tokens} ${ev.event.token}`);
  });

  // ---------- elegir el estilo de un lugar ----------

  /** Elegir un estilo: para hacer la tarea (`onPick` la hace con la opción) o, después, para cambiarlo gratis. */
  function openChoice(key, onPick = null) {
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
        choiceDlg.classList.add("hidden");
        if (onPick) { onPick(o); return; }
        const r = choose(p, key, o.id);
        if (!r.ok) return;
        saveProgress(p);
        audio.playPurchase();
        ctx.showToast(`${o.icon} Cambiaste a ${o.name}. Mira cómo quedó en el Pueblo.`);
        window.dispatchEvent(new CustomEvent("adventure-changed", { detail: { chose: key } }));
      });
      box.appendChild(b);
    }
    choiceDlg.classList.remove("hidden");
    box.querySelector("button")?.focus();
  }
  $("adv-choice-close").addEventListener("click", () => choiceDlg.classList.add("hidden"));

  // ---------- la lista de tareas de la zona (como en los juegos de renovar) ----------

  const tasksDlg = $("adv-tasks");
  const inTown = () => !$("screen-town").classList.contains("hidden");
  const playQuick = (zone) => {
    const game = QUICK[zone] || "memoria";
    tasksDlg.classList.add("hidden");
    if (inTown()) window.dispatchEvent(new CustomEvent("town-action", { detail: { kind: "game", game } }));
    else ctx.playGame(game);
  };

  /** Hace la tarea: gasta las ⭐, cambia el Pueblo, paga el premio de la zona (una vez) y muestra la escena. */
  function perform(task, option = null) {
    const p = P();
    const res = doTask(p, task.id, option ? option.id : null);
    if (!res.ok) { renderTasks(); return; }
    saveProgress(p);
    tasksDlg.classList.add("hidden");
    audio.playPurchase();
    window.dispatchEvent(new CustomEvent("adventure-changed", { detail: { reward: res.reward || null, task: task.id } }));
    if (inTown()) window.dispatchEvent(new CustomEvent("adventure-task-done", { detail: res }));
    else { ctx.showToast(`${task.icon} ¡${task.text}: listo! ${res.say}`, 4200); goTown(task.zone.place); }
  }

  function renderTasks() {
    const p = P();
    const cur = currentTask(p);
    const zone = cur ? cur.zone : ZONES[ZONES.length - 1];
    const stars = starsOf(p);
    const pr = zoneProgress(p, zone.id);
    $("at-title").textContent = `${zone.icon} Zona ${zone.n}: ${zone.title}`;
    $("at-stars").textContent = String(stars);
    $("at-bar").style.width = `${Math.round((pr.done / pr.total) * 100)}%`;
    const face = $("at-face");
    if (face.dataset.npc !== zone.npc) { face.dataset.npc = zone.npc; paintNeighbor(face, zone.npc); }
    $("at-say").textContent = !cur ? "¡Renovaste el Pueblo entero! Eres la persona más querida de todos." : pr.done === 0 ? zone.intro : `¡Vamos bien! Lo que sigue: ${cur.text.toLowerCase()}.`;
    const list = $("at-list");
    list.innerHTML = "";
    for (const t of zone.tasks) {
      const li = document.createElement("li");
      const done = taskDone(p, t.id);
      const now = cur && cur.id === t.id;
      li.className = `at-task${done ? " done" : now ? " now" : " later"}`;
      li.innerHTML = `<span class="at-ico"></span><span class="at-txt"></span>`;
      li.querySelector(".at-ico").textContent = done ? "✅" : t.icon;
      li.querySelector(".at-txt").textContent = t.text;
      if (now) {
        const can = stars >= t.cost;
        const b = document.createElement("button");
        b.type = "button";
        b.className = `at-go${can ? "" : " short"}`;
        b.innerHTML = `<span>⭐${t.cost}</span>${can ? "¡Hacer!" : `faltan ${t.cost - stars}`}`;
        b.disabled = !can;
        b.addEventListener("click", () => {
          if (!t.choice) { perform(t); return; }
          tasksDlg.classList.add("hidden"); // el cuadro de estilos va encima, no detrás de la lista
          openChoice(t.choice, (o) => perform(t, o));
        });
        li.appendChild(b);
        if (!can) {
          const q = document.createElement("button");
          q.type = "button";
          q.className = "at-play";
          q.textContent = "▶ Jugar";
          q.title = "Juega cualquier juego para ganar ⭐";
          q.addEventListener("click", () => playQuick(zone.id));
          li.appendChild(q);
        }
      } else if (!done) {
        const c = document.createElement("small");
        c.className = "at-cost";
        c.textContent = `⭐${t.cost}`;
        li.appendChild(c);
      }
      list.appendChild(li);
    }
    // el mapa de etapas: las 7 zonas del Pueblo
    const map = $("at-map");
    map.innerHTML = "";
    for (const z of ZONES) {
      const d = zoneDone(p, z.id);
      const on = z.id === zone.id && !d;
      const sp = document.createElement("span");
      sp.className = `at-zone${d ? " done" : on ? " now" : " locked"}`;
      sp.title = z.title;
      sp.textContent = d ? "✓" : on ? z.icon : "🔒";
      map.appendChild(sp);
    }
  }

  function openTasks() {
    const p = P();
    if (!p) return;
    startAdventure(p);
    renderTasks();
    tasksDlg.classList.remove("hidden");
    tasksDlg.querySelector(".at-go:not([disabled]), .at-play, #adv-tasks-close")?.focus();
  }
  window.addEventListener("adventure-tasks", openTasks);
  $("adv-tasks-close").addEventListener("click", () => tasksDlg.classList.add("hidden"));

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
      const npc = obj.done ? null : obj.zone.npc;
      if (!a.introSeen) sub.textContent = "Los vecinos del Pueblo necesitan tu ayuda";
      else if (obj.done) sub.textContent = "¡Renovaste el Pueblo entero! Pasea por sus 7 zonas";
      else {
        const pr = zoneProgress(p, obj.zone.id);
        sub.textContent = `⭐${starsOf(p)} · ${obj.zone.icon} ${obj.zone.title} ${pr.done}/${pr.total} · ${obj.can ? `¡Ya puedes: ${obj.task.text.toLowerCase()}!` : `Siguiente: ${obj.task.text.toLowerCase()} (⭐${obj.task.cost})`}`;
      }
      btn.classList.toggle("lp-pulse", (!a.introSeen || (!obj.done && obj.can)) && !REDUCED);
      // la cara del vecino de la zona, en vez de un ícono
      const ico = btn.querySelector(".lp-ico");
      if (ico.dataset.npc !== (npc || "")) {
        ico.dataset.npc = npc || "";
        ico.innerHTML = "";
        if (npc) { const c = document.createElement("canvas"); c.width = c.height = 96; c.className = "lp-face"; ico.appendChild(c); paintNeighbor(c, npc); }
        else ico.textContent = "🎪";
      }
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

  // "Continuar mi aventura": la primera vez, la viñeta que cuenta de qué se trata; después, directo al vecino que te espera
  const introDlg = $("adv-intro");
  function openIntro() {
    introDlg.querySelectorAll("canvas[data-npc]").forEach((c) => paintNeighbor(c, c.dataset.npc));
    introDlg.classList.remove("hidden");
    $("adv-intro-go").focus();
  }
  $("adv-intro-go").addEventListener("click", () => {
    const p = P();
    markIntroSeen(p);
    saveProgress(p);
    introDlg.classList.add("hidden");
    goTown(stepPlace(p) || "plaza");
  });
  $("adv-intro-close").addEventListener("click", () => introDlg.classList.add("hidden"));
  $("btn-path-adventure").addEventListener("click", () => {
    const p = P();
    if (!ctx.getCharacter()) { ctx.needCharacter(); return; }
    if (!adventureOf(p).introSeen) { openIntro(); return; }
    goTown(stepPlace(p) || "plaza");
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
    const cur = currentTask(p);
    // las zonas (etapas) del Pueblo
    const list = $("adv-chapters");
    list.innerHTML = "";
    for (const z of ZONES) {
      const li = document.createElement("li");
      const done = zoneDone(p, z.id);
      const now = cur && cur.zone.id === z.id;
      const pr = zoneProgress(p, z.id);
      li.className = `adv-ch${done ? " done" : now ? " now" : " later"}`;
      li.innerHTML = `<span class="ac-ico"></span><span class="ac-txt"><b></b><small></small></span>`;
      li.querySelector(".ac-ico").textContent = done ? "✅" : now ? z.icon : "🔒";
      li.querySelector("b").textContent = `${z.n}. ${z.title}`;
      li.querySelector("small").textContent = done ? "¡Renovada!" : now ? `Con ${z.npc} · ${pr.done}/${pr.total}` : "Después";
      list.appendChild(li);
    }
    // lo que toca ahora
    const nowEl = $("adv-now");
    nowEl.innerHTML = "";
    if (!cur) {
      nowEl.appendChild(Object.assign(document.createElement("h2"), { textContent: "🎉 ¡Renovaste el Pueblo entero!" }));
      nowEl.appendChild(Object.assign(document.createElement("p"), { textContent: "Los vecinos recuerdan todo lo que hiciste. Pasea por el bosque, la granja y el lago, y juega en la cancha y el aro cuando quieras." }));
      const row = document.createElement("div");
      row.className = "adv-actions";
      row.append(btn("🏘️ Ir al Pueblo", "btn-primary", () => goTown("plaza")), btn(SPORT_NAMES.pichanga, "btn-secondary", () => ctx.playGame("pichanga")), btn(SPORT_NAMES.basquet2v2, "btn-secondary", () => ctx.playGame("basquet2v2")));
      nowEl.appendChild(row);
    } else {
      const z = cur.zone;
      const h = document.createElement("h2");
      h.textContent = `${z.icon} Zona ${z.n}: ${z.title}`;
      const need = document.createElement("p");
      need.className = "adv-need";
      need.textContent = `${z.npc}: ${z.intro}`;
      const steps = document.createElement("ol");
      steps.className = "adv-steps";
      for (const t of z.tasks) {
        const li = document.createElement("li");
        const done = taskDone(p, t.id);
        li.className = done ? "done" : t.id === cur.id ? "now" : "later";
        li.textContent = `${done ? "✓" : t.id === cur.id ? "▶" : "○"} ${t.icon} ${t.text}${done ? "" : ` · ⭐${t.cost}`}`;
        steps.appendChild(li);
      }
      const row = document.createElement("div");
      row.className = "adv-actions";
      const stars = starsOf(p);
      row.append(btn(stars >= cur.cost ? `🔨 Ir a hacerlo (⭐${cur.cost})` : `🏘️ Ir al Pueblo con ${z.npc}`, "btn-primary", () => goTown(z.place)));
      if (stars < cur.cost) row.append(btn("▶ Jugar para ganar ⭐", "btn-secondary", () => ctx.playGame(QUICK[z.id] || "memoria")));
      const hint = document.createElement("p");
      hint.className = "adv-hint";
      hint.textContent = `Tienes ⭐${stars}. Las ⭐ se ganan jugando cualquier juego (ganes o pierdas), entregando pedidos en Mati Merge y juntando lo de los barrios.`;
      nowEl.append(h, need, steps, row, hint);
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
      else card.appendChild(Object.assign(document.createElement("small"), { className: "adv-lock", textContent: "Se abre al poner los arcos de la cancha del Pueblo" }));
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
      seasonEl.querySelector("p").textContent = ch.done ? `✅ ¡Reto cumplido! Ganaste ${ch.tokens} ${ev.token}. Todo lo que renovaste sigue igual cuando termine la temporada.` : `${ch.text} Premio: ${ch.tokens} ${ev.token}. Es opcional: nada se pierde si no lo haces.`;
    }
  }

  return { renderPaths, showWelcome, open, render, openTasks, isOpen: () => !screen.classList.contains("hidden"), complete: () => adventureComplete(P()) };
}
