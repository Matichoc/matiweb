// Datos del juego "Crea tu Chocolate": opciones, puntaje por maridaje, reto del
// día, texto para WhatsApp y dibujo de la etiqueta (sticker circular de Matichoc).
// Los productos se inspiran en el catálogo real de la web, pero el juego es una
// fantasía: no promete disponibilidad ni precios.

export const PRODUCTS = [
  { id: "barra", name: "Barra", icon: "🍫", desc: "Tableta de chocolate con cuadritos" },
  { id: "alfajor", name: "Alfajor", icon: "🍪", desc: "Dos tapas, relleno y baño" },
  { id: "cuchufli", name: "Cuchuflí", icon: "🥖", desc: "Barquillo bañado y relleno" },
  { id: "bomba", name: "Bomba", icon: "🔮", desc: "Esfera de chocolate para taza" },
  { id: "cono", name: "Cono", icon: "🍦", desc: "Cono crocante con relleno" },
];

export const CHOCOLATES = [
  { id: "leche", name: "Leche", color: "#7b4a2a" },
  { id: "oscuro", name: "Oscuro", color: "#3a1f12" },
  { id: "blanco", name: "Blanco", color: "#f1e2c4" },
  { id: "rosa", name: "Rosa", color: "#e58fb0" },
];

export const FLAVORS = [
  { id: "manjar", name: "Manjar", color: "#d9923a" },
  { id: "frambuesa", name: "Frambuesa", color: "#d4216c" },
  { id: "maracuya", name: "Maracuyá", color: "#f7a600" },
  { id: "menta", name: "Menta", color: "#2f9e6a" },
  { id: "naranja", name: "Naranja", color: "#f08a3c" },
  { id: "pie-limon", name: "Pie de limón", color: "#e8d44d" },
  { id: "trufa", name: "Trufa", color: "#5a2d16" },
  { id: "almendra", name: "Almendra", color: "#c9a27a" },
  { id: "pistacho", name: "Pistacho", color: "#a4c05a" },
  { id: "nutella", name: "Avellana", color: "#6b3a1e" },
];

export const TOPPINGS = [
  { id: "pistacho", name: "Pistacho picado", icon: "🟢", color: "#9ab84c" },
  { id: "kataifi", name: "Kataifi crocante", icon: "🟡", color: "#e0a63a" },
  { id: "almendras", name: "Almendras", icon: "🌰", color: "#d8b88a" },
  { id: "coco", name: "Coco rallado", icon: "⚪", color: "#ffffff" },
  { id: "chispas", name: "Chispas de colores", icon: "🌈", color: "#ff6fa8" },
  { id: "frambuesa", name: "Frambuesa liofilizada", icon: "🔴", color: "#d4216c" },
  { id: "oro", name: "Hojuelas doradas", icon: "✨", color: "#ffc800" },
];

export const WRAPS = [
  { id: "ninguno", name: "Sin envoltorio", icon: "🙈" },
  { id: "papel", name: "Papel de colores", icon: "🎁" },
  { id: "bolsa", name: "Bolsita con cinta", icon: "🛍️" },
  { id: "caja", name: "Cajita", icon: "📦" },
];

export const WRAP_COLORS = [
  { id: "rosado", name: "Rosado", color: "#e0457f" },
  { id: "amarillo", name: "Amarillo", color: "#f2c500" },
  { id: "verde", name: "Verde", color: "#2fa56d" },
  { id: "azul", name: "Azul", color: "#2f8fd1" },
  { id: "rojo", name: "Rojo", color: "#d63a3a" },
  { id: "cafe", name: "Café", color: "#6b3a1e" },
];

export const MOTIFS = ["❤️", "⭐", "🍫", "⚽", "🏀", "🎀", "🌸", "🎉"];

export const STEPS = [
  { id: "producto", label: "Producto" },
  { id: "chocolate", label: "Chocolate" },
  { id: "sabor", label: "Sabor" },
  { id: "toppings", label: "Toppings" },
  { id: "envoltorio", label: "Envoltorio" },
  { id: "etiqueta", label: "Etiqueta" },
];

const byId = (list, id) => list.find((x) => x.id === id) || list[0];
export const getProduct = (id) => byId(PRODUCTS, id);
export const getChocolate = (id) => byId(CHOCOLATES, id);
export const getFlavor = (id) => byId(FLAVORS, id);
export const getTopping = (id) => byId(TOPPINGS, id);
export const getWrap = (id) => byId(WRAPS, id);
export const getWrapColor = (id) => byId(WRAP_COLORS, id);

