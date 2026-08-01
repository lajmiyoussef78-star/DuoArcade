// watchMovie.js — dual-local fingerprint + Continuity + timestamp comments.
// Cloud upload / HLS / Chromecast / WebRTC: Pass scaffolding (see schema-v43).

import { getSupabase } from './supabaseClient.js';

const ADJECTIVES = [
  'Blue', 'Soft', 'Golden', 'Quiet', 'Cosy', 'Amber', 'Silver', 'Warm',
  'Moon', 'Coral', 'Misty', 'Velvet', 'Honey', 'Cedar', 'Ivory', 'Rust',
];
const NOUNS = [
  'fox', 'lantern', 'harbor', 'maple', 'ember', 'willow', 'orbit', 'pebble',
  'comet', 'blanket', 'cinema', 'sofa', 'reel', 'ticket', 'dusk', 'spark',
];

/** Matches schema-v43 Storage comment (`duo-movie-uploads`). */
export const MOVIE_UPLOAD_BUCKET = 'duo-movie-uploads';

/**
 * Pass storage quota stub (client-side docs only; RPC will enforce later).
 * Free: unlimited local dual-file path; cloud upload gated.
 * Founding: documented cloud cap (bytes). Other Pass: smaller documented cap.
 */
export const PASS_MOVIE_STORAGE = {
  free: {
    maxBytes: Infinity,
    cloudUpload: false,
    label: 'Unlimited local · cloud upload needs Duo Pass',
  },
  founding: {
    maxBytes: 10 * 1024 * 1024 * 1024, // 10 GB documented
    cloudUpload: true,
    label: 'Founding · 10 GB cloud (stub)',
  },
  pass: {
    maxBytes: 5 * 1024 * 1024 * 1024, // 5 GB documented
    cloudUpload: true,
    label: 'Duo Pass · 5 GB cloud (stub)',
  },
};

export function getMoviePassQuota(passTier = 'free') {
  if (passTier === 'founding') return { tier: 'founding', ...PASS_MOVIE_STORAGE.founding };
  if (passTier && passTier !== 'free') return { tier: 'pass', ...PASS_MOVIE_STORAGE.pass };
  return { tier: 'free', ...PASS_MOVIE_STORAGE.free };
}

/** Simple client check — free = unlimited; founding/pass = documented maxBytes. */
export function checkMovieUploadQuota(passTier, fileSize = 0) {
  const q = getMoviePassQuota(passTier);
  if (!q.cloudUpload) {
    return {
      ok: false,
      reason: 'pass_required',
      quota: q,
      message: 'Cloud movie upload is a Duo Pass perk — keep using the local same-file path for free.',
    };
  }
  if (Number.isFinite(q.maxBytes) && fileSize > q.maxBytes) {
    return {
      ok: false,
      reason: 'quota',
      quota: q,
      message: `File exceeds Pass cloud limit (${formatSize(q.maxBytes)}).`,
    };
  }
  return { ok: true, quota: q };
}

