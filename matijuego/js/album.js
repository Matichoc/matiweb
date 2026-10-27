// Álbum de figuritas: 6 páginas de 12 figuritas + 24 brillantes (96 en total). Los sobres traen 3 figuritas al azar
// (sin "siempre una nueva": completar el álbum cuesta). Las repetidas se pueden vender por Matipuntos o juntar en el
// «taller» para cambiarlas por la figurita que te falta (12 repetidas; una brillante, 36).
// Los ids de la primera página y de sus brillantes (con "*") son los del álbum anterior: el avance de antes se conserva.
// Temporadas: durante cada evento (js/events.js) aparece su página de 12 figuritas + 2 brillantes, que solo salen en los
// sobres mientras dura el evento (y vuelven el año siguiente). Completarla da Matipuntos y fichas del evento.
// Kiosco: una figurita que falte se puede comprar con Matipuntos a precio alto (las de temporada, solo durante su evento).
import { earnCoins, spendCoins, saveProgress } from "./storage.js?v=73aaf47357";
import { activeEvent, addEventTokens } from "./events.js?v=73aaf47357";

const P = (id, name, emoji, color) => ({ id, name, emoji, color });
const PRODUCT_PAGE = [
  ["alf-tradicional", "Alfajor Tradicional"], ["alf-frambuesa", "Alfajor Frambuesa"], ["alf-menta", "Alfajor Menta"],
  ["alf-naranja", "Alfajor Naranja"], ["alf-trufa", "Alfajor Trufa"], ["alf-maracuya", "Alfajor Maracuyá"],
  ["alf-almendra", "Alfajor Almendra"], ["alf-capuchino", "Alfajor Capuchino"], ["alf-pie-limon", "Alfajor Pie de Limón"],
  ["bomba-choco", "Bomba de Chocolate"], ["bomba-dorada", "Bomba Dorada"], ["cuchufli", "Cuchufli"],
].map(([id, name]) => ({ id, name, img: `assets/products/${id}.jpg`, emoji: "🍫", color: "#7a3f22" }));

