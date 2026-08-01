// Arena game catalogs.
// ARENA_GAMES = playable today (team-relay sync).
// ARENA_LIVE_STRONG / ARENA_LIVE_MAYBE = display-only for future Live Arena sync.

/** Playable with current team-relay Arena sync. */
export const ARENA_GAMES = [
  'connect4', 'ttt', 'dots',
  'gomoku', 'hex', 'nim', 'reversi', 'mancala', 'checkers', 'pig', 'memory', 'race'
];

/**
 * Strong couple-vs-couple Live 2v2 fits (+ seabattle partial).
 * Shown in Arena; not wired to create/queue yet.
 */
export const ARENA_LIVE_STRONG = [
  { id: 'seabattle', kind: 'needs-fog', note: 'Relay API fits; needs fog + team POV' },
  { id: 'microsoccer', kind: 'realtime-team', note: '2 cars per side (today still 1v1)' },
  { id: 'nightcurling', kind: 'realtime-team', note: 'Doubles throw / sweep order' },
  { id: 'uno', kind: 'partnership-cards', note: '4-seat partnership; hidden hands on server' },
  { id: 'dominoes', kind: 'partnership-cards', note: 'Partnership bones' },
  { id: 'chkobba', kind: 'partnership-cards', note: '4-player partnership capture' },
  { id: 'forbiddenwords', kind: 'party-teams', note: 'Team Taboo' },
  { id: 'sketch', kind: 'party-teams', note: 'Team draw / guess' },
];

/**
 * Possible with redesign — secondary band, not native 2v2 today.
 */
export const ARENA_LIVE_MAYBE = [
  { id: 'pong', kind: 'doubles', note: 'Doubles paddles (today 1v1)' },
  { id: 'sumobomb', kind: 'team-control', note: 'Team-colored sumos; still 2 humans today' },
  { id: 'wordbomb', kind: 'party-teams', note: 'Team lives / pass order' },
];

/** @deprecated Prefer ARENA_LIVE_STRONG + ARENA_LIVE_MAYBE */
export const ARENA_LIVE_CANDIDATES = [...ARENA_LIVE_STRONG, ...ARENA_LIVE_MAYBE];

export const ARENA_UPCOMING_STRONG = ARENA_LIVE_STRONG.map(c => c.id);
export const ARENA_UPCOMING_MAYBE = ARENA_LIVE_MAYBE.map(c => c.id);
export const ARENA_UPCOMING = [...ARENA_UPCOMING_STRONG, ...ARENA_UPCOMING_MAYBE];

export const ARENA_GAME_INFO = {
  connect4: { art: '● ● ● ●', tagline: 'Drop together. Win together.' },
  ttt: { art: '⊞ ⊞ ⊞', tagline: 'Nine boards — claim the big grid.' },
  dots: { art: '□ · □', tagline: 'Captured boxes pass to your partner.' },
  gomoku: { art: '● ● ● ● ●', tagline: 'Five in a row, two minds per team.' },
  hex: { art: '⬡ ⬡ ⬡', tagline: 'Bridge your sides as a relay.' },
  nim: { art: '| | |', tagline: 'Quick misère rounds between duos.' },
  reversi: { art: '● ○ ●', tagline: 'Flips and extra turns chain to partners.' },
  mancala: { art: '◯ ◯ ◯', tagline: 'Extra sowing passes the baton.' },
  checkers: { art: '◆ · ◆', tagline: 'Jump chains relay across partners.' },
  pig: { art: '🎲 50', tagline: 'Hot dice streaks stay with your team.' },
  memory: { art: '🃏 🃏', tagline: 'Matched pairs keep the relay alive.' },
  race: { art: '🏁 🎲', tagline: 'Roll and race as a tag team.' },
  seabattle: { art: '🚢 💥', tagline: 'Shared fleet — needs fog before Live 2v2.' },
  microsoccer: { art: '⚽ 2v2', tagline: 'Two cars a side once Live sync lands.' },
  nightcurling: { art: '🥌', tagline: 'Doubles curling — throw and sweep.' },
  uno: { art: 'UNO', tagline: 'Four seats, partners across the table.' },
  dominoes: { art: '🁠', tagline: 'Partnership bones.' },
  chkobba: { art: '🂡', tagline: 'Four-player partnership capture.' },
  forbiddenwords: { art: '🚫', tagline: 'Clue as a duo — trap the other couple.' },
  sketch: { art: '✎ ?', tagline: 'One draws, your duo scores the guess.' },
  pong: { art: '▐ ▌', tagline: 'Doubles paddles — redesign from 1v1.' },
  sumobomb: { art: '💣 ⬡', tagline: 'Team rings — still two pilots today.' },
  wordbomb: { art: '💣 ABC', tagline: 'Team lives under the fuse.' },
};

export function isArenaPlayable(id) {
  return ARENA_GAMES.includes(id);
}

/** @param {Record<string, any>} engines ENGINES map from engines/index.js */
export function assertArenaReady(engines) {
  if (!engines) throw new Error('assertArenaReady(engines) requires the ENGINES map');
  for (const id of ARENA_GAMES) {
    const eng = engines[id];
    if (!eng) throw new Error(`Missing engine: ${id}`);
    if (eng.meta?.realtime) throw new Error(`Realtime engine cannot be arena: ${id}`);
    if (!eng.initialState || !eng.applyMove || !eng.winner) {
      throw new Error(`Engine missing turn-based API: ${id}`);
    }
  }
}
