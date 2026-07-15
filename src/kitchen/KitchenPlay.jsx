import { useEffect, useRef, useState } from 'react';
import { createKitchenGame } from './game/createGame';
import { MapLobby } from './MapLobby.jsx';

/** Native Ready, Set, Cook — Phaser kitchen mounted inside DuoArcade. */
export default function KitchenPlay({ names, myRole, rt, onComplete }) {
  const [mapId, setMapId] = useState(null);
  const hostRef = useRef(null);
  const gameRef = useRef(null);
  const remotesRef = useRef({});

  useEffect(() => {
    if (!rt) return;
    const onMsg = msg => {
      if (msg.k === 'chef' && msg.role && msg.role !== myRole && msg.state) {
        remotesRef.current[msg.role] = msg.state;
      }
    };
    rt.on(onMsg);
  }, [rt, myRole]);

  useEffect(() => {
    if (!mapId || !hostRef.current) return;

    const peers = [
      { id: 'A', displayName: names.A || 'Chef A', avatarHue: 210, ready: true, slot: 0, isHost: true },
      { id: 'B', displayName: names.B || 'Chef B', avatarHue: 340, ready: true, slot: 1, isHost: false }
    ];

    const bridge = rt ? {
      localId: myRole,
      peers,
      sendState: state => rt.send({ k: 'chef', role: myRole, state }),
      getRemotes: () => {
        const out = {};
        for (const [role, st] of Object.entries(remotesRef.current)) {
          out[role] = { id: role, ...st };
        }
        return out;
      }
    } : undefined;

    const game = createKitchenGame({
      parent: hostRef.current,
      mapId,
      multiplayer: bridge,
      onMatchComplete: () => onComplete?.(),
      onReturnToLobby: () => setMapId(null),
      audioPrefs: { masterVolume: 0.85, sfxVolume: 0.9 },
      chefLook: myRole === 'A'
        ? { hatStyle: 'toque', hatColor: 0x5c7fd4, shirtColor: 0xffffff, apronColor: 0xff8a65, skinColor: 0xffcc80, shoeColor: 0x212121 }
        : { hatStyle: 'floppy', hatColor: 0xd45c8a, shirtColor: 0xffffff, apronColor: 0xff7fa8, skinColor: 0xffcc80, shoeColor: 0x212121 }
    });
    gameRef.current = game;

    return () => {
      game.destroy(true);
      gameRef.current = null;
    };
  }, [mapId, myRole, names, rt, onComplete]);

  return (
    <div className="rsc-kitchen">
      <div className={'rsc-kitchen-bar' + (mapId ? ' compact' : '')}>
        {!mapId ? (
          <>
            <p className="rsc-kitchen-kicker">Ready, Set, Cook</p>
            <h2 className="rsc-kitchen-title">{names.A} & {names.B}</h2>
            <p className="rsc-kitchen-hint">
              Pick the same kitchen as your partner · WASD move · E interact · Q drop · Space throw
            </p>
          </>
        ) : (
          <button type="button" className="btn small ghost" onClick={() => setMapId(null)}>
            ← Back to kitchens
          </button>
        )}
      </div>

      {!mapId ? (
        <MapLobby onPlay={setMapId} />
      ) : (
        <div ref={hostRef} className="rsc-phaser-host" />
      )}
    </div>
  );
}
