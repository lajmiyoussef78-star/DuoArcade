-- schema-v12-arena-games.sql — expand 2v2 Arena to more turn-based duo games.
-- Run once in Supabase SQL Editor (after schema-v8-arena.sql).

alter table public.arena_matches drop constraint if exists arena_matches_game_check;
alter table public.arena_matches add constraint arena_matches_game_check
  check (game in (
    'ttt','connect4','dots','gomoku','hex','nim','reversi',
    'mancala','checkers','pig','memory','race'
  ));

alter table public.arena_queue drop constraint if exists arena_queue_game_check;
alter table public.arena_queue add constraint arena_queue_game_check
  check (game in (
    'ttt','connect4','dots','gomoku','hex','nim','reversi',
    'mancala','checkers','pig','memory','race'
  ));

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
  if p_game not in (
    'ttt','connect4','dots','gomoku','hex','nim','reversi',
    'mancala','checkers','pig','memory','race'
  ) then raise exception 'Unsupported Arena game'; end if;
  c := arena_new_code();
  insert into arena_matches(code, game, duo_a, state, created_by)
    values(c, p_game, p_duo_code, p_state, auth.uid()) returning * into m;
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
  if p_game not in (
    'ttt','connect4','dots','gomoku','hex','nim','reversi',
    'mancala','checkers','pig','memory','race'
  ) then raise exception 'Unsupported Arena game'; end if;
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
