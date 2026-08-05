// SideNav.jsx — labelled navigation sidebar (drawer + bottom tab bar on small screens).
// Every destination here is an existing route or an existing in-app surface.

import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Avatar } from './avatars.jsx';
import { Ico } from './ui/icons.jsx';

/* id must match the feature ids the rest of the app already uses. */
export const NAV_GROUPS = [
  {
    key: 'play',
    items: [
      { id: 'home', label: 'Home', icon: 'home', route: '/app' },
      { id: 'sect-watch', label: 'Watch Party', icon: 'watch' },
      { id: 'sect-play', label: 'Games', icon: 'play', scroll: true },
      { id: 'arena', label: '2v2 Arena', icon: 'arena', route: '/app/arena' },
      { id: 'sect-snap', label: 'DuoSnap', icon: 'snap' },
      { id: 'sect-bucket', label: 'Bucket List', icon: 'bucket' },
      { id: 'sect-list', label: 'To-Do List', icon: 'list' },
      { id: 'sect-wall', label: 'Whiteboard', icon: 'wall' },
    ],
  },
  {
    key: 'social',
    items: [
      { id: 'chat', label: 'Messages', icon: 'chat', event: 'duoarcade-open-chat' },
      { id: 'notifications', label: 'Notifications', icon: 'bell', event: 'duoarcade-open-friends', badge: 'requests' },
      { id: 'friends', label: 'Friends', icon: 'friends', event: 'duoarcade-open-friends' },
      { id: 'settings', label: 'Settings', icon: 'gear', route: '/app/place/sect-settings' },
    ],
  },
];

/* Hidden from the sidebar for now — kept for search / deep links / later placement. */
export const NAV_MORE = [
  { id: 'sect-together', label: 'Together', icon: 'heart', scroll: true },
  { id: 'sect-week', label: 'Timetable', icon: 'week' },
  { id: 'sect-tonight', label: 'Tonight Engine', icon: 'moon' },
  { id: 'sect-challenge-history', label: 'Challenges', icon: 'history' },
  { id: 'sect-saved-boards', label: 'Saved boards', icon: 'library' },
  { id: 'leaderboard', label: 'Leaderboard', icon: 'trophy', route: '/app/leaderboard' },
];

export const ALL_NAV_ITEMS = [...NAV_GROUPS.flatMap(g => g.items), ...NAV_MORE];

/* The surfaces that earn a slot in the phone tab bar. */
const TAB_IDS = ['home', 'sect-play', 'sect-watch', 'chat'];

