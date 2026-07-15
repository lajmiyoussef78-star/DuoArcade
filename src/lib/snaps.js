// src/lib/snaps.js — Duo Snap data layer (interval-based rounds).

import { CONFIG } from './config.js';

let clientPromise = null;

async function getClient() {
  if (!clientPromise) {
    const { createClient } = await import('@supabase/supabase-js');
    clientPromise = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  }
  return clientPromise;
}

export const DEFAULT_SNAP_SETTINGS = {
  enabled: true,
  interval_mins: 120,
  window_mins: 60,
  notify: true,
  camera_pref: 'user',
  auto_save_device: false
};

export const INTERVAL_PRESETS = [
  { mins: 60, label: 'Every 1 hour' },
  { mins: 120, label: 'Every 2 hours' },
  { mins: 180, label: 'Every 3 hours' },
  { mins: 240, label: 'Every 4 hours' }
];

export const WINDOW_PRESETS = [
  { mins: 30, label: '30 minutes' },
  { mins: 60, label: '1 hour' },
  { mins: 90, label: '1.5 hours' },
  { mins: 120, label: '2 hours' }
];

export const PAUSE_PRESETS = [
  { mins: 30, label: '30 minutes' },
  { mins: 60, label: '1 hour' },
  { mins: 120, label: '2 hours' },
  { mins: 180, label: '3 hours' },
  { mins: 360, label: '6 hours' },
  { untilTomorrow: true, label: 'Until tomorrow' }
];

export const BUSY_REASONS = [
  { id: 'studying', label: 'Studying', emoji: '📚' },
  { id: 'working', label: 'Working', emoji: '💼' },
  { id: 'driving', label: 'Driving', emoji: '🚗' },
  { id: 'sleeping', label: 'Sleeping', emoji: '😴' },
  { id: 'gym', label: 'At the gym', emoji: '🏋️' },
  { id: 'family', label: 'Family time', emoji: '👨‍👩‍👧' },
  { id: 'gaming', label: 'Gaming', emoji: '🎮' },
  { id: 'travel', label: 'Traveling', emoji: '✈️' }
];

export const REACT_EMOJIS = ['❤️', '😂', '🔥', '🥰', '👏', '😮'];

export async function myRoleInDuo(code) {
  const supabase = await getClient();
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData?.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase.rpc('list_my_duos', {});
  if (error) return null;
  const d = (data || []).find(x => x.code === code);
  if (!d) return null;
  return d.member_a === uid ? 'A' : d.member_b === uid ? 'B' : null;
}

export async function duoNames(code) {
  const supabase = await getClient();
  const { data } = await supabase.rpc('list_my_duos', {});
  const d = (data || []).find(x => x.code === code);
  return d ? { A: d.name_a, B: d.name_b } : { A: 'A', B: 'B' };
}

export async function getDuoSnapState(code) {
  const supabase = await getClient();
  const { data, error } = await supabase.rpc('get_duo_snap_state', { p_duo_code: code });
  if (error) throw new Error(error.message);
  return data;
}

