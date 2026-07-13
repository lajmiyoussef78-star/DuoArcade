import assert from 'node:assert/strict';
import { ARENA_SEATS, initialArenaState, readySeat, startIfDue, applyArenaMove, rematchState } from './arenaLogic.js';
import * as TTT from '../engines/ttt.js';
import * as DOTS from '../engines/dots.js';

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('✓', name); }
  catch (error) { console.error('✗', name); throw error; }
}

test('all four players must ready before countdown', () => {
  let s = initialArenaState('ttt', TTT);
  for (const seat of ARENA_SEATS.slice(0, 3)) s = readySeat(s, seat, 1000);
  assert.equal(s.phase, 'ready');
  s = readySeat(s, 'B2', 1000);
  assert.equal(s.phase, 'countdown');
  assert.equal(s.liveAt, 4500);
});

test('countdown becomes live only when due', () => {
  let s = initialArenaState('ttt', TTT);
  for (const seat of ARENA_SEATS) s = readySeat(s, seat, 1000);
  assert.equal(startIfDue(s, 4499).phase, 'countdown');
  assert.equal(startIfDue(s, 4500).phase, 'live');
});

test('strict relay rotates partners across team turns', () => {
  let s = { ...initialArenaState('ttt', TTT), phase: 'live' };
  s = applyArenaMove(s, 0, 'A1', TTT);
  assert.equal(s.activeSeat, 'B1');
  s = applyArenaMove(s, 1, 'B1', TTT);
  assert.equal(s.activeSeat, 'A2');
  s = applyArenaMove(s, 2, 'A2', TTT);
  assert.equal(s.activeSeat, 'B2');
});

test('inactive partner cannot move', () => {
  const s = { ...initialArenaState('ttt', TTT), phase: 'live' };
  assert.equal(applyArenaMove(s, 0, 'A2', TTT), null);
});

test('dots extra turn stays with team but passes to partner', () => {
  let s = { ...initialArenaState('dots', DOTS), phase: 'live' };
  // Prepare three sides of the top-left box, then A1 closes it.
  s.gs.h[0][0] = true;
  s.gs.v[0][0] = true;
  s.gs.v[0][1] = true;
  const next = applyArenaMove(s, { t: 'h', r: 1, c: 0 }, 'A1', DOTS);
  assert.equal(next.turn, 'A');
  assert.equal(next.activeSeat, 'A2');
});

test('winner finishes match and rematch swaps starter', () => {
  let s = { ...initialArenaState('ttt', TTT), phase: 'live' };
  s.gs.cells = ['A', 'A', null, 'B', 'B', null, null, null, null];
  s = applyArenaMove(s, 2, 'A1', TTT);
  assert.equal(s.winner, 'A');
  assert.equal(s.phase, 'done');
  const r = rematchState(s, TTT);
  assert.equal(r.starter, 'B');
  assert.equal(r.activeSeat, 'B1');
  assert.equal(r.phase, 'ready');
});

console.log(`\n${passed} arena logic tests passed`);
