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

function FullscreenEnterIcon() {
  return (
    <svg className="gv-fs-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <path d="M8 4H4v4M16 4h4v4M8 20H4v-4M16 20h4v-4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FullscreenExitIcon() {
  return (
    <svg className="gv-fs-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <path d="M8 8H4V4M16 8h4V4M8 16H4v4M16 16h4v4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function getFullscreenEl() {
  return document.fullscreenElement
    || document.webkitFullscreenElement
    || document.msFullscreenElement
    || null;
}

async function enterFullscreen(el) {
  if (!el) return;
  if (el.requestFullscreen) await el.requestFullscreen();
  else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
  else if (el.msRequestFullscreen) await el.msRequestFullscreen();
}

async function exitFullscreen() {
  if (document.exitFullscreen) await document.exitFullscreen();
  else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
  else if (document.msExitFullscreen) await document.msExitFullscreen();
}

/** Turn-based boards keep the exact same DOM engine interface as before:
 *  eng.render(hostEl, gs, { myRole, turn, winner, onMove, names, onProceed }) */
function TurnBoard({ eng, session, myRole, onMove, paused, names, onProceed }) {
  const hostRef = useRef(null);
  const onProceedRef = useRef(onProceed);
  useEffect(() => { onProceedRef.current = onProceed; }, [onProceed]);
  const nameA = names?.A || 'A';
  const nameB = names?.B || 'B';
  useEffect(() => {
    eng.render(hostRef.current, session.gs, {
      myRole, turn: session.turn, winner: session.winner,
      names: { A: nameA, B: nameB },
      onMove: paused ? () => {} : onMove,
      onProceed: () => onProceedRef.current?.()
    });
  }, [eng, session, myRole, onMove, paused, nameA, nameB]);
  return <div ref={hostRef} className={paused ? 'gv-board-paused' : undefined} />;
}

/** Realtime engines mount once per match (game + startedAt) with a broadcast
 *  channel, exactly like the original shell. */
function RealtimeBoard({ eng, session, myRole, names, sync, code, onFinish, onProceed, paused, frozen }) {
  const hostRef = useRef(null);
  const onFinishRef = useRef(onFinish);
  const onProceedRef = useRef(onProceed);
  useEffect(() => { onFinishRef.current = onFinish; }, [onFinish]);
  useEffect(() => { onProceedRef.current = onProceed; }, [onProceed]);
  const key = session.game + ':' + (session.startedAt || 0);
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !sync?.rt) return undefined;
    const rt = sync.rt(code, {
      game: session.game,
      matchId: session.startedAt || 0,
      role: myRole,
      requireSocket: session.game === 'microsoccer',
    });
    eng.mount(host, {
      myRole,
      rt,
      names,
      code,
      startedAt: session.startedAt || 0,
      maxEnds: session.ncEnds || 3,
      onFinish: (...args) => onFinishRef.current?.(...args),
      onProceed: () => onProceedRef.current?.()
    });
    return () => {
      try { eng.unmount(); } catch { /* engine already gone */ }
      try { rt.close(); } catch { /* channel already closed */ }
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    try { eng.setPaused?.(paused); } catch { /* optional */ }
  }, [eng, paused, key]);
  return (
    <div className={
      'gv-board-wrap'
      + (paused && !frozen ? ' paused' : '')
      + (frozen ? ' gv-end-freeze' : '')
    }>
      <div ref={hostRef} />
      {paused && !frozen && <div className="gv-pause-overlay">Paused</div>}
    </div>
  );
}

const LOBBY_COUNTDOWN_MS = 3000;

export default function GameScreen({
  duo, code, myRole, isAway, sync,
  onMove, onReady, onRematch, onBack,
  onRequestPause, onRespondPause, onRealtimeFinish, onSetNcEnds
}) {
  const s = duo.session;
  const eng = ENGINES[s.game];
  const inChallenge = !!s.challengeId;
  const [bannerStatus, setBannerStatus] = useState('');
  const [showRules, setShowRules] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  /** Only the game canvas / kitchen — never DuoArcade chrome. */
  const fsRootRef = useRef(null);
  useEffect(() => { setShowRules(false); }, [s.game]);
  const [, forceTick] = useState(0);
  // Local countdown end — armed once per match so sync echoes can't re-stick on "3".
  const [goAt, setGoAt] = useState(null);
  const countdownArmRef = useRef(null);
  // Connect Four / Gomoku: show the winning line before the result panel.
  const [revealResult, setRevealResult] = useState(false);

  useEffect(() => {
    const syncFs = () => {
      const el = getFullscreenEl();
      setIsFullscreen(!!el && el === fsRootRef.current);
    };
    document.addEventListener('fullscreenchange', syncFs);
    document.addEventListener('webkitfullscreenchange', syncFs);
    syncFs();
    return () => {
      document.removeEventListener('fullscreenchange', syncFs);
      document.removeEventListener('webkitfullscreenchange', syncFs);
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (getFullscreenEl()) {
        await exitFullscreen();
      } else {
        await enterFullscreen(fsRootRef.current);
        requestAnimationFrame(() => {
          const el = fsRootRef.current;
          if (el) el.scrollTop = 0;
          // Nudge Phaser / layout to fill the new fullscreen size.
          window.dispatchEvent(new Event('resize'));
        });
        setTimeout(() => window.dispatchEvent(new Event('resize')), 80);
        setTimeout(() => window.dispatchEvent(new Event('resize')), 250);
      }
    } catch {
      /* browser blocked fullscreen — ignore */
    }
  };

  useEffect(() => {
    // Arm a fixed local 3s once when the match goes live. Re-using shared liveAt
    // caused clock-skew "stuck on 3"; re-arming on every echo reset the digit.
    if (s.phase === 'live' && s.liveAt && !s.winner) {
      const armKey = `${s.game}:${s.startedAt || 0}`;
      if (countdownArmRef.current === armKey) return;
      countdownArmRef.current = armKey;
      const shared = Number(s.liveAt);
      const now = Date.now();
      // Late join / slow sync: if the shared end is already past, skip straight in.
      if (Number.isFinite(shared) && shared <= now) {
        setGoAt(now);
      } else {
        setGoAt(now + LOBBY_COUNTDOWN_MS);
      }
    } else if (s.phase !== 'live' || s.winner) {
      countdownArmRef.current = null;
      setGoAt(null);
    }
  }, [s.liveAt, s.phase, s.winner, s.startedAt, s.game]);

  useEffect(() => {
    if (!s.winner) {
      setRevealResult(false);
      return;
    }
    if (s.game === 'connect4' && s.winner !== 'draw') {
      setRevealResult(false);
      const t = setTimeout(() => setRevealResult(true), 1800);
      return () => clearTimeout(t);
    }
    if (s.game === 'gomoku' && s.winner !== 'draw') {
      setRevealResult(false);
      const t = setTimeout(() => setRevealResult(true), 2200);
      return () => clearTimeout(t);
    }
    if (s.game === 'wordrace' || s.game === 'codebreak' || s.game === 'forbiddenwords') {
      // Manual End round only — do not auto-open or wipe a prior click.
      return;
    }
    if (s.game === 'seabattle') {
      setRevealResult(false);
      const t = setTimeout(() => setRevealResult(true), 2400);
      return () => clearTimeout(t);
    }
    setRevealResult(true);
  }, [s.winner, s.game, s.startedAt]);

  const counting = goAt != null && Date.now() < goAt && !s.winner;
  // Interval keyed on goAt — parent presence/geo re-renders must not clear the tick.
  useEffect(() => {
    if (goAt == null || s.winner) return undefined;
    if (Date.now() >= goAt) return undefined;
    const id = setInterval(() => forceTick(n => n + 1), 200);
    return () => clearInterval(id);
  }, [goAt, s.winner]);

  if (!eng) return null;
  const rules = getRules(s.game);
  const rec = (duo.records || {})[s.game] || { a: 0, b: 0, d: 0 };
  const series = s.series || s.streak || { a: 0, b: 0, d: 0 };
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
    const rematchAsk = s.rematchBy && s.rematchBy !== myRole && !s.ready?.[myRole];
    const rematchWait = s.rematchBy === myRole && !!s.ready?.[myRole] && !s.ready?.[partnerRole];
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
        {rematchAsk && (
          <p className="gv-rematch-note">
            <b>{partner}</b> requested a rematch
          </p>
        )}
        {rematchWait && (
          <p className="gv-rematch-note dim">
            Rematch sent — waiting for {partner}…
          </p>
        )}
        {s.game === 'nightcurling' && (
          <div className="gv-ends-pick">
            <span className="gv-ends-label">number of ends</span>
            {[2, 3, 5].map(n => (
              <button
                key={n}
                type="button"
                className={'btn small' + ((s.ncEnds || 3) === n ? ' warm' : '')}
                disabled={!!s.ready?.A || !!s.ready?.B}
                onClick={() => onSetNcEnds?.(n)}
              >
                {n}
              </button>
            ))}
          </div>
        )}
        <button className="btn warm" disabled={!!s.ready?.[myRole]} onClick={onReady}>
          {s.ready?.[myRole]
            ? 'Waiting for partner to ready…'
            : rematchAsk
              ? 'Accept rematch'
              : "I'm ready"}
        </button>
      </div>
    );
  } else if (counting) {
    const remMs = Math.max(0, goAt - Date.now());
    const secs = Math.min(3, Math.max(1, Math.ceil(remMs / 1000)));
    board = <div className="countdown-big">{secs}</div>;
    banner = 'get ready…';
  } else if (eng.meta.realtime) {
    // Keep the live board up during result delay so Word Race / Sea Battle
    // can show their end reveal before the summary panel.
    // keepInGame engines (Bomb Tag, Laser Wall, etc.) stay on their own board.
    if (!s.winner || eng.meta.keepInGame || !revealResult) {
      const endFreeze = !!s.winner && !revealResult && !eng.meta?.keepInGame
        && s.game !== 'wordrace'
        && s.game !== 'forbiddenwords';
      board = (
        <RealtimeBoard eng={eng} session={s} myRole={myRole} sync={sync} code={code}
          names={{ A: duo.nameA, B: duo.nameB }} paused={paused} frozen={endFreeze}
          onFinish={(w, scores) => onRealtimeFinish(s.game, w, scores)}
          onProceed={() => setRevealResult(true)} />
      );
      banner = paused
        ? 'Game paused'
        : s.winner && s.game === 'seabattle' && !revealResult
          ? 'Fleet destroyed!'
          : '';
    } else {
      showRematch = !inChallenge;
    }
  } else {
    board = (
      <TurnBoard eng={eng} session={s} myRole={myRole} onMove={onMove} paused={paused}
        names={{ A: duo.nameA, B: duo.nameB }}
        onProceed={() => setRevealResult(true)} />
    );
    bannerClass = 'banner' + (s.winner && revealResult ? ' ' + s.winner : '');
    banner = paused
      ? 'Game paused'
      : s.winner && s.game === 'connect4' && s.winner !== 'draw' && !revealResult
        ? 'Four in a row!'
        : s.winner && s.game === 'gomoku' && s.winner !== 'draw' && !revealResult
          ? 'Five in a row!'
          : s.winner && s.game === 'seabattle' && !revealResult
            ? 'Fleet destroyed!'
            : !s.winner
              ? (s.turn === myRole ? 'Your move' : `${s.turn === 'A' ? duo.nameA : duo.nameB}’s move…`)
              : '';
    showRematch = !inChallenge && !!s.winner && revealResult;
  }

  const winnerName = s.winner === 'A' ? duo.nameA
    : s.winner === 'B' ? duo.nameB
      : null;
  const iWon = s.winner && s.winner === myRole;
  const isDraw = s.winner === 'draw';
  // keepInGame engines stay on the board — no shelf result panel
  const showResult = !!s.winner && revealResult && !eng.meta?.keepInGame;

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
    <section
      className={
        'on gv-screen'
        + (kitchenGame ? ' gv-kitchen' : '')
        + (showResult ? ' gv-result-screen' : '')
      }
    >
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
          <button
            type="button"
            className={'gv-iconbtn gv-fullscreen' + (isFullscreen ? ' on' : '')}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen — game only'}
            onClick={toggleFullscreen}
          >
            {isFullscreen ? <FullscreenExitIcon /> : <FullscreenEnterIcon />}
          </button>
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
          <>
            <div className="gv-players">
              <div className={'pl A' + (turnA ? ' turn' : '') + (isAway('A') ? ' away' : '')}>
                <div className="dot" /><span>{duo.nameA}</span>
              </div>
              <div className="tally">{series.a} {'–'} {series.b}</div>
              <div className={'pl B' + (turnB ? ' turn' : '') + (isAway('B') ? ' away' : '')}>
                <div className="dot" /><span>{duo.nameB}</span>
              </div>
            </div>
            {s.game === 'codebreak' && s.gs?.secrets?.[myRole] && (
              <div className="cb-secret-title">
                Your secret code is : <span>{s.gs.secrets[myRole]}</span>
              </div>
            )}
          </>
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
              {isDraw && s.game === 'nightcurling'
                ? 'Draw'
                : s.matchScore
                  ? <>{s.matchScore.a} <span>–</span> {s.matchScore.b}</>
                  : s.game === 'twotruths' && s.gs?.scores
                    ? <>{s.gs.scores.A} <span>–</span> {s.gs.scores.B}</>
                    : isDraw
                      ? 'Draw'
                      : s.winner === 'A'
                        ? <>1 <span>–</span> 0</>
                        : <>0 <span>–</span> 1</>}
            </div>
            {s.game === 'nightcurling' && s.matchScore?.endsWon && !isDraw && (
              <p className="gv-result-sub" style={{ marginTop: 0 }}>
                Ends won · {s.matchScore.endsWon.a}–{s.matchScore.endsWon.b}
              </p>
            )}
            <h3 className="gv-result-title">
              {isDraw
                ? (s.game === 'nightcurling' ? 'Draw' : 'A perfectly tied match')
                : iWon
                  ? 'You take the match'
                  : `${winnerName} takes the match`}
            </h3>
            <p className="gv-result-series">
              Series · {series.a}–{series.b}{series.d ? ` · ${series.d} draws` : ''}
              {rec.a || rec.b || rec.d ? ` · All-time ${rec.a}–${rec.b}` : ''}
            </p>
            {s.game === 'nightcurling' && Array.isArray(s.matchScore?.ends) && s.matchScore.ends.length > 0 && (
              <table className="ttl-recap nc-recap" aria-label="End-by-end score">
                <thead>
                  <tr>
                    <th scope="col" />
                    {s.matchScore.ends.map((e, i) => (
                      <th key={i} scope="col">{e.tieBreak ? 'TB' : `E${e.end || i + 1}`}</th>
                    ))}
                    <th scope="col">Tot</th>
                  </tr>
                </thead>
                <tbody>
                  {[['A', duo.nameA, 'a'], ['B', duo.nameB, 'b']].map(([role, name, key]) => (
                    <tr key={role}>
                      <th scope="row" className={'ttl-recap-name ' + role}>{name}</th>
                      {s.matchScore.ends.map((e, i) => (
                        <td key={i} className={
                          e.winner === role ? 'win ' + role
                            : e.blank || e.tie ? 'draw'
                              : 'loss'
                        }>
                          {e[key]}
                        </td>
                      ))}
                      <td className={'win ' + role}>{s.matchScore[key]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {s.game === 'twotruths' && Array.isArray(s.gs?.roundResults) && s.gs.roundResults.length > 0 && (
              <table className="ttl-recap" aria-label="Round recap">
                <thead>
                  <tr>
                    <th scope="col" />
                    {s.gs.roundResults.map((_, i) => (
                      <th key={i} scope="col">
                        {i === 0 ? '1st' : i === 1 ? '2nd' : i === 2 ? '3rd' : `${i + 1}th`} round
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[['A', duo.nameA], ['B', duo.nameB]].map(([role, name]) => (
                    <tr key={role}>
                      <th scope="row" className={'ttl-recap-name ' + role}>{name}</th>
                      {s.gs.roundResults.map((rw, i) => (
                        <td key={i} className={
                          rw === role ? 'win ' + role
                            : rw === 'draw' ? 'draw'
                              : 'loss'
                        }>
                          {rw === role ? '✓' : rw === 'draw' ? 'Draw' : ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="gv-result-sub">
              {isDraw
                ? (s.game === 'nightcurling'
                  ? (s.matchScore && s.matchScore.a === s.matchScore.b
                    ? 'Equal totals — no extra end.'
                    : 'Match ends even.')
                  : 'This round ended even — check the series line for your record.')
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
            {/* Fullscreen targets this node only — no DuoArcade topbar / game header */}
            <div
              ref={fsRootRef}
              className={'gv-fs-root' + (isFullscreen ? ' is-fullscreen' : '')}
            >
              {isFullscreen && (
                <button
                  type="button"
                  className="gv-fs-exit"
                  onClick={toggleFullscreen}
                  title="Exit fullscreen"
                  aria-label="Exit fullscreen"
                >
                  <FullscreenExitIcon />
                  <span>Exit</span>
                </button>
              )}
              <div className="gv-board">{board}</div>
              {(bannerStatus || banner) && (
                <div className={bannerClass}>{bannerStatus || banner}</div>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
