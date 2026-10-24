// Mati Merge: la lógica del juego de juntar productos (sin gráficos, para poder probarla sola).
// Como en los juegos de "merge": un tablero lleno de productos de 4 familias (alfajores, cuchuflís, bombones y tabletas).
// Juntas dos productos IGUALES y se transforman en el siguiente de su familia, del más chiquito al más grande;
// la tableta más soñada es el ¡Mati Dubai! Para sacar productos nuevos usas los 4 generadores (1 ⚡ cada vez) y los
// clientes piden productos que puedes entregar por Matipuntos. El tablero se guarda en el perfil.
//
// progress.merge = { v:2, grid:[código], bests:[nivel máximo de cada familia], delivered, merges, spawned, dubai,
//   orders:[{ who, why, items:[{c,t}] (1 o 2 productos), coins, xp }], day }
// Los pedidos son de los vecinos del Pueblo para su día a día; cada día (`day`) los que no entregaste se cambian por otros.
// código de una pieza = familia * 10 + nivel   (0 = casillero vacío)

import { saveProgress, earnCoins, todayKey } from "./storage.js?v=b28a0715a9";
import { addXp } from "./progression.js?v=b28a0715a9";

export const COLS = 6;
export const ROWS = 8;
export const CELLS = COLS * ROWS;

/** Las familias de productos. `img` = foto real en assets/products; `art` = dibujo hecho a mano (ver merge-art.js). */
export const CHAINS = [
  { id: "alfajor", name: "Alfajores", short: "Alfajor", icon: "🍪", color: 0xd08a3a, tiers: [
    { name: "Galletita", art: "cookie" }, { name: "Alfajor mini", art: "alfmini" },
    { name: "Alfajor de Menta", img: "alf-menta" }, { name: "Alfajor de Naranja", img: "alf-naranja" },
    { name: "Alfajor de Maracuyá", img: "alf-maracuya" }, { name: "Alfajor de Frambuesa", img: "alf-frambuesa" },
    { name: "Caja de alfajores", art: "alfbox", gold: true },
  ] },
  { id: "cuchufli", name: "Cuchuflís", short: "Cuchuflí", icon: "🥖", color: 0xe6b34a, tiers: [
    { name: "Oblea", art: "oblea" }, { name: "Cuchuflí", art: "cuch1" }, { name: "Cuchuflís dúo", art: "cuch2" },
    { name: "Atado de cuchuflís", art: "cuch3" }, { name: "Frasco de cuchuflís", art: "cuchjar" },
    { name: "Torre de cuchuflís", art: "cuchtower", gold: true },
  ] },
  { id: "bombon", name: "Bombones", short: "Bombón", icon: "🍫", color: 0x8a4a5c, tiers: [
    { name: "Grano de cacao", art: "bean" }, { name: "Bombón", art: "bonbon" },
    { name: "Bomba de chocolate", img: "bomba-choco" }, { name: "Caja de bombones", art: "bonbonbox" },
    { name: "Corazón de bombones", art: "heartbox" }, { name: "Bomba Dorada", img: "bomba-dorada", gold: true },
  ] },
  { id: "tableta", name: "Tabletas", short: "Tableta", icon: "🍬", color: 0xd4216c, tiers: [
    { name: "Trocito de chocolate", art: "bar1" }, { name: "Barrita", art: "bar2" }, { name: "Tableta", art: "bar3" },
    { name: "Tableta rellena", art: "bar4" }, { name: "Tableta gigante", art: "bar5" }, { name: "Tableta de oro", art: "bar6", gold: true },
    { name: "¡Mati Dubai!", art: "dubai", gold: true, top: true },
  ] },
];
export const TOTAL_ITEMS = CHAINS.reduce((a, c) => a + c.tiers.length, 0); // 26
export const DUBAI = { c: 3, t: 7 };

