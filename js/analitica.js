// Contador de visitas de Matichoc: anónimo y SIN cookies (GoatCounter, https://www.goatcounter.com).
// Apagado hasta que se escriba el código de la cuenta en CODIGO (p. ej. 'matichoc' → matichoc.goatcounter.com).
// No guarda nada en el navegador, no identifica a nadie y respeta "No rastrear". No corre en localhost ni en el panel,
// Mi cuenta ni el Matijuego (esas páginas no cargan este script). Si se enciende, la política de privacidad debe decirlo
// (ver docs/SEO.md) y las páginas deben permitir https://*.goatcounter.com en img-src (ya está).
(function () {
  const CODIGO = '';
  if (!CODIGO) return;
  if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return;
  if (/^(localhost|127\.|\[::1\])/.test(location.hostname)) return;

  const URL_CONTEO = 'https://' + CODIGO + '.goatcounter.com/count';

  function enviar(datos) {
    const q = new URLSearchParams(datos);
    q.set('rnd', Math.random().toString(36).slice(2));
    new Image().src = URL_CONTEO + '?' + q.toString();
  }

  // Solo se informa de dónde vienen si es otro sitio (buscador, red social…); nunca páginas propias.
  let origen = '';
  try { if (document.referrer && new URL(document.referrer).origin !== location.origin) origen = document.referrer; } catch (e) { /* sin referer */ }

  enviar({ p: location.pathname, t: document.title, r: origen });

  // Eventos: clic en WhatsApp o en el pago de Tuu desde enlaces de las páginas (no registra mensajes ni datos de nadie).
  document.addEventListener('click', (ev) => {
    const a = ev.target.closest && ev.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    let evento = '';
    if (href.indexOf('wa.me/') !== -1) evento = 'clic-whatsapp';
    else if (href.indexOf('tuu.cl') !== -1) evento = 'clic-pago-tuu';
    if (evento) enviar({ p: evento + location.pathname, t: evento, e: 'true' });
  });
})();
