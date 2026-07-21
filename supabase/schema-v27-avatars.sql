-- schema-v27-avatars.sql — DuoArcade avatars: each member of a duo picks
-- a character icon. Run once in the SQL Editor.

alter table public.duos add column if not exists avatar_a text;
alter table public.duos add column if not exists avatar_b text;

-- Set MY avatar in this duo (decides the column from auth.uid()).
create or replace function public.set_my_avatar(p_duo_code text, p_avatar text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  d record;
begin
  if p_avatar is not null and char_length(p_avatar) > 32 then
    raise exception 'Bad avatar id';
  end if;
  select * into d from duos where code = p_duo_code;
  if not found then raise exception 'Duo not found'; end if;
  if v_uid = d.member_a then
    update duos set avatar_a = p_avatar where code = p_duo_code;
  elsif d.member_b is not null and v_uid = d.member_b then
    update duos set avatar_b = p_avatar where code = p_duo_code;
  else
    raise exception 'Only members of this duo can set an avatar';
  end if;
  select * into d from duos where code = p_duo_code;
  return json_build_object('avatar_a', d.avatar_a, 'avatar_b', d.avatar_b);
end;
$$;

grant execute on function public.set_my_avatar(text, text) to authenticated;

-- Read both avatars (members only).
create or replace function public.get_duo_avatars(p_duo_code text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  d record;
begin
  select * into d from duos where code = p_duo_code;
  if not found then raise exception 'Duo not found'; end if;
  if v_uid is null or (v_uid <> d.member_a and (d.member_b is null or v_uid <> d.member_b)) then
    raise exception 'Only members of this duo can read its avatars';
  end if;
  return json_build_object('avatar_a', d.avatar_a, 'avatar_b', d.avatar_b);
end;
$$;

grant execute on function public.get_duo_avatars(text) to authenticated;
