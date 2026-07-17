-- schema-v22-duo-chat.sql — private partner chat for a duo.
-- Run once in the Supabase SQL Editor (after your existing schemas).
--
-- Realtime INSERT/UPDATE + seen receipts. Membership follows public.duos.

create table if not exists public.duo_chat_messages (
  id         uuid primary key default gen_random_uuid(),
  duo_code   text not null references public.duos(code) on delete cascade,
  sender_id  uuid not null references auth.users (id),
  content    text not null check (char_length(content) between 1 and 1000),
  created_at timestamptz not null default now(),
  seen_at    timestamptz
);

create index if not exists duo_chat_messages_duo_created_idx
  on public.duo_chat_messages (duo_code, created_at);

alter table public.duo_chat_messages enable row level security;

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

drop policy if exists "duo_chat: members read" on public.duo_chat_messages;
create policy "duo_chat: members read"
  on public.duo_chat_messages for select
  to anon, authenticated
  using (public.is_duo_chat_member(duo_code));

drop policy if exists "duo_chat: insert own" on public.duo_chat_messages;
create policy "duo_chat: insert own"
  on public.duo_chat_messages for insert
  to anon, authenticated
  with check (
    sender_id = auth.uid()
    and public.is_duo_chat_member(duo_code)
  );

-- Seen receipts: only the RECEIVER can mark a message seen
drop policy if exists "duo_chat: mark seen" on public.duo_chat_messages;
create policy "duo_chat: mark seen"
  on public.duo_chat_messages for update
  to anon, authenticated
  using (
    public.is_duo_chat_member(duo_code)
    and sender_id <> auth.uid()
  )
  with check (sender_id <> auth.uid());

alter table public.duo_chat_messages replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'duo_chat_messages'
  ) then
    alter publication supabase_realtime add table public.duo_chat_messages;
  end if;
end $$;
