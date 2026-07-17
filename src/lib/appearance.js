// Appearance — DuoArcade stays on dark mode.

const KEY = 'duoarcade-appearance';

export function getAppearance() {
  return 'dark';
}

export function applyAppearance() {
  document.documentElement.setAttribute('data-appearance', 'dark');
  try { localStorage.setItem(KEY, 'dark'); } catch { /* ignore */ }
  return 'dark';
}

export function initAppearance() {
  return applyAppearance();
}
