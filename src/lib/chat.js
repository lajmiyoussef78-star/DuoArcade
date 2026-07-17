// src/lib/chat.js — partner chat data layer (Supabase).

import { CONFIG } from './config.js';

let clientPromise = null;

export function chatConfigured() {
  return CONFIG.SUPABASE_URL && !CONFIG.SUPABASE_URL.includes('YOUR-PROJECT');
}

export async function getChatClient() {
  if (!clientPromise) {
    const { createClient } = await import('@supabase/supabase-js');
    clientPromise = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  }
  return clientPromise;
}

export async function listChatMessages(duoCode) {
  const supabase = await getChatClient();
  const { data, error } = await supabase
    .from('duo_chat_messages')
    .select('*')
    .eq('duo_code', duoCode)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? data : [];
}

export async function sendChatMessage(duoCode, senderId, content, imageUrl = null) {
  const supabase = await getChatClient();
  const row = {
    duo_code: duoCode,
    sender_id: senderId,
    content: content || null,
    image_url: imageUrl || null
  };
  const { data, error } = await supabase
    .from('duo_chat_messages')
    .insert(row)
    .select('*')
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function uploadChatImage(duoCode, file) {
  const supabase = await getChatClient();
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `${duoCode}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('chat-media').upload(path, file, {
    contentType: file.type || 'image/jpeg'
  });
  if (error) throw new Error(error.message);
  return supabase.storage.from('chat-media').getPublicUrl(path).data.publicUrl;
}

export async function markChatSeen(ids) {
  if (!ids?.length) return;
  const supabase = await getChatClient();
  const { error } = await supabase
    .from('duo_chat_messages')
    .update({ seen_at: new Date().toISOString() })
    .in('id', ids)
    .is('seen_at', null);
  if (error) throw new Error(error.message);
}

/* Call events stored as special content so they show in chat history. */
const CALL_PREFIX = '⟦duo:call⟧';

export function encodeCallEvent({ kind, video }) {
  return CALL_PREFIX + JSON.stringify({ kind, video: !!video });
}

export function parseCallEvent(content) {
  if (typeof content !== 'string' || !content.startsWith(CALL_PREFIX)) return null;
  try {
    const data = JSON.parse(content.slice(CALL_PREFIX.length));
    if (!data || typeof data.kind !== 'string') return null;
    return { kind: data.kind, video: !!data.video };
  } catch {
    return null;
  }
}

export async function sendCallEvent(duoCode, senderId, { kind, video }) {
  return sendChatMessage(duoCode, senderId, encodeCallEvent({ kind, video }));
}
