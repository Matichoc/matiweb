# Cómo actualizar el contenido de matichoc.cl

Paso a paso para los cambios más comunes. Cada cambio se prueba en el computador y se publica como dice
[PUBLICAR.md](PUBLICAR.md). Para entender cómo funciona por dentro, ver [ARQUITECTURA.md](ARQUITECTURA.md).

> **Antes de empezar:** sirve el sitio con `python -m http.server 8123` y abre http://localhost:8123.
> Después de cada cambio, revisa la página en modo celular (~375 px).

---

## Productos y precios — `js/catalogo.js`

Es la **única** lista de productos: la Tienda la lee de aquí. Nunca escribas un precio a mano en una página.

**Cambiar un precio o una descripción:** busca el producto por su `nombre` y cambia `precio` (número, sin puntos
ni `$`) o `descripcion`.

**Agregar un producto:** copia un bloque parecido y cambia sus datos:

```js
{
  id: 'alfajor_maracuya',          // único, sin espacios ni tildes
  categoria: 'Alfajores',          // igual que otra existente, o una nueva (crea su chip de filtro)
  nombre: 'Alfajor de maracuyá',
  descripcion: 'Relleno de maracuyá, bañado en chocolate.',
  precio: 1200,
  img: '/assets/productos/alfajor_maracuya.webp',
  badge: 'Nuevo'                   // opcional: etiqueta destacada
},
```

**Quitar un producto:** borra su bloque completo (desde `{` hasta `},`).

**Producto sin foto todavía:** usa `img: '/assets/productos/foto-pendiente.webp'` y anótalo en
[FOTOS-PENDIENTES.md](FOTOS-PENDIENTES.md).

**Solo a pedido (sin precio, botón "Consultar"):** agrégalo a `A_PEDIDO`. Aparece en "Productos de Temporada".

**Galería de personalizados:** agrega una línea a `PERSONALIZADOS`:

```js
{ ocasion: 'Graduación', foto: 'graduacion.webp', alt: 'Caja con bombones que dicen "Felicidades"' },
```

La foto va en `assets/personalizados/` (560 px de alto) y nunca debe mostrar nombres de clientes.

## Fotos de productos — `assets/productos/`

