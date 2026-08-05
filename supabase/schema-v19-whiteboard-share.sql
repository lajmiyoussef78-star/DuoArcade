-- schema-v19-whiteboard-share.sql
-- Share packs: copy a board link/code; import into another duo under "Shared with us".

create table if not exists public.whiteboard_share_packs (
  token text primary key,
  title text not null,
  strokes jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.whiteboard_share_packs enable row level security;

alter table public.whiteboard_saves
  add column if not exists shared_from text;

create or replace function public.create_whiteboard_share(p_title text, p_strokes jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_token text;
  v_title text;
begin
  if v_uid is null then
    raise exception 'Sign in to share a whiteboard';
  end if;

  v_title := nullif(trim(coalesce(p_title, '')), '');
  if v_title is null then
    v_title := 'Shared whiteboard';
  end if;
  if char_length(v_title) > 120 then
    v_title := left(v_title, 120);
  end if;

  v_token := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  insert into whiteboard_share_packs (token, title, strokes, created_by)
  values (v_token, v_title, coalesce(p_strokes, '[]'::jsonb), v_uid);

  return v_token;
end;
$$;

create or replace function public.peek_whiteboard_share(p_token text)
returns table (
  token text,
  title text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_tok text;
begin
  if v_uid is null then
    raise exception 'Sign in to open a shared whiteboard';
  end if;

  v_tok := upper(trim(coalesce(p_token, '')));
  if v_tok = '' then
    raise exception 'Enter a share code or link';
  end if;

  return query
    select p.token, p.title, p.created_at
    from whiteboard_share_packs p
    where p.token = v_tok;
end;
$$;

create or replace function public.import_whiteboard_share(p_duo_code text, p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  d record;
  p record;
  v_tok text;
  v_id uuid;
  v_title text;
begin
  if v_uid is null then
    raise exception 'Sign in to add a shared whiteboard';
  end if;

  select * into d from duos where code = p_duo_code;
  if not found then raise exception 'Duo not found'; end if;
  if v_uid <> d.member_a and (d.member_b is null or v_uid <> d.member_b) then
    raise exception 'Only members of this duo can add shared boards';
  end if;

  v_tok := upper(trim(coalesce(p_token, '')));
  if v_tok = '' then
    raise exception 'Enter a share code or link';
  end if;

  select * into p from whiteboard_share_packs where token = v_tok;
  if not found then
    raise exception 'Share code not found';
  end if;

  v_title := coalesce(nullif(trim(p.title), ''), 'Shared whiteboard');
  if char_length(v_title) > 120 then
    v_title := left(v_title, 120);
  end if;

  insert into whiteboard_saves (duo_code, title, strokes, created_by, shared_from)
  values (p_duo_code, v_title, coalesce(p.strokes, '[]'::jsonb), v_uid, v_tok)
  returning id into v_id;

  return v_id;
end;
$$;

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
  shared_from text,
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
      s.shared_from,
      coalesce(s.strokes, '[]'::jsonb) as preview
    from whiteboard_saves s
    where s.duo_code = p_duo_code
    order by s.created_at desc
    limit 200;
end;
$$;

grant execute on function public.create_whiteboard_share(text, jsonb) to authenticated;
grant execute on function public.peek_whiteboard_share(text) to authenticated;
grant execute on function public.import_whiteboard_share(text, text) to authenticated;
grant execute on function public.list_whiteboard_snapshots(text) to authenticated;
