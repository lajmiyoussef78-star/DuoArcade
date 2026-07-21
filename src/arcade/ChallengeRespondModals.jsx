// ChallengeRespondModals.jsx — opponent accept flow + shared fate reveal on the home screen.

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  GAME_LIST, celebrationLine, challengeNextSlot, gameName, overallWinner,
  pickRandomGame3, respondChallenge, scoreOf, cancelChallenge,
} from '../lib/challenges.js';
import { artFor } from '../engines/art.js';
import { ENGINES } from '../engines/index.js';

function PopShell({ title, kicker, onClose, children, compact = false }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose?.(); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="chal-pop-overlay"
      role="presentation"
      onClick={e => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div
        className={'chal-pop' + (compact ? ' chal-pop-compact' : '')}
        role="dialog"
        aria-modal="true"
        aria-labelledby="chal-resp-title"
        onClick={e => e.stopPropagation()}
      >
        <header className="chal-pop-head">
          <div>
            {kicker ? <div className="chal-pop-kicker">{kicker}</div> : null}
            <h2 id="chal-resp-title">{title}</h2>
          </div>
          {onClose ? (
            <button type="button" className="chal-pop-x" aria-label="Close" onClick={onClose}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          ) : null}
        </header>
        <div className="chal-pop-body">{children}</div>
      </div>
    </div>,
    document.body
  );
}

/** Step 1 — small stake popup for the challenged partner. */
export function ChallengeInviteModal({ open, challenge, fromName, onAccept, onDecline, onClose, busy, err }) {
  if (!open || !challenge) return null;
  return (
    <PopShell title="Challenge" kicker="Incoming" onClose={onClose} compact>
      <p className="chal-pop-lead">
        <strong>{fromName}</strong> challenged you to a best-of-three.
      </p>
      <div className="chal-pop-stake">{challenge.stake}</div>
      <p className="chal-pop-mini-note">Game 1: <strong>{gameName(challenge.game1)}</strong></p>
      <div className="chal-pop-actions">
        <button type="button" className="btn warm" disabled={busy} onClick={onAccept}>Accept</button>
        <button type="button" className="btn ghost" disabled={busy} onClick={onDecline}>Decline</button>
      </div>
      {err ? <p className="chal-pop-err">{err}</p> : null}
    </PopShell>
  );
}

/** Step 2 — pick Game 2 (same grid as the create flow). */
export function ChallengePickGameModal({ open, challenge, onPick, onBack, busy, err }) {
  if (!open || !challenge) return null;
  return (
    <PopShell title="Your game" kicker="New challenge" onClose={onBack}>
      <div className="chal-pop-stake mini">{challenge.stake}</div>
      <p className="chal-pop-lead">Pick Game 2 — fate will roll Game 3.</p>
      <div className="chal-pop-games">
        {GAME_LIST.map(g => {
          const art = artFor(g.id);
          const tag = ENGINES[g.id]?.meta?.tag || '';
          const off = g.id === challenge.game1;
          return (
            <button
              key={g.id}
              type="button"
              className={'chal-pop-gcard' + (off ? ' off' : '')}
              disabled={off || busy}
              aria-label={g.name}
              onClick={() => onPick(g.id)}
            >
              {art ? (
                <span className="chal-pop-gcard-art" aria-hidden="true" dangerouslySetInnerHTML={{ __html: art }} />
              ) : null}
              <span className="chal-pop-gcard-veil" aria-hidden="true" />
              <span className="chal-pop-gname">{g.name}</span>
              {tag ? <span className="chal-pop-gtag">{tag}</span> : null}
            </button>
          );
        })}
      </div>
      <div className="chal-pop-actions">
        <button type="button" className="btn ghost" disabled={busy} onClick={onBack}>Back</button>
      </div>
      {err ? <p className="chal-pop-err">{err}</p> : null}
    </PopShell>
  );
}