export function defaultCreation() {
  return {
    product: "alfajor",
    chocolate: "leche",
    flavor: "manjar",
    toppings: [],
    wrap: "ninguno",
    wrapColor: "rosado",
    name: "",
    motif: "🍫",
    dedic: "",
  };
}

/** Normaliza una creación (por si viene de un guardado antiguo o editado a mano). */
export function sanitize(c) {
  const d = defaultCreation();
  const pick = (list, id, fallback) => (list.some((x) => x.id === id) ? id : fallback);
  return {
    product: pick(PRODUCTS, c.product, d.product),
    chocolate: pick(CHOCOLATES, c.chocolate, d.chocolate),
    flavor: pick(FLAVORS, c.flavor, d.flavor),
    toppings: Array.isArray(c.toppings) ? c.toppings.filter((t) => TOPPINGS.some((x) => x.id === t)).slice(0, 3) : [],
    wrap: pick(WRAPS, c.wrap, d.wrap),
    wrapColor: pick(WRAP_COLORS, c.wrapColor, d.wrapColor),
    name: typeof c.name === "string" ? c.name.slice(0, 18) : "",
    motif: MOTIFS.includes(c.motif) ? c.motif : d.motif,
    dedic: typeof c.dedic === "string" ? c.dedic.slice(0, 14) : "",
  };
}

// Maridajes que funcionan bien (juego): chocolate -> sabores
const PERFECT = {
  oscuro: ["frambuesa", "menta", "naranja", "maracuya"],
  leche: ["manjar", "nutella", "almendra", "trufa"],
  blanco: ["maracuya", "frambuesa", "pie-limon", "pistacho"],
  rosa: ["frambuesa", "pistacho"],
};
// Toppings que acompañan bien a un sabor o chocolate
const TOPPING_MATCH = {
  pistacho: { flavors: ["pistacho", "frambuesa"], chocs: ["blanco", "rosa"] },
  kataifi: { flavors: ["pistacho", "manjar"], chocs: ["blanco", "leche"] },
  almendras: { flavors: ["manjar", "almendra", "nutella"], chocs: ["leche", "oscuro"] },
  coco: { flavors: ["maracuya", "pie-limon"], chocs: ["blanco"] },
  chispas: { flavors: ["frambuesa", "manjar"], chocs: ["blanco", "rosa"] },
  frambuesa: { flavors: ["frambuesa", "menta"], chocs: ["oscuro", "blanco"] },
  oro: { flavors: [], chocs: ["oscuro", "leche", "rosa", "blanco"] },
};

/** Puntaje (0-700 aprox.) y comentario de una creación. */
export function scoreCreation(c, { challengeDone = false } = {}) {
  let score = 100;
  const notes = [];
  const perfect = (PERFECT[c.chocolate] || []).includes(c.flavor);
  if (perfect) {
    score += 150;
    notes.push(`¡Maridaje perfecto: chocolate ${getChocolate(c.chocolate).name.toLowerCase()} con ${getFlavor(c.flavor).name.toLowerCase()}!`);
  } else {
    score += 50;
    notes.push("Combinación atrevida: ¡original!");
  }
  let matches = 0;
  for (const t of c.toppings) {
    score += 30;
    const m = TOPPING_MATCH[t];
    if (m && (m.flavors.includes(c.flavor) || m.chocs.includes(c.chocolate))) {
      score += 40;
      matches++;
    }
  }
  if (c.toppings.length) notes.push(matches ? `${matches} topping${matches > 1 ? "s" : ""} que combinan de maravilla.` : "Toppings con personalidad.");
  if (c.name.trim()) score += 40;
  if (c.wrap !== "ninguno") score += 20;
  if (c.dedic.trim()) score += 10;
  if (challengeDone) {
    score += 100;
    notes.push("¡Cumpliste el reto del día!");
  }
  const stars = score >= 520 ? 5 : score >= 420 ? 4 : score >= 320 ? 3 : score >= 220 ? 2 : 1;
  return { score, stars, notes, perfect };
}

