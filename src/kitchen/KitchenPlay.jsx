import { useEffect, useRef, useState, useCallback } from 'react';
import { createKitchenGame } from './game/createGame';
import { MapLobby } from './MapLobby.jsx';
import { KitchenDress } from './KitchenDress.jsx';
import {
  addRewards,
  loadKitchenProgress,
  saveKitchenProgress
} from './kitchenProgress.js';

/** Native Ready, Set, Cook — shared map pick, cosmetics hub, co-op Phaser kitchen. */
export default function KitchenPlay({ names, myRole, rt, onComplete }) {
  const [hubTab, setHubTab] = useState('maps'); // maps | character | store
  const [progress, setProgress] = useState(() => loadKitchenProgress());
  const [myPick, setMyPick] = useState(null);
  const [partnerPick, setPartnerPick] = useState(null);
  const [mapId, setMapId] = useState(null);
  const [starting, setStarting] = useState(false);
  const [lastEarn, setLastEarn] = useState({ coins: 0, xp: 0 });

  const hostRef = useRef(null);
  const gameRef = useRef(null);
  const remotesRef = useRef({});
  const myPickRef = useRef(null);
  const startTimer = useRef(null);

  const partnerRole = myRole === 'A' ? 'B' : 'A';
  const partnerName = names[partnerRole] || 'Partner';
  const myName = names[myRole] || 'You';
  const matched = !!(myPick && partnerPick && myPick === partnerPick);

  const persist = useCallback(next => {
    const saved = saveKitchenProgress(next);
    setProgress(saved);
    return saved;
  }, []);

  const broadcastPick = useCallback((pick) => {
    if (!rt) return;
    rt.send({ k: 'rsc-pick', role: myRole, mapId: pick || null });
  }, [rt, myRole]);

  const pickMap = useCallback((id) => {
    if (starting || mapId) return;
    setMyPick(id);
    myPickRef.current = id;
    broadcastPick(id);
  }, [starting, mapId, broadcastPick]);

  // RT: partner map picks + hello handshake
  useEffect(() => {
    if (!rt) return undefined;
    const onMsg = msg => {
      if (!msg || typeof msg !== 'object') return;

      if (msg.k === 'chef' && msg.role && msg.role !== myRole && msg.state) {
        remotesRef.current[msg.role] = msg.state;
        return;
      }

      if (msg.k === 'rsc-pick' && msg.role && msg.role !== myRole) {
        setPartnerPick(msg.mapId || null);
        return;
      }

      if (msg.k === 'rsc-hello' && msg.role && msg.role !== myRole) {
        // Partner joined lobby — resend our vote so they see the highlight.
        if (myPickRef.current) broadcastPick(myPickRef.current);
        return;
      }

      if (msg.k === 'rsc-start' && msg.mapId && !mapId) {
        // Partner already matched — join the same kitchen.
        setMyPick(msg.mapId);
        setPartnerPick(msg.mapId);
        myPickRef.current = msg.mapId;
        setStarting(true);
        setMapId(msg.mapId);
      }
    };
    rt.on(onMsg);
    rt.send({ k: 'rsc-hello', role: myRole });
    if (myPickRef.current) broadcastPick(myPickRef.current);
    return undefined;
  }, [rt, myRole, broadcastPick, mapId]);

  // When both pick the same map → start together
  useEffect(() => {
    if (!matched || mapId || starting) return undefined;
    setStarting(true);
    rt?.send({ k: 'rsc-start', mapId: myPick, role: myRole });
    startTimer.current = setTimeout(() => {
      setMapId(myPick);
    }, 700);
    return () => {
      if (startTimer.current) clearTimeout(startTimer.current);
    };
  }, [matched, myPick, mapId, starting, rt, myRole]);

  // Phaser match
  useEffect(() => {
    if (!mapId || !hostRef.current) return undefined;

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

    let awarded = false;
    const game = createKitchenGame({
      parent: hostRef.current,
      mapId,
      multiplayer: bridge,
      onMatchComplete: result => {
        if (awarded) return;
        awarded = true;
        const coins = result?.coinsEarned || 0;
        const xp = result?.xpEarned || 0;
        if (coins > 0 || xp > 0) {
          setProgress(p => {
            const next = addRewards(p, { coins, xp });
            setLastEarn({ coins, xp });
            return next;
          });
        }
        onComplete?.();
      },
      onReturnToLobby: () => {
        setMapId(null);
        setStarting(false);
        setMyPick(null);
        setPartnerPick(null);
        myPickRef.current = null;
        broadcastPick(null);
        setHubTab('maps');
      },
      audioPrefs: { masterVolume: 0.85, sfxVolume: 0.9 },
      chefLook: progress.look
    });
    gameRef.current = game;

    return () => {
      game.destroy(true);
      gameRef.current = null;
    };
    // Intentionally only remount when mapId changes — not on every look tweak mid-match.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapId]);

  const inMatch = !!mapId;

  return (
    <div className="rsc-kitchen">
      <div className={'rsc-kitchen-bar' + (inMatch ? ' compact' : '')}>
        {!inMatch ? (
          <>
            <div className="rsc-bar-top">
              <div>
                <p className="rsc-kitchen-kicker">Ready, Set, Cook</p>
                <h2 className="rsc-kitchen-title">{names.A} & {names.B}</h2>
              </div>
              <div className="rsc-stat-badges">
                <div className="rsc-coin-badge" title="Kitchen coins">
                  <span className="rsc-coin-icon" aria-hidden>◉</span>
                  <span className="rsc-coin-count">{progress.coins}</span>
                  <span className="rsc-coin-label">coins</span>
                </div>
                <div className="rsc-coin-badge rsc-xp-badge" title="Kitchen XP">
                  <span className="rsc-coin-icon" aria-hidden>★</span>
                  <span className="rsc-coin-count">{progress.xp || 0}</span>
                  <span className="rsc-coin-label">xp</span>
                </div>
              </div>
            </div>
            <p className="rsc-kitchen-hint">
              Vote the same kitchen · Character themes &amp; outfits · Store · WASD · E · Q · Space
            </p>
            {(lastEarn.coins > 0 || lastEarn.xp > 0) && (
              <p className="rsc-earn-toast">
                +{lastEarn.coins} coins{lastEarn.xp ? ` · +${lastEarn.xp} XP` : ''} from your last shift!
              </p>
            )}
            <div className="rsc-hub-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                className={'rsc-hub-tab' + (hubTab === 'maps' ? ' on' : '')}
                onClick={() => setHubTab('maps')}
              >
                Kitchens
              </button>
              <button
                type="button"
                role="tab"
                className={'rsc-hub-tab' + (hubTab === 'character' ? ' on' : '')}
                onClick={() => setHubTab('character')}
              >
                Character
              </button>
              <button
                type="button"
                role="tab"
                className={'rsc-hub-tab' + (hubTab === 'store' ? ' on' : '')}
                onClick={() => setHubTab('store')}
              >
                Store
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            className="btn small ghost"
            onClick={() => {
              setMapId(null);
              setStarting(false);
              setMyPick(null);
              setPartnerPick(null);
              myPickRef.current = null;
              broadcastPick(null);
            }}
          >
            ← Back to kitchens
          </button>
        )}
      </div>

      {!inMatch ? (
        hubTab === 'maps' ? (
          <MapLobby
            myPick={myPick}
            partnerPick={partnerPick}
            partnerName={partnerName}
            myName={myName}
            onPick={pickMap}
            matched={matched}
            starting={starting}
          />
        ) : (
          <KitchenDress
            progress={progress}
            onProgress={persist}
            tab={hubTab === 'store' ? 'store' : 'character'}
          />
        )
      ) : (
        <div ref={hostRef} className="rsc-phaser-host" />
      )}
    </div>
  );
}
