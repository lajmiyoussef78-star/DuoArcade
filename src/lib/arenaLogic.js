import { ARENA_GAMES } from './arenaGames.js';

export { ARENA_GAMES };
export const ARENA_SEATS = ['A1', 'A2', 'B1', 'B2'];

export const teamOf = seat => seat?.[0] || null;
export const partnerSeat = seat => {
  if (!ARENA_SEATS.includes(seat)) return null;
  return seat[0] + (seat[1] === '1' ? '2' : '1');
};

export function initialArenaState(game, engine) {
  if (!ARENA_GAMES.includes(game) || !engine || engine.meta.realtime) {
    throw new Error('Unsupported Arena game');
  }
  return {
    game,
    gs: engine.initialState(),
    phase: 'ready',
    ready: Object.fromEntries(ARENA_SEATS.map(seat => [seat, false])),
    turn: 'A',
    activeSeat: 'A1',
    nextSeat: { A: 'A1', B: 'B1' },
    starter: 'A',
    winner: null,
    round: 1,
    liveAt: null
  };
}

export function readySeat(state, seat, now = Date.now()) {
  if (state.phase !== 'ready' || !ARENA_SEATS.includes(seat)) return state;
  const ready = { ...state.ready, [seat]: true };
  const allReady = ARENA_SEATS.every(s => ready[s]);
  return allReady
    ? { ...state, ready, phase: 'countdown', liveAt: now + 3000 }
    : { ...state, ready };
}

export function startIfDue(state, now = Date.now()) {
  if (state.phase !== 'countdown' || !state.liveAt || now < state.liveAt) return state;
  return { ...state, phase: 'live' };
}

export function applyArenaMove(state, move, seat, engine) {
  if (state.phase !== 'live' || state.winner || state.activeSeat !== seat) return null;
  const team = teamOf(seat);
  if (team !== state.turn) return null;
  const result = engine.applyMove(state.gs, move, team);
  if (!result) return null;

  const winner = engine.winner(result.gs);
  const nextSeat = { ...state.nextSeat, [team]: partnerSeat(seat) };
  if (winner) {
    return {
      ...state, gs: result.gs, winner, phase: 'done',
      activeSeat: null, nextSeat, finishedAt: Date.now()
    };
  }

  const nextTeam = result.again ? team : (team === 'A' ? 'B' : 'A');
  return {
    ...state,
    gs: result.gs,
    turn: nextTeam,
    activeSeat: nextSeat[nextTeam],
    nextSeat
  };
}

export function rematchState(state, engine) {
  const starter = state.winner && state.winner !== 'draw'
    ? (state.winner === 'A' ? 'B' : 'A')
    : (state.starter === 'A' ? 'B' : 'A');
  return {
    ...initialArenaState(state.game, engine),
    starter,
    turn: starter,
    activeSeat: starter + '1',
    round: (state.round || 1) + 1
  };
}
