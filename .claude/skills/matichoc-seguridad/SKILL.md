---
name: matichoc-seguridad
description: Usar al revisar seguridad del sitio de Matichoc (formularios, enlaces externos, datos de clientes, integración de pago Tuu) o cuando se pida explícitamente una auditoría de seguridad. El sitio es estático sin backend — esta skill no asume ni propone infraestructura que no existe.
---

# Seguridad — Matichoc

## Cuándo usar esta skill
Al tocar formularios, enlaces a servicios externos (WhatsApp, Tuu), o cuando
se pida una auditoría de seguridad.

## Contexto que no hay que olvidar

Sitio 100% estático, sin backend, sin base de datos, sin API keys ni
variables de entorno (confirmado por búsqueda en todo el repo). Esto
significa que gran parte de un checklist OWASP genérico **no aplica**:
no hay inyección SQL, no hay autenticación, no hay validación de esquemas
de servidor porque no hay servidor. No inventar riesgos de backend que no
existen, y no proponer crear uno "por si acaso" — solo si hay una necesidad
de negocio concreta (ej. reconciliar pagos Tuu con pedidos).

## Qué sí revisar

- **`innerHTML` con datos externos**: hoy todos los usos (`productos.html`,
  `tienda.html`) construyen HTML a partir de `js/catalogo.js`, que es
  contenido interno controlado por el negocio, no input de usuario — no es
  explotable hoy. Si algún día un formulario empieza a escribir en el DOM
  con los datos que el usuario tipeó, eso sí sería un vector real de XSS a
  revisar con cuidado (usar `textContent` o sanitizar).
- **Formularios** (Contacto, Opiniones): hoy no tienen `action` ni handler,
  o sea no envían nada a ningún lado — no hay riesgo de exfiltración, pero
  tampoco funcionan. Si se conectan a un servicio (mailto, Formspree, etc.),
  revisar que no se exponga ninguna credencial en el cliente.
- **Pago Tuu**: el botón "Finalizar compra" abre un link fijo a Tuu sin
  pasar el monto ni un identificador de pedido. Nunca dar por hecho ni
  comunicar al usuario que un pago quedó "confirmado" sin verificación real
  — hoy no existe ningún mecanismo que confirme que el pago se hizo.
- **Enlaces externos** con `target="_blank"`: deben llevar
  `rel="noopener noreferrer"` para evitar que la pestaña abierta pueda
  manipular `window.opener`.
- **Datos personales**: lo que se recopila vía WhatsApp o formularios está
  descrito en `pages/privacidad.html` — cualquier cambio a qué datos se
  piden o cómo se usan debe reflejarse ahí también.
- **Secretos**: antes de cualquier commit, grep de
  `api[_-]?key|secret|supabase|process\.env|sk_live|AIza` sobre los archivos
  tocados — este repo no debería tener ninguno nunca.

## Procedimiento

1. Si el cambio toca un formulario o un flujo de datos del usuario,
   confirmar a dónde van esos datos realmente (no asumir que "se envían").
2. Si el cambio toca el flujo de pago/pedido, no afirmar garantías que el
   código no cumple.
3. Grep de secretos sobre los archivos tocados antes de commitear.
4. Reportar hallazgos con severidad, evidencia (archivo:línea) y una
   solución concreta — no solo "esto es inseguro".

## Criterios de aceptación

- Ningún hallazgo de seguridad se reporta sin evidencia concreta (archivo y
  línea, o comando que lo confirma).
- Ninguna afirmación sobre backend/API/validación de esquemas que no exista
  realmente en el código.
- Enlaces externos nuevos llevan `rel="noopener noreferrer"`.
