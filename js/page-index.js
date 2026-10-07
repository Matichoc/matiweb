// Script de index.html: antes estaba en línea; vive aquí para poder quitar 'unsafe-inline' de script-src.
document.addEventListener('DOMContentLoaded', () => {
  loadComponent('header', 'components/header.html', { base: '' });
  loadComponent('banner', 'components/banner.html');
  loadComponent('footer', 'components/footer.html', { base: '' });
});
