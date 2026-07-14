// src/arcade/SnapCard.jsx — "Today's snap" home section, clean edition.

import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { loadSnap, snapChannel, todayStr, myRoleInDuo, duoNames } from '../lib/snaps.js';
import '../styles/snaps.css';

export default function SnapCard({ code }) {
  const [snap, setSnap] = useState(null);
  const [role, setRole] = useState(null);
  const [names, setNames] = useState({ A: 'A', B: 'B' });
  const chRef = useRef(null);
  const day = todayStr();

  const reload = useCallback(async () => {
    try { setSnap(await loadSnap(code, day)); } catch { /* no row yet */ }
  }, [code, day]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await myRoleInDuo(code);
      if (!alive) return;
      setRole(r);
      setNames(await duoNames(code));
      reload();
      const ch = await snapChannel(code);
      if (!alive) { ch.close(); return; }
      chRef.current = ch;
      ch.on(m => { if (m.k === 'snap') reload(); });
    })();
    return () => { alive = false; chRef.current?.close(); };
  }, [code, reload]);

  const myPhoto = snap && role ? (role === 'A' ? snap.photo_a : snap.photo_b) : null;
  const theirPhoto = snap && role ? (role === 'A' ? snap.photo_b : snap.photo_a) : null;
  const both = !!(myPhoto && theirPhoto);
  const otherName = role === 'A' ? names.B : names.A;

  const statusLine = both
    ? 'complete \u2014 today counted'
    : myPhoto
      ? `waiting for ${otherName}`
      : theirPhoto
        ? `${otherName} snapped \u2014 your turn`
        : 'no photos yet today';

  return (
    <div className="snc">
      <div className="snc-head">
        <h3>Today's snap</h3>
        <span className={'snc-status' + (both ? ' done' : '')}>{statusLine}</span>
      </div>
      <p className="snc-desc">
        One camera photo each, every day. Both in and the day counts toward
        your streak; the pair becomes a downloadable keepsake.
      </p>
      <div className="snc-row">
        <div className={'snc-mini' + (myPhoto ? '' : ' empty')}>
          {myPhoto ? <img src={myPhoto} alt="" /> : <span>you</span>}
        </div>
        <div className={'snc-heart' + (both ? ' full' : '')}>{both ? '\u2665' : '\u2661'}</div>
        <div className={'snc-mini' + (theirPhoto ? '' : ' empty')}>
          {theirPhoto ? <img src={theirPhoto} alt="" /> : <span>{otherName}</span>}
        </div>
        <Link className="btn warm small" to={`/snap/${code}`}>
          {myPhoto ? 'Open' : 'Take today\u2019s photo'}
        </Link>
      </div>
    </div>
  );
}
