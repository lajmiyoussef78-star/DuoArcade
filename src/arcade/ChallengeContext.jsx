// ChallengeContext.jsx — duo-wide challenge sync + modals (any route, not just home).

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  cancelChallenge, challengeNextSlot, closeChallengeSync, duoNames, getChallenges, scoreOf,
  subscribeChallengeSync,
} from '../lib/challenges.js';
import ChallengeCreateModal from './ChallengeCreateModal.jsx';
import {
  ChallengeCompleteModal,
  ChallengeDeclinedModal,
  ChallengeLineupModal,
  ChallengeInviteModal,
  ChallengePickGameModal,
  useChallengeLineupBoard,
  useChallengeRespondFlow,
} from './ChallengeRespondModals.jsx';

const ChallengeContext = createContext(null);

function live(list) {
  return (list || []).find(c => c.status === 'pending' || c.status === 'active') || null;
}

function other(role) {
  return role === 'A' ? 'B' : 'A';
}

const declinedSeenKey = code => 'duoarcade-chal-declined-seen-' + code;

function loadDeclinedSeen(code) {
  if (!code) return new Set();
  try {
    const raw = JSON.parse(localStorage.getItem(declinedSeenKey(code)) || '[]');
    return new Set(Array.isArray(raw) ? raw.map(String) : []);
  } catch {
    return new Set();
  }
}

function saveDeclinedSeen(code, set) {
  if (!code) return;
  try {
    localStorage.setItem(declinedSeenKey(code), JSON.stringify([...set]));
  } catch { /* ignore quota */ }
}

