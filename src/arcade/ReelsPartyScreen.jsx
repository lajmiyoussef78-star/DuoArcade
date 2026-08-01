import { useEffect, useRef, useState } from 'react';
import { other } from '../lib/util.js';
import { Confetti } from './CoupleFx.jsx';
import { watchChannel, reactPayload, laughPayload, swipePayload } from '../lib/watchBroadcast.js';
import { remoteLockUntil } from '../lib/watchSync.js';
import {
  parseReelUrl, capQueue, reelEmbedSrc, listReelFavorites, saveReelFavorite, twinTasteBurst,
} from '../lib/watchReels.js';
import { buildMemoryCard } from '../lib/watchSessions.js';
import WatchMemoryCard from './WatchMemoryCard.jsx';

const LAUGH_DEBOUNCE_MS = 300;

export default function ReelsPartyScreen({
  duo, code, myRole, pushWatch, submitRating, onBack, onEndWatch,
}) {
  const s = duo.session;
  const queue = s.queue || [];
  const index = Math.min(s.index || 0, Math.max(0, queue.length - 1));
  const clip = queue[index] || null;
  const partner = other(myRole) === 'A' ? duo.nameA : duo.nameB;
  const partnerRole = other(myRole);

  const busRef = useRef(null);
  const lockUntil = useRef(0);
  const laughBuf = useRef(0);
  const laughTimer = useRef(null);
  const lastTap = useRef(0);
  const pressTimer = useRef(null);
  const startedAtRef = useRef(s.startedAt || Date.now());

  const [paste, setPaste] = useState('');
  const [status, setStatus] = useState('');
  const [reactions, setReactions] = useState([]);
  const [twin, setTwin] = useState(false);
  const [showClips, setShowClips] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [swipeNote, setSwipeNote] = useState('');
  const [xpDone, setXpDone] = useState(false);

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
          setTimeout(() => setReactions(list => list.filter(x => x.id !== id)), 2200);
        }
        if (msg.t === 'swipe' && msg.by !== myRole) {
          lockUntil.current = remoteLockUntil('reels');
          const who = msg.by === 'A' ? duo.nameA : duo.nameB;
          setSwipeNote(`${who || 'Partner'} skipped`);
          setTimeout(() => setSwipeNote(''), 1800);
        }
        if (msg.t === 'laugh' && msg.by !== myRole) {
          // partner laugh already in session via occasional sync; float only
        }
      });
    });
    listReelFavorites(code).then(rows => { if (alive) setFavorites(rows); }).catch(() => {});
    return () => {
      alive = false;
      try { busRef.current?.close(); } catch { /* */ }
    };
  }, [code, myRole, duo.nameA, duo.nameB]);

  const addClip = async (raw) => {
    const parsed = parseReelUrl(raw);
    if (!parsed) {
      setStatus('Paste a YouTube Shorts, TikTok, or Instagram link.');
      return;
    }
    if (queue.some(c => c.id === parsed.id)) {
      setStatus('Already in the queue.');
      return;
    }
    if (queue.length >= 30) {
      setStatus('Queue is full (30 clips).');
      return;
    }
    const next = capQueue([...queue, parsed]);
    setPaste('');
    setStatus(parsed.embedOk
      ? ''
      : 'Best with YouTube Shorts — TikTok/IG links still sync your queue & reactions.');
    await pushWatch({
      queue: next,
      mediaRef: { kind: 'reels', id: next[index]?.id || parsed.id },
      by: myRole,
      at: Date.now(),
    });
  };

  const goIndex = async (nextIndex, dir) => {
    if (!queue.length) return;
    const i = Math.max(0, Math.min(queue.length - 1, nextIndex));
    busRef.current?.send(swipePayload(myRole, i, dir));
    await pushWatch({
      index: i,
      mediaRef: { kind: 'reels', id: queue[i]?.id || null },
      position: 0,
      at: Date.now(),
      by: myRole,
      playing: true,
    });
  };

  const onDoubleTapLike = async () => {
    if (!clip) return;
    const now = Date.now();
    const likes = { ...(s.likes || {}) };
    const entry = { ...(likes[clip.id] || {}) };
    entry[myRole] = now;
    likes[clip.id] = entry;
    await pushWatch({ likes });
    if (twinTasteBurst(entry)) {
      setTwin(true);
      setTimeout(() => setTwin(false), 2200);
    }
    busRef.current?.send(reactPayload('❤️', myRole));
  };

  const onPointerDown = () => {
    pressTimer.current = setTimeout(async () => {
      if (!clip || !code) return;
      try {
        await saveReelFavorite(code, clip);
        setFavorites(await listReelFavorites(code));
        setStatus('Saved to Our Clips');
      } catch (e) {
        setStatus(e.message || 'Could not save clip');
      }
    }, 550);
  };
  const onPointerUp = () => {
    clearTimeout(pressTimer.current);
  };

  const onSurfaceClick = () => {
    const now = Date.now();
    if (now - lastTap.current < 320) {
      onDoubleTapLike();
      lastTap.current = 0;
    } else {
      lastTap.current = now;
    }
  };

  const flushLaugh = () => {
    const n = laughBuf.current;
    laughBuf.current = 0;
    if (!n) return;
    busRef.current?.send(laughPayload(myRole, n));
    const laugh = { ...(s.laugh || { A: 0, B: 0 }) };
    laugh[myRole] = (laugh[myRole] || 0) + n;
    pushWatch({ laugh });
  };

  const tapLaugh = () => {
    laughBuf.current += 1;
    clearTimeout(laughTimer.current);
    laughTimer.current = setTimeout(flushLaugh, LAUGH_DEBOUNCE_MS);
  };

  const finishParty = async () => {
    setConfirmEnd(false);
    await pushWatch({ phase: 'verdict', playing: false });
  };

  const goAfterglow = async () => {
    let top = clip;
    let best = 0;
    for (const c of queue) {
      const e = s.likes?.[c.id];
      const score = (e?.A ? 1 : 0) + (e?.B ? 1 : 0);
      if (score > best) { best = score; top = c; }
    }
    const memory = buildMemoryCard({
      title: top?.title || 'Reels Party',
      durationSec: Math.round((Date.now() - startedAtRef.current) / 1000),
      starsA: s.ratings?.A,
      starsB: s.ratings?.B,
      bestReaction: '😂',
      mode: 'reels',
      insight: best >= 2 ? `Our top clip: ${top?.title || 'shared favorite'}` : null,
    });
    await pushWatch({ phase: 'afterglow', memory });
    if (!xpDone && onEndWatch) {
      setXpDone(true);
      onEndWatch('watch_reels');
    }
  };

  useEffect(() => {
    if (s.phase !== 'verdict') return;
    if (s.ratings?.A != null && s.ratings?.B != null && !s.memory) {
      const t = setTimeout(() => goAfterglow(), 1600);
      return () => clearTimeout(t);
    }
  }, [s.phase, s.ratings?.A, s.ratings?.B]); // eslint-disable-line react-hooks/exhaustive-deps

  const mine = s.ratings?.[myRole] ?? null;
  const theirs = s.ratings?.[partnerRole] ?? null;
  const laughA = s.laugh?.A || 0;
  const laughB = s.laugh?.B || 0;
  const laughTotal = laughA + laughB;
  const embed = reelEmbedSrc(clip);
  const upNext = queue[index + 1];

  if (s.phase === 'afterglow' && s.memory) {
    return (
      <section className="on wp-screen wp-reels">
        <div className="gv-top">
          <button className="btn small ghost" onClick={onBack}>{'←'} Back</button>
          <div className="gv-title h3 cw-title">Afterglow</div>
        </div>
        <WatchMemoryCard memory={s.memory} partnerName={partner} onDone={onBack} />
      </section>
    );
  }

  return (
    <section className="on wp-screen wp-reels">
      <div className="gv-top">
        <button className="btn small ghost" onClick={() => setConfirmEnd(true)}>{'←'} Back</button>
        <div className="gv-title h3 cw-title">Reels Party</div>
        <button className="btn small warm" type="button" onClick={() => setConfirmEnd(true)}>End party</button>
      </div>

      {confirmEnd && s.phase === 'playing' && (
        <div className="wp-end-confirm">
          <p>End Reels Party and pick a night verdict?</p>
          <div className="row">
            <button type="button" className="btn warm small" onClick={finishParty}>Finish & rate</button>
            <button type="button" className="btn ghost small" onClick={() => setConfirmEnd(false)}>Keep scrolling</button>
          </div>
        </div>
      )}

      {s.phase === 'playing' && (
        <>
          <div className="wp-reels-add">
            <input
              type="text"
              placeholder="Drop a Shorts link…"
              value={paste}
              onChange={e => setPaste(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addClip(paste); }}
            />
            <button type="button" className="btn warm small" onClick={() => addClip(paste)}>Add</button>
            <button type="button" className="btn ghost small" onClick={() => setShowClips(v => !v)}>Our Clips</button>
          </div>
          {status && <div className="status wp-reels-status">{status}</div>}
          <p className="wp-reels-honest">
            Best with YouTube Shorts — TikTok & Instagram links still sync your queue & reactions (open externally).
          </p>

          {showClips && (
            <div className="wp-our-clips">
              <div className="shelf-title">Our Clips</div>
              {!favorites.length && <p className="wp-muted">Long-press a clip to save it here.</p>}
              {favorites.map(f => (
                <button
                  key={f.clip_id || f.id}
                  type="button"
                  className="wp-clip-row"
                  onClick={() => addClip(f.url)}
                >
                  {f.title || f.kind} — queue it
                </button>
              ))}
            </div>
          )}

          <div
            className="wp-reels-stage"
            onClick={onSurfaceClick}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {twin && (
              <div className="wp-twin">
                <Confetti count={28} small />
                <span>Twin taste</span>
              </div>
            )}
            {reactions.map(r => <div className="float-emoji wp-reels-float" key={r.id}>{r.e}</div>)}
            {!clip && (
              <div className="wp-reels-empty">
                <h3>Drop a Shorts link</h3>
                <p>Or pick from Our Clips. You’re always in your duo room — no codes.</p>
              </div>
            )}
            {clip && embed && (
              <iframe title="reel" src={embed} allow="autoplay; encrypted-media" allowFullScreen />
            )}
            {clip && !embed && (
              <div className="wp-reels-external">
                <h3>{clip.title}</h3>
                <p>Synced in your queue. Open on the original app:</p>
                <a className="btn warm small" href={clip.url} target="_blank" rel="noreferrer">Open clip</a>
              </div>
            )}
            {swipeNote && <div className="wp-swipe-note">{swipeNote}</div>}
          </div>

          <div className="wp-reels-nav">
            <button type="button" className="btn small" disabled={index <= 0} onClick={() => goIndex(index - 1, -1)}>Prev</button>
            <span className="wp-reels-idx">{queue.length ? `${index + 1} / ${queue.length}` : '0'}</span>
            <button type="button" className="btn small" disabled={index >= queue.length - 1} onClick={() => goIndex(index + 1, 1)}>Next</button>
          </div>

          {upNext && (
            <div className="wp-up-next">Up next: {upNext.title || 'clip'}</div>
          )}

          <div className="wp-laugh">
            <button type="button" className="btn warm small" onClick={tapLaugh}>😂 Laugh</button>
            <div className="wp-laugh-meter" aria-hidden="true">
              <div className="wp-laugh-fill" style={{ width: `${Math.min(100, laughTotal * 4)}%` }} />
            </div>
            <span className="wp-laugh-count">{laughTotal}</span>
          </div>
          <p className="wp-hint">Double-tap to like · Long-press to save to Our Clips</p>
        </>
      )}

      {s.phase === 'verdict' && (
        <div className="verdict">
          <h3>Night verdict</h3>
          <p>How was this Reels Party?</p>
          <div className="stars">
            {[1, 2, 3, 4, 5].map(i => (
              <button key={i} className={'star' + (mine && i <= mine ? ' on' : '')}
                disabled={mine !== null} onClick={() => submitRating(i)}>{'★'}</button>
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