1. La foto debe ser **cuadrada, de 640 × 640 px y en formato `.webp`**. Puedes recortarla con cualquier editor
   (por ejemplo https://squoosh.app, que también la pasa a webp).
2. Guárdala con el nombre exacto que usa el producto en `img` (tabla en
   [assets/productos/README.md](../assets/productos/README.md)).
3. Si reemplazas una foto existente con el mismo nombre, no hay que tocar `catalogo.js`. Algunos celulares pueden
   mostrar la foto antigua unos minutos después de publicar.

## Almacenes / puntos de venta — `js/puntos-venta.js`

Aparecen en el carrusel de la portada y de Contacto. Para sumar uno, agrega una línea a `PUNTOS_VENTA`:

```js
{ nombre: 'Almacén Nuevo', lugar: 'Población X, La Ligua', foto: 'assets/puntos-venta/nuevo.webp',
  mapa: 'https://maps.app.goo.gl/…', redes: [{ nombre: 'Instagram', url: 'https://instagram.com/…' }] },
```

- `lugar` se ve al tocar la tarjeta. `mapa` y `redes` son opcionales.
- `proximamente: true` muestra la etiqueta "Próximamente".
- Sin `foto`, se usa la genérica del stand con el logo.
- Foto cuadrada `.webp` (~600 px). Pídesela al dueño del local: las de Google Maps no se copian.

## La Maestra — `pages/la_maestra.html`

**Agregar una foto al carrusel:**

1. Prepara dos archivos en `assets/maestra/`: la foto (`NN-nombre.webp`, máximo 1200 px de lado) y su miniatura
   cuadrada centrada en Inés (`NN-nombre-mini.webp`, 120 × 120).
2. En la lista `.m-miniaturas`, copia un botón y cambia rutas y texto:

   ```html
   <button type="button" class="m-mini" data-foto="../assets/maestra/24-nombre.webp" data-texto="en la feria de X"
     aria-label="Ver foto 24: en la feria de X"><img src="../assets/maestra/24-nombre-mini.webp" alt="" width="120" height="120" loading="lazy" /></button>
   ```

3. El orden de los botones es el orden del carrusel. El **primero** es la foto principal. Si la cambias, cambia
   también el `src` y el `alt` de `<img id="mFoto">`.
4. Renumera los `aria-label` ("Ver foto 1", "Ver foto 2", …) y el total en el `alt` de la foto principal
   ("foto 1 de N").

**Quitar una foto:** borra su botón y renumera (paso 4).

**Reconocimientos, cursos y docencia:** son listas en las pestañas (`#panel-reconoc`, `#panel-aprende`, `#panel-hoy`).
Para que un ítem tenga foto que abra el carrusel, usa la clase `m-insignia--foto` (Reconocimientos) o `m-con-foto`
(cursos, docencia, ferias):

```html
<li class="m-con-foto"><button type="button" class="m-insignia-foto" data-ver="../assets/maestra/14-constancia-u-valparaiso.webp"
  aria-label="Ver la foto de su constancia"><img src="../assets/maestra/14-constancia-u-valparaiso-mini.webp" alt="" width="120" height="120" loading="lazy" /></button><span>Diseño de proyectos<small>Universidad de Valparaíso</small></span></li>
```

El `data-ver` debe ser **igual** al `data-foto` de esa foto en el carrusel.

**Datos destacados** (las tarjetas junto a la foto): lista `.m-datos`.

**Ferias y eventos** (`#ferias`): cuatro tarjetas (Aniversarios, Expos, Ferias y Fiestas costumbristas). Para sumar
uno, agrega un `<li>` en la tarjeta que corresponda. Usa nombres de lugares y eventos confirmados por el dueño.

**Entrevistas** (`.m-medios`): copia una tarjeta `<a class="m-medio m-medio--…">`, cambia el enlace, la portada
(`assets/medios/`, 600 × 600) y el texto. El color de la franja de cada medio está en `.m-medio--eclipse`,
`--tv` y `--radio`. Para un medio nuevo, crea su clase con otro color.

## Opiniones — `pages/opiniones.html`

Cada opinión es un bloque `.opinion-card`:

```html
<div class="opinion-card">
    <p>"Texto de la reseña tal como la escribió la persona…"</p>
    <strong>Nombre Apellido</strong>
    <small>Reseña en Google</small>
</div>
```

Solo reseñas **reales**, copiadas tal cual de Google, Instagram o WhatsApp, con permiso para mostrar el nombre.

## Historia y clubes — `pages/historia.html`

- **"Nuestro camino":** cada etapa es un `<li>` dentro de `<ol class="camino">`.
- **Clubes auspiciados:** cada club es un `<figure>` dentro de `.auspicios`, con su logo en `assets/community/`
  (cuadrado, 800 × 800). No publiques un auspicio sin confirmarlo con el dueño.

## Horario del stand, entregas y datos legales

Hoy: **stand en la plaza de La Ligua, martes y jueves, de 8:30 a 17:00.** Entregas: martes y jueves en el stand,
otro día a coordinar en el domicilio, o envío por pagar a regiones (Blue Express).

Si cambian, actualiza **todos** estos lugares:

| Dónde | Qué |
|---|---|
| `index.html` → `#plaza` y `#quienes-somos` | Horario y entregas |
| `pages/contacto.html` | Horario del stand |
| `pages/tienda.html` (aviso y ayuda del carrito) | Entregas |
| `pages/terminos.html` | Entregas y datos legales |
| `pages/privacidad.html`, `components/footer.html` | Datos legales |
| `pages/la_maestra.html#ferias` | Horario del stand |
| `js/matichico-guia.js` → temas `entregas`, `ferias`, `legal` | Respuestas del guía |
| `CLAUDE.md` → "Datos legales" | Para que el asistente lo sepa |

Revisa también el **Perfil de Empresa de Google** para que el horario coincida.

## El guía — `js/matichico-guia.js`

- **Respuestas:** lista `SABE`. Cada tema tiene `claves` (palabras sin tildes, en minúscula), `resp` (texto fijo) y
  `links` opcionales. Gana el tema cuyas claves suman más letras dentro de la pregunta.
- **Botones sugeridos:** `SUGERIDAS`.
- **Recorrido por página:** `RECORRIDOS` (`[selector, texto]`).
- Reglas: solo dice lo que el sitio ya dice. **No recomienda productos.** Ingredientes, alérgenos y salud van
  siempre a WhatsApp.
- Prueba: abre una página con `?guia=matichico`, escribe la pregunta y revisa la respuesta, el recorrido y la voz.

## Menú y títulos

- El menú está en `components/header.html`. Si lo cambias, cambia también el respaldo `<nav class="seo-fallback">`
  dentro de `<header id="header">` en **cada** página.
- El título grande de cada página sale de su `page-*.js` (`loadComponent('page-banner', …, { titulo, subtitulo })`) y
  de su respaldo `<h1 class="seo-fallback">`.

## Programa Matilover

Las reglas (7 días de racha → 10 %; 10 pedidos → 1 cuchuflí o alfajor; cupón de 30 días; no acumulables) viven en
`reglas()` de `supabase/schema.sql`. Si cambian, hay que actualizar también `pages/bases-matilover.html` y el tema
`programa` del guía. Ver [supabase/LEEME.md](../supabase/LEEME.md).

## Después de cualquier cambio

1. Actualiza el `lastmod` de la página en `sitemap.xml` (fecha de hoy, `AAAA-MM-DD`).
2. Prueba en celular y escritorio, sin errores en la consola.
3. Publica con el flujo de [PUBLICAR.md](PUBLICAR.md).
