// Mi Casa: un cuarto que se decora con Matipuntos. Cada "lugar" del cuarto (piso, paredes,
// alfombra, cama, rincones, cuadros y techo) tiene sus objetos; se compran una vez y se
// pueden cambiar cuando se quiera. Los modelos 3D están en js/house3d.js.
//
// Objeto: { id, spot, name, icon, rarity, price, params }   (price 0 = viene con la casa)

import { spendCoins, saveProgress } from "./storage.js?v=cfffb722e8";
import { eventItemAvailable, eventTokens } from "./events.js?v=cfffb722e8";

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
// Precios de la casa según la rareza (ver docs/ECONOMIA.md); el 0 sigue siendo "viene con la casa".
// `soon(...)` = se ve y se prueba pero todavía no se vende ("Próximamente"): son los que se cobrarán después.
const soon = (item) => ({ ...item, soon: true });
const HOUSE_X = { comun: 2, raro: 2, epico: 3.5, legendario: 4 };
const it = (spot, id, name, icon, rarity, params = {}, price) => { const base = price ?? P[rarity]; return { id, spot, name, icon, rarity, price: base > 0 ? Math.round((base * HOUSE_X[rarity]) / 5) * 5 : 0, params }; };

// De temporada: se compran con las fichas del evento, solo mientras dura (como la ropa de temporada).
const evh = (event, tokens, spot, id, name, icon, rarity, params) => ({ ...it(spot, id, name, icon, rarity, params, 1), price: 99999, event, tokens });

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
  it("bed", "bd_simple", "Cama azul", "🛏️", "comun", { kind: "simple", a: "#6ab0ff", b: "#fff6e6" }, 0),
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
  // ---- Para cocina, baño, living y dormitorio ----
  it("free", "fr_heladera", "Heladera", "🧊", "raro", { kind: "heladera", a: "#fff6f0", b: "#ff7aa8" }),
  it("free", "fr_cocina", "Cocina con hornito", "🍳", "raro", { kind: "cocina", a: "#dcdce4", b: "#d4216c" }),
  it("free", "fr_meson", "Mesón de cocina", "🍴", "comun", { kind: "meson", a: "#fff1d6", b: "#8a4b2c" }),
  it("free", "fr_comedor", "Mesa de comedor", "🍽️", "comun", { kind: "comedor", a: "#c98a4b", b: "#ff7aa8" }),
  it("free", "fr_tina", "Tina de burbujas", "🛁", "raro", { kind: "tina" }),
  it("free", "fr_lavabo", "Lavamanos", "🚰", "comun", { kind: "lavabo" }),
  it("free", "fr_ropero", "Ropero", "🚪", "comun", { kind: "ropero", a: "#fff1d6", b: "#d4216c" }),
  it("free", "fr_tvmueble", "Mueble con tele", "📺", "raro", { kind: "tvmueble", a: "#8a4b2c" }),
  it("free", "fr_mesacentro", "Mesita de centro", "☕", "comun", { kind: "mesacentro", a: "#e0b070", b: "#ff7aa8" }),

  // ---- NUEVO · Cheerleader ----
  it("free", "fr_pompones", "Pompones gigantes", "📣", "comun", { kind: "pompones" }),
  it("free", "fr_colchoneta", "Colchoneta de gimnasia", "🤸", "comun", { kind: "colchoneta" }),
  it("free", "fr_barra", "Espejo y barra de ballet", "🩰", "raro", { kind: "barra" }),
  it("free", "fr_trofeo_cheer", "Trofeo de cheer", "🏆", "raro", { kind: "copa" }),
  it("free", "fr_escenario", "Escenario con luces", "🎤", "epico", { kind: "escenario" }),
  it("wallC", "wc_banner_cheer", "Banner GO MATI", "📣", "comun", { kind: "banner", text: "GO MATI!", a: "#d4216c", b: "#fff6e6" }),
  it("wallL", "wl1_pompones", "Pompones en la pared", "🎀", "comun", { kind: "pomponespared" }),
  it("wallR", "wr_medallas", "Colgador de medallas", "🥇", "comun", { kind: "medallas" }),
  it("rug", "rg_cheer", "Alfombra Cheer", "⭐", "comun", { kind: "estrella", a: "#ff6fb0", b: "#ffffff" }),
  it("wall", "wl_cheer", "Rayas Cheer", "🎀", "comun", { style: "rayas", a: "#ffffff", b: "#ff6fb0" }),
  // ---- NUEVO · Básquetbol ----
  it("free", "fr_aro", "Aro de básquet", "🏀", "epico", { kind: "aro" }),
  it("free", "fr_cesto_balones", "Cesto de balones", "🏀", "comun", { kind: "cestoBalones" }),
  it("free", "fr_banca", "Banca de equipo", "🪑", "comun", { kind: "banca", a: "#c98a4b", b: "#ff8a2a" }),
  it("wallC", "wc_aropared", "Aro de pared", "🏀", "raro", { kind: "aropared" }),
  it("wallC", "wc_marcador", "Marcador electrónico", "🔢", "epico", { kind: "marcador" }),
  it("rug", "rg_cancha_basquet", "Cancha de básquet", "🏀", "raro", { kind: "canchaB" }),
  it("floor", "fl_parquet", "Parquet de cancha", "🏟️", "raro", { style: "madera", a: "#e3a44f", b: "#cf8a36" }),
  it("wall", "wl_basquet", "Rayas de básquet", "🏀", "comun", { style: "rayas", a: "#ffe1b3", b: "#ff8a2a" }),
  // ---- NUEVO · Fútbol ----
  it("free", "fr_arco", "Arco de fútbol", "🥅", "raro", { kind: "arco" }),
  it("free", "fr_futbolin", "Futbolín", "⚽", "epico", { kind: "futbolin" }),
  it("free", "fr_copa_futbol", "Copa de campeón", "🏆", "epico", { kind: "copa", silver: true, big: true }),
  it("wallL", "wl1_camiseta", "Camiseta enmarcada", "👕", "raro", { kind: "camiseta", a: "#d52b1e" }),
  it("wallC", "wc_banner_futbol", "Banner de la hinchada", "⚽", "comun", { kind: "banner", text: "GOOOL!", a: "#1f57c9", b: "#ffffff" }),
  it("rug", "rg_cancha_futbol", "Cancha de fútbol", "⚽", "raro", { kind: "canchaF" }),
  it("wall", "wl_cancha", "Rayas de cancha", "🌿", "comun", { style: "rayas", a: "#d8f5c4", b: "#6cc04a" }),
  // ---- NUEVO · Hobbies ----
  it("free", "fr_caballete", "Caballete de pintura", "🎨", "comun", { kind: "caballete" }),
  it("free", "fr_telescopio", "Telescopio", "🔭", "raro", { kind: "telescopio" }),
  it("free", "fr_acuario", "Acuario con peces", "🐠", "epico", { kind: "acuario" }),

  // ---- NUEVO · Princesas, hadas y cuentos ----
  it("free", "fr_munecas", "Casa de muñecas", "🏠", "epico", { kind: "munecas" }),
  it("free", "fr_tocador", "Tocador con espejo", "💄", "raro", { kind: "tocador" }),
  it("free", "fr_mesa_te", "Mesa de té", "🫖", "comun", { kind: "mesaTe" }),
  it("free", "fr_caballito", "Caballito mecedor", "🐴", "raro", { kind: "caballito" }),
  it("free", "fr_castillo", "Castillo de juguete", "🏰", "epico", { kind: "castillo" }),
  it("free", "fr_cuentos", "Biblioteca de cuentos", "📚", "raro", { kind: "cuentos" }),
  it("free", "fr_lampara_unicornio", "Lámpara de unicornio", "🦄", "comun", { kind: "lamparaUnicornio" }),
  it("wallL", "wl1_mariposas", "Mariposas en la pared", "🦋", "comun", { kind: "mariposas" }),
  it("wallR", "wr_espejo_corazon", "Espejo de corazón", "💖", "raro", { kind: "espejoCorazon" }),
  it("ceiling", "ce_movil", "Móvil de mariposas", "🦋", "raro", { kind: "movil" }),
  it("ceiling", "ce_nubes", "Nubes de algodón", "☁️", "comun", { kind: "nubes" }),
  it("rug", "rg_flor", "Alfombra de flor", "🌸", "comun", { kind: "flor", a: "#ff9ec6", b: "#ffd1e3" }),
  it("floor", "fl_nubes_rosa", "Nubes rosadas", "🩷", "raro", { style: "nubes", a: "#ffd1e3", b: "#ffffff" }),
  it("wall", "wl_noche_rosa", "Noche rosada", "🌙", "raro", { style: "estrellas", a: "#6a2a6a", b: "#ffd1f0" }),
  it("wall", "wl_mariposas_bg", "Jardín de mariposas", "🦋", "comun", { style: "flores", a: "#ffe8f4", b: "#ff9ec6" }),
  soon(it("free", "fr_castillo_princesa", "Castillo de princesa", "🏰", "legendario", { kind: "castillo", big: true })),
  soon(it("free", "fr_carruaje", "Carruaje de cuento", "🎃", "legendario", { kind: "carruaje" })),
  // ---- Próximamente (se ven y se prueban, todavía no se compran) ----
  soon(it("free", "fr_copa_mundo", "Copa del Mundo", "🏆", "legendario", { kind: "copa", big: true, world: true })),
  soon(it("free", "fr_tobogan", "Tobogán", "🛝", "epico", { kind: "tobogan" })),
  soon(it("free", "fr_piscina", "Mini piscina", "🏊", "epico", { kind: "piscina" })),
  soon(it("bed", "bd_princesa", "Cama de princesa", "👑", "legendario", { kind: "princesa" })),
  // ---- Techo ----
  it("ceiling", "ce_lampara", "Lámpara colgante", "💡", "comun", { kind: "lampara" }),
  it("ceiling", "ce_globos", "Globos", "🎈", "comun", { kind: "globos" }),
  it("ceiling", "ce_banderines", "Banderines de fiesta", "🎉", "raro", { kind: "banderines" }),
  it("ceiling", "ce_luna", "Luna y estrellas", "🌙", "epico", { kind: "luna" }),
  it("ceiling", "ce_disco", "Bola disco", "🪩", "legendario", { kind: "disco" }),
  // ---- De temporada (fichas del evento) ----
  evh("halloween", 35, "wall", "ev_wl_calabazas", "Pared de calabazas", "🎃", "epico", { style: "lunares", a: "#2a1838", b: "#ff7a1a" }),
  evh("halloween", 30, "rug", "ev_rg_embrujada", "Alfombra embrujada", "🕸️", "epico", { kind: "estrella", a: "#ff7a1a", b: "#3a1048" }),
  evh("navidad", 35, "wall", "ev_wl_baston", "Rayas de bastón dulce", "🍭", "epico", { style: "rayas", a: "#d32f2f", b: "#fff6e6" }),
  evh("navidad", 30, "rug", "ev_rg_navidad", "Estrella navideña", "⭐", "epico", { kind: "estrella", a: "#2fa86a", b: "#ffd34d" }),
  evh("sanvalentin", 35, "wall", "ev_wl_amor", "Pared de San Valentín", "💌", "epico", { style: "corazones", a: "#ffe3ef", b: "#e83a6a" }),
  evh("sanvalentin", 30, "rug", "ev_rg_amor", "Alfombra de corazón", "💝", "epico", { kind: "corazon", a: "#ff3b6b", b: "#ffd1e3" }),
  evh("pascua", 35, "wall", "ev_wl_huevitos", "Huevitos pastel", "🥚", "epico", { style: "lunares", a: "#fff6e6", b: "#ffb3d1" }),
  evh("pascua", 30, "rug", "ev_rg_primavera", "Alfombra de primavera", "🌼", "epico", { kind: "redonda", a: "#b6e34a", b: "#fff6a8" }),
  evh("patrias", 35, "wall", "ev_wl_patrias", "Pared de Fiestas Patrias", "🇨🇱", "epico", { style: "rayas", a: "#d52b1e", b: "#ffffff" }),
  evh("patrias", 30, "rug", "ev_rg_estrella", "Estrella solitaria", "⭐", "epico", { kind: "estrella", a: "#ffffff", b: "#0039a6" }),
  evh("dianino", 35, "wall", "ev_wl_cumple", "Pared de cumpleaños", "🎈", "epico", { style: "lunares", a: "#c8f0ff", b: "#9a5cff" }),
  evh("dianino", 30, "rug", "ev_rg_fiesta", "Alfombra de fiesta", "🥳", "epico", { kind: "redonda", a: "#4fd0ff", b: "#ffc800" }),
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
  if (!item || item.soon || ownsHouseItem(progress, id)) return false;
  if (item.event) {
    // de temporada: con las fichas del evento y solo mientras dura
    if (!eventItemAvailable(item) || eventTokens(progress, item.event) < item.tokens) return false;
    progress.eventTokens[item.event] -= item.tokens;
  } else if (!spendCoins(progress, item.price)) return false;
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
const GIRL_KINDS = ["munecas", "tocador", "mesaTe", "caballito", "castillo", "cuentos", "lamparaUnicornio", "carruaje"];
const SPORT_KINDS = ["pompones", "colchoneta", "barra", "copa", "escenario", "aro", "cestoBalones", "banca", "arco", "futbolin"];
const ALL_FREE_UTIL = ["sofa", "mesa", "silla", "comoda", "ropero", "tvmueble", "mesacentro", "heladera", "cocina", "meson", "comedor", "tina", "lavabo", ...SPORT_KINDS, ...GIRL_KINDS];
export const FURN_CATEGORIES = [
  { id: "sit", name: "Sillones y mesas", icon: "🛋️", test: (i) => i.spot === "free" && ["sofa", "mesa", "silla", "comoda", "ropero", "tvmueble", "mesacentro"].includes(i.params.kind) },
  { id: "kitchen", name: "Cocina y comedor", icon: "🍳", test: (i) => i.spot === "free" && ["heladera", "cocina", "meson", "comedor"].includes(i.params.kind) },
  { id: "bath", name: "Baño", icon: "🛁", test: (i) => i.spot === "free" && ["tina", "lavabo"].includes(i.params.kind) },
  { id: "girl", name: "Princesas y cuentos", icon: "👑", test: (i) => i.spot === "free" && GIRL_KINDS.includes(i.params.kind) },
  { id: "sport", name: "Cheer y deportes", icon: "🏆", test: (i) => i.spot === "free" && SPORT_KINDS.includes(i.params.kind) },
  { id: "fun", name: "Juegos", icon: "🎪", test: (i) => i.spot === "free" && !ALL_FREE_UTIL.includes(i.params.kind) || ["lf_arcade", "lf_oso"].includes(i.id) },
  { id: "bed", name: "Camas", icon: "🛏️", test: (i) => i.spot === "bed" },
  { id: "plants", name: "Plantas y luces", icon: "🪴", test: (i) => (i.spot === "left" || i.spot === "right") && !["lf_arcade", "lf_oso"].includes(i.id) },
  { id: "rug", name: "Alfombras", icon: "🟣", test: (i) => i.spot === "rug" },
  { id: "wall", name: "Para la pared", icon: "🖼️", test: (i) => i.spot.startsWith("wall") && i.spot.length === 5 },
];
export const isWallItem = (item) => !!item && item.spot.startsWith("wall") && item.spot.length === 5;
export const furnitureOf = (catId) => {
  const c = FURN_CATEGORIES.find((x) => x.id === catId);
  const all = HOUSE_ITEMS.filter((i) => FURNITURE_SPOTS.includes(i.spot) && c.test(i));
  return [...all.filter((i) => !i.soon), ...all.filter((i) => i.soon)]; // lo "próximamente" al final
};

