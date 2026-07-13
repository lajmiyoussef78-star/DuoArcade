// engines/race.js — Duo Dash, a cozy Ludo-style race.
// Each player has 2 tokens. Roll the die, pick a token to move along the
// shared 24-square track. Land on your partner's token to bump it back to
// base. Roll a 6 and you go again. First to bring BOTH tokens home wins.
export const meta = { id: 'race', name: 'Duo Dash', tag: 'race · bump · 6 rolls again', realtime: false };

export const TRACK = 24;          // squares 1..24; 0 = base, 25 = home
export const HOME = TRACK + 1;
const DICE = ['', '\u2680', '\u2681', '\u2682', '\u2683', '\u2684', '\u2685'];

export function initialState() {
  return { pos: { A: [0, 0], B: [0, 0] }, phase: 'roll', die: null, event: null };
}

export function applyMove(gs, m, player) {
  if (!m || typeof m !== 'object') return null;
  const opp = player === 'A' ? 'B' : 'A';

  if (m.t === 'roll') {
    if (gs.phase !== 'roll') return null;
    const die = 1 + Math.floor(Math.random() * 6);
    return { gs: { ...gs, phase: 'move', die, event: null }, again: true };
  }

  if (m.t === 'move') {
    if (gs.phase !== 'move') return null;
    const k = m.token;
    if (k !== 0 && k !== 1) return null;
    const mine = gs.pos[player].slice();
    if (mine[k] >= HOME) return null;                 // already home

    const dest = Math.min(HOME, mine[k] + gs.die);
    mine[k] = dest;

    // bump: landing on a track square occupied by partner tokens sends them back
    let theirs = gs.pos[opp].slice();
    let event = null;
    if (dest >= 1 && dest <= TRACK) {
      theirs = theirs.map(p => {
        if (p === dest) { event = 'bump'; return 0; }
        return p;
      });
    }
    if (dest === HOME) event = event ? 'bump' : 'home';

    const pos = { ...gs.pos, [player]: mine, [opp]: theirs };
    const done = mine.every(p => p >= HOME);
    const again = gs.die === 6 && !done;
    return { gs: { pos, phase: 'roll', die: gs.die, event }, again };
  }

  return null;
}

export function winner(gs) {
  if (gs.pos.A.every(p => p >= HOME)) return 'A';
  if (gs.pos.B.every(p => p >= HOME)) return 'B';
  return null;
}

/* ---------- rendering ---------- */

// serpentine 6x4 board: square n (1..24) -> grid cell
function cellOf(n) {
  const row = Math.floor((n - 1) / 6);
  const i = (n - 1) % 6;
  const col = row % 2 === 0 ? i : 5 - i;
  return { row, col };
}

function tokenDot(role, k, pos) {
  const d = document.createElement('span');
  d.className = `race-tok ${role}`;
  d.textContent = k + 1;
  d.title = `${role === 'A' ? 'Player 1' : 'Player 2'} token ${k + 1}` +
    (pos === 0 ? ' (base)' : pos >= HOME ? ' (home)' : '');
  return d;
}

export function render(host, gs, { myRole, turn, winner: w, onMove }) {
  host.innerHTML = '';
  const canPlay = !w && turn === myRole;
  const wrap = document.createElement('div');
  wrap.className = 'race-wrap';

  // base + home lanes
  const lanes = document.createElement('div');
  lanes.className = 'race-lanes';
  for (const [label, match] of [['base', p => p === 0], ['home', p => p >= HOME]]) {
    const lane = document.createElement('div');
    lane.className = 'race-lane';
    const tag = document.createElement('b');
    tag.textContent = label;
    lane.appendChild(tag);
    for (const role of ['A', 'B'])
      gs.pos[role].forEach((p, k) => { if (match(p)) lane.appendChild(tokenDot(role, k, p)); });
    lanes.appendChild(lane);
  }
  wrap.appendChild(lanes);

  // the track
  const board = document.createElement('div');
  board.className = 'race-board';
  for (let n = 1; n <= TRACK; n++) {
    const { row, col } = cellOf(n);
    const cell = document.createElement('div');
    cell.className = 'race-cell';
    cell.style.gridRow = row + 1;
    cell.style.gridColumn = col + 1;
    const num = document.createElement('i');
    num.textContent = n;
    cell.appendChild(num);
    for (const role of ['A', 'B'])
      gs.pos[role].forEach((p, k) => { if (p === n) cell.appendChild(tokenDot(role, k, p)); });
    board.appendChild(cell);
  }
  wrap.appendChild(board);

  // die + status
  const die = document.createElement('div');
  die.className = 'race-die';
  die.textContent = gs.die ? DICE[gs.die] : '\u2684';
  wrap.appendChild(die);

  const note = document.createElement('div');
  note.className = 'dots-score';
  note.textContent =
    gs.event === 'bump' ? 'bumped! back to base it goes' :
    gs.event === 'home' ? 'a token made it home!' :
    gs.phase === 'move' ? `rolled ${gs.die} — choose a token` :
    'roll · land on your partner to bump · 6 rolls again';
  wrap.appendChild(note);

  // controls
  const row = document.createElement('div');
  row.className = 'race-controls';
  if (gs.phase === 'roll') {
    const btn = document.createElement('button');
    btn.className = 'btn warm';
    btn.textContent = 'Roll';
    btn.disabled = !canPlay;
    btn.addEventListener('click', () => onMove({ t: 'roll' }));
    row.appendChild(btn);
  } else {
    gs.pos[turn].forEach((p, k) => {
      if (p >= HOME) return;
      const dest = Math.min(HOME, p + gs.die);
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.textContent = `Token ${k + 1} \u2192 ${dest >= HOME ? 'home' : dest}`;
      btn.disabled = !canPlay;
      btn.addEventListener('click', () => onMove({ t: 'move', token: k }));
      row.appendChild(btn);
    });
  }
  wrap.appendChild(row);
  host.appendChild(wrap);
}
