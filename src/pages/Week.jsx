// src/pages/Week.jsx — route: /week/:code

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  myRoleInDuo, duoNames, loadTimetable, saveTimetable, weekChannel,
  DEFAULT_SETTINGS, mySettingsFrom, fmtTime, fmtHour, fmtHourOption, parseTime, layoutDay,
  weekColHeight, eventBlockHeight, eventSizeClass
} from '../lib/timetable.js';
import {
  defaultTimezone, timezoneOptions, timezoneLabel, shortTimezoneLabel,
  eventsToLocal, localEventToStored, nowInTimezone
} from '../lib/timetableTimezone.js';
import '../styles/timetable.css';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const COLORS = ['#7FA8FF', '#FF7FA8', '#FFC66E', '#6FDCA8', '#C89BFF'];
const EMOJIS = ['', '\u{1F4DE}', '\u{1F3AE}', '\u{1F37D}\uFE0F', '\u{1F4DA}', '\u{1F3CB}\uFE0F', '\u{1F3AC}', '\u2764\uFE0F', '\u2708\uFE0F', '\u{1F634}'];
const DUR_OPTIONS = [30, 60, 90, 120, 180, 240];
const START_HOURS = [...Array(24)].map((_, i) => i);
const END_HOURS = [...Array(25)].map((_, i) => i + 1).slice(1); // 1..24

let seq = 0;
const newId = () => Date.now().toString(36) + '-' + (seq++);

