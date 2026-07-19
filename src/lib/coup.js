// src/lib/coup.js — "Coup: Köln Edition" data layer + PURE rules engine.
//
// The entire ruleset lives in the pure section as a deterministic reducer:
// both clients apply the same moves in the same order and reach identical
// states (lockstep). The deck is shuffled ONCE from the shared seed and
// NEVER again — returned/revealed cards go to the BOTTOM, so counting
// cards is a real skill, as designed.

import { CONFIG } from './config.js';

let clientPromise = null;

async function getClient() {
  if (!clientPromise) {
    const { createClient } = await import('@supabase/supabase-js');
    clientPromise = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  }
  return clientPromise;
}

export async function myRoleInDuo(code) {
  const supabase = await getClient();
  const { data: u } = await supabase.auth.getUser();
  const uid = u?.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase.rpc('list_my_duos', {});
  if (error) return null;
  const d = (data || []).find(x => x.code === code);
  if (!d) return null;
  return d.member_a === uid ? 'A' : d.member_b === uid ? 'B' : null;
}

export async function duoNames(code) {
  const supabase = await getClient();
  const { data } = await supabase.rpc('list_my_duos', {});
  const d = (data || []).find(x => x.code === code);
  return d ? { A: d.name_a, B: d.name_b } : { A: 'A', B: 'B' };
}

export async function loadCoup(code) {
  const supabase = await getClient();
  const { data, error } = await supabase
    .from('coup_results').select('wins_a, wins_b').eq('duo_code', code).maybeSingle();
  if (error || !data) return { a: 0, b: 0 };
  return { a: data.wins_a, b: data.wins_b };
}

export async function recordCoup(code, winner) {
  const supabase = await getClient();
  const { data, error } = await supabase.rpc('record_coup', { p_duo_code: code, p_winner: winner });
  if (error) throw new Error(error.message);
  return data;
}

export async function coupChannel(code) {
  const supabase = await getClient();
  let cb = () => {};
  const ch = supabase
    .channel('coup-' + code, { config: { broadcast: { self: false } } })
    .on('broadcast', { event: 'm' }, p => cb(p.payload))
    .subscribe();
  return {
    send: payload => ch.send({ type: 'broadcast', event: 'm', payload }),
    on: fn => { cb = fn; },
    close: () => supabase.removeChannel(ch)
  };
}

/* ================= PURE ENGINE (no imports below this line) ================= */

export const ROLES = {
  assassin:    { id: 'assassin',    name: 'Assassin',    emoji: '\u{1F5E1}\uFE0F' },
  colonel:     { id: 'colonel',     name: 'Colonel',     emoji: '\u{1F396}\uFE0F' },
  policeman:   { id: 'policeman',   name: 'Policeman',   emoji: '\u{1F575}\uFE0F' },
  businessman: { id: 'businessman', name: 'Businessman', emoji: '\u{1F4BC}' },
  taxman:      { id: 'taxman',      name: 'Taxman',      emoji: '\u{1F9FE}' },
  thief:       { id: 'thief',       name: 'Thief',       emoji: '\u{1F9B9}' },
  ambassador:  { id: 'ambassador',  name: 'Ambassador',  emoji: '\u{1F3AD}' }
};
export const ROLE_IDS = Object.keys(ROLES);
export const COPIES = 3;

