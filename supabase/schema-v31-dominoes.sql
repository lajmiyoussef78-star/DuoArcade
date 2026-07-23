-- Optional log table. DuoArcade shelves wins via the shared duo-record /
-- onFinish path (same as stickman local games), so this migration is NOT
-- required to play. Apply only if you want a dedicated match history later.
--
-- schema-v31-dominoes.sql
-- DominoDuel · match results for the duo record ("3-0" on the game card)
--
-- NOTE: adapt couple_id / RLS to match schema-v20-chkobba.sql conventions
-- if you decide to enable this table.

create table if not exists public.dominoes_matches (
  id           uuid primary key default gen_random_uuid(),
  couple_id    uuid,                       -- FK to the couples/duo table used by other games
  winner_slot  smallint not null check (winner_slot in (0, 1)), -- 0 = player A, 1 = player B
  score_a      integer  not null,
  score_b      integer  not null,
  rounds_a     integer  not null,
  rounds_b     integer  not null,
  played_at    timestamptz not null default now()
);

create index if not exists dominoes_matches_couple_idx
  on public.dominoes_matches (couple_id, played_at desc);

alter table public.dominoes_matches enable row level security;

-- RLS: copy the per-couple select/insert policies used by the other game
-- result tables in this repo (members of the couple can read and insert
-- their own matches).
