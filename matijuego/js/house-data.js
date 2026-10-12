// Mi Casa: un cuarto que se decora con Matipuntos. Cada "lugar" del cuarto (piso, paredes,
// alfombra, cama, rincones, cuadros y techo) tiene sus objetos; se compran una vez y se
// pueden cambiar cuando se quiera. Los modelos 3D están en js/house3d.js.
//
// Objeto: { id, spot, name, icon, rarity, price, params }   (price 0 = viene con la casa)

import { spendCoins, saveProgress } from "./storage.js?v=f2916d806a";

export const HOUSE_SPOTS = [
  { id: "floor", name: "Piso", icon: "🟫" },
  { id: "wall", name: "Paredes", icon: "🎨" },
  { id: "rug", name: "Alfombra", icon: "🟣" },
  { id: "bed", name: "Cama", icon: "🛏️" },
  { id: "left", name: "Rincón izq.", icon: "🪴" },
  { id: "right", name: "Rincón der.", icon: "💡" },
  { id: "wallL", name: "Pared izq.", icon: "🖼️" },
  { id: "wallC", name: "Pared centro", icon: "📺" },
  { id: "wallR", name: "Pared der.", icon: "🪟" },
  { id: "ceiling", name: "Techo", icon: "🎈" },
  { id: "free", name: "Muebles", icon: "🛋️" }, // muebles nuevos que se ponen donde quieras
];

const P = { comun: 30, raro: 110, epico: 260, legendario: 520 };
const it = (spot, id, name, icon, rarity, params = {}, price) => ({ id, spot, name, icon, rarity, price: price ?? P[rarity], params });

