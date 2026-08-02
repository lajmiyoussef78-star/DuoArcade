import { useEffect, useState } from 'react';
import { Outlet, useLocation, useParams } from 'react-router-dom';
import DuoHomeChrome from './DuoHomeChrome.jsx';
import DashHeader from './DashHeader.jsx';
import SideNav from './SideNav.jsx';
import ContextRail from './ContextRail.jsx';
import useFriendsView from './useFriendsView.js';
import { getDuoAvatars } from '../lib/avatars.js';

/* Sidebar highlight for the feature ids that are not their own page. */
const HOME_SECTIONS = ['sect-play', 'sect-favorites', 'sect-together'];

/**
 * Persistent 3-column shell for /app and /app/place/* so DuoHomeChrome (XP bar, etc.)
 * does not remount — and the XP fill does not animate from 0 — on every nav.
 */
export default function DuoHomeLayout({
  duo, code, myRole, isAway, presence, geoStatus,
  onSetAnniversary, onBack, onStartGame, avatarTick = 0,
  username = '', friendsEnabled = false,
}) {
  const { featureId } = useParams();
  const location = useLocation();
  const [avatars, setAvatars] = useState({ avatar_a: null, avatar_b: null });
  const { friends, incoming, loaded: friendsLoaded } = useFriendsView(friendsEnabled);
  const onPlace = location.pathname.includes('/place/');
  const onSettings = featureId === 'sect-settings';
  const activeNavId = onPlace
    ? (featureId || location.pathname.split('/').pop())
    : 'sect-play';
  /* Settings nav item id is "settings"; the place route id is sect-settings. */
  const navActive = onSettings
    ? 'settings'
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

  return (
    <section className={'on home-wide duo-shell' + (onSettings ? ' duo-shell-settings' : '')}>
      <SideNav
        duo={duo}
        code={code}
        myRole={myRole}
        avatars={avatars}
        activeId={navActive}
        onBack={onBack}
        hasPass={!!(duo.passTier && duo.passTier !== 'free')}
        username={username}
        requestCount={incoming.length}
      />

      {!onSettings && (
        <DashHeader
          duo={duo}
          code={code}
          myRole={myRole}
          avatars={avatars}
          onStartGame={onStartGame}
          onBack={onBack}
          requestCount={incoming.length}
        />
      )}

      <div className="duo-main">
        <div className="card home-card">
          {!onSettings && (
            <DuoHomeChrome
              duo={duo}
              code={code}
              isAway={isAway}
              avatars={avatars}
              onBack={onBack}
              activeNavId={activeNavId}
            />
          )}
          <Outlet />
        </div>
      </div>

      {!onSettings && (
        <ContextRail
          duo={duo}
          code={code}
          myRole={myRole}
          presence={presence}
          geoStatus={geoStatus}
          onSetAnniversary={onSetAnniversary}
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
