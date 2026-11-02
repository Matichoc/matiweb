// Puntos de venta de Matichoc — única fuente de verdad. Para sumar un
// negocio, agrégalo aquí y aparece en el inicio y en Contacto.
// `lugar` es opcional; `proximamente: true` lo muestra con la etiqueta
// "Próximamente" hasta que empiece a vender (entonces se borra esa marca).
const PUNTOS_VENTA = [
  { nombre: 'Almacén Pablito' },
  { nombre: 'Almacén Aramir' },
  { nombre: 'Almacén Angelito', lugar: 'Las Salinas de Pullally' },
  { nombre: 'Almacén Emma', lugar: 'Población San Expedito' },
  { nombre: 'Almacén Abish', lugar: 'Longotoma con Zapallar, parte alta de La Ligua' },
  { nombre: 'Local La Pingüinita', lugar: 'Los Molles' },
  { nombre: 'Roots Salinas', lugar: 'Las Salinas de Pullally', proximamente: true },
];

const MENSAJE_VENDER = '¡Hola Matichoc! Tengo un negocio y me interesa vender sus productos.\nMi negocio se llama: \nEstá en: ';

function renderPuntosVenta() {
  document.querySelectorAll('[data-puntos-venta]').forEach((el) => {
    const lista = document.createElement('ul');
    lista.className = 'pv-lista';
    PUNTOS_VENTA.forEach((p) => {
      const li = document.createElement('li');
      li.className = p.proximamente ? 'pv-item pv-item--pronto' : 'pv-item';
      const icono = document.createElement('span');
      icono.className = 'pv-icono';
      icono.setAttribute('aria-hidden', 'true');
      icono.textContent = '🏪';
      const texto = document.createElement('span');
      texto.className = 'pv-texto';
      const nombre = document.createElement('strong');
      nombre.textContent = p.nombre;
      texto.appendChild(nombre);
      if (p.lugar) {
        const lugar = document.createElement('span');
        lugar.className = 'pv-lugar';
        lugar.textContent = p.lugar;
        texto.appendChild(lugar);
      }
      if (p.proximamente) {
        const pronto = document.createElement('span');
        pronto.className = 'pv-pronto';
        pronto.textContent = 'Próximamente';
        texto.appendChild(pronto);
      }
      li.append(icono, texto);
      lista.appendChild(li);
    });
    el.replaceChildren(lista);
  });

  document.querySelectorAll('[data-vender-matichoc]').forEach((a) => {
    a.href = `https://wa.me/56975645591?text=${encodeURIComponent(MENSAJE_VENDER)}`;
  });
}

document.addEventListener('DOMContentLoaded', renderPuntosVenta);
