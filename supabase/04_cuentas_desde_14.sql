-- ============================================================================
-- Matichoc: paso 4 — cuentas Matilover solo desde los 14 años
--
-- Cómo usarlo: Supabase → SQL Editor → pegar TODO este archivo → Run (después de 03_...sql).
-- Se puede ejecutar de nuevo sin problema.
--
-- Qué hace: ya no se aceptan cuentas de menores de 14 años. Quien antes eligió "menor con permiso"
-- deja de tener el perfil completo (no puede juntar racha, cupones ni pedidos) hasta confirmar que
-- tiene 14 años o más; si de verdad es menor, no puede confirmarlo y su cuenta se puede borrar.
-- ============================================================================

create or replace function public.perfil_listo()
returns boolean
as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and declaracion_edad = '14_o_mas' and acepto_terminos_en is not null
  )
$$
language sql stable security definer set search_path = public;

create or replace function public.declarar_perfil(p_edad text, p_apodo text default null, p_novedades boolean default null)
returns void
as $$
declare v_apodo text := nullif(trim(coalesce(p_apodo, '')), '');
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión' using errcode = '28000'; end if;
  if p_edad is distinct from '14_o_mas' then
    raise exception 'Las cuentas son desde los 14 años' using errcode = 'P0001';
  end if;
  if v_apodo is not null and char_length(v_apodo) > 24 then
    raise exception 'El apodo puede tener hasta 24 letras' using errcode = 'P0001';
  end if;
  update public.perfiles
     set declaracion_edad = p_edad,
         acepto_terminos_en = coalesce(acepto_terminos_en, now()),
         apodo = coalesce(v_apodo, apodo),
         acepto_novedades = coalesce(p_novedades, acepto_novedades),
         novedades_en = case when p_novedades is null then novedades_en else now() end
   where id = auth.uid();
end $$
language plpgsql security definer set search_path = public;

-- Para ver si hay cuentas que declararon ser menores (solo informativo; no borra nada):
--   select count(*) from public.perfiles where declaracion_edad = 'menor_con_permiso';
