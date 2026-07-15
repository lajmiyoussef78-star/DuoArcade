// src/arcade/SnapCard.jsx — Duo Snap home card: countdown, waiting, reveal, quick pause.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  PAUSE_PRESETS, downloadTodayDiptych, duoNames, formatRemaining,
  getDuoSnapState, maybeNotifyDuoSnap, myRoleInDuo, partnerPhoto,
  pauseDuoSnap, pauseUntilIso, photoFor, resumeDuoSnap, snapChannel
} from '../lib/snaps.js';
import '../styles/snaps.css';

export default function SnapCard({ code }) {
  const [state, setState] = useState(null);
  const [role, setRole] = useState(null);
  const [names, setNames] = useState({ A: 'A', B: 'B' });
  const [dlStatus, setDlStatus] = useState('');
  const [tick, setTick] = useState(Date.now());
  const [err, setErr] = useState('');
  const chRef = useRef(null);
  const notifiedRef = useRef(null);

  const reload = useCallback(async () => {
    try {
      const s = await getDuoSnapState(code);
      setState(s);
      setErr('');
      maybeNotifyDuoSnap(s?.config, s?.active, notifiedRef);
    } catch (e) {
      setErr(e.message || 'Duo Snap unavailable — run schema-v18 in Supabase.');
    }
  }, [code]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await myRoleInDuo(code);
      if (!alive) return;
      setRole(r);
      setNames(await duoNames(code));
      await reload();
      const ch = await snapChannel(code);
      if (!alive) { ch.close(); return; }
      chRef.current = ch;
      ch.on(m => { if (m.k === 'snap' || m.k === 'pause') reload(); });
    })();
    return () => {
      alive = false;
      chRef.current?.close();
      chRef.current = null;
    };
  }, [code, reload]);

  useEffect(() => {
    const t = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const my = state && role ? photoFor(role, state.active) : null;
    const theirs = state && role ? partnerPhoto(role, state.active) : null;
    if (!my || theirs) return;
    const id = setInterval(reload, 4000);
    return () => clearInterval(id);
  }, [state, role, reload]);

  useEffect(() => {
    const onVis = () => { if (!document.hidden) reload(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [reload]);

  const config = state?.config || {};
  const round = state?.active || null;
  const last = state?.last_completed || null;
  const paused = !!state?.paused;
  const myPhoto = photoFor(role, round);
  const theirPhoto = partnerPhoto(role, round);
  const both = !!(myPhoto && theirPhoto);
  const showReveal = both ? round : (last?.photo_a && last?.photo_b ? last : null);
  const myName = role === 'A' ? names.A : names.B;
  const otherName = role === 'A' ? names.B : names.A;

  const countdownTarget = useMemo(() => {
    if (paused && config.paused_until) return new Date(config.paused_until).getTime();
    if (round?.expires_at && !myPhoto) return new Date(round.expires_at).getTime();
    if (config.next_fire_at) return new Date(config.next_fire_at).getTime();
    return null;
  }, [paused, config.paused_until, config.next_fire_at, round, myPhoto]);

  const remain = countdownTarget != null ? formatRemaining(countdownTarget - tick) : '—';

  async function quickPause(preset) {
    try {
      await pauseDuoSnap(code, pauseUntilIso(preset), null);
      chRef.current?.send({ k: 'pause' });
      await reload();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function doResume() {
    try {
      await resumeDuoSnap(code);
      chRef.current?.send({ k: 'pause' });
      await reload();
    } catch (e) {
      setErr(e.message);
    }
  }

  const onDownload = async () => {
    if (!showReveal) return;
    setDlStatus('Preparing your diptych…');
    try {
      await downloadTodayDiptych({
        photoA: showReveal.photo_a,
        photoB: showReveal.photo_b,
        nameA: names.A,
        nameB: names.B,
        day: new Date(showReveal.scheduled_at).toLocaleString(),
        label: 'Duo Snap'
      });
      setDlStatus('Download started — check your files.');
    } catch {
      setDlStatus('Could not download — try again in a moment.');
    }
  };

  return (
    <div className="snc">
      <div className="snc-head">
        <h3>Our timetable</h3>
        <span className="snc-streak">{config.streak || 0} day streak</span>
      </div>
      <p className="snc-desc">
        Spontaneous paired photos on a timer. Both of you snap, then you reveal together.
      </p>

      {err && <p className="snc-err">{err}</p>}

      {paused ? (
        <div className="snc-busy">
          <div>
            <strong>Busy</strong>
            {config.pause_reason ? ` — ${config.pause_reason}` : ''}
            <div className="snc-busy-sub">Resumes in {remain}</div>
          </div>
          <button type="button" className="btn small warm" onClick={doResume}>Resume now</button>
        </div>
      ) : config.enabled === false ? (
        <p className="snc-desc">Duo Snap is disabled. Open the page to turn it back on.</p>
      ) : round && !myPhoto ? (
        <div className="snc-frame">
          <Link className="snc-half snc-invite" to={`/snap/${code}?take=1`}>
            <div className="snc-cam">{'\u{1F4F7}'}</div>
            <div className="snc-invite-line">take your Duo Snap</div>
            <div className="snc-window">{remain} left</div>
          </Link>
          <div className="snc-half snc-waiting">
            <div className="snc-wait-line">waiting for {otherName}…</div>
          </div>
          <div className="snc-badge">{'\u2661'}</div>
        </div>
      ) : round && myPhoto && !theirPhoto ? (
        <div className="snc-frame">
          <div className="snc-half">
            <img src={myPhoto} alt="you" />
            <div className="snc-label"><span>{myName}</span><span className="snc-ok">{'\u2713'}</span></div>
          </div>
          <div className="snc-half snc-waiting">
            <div className="snc-wait-line">Waiting for {otherName}…</div>
          </div>
          <div className="snc-badge">{'\u2661'}</div>
        </div>
      ) : showReveal ? (
        <div className="snc-frame">
          <div className="snc-half">
            <img src={showReveal.photo_a} alt={names.A} />
            <div className="snc-label"><span>{names.A}</span><span className="snc-ok">{'\u2713'}</span></div>
          </div>
          <div className="snc-half">
            <img src={showReveal.photo_b} alt={names.B} />
            <div className="snc-label"><span>{names.B}</span><span className="snc-ok">{'\u2713'}</span></div>
          </div>
          <div className="snc-badge full">{'\u2665'}</div>
        </div>
      ) : (
        <div className="snc-countdown">
          <div className="snc-count-n">{remain}</div>
          <div className="snc-count-l">until next Duo Snap</div>
        </div>
      )}

      <div className="snc-foot">
        {round && !myPhoto && !paused ? (
          <>
            <Link className="btn warm" to={`/snap/${code}?take=1`}>Open camera</Link>
            <div className="snc-quick">
              <button type="button" className="btn small ghost" onClick={() => quickPause(PAUSE_PRESETS[1])}>Pause 1h</button>
              <button type="button" className="btn small ghost" onClick={() => quickPause(PAUSE_PRESETS[2])}>Pause 2h</button>
              <button type="button" className="btn small ghost" onClick={() => quickPause(PAUSE_PRESETS[5])}>Until tomorrow</button>
            </div>
          </>
        ) : showReveal && both ? (
          <button type="button" className="btn warm" onClick={onDownload}>Download diptych</button>
        ) : showReveal && !round ? (
          <Link className="btn warm" to={`/snap/${code}`}>Open Duo Snap</Link>
        ) : (
          <Link className="btn warm" to={`/snap/${code}`}>Open Duo Snap</Link>
        )}
        {dlStatus && <p className="snc-dl-status">{dlStatus}</p>}
      </div>
    </div>
  );
}