function bytesToHex(buf) {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** size + first/last 64KB hash → friendly fingerprint (not full-file hash). */
export async function fingerprintFile(file) {
  if (!file) throw new Error('No file');
  const size = file.size;
  const slice = 64 * 1024;
  const head = await file.slice(0, Math.min(slice, size)).arrayBuffer();
  const tailStart = Math.max(0, size - slice);
  const tail = await file.slice(tailStart, size).arrayBuffer();
  const both = new Uint8Array(head.byteLength + tail.byteLength);
  both.set(new Uint8Array(head), 0);
  both.set(new Uint8Array(tail), head.byteLength);
  const digest = await crypto.subtle.digest('SHA-256', both);
  const hex = bytesToHex(digest).slice(0, 16);
  return {
    hash: hex,
    size,
    friendly: friendlyName(hex),
    sizeLabel: formatSize(size),
    name: file.name || 'film',
  };
}

export function friendlyName(hex) {
  let n = 0;
  for (let i = 0; i < hex.length; i++) n = (n * 31 + hex.charCodeAt(i)) >>> 0;
  const a = ADJECTIVES[n % ADJECTIVES.length];
  const b = NOUNS[Math.floor(n / ADJECTIVES.length) % NOUNS.length];
  return `${a} ${b}`;
}

export function formatSize(n) {
  if (!n && n !== 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export async function listMovieNights(code) {
  const sb = await getSupabase();
  const { data, error } = await sb.rpc('list_duo_movie_nights', { p_duo_code: code });
  if (error) {
    console.warn('list_duo_movie_nights', error.message);
    return [];
  }
  return data || [];
}

export async function upsertMovieNight(code, { fingerprint, title, sizeLabel, position, duration }) {
  const sb = await getSupabase();
  const { data, error } = await sb.rpc('upsert_duo_movie_night', {
    p_duo_code: code,
    p_fingerprint: fingerprint,
    p_title: title || null,
    p_size_label: sizeLabel || null,
    p_position: position ?? 0,
    p_duration: duration ?? null,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function listMovieComments(code, nightId) {
  const sb = await getSupabase();
  const { data, error } = await sb.rpc('list_duo_movie_comments', {
    p_duo_code: code,
    p_night_id: nightId,
  });
  if (error) {
    console.warn('list_duo_movie_comments', error.message);
    return [];
  }
  return data || [];
}

export async function addMovieComment(code, nightId, { atSec, body, by }) {
  const sb = await getSupabase();
  const { data, error } = await sb.rpc('add_duo_movie_comment', {
    p_duo_code: code,
    p_night_id: nightId,
    p_at_sec: atSec,
    p_body: body,
    p_by: by,
  });
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Probe whether the Pass movie upload bucket exists.
 * Returns { ready: true } or { ready: false, reason }.
 */
export async function probeMovieUploadBucket() {
  try {
    const sb = await getSupabase();
    const { error } = await sb.storage.from(MOVIE_UPLOAD_BUCKET).list('', { limit: 1 });
    if (error) {
      const msg = (error.message || '').toLowerCase();
      const missing = msg.includes('not found') || msg.includes('bucket') || error.statusCode === '404';
      return {
        ready: false,
        reason: missing ? 'bucket_missing' : 'storage_error',
        message: missing
          ? 'Cloud movie storage coming soon with Duo Pass (bucket not ready).'
          : (error.message || 'Storage unavailable'),
      };
    }
    return { ready: true };
  } catch (err) {
    return {
      ready: false,
      reason: 'storage_error',
      message: err?.message || 'Storage unavailable',
    };
  }
}

/**
 * Register upload intent via schema-v43 RPC (no file bytes).
 */
export async function registerMovieAsset(code, meta) {
  const sb = await getSupabase();
  const { data, error } = await sb.rpc('register_duo_movie_asset', {
    p_duo_code: code,
    p_meta: meta || {},
  });
  if (error) {
    console.warn('register_duo_movie_asset', error.message);
    return null;
  }
  return data;
}

/** @deprecated use registerMovieAsset */
export async function registerMovieAssetStub(code, meta) {
  return registerMovieAsset(code, meta);
}

/**
 * Optional Pass path (uploadChatImage-style): register RPC → Storage upload.
 * Default Movie Night remains dual-local fingerprint; this is scaffolding only.
 * Never base64-encodes video. HLS / WebRTC / Chromecast: not here.
 *
 * @returns {{ ok, status, asset?, path?, message?, reason? }}
 */
export async function uploadMovieAsset(code, file, { passTier = 'free' } = {}) {
  if (!code || !file) {
    return { ok: false, reason: 'invalid', message: 'Missing duo or file' };
  }

  const quota = checkMovieUploadQuota(passTier, file.size);
  if (!quota.ok) {
    return { ok: false, reason: quota.reason, message: quota.message, quota: quota.quota };
  }

  const probe = await probeMovieUploadBucket();
  if (!probe.ready) {
    return {
      ok: false,
      reason: probe.reason || 'coming_soon',
      message: probe.message || 'Cloud movie upload coming soon with Duo Pass.',
      status: 'coming_soon',
    };
  }

  const fp = await fingerprintFile(file);
  const ext = (file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4';
  const path = `${code}/${fp.hash}.${ext}`;

  const asset = await registerMovieAsset(code, {
    fingerprint: fp.hash,
    friendly: fp.friendly,
    name: file.name,
    size: file.size,
    sizeLabel: fp.sizeLabel,
    contentType: file.type || 'video/mp4',
    storage_path: path,
    bucket: MOVIE_UPLOAD_BUCKET,
  });

  const sb = await getSupabase();
  const { error } = await sb.storage.from(MOVIE_UPLOAD_BUCKET).upload(path, file, {
    contentType: file.type || 'video/mp4',
    upsert: false,
  });

  if (error) {
    const msg = (error.message || '').toLowerCase();
    const missing = msg.includes('not found') || msg.includes('bucket');
    return {
      ok: false,
      reason: missing ? 'bucket_missing' : 'upload_failed',
      message: missing
        ? 'Cloud movie storage coming soon with Duo Pass.'
        : (error.message || 'Upload failed'),
      status: missing ? 'coming_soon' : 'failed',
      asset,
    };
  }

  return {
    ok: true,
    status: 'uploaded',
    path,
    fingerprint: fp,
    asset,
    message: `Uploaded · ${fp.friendly} · ${fp.sizeLabel}`,
  };
}