export const codeOf = (c, t) => c * 10 + t;
export const chainIdx = (code) => Math.floor(code / 10);
export const tierIdx = (code) => code % 10;
export const maxTier = (c) => CHAINS[c].tiers.length;
export function itemInfo(code) {
  const c = CHAINS[chainIdx(code)];
  const t = tierIdx(code);
  if (!c || !c.tiers[t - 1]) return null;
  return { code, c: chainIdx(code), t, chain: c, ...c.tiers[t - 1], max: c.tiers.length };
}
const validCode = (v) => { const n = Math.floor(Number(v)); return n > 0 && !!itemInfo(n) ? n : 0; };

export function foundCount(m) { return m.bests.reduce((a, b) => a + b, 0); }

export function mergeOf(progress) {
  let m = progress.merge;
  if (!m || typeof m !== "object") m = progress.merge = {};
  if (m.v !== 2) { // formato anterior (una sola cadena): se arma un tablero nuevo, sin perder las entregas
    const keep = Math.floor(Number(m.delivered)) || 0;
    for (const k of Object.keys(m)) delete m[k];
    m.v = 2; m.grid = []; m.delivered = keep;
  }
  if (!Array.isArray(m.grid) || m.grid.length !== CELLS) m.grid = new Array(CELLS).fill(0);
  m.grid = m.grid.map(validCode);
  for (const k of ["delivered", "merges", "spawned"]) { const n = Math.floor(Number(m[k])); m[k] = n > 0 ? n : 0; }
  if (!Array.isArray(m.bests) || m.bests.length !== CHAINS.length) m.bests = new Array(CHAINS.length).fill(0);
  m.bests = m.bests.map((b, i) => Math.max(0, Math.min(maxTier(i), Math.floor(Number(b)) || 0)));
  m.dubai = !!m.dubai;
  // un tablero vacío y recién empezado se llena como en los juegos de merge
  if (m.grid.every((v) => v === 0) && m.spawned === 0 && m.merges === 0) fillStart(m);
  for (const code of m.grid) if (code) m.bests[chainIdx(code)] = Math.max(m.bests[chainIdx(code)], tierIdx(code));
  if (!Array.isArray(m.orders)) m.orders = [];
  const fixed = [];
  for (const o of m.orders.slice(0, 3)) { const f = fixOrder(o, fixed); if (f) fixed.push(f); }
  m.orders = fixed;
  const today = todayKey();
  if (m.day !== today) { m.day = today; m.orders = []; } // día nuevo (o pedidos del formato antiguo): pedidos nuevos
  while (m.orders.length < 3) m.orders.push(newOrder(m, Math.random, m.orders));
  return m;
}

function fillStart(m, rnd = Math.random) {
  const cells = [...Array(CELLS).keys()].sort(() => rnd() - 0.5).slice(0, Math.round(CELLS * 0.8));
  for (const i of cells) {
    const c = Math.floor(rnd() * CHAINS.length);
    const r = rnd();
    m.grid[i] = codeOf(c, r < 0.62 ? 1 : r < 0.92 ? 2 : 3);
  }
}

/** Matipuntos que vale entregar un producto (crece rápido con el nivel). */
export const coinsFor = (t) => Math.round(5 * Math.pow(1.7, t - 1));
export const xpFor = (t) => 4 + t * 3;

/** Los clientes (vecinos del Pueblo, ver js/neighbors.js) y para qué quiere cada uno lo que pide. */
export const CUSTOMERS = [
  { name: "Bombi", why: ["para la once con su abuela", "para decorar su rincón", "para regalarle a Trufita"] },
  { name: "Capi Menta", why: ["para el entrenamiento de la cancha", "para compartir con su equipo", "para el picnic del sábado"] },
  { name: "Don Cuchufli", why: ["para la vitrina de su almacén", "para su colación de la tarde", "para el cumpleaños de su nieta"] },
  { name: "Choco Lola", why: ["para su colección de dulces", "para llevar al colegio", "para una sorpresa"] },
  { name: "Trufita", why: ["para su receta nueva", "para probar en la fábrica", "para la fiesta del curso"] },
  { name: "Mati Cacao", why: ["para recibir a los visitantes", "para el desayuno", "para el paseo al lago"] },
];

