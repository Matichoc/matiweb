// Catálogo de modos de juego de la plataforma "Matichoc Arcade".
// Cada Matichico y sus atuendos son compartidos entre todos los juegos;
// lo único que cambia es la mecánica y las canchas de cada modo.
// Ver ROADMAP.md para el plan de etapas de cada juego "próximamente".

// En la app de tienda (data-app="1") se ocultan los juegos marcados con `appHidden`:
// la app está pensada para público infantil y no incluye juegos de "disparos".
const IN_APP = typeof document !== "undefined" && document.documentElement.dataset.app === "1";

const ALL_GAMES = [
  {
    id: "town",
    orient: "landscape", // "landscape" = hay que jugarlo con el celular acostado; "any" = sirve en vertical y horizontal
    name: "Pueblo Matichoc",
    icon: "🏘️",
    tagline: "Pasea por el pueblo: fuente de chocolate, boutique, fábrica, vecinos y un arcade con puertas mágicas.",
    status: "available",
    tag: "Mundo abierto",
    noScore: true,
  },
  {
    id: "recolecta",
    orient: "landscape", // "landscape" = hay que jugarlo con el celular acostado; "any" = sirve en vertical y horizontal
    name: "Recolecta y Corre",
    icon: "🏃",
    tagline: "Corre por canchas 3D, salta vallas y junta golosinas contrarreloj.",
    status: "available",
    tag: "3D",
  },
  {
    id: "parkour",
    orient: "landscape", // "landscape" = hay que jugarlo con el celular acostado; "any" = sirve en vertical y horizontal
    name: "Parkour Choco",
    icon: "🧗",
    tagline: "Estilo Roblox: ¡mundo infinito con 10 ambientes, poderes y récord de metros! O la aventura de 6 etapas.",
    status: "available",
    tag: "Nuevo 3D",
  },
  {
    id: "salto",
    orient: "any", // "landscape" = hay que jugarlo con el celular acostado; "any" = sirve en vertical y horizontal
    name: "Salto Choco",
    icon: "🦘",
    tagline: "Sube sin parar con tu Matichico en 3D, junta alfajores y vuela con el jetpack.",
    status: "available",
    tag: "3D",
  },
  {
    id: "autos",
    orient: "landscape", // "landscape" = hay que jugarlo con el celular acostado; "any" = sirve en vertical y horizontal
    name: "Autos de Chocolate",
    icon: "🏎️",
    tagline: "Esquiva y acelera por la ruta de Matichoc, de día y de noche.",
    status: "available",
    tag: "3D",
  },
  {
    id: "tetris",
    orient: "any", // "landscape" = hay que jugarlo con el celular acostado; "any" = sirve en vertical y horizontal
    name: "Tetris de Productos",
    icon: "🧱",
    tagline: "Encaja cubos de chocolate en tu vitrina 3D antes de que se acumulen.",
    status: "available",
    tag: "3D",
  },
  {
    id: "memoria",
    orient: "any", // "landscape" = hay que jugarlo con el celular acostado; "any" = sirve en vertical y horizontal
    name: "Memoria Matichoc",
    icon: "🧠",
    tagline: "Encuentra las parejas de productos Matichoc con fotos reales.",
    status: "available",
    tag: "3D",
  },
  {
    id: "basquet_tiros",
    orient: "landscape", // "landscape" = hay que jugarlo con el celular acostado; "any" = sirve en vertical y horizontal
    name: "Lanzamientos de Básquet",
    icon: "🏀",
    tagline: "Tiro libre en 3D: fija puntería y potencia y encesta antes de que acabe el tiempo.",
    status: "available",
    tag: "3D",
  },
  {
    id: "porristas",
    orient: "landscape", // "landscape" = hay que jugarlo con el celular acostado; "any" = sirve en vertical y horizontal
    name: "Saltos de Porristas",
    icon: "🤸",
    tagline: "Mueve la rebotadora, haz volteretas y mantén a tu Matichica rebotando.",
    status: "available",
    tag: "3D",
  },
  {
    id: "fps3d",
    orient: "landscape", // "landscape" = hay que jugarlo con el celular acostado; "any" = sirve en vertical y horizontal
    name: "Choco Blaster 3D",
    icon: "🎯",
    tagline: "Primera persona: baña de chocolate a los malvaviscos traviesos.",
    status: "available",
    appHidden: true,
    tag: "3D",
  },
  {
    id: "creador",
    orient: "any", // "landscape" = hay que jugarlo con el celular acostado; "any" = sirve en vertical y horizontal
    name: "Crea tu Chocolate",
    icon: "🍫",
    tagline: "Elige producto, sabor, toppings, envoltorio y etiqueta, y crea tu propio chocolate.",
    status: "available",
    tag: "3D",
  },
];

export const GAMES_CATALOG = ALL_GAMES.filter((g) => !(IN_APP && g.appHidden));
