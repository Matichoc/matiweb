// Script de pages/historia.html: antes estaba en línea; vive aquí para poder quitar 'unsafe-inline' de script-src.
document.addEventListener('DOMContentLoaded', () => {
    loadComponent('header', '../components/header.html', { base: '../' });
    loadComponent('page-banner', '../components/page-banner.html', { base: '../', emoji: '🛤️', titulo: 'Nuestro camino', subtitulo: 'Desde 2011, parada por parada' });
    loadComponent('footer', '../components/footer.html', { base: '../' });
});

// El camino se "llena de chocolate" a medida que se baja por la página.
(function () {
    const camino = document.getElementById('camino');
    const progreso = document.getElementById('caminoProgreso');
    let pendiente = false;
    function actualizar() {
        pendiente = false;
        const r = camino.getBoundingClientRect();
        const avance = Math.min(Math.max((window.innerHeight * 0.6 - r.top) / r.height, 0), 1);
        progreso.style.height = (avance * r.height) + 'px';
    }
    window.addEventListener('scroll', () => {
        if (!pendiente) { pendiente = true; requestAnimationFrame(actualizar); }
    }, { passive: true });
    window.addEventListener('resize', actualizar);
    actualizar();
})();

// Marca en la barra de años la etapa que se está leyendo: la última
// parada cuyo borde superior ya pasó por debajo del encabezado fijo y de la barra de años.
(function () {
    const links = new Map([...document.querySelectorAll('.hist-nav a')].map(a => [a.getAttribute('href').slice(1), a]));
    const paradas = [...document.querySelectorAll('.parada')];
    let actual = null;
    let pendiente = false;
    function marcar() {
        pendiente = false;
        const cab = document.getElementById('header');
        const barra = document.querySelector('.hist-nav');
        const limite = (cab ? cab.offsetHeight : 0) + (barra ? barra.offsetHeight : 0) + 40;
        let id = null;
        paradas.forEach((p) => {
            if (p.getBoundingClientRect().top <= limite) id = p.id;
        });
        if (id === actual) return;
        actual = id;
        links.forEach(a => a.classList.remove('activo'));
        const a = links.get(id);
        if (a) {
            a.classList.add('activo');
            const nav = a.parentElement;
            nav.scrollTo({ left: a.offsetLeft - (nav.clientWidth - a.offsetWidth) / 2, behavior: 'auto' });
        }
    }
    window.addEventListener('scroll', () => {
        if (!pendiente) { pendiente = true; requestAnimationFrame(marcar); }
    }, { passive: true });
    marcar();
})();
