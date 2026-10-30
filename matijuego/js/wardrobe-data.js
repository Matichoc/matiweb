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
  { id: "hand", name: "Mano", icon: "🪄" },
  { id: "outfit", name: "Ropa", icon: "👕" },
  { id: "shoes", name: "Zapatos", icon: "👟" },
  { id: "skin", name: "Chocolate", icon: "🍫" },
  { id: "trail", name: "Estela", icon: "✨" },
  { id: "pet", name: "Mascota", icon: "🐾" },
];

const P = { comun: 30, raro: 110, epico: 260, legendario: 520 };
// Precio final = precio base × factor de su rareza. Con ~300 🍫✨ de ganancia al día: común ≈ 1/3 de día, raro ≈ 1 día, épico ≈ 3 días,
// legendario ≈ 7 días (ver docs/ECONOMIA.md). El 0 sigue siendo "gratis".
const PRICE_X = { comun: 3, raro: 2, epico: 3.5, legendario: 4 };
const cost = (rarity, price) => { const base = price ?? P[rarity]; return base > 0 ? Math.round((base * PRICE_X[rarity]) / 5) * 5 : 0; };
const it = (slot, id, name, icon, rarity, params = {}, price) => ({ id, slot, name, icon, rarity, price: cost(rarity, price), params });
// Objetos que se pueden ver y probar pero todavía no se pueden comprar ("Próximamente"): son los que se cobrarán después.
const soon = (item) => ({ ...item, soon: true });
// Objetos exclusivos de un evento de temporada (ver js/events.js): se compran con fichas del evento.
const ev = (event, tokens, slot, id, name, icon, rarity, params = {}) => ({ id, slot, name, icon, rarity, price: 99999, params, event, tokens });

