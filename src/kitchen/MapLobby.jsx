import { ENVIRONMENTS, MAPS } from './game/maps/catalog';
import { useKitchenProgress } from './kitchenProgressStore';

function MapStars({ percent }) {
  const fill = Math.max(0, Math.min(100, percent));
  return (
    <span className="map-slot-stars" title={`Best ${fill}%`} aria-label={`Best ${fill}%`}>
      <span className="map-slot-stars-track" aria-hidden>
        ★★★
      </span>
      <span className="map-slot-stars-fill" style={{ width: `${fill}%` }} aria-hidden>
        ★★★
      </span>
    </span>
  );
}

/** Original gastronomica map lobby — shared duo vote when onPick is set. */
export function MapLobby({
  onPlay,
  compact = false,
  myRole = null,
  myPick = null,
  partnerPick = null,
  partnerName = 'Partner',
  onPick,
  showCoins = true,
  matched = false,
  myReady = false,
  partnerReady = false,
  onReady,
  starting = false
}) {
  const duoMode = Boolean(onPick);
  const coins = useKitchenProgress(s => s.coins);
  const mapBest = useKitchenProgress(s => s.mapBest);

  function bestFor(mapId) {
    return mapBest[mapId] ?? null;
  }

  const readyLabel = starting
    ? 'Starting…'
    : !matched
      ? 'Pick same map'
      : myReady && partnerReady
        ? 'Both ready!'
        : myReady
          ? 'Waiting…'
          : 'Ready';

  return (
    <div className={'map-lobby' + (compact ? ' compact' : '')}>
      {!compact && (
        <header className="map-lobby-head">
          <p className="embed-kicker">Pick a kitchen</p>
          <h2>Environments</h2>
          <p className="map-lobby-lead">
            {duoMode
              ? 'Both pick the same map, then both press Ready to start the kitchen.'
              : 'Four worlds · five maps each · start with Map 1, more unlock later.'}
          </p>
        </header>
      )}

      {showCoins && (
        <div className="kitchen-coins-bar" title={duoMode ? 'Kitchen coins' : 'Your kitchen coins'}>
          <span className="kitchen-coins-icon" aria-hidden>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" fill="#f9a825" stroke="#ef6c00" strokeWidth="2" />
              <text x="12" y="16" textAnchor="middle" fontSize="11" fontWeight="800" fill="#5d4037">¢</text>
            </svg>
          </span>
          <span className="kitchen-coins-label">{duoMode ? 'Coins' : 'Coins'}</span>
          <span className="kitchen-coins-value">{coins.toLocaleString()}</span>
        </div>
      )}

      {duoMode && (
        <div className="duo-vote-strip">
          <div className={'duo-vote-chip' + (myPick ? ' has-pick' : '') + (myReady ? ' is-ready' : '')}>
            <span className="duo-vote-who">You{myReady ? ' · ready' : ''}</span>
            <span className="duo-vote-map">
              {myPick ? (MAPS[myPick]?.name ?? myPick) : 'No map yet'}
            </span>
          </div>
          <div className={'duo-vote-chip peer' + (partnerPick ? ' has-pick' : '') + (partnerReady ? ' is-ready' : '')}>
            <span className="duo-vote-who">
              {partnerName || 'Partner'}{partnerReady ? ' · ready' : ''}
            </span>
            <span className="duo-vote-map">
              {partnerPick ? (MAPS[partnerPick]?.name ?? partnerPick) : 'Choosing…'}
            </span>
          </div>
          <button
            type="button"
            className={
              'duo-ready-btn'
              + (myReady ? ' on' : '')
              + (matched && myReady && partnerReady ? ' both' : '')
            }
            disabled={starting || !matched}
            onClick={() => onReady?.()}
            title={
              !matched
                ? 'Both must pick the same map first'
                : myReady
                  ? 'Tap to unready'
                  : 'Press Ready — partner must press too'
            }
          >
            <span className="duo-ready-btn-kicker">
              {partnerReady && matched ? 'Partner ready' : matched ? 'Same map' : 'Lobby'}
            </span>
            <span className="duo-ready-btn-label">{readyLabel}</span>
          </button>
        </div>
      )}

      <div className="map-lobby-grid">
        {ENVIRONMENTS.map(env => (
          <div
            key={env.id}
            className={'map-env map-env-' + env.id}
            style={{ '--env-accent': env.accent }}
          >
            <div className="map-env-top">
              <div>
                <h3>{env.title}</h3>
                <p>{env.blurb}</p>
              </div>
              <span className={'map-diff map-diff-' + env.difficulty.toLowerCase()}>
                {env.difficulty}
              </span>
            </div>

            <div className="map-slots">
              {env.slots.map((slotId, i) => {
                if (!slotId) {
                  return (
                    <div key={env.id + '-locked-' + i} className="map-slot locked" title="Coming soon">
                      <span className="map-slot-num">{i + 1}</span>
                      <span className="map-slot-label">Locked</span>
                    </div>
                  );
                }
                const map = MAPS[slotId];
                const mine = myPick === slotId;
                const theirs = partnerPick === slotId;
                const both = mine && theirs;
                const best = bestFor(slotId);
                const classes = [
                  'map-slot',
                  'playable',
                  mine ? 'picked-mine' : '',
                  theirs ? 'picked-peer' : '',
                  both ? 'picked-both' : ''
                ]
                  .filter(Boolean)
                  .join(' ');

                return (
                  <button
                    key={slotId}
                    type="button"
                    className={classes}
                    disabled={starting}
                    onClick={() => (duoMode ? onPick?.(slotId) : onPlay?.(slotId))}
                  >
                    <span className="map-slot-num">{map.slot}</span>
                    <span className="map-slot-name">{map.name}</span>
                    <span className="map-slot-cta">
                      {both
                        ? 'Both ✓'
                        : mine
                          ? 'Your pick'
                          : theirs
                            ? 'Partner ✓'
                            : duoMode
                              ? 'Choose'
                              : 'Play'}
                    </span>
                    <span className="map-slot-stats">
                      <span className="map-slot-best">
                        {best ? `${best.percent}%` : '—'}
                      </span>
                      <MapStars percent={best?.percent ?? 0} />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
