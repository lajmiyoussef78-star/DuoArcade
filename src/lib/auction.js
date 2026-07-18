// src/lib/auction.js — Auction Duel PURE logic (used by the auctionduel engine).

export const START_COINS = 100;
export const LOTS_PER_GAME = 20;
export const MIN_VALUE = 1;
export const MAX_VALUE = 10;

// Full cabinet: values 1–10, two cards each → 20 lots.
export function makeCardPool() {
  const pool = [];
  for (let v = MIN_VALUE; v <= MAX_VALUE; v++) {
    pool.push({ id: `v${v}a`, pts: v, name: String(v), emoji: String(v) });
    pool.push({ id: `v${v}b`, pts: v, name: String(v), emoji: String(v) });
  }
  return pool;
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

// Deterministic shuffle so both devices auction the same 20 cards.
export function buildDeck(seed, n = LOTS_PER_GAME) {
  const rnd = mulberry32(seed);
  const pool = makeCardPool();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(n, pool.length));
}

// Higher bid wins; BOTH bids are spent. Exact tie => nobody wins the lot.
export function resolveLot(bidA, bidB) {
  const a = Math.max(0, Math.floor(bidA) || 0);
  const b = Math.max(0, Math.floor(bidB) || 0);
  let winner = null;
  if (a > b) winner = 'A';
  else if (b > a) winner = 'B';
  return { winner, spentA: a, spentB: b };
}

export function clampBid(bid, remaining) {
  let v = Math.floor(Number(bid) || 0);
  if (v < 0) v = 0;
  if (v > remaining) v = remaining;
  return v;
}

export function scoreTrophies(wonA, wonB) {
  const sum = arr => arr.reduce((s, t) => s + (t.pts || 0), 0);
  return { pointsA: sum(wonA), pointsB: sum(wonB) };
}

// Most title-points → more trophies → more coins left → draw.
export function decideWinner(pointsA, pointsB, countA, countB, coinsLeftA, coinsLeftB) {
  if (pointsA !== pointsB) return pointsA > pointsB ? 'A' : 'B';
  if (countA !== countB) return countA > countB ? 'A' : 'B';
  if (coinsLeftA !== coinsLeftB) return coinsLeftA > coinsLeftB ? 'A' : 'B';
  return 'draw';
}
