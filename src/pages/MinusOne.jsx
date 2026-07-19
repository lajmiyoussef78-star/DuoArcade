// src/pages/MinusOne.jsx — RPS Minus One (mounted by the minusone engine).
//
// Squid Game RPS: throw both hands → reveal → secretly keep one → duel.
// First to WIN_SCORE. Synced over the shell RT channel.

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  GESTURES, GESTURE_IDS, duel, WIN_SCORE, KEEP_SECONDS
} from '../lib/minusone.js';
import '../styles/minusone.css';

export default function MinusOne({ myRole, names = {}, rt, code, onComplete }) {
  const me = myRole;
  const opp = me === 'A' ? 'B' : 'A';
  const nm = { A: names.A || 'A', B: names.B || 'B' };

  const [phase, setPhase] = useState('wait'); // wait | throw | minus | duel | over
  const [myHands, setMyHands] = useState([null, null]);
  const [locked, setLocked] = useState(false);
  const [theirLocked, setTheirLocked] = useState(false);
  const [hands, setHands] = useState({ A: null, B: null });
  const [myKeep, setMyKeep] = useState(null);
  const [keeps, setKeeps] = useState({ A: null, B: null });
  const [score, setScore] = useState({ A: 0, B: 0 });
  const [roundResult, setRoundResult] = useState(null);
  const [winner, setWinner] = useState(null);
  const [countdown, setCountdown] = useState(KEEP_SECONDS);

  const meRef = useRef(me);
  const handsRef = useRef({ A: null, B: null });
  const keepsRef = useRef({ A: null, B: null });
  const scoreRef = useRef({ A: 0, B: 0 });
  const myHandsRef = useRef([null, null]);
  const myKeepRef = useRef(null);
  const startedRef = useRef(false);
  const finishedRef = useRef(false);
  const duelDoneRef = useRef(false);
  const phaseRef = useRef('wait');
  const cdIvRef = useRef(null);
  meRef.current = me;
  phaseRef.current = phase;

  useEffect(() => { myHandsRef.current = myHands; }, [myHands]);
  useEffect(() => { myKeepRef.current = myKeep; }, [myKeep]);

  const resetRound = useCallback(() => {
    handsRef.current = { A: null, B: null };
    keepsRef.current = { A: null, B: null };
    duelDoneRef.current = false;
    setHands({ A: null, B: null });
    setKeeps({ A: null, B: null });
    setMyHands([null, null]);
    setMyKeep(null);
    setLocked(false);
    setTheirLocked(false);
    setRoundResult(null);
    setCountdown(KEEP_SECONDS);
    clearInterval(cdIvRef.current);
  }, []);

  const begin = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    finishedRef.current = false;
    scoreRef.current = { A: 0, B: 0 };
    setScore({ A: 0, B: 0 });
    setWinner(null);
    resetRound();
    setPhase('throw');
  }, [resetRound]);

  const maybeDuel = useCallback(() => {
    if (phaseRef.current !== 'minus' || duelDoneRef.current) return;
    const k = keepsRef.current;
    const h = handsRef.current;
    if (k.A == null || k.B == null || !h.A || !h.B) return;
    duelDoneRef.current = true;
    clearInterval(cdIvRef.current);
    const gA = h.A[k.A];
    const gB = h.B[k.B];
    const r = duel(gA, gB);
    setRoundResult(r);
    if (r !== 'draw') {
      scoreRef.current = { ...scoreRef.current, [r]: scoreRef.current[r] + 1 };
      setScore({ ...scoreRef.current });
    }
    setPhase('duel');
    if (r !== 'draw' && scoreRef.current[r] >= WIN_SCORE) {
      setWinner(r);
      setTimeout(() => setPhase('over'), 1600);
      if (!finishedRef.current) {
        finishedRef.current = true;
        if (meRef.current === 'A') onComplete?.(r);
      }
    }
  }, [onComplete]);

  const chooseKeep = useCallback((idx) => {
    if (keepsRef.current[meRef.current] != null) return;
    setMyKeep(idx);
    keepsRef.current = { ...keepsRef.current, [meRef.current]: idx };
    setKeeps({ ...keepsRef.current });
    const payload = { k: 'keep', by: meRef.current, idx };
    rt?.send(payload);
    setTimeout(() => rt?.send(payload), 180);
    maybeDuel();
  }, [rt, maybeDuel]);

  const maybeReveal = useCallback(() => {
    if (phaseRef.current !== 'throw') return;
    const h = handsRef.current;
    if (!h.A || !h.B) return;
    setPhase('minus');
    let left = KEEP_SECONDS;
    setCountdown(left);
    clearInterval(cdIvRef.current);
    cdIvRef.current = setInterval(() => {
      left -= 1;
      setCountdown(Math.max(0, left));
      if (left <= 0) {
        clearInterval(cdIvRef.current);
        if (myKeepRef.current == null && keepsRef.current[meRef.current] == null) {
          chooseKeep(0);
        }
      }
    }, 1000);
  }, [chooseKeep]);

  const nextRound = useCallback(() => {
    resetRound();
    setPhase('throw');
  }, [resetRound]);

  useEffect(() => {
    if (!rt?.on) return undefined;
    rt.on(m => {
      if (!m?.k) return;
      if (m.k === 'needstart') {
        if (me === 'A' && startedRef.current) {
          rt.send({ k: 'start' });
        }
        return;
      }
      if (m.k === 'start') {
        begin();
        return;
      }
      if (m.k === 'hands') {
        if (m.by === me || !m.hands) return;
        handsRef.current = { ...handsRef.current, [m.by]: m.hands };
        setHands({ ...handsRef.current });
        setTheirLocked(true);
        maybeReveal();
        return;
      }
      if (m.k === 'keep') {
        if (m.by === me || m.idx == null) return;
        keepsRef.current = { ...keepsRef.current, [m.by]: m.idx };
        setKeeps({ ...keepsRef.current });
        maybeDuel();
        return;
      }
      if (m.k === 'next') {
        if (m.by === me) return;
        nextRound();
      }
    });
    return () => clearInterval(cdIvRef.current);
  }, [rt, me, begin, maybeReveal, maybeDuel, nextRound]);

  useEffect(() => {
    if (me === 'A') {
      const push = () => rt?.send({ k: 'start' });
      begin();
      push();
      const t1 = setTimeout(push, 400);
      const t2 = setTimeout(push, 1200);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    const ask = () => { if (!startedRef.current) rt?.send({ k: 'needstart' }); };
    ask();
    const iv = setInterval(ask, 700);
    return () => clearInterval(iv);
  }, [me, rt, begin]);

  function pickHand(slot, g) {
    if (locked) return;
    setMyHands(h => {
      const n = [...h];
      n[slot] = g;
      return n;
    });
  }

  function lockHands() {
    const h = myHandsRef.current;
    if (!h[0] || !h[1] || locked) return;
    setLocked(true);
    handsRef.current = { ...handsRef.current, [me]: h };
    setHands({ ...handsRef.current });
    const payload = { k: 'hands', by: me, hands: h };
    rt?.send(payload);
    setTimeout(() => rt?.send(payload), 180);
    maybeReveal();
  }

  function pressNext() {
    nextRound();
    const payload = { k: 'next', by: me };
    rt?.send(payload);
    setTimeout(() => rt?.send(payload), 180);
  }

  if (!me || phase === 'wait') {
    return <div className="m1-shell"><p className="m1-status">Warming up the hands…</p></div>;
  }

  const inRound = phase === 'throw' || phase === 'minus' || phase === 'duel';

  return (
    <div className="m1-shell">
      {inRound && (
        <div className="m1-table">
          <div className="m1-board">
            <div className="m1-toolbar">
              <div className="m1-brand">{'\u270A\u270B\u270C\uFE0F'} Minus One</div>
              <div className="m1-bo5" title={`First to ${WIN_SCORE}`}>
                <div className="m1-pips">
                  {Array.from({ length: WIN_SCORE }).map((_, i) => (
                    <span key={'a' + i} className={'m1-pip A' + (score.A > i ? ' on' : '')} />
                  ))}
                </div>
                <span className="m1-mid">·</span>
                <div className="m1-pips">
                  {Array.from({ length: WIN_SCORE }).map((_, i) => (
                    <span key={'b' + i} className={'m1-pip B' + (score.B > i ? ' on' : '')} />
                  ))}
                </div>
              </div>
            </div>

            <HandRow
              label={nm[opp]}
              hands={hands[opp]}
              revealed={phase !== 'throw'}
              keptIdx={phase === 'duel' ? keeps[opp] : null}
              waiting={phase === 'throw' && !hands[opp]}
              top
            />

            <div className="m1-felt">
              {phase === 'throw' && (
                <span>{locked ? `waiting for ${nm[opp]}\u2026` : 'pick BOTH hands, then lock'}</span>
              )}
              {phase === 'minus' && (
                <span className="m1-count">minus one! <b>{countdown}</b></span>
              )}
              {phase === 'duel' && roundResult && (
                <span className={'m1-result' + (roundResult !== 'draw' ? (roundResult === 'A' ? ' pA' : ' pB') : '')}>
                  {roundResult === 'draw' ? 'Draw \u2014 again!' : `${nm[roundResult]} takes the point!`}
                </span>
              )}
            </div>

            <HandRow
              label={`${nm[me]} (you)`}
              hands={phase === 'throw' ? myHands : hands[me]}
              revealed
              mine
              keptIdx={phase === 'duel' ? keeps[me] : null}
              selectable={phase === 'minus' && myKeep == null}
              onKeep={idx => chooseKeep(idx)}
            />
          </div>

          {phase === 'throw' && !locked && (
            <div className="m1-dock">
              <div className="m1-pickzone">
                {[0, 1].map(slot => (
                  <div key={slot} className="m1-pickcol">
                    <div className="m1-pickhead">{slot === 0 ? 'Left hand' : 'Right hand'}</div>
                    <div className="m1-pickbtns">
                      {GESTURE_IDS.map(g => (
                        <button
                          key={g}
                          type="button"
                          className={'m1-gbtn' + (myHands[slot] === g ? ' on' : '')}
                          onClick={() => pickHand(slot, g)}
                        >
                          {GESTURES[g].emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="btn warm"
                disabled={!myHands[0] || !myHands[1]}
                onClick={lockHands}
              >
                Lock both hands
              </button>
            </div>
          )}

          {phase === 'minus' && myKeep == null && (
            <div className="m1-hint">tap the hand you KEEP — the other one vanishes</div>
          )}
          {phase === 'minus' && myKeep != null && (
            <div className="m1-hint">kept — waiting for {nm[opp]}…</div>
          )}
          {phase === 'duel' && !winner && (
            <div className="m1-dock">
              <button type="button" className="btn warm" onClick={pressNext}>Next round</button>
            </div>
          )}
        </div>
      )}

      {phase === 'over' && winner && (
        <div className="m1-table">
          <div className="m1-done">
            <div className="m1-winline">{nm[winner]} wins the duel!</div>
            <div className="m1-final">{score.A} {'\u2013'} {score.B}</div>
            <p className="m1-note">Use Rematch in the shell for another first-to-{WIN_SCORE}.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function HandRow({ label, hands, revealed, mine, keptIdx, selectable, onKeep, waiting, top }) {
  return (
    <div className={'m1-row' + (top ? ' top' : '') + (selectable ? ' active' : '')}>
      <div className="m1-row-label">{label}</div>
      <div className="m1-hands">
        {[0, 1].map(i => {
          const g = hands ? hands[i] : null;
          const dropped = keptIdx != null && keptIdx !== i;
          const kept = keptIdx === i;
          return (
            <button
              key={i}
              type="button"
              className={
                'm1-hand' +
                (dropped ? ' dropped' : '') +
                (kept ? ' kept' : '') +
                (selectable ? ' selectable' : '') +
                (mine ? ' mine' : '')
              }
              disabled={!selectable}
              onClick={() => onKeep && onKeep(i)}
            >
              {revealed && g ? GESTURES[g].emoji : (waiting ? '\u23F3' : '\u{1F91B}')}
            </button>
          );
        })}
      </div>
    </div>
  );
}
