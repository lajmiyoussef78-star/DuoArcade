-- Leaderboard may expose public member usernames (never duo codes).
-- Used so clicking a public duo on /app/leaderboard opens their profile.

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
  v_show_public boolean;
  v_username_a text;
  v_username_b text;
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
      t.total_xp,
      d.show_public,
      case when d.show_public then pa.username else null end as username_a,
      case when d.show_public then pb.username else null end as username_b
    from totals t
    join duos d on d.code = t.duo_code
    left join profiles pa on pa.id = d.member_a
    left join profiles pb on pb.id = d.member_b
  )
  select coalesce(json_agg(row_to_json(x) order by x.rank), '[]'::json)
  into v_board
  from (
    select rank, name_a, name_b, total_xp, show_public, username_a, username_b
    from ranked
    order by rank
    limit v_limit
  ) x;

  select d.code, d.name_a, d.name_b, d.show_public,
         case when d.show_public then pa.username else null end,
         case when d.show_public then pb.username else null end
  into v_my_code, v_name_a, v_name_b, v_show_public, v_username_a, v_username_b
  from duos d
  left join profiles pa on pa.id = d.member_a
  left join profiles pb on pb.id = d.member_b
  where d.member_a = v_uid or d.member_b = v_uid
  limit 1;

  if v_my_code is not null then
    select coalesce(sum(xp), 0)::int into v_my_xp
    from xp_events
    where duo_code = v_my_code;

    select (1 + count(*)::int) into v_my_rank
    from (
      select e.duo_code, sum(e.xp)::int as total_xp
      from xp_events e
      group by e.duo_code
      having sum(e.xp) > v_my_xp
    ) better;

    if v_my_xp = 0 then
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
      'is_mine', true,
      'show_public', coalesce(v_show_public, false),
      'username_a', v_username_a,
      'username_b', v_username_b
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
