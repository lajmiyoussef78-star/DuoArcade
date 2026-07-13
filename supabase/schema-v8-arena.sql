-- DuoArcade v8: authenticated couple-vs-couple Arena.
-- Run once in Supabase SQL Editor after schema-v7.sql.

create table if not exists public.arena_matches (
  code        text primary key,
  game        text not null check (game in ('ttt','connect4','dots')),
  duo_a       text not null references public.duos(code) on delete cascade,
  duo_b       text references public.duos(code) on delete cascade,
  status      text not null default 'waiting'
    check (status in ('waiting','ready','live','done','declined','cancelled')),
  state       jsonb not null default '{}'::jsonb,
  revision    bigint not null default 0,
  winner      text check (winner in ('A','B','draw')),
  created_by  uuid not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  finished_at timestamptz,
  check (duo_b is null or duo_a <> duo_b)
);

create index if not exists arena_matches_duo_a_idx on public.arena_matches(duo_a, updated_at desc);
create index if not exists arena_matches_duo_b_idx on public.arena_matches(duo_b, updated_at desc);

create table if not exists public.arena_queue (
  duo_code  text primary key references public.duos(code) on delete cascade,
  game      text not null check (game in ('ttt','connect4','dots')),
  joined_by uuid not null,
  joined_at timestamptz not null default now()
);
create index if not exists arena_queue_game_idx on public.arena_queue(game, joined_at);

alter table public.arena_matches enable row level security;
alter table public.arena_queue enable row level security;

create or replace function public.arena_seat_for(p_duo_a text, p_duo_b text default null)
returns text
language sql stable security definer set search_path = public
as $$
  select case
    when auth.uid() = a.member_a then 'A1'
    when auth.uid() = a.member_b then 'A2'
    when b.code is not null and auth.uid() = b.member_a then 'B1'
    when b.code is not null and auth.uid() = b.member_b then 'B2'
    else null
  end
  from duos a left join duos b on b.code = p_duo_b
  where a.code = p_duo_a;
$$;

create or replace function public.arena_require_duo(p_duo text)
returns void
language plpgsql security definer set search_path = public
as $$
declare d record;
begin
  select * into d from duos where code = p_duo;
  if not found then raise exception 'Duo not found'; end if;
  if auth.uid() is null or (auth.uid() <> d.member_a and auth.uid() <> d.member_b) then
    raise exception 'You are not a member of this duo';
  end if;
  if d.member_a is null or d.member_b is null then
    raise exception 'Both partners must link their accounts before entering Arena';
  end if;
end;
$$;

