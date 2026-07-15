-- schema-v13-presence.sql — DB-backed presence heartbeat.
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.
--
-- Why: the online dot used ONLY Supabase Realtime presence (websocket
-- broadcast). When that silently fails, partners never light up for each
-- other even though both are on the site. This adds a plain-Postgres
-- fallback: each member upserts a "last seen" row every ~10s and the app
-- polls it. Someone is online if their row is fresh (<35s old).

create table if not exists public.duo_presence (
  duo_code  text not null references public.duos(code) on delete cascade,
  role      text not null check (role in ('A','B')),
  place     text,
  lat       double precision,
  lng       double precision,
  last_seen timestamptz not null default now(),
  primary key (duo_code, role)
);

alter table public.duo_presence enable row level security;

drop policy if exists "presence: duo members read" on public.duo_presence;
create policy "presence: duo members read"
  on public.duo_presence for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.duos d
      where d.code = duo_code
        and (auth.uid() = d.member_a or auth.uid() = d.member_b)
    )
  );

-- Writes only through this function; the server decides which role's row
-- gets touched from auth.uid(), so you can never spoof your partner.
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
begin
  select * into d from duos where code = p_duo_code;
  if not found then raise exception 'Duo not found'; end if;
  if v_uid = d.member_a then v_role := 'A';
  elsif v_uid is not null and v_uid = d.member_b then v_role := 'B';
  else raise exception 'Only duo members can report presence'; end if;

  insert into duo_presence (duo_code, role, place, lat, lng, last_seen)
  values (p_duo_code, v_role, p_place, p_lat, p_lng, now())
  on conflict (duo_code, role) do update set
    place     = coalesce(excluded.place, duo_presence.place),
    lat       = coalesce(excluded.lat,   duo_presence.lat),
    lng       = coalesce(excluded.lng,   duo_presence.lng),
    last_seen = now();
end;
$$;

grant execute on function public.presence_beat(text, text, double precision, double precision) to authenticated;

-- Graceful goodbye: called with fetch keepalive on page close so the
-- partner dims instantly instead of waiting for the freshness timeout.
create or replace function public.presence_leave(p_duo_code text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  d record;
  v_role text;
begin
  select * into d from duos where code = p_duo_code;
  if not found then return; end if;
  if v_uid = d.member_a then v_role := 'A';
  elsif v_uid is not null and v_uid = d.member_b then v_role := 'B';
  else return; end if;

  update duo_presence set last_seen = now() - interval '1 hour'
  where duo_code = p_duo_code and role = v_role;
end;
$$;

grant execute on function public.presence_leave(text) to authenticated;
