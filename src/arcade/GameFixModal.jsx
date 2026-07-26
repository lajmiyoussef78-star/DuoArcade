import { useState } from 'react';
import { fixNoteFor, removeFixGame, upsertFixGame } from '../lib/gameFixes.js';

/**
 * Write / edit a bug note for a game, or mark it fixed (remove from Needs fix list).
 * Does not change game code — only the shared duo list.
 */
export default function GameFixModal({ eng, fixGames, onSave, onClose }) {
  const [note, setNote] = useState(() => fixNoteFor(fixGames, eng?.meta?.id));
  const already = !!eng && fixIdsHas(fixGames, eng.meta.id);

  if (!eng) return null;
  const name = eng.meta.name;

  const save = e => {
    e.preventDefault();
    const next = upsertFixGame(fixGames, eng.meta.id, note);
    onSave?.(next);
    onClose?.();
  };

  const markFixed = () => {
    onSave?.(removeFixGame(fixGames, eng.meta.id));
    onClose?.();
  };

  return (
    <div className="gfix-backdrop" role="presentation" onClick={onClose}>
      <div
        className="gfix-modal"
        role="dialog"
        aria-labelledby="gfix-title"
        onClick={ev => ev.stopPropagation()}
      >
        <div className="gfix-head">
          <span className="gfix-beta">Beta</span>
          <h3 id="gfix-title">Fix · {name}</h3>
          <button type="button" className="gfix-x" aria-label="Close" onClick={onClose}>×</button>
        </div>

        <form className="gfix-form" onSubmit={save}>
          <p className="gfix-sub">
            Write what’s wrong. This adds the game to your shared <b>Fixed β</b> list —
            it does not change the code.
          </p>
          <textarea
            className="gfix-note"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="e.g. Rematch score shows 3–1 instead of 1–0"
            rows={4}
            maxLength={800}
            autoFocus
          />
          <div className="gfix-actions">
            {already && (
              <button type="button" className="btn warm" onClick={markFixed}>
                Fixed
              </button>
            )}
            <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn ghost" disabled={note.trim().length < 3 && !already}>
              {already ? 'Save note' : 'Add to Fixed'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function fixIdsHas(fixGames, id) {
  return Array.isArray(fixGames) && fixGames.some(f => (typeof f === 'string' ? f : f?.id) === id);
}