/** Clave que identifica la "receta" (para no dar monedas dos veces por la misma). */
export function comboKey(c) {
  return [c.product, c.chocolate, c.flavor, [...c.toppings].sort().join("+")].join("|");
}

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Reto del día (igual para todos los perfiles ese día). */
export function dailyChallenge(dateKey) {
  const h = hash(`matichoc-${dateKey}`);
  return {
    product: PRODUCTS[h % PRODUCTS.length].id,
    flavor: FLAVORS[(h >>> 3) % FLAVORS.length].id,
    topping: TOPPINGS[(h >>> 7) % TOPPINGS.length].id,
  };
}

export function matchesChallenge(c, ch) {
  return c.product === ch.product && c.flavor === ch.flavor && c.toppings.includes(ch.topping);
}

export function describeChallenge(ch) {
  return `un ${getProduct(ch.product).name.toLowerCase()} de ${getFlavor(ch.flavor).name.toLowerCase()} con ${getTopping(ch.topping).name.toLowerCase()}`;
}

export function describeCreation(c) {
  const tops = c.toppings.length ? `, con ${c.toppings.map((t) => getTopping(t).name.toLowerCase()).join(", ")}` : "";
  return `${getProduct(c.product).name} de chocolate ${getChocolate(c.chocolate).name.toLowerCase()} relleno de ${getFlavor(c.flavor).name.toLowerCase()}${tops}`;
}

const WHATSAPP = "56975645591"; // mismo número público que usa matichoc.cl

/** Mensaje de WhatsApp: solo describe la idea, sin precios ni promesas. */
export function whatsappUrl(c) {
  const wrap = c.wrap === "ninguno" ? "" : ` Envoltorio: ${getWrap(c.wrap).name.toLowerCase()} ${getWrapColor(c.wrapColor).name.toLowerCase()}.`;
  const label = c.name.trim() ? ` La etiqueta diría "${c.name.trim()}"${c.dedic.trim() ? ` (para ${c.dedic.trim()})` : ""}.` : "";
  const msg = `¡Hola Matichoc! Armé un chocolate en Matijuego: ${describeCreation(c)}.${wrap}${label} ¿Podrían hacer algo parecido? ¿Qué opciones tienen?`;
  return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`;
}

// ---------- etiqueta ----------

function arcText(g, text, cx, cy, r, bottom) {
  const widths = [...text].map((ch) => g.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) / r;
  let cum = -total / 2;
  [...text].forEach((ch, i) => {
    const w = widths[i] / r;
    const th = cum + w / 2;
    cum += w;
    g.save();
    if (bottom) {
      g.translate(cx + r * Math.sin(th), cy + r * Math.cos(th));
      g.rotate(-th);
    } else {
      g.translate(cx + r * Math.sin(th), cy - r * Math.cos(th));
      g.rotate(th);
    }
    g.fillText(ch, 0, 0);
    g.restore();
  });
}

/** Dibuja el sticker circular (anillo de color con el nombre + logo de Matichoc al centro). */
export function drawLabel(canvas, c, logo) {
  const S = canvas.width;
  const g = canvas.getContext("2d");
  g.clearRect(0, 0, S, S);
  const flavor = getFlavor(c.flavor);
  g.fillStyle = flavor.color;
  g.beginPath();
  g.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "rgba(255,255,255,0.55)";
  g.lineWidth = S * 0.012;
  g.beginPath();
  g.arc(S / 2, S / 2, S / 2 - S * 0.035, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = "#ffffff";
  g.beginPath();
  g.arc(S / 2, S / 2, S * 0.335, 0, Math.PI * 2);
  g.fill();

  if (logo) {
    const w = S * 0.5;
    const h = w * (logo.naturalHeight / logo.naturalWidth || 0.653);
    g.drawImage(logo, S / 2 - w / 2, S / 2 - h / 2 - S * 0.03, w, h);
  }
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = "#ffffff";
  const name = (c.name.trim() || flavor.name).toUpperCase();
  g.font = `${S * 0.088}px "Baby Chipmunk", sans-serif`;
  arcText(g, name, S / 2, S / 2, S * 0.415, false);
  g.font = `${S * 0.068}px "Baby Chipmunk", sans-serif`;
  const bottom = c.dedic.trim() ? `PARA ${c.dedic.trim().toUpperCase()}` : flavor.name.toUpperCase();
  arcText(g, bottom, S / 2, S / 2, S * 0.415, true);
  g.font = `${S * 0.1}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;
  g.fillStyle = "#000000";
  g.fillText(c.motif, S / 2, S / 2 + S * 0.215);
  return canvas;
}
