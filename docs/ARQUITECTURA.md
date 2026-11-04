# Arquitectura técnica de matichoc.cl

Documento para quien programe el sitio. Para el uso y los cambios de contenido, ver el [README](../README.md) y
[COMO-ACTUALIZAR.md](COMO-ACTUALIZAR.md).

## 1. Principios

- **Estático puro:** HTML, CSS y JS sin compilar. No hay `npm`, bundler, framework ni servidor propio.
  Lo que está en el repositorio es exactamente lo que se publica.
- **Publicación:** GitHub Pages desde la rama `main`, carpeta raíz. `.nojekyll` evita que Jekyll procese el sitio.
  `CNAME` fija el dominio `matichoc.cl`, cuyo DNS está en Cloudflare.
- **Sin dependencias externas en tiempo de ejecución,** salvo Supabase (cuentas), GoatCounter (visitas) y las fotos
  antiguas de `i.imgur.com`. La librería de Supabase está copiada en `js/vendor/supabase.js`, no viene de un CDN.
- **Celular primero,** accesible (teclado, lectores de pantalla, `aria-live`) y con `prefers-reduced-motion`
  respetado en todo lo animado.

## 2. Páginas y scripts que carga cada una

Cada página carga solo lo que usa. El orden importa: `base.js` primero, y `supabase-config.js` antes de `cuenta.js`.

| Página | Scripts (en orden) |
|---|---|
| `index.html` | base, analitica, supabase-config, cuenta, brillos, matichico-guia, racha, puntos-venta, page-index |
| `pages/tienda.html` | base, analitica, supabase-config, cuenta, brillos, matichico-guia, catalogo, racha, tienda, page-tienda |
| `pages/historia.html` | revelar, base, analitica, supabase-config, cuenta, brillos, matichico-guia, page-historia |
| `pages/la_maestra.html` | revelar, base, analitica, supabase-config, cuenta, brillos, matichico-guia, page-maestra |
| `pages/contacto.html` | base, analitica, supabase-config, cuenta, brillos, matichico-guia, puntos-venta, page-contacto |
| `pages/opiniones.html` | base, analitica, supabase-config, cuenta, brillos, page-opiniones |
| `pages/terminos.html`, `privacidad.html`, `bases-matilover.html` | base, analitica, supabase-config, cuenta, brillos, page-* |
| `pages/cuenta.html` | base, supabase-config, cuenta, page-cuenta *(sin analítica)* |
| `pages/admin.html` | base, supabase-config, cuenta, page-admin *(sin analítica, `noindex`)* |
| `pages/productos.html` | page-productos (solo redirige a la Tienda conservando el `#`) |
| `404.html` | base, supabase-config, cuenta, page-404 (rutas absolutas `/js/…`) |
| `matijuego/` | Propios del juego (ver §9) |

Los `page-*.js` cargan los componentes de cada página y su lógica propia, por ejemplo el visor de fotos y las
pestañas en `page-maestra.js`. Existen porque la política de seguridad prohíbe JavaScript dentro del HTML (§4).

## 3. Componentes compartidos

`js/base.js` → `loadComponent(id, ruta, vars)`:

1. Hace `fetch(ruta)` del HTML del componente.
2. Reemplaza cada `{{clave}}` por su valor. `{{base}}` es `''` en la raíz y `'../'` en `pages/`.
3. Lo inserta en `#id` y emite el evento `matichoc:componente` (`detail.id`), que escuchan otros scripts,
   como `cuenta.js` para el menú de la cuenta.

| Componente | Variables | Dónde |
|---|---|---|
| `components/header.html` | `base` | Todas: menú, botón del menú en celular y enlace a la cuenta |
| `components/footer.html` | `base` | Todas: redes, datos legales sin domicilio y enlaces legales |
| `components/banner.html` | — | Solo la portada (`#banner`) |
| `components/page-banner.html` | `base`, `emoji`, `titulo`, `subtitulo` | Resto de páginas (`#page-banner`) |

`base.js` también maneja el menú del celular (delegado en `document`, porque el header llega después) y publica el
alto real del encabezado en `--header-h`, para que las anclas y las barras pegadas no queden tapadas.

