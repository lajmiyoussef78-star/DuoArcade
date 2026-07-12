import { useEffect, useRef, useState } from 'react';
import { ENGINES } from '../engines/index.js';
import { other } from '../lib/util.js';

/** Turn-based boards keep the exact same DOM engine interface as before:
 *  eng.render(hostEl, gs, { myRole, turn, winner, onMove }) */
function TurnBoard({ eng, session, myRole, onMove }) {
  const hostRef = useRef(null);
  useEffect(() => {
    eng.render(hostRef.current, session.gs, {
      myRole, turn: session.turn, winner: session.winner, onMove
    });
  }, [eng, session, myRole, onMove]);
  return <div ref={hostRef} />;
}

/** Realtime engines mount once per match (game + startedAt) with a broadcast
 *  channel, exactly like the original shell. */
function RealtimeBoard({ eng, session, myRole, names, sync, code, onFinish }) {
  const hostRef = useRef(null);
  const key = session.game + ':' + (session.startedAt || 0);
  useEffect(() => {
    const rt = sync.rt(code);
    eng.mount(hostRef.current, { myRole, rt, names, onFinish });
    return () => {
      try { eng.unmount(); } catch { /* engine already gone */ }
      try { rt.close(); } catch { /* channel already closed */ }
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div ref={hostRef} />;
}

export default function GameScreen({
  duo, code, myRole, isAway, sync,
  onMove, onReady, onRematch, onBack, onFixStuck, onRealtimeFinish
}) {
  const s = duo.session;
  const eng = ENGINES[s.game];
  const [bannerStatus, setBannerStatus] = useState('');
  const [, forceTick] = useState(0);

  // Countdown after both ready: re-render 4x/sec until live.
  const counting = s.liveAt && Date.now() < s.liveAt && !s.winner;
  useEffect(() => {
    if (!counting) return;
    const t = setTimeout(() => forceTick(n => n + 1), 250);
    return () => clearTimeout(t);
  });

  if (!eng) return null;
  const rec = (duo.records || {})[s.game] || { a: 0, b: 0, d: 0 };
  const partner = other(myRole) === 'A' ? duo.nameA : duo.nameB;

  let board, banner = '', bannerClass = 'banner', showRematch = false;

  if (s.phase === 'invite' && s.by === myRole && !s.winner) {
    const pRole = other(myRole);
    const pLinked = pRole === 'A' ? !!duo.memberA : !!duo.memberB;
    const pHere = !isAway(pRole);
    const sub = pHere
      ? `${partner} is in the duo right now — the popup is on their screen.`
      : pLinked
        ? `${partner} isn’t looking at DuoArcade right now — the invitation will pop up within seconds of them opening it.`
        : `⚠ No account has ever joined ${partner}’s side of this duo — nobody can receive this invitation yet. Send them the invite link (from the duo home) and have them open it once. Testing alone? Open the invite link in a private window with a second account.`;
    board = (
      <div className="wait-box">
        <div className="pulse" />
        <div>Invitation sent — waiting for <b>{partner}</b> to accept…</div>
        <div className="dots-score" style={{ maxWidth: 380 }}>{sub}</div>
        <button className="btn ghost small" onClick={onBack}>Cancel invitation</button>
      </div>
    );
  } else if (s.phase === 'declined' && s.declinedBy !== myRole && !s.winner) {
    board = (
      <div className="wait-box">
        <div>😕 <b>{partner}</b> declined — maybe later tonight?</div>
        <button className="btn small" onClick={onBack}>Back to the shelf</button>
      </div>
    );
  } else if (s.phase === 'lobby' && !s.winner) {
    board = (
      <div className="ready-box">
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
          names={{ A: duo.nameA, B: duo.nameB }}
          onFinish={w => onRealtimeFinish(s.game, w)} />
      );
      banner = 'first to 7 — go!';
    } else {
      board = null;
      bannerClass = 'banner ' + s.winner;
      banner = `${s.winner === 'A' ? duo.nameA : duo.nameB} takes the match`;
      showRematch = true;
    }
  } else {
    board = <TurnBoard eng={eng} session={s} myRole={myRole} onMove={onMove} />;
    bannerClass = 'banner' + (s.winner ? ' ' + s.winner : '');
    banner = !s.winner
      ? (s.turn === myRole ? 'Your move' : `${s.turn === 'A' ? duo.nameA : duo.nameB}’s move…`)
      : s.winner === 'draw' ? 'A draw — the classic couple result'
      : `${s.winner === 'A' ? duo.nameA : duo.nameB} takes the round`;
    showRematch = !!s.winner;
  }

  const turnA = !eng.meta.realtime && s.turn === 'A' && !s.winner && s.phase === 'live' && !counting;
  const turnB = !eng.meta.realtime && s.turn === 'B' && !s.winner && s.phase === 'live' && !counting;

  return (
    <section className="on">
      <div className="gv-top">
        <button className="btn small ghost" onClick={onBack}>{'←'} Back</button>
        <div className="gv-title h3">{eng.meta.name}</div>
        <button className="btn small" style={{ visibility: showRematch ? 'visible' : 'hidden' }}
          onClick={onRematch}>Rematch</button>
        <button className="btn small ghost" title="Clears a stuck game for both of you"
          onClick={() => onFixStuck(code, setBannerStatus)}>Fix stuck</button>
      </div>
      <div className="gv-players">
        <div className={'pl A' + (turnA ? ' turn' : '') + (isAway('A') ? ' away' : '')}>
          <div className="dot" /><span>{duo.nameA}</span>
        </div>
        <div className="tally">{rec.a} {'–'} {rec.b}</div>
        <div className={'pl B' + (turnB ? ' turn' : '') + (isAway('B') ? ' away' : '')}>
          <div className="dot" /><span>{duo.nameB}</span>
        </div>
      </div>
      <div>{board}</div>
      <div className={bannerClass}>{bannerStatus || banner}</div>
    </section>
  );
}
