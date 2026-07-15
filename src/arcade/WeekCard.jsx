// src/arcade/WeekCard.jsx — "Our week" home section.

import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { loadTimetable, weekChannel, fmtTime, myRoleInDuo, mySettingsFrom } from '../lib/timetable.js';
import '../styles/timetable.css';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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
  const todays = events
    .filter(ev => ev.day === today && ev.start + ev.dur > nowMins)
    .sort((a, b) => a.start - b.start)
    .slice(0, 3);

  return (
    <div className="wkc" id="sect-week">
      <div className="wkc-head">
        <h3>Our week</h3>
        <span className="wkc-today">{DAY_NAMES[today]}</span>
      </div>

      {todays.length > 0 ? (
        <div className="wkc-list">
          {todays.map(ev => (
            <div className="wkc-item" key={ev.id}>
              <span className="bar" style={{ background: ev.color }} />
              <span className="t">{fmtTime(ev.start, timeFormat)}</span>
              <span className="n">{ev.emoji ? ev.emoji + ' ' : ''}{ev.title}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="wkc-empty">nothing planned for the rest of today</div>
      )}

      <div className="wkc-foot">
        <p className="wkc-desc">
          One timetable for the two of you — plans, calls, free evenings.
          Either of you can edit anything; changes appear live.
        </p>
        <Link className="btn warm small" to={`/week/${code}`}>Open our week</Link>
      </div>
    </div>
  );
}
