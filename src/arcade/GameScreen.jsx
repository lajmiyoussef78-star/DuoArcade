import { useEffect, useRef, useState } from 'react';
import { ENGINES } from '../engines/index.js';
import { other } from '../lib/util.js';
import { getRules } from '../engines/rules.js';

function RulesIcon() {
  return (
    <svg className="gv-rules-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M3 3h8.2c1.1 0 2 .9 2 2v14.6L8 17.8 3 19.6V3Z"
        fill="currentColor" fillOpacity=".22" stroke="currentColor" strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M21 3h-8.2c-1.1 0-2 .9-2 2v14.6l5.2-2.1L21 19.6V3Z"
        fill="currentColor" fillOpacity=".22" stroke="currentColor" strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M7.5 7.5h9M7.5 11h9M7.5 14.5h6.5"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      />
    </svg>
  );
}

/** Turn-based boards keep the exact same DOM engine interface as before:
 *  eng.render(hostEl, gs, { myRole, turn, winner, onMove }) */
function TurnBoard({ eng, session, myRole, onMove, paused }) {
  const hostRef = useRef(null);
  useEffect(() => {
    eng.render(hostRef.current, session.gs, {
      myRole, turn: session.turn, winner: session.winner,
      onMove: paused ? () => {} : onMove
    });
  }, [eng, session, myRole, onMove, paused]);
  return <div ref={hostRef} className={paused ? 'gv-board-paused' : undefined} />;
}

/** Realtime engines mount once per match (game + startedAt) with a broadcast
 *  channel, exactly like the original shell. */
