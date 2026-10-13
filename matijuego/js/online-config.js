// Conexión opcional con el servidor del ranking (Supabase). MIENTRAS ESTO ESTÉ VACÍO, el juego NO envía nada a ninguna parte.
// Para encenderlo: crea el proyecto en Supabase, ejecuta docs/ranking-supabase.sql y pega aquí la URL y la llave "anon" (pública).
// Pasos completos en docs/RANKING.md.
export const ONLINE = {
  url: "", // ej.: "https://abcdxyz.supabase.co"
  anonKey: "", // la llave "anon public" (es pública a propósito: no da acceso a nada por sí sola)
};
