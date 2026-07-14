// src/lib/duophotoFrame.js — love-themed combined photo frame.

import { THEMES } from './util.js';

// Fixed layout so the preview does not flicker between redraws.
const HEARTS = [
  { x: 0.08, y: 0.18, s: 34, a: 0.07, rot: -0.4, c: 'p1' },
  { x: 0.22, y: 0.42, s: 22, a: 0.06, rot: 0.2, c: 'candle' },
  { x: 0.14, y: 0.68, s: 40, a: 0.05, rot: 0.5, c: 'p2' },
  { x: 0.38, y: 0.28, s: 18, a: 0.08, rot: -0.1, c: 'p1' },
  { x: 0.48, y: 0.55, s: 26, a: 0.09, rot: 0.35, c: 'candle' },
  { x: 0.62, y: 0.2, s: 30, a: 0.06, rot: -0.25, c: 'p2' },
  { x: 0.78, y: 0.38, s: 24, a: 0.07, rot: 0.15, c: 'p1' },
  { x: 0.88, y: 0.62, s: 36, a: 0.05, rot: -0.5, c: 'candle' },
  { x: 0.72, y: 0.74, s: 20, a: 0.08, rot: 0.4, c: 'p2' },
  { x: 0.54, y: 0.78, s: 28, a: 0.06, rot: -0.2, c: 'p1' },
  { x: 0.32, y: 0.82, s: 16, a: 0.09, rot: 0.6, c: 'candle' },
  { x: 0.92, y: 0.24, s: 14, a: 0.07, rot: 0.1, c: 'p2' }
];

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawHeart(g, cx, cy, size, color, alpha = 1) {
  g.save();
  g.globalAlpha = alpha;
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

function drawHearts(g, W, H, th) {
  const colors = { p1: th.p1, p2: th.p2, candle: th.candle };
  for (const h of HEARTS) {
    g.save();
    g.translate(h.x * W, h.y * H);
    g.rotate(h.rot);
    drawHeart(g, 0, 0, h.s, colors[h.c] || th.candle, h.a);
    g.restore();
  }
}

function coverPhoto(g, img, x, y, w, h) {
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  g.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  g.restore();
}

function drawEmptyHalf(g, x, y, w, h, accent) {
  const grad = g.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, 'rgba(255,255,255,.04)');
  grad.addColorStop(1, 'rgba(255,255,255,.01)');
  g.fillStyle = grad;
  g.fillRect(x, y, w, h);
  g.strokeStyle = accent;
  g.globalAlpha = 0.35;
  g.lineWidth = 2;
  g.setLineDash([10, 14]);
  g.strokeRect(x + 18, y + 18, w - 36, h - 36);
  g.setLineDash([]);
  g.globalAlpha = 1;
}

export async function renderDuoPhotoFrame({ duo, photos, themeName = 'night' }) {
  const th = THEMES[themeName] || THEMES.night;
  const W = 1080, H = 1350;
  const pad = 36;
  const photoTop = 128;
  const photoBottom = H - 200;
  const photoH = photoBottom - photoTop;
  const halfW = (W - pad * 2) / 2;
  const leftX = pad;
  const rightX = pad + halfW;

  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d');

  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#14101c');
  bg.addColorStop(0.5, '#100d15');
  bg.addColorStop(1, '#0c0a11');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);

  drawHearts(g, W, H, th);

  g.strokeStyle = th.candle;
  g.globalAlpha = 0.55;
  g.lineWidth = 3;
  g.strokeRect(pad - 4, pad - 4, W - pad * 2 + 8, H - pad * 2 + 8);
  g.globalAlpha = 1;

  g.fillStyle = th.candle;
  g.font = '700 32px Georgia';
  g.textAlign = 'center';
  g.fillText('TODAY\'S MOMENT', W / 2, 88);

  g.fillStyle = 'rgba(0,0,0,.25)';
  g.fillRect(leftX, photoTop, W - pad * 2, photoH);

  if (photos.A?.data) {
    const imgA = await loadImage(photos.A.data);
    coverPhoto(g, imgA, leftX, photoTop, halfW, photoH);
  } else {
    drawEmptyHalf(g, leftX, photoTop, halfW, photoH, th.p1);
  }

  if (photos.B?.data) {
    const imgB = await loadImage(photos.B.data);
    coverPhoto(g, imgB, rightX, photoTop, halfW, photoH);
  } else {
    drawEmptyHalf(g, rightX, photoTop, halfW, photoH, th.p2);
  }

  const shade = g.createLinearGradient(0, photoTop, 0, photoBottom);
  shade.addColorStop(0, 'rgba(0,0,0,.18)');
  shade.addColorStop(0.55, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(0,0,0,.42)');
  g.fillStyle = shade;
  g.fillRect(leftX, photoTop, W - pad * 2, photoH);

  g.strokeStyle = 'rgba(255,255,255,.22)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(W / 2, photoTop);
  g.lineTo(W / 2, photoBottom);
  g.stroke();

  g.strokeStyle = th.p1;
  g.lineWidth = 4;
  g.strokeRect(leftX, photoTop, halfW, photoH);
  g.strokeStyle = th.p2;
  g.strokeRect(rightX, photoTop, halfW, photoH);

  g.font = '900 44px Georgia';
  g.textAlign = 'center';
  g.fillStyle = 'rgba(255,255,255,.95)';
  g.shadowColor = 'rgba(0,0,0,.55)';
  g.shadowBlur = 12;
  g.fillText(duo.nameA || 'A', leftX + halfW / 2, photoBottom - 24);
  g.fillText(duo.nameB || 'B', rightX + halfW / 2, photoBottom - 24);
  g.shadowBlur = 0;

  g.fillStyle = '#9a92ad';
  g.font = '400 30px Arial';
  g.fillText(new Date().toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  }), W / 2, H - 108);

  g.fillStyle = th.candle;
  g.font = '700 26px Arial';
  g.fillText('DUOARCADE', W / 2, H - 62);

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
