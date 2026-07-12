// engines/gomoku.js — Gomoku (five in a row) on an 11x11 board.

export const meta = { id: 'gomoku', name: 'Gomoku', tag: 'five in a row · 10 min', accent: 'p1' };

export const N = 11;

export function initialState() {
  return { b: Array.from({ length: N }, () => Array(N).fill(null)) };
}

export function applyMove(gs, move, player) {
  const r = Number(move?.r), c = Number(move?.c);
  if (!Number.isInteger(r) || !Number.isInteger(c) || r < 0 || r >= N || c < 0 || c >= N) return null;
  if (gs.b[r][c]) return null;
  const b = gs.b.map(row => row.slice());
  b[r][c] = player;
  return { gs: { b }, again: false };
}

function at(b, r, c) { return (r >= 0 && r < N && c >= 0 && c < N) ? b[r][c] : null; }

export function winner(gs) {
  const dirs = [[0,1],[1,0],[1,1],[1,-1]];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const p = gs.b[r][c];
    if (!p) continue;
    for (const [dr, dc] of dirs) {
      let run = 1;
      while (at(gs.b, r + dr*run, c + dc*run) === p) run++;
      if (run >= 5) return p;
    }
  }
  return gs.b.every(row => row.every(Boolean)) ? 'draw' : null;
}

export function render(el, gs, ctx) {
  el.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'gmk-grid';
  const canPlay = !ctx.winner && ctx.turn === ctx.myRole;
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const v = gs.b[r][c];
    const cell = document.createElement('button');
    cell.className = 'gmk-cell';
    cell.disabled = !!v || !canPlay;
    if (v) {
      const stone = document.createElement('div');
      stone.className = 'gmk-stone ' + v;
      cell.appendChild(stone);
    }
    cell.addEventListener('click', () => ctx.onMove({ r, c }));
    grid.appendChild(cell);
  }
  el.appendChild(grid);
}
