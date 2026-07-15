// src/arcade/WeekCard.jsx — "Our week" home section (matches wall / snap cards).

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loadTimetable, weekChannel, fmtTime, myRoleInDuo, mySettingsFrom, duoNames, saveTimetable } from '../lib/timetable.js';
import { defaultTimezone, eventsToLocal, nowInTimezone } from '../lib/timetableTimezone.js';
import WeekBlockDetail from './WeekBlockDetail.jsx';
import '../styles/timetable.css';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function WeekCard({ code }) {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [timeFormat, setTimeFormat] = useState('24');
  const [timezone, setTimezone] = useState(defaultTimezone);
  const [names, setNames] = useState({ A: 'A', B: 'B' });
  const [selectedDay, setSelectedDay] = useState(null);
  const [viewing, setViewing] = useState(null);
  const chRef = useRef(null);
  const eventsRef = useRef(events);
  eventsRef.current = events;

  const reload = useCallback(async () => {
    try {
      const t = await loadTimetable(code);
      setEvents(t.events);
      const role = await myRoleInDuo(code);
      setNames(await duoNames(code));
      if (role) {
        const s = mySettingsFrom(t.settingsAll, role);
        setTimeFormat(s.timeFormat === '12' ? '12' : '24');
        setTimezone(s.timezone || defaultTimezone());
      }
    } catch { /* none yet */ }
  }, [code]);

  useEffect(() => {
    let alive = true;
    reload();
    (async () => {
      const ch = await weekChannel(code);
      if (!alive) { ch.close(); return; }
      chRef.current = ch;
      ch.on(m => { if (m.k === 'events') setEvents(m.events); });
    })();
    return () => {
      alive = false;
      chRef.current?.close();
    };
  }, [code, reload]);

  const now = Date.now();
  const nowLocal = nowInTimezone(timezone, now);
  const today = nowLocal.day;
  const activeDay = selectedDay ?? today;

  const displayEvents = useMemo(
    () => eventsToLocal(events, timezone, now),
    [events, timezone, now]
  );

  const daysWithEvents = useMemo(() => {
    const set = new Set();
    for (const ev of displayEvents) set.add(ev.day);
    return set;
  }, [displayEvents]);

  const dayEvents = useMemo(() =>
    displayEvents
      .filter(ev => ev.day === activeDay)
      .sort((a, b) => a.start - b.start),
    [displayEvents, activeDay]
  );

  function whoShort(who) {
    if (who === 'both') return 'both';
    return names[who] || who;
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

  async function deleteViewing(ev) {
    const next = eventsRef.current.filter(e => e.id !== ev.id);
    setEvents(next);
    chRef.current?.send({ k: 'events', events: next });
    try {
      await saveTimetable(code, { events: next });
    } catch { /* ignore */ }
    setViewing(null);
  }

  function openEdit(ev) {
    setViewing(null);
    navigate(`/week/${code}`, { state: { editEventId: ev.id } });
  }

  return (
    <>
    <div className="wkc">
      <h3>Our week</h3>
      <p className="wkc-desc">
        One timetable for the two of you — plans, calls, free evenings.
        Either of you can edit anything; changes appear live.
      </p>

      <div className="wkc-preview">
        <div className="wkc-frame">
          <div className="wkc-strip">
            {DAY_SHORT.map((label, i) => (
              <button
                type="button"
                key={i}
                className={'wkc-day'
                  + (i === activeDay ? ' on' : '')
                  + (i === today ? ' today' : '')
                  + (daysWithEvents.has(i) ? ' has' : '')}
                aria-label={DAY_NAMES[i]}
                aria-pressed={i === activeDay}
                onClick={() => setSelectedDay(i)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="wkc-frame-body">
            {dayEvents.length > 0 ? (
              <ul className="wkc-list">
                {dayEvents.map(ev => (
                  <li className="wkc-item" key={ev.id}>
                    <button type="button" className="wkc-item-btn" onClick={() => setViewing(ev)}>
                      <span className="wkc-bar" style={{ background: ev.color }} />
                      <span className="wkc-time">{fmtTime(ev.start, timeFormat)}</span>
                      <span className="wkc-name">{ev.emoji ? ev.emoji + ' ' : ''}{ev.title}</span>
                      <span className={'wkc-owner ' + (ev.who === 'both' ? 'both' : ev.who)}>{whoShort(ev.who)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="wkc-empty">
                <span className="wkc-empty-title">{DAY_NAMES[activeDay]}</span>
                <span>
                  {activeDay === today
                    ? 'nothing planned for today'
                    : `nothing planned for ${DAY_NAMES[activeDay].toLowerCase()}`}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="wkc-foot">
        <Link className="btn warm" to={`/week/${code}`}>Open our week</Link>
      </div>
    </div>

    <WeekBlockDetail
      viewing={viewing}
      dayName={viewing ? DAY_NAMES[viewing.day] : ''}
      timeFormat={timeFormat}
      fmtDur={fmtDur}
      whoLabel={whoLabel}
      onClose={() => setViewing(null)}
      onDelete={deleteViewing}
      onEdit={openEdit}
      overlayClass="wkc-overlay"
    />
    </>
  );
}
