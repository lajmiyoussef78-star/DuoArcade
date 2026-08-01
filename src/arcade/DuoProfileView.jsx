// Shared duo profile card — owner lobby + public leaderboard view.

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

/**
 * @param {'owner' | 'public'} mode
 * owner: edit toggles, visibility, optional challenge history, back-to-arcade
 * public: read-only shared stats (no duo code, no challenges)
 */
export default function DuoProfileView({
  duo,
  mode = 'owner',
  myRole = null,
  onBack,
  onOpenDuo,
  onToggleVisibility,
  status = '',
}) {
  const isOwner = mode === 'owner';
  const [editing, setEditing] = useState(false);
  const [histTab, setHistTab] = useState('game');
  const [vis, setVis] = useState(() => (
    isOwner && duo?.code ? loadVis(duo.code) : { ...DEFAULT_VIS }
  ));

  useEffect(() => {
    if (isOwner && duo?.code) setVis(loadVis(duo.code));
    else setVis({ ...DEFAULT_VIS });
  }, [isOwner, duo?.code]);

  if (!duo) return null;

  const setVisField = (id, on) => {
    if (!isOwner || !duo.code) return;
    setVis(prev => {
      const next = { ...prev, [id]: on };
      saveVis(duo.code, next);
      return next;
    });
  };

  const t = totalsOf(duo);
  const rows = recordRows(duo);
  const tastePct = duo.tasteTotal > 0
    ? Math.round(100 * duo.tasteAgree / duo.tasteTotal) : null;
  const lead = t.a === t.b ? 'Tied' : (t.a > t.b ? duo.nameA : duo.nameB);
  const milestones = profileMilestones(duo, t);
  const showTaste = vis.taste && (duo.tasteTotal > 0 || tastePct != null);
  const showMilestones = vis.milestones && milestones.length > 0;
  const resolvedRole = myRole === 'A' || myRole === 'B' ? myRole : null;
  const canShowChallenges = isOwner && !!duo.code;

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
              {isOwner && duo.code ? (
                <>
                  <span className="lobby-code">{duo.code}</span>
                  <span className="dot">·</span>
                </>
              ) : null}
              <span>{duo.showPublic || !isOwner ? 'Public' : 'Private'}</span>
            </div>
          </div>
          <div className="profile-hero-actions">
            {isOwner ? (
              <>
                <button
                  type="button"
                  className={'btn small ghost' + (editing ? ' on' : '')}
                  onClick={() => setEditing(v => !v)}
                >
                  {editing ? 'Done' : 'Edit profile'}
                </button>
                <button
                  type="button"
                  className="btn warm profile-enter"
                  onClick={() => onOpenDuo?.(duo.code)}
                >
                  Back to arcade
                </button>
              </>
            ) : (
              <button type="button" className="btn warm profile-enter" onClick={onBack}>
                Back
              </button>
            )}
          </div>
        </header>

        {isOwner && editing && (
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
                onClick={() => onToggleVisibility?.(duo)}
              >
                {duo.showPublic ? 'Public profile' : 'Private profile'}
              </button>
              <span className="profile-edit-hint">
                Public lets others find this duo on the leaderboard.
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
              <span>{canShowChallenges ? 'Games & challenges' : 'Games'}</span>
            </div>
            {canShowChallenges ? (
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
            ) : null}

            {(!canShowChallenges || histTab === 'game') ? (
              rows.length === 0 ? (
                <p className="lobby-lead">
                  {isOwner
                    ? 'No games played yet — open the arcade and your head-to-head records will land here.'
                    : 'No games on this public record yet.'}
                </p>
              ) : (
                <div className="profile-rec-list">
                  <p className="profile-rec-lead">
                    Career records — wins for each game {isOwner ? "you've" : "they've"} played together.
                  </p>
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

        {status ? <div className="status lobby-status">{status}</div> : null}
      </div>
    </section>
  );
}
