-- schema-v30-stake-winner-confirms.sql — winner (not host) confirms stake fulfillment.
-- Run in Supabase SQL Editor if you already applied schema-v29-challenge-history.sql.

drop function if exists public.set_stake_fulfilled(bigint, boolean);

create or replace function public.set_stake_fulfilled(
  p_id bigint, p_fulfilled boolean)
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
  if c.status <> 'done' then raise exception 'Challenge is not finished'; end if;
  if c.overall_winner is null then raise exception 'Challenge has no winner'; end if;

  v_role := public._chal_role(c.duo_code);
  if v_role is null then raise exception 'Only members can update stake fulfillment'; end if;
  if v_role <> c.overall_winner then
    raise exception 'Only the challenge winner can confirm stake fulfillment';
  end if;

  update challenges set
    stake_fulfilled = coalesce(p_fulfilled, false),
    stake_fulfilled_at = case when coalesce(p_fulfilled, false) then now() else null end
  where id = p_id
  returning * into r;

  return row_to_json(r);
end;
$$;

grant execute on function public.set_stake_fulfilled(bigint, boolean) to authenticated;
