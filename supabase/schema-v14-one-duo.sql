-- schema-v14-one-duo.sql — one duo per account.
-- Run once in Supabase SQL Editor (after v13).
--
-- The rules:
--   * An account can belong to exactly ONE duo.
--   * create_duo refuses while you're still in a duo.
--   * open_duo refuses to claim a seat (via invite link) while you're
--     still in a duo. Viewing a duo you're already a member of is fine.
--   * delete_duo permanently erases the duo FOR BOTH MEMBERS: streaks,
--     game records, snaps, todos, whiteboard, arena history — everything.
--     Any redeemed pass code is freed so it can be used again.

-- 1. create_duo: block while already in a duo -------------------------------

create or replace function public.create_duo(p_name_a text, p_name_b text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_code  text;
  v_host  text := replace(gen_random_uuid()::text, '-', '');
  v_guest text := replace(gen_random_uuid()::text, '-', '');
begin
  if v_uid is null then
    raise exception 'Sign in to create a duo';
  end if;
  if exists (select 1 from duos where member_a = v_uid or member_b = v_uid) then
    raise exception 'You already have a duo. One duo per account — delete yours first (you will lose your streaks and history together).';
  end if;
  if coalesce(trim(p_name_a), '') = '' or coalesce(trim(p_name_b), '') = '' then
    raise exception 'Both names are required';
  end if;
  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5));
    exit when not exists (select 1 from duos where code = v_code);
  end loop;
  insert into duos (code, name_a, name_b, member_a)
  values (v_code, left(trim(p_name_a), 20), left(trim(p_name_b), 20), v_uid);
  insert into duo_keys (code, host_token, guest_token)
  values (v_code, v_host, v_guest);
  return json_build_object('code', v_code, 'host_token', v_host, 'guest_token', v_guest);
end;
$$;

-- 2. open_duo: block claiming a second duo's seat ---------------------------

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
  return json_build_object('role', v_role, 'duo', row_to_json(d));
end;
$$;

-- 3. delete_duo: the way out — erases everything for both -------------------

create or replace function public.delete_duo(p_code text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  d record;
begin
  if v_uid is null then raise exception 'Sign in first'; end if;
  select * into d from duos where code = p_code;
  if not found then raise exception 'Duo not found'; end if;
  if v_uid <> d.member_a and (d.member_b is null or v_uid <> d.member_b) then
    raise exception 'Only a member of this duo can delete it';
  end if;

  -- free the pass code so it can be redeemed again on a future duo
  update pass_codes set redeemed_by = null, redeemed_at = null
  where redeemed_by = p_code;

  -- arena history references duos with NOT NULL columns (no cascade)
  delete from matches where duo_a = p_code or duo_b = p_code;

  -- cascades: duo_keys, photo_moments, duo_todos, duo_photos, whiteboards,
  -- duo_presence, arena_queue, arena_matches
  delete from duos where code = p_code;
end;
$$;

grant execute on function public.delete_duo(text) to authenticated;
