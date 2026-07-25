-- schema-v35-friends.sql — Duo Friends (max 5) + 1v1 friend matches.
-- Run once in Supabase SQL Editor after prior schemas.

-- 1. Requests ----------------------------------------------------------------
create table if not exists public.friend_requests (
  id          uuid primary key default gen_random_uuid(),
  from_id     uuid not null references auth.users(id) on delete cascade,
  to_id       uuid not null references auth.users(id) on delete cascade,
  status      text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at  timestamptz not null default now(),
  responded_at timestamptz,
  check (from_id <> to_id)
);

create unique index if not exists friend_requests_pending_pair
  on public.friend_requests (least(from_id, to_id), greatest(from_id, to_id))
  where status = 'pending';

create index if not exists friend_requests_to_pending
  on public.friend_requests (to_id) where status = 'pending';

create index if not exists friend_requests_from_pending
  on public.friend_requests (from_id) where status = 'pending';

-- 2. Friendships (undirected, max 5 enforced in RPCs) ------------------------
create table if not exists public.friendships (
  user_a     uuid not null references auth.users(id) on delete cascade,
  user_b     uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);

create index if not exists friendships_user_b_idx on public.friendships (user_b);

-- 3. User-level presence (friends + partner busy label) ----------------------
create table if not exists public.user_presence (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  last_seen   timestamptz not null default now(),
  status      text not null default 'online'
    check (status in ('online', 'away', 'busy')),
  busy_label  text,
  match_code  text
);

-- 4. Friend 1v1 matches (separate from duos.session) -------------------------
create table if not exists public.friend_matches (
  code        text primary key,
  game_id     text not null,
  host_id     uuid not null references auth.users(id) on delete cascade,
  guest_id    uuid not null references auth.users(id) on delete cascade,
  session     jsonb not null default '{}'::jsonb,
  status      text not null default 'invite'
    check (status in ('invite', 'lobby', 'live', 'ended', 'declined', 'cancelled')),
  winner      text check (winner in ('A', 'B', 'draw')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  finished_at timestamptz,
  check (host_id <> guest_id)
);

create index if not exists friend_matches_host_idx
  on public.friend_matches (host_id, updated_at desc);
create index if not exists friend_matches_guest_idx
  on public.friend_matches (guest_id, updated_at desc);

alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.user_presence enable row level security;
alter table public.friend_matches enable row level security;

-- No broad client SELECT on friendships / requests (privacy).
-- Match participants can read their matches.
drop policy if exists "friend_matches: participants read" on public.friend_matches;
create policy "friend_matches: participants read"
  on public.friend_matches for select to authenticated
  using (auth.uid() = host_id or auth.uid() = guest_id);

-- Friends may see each other's presence freshness (not friend lists).
drop policy if exists "user_presence: self or friends read" on public.user_presence;
create policy "user_presence: self or friends read"
  on public.user_presence for select to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.friendships f
      where (f.user_a = auth.uid() and f.user_b = user_id)
         or (f.user_b = auth.uid() and f.user_a = user_id)
    )
    or exists (
      select 1 from public.duos d
      where (d.member_a = auth.uid() and d.member_b = user_id)
         or (d.member_b = auth.uid() and d.member_a = user_id)
    )
  );

-- Helpers --------------------------------------------------------------------
create or replace function public.friend_count(p_uid uuid)
returns integer
language sql stable security definer set search_path = public
as $$
  select count(*)::integer from friendships
  where user_a = p_uid or user_b = p_uid;
$$;

create or replace function public.friend_ordered_pair(p1 uuid, p2 uuid)
returns table (a uuid, b uuid)
language sql immutable
as $$
  select least(p1, p2), greatest(p1, p2);
$$;

create or replace function public.my_duo_row()
returns public.duos
language plpgsql stable security definer set search_path = public
as $$
declare d public.duos;
begin
  select * into d from duos
  where member_a = auth.uid() or member_b = auth.uid()
  order by created_at desc limit 1;
  return d;
end;
$$;

create or replace function public.friend_new_code()
returns text
language plpgsql volatile set search_path = public
as $$
declare c text;
begin
  loop
    c := 'F-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (select 1 from friend_matches where code = c);
  end loop;
  return c;
end;
$$;

create or replace function public.friend_row_json(p_uid uuid)
returns json
language plpgsql stable security definer set search_path = public
as $$
declare
  pr record;
  up record;
  online boolean;
begin
  select * into pr from profiles where id = p_uid;
  select * into up from user_presence where user_id = p_uid;
  online := up.last_seen is not null and up.last_seen > now() - interval '25 seconds';
  return json_build_object(
    'id', p_uid,
    'username', pr.username,
    'online', online,
    'status', case
      when not online then 'offline'
      else coalesce(up.status, 'online')
    end,
    'busy_label', case when online then up.busy_label else null end,
    'match_code', case when online and up.status = 'busy' then up.match_code else null end
  );
