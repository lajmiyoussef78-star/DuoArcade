// src/lib/chkobba.js — Chkobba pure rules engine.
//
// Tunisian café rules (lockstep reducer — both clients apply the same moves).
// Deck: pique, cœur, carreau, trèfle × 10. Carreau = dīnārī.
// Values: ace 1 … 7, dame 8, valet 9, roi 10. Sabʿa l-ḥayya = 7 of carreau.

export const TARGETS = [11, 21, 31];
export const DEFAULT_TARGET = 21;

// French-suited deck; diamonds = carreau (dīnārī scoring suit).
export const SUITS = {
  hearts:   { id: 'hearts',   name: 'Cœur',   fr: 'coeur',   symbol: '\u2665', color: 'red' },
  diamonds: { id: 'diamonds', name: 'Carreau', fr: 'carreau', symbol: '\u2666', color: 'red' },
  clubs:    { id: 'clubs',    name: 'Trèfle',  fr: 'trefle',  symbol: '\u2663', color: 'black' },
  spades:   { id: 'spades',   name: 'Pique',   fr: 'pique',   symbol: '\u2660', color: 'black' }
};
export const SUIT_IDS = Object.keys(SUITS);
export const SCORE_SUIT = 'diamonds'; // carreau / dīnārī

export function faceOf(v) {
  return v === 8 ? 'D' : v === 9 ? 'V' : v === 10 ? 'R' : String(v);
}
export function faceName(v) {
  return v === 8 ? 'Dame' : v === 9 ? 'Valet' : v === 10 ? 'Roi' : v === 1 ? 'Ace' : String(v);
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

/** All subsets of table indices whose values sum to `v`. */
export function captureOptions(v, table) {
  const out = [];
  const list = Array.isArray(table) ? table : [];
  const n = list.length;
  // Bitmask subset search — cap width so 1<<n stays safe (and UI stays responsive).
  if (n === 0 || n > 16) return out;
  const limit = 1 << n;
  for (let mask = 1; mask < limit; mask++) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) sum += list[i]?.v || 0;
    }
    if (sum === v) {
      const idxs = [];
      for (let i = 0; i < n; i++) if (mask & (1 << i)) idxs.push(i);
      out.push(idxs);
    }
  }
  return out;
}

/**
 * Legal capture sets for a played value.
 * Exact match beats addition: if a single equal is on the table,
 * only that single-card capture is allowed (not a longer sum).
 * Capturing itself is optional — you may lay instead.
 */
export function legalCaptures(v, table) {
  const all = captureOptions(v, table);
  const singles = all.filter(x => x.length === 1);
  return singles.length ? singles : all;
}

/** Three+ cards of the same value on the table → uncapturable; redeal. */
export function tableNeedsRedeal(table) {
  const counts = Object.create(null);
  for (const c of table || []) {
    counts[c.v] = (counts[c.v] || 0) + 1;
    if (counts[c.v] >= 3) return true;
  }
  return false;
}

export function initialState(seed, opts = {}) {
  const target = TARGETS.includes(opts.target) ? opts.target : DEFAULT_TARGET;
  const st = {
    seed: seed >>> 0,
    target,
    dealSeq: 0,                      // bumps on redeal so shuffle changes
    round: 0,
    dealer: 'B',                     // A cuts & plays first in round 0
    totals: { A: 0, B: 0 },
    phase: 'cut',                    // cut | play | roundEnd | over
    winner: null,
    log: [`New match — first to ${target}.`],
    lastRound: null
  };
  startRound(st);
  return st;
}

