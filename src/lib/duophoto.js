// src/lib/duophoto.js — daily instant duo photo state.

import { CONFIG } from './config.js';
import { today } from './util.js';

const localKey = code => 'duoarcade-duophoto-' + code;

export function emptyPhotoState() {
  return { day: today(), photos: { A: null, B: null }, streakCounted: false };
}

export function normalizePhotoState(state) {
  const day = today();
  if (!state || state.day !== day) return emptyPhotoState();
  return {
    day,
    photos: {
      A: state.photos?.A ?? null,
      B: state.photos?.B ?? null
    },
    streakCounted: !!state.streakCounted
  };
}

export function bothPhotosReady(state) {
  const s = normalizePhotoState(state);
  return !!(s.photos.A?.data && s.photos.B?.data);
}

let clientPromise = null;

async function getClient() {
  if (!clientPromise) {
    const { createClient } = await import('@supabase/supabase-js');
    clientPromise = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  }
  return clientPromise;
}

function configured() {
  return CONFIG.SUPABASE_URL && !CONFIG.SUPABASE_URL.includes('YOUR-PROJECT');
}

export async function loadPhotoState(code) {
  if (!configured()) {
    try {
      return normalizePhotoState(JSON.parse(localStorage.getItem(localKey(code)) || 'null'));
    } catch { return emptyPhotoState(); }
  }
  const supabase = await getClient();
  const { data, error } = await supabase
    .from('duo_photos').select('state').eq('duo_code', code).maybeSingle();
  if (error) throw new Error(error.message);
  return normalizePhotoState(data?.state);
}

export async function savePhotoState(code, state) {
  const next = normalizePhotoState(state);
  if (!configured()) {
    localStorage.setItem(localKey(code), JSON.stringify(next));
    return true;
  }
  const supabase = await getClient();
  const { data, error } = await supabase.rpc('save_duo_photos', {
    p_duo_code: code, p_state: next
  });
  if (error) throw new Error(error.message);
  return data === true;
}

export async function photoChannel(code) {
  if (!configured()) {
    let cb = () => {};
    const bc = new BroadcastChannel('duoarcade-duophoto-' + code);
    bc.onmessage = e => cb(e.data);
    return {
      send: payload => bc.postMessage(payload),
      on: fn => { cb = fn; },
      close: () => bc.close()
    };
  }
  const supabase = await getClient();
  let cb = () => {};
  const ch = supabase
    .channel('duophoto-' + code, { config: { broadcast: { self: false } } })
    .on('broadcast', { event: 'm' }, p => cb(p.payload))
    .subscribe();
  return {
    send: payload => ch.send({ type: 'broadcast', event: 'm', payload }),
    on: fn => { cb = fn; },
    close: () => supabase.removeChannel(ch)
  };
}

export function captureFromVideo(video, maxW = 640) {
  const cv = document.createElement('canvas');
  const scale = Math.min(1, maxW / (video.videoWidth || maxW));
  cv.width = Math.round((video.videoWidth || maxW) * scale);
  cv.height = Math.round((video.videoHeight || maxW) * scale);
  const g = cv.getContext('2d');
  g.drawImage(video, 0, 0, cv.width, cv.height);
  return cv.toDataURL('image/jpeg', 0.82);
}
