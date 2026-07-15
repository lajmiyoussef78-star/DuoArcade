// src/arcade/WeekCard.jsx — "Our week" home section (matches wall / snap cards).

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { loadTimetable, weekChannel, fmtTime, myRoleInDuo, mySettingsFrom } from '../lib/timetable.js';
import '../styles/timetable.css';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function WeekCard({ code }) {
  const [events, setEvents] = useState([]);
  const [timeFormat, setTimeFormat] = useState('24');
  const chRef = useRef(null);

  const reload = useCallback(async () => {
    try {
      const t = await loadTimetable(code);
      setEvents(t.events);
      const role = await myRoleInDuo(code);
      if (role) setTimeFormat(mySettingsFrom(t.settingsAll, role).timeFormat === '12' ? '12' : '24');
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

  const now = new Date();
  const today = now.getDay();
  const nowMins = now.getHours() * 60 + now.getMinutes();

  const daysWithEvents = useMemo(() => {
    const set = new Set();
    for (const ev of events) set.add(ev.day);
    return set;
  }, [events]);

  const todays = events
    .filter(ev => ev.day === today && ev.start + ev.dur > nowMins)
    .sort((a, b) => a.start - b.start)
    .slice(0, 4);

  return (
    <div className="wkc">
      <h3>{'✓'} Our week</h3>
      <p className="wkc-desc">
        One timetable for the two of you — plans, calls, free evenings.
        Either of you can edit anything; changes appear live.
      </p>

      <Link className="wkc-preview" to={`/week/${code}`} aria-label="Open our week">
        <div className="wkc-frame">
          <div className="wkc-strip">
            {DAY_SHORT.map((label, i) => (
              <span
                key={i}
                className={'wkc-day' + (i === today ? ' today' : '') + (daysWithEvents.has(i) ? ' has' : '')}
              >
                {label}
              </span>
            ))}
          </div>

          <div className="wkc-frame-body">
            {todays.length > 0 ? (
              <ul className="wkc-list">
                {todays.map(ev => (
                  <li className="wkc-item" key={ev.id}>
                    <span className="wkc-bar" style={{ background: ev.color }} />
                    <span className="wkc-time">{fmtTime(ev.start, timeFormat)}</span>
                    <span className="wkc-name">{ev.emoji ? ev.emoji + ' ' : ''}{ev.title}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="wkc-empty">
                <span className="wkc-empty-title">{DAY_NAMES[today]}</span>
                <span>nothing planned for the rest of today</span>
              </div>
            )}
          </div>
        </div>
      </Link>

      <div className="wkc-foot">
        <Link className="btn warm" to={`/week/${code}`}>Open our week</Link>
      </div>
    </div>
  );
}
