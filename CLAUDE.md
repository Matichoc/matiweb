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
  sin `localStorage`. Con las cuentas encendidas, el carrito pide nombre y celular antes de Tuu/WhatsApp y los anota en
  Supabase (`pedido_web_registrar`, `supabase/03_pedidos_web.sql`) con estados Interesado → Dice que pagó → … y aviso por
  Telegram al dueño; nunca frena la compra si falla. "Ya pagué" NO es un pago confirmado: lo confirma el dueño en Tuu. `productos.html` solo redirige a la Tienda.
  "Pagar online con Tuu" abre un link fijo a Tuu (sin monto/detalle: Tuu
  ignora `?monto=`, verificado por el dueño) y deja el total copiado al
  portapapeles para pegarlo; el pedido real se manda por WhatsApp. Son dos flujos **sin vínculo** — no asumir que
  están conectados ni afirmar un pago como confirmado.
- `js/brillos.js` + `.brillos`/`.choco-fondo` (css/chocolate-wow.css): chocolates y destellos que suben
  detrás de los recuadros. Para sumar un recuadro nuevo, agrega su selector a `SELECTOR` en el script.
  La barra café con gotas (`.choco-drip`) se quitó de los banners por pedido del dueño: no volver a ponerla.
- Matijuego (el arcade) se sirve desde este sitio, en `matijuego/` (`https://matichoc.cl/matijuego/`), con su propia política de
  seguridad en su `index.html` (el `importmap` va con hash: si se cambia, recalcular el sha256). **`matijuego/` es una copia GENERADA**:
  el código vive en `Matichoc/MAtigame_v0` (`app/index.template.html` con bloques `<!--WEB-->`/`<!--APP-->`, `css/`, `js/`) y se
  despliega aquí con `MATIJUEGO_DEMO=1 node scripts/deploy-matiweb.mjs <ruta-a-matiweb>` (la web va en modo demo). **No editar a mano
  aquí**: el próximo despliegue lo pisa; se cambia en MAtigame_v0 y se despliega. La variante APP (Android, la que usan los niños) no
  lleva enlaces a matichoc.cl; en la web esos enlaces son **discretos a propósito** (texto chico, sin íconos, sin color de marca) para
  que el juego no empuje hacia la tienda (ver Ley 20.606 en la revisión legal). No volver a hacerlos llamativos sin hablar con el dueño.
  **Política de privacidad del Matijuego** (la que se pega en Google Play): `matijuego/privacy.html` (`https://matichoc.cl/matijuego/privacy.html`), también generada desde `app/privacy.html` de MAtigame_v0 junto con el resto de `matijuego/` (el deploy la repone). Es **distinta** de `pages/privacidad.html` (la política general de matichoc.cl, que no se toca desde el juego): si cambia lo que el juego guarda o envía, se actualiza en MAtigame_v0 y se despliega.

## Cuentas Matilover (opcionales, apagadas hasta configurar Supabase)

El sitio es abierto: sin cuenta se navega, se compra y se juega. La cuenta Matilover solo sirve para **guardar
progreso** (racha, descuentos, premios, juegos). Con `js/supabase-config.js` vacío todo funciona como antes (racha y
pedidos locales); encendidas, el avance vive solo en la cuenta y no se acumula nada en el navegador.
- `supabase/schema.sql` (+ `02_dueno_y_datos.sql`, `03_pedidos_web.sql`, `04_cuentas_desde_14.sql`, en ese orden): tablas + RLS + funciones (la racha, los cupones y los pedidos se validan en el servidor,
  el navegador no escribe directo). Reglas del programa en `reglas()`. Guía: `supabase/LEEME.md`.
- `js/cuenta.js` (API compartida), `pages/cuenta.html` (Matilover), `pages/admin.html` (panel del dueño: exige
  estar en `admins` + verificación en dos pasos). `js/vendor/supabase.js` es la librería oficial copiada (MIT).
- Las cuentas son **solo desde los 14 años** (`04_cuentas_desde_14.sql`); no se crean cuentas de menores. Las reglas públicas del programa
  están en `pages/bases-matilover.html` y deben coincidir con `reglas()` (7 días → 10%; 10 pedidos → 1 cuchuflí o alfajor; 30 días; no acumulables).
- La clave `anon` es pública; **nunca** poner `service_role` ni el token del bot de Telegram en el repositorio
  (el token vive solo en la tabla privada `config_privada` de Supabase).

## Matichico, el guía (`js/matichico-guia.js` + `css/matichico-guia.css`)

Mascota (**Matichico y Chocolatina se alternan: día par uno, día impar la otra, con la fecha de Chile; `?guia=chocolatina` o `?guia=matichico` fuerza uno para probar**) que llega saltando a la portada, Tienda, Historia, La Maestra y Contacto (cada página decide si carga el script; **no** va en el
Matijuego, el panel, Mi cuenta, Términos/Privacidad, ni con el carrito abierto). Reglas acordadas con el dueño: es un **guion cerrado**
(palabras clave → respuestas fijas, sin IA libre ni servidor); **solo informa** con lo que el sitio ya dice y **no recomienda ni promociona
productos** (Ley 20.606, personajes + alimentos "ALTO EN"); ingredientes, alérgenos y salud los **deriva a WhatsApp**; no guarda lo que se
escribe (solo `sessionStorage` si lo despidieron; al despedirlo queda un botón redondo con su carita para volver a llamarlo). **Accesible**: habla con la voz del navegador (SpeechSynthesis: lee sus respuestas, los pasos del recorrido y, si se lo piden, la página; apagada por defecto), enlace de salto al inicio de la página para lectores de pantalla/teclado, "Letra grande", aria-live; sin voz en el navegador, esos botones no aparecen. Cualquier cambio al guía debe mantener esas pruebas (voz, teclado, Escape detiene la voz). Si cambian las reglas del programa, el reparto o los datos legales, actualizar también su
guion (`SABE`) y `pages/bases-matilover.html`. Imágenes: `assets/personajes/` (Matichico de pie con polera negra de Matichoc, dos poses sin fondo, recortadas de la hoja de poses del dueño; el guía cambia de pose al saludar, responder y recorrer).

## SEO y medición (`docs/SEO.md`)

El menú, el `h1` y los enlaces legales también van escritos como respaldo (`.seo-fallback`) dentro de los contenedores `#header`, `#page-banner`,
`#banner` y `#footer` de cada página: si se cambia el menú o el título de una página, cambiar también ese respaldo. `js/analitica.js` (GoatCounter, sin
cookies, cuenta `matichoc`) está **encendido** y `pages/privacidad.html` lo declara; si se apaga o cambia, actualizar ese texto. Al cambiar una página,
actualizar su `lastmod` en `sitemap.xml`. Imagen para compartir: `assets/brand/og-matichoc.jpg` (logo oficial vertical, sin deformar).

## Datos legales (entregados por el dueño)

Chocolatería Matichoc Inés Saavedra EIRL · RUT 77.877.372-4 · Guayacán 1409, La Ligua · i.saavedra.nu@gmail.com ·
resolución sanitaria N° 2505129791. Aparecen en `pages/terminos.html`, `pages/privacidad.html` y el pie de página
(`components/footer.html`, sin domicilio). Entregas: martes y jueves en el stand de la plaza de La Ligua, otro día a
coordinar en el domicilio, o envío por pagar (a regiones, Blue Express). No cambiar estos textos sin confirmar con el dueño.

## Pendientes que el dueño pidió NO recordar

- Etiquetas nutricionales y sellos ("ALTO EN") de cada producto: están en preparación. **No pedirlas ni recordarlas** hasta que el dueño avise.

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
