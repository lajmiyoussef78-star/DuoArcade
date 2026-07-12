-- schema-v3-fix.sql — run ALL of this once in the SQL Editor.
-- Fixes: "function gen_random_bytes(integer) does not exist"
--   (Supabase installs pgcrypto outside our functions' search path; we now
--    use gen_random_uuid(), which is built into Postgres core.)
-- Adds: real streaks (current + best) to the duo row.

-- 0. Streak columns ------------------------------------------------------
alter table public.duos
  add column if not exists streak integer not null default 0,
  add column if not exists best_streak integer not null default 0;

-- 1. If the old migration half-applied, finish moving any legacy tokens --
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'duos'
               and column_name = 'guest_token') then
    insert into public.duo_keys (code, host_token, guest_token)
    select code,
           replace(gen_random_uuid()::text, '-', ''),
           guest_token
    from public.duos
    where guest_token is not null
    on conflict (code) do nothing;
    alter table public.duos drop column guest_token;
  end if;
end $$;

-- 2. Recreate the three functions with core-Postgres randomness ----------

create or replace function public.create_duo(p_name_a text, p_name_b text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_code  text;
  v_host  text := replace(gen_random_uuid()::text, '-', '');
  v_guest text := replace(gen_random_uuid()::text, '-', '');
begin
  if coalesce(trim(p_name_a), '') = '' or coalesce(trim(p_name_b), '') = '' then
    raise exception 'Both names are required';
  end if;
  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5));
    exit when not exists (select 1 from duos where code = v_code);
  end loop;
  insert into duos (code, name_a, name_b)
  values (v_code, left(trim(p_name_a), 20), left(trim(p_name_b), 20));
  insert into duo_keys (code, host_token, guest_token)
  values (v_code, v_host, v_guest);
  return json_build_object('code', v_code, 'host_token', v_host, 'guest_token', v_guest);
end;
$$;

create or replace function public.open_duo(p_code text, p_token text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  k record;
  d record;
  v_role text;
begin
  select * into k from duo_keys where code = p_code;
  if not found then raise exception 'Duo not found'; end if;
  if p_token = k.host_token then v_role := 'A';
  elsif p_token = k.guest_token then v_role := 'B';
  else raise exception 'Invalid invite link'; end if;
  select * into d from duos where code = p_code;
  return json_build_object('role', v_role, 'duo', row_to_json(d));
end;
$$;

create or replace function public.update_duo(
  p_code text, p_token text, p_patch jsonb,
  p_guard_turn text default null, p_force boolean default false)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  k record;
  n integer;
begin
  select * into k from duo_keys where code = p_code;
  if not found then return false; end if;
  if p_token is distinct from k.host_token
     and p_token is distinct from k.guest_token then
    return false;
  end if;

  update duos set
    records     = coalesce(p_patch->'records', records),
    evenings    = coalesce((p_patch->>'evenings')::int, evenings),
    streak      = coalesce((p_patch->>'streak')::int, streak),
    best_streak = coalesce((p_patch->>'best_streak')::int, best_streak),
    last_day    = coalesce(p_patch->>'last_day', last_day),
    session     = case
                    when p_patch->'session' = 'null'::jsonb then null
                    when p_patch ? 'session' then p_patch->'session'
                    else session
                  end,
    turn        = coalesce(p_patch->>'turn', turn)
  where code = p_code
    and (p_force or p_guard_turn is null or turn = p_guard_turn);
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

grant execute on function public.create_duo(text, text) to anon;
grant execute on function public.open_duo(text, text) to anon;
grant execute on function public.update_duo(text, text, jsonb, text, boolean) to anon;
