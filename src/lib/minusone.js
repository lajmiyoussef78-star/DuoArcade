// src/lib/minusone.js — RPS Minus One pure helpers.

export const WIN_SCORE = 5;
export const KEEP_SECONDS = 8;     // soft countdown in the minus-one phase

export const GESTURES = {
  rock:     { id: 'rock',     emoji: '\u270A', name: 'Rock' },
  paper:    { id: 'paper',    emoji: '\u270B', name: 'Paper' },
  scissors: { id: 'scissors', emoji: '\u270C\uFE0F', name: 'Scissors' }
};
export const GESTURE_IDS = Object.keys(GESTURES);

// Classic RPS between the two KEPT gestures. Returns 'A' | 'B' | 'draw'.
export function duel(a, b) {
  if (a === b) return 'draw';
  const beats = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
  return beats[a] === b ? 'A' : 'B';
}
