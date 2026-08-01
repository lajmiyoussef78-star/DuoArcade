-- schema-v44-watchparty-interactive.sql — Sparks answer durability (optional reveal).
-- Insights table deferred — Memory card computes client-side for V1.
-- Timed prompts are client hooks only (see watchSparks.createTimedSparkHooks).

create table if not exists public.duo_sparks_sessions (
  id          uuid primary key default gen_random_uuid(),
  duo_code    text not null references public.duos(code) on delete cascade,
  pack_id     text not null,
  mode        text not null default 'quick',
  answers     jsonb not null default '{}',
  score       jsonb not null default '{"A":0,"B":0}',
  created_at  timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists duo_sparks_sessions_duo
  on public.duo_sparks_sessions (duo_code, created_at desc);

alter table public.duo_sparks_sessions enable row level security;

create policy "sparks: duo members read"
  on public.duo_sparks_sessions for select
  to authenticated
  using (
    exists (
      select 1 from public.duos d
      where d.code = duo_code
        and (auth.uid() = d.member_a or auth.uid() = d.member_b)
    )
  );

-- Soft persist when a Sparks night completes (optional; session envelope is source of live truth).
create or replace function public.save_duo_sparks_session(
  p_duo_code text,
  p_pack_id text,
  p_mode text,
  p_answers jsonb default '{}',
  p_score jsonb default '{"A":0,"B":0}'
)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  r public.duo_sparks_sessions;
begin
  perform watch_member_role(p_duo_code);
  insert into duo_sparks_sessions (duo_code, pack_id, mode, answers, score, finished_at)
  values (
    p_duo_code,
    coalesce(p_pack_id, 'sparks-relationship-v1'),
    coalesce(p_mode, 'quick'),
    coalesce(p_answers, '{}'::jsonb),
    coalesce(p_score, '{"A":0,"B":0}'::jsonb),
    now()
  )
  returning * into r;
  return row_to_json(r);
end;
$$;

grant execute on function public.save_duo_sparks_session(text, text, text, jsonb, jsonb) to authenticated;

-- AI insights / seasonal packs / mic laugh-first: deferred (no tables yet).
