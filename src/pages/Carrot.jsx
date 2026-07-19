// src/pages/Carrot.jsx — Carrot in a Box (mounted by the carrot engine).
//
// Two boxes, one carrot. Peeker looks in their own box, then bluffs in chat.
// Chooser keeps or swaps. Holder of the carrot wins the round. First to 4.

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  carrotHolder, peekerFor, roundWinner, WIN_SCORE, POINTS_PER_ROUND, QUICK_LINES
} from '../lib/carrot.js';
import '../styles/carrot.css';

const seedByCode = new Map();

export default function Carrot({ myRole, names = {}, rt, code, onComplete }) {
  const me = myRole;
  const opp = me === 'A' ? 'B' : 'A';
  const nm = { A: names.A || 'A', B: names.B || 'B' };

  const [phase, setPhase] = useState('deal'); // deal | peek | choose | reveal | over
  const [round, setRound] = useState(0);
  const [score, setScore] = useState({ A: 0, B: 0 });
  const [peeked, setPeeked] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [chat, setChat] = useState([]);
  const [draft, setDraft] = useState('');
  const [winner, setWinner] = useState(null);

  const seedRef = useRef(null);
  const meRef = useRef(me);
  const roundRef = useRef(0);
  const scoreRef = useRef({ A: 0, B: 0 });
  const startedRef = useRef(false);
  const finishedRef = useRef(false);
  const chatEndRef = useRef(null);
  meRef.current = me;

  const begin = useCallback((seed) => {
    if (seed == null || startedRef.current) return;
    startedRef.current = true;
    const n = seed >>> 0;
    seedRef.current = n;
    if (code) seedByCode.set(code, n);
    finishedRef.current = false;
    roundRef.current = 0;
    scoreRef.current = { A: 0, B: 0 };
    setScore({ A: 0, B: 0 });
    setRound(0);
    setWinner(null);
    setChat([]);
    setLastResult(null);
    setPeeked(false);
    setPhase('peek');
  }, [code]);

  const resolveRound = useCallback((swap) => {
    const h = carrotHolder(seedRef.current, roundRef.current);
    const w = roundWinner(h, swap);
    scoreRef.current = { ...scoreRef.current, [w]: scoreRef.current[w] + POINTS_PER_ROUND };
    setScore({ ...scoreRef.current });
    setLastResult({ holder: h, swap, winner: w });
    setPhase('reveal');
    if (scoreRef.current[w] >= WIN_SCORE) {
      setWinner(w);
      setTimeout(() => setPhase('over'), 1600);
      if (!finishedRef.current) {
        finishedRef.current = true;
        if (meRef.current === 'A') onComplete?.(w);
      }
    }
  }, [onComplete]);

  const nextRound = useCallback((r) => {
    roundRef.current = r;
    setRound(r);
    setPeeked(false);
    setLastResult(null);
    setPhase('peek');
  }, []);

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
      if (m.k === 'peeked') {
        setPeeked(true);
        setPhase('choose');
        return;
      }
      if (m.k === 'choice') {
        resolveRound(!!m.swap);
        return;
      }
      if (m.k === 'next') {
        nextRound(m.round);
        return;
      }
      if (m.k === 'chat') {
        if (m.by === me) return;
        setChat(c => [...c.slice(-30), { by: m.by, text: m.text }]);
      }
    });
  }, [rt, me, begin, resolveRound, nextRound]);

  useEffect(() => {
    if (me === 'A') {
      let seed = (code && seedByCode.get(code)) || seedRef.current;
      if (seed == null) {
        seed = ((Date.now() ^ (Math.random() * 0xFFFFFFFF)) >>> 0);
        if (code) seedByCode.set(code, seed);
      }
      seedRef.current = seed;
      const push = () => rt?.send({ k: 'start', seed });
      begin(seed);
      push();
      const t1 = setTimeout(push, 400);
      const t2 = setTimeout(push, 1200);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    const ask = () => { if (!startedRef.current) rt?.send({ k: 'needstart' }); };
    ask();
    const iv = setInterval(ask, 700);
    return () => clearInterval(iv);
  }, [me, rt, begin, code]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat]);

  function doPeek() {
    setPeeked(true);
    setPhase('choose');
    rt?.send({ k: 'peeked' });
    setTimeout(() => rt?.send({ k: 'peeked' }), 180);
  }

  function choose(swap) {
    resolveRound(swap);
    const payload = { k: 'choice', swap };
    rt?.send(payload);
    setTimeout(() => rt?.send(payload), 180);
  }

  function pressNext() {
    const r = roundRef.current + 1;
    nextRound(r);
    rt?.send({ k: 'next', round: r });
    setTimeout(() => rt?.send({ k: 'next', round: r }), 180);
  }

  function sendChat(text) {
    const t = (text ?? draft).trim();
    if (!t) return;
    setChat(c => [...c.slice(-30), { by: me, text: t }]);
    rt?.send({ k: 'chat', by: me, text: t });
    if (text == null) setDraft('');
  }

  if (!me || phase === 'deal') {
    return <div className="ca-shell"><p className="ca-status">Boxing the carrot…</p></div>;
  }

  const holder = carrotHolder(seedRef.current || 0, round);
  const peeker = peekerFor(round);
  const chooser = peeker === 'A' ? 'B' : 'A';
  const iPeek = me === peeker;
  const iChoose = me === chooser;
  // Each seat sees the opponent across the table and themselves near.
  // After a swap, the carrot ends with the other seat.
  const carrotSeat = phase === 'reveal' && lastResult
    ? roundWinner(lastResult.holder, lastResult.swap)
    : holder;
  const inRound = phase === 'peek' || phase === 'choose' || phase === 'reveal';

  const oppPeekHere = false; // opponent never shows private peek
  const myPeekHere = iPeek && peeked && phase !== 'reveal';
  const swapping = phase === 'reveal' && lastResult?.swap;

  let roleEvent = null;
  if (phase === 'reveal' && lastResult) {
    roleEvent = <>{nm[lastResult.winner]} takes the round!</>;
  } else if (phase === 'peek' && iPeek && !peeked) {
    roleEvent = (
      <>
        <span className="ca-event-line">You&apos;re <span className="ca-role-hl">the peeker</span></span>
        <span className="ca-event-line">look in your box, then convince {nm[opp]}</span>
      </>
    );
  } else if (phase === 'peek' && !iPeek) {
    roleEvent = <>{nm[opp]} is peeking — you&apos;ll keep or swap</>;
  }

  return (
    <div className="ca-shell">
      {inRound && (
        <div className="ca-table">
          <div className="ca-board">
            <div className="ca-toolbar">
              <div className="ca-brand">{'\u{1F955}'} Carrot in a Box</div>
              <div className="ca-bo5" title="Best of 5 — first to 3">
                <div className="ca-pips">
                  {Array.from({ length: WIN_SCORE }).map((_, i) => (
                    <span key={'a' + i} className={'ca-pip A' + (score.A > i ? ' on' : '')} />
                  ))}
                </div>
                <span className="ca-roundno">R{round + 1}</span>
                <div className="ca-pips">
                  {Array.from({ length: WIN_SCORE }).map((_, i) => (
                    <span key={'b' + i} className={'ca-pip B' + (score.B > i ? ' on' : '')} />
                  ))}
                </div>
              </div>
            </div>

            {/* Opponent — across the table */}
            <div className={'ca-zone top' + ((iPeek ? peeker === opp : chooser === opp) && phase !== 'reveal' ? ' active' : '')}>
              <div className={'ca-zone-name ' + (opp === 'A' ? 'pA' : 'pB')}>
                {nm[opp]}
              </div>
              <Box
                seat={opp}
                mine={false}
                face="down"
                open={phase === 'reveal'}
                hasCarrot={carrotSeat === opp}
                privateView={oppPeekHere}
                showsCarrot={undefined}
                swap={swapping}
              />
            </div>

            {/* Center felt — status only */}
            <div className={'ca-stage' + (iChoose || (iPeek && !peeked) ? ' my-turn' : '')}>
              <div className="ca-felt">
                {roleEvent && <p className="ca-event">{roleEvent}</p>}
                {phase === 'peek' && !iPeek && (
                  <p className="ca-wait-chip">{nm[opp]} hasn&apos;t peeked yet…</p>
                )}
                {phase === 'choose' && !iChoose && (
                  <p className="ca-wait-chip">Sell the lie — {nm[chooser]} is deciding…</p>
                )}
                {phase === 'choose' && iChoose && (
                  <p className="ca-turn-chip">Believe them?</p>
                )}
              </div>
            </div>

            {/* You — this side of the table */}
            <div className={'ca-zone' + ((iPeek && !peeked) || iChoose ? ' active' : '')}>
              <Box
                seat={me}
                mine
                face="up"
                open={phase === 'reveal'}
                hasCarrot={carrotSeat === me}
                privateView={myPeekHere}
                showsCarrot={myPeekHere ? holder === me : undefined}
                swap={swapping}
              />
              <div className={'ca-zone-name ' + (me === 'A' ? 'pA' : 'pB')}>
                {nm[me]} (you)
              </div>
              {phase === 'peek' && iPeek && !peeked && (
                <button type="button" className="btn warm ca-peekbtn" onClick={doPeek}>
                  Peek inside your box
                </button>
              )}
              {myPeekHere && <div className="ca-box-privnote">only you can see this</div>}
            </div>
          </div>

          {phase === 'choose' && iChoose && (
            <div className="ca-dock">
              <div className="ca-dock-title">Keep or swap</div>
              <div className="ca-choosebtns">
                <button type="button" className="btn warm" onClick={() => choose(false)}>
                  {'\u{1F4E6}'} Keep my box
                </button>
                <button type="button" className="btn warm" onClick={() => choose(true)}>
                  {'\u{1F500}'} SWAP boxes
                </button>
              </div>
            </div>
          )}
          {phase === 'reveal' && lastResult && !winner && (
            <div className="ca-dock">
              <button type="button" className="btn warm" onClick={pressNext}>Next round</button>
            </div>
          )}

          <div className="ca-chat">
            <div className="ca-chat-msgs">
              {chat.length === 0 && <div className="ca-chat-empty">the lying happens here…</div>}
              {chat.map((m, i) => (
                <div key={i} className={'ca-msg' + (m.by === me ? ' mine' : '')}>
                  <span className={'ca-msg-who ' + (m.by === 'A' ? 'pA' : 'pB')}>{nm[m.by]}</span>
                  <span className="ca-msg-text">{m.text}</span>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="ca-quick">
              {QUICK_LINES.map((q, i) => (
                <button key={i} type="button" className="ca-quickbtn" onClick={() => sendChat(q)}>{q}</button>
              ))}
            </div>
            <div className="ca-chat-input">
              <input
                value={draft}
                placeholder="say anything…"
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') sendChat(); }}
              />
              <button type="button" className="btn warm small" onClick={() => sendChat()}>Send</button>
            </div>
          </div>
        </div>
      )}

      {phase === 'over' && winner && (
        <div className="ca-table">
          <div className="ca-done">
            <div className="ca-winline">{'\u{1F955}'} {nm[winner]} wins the carrot crown!</div>
            <div className="ca-final">{nm.A} {score.A} {'\u2013'} {score.B} {nm.B}</div>
            <p className="ca-note">Use Rematch in the shell for another best-of-{WIN_SCORE * 2 - 1}.</p>
          </div>
        </div>
      )}

      {!inRound && phase !== 'over' && (
        <p className="ca-status">Boxing the carrot…</p>
      )}
    </div>
  );
}

function Box({ seat, mine, face, open, hasCarrot, privateView, showsCarrot, swap }) {
  return (
    <div className={
      'ca-boxwrap'
      + (mine ? ' mine' : '')
      + (face === 'down' ? ' face-down' : ' face-up')
      + (seat === 'A' ? ' seatA' : ' seatB')
      + (swap ? ' swapped' : '')
    }>
      <div className={'ca-box' + (open ? ' open' : '') + (privateView ? ' privview' : '')}>
        {open ? (
          <span className="ca-box-content">{hasCarrot ? '\u{1F955}' : '\u{1F4A8}'}</span>
        ) : privateView ? (
          <span className="ca-box-content priv">{showsCarrot ? '\u{1F955}' : '\u{1F573}\uFE0F'}</span>
        ) : (
          <span className="ca-box-lid">?</span>
        )}
      </div>
    </div>
  );
}
