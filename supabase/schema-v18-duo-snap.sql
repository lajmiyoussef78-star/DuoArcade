-- schema-v18-duo-snap.sql — Replaces daily "Today's snap" with interval-based Duo Snap.
-- Run once in the Supabase SQL Editor.
--
-- Design:
--   * duo_snap_config  — per-duo settings, streak, pause, next fire time
--   * duo_snap_rounds  — each scheduled snap window (photos, captions, status)
--   * duo_snap_pause_log — busy-mode history
--   * Old photo_moments table is left intact (read-only archive); new system
--     does not write to it.
--   * Clients call get_duo_snap_state regularly; it expires missed rounds and
--     opens a new round when next_fire_at is due (and not paused).
--   * True push (FCM / web push) can hook the same next_fire_at later; for now
--     the app + Notification API trigger from get_duo_snap_state.

-- ─── Config ───────────────────────────────────────────────────────────────

create table if not exists public.duo_snap_config (
  duo_code          text primary key references public.duos(code) on delete cascade,
  enabled           boolean not null default true,
  interval_mins     int not null default 120
    check (interval_mins between 15 and 10080),
  window_mins       int not null default 60
    check (window_mins between 5 and 720),
  notify            boolean not null default true,
  camera_pref       text not null default 'user'
    check (camera_pref in ('user', 'environment')),
  auto_save_device   boolean not null default false,
  streak            int not null default 0,
  best_streak       int not null default 0,
  next_fire_at      timestamptz,
  paused_until      timestamptz,
  pause_reason      text,
  pause_by          text check (pause_by is null or pause_by in ('A', 'B')),
  updated_at        timestamptz not null default now()
);

alter table public.duo_snap_config enable row level security;

drop policy if exists "duo_snap_config: members read" on public.duo_snap_config;
create policy "duo_snap_config: members read"
  on public.duo_snap_config for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.duos d
      where d.code = duo_code
        and (auth.uid() = d.member_a or auth.uid() = d.member_b)
    )
  );

-- ─── Rounds ───────────────────────────────────────────────────────────────

create table if not exists public.duo_snap_rounds (
  id              uuid primary key default gen_random_uuid(),
  duo_code        text not null references public.duos(code) on delete cascade,
  scheduled_at    timestamptz not null,
  expires_at      timestamptz not null,
  photo_a         text,
  photo_b         text,
  caption_a       text,
  caption_b       text,
  at_a            timestamptz,
  at_b            timestamptz,
  status          text not null default 'active'
    check (status in ('active', 'completed', 'missed')),
  first_submitter text check (first_submitter is null or first_submitter in ('A', 'B')),
  reaction_a      text,
  reaction_b      text,
  comment_a       text,
  comment_b       text,
  streak_counted  boolean not null default false,
  created_at      timestamptz not null default now()
);

create index if not exists duo_snap_rounds_duo_sched_idx
  on public.duo_snap_rounds (duo_code, scheduled_at desc);

create index if not exists duo_snap_rounds_duo_status_idx
  on public.duo_snap_rounds (duo_code, status);

alter table public.duo_snap_rounds enable row level security;

drop policy if exists "duo_snap_rounds: members read" on public.duo_snap_rounds;
create policy "duo_snap_rounds: members read"
  on public.duo_snap_rounds for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.duos d
      where d.code = duo_code
        and (auth.uid() = d.member_a or auth.uid() = d.member_b)
    )
  );

-- ─── Pause log ────────────────────────────────────────────────────────────

create table if not exists public.duo_snap_pause_log (
  id          uuid primary key default gen_random_uuid(),
  duo_code    text not null references public.duos(code) on delete cascade,
  by_role     text not null check (by_role in ('A', 'B')),
  reason      text,
  paused_at   timestamptz not null default now(),
  until_at    timestamptz not null,
  resumed_at  timestamptz
);

create index if not exists duo_snap_pause_log_duo_idx
  on public.duo_snap_pause_log (duo_code, paused_at desc);

alter table public.duo_snap_pause_log enable row level security;

drop policy if exists "duo_snap_pause_log: members read" on public.duo_snap_pause_log;
create policy "duo_snap_pause_log: members read"
  on public.duo_snap_pause_log for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.duos d
      where d.code = duo_code
        and (auth.uid() = d.member_a or auth.uid() = d.member_b)
    )
  );

-- ─── Helpers ──────────────────────────────────────────────────────────────

create or replace function public._duo_snap_role(p_duo_code text)
returns text
language plpgsql stable security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  d record;
begin
  select * into d from duos where code = p_duo_code;
  if not found then raise exception 'Duo not found'; end if;
  if v_uid = d.member_a then return 'A';
  elsif v_uid is not null and v_uid = d.member_b then return 'B';
  else raise exception 'Only members of this duo can use Duo Snap';
  end if;
