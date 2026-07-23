-- Optional log table. DuoArcade shelves wins via the shared duo-record /
-- onFinish path (same as other local games), so this migration is NOT
-- required to play. Apply only if you want a dedicated match history later.
--
-- schema-v32-wordgrid.sql
-- WordGrid · match results for the duo record on the game card

create table if not exists public.wordgrid_matches (
  id           uuid primary key default gen_random_uuid(),
  couple_id    uuid,
  winner_slot  smallint check (winner_slot in (0, 1)),  -- null = tie
  score_a      integer  not null,
  score_b      integer  not null,
  grid         text     not null,
  words_a      jsonb    not null default '[]'::jsonb,
  words_b      jsonb    not null default '[]'::jsonb,
  played_at    timestamptz not null default now()
);

create index if not exists wordgrid_matches_couple_idx
  on public.wordgrid_matches (couple_id, played_at desc);

alter table public.wordgrid_matches enable row level security;
