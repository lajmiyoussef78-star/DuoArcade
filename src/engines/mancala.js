// engines/mancala.js — Mancala (Kalah rules), turn-based engine interface.
// Board layout: pits 0..5 = A's pits, 6 = A's store, 7..12 = B's pits, 13 = B's store.
// Land your last seed in your store → go again. Land it in your own empty pit → capture.
export const meta = { id: 'mancala', name: 'Mancala', tag: 'sow, capture, steal the turn', realtime: false };

const A_PITS = [0, 1, 2, 3, 4, 5], B_PITS = [7, 8, 9, 10, 11, 12];
const STORE = { A: 6, B: 13 };

export function initialState() {
  const pits = Array(14).fill(4);
  pits[6] = 0; pits[13] = 0;
  return { pits };
}

function sideEmpty(pits, player) {
  return (player === 'A' ? A_PITS : B_PITS).every(i => pits[i] === 0);
}

export function applyMove(gs, i, player) {
  const own = player === 'A' ? A_PITS : B_PITS;
  if (!Number.isInteger(i) || !own.includes(i)) return null;
  if (gs.pits[i] === 0) return null;

  const pits = gs.pits.slice();
  const skip = player === 'A' ? STORE.B : STORE.A;
  let seeds = pits[i];
  pits[i] = 0;
  let pos = i;
  while (seeds > 0) {
    pos = (pos + 1) % 14;
    if (pos === skip) continue;
    pits[pos]++;
    seeds--;
  }

  // Capture: last seed in your own empty pit, opposite pit has seeds.
  if (own.includes(pos) && pits[pos] === 1 && pits[12 - pos] > 0) {
    pits[STORE[player]] += pits[pos] + pits[12 - pos];
    pits[pos] = 0;
    pits[12 - pos] = 0;
  }

  let again = pos === STORE[player];

  // Sweep: when one side runs dry, the other side banks its remaining seeds.
  if (sideEmpty(pits, 'A')) {
    for (const p of B_PITS) { pits[STORE.B] += pits[p]; pits[p] = 0; }
  } else if (sideEmpty(pits, 'B')) {
    for (const p of A_PITS) { pits[STORE.A] += pits[p]; pits[p] = 0; }
  }
  if (sideEmpty(pits, 'A') && sideEmpty(pits, 'B')) again = false;

  return { gs: { pits }, again };
}

export function winner(gs) {
  if (!sideEmpty(gs.pits, 'A') || !sideEmpty(gs.pits, 'B')) return null;
  const a = gs.pits[STORE.A], b = gs.pits[STORE.B];
  return a > b ? 'A' : b > a ? 'B' : 'draw';
}

/* ---------- rendering ---------- */

function pitButton(count, color, clickable, onClick) {
  const b = document.createElement('button');
  b.textContent = count;
  b.style.cssText =
    `width:100%;max-width:46px;aspect-ratio:1;border-radius:50%;font:700 14px 'JetBrains Mono',monospace;` +
    `background:var(--room2);color:var(--text);border:2px solid ${clickable ? 'var(--candle)' : 'var(--line)'};` +
    `cursor:${clickable ? 'pointer' : 'default'};box-shadow:inset 0 0 0 2px ${color}22;min-width:0;padding:0;`;
  b.disabled = !clickable;
  if (clickable) b.addEventListener('click', onClick);
  return b;
}

export function render(host, gs, { myRole, turn, winner: w, onMove }) {
  host.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'man-wrap';
  wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:6px;width:100%;';

  const board = document.createElement('div');
  board.className = 'man-board';
  board.style.cssText =
    'display:grid;grid-template-columns:minmax(40px,56px) repeat(6,minmax(36px,1fr)) minmax(40px,56px);' +
    'grid-template-rows:minmax(40px,50px) minmax(40px,50px);' +
    'gap:4px;align-items:center;justify-items:center;background:var(--room);' +
    'border:1px solid var(--line);border-radius:18px;padding:10px;' +
    'width:min(100%,min(520px,calc(100dvh - 300px)));box-sizing:border-box;';

  const store = (idx, color) => {
    const d = document.createElement('div');
    d.textContent = gs.pits[idx];
    d.style.cssText =
      `grid-row:1/3;width:100%;height:100%;border-radius:16px;display:flex;align-items:center;` +
      `justify-content:center;font:900 clamp(16px,4vw,20px) 'Fraunces',serif;color:${color};` +
      `background:var(--room2);border:2px solid ${color}55;min-width:0;`;
    return d;
  };

  const canPlay = !w && turn === myRole;

  // Column 1: B's store (left) — B's row runs right-to-left on top.
  const storeB = store(13, 'var(--p2)'); storeB.style.gridColumn = '1';
  board.appendChild(storeB);
  for (let k = 0; k < 6; k++) {
    const i = 12 - k; // pits 12..7 left→right
    const b = pitButton(gs.pits[i], 'var(--p2)',
      canPlay && myRole === 'B' && gs.pits[i] > 0, () => onMove(i));
    b.style.gridRow = '1'; b.style.gridColumn = String(2 + k);
    board.appendChild(b);
  }
  for (let k = 0; k < 6; k++) {
    const i = k; // pits 0..5 left→right
    const b = pitButton(gs.pits[i], 'var(--p1)',
      canPlay && myRole === 'A' && gs.pits[i] > 0, () => onMove(i));
    b.style.gridRow = '2'; b.style.gridColumn = String(2 + k);
    board.appendChild(b);
  }
  const storeA = store(6, 'var(--p1)'); storeA.style.gridColumn = '8';
  board.appendChild(storeA);
  wrap.appendChild(board);

  const cap = document.createElement('div');
  cap.className = 'dots-score';
  cap.textContent = 'land in your store, go again \u00b7 land in your empty pit, capture across';
  wrap.appendChild(cap);
  host.appendChild(wrap);
}
