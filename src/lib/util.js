export const other = p => (p === 'A' ? 'B' : 'A');
export const today = () => new Date().toISOString().slice(0, 10);
export const yesterday = () => new Date(Date.now() - 864e5).toISOString().slice(0, 10);

export const SEAT_KEY = 'duoarcade-seats-v2';
export const loadSeats = () => JSON.parse(localStorage.getItem(SEAT_KEY) || '{}');
export const saveSeat = (code, token) => {
  const s = loadSeats();
  s[code] = token;
  localStorage.setItem(SEAT_KEY, JSON.stringify(s));
};
export const removeSeat = code => {
  const s = loadSeats();
  delete s[code];
  delete s['invite-' + code];
  localStorage.setItem(SEAT_KEY, JSON.stringify(s));
};

/* candle = duo chrome accent (rims, glows, active chips) — usually the mid
   tone between p1 and p2. Classic = purple / pink (main default). */
export const DEFAULT_THEME = 'classic';

export const THEMES = {
  classic: { label: 'Classic', p1: '#8B5CF6', p2: '#EC4899', candle: '#C084FC' },
  /* Legacy id — same palette as Classic so old “night” duos keep working */
  night:   { label: 'Classic', p1: '#8B5CF6', p2: '#EC4899', candle: '#C084FC' },
  lime:    { label: 'Lime',    p1: '#A3E635', p2: '#8FAF7A', candle: '#F5D76E' },
  velvet:  { label: 'Pink',    p1: '#FF3D8A', p2: '#A78BFA', candle: '#F472B6' },
  mint:    { label: 'Mint',    p1: '#2DD4BF', p2: '#38BDF8', candle: '#5EEAD4' },
  ocean:   { label: 'Teal',    p1: '#14B8A6', p2: '#3B82F6', candle: '#2DD4BF' },
  arctic:  { label: 'Blue',    p1: '#38BDF8', p2: '#818CF8', candle: '#7DD3FC' },
  sunset:  { label: 'Orange',  p1: '#FB923C', p2: '#F472B6', candle: '#FDBA74' },
  ember:   { label: 'Ember',   p1: '#FB7185', p2: '#F97316', candle: '#FDA4AF' },
  orchid:  { label: 'Orchid',  p1: '#A78BFA', p2: '#F472B6', candle: '#D8B4FE' },
  forest:  { label: 'Forest',  p1: '#4ADE80', p2: '#1D8F76', candle: '#86EFAC' },
  aurora:  { label: 'Aurora',  p1: '#2EE6C5', p2: '#8B6BFF', candle: '#67E8F9' },
  rose:    { label: 'Rose',    p1: '#FFB0C8', p2: '#E11D67', candle: '#FBCFE8' },
  citrus:  { label: 'Citrus',  p1: '#A3E635', p2: '#4CD964', candle: '#BEF264' },
  magma:   { label: 'Magma',   p1: '#FB7185', p2: '#BE123C', candle: '#FDA4AF' },
  grape:   { label: 'Grape',   p1: '#C026FF', p2: '#6366F1', candle: '#D8B4FE' },
  honey:   { label: 'Honey',   p1: '#FACC15', p2: '#F97316', candle: '#FDE68A' },
  neon:    { label: 'Neon',    p1: '#39FF14', p2: '#FF00E5', candle: '#00F0FF' },
  coral:   { label: 'Coral',   p1: '#FF6F61', p2: '#00C2CB', candle: '#5EEAD4' },
  ink:     { label: 'Ink',     p1: '#3B6FE8', p2: '#FACC15', candle: '#93C5FD' },
  sakura:  { label: 'Sakura',  p1: '#FF8FB8', p2: '#6BBF8A', candle: '#FBCFE8' },
  storm:   { label: 'Storm',   p1: '#6478A8', p2: '#B24BFF', candle: '#A8D8FF' },
  peach:   { label: 'Peach',   p1: '#FF9A6B', p2: '#7B8CFF', candle: '#FDBA74' },
  jade:    { label: 'Jade',    p1: '#10B981', p2: '#E11D48', candle: '#6EE7B7' },
  twilight:{ label: 'Twilight',p1: '#6366F1', p2: '#F472B6', candle: '#A5B4FC' },
  solar:   { label: 'Solar',   p1: '#FACC15', p2: '#2563EB', candle: '#FDE047' },
  cocoa:   { label: 'Cocoa',   p1: '#C084FC', p2: '#F9A8D4', candle: '#E9D5FF' },
  lagoon:  { label: 'Lagoon',  p1: '#22D3EE', p2: '#E879F9', candle: '#67E8F9' },
  lava:    { label: 'Lava',    p1: '#FB923C', p2: '#7C3AED', candle: '#C4B5FD' },
  moss:    { label: 'Moss',    p1: '#84CC16', p2: '#14B8A6', candle: '#BEF264' },
};

