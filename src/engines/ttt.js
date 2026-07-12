// engines/ttt.js — Tic-Tac-Toe (turn-based engine interface)
export const meta = { id: 'ttt', name: 'Tic-Tac-Toe', tag: 'the two-minute warm-up', realtime: false };

export function initialState() {
  return { cells: Array(9).fill(null) };
}

export function applyMove(gs, i, player) {
  if (!Number.isInteger(i) || i < 0 || i > 8) return null;
  if (gs.cells[i] !== null) return null;
  const cells = gs.cells.slice();
  cells[i] = player;
  return { gs: { cells }, again: false };
}

const LINES = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6]
];

export function winner(gs) {
  for (const [a,b,c] of LINES) {
    if (gs.cells[a] && gs.cells[a] === gs.cells[b] && gs.cells[a] === gs.cells[c]) return gs.cells[a];
  }
  return gs.cells.every(Boolean) ? 'draw' : null;
}

export function render(host, gs, { myRole, turn, winner: w, onMove }) {
  host.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'ttt-grid';
  gs.cells.forEach((cell, i) => {
    const b = document.createElement('button');
    b.className = 'ttt-cell' + (cell ? ' ' + cell : '');
    b.textContent = cell === 'A' ? '×' : cell === 'B' ? '○' : '';
    b.disabled = !!cell || !!w || turn !== myRole;
    b.addEventListener('click', () => onMove(i));
    grid.appendChild(b);
  });
  host.appendChild(grid);
}
