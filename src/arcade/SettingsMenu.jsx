// SettingsMenu.jsx — site-wide settings (gear in the top bar).

import { useEffect, useRef, useState } from 'react';
import { THEMES } from '../lib/util.js';
import '../styles/settings.css';

export default function SettingsMenu({ onSignOut, theme, onSetTheme, canSetTheme }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const active = theme && THEMES[theme] ? theme : 'night';

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="set-root" ref={rootRef}>
      <button
        type="button"
        className={`set-gear${open ? ' on' : ''}`}
        aria-label="Settings"
        aria-expanded={open}
        title="Settings"
        onClick={() => setOpen(o => !o)}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
        </svg>
      </button>

      {open && (
        <div className="set-panel set-panel-wide" role="dialog" aria-label="Settings">
          <div className="set-head">Settings</div>

          {canSetTheme && onSetTheme && (
            <div className="set-section">
              <div className="set-label">Duo theme</div>
              <p className="set-note" style={{ borderTop: 'none', paddingTop: 0, marginBottom: 10 }}>
                Colors for your shared place — free for every duo.
              </p>
              <div className="set-themes">
                {Object.entries(THEMES).map(([name, th]) => (
                  <button
                    key={name}
                    type="button"
                    className={'theme-dot' + (active === name ? ' on' : '')}
                    title={th.label}
                    aria-label={th.label}
                    aria-pressed={active === name}
                    style={{ background: `linear-gradient(135deg, ${th.p1} 50%, ${th.p2} 50%)` }}
                    onClick={() => onSetTheme(name)}
                  />
                ))}
              </div>
              <div className="set-theme-name">{THEMES[active]?.label}</div>
            </div>
          )}

          {onSignOut && (
            <button
              type="button"
              className="set-signout"
              onClick={() => { setOpen(false); onSignOut(); }}
            >
              Sign out
            </button>
          )}
        </div>
      )}
    </div>
  );
}
