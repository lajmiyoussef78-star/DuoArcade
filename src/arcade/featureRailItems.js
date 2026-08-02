export const FEATURE_RAIL_ITEMS = [
  { id: 'sect-together', icon: 'together', label: 'Together', accent: 'p2', scrollOnPage: true,
    desc: 'How long you’ve been together, where you both are, and your anniversary countdown.' },
  { id: 'sect-favorites', icon: 'star', label: 'Favorites', accent: 'candle', scrollOnPage: true,
    desc: 'Games you both starred — quick access above the full Play shelf.' },
  { id: 'sect-play', icon: 'play', label: 'Games', accent: 'p1', scrollOnPage: true,
    desc: 'Pick a game and invite your partner — Connect 4, Ultimate Tic-Tac-Toe, quizzes, and more.' },
  { id: 'sect-challenge-history', icon: 'history', label: 'Challenges', accent: 'candle',
    desc: 'Past best-of-threes — games played, stakes owed, and host confirmation when the loser pays up.' },
  { id: 'sect-tonight', icon: 'tonight', label: 'Tonight Engine', accent: 'p1',
    desc: 'Tell us how much time you have — we’ll suggest a game and a movie for the evening.' },
  { id: 'arena', icon: 'arena', label: '2v2 Arena', route: '/app/arena', accent: 'candle',
    desc: 'Take on another duo in public matchmaking or a direct challenge.' },
  { id: 'sect-wall', icon: 'wall', label: 'Our wall', accent: 'p2',
    desc: 'A shared whiteboard you both draw on in real time.' },
  { id: 'sect-list', icon: 'list', label: 'Our list', accent: 'good',
    desc: 'A todo list you build together — movies to watch, places to go, anything.' },
  { id: 'sect-bucket', icon: 'bucket', label: 'Bucket List', accent: 'candle',
    desc: 'Write your dreams together, seal them until a date you pick, then open the capsule and see what you made real.' },
  { id: 'sect-week', icon: 'week', label: 'Our week', accent: 'p1',
    desc: 'A shared weekly timetable — plans, calls, and free evenings, live for both of you.' },
  { id: 'sect-snap', icon: 'snap', label: 'Duo Snap', accent: 'candle',
    desc: 'Timed paired photos — both of you snap, then reveal together. Streaks, pause, history.' },
  { id: 'sect-watch', icon: 'watch', label: 'Watch', accent: 'candle',
    desc: 'YouTube Night, Reels Party, or Movie Night — always in your duo room.' },
  { id: 'sect-pass', icon: 'pass', label: 'Duo Pass', accent: 'candle',
    desc: 'Unlock keepsake cards and everything we ship next.' },
  { id: 'sect-settings', icon: 'gear', label: 'Settings', accent: 'p1',
    desc: 'Account, appearance, relationship, and danger-zone controls.' },
  { id: 'chat', icon: 'chat', label: 'Chat', accent: 'good', openChat: true,
    desc: 'Message your partner — typing, online, and seen receipts.' }
];

export function featureRailItem(id) {
  return FEATURE_RAIL_ITEMS.find(it => it.id === id);
}
