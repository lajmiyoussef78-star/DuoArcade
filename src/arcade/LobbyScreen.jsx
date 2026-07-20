import { useRef, useState } from 'react';

function initial(name) {
  const s = (name || '?').trim();
  return (s[0] || '?').toUpperCase();
}

export default function LobbyScreen({
  profile, myDuos, lobbyStatus,
  onSaveUsername, onOpenDuo, onCreateDuo, onJoinInvite, onDeleteDuo, onSignOut,
  onToggleVisibility, onClearStuck, onSearch, onOpenProfile
}) {
  const [showUname, setShowUname] = useState(!profile?.username);
  const [uname, setUname] = useState('');
  const [unameStatus, setUnameStatus] = useState('');
  const [nameA, setNameA] = useState('');
  const [nameB, setNameB] = useState('');
  const [inviteStr, setInviteStr] = useState('');
  const [joining, setJoining] = useState(false);
  const [results, setResults] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const searchTimer = useRef(null);
  const hasDuo = myDuos.length > 0;

  const confirmDelete = async d => {
    if (confirmText.trim().toUpperCase() !== d.code) return;
    setDeleteBusy(true);
    try { await onDeleteDuo(d); } finally {
      setDeleteBusy(false);
      setDeleting(null);
      setConfirmText('');
    }
  };

  const saveUname = async () => {
    try {
      await onSaveUsername(uname);
      setUnameStatus('');
      setShowUname(false);
    } catch (e) { setUnameStatus(e.message); }
  };

  const doSearch = q => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      if (q.trim().length < 2) { setResults(null); return; }
      try { setResults(await onSearch(q.trim())); }
      catch (e) { setResults({ error: e.message }); }
    }, 300);
  };

  const doJoin = async () => {
    if (!onJoinInvite || !inviteStr.trim()) return;
    setJoining(true);
    try { await onJoinInvite(inviteStr.trim()); }
    finally { setJoining(false); }
  };

  const totalGames = d =>
    Object.values(d.records || {}).reduce((n, r) => n + (r.a || 0) + (r.b || 0) + (r.d || 0), 0);

  return (
    <section className="on lobby">
      <div className="card lobby-card">
        {/* identity */}
        <header className="lobby-id">
          <div className="lobby-id-main">
            <div className="lobby-mono" aria-hidden="true">
              {(profile?.username || '?')[0].toUpperCase()}
            </div>
            <div className="lobby-id-text">
              <div className="lobby-id-label">Signed in</div>
              <div className="lobby-id-name">
                <span className="uname">
                  {profile?.username ? '@' + profile.username : 'pick a username'}
                </span>
                {profile?.user_no ? (
                  <span className="lobby-member">Member #{profile.user_no}</span>
                ) : null}
              </div>
            </div>
          </div>
          <div className="lobby-id-actions">
            <button type="button" className="btn small ghost" onClick={() => setShowUname(v => !v)}>
              {showUname ? 'Done' : 'Edit'}
            </button>
            <button type="button" className="btn small ghost" onClick={onSignOut}>Sign out</button>
          </div>
        </header>

        {showUname && (
          <div className="lobby-panel lobby-uname">
            <label htmlFor="unameInput">Public username</label>
            <input type="text" id="unameInput" maxLength={20} placeholder="e.g. youssef_k"
              value={uname} onChange={e => setUname(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveUname(); }} />
            <div className="row">
              <button type="button" className="btn warm small" onClick={saveUname}>Save username</button>
            </div>
            {unameStatus ? <div className="status">{unameStatus}</div> : null}
          </div>
        )}

        {/* duo */}
        <div className="lobby-section">
          <div className="lobby-section-head">
            <h3>Your duo</h3>
            <span>{hasDuo ? 'One shared home' : 'Create or join'}</span>
          </div>

          {!hasDuo && (
            <p className="lobby-lead">
              Start a duo with two names, or paste the invite your partner sent.
            </p>
          )}

          <div className="duo-list">
            {myDuos.map(d => (
              <div key={d.code} className="lobby-duo">
                <button type="button" className="lobby-duo-hero" onClick={() => onOpenDuo(d.code)}>
                  <div className="avatars" aria-hidden="true">
                    <div className="av A">{initial(d.nameA)}</div>
                    <div className="av B">{initial(d.nameB)}</div>
                  </div>
                  <div className="lobby-duo-copy">
                    <div className="duo-title">
                      <span className="pA">{d.nameA}</span>
                      <span className="amp"> & </span>
                      <span className="pB">{d.nameB}</span>
                    </div>
                    <div className="lobby-duo-stats">
                      <span><b>{totalGames(d)}</b> games</span>
                      <span className="dot">·</span>
                      <span><b>{d.evenings || 0}</b> evenings</span>
                      <span className="dot">·</span>
                      <span className="lobby-code">{d.code}</span>
                    </div>
                  </div>
                  <span className="lobby-enter">Enter</span>
                </button>

                <div className="lobby-duo-tools">
                  <button
                    type="button"
                    className={'vis-btn' + (d.showPublic ? ' pub' : '')}
                    title="Who can see this duo on your profile"
                    onClick={() => onToggleVisibility(d)}
                  >
                    {d.showPublic ? 'Public' : 'Private'}
                  </button>
                  <button
                    type="button"
                    className="vis-btn"
                    title="Clear any stuck game or invite"
                    onClick={() => onClearStuck(d)}
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    className="vis-btn danger"
                    title="Delete this duo forever"
                    onClick={() => {
                      setDeleting(deleting === d.code ? null : d.code);
                      setConfirmText('');
                    }}
                  >
                    Delete
                  </button>
                </div>

                {deleting === d.code && (
                  <div className="lobby-danger">
                    <p>
                      This erases <b>{d.nameA} & {d.nameB}</b> for both of you — streaks,
                      records, snaps, todos, and the whiteboard. No undo.
                    </p>
                    <label htmlFor="delConfirm">Type <b>{d.code}</b> to confirm</label>
                    <input type="text" id="delConfirm" maxLength={5} value={confirmText}
                      onChange={e => setConfirmText(e.target.value)} autoComplete="off" />
                    <div className="row">
                      <button type="button" className="btn small"
                        disabled={deleteBusy || confirmText.trim().toUpperCase() !== d.code}
                        onClick={() => confirmDelete(d)}>
                        {deleteBusy ? 'Deleting…' : 'Delete forever'}
                      </button>
                      <button type="button" className="btn ghost small"
                        onClick={() => { setDeleting(null); setConfirmText(''); }}>
                        Keep it
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {hasDuo ? (
            <p className="lobby-note">
              One duo per account. To start another, delete yours first — you’ll lose your shared history.
            </p>
          ) : (
            <div className="lobby-setup">
              <div className="lobby-panel">
                <div className="lobby-panel-tag">New</div>
                <h4>Create a duo</h4>
                <p>Two names. One shared shelf, streak, and evening record.</p>
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
          )}
        </div>

        {lobbyStatus ? <div className="status lobby-status">{lobbyStatus}</div> : null}

        {/* find people */}
        <div className="lobby-section lobby-find">
          <div className="lobby-section-head">
            <h3>Find people</h3>
            <span>Public profiles</span>
          </div>
          <input type="text" className="lobby-search" placeholder="Search by username…"
            onChange={e => doSearch(e.target.value)} />
          <div className="search-results">
            {results?.error && <div className="status">{results.error}</div>}
            {Array.isArray(results) && !results.length && <div className="status">No one found.</div>}
            {Array.isArray(results) && results.map(r => (
              <button type="button" className="sr-item" key={r.username}
                onClick={() => onOpenProfile(r.username)}>
                <div>
                  <span className="uname">@{r.username}</span>
                  <span className="c"> #{r.user_no ?? '?'}</span>
                </div>
                <div className="c">{r.public_duos} public duo{r.public_duos === 1 ? '' : 's'}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