end;
$$;

-- Requests -------------------------------------------------------------------
create or replace function public.send_friend_request(p_username text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_me record;
  v_them record;
  v_id uuid;
  pair record;
begin
  if v_uid is null then raise exception 'Sign in first'; end if;
  select * into v_me from profiles where id = v_uid;
  if v_me.username is null then
    raise exception 'Set a username before adding friends';
  end if;
  select * into v_them from profiles where username = lower(trim(p_username));
  if not found then raise exception 'User not found'; end if;
  if v_them.id = v_uid then raise exception 'You cannot friend yourself'; end if;

  if public.friend_count(v_uid) >= 5 then
    raise exception 'You already have 5 friends';
  end if;
  if public.friend_count(v_them.id) >= 5 then
    raise exception 'That person already has 5 friends';
  end if;

  select * into pair from public.friend_ordered_pair(v_uid, v_them.id);
  if exists (select 1 from friendships where user_a = pair.a and user_b = pair.b) then
    raise exception 'You are already friends';
  end if;
  if exists (
    select 1 from friend_requests
    where status = 'pending'
      and ((from_id = v_uid and to_id = v_them.id)
        or (from_id = v_them.id and to_id = v_uid))
  ) then
    raise exception 'A friend request is already pending';
  end if;

  insert into friend_requests (from_id, to_id, status)
  values (v_uid, v_them.id, 'pending')
  returning id into v_id;

  return json_build_object(
    'id', v_id,
    'to_username', v_them.username,
    'status', 'pending'
  );
end;
$$;

create or replace function public.respond_friend_request(p_id uuid, p_accept boolean)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  r record;
  pair record;
begin
  if v_uid is null then raise exception 'Sign in first'; end if;
  select * into r from friend_requests where id = p_id for update;
  if not found then raise exception 'Request not found'; end if;
  if r.to_id <> v_uid then raise exception 'Only the recipient can respond'; end if;
  if r.status <> 'pending' then raise exception 'Request is no longer pending'; end if;

  if not p_accept then
    update friend_requests
      set status = 'declined', responded_at = now()
      where id = p_id;
    return json_build_object('id', p_id, 'status', 'declined');
  end if;

  if public.friend_count(r.from_id) >= 5 then
    raise exception 'They already have 5 friends';
  end if;
  if public.friend_count(r.to_id) >= 5 then
    raise exception 'You already have 5 friends';
  end if;

  select * into pair from public.friend_ordered_pair(r.from_id, r.to_id);
  insert into friendships (user_a, user_b) values (pair.a, pair.b)
  on conflict do nothing;

  update friend_requests
    set status = 'accepted', responded_at = now()
    where id = p_id;

  return json_build_object('id', p_id, 'status', 'accepted');
end;
$$;

create or replace function public.cancel_friend_request(p_id uuid)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  r record;
begin
  if v_uid is null then raise exception 'Sign in first'; end if;
  select * into r from friend_requests where id = p_id for update;
  if not found then raise exception 'Request not found'; end if;
  if r.from_id <> v_uid then raise exception 'Only the sender can cancel'; end if;
  if r.status <> 'pending' then raise exception 'Request is no longer pending'; end if;
  update friend_requests set status = 'cancelled', responded_at = now() where id = p_id;
  return json_build_object('id', p_id, 'status', 'cancelled');
end;
$$;

create or replace function public.remove_friend(p_friend_id uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  pair record;
begin
  if v_uid is null then raise exception 'Sign in first'; end if;
  select * into pair from public.friend_ordered_pair(v_uid, p_friend_id);
  delete from friendships where user_a = pair.a and user_b = pair.b;
  return found;
end;
$$;

-- Duo-scoped friend view (privacy gate) --------------------------------------
create or replace function public.list_duo_friend_view()
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  d public.duos;
  v_partner uuid;
  mine json;
  partner json;
  incoming json;
  outgoing json;
  partner_pres json;
begin
  if v_uid is null then raise exception 'Sign in first'; end if;
  d := public.my_duo_row();
  if d.code is null then raise exception 'Join a duo first'; end if;
  if d.member_a is null or d.member_b is null then
    raise exception 'Both partners must link their accounts before using Friends';
  end if;
  if v_uid <> d.member_a and v_uid <> d.member_b then
    raise exception 'Not a member of this duo';
  end if;

  v_partner := case when v_uid = d.member_a then d.member_b else d.member_a end;

  mine := coalesce((
    select json_agg(public.friend_row_json(t.fid) order by (public.friend_row_json(t.fid)->>'username'))
    from (
      select case when f.user_a = v_uid then f.user_b else f.user_a end as fid
      from friendships f
      where f.user_a = v_uid or f.user_b = v_uid
    ) t
  ), '[]'::json);

  partner := coalesce((
    select json_agg(public.friend_row_json(t.fid) order by (public.friend_row_json(t.fid)->>'username'))
    from (
      select case when f.user_a = v_partner then f.user_b else f.user_a end as fid
      from friendships f
      where f.user_a = v_partner or f.user_b = v_partner
    ) t
  ), '[]'::json);

  select coalesce(json_agg(json_build_object(
    'id', r.id,
    'from_id', r.from_id,
    'from_username', pr.username,
    'created_at', r.created_at
  ) order by r.created_at desc), '[]'::json)
  into incoming
  from friend_requests r
  join profiles pr on pr.id = r.from_id
  where r.to_id = v_uid and r.status = 'pending';

  select coalesce(json_agg(json_build_object(
    'id', r.id,
    'to_id', r.to_id,
    'to_username', pr.username,
    'created_at', r.created_at
  ) order by r.created_at desc), '[]'::json)
  into outgoing
  from friend_requests r
  join profiles pr on pr.id = r.to_id
  where r.from_id = v_uid and r.status = 'pending';

  partner_pres := public.friend_row_json(v_partner);

  return json_build_object(
    'mine', mine,
    'partner', partner,
    'incoming', incoming,
    'outgoing', outgoing,
    'partner_presence', partner_pres,
    'slots_left', greatest(0, 5 - public.friend_count(v_uid))
  );
end;
$$;

-- Presence -------------------------------------------------------------------
create or replace function public.user_presence_beat(
  p_status text default 'online',
  p_busy_label text default null,
  p_match_code text default null
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_status text := coalesce(nullif(trim(p_status), ''), 'online');
begin
  if v_uid is null then return; end if;
  if v_status not in ('online', 'away', 'busy') then v_status := 'online'; end if;

  insert into user_presence (user_id, last_seen, status, busy_label, match_code)
  values (
    v_uid, now(), v_status,
    case when v_status = 'busy' then p_busy_label else null end,
    case when v_status = 'busy' then p_match_code else null end
  )
  on conflict (user_id) do update set
    last_seen = now(),
    status = excluded.status,
    busy_label = excluded.busy_label,
    match_code = excluded.match_code;
end;
$$;

create or replace function public.user_presence_leave()
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then return; end if;
  update user_presence
    set last_seen = now() - interval '1 hour',
        status = 'online',
        busy_label = null,
        match_code = null
  where user_id = auth.uid();
end;
$$;

-- Matches --------------------------------------------------------------------
create or replace function public.create_friend_match(p_friend_id uuid, p_game_id text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  pair record;
  c text;
  m friend_matches;
  host_name text;
  guest_name text;
  sess jsonb;
begin
  if v_uid is null then raise exception 'Sign in first'; end if;
  if coalesce(trim(p_game_id), '') = '' then raise exception 'Pick a game'; end if;

  select * into pair from public.friend_ordered_pair(v_uid, p_friend_id);
  if not exists (select 1 from friendships where user_a = pair.a and user_b = pair.b) then
    raise exception 'You can only invite friends';
  end if;

  if exists (
    select 1 from friend_matches
    where status in ('invite', 'lobby', 'live')
      and (host_id = v_uid or guest_id = v_uid
        or host_id = p_friend_id or guest_id = p_friend_id)
  ) then
    raise exception 'One of you already has an active friend match';
  end if;

  select username into host_name from profiles where id = v_uid;
  select username into guest_name from profiles where id = p_friend_id;

  c := public.friend_new_code();
  sess := jsonb_build_object(
    'game', p_game_id,
    'phase', 'invite',
    'by', 'A',
    'ready', jsonb_build_object('A', false, 'B', false),
    'startedAt', (extract(epoch from now()) * 1000)::bigint,
    'names', jsonb_build_object(
      'A', coalesce(host_name, 'Host'),
      'B', coalesce(guest_name, 'Guest')
    )
  );

  insert into friend_matches (code, game_id, host_id, guest_id, session, status)
  values (c, p_game_id, v_uid, p_friend_id, sess, 'invite')
  returning * into m;

  perform public.user_presence_beat(
    'busy',
    'Playing with @' || coalesce(guest_name, 'friend'),
    c
  );

  return row_to_json(m);
end;
$$;

create or replace function public.respond_friend_match(p_code text, p_accept boolean)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  m friend_matches;
  host_name text;
  guest_name text;
  sess jsonb;
begin
  if v_uid is null then raise exception 'Sign in first'; end if;
  select * into m from friend_matches where code = upper(trim(p_code)) for update;
  if not found then raise exception 'Match not found'; end if;
  if m.guest_id <> v_uid then raise exception 'Only the invited friend can respond'; end if;
  if m.status <> 'invite' then raise exception 'This invite is no longer open'; end if;

  select username into host_name from profiles where id = m.host_id;
  select username into guest_name from profiles where id = m.guest_id;

  if not p_accept then
    update friend_matches
      set status = 'declined', updated_at = now()
      where code = m.code returning * into m;
    update user_presence
      set status = 'online', busy_label = null, match_code = null, last_seen = now()
      where user_id = m.host_id;
    return row_to_json(m);
  end if;

  sess := coalesce(m.session, '{}'::jsonb)
    || jsonb_build_object(
      'phase', 'lobby',
      'ready', jsonb_build_object('A', false, 'B', false)
    );

  update friend_matches
    set status = 'lobby', session = sess, updated_at = now()
    where code = m.code returning * into m;

  insert into user_presence (user_id, last_seen, status, busy_label, match_code)
  values (
    v_uid, now(), 'busy',
    'Playing with @' || coalesce(host_name, 'friend'),
    m.code
  )
  on conflict (user_id) do update set
    last_seen = now(),
    status = 'busy',
    busy_label = excluded.busy_label,
    match_code = excluded.match_code;

  update user_presence
    set status = 'busy',
        busy_label = 'Playing with @' || coalesce(guest_name, 'friend'),
        match_code = m.code,
        last_seen = now()
    where user_id = m.host_id;

  return row_to_json(m);
end;
$$;

create or replace function public.update_friend_match_session(p_code text, p_session jsonb)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  m friend_matches;
  v_status text;
begin
  if v_uid is null then raise exception 'Sign in first'; end if;
  select * into m from friend_matches where code = upper(trim(p_code)) for update;
  if not found then raise exception 'Match not found'; end if;
  if v_uid <> m.host_id and v_uid <> m.guest_id then
    raise exception 'Not a participant';
  end if;
  if m.status in ('ended', 'declined', 'cancelled') then
    raise exception 'Match already finished';
  end if;

  v_status := case
    when p_session->>'phase' = 'live' then 'live'
    when p_session->>'phase' = 'lobby' then 'lobby'
    else m.status
  end;

  update friend_matches
    set session = p_session,
        status = v_status,
        updated_at = now()
    where code = m.code
    returning * into m;

  return row_to_json(m);
end;
$$;

create or replace function public.end_friend_match(p_code text, p_winner text default null)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  m friend_matches;
  w text := p_winner;
begin
  if v_uid is null then raise exception 'Sign in first'; end if;
  select * into m from friend_matches where code = upper(trim(p_code)) for update;
  if not found then raise exception 'Match not found'; end if;
  if v_uid <> m.host_id and v_uid <> m.guest_id then
    raise exception 'Not a participant';
  end if;

  if w is not null and w not in ('A', 'B', 'draw') then w := null; end if;

  update friend_matches
    set status = 'ended',
        winner = w,
        finished_at = now(),
        updated_at = now(),
        session = coalesce(session, '{}'::jsonb) || jsonb_build_object(
          'phase', 'ended',
          'winner', w
        )
    where code = m.code
    returning * into m;

  update user_presence
    set status = 'online', busy_label = null, match_code = null, last_seen = now()
    where user_id in (m.host_id, m.guest_id);

  return row_to_json(m);
end;
$$;

create or replace function public.get_friend_match(p_code text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  m friend_matches;
begin
  if v_uid is null then raise exception 'Sign in first'; end if;
  select * into m from friend_matches where code = upper(trim(p_code));
  if not found then raise exception 'Match not found'; end if;
  if v_uid <> m.host_id and v_uid <> m.guest_id then
    raise exception 'Not a participant';
  end if;
  return row_to_json(m);
end;
$$;

create or replace function public.list_pending_friend_match_invites()
returns json
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  return coalesce((
    select json_agg(row_to_json(m) order by m.created_at desc)
    from friend_matches m
    where m.guest_id = auth.uid() and m.status = 'invite'
      and m.created_at > now() - interval '10 minutes'
  ), '[]'::json);
end;
$$;

-- Grants ---------------------------------------------------------------------
grant execute on function public.send_friend_request(text) to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.cancel_friend_request(uuid) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.list_duo_friend_view() to authenticated;
grant execute on function public.user_presence_beat(text, text, text) to authenticated;
grant execute on function public.user_presence_leave() to authenticated;
grant execute on function public.create_friend_match(uuid, text) to authenticated;
grant execute on function public.respond_friend_match(text, boolean) to authenticated;
grant execute on function public.update_friend_match_session(text, jsonb) to authenticated;
grant execute on function public.end_friend_match(text, text) to authenticated;
grant execute on function public.get_friend_match(text) to authenticated;
grant execute on function public.list_pending_friend_match_invites() to authenticated;

-- Realtime for friend match session sync (participants already have SELECT RLS)
do $$
begin
  begin
    alter publication supabase_realtime add table public.friend_matches;
  exception when duplicate_object then null;
  end;
end $$;
