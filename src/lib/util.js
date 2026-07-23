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

export const THEMES = {
  night:   { label: 'Night',   p1: '#6B9BFF', p2: '#FF6B9E', candle: '#FFC66E' },
  ocean:   { label: 'Ocean',   p1: '#2ED9C3', p2: '#4F7CFF', candle: '#9FE870' },
  ember:   { label: 'Ember',   p1: '#FFB347', p2: '#FF4D6D', candle: '#FFD36B' },
  orchid:  { label: 'Orchid',  p1: '#9B6BFF', p2: '#FF6BB5', candle: '#FFC66E' },
  forest:  { label: 'Forest',  p1: '#4ADE80', p2: '#1D6B5A', candle: '#E8C96A' },
  sunset:  { label: 'Sunset',  p1: '#FF7A45', p2: '#FF4F9A', candle: '#FFD27A' },
  aurora:  { label: 'Aurora',  p1: '#2EE6C5', p2: '#8B6BFF', candle: '#F0E68C' },
  rose:    { label: 'Rose',    p1: '#FFB0C8', p2: '#C2185B', candle: '#F5D0A9' },
  citrus:  { label: 'Citrus',  p1: '#FFD54A', p2: '#4CD964', candle: '#FF9F43' },
  arctic:  { label: 'Arctic',  p1: '#5BB8FF', p2: '#C9B8FF', candle: '#E8F4FF' },
  velvet:  { label: 'Velvet',  p1: '#8B5CFF', p2: '#FF3D8A', candle: '#FFB86B' },
  magma:   { label: 'Magma',   p1: '#FF8A2B', p2: '#B91C1C', candle: '#FFC14A' },
  mint:    { label: 'Mint',    p1: '#5EEAD4', p2: '#3B82F6', candle: '#F4E07A' },
  grape:   { label: 'Grape',   p1: '#C026FF', p2: '#4F46E5', candle: '#FBBF24' },
  honey:   { label: 'Honey',   p1: '#F5C542', p2: '#B45309', candle: '#FFE8A3' },
  neon:    { label: 'Neon',    p1: '#39FF14', p2: '#FF00E5', candle: '#00F0FF' },
  coral:   { label: 'Coral',   p1: '#FF6F61', p2: '#00C2CB', candle: '#FFD166' },
  ink:     { label: 'Ink',     p1: '#3B6FE8', p2: '#E8B84A', candle: '#F5E6C8' },
  sakura:  { label: 'Sakura',  p1: '#FF8FB8', p2: '#6BBF8A', candle: '#FFE4B5' },
  storm:   { label: 'Storm',   p1: '#6478A8', p2: '#B24BFF', candle: '#A8D8FF' },
  peach:   { label: 'Peach',   p1: '#FF9A6B', p2: '#7B8CFF', candle: '#FFE0B2' },
  jade:    { label: 'Jade',    p1: '#10B981', p2: '#E11D48', candle: '#FDE68A' },
  twilight:{ label: 'Twilight',p1: '#6366F1', p2: '#F472B6', candle: '#FCD34D' },
  solar:   { label: 'Solar',   p1: '#FACC15', p2: '#2563EB', candle: '#FB923C' },
  cocoa:   { label: 'Cocoa',   p1: '#A16207', p2: '#F9A8D4', candle: '#FEF3C7' },
  lagoon:  { label: 'Lagoon',  p1: '#22D3EE', p2: '#E879F9', candle: '#FDE047' },
  lava:    { label: 'Lava',    p1: '#FB923C', p2: '#7C3AED', candle: '#FDE68A' },
  moss:    { label: 'Moss',    p1: '#84CC16', p2: '#0F766E', candle: '#FBBF24' },
};

/** theme field: "night" or "night:flip" (swap partner colors). */
export function parseTheme(raw) {
  const s = String(raw || 'night');
  const flip = s.endsWith(':flip');
  const name = flip ? s.slice(0, -5) : s;
  return { name: THEMES[name] ? name : 'night', flip };
}

export function formatTheme(name, flip = false) {
  const n = THEMES[name] ? name : 'night';
  return flip ? `${n}:flip` : n;
}

export function themeColors(raw) {
  const { name, flip } = parseTheme(raw);
  const t = THEMES[name] || THEMES.night;
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

export function applyTheme(raw) {
  const c = themeColors(raw);
  const rootStyle = document.documentElement.style;
  rootStyle.setProperty('--p1', c.p1);
  rootStyle.setProperty('--p2', c.p2);
  rootStyle.setProperty('--candle', c.candle);
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
