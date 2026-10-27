// Eventos de temporada: durante unas semanas el pueblo cambia de decoración, aparecen cositas
// del evento para juntar (fichas) y se pueden comprar objetos exclusivos en el Vestuario.
// Las fichas son solo del evento y se ganan jugando: no hay compras con dinero.
//
// Para probar un evento fuera de fecha: agregar ?event=halloween (o navidad, sanvalentin,
// pascua, patrias, dianino) a la dirección.

import { saveProgress } from "./storage.js?v=c7f11ecb8c";
import { getItem } from "./wardrobe-data.js?v=c7f11ecb8c";

const day = (y, m, d) => new Date(y, m - 1, d);

function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), dd = ((h + l - 7 * m + 114) % 31) + 1;
  return day(y, month, dd);
}

export const EVENTS = [
  {
    id: "sanvalentin", name: "Amor de Chocolate", icon: "💝", token: "💖",
    range: (y) => [day(y, 2, 7), day(y, 2, 16)],
    colors: [0xff3b6b, 0xff9ab8, 0xffffff], tint: 0xffc0d8, weather: "hearts", collect: "heart",
    blurb: "Junta corazones por el pueblo y consigue objetos exclusivos de San Valentín.",
  },
  {
    id: "pascua", name: "Huevos de Chocolate", icon: "🥚", token: "🥚",
    range: (y) => { const e = easter(y); return [new Date(e.getTime() - 10 * 864e5), new Date(e.getTime() + 2 * 864e5)]; },
    colors: [0xff9ab8, 0xffe14a, 0x9fe8ff, 0xb9f0a8], tint: 0xfff0b0, weather: "confetti", collect: "egg",
    blurb: "¡Busca los huevos de chocolate escondidos en el pueblo!",
  },
  {
    id: "patrias", name: "Fiestas Patrias", icon: "🪁", token: "🪁",
    range: (y) => [day(y, 9, 10), day(y, 9, 22)],
    colors: [0xd52b1e, 0xffffff, 0x0039a6], tint: 0xdbe8ff, weather: "confetti", collect: "kite",
    blurb: "Volantines, banderines y fiesta: junta volantines y gana premios.",
  },
  {
    id: "dianino", name: "Día de las Niñas y Niños", icon: "🎈", token: "🎈",
    range: (y) => [day(y, 8, 5), day(y, 8, 16)],
    colors: [0xff3b6b, 0xffe14a, 0x4fd0ff, 0x9a5cff, 0x4fd09a], tint: 0xffffff, weather: "confetti", collect: "balloon",
    blurb: "¡Hoy es tu día! Junta globos y consigue regalos exclusivos.",
  },
  {
    id: "halloween", name: "Noche de Cacao", icon: "🎃", token: "🎃",
    range: (y) => [day(y, 10, 20), day(y, 11, 2)],
    colors: [0xff8a2a, 0x9a5cff, 0x2a1840], tint: 0xffb070, weather: "embers", collect: "pumpkin",
    blurb: "Calabazas por todo el pueblo: junta las que encuentres y gana disfraces.",
  },
  {
    id: "navidad", name: "Navidad Chocolatera", icon: "🎄", token: "🎁",
    range: (y) => [day(y, 12, 1), day(y, 12, 31)],
    colors: [0xe83a3a, 0xffffff, 0x2f9a4a], tint: 0xd8ecff, weather: "snow", collect: "gift",
    blurb: "Nieve en el pueblo y regalos escondidos: junta regalos y gana premios de Navidad.",
  },
];

const byId = Object.fromEntries(EVENTS.map((e) => [e.id, e]));
export const eventById = (id) => byId[id] || null;

function forcedEvent() {
  try {
    return new URLSearchParams(location.search).get("event");
  } catch (e) {
    return null;
  }
}

/** El evento que está pasando hoy (o null). Con ?event=nombre se fuerza uno para probarlo. */
export function activeEvent(now = new Date()) {
  const forced = forcedEvent();
  if (forced && byId[forced]) return byId[forced];
  const t = now.getTime();
  for (const e of EVENTS) {
    const [a, b] = e.range(now.getFullYear());
    if (t >= a.getTime() && t < b.getTime() + 864e5) return e;
  }
  return null;
}

/** Fecha de término del evento activo (para decir "hasta el 02/11"). */
export function eventEnd(e, now = new Date()) {
  return e.range(now.getFullYear())[1];
}

/** El próximo evento y en cuántos días empieza. */
export function nextEvent(now = new Date()) {
  let best = null;
  for (const e of EVENTS) {
    for (const y of [now.getFullYear(), now.getFullYear() + 1]) {
      const [a] = e.range(y);
      const days = Math.ceil((a.getTime() - now.getTime()) / 864e5);
      if (days > 0 && (!best || days < best.days)) best = { event: e, days };
    }
  }
  return best;
}

// ---------- fichas ----------

export function eventTokens(progress, id) {
  return (progress.eventTokens || {})[id] || 0;
}

export function addEventTokens(progress, id, n) {
  progress.eventTokens = progress.eventTokens || {};
  progress.eventTokens[id] = (progress.eventTokens[id] || 0) + n;
  saveProgress(progress);
}

/** ¿Se puede comprar ahora este objeto de evento? */
export function eventItemAvailable(item) {
  const e = activeEvent();
  return !!(item.event && e && e.id === item.event);
}

/** Compra un objeto exclusivo con las fichas del evento (solo mientras el evento está activo). */
export function buyEventItem(progress, itemId) {
  const item = getItem(itemId);
  if (!item || !item.event || progress.wardrobe.owned.includes(itemId) || !eventItemAvailable(item)) return false;
  const have = eventTokens(progress, item.event);
  if (have < item.tokens) return false;
  progress.eventTokens[item.event] = have - item.tokens;
  progress.wardrobe.owned.push(itemId);
  saveProgress(progress);
  return true;
}
