// src/components/SteerWheel.jsx — Loop Duel on-screen steering wheel.
// Drag clockwise to turn; release springs back to center.

import { useEffect, useRef, useState } from 'react';

const MAX_DEG = 110;

export default function SteerWheel({ steerRef, seat = 'A', disabled = false }) {
  const wrapRef = useRef(null);
  const [deg, setDeg] = useState(0);
  const dragging = useRef(false);
  const lastAng = useRef(null);
  const keysSteer = useRef(0);
  const degRef = useRef(0);

  function setSteer(d) {
    const clamped = Math.max(0, Math.min(MAX_DEG, d));
    degRef.current = clamped;
    setDeg(clamped);
    const fromWheel = clamped / MAX_DEG;
    steerRef.current = disabled ? 0 : Math.max(fromWheel, keysSteer.current);
  }

  useEffect(() => {
    const down = e => {
      if (![' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
      e.preventDefault();
      keysSteer.current = 1;
      steerRef.current = disabled ? 0 : 1;
    };
    const up = e => {
      if (![' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
      keysSteer.current = 0;
      steerRef.current = disabled ? 0 : (degRef.current / MAX_DEG);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [disabled, steerRef]);

  function pointerAngle(e) {
    const el = wrapRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return Math.atan2(e.clientX - cx, -(e.clientY - cy)) * (180 / Math.PI);
  }

  function onDown(e) {
    if (disabled) return;
    e.preventDefault();
    dragging.current = true;
    lastAng.current = pointerAngle(e);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  function onMove(e) {
    if (!dragging.current || disabled) return;
    e.preventDefault();
    const ang = pointerAngle(e);
    let delta = ang - lastAng.current;
    // unwrap across ±180
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    lastAng.current = ang;
    // only clockwise increases turn (game turns clockwise); CCW eases off
    setSteer(degRef.current + delta);
  }

  function onUp(e) {
    if (!dragging.current) return;
    dragging.current = false;
    lastAng.current = null;
    try { e.currentTarget.releasePointerCapture?.(e.pointerId); } catch { /* */ }
    setSteer(0);
  }

  const accent = seat === 'A' ? 'var(--p1)' : 'var(--p2)';

  return (
    <div className="lp-wheel-dock">
      <div
        ref={wrapRef}
        className={'lp-wheel' + (disabled ? ' off' : '') + (deg > 4 ? ' turning' : '')}
        style={{ '--wheel-rot': `${deg}deg`, '--wheel-accent': accent }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onContextMenu={e => e.preventDefault()}
        role="slider"
        aria-label="Steering wheel"
        aria-valuemin={0}
        aria-valuemax={MAX_DEG}
        aria-valuenow={Math.round(deg)}
      >
        <div className="lp-wheel-rim">
          <span className="lp-wheel-grip g1" />
          <span className="lp-wheel-grip g2" />
          <span className="lp-wheel-grip g3" />
          <span className="lp-wheel-spoke s1" />
          <span className="lp-wheel-spoke s2" />
          <span className="lp-wheel-spoke s3" />
          <span className="lp-wheel-hub" />
        </div>
      </div>
      <div className="lp-wheel-hint">turn the wheel · SPACE / arrows</div>
    </div>
  );
}
