// src/lib/wordbomb.js — Word Bomb data layer + PURE logic.
// Pure section (below the marker) has no imports.

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
  const { data: u } = await supabase.auth.getUser();
  const uid = u?.user?.id;
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

export async function loadWordBomb(code) {
  const supabase = await getClient();
  const { data, error } = await supabase
    .from('wordbomb_results').select('wins_a, wins_b').eq('duo_code', code).maybeSingle();
  if (error || !data) return { a: 0, b: 0 };
  return { a: data.wins_a, b: data.wins_b };
}

export async function recordWordBomb(code, winner) {
  const supabase = await getClient();
  const { data, error } = await supabase.rpc('record_wordbomb', { p_duo_code: code, p_winner: winner });
  if (error) throw new Error(error.message);
  return data;
}

export async function bombChannel(code) {
  const supabase = await getClient();
  let cb = () => {};
  const ch = supabase
    .channel('wordbomb-' + code, { config: { broadcast: { self: false } } })
    .on('broadcast', { event: 'm' }, p => cb(p.payload))
    .subscribe();
  return {
    send: payload => ch.send({ type: 'broadcast', event: 'm', payload }),
    on: fn => { cb = fn; },
    close: () => supabase.removeChannel(ch)
  };
}

/* ================= PURE (no imports below this line) ================= */

export const LIVES = 3;
export const MIN_LEN = 3;
export const FUSE_MIN_MS = 22000;   // hidden fuse: 22–42s per round
export const FUSE_MAX_MS = 42000;

// Common 2-3 letter fragments, roughly ordered easy -> harder.
export const FRAGMENTS = [
  'AN', 'ER', 'IN', 'ON', 'AT', 'EN', 'OR', 'AR', 'TE', 'ST',
  'RE', 'LE', 'AL', 'TH', 'CH', 'SH', 'CK', 'LL', 'OO', 'EE',
  'ING', 'TER', 'ION', 'ENT', 'AND', 'BLE', 'OUS', 'ART', 'IST', 'ONE',
  'AGE', 'ACE', 'IGH', 'OUGH', 'QU', 'MB', 'RT', 'ND', 'SP', 'TR'
];

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Deterministic infinite-ish fragment sequence from a seed: a shuffled
// pass over FRAGMENTS, reshuffled per cycle. Same on both devices.
export function fragmentAt(seed, index) {
  const cycle = Math.floor(index / FRAGMENTS.length);
  const pos = index % FRAGMENTS.length;
  const rnd = mulberry32((seed ^ (cycle * 2654435761)) >>> 0);
  const pool = [...FRAGMENTS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool[pos];
}

// Hidden fuse duration for a round — deterministic, so a host isn't even
// needed to agree on WHEN (we still let A adjudicate WHO, for clock skew).
export function fuseDuration(seed, round) {
  const rnd = mulberry32((seed ^ (round * 40503)) >>> 0);
  return Math.round(FUSE_MIN_MS + rnd() * (FUSE_MAX_MS - FUSE_MIN_MS));
}

// Validate a submitted word. Returns { ok, reason }.
export function validateWord(word, fragment, usedSet) {
  const w = String(word || '').trim().toLowerCase();
  if (w.length < MIN_LEN) return { ok: false, reason: `at least ${MIN_LEN} letters` };
  if (!/^[a-z]+$/.test(w)) return { ok: false, reason: 'letters only' };
  if (!w.includes(String(fragment).toLowerCase())) return { ok: false, reason: `must contain "${fragment}"` };
  if (usedSet.has(w)) return { ok: false, reason: 'already used this match' };
  return { ok: true, word: w };
}
