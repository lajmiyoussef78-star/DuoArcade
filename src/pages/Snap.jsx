// src/pages/Snap.jsx — Duo Snap hub: countdown, capture, reveal, settings, history.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  BUSY_REASONS, DEFAULT_SNAP_SETTINGS, INTERVAL_PRESETS, PAUSE_PRESETS, REACT_EMOJIS,
  WINDOW_PRESETS, clearDuoSnapHistory, deleteDuoSnap, downloadTodayDiptych,
  duoNames, formatClock, formatDayTime, formatRemaining, getDuoSnapState,
  listDuoSnapHistory, listDuoSnapPauses, maybeNotifyDuoSnap, myRoleInDuo,
  partnerPhoto, pauseDuoSnap, pauseUntilIso, photoFor, reactDuoSnap, resumeDuoSnap,
  saveDuoSnapSettings, snapChannel, submitDuoSnap
} from '../lib/snaps.js';
import '../styles/snaps.css';

const SIZE = 720;

export default function Snap() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const wantCamera = searchParams.get('take') === '1';

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const channelRef = useRef(null);
  const notifiedRef = useRef(null);

  const [role, setRole] = useState(undefined);
  const [names, setNames] = useState({ A: 'A', B: 'B' });
  const [state, setState] = useState(null);
  const [history, setHistory] = useState([]);
  const [pauses, setPauses] = useState([]);
  const [month, setMonth] = useState('');
  const [err, setErr] = useState('');
  const [status, setStatus] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showPause, setShowPause] = useState(false);
  const [pauseReason, setPauseReason] = useState('');
  const [customPauseMins, setCustomPauseMins] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [phase, setPhase] = useState('hub');
  const [facing, setFacing] = useState('user');
  const [preview, setPreview] = useState(null);
  const [caption, setCaption] = useState('');
  const [commentDraft, setCommentDraft] = useState('');
  const [tick, setTick] = useState(Date.now());
  const [settingsDraft, setSettingsDraft] = useState(DEFAULT_SNAP_SETTINGS);
  const [customInterval, setCustomInterval] = useState('');

  const config = state?.config || DEFAULT_SNAP_SETTINGS;
  const round = state?.active || null;
  const last = state?.last_completed || null;
  const paused = !!state?.paused;
  const myPhoto = photoFor(role, round);
  const theirPhoto = partnerPhoto(role, round);
  const bothActive = !!(myPhoto && theirPhoto);
  const completedView = bothActive ? round : last;
  const partnerRole = role === 'A' ? 'B' : 'A';

  const backToDuo = useCallback(() => {
    navigate(`/app?duo=${encodeURIComponent(code)}`, { replace: true });
  }, [code, navigate]);

  const reload = useCallback(async () => {
    try {
      const s = await getDuoSnapState(code);
      setState(s);
      setErr('');
      if (s?.config) {
        setSettingsDraft({
          enabled: !!s.config.enabled,
          interval_mins: s.config.interval_mins,
          window_mins: s.config.window_mins,
          notify: !!s.config.notify,
          camera_pref: s.config.camera_pref || 'user',
          auto_save_device: !!s.config.auto_save_device
        });
        setFacing(s.config.camera_pref || 'user');
        maybeNotifyDuoSnap(s.config, s.active, notifiedRef);
      }
    } catch (e) {
      setErr(e.message || 'Could not load Duo Snap.');
    }
  }, [code]);

  const reloadHistory = useCallback(async () => {
    try {
      setHistory(await listDuoSnapHistory(code, month || null, 40));
      setPauses(await listDuoSnapPauses(code, 12));
    } catch { /* ignore */ }
  }, [code, month]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async (mode = facing) => {
    setErr('');
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false
      });
      streamRef.current = stream;
      setPhase('camera');
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch {
      setPhase('hub');
      setErr('Camera access was blocked. Allow the camera in your browser and try again.');
    }
  }, [facing, stopCamera]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await myRoleInDuo(code);
      if (!alive) return;
      setRole(r);
      if (!r) {
        setErr('Sign in as a member of this duo to use Duo Snap.');
        return;
      }
      setNames(await duoNames(code));
      await reload();
      await reloadHistory();
      const ch = await snapChannel(code);
      if (!alive) { ch.close(); return; }
      channelRef.current = ch;
      ch.on(m => {
        if (m.k === 'snap' || m.k === 'pause') {
          reload();
          reloadHistory();
        }
      });
    })();
    return () => {
      alive = false;
      channelRef.current?.close();
      stopCamera();
    };
  }, [code, reload, reloadHistory, stopCamera]);

  useEffect(() => {
    const t = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!wantCamera || !round || myPhoto || paused || !config.enabled) return;
    startCamera(config.camera_pref || 'user');
    setSearchParams({}, { replace: true });
  }, [wantCamera, round, myPhoto, paused, config.enabled, config.camera_pref, startCamera, setSearchParams]);

  useEffect(() => {
    const onVis = () => { if (!document.hidden) reload(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [reload]);

  useEffect(() => { reloadHistory(); }, [month, reloadHistory]);

  const countdownTarget = useMemo(() => {
    if (paused && config.paused_until) return new Date(config.paused_until).getTime();
    if (round?.expires_at && !myPhoto) return new Date(round.expires_at).getTime();
    if (config.next_fire_at) return new Date(config.next_fire_at).getTime();
    return null;
  }, [paused, config.paused_until, config.next_fire_at, round, myPhoto]);

  const remainLabel = countdownTarget != null
    ? formatRemaining(countdownTarget - tick)
    : '—';

  function captureFrame() {
    const v = videoRef.current;
    if (!v || !v.videoWidth || phase !== 'camera') return;
    const cv = document.createElement('canvas');
    cv.width = SIZE;
    cv.height = SIZE;
    const g = cv.getContext('2d');
    const m = Math.min(v.videoWidth, v.videoHeight);
    const sx = (v.videoWidth - m) / 2;
    const sy = (v.videoHeight - m) / 2;
    if (facing === 'user') {
      g.translate(SIZE, 0);
      g.scale(-1, 1);
    }
    g.drawImage(v, sx, sy, m, m, 0, 0, SIZE, SIZE);
    setPreview(cv.toDataURL('image/jpeg', 0.72));
    stopCamera();
    setPhase('preview');
  }

  async function confirmSubmit() {
    if (!preview || !round) return;
    setPhase('saving');
    setErr('');
    try {
      const res = await submitDuoSnap(code, round.id, preview, caption);
      channelRef.current?.send({ k: 'snap', by: role });
      setPreview(null);
      setCaption('');
      setPhase('hub');
      setStatus(res?.both ? 'Both snaps are in — reveal!' : 'Snap sent — waiting for your partner…');
      await reload();
      await reloadHistory();
    } catch (e) {
      setPhase('preview');
      setErr(e.message || 'Could not upload your snap.');
    }
  }

  async function saveSettings() {
    setErr('');
    try {
      const interval = customInterval
        ? Math.max(15, Math.min(10080, +customInterval))
        : settingsDraft.interval_mins;
      await saveDuoSnapSettings(code, { ...settingsDraft, interval_mins: interval });
      channelRef.current?.send({ k: 'snap' });
      setShowSettings(false);
      setCustomInterval('');
      setStatus('Settings saved');
      await reload();
    } catch (e) {
      setErr(e.message || 'Could not save settings.');
    }
  }

  async function doPause(preset) {
    setErr('');
    try {
      let until;
      if (preset === 'custom') {
        const mins = Math.max(15, Math.min(10080, +customPauseMins || 60));
        until = new Date(Date.now() + mins * 60_000).toISOString();
      } else {
        until = pauseUntilIso(preset);
      }
      const reasonRow = BUSY_REASONS.find(r => r.id === pauseReason);
      const reason = pauseReason === 'custom'
        ? (customReason.trim() || 'Busy')
        : (reasonRow ? `${reasonRow.emoji} ${reasonRow.label}` : null);
      await pauseDuoSnap(code, until, reason);
      channelRef.current?.send({ k: 'pause' });
      setShowPause(false);
      setStatus('Duo Snap paused');
      await reload();
      await reloadHistory();
    } catch (e) {
      setErr(e.message || 'Could not pause.');
    }
  }

  async function doResume() {
    try {
      await resumeDuoSnap(code);
      channelRef.current?.send({ k: 'pause' });
      setStatus('Duo Snap resumed');
      await reload();
    } catch (e) {
      setErr(e.message || 'Could not resume.');
    }
  }

  async function onReact(emoji) {
    if (!completedView?.id) return;
    try {
      await reactDuoSnap(code, completedView.id, { reaction: emoji });
      channelRef.current?.send({ k: 'snap' });
      await reload();
      await reloadHistory();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function onComment() {
    if (!completedView?.id || !commentDraft.trim()) return;
    try {
      await reactDuoSnap(code, completedView.id, { comment: commentDraft.trim() });
      setCommentDraft('');
      channelRef.current?.send({ k: 'snap' });
      await reload();
      await reloadHistory();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function onDownload(r) {
    if (!r?.photo_a || !r?.photo_b) return;
    try {
      await downloadTodayDiptych({
        photoA: r.photo_a,
        photoB: r.photo_b,
        nameA: names.A,
        nameB: names.B,
        day: formatDayTime(r.scheduled_at),
        label: 'Duo Snap'
      });
      setStatus('Download started');
    } catch (e) {
      setErr(e.message);
    }
  }

  if (phase === 'camera' || phase === 'preview' || phase === 'saving') {
    return (
      <div className="sn-page sn-capture">
        {phase === 'camera' && (
          <div className="sn-capture-stage">
            <video
              ref={videoRef}
              className={'sn-capture-video' + (facing === 'user' ? ' mirrored' : '')}
              playsInline
              muted
            />
            <div className="sn-capture-bar">
              <button type="button" className="btn small ghost" onClick={() => { stopCamera(); setPhase('hub'); }}>Cancel</button>
              <button type="button" className="sn-shutter" onClick={captureFrame} title="Snap!" />
              <button
                type="button"
                className="btn small ghost"
                onClick={() => {
                  const next = facing === 'user' ? 'environment' : 'user';
                  setFacing(next);
                  startCamera(next);
                }}
              >
                Flip
              </button>
            </div>
          </div>
        )}
        {phase === 'preview' && (
          <div className="sn-capture-stage">
            <img src={preview} alt="preview" className="sn-capture-video" />
            <label className="sn-caption-field">
              Caption (optional)
              <input
                maxLength={100}
                value={caption}
                onChange={e => setCaption(e.target.value)}
                placeholder="A quick note…"
              />
            </label>
            <div className="sn-capture-bar">
              <button type="button" className="btn small ghost" onClick={() => { setPreview(null); startCamera(facing); }}>Retake</button>
              <button type="button" className="btn warm" onClick={confirmSubmit}>Send snap</button>
            </div>
          </div>
        )}
        {phase === 'saving' && <p className="sn-capture-status">Uploading your Duo Snap…</p>}
        {err && <p className="sn-capture-err">{err}</p>}
      </div>
    );
  }

  const firstName = completedView?.first_submitter
    ? names[completedView.first_submitter]
    : null;

  return (
    <div className="sn-page sn-hub">
      <div className="sn-top">
        <button type="button" className="btn small ghost" onClick={backToDuo}>&larr; Back</button>
        <div className="sn-title">Duo Snap</div>
        <button type="button" className="btn small ghost" onClick={() => setShowSettings(v => !v)} title="Settings">{'\u2699\uFE0F'}</button>
      </div>

      <div className="sn-hero-stats">
        <div className="sn-stat">
          <div className="sn-stat-n">{config.streak || 0}</div>
          <div className="sn-stat-l">streak</div>
        </div>
        <div className="sn-stat">
          <div className="sn-stat-n">{config.best_streak || 0}</div>
          <div className="sn-stat-l">best</div>
        </div>
        <div className="sn-stat wide">
          <div className="sn-stat-n sn-stat-count">{remainLabel}</div>
          <div className="sn-stat-l">
            {!config.enabled ? 'disabled'
              : paused ? 'resumes in'
                : round && !myPhoto ? 'window left'
                  : 'next snap in'}
          </div>
        </div>
      </div>

      {paused && (
        <div className="sn-banner busy">
          <div>
            <strong>Busy mode</strong>
            {config.pause_reason ? ` — ${config.pause_reason}` : ''}
            <div className="sn-banner-sub">Resumes in {remainLabel}. Streak protected.</div>
          </div>
          <button type="button" className="btn small warm" onClick={doResume}>Resume now</button>
        </div>
      )}

      {!config.enabled && (
        <div className="sn-banner">Duo Snap is off. Enable it in settings to get reminders.</div>
      )}

      {config.enabled && !paused && round && !myPhoto && (
        <div className="sn-cta-block">
          <p className="sn-cta-copy">Time for your Duo Snap! Send your partner a quick photo.</p>
          <button type="button" className="btn warm" onClick={() => startCamera(config.camera_pref || 'user')}>
            Open camera
          </button>
          <div className="sn-quick-pause">
            <button type="button" className="btn small ghost" onClick={() => doPause(PAUSE_PRESETS[1])}>Pause 1h</button>
            <button type="button" className="btn small ghost" onClick={() => doPause(PAUSE_PRESETS[2])}>Pause 2h</button>
            <button type="button" className="btn small ghost" onClick={() => setShowPause(true)}>More…</button>
          </div>
        </div>
      )}

      {config.enabled && !paused && round && myPhoto && !theirPhoto && (
        <div className="sn-waiting-card">
          <div className="sn-duet">
            <div className="sn-slot">
              <div className="sn-polaroid"><img src={myPhoto} alt="you" /></div>
              <div className="sn-caption">{names[role]} · {formatClock(round[role === 'A' ? 'at_a' : 'at_b'])}</div>
            </div>
            <div className="sn-heart">{'\u2661'}</div>
            <div className="sn-slot">
              <div className="sn-polaroid waiting">
                <div className="sn-empty pulse">Waiting for {names[partnerRole]}…</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {completedView?.photo_a && completedView?.photo_b && (bothActive || !round || myPhoto) && (
        <div className="sn-reveal">
          <div className="sn-duet">
            <div className="sn-slot">
              <div className="sn-polaroid"><img src={completedView.photo_a} alt={names.A} /></div>
              <div className="sn-caption">
                {names.A} · {formatClock(completedView.at_a)}
                {completedView.caption_a ? ` — ${completedView.caption_a}` : ''}
              </div>
            </div>
            <div className="sn-heart full">{'\u2665'}</div>
            <div className="sn-slot">
              <div className="sn-polaroid"><img src={completedView.photo_b} alt={names.B} /></div>
              <div className="sn-caption">
                {names.B} · {formatClock(completedView.at_b)}
                {completedView.caption_b ? ` — ${completedView.caption_b}` : ''}
              </div>
            </div>
          </div>
          {firstName && <p className="sn-first">{firstName} sent first</p>}
          <div className="sn-reacts">
            {REACT_EMOJIS.map(em => (
              <button key={em} type="button" className="sn-react" onClick={() => onReact(em)}>{em}</button>
            ))}
          </div>
          <div className="sn-comments">
            {(completedView.comment_a || completedView.reaction_a) && (
              <div>{names.A}: {completedView.reaction_a || ''} {completedView.comment_a || ''}</div>
            )}
            {(completedView.comment_b || completedView.reaction_b) && (
              <div>{names.B}: {completedView.reaction_b || ''} {completedView.comment_b || ''}</div>
            )}
          </div>
          <div className="sn-comment-row">
            <input
              value={commentDraft}
              maxLength={200}
              placeholder="Leave a comment…"
              onChange={e => setCommentDraft(e.target.value)}
            />
            <button type="button" className="btn small warm" onClick={onComment}>Send</button>
          </div>
          <div className="sn-keepsake-row">
            <button type="button" className="btn warm" onClick={() => onDownload(completedView)}>Download diptych</button>
          </div>
        </div>
      )}

      {!paused && config.enabled && !round && (
        <p className="sn-note">Next Duo Snap reminder in {remainLabel}. Hang tight.</p>
      )}

      <div className="sn-actions-row">
        {!paused && (
          <button type="button" className="btn small ghost" onClick={() => setShowPause(true)}>Pause / Busy</button>
        )}
      </div>

      {showPause && (
        <div className="sn-panel">
          <h4>Pause Duo Snap</h4>
          <p className="sn-panel-note">No reminders, no missed snaps, streak stays safe.</p>
          <div className="sn-chip-row">
            {PAUSE_PRESETS.map(p => (
              <button key={p.label} type="button" className="wk-chip" onClick={() => doPause(p)}>{p.label}</button>
            ))}
          </div>
          <label>
            Custom minutes
            <input type="number" min={15} max={10080} value={customPauseMins}
              onChange={e => setCustomPauseMins(e.target.value)} placeholder="90" />
          </label>
          <button type="button" className="btn small ghost" onClick={() => doPause('custom')}>Pause custom</button>
          <div className="sn-chip-row">
            {BUSY_REASONS.map(r => (
              <button
                key={r.id}
                type="button"
                className={'wk-chip sm' + (pauseReason === r.id ? ' on' : '')}
                onClick={() => setPauseReason(r.id)}
              >
                {r.emoji} {r.label}
              </button>
            ))}
            <button
              type="button"
              className={'wk-chip sm' + (pauseReason === 'custom' ? ' on' : '')}
              onClick={() => setPauseReason('custom')}
            >
              Custom
            </button>
          </div>
          {pauseReason === 'custom' && (
            <input
              value={customReason}
              maxLength={40}
              placeholder="Status…"
              onChange={e => setCustomReason(e.target.value)}
            />
          )}
          <button type="button" className="btn small ghost" onClick={() => setShowPause(false)}>Close</button>
        </div>
      )}

      {showSettings && (
        <div className="sn-panel">
          <h4>Duo Snap settings</h4>
          <label className="sn-toggle">
            <input
              type="checkbox"
              checked={settingsDraft.enabled}
              onChange={e => setSettingsDraft(s => ({ ...s, enabled: e.target.checked }))}
            />
            Enable Duo Snap
          </label>
          <label className="sn-toggle">
            <input
              type="checkbox"
              checked={settingsDraft.notify}
              onChange={e => setSettingsDraft(s => ({ ...s, notify: e.target.checked }))}
            />
            Browser notifications
          </label>
          <label className="sn-toggle">
            <input
              type="checkbox"
              checked={settingsDraft.auto_save_device}
              onChange={e => setSettingsDraft(s => ({ ...s, auto_save_device: e.target.checked }))}
            />
            Offer download after reveal
          </label>
          <div className="sn-label">Reminder interval</div>
          <div className="sn-chip-row">
            {INTERVAL_PRESETS.map(p => (
              <button
                key={p.mins}
                type="button"
                className={'wk-chip' + (settingsDraft.interval_mins === p.mins && !customInterval ? ' on' : '')}
                onClick={() => { setCustomInterval(''); setSettingsDraft(s => ({ ...s, interval_mins: p.mins })); }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <label>
            Custom interval (minutes)
            <input type="number" min={15} max={10080} value={customInterval}
              onChange={e => setCustomInterval(e.target.value)} placeholder="e.g. 90" />
          </label>
          <div className="sn-label">Submission window</div>
          <div className="sn-chip-row">
            {WINDOW_PRESETS.map(p => (
              <button
                key={p.mins}
                type="button"
                className={'wk-chip' + (settingsDraft.window_mins === p.mins ? ' on' : '')}
                onClick={() => setSettingsDraft(s => ({ ...s, window_mins: p.mins }))}
              >
                {p.label}
              </button>
            ))}
          </div>
          <label>
            Camera preference
            <select
              value={settingsDraft.camera_pref}
              onChange={e => setSettingsDraft(s => ({ ...s, camera_pref: e.target.value }))}
            >
              <option value="user">Front</option>
              <option value="environment">Rear</option>
            </select>
          </label>
          <div className="sn-panel-actions">
            <button type="button" className="btn small ghost" onClick={() => setShowSettings(false)}>Cancel</button>
            <button type="button" className="btn small warm" onClick={saveSettings}>Save</button>
          </div>
        </div>
      )}

      <div className="sn-history-head">
        <h3 className="sn-history-title">History</h3>
        <input
          type="month"
          className="sn-month"
          value={month}
          onChange={e => setMonth(e.target.value)}
        />
      </div>
      <div className="sn-history-list">
        {history.length === 0 && <p className="sn-note">No snaps yet for this filter.</p>}
        {history.map(item => (
          <div key={item.id} className={'sn-hist-row' + (item.status === 'missed' ? ' missed' : '')}>
            <div className="sn-hist-meta">
              <strong>{formatDayTime(item.scheduled_at)}</strong>
              <span>{item.status === 'missed' ? 'Missed' : 'Completed'}</span>
            </div>
            {item.status === 'completed' && item.photo_a && item.photo_b ? (
              <div className="sn-hist-pair">
                <img src={item.photo_a} alt="" />
                <img src={item.photo_b} alt="" />
              </div>
            ) : (
              <div className="sn-hist-missed">Window closed without both photos</div>
            )}
            <div className="sn-hist-actions">
              {item.status === 'completed' && (
                <button type="button" className="btn small ghost" onClick={() => onDownload(item)}>Download</button>
              )}
              <button
                type="button"
                className="btn small ghost wk-danger"
                onClick={async () => {
                  await deleteDuoSnap(code, item.id);
                  await reloadHistory();
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
      {history.length > 0 && (
        <button
          type="button"
          className="btn small ghost"
          onClick={async () => {
            if (!window.confirm('Clear all Duo Snap history for this duo?')) return;
            await clearDuoSnapHistory(code);
            await reloadHistory();
          }}
        >
          Clear history
        </button>
      )}

      {pauses.length > 0 && (
        <>
          <h3 className="sn-history-title">Busy mode log</h3>
          <ul className="sn-pause-log">
            {pauses.map(p => (
              <li key={p.id}>
                {names[p.by_role] || p.by_role} paused
                {p.reason ? ` (${p.reason})` : ''} · {formatDayTime(p.paused_at)}
                {p.resumed_at ? ` → resumed ${formatClock(p.resumed_at)}` : ` until ${formatClock(p.until_at)}`}
              </li>
            ))}
          </ul>
        </>
      )}

      {status && <div className="sn-status">{status}</div>}
      {err && <div className="sn-status">{err}</div>}
    </div>
  );
}
