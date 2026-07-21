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
  night:   { label: 'Night',   p1: '#7FA8FF', p2: '#FF7FA8', candle: '#FFC66E' },
  ocean:   { label: 'Ocean',   p1: '#6FE0D0', p2: '#7FA8FF', candle: '#9FE870' },
  ember:   { label: 'Ember',   p1: '#FFB36B', p2: '#FF6B8A', candle: '#FFD36B' },
  orchid:  { label: 'Orchid',  p1: '#C89BFF', p2: '#FF8AD1', candle: '#FFC66E' },
  forest:  { label: 'Forest',  p1: '#6BCB8A', p2: '#4A9B7A', candle: '#E8C96A' },
  sunset:  { label: 'Sunset',  p1: '#FF8E6B', p2: '#FF5C8A', candle: '#FFD27A' },
  aurora:  { label: 'Aurora',  p1: '#5CE1C5', p2: '#A78BFA', candle: '#F0E68C' },
  rose:    { label: 'Rose',    p1: '#F2A0B8', p2: '#E06B8A', candle: '#F5D0A9' },
  citrus:  { label: 'Citrus',  p1: '#F5D76E', p2: '#7ED957', candle: '#FF9F43' },
  arctic:  { label: 'Arctic',  p1: '#8EC5FF', p2: '#B8E0FF', candle: '#E8F4FF' },
  velvet:  { label: 'Velvet',  p1: '#9B6BFF', p2: '#FF4F8B', candle: '#FFB86B' },
  magma:   { label: 'Magma',   p1: '#FF6B3D', p2: '#C23B22', candle: '#FFC14A' },
  mint:    { label: 'Mint',    p1: '#7DDFC3', p2: '#5BB8E8', candle: '#F4E07A' },
  grape:   { label: 'Grape',   p1: '#A855F7', p2: '#6366F1', candle: '#FBBF24' },
  honey:   { label: 'Honey',   p1: '#E8B84A', p2: '#D4783A', candle: '#FFE8A3' },
  neon:    { label: 'Neon',    p1: '#39FF14', p2: '#FF00E5', candle: '#00F0FF' }
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