export default function Week() {
  const { code } = useParams();
  const navigate = useNavigate();
  const backToDuo = useCallback(() => {
    navigate(`/app?duo=${encodeURIComponent(code)}`, { replace: true });
  }, [code, navigate]);
  const [role, setRole] = useState(undefined);
  const [names, setNames] = useState({ A: 'A', B: 'B' });
  const [events, setEvents] = useState([]);
  const [settingsAll, setSettingsAll] = useState({});
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [status, setStatus] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());
  const [narrow, setNarrow] = useState(window.innerWidth < 720);
  const [activeDay, setActiveDay] = useState(new Date().getDay());

  const chRef = useRef(null);
  const eventsRef = useRef(events);
  const settingsRef = useRef(settings);
  const settingsAllRef = useRef(settingsAll);
  eventsRef.current = events;
  settingsRef.current = settings;
  settingsAllRef.current = settingsAll;

  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await myRoleInDuo(code);
      if (!alive) return;
      setRole(r);
      if (!r) return;
      setNames(await duoNames(code));
      try {
        const t = await loadTimetable(code);
        if (!alive) return;
        setEvents(t.events);
        setSettingsAll(t.settingsAll);
        setSettings(mySettingsFrom(t.settingsAll, r));
      } catch (e) { setStatus(e.message); }

      const ch = await weekChannel(code);
      if (!alive) { ch.close(); return; }
      chRef.current = ch;
      ch.on(m => {
        if (m.k === 'events') setEvents(m.events);
        if (m.k === 'settings') setSettingsAll(all => ({ ...all, [m.role]: m.settings }));
      });
    })();

    const onResize = () => setNarrow(window.innerWidth < 720);
    window.addEventListener('resize', onResize);
    const tick = setInterval(() => setNowTick(Date.now()), 60000);
    return () => {
      alive = false;
      window.removeEventListener('resize', onResize);
      clearInterval(tick);
      chRef.current?.close();
    };
  }, [code]);

  const pushEvents = useCallback((next) => {
    setEvents(next);
    setDirty(true);
    chRef.current?.send({ k: 'events', events: next });
  }, []);

  const pushSettings = useCallback((patch) => {
    let next = { ...settingsRef.current, ...patch };
    if (next.endHour <= next.startHour) {
      next.endHour = Math.min(24, next.startHour + 1);
    }
    setSettings(next);
    const all = { ...settingsAllRef.current, [role]: next };
    for (const k of ['startHour', 'endHour', 'weekend', 'weekStart', 'timeFormat', 'timezone']) delete all[k];
    setSettingsAll(all);
    setDirty(true);
    chRef.current?.send({ k: 'settings', role, settings: next });
  }, [role]);

  const saveChanges = useCallback(async () => {
    if (saving || !dirty) return;
    setSaving(true);
    setStatus('');
    try {
      const all = { ...settingsAllRef.current, [role]: settingsRef.current };
      for (const k of ['startHour', 'endHour', 'weekend', 'weekStart', 'timeFormat', 'timezone']) delete all[k];
      await saveTimetable(code, { events: eventsRef.current, settings: all });
      setDirty(false);
      setStatus('Saved');
    } catch (e) {
      setStatus('Save failed: ' + e.message);
    } finally {
      setSaving(false);
    }
  }, [code, dirty, role, saving]);

  const tf = settings.timeFormat === '12' ? '12' : '24';
  const viewerTz = settings.timezone || defaultTimezone();

  const displayEvents = useMemo(
    () => eventsToLocal(events, viewerTz, nowTick),
    [events, viewerTz, nowTick]
  );

  const dayOrder = useMemo(() => {
    const start = settings.weekStart === 0 ? 0 : 1;
    const all = [...Array(7)].map((_, i) => (start + i) % 7);
    return settings.weekend ? all : all.filter(d => d !== 0 && d !== 6);
  }, [settings.weekStart, settings.weekend]);

  const minM = settings.startHour * 60;
  const maxM = settings.endHour * 60;
  const span = maxM - minM;
  const colHeight = weekColHeight(span);
  const hourPx = colHeight / Math.max(1, settings.endHour - settings.startHour);
  const hours = [];
  for (let h = settings.startHour; h < settings.endHour; h++) hours.push(h);

  const nowLocal = nowInTimezone(viewerTz, nowTick);
  const today = nowLocal.day;
  const nowMins = nowLocal.start;
  const nowVisible = nowMins >= minM && nowMins <= maxM;

  function newBlockDraft(day, startMins) {
    let start = startMins;
    start = Math.max(minM, Math.min(maxM - 30, start));
    return {
      id: null, day, start, dur: 60, title: '',
      emoji: '', color: COLORS[role === 'B' ? 1 : 0],
      who: role, note: ''
    };
  }

  function openDraft(draft) {
    setViewing(null);
    setEditing(draft);
  }

  function slotClick(day, e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientY - rect.top) / rect.height;
    let mins = minM + Math.round((frac * span) / 30) * 30;
    openDraft(newBlockDraft(day, mins));
  }

  function openQuickAdd() {
    const day = narrow ? activeDay : today;
    let start = today === day ? nowMins : minM;
    if (start < minM) start = minM;
    if (start >= maxM - 30) start = minM;
    start = minM + Math.round((start - minM) / 30) * 30;
    openDraft(newBlockDraft(day, start));
  }

  function whoLabel(who) {
    if (who === 'both') return `both of you ${'\u2665'}`;
    return names[who] || who;
  }

  function fmtDur(mins) {
    if (mins < 60) return mins + ' min';
    if (mins % 60 === 0) return (mins / 60) + 'h';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h + 'h ' + m + 'm';
  }

  function openAddFromBlock(ev) {
    openDraft(newBlockDraft(ev.day, ev.start));
  }

  function saveDraft(draft) {
    if (!draft.title.trim()) { setStatus('Give it a name'); return; }
    setStatus('');
    const stored = localEventToStored(draft, viewerTz);
    let next;
    if (stored.id) {
      next = eventsRef.current.map(ev => ev.id === stored.id ? stored : ev);
    } else {
      next = [...eventsRef.current, { ...stored, id: newId() }];
    }
    pushEvents(next);
    setEditing(null);
    setViewing(null);
  }

  function deleteDraft(draft) {
    if (!draft.id) { setEditing(null); return; }
    pushEvents(eventsRef.current.filter(ev => ev.id !== draft.id));
    setEditing(null);
    setViewing(null);
  }

  if (role === undefined) return <div className="wk-page"><p className="wk-status">Loading…</p></div>;
  if (role === null) {
    return (
      <div className="wk-page">
        <p className="wk-status">Sign in as a member of this duo to see its week.</p>
        <button className="btn" onClick={backToDuo}>Back to the arcade</button>
      </div>
    );
  }

  const visibleDays = narrow ? [activeDay] : dayOrder;

  return (
    <div className="wk-page">
      <div className="wk-head">
        <div className="wk-top">
          <button className="btn small ghost" onClick={backToDuo}>&larr; Back</button>
          <button className="btn small ghost" onClick={() => setShowSettings(v => !v)} title="Settings">
            {'\u2699\uFE0F'}
          </button>
        </div>
        <div className="wk-title">Our week</div>
        <p className="wk-tz-caption">Times shown in {shortTimezoneLabel(viewerTz)}</p>
        <div className="wk-legend">
          <span className="wk-leg"><i className="wk-dot A" /> {names.A}</span>
          <span className="wk-leg"><i className="wk-dot B" /> {names.B}</span>
          <span className="wk-leg"><i className="wk-dot both" /> both of you</span>
        </div>
        <button type="button" className="btn warm small wk-add-btn" onClick={openQuickAdd}>
          + Add something new
        </button>
      </div>

      {events.length === 0 && (
        <p className="wk-empty-banner">Your week is empty — click <strong>+ Add something new</strong> or tap a time slot on the grid.</p>
      )}

      {showSettings && (
        <div className="wk-settings">
          <div className="wk-settings-note">Your view, either of you can change these anytime. Your partner sees the same events in their timezone.</div>
          <label>Your timezone
            <select value={viewerTz} onChange={e => pushSettings({ timezone: e.target.value })}>
              {timezoneOptions().map(tz => (
                <option key={tz} value={tz}>
                  {tz === defaultTimezone() ? `${timezoneLabel(tz)} (your location)` : timezoneLabel(tz)}
                </option>
              ))}
            </select>
          </label>
          <label>Time format
            <select value={tf} onChange={e => pushSettings({ timeFormat: e.target.value })}>
              <option value="24">24-hour (00:00 – 24:00)</option>
              <option value="12">12-hour (AM / PM)</option>
            </select>
          </label>
          <label>Day starts
            <select value={settings.startHour} onChange={e => pushSettings({ startHour: +e.target.value })}>
              {START_HOURS.map(h => (
                <option key={h} value={h}>{fmtHourOption(h, tf, 'start')}</option>
              ))}
            </select>
          </label>
          <label>Day ends
            <select value={settings.endHour} onChange={e => pushSettings({ endHour: +e.target.value })}>
              {END_HOURS.filter(h => h > settings.startHour).map(h => (
                <option key={h} value={h}>{fmtHourOption(h, tf, 'end')}</option>
              ))}
            </select>
          </label>
          <label>Weekend
            <select value={settings.weekend ? '1' : '0'} onChange={e => pushSettings({ weekend: e.target.value === '1' })}>
              <option value="1">show</option>
              <option value="0">hide</option>
            </select>
          </label>
          <label>Week starts
            <select value={settings.weekStart} onChange={e => pushSettings({ weekStart: +e.target.value })}>
              <option value={1}>Monday</option>
              <option value={0}>Sunday</option>
            </select>
          </label>
        </div>
      )}

      {narrow && (
        <div className="wk-daytabs">
          {dayOrder.map(d => (
            <button key={d}
              className={'wk-daytab' + (d === activeDay ? ' on' : '') + (d === today ? ' today' : '')}
              onClick={() => setActiveDay(d)}>
              {DAY_NAMES[d]}
            </button>
          ))}
        </div>
      )}

      <div className="wk-grid" style={{ gridTemplateColumns: `${tf === '12' ? 52 : 44}px repeat(${visibleDays.length}, 1fr)` }}>
        <div className="wk-corner" />
        {visibleDays.map(d => (
          <div key={'h' + d} className={'wk-dayhead' + (d === today ? ' today' : '')}>
            {DAY_NAMES[d]}
          </div>
        ))}

        <div className="wk-hours" style={{ height: colHeight + 'px' }}>
          {hours.map(h => (
            <div key={h} className="wk-hour" style={{ top: (((h * 60 - minM) / span) * colHeight) + 'px' }}>
              {fmtHour(h, tf)}
            </div>
          ))}
        </div>

        {visibleDays.map(d => {
          const dayEvents = layoutDay(displayEvents.filter(ev => ev.day === d));
          return (
            <div key={'c' + d}
              className={'wk-col' + (d === today ? ' today' : '') + (dayEvents.length === 0 ? ' wk-col-empty' : '')}
              style={{ height: colHeight + 'px', '--wk-hour-px': hourPx + 'px' }}
              onClick={e => { if (e.target === e.currentTarget) slotClick(d, e); }}>
              {dayEvents.map(ev => {
                const topPx = ((ev.start - minM) / span) * colHeight;
                const heightPx = eventBlockHeight(ev.dur, span, colHeight);
                const short = ev.dur <= 60;
                return (
                <div key={ev.id}
                  className={'wk-ev' + eventSizeClass(ev.dur)}
                  title={`${ev.title} · ${fmtTime(ev.start, tf)}`}
                  style={{
                    top: topPx + 'px',
                    height: heightPx + 'px',
                    left: (ev.lane / ev.lanes * 100) + '%',
                    width: (100 / ev.lanes) + '%',
                    background: ev.color + '26',
                    borderLeftColor: ev.color
                  }}
                  onClick={e => { e.stopPropagation(); setViewing({ ...ev }); }}>
                  <button
                    type="button"
                    className="wk-ev-add"
                    title="Add another block here"
                    aria-label="Add another block here"
                    onClick={e => { e.stopPropagation(); openAddFromBlock(ev); }}
                  >+</button>
                  <span className={'wk-dot ' + (ev.who === 'both' ? 'both' : ev.who)} />
                  {short ? (
                    <>
                      <span className="wk-ev-title">
                        {ev.emoji ? ev.emoji + ' ' : ''}{ev.title}
                      </span>
                      <span className="wk-ev-time wk-ev-time-inline">{fmtTime(ev.start, tf)}</span>
                    </>
                  ) : (
                    <>
                      <span className="wk-ev-title">
                        {ev.emoji ? ev.emoji + ' ' : ''}{ev.title}
                      </span>
                      <span className="wk-ev-time">{fmtTime(ev.start, tf)}</span>
                    </>
                  )}
                </div>
                );
              })}
              {d === today && nowVisible && (
                <div className="wk-now" style={{ top: (((nowMins - minM) / span) * colHeight) + 'px' }} />
              )}
            </div>
          );
        })}
      </div>

      <div className="wk-save-bar">
        <button
          type="button"
          className="btn warm"
          disabled={!dirty || saving}
          onClick={saveChanges}
        >
          {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
        </button>
        {dirty && !saving && (
          <span className="wk-save-hint">You have unsaved changes</span>
        )}
      </div>

      {status && <div className="wk-status">{status}</div>}

      {viewing && (
        <div className="wk-overlay" onClick={e => { if (e.target === e.currentTarget) setViewing(null); }}>
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
                <dd>{DAY_FULL[viewing.day]}</dd>
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
              <button type="button" className="btn small ghost wk-danger"
                onClick={() => deleteDraft(viewing)}>Delete</button>
              <span style={{ flex: 1 }} />
              <button type="button" className="btn small ghost" onClick={() => setViewing(null)}>Close</button>
              <button type="button" className="btn small warm"
                onClick={() => openDraft({ ...viewing })}>Edit</button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="wk-overlay" onClick={e => { if (e.target === e.currentTarget) setEditing(null); }}>
          <div className="wk-modal">
            <h3>{editing.id ? 'Edit block' : 'New block'}</h3>
            <label>What is it?
              <input autoFocus value={editing.title} maxLength={40}
                placeholder="call, gym, date night…"
                onChange={e => setEditing({ ...editing, title: e.target.value })} />
            </label>
            <div className="wk-row2">
              <label>Day
                <select value={editing.day} onChange={e => setEditing({ ...editing, day: +e.target.value })}>
                  {dayOrder.map(d => <option key={d} value={d}>{DAY_NAMES[d]}</option>)}
                </select>
              </label>
              <label>Starts
                <input type="time" value={fmtTime(editing.start)} step={900}
                  onChange={e => setEditing({ ...editing, start: parseTime(e.target.value) })} />
              </label>
              <label>Lasts
                <select value={editing.dur} onChange={e => setEditing({ ...editing, dur: +e.target.value })}>
                  {DUR_OPTIONS.map(m => <option key={m} value={m}>{m < 60 ? m + ' min' : (m / 60) + 'h'}</option>)}
                </select>
              </label>
            </div>
            <label>Whose block?
              <div className="wk-who">
                <button type="button" className={'wk-chip' + (editing.who === 'A' ? ' on' : '')}
                  onClick={() => setEditing({ ...editing, who: 'A' })}>{names.A}</button>
                <button type="button" className={'wk-chip' + (editing.who === 'B' ? ' on' : '')}
                  onClick={() => setEditing({ ...editing, who: 'B' })}>{names.B}</button>
                <button type="button" className={'wk-chip' + (editing.who === 'both' ? ' on' : '')}
                  onClick={() => setEditing({ ...editing, who: 'both' })}>both {'\u2665'}</button>
              </div>
            </label>
            <div className="wk-row2">
              <label>Color
                <div className="wk-colors">
                  {COLORS.map(c => (
                    <button key={c} type="button" className={'wk-swatch' + (editing.color === c ? ' on' : '')}
                      style={{ background: c }} onClick={() => setEditing({ ...editing, color: c })} />
                  ))}
                </div>
              </label>
              <label>Emoji
                <div className="wk-emojis">
                  {EMOJIS.map((em, i) => (
                    <button key={i} type="button" className={'wk-chip sm' + (editing.emoji === em ? ' on' : '')}
                      onClick={() => setEditing({ ...editing, emoji: em })}>{em || '\u2205'}</button>
                  ))}
                </div>
              </label>
            </div>
            <label>Note (optional)
              <input value={editing.note || ''} maxLength={80}
                placeholder="details, link, timezone…"
                onChange={e => setEditing({ ...editing, note: e.target.value })} />
            </label>
            {editing.note && <div className="wk-note-preview">{editing.note}</div>}
            <div className="wk-modal-actions">
              {editing.id && (
                <button type="button" className="btn small ghost wk-danger" onClick={() => deleteDraft(editing)}>Delete</button>
              )}
              <span style={{ flex: 1 }} />
              <button type="button" className="btn small ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button type="button" className="btn small warm" onClick={() => saveDraft(editing)}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
