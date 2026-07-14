// src/arcade/DuoPhotoCard.jsx — daily instant camera photos in a love frame.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  loadPhotoState, savePhotoState, photoChannel, captureFromVideo,
  bothPhotosReady, normalizePhotoState
} from '../lib/duophoto.js';
import { renderDuoPhotoFrame, downloadDuoPhotoFrame } from '../lib/duophotoFrame.js';
import '../styles/duophoto.css';

export default function DuoPhotoCard({ code, myRole, duo, onBothPhotos }) {
  const [state, setState] = useState(() => normalizePhotoState(null));
  const [cameraOn, setCameraOn] = useState(false);
  const [status, setStatus] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const frameRef = useRef(null);
  const channelRef = useRef(null);
  const savingRef = useRef(false);

  const partnerRole = myRole === 'A' ? 'B' : 'A';
  const partnerName = partnerRole === 'A' ? duo.nameA : duo.nameB;
  const myPhoto = state.photos[myRole];
  const partnerPhoto = state.photos[partnerRole];
  const complete = bothPhotosReady(state);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }, []);

  const drawFrame = useCallback(async (nextState) => {
    const cv = frameRef.current;
    if (!cv) return;
    try {
      const rendered = await renderDuoPhotoFrame({
        duo, photos: nextState.photos, themeName: duo.theme || 'night'
      });
      const g = cv.getContext('2d');
      cv.width = rendered.width;
      cv.height = rendered.height;
      g.drawImage(rendered, 0, 0);
    } catch { /* preview may fail before images load */ }
  }, [duo]);

  const persist = useCallback(async (next, { broadcast = true } = {}) => {
    const normalized = normalizePhotoState(next);
    setState(normalized);
    drawFrame(normalized);
    if (broadcast) channelRef.current?.send({ k: 'sync', state: normalized });
    try {
      savingRef.current = true;
      await savePhotoState(code, normalized);
      setStatus('');

      if (bothPhotosReady(normalized) && !normalized.streakCounted) {
        const marked = { ...normalized, streakCounted: true };
        setState(marked);
        await savePhotoState(code, marked);
        channelRef.current?.send({ k: 'sync', state: marked });
        await onBothPhotos?.();
      }
    } catch (e) {
      setStatus(e.message || 'Could not save photo');
    } finally {
      savingRef.current = false;
    }
  }, [code, drawFrame, onBothPhotos]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const loaded = await loadPhotoState(code);
        if (!alive) return;
        setState(loaded);
        drawFrame(loaded);
      } catch { /* empty day */ }

      const ch = await photoChannel(code);
      if (!alive) { ch.close(); return; }
      channelRef.current = ch;
      ch.on(msg => {
        if (!alive || savingRef.current || msg.k !== 'sync') return;
        const next = normalizePhotoState(msg.state);
        setState(next);
        drawFrame(next);
      });
    })();
    return () => {
      alive = false;
      stopCamera();
      channelRef.current?.close();
      channelRef.current = null;
    };
  }, [code, drawFrame, stopCamera]);

  const startCamera = async () => {
    setStatus('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
    } catch {
      setStatus('Camera access denied — allow the camera to take today\'s photo.');
    }
  };

  const snap = async () => {
    const video = videoRef.current;
    if (!video) return;
    const data = captureFromVideo(video);
    stopCamera();
    const next = {
      ...state,
      photos: {
        ...state.photos,
        [myRole]: { data, at: Date.now() }
      }
    };
    await persist(next);
  };

  const download = async () => {
    try {
      await downloadDuoPhotoFrame({
        duo, photos: state.photos, themeName: duo.theme || 'night'
      });
    } catch {
      setStatus('Could not build download');
    }
  };

  return (
    <div className="dp-card">
      <h3>{'📸'} Today&apos;s moment</h3>
      <p className="dp-sub">
        Take a live selfie — no uploads, no gallery. When you both snap one today,
        your photos merge into a love frame you can keep. Both photos bump your evening streak.
      </p>

      <div className="dp-frame-wrap">
        <canvas ref={frameRef} className="dp-frame" aria-label="Combined love frame preview" />
      </div>

      {complete && (
        <div className="dp-done">{'❤'} You both showed up today — streak counted!</div>
      )}

      {!myPhoto && !cameraOn && (
        <button className="btn warm small" type="button" onClick={startCamera}>
          Take my photo
        </button>
      )}

      {cameraOn && (
        <div className="dp-camera">
          <video ref={videoRef} className="dp-video" playsInline muted />
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn warm small" type="button" onClick={snap}>Snap!</button>
            <button className="btn small ghost" type="button" onClick={stopCamera}>Cancel</button>
          </div>
        </div>
      )}

      {myPhoto && !partnerPhoto && (
        <div className="dp-wait">
          Your photo is in. Waiting for <b>{partnerName}</b> to take theirs…
        </div>
      )}

      {myPhoto && !state.streakCounted && (
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn small ghost" type="button" onClick={startCamera}>Retake mine</button>
        </div>
      )}

      {complete && (
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn warm small" type="button" onClick={download}>Download frame</button>
        </div>
      )}

      {status && <div className="dp-status">{status}</div>}
    </div>
  );
}
