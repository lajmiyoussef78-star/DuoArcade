import { artFor } from '../engines/art.js';

/** Shared shelf game card — same design everywhere (name, tag, record, star). */
export default function GameCard({ eng, rec, favorited, onStart, onToggleFavorite }) {
  const id = eng.meta.id;
  const r = rec || { a: 0, b: 0, d: 0 };
  return (
    <div
      className={'gcard' + (favorited ? ' gcard-fav-active' : '')}
      onClick={() => onStart?.(id)}
    >
      {artFor(id) && (
        <>
          <div className="gcard-art" aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: artFor(id) }} />
          <div className="gcard-veil" aria-hidden="true" />
        </>
      )}
      <div className="gname" style={{ position: 'relative' }}>{eng.meta.name}</div>
      <div className="gtag" style={{ position: 'relative' }}>{eng.meta.tag}</div>
      <div className="grec" style={{ position: 'relative' }}>
        {r.a}–{r.b}{r.d ? ' · ' + r.d + ' draws' : ''}
      </div>
      <button
        type="button"
        className={'gcard-fav' + (favorited ? ' on' : '')}
        aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
        title={favorited ? 'Remove from favorites' : 'Add to favorites'}
        onClick={e => {
          e.stopPropagation();
          onToggleFavorite?.(id, !favorited);
        }}
      >{favorited ? '★' : '☆'}</button>
    </div>
  );
}
