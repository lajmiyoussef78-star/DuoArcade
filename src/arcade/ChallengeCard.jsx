// ChallengeCard.jsx — home-screen challenge CTA (arena-entry style).

import { useCallback, useEffect, useState } from 'react';
import {
  cancelChallenge, challengeChannel, challengeNextSlot, duoNames, getChallenges, scoreOf,
} from '../lib/challenges.js';
import ChallengeCreateModal from './ChallengeCreateModal.jsx';
import {
  ChallengeCompleteModal,
  ChallengeLineupModal,
  ChallengeInviteModal,
  ChallengePickGameModal,
  useChallengeFateReveal,
  useChallengeRespondFlow,
} from './ChallengeRespondModals.jsx';
import '../styles/challenges.css';

function live(list) {
  return (list || []).find(c => c.status === 'pending' || c.status === 'active') || null;
}

function DuelMark() {
  return (
    <svg className="chal-entry-mark" viewBox="0 0 48 48" width="44" height="44" aria-hidden="true">
      <circle className="chal-entry-mark-bg" cx="24" cy="24" r="22" />
      <path
        className="chal-entry-mark-stroke"
        d="M14 34 L20 14 L24 20 L28 14 L34 34"
        fill="none"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle className="chal-entry-dot a" cx="18" cy="30" r="2.2" />
      <circle className="chal-entry-dot b" cx="30" cy="30" r="2.2" />
    </svg>
  );
}

export default function ChallengeCard({ code, myRole, onStartChallengeGame }) {
  const [cur, setCur] = useState(null);
  const [names, setNames] = useState({ A: 'A', B: 'B' });
  const [createOpen, setCreateOpen] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const rows = await getChallenges(code);
      setCur(live(rows));
    } catch (_) {
      setCur(null);
    }
  }, [code]);

  const closeCreate = useCallback(() => setCreateOpen(false), []);

  const respond = useChallengeRespondFlow({ code, challenge: cur, myRole, onRefresh: refresh });
  const creatorFate = useChallengeFateReveal({ challenge: cur });

  useEffect(() => {
    if (!code) return undefined;
    let alive = true;
    let ch = null;
    (async () => {
      try {
        setNames(await duoNames(code));
        const rows = await getChallenges(code);
        if (alive) setCur(live(rows));
      } catch (_) {
        if (alive) setCur(null);
      }
      try {
        ch = await challengeChannel(code);
        if (!alive) { ch.close(); return; }
        ch.on(async m => {
          if (m?.k !== 'chal') return;
          try {
            const rows = await getChallenges(code);
            if (alive) setCur(live(rows));
          } catch (_) { /* ignore */ }
        });
      } catch (_) { /* ignore */ }
    })();
    return () => {
      alive = false;
      ch?.close();
    };
  }, [code]);

  useEffect(() => {
    const onUpdate = e => { if (e.detail) setCur(e.detail.status === 'done' ? null : e.detail); };
    const onDone = e => {
      if (e.detail) {
        setCur(null);
        setBoardOpen(false);
        setCompleteOpen(e.detail);
      }
    };
    window.addEventListener('duoarcade-challenge-update', onUpdate);
    window.addEventListener('duoarcade-challenge-done', onDone);
    return () => {
      window.removeEventListener('duoarcade-challenge-update', onUpdate);
      window.removeEventListener('duoarcade-challenge-done', onDone);
    };
  }, []);

  if (!code) return null;

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

  const beginChallenge = slot => {
    if (!cur || cur.status !== 'active') return;
    creatorFate.close();
    respond.closeFate();
    setBoardOpen(false);
    onStartChallengeGame?.(cur, slot || 1);
  };

  const endEarly = async challenge => {
    if (!challenge?.id) return;
    if (!window.confirm('End this challenge now? No winner will be recorded.')) return;
    try {
      await cancelChallenge(challenge.id);
      setBoardOpen(false);
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

  const onClick = () => {
    if (cur?.status === 'active') {
      setBoardOpen(true);
      return;
    }
    if (liveOn) {
      if (iAmReceiver) respond.openInvite();
      return;
    }
    setCreateOpen(true);
  };

  return (
    <>
      <div
        className={'chal-entry' + (liveOn ? ' live' : '')}
        id="sect-challenges"
      >
        <button type="button" className="chal-entry-hit" onClick={onClick}>
          <DuelMark />
          <div className="chal-entry-copy">
            <h3>{title}</h3>
            <p>{sub}</p>
          </div>
          {!iAmCreatorWaiting ? (
            <strong className="chal-entry-arrow" aria-hidden="true">→</strong>
          ) : null}
        </button>
        {iAmCreatorWaiting ? (
          <button
            type="button"
            className="chal-entry-cancel"
            disabled={cancelling}
            onClick={cancelPending}
          >
            {cancelling ? '…' : 'Cancel'}
          </button>
        ) : null}
      </div>

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
        open={respond.step === 'fate'}
        challenge={cur}
        names={names}
        game2Override={respond.game2Pick}
        game3Override={respond.fateGame || cur?.game3}
        rolling={respond.rolling}
        onClose={respond.closeFate}
        onPlay={beginChallenge}
      />

      <ChallengeLineupModal
        open={creatorFate.open && respond.step !== 'fate'}
        challenge={cur}
        names={names}
        onClose={creatorFate.close}
        onPlay={beginChallenge}
      />

      <ChallengeLineupModal
        open={boardOpen && cur?.status === 'active'}
        challenge={cur}
        names={names}
        onClose={() => setBoardOpen(false)}
        onPlay={slot => beginChallenge(slot || challengeNextSlot(cur))}
        onEndEarly={endEarly}
      />

      <ChallengeCompleteModal
        open={!!completeOpen}
        challenge={completeOpen}
        names={names}
        onClose={() => setCompleteOpen(null)}
      />
    </>
  );
}
