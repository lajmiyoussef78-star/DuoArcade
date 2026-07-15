-- schema-v15-lock-duo.sql — lock the duo to its two accounts.
-- Run once in Supabase SQL Editor (after v14).
--
-- Once BOTH seats are claimed by accounts:
--   * open_duo only answers to those two accounts — the invite link is dead.
--   * The duo_keys row (host + guest tokens) is deleted outright, so no
--     token can ever read or write the duo again, on any endpoint.
-- Until then the invite link keeps working so the partner can join.

create or replace function public.open_duo(p_code text, p_token text default null)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  k record;
  d record;
  v_role text;
  v_taken boolean;
begin
  select * into d from duos where code = p_code;
  if not found then raise exception 'Duo not found'; end if;

  -- fully linked: account access only, tokens ignored forever
  if d.member_a is not null and d.member_b is not null then
    if v_uid is not null and v_uid = d.member_a then v_role := 'A';
    elsif v_uid is not null and v_uid = d.member_b then v_role := 'B';
    else raise exception 'This duo is private — sign in with one of its two linked accounts.';
    end if;
    return json_build_object('role', v_role, 'duo', row_to_json(d));
  end if;

  select * into k from duo_keys where code = p_code;

  v_taken := v_uid is not null and exists (
    select 1 from duos where (member_a = v_uid or member_b = v_uid) and code <> p_code
  );

  if v_uid is not null and v_uid = d.member_a then
    v_role := 'A';
  elsif v_uid is not null and v_uid = d.member_b then
    v_role := 'B';
  elsif p_token is not null and p_token = k.host_token then
    v_role := 'A';
    if v_uid is not null and d.member_a is null then
      if v_taken then
        raise exception 'You already have a duo. One duo per account — delete yours first to join this one.';
      end if;
      update duos set member_a = v_uid where code = p_code;
    end if;
  elsif p_token is not null and p_token = k.guest_token then
    v_role := 'B';
    if v_uid is not null and d.member_b is null then
      if v_taken then
        raise exception 'You already have a duo. One duo per account — delete yours first to join this one.';
      end if;
      update duos set member_b = v_uid where code = p_code;  -- claim the seat
    end if;
  else
    raise exception 'Invalid invite link';
  end if;

  select * into d from duos where code = p_code;

  -- this open completed the pair: burn the invite tokens for good
  if d.member_a is not null and d.member_b is not null then
    delete from duo_keys where code = p_code;
  end if;

  return json_build_object('role', v_role, 'duo', row_to_json(d));
end;
$$;

-- One-time cleanup: burn tokens of duos that are already fully linked.
delete from public.duo_keys k
using public.duos d
where d.code = k.code
  and d.member_a is not null
  and d.member_b is not null;
