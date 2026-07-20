// src/pages/ThinIce.jsx — Thin Ice (mounted by the thinice engine).
//
// Isolation on a melting lake. Lockstep moves over shell RT.
// First to WIN_ROUNDS round wins takes the match.

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  initialRound, legalMoves, applyRoundMove, N, WIN_ROUNDS
} from '../lib/thinice.js';
import '../styles/thinice.css';

export default function ThinIce({ myRole, names = {}, rt, code, onComplete }) {
  const me = myRole;
  const opp = me === 'A' ? 'B' : 'A';
  const nm = { A: names.A || 'A', B: names.B || 'B' };

  const [phase, setPhase] = useState('wait'); // wait | play | roundOver | over
  const [round, setRound] = useState(null);
  const [roundNo, setRoundNo] = useState(0);
  const [wins, setWins] = useState({ A: 0, B: 0 });
  const [winner, setWinner] = useState(null);
  const [lastBroken, setLastBroken] = useState(null);

  const meRef = useRef(me);
  const roundRef = useRef(null);
  const roundNoRef = useRef(0);
  const winsRef = useRef({ A: 0, B: 0 });
  const startedRef = useRef(false);
  const finishedRef = useRef(false);
  const phaseRef = useRef('wait');
  meRef.current = me;
  phaseRef.current = phase;

  const begin = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    finishedRef.current = false;
    winsRef.current = { A: 0, B: 0 };
    setWins({ A: 0, B: 0 });
    setWinner(null);
    roundNoRef.current = 0;
    setRoundNo(0);
    const r0 = initialRound('A');
    roundRef.current = r0;
    setRound(r0);
    setLastBroken(null);
    setPhase('play');
  }, []);

  const doMove = useCallback((to, by) => {
    const prev = roundRef.current;
    if (!prev) return;
    const from = prev.pos[by];
    const next = applyRoundMove(prev, by, to);
    if (next.error) return;
    roundRef.current = next;
    setRound(next);
    setLastBroken(from);
    if (next.loser) {
      const w = next.loser === 'A' ? 'B' : 'A';
      winsRef.current = { ...winsRef.current, [w]: winsRef.current[w] + 1 };
      setWins({ ...winsRef.current });
      if (winsRef.current[w] >= WIN_ROUNDS) {
        setWinner(w);
        setPhase('over');
        if (!finishedRef.current) {
          finishedRef.current = true;
          if (meRef.current === 'A') onComplete?.(w);
        }
      } else {
        setPhase('roundOver');
      }
    }
  }, [onComplete]);

  const nextRound = useCallback(() => {
    if (phaseRef.current !== 'roundOver') return;
    roundNoRef.current += 1;
    setRoundNo(roundNoRef.current);
    const starter = roundNoRef.current % 2 === 0 ? 'A' : 'B';
    const r0 = initialRound(starter);
    roundRef.current = r0;
    setRound(r0);
    setLastBroken(null);
    setPhase('play');
  }, []);

  useEffect(() => {
    if (!rt?.on) return undefined;
    rt.on(m => {
      if (!m?.k) return;
      if (m.k === 'needstart') {
        if (me === 'A' && startedRef.current) rt.send({ k: 'start' });
        return;
      }
      if (m.k === 'start') {
        begin();
        return;
      }
      if (m.k === 'move') {
        if (m.by === me || !m.to) return;
        doMove(m.to, m.by);
        return;
      }
      if (m.k === 'next') {
        if (m.by === me) return;
        nextRound();
      }
    });
    return undefined;
  }, [rt, me, begin, doMove, nextRound]);

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

  function tapTile(r, c) {
    const rd = roundRef.current;
    if (!rd || phaseRef.current !== 'play' || rd.turn !== meRef.current || rd.loser) return;
    const legal = legalMoves(rd, meRef.current);
    if (!legal.some(([lr, lc]) => lr === r && lc === c)) return;
    const to = [r, c];
    doMove(to, meRef.current);
    const payload = { k: 'move', to, by: meRef.current };
    rt?.send(payload);
    setTimeout(() => rt?.send(payload), 180);
  }

  function pressNext() {
    nextRound();
    const payload = { k: 'next', by: me };
    rt?.send(payload);
    setTimeout(() => rt?.send(payload), 180);
  }

  if (!me || phase === 'wait' || !round) {
    return <div className="ti-shell"><p className="ti-status">The lake is freezing…</p></div>;
  }

  const myTurn = phase === 'play' && round.turn === me;
  const legal = myTurn ? legalMoves(round, me) : [];
  const isLegal = (r, c) => legal.some(([lr, lc]) => lr === r && lc === c);

  return (
    <div className="ti-shell">
      <div className="ti-table">
        <div className="ti-game">
          <div className="ti-toolbar">
            <div className="ti-brand">Thin Ice</div>
            <div className="ti-scorebar">
              <span className="ti-pname pA">{nm.A}</span>
              <div className="ti-pips">
                {Array.from({ length: WIN_ROUNDS }).map((_, i) => (
                  <span key={'a' + i} className={'ti-pip A' + (wins.A > i ? ' on' : '')} />
                ))}
                <span className="ti-roundno">round {roundNo + 1}</span>
                {Array.from({ length: WIN_ROUNDS }).map((_, i) => (
                  <span key={'b' + i} className={'ti-pip B' + (wins.B > i ? ' on' : '')} />
                ))}
              </div>
              <span className="ti-pname pB">{nm.B}</span>
            </div>
          </div>

          <div className="ti-statusline">
            {phase === 'play' && (myTurn
              ? <span className="ti-yourturn">your move</span>
              : <span><span className={opp === 'A' ? 'pA' : 'pB'}>{nm[opp]}</span> is thinking</span>)}
            {phase === 'roundOver' && round.loser && (
              <span className="ti-roundmsg">
                <span className={round.loser === 'A' ? 'pA' : 'pB'}>{nm[round.loser]}</span>
                {' '}fell through —{' '}
                <span className={round.loser === 'A' ? 'pB' : 'pA'}>
                  {nm[round.loser === 'A' ? 'B' : 'A']}
                </span>
                {' '}takes the round
              </span>
            )}
            {phase === 'over' && winner && (
              <span className="ti-roundmsg">
                <span className={winner === 'A' ? 'pA' : 'pB'}>{nm[winner]}</span> rules the lake
              </span>
            )}
          </div>

          <div className="ti-lake">
            <div className="ti-board" style={{ '--n': N }}>
              {Array.from({ length: N }).map((_, r) =>
                Array.from({ length: N }).map((_, c) => {
                  const brokenTile = round.broken[r][c];
                  const isA = round.pos.A[0] === r && round.pos.A[1] === c;
                  const isB = round.pos.B[0] === r && round.pos.B[1] === c;
                  const target = isLegal(r, c);
                  const justBroke = lastBroken && lastBroken[0] === r && lastBroken[1] === c;
                  return (
                    <button
                      key={r + '-' + c}
                      type="button"
                      className={
                        'ti-tile' +
                        (brokenTile ? ' broken' : '') +
                        (justBroke ? ' cracking' : '') +
                        (target ? ' target' : '')
                      }
                      onClick={() => tapTile(r, c)}
                      disabled={!target}
                    >
                      <span className="ti-crack a" />
                      <span className="ti-crack b" />
                      {(isA || isB) && (
                        <span className={
                          'ti-orb ' + (isA ? 'A' : 'B') +
                          (round.turn === (isA ? 'A' : 'B') && phase === 'play' ? ' active' : '') +
                          (round.loser === (isA ? 'A' : 'B') ? ' fallen' : '')
                        } />
                      )}
                      {target && <span className="ti-ring" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {phase === 'roundOver' && (
            <div className="ti-dock">
              <button type="button" className="btn warm" onClick={pressNext}>Next round</button>
            </div>
          )}
          {phase === 'over' && (
            <p className="ti-note">Use Rematch in the shell for another first-to-{WIN_ROUNDS}.</p>
          )}
        </div>
      </div>
    </div>
  );
}