/** Posiciones de siempre de cada lugar (para pasar lo que ya tenías puesto al modo libre). */
const OLD_ANCHORS = {
  rug: { x: 0.2, z: 1.0 }, bed: { x: -3.4, z: -2.2 }, left: { x: -4.0, z: 2.8 }, right: { x: 3.7, z: -3.8 },
  wallL: { wall: "back", u: -3.4, y: 2.7 }, wallC: { wall: "back", u: 0.3, y: 2.8 }, wallR: { wall: "back", u: 3.4, y: 2.7 },
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
  // todas las casas empiezan con una cama (para que el Matichico pueda dormir y recuperar energía)
  if (!h.starterBed) {
    h.starterBed = true;
    if (!h.layout.some((f) => (getHouseItem(f.id) || {}).spot === "bed")) h.layout.push({ uid: newUid(), id: "bd_simple", rot: 0, s: 1, ...OLD_ANCHORS.bed });
    saveProgress(progress);
  }
  return h.layout;
}

/** Cuántas unidades de un mueble tienes (cada compra es una unidad: se puede poner una sola vez cada una). */
export function copiesOf(progress, id) {
  if (!ownsHouseItem(progress, id)) return 0;
  const n = Math.floor(Number((progress.house.copies || {})[id]));
  return n >= 1 ? n : 1;
}

