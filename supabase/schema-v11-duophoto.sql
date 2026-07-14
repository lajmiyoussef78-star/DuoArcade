-- schema-v11-duophoto.sql — DuoArcade daily instant duo photos.
-- Run once in the SQL Editor (after your existing schemas).
--
-- One row per duo. State resets daily on the client; stores today's
-- camera captures (jpeg data urls) for A and B.

create table if not exists public.duo_photos (
  duo_code   text primary key references public.duos(code) on delete cascade,
  state      jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.duo_photos enable row level security;

create policy "duo_photos: duo members read"
  on public.duo_photos for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.duos d
      where d.code = duo_code
        and (auth.uid() = d.member_a or auth.uid() = d.member_b)
    )
  );

create or replace function public.save_duo_photos(p_duo_code text, p_state jsonb)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  d record;
  v_a text;
  v_b text;
begin
  select * into d from duos where code = p_duo_code;
  if not found then raise exception 'Duo not found'; end if;
  if v_uid is null or (v_uid <> d.member_a and (d.member_b is null or v_uid <> d.member_b)) then
    raise exception 'Only members of this duo can save photos';
  end if;

  v_a := p_state->'photos'->'A'->>'data';
  v_b := p_state->'photos'->'B'->>'data';
  if v_a is not null and length(v_a) > 600000 then
    raise exception 'Photo A is too large';
  end if;
  if v_b is not null and length(v_b) > 600000 then
    raise exception 'Photo B is too large';
  end if;

  insert into duo_photos (duo_code, state, updated_at)
  values (p_duo_code, p_state, now())
  on conflict (duo_code) do update set state = p_state, updated_at = now();
  return true;
end;
$$;

grant execute on function public.save_duo_photos(text, jsonb) to authenticated;
