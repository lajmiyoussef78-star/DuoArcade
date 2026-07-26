// src/arcade/BucketListCard.jsx — time-locked couples bucket list.
// draft -> locked (hidden, blind adds) -> opened (mark achieved) -> archived + new.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  bucketGet, bucketAddItem,
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
      return v;
    } catch (e) {
      setStatus(e.message);
      return null;
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
  const count = view.status === 'locked'
    ? (view.item_count || 0)
    : (view.item_count ?? items.length);
  const achieved = items.filter(i => i.achieved === true).length;
  const lockDatePicked = chosenDate();

  return (
    <div className="bucket-card">
      <header className="bucket-head">
        <h3>Bucket List</h3>
        <p className="bucket-sub">
          Add dreams together, seal them until a date you pick — then open and see what you made real.
          No peeking and no editing once they&apos;re in.
        </p>
      </header>

      {view.status === 'draft' && (
        <>
          <div className="bucket-status-pill">
            <strong>{count}</strong>
            <span>dream{count === 1 ? '' : 's'} sealed in</span>
          </div>

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

          {count > 0 && (
            <div className="bucket-lockpanel">
              <h4>Seal the list</h4>
              <p>
                Lock {count} dream{count === 1 ? '' : 's'} until a date you choose.
                Neither of you can see what&apos;s inside until then — you can still add more blind.
              </p>
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
                  Seal until {fmtDate(lockDatePicked.toISOString())}
                </button>
              )}
              {lockDatePicked && confirmLock && (
                <div className="bucket-confirm">
                  <p>
                    Seal until{' '}
                    <b>{fmtDate(lockDatePicked.toISOString())}</b>? No peeking for either of you.
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

      {view.status === 'locked' && (
        <div className="bucket-locked-wrap" data-tick={tick}>
          <div className="bucket-status-pill locked">
            <strong>{countdown(view.unlock_at) || 'Opening…'}</strong>
            <span>Opens {fmtDate(view.unlock_at)}</span>
            <em>{count} inside</em>
          </div>
          <p className="bucket-sub bucket-locked-hint">
            Add another dream — it stays hidden until the list opens.
          </p>
          <div className="bucket-form">
            <input
              type="text"
              placeholder="Slip a dream in…"
              value={text}
              maxLength={280}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && add()}
            />
            <button className="btn warm small" type="button" onClick={add}>Add</button>
          </div>
        </div>
      )}

      {view.status === 'opened' && (
        <>
          <div className="bucket-reveal-head">
            <h4>Your dreams are out</h4>
            <p className="bucket-sub">
              Sealed {fmtDate(view.locked_at)} — opened {fmtDate(view.opened_at)}.
              Mark what you made real.
            </p>
            <div className="bucket-tally">
              <b>{achieved}</b> / {items.length} achieved
            </div>
          </div>

          <div className="bucket-reveal-list">
            {items.map(item => (
              <div
                key={item.id}
                className={
                  'bucket-reveal-item'
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
                    Achieved
                  </button>
                  <button
                    type="button"
                    className={'mark-no' + (item.achieved === false ? ' on' : '')}
                    onClick={() => apply(() => bucketMark(code, item.id, item.achieved === false ? null : false))}
                  >
                    Not yet
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

      <button className="bucket-history-toggle" type="button" onClick={toggleHistory}>
        {showHistory ? 'Hide past lists' : 'Past lists'}
      </button>
      {showHistory && (
        <div className="bucket-history">
          {(history || []).length === 0 && (
            <div className="bucket-empty">No opened lists yet.</div>
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
