// src/pages/Uno.jsx — Classic UNO play UI (mounted by the uno engine).
// Lockstep over the shell RT channel: shared seed + peer acts.
// Host keeps an act log and sends start+log so invited players catch up mid-game.

import { useEffect, useRef, useState, useCallback } from 'react';
import { flushSync } from 'react-dom';
import {
  COLORS, createMatch, applyAction, canPlay, isWild, cardLabel
} from '../lib/uno.js';
import '../styles/uno.css';

const seedByCode = new Map();

const COLOR_ORDER = { red: 0, yellow: 1, green: 2, blue: 3 };
const KIND_ORDER = { number: 0, skip: 1, reverse: 2, draw2: 3, wild: 4, wild4: 5 };

function sortHand(cards) {
  return [...cards].sort((a, b) => {
    const ca = a.color == null ? 9 : (COLOR_ORDER[a.color] ?? 8);
    const cb = b.color == null ? 9 : (COLOR_ORDER[b.color] ?? 8);
    if (ca !== cb) return ca - cb;
    const ka = KIND_ORDER[a.kind] ?? 9;
    const kb = KIND_ORDER[b.kind] ?? 9;
    if (ka !== kb) return ka - kb;
    const va = typeof a.value === 'number' ? a.value : 99;
    const vb = typeof b.value === 'number' ? b.value : 99;
    return va - vb;
  });
}

function FaceGlyph({ card }) {
  if (!card) return null;
  if (card.kind === 'skip') {
    return (
      <span className="uno-glyph skip" aria-hidden="true">
        <i /><i />
      </span>
    );
  }
  if (card.kind === 'reverse') {
    return (
      <span className="uno-glyph rev" aria-hidden="true">
        <svg viewBox="0 0 32 32" width="1em" height="1em">
          <path d="M8 14c0-4 4-7 9-7h3l-3-4 8 6-8 6 3-4h-3c-3 0-5 1.5-5 3z" fill="currentColor" />
          <path d="M24 18c0 4-4 7-9 7h-3l3 4-8-6 8-6-3 4h3c3 0 5-1.5 5-3z" fill="currentColor" />
        </svg>
      </span>
    );
  }
  if (card.kind === 'wild') {
    return (
      <span className="uno-glyph wildpie" aria-hidden="true">
        <i className="r" /><i className="y" /><i className="g" /><i className="b" />
      </span>
    );
  }
  if (card.kind === 'wild4') {
    return (
      <span className="uno-glyph wild4" aria-hidden="true">
        <span className="uno-mini-stack">
          <i className="r" /><i className="y" /><i className="g" /><i className="b" />
        </span>
        <b>+4</b>
      </span>
    );
  }
  return <span className="uno-glyph txt">{cardLabel(card)}</span>;
}

function CornerGlyph({ card }) {
  if (!card) return null;
  if (card.kind === 'wild') return <span className="uno-corner-wild" />;
  if (card.kind === 'skip') return <span className="uno-corner-skip" />;
  if (card.kind === 'reverse') return <span className="uno-corner-rev">⇄</span>;
  return cardLabel(card);
}

function CardBackFace({ className = '', style }) {
  return (
    <div className={`uno-card uno-back ${className}`.trim()} style={style} aria-hidden="true">
      <span className="uno-back-ring">
        <span className="uno-back-oval">
          <span className="uno-back-logo">UNO</span>
        </span>
      </span>
    </div>
  );
}

function UnoCard({ card, face = true, playable, selected, dim, onClick, title, style }) {
  if (!face || !card) {
    if (!onClick) return <CardBackFace style={style} />;
    return (
      <button
        type="button"
        className="uno-card uno-back"
        onClick={onClick}
        title={title || 'UNO'}
        style={style}
      >
        <span className="uno-back-ring">
          <span className="uno-back-oval">
            <span className="uno-back-logo">UNO</span>
          </span>
        </span>
      </button>
    );
  }

  const wild = isWild(card);
  const cls = [
    'uno-card',
    'uno-face',
    wild ? 'wild' : `c-${card.color}`,
    `k-${card.kind}`,
    playable ? 'playable' : '',
    selected ? 'selected' : '',
    dim ? 'dim' : ''
  ].filter(Boolean).join(' ');

  return (
    <button
      type="button"
      className={cls}
      onClick={onClick}
      disabled={!onClick}
      title={title || `${card.color || 'wild'} ${cardLabel(card) || card.kind}`}
      style={style}
    >
      <span className="uno-face-inset">
        <span className="uno-card-corner tl"><CornerGlyph card={card} /></span>
        <span className="uno-oval">
          <FaceGlyph card={card} />
        </span>
        <span className="uno-card-corner br"><CornerGlyph card={card} /></span>
      </span>
    </button>
  );
}

