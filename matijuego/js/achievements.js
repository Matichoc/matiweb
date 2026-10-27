// Logros: metas para volver a jugar durante semanas, no solo una tarde.
//
// Hay dos tipos:
//   · Logros sueltos (categoría "Primeros retos"): objetivos cortos, como los de siempre.
//   · Cadenas de logros: una misma meta que sube por escalones (🥉 Bronce → 🥈 Plata → 🥇 Oro → 💎 Platino
//     → 👑 Diamante). En pantalla se ve el escalón que toca y su barra de progreso; al reclamarlo
//     aparece el siguiente. Muchas cadenas piden días jugados, horas, rachas o los 20 niveles de
//     cada juego, así que no se pueden terminar en una sola sesión.
//
// Cada logro se revisa contra el progreso guardado del perfil (ver `progress.stats`, `progress.campaign`,
// `progress.bestScores`…) y se reclama una sola vez. Para agregar uno basta sumar una línea abajo.
// La lista completa en texto está en docs/LOGROS.md (se genera con `node scripts/logros-doc.mjs`).

import { getBestScore } from "./storage.js?v=73aaf47357";
import { levelInfo } from "./progression.js?v=73aaf47357";
import { PAGES } from "./album.js?v=73aaf47357";
import { chaptersDone } from "./adventure.js?v=73aaf47357";
import { cupsWon as sportCups } from "./sports-progress.js?v=73aaf47357";

const IN_APP = typeof document !== "undefined" && document.documentElement.dataset.app === "1";


const ALL_ACHIEVEMENTS = [
  {
    id: "primeros_pasos",
    name: "Primeros pasos",
    icon: "👣",
    reward: 10,
    desc: "Juega tu primera partida de cualquier juego.",
    isDone: (p) => Object.keys(p.bestScores).length > 0,
  },
  {
    id: "recolector",
    name: "Recolector Novato",
    icon: "🍬",
    reward: 20,
    desc: "Consigue 100 puntos en Recolecta y Corre.",
    isDone: (p) => getBestScore(p, "recolecta") >= 100,
  },
  {
    id: "tetris_master",
    name: "Maestro de los Bloques",
    icon: "🧱",
    reward: 20,
    desc: "Consigue 500 puntos en Bloques de Productos.",
    isDone: (p) => getBestScore(p, "tetris") >= 500,
  },
  {
    id: "campeon",
    name: "Campeón Matichoc",
    icon: "🏆",
    reward: 40,
    desc: "Completa las 8 canchas de Recolecta y Corre.",
    isDone: (p) => recLevel(p) >= 8,
  },
  {
    id: "leyenda_liga",
    name: "Leyenda de La Liga",
    icon: "👑",
    reward: 80,
    desc: "Completa los 20 niveles de Recolecta y Corre.",
    isDone: (p) => recLevel(p) >= 20,
  },
  {
    id: "ahorrista",
    name: "Ahorrista de Cacao",
    icon: "💰",
    reward: 30,
    desc: "Gana 200 Matipuntos en total.",
    isDone: (p) => (p.stats.totalCoinsEarned || 0) >= 200,
  },
  {
    id: "encestador",
    name: "Encestador Estrella",
    icon: "🏀",
    reward: 20,
    desc: "Consigue 100 puntos en Lanzamientos de Básquet.",
    isDone: (p) => getBestScore(p, "basquet_tiros") >= 100,
  },
  {
    id: "cazador",
    name: "Cazador de Malvaviscos",
    icon: "🎯",
    reward: 25,
    desc: "Consigue 1500 puntos en Choco Blaster 3D.",
    appHidden: true, // Choco Blaster no va en la app infantil
    isDone: (p) => getBestScore(p, "fps3d") >= 1500,
  },
  {
    id: "explorador",
    name: "Explorador Infinito",
    icon: "♾️",
    reward: 30,
    desc: "Recorre 300 m en el Mundo infinito de Parkour Choco.",
    isDone: (p) => (p.stats.parkourInfBest || 0) >= 300,
  },
  {
    id: "maratonista",
    name: "Maratonista del Cacao",
    icon: "🏃",
    reward: 60,
    desc: "Recorre 1000 m en el Mundo infinito de Parkour Choco.",
    isDone: (p) => (p.stats.parkourInfBest || 0) >= 1000,
  },
  {
    id: "viajero",
    name: "Viajera de Mundos",
    icon: "🌎",
    reward: 40,
    desc: "Llega al Mundo 5 en el Mundo infinito de Parkour Choco.",
    isDone: (p) => (p.stats.parkourInfWorlds || 0) >= 5,
  },
  {
    id: "escalador",
    name: "Escalador de Cacao",
    icon: "🦘",
    reward: 20,
    desc: "Consigue 1500 puntos en Salto Choco 3D.",
    isDone: (p) => getBestScore(p, "salto") >= 1500,
  },
  {
    id: "piloto",
    name: "Piloto Choco",
    icon: "🏎️",
    reward: 20,
    desc: "Consigue 1500 puntos en Autos de Chocolate 3D.",
    isDone: (p) => getBestScore(p, "autos") >= 1500,
  },
  {
    id: "memorion",
    name: "Memorión Matichoc",
    icon: "🧠",
    reward: 25,
    desc: "Consigue 3000 puntos en Memoria Matichoc 3D.",
    isDone: (p) => getBestScore(p, "memoria") >= 3000,
  },
  {
    id: "chocolatero",
    name: "Chocolatero",
    icon: "🍫",
    reward: 15,
    desc: "Guarda tu primera creación en Crea tu Chocolate.",
    isDone: (p) => (p.creations || []).length >= 1,
  },
  {
    id: "obra_maestra",
    name: "Obra Maestra",
    icon: "🎨",
    reward: 30,
    desc: "Consigue 450 puntos de creatividad en Crea tu Chocolate.",
    isDone: (p) => getBestScore(p, "creador") >= 450,
  },
  {
    id: "parkourista",
    name: "Parkourista Matichoc",
    icon: "🧗",
    reward: 30,
    desc: "Llega a la meta del Parkour Choco 3D.",
    isDone: (p) => (p.stats.parkourFinishes || 0) >= 1,
  },
  {
    id: "equilibrista",
    name: "Equilibrista Matichoc",
    icon: "🤸",
    reward: 20,
    desc: "Consigue 80 puntos en Saltos de Porristas.",
    isDone: (p) => getBestScore(p, "porristas") >= 80,
  },
];

