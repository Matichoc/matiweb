// Página "Matilover": entrar (correo, Google, Facebook), completar el perfil y ver la cuenta.
// Todo texto que viene del servidor se muestra con textContent (nunca como HTML).
document.addEventListener('DOMContentLoaded', () => {
  loadComponent('header', '../components/header.html', { base: '../' });
  loadComponent('page-banner', '../components/page-banner.html', { base: '../', emoji: '💛', titulo: 'Matilovers', subtitulo: 'Tu cuenta para guardar racha, premios y juegos' });
  loadComponent('footer', '../components/footer.html', { base: '../' });
});

(function () {
  const $ = (id) => document.getElementById(id);
  const ESTADOS = ['estado-cargando', 'estado-apagada', 'estado-entrar', 'estado-perfil', 'estado-cuenta'];
  const mostrar = (id) => ESTADOS.forEach((e) => { $(e).hidden = e !== id; });
  const fecha = (iso) => new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
  const pesos = (n) => '$' + Number(n).toLocaleString('es-CL');
  const destino = location.origin + location.pathname;
  let correoPedido = '';

  function aviso(el, texto, ok) {
    el.hidden = false;
    el.textContent = texto;
    el.classList.toggle('aviso--ok', !!ok);
  }
  function nodo(tag, clase, texto) {
    const e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto != null) e.textContent = texto;
    return e;
  }
  const NOMBRES = { google: 'Google', facebook: 'Facebook' };

  // ---------- Entrar ----------
  function prepararEntrada() {
    const cont = $('botones-proveedor');
    const provs = (Cuenta.config.proveedores || []).filter((p) => NOMBRES[p]);
    provs.forEach((p) => {
      const b = nodo('button', `btn btn--${p}`, `Continuar con ${NOMBRES[p]}`);
      b.type = 'button';
      b.addEventListener('click', async () => {
        try { await Cuenta.entrarProveedor(p, destino); }
        catch (e) { aviso($('mensaje-entrar'), Cuenta.traducir(e)); }
      });
      cont.appendChild(b);
    });
    $('separador-correo').hidden = provs.length === 0;

    $('form-correo').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const correo = $('correo').value.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) return aviso($('mensaje-entrar'), 'Escribe un correo válido.');
      const boton = $('btn-correo');
      boton.disabled = true;
      try {
        await Cuenta.entrarCorreo(correo, destino);
        correoPedido = correo;
        aviso($('mensaje-entrar'), `Listo: te enviamos un enlace a ${correo}. Ábrelo desde este mismo dispositivo y quedarás dentro.`, true);
        $('form-codigo').hidden = false;
      } catch (e) {
        aviso($('mensaje-entrar'), Cuenta.traducir(e));
      } finally { boton.disabled = false; }
    });

    $('form-codigo').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const codigo = $('codigo-correo').value.trim();
      if (!/^\d{6,10}$/.test(codigo)) return aviso($('mensaje-entrar'), 'El código son solo números.');
      try {
        await Cuenta.verificarCodigo(correoPedido, codigo);
        await cargarCuenta();
      } catch (e) { aviso($('mensaje-entrar'), Cuenta.traducir(e)); }
    });
  }

  // ---------- Perfil (edad y términos) ----------
  function prepararPerfil(r) {
    $('apodo').value = (r.perfil && r.perfil.apodo) || '';
    $('form-perfil').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const edad = (document.querySelector('input[name="edad"]:checked') || {}).value;
      const msg = $('mensaje-perfil');
      if (!$('apodo').value.trim()) return aviso(msg, 'Escribe un apodo.');
      if (!edad) return aviso(msg, 'Elige tu edad.');
      if (!$('terminos').checked) return aviso(msg, 'Para seguir, acepta los términos y la política de privacidad.');
      $('btn-perfil').disabled = true;
      try {
        await Cuenta.declarar(edad, $('apodo').value, $('novedades').checked);
        await cargarCuenta();
      } catch (e) { aviso(msg, Cuenta.traducir(e)); }
      finally { $('btn-perfil').disabled = false; }
    }, { once: false });
  }

  // ---------- Mi cuenta ----------
  function pintarCuenta(r) {
    const meta = r.reglas.racha_meta;
    $('saludo').textContent = `Hola, ${r.perfil.apodo} 💛`;
    $('novedades-cuenta').checked = !!r.perfil.acepto_novedades;

    const puntos = $('racha-puntos');
    puntos.replaceChildren();
    for (let i = 1; i <= meta; i++) puntos.appendChild(nodo('div', 'racha-punto' + (i <= r.racha ? ' racha-punto--on' : ''), i <= r.racha ? '🍫' : String(i)));
    $('racha-texto').textContent = r.racha >= meta
      ? `¡${r.racha} días seguidos! Ya puedes reclamar tu ${r.reglas.racha_premio}.`
      : `Llevas ${r.racha} de ${meta} días seguidos. Vuelve mañana: ${meta - r.racha} día${meta - r.racha === 1 ? '' : 's'} más para tu ${r.reglas.racha_premio}.`;
    const br = $('btn-reclamar-racha');
    br.hidden = r.racha < meta;
    br.textContent = `🎁 Reclamar ${r.reglas.racha_premio}`;

    const mp = r.reglas.pedidos_meta;
    const hechos = Math.min(r.pedidos_entregados, mp);
    $('barra-pedidos').style.width = Math.round((hechos / mp) * 100) + '%';
    $('pedidos-texto').textContent = r.pedidos_entregados >= mp
      ? `¡${r.pedidos_entregados} pedidos entregados! Ya puedes reclamar: ${r.reglas.pedidos_premio}.`
      : `${r.pedidos_entregados} de ${mp} pedidos entregados. Premio: ${r.reglas.pedidos_premio}.`;
    const bp = $('btn-reclamar-pedidos');
    bp.hidden = r.pedidos_entregados < mp;
    bp.textContent = `🎁 Reclamar ${r.reglas.pedidos_premio}`;

    const lc = $('lista-cupones');
    lc.replaceChildren();
    if (!r.cupones.length) lc.appendChild(nodo('p', 'ayuda', 'Todavía no tienes cupones. Cuando completes una racha o los pedidos, aparecen aquí.'));
    r.cupones.forEach((c) => {
      const caja = nodo('div', 'cupon');
      caja.append(nodo('span', `etiqueta etiqueta--${c.estado}`, c.estado.toUpperCase()),
        nodo('div', 'codigo', c.codigo),
        nodo('div', null, c.descripcion),
        nodo('div', 'ayuda', c.estado === 'canjeado' ? `Canjeado el ${fecha(c.canjeado_en)}` : `Vence el ${fecha(c.vence_en)}`));
      lc.appendChild(caja);
    });

    const lp = $('lista-pedidos');
    lp.replaceChildren();
    if (!r.pedidos.length) lp.appendChild(nodo('li', 'ayuda', 'Aún no hay pedidos registrados con tu cuenta.'));
    r.pedidos.forEach((o) => {
      const li = nodo('li');
      li.append(nodo('span', null, `${fecha(o.creado_en)} · ${pesos(o.total)}`), nodo('span', `etiqueta etiqueta--${o.estado}`, o.estado));
      lp.appendChild(li);
    });
  }

  async function cargarCuenta() {
    try {
      const r = await Cuenta.resumen();
      if (!r.perfil_listo) { prepararPerfilUnaVez(r); mostrar('estado-perfil'); return; }
      pintarCuenta(r);
      mostrar('estado-cuenta');
    } catch (e) {
      mostrar('estado-entrar');
      aviso($('mensaje-entrar'), Cuenta.traducir(e));
    }
  }
  let perfilListo = false;
  function prepararPerfilUnaVez(r) { if (!perfilListo) { perfilListo = true; prepararPerfil(r); } else { $('apodo').value = r.perfil.apodo; } }

  async function reclamar(fn, boton) {
    boton.disabled = true;
    try {
      const r = await fn();
      await cargarCuenta();
      alert(`¡Listo! Tu cupón es ${r.codigo}. Lo ves en "Tus cupones".`);
    } catch (e) { alert(Cuenta.traducir(e)); }
    finally { boton.disabled = false; }
  }

  async function iniciar() {
    if (!Cuenta.activa) return mostrar('estado-apagada');
    prepararEntrada();
    $('btn-reclamar-racha').addEventListener('click', (ev) => reclamar(Cuenta.reclamarRacha, ev.currentTarget));
    $('btn-reclamar-pedidos').addEventListener('click', (ev) => reclamar(Cuenta.reclamarPedidos, ev.currentTarget));
    $('novedades-cuenta').addEventListener('change', async (ev) => {
      const caja = ev.currentTarget, msg = $('mensaje-novedades');
      caja.disabled = true;
      try {
        await Cuenta.cambiarNovedades(caja.checked);
        aviso(msg, caja.checked ? 'Listo: te avisaremos de las novedades.' : 'Listo: no te enviaremos novedades.', true);
      } catch (e) { caja.checked = !caja.checked; aviso(msg, Cuenta.traducir(e)); }
      finally { caja.disabled = false; }
    });
    $('btn-salir').addEventListener('click', async () => { await Cuenta.salir(); location.reload(); });
    $('btn-borrar').addEventListener('click', async () => {
      if (!confirm('¿Seguro que quieres borrar tu cuenta Matilover? Se borra tu racha, cupones, pedidos y progreso de juegos. No se puede deshacer.')) return;
      if ((prompt('Para confirmar, escribe BORRAR') || '').trim().toUpperCase() !== 'BORRAR') return;
      try {
        await Cuenta.borrarCuenta();
        Object.keys(localStorage).filter((k) => k.startsWith('sb-')).forEach((k) => localStorage.removeItem(k));
        alert('Tu cuenta fue borrada.');
        location.href = '../index.html';
      } catch (e) { alert(Cuenta.traducir(e)); }
    });
    try {
      const sb = await Cuenta.cliente();
      const sesion = await Cuenta.sesion();
      sb.auth.onAuthStateChange((evento) => { if (evento === 'SIGNED_OUT') setTimeout(() => mostrar('estado-entrar'), 0); });
      if (!sesion) return mostrar('estado-entrar');
      await cargarCuenta();
    } catch (e) {
      console.warn('[cuenta]', e && e.message);
      mostrar('estado-entrar');
      aviso($('mensaje-entrar'), Cuenta.traducir(e));
    }
  }
  iniciar();
})();
