-- schema-v4.sql — DuoArcade Phase 2+3: accounts, watch parties, taste match.
-- Run ALL of this once in the SQL Editor (after v2 and v3/v3-fix).
--
-- Accounts model:
--   * Creating a duo now requires a signed-in account (the owner, side A).
--   * The partner still joins by invite LINK with no account; if they later
--     sign in and open the link, their account claims side B automatically.
--   * Every write is authorized by EITHER a valid account (member) OR a
--     valid secret token — so link-only guests keep working.

-- 1. New columns ----------------------------------------------------------
alter table public.duos
  add column if not exists member_a uuid,
  add column if not exists member_b uuid,
  add column if not exists taste_agree integer not null default 0,
  add column if not exists taste_total integer not null default 0;

-- 2. Functions ------------------------------------------------------------

create or replace function public.create_duo(p_name_a text, p_name_b text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_code  text;
  v_host  text := replace(gen_random_uuid()::text, '-', '');
  v_guest text := replace(gen_random_uuid()::text, '-', '');
begin
  if v_uid is null then
    raise exception 'Sign in to create a duo';
  end if;
  if coalesce(trim(p_name_a), '') = '' or coalesce(trim(p_name_b), '') = '' then
    raise exception 'Both names are required';
  end if;
  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5));
    exit when not exists (select 1 from duos where code = v_code);
  end loop;
  insert into duos (code, name_a, name_b, member_a)
  values (v_code, left(trim(p_name_a), 20), left(trim(p_name_b), 20), v_uid);
  insert into duo_keys (code, host_token, guest_token)
  values (v_code, v_host, v_guest);
  return json_build_object('code', v_code, 'host_token', v_host, 'guest_token', v_guest);
end;
$$;

create or replace function public.open_duo(p_code text, p_token text default null)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  k record;
  d record;
  v_role text;
begin
  select * into d from duos where code = p_code;
  if not found then raise exception 'Duo not found'; end if;
  select * into k from duo_keys where code = p_code;

  if v_uid is not null and v_uid = d.member_a then
    v_role := 'A';
  elsif v_uid is not null and v_uid = d.member_b then
    v_role := 'B';
  elsif p_token is not null and p_token = k.host_token then
    v_role := 'A';
    if v_uid is not null and d.member_a is null then
      update duos set member_a = v_uid where code = p_code;
    end if;
  elsif p_token is not null and p_token = k.guest_token then
    v_role := 'B';
    if v_uid is not null and d.member_b is null then
      update duos set member_b = v_uid where code = p_code;  -- claim the seat
    end if;
  else
    raise exception 'Invalid invite link';
  end if;

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
  v_uid uuid := auth.uid();
  k record;
  d record;
  n integer;
  ok boolean := false;
begin
  select * into d from duos where code = p_code;
  if not found then return false; end if;
  select * into k from duo_keys where code = p_code;

  if v_uid is not null and (v_uid = d.member_a or v_uid = d.member_b) then ok := true; end if;
  if not ok and p_token is not null
     and (p_token = k.host_token or p_token = k.guest_token) then ok := true; end if;
  if not ok then return false; end if;

  update duos set
    records     = coalesce(p_patch->'records', records),
    evenings    = coalesce((p_patch->>'evenings')::int, evenings),
    streak      = coalesce((p_patch->>'streak')::int, streak),
    best_streak = coalesce((p_patch->>'best_streak')::int, best_streak),
    taste_agree = coalesce((p_patch->>'taste_agree')::int, taste_agree),
    taste_total = coalesce((p_patch->>'taste_total')::int, taste_total),
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

create or replace function public.list_my_duos()
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then return '[]'::json; end if;
  return coalesce(
    (select json_agg(row_to_json(d)) from duos d
      where d.member_a = v_uid or d.member_b = v_uid),
    '[]'::json);
end;
$$;

grant execute on function public.create_duo(text, text) to anon, authenticated;
grant execute on function public.open_duo(text, text) to anon, authenticated;
grant execute on function public.update_duo(text, text, jsonb, text, boolean) to anon, authenticated;
grant execute on function public.list_my_duos() to anon, authenticated;
