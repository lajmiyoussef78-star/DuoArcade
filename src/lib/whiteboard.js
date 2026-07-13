// src/lib/whiteboard.js — shared whiteboard data layer.

import { CONFIG } from './config.js';

let clientPromise = null;

async function getClient() {
  if (!clientPromise) {
    const { createClient } = await import('@supabase/supabase-js');
    clientPromise = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  }
  return clientPromise;
}

export async function myRoleInDuo(code) {
  const supabase = await getClient();
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData?.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase.rpc('list_my_duos', {});
  if (error) return null;
  const d = (data || []).find(x => x.code === code);
  if (!d) return null;
  return d.member_a === uid ? 'A' : d.member_b === uid ? 'B' : null;
}

export async function duoNames(code) {
  const supabase = await getClient();
  const { data } = await supabase.rpc('list_my_duos', {});
  const d = (data || []).find(x => x.code === code);
  return d ? { A: d.name_a, B: d.name_b } : { A: 'A', B: 'B' };
}

export async function loadBoard(code) {
  const supabase = await getClient();
  const { data, error } = await supabase
    .from('whiteboards').select('strokes').eq('duo_code', code).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.strokes ?? [];
}

export async function loadBoardMeta(code) {
  const supabase = await getClient();
  const { data, error } = await supabase
    .from('whiteboards').select('strokes, updated_at').eq('duo_code', code).maybeSingle();
  if (error) throw new Error(error.message);
  return { strokes: data?.strokes ?? [], updatedAt: data?.updated_at ?? null };
}

export async function saveBoard(code, strokes) {
  const supabase = await getClient();
  const { data, error } = await supabase.rpc('save_whiteboard', {
    p_duo_code: code, p_strokes: strokes
  });
  if (error) throw new Error(error.message);
  return data === true;
}

export async function boardChannel(code) {
  const supabase = await getClient();
  let cb = () => {};
  const ch = supabase
    .channel('wb-' + code, { config: { broadcast: { self: false } } })
    .on('broadcast', { event: 'm' }, p => cb(p.payload))
    .subscribe();
  return {
    send: payload => ch.send({ type: 'broadcast', event: 'm', payload }),
    on: fn => { cb = fn; },
    close: () => supabase.removeChannel(ch)
  };
}
