import { useEffect, useRef, useState } from 'react';
import { other } from '../lib/util.js';
import { Confetti } from './CoupleFx.jsx';
import {
  shouldCommitLocal, shouldApplyRemote, shouldHeartbeat,
  HEARTBEAT_MS, applyRemotePlayhead, needsSeek,
} from '../lib/watchSync.js';
import { watchChannel, reactPayload, bufferPayload } from '../lib/watchBroadcast.js';
import {
  fingerprintFile, upsertMovieNight,
  listMovieComments, addMovieComment,
  uploadMovieAsset, getMoviePassQuota, checkMovieUploadQuota,
} from '../lib/watchMovie.js';
import { buildMemoryCard } from '../lib/watchSessions.js';
import WatchMemoryCard from './WatchMemoryCard.jsx';

export default function MovieNightScreen({
  duo, code, myRole, pushWatch, submitRating, onBack, onEndWatch,
}) {
  const s = duo.session;
  const partner = other(myRole) === 'A' ? duo.nameA : duo.nameB;
  const partnerRole = other(myRole);
  const videoRef = useRef(null);
  const objectUrl = useRef(null);
  const busRef = useRef(null);
  const applyingRemote = useRef(false);
  const lastPushed = useRef(0);
  const sessionRef = useRef(s);
  const startedAtRef = useRef(s.startedAt || Date.now());
  useEffect(() => { sessionRef.current = s; }, [s]);

  const [localFp, setLocalFp] = useState(null);
  const [fileName, setFileName] = useState('');
  const [status, setStatus] = useState('');
  const [partnerBuffer, setPartnerBuffer] = useState(false);
  const [reactions, setReactions] = useState([]);
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState([]);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [xpDone, setXpDone] = useState(false);
  const [cozy] = useState(true);
  const [showPassUpload, setShowPassUpload] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploading, setUploading] = useState(false);
  const passQuota = getMoviePassQuota(duo.passTier);

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
        if (msg.t === 'buffer' && msg.by !== myRole) {
          setPartnerBuffer(!!msg.buffering);
        }
      });
    });
    return () => {
      alive = false;
      try { busRef.current?.close(); } catch { /* */ }
      if (objectUrl.current) {
        URL.revokeObjectURL(objectUrl.current);
        objectUrl.current = null;
      }
    };
  }, [code, myRole]);

  useEffect(() => {
    if (!code || !s.nightId) return;
    listMovieComments(code, s.nightId).then(setComments).catch(() => {});
  }, [code, s.nightId, s.phase]);

  const onPickFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus('Fingerprinting…');
    try {
      const fp = await fingerprintFile(file);
      setLocalFp(fp);
      setFileName(file.name);
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = URL.createObjectURL(file);
      if (videoRef.current) videoRef.current.src = objectUrl.current;

      const match = s.fingerprint && s.fingerprint === fp.hash;
      const patch = {
        ready: { ...(s.ready || { A: false, B: false }), [myRole]: true },
      };
      if (!s.fingerprint || s.by === myRole) {
        patch.fingerprint = fp.hash;
        patch.title = file.name.replace(/\.[^.]+$/, '') || 'Our film';
        patch.sizeLabel = fp.sizeLabel;
        patch.mediaRef = { kind: 'local', id: fp.hash };
        patch.friendly = fp.friendly;
      }
      if (s.fingerprint && s.fingerprint !== fp.hash) {
        setStatus('Files don’t match — check it’s the same export, not a trailer.');
      } else {
        setStatus(match || !s.fingerprint
          ? `Ready · ${fp.friendly} · ${fp.sizeLabel}`
          : `Waiting for ${partner} — look for ${s.friendly || 'same fingerprint'}…`);
      }
      await pushWatch(patch);

      if (code) {
        try {
          const row = await upsertMovieNight(code, {
            fingerprint: fp.hash,
            title: file.name,
            sizeLabel: fp.sizeLabel,
            position: s.position || 0,
          });
          if (row?.id) await pushWatch({ nightId: row.id });
        } catch { /* schema optional */ }
      }
    } catch (err) {
      setStatus(err.message || 'Could not read file');
    }
  };

  /** Optional Pass cloud path — not the default; local dual-file stays primary. */
  const onPassUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !code) return;
    const gate = checkMovieUploadQuota(duo.passTier, file.size);
    if (!gate.ok) {
      setUploadStatus(gate.message);
      return;
    }
    setUploading(true);
    setUploadStatus('Registering & uploading…');
    try {
      const result = await uploadMovieAsset(code, file, { passTier: duo.passTier });
      if (!result.ok) {
        setUploadStatus(result.message || 'Cloud upload coming soon with Duo Pass.');
        return;
      }
      setUploadStatus(result.message || 'Uploaded');
      // Still play locally from the chosen file (HLS not wired).
      await onPickFile({ target: { files: [file] } });
      if (result.path) {
        await pushWatch({
          mediaRef: { kind: 'cloud', id: result.fingerprint?.hash, path: result.path },
          assetId: result.asset?.id || null,
        });
      }
    } catch (err) {
      setUploadStatus(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const bothReady = s.ready?.A && s.ready?.B
    && localFp && s.fingerprint && localFp.hash === s.fingerprint;

  const startPlaying = async () => {
    if (!bothReady) return;
    await pushWatch({
      phase: 'playing',
      playing: false,
      position: s.position || 0,
      at: Date.now(),
      by: myRole,
    });
  };

  /* resume Continuity: session may already be playing with saved position */
  useEffect(() => {
    const v = videoRef.current;
    if (!v || s.phase !== 'playing' || !objectUrl.current) return;
    if (s.position > 1 && Math.abs(v.currentTime - s.position) > 1.5) {
      v.currentTime = s.position;
    }
  }, [s.phase, objectUrl.current]); // eslint-disable-line react-hooks/exhaustive-deps

  const commitPlayhead = (playing, position) => {
    const now = Date.now();
    const sess = sessionRef.current;
    if (!shouldCommitLocal({
      playing, localTime: position, sess, lastPushedAt: lastPushed.current, now, kind: 'movie',
    })) return;
    lastPushed.current = now;
    pushWatch({ playing, position, at: now, by: myRole });
  };

  const onPlay = () => commitPlayhead(true, videoRef.current?.currentTime || 0);
  const onPause = () => commitPlayhead(false, videoRef.current?.currentTime || 0);
  const onSeeked = () => {
    const v = videoRef.current;
    if (!v || applyingRemote.current) return;
    commitPlayhead(!v.paused, v.currentTime);
  };

  const onWaiting = () => {
    busRef.current?.send(bufferPayload(myRole, true));
  };
  const onCanPlay = () => {
    busRef.current?.send(bufferPayload(myRole, false));
  };

  useEffect(() => {
    if (s.phase !== 'playing') return;
    if (!shouldApplyRemote(s, myRole)) return;
    const v = videoRef.current;
    if (!v) return;
    applyingRemote.current = true;
    try {
      applyRemotePlayhead({
        getCurrentTime: () => v.currentTime,
        seekTo: (t) => { if (needsSeek(v.currentTime, s, 'movie')) v.currentTime = t; },
        play: () => { v.play().catch(() => {}); },
        pause: () => { v.pause(); },
      }, s, 'movie');
    } finally {
      setTimeout(() => { applyingRemote.current = false; }, 400);
    }
  }, [s.playing, s.position, s.at, s.by, s.phase, myRole]);

  useEffect(() => {
    const timer = setInterval(() => {
      const sess = sessionRef.current;
      const v = videoRef.current;
      if (!shouldHeartbeat(sess, myRole) || !v || sess.type !== 'movie') return;
      if (v.paused) return;
      pushWatch({ playing: true, position: v.currentTime, at: Date.now(), by: myRole });
      if (code && sess.fingerprint) {
        upsertMovieNight(code, {
          fingerprint: sess.fingerprint,
          title: sess.title,
          sizeLabel: sess.sizeLabel,
          position: v.currentTime,
          duration: Number.isFinite(v.duration) ? v.duration : null,
        }).catch(() => {});
      }
    }, HEARTBEAT_MS);
    return () => clearInterval(timer);
  }, [myRole, pushWatch, code]);

  const finishFilm = async () => {
    setConfirmEnd(false);
    if (videoRef.current) videoRef.current.pause();
    await pushWatch({ phase: 'verdict', playing: false });
  };

  const goAfterglow = async () => {
    const memory = buildMemoryCard({
      title: s.title || 'Movie Night',
      durationSec: Math.round((Date.now() - startedAtRef.current) / 1000),
      starsA: s.ratings?.A,
      starsB: s.ratings?.B,
      mode: 'movie',
    });
    await pushWatch({ phase: 'afterglow', memory });
    if (!xpDone && onEndWatch) {
      setXpDone(true);
      onEndWatch('watch_movie');
    }
  };

  useEffect(() => {
    if (s.phase !== 'verdict') return;
    if (s.ratings?.A != null && s.ratings?.B != null && !s.memory) {
      const t = setTimeout(() => goAfterglow(), 1600);
      return () => clearTimeout(t);
    }
  }, [s.phase, s.ratings?.A, s.ratings?.B]); // eslint-disable-line react-hooks/exhaustive-deps

  const postComment = async () => {
    const body = comment.trim();
    if (!body || !s.nightId) return;
    const atSec = Math.floor(videoRef.current?.currentTime || s.position || 0);
    try {
      await addMovieComment(code, s.nightId, { atSec, body, by: myRole });
      setComment('');
      setComments(await listMovieComments(code, s.nightId));
    } catch (err) {
      setStatus(err.message || 'Comment failed');
    }
  };

  const mine = s.ratings?.[myRole] ?? null;
  const theirs = s.ratings?.[partnerRole] ?? null;

  if (s.phase === 'afterglow' && s.memory) {
    return (
      <section className={'on wp-screen wp-movie' + (cozy ? ' cozy' : '')}>
        <div className="gv-top">
          <button className="btn small ghost" onClick={onBack}>{'←'} Back</button>
          <div className="gv-title h3 cw-title">Afterglow</div>
        </div>
        <WatchMemoryCard memory={s.memory} partnerName={partner} onDone={onBack} />
      </section>
    );
  }

  return (
    <section className={'on wp-screen wp-movie' + (cozy ? ' cozy' : '')}>
      <div className="gv-top">
        <button className="btn small ghost" onClick={() => setConfirmEnd(true)}>{'←'} Back</button>
        <div className="gv-title h3 cw-title">Movie Night</div>
        {s.phase === 'playing' && (
          <button type="button" className="btn small warm" onClick={() => setConfirmEnd(true)}>End night</button>
        )}
      </div>

      {confirmEnd && (
        <div className="wp-end-confirm">
          <p>End Movie Night?</p>
          <div className="row">
            <button type="button" className="btn warm small" onClick={finishFilm}>Finish & rate</button>
            <button type="button" className="btn ghost small" onClick={() => setConfirmEnd(false)}>Keep watching</button>
          </div>
        </div>
      )}

      {(s.phase === 'lobby' || s.phase === 'playing') && (
        <>
          <div className="wp-movie-lobby">
            <p className="wp-movie-ritual">
              Pick the same file on both devices
              {s.friendly ? <> — look for <b>{s.friendly}</b>{s.sizeLabel ? ` · ${s.sizeLabel}` : ''}</> : null}
            </p>
            <label className="btn warm small wp-file-btn">
              Choose file
              <input type="file" accept="video/*" hidden onChange={onPickFile} />
            </label>
            {fileName && <span className="wp-muted">{fileName}</span>}
            <p className="wp-hint">On phones: Files app / Downloads.</p>
            {status && <div className="status">{status}</div>}

            <div className="wp-pass-upload">
              <button
                type="button"
                className="btn ghost small"
                onClick={() => setShowPassUpload(v => !v)}
              >
                {showPassUpload ? 'Hide Pass upload' : 'Optional · Pass cloud upload'}
              </button>
              {showPassUpload && (
                <div className="wp-pass-upload-body">
                  <p className="wp-hint">
                    {passQuota.cloudUpload
                      ? `${passQuota.label}. HLS streaming comes later — file still plays locally after upload.`
                      : passQuota.label}
                  </p>
                  {passQuota.cloudUpload ? (
                    <label className={'btn small wp-file-btn' + (uploading ? ' disabled' : '')}>
                      {uploading ? 'Uploading…' : 'Upload to Pass storage'}
                      <input
                        type="file"
                        accept="video/*"
                        hidden
                        disabled={uploading}
                        onChange={onPassUpload}
                      />
                    </label>
                  ) : (
                    <p className="wp-muted">Coming soon with Duo Pass — keep the local same-file path for free.</p>
                  )}
                  {uploadStatus && <div className="status">{uploadStatus}</div>}
                </div>
              )}
            </div>

            <div className="wp-ready-row">
              <span className={s.ready?.A ? 'on' : ''}>{duo.nameA || 'A'} {s.ready?.A ? '✓' : '…'}</span>
              <span className={s.ready?.B ? 'on' : ''}>{duo.nameB || 'B'} {s.ready?.B ? '✓' : '…'}</span>
            </div>
            {s.phase === 'lobby' && (
              <button type="button" className="btn warm" disabled={!bothReady} onClick={startPlaying}>
                {bothReady ? 'Dim the lights' : `Waiting for ${partner} to sit down…`}
              </button>
            )}
          </div>

          <div className={'player-outer' + (partnerBuffer ? ' buffering' : '')}>
            <div className={'player-wrap' + (s.playing ? ' live' : '')}>
              <video
                ref={videoRef}
                playsInline
                controls
                onPlay={onPlay}
                onPause={onPause}
                onSeeked={onSeeked}
                onWaiting={onWaiting}
                onCanPlay={onCanPlay}
              />
            </div>
            {partnerBuffer && (
              <div className="wp-buffer-ritual">We’ll wait together — {partner} is buffering…</div>
            )}
            <div className="react-lane">
              {reactions.map(r => <div className="float-emoji" key={r.id}>{r.e}</div>)}
            </div>
          </div>

          {s.phase === 'playing' && (
            <>
              <div className="react-row">
                {['😂', '😱', '❤️', '🍿'].map(e => (
                  <button key={e} type="button" className="emoji-btn"
                    onClick={() => busRef.current?.send(reactPayload(e, myRole))}>{e}</button>
                ))}
              </div>
              {s.nightId && (
                <div className="wp-movie-comments">
                  <div className="shelf-title">Whispers</div>
                  <div className="wp-comment-list">
                    {comments.map(c => (
                      <div key={c.id} className="wp-comment">
                        <span className="wp-comment-at">{fmtTime(c.at_sec)}</span>
                        <span>{c.body}</span>
                      </div>
                    ))}
                  </div>
                  <div className="wp-comment-compose">
                    <input
                      type="text"
                      placeholder="Timestamp note…"
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') postComment(); }}
                    />
                    <button type="button" className="btn small" onClick={postComment}>Pin</button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
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

function fmtTime(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}
