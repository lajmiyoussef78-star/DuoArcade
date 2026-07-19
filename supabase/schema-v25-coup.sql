-- schema-v25-coup.sql — DuoArcade "Coup: Köln Edition": lifetime tally.
-- Run once in the SQL Editor. The game itself is lockstep over a broadcast
-- channel; this table only stores wins per duo.

create table if not exists public.coup_results (
  duo_code text primary key references public.duos(code) on delete cascade,
  wins_a   integer not null default 0,
  wins_b   integer not null default 0
);

alter table public.coup_results enable row level security;

create policy "coup: duo members read"
  on public.coup_results for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.duos d
      where d.code = duo_code
        and (auth.uid() = d.member_a or auth.uid() = d.member_b)
    )
  );

create or replace function public.record_coup(p_duo_code text, p_winner text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  d record;
  r record;
begin
  if p_winner not in ('A','B') then raise exception 'Bad winner'; end if;
  select * into d from duos where code = p_duo_code;
  if not found then raise exception 'Duo not found'; end if;
  if v_uid is null or (v_uid <> d.member_a and (d.member_b is null or v_uid <> d.member_b)) then
    raise exception 'Only members of this duo can record its games';
  end if;

  insert into coup_results (duo_code, wins_a, wins_b)
  values (p_duo_code,
          case when p_winner = 'A' then 1 else 0 end,
          case when p_winner = 'B' then 1 else 0 end)
  on conflict (duo_code) do update set
    wins_a = coup_results.wins_a + case when p_winner = 'A' then 1 else 0 end,
    wins_b = coup_results.wins_b + case when p_winner = 'B' then 1 else 0 end;

  select * into r from coup_results where duo_code = p_duo_code;
  return json_build_object('wins_a', r.wins_a, 'wins_b', r.wins_b);
end;
$$;

grant execute on function public.record_coup(text, text) to authenticated;
