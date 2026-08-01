// watchStreaming.js — Streaming WatchParty platforms, capability honesty, extension bind.
// DuoArcade never hosts/proxies/decrypts SVOD content. Playback stays on the streaming site/app.

export const STREAMING_PLATFORMS = [
  {
    id: 'netflix',
    label: 'Netflix',
    homeUrl: 'https://www.netflix.com/',
    /** Max capability this product currently ships for the platform. */
    maxCapability: 2, // L2 via NetflixAdapter (desktop extension); L3 without
  },
  {
    id: 'disney_plus',
    label: 'Disney+',
    homeUrl: 'https://www.disneyplus.com/',
    maxCapability: 3, // stub adapter — coordination only until green probes
  },
  {
    id: 'max',
    label: 'Max',
    homeUrl: 'https://www.max.com/',
    maxCapability: 3,
  },
  {
    id: 'prime_video',
    label: 'Prime Video',
    homeUrl: 'https://www.primevideo.com/',
    maxCapability: 3,
  },
];

export function platformMeta(id) {
  return STREAMING_PLATFORMS.find(p => p.id === id) || null;
}

export function platformLabel(id) {
  return platformMeta(id)?.label || 'Streaming';
}

export function platformHomeUrl(id) {
  return platformMeta(id)?.homeUrl || 'https://www.netflix.com/';
}

/** Open the official service (or pasted watch URL). Never embed. */
export function openStreamingContent({ platform, url }) {
  const trimmed = (url || '').trim();
  let href = platformHomeUrl(platform);
  if (trimmed) {
    try {
      const u = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
      href = u.href;
    } catch { /* keep home */ }
  }
  window.open(href, '_blank', 'noopener,noreferrer');
  return href;
}

export function capabilityLabel(level) {
  const n = Number(level) || 3;
  if (n <= 1) return 'Full sync';
  if (n === 2) return 'Partial sync';
  return 'Coordination';
}

export function capabilityBlurb(level, platformId) {
  const name = platformLabel(platformId);
  const n = Number(level) || 3;
  if (n <= 1) {
    return `Playback syncs with ${name} through the DuoArcade extension.`;
  }
  if (n === 2) {
    return `Play/pause and Sync now work via the DuoArcade extension. ${name} still plays in its own tab — we never re-stream.`;
  }
  return `We help you start together. Playback stays in ${name} on your own accounts — chat, reactions, and Sparks live here.`;
}

/** Effective capability = min(session, platform max, local bridge). */
export function resolveCapability({ sessionCap, platformId, bridge }) {
  const platformMax = platformMeta(platformId)?.maxCapability ?? 3;
  const bridgeCap = bridge === 'ext' ? 2 : 3;
  return Math.max(1, Math.min(
    Number(sessionCap) || 3,
    platformMax,
    bridgeCap,
  ));
}

/** Detect Chromium desktop where extension install is realistic. */
export function isDesktopChromium() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  if (mobile) return false;
  return /Chrome|Edg|Chromium/i.test(ua) && !/OPR\//i.test(ua);
}

/* ===== Extension ↔ web bind (web tab remains Supabase authority) ===== */

export const EXT_MESSAGE_SOURCE = 'duoarcade-watch-ext';
export const WEB_MESSAGE_SOURCE = 'duoarcade-watch-web';

export function makeBindToken({ code, role, expiresAt }) {
  return {
    v: 1,
    code: String(code || ''),
    role: role === 'B' ? 'B' : 'A',
    expiresAt: Number(expiresAt) || (Date.now() + 15 * 60 * 1000),
  };
}

export function isBindTokenValid(token, code, role) {
  if (!token || token.v !== 1) return false;
  if (token.code !== code || token.role !== role) return false;
  if (Date.now() > Number(token.expiresAt || 0)) return false;
  return true;
}

/** Post a message the extension content/background may listen for. */
export function postToExtension(type, payload = {}) {
  if (typeof window === 'undefined') return;
  window.postMessage({
    source: WEB_MESSAGE_SOURCE,
    type,
    ...payload,
  }, window.location.origin);
}

/**
 * Listen for extension → web messages. Returns unsubscribe.
 * Valid types: ext-hello | playhead | buffer | episode | capability | tab-closed
 */
export function onExtensionMessage(handler) {
  if (typeof window === 'undefined') return () => {};
  const onMsg = (ev) => {
    if (ev.origin !== window.location.origin) return;
    const data = ev.data;
    if (!data || data.source !== EXT_MESSAGE_SOURCE) return;
    handler(data);
  };
  window.addEventListener('message', onMsg);
  return () => window.removeEventListener('message', onMsg);
}
