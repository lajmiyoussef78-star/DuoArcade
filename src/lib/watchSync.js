// watchSync.js — one playhead semantics module for YouTube / Reels / Movie / Streaming.
// Heartbeat, drift thresholds, echo ignore, remote-lock window.
// Durable playhead commits go through update_duo; ephemeral events use watchBroadcast.
// Streaming L3 ignores playhead; L2+ uses coarser drift via kind 'streaming'.

/** Drift (seconds) before we seek to catch up. */
export const DRIFT = {
  watch: 2,
  reels: 1.5,
  movie: 0.5,
  streaming: 4,
};

/** Silent remote-lock after partner seek/swipe (ms). No UI settings. */
export const REMOTE_LOCK_MS = {
  watch: 500,
  reels: 3000,
  movie: 800,
  streaming: 800,
};

export const HEARTBEAT_MS = 5000;

/** Expected playhead from session envelope (playing extrapolates from `at`). */
export function expectedPosition(sess, now = Date.now()) {
  if (!sess) return 0;
  const pos = Number(sess.position) || 0;
  if (!sess.playing) return pos;
  const at = Number(sess.at) || now;
  return pos + Math.max(0, now - at) / 1000;
}

/** True when local clock and remote envelope disagree beyond kind threshold. */
export function needsSeek(localTime, sess, kind = 'watch', now = Date.now()) {
  const drift = DRIFT[kind] ?? DRIFT.watch;
  return Math.abs((Number(localTime) || 0) - expectedPosition(sess, now)) > drift;
}

/**
 * Should we apply a remote playhead update?
 * Ignores our own echo (`by === myRole`) and recent remote-lock window.
 */
export function shouldApplyRemote(sess, myRole, lockUntil = 0, now = Date.now()) {
  if (!sess) return false;
  if (sess.by === myRole) return false;
  if (now < lockUntil) return false;
  return true;
}

/** Merge playhead fields into a slim session (caller persists via update_duo). */
export function playheadPatch({ playing, position, at, by }, extra = {}) {
  return {
    playing: !!playing,
    position: Math.max(0, Number(position) || 0),
    at: at || Date.now(),
    by: by || null,
    ...extra,
  };
}

/**
 * Decide whether a local player state change should be committed.
 * Debounces rapid flips; treats seeks while same play/pause as commits.
 */
export function shouldCommitLocal({
  playing,
  localTime,
  sess,
  lastPushedAt,
  now = Date.now(),
  minIntervalMs = 350,
  kind = 'watch',
}) {
  if (!sess) return false;
  if (now - (lastPushedAt || 0) < minIntervalMs) return false;
  const samePlay = playing === !!sess.playing;
  const seeked = needsSeek(localTime, sess, kind, now);
  if (samePlay && !seeked) return false;
  return true;
}

/** Heartbeat tick: only the last actor, only while playing. */
export function shouldHeartbeat(sess, myRole) {
  if (!sess || !sess.playing) return false;
  if (sess.by !== myRole) return false;
  if (sess.phase && sess.phase !== 'playing') return false;
  return true;
}

/**
 * Apply remote playhead to a media element / YT player adapter.
 * `adapter` = { getCurrentTime, seekTo, play, pause, getPlaying? }
 */
export function applyRemotePlayhead(adapter, sess, kind = 'watch') {
  if (!adapter || !sess) return;
  const target = expectedPosition(sess);
  if (needsSeek(adapter.getCurrentTime?.() ?? 0, sess, kind)) {
    adapter.seekTo?.(target, true);
  }
  if (sess.playing) adapter.play?.();
  else adapter.pause?.();
}

/** Build / refresh ui.remoteLockUntil after a partner-driven seek or swipe. */
export function remoteLockUntil(kind = 'watch', now = Date.now()) {
  return now + (REMOTE_LOCK_MS[kind] ?? REMOTE_LOCK_MS.watch);
}
