// gameRtSupabase.js — existing Supabase broadcast transport extracted for sync.rt().

import { createEnqueue } from './gameRtShared.js';

export function createSupabaseGameRt(sb, code) {
  let rcb = () => {};
  const listeners = new Set();
  const dispatch = (payload) => {
    try { rcb(payload); } catch (e) { console.warn('rt handler', e); }
    for (const f of listeners) {
      try { f(payload); } catch (e) { console.warn('rt listener', e); }
    }
  };

  const name = 'rt-' + code;
  try {
    for (const c of sb.getChannels()) {
      const topic = c.topic || '';
      if (topic === name || topic === 'realtime:' + name || topic.endsWith(':' + name)) {
        sb.removeChannel(c);
      }
    }
  } catch { /* older clients */ }

  let subscribed = false;
  let resolveReady;
  const readyPromise = new Promise(res => {
    resolveReady = res;
    setTimeout(res, 8000);
  });

  const ch = sb.channel(name, { config: { broadcast: { ack: false, self: false } } })
    .on('broadcast', { event: 'm' }, p => {
      dispatch(p?.payload);
    })
    .subscribe(status => {
      if (status === 'SUBSCRIBED' && !subscribed) {
        subscribed = true;
        resolveReady();
      }
    });

  const sendRaw = (msg) => {
    ch.send({ type: 'broadcast', event: 'm', payload: msg }).catch(() => {});
  };

  const enqueue = createEnqueue({ readyPromise, sendRaw });

  return {
    ready: readyPromise,
    isReady: () => subscribed,
    whenReady: () => readyPromise.then(() => subscribed),
    send: payload => enqueue(payload),
    on: f => { rcb = f || (() => {}); },
    subscribe: f => {
      if (typeof f !== 'function') return () => {};
      listeners.add(f);
      return () => listeners.delete(f);
    },
    close: () => {
      listeners.clear();
      rcb = () => {};
      try { sb.removeChannel(ch); } catch { /* already gone */ }
    },
    transport: () => 'supabase',
    /** No server RTT probe on broadcast channels. */
    probeRtt: async () => null,
  };
}
