// Script de pages/opiniones.html: antes estaba en línea; vive aquí para poder quitar 'unsafe-inline' de script-src.
document.addEventListener('DOMContentLoaded', () => {
    loadComponent('header', '../components/header.html', { base: '../' });
    loadComponent('page-banner', '../components/page-banner.html', { base: '../', emoji: '💬', titulo: 'Opiniones', subtitulo: 'Lo que dicen nuestros Matilovers' });
    loadComponent('footer', '../components/footer.html', { base: '../' });
});

let currentIndex = 0;
const track = document.querySelector('.carousel-track');
const cards = document.querySelectorAll('.opinion-card');
const totalCards = cards.length;

// Debe coincidir con los breakpoints de .opinion-card en el <style> de arriba.
function getCardsPerPage() {
    if (window.innerWidth <= 600) return 1;
    if (window.innerWidth <= 900) return 2;
    return 3;
}

function updateCarousel() {
    const cardsPerPage = getCardsPerPage();
    if (currentIndex > totalCards - cardsPerPage) {
        currentIndex = Math.max(0, totalCards - cardsPerPage);
    }
    const carouselWidth = track.offsetWidth;
    const cardWidth = carouselWidth / cardsPerPage; // Ancho de cada tarjeta
    track.style.transform = `translateX(-${currentIndex * cardWidth}px)`;
}

function moveCarousel(direction) {
    const cardsPerPage = getCardsPerPage();
    currentIndex += direction;
    if (currentIndex < 0) {
        currentIndex = totalCards - cardsPerPage;
    } else if (currentIndex > totalCards - cardsPerPage) {
        currentIndex = 0;
    }
    updateCarousel();
}

// Ajustar el carrusel al cargar y redimensionar la ventana
window.addEventListener('resize', updateCarousel);
updateCarousel(); // Llamar al inicio para posicionar correctamente

// Deslizar con el dedo en mobile.
let touchStartX = null;
track.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
track.addEventListener('touchend', (e) => {
    if (touchStartX === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 40) moveCarousel(dx < 0 ? 1 : -1);
    touchStartX = null;
});

// Botones del carrusel (antes eran onclick en línea, que la CSP no permite).
document.querySelector('.carousel-button.prev').addEventListener('click', () => moveCarousel(-1));
document.querySelector('.carousel-button.next').addEventListener('click', () => moveCarousel(1));