// Atuendos: colores de la ropa y, en los de falda/tutú/vestido, la prenda (ver addOutfitExtras en wardrobe3d.js).
//   params.skirt  "tutu" | "cheer" | "vestido" | "gala"   · skirtColor / skirtTrim / tights  · emblem "star" | "heart" | "bolt" | "bow"
//   params.pompoms  color de los pompones de las manos     · rainbow/stars/shine  efectos
//   minLevel / needs  lo exclusivo: se desbloquea con el nivel o con un logro (ver lockReason en storage.js)
const out = (id, name, icon, rarity, jersey, trim, params = {}, price, extra = {}) => ({ id, slot: "outfit", name, icon, rarity, price: cost(rarity, price), jersey, trim, params, ...extra });
export const OUTFITS = [
  { id: "polera", slot: "outfit", name: "Polera Matichoc", icon: "👕", rarity: "comun", price: 0, jersey: "#1C1C22", trim: "#E0368A", params: {} },
  { id: "liga", slot: "outfit", name: "Local Matichoc", icon: "👕", rarity: "comun", price: 0, jersey: "#D4216C", trim: "#FFC800", params: {} },
  out("visita", "Visita Cacao", "👕", "comun", "#CFD767", "#64321B", {}, 30),
  out("oro", "Edición Oro", "👕", "raro", "#FFC800", "#64321B", {}, 60),
  out("noche", "Choco Oscuro", "👕", "raro", "#3d1f10", "#D4216C", {}, 90),
  out("oceano", "Océano", "🌊", "comun", "#2F6FD6", "#FFF6E6", {}, 40),
  out("menta", "Menta fresca", "🌿", "comun", "#5FCFB0", "#3d1f10", {}, 40),
  out("caramelo", "Caramelo", "🍬", "comun", "#FF7AA8", "#FFF6E6", {}, 40),
  out("atardecer", "Atardecer", "🌇", "raro", "#E8742A", "#FFC800", {}, 110),
  out("galaxia", "Galaxia", "🌌", "epico", "#3a2d8a", "#35F0FF", { stars: true }, 260),
  out("arcoiris", "Arcoíris", "🌈", "epico", "#ffffff", "#FFC800", { rainbow: true }, 280),
  out("rubi", "Rubí", "💎", "legendario", "#C2185B", "#FFFFFF", { shine: true }, 520),

  // ---- Tenidas con falda, tutú y vestido (cheerleader, bailarina, fiesta) ----
  out("tutu_rosa", "Tutú Rosa", "🩰", "comun", "#FF7AA8", "#FFF6E6", { skirt: "tutu", skirtColor: "#FF9CC4", tights: "#FFFFFF" }, 40),
  out("vestido_flores", "Vestido de flores", "🌸", "comun", "#FFD1E3", "#4FD09A", { skirt: "vestido", skirtColor: "#FFD1E3", skirtTrim: "#4FD09A", emblem: "heart" }, 45),
  out("vestido_verano", "Vestido de verano", "☀️", "comun", "#FFC800", "#FFF6E6", { skirt: "vestido", skirtColor: "#FFD84D", skirtTrim: "#FF7AA8" }, 45),
  out("cheer_rosa", "Uniforme Cheer a tu gusto", "📣", "raro", "#D4216C", "#FFFFFF", { skirt: "cheer", skirtColor: "#D4216C", skirtTrim: "#FFC800", emblem: "star", pompoms: "#FFC800" }, 100, { custom: true }),
  out("cheer_azul", "Cheer Azul", "🌊", "raro", "#2F6FD6", "#FFF6E6", { skirt: "cheer", skirtColor: "#2F6FD6", skirtTrim: "#FFFFFF", emblem: "star", pompoms: "#FFFFFF" }, 100),
  out("bailarina", "Bailarina", "🩰", "raro", "#FFFFFF", "#FF7AA8", { skirt: "tutu", skirtColor: "#FFF0F6", tights: "#FFC2DC" }, 120),
  out("vestido_fiesta", "Vestido de fiesta", "🎉", "raro", "#9A5CFF", "#FFC800", { skirt: "vestido", skirtColor: "#9A5CFF", skirtTrim: "#FFC800", shine: true, emblem: "star" }, 130),
  out("hada", "Hada de azúcar", "🧚", "epico", "#5FCFB0", "#FFFFFF", { skirt: "tutu", skirtColor: "#8FE6CC", tights: "#FFFFFF", shine: true, emblem: "star" }, 270),
  out("tutu_arcoiris", "Tutú Arcoíris", "🌈", "epico", "#FFFFFF", "#FFC800", { skirt: "tutu", rainbow: true, tights: "#FFFFFF", pompoms: "#FF7AA8" }, 300, { minLevel: 12 }),
  out("princesa", "Princesa Cacao", "👸", "legendario", "#8A2B5C", "#FFC800", { skirt: "gala", skirtColor: "#B83A78", skirtTrim: "#FFC800", shine: true, emblem: "heart" }, 520, { minLevel: 20 }),
  out("cheer_oro", "Cheer Campeona", "🏆", "legendario", "#FFC800", "#D4216C", { skirt: "cheer", skirtColor: "#FFC800", skirtTrim: "#D4216C", shine: true, emblem: "star", pompoms: "#FF3FA4" }, 520, { minLevel: 15 }),
  out("gala_dorado", "Vestido de Gala", "💫", "legendario", "#FFC800", "#FFFFFF", { skirt: "gala", skirtColor: "#FFD84D", skirtTrim: "#FFFFFF", shine: true, emblem: "star" }, 540, { minLevel: 25 }),

  // ---- Más tenidas exclusivas para todos ----
  out("smoking", "Smoking de gala", "🤵", "raro", "#1C1C22", "#FFFFFF", { emblem: "bow" }, 130),
  out("super", "Súper Choco", "🦸", "epico", "#2F6FD6", "#E83A3A", { emblem: "bolt" }, 300, { minLevel: 10 }),
  out("astronauta", "Traje espacial", "🚀", "epico", "#F2F4FF", "#35F0FF", { emblem: "star", shine: true }, 320, { minLevel: 14 }),

  // ---- Deportes, pijamas y oficios ----
  out("equipo_rojo", "Equipo Rojo", "⚽", "raro", "#D52B1E", "#FFFFFF", { pants: "#FFFFFF", emblem: "star" }, 100),
  out("equipo_azul", "Equipo Azul", "⚽", "raro", "#1F57C9", "#FFFFFF", { pants: "#1F57C9", emblem: "star" }, 100),
  out("portero", "Portero Neón", "🧤", "raro", "#B6FF3A", "#1C1C22", { pants: "#1C1C22" }, 100),
  out("basquet_naranja", "Uniforme de Básquet", "🏀", "raro", "#FF8A2A", "#1C1C22", { pants: "#FF8A2A", emblem: "star" }, 100),
  out("basquet_estrella", "Básquet Estrella", "🌟", "epico", "#2A1A6A", "#FFC800", { pants: "#2A1A6A", emblem: "star", shine: true }, 270, { minLevel: 16 }),
  out("pijama_estrellas", "Pijama de estrellas", "🌙", "comun", "#3A2D8A", "#FFD34D", { pants: "#3A2D8A", emblem: "star" }, 40),
  out("pijama_nubes", "Pijama de nubes", "☁️", "comun", "#A8D8FF", "#FFFFFF", { pants: "#A8D8FF", emblem: "heart" }, 40),
  out("jardinero", "Overol de jardín", "🌻", "comun", "#2F6FD6", "#FFD34D", { pants: "#2F6FD6" }, 40),
  out("chef", "Chef Matichoc", "👨‍🍳", "raro", "#FFFFFF", "#D4216C", { pants: "#3D3D44", emblem: "bow" }, 110),
  out("doctora", "Doctora Choco", "🩺", "raro", "#FFFFFF", "#35C8FF", { pants: "#35C8FF", emblem: "heart" }, 110),
  out("falda_jeans", "Falda de jeans", "👖", "comun", "#FFFFFF", "#FF7AA8", { skirt: "cheer", skirtColor: "#2E4A7C", skirtTrim: "#FF7AA8", emblem: "heart" }, 45),
  out("cheer_lunares", "Cheer Lunares", "🔴", "raro", "#FFFFFF", "#D4216C", { skirt: "cheer", skirtColor: "#D4216C", skirtTrim: "#FFFFFF", emblem: "heart", pompoms: "#FFFFFF" }, 105),
  out("hada_noche", "Hada de la noche", "🧚‍♀️", "epico", "#3A2D8A", "#35F0FF", { skirt: "tutu", skirtColor: "#6A4DD8", tights: "#35F0FF", stars: true, emblem: "star" }, 280, { minLevel: 18 }),

  out("vestido_cumple", "Vestido de cumpleaños", "🎂", "raro", "#FF7AA8", "#FFFFFF", { skirt: "vestido", skirtColor: "#FF9CC4", skirtTrim: "#FFD34D", emblem: "heart", pompoms: "#FFD34D" }, 115),
  out("falda_volantes", "Falda de volantes", "💃", "comun", "#FFD1E3", "#FF7AA8", { skirt: "tutu", skirtColor: "#FF7AA8", tights: "#FFFFFF", emblem: "heart" }, 45),
  out("disfraz_gatita", "Disfraz de gatita", "🐱", "raro", "#FFB3D1", "#FF6FB0", { skirt: "tutu", skirtColor: "#FF8AB8", tights: "#FFB3D1", emblem: "heart" }, 105),
  out("vestido_mariposa", "Vestido de mariposa", "🦋", "raro", "#B06BFF", "#FFFFFF", { skirt: "vestido", skirtColor: "#B06BFF", skirtTrim: "#FFD1E3", emblem: "star", shine: true }, 125),
  out("vestido_sirena", "Vestido de sirena", "🧜‍♀️", "epico", "#2FB5B0", "#FFFFFF", { skirt: "gala", skirtColor: "#3FD0C8", skirtTrim: "#B6FFF2", shine: true, emblem: "star" }, 280),
  out("reina", "Vestido de reina", "👑", "epico", "#C2185B", "#FFD34D", { skirt: "gala", skirtColor: "#D4216C", skirtTrim: "#FFD34D", shine: true, emblem: "heart" }, 290, { minLevel: 22 }),
  soon(out("vestido_arcoiris", "Vestido arcoíris", "🌈", "epico", "#FFFFFF", "#FF7AA8", { skirt: "gala", rainbow: true, emblem: "heart", shine: true }, 290)),
  // ---- Próximamente (se ven y se prueban, todavía no se compran) ----
  soon(out("copa_oro", "Copa de Oro", "🏆", "legendario", "#FFC800", "#1C1C22", { pants: "#FFC800", shine: true, emblem: "star" }, 540)),
  soon(out("unicornio", "Disfraz de unicornio", "🦄", "legendario", "#FFFFFF", "#FF7AA8", { skirt: "tutu", rainbow: true, tights: "#FFFFFF", shine: true, emblem: "star", pompoms: "#FF7AA8" }, 540)),
  soon(out("hielo", "Princesa de Hielo", "❄️", "epico", "#BFE8FF", "#FFFFFF", { skirt: "gala", skirtColor: "#8FD0FF", skirtTrim: "#FFFFFF", shine: true, emblem: "star" }, 290)),
  soon(out("cheer_navidad", "Cheer Navideña", "🎄", "epico", "#E83A3A", "#FFFFFF", { skirt: "cheer", skirtColor: "#E83A3A", skirtTrim: "#FFFFFF", emblem: "star", pompoms: "#4FD09A" }, 270)),
  out("dubai", "Edición Mati Dubai", "💎", "legendario", "#FFC800", "#FF3FA4", { shine: true, emblem: "star" }, 540, { needs: "dubai" }),
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

  // ---- NUEVO · Peinados ----
  it("hair", "hair_cola", "Cola de caballo alta", "🎀", "comun", { style: "cola" }),
  it("hair", "hair_cheer", "Coletas cheer", "📣", "comun", { style: "cheer" }),
  it("hair", "hair_bob", "Pelo bob", "💁‍♀️", "comun", { style: "bob" }),
  it("hair", "hair_ballet", "Moño de bailarina", "🩰", "comun", { style: "ballet" }),
  it("hair", "hair_ondas", "Melena con ondas", "🌊", "raro", { style: "ondas" }),
  it("hair", "hair_futbolista", "Corte futbolista", "⚽", "raro", { style: "mullet" }),
  it("hair", "hair_boxeadora", "Trenzas deportivas", "🏀", "raro", { style: "trenzas" }),
  it("hair", "hair_corona", "Trenza corona", "👑", "epico", { style: "corona" }),
  soon(it("hair", "hair_unicornio", "Melena de unicornio", "🦄", "legendario", { style: "unicornio" })),

  // ---- NUEVO · Colores de pelo ----
  it("hairColor", "hc_rojo", "Rojo fuego", "🔴", "comun", { color: "#e8412a" }, 25),
  it("hairColor", "hc_celeste", "Celeste", "🩵", "comun", { color: "#6fd0ff" }, 25),
  it("hairColor", "hc_castano", "Castaño dorado", "🟤", "comun", { color: "#b5763a" }, 15),
  soon(it("hairColor", "hc_arcoiris", "Pelo arcoíris", "🌈", "legendario", { color: "#ffffff", rainbow: true })),

  // ---- NUEVO · Sombreros ----
  it("hat", "hat_lazo", "Gran lazo cheer", "🎀", "comun", { kind: "lazo", color: "#d4216c" }),
  it("hat", "hat_pompones", "Pompones de cheer", "📣", "comun", { kind: "pompones", color: "#ffc800" }),
  it("hat", "hat_visera", "Visera deportiva", "🎾", "comun", { kind: "visera", color: "#35c8ff" }),
  it("hat", "hat_banda", "Banda de deportista", "🏅", "comun", { kind: "banda", color: "#e83a3a" }),
  it("hat", "hat_gorra_basquet", "Gorra de básquet", "🏀", "comun", { kind: "gorra", color: "#ff8a2a" }),
  it("hat", "hat_gorra_futbol", "Gorra Equipo Rojo", "⚽", "comun", { kind: "gorra", color: "#d52b1e" }),
  it("hat", "hat_diadema", "Diadema de estrellas", "💫", "raro", { kind: "diadema", color: "#ffc800" }),
  it("hat", "hat_corona_flores", "Corona de flores", "🌸", "raro", { kind: "coronaflores" }),
  it("hat", "hat_birrete", "Birrete de campeón", "🎓", "raro", { kind: "birrete", color: "#1c1c22" }),
  it("hat", "hat_tiara", "Tiara de princesa", "👸", "epico", { kind: "tiara" }),
  soon(it("hat", "hat_unicornio", "Cuerno de unicornio", "🦄", "legendario", { kind: "unicornio" })),

  // ---- NUEVO · Anteojos ----
  it("glasses", "gl_azules", "Cuadrados azules", "👓", "comun", { kind: "cuadrados", color: "#2f6fd6" }),
  it("glasses", "gl_dorados", "Redondos dorados", "🥇", "raro", { kind: "redondos", color: "#ffc800" }),
  it("glasses", "gl_rosa", "Redondos rosados", "🩷", "comun", { kind: "redondos", color: "#ff6fb0" }),

  // ---- NUEVO · Cuello ----
  it("neck", "neck_silbato", "Silbato de entrenador", "📯", "comun", { kind: "silbato" }),
  it("neck", "neck_panuelo", "Pañuelo cheer", "🎀", "comun", { kind: "bufanda", color: "#ffc800" }),
  it("neck", "neck_perlas", "Collar de perlas", "🤍", "raro", { kind: "perlas" }),
  it("neck", "neck_medalla_plata", "Medalla de plata", "🥈", "raro", { kind: "medalla", color: "#cfd3dc" }),

  // ---- NUEVO · Espalda ----
  it("back", "back_bolso", "Bolso deportivo", "👜", "comun", { kind: "mochila", color: "#ff8a2a" }),
  it("back", "back_mochila_rosa", "Mochila rosada", "🎒", "comun", { kind: "mochila", color: "#ff6fb0" }),
  it("back", "back_balones", "Red de balones", "⚽", "raro", { kind: "balones" }),
  it("back", "back_alas_hada", "Alas de hada", "🧚", "epico", { kind: "alas", color: "#9fe8ff" }),
  soon(it("back", "back_alas_arcoiris", "Alas arcoíris", "🌈", "legendario", { kind: "mariposa", rainbow: true })),

  // ---- NUEVO · Zapatos ----
  it("shoes", "sh_ballet", "Zapatillas de ballet", "🩰", "comun", { kind: "ballet", color: "#ffc2dc" }),
  it("shoes", "sh_cheer", "Zapatillas Cheer", "📣", "raro", { kind: "cheer", color: "#ffffff" }),
  it("shoes", "sh_bota_lluvia", "Botas de lluvia", "🌧️", "comun", { kind: "bota", color: "#ffd84d" }),
  it("shoes", "sh_bota_nieve", "Botas de nieve", "🥾", "raro", { kind: "bota", color: "#ffffff", fur: true }),
  it("shoes", "sh_botin", "Botines de fútbol", "⚽", "raro", { kind: "botin", color: "#e83a3a" }),
  it("shoes", "sh_botin_neon", "Botines neón", "⚡", "epico", { kind: "botin", color: "#b6ff3a", glow: "#b6ff3a" }),
  it("shoes", "sh_basquet", "Zapatillas de básquet", "🏀", "raro", { kind: "basquet", color: "#ff8a2a" }),
  it("shoes", "sh_basquet_oro", "Air Mati Dorado", "👟", "legendario", { kind: "basquet", color: "#ffc800", metal: true }, 520),
  it("shoes", "sh_patines", "Patines", "🛼", "epico", { kind: "patin", color: "#ff7aa8" }),
  soon(it("shoes", "sh_cristal", "Zapatillas de cristal", "👠", "legendario", { kind: "ballet", color: "#bfe8ff", glow: "#9fe8ff" })),
  soon(it("shoes", "sh_cohete", "Botas cohete", "🚀", "legendario", { kind: "bota", color: "#d4216c", glow: "#35f0ff" })),

  // ---- NUEVO · Estelas ----
  it("trail", "tr_futbol", "Estela de cancha", "⚽", "comun", { colors: ["#4fd09a", "#ffffff"] }, 40),
  it("trail", "tr_basquet", "Estela de básquet", "🏀", "comun", { colors: ["#ff8a2a", "#1c1c22"] }, 40),
  it("trail", "tr_cheer", "Estela cheer", "📣", "raro", { colors: ["#ff6fb0", "#ffc800", "#ffffff"] }),
  soon(it("trail", "tr_unicornio", "Estela de unicornio", "🦄", "legendario", { colors: ["#ff6fb0", "#9fe8ff", "#fff1a8", "#b6ff3a"] })),

  // ---- NUEVO · Mascotas ----
  it("pet", "pet_balon", "Balón goleador", "⚽", "comun", { kind: "balon" }),
  it("pet", "pet_basquet", "Basqui", "🏀", "comun", { kind: "basquet" }),
  it("pet", "pet_pompon", "Pompi", "📣", "raro", { kind: "pompon" }),
  it("pet", "pet_trofeo", "Copita", "🏆", "epico", { kind: "trofeo" }),
  soon(it("pet", "pet_unicornio2", "Unicornio arcoíris", "🦄", "legendario", { kind: "unicornio", rainbow: true })),

  // ---- NUEVO · Cosas para la mano (varitas, paraguas, carteras, helados…) ----
  it("hand", "hand_varita", "Varita mágica", "🪄", "raro", { kind: "varita", color: "#ff6fb0" }),
  it("hand", "hand_ramo", "Ramo de flores", "💐", "comun", { kind: "ramo" }),
  it("hand", "hand_paraguas", "Paraguas rosa", "☂️", "comun", { kind: "paraguas", color: "#ff6fb0" }),
  it("hand", "hand_paraguas_celeste", "Paraguas celeste", "🌂", "comun", { kind: "paraguas", color: "#6fd0ff" }),
  it("hand", "hand_cartera", "Carterita", "👛", "comun", { kind: "cartera", color: "#ff7aa8" }),
  it("hand", "hand_helado", "Helado de frutilla", "🍦", "comun", { kind: "helado" }),
  it("hand", "hand_globo", "Globo de corazón", "🎈", "comun", { kind: "globo", color: "#ff3b6b" }),
  it("hand", "hand_peluche", "Osito de peluche", "🧸", "raro", { kind: "osito" }),
  it("hand", "hand_micro", "Micrófono de estrella", "🎤", "raro", { kind: "micro" }),
  it("hand", "hand_balon", "Balón de fútbol", "⚽", "comun", { kind: "balon" }),
  it("hand", "hand_basquet", "Pelota de básquet", "🏀", "comun", { kind: "pelota" }),
  it("hand", "hand_copa", "Copa de campeona", "🏆", "epico", { kind: "copa" }),
  soon(it("hand", "hand_varita_unicornio", "Varita de unicornio", "🦄", "legendario", { kind: "varita", color: "#b06bff", big: true })),

  // ---- NUEVO · Caras, maquillaje y pendientes ----
  it("face", "face_pestanas", "Pestañas y labios", "💋", "comun", { eyes: "normal", mouth: "sonrisa", extras: ["pestanas", "labios"] }),
  it("face", "face_brillitos", "Brillitos", "✨", "comun", { eyes: "normal", mouth: "sonrisa", extras: ["brillitos", "mejillas"] }),
  it("face", "face_pendientes", "Pendientes de corazón", "💖", "raro", { eyes: "normal", mouth: "sonrisa", extras: ["pendientes", "mejillas"] }),
  it("face", "face_maquillaje", "Maquillaje de estrellas", "🌟", "epico", { eyes: "normal", mouth: "sonrisa", extras: ["pestanas", "labios", "brillitos", "pendientes"] }),

  // ---- NUEVO · Más pelo y sombreros ----
  it("hair", "hair_flequillo_lazo", "Flequillo con lazo", "🎀", "comun", { style: "flequilloLazo" }),
  soon(it("hair", "hair_rapunzel", "Trenza gigante", "👸", "legendario", { style: "rapunzel" })),
  it("hat", "hat_mariposas", "Mariposas en el pelo", "🦋", "raro", { kind: "mariposas" }),
  it("hat", "hat_horquillas", "Pasadores de colores", "📎", "comun", { kind: "horquillas" }),

  // ---- NUEVO · Mochilas, bolsitos y collares ----
  it("back", "back_mochila_unicornio", "Mochila de unicornio", "🦄", "raro", { kind: "mochilaAnimal", animal: "unicornio", color: "#ffd1e3" }),
  it("back", "back_mochila_gato", "Mochila de gatito", "🐱", "comun", { kind: "mochilaAnimal", animal: "gato", color: "#ff8ab8" }),
  it("back", "back_mochila_conejo", "Mochila de conejita", "🐰", "comun", { kind: "mochilaAnimal", animal: "conejo", color: "#fff6e6" }),
  it("back", "back_bolsito", "Bolsito de corazón", "👜", "comun", { kind: "bolsito", color: "#ff3b6b" }),
  it("neck", "neck_corazon", "Collar de corazón", "💗", "comun", { kind: "colgante", shape: "corazon", color: "#ff3b6b" }),
  it("neck", "neck_estrella", "Collar de estrella", "⭐", "comun", { kind: "colgante", shape: "estrella", color: "#ffc800" }),
  it("neck", "neck_lazo", "Lazo de seda", "🎀", "comun", { kind: "corbatin", color: "#ff7aa8" }),

  // ---- NUEVO · Calzado de fiesta ----
  it("shoes", "sh_bailarinas_rojas", "Bailarinas rojas", "🩰", "comun", { kind: "ballet", color: "#e83a6a" }),
  it("shoes", "sh_botas_corazones", "Botas de corazones", "💕", "raro", { kind: "bota", color: "#ff6fb0" }),
  it("shoes", "sh_luces", "Zapatillas con luces", "💡", "epico", { kind: "cheer", color: "#ffffff", glow: "#ff3fa4" }),

  // ---- NUEVO · Mascotas de cuento ----
  it("pet", "pet_osito", "Osito Rosa", "🧸", "comun", { kind: "osito" }),
  it("pet", "pet_conejita", "Conejita Pompón", "🐰", "raro", { kind: "conejita" }),
  it("pet", "pet_mariposa", "Mariposa Brillos", "🦋", "raro", { kind: "mariposa" }),
  soon(it("pet", "pet_hada", "Hada Madrina", "🧚‍♀️", "legendario", { kind: "hada" })),

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
  // más cosas por temporada (29-oct-2026): mismos modelos, con los colores de cada fiesta. Lo que no se gaste de fichas
  // vuelve como Matipuntos al terminar el evento (js/events.js, settleEventTokens).
  ev("halloween", 25, "hat", "ev_gorro_calabaza", "Gorro de calabaza", "🎃", "raro", { kind: "fiesta", a: "#ff7a1a", b: "#1c1c26" }),
  ev("halloween", 25, "neck", "ev_bufanda_calabaza", "Bufanda de calabaza", "🧣", "raro", { kind: "bufanda", color: "#ff7a1a" }),
  ev("halloween", 35, "hand", "ev_varita_bruja", "Varita embrujada", "🪄", "epico", { kind: "varita", color: "#9a5cff" }),
  ev("halloween", 35, "shoes", "ev_zap_fosfo", "Zapatillas fosforescentes", "👟", "epico", { color: "#2a2a30", glow: "#7cff4f" }),
  ev("halloween", 45, "back", "ev_capa_vampiro", "Capa de vampiro", "🧛", "epico", { kind: "capa", color: "#5a1048" }),
  ev("navidad", 25, "hat", "ev_gorro_duende", "Gorro de duende", "🧝", "raro", { kind: "fiesta", a: "#2fa86a", b: "#e83a3a" }),
  ev("navidad", 20, "glasses", "ev_lentes_estrella", "Lentes de estrella navideña", "⭐", "raro", { kind: "estrella" }),
  ev("navidad", 35, "hand", "ev_varita_dulce", "Bastón de dulce", "🍭", "epico", { kind: "varita", color: "#e83a3a" }),
  ev("navidad", 35, "shoes", "ev_zap_duende", "Zapatillas de duende", "👟", "epico", { color: "#2fa86a", glow: "#ffd34d" }),
  ev("navidad", 45, "back", "ev_capa_noel", "Capa de Papá Noel", "🦸", "epico", { kind: "capa", color: "#d32f2f" }),
  ev("sanvalentin", 20, "glasses", "ev_lentes_corazon", "Lentes de corazón", "😍", "raro", { kind: "corazon" }),
  ev("sanvalentin", 25, "neck", "ev_bufanda_rosa", "Bufanda de San Valentín", "🧣", "raro", { kind: "bufanda", color: "#ff8ab8" }),
  ev("sanvalentin", 35, "hand", "ev_varita_amor", "Varita del amor", "🪄", "epico", { kind: "varita", color: "#ff3b6b" }),
  ev("sanvalentin", 35, "shoes", "ev_zap_rosa", "Zapatillas de brillo rosa", "👟", "epico", { color: "#ff6fb0", glow: "#ff9ac6" }),
  ev("sanvalentin", 45, "back", "ev_capa_corazones", "Capa de corazones", "🦸", "epico", { kind: "capa", color: "#ff6fb0" }),
  ev("pascua", 25, "hat", "ev_gorro_huevito", "Gorro de huevito", "🥚", "raro", { kind: "fiesta", a: "#ffd1e3", b: "#c8f0ff" }),
  ev("pascua", 25, "neck", "ev_bufanda_pastel", "Bufanda pastel", "🧣", "raro", { kind: "bufanda", color: "#c8a8ff" }),
  ev("pascua", 30, "hand", "ev_paraguas_primavera", "Paraguas de primavera", "🌂", "raro", { kind: "paraguas", color: "#ffd34d" }),
  ev("pascua", 35, "shoes", "ev_zap_pascua", "Zapatillas de Pascua", "👟", "epico", { color: "#ffd1e3", glow: "#fff6a8" }),
  ev("pascua", 45, "back", "ev_capa_primavera", "Capa de primavera", "🦸", "epico", { kind: "capa", color: "#b6e34a" }),
  ev("patrias", 25, "hat", "ev_gorro_tricolor", "Gorro de fiesta tricolor", "🥳", "raro", { kind: "fiesta", a: "#0039a6", b: "#d52b1e" }),
  ev("patrias", 20, "glasses", "ev_lentes_tricolor", "Lentes de fonda", "🕶️", "raro", { kind: "cuadrados", color: "#d52b1e" }),
  ev("patrias", 30, "hand", "ev_paraguas_tricolor", "Quitasol de la ramada", "⛱️", "raro", { kind: "paraguas", color: "#0039a6" }),
  ev("patrias", 35, "shoes", "ev_zap_cueca", "Zapatos de cueca", "👞", "epico", { color: "#d52b1e" }),
  ev("patrias", 45, "back", "ev_manta", "Manta tricolor", "🦸", "epico", { kind: "capa", color: "#0039a6" }),
  ev("dianino", 20, "glasses", "ev_lentes_fiesta", "Lentes de estrella", "⭐", "raro", { kind: "estrella" }),
  ev("dianino", 25, "neck", "ev_bufanda_fiesta", "Bufanda de fiesta", "🧣", "raro", { kind: "bufanda", color: "#ffc800" }),
  ev("dianino", 35, "hand", "ev_varita_colores", "Varita de colores", "🪄", "epico", { kind: "varita", color: "#4fd0ff" }),
  ev("dianino", 35, "shoes", "ev_zap_luces", "Zapatillas de luces", "👟", "epico", { color: "#ffffff", glow: "#4fd0ff" }),
  ev("dianino", 45, "back", "ev_capa_heroe", "Capa de superhéroe", "🦸", "epico", { kind: "capa", color: "#4fd0ff" }),
];

