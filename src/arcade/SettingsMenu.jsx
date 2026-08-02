// SettingsMenu.jsx — gear trigger that opens the in-shell Settings page.
// The page itself lives in SettingsScreen.jsx (/app/place/sect-settings).

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/settings.css';

const SETTINGS_PATH = '/app/place/sect-settings';

export default function SettingsMenu() {
  const navigate = useNavigate();

  useEffect(() => {
    const onOpen = () => navigate(SETTINGS_PATH);
    window.addEventListener('duoarcade-open-settings', onOpen);
    return () => window.removeEventListener('duoarcade-open-settings', onOpen);
  }, [navigate]);

  return (
    <div className="set-root">
      <button
        type="button"
        className="set-gear"
        aria-label="Settings"
        title="Settings"
        onClick={() => navigate(SETTINGS_PATH)}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
        </svg>
      </button>
    </div>
  );
}
