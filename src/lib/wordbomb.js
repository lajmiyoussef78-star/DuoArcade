// src/lib/wordbomb.js — Word Bomb PURE logic (used by the wordbomb engine).

export const LIVES = 3;
export const MIN_LEN = 3;
export const FUSE_MIN_MS = 30000;   // hidden fuse: 30–60s per round
export const FUSE_MAX_MS = 60000;

// Always exactly 2 letters per bomb.
export const FRAGMENTS = [
  'AN', 'ER', 'IN', 'ON', 'AT', 'EN', 'OR', 'AR', 'TE', 'ST',
  'RE', 'LE', 'AL', 'TH', 'CH', 'SH', 'CK', 'LL', 'OO', 'EE',
  'QU', 'MB', 'RT', 'ND', 'SP', 'TR', 'NG', 'ED', 'LY', 'TY',
  'OU', 'EA', 'AI', 'OI', 'OW', 'UN', 'UM', 'IT', 'IS', 'AS'
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

// Fresh random 2-letter fragment for this round + pass (same on both devices).
export function fragmentAt(seed, round = 0, pass = 0) {
  const rnd = mulberry32((seed ^ (round * 0x9E3779B9) ^ ((pass + 1) * 0x85EBCA6B)) >>> 0);
  return FRAGMENTS[Math.floor(rnd() * FRAGMENTS.length)];
}

// Hidden fuse duration for a round — deterministic on both devices.
export function fuseDuration(seed, round) {
  const rnd = mulberry32((seed ^ (round * 40503)) >>> 0);
  return Math.round(FUSE_MIN_MS + rnd() * (FUSE_MAX_MS - FUSE_MIN_MS));
}

// Validate a submitted word. Pass `isEnglish` when the dictionary is ready.
// Returns { ok, reason }.
export function validateWord(word, fragment, usedSet, isEnglish) {
  const w = String(word || '').trim().toLowerCase();
  if (w.length < MIN_LEN) return { ok: false, reason: `at least ${MIN_LEN} letters` };
  if (!/^[a-z]+$/.test(w)) return { ok: false, reason: 'letters only' };
  if (!w.includes(String(fragment).toLowerCase())) return { ok: false, reason: `must contain "${fragment}"` };
  if (usedSet.has(w)) return { ok: false, reason: 'already used this match' };
  if (typeof isEnglish === 'function') {
    if (!isEnglish(w)) return { ok: false, reason: 'not in the English dictionary' };
  }
  return { ok: true, word: w };
}
