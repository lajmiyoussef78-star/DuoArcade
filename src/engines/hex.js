// engines/hex.js — Hex on a 9×9 board, turn-based engine interface.
// A (blue) connects top to bottom; B (pink) connects left to right.
// No draws are possible in Hex — someone always gets across.
export const meta = { id: 'hex', name: 'Hex', tag: 'bridge your two sides', realtime: false };

const N = 9;
const idx = (r, c) => r * N + c;
const inb = (r, c) => r >= 0 && r < N && c >= 0 && c < N;
// Hexagonal adjacency on the rhombus grid.
const NEIGHBORS = [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0]];

export function initialState() {
  return { b: Array(N * N).fill(null) };
}

export function applyMove(gs, m, player) {
  if (!m || !Number.isInteger(m.r) || !Number.isInteger(m.c)) return null;
  if (!inb(m.r, m.c)) return null;
  if (gs.b[idx(m.r, m.c)] !== null) return null;
  const b = gs.b.slice();
  b[idx(m.r, m.c)] = player;
  return { gs: { b }, again: false };
}

function connected(b, player) {
  // A: rows 0 → N-1.  B: cols 0 → N-1.
  const startCells = [];
  for (let k = 0; k < N; k++) {
    const [r, c] = player === 'A' ? [0, k] : [k, 0];
    if (b[idx(r, c)] === player) startCells.push([r, c]);
  }
  const seen = new Set(startCells.map(([r, c]) => idx(r, c)));
  const queue = [...startCells];
  while (queue.length) {
    const [r, c] = queue.pop();
    if ((player === 'A' && r === N - 1) || (player === 'B' && c === N - 1)) return true;
    for (const [dr, dc] of NEIGHBORS) {
      const nr = r + dr, nc = c + dc;
      if (!inb(nr, nc)) continue;
      const i = idx(nr, nc);
      if (seen.has(i) || b[i] !== player) continue;
      seen.add(i);
      queue.push([nr, nc]);
    }
  }
  return false;
}

export function winner(gs) {
  if (connected(gs.b, 'A')) return 'A';
  if (connected(gs.b, 'B')) return 'B';
  return null;
}

/* ---------- rendering ---------- */

export function render(host, gs, { myRole, turn, winner: w, onMove }) {
  host.innerHTML = '';
  const canPlay = !w && turn === myRole;
  const CELL = 28, GAP = 3;

  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:8px;';

  const frame = document.createElement('div');
  frame.style.cssText =
    'padding:10px 14px;border-radius:16px;background:var(--room);' +
    'border-top:4px solid var(--p1);border-bottom:4px solid var(--p1);' +
    'border-left:4px solid var(--p2);border-right:4px solid var(--p2);' +
    'overflow-x:auto;max-width:100%;';

  const board = document.createElement('div');
  board.style.cssText = 'display:flex;flex-direction:column;gap:' + GAP + 'px;width:max-content;';
  for (let r = 0; r < N; r++) {
    const row = document.createElement('div');
    row.style.cssText =
      `display:flex;gap:${GAP}px;margin-left:${r * (CELL + GAP) / 2}px;`;
    for (let c = 0; c < N; c++) {
      const owner = gs.b[idx(r, c)];
      const cell = document.createElement('button');
      cell.style.cssText =
        `width:${CELL}px;height:${CELL}px;border-radius:50%;padding:0;` +
        `border:1px solid var(--line);cursor:${canPlay && !owner ? 'pointer' : 'default'};` +
        (owner === 'A' ? 'background:var(--p1);border-color:var(--p1);'
          : owner === 'B' ? 'background:var(--p2);border-color:var(--p2);'
          : 'background:var(--room2);');
      cell.disabled = !!owner || !canPlay;
      cell.addEventListener('click', () => onMove({ r, c }));
      row.appendChild(cell);
    }
    board.appendChild(row);
  }
  frame.appendChild(board);
  wrap.appendChild(frame);

  const cap = document.createElement('div');
  cap.className = 'dots-score';
  cap.textContent = 'blue links top \u2194 bottom \u00b7 pink links left \u2194 right \u00b7 no draws, ever';
  wrap.appendChild(cap);
  host.appendChild(wrap);
}
