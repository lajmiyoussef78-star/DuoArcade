// CoupleFx.jsx — couple-themed animated pieces: milestone celebrations,
// the "together" hero (duration + anniversary ring), and confetti bursts.
// All colors come from the theme CSS variables so duo themes restyle them.

import { useEffect, useMemo, useState } from 'react';
import { other } from '../lib/util.js';
import { formatDistance, haversineKm } from '../lib/location.js';

const FX_COLORS = ['var(--p1)', 'var(--p2)', '--candle', 'var(--text)']
  .map(c => (c === '--candle' ? 'var(--candle)' : c));

export function confettiPieces(n, { small = false } = {}) {
  return Array.from({ length: n }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * (small ? 0.5 : 1.2),
    dur: (small ? 1.6 : 2.6) + Math.random() * (small ? 1 : 1.8),
    w: 5 + Math.random() * 6,
    h: 8 + Math.random() * 8,
    spin: (Math.random() > 0.5 ? '' : '-') + (420 + Math.random() * 460) + 'deg',
    color: FX_COLORS[i % FX_COLORS.length],
    round: Math.random() > 0.72
  }));
}

export function Confetti({ count = 60, small = false }) {
  const pieces = useMemo(() => confettiPieces(count, { small }), [count, small]);
  return pieces.map(p => (
    <span key={p.id} className={'cfx-confetti' + (small ? ' small' : '')}
      style={{
        left: p.left + '%', width: p.w, height: p.round ? p.w : p.h,
        background: p.color, borderRadius: p.round ? '50%' : 2,
        animationDelay: p.delay + 's', animationDuration: p.dur + 's', '--spin': p.spin
      }} />
  ));
}

/* ---------- D: milestone celebration overlay ---------- */

export function Celebration({ title, sub, icon = '🏆', onClose }) {
  const hearts = useMemo(() => Array.from({ length: 7 }, (_, i) => ({
    id: i, left: 6 + i * 13 + Math.random() * 6,
    delay: Math.random() * 3, size: 13 + Math.random() * 12,
    color: i % 2 ? 'var(--p2)' : 'var(--p1)'
  })), []);

  useEffect(() => {
    const t = setTimeout(onClose, 5200);
    const esc = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => { clearTimeout(t); window.removeEventListener('keydown', esc); };
  }, [onClose]);

  return (
    <div className="cfx-celebrate" onClick={onClose}>
      <Confetti count={70} />
      {hearts.map(h => (
        <span key={h.id} className="cfx-heart"
          style={{ left: h.left + '%', fontSize: h.size, color: h.color, animationDelay: h.delay + 's' }}>
          {'❤'}
        </span>
      ))}
      <div className="cfx-badge" onClick={e => e.stopPropagation()}>
        <div className="cfx-rays" />
        <div className="cfx-trophy">{icon}</div>
        <div className="cfx-title">{title}</div>
        <div className="cfx-sub">{sub}</div>
      </div>
    </div>
  );
}

/* ---------- E: together hero ---------- */

function parseDay(iso) {
  if (!iso) return null;
  const d = new Date(typeof iso === 'string' && iso.length === 10 ? iso + 'T12:00:00' : iso);
  return Number.isFinite(d.getTime()) ? d : null;
}

function elapsedParts(from, now = Date.now()) {
  const start = from instanceof Date ? from : parseDay(from);
  if (!start) return null;
  let ms = Math.max(0, now - start.getTime());
  const days = Math.floor(ms / 864e5);
  ms %= 864e5;
  const hours = Math.floor(ms / 36e5);
  ms %= 36e5;
  const minutes = Math.floor(ms / 6e4);
  ms %= 6e4;
  const seconds = Math.floor(ms / 1e3);
  return { days, hours, minutes, seconds };
}

// Relationship start = the saved anniversary date. If the year is still ahead,
// walk back until we're counting from a real past date.
function relationshipStart(anniv) {
  if (!anniv) return null;
  const stored = parseDay(anniv);
  if (!stored) return null;
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  const start = new Date(stored);
  start.setHours(12, 0, 0, 0);
  while (start > now) start.setFullYear(start.getFullYear() - 1);
  return start;
}

