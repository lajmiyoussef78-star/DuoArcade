// SettingsScreen.jsx — full-page settings inside the dashboard shell.

import { useEffect, useState } from 'react';
import { THEMES, parseTheme, formatTheme } from '../lib/util.js';
import { applyAppearance, getAppearance } from '../lib/appearance.js';
import { getDuoAvatars, setMyAvatar } from '../lib/avatars.js';
import { Avatar, AvatarPicker } from './avatars.jsx';
import '../styles/settings.css';
import '../styles/avatars.css';

const TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'account', label: 'Account' },
  { id: 'preferences', label: 'Preferences' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'apps', label: 'Connected Apps' },
];

/* Featured accents — 3 rows × 3, each row a different color family. */
const FEATURED_ACCENTS = [
  /* violet / warm / cool */
  'classic', 'sunset', 'ocean',
  /* pink / green / blue */
  'velvet', 'forest', 'arctic',
  /* gold / neon / coral */
  'honey', 'neon', 'coral',
];

const ACCENT_ORDER = [
  'classic', 'lime', 'ocean', 'ember', 'orchid', 'forest', 'sunset', 'aurora', 'rose',
  'citrus', 'arctic', 'velvet', 'magma',
  'mint', 'grape', 'honey', 'neon',
  'coral', 'ink', 'sakura', 'storm',
  'peach', 'jade', 'twilight', 'solar',
  'cocoa', 'lagoon', 'lava', 'moss',
];

const ACCENTS = ACCENT_ORDER
  .filter(id => THEMES[id])
  .map(id => ({
    id,
    label: THEMES[id].label,
    p1: THEMES[id].p1,
    p2: THEMES[id].p2,
    candle: THEMES[id].candle,
  }));

const FEATURED = FEATURED_ACCENTS
  .map(id => ACCENTS.find(a => a.id === id))
  .filter(Boolean);

const PREF_KEY = 'duoarcade-settings-prefs';
const BIO_KEY = (code) => `duoarcade-bio-${code || 'self'}`;

function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREF_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function savePrefs(patch) {
  const next = { ...loadPrefs(), ...patch };
  try { localStorage.setItem(PREF_KEY, JSON.stringify(next)); } catch { /* */ }
  return next;
}