// ---------- métricas (lo que se mide en el progreso de cada perfil) ----------

const camp = (p, g) => {
  const c = (p.campaign && p.campaign[g]) || { unlocked: 1, stars: {} };
  // los logros cuentan lo logrado en TODAS las vueltas (empezar una vuelta nueva no los pierde)
  const won = (c.hist && c.hist.won) || {};
  const stars = { ...c.stars };
  for (const [n, s] of Object.entries(won)) stars[n] = Math.max(stars[n] || 0, s);
  return { ...c, stars };
};
const recLevel = (p) => Math.max(p.unlockedLevel || 0, (((p.campaign || {}).recolecta || {}).hist || {}).rec || 0);
/** Niveles (o misiones) ya cumplidos de un juego. */
const levelsDone = (g) => (p) => Math.max(Object.keys(camp(p, g).stars).length, g === "recolecta" ? recLevel(p) : 0);
const starsOf = (g) => (p) => Object.values(camp(p, g).stars).reduce((a, b) => a + b, 0);
const best = (g) => (p) => getBestScore(p, g);
const stat = (k) => (p) => (p.stats && p.stats[k]) || 0;
const LEVEL_GAMES = ["recolecta", "tetris", "basquet_tiros", "porristas", "memoria"];
const MISSION_GAMES = ["salto", "autos", "parkour"];
const sum = (fns) => (p) => fns.reduce((a, f) => a + f(p), 0);
const playedGames = (p) => ["recolecta", "tetris", "basquet_tiros", "porristas", "memoria", "salto", "autos", "parkour", "creador", "futbol", "dulces", "merge", "aventura", "ciudad"].filter((g) => ((p.stats.runsBy || {})[g] || 0) > 0 || getBestScore(p, g) > 0).length;
const eventTokensTotal = (p) => Object.values(p.eventTokens || {}).reduce((a, b) => a + b, 0);
const albumUnique = (p) => Object.values(p.album || {}).filter((n) => n > 0).length;

// ---------- cadenas ----------

// Los premios grandes son para metas de semanas; esta escala los mantiene a raya frente a los precios de la tienda.
const scaleReward = (r) => Math.max(5, Math.round((r * 0.6) / 5) * 5);

