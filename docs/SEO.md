# SEO y medición de Matichoc

Lo que está hecho, lo que falta y cómo se mide. Actualizar este archivo cuando cambie algo.

## Ya hecho en el sitio
- Cada página pública: `<title>`, descripción, canónica, Open Graph/Twitter (imagen 1200×630 `assets/brand/og-matichoc.jpg`, con el logo oficial sin deformar).
- Páginas privadas (panel, Mi cuenta, Productos) con `noindex`; `robots.txt` y `sitemap.xml` con fecha de última modificación (`lastmod`).
- **Respaldo sin JavaScript**: el menú, el título principal (`h1`) y los enlaces legales también van escritos en el HTML dentro de
  `<header id="header">`, `#page-banner`, `#banner` y `<footer id="footer">` (clase `.seo-fallback`, fuera de la vista). Al cargar los
  componentes se reemplazan; si se cambia el menú o el título de una página, **cambiar también ese respaldo**.
- Portada con texto propio ("Chocolatería artesanal de La Ligua, desde 2011") y enlaces internos con texto descriptivo.
- Datos estructurados: tienda local + sitio web (portada) y lista de productos con precio (la Tienda los arma desde `js/catalogo.js`).
- `js/analitica.js`: contador de visitas sin cookies (GoatCounter, cuenta `matichoc`), **encendido**; la política de privacidad ya lo menciona. Panel: https://matichoc.goatcounter.com

- **Direcciones del sitio antiguo** (`www.matichoc.cl/tienda`, `/la-maestra`, `/productos-de-temporada/...`, etc.): Google las seguía
  mostrando y daban error. Cada una tiene una carpeta con un `index.html` que redirige (meta refresh + canónica) a la página nueva.
  Si Search Console muestra otra dirección antigua con error, se agrega igual.
- **Search Console** verificado (propiedad de dominio `matichoc.cl`, vía Cloudflare) y `sitemap.xml` enviado.

## Pendiente (depende del dueño)
1. ~~Google Search Console~~: hecho. Revisar una vez al mes: consultas, clics, páginas indexadas (https://search.google.com/search-console).
2. **Perfil de Empresa de Google** (ficha en Maps): nombre, categoría "Chocolatería", teléfono, horario, fotos, enlace a matichoc.cl, y pedir reseñas.
3. ~~Contador de visitas~~: hecho (cuenta `matichoc`). Confirmar en GoatCounter → Settings que la recolección de IP esté apagada.
4. ~~Fotos de productos en imgur~~: hecho, la Tienda usa `assets/productos/*.webp`.
5. Datos que solo el dueño puede confirmar para publicarlos (no se inventan): dirección en la ficha de Google, precios en la tienda.
   El horario del stand ya está confirmado y publicado (plaza de La Ligua, martes y jueves, 8:30 a 17:00); falta que la ficha de
   Google diga lo mismo (hoy muestra 8:00 a 20:00 todos los días).
6. Menciones y enlaces hacia matichoc.cl desde Instagram, Facebook, clubes y negocios que ya aparecen en el sitio.

## Cómo medir
- Search Console: búsquedas con las que aparecen, clics, posición, páginas indexadas, errores.
- GoatCounter: visitas por página, orígenes, y los eventos `clic-whatsapp…` y `clic-pago-tuu…` (clics en enlaces; los pedidos reales ya quedan en Supabase).
- Ficha de Google: vistas, llamadas, cómo llegan.