export async function saveDuoSnapSettings(code, patch) {
  const supabase = await getClient();
  const { data, error } = await supabase.rpc('save_duo_snap_settings', {
    p_duo_code: code,
    p_enabled: patch.enabled ?? null,
    p_interval_mins: patch.interval_mins ?? null,
    p_window_mins: patch.window_mins ?? null,
    p_notify: patch.notify ?? null,
    p_camera_pref: patch.camera_pref ?? null,
    p_auto_save_device: patch.auto_save_device ?? null
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function pauseDuoSnap(code, untilIso, reason = null) {
  const supabase = await getClient();
  const { data, error } = await supabase.rpc('pause_duo_snap', {
    p_duo_code: code,
    p_until: untilIso,
    p_reason: reason
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function resumeDuoSnap(code) {
  const supabase = await getClient();
  const { data, error } = await supabase.rpc('resume_duo_snap', { p_duo_code: code });
  if (error) throw new Error(error.message);
  return data;
}

export async function submitDuoSnap(code, roundId, photoDataUrl, caption = '') {
  const supabase = await getClient();
  const { data, error } = await supabase.rpc('submit_duo_snap', {
    p_duo_code: code,
    p_round_id: roundId,
    p_photo: photoDataUrl,
    p_caption: caption || null
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function reactDuoSnap(code, roundId, { reaction, comment } = {}) {
  const supabase = await getClient();
  const { data, error } = await supabase.rpc('react_duo_snap', {
    p_duo_code: code,
    p_round_id: roundId,
    p_reaction: reaction ?? null,
    p_comment: comment ?? null
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function listDuoSnapHistory(code, month = null, limit = 40) {
  const supabase = await getClient();
  const { data, error } = await supabase.rpc('list_duo_snap_history', {
    p_duo_code: code,
    p_month: month,
    p_limit: limit
  });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function deleteDuoSnap(code, roundId) {
  const supabase = await getClient();
  const { data, error } = await supabase.rpc('delete_duo_snap', {
    p_duo_code: code,
    p_round_id: roundId
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function clearDuoSnapHistory(code) {
  const supabase = await getClient();
  const { data, error } = await supabase.rpc('clear_duo_snap_history', { p_duo_code: code });
  if (error) throw new Error(error.message);
  return data;
}

export async function listDuoSnapPauses(code, limit = 20) {
  const supabase = await getClient();
  const { data, error } = await supabase.rpc('list_duo_snap_pauses', {
    p_duo_code: code,
    p_limit: limit
  });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function snapChannel(code) {
  const supabase = await getClient();
  let cb = () => {};
  const ch = supabase
    .channel('duo-snap-' + code, { config: { broadcast: { self: true } } })
    .on('broadcast', { event: 'm' }, p => cb(p.payload))
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'duo_snap_rounds', filter: `duo_code=eq.${code}` },
      () => cb({ k: 'snap' }))
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'duo_snap_config', filter: `duo_code=eq.${code}` },
      () => cb({ k: 'snap' }))
    .subscribe();
  return {
    send: payload => ch.send({ type: 'broadcast', event: 'm', payload }),
    on: fn => { cb = fn; },
    close: () => supabase.removeChannel(ch)
  };
}

export function pauseUntilIso(preset) {
  const now = new Date();
  if (preset.untilTomorrow) {
    const t = new Date(now);
    t.setDate(t.getDate() + 1);
    t.setHours(9, 0, 0, 0);
    return t.toISOString();
  }
  return new Date(now.getTime() + preset.mins * 60_000).toISOString();
}

export function formatRemaining(ms) {
  if (ms <= 0) return '0m';
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

export function formatClock(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function formatDayTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString([], {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
  });
}

export function photoFor(role, round) {
  if (!round || !role) return null;
  return role === 'A' ? round.photo_a : round.photo_b;
}

export function partnerPhoto(role, round) {
  if (!round || !role) return null;
  return role === 'A' ? round.photo_b : round.photo_a;
}

export function captionFor(role, round) {
  if (!round || !role) return '';
  return role === 'A' ? (round.caption_a || '') : (round.caption_b || '');
}

export function maybeNotifyDuoSnap(config, round, alreadyNotifiedRef) {
  if (!config?.notify || !round || round.status !== 'active') return;
  if (alreadyNotifiedRef.current === round.id) return;
  if (typeof Notification === 'undefined') return;

  const fire = () => {
    alreadyNotifiedRef.current = round.id;
    try {
      new Notification('Duo Snap', {
        body: '📸 Time for your Duo Snap! Send your partner a quick photo.',
        tag: 'duo-snap-' + round.id
      });
    } catch { /* ignore */ }
  };

  if (Notification.permission === 'granted') fire();
  else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(p => { if (p === 'granted') fire(); });
  }
}

function loadImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('Could not load a photo for the diptych.'));
    img.src = src;
  });
}

function roundRectPath(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function squareCrop(img) {
  const s = Math.min(img.width, img.height);
  return { sx: (img.width - s) / 2, sy: (img.height - s) / 2, s };
}

export async function downloadTodayDiptych({ photoA, photoB, nameA, nameB, day, label }) {
  if (!photoA || !photoB) throw new Error('Both photos are needed.');
  const [imgA, imgB] = await Promise.all([loadImage(photoA), loadImage(photoB)]);
  const W = 1080;
  const H = 1350;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d');

  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#332647');
  bg.addColorStop(0.55, '#2A2038');
  bg.addColorStop(1, '#1D1529');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);

  const glow = (x, y, r, color, alpha) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, color);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = alpha;
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
    g.globalAlpha = 1;
  };
  glow(W * 0.16, H * 0.14, 330, '#FF7FA8', 0.13);
  glow(W * 0.88, H * 0.30, 300, '#7FA8FF', 0.12);
  glow(W * 0.50, H * 0.45, 460, '#B48CE0', 0.08);

  g.textAlign = 'center';
  g.fillStyle = 'rgba(246,239,250,0.55)';
  g.font = '500 24px Arial';
  g.fillText((label || 'DUO SNAP').toUpperCase(), W / 2, 108);

  const drawCard = (img, cx, cy, rot, caption) => {
    const pw = 500;
    const pad = 22;
    const photo = pw - pad * 2;
    const ph = pad + photo + 88;
    const { sx, sy, s } = squareCrop(img);
    g.save();
    g.translate(cx, cy);
    g.rotate(rot);
    g.shadowColor = 'rgba(12,6,22,0.55)';
    g.shadowBlur = 60;
    g.shadowOffsetY = 26;
    g.fillStyle = '#FFFBF4';
    roundRectPath(g, -pw / 2, -ph / 2, pw, ph, 20);
    g.fill();
    g.shadowColor = 'transparent';
    g.save();
    roundRectPath(g, -pw / 2 + pad, -ph / 2 + pad, photo, photo, 12);
    g.clip();
    g.drawImage(img, sx, sy, s, s, -pw / 2 + pad, -ph / 2 + pad, photo, photo);
    g.restore();
    g.fillStyle = '#6B5A7A';
    g.font = 'italic 400 33px Georgia';
    g.textAlign = 'center';
    g.fillText(caption, 0, ph / 2 - 32);
    g.restore();
  };

  drawCard(imgA, W * 0.33, H * 0.365, -0.05, nameA || 'A');
  drawCard(imgB, W * 0.67, H * 0.55, 0.05, nameB || 'B');

  g.save();
  g.translate(W * 0.453, H * 0.323);
  g.rotate(0.14);
  g.fillStyle = '#FFC66E';
  g.font = '58px serif';
  g.textAlign = 'center';
  g.fillText('\u2665', 0, 18);
  g.restore();

  const baseY = H - 218;
  g.fillStyle = '#F6EFFA';
  g.font = '600 54px Georgia';
  g.textAlign = 'center';
  g.fillText(`${nameA}  &  ${nameB}`, W / 2, baseY + 78);

  const stamp = day || new Date().toISOString().slice(0, 10);
  g.fillStyle = 'rgba(185,174,203,0.9)';
  g.font = '400 26px Arial';
  g.fillText(String(stamp).toUpperCase(), W / 2, baseY + 132);
  g.fillStyle = 'rgba(255,198,110,0.75)';
  g.font = '700 21px Arial';
  g.fillText('DUOARCADE', W / 2, H - 44);

  const blob = await new Promise((res, rej) => {
    cv.toBlob(b => (b ? res(b) : rej(new Error('Could not build the image.'))), 'image/png');
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.download = `duoarcade-snap-${stamp.replace(/[^\d-]/g, '')}.png`;
  a.href = url;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
