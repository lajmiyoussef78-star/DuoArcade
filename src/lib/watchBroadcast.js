// watchBroadcast.js — ephemeral WatchParty bus (emoji, laugh, buffer, swipe anim).
// Do NOT route these through update_duo — keeps the duo row slim.

import { getSupabase } from './supabaseClient.js';

/**
 * Open a duo watch broadcast channel.
 * Events: { t: 'react'|'laugh'|'buffer'|'swipe'|'spark-nudge', ... }
 */
export async function watchChannel(code) {
  const supabase = await getSupabase();
  let cb = () => {};
  const ch = supabase
    .channel('watch-' + code, { config: { broadcast: { self: true } } })
    .on('broadcast', { event: 'm' }, p => {
      try { cb(p.payload); } catch { /* listener */ }
    })
    .subscribe();

  return {
    send(payload) {
      return ch.send({ type: 'broadcast', event: 'm', payload }).catch(() => {});
    },
    on(fn) { cb = fn || (() => {}); },
    close() {
      try { supabase.removeChannel(ch); } catch { /* */ }
    },
  };
}

/** Reaction emoji float — broadcast only. */
export function reactPayload(e, by) {
  return { t: 'react', e, by, at: Date.now() };
}

/** Laugh meter tap aggregate — clients may debounce before send. */
export function laughPayload(by, n = 1) {
  return { t: 'laugh', by, n, at: Date.now() };
}

/** Movie buffer ritual — “we'll wait together”. */
export function bufferPayload(by, buffering) {
  return { t: 'buffer', by, buffering: !!buffering, at: Date.now() };
}

/** Reels swipe animation cue (index still persisted in session). */
export function swipePayload(by, index, dir) {
  return { t: 'swipe', by, index, dir: dir || null, at: Date.now() };
}
