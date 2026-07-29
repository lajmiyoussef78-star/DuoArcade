// gameRtShared.js — coalesce / critical sets shared by Supabase + Socket.IO RT adapters.

export const COALESCE = new Set([
  'pose', 'state', 'inp', 'in', 'snap', 'start', 'st', 'clk', 'aim', 'trail',
]);
export const CRITICAL = new Set([
  'try', 'ev', 'throw', 'over', 'nextEnd', 'grab', 'sync',
  'soccer:join', 'soccer:input',
]);

export function clonePayload(payload) {
  try { return JSON.parse(JSON.stringify(payload)); }
  catch { return payload; }
}

const DEBUG_RT = typeof location !== 'undefined'
  && /[?&]debug=1(?:&|$)/.test(location.search || '');

const STALL_GAP_MS = 500;
const RATE_WINDOW_MS = 1000;

/** @type {{
 *   sent: number,
 *   recv: number,
 *   sentTimes: number[],
 *   recvTimes: number[],
 *   lastInboundAt: number|null,
 *   stalls: number,
 *   rttMs: number|null,
 * }} */
const metrics = {
  sent: 0,
  recv: 0,
  sentTimes: [],
  recvTimes: [],
  lastInboundAt: null,
  stalls: 0,
  rttMs: null,
};

function nowMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function pruneWindow(times, t) {
  const cutoff = t - RATE_WINDOW_MS;
  let i = 0;
  while (i < times.length && times[i] < cutoff) i += 1;
  if (i > 0) times.splice(0, i);
}

function noteOutbound(_payload) {
  if (!DEBUG_RT) return;
  const t = nowMs();
  metrics.sent += 1;
  metrics.sentTimes.push(t);
  pruneWindow(metrics.sentTimes, t);
}

/** Count one inbound game message (Socket or Supabase). No-op without ?debug=1. */
export function noteInbound(_payload) {
  if (!DEBUG_RT) return;
  const t = nowMs();
  if (metrics.lastInboundAt != null && (t - metrics.lastInboundAt) > STALL_GAP_MS) {
    metrics.stalls += 1;
  }
  metrics.lastInboundAt = t;
  metrics.recv += 1;
  metrics.recvTimes.push(t);
  pruneWindow(metrics.recvTimes, t);
}

function snapshotRates() {
  const t = nowMs();
  pruneWindow(metrics.sentTimes, t);
  pruneWindow(metrics.recvTimes, t);
  return {
    sentPerSec: metrics.sentTimes.length,
    recvPerSec: metrics.recvTimes.length,
    lastInMs: metrics.lastInboundAt == null ? null : Math.max(0, Math.round(t - metrics.lastInboundAt)),
    stalls: metrics.stalls,
    rttMs: metrics.rttMs,
    sent: metrics.sent,
    recv: metrics.recv,
  };
}

/**
 * Mount a temporary bottom-left RT measuring HUD when `?debug=1`.
 * No-op otherwise. Wraps `handle.close` to tear down timers/DOM.
 */
export function attachRtDebug(handle) {
  if (!DEBUG_RT || !handle || typeof document === 'undefined') return () => {};

  const el = document.createElement('div');
  el.id = 'duo-rt-debug';
  el.setAttribute('aria-hidden', 'true');
  Object.assign(el.style, {
    position: 'fixed',
    left: '8px',
    bottom: '8px',
    zIndex: '99999',
    pointerEvents: 'none',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    fontSize: '11px',
    lineHeight: '1.35',
    color: '#e8eefc',
    background: 'rgba(8, 10, 18, 0.78)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '8px',
    padding: '8px 10px',
    whiteSpace: 'pre',
    maxWidth: '220px',
  });
  document.body.appendChild(el);

  let closed = false;
  let uiTimer = null;
  let rttTimer = null;

  const paint = () => {
    if (closed) return;
    const snap = snapshotRates();
    const transport = typeof handle.transport === 'function'
      ? (handle.transport() || '—')
      : '—';
    const rtt = snap.rttMs == null ? '—' : `${snap.rttMs}ms`;
    const lastIn = snap.lastInMs == null ? '—' : `${snap.lastInMs}ms`;
    el.textContent = [
      `transport: ${transport}`,
      `rtt: ${rtt}`,
      `sent/s: ${snap.sentPerSec}`,
      `recv/s: ${snap.recvPerSec}`,
      `last in: ${lastIn}`,
      `stalls: ${snap.stalls}`,
    ].join('\n');
  };

  const pollRtt = () => {
    if (closed || typeof handle.probeRtt !== 'function') return;
    Promise.resolve(handle.probeRtt())
      .then((ms) => {
        if (closed) return;
        metrics.rttMs = Number.isFinite(ms) ? Math.round(ms) : null;
      })
      .catch(() => {
        if (!closed) metrics.rttMs = null;
      });
  };

  paint();
  pollRtt();
  uiTimer = setInterval(paint, 250);
  rttTimer = setInterval(pollRtt, 2000);

  const prevClose = typeof handle.close === 'function' ? handle.close.bind(handle) : null;
  const teardown = () => {
    if (closed) return;
    closed = true;
    if (uiTimer) clearInterval(uiTimer);
    if (rttTimer) clearInterval(rttTimer);
    uiTimer = null;
    rttTimer = null;
    try { el.remove(); } catch { /* ignore */ }
  };

  handle.close = () => {
    teardown();
    if (prevClose) prevClose();
  };

  return teardown;
}

/** rAF coalesce + critical immediate send — identical to legacy sync.rt(). */
export function createEnqueue({ readyPromise, sendRaw }) {
  let chain = Promise.resolve();
  let latestByKind = new Map();
  let flushScheduled = false;

  const trackedSend = (msg) => {
    noteOutbound(msg);
    sendRaw(msg);
  };

  function flushSoon() {
    if (flushScheduled) return;
    flushScheduled = true;
    const kick = typeof requestAnimationFrame === 'function'
      ? (fn) => requestAnimationFrame(fn)
      : (fn) => setTimeout(fn, 0);
    kick(() => {
      flushScheduled = false;
      const batch = [...latestByKind.values()];
      latestByKind.clear();
      if (!batch.length) return;
      readyPromise.then(() => {
        for (const p of batch) trackedSend(p);
      });
    });
  }

  function enqueue(payload) {
    const msg = clonePayload(payload);
    const kind = msg?.k || '_';
    if (CRITICAL.has(kind) || !COALESCE.has(kind)) {
      chain = chain.then(() => readyPromise).then(() => {
        trackedSend(msg);
      });
      return chain;
    }
    latestByKind.set(kind, msg);
    flushSoon();
    return chain;
  }

  return enqueue;
}