// Actions and their claims/blocks. cost paid on declaration (no refunds).
export const ACTIONS = {
  income:      { name: 'Income',       claim: null,          cost: 0, blockedBy: [] },
  aid:         { name: 'Foreign Aid',  claim: null,          cost: 0, blockedBy: ['taxman'] },
  coup:        { name: 'Coup',         claim: null,          cost: 7, blockedBy: [] },
  business:    { name: 'Deal (+4)',    claim: 'businessman', cost: 0, blockedBy: [] },
  steal:       { name: 'Steal (2)',    claim: 'thief',       cost: 0, blockedBy: ['thief'] },
  assassinate: { name: 'Assassinate',  claim: 'assassin',    cost: 3, blockedBy: ['colonel'] },
  peek:        { name: 'Inspect',      claim: 'policeman',   cost: 0, blockedBy: ['policeman'] },
  exchange:    { name: 'Exchange',     claim: 'ambassador',  cost: 0, blockedBy: [] },
  accuse:      { name: 'Accuse',       claim: 'colonel',     cost: 4, blockedBy: [] }
};

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// One shuffle at game start. Never again.
export function buildDeck(seed) {
  const deck = [];
  for (const r of ROLE_IDS) for (let i = 0; i < COPIES; i++) deck.push(r);
  const rnd = mulberry32(seed);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function initialState(seed) {
  const deck = buildDeck(seed);
  const hands = {
    A: [{ role: deck[0], dead: false }, { role: deck[1], dead: false }],
    B: [{ role: deck[2], dead: false }, { role: deck[3], dead: false }]
  };
  return {
    seed,
    deck: deck.slice(4),                 // ordered; draw from index 0 (top)
    hands,
    coins: { A: 1, B: 2 },               // A moves first, so starts poorer
    turn: 'A',
    phase: 'action',                     // action|challenge|block|blockChallenge|skim|skimChallenge|lose|exchange|over
    pending: null,                       // context of the in-flight action
    loseQueue: [],                       // players who must discard, in order
    peeks: { A: null, B: null },         // last peek result per peeker {idx, role}
    winner: null,
    log: ['Game start. 21 cards, one shuffle, count away.']
  };
}

const other = p => (p === 'A' ? 'B' : 'A');
const alive = (st, p) => st.hands[p].filter(c => !c.dead);
const clone = st => JSON.parse(JSON.stringify(st));

function holdsRole(st, p, role) {
  return st.hands[p].some(c => !c.dead && c.role === role);
}

// Reveal one alive copy of `role` from p's hand to the deck bottom, draw top.
function swapRevealed(st, p, role) {
  const idx = st.hands[p].findIndex(c => !c.dead && c.role === role);
  st.deck.push(role);                          // to the BOTTOM (no shuffle)
  st.hands[p][idx] = { role: st.deck.shift(), dead: false };
}

function queueLose(st, p) { st.loseQueue.push(p); }

function processQueue(st) {
  // enter 'lose' phase if someone owes a card; auto-pick if only one alive.
  while (st.loseQueue.length) {
    const p = st.loseQueue[0];
    const av = alive(st, p);
    if (av.length === 0) { st.loseQueue.shift(); continue; }
    if (av.length === 1) {
      const idx = st.hands[p].findIndex(c => !c.dead);
      st.hands[p][idx].dead = true;
      st.log.push(`${p} loses their last influence: ${ROLES[st.hands[p][idx].role].name}.`);
      st.loseQueue.shift();
      continue;
    }
    st.phase = 'lose';
    return;
  }
  // nobody owes a card — check win, else continue flow
  checkWin(st);
  if (st.phase !== 'over') advanceAfterResolution(st);
}

function checkWin(st) {
  for (const p of ['A', 'B']) {
    if (alive(st, p).length === 0) {
      st.winner = other(p);
      st.phase = 'over';
      st.log.push(`${st.winner} wins the game!`);
    }
  }
}

function advanceAfterResolution(st) {
  if (st.phase === 'over') return;
  if (st.pending && st.pending.resumeExchange) {
    st.pending.resumeExchange = false;
    beginExchange(st, st.pending.by);
    return;
  }
  st.pending = null;
  st.turn = other(st.turn);
  st.phase = 'action';
}

function beginExchange(st, p) {
  const drawn = [st.deck.shift(), st.deck.shift()];
  st.pending = { type: 'exchange', by: p, drawn };
  st.phase = 'exchange';
  st.log.push(`${p} draws 2 for exchange.`);
}

// Resolve the pending main action's effect (post any challenge/block).
function resolveAction(st) {
  const pd = st.pending;
  const by = pd.by, opp = other(by);
  switch (pd.action) {
    case 'income': st.coins[by] += 1; st.log.push(`${by} takes income (+1).`); break;
    case 'aid':    st.coins[by] += 2; st.log.push(`${by} takes foreign aid (+2).`); break;
    case 'coup':
      st.log.push(`${by} launches a coup!`);
      queueLose(st, opp);
      break;
    case 'business':
      st.coins[by] += 4;
      st.log.push(`${by} closes a deal (+4).`);
      // taxman skim window before the turn passes
      st.pending = { type: 'skim', by, opp };
      st.phase = 'skim';
      return;
    case 'steal': {
      const take = Math.min(2, st.coins[opp]);
      st.coins[opp] -= take; st.coins[by] += take;
      st.log.push(`${by} steals ${take}.`);
      break;
    }
    case 'assassinate':
      st.log.push(`${by}'s assassin strikes!`);
      queueLose(st, opp);
      break;
    case 'peek': {
      const av = st.hands[opp].map((c, i) => ({ c, i })).filter(x => !x.c.dead);
      const pick = av[Math.floor(mulberry32((st.seed ^ (st.log.length * 7919)) >>> 0)() * av.length)];
      st.peeks[by] = { idx: pick.i, role: pick.c.role };
      st.log.push(`${by} inspects one of ${opp}'s cards.`);
      break;
    }
    case 'exchange':
      st.pending.resumeExchange = true;   // handled after any queue
      break;
    case 'accuse': {
      const role = pd.accuseRole;
      if (holdsRole(st, opp, role)) {
        st.log.push(`${by} accuses ${opp} of ${ROLES[role].name} \u2014 TRUE! The card dies.`);
        const idx = st.hands[opp].findIndex(c => !c.dead && c.role === role);
        st.hands[opp][idx].dead = true;
      } else {
        st.coins[opp] += 4;
        st.log.push(`${by} accuses ${opp} of ${ROLES[role].name} \u2014 wrong. ${opp} pockets the 4.`);
      }
      break;
    }
  }
  processQueue(st);
}

// ---------- the reducer ----------
// moves: {t:'action', action, accuseRole?}  by turn player
//        {t:'challenge'} | {t:'allow'}       by reactor
//        {t:'block', role}                    by reactor
//        {t:'blockChallenge'} | {t:'blockAllow'}  by original actor
//        {t:'skim'} | {t:'skimPass'}          by opponent of businessman
//        {t:'skimChallenge'} | {t:'skimAllow'} by businessman
//        {t:'pickLose', idx}                  by loseQueue[0]
//        {t:'exchangeKeep', keep:[...]}       by exchanger (indices into pool)
export function applyMove(state, move, by) {
  const st = clone(state);
  const opp = other(by);

  const fail = msg => { st.error = msg; return st; };
  delete st.error;

  switch (move.t) {
    case 'action': {
      if (st.phase !== 'action' || st.turn !== by) return fail('Not your turn');
      const a = ACTIONS[move.action];
      if (!a) return fail('Unknown action');
      if (st.coins[by] >= 10 && move.action !== 'coup') return fail('With 10+ coins you must Coup');
      if (a.cost > st.coins[by]) return fail('Not enough coins');
      st.coins[by] -= a.cost;                        // paid on declaration
      st.pending = { type: 'main', by, action: move.action, claim: a.claim, accuseRole: move.accuseRole || null };
      st.log.push(`${by} declares ${a.name}${a.claim ? ` (claims ${ROLES[a.claim].name})` : ''}${move.action === 'accuse' ? ` \u2192 "${ROLES[move.accuseRole].name}"` : ''}.`);
      if (a.claim) { st.phase = 'challenge'; }
      else if (a.blockedBy.length) { st.phase = 'block'; }
      else { resolveAction(st); }
      return st;
    }

    case 'challenge': {
      if (st.phase !== 'challenge' || by !== other(st.pending.by)) return fail('No challenge now');
      const actor = st.pending.by, claim = st.pending.claim;
      if (holdsRole(st, actor, claim)) {
        st.log.push(`${by} challenges \u2014 but ${actor} really has ${ROLES[claim].name}! Card returns to the deck bottom; ${actor} draws.`);
        swapRevealed(st, actor, claim);
        queueLose(st, by);
        st.pending.afterQueue = 'proceed';          // action continues after loss
        processQueueThen(st);
      } else {
        st.log.push(`${by} challenges \u2014 ${actor} was BLUFFING! The ${ACTIONS[st.pending.action].name} fails.`);
        queueLose(st, actor);
        st.pending.afterQueue = 'cancel';
        processQueueThen(st);
      }
      return st;
    }

    case 'allow': {
      if (st.phase !== 'challenge' || by !== other(st.pending.by)) return fail('Nothing to allow');
      const a = ACTIONS[st.pending.action];
      if (a.blockedBy.length) st.phase = 'block';
      else resolveAction(st);
      return st;
    }

    case 'blockPass': {
      if (st.phase !== 'block' || by !== other(st.pending.by)) return fail('No block to pass');
      resolveAction(st);
      return st;
    }

    case 'block': {
      if (st.phase !== 'block' || by !== other(st.pending.by)) return fail('No block now');
      const a = ACTIONS[st.pending.action];
      if (!a.blockedBy.includes(move.role)) return fail('That role cannot block this');
      st.pending.blockRole = move.role;
      st.pending.blocker = by;
      st.phase = 'blockChallenge';
      st.log.push(`${by} claims ${ROLES[move.role].name} to block!`);
      return st;
    }

    case 'blockAllow': {
      if (st.phase !== 'blockChallenge' || by !== st.pending.by) return fail('Nothing to allow');
      st.log.push(`${by} accepts the block. ${ACTIONS[st.pending.action].name} is stopped.`);
      st.pending = null;
      st.turn = other(st.turn);
      st.phase = 'action';
      return st;
    }

    case 'blockChallenge': {
      if (st.phase !== 'blockChallenge' || by !== st.pending.by) return fail('No block-challenge now');
      const blocker = st.pending.blocker, role = st.pending.blockRole;
      if (holdsRole(st, blocker, role)) {
        st.log.push(`${by} challenges the block \u2014 but ${blocker} really has ${ROLES[role].name}! Block stands.`);
        swapRevealed(st, blocker, role);
        queueLose(st, by);
        st.pending.afterQueue = 'cancel';          // action stays blocked
        processQueueThen(st);
      } else {
        st.log.push(`${by} challenges the block \u2014 ${blocker} was BLUFFING! The block fails.`);
        queueLose(st, blocker);
        st.pending.afterQueue = 'proceed';         // action goes through
        processQueueThen(st);
      }
      return st;
    }

    case 'skim': {
      if (st.phase !== 'skim' || by !== st.pending.opp) return fail('No skim now');
      st.pending.type = 'skimClaim';
      st.phase = 'skimChallenge';
      st.log.push(`${by} claims Taxman \u2014 skims 1 from the deal (pending).`);
      return st;
    }
    case 'skimPass': {
      if (st.phase !== 'skim' || by !== st.pending.opp) return fail('No skim now');
      st.pending = null; st.turn = other(st.turn); st.phase = 'action';
      return st;
    }
    case 'skimAllow': {
      if (st.phase !== 'skimChallenge' || by !== st.pending.by) return fail('Nothing to allow');
      const o = st.pending.opp;
      st.coins[st.pending.by] -= 1; st.coins[o] += 1;
      st.log.push(`Skim allowed \u2014 ${o} takes 1 coin.`);
      st.pending = null; st.turn = other(st.turn); st.phase = 'action';
      return st;
    }
    case 'skimChallenge': {
      if (st.phase !== 'skimChallenge' || by !== st.pending.by) return fail('No challenge now');
      const o = st.pending.opp;
      if (holdsRole(st, o, 'taxman')) {
        st.log.push(`${by} challenges \u2014 ${o} really is the Taxman! Skim stands.`);
        swapRevealed(st, o, 'taxman');
        st.coins[by] -= 1; st.coins[o] += 1;
        queueLose(st, by);
      } else {
        st.log.push(`${by} challenges \u2014 ${o} was BLUFFING the Taxman!`);
        queueLose(st, o);
      }
      st.pending.afterQueue = 'endTurn';
      processQueueThen(st);
      return st;
    }

    case 'pickLose': {
      if (st.phase !== 'lose' || st.loseQueue[0] !== by) return fail('Not your discard');
      const card = st.hands[by][move.idx];
      if (!card || card.dead) return fail('Bad card');
      card.dead = true;
      st.log.push(`${by} loses influence: ${ROLES[card.role].name}.`);
      st.loseQueue.shift();
      processQueueThen(st);
      return st;
    }

    case 'exchangeKeep': {
      if (st.phase !== 'exchange' || st.pending.by !== by) return fail('Not exchanging');
      const mine = st.hands[by].map((c, i) => ({ ...c, src: 'hand', i })).filter(c => !c.dead);
      const pool = [...mine, ...st.pending.drawn.map((r, i) => ({ role: r, src: 'drawn', i }))];
      const keep = move.keep;
      if (keep.length !== mine.length) return fail('Keep exactly ' + mine.length);
      const kept = keep.map(k => pool[k]).filter(Boolean);
      if (kept.length !== keep.length) return fail('Bad selection');
      // rebuild hand: dead cards stay; alive slots refilled with kept roles
      let ki = 0;
      st.hands[by] = st.hands[by].map(c => c.dead ? c : { role: kept[ki++].role, dead: false });
      // everything not kept goes to the BOTTOM in pool order (countable!)
      pool.forEach((p, i) => { if (!keep.includes(i)) st.deck.push(p.role); });
      st.log.push(`${by} completes the exchange \u2014 returns go under the deck.`);
      st.pending = null; st.turn = other(st.turn); st.phase = 'action';
      return st;
    }

    default: return fail('Unknown move');
  }
}

// Small helper: run the lose-queue; when it empties, apply afterQueue intent.
function processQueueThen(st) {
  const intent = st.pending?.afterQueue;
  // temporarily wrap advanceAfterResolution via intent
  while (st.loseQueue.length) {
    const p = st.loseQueue[0];
    const av = alive(st, p);
    if (av.length === 0) { st.loseQueue.shift(); continue; }
    if (av.length === 1) {
      const idx = st.hands[p].findIndex(c => !c.dead);
      st.hands[p][idx].dead = true;
      st.log.push(`${p} loses their last influence: ${ROLES[st.hands[p][idx].role].name}.`);
      st.loseQueue.shift();
      continue;
    }
    st.phase = 'lose';
    return;   // resume when pickLose arrives (afterQueue preserved in pending)
  }
  checkWin(st);
  if (st.phase === 'over') return;
  if (intent === 'proceed') { st.pending.afterQueue = null; resolveAction(st); }
  else if (intent === 'cancel' || intent === 'endTurn') {
    st.pending = null; st.turn = other(st.turn); st.phase = 'action';
  } else {
    // no intent: normal resolution path
    advanceAfterResolution(st);
  }
}
