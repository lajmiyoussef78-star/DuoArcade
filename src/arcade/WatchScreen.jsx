import { useEffect, useRef, useState } from 'react';
import { other } from '../lib/util.js';
import { Confetti } from './CoupleFx.jsx';
import {
  shouldCommitLocal, shouldApplyRemote, shouldHeartbeat,
  HEARTBEAT_MS, applyRemotePlayhead,
} from '../lib/watchSync.js';
import { watchChannel, reactPayload } from '../lib/watchBroadcast.js';
import { buildMemoryCard } from '../lib/watchSessions.js';
import { afterglowQuestions } from '../lib/watchSparks.js';
import WatchMemoryCard from './WatchMemoryCard.jsx';
import SparksOverlay from './SparksOverlay.jsx';

function loadYT() {
  return new Promise(res => {
    if (window.YT && window.YT.Player) return res();
    window.onYouTubeIframeAPIReady = () => res();
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(s);
  });
}

export default function WatchScreen({
  duo, code, myRole, pushWatch, submitRating, onBack, onEndWatch,
}) {
  const s = duo.session;
  const videoId = s.videoId || s.mediaRef?.id;
  const ytRef = useRef(null);
  const ytReady = useRef(false);
  const applyingRemote = useRef(false);
  const lastPushed = useRef(0);
  const sessionRef = useRef(s);
  const busRef = useRef(null);
  useEffect(() => { sessionRef.current = s; }, [s]);

  const [reactions, setReactions] = useState([]);
  const [bestReaction, setBestReaction] = useState(null);
  const [showSparks, setShowSparks] = useState(!!s.interactive?.on);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [xpAwarded, setXpAwarded] = useState(false);
  const startedAtRef = useRef(s.startedAt || Date.now());

  /* ---- ephemeral bus (emoji) ---- */
  useEffect(() => {
    if (!code) return undefined;
    let alive = true;
    watchChannel(code).then(ch => {
      if (!alive) { ch.close(); return; }
      busRef.current = ch;
      ch.on(msg => {
        if (!msg || msg.t !== 'react') return;
        if (Date.now() - (msg.at || 0) > 6000) return;
        const id = msg.at + '-' + msg.by;
        setReactions(list => [...list, { id, e: msg.e }]);
        setBestReaction(msg.e);
        setTimeout(() => setReactions(list => list.filter(x => x.id !== id)), 2500);
      });
    });
    return () => {
      alive = false;
      try { busRef.current?.close(); } catch { /* */ }
      busRef.current = null;
    };
  }, [code]);

  /* ---- player lifecycle ---- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadYT();
      if (cancelled) return;
      ytRef.current = new window.YT.Player('ytPlayer', {
        videoId,
        playerVars: { rel: 0, playsinline: 1 },
        events: {
          onReady: () => { ytReady.current = true; },
          onStateChange: onPlayerState,
        },
      });
    })();
    return () => {
      cancelled = true;
      if (ytRef.current) { try { ytRef.current.destroy(); } catch { /* gone */ } }
      ytRef.current = null; ytReady.current = false;
    };
  }, [videoId]); // eslint-disable-line react-hooks/exhaustive-deps

  function onPlayerState(e) {
    const yt = ytRef.current;
    const sess = sessionRef.current;
    if (!ytReady.current || applyingRemote.current) return;
    if (!sess || sess.type !== 'watch' || sess.phase !== 'playing') return;
    if (e.data !== window.YT.PlayerState.PLAYING && e.data !== window.YT.PlayerState.PAUSED) return;
    const playing = e.data === window.YT.PlayerState.PLAYING;
    const now = Date.now();
    const localTime = yt.getCurrentTime();
    if (!shouldCommitLocal({
      playing, localTime, sess, lastPushedAt: lastPushed.current, now, kind: 'watch',
    })) return;
    lastPushed.current = now;
    pushWatch({ playing, position: localTime, at: now, by: myRole });
  }

  /* ---- follow remote via watchSync ---- */
  useEffect(() => {
    const yt = ytRef.current;
    if (!ytReady.current || !yt || s.phase !== 'playing') return;
    if (!shouldApplyRemote(s, myRole)) return;
    applyingRemote.current = true;
    try {
      applyRemotePlayhead({
        getCurrentTime: () => yt.getCurrentTime(),
        seekTo: (t, allow) => yt.seekTo(t, allow),
        play: () => {
          if (yt.getPlayerState() !== window.YT.PlayerState.PLAYING) yt.playVideo();
        },
        pause: () => {
          if (yt.getPlayerState() === window.YT.PlayerState.PLAYING) yt.pauseVideo();
        },
      }, s, 'watch');
    } finally {
      setTimeout(() => { applyingRemote.current = false; }, 500);
    }
  }, [s.playing, s.position, s.at, s.by, s.phase, myRole]);

  /* ---- heartbeat ---- */
  useEffect(() => {
    const timer = setInterval(() => {
      const sess = sessionRef.current;
      const yt = ytRef.current;
      if (!shouldHeartbeat(sess, myRole) || !ytReady.current) return;
      if (sess.type !== 'watch') return;
      if (yt.getPlayerState() !== window.YT.PlayerState.PLAYING) return;
      pushWatch({ playing: true, position: yt.getCurrentTime(), at: Date.now(), by: myRole });
    }, HEARTBEAT_MS);
    return () => clearInterval(timer);
  }, [myRole, pushWatch]);

  const sendReact = (e) => {
    busRef.current?.send(reactPayload(e, myRole));
    // legacy session reaction kept for partners without bus yet — light payload
    // Prefer broadcast; skip update_duo for emoji (architecture rule).
  };

  const pushInteractive = (interactive) => {
    pushWatch({ interactive });
  };

  const toggleSparks = () => {
    if (s.interactive?.on) {
      pushWatch({ interactive: { on: false } });
      setShowSparks(false);
    } else {
      setShowSparks(true);
    }
  };

  const finishWatch = async () => {
    if (ytReady.current) { try { ytRef.current.pauseVideo(); } catch { /* fine */ } }
    setConfirmEnd(false);
    await pushWatch({ phase: 'verdict', playing: false });
  };

  const goAfterglow = async () => {
    const durationSec = Math.round((Date.now() - startedAtRef.current) / 1000);
    const memory = buildMemoryCard({
      title: 'YouTube Night',
      durationSec,
      starsA: s.ratings?.A,
      starsB: s.ratings?.B,
      bestReaction,
      mode: 'watch',
      insight: s.interactive?.on
        ? 'You lit Sparks tonight — mind-reads count more than points.'
        : null,
    });
    await pushWatch({ phase: 'afterglow', memory, playing: false });
    if (!xpAwarded && onEndWatch) {
      setXpAwarded(true);
      onEndWatch('watch_youtube');
    }
  };

  // Auto-advance to afterglow once both rated
  useEffect(() => {
    if (s.phase !== 'verdict') return;
    const a = s.ratings?.A; const b = s.ratings?.B;
    if (a != null && b != null && !s.memory) {
      const t = setTimeout(() => { goAfterglow(); }, 1800);
      return () => clearTimeout(t);
    }
  }, [s.phase, s.ratings?.A, s.ratings?.B]); // eslint-disable-line react-hooks/exhaustive-deps

  const mine = s.ratings?.[myRole] ?? null;
  const theirs = s.ratings?.[other(myRole)] ?? null;
  const partner = other(myRole) === 'A' ? duo.nameA : duo.nameB;
  const diff = mine !== null && theirs !== null ? Math.abs(mine - theirs) : null;
  const verdictLine = diff === 0 ? 'Perfect agreement.'
    : diff === 1 ? 'Close call.' : 'You two saw different films tonight.';

  if (s.phase === 'afterglow' && s.memory) {
    return (
      <section className="on wp-screen">
        <div className="gv-top">
          <button className="btn small ghost" onClick={onBack}>{'←'} Back</button>
          <div className="gv-title h3 cw-title">Afterglow</div>
        </div>
        <WatchMemoryCard
          memory={s.memory}
          partnerName={partner}
          afterglowQs={afterglowQuestions()}
          onDone={onBack}
        />
      </section>
    );
  }

  return (
    <section className="on wp-screen">
      <div className="gv-top">
        <button className="btn small ghost" onClick={() => setConfirmEnd(true)}>{'←'} Back</button>
        <div className="gv-title h3 cw-title">YouTube Night</div>
        {s.phase === 'playing' && (
          <div className="wp-top-actions">
            <button
              type="button"
              className={'btn small' + (s.interactive?.on || showSparks ? ' warm' : ' ghost')}
              onClick={toggleSparks}
              title="Make it ours"
            >
              Sparks
            </button>
            <button className="btn small warm" onClick={() => setConfirmEnd(true)}>End night</button>
          </div>
        )}
      </div>

      {confirmEnd && s.phase === 'playing' && (
        <div className="wp-end-confirm">
          <p>End YouTube Night and rate together?</p>
          <div className="row">
            <button type="button" className="btn warm small" onClick={finishWatch}>Finish & rate</button>
            <button type="button" className="btn ghost small" onClick={() => setConfirmEnd(false)}>Keep watching</button>
          </div>
        </div>
      )}

      <div className="player-outer">
        <div className={'player-wrap' + (s.phase === 'playing' && s.playing ? ' live' : '')}>
          <div id="ytPlayer" />
        </div>
        <div className="react-lane">
          {reactions.map(r => <div className="float-emoji" key={r.id}>{r.e}</div>)}
        </div>
      </div>

      <div className="cw-sync" aria-hidden="true">
        <div className="cw-dot A">{(duo.nameA || '?')[0].toUpperCase()}</div>
        <div className="cw-line">
          <svg viewBox="0 0 130 24" preserveAspectRatio="none">
            <defs>
              <linearGradient id="cw-grad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="var(--p1)" />
                <stop offset="50%" stopColor="var(--candle)" />
                <stop offset="100%" stopColor="var(--p2)" />
              </linearGradient>
            </defs>
            <path className="base" d="M0 12 H40 L47 4 L55 20 L62 12 H68 L75 6 L83 18 L90 12 H130" />
            <path className="run" d="M0 12 H40 L47 4 L55 20 L62 12 H68 L75 6 L83 18 L90 12 H130" />
          </svg>
          <span className="cw-heartmid">{'❤'}</span>
        </div>
        <div className="cw-dot B">{(duo.nameB || '?')[0].toUpperCase()}</div>
        <span className="cw-note">
          {s.phase === 'playing'
            ? <><b>in sync</b> {'·'} {s.playing ? 'playing' : 'paused'}</>
            : 'the verdict'}
        </span>
      </div>

      {s.phase === 'playing' && (
        <div className="watch-bar">
          <span className="watch-note">play, pause, and seek sync live to your partner</span>
          <div className="react-row">
            {['😂', '😱', '❤️', '🍿'].map(e => (
              <button className="emoji-btn" key={e} type="button" onClick={() => sendReact(e)}>{e}</button>
            ))}
          </div>
        </div>
      )}

      {showSparks && s.phase === 'playing' && (
        <SparksOverlay
          duo={duo}
          myRole={myRole}
          interactive={s.interactive || { on: false }}
          pushInteractive={pushInteractive}
          positionSec={s.position || 0}
          onClose={() => setShowSparks(false)}
        />
      )}

      {s.phase === 'verdict' && (
        <div className="verdict">
          {mine !== null && theirs !== null && diff <= 1 && (
            <div className="cw-reveal"><Confetti count={26} small /></div>
          )}
          <h3>The Verdict</h3>
          <p>{mine !== null && theirs !== null ? 'The reveal:' : 'Rate it blind — the reveal happens when you both have.'}</p>
          <div className="stars">
            {[1, 2, 3, 4, 5].map(i => (
              <button key={i} className={'star' + (mine && i <= mine ? ' on' : '')}
                disabled={mine !== null} onClick={() => submitRating(i)}>{'★'}</button>
            ))}
          </div>
          <div className="verdict-result">
            {mine !== null && theirs !== null
              ? <>You: {mine}{'★'} {'·'} {partner}: {theirs}{'★'} {'—'} <b>{verdictLine}</b></>
              : mine !== null ? 'Rated. Waiting for your partner’s blind rating…' : ''}
          </div>
          {mine !== null && theirs !== null && (
            <div className="row">
              <button className="btn warm small" type="button" onClick={goAfterglow}>See memory</button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
