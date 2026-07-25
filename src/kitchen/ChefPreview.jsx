import { useEffect, useRef } from 'react';
import { characterUsesHat, normalizeChefLook, shirtShowsInitial } from './game/cosmetics/chefLook';

const OUT = '#1a120c';

function hex(n) {
  return `#${(n >>> 0).toString(16).padStart(6, '0')}`;
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Live canvas preview of a ChefLook (lobby try-on). */
export function ChefPreview({ look, label }) {
  const ref = useRef(null);
  const sig = JSON.stringify(normalizeChefLook(look));

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // stage
    const grd = ctx.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#fff8e1');
    grd.addColorStop(1, '#ffe0b2');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(191,54,12,0.08)';
    ctx.beginPath();
    ctx.ellipse(W / 2, H - 28, 70, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    const L = normalizeChefLook(look);
    const skin = hex(L.skinColor);
    const shirt = hex(L.shirtColor);
    const apron = hex(L.apronColor);
    const hat = hex(L.hatColor);
    const shoe = hex(L.shoeColor);
    const char = L.characterId;
    const cx = W / 2;
    const baseY = 48;
    const scale = 2.35;

    ctx.save();
    ctx.translate(cx, baseY);
    ctx.scale(scale, scale);

    const torsoW = char === 'man' ? 20 : char === 'kid' ? 15 : char === 'girl' ? 16.5 : 18;
    const headR = char === 'kid' ? 13.5 : char === 'girl' ? 12 : 12.5;
    const faceR = char === 'kid' ? 11.5 : char === 'girl' ? 10 : 10.5;
    const headY = char === 'kid' ? 15 : char === 'girl' ? 15.5 : 16;
    const armSpread = char === 'man' ? 13.5 : char === 'kid' ? 10.5 : 12;

    // legs / boots
    ctx.fillStyle = OUT;
    roundRect(ctx, -8, 34, 6, 14, 2); ctx.fill();
    roundRect(ctx, 2, 34, 6, 14, 2); ctx.fill();
    ctx.fillStyle = shoe;
    roundRect(ctx, -9, 44, 8, 5, 2); ctx.fill();
    roundRect(ctx, 1, 44, 8, 5, 2); ctx.fill();
    if (L.bootStyle === 'rainboots') {
      ctx.fillStyle = '#1565c0';
      roundRect(ctx, -9, 40, 8, 9, 2); ctx.fill();
      roundRect(ctx, 1, 40, 8, 9, 2); ctx.fill();
    } else if (L.bootStyle === 'workboots') {
      ctx.fillStyle = '#5d4037';
      roundRect(ctx, -9, 42, 8, 7, 2); ctx.fill();
      roundRect(ctx, 1, 42, 8, 7, 2); ctx.fill();
    } else if (L.bootStyle === 'hitops') {
      ctx.fillStyle = shoe;
      roundRect(ctx, -9, 38, 8, 11, 3); ctx.fill();
      roundRect(ctx, 1, 38, 8, 11, 3); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillRect(-8, 40, 6, 2);
      ctx.fillRect(2, 40, 6, 2);
    } else if (L.bootStyle === 'clogs') {
      ctx.fillStyle = '#ef6c00';
      roundRect(ctx, -10, 44, 9, 5, 2); ctx.fill();
      roundRect(ctx, 1, 44, 9, 5, 2); ctx.fill();
    } else if (L.bootStyle === 'chefs') {
      ctx.fillStyle = '#fafafa';
      roundRect(ctx, -9, 43, 8, 6, 2); ctx.fill();
      roundRect(ctx, 1, 43, 8, 6, 2); ctx.fill();
    }

    // torso
    ctx.fillStyle = OUT;
    roundRect(ctx, -torsoW / 2, 23, torsoW, 12, 5); ctx.fill();
    const ss = L.shirtStyle;
    if (ss === 'hoodie') {
      ctx.fillStyle = shirt;
      roundRect(ctx, -9, 22, 18, 13, 5); ctx.fill();
      ctx.fillStyle = apron;
      roundRect(ctx, -4, 26, 8, 6, 2); ctx.fill();
    } else if (ss === 'denim') {
      ctx.fillStyle = '#455a64';
      roundRect(ctx, -9, 22, 18, 13, 4); ctx.fill();
      ctx.fillStyle = shirt;
      roundRect(ctx, -7, 24, 14, 9, 3); ctx.fill();
    } else if (ss === 'suit') {
      ctx.fillStyle = '#37474f';
      roundRect(ctx, -8, 24, 16, 10, 3); ctx.fill();
      ctx.fillStyle = shirt;
      ctx.beginPath();
      ctx.moveTo(0, 24); ctx.lineTo(-5, 34); ctx.lineTo(5, 34); ctx.fill();
      ctx.fillStyle = apron;
      roundRect(ctx, -3, 27, 6, 6, 1); ctx.fill();
    } else if (ss === 'overalls') {
      ctx.fillStyle = shirt;
      roundRect(ctx, -8, 24, 16, 10, 3); ctx.fill();
      ctx.fillStyle = '#455a64';
      roundRect(ctx, -6, 22, 12, 11, 2); ctx.fill();
    } else if (ss === 'polo') {
      ctx.fillStyle = shirt;
      roundRect(ctx, -8, 24, 16, 10, 4); ctx.fill();
      ctx.fillStyle = apron;
      ctx.fillRect(-2, 24, 4, 2);
    } else {
      ctx.fillStyle = shirt;
      roundRect(ctx, -8, 24, 16, 10, 4); ctx.fill();
      if (!shirtShowsInitial(ss)) {
        ctx.fillStyle = apron;
        roundRect(ctx, -5, 25, 10, 8, 3); ctx.fill();
      }
      if (ss === 'striped') {
        ctx.fillStyle = 'rgba(26,18,12,0.35)';
        for (let i = 0; i < 4; i++) ctx.fillRect(-7 + i * 4, 24, 1.5, 10);
      }
      if (ss === 'checkered') {
        ctx.fillStyle = 'rgba(26,18,12,0.28)';
        ctx.fillRect(-4, 26, 3, 3);
        ctx.fillRect(1, 29, 3, 3);
      }
      if (shirtShowsInitial(ss)) {
        ctx.fillStyle = apron;
        roundRect(ctx, -5, 26, 10, 7, 2); ctx.fill();
        ctx.fillStyle = OUT;
        ctx.font = 'bold 7px Sora, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText((L.shirtInitial || 'G').slice(0, 1), 0, 29.5);
      }
    }

    // arms
    ctx.fillStyle = OUT;
    ctx.beginPath(); ctx.arc(-armSpread, 27, char === 'kid' ? 4 : 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(armSpread, 27, char === 'kid' ? 4 : 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(-armSpread, 27, char === 'kid' ? 2.8 : 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(armSpread, 27, char === 'kid' ? 2.8 : 3.5, 0, Math.PI * 2); ctx.fill();

    // Girl: long hair behind the head first
    if (char === 'girl') {
      ctx.fillStyle = OUT;
      ctx.beginPath(); ctx.ellipse(0, headY + 1, 15, 13, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = hat;
      ctx.beginPath(); ctx.ellipse(0, headY + 1, 13, 11, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = OUT;
      ctx.beginPath(); ctx.ellipse(-12, headY + 9, 6.5, 14, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(12, headY + 9, 6.5, 14, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = hat;
      ctx.beginPath(); ctx.ellipse(-12, headY + 9, 5, 12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(12, headY + 9, 5, 12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = OUT;
      ctx.beginPath(); ctx.arc(-12, headY + 21, 4.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(12, headY + 21, 4.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = hat;
      ctx.beginPath(); ctx.arc(-12, headY + 21, 3.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(12, headY + 21, 3.2, 0, Math.PI * 2); ctx.fill();
    }

    // head
    ctx.fillStyle = OUT;
    ctx.beginPath(); ctx.arc(0, headY, headR, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(0, headY, faceR, 0, Math.PI * 2); ctx.fill();

    // blush + face
    ctx.fillStyle = 'rgba(255,171,145,0.95)';
    const blushW = char === 'girl' ? 5 : 4;
    const blushH = char === 'girl' ? 3 : 2.5;
    ctx.beginPath(); ctx.ellipse(-7, headY + 2, blushW, blushH, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(7, headY + 2, blushW, blushH, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = OUT;
    const eyeR = char === 'girl' ? 2.35 : 2;
    const ey = headY - (char === 'girl' ? 0.5 : 1);
    ctx.beginPath(); ctx.arc(-4, ey, eyeR, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(4, ey, eyeR, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-4.5, ey - 0.5, 0.75, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(3.5, ey - 0.5, 0.75, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e57373';
    ctx.beginPath();
    ctx.ellipse(0, ey + (char === 'girl' ? 5.5 : 5), char === 'man' ? 4 : char === 'girl' ? 4.5 : 5, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    if (char === 'elder') {
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(-4, headY - 1, 3.2, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(4, headY - 1, 3.2, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-1, headY - 1); ctx.lineTo(1, headY - 1); ctx.stroke();
    }

    // hair / hat
    if (characterUsesHat(char)) {
      if (L.hatStyle === 'toque') {
        ctx.fillStyle = OUT;
        roundRect(ctx, -8, headY - 18, 16, 14, 4); ctx.fill();
        ctx.fillStyle = hat;
        roundRect(ctx, -7, headY - 17, 14, 12, 3); ctx.fill();
        ctx.fillStyle = OUT;
        roundRect(ctx, -10, headY - 8, 20, 5, 2); ctx.fill();
        ctx.fillStyle = hat;
        roundRect(ctx, -9, headY - 7, 18, 3, 1); ctx.fill();
      } else {
        ctx.fillStyle = OUT;
        ctx.beginPath(); ctx.ellipse(0, headY - 6, 14, 7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = hat;
        ctx.beginPath(); ctx.ellipse(0, headY - 6, 12, 5.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = OUT;
        roundRect(ctx, -11, headY - 4, 22, 5, 2); ctx.fill();
        ctx.fillStyle = hat;
        roundRect(ctx, -10, headY - 3, 20, 3, 1); ctx.fill();
      }
    } else if (char === 'girl') {
      // Crown + soft bangs + ribbon (front of head)
      ctx.fillStyle = OUT;
      ctx.beginPath(); ctx.ellipse(0, headY - 7.5, 13.5, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = hat;
      ctx.beginPath(); ctx.ellipse(0, headY - 7.5, 11.5, 6.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = OUT;
      roundRect(ctx, -9.5, headY - 8, 6.5, 6.5, 3); ctx.fill();
      roundRect(ctx, -2, headY - 9, 4, 5.5, 2.5); ctx.fill();
      roundRect(ctx, 3, headY - 8, 6.5, 6.5, 3); ctx.fill();
      ctx.fillStyle = hat;
      roundRect(ctx, -8.5, headY - 7, 5, 5, 2.5); ctx.fill();
      roundRect(ctx, -1.5, headY - 8, 3, 4, 2); ctx.fill();
      roundRect(ctx, 3.5, headY - 7, 5, 5, 2.5); ctx.fill();
      ctx.fillStyle = OUT;
      ctx.beginPath(); ctx.ellipse(-10.5, headY + 2, 3, 6.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(10.5, headY + 2, 3, 6.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = hat;
      ctx.beginPath(); ctx.ellipse(-10.5, headY + 2, 2.2, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(10.5, headY + 2, 2.2, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c2185b';
      ctx.beginPath();
      ctx.moveTo(7, headY - 9); ctx.lineTo(13.5, headY - 12.5); ctx.lineTo(12.5, headY - 6); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(7, headY - 9); ctx.lineTo(13.5, headY - 5.5); ctx.lineTo(12.5, headY - 11.5); ctx.fill();
      ctx.fillStyle = '#e91e63';
      ctx.beginPath(); ctx.arc(7, headY - 9, 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f8bbd0';
      ctx.beginPath(); ctx.arc(7, headY - 9, 1.1, 0, Math.PI * 2); ctx.fill();
    } else if (char === 'lady') {
      ctx.fillStyle = OUT;
      ctx.beginPath(); ctx.ellipse(0, headY - 10, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(0, headY - 14, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = hat;
      ctx.beginPath(); ctx.ellipse(0, headY - 10, 7, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(0, headY - 14, 5.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd54f';
      ctx.beginPath(); ctx.arc(-11, headY + 2, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(11, headY + 2, 1.5, 0, Math.PI * 2); ctx.fill();
    } else if (char === 'man') {
      ctx.fillStyle = OUT;
      roundRect(ctx, -10, headY - 10, 20, 10, 4); ctx.fill();
      ctx.fillStyle = hat;
      roundRect(ctx, -9, headY - 9, 18, 8, 3); ctx.fill();
    } else if (char === 'kid') {
      ctx.fillStyle = OUT;
      ctx.beginPath(); ctx.ellipse(0, headY - 8, 11, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = hat;
      ctx.beginPath(); ctx.ellipse(0, headY - 8, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = OUT;
      ctx.beginPath(); ctx.moveTo(0, headY - 18); ctx.lineTo(-4, headY - 8); ctx.lineTo(4, headY - 8); ctx.fill();
      ctx.fillStyle = hat;
      ctx.beginPath(); ctx.moveTo(0, headY - 16); ctx.lineTo(-3, headY - 9); ctx.lineTo(3, headY - 9); ctx.fill();
    } else if (char === 'sous') {
      ctx.fillStyle = hat;
      ctx.beginPath(); ctx.ellipse(0, headY - 6, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c62828';
      roundRect(ctx, -11, headY - 8, 22, 7, 3); ctx.fill();
    } else if (char === 'waiter') {
      ctx.fillStyle = OUT;
      ctx.beginPath(); ctx.ellipse(0, headY - 7, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = hat;
      ctx.beginPath(); ctx.ellipse(0, headY - 7, 8, 3, 0, 0, Math.PI * 2); ctx.fill();
    } else if (char === 'elder') {
      ctx.fillStyle = OUT;
      ctx.beginPath(); ctx.ellipse(0, headY - 7, 11, 4.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#90a4ae';
      ctx.beginPath(); ctx.ellipse(0, headY - 7, 9, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    }

    ctx.restore();
  }, [sig, look]);

  return (
    <div className="rsc-preview">
      <canvas ref={ref} width={220} height={260} className="rsc-preview-canvas" />
      {label ? <p className="rsc-preview-label">{label}</p> : null}
    </div>
  );
}