export function navigateToNav(it, { navigate, onHome, code }) {
  if (it.event) {
    window.dispatchEvent(new CustomEvent(it.event));
    return;
  }
  if (it.route) {
    if (it.route.includes('/arena') && code) {
      try { sessionStorage.setItem('duoarcade-home-duo', code); } catch { /* ignore */ }
    }
    navigate(it.route);
    return;
  }
  if (it.scroll) {
    const el = document.getElementById(it.id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else if (!onHome) navigate('/app', { state: { scrollTo: it.id } });
    return;
  }
  navigate(`/app/place/${it.id}`);
}

export default function SideNav({
  duo, code, myRole, avatars, activeId, onBack, onSignOut,
  hasPass = false, username = '', requestCount = 0,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef(null);
  const onHome = location.pathname === '/app' || location.pathname === '/app/';

  useEffect(() => { setOpen(false); }, [location.pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = e => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (!menu) return undefined;
    const onDoc = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenu(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menu]);

  const go = it => {
    setOpen(false);
    setMenu(false);
    navigateToNav(it, { navigate, onHome, code });
  };

  const myName = myRole === 'B' ? duo?.nameB : duo?.nameA;
  const myAvatar = myRole === 'B' ? avatars?.avatar_b : avatars?.avatar_a;

  const renderItem = it => {
    const Icon = Ico[it.icon];
    const on = activeId === it.id;
    const badge = it.badge === 'requests' ? requestCount : 0;
    return (
      <button
        key={it.id}
        type="button"
        className={'dnav-item' + (on ? ' on' : '')}
        aria-current={on ? 'page' : undefined}
        onClick={() => go(it)}
      >
        <span className="dnav-item-ico"><Icon size={19} /></span>
        <span className="dnav-item-label">{it.label}</span>
        {badge > 0 && <span className="dnav-item-badge">{badge}</span>}
      </button>
    );
  };

  const tabItems = NAV_GROUPS.flatMap(g => g.items).filter(it => TAB_IDS.includes(it.id));

  return (
    <>
      <button
        type="button"
        className="dnav-burger"
        aria-label="Open navigation"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Ico.menu size={20} />
      </button>

      {open && <div className="dnav-scrim" role="presentation" onClick={() => setOpen(false)} />}

      <aside className={'dnav' + (open ? ' dnav-open' : '')} aria-label="Main navigation">
        <div className="dnav-brand">
          <span className="dnav-logo" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="28" height="28" fill="none">
              <rect x="1.5" y="1.5" width="29" height="29" rx="9" fill="url(#dnavfill)" />
              <rect x="1.5" y="1.5" width="29" height="29" rx="9" stroke="url(#dnavg)" strokeWidth="1.4" />
              <path d="M10.5 21V11h3.4a5 5 0 0 1 0 10h-3.4Z" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
              <circle cx="21.6" cy="13.2" r="1.6" fill="var(--acc-lime)" />
              <circle cx="21.6" cy="18.8" r="1.6" fill="var(--p2)" />
              <defs>
                <linearGradient id="dnavg" x1="0" y1="0" x2="32" y2="32">
                  <stop stopColor="var(--p1)" />
                  <stop offset="1" stopColor="var(--p2)" />
                </linearGradient>
                <linearGradient id="dnavfill" x1="0" y1="0" x2="32" y2="32">
                  <stop stopColor="var(--p1)" stopOpacity=".35" />
                  <stop offset="1" stopColor="var(--p2)" stopOpacity=".18" />
                </linearGradient>
              </defs>
            </svg>
          </span>
          <h1 className="dnav-word">Two<b>Vana</b></h1>
          <button
            type="button"
            className="dnav-close"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          >
            <Ico.close size={18} />
          </button>
        </div>

        <nav className="dnav-scroll">
          {NAV_GROUPS.map((g, i) => (
            <div className="dnav-group" key={g.key}>
              {i > 0 && <div className="dnav-divider" aria-hidden="true" />}
              {g.items.map(renderItem)}
            </div>
          ))}
        </nav>

        <div className="dnav-foot">
          <div className="dnav-user" ref={menuRef}>
            <button
              type="button"
              className={'dnav-user-btn' + (menu ? ' on' : '')}
              aria-expanded={menu}
              onClick={() => setMenu(v => !v)}
            >
              <span className="dnav-user-av">
                {myAvatar ? <Avatar id={myAvatar} size={32} /> : (myName || '?')[0].toUpperCase()}
                <span className="dnav-user-dot" aria-hidden="true" />
              </span>
              <span className="dnav-user-copy">
                <span className="dnav-user-name">{myName || 'You'}</span>
                <span className="dnav-user-sub">{username ? '@' + username : 'Online'}</span>
              </span>
              <span className="dnav-user-caret" aria-hidden="true"><Ico.chevronDown size={15} /></span>
            </button>
            {menu && (
              <div className="dnav-menu" role="menu">
                <button type="button" role="menuitem" onClick={() => { setMenu(false); onBack?.(); }}>
                  Duo profile
                </button>
                <button type="button" role="menuitem" onClick={() => go({ id: 'leaderboard', route: '/app/leaderboard' })}>
                  Leaderboard
                </button>
                <button type="button" role="menuitem" onClick={() => go({ id: 'settings', route: '/app/place/sect-settings' })}>
                  Settings
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenu(false);
                    window.dispatchEvent(new CustomEvent('duoarcade-toggle-diag'));
                  }}
                >
                  Diagnostics
                </button>
                {onSignOut && (
                  <>
                    <div className="dnav-menu-sep" role="separator" />
                    <button
                      type="button"
                      role="menuitem"
                      className="dnav-menu-logout"
                      onClick={() => {
                        setMenu(false);
                        onSignOut();
                      }}
                    >
                      <Ico.logout size={15} />
                      Log out
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Static promo UI for now — always visible so the shell matches the
              reference. Gate on !hasPass again when payment ships. */}
          <div className="dnav-promo">
            <div className="dnav-promo-head">
              <span className="dnav-promo-ico" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
                  strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 16.5h14l-1.2-7.2-3.3 2.4L12 7.5l-2.5 4.2-3.3-2.4L5 16.5Z" />
                  <path d="M5 16.5h14v1.8a1.2 1.2 0 0 1-1.2 1.2H6.2A1.2 1.2 0 0 1 5 18.3v-1.8Z" />
                </svg>
              </span>
              <span className="dnav-promo-title">
                Upgrade to <span className="dnav-promo-premium">Premium</span>
              </span>
            </div>
            <p className="dnav-promo-sub">Unlock more features and create unlimited rooms.</p>
            <button type="button" className="dnav-promo-btn">
              Upgrade Now
            </button>
          </div>
        </div>
      </aside>

      <nav className="dtabbar" aria-label="Quick navigation">
        {tabItems.map(it => {
          const Icon = Ico[it.icon];
          const on = activeId === it.id;
          return (
            <button
              key={'tab-' + it.id}
              type="button"
              className={'dtab' + (on ? ' on' : '')}
              onClick={() => go(it)}
            >
              <Icon size={20} />
              <span>{it.label}</span>
            </button>
          );
        })}
        <button type="button" className="dtab" onClick={() => setOpen(true)}>
          <Ico.menu size={20} />
          <span>More</span>
        </button>
      </nav>
    </>
  );
}
