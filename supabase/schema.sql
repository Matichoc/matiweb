-- ============================================================================
-- Matichoc: cuentas, racha verificada, cupones y pedidos (Supabase / Postgres)
--
-- Cómo usarlo: Supabase → SQL Editor → pegar TODO este archivo → Run.
-- Se puede ejecutar de nuevo sin problema (usa "if not exists" / "or replace").
--
-- Seguridad: todas las tablas tienen RLS activo. El navegador NO escribe directo en
-- visitas, cupones ni pedidos: solo puede llamar a las funciones de abajo, que validan
-- todo en el servidor (por eso la racha y los premios no se pueden falsificar).
-- El panel del dueño exige estar en la tabla `admins` Y haber entrado con verificación
-- en dos pasos (aal2). La clave `anon` que va en el sitio es pública por diseño; la clave
-- `service_role` NO debe salir nunca de tu cuenta de Supabase.
-- ============================================================================

-- ---------- Reglas del programa (un solo lugar; confirmar con el dueño) ----------
create or replace function public.reglas()
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'racha_meta',        7,                              -- días seguidos para el descuento
    'racha_premio',      '10% de descuento',
    'pedidos_meta',      10,                             -- pedidos entregados para el premio
    'pedidos_premio',    '1 cuchuflí o alfajor gratis',
    'vigencia_dias',     30,                             -- días de validez de cada cupón
    'pedidos_max_dia',   20                              -- tope de pedidos "solicitados" por día
  )
$$;

-- ---------- Tablas ----------
create table if not exists public.perfiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  apodo              text not null default 'Matilover' check (char_length(apodo) between 1 and 24),
  declaracion_edad   text check (declaracion_edad in ('14_o_mas', 'menor_con_permiso')),
  acepto_terminos_en timestamptz,
  creado_en          timestamptz not null default now()
);

create table if not exists public.visitas (
  usuario uuid not null references auth.users(id) on delete cascade,
  dia     date not null,
  primary key (usuario, dia)
);

create table if not exists public.pedidos (
  id           bigint generated always as identity primary key,
  usuario      uuid not null references auth.users(id) on delete cascade,
  creado_en    timestamptz not null default now(),
  total        integer not null check (total >= 0 and total <= 10000000),
  resumen      text check (char_length(resumen) <= 500),
  estado       text not null default 'solicitado' check (estado in ('solicitado', 'entregado', 'cancelado')),
  entregado_en timestamptz,
  atendido_por uuid references auth.users(id) on delete set null
);
create index if not exists pedidos_usuario_idx on public.pedidos (usuario, estado);

create table if not exists public.cupones (
  id           bigint generated always as identity primary key,
  usuario      uuid not null references auth.users(id) on delete cascade,
  tipo         text not null check (tipo in ('racha', 'pedidos')),
  codigo       text not null unique,
  descripcion  text not null,
  creado_en    timestamptz not null default now(),
  vence_en     timestamptz not null,
  canjeado_en  timestamptz,
  canjeado_por uuid references auth.users(id) on delete set null
);
create index if not exists cupones_usuario_idx on public.cupones (usuario, tipo, creado_en);

-- Progreso de los juegos: un registro por Matilover (solo con cuenta; sin cuenta no se guarda).
create table if not exists public.juego_progreso (
  usuario        uuid primary key references auth.users(id) on delete cascade,
  datos          jsonb not null check (pg_column_size(datos) <= 200000),
  actualizado_en timestamptz not null default now()
);

create table if not exists public.admins (
  usuario uuid primary key references auth.users(id) on delete cascade
);

alter table public.perfiles enable row level security;
alter table public.visitas  enable row level security;
alter table public.pedidos  enable row level security;
alter table public.cupones  enable row level security;
alter table public.juego_progreso enable row level security;
alter table public.admins   enable row level security;   -- sin políticas: nadie la lee desde el navegador

-- ---------- Ayudantes ----------
create or replace function public.hoy_cl()
returns date language sql stable as $$
  select (now() at time zone 'America/Santiago')::date
$$;

-- ¿Es el dueño (o quien administra) y entró con verificación en dos pasos?
create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where usuario = auth.uid())
     and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
$$;