export const HOUSE_ITEMS = [
  // ---- Piso ----
  it("floor", "fl_madera", "Madera clara", "🟫", "comun", { style: "madera", a: "#d9a066", b: "#c98a4b" }, 0),
  it("floor", "fl_damero", "Damero rosa", "🏁", "comun", { style: "damero", a: "#ff8ab8", b: "#fff6e6" }),
  it("floor", "fl_cesped", "Césped", "🌿", "comun", { style: "cesped", a: "#7cc65a", b: "#5fb046" }),
  it("floor", "fl_choco", "Barras de chocolate", "🍫", "raro", { style: "choco", a: "#6b3a22", b: "#4a2412" }),
  it("floor", "fl_nubes", "Piso de nubes", "☁️", "raro", { style: "nubes", a: "#a8d8ff", b: "#ffffff" }),
  it("floor", "fl_galaxia", "Piso galaxia", "🌌", "epico", { style: "galaxia", a: "#1a1040", b: "#9a5cff" }),
  // ---- Paredes ----
  it("wall", "wl_crema", "Crema", "🤍", "comun", { style: "liso", a: "#fff1d6", b: "#f5dfb8" }, 0),
  it("wall", "wl_rosa", "Rosa chicle", "🩷", "comun", { style: "liso", a: "#ffc2dc", b: "#ff9ec6" }),
  it("wall", "wl_menta", "Menta", "💚", "comun", { style: "liso", a: "#c6f1de", b: "#9fe3c4" }),
  it("wall", "wl_cielo", "Cielo", "💙", "comun", { style: "liso", a: "#c8e6ff", b: "#9fd0ff" }),
  it("wall", "wl_rayas", "Rayas dulces", "🍬", "raro", { style: "rayas", a: "#ffb3d1", b: "#fff6e6" }),
  it("wall", "wl_lunares", "Lunares", "🔴", "raro", { style: "lunares", a: "#fff6e6", b: "#d4216c" }),
  it("wall", "wl_flores", "Jardín de flores", "🌸", "comun", { style: "flores", a: "#e9f7d8", b: "#7cc65a" }),
  it("wall", "wl_corazones", "Corazones", "💕", "raro", { style: "corazones", a: "#ffd9e8", b: "#ff6f9f" }),
  it("wall", "wl_nubes", "Cielo con nubes", "⛅", "raro", { style: "nubes", a: "#9fd6ff", b: "#ffffff" }),
  it("wall", "wl_ladrillos", "Ladrillos de chocolate", "🧱", "raro", { style: "ladrillos", a: "#8a4b2c", b: "#5a2d16" }),
  it("wall", "wl_estrellas", "Noche estrellada", "🌙", "epico", { style: "estrellas", a: "#1c1a4a", b: "#ffd34d" }),
  // ---- Alfombra ----
  it("rug", "rg_redonda", "Alfombra rosa", "🟣", "comun", { kind: "redonda", a: "#ff7aa8", b: "#ffd1e3" }),
  it("rug", "rg_arcoiris", "Arcoíris", "🌈", "raro", { kind: "arcoiris" }),
  it("rug", "rg_estrella", "Estrella dorada", "⭐", "raro", { kind: "estrella", a: "#ffc800", b: "#fff1a8" }),
  it("rug", "rg_corazon", "Corazón", "❤️", "raro", { kind: "corazon", a: "#e83a6a", b: "#ff9ab8" }),
  it("rug", "rg_alfajor", "Alfajor gigante", "🍪", "epico", { kind: "alfajor" }),
  // ---- Cama ----
  it("bed", "bd_simple", "Cama azul", "🛏️", "comun", { kind: "simple", a: "#6ab0ff", b: "#fff6e6" }),
  it("bed", "bd_rosa", "Cama de corazones", "🛏️", "comun", { kind: "simple", a: "#ff7aa8", b: "#fff6e6" }),
  it("bed", "bd_nube", "Cama nube", "☁️", "raro", { kind: "nube" }),
  it("bed", "bd_cohete", "Cama cohete", "🚀", "epico", { kind: "cohete" }),
  it("bed", "bd_alfajor", "Cama alfajor", "🍪", "epico", { kind: "alfajor" }),
  // ---- Rincón izquierdo ----
  it("left", "lf_planta", "Planta grande", "🪴", "comun", { kind: "planta" }),
  it("left", "lf_escritorio", "Escritorio", "💻", "raro", { kind: "escritorio" }),
  it("left", "lf_estanteria", "Estantería de golosinas", "📚", "raro", { kind: "estanteria" }),
  it("left", "lf_oso", "Oso de peluche gigante", "🧸", "epico", { kind: "oso" }),
  it("left", "lf_arcade", "Máquina arcade", "🕹️", "legendario", { kind: "arcade" }),
  // ---- Rincón derecho ----
  it("right", "rt_lampara", "Lámpara de pie", "💡", "comun", { kind: "lampara" }),
  it("right", "rt_flores", "Maceta con flores", "🌼", "comun", { kind: "flores" }),
  it("right", "rt_cacao", "Árbol de cacao", "🌳", "raro", { kind: "cacao" }),
  it("right", "rt_cofre", "Cofre del tesoro", "🧰", "epico", { kind: "cofre" }),
  it("right", "rt_fuente", "Mini fuente de chocolate", "⛲", "legendario", { kind: "fuente" }),
  // ---- Pared izquierda ----
  it("wallL", "wl1_ventana", "Ventana soleada", "🪟", "comun", { kind: "ventana", a: "#9fd8ff" }),
  it("wallL", "wl1_reloj", "Reloj", "🕒", "comun", { kind: "reloj" }),
  it("wallL", "wl1_poster", "Póster Matichoc", "🖼️", "raro", { kind: "poster", a: "#d4216c", icon: "M" }),
  it("wallL", "wl1_estrellas", "Estrellas brillantes", "✨", "raro", { kind: "estrellas" }),
  it("wallL", "wl1_ventana_noche", "Ventana de noche", "🌃", "epico", { kind: "ventana", a: "#1c1a4a", night: true }),
  // ---- Pared centro ----
  it("wallC", "wc_cuadro", "Cuadro del Matichico", "🎨", "comun", { kind: "cuadro" }),
  it("wallC", "wc_arcoiris", "Arcoíris pintado", "🌈", "comun", { kind: "arcoiris" }),
  it("wallC", "wc_trofeos", "Repisa de trofeos", "🏆", "raro", { kind: "trofeos" }),
  it("wallC", "wc_tv", "Pantalla gigante", "📺", "epico", { kind: "tv" }),
  it("wallC", "wc_neon", "Letrero neón", "💗", "legendario", { kind: "neon" }),
  // ---- Pared derecha ----
  it("wallR", "wr_ventana", "Ventana con cortinas", "🪟", "comun", { kind: "ventana", a: "#bfe6ff", curtains: true }),
  it("wallR", "wr_alfajores", "Póster de alfajores", "🍪", "comun", { kind: "poster", a: "#ffd34d", icon: "🍪" }),
  it("wallR", "wr_corazones", "Corazones", "💕", "raro", { kind: "corazones" }),
  it("wallR", "wr_repisa", "Repisa de plantas", "🌱", "raro", { kind: "repisa" }),
  it("wallR", "wr_luces", "Guirnalda de luces", "💫", "epico", { kind: "luces" }),
  // ---- Muebles nuevos (se colocan donde quieras) ----
  it("free", "fr_sofa", "Sillón rosado", "🛋️", "comun", { kind: "sofa", a: "#ff7aa8", b: "#ffd1e3" }),
  it("free", "fr_sofa_azul", "Sillón azul", "🛋️", "comun", { kind: "sofa", a: "#6ab0ff", b: "#d7ebff" }),
  it("free", "fr_mesa", "Mesa de golosinas", "🍬", "comun", { kind: "mesa", a: "#e0b070", b: "#ff7aa8" }),
  it("free", "fr_silla", "Silla de chocolate", "🪑", "comun", { kind: "silla", a: "#8a4b2c", b: "#ffd34d" }),
  it("free", "fr_comoda", "Cómoda de cajones", "🗄️", "raro", { kind: "comoda", a: "#fff1d6", b: "#d4216c" }),
  it("free", "fr_pelotero", "Pelotero", "🔴", "raro", { kind: "pelotero" }),
  it("free", "fr_tipi", "Carpa tipi", "⛺", "raro", { kind: "tipi", a: "#ff9ec6", b: "#fff6e6" }),
  it("free", "fr_piano", "Piano de cola", "🎹", "epico", { kind: "piano" }),
  it("free", "fr_pastel", "Mesa con pastel gigante", "🎂", "epico", { kind: "pastel" }),
  it("free", "fr_trampolin", "Cama elástica", "🤸", "epico", { kind: "trampolin" }),
  // ---- Techo ----
  it("ceiling", "ce_lampara", "Lámpara colgante", "💡", "comun", { kind: "lampara" }),
  it("ceiling", "ce_globos", "Globos", "🎈", "comun", { kind: "globos" }),
  it("ceiling", "ce_banderines", "Banderines de fiesta", "🎉", "raro", { kind: "banderines" }),
  it("ceiling", "ce_luna", "Luna y estrellas", "🌙", "epico", { kind: "luna" }),
  it("ceiling", "ce_disco", "Bola disco", "🪩", "legendario", { kind: "disco" }),
];

