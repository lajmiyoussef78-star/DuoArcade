import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { createSync } from '../lib/sync.js';
import { ENGINES } from '../engines/index.js';
import {
  other, today, loadSeats, saveSeat, applyTheme, finishPatch
} from '../lib/util.js';
import { watchGeo } from '../lib/location.js';
import AuthScreen from '../arcade/AuthScreen.jsx';
import LobbyScreen from '../arcade/LobbyScreen.jsx';
import PublicProfileScreen from '../arcade/PublicProfileScreen.jsx';
import HomeScreen from '../arcade/HomeScreen.jsx';
import GameScreen from '../arcade/GameScreen.jsx';
import WatchScreen from '../arcade/WatchScreen.jsx';
import InviteOverlay from '../arcade/InviteOverlay.jsx';

const VERSION = 'v11.0-react';
const DEFAULT_PRESENCE = {
  A: { online: true, focused: true, place: null, lat: null, lng: null },
  B: { online: true, focused: true, place: null, lat: null, lng: null }
};
const requestedArenaPath = () => {
  const query = new URLSearchParams(window.location.search).get('next');
  const saved = localStorage.getItem('duoarcade-arena-next');
  const next = query || saved;
  return next?.startsWith('/arena') ? next : null;
};

export default function Arcade() {
  const syncRef = useRef(null);
  const initStarted = useRef(false);
  const presenceRef = useRef(null);
  const pendingInvite = useRef(null);
  const suppressInviteUntil = useRef(0);
  const lastLocalWrite = useRef(0);

  const [booted, setBooted] = useState(false);
  const [mode, setMode] = useState(null);
  const [userEmail, setUserEmail] = useState('');
  const [profile, setProfile] = useState(null);
  const [view, setView] = useState('auth'); // auth | lobby | pubProfile (when no duo open)
  const [authNotice, setAuthNotice] = useState('');
  const [myDuos, setMyDuos] = useState([]);
  const [pubProfile, setPubProfile] = useState(null);
  const [lobbyStatus, setLobbyStatus] = useState('');
  const [homeStatus, setHomeStatus] = useState('');
  const [ctx, setCtx] = useState({ duo: null, code: null, myRole: null });
  const [presenceState, setPresenceState] = useState(DEFAULT_PRESENCE);
  const [geoStatus, setGeoStatus] = useState('');
  const [showDiag, setShowDiag] = useState(false);

  const ctxRef = useRef(ctx);
  useEffect(() => { ctxRef.current = ctx; }, [ctx]);

  /* ---------- small helpers ---------- */

  const upd = useCallback((code, patch, opts) => {
    lastLocalWrite.current = Date.now();
    return syncRef.current.updateDuo(code, patch, opts);
  }, []);

  const patchLocal = useCallback(patch => {
    setCtx(s => (s.duo ? { ...s, duo: { ...s.duo, ...patch } } : s));
  }, []);

  const isAway = useCallback(role => {
    const p = presenceState[role];
    return !p?.online;
  }, [presenceState]);

  const whoami = useCallback(() => {
    const u = syncRef.current?.auth.user();
    setUserEmail(u ? u.email : '');
  }, []);

  /* ---------- profile ---------- */

  const loadProfile = useCallback(async () => {
    let p;
    try { p = await syncRef.current.ensureProfile(); } catch { p = { username: null }; }
    setProfile(p);
    return p;
  }, []);

  const saveUsername = useCallback(async name => {
    const r = await syncRef.current.setUsername(name);
    setProfile(r);
  }, []);

  /* ---------- lobby / duo opening ---------- */

  const leaveDuoContext = useCallback(() => {
    setCtx({ duo: null, code: null, myRole: null });
    setHomeStatus('');
  }, []);

  const enterLobby = useCallback(async () => {
    whoami();
    if (!profile) await loadProfile();
    setMyDuos(await syncRef.current.listMyDuos());
    setView('lobby');
  }, [profile, loadProfile, whoami]);

  const openByAccount = useCallback(async c => {
    try {
      const res = await syncRef.current.openDuo(c, loadSeats()[c] ?? null);
      setCtx({ duo: res.duo, code: c, myRole: res.role });
    } catch (e) { setLobbyStatus(e.message); }
  }, []);

  const joinPending = useCallback(async () => {
    const inv = pendingInvite.current;
    pendingInvite.current = null;
    try {
      const res = await syncRef.current.openDuo(inv.code, inv.token);
      saveSeat(inv.code, inv.token);
      setCtx({ duo: res.duo, code: inv.code, myRole: res.role });
    } catch (e) {
      setAuthNotice(e.message);
      setView('auth');
    }
  }, []);

  const createDuo = useCallback(async (nameA, nameB) => {
    if (!nameA || !nameB) { setLobbyStatus('Both names, please.'); return; }
    try {
      const made = await syncRef.current.createDuo({ nameA, nameB });
      saveSeat(made.code, made.hostToken);
      saveSeat('invite-' + made.code, made.guestToken);
      setCtx({ duo: made.duo, code: made.code, myRole: 'A' });
    } catch (e) { setLobbyStatus(e.message); }
  }, []);

  /* ---------- auth ---------- */

  const authSubmit = useCallback(async (authMode, email, pw) => {
    if (!email || pw.length < 6) return 'Email + a password of 6+ characters, please.';
    try {
      if (authMode === 'up') {
        const r = await syncRef.current.auth.signUp(email, pw);
        if (r.needsConfirm) return 'Check your email to confirm your account, then sign in here.';
      } else {
        await syncRef.current.auth.signIn(email, pw);
      }
      await loadProfile();
      const arenaPath = requestedArenaPath();
      if (arenaPath) {
        localStorage.removeItem('duoarcade-arena-next');
        window.location.assign(arenaPath);
      } else if (pendingInvite.current) await joinPending();
      else await enterLobby();
      return '';
    } catch (e) { return e.message; }
  }, [loadProfile, joinPending, enterLobby]);

  const signOut = useCallback(async () => {
    leaveDuoContext();
    await syncRef.current.auth.signOut();
    whoami();
    setView('auth');
  }, [leaveDuoContext, whoami]);

  /* ---------- game session actions ---------- */

  const startGame = useCallback(async gameId => {
    const { code, myRole } = ctxRef.current;
    const eng = ENGINES[gameId];
    const session = {
      game: gameId, gs: eng.meta.realtime ? {} : eng.initialState(),
      turn: eng.meta.realtime ? '-' : 'A', starter: 'A', winner: null,
      phase: 'invite', by: myRole, startedAt: Date.now()
    };
    const patch = { session, turn: 'A' };
    patchLocal(patch);
    try {
      const ok = await upd(code, patch, { force: true });
      if (!ok) throw new Error('server refused the update');
    } catch (e) {
      patchLocal({ session: null });
      setHomeStatus('Couldn’t send the invitation: ' + e.message);
    }
  }, [patchLocal, upd]);

  const rematch = useCallback(async () => {
    const { duo, code, myRole } = ctxRef.current;
    const s = duo.session;
    const eng = ENGINES[s.game];
    const starter = s.winner && s.winner !== 'draw' ? other(s.winner) : other(s.starter);
    const session = {
      game: s.game, gs: eng.meta.realtime ? {} : eng.initialState(),
      turn: eng.meta.realtime ? '-' : starter, starter, winner: null,
      phase: 'invite', by: myRole, startedAt: Date.now()
    };
    const patch = { session, turn: eng.meta.realtime ? '-' : starter };
    patchLocal(patch);
    await upd(code, patch, { force: true });
  }, [patchLocal, upd]);

  const backToHome = useCallback(async () => {
    const { code } = ctxRef.current;
    const patch = { session: null, turn: '-' };
    patchLocal(patch);
    await upd(code, patch, { force: true });
  }, [patchLocal, upd]);

  const move = useCallback(async m => {
    const { duo, code, myRole } = ctxRef.current;
    const s = duo.session;
    if (!s || s.winner || s.turn !== myRole) return;
    if (s.phase && s.phase !== 'live') return;
    if (s.liveAt && Date.now() < s.liveAt) return;
    const eng = ENGINES[s.game];
    const res = eng.applyMove(s.gs, m, myRole);
    if (!res) return;
    const w = eng.winner(res.gs);
    const session = { ...s, gs: res.gs, winner: w, turn: w ? s.turn : (res.again ? myRole : other(myRole)) };
    const patch = { session, turn: w ? '-' : session.turn };
    if (w) {
      const records = structuredClone(duo.records || {});
      const rec = records[s.game] ?? (records[s.game] = { a: 0, b: 0, d: 0 });
      if (w === 'draw') rec.d++; else if (w === 'A') rec.a++; else rec.b++;
      patch.records = records;
      finishPatch(duo, patch);
    }
    const prev = duo;
    patchLocal(patch);
    const ok = await upd(code, patch, { guardTurn: myRole });
    if (!ok) setCtx(st => ({ ...st, duo: prev }));
  }, [patchLocal, upd]);

  const pressReady = useCallback(async () => {
    const { duo, code, myRole } = ctxRef.current;
    const s = duo.session;
    if (!s || s.phase !== 'lobby' || s.ready?.[myRole]) return;
    const ready = { ...s.ready, [myRole]: true };
    const both = ready.A && ready.B;
    const session = both
      ? { ...s, ready, phase: 'live', liveAt: Date.now() + 3500 }
      : { ...s, ready };
    patchLocal({ session });
    await upd(code, { session }, { force: true });
  }, [patchLocal, upd]);

  const realtimeFinish = useCallback(async (gameId, w) => {
    const { duo, code } = ctxRef.current;
    const s = duo.session;
    if (!s || s.game !== gameId || s.winner) return;
    const session = { ...s, winner: w };
    const patch = { session, turn: '-' };
    const records = structuredClone(duo.records || {});
    const rec = records[gameId] ?? (records[gameId] = { a: 0, b: 0, d: 0 });
    if (w === 'draw') rec.d++;
    else if (w === 'A') rec.a++; else rec.b++;
    patch.records = records;
    finishPatch(duo, patch);
    patchLocal(patch);
    await upd(code, patch, { force: true });
  }, [patchLocal, upd]);

  const forceClearSession = useCallback(async (targetCode, onStatus) => {
    try {
      const ok = await upd(targetCode, { session: null, turn: '-' }, { force: true });
      if (!ok) throw new Error('server refused (are you a member of this duo?)');
      if (targetCode === ctxRef.current.code) patchLocal({ session: null });
      onStatus?.('Session cleared for both of you.');
    } catch (e) { onStatus?.('Clear failed: ' + e.message); }
  }, [patchLocal, upd]);

  /* ---------- invitations (receiving side) ---------- */

  const acceptInvite = useCallback(async onError => {
    const { duo, code } = ctxRef.current;
    const s = duo.session;
    if (!s || s.phase !== 'invite') return;
    try {
      const session = { ...s, phase: 'live', liveAt: Date.now() + 3500 };
      patchLocal({ session });
      const ok = await upd(code, { session }, { force: true });
      if (!ok) throw new Error('server refused the update');
    } catch (e) { onError('Accept failed: ' + e.message); }
  }, [patchLocal, upd]);

  const declineInvite = useCallback(async onError => {
    const { duo, code, myRole } = ctxRef.current;
    const s = duo.session;
    if (!s || s.phase !== 'invite') return;
    try {
      const session = { ...s, phase: 'declined', declinedBy: myRole };
      patchLocal({ session });
      const ok = await upd(code, { session }, { force: true });
      if (!ok) throw new Error('server refused the update');
    } catch (e) { onError('Decline failed: ' + e.message); }
  }, [patchLocal, upd]);

  const dismissInvite = useCallback(() => {
    suppressInviteUntil.current = Date.now() + 60000;
    setCtx(s => ({ ...s })); // re-render to hide the overlay
  }, []);

  // Stale-invite expiry: the invite popup self-destructs after 2 minutes.
  useEffect(() => {
    const { duo, code, myRole } = ctx;
    const s = duo?.session;
    if (!s || !s.game || s.phase !== 'invite' || s.by === myRole || s.winner) return;
    if (!s.startedAt || Date.now() - s.startedAt > 120000) {
      patchLocal({ session: null });
      upd(code, { session: null, turn: '-' }, { force: true }).catch(() => {});
    }
  }, [ctx, patchLocal, upd]);

  /* ---------- watch party ---------- */

  const pushWatch = useCallback(async fields => {
    const { duo, code } = ctxRef.current;
    const session = { ...duo.session, ...fields };
    patchLocal({ session });
    await upd(code, { session }, { force: true });
  }, [patchLocal, upd]);

  const startWatch = useCallback(async videoId => {
    const { code, myRole } = ctxRef.current;
    const session = {
      type: 'watch', videoId, phase: 'playing',
      playing: false, position: 0, at: Date.now(), by: myRole,
      ratings: { A: null, B: null }
    };
    patchLocal({ session, turn: '-' });
    await upd(code, { session, turn: '-' }, { force: true });
  }, [patchLocal, upd]);

  const submitRating = useCallback(async n => {
    const { duo, code, myRole } = ctxRef.current;
    const s = duo.session;
    const ratings = { ...s.ratings, [myRole]: n };
    const patch = { session: { ...s, ratings } };
    const theirs = ratings[other(myRole)];
    if (theirs !== null && theirs !== undefined) {
      // Both rated: score the taste match (within one star counts as agreement).
      patch.tasteTotal = (duo.tasteTotal || 0) + 1;
      patch.tasteAgree = (duo.tasteAgree || 0) + (Math.abs(n - theirs) <= 1 ? 1 : 0);
      finishPatch(duo, patch); // a movie night counts as an evening too
    }
    patchLocal(patch);
    await upd(code, patch, { force: true });
  }, [patchLocal, upd]);

  /* ---------- duo pass ---------- */

  const setTheme = useCallback(async name => {
    const { code } = ctxRef.current;
    patchLocal({ theme: name });
    await upd(code, { theme: name }, { force: true });
  }, [patchLocal, upd]);

  const redeemCode = useCallback(async codeStr => {
    const { code } = ctxRef.current;
    const r = await syncRef.current.redeemPassCode(codeStr, code);
    patchLocal({ passTier: r.tier });
  }, [patchLocal]);

  /* ---------- search / public profiles ---------- */

  const searchUsers = useCallback(q => syncRef.current.searchUsers(q), []);

  const openPublicProfile = useCallback(async username => {
    try {
      const p = await syncRef.current.getPublicProfile(username);
      setPubProfile(p);
      setView('pubProfile');
    } catch (e) { setLobbyStatus(e.message); }
  }, []);

  /* ---------- lobby item actions ---------- */

  const toggleVisibility = useCallback(async d => {
    const to = !d.showPublic;
    await upd(d.code, { showPublic: to }, { force: true });
    setMyDuos(list => list.map(x => x.code === d.code ? { ...x, showPublic: to } : x));
  }, [upd]);

  const clearStuck = useCallback(async d => {
    try {
      const ok = await upd(d.code, { session: null, turn: '-' }, { force: true });
      setLobbyStatus(ok ? `Cleared ${d.nameA} & ${d.nameB}.` : 'Clear failed — server refused.');
    } catch (e) { setLobbyStatus('Clear failed: ' + e.message); }
  }, [upd]);

  /* ---------- presence + geolocation (keyed on the open duo) ---------- */

  useEffect(() => {
    const { code, myRole } = ctx;
    if (!code || !myRole || !syncRef.current?.presence) return;

    const presence = syncRef.current.presence(code, myRole);
    presenceRef.current = presence;
    const lastGeoRef = { current: null };

    const pushGeo = geo => {
      lastGeoRef.current = geo;
      presence.setGeo(geo);
      setPresenceState(prev => ({
        ...prev,
        [myRole]: {
          ...prev[myRole],
          online: true,
          focused: prev[myRole]?.focused !== false,
          ...geo
        }
      }));
    };

    presence.onChange(states => setPresenceState(states));

    const report = () => presence.setFocused(!document.hidden);
    report();
    document.addEventListener('visibilitychange', report);
    window.addEventListener('focus', report);
    window.addEventListener('blur', report);

    const heartbeat = setInterval(() => {
      report();
      if (lastGeoRef.current) presence.setGeo(lastGeoRef.current);
    }, 15000);

    const stopGeo = watchGeo(({ lat, lng, place, error }) => {
      if (error) {
        setGeoStatus(error);
        return;
      }
      setGeoStatus('');
      pushGeo({ lat, lng, place });
    });

    return () => {
      clearInterval(heartbeat);
      stopGeo();
      document.removeEventListener('visibilitychange', report);
      window.removeEventListener('focus', report);
      window.removeEventListener('blur', report);
      try { presence.close(); } catch { /* already closed */ }
      presenceRef.current = null;
      setPresenceState(DEFAULT_PRESENCE);
    };
  }, [ctx.code, ctx.myRole]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- theme follows the open duo ---------- */

  useEffect(() => {
    const duo = ctx.duo;
    if (!duo) { applyTheme('night'); return; }
    const hasPass = duo.passTier && duo.passTier !== 'free';
    applyTheme(hasPass ? duo.theme : 'night');
  }, [ctx.duo?.theme, ctx.duo?.passTier]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- boot ---------- */

  useEffect(() => {
    if (initStarted.current) return;
    initStarted.current = true;
    let inviteTimer, reconcileTimer;

    (async () => {
      console.log('DuoArcade ' + VERSION);
      const sync = await createSync();
      syncRef.current = sync;
      setMode(sync.mode);
      whoami();

      sync.onDuo(remote => {
        setCtx(s => (s.code ? { ...s, duo: remote } : s));
      });

      // Global invite watcher: even on the dashboard, incoming fresh invites
      // pull you into that duo so the popup can appear.
      inviteTimer = setInterval(async () => {
        if (ctxRef.current.code || document.hidden) return;
        const uid = sync.auth.user()?.id;
        if (!uid || !sync.listMyDuos) return;
        try {
          const duos = await sync.listMyDuos();
          const candidates = new Map();
          for (const d of duos) {
            const myRoleThere = d.memberA === uid ? 'A' : d.memberB === uid ? 'B' : null;
            candidates.set(d.code, { session: d.session, roleHint: myRoleThere });
          }
          // also watch duos we hold a seat token for (link-joined, no account link)
          const seats = loadSeats();
          for (const [c] of Object.entries(seats)) {
            if (c.startsWith('invite-') || candidates.has(c)) continue;
            const d = await sync.fetchDuo(c).catch(() => null);
            if (d) candidates.set(c, { session: d.session, roleHint: null });
          }
          for (const [c, { session: s, roleHint }] of candidates) {
            if (!s || s.phase !== 'invite' || !s.game) continue;
            if (!s.startedAt || Date.now() - s.startedAt > 120000) continue;
            if (roleHint && s.by === roleHint) continue; // it's my own invite
            if (Date.now() < suppressInviteUntil.current) continue;
            await openByAccount(c);
            break;
          }
        } catch (e) { setLobbyStatus('invite check: ' + e.message); }
      }, 5000);

      // Polling safety net: realtime websockets can silently drop.
      // Every 4s, fetch the row and reconcile.
      reconcileTimer = setInterval(async () => {
        const { code, duo } = ctxRef.current;
        if (!code || !duo || !sync.fetchDuo) return;
        if (document.hidden) return;
        if (Date.now() - lastLocalWrite.current < 2000) return;
        try {
          const fresh = await sync.fetchDuo(code);
          if (fresh && JSON.stringify(fresh) !== JSON.stringify(ctxRef.current.duo)) {
            setCtx(s => ({ ...s, duo: fresh }));
          }
        } catch { /* transient */ }
      }, 4000);

      const params = new URLSearchParams(window.location.search);
      const duoCode = params.get('duo');
      const tokenParam = params.get('t');
      pendingInvite.current = (duoCode && tokenParam)
        ? { code: duoCode, token: tokenParam } : null;
      const reopenDuo = duoCode && !tokenParam ? duoCode : null;

      if (sync.auth.user()) {
        await loadProfile();
        const arenaPath = requestedArenaPath();
        if (arenaPath) {
          localStorage.removeItem('duoarcade-arena-next');
          window.location.assign(arenaPath);
          return;
        } else if (pendingInvite.current) await joinPending();
        else if (reopenDuo) {
          await openByAccount(reopenDuo);
          window.history.replaceState({}, '', '/app');
        } else await enterLobby();
      } else {
        if (pendingInvite.current) {
          setAuthNotice('You’ve been invited to a duo — sign in or create your account to join.');
        }
        setView('auth');
      }
      setBooted(true);
    })();

    return () => { clearInterval(inviteTimer); clearInterval(reconcileTimer); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- screen routing (the old renderAll) ---------- */

  const { duo, code, myRole } = ctx;
  const s = duo?.session;
  let screen;
  if (!booted) {
    screen = <div className="status">Warming up the arcade…</div>;
  } else if (duo && code) {
    if (s && s.type === 'watch') {
      screen = (
        <WatchScreen
          duo={duo} myRole={myRole}
          pushWatch={pushWatch} submitRating={submitRating} onBack={backToHome}
        />
      );
    } else if (s && s.game &&
      !(s.phase === 'invite' && s.by !== myRole) &&
      !(s.phase === 'declined' && s.declinedBy === myRole)) {
      screen = (
        <GameScreen
          duo={duo} code={code} myRole={myRole} isAway={isAway}
          sync={syncRef.current} onMove={move} onReady={pressReady}
          onRematch={rematch} onBack={backToHome}
          onFixStuck={forceClearSession} onRealtimeFinish={realtimeFinish}
        />
      );
    } else {
      screen = (
        <HomeScreen
          duo={duo} code={code} myRole={myRole} isAway={isAway}
          presence={presenceState} geoStatus={geoStatus}
          homeStatus={homeStatus} setHomeStatus={setHomeStatus}
          onStartGame={startGame} onStartWatch={startWatch}
          onBack={() => { leaveDuoContext(); enterLobby(); }}
          onSetTheme={setTheme} onRedeem={redeemCode}
        />
      );
    }
  } else if (view === 'lobby') {
    screen = (
      <LobbyScreen
        profile={profile} myDuos={myDuos} lobbyStatus={lobbyStatus}
        onSaveUsername={saveUsername} onOpenDuo={openByAccount}
        onCreateDuo={createDuo} onSignOut={signOut}
        onToggleVisibility={toggleVisibility} onClearStuck={clearStuck}
        onSearch={searchUsers} onOpenProfile={openPublicProfile}
      />
    );
  } else if (view === 'pubProfile') {
    screen = <PublicProfileScreen profile={pubProfile} onBack={() => setView('lobby')} />;
  } else {
    screen = <AuthScreen notice={authNotice} mode={mode} onSubmit={authSubmit} defaultTab={pendingInvite.current ? 'up' : 'in'} />;
  }

  return (
    <div className="arcade-page">
      <div className="topbar">
        <Link className="brand h1" to="/"><span className="a">Duo</span><span className="b">Arcade</span></Link>
        <div className="who">
          <span>{userEmail}</span>{' '}
          <span style={{ opacity: .55, cursor: 'pointer' }} title="tap for diagnostics"
            onClick={() => setShowDiag(v => !v)}>· {VERSION}</span>
        </div>
      </div>
      <div className="sub">play · watch · remember</div>

      {screen}

      <InviteOverlay
        duo={duo} myRole={myRole}
        suppressedUntil={suppressInviteUntil.current}
        onAccept={acceptInvite} onDecline={declineInvite}
        onDismiss={dismissInvite}
        onForceClear={onStatus => forceClearSession(code, onStatus)}
      />

      {showDiag && (
        <pre style={{
          position: 'fixed', bottom: 10, left: 10, right: 10, maxHeight: '45vh',
          overflow: 'auto', background: 'var(--room)', border: '1px solid var(--candle)',
          borderRadius: 12, padding: 12, fontSize: 11, zIndex: 99, whiteSpace: 'pre-wrap'
        }}>
          {JSON.stringify({
            version: VERSION,
            uid: syncRef.current?.auth.user()?.id || null,
            email: syncRef.current?.auth.user()?.email || null,
            openDuo: code, myRole,
            memberA: duo?.memberA || null, memberB: duo?.memberB || null,
            sessionPhase: s?.phase || null, sessionGame: s?.game || null,
            sessionBy: s?.by || null,
            sessionAgeSec: s?.startedAt ? Math.round((Date.now() - s.startedAt) / 1000) : null,
            seatCodes: Object.keys(loadSeats()),
            mode
          }, null, 2)}
        </pre>
      )}
    </div>
  );
}
