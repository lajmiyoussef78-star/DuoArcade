-- schema-v36-bucketlist.sql — Time-locked couples bucket list.
-- Run once in Supabase SQL Editor after prior schemas.
--
-- One active list per duo. Lifecycle: draft -> locked -> opened -> archived.
-- While locked, items are stripped server-side (blind adds still allowed),
-- so the lock cannot be bypassed from the client. Live updates use a
-- broadcast ping; these RPCs are the source of truth.

create table if not exists public.duo_bucketlists (
  id          uuid primary key default gen_random_uuid(),
  duo_code    text not null references public.duos(code) on delete cascade,
  status      text not null default 'draft'
    check (status in ('draft', 'locked', 'opened', 'archived')),
  items       jsonb not null default '[]',
  unlock_at   timestamptz,
  locked_at   timestamptz,
  opened_at   timestamptz,
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Only one non-archived (active) list per duo.
create unique index if not exists duo_bucketlists_active
  on public.duo_bucketlists (duo_code) where status <> 'archived';

create index if not exists duo_bucketlists_history
  on public.duo_bucketlists (duo_code, archived_at desc) where status = 'archived';

alter table public.duo_bucketlists enable row level security;
-- No client SELECT policy on purpose: all reads go through RPCs below,
-- which strip items while the list is locked.

-- Helpers ---------------------------------------------------------------------

-- Raises unless the caller is a member of the duo; returns their role letter.
create or replace function public.bucket_member_role(p_duo_code text)
returns text
language plpgsql stable security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  d record;
begin
  if v_uid is null then raise exception 'Sign in first'; end if;
  select * into d from duos where code = p_duo_code;
  if not found then raise exception 'Duo not found'; end if;
  if v_uid = d.member_a then return 'A'; end if;
  if d.member_b is not null and v_uid = d.member_b then return 'B'; end if;
  raise exception 'Only members of this duo can use its bucket list';
end;
$$;

-- Fetch the active list, creating a fresh draft if none exists.
-- Also auto-opens a locked list whose unlock date has passed.
create or replace function public.bucket_active_row(p_duo_code text)
returns public.duo_bucketlists
language plpgsql security definer set search_path = public
as $$
declare
  r public.duo_bucketlists;
begin
  select * into r from duo_bucketlists
  where duo_code = p_duo_code and status <> 'archived'
  limit 1;

  if not found then
    insert into duo_bucketlists (duo_code) values (p_duo_code) returning * into r;
  end if;

  if r.status = 'locked' and r.unlock_at is not null and now() >= r.unlock_at then
    update duo_bucketlists
    set status = 'opened', opened_at = now(), updated_at = now()
    where id = r.id
    returning * into r;
  end if;

  return r;
end;
$$;

-- Serialize a list row; items are stripped while locked.
create or replace function public.bucket_row_json(r public.duo_bucketlists)
returns json
language sql stable
as $$
  select json_build_object(
    'id', r.id,
    'status', r.status,
    'items', case when r.status = 'locked' then null else r.items end,
    'item_count', jsonb_array_length(r.items),
    'unlock_at', r.unlock_at,
    'locked_at', r.locked_at,
    'opened_at', r.opened_at,
    'archived_at', r.archived_at,
    'created_at', r.created_at,
    'updated_at', r.updated_at
  );
$$;

-- RPCs -------------------------------------------------------------------------

create or replace function public.bucket_get(p_duo_code text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  r public.duo_bucketlists;
begin
  perform bucket_member_role(p_duo_code);
  r := bucket_active_row(p_duo_code);
  return bucket_row_json(r);
end;
$$;

-- Add an item. Allowed in draft AND locked (blind time-capsule add).
create or replace function public.bucket_add_item(p_duo_code text, p_text text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_role text;
  r public.duo_bucketlists;
  v_text text := trim(coalesce(p_text, ''));
begin
  v_role := bucket_member_role(p_duo_code);
  r := bucket_active_row(p_duo_code);

  if r.status not in ('draft', 'locked') then
    raise exception 'This list is already opened — archive it to start a new one';
  end if;
  if v_text = '' then raise exception 'Write something first'; end if;
  if length(v_text) > 280 then raise exception 'Keep it under 280 characters'; end if;
  if jsonb_array_length(r.items) >= 100 then
    raise exception 'The bucket list is full (100 items)';
  end if;

  update duo_bucketlists
  set items = items || jsonb_build_array(jsonb_build_object(
        'id', gen_random_uuid()::text,
        'text', v_text,
        'by', v_role,
        'added_at', extract(epoch from now()) * 1000,
        'achieved', null
      )),
      updated_at = now()
  where id = r.id
  returning * into r;

  return bucket_row_json(r);
end;
$$;

-- Edit an item's text. Draft only.
create or replace function public.bucket_update_item(
  p_duo_code text, p_item_id text, p_text text
)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  r public.duo_bucketlists;
  v_text text := trim(coalesce(p_text, ''));
begin
  perform bucket_member_role(p_duo_code);
  r := bucket_active_row(p_duo_code);
  if r.status <> 'draft' then raise exception 'Items can only be edited before locking'; end if;
  if v_text = '' then raise exception 'Write something first'; end if;
  if length(v_text) > 280 then raise exception 'Keep it under 280 characters'; end if;

  update duo_bucketlists
  set items = (
        select coalesce(jsonb_agg(
          case when it->>'id' = p_item_id
            then jsonb_set(it, '{text}', to_jsonb(v_text))
            else it end
        ), '[]'::jsonb)
        from jsonb_array_elements(items) it
      ),
      updated_at = now()
  where id = r.id
  returning * into r;

  return bucket_row_json(r);
end;
$$;

-- Remove an item. Draft only.
create or replace function public.bucket_remove_item(p_duo_code text, p_item_id text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  r public.duo_bucketlists;
begin
  perform bucket_member_role(p_duo_code);
  r := bucket_active_row(p_duo_code);
  if r.status <> 'draft' then raise exception 'Items can only be removed before locking'; end if;

  update duo_bucketlists
  set items = (
        select coalesce(jsonb_agg(it), '[]'::jsonb)
        from jsonb_array_elements(items) it
        where it->>'id' <> p_item_id
      ),
      updated_at = now()
  where id = r.id
  returning * into r;

  return bucket_row_json(r);
end;
$$;

-- Seal the list until p_unlock_at. Draft only; needs a future date and >= 1 item.
create or replace function public.bucket_lock(p_duo_code text, p_unlock_at timestamptz)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  r public.duo_bucketlists;
begin
  perform bucket_member_role(p_duo_code);
  r := bucket_active_row(p_duo_code);
  if r.status <> 'draft' then raise exception 'This list is already locked'; end if;
  if p_unlock_at is null or p_unlock_at <= now() then
    raise exception 'Pick a date in the future';
  end if;
  if p_unlock_at > now() + interval '5 years' then
    raise exception 'Five years max — dream big, but not that big';
  end if;
  if jsonb_array_length(r.items) < 1 then
    raise exception 'Add at least one dream before locking';
  end if;

  update duo_bucketlists
  set status = 'locked', unlock_at = p_unlock_at, locked_at = now(), updated_at = now()
  where id = r.id
  returning * into r;

  return bucket_row_json(r);
end;
$$;

-- Mark an item achieved / not achieved. Opened only.
create or replace function public.bucket_mark(
  p_duo_code text, p_item_id text, p_achieved boolean
)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  r public.duo_bucketlists;
begin
  perform bucket_member_role(p_duo_code);
  r := bucket_active_row(p_duo_code);
  if r.status <> 'opened' then raise exception 'The list is not open yet'; end if;

  update duo_bucketlists
  set items = (
        select coalesce(jsonb_agg(
          case when it->>'id' = p_item_id
            then jsonb_set(it, '{achieved}', coalesce(to_jsonb(p_achieved), 'null'::jsonb))
            else it end
        ), '[]'::jsonb)
        from jsonb_array_elements(items) it
      ),
      updated_at = now()
  where id = r.id
  returning * into r;

  return bucket_row_json(r);
end;
$$;

-- Archive the opened list as a keepsake and start a fresh draft.
create or replace function public.bucket_archive(p_duo_code text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  r public.duo_bucketlists;
begin
  perform bucket_member_role(p_duo_code);
  r := bucket_active_row(p_duo_code);
  if r.status <> 'opened' then raise exception 'Only an opened list can be archived'; end if;

  update duo_bucketlists
  set status = 'archived', archived_at = now(), updated_at = now()
  where id = r.id;

  r := bucket_active_row(p_duo_code);  -- creates the fresh draft
  return bucket_row_json(r);
end;
$$;

-- Past (archived) lists, newest first.
create or replace function public.bucket_history(p_duo_code text)
returns json
language plpgsql stable security definer set search_path = public
as $$
begin
  perform bucket_member_role(p_duo_code);
  return coalesce((
    select json_agg(json_build_object(
      'id', b.id,
      'items', b.items,
      'item_count', jsonb_array_length(b.items),
      'unlock_at', b.unlock_at,
      'locked_at', b.locked_at,
      'opened_at', b.opened_at,
      'archived_at', b.archived_at,
      'created_at', b.created_at
    ) order by b.archived_at desc)
    from duo_bucketlists b
    where b.duo_code = p_duo_code and b.status = 'archived'
  ), '[]'::json);
end;
$$;

grant execute on function public.bucket_get(text) to authenticated;
grant execute on function public.bucket_add_item(text, text) to authenticated;
grant execute on function public.bucket_update_item(text, text, text) to authenticated;
grant execute on function public.bucket_remove_item(text, text) to authenticated;
grant execute on function public.bucket_lock(text, timestamptz) to authenticated;
grant execute on function public.bucket_mark(text, text, boolean) to authenticated;
grant execute on function public.bucket_archive(text) to authenticated;
grant execute on function public.bucket_history(text) to authenticated;
