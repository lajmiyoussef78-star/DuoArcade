-- schema-v17-timetable.sql — DuoArcade "Our Week": shared weekly timetable.
-- Run once in Supabase SQL Editor.

create table if not exists public.timetables (
  duo_code   text primary key references public.duos(code) on delete cascade,
  events     jsonb not null default '[]',
  settings   jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.timetables enable row level security;

drop policy if exists "timetables: duo members read" on public.timetables;
create policy "timetables: duo members read"
  on public.timetables for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.duos d
      where d.code = duo_code
        and (auth.uid() = d.member_a or auth.uid() = d.member_b)
    )
  );

create or replace function public.save_timetable(
  p_duo_code text, p_events jsonb default null, p_settings jsonb default null)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  d record;
begin
  select * into d from duos where code = p_duo_code;
  if not found then raise exception 'Duo not found'; end if;
  if v_uid is null or (v_uid <> d.member_a and (d.member_b is null or v_uid <> d.member_b)) then
    raise exception 'Only members of this duo can edit its week';
  end if;
  if p_events is not null and jsonb_array_length(p_events) > 300 then
    raise exception 'That is a very full week — 300 events max';
  end if;

  insert into timetables (duo_code, events, settings, updated_at)
  values (p_duo_code, coalesce(p_events, '[]'::jsonb), coalesce(p_settings, '{}'::jsonb), now())
  on conflict (duo_code) do update set
    events     = coalesce(p_events, timetables.events),
    settings   = coalesce(p_settings, timetables.settings),
    updated_at = now();
  return true;
end;
$$;

grant execute on function public.save_timetable(text, jsonb, jsonb) to authenticated;