import { levelInfo } from "./xp.js?v=cfffb722e8";

/** Si la prenda todavía está bloqueada devuelve por qué ("" si ya se puede comprar). Lo exclusivo pide nivel o un logro. */
export function lockReason(progress, item) {
  if (!item) return "";
  if (item.soon) return "Próximamente";
  if (item.minLevel && levelInfo(progress.xp).level < item.minLevel) return `Nivel ${item.minLevel}`;
  if (item.needs === "dubai" && !(progress.merge && progress.merge.dubai)) return "Haz el ¡Mati Dubai! en Mati Merge";
  return "";
}

const BY_ID = new Map(ITEMS.map((i) => [i.id, i]));

export function getItem(id) {
  return BY_ID.get(id) || null;
}

export function itemsOfSlot(slot) {
  // lo que ya se puede comprar primero; lo "próximamente" al final
  return [...ITEMS.filter((i) => i.slot === slot && !i.soon), ...ITEMS.filter((i) => i.slot === slot && i.soon)];
}

// ---- Prendas "a tu gusto": con una sola compra eliges el color (cualquiera) y la figura del centro ----
export const CUSTOM_COLORS = ["#D4216C", "#E83A3A", "#FF8A2A", "#FFC800", "#CFD767", "#4FD09A", "#2FB5B0", "#35C8FF", "#2F6FD6", "#7A4DD8", "#B06BFF", "#FF7AA8", "#FFFFFF", "#8A8A99", "#3D1F10", "#1C1C22"];
export const CUSTOM_EMBLEMS = [
  { id: "star", name: "Estrella", icon: "⭐" },
  { id: "circle", name: "Círculo", icon: "⚪" },
  { id: "moon", name: "Luna", icon: "🌙" },
  { id: "heart", name: "Corazón", icon: "❤️" },
  { id: "diamond", name: "Rombo", icon: "🔷" },
  { id: "none", name: "Sin figura", icon: "🚫" },
];
export const isHexColor = (c) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c);

