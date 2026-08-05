-- schema-v21-todos-lists-column.sql
-- Separate lists column; drop legacy 2-arg save that called jsonb_array_length on objects.
-- lists may be a plain array (legacy) or { lists, privacy } for per-user list visibility.

alter table public.duo_todos
  add column if not exists lists jsonb not null default '[]'::jsonb;

drop function if exists public.save_duo_todos(text, jsonb);
drop function if exists public.save_duo_todos(text, jsonb, jsonb);

create function public.save_duo_todos(p_duo_code text, p_items jsonb, p_lists jsonb default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  d record;
  v_items jsonb;
  v_lists jsonb;
  v_count int := 0;
begin
  select * into d from duos where code = p_duo_code;
  if not found then raise exception 'Duo not found'; end if;
  if v_uid is null or (v_uid <> d.member_a and (d.member_b is null or v_uid <> d.member_b)) then
    raise exception 'Only members of this duo can edit its todo list';
  end if;

  if p_items is null then
    v_items := '[]'::jsonb;
  elsif jsonb_typeof(p_items) = 'array' then
    v_items := p_items;
  elsif jsonb_typeof(p_items) = 'object' and (p_items ? 'items') then
    if jsonb_typeof(p_items->'items') = 'array' then
      v_items := p_items->'items';
    else
      v_items := '[]'::jsonb;
    end if;
  else
    v_items := '[]'::jsonb;
  end if;

  if p_lists is null then
    v_lists := null;
  elsif jsonb_typeof(p_lists) = 'array' or jsonb_typeof(p_lists) = 'object' then
    v_lists := p_lists;
  elsif jsonb_typeof(p_items) = 'object' and (p_items ? 'lists') then
    v_lists := p_items->'lists';
  else
    v_lists := null;
  end if;

  begin
    v_count := coalesce(jsonb_array_length(v_items), 0);
  exception when others then
    v_items := '[]'::jsonb;
    v_count := 0;
  end;

  if v_count > 200 then
    raise exception 'Todo list is full — clear some items first';
  end if;

  insert into duo_todos (duo_code, items, lists, updated_at)
  values (p_duo_code, v_items, coalesce(v_lists, '[]'::jsonb), now())
  on conflict (duo_code) do update
    set items = excluded.items,
        lists = coalesce(v_lists, duo_todos.lists),
        updated_at = now();
  return true;
end;
$$;

grant execute on function public.save_duo_todos(text, jsonb, jsonb) to authenticated;

notify pgrst, 'reload schema';
