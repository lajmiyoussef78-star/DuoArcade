// ContextRail.jsx — right-hand contextual column: relationship, primary actions,
// online friends and recent activity. Every value comes from an existing data source.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ENGINES } from '../engines/index.js';
import { isFriendOnline } from '../lib/friends.js';
import { getRecentGames } from '../lib/gameCatalog.js';
import { listMovieNights } from '../lib/watchMovie.js';
import ChallengeCard from './ChallengeCard.jsx';
import { TogetherHero } from './CoupleFx.jsx';
import { Ico } from './ui/icons.jsx';
import { StatusDot } from './ui/Primitives.jsx';

const MAX_SHOWN = 4;

function statusLine(f) {
  if (!isFriendOnline(f)) return 'Offline';
  if (f.status === 'busy') return f.busy_label || 'In a room';
  if (f.status === 'away') return 'Away';
  return 'Online';
}

function statusState(f) {
  if (!isFriendOnline(f)) return 'offline';
  if (f.status === 'busy') return 'busy';
  if (f.status === 'away') return 'away';
  return 'online';
}

function initial(name) {
  const s = String(name || '?').replace(/^@/, '');
  return (s[0] || '?').toUpperCase();
}

function ago(ts) {
  if (!ts) return '';
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? 'yesterday' : `${days}d ago`;
}

function openFriends() {
  window.dispatchEvent(new CustomEvent('duoarcade-open-friends'));
}

function RailHead({ title, actionLabel, onAction }) {
  return (
    <div className="crail-head">
      <h3 className="crail-title">{title}</h3>
      {onAction && (
        <button type="button" className="crail-link" onClick={onAction}>{actionLabel}</button>
      )}
    </div>
  );
}