const BY_ID = new Map(HOUSE_ITEMS.map((i) => [i.id, i]));
export const getHouseItem = (id) => BY_ID.get(id) || null;
export const houseItemsOfSpot = (spot) => HOUSE_ITEMS.filter((i) => i.spot === spot);

/** Lo que hay puesto por defecto: piso, paredes y nada más. */
export const DEFAULT_PLACED = { floor: "fl_madera", wall: "wl_crema" };

export function placedWithDefaults(progress) {
  return { ...DEFAULT_PLACED, ...(progress.house ? progress.house.placed : {}) };
}

export function ownsHouseItem(progress, id) {
  const item = getHouseItem(id);
  if (!item) return false;
  return item.price === 0 || progress.house.owned.includes(id);
}

/** Compra un objeto de la casa con Matipuntos (y lo deja puesto). */
export function buyHouseItem(progress, id) {
  const item = getHouseItem(id);
  if (!item || ownsHouseItem(progress, id)) return false;
  if (!spendCoins(progress, item.price)) return false;
  progress.house.owned.push(id);
  progress.house.placed[item.spot] = id;
  saveProgress(progress);
  return true;
}

/** Pone (o quita, con id "") un objeto en su lugar. */
export function placeHouseItem(progress, spot, id) {
  if (id && (!ownsHouseItem(progress, id) || getHouseItem(id).spot !== spot)) return false;
  if (id) progress.house.placed[spot] = id;
  else if (spot === "floor" || spot === "wall") progress.house.placed[spot] = DEFAULT_PLACED[spot];
  else delete progress.house.placed[spot];
  saveProgress(progress);
  return true;
}


// ---------- decorar libre (estilo "Avatar World") ----------
// Cada mueble que compras se puede poner varias veces, en cualquier lugar del cuarto, girado y
// de otro tamaño. `progress.house.layout` guarda cada pieza: { uid, id, x, z, rot, s } en el piso,
// o { uid, id, wall: "back" | "left", u, y, s } si es de pared.

