// Script de pages/contacto.html: antes estaba en línea; vive aquí para poder quitar 'unsafe-inline' de script-src.
document.addEventListener('DOMContentLoaded', () => {
  loadComponent('header', '../components/header.html', { base: '../' });
  loadComponent('page-banner', '../components/page-banner.html', { base: '../', emoji: '📲', titulo: 'Contáctanos', subtitulo: 'Escríbenos y te respondemos por WhatsApp' });
  loadComponent('footer', '../components/footer.html', { base: '../' });
});

document.getElementById('contacto-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const nombre = document.getElementById('contacto-nombre').value.trim();
  const motivo = document.getElementById('contacto-motivo').value;
  const mensaje = document.getElementById('contacto-mensaje').value.trim();
  const texto = `¡Hola Matichoc! Soy ${nombre}.\nMotivo: ${motivo}\n\n${mensaje}`;
  window.open(`https://wa.me/56975645591?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
});
