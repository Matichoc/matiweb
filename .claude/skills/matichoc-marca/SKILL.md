---
name: matichoc-marca
description: Usar antes de cualquier cambio visual (logos, paleta, tipografías, personajes) en el sitio de Matichoc, para no romper la identidad de marca. Se activa con pedidos de rediseño, nuevos componentes visuales, cambios de color/tipografía, o uso de los personajes Matichico y Chocolatina.
---

# Protección de marca — Matichoc

## Cuándo usar esta skill
Antes de tocar `assets/brand/`, `css/styles.css` (bloque `:root` y reglas de
color/tipografía), o cualquier página cuando el pedido sea de naturaleza
visual/creativa (rediseños, nuevos componentes, efectos "wow").

## Qué proteger

- **Logos** (`assets/brand/logo-*.png`, `icon-*.png`, `favicon.ico`): nunca
  recortar, deformar, recolorear ni reemplazar sin que el dueño lo pida
  explícitamente. Está permitido optimizar el peso del archivo (compresión
  sin pérdida visible) pero no el contenido visual.
- **Paleta** (`:root` en `css/styles.css`): `--color-brown`, `--color-brown-dark`,
  `--color-green`, `--color-pink`, `--color-pink-dark`, `--color-yellow`,
  `--color-cream`. Cualquier color nuevo debe convivir con esta paleta, no
  reemplazarla.
- **Tipografías**: `Baby Chipmunk` (`--font-display`, títulos),
  `Adorable Mother Script` (`--font-script`, citas/acentos), `Segoe UI` (cuerpo).
- **Personajes**: Matichico y Chocolatina. Si no hay assets de ellos en el
  repo todavía, no inventar su apariencia — preguntar al dueño antes de
  generar o describir cómo se ven.
- **Tono**: cercano, familiar, artesanal — evitar lenguaje corporativo o
  excesivamente técnico en copy visible al usuario.

## Procedimiento

1. Antes de proponer un cambio visual, listar qué elementos de marca toca
   (logo, color, tipografía, personaje) y confirmar que ninguno se altera
   fuera de lo pedido.
2. Si el cambio requiere un asset nuevo (ícono, ilustración), usar la paleta
   y tipografías existentes; no introducir un estilo visual distinto sin
   aprobación.
3. Si el pedido implica tocar un logo o personaje directamente, detenerse y
   confirmar con el dueño antes de generar o editar el archivo.

## Criterios de aceptación

- Ningún archivo en `assets/brand/` cambia de contenido visual (solo peso/formato,
  si se optimiza).
- Los colores usados están definidos en `:root` o son variaciones justificadas
  de esos mismos tonos (no colores nuevos sin relación con la paleta).
- Las tipografías usadas son las 3 ya declaradas en `@font-face`.
