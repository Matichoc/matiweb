// Puntos de venta de Matichoc — única fuente de verdad. Para sumar un
// negocio, agrégalo aquí y aparece en el inicio y en Contacto.
// Campos opcionales:
// - `lugar`: se muestra al pasar el mouse o al tocar la tarjeta.
// - `foto`: ruta desde la raíz del sitio (ej. 'assets/puntos-venta/angelito.webp',
//   cuadrada); sin foto se usa la genérica del stand con el logo.
// - `mapa`: enlace de Google Maps; el lugar se vuelve un enlace para abrirlo.
// - `redes`: [{ nombre: 'Instagram', url: 'https://...' }], aparecen junto al lugar.
// - `proximamente: true`: etiqueta "Próximamente" hasta que empiece a vender.
const PUNTOS_VENTA = [
  { nombre: 'Almacén El Pablito', lugar: 'Villa Futuro, La Ligua', foto: 'assets/puntos-venta/el-pablito.webp' },
  { nombre: 'Almacén Aramir', lugar: 'Departamentos de Rayado, La Ligua', foto: 'assets/puntos-venta/aramir.webp' },
  { nombre: 'Almacén Angelito', lugar: 'Las Salinas de Pullally, Papudo', foto: 'assets/puntos-venta/angelito.webp' },
  { nombre: 'Almacén Emma', lugar: 'Población San Expedito, La Ligua', foto: 'assets/puntos-venta/emma.webp', mapa: 'https://maps.app.goo.gl/CQrCt49YVmGC1uU9A' },
  { nombre: 'Almacén Abish', lugar: 'Población Jorge Tellier, La Ligua', foto: 'assets/puntos-venta/abish.webp' },
  { nombre: 'La Pingüinita', lugar: 'Los Molles', foto: 'assets/puntos-venta/la-pinguinita.webp', mapa: 'https://maps.app.goo.gl/fJdgynnxsTja4dFf8' },
  { nombre: 'Roots Salinas', lugar: 'Las Salinas de Pullally', foto: 'assets/puntos-venta/roots-salinas.webp', mapa: 'https://maps.app.goo.gl/UbnrtSabfwbyCBqn8', proximamente: true },
];

const PV_FOTO_GENERICA = 'assets/puntos-venta/generico.webp';
// Segundos que tarda cada tarjeta en pasar; con más negocios la vuelta dura más.
const PV_SEGUNDOS_POR_TARJETA = 4;

const MENSAJE_VENDER = '¡Hola Matichoc! Tengo un negocio y me interesa vender sus productos.\nMi negocio se llama: \nEstá en: ';

// Las páginas dentro de /pages/ necesitan subir un nivel para llegar a assets/.
function pvRaiz() {
  return /\/pages\//.test(location.pathname) ? '../' : '';
}

function crearTarjetaPV(p, copia) {
  const li = document.createElement('li');
  li.className = p.proximamente ? 'pv-item pv-item--pronto' : 'pv-item';
  // La segunda vuelta del carrusel es solo visual: los lectores de pantalla y el
  // teclado recorren la lista una sola vez.
  if (copia) li.setAttribute('aria-hidden', 'true');
  else li.tabIndex = 0;

  const marco = document.createElement('div');
  marco.className = 'pv-foto';
  const img = document.createElement('img');
  img.src = pvRaiz() + (p.foto || PV_FOTO_GENERICA);
  img.alt = '';
  img.width = 300;
  img.height = 300;
  // Sin loading="lazy": dentro de la fila en movimiento el navegador las
  // posterga y las tarjetas quedan vacías un buen rato.
  img.decoding = 'async';
  marco.appendChild(img);

  if (p.proximamente) {
    const pronto = document.createElement('span');
    pronto.className = 'pv-pronto';
    pronto.textContent = 'Próximamente';
    marco.appendChild(pronto);
  }

  if (p.lugar || (p.redes && p.redes.length)) {
    const info = document.createElement('div');
    info.className = 'pv-info';
    if (p.lugar) {
      const lugar = document.createElement(p.mapa ? 'a' : 'span');
      lugar.className = 'pv-lugar';
      lugar.textContent = `📍 ${p.lugar}`;
      if (p.mapa) {
        lugar.href = p.mapa;
        lugar.target = '_blank';
        lugar.rel = 'noopener noreferrer';
        lugar.setAttribute('aria-label', `Ver ${p.nombre} en el mapa: ${p.lugar}`);
        if (copia) lugar.tabIndex = -1;
      }
      info.appendChild(lugar);
    }
    (p.redes || []).forEach((r) => {
      const a = document.createElement('a');
      a.className = 'pv-red';
      a.href = r.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = r.nombre;
      if (copia) a.tabIndex = -1;
      info.appendChild(a);
    });
    marco.appendChild(info);
  }

  const nombre = document.createElement('strong');
  nombre.className = 'pv-nombre';
  nombre.textContent = p.nombre;
  li.append(marco, nombre);
  return li;
}

function renderPuntosVenta() {
  document.querySelectorAll('[data-puntos-venta]').forEach((el) => {
    const carrusel = document.createElement('div');
    carrusel.className = 'pv-carrusel';
    const lista = document.createElement('ul');
    lista.className = 'pv-lista';
    lista.style.setProperty('--pv-duracion', `${PUNTOS_VENTA.length * PV_SEGUNDOS_POR_TARJETA}s`);
    // Dos vueltas seguidas: la animación avanza media pista y empalma sin salto.
    [false, true].forEach((copia) => {
      PUNTOS_VENTA.forEach((p) => lista.appendChild(crearTarjetaPV(p, copia)));
    });
    carrusel.appendChild(lista);
    el.replaceChildren(carrusel);
  });

  document.querySelectorAll('[data-vender-matichoc]').forEach((a) => {
    a.href = `https://wa.me/56975645591?text=${encodeURIComponent(MENSAJE_VENDER)}`;
  });
}

document.addEventListener('DOMContentLoaded', renderPuntosVenta);