/** Shelf-style game tile for challenge lineups. */
function ChallengeShelfCard({ gameId, slot, win, names, isNext, rolling }) {
  if (!gameId && !rolling) return null;
  const art = gameId ? artFor(gameId) : null;
  const eng = gameId ? ENGINES[gameId] : null;
  let result = '—';
  if (win) result = `${names[win]} won`;
  else if (isNext) result = 'Next up';
  else if (rolling) result = 'Rolling…';
  else if (slot === 3) result = 'Fate pick';

  return (
    <div className={'chal-gcard' + (isNext ? ' next' : '') + (win ? ' done' : '')}>
      <div className="chal-gcard-slot">Game {slot}</div>
      {art ? (
        <>
          <div className="chal-gcard-art" aria-hidden="true" dangerouslySetInnerHTML={{ __html: art }} />
          <div className="chal-gcard-veil" aria-hidden="true" />
        </>
      ) : null}
      <div className="chal-gcard-name">{eng?.meta?.name || '…'}</div>
      {eng?.meta?.tag ? <div className="chal-gcard-tag">{eng.meta.tag}</div> : null}
      <div className={'chal-gcard-result' + (isNext ? ' next' : '')}>{result}</div>
    </div>
  );
}

function SlotDivider({ win, names }) {
  if (!win) {
    return (
      <div className="chal-lineup-divider" aria-hidden="true">
        <span className="chal-lineup-div-dash">—</span>
      </div>
    );
  }
  const label = names[win] || win;
  return (
    <div className="chal-lineup-divider won" title={`${label} won`}>
      <span className={'chal-lineup-div-av ' + win.toLowerCase()}>{label[0]?.toUpperCase()}</span>
      <small>{label.split(/\s+/)[0]}</small>
    </div>
  );
}

/**
 * Lineup board — fate reveal, active challenge progress, shelf-style game cards.
 */
export function ChallengeLineupModal({
  open, challenge, names = { A: 'A', B: 'B' },
  game2Override, game3Override, rolling = false,
  onClose, onPlay, onEndEarly,
}) {
  if (!open || !challenge) return null;

  const g1 = challenge.game1;
  const g2 = game2Override || challenge.game2;
  const g3 = game3Override || challenge.game3;
  const sc = scoreOf(challenge);
  const nextSlot = challenge.status === 'active' ? challengeNextSlot(challenge) : null;
  const decided = overallWinner(challenge.win1, challenge.win2, challenge.win3);
  const isFirstStart = !challenge.win1 && !challenge.win2 && !challenge.win3;

  const play = () => {
    onClose?.();
    onPlay?.(nextSlot || 1);
  };

  const playLabel = rolling
    ? null
    : decided
      ? 'Done'
      : isFirstStart
        ? "Let's play"
        : nextSlot
          ? `Play game ${nextSlot}`
          : "Let's play";

  return (
    <PopShell
      title={decided ? 'Challenge decided' : rolling ? 'Fate picks Game 3' : 'The lineup'}
      kicker={challenge.stake}
      onClose={onClose}
    >
      <div className="chal-lineup">
        <div className="chal-lineup-scoreboard">
          <span className="chal-lineup-player a">{names.A}</span>
          <span className="chal-lineup-tally">
            <strong>{sc.a}</strong>
            <em>—</em>
            <strong>{sc.b}</strong>
          </span>
          <span className="chal-lineup-player b">{names.B}</span>
        </div>

        {decided ? (
          <p className="chal-lineup-winner">
            <strong>{names[decided]}</strong> wins the challenge
          </p>
        ) : null}

        <div className="chal-lineup-row">
          <ChallengeShelfCard
            gameId={g1}
            slot={1}
            win={challenge.win1}
            names={names}
            isNext={nextSlot === 1}
          />
          <SlotDivider win={challenge.win1} names={names} />
          <ChallengeShelfCard
            gameId={g2}
            slot={2}
            win={challenge.win2}
            names={names}
            isNext={nextSlot === 2}
          />
        </div>

        {challenge.win2 ? (
          <div className="chal-lineup-midscore">
            <SlotDivider win={challenge.win2} names={names} />
          </div>
        ) : null}

        <div className="chal-lineup-g3">
          <ChallengeShelfCard
            gameId={g3}
            slot={3}
            win={challenge.win3}
            names={names}
            isNext={nextSlot === 3}
            rolling={rolling && !g3}
          />
          {!rolling && g3 && !challenge.win3 && nextSlot === 3 ? (
            <p className="chal-lineup-fate-note">Fate rolled <strong>{gameName(g3)}</strong> for the decider.</p>
          ) : null}
        </div>

        {!rolling && nextSlot && !decided ? (
          <p className="chal-lineup-next">
            Up next: <strong>Game {nextSlot}</strong> — {gameName(nextSlot === 1 ? g1 : nextSlot === 2 ? g2 : g3)}
          </p>
        ) : null}

        {!rolling ? (
          <div className="chal-pop-actions">
            {playLabel ? (
              <button
                type="button"
                className="btn warm"
                onClick={decided ? onClose : play}
              >
                {playLabel}
              </button>
            ) : null}
            {challenge.status === 'active' && !decided && onEndEarly ? (
              <button type="button" className="btn ghost" onClick={() => onEndEarly(challenge)}>
                End challenge early
              </button>
            ) : null}
          </div>
        ) : (
          <p className="chal-lineup-rolling">Rolling Game 3…</p>
        )}
      </div>
    </PopShell>
  );
}

