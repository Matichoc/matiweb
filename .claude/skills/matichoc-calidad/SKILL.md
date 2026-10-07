---
name: matichoc-calidad
description: Usar para auditar o verificar rendimiento, accesibilidad, responsive y SEO técnico del sitio de Matichoc antes de dar por terminado un cambio, o cuando se pida explícitamente una auditoría de calidad/performance/accesibilidad.
---

# Calidad — Matichoc

## Cuándo usar esta skill
Antes de cerrar cualquier tarea que toque HTML/CSS/JS visible al usuario, y
siempre que se pida una auditoría de performance, accesibilidad o SEO.

## Qué revisar

- **Peso de assets**: imágenes sin comprimir (especialmente PNG usado para
  fotos, que debería ser JPEG/WebP), sin dimensiones explícitas. Ya se
  detectó que `assets/images/Familia en el mercado de MatiChoc.png` pesa
  2.9MB — cualquier imagen nueva de ese tamaño es un hallazgo a reportar, no
  a ignorar.
- **Responsive**: cargar cada página tocada a ~375px de ancho y confirmar
  que no hay overflow horizontal (`document.documentElement.scrollWidth >
  clientWidth`) ni elementos que tapen contenido interactivo (botones,
  formularios).
- **Accesibilidad básica (WCAG 2.2 AA orientativo)**: contraste de texto
  sobre fondos de imagen/color, `alt` en imágenes informativas, foco visible
  en elementos interactivos, enlaces externos con `rel="noopener noreferrer"`.
- **JS**: sin errores de consola (distinguir errores reales de los
  `ERR_TUNNEL_CONNECTION_FAILED` del sandbox al bloquear imgur — esos son
  ruido conocido del entorno de pruebas, no del sitio en producción).
- **SEO técnico básico**: cada página con `<title>`, `og:title`/`og:description`,
  sin enlaces rotos internos.
- **Objetivos orientativos de Core Web Vitals** (no hay Lighthouse CI
  configurado todavía — son metas a tener en mente, no algo medible hoy sin
  herramientas adicionales): LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1 en p75.

## Procedimiento

1. Servir el sitio localmente (`python3 -m http.server`).
2. Cargar cada página tocada con Chromium headless (Playwright ya disponible
   en el entorno), revisando consola y overflow en desktop y en 375px.
3. Si se tocó una imagen o se agregó una nueva, reportar su peso en disco.
4. Si se tocó un elemento interactivo, probar su interacción simulada (click,
   hover) y confirmar que produce el efecto esperado, no solo que no tira
   error.

## Criterios de aceptación

- Sin errores de consola reales (excluyendo el ruido conocido del sandbox).
- Sin overflow horizontal en 375px.
- Toda imagen nueva o tocada reportada con su peso; si supera ~300KB,
  marcarla como hallazgo a optimizar, no dejarla pasar en silencio.
- Enlaces externos nuevos con `target="_blank"` llevan `rel="noopener noreferrer"`.
