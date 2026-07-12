// engines/dots.js — Dots & Boxes, 4×4 boxes, complete-a-box-go-again rule.
export const meta = { id: 'dots', name: 'Dots & Boxes', tag: 'the sneaky one', realtime: false };

const N = 4; // boxes per side

export function initialState() {
  return {
    // h[r][c]: horizontal edge above box-row r (5 rows of 4 edges)
    h: Array.from({ length: N + 1 }, () => Array(N).fill(false)),
    // v[r][c]: vertical edge left of box-col c (4 rows of 5 edges)
    v: Array.from({ length: N }, () => Array(N + 1).fill(false)),
    boxes: Array.from({ length: N }, () => Array(N).fill(null))
  };
}

function boxClosed(gs, r, c) {
  return gs.h[r][c] && gs.h[r + 1][c] && gs.v[r][c] && gs.v[r][c + 1];
}

export function applyMove(gs, m, player) {
  if (!m || (m.t !== 'h' && m.t !== 'v')) return null;
  const { t, r, c } = m;
  if (!Number.isInteger(r) || !Number.isInteger(c)) return null;
  if (t === 'h' && (r < 0 || r > N || c < 0 || c >= N)) return null;
  if (t === 'v' && (r < 0 || r >= N || c < 0 || c > N)) return null;
  if (gs[t][r][c]) return null;

  const next = {
    h: gs.h.map(row => row.slice()),
    v: gs.v.map(row => row.slice()),
    boxes: gs.boxes.map(row => row.slice())
  };
  next[t][r][c] = true;

  // which boxes could this edge have completed?
  const candidates = t === 'h'
    ? [[r - 1, c], [r, c]]
    : [[r, c - 1], [r, c]];
  let again = false;
  for (const [br, bc] of candidates) {
    if (br < 0 || br >= N || bc < 0 || bc >= N) continue;
    if (next.boxes[br][bc] === null && boxClosed(next, br, bc)) {
      next.boxes[br][bc] = player;
      again = true;
    }
  }
  return { gs: next, again };
}

export function score(gs) {
  let a = 0, b = 0;
  for (const row of gs.boxes) for (const own of row) {
    if (own === 'A') a++; else if (own === 'B') b++;
  }
  return { a, b };
}

export function winner(gs) {
  const { a, b } = score(gs);
  if (a + b < N * N) return null;
  return a > b ? 'A' : b > a ? 'B' : 'draw';
}

export function render(host, gs, { myRole, turn, winner: w, onMove }) {
  host.innerHTML = '';
  const wrap = document.createElement('div');
  const grid = document.createElement('div');
  grid.className = 'dots-grid';
  const canPlay = !w && turn === myRole;
  // grid rows alternate: dot/h-edge rows and v-edge/box rows
  for (let gr = 0; gr <= 2 * N; gr++) {
    for (let gc = 0; gc <= 2 * N; gc++) {
      const evenR = gr % 2 === 0, evenC = gc % 2 === 0;
      if (evenR && evenC) {
        const d = document.createElement('div');
        d.className = 'dots-dot';
        grid.appendChild(d);
      } else if (evenR) { // horizontal edge
        const r = gr / 2, c = (gc - 1) / 2;
        const on = gs.h[r][c];
        const b = document.createElement('button');
        b.className = 'dots-edge h' + (on ? ' on' : '');
        b.disabled = on || !canPlay;
        b.addEventListener('click', () => onMove({ t: 'h', r, c }));
        grid.appendChild(b);
      } else if (evenC) { // vertical edge
        const r = (gr - 1) / 2, c = gc / 2;
        const on = gs.v[r][c];
        const b = document.createElement('button');
        b.className = 'dots-edge v' + (on ? ' on' : '');
        b.disabled = on || !canPlay;
        b.addEventListener('click', () => onMove({ t: 'v', r, c }));
        grid.appendChild(b);
      } else { // box
        const r = (gr - 1) / 2, c = (gc - 1) / 2;
        const own = gs.boxes[r][c];
        const d = document.createElement('div');
        d.className = 'dots-box' + (own ? ' ' + own : '');
        grid.appendChild(d);
      }
    }
  }
  wrap.appendChild(grid);
  const sc = score(gs);
  const line = document.createElement('div');
  line.className = 'dots-score';
  line.textContent = `boxes ${sc.a} \u2013 ${sc.b} \u00b7 complete a box, go again`;
  wrap.appendChild(line);
  host.appendChild(wrap);
}