function ColorPicker({ onPick, onCancel }) {
  return (
    <div className="uno-modal" role="dialog" aria-label="Choose a color">
      <div className="uno-modal-card">
        <div className="uno-modal-h">Pick a color</div>
        <div className="uno-colors">
          {COLORS.map(c => (
            <button key={c} type="button" className={`uno-color c-${c}`} onClick={() => onPick(c)} aria-label={c} />
          ))}
        </div>
        <button type="button" className="btn ghost small" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function ShuffleSplash() {
  return (
    <div className="uno-shuffle" aria-live="polite">
      <div className="uno-shuffle-stack">
        {Array.from({ length: 7 }, (_, i) => (
          <span key={i} className="uno-shuffle-card" style={{ '--i': i }}>
            <span className="uno-back-ring">
              <span className="uno-back-oval"><span className="uno-back-logo">UNO</span></span>
            </span>
          </span>
        ))}
      </div>
      <div className="uno-shuffle-lbl">Shuffling…</div>
    </div>
  );
}

function PlayerIcon({ seat, turn, winner, names, corner }) {
  const lit = !winner && turn === seat;
  const won = winner === seat;
  const label = names[seat] || seat;
  return (
    <div
      className={
        'uno-turn-av p' + seat
        + (lit || won ? ' lit' : '')
        + (won ? ' win' : '')
        + (corner ? ' ' + corner : '')
      }
      title={label}
      aria-label={label + (lit ? ' — their turn' : '')}
    >
      <span>{(label.trim()[0] || seat).toUpperCase()}</span>
    </div>
  );
}

const TURN_SECONDS = 30;
const TIMER_R = 13;
const TIMER_C = 2 * Math.PI * TIMER_R;

function pickAutoColor(hand, fallback) {
  const tally = { red: 0, yellow: 0, green: 0, blue: 0 };
  for (const c of hand) {
    if (c.color && tally[c.color] != null) tally[c.color] += 1;
  }
  let best = fallback && COLORS.includes(fallback) ? fallback : 'red';
  let n = -1;
  for (const col of COLORS) {
    if (tally[col] > n) { n = tally[col]; best = col; }
  }
  return best;
}

function TurnTimer({ side, turnKey, seconds = TURN_SECONDS }) {
  if (!turnKey) return null;
  return (
    <div
      className={'uno-turn-timer ' + side}
      key={turnKey}
      title={`${seconds}s`}
      aria-label={`Turn timer ${seconds} seconds`}
    >
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <circle className="track" cx="16" cy="16" r={TIMER_R} />
        <circle
          className="arc draining"
          cx="16" cy="16" r={TIMER_R}
          strokeDasharray={TIMER_C}
          style={{ animationDuration: `${seconds}s` }}
        />
      </svg>
    </div>
  );
}

function normalizeState(next) {
  if (!next) return next;
  let s = next;
  if (s.drawnId === undefined) s = { ...s, drawnId: null };
  if (s.actionSeq == null) s = { ...s, actionSeq: 0 };
  if (!s.unoArmed) s = { ...s, unoArmed: { A: false, B: false } };
  return s;
}

export default function Uno({ myRole, names = {}, rt, code, onComplete, startedAt }) {
  const me = myRole;
  const partner = me === 'A' ? 'B' : 'A';

  const [phase, setPhase] = useState('wait'); // wait | shuffle | play | done
  const [state, setState] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [picking, setPicking] = useState(null);
  const [flash, setFlash] = useState('');
  const [dealIn, setDealIn] = useState(false);
  const [linkReady, setLinkReady] = useState(() => !!rt?.isReady?.());

  const stateRef = useRef(null);
  const seedRef = useRef(null);
  const startedRef = useRef(false);
  const finishedRef = useRef(false);
  const autoFiredRef = useRef('');
  const meRef = useRef(me);
  const pendingActsRef = useRef([]);
  const seenActsRef = useRef(new Set());
  const shuffleTimersRef = useRef([]);
  const flashTimerRef = useRef(0);
  const mountedRef = useRef(true);
  const bootKeyRef = useRef('');
  meRef.current = me;
  stateRef.current = state;

  const showFlash = useCallback((msg, ms = 1400) => {
    setFlash(msg);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => setFlash(''), ms);
  }, []);

  const clearShuffleTimers = useCallback(() => {
    shuffleTimersRef.current.forEach(id => clearTimeout(id));
    shuffleTimersRef.current = [];
  }, []);

  const playDealAnim = useCallback(() => {
    clearShuffleTimers();
    setPhase('shuffle');
    setDealIn(false);
    const t1 = window.setTimeout(() => {
      if (!mountedRef.current) return;
      setPhase(p => (stateRef.current?.winner ? 'done' : 'play'));
      setDealIn(true);
      const t2 = window.setTimeout(() => {
        if (mountedRef.current) setDealIn(false);
      }, 700);
      shuffleTimersRef.current.push(t2);
    }, 1100);
    shuffleTimersRef.current.push(t1);
  }, [clearShuffleTimers]);

  // Stable refs so RT handlers never re-subscribe (re-subscribe was dropping moves).
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const playDealAnimRef = useRef(playDealAnim);
  playDealAnimRef.current = playDealAnim;
  const showFlashRef = useRef(showFlash);
  showFlashRef.current = showFlash;
  const rtRef = useRef(rt);
  rtRef.current = rt;

  const commit = useCallback((next, { animate = false, sync = false } = {}) => {
    const normalized = normalizeState(next);
    if (!normalized) return;
    const apply = () => {
      stateRef.current = normalized;
      setState(normalized);
      setSelectedId(null);
      setPicking(null);

      if (animate) {
        playDealAnimRef.current();
      } else {
        setPhase(p => {
          if (normalized.winner) return 'done';
          if (p === 'wait' || p === 'shuffle') return 'play';
          return p;
        });
      }

      if (normalized.winner && !finishedRef.current) {
        finishedRef.current = true;
        setPhase('done');
        if (meRef.current === 'A') onCompleteRef.current?.(normalized.winner);
      }
    };
    // Local presses must paint immediately; remote catch-up can be async.
    if (sync) flushSync(apply);
    else apply();
  }, []);

  const actCountRef = useRef(0); // acts applied locally (own + peer) — skip redundant catch-up
  const forceCatchUpRef = useRef(false);

  const begin = useCallback((seed, { animate = true, log = null, actionSeq = null } = {}) => {
    if (seed == null) return;
    const n = seed >>> 0;
    const catchUp = Array.isArray(log);
    const force = forceCatchUpRef.current;
    if (force) forceCatchUpRef.current = false;
    if (startedRef.current && seedRef.current === n && stateRef.current && !force) {
      // Plain start resent: ignore. Start+log: only rebuild when behind/desynced.
      if (!catchUp) return;
      const hostSeq = actionSeq == null ? null : (actionSeq | 0);
      const mySeq = stateRef.current.actionSeq || 0;
      const behind =
        (hostSeq != null && hostSeq > mySeq) ||
        log.length > actCountRef.current;
      if (!behind) return;
    }
    startedRef.current = true;
    seedRef.current = n;
    const key = `${code || 'local'}:${startedAt || 0}`;
    seedByCode.set(key, n);
    finishedRef.current = false;
    seenActsRef.current = new Set();

    // Replay offline into one state, then paint once (avoids guest freezes).
    let st = normalizeState(createMatch(n));
    if (!st) return;
    let applied = 0;

    const replayInto = (cur, m) => {
      if (!m?.action || !cur) return cur;
      const id = m.id || `${m.by}:${JSON.stringify(m.action)}`;
      if (seenActsRef.current.has(id)) return cur;
      seenActsRef.current.add(id);
      const res = applyAction(cur, m.by, m.action);
      if (!res.ok) return cur;
      applied += 1;
      return normalizeState(res.state) || cur;
    };

    if (catchUp) {
      for (const m of log) st = replayInto(st, m);
    }

    const queued = pendingActsRef.current.splice(0);
    for (const m of queued) {
      if (m.by === meRef.current) continue;
      st = replayInto(st, m);
    }

    actCountRef.current = applied;
    commit(st, { animate: catchUp ? false : animate, sync: catchUp });
  }, [code, startedAt, commit]);

  const beginRef = useRef(begin);
  beginRef.current = begin;
  const commitRef = useRef(commit);
  commitRef.current = commit;
  const pendingAcksRef = useRef(new Map()); // id -> { tries, timer }
  const actLogRef = useRef([]); // host: ordered moves for guest catch-up

  const shipRef = useRef(null);
  shipRef.current = (payload) => {
    const fn = rtRef.current?.sendNow || rtRef.current?.send;
    fn?.(payload);
  };

  const emitActRef = useRef(null);
  emitActRef.current = (payload) => {
    shipRef.current?.(payload);
    const prev = pendingAcksRef.current.get(payload.id);
    if (prev) clearTimeout(prev.timer);
    const ent = { tries: 0, timer: 0 };
    const retry = () => {
      if (!pendingAcksRef.current.has(payload.id)) return;
      if (ent.tries >= 3) {
        pendingAcksRef.current.delete(payload.id);
        return;
      }
      ent.tries += 1;
      shipRef.current?.(payload);
      ent.timer = window.setTimeout(retry, 120);
    };
    ent.timer = window.setTimeout(retry, 120);
    pendingAcksRef.current.set(payload.id, ent);
  };

  const pushStartRef = useRef(null);
  pushStartRef.current = () => {
    if (meRef.current !== 'A' || seedRef.current == null) return;
    shipRef.current?.({
      k: 'start',
      seed: seedRef.current,
      log: actLogRef.current.slice(),
      actionSeq: stateRef.current?.actionSeq || 0
    });
  };

  /** Apply locally (instant) + fan out a tiny act. Host keeps a catch-up log. */
  const run = useCallback((action, broadcast = true) => {
    const cur = stateRef.current;
    if (!cur || cur.winner) return false;
    const res = applyAction(cur, meRef.current, action);
    if (!res.ok) {
      showFlashRef.current(res.reason || 'Nope');
      return false;
    }
    commitRef.current(res.state, { sync: true });
    if (broadcast) {
      const id = `${meRef.current}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
      seenActsRef.current.add(id);
      actCountRef.current += 1;
      const payload = { k: 'act', by: meRef.current, action, id, seed: seedRef.current };
      if (meRef.current === 'A') {
        actLogRef.current.push({ by: payload.by, action: payload.action, id: payload.id });
      }
      emitActRef.current?.(payload);
    }
    return true;
  }, []);


  const autoPlayTurn = useCallback(() => {
    const cur = stateRef.current;
    if (!cur || cur.winner || cur.turn !== meRef.current) return;
    const seat = meRef.current;

    const playOne = (card, fromState) => {
      const action = isWild(card)
        ? { type: 'play', cardId: card.id, color: pickAutoColor(fromState.hands[seat], fromState.color) }
        : { type: 'play', cardId: card.id };
      return run(action);
    };

    if (cur.mustDraw) {
      const drawnId = cur.drawnId || cur.hands[seat][cur.hands[seat].length - 1]?.id;
      const drawn = cur.hands[seat].find(c => c.id === drawnId) || cur.hands[seat][cur.hands[seat].length - 1];
      const top = cur.discard[cur.discard.length - 1];
      if (drawn && canPlay(drawn, top, cur.color)) playOne(drawn, cur);
      else run({ type: 'pass' });
      return;
    }

    const top = cur.discard[cur.discard.length - 1];
    const playable = cur.hands[seat].find(c => canPlay(c, top, cur.color));
    if (playable) {
      playOne(playable, cur);
      return;
    }

    if (!run({ type: 'draw' })) return;
    const after = stateRef.current;
    if (!after || after.winner || after.turn !== seat) return;
    if (after.mustDraw) {
      const drawnId = after.drawnId || after.hands[seat][after.hands[seat].length - 1]?.id;
      const drawn = after.hands[seat].find(c => c.id === drawnId);
      const top2 = after.discard[after.discard.length - 1];
      if (drawn && canPlay(drawn, top2, after.color)) playOne(drawn, after);
      else run({ type: 'pass' });
    }
  }, [run]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearShuffleTimers();
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, [clearShuffleTimers]);

  // RT listener via subscribe (additive) — never wipe other handlers.
  useEffect(() => {
    if (!rt) return undefined;
    const onMsg = (m) => {
      if (!m?.k) return;

      if (m.k === 'ack' && m.id) {
        const ent = pendingAcksRef.current.get(m.id);
        if (ent) {
          clearTimeout(ent.timer);
          pendingAcksRef.current.delete(m.id);
        }
        return;
      }

      if (m.k === 'needstart' || m.k === 'hello') {
        if (meRef.current !== 'A' || seedRef.current == null) return;
        const guestSeq = m.actionSeq | 0;
        const hostSeq = stateRef.current?.actionSeq || 0;
        // Always answer first join / forced repair; hello only when guest is behind.
        if (m.k === 'needstart' || m.force || guestSeq < hostSeq || !stateRef.current) {
          pushStartRef.current?.();
        }
        return;
      }

      if (m.k === 'start') {
        beginRef.current(m.seed, {
          animate: meRef.current === 'A' && !stateRef.current,
          log: Array.isArray(m.log) ? m.log : null,
          actionSeq: m.actionSeq
        });
        return;
      }

      if (m.k === 'st') return;

      if (m.k === 'act') {
        if (m.id) shipRef.current?.({ k: 'ack', id: m.id });
        if (m.by === meRef.current) return;
        const id = m.id || `${m.by}:${JSON.stringify(m.action)}`;
        if (seenActsRef.current.has(id)) return;
        if (!stateRef.current || !m.action) {
          pendingActsRef.current.push(m);
          return;
        }
        seenActsRef.current.add(id);
        if (seenActsRef.current.size > 200) {
          seenActsRef.current = new Set([...seenActsRef.current].slice(-80));
          seenActsRef.current.add(id);
        }
        const res = applyAction(stateRef.current, m.by, m.action);
        if (res.ok) {
          actCountRef.current += 1;
          if (meRef.current === 'A') {
            actLogRef.current.push({ by: m.by, action: m.action, id });
          }
          commitRef.current(res.state, { sync: true });
        } else if (meRef.current !== 'A') {
          // Guest diverged — ask host for a full catch-up replay.
          forceCatchUpRef.current = true;
          shipRef.current?.({ k: 'hello', actionSeq: stateRef.current?.actionSeq || 0, force: 1 });
        }
      }
    };

    let unsub = null;
    if (typeof rt.subscribe === 'function') {
      unsub = rt.subscribe(onMsg);
    } else if (typeof rt.on === 'function') {
      rt.on(onMsg);
      unsub = () => { try { rt.on(() => {}); } catch { /* */ } };
    }
    return () => {
      try { unsub?.(); } catch { /* */ }
      for (const ent of pendingAcksRef.current.values()) clearTimeout(ent.timer);
      pendingAcksRef.current.clear();
    };
  }, [rt]);

  // Wait until the live channel is subscribed, then boot once.
  useEffect(() => {
    let cancelled = false;
    const bootKey = `${me}|${code || ''}|${startedAt || 0}`;
    let helloIv = 0;

    (async () => {
      try { await rt?.whenReady?.(); } catch { /* ignore */ }
      if (cancelled) return;
      setLinkReady(true);

      if (bootKeyRef.current === bootKey) return;
      bootKeyRef.current = bootKey;

      if (me === 'A') {
        const key = `${code || 'local'}:${startedAt || 0}`;
        let seed = seedByCode.get(key);
        if (seed == null) {
          seed = ((Date.now() ^ (Math.random() * 0xFFFFFFFF)) >>> 0);
          seedByCode.set(key, seed);
        }
        seedRef.current = seed;
        actLogRef.current = [];
        actCountRef.current = 0;
        beginRef.current(seed, { animate: true, log: null });
        pushStartRef.current?.();
        setTimeout(() => pushStartRef.current?.(), 400);
        setTimeout(() => pushStartRef.current?.(), 1000);
        return;
      }

      // Invited player: keep requesting catch-up until we have a live table.
      let tries = 0;
      const ask = () => {
        if (cancelled) return;
        tries += 1;
        shipRef.current?.({
          k: startedRef.current && stateRef.current ? 'hello' : 'needstart',
          actionSeq: stateRef.current?.actionSeq || 0
        });
        if (tries < 20) setTimeout(ask, 500);
      };
      ask();
      // Soft heartbeat so a mid-game desync self-heals without freezing.
      helloIv = window.setInterval(() => {
        if (!stateRef.current || stateRef.current.winner) return;
        shipRef.current?.({ k: 'hello', actionSeq: stateRef.current.actionSeq || 0 });
      }, 4000);
    })();

    return () => {
      cancelled = true;
      if (helloIv) clearInterval(helloIv);
    };
  }, [me, rt, code, startedAt]);

  const turnClockKey = state
    ? `${state.turn}|${state.actionSeq || 0}|${state.mustDraw ? 1 : 0}|${state.winner || ''}`
    : '';

  // Auto-play once when the turn clock expires — no per-frame parent re-renders.
  useEffect(() => {
    if (phase !== 'play' || !state || state.winner) return undefined;
    if (state.turn !== me) return undefined;
    if (!turnClockKey) return undefined;
    const key = turnClockKey;
    const id = window.setTimeout(() => {
      if (autoFiredRef.current === key) return;
      if (stateRef.current?.turn !== meRef.current) return;
      autoFiredRef.current = key;
      autoPlayTurn();
    }, TURN_SECONDS * 1000);
    return () => clearTimeout(id);
  }, [turnClockKey, phase, state, me, autoPlayTurn]);

  function drawnCardId(st, seat) {
    if (!st) return null;
    if (st.drawnId) return st.drawnId;
    const hand = st.hands?.[seat];
    return hand?.[hand.length - 1]?.id || null;
  }

  function onCardTap(card) {
    if (!state || state.winner || state.turn !== me) return;
    if (state.mustDraw) {
      const only = drawnCardId(state, me);
      if (card.id !== only) {
        showFlash('Play the drawn card or pass');
        return;
      }
    }
    const top = state.discard[state.discard.length - 1];
    if (!canPlay(card, top, state.color)) {
      showFlash('Doesn’t match');
      return;
    }
    if (isWild(card)) {
      setPicking(card);
      setSelectedId(card.id);
      return;
    }
    run({ type: 'play', cardId: card.id });
  }

  function confirmWild(color) {
    if (!picking) return;
    run({ type: 'play', cardId: picking.id, color });
    setPicking(null);
  }

  if (phase === 'wait' || !state) {
    return (
      <div className="uno-page uno-embedded">
        <div className="uno-status">
          {!linkReady ? 'Connecting to partner…' : 'Shuffling the deck…'}
        </div>
      </div>
    );
  }

  if (phase === 'shuffle') {
    return (
      <div className="uno-page uno-embedded">
        <div className="uno-table">
          <ShuffleSplash />
        </div>
      </div>
    );
  }

  const myHand = state.hands[me];
  const theirCount = state.hands[partner].length;
  const top = state.discard[state.discard.length - 1];
  const myTurn = state.turn === me && !state.winner;
  const armed = !!(state.unoArmed || {})[me];
  const showUnoBtn = myHand.length <= 2 && !state.winner;
  const partnerCatchable = theirCount === 1
    && !state.winner
    && (state.unoPending === partner || !(state.unoArmed || {})[partner]);
  const canDraw = myTurn && !state.mustDraw;
  const onlyDrawnId = state.mustDraw ? drawnCardId(state, me) : null;
  const sortedHand = sortHand(myHand);
  const n = sortedHand.length || 1;

  return (
    <div className="uno-page uno-embedded">
      <div className={`uno-table c-${state.color}${dealIn ? ' dealing' : ''}`}>
        <PlayerIcon
          seat={partner}
          turn={state.turn}
          winner={state.winner}
          names={names}
          corner="corner-tl"
        />
        <PlayerIcon
          seat={me}
          turn={state.turn}
          winner={state.winner}
          names={names}
          corner="corner-br"
        />
        {!state.winner && (
          <TurnTimer
            side={myTurn ? 'mine' : 'theirs'}
            turnKey={phase === 'play' ? turnClockKey : ''}
          />
        )}

        <div className="uno-rail top">
          {theirCount === 1 && (
            <span className={'uno-tag' + (partnerCatchable ? ' danger' : ' ok')}>
              {partnerCatchable ? 'no UNO' : 'UNO'}
            </span>
          )}
          <div className="uno-opp-hand" aria-label="Partner hand">
            {Array.from({ length: Math.min(theirCount, 12) }, (_, i) => (
              <CardBackFace
                key={i}
                style={{ '--fan': `${(i - Math.min(theirCount, 12) / 2) * 4}deg` }}
              />
            ))}
            {theirCount > 12 && <span className="uno-more">+{theirCount - 12}</span>}
          </div>
        </div>

        <div className="uno-mid">
          <div className="uno-piles">
            <button
              type="button"
              className={'uno-drawpile' + (canDraw ? ' go' : '')}
              onClick={() => { if (canDraw) run({ type: 'draw' }); }}
              disabled={!canDraw}
              title="Tap to draw"
            >
              <span className="uno-draw-stack">
                <CardBackFace />
                <CardBackFace />
                <CardBackFace />
              </span>
              {canDraw && <span className="uno-pile-lbl">Tap to draw</span>}
            </button>

            <div className="uno-discard">
              <UnoCard card={top} />
            </div>
          </div>

          <div className="uno-status-col">
            {state.winner ? (
              <div className="uno-turn-line">
                {state.winner === me ? 'You win!' : `${names[state.winner] || state.winner} wins!`}
              </div>
            ) : (
              <div className={'uno-turn-line' + (myTurn ? ' mine' : '')}>
                {myTurn
                  ? (state.mustDraw ? 'Your turn — play or pass' : 'Your turn')
                  : `${names[partner] || 'Opponent'}'s turn`}
              </div>
            )}
            {flash && <div className="uno-flash">{flash}</div>}
          </div>
        </div>

        <div className="uno-rail bottom">
          <div className="uno-actions">
            {showUnoBtn && (
              <button
                type="button"
                className={'uno-uno-btn' + (armed ? ' armed' : '')}
                onClick={() => run({ type: 'uno' })}
              >
                {armed ? 'UNO ✓' : 'UNO!'}
              </button>
            )}
            {partnerCatchable && (
              <button type="button" className="uno-catch-btn" onClick={() => run({ type: 'catch', target: partner })}>
                Catch! +2
              </button>
            )}
            {myTurn && state.mustDraw && (
              <button type="button" className="btn warm small" onClick={() => run({ type: 'pass' })}>
                Pass
              </button>
            )}
          </div>
          {showUnoBtn && !armed && myHand.length === 2 && (
            <div className="uno-hint">Press UNO! before you play your second-last card</div>
          )}
          <div
            className={'uno-hand' + (dealIn ? ' deal-in' : '')}
            aria-label="Your hand"
            style={{
              '--hand-scale': n <= 7 ? 1 : Math.max(0.74, 7.2 / n),
              '--hand-overlap': `${n <= 6 ? -20 : n <= 9 ? -26 : -32}px`
            }}
          >
            {sortedHand.map((card, i) => {
              const playable = myTurn
                && canPlay(card, top, state.color)
                && (!state.mustDraw || card.id === onlyDrawnId);
              const fanStep = n <= 6 ? 3.2 : n <= 10 ? 2.2 : 1.5;
              const fan = ((i - (n - 1) / 2) * fanStep);
              return (
                <UnoCard
                  key={card.id}
                  card={card}
                  playable={playable}
                  selected={selectedId === card.id}
                  dim={myTurn && !playable}
                  onClick={myTurn ? () => onCardTap(card) : undefined}
                  style={{ '--fan': `${fan}deg`, '--di': i }}
                />
              );
            })}
          </div>
        </div>
      </div>

      {phase === 'done' && state.winner && (
        <div className="uno-done">
          <div className="uno-winline">
            {state.winner === me ? 'You emptied your hand!' : `${names[state.winner] || state.winner} wins the table!`}
          </div>
        </div>
      )}

      {picking && (
        <ColorPicker onPick={confirmWild} onCancel={() => { setPicking(null); setSelectedId(null); }} />
      )}
    </div>
  );
}
