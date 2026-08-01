import { useEffect, useMemo, useRef, useState } from 'react';
import { ENGINES } from '../engines/index.js';
import GameCard from './GameCard.jsx';
import GameFixModal from './GameFixModal.jsx';
import { fixIds, fixNoteFor, normalizeFixGames } from '../lib/gameFixes.js';
import {
  FILTER_CHIPS, SORT_OPTIONS, filterAndSortEngines, getRecentGameIds,
} from '../lib/gameCatalog.js';
import ChallengeCard from './ChallengeCard.jsx';

/** Hide from Jump back in (soccer kept out of this shelf). */
const JUMP_BACK_EXCLUDE = new Set(['microsoccer']);

function SmartRow({ title, children, empty }) {
  if (empty) return null;
  return (
    <div className="games-smart-row">
      <div className="games-smart-title">{title}</div>
      <div className="games-smart-scroller">{children}</div>
    </div>
  );
}

export default function GamesBrowse({
  duo, code, onStartGame, onSetFavoriteGames, onSetFixGames, onSetDaliGames
}) {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('default');
  const [recentTick, setRecentTick] = useState(0);
  const [roulette, setRoulette] = useState(null);
  const [fixEng, setFixEng] = useState(null);
  const rouletteTimer = useRef(null);

  const favorites = Array.isArray(duo.favoriteGames) ? duo.favoriteGames : [];
  const daliGames = Array.isArray(duo.daliGames) ? duo.daliGames : [];
  const fixGames = useMemo(() => normalizeFixGames(duo.fixGames), [duo.fixGames]);
  const needsFixIds = useMemo(() => fixIds(fixGames), [fixGames]);
  const records = duo.records || {};
  const filtering = filter !== 'all' || query.trim().length > 0;
  const daliFilter = filter === 'dali';
  const favFilter = filter === 'favorites';
  const fixFilter = filter === 'needsfix';
  const listFilter = daliFilter || favFilter || fixFilter;

  const list = useMemo(
    () => filterAndSortEngines({
      filter, query, sort, favoriteIds: favorites, records, fixIds: needsFixIds,
      daliIds: daliGames,
    }),
    [filter, query, sort, favorites, records, needsFixIds, daliGames]
  );

  const recentIds = useMemo(() => {
    void recentTick;
    return getRecentGameIds(code, 6)
      .filter(id => !JUMP_BACK_EXCLUDE.has(id))
      .slice(0, 3);
  }, [code, recentTick, records]);

  useEffect(() => {
    const onFocus = () => setRecentTick(t => t + 1);
    window.addEventListener('focus', onFocus);
    window.addEventListener('duoarcade-recent-games', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('duoarcade-recent-games', onFocus);
    };
  }, []);

  useEffect(() => () => {
    if (rouletteTimer.current) clearTimeout(rouletteTimer.current);
  }, []);

  const toggleFavorite = (id, add) => {
    if (add) onSetFavoriteGames?.([...favorites.filter(x => x !== id), id]);
    else onSetFavoriteGames?.(favorites.filter(x => x !== id));
  };

  const toggleDali = (id, add) => {
    if (add) onSetDaliGames?.([...daliGames.filter(x => x !== id), id]);
    else onSetDaliGames?.(daliGames.filter(x => x !== id));
  };

  const pickForUs = () => {
    if (roulette || !list.length) return;
    const pool = list.map(e => e.meta.id);
    const pick = pool[Math.floor(Math.random() * pool.length)];
    const flash = [];
    for (let i = 0; i < 14; i++) flash.push(pool[Math.floor(Math.random() * pool.length)]);
    flash.push(pick);
    setRoulette({ ids: flash, idx: 0, pick });
    let i = 0;
    const tick = () => {
      i += 1;
      if (i >= flash.length) {
        rouletteTimer.current = null;
        setRoulette({ ids: flash, idx: flash.length - 1, pick, done: true });
        setTimeout(() => {
          setRoulette(null);
          onStartGame?.(pick);
        }, 480);
        return;
      }
      setRoulette({ ids: flash, idx: i, pick });
      rouletteTimer.current = setTimeout(tick, 55 + i * 12);
    };
    rouletteTimer.current = setTimeout(tick, 55);
  };

  const shelfTitle = daliFilter
    ? 'Dali'
    : favFilter
      ? 'Favorites'
      : fixFilter
        ? 'Fixed'
        : filtering
          ? `${list.length} match${list.length === 1 ? '' : 'es'}`
          : 'Play';

  const shelfId = daliFilter
    ? 'sect-dali'
    : favFilter
      ? 'sect-favorites'
      : fixFilter
        ? 'sect-needsfix'
        : undefined;

  const chipSectionId = chipId => {
    if (chipId === 'dali') return 'sect-dali';
    if (chipId === 'favorites') return 'sect-favorites';
    if (chipId === 'needsfix') return 'sect-needsfix';
    return undefined;
  };

  const cardProps = eng => ({
    eng,
    rec: records[eng.meta.id] || { a: 0, b: 0, d: 0 },
    favorited: favorites.includes(eng.meta.id),
    inDali: daliGames.includes(eng.meta.id),
    needsFix: needsFixIds.includes(eng.meta.id),
    fixNote: fixNoteFor(fixGames, eng.meta.id),
    onStart: onStartGame,
    onToggleFavorite: toggleFavorite,
    onToggleDali: toggleDali,
    onFix: setFixEng
  });

  return (
    <div className="games-browse">
      <div className="games-filter-bar" id="sect-play">
        <div className="games-filter-top">
          <div className="games-chips" role="tablist" aria-label="Filter games">
            {FILTER_CHIPS.map(chip => (
              <button
                key={chip.id}
                type="button"
                role="tab"
                id={chipSectionId(chip.id)}
                aria-selected={filter === chip.id}
                className={'games-chip' + (filter === chip.id ? ' on' : '')}
                onClick={() => setFilter(chip.id)}
              >{chip.label}</button>
            ))}
          </div>
          <button
            type="button"
            className={'games-pick-btn' + (roulette ? ' spinning' : '')}
            onClick={pickForUs}
            disabled={!list.length || !!roulette}
            title="Pick a random game for us"
          >
            <span className="games-pick-dice" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="4" />
                <circle cx="8" cy="8" r="1.2" fill="currentColor" stroke="none" />
                <circle cx="16" cy="8" r="1.2" fill="currentColor" stroke="none" />
                <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
                <circle cx="8" cy="16" r="1.2" fill="currentColor" stroke="none" />
                <circle cx="16" cy="16" r="1.2" fill="currentColor" stroke="none" />
              </svg>
            </span>
            <span className="games-pick-label">Pick for us</span>
          </button>
        </div>
        <div className="games-filter-tools">
          <label className="games-search">
            <span className="sr-only">Search games</span>
            <input
              type="search"
              placeholder="Search games…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoComplete="off"
            />
          </label>
          <label className="games-sort">
            <span className="sr-only">Sort</span>
            <select value={sort} onChange={e => setSort(e.target.value)}>
              {SORT_OPTIONS.map(o => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </label>
        </div>
        {roulette && (
          <div className="games-roulette" aria-live="polite">
            Picking… <strong>{ENGINES[roulette.ids[roulette.idx]]?.meta?.name || '…'}</strong>
          </div>
        )}
      </div>

      <ChallengeCard />

      {!filtering && (
        <SmartRow title="Jump back in" empty={!recentIds.length}>
          {recentIds.map(id => {
            const eng = ENGINES[id];
            if (!eng) return null;
            return (
              <div className="games-smart-item" key={'recent-' + id}>
                <GameCard {...cardProps(eng)} />
              </div>
            );
          })}
        </SmartRow>
      )}

      <div
        className="shelf-title games-all-title"
        id={shelfId}
      >
        {shelfTitle}
      </div>
      {daliFilter && !list.length ? (
        <p className="shelf-favs-empty">Tap <b>Dali β</b> on a game to add it here — shared for both of you.</p>
      ) : favFilter && !list.length ? (
        <p className="shelf-favs-empty">Tap ★ on a game to add it here — shared for both of you.</p>
      ) : fixFilter && !list.length ? (
        <p className="shelf-favs-empty">Tap <b>Fix β</b> on a game to write what’s broken — it shows up here until you tap <b>Fixed</b>.</p>
      ) : (
        <div
          className={'shelf shelf-browse' + (listFilter ? ' shelf-favs' : '')}
          key={`${filter}|${sort}`}
        >
          {list.map(eng => (
            <div className="gcard-anim" key={eng.meta.id}>
              <GameCard {...cardProps(eng)} />
            </div>
          ))}
          {!list.length && (
            <p className="games-empty">No games match — try another filter or clear search.</p>
          )}
        </div>
      )}

      {fixEng && (
        <GameFixModal
          eng={fixEng}
          fixGames={fixGames}
          onSave={onSetFixGames}
          onClose={() => setFixEng(null)}
        />
      )}
    </div>
  );
}
