// src/pages/Chkobba.jsx — Chkobba (mounted by the chkobba engine).
//
// Lockstep like UNO: every move is broadcast and both clients apply the
// identical pure reducer. Opponent cards render face-down.
//
// Flow: cut → play → auto deals → round scores → next until 21+ with a 2 lead.

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
    return <div className="ck-shell"><p className="ck-status">Shuffling the Tunisian deck…</p></div>;
  }

  const myTurn = st.phase === 'play' && st.turn === me;
  const selCard = selHand != null ? st.hands[me][selHand] : null;
  const legal = selCard ? legalCaptures(selCard.v, st.table) : [];
  const selValid = selCard && (
    (selTable.length === 0 && legal.length === 0) ||
    legal.some(o => o.length === selTable.length && o.every(x => selTable.includes(x)))
  );

  return (
    <div className="ck-shell">
      <div className="ck-brand">{'\u{1F0CF}'} Chkobba</div>

      <div className="ck-totals">
        <span className="pA">{nm.A} <b>{st.totals.A}</b></span>
        <span className="ck-target">first to {TARGET} (+2)</span>
        <span className="pB"><b>{st.totals.B}</b> {nm.B}</span>
      </div>

      <div className="ck-oppstrip">
        <span className={'ck-pname ' + (opp === 'A' ? 'pA' : 'pB')}>
          {nm[opp]}{st.dealer === opp ? ' \u00b7 dealer' : ''}{st.turn === opp && st.phase === 'play' ? ' \u{1F0CF}' : ''}
        </span>
        <div className="ck-oppcards">
          {st.hands[opp].map((_, i) => <div key={i} className="ck-card back small" />)}
        </div>
        <span className="ck-capcount">{st.caps[opp].length} captured{st.chk[opp] ? ` \u00b7 ${st.chk[opp]} chkobba` : ''}</span>
      </div>

      {st.phase === 'cut' && (
        st.cutter === me ? (
          <div className="ck-cutpanel">
            <div className="ck-cut-title">You cut the deck — the cut card is:</div>
            <Card c={st.cutCard} />
            <div className="ck-cut-note">Keep it and you'll be dealt only 2 more. Or leave it in the deck.</div>
            <div className="ck-btnrow">
              <button type="button" className="btn warm" onClick={() => dispatch({ t: 'cutKeep' })}>Keep it</button>
              <button type="button" className="btn ghost" onClick={() => dispatch({ t: 'cutPass' })}>Leave it</button>
            </div>
          </div>
        ) : (
          <div className="ck-wait">{nm[opp]} is cutting the deck…</div>
        )
      )}

      {st.phase !== 'cut' && (
        <div className="ck-tablezone">
          <div className="ck-deckinfo">{'\u{1F0A0}'} {st.deck.length}</div>
          <div className="ck-table">
            {st.table.length === 0 && <div className="ck-table-empty">table is clear</div>}
            {st.table.map((c, i) => (
              <Card key={i} c={c}
                selectable={selHand != null}
                selected={selTable.includes(i)}
                onClick={() => tapTable(i)} />
            ))}
          </div>
        </div>
      )}

      {st.phase === 'roundEnd' && st.lastRound && (
        <RoundScore sc={st.lastRound} names={nm} onNext={() => dispatch({ t: 'nextRound' })} totals={st.totals} />
      )}
      {st.phase === 'over' && (
        <div className="ck-over">
          {st.lastRound && <RoundScore sc={st.lastRound} names={nm} totals={st.totals} final />}
          <div className="ck-winline">{nm[st.winner]} wins {st.totals.A}–{st.totals.B}!</div>
        </div>
      )}

      {st.phase === 'play' && (
        <div className="ck-myzone">
          <div className="ck-myhead">
            <span className={'ck-pname ' + (me === 'A' ? 'pA' : 'pB')}>
              {nm[me]} (you){st.dealer === me ? ' \u00b7 dealer' : ''}
            </span>
            <span className="ck-capcount">{st.caps[me].length} captured{st.chk[me] ? ` \u00b7 ${st.chk[me]} chkobba` : ''}</span>
          </div>
          <div className="ck-hand">
            {st.hands[me].map((c, i) => (
              <Card key={i} c={c}
                selectable={myTurn}
                selected={selHand === i}
                lifted={selHand === i}
                onClick={() => tapHand(i)} />
            ))}
          </div>

          {myTurn ? (
            selHand == null ? (
              <div className="ck-hint">your turn — tap a card</div>
            ) : legal.length === 0 ? (
              <button type="button" className="btn warm" onClick={confirmPlay}>Lay it on the table</button>
            ) : (
              <div className="ck-capturebar">
                <div className="ck-hint">
                  {selTable.length === 0
                    ? 'this card CAN capture \u2014 tap the table cards to take'
                    : selValid ? 'valid capture!' : 'that selection doesn\u2019t add up'}
                </div>
                <button type="button" className="btn warm" disabled={!selValid || selTable.length === 0} onClick={confirmPlay}>
                  Capture {selTable.length ? `(${selTable.length})` : ''}
                </button>
              </div>
            )
          ) : (
            <div className="ck-hint">{nm[opp]}'s turn…</div>
          )}
          {st.error && <div className="ck-err">{st.error}</div>}
        </div>
      )}
    </div>
  );
}

function Card({ c, selectable, selected, lifted, onClick, small }) {
  if (!c) return null;
  const suit = SUITS[c.s];
  const court = c.v >= 8;
  const courtEmoji = c.v === 8 ? '\u{1F451}' : c.v === 9 ? '\u{1F396}\uFE0F' : '\u265A';
  return (
    <button
      type="button"
      className={
        'ck-card face suit-' + c.s +
        (selectable ? ' selectable' : '') +
        (selected ? ' selected' : '') +
        (lifted ? ' lifted' : '') +
        (small ? ' small' : '')
      }
      onClick={onClick}
      disabled={!selectable}
    >
      <span className="ck-card-corner">{faceOf(c.v)}<em>{suit.symbol}</em></span>
      <span className="ck-card-mid">
        {court ? (
          <span className="ck-card-court">{courtEmoji}</span>
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

function RoundScore({ sc, names, onNext, totals, final }) {
  return (
    <div className="ck-score">
      <div className="ck-score-title">{final ? 'Final round' : 'Round complete'}</div>
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
      {onNext && <button type="button" className="btn warm" onClick={onNext}>Next round</button>}
    </div>
  );
}
