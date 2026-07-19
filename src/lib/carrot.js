// src/lib/carrot.js — Carrot in a Box pure helpers (+ optional SQL tally).

import { CONFIG } from './config.js';

let clientPromise = null;

async function getClient() {
  if (!clientPromise) {
    const { createClient } = await import('@supabase/supabase-js');
    clientPromise = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  }
  return clientPromise;
}

export async function loadCarrot(code) {
  try {
    const supabase = await getClient();
    const { data, error } = await supabase
      .from('carrot_results').select('wins_a, wins_b').eq('duo_code', code).maybeSingle();
    if (error || !data) return { a: 0, b: 0 };
    return { a: data.wins_a, b: data.wins_b };
  } catch {
    return { a: 0, b: 0 };
  }
}

export async function recordCarrot(code, winner) {
  const supabase = await getClient();
  const { data, error } = await supabase.rpc('record_carrot', { p_duo_code: code, p_winner: winner });
  if (error) throw new Error(error.message);
  return data;
}

/* ================= PURE (no imports below this line) ================= */

export const WIN_SCORE = 4;   // best of 7

export const QUICK_LINES = [
  "I've got the carrot \u{1F955}",
  'My box is empty, I swear',
  'Swap. Trust me.',
  'Do NOT swap',
  '\u{1F60F}',
  'You always fall for this'
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

/** Which player's box holds the carrot this round: 'A' | 'B'. */
export function carrotHolder(seed, round) {
  return mulberry32((seed ^ (round * 2654435761)) >>> 0)() < 0.5 ? 'A' : 'B';
}

/** Who peeks (into their own box) this round — alternates, A first. */
export function peekerFor(round) {
  return round % 2 === 0 ? 'A' : 'B';
}

/** Resolve a round after the chooser keeps/swaps. */
export function roundWinner(holder, swap) {
  if (!swap) return holder;
  return holder === 'A' ? 'B' : 'A';
}
