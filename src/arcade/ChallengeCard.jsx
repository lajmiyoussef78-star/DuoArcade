// ChallengeCard.jsx — home-screen challenge CTA (arena-entry style).

import { useChallenge } from './ChallengeContext.jsx';
import '../styles/challenges.css';

export default function ChallengeCard() {
  const ctx = useChallenge();
  if (!ctx) return null;

  const {
    title, sub, liveOn, iAmCreatorWaiting, cancelling,
    onCardClick, cancelPending,
  } = ctx;

  return (
    <div
      className={'chal-entry' + (liveOn ? ' live' : '')}
      id="sect-challenges"
    >
      <button type="button" className="chal-entry-hit" onClick={onCardClick}>
        <div className="chal-entry-copy">
          <h3>{title}</h3>
          <p>{sub}</p>
        </div>
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
  );
}
