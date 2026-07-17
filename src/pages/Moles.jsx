// src/pages/Moles.jsx — Mole Duel play UI (mounted by the moleduel engine).
// Same seeded moles on both screens; faster local reaction claims each mole.

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  moleSchedule, matchDurationMs, settle, winnerOf, MOLE
} from '../lib/moles.js';
import '../styles/moles.css';

export default function Moles({ myRole, names = {}, rt, onComplete, pausedRef }) {
  const role = myRole;
  // Shell already ran ready + 3s countdown — start moles as soon as we mount.
  const [phase, setPhase] = useState('live');
  const [live, setLive] = useState({ up: {}, myScore: 0, theirScore: 0, hit: {} });
  const [result, setResult] = useState(null);

  const seedRef = useRef(0);
  const schedRef = useRef([]);
  const startAtRef = useRef(0);
  const myWhacks = useRef({});
  const theirWhacks = useRef({});
  const timersRef = useRef([]);
  const startedRef = useRef(false);
  const endedRef = useRef(false);
  const finishedRef = useRef(false);
  const phaseRef = useRef('live');
  phaseRef.current = phase;

  function clearTimers() {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }

  useEffect(() => {
    if (!rt?.on) return;
    rt.on(m => {
      if (!m || !m.k) return;
      if (m.k === 'start') begin(m.seed, m.startAt);
      else if (m.k === 'whack') {
        if (theirWhacks.current[m.id] == null) theirWhacks.current[m.id] = m.ms;
        recomputeLiveScores();
      }
      else if (m.k === 'done') maybeSettle();
    });
    return () => clearTimers();
  }, [rt]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (role !== 'A') return;
    const seed = (Date.now() >>> 0) ^ 0x9e3779b9;
    const startAt = Date.now() + 200; // tiny lead-in so guest can join the channel
    rt?.send({ k: 'start', seed, startAt });
    begin(seed, startAt);
  }, [role, rt]); // eslint-disable-line react-hooks/exhaustive-deps

  const recomputeLiveScores = useCallback(() => {
    const sched = schedRef.current;
    const meIsA = role === 'A';
    const wa = meIsA ? myWhacks.current : theirWhacks.current;
    const wb = meIsA ? theirWhacks.current : myWhacks.current;
    const { scoreA, scoreB } = settle(sched, wa, wb);
    setLive(s => ({ ...s, myScore: meIsA ? scoreA : scoreB, theirScore: meIsA ? scoreB : scoreA }));
  }, [role]);

  const maybeSettle = useCallback(() => {
    if (phaseRef.current === 'done') return;
    setTimeout(() => {
      if (phaseRef.current === 'done') return;
      const sched = schedRef.current;
      const meIsA = role === 'A';
      const wa = meIsA ? myWhacks.current : theirWhacks.current;
      const wb = meIsA ? theirWhacks.current : myWhacks.current;
      const { scoreA, scoreB } = settle(sched, wa, wb);
      const w = winnerOf(scoreA, scoreB);
      setResult({ w, a: scoreA, b: scoreB });
      setPhase('done');
      clearTimers();
      if (role === 'A' && !finishedRef.current) {
        finishedRef.current = true;
        onComplete?.(w);
      }
    }, 350);
  }, [role, onComplete]);

  const runMatch = useCallback(() => {
    setPhase('live');
    const sched = schedRef.current;
    const t0 = startAtRef.current;
    clearTimers();

    for (const mole of sched) {
      timersRef.current.push(setTimeout(() => {
        if (pausedRef?.current) return;
        setLive(s => ({ ...s, up: { ...s.up, [mole.id]: mole } }));
      }, Math.max(0, t0 + mole.up - Date.now())));
      timersRef.current.push(setTimeout(() => {
        setLive(s => { const up = { ...s.up }; delete up[mole.id]; return { ...s, up }; });
      }, Math.max(0, t0 + mole.downAt - Date.now())));
    }

    timersRef.current.push(setTimeout(() => {
      endedRef.current = true;
      rt?.send({ k: 'done' });
      maybeSettle();
    }, Math.max(0, t0 + matchDurationMs(sched) - Date.now())));
  }, [rt, pausedRef, maybeSettle]);

  const begin = useCallback((seed, startAt) => {
    if (startedRef.current) return;
    startedRef.current = true;
    seedRef.current = seed;
    schedRef.current = moleSchedule(seed);
    startAtRef.current = startAt;
    myWhacks.current = {};
    theirWhacks.current = {};
    endedRef.current = false;
    finishedRef.current = false;
    setResult(null);
    setLive({ up: {}, myScore: 0, theirScore: 0, hit: {} });
    const delay = Math.max(0, startAt - Date.now());
    setTimeout(() => runMatch(), delay);
  }, [runMatch]);

  function whack(mole) {
    if (pausedRef?.current) return;
    if (myWhacks.current[mole.id] != null) return;
    const reaction = Date.now() - (startAtRef.current + mole.up);
    if (reaction < 0) return;
    myWhacks.current[mole.id] = reaction;
    rt?.send({ k: 'whack', id: mole.id, ms: reaction });
    setLive(s => {
      const up = { ...s.up }; delete up[mole.id];
      return { ...s, up, hit: { ...s.hit, [mole.id]: mole.gold ? 'gold' : 'me' } };
    });
    recomputeLiveScores();
  }

  return (
    <div className="mo-page mo-embedded">
      {(phase === 'live' || phase === 'done') && (
        <div className="mo-arena">
          <div className="mo-scorebar">
            <span className="pA">{live.myScore}</span>
            <span className="mo-scorelbl">you</span>
            <span className="mo-scoremid">vs</span>
            <span className="mo-scorelbl">{names[role === 'A' ? 'B' : 'A']}</span>
            <span className="pB">{live.theirScore}</span>
          </div>

          <div className="mo-grid">
            {Array.from({ length: MOLE.HOLES }).map((_, hole) => {
              const upMole = Object.values(live.up).find(m => m.hole === hole);
              const hitState = upMole ? live.hit[upMole.id] : null;
              return (
                <div className="mo-hole" key={hole}>
                  {upMole && (
                    <button
                      className={'mo-mole' + (upMole.gold ? ' gold' : '') + (hitState ? ' bonked' : '')}
                      onPointerDown={e => { e.preventDefault(); whack(upMole); }}
                    >
                      {upMole.gold ? '\u{1F31F}' : '\u{1F42D}'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {phase === 'live' && (
            <div className="mo-hint">tap the moles · {'\u{1F31F}'} gold = 3 · fastest hand claims each</div>
          )}
        </div>
      )}

      {phase === 'done' && result && (
        <div className="mo-done">
          <div className="mo-winline">
            {result.w === 'draw' ? 'Dead heat — a draw!' : `${result.w === 'A' ? names.A : names.B} wins!`}
          </div>
          <div className="mo-final">
            {names.A} {result.a} {'\u2013'} {result.b} {names.B}
          </div>
        </div>
      )}
    </div>
  );
}