export const PAGES = [
  { id: "prod", title: "Alfajores y bombas", icon: "🍫", reward: 40, items: PRODUCT_PAGE },
  { id: "gente", title: "Matichicos y vecinos", icon: "🧑‍🤝‍🧑", reward: 40, items: [
    P("ch-capitan", "Matichico", "🧒", "#c0392b"), P("ch-estrella", "Chocolatina", "👧", "#d4216c"), P("ch-baller", "Matichico Baller", "⚽", "#2c6fb7"),
    P("ch-cheer", "Chocolatina Cheer", "📣", "#8e44ad"), P("nb-pepe", "Don Pepe", "👨‍🎨", "#e08a1e"), P("nb-rosa", "Doña Rosa", "👩‍🌾", "#2fa86a"),
    P("nb-beto", "Beto el Barrendero", "🧹", "#3b8cff"), P("nb-flora", "Flora la Jardinera", "🌷", "#d4216c"), P("nb-lola", "Lola", "👧", "#ff7a1a"),
    P("nb-tita", "Abuelita Tita", "👵", "#9a5cff"), P("nb-ana", "Ana la Chocolatera", "👩‍🍳", "#7a3f22"), P("nb-rayo", "Piloto Rayo", "🏎️", "#e03a3a") ] },
  { id: "lugares", title: "Lugares", icon: "🏙️", reward: 40, items: [
    P("lg-fabrica", "La Fábrica", "🏭", "#7a3f22"), P("lg-plaza", "La Plaza", "⛲", "#3b8cff"), P("lg-parque", "El Parque", "🌳", "#2fa86a"),
    P("lg-huerto", "El Huerto", "🍎", "#c0392b"), P("lg-panaderia", "La Panadería", "🥐", "#e08a1e"), P("lg-kiosco", "El Kiosco", "🏪", "#d4216c"),
    P("lg-cancha", "La Cancha", "🏟️", "#2fa86a"), P("lg-gimnasio", "El Gimnasio", "🏀", "#ff7a1a"), P("lg-cielo", "El Cielo", "☁️", "#4fb8e8"),
    P("lg-pista", "La Pista", "🛣️", "#53535c"), P("lg-pueblo", "El Pueblo", "🏘️", "#c4572b"), P("lg-casa", "Mi Casa", "🏠", "#d4216c") ] },
  { id: "ingred", title: "Ingredientes", icon: "🌿", reward: 40, items: [
    P("in-cacao", "Cacao", "🫘", "#5a2d16"), P("in-vainilla", "Vainilla", "🌼", "#e0b400"), P("in-almendra", "Almendra", "🌰", "#9a6a3a"),
    P("in-frambuesa", "Frambuesa", "🍓", "#d4216c"), P("in-menta", "Menta", "🌿", "#2fd08a"), P("in-maracuya", "Maracuyá", "🥭", "#f7a600"),
    P("in-naranja", "Naranja", "🍊", "#ff7a1a"), P("in-limon", "Limón", "🍋", "#d9c200"), P("in-cafe", "Café", "☕", "#6b3d22"),
    P("in-leche", "Leche", "🥛", "#7fb8e8"), P("in-azucar", "Azúcar", "🧂", "#a0a0b0"), P("in-trufa", "Trufa", "🍫", "#3a1c0e") ] },
  { id: "juegos", title: "Los juegos", icon: "🎮", reward: 40, items: [
    P("jg-parkour", "Parkour Choco", "🧗", "#3aa84a"), P("jg-recolecta", "Recolecta y Corre", "🏃", "#2c6fb7"), P("jg-salto", "Salto Choco", "🦘", "#4fb8e8"),
    P("jg-autos", "Autos de Chocolate", "🏎️", "#e03a3a"), P("jg-tetris", "Bloques de Productos", "🧱", "#8e44ad"), P("jg-memoria", "Memoria Matichoc", "🧠", "#d4216c"),
    P("jg-basquet", "Básquet", "🏀", "#ff7a1a"), P("jg-porristas", "Porristas", "🤸", "#d4216c"), P("jg-futbol", "Fútbol Choco", "⚽", "#2fa86a"),
    P("jg-match", "Choco Match", "🍬", "#7a3f22"), P("jg-aventura", "Aventura Choco", "🍄", "#e03a3a"), P("jg-ciudad", "Ciudad Choco", "🌆", "#3b8cff") ] },
  { id: "cosas", title: "Cosas geniales", icon: "🎒", reward: 40, items: [
    P("cs-medalla", "Medalla", "🏅", "#e0b400"), P("cs-copa", "Copa", "🏆", "#e0b400"), P("cs-brocha", "Brocha mágica", "🎨", "#d4216c"),
    P("cs-manzana", "Manzana", "🍎", "#c0392b"), P("cs-patines", "Patines", "🛼", "#9a5cff"), P("cs-monopatin", "Monopatín cohete", "🛹", "#ff7a1a"),
    P("cs-jetpack", "Jetpack", "🚀", "#3b8cff"), P("cs-iman", "Imán", "🧲", "#e03a3a"), P("cs-escudo", "Escudo", "🛡️", "#2c6fb7"),
    P("cs-corona", "Corona", "👑", "#e0b400"), P("cs-estrella", "Estrella", "⭐", "#e0b400"), P("cs-regalo", "Regalo", "🎁", "#d4216c") ] },
];

// brillantes: las 12 de la primera página (como antes) + 12 especiales
const FOIL_BASE = [...PRODUCT_PAGE.map((s) => s.id), "ch-capitan", "ch-estrella", "lg-fabrica", "lg-cielo", "in-cacao", "in-vainilla", "jg-parkour", "jg-ciudad", "cs-copa", "cs-corona"];
const SPECIAL_FOILS = [
  { id: "logo*", name: "Logo de Matichoc brillante", img: "assets/brand/logo-badge.png", logo: true, emoji: "🌟", color: "#d4216c", page: "cosas", foil: true },
  { id: "oro*", name: "Sello de Cacao de Oro", emoji: "🥇", color: "#e0b400", page: "cosas", foil: true },
];

/** Todas las figuritas: normales (72) y brillantes (24). */
export const STICKERS = [
  ...PAGES.flatMap((pg) => pg.items.map((s) => ({ ...s, page: pg.id, foil: false }))),
  ...FOIL_BASE.map((id) => {
    const base = PAGES.flatMap((pg) => pg.items.map((s) => ({ ...s, page: pg.id }))).find((s) => s.id === id);
    return { ...base, id: `${id}*`, name: `${base.name} brillante`, foil: true };
  }),
  ...SPECIAL_FOILS,
];
export const TOTAL = STICKERS.length;