const TIER_NAMES = ["🥉 Bronce", "🥈 Plata", "🥇 Oro", "💎 Platino", "👑 Diamante", "🏆 Leyenda"];

/**
 * chain(categoría, id, nombre, ícono, métrica, texto, escalones, { unit, appHidden })
 *   texto: frase con {n} (se reemplaza por la meta de cada escalón). escalones: [[meta, Matipuntos], ...]
 */
const CHAINS = [];
function chain(cat, id, name, icon, metric, text, tiers, extra = {}) {
  const list = tiers.map(([target, reward], i) => ({
    id: `${id}_${i + 1}`,
    name: `${name} · ${TIER_NAMES[i]}`,
    icon,
    reward: scaleReward(reward),
    desc: text.replace("{n}", target.toLocaleString("es-CL")),
    target,
    metric,
    cat,
    tier: i,
    appHidden: extra.appHidden,
    isDone: (p) => metric(p) >= target,
    progress: (p) => ({ cur: Math.min(metric(p), target), max: target }),
  }));
  CHAINS.push({ id, cat, name, icon, tiers: list });
  return list;
}

export const CATEGORIES = [
  { id: "inicio", name: "Primeros retos", icon: "🌱" },
  { id: "constancia", name: "Constancia", icon: "🔥" },
  { id: "campana", name: "Niveles y misiones", icon: "🏆" },
  { id: "puntajes", name: "Récords", icon: "📈" },
  { id: "pueblo", name: "Pueblo y creación", icon: "🏘️" },
  { id: "estilo", name: "Estilo y casa", icon: "👕" },
  { id: "coleccion", name: "Colección y nivel", icon: "📖" },
  { id: "maestro", name: "Maestro Matichoc", icon: "👑" },
];

// Constancia: días, rachas, horas y partidas (¡no se terminan en una sola tarde!)
chain("constancia", "dias", "Jugador fiel", "📅", stat("playDays"), "Juega en {n} días distintos.", [[3, 20], [7, 50], [14, 100], [30, 250], [60, 500]]);
chain("constancia", "racha", "Racha de fuego", "🔥", stat("bestStreak"), "Reclama la recompensa diaria {n} días seguidos.", [[3, 20], [7, 60], [14, 150], [30, 400]]);
chain("constancia", "horas", "Horas de diversión", "⏱️", (p) => Math.floor(((p.stats && p.stats.playSecs) || 0) / 60), "Juega {n} minutos en total.", [[30, 20], [120, 60], [360, 150], [900, 350], [1800, 700]]);
chain("constancia", "partidas", "Partidas jugadas", "🎮", stat("totalRuns"), "Termina {n} partidas.", [[10, 15], [50, 40], [150, 100], [400, 250], [1000, 600]]);
chain("constancia", "todoterreno", "Todoterreno", "🧭", playedGames, "Juega {n} juegos distintos.", [[3, 15], [6, 50], [9, 120], [12, 200]]);

