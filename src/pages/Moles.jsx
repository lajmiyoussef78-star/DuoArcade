// src/pages/Moles.jsx — Heart Duel play UI (moleduel engine).
// Shared host seed → same hearts/rings/bombs on both screens.

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  moleSchedule, matchDurationMs, settle, winnerOf, MOLE
} from '../lib/moles.js';
import '../styles/moles.css';

const LEAD_MS = 800;
const seedByCode = new Map();

function glyphFor(kind) {
  if (kind === 'bomb') return '\u{1F494}'; // broken heart
  if (kind === 'ring') return '\u{1F48D}'; // ring
  return '\u{2764}\u{FE0F}';             // heart
}

export default function Moles({ myRole, names = {}, rt, code, onComplete, pausedRef }) {
  const role = myRole;
  const [phase, setPhase] = useState('wait'); // wait | live | done
  const [live, setLive] = useState({ up: {}, myScore: 0, theirScore: 0, hit: {} });
  const [result, setResult] = useState(null);

  const seedRef = useRef(null);
  const schedRef = useRef([]);
  const startAtRef = useRef(0);
  const myWhacks = useRef({});
  const theirWhacks = useRef({});
  const timersRef = useRef([]);
  const startedRef = useRef(false);
  const endedRef = useRef(false);
  const finishedRef = useRef(false);
  const phaseRef = useRef('wait');
  phaseRef.current = phase;

  function clearTimers() {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }

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

  const begin = useCallback((seed) => {
    if (seed == null || startedRef.current) return;
    startedRef.current = true;
    const n = seed >>> 0;
    seedRef.current = n;
    if (code) seedByCode.set(code, n);
    schedRef.current = moleSchedule(n);
    // Local clock — avoids skewed wall-clock startAt between devices
    startAtRef.current = Date.now() + LEAD_MS;
    myWhacks.current = {};
    theirWhacks.current = {};
    endedRef.current = false;
    finishedRef.current = false;
    setResult(null);
    setLive({ up: {}, myScore: 0, theirScore: 0, hit: {} });
    setTimeout(() => runMatch(), LEAD_MS);
  }, [runMatch, code]);

  useEffect(() => {
    if (!rt?.on) return;
    rt.on(m => {
      if (!m || !m.k) return;
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
      if (m.k === 'whack') {
        if (theirWhacks.current[m.id] == null) theirWhacks.current[m.id] = m.ms;
        recomputeLiveScores();
        return;
      }
      if (m.k === 'done') maybeSettle();
    });
    return () => clearTimers();
  }, [rt, role, begin, recomputeLiveScores, maybeSettle]);

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
    const ask = () => {
      if (!startedRef.current) rt?.send({ k: 'needstart' });
    };
    ask();
    const iv = setInterval(ask, 700);
    return () => clearInterval(iv);
  }, [role, rt, begin, code]);

  function whack(mole) {
    if (pausedRef?.current) return;
    if (myWhacks.current[mole.id] != null) return;
    const reaction = Date.now() - (startAtRef.current + mole.up);
    if (reaction < 0) return;
    myWhacks.current[mole.id] = reaction;
    rt?.send({ k: 'whack', id: mole.id, ms: reaction });
    const hitKind = mole.kind === 'bomb' ? 'bomb' : mole.kind === 'ring' ? 'ring' : 'me';
    setLive(s => {
      const up = { ...s.up }; delete up[mole.id];
      return { ...s, up, hit: { ...s.hit, [mole.id]: hitKind } };
    });
    recomputeLiveScores();
  }

  if (phase === 'wait') {
    return (
      <div className="mo-page mo-embedded">
        <div className="mo-wait">Syncing hearts…</div>
      </div>
    );
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
              const kind = upMole?.kind || 'heart';
              return (
                <div className="mo-hole" key={hole}>
                  {upMole && (
                    <button
                      type="button"
                      className={'mo-mole mo-' + kind + (hitState ? ' bonked' : '')}
                      onPointerDown={e => { e.preventDefault(); whack(upMole); }}
                    >
                      {glyphFor(kind)}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {phase === 'live' && (
            <div className="mo-hint">
              {'\u{2764}\u{FE0F}'} +1 · {'\u{1F48D}'} +3 · {'\u{1F494}'} −2 · fastest claim wins
            </div>
          )}
        </div>
      )}

      {phase === 'done' && result && (
        <div className="mo-done">
          <div className="mo-winline">
            {result.w === 'draw'
              ? 'Dead heat — a draw!'
              : `${result.w === role ? 'You' : (result.w === 'A' ? names.A : names.B)} win${result.w === role ? '' : 's'}!`}
          </div>
          <div className="mo-final">
            {names.A} {result.a} {'\u2013'} {result.b} {names.B}
          </div>
        </div>
      )}
    </div>
  );
}
