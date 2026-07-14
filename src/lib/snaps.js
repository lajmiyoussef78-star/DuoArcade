// src/lib/snaps.js — "Today's snap" data layer.

import { CONFIG } from './config.js';

let clientPromise = null;

async function getClient() {
  if (!clientPromise) {
    const { createClient } = await import('@supabase/supabase-js');
    clientPromise = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  }
  return clientPromise;
}

export const todayStr = () => new Date().toLocaleDateString('en-CA');

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

export async function loadSnap(code, day) {
  const supabase = await getClient();
  const { data, error } = await supabase
    .from('photo_moments').select('*')
    .eq('duo_code', code).eq('day', day).maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? null;
}

export async function listSnaps(code, limit = 10) {
  const supabase = await getClient();
  const { data, error } = await supabase
    .from('photo_moments').select('day, photo_a, photo_b')
    .eq('duo_code', code)
    .not('photo_a', 'is', null).not('photo_b', 'is', null)
    .order('day', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function saveSnap(code, day, photoDataUrl) {
  const supabase = await getClient();
  const { data, error } = await supabase.rpc('save_snap', {
    p_duo_code: code, p_day: day, p_photo: photoDataUrl
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function snapChannel(code) {
  const supabase = await getClient();
  let cb = () => {};
  const ch = supabase
    .channel('snap-' + code, { config: { broadcast: { self: true } } })
    .on('broadcast', { event: 'm' }, p => cb(p.payload))
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'photo_moments', filter: `duo_code=eq.${code}` },
      () => cb({ k: 'snap' }))
    .subscribe();
  return {
    send: payload => ch.send({ type: 'broadcast', event: 'm', payload }),
    on: fn => { cb = fn; },
    close: () => supabase.removeChannel(ch)
  };
}

function loadImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('Could not load a photo for the diptych.'));
    img.src = src;
  });
}

export async function downloadTodayDiptych({ photoA, photoB, nameA, nameB, day }) {
  if (!photoA || !photoB) throw new Error('Both photos are needed.');
  const [imgA, imgB] = await Promise.all([loadImage(photoA), loadImage(photoB)]);
  const W = 1080;
  const H = 1350;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d');

  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#241B33');
  bg.addColorStop(1, '#170F1F');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  g.globalAlpha = 0.12;
  g.font = '54px serif';
  g.textAlign = 'center';
  for (let i = 0; i < 14; i++) {
    g.fillStyle = i % 2 ? '#FF7FA8' : '#7FA8FF';
    g.fillText('\u2665', (i * 173 + 90) % W, (i * 311 + 120) % H);
  }
  g.globalAlpha = 1;

  const drawPolaroid = (img, cx, cy, rot, caption) => {
    const pw = 470;
    const ph = 560;
    const pad = 26;
    g.save();
    g.translate(cx, cy);
    g.rotate(rot);
    g.shadowColor = 'rgba(0,0,0,.5)';
    g.shadowBlur = 34;
    g.shadowOffsetY = 12;
    g.fillStyle = '#FAF6EE';
    g.fillRect(-pw / 2, -ph / 2, pw, ph);
    g.shadowColor = 'transparent';
    g.drawImage(img, -pw / 2 + pad, -ph / 2 + pad, pw - pad * 2, pw - pad * 2);
    g.fillStyle = '#3A2E44';
    g.font = 'italic 34px Georgia';
    g.textAlign = 'center';
    g.fillText(caption, 0, ph / 2 - 34);
    g.restore();
  };

  drawPolaroid(imgA, W * 0.34, H * 0.40, -0.09, nameA || 'A');
  drawPolaroid(imgB, W * 0.66, H * 0.52, 0.09, nameB || 'B');

  g.fillStyle = '#FFC66E';
  g.font = '84px serif';
  g.textAlign = 'center';
  g.fillText('\u2665', W / 2, H * 0.47);

  g.fillStyle = '#F2EDF7';
  g.font = '900 52px Georgia';
  g.fillText(`${nameA} & ${nameB}`, W / 2, H - 170);
  g.fillStyle = '#A99FBC';
  g.font = '30px Georgia';
  const nice = new Date(day + 'T12:00:00').toLocaleDateString(undefined,
    { day: 'numeric', month: 'long', year: 'numeric' });
  g.fillText(nice, W / 2, H - 118);
  g.fillStyle = '#FFC66E';
  g.font = '700 24px Arial';
  g.fillText('D U O A R C A D E', W / 2, H - 58);

  const blob = await new Promise((res, rej) => {
    cv.toBlob(b => (b ? res(b) : rej(new Error('Could not build the image.'))), 'image/png');
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.download = `duoarcade-snap-${day}.png`;
  a.href = url;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
