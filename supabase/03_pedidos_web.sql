-- ============================================================================
-- Matichoc: paso 3 — pedidos de la tienda (con o sin cuenta) y aviso por Telegram
--
-- Cómo usarlo: Supabase → SQL Editor → pegar TODO este archivo → Run (después de 02_...sql).
-- Se puede ejecutar de nuevo sin problema.
--
-- Qué hace: cuando alguien deja su nombre y celular en la tienda y aprieta "Pagar con Tuu" o
-- "Enviar por WhatsApp", queda registrado como "interesado" y te llega un aviso por Telegram. Si
-- después aprieta "Ya pagué", queda como "dice que pagó" (el pago real lo confirmas tú en Tuu).
-- El token del bot de Telegram NO va aquí ni en el repositorio: se guarda aparte (ver LEEME.md).
-- ============================================================================

create extension if not exists pg_net with schema extensions;

-- ---------- Datos privados del servidor (token del bot y chat de Telegram) ----------
create table if not exists public.config_privada (
  clave text primary key,
  valor text not null
);
alter table public.config_privada enable row level security;  -- sin políticas: nadie la lee desde el navegador
revoke all on public.config_privada from anon, authenticated;

-- ---------- Pedidos: ahora también de personas sin cuenta ----------
alter table public.pedidos alter column usuario drop not null;
alter table public.pedidos add column if not exists nombre         text check (char_length(nombre) <= 60);
alter table public.pedidos add column if not exists telefono       text check (char_length(telefono) <= 15);
alter table public.pedidos add column if not exists origen         text check (origen in ('tuu', 'whatsapp', 'ambos'));
alter table public.pedidos add column if not exists token          uuid not null default gen_random_uuid();
alter table public.pedidos add column if not exists actualizado_en timestamptz not null default now();
create unique index if not exists pedidos_token_idx on public.pedidos (token);
create index if not exists pedidos_telefono_idx on public.pedidos (telefono, creado_en);

alter table public.pedidos drop constraint if exists pedidos_estado_check;
alter table public.pedidos add constraint pedidos_estado_check check (estado in
  ('interesado', 'dice_pagado', 'contactado', 'pagado', 'solicitado', 'entregado', 'cancelado'));

-- Estados abiertos = los que el dueño todavía tiene que atender.
create or replace function public.estados_abiertos()
returns text[]
as $$ select array['interesado', 'dice_pagado', 'contactado', 'pagado', 'solicitado'] $$
language sql immutable;

-- ---------- Aviso por Telegram ----------
create or replace function public.avisar_telegram(p_texto text)
returns void
as $$
declare
  v_token text; v_chat text;
begin
  select valor into v_token from public.config_privada where clave = 'telegram_token';
  select valor into v_chat  from public.config_privada where clave = 'telegram_chat';
  if v_token is null or v_chat is null then return; end if;      -- sin configurar: no avisa, no falla
  perform net.http_post(
    url     := 'https://api.telegram.org/bot' || v_token || '/sendMessage',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := jsonb_build_object('chat_id', v_chat, 'text', left(p_texto, 3500),
                                  'disable_web_page_preview', true));
exception when others then
  null;  -- un fallo del aviso NUNCA debe impedir que el pedido se guarde
end $$
language plpgsql security definer set search_path = public, extensions;

create or replace function public.avisar_pedido_web()
returns trigger
as $$
declare
  v_plata text := replace(to_char(new.total, 'FM999,999,999'), ',', '.');
  v_quien text := coalesce(new.nombre, 'Alguien') || ' (+' || coalesce(new.telefono, 'sin celular') || ')';
  v_wsp   text := case when new.telefono is null then '' else E'\nEscribirle: https://wa.me/' || new.telefono end;
begin
  if tg_op = 'INSERT' and new.estado = 'interesado' then
    perform public.avisar_telegram(
      E'🛒 Quiere comprar\n👤 ' || v_quien || E'\n🛍️ ' || coalesce(new.resumen, 'sin detalle') ||
      E'\n💵 $' || v_plata || E'\n➡️ Abrió: ' ||
      case new.origen when 'tuu' then 'pago con Tuu' when 'whatsapp' then 'WhatsApp' else 'la tienda' end || v_wsp);
  elsif tg_op = 'UPDATE' and new.estado = 'dice_pagado' and old.estado is distinct from 'dice_pagado' then
    perform public.avisar_telegram(
      E'💳 Dice que ya pagó\n👤 ' || v_quien || E'\n🛍️ ' || coalesce(new.resumen, 'sin detalle') ||
      E'\n💵 $' || v_plata || E'\n📎 Espera su comprobante por WhatsApp y confírmalo en tu app de Tuu antes de entregar.' || v_wsp);
  end if;
  return new;
end $$
language plpgsql security definer set search_path = public;

drop trigger if exists pedidos_aviso_nuevo on public.pedidos;
create trigger pedidos_aviso_nuevo after insert on public.pedidos
  for each row execute function public.avisar_pedido_web();
drop trigger if exists pedidos_aviso_pago on public.pedidos;
create trigger pedidos_aviso_pago after update of estado on public.pedidos
  for each row execute function public.avisar_pedido_web();

-- ---------- Funciones que usa la tienda (con o sin cuenta) ----------
create or replace function public.normalizar_telefono(p text)
returns text
as $$
declare d text := regexp_replace(coalesce(p, ''), '\D', '', 'g');
begin
  d := regexp_replace(d, '^00', '');
  if char_length(d) = 9 and left(d, 1) = '9' then d := '56' || d; end if;   -- celular chileno sin código de país
  if char_length(d) < 9 or char_length(d) > 15 then return null; end if;
  return d;
end $$
language plpgsql immutable;