export function startRound(st) {
  const deckSeed = (st.seed ^ (st.round * 68968681) ^ (st.dealSeq * 0x9E3779B9)) >>> 0;
  st.deck = buildDeck(deckSeed);
  st.table = [];
  st.hands = { A: [], B: [] };
  st.caps = { A: [], B: [] };
  st.chk = { A: 0, B: 0 };
  st.lastCap = null;
  st.cutKept = false;
  // Cutter draws the top card — keep it or lay it face-up.
  st.cutCard = st.deck.shift();
  st.cutter = other(st.dealer);
  st.turn = st.cutter;               // non-dealer leads
  st.phase = 'cut';
  st.log.push(`Hand ${st.round + 1}: ${st.dealer} deals, ${st.cutter} cuts.`);
}

const other = p => (p === 'A' ? 'B' : 'A');
const clone = st => JSON.parse(JSON.stringify(st));

function dealN(st, side, n) {
  for (let i = 0; i < n; i++) {
    if (!st.deck.length) break;
    st.hands[side].push(st.deck.shift());
  }
}

function pushTable(st, n) {
  for (let i = 0; i < n; i++) {
    if (!st.deck.length) break;
    st.table.push(st.deck.shift());
  }
}

/** After cut choice: always 3 per hand, 4 on table. */
function finishDealAfterCut(st) {
  if (st.cutKept) {
    // Cutter already has the cut card → +2; dealer +3; table +4.
    dealN(st, st.cutter, 2);
    dealN(st, st.dealer, 3);
    pushTable(st, 4);
  } else {
    // Cut card already on table → +3 more to table; then 3 each.
    pushTable(st, 3);
    dealN(st, 'A', 3);
    dealN(st, 'B', 3);
  }

  if (tableNeedsRedeal(st.table)) {
    st.dealSeq = (st.dealSeq || 0) + 1;
    st.log.push('Three of a kind on the table — redeal.');
    startRound(st);
    return;
  }

  st.phase = 'play';
  st.turn = st.cutter;
  st.cutCard = null;
}

/** Mid-hand refill: 3 each, no new table cards. */
function refillHands(st) {
  dealN(st, 'A', 3);
  dealN(st, 'B', 3);
}

function matchTarget(st) {
  return TARGETS.includes(st.target) ? st.target : DEFAULT_TARGET;
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
  st.log.push(
    `Hand scored: A +${score.A.total}, B +${score.B.total} (now ${st.totals.A}\u2013${st.totals.B}).`
  );
  const { A, B } = st.totals;
  const target = matchTarget(st);
  if ((A >= target || B >= target) && A !== B) {
    st.winner = A > B ? 'A' : 'B';
    st.phase = 'over';
    st.log.push(`${st.winner} wins the match!`);
  } else {
    st.phase = 'roundEnd';
  }
}

export function scoreRound(caps, chk) {
  const count = p => caps[p].length;
  const carreau = p => caps[p].filter(c => c.s === SCORE_SUIT).length;
  const sevens = p => caps[p].filter(c => c.v === 7).length;
  const sixes = p => caps[p].filter(c => c.v === 6).length;
  const hasSabha = p => caps[p].some(c => c.s === SCORE_SUIT && c.v === 7);

  const res = {
    A: { total: 0, items: [] },
    B: { total: 0, items: [] },
    beji: []
  };
  const award = (p, label) => { res[p].total += 1; res[p].items.push(label); };

  // kārṭa — most cards
  if (count('A') > count('B')) award('A', `Kārṭa (${count('A')} cards)`);
  else if (count('B') > count('A')) award('B', `Kārṭa (${count('B')} cards)`);
  else res.beji.push('Kārṭa');

  // dīnārī — most carreau
  if (carreau('A') > carreau('B')) award('A', `Dīnārī (${carreau('A')} carreau)`);
  else if (carreau('B') > carreau('A')) award('B', `Dīnārī (${carreau('B')} carreau)`);
  else res.beji.push('Dīnārī');

  // sabʿa l-ḥayya — 7 of carreau (stacks with barmīla if you also win 7s)
  if (hasSabha('A')) award('A', 'Sabʿa l-ḥayya');
  else if (hasSabha('B')) award('B', 'Sabʿa l-ḥayya');

  // barmīla — most 7s; tie → most 6s
  if (sevens('A') > sevens('B')) award('A', 'Barmīla (7s)');
  else if (sevens('B') > sevens('A')) award('B', 'Barmīla (7s)');
  else if (sixes('A') > sixes('B')) award('A', 'Barmīla (6s tiebreak)');
  else if (sixes('B') > sixes('A')) award('B', 'Barmīla (6s tiebreak)');
  else res.beji.push('Barmīla');

  if (chk.A) { res.A.total += chk.A; res.A.items.push(`Chkobba \u00d7${chk.A}`); }
  if (chk.B) { res.B.total += chk.B; res.B.items.push(`Chkobba \u00d7${chk.B}`); }

  return res;
}

