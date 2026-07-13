-- schema-v9-whiteboard.sql — DuoArcade shared whiteboard.
-- Run once in the SQL Editor (after your existing schemas).
--
-- One whiteboard per duo. Live strokes travel over a broadcast channel
-- (no DB writes per stroke); the full board is SAVED here so the drawing
-- persists across reloads — like a fridge door you both doodle on.
--
-- The RLS lesson is applied from day one: SELECT policy explicitly covers
-- the `authenticated` role, since Realtime enforces RLS before delivering
-- anything and signed-in users are `authenticated`, not `anon`.

create table if not exists public.whiteboards (
  duo_code   text primary key references public.duos(code) on delete cascade,
  strokes    jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

alter table public.whiteboards enable row level security;

create policy "whiteboards: duo members read"
  on public.whiteboards for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.duos d
      where d.code = duo_code
        and (auth.uid() = d.member_a or auth.uid() = d.member_b)
    )
  );

-- Writes only via the function below (no direct insert/update grants).

create or replace function public.save_whiteboard(p_duo_code text, p_strokes jsonb)
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
    raise exception 'Only members of this duo can draw on its whiteboard';
  end if;
  -- keep boards from growing unbounded: cap stroke count server-side
  if jsonb_array_length(p_strokes) > 4000 then
    raise exception 'This board is full — clear it to keep drawing';
  end if;

  insert into whiteboards (duo_code, strokes, updated_at)
  values (p_duo_code, p_strokes, now())
  on conflict (duo_code) do update set strokes = p_strokes, updated_at = now();
  return true;
end;
$$;

grant execute on function public.save_whiteboard(text, jsonb) to authenticated;
