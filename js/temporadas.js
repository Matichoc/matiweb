// Temporadas de Matichoc: el sitio se "viste" solo según la fecha de Chile (Navidad, Enamorados, Pascua…).
// Para programar una temporada basta con editar TEMPORADAS: se repite cada año, sin subir nada más.
// - `desde` / `hasta`: función que recibe el año y devuelve [mes, día] (meses 1–12). Ambos días se incluyen.
// - `emojis`: reemplazan a los destellos de los recuadros y del banner (siempre queda un 🍫 de la marca).
// - `cinta`: texto de la franja bajo el banner; lleva a los productos de temporada de la Tienda.
// - `imagen` (opcional): foto de portada de la temporada, ruta desde la raíz (ej. 'assets/temporadas/navidad.webp').
// Probar sin esperar la fecha: ?temporada=navidad, ?temporada=ninguna o ?fecha=2027-02-10.
// Debe cargarse ANTES de brillos.js. Con prefers-reduced-motion no se anima nada (solo cambia la cinta).
(function () {
  // Domingo número `n` de un mes (Día de la Madre, del Padre y del Niño en Chile).
  function domingo(anio, mes, n) {
    const primero = new Date(anio, mes - 1, 1).getDay();
    return [mes, 1 + ((7 - primero) % 7) + (n - 1) * 7];
  }
  // Domingo de Pascua (algoritmo de Meeus / anónimo gregoriano).
  function pascua(anio) {
    const a = anio % 19, b = Math.floor(anio / 100), c = anio % 100, d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
    return [mes, dia];
  }
  // Mueve una fecha [mes, día] `dias` días (negativo = antes).
  function mover(anio, [mes, dia], dias) {
    const f = new Date(anio, mes - 1, dia + dias);
    return [f.getMonth() + 1, f.getDate()];
  }

  const TEMPORADAS = [
    { id: 'enamorados', nombre: 'Día de los Enamorados', desde: () => [2, 1], hasta: () => [2, 14],
      emojis: ['❤️', '💕', '💝'], cinta: '💝 Día de los Enamorados: regala chocolate con tu mensaje' },
    { id: 'pascua', nombre: 'Pascua', desde: (a) => mover(a, pascua(a), -10), hasta: (a) => pascua(a),
      emojis: ['🐰', '🥚', '🌷'], cinta: '🐰 Pascua en Matichoc: sorpresas de temporada' },
    { id: 'madre', nombre: 'Día de la Madre', desde: () => [5, 1], hasta: (a) => domingo(a, 5, 2),
      emojis: ['💐', '🌷', '💖'], cinta: '💐 Día de la Madre: chocolates personalizados para mamá' },
    { id: 'padre', nombre: 'Día del Padre', desde: (a) => mover(a, domingo(a, 6, 3), -10), hasta: (a) => domingo(a, 6, 3),
      emojis: ['👔', '💙', '⭐'], cinta: '👔 Día del Padre: un regalo dulce para papá' },
    { id: 'nino', nombre: 'Día del Niño', desde: (a) => mover(a, domingo(a, 8, 2), -10), hasta: (a) => domingo(a, 8, 2),
      emojis: ['🎈', '🧸', '⭐'], cinta: '🎈 Día del Niño: regalos de temporada para encargar' },
    { id: 'patrias', nombre: 'Fiestas Patrias', desde: () => [9, 1], hasta: () => [9, 20],
      emojis: ['🪁', '⭐', '🎉'], cinta: '🪁 Fiestas Patrias en Matichoc' },
    { id: 'halloween', nombre: 'Halloween', desde: () => [10, 20], hasta: () => [10, 31],
      emojis: ['🎃', '🦇', '👻'], cinta: '🎃 Halloween en Matichoc: sorpresas de temporada' },
    { id: 'navidad', nombre: 'Navidad', desde: () => [11, 20], hasta: () => [12, 25],
      emojis: ['🎄', '❄️', '⭐', '🎁'], cinta: '🎄 Navidad en Matichoc: regalos y personalizados de temporada' }
  ];

  const params = new URLSearchParams(location.search);

  // Fecha de hoy en Chile como [año, mes, día] (o la de ?fecha= para probar).
  function hoy() {
    const prueba = /^(\d{4})-(\d{2})-(\d{2})$/.exec(params.get('fecha') || '');
    if (prueba) return [+prueba[1], +prueba[2], +prueba[3]];
    const t = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    return t.split('-').map(Number);
  }

  function activa() {
    const forzada = params.get('temporada');
    if (forzada) return TEMPORADAS.find((t) => t.id === forzada) || null; // ?temporada=ninguna → null
    const [anio, mes, dia] = hoy();
    const valor = mes * 100 + dia;
    return TEMPORADAS.find((t) => {
      const [m1, d1] = t.desde(anio), [m2, d2] = t.hasta(anio);
      return valor >= m1 * 100 + d1 && valor <= m2 * 100 + d2;
    }) || null;
  }

  const t = activa();
  window.MATICHOC_TEMPORADA = t; // brillos.js toma de aquí sus emojis
  if (!t) return;
  document.documentElement.classList.add('temporada', 'temporada-' + t.id);

  const enPages = location.pathname.includes('/pages/');
  const enTienda = /tienda\.html$/.test(location.pathname);
  const destino = (enTienda ? '' : (enPages ? '' : 'pages/') + 'tienda.html') + '#cat-productos-de-temporada';
  const adorno = (i) => (i % 3 === 0 ? '🍫' : t.emojis[i % t.emojis.length]);

  // Al llegar el banner (componente), cambia sus partículas y agrega la cinta debajo.
  document.addEventListener('matichoc:componente', (ev) => {
    const id = ev.detail && ev.detail.id;
    if (id !== 'banner' && id !== 'page-banner') return;
    const cont = document.getElementById(id);
    if (!cont) return;
    cont.querySelectorAll('.choco-particle').forEach((p, i) => { p.textContent = adorno(i + 1); });
    // Guirnalda de la temporada colgando arriba del banner (decorativa, se mece suave).
    const caja = cont.querySelector('.banner-section, .page-banner');
    if (caja && !caja.querySelector('.temporada-guirnalda')) {
      const g = document.createElement('div');
      g.className = 'temporada-guirnalda';
      g.setAttribute('aria-hidden', 'true');
      for (let i = 0; i < 14; i++) {
        const s = document.createElement('span');
        s.textContent = t.emojis[i % t.emojis.length];
        s.style.setProperty('--i', i);
        g.appendChild(s);
      }
      caja.prepend(g);
    }
    // Foto de portada propia de la temporada (opcional): `imagen: 'assets/temporadas/navidad.webp'`.
    const fondo = id === 'banner' && t.imagen && cont.querySelector('.banner-background');
    if (fondo) fondo.style.backgroundImage = `url('${t.imagen}')`;
    if (document.querySelector('.temporada-cinta')) return;
    const cinta = document.createElement('a');
    cinta.className = 'temporada-cinta';
    cinta.href = destino;
    cinta.textContent = t.cinta + ' →';
    cont.insertAdjacentElement('afterend', cinta);
  });
})();
