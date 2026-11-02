// Fuente única de verdad para el catálogo de Matichoc.
// La tienda (pages/tienda.html + js/tienda.js) lee de aquí — no dupliques precios a mano.
// Campo opcional `badge`: etiqueta destacada en la tarjeta.
// `img`: foto cuadrada en assets/productos/ (ver el README de esa carpeta), ruta desde la raíz del sitio.
const CATALOGO = [
  {
    id: 'alfajor',
    categoria: 'Alfajores',
    nombre: 'Alfajor',
    descripcion: 'Tradicional, frambuesa, tres leches, menta, naranja, trufa, nuez, pistacho, lúcuma, pie de limón, maracuyá, capuchino o café moka.',
    precio: 1000,
    img: '/assets/productos/alfajor.webp'
  },
  {
    id: 'alfajor_personalizado',
    categoria: 'Alfajores',
    nombre: 'Alfajor personalizado',
    descripcion: 'Cualquiera de los sabores anteriores, con frase simple o dibujo simple.',
    precio: 1500,
    img: '/assets/productos/alfajor_personalizado.webp'
  },
  {
    id: 'alfajor_oreo_bonbon',
    categoria: 'Alfajores',
    nombre: 'Alfajor Oreo o Bon o Bon',
    precio: 1500,
    img: '/assets/productos/alfajor_oreo_bonbon.webp'
  },
  {
    id: 'cuchufli',
    categoria: 'Cuchuflí',
    nombre: 'Cuchuflí tradicional',
    descripcion: 'Bolsa de 3.',
    precio: 1000,
    img: '/assets/productos/cuchufli.webp'
  },
  {
    id: 'cuchufli_personalizado',
    categoria: 'Cuchuflí',
    nombre: 'Cuchuflí personalizado',
    descripcion: 'Bolsa de 3, con frase o formas.',
    precio: 2000,
    img: '/assets/productos/cuchufli_personalizado.webp'
  },
  {
    id: 'torta_cuchufli',
    categoria: 'Cuchuflí',
    nombre: 'Torta de cuchuflí',
    descripcion: '30 cuchuflí con toppings.',
    precio: 14000,
    img: '/assets/productos/torta_cuchufli.webp'
  },
  {
    id: 'prestigios',
    categoria: 'Prestigios',
    nombre: 'Prestigios',
    descripcion: 'Bolsa de 2 unidades.',
    precio: 1500,
    img: '/assets/productos/prestigios.webp'
  },
  {
    id: 'bolitas_pie_limon',
    categoria: 'Bolitas Pie de Limón',
    nombre: 'Bolitas Pie de Limón',
    descripcion: 'Bolsa de 2 unidades.',
    precio: 1500,
    img: '/assets/productos/bolitas_pie_limon.webp'
  },
  {
    id: 'matidubai',
    categoria: 'Matidubai',
    nombre: 'Matidubai',
    descripcion: 'Chocolate de Dubai 100% artesanal, con pistacho natural y fideo kataifi crocante.',
    precio: 13000,
    badge: 'Más pedido',
    img: '/assets/productos/matidubai.webp'
  },
  {
    id: 'mini_dubai',
    categoria: 'Matidubai',
    nombre: 'Mini Dubai',
    precio: 2000,
    img: '/assets/productos/mini_dubai.webp'
  },
  {
    id: 'bombas',
    categoria: 'Bombas de Chocolate',
    nombre: 'Bombas de Chocolate',
    descripcion: 'Ideales para la leche, de café o Milo. Incluyen marshmallow.',
    precio: 1500,
    img: '/assets/productos/bombas.webp'
  },
  {
    id: 'barra_nikolo',
    categoria: 'Barras de Chocolate',
    nombre: 'Barra Nikolo',
    precio: 1000,
    img: '/assets/productos/barra_nikolo.webp'
  },
  {
    id: 'barra_blanca',
    categoria: 'Barras de Chocolate',
    nombre: 'Barra pequeña blanca',
    precio: 1000,
    img: '/assets/productos/barra_blanca.webp'
  },
  {
    id: 'barra_dark',
    categoria: 'Barras de Chocolate',
    nombre: 'Barra Dark',
    precio: 1000,
    img: '/assets/productos/barra_dark.webp'
  },
  {
    id: 'barra_wonka',
    categoria: 'Barras de Chocolate',
    nombre: 'Barra Wonka',
    precio: 4000,
    img: '/assets/productos/barra_wonka.webp'
  },
  {
    id: 'barra_colores',
    categoria: 'Barras de Chocolate',
    nombre: 'Barra de colores',
    descripcion: 'Verde, azul, rosada, roja o blanca.',
    precio: 4000,
    img: '/assets/productos/barra_colores.webp'
  },
  {
    id: 'cono_manjar',
    categoria: 'Conos',
    nombre: 'Cono Manjar',
    descripcion: 'Solo o con salsa de frambuesa.',
    precio: 1000,
    img: '/assets/productos/cono_manjar.webp'
  },
  {
    id: 'cono_nutella',
    categoria: 'Conos',
    nombre: 'Cono Nutella',
    precio: 1500,
    img: '/assets/productos/cono_nutella.webp'
  },
  {
    id: 'paletas',
    categoria: 'Paletas',
    nombre: 'Paletas de colores',
    precio: 500,
    img: '/assets/productos/paletas.webp'
  }
];