/** Back-compat alias — prefer ChallengeLineupModal with a full challenge object. */
export function ChallengeFateModal({ open, game1, game2, game3, rolling, onClose, onPlay, challenge }) {
  const stub = challenge || {
    stake: '',
    game1, game2, game3,
    status: 'active',
    win1: null, win2: null, win3: null,
  };
  return (
    <ChallengeLineupModal
      open={open}
      challenge={stub}
      game3Override={game3}
      rolling={rolling}
      onClose={onClose}
      onPlay={() => onPlay?.()}
    />
  );
}

/** Shown when the challenged partner declines — host only. */
export function ChallengeDeclinedModal({ open, challenge, partnerName, onClose }) {
  if (!open || !challenge) return null;
  return (
    <PopShell title="Challenge declined" kicker="Your invite" onClose={onClose} compact>
      <p className="chal-pop-lead">
        <strong>{partnerName}</strong> declined your challenge.
      </p>
      <div className="chal-pop-stake mini">{challenge.stake}</div>
      <div className="chal-pop-actions">
        <button type="button" className="btn warm" onClick={onClose}>OK</button>
      </div>
    </PopShell>
  );
}

/** Auto-opens the lineup for both partners when accepted and after each round. */
export function useChallengeLineupBoard({ challenge }) {
  const [open, setOpen] = useState(false);
  const seenSigRef = useRef(null);

  const sig = challenge?.status === 'active' && challenge?.game3
    ? `${challenge.id}|${challenge.win1 ?? '-'}|${challenge.win2 ?? '-'}|${challenge.win3 ?? '-'}`
    : null;

  useEffect(() => {
    if (!sig) return;
    if (seenSigRef.current === sig) return;
    seenSigRef.current = sig;
    setOpen(true);
  }, [sig]);

  const close = useCallback(() => setOpen(false), []);
  const openManual = useCallback(() => setOpen(true), []);

  return { open, close, openManual };
}

/** Shown when the best-of-three is decided — stays on the home screen. */
export function ChallengeCompleteModal({ open, challenge, names, onClose }) {
  if (!open || !challenge?.overall_winner) return null;
  const winner = names[challenge.overall_winner] || challenge.overall_winner;
  const loser = names[challenge.overall_winner === 'A' ? 'B' : 'A'] || '?';
  const line = celebrationLine(challenge.stake, winner, loser);
  return (
    <PopShell title="Challenge complete" kicker="Best of three" onClose={onClose} compact>
      <p className="chal-pop-lead">{line}</p>
      <div className="chal-pop-actions">
        <button type="button" className="btn warm" onClick={onClose}>Done</button>
      </div>
    </PopShell>
  );
}

