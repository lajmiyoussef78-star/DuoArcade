// src/lib/xp.js — Duo shared XP (Supabase + pure level/title math).

import { CONFIG } from './config.js';

let clientPromise = null;

async function getClient() {
  if (!clientPromise) {
    const { createClient } = await import('@supabase/supabase-js');
    clientPromise = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  }
  return clientPromise;
}

/** Award 10 XP for a finished match (side A only). Fire-and-forget safe. */
export async function awardXp(code, gameId) {
  const supabase = await getClient();
  const { data, error } = await supabase.rpc('award_duo_xp', {
    p_duo_code: code,
    p_game_id: gameId
  });
  if (error) throw new Error(error.message);
  return data;
}

/** Caller's duo total XP + today's per-game counts. */
export async function getMyXp(code) {
  const supabase = await getClient();
  const { data, error } = await supabase.rpc('get_my_xp', { p_duo_code: code });
  if (error) throw new Error(error.message);
  return data;
}

/** Global board (no duo codes) + caller's own row/rank. */
export async function getLeaderboard(limit = 50) {
  const supabase = await getClient();
  const { data, error } = await supabase.rpc('get_xp_leaderboard', { p_limit: limit });
  if (error) throw new Error(error.message);
  return data;
}

/* ===== PURE (no imports below this line) ===== */

/** Cost to advance from level L to L+1. */
export function xpToNext(level) {
  return 100 + 40 * (level - 1);
}

/**
 * @param {number} totalXp
 * @returns {{ level: number, intoLevel: number, needed: number }}
 */
export function levelFromXp(totalXp) {
  let xp = Math.max(0, Math.floor(Number(totalXp) || 0));
  let level = 1;
  for (;;) {
    const needed = xpToNext(level);
    if (xp < needed) return { level, intoLevel: xp, needed };
    xp -= needed;
    level += 1;
  }
}

/** Exact title ladder — highest threshold where level >= threshold wins. */
export const TITLES = [
  [1, 'New Sparks'],
  [3, 'Game Night Regulars'],
  [6, 'Rival Sweethearts'],
  [10, 'Partners in Crime'],
  [14, 'Tag Team'],
  [18, 'Synced Souls'],
  [22, 'Arcade Royalty'],
  [27, 'Dream Duo'],
  [33, 'Legendary Lovebirds'],
  [40, 'The Eternal Two']
];

export function titleForLevel(level) {
  const L = Math.max(1, Math.floor(Number(level) || 1));
  let title = TITLES[0][1];
  for (let i = 0; i < TITLES.length; i++) {
    if (L >= TITLES[i][0]) title = TITLES[i][1];
  }
  return title;
}