/** Cuántas están puestas hoy, sumando todos los cuartos de la casa. */
export function placedCount(progress, id) {
  const h = progress.house;
  let n = houseLayout(progress).filter((f) => f.id === id).length;
  for (const [rid, d] of Object.entries(h.roomData || {})) if (rid !== h.curRoom && d && Array.isArray(d.layout)) n += d.layout.filter((f) => f.id === id).length;
  return n;
}

/** Unidades que tienes guardadas (en "Lo que tengo") listas para poner. */
export const freeCopies = (progress, id) => copiesOf(progress, id) - placedCount(progress, id);

export function layoutAdd(progress, id, x = 0, z = 1.5) {
  const item = getHouseItem(id);
  if (!item || !ownsHouseItem(progress, id)) return null;
  if (freeCopies(progress, id) <= 0) return null; // ya están todas puestas: para otro igual hay que comprar otro
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

/** Compra un mueble (o "otro igual" si ya lo tienes: cada compra es una unidad más). Se agrega con un toque. */
export function buyFurniture(progress, id) {
  const item = getHouseItem(id);
  if (!item || item.soon || item.price <= 0) return false;
  const h = progress.house;
  const had = ownsHouseItem(progress, id);
  if (!spendCoins(progress, item.price)) return false;
  if (!had) h.owned.push(id);
  h.copies = h.copies || {};
  h.copies[id] = had ? copiesOf(progress, id) + 1 : 1;
  saveProgress(progress);
  return true;
}

// ---------- agrandar la casa ----------

// Cada cuarto tiene su propio tamaño: todos parten pequeños y tú eliges cuál agrandar (se compra aparte para cada uno).
// El precio es acumulado: Mediano 900 (≈ 3 días) y Grande 1800 en total (otros 3 días): un cuarto grande cuesta el doble de lo que costó el cuarto.
export const HOUSE_SIZES = [
  { level: 0, size: 10, name: "Pequeño", icon: "🏠", price: 0, blurb: "Un cuartito acogedor." },
  { level: 1, size: 14, name: "Mediano", icon: "🏡", price: 900, blurb: "¡Mucho más espacio para muebles!" },
  { level: 2, size: 18, name: "Grande", icon: "🏰", price: 1800, blurb: "Un salón enorme para decorar." },
];
const sizeLevel = (n) => Math.min(HOUSE_SIZES.length - 1, Math.max(0, Math.floor(Number(n)) || 0));
/** El tamaño (nivel 0 a 2) de un cuarto de la casa. */
export function roomSizeLevel(progress, rid) {
  const r = roomsOf(progress).find((x) => x.rid === rid);
  return sizeLevel(r && r.size);
}
/** El tamaño del cuarto que está abierto. */
export const houseSize = (progress) => HOUSE_SIZES[roomSizeLevel(progress, progress.house.curRoom)];

/** Precio de llevar el cuarto abierto al tamaño `level` (se descuenta lo que ya valía su tamaño actual). */
export const houseSizeCost = (progress, level) => Math.max(0, HOUSE_SIZES[level].price - houseSize(progress).price);

/** Agranda el cuarto que está abierto al tamaño que elijas (puede saltarse uno). */
export function buyHouseSize(progress, level) {
  const next = HOUSE_SIZES[level];
  const r = currentRoom(progress);
  if (!next || !r || level <= sizeLevel(r.size)) return false;
  if (!spendCoins(progress, houseSizeCost(progress, level))) return false;
  r.size = level;
  if (r.rid === "r0") progress.house.size = level; // compatibilidad con guardados anteriores
  saveProgress(progress);
  return true;
}

// ---------- habitaciones ----------
// La casa se arma con varios cuartos: dormitorio, cocina, living, baño... Cada uno tiene su piso, sus paredes y sus muebles.
// El cuarto que está abierto vive en `house.placed` y `house.layout` (así todo lo demás sigue funcionando igual);
// los otros se guardan en `house.roomData[rid]` y se intercambian al cambiar de cuarto.

export const MAX_ROOMS = 8;
// starter: [idMueble, x, z, giro] — vienen de regalo con el cuarto (el giro 0 mira hacia el frente)
export const ROOM_TYPES = [
  { id: "cuarto", name: "Mi cuarto", icon: "🏠", price: 0, blurb: "Tu cuartito de siempre." },
  { id: "dormitorio", name: "Dormitorio", icon: "🛏️", price: 900, blurb: "Para dormir y descansar: cama, cómoda y ropero. ¡Durmiendo recargas energía más rápido!", floor: "fl_madera", wall: "wl_rosa",
    starter: [["bd_rosa", -3.3, -1.6, 0], ["fr_comoda", 2.6, -3.9, 0], ["fr_ropero", -0.2, -3.9, 0]] },
  { id: "cocina", name: "Cocina", icon: "🍳", price: 900, blurb: "Heladera, cocina con hornito, mesón y una mesa para comer. Tu Matichico puede cocinar y comer.", floor: "fl_damero", wall: "wl_menta",
    starter: [["fr_heladera", -3.7, -3.9, 0], ["fr_cocina", -1.1, -3.9, 0], ["fr_meson", 1.5, -3.9, 0], ["fr_comedor", 1.0, 1.0, 0]] },
  { id: "living", name: "Living", icon: "🛋️", price: 900, blurb: "Sillón, tele y mesita de centro para descansar y ver tele.", floor: "fl_madera", wall: "wl_cielo",
    starter: [["fr_tvmueble", 0.2, -3.9, 0], ["fr_sofa", 0.2, 1.3, Math.PI], ["fr_mesacentro", 0.2, -0.6, 0]] },
  { id: "bano", name: "Baño", icon: "🛁", price: 900, blurb: "Una tina de burbujas y un lavamanos.", floor: "fl_nubes", wall: "wl_cielo",
    starter: [["fr_tina", -2.6, -3.5, 0], ["fr_lavabo", 2.6, -3.9, 0]] },
  { id: "juegos", name: "Sala de juegos", icon: "🕹️", price: 900, blurb: "Pelotero, juegos y una planta grande para pasarlo bien.", floor: "fl_damero", wall: "wl_lunares",
    starter: [["fr_pelotero", -2.4, -2.4, 0], ["fr_tipi", 2.6, -2.4, 0], ["lf_planta", 3.9, 3.0, 0]] },
  { id: "jardin", name: "Jardín", icon: "🌳", price: 900, blurb: "Césped, flores y un árbol de cacao.", floor: "fl_cesped", wall: "wl_nubes",
    starter: [["rt_cacao", -3.6, -3.3, 0], ["rt_flores", 3.6, -3.6, 0], ["fr_mesa", 1.0, 1.0, 0]] },
];
export const roomType = (id) => ROOM_TYPES.find((t) => t.id === id) || ROOM_TYPES[0];

export function roomsOf(progress) {
  const h = progress.house;
  if (!Array.isArray(h.rooms) || !h.rooms.length) h.rooms = [{ rid: "r0", type: "cuarto", name: "Mi cuarto" }];
  if (!h.roomData || typeof h.roomData !== "object") h.roomData = {};
  if (!h.rooms.some((r) => r.rid === h.curRoom)) h.curRoom = h.rooms[0].rid;
  // el cuarto de siempre conserva el tamaño que ya tenía la casa; los demás parten pequeños
  for (const r of h.rooms) if (r.size === undefined) r.size = r.rid === "r0" ? sizeLevel(h.size) : 0;
  return h.rooms;
}

/** Cambia de lugar un cuarto en el orden de la casa (dir = -1 a la izquierda, +1 a la derecha). */
export function moveRoom(progress, rid, dir) {
  const rooms = roomsOf(progress);
  const i = rooms.findIndex((r) => r.rid === rid);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= rooms.length) return false;
  [rooms[i], rooms[j]] = [rooms[j], rooms[i]];
  saveProgress(progress);
  return true;
}
export function currentRoom(progress) { return roomsOf(progress).find((r) => r.rid === progress.house.curRoom); }
export const nextRoomOf = (progress) => {
  const rs = roomsOf(progress);
  if (rs.length < 2) return null;
  return rs[(rs.findIndex((r) => r.rid === progress.house.curRoom) + 1) % rs.length];
};