// Niveles de cada juego por niveles (20) y misiones de los juegos sin fin (20)
const LEVEL_NAMES = {
  recolecta: ["Corredor de La Liga", "🏃"], tetris: ["Arquitecto de Vitrinas", "🧱"], basquet_tiros: ["Estrella de la Cancha", "🏀"],
  porristas: ["Capitana Cheer", "🤸"], memoria: ["Memoria de Elefante", "🧠"],
};
for (const g of LEVEL_GAMES) chain("campana", `niv_${g}`, LEVEL_NAMES[g][0], LEVEL_NAMES[g][1], levelsDone(g), "Completa {n} niveles.", [[5, 20], [10, 50], [15, 100], [20, 200]]);
// Juegos que se canjean con Matipuntos: Fútbol (dos modos), Dulces y Aventura, 20 niveles cada uno
chain("campana", "niv_futbol_pen", "Rey de los Penales", "🥅", levelsDone("futbol_pen"), "Supera {n} niveles de Penales.", [[5, 25], [10, 60], [15, 120], [20, 250]]);
chain("campana", "niv_futbol_tl", "Maestro del Tiro Libre", "🎯", levelsDone("futbol_tl"), "Supera {n} niveles de Tiros libres.", [[5, 25], [10, 60], [15, 120], [20, 250]]);
chain("campana", "niv_futbol_ata", "Manos de Oro", "🧤", levelsDone("futbol_ata"), "Supera {n} niveles de Atajapenales.", [[5, 25], [10, 60], [15, 120], [20, 250]]);
const CUP_MODES = ["futbol_pen", "futbol_tl", "futbol_ata"];
const cupsWon = (p) => CUP_MODES.reduce((a, g) => a + [5, 10, 15, 20].filter((n) => (camp(p, g).stars[n] || 0) > 0).length, 0);
chain("campana", "copas", "Campeón de Copas", "🏆", cupsWon, "Gana {n} copas de Fútbol Choco (hay 12: 4 por modo).", [[1, 25], [4, 70], [8, 160], [12, 400]]);
chain("campana", "niv_dulces", "Maestro del Choco Match", "🍫", levelsDone("dulces"), "Supera {n} niveles de Choco Match.", [[5, 25], [10, 60], [15, 120], [20, 250]]);
chain("campana", "niv_aventura", "Aventurero de Mundos", "🍄", levelsDone("aventura"), "Supera {n} niveles de Aventura Choco.", [[5, 25], [10, 60], [15, 120], [20, 250]]);
const BOSS_LEVELS = { dulces: [5, 10, 15, 20], aventura: [4, 8, 12, 16, 20] };
const bossesBeaten = (p) => Object.entries(BOSS_LEVELS).reduce((a, [g, lv]) => a + lv.filter((n) => (camp(p, g).stars[n] || 0) > 0).length, 0);
chain("campana", "jefes", "Cazajefes", "👑", bossesBeaten, "Derrota a {n} jefes (en Dulces y en Aventura hay 9).", [[1, 25], [3, 70], [6, 160], [9, 400]]);
const MISSION_NAMES = { salto: ["Misionero del Cielo", "🦘"], autos: ["Misionero del Asfalto", "🏎️"], parkour: ["Misionero del Parkour", "🧗"] };
for (const g of MISSION_GAMES) chain("campana", `mis_${g}`, MISSION_NAMES[g][0], MISSION_NAMES[g][1], levelsDone(g), "Cumple {n} misiones.", [[5, 20], [10, 50], [15, 100], [20, 200]]);
chain("campana", "estrellas", "Perfeccionista", "⭐", sum(LEVEL_GAMES.map(starsOf)), "Junta {n} estrellas en los niveles (hay 300).", [[25, 25], [75, 70], [150, 160], [250, 350], [300, 700]]);
chain("campana", "campanas", "Maestro de campañas", "🗺️", sum([...LEVEL_GAMES, ...MISSION_GAMES].map(levelsDone)), "Cumple {n} niveles y misiones en total (hay 160).", [[20, 40], [60, 120], [120, 300], [160, 700]]);

// Récords en cada juego
const REC = (id, name, icon, metric, text, tiers, extra) => chain("puntajes", id, name, icon, metric, text, tiers, extra);
REC("rec_recolecta", "Récord Recolecta", "🍬", best("recolecta"), "Consigue {n} puntos en Recolecta y Corre.", [[500, 15], [2500, 40], [6000, 100], [10000, 250]]);
REC("rec_tetris", "Récord Bloques", "🧩", best("tetris"), "Consigue {n} puntos en Bloques de Productos.", [[1000, 15], [4000, 40], [10000, 100], [25000, 250]]);
REC("rec_basquet", "Récord Básquet", "🏀", best("basquet_tiros"), "Consigue {n} puntos en Lanzamientos de Básquet.", [[500, 15], [1500, 40], [3000, 100], [6000, 250]]);
REC("rec_porristas", "Récord Porristas", "🤸", best("porristas"), "Consigue {n} puntos en Saltos de Porristas.", [[100, 15], [300, 40], [700, 100], [1500, 250]]);
REC("rec_memoria", "Récord Memoria", "🧠", best("memoria"), "Consigue {n} puntos en Memoria Matichoc.", [[3000, 15], [12000, 40], [30000, 100], [60000, 250]]);
REC("rec_salto", "Récord Salto Choco", "🦘", best("salto"), "Consigue {n} puntos en Salto Choco.", [[5000, 30], [12000, 70], [25000, 160], [50000, 350]]);
REC("rec_autos", "Récord Autos", "🏎️", best("autos"), "Consigue {n} puntos en Autos de Chocolate.", [[4000, 30], [9000, 70], [18000, 160], [35000, 350]]);
REC("rec_parkour", "Récord Parkour", "🧗", stat("parkourInfBest"), "Recorre {n} metros en el Mundo infinito.", [[2500, 70], [5000, 160], [8000, 350]]);
REC("rec_mundos", "Viajero de mundos", "🌎", stat("parkourInfWorlds"), "Llega al Mundo {n} en el Parkour infinito.", [[8, 40], [12, 100], [20, 250]]);

