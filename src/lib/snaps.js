// src/lib/snaps.js — "Today's snap" data layer.

import { CONFIG } from './config.js';

let clientPromise = null;

async function getClient() {
  if (!clientPromise) {
    const { createClient } = await import('@supabase/supabase-js');
    clientPromise = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  }
  return clientPromise;
}

export const todayStr = () => new Date().toLocaleDateString('en-CA');

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

export async function loadSnap(code, day) {
  const supabase = await getClient();
  const { data, error } = await supabase
    .from('photo_moments').select('*')
    .eq('duo_code', code).eq('day', day).maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? null;
}

export async function listSnaps(code, limit = 10) {
  const supabase = await getClient();
  const { data, error } = await supabase
    .from('photo_moments').select('day, photo_a, photo_b')
    .eq('duo_code', code)
    .not('photo_a', 'is', null).not('photo_b', 'is', null)
    .order('day', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function saveSnap(code, day, photoDataUrl) {
  const supabase = await getClient();
  const { data, error } = await supabase.rpc('save_snap', {
    p_duo_code: code, p_day: day, p_photo: photoDataUrl
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function snapChannel(code) {
  const supabase = await getClient();
  let cb = () => {};
  const ch = supabase
    .channel('snap-' + code, { config: { broadcast: { self: false } } })
    .on('broadcast', { event: 'm' }, p => cb(p.payload))
    .subscribe();
  return {
    send: payload => ch.send({ type: 'broadcast', event: 'm', payload }),
    on: fn => { cb = fn; },
    close: () => supabase.removeChannel(ch)
  };
}
