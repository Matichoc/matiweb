// Aventura "Renovar el Pueblo Matichoc" (al estilo de los juegos de renovar con historia, como Gossip Harbor):
// el Pueblo tiene 7 zonas (la plaza, la cancha, el aro, el festival y, más allá de la cerca, el bosque de cacao, la granja
// y el lago). Cada zona tiene una lista de tareas que cuestan ⭐; las ⭐ se ganan jugando CUALQUIER juego. Cada tarea
// cambia el Pueblo en 3D y su vecino cuenta un pedacito de la historia. Al completar una zona hay premio y se abre la
// siguiente. La historia avanza y no se reinicia (los encargos diarios están en otro lado: misiones, Ciudad, Merge).
//
// Todo el avance vive en progress.adventure (versionado). NO va en progress.town, que se borra cada día.
// Este módulo es lógica pura (sin DOM ni three.js) para poder probarlo en Node (scripts/qa/aventura-logica.mjs).
// Los premios se devuelven a quien llama para que los pague con las funciones de siempre (Matipuntos y XP):
// aquí solo se marca que ya se cobraron, así reabrir la app o repetir una acción nunca los paga dos veces.
// Ver docs/EVOLUCION-JUGABILIDAD.md.

export const ADVENTURE_VERSION = 2;

/** Estilos que se eligen en algunas tareas (se ven en el Pueblo y se pueden cambiar después). */
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

/** ⭐ que da terminar una partida (gane o pierda). Los partidos largos dan más. */
export const STARS_PER_GAME = { pichanga: 2, basquet2v2: 2, ciudad: 2, aventura: 2 };
export const starsFor = (gameId) => (gameId === "town" ? 0 : STARS_PER_GAME[gameId] || 1); // pasear por el Pueblo no es una partida

/**
 * Las zonas, en orden. Cada tarea: id, icono, texto (lo que se hace), costo en ⭐, `say` (lo que cuenta el vecino al
 * terminarla: un pedacito de la historia) y, si corresponde, `choice` (se elige un estilo) u `opens` (abre un juego).
 */
