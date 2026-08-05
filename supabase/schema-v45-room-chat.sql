-- schema-v45-room-chat.sql — per-game-room chat (each invite/session has its own thread).
-- Room id is typically "<gameId>:<startedAt>" from duo.session.

create table if not exists public.duo_room_messages (
  id         uuid primary key default gen_random_uuid(),
  duo_code   text not null references public.duos(code) on delete cascade,
  room_id    text not null,
  role       text not null check (role in ('A', 'B')),
  sender_id  uuid not null references auth.users (id),
  content    text not null check (char_length(content) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists duo_room_messages_room_created_idx
  on public.duo_room_messages (duo_code, room_id, created_at);

alter table public.duo_room_messages enable row level security;

-- Reuse is_duo_chat_member if present; otherwise define a local helper.
create or replace function public.is_duo_chat_member(p_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.duos d
    where d.code = p_code
      and (d.member_a = auth.uid() or d.member_b = auth.uid())
  );
$$;

drop policy if exists "duo_room_chat: members read" on public.duo_room_messages;
create policy "duo_room_chat: members read"
  on public.duo_room_messages for select
  to authenticated
  using (public.is_duo_chat_member(duo_code));

drop policy if exists "duo_room_chat: insert own" on public.duo_room_messages;
create policy "duo_room_chat: insert own"
  on public.duo_room_messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_duo_chat_member(duo_code)
  );

alter table public.duo_room_messages replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'duo_room_messages'
  ) then
    alter publication supabase_realtime add table public.duo_room_messages;
  end if;
end $$;
