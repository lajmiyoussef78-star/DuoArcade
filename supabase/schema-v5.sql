-- schema-v5.sql — DuoArcade Phase 2.5: user profiles, search, public duos.
-- Run ALL of this once in the SQL Editor (after v4).

-- 1. Profiles: one per account, with a searchable username ---------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  username   text unique,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles are searchable" on public.profiles
  for select to anon, authenticated using (true);
-- (writes only via the functions below)

-- 2. Duos gain a per-duo visibility switch (private by default) ----------
alter table public.duos
  add column if not exists show_public boolean not null default false;

-- 3. Profile functions ----------------------------------------------------

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
  return json_build_object('username', p.username);
end;
$$;

create or replace function public.set_username(p_username text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := lower(trim(p_username));
begin
  if v_uid is null then raise exception 'Sign in first'; end if;
  if v_name !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'Username: 3-20 characters, letters/numbers/underscore only';
  end if;
  insert into profiles (id, username) values (v_uid, v_name)
  on conflict (id) do update set username = v_name;
  return json_build_object('username', v_name);
exception when unique_violation then
  raise exception 'That username is taken';
end;
$$;

create or replace function public.search_users(p_query text)
returns json
language plpgsql security definer set search_path = public
as $$
begin
  if coalesce(trim(p_query), '') = '' then return '[]'::json; end if;
  return coalesce((
    select json_agg(json_build_object(
      'username', pr.username,
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

-- Public profile: username + their PUBLIC duos' stats.
-- Deliberately excludes duo codes, sessions, and tokens — spectators see
-- the scoreboard, never the room.
create or replace function public.get_public_profile(p_username text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  pr record;
begin
  select * into pr from profiles where username = lower(trim(p_username));
  if not found then raise exception 'User not found'; end if;
  return json_build_object(
    'username', pr.username,
    'duos', coalesce((
      select json_agg(json_build_object(
        'name_a', d.name_a, 'name_b', d.name_b,
        'records', d.records, 'evenings', d.evenings,
        'streak', d.streak, 'best_streak', d.best_streak,
        'taste_agree', d.taste_agree, 'taste_total', d.taste_total))
      from duos d
      where (d.member_a = pr.id or d.member_b = pr.id) and d.show_public
    ), '[]'::json));
end;
$$;

-- 4. update_duo learns the visibility switch ------------------------------
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
grant execute on function public.get_public_profile(text) to anon, authenticated;
grant execute on function public.update_duo(text, text, jsonb, text, boolean) to anon, authenticated;