// Productos de temporada o personalizados: no tienen precio fijo, se consultan por WhatsApp.
const CATALOGO_CONSULTAR = {
  categoria: 'Productos de Temporada',
  descripcion: 'Sorpresas, figuras y ediciones especiales. Precio a consultar según lo que tengas en mente.'
};

// Productos que solo se hacen a pedido: sin precio ni carrito, la tarjeta lleva a consultar por WhatsApp.
// Van en la sección "Productos de Temporada".
const A_PEDIDO = [
  {
    id: 'frutillas',
    nombre: 'Frutillas bañadas en chocolate',
    descripcion: 'Solo a pedido. Consulta disponibilidad y precio por WhatsApp.',
    img: '/assets/productos/frutillas.webp'
  }
];

// Galería de personalizados que ya hicimos (va bajo "Productos de Temporada" en la Tienda). No son productos con
// precio: cada foto abre WhatsApp para pedir uno parecido. Fotos en assets/personalizados/, sin nombres de clientes.
const PERSONALIZADOS = [
  { ocasion: 'Cumpleaños', foto: 'cumpleanos-amor.webp', alt: 'Cuchuflís con la frase "Feliz cumpleaños, amor de mi vida"' },
  { ocasion: 'Cumpleaños', foto: 'cumpleanos-bombones.webp', alt: 'Caja de bombones con letras que dicen "Feliz cumpleaños"' },
  { ocasion: 'Día de la Madre', foto: 'dia-de-la-madre.webp', alt: 'Tabletas decoradas con flores y las frases "Eres la mejor" y "Te amo mamá"' },
  { ocasion: 'Día del Padre', foto: 'dia-del-padre.webp', alt: 'Caja con alfajores y cuchuflís que dicen "Feliz día papito, eres el mejor papá del mundo"' },
  { ocasion: 'Para los hijos', foto: 'para-los-hijos.webp', alt: 'Caja con cuchuflís que dicen "No importa cuánto crezcas, siempre serás mi bebé" y alfajores "Te amo mucho"' },
  { ocasion: 'Día de la Enfermera', foto: 'dia-de-la-enfermera.webp', alt: 'Alfajores decorados que dicen "Feliz día, enfermera"' },
  { ocasion: 'Aniversario', foto: 'aniversario-corazon.webp', alt: 'Caja con forma de corazón llena de bombones' },
  { ocasion: 'Torre de cuchuflí', foto: 'torre-cuchufli.webp', alt: 'Torre de cuchuflís bañados con confites de colores' },
];
