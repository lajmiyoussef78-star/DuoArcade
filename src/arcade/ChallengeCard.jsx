// ChallengeCard.jsx — home-screen challenge CTA (arena-entry style).

import { Link } from 'react-router-dom';
import { useChallenge } from './ChallengeContext.jsx';
import '../styles/challenges.css';

function DuelMark() {
  return (
    <svg className="chal-entry-mark" viewBox="0 0 48 48" width="36" height="36" aria-hidden="true">
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

export default function ChallengeCard() {
  const ctx = useChallenge();
  if (!ctx) return null;

  const {
    title, sub, liveOn, iAmCreatorWaiting, cancelling,
    onCardClick, cancelPending,
  } = ctx;

  return (
    <>
      <div
        className={'chal-entry' + (liveOn ? ' live' : '')}
        id="sect-challenges"
      >
        <button type="button" className="chal-entry-hit" onClick={onCardClick}>
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
      <Link className="chal-history-link" to="/app/place/sect-challenge-history">
        View challenge history →
      </Link>
    </>
  );
}
