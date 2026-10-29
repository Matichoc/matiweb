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

## Pendiente (depende del dueño)
1. **Google Search Console** (https://search.google.com/search-console): agregar la propiedad `matichoc.cl` (tipo "Dominio"), verificar con el
   registro TXT en el DNS y enviar `https://matichoc.cl/sitemap.xml`. Revisar una vez al mes: consultas, clics, páginas indexadas.
2. **Perfil de Empresa de Google** (ficha en Maps): nombre, categoría "Chocolatería", teléfono, horario, fotos, enlace a matichoc.cl, y pedir reseñas.
3. ~~Contador de visitas~~: hecho (cuenta `matichoc`). Confirmar en GoatCounter → Settings que la recolección de IP esté apagada.
4. Fotos de productos: hoy viven en imgur (23 imágenes). Conviene tenerlas en el sitio (`assets/productos/`), en JPG/WebP de ~800 px y menos de 150 KB, con el nombre del producto en el archivo.
5. Datos que solo el dueño puede confirmar para publicarlos (no se inventan): horario del stand, dirección en la ficha de Google, precios en la tienda.
6. Menciones y enlaces hacia matichoc.cl desde Instagram, Facebook, clubes y negocios que ya aparecen en el sitio.

## Cómo medir
- Search Console: búsquedas con las que aparecen, clics, posición, páginas indexadas, errores.
- GoatCounter: visitas por página, orígenes, y los eventos `clic-whatsapp…` y `clic-pago-tuu…` (clics en enlaces; los pedidos reales ya quedan en Supabase).
- Ficha de Google: vistas, llamadas, cómo llegan.