// ---------- páginas de temporada ----------
const SEASON_DEFS = {
  sanvalentin: ["💝", "Amor de Chocolate", "#d4216c", [["corazon", "Corazón de cacao", "💝"], ["bombon", "Bombón de amor", "💘"], ["carta", "Carta de amor", "💌"], ["rosa", "Rosa", "🌹"], ["osito", "Osito", "🧸"], ["abrazo", "Abrazo", "🫂"], ["globo", "Globo corazón", "🎈"], ["anillo", "Anillo de caramelo", "💍"], ["cupido", "Flecha de Cupido", "🏹"], ["chocolatina", "Chocolatina enamorada", "🥰"], ["bombones", "Caja de bombones", "🎁"], ["paloma", "Paloma", "🕊️"]]],
  pascua: ["🥚", "Huevos de Chocolate", "#9a5cff", [["huevo", "Huevo de chocolate", "🥚"], ["conejo", "Conejo", "🐰"], ["canasta", "Canasta", "🧺"], ["pollito", "Pollito", "🐣"], ["zanahoria", "Zanahoria", "🥕"], ["tulipan", "Tulipán", "🌷"], ["huella", "Huellas de conejo", "🐾"], ["mariposa", "Mariposa", "🦋"], ["arcoiris", "Arcoíris", "🌈"], ["cesped", "Pasto escondite", "🌱"], ["lazo", "Lazo", "🎀"], ["sol", "Sol de otoño", "🌤️"]]],
  patrias: ["🪁", "Fiestas Patrias", "#c0392b", [["volantin", "Volantín", "🪁"], ["empanada", "Empanada", "🥟"], ["panuelo", "Pañuelo de cueca", "🧣"], ["trompo", "Trompo", "🌀"], ["guitarra", "Guitarra", "🎸"], ["caballo", "Caballo", "🐴"], ["sombrero", "Sombrero de huaso", "🤠"], ["ramada", "Ramada", "🏕️"], ["anticucho", "Anticucho", "🍢"], ["copihue", "Copihue", "🌺"], ["estrella", "Estrella solitaria", "⭐"], ["fuegos", "Fuegos artificiales", "🎆"]]],
  dianino: ["🎈", "Día de las Niñas y Niños", "#ff7a1a", [["globo", "Globo", "🎈"], ["regalo", "Regalo", "🎁"], ["torta", "Torta", "🎂"], ["pelota", "Pelota", "⚽"], ["burbujas", "Burbujas", "🫧"], ["pinata", "Piñata", "🪅"], ["cohete", "Cohete", "🚀"], ["dino", "Dinosaurio", "🦖"], ["unicornio", "Unicornio", "🦄"], ["cometa", "Cometa", "☄️"], ["bloques", "Bloques", "🧩"], ["corona", "Corona de cumpleaños", "👑"]]],
  halloween: ["🎃", "Noche de Cacao", "#e86a10", [["calabaza", "Calabaza", "🎃"], ["fantasma", "Fantasma", "👻"], ["murcielago", "Murciélago", "🦇"], ["gato", "Gato negro", "🐈‍⬛"], ["bruja", "Sombrero de bruja", "🧙"], ["escoba", "Escoba voladora", "🧹"], ["arana", "Arañita", "🕷️"], ["luna", "Luna llena", "🌕"], ["dulces", "Dulces", "🍬"], ["vampiro", "Vampiro", "🧛"], ["vela", "Vela", "🕯️"], ["telarana", "Telaraña", "🕸️"]]],
  navidad: ["🎄", "Navidad Chocolatera", "#2fa86a", [["arbol", "Arbolito", "🎄"], ["pascuero", "Viejito Pascuero", "🎅"], ["regalo", "Regalo", "🎁"], ["reno", "Reno", "🦌"], ["estrella", "Estrella", "⭐"], ["calcetin", "Calcetín", "🧦"], ["campana", "Campana", "🔔"], ["galleta", "Galleta de jengibre", "🍪"], ["mono", "Mono de nieve", "⛄"], ["trineo", "Trineo", "🛷"], ["vela", "Vela", "🕯️"], ["pandepascua", "Pan de pascua", "🍞"]]],
};
export const SEASON_REWARD = 300; // Matipuntos por completar la página de temporada
export const SEASON_TOKENS = 30; // ... y fichas del evento (para sus objetos exclusivos)
export const SEASON_CHANCE = 0.4; // en cada figurita del sobre, durante el evento, probabilidad de que sea de temporada
/** Páginas de temporada: { id: "t-halloween", event, title, icon, items } */
export const SEASON_PAGES = Object.entries(SEASON_DEFS).map(([event, [icon, title, color, items]]) => ({
  id: `t-${event}`, event, title, icon, reward: SEASON_REWARD,
  items: items.map(([k, name, emoji]) => ({ id: `t:${event}:${k}`, name, emoji, color })),
}));
/** Figuritas de temporada: las 12 de cada página + 2 brillantes (las dos primeras). */
export const SEASON_STICKERS = SEASON_PAGES.flatMap((pg) => [
  ...pg.items.map((x) => ({ ...x, page: pg.id, event: pg.event, foil: false })),
  ...pg.items.slice(0, 2).map((x) => ({ ...x, id: `${x.id}*`, name: `${x.name} brillante`, page: pg.id, event: pg.event, foil: true })),
]);
const ALL = [...STICKERS, ...SEASON_STICKERS];
export const stickerById = (id) => ALL.find((s) => s.id === id) || null;
/** La página de temporada del evento activo (o null). */
export const activeSeasonPage = () => { const e = activeEvent(); return e ? SEASON_PAGES.find((pg) => pg.event === e.id) || null : null; };
/** ¿Esta figurita se puede conseguir ahora? (las de temporada, solo durante su evento) */
export const obtainable = (s) => !s.event || (activeEvent() || {}).id === s.event;

