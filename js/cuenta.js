// Cuentas de clientes (Supabase): inicio de sesión, racha verificada por el servidor,
// cupones y pedidos. TODO es opcional: sin configuración (js/supabase-config.js) no hace nada.
//
// Los datos viven en la base de datos de Supabase y solo se tocan mediante las funciones de
// supabase/schema.sql, que validan en el servidor. Aquí nunca se confía en lo que diga el
// navegador sobre la racha o los premios.
(function () {
  const SRC = document.currentScript && document.currentScript.src; // dónde vive este script
  const cfg = window.MATICHOC_SUPABASE || {};
  const activa = !!(cfg.url && cfg.anonKey);
  const api = { activa, config: cfg };
  window.Cuenta = api;
  if (!activa) return;

  const ref = new URL(cfg.url).hostname.split('.')[0];
  const CLAVE_SESION = `sb-${ref}-auth-token`;
  let promesaCliente = null;

  // Carga la librería solo cuando hace falta (pesa ~200 KB) y crea el cliente una vez.
  api.cliente = function () {
    if (!promesaCliente) {
      promesaCliente = new Promise((ok, fallo) => {
        const crear = () => ok(window.supabase.createClient(cfg.url, cfg.anonKey, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' }
        }));
        if (window.supabase) return crear();
        const s = document.createElement('script');
        s.src = new URL('vendor/supabase.js', SRC).href;
        s.onload = crear;
        s.onerror = () => fallo(new Error('No se pudo cargar el módulo de cuentas'));
        document.head.appendChild(s);
      });
    }
    return promesaCliente;
  };

  // ¿Hay una sesión guardada? (sin cargar la librería)
  api.haySesion = function () {
    try { return !!localStorage.getItem(CLAVE_SESION); } catch (e) { return false; }
  };

  const MENSAJES = {
    'Debes iniciar sesión': 'Inicia sesión para continuar.',
    'Primero confirma tu edad y acepta los términos': 'Primero confirma tu edad y acepta los términos.',
    'Aún no completas la racha': 'Todavía no completas la racha.',
    'Aún no completas los pedidos': 'Todavía no completas los pedidos.',
    'Demasiados pedidos hoy': 'Ya registraste muchos pedidos hoy.',
    'No autorizado': 'No tienes permiso para esto.'
  };
  api.traducir = function (error) {
    const m = (error && error.message) || '';
    for (const k in MENSAJES) if (m.includes(k)) return MENSAJES[k];
    if (/token.*(expired|invalid)|otp.*(expired|invalid)/i.test(m)) return 'Ese código no es válido o ya venció. Pide uno nuevo.';
    if (/rate limit|over_email_send_rate_limit/i.test(m)) return 'Se enviaron muchos correos seguidos. Espera unos minutos e intenta de nuevo.';
    if (/invalid.*email|email.*invalid|validate email/i.test(m)) return 'Ese correo no parece válido.';
    if (/Failed to fetch|NetworkError|network/i.test(m)) return 'No hay conexión. Revisa tu internet e intenta de nuevo.';
    return 'Algo salió mal. Intenta de nuevo en un momento.';
  };

  async function rpc(nombre, args) {
    const sb = await api.cliente();
    const { data, error } = await sb.rpc(nombre, args || {});
    if (error) throw error;
    return data;
  }

  api.sesion = async () => (await (await api.cliente()).auth.getSession()).data.session;
  api.entrarCorreo = async function (correo, destino) {
    const sb = await api.cliente();
    const { error } = await sb.auth.signInWithOtp({ email: correo, options: { emailRedirectTo: destino } });
    if (error) throw error;
  };
  api.verificarCodigo = async function (correo, codigo) {
    const sb = await api.cliente();
    const { error } = await sb.auth.verifyOtp({ email: correo, token: codigo, type: 'email' });
    if (error) throw error;
  };
  api.entrarProveedor = async function (proveedor, destino) {
    const sb = await api.cliente();
    const { error } = await sb.auth.signInWithOAuth({ provider: proveedor, options: { redirectTo: destino } });
    if (error) throw error;
  };
  api.salir = async function () { await (await api.cliente()).auth.signOut(); };

  api.resumen = () => rpc('mi_resumen');
  api.declarar = (edad, apodo) => rpc('declarar_perfil', { p_edad: edad, p_apodo: apodo || null });
  api.reclamarRacha = () => rpc('reclamar_cupon_racha');
  api.reclamarPedidos = () => rpc('reclamar_premio_pedidos');
  api.borrarCuenta = () => rpc('borrar_mi_cuenta');
  api.registrarVisita = () => rpc('registrar_visita');
  api.registrarPedido = (total, resumen) => rpc('registrar_pedido', { p_total: total, p_resumen: resumen });

  const rutaCuenta = () => new URL('../pages/cuenta.html', SRC).href;

  // ---- Enlace "Mi cuenta" en el menú (el encabezado se inyecta después de cargar la página) ----
  function enlazarMenu() {
    const nav = document.getElementById('site-nav');
    if (!nav || nav.querySelector('[data-mi-cuenta]')) return;
    const inicio = nav.querySelector('a[href$="index.html"]');
    if (!inicio) return;
    const a = inicio.cloneNode(false);
    a.setAttribute('href', rutaCuenta());
    a.setAttribute('data-mi-cuenta', '');
    a.textContent = api.haySesion() ? '💛 Mi cuenta' : '💛 Hazte Matilover';
    const ultimo = nav.querySelector('a[href*="matijuego"]');
    nav.insertBefore(a, ultimo || null);
  }
  document.addEventListener('matichoc:componente', (e) => { if (e.detail.id === 'header') enlazarMenu(); });
  document.addEventListener('DOMContentLoaded', enlazarMenu);

  // ---- Racha en el inicio: con sesión, la del servidor; sin sesión, invitación a crear cuenta ----
  function crear(tag, clase, texto) {
    const e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto != null) e.textContent = texto;
    return e;
  }

  async function pintarRacha() {
    const caja = document.getElementById('racha-widget');
    if (!caja) return;
    if (!api.haySesion()) {
      const cta = crear('p', 'racha-cta');
      const enlace = crear('a', null, 'Hazte Matilover gratis');
      enlace.href = rutaCuenta();
      cta.append('💛 ', enlace, ' para empezar tu racha, juntar descuentos y canjear premios. Es opcional: el sitio es de todos.');
      caja.appendChild(cta);
      return;
    }
    try {
      const hoy = new Date().toISOString().slice(0, 10);
      const marca = 'matichoc_visita_' + hoy;
      let r = await api.resumen();
      if (r.perfil_listo && !sessionStorage.getItem(marca)) {
        await api.registrarVisita();
        sessionStorage.setItem(marca, '1');
        r = await api.resumen();
      }
      const meta = r.reglas.racha_meta;
      const tarjeta = crear('div', 'racha-card' + (r.racha >= meta ? ' racha-card--completa' : ''));
      const texto = crear('div', 'racha-texto');
      if (!r.perfil_listo) {
        texto.append(crear('strong', null, 'Termina tu perfil Matilover'),
          crear('p', null, 'Confirma tu edad y acepta los términos para empezar a juntar racha.'));
      } else {
        texto.append(crear('strong', null, `Racha de ${r.racha} día${r.racha === 1 ? '' : 's'} 🔥`),
          crear('p', null, r.racha >= meta
            ? `¡Llegaste a los ${meta} días! Reclama tu ${r.reglas.racha_premio}.`
            : `Vuelve mañana — te ${meta - r.racha === 1 ? 'falta' : 'faltan'} ${meta - r.racha} día${meta - r.racha === 1 ? '' : 's'} para tu ${r.reglas.racha_premio}.`));
      }
      const ir = crear('a', 'racha-btn', r.racha >= meta ? '🎁 Reclamar' : '💛 Mi cuenta');
      ir.href = rutaCuenta();
      texto.appendChild(ir);
      tarjeta.appendChild(texto);
      caja.replaceChildren(tarjeta);
    } catch (e) { /* si falla, queda la racha local de siempre */ }
  }
  // En la tienda: el avance de pedidos también vive en la cuenta Matilover.
  async function pintarPedidos() {
    const el = document.getElementById('pedidos-widget');
    if (!el) return;
    if (!api.haySesion()) {
      el.textContent = '💛 Hazte Matilover (gratis) para juntar pedidos y ganar un premio. Puedes comprar sin cuenta.';
      return;
    }
    try {
      const r = await api.resumen();
      el.textContent = r.perfil_listo
        ? `🍫 Llevas ${r.pedidos_entregados} de ${r.reglas.pedidos_meta} pedidos entregados — premio: ${r.reglas.pedidos_premio}.`
        : '💛 Termina tu perfil Matilover para juntar pedidos.';
    } catch (e) { /* queda en blanco */ }
  }
  document.addEventListener('DOMContentLoaded', () => { setTimeout(() => { pintarRacha(); pintarPedidos(); }, 0); });
})();
