// Aparición suave al hacer scroll para elementos con [data-reveal].
// Sin JS, o con prefers-reduced-motion, todo se ve de entrada (la clase
// html.js-reveal solo se agrega cuando la animación corresponde).
(function () {
  const reducir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducir || !('IntersectionObserver' in window)) return;
  document.documentElement.classList.add('js-reveal');
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add('is-visible');
        obs.unobserve(e.target);
      }
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-reveal]').forEach((el) => obs.observe(el));
  });
})();
