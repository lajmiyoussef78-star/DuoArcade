// src/pages/MinusOne.jsx — RPS Minus One (mounted by the minusone engine).
//
// Squid Game RPS: throw both hands → reveal → secretly keep one → duel.
// First to WIN_SCORE. Synced over the shell RT channel.

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  GESTURES, GESTURE_IDS, duel, WIN_SCORE, KEEP_SECONDS, randomKeepIndex
} from '../lib/minusone.js';
import NeonRpsIcon from '../components/NeonRpsIcon.jsx';
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
  const minusSentRef = useRef(false);
  const minusActiveRef = useRef(false);
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
    minusSentRef.current = false;
    minusActiveRef.current = false;
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

  // Apply host-issued auto keeps. Each seat is rolled independently.
  const applyAutoKeeps = useCallback((picks) => {
    if (!picks || typeof picks !== 'object') return;
    let changed = false;
    const next = { ...keepsRef.current };
    for (const seat of ['A', 'B']) {
      if (next[seat] != null || picks[seat] == null) continue;
      next[seat] = picks[seat];
      changed = true;
      if (seat === meRef.current) {
        setMyKeep(picks[seat]);
        myKeepRef.current = picks[seat];
      }
    }
    if (!changed) return;
    keepsRef.current = next;
    setKeeps({ ...next });
    maybeDuel();
  }, [maybeDuel]);

  const startMinus = useCallback((endsAt) => {
    if (minusActiveRef.current) return;
    if (phaseRef.current !== 'throw' && phaseRef.current !== 'minus') return;
    minusActiveRef.current = true;
    setPhase('minus');
    clearInterval(cdIvRef.current);
    const tick = () => {
      const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setCountdown(left);
      if (left <= 0) {
        clearInterval(cdIvRef.current);
        // Host rolls a separate random keep for each player still undecided.
        if (meRef.current !== 'A') return;
        const picks = {};
        if (keepsRef.current.A == null) picks.A = randomKeepIndex();
        if (keepsRef.current.B == null) picks.B = randomKeepIndex();
        if (!Object.keys(picks).length) return;
        const payload = { k: 'autokeep', picks };
        rt?.send(payload);
        setTimeout(() => rt?.send(payload), 180);
        applyAutoKeeps(picks);
      }
    };
    tick();
    cdIvRef.current = setInterval(tick, 200);
  }, [rt, applyAutoKeeps]);

  const maybeReveal = useCallback(() => {
    if (phaseRef.current !== 'throw') return;
    const h = handsRef.current;
    if (!h.A || !h.B) return;
    // Host owns the shared timer so both see the same countdown.
    if (meRef.current !== 'A' || minusSentRef.current) return;
    minusSentRef.current = true;
    const endsAt = Date.now() + KEEP_SECONDS * 1000;
    const payload = { k: 'minus', endsAt };
    rt?.send(payload);
    setTimeout(() => rt?.send(payload), 180);
    startMinus(endsAt);
  }, [rt, startMinus]);

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
      if (m.k === 'minus') {
        if (!m.endsAt) return;
        startMinus(m.endsAt);
        return;
      }
      if (m.k === 'autokeep') {
        if (me === 'A') return; // host already applied locally
        applyAutoKeeps(m.picks);
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
  }, [rt, me, begin, maybeReveal, startMinus, applyAutoKeeps, maybeDuel, nextRound]);

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
              <div className="m1-brand">
                <span className="m1-brand-icons" aria-hidden="true">
                  <NeonRpsIcon id="rock" size={18} />
                  <NeonRpsIcon id="scissors" size={18} />
                  <NeonRpsIcon id="paper" size={18} />
                </span>
                Minus One
              </div>
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
              seat={opp}
              hands={hands[opp]}
              revealed={phase !== 'throw'}
              keptIdx={phase === 'duel' ? keeps[opp] : null}
              top
            />

            <div className="m1-felt">
              {phase === 'throw' && (
                <span>
                  {locked
                    ? <>waiting for <span className={opp === 'A' ? 'pA' : 'pB'}>{nm[opp]}</span>…</>
                    : 'pick both hands, choose wisely then lock'}
                </span>
              )}
              {phase === 'minus' && (
                <span className="m1-minus-line">
                  <span className="m1-count" title="Time left to keep a hand">
                    <b>{countdown}</b>
                  </span>
                  <span>
                    {myKeep == null
                      ? 'Tap the one you keep, the other hand vanishes.'
                      : <>kept — waiting for <span className={opp === 'A' ? 'pA' : 'pB'}>{nm[opp]}</span>…</>}
                  </span>
                </span>
              )}
              {phase === 'duel' && roundResult && (
                <span className={'m1-result' + (roundResult !== 'draw' ? (roundResult === 'A' ? ' pA' : ' pB') : '')}>
                  {roundResult === 'draw'
                    ? 'Draw'
                    : <><span className={roundResult === 'A' ? 'pA' : 'pB'}>{nm[roundResult]}</span> takes the point!</>}
                </span>
              )}
            </div>

            <HandRow
              label={`${nm[me]} (you)`}
              seat={me}
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
                          className={
                            'm1-gbtn m1-gbtn-' + g + (myHands[slot] === g ? ' on' : '')
                          }
                          aria-label={GESTURES[g].name}
                          title={GESTURES[g].name}
                          onClick={() => pickHand(slot, g)}
                        >
                          <NeonRpsIcon id={g} size={34} label />
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
                Lock
              </button>
            </div>
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
            <div className="m1-winline">
              <span className={winner === 'A' ? 'pA' : 'pB'}>{nm[winner]}</span> wins the duel!
            </div>
            <div className="m1-final">{score.A} {'\u2013'} {score.B}</div>
            <p className="m1-note">Use Rematch in the shell for another first-to-{WIN_SCORE}.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function HandRow({ label, seat, hands, revealed, mine, keptIdx, selectable, onKeep, top }) {
  return (
    <div className={'m1-row' + (top ? ' top' : '') + (selectable ? ' active' : '')}>
      <div className={'m1-row-label ' + (seat === 'A' ? 'pA' : 'pB')}>{label}</div>
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
                (seat === 'A' ? ' seatA' : ' seatB') +
                (g ? ' m1-hand-' + g : '') +
                (dropped ? ' dropped' : '') +
                (kept ? ' kept' : '') +
                (selectable ? ' selectable' : '') +
                (mine ? ' mine' : '')
              }
              disabled={!selectable}
              onClick={() => onKeep && onKeep(i)}
            >
              {revealed && g ? (
                <NeonRpsIcon id={g} size={56} />
              ) : (
                <span className="m1-hidden" aria-hidden="true">?</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