/** theme field: "classic" or "classic:flip" (swap partner colors). */
export function parseTheme(raw) {
  const s = String(raw || DEFAULT_THEME);
  const flip = s.endsWith(':flip');
  let name = flip ? s.slice(0, -5) : s;
  if (name === 'night') name = 'classic'; /* legacy purple id */
  return { name: THEMES[name] ? name : DEFAULT_THEME, flip };
}

export function formatTheme(name, flip = false) {
  const n = THEMES[name] ? name : DEFAULT_THEME;
  return flip ? `${n}:flip` : n;
}

export function themeColors(raw) {
  const { name, flip } = parseTheme(raw);
  const t = THEMES[name] || THEMES[DEFAULT_THEME];
  return {
    name,
    flip,
    label: t.label,
    p1: flip ? t.p2 : t.p1,
    p2: flip ? t.p1 : t.p2,
    candle: t.candle,
    baseP1: t.p1,
    baseP2: t.p2
  };
}

const PALE_LIGHT_THEMES = new Set([
  'lime', 'citrus', 'honey', 'solar', 'neon', 'moss', 'forest', 'mint',
]);

function deepenForLight(hex, amount = 28) {
  return `color-mix(in srgb, ${hex} ${100 - amount}%, #111827 ${amount}%)`;
}

export function applyTheme(raw) {
  const c = themeColors(raw);
  const rootStyle = document.documentElement.style;
  const isLight = document.documentElement.getAttribute('data-appearance') === 'light';
  const pale = isLight && PALE_LIGHT_THEMES.has(c.name);
  const p1 = pale ? deepenForLight(c.p1, 26) : c.p1;
  const p2 = pale ? deepenForLight(c.p2, 18) : c.p2;
  const candle = pale ? deepenForLight(c.candle, 30) : c.candle;
  const mid = `color-mix(in srgb, ${p1} 50%, ${p2})`;
  rootStyle.setProperty('--p1', p1);
  rootStyle.setProperty('--p2', p2);
  rootStyle.setProperty('--candle', candle);
  /* Redesign tokens — primary, secondary, mid, and chrome follow Settings. */
  rootStyle.setProperty('--color-primary', p1);
  rootStyle.setProperty('--color-secondary', p2);
  rootStyle.setProperty('--color-mid', mid);
  rootStyle.setProperty('--color-warning', candle);
  rootStyle.setProperty('--acc', p1);
  rootStyle.setProperty('--acc-indigo', p1);
  rootStyle.setProperty('--acc-magenta', p2);
  rootStyle.setProperty('--acc-amber', candle);
  rootStyle.setProperty('--acc-lime', p1);
  rootStyle.setProperty('--acc-soft', `color-mix(in srgb, ${p1} 70%, #fff)`);
  rootStyle.setProperty('--p1s', `color-mix(in srgb, ${p1} 22%, var(--bg-base))`);
  rootStyle.setProperty('--p2s', `color-mix(in srgb, ${p2} 22%, var(--bg-base))`);
  rootStyle.setProperty('--candles', `color-mix(in srgb, ${candle} 16%, var(--bg-base))`);
  rootStyle.setProperty('--theme-glow', `color-mix(in srgb, ${candle} 45%, transparent)`);
  rootStyle.setProperty('--theme-line', `color-mix(in srgb, ${candle} 42%, var(--border-subtle))`);
  rootStyle.setProperty('--grad-primary',
    `linear-gradient(96deg, ${p1} 0%, ${mid} 50%, ${p2} 100%)`);
  rootStyle.setProperty('--grad-primary-soft',
    `linear-gradient(96deg, color-mix(in srgb, ${p1} 22%, transparent), color-mix(in srgb, ${p2} 12%, transparent))`);
}

