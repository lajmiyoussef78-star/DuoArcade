import { useEffect, useRef, useState, useCallback } from 'react';
import { Link, useNavigate, useLocation, Routes, Route } from 'react-router-dom';
import { createSync } from '../lib/sync.js';
import { ENGINES } from '../engines/index.js';
import {
  other, today, loadSeats, saveSeat, removeSeat, applyTheme, finishPatch
} from '../lib/util.js';
import { watchGeo } from '../lib/location.js';
import { chatConfigured, sendGameEvent } from '../lib/chat.js';
import { awardXp } from '../lib/xp.js';
import { pushRecentGame } from '../lib/gameCatalog.js';
import {
  challengeNextSlot, gameForChallengeSlot, setChallengeResult,
} from '../lib/challenges.js';
import AuthScreen from '../arcade/AuthScreen.jsx';
import LobbyScreen from '../arcade/LobbyScreen.jsx';
import PublicProfileScreen from '../arcade/PublicProfileScreen.jsx';
import HomeScreen from '../arcade/HomeScreen.jsx';
import PlaceScreen from '../arcade/PlaceScreen.jsx';
import DuoHomeLayout from '../arcade/DuoHomeLayout.jsx';
import GameScreen from '../arcade/GameScreen.jsx';
import WatchScreen from '../arcade/WatchScreen.jsx';
import ReelsPartyScreen from '../arcade/ReelsPartyScreen.jsx';
import MovieNightScreen from '../arcade/MovieNightScreen.jsx';
import StreamingWatchScreen from '../arcade/StreamingWatchScreen.jsx';
import WatchInviteToast from '../arcade/WatchInviteToast.jsx';
import InviteOverlay from '../arcade/InviteOverlay.jsx';
import FriendMatchInvite from '../arcade/FriendMatchInvite.jsx';
import FriendsDock from '../arcade/FriendsDock.jsx';
import { ChallengeProvider } from '../arcade/ChallengeContext.jsx';
import SettingsMenu from '../arcade/SettingsMenu.jsx';
import Leaderboard from './Leaderboard.jsx';
import Arena from './Arena.jsx';
import ArenaMatch from './ArenaMatch.jsx';
import DuoProfileView from '../arcade/DuoProfileView.jsx';
import { createFriendsClient } from '../lib/friends.js';
import {
  buildWatchSession, buildReelsSession, buildMovieSession, buildStreamingSession,
  isWatchSession, watchBusyLabel,
} from '../lib/watchSessions.js';
import { friendlyName } from '../lib/watchMovie.js';

const VERSION = 'v11.0-react';
const DEFAULT_PRESENCE = {
  A: { online: true, focused: true, place: null, lat: null, lng: null },
  B: { online: true, focused: true, place: null, lat: null, lng: null }
};
const requestedArenaPath = () => {
  const query = new URLSearchParams(window.location.search).get('next');
  const saved = localStorage.getItem('duoarcade-arena-next');
  let next = query || saved;
  if (!next) return null;
  // Legacy /arena → nested /app/arena (keeps Arcade mounted).
  if (next === '/arena' || next.startsWith('/arena/')) next = '/app' + next;
  return next.startsWith('/app/arena') ? next : null;
};

