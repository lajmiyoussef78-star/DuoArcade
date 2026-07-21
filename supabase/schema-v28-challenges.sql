-- schema-v28-challenges.sql — DuoArcade Challenges (best-of-3 + stake).
-- Run once in the Supabase SQL Editor.

create table if not exists public.challenges (
  id             bigint generated always as identity primary key,
  duo_code       text not null references public.duos(code) on delete cascade,
  created_by     text not null check (created_by in ('A','B')),
  stake          text not null check (char_length(stake) between 1 and 140),
  game1          text not null,
  game2          text,
  game3          text,
  win1           text check (win1 in ('A','B')),
  win2           text check (win2 in ('A','B')),
  win3           text check (win3 in ('A','B')),
  status         text not null default 'pending'
                   check (status in ('pending','active','done','declined','cancelled')),
  overall_winner text check (overall_winner in ('A','B')),
  created_at     timestamptz default now(),
  resolved_at    timestamptz
);

create index if not exists challenges_duo_status_idx
  on public.challenges (duo_code, status);

alter table public.challenges enable row level security;

drop policy if exists "challenges: members read" on public.challenges;
create policy "challenges: members read"
  on public.challenges for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.duos d
      where d.code = duo_code
        and (d.member_a = auth.uid() or d.member_b = auth.uid())
    )
  );

-- Role of caller in duo, or null.
-- Drop first: CREATE OR REPLACE cannot change return type (42P13).
drop function if exists public.create_challenge(text, text, text);
drop function if exists public.respond_challenge(bigint, boolean, text, text);
drop function if exists public.set_challenge_result(bigint, int, text);
drop function if exists public.cancel_challenge(bigint);
drop function if exists public.get_challenges(text);
drop function if exists public._chal_role(text);

create or replace function public._chal_role(p_duo_code text)
returns text
language plpgsql stable security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  d record;
begin
  if v_uid is null then return null; end if;
  select * into d from duos where code = p_duo_code;
  if not found then return null; end if;
  if v_uid = d.member_a then return 'A'; end if;
  if d.member_b is not null and v_uid = d.member_b then return 'B'; end if;
  return null;
end;
$$;

