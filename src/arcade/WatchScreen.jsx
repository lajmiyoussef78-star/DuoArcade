import { useEffect, useRef, useState } from 'react';
import { other } from '../lib/util.js';
import { Confetti } from './CoupleFx.jsx';

function loadYT() {
  return new Promise(res => {
    if (window.YT && window.YT.Player) return res();
    window.onYouTubeIframeAPIReady = () => res();
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(s);
  });
}

export default function WatchScreen({ duo, myRole, pushWatch, submitRating, onBack }) {
  const s = duo.session;
  const ytRef = useRef(null);
  const ytReady = useRef(false);
  const applyingRemote = useRef(false);
  const lastPushed = useRef(0);
  const lastReactionAt = useRef(0);
  const sessionRef = useRef(s);
  useEffect(() => { sessionRef.current = s; }, [s]);
  const [reactions, setReactions] = useState([]);

  /* ---- player lifecycle: one player per videoId ---- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadYT();
      if (cancelled) return;
      ytRef.current = new window.YT.Player('ytPlayer', {
        videoId: s.videoId,
        playerVars: { rel: 0, playsinline: 1 },
        events: {
          onReady: () => { ytReady.current = true; },
          onStateChange: onPlayerState
        }
      });
    })();
    return () => {
      cancelled = true;
      if (ytRef.current) { try { ytRef.current.destroy(); } catch { /* gone */ } }
      ytRef.current = null; ytReady.current = false;
    };
  }, [s.videoId]); // eslint-disable-line react-hooks/exhaustive-deps

  function onPlayerState(e) {
    const yt = ytRef.current;
    const sess = sessionRef.current;
    if (!ytReady.current || applyingRemote.current) return;
    if (!sess || sess.type !== 'watch' || sess.phase !== 'playing') return;
    if (e.data === window.YT.PlayerState.PLAYING || e.data === window.YT.PlayerState.PAUSED) {
      const playing = e.data === window.YT.PlayerState.PLAYING;
      const now = Date.now();
      // only push real changes: state flips, or a seek while paused/playing
      const expected = sess.playing ? sess.position + (now - sess.at) / 1000 : sess.position;
      const seeked = Math.abs(yt.getCurrentTime() - expected) > 2;
      if (playing === sess.playing && !seeked) return;
      if (now - lastPushed.current < 350) return;
      lastPushed.current = now;
      pushWatch({ playing, position: yt.getCurrentTime(), at: now, by: myRole });
    }
  }

  /* ---- follow remote state ---- */
  useEffect(() => {
    const yt = ytRef.current;
    if (!ytReady.current || !yt || s.phase !== 'playing') return;
    if (s.by === myRole) return; // our own update echoed back — ignore
    applyingRemote.current = true;
    try {
      const target = s.playing ? s.position + (Date.now() - s.at) / 1000 : s.position;
      if (Math.abs(yt.getCurrentTime() - target) > 2) yt.seekTo(target, true);
      const state = yt.getPlayerState();
      if (s.playing && state !== window.YT.PlayerState.PLAYING) yt.playVideo();
      if (!s.playing && state === window.YT.PlayerState.PLAYING) yt.pauseVideo();
    } finally {
      setTimeout(() => { applyingRemote.current = false; }, 500);
    }
  }, [s.playing, s.position, s.at, s.by, s.phase, myRole]);

  /* ---- heartbeat: whoever acted last re-broadcasts every 5s ---- */
  useEffect(() => {
    const timer = setInterval(() => {
      const sess = sessionRef.current;
      const yt = ytRef.current;
      if (!sess || sess.type !== 'watch' || sess.phase !== 'playing') return;
      if (!sess.playing || sess.by !== myRole || !ytReady.current) return;
      if (yt.getPlayerState() !== window.YT.PlayerState.PLAYING) return;
      pushWatch({ playing: true, position: yt.getCurrentTime(), at: Date.now(), by: myRole });
    }, 5000);
    return () => clearInterval(timer);
  }, [myRole, pushWatch]);

  /* ---- floating reactions ---- */
  useEffect(() => {
    const r = s.reaction;
    if (!r || r.at <= lastReactionAt.current || Date.now() - r.at > 6000) return;
    lastReactionAt.current = r.at;
    const id = r.at;
    setReactions(list => [...list, { id, e: r.e }]);
    setTimeout(() => setReactions(list => list.filter(x => x.id !== id)), 2500);
  }, [s.reaction]);

  const finishWatch = async () => {
    if (ytReady.current) { try { ytRef.current.pauseVideo(); } catch { /* fine */ } }
    await pushWatch({ phase: 'verdict', playing: false });
  };

  /* ---- verdict ---- */
  const mine = s.ratings?.[myRole] ?? null;
  const theirs = s.ratings?.[other(myRole)] ?? null;
  const partner = other(myRole) === 'A' ? duo.nameA : duo.nameB;
  const diff = mine !== null && theirs !== null ? Math.abs(mine - theirs) : null;
  const verdictLine = diff === 0 ? 'Perfect agreement.'
    : diff === 1 ? 'Close call.' : 'You two saw different films tonight.';

  return (
    <section className="on">
      <div className="gv-top">
        <button className="btn small ghost" onClick={onBack}>{'←'} Back</button>
        <div className="gv-title h3">Movie night</div>
        {s.phase === 'playing' && (
          <button className="btn small warm" onClick={finishWatch}>Finish & rate</button>
        )}
      </div>
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
      <div className="watch-bar">
        <span className="watch-note">play, pause, and seek sync live to your partner</span>
        <div className="react-row">
          {['😂', '😱', '❤️', '🍿'].map(e => (
            <button className="emoji-btn" key={e}
              onClick={() => pushWatch({ reaction: { e, by: myRole, at: Date.now() } })}>{e}</button>
          ))}
        </div>
      </div>
      {s.phase !== 'playing' && (
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
            <div className="row"><button className="btn small" onClick={onBack}>Back to your place</button></div>
          )}
        </div>
      )}
    </section>
  );
}