-- Perfil completo: ya declaró su edad y aceptó los términos.
create or replace function public.perfil_listo()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and declaracion_edad is not null and acepto_terminos_en is not null
  )
$$;

create or replace function public.exigir_perfil_listo()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión' using errcode = '28000';
  end if;
  if not public.perfil_listo() then
    raise exception 'Primero confirma tu edad y acepta los términos' using errcode = 'P0001';
  end if;
end $$;

-- Racha de días seguidos del ciclo actual: cuenta solo los días POSTERIORES al último
-- descuento por racha reclamado, así cada descuento exige una racha nueva.
create or replace function public.racha_ciclo(p_usuario uuid)
returns integer language plpgsql stable security definer set search_path = public as $$
declare
  v_desde date;
  v_dia   date := public.hoy_cl();
  v_n     integer := 0;
begin
  select (max(creado_en) at time zone 'America/Santiago')::date into v_desde
  from public.cupones where usuario = p_usuario and tipo = 'racha';

  -- si hoy todavía no visitó, la racha sigue viva contando desde ayer
  if not exists (select 1 from public.visitas where usuario = p_usuario and dia = v_dia) then
    v_dia := v_dia - 1;
  end if;

  while v_n < 3650
        and (v_desde is null or v_dia > v_desde)
        and exists (select 1 from public.visitas where usuario = p_usuario and dia = v_dia) loop
    v_n := v_n + 1;
    v_dia := v_dia - 1;
  end loop;
  return v_n;
end $$;

create or replace function public.codigo_cupon()
returns text language plpgsql volatile as $$
declare v text;
begin
  loop
    v := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (select 1 from public.cupones where codigo = v);
  end loop;
  return v;
end $$;

-- ---------- Alta del perfil al crear la cuenta ----------
create or replace function public.crear_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (id, apodo)
  values (
    new.id,
    left(coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Matilover'), 24)
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists crear_perfil_al_registrarse on auth.users;
create trigger crear_perfil_al_registrarse
  after insert on auth.users
  for each row execute function public.crear_perfil();

-- ---------- Funciones para clientes (el navegador solo puede llamar a estas) ----------

-- Confirma edad y términos (obligatorio antes de usar racha, cupones o pedidos).
create or replace function public.declarar_perfil(p_edad text, p_apodo text default null)
returns void language plpgsql security definer set search_path = public as $$
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
         apodo = coalesce(v_apodo, apodo)
   where id = auth.uid();
end $$;

-- Cuenta la visita de hoy (una por día, con la fecha del servidor) y devuelve la racha.
create or replace function public.registrar_visita()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public.exigir_perfil_listo();
  insert into public.visitas (usuario, dia) values (auth.uid(), public.hoy_cl())
  on conflict do nothing;
  return jsonb_build_object('racha', public.racha_ciclo(auth.uid()), 'hoy', public.hoy_cl());
end $$;

-- Todo lo que necesita la página "Mi cuenta" en una sola llamada.
create or replace function public.mi_resumen()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_reglas jsonb := public.reglas();
  v_desde  timestamptz;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión' using errcode = '28000'; end if;
  select max(creado_en) into v_desde from public.cupones where usuario = auth.uid() and tipo = 'pedidos';
  return jsonb_build_object(
    'reglas', v_reglas,
    'perfil', (select to_jsonb(p) - 'id' from public.perfiles p where p.id = auth.uid()),
    'perfil_listo', public.perfil_listo(),
    'racha', public.racha_ciclo(auth.uid()),
    'pedidos_entregados', (
      select count(*) from public.pedidos
      where usuario = auth.uid() and estado = 'entregado'
        and (v_desde is null or entregado_en > v_desde)),
    'cupones', coalesce((
      select jsonb_agg(jsonb_build_object(
               'codigo', c.codigo, 'tipo', c.tipo, 'descripcion', c.descripcion,
               'creado_en', c.creado_en, 'vence_en', c.vence_en, 'canjeado_en', c.canjeado_en,
               'estado', case when c.canjeado_en is not null then 'canjeado'
                              when c.vence_en < now() then 'vencido' else 'vigente' end)
             order by c.creado_en desc)
      from public.cupones c where c.usuario = auth.uid()), '[]'::jsonb),
    'pedidos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', o.id, 'creado_en', o.creado_en, 'total', o.total, 'estado', o.estado)
             order by o.creado_en desc)
      from (select * from public.pedidos where usuario = auth.uid() order by creado_en desc limit 20) o), '[]'::jsonb)
  );
