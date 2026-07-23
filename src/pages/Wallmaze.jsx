// src/pages/Wallmaze.jsx — mounted by the wallmaze engine.
//
// Lockstep over shell RT (same pattern as Thin Ice). Board renders
// flipped for player B so both always march upward toward the goal.
// Inputs map back to canonical coords.

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  initialRound, applyRoundMove, legalPawnMoves, wallIllegalReason,
  N, WALLS, WIN_ROUNDS
} from '../lib/wallmaze.js';
import '../styles/wallmaze.css';

export default function Wallmaze({ myRole, names = {}, rt, onComplete }) {
  const me = myRole;
  const opp = me === 'A' ? 'B' : 'A';
  const nm = { A: names.A || 'A', B: names.B || 'B' };

  const [phase, setPhase] = useState('wait'); // wait | play | roundOver | over
  const [round, setRound] = useState(null);
  const [roundNo, setRoundNo] = useState(0);
  const [wins, setWins] = useState({ A: 0, B: 0 });
  const [winner, setWinner] = useState(null);
  const [wallMode, setWallMode] = useState(false);
  const [ghost, setGhost] = useState(null);
  const [note, setNote] = useState('');

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
    setWallMode(false);
    setGhost(null);
    setNote('');
    setPhase('play');
  }, []);

  const doMove = useCallback((move, by) => {
    const prev = roundRef.current;
    if (!prev) return;
    const next = applyRoundMove(prev, by, move);
    if (next.error) {
      setNote(next.error);
      setRound({ ...next });
      return;
    }
    roundRef.current = next;
    setRound(next);
    setNote('');
    setGhost(null);
    setWallMode(false);
    if (next.winner) {
      const w = next.winner;
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
    setWallMode(false);
    setGhost(null);
    setNote('');
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
        if (m.by === me || !m.move) return;
        doMove(m.move, m.by);
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

  const flip = me === 'B';
  const cCell = (r, c) => (flip ? [N - 1 - r, N - 1 - c] : [r, c]);
  const vAnchor = (r, c) => (flip ? [N - 2 - r, N - 2 - c] : [r, c]);
  const cAnchor = (r, c) => (flip ? [N - 2 - r, N - 2 - c] : [r, c]);

  const myTurn = round && phase === 'play' && round.turn === me && !round.winner;
  const legal = myTurn && !wallMode ? legalPawnMoves(round, me) : [];
  const legalSet = new Set(legal.map(([r, c]) => r * N + c));

  function sendMove(move) {
    doMove(move, me);
    const payload = { k: 'move', move, by: me };
    rt?.send(payload);
    setTimeout(() => rt?.send(payload), 180);
  }

  function tapCell(vr, vc) {
    if (!myTurn || wallMode) return;
    const [r, c] = cCell(vr, vc);
    if (!legalSet.has(r * N + c)) return;
    sendMove({ t: 'move', to: [r, c] });
  }

  function tapAnchor(vr, vc) {
    if (!myTurn || !wallMode) return;
    const [r, c] = cAnchor(vr, vc);
    setGhost(g => (g && g.r === r && g.c === c) ? { ...g, o: g.o === 'H' ? 'V' : 'H' } : { o: 'H', r, c });
    setNote('');
  }

  function confirmWall() {
    if (!ghost) return;
    sendMove({ t: 'wall', o: ghost.o, r: ghost.r, c: ghost.c });
  }

  function pressNext() {
    nextRound();
    const payload = { k: 'next', by: me };
    rt?.send(payload);
    setTimeout(() => rt?.send(payload), 180);
  }

  const ghostWhy = ghost && round ? wallIllegalReason(round, me, ghost.o, ghost.r, ghost.c) : null;

  if (!me || phase === 'wait' || !round) {
    return <div className="wm-shell"><p className="wm-status">Building the maze…</p></div>;
  }

  const viewWalls = (round.placed || []).map(w => {
    const [r, c] = vAnchor(w.r, w.c);
    return { ...w, r, c };
  });
  const viewGhost = ghost
    ? (() => { const [r, c] = vAnchor(ghost.r, ghost.c); return { ...ghost, r, c }; })()
    : null;

  return (
    <div className="wm-shell">
      <div className="wm-table">
        <div className="wm-game">
          <div className="wm-toolbar">
            <div className="wm-brand">Wallmaze</div>
            <div className="wm-scorebar">
              <span className="wm-pname pA">{nm.A}</span>
              <div className="wm-pips">
                {Array.from({ length: WIN_ROUNDS }).map((_, i) => (
                  <span key={'a' + i} className={'wm-pip A' + (wins.A > i ? ' on' : '')} />
                ))}
                <span className="wm-roundno">round {roundNo + 1}</span>
                {Array.from({ length: WIN_ROUNDS }).map((_, i) => (
                  <span key={'b' + i} className={'wm-pip B' + (wins.B > i ? ' on' : '')} />
                ))}
              </div>
              <span className="wm-pname pB">{nm.B}</span>
            </div>
          </div>

          <WallStock label={nm[opp]} count={round.wallsLeft[opp]} side={opp} />

          <div className="wm-statusline">
            {phase === 'play' && (myTurn
              ? <span className="wm-yourturn">{wallMode ? 'tap an intersection, rotate, confirm' : 'your move'}</span>
              : <span><span className={opp === 'A' ? 'pA' : 'pB'}>{nm[opp]}</span> is plotting</span>)}
            {phase === 'roundOver' && round.winner && (
              <span className="wm-roundmsg">
                <span className={round.winner === 'A' ? 'pA' : 'pB'}>{nm[round.winner]}</span>
                {' '}escapes — {wins[round.winner]} of {WIN_ROUNDS}
              </span>
            )}
            {phase === 'over' && winner && (
              <span className="wm-roundmsg">
                <span className={winner === 'A' ? 'pA' : 'pB'}>{nm[winner]}</span> rules the maze
              </span>
            )}
          </div>

          <div className="wm-boardwrap">
            <div className="wm-board" style={{ '--n': N }}>
              {Array.from({ length: N }).map((_, vr) =>
                Array.from({ length: N }).map((_, vc) => {
                  const [r, c] = cCell(vr, vc);
                  const isA = round.pawns.A.r === r && round.pawns.A.c === c;
                  const isB = round.pawns.B.r === r && round.pawns.B.c === c;
                  const target = myTurn && !wallMode && legalSet.has(r * N + c);
                  const goalStrip = vr === 0;
                  return (
                    <button
                      key={vr + '-' + vc}
                      type="button"
                      className={'wm-cell' + (goalStrip ? ' goal' : '') + (target ? ' target' : '')}
                      style={{ gridRow: vr + 1, gridColumn: vc + 1 }}
                      onClick={() => tapCell(vr, vc)}
                      disabled={!target}
                    >
                      {(isA || isB) && (
                        <span className={
                          'wm-orb ' + (isA ? 'A' : 'B') +
                          (round.turn === (isA ? 'A' : 'B') && phase === 'play' ? ' active' : '') +
                          (round.winner === (isA ? 'A' : 'B') ? ' crowned' : '')
                        } />
                      )}
                      {target && <span className="wm-ring" />}
                    </button>
                  );
                })
              )}
              {viewWalls.map((w, i) => (
                <span
                  key={'w' + i}
                  className={'wm-wall ' + w.o.toLowerCase() + ' by' + w.by}
                  style={wallStyle(w)}
                />
              ))}
              {viewGhost && (
                <span
                  className={'wm-wall ghost ' + viewGhost.o.toLowerCase() + (ghostWhy ? ' bad' : '')}
                  style={wallStyle(viewGhost)}
                />
              )}
              {myTurn && wallMode && Array.from({ length: N - 1 }).map((_, vr) =>
                Array.from({ length: N - 1 }).map((_, vc) => (
                  <button
                    key={'x' + vr + '-' + vc}
                    type="button"
                    className={'wm-node' + (viewGhost && viewGhost.r === vr && viewGhost.c === vc ? ' on' : '')}
                    style={{ '--nr': vr, '--nc': vc }}
                    onClick={() => tapAnchor(vr, vc)}
                  />
                ))
              )}
            </div>
          </div>

          <WallStock label={`${nm[me]} (you)`} count={round.wallsLeft[me]} side={me} mine />

          {phase === 'play' && myTurn && (
            <div className="wm-controls">
              {!wallMode ? (
                <button
                  type="button"
                  className="btn"
                  disabled={round.wallsLeft[me] <= 0}
                  onClick={() => { setWallMode(true); setGhost(null); setNote(''); }}
                >
                  Place a wall ({round.wallsLeft[me]} left)
                </button>
              ) : (
                <div className="wm-wallbar">
                  <button type="button" className="btn small ghost" onClick={() => { setWallMode(false); setGhost(null); setNote(''); }}>Cancel</button>
                  <button type="button" className="btn small" disabled={!ghost} onClick={() => setGhost(g => g && { ...g, o: g.o === 'H' ? 'V' : 'H' })}>Rotate</button>
                  <button type="button" className="btn small warm" disabled={!ghost || !!ghostWhy} onClick={confirmWall}>Confirm</button>
                  {ghost && ghostWhy && <span className="wm-why">{ghostWhy}</span>}
                </div>
              )}
              {note && <div className="wm-err">{note}</div>}
            </div>
          )}

          {phase === 'roundOver' && (
            <div className="wm-dock">
              <button type="button" className="btn warm" onClick={pressNext}>Next round</button>
            </div>
          )}
          {phase === 'over' && (
            <p className="wm-note">Use Rematch in the shell for another match.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function wallStyle(w) {
  return { '--wr': w.r, '--wc': w.c };
}

function WallStock({ label, count, side, mine }) {
  return (
    <div className={'wm-stock' + (mine ? ' mine' : '')}>
      <span className={'wm-stock-name ' + (side === 'A' ? 'pA' : 'pB')}>{label}</span>
      <span className="wm-stock-bars">
        {Array.from({ length: WALLS }).map((_, i) => (
          <i key={i} className={i < count ? 'on' : ''} />
        ))}
      </span>
    </div>
  );
}
