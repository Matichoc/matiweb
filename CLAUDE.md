# Matichoc — Pasión por el Cacao

Chocolatería artesanal familiar (La Ligua, Chile, desde 2011). Identidad: elaboración
artesanal, cercanía familiar, personajes Matichico y Chocolatina, la maestra
chocolatera Inés Saavedra, la comunidad de clientes "Matilovers".

## Arquitectura real (no asumir otra)

Sitio estático: HTML/CSS/JS plano, **sin build, sin framework, sin backend**.
Deploy directo a GitHub Pages (`.nojekyll`).

- `index.html` + `pages/*.html`: una página por sección, cada una carga
  `header`, `banner` (solo home) y `footer` vía `js/base.js` → `loadComponent(id, path, vars)`
  (fetch + innerHTML, con `{{base}}` para rutas relativas).
- `js/catalogo.js`: única fuente de verdad del catálogo (`CATALOGO`,
  `CATALOGO_CONSULTAR`). La Tienda (`pages/tienda.html` + `js/tienda.js`) lee de ahí — nunca
  dupliques precios/productos a mano en una página.
- `css/styles.css`: hoja global única; hay bloques duplicados/muertos de
  trabajo anterior, no asumir que todo lo que hay ahí está en uso.
- Checkout: catálogo y carrito viven juntos en `tienda.html` (`js/tienda.js`, `css/tienda.css`),
  100% client-side y sin `localStorage`. `productos.html` solo redirige a la Tienda.
  "Pagar online con Tuu" abre un link fijo a Tuu (sin monto/detalle: Tuu
  ignora `?monto=`, verificado por el dueño) y deja el total copiado al
  portapapeles para pegarlo; el pedido real se manda por WhatsApp. Son dos flujos **sin vínculo** — no asumir que
  están conectados ni afirmar un pago como confirmado.
- `js/brillos.js` + `.brillos`/`.choco-fondo` (css/chocolate-wow.css): chocolates y destellos que suben
  detrás de los recuadros. Para sumar un recuadro nuevo, agrega su selector a `SELECTOR` en el script.
  La barra café con gotas (`.choco-drip`) se quitó de los banners por pedido del dueño: no volver a ponerla.
- Matijuego vive en otro repo (`Matichoc/MAtigame_v0`), fuera de este.

## Datos legales (entregados por el dueño)

Chocolatería Matichoc Inés Saavedra EIRL · RUT 77.877.372-4 · Guayacán 1409, La Ligua · i.saavedra.nu@gmail.com ·
resolución sanitaria N° 2505129791. Aparecen en `pages/terminos.html`, `pages/privacidad.html` y el pie de página
(`components/footer.html`, sin domicilio). Entregas: martes y jueves en el stand de la plaza de La Ligua, otro día a
coordinar en el domicilio, o envío por pagar (a regiones, Blue Express). No cambiar estos textos sin confirmar con el dueño.

## Convenciones

- Español en todo el contenido visible y en mensajes de commit/PR.
- Mobile-first: todo cambio visual se prueba en viewport ~375px antes de darlo
  por terminado (capturas o headless, no basta con mirar en desktop).
- Animaciones/efectos nuevos siempre respetan `prefers-reduced-motion: reduce`.
- Preferir CSS/SVG sobre JS cuando el efecto lo permita; no agregar
  dependencias externas (GSAP, Three.js, etc.) sin justificar por qué CSS/JS
  vanilla no alcanza.

## Comandos de desarrollo

```
python3 -m http.server 8123          # servir el sitio localmente
```
No hay `npm run build`, lint ni tests automatizados — "verificar" significa
cargar las páginas (headless o en navegador) y confirmar que no hay errores
de consola ni overflow horizontal en mobile.

## Reglas de protección

- No modificar los logos originales (`assets/brand/`) ni alterar sus
  proporciones.
- No crear un segundo catálogo desconectado de `js/catalogo.js`.
- No cambiar el proceso de pago (Tuu/WhatsApp) sin revisión explícita del
  dueño del negocio.
- No eliminar funcionalidad existente sin confirmar primero que no se usa.
- No inventar ni afirmar datos sensibles del negocio (precios, nombres de
  localidades, estado de auspicios/sponsors) — confirmar con el dueño.

## Flujo de trabajo

- Cambios chicos, en rama, con evidencia de prueba antes de pushear.
- Nunca hacer push a `main`, merge, ni cambios de DNS/hosting/producción sin
  aprobación explícita del dueño en la conversación.
- Cada commit explica qué cambió y cómo revertirlo si hace falta.
