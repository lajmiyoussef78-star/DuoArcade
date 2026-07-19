// src/pages/Chkobba.jsx — Chkobba (mounted by the chkobba engine).
//
// Full court table layout (same design language as Veilcourt): opponent
// zone, center stage with felt + deck, your zone, action dock.
// Lockstep moves over the shell RT channel.

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  initialState, applyMove, legalCaptures, faceOf, faceName, SUITS, TARGET
} from '../lib/chkobba.js';
import '../styles/chkobba.css';

const seedByCode = new Map();

export default function Chkobba({ myRole, names = {}, rt, code, onComplete }) {
  const me = myRole;
  const opp = me === 'A' ? 'B' : 'A';
  const nm = { A: names.A || 'A', B: names.B || 'B' };

  const [st, setSt] = useState(null);
  const [selHand, setSelHand] = useState(null);
  const [selTable, setSelTable] = useState([]);

  const stRef = useRef(null);
  const meRef = useRef(me);
  const seedRef = useRef(null);
  const startedRef = useRef(false);
  const finishedRef = useRef(false);
  meRef.current = me;

  const commit = useCallback((next) => {
    stRef.current = next;
    setSt(next);
    setSelHand(null);
    setSelTable([]);
    if (next.phase === 'over' && next.winner && !finishedRef.current) {
      finishedRef.current = true;
      if (meRef.current === 'A') onComplete?.(next.winner);
    }
  }, [onComplete]);

  const begin = useCallback((seed) => {
    if (seed == null || startedRef.current) return;
    startedRef.current = true;
    const n = seed >>> 0;
    seedRef.current = n;
    if (code) seedByCode.set(code, n);
    finishedRef.current = false;
    commit(initialState(n));
  }, [code, commit]);

  const dispatch = useCallback((move, broadcast = true) => {
    const cur = stRef.current;
    if (!cur) return;
    const next = applyMove(cur, move, meRef.current);
    if (next.error) { setSt({ ...next }); return; }
    commit(next);
    if (broadcast) {
      const payload = { k: 'move', move, by: meRef.current };
      rt?.send(payload);
      setTimeout(() => rt?.send(payload), 180);
    }
  }, [rt, commit]);

  useEffect(() => {
    if (!rt?.on) return undefined;
    rt.on(m => {
      if (!m?.k) return;
      if (m.k === 'needstart') {
        if (me === 'A' && seedRef.current != null) {
          rt.send({ k: 'start', seed: seedRef.current });
        }
        return;
      }
      if (m.k === 'start') {
        begin(m.seed);
        return;
      }
      if (m.k === 'move') {
        if (m.by === me || !stRef.current || !m.move) return;
        const next = applyMove(stRef.current, m.move, m.by);
        if (!next.error) commit(next);
      }
    });
  }, [rt, me, begin, commit]);

  useEffect(() => {
    if (me === 'A') {
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
  }, [me, rt, begin, code]);

  function tapHand(i) {
    if (!st || st.phase !== 'play' || st.turn !== me) return;
    setSelHand(h => (h === i ? null : i));
    setSelTable([]);
  }
  function tapTable(i) {
    if (selHand == null) return;
    setSelTable(sel => sel.includes(i) ? sel.filter(x => x !== i) : [...sel, i]);
  }
  function confirmPlay() {
    if (selHand == null) return;
    dispatch({ t: 'play', idx: selHand, take: selTable });
  }

  if (!st) {
    return <div className="ck-shell"><p className="ck-status">Chkobba is dealing…</p></div>;
  }

  const myTurn = st.phase === 'play' && st.turn === me;
  const selCard = selHand != null ? st.hands[me][selHand] : null;
  const legal = selCard ? legalCaptures(selCard.v, st.table) : [];
  const selValid = selCard && (
    (selTable.length === 0 && legal.length === 0) ||
    legal.some(o => o.length === selTable.length && o.every(x => selTable.includes(x)))
  );
  const showDock = myTurn && selHand != null;
  const lastLine = st.log?.[st.log.length - 1] || '';

  return (
    <div className="ck-shell">
      <div className="ck-table">
        <div className="ck-board">
          <div className="ck-toolbar">
            <div className="ck-brand">Chkobba</div>
            <div className="ck-scorepill" title={`First to ${TARGET} with a 2-point lead`}>
              <span className="pA">{st.totals.A}</span>
              <span className="ck-scoresep">–</span>
              <span className="pB">{st.totals.B}</span>
            </div>
          </div>

          <PlayerZone
            st={st} p={opp} me={me} names={nm} top
          />

          <div className="ck-stage">
            <div className="ck-deck" aria-hidden={st.phase === 'cut'}>
              <div className="ck-deckstack">
                <div className="ck-deck-layer"><CardBack /></div>
                <div className="ck-deck-layer"><CardBack /></div>
                <div className="ck-deck-layer"><CardBack /></div>
              </div>
              <div className="ck-deckcount">{st.deck.length}</div>
            </div>

            <div className={'ck-center' + (myTurn ? ' my-turn' : '')}>
              {st.phase === 'cut' && (
                st.cutter === me ? (
                  <div className="ck-cutpanel">
                    <p className="ck-event">You cut — keep or leave this card</p>
                    <Card c={st.cutCard} />
                    <p className="ck-cut-note">Keep it and you&apos;ll be dealt only 2 more.</p>
                  </div>
                ) : (
                  <p className="ck-wait-chip">{nm[opp]} is cutting the deck…</p>
                )
              )}

              {st.phase !== 'cut' && st.phase !== 'roundEnd' && st.phase !== 'over' && (
                <>
                  <div className="ck-felt">
                    {st.table.length === 0 && <div className="ck-table-empty">table is clear</div>}
                    {st.table.map((c, i) => (
                      <Card
                        key={`${c.s}-${c.v}-${i}`}
                        c={c}
                        selectable={selHand != null}
                        selected={selTable.includes(i)}
                        onClick={() => tapTable(i)}
                      />
                    ))}
                  </div>
                  {lastLine ? <p className="ck-event">{lastLine}</p> : null}
                  {!myTurn && (
                    <p className="ck-wait-chip">{nm[opp]}&apos;s turn</p>
                  )}
                  {myTurn && selHand == null && (
                    <p className="ck-turn-chip">Your turn — tap a card below</p>
                  )}
                </>
              )}

              {st.phase === 'roundEnd' && st.lastRound && (
                <RoundScore sc={st.lastRound} names={nm} totals={st.totals} />
              )}
              {st.phase === 'over' && (
                <div className="ck-over">
                  {st.lastRound && <RoundScore sc={st.lastRound} names={nm} totals={st.totals} final />}
                  <div className="ck-winline">{nm[st.winner]} wins {st.totals.A}–{st.totals.B}!</div>
                </div>
              )}
            </div>
          </div>

          <PlayerZone
            st={st} p={me} me={me} names={nm}
            selHand={selHand}
            myTurn={myTurn}
            onTapHand={tapHand}
          />

          {st.error && <div className="ck-err">{st.error}</div>}
        </div>

        {st.phase === 'cut' && st.cutter === me && (
          <div className="ck-dock">
            <div className="ck-dock-title">The cut</div>
            <div className="ck-btnrow">
              <button type="button" className="btn warm" onClick={() => dispatch({ t: 'cutKeep' })}>Keep it</button>
              <button type="button" className="btn ghost" onClick={() => dispatch({ t: 'cutPass' })}>Leave it</button>
            </div>
          </div>
        )}

        {showDock && (
          <div className="ck-dock">
            <div className="ck-dock-title">
              {legal.length === 0 ? 'Lay on the table' : 'Capture'}
            </div>
            {legal.length === 0 ? (
              <button type="button" className="btn warm" onClick={confirmPlay}>Lay it on the table</button>
            ) : (
              <div className="ck-capturebar">
                <p className="ck-hint">
                  {selTable.length === 0
                    ? 'Tap table cards that sum to your card'
                    : selValid ? 'Valid capture' : 'That selection doesn\u2019t add up'}
                </p>
                <button
                  type="button"
                  className="btn warm"
                  disabled={!selValid || selTable.length === 0}
                  onClick={confirmPlay}
                >
                  Capture {selTable.length ? `(${selTable.length})` : ''}
                </button>
              </div>
            )}
          </div>
        )}

        {st.phase === 'roundEnd' && (
          <div className="ck-dock">
            <div className="ck-dock-title">Round complete</div>
            <button type="button" className="btn warm" onClick={() => dispatch({ t: 'nextRound' })}>
              Next round
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PlayerZone({ st, p, me, names, top, selHand, myTurn, onTapHand }) {
  const mine = p === me;
  const active = st.phase === 'play' && st.turn === p;
  const cutting = st.phase === 'cut' && st.cutter === p;

  return (
    <div className={'ck-zone' + (active || cutting ? ' active' : '') + (top ? ' top' : '')}>
      <div className="ck-zone-head">
        <span className={'ck-zone-name ' + (p === 'A' ? 'pA' : 'pB')}>
          {names[p]}{mine ? ' (you)' : ''}
          {st.dealer === p ? ' · dealer' : ''}
          {st.cutter === p && st.phase === 'cut' ? ' · cutter' : ''}
        </span>
      </div>
      <div className="ck-zone-row">
        <div className="ck-cards">
          {mine && st.phase === 'play' ? (
            st.hands[p].map((c, i) => (
              <Card
                key={`${c.s}-${c.v}-${i}`}
                c={c}
                selectable={!!myTurn}
                selected={selHand === i}
                lifted={selHand === i}
                onClick={() => onTapHand?.(i)}
              />
            ))
          ) : (
            st.hands[p].map((_, i) => (
              <div key={i} className="ck-card back">
                <CardBack />
              </div>
            ))
          )}
          {st.hands[p].length === 0 && (
            <span className="ck-hand-empty">{mine ? 'no cards' : 'empty hand'}</span>
          )}
        </div>
        <CapturePile caps={st.caps[p]} />
      </div>
    </div>
  );
}

/** Face-down capture stack; Chkobba sweep cards stay face-up. */
function CapturePile({ caps }) {
  if (!caps?.length) return null;
  const faceDown = caps.filter(c => !c.chkobba);
  const faceUp = caps.filter(c => c.chkobba);
  const stackCount = faceDown.length;
  const showLayers = Math.min(stackCount, 5);

  return (
    <div className="ck-cap-pile" title={`${caps.length} captured`}>
      <div className="ck-cap-stack" style={{ '--n': showLayers }}>
        {stackCount > 0 && Array.from({ length: showLayers }).map((_, i) => (
          <div
            key={`d-${i}`}
            className="ck-card back ck-cap-layer"
            style={{ '--i': i }}
            aria-hidden={i < showLayers - 1}
          >
            <CardBack />
          </div>
        ))}
        {stackCount > 5 && (
          <span className="ck-cap-count">+{stackCount - 5}</span>
        )}
      </div>
      {faceUp.length > 0 && (
        <div className="ck-cap-faceups">
          {faceUp.map((c, i) => (
            <div key={`u-${c.s}-${c.v}-${i}`} className="ck-cap-faceup">
              <Card c={c} />
              <span className="ck-cap-chk-tag">Chkobba</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CardBack() {
  return (
    <div className="ck-card-backface">
      <span className="ck-card-back-mesh" aria-hidden="true" />
      <span className="ck-card-back-diamonds" aria-hidden="true" />
      <span className="ck-card-back-frame" aria-hidden="true">
        <i className="ck-orn tl" />
        <i className="ck-orn tr" />
        <i className="ck-orn bl" />
        <i className="ck-orn br" />
      </span>
      <span className="ck-card-back-ring outer" aria-hidden="true" />
      <span className="ck-card-back-ring inner" aria-hidden="true" />
      <span className="ck-card-back-rosette" aria-hidden="true">
        <span className="ck-card-back-petals">
          <i>♥</i><i>♦</i><i>♣</i><i>♠</i>
        </span>
        <span className="ck-card-back-core">
          <span className="ck-card-back-core-ring" />
          <span className="ck-card-back-mark">C</span>
        </span>
      </span>
      <span className="ck-card-back-banner">
        <span className="ck-card-back-label">Chkobba</span>
      </span>
    </div>
  );
}

function Card({ c, selectable, selected, lifted, onClick }) {
  if (!c) return null;
  const suit = SUITS[c.s];
  const court = c.v >= 8;
  const courtGlyph = c.v === 8 ? 'Q' : c.v === 9 ? 'L' : 'K';
  return (
    <button
      type="button"
      className={
        'ck-card face suit-' + c.s +
        (selectable ? ' selectable' : '') +
        (selected ? ' selected' : '') +
        (lifted ? ' lifted' : '')
      }
      onClick={onClick}
      disabled={!selectable}
    >
      <span className="ck-card-corner">{faceOf(c.v)}<em>{suit.symbol}</em></span>
      <span className="ck-card-mid">
        {court ? (
          <span className="ck-card-court">{courtGlyph}</span>
        ) : (
          <span className={'ck-card-pips n' + c.v}>
            {Array.from({ length: c.v }).map((_, i) => <i key={i}>{suit.symbol}</i>)}
          </span>
        )}
      </span>
      <span className="ck-card-name">{court ? faceName(c.v) : '\u00a0'}</span>
    </button>
  );
}

function RoundScore({ sc, names, totals, final }) {
  return (
    <div className="ck-score">
      <div className="ck-score-title">{final ? 'Final round' : 'Round scored'}</div>
      <div className="ck-score-cols">
        {['A', 'B'].map(p => (
          <div key={p} className="ck-score-col">
            <div className={'ck-score-name ' + (p === 'A' ? 'pA' : 'pB')}>{names[p]} +{sc[p].total}</div>
            {sc[p].items.length
              ? sc[p].items.map(it => <div key={it} className="ck-score-item">{it}</div>)
              : <div className="ck-score-item none">—</div>}
          </div>
        ))}
      </div>
      {sc.beji.length > 0 && <div className="ck-beji">Beji (tied): {sc.beji.join(', ')}</div>}
      <div className="ck-score-totals">{names.A} {totals.A} – {totals.B} {names.B}</div>
    </div>
  );
}
