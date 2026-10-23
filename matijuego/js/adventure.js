// Aventura "Preparar el gran festival del Pueblo": 3 capítulos con vecinos, elecciones y transformaciones del Pueblo.
//
// Todo el avance vive en progress.adventure (versionado). NO va en progress.town, que se borra cada día.
// Este módulo es lógica pura (sin DOM ni three.js) para poder probarlo en Node (scripts/qa/aventura-logica.mjs).
// Los premios se devuelven a quien llama para que los pague con las funciones de siempre (Matipuntos y XP):
// aquí solo se marca que ya se cobraron, así reabrir la app o repetir una acción nunca los paga dos veces.
// Ver docs/EVOLUCION-JUGABILIDAD.md.

export const ADVENTURE_VERSION = 1;

/** Estilos que se eligen en cada capítulo (se ven en el Pueblo). */
export const CHOICES = {
  plaza: {
    title: "¿Cómo quieres el rincón de la plaza?",
    options: [
      { id: "jardin", icon: "🌷", name: "Jardín de cacao", text: "Flores, arbustos y una banca entre plantas de cacao." },
      { id: "guirnaldas", icon: "🎏", name: "Guirnaldas de colores", text: "Banderines, faroles y una banca pintada." },
      { id: "lectura", icon: "📚", name: "Rincón de lectura", text: "Una alfombra, cojines, un estante con cuentos y una lámpara." },
    ],
  },
  cancha: {
    title: "¿De qué color será tu equipo de la pichanga?",
    options: [
      { id: "rosa", icon: "🩷", name: "Rosado Matichoc", text: "Camisetas y banderines rosados.", color: 0xd4216c },
      { id: "celeste", icon: "🩵", name: "Celeste cielo", text: "Camisetas y banderines celestes.", color: 0x3bb4f2 },
      { id: "verde", icon: "💚", name: "Verde menta", text: "Camisetas y banderines verde menta.", color: 0x2fbf86 },
    ],
  },
  aro: {
    title: "¿Cómo será la cancha de básquet?",
    options: [
      { id: "clasico", icon: "🧡", name: "Clásica naranja", text: "Tablero blanco, aro naranja y piso de madera.", color: 0xff7a1a },
      { id: "dorado", icon: "💛", name: "Dorada Matichoc", text: "Aro dorado y piso color chocolate.", color: 0xffc800 },
      { id: "arcoiris", icon: "🌈", name: "Arcoíris", text: "Líneas de colores y aro morado.", color: 0x9a5cff },
    ],
  },
};

// Juegos que sirven para conseguir materiales: cualquiera que esté libre en un perfil nuevo (nunca uno bloqueado).
const ANY_FREE = ["memoria", "merge", "tetris", "salto", "recolecta", "parkour", "porristas", "basquet_tiros", "autos", "pichanga", "basquet2v2"];

/**
 * Capítulos. Cada paso: talk (hablar con el vecino), choose (elegir un estilo), play (terminar una partida de alguno de
 * los juegos de la lista, gane o pierda) o finish (cerrar el capítulo con el vecino o en la fuente).
 */