REC("rec_futbol", "Récord Fútbol", "⚽", best("futbol"), "Consigue {n} puntos en una partida de Fútbol Choco.", [[400, 15], [800, 40], [1200, 100], [1800, 250]]);
REC("rec_dulces", "Récord Choco Match", "🍫", best("dulces"), "Consigue {n} puntos en Choco Match.", [[2500, 15], [5000, 40], [9000, 100], [15000, 250]]);
REC("rec_aventura", "Récord Aventura", "🍄", best("aventura"), "Consigue {n} puntos en Aventura Choco.", [[800, 15], [1500, 40], [2500, 100], [4000, 250]]);
chain("puntajes", "goleador", "Goleador", "⚽", stat("goalsTotal"), "Mete {n} goles en Fútbol Choco.", [[10, 15], [50, 50], [150, 120], [400, 300]]);
chain("puntajes", "dianas", "Francotirador", "🎯", stat("dianasTotal"), "Mete {n} goles en las dianas doradas del arco.", [[3, 15], [15, 50], [50, 120], [150, 300]]);
chain("puntajes", "atajadas", "Pared de Chocolate", "🧤", stat("ataSaves"), "Ataja {n} penales en Atajapenales.", [[10, 15], [40, 50], [120, 120], [350, 300]]);
const ciudadMissions = (p) => Object.keys((p.ciudad && p.ciudad.done) || {}).filter((k) => p.ciudad.done[k]).length;
chain("campana", "ciudad_misiones", "Buen Vecino", "🏙️", ciudadMissions, "Cumple {n} misiones distintas en Ciudad Choco (hay 8).", [[1, 20], [3, 60], [6, 150], [8, 350]]);
chain("campana", "ciudad_medalla", "Piloto Estrella", "🏁", (p) => (p.ciudad && p.ciudad.medal) || 0, "Gana una medalla en la carrera de Ciudad Choco (1 bronce, 2 plata, 3 oro).", [[1, 25], [2, 60], [3, 150]]);
chain("puntajes", "chofer", "Chofer Choco", "🚗", (p) => Math.floor(((p.stats && p.stats.ciudadKm) || 0)), "Maneja {n} km por Ciudad Choco.", [[2, 15], [10, 50], [40, 120], [120, 300]]);
chain("puntajes", "dorados_ciudad", "Cazador de Brillos", "✨", stat("ciudadGold"), "Junta {n} alfajores dorados en Ciudad Choco.", [[20, 15], [100, 50], [300, 120], [800, 300]]);
chain("puntajes", "pisotones", "Pisotones", "👟", stat("stompsTotal"), "Pisa {n} enemigos en Aventura Choco.", [[20, 15], [100, 50], [300, 120], [800, 300]]);
chain("puntajes", "alfajores_av", "Alfajorero", "🍫", stat("aventuraCoins"), "Junta {n} alfajores en Aventura Choco.", [[100, 15], [500, 50], [1500, 120], [4000, 300]]);
chain("puntajes", "merge_nivel", "Coleccionista de Merge", "🍬", (p) => (p.merge && Array.isArray(p.merge.bests) ? p.merge.bests.reduce((a, b) => a + b, 0) : 0), "Descubre {n} productos distintos en Mati Merge (hay 26, el último es el Mati Dubai).", [[8, 15], [14, 50], [20, 120], [26, 400]]);
chain("puntajes", "merge_pedidos", "Proveedor Estrella", "📦", (p) => (p.merge && p.merge.delivered) || 0, "Entrega {n} pedidos de clientes en Mati Merge.", [[5, 15], [25, 50], [80, 120], [250, 300]]);
chain("puntajes", "especiales", "Piezas especiales", "✨", stat("dulcesSpecials"), "Crea {n} piezas especiales (rayadas, bombas doradas y envueltas).", [[10, 15], [40, 50], [120, 120], [300, 300]]);

