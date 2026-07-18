// src/pages/WordBomb.jsx — Word Bomb play UI (mounted by the wordbomb engine).
// Shell already ran ready + countdown. Host seeds the match; A adjudicates booms.

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  fragmentAt, fuseDuration, validateWord, LIVES
} from '../lib/wordbomb.js';
import { loadWordBombDict, isEnglishWord, isDictReady } from '../lib/wordbombDict.js';
import '../styles/wordbomb.css';

const seedByCode = new Map();

export default function WordBomb({ myRole, names = {}, rt, code, onComplete }) {
  const role = myRole;
  const partnerRole = role === 'A' ? 'B' : 'A';
  const partnerName = names[partnerRole] || 'Partner';

  const [phase, setPhase] = useState('wait'); // wait | live | boom | done
  const [dictReady, setDictReady] = useState(isDictReady());
  const [dictError, setDictError] = useState(false);
  const [holder, setHolder] = useState('A');
  const [fragment, setFragment] = useState('');
  const [lives, setLives] = useState({ A: LIVES, B: LIVES });
  const [words, setWords] = useState([]);
  const [draft, setDraft] = useState('');
  const [err, setErr] = useState('');
  const [boomLoser, setBoomLoser] = useState(null);
  const [winner, setWinner] = useState(null);
  const [heat, setHeat] = useState(0);

  const seedRef = useRef(null);
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
  const finishedRef = useRef(false);
  const phaseRef = useRef('wait');
  phaseRef.current = phase;
  holderRef.current = holder;

  const clearTimers = () => {
    clearTimeout(fuseTimer.current);
    clearTimeout(fallbackTimer.current);
    clearInterval(heatIv.current);
  };

  useEffect(() => {
    let alive = true;
    loadWordBombDict()
      .then(() => { if (alive) { setDictReady(true); setDictError(false); } })
      .catch(() => { if (alive) setDictError(true); });
    return () => { alive = false; };
  }, []);

  const startRoundRef = useRef(() => {});
  const applyBoomRef = useRef(() => {});

  const applyBoom = useCallback((loser) => {
    if (phaseRef.current !== 'live') return;
    clearTimers();
    livesRef.current = { ...livesRef.current, [loser]: livesRef.current[loser] - 1 };
    setLives({ ...livesRef.current });
    setBoomLoser(loser);
    setPhase('boom');

    if (livesRef.current[loser] <= 0) {
      const w = loser === 'A' ? 'B' : 'A';
      setWinner(w);
      setPhase('done');
      if (role === 'A' && !finishedRef.current) {
        finishedRef.current = true;
        onComplete?.(w);
      }
      return;
    }
    if (role === 'A') {
      setTimeout(() => {
        const round = roundRef.current + 1;
        // New round → fresh random letters from pass 0
        rt?.send({ k: 'round', round, holder: loser, fragIdx: 0 });
        startRoundRef.current(round, loser, 0);
      }, 2200);
    }
  }, [role, rt, onComplete]);
  applyBoomRef.current = applyBoom;

  const startRound = useCallback((round, startHolder, fragIdx = 0) => {
    roundRef.current = round;
    fragIdxRef.current = fragIdx;
    roundStartRef.current = Date.now();
    setHolder(startHolder);
    holderRef.current = startHolder;
    setFragment(fragmentAt(seedRef.current, round, fragIdx));
    setBoomLoser(null);
    setErr('');
    setDraft('');
    setHeat(0);
    setPhase('live');

    clearTimers();
    const dur = fuseDuration(seedRef.current, round);
    heatIv.current = setInterval(() => {
      setHeat(Math.min(1, (Date.now() - roundStartRef.current) / dur));
    }, 400);

    if (role === 'A') {
      fuseTimer.current = setTimeout(() => {
        const loser = holderRef.current;
        rt?.send({ k: 'boom', loser });
        applyBoomRef.current(loser);
      }, dur);
    } else {
      fallbackTimer.current = setTimeout(() => {
        if (phaseRef.current === 'live') {
          const loser = holderRef.current;
          rt?.send({ k: 'boom', loser });
          applyBoomRef.current(loser);
        }
      }, dur + 2500);
    }
  }, [role, rt]);
  startRoundRef.current = startRound;

  const acceptWord = useCallback((by, word, fragIdx, nextHolder, mine) => {
    if (usedRef.current.has(word)) return;
    usedRef.current.add(word);
    setWords(w => [...w, { by, word }]);
    const nextPass = fragIdx + 1;
    fragIdxRef.current = nextPass;
    setFragment(fragmentAt(seedRef.current, roundRef.current, nextPass));
    setHolder(nextHolder);
    holderRef.current = nextHolder;
    if (mine) { setDraft(''); setErr(''); }
  }, []);

  const begin = useCallback((seed) => {
    if (seed == null || startedRef.current) return;
    startedRef.current = true;
    const n = seed >>> 0;
    seedRef.current = n;
    if (code) seedByCode.set(code, n);
    usedRef.current = new Set();
    livesRef.current = { A: LIVES, B: LIVES };
    setLives({ A: LIVES, B: LIVES });
    setWords([]);
    setWinner(null);
    finishedRef.current = false;
    startRound(0, 'A', 0);
  }, [code, startRound]);

  useEffect(() => {
    if (!rt?.on) return undefined;
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
      if (m.k === 'word') {
        if (m.by === role) return;
        // Re-check on receive so a bad client can't pass gibberish
        const round = typeof m.round === 'number' ? m.round : roundRef.current;
        const frag = fragmentAt(seedRef.current, round, m.fragIdx);
        const res = validateWord(m.word, frag, usedRef.current, isDictReady() ? isEnglishWord : undefined);
        if (!res.ok) return;
        acceptWord(m.by, res.word, m.fragIdx, m.next, false);
        return;
      }
      if (m.k === 'boom') {
        applyBoom(m.loser);
        return;
      }
      if (m.k === 'round') {
        startRound(m.round, m.holder, m.fragIdx);
      }
    });
    return () => clearTimers();
  }, [rt, role, begin, acceptWord, applyBoom, startRound]);

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

  function submit() {
    if (phaseRef.current !== 'live' || holderRef.current !== role) return;
    if (!dictReady) {
      setErr(dictError ? 'dictionary failed to load' : 'loading dictionary…');
      return;
    }
    const res = validateWord(draft, fragment, usedRef.current, isEnglishWord);
    if (!res.ok) { setErr(res.reason); return; }
    const nextHolder = role === 'A' ? 'B' : 'A';
    const idx = fragIdxRef.current;
    acceptWord(role, res.word, idx, nextHolder, true);
    rt?.send({
      k: 'word', by: role, word: res.word, fragIdx: idx,
      round: roundRef.current, next: nextHolder
    });
  }

  const iHold = holder === role;
  const heatStage = heat < 0.4 ? 'cool' : heat < 0.72 ? 'warn' : 'hot';
  const bombSide = phase === 'boom' ? (boomLoser || holder) : holder;

  function Hearts({ who }) {
    const n = lives[who] ?? 0;
    return (
      <div className="bo-hearts" aria-label={`${n} lives`}>
        {Array.from({ length: LIVES }, (_, i) => (
          <span key={i} className={'bo-heart' + (i < n ? ' on' : ' off')}>
            {i < n ? '\u2764\uFE0F' : '\u{1F5A4}'}
          </span>
        ))}
      </div>
    );
  }

  if (phase === 'wait') {
    return (
      <div className="bo-page bo-embedded">
        <div className="bo-status">
          {dictError ? 'Dictionary failed to load — refresh and try again.'
            : dictReady ? 'Lighting the fuse…' : 'Loading English dictionary…'}
        </div>
      </div>
    );
  }

  return (
    <div className="bo-page bo-embedded">
      {(phase === 'live' || phase === 'boom') && (
        <div className="bo-arena">
          <div
            className={[
              'bo-duel',
              `hold-${bombSide}`,
              `heat-${heatStage}`,
              phase === 'boom' ? 'boomed' : '',
              iHold && phase === 'live' ? 'mine' : ''
            ].filter(Boolean).join(' ')}
            style={{ '--heat': heat }}
          >
            <div className={'bo-side A' + (bombSide === 'A' ? ' has-bomb' : '')}>
              <div className="bo-side-name pA">{names.A || 'A'}</div>
              <Hearts who="A" />
              <div className="bo-pad" aria-hidden="true" />
            </div>

            <div className="bo-mid">
              {phase === 'boom' ? (
                <div className="bo-boom-msg">
                  <b>{names[boomLoser] || boomLoser}</b> got caught holding it!
                </div>
              ) : (
                <>
                  <div className="bo-fragment">…<b>{fragment}</b>…</div>
                  <div className="bo-holderline">
                    {iHold ? <b>your turn — type a word!</b> : <>{partnerName} is guessing…</>}
                  </div>
                </>
              )}
            </div>

            <div className={'bo-side B' + (bombSide === 'B' ? ' has-bomb' : '')}>
              <div className="bo-side-name pB">{names.B || 'B'}</div>
              <Hearts who="B" />
              <div className="bo-pad" aria-hidden="true" />
            </div>

            <div className={'bo-bomb-fly' + (phase === 'boom' ? ' explode' : '')} aria-hidden="true">
              {phase === 'boom' ? (
                <span className="bo-boom">💥</span>
              ) : (
                <span className={'bo-bomb-viz heat-' + heatStage}>
                  <span className="bo-bomb-body" />
                  <span className="bo-bomb-fuse" />
                  <span className="bo-bomb-spark" />
                </span>
              )}
            </div>
          </div>

          {phase === 'live' && (
            <>
              {iHold ? (
                <div className="bo-inputrow">
                  <input
                    value={draft}
                    autoFocus
                    autoCapitalize="none"
                    autoCorrect="off"
                    placeholder={`a word containing "${fragment}"`}
                    onChange={e => { setDraft(e.target.value); setErr(''); }}
                    onKeyDown={e => { if (e.key === 'Enter') submit(); }}
                  />
                  <button type="button" className="btn warm small" onClick={submit}>
                    Pass
                  </button>
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
          <div className="bo-winline">
            {winner === role ? 'You survive the bomb!' : `${names[winner] || winner} survives the bomb!`}
          </div>
          <div className="bo-final">{words.length} words survived the match</div>
        </div>
      )}
    </div>
  );
}
