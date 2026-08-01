-- Public duo profile for leaderboard clicks (stats only — never duo codes).

create or replace function public.get_public_duo(
  p_username text,
  p_name_a text,
  p_name_b text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  pr record;
  d record;
begin
  select * into pr from profiles where username = lower(trim(p_username));
  if not found then
    raise exception 'User not found';
  end if;

  select * into d
  from duos
  where show_public
    and (member_a = pr.id or member_b = pr.id)
    and name_a = trim(p_name_a)
    and name_b = trim(p_name_b)
  limit 1;

  if not found then
    raise exception 'This duo is private or was not found';
  end if;

  return json_build_object(
    'name_a', d.name_a,
    'name_b', d.name_b,
    'records', coalesce(d.records, '{}'::jsonb),
    'evenings', d.evenings,
    'streak', d.streak,
    'best_streak', d.best_streak,
    'taste_agree', d.taste_agree,
    'taste_total', d.taste_total,
    'theme', d.theme,
    'show_public', true
  );
end;
$$;

grant execute on function public.get_public_duo(text, text, text) to anon, authenticated;
