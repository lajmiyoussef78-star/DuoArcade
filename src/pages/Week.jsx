// src/pages/Week.jsx — route: /week/:code

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  myRoleInDuo, duoNames, loadTimetable, saveTimetable, weekChannel,
  DEFAULT_SETTINGS, mySettingsFrom, fmtTime, fmtHour, fmtHourOption, parseTime, layoutDay
} from '../lib/timetable.js';
import '../styles/timetable.css';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
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
  const [showSettings, setShowSettings] = useState(false);
  const [status, setStatus] = useState('');
  const [nowTick, setNowTick] = useState(Date.now());
  const [narrow, setNarrow] = useState(window.innerWidth < 720);
  const [activeDay, setActiveDay] = useState(new Date().getDay());

  const chRef = useRef(null);
  const saveTimer = useRef(null);
  const eventsRef = useRef(events);
  eventsRef.current = events;

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
      clearTimeout(saveTimer.current);
    };
  }, [code]);

  const pushEvents = useCallback((next) => {
    setEvents(next);
    chRef.current?.send({ k: 'events', events: next });
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try { await saveTimetable(code, { events: next }); setStatus(''); }
      catch (e) { setStatus('Save failed: ' + e.message); }
    }, 1200);
  }, [code]);

  const pushSettings = useCallback((patch) => {
    let next = { ...settings, ...patch };
    if (next.endHour <= next.startHour) {
      next.endHour = Math.min(24, next.startHour + 1);
    }
    setSettings(next);
    const all = { ...settingsAll, [role]: next };
    for (const k of ['startHour', 'endHour', 'weekend', 'weekStart', 'timeFormat']) delete all[k];
    setSettingsAll(all);
    chRef.current?.send({ k: 'settings', role, settings: next });
    saveTimetable(code, { settings: all }).catch(e => setStatus('Save failed: ' + e.message));
  }, [code, settings, settingsAll, role]);

  const tf = settings.timeFormat === '12' ? '12' : '24';

  const dayOrder = useMemo(() => {
    const start = settings.weekStart === 0 ? 0 : 1;
    const all = [...Array(7)].map((_, i) => (start + i) % 7);
    return settings.weekend ? all : all.filter(d => d !== 0 && d !== 6);
  }, [settings.weekStart, settings.weekend]);

  const minM = settings.startHour * 60;
  const maxM = settings.endHour * 60;
  const span = maxM - minM;
  const hours = [];
  for (let h = settings.startHour; h < settings.endHour; h++) hours.push(h);

  const today = new Date(nowTick).getDay();
  const nowMins = new Date(nowTick).getHours() * 60 + new Date(nowTick).getMinutes();
  const nowVisible = nowMins >= minM && nowMins <= maxM;

  function slotClick(day, e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientY - rect.top) / rect.height;
    let mins = minM + Math.round((frac * span) / 30) * 30;
    mins = Math.max(minM, Math.min(maxM - 30, mins));
    setEditing({
      id: null, day, start: mins, dur: 60, title: '',
      emoji: '', color: COLORS[role === 'B' ? 1 : 0],
      who: role, note: ''
    });
  }

  function saveDraft(draft) {
    if (!draft.title.trim()) { setStatus('Give it a name'); return; }
    setStatus('');
    let next;
    if (draft.id) {
      next = eventsRef.current.map(ev => ev.id === draft.id ? draft : ev);
    } else {
      next = [...eventsRef.current, { ...draft, id: newId() }];
    }
    pushEvents(next);
    setEditing(null);
  }

  function deleteDraft(draft) {
    if (!draft.id) { setEditing(null); return; }
    pushEvents(eventsRef.current.filter(ev => ev.id !== draft.id));
    setEditing(null);
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
      <div className="wk-top">
        <button className="btn small ghost" onClick={backToDuo}>&larr; Back</button>
        <div className="wk-title">Our week</div>
        <button className="btn small ghost" onClick={() => setShowSettings(v => !v)} title="Settings">
          {'\u2699\uFE0F'}
        </button>
      </div>

      <div className="wk-legend">
        <span className="wk-leg"><i className="wk-dot A" /> {names.A}</span>
        <span className="wk-leg"><i className="wk-dot B" /> {names.B}</span>
        <span className="wk-leg"><i className="wk-dot both" /> both of you</span>
        <span className="wk-hint">tap an empty slot to add · tap a block to edit</span>
      </div>

      {showSettings && (
        <div className="wk-settings">
          <div className="wk-settings-note">Your view — either of you can change these anytime.</div>
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

        <div className="wk-hours" style={{ height: span / 2 + 'px' }}>
          {hours.map(h => (
            <div key={h} className="wk-hour" style={{ top: ((h * 60 - minM) / span * 100) + '%' }}>
              {fmtHour(h, tf)}
            </div>
          ))}
        </div>

        {visibleDays.map(d => {
          const dayEvents = layoutDay(events.filter(ev => ev.day === d));
          return (
            <div key={'c' + d}
              className={'wk-col' + (d === today ? ' today' : '')}
              style={{ height: span / 2 + 'px' }}
              onClick={e => { if (e.target === e.currentTarget) slotClick(d, e); }}>
              {dayEvents.map(ev => (
                <div key={ev.id}
                  className="wk-ev"
                  style={{
                    top: ((ev.start - minM) / span * 100) + '%',
                    height: (ev.dur / span * 100) + '%',
                    left: (ev.lane / ev.lanes * 100) + '%',
                    width: (100 / ev.lanes) + '%',
                    background: ev.color + '26',
                    borderLeftColor: ev.color
                  }}
                  onClick={() => setEditing({ ...ev })}>
                  <span className={'wk-dot ' + (ev.who === 'both' ? 'both' : ev.who)} />
                  <span className="wk-ev-title">{ev.emoji ? ev.emoji + ' ' : ''}{ev.title}</span>
                  <span className="wk-ev-time">{fmtTime(ev.start, tf)}</span>
                </div>
              ))}
              {d === today && nowVisible && (
                <div className="wk-now" style={{ top: ((nowMins - minM) / span * 100) + '%' }} />
              )}
            </div>
          );
        })}
      </div>

      {status && <div className="wk-status">{status}</div>}

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
