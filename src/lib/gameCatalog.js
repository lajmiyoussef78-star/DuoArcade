// Browse helpers for the home games shelf — filters, sort, recent plays, fuzzy search.
import { ENGINES } from '../engines/index.js';

export const FILTER_CHIPS = [
  { id: 'all', label: 'All' },
  { id: 'favorites', label: 'Favorites ★' },
  { id: 'neverplayed', label: 'Never played' },
  { id: 'realtime', label: 'Real-time' },
  { id: 'turnbased', label: 'Turn-based' },
  { id: 'coop', label: 'Co-op' },
  { id: 'creative', label: 'Creative' },
  { id: 'bluff', label: 'Bluff/Cards' },
  { id: 'quick', label: 'Quick (<5 min)' },
];

export const SORT_OPTIONS = [
  { id: 'default', label: 'Default' },
  { id: 'most', label: 'Most played' },
  { id: 'never', label: 'Never played' },
  { id: 'rivalry', label: 'Closest rivalry' },
  { id: 'az', label: 'A–Z' },
];

const RECENT_KEY = (code) => `duoarcade-recent-${code}`;
const RECENT_MAX = 12;

function tagOf(eng) {
  return String(eng?.meta?.tag || '').toLowerCase();
}

/** Categories derived from each engine's existing tag string + realtime flag. */
export function categoriesFor(eng) {
  const tag = tagOf(eng);
  const cats = new Set();
  if (eng?.meta?.realtime || /\breal[- ]?time\b/.test(tag)) cats.add('realtime');
  else cats.add('turnbased');
  if (/\bturn[- ]?based\b/.test(tag)) {
    cats.add('turnbased');
    cats.delete('realtime');
  }
  if (/\bco[- ]?op\b/.test(tag)) cats.add('coop');
  if (/\bcreative\b/.test(tag)) cats.add('creative');
  if (/\bbluff\b|\bcards?\b|\bbids?\b|\buno\b|\bcourt\b/.test(tag)
    || /^(uno|coup|carrot|chkobba|auctionduel)$/.test(eng?.meta?.id || '')) {
    cats.add('bluff');
  }
  // Quick: explicit short durations, or known warm-ups
  if (
    /\b90\s*sec|\b\d+\s*seconds?\b|\btwo[- ]minute\b|\b2\s*min\b|\b3\s*min\b|\b4\s*min\b|\b5\s*min\b|\bquick\b|\bwarm[- ]?up\b/.test(tag)
    || /^(ttt|nim|minusone|reflex|sumobomb|magnethearts|pong|microsoccer)$/.test(eng?.meta?.id || '')
  ) {
    cats.add('quick');
  }
  return cats;
}

export function playsOf(rec) {
  if (!rec) return 0;
  return (rec.a || 0) + (rec.b || 0) + (rec.d || 0);
}

export function winGap(rec) {
  if (!rec) return Infinity;
  const plays = playsOf(rec);
  if (!plays) return Infinity;
  return Math.abs((rec.a || 0) - (rec.b || 0));
}

/** Soft fuzzy: substring, then ordered subsequence of query chars in name. */
export function fuzzyMatch(name, query) {
  const n = String(name || '').toLowerCase().trim();
  const q = String(query || '').toLowerCase().trim();
  if (!q) return true;
  if (n.includes(q)) return true;
  let i = 0;
  for (const ch of n) {
    if (ch === q[i]) i++;
    if (i >= q.length) return true;
  }
  return false;
}

export function matchesFilter(eng, filterId, favoriteIds, records) {
  if (!filterId || filterId === 'all') return true;
  if (filterId === 'favorites') return (favoriteIds || []).includes(eng.meta.id);
  if (filterId === 'neverplayed') return playsOf((records || {})[eng.meta.id]) === 0;
  return categoriesFor(eng).has(filterId);
}

export function sortEngines(list, sortId, records) {
  const recs = records || {};
  const out = [...list];
  if (sortId === 'most') {
    out.sort((a, b) => playsOf(recs[b.meta.id]) - playsOf(recs[a.meta.id])
      || a.meta.name.localeCompare(b.meta.name));
  } else if (sortId === 'never') {
    out.sort((a, b) => playsOf(recs[a.meta.id]) - playsOf(recs[b.meta.id])
      || a.meta.name.localeCompare(b.meta.name));
  } else if (sortId === 'rivalry') {
    out.sort((a, b) => {
      const ga = winGap(recs[a.meta.id]);
      const gb = winGap(recs[b.meta.id]);
      if (ga !== gb) return ga - gb;
      return playsOf(recs[b.meta.id]) - playsOf(recs[a.meta.id])
        || a.meta.name.localeCompare(b.meta.name);
    });
  } else if (sortId === 'az') {
    out.sort((a, b) => a.meta.name.localeCompare(b.meta.name));
  }
  // default: registry order (stable)
  return out;
}

export function filterAndSortEngines({ filter, query, sort, favoriteIds, records }) {
  let list = Object.values(ENGINES).filter(eng => matchesFilter(eng, filter, favoriteIds, records));
  if (query?.trim()) list = list.filter(eng => fuzzyMatch(eng.meta.name, query));
  // Favorites filter: keep starred order unless user picks another sort
  if (filter === 'favorites' && (!sort || sort === 'default')) {
    const order = new Map((favoriteIds || []).map((id, i) => [id, i]));
    list.sort((a, b) => (order.get(a.meta.id) ?? 999) - (order.get(b.meta.id) ?? 999));
    return list;
  }
  return sortEngines(list, sort, records);
}

export function pushRecentGame(code, gameId) {
  if (!code || !gameId || !ENGINES[gameId]) return;
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY(code)) || '[]');
    const prev = Array.isArray(raw) ? raw.filter(id => id !== gameId) : [];
    const next = [gameId, ...prev].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY(code), JSON.stringify(next));
  } catch { /* ignore */ }
}

export function getRecentGameIds(code, limit = 3) {
  if (!code) return [];
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY(code)) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter(id => ENGINES[id]).slice(0, limit);
  } catch {
    return [];
  }
}

/** Never-played from records; prefer engines with 0–0 over missing. */
export function neverPlayedEngines(records, limit = 8) {
  const recs = records || {};
  return Object.values(ENGINES)
    .filter(eng => playsOf(recs[eng.meta.id]) === 0)
    .slice(0, limit);
}
