// gameRtShared.js — coalesce / critical sets shared by Supabase + Socket.IO RT adapters.

export const COALESCE = new Set(['pose', 'state', 'inp', 'in', 'snap', 'start', 'st', 'clk', 'aim', 'trail']);
export const CRITICAL = new Set(['try', 'ev', 'throw', 'over', 'nextEnd', 'grab']);

export function clonePayload(payload) {
  try { return JSON.parse(JSON.stringify(payload)); }
  catch { return payload; }
}

/** rAF coalesce + critical immediate send — identical to legacy sync.rt(). */
export function createEnqueue({ readyPromise, sendRaw }) {
  let chain = Promise.resolve();
  let latestByKind = new Map();
  let flushScheduled = false;

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
        for (const p of batch) sendRaw(p);
      });
    });
  }

  function enqueue(payload) {
    const msg = clonePayload(payload);
    const kind = msg?.k || '_';
    if (CRITICAL.has(kind) || !COALESCE.has(kind)) {
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
