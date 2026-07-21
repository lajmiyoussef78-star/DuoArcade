import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMyXp, levelFromXp, titleForLevel } from '../lib/xp.js';
import '../styles/xp.css';

function fmtXp(n) {
  return Math.max(0, Math.floor(Number(n) || 0)).toLocaleString('en-US');
}

/** Four-point spark — no emoji. */
export function SparkIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 1.6 L13.7 9.2 L21.2 11 L13.7 12.8 L12 20.4 L10.3 12.8 L2.8 11 L10.3 9.2 Z"
      />
      <path
        fill="currentColor"
        opacity=".55"
        d="M19.2 3.2 L19.9 6.1 L22.8 6.8 L19.9 7.5 L19.2 10.4 L18.5 7.5 L15.6 6.8 L18.5 6.1 Z"
      />
    </svg>
  );
}

/** Compact couple-title pill for the duo header (matches Founding Duo / streak). */
export function XpTitlePill({ code }) {
  const [title, setTitle] = useState('New Sparks');

  useEffect(() => {
    if (!code) return undefined;
    let alive = true;
    getMyXp(code)
      .then(data => {
        if (!alive) return;
        const { level } = levelFromXp(data?.total_xp || 0);
        setTitle(titleForLevel(level));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [code]);

  return (
    <div className="xp-title-pill" title="Couple title">
      <SparkIcon className="xp-title-pill-ico" />
      <span>{title}</span>
    </div>
  );
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
        <span className="xp-badge" title={title}>
          <SparkIcon className="xp-badge-spark" />
          <span className="xp-badge-lvl">{level}</span>
        </span>
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
