import LaserWallDuel from './LaserWallDuel.jsx';
import './laserwall.css';

/** Thin DuoArcade adapter; completion is an explicit authoritative event. */
export default function LaserWallShell({
  onComplete,
  pausedRef,
  myRole,
  rt,
  names,
  matchId,
}) {
  return (
    <div className="lwd-shell">
      <LaserWallDuel
        myRole={myRole}
        rt={rt}
        names={names}
        matchId={matchId}
        externalPausedRef={pausedRef}
        onComplete={onComplete}
      />
    </div>
  );
}
