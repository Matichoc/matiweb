// Script de pages/la_maestra.html: antes estaba en línea; vive aquí para poder quitar 'unsafe-inline' de script-src.
document.addEventListener('DOMContentLoaded', () => {
    loadComponent('header', '../components/header.html', { base: '../' });
    loadComponent('page-banner', '../components/page-banner.html', { base: '../', emoji: '👩‍🍳', titulo: 'La Maestra Chocolatera', subtitulo: 'La mano detrás de cada chocolate' });
    loadComponent('footer', '../components/footer.html', { base: '../' });
});

// Visor de fotos: la miniatura elegida pasa a la foto grande.
(function () {
    const foto = document.getElementById('mFoto');
    const minis = [...document.querySelectorAll('.m-mini')];
    minis.forEach((m, i) => m.addEventListener('click', () => {
        foto.src = m.dataset.foto;
        foto.alt = 'Inés Saavedra, maestra chocolatera de Matichoc (foto ' + (i + 1) + ' de ' + minis.length + ')';
        minis.forEach(x => x.removeAttribute('aria-current'));
        m.setAttribute('aria-current', 'true');
    }));
})();

// Pestañas accesibles (flechas, Inicio y Fin). Sin JS se ven todos los paneles.
(function () {
    const cont = document.getElementById('mTabs');
    const tabs = [...cont.querySelectorAll('[role="tab"]')];
    const paneles = tabs.map(t => document.getElementById(t.getAttribute('aria-controls')));
    const reducir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    cont.classList.add('m-tabs-js');
    function activar(i, enfocar) {
        tabs.forEach((t, j) => {
            const on = i === j;
            t.setAttribute('aria-selected', on ? 'true' : 'false');
            t.tabIndex = on ? 0 : -1;
            paneles[j].hidden = !on;
            paneles[j].classList.remove('m-anima');
        });
        if (!reducir) { void paneles[i].offsetWidth; paneles[i].classList.add('m-anima'); }
        if (enfocar) tabs[i].focus();
        tabs[i].scrollIntoView({ block: 'nearest', inline: 'center' });
    }
    paneles.forEach((p, j) => { p.hidden = j !== 0; });
    tabs.forEach((t, i) => {
        t.addEventListener('click', () => activar(i, false));
        t.addEventListener('keydown', (e) => {
            const n = tabs.length;
            const map = { ArrowRight: (i + 1) % n, ArrowLeft: (i + n - 1) % n, Home: 0, End: n - 1 };
            if (e.key in map) { e.preventDefault(); activar(map[e.key], true); }
        });
    });
})();
