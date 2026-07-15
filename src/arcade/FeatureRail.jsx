// FeatureRail.jsx — Supabase-style icon rail: one icon per feature of your
// place. Click -> smooth-scroll to that section (Arena goes to its page).
// Desktop: fixed on the left edge. Small screens: docked to the bottom.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const S = {
  fill: 'none', stroke: 'currentColor', strokeWidth: 1.7,
  strokeLinecap: 'round', strokeLinejoin: 'round'
};
const I = {
  together: (
    <svg viewBox="0 0 24 24" {...S}>
      <path d="M12 20.5S4 15.3 4 9.9C4 7.2 6 5 8.6 5c1.5 0 2.7.7 3.4 1.8C12.7 5.7 14 5 15.4 5 18 5 20 7.2 20 9.9c0 5.4-8 10.6-8 10.6Z" />
    </svg>
  ),
  play: (
    <svg viewBox="0 0 24 24" {...S}>
      <rect x="3" y="7" width="18" height="11" rx="4" />
      <path d="M8 11v3M6.5 12.5h3" />
      <circle cx="16" cy="11.4" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="18" cy="13.4" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  ),
  arena: (
    <svg viewBox="0 0 24 24" {...S}>
      <path d="M8 4H4v3c0 2 1.8 4 4 4M16 4h4v3c0 2-1.8 4-4 4" />
      <path d="M8 4h8v6a4 4 0 0 1-8 0V4Z" />
      <path d="M12 14v3M9 20h6M10 17h4" />
    </svg>
  ),
  tonight: (
    <svg viewBox="0 0 24 24" {...S}>
      <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" />
      <path d="M17 5.5v3M15.5 7h3" />
    </svg>
  ),
  wall: (
    <svg viewBox="0 0 24 24" {...S}>
      <path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1Z" />
      <path d="M14 7l3 3" />
    </svg>
  ),
  list: (
    <svg viewBox="0 0 24 24" {...S}>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M8.5 12.2l2.4 2.4 4.8-5" />
    </svg>
  ),
  snap: (
    <svg viewBox="0 0 24 24" {...S}>
      <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.6l1.2-1.7h5.4L15.9 6h1.6A2.5 2.5 0 0 1 20 8.5v7A2.5 2.5 0 0 1 17.5 18h-11A2.5 2.5 0 0 1 4 15.5v-7Z" />
      <circle cx="12" cy="12" r="3.4" />
    </svg>
  ),
  watch: (
    <svg viewBox="0 0 24 24" {...S}>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="M10 9.5l4.5 2.5L10 14.5v-5Z" />
    </svg>
  ),
  pass: (
    <svg viewBox="0 0 24 24" {...S}>
      <path d="M12 4l1.8 4.6L18.5 10l-4.7 1.4L12 16l-1.8-4.6L5.5 10l4.7-1.4L12 4Z" />
      <path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8Z" />
    </svg>
  )
};

const ITEMS = [
  { id: 'sect-together', icon: 'together', label: 'Together' },
  { id: 'sect-play', icon: 'play', label: 'Games' },
  { id: 'arena', icon: 'arena', label: '2v2 Arena', route: '/arena' },
  { id: 'sect-tonight', icon: 'tonight', label: 'Tonight Engine' },
  { id: 'sect-wall', icon: 'wall', label: 'Our wall' },
  { id: 'sect-list', icon: 'list', label: 'Our list' },
  { id: 'sect-snap', icon: 'snap', label: "Today's snap" },
  { id: 'sect-watch', icon: 'watch', label: 'Movie night' },
  { id: 'sect-pass', icon: 'pass', label: 'Duo Pass' }
];

export default function FeatureRail() {
  const [active, setActive] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const obs = new IntersectionObserver(entries => {
      // highlight the section closest to the top of the viewport
      const vis = entries.filter(e => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (vis.length) setActive(vis[0].target.id);
    }, { rootMargin: '-15% 0px -55% 0px' });
    for (const it of ITEMS) {
      const el = document.getElementById(it.id);
      if (el) obs.observe(el);
    }
    return () => obs.disconnect();
  }, []);

  const go = it => {
    if (it.route) { navigate(it.route); return; }
    document.getElementById(it.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <nav className="frail" aria-label="Your place">
      {ITEMS.map(it => (
        <button key={it.id} type="button"
          className={'frail-btn' + (active === it.id ? ' on' : '')}
          onClick={() => go(it)}>
          {I[it.icon]}
          <span className="frail-tip">{it.label}</span>
        </button>
      ))}
    </nav>
  );
}
