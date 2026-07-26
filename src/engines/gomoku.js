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

/** First winning run of 5+ cells, or null. */
export function winningCells(gs) {
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const p = gs.b[r][c];
    if (!p) continue;
    for (const [dr, dc] of dirs) {
      // Only start a run at its head so we don't highlight a partial slice.
      if (at(gs.b, r - dr, c - dc) === p) continue;
      const cells = [[r, c]];
      let run = 1;
      while (at(gs.b, r + dr * run, c + dc * run) === p) {
        cells.push([r + dr * run, c + dc * run]);
        run++;
      }
      if (run >= 5) return cells;
    }
  }
  return null;
}

export function winner(gs) {
  const line = winningCells(gs);
  if (line) return gs.b[line[0][0]][line[0][1]];
  return gs.b.every(row => row.every(Boolean)) ? 'draw' : null;
}

export function render(el, gs, ctx) {
  el.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'gmk-grid' + (ctx.winner && ctx.winner !== 'draw' ? ' gmk-over' : '');
  const canPlay = !ctx.winner && ctx.turn === ctx.myRole;

  const winSet = new Set();
  if (ctx.winner && ctx.winner !== 'draw') {
    const line = winningCells(gs);
    if (line) for (const [r, c] of line) winSet.add(r + ',' + c);
  }

  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const v = gs.b[r][c];
    const cell = document.createElement('button');
    const isWin = winSet.has(r + ',' + c);
    cell.className = 'gmk-cell' + (isWin ? ' gmk-win' : '');
    cell.disabled = !!v || !canPlay;
    if (v) {
      const stone = document.createElement('div');
      stone.className = 'gmk-stone ' + v + (isWin ? ' win' : '');
      cell.appendChild(stone);
    }
    cell.addEventListener('click', () => ctx.onMove({ r, c }));
    grid.appendChild(cell);
  }
  el.appendChild(grid);
}
