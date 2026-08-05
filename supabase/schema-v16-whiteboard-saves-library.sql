-- schema-v16-whiteboard-saves-library.sql
-- Favorites, trash, rename/duplicate, and richer list (preview strokes) for Saved boards.

alter table public.whiteboard_saves
  add column if not exists is_favorite boolean not null default false,
  add column if not exists favorited_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists whiteboard_saves_duo_active_idx
  on public.whiteboard_saves (duo_code, created_at desc)
  where deleted_at is null;

create index if not exists whiteboard_saves_duo_trash_idx
  on public.whiteboard_saves (duo_code, deleted_at desc)
  where deleted_at is not null;

drop function if exists public.list_whiteboard_snapshots(text);

create function public.list_whiteboard_snapshots(p_duo_code text)
returns table (
  id uuid,
  title text,
  created_at timestamptz,
  created_by uuid,
  is_favorite boolean,
  favorited_at timestamptz,
  deleted_at timestamptz,
  updated_at timestamptz,
  preview jsonb
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
    select
      s.id,
      s.title,
      s.created_at,
      s.created_by,
      s.is_favorite,
      s.favorited_at,
      s.deleted_at,
      s.updated_at,
      coalesce((
        select jsonb_agg(elem.value)
        from jsonb_array_elements(s.strokes) with ordinality as elem(value, ord)
        where elem.ord <= 28
      ), '[]'::jsonb) as preview
    from whiteboard_saves s
    where s.duo_code = p_duo_code
    order by s.created_at desc
    limit 200;
end;
$$;

create or replace function public.rename_whiteboard_snapshot(p_id uuid, p_title text)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid(); s record; d record; v_title text;
begin
  select * into s from whiteboard_saves where id = p_id;
  if not found then raise exception 'Snapshot not found'; end if;
  select * into d from duos where code = s.duo_code;
  if not found then raise exception 'Duo not found'; end if;
  if v_uid is null or (v_uid <> d.member_a and (d.member_b is null or v_uid <> d.member_b)) then
    raise exception 'Only members of this duo can rename saves';
  end if;
  v_title := trim(coalesce(p_title, ''));
  if v_title = '' then raise exception 'Title is required'; end if;
  if char_length(v_title) > 120 then v_title := left(v_title, 120); end if;
  update whiteboard_saves set title = v_title, updated_at = now() where id = p_id;
  return true;
end;
$$;

create or replace function public.set_whiteboard_snapshot_favorite(p_id uuid, p_favorite boolean)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid(); s record; d record;
begin
  select * into s from whiteboard_saves where id = p_id;
  if not found then raise exception 'Snapshot not found'; end if;
  select * into d from duos where code = s.duo_code;
  if not found then raise exception 'Duo not found'; end if;
  if v_uid is null or (v_uid <> d.member_a and (d.member_b is null or v_uid <> d.member_b)) then
    raise exception 'Only members of this duo can favorite saves';
  end if;
  update whiteboard_saves
    set is_favorite = coalesce(p_favorite, false),
        favorited_at = case when coalesce(p_favorite, false) then now() else null end,
        updated_at = now()
    where id = p_id;
  return true;
end;
$$;

create or replace function public.trash_whiteboard_snapshot(p_id uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid(); s record; d record;
begin
  select * into s from whiteboard_saves where id = p_id;
  if not found then raise exception 'Snapshot not found'; end if;
  select * into d from duos where code = s.duo_code;
  if not found then raise exception 'Duo not found'; end if;
  if v_uid is null or (v_uid <> d.member_a and (d.member_b is null or v_uid <> d.member_b)) then
    raise exception 'Only members of this duo can trash saves';
  end if;
  update whiteboard_saves set deleted_at = now(), updated_at = now() where id = p_id;
  return true;
end;
$$;

create or replace function public.restore_whiteboard_snapshot(p_id uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid(); s record; d record;
begin
  select * into s from whiteboard_saves where id = p_id;
  if not found then raise exception 'Snapshot not found'; end if;
  select * into d from duos where code = s.duo_code;
  if not found then raise exception 'Duo not found'; end if;
  if v_uid is null or (v_uid <> d.member_a and (d.member_b is null or v_uid <> d.member_b)) then
    raise exception 'Only members of this duo can restore saves';
  end if;
  update whiteboard_saves set deleted_at = null, updated_at = now() where id = p_id;
  return true;
end;
$$;

create or replace function public.delete_whiteboard_snapshot(p_id uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid(); s record; d record;
begin
  select * into s from whiteboard_saves where id = p_id;
  if not found then raise exception 'Snapshot not found'; end if;
  select * into d from duos where code = s.duo_code;
  if not found then raise exception 'Duo not found'; end if;
  if v_uid is null or (v_uid <> d.member_a and (d.member_b is null or v_uid <> d.member_b)) then
    raise exception 'Only members of this duo can delete saves';
  end if;
  delete from whiteboard_saves where id = p_id;
  return true;
end;
$$;

create or replace function public.duplicate_whiteboard_snapshot(p_id uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid(); s record; d record; v_title text; v_id uuid;
begin
  select * into s from whiteboard_saves where id = p_id;
  if not found then raise exception 'Snapshot not found'; end if;
  select * into d from duos where code = s.duo_code;
  if not found then raise exception 'Duo not found'; end if;
  if v_uid is null or (v_uid <> d.member_a and (d.member_b is null or v_uid <> d.member_b)) then
    raise exception 'Only members of this duo can duplicate saves';
  end if;
  v_title := trim(s.title) || ' (copy)';
  if char_length(v_title) > 120 then v_title := left(v_title, 120); end if;
  insert into whiteboard_saves (duo_code, title, strokes, created_by)
  values (s.duo_code, v_title, s.strokes, v_uid)
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.list_whiteboard_snapshots(text) to authenticated;
grant execute on function public.rename_whiteboard_snapshot(uuid, text) to authenticated;
grant execute on function public.set_whiteboard_snapshot_favorite(uuid, boolean) to authenticated;
grant execute on function public.trash_whiteboard_snapshot(uuid) to authenticated;
grant execute on function public.restore_whiteboard_snapshot(uuid) to authenticated;
grant execute on function public.delete_whiteboard_snapshot(uuid) to authenticated;
grant execute on function public.duplicate_whiteboard_snapshot(uuid) to authenticated;
