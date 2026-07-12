-- schema-v2.sql — DuoArcade Phase 1: the duos table.
-- Run ONCE in Supabase: SQL Editor -> New query -> paste everything -> Run.
-- Safe to run on your existing project; it doesn't touch the old rooms table.
-- (You can delete the old spike table afterwards with: drop table public.rooms;)

create table if not exists public.duos (
  code         text primary key,
  name_a       text not null,
  name_b       text not null,
  guest_token  text not null,
  records      jsonb not null default '{}',
  evenings     integer not null default 0,
  last_day     text,
  session      jsonb,
  turn         text not null default '-',
  created_at   timestamptz not null default now()
);

alter publication supabase_realtime add table public.duos;

alter table public.duos enable row level security;

-- Same deliberately-loose MVP posture as the spike: fine while it's just the
-- two of you; move to server-authoritative (Edge Function) before strangers
-- can find the URL.
create policy "phase1: create duos" on public.duos for insert to anon with check (true);
create policy "phase1: read duos"   on public.duos for select to anon using (true);
create policy "phase1: update duos" on public.duos for update to anon using (true);
