import { useEffect, useRef } from 'react';
import StickmanDodgeball from './StickmanDodgeball.jsx';

/**
 * Thin DuoArcade adapter — renders the original dodgeball game unchanged.
 * Watches the champion banner to report the winner to the shell.
 */
export default function StickmanDodgeballShell({ onComplete, pausedRef }) {
  const rootRef = useRef(null);
  const doneRef = useRef(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const check = () => {
      if (doneRef.current || pausedRef?.current) return;
      const text = root.textContent || '';
      const m = text.match(/PLAYER\s+([12])\s+IS THE CHAMPION/);
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
    <div ref={rootRef} className="sdb-shell">
      <StickmanDodgeball />
    </div>
  );
}
