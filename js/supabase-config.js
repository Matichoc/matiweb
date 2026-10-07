// Configuración PÚBLICA de las cuentas (Supabase). Mientras `url` esté vacía, las cuentas
// quedan apagadas y el sitio funciona exactamente como antes (racha y pedidos locales).
//
// La clave `anonKey` es pública por diseño: lo que protege los datos son las reglas (RLS) de
// supabase/schema.sql. La clave `service_role` NUNCA va en este archivo ni en el repositorio.
//
// Pasos para encenderlas: supabase/LEEME.md
window.MATICHOC_SUPABASE = {
  url: 'https://lfgfmequzmlajlvkjxlv.supabase.co',
  anonKey: 'sb_publishable_SwOahgaiJDGuKc59o2cOTQ_VyzCzn-b', // clave publicable (pública por diseño)
  proveedores: []   // botones de acceso ya activados en Supabase: 'google', 'facebook'
};