end $$;

create or replace function public.reclamar_cupon_racha()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_reglas jsonb := public.reglas();
  v_codigo text;
begin
  perform public.exigir_perfil_listo();
  if public.racha_ciclo(auth.uid()) < (v_reglas ->> 'racha_meta')::int then
    raise exception 'Aún no completas la racha' using errcode = 'P0001';
  end if;
  v_codigo := public.codigo_cupon();
  insert into public.cupones (usuario, tipo, codigo, descripcion, vence_en)
  values (auth.uid(), 'racha', v_codigo, v_reglas ->> 'racha_premio',
          now() + make_interval(days => (v_reglas ->> 'vigencia_dias')::int));
  return jsonb_build_object('codigo', v_codigo);
end $$;

create or replace function public.reclamar_premio_pedidos()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_reglas jsonb := public.reglas();
  v_desde  timestamptz;
  v_n      integer;
  v_codigo text;
begin
  perform public.exigir_perfil_listo();
  select max(creado_en) into v_desde from public.cupones where usuario = auth.uid() and tipo = 'pedidos';
  select count(*) into v_n from public.pedidos
   where usuario = auth.uid() and estado = 'entregado' and (v_desde is null or entregado_en > v_desde);
  if v_n < (v_reglas ->> 'pedidos_meta')::int then
    raise exception 'Aún no completas los pedidos' using errcode = 'P0001';
  end if;
  v_codigo := public.codigo_cupon();
  insert into public.cupones (usuario, tipo, codigo, descripcion, vence_en)
  values (auth.uid(), 'pedidos', v_codigo, v_reglas ->> 'pedidos_premio',
          now() + make_interval(days => (v_reglas ->> 'vigencia_dias')::int));
  return jsonb_build_object('codigo', v_codigo);
end $$;

-- Deja registrado un pedido "solicitado" (el pedido real sigue yendo por WhatsApp).
-- Solo cuenta para el premio cuando el dueño lo marca como entregado.
create or replace function public.registrar_pedido(p_total integer, p_resumen text default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  perform public.exigir_perfil_listo();
  if p_total is null or p_total < 0 or p_total > 10000000 then
    raise exception 'Total no válido' using errcode = 'P0001';
  end if;
  if (select count(*) from public.pedidos
       where usuario = auth.uid() and creado_en >= now() - interval '1 day')
     >= (public.reglas() ->> 'pedidos_max_dia')::int then
    raise exception 'Demasiados pedidos hoy' using errcode = 'P0001';
  end if;
  insert into public.pedidos (usuario, total, resumen)
  values (auth.uid(), p_total, left(p_resumen, 500))
  returning id into v_id;
  return v_id;
end $$;

-- Progreso de los juegos: solo se lee y escribe el propio, y solo con perfil completo.
create or replace function public.guardar_progreso_juego(p_datos jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.exigir_perfil_listo();
  if p_datos is null or jsonb_typeof(p_datos) <> 'object' then
    raise exception 'Progreso no válido' using errcode = 'P0001';
  end if;
  if pg_column_size(p_datos) > 200000 then
    raise exception 'El progreso es demasiado grande' using errcode = 'P0001';
  end if;
  insert into public.juego_progreso (usuario, datos, actualizado_en)
  values (auth.uid(), p_datos, now())
  on conflict (usuario) do update set datos = excluded.datos, actualizado_en = excluded.actualizado_en;
end $$;

create or replace function public.cargar_progreso_juego()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.exigir_perfil_listo();
  return (select datos from public.juego_progreso where usuario = auth.uid());
end $$;

-- Borra la cuenta y todo lo asociado (visitas, pedidos, cupones, perfil).
create or replace function public.borrar_mi_cuenta()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión' using errcode = '28000'; end if;
  delete from auth.users where id = auth.uid();
end $$;

-- ---------- Funciones del dueño (solo `admins` con verificación en dos pasos) ----------
create or replace function public.admin_consultar_cupon(p_codigo text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r record;
begin
  if not public.es_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  select c.*, p.apodo, u.email into r
    from public.cupones c
    join public.perfiles p on p.id = c.usuario
    join auth.users u on u.id = c.usuario
   where c.codigo = upper(trim(p_codigo));
  if not found then return jsonb_build_object('encontrado', false); end if;
  return jsonb_build_object(
    'encontrado', true, 'codigo', r.codigo, 'tipo', r.tipo, 'descripcion', r.descripcion,
    'apodo', r.apodo,
    'correo', case when r.email is null then null
                   else left(r.email, 2) || '***@' || split_part(r.email, '@', 2) end,
    'creado_en', r.creado_en, 'vence_en', r.vence_en, 'canjeado_en', r.canjeado_en,
    'estado', case when r.canjeado_en is not null then 'canjeado'
                   when r.vence_en < now() then 'vencido' else 'vigente' end);
end $$;

create or replace function public.admin_canjear_cupon(p_codigo text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  if not public.es_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  update public.cupones
     set canjeado_en = now(), canjeado_por = auth.uid()
   where codigo = upper(trim(p_codigo)) and canjeado_en is null and vence_en >= now();
  get diagnostics v_n = row_count;
  return v_n = 1;
end $$;

create or replace function public.admin_pedidos(p_estado text default 'solicitado')
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.es_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', o.id, 'apodo', p.apodo, 'total', o.total, 'resumen', o.resumen,
             'creado_en', o.creado_en, 'estado', o.estado) order by o.creado_en desc)
    from (select * from public.pedidos where estado = p_estado order by creado_en desc limit 100) o
    join public.perfiles p on p.id = o.usuario), '[]'::jsonb);
