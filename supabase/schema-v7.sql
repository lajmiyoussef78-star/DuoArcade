-- schema-v7.sql — THE ROOT-CAUSE FIX for invitations never arriving.
-- Run this once in the SQL Editor.
--
-- What was wrong: the read policy on `duos` only granted the `anon` role
-- (schema-v2.sql). Once accounts existed (schema-v4), signed-in clients
-- authenticate as the `authenticated` role for RLS purposes — which had
-- NO read policy at all. Two consequences, both silent:
--   1. Supabase Realtime enforces RLS before broadcasting postgres_changes,
--      so signed-in users never received live updates on their duo —
--      including incoming invitations.
--   2. The polling fallback (a direct table read) failed the same RLS
--      check, so it couldn't rescue the situation either.
-- Guests who never sign in (pure anon role) were unaffected, which is why
-- earlier local testing could look fine while real signed-in accounts
-- never got the popup.

drop policy if exists "phase1: read duos" on public.duos;
create policy "phase1: read duos" on public.duos
  for select to anon, authenticated using (true);