/** Color de contraste para los detalles (blanco sobre colores oscuros, café oscuro sobre colores claros). */
export function contrastOf(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.68 ? "#3D1F10" : "#FFFFFF";
}

/** El atuendo tal como se ve con lo que elegiste (si no es "a tu gusto", queda igual). */
export function customizeOutfit(outfit, look) {
  if (!outfit || !outfit.custom) return outfit;
  const color = isHexColor(look && look.outfitColor) ? look.outfitColor : outfit.jersey;
  const emblem = look && CUSTOM_EMBLEMS.some((e) => e.id === look.outfitEmblem) ? look.outfitEmblem : outfit.params.emblem;
  const trim = contrastOf(color);
  return { ...outfit, jersey: color, trim, params: { ...outfit.params, skirtColor: color, skirtTrim: trim, pompoms: trim, emblem: emblem === "none" ? "" : emblem } };
}

export function getOutfit(id) {
  return OUTFITS.find((o) => o.id === id) || OUTFITS[0];
}

/** Colores de la estela de chispas (por defecto, dorada). */
export function trailColors(look) {
  const item = look && look.trail ? getItem(look.trail) : null;
  return item ? item.params.colors.map((c) => Number.parseInt(c.slice(1), 16)) : [0xffc800, 0xfff6e6];
}

export const EMPTY_LOOK = { hair: "", hairColor: "", face: "", hat: "", glasses: "", neck: "", back: "", hand: "", outfitColor: "", outfitEmblem: "", outfit: "polera", shoes: "", skin: "", trail: "", pet: "" };
