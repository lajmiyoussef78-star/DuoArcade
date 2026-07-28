// src/pages/Chkobba.jsx — Chkobba (mounted by the chkobba engine).
//
// Full court table layout (same design language as Veilcourt): opponent
// zone, center stage with felt + deck, your zone, action dock.
// Lockstep moves over the shell RT channel.

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  initialState, applyMove, legalCaptures, faceOf, faceName, SUITS, DEFAULT_TARGET, TARGETS
} from '../lib/chkobba.js';
import '../styles/chkobba-table.css';
import '../styles/chkobba.css';

const seedByCode = new Map();

function resolveTarget(t) {
  return TARGETS.includes(t) ? t : null;
}

/** Wikimedia Chkobba SVGs in /public/chkobba-cards */
const SUIT_FILE = {
  hearts: 'coeur',
  diamonds: 'carreau',
  clubs: 'trefle',
  spades: 'pique'
};
const CARD_ART = '/chkobba-cards';
function cardFaceSrc(c) {
  if (!c) return null;
  const suit = SUIT_FILE[c.s];
  if (!suit) return null;
  const n = String(c.v).padStart(2, '0');
  return `${CARD_ART}/Chkobba_${suit}_${n}.svg`;
}
const CARD_BACK_SRC = `${CARD_ART}/Chkobba_dos.svg`;

