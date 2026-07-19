// src/pages/Carrot.jsx — Carrot in a Box (mounted by the carrot engine).
//
// Two boxes, one carrot. Peeker looks in their own box, then bluffs in chat.
// Chooser keeps or swaps. Holder of the carrot wins the round. First to 4.

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  carrotHolder, peekerFor, roundWinner, WIN_SCORE, QUICK_LINES
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
    scoreRef.current = { ...scoreRef.current, [w]: scoreRef.current[w] + 1 };
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
  // Same layout for both players: A's box left, B's box right.
  // After a swap, the carrot ends with the other seat.
  const carrotSeat = phase === 'reveal' && lastResult
    ? roundWinner(lastResult.holder, lastResult.swap)
    : holder;
  const inRound = phase === 'peek' || phase === 'choose' || phase === 'reveal';

  return (
    <div className="ca-shell">
      <div className="ca-brand">{'\u{1F955}'} Carrot in a Box</div>

      {inRound && (
        <div className="ca-game">
          <div className="ca-scorebar">
            <span className={'ca-name pA' + (peeker === 'A' ? ' peeking' : '')}>{nm.A}</span>
            <div className="ca-pips">
              {Array.from({ length: WIN_SCORE }).map((_, i) => (
                <span key={'a' + i} className={'ca-pip A' + (score.A > i ? ' on' : '')} />
              ))}
              <span className="ca-roundno">R{round + 1}</span>
              {Array.from({ length: WIN_SCORE }).map((_, i) => (
                <span key={'b' + i} className={'ca-pip B' + (score.B > i ? ' on' : '')} />
              ))}
            </div>
            <span className={'ca-name pB' + (peeker === 'B' ? ' peeking' : '')}>{nm.B}</span>
          </div>

          <div className="ca-rolebanner">
            {phase === 'reveal' && lastResult ? (
              <b>{nm[lastResult.winner]} takes the round!</b>
            ) : iPeek ? (
              <>you&apos;re the <b>peeker</b> — look in your box, then convince {nm[opp]}</>
            ) : (
              <>{nm[opp]} is peeking — you&apos;ll <b>keep or swap</b></>
            )}
          </div>

          <div className="ca-boxes">
            {(['A', 'B']).map(seat => {
              const mine = seat === me;
              const peekHere = iPeek && peeked && phase !== 'reveal' && mine;
              return (
                <Box
                  key={seat}
                  label={mine ? `${nm[seat]} (you)` : nm[seat]}
                  mine={mine}
                  seat={seat}
                  open={phase === 'reveal'}
                  hasCarrot={carrotSeat === seat}
                  privateView={peekHere}
                  showsCarrot={peekHere ? holder === seat : undefined}
                  swap={phase === 'reveal' && lastResult?.swap}
                />
              );
            })}
          </div>

          {phase === 'peek' && iPeek && !peeked && (
            <button type="button" className="btn warm ca-peekbtn" onClick={doPeek}>
              {'\u{1F440}'} Peek inside your box
            </button>
          )}
          {phase === 'peek' && !iPeek && (
            <div className="ca-wait">{nm[opp]} hasn&apos;t peeked yet…</div>
          )}
          {phase === 'choose' && iChoose && (
            <div className="ca-choosebar">
              <div className="ca-choosetitle">Believe them?</div>
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
          {phase === 'choose' && !iChoose && (
            <div className="ca-wait">you&apos;ve peeked — now sell it. {nm[chooser]} is deciding…</div>
          )}
          {phase === 'reveal' && lastResult && !winner && (
            <button type="button" className="btn warm" onClick={pressNext}>Next round</button>
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
        <div className="ca-done">
          <div className="ca-winline">{'\u{1F955}'} {nm[winner]} wins the carrot crown!</div>
          <div className="ca-final">{nm.A} {score.A} {'\u2013'} {score.B} {nm.B}</div>
          <p className="ca-note">Use Rematch in the shell for another best-of-{WIN_SCORE * 2 - 1}.</p>
        </div>
      )}
    </div>
  );
}

function Box({ label, mine, seat, open, hasCarrot, privateView, showsCarrot, swap }) {
  return (
    <div className={
      'ca-boxwrap'
      + (mine ? ' mine' : '')
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
      <div className={'ca-box-label ' + (seat === 'A' ? 'pA' : 'pB')}>{label}</div>
      {privateView && <div className="ca-box-privnote">only you can see this</div>}
    </div>
  );
}
