// engines/pig.js — Pig Race, turn-based engine interface.
// Roll a die as many times as your nerve holds: every roll adds to your pot
// (and you go again), but a 1 wipes the pot and passes the turn. HOLD banks
// the pot. First to 50 banked points wins.
export const meta = { id: 'pig', name: 'Pig Race', tag: 'push your luck to 50', realtime: false };

const TARGET = 50;
const DICE = ['', '\u2680', '\u2681', '\u2682', '\u2683', '\u2684', '\u2685'];

export function initialState() {
  return { scores: { A: 0, B: 0 }, pot: 0, roll: null, event: null };
}

export function applyMove(gs, m, player) {
  if (m !== 'roll' && m !== 'hold') return null;
  const scores = { ...gs.scores };

  if (m === 'hold') {
    if (gs.pot === 0) return null; // nothing to bank — roll first
    scores[player] += gs.pot;
    return { gs: { scores, pot: 0, roll: null, event: 'held' }, again: false };
  }

  const d = 1 + Math.floor(Math.random() * 6);
  if (d === 1) {
    return { gs: { scores, pot: 0, roll: 1, event: 'bust' }, again: false };
  }
  const pot = gs.pot + d;
  if (scores[player] + pot >= TARGET) {
    scores[player] += pot; // ride the winning roll straight home
    return { gs: { scores, pot: 0, roll: d, event: 'won' }, again: false };
  }
  return { gs: { scores, pot, roll: d, event: null }, again: true };
}

export function winner(gs) {
  if (gs.scores.A >= TARGET) return 'A';
  if (gs.scores.B >= TARGET) return 'B';
  return null;
}

/* ---------- rendering ---------- */

function scoreBar(label, value, color) {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:center;gap:8px;width:100%;';
  const tag = document.createElement('div');
  tag.style.cssText = `width:14px;height:14px;border-radius:50%;background:${color};flex:none;`;
  const bar = document.createElement('div');
  bar.style.cssText =
    'flex:1;height:14px;border-radius:999px;background:var(--room2);border:1px solid var(--line);overflow:hidden;';
  const fill = document.createElement('div');
  fill.style.cssText =
    `height:100%;width:${Math.min(100, 100 * value / TARGET)}%;background:${color};transition:width .3s ease;`;
  bar.appendChild(fill);
  const num = document.createElement('div');
  num.style.cssText = "font:700 13px 'JetBrains Mono',monospace;width:28px;text-align:right;";
  num.textContent = value;
  row.appendChild(tag); row.appendChild(bar); row.appendChild(num);
  return row;
}

export function render(host, gs, { myRole, turn, winner: w, onMove }) {
  host.innerHTML = '';
  const canPlay = !w && turn === myRole;

  const wrap = document.createElement('div');
  wrap.style.cssText =
    'display:flex;flex-direction:column;align-items:center;gap:14px;width:100%;max-width:340px;' +
    'background:var(--room);border:1px solid var(--line);border-radius:18px;padding:20px;';

  wrap.appendChild(scoreBar('A', gs.scores.A, 'var(--p1)'));
  wrap.appendChild(scoreBar('B', gs.scores.B, 'var(--p2)'));

  const die = document.createElement('div');
  die.style.cssText =
    'font-size:72px;line-height:1;height:78px;display:flex;align-items:center;' +
    `color:${gs.event === 'bust' ? '#FF8A8A' : 'var(--text)'};`;
  die.textContent = gs.roll ? DICE[gs.roll] : '\u2684';
  wrap.appendChild(die);

  const pot = document.createElement('div');
  pot.className = 'dots-score';
  pot.style.marginTop = '0';
  pot.textContent = gs.event === 'bust'
    ? 'rolled a 1 \u2014 pot gone, turn passes!'
    : gs.event === 'held' ? 'banked. your move now\u2026'
    : `pot: ${gs.pot} \u00b7 first to ${TARGET} banked wins`;
  wrap.appendChild(pot);

  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:10px;';
  const rollBtn = document.createElement('button');
  rollBtn.className = 'btn warm';
  rollBtn.textContent = 'Roll';
  rollBtn.disabled = !canPlay;
  rollBtn.addEventListener('click', () => onMove('roll'));
  const holdBtn = document.createElement('button');
  holdBtn.className = 'btn';
  holdBtn.textContent = `Hold (+${gs.pot})`;
  holdBtn.disabled = !canPlay || gs.pot === 0;
  holdBtn.addEventListener('click', () => onMove('hold'));
  row.appendChild(rollBtn); row.appendChild(holdBtn);
  wrap.appendChild(row);

  host.appendChild(wrap);
}
