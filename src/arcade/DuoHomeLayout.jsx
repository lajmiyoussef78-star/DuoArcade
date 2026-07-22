import { Outlet, useLocation, useParams } from 'react-router-dom';
import FeatureRail from './FeatureRail.jsx';
import DuoHomeChrome from './DuoHomeChrome.jsx';

/**
 * Persistent shell for /app and /app/place/* so DuoHomeChrome (XP bar, etc.)
 * does not remount — and the XP fill does not animate from 0 — on every nav.
 */
export default function DuoHomeLayout({
  duo, code, myRole, isAway, presence, geoStatus,
  onSetAnniversary, onBack, avatarTick = 0,
}) {
  const { featureId } = useParams();
  const location = useLocation();
  const onPlace = location.pathname.includes('/place/');
  const activeNavId = onPlace
    ? (featureId || location.pathname.split('/').pop())
    : 'sect-play';
  const railActive = onPlace && featureId && !['sect-play', 'sect-favorites', 'sect-together'].includes(featureId)
    ? featureId
    : null;

  return (
    <section className="on home-wide">
      <FeatureRail activeFeature={railActive} />
      <div className="card home-card">
        <DuoHomeChrome
          duo={duo}
          code={code}
          myRole={myRole}
          isAway={isAway}
          presence={presence}
          geoStatus={geoStatus}
          onSetAnniversary={onSetAnniversary}
          onBack={onBack}
          avatarTick={avatarTick}
          activeNavId={activeNavId}
        />
        <Outlet />
      </div>
    </section>
  );
}