/** Wires invite → pick → fate for the challenged partner. */
export function useChallengeRespondFlow({ code, challenge, myRole, onRefresh, onChallenge }) {
  const [step, setStep] = useState(null); // null | invite | pick | fate
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [fateGame, setFateGame] = useState(null);
  const [game2Pick, setGame2Pick] = useState(null);
  const [rolling, setRolling] = useState(false);
  const fateTimer = useRef(null);
  const dismissedRef = useRef(null);
  const prevChallengeId = useRef(null);

  const isReceiver = challenge?.status === 'pending' && challenge.created_by !== myRole;

  useEffect(() => {
    if (challenge?.id && prevChallengeId.current != null && prevChallengeId.current !== challenge.id) {
      dismissedRef.current = null;
    }
    if (challenge?.id) prevChallengeId.current = challenge.id;
  }, [challenge?.id]);

  useEffect(() => {
    if (!isReceiver) {
      setStep(null);
      return;
    }
    if (dismissedRef.current === challenge.id) return;
    setStep(s => (s === 'fate' ? s : 'invite'));
  }, [isReceiver, challenge?.id]);

  useEffect(() => () => {
    if (fateTimer.current) clearInterval(fateTimer.current);
  }, []);

  const dismiss = () => {
    if (challenge?.id) dismissedRef.current = challenge.id;
    setStep(null);
    setErr('');
  };

  const openInvite = () => {
    if (!isReceiver) return;
    dismissedRef.current = null;
    setStep('invite');
    setErr('');
  };

  const decline = async () => {
    if (!challenge) return;
    setBusy(true);
    setErr('');
    try {
      const updated = await respondChallenge(challenge.id, false);
      onChallenge?.(updated, 'declined');
      dismiss();
      await onRefresh?.();
    } catch (e) {
      setErr(e.message || 'Could not decline');
    } finally {
      setBusy(false);
    }
  };

  const acceptInvite = () => {
    setErr('');
    setStep('pick');
  };

  const pickGame = g2 => {
    if (!challenge || g2 === challenge.game1) return;
    setGame2Pick(g2);
    setStep('fate');
    setRolling(true);
    setFateGame(null);
    setErr('');
    const ids = GAME_LIST.map(g => g.id);
    const pool = ids.filter(id => id !== challenge.game1 && id !== g2);
    let ticks = 0;
    if (fateTimer.current) clearInterval(fateTimer.current);
    fateTimer.current = setInterval(() => {
      const i = Math.floor(Math.random() * pool.length);
      setFateGame(pool[i] || null);
      ticks += 1;
      if (ticks >= 12) {
        clearInterval(fateTimer.current);
        fateTimer.current = null;
        const g3 = pickRandomGame3(ids, challenge.game1, g2);
        setFateGame(g3);
        setRolling(false);
        (async () => {
          setBusy(true);
          try {
            const updated = await respondChallenge(challenge.id, true, g2, g3);
            onChallenge?.(updated, 'accepted');
            await onRefresh?.();
          } catch (e) {
            setErr(e.message || 'Could not accept challenge');
            setStep('pick');
          } finally {
            setBusy(false);
          }
        })();
      }
    }, 90);
  };

  const closeFate = () => {
    dismiss();
    setFateGame(null);
    setGame2Pick(null);
    setRolling(false);
  };

  return {
    step,
    busy,
    err,
    fateGame,
    game2Pick,
    rolling,
    isReceiver,
    openInvite,
    dismiss,
    decline,
    acceptInvite,
    pickGame,
    closeFate,
    backToInvite: () => setStep('invite'),
  };
}
