import { useEffect, useState } from 'react';
import DuoProfileView from './DuoProfileView.jsx';

export default function LobbyScreen({
  myDuos, lobbyStatus, myRole = null,
  onOpenDuo, onCreateDuo, onJoinInvite, onToggleVisibility,
  /** When true (default), owning a duo immediately enters the arcade shelf — not Duo Profile. */
  autoEnter = true,
}) {
  const [nameA, setNameA] = useState('');
  const [nameB, setNameB] = useState('');
  const [inviteStr, setInviteStr] = useState('');
  const [joining, setJoining] = useState(false);
  const [phase, setPhase] = useState(autoEnter ? 'entering' : 'profile');
  const duo = myDuos[0] || null;

  // Returning from Arena / remount must not dump people on Duo Profile.
  useEffect(() => {
    if (!autoEnter) {
      setPhase('profile');
      return undefined;
    }
    if (!duo?.code || !onOpenDuo) {
      setPhase('profile');
      return undefined;
    }
    let alive = true;
    setPhase('entering');
    Promise.resolve(onOpenDuo(duo.code))
      .catch(() => {})
      .finally(() => {
        // If open worked, parent leaves lobby. If not, show profile + error.
        if (alive) setPhase('profile');
      });
    return () => { alive = false; };
  }, [autoEnter, duo?.code, onOpenDuo]);

  const doJoin = async () => {
    if (!onJoinInvite || !inviteStr.trim()) return;
    setJoining(true);
    try { await onJoinInvite(inviteStr.trim()); }
    finally { setJoining(false); }
  };

  if (!duo) {
    return (
      <section className="on lobby">
        <div className="card lobby-card">
          <div className="lobby-section">
            <div className="lobby-section-head">
              <h3>Start your duo</h3>
              <span>Create or join</span>
            </div>
            <p className="lobby-lead">
              Two people, one shared shelf — create a duo or paste an invite.
            </p>
            <div className="lobby-setup">
              <div className="lobby-panel">
                <div className="lobby-panel-tag">New</div>
                <h4>Create a duo</h4>
                <p>Two names. One shared streak and evening record.</p>
                <label htmlFor="nameA">Your name</label>
                <input type="text" id="nameA" maxLength={20} value={nameA}
                  onChange={e => setNameA(e.target.value)} placeholder="You" />
                <label htmlFor="nameB">Their name</label>
                <input type="text" id="nameB" maxLength={20} value={nameB}
                  onChange={e => setNameB(e.target.value)} placeholder="Partner" />
                <div className="row">
                  <button type="button" className="btn warm"
                    onClick={() => onCreateDuo(nameA.trim(), nameB.trim())}>
                    Create duo
                  </button>
                </div>
              </div>
              <div className="lobby-panel">
                <div className="lobby-panel-tag join">Join</div>
                <h4>Join with an invite</h4>
                <p>Paste the link your partner sent, or <code>CODE / token</code>.</p>
                <label htmlFor="inviteInput">Invite link or code</label>
                <input type="text" id="inviteInput" value={inviteStr}
                  placeholder="https://…/app?duo=…&t=…"
                  onChange={e => setInviteStr(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') doJoin(); }} />
                <div className="row">
                  <button type="button" className="btn warm"
                    disabled={joining || !inviteStr.trim()} onClick={doJoin}>
                    {joining ? 'Joining…' : 'Join duo'}
                  </button>
                </div>
              </div>
            </div>
            {lobbyStatus ? <div className="status">{lobbyStatus}</div> : null}
          </div>
        </div>
      </section>
    );
  }

  if (phase === 'entering') {
    return <div className="status">{lobbyStatus || 'Opening your duo…'}</div>;
  }

  return (
    <DuoProfileView
      duo={duo}
      mode="owner"
      myRole={myRole}
      onOpenDuo={onOpenDuo}
      onToggleVisibility={onToggleVisibility}
      status={lobbyStatus}
    />
  );
}