export const CHAPTERS = [
  {
    id: "c1", n: 1, title: "Un rincón de la plaza", npc: "Bombi", place: "plaza", icon: "🌷",
    need: "El rincón junto a la fuente está descuidado. Bombi quiere que vuelva a ser lindo para el festival.",
    ask: "¡Hola! ¿Ves ese rincón junto a la fuente? Está todo descuidado y quiero que quede lindo para el festival.",
    reward: { coins: 60, xp: 60 },
    steps: [
      { id: "c1.hablar", kind: "talk", text: "Habla con Bombi en la plaza del Pueblo" },
      { id: "c1.materiales", kind: "play", games: ANY_FREE, text: "Consigue materiales: termina una partida de cualquier juego (por ejemplo Memoria, Mati Merge o Salto Choco)" },
      { id: "c1.estilo", kind: "choose", choice: "plaza", text: "Elige cómo quedará el rincón" },
      { id: "c1.inaugurar", kind: "finish", text: "Vuelve con Bombi para inaugurar el rincón" },
    ],
  },
  {
    id: "c2", n: 2, title: "La cancha de la pichanga", npc: "Capi Menta", place: "cancha", icon: "⚽",
    need: "La cancha del Pueblo está llena de pasto y sin arcos. Capi Menta quiere organizar una pichanga para el festival.",
    ask: "¡Hola, crack! La cancha del Pueblo está llena de pasto y sin arcos. Quiero organizar una pichanga para el festival.",
    reward: { coins: 80, xp: 80 },
    steps: [
      { id: "c2.hablar", kind: "talk", text: "Habla con Capi Menta en la cancha del Pueblo" },
      { id: "c2.colores", kind: "choose", choice: "cancha", text: "Elige los colores de tu equipo" },
      { id: "c2.pichanga", kind: "play", games: ["pichanga", "futbol", "recolecta", "parkour"], text: "Juega la pichanga en la cancha (gane o pierda). También sirve una partida de Recolecta y Corre o de Parkour" },
      { id: "c2.contar", kind: "finish", text: "Vuelve con Capi Menta y cuéntale cómo te fue" },
    ],
  },
  {
    id: "c3", n: 3, title: "El aro y el gran festival", npc: "Don Cuchufli", place: "aro", icon: "🏀",
    need: "Falta un lugar para jugar básquet. Don Cuchufli quiere armar una media cancha para que el festival esté completo.",
    ask: "¡Buenas! Al festival le falta un lugar para jugar básquet. Armemos una media cancha aquí mismo.",
    reward: { coins: 120, xp: 120 },
    steps: [
      { id: "c3.hablar", kind: "talk", text: "Habla con Don Cuchufli junto al terreno de básquet" },
      { id: "c3.estilo", kind: "choose", choice: "aro", text: "Elige cómo será la cancha de básquet" },
      { id: "c3.basquet", kind: "play", games: ["basquet2v2", "basquet_tiros", "porristas"], text: "Juega básquet: un partido 2 contra 2 en el aro del Pueblo o el concurso de lanzamientos (o Saltos de Porristas)" },
      { id: "c3.festival", kind: "finish", text: "Ve a la fuente de la plaza y celebra el gran festival" },
    ],
  },
];

export const ALL_STEPS = CHAPTERS.flatMap((c) => c.steps.map((s) => ({ ...s, chapter: c })));
const STEP_IDS = new Set(ALL_STEPS.map((s) => s.id));
const choiceIds = (key) => new Set(CHOICES[key].options.map((o) => o.id));

/** Metas personales que se pueden elegir (se ven en el menú). */
export const GOALS = [
  { id: "festival", icon: "🎪", text: "Terminar el gran festival del Pueblo" },
  { id: "copa_pichanga", icon: "🏆", text: "Ganar la copa de la Pichanga Choco" },
  { id: "copa_basquet", icon: "🏆", text: "Ganar la copa de Básquet 2 contra 2" },
  { id: "casa", icon: "🏠", text: "Decorar Mi Casa con 5 muebles" },
];

export function defaultAdventure() {
  return { v: ADVENTURE_VERSION, started: false, steps: {}, choices: {}, claimed: [], medals: [], goal: null, lastSeen: 0, seenSummaryAt: 0 };
}

/**
 * Migración y reparación (idempotente): acepta cualquier cosa (nada, datos viejos o rotos) y devuelve un estado válido sin
 * perder lo que sí está bien. Aplicarla dos veces da lo mismo.
 */
export function normalizeAdventure(raw) {
  const a = defaultAdventure();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return a;
  a.started = !!raw.started;
  if (raw.steps && typeof raw.steps === "object") {
    for (const [id, v] of Object.entries(raw.steps)) if (STEP_IDS.has(id) && v) a.steps[id] = 1;
  }
  if (raw.choices && typeof raw.choices === "object") {
    for (const key of Object.keys(CHOICES)) if (choiceIds(key).has(raw.choices[key])) a.choices[key] = raw.choices[key];
  }
  // un paso de elegir no puede estar hecho sin su elección (datos rotos): se vuelve a pedir
  for (const s of ALL_STEPS) if (s.kind === "choose" && a.steps[s.id] && !a.choices[s.choice]) delete a.steps[s.id];
  // los pasos van en orden: si falta uno, los de después no cuentan (evita saltarse capítulos por datos rotos)
  let gap = false;
  for (const s of ALL_STEPS) {
    if (gap) delete a.steps[s.id];
    else if (!a.steps[s.id]) gap = true;
  }
  if (Object.keys(a.steps).length) a.started = true;
  a.claimed = Array.isArray(raw.claimed) ? [...new Set(raw.claimed.filter((x) => typeof x === "string").slice(0, 200))] : [];
  a.medals = Array.isArray(raw.medals) ? [...new Set(raw.medals.filter((x) => typeof x === "string").slice(0, 50))] : [];
  a.goal = GOALS.some((g) => g.id === raw.goal) ? raw.goal : null;
  a.lastSeen = Number.isFinite(raw.lastSeen) && raw.lastSeen > 0 ? raw.lastSeen : 0;
  a.seenSummaryAt = Number.isFinite(raw.seenSummaryAt) && raw.seenSummaryAt > 0 ? raw.seenSummaryAt : 0;
  return a;
}

