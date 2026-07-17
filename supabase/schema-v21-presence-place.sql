-- schema-v21-presence-place.sql — clear stale city names when someone moves.
-- Run once in Supabase SQL Editor.
--
-- Bug: presence_beat used coalesce(excluded.place, old.place), so a move
-- from Tunisia → Aachen kept "Tunisia" until a non-null place arrived — and
-- if geocode lagged / GPS was cached, the old city stuck forever.

create or replace function public.presence_beat(
  p_duo_code text, p_place text, p_lat double precision, p_lng double precision
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  d record;
  v_role text;
  old_lat double precision;
  old_lng double precision;
  moved boolean;
begin
  select * into d from duos where code = p_duo_code;
  if not found then raise exception 'Duo not found'; end if;
  if v_uid = d.member_a then v_role := 'A';
  elsif v_uid is not null and v_uid = d.member_b then v_role := 'B';
  else raise exception 'Only duo members can report presence'; end if;

  select lat, lng into old_lat, old_lng
  from duo_presence where duo_code = p_duo_code and role = v_role;

  -- ~0.03° ≈ 3km — treat as a real move, drop the old city name.
  moved := p_lat is not null and p_lng is not null and (
    old_lat is null or old_lng is null
    or abs(p_lat - old_lat) > 0.03
    or abs(p_lng - old_lng) > 0.03
  );

  insert into duo_presence (duo_code, role, place, lat, lng, last_seen)
  values (p_duo_code, v_role, p_place, p_lat, p_lng, now())
  on conflict (duo_code, role) do update set
    place = case
      when excluded.place is not null then excluded.place
      when moved then null
      else duo_presence.place
    end,
    lat = coalesce(excluded.lat, duo_presence.lat),
    lng = coalesce(excluded.lng, duo_presence.lng),
    last_seen = now();
end;
$$;

grant execute on function public.presence_beat(text, text, double precision, double precision) to authenticated;
