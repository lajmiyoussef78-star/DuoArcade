// src/lib/uno.js — Classic 2-player UNO pure logic.

export const COLORS = ['red', 'yellow', 'green', 'blue'];
export const HAND_SIZE = 7;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleOnce(arr, seed) {
  const rnd = mulberry32(seed);
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Triple-cut shuffle so deals feel thoroughly mixed. */
export function shuffle(arr, seed) {
  let a = shuffleOnce(arr, seed);
  a = shuffleOnce(a, (seed ^ 0xA5A5A5A5) >>> 0);
  a = shuffleOnce(a, (seed + 0x9E3779B9) >>> 0);
  return a;
}

let _id = 0;
function cid(prefix) {
  _id += 1;
  return `${prefix}-${_id}`;
}

/** Build a standard 108-card UNO deck (ids stable for a given seed rebuild). */
export function buildDeck(seed) {
  _id = 0;
  const cards = [];
  for (const color of COLORS) {
    cards.push({ id: cid(color), color, kind: 'number', value: 0 });
    for (let n = 1; n <= 9; n++) {
      cards.push({ id: cid(color), color, kind: 'number', value: n });
      cards.push({ id: cid(color), color, kind: 'number', value: n });
    }
    for (let i = 0; i < 2; i++) {
      cards.push({ id: cid(color), color, kind: 'skip', value: 'skip' });
      cards.push({ id: cid(color), color, kind: 'reverse', value: 'reverse' });
      cards.push({ id: cid(color), color, kind: 'draw2', value: 'draw2' });
    }
  }
  for (let i = 0; i < 4; i++) {
    cards.push({ id: cid('wild'), color: null, kind: 'wild', value: 'wild' });
    cards.push({ id: cid('w4'), color: null, kind: 'wild4', value: 'wild4' });
  }
  return shuffle(cards, seed);
}

export function cardLabel(card) {
  if (!card) return '';
  if (card.kind === 'number') return String(card.value);
  if (card.kind === 'skip') return '⊘';
  if (card.kind === 'reverse') return '⇄';
  if (card.kind === 'draw2') return '+2';
  if (card.kind === 'wild') return '';
  if (card.kind === 'wild4') return '+4';
  return '?';
}

export function isWild(card) {
  return card?.kind === 'wild' || card?.kind === 'wild4';
}

export function canPlay(card, top, currentColor) {
  if (!card || !top) return false;
  if (isWild(card)) return true;
  if (card.color === currentColor) return true;
  if (card.kind === 'number' && top.kind === 'number' && card.value === top.value) return true;
  if (card.kind !== 'number' && card.kind === top.kind) return true;
  return false;
}

function other(role) {
  return role === 'A' ? 'B' : 'A';
}

/** Always bump actionSeq so UI clocks/sync keys advance, even on skip-stay. */
function bump(state, patch = {}) {
  return {
    ...state,
    ...patch,
    actionSeq: (state.actionSeq || 0) + 1
  };
}

/** Switch turn; bumps turnCount only when the active seat changes. */
function passTurn(state, nextTurn) {
  if (state.turn === nextTurn) {
    return { ...state, turn: nextTurn };
  }
  return {
    ...state,
    turn: nextTurn,
    turnCount: (state.turnCount || 1) + 1
  };
}

function drawFromPile(state, role, n) {
  const next = {
    ...state,
    hands: { A: state.hands.A.slice(), B: state.hands.B.slice() },
    pile: state.pile.slice(),
    discard: state.discard.slice()
  };
  let drew = 0;
  for (let i = 0; i < n; i++) {
    if (!next.pile.length) {
      if (next.discard.length <= 1) break;
      const top = next.discard[next.discard.length - 1];
      const rest = next.discard.slice(0, -1);
      next.pile = shuffle(
        rest,
        (state.seed ^ ((state.reshuffles + 1) * 0x9E37) ^ 0x554E4F) >>> 0
      );
      next.discard = [top];
      next.reshuffles = (next.reshuffles || 0) + 1;
    }
    if (!next.pile.length) break;
    next.hands[role].push(next.pile.pop());
    drew += 1;
  }
  next._drew = drew;
  return next;
}

function clearUnoIfNotOne(next, role) {
  if (next.hands[role].length !== 1) {
    next.unoPending = next.unoPending === role ? null : next.unoPending;
    next.unoArmed = { ...(next.unoArmed || { A: false, B: false }), [role]: false };
  }
  return next;
}

/** Deal a fresh match from seed. */
export function createMatch(seed) {
  const s = seed >>> 0;
  let pile = buildDeck(s);
  const hands = { A: [], B: [] };
  for (let i = 0; i < HAND_SIZE; i++) {
    hands.A.push(pile.pop());
    hands.B.push(pile.pop());
  }
  const discard = [];
  // Starter must be a number card
  const kept = [];
  while (pile.length) {
    const c = pile.pop();
    if (c.kind === 'number') {
      discard.push(c);
      break;
    }
    kept.push(c);
  }
  pile = kept.concat(pile);
  const top = discard[discard.length - 1];
  return {
    seed: s,
    pile,
    discard,
    hands,
    turn: 'A',
    turnCount: 1,
    actionSeq: 0,
    color: top.color,
    mustDraw: false,
    drawnId: null, // card id drawn this turn (must play this or pass)
    unoArmed: { A: false, B: false },
    unoPending: null,
    winner: null,
    reshuffles: 0,
    log: 'Match deal — A starts.'
  };
}

/**
 * Apply a player action. Returns { ok, state, reason? }.
 * actions: { type: 'play', cardId, color? } | { type: 'draw' } | { type: 'pass' }
 *          | { type: 'uno' } | { type: 'catch', target }
 */
export function applyAction(state, role, action) {
  if (!state || state.winner) return { ok: false, reason: 'match over', state };
  if (!action?.type) return { ok: false, reason: 'bad action', state };

  if (action.type === 'uno') {
    const n = state.hands[role].length;
    if (n !== 1 && n !== 2) {
      return { ok: false, reason: 'UNO when you have 1–2 cards', state };
    }
    // Don't bump actionSeq — yelling UNO shouldn't reset the turn clock.
    const next = {
      ...state,
      unoArmed: { ...(state.unoArmed || { A: false, B: false }), [role]: true },
      unoPending: state.unoPending === role ? null : state.unoPending,
      log: `${role} yelled UNO!`
    };
    return { ok: true, state: next };
  }

  if (action.type === 'catch') {
    const target = action.target;
    if (!target || target === role) return { ok: false, reason: 'nobody to catch', state };
    const targetCount = state.hands[target]?.length ?? 0;
    const catchable = state.unoPending === target
      || (targetCount === 1 && !(state.unoArmed || {})[target]);
    if (!catchable || targetCount !== 1) {
      return { ok: false, reason: 'they called UNO (or not at one)', state };
    }
    let next = drawFromPile(state, target, 2);
    delete next._drew;
    next = {
      ...next,
      unoPending: null,
      unoArmed: { ...(next.unoArmed || { A: false, B: false }), [target]: false },
      log: `${role} caught ${target} without UNO — +2!`
    };
    return { ok: true, state: next };
  }

  if (state.turn !== role) return { ok: false, reason: 'not your turn', state };

  if (action.type === 'draw') {
    if (state.mustDraw) return { ok: false, reason: 'already drew', state };
    const before = state.hands[role].length;
    let next = drawFromPile(state, role, 1);
    const drew = next._drew || 0;
    delete next._drew;

    if (drew < 1) {
      // Nothing left to draw — pass the turn.
      next = bump(passTurn(next, other(role)), {
        mustDraw: false,
        drawnId: null,
        log: `${role} — deck empty, turn passed.`
      });
      return { ok: true, state: next };
    }

    const drawn = next.hands[role][next.hands[role].length - 1];
    const playable = drawn && canPlay(drawn, next.discard[next.discard.length - 1], next.color);
    const count = next.hands[role].length;
    next = {
      ...next,
      mustDraw: true,
      drawnId: drawn.id,
      unoArmed: {
        ...(next.unoArmed || { A: false, B: false }),
        [role]: count <= 2 ? !!(next.unoArmed || {})[role] : false
      },
      unoPending: count === 1 ? next.unoPending : (next.unoPending === role ? null : next.unoPending)
    };

    if (!playable) {
      next = bump(passTurn(next, other(role)), {
        mustDraw: false,
        drawnId: null,
        log: `${role} drew and cannot play.`
      });
      return { ok: true, state: next };
    }

    next = bump(next, {
      log: `${role} drew a card — play it or pass.`
    });
    // Sanity: hand grew
    if (next.hands[role].length !== before + 1) {
      /* keep state as-is */
    }
    return { ok: true, state: next };
  }

  if (action.type === 'pass') {
    if (!state.mustDraw) return { ok: false, reason: 'draw first', state };
    const next = bump(passTurn(state, other(role)), {
      mustDraw: false,
      drawnId: null,
      log: `${role} passed.`
    });
    return { ok: true, state: next };
  }

  if (action.type === 'play') {
    const hand = state.hands[role];
    const idx = hand.findIndex(c => c.id === action.cardId);
    if (idx < 0) return { ok: false, reason: 'card not in hand', state };
    const card = hand[idx];
    const top = state.discard[state.discard.length - 1];

    // After drawing, may only play the drawn card
    if (state.mustDraw) {
      const drawnId = state.drawnId || hand[hand.length - 1]?.id;
      if (card.id !== drawnId) {
        return { ok: false, reason: 'play the drawn card or pass', state };
      }
    }

    if (!canPlay(card, top, state.color)) return { ok: false, reason: 'cannot play that', state };

    let chosenColor = state.color;
    if (isWild(card)) {
      if (!COLORS.includes(action.color)) return { ok: false, reason: 'pick a color', state };
      chosenColor = action.color;
    }

    const newHand = hand.slice();
    newHand.splice(idx, 1);
    const armed = { ...(state.unoArmed || { A: false, B: false }) };
    let next = {
      ...state,
      hands: { ...state.hands, [role]: newHand },
      discard: state.discard.concat([card]),
      color: isWild(card) ? chosenColor : card.color,
      mustDraw: false,
      drawnId: null,
      unoArmed: armed
    };

    // UNO bookkeeping: must arm (press UNO) before/at 2→1, or you're catchable
    if (newHand.length === 1) {
      if (armed[role]) {
        next.unoPending = null;
        next.log = `${role} plays to one — UNO!`;
      } else {
        next.unoPending = role;
        next.log = `${role} forgot UNO — catch them!`;
      }
    } else if (newHand.length === 0) {
      next = bump(next, {
        winner: role,
        unoPending: null,
        unoArmed: { A: false, B: false },
        log: `${role} wins!`
      });
      return { ok: true, state: next };
    } else {
      next.unoArmed = { ...armed, [role]: false };
      if (next.unoPending === role) next.unoPending = null;
      next.log = `${role} played.`;
    }

    // 2-player action effects: skip / reverse / draw2 / wild4 → same player goes again
    const foe = other(role);
    let effectLog = next.log;
    if (card.kind === 'draw2') {
      next = drawFromPile(next, foe, 2);
      delete next._drew;
      next = passTurn(next, role);
      next = clearUnoIfNotOne(next, foe);
      effectLog = `${role} played +2.`;
    } else if (card.kind === 'wild4') {
      next = drawFromPile(next, foe, 4);
      delete next._drew;
      next = passTurn(next, role);
      next = clearUnoIfNotOne(next, foe);
      effectLog = `${role} played +4 → ${chosenColor}.`;
    } else if (card.kind === 'skip' || card.kind === 'reverse') {
      next = passTurn(next, role);
      effectLog = card.kind === 'reverse'
        ? `${role} reversed (skip in duo).`
        : `${role} played skip.`;
    } else if (card.kind === 'wild') {
      next = passTurn(next, foe);
      effectLog = `${role} wild → ${chosenColor}.`;
    } else {
      next = passTurn(next, foe);
    }

    if (newHand.length === 1 && next.unoPending === role) {
      effectLog = `${role} forgot UNO — catch them!`;
    } else if (newHand.length === 1 && armed[role]) {
      effectLog = `${role} — UNO!`;
    }

    next = bump(next, { log: effectLog });
    return { ok: true, state: next };
  }

  return { ok: false, reason: 'unknown action', state };
}

/** Public snapshot safe to broadcast (hands as counts for UI sync check). */
export function publicView(state) {
  if (!state) return null;
  return {
    seed: state.seed,
    turn: state.turn,
    turnCount: state.turnCount || 1,
    actionSeq: state.actionSeq || 0,
    color: state.color,
    top: state.discard[state.discard.length - 1],
    pileLen: state.pile.length,
    counts: { A: state.hands.A.length, B: state.hands.B.length },
    mustDraw: state.mustDraw,
    drawnId: state.drawnId,
    unoPending: state.unoPending,
    unoArmed: state.unoArmed,
    winner: state.winner,
    log: state.log,
    reshuffles: state.reshuffles
  };
}