-- Registra que alguien quiere comprar. Devuelve el token con el que esa misma persona puede
-- avisar después "ya pagué" (el token solo lo conoce su navegador).
create or replace function public.pedido_web_registrar(
  p_nombre text, p_telefono text, p_resumen text, p_total integer, p_origen text)
returns uuid
as $$
declare
  v_nombre text := nullif(trim(coalesce(p_nombre, '')), '');
  v_tel    text := public.normalizar_telefono(p_telefono);
  v_token  uuid;
begin
  if v_nombre is null or char_length(v_nombre) < 2 or char_length(v_nombre) > 60 then
    raise exception 'Escribe tu nombre' using errcode = 'P0001';
  end if;
  if v_tel is null then raise exception 'Escribe un celular válido' using errcode = 'P0001'; end if;
  if p_total is null or p_total <= 0 or p_total > 10000000 then
    raise exception 'Total no válido' using errcode = 'P0001'; end if;
  if p_origen not in ('tuu', 'whatsapp') then raise exception 'Origen no válido' using errcode = 'P0001'; end if;
  -- freno anti-abuso: pocos avisos por celular por hora y un tope diario para todo el sitio
  if (select count(*) from public.pedidos where telefono = v_tel and creado_en >= now() - interval '1 hour') >= 5
     or (select count(*) from public.pedidos where nombre is not null and creado_en >= now() - interval '1 day') >= 300 then
    raise exception 'Demasiados pedidos hoy' using errcode = 'P0001';
  end if;
  insert into public.pedidos (usuario, nombre, telefono, resumen, total, origen, estado)
  values (case when auth.uid() is not null and public.perfil_listo() then auth.uid() end,
          v_nombre, v_tel, left(p_resumen, 500), p_total, p_origen, 'interesado')
  returning token into v_token;
  return v_token;
end $$
language plpgsql security definer set search_path = public;

-- La misma persona avisa qué hizo después con el mismo pedido: 'tuu', 'whatsapp' o 'pagado' (= "ya pagué").
-- Solo avanza interesado → dice_pagado; nunca puede marcar entregado ni nada del dueño.
create or replace function public.pedido_web_evento(p_token uuid, p_evento text)
returns boolean
as $$
declare v_n integer;
begin
  if p_evento = 'pagado' then
    update public.pedidos set estado = 'dice_pagado', origen = coalesce(origen, 'tuu'), actualizado_en = now()
     where token = p_token and estado = 'interesado';
  elsif p_evento in ('tuu', 'whatsapp') then
    update public.pedidos
       set origen = case when origen is null or origen = p_evento then p_evento else 'ambos' end, actualizado_en = now()
     where token = p_token and estado in ('interesado', 'dice_pagado');
  else
    raise exception 'Evento no válido' using errcode = 'P0001';
  end if;
  get diagnostics v_n = row_count;
  return v_n = 1;
end $$
language plpgsql security definer set search_path = public;

-- ---------- Panel del dueño ----------
drop function if exists public.admin_pedidos(text);
create or replace function public.admin_pedidos(p_estado text default 'abiertos')
returns jsonb
as $$
begin
  if not public.es_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', o.id, 'apodo', coalesce(o.nombre, p.apodo), 'telefono', o.telefono, 'origen', o.origen,
             'con_cuenta', o.usuario is not null,
             'total', o.total, 'resumen', o.resumen, 'creado_en', o.creado_en, 'estado', o.estado)
           order by o.creado_en desc)
    from (select * from public.pedidos
           where (p_estado = 'abiertos' and estado = any (public.estados_abiertos())) or estado = p_estado
           order by creado_en desc limit 100) o
    left join public.perfiles p on p.id = o.usuario), '[]'::jsonb);
end $$
language plpgsql stable security definer set search_path = public;

create or replace function public.admin_marcar_pedido(p_id bigint, p_estado text)
returns boolean
as $$
declare v_n integer;
begin
  if not public.es_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_estado not in ('interesado', 'dice_pagado', 'contactado', 'pagado', 'solicitado', 'entregado', 'cancelado') then
    raise exception 'Estado no válido' using errcode = 'P0001';
  end if;
  update public.pedidos
     set estado = p_estado,
         entregado_en = case when p_estado = 'entregado' then now() else null end,
         atendido_por = auth.uid(), actualizado_en = now()
   where id = p_id;
  get diagnostics v_n = row_count;
  return v_n = 1;
end $$
language plpgsql security definer set search_path = public;

-- Lista de Matilovers: ahora con la racha actual (para armar dinámicas).
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
               'racha', public.racha_ciclo(p.id),
               'pedidos_entregados', (select count(*) from public.pedidos o where o.usuario = p.id and o.estado = 'entregado')
             ) order by p.creado_en desc)
      from (select * from public.perfiles order by creado_en desc limit 1000) p
      join auth.users u on u.id = p.id), '[]'::jsonb));
end $$
language plpgsql stable security definer set search_path = public;

-- ---------- Permisos ----------
revoke execute on function
  public.estados_abiertos(), public.avisar_telegram(text), public.avisar_pedido_web(),
  public.normalizar_telefono(text), public.pedido_web_registrar(text, text, text, integer, text),
  public.pedido_web_evento(uuid, text), public.admin_pedidos(text), public.admin_marcar_pedido(bigint, text),
  public.admin_matilovers()
  from public, anon, authenticated;
-- La tienda las usa con o sin sesión (anon y authenticated); solo validan y anotan.
grant execute on function public.pedido_web_registrar(text, text, text, integer, text),
                          public.pedido_web_evento(uuid, text) to anon, authenticated;
grant execute on function public.admin_pedidos(text), public.admin_marcar_pedido(bigint, text),
                          public.admin_matilovers() to authenticated;
