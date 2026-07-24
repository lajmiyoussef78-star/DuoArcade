import { useEffect, useRef } from 'react';
import LaserWallDuel from './LaserWallDuel.jsx';
import './laserwall.css';

/**
 * Thin DuoArcade adapter — renders Laser Wall Duel as-is (same keyboard).
 * Watches the final-results banner to report the winner to the shell.
 */
export default function LaserWallShell({ onComplete, pausedRef }) {
  const rootRef = useRef(null);
  const doneRef = useRef(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const check = () => {
      if (doneRef.current || pausedRef?.current) return;
      const text = root.textContent || '';
      if (/IT'S A TIE!/i.test(text)) {
        doneRef.current = true;
        onComplete?.('draw');
        return;
      }
      const m = text.match(/PLAYER\s+([12])\s+WINS!/i);
      if (!m) return;
      doneRef.current = true;
      onComplete?.(m[1] === '1' ? 'A' : 'B');
    };

    const mo = new MutationObserver(check);
    mo.observe(root, { childList: true, subtree: true, characterData: true });
    check();
    return () => mo.disconnect();
  }, [onComplete, pausedRef]);

  return (
    <div ref={rootRef} className="lwd-shell">
      <LaserWallDuel />
    </div>
  );
}
