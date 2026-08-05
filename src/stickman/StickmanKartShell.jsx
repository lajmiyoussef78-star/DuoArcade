import { useEffect, useRef } from 'react';
import StickmanKartRacing from './StickmanKartRacing.jsx';
import './stickmankart.css';

/**
 * Thin DuoArcade adapter — renders Stickman Kart Racing as-is (same keyboard).
 * Watches the results banner to report the winner to the shell.
 */
export default function StickmanKartShell({ onComplete, pausedRef, myRole, rt, names }) {
  const rootRef = useRef(null);
  const doneRef = useRef(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const check = () => {
      if (pausedRef?.current) return;
      const el = root.querySelector('[data-skr-winner]');
      if (!el) {
        // Cleared when returning to lobby — allow the next race to tally.
        doneRef.current = false;
        return;
      }
      if (doneRef.current) return;
      const role = el?.getAttribute('data-skr-winner');
      if (role !== 'A' && role !== 'B') return;
      doneRef.current = true;
      onComplete?.(role);
    };

    const mo = new MutationObserver(check);
    mo.observe(root, { childList: true, subtree: true, characterData: true });
    check();
    return () => mo.disconnect();
  }, [onComplete, pausedRef]);

  return (
    <div ref={rootRef} className="skr-shell">
      <StickmanKartRacing myRole={myRole} rt={rt} names={names} />
    </div>
  );
}
