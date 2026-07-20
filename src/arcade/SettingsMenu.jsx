// SettingsMenu.jsx — full-screen settings modal.

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { THEMES, parseTheme, formatTheme, themeColors } from '../lib/util.js';
import '../styles/settings.css';

export default function SettingsMenu({
  onSignOut, theme, onSetTheme, canSetTheme,
  nameA = 'Partner one', nameB = 'Partner two'
}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);
  const { name: activeName, flip } = parseTheme(theme);
  const colors = themeColors(theme);
  const activeTh = THEMES[activeName] || THEMES.night;

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

  const pickTheme = (name) => {
    onSetTheme?.(formatTheme(name, flip));
  };

  const assignColorToA = (which) => {
    // which: 'baseP1' | 'baseP2' — which palette color Partner A (nameA) should get
    const wantFlip = which === 'baseP2';
    onSetTheme?.(formatTheme(activeName, wantFlip));
  };

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
                <p>Pick a palette, then choose who gets which color. Both of you see the same look.</p>
              </div>

              <div className="set-theme-grid">
                {Object.entries(THEMES).map(([name, th]) => (
                  <button
                    key={name}
                    type="button"
                    className={'set-theme-card' + (activeName === name ? ' on' : '')}
                    aria-label={th.label}
                    aria-pressed={activeName === name}
                    onClick={() => pickTheme(name)}
                  >
                    <span className="set-theme-chip" aria-hidden="true">
                      <span className="set-theme-half a" style={{ background: th.p1 }} />
                      <span className="set-theme-half b" style={{ background: th.p2 }} />
                    </span>
                    <span className="set-theme-card-name">{th.label}</span>
                    {activeName === name && <span className="set-theme-check" aria-hidden="true">✓</span>}
                  </button>
                ))}
              </div>

              <div className="set-assign">
                <div className="set-assign-head">
                  <h4>Who gets which color?</h4>
                  <p>Tap a color under each name — or swap.</p>
                </div>

                <div className="set-assign-row">
                  <div className="set-assign-seat">
                    <div className="set-assign-name" style={{ color: colors.p1 }}>{nameA}</div>
                    <div className="set-assign-picks">
                      <button
                        type="button"
                        className={'set-assign-swatch' + (!flip ? ' on' : '')}
                        style={{ background: activeTh.p1 }}
                        aria-label={`Give ${nameA} the first color`}
                        aria-pressed={!flip}
                        onClick={() => assignColorToA('baseP1')}
                      />
                      <button
                        type="button"
                        className={'set-assign-swatch' + (flip ? ' on' : '')}
                        style={{ background: activeTh.p2 }}
                        aria-label={`Give ${nameA} the second color`}
                        aria-pressed={flip}
                        onClick={() => assignColorToA('baseP2')}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    className="set-assign-swap"
                    onClick={() => onSetTheme(formatTheme(activeName, !flip))}
                    aria-label="Swap colors"
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M7 7h11l-3-3M17 17H6l3 3" />
                    </svg>
                    Swap
                  </button>

                  <div className="set-assign-seat">
                    <div className="set-assign-name" style={{ color: colors.p2 }}>{nameB}</div>
                    <div className="set-assign-picks">
                      <button
                        type="button"
                        className={'set-assign-swatch' + (flip ? ' on' : '')}
                        style={{ background: activeTh.p1 }}
                        aria-label={`Give ${nameB} the first color`}
                        aria-pressed={flip}
                        onClick={() => assignColorToA('baseP2')}
                      />
                      <button
                        type="button"
                        className={'set-assign-swatch' + (!flip ? ' on' : '')}
                        style={{ background: activeTh.p2 }}
                        aria-label={`Give ${nameB} the second color`}
                        aria-pressed={!flip}
                        onClick={() => assignColorToA('baseP1')}
                      />
                    </div>
                  </div>
                </div>

                <div className="set-assign-live" aria-hidden="true">
                  <span className="set-assign-live-pill" style={{ background: colors.p1 }}>{nameA}</span>
                  <span className="set-assign-live-amp">&</span>
                  <span className="set-assign-live-pill" style={{ background: colors.p2 }}>{nameB}</span>
                </div>
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

          {!canSetTheme && !onSignOut && (
            <section className="set-block">
              <div className="set-block-head">
                <h3>Your place</h3>
                <p>Sign in and open your duo to change themes and account options here.</p>
              </div>
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
