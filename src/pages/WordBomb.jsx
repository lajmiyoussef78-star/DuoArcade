// src/pages/WordBomb.jsx — route: /wordbomb/:code
//
// Word Bomb — hot-potato word game:
//   * A fragment appears ("...OR..."). The bomb HOLDER must type a word
//     containing it (3+ letters, not used before this match) to pass the
//     bomb. The fragment changes with every valid word.
//   * The fuse is HIDDEN (22–42s per round, seeded — both devices know
//     when, neither player does). Whoever holds the bomb at the boom
//     loses a life. 3 lives each; last one alive wins.
//   * Side A adjudicates the boom moment (avoids device clock-skew
//     arguments); B has a fallback if A's boom never arrives.

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  myRoleInDuo, duoNames, bombChannel, loadWordBomb, recordWordBomb,
  fragmentAt, fuseDuration, validateWord, LIVES
} from '../lib/wordbomb.js';
import '../styles/wordbomb.css';

export default function WordBomb() {
  const { code } = useParams();
  const navigate = useNavigate();
  const backToDuo = useCallback(() => {
    navigate(`/app?duo=${encodeURIComponent(code)}`, { replace: true });
  }, [code, navigate]);

  const [role, setRole] = useState(undefined);
  const [names, setNames] = useState({ A: 'A', B: 'B' });
  const [tally, setTally] = useState({ a: 0, b: 0 });
  const [phase, setPhase] = useState('lobby');  // lobby | countdown | live | boom | done
  const [myReady, setMyReady] = useState(false);
  const [theirReady, setTheirReady] = useState(false);
  const [count, setCount] = useState(3);

  const [holder, setHolder] = useState('A');
  const [fragment, setFragment] = useState('');
  const [lives, setLives] = useState({ A: LIVES, B: LIVES });
  const [words, setWords] = useState([]);        // {by, word}
  const [draft, setDraft] = useState('');
  const [err, setErr] = useState('');
  const [boomLoser, setBoomLoser] = useState(null);
  const [winner, setWinner] = useState(null);
  const [heat, setHeat] = useState(0);           // 0..1 fuse suspense (visual only)

  const chRef = useRef(null);
  const seedRef = useRef(0);
  const fragIdxRef = useRef(0);
  const roundRef = useRef(0);
  const usedRef = useRef(new Set());
  const holderRef = useRef('A');
  const livesRef = useRef({ A: LIVES, B: LIVES });
  const fuseTimer = useRef(null);
  const fallbackTimer = useRef(null);
  const heatIv = useRef(null);
  const roundStartRef = useRef(0);
  const startedRef = useRef(false);
  const phaseRef = useRef('lobby'); phaseRef.current = phase;
  const roleRef = useRef(null);
  const codeRef = useRef(code);
  holderRef.current = holder;
  useEffect(() => { roleRef.current = role; }, [role]);
  useEffect(() => { codeRef.current = code; }, [code]);

  const startRoundRef = useRef(() => {});
  const applyBoomRef = useRef(() => {});
  const beginRef = useRef(() => {});
  const acceptWordRef = useRef(() => {});

  const applyBoom = useCallback((loser) => {
    if (phaseRef.current !== 'live') return;
    clearTimeout(fuseTimer.current); clearTimeout(fallbackTimer.current); clearInterval(heatIv.current);
    livesRef.current = { ...livesRef.current, [loser]: livesRef.current[loser] - 1 };
    setLives({ ...livesRef.current });
    setBoomLoser(loser);
    setPhase('boom');

    if (livesRef.current[loser] <= 0) {
      const w = loser === 'A' ? 'B' : 'A';
      setWinner(w);
      setPhase('done');
      if (roleRef.current === 'A') {
        recordWordBomb(codeRef.current, w).then(r => setTally({ a: r.wins_a, b: r.wins_b })).catch(() => {});
      }
      return;
    }
    if (roleRef.current === 'A') {
      setTimeout(() => {
        const round = roundRef.current + 1;
        const fragIdx = fragIdxRef.current;
        chRef.current?.send({ k: 'round', round, holder: loser, fragIdx });
        startRoundRef.current(round, loser, fragIdx);
      }, 2200);
    }
  }, []);
  applyBoomRef.current = applyBoom;

  const startRound = useCallback((round, startHolder, fragIdx) => {
    roundRef.current = round;
    fragIdxRef.current = fragIdx;
    roundStartRef.current = Date.now();
    setHolder(startHolder); holderRef.current = startHolder;
    setFragment(fragmentAt(seedRef.current, fragIdx));
    setBoomLoser(null); setErr(''); setDraft('');
    setPhase('live');

    clearInterval(heatIv.current);
    const dur = fuseDuration(seedRef.current, round);
    heatIv.current = setInterval(() => {
      setHeat(Math.min(1, (Date.now() - roundStartRef.current) / dur));
    }, 400);

    clearTimeout(fuseTimer.current); clearTimeout(fallbackTimer.current);
    if (roleRef.current === 'A') {
      fuseTimer.current = setTimeout(() => {
        const loser = holderRef.current;
        chRef.current?.send({ k: 'boom', loser });
        applyBoomRef.current(loser);
      }, dur);
    } else {
      fallbackTimer.current = setTimeout(() => {
        if (phaseRef.current === 'live') {
          const loser = holderRef.current;
          chRef.current?.send({ k: 'boom', loser });
          applyBoomRef.current(loser);
        }
      }, dur + 2500);
    }
  }, []);
  startRoundRef.current = startRound;

  const acceptWord = useCallback((by, word, fragIdx, nextHolder, mine) => {
    if (usedRef.current.has(word)) return;
    usedRef.current.add(word);
    setWords(w => [...w, { by, word }]);
    fragIdxRef.current = fragIdx + 1;
    setFragment(fragmentAt(seedRef.current, fragIdx + 1));
    setHolder(nextHolder); holderRef.current = nextHolder;
    if (mine) { setDraft(''); setErr(''); }
  }, []);
  acceptWordRef.current = acceptWord;

  const begin = useCallback((seed) => {
    if (startedRef.current) return;
    startedRef.current = true;
    seedRef.current = seed;
    usedRef.current = new Set();
    livesRef.current = { A: LIVES, B: LIVES };
    setLives({ A: LIVES, B: LIVES });
    setWords([]);
    setWinner(null);
    setPhase('countdown');
    let c = 3;
    setCount(c);
    const iv = setInterval(() => {
      c -= 1; setCount(c);
      if (c <= 0) { clearInterval(iv); startRoundRef.current(0, 'A', 0); }
    }, 900);
  }, []);
  beginRef.current = begin;

  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await myRoleInDuo(code);
      if (!alive) return;
      setRole(r);
      if (!r) return;
      setNames(await duoNames(code));
      setTally(await loadWordBomb(code));

      const ch = await bombChannel(code);
      if (!alive) { ch.close(); return; }
      chRef.current = ch;
      ch.on(m => {
        if (m.k === 'ready') setTheirReady(m.v);
        else if (m.k === 'start') beginRef.current(m.seed);
        else if (m.k === 'word') acceptWordRef.current(m.by, m.word, m.fragIdx, m.next, false);
        else if (m.k === 'boom') applyBoomRef.current(m.loser);
        else if (m.k === 'round') startRoundRef.current(m.round, m.holder, m.fragIdx);
      });
    })();

    return () => {
      alive = false;
      chRef.current?.close();
      chRef.current = null;
      clearTimeout(fuseTimer.current);
      clearTimeout(fallbackTimer.current);
      clearInterval(heatIv.current);
    };
  }, [code]);

  function pressReady() {
    const v = !myReady;
    setMyReady(v);
    chRef.current?.send({ k: 'ready', v });
  }

  useEffect(() => {
    if (phase !== 'lobby' || !myReady || !theirReady) return;
    const delay = role === 'A' ? 120 : 1500;
    const t = setTimeout(() => {
      if (startedRef.current || phaseRef.current !== 'lobby') return;
      const seed = (Date.now() >>> 0) ^ 0x1B0B0;
      chRef.current?.send({ k: 'start', seed });
      begin(seed);
    }, delay);
    return () => clearTimeout(t);
  }, [myReady, theirReady, phase, role, begin]);

  function submit() {
    if (phaseRef.current !== 'live' || holderRef.current !== role) return;
    const res = validateWord(draft, fragment, usedRef.current);
    if (!res.ok) { setErr(res.reason); return; }
    const nextHolder = role === 'A' ? 'B' : 'A';
    const idx = fragIdxRef.current;
    acceptWord(role, res.word, idx, nextHolder, true);
    chRef.current?.send({ k: 'word', by: role, word: res.word, fragIdx: idx, next: nextHolder });
  }

  function rematch() {
    startedRef.current = false;
    setMyReady(false); setTheirReady(false);
    setWinner(null); setWords([]); setBoomLoser(null);
    setLives({ A: LIVES, B: LIVES });
    setPhase('lobby');
    chRef.current?.send({ k: 'ready', v: false });
  }

  if (role === undefined) return <div className="bo-page"><p className="bo-status">Loading…</p></div>;
  if (role === null) {
    return (
      <div className="bo-page">
        <p className="bo-status">Sign in as a member of this duo to play.</p>
        <button type="button" className="btn" onClick={backToDuo}>Back to the arcade</button>
      </div>
    );
  }

  const partner = role === 'A' ? 'B' : 'A';
  const iHold = holder === role;
  const hearts = r => '\u2764\uFE0F'.repeat(lives[r]) + '\u{1F5A4}'.repeat(LIVES - lives[r]);

  return (
    <div className="bo-page">
      <div className="bo-top">
        <button type="button" className="btn small ghost" onClick={backToDuo}>&larr; Back</button>
        <div className="bo-title">{'\u{1F4A3}'} Word Bomb</div>
        <div className="bo-tally">
          <span className="pA">{names.A} {tally.a}</span>
          <span className="dash">{'\u2013'}</span>
          <span className="pB">{tally.b} {names.B}</span>
        </div>
      </div>

      {phase === 'lobby' && (
        <div className="bo-lobby">
          <div className="bo-seats">
            <div className="bo-seat">
              <div className="bo-av A">{(names.A || '?')[0].toUpperCase()}</div>
              <div className={'bo-rd' + ((role === 'A' ? myReady : theirReady) ? ' yes' : '')}>
                {(role === 'A' ? myReady : theirReady) ? 'ready' : '\u2026'}
              </div>
            </div>
            <div className="bo-vs">vs</div>
            <div className="bo-seat">
              <div className="bo-av B">{(names.B || '?')[0].toUpperCase()}</div>
              <div className={'bo-rd' + ((role === 'B' ? myReady : theirReady) ? ' yes' : '')}>
                {(role === 'B' ? myReady : theirReady) ? 'ready' : '\u2026'}
              </div>
            </div>
          </div>
          <p className="bo-blurb">
            Type a word containing the fragment to pass the bomb — the fuse is
            hidden, and whoever&apos;s holding it at the boom loses a life.
            {' '}{LIVES} lives each. No repeats. House rule: real words only —
            you know each other. {'\u{1F608}'}
          </p>
          <button type="button" className="btn warm" onClick={pressReady}>{myReady ? 'Cancel' : "I'm ready"}</button>
        </div>
      )}

      {phase === 'countdown' && <div className="bo-count">{count || 'GO'}</div>}

      {(phase === 'live' || phase === 'boom') && (
        <div className="bo-arena">
          <div className="bo-lives">
            <span className="pA">{names.A} {hearts('A')}</span>
            <span className="pB">{hearts('B')} {names.B}</span>
          </div>

          <div className={'bo-bomb-zone' + (phase === 'boom' ? ' boomed' : '')}
            style={{ '--heat': heat }}>
            {phase === 'boom' ? (
              <div className="bo-boom">{'\u{1F4A5}'}</div>
            ) : (
              <div className={'bo-bomb' + (iHold ? ' mine' : '')}>{'\u{1F4A3}'}</div>
            )}
            <div className="bo-holderline">
              {phase === 'boom'
                ? <b>{names[boomLoser]} got caught holding it!</b>
                : iHold ? <b>you&apos;re holding the bomb!</b> : <>{names[partner]} is holding it…</>}
            </div>
          </div>

          {phase === 'live' && (
            <>
              <div className="bo-fragment">
                …<b>{fragment}</b>…
              </div>
              {iHold ? (
                <div className="bo-inputrow">
                  <input value={draft} autoFocus autoCapitalize="none" autoCorrect="off"
                    placeholder={`a word containing "${fragment}"`}
                    onChange={e => { setDraft(e.target.value); setErr(''); }}
                    onKeyDown={e => { if (e.key === 'Enter') submit(); }} />
                  <button type="button" className="btn warm small" onClick={submit}>Pass {'\u{1F4A3}'}</button>
                </div>
              ) : (
                <div className="bo-waitline">think ahead — it&apos;s coming back…</div>
              )}
              {err && <div className="bo-err">{err}</div>}
            </>
          )}

          <div className="bo-words">
            {words.slice(-8).map((w, i) => (
              <span key={i} className={'bo-word ' + (w.by === 'A' ? 'pA' : 'pB')}>{w.word}</span>
            ))}
          </div>
        </div>
      )}

      {phase === 'done' && winner && (
        <div className="bo-done">
          <div className="bo-winline">{names[winner]} survives the bomb!</div>
          <div className="bo-final">{words.length} words survived the match</div>
          <div className="bo-actions">
            <button type="button" className="btn warm" onClick={rematch}>Rematch</button>
            <button type="button" className="btn ghost" onClick={backToDuo}>Back home</button>
          </div>
        </div>
      )}

      {phase === 'lobby' && <div className="bo-note">Both players need to be on this screen. Open the same duo on each device.</div>}
    </div>
  );
}
