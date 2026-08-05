// Game lobby primitives — Ultimate Tic-Tac-Toe / co-op room UI pieces.
import { Avatar } from './avatars.jsx';

export function StatusBadge({ status }) {
  const label =
    status === 'playing' ? 'Playing'
      : status === 'ready' ? 'Ready'
        : status === 'waiting' || status === 'pending' ? 'Waiting'
          : status === 'invited' ? 'Invited'
            : 'Offline';
  const tone =
    status === 'playing' ? 'playing'
      : status === 'ready' ? 'ready'
        : status === 'waiting' || status === 'pending' || status === 'invited' ? 'wait'
          : 'offline';
  return <span className={'gr-status-badge ' + tone}>{label}</span>;
}

export function RoleBadge({ role }) {
  if (role === 'host') {
    return (
      <span className="gr-role-badge host">
        <CrownIcon />
        Host
      </span>
    );
  }
  if (role === 'invited') {
    return <span className="gr-role-badge invited">Invited</span>;
  }
  return <span className="gr-role-badge guest">Guest</span>;
}

export function PlayerCard({
  name,
  subtitle,
  avatarId,
  role,
  status,
  large = false,
  placeholder = false,
  dimmed = false,
}) {
  const size = large ? 72 : 44;
  return (
    <div className={
      'gr-player-card'
      + (large ? ' large' : '')
      + (placeholder ? ' placeholder' : '')
      + (dimmed ? ' dimmed' : '')
    }
    >
      <div className={
        'gr-player-card-av'
        + (role === 'host' ? ' host' : ' guest')
        + (placeholder ? ' empty' : '')
        + (dimmed ? ' pending' : '')
      }
      >
        {placeholder ? (
          <span className="gr-player-q">?</span>
        ) : (
          <Avatar id={avatarId} size={size} fallback={(name || '?')[0]?.toUpperCase()} />
        )}
      </div>
      <div className="gr-player-card-meta">
        <div className="gr-player-card-name">{name}</div>
        {subtitle && <div className="gr-player-card-sub">{subtitle}</div>}
        <div className="gr-player-card-tags">
          {role && <RoleBadge role={role} />}
          {status && <StatusBadge status={status} />}
        </div>
      </div>
    </div>
  );
}

export function ChatEmpty({ tab = 'chat' }) {
  return (
    <div className="gr-chat-empty">
      <span className="gr-chat-empty-ico" aria-hidden="true">
        {tab === 'activities' ? <ActivityIcon /> : <ChatBubbleIcon />}
      </span>
      <p className="gr-chat-empty-title">
        {tab === 'activities' ? 'No activities yet' : 'No messages yet'}
      </p>
      <p className="gr-chat-empty-sub">
        {tab === 'activities'
          ? 'Match events will show up here once you start.'
          : 'Start the conversation'}
      </p>
    </div>
  );
}

/**
 * Center invite-wait hero: status label, VS matchup, info, cancel, auto-ready.
 */
export function InviteWaitHero({
  hostName,
  hostAvatar,
  guestName,
  guestAvatar,
  partnerName,
  onCancel,
  autoReadyOnAccept = true,
  onAutoReadyChange,
}) {
  return (
    <div className="gv-lobby">
      <div className="gv-lobby-card">
        <div className="gv-lobby-status">
          <span className="gv-lobby-status-ico" aria-hidden="true"><HourglassMini /></span>
          <span>Waiting for opponent</span>
        </div>

        <div className="gv-lobby-matchup">
          <div className="gv-lobby-seat">
            <div className="gv-lobby-av host">
              <Avatar id={hostAvatar} size={88} fallback={(hostName || '?')[0]?.toUpperCase()} />
            </div>
            <div className="gv-lobby-seat-name">{hostName}</div>
            <div className="gv-lobby-seat-tags">
              <RoleBadge role="host" />
            </div>
          </div>

          <div className="gv-lobby-vs" aria-hidden="true">
            <span>VS</span>
          </div>

          <div className="gv-lobby-seat">
            <div className="gv-lobby-av guest pending">
              <Avatar
                id={guestAvatar}
                size={88}
                fallback={(partnerName || guestName || '?')[0]?.toUpperCase()}
              />
            </div>
            <div className="gv-lobby-seat-name dim">{partnerName || guestName || 'Player 2'}</div>
            <div className="gv-lobby-seat-tags">
              <RoleBadge role="invited" />
            </div>
          </div>
        </div>

        <div className="gv-lobby-info">
          <p className="gv-lobby-info-title">Invitation sent to {partnerName}</p>
          <p className="gv-lobby-info-sub">
            {autoReadyOnAccept
              ? "You'll be marked ready as soon as they accept"
              : "We'll move to the ready lobby when they accept"}
          </p>
        </div>

        <button type="button" className="gv-lobby-cancel" onClick={onCancel}>
          Cancel Invitation
        </button>

        <label className="gv-lobby-toggle">
          <input
            type="checkbox"
            checked={!!autoReadyOnAccept}
            onChange={e => onAutoReadyChange?.(e.target.checked)}
          />
          <span className="gv-lobby-switch" aria-hidden="true" />
          <span>Auto-ready when they accept</span>
        </label>
      </div>
    </div>
  );
}

function CrownIcon() {
  return (
    <svg viewBox="0 0 24 24" width="11" height="11" fill="none" aria-hidden="true">
      <path d="M4 16.5 6.5 8l4 4.5L12 6.5l1.5 6 4-4.5 2.5 8.5H4Z" fill="currentColor" />
      <path d="M5 18.5h14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function ChatBubbleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" aria-hidden="true">
      <path
        d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7A2.5 2.5 0 0 1 16.5 16H10l-4.5 3.2V16H7.5A2.5 2.5 0 0 1 5 13.5v-7Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ActivityIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" aria-hidden="true">
      <path d="M4 12h3.5l2-5 3.5 10 2.5-5H20" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HourglassMini() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
      <path
        d="M8 4.25h8M8 19.75h8M9 4.25c0 3.6 2.4 5.1 3 7.75-.6 2.65-3 4.15-3 7.75M15 4.25c0 3.6-2.4 5.1-3 7.75.6 2.65 3 4.15 3 7.75"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
