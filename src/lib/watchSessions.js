// watchSessions.js — slim WatchParty session envelopes (~2–4KB).
// Durable queues / favorites / comments live in tables, not here.

const EMPTY_RATINGS = { A: null, B: null };

/** YouTube Night */
export function buildWatchSession({ videoId, by, interactive = false }) {
  return {
    type: 'watch',
    phase: 'playing',
    playing: false,
    position: 0,
    at: Date.now(),
    by,
    ratings: { ...EMPTY_RATINGS },
    mediaRef: { kind: 'youtube', id: videoId },
    videoId, // kept for WatchScreen compat
    interactive: interactive
      ? { on: true, mode: 'quick', promptId: null, phase: 'idle' }
      : { on: false },
    startedAt: Date.now(),
    memory: null,
  };
}

/** Reels Party — queue capped client-side (~30); envelope holds index + playhead. */
export function buildReelsSession({ by, queue = [] }) {
  const q = (queue || []).slice(0, 30);
  return {
    type: 'reels',
    phase: 'playing',
    playing: true,
    position: 0,
    at: Date.now(),
    by,
    index: 0,
    queue: q,
    likes: {}, // clipId -> { A?: at, B?: at }
    laugh: { A: 0, B: 0 },
    ratings: { ...EMPTY_RATINGS },
    mediaRef: { kind: 'reels', id: q[0]?.id || null },
    interactive: { on: false },
    startedAt: Date.now(),
    memory: null,
  };
}

/** Movie Night dual-local */
export function buildMovieSession({ by, fingerprint, title, sizeLabel }) {
  return {
    type: 'movie',
    phase: 'lobby', // lobby → playing → verdict → afterglow
    playing: false,
    position: 0,
    at: Date.now(),
    by,
    fingerprint: fingerprint || null,
    title: title || 'Our film',
    sizeLabel: sizeLabel || '',
    ready: { A: false, B: false },
    ratings: { ...EMPTY_RATINGS },
    mediaRef: { kind: 'local', id: fingerprint || null },
    interactive: { on: false },
    nightId: null, // set when continuity row exists
    startedAt: Date.now(),
    memory: null,
  };
}

/** Streaming Services — L3 coordination; L2+ via extension bridge. */
export function buildStreamingSession({ by, platform = null }) {
  return {
    type: 'streaming',
    phase: 'lobby', // lobby → playing → verdict → afterglow
    platform: platform || null, // netflix | disney_plus | max | prime_video
    capability: 3, // honest default: coordination only
    media: {
      type: 'unknown',
      title: '',
      url: null,
      externalId: null,
      season: null,
      episode: null,
    },
    playing: false,
    position: 0,
    at: Date.now(),
    by,
    ready: { A: false, B: false },
    bridge: { A: 'none', B: 'none' },
    ratings: { ...EMPTY_RATINGS },
    mediaRef: { kind: 'streaming', id: platform || null },
    interactive: { on: false },
    startedAt: Date.now(),
    memory: null,
  };
}

export function isWatchSession(s) {
  return s && (
    s.type === 'watch' || s.type === 'reels' || s.type === 'movie' || s.type === 'streaming'
  );
}

export function watchBusyLabel(s) {
  if (!s) return null;
  if (s.type === 'watch') return s.interactive?.on ? 'Sparks night' : 'YouTube Night';
  if (s.type === 'reels') return 'Reels Party';
  if (s.type === 'movie') return 'Movie Night';
  if (s.type === 'streaming') {
    if (s.platform === 'netflix') return 'Netflix Night';
    if (s.platform === 'disney_plus') return 'Disney+ Night';
    if (s.platform === 'max') return 'Max Night';
    if (s.platform === 'prime_video') return 'Prime Night';
    return 'Streaming Night';
  }
  return 'Watching together';
}

export function watchModeTitle(s) {
  if (!s) return 'Watch';
  if (s.type === 'watch') return 'YouTube Night';
  if (s.type === 'reels') return 'Reels Party';
  if (s.type === 'movie') return 'Movie Night';
  if (s.type === 'streaming') {
    if (s.platform === 'netflix') return 'Netflix Night';
    if (s.platform === 'disney_plus') return 'Disney+ Night';
    if (s.platform === 'max') return 'Max Night';
    if (s.platform === 'prime_video') return 'Prime Night';
    return 'Streaming Night';
  }
  return 'Watch party';
}

/** Build a Memory card payload after both rated (or night ended). */
export function buildMemoryCard({
  title, durationSec, starsA, starsB, bestReaction, mode, insight,
}) {
  return {
    title: title || 'Tonight',
    durationSec: durationSec || 0,
    starsA: starsA ?? null,
    starsB: starsB ?? null,
    bestReaction: bestReaction || null,
    mode: mode || 'watch',
    insight: insight || null,
    at: Date.now(),
  };
}
