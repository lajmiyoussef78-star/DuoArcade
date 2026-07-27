// engines/connect4.js — Connect Four (turn-based engine interface)
export const meta = { id: 'connect4', name: 'Connect Four', tag: 'the flagship classic', realtime: false };

const COLS = 7, ROWS = 6;

export function initialState() {
  return { cols: Array.from({ length: COLS }, () => []), lastDrop: null };
}

export function applyMove(gs, c, player) {
  if (!Number.isInteger(c) || c < 0 || c >= COLS) return null;
  if (gs.cols[c].length >= ROWS) return null;
  const cols = gs.cols.map(col => col.slice());
  cols[c].push(player);
  const r = cols[c].length - 1;
  return { gs: { cols, lastDrop: { c, r } }, again: false };
}

function cellAt(gs, c, r) { // r = 0 is the bottom
  return (c >= 0 && c < COLS && r >= 0 && r < ROWS) ? (gs.cols[c][r] ?? null) : null;
}

/** First winning line as [[c,r], …] length 4, or null. */
export function winningCells(gs) {
  const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const p = cellAt(gs, c, r);
      if (!p) continue;
      for (const [dc, dr] of DIRS) {
        let n = 1;
        while (cellAt(gs, c + dc * n, r + dr * n) === p) n++;
        if (n >= 4) {
          return Array.from({ length: 4 }, (_, i) => [c + dc * i, r + dr * i]);
        }
      }
    }
  }
  return null;
}

export function winner(gs) {
  const line = winningCells(gs);
  if (line) return cellAt(gs, line[0][0], line[0][1]);
  return gs.cols.every(col => col.length === ROWS) ? 'draw' : null;
}

export function render(host, gs, { myRole, turn, winner: w, onMove }) {
  host.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'c4-grid';

  const winSet = new Set();
  if (w && w !== 'draw') {
    const line = winningCells(gs);
    if (line) for (const [c, r] of line) winSet.add(c + ',' + r);
  }

  const drop = gs.lastDrop;
  const dropKey = drop ? `${drop.c},${drop.r}` : null;
  const animateDrop = dropKey && host._c4AnimKey !== dropKey;
  if (animateDrop) host._c4AnimKey = dropKey;

  // CSS grid fills row-major: visual row 0 is the top (r = ROWS-1)
  for (let vr = 0; vr < ROWS; vr++) {
    const r = ROWS - 1 - vr;
    for (let c = 0; c < COLS; c++) {
      const piece = cellAt(gs, c, r);
      const b = document.createElement('button');
      b.type = 'button';
      let cls = 'c4-slot' + (piece ? ' ' + piece : '');
      if (winSet.has(c + ',' + r)) cls += ' c4-win';
      if (animateDrop && drop && drop.c === c && drop.r === r) {
        cls += ' c4-drop';
        // Fall from above the board through empty rows above this cell.
        b.style.setProperty('--c4-fall', String(ROWS - r));
      }
      b.className = cls;
      b.disabled = !!w || turn !== myRole || gs.cols[c].length >= ROWS;
      b.addEventListener('click', () => onMove(c));
      grid.appendChild(b);
    }
  }
  host.appendChild(grid);
}