// moves: {t:'cutKeep'} | {t:'cutPass'}      by the cutter
//        {t:'play', idx, take:[tableIdxs]}  by turn player (take=[] = lay; capture optional)
//        {t:'nextRound'}                    by either, once, at roundEnd
export function applyMove(state, move, by) {
  const st = clone(state);
  delete st.error;
  const fail = m => { st.error = m; return st; };

  switch (move.t) {
    case 'cutKeep': {
      if (st.phase !== 'cut' || by !== st.cutter) return fail('Not your cut');
      if (!st.cutCard) return fail('No cut card');
      st.cutKept = true;
      st.hands[by].push(st.cutCard);
      st.log.push(`${by} keeps the cut.`);
      finishDealAfterCut(st);
      return st;
    }
    case 'cutPass': {
      if (st.phase !== 'cut' || by !== st.cutter) return fail('Not your cut');
      if (!st.cutCard) return fail('No cut card');
      st.cutKept = false;
      st.table.push(st.cutCard);
      st.log.push(`${by} lays the cut on the table.`);
      finishDealAfterCut(st);
      return st;
    }

    case 'play': {
      if (st.phase !== 'play' || st.turn !== by) return fail('Not your turn');
      const card = st.hands[by][move.idx];
      if (!card) return fail('Bad card');
      const legal = legalCaptures(card.v, st.table);
      const take = (move.take || []).slice().sort((a, b) => a - b);

      if (take.length === 0) {
        // Capturing is never compulsory — laying is always allowed.
        st.hands[by].splice(move.idx, 1);
        st.table.push(card);
        st.log.push(`${by} lays ${faceOf(card.v)} of ${SUITS[card.s].name}.`);
      } else {
        const ok = legal.some(
          opt => opt.length === take.length && opt.every((x, i) => x === take[i])
        );
        if (!ok) return fail('Invalid capture (exact match beats addition)');
        const taken = take.map(i => st.table[i]);
        st.table = st.table.filter((_, i) => !take.includes(i));
        st.hands[by].splice(move.idx, 1);
        const playCard = { ...card };
        const takenCards = taken.map(c => ({ ...c }));
        st.caps[by].push(playCard, ...takenCards);
        st.lastCap = by;
        st.log.push(
          `${by} eats with ${faceOf(card.v)} of ${SUITS[card.s].name} (${taken.length}).`
        );
        // Final trick of the hand cannot chkobba.
        const isFinalCard =
          st.deck.length === 0 && st.hands.A.length === 0 && st.hands.B.length === 0;
        if (st.table.length === 0 && !isFinalCard) {
          st.chk[by] += 1;
          playCard.chkobba = true; // face-up on the pile
          st.log.push(`CHKOBBA for ${by}!`);
        }
      }

      if (st.hands.A.length === 0 && st.hands.B.length === 0) {
        if (st.deck.length > 0) {
          refillHands(st);
          st.log.push('Three more each.');
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
      if (st.phase !== 'roundEnd') return fail('Hand not over');
      st.round += 1;
      st.dealer = other(st.dealer);
      st.dealSeq = 0;
      startRound(st);
      return st;
    }

    default: return fail('Unknown move');
  }
}
