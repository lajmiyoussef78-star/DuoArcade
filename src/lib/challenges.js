// src/lib/challenges.js — DuoArcade Challenges (Supabase + pure helpers).

import { CONFIG } from './config.js';

let clientPromise = null;

async function getClient() {
  if (!clientPromise) {
    const { createClient } = await import('@supabase/supabase-js');
    clientPromise = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  }
  return clientPromise;
}

export async function myRoleInDuo(code) {
  const supabase = await getClient();
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData?.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase.rpc('list_my_duos', {});
  if (error) return null;
  const d = (data || []).find(x => x.code === code);
  if (!d) return null;
  return d.member_a === uid ? 'A' : d.member_b === uid ? 'B' : null;
}

export async function duoNames(code) {
  const supabase = await getClient();
  const { data } = await supabase.rpc('list_my_duos', {});
  const d = (data || []).find(x => x.code === code);
  return d ? { A: d.name_a, B: d.name_b } : { A: 'A', B: 'B' };
}

async function ping(code) {
  try {
    const ch = await challengeChannel(code);
    await ch.send({ k: 'chal' });
    // leave channel open briefly then close — callers also hold their own
    setTimeout(() => ch.close(), 400);
  } catch (_) { /* ignore */ }
}

export async function createChallenge(duoCode, stake, game1) {
  const supabase = await getClient();
  const { data, error } = await supabase.rpc('create_challenge', {
    p_duo_code: duoCode, p_stake: stake, p_game1: game1
  });
  if (error) throw new Error(error.message);
  await ping(duoCode);
  return data;
}

export async function respondChallenge(id, accept, game2 = null, game3 = null) {
  const supabase = await getClient();
  const { data, error } = await supabase.rpc('respond_challenge', {
    p_id: id, p_accept: accept, p_game2: game2, p_game3: game3
  });
  if (error) throw new Error(error.message);
  if (data?.duo_code) await ping(data.duo_code);
  return data;
}

export async function setChallengeResult(id, slot, winner) {
  const supabase = await getClient();
  const { data, error } = await supabase.rpc('set_challenge_result', {
    p_id: id, p_slot: slot, p_winner: winner
  });
  if (error) throw new Error(error.message);
  if (data?.duo_code) await ping(data.duo_code);
  return data;
}

export async function cancelChallenge(id) {
  const supabase = await getClient();
  const { data, error } = await supabase.rpc('cancel_challenge', { p_id: id });
  if (error) throw new Error(error.message);
  if (data?.duo_code) await ping(data.duo_code);
  return data;
}

export async function getChallenges(duoCode) {
  const supabase = await getClient();
  const { data, error } = await supabase.rpc('get_challenges', { p_duo_code: duoCode });
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? data : [];
}

export async function challengeChannel(code) {
  const supabase = await getClient();
  let cb = () => {};
  const ch = supabase
    .channel('chal-' + code, { config: { broadcast: { self: false } } })
    .on('broadcast', { event: 'm' }, p => cb(p.payload))
    .subscribe();
  return {
    send: payload => ch.send({ type: 'broadcast', event: 'm', payload }),
    on: fn => { cb = fn; },
    close: () => supabase.removeChannel(ch)
  };
}

/**
 * Games on the shelf. Routes open the arcade shell (`/app`); play from the
 * home shelf after opening. ADD NEW GAMES HERE when engines are added.
 */
