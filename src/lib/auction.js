// src/lib/auction.js — Auction Duel PURE logic (used by the auctionduel engine).

export const START_COINS = 100;
export const LOTS_PER_GAME = 10;
export const MIN_VALUE = 1;
export const MAX_VALUE = 10;

// Pool of 20 titled cards (values 1–10 ×2). Each game draws 10 at random.
export const TITLES = [
  { id: 'pixar',   emoji: '\u{1F979}', name: 'Most Likely to Cry at Pixar', pts: 1 },
  { id: 'sleepy',  emoji: '\u{1F634}', name: 'Reigning Nap Monarch', pts: 1 },
  { id: 'cook',    emoji: '\u{1F373}', name: 'The Better Cook', pts: 2 },
  { id: 'movies',  emoji: '\u{1F3AC}', name: 'Best Taste in Movies', pts: 2 },
  { id: 'funny',   emoji: '\u{1F602}', name: 'Certified Funnier One', pts: 3 },
  { id: 'memory',  emoji: '\u{1F9E0}', name: 'Keeper of All the Dates', pts: 3 },
  { id: 'parking', emoji: '\u{1F697}', name: 'Undisputed Parking Champion', pts: 4 },
  { id: 'dancer',  emoji: '\u{1F483}', name: 'Superior Dancer', pts: 4 },
  { id: 'petname', emoji: '\u{1F415}', name: 'The Pets Love More', pts: 5 },
  { id: 'texter',  emoji: '\u{1F4F1}', name: 'Fastest Text Replier', pts: 5 },
  { id: 'planner', emoji: '\u{1F5D3}', name: 'Master Plan-Maker', pts: 6 },
  { id: 'snacker', emoji: '\u{1F36B}', name: 'Snack Thief Supreme', pts: 6 },
  { id: 'driver',  emoji: '\u{1F6E3}', name: 'Best Road-Trip DJ', pts: 7 },
  { id: 'green',   emoji: '\u{1F331}', name: 'Not-Killer of Plants', pts: 7 },
  { id: 'argue',   emoji: '\u2696\uFE0F', name: 'Winner of Every Argument', pts: 8 },
  { id: 'singer',  emoji: '\u{1F3A4}', name: 'Shower Concert Legend', pts: 8 },
  { id: 'blanket', emoji: '\u{1F9CA}', name: 'Softest Blanket Hog', pts: 9 },
  { id: 'chaos',   emoji: '\u{1F525}', name: 'Chaos Chef of Leftovers', pts: 9 },
  { id: 'remote',  emoji: '\u{1F3AE}', name: 'Ultimate Remote Controller', pts: 10 },
  { id: 'right',   emoji: '\u{1F5FA}', name: 'Forever Right About Directions', pts: 10 }
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

function shuffleInPlace(arr, rnd) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Draw order: random each game, same on both devices.
export function buildDeck(seed, n = LOTS_PER_GAME) {
  const rnd = mulberry32(seed);
  const pool = TITLES.map(t => ({ ...t }));
  shuffleInPlace(pool, rnd);
  return pool.slice(0, Math.min(n, pool.length));
}

// Display order for the cabinet grid — different from draw order so
// upcoming faces stay hidden and positions don't spoil the next lot.
export function cabinetDisplayOrder(deck, seed) {
  const rnd = mulberry32((seed >>> 0) ^ 0xC0FFEE01);
  const items = deck.map((card, drawIndex) => ({ card, drawIndex }));
  shuffleInPlace(items, rnd);
  return items;
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