**Respaldo `.seo-fallback`:** dentro de `#header`, `#banner`/`#page-banner` y `#footer`, cada página trae escrito el
menú, el `h1` y los enlaces legales. Están ocultos a la vista y se reemplazan al cargar el componente. Si cambia el
menú o el título de una página, hay que cambiarlos en ambos lugares.

## 4. Seguridad

- **Content-Security-Policy** en un `<meta>` de cada página. Ejemplo de la Tienda:
  `default-src 'self'; img-src 'self' https://i.imgur.com https://*.goatcounter.com data:; style-src 'self' 'unsafe-inline';
  script-src 'self'; connect-src 'self' https://<proyecto>.supabase.co; object-src 'none'; frame-src 'none';
  base-uri 'self'; form-action 'self' https://wa.me`.
  - Sin scripts dentro del HTML: todo va en `js/`.
  - Una imagen de otro dominio no carga. Hay que guardarla en `assets/` o agregar el dominio a `img-src` en
    **todas** las páginas.
  - Los estilos dentro del HTML sí están permitidos (`'unsafe-inline'` en `style-src`).
- **Enlaces externos** con `target="_blank" rel="noopener noreferrer"`.
- **Datos de clientes:** el navegador no escribe directo en tablas. Todo pasa por funciones de Supabase con reglas
  de acceso (RLS) y validación en el servidor (§7).
- **Secretos:** solo la clave publicable de Supabase va en el código (`js/supabase-config.js`). `service_role`, el token
  de Telegram y las contraseñas nunca van en el repositorio.
- La skill `.claude/skills/matichoc-seguridad` resume qué revisar en una auditoría.

## 5. Fuentes de datos (no duplicar)

| Dato | Fuente | Lo usan |
|---|---|---|
| Productos y precios | `js/catalogo.js` → `CATALOGO` | Tienda (tarjetas, filtros, búsqueda, carrito, datos estructurados) |
| Sección "Productos de Temporada" | `CATALOGO_CONSULTAR`, `A_PEDIDO`, `PERSONALIZADOS` | Tienda |
| Almacenes | `js/puntos-venta.js` → `PUNTOS_VENTA` | Portada y Contacto (carrusel) |
| Guion del guía | `js/matichico-guia.js` → `SABE`, `SUGERIDAS`, `RECORRIDOS` | Guía |
| Reglas Matilover | `reglas()` en `supabase/schema.sql` | Servidor; el texto público está en `bases-matilover.html` y en el guía |
| Fotos, ferias y entrevistas de Inés | `pages/la_maestra.html` (HTML) | Esa página |
| Opiniones | `pages/opiniones.html` (HTML) | Esa página |

Forma de un producto en `CATALOGO`:

```js
{ id: 'alfajor', categoria: 'Alfajores', nombre: 'Alfajor',
  descripcion: '…', precio: 1000, img: '/assets/productos/alfajor.webp', badge: 'Opcional' }
```

`id` debe ser único: el carrito y los filtros lo usan (`.t-card[data-id]`). Los productos de `A_PEDIDO` usan
`data-pedido` en vez de `data-id` para quedar fuera del carrito.

## 6. Tienda y pedido (`js/tienda.js`)

- El catálogo se pinta desde `CATALOGO`, con chips por categoría, búsqueda por texto y "Ver más" en descripciones largas.
- **Carrito en memoria:** sin `localStorage`; se pierde al cerrar la pestaña. Esto es a propósito.
- **WhatsApp:** `https://wa.me/56975645591?text=…` con el detalle del pedido.
- **Tuu:** `https://www.tuu.cl/matichoc_pago` es un enlace fijo, porque Tuu ignora `?monto=`. Al tocarlo se copia el
  total al portapapeles para pegarlo. El pago con Tuu y el pedido por WhatsApp **no están conectados**.
- **Registro del pedido (cuentas encendidas):** antes de abrir WhatsApp o Tuu se piden nombre y celular y se llama
  `pedido_web_registrar` (estado "Interesado"). `pedido_web_evento` marca "Dice que pagó". Supabase avisa al dueño
  por Telegram. Si algo falla, la compra continúa igual. "Ya pagué" no es un pago confirmado.
