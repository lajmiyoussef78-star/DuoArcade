// src/pages/Whiteboard.jsx — route: /whiteboard/:code

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { myRoleInDuo, duoNames, loadBoard, saveBoard, boardChannel } from '../lib/whiteboard.js';
import '../styles/whiteboard.css';

const COLORS = ['#F2EDF7', '#7FA8FF', '#FF7FA8', '#FFC66E', '#6FDCA8', '#C89BFF'];
const SIZES = [3, 6, 12];

let strokeSeq = 0;
const newId = role => Date.now().toString(36) + '-' + role + '-' + (strokeSeq++);

export default function Whiteboard() {
  const { code } = useParams();
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [role, setRole] = useState(undefined);
  const [names, setNames] = useState({ A: 'A', B: 'B' });
  const [color, setColor] = useState(COLORS[1]);
  const [size, setSize] = useState(SIZES[1]);
  const [erasing, setErasing] = useState(false);
  const [status, setStatus] = useState('');
  const [partnerCursor, setPartnerCursor] = useState(null);

  const strokesRef = useRef([]);
  const currentRef = useRef(null);
  const channelRef = useRef(null);
  const saveTimer = useRef(null);
  const sendTimer = useRef(null);
  const pendingPts = useRef([]);
  const cursorTimer = useRef(0);

  const ctx2d = () => canvasRef.current?.getContext('2d');

  const drawSeg = useCallback((pts, strokeColor, strokeSize, erase) => {
    const cv = canvasRef.current, g = ctx2d();
    if (!cv || !g || pts.length < 2) return;
    g.save();
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
    g.strokeStyle = strokeColor;
    g.lineWidth = (erase ? strokeSize * 3 : strokeSize) * (cv.width / 800);
    g.beginPath();
    pts.forEach(([x, y], i) => {
      const px = x * cv.width, py = y * cv.height;
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    });
    g.stroke();
    g.restore();
  }, []);

  const redraw = useCallback(() => {
    const cv = canvasRef.current, g = ctx2d();
    if (!cv || !g) return;
    g.clearRect(0, 0, cv.width, cv.height);
    for (const s of strokesRef.current) drawSeg(s.pts, s.color, s.size, s.erase);
  }, [drawSeg]);

  const resizeCanvas = useCallback(() => {
    const cv = canvasRef.current, wrap = wrapRef.current;
    if (!cv || !wrap) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = wrap.clientWidth;
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(w * 0.75 * dpr);
    redraw();
  }, [redraw]);

  const scheduleSave = useCallback(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await saveBoard(code, strokesRef.current);
        setStatus('');
      } catch (e) { setStatus('Save failed: ' + e.message); }
    }, 1500);
  }, [code]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await myRoleInDuo(code);
      if (!alive) return;
      setRole(r);
      if (!r) return;
      setNames(await duoNames(code));
      try {
        strokesRef.current = await loadBoard(code);
      } catch (e) { setStatus('Couldn\u2019t load the board: ' + e.message); }
      redraw();

      const ch = await boardChannel(code);
      if (!alive) { ch.close(); return; }
      channelRef.current = ch;
      ch.on(m => {
        if (m.k === 'live') drawSeg(m.pts, m.color, m.size, m.erase);
        if (m.k === 'stroke') strokesRef.current.push(m.stroke);
        if (m.k === 'undo') {
          strokesRef.current = strokesRef.current.filter(s => s.id !== m.id);
          redraw();
        }
        if (m.k === 'clear') { strokesRef.current = []; redraw(); }
        if (m.k === 'cursor') setPartnerCursor({ x: m.x, y: m.y, at: Date.now() });
      });
    })();

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => {
      alive = false;
      window.removeEventListener('resize', resizeCanvas);
      channelRef.current?.close();
      clearTimeout(saveTimer.current);
      clearInterval(sendTimer.current);
    };
  }, [code, redraw, resizeCanvas, drawSeg]);

  useEffect(() => {
    if (!partnerCursor) return;
    const t = setTimeout(() => setPartnerCursor(pc =>
      pc && Date.now() - pc.at > 2900 ? null : pc), 3000);
    return () => clearTimeout(t);
  }, [partnerCursor]);

  const posOf = e => {
    const cv = canvasRef.current;
    const rect = cv.getBoundingClientRect();
    return [
      Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
    ];
  };

  const flushLive = useCallback(() => {
    const s = currentRef.current;
    if (!s || pendingPts.current.length < 2) return;
    channelRef.current?.send({
      k: 'live', pts: pendingPts.current, color: s.color, size: s.size, erase: s.erase
    });
    pendingPts.current = [pendingPts.current[pendingPts.current.length - 1]];
  }, []);

  const onDown = e => {
    if (!role) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const p = posOf(e);
    currentRef.current = {
      id: newId(role), by: role,
      color, size, erase: erasing, pts: [p]
    };
    pendingPts.current = [p];
    clearInterval(sendTimer.current);
    sendTimer.current = setInterval(flushLive, 150);
  };

  const onMove = e => {
    const p = posOf(e);
    const now = Date.now();
    if (now - cursorTimer.current > 150) {
      cursorTimer.current = now;
      channelRef.current?.send({ k: 'cursor', x: p[0], y: p[1] });
    }
    const s = currentRef.current;
    if (!s) return;
    const last = s.pts[s.pts.length - 1];
    if (Math.abs(last[0] - p[0]) + Math.abs(last[1] - p[1]) < 0.002) return;
    s.pts.push(p);
    pendingPts.current.push(p);
    drawSeg([last, p], s.color, s.size, s.erase);
  };

  const onUp = () => {
    const s = currentRef.current;
    if (!s) return;
    clearInterval(sendTimer.current);
    flushLive();
    currentRef.current = null;
    if (s.pts.length > 1) {
      strokesRef.current.push(s);
      channelRef.current?.send({ k: 'stroke', stroke: s });
      scheduleSave();
    }
  };

  const undoMine = () => {
    const mine = strokesRef.current.filter(s => s.by === role);
    if (!mine.length) return;
    const last = mine[mine.length - 1];
    strokesRef.current = strokesRef.current.filter(s => s.id !== last.id);
    channelRef.current?.send({ k: 'undo', id: last.id });
    redraw();
    scheduleSave();
  };

  const clearBoard = () => {
    if (!window.confirm('Clear the whole board for both of you?')) return;
    strokesRef.current = [];
    channelRef.current?.send({ k: 'clear' });
    redraw();
    scheduleSave();
  };

  if (role === undefined) return <div className="wb-page"><p className="wb-status">Loading…</p></div>;
  if (role === null) {
    return (
      <div className="wb-page">
        <p className="wb-status">Sign in as a member of this duo to use its whiteboard.</p>
        <button className="btn" onClick={() => navigate('/app')}>Back to the arcade</button>
      </div>
    );
  }

  const partnerName = role === 'A' ? names.B : names.A;

  return (
    <div className="wb-page">
      <div className="wb-top">
        <button className="btn small ghost" onClick={() => navigate('/app')}>&larr; Back</button>
        <div className="wb-title">Whiteboard</div>
        <div className="wb-partner">{partnerName ? `drawing with ${partnerName}` : ''}</div>
      </div>

      <div className="wb-board" ref={wrapRef}>
        <canvas
          ref={canvasRef}
          className="wb-canvas"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
        />
        {partnerCursor && (
          <div
            className={'wb-ghost ' + (role === 'A' ? 'B' : 'A')}
            style={{ left: (partnerCursor.x * 100) + '%', top: (partnerCursor.y * 100) + '%' }}
          />
        )}
      </div>

      <div className="wb-tools">
        <div className="wb-swatches">
          {COLORS.map(c => (
            <button key={c}
              className={'wb-swatch' + (color === c && !erasing ? ' on' : '')}
              style={{ background: c }}
              onClick={() => { setColor(c); setErasing(false); }} />
          ))}
        </div>
        <div className="wb-sizes">
          {SIZES.map(s => (
            <button key={s}
              className={'wb-size' + (size === s ? ' on' : '')}
              onClick={() => setSize(s)}>
              <span style={{ width: s + 2, height: s + 2 }} />
            </button>
          ))}
        </div>
        <div className="wb-actions">
          <button className={'btn small' + (erasing ? ' warm' : ' ghost')}
            onClick={() => setErasing(v => !v)}>Eraser</button>
          <button className="btn small ghost" onClick={undoMine}>Undo mine</button>
          <button className="btn small ghost" onClick={clearBoard}>Clear</button>
        </div>
      </div>

      {status && <div className="wb-status">{status}</div>}
    </div>
  );
}
