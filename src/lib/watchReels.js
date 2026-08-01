// watchReels.js — Reels Party URL parse + Our Clips (duo_reel_favorites).

import { getSupabase } from './supabaseClient.js';
import { videoIdFrom } from './util.js';

const QUEUE_CAP = 30;

export function parseReelUrl(raw) {
  const url = (raw || '').trim();
  if (!url) return null;

  const yt = videoIdFrom(url);
  if (yt) {
    return {
      id: 'yt:' + yt,
      kind: 'youtube',
      videoId: yt,
      url,
      title: 'YouTube Short',
      embedOk: true,
    };
  }

  // Honest fallback: TikTok / IG sync queue + open-external — no fake native embed.
  let kind = null;
  if (/tiktok\.com/i.test(url)) kind = 'tiktok';
  else if (/instagram\.com\/(reel|reels|p)\//i.test(url)) kind = 'instagram';
  else if (/^https?:\/\//i.test(url)) kind = 'external';

  if (!kind) return null;

  const id = kind + ':' + hashShort(url);
  return {
    id,
    kind,
    videoId: null,
    url,
    title: kind === 'tiktok' ? 'TikTok clip' : kind === 'instagram' ? 'Instagram Reel' : 'Clip',
    embedOk: false,
  };
}

function hashShort(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36).slice(0, 10);
}

export function capQueue(queue) {
  return (queue || []).slice(0, QUEUE_CAP);
}

export function reelEmbedSrc(clip) {
  if (!clip || !clip.embedOk || clip.kind !== 'youtube' || !clip.videoId) return null;
  return `https://www.youtube.com/embed/${clip.videoId}?playsinline=1&rel=0&autoplay=1&loop=1&playlist=${clip.videoId}`;
}

export async function listReelFavorites(code) {
  const sb = await getSupabase();
  const { data, error } = await sb.rpc('list_duo_reel_favorites', { p_duo_code: code });
  if (error) {
    // Table/RPC may not be applied yet — soft fail.
    console.warn('list_duo_reel_favorites', error.message);
    return [];
  }
  return data || [];
}

export async function saveReelFavorite(code, clip) {
  const sb = await getSupabase();
  const { data, error } = await sb.rpc('save_duo_reel_favorite', {
    p_duo_code: code,
    p_clip_id: clip.id,
    p_kind: clip.kind,
    p_url: clip.url,
    p_title: clip.title || null,
    p_video_id: clip.videoId || null,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function removeReelFavorite(code, clipId) {
  const sb = await getSupabase();
  const { error } = await sb.rpc('remove_duo_reel_favorite', {
    p_duo_code: code,
    p_clip_id: clipId,
  });
  if (error) throw new Error(error.message);
}

/** Twin-taste: both liked within 2s. */
export function twinTasteBurst(likesEntry, windowMs = 2000) {
  if (!likesEntry?.A || !likesEntry?.B) return false;
  return Math.abs(likesEntry.A - likesEntry.B) <= windowMs;
}
