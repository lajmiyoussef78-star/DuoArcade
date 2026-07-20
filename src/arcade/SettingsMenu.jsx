// SettingsMenu.jsx — full-screen settings modal.

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { THEMES } from '../lib/util.js';
import '../styles/settings.css';

export default function SettingsMenu({ onSignOut, theme, onSetTheme, canSetTheme }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);
  const active = theme && THEMES[theme] ? theme : 'night';
  const activeTh = THEMES[active];

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const close = () => setOpen(false);

  const modal = open && createPortal(
    <div
      className="set-overlay"
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div
        className="set-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="set-modal-title"
        ref={panelRef}
      >
        <header className="set-modal-head">
          <div>
            <div className="set-modal-kicker">DuoArcade</div>
            <h2 id="set-modal-title">Settings</h2>
          </div>
          <button type="button" className="set-close" aria-label="Close settings" onClick={close}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        <div className="set-modal-body">
          {canSetTheme && onSetTheme && (
            <section className="set-block">
              <div className="set-block-head">
                <h3>Duo theme</h3>
                <p>Pick the colors for your shared place. Free for every duo — both of you see the same look.</p>
              </div>

              <div className="set-preview" aria-hidden="true">
                <div className="set-preview-swatch" style={{ background: activeTh.p1 }} />
                <div className="set-preview-swatch" style={{ background: activeTh.p2 }} />
                <div className="set-preview-swatch" style={{ background: activeTh.candle }} />
                <div className="set-preview-meta">
                  <span className="set-preview-label">{activeTh.label}</span>
                  <span className="set-preview-hint">Partner one · Partner two · Accent</span>
                </div>
              </div>

              <div className="set-theme-grid">
                {Object.entries(THEMES).map(([name, th]) => (
                  <button
                    key={name}
                    type="button"
                    className={'set-theme-card' + (active === name ? ' on' : '')}
                    aria-label={th.label}
                    aria-pressed={active === name}
                    onClick={() => onSetTheme(name)}
                  >
                    <span
                      className="set-theme-chip"
                      style={{ background: `linear-gradient(135deg, ${th.p1} 0 50%, ${th.p2} 50% 100%)` }}
                    />
                    <span className="set-theme-card-name">{th.label}</span>
                    {active === name && <span className="set-theme-check" aria-hidden="true">✓</span>}
                  </button>
                ))}
              </div>
            </section>
          )}

          {onSignOut && (
            <section className="set-block set-block-account">
              <div className="set-block-head">
                <h3>Account</h3>
                <p>Sign out of this device. Your duo and records stay safe.</p>
              </div>
              <button
                type="button"
                className="set-signout"
                onClick={() => { close(); onSignOut(); }}
              >
                Sign out
              </button>
            </section>
          )}
        </div>
      </div>
    </div>,
    document.body
  );

  return (
    <div className="set-root">
      <button
        type="button"
        className={`set-gear${open ? ' on' : ''}`}
        aria-label="Settings"
        aria-expanded={open}
        title="Settings"
        onClick={() => setOpen(true)}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
        </svg>
      </button>
      {modal}
    </div>
  );
}