- Galería de personalizados (`PERSONALIZADOS`): cada foto abre WhatsApp con la ocasión.

## 7. Cuentas Matilover (Supabase)

- Están encendidas cuando `js/supabase-config.js` tiene `url` y `anonKey`, como hoy. Con `url: ''` todo sigue
  funcionando sin cuentas.
- `js/cuenta.js` expone una API (`api.entrarCorreo`, `api.resumen`, `api.reclamarRacha`, `api.pedidoWebRegistrar`, …).
  Todo llama a funciones RPC del servidor.
- SQL, en este orden: `schema.sql` → `02_dueno_y_datos.sql` → `03_pedidos_web.sql` → `04_cuentas_desde_14.sql`.
  Todos se pueden volver a ejecutar sin problema.
  - `schema.sql`: tablas, RLS, `reglas()`, racha (`registrar_visita`, `racha_ciclo`), cupones, pedidos, progreso del
    juego, borrar la cuenta y las funciones `admin_*`.
  - `02`: administradores por correo, perfil (edad, apodo, novedades) y listado de Matilovers.
  - `03`: pedidos web (con o sin cuenta), estados y aviso por Telegram (token en la tabla privada `config_privada`).
  - `04`: cuentas solo desde los 14 años.
- **Panel del dueño** (`pages/admin.html`): exige estar en `admins` y verificación en dos pasos (TOTP). Sirve para
  validar y canjear cupones, revisar y marcar pedidos y ver Matilovers.
- **Racha sin cuenta:** `js/racha.js` guarda en `localStorage` un sistema de honor; el dueño confirma por WhatsApp.
  Con las cuentas encendidas, el avance vive solo en la cuenta.
- Guía de configuración: [supabase/LEEME.md](../supabase/LEEME.md).

## 8. El guía Matichico / Chocolatina (`js/matichico-guia.js`)

- **Quién sale:** día par Matichico, día impar Chocolatina, con la fecha de Chile. `?guia=matichico|chocolatina`
  fuerza uno.
- **Dónde:** Inicio, Tienda, Historia, La Maestra y Contacto (la página decide si carga el script). No aparece con el
  carrito abierto.
- **`SABE`:** lista de temas `{ id, claves[], resp, links[], prioridad? }`. `buscar()` suma el largo de las claves que
  aparecen en la pregunta (sin tildes) y elige el tema con más puntos. Salud y alérgenos tienen `prioridad` y siempre
  derivan a WhatsApp.
- **`RECORRIDOS`:** pasos por página `[selector, texto]`. Si cambias un `id` o una clase de una página, revisa que el
  recorrido lo siga encontrando.
- **Memoria:** solo `sessionStorage` (`matichico-despedido`, `matichico-saludo`). No guarda lo que se escribe.
- **Accesibilidad:** voz del navegador (SpeechSynthesis, apagada por defecto; Escape la detiene), enlace de salto,
  "Letra grande" y `aria-live`. Cualquier cambio debe mantener estas pruebas.
- **Regla legal:** solo informa lo que el sitio ya dice. No recomienda ni promociona productos (Ley 20.606).
- Imágenes: `assets/personajes/` (ver su README).

## 9. Matijuego

- `matijuego/` es una **copia generada** desde el repositorio `Matichoc/MAtigame_v0`
  (`app/index.template.html` con bloques `<!--WEB-->`/`<!--APP-->`, más `css/` y `js/`).
- Se despliega desde ese repositorio con `MATIJUEGO_DEMO=1 node scripts/deploy-matiweb.mjs <ruta-a-matiweb>`. La web
  va en modo demo.
- Tiene su propia CSP. El `importmap` va con hash sha256: si cambia, hay que recalcular el hash.
- `matijuego/privacy.html` es la política que se pega en Google Play. Es distinta de `pages/privacidad.html`.
- Los enlaces a la tienda dentro del juego son discretos a propósito (Ley 20.606).

