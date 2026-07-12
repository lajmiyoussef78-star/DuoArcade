-- schema-v3.sql — DuoArcade Phase 1.5: server-side authority.
-- Run ONCE in Supabase: SQL Editor -> New query -> paste EVERYTHING -> Run.
--
-- What this does:
--   1. Moves secret tokens OFF the readable duos row into duo_keys,
--      a table the browser can never read.
--   2. Removes the browser's right to write to duos directly.
--   3. All writes now go through three server-side functions that verify
--      the caller's token first: create_duo, open_duo, update_duo.
--   4. Reads stay open so realtime keeps working (the readable row now
--      contains no secrets).
--
-- After running this, REDEPLOY the matching app version — the old app
-- can no longer write.

create extension if not exists pgcrypto;

-- 1. Secret keys live apart from the public row -------------------------
create table if not exists public.duo_keys (
  code        text primary key references public.duos(code) on delete cascade,
  host_token  text not null,
  guest_token text not null
);
alter table public.duo_keys enable row level security;
-- (no policies on purpose: the anon key can NEVER read or write this table)

-- Migrate any existing duos: guest keeps their token, host gets a fresh one.
insert into public.duo_keys (code, host_token, guest_token)
select code, encode(gen_random_bytes(16), 'hex'), guest_token
from public.duos
where guest_token is not null
on conflict (code) do nothing;

alter table public.duos drop column if exists guest_token;

-- 2. Revoke direct writes ------------------------------------------------
drop policy if exists "phase1: create duos" on public.duos;
drop policy if exists "phase1: update duos" on public.duos;
-- "phase1: read duos" (select) stays — needed for realtime, and the row
-- holds no secrets anymore.

-- 3. Server-side functions ----------------------------------------------

create or replace function public.create_duo(p_name_a text, p_name_b text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_code  text;
  v_host  text := encode(gen_random_bytes(16), 'hex');
  v_guest text := encode(gen_random_bytes(16), 'hex');
begin
  if coalesce(trim(p_name_a), '') = '' or coalesce(trim(p_name_b), '') = '' then
    raise exception 'Both names are required';
  end if;
  loop
    v_code := upper(substr(md5(random()::text), 1, 5));
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
    return false;  -- caller holds neither key: rejected
  end if;

  update duos set
    records  = coalesce(p_patch->'records', records),
    evenings = coalesce((p_patch->>'evenings')::int, evenings),
    last_day = coalesce(p_patch->>'last_day', last_day),
    session  = case
                 when p_patch->'session' = 'null'::jsonb then null
                 when p_patch ? 'session' then p_patch->'session'
                 else session
               end,
    turn     = coalesce(p_patch->>'turn', turn)
  where code = p_code
    and (p_force or p_guard_turn is null or turn = p_guard_turn);
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

grant execute on function public.create_duo(text, text) to anon;
grant execute on function public.open_duo(text, text) to anon;
grant execute on function public.update_duo(text, text, jsonb, text, boolean) to anon;

-- 4. One-time helper for YOU (Youssef): your existing duo got a fresh
--    host token. Run the line below separately, copy your host_token,
--    and open the site once as:
--    https://YOUR-SITE.netlify.app/?duo=YOURCODE&t=HOSTTOKEN
--    That claims the host seat on your device again.
--
--    select code, host_token from public.duo_keys;
