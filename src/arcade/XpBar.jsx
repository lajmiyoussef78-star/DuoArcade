import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMyXp, levelFromXp, titleForLevel } from '../lib/xp.js';
import '../styles/xp.css';

function fmtXp(n) {
  return Math.max(0, Math.floor(Number(n) || 0)).toLocaleString('en-US');
}

export default function XpBar({ code }) {
  const [total, setTotal] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!code) return undefined;
    let alive = true;
    getMyXp(code)
      .then(data => {
        if (!alive) return;
        setTotal(data?.total_xp || 0);
        setReady(true);
      })
      .catch(() => {
        if (alive) setReady(true);
      });
    return () => { alive = false; };
  }, [code]);

  const { level, intoLevel, needed } = levelFromXp(total);
  const title = titleForLevel(level);
  const pct = needed > 0 ? Math.min(100, (100 * intoLevel) / needed) : 0;

  return (
    <div className="xp-bar" aria-label="Duo XP progress">
      <div className="xp-bar-top">
        <span className="xp-badge" title="Duo level">{level}</span>
        <div className="xp-bar-copy">
          <div className="xp-title">{title}</div>
          <div className="xp-meta">
            {ready ? `${fmtXp(total)} XP` : 'Loading XP…'}
            <span className="xp-sep">·</span>
            <Link className="xp-board-link" to="/leaderboard">Leaderboard</Link>
          </div>
        </div>
      </div>
      <div className="xp-track" role="progressbar" aria-valuenow={intoLevel} aria-valuemin={0} aria-valuemax={needed}>
        <div className="xp-fill" style={{ width: pct + '%' }}>
          <span className="xp-shine" aria-hidden="true" />
        </div>
      </div>
      <div className="xp-sub">
        {intoLevel} / {needed} to level {level + 1}
      </div>
    </div>
  );
}
