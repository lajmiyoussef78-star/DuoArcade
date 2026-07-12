import { useState } from 'react';
import { ENGINES } from '../engines/index.js';

export default function InviteOverlay({
  duo, myRole, suppressedUntil, onAccept, onDecline, onDismiss, onForceClear
}) {
  const [error, setError] = useState('');
  const s = duo?.session;
  const show = s && s.game && s.phase === 'invite' && s.by !== myRole && !s.winner
    && s.startedAt && Date.now() - s.startedAt <= 120000
    && Date.now() >= suppressedUntil;

  if (!show) return null;
  const eng = ENGINES[s.game];
  const who = s.by === 'A' ? duo.nameA : duo.nameB;

  return (
    <div className="invite-overlay on">
      <div className="invite-modal" style={{ position: 'relative' }}>
        <button className="inv-x" title="Hide (doesn't answer)" onClick={onDismiss}>{'✕'}</button>
        <div className="invite-icon">🎮</div>
        <div className="invite-text"><b>{who}</b> wants to play<br />{eng ? eng.meta.name : s.game}</div>
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="btn warm" onClick={() => onAccept(setError)}>Accept & play</button>
          <button className="btn ghost" onClick={() => onDecline(setError)}>Decline</button>
        </div>
        <button className="inv-force" onClick={() => onForceClear(setError)}>stuck invitation? force clear it</button>
        <div className="status" style={{ color: '#FF8A8A', minHeight: 0 }}>{error}</div>
      </div>
    </div>
  );
}
