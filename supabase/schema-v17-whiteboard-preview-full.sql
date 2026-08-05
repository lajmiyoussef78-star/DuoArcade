-- Full stroke payload for saved-board card thumbs (match real Our wall).

create or replace function public.list_whiteboard_snapshots(p_duo_code text)
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
      coalesce(s.strokes, '[]'::jsonb) as preview
    from whiteboard_saves s
    where s.duo_code = p_duo_code
    order by s.created_at desc
    limit 200;
end;
$$;

grant execute on function public.list_whiteboard_snapshots(text) to authenticated;
