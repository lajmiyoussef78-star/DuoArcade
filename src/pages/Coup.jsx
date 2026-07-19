// src/pages/Coup.jsx — Veilcourt (mounted by the coup engine).
// Lockstep reducer; opponent cards face-down. A reference icon opens the
// character ability sheet.

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  initialState, applyMove, ROLES, ROLE_IDS, ACTIONS, CORRUPTION_COST, TAX_RICH_AT
} from '../lib/coup.js';
import { RoleArt, CoinArt } from '../arcade/VeilcourtIcons.jsx';
import '../styles/coup.css';

function CoinIcon({ size = 'md' }) {
  return (
    <span className={`cp-coin size-${size}`} aria-hidden="true">
      <CoinArt />
    </span>
  );
}

function CoinStack({ count = 1, size = 'md' }) {
  return (
    <span className={`cp-coinstack n-${count}`} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <CoinIcon key={i} size={size} />
      ))}
    </span>
  );
}

function ActionGlyph({ action }) {
  if (action === 'income') return <CoinStack count={1} size="md" />;
  if (action === 'aid') return <CoinStack count={2} size="sm" />;
  if (action === 'coup') return <span className="cp-act-emoji" aria-hidden="true">!</span>;
  return <CoinIcon size="md" />;
}

const ORDER = [
  'income', 'aid', 'business', 'steal', 'peek', 'exchange',
  'assassinate', 'accuse', 'tax', 'coup'
];

const seedByCode = new Map();

/** Ability sheet — character reference (your turn / other turns). */
const SHEET = [
  {
    id: null,
    name: 'All characters',
    your: [
      'Wage: take 1 coin.',
      'Governmental aid: take 2 coins.',
      'Exposition: pay 7 to kill a character.'
    ],
    other: [
      'Corruption: pay 9 coins to be spared.'
    ]
  },
  {
    id: 'businessman',
    your: ['Takes 4 coins from the central bank.'],
    other: []
  },
  {
    id: 'assassin',
    your: ['Pays 3 coins and assassinates a character.'],
    other: []
  },
  {
    id: 'ambassador',
    your: ['Exchanges cards with others from the deck.'],
    other: []
  },
  {
    id: 'thief',
    your: ['Steals 2 coins from another player.'],
    other: ['Blocks theft.']
  },
  {
    id: 'colonel',
    your: [
      'Pays 4 and accuses a player of a character.',
      'If true: they lose a life.',
      'If false: they take the 4 coins.'
    ],
    other: ['Blocks terrorist.']
  },
  {
    id: 'taxman',
    your: ['Taxes 1 coin from any player with 7 or more coins.'],
    other: [
      'Taxes the Businesswoman 1 on her deal.',
      'Blocks governmental aid.'
    ]
  },
  {
    id: 'policeman',
    your: ['Looks at a player’s card and chooses keep or change.'],
    other: ['Blocks other cops.']
  }
];

function AbilityList({ items, className }) {
  if (!items?.length) {
    return <div className={className}><span className="cp-sheet-empty">—</span></div>;
  }
  return (
    <ul className={'cp-sheet-list ' + className}>
      {items.map((line, i) => (
        <li key={i} className="cp-sheet-ability">
          <span className="cp-sheet-bullet" aria-hidden="true">•</span>
          <span className="cp-sheet-ability-text">{line}</span>
        </li>
      ))}
    </ul>
  );
}

export function RoleIcon({ roleId, size = 'md', title, variant }) {
  const r = roleId ? ROLES[roleId] : null;
  const color = r?.color || 'var(--candle)';
  const label = title || r?.name || 'All characters';
  return (
    <span
      className={`cp-roleicon size-${size}` + (variant === 'all' ? ' cp-roleicon-all' : '')}
      style={{ '--role': color, '--role-ink': '#1a1424', color: '#f7f2ea' }}
      title={label}
      aria-label={label}
    >
      <RoleArt roleId={variant === 'all' ? '__all' : roleId} />
    </span>
  );
}

