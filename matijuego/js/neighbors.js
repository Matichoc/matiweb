// Los vecinos del Pueblo: nombre, lo que dicen y cómo se visten. Lo usan el Pueblo (js/town-game.js) y el menú
// (caras de la aventura), así se ven iguales en los dos lados.

import { CHARACTERS, getOutfit, renderCharacterThumb } from "./characters.js?v=b28a0715a9";
import { ITEMS, OUTFITS, customizeOutfit } from "./wardrobe-data.js?v=b28a0715a9";

export const NEIGHBORS = [
  { name: "Mati Cacao", say: ["¡Hola! Bienvenida al Pueblo Matichoc 🍫", "En la Boutique hay peinados, capas y alas. ¡Pruébate todo antes de comprar!", "Los alfajores dorados que flotan por el pueblo dan Matipuntos ✨"] },
  { name: "Choco Lola", say: ["¿Ya viste el tablero de misiones? Cada día hay 3 nuevas 🎯", "Si completas las 3 misiones, ¡te dan un cofre!", "Mi alfajor favorito es el de maracuyá. ¿Y el tuyo?"] },
  { name: "Don Cuchufli", say: ["En el Parkour infinito hay poderes: 🧲 imán, 🛡️ escudo, ⚡ turbo y 🦘 súper salto.", "¡Llega lejos en el Mundo infinito y bate tu récord de metros!", "De noche se prenden los faroles, ¡qué bonito se ve!"] },
  { name: "Bombi", say: ["¿Has visto la fuente de chocolate? ¡Es la más rica del mundo!", "Cada sobre trae 3 figuritas. ¡Completa tu álbum! 📖", "Dicen que las figuritas brillantes son muy difíciles de conseguir ✨"] },
  { name: "Trufita", say: ["En la Fábrica puedes inventar tu propio chocolate 🏭", "Me encanta jugar Memoria Matichoc. ¡Mi mejor racha es de 6!", "Si subes de nivel, ¡te regalan cosas para vestirte!"] },
  { name: "Capi Menta", say: ["Los juegos del Arcade están allá, con puertas brillantes 🎮", "Cada día que juegas, tu racha crece 🔥", "¡Corre por la plaza, no hay prisa! 😄"] },
  // vecinos de los barrios nuevos (más allá de la cerca; ver js/town-zones.js)
  { name: "Guardabosque Maní", say: ["En el bosque crecen mazorcas de cacao: ¡cosecha las de hoy! 🍫", "Shhh… si escuchas bien, se oye el arroyo.", "Cuido estos árboles desde que era chiquito 🌳"] },
  { name: "Tía Avellana", say: ["Mis gallinas esconden huevos por toda la granja 🥚", "¡Las vacas dan la leche para el chocolate! 🐄", "Ven a ver el molino cuando sople el viento 🌬️"] },
  { name: "Capitán Almendra", say: ["¡Ahoy! En la orilla del lago aparecen conchitas cada día 🐚", "Antes salíamos a navegar todas las tardes ⛵", "Desde el agua se ve todo el pueblo 🌅"] },
];

let cache = null;

/**
 * Personaje y ropa de cada vecino (siempre los mismos: semilla fija). `draws` dice cuántos números al azar se usaron,
 * para que el Pueblo siga su secuencia igual que antes (lugares de partida de los vecinos).
 */
export function neighborLooks() {
  if (cache) return cache;
  const pool = ITEMS.filter((i) => ["hair", "hat", "glasses", "neck", "back", "shoes", "face"].includes(i.slot));
  const slots = ["hair", "hat", "glasses", "neck", "back", "shoes", "face"];
  let seed = 31;
  let draws = 0;
  const rnd = () => { draws++; return ((seed = (seed * 16807) % 2147483647) / 2147483647); };
  cache = NEIGHBORS.map((n, i) => {
    draws = 0;
    const char = CHARACTERS[i % CHARACTERS.length];
    const look = { hair: "", hairColor: "", face: "", hat: "", glasses: "", neck: "", back: "", outfit: OUTFITS[Math.floor(rnd() * OUTFITS.length)].id, shoes: "", skin: "", trail: "" };
    for (const slot of slots) {
      const opts = pool.filter((it) => it.slot === slot && it.rarity !== "legendario");
      if (opts.length && rnd() < (slot === "hat" ? 0.55 : 0.4)) look[slot] = opts[Math.floor(rnd() * opts.length)].id;
    }
    return { name: n.name, char, look, draws };
  });
  return cache;
}

/** Personaje y ropa de un vecino por su nombre. */
export const neighborLook = (name) => neighborLooks().find((x) => x.name === name) || null;

/**
 * Dibuja el retrato de un vecino (cabeza y hombros) en un canvas: primero el dibujo 2D al instante y luego el 3D, si se
 * puede. Se dibuja el cuerpo entero en un lienzo aparte y se recorta la parte de arriba, para que se vea la cara.
 */
export function paintNeighbor(canvas, name) {
  const n = neighborLook(name);
  if (!n) return;
  const tmp = document.createElement("canvas");
  tmp.width = tmp.height = 256;
  const copy = () => {
    const g = canvas.getContext("2d");
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.drawImage(tmp, 256 * 0.17, 256 * 0.04, 256 * 0.66, 256 * 0.66, 0, 0, canvas.width, canvas.height);
  };
  renderCharacterThumb(tmp, n.char, customizeOutfit(getOutfit(n.look.outfit), n.look));
  copy();
  import("./thumb3d.js?v=b28a0715a9").then((m) => { m.renderHeroThumb(tmp, n.char, n.look); copy(); }).catch(() => { /* sin WebGL: queda el 2D */ });
}
