// engines/memory.js — Memory Match (pairs). Find a pair -> keep your turn.
// Cards are shared state, so both partners see the same flips — half the
// game is remembering what YOUR PARTNER revealed.

export const meta = { id: 'memory', name: 'Memory Match', tag: 'pairs · 8 min', accent: 'candle' };

const EMOJI = ['\u{1F355}','\u{1F3AE}','\u{1F31F}','\u{1F340}','\u{1F3B5}','\u{1F680}',
               '\u{1F9CA}','\u{1F525}','\u{1F30A}','\u{1F352}'];

export function initialState() {
  const deck = [...EMOJI, ...EMOJI]
    .map(e => ({ e, s: Math.random() }))
    .sort((a, b) => a.s - b.s)
    .map(({ e }) => ({ e, owner: null }));
  return { cards: deck, flipped: [], lastMiss: null };
}

export function applyMove(gs, move, player) {
  const i = Number(move);
  if (!Number.isInteger(i) || i < 0 || i >= gs.cards.length) return null;
  const card = gs.cards[i];
  if (!card || card.owner || gs.flipped.includes(i)) return null;

  const cards = gs.cards.map(c => ({ ...c }));
  if (gs.flipped.length === 0) {
    // first flip of the pair — same player continues
    return { gs: { cards, flipped: [i], lastMiss: null }, again: true };
  }
  const j = gs.flipped[0];
  if (cards[j].e === cards[i].e) {
    cards[j].owner = player;
    cards[i].owner = player;
    const done = cards.every(c => c.owner);
    return { gs: { cards, flipped: [], lastMiss: null }, again: !done };
  }
  // miss: both shown until the next flip, turn passes
  return { gs: { cards, flipped: [], lastMiss: [j, i] }, again: false };
}

export function score(gs) {
  let a = 0, b = 0;
  for (const c of gs.cards) { if (c.owner === 'A') a++; else if (c.owner === 'B') b++; }
  return { a: a / 2, b: b / 2 };
}

export function winner(gs) {
  if (!gs.cards.every(c => c.owner)) return null;
  const { a, b } = score(gs);
  return a > b ? 'A' : b > a ? 'B' : 'draw';
}

export function render(el, gs, ctx) {
  el.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'mem-grid';
  const canPlay = !ctx.winner && ctx.turn === ctx.myRole;
  gs.cards.forEach((c, i) => {
    const faceUp = c.owner || gs.flipped.includes(i) || (gs.lastMiss || []).includes(i);
    const cell = document.createElement('button');
    cell.className = 'mem-card' + (faceUp ? ' up' : '') + (c.owner ? ' own' + c.owner : '');
    cell.textContent = faceUp ? c.e : '';
    cell.disabled = !!c.owner || gs.flipped.includes(i) || !canPlay;
    cell.addEventListener('click', () => ctx.onMove(i));
    grid.appendChild(cell);
  });
  el.appendChild(grid);
  const sc = score(gs);
  const note = document.createElement('div');
  note.className = 'dots-score';
  note.textContent = `pairs: ${sc.a} \u2013 ${sc.b} \u00b7 find a pair, go again`;
  el.appendChild(note);
}
