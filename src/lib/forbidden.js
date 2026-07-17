// src/lib/forbidden.js — Forbidden Words PURE helpers.

export const TOPICS = [
  'Plan our dream vacation together',
  'Describe our perfect lazy Sunday',
  'Argue about the best pizza toppings',
  'Plan a surprise party for a friend',
  'Describe your ideal house someday',
  'Talk about the best trip we\u2019ve taken',
  'Plan what we\u2019d do with a free weekend',
  'Describe your dream job',
  'What should we cook this week?',
  'Plan our next date night',
  'Recast our lives as a movie \u2014 who plays us?',
  'Argue: cats or dogs, settle it forever'
];

export const SUGGESTIONS = [
  'yes', 'no', 'the', 'and', 'like', 'love', 'good', 'want',
  'we', 'you', 'think', 'really', 'maybe', 'food', 'time', 'go',
  'nice', 'okay', 'why', 'because', 'money', 'home', 'today', 'fun'
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

export function topicForSeed(seed) {
  return TOPICS[Math.floor(mulberry32(seed)() * TOPICS.length)];
}

export function normalizeWord(w) {
  return String(w).toLowerCase().replace(/[^a-z0-9']/g, '').trim();
}

export function findSlips(message, forbiddenList) {
  const tokens = String(message).toLowerCase().split(/[^a-z0-9']+/i).map(normalizeWord).filter(Boolean);
  const set = new Set(tokens);
  const hits = [];
  for (const raw of forbiddenList) {
    const w = normalizeWord(raw);
    if (w && set.has(w)) hits.push(w);
  }
  return hits;
}

export function cleanForbidden(list) {
  const out = [];
  for (const raw of list) {
    const w = normalizeWord(raw);
    if (w && w.length >= 2 && !out.includes(w)) out.push(w);
  }
  return out;
}

export function winnerOf(slipsA, slipsB) {
  return slipsA === slipsB ? 'draw' : (slipsA < slipsB ? 'A' : 'B');
}

export const MIN_WORDS = 10;
export const QUESTIONS_EACH = 3;

export function wordCount(text) {
  return String(text).trim().split(/\s+/).filter(Boolean).length;
}

export function tiebreak(slipRoundsA, slipRoundsB) {
  const n = Math.max(slipRoundsA.length, slipRoundsB.length);
  for (let i = 0; i < n; i++) {
    const a = slipRoundsA[i] || 0, b = slipRoundsB[i] || 0;
    if (a !== b) return a < b ? 'A' : 'B';
  }
  return 'draw';
}

export function decide(totalA, totalB, slipRoundsA, slipRoundsB) {
  if (totalA !== totalB) return totalA < totalB ? 'A' : 'B';
  return tiebreak(slipRoundsA, slipRoundsB);
}
