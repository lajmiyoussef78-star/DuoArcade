// src/pages/NumberFortress.jsx — bid on your brain (mounted by numberfortress engine).
// Shell already ran ready + countdown. Host seeds questions; both bid in secret.

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  START_BUDGET, ROUNDS, MIN_BID, MAX_BID, ANSWER_SECONDS,
  TOPICS, pickQuestions, decideWinner
} from '../lib/numberfortress.js';
import '../styles/numberfortress.css';

export default function NumberFortress({ myRole, names = {}, rt, onComplete }) {
  const role = myRole;
  const partnerRole = role === 'A' ? 'B' : 'A';
  const partnerName = names[partnerRole] || 'Partner';
  const myName = names[role] || 'You';

  const [phase, setPhase] = useState('wait'); // wait | bid | answer | reveal | over
  const [round, setRound] = useState(0);
  const [questions, setQuestions] = useState([]);
  const [budgets, setBudgets] = useState({ A: START_BUDGET, B: START_BUDGET });
  const [bids, setBids] = useState({});       // { A, B }
  const [answers, setAnswers] = useState({}); // { A, B }
  const [myBid, setMyBid] = useState(15);
  const [picked, setPicked] = useState(null);
  const [timeLeft, setTimeLeft] = useState(ANSWER_SECONDS);
  const [readyNext, setReadyNext] = useState({}); // { A, B }
  const [lastDelta, setLastDelta] = useState(null);

  const startedRef = useRef(false);
  const finishedRef = useRef(false);
  const appliedRef = useRef(new Set());
  const timerRef = useRef(null);
  const stateRef = useRef({});
  stateRef.current = { phase, round, bids, answers, budgets, questions, picked, readyNext };

  const q = questions[round];

  const begin = useCallback((seed) => {
    if (startedRef.current) return;
    startedRef.current = true;
    setQuestions(pickQuestions(seed));
    setRound(0);
    setBudgets({ A: START_BUDGET, B: START_BUDGET });
    setBids({});
    setAnswers({});
    setPicked(null);
    setMyBid(15);
    setReadyNext({});
    setLastDelta(null);
    appliedRef.current = new Set();
    setPhase('bid');
  }, []);

  useEffect(() => {
    if (!rt?.on) return;
    rt.on(m => {
      if (!m || !m.k) return;
      if (m.k === 'start') begin(m.seed);
      else if (m.k === 'bid') {
        if (m.by === role) return;
        if (m.round !== stateRef.current.round) return;
        setBids(b => ({ ...b, [m.by]: m.amount }));
      } else if (m.k === 'answer') {
        if (m.by === role) return;
        if (m.round !== stateRef.current.round) return;
        setAnswers(a => ({ ...a, [m.by]: m.choice }));
      } else if (m.k === 'ready') {
        if (m.by === role) return;
        if (m.round !== stateRef.current.round) return;
        setReadyNext(r => ({ ...r, [m.by]: true }));
      }
    });
  }, [rt, role, begin]);

  useEffect(() => {
    if (role !== 'A') {
      const t = setTimeout(() => {
        if (!startedRef.current) begin(`fallback-${Date.now()}`);
      }, 900);
      return () => clearTimeout(t);
    }
    const seed = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
    rt?.send({ k: 'start', seed });
    begin(seed);
  }, [role, rt, begin]);

  const lockBid = () => {
    const mine = budgets[role];
    const capped = Math.min(Math.max(myBid, Math.min(MIN_BID, mine)), Math.min(MAX_BID, mine));
    setBids(b => ({ ...b, [role]: capped }));
    rt?.send({ k: 'bid', round, amount: capped, by: role });
  };

  useEffect(() => {
    if (phase === 'bid' && bids.A != null && bids.B != null) {
      setPhase('answer');
      setTimeLeft(ANSWER_SECONDS);
    }
  }, [phase, bids]);

  const submitAnswer = useCallback((choice) => {
    if (stateRef.current.answers[role] != null) return;
    setPicked(choice);
    setAnswers(a => ({ ...a, [role]: choice }));
    rt?.send({ k: 'answer', round: stateRef.current.round, choice, by: role });
  }, [role, rt]);

  useEffect(() => {
    if (phase !== 'answer') {
      clearInterval(timerRef.current);
      return undefined;
    }
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          if (stateRef.current.answers[role] == null) submitAnswer(-1);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase, round, role, submitAnswer]);

  useEffect(() => {
    if (phase !== 'answer' || answers.A == null || answers.B == null) return;
    const key = String(round);
    if (!appliedRef.current.has(key)) {
      appliedRef.current.add(key);
      const correct = questions[round]?.a;
      const dA = answers.A === correct ? bids.A : -bids.A;
      const dB = answers.B === correct ? bids.B : -bids.B;
      setLastDelta({ A: dA, B: dB });
      setBudgets(b => ({
        A: Math.max(0, b.A + dA),
        B: Math.max(0, b.B + dB)
      }));
    }
    clearInterval(timerRef.current);
    setPhase('reveal');
  }, [phase, answers, bids, questions, round]);

  const sendReady = () => {
    setReadyNext(r => ({ ...r, [role]: true }));
    rt?.send({ k: 'ready', round, by: role });
  };

  useEffect(() => {
    if (phase !== 'reveal') return;
    if (!readyNext.A || !readyNext.B) return;
    const nextBudgets = stateRef.current.budgets;
    if (round + 1 >= ROUNDS || (nextBudgets.A === 0 && nextBudgets.B === 0)) {
      const w = decideWinner(nextBudgets.A, nextBudgets.B);
      setPhase('over');
      if (role === 'A' && !finishedRef.current) {
        finishedRef.current = true;
        onComplete?.(w);
      }
    } else {
      setRound(r => r + 1);
      setBids({});
      setAnswers({});
      setPicked(null);
      setMyBid(15);
      setReadyNext({});
      setLastDelta(null);
      setPhase('bid');
    }
  }, [phase, readyNext, round, role, onComplete]);

  const myBudget = budgets[role];
  const theirBudget = budgets[partnerRole];
  const maxBid = Math.min(MAX_BID, Math.max(myBudget, 1));
  const minBid = Math.min(MIN_BID, Math.max(myBudget, 1));
  const stars = (d) => '★'.repeat(d) + '☆'.repeat(5 - d);
  const correct = q?.a;

  const Fortress = ({ label, value, delta, mine }) => (
    <div className={`nf-fort${mine ? ' nf-fort-mine' : ''}`}>
      <div className="nf-fort-label">{label}</div>
      <div className="nf-fort-value">
        {value}
        {delta != null && (
          <span className={`nf-delta ${delta >= 0 ? 'nf-up' : 'nf-down'}`}>
            {delta >= 0 ? `+${delta}` : delta}
          </span>
        )}
      </div>
      <div className="nf-fort-bar">
        <div className="nf-fort-fill" style={{ width: `${Math.min(100, (value / START_BUDGET) * 100)}%` }} />
      </div>
    </div>
  );

  if (phase === 'wait') {
    return (
      <div className="nf-root">
        <div className="nf-wait">Building the fortress…</div>
      </div>
    );
  }

  return (
    <div className="nf-root">
      <div className="nf-top">
        <Fortress
          label={myName}
          value={myBudget}
          delta={phase === 'reveal' ? lastDelta?.[role] : null}
          mine
        />
        <div className="nf-round">
          <div className="nf-round-n">{phase === 'over' ? '—' : `${round + 1}/${ROUNDS}`}</div>
          <div className="nf-round-l">round</div>
        </div>
        <Fortress
          label={partnerName}
          value={theirBudget}
          delta={phase === 'reveal' ? lastDelta?.[partnerRole] : null}
        />
      </div>

      {phase === 'bid' && q && (
        <div className="nf-center">
          <div className="nf-topic-chip">{TOPICS[q.t]}</div>
          <div className="nf-stars" aria-label={`Difficulty ${q.d} of 5`}>{stars(q.d)}</div>
          <div className="nf-sub">
            How confident are you? The question stays hidden until both of you lock a bid.
          </div>
          {bids[role] == null ? (
            <>
              <div className="nf-bid-value">{Math.min(myBid, myBudget)} pts</div>
              <input
                type="range"
                className="nf-slider"
                min={minBid}
                max={maxBid}
                step={1}
                value={Math.min(myBid, maxBid)}
                onChange={(e) => setMyBid(Number(e.target.value))}
              />
              <div className="nf-slider-scale"><span>{minBid}</span><span>{maxBid}</span></div>
              <button type="button" className="nf-btn" onClick={lockBid}>Lock bid</button>
            </>
          ) : (
            <div className="nf-wait">
              Bid locked ({bids[role]} pts). Waiting for {partnerName}
              <span className="nf-dots"><i>.</i><i>.</i><i>.</i></span>
            </div>
          )}
        </div>
      )}

      {phase === 'answer' && q && (
        <div className="nf-center">
          <div className="nf-timerbar">
            <div className="nf-timerfill" style={{ width: `${(timeLeft / ANSWER_SECONDS) * 100}%` }} />
          </div>
          <div className="nf-question">{q.q}</div>
          <div className="nf-opts">
            {q.o.map((opt, i) => (
              <button
                key={i}
                type="button"
                className={`nf-opt${picked === i ? ' nf-opt-picked' : ''}`}
                disabled={answers[role] != null}
                onClick={() => submitAnswer(i)}
              >
                {opt}
              </button>
            ))}
          </div>
          {answers[role] != null && answers[partnerRole] == null && (
            <div className="nf-wait-sm">Answer locked — {partnerName} is still thinking…</div>
          )}
        </div>
      )}

      {phase === 'reveal' && q && (
        <div className="nf-center">
          <div className="nf-question nf-question-sm">{q.q}</div>
          <div className="nf-opts">
            {q.o.map((opt, i) => {
              const cls =
                i === correct ? 'nf-opt-correct'
                  : (i === answers.A || i === answers.B) ? 'nf-opt-wrong'
                    : '';
              return (
                <div key={i} className={`nf-opt nf-opt-static ${cls}`}>
                  {opt}
                  <span className="nf-tags">
                    {answers[role] === i && <em>you</em>}
                    {answers[partnerRole] === i && <em>{partnerName}</em>}
                  </span>
                </div>
              );
            })}
          </div>
          {answers[role] === -1 && <div className="nf-wait-sm">You ran out of time</div>}
          <div className="nf-reveal-line">
            <span className={lastDelta?.[role] >= 0 ? 'nf-up' : 'nf-down'}>
              You {lastDelta?.[role] >= 0 ? 'won' : 'lost'} {Math.abs(lastDelta?.[role] ?? 0)}
            </span>
            {' · '}
            <span className={lastDelta?.[partnerRole] >= 0 ? 'nf-up' : 'nf-down'}>
              {partnerName} {lastDelta?.[partnerRole] >= 0 ? 'won' : 'lost'} {Math.abs(lastDelta?.[partnerRole] ?? 0)}
            </span>
          </div>
          {!readyNext[role] ? (
            <button type="button" className="nf-btn" onClick={sendReady}>
              {round + 1 >= ROUNDS ? 'See results' : 'Next round'}
            </button>
          ) : (
            <div className="nf-wait-sm">Waiting for {partnerName}…</div>
          )}
        </div>
      )}

      {phase === 'over' && (
        <div className="nf-center">
          <div className="nf-title">
            {budgets.A === budgets.B
              ? 'A perfectly balanced duo'
              : budgets[role] > budgets[partnerRole]
                ? 'Your fortress stands'
                : `${partnerName} takes it`}
          </div>
          <div className="nf-final">{budgets.A} — {budgets.B}</div>
          <div className="nf-sub">
            {budgets.A === budgets.B
              ? 'Same score after 10 rounds of bidding — that\'s rare.'
              : budgets[role] > budgets[partnerRole]
                ? 'Well bid. Knowing what you don\'t know is the real skill.'
                : 'Overconfidence tax collected. Try again from the shelf.'}
          </div>
        </div>
      )}
    </div>
  );
}
