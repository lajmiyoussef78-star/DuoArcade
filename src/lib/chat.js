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

export function encodeCallEvent({ kind, video, seconds }) {
  const payload = { kind, video: !!video };
  if (kind === 'ended' && Number.isFinite(seconds)) {
    payload.seconds = Math.max(0, Math.floor(seconds));
  }
  return CALL_PREFIX + JSON.stringify(payload);
}

export function parseCallEvent(content) {
  if (typeof content !== 'string' || !content.startsWith(CALL_PREFIX)) return null;
  try {
    const data = JSON.parse(content.slice(CALL_PREFIX.length));
    if (!data || typeof data.kind !== 'string') return null;
    return {
      kind: data.kind,
      video: !!data.video,
      seconds: Number.isFinite(data.seconds) ? Math.max(0, Math.floor(data.seconds)) : 0
    };
  } catch {
    return null;
  }
}

export async function sendCallEvent(duoCode, senderId, { kind, video, seconds }) {
  return sendChatMessage(duoCode, senderId, encodeCallEvent({ kind, video, seconds }));
}

/* Game chat events: started (once per shelf visit) + ended (on quit, with score). */
const GAME_PREFIX = '⟦duo:game⟧';

export function encodeGameEvent(payload) {
  let kind = payload?.kind;
  if (kind === 'session' || kind === 'finished') kind = 'ended';
  if (kind !== 'started' && kind !== 'ended') kind = 'ended';
  const body = {
    kind,
    gameId: payload?.gameId || null,
    name: (typeof payload?.name === 'string' && payload.name.trim()) ? payload.name.trim() : 'a game'
  };
  if (kind === 'ended') {
    body.winner = payload?.winner === 'A' || payload?.winner === 'B' || payload?.winner === 'draw'
      ? payload.winner
      : 'draw';
    body.winnerName = typeof payload?.winnerName === 'string' ? payload.winnerName : null;
    body.nameA = typeof payload?.nameA === 'string' ? payload.nameA : null;
    body.nameB = typeof payload?.nameB === 'string' ? payload.nameB : null;
    body.rounds = Number.isFinite(payload?.rounds)
      ? Math.max(0, Math.floor(payload.rounds))
      : (Number.isFinite(payload?.played) ? Math.max(0, Math.floor(payload.played)) : 0);
    body.recordA = Number.isFinite(payload?.recordA) ? Math.max(0, Math.floor(payload.recordA)) : 0;
    body.recordB = Number.isFinite(payload?.recordB) ? Math.max(0, Math.floor(payload.recordB)) : 0;
    body.draws = Number.isFinite(payload?.draws) ? Math.max(0, Math.floor(payload.draws)) : 0;
  }
  return GAME_PREFIX + JSON.stringify(body);
}

export function parseGameEvent(content) {
  if (typeof content !== 'string' || !content.startsWith(GAME_PREFIX)) return null;
  try {
    const data = JSON.parse(content.slice(GAME_PREFIX.length));
    if (!data) return null;
    let kind = data.kind;
    if (kind === 'session' || kind === 'finished') kind = 'ended';
    if (kind !== 'started' && kind !== 'ended') return null;
    const base = {
      kind,
      gameId: typeof data.gameId === 'string' ? data.gameId : null,
      name: typeof data.name === 'string' && data.name.trim() ? data.name.trim() : 'a game'
    };
    if (kind === 'started') return base;
    return {
      ...base,
      winner: data.winner === 'A' || data.winner === 'B' || data.winner === 'draw' ? data.winner : 'draw',
      winnerName: typeof data.winnerName === 'string' && data.winnerName.trim() ? data.winnerName.trim() : null,
      nameA: typeof data.nameA === 'string' && data.nameA.trim() ? data.nameA.trim() : null,
      nameB: typeof data.nameB === 'string' && data.nameB.trim() ? data.nameB.trim() : null,
      rounds: Number.isFinite(data.rounds)
        ? Math.max(0, Math.floor(data.rounds))
        : (Number.isFinite(data.played) ? Math.max(0, Math.floor(data.played)) : 0),
      recordA: Number.isFinite(data.recordA) ? Math.max(0, Math.floor(data.recordA)) : 0,
      recordB: Number.isFinite(data.recordB) ? Math.max(0, Math.floor(data.recordB)) : 0,
      draws: Number.isFinite(data.draws) ? Math.max(0, Math.floor(data.draws)) : 0
    };
  } catch {
    return null;
  }
}

export async function sendGameEvent(duoCode, senderId, payload) {
  return sendChatMessage(duoCode, senderId, encodeGameEvent(payload));
}
