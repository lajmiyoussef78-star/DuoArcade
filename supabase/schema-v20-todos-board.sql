-- schema-v20-todos-board.sql
-- Allow save_duo_todos to store either a legacy items array or a { lists, items } board.

create or replace function public.save_duo_todos(p_duo_code text, p_items jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  d record;
  v_count int := 0;
begin
  select * into d from duos where code = p_duo_code;
  if not found then raise exception 'Duo not found'; end if;
  if v_uid is null or (v_uid <> d.member_a and (d.member_b is null or v_uid <> d.member_b)) then
    raise exception 'Only members of this duo can edit its todo list';
  end if;

  if p_items is null then
    raise exception 'Todo payload required';
  end if;

  if jsonb_typeof(p_items) = 'array' then
    v_count := jsonb_array_length(p_items);
  elsif jsonb_typeof(p_items) = 'object' then
    if p_items ? 'items' and jsonb_typeof(p_items->'items') = 'array' then
      v_count := jsonb_array_length(p_items->'items');
    else
      v_count := 0;
    end if;
  else
    raise exception 'Todo payload must be an array or board object';
  end if;

  if v_count > 200 then
    raise exception 'Todo list is full — clear some items first';
  end if;

  insert into duo_todos (duo_code, items, updated_at)
  values (p_duo_code, p_items, now())
  on conflict (duo_code) do update set items = excluded.items, updated_at = now();
  return true;
end;
$$;

grant execute on function public.save_duo_todos(text, jsonb) to authenticated;