/** Muebles que se pueden poner donde quieras (todo menos piso, paredes y techo). */
export const FURNITURE_SPOTS = ["rug", "bed", "left", "right", "free", "wallL", "wallC", "wallR"];
export const FURN_CATEGORIES = [
  { id: "sit", name: "Sillones y mesas", icon: "🛋️", test: (i) => i.spot === "free" && ["sofa", "mesa", "silla", "comoda"].includes(i.params.kind) },
  { id: "fun", name: "Juegos", icon: "🎪", test: (i) => i.spot === "free" && !["sofa", "mesa", "silla", "comoda"].includes(i.params.kind) || ["lf_arcade", "lf_oso"].includes(i.id) },
  { id: "bed", name: "Camas", icon: "🛏️", test: (i) => i.spot === "bed" },
  { id: "plants", name: "Plantas y luces", icon: "🪴", test: (i) => (i.spot === "left" || i.spot === "right") && !["lf_arcade", "lf_oso"].includes(i.id) },
  { id: "rug", name: "Alfombras", icon: "🟣", test: (i) => i.spot === "rug" },
  { id: "wall", name: "Para la pared", icon: "🖼️", test: (i) => i.spot.startsWith("wall") && i.spot.length === 5 },
];
export const isWallItem = (item) => !!item && item.spot.startsWith("wall") && item.spot.length === 5;
export const furnitureOf = (catId) => {
  const c = FURN_CATEGORIES.find((x) => x.id === catId);
  return HOUSE_ITEMS.filter((i) => FURNITURE_SPOTS.includes(i.spot) && c.test(i));
};

/** Posiciones de siempre de cada lugar (para pasar lo que ya tenías puesto al modo libre). */
const OLD_ANCHORS = {
  rug: { x: 0.2, z: 1.0 }, bed: { x: -3.4, z: -2.2 }, left: { x: -4.0, z: 2.8 }, right: { x: 3.7, z: -3.8 },
  wallL: { wall: "left", u: 0.4, y: 2.7 }, wallC: { wall: "back", u: 0.3, y: 2.8 }, wallR: { wall: "back", u: 3.4, y: 2.7 },
};
let uidCounter = 0;
const newUid = () => `f${Date.now().toString(36)}${(uidCounter++).toString(36)}`;

/** El cuarto libre de este perfil; la primera vez convierte lo que ya había puesto. */
export function houseLayout(progress) {
  const h = progress.house;
  if (!h.layout) {
    h.layout = [];
    for (const [spot, a] of Object.entries(OLD_ANCHORS)) {
      const id = h.placed[spot];
      const item = id && getHouseItem(id);
      if (item && item.spot === spot) {
        h.layout.push({ uid: newUid(), id, rot: 0, s: 1, ...a });
        delete h.placed[spot];
      }
    }
    saveProgress(progress);
  }
  return h.layout;
}

export function layoutAdd(progress, id, x = 0, z = 1.5) {
  const item = getHouseItem(id);
  if (!item || !ownsHouseItem(progress, id)) return null;
  const piece = isWallItem(item) ? { uid: newUid(), id, wall: "back", u: 0, y: 2.8, s: 1 } : { uid: newUid(), id, x, z, rot: 0, s: 1 };
  houseLayout(progress).push(piece);
  saveProgress(progress);
  return piece;
}

export function layoutRemove(progress, uid) {
  const l = houseLayout(progress);
  const i = l.findIndex((f) => f.uid === uid);
  if (i >= 0) l.splice(i, 1);
  saveProgress(progress);
}

/** Compra un mueble sin ponerlo (se agrega con un toque). */
export function buyFurniture(progress, id) {
  const item = getHouseItem(id);
  if (!item || ownsHouseItem(progress, id)) return false;
  if (!spendCoins(progress, item.price)) return false;
  progress.house.owned.push(id);
  saveProgress(progress);
  return true;
}

// ---------- agrandar la casa ----------

export const HOUSE_SIZES = [
  { level: 0, size: 10, name: "Cuarto", icon: "🏠", price: 0, blurb: "Tu cuartito de siempre." },
  { level: 1, size: 14, name: "Casa mediana", icon: "🏡", price: 300, blurb: "¡Mucho más espacio para muebles!" },
  { level: 2, size: 18, name: "Casa grande", icon: "🏰", price: 900, blurb: "Una mansión de chocolate para decorar." },
];
export const houseSize = (progress) => HOUSE_SIZES[Math.min(HOUSE_SIZES.length - 1, progress.house.size || 0)];

export function buyHouseSize(progress, level) {
  const next = HOUSE_SIZES[level];
  if (!next || level !== (progress.house.size || 0) + 1) return false;
  if (!spendCoins(progress, next.price)) return false;
  progress.house.size = level;
  saveProgress(progress);
  return true;
}
