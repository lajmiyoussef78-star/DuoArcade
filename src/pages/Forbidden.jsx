// src/pages/Forbidden.jsx — Forbidden Words play UI (mounted by forbiddenwords engine).

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  findSlips, cleanForbidden, wordCount, decide,
  TOPICS, SUGGESTIONS, MIN_WORDS, QUESTIONS_EACH
} from '../lib/forbidden.js';
import '../styles/forbidden.css';

function turnPlan() {
  const plan = [];
  for (let i = 0; i < QUESTIONS_EACH * 2; i++) {
    const asker = i % 2 === 0 ? 'A' : 'B';
    plan.push({ asker, answerer: asker === 'A' ? 'B' : 'A', qNo: Math.floor(i / 2) + 1 });
  }
  return plan;
}

export default function Forbidden({ myRole, names = {}, rt, onComplete }) {
  const role = myRole;
  const [phase, setPhase] = useState('topic');
  const [topic, setTopic] = useState('');
  const [customTopic, setCustomTopic] = useState('');
  const [picks, setPicks] = useState([]);
  const [customWord, setCustomWord] = useState('');
  const [iSubmitted, setISubmitted] = useState(false);
  const [theySubmitted, setTheySubmitted] = useState(false);
  const [exchanges, setExchanges] = useState([]);
  const [turnIdx, setTurnIdx] = useState(0);
  const [draftQ, setDraftQ] = useState('');
  const [draftA, setDraftA] = useState('');
  const [result, setResult] = useState(null);
  const [myWords, setMyWords] = useState([]); // words I must avoid (shown while playing)

  const myForbiddenRef = useRef([]);
  const myPicksRef = useRef([]);
  const plan = useRef(turnPlan()).current;
  const exchangesRef = useRef([]);
  exchangesRef.current = exchanges;
  const pendingReveal = useRef(null);
  const partnerReveal = useRef(null);
  const finishedRef = useRef(false);

  const tryFinishReveal = useCallback(() => {
    if (!pendingReveal.current && !partnerReveal.current) return;
    const merged = exchangesRef.current.map((e, i) => {
      const mineHas = pendingReveal.current && pendingReveal.current[i] != null;
      const theirsHas = partnerReveal.current && partnerReveal.current[i] != null;
      const answer = mineHas ? pendingReveal.current[i] : (theirsHas ? partnerReveal.current[i] : (e?.answer ?? ''));
      return { ...plan[i], question: e?.question ?? '', answer };
    });
    const haveAll = merged.every(m => m.answer && m.answer.length);
    if (!haveAll && !(pendingReveal.current && partnerReveal.current)) return;

    const wordsA = role === 'A' ? myForbiddenRef.current : myPicksRef.current;
    const wordsB = role === 'B' ? myForbiddenRef.current : myPicksRef.current;
    const perRoundSlips = { A: [0, 0, 0], B: [0, 0, 0] };
    let totalA = 0, totalB = 0;
    const scored = merged.map(m => {
      const list = m.answerer === role ? myForbiddenRef.current : myPicksRef.current;
      const hits = findSlips(m.answer || '', list);
      if (m.answerer === 'A') { totalA += hits.length; perRoundSlips.A[m.qNo - 1] += hits.length; }
      else { totalB += hits.length; perRoundSlips.B[m.qNo - 1] += hits.length; }
      return { ...m, slips: hits };
    });
    const w = decide(totalA, totalB, perRoundSlips.A, perRoundSlips.B);
    setResult({ w, totalA, totalB, scored, wordsA, wordsB });
    setPhase('done');
    if (role === 'A' && !finishedRef.current) {
      finishedRef.current = true;
      onComplete?.(w);
    }
  }, [plan, role, onComplete]);

  const maybeStart = useCallback(() => {
    if (!myPicksRef.current.length || !myForbiddenRef.current.length) return;
    setExchanges(plan.map(p => ({ ...p })));
    if (role === 'A') {
      rt?.send({ k: 'begin' });
      setPhase('play');
    }
  }, [plan, role, rt]);

  useEffect(() => {
    if (!rt?.on) return;
    rt.on(m => {
      if (!m || !m.k) return;
      if (m.k === 'topic') { setTopic(m.topic); setPhase('traps'); }
      else if (m.k === 'assign') {
        myForbiddenRef.current = m.words;
        setMyWords(m.words);
        setTheySubmitted(true);
        maybeStart();
      }
      else if (m.k === 'begin') setPhase('play');
      else if (m.k === 'q') {
        setExchanges(x => {
          const n = [...x]; n[m.idx] = { ...plan[m.idx], question: m.text }; return n;
        });
        setTurnIdx(m.idx);
      }
      else if (m.k === 'a') {
        setExchanges(x => {
          const n = [...x];
          n[m.idx] = { ...(n[m.idx] || plan[m.idx]), answeredBy: m.by, answerHidden: true };
          return n;
        });
        setTurnIdx(m.next);
      }
      else if (m.k === 'reveal') {
        partnerReveal.current = m.answers;
        if (!pendingReveal.current) {
          const mine = {};
          exchangesRef.current.forEach((e, i) => {
            if (e && e.answeredMine && typeof e.answer === 'string') mine[i] = e.answer;
          });
          pendingReveal.current = mine;
          rt?.send({ k: 'reveal', answers: mine });
        }
        tryFinishReveal();
      }
    });
  }, [rt, plan, maybeStart, tryFinishReveal]);

  function lockTopic() {
    const tp = (customTopic.trim() || topic).trim();
    if (!tp) return;
    setTopic(tp); setPhase('traps');
    rt?.send({ k: 'topic', topic: tp });
  }

  function togglePick(w) {
    setPicks(p => p.includes(w) ? p.filter(x => x !== w) : (p.length < 3 ? [...p, w] : p));
  }
  function addCustom() {
    const c = cleanForbidden([customWord]);
    if (c.length && picks.length < 3 && !picks.includes(c[0])) setPicks(p => [...p, c[0]]);
    setCustomWord('');
  }
  function submitPicks() {
    const words = cleanForbidden(picks);
    if (words.length !== 3) return;
    myPicksRef.current = words;
    setISubmitted(true); setPhase('wait');
    rt?.send({ k: 'assign', words });
    maybeStart();
  }

  const cur = plan[turnIdx];
  const iAsk = cur && cur.asker === role && !exchanges[turnIdx]?.question;
  const iAnswer = cur && cur.answerer === role && exchanges[turnIdx]?.question && !exchanges[turnIdx]?.answer && !exchanges[turnIdx]?.answeredMine;

  function sendQuestion() {
    const text = draftQ.trim();
    if (!text) return;
    setExchanges(x => { const n = [...x]; n[turnIdx] = { ...plan[turnIdx], question: text }; return n; });
    rt?.send({ k: 'q', idx: turnIdx, text });
    setDraftQ('');
  }

  function sendAnswer() {
    const text = draftA.trim();
    if (wordCount(text) < MIN_WORDS) return;
    setExchanges(x => {
      const n = [...x];
      n[turnIdx] = { ...n[turnIdx], answer: text, answeredMine: true };
      return n;
    });
    const next = Math.min(turnIdx + 1, plan.length);
    rt?.send({ k: 'a', idx: turnIdx, by: role, next });
    setDraftA('');
    setTurnIdx(next);
  }

  function checkResults() {
    const mine = {};
    exchangesRef.current.forEach((e, i) => {
      if (e && e.answeredMine && typeof e.answer === 'string') mine[i] = e.answer;
    });
    pendingReveal.current = mine;
    rt?.send({ k: 'reveal', answers: mine });
    tryFinishReveal();
  }

  const partnerName = names[role === 'A' ? 'B' : 'A'];
  const answeredCount = exchanges.filter(e => e && (e.answeredMine || e.answerHidden)).length;
  const allAnswered = answeredCount >= plan.length;

  return (
    <div className="fb-page fb-embedded">
      {phase === 'topic' && (
        <div className="fb-setup">
          <h3>Pick your topic</h3>
          <p className="fb-sub">Choose what you'll talk about. Either of you can lock it in.</p>
          <div className="fb-suggest">
            {TOPICS.map(tp => (
              <button key={tp}
                className={'fb-chip' + (topic === tp ? ' on' : '')}
                onClick={() => setTopic(tp)}>{tp}</button>
            ))}
          </div>
          <div className="fb-custom">
            <input value={customTopic} maxLength={70}
              placeholder="or type your own topic…"
              onChange={e => setCustomTopic(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') lockTopic(); }} />
          </div>
          <button className="btn warm" onClick={lockTopic} disabled={!topic && !customTopic.trim()}>
            Lock topic
          </button>
        </div>
      )}

      {phase === 'traps' && (
        <div className="fb-setup">
          <div className="fb-topicbanner">Topic: <b>{topic}</b></div>
          <h3>Set 3 traps for {partnerName}</h3>
          <p className="fb-sub">
            3 words {partnerName} can't say in their answers. They'll see their own list while playing —
            you won't see theirs until the reveal.
          </p>
          <div className="fb-chosen">
            {[0, 1, 2].map(i => (
              <div key={i} className={'fb-slot' + (picks[i] ? ' filled' : '')}>
                {picks[i] || `word ${i + 1}`}
              </div>
            ))}
          </div>
          <div className="fb-suggest">
            {SUGGESTIONS.map(w => (
              <button key={w}
                className={'fb-chip' + (picks.includes(w) ? ' on' : '')}
                onClick={() => togglePick(w)}
                disabled={!picks.includes(w) && picks.length >= 3}>{w}</button>
            ))}
          </div>
          <div className="fb-custom">
            <input value={customWord} maxLength={20}
              placeholder="or type your own…"
              onChange={e => setCustomWord(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addCustom(); }} />
            <button className="btn small" onClick={addCustom} disabled={picks.length >= 3}>Add</button>
          </div>
          <button className="btn warm" onClick={submitPicks} disabled={cleanForbidden(picks).length !== 3}>
            Lock in {partnerName}'s forbidden words
          </button>
        </div>
      )}

      {phase === 'wait' && (
        <div className="fb-wait">
          <div className="fb-check">{iSubmitted ? '\u2713' : '\u2026'} you set {partnerName}'s words</div>
          <div className="fb-check">{theySubmitted ? '\u2713' : '\u2026'} {partnerName} is setting yours</div>
          <p className="fb-sub">the Q&amp;A starts once you're both done…</p>
        </div>
      )}

      {phase === 'play' && (
        <div className="fb-play">
          <div className="fb-topicbanner">Topic: <b>{topic}</b></div>
          {myWords.length === 3 && (
            <div className="fb-mywords">
              <div className="fb-mywords-label">Your forbidden words — don't say these</div>
              <div className="fb-mywords-row">
                {myWords.map(w => <span key={w} className="fb-myword">{w}</span>)}
              </div>
            </div>
          )}
          <div className="fb-progress">
            {plan.map((p, i) => (
              <span key={i} className={'fb-dot' + (i < turnIdx ? ' done' : i === turnIdx ? ' now' : '')} />
            ))}
          </div>

          <div className="fb-qalist">
            {plan.map((p, i) => {
              const e = exchanges[i] || {};
              return (
                <div key={i} className={'fb-qa' + (i === turnIdx ? ' active' : '')}>
                  <div className="fb-qa-head">
                    <span className="fb-qa-no">Q{p.qNo}</span>
                    <span className={p.asker === 'A' ? 'pA' : 'pB'}>{names[p.asker]} asks {names[p.answerer]}</span>
                  </div>
                  {e.question
                    ? <div className="fb-qa-q">{e.question}</div>
                    : <div className="fb-qa-q dim">waiting for the question…</div>}
                  {e.question && (e.answeredMine
                    ? <div className="fb-qa-a mine">your answer is in {'\u{1F512}'}</div>
                    : e.answerHidden
                      ? <div className="fb-qa-a locked">{names[p.answerer]} answered {'\u{1F512}'}</div>
                      : null)}
                </div>
              );
            })}
          </div>

          {turnIdx < plan.length && (
            <div className="fb-action">
              {iAsk && (
                <div className="fb-inputrow">
                  <input value={draftQ} autoFocus
                    placeholder={`Ask ${partnerName} a question about "${topic}"`}
                    onChange={e => setDraftQ(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') sendQuestion(); }} />
                  <button className="btn warm small" onClick={sendQuestion} disabled={!draftQ.trim()}>Ask</button>
                </div>
              )}
              {iAnswer && (
                <div className="fb-answerbox">
                  <div className="fb-answer-q">{exchanges[turnIdx].question}</div>
                  <textarea value={draftA} autoFocus rows={3}
                    placeholder={`Answer in at least ${MIN_WORDS} words…`}
                    onChange={e => setDraftA(e.target.value)} />
                  <div className="fb-answer-foot">
                    <span className={'fb-wc' + (wordCount(draftA) >= MIN_WORDS ? ' ok' : '')}>
                      {wordCount(draftA)}/{MIN_WORDS} words
                    </span>
                    <button className="btn warm small" onClick={sendAnswer} disabled={wordCount(draftA) < MIN_WORDS}>
                      Send answer
                    </button>
                  </div>
                </div>
              )}
              {!iAsk && !iAnswer && (
                <div className="fb-waitturn">
                  {cur && !exchanges[turnIdx]?.question
                    ? `${names[cur.asker]} is asking…`
                    : `${names[cur.answerer]} is answering…`}
                </div>
              )}
            </div>
          )}

          {allAnswered && (
            <button className="btn warm fb-check-btn" onClick={checkResults}>Check results</button>
          )}
        </div>
      )}

      {phase === 'done' && result && (
        <div className="fb-done">
          <div className="fb-winline">
            {result.w === 'draw' ? 'A perfect tie!' : `${result.w === 'A' ? names.A : names.B} wins!`}
          </div>
          <div className="fb-final">
            {names.A} said {result.totalA} forbidden {result.totalA === 1 ? 'word' : 'words'} ·
            {' '}{names.B} said {result.totalB} (fewer wins{result.totalA === result.totalB ? '; tie broken by who stayed clean longer' : ''})
          </div>
          <div className="fb-reveal">
            <div className="fb-reveal-col">
              <div className="fb-reveal-h pA">{names.A}'s forbidden words</div>
              <div className="fb-reveal-words">
                {(result.wordsA || []).map(w => <span key={w}>{w}</span>)}
              </div>
            </div>
            <div className="fb-reveal-col">
              <div className="fb-reveal-h pB">{names.B}'s forbidden words</div>
              <div className="fb-reveal-words">
                {(result.wordsB || []).map(w => <span key={w}>{w}</span>)}
              </div>
            </div>
          </div>
          <div className="fb-transcript">
            {result.scored.map((m, i) => (
              <div key={i} className="fb-tr">
                <div className="fb-tr-head">
                  <span className="fb-qa-no">Q{m.qNo}</span>
                  <span className={m.asker === 'A' ? 'pA' : 'pB'}>{names[m.asker]} → {names[m.answerer]}</span>
                  {m.slips.length > 0 && <span className="fb-slip-tag">{'\u26A0\uFE0F'} {m.slips.map(w => `"${w}"`).join(', ')}</span>}
                </div>
                <div className="fb-tr-q">{m.question}</div>
                <div className={'fb-tr-a' + (m.slips.length ? ' slipped' : '')}>{m.answer}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
