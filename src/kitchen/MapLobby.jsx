import { ENVIRONMENTS, MAPS } from './game/maps/catalog';

export function MapLobby({ onPlay, compact = false }) {
  return (
    <div className={'map-lobby' + (compact ? ' compact' : '')}>
      {!compact && (
        <header className="map-lobby-head">
          <p className="rsc-kitchen-kicker">Pick a kitchen</p>
          <h2>Environments</h2>
          <p className="map-lobby-lead">
            Four worlds · five maps each · start with Map 1, more unlock later.
          </p>
        </header>
      )}

      <div className="map-lobby-grid">
        {ENVIRONMENTS.map(env => (
          <section
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
                return (
                  <button
                    key={slotId}
                    type="button"
                    className="map-slot playable"
                    onClick={() => onPlay(slotId)}
                  >
                    <span className="map-slot-num">{map.slot}</span>
                    <span className="map-slot-name">{map.name}</span>
                    <span className="map-slot-cta">Play</span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
