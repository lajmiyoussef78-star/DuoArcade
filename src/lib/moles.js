// src/lib/moles.js — Mole Duel PURE schedule / settle logic.

export const MOLE = {
  HOLES: 9,          // 3x3 grid
  COUNT: 20,         // moles per match
  GAP_MIN: 650,      // ms between mole spawns (start)
  GAP_MAX: 1050,     // ms between spawns (start); shrinks as match progresses
  UP_MS: 1150,       // how long a mole stays up (start); shrinks too
  UP_MIN: 620,       // floor for up-time
  GOLD_CHANCE: 0.16, // golden moles worth 3
  GOLD_POINTS: 3,
  NORMAL_POINTS: 1
};

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Deterministic mole schedule from a shared seed: identical on both devices.
export function moleSchedule(seed) {
  const rnd = mulberry32(seed);
  const moles = [];
  let clock = 800;
  let lastHole = -1;
  for (let i = 0; i < MOLE.COUNT; i++) {
    const prog = i / MOLE.COUNT;
    const gapMin = MOLE.GAP_MIN - prog * 300;
    const gapMax = MOLE.GAP_MAX - prog * 380;
    const upMs = Math.max(MOLE.UP_MIN, MOLE.UP_MS - prog * 430);

    let hole = Math.floor(rnd() * MOLE.HOLES);
    if (hole === lastHole) hole = (hole + 1 + Math.floor(rnd() * (MOLE.HOLES - 1))) % MOLE.HOLES;
    lastHole = hole;

    const gold = rnd() < MOLE.GOLD_CHANCE;
    moles.push({ id: i, hole, up: Math.round(clock), downAt: Math.round(clock + upMs), gold });
    clock += gapMax - rnd() * (gapMax - gapMin);
  }
  return moles;
}

export function matchDurationMs(schedule) {
  if (!schedule.length) return 0;
  return schedule[schedule.length - 1].downAt + 500;
}

export function pointsFor(mole) {
  return mole.gold ? MOLE.GOLD_POINTS : MOLE.NORMAL_POINTS;
}

export function settle(schedule, whacksA, whacksB) {
  let scoreA = 0, scoreB = 0;
  const claims = {};
  for (const m of schedule) {
    const ra = whacksA[m.id], rb = whacksB[m.id];
    const hasA = typeof ra === 'number', hasB = typeof rb === 'number';
    let who = null;
    if (hasA && hasB) who = ra < rb ? 'A' : rb < ra ? 'B' : null;
    else if (hasA) who = 'A';
    else if (hasB) who = 'B';
    claims[m.id] = who;
    if (who === 'A') scoreA += pointsFor(m);
    else if (who === 'B') scoreB += pointsFor(m);
  }
  return { scoreA, scoreB, claims };
}

export function winnerOf(scoreA, scoreB) {
  return scoreA === scoreB ? 'draw' : (scoreA > scoreB ? 'A' : 'B');
}