function formatSince(iso) {
  if (!iso) return null;
  try {
    return new Date(iso + (iso.length === 10 ? 'T12:00:00' : '')).toLocaleDateString(undefined, {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function PlaceholderTab({ title, note }) {
  return (
    <div className="set-empty">
      <span className="set-empty-title">{title}</span>
      <p>{note}</p>
    </div>
  );
}

export default function SettingsScreen({
  onSignOut, theme, onSetTheme, canSetTheme,
  nameA = 'Partner one', nameB = 'Partner two',
  code = null, myRole = null, onAvatarChange,
  duo = null, onDeleteDuo = null,
  username = '', email = '', onSetUsername = null,
}) {
  const [tab, setTab] = useState('profile');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [avs, setAvs] = useState({ avatar_a: null, avatar_b: null });
  const [avErr, setAvErr] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const [displayName, setDisplayName] = useState('');
  const [userDraft, setUserDraft] = useState('');
  const [bio, setBio] = useState('');
  const [appearance, setAppearance] = useState(() => getAppearance());
  const [language, setLanguage] = useState('en');
  const [fontSize, setFontSize] = useState('medium');
  const [accentsOpen, setAccentsOpen] = useState(false);

  const { name: activeName, flip } = parseTheme(theme);
  const accentActive = activeName === 'night' ? 'classic' : activeName;
  const visibleAccents = (() => {
    if (accentsOpen) return ACCENTS;
    const active = ACCENTS.find(a => a.id === accentActive);
    if (active && !FEATURED.some(a => a.id === accentActive)) {
      return [active, ...FEATURED.filter(a => a.id !== active.id)].slice(0, 9);
    }
    return FEATURED;
  })();

  const canSetAvatar = !!(code && myRole);
  const myAvatar = myRole === 'A' ? avs.avatar_a : myRole === 'B' ? avs.avatar_b : null;
  const partnerAvatar = myRole === 'A' ? avs.avatar_b : myRole === 'B' ? avs.avatar_a : null;
  const myName = myRole === 'A' ? nameA : myRole === 'B' ? nameB : nameA;
  const partnerName = myRole === 'A' ? nameB : myRole === 'B' ? nameA : nameB;
  const since = formatSince(duo?.anniversary);

  useEffect(() => {
    setTab('profile');
    setDisplayName(myName || '');
    setUserDraft(username ? String(username).replace(/^@/, '') : '');
    try { setBio(localStorage.getItem(BIO_KEY(code)) || ''); } catch { setBio(''); }
    const prefs = loadPrefs();
    setAppearance(prefs.appearance || getAppearance());
    setLanguage(prefs.language || 'en');
    setFontSize(prefs.fontSize || 'medium');
    setSaveMsg('');
    setDeleting(false);
    setConfirmText('');
    setAvErr('');
  }, [myName, username, code]);

  useEffect(() => {
    if (!code || !myRole) return undefined;
    let alive = true;
    getDuoAvatars(code)
      .then(data => { if (alive) setAvs(data || { avatar_a: null, avatar_b: null }); })
      .catch(() => { if (alive) setAvs({ avatar_a: null, avatar_b: null }); });
    return () => { alive = false; };
  }, [code, myRole]);

  const confirmDelete = async () => {
    if (!duo || !onDeleteDuo) return;
    if (confirmText.trim().toUpperCase() !== duo.code) return;
    setDeleteBusy(true);
    try {
      await onDeleteDuo(duo);
    } finally {
      setDeleteBusy(false);
    }
  };

  const pickAccent = (themeId) => {
    if (!canSetTheme || !onSetTheme) return;
    const id = themeId === 'night' ? 'classic' : themeId;
    onSetTheme(formatTheme(id, flip));
  };

  const pickAppearance = (id) => {
    setAppearance(id);
    applyAppearance(id);
    savePrefs({ appearance: id });
  };

  const isAccentOn = (id) => accentActive === id;

  const pickAvatar = async (id) => {
    if (!code) return;
    setAvErr('');
    try {
      const r = await setMyAvatar(code, id);
      setAvs(r || { avatar_a: null, avatar_b: null });
      onAvatarChange?.(r);
      setPickerOpen(false);
    } catch (e) {
      setAvErr(e?.message || 'Could not save avatar — run schema-v27-avatars.sql in Supabase.');
    }
  };

  const saveChanges = async () => {
    setSaveBusy(true);
    setSaveMsg('');
    try {
      try { localStorage.setItem(BIO_KEY(code), bio); } catch { /* */ }
      applyAppearance(appearance);
      savePrefs({ appearance, language, fontSize });

      const nextUser = userDraft.trim().replace(/^@/, '');
      if (onSetUsername && nextUser && nextUser !== username) {
        await onSetUsername(nextUser);
      }
      setSaveMsg('Saved');
      window.setTimeout(() => setSaveMsg(''), 1800);
    } catch (e) {
      setSaveMsg(e?.message || 'Could not save');
    } finally {
      setSaveBusy(false);
    }
  };

  return (
    <div className="set-page" id="sect-settings">
      <div className="set-panel">
        <header className="set-head">
          <div className="set-head-copy">
            <h2 id="set-page-title">Settings</h2>
            <p>Manage your account, preferences and more.</p>
          </div>
          <div className="set-head-actions">
            <button
              type="button"
              className="set-iconbtn"
              aria-label="Appearance"
              title="Appearance"
              onClick={() => pickAppearance(appearance === 'light' ? 'dark' : 'light')}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
                strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
              </svg>
            </button>
            <span className="set-head-av" aria-hidden="true">
              <Avatar id={myAvatar} fallback={myName || '?'} size={34} />
            </span>
          </div>
        </header>

        <div className="set-tabs-row">
          <nav className="set-tabs" aria-label="Settings sections">
            {TABS.map(t => (
              <button
                key={t.id}
                type="button"
                className={'set-tab' + (tab === t.id ? ' on' : '')}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>
          <button
            type="button"
            className="set-save"
            disabled={saveBusy}
            onClick={saveChanges}
          >
            {saveBusy ? 'Saving…' : (saveMsg || 'Save Changes')}
          </button>
        </div>

        <div className="set-body">
        {tab === 'profile' && (
          <div className="set-grid">
            <div className="set-card set-card-profile">
              <h3 className="set-card-title">Profile Information</h3>
              <div className="set-profile-av">
                <div className="set-profile-ring">
                  <Avatar id={myAvatar} fallback={myName || '?'} size={88} />
                </div>
                <button
                  type="button"
                  className="set-ghost-btn"
                  disabled={!canSetAvatar}
                  onClick={() => canSetAvatar && setPickerOpen(true)}
                >
                  Change Avatar
                </button>
                {avErr && <p className="set-av-err">{avErr}</p>}
              </div>

              <label className="set-field">
                <span>Display Name</span>
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  readOnly
                  title="Your duo seat name — change it from Profile"
                />
              </label>
              <label className="set-field">
                <span>Username</span>
                <input
                  type="text"
                  value={userDraft ? `@${userDraft.replace(/^@/, '')}` : ''}
                  onChange={e => setUserDraft(e.target.value.replace(/^@/, ''))}
                  placeholder="@username"
                  maxLength={20}
                />
              </label>
              <label className="set-field">
                <span>Email</span>
                <input type="email" value={email || ''} readOnly />
              </label>
              <label className="set-field">
                <span>Bio</span>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  placeholder="Building memories, one game at a time."
                  maxLength={160}
                />
              </label>
            </div>

            <div className="set-col">
              <div className="set-card set-card-appear">
                <h3 className="set-card-title">Appearance</h3>

                <section className="set-block">
                  <div className="set-label">Theme</div>
                  <div className="set-theme-pills" role="group" aria-label="Theme">
                    {[
                      { id: 'dark', label: 'Dark', icon: 'moon' },
                      { id: 'dim', label: 'Dim', icon: 'dim' },
                      { id: 'system', label: 'System', icon: 'sys' },
                      { id: 'light', label: 'Light', icon: 'sun' },
                    ].map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        className={'set-theme-pill' + (appearance === opt.id ? ' on' : '')}
                        onClick={() => pickAppearance(opt.id)}
                      >
                        {opt.icon === 'moon' && (
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
                            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 14.5A7.5 7.5 0 0 1 9.5 4 7.5 7.5 0 1 0 20 14.5Z" />
                          </svg>
                        )}
                        {opt.icon === 'dim' && (
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
                            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="4" />
                            <path d="M12 3v1.5M12 19.5V21M4.5 12H3M21 12h-1.5M6 6l1 1M17 17l1 1M6 18l1-1M17 7l1-1" />
                          </svg>
                        )}
                        {opt.icon === 'sys' && (
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
                            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="13" rx="2" />
                            <path d="M8 21h8M12 17v4" />
                          </svg>
                        )}
                        {opt.icon === 'sun' && (
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
                            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="4" />
                            <path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
                          </svg>
                        )}
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </section>

                <section className="set-block">
                  <div className="set-accent-head">
                    <div className="set-label">Accent Color</div>
                    <button
                      type="button"
                      className="set-link-btn"
                      onClick={() => setAccentsOpen(o => !o)}
                    >
                      {accentsOpen ? 'Show less' : 'View all'}
                    </button>
                  </div>
                  <div
                    className={'set-accents' + (accentsOpen ? ' set-accents-all' : '')}
                    role="group"
                    aria-label="Accent color"
                  >
                    {visibleAccents.map(a => (
                      <button
                        key={a.id}
                        type="button"
                        className={'set-accent' + (isAccentOn(a.id) ? ' on' : '')}
                        aria-label={a.label}
                        aria-pressed={isAccentOn(a.id)}
                        disabled={!canSetTheme}
                        onClick={() => pickAccent(a.id)}
                      >
                        <span
                          className="set-accent-swatch"
                          style={{
                            background: `linear-gradient(135deg, ${a.p1} 50%, ${a.p2} 50%)`,
                          }}
                          aria-hidden="true"
                        />
                        <span className="set-accent-name">{a.label}</span>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="set-block set-block-last">
                  <div className="set-dual">
                    <label className="set-field">
                      <span>Language</span>
                      <select value={language} onChange={e => setLanguage(e.target.value)}>
                        <option value="en">English</option>
                        <option value="fr">Français</option>
                        <option value="ar">العربية</option>
                      </select>
                    </label>
                    <label className="set-field">
                      <span>Font Size</span>
                      <select value={fontSize} onChange={e => setFontSize(e.target.value)}>
                        <option value="small">Small</option>
                        <option value="medium">Medium</option>
                        <option value="large">Large</option>
                      </select>
                    </label>
                  </div>
                </section>
              </div>

              <div className="set-pair">
                <div className="set-card set-rel">
                  <h3 className="set-card-title">Relationship</h3>
                  <div className="set-rel-row">
                    <span className="set-rel-av">
                      <Avatar id={partnerAvatar} fallback={partnerName || '?'} size={40} />
                    </span>
                    <div className="set-rel-copy">
                      <div className="set-rel-role">Partner</div>
                      <div className="set-rel-name" title={partnerName}>{partnerName}</div>
                    </div>
                  </div>
                  <div className="set-rel-meta">
                    <span className="set-rel-role">Since</span>
                    <span className="set-rel-date">{since || 'Not set yet'}</span>
                  </div>
                </div>

                {duo && onDeleteDuo && (
                  <div className="set-card set-danger">
                    <h3 className="set-card-title">Danger Zone</h3>
                    {!deleting ? (
                      <div className="set-danger-main">
                        <div className="set-danger-copy">
                          <div className="set-danger-label">Delete Account</div>
                          <p className="set-danger-note">This action cannot be undone.</p>
                        </div>
                        <button
                          type="button"
                          className="set-danger-btn"
                          onClick={() => { setDeleting(true); setConfirmText(''); }}
                        >
                          Delete
                        </button>
                      </div>
                    ) : (
                      <div className="set-danger-confirm">
                        <p>
                          This erases <b>{duo.nameA} & {duo.nameB}</b> for both of you.
                          Type <b>{duo.code}</b> to confirm.
                        </p>
                        <input
                          type="text"
                          maxLength={5}
                          value={confirmText}
                          onChange={e => setConfirmText(e.target.value)}
                          autoComplete="off"
                          aria-label="Confirm duo code"
                        />
                        <div className="set-danger-row">
                          <button
                            type="button"
                            className="set-danger-btn set-danger-btn-solid"
                            disabled={deleteBusy || confirmText.trim().toUpperCase() !== duo.code}
                            onClick={confirmDelete}
                          >
                            {deleteBusy ? 'Deleting…' : 'Delete forever'}
                          </button>
                          <button
                            type="button"
                            className="set-danger-cancel"
                            onClick={() => { setDeleting(false); setConfirmText(''); }}
                          >
                            Keep it
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'account' && (
          <div className="set-card">
            <h3 className="set-card-title">Account</h3>
            <p className="set-muted">Sign out of this device. Your duo and records stay safe.</p>
            {onSignOut ? (
              <button type="button" className="set-signout" onClick={onSignOut}>
                Sign out
              </button>
            ) : (
              <PlaceholderTab title="Account" note="Sign in to manage your account." />
            )}
          </div>
        )}

        {tab === 'preferences' && (
          <PlaceholderTab title="Preferences" note="More preference controls are coming soon." />
        )}
        {tab === 'privacy' && (
          <PlaceholderTab title="Privacy" note="Privacy controls will live here." />
        )}
        {tab === 'notifications' && (
          <PlaceholderTab title="Notifications" note="Notification preferences will live here." />
        )}
        {tab === 'apps' && (
          <PlaceholderTab
            title="Connected Apps"
            note="Linked services and the Watch Party extension will appear here."
          />
        )}
      </div>

      {pickerOpen && (
        <AvatarPicker
          value={myAvatar}
          fallback={myName}
          onSelect={pickAvatar}
          onClose={() => setPickerOpen(false)}
        />
      )}
      </div>
    </div>
  );
}