create or replace function public.create_challenge(
  p_duo_code text, p_stake text, p_game1 text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_role text;
  v_stake text := trim(p_stake);
  r record;
begin
  v_role := public._chal_role(p_duo_code);
  if v_role is null then raise exception 'Only members of this duo can create a challenge'; end if;
  if v_stake is null or char_length(v_stake) < 1 or char_length(v_stake) > 140 then
    raise exception 'Stake must be 1–140 characters';
  end if;
  if p_game1 is null or char_length(trim(p_game1)) < 1 then
    raise exception 'Pick Game 1';
  end if;
  if exists (
    select 1 from challenges
    where duo_code = p_duo_code and status in ('pending','active')
  ) then
    raise exception 'A challenge is already pending or active for this duo';
  end if;

  insert into challenges (duo_code, created_by, stake, game1, status)
  values (p_duo_code, v_role, v_stake, trim(p_game1), 'pending')
  returning * into r;

  return row_to_json(r);
end;
$$;

grant execute on function public.create_challenge(text, text, text) to authenticated;

create or replace function public.respond_challenge(
  p_id bigint, p_accept boolean, p_game2 text default null, p_game3 text default null)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  c record;
  v_role text;
  r record;
begin
  select * into c from challenges where id = p_id;
  if not found then raise exception 'Challenge not found'; end if;
  if c.status <> 'pending' then raise exception 'Challenge is not pending'; end if;

  v_role := public._chal_role(c.duo_code);
  if v_role is null then raise exception 'Only members of this duo can respond'; end if;
  if v_role = c.created_by then raise exception 'Creator cannot respond to their own challenge'; end if;

  if not p_accept then
    update challenges set status = 'declined', resolved_at = now()
    where id = p_id returning * into r;
    return row_to_json(r);
  end if;

  if p_game2 is null or char_length(trim(p_game2)) < 1 then
    raise exception 'Pick Game 2 to accept';
  end if;
  if trim(p_game2) = c.game1 then
    raise exception 'Game 2 must differ from Game 1';
  end if;
  if p_game3 is null or char_length(trim(p_game3)) < 1 then
    raise exception 'Fate pick (Game 3) is required';
  end if;
  if trim(p_game3) = c.game1 or trim(p_game3) = trim(p_game2) then
    raise exception 'Game 3 must differ from Games 1 and 2';
  end if;

  update challenges set
    game2 = trim(p_game2),
    game3 = trim(p_game3),
    status = 'active'
  where id = p_id
  returning * into r;

  return row_to_json(r);
end;
$$;

grant execute on function public.respond_challenge(bigint, boolean, text, text) to authenticated;

create or replace function public.set_challenge_result(
  p_id bigint, p_slot int, p_winner text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  c record;
  v_role text;
  w1 text; w2 text; w3 text;
  oa int := 0; ob int := 0;
  ow text := null;
  r record;
begin
  select * into c from challenges where id = p_id;
  if not found then raise exception 'Challenge not found'; end if;
  if c.status <> 'active' then raise exception 'Challenge is not active'; end if;

  v_role := public._chal_role(c.duo_code);
  if v_role is null then raise exception 'Only members can record results'; end if;
  if p_winner is null or p_winner not in ('A','B') then
    raise exception 'Winner must be A or B';
  end if;
  if p_slot not in (1, 2, 3) then raise exception 'Slot must be 1, 2, or 3'; end if;

  w1 := c.win1; w2 := c.win2; w3 := c.win3;
  if p_slot = 1 then w1 := p_winner;
  elsif p_slot = 2 then w2 := p_winner;
  else w3 := p_winner;
  end if;

  if w1 = 'A' then oa := oa + 1; elsif w1 = 'B' then ob := ob + 1; end if;
  if w2 = 'A' then oa := oa + 1; elsif w2 = 'B' then ob := ob + 1; end if;
  if w3 = 'A' then oa := oa + 1; elsif w3 = 'B' then ob := ob + 1; end if;
  if oa >= 2 then ow := 'A'; elsif ob >= 2 then ow := 'B'; end if;

  update challenges set
    win1 = w1, win2 = w2, win3 = w3,
    overall_winner = ow,
    status = case when ow is not null then 'done' else status end,
    resolved_at = case when ow is not null then now() else resolved_at end
  where id = p_id
  returning * into r;

  return row_to_json(r);
end;
$$;

grant execute on function public.set_challenge_result(bigint, int, text) to authenticated;

create or replace function public.cancel_challenge(p_id bigint)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  c record;
  v_role text;
  r record;
begin
  select * into c from challenges where id = p_id;
  if not found then raise exception 'Challenge not found'; end if;

  v_role := public._chal_role(c.duo_code);
  if v_role is null then raise exception 'Only members can cancel'; end if;

  if c.status = 'pending' then
    if v_role <> c.created_by then
      raise exception 'Only the creator can cancel a pending challenge';
    end if;
  elsif c.status = 'active' then
    null; -- either member
  else
    raise exception 'Challenge cannot be cancelled';
  end if;

  update challenges set status = 'cancelled', resolved_at = now()
  where id = p_id returning * into r;
  return row_to_json(r);
end;
$$;

grant execute on function public.cancel_challenge(bigint) to authenticated;

create or replace function public.get_challenges(p_duo_code text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_role text;
begin
  v_role := public._chal_role(p_duo_code);
  if v_role is null then raise exception 'Only members can list challenges'; end if;
  return coalesce((
    select json_agg(row_to_json(t))
    from (
      select * from challenges where duo_code = p_duo_code
      order by created_at desc
    ) t
  ), '[]'::json);
end;
$$;

grant execute on function public.get_challenges(text) to authenticated;