export const ZONES = [
  {
    id: "plaza", n: 1, title: "La Plaza", npc: "Bombi", place: "plaza", icon: "🌷", reward: { coins: 60, xp: 60 },
    intro: "¡Hola! Se viene el gran festival y el rincón de la plaza está todo descuidado. ¿Me ayudas a dejarlo lindo?",
    tasks: [
      { id: "plaza.limpiar", icon: "🧹", cost: 1, text: "Sacar la maleza del rincón", say: "¡Ya se ve el piso! Ahora falta decidir cómo lo decoramos…" },
      { id: "plaza.estilo", icon: "🎨", cost: 2, choice: "plaza", text: "Elegir cómo decorar el rincón", say: "¡Me encanta! Pero la banca sigue rota y nadie se puede sentar." },
      { id: "plaza.banca", icon: "🪑", cost: 2, text: "Arreglar la banca", say: "¡Qué cómoda! Dicen que de noche este rincón queda muy oscuro…" },
      { id: "plaza.faroles", icon: "🏮", cost: 3, text: "Colgar faroles de colores", say: "¡Quedó precioso! Capi Menta anda preguntando por ti: quiere arreglar la cancha." },
    ],
  },
  {
    id: "cancha", n: 2, title: "La Cancha", npc: "Capi Menta", place: "cancha", icon: "⚽", reward: { coins: 80, xp: 80 },
    intro: "¡Hola, crack! La cancha está llena de pasto y sin arcos. Para el festival quiero organizar una pichanga.",
    tasks: [
      { id: "cancha.pasto", icon: "🌿", cost: 2, text: "Cortar el pasto de la cancha", say: "¡Ahora sí se ve la cancha! Hay que pintar las líneas." },
      { id: "cancha.colores", icon: "🎨", cost: 2, choice: "cancha", text: "Elegir los colores del equipo", say: "¡Qué buenos colores! Ahora faltan los arcos." },
      { id: "cancha.arcos", icon: "🥅", cost: 3, opens: "pichanga", text: "Poner los arcos", say: "¡La cancha está lista! Ya se puede jugar una pichanga aquí mismo." },
      { id: "cancha.galeria", icon: "🎪", cost: 3, text: "Armar las graderías", say: "¡Ahora el pueblo entero puede ver los partidos! Don Cuchufli quiere un aro de básquet…" },
    ],
  },
  {
    id: "aro", n: 3, title: "El Aro", npc: "Don Cuchufli", place: "aro", icon: "🏀", reward: { coins: 100, xp: 100 },
    intro: "¡Buenas! Al festival le falta un lugar para jugar básquet. Ese terreno abandonado sería perfecto.",
    tasks: [
      { id: "aro.piso", icon: "🧱", cost: 2, text: "Emparejar el terreno", say: "¡Qué parejito quedó! ¿De qué color lo pintamos?" },
      { id: "aro.estilo", icon: "🎨", cost: 2, choice: "aro", text: "Elegir cómo pintar la cancha", say: "¡Bonito! Falta lo más importante: el aro." },
      { id: "aro.aro", icon: "🏀", cost: 3, opens: "basquet2v2", text: "Poner el aro y el tablero", say: "¡A jugar! Ya se puede jugar básquet 2 contra 2 aquí." },
      { id: "aro.focos", icon: "💡", cost: 3, text: "Poner focos para jugar de noche", say: "¡Perfecto! Mati Cacao dice que ya casi podemos empezar el festival…" },
    ],
  },
  {
    id: "festival", n: 4, title: "El gran festival", npc: "Mati Cacao", place: "fuente", icon: "🎉", reward: { coins: 150, xp: 150 },
    intro: "¡Todo el pueblo está quedando precioso gracias a ti! Preparemos el gran festival alrededor de la fuente.",
    tasks: [
      { id: "festival.banderines", icon: "🎏", cost: 2, text: "Colgar banderines en la plaza", say: "¡Qué colorido! Pero falta un escenario para la música." },
      { id: "festival.escenario", icon: "🎤", cost: 3, text: "Armar el escenario", say: "¡Qué escenario más lindo! ¿Y si ponemos globos?" },
      { id: "festival.globos", icon: "🎈", cost: 3, text: "Inflar los globos", say: "¡Está todo listo! Solo falta inaugurarlo…" },
      { id: "festival.inaugurar", icon: "🎉", cost: 4, text: "¡Inaugurar el gran festival!", say: "🎉 ¡Comenzó el gran festival! Oye… dicen que más allá de la cerca hay un bosque de cacao abandonado." },
    ],
  },
  {
    id: "bosque", n: 5, title: "El Bosque de cacao", npc: "Guardabosque Maní", place: "bosque", icon: "🌳", reward: { coins: 180, xp: 180 },
    intro: "¡Hola! Soy el guardabosque. Este bosque de cacao era precioso, pero el sendero se tapó y el puente se cayó.",
    tasks: [
      { id: "bosque.sendero", icon: "🪵", cost: 3, text: "Despejar el sendero", say: "¡Ya se puede pasear! Al fondo está el arroyo, pero sin puente no se cruza." },
      { id: "bosque.puente", icon: "🌉", cost: 4, text: "Construir el puente", say: "¡Qué buen puente! Siempre soñé con una casita en el árbol grande…" },
      { id: "bosque.casita", icon: "🏡", cost: 5, text: "Construir la casita del árbol", say: "¡Es la mejor casita del mundo! De noche el bosque queda muy oscuro…" },
      { id: "bosque.luces", icon: "✨", cost: 4, text: "Colgar luces en el bosque", say: "¡Mágico! Tía Avellana, de la granja, necesita ayuda con su granero." },
    ],
  },
  {
    id: "granja", n: 6, title: "La Granja", npc: "Tía Avellana", place: "granja", icon: "🐄", reward: { coins: 200, xp: 200 },
    intro: "¡Hola, mi niña, mi niño! Mi granja está muy descuidada: el granero tiene goteras y el molino no gira.",
    tasks: [
      { id: "granja.granero", icon: "🛖", cost: 4, text: "Arreglar el granero", say: "¡Ya no entra agua! Las vacas están felices. ¿Y el molino?" },
      { id: "granja.molino", icon: "🌬️", cost: 4, text: "Hacer girar el molino", say: "¡Gira otra vez! Con harina podemos plantar el huerto…" },
      { id: "granja.huerto", icon: "🥕", cost: 5, text: "Plantar el huerto", say: "¡Qué ricas verduras! Solo falta un corral nuevo para los animales." },
      { id: "granja.corral", icon: "🐑", cost: 5, text: "Construir el corral", say: "¡Gracias! El Capitán Almendra, del lago, te anda buscando." },
    ],
  },
  {
    id: "lago", n: 7, title: "El Lago", npc: "Capitán Almendra", place: "lago", icon: "⛵", reward: { coins: 250, xp: 250 },
    intro: "¡Ahoy! El muelle del lago está roto y los botes no salen hace años. ¡Devolvámosle la vida al lago!",
    tasks: [
      { id: "lago.muelle", icon: "🪵", cost: 4, text: "Arreglar el muelle", say: "¡Ya se puede caminar hasta el agua! Faltan los botes." },
      { id: "lago.botes", icon: "🚣", cost: 5, text: "Pintar los botes", say: "¡Qué colores! Desde un mirador se vería todo el lago…" },
      { id: "lago.mirador", icon: "🔭", cost: 5, text: "Construir el mirador", say: "¡Qué vista! Para terminar, una gran fiesta sobre el lago." },
      { id: "lago.fuegos", icon: "🎆", cost: 6, text: "Fuegos artificiales sobre el lago", say: "🎆 ¡El Pueblo Matichoc quedó completo! Eres la persona más querida del pueblo." },
    ],
  },
];

