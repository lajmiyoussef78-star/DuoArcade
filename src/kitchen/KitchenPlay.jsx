import { useEffect, useRef, useState, useCallback } from 'react';
import Phaser from 'phaser';
import { createKitchenGame } from './game/createGame';
import { MapLobby } from './MapLobby.jsx';
import { ChefCustomizePanel } from './ChefCustomizePanel';
import { ThemePicker } from './ThemePicker';
import { useGamePrefs, getGamePrefs } from './gamePrefs';
import { useKitchenProgress } from './kitchenProgressStore';

/** Ready, Set, Cook — original gastronomica play-home shell inside DuoArcade. */
export default function KitchenPlay({ names, myRole, rt, onComplete }) {
  const [mapId, setMapId] = useState(null);
  const [customizing, setCustomizing] = useState(false);
  const [myPick, setMyPick] = useState(null);
  const [partnerPick, setPartnerPick] = useState(null);
  const [myReady, setMyReady] = useState(false);
  const [partnerReady, setPartnerReady] = useState(false);
  const [starting, setStarting] = useState(false);

  const hostRef = useRef(null);
  const gameRef = useRef(null);
  const remotesRef = useRef({});
  const myPickRef = useRef(null);
  const myReadyRef = useRef(false);
  const startTimer = useRef(null);

  const siteTheme = useGamePrefs(s => s.siteTheme);
  const coins = useKitchenProgress(s => s.coins);
  const applyMatch = useKitchenProgress(s => s.applyMatch);

  const partnerRole = myRole === 'A' ? 'B' : 'A';
  const partnerName = names[partnerRole] || 'Partner';
  const matched = !!(myPick && partnerPick && myPick === partnerPick);
  const bothReady = matched && myReady && partnerReady;

  // Apply site theme on the kitchen root only (not whole DuoArcade).
  useEffect(() => {
    const root = document.querySelector('.arcade-page .rsc-kitchen');
    if (root) root.setAttribute('data-theme', siteTheme);
  }, [siteTheme]);

  const broadcastPick = useCallback((pick) => {
    if (!rt) return;
    rt.send({ k: 'rsc-pick', role: myRole, mapId: pick || null });
  }, [rt, myRole]);

  const broadcastReady = useCallback((ready) => {
    if (!rt) return;
    rt.send({ k: 'rsc-ready', role: myRole, ready: !!ready, mapId: myPickRef.current || null });
  }, [rt, myRole]);

  const clearLobby = useCallback(() => {
    setMapId(null);
    setStarting(false);
    setMyPick(null);
    setPartnerPick(null);
    setMyReady(false);
    setPartnerReady(false);
    myPickRef.current = null;
    myReadyRef.current = false;
    broadcastPick(null);
    broadcastReady(false);
    setCustomizing(false);
  }, [broadcastPick, broadcastReady]);

  const pickMap = useCallback((id) => {
    if (starting || mapId) return;
    setMyPick(id);
    myPickRef.current = id;
    // Changing map clears ready for both sides locally; partner clears when they see the new pick.
    setMyReady(false);
    myReadyRef.current = false;
    setPartnerReady(false);
    broadcastPick(id);
    broadcastReady(false);
  }, [starting, mapId, broadcastPick, broadcastReady]);

  const toggleReady = useCallback(() => {
    if (starting || mapId || !matched) return;
    const next = !myReadyRef.current;
    myReadyRef.current = next;
    setMyReady(next);
    broadcastReady(next);
  }, [starting, mapId, matched, broadcastReady]);

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
        setPartnerReady(false);
        // Partner changed map — our ready no longer counts until we press again if maps diverge.
        if (msg.mapId && myPickRef.current && msg.mapId !== myPickRef.current) {
          setMyReady(false);
          myReadyRef.current = false;
        }
        return;
      }

      if (msg.k === 'rsc-ready' && msg.role && msg.role !== myRole) {
        setPartnerReady(!!msg.ready);
        return;
      }

      if (msg.k === 'rsc-hello' && msg.role && msg.role !== myRole) {
        if (myPickRef.current) broadcastPick(myPickRef.current);
        if (myReadyRef.current) broadcastReady(true);
        return;
      }

      if (msg.k === 'rsc-start' && msg.mapId && !mapId) {
        setMyPick(msg.mapId);
        setPartnerPick(msg.mapId);
        myPickRef.current = msg.mapId;
        setMyReady(true);
        setPartnerReady(true);
        myReadyRef.current = true;
        setStarting(true);
        setCustomizing(false);
        setMapId(msg.mapId);
      }
    };
    rt.on(onMsg);
    rt.send({ k: 'rsc-hello', role: myRole });
    if (myPickRef.current) broadcastPick(myPickRef.current);
    if (myReadyRef.current) broadcastReady(true);
    return undefined;
  }, [rt, myRole, broadcastPick, broadcastReady, mapId]);

  // Both same map + both Ready → open the kitchen
  useEffect(() => {
    if (!bothReady || mapId || starting) return undefined;
    setStarting(true);
    setCustomizing(false);
    rt?.send({ k: 'rsc-start', mapId: myPick, role: myRole });
    startTimer.current = setTimeout(() => {
      setMapId(myPick);
    }, 500);
    return () => {
      if (startTimer.current) clearTimeout(startTimer.current);
    };
  }, [bothReady, myPick, mapId, starting, rt, myRole]);

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
    const prefs = getGamePrefs();
    const game = createKitchenGame({
      parent: hostRef.current,
      mapId,
      multiplayer: bridge,
      onMatchComplete: result => {
        if (awarded) return;
        awarded = true;
        applyMatch({
          mapId,
          coinsEarned: result?.coinsEarned || 0,
          xpEarned: result?.xpEarned || 0,
          performancePercent: result?.performancePercent || 0,
          stars: result?.stars || 0
        });
        onComplete?.();
      },
      onReturnToLobby: () => {
        clearLobby();
      },
      audioPrefs: {
        masterVolume: (prefs.masterVolume || 80) / 100,
        sfxVolume: (prefs.sfxVolume || 70) / 100
      },
      chefLook: prefs.chefLook
    });
    gameRef.current = game;

    const isBrowserFullscreen = () => !!(
      document.fullscreenElement || document.webkitFullscreenElement
    );

    const refreshScale = () => {
      try {
        // Windowed: fit in the normal host. Fullscreen: cover the whole display.
        game.scale.scaleMode = isBrowserFullscreen()
          ? Phaser.Scale.ENVELOP
          : Phaser.Scale.FIT;
        game.scale.refresh();
      } catch { /* game gone */ }
    };
    const refreshSoon = () => {
      refreshScale();
      requestAnimationFrame(refreshScale);
      setTimeout(refreshScale, 50);
      setTimeout(refreshScale, 200);
    };
    refreshSoon();
    window.addEventListener('resize', refreshScale);
    document.addEventListener('fullscreenchange', refreshSoon);
    document.addEventListener('webkitfullscreenchange', refreshSoon);

    return () => {
      window.removeEventListener('resize', refreshScale);
      document.removeEventListener('fullscreenchange', refreshSoon);
      document.removeEventListener('webkitfullscreenchange', refreshSoon);
      game.destroy(true);
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapId]);

  const inMatch = !!mapId;

  return (
    <div className="rsc-kitchen" data-theme={siteTheme}>
      <div className="play-home">
        <ThemePicker />

        <div className="play-home-hero">
          <p className="embed-kicker">DuoArcade kitchen</p>
          <h1>Ready, Set, Cook</h1>
          <p className="play-home-lead">
            Chaotic co-op cooking — pick the same kitchen, then both press Ready to start.
          </p>
          <div className="play-home-actions">
            {!inMatch && !customizing ? (
              <a className="rsc-btn" href="#lobby">
                Choose map
              </a>
            ) : (
              <button
                type="button"
                className="rsc-btn ghost"
                onClick={() => {
                  if (inMatch) clearLobby();
                  else setCustomizing(false);
                }}
              >
                Back to lobby
              </button>
            )}
            {!inMatch && (
              <button
                type="button"
                className={'rsc-btn' + (customizing ? '' : ' ghost')}
                onClick={() => setCustomizing(v => !v)}
              >
                {customizing ? 'Hide outfit' : 'Change outfit'}
              </button>
            )}
            <span className="kitchen-coins-pill" title="Kitchen coins">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="12" cy="12" r="9" fill="#f9a825" stroke="#ef6c00" strokeWidth="2" />
                <text x="12" y="16" textAnchor="middle" fontSize="11" fontWeight="800" fill="#5d4037">¢</text>
              </svg>
              {' '}{coins.toLocaleString()}
            </span>
          </div>
          <p className="play-home-meta">
            {names.A} & {names.B} · DuoArcade names · shared kitchen
          </p>
        </div>

        <div id="lobby" className={'play-home-game' + (inMatch ? ' rsc-match-stage' : '')}>
          {inMatch ? (
            <div ref={hostRef} className="rsc-phaser-host play-home-canvas" />
          ) : customizing ? (
            <ChefCustomizePanel onDone={() => setCustomizing(false)} />
          ) : (
            <MapLobby
              myPick={myPick}
              partnerPick={partnerPick}
              partnerName={partnerName}
              myRole={myRole}
              onPick={pickMap}
              matched={matched}
              myReady={myReady}
              partnerReady={partnerReady}
              onReady={toggleReady}
              starting={starting}
            />
          )}
        </div>
      </div>
    </div>
  );
}
