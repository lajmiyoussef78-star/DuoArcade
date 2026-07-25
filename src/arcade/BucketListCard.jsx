// src/arcade/BucketListCard.jsx — time-locked couples bucket list.
// draft -> locked (sealed, blind adds) -> opened (mark achieved) -> archived + new.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  bucketGet, bucketAddItem, bucketUpdateItem, bucketRemoveItem,
  bucketLock, bucketMark, bucketArchive, bucketHistory, bucketChannel
} from '../lib/bucketlist.js';
import '../styles/bucketlist.css';

const PRESETS = [
  { id: '3m', label: '3 months', months: 3 },
  { id: '6m', label: '6 months', months: 6 },
  { id: '1y', label: '1 year', months: 12 }
];

function addMonths(months) {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d;
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric'
  });
}

function countdown(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return null;
  const mins = Math.floor(ms / 60000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  if (days > 0) return `${days} day${days === 1 ? '' : 's'} ${hours}h`;
  if (hours > 0) return `${hours}h ${mins % 60}m`;
  return `${Math.max(1, mins)} min`;
}

export default function BucketListCard({ code, myRole, duo }) {
  const [view, setView] = useState(null);
  const [text, setText] = useState('');
  const [status, setStatus] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [preset, setPreset] = useState(null);
  const [customDate, setCustomDate] = useState('');
  const [confirmLock, setConfirmLock] = useState(false);
  const [history, setHistory] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [tick, setTick] = useState(0);
  const channelRef = useRef(null);

  const nameOf = role => (role === 'A' ? duo?.nameA : duo?.nameB) || '?';

  const reload = useCallback(async () => {
    try {
      const v = await bucketGet(code);
      setView(v);
    } catch (e) {
      setStatus(e.message);
    }
  }, [code]);

  const apply = useCallback(async fn => {
    try {
      const v = await fn();
      setView(v);
      setStatus('');
      channelRef.current?.send({ k: 'ping' });
    } catch (e) {
      setStatus(e.message);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      await reload();
      const ch = await bucketChannel(code);
      if (!alive) { ch.close(); return; }
      channelRef.current = ch;
      ch.on(msg => { if (alive && msg?.k === 'ping') reload(); });
    })();
    return () => {
      alive = false;
      channelRef.current?.close();
      channelRef.current = null;
    };
  }, [code, reload]);

  /* Countdown ticker; when the date passes, refetch so the server flips to opened */
  useEffect(() => {
    if (view?.status !== 'locked') return undefined;
    const t = setInterval(() => {
      setTick(n => n + 1);
      if (view.unlock_at && Date.now() >= new Date(view.unlock_at).getTime()) reload();
    }, 30000);
    return () => clearInterval(t);
  }, [view?.status, view?.unlock_at, reload]);

  const add = async () => {
    const t = text.trim();
    if (!t) return;
    setText('');
    await apply(() => bucketAddItem(code, t, myRole));
  };

  const saveEdit = async id => {
    if (!editText.trim()) return;
    await apply(() => bucketUpdateItem(code, id, editText));
    setEditingId(null);
  };

  const chosenDate = () => {
    if (preset === 'custom') {
      return customDate ? new Date(customDate + 'T00:00:00') : null;
    }
    const p = PRESETS.find(x => x.id === preset);
    return p ? addMonths(p.months) : null;
  };

  const lock = async () => {
    const d = chosenDate();
    if (!d) return;
    await apply(() => bucketLock(code, d.toISOString()));
    setConfirmLock(false);
    setPreset(null);
    setCustomDate('');
  };

  const toggleHistory = async () => {
    if (!showHistory && history === null) {
      try { setHistory(await bucketHistory(code)); } catch (e) { setStatus(e.message); }
    }
    setShowHistory(v => !v);
  };

  const archive = async () => {
    if (!confirm('Archive this list as a keepsake and start a fresh one?')) return;
    await apply(() => bucketArchive(code));
    setHistory(null);
    setShowHistory(false);
  };

  if (!view) {
    return (
      <div className="bucket-card">
        <h3>Bucket List</h3>
        <p className="bucket-sub">{status || 'Loading…'}</p>
      </div>
    );
  }

  const items = view.items || [];
  const achieved = items.filter(i => i.achieved === true).length;
  const lockDatePicked = chosenDate();

  return (
    <div className="bucket-card">
      <h3>Bucket List</h3>

      {/* ── DRAFT ─────────────────────────────────────────── */}
      {view.status === 'draft' && (
        <>
          <p className="bucket-sub">
            Write down targets, wills and dreams together — then seal the list until a date
            you choose. When it opens, see what you two made real.
          </p>

          <div className="bucket-form">
            <input
              type="text"
              placeholder="A dream, a target, a promise…"
              value={text}
              maxLength={280}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && add()}
            />
            <button className="btn warm small" type="button" onClick={add}>Add</button>
          </div>

          <div className="bucket-list">
            {items.length === 0 && (
              <div className="bucket-empty">Nothing here yet — add your first dream above.</div>
            )}
            {items.map(item => (
              <div key={item.id} className="bucket-item">
                {editingId === item.id ? (
                  <div className="bucket-edit">
                    <input
                      type="text" value={editText} maxLength={280}
                      onChange={e => setEditText(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && saveEdit(item.id)}
                    />
                    <div className="bucket-edit-row">
                      <button className="btn warm small" type="button" onClick={() => saveEdit(item.id)}>Save</button>
                      <button className="btn small ghost" type="button" onClick={() => setEditingId(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="bucket-text">{item.text}</div>
                    <div className="bucket-meta">by <b>{nameOf(item.by)}</b></div>
                    <div className="bucket-actions">
                      <button type="button" onClick={() => { setEditingId(item.id); setEditText(item.text); }}>Edit</button>
                      <button type="button" onClick={() => apply(() => bucketRemoveItem(code, item.id))}>Remove</button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          {items.length > 0 && (
            <div className="bucket-lockpanel">
              <h4>Seal the capsule</h4>
              <p>Once locked, neither of you can see the list until the date. You can still drop new dreams in blind.</p>
              <div className="bucket-presets">
                {PRESETS.map(p => (
                  <button
                    key={p.id} type="button"
                    className={preset === p.id ? 'on' : ''}
                    onClick={() => { setPreset(p.id); setConfirmLock(false); }}
                  >
                    {p.label}
                  </button>
                ))}
                <button
                  type="button"
                  className={preset === 'custom' ? 'on' : ''}
                  onClick={() => { setPreset('custom'); setConfirmLock(false); }}
                >
                  Pick a date
                </button>
              </div>
              {preset === 'custom' && (
                <input
                  className="bucket-date" type="date" value={customDate}
                  min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
                  onChange={e => { setCustomDate(e.target.value); setConfirmLock(false); }}
                />
              )}
              {lockDatePicked && !confirmLock && (
                <button className="btn warm small" type="button" onClick={() => setConfirmLock(true)}>
                  Lock until {fmtDate(lockDatePicked.toISOString())}
                </button>
              )}
              {lockDatePicked && confirmLock && (
                <div className="bucket-confirm">
                  <p>
                    This seals {items.length} dream{items.length === 1 ? '' : 's'} until{' '}
                    <b>{fmtDate(lockDatePicked.toISOString())}</b>. No peeking — for either of you. Sure?
                  </p>
                  <div className="bucket-edit-row">
                    <button className="btn warm small" type="button" onClick={lock}>Yes, seal it</button>
                    <button className="btn small ghost" type="button" onClick={() => setConfirmLock(false)}>Not yet</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── LOCKED ────────────────────────────────────────── */}
      {view.status === 'locked' && (
        <div className="bucket-sealed" data-tick={tick}>
          <div className="bucket-seal-mark" aria-hidden>🔒</div>
          <h4>Sealed until {fmtDate(view.unlock_at)}</h4>
          <div className="bucket-countdown">
            {countdown(view.unlock_at) || 'Opening…'}
          </div>
          <div className="bucket-count">
            {view.item_count} dream{view.item_count === 1 ? '' : 's'} inside
          </div>
          <p className="bucket-sub">
            Drop a new one in — you won&apos;t see it (or any of them) until the capsule opens.
          </p>
          <div className="bucket-form">
            <input
              type="text"
              placeholder="Slip a dream into the capsule…"
              value={text}
              maxLength={280}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && add()}
            />
            <button className="btn warm small" type="button" onClick={add}>Drop in</button>
          </div>
        </div>
      )}

      {/* ── OPENED ────────────────────────────────────────── */}
      {view.status === 'opened' && (
        <>
          <div className="bucket-reveal-head">
            <h4>{'🎉'} The capsule is open</h4>
            <p className="bucket-sub">
              Sealed {fmtDate(view.locked_at)} — opened {fmtDate(view.opened_at)}.
              How did you two do? Mark each one.
            </p>
            <div className="bucket-tally">
              <b>{achieved}</b> / {items.length} achieved
            </div>
          </div>

          <div className="bucket-list">
            {items.map(item => (
              <div
                key={item.id}
                className={
                  'bucket-item reveal'
                  + (item.achieved === true ? ' yes' : item.achieved === false ? ' no' : '')
                }
              >
                <div className="bucket-text">{item.text}</div>
                <div className="bucket-meta">by <b>{nameOf(item.by)}</b></div>
                <div className="bucket-markrow">
                  <button
                    type="button"
                    className={'mark-yes' + (item.achieved === true ? ' on' : '')}
                    onClick={() => apply(() => bucketMark(code, item.id, item.achieved === true ? null : true))}
                  >
                    ✓ Achieved
                  </button>
                  <button
                    type="button"
                    className={'mark-no' + (item.achieved === false ? ' on' : '')}
                    onClick={() => apply(() => bucketMark(code, item.id, item.achieved === false ? null : false))}
                  >
                    ✗ Not yet
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button className="btn warm small bucket-archive" type="button" onClick={archive}>
            Archive as keepsake &amp; start a new list
          </button>
        </>
      )}

      {/* ── HISTORY ───────────────────────────────────────── */}
      <button className="bucket-history-toggle" type="button" onClick={toggleHistory}>
        {showHistory ? 'Hide past capsules' : 'Past capsules'}
      </button>
      {showHistory && (
        <div className="bucket-history">
          {(history || []).length === 0 && (
            <div className="bucket-empty">No opened capsules yet.</div>
          )}
          {(history || []).map(h => {
            const got = (h.items || []).filter(i => i.achieved === true).length;
            return (
              <div key={h.id} className="bucket-history-entry">
                <div className="bucket-history-head">
                  <span>{fmtDate(h.locked_at)} → {fmtDate(h.opened_at)}</span>
                  <b>{got}/{h.item_count} achieved</b>
                </div>
                <ul>
                  {(h.items || []).map(i => (
                    <li key={i.id} className={i.achieved === true ? 'yes' : i.achieved === false ? 'no' : ''}>
                      {i.achieved === true ? '✓' : i.achieved === false ? '✗' : '·'} {i.text}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {status && <div className="bucket-status">{status}</div>}
    </div>
  );
}