/** Un pedido con 1 o 2 productos de un cliente que no esté ya pidiendo. */
function newOrder(m, rnd = Math.random, others = []) {
  const busy = new Set(others.map((o) => o && o.who));
  const free = CUSTOMERS.filter((c) => !busy.has(c.name));
  const cu = (free.length ? free : CUSTOMERS)[Math.floor(rnd() * (free.length || CUSTOMERS.length))];
  const two = rnd() < 0.4;
  const pick = (lower) => {
    const c = Math.floor(rnd() * CHAINS.length);
    const best = Math.max(2, m.bests[c] || 1);
    const hi = Math.min(maxTier(c), best + (lower ? 0 : 1));
    const lo = Math.max(lower ? 1 : 2, hi - 3);
    return { c, t: lo + Math.floor(rnd() * (hi - lo + 1)) };
  };
  const items = [pick(two)];
  if (two) items.push(pick(true));
  const coins = Math.round(items.reduce((a, it) => a + coinsFor(it.t), 0) * (two ? 1.2 : 1));
  const xp = items.reduce((a, it) => a + xpFor(it.t), 0);
  return { who: cu.name, why: cu.why[Math.floor(rnd() * cu.why.length)], items, coins, xp };
}

/** Repara un pedido guardado (o lo convierte desde el formato antiguo {c,t}); si no sirve, uno nuevo. */
function fixOrder(o, others) {
  if (!o || typeof o !== "object") return null;
  let items = Array.isArray(o.items) ? o.items : o.c != null ? [{ c: o.c, t: o.t }] : [];
  items = items.slice(0, 2).map((it) => ({ c: Math.floor(Number(it && it.c)), t: Math.floor(Number(it && it.t)) })).filter((it) => itemInfo(codeOf(it.c, it.t)));
  if (!items.length) return null;
  const busy = new Set(others.map((x) => x && x.who));
  const cu = CUSTOMERS.find((c) => c.name === o.who) || CUSTOMERS.find((c) => !busy.has(c.name)) || CUSTOMERS[0];
  const coins = Math.max(1, Math.floor(Number(o.coins)) || items.reduce((a, it) => a + coinsFor(it.t), 0));
  const xp = Math.max(1, Math.floor(Number(o.xp)) || items.reduce((a, it) => a + xpFor(it.t), 0));
  return { who: cu.name, why: typeof o.why === "string" && o.why ? o.why : cu.why[0], items, coins, xp };
}

/** Nivel del producto que sale de un generador: casi siempre el más chiquito; con el tiempo salen un poco mejores. */
export function spawnTier(m, c, rnd = Math.random) {
  const cap = Math.max(1, Math.min(3, (m.bests[c] || 1) - 2));
  const r = rnd();
  return 1 + (r > 0.72 && cap >= 2 ? 1 : 0) + (r > 0.95 && cap >= 3 ? 1 : 0);
}

export const emptyCells = (m) => m.grid.map((v, i) => (v === 0 ? i : -1)).filter((i) => i >= 0);

/** Un generador de la familia `c` pone una pieza en un casillero libre al azar. Devuelve { cell, code } o null si no cabe. */
export function spawnPiece(progress, c, rnd = Math.random) {
  const m = mergeOf(progress);
  if (!CHAINS[c]) return null;
  const free = emptyCells(m);
  if (!free.length) return null;
  const cell = free[Math.floor(rnd() * free.length)];
  const code = codeOf(c, spawnTier(m, c, rnd));
  m.grid[cell] = code;
  m.spawned++;
  saveProgress(progress);
  return { cell, code };
}

