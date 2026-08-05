// src/lib/roomChat.js — per-game-room chat (not partner chat).

import { CONFIG } from './config.js';
import { getSupabase } from './supabaseClient.js';

export function roomChatConfigured() {
  return CONFIG.SUPABASE_URL && !CONFIG.SUPABASE_URL.includes('YOUR-PROJECT');
}

/** Stable id for one invite/lobby/match — new session = new room thread. */
export function roomIdForSession(session) {
  if (!session?.game || !session?.startedAt) return null;
  return `${session.game}:${session.startedAt}`;
}

export async function listRoomMessages(duoCode, roomId) {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('duo_room_messages')
    .select('*')
    .eq('duo_code', duoCode)
    .eq('room_id', roomId)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? data : [];
}

export async function sendRoomMessage(duoCode, roomId, { role, senderId, content }) {
  const supabase = await getSupabase();
  const row = {
    duo_code: duoCode,
    room_id: roomId,
    role,
    sender_id: senderId,
    content: content.trim(),
  };
  const { data, error } = await supabase
    .from('duo_room_messages')
    .insert(row)
    .select('*')
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}
