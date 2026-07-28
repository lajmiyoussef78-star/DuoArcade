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
 */
export function createSocketGameRt({
  code,
  url,
  getAccessToken,
  kind = 'duo',
  createFallback = null,
}) {
  let closed = false;
  let subscribed = false;
  let usingFallback = false;
  let fallbackRt = null;
  let socket = null;
  let readySettled = false;

  let resolveReady;
  const readyPromise = new Promise(res => {
    resolveReady = () => {
      if (readySettled) return;
      readySettled = true;
      res();
    };
    setTimeout(resolveReady, 8000);
  });

  let rcb = () => {};
  const listeners = new Set();
  const dispatch = (payload) => {
    try { rcb(payload); } catch (e) { console.warn('rt handler', e); }
    for (const f of listeners) {
      try { f(payload); } catch (e) { console.warn('rt listener', e); }
    }
  };

  function activateFallback(reason) {
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
    fallbackRt.subscribe?.(payload => dispatch(payload));
    subscribed = true;
    resolveReady();
    return true;
  }

  function sendRaw(msg) {
    if (closed) return;
    if (usingFallback && fallbackRt) {
      fallbackRt.send(msg);
      return;
    }
    if (socket?.connected && subscribed) socket.emit('m', msg);
  }

  const enqueue = createEnqueue({ readyPromise, sendRaw });

  const handle = {
    ready: readyPromise,
    isReady: () => subscribed || (usingFallback && !!fallbackRt?.isReady?.()),
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
  };

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
        reconnectionAttempts: 8,
        reconnectionDelay: 500,
        reconnectionDelayMax: 4000,
        timeout: 8000,
      });

      socket.on('connect', () => {
        console.info('[game-rt] Socket.IO connected', { id: socket.id });
        socket.emit('join-room', { code, kind }, (ack) => {
          if (closed || usingFallback) return;
          if (ack?.ok) {
            subscribed = true;
            console.info('[game-rt] joined room', {
              room: ack.room,
              occupants: ack.occupants,
            });
            resolveReady();
          } else {
            activateFallback(ack?.error || 'join_failed');
          }
        });
      });

      socket.on('m', payload => {
        if (!closed) dispatch(payload);
      });

      socket.on('connect_error', (err) => {
        console.error('[game-rt] Socket.IO connect_error', err?.message || err);
        if (!subscribed && !usingFallback) {
          activateFallback(err?.message || 'connect_error');
        }
      });

      socket.on('reconnect', (attempt) => {
        console.info('[game-rt] Socket.IO reconnected', { attempt, id: socket.id });
        try { handle._onReconnect?.(attempt); } catch { /* ignore */ }
        socket.emit('join-room', { code, kind }, (ack) => {
          if (ack?.ok) {
            subscribed = true;
            console.info('[game-rt] re-joined room after reconnect', { room: ack.room });
          } else {
            console.warn('[game-rt] re-join failed', ack);
          }
        });
      });

      socket.on('reconnect_attempt', (attempt) => {
        console.info('[game-rt] Socket.IO reconnect_attempt', { attempt });
      });

      socket.on('reconnect_failed', () => {
        console.error('[game-rt] Socket.IO reconnect_failed');
        if (!usingFallback) activateFallback('reconnect_failed');
      });

      socket.on('disconnect', (reason) => {
        console.warn('[game-rt] Socket.IO disconnect', { reason });
      });
    } catch (e) {
      activateFallback(String(e?.message || e));
    }
  })();

  return handle;
}
