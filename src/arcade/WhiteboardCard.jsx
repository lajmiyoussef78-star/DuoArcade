// src/arcade/WhiteboardCard.jsx — the "Our wall" section for the duo home.

import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { loadBoardMeta, boardChannel } from '../lib/whiteboard.js';
import '../styles/whiteboard.css';

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

  return (
    <div className="wbc">
      <Link className="wbc-preview" to={`/whiteboard/${code}`} aria-label="Open the wall">
        <canvas ref={canvasRef} className="wbc-canvas" />
        {meta.count === 0 && (
          <div className="wbc-empty">a blank wall, waiting for the first doodle</div>
        )}
      </Link>
      <div className="wbc-side">
        <Link className="btn warm" to={`/whiteboard/${code}`}>Open the wall</Link>
      </div>
    </div>
  );
}
