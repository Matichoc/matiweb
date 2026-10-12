// Catálogo del guardarropa de Matijuego: peinados, caras, sombreros, anteojos, ropa y más.
// Todo se compra con Matipuntos (los puntos que se ganan jugando). Los datos son solo datos:
// los modelos 3D están en js/wardrobe3d.js, que lee `params` de cada objeto.
//
// Estructura de un objeto:  { id, slot, name, icon, rarity, price, params }
//   rarity: "comun" | "raro" | "epico" | "legendario"  (cambia el color de la tarjeta y el precio base)
//   price : 0 = viene gratis con el juego

export const RARITIES = {
  comun: { name: "Común", color: "#8fb4d9" },
  raro: { name: "Raro", color: "#5ac8a0" },
  epico: { name: "Épico", color: "#b06bff" },
  legendario: { name: "Legendario", color: "#ffc800" },
};

/** Categorías de la tienda, en el orden en que aparecen como pestañas. */
export const SLOTS = [
  { id: "hair", name: "Peinado", icon: "💇" },
  { id: "hairColor", name: "Color de pelo", icon: "🎨" },
  { id: "face", name: "Cara", icon: "😊" },
  { id: "hat", name: "Sombrero", icon: "🎩" },
  { id: "glasses", name: "Anteojos", icon: "🕶️" },
  { id: "neck", name: "Cuello", icon: "🧣" },
  { id: "back", name: "Espalda", icon: "🦋" },
  { id: "outfit", name: "Ropa", icon: "👕" },
  { id: "shoes", name: "Zapatos", icon: "👟" },
  { id: "skin", name: "Chocolate", icon: "🍫" },
  { id: "trail", name: "Estela", icon: "✨" },
  { id: "pet", name: "Mascota", icon: "🐾" },
];

const P = { comun: 30, raro: 110, epico: 260, legendario: 520 };
const it = (slot, id, name, icon, rarity, params = {}, price) => ({ id, slot, name, icon, rarity, price: price ?? P[rarity], params });
// Objetos exclusivos de un evento de temporada (ver js/events.js): se compran con fichas del evento.
const ev = (event, tokens, slot, id, name, icon, rarity, params = {}) => ({ ...it(slot, id, name, icon, rarity, params, 99999), event, tokens });

// Atuendos (colores de camiseta): los 4 primeros ya existían en la tienda original.
export const OUTFITS = [
  { id: "liga", slot: "outfit", name: "Local Matichoc", icon: "👕", rarity: "comun", price: 0, jersey: "#D4216C", trim: "#FFC800", params: {} },
  { id: "visita", slot: "outfit", name: "Visita Cacao", icon: "👕", rarity: "comun", price: 30, jersey: "#CFD767", trim: "#64321B", params: {} },
  { id: "oro", slot: "outfit", name: "Edición Oro", icon: "👕", rarity: "raro", price: 60, jersey: "#FFC800", trim: "#64321B", params: {} },
  { id: "noche", slot: "outfit", name: "Choco Oscuro", icon: "👕", rarity: "raro", price: 90, jersey: "#3d1f10", trim: "#D4216C", params: {} },
  { id: "oceano", slot: "outfit", name: "Océano", icon: "🌊", rarity: "comun", price: 40, jersey: "#2F6FD6", trim: "#FFF6E6", params: {} },
  { id: "menta", slot: "outfit", name: "Menta fresca", icon: "🌿", rarity: "comun", price: 40, jersey: "#5FCFB0", trim: "#3d1f10", params: {} },
  { id: "caramelo", slot: "outfit", name: "Caramelo", icon: "🍬", rarity: "comun", price: 40, jersey: "#FF7AA8", trim: "#FFF6E6", params: {} },
  { id: "atardecer", slot: "outfit", name: "Atardecer", icon: "🌇", rarity: "raro", price: 110, jersey: "#E8742A", trim: "#FFC800", params: {} },
  { id: "galaxia", slot: "outfit", name: "Galaxia", icon: "🌌", rarity: "epico", price: 260, jersey: "#3a2d8a", trim: "#35F0FF", params: { stars: true } },
  { id: "arcoiris", slot: "outfit", name: "Arcoíris", icon: "🌈", rarity: "epico", price: 280, jersey: "#ffffff", trim: "#FFC800", params: { rainbow: true } },
  { id: "rubi", slot: "outfit", name: "Rubí", icon: "💎", rarity: "legendario", price: 520, jersey: "#C2185B", trim: "#FFFFFF", params: { shine: true } },
];

