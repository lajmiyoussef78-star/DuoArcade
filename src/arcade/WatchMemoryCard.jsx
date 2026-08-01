import { Confetti } from './CoupleFx.jsx';

/** Shared post-watch Memory / afterglow card for YouTube, Reels, Movie. */
export default function WatchMemoryCard({
  memory, partnerName, afterglowQs = [], onDone, onDismiss,
}) {
  if (!memory) return null;
  const mins = Math.max(1, Math.round((memory.durationSec || 0) / 60));
  const bothStars = memory.starsA != null && memory.starsB != null;
  const agree = bothStars && Math.abs(memory.starsA - memory.starsB) <= 1;

  return (
    <div className="wp-memory on">
      {agree && <div className="wp-memory-fx"><Confetti count={22} small /></div>}
      <div className="wp-memory-kicker">Tonight’s memory</div>
      <h3 className="wp-memory-title">{memory.title || 'Our night'}</h3>
      <p className="wp-memory-meta">
        ~{mins} min together
        {memory.bestReaction ? <> {'·'} best reaction {memory.bestReaction}</> : null}
      </p>
      {bothStars && (
        <p className="wp-memory-stars">
          You {memory.starsA}★ {'·'} {partnerName} {memory.starsB}★
        </p>
      )}
      {memory.insight && <p className="wp-memory-insight">{memory.insight}</p>}
      {afterglowQs?.length > 0 && (
        <div className="wp-afterglow">
          <div className="wp-afterglow-label">Afterglow</div>
          {afterglowQs.slice(0, 2).map((q, i) => (
            <p key={i} className="wp-afterglow-q">{q}</p>
          ))}
        </div>
      )}
      <div className="row wp-memory-actions">
        <button type="button" className="btn warm small" onClick={onDone}>Save & leave</button>
        {onDismiss && (
          <button type="button" className="btn ghost small" onClick={onDismiss}>Stay a moment</button>
        )}
      </div>
    </div>
  );
}
