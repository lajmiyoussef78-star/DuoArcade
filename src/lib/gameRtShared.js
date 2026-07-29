// gameRtShared.js — coalesce / critical sets shared by Supabase + Socket.IO RT adapters.

// High-frequency game snapshots must coalesce — flooding `st` as critical
// made Supabase drop host→guest packets (invited player freezes; host still moves).
export const COALESCE = new Set(['pose', 'state', 'st', 'inp', 'in', 'snap', 'clk', 'aim', 'trail', 'p1', 'p2']);
export const CRITICAL = new Set(['try', 'ev', 'throw', 'over', 'nextEnd', 'grab', 'start', 'act', 'move', 'needstart', 'hello', 'ack', 'finish', 'ready', 'sel', 'menu', 'round', 'ui']);

export function clonePayload(payload) {
  try { return JSON.parse(JSON.stringify(payload)); }
  catch { return payload; }
}

/**
 * Outbox that never drops: buffers until the transport can actually send.
 * Same-kind coalesce while queued — prevents a backlog of ancient `st`/`p1`
 * snapshots from replaying and yanking players back to spawn.
 */
export function createOutboxSend(canSend, sendNow) {
  const q = [];
  let flushing = false;

  function enqueueQueued(msg) {
    const kind = msg?.k;
    if (kind && COALESCE.has(kind)) {
      const i = q.findIndex((m) => m?.k === kind);
      if (i >= 0) q[i] = msg;
      else q.push(msg);
    } else {
      q.push(msg);
    }
    if (q.length > 40) q.splice(0, q.length - 40);
  }

  function flush() {
    if (flushing) return;
    flushing = true;
    try {
      while (q.length && canSend()) {
        sendNow(q.shift());
      }
    } finally {
      flushing = false;
    }
  }

  function send(msg) {
    if (canSend()) {
      if (q.length) {
        enqueueQueued(msg);
        flush();
        return;
      }
      sendNow(msg);
      return;
    }
    enqueueQueued(msg);
  }

  return { send, flush, pending: () => q.length };
}

/** Microtask coalesce + critical immediate send. */
export function createEnqueue({ readyPromise, sendRaw }) {
  let chain = Promise.resolve();
  let latestByKind = new Map();
  let flushScheduled = false;
  let ready = false;
  readyPromise.then(() => { ready = true; });

  function flushSoon() {
    if (flushScheduled) return;
    flushScheduled = true;
    const kick = typeof queueMicrotask === 'function'
      ? (fn) => queueMicrotask(fn)
      : (fn) => setTimeout(fn, 0);
    kick(() => {
      flushScheduled = false;
      const batch = [...latestByKind.values()];
      latestByKind.clear();
      if (!batch.length) return;
      // Once ready, flush inline — nesting readyPromise.then starved the
      // host→guest channel and froze P1 on the invited screen mid-race.
      if (ready) {
        for (const p of batch) sendRaw(p);
        return;
      }
      readyPromise.then(() => {
        for (const p of batch) sendRaw(p);
      });
    });
  }

  function enqueue(payload) {
    const kind = payload?.k || '_';
    if (kind === 'act' || kind === 'move' || kind === 'needstart' || kind === 'hello' || kind === 'start' || kind === 'ack' || kind === 'finish' || kind === 'ui' || kind === 'ready' || kind === 'sel') {
      if (ready) {
        sendRaw(payload);
        return Promise.resolve();
      }
      chain = chain.then(() => readyPromise).then(() => { sendRaw(payload); });
      return chain;
    }
    if (COALESCE.has(kind)) {
      latestByKind.set(kind, payload);
      flushSoon();
      return chain;
    }
    const msg = clonePayload(payload);
    if (CRITICAL.has(kind)) {
      if (ready) {
        sendRaw(msg);
        return Promise.resolve();
      }
      chain = chain.then(() => readyPromise).then(() => {
        sendRaw(msg);
      });
      return chain;
    }
    latestByKind.set(kind, msg);
    flushSoon();
    return chain;
  }

  return enqueue;
}