export const ALL_TASKS = ZONES.flatMap((z) => z.tasks.map((t) => ({ ...t, zone: z })));
const TASK_IDS = new Set(ALL_TASKS.map((t) => t.id));
const choiceIds = (key) => new Set(CHOICES[key].options.map((o) => o.id));
export const zoneOf = (id) => ZONES.find((z) => z.id === id) || null;
export const taskOf = (id) => ALL_TASKS.find((t) => t.id === id) || null;
/** Compatibilidad: los 3 primeros "capítulos" eran la plaza, la cancha y el aro (+ el festival). */
export const CHAPTERS = ZONES;

/** Metas personales que se pueden elegir (se ven en el menú). */
export const GOALS = [
  { id: "festival", icon: "🎪", text: "Terminar el gran festival del Pueblo" },
  { id: "pueblo", icon: "🏘️", text: "Renovar el Pueblo entero (las 7 zonas)" },
  { id: "copa_pichanga", icon: "🏆", text: "Ganar la copa de la Pichanga Choco" },
  { id: "copa_basquet", icon: "🏆", text: "Ganar la copa de Básquet 2 contra 2" },
  { id: "casa", icon: "🏠", text: "Decorar Mi Casa con 5 muebles" },
];

export function defaultAdventure() {
  return { v: ADVENTURE_VERSION, started: false, introSeen: false, stars: 0, starsEarned: 0, done: {}, choices: {}, claimed: [], medals: [], goal: null, lastSeen: 0, seenSummaryAt: 0 };
}

const count = (n, max = 1e6) => { const x = Math.floor(Number(n)); return x > 0 ? Math.min(max, x) : 0; };

/** Lo que tenía un perfil de la aventura anterior (3 capítulos con pasos) pasa a tareas hechas, sin pagar nada de nuevo. */
function fromV1(raw, a) {
  const steps = raw.steps && typeof raw.steps === "object" ? raw.steps : {};
  const c1 = steps["c1.hablar"] && steps["c1.materiales"] && steps["c1.estilo"] && steps["c1.inaugurar"];
  const c2 = steps["c2.hablar"] && steps["c2.colores"] && steps["c2.pichanga"] && steps["c2.contar"];
  const c3 = steps["c3.hablar"] && steps["c3.estilo"] && steps["c3.basquet"] && steps["c3.festival"];
  const all = (zid) => { for (const t of zoneOf(zid).tasks) a.done[t.id] = 1; };
  if (c1) all("plaza");
  else if (a.choices.plaza) { a.done["plaza.limpiar"] = 1; a.done["plaza.estilo"] = 1; }
  if (c2) all("cancha");
  else if (a.choices.cancha) { a.done["cancha.pasto"] = 1; a.done["cancha.colores"] = 1; }
  if (c3) { all("aro"); all("festival"); }
  else if (a.choices.aro) { a.done["aro.piso"] = 1; a.done["aro.estilo"] = 1; }
  // los capítulos ya cobrados no se vuelven a pagar como zonas
  const was = Array.isArray(raw.claimed) ? raw.claimed : [];
  if (was.includes("chapter:c1") || c1) a.claimed.push("zone:plaza");
  if (was.includes("chapter:c2") || c2) a.claimed.push("zone:cancha");
  if (was.includes("chapter:c3") || c3) a.claimed.push("zone:aro", "zone:festival");
  // quien ya había empezado y le faltaba: unas ⭐ para seguir altiro con la tarea que le toca
  if (Object.keys(steps).length && !c3) { a.stars = 2; a.starsEarned = 2; }
}

