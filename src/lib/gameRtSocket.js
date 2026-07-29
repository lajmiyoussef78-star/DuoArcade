// gameRtSocket.js — Socket.IO transport for sync.rt() (Step 2).
// Same public API as Supabase broadcast RT. Event `m` + payloads unchanged.

import { io } from 'socket.io-client';
import { createEnqueue } from './gameRtShared.js';

/**
 * @param {object} opts
 * @param {string} opts.code
 * @param {string} opts.url
 * @param {() => Promise<string|null>} opts.getAccessToken
 * @param {'duo'|'friend'} [opts.kind]
 * @param {() => object} [opts.createFallback] - full rt() handle if socket fails
 * @param {string} [opts.game]
 * @param {string} [opts.matchId]
 * @param {'A'|'B'} [opts.role]
 * @param {boolean} [opts.requireSocket]
 */
export function createSocketGameRt({
  code,
  url,
  getAccessToken,
  kind = 'duo',
  createFallback = null,
  game = null,
  matchId = null,
  role = null,
  requireSocket = false,
}) {
  let closed = false;
  let subscribed = false;
  let usingFallback = false;
  let fallbackRt = null;
  let socket = null;
  let readySettled = false;
  let everJoined = false;
  let errorReason = null;
  let serverRole = null;
  const pendingByKind = new Map();

  let resolveReady;
  let readyTimer = null;
  const readyPromise = new Promise(res => {
    resolveReady = () => {
      if (readySettled) return;
      readySettled = true;
      if (readyTimer) clearTimeout(readyTimer);
      res();
    };
  });

  let rcb = () => {};
  const listeners = new Set();
  const dispatch = (payload) => {
    try { rcb(payload); } catch (e) { console.warn('rt handler', e); }
    for (const f of listeners) {
      try { f(payload); } catch (e) { console.warn('rt listener', e); }
    }
  };

  function flushPending() {
    const fallbackReady = usingFallback && !!fallbackRt?.isReady?.();
    const socketReady = !usingFallback && !!(socket?.connected && subscribed);
    if ((!fallbackReady && !socketReady) || !pendingByKind.size) return;
    const batch = [...pendingByKind.values()];
    pendingByKind.clear();
    for (const msg of batch) {
      if (usingFallback && fallbackRt) fallbackRt.send(msg);
      else socket.emit('m', msg);
    }
  }

  function activateFallback(reason) {
    if (requireSocket) {
      errorReason = String(reason || 'socket_required');
      return false;
    }
    if (closed || usingFallback || typeof createFallback !== 'function') return false;
    usingFallback = true;
    console.warn('[game-rt] Socket.IO unavailable — falling back to Supabase RT:', reason);
    try {
      socket?.removeAllListeners();
      socket?.disconnect();
    } catch { /* ignore */ }
    socket = null;
    fallbackRt = createFallback();
    fallbackRt.on(payload => dispatch(payload));
    subscribed = false;
    void fallbackRt.whenReady?.().then(() => {
      if (closed || !usingFallback) return;
      subscribed = !!fallbackRt?.isReady?.();
      resolveReady();
      flushPending();
    });
    return true;
  }

  function sendRaw(msg) {
    if (closed) return;
    if (usingFallback && fallbackRt) {
      fallbackRt.send(msg);
      return;
    }
    if (socket?.connected && subscribed) {
      socket.emit('m', msg);
      return;
    }
    pendingByKind.set(msg?.k || '_', msg);
  }

  const enqueue = createEnqueue({ readyPromise, sendRaw });

  const handle = {
    ready: readyPromise,
    isReady: () => (usingFallback ? !!fallbackRt?.isReady?.() : subscribed),
    whenReady: () => readyPromise.then(() => handle.isReady()),
    send: payload => enqueue(payload),
    on: f => { rcb = f || (() => {}); },
    subscribe: f => {
      if (typeof f !== 'function') return () => {};
      listeners.add(f);
      return () => listeners.delete(f);
    },
    close: () => {
      closed = true;
      subscribed = false;
      if (readyTimer) clearTimeout(readyTimer);
      pendingByKind.clear();
      listeners.clear();
      rcb = () => {};
      try { fallbackRt?.close?.(); } catch { /* ignore */ }
      fallbackRt = null;
      if (socket) {
        try {
          socket.emit('leave-room');
          socket.removeAllListeners();
          socket.disconnect();
        } catch { /* ignore */ }
        socket = null;
      }
    },
    /** Diagnostics for verifying the active transport. */
    transport: () => (usingFallback ? 'supabase-fallback' : 'socket'),
    error: () => errorReason,
    role: () => serverRole,
    /** One-shot RTT via latency:ping / latency:pong (ms), or null. */
    probeRtt: () => new Promise(resolve => {
      if (usingFallback && fallbackRt?.probeRtt) {
        fallbackRt.probeRtt().then(resolve);
        return;
      }
      if (!socket?.connected) {
        resolve(null);
        return;
      }
      const t0 = performance.now();
      const timer = setTimeout(() => {
        socket.off('latency:pong', onPong);
        resolve(null);
      }, 3000);
      function onPong(payload) {
        if (payload?.t !== t0) return;
        clearTimeout(timer);
        socket.off('latency:pong', onPong);
        resolve(Math.round(performance.now() - t0));
      }
      socket.once('latency:pong', onPong);
      socket.emit('latency:ping', { t: t0 });
    }),
    probeClock: () => new Promise(resolve => {
      if (!socket?.connected || usingFallback) {
        resolve(null);
        return;
      }
      const t = performance.now();
      const clientTime = Date.now();
      const timer = setTimeout(() => {
        socket.off('latency:pong', onPong);
        resolve(null);
      }, 3000);
      function onPong(payload) {
        if (payload?.t !== t) return;
        clearTimeout(timer);
        socket.off('latency:pong', onPong);
        const rttMs = performance.now() - t;
        resolve({
          rttMs,
          serverTime: payload.serverTime,
          localMidpoint: clientTime + rttMs / 2,
        });
      }
      socket.once('latency:pong', onPong);
      socket.emit('latency:ping', { t, clientTime });
    }),
  };

  readyTimer = setTimeout(() => {
    if (subscribed || usingFallback || closed) return;
    if (!activateFallback('ready_timeout')) resolveReady();
  }, 8000);

  void (async () => {
    try {
      const token = await getAccessToken();
      if (!token) {
        if (!activateFallback('no_jwt')) {
          console.error('[game-rt] Socket.IO needs a Supabase session JWT');
          resolveReady();
        }
        return;
      }

      console.info('[game-rt] connecting Socket.IO', { url, code, kind });

      socket = io(url, {
        transports: ['websocket', 'polling'],
        auth: { token },
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 500,
        reconnectionDelayMax: 4000,
        timeout: 8000,
      });

      socket.on('connect', () => {
        console.info('[game-rt] Socket.IO connected', { id: socket.id });
        socket.emit('join-room', { code, kind, game, matchId, role }, (ack) => {
          if (closed || usingFallback) return;
          if (ack?.ok) {
            if (role && ack.role && ack.role !== role) {
              errorReason = 'authoritative_role_mismatch';
              console.error('[game-rt] authoritative role mismatch', {
                expected: role,
                received: ack.role,
              });
              resolveReady();
              socket.disconnect();
              return;
            }
            serverRole = ack.role || null;
            subscribed = true;
            everJoined = true;
            console.info('[game-rt] joined room', {
              room: ack.room,
              occupants: ack.occupants,
            });
            resolveReady();
            flushPending();
          } else {
            if (!activateFallback(ack?.error || 'join_failed')) resolveReady();
          }
        });
      });

      socket.on('m', payload => {
        if (!closed) dispatch(payload);
      });

      socket.on('connect_error', (err) => {
        console.error('[game-rt] Socket.IO connect_error', err?.message || err);
        if (!everJoined && !subscribed && !usingFallback) {
          activateFallback(err?.message || 'connect_error');
        }
      });

      socket.io.on('reconnect', (attempt) => {
        console.info('[game-rt] Socket.IO reconnected', { attempt, id: socket.id });
        try { handle._onReconnect?.(attempt); } catch { /* ignore */ }
      });

      socket.io.on('reconnect_attempt', (attempt) => {
        console.info('[game-rt] Socket.IO reconnect_attempt', { attempt });
      });

      socket.io.on('reconnect_failed', () => {
        console.error('[game-rt] Socket.IO reconnect_failed');
      });

      socket.on('disconnect', (reason) => {
        subscribed = false;
        console.warn('[game-rt] Socket.IO disconnect', { reason });
      });
    } catch (e) {
      activateFallback(String(e?.message || e));
    }
  })();

  return handle;
}