end $$;

create or replace function public.admin_marcar_pedido(p_id bigint, p_estado text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  if not public.es_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_estado not in ('solicitado', 'entregado', 'cancelado') then
    raise exception 'Estado no válido' using errcode = 'P0001';
  end if;
  update public.pedidos
     set estado = p_estado,
         entregado_en = case when p_estado = 'entregado' then now() else null end,
         atendido_por = auth.uid()
   where id = p_id;
  get diagnostics v_n = row_count;
  return v_n = 1;
end $$;

-- ---------- Permisos ----------
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

-- Tablas: el cliente solo LEE lo suyo (RLS) y solo puede cambiar su apodo.
grant select on public.perfiles, public.visitas, public.pedidos, public.cupones, public.juego_progreso to authenticated;
grant update (apodo) on public.perfiles to authenticated;

drop policy if exists perfiles_propio on public.perfiles;
create policy perfiles_propio on public.perfiles for select to authenticated using (id = auth.uid());
drop policy if exists perfiles_actualizar on public.perfiles;
create policy perfiles_actualizar on public.perfiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists visitas_propias on public.visitas;
create policy visitas_propias on public.visitas for select to authenticated using (usuario = auth.uid());

drop policy if exists pedidos_propios on public.pedidos;
create policy pedidos_propios on public.pedidos for select to authenticated
  using (usuario = auth.uid() or public.es_admin());

drop policy if exists juego_propio on public.juego_progreso;
create policy juego_propio on public.juego_progreso for select to authenticated using (usuario = auth.uid());

drop policy if exists cupones_propios on public.cupones;
create policy cupones_propios on public.cupones for select to authenticated
  using (usuario = auth.uid() or public.es_admin());

-- Funciones: solo usuarios con sesión (nunca `anon`).
grant execute on function
  public.reglas(), public.hoy_cl(), public.es_admin(), public.perfil_listo(),
  public.declarar_perfil(text, text), public.registrar_visita(), public.mi_resumen(),
  public.reclamar_cupon_racha(), public.reclamar_premio_pedidos(),
  public.registrar_pedido(integer, text), public.borrar_mi_cuenta(),
  public.guardar_progreso_juego(jsonb), public.cargar_progreso_juego(),
  public.admin_consultar_cupon(text), public.admin_canjear_cupon(text),
  public.admin_pedidos(text), public.admin_marcar_pedido(bigint, text)
to authenticated;
