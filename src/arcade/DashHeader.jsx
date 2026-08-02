// DashHeader.jsx — greeting + global search + quick actions for the dashboard.
// Search runs over the real engine registry and the real navigation destinations.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ENGINES } from '../engines/index.js';
import { fuzzyMatch } from '../lib/gameCatalog.js';
import { Avatar } from './avatars.jsx';
import { Ico } from './ui/icons.jsx';
import { ALL_NAV_ITEMS, navigateToNav } from './SideNav.jsx';

function greetingFor(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return 'Still up';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

const NAV_TARGETS = ALL_NAV_ITEMS.filter(it => it.id !== 'home');

export default function DashHeader({
  duo, code, myRole, avatars, onStartGame, onBack, requestCount = 0,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [q, setQ] = useState('');
  const [openList, setOpenList] = useState(false);
  const boxRef = useRef(null);
  const inputRef = useRef(null);
  const onHome = location.pathname === '/app' || location.pathname === '/app/';

  const myName = myRole === 'B' ? duo?.nameB : duo?.nameA;
  const myAvatar = myRole === 'B' ? avatars?.avatar_b : avatars?.avatar_a;

  useEffect(() => {
    if (!openList) return undefined;
    const onDoc = e => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpenList(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [openList]);

  /* ⌘K / Ctrl+K focuses search, matching the hint shown in the field. */
  useEffect(() => {
    const onKey = e => {
      if (e.key?.toLowerCase() !== 'k' || !(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      inputRef.current?.focus();
      setOpenList(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const results = useMemo(() => {
    const term = q.trim();
    if (!term) return { games: [], places: [] };
    const games = Object.values(ENGINES)
      .filter(eng => fuzzyMatch(eng.meta?.name, term))
      .slice(0, 6);
    const places = NAV_TARGETS
      .filter(it => fuzzyMatch(it.label, term))
      .slice(0, 4);
    return { games, places };
  }, [q]);

  const hasResults = results.games.length > 0 || results.places.length > 0;

  const pickGame = id => {
    setQ('');
    setOpenList(false);
    onStartGame?.(id);
  };

  const pickPlace = it => {
    setQ('');
    setOpenList(false);
    navigateToNav(it, { navigate, onHome, code });
  };

  return (
    <header className="dhead">
      <div className="dhead-greet">
        <h2 className="dhead-title">
          {greetingFor()}, <span className="dhead-name">{myName || 'you'}</span>
          <span className="dhead-wave" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="1em" height="1em">
              <defs>
                <linearGradient id="dhead-wave-g" x1="0" y1="0" x2="24" y2="0">
                  <stop stopColor="var(--color-primary)" />
                  <stop offset="1" stopColor="var(--color-secondary)" />
                </linearGradient>
              </defs>
              <path d="M12 1.6 13.7 9.2 21.2 11 13.7 12.8 12 20.4 10.3 12.8 2.8 11 10.3 9.2Z" />
            </svg>
          </span>
        </h2>
        <p className="dhead-sub">Ready to create some unforgettable moments?</p>
      </div>

      <div className="dhead-tools">
        <div className={'dhead-search' + (openList && hasResults ? ' open' : '')} ref={boxRef}>
          <span className="dhead-search-ico" aria-hidden="true"><Ico.search size={17} /></span>
          <input
            ref={inputRef}
            type="search"
            value={q}
            placeholder="Search anything..."
            aria-label="Search games and sections"
            autoComplete="off"
            onChange={e => { setQ(e.target.value); setOpenList(true); }}
            onFocus={() => setOpenList(true)}
            onKeyDown={e => {
              if (e.key === 'Escape') { setOpenList(false); e.currentTarget.blur(); }
              if (e.key === 'Enter' && results.games[0]) pickGame(results.games[0].meta.id);
            }}
          />
          <span className="dhead-kbd" aria-hidden="true">
            <kbd>⌘</kbd><kbd>K</kbd>
          </span>
          {openList && hasResults && (
            <div className="dhead-results" role="listbox">
              {results.games.length > 0 && (
                <div className="dhead-resgroup">
                  <div className="dhead-resgroup-label">Games</div>
                  {results.games.map(eng => (
                    <button
                      key={eng.meta.id}
                      type="button"
                      role="option"
                      aria-selected="false"
                      className="dhead-res"
                      onClick={() => pickGame(eng.meta.id)}
                    >
                      <span className="dhead-res-ico"><Ico.play size={16} /></span>
                      <span className="dhead-res-copy">
                        <span className="dhead-res-name">{eng.meta.name}</span>
                        <span className="dhead-res-tag">{eng.meta.tag}</span>
                      </span>
                      <span className="dhead-res-go">Play</span>
                    </button>
                  ))}
                </div>
              )}
              {results.places.length > 0 && (
                <div className="dhead-resgroup">
                  <div className="dhead-resgroup-label">Go to</div>
                  {results.places.map(it => {
                    const Icon = Ico[it.icon];
                    return (
                      <button
                        key={it.id}
                        type="button"
                        role="option"
                        aria-selected="false"
                        className="dhead-res"
                        onClick={() => pickPlace(it)}
                      >
                        <span className="dhead-res-ico"><Icon size={16} /></span>
                        <span className="dhead-res-copy">
                          <span className="dhead-res-name">{it.label}</span>
                        </span>
                        <span className="dhead-res-go">Open</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          className={'dhead-icon' + (requestCount > 0 ? ' has-dot' : '')}
          title={requestCount > 0 ? `${requestCount} friend request${requestCount === 1 ? '' : 's'}` : 'Friend requests'}
          aria-label="Friend requests"
          onClick={() => window.dispatchEvent(new CustomEvent('duoarcade-open-friends'))}
        >
          <Ico.bell size={18} />
          {requestCount > 0 && <span className="dhead-icon-dot" aria-hidden="true" />}
        </button>
        <button
          type="button"
          className="dhead-avatar"
          title="Duo profile"
          aria-label="Duo profile"
          onClick={onBack}
        >
          {myAvatar ? <Avatar id={myAvatar} size={34} /> : (myName || '?')[0].toUpperCase()}
        </button>
      </div>
    </header>
  );
}
