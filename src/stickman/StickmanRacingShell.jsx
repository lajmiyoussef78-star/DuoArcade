import { useRef } from 'react';
import StickmanRacing from './StickmanRacing.jsx';
import '../styles/stickmanracing.css';

/**
 * Thin DuoArcade adapter — reports winners to the shell, then the race
 * returns to its own lobby (keepInGame — no "Back to shelf" panel).
 */
export default function StickmanRacingShell({ onComplete, pausedRef, myRole, rt, names }) {
  const doneRef = useRef(false);

  return (
    <div className="sr-shell">
      <StickmanRacing
        myRole={myRole}
        rt={rt}
        names={names}
        onComplete={(role) => {
          if (doneRef.current || pausedRef?.current) return;
          if (role !== 'A' && role !== 'B') return;
          doneRef.current = true;
          onComplete?.(role);
          window.setTimeout(() => { doneRef.current = false; }, 2500);
        }}
      />
    </div>
  );
}