function formatLongDate(when) {
  const d = when instanceof Date ? when : parseDay(when);
  if (!d || !Number.isFinite(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

const annivKey = code => 'duoarcade-anniv-' + code;

/* ---------- approximate low-poly world map (equirectangular) ----------
   Vertices are [lat, lng]; x = lng + 180, y = 90 - lat (viewBox 360x150,
   Antarctica cropped). Pins use the same projection so they always line up. */
const CM_LAND = [
  // North America
  [[71, -156], [70, -125], [73, -95], [66, -82], [62, -64], [47, -52], [44, -66], [35, -75], [25, -80], [29, -90], [18, -96], [15, -92], [8, -77], [16, -100], [23, -110], [32, -117], [46, -124], [59, -140], [64, -166]],
  // Greenland
  [[83, -35], [70, -22], [60, -43], [75, -58], [80, -60]],
  // South America
  [[8, -77], [12, -72], [10, -61], [0, -50], [-8, -35], [-23, -42], [-35, -57], [-51, -69], [-55, -68], [-42, -73], [-18, -70], [-5, -81]],
  // Africa
  [[35, -6], [37, 10], [31, 32], [15, 39], [11, 51], [-2, 41], [-16, 40], [-26, 33], [-34, 20], [-23, 14], [-6, 12], [4, -8], [12, -16], [21, -17], [28, -12]],
  // Eurasia
  [[36, -9], [43, -9], [48, -5], [51, 2], [56, 8], [71, 26], [73, 70], [77, 105], [71, 140], [66, 178], [60, 162], [52, 143], [43, 132], [37, 122], [30, 121], [21, 108], [8, 105], [13, 100], [1, 103], [14, 98], [21, 89], [8, 77], [19, 72], [25, 62], [13, 45], [29, 33], [36, 28], [40, 26], [36, 22], [43, 7], [36, -5]],
  // British Isles
  [[59, -4], [53, 1], [50, -5], [54, -8]],
  // Japan
  [[45, 142], [36, 140], [31, 131], [40, 139]],
  // Sumatra / Borneo / New Guinea
  [[5, 95], [-6, 106], [0, 101]],
  [[6, 114], [-3, 116], [0, 109]],
  [[-2, 131], [-9, 147], [-6, 135]],
  // Australia
  [[-11, 132], [-12, 142], [-19, 148], [-28, 154], [-38, 150], [-38, 141], [-34, 116], [-22, 114], [-14, 126]],
  // Madagascar
  [[-12, 49], [-25, 47], [-20, 44]],
  // New Zealand
  [[-36, 174], [-46, 168], [-41, 172]],
];

const cmX = lng => lng + 180;
const cmY = lat => 90 - lat;

/* Halftone dot-grid world: dots sit on a regular grid wherever there is land.
   The coarse polygons above are only used as a land mask, so the coastlines
   read soft and intentional instead of hand-drawn. Computed once. */
const CM_DOTS = (() => {
  const polys = CM_LAND.map(poly => poly.map(([lat, lng]) => [cmX(lng), cmY(lat)]));
  const onLand = (x, y) => polys.some(pts => {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  });
  const dots = [];
  for (let y = 8; y <= 144; y += 3) {
    for (let x = 2; x <= 358; x += 3) {
      if (onLand(x, y)) dots.push([x, y]);
    }
  }
  return dots;
})();

const CM_NEAR = 8; /* dots this close to a pin take that partner's color */

function ChWorldMap({ a, b }) {
  const A = a?.lat != null && a?.lng != null ? { x: cmX(a.lng), y: cmY(a.lat) } : null;
  const B = b?.lat != null && b?.lng != null ? { x: cmX(b.lng), y: cmY(b.lat) } : null;

  /* Proportional map, full width; the crop band follows the pins' latitude */
  const cy = A && B ? (A.y + B.y) / 2 : (A || B) ? (A || B).y : 52;
  const band = cy < 60 ? 'xMidYMin' : cy < 96 ? 'xMidYMid' : 'xMidYMax';

  let arc = null, heart = null;
  if (A && B) {
    const lift = Math.max(6, Math.hypot(B.x - A.x, B.y - A.y) * 0.24);
    const C = { x: (A.x + B.x) / 2, y: Math.min(A.y, B.y) - lift };
    arc = `M ${A.x} ${A.y} Q ${C.x} ${C.y} ${B.x} ${B.y}`;
    heart = { x: (A.x + 2 * C.x + B.x) / 4, y: (A.y + 2 * C.y + B.y) / 4 };
  }

  const dotClass = (x, y) => {
    const dA = A ? Math.hypot(x - A.x, y - A.y) : Infinity;
    const dB = B ? Math.hypot(x - B.x, y - B.y) : Infinity;
    if (Math.min(dA, dB) > CM_NEAR) return 'cm-dot';
    return dA <= dB ? 'cm-dot cm-dot-a' : 'cm-dot cm-dot-b';
  };

  const pin = (P, cls) => (
    <g className={'cm-pin ' + cls}>
      <circle className="cm-halo" cx={P.x} cy={P.y} r="4.2" />
      <circle className="cm-ring" cx={P.x} cy={P.y} r="2.9" strokeWidth="0.7" />
      <circle className="cm-core" cx={P.x} cy={P.y} r="1.4" />
    </g>
  );

  return (
    <svg className="ch-map" viewBox="0 5 360 142"
      preserveAspectRatio={band + ' slice'} aria-hidden="true">
      {CM_DOTS.map(([x, y], i) => (
        <circle key={i} className={dotClass(x, y)} cx={x} cy={y} r="0.85" />
      ))}
      {arc && <path className="cm-arc" d={arc} strokeWidth="0.9" strokeDasharray="2.5 2.5" />}
      {heart && (
        <g className="cm-heart" transform={`translate(${heart.x} ${heart.y - 2.4}) scale(0.42)`}>
          <path d="M0 3.4 C-3.4 0.4 -4.6 -2 -2.9 -3.7 C-1.5 -5 0 -3.9 0 -2.4 C0 -3.9 1.5 -5 2.9 -3.7 C4.6 -2 3.4 0.4 0 3.4 Z" />
        </g>
      )}
      {A && pin(A, 'cm-pin-a')}
      {B && pin(B, 'cm-pin-b')}
    </svg>
  );
}

export function TogetherHero({ duo, code, myRole, presence, geoStatus, onSetAnniversary }) {
  // the shared date lives on the duo row now — same for both partners
  const anniv = duo.anniversary || '';
  const [editing, setEditing] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // one-time migration: a date saved on this device before the sync existed
  // gets pushed up to the duo (first device to open wins)
  useEffect(() => {
    const legacy = localStorage.getItem(annivKey(code));
    if (!duo.anniversary && legacy) onSetAnniversary(legacy);
    if (duo.anniversary && legacy) localStorage.removeItem(annivKey(code));
  }, [duo.anniversary, code, onSetAnniversary]);

  const stars = useMemo(() => Array.from({ length: 14 }, (_, i) => ({
    id: i, left: Math.random() * 100, top: Math.random() * 100, delay: Math.random() * 4
  })), []);

  const relStart = relationshipStart(anniv);
  const dur = relStart ? elapsedParts(relStart, now) : null;

  /* anniversary countdown: next occurrence of the saved date */
  let ringDays = null;
  if (anniv) {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const a = new Date(anniv + 'T00:00:00');
    const next = new Date(now.getFullYear(), a.getMonth(), a.getDate());
    if (next < now) next.setFullYear(next.getFullYear() + 1);
    ringDays = Math.round((next - now) / 864e5);
  }
  const R = 40, CIRC = 2 * Math.PI * R;
  const ringFrac = ringDays === null ? 0 : 1 - ringDays / 365;

  const saveAnniv = v => {
    if (v) onSetAnniversary(v);
    setEditing(false);
  };

  const partnerRole = other(myRole);
  const mine = presence?.[myRole];
  const theirs = presence?.[partnerRole];
  const partnerName = partnerRole === 'A' ? duo.nameA : duo.nameB;
  const apart = mine?.lat != null && mine?.lng != null && theirs?.lat != null && theirs?.lng != null
    ? haversineKm(mine.lat, mine.lng, theirs.lat, theirs.lng)
    : null;
  const distanceLine = (() => {
    if (apart != null) return `\u2194 ${formatDistance(apart)} apart`;
    if (mine?.lat == null || mine?.lng == null) {
      return geoStatus ? `\u2194 ${geoStatus}` : '\u2194 waiting for your location\u2026';
    }
    if (!theirs?.online) return null;
    if (theirs?.lat == null || theirs?.lng == null) {
      return `\u2194 waiting for ${partnerName}\u2019s location\u2026`;
    }
    return '\u2194 calculating distance\u2026';
  })();

  return (
    <div className="ch-hero">
      <ChWorldMap a={presence?.A} b={presence?.B} />
      <div className="ch-stars">
        {stars.map(s => (
          <span key={s.id} className="st"
            style={{ left: s.left + '%', top: s.top + '%', animationDelay: s.delay + 's' }} />
        ))}
      </div>

      <div className="ch-avs">
        <div className="ch-av A">{(duo.nameA || '?')[0].toUpperCase()}</div>
        <svg className="ch-beat" viewBox="0 0 64 24">
          <defs>
            <linearGradient id="chbeat-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--p1)" />
              <stop offset="50%" stopColor="var(--candle)" />
              <stop offset="100%" stopColor="var(--p2)" />
            </linearGradient>
          </defs>
          <path className="base" d="M0 12 H16 L21 5 L27 19 L32 12 H38 L43 7 L48 17 L52 12 H64" />
          <path className="run" d="M0 12 H16 L21 5 L27 19 L32 12 H38 L43 7 L48 17 L52 12 H64" />
        </svg>
        <div className="ch-av B">{(duo.nameB || '?')[0].toUpperCase()}</div>
      </div>

      <div className="ch-mid">
        <div className="ch-label">Together for</div>
        <div className="ch-count">
          {!dur ? (
            <button type="button" className="ch-setdate" onClick={() => setEditing(true)}>
              set your anniversary {'→'}
            </button>
          ) : (
            <>
              <span><b>{dur.days}</b> day{dur.days === 1 ? '' : 's'}</span>
              {', '}
              <span><b>{dur.hours}</b> hour{dur.hours === 1 ? '' : 's'}</span>
              {', '}
              <span><b>{dur.minutes}</b> minute{dur.minutes === 1 ? '' : 's'}</span>
              {', '}
              <span className="ch-sec"><b>{dur.seconds}</b> second{dur.seconds === 1 ? '' : 's'}</span>
            </>
          )}
        </div>
        <div className="ch-locs">
          <div className="ch-loc-row">
            <span className="ch-loc-dot you" aria-hidden="true" />
            <span className="ch-loc-label">You</span>
            <span className="ch-loc-val">
              {mine?.place ? <b>{mine.place}</b> : geoStatus || 'Locating…'}
            </span>
          </div>
          <div className="ch-loc-row">
            <span className="ch-loc-dot partner" aria-hidden="true" />
            <span className="ch-loc-label">{partnerName}</span>
            <span className="ch-loc-val">
              {theirs?.place ? <b>{theirs.place}</b>
                : theirs?.online ? 'Locating…' : 'Offline'}
            </span>
          </div>
          {distanceLine && (
            <div className="ch-apart">{distanceLine}</div>
          )}
        </div>
        {anniv && relStart && (
          <div className="ch-since">
            together since <b>{formatLongDate(relStart)}</b>
          </div>
        )}
      </div>

      {ringDays !== null && !editing ? (
        <div className="ch-ring" title="Tap to change the date" style={{ cursor: 'pointer' }}
          onClick={() => setEditing(true)}>
          <svg width="92" height="92" viewBox="0 0 92 92">
            <circle className="bgc" cx="46" cy="46" r={R} fill="none" strokeWidth="5" />
            <circle className="fgc" cx="46" cy="46" r={R} fill="none" strokeWidth="5"
              strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - ringFrac)} />
          </svg>
          <div className="ch-orbit" />
          <div className="num">
            <div className="n">{ringDays === 0 ? '🎉' : ringDays}</div>
            <div className="l">{ringDays === 0 ? 'happy anniversary!' : 'days to your anniversary'}</div>
          </div>
        </div>
      ) : (
        <div className="ch-set">
          <label style={{ margin: '0 0 5px' }}>When did you get together?</label>
          <input type="date" defaultValue={anniv}
            onChange={e => e.target.value && saveAnniv(e.target.value)} />
        </div>
      )}
    </div>
  );
}
