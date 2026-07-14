// src/arcade/SnapCard.jsx — the "Today's snap" section for the duo home.

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
    ? 'complete — today counted toward your streak \u{1F525}'
    : myPhoto
      ? `you're in — waiting for ${otherName}\u2026`
      : theirPhoto
        ? `${otherName} already snapped — your turn!`
        : 'no photos yet today';

  return (
    <div className="snc">
      <div className="snc-pair">
        <div className={'snc-mini' + (myPhoto ? '' : ' empty')}>
          {myPhoto ? <img src={myPhoto} alt="" /> : <span>you</span>}
        </div>
        <div className="snc-heart">{both ? '\u2665' : '\u2661'}</div>
        <div className={'snc-mini' + (theirPhoto ? '' : ' empty')}>
          {theirPhoto ? <img src={theirPhoto} alt="" /> : <span>{otherName}</span>}
        </div>
      </div>
      <div className="snc-side">
        <h3>{'\u{1F4F8}'} Today&apos;s snap</h3>
        <p>
          One instant photo each, every day — no uploads, camera only.
          Both in and the day counts toward your streak; the pair becomes a
          downloadable keepsake.
        </p>
        <div className="snc-meta">{statusLine}</div>
        <Link className="btn warm" to={`/snap/${code}`}>
          {myPhoto ? 'Open today\u2019s snap' : 'Take today\u2019s photo'}
        </Link>
      </div>
    </div>
  );
}
