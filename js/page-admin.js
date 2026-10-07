// Panel privado del dueño: validar cupones y marcar pedidos como entregados.
// El servidor exige estar en la tabla `admins` Y haber entrado con verificación en dos pasos (aal2);
// esta página solo muestra o esconde cosas, la seguridad real está en supabase/schema.sql.
document.addEventListener('DOMContentLoaded', () => {
  loadComponent('header', '../components/header.html', { base: '../' });
  loadComponent('footer', '../components/footer.html', { base: '../' });
});

(function () {
  const $ = (id) => document.getElementById(id);
  const VISTAS = ['a-cargando', 'a-apagada', 'a-entrar', 'a-mfa', 'a-panel'];
  const mostrar = (id) => VISTAS.forEach((v) => { $(v).hidden = v !== id; });
  const fecha = (iso) => new Date(iso).toLocaleString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const pesos = (n) => '$' + Number(n).toLocaleString('es-CL');
  const destino = location.origin + location.pathname;
  let sb = null;

  function aviso(el, texto, ok) { el.hidden = false; el.textContent = texto; el.classList.toggle('aviso--ok', !!ok); }
  function nodo(tag, clase, texto) { const e = document.createElement(tag); if (clase) e.className = clase; if (texto != null) e.textContent = texto; return e; }

  // ---------- Entrar ----------
  function prepararEntrada() {
    const cont = $('a-botones-proveedor');
    (Cuenta.config.proveedores || []).filter((p) => p === 'google' || p === 'facebook').forEach((p) => {
      const b = nodo('button', `btn btn--${p}`, `Continuar con ${p === 'google' ? 'Google' : 'Facebook'}`);
      b.type = 'button';
      b.addEventListener('click', () => Cuenta.entrarProveedor(p, destino).catch((e) => aviso($('a-mensaje'), Cuenta.traducir(e))));
      cont.appendChild(b);
    });
    $('a-form-correo').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const correo = $('a-correo').value.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) return aviso($('a-mensaje'), 'Escribe un correo válido.');
      try {
        await Cuenta.entrarCorreo(correo, destino);
        aviso($('a-mensaje'), `Te enviamos un enlace a ${correo}. Ábrelo en este mismo dispositivo.`, true);
      } catch (e) { aviso($('a-mensaje'), Cuenta.traducir(e)); }
    });
  }

  // ---------- Verificación en dos pasos (TOTP) ----------
  async function exigirDosPasos() {
    const nivel = (await sb.auth.mfa.getAuthenticatorAssuranceLevel()).data;
    if (nivel && nivel.currentLevel === 'aal2') return true;

    const lista = (await sb.auth.mfa.listFactors()).data || { all: [], totp: [] };
    // limpia intentos de alta que quedaron a medias
    for (const f of (lista.all || []).filter((x) => x.factor_type === 'totp' && x.status === 'unverified')) {
      await sb.auth.mfa.unenroll({ factorId: f.id });
    }
    let factorId;
    if (lista.totp && lista.totp.length) {
      factorId = lista.totp[0].id;
      $('a-mfa-alta').hidden = true;
      $('a-mfa-titulo').textContent = 'Verificación en dos pasos';
    } else {
      const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Matichoc ' + Date.now() });
      if (error) throw error;
      factorId = data.id;
      $('a-qr').src = data.totp.qr_code;
      $('a-secreto').textContent = data.totp.secret;
      $('a-mfa-alta').hidden = false;
      $('a-mfa-titulo').textContent = 'Vincula tu verificación en dos pasos';
    }
    mostrar('a-mfa');
    return new Promise((ok) => {
      $('a-form-mfa').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const codigo = $('a-codigo').value.trim();
        if (!/^\d{6}$/.test(codigo)) return aviso($('a-mfa-mensaje'), 'Son 6 números.');
        const { error } = await sb.auth.mfa.challengeAndVerify({ factorId, code: codigo });
        if (error) return aviso($('a-mfa-mensaje'), 'Ese código no es correcto. Revisa que tu celular tenga la hora automática.');
        ok(true);
      });
    });
  }

  // ---------- Cupones ----------
  async function revisarCupon(ev) {
    ev.preventDefault();
    const caja = $('a-cupon-resultado');
    caja.hidden = false;
    caja.replaceChildren();
    try {
      const codigo = $('a-codigo-cupon').value.trim();
      const { data, error } = await sb.rpc('admin_consultar_cupon', { p_codigo: codigo });
      if (error) throw error;
      if (!data.encontrado) { caja.appendChild(nodo('p', 'aviso', 'No existe ese código.')); return; }
      const tarjeta = nodo('div', 'cupon');
      tarjeta.append(nodo('span', `etiqueta etiqueta--${data.estado}`, data.estado.toUpperCase()),
        nodo('div', 'codigo', data.codigo),
        nodo('div', null, data.descripcion),
        nodo('div', 'ayuda', `Cliente: ${data.apodo}${data.correo ? ' · ' + data.correo : ''}`),
        nodo('div', 'ayuda', data.estado === 'canjeado' ? `Canjeado el ${fecha(data.canjeado_en)}` : `Vence el ${fecha(data.vence_en)}`));
      if (data.estado === 'vigente') {
        const b = nodo('button', 'btn btn--verde', '✅ Canjear ahora');
        b.type = 'button';
        b.addEventListener('click', async () => {
          b.disabled = true;
          const r = await sb.rpc('admin_canjear_cupon', { p_codigo: data.codigo });
          if (r.error || r.data !== true) { alert('No se pudo canjear (¿ya estaba canjeado o vencido?).'); b.disabled = false; return; }
          $('a-form-cupon').dispatchEvent(new Event('submit', { cancelable: true }));
        });
        tarjeta.appendChild(b);
      }
      caja.appendChild(tarjeta);
    } catch (e) { caja.appendChild(nodo('p', 'aviso', Cuenta.traducir(e))); }
  }

  // ---------- Pedidos ----------
  async function cargarPedidos() {
    const cont = $('a-lista-pedidos');
    cont.replaceChildren(nodo('p', 'ayuda', 'Cargando…'));
    try {
      const { data, error } = await sb.rpc('admin_pedidos', { p_estado: 'solicitado' });
      if (error) throw error;
      cont.replaceChildren();
      if (!data.length) cont.appendChild(nodo('p', 'ayuda', 'No hay pedidos por revisar.'));
      data.forEach((o) => {
        const fila = nodo('div', 'fila-pedido');
        fila.append(nodo('strong', null, `${o.apodo} · ${pesos(o.total)}`), nodo('span', 'ayuda', `${fecha(o.creado_en)} — ${o.resumen || 'sin detalle'}`));
        const acc = nodo('div', 'acciones');
        [['✅ Entregado', 'entregado', 'btn--verde'], ['✖ Cancelar', 'cancelado', 'btn--suave']].forEach(([txt, estado, clase]) => {
          const b = nodo('button', `btn ${clase}`, txt);
          b.type = 'button';
          b.addEventListener('click', async () => {
            b.disabled = true;
            const r = await sb.rpc('admin_marcar_pedido', { p_id: o.id, p_estado: estado });
            if (r.error) { alert(Cuenta.traducir(r.error)); b.disabled = false; return; }
            cargarPedidos();
          });
          acc.appendChild(b);
        });
        fila.appendChild(acc);
        cont.appendChild(fila);
      });
    } catch (e) { cont.replaceChildren(nodo('p', 'aviso', Cuenta.traducir(e))); }
  }

  async function iniciar() {
    if (!Cuenta.activa) return mostrar('a-apagada');
    prepararEntrada();
    try {
      sb = await Cuenta.cliente();
      const sesion = await Cuenta.sesion();
      if (!sesion) return mostrar('a-entrar');
      await exigirDosPasos();
      $('a-form-cupon').addEventListener('submit', revisarCupon);
      $('a-recargar').addEventListener('click', cargarPedidos);
      $('a-salir').addEventListener('click', async () => { await Cuenta.salir(); location.reload(); });
      mostrar('a-panel');
      cargarPedidos();
    } catch (e) {
      console.warn('[panel]', e && e.message);
      mostrar('a-entrar');
      aviso($('a-mensaje'), Cuenta.traducir(e));
    }
  }
  iniciar();
})();
