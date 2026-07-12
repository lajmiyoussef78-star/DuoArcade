-- schema-v6.sql — DuoArcade Phase 2.6: member IDs + Duo Pass entitlements.
-- Run ALL of this once in the SQL Editor (after v5).

-- 1. Sequential member numbers (#1, #2, #3, ...) --------------------------
alter table public.profiles add column if not exists user_no bigint;

do $$
declare v_max bigint;
begin
  -- backfill existing members in signup order
  with ordered as (
    select id, row_number() over (order by created_at, id) as rn
    from public.profiles where user_no is null
  )
  update public.profiles p set user_no = o.rn
    + coalesce((select max(user_no) from public.profiles where user_no is not null), 0)
  from ordered o where p.id = o.id;

  select coalesce(max(user_no), 0) into v_max from public.profiles;
  if not exists (select 1 from pg_sequences where sequencename = 'profiles_user_no_seq') then
    execute 'create sequence public.profiles_user_no_seq';
  end if;
  perform setval('public.profiles_user_no_seq', v_max + 1, false);
  alter table public.profiles
    alter column user_no set default nextval('public.profiles_user_no_seq');
end $$;

-- 2. Duo Pass state on the duo (one Pass covers both) + theme -------------
alter table public.duos
  add column if not exists pass_tier text not null default 'free'
    check (pass_tier in ('free','founding','monthly','annual')),
  add column if not exists pass_since timestamptz,
  add column if not exists theme text;

-- 3. Founding codes --------------------------------------------------------
-- Only YOU can create codes (via SQL below); users redeem them in the app.
create table if not exists public.pass_codes (
  code        text primary key,
  tier        text not null default 'founding'
    check (tier in ('founding','monthly','annual')),
  redeemed_by text references public.duos(code),
  redeemed_at timestamptz
);
alter table public.pass_codes enable row level security;
-- no policies on purpose: browsers can never read or guess-check codes.

-- To mint 10 founding codes, run (and save the output):
--   insert into public.pass_codes (code)
--   select 'FOUND-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))
--   from generate_series(1,10)
--   returning code;

create or replace function public.redeem_pass_code(p_code text, p_duo_code text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  d record;
  c record;
begin
  select * into d from duos where code = p_duo_code;
  if not found then raise exception 'Duo not found'; end if;
  if v_uid is null or (v_uid <> d.member_a and (d.member_b is null or v_uid <> d.member_b)) then
    raise exception 'Only a member of this duo can redeem a code for it';
  end if;
  select * into c from pass_codes where code = upper(trim(p_code)) for update;
  if not found then raise exception 'Code not found'; end if;
  if c.redeemed_by is not null then raise exception 'Code already redeemed'; end if;

  update pass_codes set redeemed_by = p_duo_code, redeemed_at = now()
    where code = c.code;
  update duos set pass_tier = c.tier, pass_since = now()
    where code = p_duo_code;
  return json_build_object('tier', c.tier);
end;
$$;

grant execute on function public.redeem_pass_code(text, text) to authenticated;

-- 4. Profile functions now return the member number ------------------------

create or replace function public.get_or_create_profile()
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  p record;
begin
  if v_uid is null then raise exception 'Sign in first'; end if;
  insert into profiles (id) values (v_uid) on conflict (id) do nothing;
  select * into p from profiles where id = v_uid;
  return json_build_object('username', p.username, 'user_no', p.user_no);
end;
$$;

create or replace function public.set_username(p_username text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := lower(trim(p_username));
  p record;
begin
  if v_uid is null then raise exception 'Sign in first'; end if;
  if v_name !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'Username: 3-20 characters, letters/numbers/underscore only';
  end if;
  insert into profiles (id, username) values (v_uid, v_name)
  on conflict (id) do update set username = v_name;
  select * into p from profiles where id = v_uid;
  return json_build_object('username', p.username, 'user_no', p.user_no);
exception when unique_violation then
  raise exception 'That username is taken';
end;
$$;

-- search results show member numbers too
create or replace function public.search_users(p_query text)
returns json
language plpgsql security definer set search_path = public
as $$
begin
  if coalesce(trim(p_query), '') = '' then return '[]'::json; end if;
  return coalesce((
    select json_agg(json_build_object(
      'username', pr.username,
      'user_no', pr.user_no,
      'public_duos', (select count(*) from duos d
                       where (d.member_a = pr.id or d.member_b = pr.id)
                         and d.show_public)))
    from profiles pr
    where pr.username is not null
      and pr.username ilike '%' || lower(trim(p_query)) || '%'
    limit 12
  ), '[]'::json);
end;
$$;

-- 5. update_duo: theme is patchable; pass_tier is NOT (server-only) --------
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
    show_public = coalesce((p_patch->>'show_public')::boolean, show_public),
    theme       = coalesce(p_patch->>'theme', theme),
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

grant execute on function public.get_or_create_profile() to authenticated;
grant execute on function public.set_username(text) to authenticated;
grant execute on function public.search_users(text) to anon, authenticated;
grant execute on function public.update_duo(text, text, jsonb, text, boolean) to anon, authenticated;
