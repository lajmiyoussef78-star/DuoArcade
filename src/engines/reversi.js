// engines/reversi.js — Reversi/Othello on the shared engine interface.
// A = dark (moves first), B = light. Includes the pass rule: if your
// opponent has no legal move after yours, you go again.

export const meta = { id: 'reversi', name: 'Reversi', tag: 'deep · 12 min', accent: 'p1' };

const N = 8;
const DIRS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];

export function initialState() {
  const b = Array.from({ length: N }, () => Array(N).fill(null));
  b[3][3] = 'B'; b[4][4] = 'B';
  b[3][4] = 'A'; b[4][3] = 'A';
  return { b };
}

function inB(r, c) { return r >= 0 && r < N && c >= 0 && c < N; }

function flipsFor(b, r, c, player) {
  if (!inB(r, c) || b[r][c]) return [];
  const opp = player === 'A' ? 'B' : 'A';
  const out = [];
  for (const [dr, dc] of DIRS) {
    const line = [];
    let rr = r + dr, cc = c + dc;
    while (inB(rr, cc) && b[rr][cc] === opp) { line.push([rr, cc]); rr += dr; cc += dc; }
    if (line.length && inB(rr, cc) && b[rr][cc] === player) out.push(...line);
  }
  return out;
}

export function legalMoves(gs, player) {
  const out = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    if (flipsFor(gs.b, r, c, player).length) out.push({ r, c });
  }
  return out;
}

export function applyMove(gs, move, player) {
  const r = Number(move?.r), c = Number(move?.c);
  if (!Number.isInteger(r) || !Number.isInteger(c)) return null;
  const flips = flipsFor(gs.b, r, c, player);
  if (!flips.length) return null;
  const b = gs.b.map(row => row.slice());
  b[r][c] = player;
  for (const [fr, fc] of flips) b[fr][fc] = player;
  const next = { b };
  const opp = player === 'A' ? 'B' : 'A';
  const oppCan = legalMoves(next, opp).length > 0;
  const meCan = legalMoves(next, player).length > 0;
  // Pass rule: opponent stuck but I can still move -> I go again.
  return { gs: next, again: !oppCan && meCan };
}

export function count(gs) {
  let a = 0, b = 0;
  for (const row of gs.b) for (const v of row) { if (v === 'A') a++; else if (v === 'B') b++; }
  return { a, b };
}

export function winner(gs) {
  if (legalMoves(gs, 'A').length || legalMoves(gs, 'B').length) return null;
  const { a, b } = count(gs);
  return a > b ? 'A' : b > a ? 'B' : 'draw';
}

export function render(el, gs, ctx) {
  el.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'rev-grid';
  const canPlay = !ctx.winner && ctx.turn === ctx.myRole;
  const hints = canPlay ? legalMoves(gs, ctx.myRole) : [];
  const isHint = (r, c) => hints.some(m => m.r === r && m.c === c);
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const cell = document.createElement('button');
    const v = gs.b[r][c];
    cell.className = 'rev-cell' + (isHint(r, c) ? ' hint' : '');
    cell.disabled = !isHint(r, c);
    if (v) {
      const disc = document.createElement('div');
      disc.className = 'rev-disc ' + v;
      cell.appendChild(disc);
    }
    cell.addEventListener('click', () => ctx.onMove({ r, c }));
    grid.appendChild(cell);
  }
  el.appendChild(grid);
  const sc = count(gs);
  const note = document.createElement('div');
  note.className = 'dots-score';
  note.textContent = `discs: ${sc.a} \u2013 ${sc.b}`;
  el.appendChild(note);
}
