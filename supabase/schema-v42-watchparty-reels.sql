-- schema-v42-watchparty-reels.sql — WatchParty Reels: Our Clips favorites.
-- Run once in Supabase SQL Editor after prior schemas.

create table if not exists public.duo_reel_favorites (
  id          uuid primary key default gen_random_uuid(),
  duo_code    text not null references public.duos(code) on delete cascade,
  clip_id     text not null,
  kind        text not null,
  url         text not null,
  title       text,
  video_id    text,
  saved_by    text check (saved_by in ('A', 'B')),
  created_at  timestamptz not null default now(),
  unique (duo_code, clip_id)
);

create index if not exists duo_reel_favorites_duo
  on public.duo_reel_favorites (duo_code, created_at desc);

alter table public.duo_reel_favorites enable row level security;

create policy "reel favs: duo members read"
  on public.duo_reel_favorites for select
  to authenticated
  using (
    exists (
      select 1 from public.duos d
      where d.code = duo_code
        and (auth.uid() = d.member_a or auth.uid() = d.member_b)
    )
  );

-- Writes via RPCs only.

create or replace function public.watch_member_role(p_duo_code text)
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
  raise exception 'Only members of this duo can use WatchParty tables';
end;
$$;

create or replace function public.list_duo_reel_favorites(p_duo_code text)
returns json
language plpgsql security definer set search_path = public
as $$
begin
  perform watch_member_role(p_duo_code);
  return coalesce((
    select json_agg(row_to_json(x) order by x.created_at desc)
    from (
      select id, clip_id, kind, url, title, video_id, saved_by, created_at
      from duo_reel_favorites
      where duo_code = p_duo_code
      order by created_at desc
      limit 100
    ) x
  ), '[]'::json);
end;
$$;

create or replace function public.save_duo_reel_favorite(
  p_duo_code text,
  p_clip_id text,
  p_kind text,
  p_url text,
  p_title text default null,
  p_video_id text default null
)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_role text;
  r public.duo_reel_favorites;
begin
  v_role := watch_member_role(p_duo_code);
  if p_clip_id is null or length(trim(p_clip_id)) = 0 then
    raise exception 'clip_id required';
  end if;
  if p_url is null or length(trim(p_url)) = 0 then
    raise exception 'url required';
  end if;

  insert into duo_reel_favorites (duo_code, clip_id, kind, url, title, video_id, saved_by)
  values (p_duo_code, p_clip_id, coalesce(p_kind, 'external'), p_url, p_title, p_video_id, v_role)
  on conflict (duo_code, clip_id) do update set
    title = coalesce(excluded.title, duo_reel_favorites.title),
    url = excluded.url
  returning * into r;

  return row_to_json(r);
end;
$$;

create or replace function public.remove_duo_reel_favorite(p_duo_code text, p_clip_id text)
returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  perform watch_member_role(p_duo_code);
  delete from duo_reel_favorites where duo_code = p_duo_code and clip_id = p_clip_id;
  return true;
end;
$$;

grant execute on function public.watch_member_role(text) to authenticated;
grant execute on function public.list_duo_reel_favorites(text) to authenticated;
grant execute on function public.save_duo_reel_favorite(text, text, text, text, text, text) to authenticated;
grant execute on function public.remove_duo_reel_favorite(text, text) to authenticated;