export const GAME_LIST = [
  { id: 'ttt', name: 'Tic-Tac-Toe', route: '/app' },
  { id: 'connect4', name: 'Connect Four', route: '/app' },
  { id: 'dots', name: 'Dots & Boxes', route: '/app' },
  { id: 'reversi', name: 'Reversi', route: '/app' },
  { id: 'gomoku', name: 'Gomoku', route: '/app' },
  { id: 'memory', name: 'Memory Match', route: '/app' },
  { id: 'pong', name: 'Duo Pong', route: '/app' },
  { id: 'sketch', name: 'Sketch & Guess', route: '/app' },
  { id: 'wordrace', name: 'Word Race', route: '/app' },
  { id: 'maze', name: 'Maze Race', route: '/app' },
  { id: 'reflex', name: 'Reaction Duel', route: '/app' },
  { id: 'mancala', name: 'Mancala', route: '/app' },
  { id: 'seabattle', name: 'Sea Battle', route: '/app' },
  { id: 'checkers', name: 'Checkers', route: '/app' },
  { id: 'hex', name: 'Hex', route: '/app' },
  { id: 'pig', name: 'Pig Race', route: '/app' },
  { id: 'nim', name: 'Sticks', route: '/app' },
  { id: 'race', name: 'Duo Dash', route: '/app' },
  { id: 'couplequiz', name: 'Couple Quiz', route: '/app' },
  { id: 'twotruths', name: 'Two Truths & a Lie', route: '/app' },
  { id: 'codebreak', name: 'Code Break', route: '/app' },
  { id: 'sparksplash', name: 'Spark & Splash', route: '/app' },
  { id: 'readysetcook', name: 'Ready, Set, Cook', route: '/app' },
  { id: 'stickmanswordduel', name: 'Stickman Sword Duel', route: '/app' },
  { id: 'stickmanracing', name: 'Stickman Racing', route: '/app' },
  { id: 'microsoccer', name: 'Micro Soccer', route: '/app' },
  { id: 'moleduel', name: 'Heart Duel', route: '/app' },
  { id: 'forbiddenwords', name: 'Forbidden Words', route: '/app' },
  { id: 'auctionduel', name: 'Auction Duel', route: '/app' },
  { id: 'numberfortress', name: 'Number Fortress', route: '/app' },
  { id: 'wordbomb', name: 'Word Bomb', route: '/app' },
  { id: 'uno', name: 'UNO', route: '/app' },
  { id: 'coup', name: 'Veilcourt', route: '/app' },
  { id: 'carrot', name: 'Carrot in a Box', route: '/app' },
  { id: 'chkobba', name: 'Chkobba', route: '/app' },
  { id: 'minusone', name: 'Minus One', route: '/app' },
  { id: 'thinice', name: 'Thin Ice', route: '/app' },
  { id: 'sumobomb', name: 'Sumo Bomb', route: '/app' },
  { id: 'magnethearts', name: 'Magnet Hearts', route: '/app' },
];

export function gameName(id) {
  return GAME_LIST.find(g => g.id === id)?.name || id || '—';
}

export function scoreOf(c) {
  let a = 0, b = 0;
  for (const w of [c?.win1, c?.win2, c?.win3]) {
    if (w === 'A') a += 1;
    else if (w === 'B') b += 1;
  }
  return { a, b };
}

/** Celebration line: winner name + stake with Loser/Winner filled in. */
export function celebrationLine(stake, winnerName, loserName) {
  const filled = String(stake || '')
    .replace(/\bLoser\b/g, loserName)
    .replace(/\bWinner\b/g, winnerName);
  return `${winnerName} wins — ${filled}`;
}

/* ===== PURE (no imports below this line) ===== */

/** Best-of-3: first to 2 slot wins. Null while undecided. */
export function overallWinner(win1, win2, win3) {
  let a = 0, b = 0;
  for (const w of [win1, win2, win3]) {
    if (w === 'A') a += 1;
    else if (w === 'B') b += 1;
  }
  if (a >= 2) return 'A';
  if (b >= 2) return 'B';
  return null;
}

/**
 * Pick Game 3 from shelf ids, excluding game1 and game2.
 * @param {string[]} gameIds
 * @param {string} game1
 * @param {string} game2
 * @param {() => number} [rnd] Math.random-compatible
 */
export function pickRandomGame3(gameIds, game1, game2, rnd = Math.random) {
  const pool = (gameIds || []).filter(id => id && id !== game1 && id !== game2);
  if (!pool.length) return null;
  const i = Math.floor(rnd() * pool.length);
  return pool[Math.max(0, Math.min(pool.length - 1, i))];
}

