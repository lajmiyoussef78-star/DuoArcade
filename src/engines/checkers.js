// engines/checkers.js — Checkers (English draughts), turn-based engine interface.
// Forced captures, multi-jumps (via the go-again rule), crowning ends the jump.
// A plays the bottom pieces moving up; B plays the top pieces moving down.
export const meta = { id: 'checkers', name: 'Checkers', tag: 'jumps are mandatory', realtime: false };

const N = 8;
const inb = (r, c) => r >= 0 && r < N && c >= 0 && c < N;
const otherP = p => (p === 'A' ? 'B' : 'A');

export function initialState() {
  const b = Array.from({ length: N }, () => Array(N).fill(null));
  for (let r = 0; r < 3; r++) for (let c = 0; c < N; c++) {
    if ((r + c) % 2 === 1) b[r][c] = { p: 'B', king: false };
  }
  for (let r = 5; r < N; r++) for (let c = 0; c < N; c++) {
    if ((r + c) % 2 === 1) b[r][c] = { p: 'A', king: false };
  }
  return { b, lock: null, toMove: 'A' };
}

function dirsFor(piece) {
  if (piece.king) return [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  return piece.p === 'A' ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]];
}

export function pieceCaptures(b, r, c) {
  const piece = b[r][c];
  if (!piece) return [];
  const out = [];
  for (const [dr, dc] of dirsFor(piece)) {
    const mr = r + dr, mc = c + dc, tr = r + 2 * dr, tc = c + 2 * dc;
    if (inb(tr, tc) && b[tr][tc] === null && b[mr][mc] && b[mr][mc].p !== piece.p) {
      out.push({ from: [r, c], to: [tr, tc] });
    }
  }
  return out;
}

function pieceSteps(b, r, c) {
  const piece = b[r][c];
  if (!piece) return [];
  const out = [];
  for (const [dr, dc] of dirsFor(piece)) {
    const tr = r + dr, tc = c + dc;
    if (inb(tr, tc) && b[tr][tc] === null) out.push({ from: [r, c], to: [tr, tc] });
  }
  return out;
}

export function legalMoves(gs, player) {
  const caps = [], steps = [];
  if (gs.lock) {
    const [lr, lc] = gs.lock;
    return gs.b[lr][lc]?.p === player ? pieceCaptures(gs.b, lr, lc) : [];
  }
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const piece = gs.b[r][c];
    if (!piece || piece.p !== player) continue;
    caps.push(...pieceCaptures(gs.b, r, c));
    steps.push(...pieceSteps(gs.b, r, c));
  }
  return caps.length ? caps : steps; // captures are mandatory
}

export function applyMove(gs, m, player) {
  if (!m || !Array.isArray(m.from) || !Array.isArray(m.to)) return null;
  if (gs.toMove && gs.toMove !== player) return null;
  const [fr, fc] = m.from, [tr, tc] = m.to;
  if (!inb(fr, fc) || !inb(tr, tc)) return null;
  const piece = gs.b[fr][fc];
  if (!piece || piece.p !== player) return null;

  const legal = legalMoves(gs, player);
  if (!legal.some(x => x.from[0] === fr && x.from[1] === fc && x.to[0] === tr && x.to[1] === tc)) return null;

  const b = gs.b.map(row => row.map(cell => (cell ? { ...cell } : null)));
  const moved = b[fr][fc];
  b[fr][fc] = null;
  const isCap = Math.abs(tr - fr) === 2;
  if (isCap) b[(fr + tr) / 2][(fc + tc) / 2] = null;

  let promoted = false;
  if (!moved.king && ((player === 'A' && tr === 0) || (player === 'B' && tr === N - 1))) {
    moved.king = true;
    promoted = true; // crowning ends the move, even mid-jump
  }
  b[tr][tc] = moved;

  const again = isCap && !promoted && pieceCaptures(b, tr, tc).length > 0;
  return {
    gs: { b, lock: again ? [tr, tc] : null, toMove: again ? player : otherP(player) },
    again
  };
}

export function winner(gs) {
  let a = 0, bCount = 0;
  for (const row of gs.b) for (const cell of row) {
    if (cell?.p === 'A') a++; else if (cell?.p === 'B') bCount++;
  }
  if (a === 0) return 'B';
  if (bCount === 0) return 'A';
  if (legalMoves(gs, gs.toMove).length === 0) return otherP(gs.toMove); // stuck = loss
  return null;
}

/* ---------- rendering (module-local selection state) ---------- */

let sel = null;

export function render(host, gs, ctx) {
  const { myRole, turn, winner: w, onMove } = ctx;
  const canPlay = !w && turn === myRole;

  // Mid multi-jump: your locked piece is preselected for you.
  if (canPlay && gs.lock && gs.b[gs.lock[0]][gs.lock[1]]?.p === myRole) sel = gs.lock.slice();
  if (sel && (!gs.b[sel[0]][sel[1]] || gs.b[sel[0]][sel[1]].p !== myRole)) sel = null;

  const legal = canPlay ? legalMoves(gs, myRole) : [];
  const targets = sel
    ? legal.filter(x => x.from[0] === sel[0] && x.from[1] === sel[1]).map(x => x.to)
    : [];
  const movable = new Set(legal.map(x => x.from.join(',')));

  host.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:8px;';
  const board = document.createElement('div');
  board.style.cssText =
    `display:grid;grid-template-columns:repeat(${N},42px);border:2px solid var(--line);` +
    'border-radius:12px;overflow:hidden;';

  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const dark = (r + c) % 2 === 1;
    const piece = gs.b[r][c];
    const isSel = sel && sel[0] === r && sel[1] === c;
    const isTarget = targets.some(([tr, tc]) => tr === r && tc === c);
    const cell = document.createElement('button');
    cell.style.cssText =
      'width:42px;height:42px;border:none;display:flex;align-items:center;justify-content:center;' +
      `background:${isSel ? 'var(--candles)' : dark ? 'var(--room2)' : 'var(--room)'};` +
      `cursor:${canPlay && (isTarget || (piece?.p === myRole && movable.has(r + ',' + c))) ? 'pointer' : 'default'};` +
      'padding:0;position:relative;';
    if (isTarget) {
      const hint = document.createElement('div');
      hint.style.cssText = 'width:12px;height:12px;border-radius:50%;background:var(--candle);opacity:.85;';
      cell.appendChild(hint);
    }
    if (piece) {
      const disc = document.createElement('div');
      disc.style.cssText =
        'width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;' +
        `font-size:16px;color:#1a1420;background:${piece.p === 'A' ? 'var(--p1)' : 'var(--p2)'};` +
        `box-shadow:inset 0 -3px 0 rgba(0,0,0,.3);${isSel ? 'outline:2px solid var(--candle);' : ''}`;
      disc.textContent = piece.king ? '\u265A' : '';
      cell.appendChild(disc);
    }
    cell.addEventListener('click', () => {
      if (!canPlay) return;
      if (isTarget) { const from = sel; sel = null; onMove({ from, to: [r, c] }); return; }
      if (piece?.p === myRole && movable.has(r + ',' + c) && !gs.lock) {
        sel = isSel ? null : [r, c];
      } else if (!gs.lock) sel = null;
      render(host, gs, ctx); // local redraw for selection
    });
    board.appendChild(cell);
  }
  wrap.appendChild(board);
  const cap = document.createElement('div');
  cap.className = 'dots-score';
  cap.textContent = gs.lock && canPlay
    ? 'keep jumping \u2014 your piece can capture again'
    : 'captures are mandatory \u00b7 reach the far side to crown a king';
  wrap.appendChild(cap);
  host.appendChild(wrap);
}
