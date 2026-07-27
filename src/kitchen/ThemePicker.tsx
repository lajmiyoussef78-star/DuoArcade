import { useEffect, useId, useRef, useState } from "react";
import { SITE_THEMES, type SiteThemeId } from "./theme/siteThemes";
import { useGamePrefs } from "./gamePrefs";

/** Fixed top-right theme switcher — works on every page. */
export function ThemePicker() {
  const themeId = useGamePrefs((s) => s.siteTheme);
  const setSiteTheme = useGamePrefs((s) => s.setSiteTheme);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const active = SITE_THEMES.find((t) => t.id === themeId) ?? SITE_THEMES[0]!;

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(id: SiteThemeId) {
    setSiteTheme(id);
    setOpen(false);
  }

  return (
    <div className="theme-picker" ref={rootRef}>
      <button
        type="button"
        className="theme-picker-btn"
        aria-label="Choose site theme"
        aria-expanded={open}
        aria-controls={listId}
        title="Themes"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="theme-picker-icon" aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 3a9 9 0 1 0 0 18c.9 0 1.4-.9.9-1.5-.4-.5-.2-1.3.4-1.6.5-.3 1.1 0 1.4.5.4.6 1.3.8 1.9.3A9 9 0 0 0 12 3Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <circle cx="8.5" cy="10" r="1.2" fill="currentColor" />
            <circle cx="11" cy="7.2" r="1.1" fill="currentColor" />
            <circle cx="14.5" cy="8.5" r="1.1" fill="currentColor" />
          </svg>
        </span>
        <span className="theme-picker-dots" aria-hidden>
          {active.swatches.map((c) => (
            <i key={c} style={{ background: c }} />
          ))}
        </span>
      </button>

      {open && (
        <div className="theme-picker-menu" id={listId} role="listbox" aria-label="Site themes">
          <p className="theme-picker-title">Themes</p>
          <div className="theme-picker-grid">
            {SITE_THEMES.map((theme) => {
              const selected = theme.id === themeId;
              return (
                <button
                  key={theme.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`theme-picker-option${selected ? " selected" : ""}`}
                  onClick={() => pick(theme.id)}
                >
                  <span className="theme-picker-swatches" aria-hidden>
                    {theme.swatches.map((c) => (
                      <i key={`${theme.id}-${c}`} style={{ background: c }} />
                    ))}
                  </span>
                  <span className="theme-picker-option-text">
                    <strong>{theme.name}</strong>
                    <small>{theme.blurb}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
