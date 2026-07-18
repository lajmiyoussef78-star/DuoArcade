// src/pages/Uno.jsx — Classic UNO play UI (mounted by the uno engine).

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  COLORS, createMatch, applyAction, canPlay, isWild, cardLabel
} from '../lib/uno.js';
import '../styles/uno.css';

const seedByCode = new Map();

function UnoCard({ card, face = true, playable, selected, dim, onClick, title }) {
  if (!face || !card) {
    return (
      <button type="button" className="uno-card uno-back" onClick={onClick} title={title || 'Card'} disabled={!onClick}>
        <span className="uno-back-mark">UNO</span>
      </button>
    );
  }
  const wild = isWild(card);
  const cls = [
    'uno-card',
    wild ? 'wild' : `c-${card.color}`,
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
      title={title || cardLabel(card)}
    >
      <span className="uno-card-corner tl">{cardLabel(card)}</span>
      <span className="uno-card-center">{cardLabel(card)}</span>
      <span className="uno-card-corner br">{cardLabel(card)}</span>
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

export default function Uno({ myRole, names = {}, rt, code, onComplete }) {
  const role = myRole;
  const partner = role === 'A' ? 'B' : 'A';

  const [phase, setPhase] = useState('wait'); // wait | play | done
  const [state, setState] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [picking, setPicking] = useState(null); // card waiting for color
  const [flash, setFlash] = useState('');

  const stateRef = useRef(null);
  const seedRef = useRef(null);
  const startedRef = useRef(false);
  const finishedRef = useRef(false);
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
    setPhase('play');
    setSelectedId(null);
    setPicking(null);
  }, [code, commit]);

  const run = useCallback((action, broadcast = true) => {
    const cur = stateRef.current;
    if (!cur) return;
    const res = applyAction(cur, role, action);
    if (!res.ok) {
      setFlash(res.reason || 'Nope');
      setTimeout(() => setFlash(''), 1400);
      return;
    }
    commit(res.state);
    setSelectedId(null);
    if (broadcast) {
      const payload = { k: 'act', by: role, action };
      rt?.send(payload);
      setTimeout(() => rt?.send(payload), 180);
    }
  }, [role, rt, commit]);

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

  const myHand = state.hands[role];
  const theirCount = state.hands[partner].length;
  const top = state.discard[state.discard.length - 1];
  const myTurn = state.turn === role && !state.winner;
  const showUnoBtn = myHand.length <= 2 && !state.winner;
  const canCatch = state.unoPending && state.unoPending === partner;

  const sortedHand = [...myHand].sort((a, b) => {
    const ca = a.color || 'zz';
    const cb = b.color || 'zz';
    if (ca !== cb) return ca.localeCompare(cb);
    return String(a.value).localeCompare(String(b.value));
  });

  return (
    <div className="uno-page uno-embedded">
      <div className={`uno-table c-${state.color}`}>
        <div className="uno-rail top">
          <div className="uno-seat">
            <div className={'uno-name p' + partner}>{names[partner] || partner}</div>
            <div className="uno-count">{theirCount} card{theirCount === 1 ? '' : 's'}</div>
          </div>
          <div className="uno-opp-hand" aria-label="Partner hand">
            {Array.from({ length: Math.min(theirCount, 12) }, (_, i) => (
              <UnoCard key={i} face={false} />
            ))}
            {theirCount > 12 && <span className="uno-more">+{theirCount - 12}</span>}
          </div>
        </div>

        <div className="uno-center">
          <div className="uno-piles">
            <button
              type="button"
              className={'uno-drawpile' + (myTurn && !state.mustDraw ? ' go' : '')}
              onClick={() => myTurn && run({ type: 'draw' })}
              disabled={!myTurn || state.mustDraw}
              title="Draw"
            >
              <UnoCard face={false} />
              <span className="uno-pile-lbl">Draw · {state.pile.length}</span>
            </button>

            <div className="uno-discard">
              <UnoCard card={top} />
              <span className={`uno-colorchip c-${state.color}`}>{state.color}</span>
            </div>
          </div>

          <div className="uno-banner">
            {state.winner
              ? <b>{state.winner === role ? 'You win!' : `${names[state.winner] || state.winner} wins!`}</b>
              : myTurn
                ? (state.mustDraw ? <b>Play the drawn card or pass</b> : <b>Your turn</b>)
                : <span>{names[state.turn] || state.turn} is playing…</span>}
            {flash && <span className="uno-flash">{flash}</span>}
          </div>
          <div className="uno-log">{state.log}</div>
        </div>

        <div className="uno-rail bottom">
          <div className="uno-actions">
            {showUnoBtn && (
              <button type="button" className="uno-uno-btn" onClick={() => run({ type: 'uno' })}>
                UNO!
              </button>
            )}
            {canCatch && (
              <button type="button" className="uno-catch-btn" onClick={() => run({ type: 'catch', target: partner })}>
                Catch +2
              </button>
            )}
            {myTurn && state.mustDraw && (
              <button type="button" className="btn warm small" onClick={() => run({ type: 'pass' })}>
                Pass
              </button>
            )}
          </div>
          <div className="uno-seat self">
            <div className={'uno-name p' + role}>{names[role] || 'You'}</div>
            <div className="uno-count">{myHand.length} card{myHand.length === 1 ? '' : 's'}</div>
          </div>
          <div className="uno-hand" aria-label="Your hand">
            {sortedHand.map(card => {
              const playable = myTurn && canPlay(card, top, state.color)
                && (!state.mustDraw || card.id === myHand[myHand.length - 1].id);
              return (
                <UnoCard
                  key={card.id}
                  card={card}
                  playable={playable}
                  selected={selectedId === card.id}
                  dim={myTurn && !playable}
                  onClick={myTurn ? () => onCardTap(card) : undefined}
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
