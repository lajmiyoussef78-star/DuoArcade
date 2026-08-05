// CoupleFx.jsx — couple-themed animated pieces: milestone celebrations,
// the "together" hero (duration + anniversary ring), and confetti bursts.
// All colors come from the theme CSS variables so duo themes restyle them.

import { useEffect, useMemo, useState } from 'react';
import { other } from '../lib/util.js';
import { formatDistance, haversineKm } from '../lib/location.js';
import { Avatar } from './avatars.jsx';

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

/* Soft eternal-love mark (heart + infinity) for the Together hero backdrop */
function ChLoveMark() {
  return (
    <svg className="cth-love" viewBox="0 0 120 110" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <defs>
        <linearGradient id="cth-love-grad" x1="0%" y1="8%" x2="100%" y2="92%">
          <stop offset="0%" stopColor="var(--color-primary)" />
          <stop offset="45%" stopColor="var(--candle)" />
          <stop offset="100%" stopColor="var(--color-secondary)" />
        </linearGradient>
        <filter id="cth-love-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* soft heart body */}
      <path
        className="cth-love-heart"
        fill="url(#cth-love-grad)"
        stroke="url(#cth-love-grad)"
        strokeWidth="2.2"
        strokeLinejoin="round"
        d="M60 102
           C38 82 14 64 10 46
           C6 28 18 14 36 14
           C48 14 56 22 60 32
           C64 22 72 14 84 14
           C102 14 114 28 110 46
           C106 64 82 82 60 102 Z"
      />
      {/* infinity woven across the upper lobes */}
      <path
        className="cth-love-inf"
        fill="none"
        stroke="url(#cth-love-grad)"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#cth-love-glow)"
        d="M22 40
           C22 26 34 20 46 28
           C54 34 58 42 60 48
           C62 42 66 34 74 28
           C86 20 98 26 98 40
           C98 52 86 58 74 52
           C66 48 62 42 60 36
           C58 42 54 48 46 52
           C34 58 22 52 22 40 Z"
      />
    </svg>
  );
}

