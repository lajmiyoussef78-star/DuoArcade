// src/lib/dominoes.js — Dominoes pure rules engine.
//
// Draw dominoes (double-six set), lockstep reducer shared by both clients —
// same shape as src/lib/chkobba.js. Deck order comes from a shared seed
// (re-shuffled each round), so host and guest can never diverge.

export const TARGET = 50;

export const other = p => (p === 'A' ? 'B' : 'A');

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildSet() {
  const s = [];
  for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) s.push({ a, b, id: `${a}${b}` });
  return s;
}

export function shuffle(arr, rnd) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function deal(seed) {
  const rnd = mulberry32(seed);
  const deck = shuffle(buildSet(), rnd);
  return {
    hands: { A: deck.slice(0, 7), B: deck.slice(7, 14) },
    boneyard: deck.slice(14)
  };
}

export function pickStarter(hands) {
  for (let d = 6; d >= 0; d--) {
    for (const p of ['A', 'B']) if (hands[p].some(t => t.a === d && t.b === d)) return p;
  }
  let best = -1, who = 'A';
  for (const p of ['A', 'B']) {
    for (const t of hands[p]) {
      if (t.a + t.b > best) { best = t.a + t.b; who = p; }
    }
  }
  return who;
}

export const pipSum = hand => hand.reduce((s, t) => s + t.a + t.b, 0);

export function endsFor(chain) {
  if (!chain.length) return { left: null, right: null };
  return { left: chain[0].a, right: chain[chain.length - 1].b };
}

export function fits(chain, t) {
  if (!chain.length) return true;
  const { left, right } = endsFor(chain);
  return t.a === left || t.b === left || t.a === right || t.b === right;
}

export function initialState(seed) {
  const n = seed >>> 0;
  const { hands, boneyard } = deal(n);
  const starter = pickStarter(hands);
  return {
    seed: n,
    round: 0,
    phase: 'play',            // play | roundEnd | matchEnd
    scores: { A: 0, B: 0 },
    roundWins: { A: 0, B: 0 },
    hands,
    boneyard,
    chain: [],
    turn: starter,
    starter,
    passStreak: 0,
    lastPlacedId: null,
    result: null,
    winner: null
  };
}

function endRound(state, winnerOrNull) {
  const sums = { A: pipSum(state.hands.A), B: pipSum(state.hands.B) };
  const blocked = winnerOrNull == null;
  let w = winnerOrNull;
  let pts = 0;
  if (blocked) {
    if (sums.A === sums.B) {
      w = null;
    } else {
      w = sums.A < sums.B ? 'A' : 'B';
      pts = Math.abs(sums.A - sums.B);
    }
  } else {
    pts = sums[other(w)];
  }
  const scores = { ...state.scores };
  const roundWins = { ...state.roundWins };
  if (w != null) {
    scores[w] += pts;
    roundWins[w] += 1;
  }
  const matchDone = w != null && scores[w] >= TARGET;
  return {
    ...state,
    scores,
    roundWins,
    result: { w, pts, blocked, sums },
    phase: matchDone ? 'matchEnd' : 'roundEnd',
    winner: matchDone ? w : null,
    error: undefined
  };
}

// moves: {t:'place', id, end:'left'|'right'}  by the player on turn
//        {t:'draw'}                           by the player on turn, no playable tile
//        {t:'pass'}                            by the player on turn, no playable tile, empty boneyard
//        {t:'nextRound', seed?}                by either, once, at roundEnd
//        {t:'rematch', seed?}                  by either, once, at matchEnd
export function applyMove(state, move, by) {
  const fail = msg => ({ ...state, error: msg });
  if (!move || !move.t) return fail('Unknown move');

  switch (move.t) {
    case 'place': {
      if (state.phase !== 'play') return fail('Round is not active');
      if (state.turn !== by) return fail('Not your turn');
      const hand = state.hands[by];
      const idx = hand.findIndex(t => t.id === move.id);
      if (idx === -1) return fail('That tile is not in your hand');
      const tile = hand[idx];

      let chain;
      if (state.chain.length === 0) {
        chain = [{ ...tile }];
      } else {
        const { left, right } = endsFor(state.chain);
        if (move.end === 'left') {
          if (tile.a !== left && tile.b !== left) return fail('That tile does not fit there');
          const o = tile.b === left ? { ...tile } : { a: tile.b, b: tile.a, id: tile.id };
          chain = [o, ...state.chain];
        } else if (move.end === 'right') {
          if (tile.a !== right && tile.b !== right) return fail('That tile does not fit there');
          const o = tile.a === right ? { ...tile } : { a: tile.b, b: tile.a, id: tile.id };
          chain = [...state.chain, o];
        } else {
          return fail('Choose an end to place that tile');
        }
      }

      const newHand = hand.filter((_, i) => i !== idx);
      const hands = { ...state.hands, [by]: newHand };
      const next = {
        ...state,
        hands,
        chain,
        passStreak: 0,
        lastPlacedId: tile.id,
        turn: other(by),
        error: undefined
      };
      if (newHand.length === 0) return endRound(next, by);
      return next;
    }

    case 'draw': {
      if (state.phase !== 'play') return fail('Round is not active');
      if (state.turn !== by) return fail('Not your turn');
      if (state.hands[by].some(t => fits(state.chain, t))) return fail('You have a playable tile');
      if (state.boneyard.length === 0) return fail('The boneyard is empty');
      const [top, ...rest] = state.boneyard;
      const hands = { ...state.hands, [by]: [...state.hands[by], top] };
      return { ...state, hands, boneyard: rest, error: undefined };
    }

    case 'pass': {
      if (state.phase !== 'play') return fail('Round is not active');
      if (state.turn !== by) return fail('Not your turn');
      if (state.hands[by].some(t => fits(state.chain, t))) return fail('You have a playable tile');
      if (state.boneyard.length > 0) return fail('Draw from the boneyard first');
      const streak = state.passStreak + 1;
      if (streak >= 2) return endRound({ ...state, passStreak: streak, error: undefined }, null);
      return { ...state, passStreak: streak, turn: other(by), error: undefined };
    }

    case 'nextRound': {
      if (state.phase !== 'roundEnd') return fail('The round is not over yet');
      const round = state.round + 1;
      const nextSeed = move.seed != null
        ? (move.seed >>> 0)
        : ((state.seed ^ Math.imul(round, 0x9E3779B1)) >>> 0);
      const { hands, boneyard } = deal(nextSeed);
      const starter = other(state.starter);
      return {
        ...state,
        round,
        seed: nextSeed,
        phase: 'play',
        hands,
        boneyard,
        chain: [],
        turn: starter,
        starter,
        passStreak: 0,
        lastPlacedId: null,
        result: null,
        winner: null,
        error: undefined
      };
    }

    case 'rematch': {
      if (state.phase !== 'matchEnd') return fail('The match is not over yet');
      const seed = move.seed != null ? (move.seed >>> 0) : ((state.seed ^ 0x2545F491) + 1) >>> 0;
      return initialState(seed);
    }

    default:
      return fail('Unknown move');
  }
}
