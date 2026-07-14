// Central list of duo games that work in 2v2 Arena (team relay, no hidden state).
import { ENGINES } from '../engines/index.js';

export const ARENA_GAMES = [
  'connect4', 'ttt', 'dots',
  'gomoku', 'hex', 'nim', 'reversi', 'mancala', 'checkers', 'pig', 'memory', 'race'
];

export const ARENA_GAME_INFO = {
  connect4: { art: '● ● ● ●', tagline: 'Drop together. Win together.' },
  ttt: { art: '× ○ ×', tagline: 'Fast relay rounds for four.' },
  dots: { art: '□ · □', tagline: 'Captured boxes pass to your partner.' },
  gomoku: { art: '● ● ● ● ●', tagline: 'Five in a row, two minds per team.' },
  hex: { art: '⬡ ⬡ ⬡', tagline: 'Bridge your sides as a relay.' },
  nim: { art: '| | |', tagline: 'Quick misère rounds between duos.' },
  reversi: { art: '● ○ ●', tagline: 'Flips and extra turns chain to partners.' },
  mancala: { art: '◯ ◯ ◯', tagline: 'Extra sowing passes the baton.' },
  checkers: { art: '◆ · ◆', tagline: 'Jump chains relay across partners.' },
  pig: { art: '🎲 50', tagline: 'Hot dice streaks stay with your team.' },
  memory: { art: '🃏 🃏', tagline: 'Matched pairs keep the relay alive.' },
  race: { art: '🏁 🎲', tagline: 'Roll and race as a tag team.' }
};

export function assertArenaReady() {
  for (const id of ARENA_GAMES) {
    const eng = ENGINES[id];
    if (!eng) throw new Error(`Missing engine: ${id}`);
    if (eng.meta.realtime) throw new Error(`Realtime engine cannot be arena: ${id}`);
    if (!eng.initialState || !eng.applyMove || !eng.winner) {
      throw new Error(`Engine missing turn-based API: ${id}`);
    }
  }
}
