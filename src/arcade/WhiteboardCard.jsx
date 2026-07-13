// src/arcade/WhiteboardCard.jsx — the "Our wall" section for the duo home.

import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { loadBoardMeta, boardChannel } from '../lib/whiteboard.js';
import '../styles/whiteboard.css';

function timeAgo(iso) {
  if (!iso) return null;
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + ' min ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}

export default function WhiteboardCard({ code }) {
  const canvasRef = useRef(null);
  const strokesRef = useRef([]);
  const [meta, setMeta] = useState({ count: 0, updatedAt: null });

  const drawAll = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const g = cv.getContext('2d');
    g.clearRect(0, 0, cv.width, cv.height);
    for (const st of strokesRef.current) {
      if (!st.pts || st.pts.length < 2) continue;
      g.save();
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.globalCompositeOperation = st.erase ? 'destination-out' : 'source-over';
      g.strokeStyle = st.color;
      g.lineWidth = (st.erase ? st.size * 3 : st.size) * (cv.width / 800);
      g.beginPath();
      st.pts.forEach(([x, y], i) => {
        i ? g.lineTo(x * cv.width, y * cv.height) : g.moveTo(x * cv.width, y * cv.height);
      });
      g.stroke();
      g.restore();
    }
  }, []);

  useEffect(() => {
    let alive = true;
    const cv = canvasRef.current;
    if (cv) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(cv.clientWidth * dpr);
      cv.height = Math.round(cv.clientWidth * 0.75 * dpr);
    }

    const reload = async () => {
      try {
        const { strokes, updatedAt } = await loadBoardMeta(code);
        if (!alive) return;
        strokesRef.current = strokes;
        setMeta({ count: strokes.length, updatedAt });
        drawAll();
      } catch { /* board may not exist yet — empty preview is fine */ }
    };
    reload();

    let ch;
    (async () => {
      ch = await boardChannel(code);
      if (!alive) { ch.close(); return; }
      ch.on(m => {
        if (!alive) return;
        if (m.k === 'stroke') {
          strokesRef.current.push(m.stroke);
          setMeta(prev => ({ count: prev.count + 1, updatedAt: new Date().toISOString() }));
          drawAll();
        }
        if (m.k === 'clear') {
          strokesRef.current = [];
          setMeta({ count: 0, updatedAt: new Date().toISOString() });
          drawAll();
        }
        if (m.k === 'undo') reload();
      });
    })();

    return () => { alive = false; ch?.close(); };
  }, [code, drawAll]);

  const ago = timeAgo(meta.updatedAt);

  return (
    <div className="wbc">
      <Link className="wbc-preview" to={`/whiteboard/${code}`} aria-label="Open the wall">
        <canvas ref={canvasRef} className="wbc-canvas" />
        {meta.count === 0 && (
          <div className="wbc-empty">a blank wall, waiting for the first doodle</div>
        )}
      </Link>
      <div className="wbc-side">
        <h3>{'\u270F\uFE0F'} Our wall</h3>
        <p>
          A canvas that never resets. Draw something before bed — it'll still
          be here in the morning. What one of you draws, the other sees live.
        </p>
        <div className="wbc-meta">
          {meta.count > 0
            ? `${meta.count} stroke${meta.count === 1 ? '' : 's'}${ago ? ' \u00b7 last drawn ' + ago : ''}`
            : 'nothing here yet'}
        </div>
        <Link className="btn warm" to={`/whiteboard/${code}`}>Open the wall</Link>
      </div>
    </div>
  );
}