/** Parse an invite URL or "CODE TOKEN" / "CODE/TOKEN" string. */
export function parseInviteString(raw) {
  const s = (raw || '').trim();
  if (!s) return null;
  try {
    if (/^https?:\/\//i.test(s)) {
      const url = new URL(s);
      const code = url.searchParams.get('duo');
      const token = url.searchParams.get('t');
      if (code && token) return { code: code.toUpperCase(), token };
    }
  } catch { /* ignore */ }
  if (s.includes('duo=') && s.includes('t=')) {
    const q = new URLSearchParams(s.replace(/^[^?]*\?/, '').replace(/#.*$/, ''));
    const code = q.get('duo');
    const token = q.get('t');
    if (code && token) return { code: code.toUpperCase(), token };
  }
  const parts = s.match(/^([A-Za-z0-9]{4,8})\s*[/:]\s*([A-Za-z0-9-]{8,})$/)
    || s.match(/^([A-Za-z0-9]{4,8})\s+([A-Za-z0-9-]{8,})$/);
  if (parts) return { code: parts[1].toUpperCase(), token: parts[2] };
  return null;
}

export default function Arcade() {
  const navigate = useNavigate();
  const location = useLocation();
  const onLeaderboard = /\/leaderboard\/?$/.test(location.pathname);
  const onArena = /^\/app\/arena(\/|$)/.test(location.pathname);
  const syncRef = useRef(null);
  const initStarted = useRef(false);
  const presenceRef = useRef(null);
  const pendingInvite = useRef(null);
  const suppressInviteUntil = useRef(0);
  const lastLocalWrite = useRef(0);
  const challengeBusyRef = useRef(false);

  const [booted, setBooted] = useState(false);
  const [mode, setMode] = useState(null);
  const [userEmail, setUserEmail] = useState('');
  const [profile, setProfile] = useState(null);
  const [view, setView] = useState('auth'); // auth | lobby | pubProfile (when no duo open)
  const [authNotice, setAuthNotice] = useState('');
  const [myDuos, setMyDuos] = useState([]);
  const [pubProfile, setPubProfile] = useState(null);
  const [pubDuo, setPubDuo] = useState(null);
  const [lobbyStatus, setLobbyStatus] = useState('');
  const [homeStatus, setHomeStatus] = useState('');
  const [ctx, setCtx] = useState({ duo: null, code: null, myRole: null });
  const [presenceState, setPresenceState] = useState(DEFAULT_PRESENCE);
  const [geoStatus, setGeoStatus] = useState('');
  const [showDiag, setShowDiag] = useState(false);
  const [avatarTick, setAvatarTick] = useState(0);
  const [watchInviteDismissed, setWatchInviteDismissed] = useState(false);
  /** Only true after tapping Profile — otherwise lobby auto-enters the arcade. */
  const [stayInLobby, setStayInLobby] = useState(false);
  const stayInLobbyRef = useRef(false);
  useEffect(() => { stayInLobbyRef.current = stayInLobby; }, [stayInLobby]);
  const pendingReopenRef = useRef(null);
  const friendsPresenceRef = useRef(null);

  /* The version tap that used to toggle diagnostics lived in the top bar, which
     the dashboard no longer renders. The sidebar user menu fires this instead. */
  useEffect(() => {
    const onToggle = () => setShowDiag(v => !v);
    window.addEventListener('duoarcade-toggle-diag', onToggle);
    return () => window.removeEventListener('duoarcade-toggle-diag', onToggle);
  }, []);

  const ctxRef = useRef(ctx);
  useEffect(() => { ctxRef.current = ctx; }, [ctx]);
  const viewRef = useRef(view);
  useEffect(() => { viewRef.current = view; }, [view]);
  useEffect(() => {
    if (!ctx.code) return;
    try { sessionStorage.setItem('duoarcade-home-duo', ctx.code); } catch { /* */ }
  }, [ctx.code]);

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

  const enterLobby = useCallback(async ({ stay = true } = {}) => {
    whoami();
    if (!profile) await loadProfile();
    setMyDuos(await syncRef.current.listMyDuos());
    setStayInLobby(stay);
    setView('lobby');
  }, [profile, loadProfile, whoami]);

  const openByAccount = useCallback(async c => {
    const sync = syncRef.current;
    if (!sync) return false;
    try {
      // Enter home from list first — same data Duo Profile already shows.
      // open_duo can fail after Arena remount; list_my_duos still proves access.
      let duos = [];
      try { duos = await sync.listMyDuos(); setMyDuos(duos); } catch { /* */ }
      const prefer = c || null;
      const fromList = (prefer && duos.find(d => d.code === prefer)) || duos[0] || null;
      const uid = sync.auth.user()?.id;
      const roleFrom = d => {
        if (!d || !uid) return null;
        if (d.memberA === uid) return 'A';
        if (d.memberB === uid) return 'B';
        return null;
      };

      if (fromList?.code) {
        const warm = {
          duo: fromList,
          code: fromList.code,
          myRole: roleFrom(fromList),
        };
        ctxRef.current = warm;
        setStayInLobby(false);
        setCtx(warm);
        try { sessionStorage.setItem('duoarcade-home-duo', fromList.code); } catch { /* */ }
        navigate('/app', { replace: true });
      }

      const code = fromList?.code || prefer;
      if (!code) {
        setLobbyStatus('No duo to open');
        return false;
      }

      try {
        const res = await sync.openDuo(code, loadSeats()[code] ?? null);
        const next = { duo: res.duo, code, myRole: res.role || roleFrom(res.duo) };
        ctxRef.current = next;
        setStayInLobby(false);
        setCtx(next);
        try { sessionStorage.setItem('duoarcade-home-duo', code); } catch { /* */ }
        navigate('/app', { replace: true });
        return true;
      } catch (e) {
        // Already on home via list warm-start — treat as success if we have a seat.
        if (ctxRef.current.code) return true;
        setLobbyStatus(e.message);
        return false;
      }
    } catch (e) {
      setLobbyStatus(e.message);
      return false;
    }
  }, [navigate]);

  const joinPending = useCallback(async () => {
    const inv = pendingInvite.current;
    pendingInvite.current = null;
    try {
      const res = await syncRef.current.openDuo(inv.code, inv.token);
      saveSeat(inv.code, inv.token);
      const next = { duo: res.duo, code: inv.code, myRole: res.role };
      ctxRef.current = next;
      setStayInLobby(false);
      setCtx(next);
      try { sessionStorage.setItem('duoarcade-home-duo', inv.code); } catch { /* */ }
      navigate('/app', { replace: true });
    } catch (e) {
      setAuthNotice(e.message);
      setLobbyStatus(e.message);
      await enterLobby({ stay: true });
    }
  }, [enterLobby, navigate]);

  /** After sign-in/boot: pending invite → join; else restore last duo / first duo; else lobby. */
  const enterAfterAuth = useCallback(async () => {
    whoami();
    await loadProfile();
    if (pendingInvite.current) {
      await joinPending();
      return;
    }
    const duos = await syncRef.current.listMyDuos();
    let prefer = pendingReopenRef.current;
    pendingReopenRef.current = null;
    if (!prefer) {
      try { prefer = sessionStorage.getItem('duoarcade-home-duo'); } catch { /* */ }
    }
    try {
      const q = new URLSearchParams(window.location.search).get('duo');
      const t = new URLSearchParams(window.location.search).get('t');
      if (q && !t) prefer = q;
    } catch { /* */ }
    const ordered = [];
    if (prefer && duos.some(d => d.code === prefer)) ordered.push(prefer);
    else if (prefer) ordered.push(prefer); // still try URL/session code even if list lags
    for (const d of duos) {
      if (d.code && !ordered.includes(d.code)) ordered.push(d.code);
    }
    // Open duo before setMyDuos so we never flash Duo Profile as the home page.
    let opened = false;
    for (const code of ordered) {
      opened = await openByAccount(code);
      if (opened) break;
    }
    setMyDuos(duos);
    if (!opened) await enterLobby({ stay: duos.length === 0 });
  }, [whoami, loadProfile, joinPending, openByAccount, enterLobby]);

  const joinFromInviteString = useCallback(async raw => {
    const parsed = parseInviteString(raw);
    if (!parsed) {
      setLobbyStatus('Paste the full invite link (or CODE / token) from your partner.');
      return;
    }
    setLobbyStatus('Joining…');
    try {
      const res = await syncRef.current.openDuo(parsed.code, parsed.token);
      saveSeat(parsed.code, parsed.token);
      setCtx({ duo: res.duo, code: parsed.code, myRole: res.role });
      setLobbyStatus('');
      setStayInLobby(false);
      navigate('/app', { replace: true });
    } catch (e) {
      setLobbyStatus(e.message);
    }
  }, [navigate]);

  const createDuo = useCallback(async (nameA, nameB) => {
    if (!nameA || !nameB) { setLobbyStatus('Both names, please.'); return; }
    try {
      const made = await syncRef.current.createDuo({ nameA, nameB });
      saveSeat(made.code, made.hostToken);
      saveSeat('invite-' + made.code, made.guestToken);
      setCtx({ duo: made.duo, code: made.code, myRole: 'A' });
    } catch (e) { setLobbyStatus(e.message); }
  }, []);

  const deleteDuo = useCallback(async d => {
    try {
      await syncRef.current.deleteDuo(d.code);
      removeSeat(d.code);
      if (ctxRef.current.code === d.code) leaveDuoContext();
      setMyDuos(await syncRef.current.listMyDuos());
      setLobbyStatus(`${d.nameA} & ${d.nameB} is gone — streaks and history erased.`);
    } catch (e) { setLobbyStatus('Delete failed: ' + e.message); }
  }, [leaveDuoContext]);

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
      } else {
        await enterAfterAuth();
      }
      return '';
    } catch (e) { return e.message; }
  }, [loadProfile, enterAfterAuth]);

  const signOut = useCallback(async () => {
    leaveDuoContext();
    await syncRef.current.auth.signOut();
    whoami();
    navigate('/', { replace: true });
  }, [leaveDuoContext, whoami, navigate]);

  /* ---------- game session actions ---------- */

  // Post "Ended" + score when leaving the shelf (covers the rematch series).
  const flushSessionRecap = useCallback((s) => {
    if (!s?.game || !chatConfigured()) return;
    const series = s.series || s.streak; // streak = legacy field name
    const a = series?.a || 0, b = series?.b || 0, d = series?.d || 0;
    const rounds = a + b + d;
    if (!rounds) return;
    const { duo, code } = ctxRef.current;
    const uid = syncRef.current?.auth.user()?.id;
    if (!uid || !code) return;
    // Only one side posts — prefer the player who is clearing (caller).
    if (s.chatEndedPosted) return;
    const winner = a === b ? 'draw' : (a > b ? 'A' : 'B');
    sendGameEvent(code, uid, {
      kind: 'ended',
      gameId: s.game,
      name: ENGINES[s.game]?.meta?.name || 'a game',
      winner,
      winnerName: winner === 'A' ? (duo?.nameA || 'A') : winner === 'B' ? (duo?.nameB || 'B') : null,
      nameA: duo?.nameA || 'A',
      nameB: duo?.nameB || 'B',
      rounds,
      recordA: a,
      recordB: b,
      draws: d
    }).catch(() => {});
  }, []);

  const startGame = useCallback(async (gameId, challengeCtx = null) => {
    const { duo, code, myRole } = ctxRef.current;
    // Leaving a rematch series for a new title → post Ended first.
    if (duo?.session) flushSessionRecap(duo.session);
    pushRecentGame(code, gameId);
    try { window.dispatchEvent(new Event('duoarcade-recent-games')); } catch { /* ignore */ }
    const eng = ENGINES[gameId];
    const isChallenge = !!challengeCtx;
    const skipShellLobby = !!(eng?.meta?.keepInGame && eng?.meta?.realtime);
    const session = {
      game: gameId, gs: eng.meta.realtime ? {} : eng.initialState(),
      turn: eng.meta.realtime ? '-' : 'A', starter: 'A', winner: null,
      phase: isChallenge
        ? (skipShellLobby ? 'live' : 'lobby')
        : 'invite',
      by: myRole, startedAt: Date.now(),
      series: { a: 0, b: 0, d: 0 },
      chatPostedStart: isChallenge,
      chatEndedPosted: false,
      ...(isChallenge
        ? {
            ready: skipShellLobby ? { A: true, B: true } : { A: false, B: false },
            ...(skipShellLobby ? { liveAt: Date.now() } : {}),
          }
        : {}),
      ...(challengeCtx ? { challengeId: challengeCtx.id, challengeSlot: challengeCtx.slot } : {}),
      ...(gameId === 'nightcurling' ? { ncEnds: 3 } : {}),
      ...(gameId === 'chkobba' ? { ckTarget: 21 } : {}),
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
  }, [patchLocal, upd, flushSessionRecap]);

  const afterChallengeWin = useCallback(async (challengeId, slot, winner) => {
    if (challengeBusyRef.current) return;
    challengeBusyRef.current = true;
    const { code } = ctxRef.current;
    try {
      const updated = await setChallengeResult(challengeId, slot, winner);
      const patch = { session: null, turn: '-' };
      patchLocal(patch);
      await upd(code, patch, { force: true });
    } catch (e) {
      setHomeStatus('Challenge score: ' + e.message);
    } finally {
      challengeBusyRef.current = false;
    }
  }, [patchLocal, upd]);

  const startChallengeGame = useCallback(async (challenge, slot) => {
    const gameId = gameForChallengeSlot(challenge, slot ?? challengeNextSlot(challenge) ?? 1);
    if (!gameId || !challenge?.id) return;
    await startGame(gameId, { id: challenge.id, slot: slot ?? challengeNextSlot(challenge) ?? 1 });
  }, [startGame]);

  const rematch = useCallback(async () => {
    const { duo, code, myRole } = ctxRef.current;
    const s = duo.session;
    const eng = ENGINES[s.game];
    const starter = s.winner && s.winner !== 'draw' ? other(s.winner) : other(s.starter);
    const series = s.series || s.streak || { a: 0, b: 0, d: 0 };
    // Back to the ready panel — you count as ready; partner still needs to rematch/ready.
    // keepInGame titles skip the shell lobby (they have an in-game menu).
    const skipShellLobby = !!(eng.meta?.keepInGame && eng.meta?.realtime);
    const session = {
      game: s.game, gs: eng.meta.realtime ? {} : eng.initialState(),
      turn: eng.meta.realtime ? '-' : starter, starter, winner: null,
      phase: skipShellLobby ? 'live' : 'lobby',
      ready: skipShellLobby
        ? { A: true, B: true }
        : { A: myRole === 'A', B: myRole === 'B' },
      liveAt: skipShellLobby ? Date.now() : null,
      by: myRole,
      rematchBy: myRole,
      startedAt: Date.now(),
      series,
      matchScore: null,
      chatPostedStart: true, // already announced this shelf visit
      chatEndedPosted: false,
      ...(s.game === 'nightcurling' ? { ncEnds: s.ncEnds || 3 } : {}),
      ...(s.game === 'chkobba' ? { ckTarget: s.ckTarget || 21 } : {}),
    };
    const patch = { session, turn: eng.meta.realtime ? '-' : starter };
    patchLocal(patch);
    await upd(code, patch, { force: true });
  }, [patchLocal, upd]);

  const backToHome = useCallback(async () => {
    const { duo, code } = ctxRef.current;
    if (duo?.session) {
      flushSessionRecap(duo.session);
      // mark so a racing clear can't double-post
      if (duo.session.series || duo.session.streak) {
        patchLocal({ session: { ...duo.session, chatEndedPosted: true } });
      }
    }
    const patch = { session: null, turn: '-' };
    patchLocal(patch);
    await upd(code, patch, { force: true });
  }, [patchLocal, upd, flushSessionRecap]);

  const bumpSeries = (s, w) => {
    const prev = s.series || s.streak || { a: 0, b: 0, d: 0 };
    const series = { a: prev.a || 0, b: prev.b || 0, d: prev.d || 0 };
    if (w === 'draw') series.d++;
    else if (w === 'A') series.a++;
    else if (w === 'B') series.b++;
    return series;
  };

  const move = useCallback(async m => {
    const { duo, code, myRole } = ctxRef.current;
    const s = duo.session;
    if (!s || s.winner || s.turn !== myRole) return;
    if (s.paused) return;
    if (s.phase && s.phase !== 'live') return;
    // Countdown is driven by shared session.liveAt in GameScreen.
    const eng = ENGINES[s.game];
    const res = eng.applyMove(s.gs, m, myRole);
    if (!res) return;
    const w = eng.winner(res.gs);
    const series = w ? bumpSeries(s, w) : (s.series || s.streak);
    const matchScore = !w ? null
      : w === 'draw' ? { a: 0, b: 0 }
        : w === 'A' ? { a: 1, b: 0 }
          : { a: 0, b: 1 };
    const session = {
      ...s, gs: res.gs, winner: w,
      turn: w ? s.turn : (res.again ? myRole : other(myRole)),
      ...(series ? { series } : {}),
      ...(matchScore ? { matchScore } : {})
    };
    const patch = { session, turn: w ? '-' : session.turn };
    if (w) {
      const records = structuredClone(duo.records || {});
      const rec = records[s.game] ?? (records[s.game] = { a: 0, b: 0, d: 0 });
      if (w === 'draw') rec.d++; else if (w === 'A') rec.a++; else rec.b++;
      patch.records = records;
      finishPatch(duo, patch);
      // One award per finished match (this client is the only one writing the finish).
      awardXp(code, s.game).catch(() => {});
    }
    const prev = duo;
    patchLocal(patch);
    const ok = await upd(code, patch, { guardTurn: myRole });
    if (!ok) setCtx(st => ({ ...st, duo: prev }));
    else if (w && w !== 'draw' && s.challengeId && s.challengeSlot) {
      await afterChallengeWin(s.challengeId, s.challengeSlot, w);
    } else if (w === 'draw' && s.challengeId && s.challengeSlot) {
      await startGame(s.game, { id: s.challengeId, slot: s.challengeSlot });
    }
  }, [patchLocal, upd, afterChallengeWin, startGame]);

  const pressReady = useCallback(async () => {
    const { duo, code, myRole } = ctxRef.current;
    const s = duo.session;
    if (!s || s.phase !== 'lobby' || s.ready?.[myRole] || s.paused) return;
    // Merge with any ready flags already known locally (avoids clobbering partner).
    const ready = { ...(s.ready || { A: false, B: false }), [myRole]: true };
    const both = ready.A && ready.B;
    // Shared liveAt is only a "go live" signal — each client arms a local 3s once.
    const session = both
      ? { ...s, ready, phase: 'live', liveAt: Date.now() + 3000, countdownMs: 3000 }
      : { ...s, ready };
    patchLocal({ session });
    await upd(code, { session }, { force: true });
  }, [patchLocal, upd]);

  const setNcEnds = useCallback(async (n) => {
    const { duo, code } = ctxRef.current;
    const s = duo.session;
    if (!s || s.game !== 'nightcurling' || s.phase !== 'lobby') return;
    if (s.ready?.A || s.ready?.B) return;
    if (![2, 3, 5].includes(n)) return;
    const session = { ...s, ncEnds: n };
    patchLocal({ session });
    await upd(code, { session }, { force: true });
  }, [patchLocal, upd]);

  const setCkTarget = useCallback(async (n) => {
    const { duo, code } = ctxRef.current;
    const s = duo.session;
    if (!s || s.game !== 'chkobba' || s.phase !== 'lobby') return;
    if (s.ready?.A || s.ready?.B) return;
    if (![11, 21, 31].includes(n)) return;
    const session = { ...s, ckTarget: n };
    patchLocal({ session });
    await upd(code, { session }, { force: true });
  }, [patchLocal, upd]);

  const realtimeFinish = useCallback(async (gameId, w, scores) => {
    const { duo, code } = ctxRef.current;
    const s = duo.session;
    if (!s || s.game !== gameId || s.winner) return;
    const matchScore = scores && typeof scores.a === 'number' && typeof scores.b === 'number'
      ? {
          a: scores.a,
          b: scores.b,
          ...(scores.endsWon ? { endsWon: scores.endsWon } : {}),
          ...(Array.isArray(scores.ends) ? { ends: scores.ends } : {}),
        }
      : null;
    const series = bumpSeries(s, w);
    const session = { ...s, winner: w, series, ...(matchScore ? { matchScore } : {}) };
    const patch = { session, turn: '-' };
    const records = structuredClone(duo.records || {});
    const rec = records[gameId] ?? (records[gameId] = { a: 0, b: 0, d: 0 });
    if (w === 'draw') rec.d++;
    else if (w === 'A') rec.a++; else rec.b++;
    patch.records = records;
    finishPatch(duo, patch);
    patchLocal(patch);
    await upd(code, patch, { force: true });
    // Realtime engines only call onFinish from the host — one award per match.
    awardXp(code, gameId).catch(() => {});
    if (w && w !== 'draw' && s.challengeId && s.challengeSlot) {
      await afterChallengeWin(s.challengeId, s.challengeSlot, w);
    } else if (w === 'draw' && s.challengeId && s.challengeSlot) {
      await startGame(s.game, { id: s.challengeId, slot: s.challengeSlot });
    } else if (ENGINES[gameId]?.meta?.keepInGame) {
      // Stay on the in-game board/menu — clear winner so another race can tally
      // without the DuoArcade "takes the match" shelf panel.
      const live = {
        ...session,
        winner: null,
        phase: 'live',
        chatEndedPosted: true,
      };
      patchLocal({ session: live });
      await upd(code, { session: live, turn: '-' }, { force: true });
    }
  }, [patchLocal, upd, afterChallengeWin, startGame]);

  const requestPause = useCallback(async onStatus => {
    const { duo, code, myRole } = ctxRef.current;
    const s = duo.session;
    if (!s || s.winner || (s.phase !== 'live' && s.phase !== 'lobby')) return;
    if (s.paused) {
      const session = { ...s, paused: false, pauseRequest: null };
      patchLocal({ session });
      await upd(code, { session }, { force: true });
      onStatus?.('');
      return;
    }
    if (s.pauseRequest === myRole) return;
    const session = { ...s, pauseRequest: myRole };
    patchLocal({ session });
    const ok = await upd(code, { session }, { force: true });
    onStatus?.(ok ? `Pause request sent to ${other(myRole) === 'A' ? duo.nameA : duo.nameB}.` : 'Could not send pause request.');
  }, [patchLocal, upd]);

  const respondPause = useCallback(async (accept, onStatus) => {
    const { duo, code, myRole } = ctxRef.current;
    const s = duo.session;
    const partner = other(myRole);
    if (!s || s.pauseRequest !== partner) return;
    const session = accept
      ? { ...s, paused: true, pauseRequest: null }
      : { ...s, pauseRequest: null };
    patchLocal({ session });
    const ok = await upd(code, { session }, { force: true });
    onStatus?.(ok ? (accept ? 'Game paused.' : 'Pause declined.') : 'Could not update pause.');
  }, [patchLocal, upd]);

  const forceClearSession = useCallback(async (targetCode, onStatus) => {
    try {
      const { duo, code } = ctxRef.current;
      if (targetCode === code && duo?.session) flushSessionRecap(duo.session);
      const ok = await upd(targetCode, { session: null, turn: '-' }, { force: true });
      if (!ok) throw new Error('server refused (are you a member of this duo?)');
      if (targetCode === ctxRef.current.code) patchLocal({ session: null });
      onStatus?.('Session cleared for both of you.');
    } catch (e) { onStatus?.('Clear failed: ' + e.message); }
  }, [patchLocal, upd, flushSessionRecap]);

  /* ---------- invitations (receiving side) ---------- */

  const acceptInvite = useCallback(async onError => {
    const { duo, code } = ctxRef.current;
    const s = duo.session;
    if (!s || s.phase !== 'invite') return;
    try {
      // Most games use the ready lobby + 3s countdown. Stickman / keepInGame
      // titles have their own in-game lobby — go live immediately so the board mounts.
      const alreadyPosted = !!s.chatPostedStart;
      const engMeta = ENGINES[s.game]?.meta;
      const skipShellLobby = !!(engMeta?.keepInGame && engMeta?.realtime);
      const session = {
        ...s,
        phase: skipShellLobby ? 'live' : 'lobby',
        ready: skipShellLobby ? { A: true, B: true } : { A: false, B: false },
        liveAt: skipShellLobby ? Date.now() : null,
        chatPostedStart: true,
        series: s.series || s.streak || { a: 0, b: 0, d: 0 },
        ...(s.game === 'nightcurling' ? { ncEnds: s.ncEnds || 3 } : {}),
        ...(s.game === 'chkobba' ? { ckTarget: s.ckTarget || 21 } : {}),
      };
      patchLocal({ session });
      const ok = await upd(code, { session }, { force: true });
      if (!ok) throw new Error('server refused the update');
      // One "Started" when the invite is accepted — not again on rematch.
      if (!alreadyPosted && chatConfigured()) {
        const uid = syncRef.current?.auth.user()?.id;
        if (uid) {
          sendGameEvent(code, uid, {
            kind: 'started',
            gameId: s.game,
            name: ENGINES[s.game]?.meta?.name || 'a game'
          }).catch(() => {});
        }
      }
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
      flushSessionRecap(s);
      patchLocal({ session: null });
      upd(code, { session: null, turn: '-' }, { force: true }).catch(() => {});
    }
  }, [ctx, patchLocal, upd, flushSessionRecap]);

  /* ---------- watch party ---------- */

  const pushWatch = useCallback(async fields => {
    const { duo, code } = ctxRef.current;
    const session = { ...duo.session, ...fields };
    patchLocal({ session });
    await upd(code, { session }, { force: true });
  }, [patchLocal, upd]);

  const startWatch = useCallback(async videoId => {
    const { code, myRole } = ctxRef.current;
    const session = buildWatchSession({ videoId, by: myRole });
    setWatchInviteDismissed(false);
    patchLocal({ session, turn: '-' });
    await upd(code, { session, turn: '-' }, { force: true });
    try { friendsPresenceRef.current?.setBusy?.(watchBusyLabel(session), code); } catch { /* */ }
  }, [patchLocal, upd]);

  const startReels = useCallback(async () => {
    const { code, myRole } = ctxRef.current;
    const session = buildReelsSession({ by: myRole, queue: [] });
    setWatchInviteDismissed(false);
    patchLocal({ session, turn: '-' });
    await upd(code, { session, turn: '-' }, { force: true });
    try { friendsPresenceRef.current?.setBusy?.(watchBusyLabel(session), code); } catch { /* */ }
  }, [patchLocal, upd]);

  const startMovie = useCallback(async (opts = {}) => {
    const { code, myRole } = ctxRef.current;
    const session = buildMovieSession({
      by: myRole,
      fingerprint: opts.fingerprint || null,
      title: opts.title || 'Our film',
      sizeLabel: opts.sizeLabel || '',
    });
    if (opts.resume) {
      session.phase = 'lobby';
      session.position = opts.position || 0;
      session.nightId = opts.nightId || null;
      session.friendly = opts.fingerprint ? friendlyName(opts.fingerprint) : null;
    }
    setWatchInviteDismissed(false);
    patchLocal({ session, turn: '-' });
    await upd(code, { session, turn: '-' }, { force: true });
    try { friendsPresenceRef.current?.setBusy?.(watchBusyLabel(session), code); } catch { /* */ }
  }, [patchLocal, upd]);

  const startStreaming = useCallback(async (opts = {}) => {
    const { code, myRole } = ctxRef.current;
    const platform = opts.platform || null;
    const session = buildStreamingSession({ by: myRole, platform });
    // Always start at L3; promote to L2 only when extension binds + adapter reports.
    session.capability = 3;
    if (platform) session.mediaRef = { kind: 'streaming', id: platform };
    setWatchInviteDismissed(false);
    patchLocal({ session, turn: '-' });
    await upd(code, { session, turn: '-' }, { force: true });
    try { friendsPresenceRef.current?.setBusy?.(watchBusyLabel(session), code); } catch { /* */ }
  }, [patchLocal, upd]);

  const onEndWatch = useCallback((xpGameId) => {
    const { code } = ctxRef.current;
    if (code && xpGameId) awardXp(code, xpGameId).catch(() => {});
  }, []);

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

  /* Reset watch invite toast when a new night starts */
  useEffect(() => {
    setWatchInviteDismissed(false);
  }, [ctx.duo?.session?.startedAt, ctx.duo?.session?.type]);

  /* Clear busy when leaving watch sessions */
  useEffect(() => {
    const s = ctx.duo?.session;
    if (isWatchSession(s)) {
      try { friendsPresenceRef.current?.setBusy?.(watchBusyLabel(s), ctx.code); } catch { /* */ }
    } else {
      try { friendsPresenceRef.current?.setOnline?.(); } catch { /* */ }
    }
  }, [ctx.duo?.session?.type, ctx.duo?.session?.phase, ctx.code]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- duo pass ---------- */

  const setTheme = useCallback(async name => {
    const code = ctxRef.current.code || (myDuos[0] && myDuos[0].code);
    if (!code) return;
    applyTheme(name);
    if (ctxRef.current.code === code) patchLocal({ theme: name });
    setMyDuos(list => list.map(d => (d.code === code ? { ...d, theme: name } : d)));
    await upd(code, { theme: name }, { force: true });
  }, [patchLocal, upd, myDuos]);

  const setAnniversary = useCallback(async iso => {
    const { code } = ctxRef.current;
    patchLocal({ anniversary: iso });
    await upd(code, { anniversary: iso }, { force: true });
  }, [patchLocal, upd]);

  const setFavoriteGames = useCallback(async ids => {
    const { code } = ctxRef.current;
    const next = Array.isArray(ids) ? ids : [];
    patchLocal({ favoriteGames: next });
    await upd(code, { favoriteGames: next }, { force: true });
  }, [patchLocal, upd]);

  const setFixGames = useCallback(async list => {
    const { code } = ctxRef.current;
    const next = Array.isArray(list) ? list : [];
    patchLocal({ fixGames: next });
    await upd(code, { fixGames: next }, { force: true });
  }, [patchLocal, upd]);

  const setDaliGames = useCallback(async ids => {
    const { code } = ctxRef.current;
    const next = Array.isArray(ids) ? ids : [];
    patchLocal({ daliGames: next });
    await upd(code, { daliGames: next }, { force: true });
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
      setPubDuo(null);
      // Lobby search uses view=pubProfile; leaderboard keeps the open duo and overlays.
      if (!ctxRef.current.code) setView('pubProfile');
    } catch (e) { setLobbyStatus(e.message); }
  }, []);

  const openPublicDuo = useCallback(async row => {
    const username = row?.username_a || row?.username_b;
    if (!username || !row?.name_a || !row?.name_b) return;
    try {
      const duo = await syncRef.current.getPublicDuo(username, row.name_a, row.name_b);
      setPubDuo(duo);
      setPubProfile(null);
      if (duo?.theme) applyTheme(duo.theme);
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
      setGeoStatus(place ? '' : 'Updating location…');
      // Always push lat/lng; place may be null briefly after a move until geocode returns.
      pushGeo({ lat, lng, place: place ?? null });
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

  /* ---------- user presence (friends online + partner busy label) ---------- */

  useEffect(() => {
    const { code, myRole } = ctx;
    if (!code || !myRole) return undefined;
    let alive = true;
    let presenceCtrl = null;
    let pollTimer = null;
    let unsubInbox = () => {};

    createFriendsClient().then(api => {
      if (!alive || !api.user) return;
      presenceCtrl = api.startPresence({ status: 'online' });
      friendsPresenceRef.current = presenceCtrl;
      const pollPartner = async () => {
        try {
          const view = await api.listView();
          if (!alive) return;
          const pp = view?.partner_presence;
          if (!pp) return;
          const partnerRole = other(myRole);
          setPresenceState(prev => ({
            ...prev,
            [partnerRole]: {
              ...prev[partnerRole],
              busyLabel: pp.status === 'busy' ? (pp.busy_label || 'Busy') : null
            }
          }));
        } catch { /* friends schema not applied yet */ }
      };
      pollPartner();
      pollTimer = setInterval(pollPartner, 10000);
      unsubInbox = api.subscribeInbox(() => pollPartner());

      const onVis = () => {
        if (document.hidden) presenceCtrl?.setAway?.();
        else presenceCtrl?.setOnline?.();
      };
      document.addEventListener('visibilitychange', onVis);
      presenceCtrl._onVis = onVis;
    }).catch(() => {});

    return () => {
      alive = false;
      clearInterval(pollTimer);
      unsubInbox();
      friendsPresenceRef.current = null;
      try {
        if (presenceCtrl?._onVis) {
          document.removeEventListener('visibilitychange', presenceCtrl._onVis);
        }
        presenceCtrl?.close();
      } catch { /* */ }
    };
  }, [ctx.code, ctx.myRole]);

  /* ---------- theme follows the duo (free for everyone) ---------- */

  useEffect(() => {
    const duo = ctx.duo || myDuos[0];
    if (!duo) { applyTheme('classic'); return; }
    applyTheme(duo.theme || 'classic');
  }, [ctx.duo?.theme, myDuos]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Re-apply duo theme when light/dark changes (pale accents deepen on light). */
  useEffect(() => {
    const onAppear = () => {
      const duo = ctxRef.current?.duo || myDuos[0];
      applyTheme(duo?.theme || 'classic');
    };
    window.addEventListener('duoarcade-appearance', onAppear);
    return () => window.removeEventListener('duoarcade-appearance', onAppear);
  }, [myDuos]);

  /* ---------- boot ---------- */

  useEffect(() => {
    if (initStarted.current) return;
    initStarted.current = true;
    let inviteTimer, reconcileTimer;
    let unsubAuth = null;

    (async () => {
      console.log('DuoArcade ' + VERSION);
      const sync = await createSync();
      syncRef.current = sync;
      setMode(sync.mode);
      whoami();

      sync.onDuo(remote => {
        setCtx(s => {
          if (!s.code || !s.duo) return s.code ? { ...s, duo: remote } : s;
          // Don't let a stale realtime echo rewind an in-progress session
          // (was remounting Spark & Splash on the guest and killing input).
          const localS = s.duo.session;
          const remoteS = remote.session;
          if (
            localS && remoteS &&
            localS.startedAt && remoteS.startedAt === localS.startedAt
          ) {
            const rank = sess => {
              if (!sess) return -1;
              if (sess.winner) return 500;
              if (sess.phase === 'live') return 400 + (sess.ready?.A && sess.ready?.B ? 1 : 0);
              if (sess.phase === 'lobby') return 300;
              if (sess.phase === 'invite') return 100;
              return 0;
            };
            // Always keep a more-advanced local session for this match start.
            // (Late single-ready writes used to rewind live → lobby and re-stick "3".)
            if (rank(localS) > rank(remoteS)) {
              return {
                ...s,
                duo: { ...remote, session: localS, turn: s.duo.turn ?? remote.turn }
              };
            }
            // Prefer the earlier liveAt so countdown can't re-arm from a second writer.
            if (
              localS.phase === 'live' && remoteS.phase === 'live' &&
              localS.liveAt && remoteS.liveAt &&
              localS.liveAt < remoteS.liveAt &&
              Date.now() - lastLocalWrite.current < 5000
            ) {
              return {
                ...s,
                duo: {
                  ...remote,
                  session: { ...remoteS, liveAt: localS.liveAt },
                  turn: s.duo.turn ?? remote.turn
                }
              };
            }
          }
          return { ...s, duo: remote };
        });
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
      pendingReopenRef.current = reopenDuo;

      if (sync.auth.user()) {
        await loadProfile();
        const arenaPath = requestedArenaPath();
        if (arenaPath) {
          localStorage.removeItem('duoarcade-arena-next');
          window.location.assign(arenaPath);
          return;
        }
        await enterAfterAuth();
      } else {
        if (pendingInvite.current) {
          setAuthNotice('You’ve been invited to a duo — sign in or create your account to join.');
        }
        setView('auth');
      }
      setBooted(true);

      // Session can hydrate after first getSession — don't leave signed-in users on AuthScreen.
      unsubAuth = sync.auth.onChange?.(async (user, event) => {
        whoami();
        if (!user) return;
        if (event === 'SIGNED_OUT') return;
        if (ctxRef.current.code) return;
        if (viewRef.current && viewRef.current !== 'auth') return;
        try { await enterAfterAuth(); } catch { /* */ }
      });
    })();

    return () => {
      clearInterval(inviteTimer);
      clearInterval(reconcileTimer);
      try { unsubAuth?.(); } catch { /* */ }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- screen routing (the old renderAll) ---------- */

  const { duo, code, myRole } = ctx;
  const s = duo?.session;
  let screen;
  if (!booted) {
    screen = <div className="status">Warming up the arcade…</div>;
  } else if (duo && code) {
    let inner;
    if (s && s.type === 'watch') {
      inner = (
        <WatchScreen
          duo={duo} code={code} myRole={myRole}
          pushWatch={pushWatch} submitRating={submitRating}
          onBack={backToHome} onEndWatch={onEndWatch}
        />
      );
    } else if (s && s.type === 'reels') {
      inner = (
        <ReelsPartyScreen
          duo={duo} code={code} myRole={myRole}
          pushWatch={pushWatch} submitRating={submitRating}
          onBack={backToHome} onEndWatch={onEndWatch}
        />
      );
    } else if (s && s.type === 'movie') {
      inner = (
        <MovieNightScreen
          duo={duo} code={code} myRole={myRole}
          pushWatch={pushWatch} submitRating={submitRating}
          onBack={backToHome} onEndWatch={onEndWatch}
        />
      );
    } else if (s && s.type === 'streaming') {
      inner = (
        <StreamingWatchScreen
          duo={duo} code={code} myRole={myRole}
          pushWatch={pushWatch} submitRating={submitRating}
          onBack={backToHome} onEndWatch={onEndWatch}
        />
      );
    } else if (s && s.game &&
      !(s.phase === 'invite' && s.by !== myRole) &&
      !(s.phase === 'declined' && s.declinedBy === myRole)) {
      inner = (
        <GameScreen
          duo={duo} code={code} myRole={myRole} isAway={isAway}
          sync={syncRef.current} onMove={move} onReady={pressReady}
          onRematch={rematch} onBack={backToHome}
          onRequestPause={requestPause} onRespondPause={respondPause}
          onRealtimeFinish={realtimeFinish}
          onSetNcEnds={setNcEnds}
          onSetCkTarget={setCkTarget}
        />
      );
    } else {
      const placeProps = {
        duo, code, myRole, isAway, presence: presenceState, geoStatus,
        homeStatus, setHomeStatus,
        onStartGame: startGame, onStartWatch: startWatch,
        onStartReels: startReels, onStartMovie: startMovie,
        onStartStreaming: startStreaming,
        onBack: () => { leaveDuoContext(); void enterLobby({ stay: true }); },
        onSetAnniversary: setAnniversary,
        onSetFavoriteGames: setFavoriteGames, onSetFixGames: setFixGames,
        onSetDaliGames: setDaliGames, onRedeem: redeemCode,
        avatarTick,
        username: profile?.username || '',
        email: userEmail || '',
        onSetUsername: saveUsername,
        theme: (duo || myDuos[0])?.theme || 'classic',
        onSetTheme: setTheme,
        onSignOut: signOut,
        onDeleteDuo: deleteDuo,
        onAvatarChange: () => setAvatarTick(t => t + 1),
        friendsEnabled: !!(duo && code && myRole && syncRef.current?.auth.user()?.id),
      };
      inner = (
        <Routes>
          <Route element={<DuoHomeLayout {...placeProps} />}>
            <Route index element={<HomeScreen {...placeProps} />} />
            <Route path="place/:featureId" element={<PlaceScreen {...placeProps} />} />
          </Route>
        </Routes>
      );
    }
    screen = myRole ? (
      <ChallengeProvider code={code} myRole={myRole} onStartChallengeGame={startChallengeGame}>
        {inner}
      </ChallengeProvider>
    ) : inner;
  } else if (view === 'lobby') {
    screen = (
      <LobbyScreen
        myDuos={myDuos} lobbyStatus={lobbyStatus}
        myRole={ctx.myRole || (myDuos[0] && syncRef.current?.auth.user()?.id
          ? (myDuos[0].memberA === syncRef.current.auth.user().id ? 'A'
            : myDuos[0].memberB === syncRef.current.auth.user().id ? 'B' : null)
          : null)}
        onOpenDuo={openByAccount}
        onCreateDuo={createDuo} onJoinInvite={joinFromInviteString}
        onToggleVisibility={toggleVisibility}
        autoEnter={!stayInLobby}
      />
    );
  } else if (view === 'pubProfile') {
    screen = <PublicProfileScreen profile={pubProfile} onBack={() => setView('lobby')} />;
  } else if (syncRef.current?.auth.user()) {
    // Signed in, duo still restoring (e.g. remount after Arena) — never flash Sign in or Duo Profile.
    screen = <div className="status">{lobbyStatus || 'Opening your duo…'}</div>;
  } else {
    screen = <AuthScreen notice={authNotice} mode={mode} onSubmit={authSubmit} defaultTab={pendingInvite.current ? 'up' : 'in'} />;
  }

  // Arena is nested under /app so Arcade (and open duo) stays mounted.
  // Leaving Arena → /app is then just a route change, not a cold remount into Duo Profile.
  if (booted && onArena) {
    return (
      <Routes>
        <Route path="/app/arena/:matchCode" element={<ArenaMatch />} />
        <Route path="/app/arena" element={<Arena />} />
        <Route path="arena/:matchCode" element={<ArenaMatch />} />
        <Route path="arena" element={<Arena />} />
      </Routes>
    );
  }

  // Leaderboard is a full-page view inside Arcade (hooks stay alive, duo stays open).
  // No topbar here — Back must not sit next to Sign out.
  if (booted && onLeaderboard) {
    if (pubDuo) {
      return (
        <div className="arcade-page">
          <DuoProfileView
            duo={pubDuo}
            mode="public"
            onBack={() => {
              setPubDuo(null);
              applyTheme((duo || myDuos[0])?.theme || 'classic');
            }}
          />
        </div>
      );
    }
    return (
      <div className="arcade-page">
        {pubProfile ? (
          <PublicProfileScreen
            profile={pubProfile}
            onBack={() => setPubProfile(null)}
          />
        ) : (
          <Leaderboard
            theme={(duo || myDuos[0])?.theme || 'classic'}
            embedded
            onBack={() => {
              setPubProfile(null);
              setPubDuo(null);
              navigate('/app');
            }}
            onOpenDuo={openPublicDuo}
          />
        )}
      </div>
    );
  }

  return (
    <div className="arcade-page">
      <header className="topbar">
        <div className="topbar-inner">
          <Link
            className="brand h1"
            to="/app"
            onClick={(e) => {
              e.preventDefault();
              void (async () => {
                setStayInLobby(false);
                if (ctxRef.current.duo?.session) await backToHome();
                if (!ctxRef.current.code) {
                  let prefer = null;
                  try { prefer = sessionStorage.getItem('duoarcade-home-duo'); } catch { /* */ }
                  const pick = (prefer && myDuos.some(d => d.code === prefer))
                    ? prefer
                    : (myDuos[0]?.code || prefer || null);
                  if (pick) await openByAccount(pick);
                }
                navigate('/app', { replace: true });
              })();
            }}
          >
            <span className="a">Duo</span><span className="b">Arcade</span>
          </Link>
          <div className="topbar-right">
            <div className="who">
              <span>{profile?.username ? '@' + profile.username : userEmail}</span>{' '}
              <span style={{ opacity: .55, cursor: 'pointer' }} title="tap for diagnostics"
                onClick={() => setShowDiag(v => !v)}>· {VERSION}</span>
            </div>
            <SettingsMenu />
          </div>
        </div>
      </header>


      {screen}

      <InviteOverlay
        duo={duo} myRole={myRole}
        suppressedUntil={suppressInviteUntil.current}
        onAccept={acceptInvite} onDecline={declineInvite}
        onDismiss={dismissInvite}
        onForceClear={onStatus => forceClearSession(code, onStatus)}
      />

      {duo && myRole && isWatchSession(duo.session) && !watchInviteDismissed && duo.session?.by !== myRole && (
        <WatchInviteToast
          duo={{
            ...duo,
            session: watchInviteDismissed
              ? { ...duo.session, _inviteDismissed: true }
              : duo.session,
          }}
          myRole={myRole}
          onJoin={() => setWatchInviteDismissed(true)}
          onDismiss={() => setWatchInviteDismissed(true)}
        />
      )}

      <FriendMatchInvite enabled={!!(duo && code && myRole && syncRef.current?.auth.user()?.id)} />

      <FriendsDock
        enabled={!!(duo && code && myRole && syncRef.current?.auth.user()?.id)}
        partnerName={
          duo && myRole
            ? ((myRole === 'A' ? duo.nameB : duo.nameA) || 'Partner')
            : 'Partner'
        }
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
            presence: presenceState,
            mode
          }, null, 2)}
        </pre>
      )}
    </div>
  );
}
