// engines/ttt.js — Ultimate Tic-Tac-Toe (turn-based engine interface)
// Nine small boards → one large board. Play on any open board each turn.

export const meta = {
  id: 'ttt',
  name: 'Ultimate Tic-Tac-Toe',
  tag: 'nine boards, one war',
  realtime: false
};

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

function lineWinner(cells) {
  for (const [a, b, c] of LINES) {
    if (cells[a] && cells[a] === cells[b] && cells[a] === cells[c]) return cells[a];
  }
  return cells.every(Boolean) ? 'draw' : null;
}

function emptyBoard() {
  return Array(9).fill(null);
}

export function initialState() {
  return {
    boards: Array.from({ length: 9 }, emptyBoard),
    boardWinners: Array(9).fill(null)
  };
}

function boardOpen(gs, b) {
  return !gs.boardWinners[b] && gs.boards[b].some(c => c === null);
}

function openBoards(gs) {
  return [0, 1, 2, 3, 4, 5, 6, 7, 8].filter(b => boardOpen(gs, b));
}

function parseMove(m) {
  if (Number.isInteger(m) && m >= 0 && m <= 80) {
    return { board: Math.floor(m / 9), cell: m % 9 };
  }
  if (m == null || typeof m !== 'object') return null;
  const board = m.b ?? m.board;
  const cell = m.c ?? m.cell;
  if (!Number.isInteger(board) || board < 0 || board > 8) return null;
  if (!Number.isInteger(cell) || cell < 0 || cell > 8) return null;
  return { board, cell };
}

/** Move: { b, c } or integer 0–80 (board * 9 + cell). Play anywhere open. */
export function applyMove(gs, m, player) {
  const parsed = parseMove(m);
  if (!parsed) return null;
  const { board, cell } = parsed;

  if (!boardOpen(gs, board)) return null;
  if (gs.boards[board][cell] !== null) return null;

  const boards = gs.boards.map(b => b.slice());
  boards[board][cell] = player;

  const boardWinners = gs.boardWinners.slice();
  if (!boardWinners[board]) {
    const bw = lineWinner(boards[board]);
    if (bw) boardWinners[board] = bw;
  }

  return {
    gs: { boards, boardWinners },
    again: false
  };
}

export function winner(gs) {
  const mega = gs.boardWinners.map(w => (w === 'A' || w === 'B' ? w : null));
  for (const [a, b, c] of LINES) {
    if (mega[a] && mega[a] === mega[b] && mega[a] === mega[c]) return mega[a];
  }
  if (openBoards(gs).length === 0) return 'draw';
  if (gs.boardWinners.every(Boolean)) return 'draw';
  return null;
}

export function render(host, gs, { myRole, turn, winner: w, onMove }) {
  host.innerHTML = '';
  host._uttPending = null;

  const root = document.createElement('div');
  root.className = 'utt-root';

  const hint = document.createElement('div');
  hint.className = 'utt-hint';
  if (w) {
    hint.textContent = w === 'draw' ? 'Drawn across the big board.' : 'Big board claimed.';
  } else {
    hint.textContent = 'Play on any open small board.';
  }
  root.appendChild(hint);

  const mega = document.createElement('div');
  mega.className = 'utt-mega';
  const myTurn = !w && turn === myRole;

  for (let b = 0; b < 9; b++) {
    const mini = document.createElement('div');
    const bw = gs.boardWinners[b];
    const open = boardOpen(gs, b);
    const active = myTurn && open;
    mini.className = 'utt-mini'
      + (active ? ' active' : '')
      + (bw === 'A' || bw === 'B' ? ' won-' + bw : '')
      + (bw === 'draw' ? ' drawn' : '')
      + (!active && myTurn && !bw ? ' dim' : '');

    if (bw === 'A' || bw === 'B') {
      const stamp = document.createElement('div');
      stamp.className = 'utt-stamp ' + bw;
      stamp.textContent = bw === 'A' ? '×' : '○';
      stamp.setAttribute('aria-hidden', 'true');
      mini.appendChild(stamp);
    }

    const grid = document.createElement('div');
    grid.className = 'utt-grid';
    gs.boards[b].forEach((cell, c) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'utt-cell' + (cell ? ' ' + cell : '');
      btn.textContent = cell === 'A' ? '×' : cell === 'B' ? '○' : '';
      btn.disabled = !(active && !cell);
      btn.addEventListener('click', () => onMove({ b, c }));
      grid.appendChild(btn);
    });
    mini.appendChild(grid);
    mega.appendChild(mini);
  }

  root.appendChild(mega);
  host.appendChild(root);
}
