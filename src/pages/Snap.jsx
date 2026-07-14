// src/pages/Snap.jsx — route: /snap/:code
//
// "Today's snap": one INSTANT photo from each of you per day.
//   * Camera-only by design — the page opens your live camera via
//     getUserMedia; there is no file input anywhere, so gallery uploads
//     are structurally impossible. (Requires HTTPS; localhost is fine.)
//   * You see your partner's photo arrive live. When both are in, the two
//     are composited into a love-frame keepsake (two tilted polaroids, a
//     heart between, names + date) you can download as a PNG.
//   * Completing both photos advances the duo streak — enforced
//     server-side, once per day, retakes allowed.

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  myRoleInDuo, duoNames, loadSnap, listSnaps, saveSnap, snapChannel, todayStr
} from '../lib/snaps.js';
import '../styles/snaps.css';

const SIZE = 720; // captured square

function loadImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

export default function Snap() {
  const { code } = useParams();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const channelRef = useRef(null);

  const [role, setRole] = useState(undefined);
  const [names, setNames] = useState({ A: 'A', B: 'B' });
  const [snap, setSnap] = useState(null);        // today's row
  const [camOn, setCamOn] = useState(false);
  const [shot, setShot] = useState(null);        // captured-but-unsaved dataURL
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [celebrate, setCelebrate] = useState(false);
  const [history, setHistory] = useState([]);

  const day = todayStr();
  const other = role === 'A' ? 'B' : 'A';
  const myPhoto = snap ? (role === 'A' ? snap.photo_a : snap.photo_b) : null;
  const theirPhoto = snap ? (role === 'A' ? snap.photo_b : snap.photo_a) : null;
  const both = !!(myPhoto && theirPhoto);

  const reload = useCallback(async () => {
    try {
      setSnap(await loadSnap(code, day));
      setHistory(await listSnaps(code, 10));
    } catch (e) { setErr(e.message); }
  }, [code, day]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await myRoleInDuo(code);
      if (!alive) return;
      setRole(r);
      if (!r) return;
      setNames(await duoNames(code));
      await reload();
      const ch = await snapChannel(code);
      if (!alive) { ch.close(); return; }
      channelRef.current = ch;
      ch.on(m => { if (m.k === 'snap') reload(); });
    })();
    return () => {
      alive = false;
      channelRef.current?.close();
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  /* ---------- camera ---------- */

  async function startCamera() {
    setErr(''); setShot(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false
      });
      streamRef.current = stream;
      setCamOn(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch {
      setErr('Camera access was blocked. Allow the camera in your browser and try again — snaps are instant-only, no uploads.');
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCamOn(false);
  }

  function capture() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const cv = document.createElement('canvas');
    cv.width = SIZE; cv.height = SIZE;
    const g = cv.getContext('2d');
    const m = Math.min(v.videoWidth, v.videoHeight);
    const sx = (v.videoWidth - m) / 2, sy = (v.videoHeight - m) / 2;
    g.translate(SIZE, 0); g.scale(-1, 1);   // mirror, like the preview
    g.drawImage(v, sx, sy, m, m, 0, 0, SIZE, SIZE);
    setShot(cv.toDataURL('image/jpeg', 0.72));
  }

  async function useShot() {
    if (!shot) return;
    setBusy(true); setErr('');
    try {
      const res = await saveSnap(code, day, shot);
      channelRef.current?.send({ k: 'snap', by: role });
      setShot(null);
      stopCamera();
      await reload();
      if (res?.both) { setCelebrate(true); setTimeout(() => setCelebrate(false), 3500); }
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  /* ---------- keepsake ---------- */

  async function downloadKeepsake() {
    if (!both) return;
    const [imgMe, imgThem] = await Promise.all([
      loadImage(role === 'A' ? snap.photo_a : snap.photo_b),
      loadImage(role === 'A' ? snap.photo_b : snap.photo_a)
    ]);
    const W = 1080, H = 1350;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');

    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#241B33');
    bg.addColorStop(1, '#170F1F');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.globalAlpha = 0.12;
    g.font = '54px serif'; g.textAlign = 'center';
    for (let i = 0; i < 14; i++) {
      g.fillStyle = i % 2 ? '#FF7FA8' : '#7FA8FF';
      g.fillText('\u2665', (i * 173 + 90) % W, (i * 311 + 120) % H);
    }
    g.globalAlpha = 1;

    const drawPolaroid = (img, cx, cy, rot, caption) => {
      const pw = 470, ph = 560, pad = 26;
      g.save();
      g.translate(cx, cy);
      g.rotate(rot);
      g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 34; g.shadowOffsetY = 12;
      g.fillStyle = '#FAF6EE';
      g.fillRect(-pw / 2, -ph / 2, pw, ph);
      g.shadowColor = 'transparent';
      g.drawImage(img, -pw / 2 + pad, -ph / 2 + pad, pw - pad * 2, pw - pad * 2);
      g.fillStyle = '#3A2E44';
      g.font = 'italic 34px Georgia';
      g.textAlign = 'center';
      g.fillText(caption, 0, ph / 2 - 34);
      g.restore();
    };

    const nameMe = role === 'A' ? names.A : names.B;
    const nameThem = role === 'A' ? names.B : names.A;
    drawPolaroid(imgMe, W * 0.34, H * 0.40, -0.09, nameMe);
    drawPolaroid(imgThem, W * 0.66, H * 0.52, 0.09, nameThem);

    g.fillStyle = '#FFC66E';
    g.font = '84px serif'; g.textAlign = 'center';
    g.fillText('\u2665', W / 2, H * 0.47);

    g.fillStyle = '#F2EDF7';
    g.font = '900 52px Georgia';
    g.fillText(`${names.A} & ${names.B}`, W / 2, H - 170);
    g.fillStyle = '#A99FBC';
    g.font = '30px Georgia';
    const nice = new Date(day + 'T12:00:00').toLocaleDateString(undefined,
      { day: 'numeric', month: 'long', year: 'numeric' });
    g.fillText(nice, W / 2, H - 118);
    g.fillStyle = '#FFC66E';
    g.font = '700 24px Arial';
    g.fillText('D U O A R C A D E', W / 2, H - 58);

    const a = document.createElement('a');
    a.download = `duoarcade-snap-${day}.png`;
    a.href = cv.toDataURL('image/png');
    a.click();
  }

  /* ---------- render ---------- */

  if (role === undefined) return <div className="sn-page"><p className="sn-status">Loading…</p></div>;
  if (role === null) {
    return (
      <div className="sn-page">
        <p className="sn-status">Sign in as a member of this duo to add its snaps.</p>
        <button className="btn" onClick={() => navigate('/app')}>Back to the arcade</button>
      </div>
    );
  }

  return (
    <div className="sn-page">
      <div className="sn-top">
        <button className="btn small ghost" onClick={() => { stopCamera(); navigate('/app'); }}>&larr; Back</button>
        <div className="sn-title">Today's snap</div>
        <div className="sn-date">{day}</div>
      </div>

      <div className="sn-duet">
        {/* MY slot */}
        <div className="sn-slot">
          <div className="sn-polaroid mine">
            {shot ? (
              <img src={shot} alt="your capture" />
            ) : camOn ? (
              <video ref={videoRef} className="sn-video" playsInline muted />
            ) : myPhoto ? (
              <img src={myPhoto} alt="you, today" />
            ) : (
              <div className="sn-empty">no photo yet</div>
            )}
            <div className="sn-caption">{role === 'A' ? names.A : names.B}</div>
          </div>
          <div className="sn-slot-actions">
            {shot ? (
              <>
                <button className="btn warm small" onClick={useShot} disabled={busy}>
                  {busy ? 'Saving…' : 'Use this one'}
                </button>
                <button className="btn small ghost" onClick={() => setShot(null)}>Retake</button>
              </>
            ) : camOn ? (
              <>
                <button className="sn-shutter" onClick={capture} title="Snap!" />
                <button className="btn small ghost" onClick={stopCamera}>Cancel</button>
              </>
            ) : (
              <button className="btn warm small" onClick={startCamera}>
                {myPhoto ? 'Retake today\u2019s photo' : '\u{1F4F8} Take today\u2019s photo'}
              </button>
            )}
          </div>
        </div>

        <div className="sn-heart">{both ? '\u2665' : '\u2661'}</div>

        {/* PARTNER slot */}
        <div className="sn-slot">
          <div className={'sn-polaroid theirs' + (theirPhoto ? '' : ' waiting')}>
            {theirPhoto
              ? <img src={theirPhoto} alt="your partner, today" />
              : <div className="sn-empty pulse">waiting for {names[other]}…</div>}
            <div className="sn-caption">{names[other]}</div>
          </div>
        </div>
      </div>

      {celebrate && (
        <div className="sn-celebrate">Both in — today counts! Your streak just fed. {'\u{1F525}'}</div>
      )}

      {both && (
        <div className="sn-keepsake-row">
          <button className="btn warm" onClick={downloadKeepsake}>Download today's keepsake</button>
          <span className="sn-hint">two polaroids, one frame — made for sharing</span>
        </div>
      )}

      {err && <div className="sn-status">{err}</div>}
      <div className="sn-note">Instant photos only — there's no upload button on purpose. What you see is what was just lived.</div>

      {history.filter(h => h.day !== day).length > 0 && (
        <>
          <div className="sn-history-title">Past snaps</div>
          <div className="sn-history">
            {history.filter(h => h.day !== day).map(h => (
              <div className="sn-hist-item" key={h.day}>
                <div className="sn-hist-pair">
                  <img src={h.photo_a} alt="" />
                  <img src={h.photo_b} alt="" />
                </div>
                <div className="sn-hist-day">{h.day.slice(5)}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
