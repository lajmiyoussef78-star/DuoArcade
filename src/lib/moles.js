// src/lib/moles.js — Heart Duel (moleduel) PURE schedule / settle logic.

export const MOLE = {
  HOLES: 16,         // 4×4 grid
  COUNT: 36,         // pops per match (~longer game)
  GAP_MIN: 720,
  GAP_MAX: 1180,
  UP_MS: 1280,
  UP_MIN: 680,
  RING_CHANCE: 0.14, // bonus hearts (was gold)
  RING_POINTS: 3,
  BOMB_CHANCE: 0.12, // broken hearts — hit = penalty
  BOMB_PENALTY: 2,
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

// Deterministic schedule from a shared seed: identical on both devices.
export function moleSchedule(seed) {
  const rnd = mulberry32(seed >>> 0);
  const moles = [];
  let clock = 900;
  let lastHole = -1;
  for (let i = 0; i < MOLE.COUNT; i++) {
    const prog = i / MOLE.COUNT;
    const gapMin = MOLE.GAP_MIN - prog * 280;
    const gapMax = MOLE.GAP_MAX - prog * 360;
    const upMs = Math.max(MOLE.UP_MIN, MOLE.UP_MS - prog * 400);

    let hole = Math.floor(rnd() * MOLE.HOLES);
    if (hole === lastHole) hole = (hole + 1 + Math.floor(rnd() * (MOLE.HOLES - 1))) % MOLE.HOLES;
    lastHole = hole;

    const roll = rnd();
    let kind = 'heart';
    if (roll < MOLE.BOMB_CHANCE) kind = 'bomb';
    else if (roll < MOLE.BOMB_CHANCE + MOLE.RING_CHANCE) kind = 'ring';

    moles.push({
      id: i,
      hole,
      up: Math.round(clock),
      downAt: Math.round(clock + upMs),
      kind,
      // legacy flag so older settle paths stay safe
      gold: kind === 'ring'
    });
    clock += gapMax - rnd() * (gapMax - gapMin);
  }
  return moles;
}

export function matchDurationMs(schedule) {
  if (!schedule.length) return 0;
  return schedule[schedule.length - 1].downAt + 600;
}

export function pointsFor(mole) {
  if (mole.kind === 'bomb') return -MOLE.BOMB_PENALTY;
  if (mole.kind === 'ring' || mole.gold) return MOLE.RING_POINTS;
  return MOLE.NORMAL_POINTS;
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
    if (!who) continue;
    const pts = pointsFor(m);
    if (who === 'A') scoreA += pts;
    else scoreB += pts;
  }
  return { scoreA, scoreB, claims };
}

export function winnerOf(scoreA, scoreB) {
  return scoreA === scoreB ? 'draw' : (scoreA > scoreB ? 'A' : 'B');
}