// Pueblo y creación
chain("pueblo", "pueblo_cosas", "Buscador del pueblo", "✨", stat("townItems"), "Junta {n} brillos en el Pueblo Matichoc.", [[25, 15], [100, 40], [300, 100], [800, 250]]);
chain("pueblo", "pueblo_vecinos", "Amigo de los vecinos", "👋", stat("townTalks"), "Saluda a los vecinos {n} veces (una por vecino y día).", [[10, 15], [40, 50], [100, 120]]);
chain("pueblo", "disenos", "Diseñador de chocolates", "🍫", (p) => (p.creations || []).length, "Guarda {n} creaciones en Crea tu Chocolate.", [[3, 20], [10, 60], [25, 150]]);
chain("pueblo", "eventos", "Fiestero de temporada", "🎃", eventTokensTotal, "Junta {n} fichas de eventos de temporada.", [[10, 30], [40, 80], [100, 200]]);
// Aventura del festival y deportes del Pueblo (js/adventure.js, js/sports-progress.js)
chain("pueblo", "festival", "Renovador del Pueblo", "🎪", (p) => (p.adventure ? chaptersDone(p) : 0), "Renueva {n} zonas del Pueblo (hay 7).", [[1, 20], [2, 40], [4, 80], [7, 200]]);
chain("campana", "copa_pichanga", "Campeón de la Pichanga", "⚽", (p) => (p.sports ? sportCups(p, "pichanga") : 0), "Gana {n} copas de la Pichanga Choco.", [[1, 40], [3, 100]]);
chain("campana", "copa_basquet", "Campeón del 2 contra 2", "🏀", (p) => (p.sports ? sportCups(p, "basquet2v2") : 0), "Gana {n} copas de Básquet 2 contra 2.", [[1, 40], [3, 100]]);

// Estilo y casa
chain("estilo", "ropero", "Gran ropero", "👗", (p) => (p.wardrobe && p.wardrobe.owned ? p.wardrobe.owned.length : 0), "Ten {n} objetos en tu vestuario.", [[5, 15], [15, 50], [30, 120], [50, 250], [70, 500]]);
chain("estilo", "muebles", "Decorador", "🛋️", (p) => (p.house && p.house.layout ? p.house.layout.length : 0), "Pon {n} muebles en tu casa.", [[3, 15], [10, 40], [25, 100], [50, 250]]);
chain("estilo", "casa", "Dueño de casa", "🏡", (p) => (p.house && p.house.size) || 0, "Agranda tu casa al tamaño {n} (1 = mediana, 2 = grande).", [[1, 60], [2, 200]]);

// Colección y nivel
chain("coleccion", "album", "Coleccionista", "📖", albumUnique, "Junta {n} figuritas distintas (hay 96).", [[6, 20], [12, 60], [24, 150], [48, 300], [72, 500], [96, 1000]]);
chain("coleccion", "paginas", "Páginas completas", "📚", (p) => PAGES.filter((pg) => (p.albumClaimed || []).includes(`page:${pg.id}`)).length, "Completa {n} páginas del álbum (hay 6).", [[1, 40], [3, 120], [6, 400]]);
chain("coleccion", "vendedor", "Vendedor de repetidas", "💰", stat("albumSold"), "Gana {n} Matipuntos vendiendo repetidas.", [[50, 15], [250, 60], [1000, 200]]);
chain("coleccion", "sobres", "Abridor de sobres", "📦", stat("packsOpened"), "Abre {n} sobres.", [[5, 20], [20, 70], [50, 180], [100, 400]]);
chain("coleccion", "misdiarias", "Cumplidor diario", "🎯", stat("missionsClaimed"), "Cumple {n} misiones diarias.", [[5, 20], [25, 90], [100, 300]]);
chain("coleccion", "nivel", "Subiendo de nivel", "⭐", (p) => levelInfo(p.xp).level, "Llega al nivel {n}.", [[5, 20], [10, 50], [20, 120], [30, 250], [45, 500], [60, 1000]]);
chain("coleccion", "puntos", "Ahorrista mayor", "💰", stat("totalCoinsEarned"), "Gana {n} Matipuntos en total.", [[500, 25], [2000, 70], [6000, 180], [15000, 450]]);

