// src/pages/Coup.jsx — Coup: Köln Edition (mounted by the coup engine).
// Lockstep: every decision is broadcast as a move and BOTH clients apply
// the identical pure reducer. Opponent cards render face-down.

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  initialState, applyMove, ROLES, ROLE_IDS, ACTIONS
} from '../lib/coup.js';
import '../styles/coup.css';

const ORDER = ['income', 'aid', 'business', 'steal', 'peek', 'exchange', 'assassinate', 'accuse', 'coup'];
const EMOJI = {
  income: '\u{1FA99}', aid: '\u{1F91D}', business: '\u{1F4BC}', steal: '\u{1F9B9}',
  peek: '\u{1F575}\uFE0F', exchange: '\u{1F3AD}', assassinate: '\u{1F5E1}\uFE0F',
  accuse: '\u{1F396}\uFE0F', coup: '\u{1F4A5}'
};

const seedByCode = new Map();

export default function Coup({ myRole, names = {}, rt, code, onComplete }) {
  const me = myRole;
  const opp = me === 'A' ? 'B' : 'A';

  const [st, setSt] = useState(null);
  const [accusePick, setAccusePick] = useState(false);
  const [keepPick, setKeepPick] = useState([]);
  const [showLog, setShowLog] = useState(false);

  const stRef = useRef(null);
  const meRef = useRef(me);
  const seedRef = useRef(null);
  const startedRef = useRef(false);
  const finishedRef = useRef(false);
  meRef.current = me;

  const begin = useCallback((seed) => {
    if (seed == null || startedRef.current) return;
    startedRef.current = true;
    const n = seed >>> 0;
    seedRef.current = n;
    if (code) seedByCode.set(code, n);
    finishedRef.current = false;
    const s0 = initialState(n);
    stRef.current = s0;
    setSt(s0);
    setAccusePick(false);
    setKeepPick([]);
  }, [code]);

  const afterState = useCallback((s) => {
    setAccusePick(false);
    setKeepPick([]);
    if (s.phase === 'over' && s.winner && !finishedRef.current) {
      finishedRef.current = true;
      if (meRef.current === 'A') onComplete?.(s.winner);
    }
  }, [onComplete]);

  const dispatch = useCallback((move) => {
    const next = applyMove(stRef.current, move, meRef.current);
    if (next.error) { setSt({ ...next }); return; }
    stRef.current = next;
    setSt(next);
    rt?.send({ k: 'move', move, by: meRef.current });
    setTimeout(() => rt?.send({ k: 'move', move, by: meRef.current }), 180);
    afterState(next);
  }, [rt, afterState]);

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
      if (m.k === 'move') {
        if (m.by === me || !stRef.current) return;
        const next = applyMove(stRef.current, m.move, m.by);
        if (next.error) return;
        stRef.current = next;
        setSt(next);
        afterState(next);
      }
    });
  }, [rt, me, begin, afterState]);

  useEffect(() => {
    if (me === 'A') {
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
    const ask = () => { if (!startedRef.current) rt?.send({ k: 'needstart' }); };
    ask();
    const iv = setInterval(ask, 700);
    return () => clearInterval(iv);
  }, [me, rt, begin, code]);

  if (!st) {
    return <div className="cp-shell"><p className="cp-status">Shuffling the court…</p></div>;
  }

  const nm = { A: names.A || 'A', B: names.B || 'B' };

  return (
    <div className="cp-shell">
      <div className="cp-table">
        <PlayerZone st={st} p={opp} me={me} names={nm} top />

        <div className="cp-middle">
          <div className="cp-deck">
            <div className="cp-deckstack">{'\u{1F0A0}'}</div>
            <div className="cp-deckcount">{st.deck.length} in deck</div>
          </div>
          <div className="cp-event">
            {st.log[st.log.length - 1]
              ?.replaceAll('A ', nm.A + ' ')
              .replaceAll('B ', nm.B + ' ')
              .replace(/^A(?=')/, nm.A)
              .replace(/^B(?=')/, nm.B)}
          </div>
          <button type="button" className="cp-logbtn" onClick={() => setShowLog(v => !v)}>
            {showLog ? 'hide log' : 'log'}
          </button>
        </div>

        {showLog && (
          <div className="cp-log">
            {st.log.slice(-14).map((l, i) => (
              <div key={i}>{l.replaceAll('A ', nm.A + ' ').replaceAll('B ', nm.B + ' ')}</div>
            ))}
          </div>
        )}

        {st.peeks[me] && (
          <div className="cp-peek">
            {'\u{1F575}\uFE0F'} you inspected: their card #{st.peeks[me].idx + 1} is{' '}
            <b>{ROLES[st.peeks[me].role].emoji} {ROLES[st.peeks[me].role].name}</b>
            <span className="cp-peek-note">(only you can see this — it may change if they exchange)</span>
          </div>
        )}

        <PlayerZone st={st} p={me} me={me} names={nm} />

        <Prompt
          st={st} me={me} opp={opp} names={nm}
          dispatch={dispatch}
          accusePick={accusePick} setAccusePick={setAccusePick}
          keepPick={keepPick} setKeepPick={setKeepPick}
        />

        {st.error && <div className="cp-err">{st.error}</div>}
      </div>
    </div>
  );
}

function PlayerZone({ st, p, me, names, top }) {
  const mine = p === me;
  const active = st.turn === p && st.phase !== 'over';
  return (
    <div className={'cp-zone' + (active ? ' active' : '') + (top ? ' top' : '')}>
      <div className="cp-zone-head">
        <span className={'cp-zone-name ' + (p === 'A' ? 'pA' : 'pB')}>
          {names[p]}{mine ? ' (you)' : ''}
        </span>
        <span className="cp-zone-coins">{'\u{1FA99}'} {st.coins[p]}</span>
      </div>
      <div className="cp-cards">
        {st.hands[p].map((c, i) => (
          <div
            key={i}
            className={'cp-card' + (c.dead ? ' dead' : mine ? ' face' : ' back')}
          >
            {c.dead ? (
              <>
                <span className="cp-card-emoji">{ROLES[c.role].emoji}</span>
                <span className="cp-card-name">{ROLES[c.role].name}</span>
                <span className="cp-card-dead">eliminated</span>
              </>
            ) : mine ? (
              <>
                <span className="cp-card-emoji">{ROLES[c.role].emoji}</span>
                <span className="cp-card-name">{ROLES[c.role].name}</span>
              </>
            ) : (
              <span className="cp-card-back-mark">{'\u2666'}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Prompt({ st, me, opp, names, dispatch, accusePick, setAccusePick, keepPick, setKeepPick }) {
  if (st.phase === 'over') return null;
  const pd = st.pending;

  if (st.phase === 'action') {
    if (st.turn !== me) return <div className="cp-wait">{names[opp]} is plotting…</div>;
    const mustCoup = st.coins[me] >= 10;
    if (accusePick) {
      return (
        <div className="cp-panel">
          <div className="cp-panel-title">Accuse them of holding…</div>
          <div className="cp-rolegrid">
            {ROLE_IDS.map(r => (
              <button
                key={r}
                type="button"
                className="cp-rolebtn"
                onClick={() => dispatch({ t: 'action', action: 'accuse', accuseRole: r })}
              >
                {ROLES[r].emoji} {ROLES[r].name}
              </button>
            ))}
          </div>
          <button type="button" className="btn small ghost" onClick={() => setAccusePick(false)}>cancel</button>
        </div>
      );
    }
    return (
      <div className="cp-panel">
        <div className="cp-panel-title">
          Your move{mustCoup ? ' \u2014 10+ coins: you MUST coup' : ''}
        </div>
        <div className="cp-actiongrid">
          {ORDER.map(a => {
            const A = ACTIONS[a];
            const off = mustCoup ? a !== 'coup' : A.cost > st.coins[me];
            return (
              <button
                key={a}
                type="button"
                className={'cp-actbtn' + (a === 'coup' ? ' danger' : '')}
                disabled={off}
                onClick={() => (a === 'accuse' ? setAccusePick(true) : dispatch({ t: 'action', action: a }))}
              >
                <span className="cp-act-emoji">{EMOJI[a]}</span>
                <span className="cp-act-name">{A.name}</span>
                <span className="cp-act-sub">
                  {A.cost ? `pay ${A.cost}` : ''}
                  {A.claim ? `${A.cost ? ' \u00b7 ' : ''}as ${ROLES[A.claim].name}` : ''}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (st.phase === 'challenge') {
    if (pd.by === me) {
      return <div className="cp-wait">waiting — will {names[opp]} believe your {ROLES[pd.claim].name}?</div>;
    }
    return (
      <div className="cp-panel hot">
        <div className="cp-panel-title">
          {names[pd.by]} claims {ROLES[pd.claim].emoji} <b>{ROLES[pd.claim].name}</b>
          {pd.action === 'accuse'
            ? ` to accuse you of ${ROLES[pd.accuseRole].name}`
            : ` (${ACTIONS[pd.action].name})`}
        </div>
        <div className="cp-btnrow">
          <button type="button" className="btn warm" onClick={() => dispatch({ t: 'challenge' })}>Challenge!</button>
          <button type="button" className="btn ghost" onClick={() => dispatch({ t: 'allow' })}>Believe it</button>
        </div>
      </div>
    );
  }

  if (st.phase === 'block') {
    if (pd.by === me) return <div className="cp-wait">waiting — will {names[opp]} block?</div>;
    const a = ACTIONS[pd.action];
    return (
      <div className="cp-panel hot">
        <div className="cp-panel-title">{names[pd.by]}&apos;s {a.name} is coming at you</div>
        <div className="cp-btnrow">
          {a.blockedBy.map(r => (
            <button
              key={r}
              type="button"
              className="btn warm"
              onClick={() => dispatch({ t: 'block', role: r })}
            >
              Block as {ROLES[r].emoji} {ROLES[r].name}
            </button>
          ))}
          <button type="button" className="btn ghost" onClick={() => dispatch({ t: 'blockPass' })}>Let it happen</button>
        </div>
      </div>
    );
  }

  if (st.phase === 'blockChallenge') {
    if (pd.blocker === me) return <div className="cp-wait">waiting — will they believe your block?</div>;
    return (
      <div className="cp-panel hot">
        <div className="cp-panel-title">
          {names[pd.blocker]} blocks with {ROLES[pd.blockRole].emoji} <b>{ROLES[pd.blockRole].name}</b>
        </div>
        <div className="cp-btnrow">
          <button type="button" className="btn warm" onClick={() => dispatch({ t: 'blockChallenge' })}>Challenge the block!</button>
          <button type="button" className="btn ghost" onClick={() => dispatch({ t: 'blockAllow' })}>Accept it</button>
        </div>
      </div>
    );
  }

  if (st.phase === 'skim') {
    if (pd.opp !== me) return <div className="cp-wait">waiting — will the Taxman come for your deal?</div>;
    return (
      <div className="cp-panel">
        <div className="cp-panel-title">{names[pd.by]} just made +4. Skim 1 as the Taxman?</div>
        <div className="cp-btnrow">
          <button type="button" className="btn warm" onClick={() => dispatch({ t: 'skim' })}>{'\u{1F9FE}'} Skim 1</button>
          <button type="button" className="btn ghost" onClick={() => dispatch({ t: 'skimPass' })}>Let it go</button>
        </div>
      </div>
    );
  }

  if (st.phase === 'skimChallenge') {
    if (pd.by !== me) return <div className="cp-wait">waiting — will they believe your Taxman?</div>;
    return (
      <div className="cp-panel hot">
        <div className="cp-panel-title">{names[pd.opp]} claims Taxman to skim your deal</div>
        <div className="cp-btnrow">
          <button type="button" className="btn warm" onClick={() => dispatch({ t: 'skimChallenge' })}>Challenge!</button>
          <button type="button" className="btn ghost" onClick={() => dispatch({ t: 'skimAllow' })}>Pay the 1</button>
        </div>
      </div>
    );
  }

  if (st.phase === 'lose') {
    const who = st.loseQueue[0];
    if (who !== me) return <div className="cp-wait">{names[who]} is choosing a card to lose…</div>;
    return (
      <div className="cp-panel hot">
        <div className="cp-panel-title">Choose which influence to lose</div>
        <div className="cp-btnrow">
          {st.hands[me].map((c, i) => !c.dead && (
            <button key={i} type="button" className="btn warm" onClick={() => dispatch({ t: 'pickLose', idx: i })}>
              {ROLES[c.role].emoji} {ROLES[c.role].name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (st.phase === 'exchange') {
    if (pd.by !== me) return <div className="cp-wait">{names[opp]} is exchanging with the deck…</div>;
    const mine = st.hands[me].map((c, i) => ({ ...c, tag: 'hand' })).filter(c => !c.dead);
    const pool = [...mine, ...pd.drawn.map(r => ({ role: r, tag: 'drawn' }))];
    const need = mine.length;
    const toggle = i => setKeepPick(k => (
      k.includes(i) ? k.filter(x => x !== i) : (k.length < need ? [...k, i] : k)
    ));
    return (
      <div className="cp-panel">
        <div className="cp-panel-title">Keep {need} — the rest go UNDER the deck (in this order)</div>
        <div className="cp-btnrow wrap">
          {pool.map((c, i) => (
            <button
              key={i}
              type="button"
              className={'cp-poolbtn' + (keepPick.includes(i) ? ' on' : '')}
              onClick={() => toggle(i)}
            >
              {ROLES[c.role].emoji} {ROLES[c.role].name}
              <span className="cp-pool-tag">{c.tag === 'drawn' ? 'drawn' : 'yours'}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn warm"
          disabled={keepPick.length !== need}
          onClick={() => dispatch({ t: 'exchangeKeep', keep: keepPick })}
        >
          Confirm exchange
        </button>
      </div>
    );
  }

  return null;
}
