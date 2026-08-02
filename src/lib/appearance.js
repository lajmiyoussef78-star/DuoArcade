// Appearance — dark | dim | light | system → data-appearance on <html>

const KEY = 'duoarcade-appearance';
const PREF_KEY = 'duoarcade-settings-prefs';

const VALID = new Set(['dark', 'dim', 'light', 'system']);

function systemAppearance() {
  try {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function resolveAppearance(pref) {
  const p = VALID.has(pref) ? pref : 'dark';
  if (p === 'system') return systemAppearance();
  return p;
}

export function getAppearance() {
  try {
    const prefs = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
    if (VALID.has(prefs.appearance)) return prefs.appearance;
  } catch { /* ignore */ }
  try {
    const raw = localStorage.getItem(KEY);
    if (VALID.has(raw)) return raw;
  } catch { /* ignore */ }
  return 'dark';
}

export function applyAppearance(pref = getAppearance()) {
  const choice = VALID.has(pref) ? pref : 'dark';
  const resolved = resolveAppearance(choice);
  document.documentElement.setAttribute('data-appearance', resolved);
  try { localStorage.setItem(KEY, choice); } catch { /* ignore */ }
  try {
    const prefs = JSON.parse(localStorage.getItem(PREF_KEY) || '{}') || {};
    prefs.appearance = choice;
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent('duoarcade-appearance', { detail: { pref: choice, resolved } }));
  return resolved;
}

let mediaBound = false;

function bindSystemListener() {
  if (mediaBound || typeof window === 'undefined' || !window.matchMedia) return;
  mediaBound = true;
  try {
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => {
      if (getAppearance() === 'system') applyAppearance('system');
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  } catch { /* ignore */ }
}

export function initAppearance() {
  bindSystemListener();
  return applyAppearance();
}
