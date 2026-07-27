// Helpers for the shared duo "Needs fix" game list (notes only — not auto-fixes).

/** @returns {{ id: string, note: string }[]} */
export function normalizeFixGames(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seen = new Set();
  for (const x of raw) {
    const id = typeof x === 'string' ? x : x?.id;
    if (!id || typeof id !== 'string' || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, note: String(x?.note || '').slice(0, 800) });
  }
  return out;
}

export function fixIds(fixGames) {
  return normalizeFixGames(fixGames).map(f => f.id);
}

export function fixNoteFor(fixGames, gameId) {
  return normalizeFixGames(fixGames).find(f => f.id === gameId)?.note || '';
}

/** Upsert a game into the fix list (or update its note). */
export function upsertFixGame(fixGames, gameId, note) {
  const list = normalizeFixGames(fixGames).filter(f => f.id !== gameId);
  list.push({ id: gameId, note: String(note || '').trim().slice(0, 800) });
  return list;
}

/** Remove a game from the fix list (mark as fixed). */
export function removeFixGame(fixGames, gameId) {
  return normalizeFixGames(fixGames).filter(f => f.id !== gameId);
}
