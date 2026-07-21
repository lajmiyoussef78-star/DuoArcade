import { useEffect, useMemo, useRef, useState } from 'react';
import { ENGINES } from '../engines/index.js';
import GameCard from './GameCard.jsx';
import {
  FILTER_CHIPS, SORT_OPTIONS, filterAndSortEngines, getRecentGameIds,
} from '../lib/gameCatalog.js';

function SmartRow({ title, children, empty }) {
  if (empty) return null;
  return (
    <div className="games-smart-row">
      <div className="games-smart-title">{title}</div>
      <div className="games-smart-scroller">{children}</div>
    </div>
  );
}

export default function GamesBrowse({ duo, code, onStartGame, onSetFavoriteGames }) {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('default');
  const [recentTick, setRecentTick] = useState(0);
  const [roulette, setRoulette] = useState(null);
  const rouletteTimer = useRef(null);

  const favorites = Array.isArray(duo.favoriteGames) ? duo.favoriteGames : [];
  const records = duo.records || {};
  const filtering = filter !== 'all' || query.trim().length > 0;
  const favFilter = filter === 'favorites';

  const list = useMemo(
    () => filterAndSortEngines({
      filter, query, sort, favoriteIds: favorites, records,
    }),
    [filter, query, sort, favorites, records]
  );

  const recentIds = useMemo(() => {
    void recentTick;
    return getRecentGameIds(code, 3);
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

  const shelfTitle = favFilter
    ? 'Favorites'
    : filtering
      ? `${list.length} match${list.length === 1 ? '' : 'es'}`
      : 'Play';

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
                id={chip.id === 'favorites' ? 'sect-favorites' : undefined}
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

      {!filtering && (
        <SmartRow title="Jump back in" empty={!recentIds.length}>
          {recentIds.map(id => {
            const eng = ENGINES[id];
            return (
              <div className="games-smart-item" key={'recent-' + id}>
                <GameCard
                  eng={eng}
                  rec={records[id]}
                  favorited={favorites.includes(id)}
                  onStart={onStartGame}
                  onToggleFavorite={toggleFavorite}
                />
              </div>
            );
          })}
        </SmartRow>
      )}

      <div
        className="shelf-title games-all-title"
        id={favFilter ? 'sect-favorites' : undefined}
      >
        {shelfTitle}
      </div>
      {favFilter && !list.length ? (
        <p className="shelf-favs-empty">Tap ★ on a game to add it here — shared for both of you.</p>
      ) : (
        <div
          className={'shelf shelf-browse' + (favFilter ? ' shelf-favs' : '')}
          key={`${filter}|${sort}|${query}`}
        >
          {list.map(eng => (
            <div className="gcard-anim" key={eng.meta.id}>
              <GameCard
                eng={eng}
                rec={records[eng.meta.id] || { a: 0, b: 0, d: 0 }}
                favorited={favorites.includes(eng.meta.id)}
                onStart={onStartGame}
                onToggleFavorite={toggleFavorite}
              />
            </div>
          ))}
          {!list.length && (
            <p className="games-empty">No games match — try another filter or clear search.</p>
          )}
        </div>
      )}
    </div>
  );
}
