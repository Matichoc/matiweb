// Tienda Matichoc: catálogo con filtros + carrito en un panel.
// Lee SIEMPRE de js/catalogo.js (CATALOGO / CATALOGO_CONSULTAR): no dupliques precios aquí.
// El carrito vive solo en memoria (sin localStorage), igual que antes.
(function () {
  const WSP = '56975645591';
  const TUU_URL = 'https://www.tuu.cl/matichoc_pago';
  const TODO = 'Todo';

  const carrito = new Map(); // id → cantidad
  let categoriaActiva = TODO;
  let textoBusqueda = '';

  const $ = (id) => document.getElementById(id);
  const clp = (n) => n.toLocaleString('es-CL');
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const slug = (s) => 'cat-' + norm(s).replace(/[^a-z0-9]+/g, '-');
  const porId = new Map(CATALOGO.map((p) => [p.id, p]));
  const reducir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Catálogo ----------
  const categorias = [];
  CATALOGO.forEach((p) => { if (!categorias.includes(p.categoria)) categorias.push(p.categoria); });
  const CAT_TEMPORADA = CATALOGO_CONSULTAR.categoria;

  function controlHTML(p) {
    return `
      <button type="button" class="t-add" data-accion="sumar" data-id="${p.id}" aria-label="Añadir ${esc(p.nombre)} al pedido">Añadir</button>
      <div class="t-step" data-paso="${p.id}" hidden>
        <button type="button" data-accion="restar" data-id="${p.id}" aria-label="Quitar uno de ${esc(p.nombre)}">−</button>
        <output aria-live="polite" aria-label="Cantidad de ${esc(p.nombre)}">0</output>
        <button type="button" data-accion="sumar" data-id="${p.id}" aria-label="Agregar uno más de ${esc(p.nombre)}">+</button>
      </div>`;
  }

  function tarjetaHTML(p) {
    return `
      <article class="t-card" data-id="${p.id}" data-busqueda="${esc(norm(p.nombre + ' ' + (p.descripcion || '') + ' ' + p.categoria))}">
        ${p.badge ? `<span class="t-badge">⭐ ${esc(p.badge)}</span>` : ''}
        <img src="${esc(p.img)}" alt="${esc(p.nombre)}" width="400" height="400" loading="lazy" decoding="async">
        <div class="t-card-cuerpo">
          <h3>${esc(p.nombre)}</h3>
          ${p.descripcion ? `<p class="t-desc">${esc(p.descripcion)}</p><button type="button" class="t-mas" data-accion="mas" hidden aria-expanded="false">Ver más</button>` : ''}
          <div class="t-pie">
            <span class="t-precio">$${clp(p.precio)}</span>
            <div class="t-ctrl">${controlHTML(p)}</div>
          </div>
        </div>
      </article>`;
  }

  function msjConsulta(categoria) {
    return `https://wa.me/${WSP}?text=${encodeURIComponent('Hola, me interesa consultar por: ' + categoria)}`;
  }

  function renderCatalogo() {
    const cont = $('tCatalogo');
    cont.innerHTML = categorias.map((cat) => `
      <section class="t-cat" id="${slug(cat)}" data-cat="${esc(cat)}" aria-labelledby="${slug(cat)}-t">
        <div class="t-cat-cab">
          <h2 id="${slug(cat)}-t">${esc(cat)}</h2>
          <a href="${msjConsulta(cat)}" target="_blank" rel="noopener noreferrer">¿Dudas? Consulta por WhatsApp</a>
        </div>
        <div class="t-grid">${CATALOGO.filter((p) => p.categoria === cat).map(tarjetaHTML).join('')}</div>
      </section>`).join('') + `
      <section class="t-cat" id="${slug(CAT_TEMPORADA)}" data-cat="${esc(CAT_TEMPORADA)}" data-fija="1" aria-labelledby="${slug(CAT_TEMPORADA)}-t">
        <div class="t-cat-cab"><h2 id="${slug(CAT_TEMPORADA)}-t">${esc(CAT_TEMPORADA)}</h2></div>
        <div class="t-grid">
          <article class="t-card t-card--consulta" data-busqueda="${esc(norm(CAT_TEMPORADA + ' ' + CATALOGO_CONSULTAR.descripcion + ' sorpresa figura personalizado'))}">
            <div class="t-card-cuerpo">
              <span class="t-emoji" aria-hidden="true">🎁</span>
              <h3>Sorpresas y ediciones especiales</h3>
              <p class="t-desc abierto">${esc(CATALOGO_CONSULTAR.descripcion)}</p>
              <a class="t-wsp" href="${msjConsulta(CAT_TEMPORADA)}" target="_blank" rel="noopener noreferrer">📲 Consultar por WhatsApp</a>
            </div>
          </article>
        </div>
      </section>`;

    $('tChips').innerHTML = [TODO, ...categorias, CAT_TEMPORADA].map((c) =>
      `<button type="button" class="t-chip" data-chip="${esc(c)}" aria-pressed="${c === TODO}">${esc(c)}</button>`).join('');

    // "Ver más" solo donde la descripción realmente se corta.
    requestAnimationFrame(() => {
      cont.querySelectorAll('.t-card .t-desc:not(.abierto)').forEach((d) => {
        if (d.scrollHeight > d.clientHeight + 1) d.nextElementSibling.hidden = false;
      });
    });
  }

  // ---------- Filtros ----------
  function aplicarFiltros() {
    const q = norm(textoBusqueda.trim());
    let visibles = 0;
    document.querySelectorAll('.t-cat').forEach((sec) => {
      const catOk = categoriaActiva === TODO || sec.dataset.cat === categoriaActiva;
      let hay = 0;
      sec.querySelectorAll('.t-card').forEach((card) => {
        const ok = catOk && (!q || card.dataset.busqueda.includes(q));
        card.hidden = !ok;
        if (ok) hay++;
      });
      sec.hidden = hay === 0;
      visibles += hay;
    });
    $('tVacio').hidden = visibles > 0;
    if (visibles === 0) {
      $('tVacioLink').href = `https://wa.me/${WSP}?text=${encodeURIComponent('Hola, estoy buscando: ' + textoBusqueda.trim())}`;
    }
    document.querySelectorAll('.t-chip').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.chip === categoriaActiva)));
  }

  // ---------- Carrito ----------
  function totales() {
    let unidades = 0;
    let total = 0;
    carrito.forEach((cant, id) => { unidades += cant; total += cant * porId.get(id).precio; });
    return { unidades, total };
  }

  function cambiar(id, delta) {
    const nueva = (carrito.get(id) || 0) + delta;
    if (nueva <= 0) carrito.delete(id); else carrito.set(id, Math.min(nueva, 99));
    sincronizar(true);
  }

  function sincronizar(animar) {
    const { unidades, total } = totales();

    // Controles de cada tarjeta: "Añadir" o selector de cantidad.
    document.querySelectorAll('.t-card[data-id]').forEach((card) => {
      const cant = carrito.get(card.dataset.id) || 0;
      card.querySelector('.t-add').hidden = cant > 0;
      const paso = card.querySelector('.t-step');
      paso.hidden = cant === 0;
      paso.querySelector('output').textContent = cant;
    });

    // Barra flotante.
    const barra = $('tBarra');
    barra.hidden = unidades === 0;
    document.body.classList.toggle('t-con-barra', unidades > 0);
    $('tBarraCant').textContent = unidades;
    $('tBarraEtq').textContent = unidades === 1 ? 'producto' : 'productos';
    $('tBarraTotal').textContent = clp(total);
    if (animar && !reducir) {
      barra.classList.remove('bump');
      void barra.offsetWidth;
      barra.classList.add('bump');
    }

    // Panel del pedido.
    const lista = $('tItems');
    lista.innerHTML = '';
    carrito.forEach((cant, id) => {
      const p = porId.get(id);
      const li = document.createElement('li');
      li.className = 't-item';
      li.innerHTML = `
        <span class="t-item-nombre">${esc(p.nombre)}</span>
        <span class="t-item-sub">$${clp(cant * p.precio)}</span>
        <div class="t-step">
          <button type="button" data-accion="restar" data-id="${id}" aria-label="Quitar uno de ${esc(p.nombre)}">−</button>
          <output aria-live="polite">${cant}</output>
          <button type="button" data-accion="sumar" data-id="${id}" aria-label="Agregar uno más de ${esc(p.nombre)}">+</button>
        </div>
        <button type="button" class="t-quitar" data-accion="quitar" data-id="${id}" aria-label="Quitar ${esc(p.nombre)} del pedido">Quitar</button>`;
      lista.appendChild(li);
    });
    $('tCarritoVacio').hidden = unidades > 0;
    $('tResumen').hidden = unidades === 0;
    $('tSubtotal').textContent = clp(total);
    $('tTotal').textContent = clp(total);

    if (unidades === 0 && $('tDialog').open) cerrarPanel();
  }

  // ---------- Panel (dialog) ----------
  const dialog = $('tDialog');
  function abrirPanel() {
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
    document.body.classList.add('t-bloqueado');
    if (typeof renderPedidosWidget === 'function') renderPedidosWidget();
  }
  function cerrarPanel() {
    if (typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open');
    document.body.classList.remove('t-bloqueado');
  }
  dialog.addEventListener('close', () => document.body.classList.remove('t-bloqueado'));
  dialog.addEventListener('click', (e) => { if (e.target === dialog) cerrarPanel(); });
  $('tCerrar').addEventListener('click', cerrarPanel);
  $('tBarra').addEventListener('click', abrirPanel);

  // ---------- Eventos ----------
  document.addEventListener('click', (e) => {
    const chip = e.target.closest('.t-chip');
    if (chip) {
      categoriaActiva = chip.dataset.chip;
      aplicarFiltros();
      // Lleva el inicio del catálogo justo debajo del encabezado fijo y de la barra de filtros.
      const cat = $('tCatalogo');
      const cab = $('header');
      const barra = document.querySelector('.t-barra');
      const alto = (cab ? cab.offsetHeight : 0) + (barra ? barra.offsetHeight : 0);
      window.scrollTo({ top: Math.max(cat.getBoundingClientRect().top + window.scrollY - alto - 8, 0), behavior: reducir ? 'auto' : 'smooth' });
      return;
    }
    const btn = e.target.closest('[data-accion]');
    if (!btn) return;
    const id = btn.dataset.id;
    switch (btn.dataset.accion) {
      case 'sumar': cambiar(id, 1); break;
      case 'restar': cambiar(id, -1); break;
      case 'quitar': cambiar(id, -(carrito.get(id) || 0)); break;
      case 'mas': {
        const d = btn.previousElementSibling;
        const abierto = d.classList.toggle('abierto');
        btn.textContent = abierto ? 'Ver menos' : 'Ver más';
        btn.setAttribute('aria-expanded', String(abierto));
        break;
      }
    }
  });
  $('tBuscar').addEventListener('input', (e) => { textoBusqueda = e.target.value; aplicarFiltros(); });

  // ---------- Pago con Tuu (sin cambios de proceso) ----------
  // Tuu no acepta el monto por URL (el campo llega vacío), así que dejamos el total
  // copiado y bien visible para que la persona solo lo pegue en la pestaña de Tuu.
  $('btnPagarTuu').addEventListener('click', () => {
    const aviso = $('pagoTuuAviso');
    const { total } = totales();
    if (total <= 0) {
      aviso.textContent = 'Primero agrega productos al carrito para saber cuánto pagar.';
      return;
    }
    const monto = '$' + clp(total);
    aviso.textContent = '👉 En Tuu escribe ' + monto + ' (solo números: ' + total + ').';
    // Copiar ANTES de abrir la pestaña: al abrirla, esta página pierde el foco y
    // el navegador (sobre todo en celular) rechaza la copia.
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(String(total)).then(() => {
        aviso.textContent = '✅ Monto ' + monto + ' copiado: en Tuu mantén apretado el campo y elige "Pegar" (o escribe ' + total + ').';
      }).catch(() => {});
    }
    window.open(TUU_URL, '_blank', 'noopener,noreferrer');
  });

  // ---------- Envío del pedido por WhatsApp ----------
  $('tForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.reportValidity()) return;
    const { unidades, total } = totales();
    if (unidades === 0) return;

    const nombre = $('nombre').value.trim();
    const contacto = $('contacto').value.trim();
    // Texto plano + encodeURIComponent al final: un "&" o "#" en el nombre no corta el pedido.
    let mensaje = `🍫 Pedido Matichoc 🍫\n👤 Nombre: ${nombre}\n📱 Contacto: ${contacto}\n🛍️ Productos:\n`;
    carrito.forEach((cant, id) => {
      const p = porId.get(id);
      mensaje += `- ${cant} x ${p.nombre} ($${clp(cant * p.precio)})\n`;
    });
    mensaje += `\n💵 Total: $${clp(total)}\n📸 Recuerda enviar tu comprobante de pago.`;

    window.open(`https://wa.me/${WSP}?text=${encodeURIComponent(mensaje)}`, '_blank', 'noopener,noreferrer');
    if (typeof sumarPedido === 'function') sumarPedido();
    if (typeof renderPedidosWidget === 'function') renderPedidosWidget();
  });

  // Enlace directo a una categoría: tienda.html#cat-alfajores
  function aplicarHash() {
    const hash = decodeURIComponent(location.hash.slice(1));
    const sec = hash && document.getElementById(hash);
    if (sec && sec.classList.contains('t-cat')) {
      categoriaActiva = sec.dataset.cat;
      aplicarFiltros();
    }
  }

  // ---------- Datos estructurados (SEO) ----------
  // Se arman desde el mismo CATALOGO, así Google ve los mismos precios que el cliente.
  // No se declara disponibilidad ni reseñas: no hay forma de verificarlas desde el sitio.
  function agregarDatosEstructurados() {
    const lista = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Chocolates artesanales Matichoc',
      itemListElement: CATALOGO.map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'Product',
          name: p.nombre,
          description: p.descripcion || p.nombre + ' artesanal de Matichoc.',
          image: p.img,
          category: p.categoria,
          brand: { '@type': 'Brand', name: 'Matichoc' },
          offers: { '@type': 'Offer', price: p.precio, priceCurrency: 'CLP', url: 'https://matichoc.cl/pages/tienda.html#' + slug(p.categoria) }
        }
      }))
    };
    const tag = document.createElement('script');
    tag.type = 'application/ld+json';
    tag.textContent = JSON.stringify(lista);
    document.head.appendChild(tag);
  }

  // ---------- Inicio ----------
  document.addEventListener('DOMContentLoaded', () => {
    renderCatalogo();
    agregarDatosEstructurados();
    sincronizar(false);
    aplicarFiltros();
    aplicarHash();
    window.addEventListener('hashchange', aplicarHash);
  });
})();