function OnlineFriends({ enabled, friends, loaded, requests = 0 }) {
  const shown = friends.slice(0, MAX_SHOWN);
  /* Without a friends session there is nothing left to wait for, so fall
     straight through to the empty state instead of hiding the card. */
  const settled = loaded || !enabled;
  const empty = shown.length === 0;

  /* Must be a <div>, not <section>: arcade.scoped.css hides every
     `.arcade-page section` that lacks `.on`. */
  return (
    <div className="crail-card crail-panel crail-panel-friends">
      <RailHead title="Online Friends" actionLabel="See all" onAction={openFriends} />
      {requests > 0 && (
        <button type="button" className="crail-requests" onClick={openFriends}>
          <span className="crail-requests-n">{requests}</span>
          {requests === 1 ? 'friend request' : 'friend requests'}
        </button>
      )}
      {empty ? (
        <div className="crail-slot">
          {settled ? (
            <div className="crail-empty">
              <span className="crail-empty-title">No friends yet</span>
              Add friends to start playing together.
              <button type="button" className="crail-empty-btn" onClick={openFriends}>
                <Ico.plus size={14} />
                <span>Add friends</span>
              </button>
            </div>
          ) : (
            <p className="crail-empty">Loading friends…</p>
          )}
        </div>
      ) : (
        <ul className="crail-friends">
          {shown.map(f => (
            <li key={f.id} className="crail-friend-row">
              <button
                type="button"
                className={'crail-friend' + (isFriendOnline(f) ? ' on' : '')}
                onClick={openFriends}
              >
                <span className="crail-friend-av">
                  {initial(f.username)}
                  <StatusDot state={statusState(f)} />
                </span>
                <span className="crail-friend-copy">
                  <span className="crail-friend-name">{f.username}</span>
                  <span className="crail-friend-status">{statusLine(f)}</span>
                </span>
              </button>
              <button
                type="button"
                className="crail-friend-act"
                aria-label={`Open friends panel for ${f.username}`}
                onClick={openFriends}
              >
                <Ico.chat size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* Two real sources, merged newest first: the local recent-games list and the
   duo's movie nights. Nothing here is synthesised — an empty duo shows the
   empty state rather than invented events. */
function RecentActivity({ code, onStartGame, onOpenWatch, onSeeAll }) {
  const [tick, setTick] = useState(0);
  const [nights, setNights] = useState([]);

  useEffect(() => {
    const bump = () => setTick(t => t + 1);
    window.addEventListener('duoarcade-recent-games', bump);
    window.addEventListener('focus', bump);
    return () => {
      window.removeEventListener('duoarcade-recent-games', bump);
      window.removeEventListener('focus', bump);
    };
  }, []);

  useEffect(() => {
    if (!code) return undefined;
    let alive = true;
    listMovieNights(code)
      .then(rows => { if (alive) setNights(Array.isArray(rows) ? rows : []); })
      .catch(() => {});
    return () => { alive = false; };
  }, [code, tick]);

  const items = useMemo(() => {
    void tick;
    const played = getRecentGames(code, MAX_SHOWN)
      .map(e => ({ ...e, eng: ENGINES[e.id] }))
      .filter(e => e.eng)
      .map(e => ({
        key: 'g:' + e.id,
        kind: 'game',
        label: `Played ${e.eng.meta.name} together`,
        at: e.at,
        run: () => onStartGame?.(e.id),
      }));

    const watched = nights.slice(0, MAX_SHOWN).map(n => ({
      key: 'w:' + n.id,
      kind: 'watch',
      label: `Watched ${n.title || 'a movie'} together`,
      at: Date.parse(n.updated_at || n.created_at || '') || 0,
      run: () => onOpenWatch?.(),
    }));

    return [...played, ...watched].sort((a, b) => b.at - a.at).slice(0, MAX_SHOWN);
  }, [code, tick, nights, onStartGame, onOpenWatch]);

  return (
    <div className="crail-card crail-panel crail-panel-recent">
      <RailHead title="Recent activity" actionLabel="See all" onAction={onSeeAll} />
      {items.length === 0 ? (
        <div className="crail-slot">
          <div className="crail-empty">
            <span className="crail-empty-title">No activity yet</span>
            Play a game or start a watch party together.
          </div>
        </div>
      ) : (
        <ul className="crail-recent">
          {items.map(item => (
            <li key={item.key}>
              <button type="button" className="crail-recent-row" onClick={item.run}>
                <span className={'crail-recent-ico crail-recent-ico-' + item.kind} aria-hidden="true">
                  {item.kind === 'watch' ? (
                    <Ico.watch size={15} />
                  ) : (
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none"
                      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12.5 10 17.5 19 7" />
                    </svg>
                  )}
                </span>
                <span className="crail-recent-name">{item.label}</span>
                {item.at > 0 && <span className="crail-recent-meta">{ago(item.at)}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ContextRail({
  duo, code, myRole, presence, geoStatus, onSetAnniversary, onStartGame,
  friendsEnabled = false, friends = [], friendsLoaded = false, friendRequests = 0,
}) {
  const navigate = useNavigate();
  const openWatch = useCallback(() => navigate('/app/place/sect-watch'), [navigate]);
  const openGames = useCallback(() => {
    const onHome = window.location.pathname === '/app' || window.location.pathname === '/app/';
    if (onHome) {
      document.getElementById('sect-play')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      navigate('/app', { state: { scrollTo: 'sect-play' } });
    }
  }, [navigate]);

  return (
    <aside className="crail" aria-label="Relationship and social">
      <div className="crail-card crail-together" id="sect-together">
        <TogetherHero
          duo={duo}
          code={code}
          myRole={myRole}
          presence={presence}
          geoStatus={geoStatus}
          onSetAnniversary={onSetAnniversary}
        />
      </div>

      <div className="crail-actions">
        <button type="button" className="crail-cta" onClick={openWatch}>
          <span className="crail-cta-ico" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M8 5.5v13l11-6.5-11-6.5Z" />
            </svg>
          </span>
          Create Watch Party
        </button>
        <ChallengeCard />
        <button type="button" className="crail-cta2" onClick={openFriends}>
          <span>Invite Friends</span>
          <span className="crail-cta2-plus" aria-hidden="true"><Ico.plus size={16} /></span>
        </button>
      </div>

      <div className="crail-stack">
        <OnlineFriends
          enabled={friendsEnabled}
          friends={friends}
          loaded={friendsLoaded}
          requests={friendRequests}
        />
        <RecentActivity
          code={code}
          onStartGame={onStartGame}
          onOpenWatch={openWatch}
          onSeeAll={openGames}
        />
      </div>
    </aside>
  );
}
