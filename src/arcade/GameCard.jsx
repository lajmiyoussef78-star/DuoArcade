import { artFor } from '../engines/art.js';

/** Shared shelf game card — same design everywhere (name, tag, record, fix, dali, star). */
export default function GameCard({
  eng, rec, favorited, inDali, needsFix, fixNote,
  onStart, onToggleFavorite, onToggleDali, onFix
}) {
  const id = eng.meta.id;
  const r = rec || { a: 0, b: 0, d: 0 };
  return (
    <div
      className={
        'gcard'
        + (favorited ? ' gcard-fav-active' : '')
        + (inDali ? ' gcard-dali-active' : '')
        + (needsFix ? ' gcard-fix-active' : '')
      }
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
      {needsFix && fixNote && (
        <div className="gcard-fix-note" style={{ position: 'relative' }} title={fixNote}>
          {fixNote}
        </div>
      )}
      <div className="gcard-actions" onClick={e => e.stopPropagation()}>
        <button
          type="button"
          className={'gcard-fix' + (needsFix ? ' on' : '')}
          aria-label={needsFix ? `Edit fix note for ${eng.meta.name}` : `Add ${eng.meta.name} to Fixed list`}
          title={needsFix ? 'Edit note or mark Fixed' : 'Write a bug — add to Fixed'}
          onClick={() => onFix?.(eng)}
        >
          Fix<span className="gcard-beta">β</span>
        </button>
        <button
          type="button"
          className={'gcard-dali' + (inDali ? ' on' : '')}
          aria-label={inDali ? `Remove ${eng.meta.name} from Dali` : `Add ${eng.meta.name} to Dali`}
          title={inDali ? 'Remove from Dali' : 'Add to Dali'}
          onClick={() => onToggleDali?.(id, !inDali)}
        >
          Dali<span className="gcard-beta">β</span>
        </button>
        <button
          type="button"
          className={'gcard-fav' + (favorited ? ' on' : '')}
          aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
          title={favorited ? 'Remove from favorites' : 'Add to favorites'}
          onClick={() => onToggleFavorite?.(id, !favorited)}
        >{favorited ? '★' : '☆'}</button>
      </div>
    </div>
  );
}
