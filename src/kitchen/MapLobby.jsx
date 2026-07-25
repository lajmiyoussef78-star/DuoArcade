import { ENVIRONMENTS, MAP_LABELS } from './mapMeta.js';

/**
 * Shared kitchen picker — both players must select the same map.
 * myPick / partnerPick drive highlight colors so each sees the other's choice.
 */
export function MapLobby({
  myPick,
  partnerPick,
  partnerName,
  myName,
  onPick,
  matched,
  starting
}) {
  return (
    <div className="map-lobby">
      <header className="map-lobby-head">
        <p className="rsc-kitchen-kicker">Pick a kitchen together</p>
        <h2>Environments</h2>
        <p className="map-lobby-lead">
          Tap a map to vote. When you both pick the <strong>same</strong> kitchen, the shift starts.
        </p>
        <div className="map-lobby-sync">
          <span className={'map-sync-pill mine' + (myPick ? ' on' : '')}>
            You{myPick ? `: ${MAP_LABELS[myPick]?.name || myPick}` : ' — pick a map'}
          </span>
          <span className={'map-sync-pill theirs' + (partnerPick ? ' on' : '')}>
            {partnerName || 'Partner'}
            {partnerPick ? `: ${MAP_LABELS[partnerPick]?.name || partnerPick}` : ' — choosing…'}
          </span>
          {matched && (
            <span className="map-sync-pill match">
              {starting ? 'Starting together…' : 'Matched — get ready!'}
            </span>
          )}
        </div>
        <div className="map-lobby-legend">
          <span><i className="lg mine" /> Your pick</span>
          <span><i className="lg theirs" /> {partnerName || 'Partner'}&apos;s pick</span>
          <span><i className="lg both" /> Same map — play!</span>
        </div>
      </header>

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
                const map = MAP_LABELS[slotId];
                const mine = myPick === slotId;
                const theirs = partnerPick === slotId;
                const both = mine && theirs;
                const cls = [
                  'map-slot',
                  'playable',
                  mine ? 'pick-mine' : '',
                  theirs ? 'pick-theirs' : '',
                  both ? 'pick-both' : ''
                ].filter(Boolean).join(' ');
                return (
                  <button
                    key={slotId}
                    type="button"
                    className={cls}
                    onClick={() => onPick(slotId)}
                    disabled={starting}
                  >
                    <span className="map-slot-num">{map.slot}</span>
                    <span className="map-slot-name">{map.name}</span>
                    <span className="map-slot-cta">
                      {both ? 'Together!' : mine ? 'Your pick' : theirs ? (partnerName || 'Partner') : 'Pick'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {myName ? <p className="map-lobby-foot">Playing as {myName}</p> : null}
    </div>
  );
}
