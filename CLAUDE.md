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
  `CATALOGO_CONSULTAR`). `productos.html` y `tienda.html` leen de ahí — nunca
  dupliques precios/productos a mano en una página.
- `css/styles.css`: hoja global única; hay bloques duplicados/muertos de
  trabajo anterior, no asumir que todo lo que hay ahí está en uso.
- Checkout: carrito 100% client-side en `tienda.html` (sin `localStorage`).
  "Pagar online con Tuu" abre un link fijo a Tuu (sin monto/detalle: Tuu
  ignora `?monto=`, verificado por el dueño) y deja el total copiado al
  portapapeles para pegarlo; el pedido real se manda por WhatsApp. Son dos flujos **sin vínculo** — no asumir que
  están conectados ni afirmar un pago como confirmado.
- Matijuego vive en otro repo (`Matichoc/MAtigame_v0`), fuera de este.

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