export function totalsOf(duo) {
  let a = 0, b = 0, d = 0;
  for (const rec of Object.values(duo.records || {})) {
    a += rec.a || 0; b += rec.b || 0; d += rec.d || 0;
  }
  return { a, b, d, games: a + b + d };
}

const GAME_MILESTONES = [10, 25, 50, 100, 250];
const WATCH_MILESTONES = [1, 10, 25];

function watchMilestoneLabel(m, lit) {
  if (m === 1) return lit ? '🎬 First movie night' : 'First movie night';
  return lit ? `🎬 ${m} movie nights` : `${m} movie nights`;
}

/** Latest completed milestone + next in progress, for the duo profile. */
export function profileMilestones(duo, totals) {
  const out = [];
  const games = totals.games;
  const latestGame = GAME_MILESTONES.filter(m => games >= m).at(-1);
  const nextGame = GAME_MILESTONES.find(m => games < m);
  if (latestGame) out.push({ lit: true, text: `🏆 ${latestGame} games together` });
  if (nextGame) out.push({ lit: false, text: `${nextGame} games · ${nextGame - games} to go` });

  const w = duo.tasteTotal || 0;
  const latestWatch = WATCH_MILESTONES.filter(m => w >= m).at(-1);
  const nextWatch = WATCH_MILESTONES.find(m => w < m);
  if (latestWatch) out.push({ lit: true, text: watchMilestoneLabel(latestWatch, true) });
  if (nextWatch) out.push({ lit: false, text: `${watchMilestoneLabel(nextWatch, false)} · ${nextWatch - w} to go` });

  return out;
}

// Applied to any patch that finishes a game or movie night:
// count the evening once per day and keep the streak honest.
export function finishPatch(duo, patch) {
  const day = today();
  if (duo.lastDay !== day) {
    patch.evenings = (duo.evenings || 0) + 1;
    patch.streak = duo.lastDay === yesterday() ? (duo.streak || 0) + 1 : 1;
    patch.bestStreak = Math.max(duo.bestStreak || 0, patch.streak);
    patch.lastDay = day;
  }
  return patch;
}

export function downloadKeepsake(duo) {
  const t = totalsOf(duo);
  const th = themeColors(duo.theme);
  const cv = document.createElement('canvas');
  cv.width = 1080; cv.height = 1080;
  const x = cv.getContext('2d');
  x.fillStyle = '#191420'; x.fillRect(0, 0, 1080, 1080);
  x.fillStyle = th.candle; x.fillRect(0, 0, 1080, 14);
  x.textAlign = 'center';
  x.fillStyle = th.p1; x.font = '900 84px Georgia';
  x.fillText(duo.nameA, 540, 300);
  x.fillStyle = th.candle; x.font = '400 64px Georgia';
  x.fillText('&', 540, 390);
  x.fillStyle = th.p2; x.font = '900 84px Georgia';
  x.fillText(duo.nameB, 540, 490);
  x.fillStyle = '#F2EDF7'; x.font = '600 44px Arial';
  x.fillText(`${t.games} games \u00b7 ${duo.evenings || 0} evenings together`, 540, 630);
  const taste = duo.tasteTotal > 0
    ? Math.round(100 * duo.tasteAgree / duo.tasteTotal) + '% taste match' : '';
  x.fillStyle = '#A99FBC'; x.font = '400 38px Arial';
  x.fillText(`best streak ${duo.bestStreak || 0}${taste ? ' \u00b7 ' + taste : ''}`, 540, 700);
  x.fillStyle = th.candle; x.font = '700 30px Arial';
  x.fillText('DUOARCADE \u00b7 ' + new Date().toLocaleDateString(), 540, 950);
  const link = document.createElement('a');
  link.download = `duoarcade-${duo.nameA}-${duo.nameB}.png`.toLowerCase().replace(/\s+/g, '-');
  link.href = cv.toDataURL('image/png');
  link.click();
}

export function videoIdFrom(url) {
  const m = (url || '').match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}
