/** Soft toast when partner starts a watch mode — Join focuses the shared room. */
export default function WatchInviteToast({ duo, myRole, onJoin, onDismiss }) {
  const s = duo?.session;
  if (!s || !['watch', 'reels', 'movie', 'streaming'].includes(s.type)) return null;
  if (s.by === myRole) return null;
  if (!s.startedAt || Date.now() - s.startedAt > 45000) return null;
  if (s._inviteDismissed) return null;

  const who = s.by === 'A' ? (duo.nameA || 'Partner') : (duo.nameB || 'Partner');
  const streamLabel = s.platform === 'netflix' ? 'Netflix Night'
    : s.platform === 'disney_plus' ? 'Disney+ Night'
    : s.platform === 'max' ? 'Max Night'
    : s.platform === 'prime_video' ? 'Prime Night'
    : 'Streaming Night';
  const label = s.type === 'reels' ? 'Reels Party'
    : s.type === 'movie' ? 'Movie Night'
    : s.type === 'streaming' ? streamLabel
    : s.interactive?.on ? 'Sparks night' : 'YouTube Night';

  return (
    <div className="wp-invite-toast" role="status">
      <div className="wp-invite-text">
        <b>{who}</b> started {label}
      </div>
      <div className="wp-invite-actions">
        <button type="button" className="btn warm small" onClick={onJoin}>Join</button>
        <button type="button" className="btn ghost small" onClick={onDismiss}>Later</button>
      </div>
    </div>
  );
}
