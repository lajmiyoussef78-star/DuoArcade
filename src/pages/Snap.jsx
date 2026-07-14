// src/pages/Snap.jsx — route: /snap/:code
//
// Camera-only capture flow: opens live camera, one shutter tap saves today's
// snap and returns to the arcade home.

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { myRoleInDuo, loadSnap, saveSnap, snapChannel, todayStr } from '../lib/snaps.js';
import '../styles/snaps.css';

const SIZE = 720;

export default function Snap() {
  const { code } = useParams();
  const navigate = useNavigate();

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const channelRef = useRef(null);

  const [role, setRole] = useState(undefined);
  const [phase, setPhase] = useState('loading');
  const [err, setErr] = useState('');

  const day = todayStr();

  const backToDuo = useCallback(() => {
    navigate(`/app?duo=${encodeURIComponent(code)}`, { replace: true });
  }, [code, navigate]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    setErr('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 1280 } },
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
      setPhase('error');
      setErr('Camera access was blocked. Allow the camera in your browser and try again.');
    }
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      const r = await myRoleInDuo(code);
      if (!alive) return;
      setRole(r);
      if (!r) {
        setPhase('error');
        setErr('Sign in as a member of this duo to add its snaps.');
        return;
      }

      const ch = await snapChannel(code);
      if (!alive) { ch.close(); return; }
      channelRef.current = ch;

      const row = await loadSnap(code, day);
      if (!alive) return;
      if (row && (r === 'A' ? row.photo_a : row.photo_b)) {
        backToDuo();
        return;
      }

      await startCamera();
    })();

    return () => {
      alive = false;
      channelRef.current?.close();
      stopCamera();
    };
  }, [code, day, backToDuo, startCamera, stopCamera]);

  async function captureAndSave() {
    const v = videoRef.current;
    if (!v || !v.videoWidth || phase !== 'camera') return;

    const cv = document.createElement('canvas');
    cv.width = SIZE;
    cv.height = SIZE;
    const g = cv.getContext('2d');
    const m = Math.min(v.videoWidth, v.videoHeight);
    const sx = (v.videoWidth - m) / 2;
    const sy = (v.videoHeight - m) / 2;
    g.translate(SIZE, 0);
    g.scale(-1, 1);
    g.drawImage(v, sx, sy, m, m, 0, 0, SIZE, SIZE);

    setPhase('saving');
    setErr('');
    try {
      await saveSnap(code, day, cv.toDataURL('image/jpeg', 0.72));
      channelRef.current?.send({ k: 'snap', by: role });
      stopCamera();
      backToDuo();
    } catch (e) {
      setPhase('camera');
      setErr(e.message || 'Could not save your snap.');
    }
  }

  function goHome() {
    stopCamera();
    backToDuo();
  }

  return (
    <div className="sn-page sn-capture">
      {phase === 'loading' && <p className="sn-capture-status">Opening camera…</p>}

      {phase === 'camera' && (
        <div className="sn-capture-stage">
          <video ref={videoRef} className="sn-capture-video" playsInline muted />
          <div className="sn-capture-bar">
            <button type="button" className="btn small ghost" onClick={goHome}>Cancel</button>
            <button type="button" className="sn-shutter" onClick={captureAndSave} title="Snap!" />
            <span className="sn-capture-spacer" aria-hidden="true" />
          </div>
        </div>
      )}

      {phase === 'saving' && <p className="sn-capture-status">Uploading your snap…</p>}

      {phase === 'error' && (
        <div className="sn-capture-error">
          <p className="sn-status">{err}</p>
          <button type="button" className="btn warm" onClick={goHome}>Back to the arcade</button>
        </div>
      )}

      {err && phase === 'camera' && <p className="sn-capture-err">{err}</p>}
    </div>
  );
}
