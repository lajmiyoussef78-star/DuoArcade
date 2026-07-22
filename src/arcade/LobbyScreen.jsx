import { useEffect, useState } from 'react';
import { ENGINES } from '../engines/index.js';
import { totalsOf, profileMilestones } from '../lib/util.js';
import ChallengeHistory from './ChallengeHistory.jsx';

const VIS_KEY = code => 'duoarcade-profile-vis-' + code;

const DEFAULT_VIS = {
  stats: true,
  split: true,
  taste: true,
  milestones: true,
  history: true,
};

const VIS_OPTIONS = [
  { id: 'stats', label: 'Our stats' },
  { id: 'split', label: 'Win split' },
  { id: 'taste', label: 'Taste match' },
  { id: 'milestones', label: 'Milestones' },
  { id: 'history', label: 'History' },
];

function loadVis(code) {
  try {
    const raw = JSON.parse(localStorage.getItem(VIS_KEY(code)) || '{}');
    return { ...DEFAULT_VIS, ...(raw && typeof raw === 'object' ? raw : {}) };
  } catch {
    return { ...DEFAULT_VIS };
  }
}

function saveVis(code, vis) {
  try { localStorage.setItem(VIS_KEY(code), JSON.stringify(vis)); } catch { /* ignore */ }
}

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
  myDuos, lobbyStatus, myRole = null,
  onOpenDuo, onCreateDuo, onJoinInvite, onToggleVisibility,
}) {
  const [nameA, setNameA] = useState('');
  const [nameB, setNameB] = useState('');
  const [inviteStr, setInviteStr] = useState('');
  const [joining, setJoining] = useState(false);
  const [editing, setEditing] = useState(false);
  const [histTab, setHistTab] = useState('game'); // game | challenge
  const duo = myDuos[0] || null;
  const [vis, setVis] = useState(() => (duo ? loadVis(duo.code) : { ...DEFAULT_VIS }));

  useEffect(() => {
    if (duo?.code) setVis(loadVis(duo.code));
  }, [duo?.code]);

  const doJoin = async () => {
    if (!onJoinInvite || !inviteStr.trim()) return;
    setJoining(true);
    try { await onJoinInvite(inviteStr.trim()); }
    finally { setJoining(false); }
  };

  const setVisField = (id, on) => {
    if (!duo) return;
    setVis(prev => {
      const next = { ...prev, [id]: on };
      saveVis(duo.code, next);
      return next;
    });
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
  const showTaste = vis.taste && (duo.tasteTotal > 0 || tastePct != null);
  const showMilestones = vis.milestones && milestones.length > 0;
  const resolvedRole = myRole === 'A' || myRole === 'B' ? myRole : null;
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
          <div className="profile-hero-actions">
            <button
              type="button"
              className={'btn small ghost' + (editing ? ' on' : '')}
              onClick={() => setEditing(v => !v)}
            >
              {editing ? 'Done' : 'Edit profile'}
            </button>
            <button type="button" className="btn warm profile-enter" onClick={() => onOpenDuo(duo.code)}>
              Back to arcade
            </button>
          </div>
        </header>

        {editing && (
          <div className="profile-edit">
            <div className="lobby-section-head">
              <h3>Edit profile</h3>
              <span>Show or hide sections</span>
            </div>
            <div className="profile-edit-toggles">
              {VIS_OPTIONS.map(opt => (
                <label key={opt.id} className="profile-edit-toggle">
                  <input
                    type="checkbox"
                    checked={!!vis[opt.id]}
                    onChange={e => setVisField(opt.id, e.target.checked)}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
            <div className="profile-edit-vis">
              <button
                type="button"
                className={'vis-btn' + (duo.showPublic ? ' pub' : '')}
                onClick={() => onToggleVisibility(duo)}
              >
                {duo.showPublic ? 'Public profile' : 'Private profile'}
              </button>
              <span className="profile-edit-hint">
                Public lets others find this duo on your account profile.
              </span>
            </div>
          </div>
        )}

        {vis.stats && (
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
          </div>
        )}

        {vis.split && (
          <div className="lobby-section">
            {!vis.stats && (
              <div className="lobby-section-head">
                <h3>Win split</h3>
                <span>Head to head</span>
              </div>
            )}
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
          </div>
        )}

        {showTaste && (
          <div className="lobby-section">
            <div className="profile-taste">
              <div>
                <div className="profile-taste-n">{tastePct != null ? tastePct + '%' : '—'}</div>
                <div className="profile-taste-l">taste match · {duo.tasteTotal || 0} watched</div>
              </div>
              <div className="taste-meter profile-taste-meter">
                <div className="taste-fill" style={{ width: (tastePct || 0) + '%' }} />
              </div>
            </div>
          </div>
        )}

        {showMilestones && (
          <div className="lobby-section">
            <div className="milestones profile-milestones">
              {milestones.map((m, i) => (
                <div className={'ms' + (m.lit ? ' lit' : '')} key={i}>{m.text}</div>
              ))}
            </div>
          </div>
        )}

        {vis.history && (
          <div className="lobby-section profile-history">
            <div className="lobby-section-head">
              <h3>History</h3>
              <span>Games & challenges</span>
            </div>
            <div className="profile-hist-tabs" role="tablist" aria-label="History type">
              <button
                type="button"
                role="tab"
                aria-selected={histTab === 'game'}
                className={'profile-hist-tab' + (histTab === 'game' ? ' on' : '')}
                onClick={() => setHistTab('game')}
              >
                Game history
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={histTab === 'challenge'}
                className={'profile-hist-tab' + (histTab === 'challenge' ? ' on' : '')}
                onClick={() => setHistTab('challenge')}
              >
                Challenge history
              </button>
            </div>

            {histTab === 'game' ? (
              rows.length === 0 ? (
                <p className="lobby-lead">No games played yet — open the arcade and your head-to-head records will land here.</p>
              ) : (
                <div className="profile-rec-list">
                  <p className="profile-rec-lead">Career records — wins for each game you&apos;ve played together.</p>
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
              )
            ) : (
              <div className="profile-chal-wrap">
                <ChallengeHistory code={duo.code} myRole={resolvedRole} compact />
              </div>
            )}
          </div>
        )}

        {lobbyStatus ? <div className="status lobby-status">{lobbyStatus}</div> : null}
      </div>
    </section>
  );
}
