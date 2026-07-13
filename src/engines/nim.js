// engines/nim.js — misère Nim: four rows of sticks, take any number from one
// row, whoever takes the LAST stick loses.
export const meta = { id: 'nim', name: 'Sticks', tag: 'the last stick loses', realtime: false };

const START = [1, 3, 5, 7];

export function initialState() {
  return { rows: START.slice(), lastMover: null };
}

export function applyMove(gs, m, player) {
  if (!m || !Number.isInteger(m.row) || !Number.isInteger(m.take)) return null;
  const { row, take } = m;
  if (row < 0 || row >= gs.rows.length) return null;
  if (take < 1 || take > gs.rows[row]) return null;
  const rows = gs.rows.slice();
  rows[row] -= take;
  return { gs: { rows, lastMover: player }, again: false };
}

export function winner(gs) {
  if (gs.rows.some(n => n > 0)) return null;
  // misère: whoever took the last stick loses
  return gs.lastMover === 'A' ? 'B' : 'A';
}

export function render(host, gs, { myRole, turn, winner: w, onMove }) {
  host.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'nim-wrap';
  const canPlay = !w && turn === myRole;

  gs.rows.forEach((count, row) => {
    const line = document.createElement('div');
    line.className = 'nim-row';
    for (let i = 0; i < START[row]; i++) {
      const stick = document.createElement('button');
      const gone = i >= count;
      stick.className = 'nim-stick' + (gone ? ' gone' : '');
      stick.disabled = gone || !canPlay;
      // clicking stick i takes it and every stick to its right in the row
      const take = count - i;
      if (!gone) stick.title = `take ${take}`;
      stick.addEventListener('click', () => onMove({ row, take }));
      line.appendChild(stick);
    }
    wrap.appendChild(line);
  });

  const hint = document.createElement('div');
  hint.className = 'dots-score';
  hint.textContent = canPlay
    ? 'tap a stick — you take it and everything right of it'
    : 'take any number from one row · last stick loses';
  wrap.appendChild(hint);
  host.appendChild(wrap);
}
