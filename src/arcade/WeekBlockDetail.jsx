// src/arcade/WeekBlockDetail.jsx — shared block detail popup (home card + week page).

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { fmtTime } from '../lib/timetable.js';

export default function WeekBlockDetail({
  viewing,
  dayName,
  timeFormat,
  fmtDur,
  whoLabel,
  onClose,
  onDelete,
  onEdit,
  overlayClass = ''
}) {
  useEffect(() => {
    if (!viewing) return;
    document.body.classList.add('wk-modal-open');
    return () => document.body.classList.remove('wk-modal-open');
  }, [viewing]);

  if (!viewing) return null;

  const tf = timeFormat === '12' ? '12' : '24';
  const host = document.getElementById('modal-root') || document.body;

  return createPortal(
    <div
      className={'wk-overlay' + (overlayClass ? ' ' + overlayClass : '')}
      role="dialog"
      aria-modal="true"
      aria-label={viewing.title}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="wk-modal wk-detail">
        <div className="wk-detail-head" style={{ borderLeftColor: viewing.color, background: viewing.color + '18' }}>
          <span className={'wk-dot ' + (viewing.who === 'both' ? 'both' : viewing.who)} />
          <div className="wk-detail-title">
            {viewing.emoji && <span className="wk-detail-emoji">{viewing.emoji}</span>}
            <h3>{viewing.title}</h3>
          </div>
        </div>
        <dl className="wk-detail-meta">
          <div className="wk-detail-row">
            <dt>Day</dt>
            <dd>{dayName}</dd>
          </div>
          <div className="wk-detail-row">
            <dt>Time</dt>
            <dd>{fmtTime(viewing.start, tf)} – {fmtTime(viewing.start + viewing.dur, tf)}</dd>
          </div>
          <div className="wk-detail-row">
            <dt>Lasts</dt>
            <dd>{fmtDur(viewing.dur)}</dd>
          </div>
          <div className="wk-detail-row">
            <dt>Whose block</dt>
            <dd>{whoLabel(viewing.who)}</dd>
          </div>
        </dl>
        {viewing.note && (
          <div className="wk-detail-note">
            <span className="wk-detail-note-label">Note</span>
            <p>{viewing.note}</p>
          </div>
        )}
        <div className="wk-modal-actions">
          {onDelete && (
            <button type="button" className="btn small ghost wk-danger" onClick={() => onDelete(viewing)}>
              Delete
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button type="button" className="btn small ghost" onClick={onClose}>Close</button>
          <button type="button" className="btn small warm" onClick={() => onEdit(viewing)}>Edit</button>
        </div>
      </div>
    </div>,
    host
  );
}