function CharactersIcon() {
  return (
    <svg className="cp-chars-svg" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="3.5" width="8" height="8" rx="1.8" fill="currentColor" opacity=".95" />
      <rect x="13" y="3.5" width="8" height="8" rx="1.8" fill="currentColor" opacity=".7" />
      <rect x="3" y="12.5" width="8" height="8" rx="1.8" fill="currentColor" opacity=".7" />
      <rect x="13" y="12.5" width="8" height="8" rx="1.8" fill="currentColor" opacity=".45" />
    </svg>
  );
}

/** Term → character card color (actions use their claim role’s color). */
const EVENT_HL_COLOR = (() => {
  const map = Object.create(null);
  for (const id of ROLE_IDS) map[ROLES[id].name] = ROLES[id].color;
  for (const a of Object.values(ACTIONS)) {
    map[a.name] = a.claim ? ROLES[a.claim].color : 'var(--candle)';
  }
  return map;
})();

const EVENT_HL_TERMS = Object.keys(EVENT_HL_COLOR).sort((a, b) => b.length - a.length);

const EVENT_HL_RE = new RegExp(
  `(${EVENT_HL_TERMS.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
  'g'
);

/** Swap A/B seat letters for display names in log lines. */
function withNames(line, nm) {
  if (!line) return '';
  return line
    .replaceAll('A ', nm.A + ' ')
    .replaceAll('B ', nm.B + ' ')
    .replace(/^A(?=')/, nm.A)
    .replace(/^B(?=')/, nm.B);
}

/** Old → "X claims Role and declares Action." */
function modernizeClaimLine(line) {
  if (!line) return '';
  return line.replace(
    /^(.+?) declares (.+?) \(claims (.+?)\)(\s*\u2192\s*"[^"]*")?\.$/,
    (_, who, act, role, accuse) => `${who} claims ${role} and declares ${act}${accuse || ''}.`
  );
}

function formatEventLine(line, nm) {
  return modernizeClaimLine(withNames(line, nm));
}

/** Live claim line from pending (beats a stale log entry). */
function liveClaimLine(st, nm) {
  const pd = st.pending;
  if (!pd?.claim || !pd?.action || !ACTIONS[pd.action]) return null;
  if (st.phase !== 'challenge' && st.phase !== 'block' && st.phase !== 'blockChallenge') return null;
  const who = nm[pd.by] || pd.by;
  const role = ROLES[pd.claim].name;
  const act = ACTIONS[pd.action].name;
  const accuse = pd.accuseRole ? ` \u2192 "${ROLES[pd.accuseRole].name}"` : '';
  return `${who} claims ${role} and declares ${act}${accuse}.`;
}

/** Highlight action + character names in that card’s color. */
function EventText({ text }) {
  if (!text) return null;
  const parts = text.split(EVENT_HL_RE);
  return (
    <>
      {parts.map((part, i) => {
        const color = EVENT_HL_COLOR[part];
        return color
          ? <span key={i} className="cp-event-hl" style={{ color }}>{part}</span>
          : <span key={i}>{part}</span>;
      })}
    </>
  );
}

function RoleTone({ roleId, children, className = 'cp-event-hl' }) {
  const color = roleId ? ROLES[roleId]?.color : 'var(--candle)';
  return <span className={className} style={{ color }}>{children}</span>;
}

/** Face-down influence card. */
function CardBack() {
  return (
    <div className="cp-card-backface" aria-hidden="true">
      <span className="cp-card-back-corner tl" />
      <span className="cp-card-back-corner tr" />
      <span className="cp-card-back-corner bl" />
      <span className="cp-card-back-corner br" />
      <div className="cp-card-back-medallion">
        <span className="cp-card-back-mark">V</span>
      </div>
      <span className="cp-card-back-label">Veilcourt</span>
    </div>
  );
}

function AbilitySheet({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="cp-sheet-backdrop" role="dialog" aria-modal="true" aria-label="Character abilities" onClick={onClose}>
      <div className="cp-sheet" onClick={e => e.stopPropagation()}>
        <div className="cp-sheet-top">
          <h3 className="cp-sheet-title">Veilcourt</h3>
          <button type="button" className="cp-sheet-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="cp-sheet-head">
          <span className="cp-sheet-h-char">Character</span>
          <span className="cp-sheet-h-your">Your turn</span>
          <span className="cp-sheet-h-other">Other turns</span>
        </div>
        <div className="cp-sheet-rows">
          {SHEET.map(row => (
            <div key={row.id || 'all'} className={'cp-sheet-row' + (row.id ? '' : ' general')}>
              <div className="cp-sheet-char">
                {row.id
                  ? <RoleIcon roleId={row.id} size="sm" />
                  : <RoleIcon variant="all" size="sm" title="All characters" />}
                <span className="cp-sheet-char-name">{row.id ? ROLES[row.id].name : row.name}</span>
              </div>
              <AbilityList items={row.your} className="cp-sheet-your" />
              <AbilityList items={row.other} className="cp-sheet-other" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Coup({ myRole, names = {}, rt, code, onComplete }) {
  const me = myRole;
  const opp = me === 'A' ? 'B' : 'A';

  const [st, setSt] = useState(null);
  const [accusePick, setAccusePick] = useState(false);
  const [keepPick, setKeepPick] = useState([]);
  const [showSheet, setShowSheet] = useState(false);

  const stRef = useRef(null);
  const meRef = useRef(me);
  const seedRef = useRef(null);
  const startedRef = useRef(false);
  const finishedRef = useRef(false);
  const pendingSnapRef = useRef(null);
  meRef.current = me;

  const afterState = useCallback((s) => {
    setAccusePick(false);
    setKeepPick([]);
    if (s.phase === 'over' && s.winner && !finishedRef.current) {
      finishedRef.current = true;
      if (meRef.current === 'A') onComplete?.(s.winner);
    }
  }, [onComplete]);

  /** Push full board so both clients share one timeline. */
  const publishSnap = useCallback((next) => {
    if (!rt?.send || !next) return;
    const state = { ...next };
    delete state.error;
    const payload = { k: 'snap', seq: state.seq || 0, by: meRef.current, state };
    rt.send(payload);
    setTimeout(() => rt.send(payload), 100);
    setTimeout(() => rt.send(payload), 320);
  }, [rt]);

  const adoptSnap = useCallback((remote) => {
    if (!remote || typeof remote !== 'object') return false;
    const remoteSeq = remote.seq || 0;
    const localSeq = stRef.current?.seq || 0;
    if (stRef.current && remoteSeq <= localSeq) return false;
    const clean = { ...remote };
    delete clean.error;
    stRef.current = clean;
    setSt(clean);
    afterState(clean);
    return true;
  }, [afterState]);

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
    // Catch up if partner already played while we were joining
    const buffered = pendingSnapRef.current;
    pendingSnapRef.current = null;
    if (buffered && (buffered.seq || 0) > 0) adoptSnap(buffered);
  }, [code, adoptSnap]);

  const dispatch = useCallback((move) => {
    if (!stRef.current) return;
    const next = applyMove(stRef.current, move, meRef.current);
    if (next.error) { setSt({ ...next }); return; }
    stRef.current = next;
    setSt(next);
    publishSnap(next);
    afterState(next);
  }, [publishSnap, afterState]);

  useEffect(() => {
    if (!rt?.on) return undefined;
    rt.on(m => {
      if (!m?.k) return;

      if (m.k === 'needstart' || m.k === 'needsync') {
        if (me === 'A' && seedRef.current != null) {
          if (m.k === 'needstart') rt.send({ k: 'start', seed: seedRef.current });
          if (stRef.current) publishSnap(stRef.current);
        }
        return;
      }

      if (m.k === 'start') {
        begin(m.seed);
        return;
      }

      // Authoritative board snapshot — both players converge on the same state
      if (m.k === 'snap') {
        if (m.by === me || !m.state) return;
        if (!stRef.current) {
          pendingSnapRef.current = m.state;
          return;
        }
        adoptSnap(m.state);
        return;
      }

      // Legacy move replay (older clients / missed snap)
      if (m.k === 'move') {
        if (m.by === me || !stRef.current || !m.move) return;
        const next = applyMove(stRef.current, m.move, m.by);
        if (next.error) return;
        stRef.current = next;
        setSt(next);
        afterState(next);
      }
    });
  }, [rt, me, begin, adoptSnap, publishSnap, afterState]);

  useEffect(() => {
    if (me === 'A') {
      let seed = (code && seedByCode.get(code)) || seedRef.current;
      if (seed == null) {
        seed = ((Date.now() ^ (Math.random() * 0xFFFFFFFF)) >>> 0);
        if (code) seedByCode.set(code, seed);
      }
      seedRef.current = seed;
      const push = () => {
        rt?.send({ k: 'start', seed });
        if (stRef.current) publishSnap(stRef.current);
      };
      begin(seed);
      push();
      const t1 = setTimeout(push, 400);
      const t2 = setTimeout(push, 1200);
      // Heartbeat so a late / flaky partner resyncs mid-match
      const hb = setInterval(() => {
        if (stRef.current && stRef.current.phase !== 'over') publishSnap(stRef.current);
      }, 2500);
      return () => { clearTimeout(t1); clearTimeout(t2); clearInterval(hb); };
    }
    rt?.send({ k: 'needstart' });
    const joinIv = setInterval(() => {
      if (!startedRef.current) rt?.send({ k: 'needstart' });
    }, 700);
    const syncIv = setInterval(() => {
      if (startedRef.current) rt?.send({ k: 'needsync' });
    }, 3000);
    return () => { clearInterval(joinIv); clearInterval(syncIv); };
  }, [me, rt, begin, code, publishSnap]);

  if (!st) {
    return <div className="cp-shell"><p className="cp-status">Veilcourt is dealing…</p></div>;
  }

  const nm = { A: names.A || 'A', B: names.B || 'B' };
  const myTurn = st.phase === 'action' && st.turn === me;
  const needsResponse = isMyResponse(st, me);
  const lastLine = liveClaimLine(st, nm) || formatEventLine(st.log[st.log.length - 1], nm);

  return (
    <div className="cp-shell">
      <div className="cp-table">
        <div className="cp-board">
          <div className="cp-toolbar">
            <div className="cp-brand">Veilcourt</div>
            <button
              type="button"
              className={'cp-chars-btn' + (showSheet ? ' on' : '')}
              onClick={() => setShowSheet(v => !v)}
              title="Character abilities"
              aria-label="Character abilities"
              aria-expanded={showSheet}
            >
              <CharactersIcon />
            </button>
          </div>

          <PlayerZone st={st} p={opp} me={me} names={nm} top />

          <div className="cp-stage">
            <div className="cp-deck">
              <div className="cp-deckstack" aria-hidden="true">
                <div className="cp-deck-layer"><CardBack /></div>
                <div className="cp-deck-layer"><CardBack /></div>
                <div className="cp-deck-layer"><CardBack /></div>
              </div>
              <div className="cp-deckcount">{st.deck.length}</div>
            </div>

            {needsResponse ? (
              <ResponseStage
                st={st} me={me} names={nm}
                dispatch={dispatch}
                keepPick={keepPick} setKeepPick={setKeepPick}
              />
            ) : (
              <div className={'cp-center' + (myTurn ? ' my-turn' : '')}>
                {lastLine ? (
                  <p className="cp-event"><EventText text={lastLine} /></p>
                ) : null}
                {!myTurn && st.phase !== 'over' && (
                  <p className="cp-wait-chip">
                    {st.phase === 'action' ? `${nm[opp]}’s turn` : 'Waiting for their response'}
                  </p>
                )}
                {myTurn && !accusePick && (
                  <p className="cp-turn-chip">Your turn, pick an action below</p>
                )}
              </div>
            )}
          </div>

          {st.peeks[me] && (
            <div className="cp-peek">
              <RoleIcon roleId="policeman" size="sm" />
              <span>
                Card #{st.peeks[me].idx + 1}:{' '}
                <b>{ROLES[st.peeks[me].role].name}</b>
              </span>
            </div>
          )}

          <PlayerZone st={st} p={me} me={me} names={nm} />

          {st.error && <div className="cp-err">{st.error}</div>}
        </div>

        {/* Action options only when it is your turn to act */}
        {myTurn && (
          <ActionDock
            st={st} me={me} opp={opp}
            dispatch={dispatch}
            accusePick={accusePick} setAccusePick={setAccusePick}
          />
        )}
      </div>

      <AbilitySheet open={showSheet} onClose={() => setShowSheet(false)} />
    </div>
  );
}

function isPlayerResponding(st, p) {
  const pd = st.pending;
  switch (st.phase) {
    case 'challenge': return pd?.by !== p;
    case 'block': return pd?.by !== p;
    case 'blockChallenge': return pd?.blocker !== p;
    case 'skim': return pd?.opp === p;
    case 'skimChallenge': return pd?.by === p;
    case 'corrupt': return st.loseQueue[0] === p;
    case 'lose': return st.loseQueue[0] === p;
    case 'copChoice': return pd?.by === p;
    case 'exchange': return pd?.by === p;
    default: return false;
  }
}

function isMyResponse(st, me) {
  return isPlayerResponding(st, me);
}

function PlayerZone({ st, p, me, names, top }) {
  const mine = p === me;
  const active = st.phase !== 'over' && (
    (st.phase === 'action' && st.turn === p) || isPlayerResponding(st, p)
  );
  return (
    <div className={'cp-zone' + (active ? ' active' : '') + (top ? ' top' : '')}>
      <div className="cp-zone-head">
        <span className={'cp-zone-name ' + (p === 'A' ? 'pA' : 'pB')}>
          {names[p]}{mine ? ' (you)' : ''}
        </span>
        <span className="cp-zone-coins">
          <CoinIcon size="sm" />
          <span>{st.coins[p]}</span>
        </span>
      </div>
      <div className="cp-cards">
        {st.hands[p].map((c, i) => (
          <div
            key={i}
            className={'cp-card' + (c.dead ? ' dead' : mine ? ' face' : ' back')}
            style={mine && !c.dead ? { '--role': ROLES[c.role].color } : undefined}
          >
            {c.dead ? (
              <>
                <RoleIcon roleId={c.role} />
                <span className="cp-card-name">{ROLES[c.role].name}</span>
                <span className="cp-card-dead">eliminated</span>
              </>
            ) : mine ? (
              <>
                <RoleIcon roleId={c.role} />
                <span className="cp-card-name">{ROLES[c.role].name}</span>
              </>
            ) : (
              <CardBack />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Action choices — only mounted when it is your turn to act. */
function ActionDock({ st, me, opp, dispatch, accusePick, setAccusePick }) {
  const mustCoup = st.coins[me] >= 10;

  if (accusePick) {
    return (
      <div className="cp-dock">
        <div className="cp-dock-title">Accuse them of holding…</div>
        <div className="cp-rolegrid">
          {ROLE_IDS.map(r => (
            <button
              key={r}
              type="button"
              className="cp-rolebtn"
              onClick={() => dispatch({ t: 'action', action: 'accuse', accuseRole: r })}
            >
              <RoleIcon roleId={r} size="sm" /> {ROLES[r].name}
            </button>
          ))}
        </div>
        <button type="button" className="btn small ghost" onClick={() => setAccusePick(false)}>cancel</button>
      </div>
    );
  }

  return (
    <div className="cp-dock">
      <div className="cp-dock-title">
        Your move{mustCoup ? ' — 10+ coins: you MUST Exposition' : ''}
      </div>
      <div className="cp-actiongrid">
        {ORDER.map(a => {
          const A = ACTIONS[a];
          const richBlock = a === 'tax' && st.coins[opp] < TAX_RICH_AT;
          const off = mustCoup ? a !== 'coup' : (A.cost > st.coins[me] || richBlock);
          const honest = A.claim && st.hands[me].some(c => !c.dead && c.role === A.claim);
          const tone = honest ? ROLES[A.claim].color : undefined;
          return (
            <button
              key={a}
              type="button"
              className={
                'cp-actbtn'
                + (a === 'coup' ? ' danger' : '')
                + (honest ? ' honest' : '')
              }
              style={tone ? { '--honest': tone } : undefined}
              disabled={off}
              title={honest ? 'You hold this — no bluff needed' : undefined}
              onClick={() => (a === 'accuse' ? setAccusePick(true) : dispatch({ t: 'action', action: a }))}
            >
              {A.claim
                ? <RoleIcon roleId={A.claim} size="sm" />
                : <ActionGlyph action={a} />}
              <span className="cp-act-name">{A.name}</span>
              <span className="cp-act-sub">
                {A.cost ? `pay ${A.cost}` : ''}
                {A.claim ? `${A.cost ? ' · ' : ''}as ${ROLES[A.claim].name}` : ''}
                {a === 'tax' ? ` · ${TAX_RICH_AT}+` : ''}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Center-table response UI when you must react to the opponent. */
function ResponseStage({ st, me, names, dispatch, keepPick, setKeepPick }) {
  const pd = st.pending;

  const shell = (eyebrow, title, body, hot = true) => (
    <div className={'cp-response' + (hot ? ' hot' : '')} role="dialog" aria-live="polite">
      {eyebrow && <p className="cp-response-eye">{eyebrow}</p>}
      <div className="cp-response-title">{title}</div>
      <div className="cp-response-acts">{body}</div>
    </div>
  );

  if (st.phase === 'challenge') {
    return shell(
      'Respond',
      <>
        {names[pd.by]} claims <RoleIcon roleId={pd.claim} size="sm" />{' '}
        <RoleTone roleId={pd.claim}><b>{ROLES[pd.claim].name}</b></RoleTone>
        {' '}and declares{' '}
        <RoleTone roleId={pd.claim}><b>{ACTIONS[pd.action].name}</b></RoleTone>
        {pd.action === 'accuse' ? (
          <> → &quot;<RoleTone roleId={pd.accuseRole}>{ROLES[pd.accuseRole].name}</RoleTone>&quot;</>
        ) : null}
      </>,
      <>
        <button type="button" className="cp-resp-primary" onClick={() => dispatch({ t: 'challenge' })}>
          Challenge
        </button>
        <button type="button" className="cp-resp-soft" onClick={() => dispatch({ t: 'allow' })}>
          Believe it
        </button>
      </>
    );
  }

  if (st.phase === 'block') {
    const a = ACTIONS[pd.action];
    return shell(
      'Defend',
      <>{names[pd.by]}&apos;s <b>{a.name}</b> is coming at you</>,
      <>
        {a.blockedBy.map(r => (
          <button
            key={r}
            type="button"
            className="cp-resp-primary"
            onClick={() => dispatch({ t: 'block', role: r })}
          >
            Block as <RoleIcon roleId={r} size="sm" /> {ROLES[r].name}
          </button>
        ))}
        <button type="button" className="cp-resp-soft" onClick={() => dispatch({ t: 'blockPass' })}>
          Let it happen
        </button>
      </>
    );
  }

  if (st.phase === 'blockChallenge') {
    return shell(
      'Respond',
      <>
        {names[pd.blocker]} blocks with <RoleIcon roleId={pd.blockRole} size="sm" />{' '}
        <b>{ROLES[pd.blockRole].name}</b>
      </>,
      <>
        <button type="button" className="cp-resp-primary" onClick={() => dispatch({ t: 'blockChallenge' })}>
          Challenge the block
        </button>
        <button type="button" className="cp-resp-soft" onClick={() => dispatch({ t: 'blockAllow' })}>
          Accept it
        </button>
      </>
    );
  }

  if (st.phase === 'skim') {
    return shell(
      'Taxman?',
      <>{names[pd.by]} just took +4. Tax them for 1?</>,
      <>
        <button type="button" className="cp-resp-primary" onClick={() => dispatch({ t: 'skim' })}>
          <RoleIcon roleId="taxman" size="sm" /> Tax 1
        </button>
        <button type="button" className="cp-resp-soft" onClick={() => dispatch({ t: 'skimPass' })}>
          Let it go
        </button>
      </>
    );
  }

  if (st.phase === 'skimChallenge') {
    return shell(
      'Respond',
      <>{names[pd.opp]} claims Taxman to skim your deal</>,
      <>
        <button type="button" className="cp-resp-primary" onClick={() => dispatch({ t: 'skimChallenge' })}>
          Challenge
        </button>
        <button type="button" className="cp-resp-soft" onClick={() => dispatch({ t: 'skimAllow' })}>
          Pay the 1
        </button>
      </>
    );
  }

  if (st.phase === 'corrupt') {
    return shell(
      'Corruption',
      <>Pay {CORRUPTION_COST} coins to be spared?</>,
      <>
        <button type="button" className="cp-resp-primary" onClick={() => dispatch({ t: 'corrupt' })}>
          Pay {CORRUPTION_COST} — survive
        </button>
        <button type="button" className="cp-resp-soft" onClick={() => dispatch({ t: 'refuseCorrupt' })}>
          Lose a card
        </button>
      </>
    );
  }

  if (st.phase === 'lose') {
    return shell(
      'Lose influence',
      <>Choose which character to reveal</>,
      <>
        {st.hands[me].map((c, i) => !c.dead && (
          <button
            key={i}
            type="button"
            className="cp-resp-primary"
            onClick={() => dispatch({ t: 'pickLose', idx: i })}
          >
            <RoleIcon roleId={c.role} size="sm" /> {ROLES[c.role].name}
          </button>
        ))}
      </>
    );
  }

  if (st.phase === 'copChoice') {
    return shell(
      'Cop',
      <>
        You saw <RoleIcon roleId={pd.role} size="sm" /> <b>{ROLES[pd.role].name}</b>
      </>,
      <>
        <button type="button" className="cp-resp-primary" onClick={() => dispatch({ t: 'copKeep' })}>
          Keep it
        </button>
        <button type="button" className="cp-resp-soft" onClick={() => dispatch({ t: 'copSwap' })}>
          Change (under deck)
        </button>
      </>
    );
  }

  if (st.phase === 'exchange') {
    const mine = st.hands[me].map((c, i) => ({ ...c, tag: 'hand' })).filter(c => !c.dead);
    const pool = [...mine, ...pd.drawn.map(r => ({ role: r, tag: 'drawn' }))];
    const need = mine.length;
    const toggle = i => setKeepPick(k => (
      k.includes(i) ? k.filter(x => x !== i) : (k.length < need ? [...k, i] : k)
    ));
    return shell(
      'Exchange',
      <>Keep {need} — the rest go under the deck</>,
      <div className="cp-exchange">
        <div className="cp-btnrow wrap">
          {pool.map((c, i) => (
            <button
              key={i}
              type="button"
              className={'cp-poolbtn' + (keepPick.includes(i) ? ' on' : '')}
              onClick={() => toggle(i)}
            >
              <RoleIcon roleId={c.role} size="sm" /> {ROLES[c.role].name}
              <span className="cp-pool-tag">{c.tag === 'drawn' ? 'drawn' : 'yours'}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className="cp-resp-primary"
          disabled={keepPick.length !== need}
          onClick={() => dispatch({ t: 'exchangeKeep', keep: keepPick })}
        >
          Confirm exchange
        </button>
      </div>,
      false
    );
  }

  return null;
}
