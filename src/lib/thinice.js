// src/lib/thinice.js — Thin Ice pure engine.
//
// 6×6 ice grid: move to any adjacent intact tile (8 directions).
// The tile you leave breaks forever. No legal move on your turn → you fall.

export const N = 6;
export const WIN_ROUNDS = 3;

// Rotationally symmetric starts: A mid-left, B mid-right.
export const START = { A: [2, 0], B: [3, 5] };

export function initialRound(starter) {
  const broken = Array.from({ length: N }, () => Array(N).fill(false));
  return {
    broken,
    pos: { A: [...START.A], B: [...START.B] },
    turn: starter,
    loser: null
  };
}

const inside = (r, c) => r >= 0 && r < N && c >= 0 && c < N;

export function legalMoves(round, player) {
  const [r, c] = round.pos[player];
  const oppP = player === 'A' ? 'B' : 'A';
  const [or_, oc] = round.pos[oppP];
  const out = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (!dr && !dc) continue;
    const nr = r + dr, nc = c + dc;
    if (!inside(nr, nc)) continue;
    if (round.broken[nr][nc]) continue;
    if (nr === or_ && nc === oc) continue;
    out.push([nr, nc]);
  }
  return out;
}

export function applyRoundMove(round, by, to) {
  if (round.loser) return { ...round, error: 'Round over' };
  if (round.turn !== by) return { ...round, error: 'Not your turn' };
  const legal = legalMoves(round, by);
  const ok = legal.some(([r, c]) => r === to[0] && c === to[1]);
  if (!ok) return { ...round, error: 'Illegal move' };

  const broken = round.broken.map(row => [...row]);
  const [fr, fc] = round.pos[by];
  broken[fr][fc] = true;
  const pos = { A: [...round.pos.A], B: [...round.pos.B] };
  pos[by] = [to[0], to[1]];

  const opp = by === 'A' ? 'B' : 'A';
  const next = { broken, pos, turn: opp, loser: null };
  if (legalMoves(next, opp).length === 0) next.loser = opp;
  return next;
}

export function intactCount(round) {
  let n = 0;
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!round.broken[r][c]) n++;
  return n;
}
