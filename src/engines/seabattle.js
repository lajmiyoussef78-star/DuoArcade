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

function title(text, kind) {
  const d = document.createElement('div');
  d.className = 'sea-title sea-title-' + kind;
  d.textContent = text;
  return d;
}

function mark(kind) {
  const s = document.createElement('span');
  s.className = 'sea-mark sea-' + kind;
  s.setAttribute('aria-hidden', 'true');
  return s;
}

export function render(host, gs, { myRole, turn, winner: w, onMove }) {
  host.innerHTML = '';
  const enemy = other(myRole);
  const myShots = gs.shots[myRole];
  const theirShots = gs.shots[enemy];
  const enemyCells = fleetCells(gs.fleet[enemy]);
  const myCells = fleetCells(gs.fleet[myRole]);
  const canPlay = !w && turn === myRole;
  const over = !!w;

  const wrap = document.createElement('div');
  wrap.className = 'sea-wrap' + (over ? ' sea-over' : '');

  // --- Their waters (you shoot here) ---
  wrap.appendChild(title(
    over
      ? `Their waters · fleet revealed`
      : `Their waters · ${sunkCount(gs.fleet[enemy], myShots)}/${FLEET.length} ships sunk`,
    'enemy'));
  const target = document.createElement('div');
  target.className = 'sea-grid sea-grid-target';
  target.setAttribute('aria-label', over ? 'Enemy waters — fleet revealed' : 'Enemy waters — fire here');
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const k = key(r, c);
      const fired = !!myShots[k];
      const ship = enemyCells.has(k);
      const hit = fired && ship;
      const b = document.createElement('button');
      b.type = 'button';
      let cls = 'sea-cell';
      if (over && ship && hit) cls += ' wreck exploded';
      else if (over && ship) cls += ' ship revealed';
      else if (hit) cls += ' hit';
      else if (fired) cls += ' miss';
      else cls += ' water' + (canPlay ? ' aim' : '');
      b.className = cls;
      b.disabled = fired || !canPlay || over;
      b.title = hit || (over && ship && hit) ? 'Exploded'
        : over && ship ? 'Ship'
          : fired ? 'Miss — splash'
            : canPlay ? 'Fire' : '';
      if (hit || (over && ship && hit)) b.appendChild(mark('bomb'));
      else if (fired) b.appendChild(mark('splash'));
      b.addEventListener('click', () => onMove({ r, c }));
      target.appendChild(b);
    }
  }
  wrap.appendChild(target);

  // --- Your fleet (they shoot here) ---
  wrap.appendChild(title(
    over
      ? `Your fleet · ${sunkCount(gs.fleet[myRole], theirShots)}/${FLEET.length} exploded`
      : `Your fleet · ${FLEET.length - sunkCount(gs.fleet[myRole], theirShots)}/${FLEET.length} afloat`,
    'mine'));
  const mine = document.createElement('div');
  mine.className = 'sea-grid sea-grid-mine';
  mine.setAttribute('aria-label', 'Your fleet');
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const k = key(r, c);
      const ship = myCells.has(k);
      const fired = !!theirShots[k];
      const d = document.createElement('div');
      let cls = 'sea-cell sea-cell-sm';
      if (ship && fired) cls += over ? ' wreck exploded' : ' wreck';
      else if (ship) cls += over ? ' ship revealed' : ' ship';
      else if (fired) cls += ' miss';
      else cls += ' water';
      d.className = cls;
      if (ship && fired) d.appendChild(mark('bomb'));
      else if (!ship && fired) d.appendChild(mark('splash'));
      mine.appendChild(d);
    }
  }
  wrap.appendChild(mine);
  host.appendChild(wrap);
}