export const ITEMS = [
  ...OUTFITS,

  // ---- Peinados (usan el color de pelo elegido) ----
  it("hair", "hair_corto", "Pelo corto", "💇", "comun", { style: "corto" }),
  it("hair", "hair_flequillo", "Flequillo", "💁", "comun", { style: "flequillo" }),
  it("hair", "hair_colitas", "Colitas", "🎀", "comun", { style: "colitas" }),
  it("hair", "hair_monos", "Moñitos", "🍥", "comun", { style: "monos" }),
  it("hair", "hair_rulos", "Rulos", "🌀", "raro", { style: "rulos" }),
  it("hair", "hair_afro", "Pompón", "☁️", "raro", { style: "afro" }),
  it("hair", "hair_largo", "Pelo largo", "🧚", "raro", { style: "largo" }),
  it("hair", "hair_trenza", "Trenza", "🪢", "raro", { style: "trenza" }),
  it("hair", "hair_mohicano", "Mohicano", "🤘", "epico", { style: "mohicano" }),
  it("hair", "hair_puas", "Puntas locas", "⚡", "epico", { style: "puas" }),
  it("hair", "hair_copete", "Copete", "😎", "comun", { style: "copete" }),
  it("hair", "hair_pelado", "Pelado", "🥚", "comun", { style: "pelado" }, 20),

  // ---- Colores de pelo ----
  it("hairColor", "hc_negro", "Negro", "⚫", "comun", { color: "#1f1410" }, 15),
  it("hairColor", "hc_rubio", "Rubio", "🟡", "comun", { color: "#e8c25a" }, 15),
  it("hairColor", "hc_rosa", "Rosa chicle", "🩷", "comun", { color: "#ff6fb0" }, 25),
  it("hairColor", "hc_azul", "Azul", "🔵", "comun", { color: "#3b8cff" }, 25),
  it("hairColor", "hc_verde", "Verde menta", "🟢", "comun", { color: "#4fd09a" }, 25),
  it("hairColor", "hc_morado", "Morado", "🟣", "comun", { color: "#9a5cff" }, 25),
  it("hairColor", "hc_naranja", "Naranja", "🟠", "comun", { color: "#ff8a2a" }, 25),
  it("hairColor", "hc_blanco", "Plateado", "⚪", "raro", { color: "#e7e9f2" }, 80),
  it("hairColor", "hc_oro", "Dorado", "🌟", "legendario", { color: "#ffc800", metal: true }),

  // ---- Caras ----
  it("face", "face_feliz", "Carita feliz", "😄", "comun", { eyes: "feliz", mouth: "grande" }),
  it("face", "face_guino", "Guiño", "😜", "comun", { eyes: "guino", mouth: "lengua" }),
  it("face", "face_pecas", "Pecas", "🤗", "comun", { eyes: "normal", mouth: "sonrisa", extras: ["pecas", "mejillas"] }),
  it("face", "face_gatito", "Gatito", "😺", "raro", { eyes: "normal", mouth: "gato", extras: ["bigotes"] }),
  it("face", "face_estrellas", "Ojos de estrella", "🤩", "raro", { eyes: "estrella", mouth: "grande" }),
  it("face", "face_corazones", "Ojos de corazón", "😍", "raro", { eyes: "corazon", mouth: "sonrisa" }),
  it("face", "face_dormilon", "Dormilón", "😴", "comun", { eyes: "dormido", mouth: "o" }),
  it("face", "face_bigote", "Bigotón", "🥸", "epico", { eyes: "normal", mouth: "sonrisa", extras: ["bigote"] }),

  // ---- Sombreros ----
  it("hat", "hat_gorra", "Gorra", "🧢", "comun", { kind: "gorra", color: "#3b8cff" }),
  it("hat", "hat_gorro", "Gorro de lana", "🧶", "comun", { kind: "gorro", color: "#ff6fb0" }),
  it("hat", "hat_fiesta", "Gorro de fiesta", "🥳", "comun", { kind: "fiesta" }),
  it("hat", "hat_chef", "Chef Matichoc", "👨‍🍳", "raro", { kind: "chef" }),
  it("hat", "hat_galera", "Galera elegante", "🎩", "raro", { kind: "galera" }),
  it("hat", "hat_gatito", "Orejas de gatito", "🐱", "raro", { kind: "orejas", color: "#ff6fb0" }),
  it("hat", "hat_conejo", "Orejas de conejo", "🐰", "raro", { kind: "conejo" }),
  it("hat", "hat_flor", "Flor", "🌼", "comun", { kind: "flor" }),
  it("hat", "hat_alfajor", "Sombrero Alfajor", "🍪", "epico", { kind: "alfajor" }),
  it("hat", "hat_antenas", "Antenas alienígenas", "👽", "epico", { kind: "antenas" }),
  it("hat", "hat_astronauta", "Casco astronauta", "🧑‍🚀", "epico", { kind: "astronauta" }),
  it("hat", "hat_corona", "Corona dorada", "👑", "legendario", { kind: "corona" }),
  it("hat", "hat_aureola", "Aureola", "😇", "legendario", { kind: "aureola" }),

  // ---- Anteojos ----
  it("glasses", "gl_redondos", "Redondos", "👓", "comun", { kind: "redondos", color: "#5a3320" }),
  it("glasses", "gl_sol", "De sol", "🕶️", "comun", { kind: "sol" }),
  it("glasses", "gl_cuadrados", "Cuadrados", "🤓", "comun", { kind: "cuadrados", color: "#d4216c" }),
  it("glasses", "gl_estrella", "Estrellas", "⭐", "raro", { kind: "estrella" }),
  it("glasses", "gl_corazon", "Corazones", "💖", "raro", { kind: "corazon" }),
  it("glasses", "gl_esqui", "Esquí", "🥽", "epico", { kind: "esqui" }),

  // ---- Cuello ----
  it("neck", "neck_bufanda", "Bufanda", "🧣", "comun", { kind: "bufanda", color: "#d4216c" }),
  it("neck", "neck_corbatin", "Corbatín", "🎀", "comun", { kind: "corbatin" }),
  it("neck", "neck_medalla", "Medalla de campeón", "🏅", "raro", { kind: "medalla" }),
  it("neck", "neck_flores", "Collar de flores", "🌺", "raro", { kind: "flores" }),
  it("neck", "neck_cascabel", "Cascabel", "🔔", "comun", { kind: "cascabel" }),
  it("neck", "neck_diamante", "Collar diamante", "💎", "epico", { kind: "diamante" }),

  // ---- Espalda ----
  it("back", "back_capa_rosa", "Capa rosada", "🦸", "comun", { kind: "capa", color: "#d4216c" }),
  it("back", "back_capa_azul", "Capa azul", "🦸", "comun", { kind: "capa", color: "#2f6fd6" }),
  it("back", "back_capa_dorada", "Capa dorada", "🦸", "epico", { kind: "capa", color: "#ffc800", shine: true }),
  it("back", "back_mochila", "Mochila", "🎒", "comun", { kind: "mochila", color: "#3b8cff" }),
  it("back", "back_cacao", "Vaina de cacao", "🥜", "raro", { kind: "cacao" }),
  it("back", "back_alas", "Alas de ángel", "🪽", "epico", { kind: "alas", color: "#ffffff" }),
  it("back", "back_mariposa", "Alas de mariposa", "🦋", "epico", { kind: "mariposa" }),
  it("back", "back_cohete", "Mochila cohete", "🚀", "legendario", { kind: "cohete" }),

  // ---- Zapatos ----
  it("shoes", "sh_rosa", "Zapatillas rosadas", "👟", "comun", { color: "#ff6fb0" }),
  it("shoes", "sh_azul", "Zapatillas azules", "👟", "comun", { color: "#3b8cff" }),
  it("shoes", "sh_lima", "Zapatillas lima", "👟", "comun", { color: "#b6e34a" }),
  it("shoes", "sh_blanco", "Zapatillas blancas", "👟", "comun", { color: "#f5f5f5" }),
  it("shoes", "sh_neon", "Zapatillas neón", "👟", "epico", { color: "#35f0ff", glow: "#35f0ff" }),
  it("shoes", "sh_oro", "Zapatos de oro", "🥇", "legendario", { color: "#ffc800", metal: true }),

  // ---- Tono de chocolate ----
  it("skin", "skin_oscuro", "Chocolate oscuro", "🍫", "comun", { color: "#3b2013", dark: "#28150c" }, 40),
  it("skin", "skin_blanco", "Chocolate blanco", "🤍", "comun", { color: "#f1dfc0", dark: "#d8c39d" }, 40),
  it("skin", "skin_caramelo", "Caramelo", "🍯", "comun", { color: "#c98a3c", dark: "#a36b25" }, 40),
  it("skin", "skin_ruby", "Chocolate Ruby", "🩷", "raro", { color: "#e8789e", dark: "#c45a82" }),
  it("skin", "skin_menta", "Chocolate menta", "🌱", "raro", { color: "#7fd1b2", dark: "#5fb394" }),
  it("skin", "skin_oro", "Chocolate de oro", "✨", "legendario", { color: "#e8b830", dark: "#b88a12", metal: true }),

  // ---- Estelas (el rastro de chispas al moverte) ----
  it("trail", "tr_rosa", "Estela rosada", "💗", "comun", { colors: ["#ff6fb0", "#fff6e6"] }, 40),
  it("trail", "tr_menta", "Estela menta", "🍃", "comun", { colors: ["#5fcfb0", "#fff6e6"] }, 40),
  it("trail", "tr_neon", "Estela neón", "🔆", "raro", { colors: ["#35f0ff", "#ff3fa4"] }),
  it("trail", "tr_arcoiris", "Estela arcoíris", "🌈", "epico", { colors: ["#ff3b3b", "#ffc800", "#4fd09a", "#3b8cff", "#9a5cff"] }),
  it("trail", "tr_oro", "Lluvia de oro", "🌟", "legendario", { colors: ["#ffc800", "#fff1a8", "#ffffff"] }),

  // ---- Mascotas (flotan al lado del Matichico y lo acompañan a todos lados) ----
  it("pet", "pet_alfajorito", "Alfajorito", "🍪", "comun", { kind: "alfajor" }),
  it("pet", "pet_patito", "Patito de goma", "🐥", "comun", { kind: "patito" }),
  it("pet", "pet_gotita", "Gotita de cacao", "💧", "comun", { kind: "gota" }),
  it("pet", "pet_nubi", "Nubi", "☁️", "raro", { kind: "nube" }),
  it("pet", "pet_cuchu", "Cuchu", "🥢", "raro", { kind: "cuchu" }),
  it("pet", "pet_bombi", "Bombi gatito", "🐱", "raro", { kind: "gato" }),
  it("pet", "pet_robot", "Robo-Choco", "🤖", "epico", { kind: "robot" }),
  it("pet", "pet_estrellita", "Estrellita", "⭐", "epico", { kind: "estrella" }),
  it("pet", "pet_unicornio", "Unicornio dulce", "🦄", "legendario", { kind: "unicornio" }),
  it("pet", "pet_dragon", "Dragón de cacao", "🐲", "legendario", { kind: "dragon" }),

  // ---- Exclusivos de eventos de temporada ----
  ev("halloween", 40, "hat", "ev_bruja", "Sombrero de bruja", "🧙‍♀️", "epico", { kind: "bruja" }),
  ev("halloween", 50, "back", "ev_murcielago", "Alas de murciélago", "🦇", "epico", { kind: "murcielago" }),
  ev("halloween", 80, "pet", "ev_fantasma", "Fantasmita", "👻", "legendario", { kind: "fantasma" }),
  ev("navidad", 30, "hat", "ev_santa", "Gorro de Papá Noel", "🎅", "raro", { kind: "santa" }),
  ev("navidad", 30, "neck", "ev_bufanda_nav", "Bufanda navideña", "🧣", "raro", { kind: "bufanda", color: "#e83a3a" }),
  ev("navidad", 80, "pet", "ev_nieve", "Muñeco de nieve", "⛄", "legendario", { kind: "nieve" }),
  ev("sanvalentin", 30, "hat", "ev_rosas", "Corona de rosas", "🌹", "raro", { kind: "rosas" }),
  ev("sanvalentin", 50, "back", "ev_cupido", "Alas de cupido", "💘", "epico", { kind: "alas", color: "#ffc2dc" }),
  ev("sanvalentin", 80, "pet", "ev_corazon", "Corazoncito", "💖", "legendario", { kind: "corazon" }),
  ev("pascua", 30, "hat", "ev_conejo_p", "Orejas de Pascua", "🐰", "raro", { kind: "conejo", color: "#ffd1e3" }),
  ev("pascua", 50, "back", "ev_canasta", "Canasta de huevos", "🧺", "epico", { kind: "canasta" }),
  ev("pascua", 80, "pet", "ev_huevo", "Huevito sorpresa", "🥚", "legendario", { kind: "huevo" }),
  ev("patrias", 30, "hat", "ev_chupalla", "Chupalla", "🤠", "raro", { kind: "chupalla" }),
  ev("patrias", 30, "neck", "ev_chal", "Chal tricolor", "🇨🇱", "raro", { kind: "bufanda", color: "#0039a6" }),
  ev("patrias", 80, "pet", "ev_volantin", "Volantín", "🪁", "legendario", { kind: "volantin" }),
  ev("dianino", 30, "hat", "ev_fiesta", "Gorro de cumpleaños", "🥳", "raro", { kind: "fiesta", a: "#4fd0ff", b: "#9a5cff" }),
  ev("dianino", 50, "back", "ev_globos", "Globos", "🎈", "epico", { kind: "globos" }),
  ev("dianino", 80, "pet", "ev_globito", "Globito feliz", "🎈", "legendario", { kind: "globito" }),
];

const BY_ID = new Map(ITEMS.map((i) => [i.id, i]));

export function getItem(id) {
  return BY_ID.get(id) || null;
}

export function itemsOfSlot(slot) {
  return ITEMS.filter((i) => i.slot === slot);
}

export function getOutfit(id) {
  return OUTFITS.find((o) => o.id === id) || OUTFITS[0];
}

/** Colores de la estela de chispas (por defecto, dorada). */
export function trailColors(look) {
  const item = look && look.trail ? getItem(look.trail) : null;
  return item ? item.params.colors.map((c) => Number.parseInt(c.slice(1), 16)) : [0xffc800, 0xfff6e6];
}

export const EMPTY_LOOK = { hair: "", hairColor: "", face: "", hat: "", glasses: "", neck: "", back: "", outfit: "liga", shoes: "", skin: "", trail: "", pet: "" };
