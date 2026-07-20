// src/pages/MagnetHearts.jsx — Magnet Hearts (mounted by the magnethearts engine).
// Host-authoritative over the shell RT channel. 90s highest bank wins.

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  recordMagnetHearts, mhInitial, mhStep, MH, ZONES
} from '../lib/magnethearts.js';
import '../styles/magnethearts.css';

function toShellWinner(w) {
  return w === 'D' ? 'draw' : w;
}

export default function MagnetHearts({ myRole, names = {}, rt, code, onComplete }) {
  const me = myRole;
  const nm = { A: names.A || 'A', B: names.B || 'B' };

  const [phase, setPhase] = useState('wait'); // wait | play | done
  const [hud, setHud] = useState({ a: 0, b: 0, left: MH.MATCH_SECONDS });
  const [winner, setWinner] = useState(null);

  const canvasRef = useRef(null);
  const meRef = useRef(me);
  const stRef = useRef(mhInitial(1));
  const dirRef = useRef({ x: 0, y: 0 });
  const throwEdgeRef = useRef(false);
  const guestInRef = useRef({ x: 0, y: 0, throw: false });
  const keysRef = useRef({});
  const fxRef = useRef([]);
  const prevScoreRef = useRef({ A: 0, B: 0 });
  const startedRef = useRef(false);
  const endedRef = useRef(false);
  const phaseRef = useRef('wait');
  meRef.current = me;
  phaseRef.current = phase;

  const finish = useCallback((w, iRecord) => {
    if (endedRef.current && phaseRef.current === 'done') return;
    endedRef.current = true;
    setWinner(w);
    setPhase('done');
    if (iRecord) {
      onComplete?.(toShellWinner(w));
      recordMagnetHearts(code, w).catch(() => {});
    }
  }, [code, onComplete]);

  const begin = useCallback((seed) => {
    if (startedRef.current) return;
    startedRef.current = true;
    endedRef.current = false;
    stRef.current = mhInitial(seed);
    fxRef.current = [];
    prevScoreRef.current = { A: 0, B: 0 };
    dirRef.current = { x: 0, y: 0 };
    throwEdgeRef.current = false;
    guestInRef.current = { x: 0, y: 0, throw: false };
    setWinner(null);
    setHud({ a: 0, b: 0, left: MH.MATCH_SECONDS });
    setPhase('play');
  }, []);

  useEffect(() => {
    const dirFromKeys = () => {
      const k = keysRef.current;
      let x = 0, y = 0;
      if (k.ArrowLeft || k.a) x -= 1;
      if (k.ArrowRight || k.d) x += 1;
      if (k.ArrowUp || k.w) y -= 1;
      if (k.ArrowDown || k.s) y += 1;
      dirRef.current = { x, y };
    };
    const down = e => {
      if (e.key === ' ') { e.preventDefault(); throwEdgeRef.current = true; return; }
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd', 'w', 's'].includes(key)) {
        e.preventDefault();
        keysRef.current[key] = true;
        dirFromKeys();
      }
    };
    const up = e => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      keysRef.current[key] = false;
      dirFromKeys();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  useEffect(() => {
    if (!rt?.on) return undefined;
    rt.on(m => {
      if (!m?.k) return;
      if (m.k === 'needstart') {
        if (meRef.current === 'A' && startedRef.current && stRef.current) {
          rt.send({ k: 'start', seed: stRef.current.seed });
        }
        return;
      }
      if (m.k === 'start') {
        begin(m.seed ?? ((Date.now() >>> 0) ^ 0x4EA47));
        return;
      }
      if (m.k === 'st') {
        stRef.current = m.st;
        return;
      }
      if (m.k === 'in') {
        guestInRef.current.x = m.x;
        guestInRef.current.y = m.y;
        if (m.throw) guestInRef.current.throw = true;
        return;
      }
      if (m.k === 'over') {
        finish(m.winner, false);
      }
    });
    return undefined;
  }, [rt, begin, finish]);

  useEffect(() => {
    if (me === 'A') {
      const seed = (Date.now() >>> 0) ^ 0x4EA47;
      const push = () => rt?.send({ k: 'start', seed });
      begin(seed);
      push();
      const t1 = setTimeout(push, 400);
      const t2 = setTimeout(push, 1200);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    const ask = () => { if (!startedRef.current) rt?.send({ k: 'needstart' }); };
    ask();
    const iv = setInterval(ask, 700);
    return () => clearInterval(iv);
  }, [me, rt, begin]);

  const drawHeart = useCallback((g, x, y, size, fill, glow) => {
    g.save();
    g.translate(x, y);
    if (glow) { g.shadowColor = fill; g.shadowBlur = 12; }
    g.fillStyle = fill;
    g.beginPath();
    const s = size;
    g.moveTo(0, s * 0.32);
    g.bezierCurveTo(0, s * 0.02, -s * 0.52, -s * 0.18, -s * 0.5, -s * 0.14);
    g.bezierCurveTo(-s * 0.5, -s * 0.48, -s * 0.06, -s * 0.48, 0, -s * 0.16);
    g.bezierCurveTo(s * 0.06, -s * 0.48, s * 0.5, -s * 0.48, s * 0.5, -s * 0.14);
    g.bezierCurveTo(s * 0.52, -s * 0.02, 0, s * 0.08, 0, s * 0.32);
    g.closePath();
    g.fill();
    g.shadowBlur = 0;
    g.fillStyle = 'rgba(255,255,255,.35)';
    g.beginPath(); g.arc(-s * 0.2, -s * 0.22, s * 0.09, 0, 7); g.fill();
    g.restore();
  }, []);

  const draw = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const g = cv.getContext('2d');
    const st = stRef.current;
    const css = getComputedStyle(document.documentElement);
    const P1 = css.getPropertyValue('--p1').trim() || '#7FA8FF';
    const P2 = css.getPropertyValue('--p2').trim() || '#FF7FA8';
    const CANC = css.getPropertyValue('--candle').trim() || '#FFC66E';

    const bg = g.createLinearGradient(0, 0, 0, MH.H);
    bg.addColorStop(0, '#1E1830'); bg.addColorStop(1, '#171226');
    g.fillStyle = bg; g.fillRect(0, 0, MH.W, MH.H);
    g.fillStyle = 'rgba(242,237,247,.025)';
    for (let cx = 0; cx < MH.W; cx += 56) {
      for (let cy = 0; cy < MH.H; cy += 56) {
        if (((cx + cy) / 56) % 2 === 0) g.fillRect(cx, cy, 56, 56);
      }
    }
    g.strokeStyle = 'rgba(61,52,80,.9)'; g.lineWidth = 4;
    g.strokeRect(2, 2, MH.W - 4, MH.H - 4);

    for (const r of ['A', 'B']) {
      const z = ZONES[r];
      const col = r === 'A' ? P1 : P2;
      const grad = g.createRadialGradient(z.x, z.y, 8, z.x, z.y, MH.ZONE_R);
      grad.addColorStop(0, r === 'A' ? 'rgba(127,168,255,.20)' : 'rgba(255,127,168,.20)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.beginPath(); g.arc(z.x, z.y, MH.ZONE_R, 0, 7); g.fill();
      g.strokeStyle = col; g.lineWidth = 2; g.setLineDash([10, 8]);
      g.beginPath(); g.arc(z.x, z.y, MH.ZONE_R, 0, 7); g.stroke();
      g.setLineDash([]);
    }

    for (const it of st.items) {
      if (it.type === 'bomb') {
        g.fillStyle = '#14141C';
        g.beginPath(); g.arc(it.x, it.y, 13, 0, 7); g.fill();
        g.strokeStyle = '#34343F'; g.lineWidth = 2;
        g.beginPath(); g.arc(it.x, it.y, 13, 0, 7); g.stroke();
        g.fillStyle = 'rgba(255,255,255,.22)';
        g.beginPath(); g.arc(it.x - 4, it.y - 5, 3.4, 0, 7); g.fill();
        g.strokeStyle = '#6B5A44'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(it.x + 6, it.y - 10); g.quadraticCurveTo(it.x + 12, it.y - 16, it.x + 15, it.y - 13); g.stroke();
        g.fillStyle = CANC;
        const tw = 1 + Math.sin(st.t * 14 + it.id) * 0.8;
        g.beginPath(); g.arc(it.x + 15, it.y - 13, 2 + tw, 0, 7); g.fill();
      } else {
        drawHeart(g, it.x, it.y, 15, it.type === 'gold' ? CANC : P2, it.type === 'gold');
      }
    }

    for (const r of ['A', 'B']) {
      const p = st.pods[r];
      const col = r === 'A' ? P1 : P2;
      g.strokeStyle = r === 'A' ? 'rgba(127,168,255,.10)' : 'rgba(255,127,168,.10)';
      g.lineWidth = 1.5;
      g.beginPath(); g.arc(p.x, p.y, MH.MAG_R, 0, 7); g.stroke();

      g.save();
      g.translate(p.x, p.y);
      g.rotate(Math.atan2(p.fy, p.fx));
      const grad = g.createRadialGradient(-5, -6, 3, 0, 0, MH.POD_R);
      grad.addColorStop(0, 'rgba(255,255,255,.85)');
      grad.addColorStop(0.25, col);
      grad.addColorStop(1, r === 'A' ? '#3A5CA8' : '#B04A72');
      g.fillStyle = grad;
      g.beginPath(); g.arc(0, 0, MH.POD_R, 0, 7); g.fill();
      g.strokeStyle = '#E8E2F0'; g.lineWidth = 6; g.lineCap = 'round';
      g.beginPath(); g.arc(MH.POD_R - 2, 0, 11, -Math.PI / 2.6, Math.PI / 2.6); g.stroke();
      g.strokeStyle = '#C8412B'; g.lineWidth = 6;
      g.beginPath(); g.arc(MH.POD_R - 2, 0, 11, -Math.PI / 2.6, -Math.PI / 5); g.stroke();
      g.lineCap = 'butt';
      g.restore();
    }

    for (const fx of fxRef.current) {
      g.globalAlpha = Math.max(0, fx.life);
      g.font = '800 22px Inter, sans-serif';
      g.textAlign = 'center';
      g.fillStyle = fx.neg ? '#FF8A8A' : '#6FDCA8';
      g.fillText(fx.text, fx.x, fx.y);
      g.globalAlpha = 1;
    }
  }, [drawHeart]);

  useEffect(() => {
    if (phase !== 'play') return undefined;
    const isHost = meRef.current === 'A';
    let raf, last = performance.now();

    const net = setInterval(() => {
      if (endedRef.current) return;
      if (isHost) rt?.send({ k: 'st', st: stRef.current });
      else {
        rt?.send({
          k: 'in',
          x: dirRef.current.x, y: dirRef.current.y,
          throw: throwEdgeRef.current
        });
        throwEdgeRef.current = false;
      }
    }, 50);

    const loop = now => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      if (isHost && !endedRef.current) {
        const myThrow = throwEdgeRef.current; throwEdgeRef.current = false;
        const gThrow = guestInRef.current.throw; guestInRef.current.throw = false;
        const next = mhStep(stRef.current, {
          A: { x: dirRef.current.x, y: dirRef.current.y, throw: myThrow },
          B: { x: guestInRef.current.x, y: guestInRef.current.y, throw: gThrow }
        }, dt);
        stRef.current = next;
        if (next.over && !endedRef.current) {
          endedRef.current = true;
          rt?.send({ k: 'st', st: next });
          rt?.send({ k: 'over', winner: next.winner });
          finish(next.winner, true);
        }
      }
      const st = stRef.current;
      setHud({ a: st.score.A, b: st.score.B, left: Math.ceil(st.left) });
      for (const r of ['A', 'B']) {
        const d = st.score[r] - prevScoreRef.current[r];
        if (d !== 0) {
          fxRef.current.push({
            x: ZONES[r].x, y: ZONES[r].y - 30,
            text: (d > 0 ? '+' : '') + d,
            neg: d < 0, life: 1
          });
        }
        prevScoreRef.current[r] = st.score[r];
      }
      fxRef.current.forEach(fx => { fx.life -= dt * 0.8; fx.y -= dt * 34; });
      fxRef.current = fxRef.current.filter(fx => fx.life > 0);
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); clearInterval(net); };
  }, [phase, rt, finish, draw]);

  function padDir(x, y) { dirRef.current = { x, y }; }

  if (!me || phase === 'wait') {
    return <div className="mh-shell"><p className="mh-status">Charging the magnets…</p></div>;
  }

  return (
    <div className="mh-shell">
      <div className="mh-gamewrap">
        <div className="mh-hud">
          <span className="pA">{nm.A} <b>{hud.a}</b></span>
          <span className="mh-clock">{hud.left}s</span>
          <span className="pB"><b>{hud.b}</b> {nm.B}</span>
        </div>
        <div className="mh-canvaswrap">
          <canvas ref={canvasRef} width={MH.W} height={MH.H} className="mh-canvas" />
        </div>

        {phase === 'play' && (
          <div className="mh-touch">
            <div className="mh-pad">
              <button type="button" className="mh-padbtn up" onPointerDown={() => padDir(0, -1)} onPointerUp={() => padDir(0, 0)} onPointerLeave={() => padDir(0, 0)}>{'\u25B2'}</button>
              <button type="button" className="mh-padbtn left" onPointerDown={() => padDir(-1, 0)} onPointerUp={() => padDir(0, 0)} onPointerLeave={() => padDir(0, 0)}>{'\u25C0'}</button>
              <button type="button" className="mh-padbtn right" onPointerDown={() => padDir(1, 0)} onPointerUp={() => padDir(0, 0)} onPointerLeave={() => padDir(0, 0)}>{'\u25B6'}</button>
              <button type="button" className="mh-padbtn down" onPointerDown={() => padDir(0, 1)} onPointerUp={() => padDir(0, 0)} onPointerLeave={() => padDir(0, 0)}>{'\u25BC'}</button>
            </div>
            <button type="button" className="mh-throw" onPointerDown={() => { throwEdgeRef.current = true; }}>
              THROW
            </button>
          </div>
        )}

        {phase === 'done' && winner && (
          <div className="mh-done">
            <div className="mh-winline">
              {winner === 'D' ? 'Dead even \u2014 a draw' : `${nm[winner]} wins the harvest`}
            </div>
            <div className="mh-final">{hud.a} {'\u2013'} {hud.b}</div>
          </div>
        )}
      </div>
    </div>
  );
}
