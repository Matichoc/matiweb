---
name: matichoc-wow
description: Usar al diseñar o implementar experiencias visuales/interactivas memorables ("efecto wow") en el sitio de Matichoc — animaciones de chocolate, partículas, transiciones de scroll, productos 3D, etc. Se activa con pedidos de "hacer la web más impresionante/memorable/inmersiva" o de animaciones/microinteracciones nuevas.
---

# Experiencias "wow" — Matichoc

## Cuándo usar esta skill
Cualquier pedido de animación, microinteracción, efecto de scroll, partículas,
o experiencia visual nueva en el Hero o en páginas de producto.

## Principios (no negociables)

1. **Proponer antes de implementar.** Para cualquier efecto nuevo (no una
   mejora menor de uno existente), presentar: concepto, tecnología, archivos
   afectados, impacto en rendimiento, comportamiento mobile, alternativa de
   movimiento reducido, complejidad y riesgos — y esperar aprobación antes
   de escribir código, salvo que el dueño ya haya aprobado explícitamente
   esa propuesta puntual.
2. **Sin dependencias pesadas sin justificar.** Este sitio no tiene build
   step ni bundler: cualquier librería (GSAP, Three.js, etc.) se carga
   completa vía CDN, sin tree-shaking. Preferir CSS/SVG/Canvas 2D vanilla;
   justificar explícitamente si se propone una librería externa.
3. **`prefers-reduced-motion: reduce` siempre.** Todo efecto con `animation`
   o `transition` continua debe tener una rama `@media` que lo desactive o
   lo deje en su estado final estático.
4. **Mobile probado, no asumido.** Verificar en viewport ~375px (headless o
   capturas) antes de dar el efecto por terminado: que no tape contenido,
   que no cause overflow horizontal, que no dependa de hover (los celulares
   no tienen hover).
5. **60fps o no se activa por defecto.** Si un efecto es costoso (canvas con
   muchas partículas, filtros SVG grandes), limitar su alcance en mobile
   (menos elementos, blur menor) en vez de desactivarlo del todo, salvo que
   la medición muestre que ni así es viable.
6. **Lazy por diseño.** Si el efecto no es parte del contenido above-the-fold
   esencial, que no bloquee el FCP — en este sitio, cualquier cosa dentro de
   un componente cargado por `loadComponent` ya cumple esto gratis porque se
   inyecta después del parseo inicial.

## Procedimiento

1. Diseñar el efecto en papel/texto primero (concepto + tecnología + riesgos).
2. Implementar en una rama, aislado en su propio archivo CSS/JS cuando sea
   posible (ver `css/chocolate-wow.css` como precedente).
3. Probar: desktop, mobile (375px), hover/focus si aplica,
   `prefers-reduced-motion: reduce` emulado, consola sin errores, sin
   overflow horizontal.
4. Mostrar evidencia (capturas o resultados de prueba headless) antes de
   pedir aprobación para integrar.

## Criterios de aceptación

- Cero errores de consola en las páginas tocadas.
- Cero overflow horizontal en viewport 375px.
- El efecto tiene una rama `@media (prefers-reduced-motion: reduce)` que lo
  neutraliza.
- No se agregó ninguna dependencia externa sin que quede documentada la
  razón en el commit/PR.