export default function Chkobba({ myRole, names = {}, rt, code, onComplete, target, startedAt }) {
  const me = myRole;
  const opp = me === 'A' ? 'B' : 'A';
  const nm = { A: names.A || 'A', B: names.B || 'B' };
  const matchTarget = target || DEFAULT_TARGET;

  const [st, setSt] = useState(null);
  const [selHand, setSelHand] = useState(null);
  const [selTable, setSelTable] = useState([]);

  const stRef = useRef(null);
  const meRef = useRef(me);
  const seedRef = useRef(null);
  const startedRef = useRef(false);
  const finishedRef = useRef(false);
  const stSeqRef = useRef(0);
  const lastStSeqRef = useRef(-1);
  const pendingMovesRef = useRef([]);
  meRef.current = me;

  const commit = useCallback((next) => {
    stRef.current = next;
    setSt(next);
    setSelHand(null);
    setSelTable([]);
    if (next.phase === 'over' && next.winner && !finishedRef.current) {
      finishedRef.current = true;
      if (meRef.current === 'A') onComplete?.(next.winner);
    }
  }, [onComplete]);

  /** Host → both: authoritative full state so table/hands never diverge. */
  const pushSt = useCallback((force = false) => {
    const cur = stRef.current;
    if (!cur || meRef.current !== 'A') return;
    stSeqRef.current += 1;
    const msg = {
      k: 'st',
      seq: stSeqRef.current,
      seed: seedRef.current,
      target: cur.target || matchTarget,
      st: JSON.parse(JSON.stringify(cur))
    };
    const send = () => rt?.send(msg);
    send();
    if (force) {
      setTimeout(send, 120);
      setTimeout(send, 400);
    }
  }, [rt, matchTarget]);

  const begin = useCallback((seed, tgt) => {
    if (seed == null) return;
    const n = seed >>> 0;
    // Dedup identical start; allow a new seed (rematch / late resync).
    if (startedRef.current && seedRef.current === n && stRef.current) return;
    startedRef.current = true;
    seedRef.current = n;
    if (code) seedByCode.set(code, n);
    finishedRef.current = false;
    lastStSeqRef.current = -1;
    stSeqRef.current = 0;
    const useTarget = resolveTarget(tgt) || matchTarget;
    commit(initialState(n, { target: useTarget }));

    // Replay any moves that arrived before start (guest joined mid-cut).
    const queued = pendingMovesRef.current.splice(0);
    for (const m of queued) {
      if (!m?.move || m.by === meRef.current || !stRef.current) continue;
      const next = applyMove(stRef.current, m.move, m.by);
      if (!next.error) commit(next);
    }
  }, [code, commit, matchTarget]);

  const dispatch = useCallback((move, broadcast = true) => {
    const cur = stRef.current;
    if (!cur) return;
    const next = applyMove(cur, move, meRef.current);
    if (next.error) { setSt({ ...next }); return; }
    commit(next);
    if (broadcast) {
      const payload = { k: 'move', move, by: meRef.current, seed: seedRef.current };
      rt?.send(payload);
      setTimeout(() => rt?.send(payload), 180);
    }
    // Host always pushes the post-move table so both see the same deal.
    if (meRef.current === 'A') pushSt(true);
  }, [rt, commit, pushSt]);

  useEffect(() => {
    if (!rt?.on) return undefined;
    rt.on(m => {
      if (!m?.k) return;

      if (m.k === 'needstart') {
        if (me === 'A' && seedRef.current != null) {
          rt.send({
            k: 'start',
            seed: seedRef.current,
            target: stRef.current?.target || matchTarget
          });
          if (stRef.current) pushSt(true);
        }
        return;
      }

      if (m.k === 'start') {
        begin(m.seed, m.target);
        return;
      }

      if (m.k === 'st') {
        if (me === 'A' || !m.st || typeof m.seq !== 'number') return;
        if (m.seq <= lastStSeqRef.current) return;
        lastStSeqRef.current = m.seq;
        if (m.seed != null) seedRef.current = m.seed >>> 0;
        startedRef.current = true;
        pendingMovesRef.current = [];
        commit(m.st);
        return;
      }

      if (m.k === 'move') {
        if (m.by === me) return;
        if (!stRef.current || !m.move) {
          // Guest not ready yet — queue until begin()/st arrives.
          pendingMovesRef.current.push(m);
          return;
        }
        // Prefer host snapshots; still apply peer moves for the cutter (often B).
        const next = applyMove(stRef.current, m.move, m.by);
        if (!next.error) {
          commit(next);
          if (me === 'A') pushSt(true);
        }
      }
    });
  }, [rt, me, begin, commit, pushSt, matchTarget]);

  useEffect(() => {
    if (me === 'A') {
      // Fresh seed each match mount (startedAt changes on rematch).
      const key = `${code || 'local'}:${startedAt || 0}`;
      let seed = seedByCode.get(key);
      if (seed == null) {
        seed = ((Date.now() ^ (Math.random() * 0xFFFFFFFF)) >>> 0);
        seedByCode.set(key, seed);
      }
      seedRef.current = seed;
      const push = () => rt?.send({
        k: 'start',
        seed,
        target: matchTarget
      });
      push();
      begin(seed, matchTarget);
      pushSt(true);
      const t1 = setTimeout(push, 400);
      const t2 = setTimeout(() => { push(); pushSt(true); }, 1200);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    const ask = () => {
      if (!startedRef.current || !stRef.current) rt?.send({ k: 'needstart' });
    };
    ask();
    const iv = setInterval(ask, 700);
    return () => clearInterval(iv);
  }, [me, rt, begin, code, matchTarget, startedAt, pushSt]);

  function tapHand(i) {
    if (!st || st.phase !== 'play' || st.turn !== me) return;
    setSelHand(h => (h === i ? null : i));
    setSelTable([]);
  }
  function tapTable(i) {
    if (selHand == null) return;
    setSelTable(sel => sel.includes(i) ? sel.filter(x => x !== i) : [...sel, i]);
  }

  if (!st) {
    return <div className="ck-shell"><p className="ck-status">Chkobba is dealing…</p></div>;
  }

  const table = st.table || [];
  const myHand = st.hands?.[me] || [];
  const myTurn = st.phase === 'play' && st.turn === me;
  const selCard = selHand != null ? myHand[selHand] : null;
  const legal = selCard ? legalCaptures(selCard.v, table) : [];
  const captureValid = selCard && selTable.length > 0 && legal.some(
    o => o.length === selTable.length && o.every(x => selTable.includes(x))
  );
  // Capturing is optional — empty take always lays the card.
  const canLay = !!selCard;
  const showDock = myTurn && selHand != null;
  const lastLine = st.log?.[st.log.length - 1] || '';
  const toWin = st.target || matchTarget;

  return (
    <div className="ck-shell">
      <div className="ck-court">
        <div className="ck-toolbar">
          <div className={'ck-opp-label' + ((st.phase === 'play' && st.turn === opp) || (st.phase === 'cut' && st.cutter === opp) ? ' active' : '')}>
            <span className={'ck-zone-name ' + (opp === 'A' ? 'pA' : 'pB')}>
              {nm[opp]}
              {st.dealer === opp ? ' · dealer' : ''}
              {st.phase === 'cut' && st.cutter === opp ? ' · cutter' : ''}
            </span>
          </div>
          <div className="ck-brand">Chkobba</div>
          <div className="ck-scorepill" title={`First to ${toWin}`}>
            <span className="pA">{st.totals.A}</span>
            <span className="ck-scoresep">–</span>
            <span className="pB">{st.totals.B}</span>
            <span className="ck-score-target">/{toWin}</span>
          </div>
        </div>

        <OppRail st={st} p={opp} names={nm} hideName />

        <div className="ck-table">
          <div className="ck-baize">
            <svg className="ck-corner tl" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C9 8 3 10 3 15a5 5 0 0 0 8 4l-1 5h4l-1-5a5 5 0 0 0 8-4c0-5-6-7-9-13z" /></svg>
            <svg className="ck-corner tr" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1l8 11-8 11-8-11z" /></svg>
            <svg className="ck-corner bl" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a4.4 4.4 0 0 0-3.6 6.9A4.4 4.4 0 1 0 6 17.2h2.9L8 22h8l-.9-4.8H18a4.4 4.4 0 1 0-2.4-8.3A4.4 4.4 0 0 0 12 2z" /></svg>
            <svg className="ck-corner br" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21.5C6 16.8 3 13.2 3 9.4 3 6.4 5.3 4 8.2 4c1.6 0 3 .7 3.8 1.9C12.8 4.7 14.2 4 15.8 4 18.7 4 21 6.4 21 9.4c0 3.8-3 7.4-9 12.1z" /></svg>

            <div className={'ck-deck-rail' + (st.deck.length === 0 ? ' empty' : '')}>
              {st.deck.length > 0 && (
                <div className="ck-card ck-deck-card" aria-hidden="true">
                  <img src={CARD_BACK_SRC} alt="" draggable={false} />
                </div>
              )}
              <span className="ck-deckcount">{st.deck.length}</span>
            </div>

            <div className={'ck-baize-center' + (myTurn ? ' my-turn' : '')}>
              {st.phase === 'cut' && (
                st.cutter === me ? (
                  <div className="ck-cutpanel">
                    <p className="ck-event">You cut — keep it or lay it on the table</p>
                    <Card c={st.cutCard} />
                    <p className="ck-cut-note">
                      Keep → you get 2 more (3 total). Lay → it starts the table of 4.
                    </p>
                  </div>
                ) : (
                  <p className="ck-wait-chip">{nm[opp]} is cutting the deck…</p>
                )
              )}

              {st.phase !== 'cut' && st.phase !== 'roundEnd' && st.phase !== 'over' && (
                <>
                  <div className="ck-slots">
                    {table.length === 0 && <div className="ck-slot-ghost" aria-hidden="true" />}
                    {table.map((c, i) => (
                      <Card
                        key={`${c.s}-${c.v}-${i}`}
                        c={c}
                        selectable={selHand != null}
                        selected={selTable.includes(i)}
                        onClick={() => tapTable(i)}
                      />
                    ))}
                  </div>
                  {lastLine ? <p className="ck-event">{lastLine}</p> : null}
                  {!myTurn && <p className="ck-wait-chip">{nm[opp]}&apos;s turn</p>}
                  {myTurn && selHand == null && (
                    <p className="ck-turn-chip">Your turn — play one card</p>
                  )}
                </>
              )}

              {st.phase === 'roundEnd' && st.lastRound && (
                <RoundScore sc={st.lastRound} names={nm} totals={st.totals} />
              )}
              {st.phase === 'over' && (
                <div className="ck-over">
                  {st.lastRound && <RoundScore sc={st.lastRound} names={nm} totals={st.totals} final />}
                  <div className="ck-winline">{nm[st.winner]} wins {st.totals.A}–{st.totals.B}!</div>
                </div>
              )}
            </div>

            {/* Matches deck column width so table cards stay on the green’s true center */}
            <div className="ck-baize-spacer" aria-hidden="true" />

            {st.phase === 'play' && (
              <div className="ck-hand">
                {myHand.map((c, i) => (
                  <Card
                    key={`${c.s}-${c.v}-${i}`}
                    c={c}
                    selectable={!!myTurn}
                    selected={selHand === i}
                    lifted={selHand === i}
                    onClick={() => tapHand(i)}
                    fan={handFanStyle(i, myHand.length)}
                  />
                ))}
              </div>
            )}
          </div>

          {showDock && (
            <div className="ck-dock ck-dock-wood">
              {legal.length === 0 ? (
                <button
                  type="button"
                  className="btn warm ck-dock-btn"
                  disabled={!canLay}
                  onClick={() => dispatch({ t: 'play', idx: selHand, take: [] })}
                >
                  Lay it on the table
                </button>
              ) : (
                <div className="ck-btnrow">
                  <button
                    type="button"
                    className="btn warm ck-dock-btn"
                    disabled={!captureValid}
                    onClick={() => dispatch({ t: 'play', idx: selHand, take: selTable })}
                  >
                    Eat {selTable.length ? `(${selTable.length})` : ''}
                  </button>
                  <button
                    type="button"
                    className="btn ghost ck-dock-btn"
                    onClick={() => dispatch({ t: 'play', idx: selHand, take: [] })}
                  >
                    Lay instead
                  </button>
                </div>
              )}
            </div>
          )}

          {st.phase === 'cut' && st.cutter === me && (
            <div className="ck-dock ck-dock-wood">
              <div className="ck-btnrow">
                <button type="button" className="btn warm ck-dock-btn" onClick={() => dispatch({ t: 'cutKeep' })}>Keep it</button>
                <button type="button" className="btn ghost ck-dock-btn" onClick={() => dispatch({ t: 'cutPass' })}>Lay it down</button>
              </div>
            </div>
          )}

          {st.phase === 'roundEnd' && (
            <div className="ck-dock ck-dock-wood">
              <button type="button" className="btn warm ck-dock-btn" onClick={() => dispatch({ t: 'nextRound' })}>
                Next hand
              </button>
            </div>
          )}

          <div className="ck-cap-row">
            <CapturePile caps={st.caps[opp]} label={nm[opp]} />
            <CapturePile caps={st.caps[me]} label={nm[me]} mine />
          </div>

          <svg className="ck-cup" viewBox="0 0 120 96" aria-hidden="true">
            <ellipse cx="60" cy="76" rx="52" ry="15" fill="#EFEAE0" />
            <ellipse cx="60" cy="73" rx="52" ry="15" fill="#FBF8F2" />
            <ellipse cx="60" cy="73" rx="38" ry="10" fill="#E6DFD2" />
            <path d="M92 44c9-3 16 2 15 9s-9 11-17 9" fill="none" stroke="#FBF8F2" strokeWidth="7" strokeLinecap="round" />
            <path d="M28 38h64l-5 26a10 10 0 0 1-10 8H43a10 10 0 0 1-10-8z" fill="#FBF8F2" />
            <ellipse cx="60" cy="38" rx="32" ry="9" fill="#F2EDE4" />
            <ellipse cx="60" cy="38" rx="27" ry="7" fill="#3A2213" />
            <ellipse cx="56" cy="36.6" rx="12" ry="3" fill="#7A4B25" opacity=".55" />
          </svg>
        </div>

        {st.error && <div className="ck-err">{st.error}</div>}
      </div>
      <p className="ck-art-credit">
        Card art · Wikimedia Commons ·{' '}
        <a href="/chkobba-cards/ATTRIBUTION.md" target="_blank" rel="noreferrer">credits</a>
      </p>
    </div>
  );
}

function handFanStyle(i, n) {
  if (n <= 1) return { transform: 'rotate(0deg) translateY(-2px)' };
  /* Match original table fan: ~7° spread, slight dip on the wings */
  const spread = Math.min(14, 7 * (n - 1));
  const angle = -spread / 2 + (spread / (n - 1)) * i;
  const y = Math.abs(angle) > 1 ? 3 : -2;
  return { transform: `rotate(${angle}deg) translateY(${y}px)` };
}

function OppRail({ st, p, names, hideName }) {
  const active = st.phase === 'play' && st.turn === p;
  const cutting = st.phase === 'cut' && st.cutter === p;
  return (
    <div className={'ck-opp' + (active || cutting ? ' active' : '')}>
      {!hideName && (
        <span className={'ck-zone-name ' + (p === 'A' ? 'pA' : 'pB')}>
          {names[p]}
          {st.dealer === p ? ' · dealer' : ''}
          {cutting ? ' · cutter' : ''}
        </span>
      )}
      <div className="ck-opp-cards">
        {st.hands[p].map((_, i) => (
          <div key={i} className="ck-card" aria-hidden="true">
            <img src={CARD_BACK_SRC} alt="" draggable={false} />
          </div>
        ))}
        {st.hands[p].length === 0 && <span className="ck-hand-empty">empty</span>}
      </div>
    </div>
  );
}

/** Face-down capture stack; Chkobba sweep cards stay face-up. */
function CapturePile({ caps, label, mine }) {
  if (!caps?.length) return null;
  const faceDown = caps.filter(c => !c.chkobba);
  const faceUp = caps.filter(c => c.chkobba);
  const stackCount = faceDown.length;
  const showLayers = Math.min(stackCount, 4);

  return (
    <div className={'ck-cap-pile' + (mine ? ' mine' : '')} title={`${label}: ${caps.length} captured`}>
      <span className="ck-cap-label">{label}</span>
      <div className="ck-cap-stack" style={{ '--n': showLayers }}>
        {stackCount > 0 && Array.from({ length: showLayers }).map((_, i) => (
          <div
            key={`d-${i}`}
            className="ck-card ck-cap-layer"
            style={{ '--i': i }}
            aria-hidden={i < showLayers - 1}
          >
            <img src={CARD_BACK_SRC} alt="" draggable={false} />
          </div>
        ))}
        {stackCount > 4 && <span className="ck-cap-count">+{stackCount - 4}</span>}
      </div>
      {faceUp.length > 0 && (
        <div className="ck-cap-faceups">
          {faceUp.map((c, i) => (
            <div key={`u-${c.s}-${c.v}-${i}`} className="ck-cap-faceup">
              <Card c={c} />
              <span className="ck-cap-chk-tag">Chkobba</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Card({ c, selectable, selected, lifted, onClick, fan }) {
  if (!c) return null;
  const suit = SUITS[c.s];
  const src = cardFaceSrc(c);
  const label = `${faceName(c.v)} of ${suit?.name || c.s}`;
  return (
    <button
      type="button"
      className={
        'ck-card'
        + (selectable ? ' selectable' : '')
        + (selected ? ' selected' : '')
        + (lifted ? ' lifted' : '')
      }
      style={fan || undefined}
      onClick={onClick}
      disabled={!selectable}
      aria-label={label}
      title={label}
    >
      {src ? (
        <img src={src} alt="" draggable={false} />
      ) : (
        <span className="ck-card-fallback">{faceOf(c.v)}{suit?.symbol}</span>
      )}
    </button>
  );
}

function RoundScore({ sc, names, totals, final }) {
  return (
    <div className="ck-score">
      <div className="ck-score-title">{final ? 'Final hand' : 'Hand scored'}</div>
      <div className="ck-score-cols">
        {['A', 'B'].map(p => (
          <div key={p} className="ck-score-col">
            <div className={'ck-score-name ' + (p === 'A' ? 'pA' : 'pB')}>{names[p]} +{sc[p].total}</div>
            {sc[p].items.length
              ? sc[p].items.map(it => <div key={it} className="ck-score-item">{it}</div>)
              : <div className="ck-score-item none">—</div>}
          </div>
        ))}
      </div>
      {sc.beji.length > 0 && <div className="ck-beji">Bājī (tied): {sc.beji.join(', ')}</div>}
      <div className="ck-score-totals">{names.A} {totals.A} – {totals.B} {names.B}</div>
    </div>
  );
}
