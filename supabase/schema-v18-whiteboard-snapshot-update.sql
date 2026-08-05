-- Update strokes on an existing saved board (edit in place).

create or replace function public.update_whiteboard_snapshot(
  p_id uuid,
  p_strokes jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  s record;
  d record;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select * into s from whiteboard_saves where id = p_id;
  if not found then raise exception 'Snapshot not found'; end if;
  if s.deleted_at is not null then raise exception 'Snapshot is in trash'; end if;

  select * into d from duos where code = s.duo_code;
  if not found then raise exception 'Duo not found'; end if;
  if v_uid <> d.member_a and (d.member_b is null or v_uid <> d.member_b) then
    raise exception 'Only members of this duo can edit its whiteboard history';
  end if;

  update whiteboard_saves
  set strokes = coalesce(p_strokes, '[]'::jsonb),
      updated_at = now()
  where id = p_id;

  return true;
end;
$$;

grant execute on function public.update_whiteboard_snapshot(uuid, jsonb) to authenticated;

-- Include updated_at when opening a snapshot (return type change → drop first).
drop function if exists public.get_whiteboard_snapshot(uuid);

create function public.get_whiteboard_snapshot(p_id uuid)
returns table (
  id uuid,
  duo_code text,
  title text,
  strokes jsonb,
  created_at timestamptz,
  updated_at timestamptz,
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
    select s.id, s.duo_code, s.title, s.strokes, s.created_at, s.updated_at, s.created_by;
end;
$$;
