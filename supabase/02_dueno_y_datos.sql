-- ============================================================================
-- Matichoc: paso 2 — dueño automático, datos de los Matilovers y novedades (opt-in)
--
-- Cómo usarlo: Supabase → SQL Editor → pegar TODO este archivo → Run.
-- Ejecútalo DESPUÉS de schema.sql. Se puede ejecutar de nuevo sin problema.
--
-- Los correos de quienes administran NO van en este archivo ni en el repositorio: se agregan
-- aparte, en el SQL Editor (ver supabase/LEEME.md, "Hacerte dueño").
-- ============================================================================

-- ---------- Quién administra (por correo) ----------
create table if not exists public.admin_correos (
  correo text primary key check (correo = lower(correo))
);
alter table public.admin_correos enable row level security;  -- sin políticas: nadie la lee desde el navegador
revoke all on public.admin_correos from anon, authenticated;

-- Cuando alguien con un correo de esa lista CONFIRMA su correo (entra con el enlace), pasa a
-- ser administrador. Igual necesita verificación en dos pasos (aal2) para usar el panel.
create or replace function public.hacer_admin_por_correo()
returns trigger
as $$
begin
  if new.email_confirmed_at is not null
     and exists (select 1 from public.admin_correos where correo = lower(new.email)) then
    insert into public.admins (usuario) values (new.id) on conflict do nothing;
  end if;
  return new;
end $$
language plpgsql security definer set search_path = public;

drop trigger if exists hacer_admin_al_confirmar on auth.users;
create trigger hacer_admin_al_confirmar
  after insert or update of email_confirmed_at, email on auth.users
  for each row execute function public.hacer_admin_por_correo();

-- Si el correo ya tenía cuenta confirmada antes de agregarlo a la lista, se aplica con:
--   select public.aplicar_admin_correos();   (desde el SQL Editor)
create or replace function public.aplicar_admin_correos()
returns integer
as $$
declare v_n integer;
begin
  insert into public.admins (usuario)
  select u.id from auth.users u
   where u.email_confirmed_at is not null
     and exists (select 1 from public.admin_correos c where c.correo = lower(u.email))
  on conflict do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end $$
language plpgsql security definer set search_path = public;
revoke execute on function public.aplicar_admin_correos() from public, anon, authenticated;

-- ---------- Novedades y promociones: solo con permiso explícito ----------
alter table public.perfiles add column if not exists acepto_novedades boolean not null default false;
alter table public.perfiles add column if not exists novedades_en timestamptz;

drop function if exists public.declarar_perfil(text, text);
create or replace function public.declarar_perfil(p_edad text, p_apodo text default null, p_novedades boolean default null)
returns void
as $$
declare v_apodo text := nullif(trim(coalesce(p_apodo, '')), '');
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión' using errcode = '28000'; end if;
  if p_edad not in ('14_o_mas', 'menor_con_permiso') then
    raise exception 'Edad no válida' using errcode = 'P0001';
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

-- Cambiar de opinión en cualquier momento (desde "Mi cuenta").
create or replace function public.cambiar_novedades(p_valor boolean)
returns void
as $$
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión' using errcode = '28000'; end if;
  update public.perfiles set acepto_novedades = coalesce(p_valor, false), novedades_en = now()
   where id = auth.uid();
end $$
language plpgsql security definer set search_path = public;

-- ---------- Panel: los Matilovers registrados ----------
-- El correo completo solo se ve de quienes aceptaron recibir novedades; del resto, enmascarado.
create or replace function public.admin_matilovers()
returns jsonb
as $$
begin
  if not public.es_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  return jsonb_build_object(
    'total', (select count(*) from public.perfiles),
    'con_perfil', (select count(*) from public.perfiles where acepto_terminos_en is not null),
    'con_novedades', (select count(*) from public.perfiles where acepto_novedades),
    'lista', coalesce((
      select jsonb_agg(jsonb_build_object(
               'apodo', p.apodo,
               'correo', case when p.acepto_novedades then u.email
                              when u.email is null then null
                              else left(u.email, 2) || '***@' || split_part(u.email, '@', 2) end,
               'novedades', p.acepto_novedades,
               'edad', p.declaracion_edad,
               'registrado', p.creado_en,
               'ultima_visita', (select max(v.dia) from public.visitas v where v.usuario = p.id),
               'visitas', (select count(*) from public.visitas v where v.usuario = p.id),
               'pedidos_entregados', (select count(*) from public.pedidos o where o.usuario = p.id and o.estado = 'entregado')
             ) order by p.creado_en desc)
      from (select * from public.perfiles order by creado_en desc limit 1000) p
      join auth.users u on u.id = p.id), '[]'::jsonb));
end $$
language plpgsql stable security definer set search_path = public;

-- ---------- Permisos ----------
revoke execute on function public.declarar_perfil(text, text, boolean), public.cambiar_novedades(boolean),
  public.admin_matilovers(), public.hacer_admin_por_correo() from public, anon, authenticated;
grant execute on function public.declarar_perfil(text, text, boolean), public.cambiar_novedades(boolean),
  public.admin_matilovers() to authenticated;
