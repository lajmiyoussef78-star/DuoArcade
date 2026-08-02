import { artFor } from '../engines/art.js';

/** Shared shelf game card — art panel on top, meta + primary action below. */
export default function GameCard({
  eng, rec, favorited, inDali, needsFix, fixNote,
  onStart, onToggleFavorite, onToggleDali, onFix
}) {
  const id = eng.meta.id;
  const r = rec || { a: 0, b: 0, d: 0 };
  const plays = (r.a || 0) + (r.b || 0) + (r.d || 0);
  const art = artFor(id);

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
      <div className="gcard-media">
        {art && (
          <>
            <div className="gcard-art" aria-hidden="true" dangerouslySetInnerHTML={{ __html: art }} />
            <div className="gcard-veil" aria-hidden="true" />
          </>
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

      <div className="gcard-info">
        <div className="gcard-info-row">
          <div className="gname">{eng.meta.name}</div>
          <span className={'gcard-stat' + (plays ? '' : ' gcard-stat-new')}>
            {plays ? `${r.a}–${r.b}` : 'New'}
          </span>
        </div>
        <div className="gtag">{eng.meta.tag}</div>
        {needsFix && fixNote && (
          <div className="gcard-fix-note" title={fixNote}>{fixNote}</div>
        )}
        <div className="gcard-foot">
          <span className="grec">
            {plays ? `${plays} played${r.d ? ` · ${r.d} draws` : ''}` : '2 players'}
          </span>
          <span className="gcard-cta">{plays ? 'Continue' : 'Play'}</span>
        </div>
      </div>
    </div>
  );
}
