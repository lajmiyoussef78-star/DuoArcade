import { useRef, useState } from 'react';

export default function LobbyScreen({
  profile, myDuos, lobbyStatus,
  onSaveUsername, onOpenDuo, onCreateDuo, onSignOut,
  onToggleVisibility, onClearStuck, onSearch, onOpenProfile
}) {
  const [showUname, setShowUname] = useState(!profile?.username);
  const [uname, setUname] = useState('');
  const [unameStatus, setUnameStatus] = useState('');
  const [nameA, setNameA] = useState('');
  const [nameB, setNameB] = useState('');
  const [results, setResults] = useState(null);
  const searchTimer = useRef(null);

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

  const totalGames = d =>
    Object.values(d.records || {}).reduce((n, r) => n + (r.a || 0) + (r.b || 0) + (r.d || 0), 0);

  return (
    <section className="on">
      <div className="card">
        <div className="duo-head" style={{ marginBottom: 6 }}>
          <div>Signed in as <span className="uname">
            {profile?.username ? '@' + profile.username : 'no username yet'}
          </span> <span className="who">{profile?.user_no ? `· Member #${profile.user_no}` : ''}</span></div>
          <button className="btn small ghost" onClick={() => setShowUname(v => !v)}>Change</button>
        </div>
        {showUname && (
          <div>
            <label htmlFor="unameInput">Pick a username (public, searchable)</label>
            <input type="text" id="unameInput" maxLength={20} placeholder="e.g. youssef_k"
              value={uname} onChange={e => setUname(e.target.value)} />
            <div className="row"><button className="btn warm small" onClick={saveUname}>Save username</button></div>
            <div className="status">{unameStatus}</div>
          </div>
        )}

        <h3 style={{ margin: '14px 0 8px' }}>Your duos</h3>
        <div className="duo-list">
          {!myDuos.length && <div className="status">No duos yet — make your first one below.</div>}
          {myDuos.map(d => (
            <div className="duo-item" key={d.code} onClick={() => onOpenDuo(d.code)}>
              <div>
                <div className="dn">{d.nameA} & {d.nameB}</div>
                <div className="dm">{totalGames(d)} games · {d.evenings || 0} evenings</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className={'vis-btn' + (d.showPublic ? ' pub' : '')}
                  title="Who can see this duo on your profile"
                  onClick={e => { e.stopPropagation(); onToggleVisibility(d); }}>
                  {d.showPublic ? 'Public' : 'Private'}
                </button>
                <button className="vis-btn" title="Clear any stuck game/invite in this duo"
                  onClick={e => { e.stopPropagation(); onClearStuck(d); }}>{'⟳'}</button>
                <div>{'›'}</div>
              </div>
            </div>
          ))}
        </div>

        <label htmlFor="nameA">Your name</label>
        <input type="text" id="nameA" maxLength={20} value={nameA} onChange={e => setNameA(e.target.value)} />
        <label htmlFor="nameB">Their name</label>
        <input type="text" id="nameB" maxLength={20} value={nameB} onChange={e => setNameB(e.target.value)} />
        <div className="row">
          <button className="btn warm" onClick={() => onCreateDuo(nameA.trim(), nameB.trim())}>Create duo</button>
          <button className="btn ghost small" onClick={onSignOut}>Sign out</button>
        </div>
        <div className="status">{lobbyStatus}</div>

        <h3 style={{ margin: '18px 0 8px' }}>Find people</h3>
        <input type="text" placeholder="start typing…" onChange={e => doSearch(e.target.value)} />
        <div className="search-results">
          {results?.error && <div className="status">{results.error}</div>}
          {Array.isArray(results) && !results.length && <div className="status">No one found.</div>}
          {Array.isArray(results) && results.map(r => (
            <div className="sr-item" key={r.username} onClick={() => onOpenProfile(r.username)}>
              <div>@{r.username} <span className="c">#{r.user_no ?? '?'}</span></div>
              <div className="c">{r.public_duos} public duo{r.public_duos === 1 ? '' : 's'}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