/**
 * Suelta la pieza de `from` sobre `to`: vacío → se mueve · igual → se juntan y suben de nivel · distinta → se intercambian.
 * En "merge" devuelve el código nuevo, si es un producto que nunca habías hecho (record) y una pieza de regalo si salió.
 */
export function dropPiece(progress, from, to, rnd = Math.random) {
  const m = mergeOf(progress);
  if (from === to || !m.grid[from]) return { kind: "none" };
  const a = m.grid[from];
  const b = m.grid[to];
  if (b === 0) {
    m.grid[to] = a; m.grid[from] = 0;
    saveProgress(progress);
    return { kind: "move", from, to };
  }
  const c = chainIdx(a);
  if (a === b && tierIdx(a) < maxTier(c)) {
    const nt = tierIdx(a) + 1;
    const code = codeOf(c, nt);
    m.grid[to] = code; m.grid[from] = 0;
    m.merges++;
    const out = { kind: "merge", from, to, code, tier: nt, chain: c, record: false, gift: null, coins: 0, dubai: false };
    if (nt > m.bests[c]) {
      m.bests[c] = nt;
      out.record = true;
      out.coins = nt * 10;
      earnCoins(progress, out.coins);
      if (nt >= maxTier(c) - 1) progress.packs = (progress.packs || 0) + 1; // los dos últimos de cada familia dan un sobre de figuritas
      if (c === DUBAI.c && nt === DUBAI.t) {
        m.dubai = true; out.dubai = true; out.coins += 1000; earnCoins(progress, 1000); progress.packs = (progress.packs || 0) + 3;
      }
    }
    addXp(progress, 2 + nt);
    // a veces aparece una pieza de regalo (como en los juegos de juntar)
    if (rnd() < 0.18) {
      const free = emptyCells(m);
      if (free.length) { const cell = free[Math.floor(rnd() * free.length)]; m.grid[cell] = codeOf(c, Math.max(1, Math.min(3, nt - 3))); out.gift = cell; }
    }
    saveProgress(progress);
    return out;
  }
  m.grid[to] = a; m.grid[from] = b;
  saveProgress(progress);
  return { kind: "swap", from, to };
}

/** Casilleros del tablero con los productos de un pedido (uno distinto por producto), o null si falta alguno. */
export function orderCells(m, o) {
  if (!o) return null;
  const used = [];
  for (const it of o.items) {
    const code = codeOf(it.c, it.t);
    const cell = m.grid.findIndex((v, i) => v === code && !used.includes(i));
    if (cell < 0) return null;
    used.push(cell);
  }
  return used;
}

/** Qué productos de un pedido ya están en el tablero (para marcarlos con ✓). */
export function orderHave(m, o) {
  const used = [];
  return o.items.map((it) => {
    const code = codeOf(it.c, it.t);
    const cell = m.grid.findIndex((v, i) => v === code && !used.includes(i));
    if (cell >= 0) used.push(cell);
    return cell >= 0;
  });
}

/** Entrega el pedido número `idx` con los productos del tablero. Devuelve null si falta alguno. */
export function deliverOrder(progress, idx, rnd = Math.random) {
  const m = mergeOf(progress);
  const o = m.orders[idx];
  const cells = orderCells(m, o);
  if (!cells) return null;
  for (const c of cells) m.grid[c] = 0;
  m.delivered++;
  earnCoins(progress, o.coins);
  addXp(progress, o.xp);
  let pack = false;
  if (m.delivered % 5 === 0) { progress.packs = (progress.packs || 0) + 1; pack = true; } // cada 5 entregas, un sobre
  const done = { ...o, cells, cell: cells[0], pack };
  m.orders[idx] = newOrder(m, rnd, m.orders.filter((_, i) => i !== idx));
  saveProgress(progress);
  return done;
}

export const canDeliver = (m, idx) => !!orderCells(m, m.orders[idx]);
