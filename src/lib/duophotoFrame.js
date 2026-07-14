// src/lib/duophotoFrame.js — love-themed combined photo frame.

import { THEMES } from './util.js';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function roundPhoto(g, img, cx, cy, r) {
  g.save();
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.closePath();
  g.clip();
  const side = r * 2;
  const scale = Math.max(side / img.width, side / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  g.drawImage(img, cx - w / 2, cy - h / 2, w, h);
  g.restore();
}

function drawHeart(g, cx, cy, size, color) {
  g.save();
  g.fillStyle = color;
  g.beginPath();
  const s = size;
  g.moveTo(cx, cy + s * 0.3);
  g.bezierCurveTo(cx, cy, cx - s, cy, cx - s, cy + s * 0.3);
  g.bezierCurveTo(cx - s, cy + s * 0.7, cx, cy + s * 0.95, cx, cy + s * 1.2);
  g.bezierCurveTo(cx, cy + s * 0.95, cx + s, cy + s * 0.7, cx + s, cy + s * 0.3);
  g.bezierCurveTo(cx + s, cy, cx, cy, cx, cy + s * 0.3);
  g.fill();
  g.restore();
}

export async function renderDuoPhotoFrame({ duo, photos, themeName = 'night' }) {
  const th = THEMES[themeName] || THEMES.night;
  const W = 1080, H = 1350;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d');

  const grad = g.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#120e18');
  grad.addColorStop(0.45, '#1a1424');
  grad.addColorStop(1, '#0f0b14');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);

  g.strokeStyle = th.candle;
  g.lineWidth = 6;
  g.strokeRect(28, 28, W - 56, H - 56);

  g.fillStyle = th.candle;
  g.font = '700 36px Georgia';
  g.textAlign = 'center';
  g.fillText('TODAY\'S MOMENT', W / 2, 100);

  const r = 210;
  const y = 430;
  const xA = W * 0.32;
  const xB = W * 0.68;

  if (photos.A?.data) {
    const imgA = await loadImage(photos.A.data);
    roundPhoto(g, imgA, xA, y, r);
  } else {
    g.fillStyle = 'rgba(255,255,255,.06)';
    g.beginPath();
    g.arc(xA, y, r, 0, Math.PI * 2);
    g.fill();
  }
  if (photos.B?.data) {
    const imgB = await loadImage(photos.B.data);
    roundPhoto(g, imgB, xB, y, r);
  } else {
    g.fillStyle = 'rgba(255,255,255,.06)';
    g.beginPath();
    g.arc(xB, y, r, 0, Math.PI * 2);
    g.fill();
  }

  g.strokeStyle = th.p1;
  g.lineWidth = 8;
  g.beginPath();
  g.arc(xA, y, r, 0, Math.PI * 2);
  g.stroke();

  g.strokeStyle = th.p2;
  g.beginPath();
  g.arc(xB, y, r, 0, Math.PI * 2);
  g.stroke();

  drawHeart(g, W / 2, y - 20, 42, th.candle);

  g.fillStyle = th.p1;
  g.font = '900 52px Georgia';
  g.fillText(duo.nameA || 'A', xA, y + r + 72);
  g.fillStyle = th.p2;
  g.fillText(duo.nameB || 'B', xB, y + r + 72);

  g.fillStyle = '#A99FBC';
  g.font = '400 34px Arial';
  g.fillText(new Date().toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  }), W / 2, H - 120);

  g.fillStyle = th.candle;
  g.font = '700 28px Arial';
  g.fillText('DUOARCADE', W / 2, H - 68);

  return cv;
}

export async function downloadDuoPhotoFrame(opts) {
  const cv = await renderDuoPhotoFrame(opts);
  const link = document.createElement('a');
  const slug = `${opts.duo.nameA}-${opts.duo.nameB}`.toLowerCase().replace(/\s+/g, '-');
  link.download = `duoarcade-moment-${slug}.png`;
  link.href = cv.toDataURL('image/png');
  link.click();
}