function RealtimeBoard({ eng, session, myRole, names, sync, code, onFinish, paused }) {
  const hostRef = useRef(null);
  const key = session.game + ':' + (session.startedAt || 0);
  useEffect(() => {
    const rt = sync.rt(code);
    eng.mount(hostRef.current, { myRole, rt, names, onFinish, code });
    return () => {
      try { eng.unmount(); } catch { /* engine already gone */ }
      try { rt.close(); } catch { /* channel already closed */ }
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    try { eng.setPaused?.(paused); } catch { /* optional */ }
  }, [eng, paused, key]);
  return (
    <div className={'gv-board-wrap' + (paused ? ' paused' : '')}>
      <div ref={hostRef} />
      {paused && <div className="gv-pause-overlay">Paused</div>}
    </div>
  );
}

export default function GameScreen({
  duo, code, myRole, isAway, sync,
  onMove, onReady, onRematch, onBack,
  onRequestPause, onRespondPause, onRealtimeFinish
}) {
  const s = duo.session;
  const eng = ENGINES[s.game];
  const [bannerStatus, setBannerStatus] = useState('');
  const [showRules, setShowRules] = useState(false);
  useEffect(() => { setShowRules(false); }, [s.game]);
  const [, forceTick] = useState(0);

  const counting = s.liveAt && Date.now() < s.liveAt && !s.winner;
  useEffect(() => {
    if (!counting) return;
    const t = setTimeout(() => forceTick(n => n + 1), 250);
    return () => clearTimeout(t);
  });

  if (!eng) return null;
  const rules = getRules(s.game);
  const rec = (duo.records || {})[s.game] || { a: 0, b: 0, d: 0 };
  const partnerRole = other(myRole);
  const partner = partnerRole === 'A' ? duo.nameA : duo.nameB;
  const paused = !!s.paused;
  const pausePending = s.pauseRequest;
  const canPause = !s.winner && (s.phase === 'live' || s.phase === 'lobby') && !counting;

  let board, banner = '', bannerClass = 'banner', showRematch = false;

  if (s.phase === 'invite' && s.by === myRole && !s.winner) {
    const pLinked = partnerRole === 'A' ? !!duo.memberA : !!duo.memberB;
    const pHere = !isAway(partnerRole);
    const sub = pHere
      ? 'They should see the invite popup on their screen now.'
      : pLinked
        ? `We'll pop it up as soon as ${partner} opens DuoArcade.`
        : `${partner} hasn't joined this duo yet — send the invite link from home first.`;
    board = (
      <div className="gv-panel gv-wait">
        <div className="gv-wait-ring" aria-hidden="true" />
        <h3 className="gv-wait-title">Waiting for {partner}</h3>
        <p className="gv-wait-sub">Invitation sent — hang tight while they accept.</p>
        <p className="gv-wait-hint">{sub}</p>
        <button className="btn ghost small" onClick={onBack}>Cancel invitation</button>
      </div>
    );
  } else if (s.phase === 'declined' && s.declinedBy !== myRole && !s.winner) {
    board = (
      <div className="gv-panel gv-wait">
        <h3 className="gv-wait-title">{partner} passed for now</h3>
        <p className="gv-wait-sub">Maybe try again later tonight.</p>
        <button className="btn small" onClick={onBack}>Back to the shelf</button>
      </div>
    );
  } else if (s.phase === 'lobby' && !s.winner) {
    board = (
      <div className="gv-panel gv-ready">
        <div className="ready-row">
          {['A', 'B'].map(role => (
            <div className="ready-pl" key={role}>
              <div className={'av ' + role + (isAway(role) ? ' away' : '')}>
                {(role === 'A' ? duo.nameA : duo.nameB)[0].toUpperCase()}
              </div>
              <div>{role === 'A' ? duo.nameA : duo.nameB}</div>
              <div className={'ready-check' + (s.ready?.[role] ? ' yes' : '')}>
                {s.ready?.[role] ? '✓ ready' : 'not ready'}
              </div>
            </div>
          ))}
        </div>
        <button className="btn warm" disabled={!!s.ready?.[myRole]} onClick={onReady}>
          {s.ready?.[myRole] ? 'Waiting for partner…' : "I'm ready"}
        </button>
      </div>
    );
  } else if (counting) {
    board = <div className="countdown-big">{Math.ceil((s.liveAt - Date.now()) / 1000)}</div>;
    banner = 'get ready…';
  } else if (eng.meta.realtime) {
    if (!s.winner) {
      board = (
        <RealtimeBoard eng={eng} session={s} myRole={myRole} sync={sync} code={code}
          names={{ A: duo.nameA, B: duo.nameB }} paused={paused}
          onFinish={w => onRealtimeFinish(s.game, w)} />
      );
      banner = paused ? 'Game paused' : 'first to 7 — go!';
    } else {
      board = null;
      bannerClass = 'banner ' + s.winner;
      banner = `${s.winner === 'A' ? duo.nameA : duo.nameB} takes the match`;
      showRematch = true;
    }
  } else {
    board = <TurnBoard eng={eng} session={s} myRole={myRole} onMove={onMove} paused={paused} />;
    bannerClass = 'banner' + (s.winner ? ' ' + s.winner : '');
    banner = paused
      ? 'Game paused'
      : !s.winner
        ? (s.turn === myRole ? 'Your move' : `${s.turn === 'A' ? duo.nameA : duo.nameB}’s move…`)
        : s.winner === 'draw' ? 'A draw — the classic couple result'
          : `${s.winner === 'A' ? duo.nameA : duo.nameB} takes the round`;
    showRematch = !!s.winner;
  }

  const turnA = !eng.meta.realtime && s.turn === 'A' && !s.winner && s.phase === 'live' && !counting && !paused;
  const turnB = !eng.meta.realtime && s.turn === 'B' && !s.winner && s.phase === 'live' && !counting && !paused;

  const pauseLabel = paused
    ? 'Resume game'
    : pausePending === myRole
      ? 'Pause requested…'
      : 'Request pause';

  const showRulesNote = rules && !s.winner && !showRules
    && (s.phase === 'invite' || s.phase === 'lobby' || counting);

  return (
    <section className="on gv-screen">
      <header className="gv-top">
        <button className="btn small ghost gv-back" onClick={onBack}>{'←'} Back</button>
        <h2 className="gv-title h3">{eng.meta.name}</h2>
        <div className="gv-actions">
          {canPause && (
            <button
              className="btn small ghost"
              disabled={pausePending === myRole && !paused}
              onClick={() => onRequestPause(setBannerStatus)}
            >
              {pauseLabel}
            </button>
          )}
          {rules && (
            <button
              type="button"
              className={'btn small gv-rules' + (showRules ? ' warm' : ' ghost')}
              aria-label="Rules"
              title="Rules"
              onClick={() => setShowRules(v => !v)}
            >
              <RulesIcon />
            </button>
          )}
          {showRematch && (
            <button className="btn small warm" onClick={onRematch}>Rematch</button>
          )}
        </div>
      </header>

      {showRulesNote && (
        <p className="gv-rules-note">
          Game rules are in the top right, have a quick look before the game start.
        </p>
      )}

      {showRules && rules && (
        <div className="gv-rules-panel">
          <div className="gv-rules-head">How to play — {eng.meta.name}</div>
          <div className="gv-rules-goal">{rules.goal}</div>
          <ol className="gv-rules-list">
            {rules.how.map((line, i) => <li key={i}>{line}</li>)}
          </ol>
          {rules.tip && <div className="gv-rules-tip">💡 {rules.tip}</div>}
        </div>
      )}

      <div className="gv-players">
        <div className={'pl A' + (turnA ? ' turn' : '') + (isAway('A') ? ' away' : '')}>
          <div className="dot" /><span>{duo.nameA}</span>
        </div>
        <div className="tally">{rec.a} {'–'} {rec.b}</div>
        <div className={'pl B' + (turnB ? ' turn' : '') + (isAway('B') ? ' away' : '')}>
          <div className="dot" /><span>{duo.nameB}</span>
        </div>
      </div>

      {pausePending === partnerRole && !paused && (
        <div className="gv-pause-request">
          <span><b>{partner}</b> requested a pause.</span>
          <div className="gv-pause-request-actions">
            <button className="btn small warm" onClick={() => onRespondPause(true, setBannerStatus)}>Accept</button>
            <button className="btn small ghost" onClick={() => onRespondPause(false, setBannerStatus)}>Decline</button>
          </div>
        </div>
      )}

      <div className="gv-board">{board}</div>
      <div className={bannerClass}>{bannerStatus || banner}</div>
    </section>
  );
}
