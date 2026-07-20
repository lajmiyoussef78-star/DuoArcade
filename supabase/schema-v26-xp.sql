-- schema-v26-xp.sql — DuoArcade shared duo XP, levels, and leaderboard.
-- Run once in the Supabase SQL Editor.

create table if not exists public.xp_events (
  id         bigint generated always as identity primary key,
  duo_code   text not null references public.duos(code) on delete cascade,
  game_id    text not null,
  xp         int  not null,
  day        date not null,
  created_at timestamptz not null default now()
);

create index if not exists xp_events_duo_game_day_idx
  on public.xp_events (duo_code, game_id, day);

alter table public.xp_events enable row level security;

drop policy if exists "xp_events: duo members read" on public.xp_events;
create policy "xp_events: duo members read"
  on public.xp_events for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.duos d
      where d.code = duo_code
        and (auth.uid() = d.member_a or auth.uid() = d.member_b)
    )
  );

-- Award 10 XP for a finished match (first 5 per game per Europe/Berlin day).
create or replace function public.award_duo_xp(p_duo_code text, p_game_id text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  d record;
  v_day date;
  v_today int;
  v_total int;
begin
  if p_duo_code is null or length(trim(p_duo_code)) = 0 then
    raise exception 'Missing duo code';
  end if;
  if p_game_id is null or length(trim(p_game_id)) = 0 then
    raise exception 'Missing game id';
  end if;

  select * into d from duos where code = p_duo_code;
  if not found then raise exception 'Duo not found'; end if;
  if v_uid is null or (v_uid <> d.member_a and (d.member_b is null or v_uid <> d.member_b)) then
    raise exception 'Only members of this duo can award its XP';
  end if;

  v_day := (now() at time zone 'Europe/Berlin')::date;

  select count(*)::int into v_today
  from xp_events
  where duo_code = p_duo_code
    and game_id = p_game_id
    and day = v_day;

  select coalesce(sum(xp), 0)::int into v_total
  from xp_events
  where duo_code = p_duo_code;

  if v_today >= 5 then
    return json_build_object(
      'awarded', false,
      'reason', 'daily-cap',
      'total_xp', v_total,
      'today_for_game', v_today,
      'game_id', p_game_id,
      'day', v_day
    );
  end if;

  insert into xp_events (duo_code, game_id, xp, day)
  values (p_duo_code, p_game_id, 10, v_day);

  v_today := v_today + 1;
  v_total := v_total + 10;

  return json_build_object(
    'awarded', true,
    'total_xp', v_total,
    'today_for_game', v_today,
    'game_id', p_game_id,
    'day', v_day
  );
end;
$$;

grant execute on function public.award_duo_xp(text, text) to authenticated;

-- Caller's duo XP detail (member-checked). Never returns other duos' codes.
create or replace function public.get_my_xp(p_duo_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  d record;
  v_day date;
  v_total int;
  v_today json;
begin
  select * into d from duos where code = p_duo_code;
  if not found then raise exception 'Duo not found'; end if;
  if v_uid is null or (v_uid <> d.member_a and (d.member_b is null or v_uid <> d.member_b)) then
    raise exception 'Only members of this duo can read its XP';
  end if;

  v_day := (now() at time zone 'Europe/Berlin')::date;

  select coalesce(sum(xp), 0)::int into v_total
  from xp_events
  where duo_code = p_duo_code;

  select coalesce(json_object_agg(game_id, cnt), '{}'::json) into v_today
  from (
    select game_id, count(*)::int as cnt
    from xp_events
    where duo_code = p_duo_code and day = v_day
    group by game_id
  ) t;

  return json_build_object(
    'total_xp', v_total,
    'today_by_game', v_today,
    'day', v_day,
    'name_a', d.name_a,
    'name_b', d.name_b
  );
end;
$$;

grant execute on function public.get_my_xp(text) to authenticated;

-- Global leaderboard. Returns names / totals / ranks — NEVER duo codes.
-- Level + title are computed client-side from total_xp via pure helpers.
create or replace function public.get_xp_leaderboard(p_limit int default 50)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_limit int := greatest(1, least(coalesce(p_limit, 50), 100));
  v_board json;
  v_me json;
  v_my_code text;
  v_my_xp int;
  v_my_rank int;
  v_name_a text;
  v_name_b text;
begin
  if v_uid is null then
    raise exception 'Sign in to view the leaderboard';
  end if;

  with totals as (
    select e.duo_code, coalesce(sum(e.xp), 0)::int as total_xp
    from xp_events e
    group by e.duo_code
  ),
  ranked as (
    select
      rank() over (order by t.total_xp desc, d.name_a asc, d.name_b asc) as rank,
      d.name_a,
      d.name_b,
      t.total_xp
    from totals t
    join duos d on d.code = t.duo_code
  )
  select coalesce(json_agg(row_to_json(x) order by x.rank), '[]'::json)
  into v_board
  from (
    select rank, name_a, name_b, total_xp
    from ranked
    order by rank
    limit v_limit
  ) x;

  select d.code, d.name_a, d.name_b
  into v_my_code, v_name_a, v_name_b
  from duos d
  where d.member_a = v_uid or d.member_b = v_uid
  limit 1;

  if v_my_code is not null then
    select coalesce(sum(xp), 0)::int into v_my_xp
    from xp_events
    where duo_code = v_my_code;

    -- Rank = 1 + number of duos with strictly more XP
    -- (ties share the same display rank via dense-ish rank matching board).
    select (1 + count(*)::int) into v_my_rank
    from (
      select e.duo_code, sum(e.xp)::int as total_xp
      from xp_events e
      group by e.duo_code
      having sum(e.xp) > v_my_xp
    ) better;

    if v_my_xp = 0 then
      -- No events yet: still show the duo at the bottom of the pack.
      select (1 + count(*)::int) into v_my_rank
      from (
        select e.duo_code from xp_events e group by e.duo_code
      ) anyone;
    end if;

    v_me := json_build_object(
      'rank', v_my_rank,
      'name_a', v_name_a,
      'name_b', v_name_b,
      'total_xp', v_my_xp,
      'is_mine', true
    );
  else
    v_me := null;
  end if;

  return json_build_object(
    'board', v_board,
    'me', v_me
  );
end;
$$;

grant execute on function public.get_xp_leaderboard(int) to authenticated;
