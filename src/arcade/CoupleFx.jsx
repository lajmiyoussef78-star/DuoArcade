// CoupleFx.jsx — couple-themed animated pieces: milestone celebrations,
// the "together" hero (duration + anniversary ring), and confetti bursts.
// All colors come from the theme CSS variables so duo themes restyle them.

import { useEffect, useMemo, useState } from 'react';

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

function splitDuration(from) {
  const start = parseDay(from);
  if (!start) return null;
  const days = Math.max(0, Math.floor((Date.now() - start.getTime()) / 864e5));
  const y = Math.floor(days / 365), m = Math.floor((days % 365) / 30), d = (days % 365) % 30;
  return { y, m, d, days };
}

// When an anniversary is saved, count from that calendar date. If the stored
// year is still ahead (common when picking month/day for an upcoming celebration),
// walk back to the latest past occurrence — but never before the duo joined the app.
function togetherStart(anniv, createdAt) {
  const created = parseDay(createdAt);
  if (!anniv) return createdAt || null;

  const stored = parseDay(anniv);
  if (!stored) return createdAt || null;

  const now = new Date();
  now.setHours(12, 0, 0, 0);

  if (stored <= now) return stored;

  // stored date is still in the future — use the most recent past month/day
  let start = new Date(now.getFullYear(), stored.getMonth(), stored.getDate(), 12, 0, 0, 0);
  if (start > now) start.setFullYear(start.getFullYear() - 1);

  // if that predates joining DuoArcade, count from when the duo was created instead
  if (created && created > start) return createdAt;
  return start;
}

const annivKey = code => 'duoarcade-anniv-' + code;

export function TogetherHero({ duo, code, totals }) {
  const [anniv, setAnniv] = useState(() => localStorage.getItem(annivKey(code)) || '');
  const [editing, setEditing] = useState(false);

  const stars = useMemo(() => Array.from({ length: 14 }, (_, i) => ({
    id: i, left: Math.random() * 100, top: Math.random() * 100, delay: Math.random() * 4
  })), []);

  const startFrom = togetherStart(anniv, duo.createdAt);
  const dur = startFrom ? splitDuration(startFrom) : null;
  if (!dur) return null;
  const firstDay = dur.days === 0;
  const dayCount = dur.y || dur.m ? dur.d : dur.days;
  const parts = [];
  if (dur.y) parts.push(<span key="y"><b>{dur.y}</b> year{dur.y > 1 ? 's' : ''}</span>);
  if (dur.m) parts.push(<span key="m"><b>{dur.m}</b> month{dur.m > 1 ? 's' : ''}</span>);
  if (!firstDay) parts.push(<span key="d"><b>{dayCount}</b> day{dayCount === 1 ? '' : 's'}</span>);

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
    setAnniv(v);
    if (v) localStorage.setItem(annivKey(code), v);
    setEditing(false);
  };

  const tl = [
    { done: totals.games >= 1, text: 'first game' },
    { done: (duo.tasteTotal || 0) >= 1, text: 'first movie night' },
    { done: totals.games >= 25, text: '25 games' },
    { done: totals.games >= 100, text: '100 games' }
  ];

  return (
    <div className="ch-hero">
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
          {firstDay
            ? <span><b>day one</b> {'❤'}</span>
            : parts.reduce((acc, p, i) => (i ? [...acc, ', ', p] : [p]), [])}
        </div>
        {!anniv && duo.createdAt && (
          <div className="ch-setdate">
            counting since you joined DuoArcade — set your anniversary {'→'} to count from your real date
          </div>
        )}
        <div className="ch-timeline">
          {tl.map((t, i) => (
            <span key={i} className={'ch-tl-item' + (t.done ? ' done' : '')}>
              <span className="hh">{t.done ? '❤' : '○'}</span>{t.text}
            </span>
          ))}
        </div>
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
          <label style={{ margin: '0 0 5px' }}>Your anniversary</label>
          <input type="date" defaultValue={anniv}
            onChange={e => e.target.value && saveAnniv(e.target.value)} />
        </div>
      )}
    </div>
  );
}
