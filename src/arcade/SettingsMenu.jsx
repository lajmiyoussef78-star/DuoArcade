// SettingsMenu.jsx — site-wide settings (gear in the top bar).

import { useEffect, useRef, useState } from 'react';
import '../styles/settings.css';

export default function SettingsMenu({ onSignOut }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

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
        <div className="set-panel" role="dialog" aria-label="Settings">
          <div className="set-head">Settings</div>
          <p className="set-note" style={{ borderTop: 'none', paddingTop: 0 }}>
            Account
          </p>
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
