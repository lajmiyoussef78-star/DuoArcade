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

function roundRectPath(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// center-crop to a square so faces never get stretched
function squareCrop(img) {
  const s = Math.min(img.width, img.height);
  return { sx: (img.width - s) / 2, sy: (img.height - s) / 2, s };
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

  /* ---- backdrop: soft dusk gradient + blurry bokeh glows + vignette ---- */
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
  glow(W * 0.80, H * 0.86, 340, '#FF7FA8', 0.10);
  glow(W * 0.12, H * 0.74, 280, '#FFC66E', 0.07);
  glow(W * 0.50, H * 0.45, 460, '#B48CE0', 0.08);

  // a few tiny star specks, barely-there
  for (let i = 0; i < 26; i++) {
    const x = (i * 379 + 71) % W;
    const y = (i * 523 + 137) % H;
    g.globalAlpha = 0.05 + (i % 4) * 0.02;
    g.fillStyle = '#F6EFFA';
    g.beginPath();
    g.arc(x, y, i % 3 ? 1.4 : 2.2, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;

  const vin = g.createRadialGradient(W / 2, H * 0.46, H * 0.30, W / 2, H * 0.46, H * 0.78);
  vin.addColorStop(0, 'rgba(0,0,0,0)');
  vin.addColorStop(1, 'rgba(10,5,18,0.34)');
  g.fillStyle = vin;
  g.fillRect(0, 0, W, H);

  /* ---- small header ---- */
  g.textAlign = 'center';
  try { g.letterSpacing = '7px'; } catch { /* older canvas */ }
  g.fillStyle = 'rgba(246,239,250,0.55)';
  g.font = '500 24px Arial';
  g.fillText('ONE DAY \u00B7 ONE MOMENT', W / 2, 108);
  try { g.letterSpacing = '0px'; } catch { /* older canvas */ }

  /* ---- the two photo cards ---- */
  const drawCard = (img, cx, cy, rot, caption) => {
    const pw = 500;                    // card width
    const pad = 22;                    // card border
    const photo = pw - pad * 2;        // square photo
    const ph = pad + photo + 88;       // room for the caption below
    const { sx, sy, s } = squareCrop(img);
    g.save();
    g.translate(cx, cy);
    g.rotate(rot);

    // soft, wide shadow
    g.shadowColor = 'rgba(12,6,22,0.55)';
    g.shadowBlur = 60;
    g.shadowOffsetY = 26;
    g.fillStyle = '#FFFBF4';
    roundRectPath(g, -pw / 2, -ph / 2, pw, ph, 20);
    g.fill();
    g.shadowColor = 'transparent';

    // photo with rounded corners
    g.save();
    roundRectPath(g, -pw / 2 + pad, -ph / 2 + pad, photo, photo, 12);
    g.clip();
    g.drawImage(img, sx, sy, s, s, -pw / 2 + pad, -ph / 2 + pad, photo, photo);
    // gentle warm wash so both photos sit in the same light
    g.fillStyle = 'rgba(255,198,110,0.06)';
    g.fillRect(-pw / 2 + pad, -ph / 2 + pad, photo, photo);
    g.restore();

    // handwritten-style caption
    g.fillStyle = '#6B5A7A';
    g.font = 'italic 400 33px Georgia';
    g.textAlign = 'center';
    g.fillText(caption, 0, ph / 2 - 32);
    g.restore();
  };

  drawCard(imgA, W * 0.33, H * 0.365, -0.05, nameA || 'A');
  drawCard(imgB, W * 0.67, H * 0.55, 0.05, nameB || 'B');

  // a small gold heart "sticker" pinning the two cards together
  g.save();
  g.translate(W * 0.453, H * 0.323);
  g.rotate(0.14);
  g.shadowColor = 'rgba(12,6,22,0.45)';
  g.shadowBlur = 14;
  g.shadowOffsetY = 4;
  g.fillStyle = '#FFC66E';
  g.font = '58px serif';
  g.textAlign = 'center';
  g.fillText('\u2665', 0, 18);
  g.restore();

  /* ---- bottom block: divider, names, date, wordmark ---- */
  const baseY = H - 218;

  g.strokeStyle = 'rgba(246,239,250,0.22)';
  g.lineWidth = 1;
  g.beginPath(); g.moveTo(W / 2 - 180, baseY); g.lineTo(W / 2 - 34, baseY); g.stroke();
  g.beginPath(); g.moveTo(W / 2 + 34, baseY); g.lineTo(W / 2 + 180, baseY); g.stroke();
  g.fillStyle = 'rgba(255,198,110,0.85)';
  g.font = '22px serif';
  g.fillText('\u2665', W / 2, baseY + 8);

  // names — gold italic ampersand between soft-white serif names
  const fName = '600 54px Georgia';
  const fAmp = 'italic 400 46px Georgia';
  g.font = fName;
  const w1 = g.measureText(nameA).width;
  const w2 = g.measureText(nameB).width;
  g.font = fAmp;
  const wa = g.measureText('  &  ').width;
  let x = W / 2 - (w1 + wa + w2) / 2;
  g.textAlign = 'left';
  g.fillStyle = '#F6EFFA';
  g.font = fName;
  g.fillText(nameA, x, baseY + 78); x += w1;
  g.fillStyle = '#FFC66E';
  g.font = fAmp;
  g.fillText('  &  ', x, baseY + 78); x += wa;
  g.fillStyle = '#F6EFFA';
  g.font = fName;
  g.fillText(nameB, x, baseY + 78);
  g.textAlign = 'center';

  const nice = new Date(day + 'T12:00:00').toLocaleDateString(undefined,
    { day: 'numeric', month: 'long', year: 'numeric' });
  try { g.letterSpacing = '5px'; } catch { /* older canvas */ }
  g.fillStyle = 'rgba(185,174,203,0.9)';
  g.font = '400 26px Arial';
  g.fillText(nice.toUpperCase(), W / 2, baseY + 132);

  try { g.letterSpacing = '9px'; } catch { /* older canvas */ }
  g.fillStyle = 'rgba(255,198,110,0.75)';
  g.font = '700 21px Arial';
  g.fillText('DUOARCADE', W / 2, H - 44);
  try { g.letterSpacing = '0px'; } catch { /* older canvas */ }

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
