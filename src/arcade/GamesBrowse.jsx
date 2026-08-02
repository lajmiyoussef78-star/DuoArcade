import { useMemo, useState } from 'react';
import { ENGINES } from '../engines/index.js';
import GameCard from './GameCard.jsx';
import GameFixModal from './GameFixModal.jsx';
import { fixIds, fixNoteFor, normalizeFixGames } from '../lib/gameFixes.js';
import { FILTER_CHIPS, filterAndSortEngines } from '../lib/gameCatalog.js';

export default function GamesBrowse({
  duo, onStartGame, onSetFavoriteGames, onSetFixGames, onSetDaliGames
}) {
  const [filter, setFilter] = useState('all');
  const [fixEng, setFixEng] = useState(null);

  const favorites = Array.isArray(duo.favoriteGames) ? duo.favoriteGames : [];
  const daliGames = Array.isArray(duo.daliGames) ? duo.daliGames : [];
  const fixGames = useMemo(() => normalizeFixGames(duo.fixGames), [duo.fixGames]);
  const needsFixIds = useMemo(() => fixIds(fixGames), [fixGames]);
  const records = duo.records || {};
  const daliFilter = filter === 'dali';
  const favFilter = filter === 'favorites';
  const fixFilter = filter === 'needsfix';
  const listFilter = daliFilter || favFilter || fixFilter;
  const filtering = filter !== 'all';

  const list = useMemo(
    () => filterAndSortEngines({
      filter, query: '', sort: 'default', favoriteIds: favorites, records, fixIds: needsFixIds,
      daliIds: daliGames,
    }),
    [filter, favorites, records, needsFixIds, daliGames]
  );

  const toggleFavorite = (id, add) => {
    if (add) onSetFavoriteGames?.([...favorites.filter(x => x !== id), id]);
    else onSetFavoriteGames?.(favorites.filter(x => x !== id));
  };

  const toggleDali = (id, add) => {
    if (add) onSetDaliGames?.([...daliGames.filter(x => x !== id), id]);
    else onSetDaliGames?.(daliGames.filter(x => x !== id));
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
        : 'sect-play-shelf';

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
        </div>
      </div>

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
          key={filter}
        >
          {list.map(eng => (
            <div className="gcard-anim" key={eng.meta.id}>
              <GameCard {...cardProps(eng)} />
            </div>
          ))}
          {!list.length && (
            <p className="games-empty">No games match — try another filter.</p>
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
