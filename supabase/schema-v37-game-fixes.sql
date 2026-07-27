-- schema-v37-game-fixes.sql — Beta "Fix" reports from game cards.
-- Run once in Supabase SQL Editor after prior schemas.

create table if not exists public.game_fix_reports (
  id          uuid primary key default gen_random_uuid(),
  duo_code    text not null references public.duos(code) on delete cascade,
  game_id     text not null,
  note        text not null,
  reported_by text not null check (reported_by in ('A', 'B')),
  reporter_id uuid references auth.users(id) on delete set null,
  status      text not null default 'open'
    check (status in ('open', 'done', 'wontfix')),
  created_at  timestamptz not null default now()
);

create index if not exists game_fix_reports_duo_game
  on public.game_fix_reports (duo_code, game_id, created_at desc);

alter table public.game_fix_reports enable row level security;

create or replace function public.game_fix_member_role(p_duo_code text)
returns text
language plpgsql stable security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  d record;
begin
  if v_uid is null then raise exception 'Sign in first'; end if;
  select * into d from duos where code = p_duo_code;
  if not found then raise exception 'Duo not found'; end if;
  if v_uid = d.member_a then return 'A'; end if;
  if d.member_b is not null and v_uid = d.member_b then return 'B'; end if;
  raise exception 'Only members of this duo can report game fixes';
end;
$$;

create or replace function public.submit_game_fix(
  p_duo_code text,
  p_game_id text,
  p_note text
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_role text;
  v_note text := left(trim(coalesce(p_note, '')), 800);
  v_game text := left(trim(coalesce(p_game_id, '')), 64);
  v_id uuid;
begin
  v_role := public.game_fix_member_role(p_duo_code);
  if v_game = '' then raise exception 'Pick a game'; end if;
  if length(v_note) < 3 then raise exception 'Describe the bug in a few words'; end if;

  insert into public.game_fix_reports (duo_code, game_id, note, reported_by, reporter_id)
  values (p_duo_code, v_game, v_note, v_role, auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.submit_game_fix(text, text, text) to authenticated;
