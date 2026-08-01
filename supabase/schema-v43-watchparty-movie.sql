-- schema-v43-watchparty-movie.sql — Movie Night continuity, whispers, upload stubs.
-- Run after schema-v42. Pass storage quotas are stubbed (comments only for now).

create table if not exists public.duo_movie_nights (
  id            uuid primary key default gen_random_uuid(),
  duo_code      text not null references public.duos(code) on delete cascade,
  fingerprint   text not null,
  title         text,
  size_label    text,
  position      double precision not null default 0,
  duration      double precision,
  updated_at    timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  unique (duo_code, fingerprint)
);

create index if not exists duo_movie_nights_duo
  on public.duo_movie_nights (duo_code, updated_at desc);

alter table public.duo_movie_nights enable row level security;

create policy "movie nights: duo members read"
  on public.duo_movie_nights for select
  to authenticated
  using (
    exists (
      select 1 from public.duos d
      where d.code = duo_code
        and (auth.uid() = d.member_a or auth.uid() = d.member_b)
    )
  );

create table if not exists public.duo_movie_comments (
  id          uuid primary key default gen_random_uuid(),
  duo_code    text not null references public.duos(code) on delete cascade,
  night_id    uuid not null references public.duo_movie_nights(id) on delete cascade,
  at_sec      double precision not null default 0,
  body        text not null,
  by_role     text not null check (by_role in ('A', 'B')),
  created_at  timestamptz not null default now()
);

create index if not exists duo_movie_comments_night
  on public.duo_movie_comments (night_id, at_sec);

alter table public.duo_movie_comments enable row level security;

create policy "movie comments: duo members read"
  on public.duo_movie_comments for select
  to authenticated
  using (
    exists (
      select 1 from public.duos d
      where d.code = duo_code
        and (auth.uid() = d.member_a or auth.uid() = d.member_b)
    )
  );

-- Asset registry stub for future Pass upload / HLS (no transcoding yet).
create table if not exists public.duo_movie_assets (
  id            uuid primary key default gen_random_uuid(),
  duo_code      text not null references public.duos(code) on delete cascade,
  meta          jsonb not null default '{}',
  -- Future: storage_path, hls_url, bytes_used for Pass quota enforcement.
  status        text not null default 'registered'
    check (status in ('registered', 'uploading', 'ready', 'failed')),
  created_at    timestamptz not null default now()
);

alter table public.duo_movie_assets enable row level security;

create policy "movie assets: duo members read"
  on public.duo_movie_assets for select
  to authenticated
  using (
    exists (
      select 1 from public.duos d
      where d.code = duo_code
        and (auth.uid() = d.member_a or auth.uid() = d.member_b)
    )
  );

/*
 * Storage bucket (create in Dashboard or via storage API — not auto here):
 *   name: duo-movie-uploads
 *   public: false
 * Pass quota stub: enforce bytes_used vs pass_tier in a later migration.
 * Do NOT accept base64 video in RPCs.
 * WebRTC SFU pip / Chromecast: not in this schema — client stubs only.
 */

create or replace function public.list_duo_movie_nights(p_duo_code text)
returns json
language plpgsql security definer set search_path = public
as $$
begin
  perform watch_member_role(p_duo_code);
  return coalesce((
    select json_agg(row_to_json(x) order by x.updated_at desc)
    from (
      select id, fingerprint, title, size_label, position, duration, updated_at, created_at
      from duo_movie_nights
      where duo_code = p_duo_code
      order by updated_at desc
      limit 20
    ) x
  ), '[]'::json);
end;
$$;

create or replace function public.upsert_duo_movie_night(
  p_duo_code text,
  p_fingerprint text,
  p_title text default null,
  p_size_label text default null,
  p_position double precision default 0,
  p_duration double precision default null
)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  r public.duo_movie_nights;
begin
  perform watch_member_role(p_duo_code);
  if p_fingerprint is null or length(trim(p_fingerprint)) = 0 then
    raise exception 'fingerprint required';
  end if;

  insert into duo_movie_nights (duo_code, fingerprint, title, size_label, position, duration)
  values (p_duo_code, p_fingerprint, p_title, p_size_label, coalesce(p_position, 0), p_duration)
  on conflict (duo_code, fingerprint) do update set
    title = coalesce(excluded.title, duo_movie_nights.title),
    size_label = coalesce(excluded.size_label, duo_movie_nights.size_label),
    position = coalesce(excluded.position, duo_movie_nights.position),
    duration = coalesce(excluded.duration, duo_movie_nights.duration),
    updated_at = now()
  returning * into r;

  return row_to_json(r);
end;
$$;

create or replace function public.list_duo_movie_comments(p_duo_code text, p_night_id uuid)
returns json
language plpgsql security definer set search_path = public
as $$
begin
  perform watch_member_role(p_duo_code);
  return coalesce((
    select json_agg(row_to_json(x) order by x.at_sec)
    from (
      select id, at_sec, body, by_role, created_at
      from duo_movie_comments
      where duo_code = p_duo_code and night_id = p_night_id
      order by at_sec
      limit 200
    ) x
  ), '[]'::json);
end;
$$;

create or replace function public.add_duo_movie_comment(
  p_duo_code text,
  p_night_id uuid,
  p_at_sec double precision,
  p_body text,
  p_by text default null
)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_role text;
  r public.duo_movie_comments;
begin
  v_role := watch_member_role(p_duo_code);
  if p_body is null or length(trim(p_body)) = 0 then
    raise exception 'Comment required';
  end if;
  if length(p_body) > 500 then raise exception 'Comment too long'; end if;

  insert into duo_movie_comments (duo_code, night_id, at_sec, body, by_role)
  values (p_duo_code, p_night_id, coalesce(p_at_sec, 0), trim(p_body), coalesce(p_by, v_role))
  returning * into r;

  return json_build_object(
    'id', r.id,
    'at_sec', r.at_sec,
    'body', r.body,
    'by_role', r.by_role,
    'created_at', r.created_at
  );
end;
$$;

-- Register upload intent (Pass / HLS later). No file bytes here.
create or replace function public.register_duo_movie_asset(p_duo_code text, p_meta jsonb default '{}')
returns json
language plpgsql security definer set search_path = public
as $$
declare
  r public.duo_movie_assets;
begin
  perform watch_member_role(p_duo_code);
  -- Pass quota stub: when Pass storage ships, check duo.pass_tier + sum(bytes) here.
  insert into duo_movie_assets (duo_code, meta, status)
  values (p_duo_code, coalesce(p_meta, '{}'::jsonb), 'registered')
  returning * into r;
  return row_to_json(r);
end;
$$;

grant execute on function public.list_duo_movie_nights(text) to authenticated;
grant execute on function public.upsert_duo_movie_night(text, text, text, text, double precision, double precision) to authenticated;
grant execute on function public.list_duo_movie_comments(text, uuid) to authenticated;
grant execute on function public.add_duo_movie_comment(text, uuid, double precision, text, text) to authenticated;
grant execute on function public.register_duo_movie_asset(text, jsonb) to authenticated;
