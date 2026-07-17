// src/lib/numberfortress.js — Number Fortress PURE helpers.

import { QUESTIONS } from './nf_questions.js';

export const START_BUDGET = 100;
export const ROUNDS = 10;
export const MIN_BID = 5;
export const MAX_BID = 30;
export const ANSWER_SECONDS = 25;

export { QUESTIONS, TOPICS } from './nf_questions.js';

export function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Deterministic pick so both devices get the same 10 questions.
export function pickQuestions(seedStr, n = ROUNDS) {
  const rng = mulberry32(hashSeed(String(seedStr)));
  const pool = QUESTIONS.map(q => ({ ...q }));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const picked = [];
  const perTopic = {};
  for (const q of pool) {
    if ((perTopic[q.t] || 0) >= 2) continue;
    perTopic[q.t] = (perTopic[q.t] || 0) + 1;
    picked.push(q);
    if (picked.length === n) break;
  }
  return picked.sort((a, b) => a.d - b.d);
}

export function decideWinner(budgetA, budgetB) {
  if (budgetA > budgetB) return 'A';
  if (budgetB > budgetA) return 'B';
  return 'draw';
}
