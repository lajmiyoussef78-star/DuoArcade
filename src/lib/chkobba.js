// src/lib/chkobba.js — Chkobba pure rules engine.
//
// Tunisian ruleset as a deterministic lockstep reducer — both clients
// apply the same moves and can never diverge. Deck order comes from the
// shared seed (re-shuffled each round).

export const TARGET = 21;          // win at 21+ with a 2-point lead
export const LEAD = 2;

// French-suited Chkobba deck: 4 suits x 10 values (1..7, 8=Queen, 9=Lieutenant, 10=King)
// Diamonds stand in for the classic Dinari scoring suit.
export const SUITS = {
  hearts:   { id: 'hearts',   name: 'Hearts',   symbol: '\u2665', color: 'red' },
  diamonds: { id: 'diamonds', name: 'Diamonds', symbol: '\u2666', color: 'red' },
  clubs:    { id: 'clubs',    name: 'Clubs',    symbol: '\u2663', color: 'black' },
  spades:   { id: 'spades',   name: 'Spades',   symbol: '\u2660', color: 'black' }
};
export const SUIT_IDS = Object.keys(SUITS);
export const SCORE_SUIT = 'diamonds';

export function faceOf(v) {
  return v === 8 ? 'Q' : v === 9 ? 'L' : v === 10 ? 'K' : String(v);
}
export function faceName(v) {
  return v === 8 ? 'Queen' : v === 9 ? 'Lieutenant' : v === 10 ? 'King' : String(v);
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildDeck(seed) {
  const deck = [];
  for (const s of SUIT_IDS) for (let v = 1; v <= 10; v++) deck.push({ s, v });
  const rnd = mulberry32(seed);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// All subsets of table indices whose values sum to `v`.
export function captureOptions(v, table) {
  const out = [];
  const n = table.length;
  for (let mask = 1; mask < (1 << n); mask++) {
    let sum = 0;
    for (let i = 0; i < n; i++) if (mask & (1 << i)) sum += table[i].v;
    if (sum === v) {
      const idxs = [];
      for (let i = 0; i < n; i++) if (mask & (1 << i)) idxs.push(i);
      out.push(idxs);
    }
  }
  return out;
}

// Chkobba/Scopa rule: if a single equal card is on the table, you must
// take a single card (not a longer combination).
export function legalCaptures(v, table) {
  const all = captureOptions(v, table);
  const singles = all.filter(x => x.length === 1);
  return singles.length ? singles : all;
}

export function initialState(seed) {
  const st = {
    seed,
    round: 0,
    dealer: 'B',                     // A is the cutter & plays first, round 0
    totals: { A: 0, B: 0 },
    phase: 'cut',                    // cut | play | roundEnd | over
    winner: null,
    log: ['New match \u2014 first to 21 with a 2-point lead.'],
    lastRound: null                  // score breakdown of the finished round
  };
  startRound(st);
  return st;
}

export function startRound(st) {
  const deck = buildDeck((st.seed ^ (st.round * 68968681)) >>> 0);
  st.deck = deck;
  st.table = [];
  st.hands = { A: [], B: [] };
  st.caps = { A: [], B: [] };        // captured piles
  st.chk = { A: 0, B: 0 };           // chkobbas this round
  st.lastCap = null;
  st.cutKept = false;
  st.cutCard = st.deck[0];           // the cutter may keep this
  st.turn = other(st.dealer);        // non-dealer plays first
  st.cutter = other(st.dealer);
  st.phase = 'cut';
  st.log.push(`Round ${st.round + 1}: ${st.dealer} deals, ${st.cutter} cuts.`);
}

const other = p => (p === 'A' ? 'B' : 'A');
const clone = st => JSON.parse(JSON.stringify(st));

function dealHands(st, firstAfterCut) {
  for (const p of ['A', 'B']) {
    let n = 3;
    if (firstAfterCut && st.cutKept && p === st.cutter) n = 2;   // kept the cut card
    for (let i = 0; i < n; i++) st.hands[p].push(st.deck.shift());
  }
}

function dealTable(st) {
  for (let i = 0; i < 4; i++) st.table.push(st.deck.shift());
}

function beginPlay(st) {
  dealHands(st, true);
  dealTable(st);
  st.phase = 'play';
}

function endRound(st) {
  if (st.table.length && st.lastCap) {
    st.caps[st.lastCap].push(...st.table);
    st.log.push(`Leftover table cards go to ${st.lastCap}.`);
  }
  st.table = [];
  const score = scoreRound(st.caps, st.chk);
  st.totals.A += score.A.total;
  st.totals.B += score.B.total;
  st.lastRound = score;
  st.log.push(`Round scored: A +${score.A.total}, B +${score.B.total} (now ${st.totals.A}\u2013${st.totals.B}).`);
  const { A, B } = st.totals;
  if ((A >= TARGET || B >= TARGET) && Math.abs(A - B) >= LEAD) {
    st.winner = A > B ? 'A' : 'B';
    st.phase = 'over';
    st.log.push(`${st.winner} wins the match!`);
  } else {
    st.phase = 'roundEnd';
  }
}

export function scoreRound(caps, chk) {
  const count = p => caps[p].length;
  const diamonds = p => caps[p].filter(c => c.s === SCORE_SUIT).length;
  const sevens = p => caps[p].filter(c => c.v === 7).length;
  const sixes = p => caps[p].filter(c => c.v === 6).length;
  const has7aya = p => caps[p].some(c => c.s === SCORE_SUIT && c.v === 7);

  const res = {
    A: { total: 0, items: [] },
    B: { total: 0, items: [] },
    beji: []
  };
  const award = (p, label) => { res[p].total += 1; res[p].items.push(label); };

  if (count('A') > count('B')) award('A', `Carta (${count('A')} cards)`);
  else if (count('B') > count('A')) award('B', `Carta (${count('B')} cards)`);
  else res.beji.push('Carta');

  // Diamonds = classic Dinari suit
  if (diamonds('A') > diamonds('B')) award('A', `Diamonds (${diamonds('A')})`);
  else if (diamonds('B') > diamonds('A')) award('B', `Diamonds (${diamonds('B')})`);
  else res.beji.push('Diamonds');

  if (has7aya('A')) award('A', '7aya');
  else if (has7aya('B')) award('B', '7aya');

  if (sevens('A') > sevens('B')) award('A', 'Bermila (7s)');
  else if (sevens('B') > sevens('A')) award('B', 'Bermila (7s)');
  else if (sixes('A') > sixes('B')) award('A', 'Bermila (6s tiebreak)');
  else if (sixes('B') > sixes('A')) award('B', 'Bermila (6s tiebreak)');
  else res.beji.push('Bermila');

  if (chk.A) { res.A.total += chk.A; res.A.items.push(`Chkobba \u00d7${chk.A}`); }
  if (chk.B) { res.B.total += chk.B; res.B.items.push(`Chkobba \u00d7${chk.B}`); }

  return res;
}

// moves: {t:'cutKeep'} | {t:'cutPass'}      by the cutter
//        {t:'play', idx, take:[tableIdxs]}  by turn player
//        {t:'nextRound'}                    by either, once, at roundEnd
export function applyMove(state, move, by) {
  const st = clone(state);
  delete st.error;
  const fail = m => { st.error = m; return st; };

  switch (move.t) {
    case 'cutKeep': {
      if (st.phase !== 'cut' || by !== st.cutter) return fail('Not your cut');
      st.cutKept = true;
      st.hands[by].push(st.deck.shift());
      st.log.push(`${by} keeps the cut card.`);
      beginPlay(st);
      return st;
    }
    case 'cutPass': {
      if (st.phase !== 'cut' || by !== st.cutter) return fail('Not your cut');
      st.log.push(`${by} leaves the cut.`);
      beginPlay(st);
      return st;
    }

    case 'play': {
      if (st.phase !== 'play' || st.turn !== by) return fail('Not your turn');
      const card = st.hands[by][move.idx];
      if (!card) return fail('Bad card');
      const legal = legalCaptures(card.v, st.table);
      const take = (move.take || []).slice().sort((a, b) => a - b);

      if (take.length === 0) {
        if (legal.length > 0) return fail('This card can capture \u2014 you must take');
        st.hands[by].splice(move.idx, 1);
        st.table.push(card);
        st.log.push(`${by} lays ${faceOf(card.v)} of ${SUITS[card.s].name}.`);
      } else {
        const ok = legal.some(opt => opt.length === take.length && opt.every((x, i) => x === take[i]));
        if (!ok) return fail('Invalid capture (check the single-card rule)');
        const taken = take.map(i => st.table[i]);
        st.table = st.table.filter((_, i) => !take.includes(i));
        st.hands[by].splice(move.idx, 1);
        const playCard = { ...card };
        const takenCards = taken.map(c => ({ ...c }));
        st.caps[by].push(playCard, ...takenCards);
        st.lastCap = by;
        st.log.push(`${by} plays ${faceOf(card.v)} of ${SUITS[card.s].name} and captures ${taken.length}.`);
        const isFinalCard = st.deck.length === 0 && st.hands.A.length === 0 && st.hands.B.length === 0;
        if (st.table.length === 0 && !isFinalCard) {
          st.chk[by] += 1;
          playCard.chkobba = true; // face-up trophy in the capture pile
          st.log.push(`CHKOBBA for ${by}! \u{1F389}`);
        }
      }

      if (st.hands.A.length === 0 && st.hands.B.length === 0) {
        if (st.deck.length > 0) {
          dealHands(st, false);
          st.log.push('New cards dealt.');
          st.turn = other(st.dealer);
        } else {
          endRound(st);
          return st;
        }
      } else {
        st.turn = other(by);
        if (st.hands[st.turn].length === 0) st.turn = by;
      }
      return st;
    }

    case 'nextRound': {
      if (st.phase !== 'roundEnd') return fail('Round not over');
      st.round += 1;
      st.dealer = other(st.dealer);
      startRound(st);
      return st;
    }

    default: return fail('Unknown move');
  }
}
