import { useState } from 'react';
import { ENGINES } from '../engines/index.js';
import { totalsOf, profileMilestones } from '../lib/util.js';

function initial(name) {
  const s = (name || '?').trim();
  return (s[0] || '?').toUpperCase();
}

function recordRows(duo) {
  return Object.entries(duo.records || {})
    .map(([id, r]) => {
      const eng = ENGINES[id];
      if (!eng) return null;
      const a = r.a || 0, b = r.b || 0, d = r.d || 0;
      const games = a + b + d;
      if (!games) return null;
      return { id, name: eng.meta.name, a, b, d, games };
    })
    .filter(Boolean)
    .sort((x, y) => y.games - x.games);
}

export default function LobbyScreen({
  myDuos, lobbyStatus,
  onOpenDuo, onCreateDuo, onJoinInvite, onDeleteDuo, onToggleVisibility
}) {
  const [nameA, setNameA] = useState('');
  const [nameB, setNameB] = useState('');
  const [inviteStr, setInviteStr] = useState('');
  const [joining, setJoining] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const duo = myDuos[0] || null;

  const confirmDelete = async d => {
    if (confirmText.trim().toUpperCase() !== d.code) return;
    setDeleteBusy(true);
    try { await onDeleteDuo(d); } finally {
      setDeleteBusy(false);
      setDeleting(null);
      setConfirmText('');
    }
  };

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

  const t = totalsOf(duo);
  const rows = recordRows(duo);
  const tastePct = duo.tasteTotal > 0
    ? Math.round(100 * duo.tasteAgree / duo.tasteTotal) : null;
  const lead = t.a === t.b ? 'Tied' : (t.a > t.b ? duo.nameA : duo.nameB);
  const milestones = profileMilestones(duo, t);

  return (
    <section className="on lobby">
      <div className="card lobby-card profile-card">
        <header className="profile-hero">
          <div className="avatars profile-avs" aria-hidden="true">
            <div className="av A">{initial(duo.nameA)}</div>
            <div className="av B">{initial(duo.nameB)}</div>
          </div>
          <div className="profile-hero-copy">
            <div className="profile-kicker">Duo profile</div>
            <h2 className="duo-title profile-title">
              <span className="pA">{duo.nameA}</span>
              <span className="amp"> & </span>
              <span className="pB">{duo.nameB}</span>
            </h2>
            <div className="profile-sub">
              <span className="lobby-code">{duo.code}</span>
              <span className="dot">·</span>
              <span>{duo.showPublic ? 'Public' : 'Private'}</span>
            </div>
          </div>
          <button type="button" className="btn warm profile-enter" onClick={() => onOpenDuo(duo.code)}>
            Back to arcade
          </button>
        </header>

        <div className="lobby-section">
          <div className="lobby-section-head">
            <h3>Our stats</h3>
            <span>Shared record</span>
          </div>
          <div className="home-stats profile-stats">
            <div className="hstat">
              <div className="n">{t.games}</div>
              <div className="l">games</div>
            </div>
            <div className="hstat">
              <div className="n">{duo.evenings || 0}</div>
              <div className="l">evenings</div>
            </div>
            <div className="hstat">
              <div className="n">{duo.streak || 0}</div>
              <div className="l">streak</div>
            </div>
            <div className="hstat">
              <div className="n">{duo.bestStreak || 0}</div>
              <div className="l">best streak</div>
            </div>
          </div>

          <div className="profile-split">
            <div className="profile-split-card A">
              <div className="profile-split-name">{duo.nameA}</div>
              <div className="profile-split-n">{t.a}</div>
              <div className="profile-split-l">wins</div>
            </div>
            <div className="profile-split-mid">
              <div className="profile-split-score">{t.a}–{t.b}</div>
              <div className="profile-split-lead">{lead}</div>
              {t.d > 0 && <div className="profile-split-draws">{t.d} draws</div>}
            </div>
            <div className="profile-split-card B">
              <div className="profile-split-name">{duo.nameB}</div>
              <div className="profile-split-n">{t.b}</div>
              <div className="profile-split-l">wins</div>
            </div>
          </div>

          {(duo.tasteTotal > 0 || tastePct != null) && (
            <div className="profile-taste">
              <div>
                <div className="profile-taste-n">{tastePct != null ? tastePct + '%' : '—'}</div>
                <div className="profile-taste-l">taste match · {duo.tasteTotal || 0} watched</div>
              </div>
              <div className="taste-meter profile-taste-meter">
                <div className="taste-fill" style={{ width: (tastePct || 0) + '%' }} />
              </div>
            </div>
          )}

          {milestones.length > 0 && (
            <div className="milestones profile-milestones">
              {milestones.map((m, i) => (
                <div className={'ms' + (m.lit ? ' lit' : '')} key={i}>{m.text}</div>
              ))}
            </div>
          )}
        </div>

        <div className="lobby-section profile-records">
          <div className="lobby-section-head">
            <h3>Our records</h3>
            <span>{rows.length ? `${rows.length} games played` : 'No matches yet'}</span>
          </div>
          {rows.length === 0 ? (
            <p className="lobby-lead">Open the arcade and play — every result lands here.</p>
          ) : (
            <div className="profile-rec-list">
              {rows.map(r => (
                <div className="profile-rec" key={r.id}>
                  <div className="profile-rec-name">{r.name}</div>
                  <div className="profile-rec-meta">{r.games} played{r.d ? ` · ${r.d} draws` : ''}</div>
                  <div className="profile-rec-score">
                    <span className="pA">{r.a}</span>
                    <span className="amp">–</span>
                    <span className="pB">{r.b}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <footer className="profile-foot">
          <button
            type="button"
            className={'vis-btn' + (duo.showPublic ? ' pub' : '')}
            onClick={() => onToggleVisibility(duo)}
          >
            {duo.showPublic ? 'Public profile' : 'Private profile'}
          </button>
          <button
            type="button"
            className="vis-btn danger"
            onClick={() => {
              setDeleting(deleting === duo.code ? null : duo.code);
              setConfirmText('');
            }}
          >
            Delete duo
          </button>
        </footer>

        {deleting === duo.code && (
          <div className="lobby-danger profile-danger">
            <p>
              This erases <b>{duo.nameA} & {duo.nameB}</b> for both of you — streaks,
              records, snaps, todos, and the whiteboard. No undo.
            </p>
            <label htmlFor="delConfirm">Type <b>{duo.code}</b> to confirm</label>
            <input type="text" id="delConfirm" maxLength={5} value={confirmText}
              onChange={e => setConfirmText(e.target.value)} autoComplete="off" />
            <div className="row">
              <button type="button" className="btn small"
                disabled={deleteBusy || confirmText.trim().toUpperCase() !== duo.code}
                onClick={() => confirmDelete(duo)}>
                {deleteBusy ? 'Deleting…' : 'Delete forever'}
              </button>
              <button type="button" className="btn ghost small"
                onClick={() => { setDeleting(null); setConfirmText(''); }}>
                Keep it
              </button>
            </div>
          </div>
        )}

        {lobbyStatus ? <div className="status lobby-status">{lobbyStatus}</div> : null}
      </div>
    </section>
  );
}
