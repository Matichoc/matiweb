// Brillitos de fondo para los recuadros: chocolates y destellos que suben detrás
// del contenido, igual que en el Hero. Solo CSS para animar; este script únicamente
// agrega la capa a cada recuadro (incluidos los que se crean después, como las
// tarjetas de la tienda) y la activa mientras el recuadro está en pantalla.
// Con prefers-reduced-motion no hace nada: no hay animación, no hay capa.
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const SELECTOR = [
    '#bienvenida', '.pv-seccion', '.pv-cta', '#racha-widget .racha-card',
    '.parada-card', '.hist-stats li',
    '.m-panel', '.m-datos li', '.m-cita', '.m-medio',
    '.t-card', '.t-pasos li', '.t-aviso',
    '.opinion-card', '.resena-cta',
    '.privacidad-bloque', '.terminos-bloque', '.choco-fondo-auto'
  ].join(',');

  // Tres brillitos por recuadro, con posición y ritmo distintos según el orden.
  const EMOJIS = ['🍫', '✨', '✨'];
  const XS = [8, 44, 78, 22, 60, 90, 34, 70];
  let contador = 0;

  const visibilidad = 'IntersectionObserver' in window
    ? new IntersectionObserver((entradas) => {
        entradas.forEach((e) => e.target.classList.toggle('is-activo', e.isIntersecting));
      }, { rootMargin: '80px' })
    : null;

  function decorar(caja) {
    if (caja.querySelector(':scope > .brillos')) return;
    const capa = document.createElement('span');
    capa.className = 'brillos';
    capa.setAttribute('aria-hidden', 'true');
    EMOJIS.forEach((emoji, i) => {
      const n = contador++;
      const b = document.createElement('i');
      b.textContent = emoji;
      b.style.setProperty('--x', XS[n % XS.length] + '%');
      b.style.setProperty('--dur', (8 + (n * 3) % 6) + 's');
      b.style.setProperty('--delay', (-(i * 3) - (n % 4)) + 's');
      capa.appendChild(b);
    });
    caja.classList.add('choco-fondo');
    caja.appendChild(capa);
    if (visibilidad) visibilidad.observe(caja); else caja.classList.add('is-activo');
  }

  function recorrer(raiz) {
    if (raiz.nodeType !== 1) return;
    if (raiz.matches(SELECTOR)) decorar(raiz);
    raiz.querySelectorAll(SELECTOR).forEach(decorar);
  }

  document.addEventListener('DOMContentLoaded', () => {
    recorrer(document.body);
    // Recuadros que aparecen después (tienda, widget de racha, componentes).
    new MutationObserver((cambios) => {
      cambios.forEach((c) => c.addedNodes.forEach(recorrer));
    }).observe(document.body, { childList: true, subtree: true });
  });
})();