export const STAKE_GROUPS = [
  {
    id: 'chores',
    label: 'Chores & kitchen',
    stakes: [
      'Loser cooks dinner',
      'Loser does the dishes for 3 days',
      'Loser handles laundry this week',
      'Loser makes breakfast in bed',
      'Loser does the groceries run',
      'Loser takes out the trash for a week',
      'Loser deep-cleans the kitchen tonight',
      'Loser packs lunches for both tomorrow',
      'Loser vacuums the whole place',
      'Loser changes the bed sheets',
      'Loser organizes the fridge',
      'Loser does meal prep for the next 3 days',
      'Loser washes and folds all the towels',
      'Loser scrubs the bathroom',
      'Loser waters the plants / cares for pets this week',
      'Loser unloads and reloads the dishwasher for 5 days',
      'Loser cooks a full breakfast from scratch',
      'Loser mops the floors',
      'Loser irons / steams tomorrow\'s outfits',
      'Loser handles dinner cleanup for a week',
    ],
  },
  {
    id: 'dates',
    label: 'Treats & dates',
    stakes: [
      'Loser pays for the next date',
      'Winner picks the movie tonight',
      'Loser buys dessert',
      'Winner chooses the restaurant',
      'Loser makes the coffee every morning for a week',
      'Loser plans the entire next date',
      'Loser books tickets for the next outing',
      'Winner picks the playlist for the next drive',
      'Loser treats ice cream / snacks after',
      'Loser buys the winner\'s favorite drink this week',
      'Winner chooses the next weekend activity',
      'Loser packs a surprise picnic',
      'Loser covers the next takeout order',
      'Winner picks dessert and loser makes or buys it',
      'Loser plans a no-phones date night',
      'Loser gets flowers or a small gift for the winner',
      'Winner chooses brunch spot; loser pays',
      'Loser sets up a cozy movie night (snacks + setup)',
      'Loser books a reservation winner has been craving',
      'Loser covers the next coffee shop date',
    ],
  },
  {
    id: 'sweet',
    label: 'Sweet',
    stakes: [
      'Loser gives a 20-minute massage',
      'Loser writes 10 things they love about the winner',
      'Loser recreates our first date',
      'Winner gets breakfast in bed on Sunday',
      'Loser writes a love note and hides it for the winner to find',
      'Loser cuddles for an uninterrupted hour (winner picks the show)',
      'Loser makes a playlist of songs that remind them of the winner',
      'Loser draws or doodles a portrait of the winner',
      'Loser says one sincere compliment every hour until bedtime',
      'Loser cooks the winner\'s comfort meal',
      'Loser does a slow dance in the living room',
      'Loser reads a chapter of a book aloud to the winner',
      'Loser plans a surprise “just because” gesture this week',
      'Loser holds hands / stays close for the whole evening',
      'Loser writes a short poem or silly rhyme about the winner',
      'Loser sends 5 sweet texts throughout tomorrow',
      'Loser recreates a favorite shared memory photo',
      'Loser gives forehead kisses on demand for the night',
      'Loser makes hot chocolate / tea and serves it',
      'Loser tells the winner their favorite story about us',
    ],
  },
  {
    id: 'silly',
    label: 'Silly',
    stakes: [
      'Loser speaks in an accent for an hour',
      'Winner picks the loser\'s outfit tomorrow',
      'Loser is the butler for the evening',
      'Loser does 20 push-ups whenever the winner claps',
      'Loser sings one song chosen by the winner',
      'Loser gives up the phone for the evening',
      'Loser wears a silly hat / accessory until bedtime',
      'Loser narrates their every action for 30 minutes',
      'Loser only answers questions with song lyrics for an hour',
      'Loser does a dramatic reading of a random text message',
      'Loser walks like a crab across the room on request (3 times)',
      'Loser tells a joke every time they enter a room tonight',
      'Loser poses for 5 ridiculous photos the winner directs',
      'Loser lets the winner choose their profile picture for a day',
      'Loser dances for 60 seconds whenever a timer goes off',
      'Loser speaks only in questions for 20 minutes',
      'Loser draws a mustache on their face (washable) for an hour',
      'Loser does an impression of the winner for 2 minutes',
      'Loser invents a secret handshake and teaches it',
      'Loser wears socks that don\'t match all day tomorrow',
    ],
  },
  {
    id: 'distance',
    label: 'Long-distance',
    stakes: [
      'Loser sends a voice note explaining why they lost',
      'Loser writes a handwritten letter and mails it',
      'Loser plans and hosts the next video call date (theme + activity)',
      'Loser records a good-morning video message',
      'Loser stays on a video call while doing chores tonight',
      'Loser sends breakfast delivery to the winner tomorrow',
      'Loser learns and performs one phrase in the winner\'s language on camera',
      'Loser picks and ships a surprise care package',
      'Loser has to send 10 photos of their day, unprompted',
      'Loser wakes up 1 hour early to say good morning on a call before work/class',
      'Loser has to stay off social media and only text the winner for a day',
      'Winner picks the next movie/show for a synced watch-party call',
      'Loser sends a voice note every morning for 5 days',
      'Loser plans a 1-hour virtual game night',
      'Loser orders a small surprise delivered to the winner',
      'Loser draws something and mails or photos it over',
      'Loser stays on a call until the winner falls asleep (once)',
      'Loser records a “tour” of their room / neighborhood',
      'Loser writes a countdown list of things to do when reunited',
      'Loser sends a playlist + why each song made the cut',
    ],
  },
];
