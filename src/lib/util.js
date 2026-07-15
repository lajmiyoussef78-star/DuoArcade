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
  night:  { label: 'Night',  p1: '#7FA8FF', p2: '#FF7FA8', candle: '#FFC66E' },
  ocean:  { label: 'Ocean',  p1: '#6FE0D0', p2: '#7FA8FF', candle: '#9FE870' },
  ember:  { label: 'Ember',  p1: '#FFB36B', p2: '#FF6B8A', candle: '#FFD36B' },
  orchid: { label: 'Orchid', p1: '#C89BFF', p2: '#FF8AD1', candle: '#FFC66E' }
};

export function applyTheme(name) {
  const t = THEMES[name] || THEMES.night;
  const rootStyle = document.documentElement.style;
  rootStyle.setProperty('--p1', t.p1);
  rootStyle.setProperty('--p2', t.p2);
  rootStyle.setProperty('--candle', t.candle);
}

export function totalsOf(duo) {
  let a = 0, b = 0, d = 0;
  for (const rec of Object.values(duo.records || {})) {
    a += rec.a || 0; b += rec.b || 0; d += rec.d || 0;
  }
  return { a, b, d, games: a + b + d };
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
  const th = THEMES[duo.theme] || THEMES.night;
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
