// engines/dots.js — Dots & Boxes, complete-a-box-go-again rule.
// Edges store the player who drew them ('A' | 'B') so lines keep seat colors.
export const meta = { id: 'dots', name: 'Dots & Boxes', tag: 'the sneaky one', realtime: false };

/** Boxes per side for new matches. */
const N = 6;

/** Prefer the live board size so older in-progress matches don't crash. */
function sizeOf(gs) {
  const n = gs?.boxes?.length;
  return Number.isInteger(n) && n > 0 ? n : N;
}

export function initialState() {
  return {
    // h[r][c]: horizontal edge above box-row r — false | 'A' | 'B'
    h: Array.from({ length: N + 1 }, () => Array(N).fill(false)),
    // v[r][c]: vertical edge left of box-col c — false | 'A' | 'B'
    v: Array.from({ length: N }, () => Array(N + 1).fill(false)),
    boxes: Array.from({ length: N }, () => Array(N).fill(null))
  };
}

function boxClosed(gs, r, c) {
  return !!(gs.h[r]?.[c] && gs.h[r + 1]?.[c] && gs.v[r]?.[c] && gs.v[r]?.[c + 1]);
}

export function applyMove(gs, m, player) {
  if (!m || (m.t !== 'h' && m.t !== 'v')) return null;
  const n = sizeOf(gs);
  const { t, r, c } = m;
  if (!Number.isInteger(r) || !Number.isInteger(c)) return null;
  if (t === 'h' && (r < 0 || r > n || c < 0 || c >= n)) return null;
  if (t === 'v' && (r < 0 || r >= n || c < 0 || c > n)) return null;
  if (gs[t]?.[r]?.[c]) return null;

  const next = {
    h: gs.h.map(row => row.slice()),
    v: gs.v.map(row => row.slice()),
    boxes: gs.boxes.map(row => row.slice())
  };
  next[t][r][c] = player;

  const candidates = t === 'h'
    ? [[r - 1, c], [r, c]]
    : [[r, c - 1], [r, c]];
  let again = false;
  for (const [br, bc] of candidates) {
    if (br < 0 || br >= n || bc < 0 || bc >= n) continue;
    if (next.boxes[br][bc] === null && boxClosed(next, br, bc)) {
      next.boxes[br][bc] = player;
      again = true;
    }
  }
  return { gs: next, again };
}

export function score(gs) {
  let a = 0, b = 0;
  for (const row of gs.boxes || []) for (const own of row) {
    if (own === 'A') a++; else if (own === 'B') b++;
  }
  return { a, b };
}

export function winner(gs) {
  const n = sizeOf(gs);
  const { a, b } = score(gs);
  if (a + b < n * n) return null;
  return a > b ? 'A' : b > a ? 'B' : 'draw';
}

function edgeClass(on) {
  if (!on) return '';
  // Legacy boards stored boolean true — keep a neutral "on" style.
  if (on === true) return ' on';
  return ` on ${on}`;
}

export function render(host, gs, { myRole, turn, winner: w, onMove }) {
  host.innerHTML = '';
  if (!gs?.h || !gs?.v || !gs?.boxes) {
    const err = document.createElement('div');
    err.className = 'dots-score';
    err.textContent = 'Board loading… start a new match for the big map.';
    host.appendChild(err);
    return;
  }

  const n = sizeOf(gs);
  const wrap = document.createElement('div');
  const grid = document.createElement('div');
  grid.className = 'dots-grid';
  grid.style.gridTemplateColumns = `repeat(${n}, 10px minmax(0, 1fr)) 10px`;
  grid.style.gridTemplateRows = `repeat(${n}, 10px minmax(0, 1fr)) 10px`;
  const canPlay = !w && turn === myRole;

  for (let gr = 0; gr <= 2 * n; gr++) {
    for (let gc = 0; gc <= 2 * n; gc++) {
      const evenR = gr % 2 === 0, evenC = gc % 2 === 0;
      if (evenR && evenC) {
        const d = document.createElement('div');
        d.className = 'dots-dot';
        grid.appendChild(d);
      } else if (evenR) {
        const r = gr / 2, c = (gc - 1) / 2;
        const on = gs.h[r]?.[c];
        const b = document.createElement('button');
        b.className = 'dots-edge h' + edgeClass(on);
        b.disabled = !!on || !canPlay;
        b.addEventListener('click', () => onMove({ t: 'h', r, c }));
        grid.appendChild(b);
      } else if (evenC) {
        const r = (gr - 1) / 2, c = gc / 2;
        const on = gs.v[r]?.[c];
        const b = document.createElement('button');
        b.className = 'dots-edge v' + edgeClass(on);
        b.disabled = !!on || !canPlay;
        b.addEventListener('click', () => onMove({ t: 'v', r, c }));
        grid.appendChild(b);
      } else {
        const r = (gr - 1) / 2, c = (gc - 1) / 2;
        const own = gs.boxes[r]?.[c];
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