create or replace function public.arena_require_available(p_duo text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if exists (
    select 1 from arena_matches
    where (duo_a=p_duo or duo_b=p_duo) and status in ('waiting','ready','live')
  ) then
    raise exception 'This duo already has an active Arena match';
  end if;
end;
$$;

drop policy if exists "arena participants can read matches" on public.arena_matches;
create policy "arena participants can read matches" on public.arena_matches
  for select to authenticated
  using (public.arena_seat_for(duo_a, duo_b) is not null);

-- Queue rows are intentionally inaccessible directly. Security-definer RPCs
-- expose only the caller's state and pair couples atomically.

create or replace function public.arena_new_code()
returns text
language plpgsql volatile set search_path = public
as $$
declare c text;
begin
  loop
    c := 'A-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (select 1 from arena_matches where code = c);
  end loop;
  return c;
end;
$$;

create or replace function public.create_arena_match(
  p_duo_code text, p_game text, p_state jsonb)
returns json
language plpgsql security definer set search_path = public
as $$
declare c text; m arena_matches;
begin
  perform arena_require_duo(p_duo_code);
  perform arena_require_available(p_duo_code);
  delete from arena_queue where duo_code=p_duo_code;
  if p_game not in ('ttt','connect4','dots') then raise exception 'Unsupported Arena game'; end if;
  c := arena_new_code();
  insert into arena_matches(code, game, duo_a, state, created_by)
    values(c, p_game, p_duo_code, p_state, auth.uid()) returning * into m;
  return row_to_json(m);
end;
$$;

create or replace function public.join_arena_match(p_match_code text, p_duo_code text)
returns json
language plpgsql security definer set search_path = public
as $$
declare m arena_matches;
begin
  perform arena_require_duo(p_duo_code);
  perform arena_require_available(p_duo_code);
  delete from arena_queue where duo_code=p_duo_code;
  select * into m from arena_matches where code = upper(trim(p_match_code)) for update;
  if not found then raise exception 'Arena match not found'; end if;
  if m.status <> 'waiting' or m.duo_b is not null then raise exception 'This challenge is no longer open'; end if;
  if m.duo_a = p_duo_code then raise exception 'Choose a different duo'; end if;
  update arena_matches set duo_b = p_duo_code, status = 'ready',
    updated_at = now(), revision = revision + 1
    where code = m.code returning * into m;
  return row_to_json(m);
end;
$$;

create or replace function public.join_arena_queue(
  p_duo_code text, p_game text, p_state jsonb)
returns json
language plpgsql security definer set search_path = public
as $$
declare q arena_queue; m arena_matches; c text;
begin
  perform arena_require_duo(p_duo_code);
  perform arena_require_available(p_duo_code);
  if p_game not in ('ttt','connect4','dots') then raise exception 'Unsupported Arena game'; end if;
  delete from arena_queue where duo_code = p_duo_code;
  select * into q from arena_queue
    where game = p_game and duo_code <> p_duo_code
    order by joined_at for update skip locked limit 1;
  if not found then
    insert into arena_queue(duo_code, game, joined_by)
      values(p_duo_code, p_game, auth.uid())
      on conflict (duo_code) do update set game=excluded.game, joined_by=excluded.joined_by, joined_at=now();
    return json_build_object('queued', true);
  end if;
  delete from arena_queue where duo_code in (q.duo_code, p_duo_code);
  c := arena_new_code();
  insert into arena_matches(code, game, duo_a, duo_b, status, state, created_by)
    values(c, p_game, q.duo_code, p_duo_code, 'ready', p_state, q.joined_by)
    returning * into m;
  return json_build_object('queued', false, 'match', row_to_json(m));
end;
$$;

create or replace function public.cancel_arena_queue(p_duo_code text)
returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  perform arena_require_duo(p_duo_code);
  delete from arena_queue where duo_code = p_duo_code;
  return found;
end;
$$;

create or replace function public.arena_queue_status(p_duo_code text)
returns json
language plpgsql security definer set search_path = public
as $$
declare q arena_queue; m arena_matches;
begin
  perform arena_require_duo(p_duo_code);
  select * into m from arena_matches
    where (duo_a = p_duo_code or duo_b = p_duo_code)
      and status in ('ready','live') and created_at > now() - interval '20 minutes'
    order by created_at desc limit 1;
  if found then return json_build_object('queued', false, 'match', row_to_json(m)); end if;
  select * into q from arena_queue where duo_code = p_duo_code;
  return json_build_object('queued', found, 'game', q.game, 'joined_at', q.joined_at);
end;
$$;

create or replace function public.list_my_arena_matches()
returns json
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then return '[]'::json; end if;
  return coalesce((
    select json_agg(json_build_object(
      'code', m.code, 'game', m.game, 'duo_a', m.duo_a, 'duo_b', m.duo_b,
      'status', m.status, 'state', m.state, 'revision', m.revision,
      'winner', m.winner, 'created_at', m.created_at, 'updated_at', m.updated_at,
      'team_a', json_build_object('name_a', a.name_a, 'name_b', a.name_b, 'theme', a.theme),
      'team_b', case when b.code is null then null else
        json_build_object('name_a', b.name_a, 'name_b', b.name_b, 'theme', b.theme) end
    ) order by m.updated_at desc)
    from arena_matches m
    join duos a on a.code = m.duo_a
    left join duos b on b.code = m.duo_b
    where arena_seat_for(m.duo_a, m.duo_b) is not null
      and m.status <> 'cancelled'
  ), '[]'::json);
end;
$$;

create or replace function public.open_arena_match(p_match_code text)
returns json
language plpgsql security definer set search_path = public
as $$
declare m arena_matches; seat text; a duos; b duos;
begin
  select * into m from arena_matches where code = upper(trim(p_match_code));
  if not found then raise exception 'Arena match not found'; end if;
  seat := arena_seat_for(m.duo_a, m.duo_b);
  if seat is null then raise exception 'You are not in this match'; end if;
  select * into a from duos where code = m.duo_a;
  select * into b from duos where code = m.duo_b;
  return json_build_object(
    'match', row_to_json(m), 'seat', seat,
    'team_a', json_build_object('code', a.code, 'name_a', a.name_a, 'name_b', a.name_b, 'theme', a.theme),
    'team_b', json_build_object('code', b.code, 'name_a', b.name_a, 'name_b', b.name_b, 'theme', b.theme)
  );
end;
$$;

create or replace function public.ready_arena_seat(p_match_code text, p_expected_revision bigint)
returns json
language plpgsql security definer set search_path = public
as $$
declare m arena_matches; seat text; st jsonb; all_ready boolean;
begin
  select * into m from arena_matches where code = upper(trim(p_match_code)) for update;
  if not found then raise exception 'Arena match not found'; end if;
  if m.revision <> p_expected_revision then raise exception 'Match changed; refresh and try again'; end if;
  seat := arena_seat_for(m.duo_a, m.duo_b);
  if seat is null then raise exception 'You are not in this match'; end if;
  if m.status <> 'ready' then return row_to_json(m); end if;
  st := jsonb_set(m.state, array['ready', seat], 'true'::jsonb, true);
  all_ready := coalesce((st#>>'{ready,A1}')::boolean,false)
    and coalesce((st#>>'{ready,A2}')::boolean,false)
    and coalesce((st#>>'{ready,B1}')::boolean,false)
    and coalesce((st#>>'{ready,B2}')::boolean,false);
  if all_ready then
    st := jsonb_set(jsonb_set(st, '{phase}', '"countdown"'::jsonb),
      '{liveAt}', to_jsonb(floor(extract(epoch from clock_timestamp()) * 1000)::bigint + 3500));
  end if;
  update arena_matches set state=st, status=case when all_ready then 'live' else status end,
    revision=revision+1, updated_at=now()
    where code=m.code returning * into m;
  return row_to_json(m);
end;
$$;

create or replace function public.move_arena_match(
  p_match_code text, p_expected_revision bigint, p_state jsonb)
returns json
language plpgsql security definer set search_path = public
as $$
declare m arena_matches; seat text; next_status text; next_winner text;
begin
  select * into m from arena_matches where code = upper(trim(p_match_code)) for update;
  if not found then raise exception 'Arena match not found'; end if;
  if m.revision <> p_expected_revision then raise exception 'Someone moved first; board refreshed'; end if;
  seat := arena_seat_for(m.duo_a, m.duo_b);
  if seat is null or seat <> m.state->>'activeSeat' then raise exception 'It is not your turn'; end if;
  if m.status <> 'live' then raise exception 'Match is not live'; end if;
  if m.state->>'phase' = 'countdown'
    and coalesce((m.state->>'liveAt')::bigint,0) > floor(extract(epoch from clock_timestamp())*1000)::bigint
    then raise exception 'Countdown is still running';
  end if;
  if p_state->>'game' <> m.game then raise exception 'Game mismatch'; end if;
  next_winner := nullif(p_state->>'winner','');
  next_status := case when next_winner is not null and next_winner <> 'null' then 'done' else 'live' end;
  update arena_matches set state=p_state, status=next_status,
    winner=case when next_status='done' then next_winner else null end,
    finished_at=case when next_status='done' then now() else null end,
    revision=revision+1, updated_at=now()
    where code=m.code returning * into m;
  return row_to_json(m);
end;
$$;

create or replace function public.rematch_arena_match(
  p_match_code text, p_expected_revision bigint, p_state jsonb)
returns json
language plpgsql security definer set search_path = public
as $$
declare m arena_matches;
begin
  select * into m from arena_matches where code=upper(trim(p_match_code)) for update;
  if not found then raise exception 'Arena match not found'; end if;
  if arena_seat_for(m.duo_a,m.duo_b) is null then raise exception 'You are not in this match'; end if;
  if m.revision <> p_expected_revision then raise exception 'Match changed; refresh and try again'; end if;
  if m.status <> 'done' then raise exception 'Finish the current match first'; end if;
  update arena_matches set state=p_state,status='ready',winner=null,finished_at=null,
    revision=revision+1,updated_at=now() where code=m.code returning * into m;
  return row_to_json(m);
end;
$$;

create or replace function public.cancel_arena_match(p_match_code text)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare m arena_matches;
begin
  select * into m from arena_matches where code=upper(trim(p_match_code)) for update;
  if not found or arena_seat_for(m.duo_a,m.duo_b) is null then return false; end if;
  if m.status in ('done','cancelled') then return false; end if;
  update arena_matches set status='cancelled',revision=revision+1,updated_at=now() where code=m.code;
  return true;
end;
$$;

grant execute on function public.arena_seat_for(text,text) to authenticated;
grant execute on function public.create_arena_match(text,text,jsonb) to authenticated;
grant execute on function public.join_arena_match(text,text) to authenticated;
grant execute on function public.join_arena_queue(text,text,jsonb) to authenticated;
grant execute on function public.cancel_arena_queue(text) to authenticated;
grant execute on function public.arena_queue_status(text) to authenticated;
grant execute on function public.list_my_arena_matches() to authenticated;
grant execute on function public.open_arena_match(text) to authenticated;
grant execute on function public.ready_arena_seat(text,bigint) to authenticated;
grant execute on function public.move_arena_match(text,bigint,jsonb) to authenticated;
grant execute on function public.rematch_arena_match(text,bigint,jsonb) to authenticated;
grant execute on function public.cancel_arena_match(text) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.arena_matches;
exception when duplicate_object then null;
end $$;
