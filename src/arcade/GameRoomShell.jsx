// GameRoomShell — co-op room chrome (matchup | players + chat).
import { useState } from 'react';
import { other } from '../lib/util.js';
import { PlayerCard } from './GameLobby.jsx';
import RoomChat from './RoomChat.jsx';
import '../styles/game-room.css';

const RAIL_HIDE_KEY = 'duoarcade.grRailHidden';

function readRailHidden() {
  try { return localStorage.getItem(RAIL_HIDE_KEY) === '1'; }
  catch { return false; }
}

function FullscreenIcon({ exit }) {
  if (exit) {
    return (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
        <path d="M9 3H5a2 2 0 0 0-2 2v4M15 3h4a2 2 0 0 1 2 2v4M9 21H5a2 2 0 0 1-2-2v-4M15 21h4a2 2 0 0 0 2-2v-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
      <path d="M9 3H5a2 2 0 0 0-2 2v4M15 3h4a2 2 0 0 1 2 2v4M9 21H5a2 2 0 0 1-2-2v-4M15 21h4a2 2 0 0 0 2-2v-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function LeaveIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true">
      <path d="M10 5H6.5A1.5 1.5 0 0 0 5 6.5v11A1.5 1.5 0 0 0 6.5 19H10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M13 12h7M16.5 8.5 20 12l-3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
      <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v16.5H7.5A2.5 2.5 0 0 0 5 22" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M5 5.5V22" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function GameBadge({ gameId }) {
  if (gameId === 'ttt') {
    return (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
        <rect x="3.5" y="3.5" width="17" height="17" rx="3" stroke="currentColor" strokeWidth="1.6" />
        <path d="M3.5 10.5h17M3.5 15.5h17M10.5 3.5v17M15.5 3.5v17" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="4" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="9" cy="9" r="1.4" fill="currentColor" />
      <circle cx="15" cy="15" r="1.4" fill="currentColor" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
      <path d="M6 12h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function RailTabIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <circle cx="6" cy="12" r="1.85" />
      <circle cx="12" cy="12" r="1.85" />
      <circle cx="18" cy="12" r="1.85" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
      <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * @param {object} props
 * @param {object} props.duo
 * @param {'A'|'B'} props.myRole
 * @param {'A'|'B'} props.hostRole
 * @param {object} props.eng
 * @param {{ avatar_a?: string|null, avatar_b?: string|null }} props.avatars
 * @param {(role:'A'|'B') => boolean} props.isAway
 * @param {() => void} props.onBack
 * @param {() => void} [props.onOpenRules]
 * @param {boolean} props.isFullscreen
 * @param {() => void} props.onToggleFullscreen
 * @param {string} [props.code]
 * @param {string|null} [props.userId]
 * @param {string|null} [props.roomId]
 * @param {boolean} [props.guestWaiting]
 * @param {boolean} [props.canPause]
 * @param {boolean} [props.paused]
 * @param {boolean} [props.pauseDisabled]
 * @param {string} [props.pauseLabel]
 * @param {() => void} [props.onRequestPause]
 * @param {import('react').ReactNode} [props.pauseOverlay]
 * @param {import('react').ReactNode} props.children
 */
export default function GameRoomShell({
  duo,
  myRole,
  hostRole,
  eng,
  avatars,
  isAway,
  onBack,
  onOpenRules,
  isFullscreen,
  onToggleFullscreen,
  code,
  userId,
  roomId,
  guestWaiting = false,
  canPause = false,
  paused = false,
  pauseDisabled = false,
  pauseLabel = 'Request pause',
  onRequestPause,
  pauseOverlay = null,
  children,
}) {
  const [railHidden, setRailHidden] = useState(readRailHidden);
  const toggleRail = () => {
    setRailHidden(prev => {
      const next = !prev;
      try { localStorage.setItem(RAIL_HIDE_KEY, next ? '1' : '0'); } catch { /* */ }
      return next;
    });
  };

  const nameA = duo.nameA || 'A';
  const nameB = duo.nameB || 'B';
  const hostName = hostRole === 'A' ? nameA : nameB;
  const guestRole = other(hostRole);
  const guestName = guestRole === 'A' ? nameA : nameB;
  const hostAvatar = hostRole === 'A' ? avatars.avatar_a : avatars.avatar_b;
  const guestAvatar = guestRole === 'A' ? avatars.avatar_a : avatars.avatar_b;
  const guestOnline = !guestWaiting && !isAway(guestRole);
  const hostOnline = !isAway(hostRole);
  const filled = 2; // invite reserved = seat held (shows 2/2 while pending)

  const phase = duo?.session?.phase;
  const readyMap = duo?.session?.ready || {};
  const live = phase === 'live';

  const seatStatus = (role, online) => {
    if (!online) return 'offline';
    if (live) return 'playing';
    if (phase === 'lobby') return readyMap[role] ? 'ready' : 'waiting';
    // Invite wait: host is primed; guest uses Invited role instead of status.
    return 'ready';
  };

  const hostStatus = seatStatus(hostRole, hostOnline);
  const guestStatus = guestWaiting ? null : seatStatus(guestRole, guestOnline);

  const hideRail = railHidden || isFullscreen;

  return (
    <div
      className={
        'gr-shell'
        + (hideRail ? ' gr-shell-rail-off' : '')
        + (isFullscreen ? ' gr-shell-fs' : '')
      }
    >
      {!isFullscreen && (
        <header className="gr-top">
          <button type="button" className="gr-leave" onClick={onBack}>
            <LeaveIcon />
            <span>Leave Room</span>
          </button>

          <div className="gr-title-block">
            <span className="gr-game-badge" aria-hidden="true">
              <GameBadge gameId={eng?.meta?.id} />
            </span>
            <div className="gr-title-copy">
              <h2 className="gr-title">{eng?.meta?.name || 'Game'}</h2>
              {eng?.meta?.tag && <p className="gr-tag">{eng.meta.tag}</p>}
            </div>
          </div>

          <div className="gr-top-actions">
            {canPause && onRequestPause && (
              <button
                type="button"
                className={'gr-iconbtn' + (paused ? ' on' : '')}
                onClick={onRequestPause}
                title={pauseLabel}
                aria-label={pauseLabel}
              >
                {paused ? (
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                    <path d="M8 5.5v13l11-6.5L8 5.5Z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                    <rect x="6" y="5" width="4" height="14" rx="1" />
                    <rect x="14" y="5" width="4" height="14" rx="1" />
                  </svg>
                )}
              </button>
            )}
            <button
              type="button"
              className="gr-iconbtn"
              onClick={onToggleFullscreen}
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              <FullscreenIcon exit={isFullscreen} />
            </button>
          </div>
        </header>
      )}

      <div className="gr-body">
        <main className="gr-center">
          <div className="gr-viewport">
            {railHidden && !isFullscreen && (
              <button
                type="button"
                className="gr-rail-tab"
                onClick={toggleRail}
                title="Show side panel"
                aria-label="Show side panel"
              >
                <RailTabIcon />
              </button>
            )}
            <div className="gr-viewport-inner">
              {children}
            </div>
            {pauseOverlay}
          </div>
        </main>

        {!hideRail && (
          <aside className="gr-rail gr-rail-right">
            <div className="gr-sidepanel">
              <button
                type="button"
                className="gr-rail-hide"
                onClick={toggleRail}
                title="Hide side panel"
                aria-label="Hide side panel"
              >
                <MinusIcon />
              </button>

              <section className="gr-side-block">
                <h3 className="gr-side-title">Players ({filled}/2)</h3>
                <div className="gr-player-list">
                  <PlayerCard
                    name={hostRole === myRole ? `${hostName} (You)` : hostName}
                    avatarId={hostAvatar}
                    role="host"
                    status={hostStatus}
                  />
                  <PlayerCard
                    name={guestWaiting ? (guestName || 'Invited') : (guestRole === myRole ? `${guestName} (You)` : guestName)}
                    avatarId={guestAvatar}
                    role={guestWaiting ? 'invited' : 'guest'}
                    status={guestWaiting ? null : guestStatus}
                    placeholder={false}
                    dimmed={guestWaiting}
                  />
                </div>
              </section>

              <RoomChat
                code={code}
                roomId={roomId}
                userId={userId}
                myRole={myRole}
                duo={duo}
                avatars={avatars}
              />

              {onOpenRules && (
                <button type="button" className="gr-howto" onClick={onOpenRules}>
                  <span className="gr-howto-left">
                    <BookIcon />
                    <span>How to Play</span>
                  </span>
                  <ChevronIcon />
                </button>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