export function adventureOf(progress) {
  if (!progress.adventure || progress.adventure.v !== ADVENTURE_VERSION) progress.adventure = normalizeAdventure(progress.adventure);
  return progress.adventure;
}

/** El primer paso sin hacer (o null si la aventura está terminada). */
export function currentStep(progress) {
  const a = adventureOf(progress);
  return ALL_STEPS.find((s) => !a.steps[s.id]) || null;
}

export const chapterDone = (progress, id) => {
  const ch = CHAPTERS.find((c) => c.id === id);
  const a = adventureOf(progress);
  return !!ch && ch.steps.every((s) => a.steps[s.id]);
};
export const chaptersDone = (progress) => CHAPTERS.filter((c) => chapterDone(progress, c.id)).length;
export const adventureComplete = (progress) => chaptersDone(progress) === CHAPTERS.length;
export const choiceOf = (progress, key) => adventureOf(progress).choices[key] || null;
export const choiceOption = (key, id) => CHOICES[key].options.find((o) => o.id === id) || null;

/** ¿Ya se ve en el Pueblo lo de este lugar? (se elige el estilo y queda puesto para siempre). */
export function placeBuilt(progress, place) {
  const key = { plaza: "plaza", cancha: "cancha", aro: "aro" }[place];
  return !!choiceOf(progress, key);
}

/** ¿Ya se puede jugar en la cancha / el aro del Pueblo? (desde que el vecino te contó su pedido). */
export function placeOpen(progress, place) {
  const a = adventureOf(progress);
  if (place === "cancha") return !!a.steps["c2.hablar"];
  if (place === "aro") return !!a.steps["c3.hablar"];
  return true;
}

function complete(a, id) {
  if (a.steps[id]) return false;
  a.steps[id] = 1;
  a.started = true;
  return true;
}

/** Paga (una sola vez) el premio del capítulo. Devuelve el premio a pagar o null si ya se cobró. */
function claimChapter(a, ch) {
  const key = `chapter:${ch.id}`;
  if (a.claimed.includes(key)) return null;
  a.claimed.push(key);
  return { ...ch.reward, chapter: ch.id };
}

export function startAdventure(progress) {
  const a = adventureOf(progress);
  a.started = true;
  return a;
}

/**
 * Se terminó una partida de un juego (gane o pierda). Si el paso actual es de jugar y el juego es una de sus alternativas,
 * se completa. Devuelve el paso completado o null.
 */
export function onGamePlayed(progress, gameId) {
  const s = currentStep(progress);
  if (!s || s.kind !== "play" || !s.games.includes(gameId)) return null;
  const a = adventureOf(progress);
  return complete(a, s.id) ? s : null;
}

/** Elige (o cambia después) un estilo. Si era el paso actual, lo completa. */
export function choose(progress, key, optionId) {
  if (!CHOICES[key] || !choiceOption(key, optionId)) return { ok: false };
  const a = adventureOf(progress);
  // solo se puede elegir el estilo de un lugar cuando ya llegaste a ese paso (o después, para cambiarlo)
  const step = ALL_STEPS.find((s) => s.kind === "choose" && s.choice === key);
  const cur = currentStep(progress);
  const reached = !!a.steps[step.id] || (cur && cur.id === step.id);
  if (!reached) return { ok: false };
  a.choices[key] = optionId;
  const advanced = complete(a, step.id);
  return { ok: true, advanced, step };
}

const lineFor = (ch, progress) => {
  const c = (key) => choiceOption(key, choiceOf(progress, key));
  if (ch.id === "c1") { const o = c("plaza"); return `¡El rincón con ${o ? o.name.toLowerCase() : "tu estilo"} quedó precioso! Vengo todas las tardes a sentarme ahí.`; }
  if (ch.id === "c2") { const o = c("cancha"); return `¡Qué buena quedó la cancha ${o ? `con los colores ${o.name.toLowerCase()}` : ""}! Cuando quieras jugamos otra pichanga.`; }
  const o = c("aro");
  return `¡La cancha ${o ? o.name.toLowerCase() : "nueva"} es lo mejor del festival! Ven a jugar un 2 contra 2 cuando quieras.`;
};