/** ¿Tiene cama ese cuarto? (el abierto se mira en `layout`, los otros en lo guardado) */
export function roomHasBed(progress, rid) {
  const h = progress.house;
  const layout = rid === h.curRoom ? houseLayout(progress) : ((h.roomData[rid] || {}).layout || []);
  return layout.some((f) => (getHouseItem(f.id) || {}).spot === "bed");
}

/** Abre otro cuarto: guarda el que estaba abierto y trae el nuevo. */
export function switchRoom(progress, rid) {
  const h = progress.house;
  roomsOf(progress);
  if (rid === h.curRoom || !h.rooms.some((r) => r.rid === rid)) return false;
  houseLayout(progress); // deja armado el cuarto abierto antes de guardarlo
  h.roomData[h.curRoom] = { placed: h.placed, layout: h.layout };
  const d = h.roomData[rid] || { placed: { ...DEFAULT_PLACED }, layout: [] };
  h.placed = d.placed || { ...DEFAULT_PLACED };
  h.layout = Array.isArray(d.layout) ? d.layout : [];
  delete h.roomData[rid];
  h.curRoom = rid;
  saveProgress(progress);
  return true;
}

/** Compra un cuarto nuevo (con sus muebles de regalo) y lo deja listo para abrir. Devuelve el rid o null. */
export function buyRoom(progress, typeId) {
  const t = ROOM_TYPES.find((x) => x.id === typeId);
  const h = progress.house;
  const rooms = roomsOf(progress);
  if (!t || t.id === "cuarto" || rooms.length >= MAX_ROOMS) return null;
  if (!spendCoins(progress, t.price)) return null;
  const same = rooms.filter((r) => r.type === t.id).length;
  const rid = `r${Date.now().toString(36)}${(uidCounter++).toString(36)}`;
  const layout = [];
  h.copies = h.copies || {};
  for (const [id, x, z, rot] of t.starter || []) {
    if (!getHouseItem(id)) continue;
    // los muebles de regalo del cuarto son unidades nuevas (aunque ya tengas uno igual en otro cuarto)
    if (getHouseItem(id).price > 0) {
      if (h.owned.includes(id)) h.copies[id] = copiesOf(progress, id) + 1;
      else { h.owned.push(id); h.copies[id] = 1; }
    } else h.copies[id] = copiesOf(progress, id) + 1;
    layout.push({ uid: newUid(), id, x, z, rot: rot || 0, s: 1 });
  }
  for (const id of [t.floor, t.wall]) if (id && getHouseItem(id).price > 0 && !h.owned.includes(id)) h.owned.push(id);
  h.roomData[rid] = { placed: { floor: t.floor || DEFAULT_PLACED.floor, wall: t.wall || DEFAULT_PLACED.wall }, layout };
  rooms.push({ rid, type: t.id, name: same ? `${t.name} ${same + 1}` : t.name, size: 0 });
  saveProgress(progress);
  return rid;
}
