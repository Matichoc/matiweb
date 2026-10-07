// Puntos de venta de Matichoc — única fuente de verdad. Para sumar un
// negocio, agrégalo aquí y aparece en el inicio y en Contacto.
const PUNTOS_VENTA = [
  { nombre: 'Almacén Pablito' },
  { nombre: 'Almacén Aramir' },
];

const MENSAJE_VENDER = '¡Hola Matichoc! Tengo un negocio y me interesa vender sus productos.\nMi negocio se llama: \nEstá en: ';

function renderPuntosVenta() {
  document.querySelectorAll('[data-puntos-venta]').forEach((el) => {
    const lista = document.createElement('ul');
    lista.className = 'pv-lista';
    PUNTOS_VENTA.forEach((p) => {
      const li = document.createElement('li');
      li.className = 'pv-item';
      const icono = document.createElement('span');
      icono.className = 'pv-icono';
      icono.setAttribute('aria-hidden', 'true');
      icono.textContent = '🏪';
      const nombre = document.createElement('strong');
      nombre.textContent = p.nombre;
      li.append(icono, nombre);
      lista.appendChild(li);
    });
    el.replaceChildren(lista);
  });

  document.querySelectorAll('[data-vender-matichoc]').forEach((a) => {
    a.href = `https://wa.me/56975645591?text=${encodeURIComponent(MENSAJE_VENDER)}`;
  });
}

document.addEventListener('DOMContentLoaded', renderPuntosVenta);
