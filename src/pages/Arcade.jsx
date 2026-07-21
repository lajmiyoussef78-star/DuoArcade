import { useEffect, useRef, useState, useCallback } from 'react';
import { Link, useNavigate, Routes, Route } from 'react-router-dom';
import { createSync } from '../lib/sync.js';
import { ENGINES } from '../engines/index.js';
import {
  other, today, loadSeats, saveSeat, removeSeat, applyTheme, finishPatch
} from '../lib/util.js';
import { watchGeo } from '../lib/location.js';
import { chatConfigured, sendGameEvent } from '../lib/chat.js';
import { awardXp } from '../lib/xp.js';
import {
  challengeNextSlot, gameForChallengeSlot, setChallengeResult,
} from '../lib/challenges.js';
import AuthScreen from '../arcade/AuthScreen.jsx';
import LobbyScreen from '../arcade/LobbyScreen.jsx';
import PublicProfileScreen from '../arcade/PublicProfileScreen.jsx';
import HomeScreen from '../arcade/HomeScreen.jsx';
import PlaceScreen from '../arcade/PlaceScreen.jsx';
import GameScreen from '../arcade/GameScreen.jsx';
import WatchScreen from '../arcade/WatchScreen.jsx';
import InviteOverlay from '../arcade/InviteOverlay.jsx';
import { ChallengeProvider } from '../arcade/ChallengeContext.jsx';
import PartnerChat from '../arcade/PartnerChat.jsx';
import SettingsMenu from '../arcade/SettingsMenu.jsx';

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
  const [lobbyStatus, setLobbyStatus] = useState('');
  const [homeStatus, setHomeStatus] = useState('');
  const [ctx, setCtx] = useState({ duo: null, code: null, myRole: null });
  const [presenceState, setPresenceState] = useState(DEFAULT_PRESENCE);
  const [geoStatus, setGeoStatus] = useState('');
  const [showDiag, setShowDiag] = useState(false);
  const [avatarTick, setAvatarTick] = useState(0);

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
      window.history.replaceState({}, '', '/app');
    } catch (e) { setLobbyStatus(e.message); }
  }, []);

  const joinPending = useCallback(async () => {
    const inv = pendingInvite.current;
    pendingInvite.current = null;
    try {
      const res = await syncRef.current.openDuo(inv.code, inv.token);
      saveSeat(inv.code, inv.token);
      setCtx({ duo: res.duo, code: inv.code, myRole: res.role });
      window.history.replaceState({}, '', '/app');
    } catch (e) {
      setAuthNotice(e.message);
      setLobbyStatus(e.message);
      await enterLobby();
    }
  }, [enterLobby]);

  /** After sign-in/boot: pending invite → join; else auto-open sole duo; else lobby. */
  const enterAfterAuth = useCallback(async () => {
    whoami();
    await loadProfile();
    if (pendingInvite.current) {
      await joinPending();
      return;
    }
    const duos = await syncRef.current.listMyDuos();
    setMyDuos(duos);
    if (duos.length >= 1) {
      await openByAccount(duos[0].code);
      return;
    }
    setView('lobby');
  }, [whoami, loadProfile, joinPending, openByAccount]);

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
      window.history.replaceState({}, '', '/app');
    } catch (e) {
      setLobbyStatus(e.message);
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
    const eng = ENGINES[gameId];
    const isChallenge = !!challengeCtx;
    const session = {
      game: gameId, gs: eng.meta.realtime ? {} : eng.initialState(),
      turn: eng.meta.realtime ? '-' : 'A', starter: 'A', winner: null,
      phase: isChallenge ? 'lobby' : 'invite',
      by: myRole, startedAt: Date.now(),
      series: { a: 0, b: 0, d: 0 },
      chatPostedStart: isChallenge,
      chatEndedPosted: false,
      ...(isChallenge ? { ready: { A: false, B: false } } : {}),
      ...(challengeCtx ? { challengeId: challengeCtx.id, challengeSlot: challengeCtx.slot } : {}),
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
    const session = {
      game: s.game, gs: eng.meta.realtime ? {} : eng.initialState(),
      turn: eng.meta.realtime ? '-' : starter, starter, winner: null,
      phase: 'invite', by: myRole, startedAt: Date.now(),
      series,
      chatPostedStart: true, // already announced this shelf visit
      chatEndedPosted: false
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
    // Countdown is enforced locally in GameScreen (clock-skew safe) — don't gate on liveAt here.
    const eng = ENGINES[s.game];
    const res = eng.applyMove(s.gs, m, myRole);
    if (!res) return;
    const w = eng.winner(res.gs);
    const series = w ? bumpSeries(s, w) : (s.series || s.streak);
    const session = {
      ...s, gs: res.gs, winner: w,
      turn: w ? s.turn : (res.again ? myRole : other(myRole)),
      ...(series ? { series } : {})
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
    const ready = { ...(s.ready || { A: false, B: false }), [myRole]: true };
    const both = ready.A && ready.B;
    // Mark countdown start; each client runs a fixed local 3s (avoids clock skew).
    const session = both
      ? { ...s, ready, phase: 'live', liveAt: Date.now() + 3000, countdownMs: 3000 }
      : { ...s, ready };
    patchLocal({ session });
    await upd(code, { session }, { force: true });
  }, [patchLocal, upd]);

  const realtimeFinish = useCallback(async (gameId, w, scores) => {
    const { duo, code } = ctxRef.current;
    const s = duo.session;
    if (!s || s.game !== gameId || s.winner) return;
    const matchScore = scores && typeof scores.a === 'number' && typeof scores.b === 'number'
      ? { a: scores.a, b: scores.b }
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
      // Every game goes through the ready lobby before a fixed 3s countdown.
      const alreadyPosted = !!s.chatPostedStart;
      const session = {
        ...s,
        phase: 'lobby',
        ready: { A: false, B: false },
        liveAt: null,
        chatPostedStart: true,
        series: s.series || s.streak || { a: 0, b: 0, d: 0 }
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

  /* ---------- theme follows the duo (free for everyone) ---------- */

  useEffect(() => {
    const duo = ctx.duo || myDuos[0];
    if (!duo) { applyTheme('night'); return; }
    applyTheme(duo.theme || 'night');
  }, [ctx.duo?.theme, myDuos]); // eslint-disable-line react-hooks/exhaustive-deps

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
        } else if (reopenDuo) {
          await openByAccount(reopenDuo);
          window.history.replaceState({}, '', '/app');
        } else {
          await enterAfterAuth();
        }
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
    let inner;
    if (s && s.type === 'watch') {
      inner = (
        <WatchScreen
          duo={duo} myRole={myRole}
          pushWatch={pushWatch} submitRating={submitRating} onBack={backToHome}
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
        />
      );
    } else {
      const placeProps = {
        duo, code, myRole, isAway, presence: presenceState, geoStatus,
        homeStatus, setHomeStatus,
        onStartGame: startGame, onStartWatch: startWatch,
        onBack: () => { leaveDuoContext(); enterLobby(); },
        onSetAnniversary: setAnniversary,
        onSetFavoriteGames: setFavoriteGames, onRedeem: redeemCode,
        avatarTick,
      };
      inner = (
        <Routes>
          <Route index element={<HomeScreen {...placeProps} />} />
          <Route path="place/:featureId" element={<PlaceScreen {...placeProps} />} />
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
        onOpenDuo={openByAccount}
        onCreateDuo={createDuo} onJoinInvite={joinFromInviteString}
        onDeleteDuo={deleteDuo}
        onToggleVisibility={toggleVisibility}
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
        <Link className="brand h1" to="/app"><span className="a">Duo</span><span className="b">Arcade</span></Link>
        <div className="topbar-right">
          <div className="who">
            <span>{profile?.username ? '@' + profile.username : userEmail}</span>{' '}
            <span style={{ opacity: .55, cursor: 'pointer' }} title="tap for diagnostics"
              onClick={() => setShowDiag(v => !v)}>· {VERSION}</span>
          </div>
          <SettingsMenu
            onSignOut={signOut}
            canSetTheme={!!(ctx.duo || myDuos[0])}
            theme={(ctx.duo || myDuos[0])?.theme || 'night'}
            onSetTheme={setTheme}
            nameA={(ctx.duo || myDuos[0])?.nameA || 'Partner one'}
            nameB={(ctx.duo || myDuos[0])?.nameB || 'Partner two'}
            code={ctx.code || myDuos[0]?.code || null}
            myRole={ctx.myRole || (myDuos[0] && syncRef.current?.auth.user()?.id
              ? (myDuos[0].memberA === syncRef.current.auth.user().id ? 'A'
                : myDuos[0].memberB === syncRef.current.auth.user().id ? 'B' : null)
              : null)}
            onAvatarChange={() => setAvatarTick(t => t + 1)}
          />
        </div>
      </div>


      {screen}

      {duo && code && myRole && syncRef.current?.auth.user()?.id && (
        <PartnerChat
          code={code}
          userId={syncRef.current.auth.user().id}
          partnerName={myRole === 'A' ? (duo.nameB || 'Partner') : (duo.nameA || 'Partner')}
        />
      )}

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
            presence: presenceState,
            mode
          }, null, 2)}
        </pre>
      )}
    </div>
  );
}
