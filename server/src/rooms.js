/**
 * Room naming matches the existing Supabase Realtime channel convention
 * so a future client adapter can migrate without renaming rooms:
 *   duo    → rt-{code}
 *   friend → friend-rt-{code}
 */
export function roomName(code, kind = 'duo') {
  const c = String(code || '').trim();
  if (!c) return null;
  if (kind === 'friend') return `friend-rt-${c}`;
  return `rt-${c}`;
}

export function isSoccerGame(game) {
  return game === 'microsoccer' || game === 'soccer';
}

export function parseJoinPayload(payload = {}) {
  const code = payload.code ?? payload.matchCode ?? payload.duoCode;
  const kind = payload.kind === 'friend' ? 'friend' : 'duo';
  const game = typeof payload.game === 'string' ? payload.game.trim().toLowerCase() : '';
  const matchId = payload.matchId != null ? String(payload.matchId).trim() : '';
  return {
    code: code != null ? String(code).trim() : '',
    kind,
    game,
    matchId,
  };
}