export function ChallengeProvider({ code, myRole, onStartChallengeGame, children }) {
  const [cur, setCur] = useState(null);
  const [names, setNames] = useState({ A: 'A', B: 'B' });
  const [createOpen, setCreateOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(null);
  const [declinedOpen, setDeclinedOpen] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const shownDeclinedRef = useRef(loadDeclinedSeen(code));
  const myRoleRef = useRef(myRole);
  myRoleRef.current = myRole;

  useEffect(() => {
    shownDeclinedRef.current = loadDeclinedSeen(code);
    setDeclinedOpen(null);
  }, [code]);

  const markDeclinedSeen = useCallback((id) => {
    if (id == null || !code) return;
    const key = String(id);
    if (shownDeclinedRef.current.has(key)) return;
    shownDeclinedRef.current.add(key);
    saveDeclinedSeen(code, shownDeclinedRef.current);
  }, [code]);

  /* Old declines on page load shouldn't keep popping — only fresh ones. */
  const isStaleDeclined = (c) => {
    const t = c?.resolved_at || c?.created_at;
    if (!t) return false;
    const age = Date.now() - new Date(t).getTime();
    return Number.isFinite(age) && age > 30 * 60 * 1000;
  };

  const applyChallenge = useCallback((c, type) => {
    if (!c) return;
    if (c.status === 'pending' || c.status === 'active') {
      setCur(c);
      return;
    }
    if (c.status === 'done') {
      setCur(null);
      setCompleteOpen(c);
      return;
    }
    if (c.status === 'declined' && c.created_by === myRoleRef.current) {
      setCur(null);
      const key = String(c.id);
      if (!shownDeclinedRef.current.has(key)) {
        markDeclinedSeen(c.id);
        setDeclinedOpen(c);
      }
      return;
    }
    if (c.status === 'cancelled' || type === 'cancelled') {
      setCur(null);
    }
  }, [markDeclinedSeen]);

  const checkDeclined = useCallback(rows => {
    if (!myRoleRef.current) return;
    let toShow = null;
    for (const c of rows || []) {
      if (c.status !== 'declined' || c.created_by !== myRoleRef.current) continue;
      const key = String(c.id);
      if (shownDeclinedRef.current.has(key)) continue;
      if (isStaleDeclined(c)) {
        markDeclinedSeen(c.id);
        continue;
      }
      if (!toShow) toShow = c;
    }
    if (toShow) {
      markDeclinedSeen(toShow.id);
      setDeclinedOpen(toShow);
    }
  }, [markDeclinedSeen]);

  const pull = useCallback(async () => {
    if (!code) return;
    try {
      const rows = await getChallenges(code);
      setCur(live(rows));
      checkDeclined(rows);
    } catch (_) {
      setCur(null);
    }
  }, [code, checkDeclined]);

  const refresh = pull;

  const respond = useChallengeRespondFlow({
    code, challenge: cur, myRole, onRefresh: refresh, onChallenge: applyChallenge,
  });
  const { open: lineupAutoOpen, close: closeLineup, openManual: openLineupManual } =
    useChallengeLineupBoard({ challenge: cur });

  useEffect(() => {
    if (!code) return undefined;
    let alive = true;

    const onSync = msg => {
      if (!alive || msg?.k !== 'chal') return;
      if (msg.c) applyChallenge(msg.c, msg.t);
      else pull();
    };

    const unsub = subscribeChallengeSync(code, onSync);

    (async () => {
      try {
        setNames(await duoNames(code));
      } catch (_) { /* ignore */ }
      if (alive) await pull();
    })();

    const poll = setInterval(() => {
      if (document.hidden) return;
      pull();
    }, 1500);

    return () => {
      alive = false;
      unsub();
      clearInterval(poll);
      closeChallengeSync(code);
    };
  }, [code, pull, applyChallenge]);

  const fromName = cur ? names[cur.created_by] : '';
  const iAmReceiver = cur?.status === 'pending' && cur.created_by !== myRole;
  const iAmCreatorWaiting = cur?.status === 'pending' && cur.created_by === myRole;

  let title = 'Challenge your partner';
  let sub = 'Best of three games. Winner picks the stake.';
  let liveOn = false;

  if (cur?.status === 'pending') {
    liveOn = true;
    if (cur.created_by === myRole) {
      title = `Waiting on ${names[cur.created_by === 'A' ? 'B' : 'A']}`;
      sub = cur.stake;
    } else {
      title = `Challenge from ${names[cur.created_by]}`;
      sub = cur.stake;
    }
  } else if (cur?.status === 'active') {
    liveOn = true;
    const sc = scoreOf(cur);
    title = `Challenge · ${sc.a}–${sc.b}`;
    sub = cur.stake;
  }

  const beginChallenge = useCallback(slot => {
    if (!cur || cur.status !== 'active') return;
    respond.closeFate();
    closeLineup();
    onStartChallengeGame?.(cur, slot || 1);
  }, [cur, respond, closeLineup, onStartChallengeGame]);

  const endEarly = async challenge => {
    if (!challenge?.id) return;
    if (!window.confirm('End this challenge now? No winner will be recorded.')) return;
    try {
      await cancelChallenge(challenge.id);
      closeLineup();
      await refresh();
    } catch (_) { /* ignore */ }
  };

  const cancelPending = async () => {
    if (!cur?.id || cancelling) return;
    if (!window.confirm('Cancel this challenge invite?')) return;
    setCancelling(true);
    try {
      await cancelChallenge(cur.id);
      await refresh();
    } catch (_) { /* ignore */ }
    finally { setCancelling(false); }
  };

  const openCreate = useCallback(() => setCreateOpen(true), []);
  const closeCreate = useCallback(() => setCreateOpen(false), []);

  const onCardClick = useCallback(() => {
    if (cur?.status === 'active') {
      openLineupManual();
      return;
    }
    if (liveOn) {
      if (iAmReceiver) respond.openInvite();
      return;
    }
    setCreateOpen(true);
  }, [cur, liveOn, iAmReceiver, respond, openLineupManual]);

  const fateRollingOpen = respond.step === 'fate' && cur?.status === 'pending';
  const lineupOpen = lineupAutoOpen && cur?.status === 'active';

  const value = {
    cur,
    names,
    title,
    sub,
    liveOn,
    iAmCreatorWaiting,
    cancelling,
    onCardClick,
    cancelPending,
    openCreate,
  };

  const declinedPartner = declinedOpen
    ? names[other(declinedOpen.created_by)]
    : '';

  return (
    <ChallengeContext.Provider value={value}>
      {children}

      <ChallengeCreateModal
        code={code}
        open={createOpen}
        onClose={closeCreate}
        onCreated={refresh}
      />

      <ChallengeInviteModal
        open={respond.step === 'invite'}
        challenge={cur}
        fromName={fromName}
        onAccept={respond.acceptInvite}
        onDecline={respond.decline}
        onClose={respond.dismiss}
        busy={respond.busy}
        err={respond.err}
      />

      <ChallengePickGameModal
        open={respond.step === 'pick'}
        challenge={cur}
        onPick={respond.pickGame}
        onBack={respond.backToInvite}
        busy={respond.busy}
        err={respond.err}
      />

      <ChallengeLineupModal
        open={fateRollingOpen}
        challenge={cur}
        names={names}
        game2Override={respond.game2Pick}
        game3Override={respond.fateGame}
        rolling={respond.rolling}
        onClose={respond.closeFate}
        onPlay={beginChallenge}
      />

      <ChallengeLineupModal
        open={lineupOpen}
        challenge={cur}
        names={names}
        onClose={closeLineup}
        onPlay={slot => beginChallenge(slot || challengeNextSlot(cur))}
        onEndEarly={endEarly}
      />

      <ChallengeDeclinedModal
        open={!!declinedOpen}
        challenge={declinedOpen}
        partnerName={declinedPartner}
        onClose={() => {
          if (declinedOpen?.id != null) markDeclinedSeen(declinedOpen.id);
          setDeclinedOpen(null);
        }}
      />

      <ChallengeCompleteModal
        open={!!completeOpen}
        challenge={completeOpen}
        names={names}
        onClose={() => setCompleteOpen(null)}
      />
    </ChallengeContext.Provider>
  );
}

export function useChallenge() {
  return useContext(ChallengeContext);
}
