-- schema-v16-anniversary.sql — one shared anniversary per duo.
-- Run once in Supabase SQL Editor (after v15).
--
-- The anniversary used to live in each browser's localStorage, so each
-- partner saw a different date and different "together for" numbers.
-- It now lives on the duo row and syncs in realtime like everything else.

alter table public.duos add column if not exists anniversary text;

-- update_duo learns the new field (otherwise unchanged from the live
-- version, which also patches show_public and theme)
create or replace function public.update_duo(
  p_code text, p_token text, p_patch jsonb,
  p_guard_turn text default null, p_force boolean default false)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  k record;
  d record;
  n integer;
  ok boolean := false;
begin
  select * into d from duos where code = p_code;
  if not found then return false; end if;
  select * into k from duo_keys where code = p_code;

  if v_uid is not null and (v_uid = d.member_a or v_uid = d.member_b) then ok := true; end if;
  if not ok and p_token is not null and k.code is not null
     and (p_token = k.host_token or p_token = k.guest_token) then ok := true; end if;
  if not ok then return false; end if;

  update duos set
    records     = coalesce(p_patch->'records', records),
    evenings    = coalesce((p_patch->>'evenings')::int, evenings),
    streak      = coalesce((p_patch->>'streak')::int, streak),
    best_streak = coalesce((p_patch->>'best_streak')::int, best_streak),
    taste_agree = coalesce((p_patch->>'taste_agree')::int, taste_agree),
    taste_total = coalesce((p_patch->>'taste_total')::int, taste_total),
    show_public = coalesce((p_patch->>'show_public')::boolean, show_public),
    theme       = coalesce(p_patch->>'theme', theme),
    last_day    = coalesce(p_patch->>'last_day', last_day),
    anniversary = coalesce(p_patch->>'anniversary', anniversary),
    session     = case
                    when p_patch->'session' = 'null'::jsonb then null
                    when p_patch ? 'session' then p_patch->'session'
                    else session
                  end,
    turn        = coalesce(p_patch->>'turn', turn)
  where code = p_code
    and (p_force or p_guard_turn is null or turn = p_guard_turn);
  get diagnostics n = row_count;
  return n > 0;
end;
$$;
