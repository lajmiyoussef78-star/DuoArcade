import { useEffect, useRef, useState } from 'react';
import { ENGINES } from '../engines/index.js';
import { other } from '../lib/util.js';
import { getRules } from '../engines/rules.js';

function RulesIcon() {
  return (
    <svg className="gv-rules-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none">
      {/* Curled scroll document */}
      <path
        d="M8 6.8V19.2c0 .9.7 1.6 1.6 1.6h7.2c.7 0 1.2-.5 1.2-1.2V7.6"
        stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
      />
      <path
        d="M8 6.8c0-1.3 1-2.4 2.3-2.4h5.4c.7 0 1.3.4 1.5 1.1l.9 2.6c.2.6-.2 1.3-.9 1.3H9.6C8.7 9.4 8 8.7 8 7.8V6.8Z"
        stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round"
      />
      <path
        d="M10.2 11.4h5.6M10.2 13.6h5.6M10.2 15.8h5.6M10.2 18h3.8"
        stroke="currentColor" strokeWidth="1.55" strokeLinecap="round"
      />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg className="gv-back-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <path d="M14.5 6.5 9 12l5.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg className="gv-pause-icon" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <rect x="6.5" y="5" width="3.5" height="14" rx="1.2" />
      <rect x="14" y="5" width="3.5" height="14" rx="1.2" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg className="gv-pause-icon" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M8.2 5.6v12.8c0 .7.8 1.1 1.4.7l9.2-6.1c.5-.4.5-1.1 0-1.4L9.6 5c-.6-.4-1.4 0-1.4.6Z" />
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

const LOBBY_COUNTDOWN_MS = 3000;

export default function GameScreen({
  duo, code, myRole, isAway, sync,
  onMove, onReady, onRematch, onBack,
  onRequestPause, onRespondPause, onRealtimeFinish
}) {
  const s = duo.session;
  const eng = ENGINES[s.game];
  const inChallenge = !!s.challengeId;
  const [bannerStatus, setBannerStatus] = useState('');
  const [showRules, setShowRules] = useState(false);
  useEffect(() => { setShowRules(false); }, [s.game]);
  const [, forceTick] = useState(0);
  // Local end time — ignore skewed wall clocks on liveAt (was showing 7 vs 3).
  const [goAt, setGoAt] = useState(null);

  useEffect(() => {
    if (s.phase === 'live' && s.liveAt && !s.winner) {
      setGoAt(Date.now() + LOBBY_COUNTDOWN_MS);
    } else {
      setGoAt(null);
    }
  }, [s.liveAt, s.phase, s.winner, s.startedAt, s.game]);

  const counting = goAt != null && Date.now() < goAt && !s.winner;
  useEffect(() => {
    if (!counting) return;
    const t = setTimeout(() => forceTick(n => n + 1), 200);
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
    const secs = Math.min(3, Math.max(1, Math.ceil((goAt - Date.now()) / 1000)));
    board = <div className="countdown-big">{secs}</div>;
    banner = 'get ready…';
  } else if (eng.meta.realtime) {
    if (!s.winner) {
      board = (
        <RealtimeBoard eng={eng} session={s} myRole={myRole} sync={sync} code={code}
          names={{ A: duo.nameA, B: duo.nameB }} paused={paused}
          onFinish={(w, scores) => onRealtimeFinish(s.game, w, scores)} />
      );
      banner = paused ? 'Game paused' : '';
    } else {
      showRematch = !inChallenge;
    }
  } else {
    board = <TurnBoard eng={eng} session={s} myRole={myRole} onMove={onMove} paused={paused} />;
    bannerClass = 'banner' + (s.winner ? ' ' + s.winner : '');
    banner = paused
      ? 'Game paused'
      : !s.winner
        ? (s.turn === myRole ? 'Your move' : `${s.turn === 'A' ? duo.nameA : duo.nameB}’s move…`)
        : '';
    showRematch = !inChallenge && !!s.winner;
  }

  const winnerName = s.winner === 'A' ? duo.nameA
    : s.winner === 'B' ? duo.nameB
      : null;
  const iWon = s.winner && s.winner === myRole;
  const isDraw = s.winner === 'draw';
  const showResult = !!s.winner;

  const turnA = !eng.meta.realtime && s.turn === 'A' && !s.winner && s.phase === 'live' && !counting && !paused;
  const turnB = !eng.meta.realtime && s.turn === 'B' && !s.winner && s.phase === 'live' && !counting && !paused;

  const pauseLabel = paused
    ? 'Resume game'
    : pausePending === myRole
      ? 'Pause requested…'
      : 'Request pause';

  const showRulesNote = rules && !s.winner && !showRules
    && (s.phase === 'invite' || s.phase === 'lobby' || counting);

  const kitchenGame = s.game === 'readysetcook';

  return (
    <section className={'on gv-screen' + (kitchenGame ? ' gv-kitchen' : '') + (showResult ? ' gv-result-screen' : '')}>
      <header className="gv-top">
        <button type="button" className="gv-back" onClick={onBack}>
          <BackIcon />
          <span>Back</span>
        </button>
        <div className="gv-heading">
          <h2 className="gv-title">{eng.meta.name}</h2>
          {eng.meta.tag && <p className="gv-tag">{eng.meta.tag}</p>}
        </div>
        <div className="gv-actions">
          {canPause && (
            <button
              type="button"
              className={'gv-iconbtn gv-pause' + (paused ? ' on' : '')}
              disabled={pausePending === myRole && !paused}
              onClick={() => onRequestPause(setBannerStatus)}
              title={pauseLabel}
              aria-label={pauseLabel}
            >
              {paused ? <PlayIcon /> : <PauseIcon />}
            </button>
          )}
          {rules && (
            <button
              type="button"
              className={'gv-iconbtn gv-rules' + (showRules ? ' on' : '')}
              aria-label="Rules"
              title="How to play"
              onClick={() => setShowRules(v => !v)}
            >
              <RulesIcon />
            </button>
          )}
        </div>
      </header>

      <div className="gv-stage">
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

        {!showResult && (
          <div className="gv-players">
            <div className={'pl A' + (turnA ? ' turn' : '') + (isAway('A') ? ' away' : '')}>
              <div className="dot" /><span>{duo.nameA}</span>
            </div>
            <div className="tally">{rec.a} {'–'} {rec.b}</div>
            <div className={'pl B' + (turnB ? ' turn' : '') + (isAway('B') ? ' away' : '')}>
              <div className="dot" /><span>{duo.nameB}</span>
            </div>
          </div>
        )}

        {pausePending === partnerRole && !paused && (
          <div className="gv-pause-request">
            <span><b>{partner}</b> requested a pause.</span>
            <div className="gv-pause-request-actions">
              <button className="btn small warm" onClick={() => onRespondPause(true, setBannerStatus)}>Accept</button>
              <button className="btn small ghost" onClick={() => onRespondPause(false, setBannerStatus)}>Decline</button>
            </div>
          </div>
        )}

        {showResult ? (
          <div className={`gv-result gv-result-${s.winner}`}>
            <div className="gv-result-kicker">{eng.meta.name}</div>
            <div className="gv-result-avs" aria-hidden="true">
              <div className={'gv-result-av A' + (s.winner === 'A' ? ' win' : '')}>
                {duo.nameA[0]?.toUpperCase()}
              </div>
              <div className="gv-result-vs">vs</div>
              <div className={'gv-result-av B' + (s.winner === 'B' ? ' win' : '')}>
                {duo.nameB[0]?.toUpperCase()}
              </div>
            </div>
            <div className="gv-result-score">
              {s.matchScore
                ? <>{s.matchScore.a} <span>–</span> {s.matchScore.b}</>
                : isDraw
                  ? 'Draw'
                  : <>{rec.a} <span>–</span> {rec.b}</>}
            </div>
            <p className="gv-result-series">
              Series · {rec.a}–{rec.b}{rec.d ? ` · ${rec.d} draws` : ''}
            </p>
            <h3 className="gv-result-title">
              {isDraw
                ? 'A perfectly tied match'
                : iWon
                  ? 'You take the match'
                  : `${winnerName} takes the match`}
            </h3>
            <p className="gv-result-sub">
              {isDraw
                ? 'This round ended even — check the series line for your record.'
                : iWon
                  ? 'Nice one. Offer a rematch while the streak is warm.'
                  : `Well played — challenge ${winnerName} to a rematch.`}
            </p>
            {showRematch && (
              <div className="gv-result-actions">
                <button className="btn warm" onClick={onRematch}>Rematch</button>
                <button className="btn ghost" onClick={onBack}>Back to shelf</button>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="gv-board">{board}</div>
            {(bannerStatus || banner) && (
              <div className={bannerClass}>{bannerStatus || banner}</div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
