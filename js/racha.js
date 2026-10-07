// Racha de visitas + contador de pedidos de Matichoc.
//
// 100% client-side (localStorage) — no hay backend que lo verifique.
// Es un sistema de honor: el negocio confirma la recompensa a ojo cuando
// el cliente la reclama por WhatsApp (ver skill matichoc-seguridad: un
// cliente podría borrar su caché o editar el valor a mano; aceptamos ese
// riesgo a cambio de no construir un backend todavía).

const MATICHOC_WHATSAPP = '56975645591';

// Con las cuentas Matilover encendidas (js/supabase-config.js), el avance de racha y de pedidos
// se guarda solo en la cuenta (js/cuenta.js): aquí no se acumula nada en el navegador.
function cuentasActivas() {
  return !!(window.MATICHOC_SUPABASE && window.MATICHOC_SUPABASE.url);
}
const RACHA_KEY = 'matichoc_racha_v1';
const PEDIDOS_KEY = 'matichoc_pedidos_v1';
const META_RACHA = 7;
const META_PEDIDOS = 10;

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

function diaAnteriorISO(fechaISO) {
  const d = new Date(fechaISO + 'T00:00:00');
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

// Lo guardado en localStorage lo puede editar cualquiera desde su navegador y luego
// se interpola en el HTML del widget: se valida el tipo y el rango antes de usarlo.
function leerRacha() {
  const vacio = { ultimaVisita: null, racha: 0 };
  try {
    const e = JSON.parse(localStorage.getItem(RACHA_KEY));
    if (!e || typeof e !== 'object') return vacio;
    const racha = Number.isInteger(e.racha) && e.racha >= 0 && e.racha <= 3650 ? e.racha : 0;
    const fecha = typeof e.ultimaVisita === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.ultimaVisita) ? e.ultimaVisita : null;
    return { ultimaVisita: fecha, racha: fecha ? racha : 0 };
  } catch (e) {
    return vacio;
  }
}

function actualizarRacha() {
  const hoy = hoyISO();
  const estado = leerRacha();
  if (estado.ultimaVisita === hoy) {
    return estado;
  }
  estado.racha = (estado.ultimaVisita === diaAnteriorISO(hoy)) ? estado.racha + 1 : 1;
  estado.ultimaVisita = hoy;
  try {
    localStorage.setItem(RACHA_KEY, JSON.stringify(estado));
  } catch (e) {
    /* localStorage no disponible (modo privado, etc.) — seguimos sin romper la página */
  }
  return estado;
}

function leerPedidos() {
  try {
    const n = parseInt(localStorage.getItem(PEDIDOS_KEY), 10);
    return Number.isInteger(n) && n >= 0 ? Math.min(n, 100000) : 0;
  } catch (e) {
    return 0;
  }
}

function sumarPedido() {
  if (cuentasActivas()) return 0;
  const n = leerPedidos() + 1;
  try {
    localStorage.setItem(PEDIDOS_KEY, String(n));
  } catch (e) {
    /* localStorage no disponible — el pedido se manda igual por WhatsApp */
  }
  return n;
}

function renderRacha() {
  const el = document.getElementById('racha-widget');
  if (!el || cuentasActivas()) return;
  const { racha } = actualizarRacha();
  const completa = racha >= META_RACHA;
  const faltan = Math.max(0, META_RACHA - racha);
  const mensaje = encodeURIComponent(
    `¡Hola! Llevo ${racha} días seguidos visitando matichoc.cl 🎉 Quiero mi 10% de descuento.`
  );
  el.innerHTML = `
    <div class="racha-card${completa ? ' racha-card--completa' : ''}">
      <img src="assets/brand/logo-vertical.png" alt="Matichoc" class="racha-avatar" width="700" height="909">
      <div class="racha-texto">
        <strong>Racha de ${racha} día${racha === 1 ? '' : 's'} 🔥</strong>
        ${completa
          ? `<p>¡Llegaste a los ${META_RACHA} días! Reclama tu 10% de descuento.</p>
             <a class="racha-btn" href="https://wa.me/${MATICHOC_WHATSAPP}?text=${mensaje}" target="_blank" rel="noopener noreferrer">📲 Reclamar descuento</a>`
          : `<p>Vuelve mañana — te ${faltan === 1 ? 'falta' : 'faltan'} ${faltan} día${faltan === 1 ? '' : 's'} para tu 10% de descuento.</p>`
        }
      </div>
    </div>
  `;
}

function renderPedidosWidget() {
  const el = document.getElementById('pedidos-widget');
  if (!el || cuentasActivas()) return;
  const pedidos = leerPedidos();
  const completa = pedidos >= META_PEDIDOS;
  const faltan = Math.max(0, META_PEDIDOS - pedidos);
  el.textContent = completa
    ? `🎁 ¡Ya llevas ${pedidos} pedidos por la web! Menciónalo por WhatsApp para tu cuchuflí o alfajor gratis.`
    : `🍫 Llevas ${pedidos} de ${META_PEDIDOS} pedidos por la web — a los ${META_PEDIDOS}, un cuchuflí o alfajor gratis (te ${faltan === 1 ? 'falta' : 'faltan'} ${faltan}).`;
}

document.addEventListener('DOMContentLoaded', () => {
  renderRacha();
  renderPedidosWidget();
});
