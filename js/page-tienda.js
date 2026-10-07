// Script de pages/tienda.html: antes estaba en línea; vive aquí para poder quitar 'unsafe-inline' de script-src.
document.addEventListener('DOMContentLoaded', () => {
  loadComponent('header', '../components/header.html', { base: '../' });
  loadComponent('page-banner', '../components/page-banner.html', { base: '../', emoji: '🛍️', titulo: 'Nuestra tienda', subtitulo: 'Chocolates artesanales hechos en La Ligua' });
  loadComponent('footer', '../components/footer.html', { base: '../' });
});