/**
 * Migración y reparación (idempotente): acepta cualquier cosa (nada, la versión anterior o datos rotos) y devuelve un
 * estado válido sin perder lo que sí está bien. Aplicarla dos veces da lo mismo.
 */
export function normalizeAdventure(raw) {
  const a = defaultAdventure();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return a;
  a.started = !!raw.started;
  a.introSeen = !!raw.introSeen; // la viñeta que cuenta de qué se trata (se muestra una vez)
  if (raw.choices && typeof raw.choices === "object") {
    for (const key of Object.keys(CHOICES)) if (choiceIds(key).has(raw.choices[key])) a.choices[key] = raw.choices[key];
  }
  a.claimed = Array.isArray(raw.claimed) ? [...new Set(raw.claimed.filter((x) => typeof x === "string").slice(0, 300))] : [];
  if (raw.v === 2) {
    if (raw.done && typeof raw.done === "object") for (const [id, v] of Object.entries(raw.done)) if (TASK_IDS.has(id) && v) a.done[id] = 1;
    a.stars = count(raw.stars, 9999);
    a.starsEarned = Math.max(count(raw.starsEarned), a.stars);
  } else {
    fromV1(raw, a);
  }
  a.claimed = [...new Set(a.claimed)];
  // una tarea de elegir no puede estar hecha sin su elección (datos rotos): se vuelve a pedir
  for (const t of ALL_TASKS) if (t.choice && a.done[t.id] && !a.choices[t.choice]) delete a.done[t.id];
  // las tareas van en orden: si falta una, las de después no cuentan (evita saltarse zonas por datos rotos)
  let gap = false;
  for (const t of ALL_TASKS) {
    if (gap) delete a.done[t.id];
    else if (!a.done[t.id]) gap = true;
  }
  if (Object.keys(a.done).length) a.started = true;
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

/** La primera tarea sin hacer (o null si el Pueblo está completo). */
export function currentTask(progress) {
  const a = adventureOf(progress);
  return ALL_TASKS.find((t) => !a.done[t.id]) || null;
}
/** Compatibilidad con el nombre anterior. */
export const currentStep = currentTask;
export const currentZone = (progress) => { const t = currentTask(progress); return t ? t.zone : null; };
export const taskDone = (progress, id) => !!adventureOf(progress).done[id];
export const zoneDone = (progress, id) => { const z = zoneOf(id); return !!z && z.tasks.every((t) => taskDone(progress, t.id)); };
export const zonesDone = (progress) => ZONES.filter((z) => zoneDone(progress, z.id)).length;
/** Compatibilidad: zonas terminadas (logros, menú). */
export const chapterDone = zoneDone;
export const chaptersDone = zonesDone;
export const adventureComplete = (progress) => zonesDone(progress) === ZONES.length;
export const festivalDone = (progress) => zoneDone(progress, "festival");
/** Avance de una zona: { done, total }. */
export function zoneProgress(progress, id) {
  const z = zoneOf(id);
  if (!z) return { done: 0, total: 0 };
  return { done: z.tasks.filter((t) => taskDone(progress, t.id)).length, total: z.tasks.length };
}
/** ¿Se puede entrar a esta zona? (está terminada o es la que toca). */
export function zoneOpen(progress, id) {
  const z = zoneOf(id);
  const cur = currentZone(progress);
  return !!z && (zoneDone(progress, id) || (cur && cur.n >= z.n));
}
export const starsOf = (progress) => adventureOf(progress).stars;
export const choiceOf = (progress, key) => adventureOf(progress).choices[key] || null;
export const choiceOption = (key, id) => CHOICES[key].options.find((o) => o.id === id) || null;

/** ¿Ya se ve en el Pueblo lo de este lugar? (se eligió el estilo y queda puesto para siempre). */
export function placeBuilt(progress, place) {
  const key = { plaza: "plaza", cancha: "cancha", aro: "aro" }[place];
  return !!key && !!choiceOf(progress, key);
}

/** ¿Ya se puede jugar en la cancha / el aro del Pueblo? (desde que se pusieron los arcos / el aro). */
export function placeOpen(progress, place) {
  if (place === "cancha") return taskDone(progress, "cancha.arcos");
  if (place === "aro") return taskDone(progress, "aro.aro");
  return true;
}

export function startAdventure(progress) {
  const a = adventureOf(progress);
  a.started = true;
  return a;
}

/** Suma ⭐ (por terminar una partida, entregar un pedido de Merge, completar las actividades...). Devuelve cuántas. */
export function addStars(progress, n) {
  const k = count(n, 50);
  if (!k) return 0;
  const a = adventureOf(progress);
  a.stars = Math.min(9999, a.stars + k);
  a.starsEarned += k;
  return k;
}

/** Se terminó una partida de un juego (gane o pierda): da ⭐ para renovar el Pueblo. Devuelve cuántas. */
export function onGamePlayed(progress, gameId) {
  return addStars(progress, starsFor(gameId));
}

/**
 * Hacer la tarea que toca (si alcanzan las ⭐). Las tareas de elegir necesitan la opción elegida.
 * Devuelve { ok, task, say, zoneDone, reward?, next? } o { ok:false, need } si faltan ⭐ / { ok:false } si no toca.
 */
export function doTask(progress, taskId, optionId = null) {
  const a = adventureOf(progress);
  const t = currentTask(progress);
  if (!t || t.id !== taskId) return { ok: false };
  if (a.stars < t.cost) return { ok: false, need: t.cost - a.stars, task: t };
  if (t.choice) {
    if (!choiceOption(t.choice, optionId)) return { ok: false, needChoice: t.choice, task: t };
    a.choices[t.choice] = optionId;
  }
  a.stars -= t.cost;
  a.done[t.id] = 1;
  a.started = true;
  const out = { ok: true, task: t, zone: t.zone, say: t.say, zoneDone: zoneDone(progress, t.zone.id), next: currentTask(progress) };
  if (out.zoneDone) {
    const key = `zone:${t.zone.id}`;
    if (!a.claimed.includes(key)) { a.claimed.push(key); out.reward = { ...t.zone.reward, zone: t.zone.id }; }
  }
  return out;
}

/** Cambiar después un estilo ya elegido (gratis). */
export function choose(progress, key, optionId) {
  if (!CHOICES[key] || !choiceOption(key, optionId)) return { ok: false };
  const t = ALL_TASKS.find((x) => x.choice === key);
  if (!taskDone(progress, t.id)) return { ok: false, task: t };
  adventureOf(progress).choices[key] = optionId;
  return { ok: true, advanced: false, task: t };
}

const lineFor = (z, progress) => {
  const c = (key) => choiceOption(key, choiceOf(progress, key));
  const lines = {
    plaza: () => { const o = c("plaza"); return `¡El rincón con ${o ? o.name.toLowerCase() : "tu estilo"} quedó precioso! Vengo todas las tardes a sentarme ahí.`; },
    cancha: () => { const o = c("cancha"); return `¡Qué buena quedó la cancha${o ? ` con los colores ${o.name.toLowerCase()}` : ""}! Cuando quieras jugamos otra pichanga.`; },
    aro: () => { const o = c("aro"); return `¡La cancha ${o ? o.name.toLowerCase() : "nueva"} es lo mejor del pueblo! Ven a jugar un 2 contra 2 cuando quieras.`; },
    festival: () => "¡Qué gran festival armaste! Todo el pueblo sigue celebrando.",
    bosque: () => "¡El bosque de cacao está más lindo que nunca! Pasea por el sendero cuando quieras.",
    granja: () => "¡Mis animales están felices y el huerto da unas verduras riquísimas! Gracias.",
    lago: () => "¡Ahoy! El lago está lleno de vida otra vez. ¡Eres parte de la tripulación!",
  };
  return (lines[z.id] || (() => "¡Gracias por tu ayuda!"))();
};

/**
 * Lo que dice un vecino de la aventura cuando le hablas, según el avance. Ya no completa nada solo: la tarea se hace
 * con ⭐ desde la lista de tareas (action: "tasks"). Devuelve null si ese vecino no es de la aventura.
 *   { text, action?: "tasks", task?, waiting?, memory? }
 */
export function talkTo(progress, npcName, season = null) {
  const z = ZONES.find((x) => x.npc === npcName);
  if (!z) return null;
  const extra = season ? ` ¡Y con ${season.name} ${season.icon} el pueblo está precioso!` : "";
  if (zoneDone(progress, z.id)) return { text: lineFor(z, progress) + extra, memory: true };
  const cur = currentTask(progress);
  if (!cur || cur.zone.id !== z.id) {
    const prev = ZONES[z.n - 2];
    return { text: `¡Hola! Tengo un sueño para el pueblo, pero primero ayuda a ${prev.npc} con ${prev.title.toLowerCase()}.`, waiting: true };
  }
  const stars = starsOf(progress);
  const first = !zoneOf(z.id).tasks.some((t) => taskDone(progress, t.id));
  const ask = `${first ? `${z.intro} ` : ""}Lo que sigue: ${cur.icon} ${cur.text.charAt(0).toLowerCase()}${cur.text.slice(1)} (⭐${cur.cost}).`;
  const tail = stars >= cur.cost ? " ¡Ya tienes las ⭐ para hacerlo!" : ` Te faltan ⭐${cur.cost - stars}: juega cualquier juego y las ganas.`;
  return { text: ask + tail, action: "tasks", task: cur };
}

/** El vecino que te espera (para el "❗" en el Pueblo): el de la zona actual, si ya te alcanzan las ⭐. */
export function npcWaiting(progress) {
  const cur = currentTask(progress);
  if (!cur || starsOf(progress) < cur.cost) return null;
  return cur.zone.npc;
}

/** El objetivo actual explicado en una línea. */
export function objective(progress) {
  const cur = currentTask(progress);
  if (!cur) return { done: true, text: "¡Renovaste el Pueblo entero! Pasea por sus zonas y juega en la cancha y el aro." };
  const stars = starsOf(progress);
  const can = stars >= cur.cost;
  return {
    done: false, task: cur, step: cur, zone: cur.zone, chapter: cur.zone, can, stars,
    text: can ? `${cur.zone.npc}: ${cur.text.charAt(0).toLowerCase()}${cur.text.slice(1)} (⭐${cur.cost}). ¡Ya puedes!` : `${cur.text} (⭐${cur.cost}): te faltan ⭐${cur.cost - stars}, juega cualquier juego`,
  };
}

// ---------- volver después de un rato ----------

const AWAY_MS = 3 * 3600e3; // si pasaron más de 3 horas desde la última vez, se muestra el resumen

/** Resumen corto al volver (o null si no corresponde). Marca la visita. */
export function returnSummary(progress, now = Date.now()) {
  const a = adventureOf(progress);
  const last = a.lastSeen;
  a.lastSeen = now;
  if (!a.started || !last || now - last < AWAY_MS) return null;
  const done = zonesDone(progress);
  const obj = objective(progress);
  const head = done === ZONES.length ? "¡Bienvenida/o de vuelta! El Pueblo está completo." : `¡Hola otra vez! Llevas ${done} de ${ZONES.length} zonas del Pueblo y tienes ⭐${a.stars}.`;
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
  if (g.id === "festival") { have = Math.min(4, zonesDone(progress)); need = 4; }
  else if (g.id === "pueblo") { have = zonesDone(progress); need = ZONES.length; }
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

/** Dónde ocurre la tarea actual en el Pueblo (para la flecha guía y para "Ir al Pueblo"). */
export function stepPlace(progress) {
  const z = currentZone(progress);
  return z ? z.place : null;
}

/** Lo que comentan los demás vecinos de lo que ya renovaste (para que el pueblo se note distinto). */
export function gossip(progress) {
  const lines = [];
  const o = (k) => choiceOption(k, choiceOf(progress, k));
  if (zoneDone(progress, "plaza")) lines.push(`¿Viste el rincón de Bombi con ${o("plaza") ? o("plaza").name.toLowerCase() : "su estilo nuevo"}? ¡Quedó precioso gracias a ti!`);
  if (zoneDone(progress, "cancha")) lines.push("¡La cancha del Pueblo quedó lista! Cuando quieras jugamos una pichanga ⚽");
  if (zoneDone(progress, "festival")) lines.push("¡Qué gran festival armaste! Dicen que más allá de la cerca hay un bosque de cacao 🌳");
  if (zoneDone(progress, "bosque")) lines.push("¿Fuiste a la casita del árbol del bosque? ¡Es preciosa! 🏡");
  if (zoneDone(progress, "granja")) lines.push("¡Las verduras de la granja de Tía Avellana son las más ricas! 🥕");
  if (zoneDone(progress, "lago")) lines.push("¡Los fuegos artificiales del lago fueron lo más lindo que he visto! 🎆");
  return lines;
}

/** Ya vio la viñeta inicial que cuenta de qué se trata el festival. */
export function markIntroSeen(progress) {
  const a = adventureOf(progress);
  a.introSeen = true;
  a.started = true;
  // regalo de bienvenida: la primera tarea (⭐1) se puede hacer altiro (una sola vez)
  if (!a.claimed.includes("intro:stars")) { a.claimed.push("intro:stars"); addStars(progress, 1); }
  return a;
}
