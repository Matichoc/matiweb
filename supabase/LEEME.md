# Cuentas Matilover — cómo encenderlas

El sitio es **abierto para todos**: se puede navegar, comprar y jugar sin cuenta. La cuenta
(**Matilover**) es opcional y se usa para **guardar el progreso**: racha, descuentos, premios y
juegos. Mientras `js/supabase-config.js` tenga la `url` vacía, las cuentas están apagadas y el
sitio funciona como siempre.

Todo lo que protege los datos está en `schema.sql` (reglas de seguridad de la base de datos),
no en el sitio. La clave `anon` que va en el sitio es pública por diseño.

## 1. Crear un proyecto NUEVO en Supabase
- Entra a https://supabase.com → **New project**. Usa un proyecto **solo para Matichoc** (no
  reutilices el de otro repositorio: los datos de los clientes no se mezclan con otros).
- Nombre: `matichoc`. **Region: South America (São Paulo)**. Pon una contraseña de base de datos
  larga y guárdala en un gestor de contraseñas.
- Activa la verificación en dos pasos en tu cuenta de Supabase.

## 2. Crear las tablas y reglas
- **SQL Editor → New query**, pega **todo** `supabase/schema.sql` y pulsa **Run**. Se puede
  repetir sin problema.
- Las reglas del programa (7 días de racha, 10 % de descuento, 10 pedidos, 30 días de vigencia
  del cupón…) están al inicio, en la función `reglas()`. **Confírmalas antes de abrir al público**;
  se cambian ahí.

## 3. Direcciones permitidas
**Authentication → URL Configuration**
- Site URL: `https://matichoc.cl`
- Redirect URLs (agrega las dos):
  - `https://matichoc.cl/pages/cuenta.html`
  - `https://matichoc.cl/pages/admin.html`

## 4. Formas de entrar
**Authentication → Providers**
- **Email**: activado (deja "Confirm email" encendido). Es la forma más simple: un enlace al correo.
- **Google**: en https://console.cloud.google.com crea unas credenciales *OAuth client ID* (tipo
  *Web application*). En "Authorized redirect URIs" pon `https://TU-PROYECTO.supabase.co/auth/v1/callback`
  y copia el *Client ID* y el *Secret* a Supabase.
- **Facebook**: en https://developers.facebook.com crea una app con *Facebook Login* y pon la misma
  dirección `.../auth/v1/callback` en "Valid OAuth Redirect URIs". Meta pide una URL de política de
  privacidad (`https://matichoc.cl/pages/privacidad.html`) y pasar la app a modo *Live*; puede tardar.
  Recomiendo partir con **correo + Google** y sumar Facebook después.

## 5. Correos (importante antes de abrir al público)
- **Authentication → Email Templates → Magic Link**: agrega al texto el código para quienes abren
  el correo en otra app: `Tu código: {{ .Token }}`. (El sitio ya tiene el campo para escribirlo.)
- El correo que trae Supabase de fábrica manda muy pocos correos por hora. Configura un correo
  propio en **Authentication → SMTP Settings** (por ejemplo Resend o Brevo) antes de lanzar.

## 6. Conectar el sitio
Copia de **Project Settings → API** estos dos datos a `js/supabase-config.js` (o mándamelos y lo hago yo):
- `url`: la *Project URL*.
- `anonKey`: la clave **anon / public**.
- `proveedores`: los botones que ya activaste, por ejemplo `['google']`.

> ⚠️ La clave **`service_role` NUNCA** va en el sitio, en el repositorio ni en un mensaje. Da
> acceso total a la base de datos.

## 7. Hacerte dueña/dueño del panel
1. Entra una vez a `https://matichoc.cl/pages/cuenta.html` con tu correo y completa el perfil.
2. En Supabase → **SQL Editor** ejecuta (con TU correo):
   ```sql
   insert into public.admins (usuario)
   select id from auth.users where email = 'tu@correo.cl';
   ```
3. Entra a `https://matichoc.cl/pages/admin.html`: te pedirá vincular una app de verificación en
   dos pasos (Google Authenticator, Authy, 1Password…). Sin ese segundo paso el servidor no entrega
   ningún dato del panel, aunque estés en la tabla `admins`.
4. Ahí validas cupones (buscas el código del cliente y lo canjeas) y marcas los pedidos como
   **entregados**; solo esos suman para el premio de pedidos.

## 8. Antes de abrir al público
- [ ] Un abogado revisa la política de privacidad y los términos con cuentas (datos personales,
      menores de 14 años, premios, borrado de cuenta). La ley nueva de datos entra en vigencia el
      1 de diciembre de 2026, según entiendo.
- [ ] Prueba completa con dos cuentas de prueba (racha, cupón, pedido, canje, borrar cuenta).
- [ ] Respaldo: el plan gratis no incluye respaldos diarios; evalúa el plan pago si los datos
      llegan a importar.
