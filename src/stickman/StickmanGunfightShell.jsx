import { useEffect, useRef } from 'react';
import StickmanGunfight from './StickmanGunfight.jsx';
import './stickmangunfight.css';

/**
 * Thin DuoArcade adapter — renders the original gunfight game unchanged.
 * Watches the champion / draw banner to report the result to the shell.
 */
export default function StickmanGunfightShell({ onComplete, pausedRef }) {
  const rootRef = useRef(null);
  const doneRef = useRef(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const check = () => {
      if (doneRef.current || pausedRef?.current) return;
      const text = root.textContent || '';
      if (/SESSION DRAW/.test(text)) {
        doneRef.current = true;
        onComplete?.('draw');
        return;
      }
      const m = text.match(/PLAYER\s+([12])\s+IS THE (?:SESSION|GUNFIGHT) CHAMPION/);
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
    <div ref={rootRef} className="sgf-shell">
      <StickmanGunfight />
    </div>
  );
}
