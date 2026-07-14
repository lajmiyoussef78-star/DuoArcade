-- schema-v10-snaps.sql — DuoArcade "Today's snap": one instant photo from
-- each of you per day, combined into a keepsake. Run once in SQL Editor.
--
-- Design:
--   * One row per duo per day. Each member's photo goes in their column;
--     the server decides which column from auth.uid() — the client can
--     never write into the partner's slot.
--   * When BOTH photos exist for the day, the duo's streak advances —
--     the SAME streak columns your games use (last_day/streak/best_streak/
--     evenings), so snaps and game nights feed one shared ritual. The
--     server guards it: one streak bump per day, no matter how many
--     retakes happen.
--   * Photos are stored as compressed JPEG data-URLs (~40-80KB each),
--     capped server-side. Simple and fine at this scale; if the app grows
--     big, migrate to Supabase Storage buckets later.
--   * SELECT policy includes `authenticated` (the RLS/Realtime lesson).

create table if not exists public.photo_moments (
  duo_code  text not null references public.duos(code) on delete cascade,
  day       text not null,               -- YYYY-MM-DD, the couple's local day
  photo_a   text,
  photo_b   text,
  at_a      timestamptz,
  at_b      timestamptz,
  primary key (duo_code, day)
);

alter table public.photo_moments enable row level security;

create policy "snaps: duo members read"
  on public.photo_moments for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.duos d
      where d.code = duo_code
        and (auth.uid() = d.member_a or auth.uid() = d.member_b)
    )
  );

-- Writes only through this function.
create or replace function public.save_snap(p_duo_code text, p_day text, p_photo text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  d record;
  v_role text;
  m record;
  v_both boolean;
  v_new_streak int;
begin
  if p_day !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Bad day format'; end if;
  if length(p_photo) > 220000 then raise exception 'Photo too large'; end if;
  if p_photo not like 'data:image/jpeg;base64,%' then raise exception 'Only camera JPEGs are accepted'; end if;

  select * into d from duos where code = p_duo_code;
  if not found then raise exception 'Duo not found'; end if;
  if v_uid = d.member_a then v_role := 'A';
  elsif v_uid is not null and v_uid = d.member_b then v_role := 'B';
  else raise exception 'Only members of this duo can add its photos'; end if;

  insert into photo_moments (duo_code, day, photo_a, photo_b, at_a, at_b)
  values (
    p_duo_code, p_day,
    case when v_role = 'A' then p_photo end,
    case when v_role = 'B' then p_photo end,
    case when v_role = 'A' then now() end,
    case when v_role = 'B' then now() end
  )
  on conflict (duo_code, day) do update set
    photo_a = case when v_role = 'A' then excluded.photo_a else photo_moments.photo_a end,
    photo_b = case when v_role = 'B' then excluded.photo_b else photo_moments.photo_b end,
    at_a    = case when v_role = 'A' then now() else photo_moments.at_a end,
    at_b    = case when v_role = 'B' then now() else photo_moments.at_b end;

  select * into m from photo_moments where duo_code = p_duo_code and day = p_day;
  v_both := m.photo_a is not null and m.photo_b is not null;

  -- Both photos in -> today counts as an evening; streak advances once.
  if v_both and (d.last_day is distinct from p_day) then
    v_new_streak := case
      when d.last_day = to_char((p_day::date - 1), 'YYYY-MM-DD') then coalesce(d.streak, 0) + 1
      else 1
    end;
    update duos set
      evenings    = coalesce(evenings, 0) + 1,
      streak      = v_new_streak,
      best_streak = greatest(coalesce(best_streak, 0), v_new_streak),
      last_day    = p_day
    where code = p_duo_code;
  end if;

  return json_build_object('both', v_both, 'role', v_role);
end;
$$;

grant execute on function public.save_snap(text, text, text) to authenticated;