export const FOIL_CHANCE = 0.1;
export const SELL_NORMAL = 1; // Matipuntos por cada repetida
export const SELL_FOIL = 6;
export const TRADE_NORMAL = 12; // repetidas para cambiar por una figurita normal que falte
export const TRADE_FOIL = 36; // ... o por una brillante (una brillante repetida vale 3)
const FOIL_VALUE = 3;

const albumOf = (p) => (p.album = p.album || {});
export const albumCount = (progress) => STICKERS.filter((s) => (progress.album || {})[s.id] > 0).length;
export const pageStatus = (progress, pg) => {
  const list = ALL.filter((s) => s.page === pg.id);
  return { have: list.filter((s) => (progress.album || {})[s.id] > 0).length, total: list.length };
};

export const ALBUM_MILESTONES = [
  { at: 6, coins: 50, text: "6 figuritas" },
  { at: 12, coins: 100, item: "hat_chef", text: "12 figuritas" },
  { at: 18, coins: 150, text: "18 figuritas" },
  { at: 24, coins: 300, item: "back_cacao", text: "24 figuritas" },
  { at: 36, coins: 150, text: "36 figuritas" },
  { at: 48, coins: 200, text: "48 figuritas" },
  { at: 60, coins: 250, text: "60 figuritas" },
  { at: 72, coins: 300, text: "72 figuritas" },
  { at: 84, coins: 400, text: "84 figuritas" },
  { at: 96, coins: 800, text: "¡Álbum completo!" },
];

function claimRewards(progress) {
  progress.albumClaimed = progress.albumClaimed || [];
  const have = albumCount(progress);
  const rewards = [];
  for (const m of ALBUM_MILESTONES) {
    if (have >= m.at && !progress.albumClaimed.includes(m.at)) {
      progress.albumClaimed.push(m.at);
      earnCoins(progress, m.coins);
      if (m.item && !progress.wardrobe.owned.includes(m.item)) progress.wardrobe.owned.push(m.item);
      rewards.push({ text: m.text, coins: m.coins, item: m.item });
    }
  }
  for (const pg of PAGES) {
    const key = `page:${pg.id}`;
    const st = pageStatus(progress, pg);
    if (st.have >= st.total && !progress.albumClaimed.includes(key)) {
      progress.albumClaimed.push(key);
      earnCoins(progress, pg.reward);
      rewards.push({ text: `Página «${pg.title}» completa`, coins: pg.reward });
    }
  }
  for (const pg of SEASON_PAGES) {
    const key = `page:${pg.id}`;
    const st = pageStatus(progress, pg);
    if (st.have >= st.total && !progress.albumClaimed.includes(key)) {
      progress.albumClaimed.push(key);
      earnCoins(progress, pg.reward);
      addEventTokens(progress, pg.event, SEASON_TOKENS);
      rewards.push({ text: `Página de temporada «${pg.title}» completa (+${SEASON_TOKENS} fichas)`, coins: pg.reward });
    }
  }
  return rewards;
}

