// src/arcade/SnapCard.jsx — "Today's snap" v3: the diptych.
// One large frame divided in two — your half and your partner's half —
// with a heart medallion at the seam. Photos fill their halves; empty
// halves invite. Your own empty half is itself the button to the camera.

import { useEffect, useRef, useState, useCallback } from 'react';
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
    })();
    const ch = snapChannel(code);
    chRef.current = ch;
    ch.on(m => { if (m.k === 'snap') reload(); });
    return () => { alive = false; ch.close(); };
  }, [code, reload]);

  const myPhoto = snap && role ? (role === 'A' ? snap.photo_a : snap.photo_b) : null;
  const theirPhoto = snap && role ? (role === 'A' ? snap.photo_b : snap.photo_a) : null;
  const both = !!(myPhoto && theirPhoto);
  const myName = role === 'A' ? names.A : names.B;
  const otherName = role === 'A' ? names.B : names.A;

  const statusLine = both
    ? 'complete \u2014 today counted toward your streak'
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

      <div className="snc-frame">
        {/* my half — when empty, the half itself is the camera button */}
        {myPhoto ? (
          <div className="snc-half">
            <img src={myPhoto} alt="you, today" />
            <div className="snc-label"><span>{myName}</span><span className="snc-ok">{'\u2713'}</span></div>
          </div>
        ) : (
          <a className="snc-half snc-invite" href={`/snap/${code}`}>
            <div className="snc-cam">{'\u{1F4F7}'}</div>
            <div className="snc-invite-line">take today's photo</div>
            <div className="snc-label"><span>{myName}</span><span className="snc-dash">{'\u2014'}</span></div>
          </a>
        )}

        {/* partner half */}
        <div className={'snc-half' + (theirPhoto ? '' : ' snc-waiting')}>
          {theirPhoto ? (
            <img src={theirPhoto} alt="your partner, today" />
          ) : (
            <div className="snc-wait-line">waiting for {otherName}…</div>
          )}
          <div className="snc-label">
            <span>{otherName}</span>
            <span className={theirPhoto ? 'snc-ok' : 'snc-dash'}>{theirPhoto ? '\u2713' : '\u2014'}</span>
          </div>
        </div>

        <div className={'snc-badge' + (both ? ' full' : '')}>{both ? '\u2665' : '\u2661'}</div>
      </div>

      <div className="snc-foot">
        <p className="snc-desc">
          One camera photo each, every day — no uploads. Both in and the
          day counts; the pair becomes a keepsake.
        </p>
        <a className="btn warm small" href={`/snap/${code}`}>
          {both ? 'View & download' : myPhoto ? 'Open' : 'Take today\u2019s photo'}
        </a>
      </div>
    </div>
  );
}
