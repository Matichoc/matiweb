// Fuente única de verdad para el catálogo de Matichoc.
// Productos.html y tienda.html leen de aquí — no dupliques precios a mano.
const CATALOGO = [
  {
    id: 'alfajor',
    categoria: 'Alfajores',
    nombre: 'Alfajor',
    descripcion: 'Tradicional, frambuesa, tres leches, menta, naranja, trufa, nuez, pistacho, lúcuma, pie de limón, maracuyá, capuchino o café moka.',
    precio: 1000,
    img: 'https://i.imgur.com/C01CAjn.jpg'
  },
  {
    id: 'alfajor_personalizado',
    categoria: 'Alfajores',
    nombre: 'Alfajor personalizado',
    descripcion: 'Cualquiera de los sabores anteriores, con frase simple o dibujo simple.',
    precio: 1500,
    img: 'https://i.imgur.com/WSv71hy.jpg'
  },
  {
    id: 'alfajor_oreo_bonbon',
    categoria: 'Alfajores',
    nombre: 'Alfajor Oreo o Bon o Bon',
    precio: 1500,
    img: 'https://i.imgur.com/ncBRyei.jpg'
  },
  {
    id: 'cuchufli',
    categoria: 'Cuchuflí',
    nombre: 'Cuchuflí tradicional',
    descripcion: 'Bolsa de 3.',
    precio: 1000,
    img: 'https://i.imgur.com/KvjlYTA.jpg'
  },
  {
    id: 'cuchufli_personalizado',
    categoria: 'Cuchuflí',
    nombre: 'Cuchuflí personalizado',
    descripcion: 'Bolsa de 3, con frase o formas.',
    precio: 2000,
    img: 'https://i.imgur.com/4CAvQAT.jpg'
  },
  {
    id: 'torta_cuchufli',
    categoria: 'Cuchuflí',
    nombre: 'Torta de cuchuflí',
    descripcion: '30 cuchuflí con toppings.',
    precio: 14000,
    img: 'https://i.imgur.com/Mgd5CIN.jpg'
  },
  {
    id: 'prestigios',
    categoria: 'Prestigios',
    nombre: 'Prestigios',
    descripcion: 'Bolsa de 2 unidades.',
    precio: 1500,
    img: 'https://i.imgur.com/VvGQWV1.jpg'
  },
  {
    id: 'bolitas_pie_limon',
    categoria: 'Bolitas Pie de Limón',
    nombre: 'Bolitas Pie de Limón',
    descripcion: 'Bolsa de 2 unidades.',
    precio: 1500,
    img: 'https://i.imgur.com/o5ofqlW.jpg'
  },
  {
    id: 'matidubai',
    categoria: 'Matidubai',
    nombre: 'Matidubai',
    descripcion: 'Chocolate de Dubai 100% artesanal, con pistacho natural y fideo kataifi crocante.',
    precio: 13000,
    img: 'https://i.imgur.com/FcrTH9K.jpg'
  },
  {
    id: 'mini_dubai',
    categoria: 'Matidubai',
    nombre: 'Mini Dubai',
    precio: 2000,
    img: 'https://i.imgur.com/FcrTH9K.jpg'
  },
  {
    id: 'bombas',
    categoria: 'Bombas de Chocolate',
    nombre: 'Bombas de Chocolate',
    descripcion: 'Ideales para la leche, de café o Milo. Incluyen marshmallow.',
    precio: 1500,
    img: 'https://i.imgur.com/dkkIZCU.jpg'
  },
  {
    id: 'barra_nikolo',
    categoria: 'Barras de Chocolate',
    nombre: 'Barra Nikolo',
    precio: 1000,
    img: 'https://i.imgur.com/0IzB6cW.jpg'
  },
  {
    id: 'barra_blanca',
    categoria: 'Barras de Chocolate',
    nombre: 'Barra pequeña blanca',
    precio: 1000,
    img: 'https://i.imgur.com/eO1gzDB.jpg'
  },
  {
    id: 'barra_dark',
    categoria: 'Barras de Chocolate',
    nombre: 'Barra Dark',
    precio: 1000,
    img: 'https://i.imgur.com/0L0iFSV.jpg'
  },
  {
    id: 'barra_wonka',
    categoria: 'Barras de Chocolate',
    nombre: 'Barra Wonka',
    precio: 4000,
    img: 'https://i.imgur.com/GboR5zb.jpg'
  },
  {
    id: 'barra_colores',
    categoria: 'Barras de Chocolate',
    nombre: 'Barra de colores',
    descripcion: 'Verde, azul, rosada, roja o blanca.',
    precio: 4000,
    img: 'https://i.imgur.com/HFT67A3.jpg'
  },
  {
    id: 'cono_manjar',
    categoria: 'Conos',
    nombre: 'Cono Manjar',
    descripcion: 'Solo o con salsa de frambuesa.',
    precio: 1000,
    img: 'https://i.imgur.com/x7xTgWJ.jpg'
  },
  {
    id: 'cono_nutella',
    categoria: 'Conos',
    nombre: 'Cono Nutella',
    precio: 1500,
    img: 'https://i.imgur.com/VrVpwh8.jpg'
  },
  {
    id: 'paletas',
    categoria: 'Paletas',
    nombre: 'Paletas de colores',
    precio: 500,
    img: 'https://i.imgur.com/wDYCiyP.jpg'
  }
];

// Productos de temporada o personalizados: no tienen precio fijo, se consultan por WhatsApp.
const CATALOGO_CONSULTAR = {
  categoria: 'Productos de Temporada',
  descripcion: 'Sorpresas, figuras y ediciones especiales. Precio a consultar según lo que tengas en mente.'
};