/** Abre un sobre: 3 figuritas al azar (el 10 % son brillantes; durante un evento, el 40 % son de su página). */
export function openPack(progress) {
  if ((progress.packs || 0) <= 0) return null;
  progress.packs--;
  progress.stats.packsOpened = (progress.stats.packsOpened || 0) + 1;
  const album = albumOf(progress);
  const normals = STICKERS.filter((s) => !s.foil);
  const foils = STICKERS.filter((s) => s.foil);
  const season = activeSeasonPage();
  const sNormals = season ? SEASON_STICKERS.filter((s) => s.page === season.id && !s.foil) : [];
  const sFoils = season ? SEASON_STICKERS.filter((s) => s.page === season.id && s.foil) : [];
  const out = [];
  for (let i = 0; i < 3; i++) {
    const fromSeason = season && Math.random() < SEASON_CHANCE;
    const foil = Math.random() < FOIL_CHANCE;
    const pool = fromSeason ? (foil ? sFoils : sNormals) : foil ? foils : normals;
    const s = pool[Math.floor(Math.random() * pool.length)];
    const isNew = !(album[s.id] > 0) && !out.some((o) => o.id === s.id);
    album[s.id] = (album[s.id] || 0) + 1;
    out.push({ ...s, isNew });
  }
  const rewards = claimRewards(progress);
  saveProgress(progress);
  return { stickers: out, rewards };
}

// ---------- repetidas ----------

/** Repetidas de cada figurita (copias de más). */
export const spareOf = (progress, s) => Math.max(0, ((progress.album || {})[s.id] || 0) - 1);
/** "Puntos de repetidas": una normal vale 1, una brillante 3 (sirve para el taller). */
export function sparePoints(progress) {
  return ALL.reduce((a, s) => a + spareOf(progress, s) * (s.foil ? FOIL_VALUE : 1), 0);
}
export function sellValue(progress) {
  return ALL.reduce((a, s) => a + spareOf(progress, s) * (s.foil ? SELL_FOIL : SELL_NORMAL), 0);
}
export const spareCount = (progress) => ALL.reduce((a, s) => a + spareOf(progress, s), 0);

/** Vende todas las repetidas por Matipuntos (se queda una de cada figurita). */
export function sellSpares(progress) {
  const coins = sellValue(progress);
  if (coins <= 0) return null;
  const album = albumOf(progress);
  let n = 0;
  for (const s of ALL) {
    const sp = spareOf(progress, s);
    if (sp) { n += sp; album[s.id] -= sp; }
  }
  earnCoins(progress, coins);
  progress.stats.albumSold = (progress.stats.albumSold || 0) + coins;
  saveProgress(progress);
  return { coins, n };
}

export const tradeCost = (s) => (s.foil ? TRADE_FOIL : TRADE_NORMAL);

/** Taller: cambia repetidas por la figurita que te falta. */
export function tradeFor(progress, id) {
  const s = stickerById(id);
  const album = albumOf(progress);
  if (!s || album[id] > 0 || !obtainable(s)) return null;
  const cost = tradeCost(s);
  if (sparePoints(progress) < cost) return null;
  let need = cost;
  // se gastan primero las que más repetidas tienen
  const list = ALL.filter((x) => spareOf(progress, x) > 0).sort((a, b) => spareOf(progress, b) - spareOf(progress, a));
  for (const x of list) {
    const v = x.foil ? FOIL_VALUE : 1;
    while (need > 0 && spareOf(progress, x) > 0) { album[x.id]--; need -= v; }
    if (need <= 0) break;
  }
  album[id] = 1;
  const rewards = claimRewards(progress);
  saveProgress(progress);
  return { sticker: s, rewards };
}

// ---------- kiosco: comprar la figurita que falta ----------

export const BUY_NORMAL = 400; // Matipuntos por una figurita normal que falte (≈ un día y algo de juego)
export const BUY_FOIL = 1200; // ... por una brillante
export const buyCost = (s) => (s.foil ? BUY_FOIL : BUY_NORMAL);

/** Compra una figurita que falta con Matipuntos (las de temporada, solo durante su evento). */
export function buySticker(progress, id) {
  const s = stickerById(id);
  const album = albumOf(progress);
  if (!s || album[id] > 0 || !obtainable(s)) return null;
  if (!spendCoins(progress, buyCost(s))) return null;
  album[id] = 1;
  progress.stats.albumBought = (progress.stats.albumBought || 0) + 1;
  const rewards = claimRewards(progress);
  saveProgress(progress);
  return { sticker: s, rewards };
}
