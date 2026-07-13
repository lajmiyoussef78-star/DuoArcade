// engines/seabattle.js — Sea Battle, turn-based engine interface.
// 8×8 waters, fleets of 4-3-3-2 placed automatically. Hit → shoot again.
// Note: like every DuoArcade game, the two of you are trusted — the full
// state syncs between your devices, so no peeking in devtools, captain.
export const meta = { id: 'seabattle', name: 'Sea Battle', tag: 'hit \u2192 shoot again', realtime: false };

const N = 8, FLEET = [4, 3, 3, 2];
const key = (r, c) => r + ',' + c;

function placeFleet() {
  const taken = new Set();
  const ships = [];
  for (const len of FLEET) {
    for (let attempt = 0; ; attempt++) {
      const horiz = Math.random() < 0.5;
      const r = Math.floor(Math.random() * (horiz ? N : N - len + 1));
      const c = Math.floor(Math.random() * (horiz ? N - len + 1 : N));
      const cells = [];
      for (let k = 0; k < len; k++) cells.push(key(r + (horiz ? 0 : k), c + (horiz ? k : 0)));
      if (cells.every(x => !taken.has(x))) {
        cells.forEach(x => taken.add(x));
        ships.push(cells);
        break;
      }
      if (attempt > 500) throw new Error('placement failed'); // effectively unreachable
    }
  }
  return ships;
}

export function initialState() {
  return { fleet: { A: placeFleet(), B: placeFleet() }, shots: { A: {}, B: {} } };
}

const other = p => (p === 'A' ? 'B' : 'A');
const fleetCells = ships => new Set(ships.flat());

function sunkCount(ships, shots) {
  return ships.filter(cells => cells.every(x => shots[x])).length;
}

export function applyMove(gs, m, player) {
  if (!m || !Number.isInteger(m.r) || !Number.isInteger(m.c)) return null;
  if (m.r < 0 || m.r >= N || m.c < 0 || m.c >= N) return null;
  const k = key(m.r, m.c);
  if (gs.shots[player][k]) return null; // already fired there
  const shots = { ...gs.shots, [player]: { ...gs.shots[player], [k]: true } };
  const hit = fleetCells(gs.fleet[other(player)]).has(k);
  return { gs: { fleet: gs.fleet, shots }, again: hit };
}

export function winner(gs) {
  for (const p of ['A', 'B']) {
    const enemy = other(p);
    if (fleetCells(gs.fleet[enemy]).size > 0 &&
        [...fleetCells(gs.fleet[enemy])].every(x => gs.shots[p][x])) return p;
  }
  return null;
}

/* ---------- rendering ---------- */

function grid(cellPx, gapPx) {
  const g = document.createElement('div');
  g.style.cssText =
    `display:grid;grid-template-columns:repeat(${N},${cellPx}px);gap:${gapPx}px;` +
    'background:var(--room);border:1px solid var(--line);border-radius:14px;padding:8px;';
  return g;
}

function title(text) {
  const d = document.createElement('div');
  d.className = 'dots-score';
  d.style.marginTop = '0';
  d.textContent = text;
  return d;
}

export function render(host, gs, { myRole, turn, winner: w, onMove }) {
  host.innerHTML = '';
  const enemy = other(myRole);
  const myShots = gs.shots[myRole];
  const theirShots = gs.shots[enemy];
  const enemyCells = fleetCells(gs.fleet[enemy]);
  const myCells = fleetCells(gs.fleet[myRole]);
  const canPlay = !w && turn === myRole;

  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:10px;';

  // --- Their waters (you shoot here) ---
  wrap.appendChild(title(
    `their waters \u00b7 ${sunkCount(gs.fleet[enemy], myShots)}/${FLEET.length} ships sunk`));
  const target = grid(32, 3);
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const k = key(r, c);
    const fired = !!myShots[k];
    const hit = fired && enemyCells.has(k);
    const b = document.createElement('button');
    b.style.cssText =
      'width:32px;height:32px;border-radius:8px;font-size:15px;display:flex;align-items:center;' +
      `justify-content:center;border:1px solid var(--line);cursor:${!fired && canPlay ? 'pointer' : 'default'};` +
      (hit ? 'background:var(--p2s);color:var(--p2);'
        : fired ? 'background:var(--room2);color:var(--dim);'
        : 'background:var(--room2);color:transparent;');
    b.textContent = hit ? '\u2738' : fired ? '\u00b7' : '';
    b.disabled = fired || !canPlay;
    b.addEventListener('click', () => onMove({ r, c }));
    target.appendChild(b);
  }
  wrap.appendChild(target);

  // --- Your fleet (they shoot here) ---
  wrap.appendChild(title(
    `your fleet \u00b7 ${FLEET.length - sunkCount(gs.fleet[myRole], theirShots)}/${FLEET.length} afloat`));
  const mine = grid(20, 2);
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const k = key(r, c);
    const ship = myCells.has(k);
    const fired = !!theirShots[k];
    const d = document.createElement('div');
    d.style.cssText =
      'width:20px;height:20px;border-radius:5px;font-size:11px;display:flex;align-items:center;' +
      'justify-content:center;border:1px solid var(--line);' +
      (ship && fired ? 'background:var(--p2s);color:var(--p2);'
        : ship ? `background:${myRole === 'A' ? 'var(--p1s)' : 'var(--p2s)'};`
        : fired ? 'background:var(--room2);color:var(--dim);'
        : 'background:var(--room2);');
    d.textContent = ship && fired ? '\u2738' : (!ship && fired ? '\u00b7' : '');
    mine.appendChild(d);
  }
  wrap.appendChild(mine);
  host.appendChild(wrap);
}