// Logros sueltos que combinan varias cosas
const SINGLES = [
  { cat: "maestro", id: "gran_campeon", name: "Gran Campeón Matichoc", icon: "🏅", reward: 800, desc: "Completa los 20 niveles de los 5 juegos por niveles.", isDone: (p) => LEVEL_GAMES.every((g) => levelsDone(g)(p) >= 20), progress: (p) => ({ cur: LEVEL_GAMES.reduce((a, g) => a + Math.min(20, levelsDone(g)(p)), 0), max: 100 }) },
  { cat: "maestro", id: "gran_misionero", name: "Gran Misionero", icon: "🎖️", reward: 600, desc: "Cumple las 20 misiones de Salto Choco, Autos y Parkour.", isDone: (p) => MISSION_GAMES.every((g) => levelsDone(g)(p) >= 20), progress: (p) => ({ cur: MISSION_GAMES.reduce((a, g) => a + Math.min(20, levelsDone(g)(p)), 0), max: 60 }) },
  { cat: "maestro", id: "tres_estrellas", name: "Todo tres estrellas", icon: "🌟", reward: 1000, desc: "Consigue las 3 estrellas en los 100 niveles de los juegos por niveles.", isDone: (p) => sum(LEVEL_GAMES.map(starsOf))(p) >= 300, progress: (p) => ({ cur: sum(LEVEL_GAMES.map(starsOf))(p), max: 300 }) },
  { cat: "maestro", id: "doble_leyenda", name: "Leyenda de dos mundos", icon: "🌈", reward: 400, desc: "Llega a 5000 m en el Parkour infinito y a 25000 puntos en Salto Choco el mismo perfil.", isDone: (p) => (p.stats.parkourInfBest || 0) >= 5000 && getBestScore(p, "salto") >= 25000, progress: (p) => ({ cur: Math.min(1, (p.stats.parkourInfBest || 0) / 5000) + Math.min(1, getBestScore(p, "salto") / 25000), max: 2 }) },
  { cat: "maestro", id: "dueno_arcade", name: "Dueño de la Arcade", icon: "🕹️", reward: 400, desc: "Canjea con Matipuntos los 4 juegos nuevos: Fútbol, Choco Match, Aventura y Ciudad Choco.", isDone: (p) => (p.unlockedGames || []).length >= 4, progress: (p) => ({ cur: Math.min(4, (p.unlockedGames || []).length), max: 4 }) },
  { cat: "maestro", id: "mes_completo", name: "Un mes con Matichoc", icon: "🗓️", reward: 500, desc: "Juega 30 días distintos y llega al nivel 20.", isDone: (p) => (p.stats.playDays || 0) >= 30 && levelInfo(p.xp).level >= 20, progress: (p) => ({ cur: Math.min(30, p.stats.playDays || 0) + Math.min(20, levelInfo(p.xp).level), max: 50 }) },
];
for (const s of SINGLES) CHAINS.push({ id: s.id, cat: s.cat, name: s.name, icon: s.icon, tiers: [{ ...s, reward: scaleReward(s.reward), tier: 0 }] });

// Primeros retos: los logros sueltos de siempre (se conservan para quienes ya los reclamaron)
for (const a of ALL_ACHIEVEMENTS) CHAINS.push({ id: a.id, cat: "inicio", name: a.name, icon: a.icon, tiers: [{ ...a, cat: "inicio", tier: 0 }] });

// Meta-logro: cuántos logros llevas (cuenta todos los demás)
const BASE_FLAT = CHAINS.flatMap((c) => c.tiers).filter((a) => !(IN_APP && a.appHidden));
const doneCount = (p) => BASE_FLAT.filter((a) => a.isDone(p)).length;
chain("maestro", "coleccion_logros", "Cazador de logros", "🧿", doneCount, "Cumple {n} logros.", [[10, 30], [30, 100], [60, 250], [100, 500], [BASE_FLAT.length, 1500]]);

const orderOf = (c) => CATEGORIES.findIndex((x) => x.id === c.cat);
export const ACHIEVEMENT_CHAINS = CHAINS
  .map((c) => ({ ...c, tiers: c.tiers.filter((a) => !(IN_APP && a.appHidden)) }))
  .filter((c) => c.tiers.length)
  .sort((a, b) => orderOf(a) - orderOf(b));

export const ACHIEVEMENTS = ACHIEVEMENT_CHAINS.flatMap((c) => c.tiers);

/** Progreso { cur, max } de un logro (los sueltos sin barra propia cuentan 0 o 1). */
export function achievementProgress(a, p) {
  if (a.progress) return a.progress(p);
  return { cur: a.isDone(p) ? 1 : 0, max: 1 };
}
