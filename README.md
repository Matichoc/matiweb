# Matichoc — Pasión por el cacao · sitio web

Sitio de **Chocolatería Matichoc** (La Ligua, Chile, desde 2011): catálogo y tienda con pedido por WhatsApp,
historia, la maestra chocolatera Inés Saavedra, opiniones, puntos de venta, ferias, el **Matijuego** y la
cuenta opcional **Matilover**.

- **En línea:** https://matichoc.cl
- **Repositorio:** https://github.com/Matichoc/matiweb
- **Tecnología:** HTML, CSS y JavaScript plano. Sin build, sin framework y sin servidor propio.
  Se publica tal cual en **GitHub Pages**, con el dominio en Cloudflare.

---

## Índice

1. [Qué tiene el sitio (uso)](#1-qué-tiene-el-sitio-uso)
2. [Cómo actualizar lo más común](#2-cómo-actualizar-lo-más-común)
3. [Probar en el computador](#3-probar-en-el-computador)
4. [Publicar un cambio](#4-publicar-un-cambio)
5. [Estructura de carpetas](#5-estructura-de-carpetas)
6. [Cómo funciona por dentro](#6-cómo-funciona-por-dentro)
7. [Servicios externos y cuentas](#7-servicios-externos-y-cuentas)
8. [Reglas que no se rompen](#8-reglas-que-no-se-rompen)
9. [Documentación detallada](#9-documentación-detallada)

---

## 1. Qué tiene el sitio (uso)

| Página | Dirección | Qué hace el visitante |
|---|---|---|
| **Inicio** | `/` | Bienvenida, racha de visitas, quiénes somos, horario del stand en la plaza (martes y jueves, 8:30 a 17:00), carrusel de almacenes donde se vende Matichoc. |
| **Tienda** | `/pages/tienda.html` | Busca y filtra productos, los agrega a "Ver pedido" y lo envía por **WhatsApp**. Puede pagar con tarjeta en **Tuu** (enlace fijo; el total queda copiado para pegarlo). Galería de personalizados y productos a pedido (frutillas). |
| **Historia** | `/pages/historia.html` | "Nuestro camino" desde 2011 y clubes deportivos que auspiciamos. |
| **La Maestra** | `/pages/la_maestra.html` | Inés Saavedra: carrusel de fotos, reconocimientos, cursos, docencia, ferias y eventos de la provincia, y entrevistas en medios. |
| **Opiniones** | `/pages/opiniones.html` | Reseñas reales de clientes (5.0 en Google). |
| **Contacto** | `/pages/contacto.html` | Teléfono, correo, horario del stand, formulario que arma un mensaje de WhatsApp y puntos de venta. |
| **Matijuego** | `/matijuego/` | Arcade de Matichoc (se genera desde otro repositorio, ver §6.8). |
| **Mi cuenta** | `/pages/cuenta.html` | Cuenta Matilover (desde 14 años): racha verificada, cupones y premios. |
| **Panel del dueño** | `/pages/admin.html` | Solo administradores, con verificación en dos pasos: validar cupones, revisar pedidos, ver Matilovers. |
| Términos, Privacidad, Bases Matilover | `/pages/terminos.html`, `/pages/privacidad.html`, `/pages/bases-matilover.html` | Textos legales. |

**El guía (Matichico / Chocolatina):** mascota que aparece en Inicio, Tienda, Historia, La Maestra y Contacto.
Un día sale Matichico y al siguiente Chocolatina. Responde preguntas frecuentes con un **guion cerrado** (no es IA),
hace un recorrido por la página y puede leer en voz alta (voz del navegador, apagada por defecto).
Para probar uno en particular: `?guia=matichico` o `?guia=chocolatina` al final de la dirección.

**Comprar no requiere cuenta.** El pedido real siempre se cierra por WhatsApp; "Ya pagué" no confirma un pago:
el dueño lo confirma en Tuu.

---

## 2. Cómo actualizar lo más común

Guía paso a paso, con ejemplos: **[docs/COMO-ACTUALIZAR.md](docs/COMO-ACTUALIZAR.md)**. Resumen:

| Quiero cambiar… | Dónde |
|---|---|
| Precio, nombre, descripción o foto de un producto | `js/catalogo.js` (única fuente del catálogo) + foto en `assets/productos/` |
| Personalizados (galería) o productos solo a pedido | `js/catalogo.js` → `PERSONALIZADOS` y `A_PEDIDO` |
| Almacenes / puntos de venta | `js/puntos-venta.js` + foto en `assets/puntos-venta/` |
| Fotos, cursos, reconocimientos o ferias de Inés | `pages/la_maestra.html` + fotos en `assets/maestra/` |
| Entrevistas en medios | `pages/la_maestra.html` (sección `.m-medios`) + portada en `assets/medios/` |
| Opiniones de clientes | `pages/opiniones.html` |
| Historia y clubes auspiciados | `pages/historia.html` + logos en `assets/community/` |
| Horario del stand, entregas, datos legales | Portada (`#plaza`), Contacto, Términos, Tienda y el guía (`js/matichico-guia.js`). Ver §8. |
| Respuestas del guía | `js/matichico-guia.js` → lista `SABE` |
| Menú del sitio | `components/header.html` **y** el respaldo `.seo-fallback` de cada página |

Fotos que todavía faltan: [docs/FOTOS-PENDIENTES.md](docs/FOTOS-PENDIENTES.md).

---

## 3. Probar en el computador

Necesitas Python (cualquier versión 3). Desde la carpeta del proyecto:

```bash
python -m http.server 8123
```

Abre http://localhost:8123. **No sirve abrir el `.html` con doble clic**: el encabezado, el pie y el catálogo se
cargan con `fetch`, que el navegador bloquea en archivos locales.

No hay compilación, lint ni pruebas automáticas. "Verificar" significa:

1. Abrir las páginas tocadas en un celular o en el modo celular del navegador (**ancho ~375 px**).
2. Revisar que no haya errores en la consola (F12 → Consola).
3. Revisar que la página no se desborde hacia el lado (nada de barra de desplazamiento horizontal).
4. Si hay animaciones nuevas, probar con "reducir movimiento" activado en el sistema.

---

## 4. Publicar un cambio

Detalle completo, verificación y cómo deshacer: **[docs/PUBLICAR.md](docs/PUBLICAR.md)**. En corto:

1. Crear una rama (`git switch -c nombre-del-cambio`), hacer el cambio y probarlo (§3).
2. Commit en español, explicando qué cambió y cómo revertirlo.
3. Subir la rama y abrir un Pull Request en GitHub.
4. **Con la aprobación del dueño**, fusionar a `main`. GitHub Pages publica solo en 1–3 minutos.
5. Revisar en https://matichoc.cl que el cambio esté en vivo.

Nunca se sube directo a `main`.

---

## 5. Estructura de carpetas

```
index.html              Portada
404.html                Página de error
pages/                  Una página por sección (tienda, historia, la_maestra, contacto, opiniones, cuenta, admin, legales)
components/             header, footer, banner (portada) y page-banner (resto): se insertan con JavaScript
css/
  styles.css            Hoja global (tiene bloques antiguos sin uso: no asumir que todo se usa)
  chocolate-wow.css     Banner, fondos y brillos animados
  tienda.css            Tienda y carrito
  cuenta.css            Mi cuenta y panel del dueño
  matichico-guia.css    El guía
js/
  base.js               loadComponent() y menú del celular (lo cargan todas las páginas)
  page-*.js             Script propio de cada página (sin JavaScript dentro del HTML, por seguridad)
  catalogo.js           Catálogo, personalizados y productos a pedido (fuente única)
  tienda.js             Tienda y carrito
  puntos-venta.js       Almacenes (fuente única) y su carrusel
  matichico-guia.js     El guía: guion, recorridos, voz
  cuenta.js             Cuentas Matilover (Supabase)
  supabase-config.js    Dirección y clave pública de Supabase
  racha.js              Racha de visitas y contador de pedidos
  analitica.js          Contador de visitas sin cookies (GoatCounter)
  brillos.js, revelar.js  Efectos visuales (respetan "reducir movimiento")
  vendor/supabase.js    Librería oficial de Supabase (copiada, licencia MIT)
assets/
  brand/                Logos oficiales, favicon e imagen para compartir (NO modificar)
  productos/            Fotos de la tienda (cuadradas, 640 px, .webp)
  personalizados/       Galería de personalizados
  puntos-venta/         Fotos de los almacenes
  maestra/              Carrusel de La Maestra (foto grande ≤1200 px + miniatura 120 px)
  medios/               Portadas de entrevistas
  community/            Clubes auspiciados
  personajes/           Matichico y Chocolatina
  fonts/                Tipografías de marca
  images/               Fotos antiguas sin procesar (la mayoría sin uso)
supabase/               Base de datos de las cuentas (SQL) y su guía LEEME.md
matijuego/              Copia GENERADA del juego: no editar aquí (ver §6.8)
docs/                   Documentación (ver §9)
tienda/, la-maestra/, productos-de-temporada/, …   Redirecciones de direcciones del sitio antiguo
sitemap.xml, robots.txt Para buscadores
CNAME, .nojekyll        Dominio de GitHub Pages y publicación sin Jekyll
CLAUDE.md               Reglas del proyecto para el asistente de IA
.claude/skills/         Guías de calidad, marca, seguridad y efectos para el asistente
```

---

## 6. Cómo funciona por dentro

Detalle técnico completo: **[docs/ARQUITECTURA.md](docs/ARQUITECTURA.md)**. Lo esencial:

1. **Páginas y componentes.** Cada página es un HTML propio. El encabezado, el pie y los banners se insertan con
   `loadComponent(id, ruta, variables)` de `js/base.js` (`fetch` + reemplazo de `{{base}}` para las rutas relativas).
   Cada página también trae escrito un **respaldo** del menú, el título y los enlaces legales (`.seo-fallback`) para
   buscadores y para quien no tiene JavaScript.
2. **Sin JavaScript dentro del HTML.** Cada página declara una política de seguridad (`Content-Security-Policy`) que
   solo permite scripts propios; por eso cada página tiene su `js/page-*.js`. Las imágenes externas solo se permiten
   desde `i.imgur.com` y GoatCounter: una imagen de otro sitio no se verá. Guarda las fotos en `assets/`.
3. **Fuentes únicas.** Catálogo → `js/catalogo.js`. Almacenes → `js/puntos-venta.js`. Nunca se copian a mano en
   una página.
4. **Tienda y pago.** El carrito vive en memoria (se borra al cerrar la página). El pedido se envía por WhatsApp
   con mensaje armado. "Pagar online con Tuu" abre un enlace fijo de Tuu y copia el total. **WhatsApp y Tuu no están
   conectados entre sí.** Si las cuentas están activas, antes de enviar se piden nombre y celular y el pedido se anota
   en Supabase (estado "Interesado" → …) con aviso por Telegram al dueño. Si eso falla, la compra sigue igual.
5. **Cuentas Matilover.** Opcionales, desde 14 años. Con `js/supabase-config.js` lleno están encendidas (lo están hoy).
   Toda la lógica que importa (racha, cupones, pedidos) se valida en la base de datos (`supabase/*.sql`).
6. **El guía.** Guion cerrado de palabras clave → respuestas fijas, sin IA ni servidor. No recomienda productos
   (Ley 20.606). Ingredientes, alérgenos y salud los deriva a WhatsApp. Solo guarda en `sessionStorage` si ya saludó
   o si lo despidieron.
7. **Medición.** GoatCounter sin cookies (`js/analitica.js`), declarado en la política de privacidad.
8. **Matijuego.** Su código vive en el repositorio `Matichoc/MAtigame_v0`. Se publica aquí con
   `MATIJUEGO_DEMO=1 node scripts/deploy-matiweb.mjs <ruta-a-matiweb>` desde ese repositorio. Lo que se edite a mano en
   `matijuego/` se pierde en el siguiente despliegue.

---

## 7. Servicios externos y cuentas

| Servicio | Para qué | Dónde se administra |
|---|---|---|
| GitHub (organización `Matichoc`) | Código y publicación (GitHub Pages) | https://github.com/Matichoc/matiweb |
| Cloudflare | Dominio `matichoc.cl` (DNS) | Panel de Cloudflare |
| Supabase | Cuentas Matilover y pedidos web | Proyecto `matichoc` (São Paulo). Guía: [supabase/LEEME.md](supabase/LEEME.md) |
| Tuu | Pago con tarjeta (enlace fijo `https://www.tuu.cl/matichoc_pago`) | Panel de Tuu |
| WhatsApp | Pedidos y consultas: +56 9 7564 5591 | Celular del negocio |
| Telegram | Aviso al dueño de pedidos web (token solo en Supabase, nunca en el código) | Bot del dueño |
| GoatCounter | Visitas sin cookies | https://matichoc.goatcounter.com |
| Google Search Console | Cómo aparece el sitio en Google | Propiedad de dominio `matichoc.cl` |
| Perfil de Empresa de Google | Ficha en Maps y reseñas | Cuenta Google del negocio |

Claves: la clave `anon`/publicable de Supabase es pública por diseño. **Nunca** se sube al repositorio la clave
`service_role`, el token de Telegram ni contraseñas.

---

## 8. Reglas que no se rompen

- **Logos** (`assets/brand/`): no se modifican ni se deforman.
- **Un solo catálogo** (`js/catalogo.js`) y una sola lista de almacenes (`js/puntos-venta.js`).
- **Proceso de pago** (Tuu/WhatsApp): no se cambia sin revisión del dueño.
- **Datos del negocio** (precios, horarios, lugares, datos legales, auspicios): no se inventan; se confirman con el dueño.
  Datos legales vigentes: Chocolatería Matichoc Inés Saavedra EIRL · RUT 77.877.372-4 · resolución sanitaria
  N° 2505129791. El domicilio no se publica en el pie.
- **Ley 20.606:** los personajes (guía, juego) no promocionan alimentos. En el Matijuego, los enlaces a la tienda son
  discretos a propósito.
- **Celular primero:** todo cambio visual se prueba a ~375 px. Las animaciones respetan `prefers-reduced-motion`.
- **Si cambia algo que aparece en varios lugares,** se cambia en todos. Por ejemplo: el horario o las entregas
  (portada, Contacto, Tienda, Términos, guía), las reglas del programa (`reglas()` en SQL, `bases-matilover.html`, guía)
  o el menú (`components/header.html` + `.seo-fallback`).
- Al cambiar una página pública, actualizar su `lastmod` en `sitemap.xml`.
- **Nada se publica sin aprobación del dueño.**

---

## 9. Documentación detallada

| Archivo | Contenido |
|---|---|
| [docs/COMO-ACTUALIZAR.md](docs/COMO-ACTUALIZAR.md) | Paso a paso para productos, fotos, almacenes, La Maestra, opiniones, guía y horarios |
| [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) | Técnico: páginas, scripts por página, componentes, seguridad, datos, cuentas, guía, juego |
| [docs/PUBLICAR.md](docs/PUBLICAR.md) | Flujo de rama → PR → publicación, verificación en vivo y cómo deshacer |
| [docs/SEO.md](docs/SEO.md) | Buscadores, Search Console, medición y pendientes |
| [docs/FOTOS-PENDIENTES.md](docs/FOTOS-PENDIENTES.md) | Fotos que faltan y dónde van |
| [supabase/LEEME.md](supabase/LEEME.md) | Encender y administrar las cuentas Matilover |
| [assets/productos/README.md](assets/productos/README.md) | Nombres de archivo de las fotos de productos |
| [assets/personajes/README.md](assets/personajes/README.md) | Imágenes de Matichico y Chocolatina |
| [CLAUDE.md](CLAUDE.md) | Reglas del proyecto para el asistente de IA |
