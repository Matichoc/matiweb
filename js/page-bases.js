// Script de pages/bases-matilover.html (sin scripts en línea por la CSP).
document.addEventListener('DOMContentLoaded', () => {
    loadComponent('header', '../components/header.html', { base: '../' });
    loadComponent('page-banner', '../components/page-banner.html', { base: '../', emoji: '🎁', titulo: 'Bases del programa', subtitulo: 'Racha, cupones y premios de los Matilovers' });
    loadComponent('footer', '../components/footer.html', { base: '../' });
});