/**
 * Lo que dice un vecino de la aventura cuando le hablas, según el avance. También aplica lo que corresponda
 * (completar "hablar" o cerrar el capítulo). Devuelve null si ese vecino no es de la aventura (dice lo de siempre).
 *   { text, action?: "choose" | "celebrate", choice?, reward?, step? }
 * `season` (opcional): el evento de temporada activo, para agregar una frase.
 */
export function talkTo(progress, npcName, season = null) {
  const ch = CHAPTERS.find((c) => c.npc === npcName);
  if (!ch) return null;
  const a = adventureOf(progress);
  const cur = currentStep(progress);
  const extra = season ? ` ¡Y con ${season.name} ${season.icon} el pueblo está precioso!` : "";
  if (chapterDone(progress, ch.id)) return { text: lineFor(ch, progress) + extra, memory: true };
  if (!cur || cur.chapter.id !== ch.id) {
    // todavía no llega su capítulo
    const prev = CHAPTERS[ch.n - 2];
    return { text: `Hola. Tengo un pedido para el festival, pero primero ayuda a ${prev.npc}: ${prev.title.toLowerCase()}.`, waiting: true };
  }
  if (cur.kind === "talk") {
    complete(a, cur.id);
    const next = currentStep(progress);
    return { text: `${ch.ask} ¿Me ayudas? Primero: ${next.text.charAt(0).toLowerCase()}${next.text.slice(1)}.`, step: cur, action: next.kind === "choose" ? "choose" : null, choice: next.choice, play: next.kind === "play" ? next.games : null };
  }
  if (cur.kind === "choose") return { text: `${CHOICES[cur.choice].title} Elige el que más te guste.`, action: "choose", choice: cur.choice };
  if (cur.kind === "play") return { text: `Para seguir: ${cur.text.charAt(0).toLowerCase()}${cur.text.slice(1)}. ¡Aquí te espero!`, play: cur.games };
  if (cur.kind === "finish" && ch.id !== "c3") return finishChapter(progress, ch);
  if (cur.kind === "finish") return { text: "¡Todo listo! Ve a la fuente de la plaza y celebremos el gran festival 🎉" };
  return null;
}

/** Cierra un capítulo (con el vecino o, el último, en la fuente). Idempotente: el premio sale una sola vez. */
export function finishChapter(progress, ch) {
  const a = adventureOf(progress);
  const cur = currentStep(progress);
  if (!cur || cur.chapter.id !== ch.id || cur.kind !== "finish") return null;
  complete(a, cur.id);
  const reward = claimChapter(a, ch);
  const next = currentStep(progress);
  const lines = {
    c1: "¡Lo logramos! El rincón de la plaza quedó listo para el festival.",
    c2: "¡Qué pichanga! La cancha quedó lista y ahora todo el pueblo quiere jugar.",
    c3: "🎉 ¡Comenzó el gran festival del Pueblo! Todos los vecinos vinieron a celebrar.",
  };
  const after = next ? ` Lo siguiente: ${next.text.charAt(0).toLowerCase()}${next.text.slice(1)}.` : " Ya puedes jugar en la cancha y en el aro del Pueblo cuando quieras.";
  return { text: lines[ch.id] + after, action: "celebrate", reward, step: cur, chapter: ch };
}

/** La fuente de la plaza: cierra el capítulo 3 si toca. */
export function celebrateAtFountain(progress) {
  const cur = currentStep(progress);
  if (!cur || cur.id !== "c3.festival") return null;
  return finishChapter(progress, CHAPTERS[2]);
}

/** El vecino que necesita que vayas a hablarle ahora (para el "❗" en el Pueblo), o null. */
export function npcWaiting(progress) {
  const cur = currentStep(progress);
  if (!cur) return null;
  if (cur.kind === "talk" || cur.kind === "choose" || (cur.kind === "finish" && cur.id !== "c3.festival")) return cur.chapter.npc;
  return null;
}

/** El objetivo actual explicado en una línea, y adónde ir. */
export function objective(progress) {
  const cur = currentStep(progress);
  if (!cur) return { done: true, text: "¡Terminaste el gran festival! La cancha y el aro del Pueblo quedan abiertos para jugar." };
  return { done: false, step: cur, chapter: cur.chapter, text: cur.text, where: cur.kind === "play" ? "play" : cur.kind === "choose" ? "choose" : "town" };
}

// ---------- volver después de un rato ----------

const AWAY_MS = 3 * 3600e3; // si pasaron más de 3 horas desde la última vez, se muestra el resumen

