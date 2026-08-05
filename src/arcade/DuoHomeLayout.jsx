import { useEffect, useState } from 'react';
import { Outlet, useLocation, useParams } from 'react-router-dom';
import DuoHomeChrome from './DuoHomeChrome.jsx';
import DashHeader from './DashHeader.jsx';
import SideNav from './SideNav.jsx';
import ContextRail from './ContextRail.jsx';
import useFriendsView from './useFriendsView.js';
import { getDuoAvatars } from '../lib/avatars.js';

const CRAIL_LS_KEY = 'duoarcade.crailHidden';

function readCrailHidden() {
  try {
    return localStorage.getItem(CRAIL_LS_KEY) === '1';
  } catch {
    return false;
  }
}

/* Sidebar highlight for the feature ids that are not their own page. */
const HOME_SECTIONS = ['sect-play', 'sect-favorites', 'sect-together'];

/**
 * Persistent 3-column shell for /app and /app/place/* so DuoHomeChrome (XP bar, etc.)
 * does not remount — and the XP fill does not animate from 0 — on every nav.
 */
export default function DuoHomeLayout({
  duo, code, myRole, isAway, presence, geoStatus,
  onSetAnniversary, onBack, onStartGame, onSignOut, avatarTick = 0,
  username = '', friendsEnabled = false,
}) {
  const { featureId } = useParams();
  const location = useLocation();
  const [avatars, setAvatars] = useState({ avatar_a: null, avatar_b: null });
  const [crailHidden, setCrailHidden] = useState(readCrailHidden);
  const { friends, incoming, loaded: friendsLoaded } = useFriendsView(friendsEnabled);
  const onPlace = location.pathname.includes('/place/');
  const onSettings = featureId === 'sect-settings';
  const onWall = featureId === 'sect-wall';
  const onSavedBoards = featureId === 'sect-saved-boards';
  const onTodoList = featureId === 'sect-list';
  /* Live canvas, saved library, and to-do share the full-bleed main shell. */
  const fullBleed = onWall || onSavedBoards || onTodoList;
  const fullMain = onSettings || fullBleed;
  const activeNavId = onPlace
    ? (featureId || location.pathname.split('/').pop())
    : 'sect-play';
  /* Settings nav item id is "settings"; the place route id is sect-settings.
     Saved boards is reached from the wall clock — keep Whiteboard highlighted. */
  const navActive = onSettings
    ? 'settings'
    : onSavedBoards
      ? 'sect-wall'
      : onPlace && featureId && !HOME_SECTIONS.includes(featureId)
        ? featureId
        : 'home';

  useEffect(() => {
    if (!code) return undefined;
    let alive = true;
    getDuoAvatars(code)
      .then(data => { if (alive) setAvatars(data || { avatar_a: null, avatar_b: null }); })
      .catch(() => {});
    return () => { alive = false; };
  }, [code, avatarTick]);

  const toggleCrail = () => {
    setCrailHidden(prev => {
      const next = !prev;
      try { localStorage.setItem(CRAIL_LS_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  };

  return (
    <section className={
      'on home-wide duo-shell'
      + (onSettings ? ' duo-shell-settings' : '')
      + (fullBleed ? ' duo-shell-wall' : '')
      + ((onSavedBoards || onTodoList) ? ' duo-shell-saved' : '')
      + (!fullMain && crailHidden ? ' duo-shell-crail-off' : '')
    }
    >
      <SideNav
        duo={duo}
        code={code}
        myRole={myRole}
        avatars={avatars}
        activeId={navActive}
        onBack={onBack}
        onSignOut={onSignOut}
        hasPass={!!(duo.passTier && duo.passTier !== 'free')}
        username={username}
        requestCount={incoming.length}
      />

      {!fullMain && (
        <DashHeader
          duo={duo}
          code={code}
          myRole={myRole}
          avatars={avatars}
          onStartGame={onStartGame}
          onBack={onBack}
          requestCount={incoming.length}
          crailHidden={crailHidden}
          onToggleCrail={toggleCrail}
        />
      )}

      <div className="duo-main">
        <div className="card home-card">
          {!fullMain && (
            <DuoHomeChrome
              duo={duo}
              code={code}
              myRole={myRole}
              isAway={isAway}
              avatars={avatars}
              presence={presence}
              geoStatus={geoStatus}
              onSetAnniversary={onSetAnniversary}
              onBack={onBack}
              activeNavId={activeNavId}
            />
          )}
          <Outlet />
        </div>
      </div>

      {!fullMain && !crailHidden && (
        <ContextRail
          code={code}
          onStartGame={onStartGame}
          friendsEnabled={friendsEnabled}
          friends={friends}
          friendsLoaded={friendsLoaded}
          friendRequests={incoming.length}
        />
      )}
    </section>
  );
}
