// src/pages/Uno.jsx — Classic UNO play UI (mounted by the uno engine).

import { useEffect, useRef, useState, useCallback } from 'react';
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

/** Thin yellow ring that empties to black as the turn clock runs out. */
function TurnTimer({ side, remain, seconds }) {
  const offset = TIMER_C * (1 - remain);
  return (
    <div
      className={'uno-turn-timer ' + side}
      title={`${seconds}s`}
      aria-label={`Turn timer ${seconds} seconds left`}
    >
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <circle className="track" cx="16" cy="16" r={TIMER_R} />
        <circle
          className="arc"
          cx="16" cy="16" r={TIMER_R}
          strokeDasharray={TIMER_C}
          strokeDashoffset={offset}
        />
      </svg>
    </div>
  );
}

export default function Uno({ myRole, names = {}, rt, code, onComplete }) {
  const role = myRole;
  const partner = role === 'A' ? 'B' : 'A';

  const [phase, setPhase] = useState('wait'); // wait | shuffle | play | done
  const [state, setState] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [picking, setPicking] = useState(null);
  const [flash, setFlash] = useState('');
  const [dealIn, setDealIn] = useState(false);
  const [turnLeft, setTurnLeft] = useState(TURN_SECONDS);

  const stateRef = useRef(null);
  const seedRef = useRef(null);
  const startedRef = useRef(false);
  const finishedRef = useRef(false);
  const autoFiredRef = useRef('');
  stateRef.current = state;

  const commit = useCallback((next) => {
    stateRef.current = next;
    setState(next);
    if (next.winner && !finishedRef.current) {
      finishedRef.current = true;
      setPhase('done');
      if (role === 'A') onComplete?.(next.winner);
    }
  }, [role, onComplete]);

  const begin = useCallback((seed) => {
    if (seed == null || startedRef.current) return;
    startedRef.current = true;
    const n = seed >>> 0;
    seedRef.current = n;
    if (code) seedByCode.set(code, n);
    finishedRef.current = false;
    const match = createMatch(n);
    commit(match);
    setSelectedId(null);
    setPicking(null);
    setPhase('shuffle');
    setDealIn(false);
    window.setTimeout(() => {
      setPhase('play');
      setDealIn(true);
      window.setTimeout(() => setDealIn(false), 700);
    }, 1100);
  }, [code, commit]);

  const run = useCallback((action, broadcast = true) => {
    const cur = stateRef.current;
    if (!cur) return false;
    const res = applyAction(cur, role, action);
    if (!res.ok) {
      setFlash(res.reason || 'Nope');
      setTimeout(() => setFlash(''), 1400);
      return false;
    }
    commit(res.state);
    setSelectedId(null);
    setPicking(null);
    if (broadcast) {
      const payload = { k: 'act', by: role, action };
      rt?.send(payload);
      setTimeout(() => rt?.send(payload), 180);
    }
    return true;
  }, [role, rt, commit]);

  const autoPlayTurn = useCallback(() => {
    const cur = stateRef.current;
    if (!cur || cur.winner || cur.turn !== role) return;

    const playOne = (card, fromState) => {
      const action = isWild(card)
        ? { type: 'play', cardId: card.id, color: pickAutoColor(fromState.hands[role], fromState.color) }
        : { type: 'play', cardId: card.id };
      return run(action);
    };

    if (cur.mustDraw) {
      const drawn = cur.hands[role][cur.hands[role].length - 1];
      const top = cur.discard[cur.discard.length - 1];
      if (drawn && canPlay(drawn, top, cur.color)) playOne(drawn, cur);
      else run({ type: 'pass' });
      return;
    }

    const top = cur.discard[cur.discard.length - 1];
    const playable = cur.hands[role].find(c => canPlay(c, top, cur.color));
    if (playable) {
      playOne(playable, cur);
      return;
    }

    // Draw, then finish the turn if the engine left us holding a playable card
    if (!run({ type: 'draw' })) return;
    const after = stateRef.current;
    if (!after || after.winner || after.turn !== role) return;
    if (after.mustDraw) {
      const drawn = after.hands[role][after.hands[role].length - 1];
      const top2 = after.discard[after.discard.length - 1];
      if (drawn && canPlay(drawn, top2, after.color)) playOne(drawn, after);
      else run({ type: 'pass' });
    }
  }, [role, run]);

  useEffect(() => {
    if (!rt?.on) return undefined;
    rt.on(m => {
      if (!m?.k) return;
      if (m.k === 'needstart') {
        if (role === 'A' && seedRef.current != null) {
          rt.send({ k: 'start', seed: seedRef.current });
        }
        return;
      }
      if (m.k === 'start') {
        begin(m.seed);
        return;
      }
      if (m.k === 'act') {
        if (m.by === role) return;
        const cur = stateRef.current;
        if (!cur || !m.action) return;
        const res = applyAction(cur, m.by, m.action);
        if (res.ok) commit(res.state);
      }
    });
  }, [rt, role, begin, commit]);

  useEffect(() => {
    if (role === 'A') {
      let seed = (code && seedByCode.get(code)) || seedRef.current;
      if (seed == null) {
        seed = ((Date.now() ^ (Math.random() * 0xFFFFFFFF)) >>> 0);
        if (code) seedByCode.set(code, seed);
      }
      seedRef.current = seed;
      const push = () => rt?.send({ k: 'start', seed });
      push();
      begin(seed);
      const t1 = setTimeout(push, 400);
      const t2 = setTimeout(push, 1200);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    const ask = () => { if (!startedRef.current) rt?.send({ k: 'needstart' }); };
    ask();
    const iv = setInterval(ask, 700);
    return () => clearInterval(iv);
  }, [role, rt, begin, code]);

  const turnClockKey = state
    ? `${state.turn}|${state.discard?.length || 0}|${state.mustDraw ? 1 : 0}|${state.turnCount || 1}|${state.winner || ''}`
    : '';

  useEffect(() => {
    if (!state || state.winner || phase !== 'play') {
      setTurnLeft(TURN_SECONDS);
      return undefined;
    }
    setTurnLeft(TURN_SECONDS);
    const startedAt = Date.now();
    const id = window.setInterval(() => {
      const left = Math.max(0, TURN_SECONDS - (Date.now() - startedAt) / 1000);
      setTurnLeft(left);
    }, 40);
    return () => clearInterval(id);
  }, [turnClockKey, phase]); // eslint-disable-line react-hooks/exhaustive-deps -- keyed by turnClockKey

  useEffect(() => {
    if (phase !== 'play' || !state || state.winner) return;
    if (state.turn !== role) return;
    if (turnLeft > 0.05) return;
    if (!turnClockKey || autoFiredRef.current === turnClockKey) return;
    autoFiredRef.current = turnClockKey;
    autoPlayTurn();
  }, [turnLeft, turnClockKey, phase, state, role, autoPlayTurn]);

  function onCardTap(card) {
    if (!state || state.winner || state.turn !== role) return;
    const top = state.discard[state.discard.length - 1];
    if (!canPlay(card, top, state.color)) {
      setFlash('Doesn’t match');
      setTimeout(() => setFlash(''), 1200);
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
        <div className="uno-status">Shuffling the deck…</div>
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

  const myHand = state.hands[role];
  const theirCount = state.hands[partner].length;
  const top = state.discard[state.discard.length - 1];
  const myTurn = state.turn === role && !state.winner;
  const armed = !!(state.unoArmed || {})[role];
  const showUnoBtn = myHand.length <= 2 && !state.winner;
  const partnerCatchable = theirCount === 1
    && !state.winner
    && (state.unoPending === partner || !(state.unoArmed || {})[partner]);
  const canDraw = myTurn && !state.mustDraw;
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
          seat={role}
          turn={state.turn}
          winner={state.winner}
          names={names}
          corner="corner-br"
        />
        {!state.winner && (
          <TurnTimer
            side={myTurn ? 'mine' : 'theirs'}
            remain={turnLeft / TURN_SECONDS}
            seconds={Math.ceil(turnLeft)}
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
                {state.winner === role ? 'You win!' : `${names[state.winner] || state.winner} wins!`}
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
              const playable = myTurn && canPlay(card, top, state.color)
                && (!state.mustDraw || card.id === myHand[myHand.length - 1].id);
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
            {state.winner === role ? 'You emptied your hand!' : `${names[state.winner] || state.winner} wins the table!`}
          </div>
        </div>
      )}

      {picking && (
        <ColorPicker onPick={confirmWild} onCancel={() => { setPicking(null); setSelectedId(null); }} />
      )}
    </div>
  );
}
