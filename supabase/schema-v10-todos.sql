-- schema-v10-todos.sql — DuoArcade shared couple todo list.
-- Run once in the SQL Editor (after your existing schemas).
--
-- One todo list per duo. Items are stored as jsonb; both members can edit.
-- Live updates use a broadcast channel; this table is the source of truth.

create table if not exists public.duo_todos (
  duo_code   text primary key references public.duos(code) on delete cascade,
  items      jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

alter table public.duo_todos enable row level security;

create policy "duo_todos: duo members read"
  on public.duo_todos for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.duos d
      where d.code = duo_code
        and (auth.uid() = d.member_a or auth.uid() = d.member_b)
    )
  );

create or replace function public.save_duo_todos(p_duo_code text, p_items jsonb)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  d record;
begin
  select * into d from duos where code = p_duo_code;
  if not found then raise exception 'Duo not found'; end if;
  if v_uid is null or (v_uid <> d.member_a and (d.member_b is null or v_uid <> d.member_b)) then
    raise exception 'Only members of this duo can edit its todo list';
  end if;
  if jsonb_array_length(p_items) > 200 then
    raise exception 'Todo list is full — clear some items first';
  end if;

  insert into duo_todos (duo_code, items, updated_at)
  values (p_duo_code, p_items, now())
  on conflict (duo_code) do update set items = p_items, updated_at = now();
  return true;
end;
$$;

grant execute on function public.save_duo_todos(text, jsonb) to authenticated;
