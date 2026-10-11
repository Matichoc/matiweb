// Matichico y Chocolatina, los guías del sitio (se alternan: un día uno, otro día la otra).
//
// Reglas de diseño (acordadas con el dueño):
// - Solo INFORMA con lo que el sitio ya dice (cómo pedir, entregas, pagos, programa Matilover, historia,
//   contacto, datos legales). No recomienda ni promociona productos, ni opina de salud o ingredientes:
//   para eso manda a WhatsApp.
// - No usa inteligencia artificial libre: es un guion cerrado (palabras clave -> respuestas fijas), por eso
//   nunca inventa nada. Si no sabe, lo dice y ofrece WhatsApp.
// - No envía ni guarda lo que se escribe (queda solo en la pantalla). Lo único que recuerda, mientras la
//   pestaña está abierta, es si la persona lo despidió (sessionStorage), para no insistir.
// - Accesible: habla (voz del navegador, SpeechSynthesis: lee sus respuestas, los pasos del recorrido y, si se lo piden, la página),
//   tiene un enlace de salto al inicio de la página para lectores de pantalla y teclado, "Letra grande" y mensajes anunciados
//   con aria-live. La voz solo lee texto del propio sitio (nada personal) y no se activa sola.
// - Respeta "reducir movimiento" y se maneja con teclado. No aparece en el juego, el panel, "Mi cuenta"
//   ni mientras el carrito está abierto (cada página decide si carga este script).
(function () {
  'use strict';

  const SRC = document.currentScript && document.currentScript.src;
  const RAIZ = SRC ? new URL('../', SRC).href : '/';
  const PAGINA = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const REDUCIR = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const WSP = '56975645591';
  const CLAVE = 'matichico-despedido';
  const RETRASO = 6000; // llega saltando unos segundos después de entrar

  const guardado = (k, v) => { try { return v === undefined ? sessionStorage.getItem(k) : sessionStorage.setItem(k, v); } catch (e) { return null; } };
  const DESPEDIDO = !!guardado(CLAVE); // si lo despidieron en esta pestaña, solo queda el botón para volver a llamarlo

  const ruta = (r) => new URL(r, RAIZ).href;
  const wsp = (texto) => `https://wa.me/${WSP}` + (texto ? `?text=${encodeURIComponent(texto)}` : '');

  // ---------- Lo que sabe (todo sale de lo que el sitio ya dice) ----------
  const WA = { texto: '💬 Hablar con una persona por WhatsApp', href: wsp('Hola, tengo una consulta') };
  const SABE = [
    { id: 'salud', prioridad: 10,
      claves: ['alergi', 'alergeno', 'gluten', 'leche', 'huevo', 'frutos secos', 'mani', 'soya', 'azucar', 'sello', 'ingrediente', 'salud', 'diabet', 'caloria', 'nutricional', 'vegano', 'celiac', 'lactosa', 'porcion', 'dieta'],
      resp: 'Para ingredientes, alergias y todo lo de salud prefiero que te responda una persona 🙏 Escríbenos por WhatsApp antes de comprar y te decimos exactamente qué lleva el producto que te interesa.',
      links: [WA] },
    { id: 'saludo', claves: ['hola', 'holi', 'buenas', 'buen dia', 'buenos dias', 'buenas tardes', 'hey', 'saludos'],
      resp: '¡Hola! Soy {nombre} 🍫 Te puedo ayudar a recorrer el sitio y contarte cómo pedir, cómo son las entregas y más. ¿Qué te gustaría saber?' },
    { id: 'gracias', claves: ['gracias', 'chao', 'adios', 'hasta luego', 'listo', 'ok gracias'],
      resp: '¡De nada! 💛 Si necesitas algo más, aquí estoy.' },
    { id: 'comprar', claves: ['comprar', 'compro', 'pedir', 'pido', 'pedido', 'encargar', 'encargo', 'como hago', 'carrito', 'ordenar'],
      resp: 'Es fácil 🍫 En la Tienda eliges lo que quieras y abres "Ver pedido". Escribes tu nombre y celular y lo envías por WhatsApp. Te respondemos para confirmar disponibilidad, total, forma de pago y entrega: el pedido queda confirmado cuando te lo confirmamos.',
      links: [{ texto: 'Ir a la Tienda', href: ruta('pages/tienda.html') }] },
    { id: 'pagos', claves: ['pago', 'pagar', 'tuu', 'tarjeta', 'transferencia', 'efectivo', 'comprobante', 'ya pague', 'deposito'],
      resp: 'Puedes pagar en efectivo o por transferencia (lo coordinamos por WhatsApp) o con tarjeta online en Tuu, con el botón "Pagar online con Tuu". Si ya pagaste, envíanos tu comprobante (una captura o foto) por WhatsApp: tu pedido se confirma cuando lo recibimos y verificamos el pago.',
      links: [{ texto: 'Términos y condiciones', href: ruta('pages/terminos.html') }] },
    { id: 'entregas', claves: ['entrega', 'entregan', 'despacho', 'envio', 'envian', 'enviar', 'retiro', 'retirar', 'donde', 'region', 'blue', 'stand', 'plaza', 'domicilio', 'courier', 'santiago'],
      resp: 'Las entregas son los martes y jueves en nuestro stand de la plaza de La Ligua. Otro día lo coordinamos por WhatsApp y entregamos en nuestro domicilio. También enviamos por pagar: a regiones por Blue Express, y el costo del envío lo pagas tú al recibir.',
      links: [{ texto: 'Dónde encontrarnos', href: ruta('pages/contacto.html') }] },
    { id: 'programa', claves: ['racha', 'cupon', 'premio', 'descuento', 'matilover', 'programa', 'puntos', 'gratis'],
      resp: 'Los Matilovers pueden guardar su racha: 7 días seguidos dan un cupón de 10% de descuento, y 10 pedidos entregados dan 1 cuchuflí o alfajor gratis. Cada cupón dura 30 días, es de un solo uso y no se acumula con otros. Las cuentas son desde los 14 años.',
      links: [{ texto: 'Ver las bases del programa', href: ruta('pages/bases-matilover.html') }] },
    { id: 'cuenta', claves: ['cuenta', 'registr', 'iniciar sesion', 'login', 'ingresar', 'mi cuenta', 'sesion', 'contrasena'],
      resp: 'Puedes crear tu cuenta Matilover gratis (desde los 14 años). Es opcional: sin cuenta igual puedes navegar, comprar y jugar; la cuenta solo guarda tu progreso.',
      links: [{ texto: 'Ir a Mi cuenta', href: ruta('pages/cuenta.html') }] },
    { id: 'historia', claves: ['historia', 'origen', 'empezo', 'comenzo', 'nacio', '2011', 'desde cuando', 'quienes son', 'quienes somos', 'familia'],
      resp: 'Matichoc nació en 2011: Inés Saavedra empezó con una libreta y un coche, anotando los primeros pedidos para fechas importantes como el Día de la Madre. Hoy somos una chocolatería artesanal y familiar de La Ligua.',
      links: [{ texto: 'Recorrer la Historia', href: ruta('pages/historia.html') }] },
    { id: 'maestra', claves: ['ines', 'maestra', 'fundadora', 'saavedra', 'chocolatera'],
      resp: 'Inés Saavedra es la fundadora de Matichoc y nuestra maestra chocolatera. Puedes conocerla en la página de La Maestra.',
      links: [{ texto: 'Conocer a La Maestra', href: ruta('pages/la_maestra.html') }] },
    { id: 'personalizados', claves: ['personaliz', 'frase', 'dibujo', 'cumple', 'evento', 'a medida', 'especial'],
      resp: 'Los productos personalizados (frases, dibujos, formas, cajas con mensaje) se acuerdan por WhatsApp. Revisa bien el texto y los detalles antes de confirmar, porque se hacen especialmente para ti.',
      links: [WA] },
    { id: 'cambios', claves: ['devol', 'cambio', 'reclamo', 'garantia', 'retracto', 'sernac', 'danado', 'mal estado'],
      resp: 'Si tu pedido llega dañado, en mal estado o distinto de lo acordado, escríbenos por WhatsApp apenas lo recibas, con fotos, y lo resolvemos. Todo está explicado en los Términos y condiciones.',
      links: [{ texto: 'Términos y condiciones', href: ruta('pages/terminos.html') }, WA] },
    { id: 'precios', claves: ['precio', 'cuanto', 'cuesta', 'valor', 'vale', 'cotiz', 'barato', 'caro'],
      resp: 'Los precios están siempre al día en la Tienda. Los productos personalizados y de temporada se cotizan por WhatsApp.',
      links: [{ texto: 'Ver la Tienda', href: ruta('pages/tienda.html') }] },
    { id: 'legal', claves: ['rut', 'razon social', 'resolucion', 'sanitaria', 'legal', 'terminos', 'privacidad', 'datos personales', 'empresa'],
      resp: 'Somos Chocolatería Matichoc Inés Saavedra EIRL, RUT 77.877.372-4, con resolución sanitaria N° 2505129791. Puedes leer los Términos y la Política de Privacidad.',
      links: [{ texto: 'Términos', href: ruta('pages/terminos.html') }, { texto: 'Privacidad', href: ruta('pages/privacidad.html') }] },
    { id: 'juego', claves: ['juego', 'jugar', 'matijuego', 'arcade'],
      resp: 'El Matijuego es nuestro arcade 🎮 Puedes jugar sin cuenta; si tienes cuenta Matilover (desde los 14 años), después se podrá guardar tu progreso.',
      links: [{ texto: 'Ir al Matijuego', href: ruta('matijuego/') }] },
    { id: 'contacto', claves: ['contacto', 'contactar', 'telefono', 'whatsapp', 'numero', 'correo', 'mail', 'hablar', 'persona', 'humano', 'llamar', 'escribir', 'atienden', 'horario'],
      resp: 'Puedes hablar con una persona por WhatsApp al +56 9 7564 5591 o escribir a i.saavedra.nu@gmail.com.',
      links: [WA, { texto: 'Página de Contacto', href: ruta('pages/contacto.html') }] }
  ];
  const SUGERIDAS = [
    ['¿Cómo compro?', 'como compro'], ['Entregas', 'entregas'], ['Formas de pago', 'pagos'],
    ['Programa Matilover', 'programa'], ['Su historia', 'historia'], ['Hablar con una persona', 'contacto']
  ];
  const RECORRIDOS = {
    'index.html': [
      ['#bienvenida', 'Aquí te contamos quiénes somos: una chocolatería artesanal y familiar de La Ligua, desde 2011.'],
      ['#racha-widget', 'Aquí ves tu racha de visitas. Con una cuenta Matilover (desde los 14 años) se guarda y puedes juntar cupones.'],
      ['#puntos-venta', 'Y aquí están los lugares donde puedes encontrarnos.']
    ],
    'tienda.html': [
      ['.t-aviso', 'Lee esto antes de pedir: avisos importantes sobre ingredientes y entregas.'],
      ['#tChips', 'Con estos botones filtras por tipo de producto.'],
      ['#tCatalogo', 'Este es el catálogo. Agrega lo que quieras y después abre "Ver pedido" para enviarlo.']
    ],
    'historia.html': [
      ['.hist-intro', 'Esta es la historia de Matichoc, contada como un camino.'],
      ['#camino', 'Baja por el camino y se va abriendo cada etapa.'],
      ['.auspicios', 'Y estos son los clubes deportivos de la zona que apoyamos.']
    ],
    'la_maestra.html': [
      ['.m-hero', 'Ella es Inés Saavedra, la fundadora y maestra chocolatera.'],
      ['#mTabs', 'Cambia de pestaña para conocer cómo empezó, sus reconocimientos y lo que hace hoy.']
    ],
    'contacto.html': [
      ['#contacto-form', 'Escríbenos desde aquí: el mensaje se arma y tú decides si lo envías por WhatsApp.'],
      ['.pv-seccion', 'Y aquí está dónde encontrarnos.']
    ]
  };

  // ---------- Entender lo que escribe la persona ----------
  const limpiar = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ\s]/g, ' ').replace(/\s+/g, ' ').trim();
  function buscar(texto) {
    const t = ' ' + limpiar(texto) + ' ';
    let mejor = null, puntaje = 0;
    for (const tema of SABE) {
      let p = 0;
      for (const c of tema.claves) if (t.includes(c.length <= 3 ? ' ' + c + ' ' : c)) p += c.length;
      p += p ? (tema.prioridad || 0) * 100 : 0; // la salud siempre gana: no responde, deriva
      if (p > puntaje) { puntaje = p; mejor = tema; }
    }
    return mejor;
  }

  // ---------- Voz (SpeechSynthesis del navegador; sin servicios externos propios) ----------
  const VOZ = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  let vozActiva = VOZ && guardado('matichico-voz') === '1';
  let letraGrande = guardado('matichico-grande') === '1';
  const sinEmojis = (t) => t.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '');
  function paraHablar(t) {
    return sinEmojis(String(t))
      .replace(/\((\d+)\/(\d+)\)/g, 'Paso $1 de $2.')
      .replace(/N°/g, 'número ')
      .replace(/\+56 9/g, 'más cincuenta y seis, nueve')
      .replace(/\s+/g, ' ').trim();
  }
  function partir(texto) { // trozos cortos: los navegadores cortan las frases muy largas
    const frases = texto.split(/(?<=[.!?:;])\s+/);
    const trozos = []; let actual = '';
    for (const f of frases) {
      if ((actual + ' ' + f).trim().length > 170 && actual) { trozos.push(actual); actual = f; } else actual = (actual + ' ' + f).trim();
    }
    if (actual) trozos.push(actual);
    return trozos;
  }
  function callar() { if (VOZ) { try { window.speechSynthesis.cancel(); } catch (e) { /* sin voz */ } } }
  function hablar(texto) {
    if (!VOZ || !texto) return;
    callar();
    const lista = (window.speechSynthesis.getVoices && window.speechSynthesis.getVoices()) || [];
    const preferida = ['es-CL', 'es-419', 'es-MX', 'es-US', 'es-AR', 'es-ES'].map((l) => lista.find((v) => v.lang === l || v.lang === l.replace('-', '_'))).find(Boolean)
      || lista.find((v) => /^es/i.test(v.lang));
    partir(paraHablar(texto)).forEach((trozo) => {
      const u = new window.SpeechSynthesisUtterance(trozo);
      u.lang = preferida ? preferida.lang : 'es-CL';
      if (preferida) u.voice = preferida;
      u.rate = 0.95;
      u.pitch = GUIA === GUIAS.chocolatina ? 1.15 : 0.92;
      window.speechSynthesis.speak(u);
    });
  }
  function leerPagina() {
    if (!VOZ) { mensaje('bot', 'Tu navegador no tiene voz para leer en voz alta. Si usas un lector de pantalla, puedes seguir recorriendo la página con él.'); return; }
    const raiz = document.querySelector('main') || document.body;
    let t = (raiz.innerText || '').replace(/\s*\n+\s*/g, '. ').replace(/\.\s*\./g, '.').replace(/\s+/g, ' ').trim();
    if (t.length > 6000) t = t.slice(0, 6000).replace(/[^.]*$/, '') + ' La página sigue; puedes pedirme que te guíe por las partes que quieras.';
    mensaje('bot', 'Voy a leerte esta página. Para detener la voz, toca "Parar voz" o la tecla Escape.', null, true);
    hablar((document.title || '').split('|')[0] + '. ' + t);
  }
  function alternarVoz() {
    vozActiva = !vozActiva;
    guardado('matichico-voz', vozActiva ? '1' : '0');
    actualizarAcc();
    if (vozActiva) { hablar('Voz activada. Te voy a leer mis respuestas.'); mensaje('bot', 'Voz activada: te leo mis respuestas en voz alta. Puedes apagarla cuando quieras.', null, true); }
    else { callar(); mensaje('bot', 'Voz apagada.', null, true); }
  }
  function alternarLetra() {
    letraGrande = !letraGrande;
    guardado('matichico-grande', letraGrande ? '1' : '0');
    actualizarAcc();
  }
  let botonVoz, botonLetra;
  function actualizarAcc() {
    if (panel) panel.classList.toggle('mg-grande', letraGrande);
    if (botonVoz) { botonVoz.setAttribute('aria-pressed', String(vozActiva)); botonVoz.textContent = vozActiva ? '🔊 Voz: activada' : '🔈 Voz: apagada'; }
    if (botonLetra) { botonLetra.setAttribute('aria-pressed', String(letraGrande)); botonLetra.textContent = letraGrande ? '🔠 Letra grande: sí' : '🔠 Letra grande'; }
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && VOZ && window.speechSynthesis.speaking) callar(); });

  // ---------- Dibujo ----------
  const el = (tag, clase, texto) => { const e = document.createElement(tag); if (clase) e.className = clase; if (texto != null) e.textContent = texto; return e; };
  // Los dos guías (hoja de poses del dueño, sin fondo): cada uno con una pose "hablando" y otra de "bienvenida".
  const GUIAS = {
    matichico: {
      nombre: 'Matichico',
      poses: {
        hablando: { src: ruta('assets/personajes/matichico-hablando-420.webp'), w: 172, h: 420 },
        bienvenida: { src: ruta('assets/personajes/matichico-bienvenida-420.webp'), w: 170, h: 420 }
      }
    },
    chocolatina: {
      nombre: 'Chocolatina',
      poses: {
        hablando: { src: ruta('assets/personajes/chocolatina-hablando-420.webp'), w: 174, h: 420 },
        bienvenida: { src: ruta('assets/personajes/chocolatina-bienvenida-420.webp'), w: 175, h: 420 }
      }
    }
  };
  // Día por medio (con la fecha de Chile): días pares Matichico, días impares Chocolatina. Con ?guia=chocolatina
  // (o matichico) en la dirección se puede ver uno u otro, por ejemplo para probar.
  function elegirGuia() {
    const forzado = new URLSearchParams(location.search).get('guia');
    if (forzado && GUIAS[forzado]) return forzado;
    let dias;
    try {
      const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      const [a, m, d] = f.split('-').map(Number);
      dias = Math.floor(Date.UTC(a, m - 1, d) / 86400000);
    } catch (e) { dias = Math.floor(Date.now() / 86400000); }
    return dias % 2 === 0 ? 'matichico' : 'chocolatina';
  }
  const GUIA = GUIAS[elegirGuia()];
  const NOMBRE = GUIA.nombre;
  const POSES = GUIA.poses;
  let mascota, panel, mensajes, sugeridas, entrada, burbuja, imgMascota;
  let abierto = false, recorrido = null, destacado = null, temporizadorSalto = null;

  function construir() {
    mascota = el('button', 'mg-mascota mg-entrando');
    mascota.type = 'button';
    mascota.setAttribute('aria-label', NOMBRE + ', guía del sitio: abrir o cerrar el chat');
    mascota.setAttribute('aria-expanded', 'false');
    imgMascota = el('img');
    imgMascota.alt = '';
    poner('hablando');
    mascota.appendChild(imgMascota);
    Object.values(POSES).forEach((p) => { const pre = new Image(); pre.src = p.src; }); // precarga para que el cambio de pose sea instantáneo

    burbuja = el('div', 'mg-burbuja');
    burbuja.hidden = true;
    burbuja.setAttribute('role', 'status');

    panel = el('div', 'mg-panel');
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Chat con ' + NOMBRE + ', guía del sitio');
    const cab = el('div', 'mg-cab');
    cab.appendChild(el('span', null, '🍫 ' + NOMBRE + ', tu guía'));
    const chao = el('button', null, 'Chao, ' + NOMBRE);
    chao.type = 'button';
    chao.addEventListener('click', despedir);
    cab.appendChild(chao);
    const acc = el('div', 'mg-acc');
    acc.setAttribute('role', 'group');
    acc.setAttribute('aria-label', 'Accesibilidad');
    if (VOZ) {
      botonVoz = el('button'); botonVoz.type = 'button'; botonVoz.addEventListener('click', alternarVoz);
      const leer = el('button', null, '📖 Leer esta página'); leer.type = 'button'; leer.addEventListener('click', leerPagina);
      const parar = el('button', null, '⏹ Parar voz'); parar.type = 'button'; parar.addEventListener('click', callar);
      acc.append(botonVoz, leer, parar);
    }
    botonLetra = el('button'); botonLetra.type = 'button'; botonLetra.addEventListener('click', alternarLetra);
    acc.appendChild(botonLetra);
    mensajes = el('div', 'mg-mensajes');
    mensajes.setAttribute('aria-live', 'polite');
    sugeridas = el('div', 'mg-sugeridas');
    const pie = el('form', 'mg-pie');
    pie.setAttribute('role', 'search');
    entrada = el('input');
    entrada.type = 'text'; entrada.maxLength = 120; entrada.autocomplete = 'off';
    entrada.placeholder = 'Pregúntame algo del sitio…';
    entrada.setAttribute('aria-label', 'Escribe tu pregunta para ' + NOMBRE);
    const enviar = el('button', 'mg-primario', 'Enviar');
    enviar.type = 'submit';
    pie.append(entrada, enviar);
    pie.addEventListener('submit', (e) => { e.preventDefault(); preguntar(entrada.value); entrada.value = ''; });
    panel.append(cab, acc, mensajes, sugeridas, pie);
    actualizarAcc();
    panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') { cerrarPanel(); mascota.focus(); } });

    document.body.append(mascota, burbuja, panel);
    mascota.addEventListener('click', () => (abierto ? cerrarPanel() : abrirPanel()));
    mascota.addEventListener('animationend', () => { mascota.classList.remove('mg-entrando', 'mg-salto'); if (!REDUCIR) mascota.classList.add('mg-quieto'); });
  }

  function poner(nombre) {
    const p = POSES[nombre] || POSES.hablando;
    if (imgMascota.getAttribute('src') !== p.src) imgMascota.src = p.src;
    imgMascota.width = p.w; imgMascota.height = p.h;
  }

  function saltar() {
    if (REDUCIR || !mascota) return;
    mascota.classList.remove('mg-quieto', 'mg-salto');
    void mascota.offsetWidth; // reinicia la animación
    mascota.classList.add('mg-salto');
  }

  function mensaje(quien, texto, links, sinVoz) {
    const m = el('div', 'mg-msg mg-msg--' + quien);
    m.appendChild(document.createTextNode(texto)); // siempre texto: nada de lo escrito se interpreta como HTML
    (links || []).forEach((l) => {
      m.appendChild(document.createElement('br'));
      const a = el('a', null, l.texto);
      a.href = l.href;
      if (/^https:\/\/wa\.me\//.test(l.href)) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
      m.appendChild(a);
    });
    mensajes.appendChild(m);
    mensajes.scrollTop = mensajes.scrollHeight;
    if (quien === 'bot' && vozActiva && !sinVoz) hablar(texto + (links && links.length ? '. Enlaces: ' + links.map((l) => l.texto).join('. ') : ''));
    return m;
  }

  function mostrarSugeridas() {
    sugeridas.replaceChildren();
    SUGERIDAS.forEach(([texto, tema]) => {
      const b = el('button', null, texto);
      b.type = 'button';
      b.addEventListener('click', () => preguntar(texto, tema));
      sugeridas.appendChild(b);
    });
    if (RECORRIDOS[PAGINA]) {
      const g = el('button', 'mg-primario', '👀 Guíame por esta página');
      g.type = 'button';
      g.addEventListener('click', iniciarRecorrido);
      sugeridas.prepend(g);
    }
  }

  function preguntar(texto, temaId) {
    texto = String(texto || '').trim().slice(0, 120);
    if (!texto) return;
    terminarRecorrido(true);
    mensaje('yo', texto);
    const tema = temaId ? (SABE.find((s) => s.id === temaId) || buscar(texto)) : buscar(texto);
    poner('hablando');
    saltar();
    if (tema) mensaje('bot', tema.resp.replace('{nombre}', NOMBRE), tema.links);
    else mensaje('bot', 'Mmm, eso no lo sé 🙈 Yo solo conozco lo que cuenta este sitio. Para eso mejor te responde una persona por WhatsApp.', [WA]);
  }

  function abrirPanel() {
    burbuja.hidden = true;
    panel.hidden = false;
    abierto = true;
    mascota.setAttribute('aria-expanded', 'true');
    if (!mensajes.childElementCount) {
      mensaje('bot', '¡Hola! Soy ' + NOMBRE + ' 🍫 Te cuento cómo pedir, cómo son las entregas y más. Solo sé lo que cuenta este sitio; para lo demás te paso con una persona. Si lo prefieres, puedo hablar: toca "Voz".');
      mostrarSugeridas();
    }
    poner('bienvenida');
    saltar();
    entrada.focus({ preventScroll: true });
  }
  function cerrarPanel() {
    poner('hablando');
    panel.hidden = true;
    abierto = false;
    mascota.setAttribute('aria-expanded', 'false');
    terminarRecorrido(true);
  }
  function despedir() {
    callar();
    terminarRecorrido(true);
    guardado(CLAVE, '1');
    [panel, burbuja].forEach((e) => { e.hidden = true; });
    mascota.classList.remove('mg-quieto');
    mascota.style.transition = REDUCIR ? 'none' : 'left .6s ease-in, opacity .6s';
    mascota.style.left = '-160px';
    mascota.style.opacity = '0';
    setTimeout(() => { [mascota, panel, burbuja].forEach((e) => e.remove()); mostrarLlamar(); }, REDUCIR ? 0 : 700);
  }

  // Botón redondo con la carita del guía para volver a llamarlo después de despedirlo.
  let botonLlamar = null;
  function mostrarLlamar() {
    if (botonLlamar) return;
    botonLlamar = el('button', 'mg-llamar');
    botonLlamar.type = 'button';
    botonLlamar.setAttribute('aria-label', 'Llamar a ' + NOMBRE + ', guía del sitio');
    botonLlamar.title = 'Llamar a ' + NOMBRE;
    const cara = el('img');
    cara.src = POSES.hablando.src;
    cara.alt = '';
    botonLlamar.appendChild(cara);
    botonLlamar.addEventListener('click', () => {
      botonLlamar.remove(); botonLlamar = null;
      guardado(CLAVE, ''); // vuelve a estar disponible en esta pestaña
      construir();
      abrirPanel();
    });
    document.body.appendChild(botonLlamar);
  }

  // ---------- Recorrido de la página ----------
  function pasos() {
    return (RECORRIDOS[PAGINA] || []).map(([sel, texto]) => [document.querySelector(sel), texto]).filter(([n]) => n && n.getClientRects().length);
  }
  function iniciarRecorrido() {
    const lista = pasos();
    if (!lista.length) { mensaje('bot', 'En esta página no tengo nada que mostrarte, ¡pregúntame lo que quieras!'); return; }
    recorrido = { lista, i: -1 };
    sugeridas.replaceChildren();
    siguientePaso();
  }
  function siguientePaso() {
    if (!recorrido) return;
    quitarDestacado();
    recorrido.i += 1;
    if (recorrido.i >= recorrido.lista.length) { terminarRecorrido(false); return; }
    const [nodo, texto] = recorrido.lista[recorrido.i];
    const encabezado = document.getElementById('header');
    const alto = (encabezado ? encabezado.offsetHeight : 0) + 12;
    const y = nodo.getBoundingClientRect().top + window.scrollY - alto - 8;
    window.scrollTo({ top: Math.max(y, 0), behavior: REDUCIR ? 'auto' : 'smooth' });
    nodo.classList.add('mg-destacado');
    destacado = nodo;
    poner(recorrido.i % 2 === 0 ? 'bienvenida' : 'hablando');
    saltar();
    const m = mensaje('bot', `(${recorrido.i + 1}/${recorrido.lista.length}) ${texto}`);
    const fila = el('div', 'mg-sugeridas');
    fila.style.padding = '8px 0 0';
    const sig = el('button', 'mg-primario', recorrido.i + 1 < recorrido.lista.length ? 'Siguiente ▶' : 'Terminar');
    sig.type = 'button';
    sig.addEventListener('click', () => { fila.remove(); siguientePaso(); });
    const salir = el('button', null, 'Salir');
    salir.type = 'button';
    salir.addEventListener('click', () => { fila.remove(); terminarRecorrido(false, true); });
    fila.append(sig, salir);
    m.appendChild(fila);
    mensajes.scrollTop = mensajes.scrollHeight;
    sig.focus({ preventScroll: true });
  }
  function quitarDestacado() { if (destacado) { destacado.classList.remove('mg-destacado'); destacado = null; } }
  function terminarRecorrido(callado, salio) {
    const habia = !!recorrido;
    if (habia && imgMascota) poner('hablando');
    recorrido = null;
    quitarDestacado();
    if (habia && !callado) {
      mensaje('bot', salio ? 'Listo, cuando quieras seguimos 😊' : '¡Eso es todo por aquí! ¿Quieres saber algo más?');
      mostrarSugeridas();
    }
  }

  // ---------- Llegada ----------
  function llegar() {
    if (mascota && document.body.contains(mascota)) return; // ya la abrieron con el enlace de salto
    if (document.querySelector('dialog[open]')) { setTimeout(llegar, 3000); return; }
    construir();
    // un saludo corto; si no lo tocan, se esconde solo
    setTimeout(() => {
      if (abierto || !burbuja) return;
      burbuja.replaceChildren(document.createTextNode('¡Hola! Soy ' + NOMBRE + ' 🍫 ¿Te ayudo a recorrer el sitio?'));
      const si = el('button', 'mg-primario', 'Sí, ayúdame');
      si.type = 'button';
      si.addEventListener('click', abrirPanel);
      burbuja.appendChild(document.createElement('br'));
      burbuja.appendChild(si);
      burbuja.hidden = false;
      poner('bienvenida');
      setTimeout(() => { if (burbuja) { burbuja.hidden = true; poner('hablando'); } }, 12000);
    }, REDUCIR ? 300 : 1300);
  }

  // Enlace de salto: primer elemento al tabular (lectores de pantalla y teclado), antes de cualquier otro contenido.
  function crearSalto() {
    const a = el('a', 'mg-saltar', 'Hablar con ' + NOMBRE + ', la guía del sitio (con voz y ayuda)');
    a.href = '#';
    a.addEventListener('click', (e) => {
      e.preventDefault();
      if (botonLlamar) { botonLlamar.remove(); botonLlamar = null; guardado(CLAVE, ''); }
      if (!mascota || !document.body.contains(mascota)) construir();
      abrirPanel();
    });
    document.body.insertBefore(a, document.body.firstChild);
  }
  crearSalto();

  function iniciar() { if (DESPEDIDO) setTimeout(mostrarLlamar, 800); else setTimeout(llegar, RETRASO); }
  if (document.readyState === 'complete') iniciar(); else window.addEventListener('load', iniciar);
})();