## 10. Estilos y efectos

- `css/styles.css` es la hoja global y tiene bloques antiguos sin uso. Antes de borrar algo, busca si se usa.
- Algunas páginas (La Maestra, Historia) tienen su CSS en un `<style>` propio, con prefijos (`.m-`, `.camino`, …).
- Paleta principal: café `#4b2e2e`, amarillo `#ffc800`, fucsia `#d4216c`, crema `#fff8f0`. Las tipografías de marca
  están en `assets/fonts/`. Antes de cambios visuales, revisa la skill `matichoc-marca`.
- `js/brillos.js` + `css/chocolate-wow.css`: chocolates y destellos que suben detrás de los recuadros. Para sumar un
  recuadro, agrega su selector a `SELECTOR`. La barra con gotas (`.choco-drip`) se quitó por pedido del dueño.
- `js/revelar.js`: aparición suave de `[data-reveal]` al hacer scroll. Sin JS o con movimiento reducido, todo se ve
  de entrada.
- Carruseles (almacenes, fotos): CSS con `@keyframes`; con movimiento reducido pasan a desplazamiento manual.

## 11. Imágenes

| Carpeta | Formato | Tamaño |
|---|---|---|
| `assets/productos/` | `.webp`, cuadrada | 640 × 640 |
| `assets/puntos-venta/` | `.webp`, cuadrada | 450–600 px |
| `assets/maestra/` | `.webp` | grande ≤ 1200 px de lado + `-mini.webp` 120 × 120 |
| `assets/personalizados/` | `.webp` | 560 px de alto |
| `assets/medios/` | `.webp`, cuadrada | 600 × 600 |

No hay un script de imágenes en el repositorio. Se convierten con cualquier editor o con Python + Pillow:

```python
from PIL import Image, ImageOps
im = ImageOps.exif_transpose(Image.open('foto.jpg')).convert('RGB')
ImageOps.fit(im, (640, 640)).save('assets/productos/alfajor.webp', quality=82)
```

Las imágenes llevan `alt` descriptivo (o `alt=""` si son decorativas) y `width`/`height` cuando el tamaño es fijo.
Las fotos de Google Maps no se copian: se piden al dueño del local.

## 12. SEO y medición

- Cada página pública tiene `<title>`, descripción, canónica y Open Graph (imagen `assets/brand/og-matichoc.jpg`).
- Datos estructurados: tienda local en la portada y lista de productos en la Tienda.
- `sitemap.xml`: actualizar `lastmod` de la página tocada. `robots.txt` excluye `pages/productos.html`. El panel y
  Mi cuenta llevan `noindex`.
- **Redirecciones del sitio antiguo:** carpetas `tienda/`, `la-maestra/`, `opiniones-o-testimonios/`,
  `politica-privacidad/`, `donde-me-encuentran/`, `productos-frecuentes/` y `productos-de-temporada/…`, cada una con
  un `index.html` de `meta refresh` + canónica a la página nueva. Si Search Console muestra otra dirección antigua con
  error, se agrega igual.
- `js/analitica.js`: GoatCounter (cuenta `matichoc`), sin cookies. No corre en localhost ni con "No rastrear", y
  cuenta los clics a WhatsApp y Tuu. Si se apaga (`CODIGO = ''`), hay que actualizar `pages/privacidad.html`.
- Detalle y pendientes: [SEO.md](SEO.md).

## 13. Cómo verificar un cambio

No hay pruebas automáticas. Checklist:

1. Servir local: `python -m http.server 8123`.
2. Abrir la página a **375 px** y en escritorio.
3. Consola sin errores.
4. Sin desborde horizontal (`document.documentElement.scrollWidth - innerWidth` debe dar `≤ 0`).
5. Imágenes cargadas (`naturalWidth > 0`).
6. Teclado: Tab llega a todo y el foco se ve.
7. Con "reducir movimiento" activado, nada se anima.
8. Si tocaste el guía: probar preguntas, recorrido, voz y Escape.

La skill `.claude/skills/matichoc-calidad` tiene la auditoría completa (rendimiento, accesibilidad, SEO técnico).
