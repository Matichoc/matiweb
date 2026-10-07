// Página 404: rutas absolutas porque se sirve desde cualquier dirección inexistente.
document.addEventListener('DOMContentLoaded', () => {
  loadComponent('header', '/components/header.html', { base: '/' });
  loadComponent('page-banner', '/components/page-banner.html', { base: '/', emoji: '🍫', titulo: 'Ups, página no encontrada', subtitulo: 'Pero los chocolates siguen aquí' });
  loadComponent('footer', '/components/footer.html', { base: '/' });
});