/** Resumen corto al volver (o null si no corresponde). Marca la visita. */
export function returnSummary(progress, now = Date.now()) {
  const a = adventureOf(progress);
  const last = a.lastSeen;
  a.lastSeen = now;
  if (!a.started || !last || now - last < AWAY_MS) return null;
  const done = chaptersDone(progress);
  const obj = objective(progress);
  const head = done === CHAPTERS.length ? "¡Bienvenida/o de vuelta! El festival ya está armado." : `¡Hola otra vez! Llevas ${done} de ${CHAPTERS.length} capítulos del festival.`;
  return { text: `${head} ${obj.done ? obj.text : `Lo que sigue: ${obj.text}.`}`, done, objective: obj };
}

// ---------- meta personal ----------

export function setGoal(progress, id) {
  const a = adventureOf(progress);
  a.goal = GOALS.some((g) => g.id === id) ? id : null;
  return a.goal;
}

/** Estado de la meta elegida. `m` trae lo que este módulo no sabe: { furniture, cups: { pichanga, basquet2v2 } }. */
export function goalStatus(progress, m = {}) {
  const a = adventureOf(progress);
  const g = GOALS.find((x) => x.id === a.goal);
  if (!g) return null;
  let have = 0;
  let need = 1;
  if (g.id === "festival") { have = chaptersDone(progress); need = CHAPTERS.length; }
  else if (g.id === "copa_pichanga") { have = (m.cups && m.cups.pichanga) ? 1 : 0; }
  else if (g.id === "copa_basquet") { have = (m.cups && m.cups.basquet2v2) ? 1 : 0; }
  else if (g.id === "casa") { have = Math.min(5, m.furniture || 0); need = 5; }
  return { ...g, have, need, done: have >= need };
}

// ---------- temporadas: reto opcional ----------

/** Reto opcional de la temporada activa (o null). Se cobra una vez por evento y por año. */
export function seasonalChallenge(progress, event, now = new Date()) {
  if (!event) return null;
  const a = adventureOf(progress);
  const key = `season:${event.id}:${now.getFullYear()}`;
  return {
    key, event, tokens: 15, games: ["pichanga", "basquet2v2", "futbol", "basquet_tiros"],
    text: `Reto de ${event.name} ${event.icon}: juega un partido de Pichanga, de Básquet 2 contra 2 o una partida de lanzamientos o fútbol.`,
    done: a.claimed.includes(key),
  };
}

/** Si la partida cumple el reto de temporada, lo marca y devuelve cuántas fichas dar (o 0). */
export function seasonalOnPlay(progress, event, gameId, now = new Date()) {
  const ch = seasonalChallenge(progress, event, now);
  if (!ch || ch.done || !ch.games.includes(gameId)) return 0;
  adventureOf(progress).claimed.push(ch.key);
  return ch.tokens;
}

/** Medallas (reconocimientos extra, no obligatorios). Devuelve true si es nueva. */
export function addMedal(progress, id) {
  const a = adventureOf(progress);
  if (a.medals.includes(id)) return false;
  a.medals.push(id);
  return true;
}

// ---------- "Ir al Pueblo" desde la pantalla de la aventura ----------
// El menú deja anotado adónde llevarte (plaza, cancha, aro o fuente) y el Pueblo lo usa una vez al abrir.
let townDest = null;
export const setTownDest = (place) => { townDest = place || null; };
export const takeTownDest = () => { const d = townDest; townDest = null; return d; };

/** Dónde ocurre el paso actual en el Pueblo (para la flecha guía y para "Ir al Pueblo"). */
export function stepPlace(progress) {
  const cur = currentStep(progress);
  if (!cur) return null;
  if (cur.id === "c3.festival") return "fuente";
  return cur.chapter.place;
}

/** Lo que comentan los demás vecinos de lo que ya construiste (para que el pueblo se note distinto). */
export function gossip(progress) {
  const lines = [];
  const o = (k) => choiceOption(k, choiceOf(progress, k));
  if (chapterDone(progress, "c1")) lines.push(`¿Viste el rincón de Bombi con ${o("plaza") ? o("plaza").name.toLowerCase() : "su estilo nuevo"}? ¡Quedó precioso gracias a ti!`);
  if (chapterDone(progress, "c2")) lines.push("¡La cancha del Pueblo quedó lista! Cuando quieras jugamos una pichanga ⚽");
  if (chapterDone(progress, "c3")) lines.push("¡Qué gran festival armaste! Ahora el pueblo entero juega básquet en el aro nuevo 🏀");
  return lines;
}