end;
$$;

create or replace function public._duo_snap_ensure_config(p_duo_code text)
returns public.duo_snap_config
language plpgsql security definer set search_path = public
as $$
declare
  c public.duo_snap_config;
begin
  select * into c from duo_snap_config where duo_code = p_duo_code;
  if not found then
    insert into duo_snap_config (duo_code, next_fire_at)
    values (p_duo_code, now())
    returning * into c;
  end if;
  return c;
end;
$$;

-- Expire overdue active rounds (skip while paused). Advance next_fire_at.
create or replace function public._duo_snap_expire_missed(p_duo_code text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  c public.duo_snap_config;
  v_n int;
begin
  c := public._duo_snap_ensure_config(p_duo_code);
  if c.paused_until is not null and c.paused_until > now() then
    return;
  end if;

  update duo_snap_rounds
  set status = 'missed'
  where duo_code = p_duo_code and status = 'active' and expires_at < now();

  get diagnostics v_n = row_count;
  if v_n > 0 then
    update duo_snap_config set
      streak = 0,
      next_fire_at = greatest(coalesce(next_fire_at, now()), now())
        + make_interval(mins => interval_mins),
      updated_at = now()
    where duo_code = p_duo_code;
  end if;
end;
$$;

-- Open a new round if due.
create or replace function public._duo_snap_open_if_due(p_duo_code text)
returns public.duo_snap_rounds
language plpgsql security definer set search_path = public
as $$
declare
  c public.duo_snap_config;
  active_r public.duo_snap_rounds;
  new_r public.duo_snap_rounds;
  fire_at timestamptz;
begin
  c := public._duo_snap_ensure_config(p_duo_code);

  if not c.enabled then return null; end if;
  if c.paused_until is not null and c.paused_until > now() then return null; end if;

  select * into active_r from duo_snap_rounds
  where duo_code = p_duo_code and status = 'active'
  order by scheduled_at desc limit 1;
  if found then return active_r; end if;

  fire_at := coalesce(c.next_fire_at, now());
  if fire_at > now() then return null; end if;

  insert into duo_snap_rounds (duo_code, scheduled_at, expires_at, status)
  values (p_duo_code, now(), now() + make_interval(mins => c.window_mins), 'active')
  returning * into new_r;

  update duo_snap_config set
    next_fire_at = now() + make_interval(mins => interval_mins),
    updated_at = now()
  where duo_code = p_duo_code;

  return new_r;
end;
$$;

-- ─── Public RPCs ──────────────────────────────────────────────────────────

create or replace function public.get_duo_snap_state(p_duo_code text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_role text;
  c public.duo_snap_config;
  r public.duo_snap_rounds;
  last_done public.duo_snap_rounds;
begin
  v_role := public._duo_snap_role(p_duo_code);
  perform public._duo_snap_expire_missed(p_duo_code);
  r := public._duo_snap_open_if_due(p_duo_code);
  c := public._duo_snap_ensure_config(p_duo_code);

  if r is null then
    select * into r from duo_snap_rounds
    where duo_code = p_duo_code and status = 'active'
    order by scheduled_at desc limit 1;
  end if;

  select * into last_done from duo_snap_rounds
  where duo_code = p_duo_code and status = 'completed'
  order by scheduled_at desc limit 1;

  return json_build_object(
    'role', v_role,
    'config', row_to_json(c),
    'active', case when r is null then null else row_to_json(r) end,
    'last_completed', case when last_done is null then null else row_to_json(last_done) end,
    'paused', (c.paused_until is not null and c.paused_until > now()),
    'server_now', now()
  );
end;
$$;

create or replace function public.save_duo_snap_settings(
  p_duo_code text,
  p_enabled boolean,
  p_interval_mins int,
  p_window_mins int,
  p_notify boolean,
  p_camera_pref text,
  p_auto_save_device boolean
)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  c public.duo_snap_config;
begin
  perform public._duo_snap_role(p_duo_code);
  c := public._duo_snap_ensure_config(p_duo_code);

  if p_interval_mins is not null and (p_interval_mins < 15 or p_interval_mins > 10080) then
    raise exception 'Interval must be between 15 minutes and 7 days';
  end if;
  if p_window_mins is not null and (p_window_mins < 5 or p_window_mins > 720) then
    raise exception 'Submission window must be between 5 minutes and 12 hours';
  end if;
  if p_camera_pref is not null and p_camera_pref not in ('user', 'environment') then
    raise exception 'Bad camera preference';
  end if;

  update duo_snap_config set
    enabled = coalesce(p_enabled, enabled),
    interval_mins = coalesce(p_interval_mins, interval_mins),
    window_mins = coalesce(p_window_mins, window_mins),
    notify = coalesce(p_notify, notify),
    camera_pref = coalesce(p_camera_pref, camera_pref),
    auto_save_device = coalesce(p_auto_save_device, auto_save_device),
    next_fire_at = case
      when coalesce(p_enabled, enabled) = false then next_fire_at
      when p_interval_mins is not null and p_interval_mins is distinct from interval_mins
        then now() + make_interval(mins => p_interval_mins)
      else next_fire_at
    end,
    updated_at = now()
  where duo_code = p_duo_code
  returning * into c;

  return row_to_json(c);
end;
$$;

create or replace function public.pause_duo_snap(
  p_duo_code text,
  p_until timestamptz,
  p_reason text default null
)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_role text;
  c public.duo_snap_config;
begin
  v_role := public._duo_snap_role(p_duo_code);
  if p_until is null or p_until <= now() then
    raise exception 'Pause end time must be in the future';
  end if;
  if p_until > now() + interval '7 days' then
    raise exception 'Pause cannot exceed 7 days';
  end if;

  c := public._duo_snap_ensure_config(p_duo_code);

  update duo_snap_config set
    paused_until = p_until,
    pause_reason = nullif(trim(coalesce(p_reason, '')), ''),
    pause_by = v_role,
    updated_at = now()
  where duo_code = p_duo_code
  returning * into c;

  insert into duo_snap_pause_log (duo_code, by_role, reason, until_at)
  values (p_duo_code, v_role, c.pause_reason, p_until);

  return row_to_json(c);
end;
$$;

create or replace function public.resume_duo_snap(p_duo_code text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_role text;
  c public.duo_snap_config;
begin
  v_role := public._duo_snap_role(p_duo_code);
  c := public._duo_snap_ensure_config(p_duo_code);

  update duo_snap_pause_log set resumed_at = now()
  where duo_code = p_duo_code and resumed_at is null
    and until_at = c.paused_until;

  update duo_snap_config set
    paused_until = null,
    pause_reason = null,
    pause_by = null,
    next_fire_at = greatest(coalesce(next_fire_at, now()), now()) + make_interval(mins => interval_mins),
    updated_at = now()
  where duo_code = p_duo_code
  returning * into c;

  return row_to_json(c);
end;
$$;

create or replace function public.submit_duo_snap(
  p_duo_code text,
  p_round_id uuid,
  p_photo text,
  p_caption text default null
)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_role text;
  c public.duo_snap_config;
  r public.duo_snap_rounds;
  v_both boolean;
  v_new_streak int;
  v_cap text;
begin
  v_role := public._duo_snap_role(p_duo_code);
  c := public._duo_snap_ensure_config(p_duo_code);

  if length(p_photo) > 220000 then raise exception 'Photo too large'; end if;
  if p_photo not like 'data:image/jpeg;base64,%' then
    raise exception 'Only camera JPEGs are accepted';
  end if;

  v_cap := nullif(trim(coalesce(p_caption, '')), '');
  if v_cap is not null and length(v_cap) > 100 then
    raise exception 'Caption max 100 characters';
  end if;

  select * into r from duo_snap_rounds
  where id = p_round_id and duo_code = p_duo_code for update;
  if not found then raise exception 'Snap round not found'; end if;
  if r.status <> 'active' then raise exception 'This snap window is closed'; end if;
  if r.expires_at < now() then
    update duo_snap_rounds set status = 'missed' where id = r.id;
    update duo_snap_config set streak = 0, updated_at = now() where duo_code = p_duo_code;
    raise exception 'The submission window has ended';
  end if;

  if (v_role = 'A' and r.photo_a is not null) or (v_role = 'B' and r.photo_b is not null) then
    raise exception 'You already submitted this Duo Snap';
  end if;

  update duo_snap_rounds set
    photo_a = case when v_role = 'A' then p_photo else photo_a end,
    photo_b = case when v_role = 'B' then p_photo else photo_b end,
    caption_a = case when v_role = 'A' then v_cap else caption_a end,
    caption_b = case when v_role = 'B' then v_cap else caption_b end,
    at_a = case when v_role = 'A' then now() else at_a end,
    at_b = case when v_role = 'B' then now() else at_b end,
    first_submitter = case
      when first_submitter is null then v_role
      else first_submitter
    end
  where id = r.id
  returning * into r;

  v_both := r.photo_a is not null and r.photo_b is not null;

  if v_both then
    update duo_snap_rounds set status = 'completed' where id = r.id returning * into r;

    if not r.streak_counted then
      v_new_streak := coalesce(c.streak, 0) + 1;
      update duo_snap_config set
        streak = v_new_streak,
        best_streak = greatest(coalesce(best_streak, 0), v_new_streak),
        updated_at = now()
      where duo_code = p_duo_code;
      update duo_snap_rounds set streak_counted = true where id = r.id returning * into r;
    end if;
  end if;

  return json_build_object(
    'both', v_both,
    'role', v_role,
    'round', row_to_json(r),
    'streak', case when v_both then coalesce(c.streak, 0) + 1 else c.streak end
  );
end;
$$;

create or replace function public.react_duo_snap(
  p_duo_code text,
  p_round_id uuid,
  p_reaction text default null,
  p_comment text default null
)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_role text;
  r public.duo_snap_rounds;
  v_comment text;
begin
  v_role := public._duo_snap_role(p_duo_code);
  v_comment := nullif(trim(coalesce(p_comment, '')), '');
  if v_comment is not null and length(v_comment) > 200 then
    raise exception 'Comment max 200 characters';
  end if;
  if p_reaction is not null and length(p_reaction) > 8 then
    raise exception 'Bad reaction';
  end if;

  select * into r from duo_snap_rounds
  where id = p_round_id and duo_code = p_duo_code for update;
  if not found then raise exception 'Snap not found'; end if;
  if r.status <> 'completed' then raise exception 'Only completed snaps can get reactions'; end if;

  update duo_snap_rounds set
    reaction_a = case when v_role = 'A' and p_reaction is not null then p_reaction else reaction_a end,
    reaction_b = case when v_role = 'B' and p_reaction is not null then p_reaction else reaction_b end,
    comment_a = case when v_role = 'A' and p_comment is not null then v_comment else comment_a end,
    comment_b = case when v_role = 'B' and p_comment is not null then v_comment else comment_b end
  where id = r.id
  returning * into r;

  return row_to_json(r);
end;
$$;

create or replace function public.list_duo_snap_history(
  p_duo_code text,
  p_month text default null,
  p_limit int default 40
)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_limit int := least(greatest(coalesce(p_limit, 40), 1), 100);
begin
  perform public._duo_snap_role(p_duo_code);

  return coalesce((
    select json_agg(row_to_json(x) order by x.scheduled_at desc)
    from (
      select *
      from duo_snap_rounds
      where duo_code = p_duo_code
        and status in ('completed', 'missed')
        and (
          p_month is null
          or to_char(scheduled_at at time zone 'UTC', 'YYYY-MM') = p_month
        )
      order by scheduled_at desc
      limit v_limit
    ) x
  ), '[]'::json);
end;
$$;

create or replace function public.delete_duo_snap(p_duo_code text, p_round_id uuid)
returns json
language plpgsql security definer set search_path = public
as $$
begin
  perform public._duo_snap_role(p_duo_code);
  delete from duo_snap_rounds
  where id = p_round_id and duo_code = p_duo_code and status in ('completed', 'missed');
  return json_build_object('ok', true);
end;
$$;

create or replace function public.clear_duo_snap_history(p_duo_code text)
returns json
language plpgsql security definer set search_path = public
as $$
begin
  perform public._duo_snap_role(p_duo_code);
  delete from duo_snap_rounds
  where duo_code = p_duo_code and status in ('completed', 'missed');
  return json_build_object('ok', true);
end;
$$;

create or replace function public.list_duo_snap_pauses(p_duo_code text, p_limit int default 20)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_limit int := least(greatest(coalesce(p_limit, 20), 1), 50);
begin
  perform public._duo_snap_role(p_duo_code);
  return coalesce((
    select json_agg(row_to_json(x) order by x.paused_at desc)
    from (
      select * from duo_snap_pause_log
      where duo_code = p_duo_code
      order by paused_at desc
      limit v_limit
    ) x
  ), '[]'::json);
end;
$$;

grant execute on function public.get_duo_snap_state(text) to authenticated;
grant execute on function public.save_duo_snap_settings(text, boolean, int, int, boolean, text, boolean) to authenticated;
grant execute on function public.pause_duo_snap(text, timestamptz, text) to authenticated;
grant execute on function public.resume_duo_snap(text) to authenticated;
grant execute on function public.submit_duo_snap(text, uuid, text, text) to authenticated;
grant execute on function public.react_duo_snap(text, uuid, text, text) to authenticated;
grant execute on function public.list_duo_snap_history(text, text, int) to authenticated;
grant execute on function public.delete_duo_snap(text, uuid) to authenticated;
grant execute on function public.clear_duo_snap_history(text) to authenticated;
grant execute on function public.list_duo_snap_pauses(text, int) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.duo_snap_rounds;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.duo_snap_config;
exception when duplicate_object then null;
end $$;
