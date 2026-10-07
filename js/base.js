async function loadComponent(id, path, vars = {}) {
  try {
    const response = await fetch(path);
    if (!response.ok) throw new Error('Error cargando ' + path);
    let html = await response.text();
    for (const [key, value] of Object.entries(vars)) {
      html = html.split(`{{${key}}}`).join(value);
    }
    const target = document.getElementById(id);
    if (target) {
      target.innerHTML = html;
      document.dispatchEvent(new CustomEvent('matichoc:componente', { detail: { id } }));
    }
  } catch (error) {
    console.error(error);
  }
}

// Menú mobile del header (components/header.html). Delegado en `document`
// porque el header se inyecta de forma async vía loadComponent — así no
// importa si el botón todavía no existe cuando corre este script.
document.addEventListener('click', (event) => {
  const toggle = event.target.closest('.nav-toggle');
  if (toggle) {
    const nav = document.getElementById(toggle.getAttribute('aria-controls'));
    if (!nav) return;
    const isOpen = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(isOpen));
    return;
  }
  // Cerrar el menú al elegir un link (mobile).
  const navLink = event.target.closest('.site-nav a');
  if (navLink) {
    const nav = navLink.closest('.site-nav');
    const header = navLink.closest('.site-header');
    const navToggle = header && header.querySelector('.nav-toggle');
    if (nav && nav.classList.contains('is-open')) {
      nav.classList.remove('is-open');
      if (navToggle) navToggle.setAttribute('aria-expanded', 'false');
    }
  }
});

// Alto real del encabezado fijo (cambia al abrir el menú en celular) para que las barras
// pegadas debajo (Historia, Tienda) y los saltos a anclas no queden tapados.
(function () {
  const cab = document.getElementById('header');
  if (!cab || !('ResizeObserver' in window)) return;
  new ResizeObserver(() => {
    document.documentElement.style.setProperty('--header-h', cab.offsetHeight + 'px');
  }).observe(cab);
})();
