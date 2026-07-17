-- schema-v20-soccer.sql — DuoArcade "Micro Soccer": lifetime win tally.
-- Run once in the SQL Editor. Gameplay is realtime over a broadcast
-- channel; this table only stores the win count per duo.
--
-- SELECT policy includes `authenticated` from day one (the RLS/Realtime
-- lesson); writes go only through the security-definer function.

create table if not exists public.soccer_results (
  duo_code text primary key references public.duos(code) on delete cascade,
  wins_a   integer not null default 0,
  wins_b   integer not null default 0,
  draws    integer not null default 0
);

alter table public.soccer_results enable row level security;

create policy "soccer: duo members read"
  on public.soccer_results for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.duos d
      where d.code = duo_code
        and (auth.uid() = d.member_a or auth.uid() = d.member_b)
    )
  );

create or replace function public.record_soccer(p_duo_code text, p_winner text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  d record;
  r record;
begin
  if p_winner not in ('A','B','draw') then raise exception 'Bad winner'; end if;
  select * into d from duos where code = p_duo_code;
  if not found then raise exception 'Duo not found'; end if;
  if v_uid is null or (v_uid <> d.member_a and (d.member_b is null or v_uid <> d.member_b)) then
    raise exception 'Only members of this duo can record its games';
  end if;

  insert into soccer_results (duo_code, wins_a, wins_b, draws)
  values (p_duo_code,
          case when p_winner = 'A' then 1 else 0 end,
          case when p_winner = 'B' then 1 else 0 end,
          case when p_winner = 'draw' then 1 else 0 end)
  on conflict (duo_code) do update set
    wins_a = soccer_results.wins_a + case when p_winner = 'A' then 1 else 0 end,
    wins_b = soccer_results.wins_b + case when p_winner = 'B' then 1 else 0 end,
    draws  = soccer_results.draws  + case when p_winner = 'draw' then 1 else 0 end;

  select * into r from soccer_results where duo_code = p_duo_code;
  return json_build_object('wins_a', r.wins_a, 'wins_b', r.wins_b, 'draws', r.draws);
end;
$$;

grant execute on function public.record_soccer(text, text) to authenticated;
