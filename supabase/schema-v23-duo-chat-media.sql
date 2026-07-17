-- schema-v23-duo-chat-media.sql — photo messages for duo chat.
-- Run AFTER schema-v22-duo-chat.sql in the Supabase SQL Editor.
-- Voice/video calls use WebRTC + broadcast (no extra tables).

-- 1) image column + allow image-only messages
alter table public.duo_chat_messages add column if not exists image_url text;

alter table public.duo_chat_messages alter column content drop not null;

alter table public.duo_chat_messages drop constraint if exists duo_chat_messages_content_check;
alter table public.duo_chat_messages drop constraint if exists chat_messages_content_check;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'duo_chat_messages_content_check'
      and conrelid = 'public.duo_chat_messages'::regclass
  ) then
    alter table public.duo_chat_messages
      add constraint duo_chat_messages_content_check
      check (content is null or char_length(content) <= 1000);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'duo_chat_messages_has_body'
      and conrelid = 'public.duo_chat_messages'::regclass
  ) then
    alter table public.duo_chat_messages
      add constraint duo_chat_messages_has_body
      check (content is not null or image_url is not null);
  end if;
end $$;

-- 2) storage bucket for chat photos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-media',
  'chat-media',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- 3) storage policies: duo members only, folder = duo_code
drop policy if exists "duo chat media upload" on storage.objects;
create policy "duo chat media upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-media'
    and public.is_duo_chat_member(split_part(name, '/', 1))
  );

drop policy if exists "duo chat media read" on storage.objects;
create policy "duo chat media read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat-media'
    and public.is_duo_chat_member(split_part(name, '/', 1))
  );

-- Public bucket also needs anon read for <img src="publicUrl">
drop policy if exists "duo chat media public read" on storage.objects;
create policy "duo chat media public read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'chat-media');
