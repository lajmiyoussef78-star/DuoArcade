-- schema-v15-whiteboard-saves.sql — Named board snapshots for Our wall.
-- Live board stays in public.whiteboards; deliberate Save writes a row here.
-- Both duo members can list/open snapshots (RLS + security-definer RPCs).

create table if not exists public.whiteboard_saves (
  id uuid primary key default gen_random_uuid(),
  duo_code text not null references public.duos(code) on delete cascade,
  title text not null,
  strokes jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists whiteboard_saves_duo_created_idx
  on public.whiteboard_saves (duo_code, created_at desc);

alter table public.whiteboard_saves enable row level security;

drop policy if exists "whiteboard_saves: duo members read" on public.whiteboard_saves;
create policy "whiteboard_saves: duo members read"
  on public.whiteboard_saves for select
  to authenticated
  using (
    exists (
      select 1 from public.duos d
      where d.code = duo_code
        and (auth.uid() = d.member_a or auth.uid() = d.member_b)
    )
  );

create or replace function public.save_whiteboard_snapshot(
  p_duo_code text,
  p_title text,
  p_strokes jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  d record;
  v_title text;
  v_id uuid;
begin
  select * into d from duos where code = p_duo_code;
  if not found then raise exception 'Duo not found'; end if;
  if v_uid is null or (v_uid <> d.member_a and (d.member_b is null or v_uid <> d.member_b)) then
    raise exception 'Only members of this duo can save its whiteboard';
  end if;
  if p_strokes is null or jsonb_typeof(p_strokes) <> 'array' then
    raise exception 'Invalid strokes';
  end if;
  if jsonb_array_length(p_strokes) > 4000 then
    raise exception 'This board is too large to save — clear some strokes first';
  end if;

  v_title := trim(coalesce(p_title, ''));
  if v_title = '' then
    v_title := 'Untitled';
  end if;
  if char_length(v_title) > 120 then
    v_title := left(v_title, 120);
  end if;

  insert into whiteboard_saves (duo_code, title, strokes, created_by)
  values (p_duo_code, v_title, p_strokes, v_uid)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.list_whiteboard_snapshots(p_duo_code text)
returns table (
  id uuid,
  title text,
  created_at timestamptz,
  created_by uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  d record;
begin
  select * into d from duos where code = p_duo_code;
  if not found then raise exception 'Duo not found'; end if;
  if v_uid is null or (v_uid <> d.member_a and (d.member_b is null or v_uid <> d.member_b)) then
    raise exception 'Only members of this duo can view its whiteboard history';
  end if;

  return query
    select s.id, s.title, s.created_at, s.created_by
    from whiteboard_saves s
    where s.duo_code = p_duo_code
    order by s.created_at desc
    limit 100;
end;
$$;

create or replace function public.get_whiteboard_snapshot(p_id uuid)
returns table (
  id uuid,
  duo_code text,
  title text,
  strokes jsonb,
  created_at timestamptz,
  created_by uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  s record;
  d record;
begin
  select * into s from whiteboard_saves where whiteboard_saves.id = p_id;
  if not found then raise exception 'Snapshot not found'; end if;

  select * into d from duos where code = s.duo_code;
  if not found then raise exception 'Duo not found'; end if;
  if v_uid is null or (v_uid <> d.member_a and (d.member_b is null or v_uid <> d.member_b)) then
    raise exception 'Only members of this duo can open its whiteboard history';
  end if;

  return query
    select s.id, s.duo_code, s.title, s.strokes, s.created_at, s.created_by;
end;
$$;

grant execute on function public.save_whiteboard_snapshot(text, text, jsonb) to authenticated;
grant execute on function public.list_whiteboard_snapshots(text) to authenticated;
grant execute on function public.get_whiteboard_snapshot(uuid) to authenticated;