export function TogetherHero({ duo, code, myRole, avatars, presence, geoStatus, onSetAnniversary }) {
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

  const stars = useMemo(() => Array.from({ length: 28 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    top: Math.random() * 100,
    size: 1.2 + Math.random() * 2.2,
    delay: Math.random() * 5,
    opacity: 0.18 + Math.random() * 0.35,
  })), []);

  const relStart = relationshipStart(anniv);
  const dur = relStart ? elapsedParts(relStart, now) : null;

  /* anniversary countdown: next occurrence of the saved date */
  let ringDays = null;
  if (anniv) {
    const day = new Date(); day.setHours(0, 0, 0, 0);
    const a = new Date(anniv + 'T00:00:00');
    const next = new Date(day.getFullYear(), a.getMonth(), a.getDate());
    if (next < day) next.setFullYear(next.getFullYear() + 1);
    ringDays = Math.round((next - day) / 864e5);
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
  const youOnline = mine?.online !== false;
  const partnerOnline = !!theirs?.online;

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

  const yourPlace = mine?.place
    ? mine.place
    : (geoStatus || (youOnline ? 'Locating…' : 'Offline'));
  const theirPlace = theirs?.busyLabel
    ? theirs.busyLabel
    : theirs?.place
      ? theirs.place
      : partnerOnline
        ? 'Locating…'
        : 'Offline';

  return (
    <div className="cth">
      <div className="cth-fx" aria-hidden="true">
        <div className="cth-stars">
          {stars.map(s => (
            <span
              key={s.id}
              className="cth-star"
              style={{
                left: s.left + '%',
                top: s.top + '%',
                width: s.size,
                height: s.size,
                opacity: s.opacity,
                animationDelay: s.delay + 's',
              }}
            />
          ))}
        </div>
        <ChLoveMark />
      </div>

      <div className="cth-body">
        <div className="cth-label">Together for</div>
        <div className="cth-count">
          {!dur ? (
            <button type="button" className="cth-setdate" onClick={() => setEditing(true)}>
              set your anniversary {'→'}
            </button>
          ) : (
            <>
              <span className="cth-count-line">
                <span><b>{dur.days}</b> day{dur.days === 1 ? '' : 's'}</span>
                {', '}
                <span><b>{dur.hours}</b> hour{dur.hours === 1 ? '' : 's'}</span>
              </span>
              <span className="cth-count-line">
                <span><b>{dur.minutes}</b> minute{dur.minutes === 1 ? '' : 's'}</span>
                {', '}
                <span><b>{dur.seconds}</b> second{dur.seconds === 1 ? '' : 's'}</span>
              </span>
            </>
          )}
        </div>

        <div className="cth-avs">
          <div className={'cth-av A' + (avatars?.avatar_a ? ' cth-av-char' : '')}>
            <Avatar
              id={avatars?.avatar_a}
              fallback={(duo.nameA || '?')[0]}
              size={28}
            />
          </div>
          <svg className="cth-beat" viewBox="0 0 64 24" aria-hidden="true">
            <defs>
              <linearGradient id="chbeat-grad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="var(--p1)" />
                <stop offset="50%" stopColor="var(--candle)" />
                <stop offset="100%" stopColor="var(--p2)" />
              </linearGradient>
            </defs>
            <path className="base" d="M0 12 H16 L21 5 L27 19 L32 12 H38 L43 7 L48 17 L52 12 H64"
              fill="none" stroke="color-mix(in srgb, var(--text) 20%, transparent)" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" />
            <path className="run" d="M0 12 H16 L21 5 L27 19 L32 12 H38 L43 7 L48 17 L52 12 H64"
              fill="none" stroke="url(#chbeat-grad)" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className={'cth-av B' + (avatars?.avatar_b ? ' cth-av-char' : '')}>
            <Avatar
              id={avatars?.avatar_b}
              fallback={(duo.nameB || '?')[0]}
              size={28}
            />
          </div>
        </div>

        <div className="cth-status">
          <div className="cth-status-row">
            <span className={'cth-dot you' + (youOnline ? ' on' : '')} aria-hidden="true" />
            <span className="cth-status-label">You</span>
            <span className="cth-status-val">
              {mine?.place ? <b>{mine.place}</b> : yourPlace}
            </span>
          </div>
          <div className="cth-status-row">
            <span className={'cth-dot partner' + (partnerOnline ? ' on' : '')} aria-hidden="true" />
            <span className="cth-status-label">{partnerName}</span>
            <span className="cth-status-val">
              {theirs?.busyLabel
                ? <span className="cth-busy">{theirs.busyLabel}</span>
                : theirs?.place ? <b>{theirs.place}</b> : theirPlace}
            </span>
          </div>
          {distanceLine && (
            <div className="cth-apart">{distanceLine}</div>
          )}
        </div>
        {anniv && relStart && (
          <div className="cth-since">
            together since <b>{formatLongDate(relStart)}</b>
          </div>
        )}
      </div>

      {ringDays !== null && !editing ? (
        <button
          type="button"
          className="cth-ring"
          title="Tap to change the date"
          onClick={() => setEditing(true)}
        >
          <svg width="84" height="84" viewBox="0 0 92 92" aria-hidden="true">
            <defs>
              <linearGradient id="ch-ring-g" x1="0" y1="0" x2="92" y2="92">
                <stop stopColor="var(--color-primary)" />
                <stop offset="1" stopColor="var(--color-secondary)" />
              </linearGradient>
            </defs>
            <circle className="cth-ring-bg" cx="46" cy="46" r={R} fill="none" strokeWidth="5" />
            <circle className="cth-ring-fg" cx="46" cy="46" r={R} fill="none" strokeWidth="5"
              strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - ringFrac)} />
          </svg>
          <span className="cth-ring-num">
            <span className={'cth-ring-days' + (ringDays === 0 ? ' is-emoji' : '')}>
              {ringDays === 0 ? '🎉' : ringDays}
            </span>
            <span className="cth-ring-label">
              {ringDays === 0 ? 'happy anniversary!' : 'days to your anniversary'}
            </span>
          </span>
        </button>
      ) : (
        <div className="cth-set">
          <label>When did you get together?</label>
          <input type="date" defaultValue={anniv}
            onChange={e => e.target.value && saveAnniv(e.target.value)} />
        </div>
      )}
    </div>
  );
}
