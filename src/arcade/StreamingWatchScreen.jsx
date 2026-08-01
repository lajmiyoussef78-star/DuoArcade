import { useEffect, useRef, useState } from 'react';
import { other } from '../lib/util.js';
import { Confetti } from './CoupleFx.jsx';
import {
  shouldCommitLocal, shouldApplyRemote, shouldHeartbeat,
  HEARTBEAT_MS, playheadPatch,
} from '../lib/watchSync.js';
import { watchChannel, reactPayload } from '../lib/watchBroadcast.js';
import { buildMemoryCard, watchModeTitle } from '../lib/watchSessions.js';
import {
  platformLabel, platformHomeUrl, openStreamingContent,
  capabilityLabel, capabilityBlurb, resolveCapability,
  isDesktopChromium, makeBindToken, postToExtension, onExtensionMessage,
} from '../lib/watchStreaming.js';
import WatchMemoryCard from './WatchMemoryCard.jsx';
import SparksOverlay from './SparksOverlay.jsx';

const COUNTDOWN_SECS = 3;

export default function StreamingWatchScreen({
  duo, code, myRole, pushWatch, submitRating, onBack, onEndWatch,
}) {
  const s = duo.session;
  const partner = other(myRole) === 'A' ? duo.nameA : duo.nameB;
  const partnerRole = other(myRole);
  const busRef = useRef(null);
  const lastPushed = useRef(0);
  const sessionRef = useRef(s);
  const startedAtRef = useRef(s.startedAt || Date.now());
  const applyingRemote = useRef(false);
  useEffect(() => { sessionRef.current = s; }, [s]);

  const [title, setTitle] = useState(s.media?.title || '');
  const [url, setUrl] = useState(s.media?.url || '');
  const [reactions, setReactions] = useState([]);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [showSparks, setShowSparks] = useState(!!s.interactive?.on);
  const [extConnected, setExtConnected] = useState(false);
  const [extStatus, setExtStatus] = useState('');
  const [xpDone, setXpDone] = useState(false);
  const [bestReaction, setBestReaction] = useState(null);

  const myBridge = s.bridge?.[myRole] || 'none';
  const cap = resolveCapability({
    sessionCap: s.capability,
    platformId: s.platform,
    bridge: myBridge === 'ext' || extConnected ? 'ext' : 'web',
  });
  const platName = platformLabel(s.platform);
  const modeTitle = watchModeTitle(s);
  const desktopChrome = isDesktopChromium();
  const canOfferExt = desktopChrome && s.platform === 'netflix';

  useEffect(() => {
    if (!code) return undefined;
    let alive = true;
    watchChannel(code).then(ch => {
      if (!alive) { ch.close(); return; }
      busRef.current = ch;
      ch.on(msg => {
        if (!msg) return;
        if (msg.t === 'react') {
          const id = (msg.at || 0) + '-' + msg.by;
          setReactions(list => [...list, { id, e: msg.e }]);
          setBestReaction(msg.e);
          setTimeout(() => setReactions(list => list.filter(x => x.id !== id)), 2200);
        }
      });
    });
    return () => {
      alive = false;
      try { busRef.current?.close(); } catch { /* */ }
    };
  }, [code, myRole]);

  /* Extension bridge — web tab owns Supabase; extension only reports playhead. */
  useEffect(() => {
    const unsub = onExtensionMessage((msg) => {
      if (msg.type === 'ext-hello') {
        setExtConnected(true);
        setExtStatus('Extension connected');
        const bridge = { ...(sessionRef.current.bridge || {}), [myRole]: 'ext' };
        const nextCap = resolveCapability({
          sessionCap: 2,
          platformId: sessionRef.current.platform,
          bridge: 'ext',
        });
        pushWatch({ bridge, capability: nextCap });
        return;
      }
      if (msg.type === 'tab-closed') {
        setExtConnected(false);
        setExtStatus('Streaming tab closed — back to coordination');
        const bridge = { ...(sessionRef.current.bridge || {}), [myRole]: 'web' };
        pushWatch({ bridge, capability: 3 });
        return;
      }
      if (msg.type === 'capability') {
        const level = Number(msg.level) || 3;
        // Higher number = weaker sync; trust adapter report (auto-downgrade included).
        pushWatch({ capability: level });
        return;
      }
      if (msg.type === 'playhead' && sessionRef.current.capability <= 2) {
        const sess = sessionRef.current;
        if (sess.phase !== 'playing') return;
        if (applyingRemote.current) return;
        const playing = !!msg.playing;
        const position = Number(msg.position) || 0;
        const now = Date.now();
        if (!shouldCommitLocal({
          playing, localTime: position, sess, lastPushedAt: lastPushed.current,
          now, kind: 'streaming',
        })) return;
        lastPushed.current = now;
        pushWatch(playheadPatch({ playing, position, at: now, by: myRole }));
      }
      if (msg.type === 'buffer' && msg.buffering) {
        setExtStatus(`${partner} buffering…`);
      }
    });
    postToExtension('web-hello', { code, role: myRole });
    return unsub;
  }, [code, myRole, partner, pushWatch]);

  /* Apply remote playhead → tell extension to seek/play/pause (L2). */
  useEffect(() => {
    if (cap > 2 || s.phase !== 'playing') return;
    if (!shouldApplyRemote(s, myRole)) return;
    applyingRemote.current = true;
    postToExtension('apply-playhead', {
      playing: !!s.playing,
      position: Number(s.position) || 0,
      at: s.at,
    });
    const t = setTimeout(() => { applyingRemote.current = false; }, 400);
    return () => clearTimeout(t);
  }, [s.playing, s.position, s.at, s.by, s.phase, myRole, cap]);

  /* Heartbeat from last actor when L2 + playing */
  useEffect(() => {
    if (cap > 2) return undefined;
    const timer = setInterval(() => {
      const sess = sessionRef.current;
      if (!shouldHeartbeat(sess, myRole)) return;
      postToExtension('request-playhead', {});
    }, HEARTBEAT_MS);
    return () => clearInterval(timer);
  }, [myRole, cap]);

  const saveMedia = async () => {
    const media = {
      ...(s.media || {}),
      title: title.trim() || platName,
      url: url.trim() || null,
      type: s.media?.type || 'unknown',
    };
    await pushWatch({
      media,
      mediaRef: { kind: 'streaming', id: s.platform, title: media.title },
    });
  };

  const markReady = async () => {
    await saveMedia();
    await pushWatch({
      ready: { ...(s.ready || { A: false, B: false }), [myRole]: true },
      bridge: {
        ...(s.bridge || { A: 'none', B: 'none' }),
        [myRole]: extConnected ? 'ext' : 'web',
      },
    });
  };

  const bothReady = !!(s.ready?.A && s.ready?.B);

  const beginCountdown = () => {
    if (!bothReady || countdown != null) return;
    setCountdown(COUNTDOWN_SECS);
  };

  useEffect(() => {
    if (countdown == null) return undefined;
    if (countdown <= 0) {
      pushWatch({
        phase: 'playing',
        playing: true,
        position: s.position || 0,
        at: Date.now(),
        by: myRole,
      });
      setCountdown(null);
      return undefined;
    }
    const t = setTimeout(() => setCountdown(c => (c == null ? null : c - 1)), 1000);
    return () => clearTimeout(t);
  }, [countdown]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Partner may push phase playing — clear local countdown */
  useEffect(() => {
    if (s.phase === 'playing') setCountdown(null);
  }, [s.phase]);

  const connectExtension = () => {
    const token = makeBindToken({ code, role: myRole });
    postToExtension('bind', { token, platform: s.platform });
    setExtStatus('Looking for DuoArcade extension… Open Netflix in another tab after installing.');
  };

  const syncNow = () => {
    if (cap > 2) return;
    postToExtension('request-playhead', { force: true });
    setExtStatus('Sync now sent');
  };

  const finishNight = async () => {
    setConfirmEnd(false);
    await pushWatch({ phase: 'verdict', playing: false });
  };

  const goAfterglow = async () => {
    const durationSec = Math.round((Date.now() - startedAtRef.current) / 1000);
    const memory = buildMemoryCard({
      title: s.media?.title || modeTitle,
      durationSec,
      starsA: s.ratings?.A,
      starsB: s.ratings?.B,
      bestReaction,
      mode: 'streaming',
      insight: s.interactive?.on
        ? 'Sparks on a streaming night — agreement over score.'
        : `Coordination night on ${platName}.`,
    });
    await pushWatch({ phase: 'afterglow', memory, playing: false });
    if (!xpDone && onEndWatch) {
      setXpDone(true);
      onEndWatch('watch_streaming');
    }
  };

  useEffect(() => {
    if (s.phase !== 'verdict') return;
    const a = s.ratings?.A; const b = s.ratings?.B;
    if (a != null && b != null && !s.memory) {
      const t = setTimeout(() => { goAfterglow(); }, 1800);
      return () => clearTimeout(t);
    }
  }, [s.phase, s.ratings?.A, s.ratings?.B]); // eslint-disable-line react-hooks/exhaustive-deps

  const mine = s.ratings?.[myRole] ?? null;
  const theirs = s.ratings?.[partnerRole] ?? null;

  const toggleSparks = () => {
    if (s.interactive?.on) {
      pushWatch({ interactive: { on: false } });
      setShowSparks(false);
    } else {
      setShowSparks(true);
    }
  };

  if (s.phase === 'afterglow' && s.memory) {
    return (
      <section className="on wp-screen wp-streaming">
        <div className="gv-top">
          <button className="btn small ghost" onClick={onBack}>{'←'} Back</button>
          <div className="gv-title h3 cw-title">Afterglow</div>
        </div>
        <WatchMemoryCard memory={s.memory} partnerName={partner} onDone={onBack} />
      </section>
    );
  }

  return (
    <section className="on wp-screen wp-streaming">
      <div className="gv-top">
        <button className="btn small ghost" onClick={() => setConfirmEnd(true)}>{'←'} Back</button>
        <div className="gv-title h3 cw-title">{modeTitle}</div>
        {s.phase === 'playing' && (
          <div className="wp-top-actions">
            <button
              type="button"
              className={'btn small' + (s.interactive?.on || showSparks ? ' warm' : ' ghost')}
              onClick={toggleSparks}
            >
              Sparks
            </button>
            <button type="button" className="btn small warm" onClick={() => setConfirmEnd(true)}>
              End night
            </button>
          </div>
        )}
      </div>

      <div className="wp-cap-chip" title={capabilityBlurb(cap, s.platform)}>
        <span className={'wp-cap-dot L' + cap} />
        {capabilityLabel(cap)}
        <span className="wp-muted"> · {platName}</span>
      </div>
      <p className="wp-streaming-honest">{capabilityBlurb(cap, s.platform)}</p>

      {confirmEnd && (
        <div className="wp-end-confirm">
          <p>End {modeTitle}?</p>
          <div className="row">
            <button type="button" className="btn warm small" onClick={finishNight}>Finish & rate</button>
            <button type="button" className="btn ghost small" onClick={() => setConfirmEnd(false)}>Keep watching</button>
          </div>
        </div>
      )}

      {(s.phase === 'lobby' || s.phase === 'playing') && (
        <>
          <div className="wp-streaming-lobby">
            {s.phase === 'lobby' && (
              <>
                <p className="wp-movie-ritual">
                  Open the same title on {platName} with your own account. Then mark ready.
                </p>
                <label className="wp-field-label" htmlFor="streamTitle">What are we watching?</label>
                <input
                  id="streamTitle"
                  type="text"
                  placeholder="Title of the movie or show"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  onBlur={saveMedia}
                />
                <label className="wp-field-label" htmlFor="streamUrl">Optional watch link</label>
                <input
                  id="streamUrl"
                  type="text"
                  placeholder={`${platformHomeUrl(s.platform)}…`}
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  onBlur={saveMedia}
                />
              </>
            )}

            <div className="row wp-streaming-actions">
              <button
                type="button"
                className="btn warm small"
                onClick={() => openStreamingContent({ platform: s.platform, url: url || s.media?.url })}
              >
                Open {platName}
              </button>
              {s.phase === 'lobby' && (
                <button type="button" className="btn small" onClick={markReady}>
                  {s.ready?.[myRole] ? 'Ready ✓' : 'I’m ready'}
                </button>
              )}
              {cap <= 2 && s.phase === 'playing' && (
                <button type="button" className="btn small ghost" onClick={syncNow}>Sync now</button>
              )}
            </div>

            {canOfferExt && (
              <div className="wp-ext-coach">
                <p>
                  Want play/pause sync on desktop? Install the DuoArcade Watch extension,
                  open Netflix, then connect.
                </p>
                <div className="row">
                  <button type="button" className="btn ghost small" onClick={connectExtension}>
                    {extConnected ? 'Extension linked' : 'Connect extension'}
                  </button>
                </div>
                {extStatus && <div className="status">{extStatus}</div>}
              </div>
            )}

            {!desktopChrome && (
              <p className="wp-hint">
                On mobile, {platName} plays in its app. DuoArcade handles the countdown, reactions, Sparks, and Memory.
              </p>
            )}

            <div className="wp-ready-row">
              <span className={s.ready?.A ? 'on' : ''}>{duo.nameA || 'A'} {s.ready?.A ? '● Ready' : '○'}</span>
              <span className={s.ready?.B ? 'on' : ''}>{duo.nameB || 'B'} {s.ready?.B ? '● Ready' : '○'}</span>
            </div>

            {s.phase === 'lobby' && countdown == null && (
              <button type="button" className="btn warm" disabled={!bothReady} onClick={beginCountdown}>
                {bothReady ? 'Start together' : `Waiting for ${partner}…`}
              </button>
            )}

            {countdown != null && countdown > 0 && (
              <div className="wp-countdown" aria-live="polite">{countdown}</div>
            )}
            {countdown === 0 && (
              <div className="wp-countdown go">Watch together</div>
            )}

            {s.phase === 'playing' && s.media?.title && (
              <p className="wp-streaming-now">
                Watching <b>{s.media.title}</b>
                {s.media.season != null ? ` · S${s.media.season}` : ''}
                {s.media.episode != null ? `E${s.media.episode}` : ''}
              </p>
            )}
          </div>

          <div className="wp-streaming-companion">
            <div className="react-lane">
              {reactions.map(r => <div className="float-emoji" key={r.id}>{r.e}</div>)}
            </div>
            {(s.phase === 'playing' || s.phase === 'lobby') && (
              <div className="react-row">
                {['❤️', '😂', '😱', '🍿'].map(e => (
                  <button
                    key={e}
                    type="button"
                    className="emoji-btn"
                    onClick={() => busRef.current?.send(reactPayload(e, myRole))}
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
            <p className="wp-hint">Keep DuoArcade beside {platName} — this is your couple layer.</p>
          </div>
        </>
      )}

      {showSparks && s.phase === 'playing' && (
        <SparksOverlay
          duo={duo}
          myRole={myRole}
          interactive={s.interactive || { on: false }}
          pushInteractive={(interactive) => pushWatch({ interactive })}
          positionSec={s.position || 0}
          onClose={() => setShowSparks(false)}
        />
      )}

      {s.phase === 'verdict' && (
        <div className="verdict">
          {mine != null && theirs != null && Math.abs(mine - theirs) <= 1 && (
            <div className="cw-reveal"><Confetti count={24} small /></div>
          )}
          <h3>The Verdict</h3>
          <p>Rate it blind — agreement feeds your taste match.</p>
          <div className="stars">
            {[1, 2, 3, 4, 5].map(i => (
              <button
                key={i}
                className={'star' + (mine && i <= mine ? ' on' : '')}
                disabled={mine !== null}
                onClick={() => submitRating(i)}
              >
                {'★'}
              </button>
            ))}
          </div>
          <div className="verdict-result">
            {mine != null && theirs != null
              ? <>You {mine}★ · {partner} {theirs}★</>
              : mine != null ? 'Waiting for partner…' : ''}
          </div>
          {mine != null && theirs != null && (
            <button type="button" className="btn warm small" onClick={goAfterglow}>See memory</button>
          )}
        </div>
      )}
    </section>
  );
}
