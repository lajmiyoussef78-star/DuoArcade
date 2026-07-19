// src/lib/minusone.js — RPS Minus One pure helpers.

export const WIN_SCORE = 5;
export const KEEP_SECONDS = 8;     // soft countdown in the minus-one phase

export const GESTURES = {
  rock:     { id: 'rock',     emoji: '\u270A', name: 'Rock',     color: 'var(--p2)' },
  paper:    { id: 'paper',    emoji: '\u270B', name: 'Paper',    color: 'var(--p1)' },
  scissors: { id: 'scissors', emoji: '\u270C\uFE0F', name: 'Scissors', color: 'var(--candle)' }
};
/** Dock order matches neon reference: rock · scissors · paper */
export const GESTURE_IDS = ['rock', 'scissors', 'paper'];

// Classic RPS between the two KEPT gestures. Returns 'A' | 'B' | 'draw'.
export function duel(a, b) {
  if (a === b) return 'draw';
  const beats = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
  return beats[a] === b ? 'A' : 'B';
}

/** Blind random keep: left (0) or right (1) — ignores what is on either hand. */
export function randomKeepIndex() {
  return Math.random() < 0.5 ? 0 : 1;
}
