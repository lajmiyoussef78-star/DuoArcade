// src/pages/Leaderboard.jsx — route: /app/leaderboard (kept under Arcade)

import { useEffect, useState } from 'react';
import { getSupabase } from '../lib/supabaseClient.js';
import { getLeaderboard, levelFromXp, titleForLevel } from '../lib/xp.js';
import { applyTheme } from '../lib/util.js';
import '../styles/xp.css';

function fmtXp(n) {
  return Math.max(0, Math.floor(Number(n) || 0)).toLocaleString('en-US');
}

function enrich(row) {
  if (!row) return null;
  const total = row.total_xp || 0;
  const { level } = levelFromXp(total);
  return {
    ...row,
    level,
    title: titleForLevel(level),
    show_public: !!row.show_public,
    username_a: row.username_a || null,
    username_b: row.username_b || null,
  };
}

function isSameDuo(a, b) {
  return !!a && !!b
    && a.name_a === b.name_a
    && a.name_b === b.name_b
    && a.total_xp === b.total_xp;
}

function publicUsername(row) {
  if (!row?.show_public) return null;
  return row.username_a || row.username_b || null;
}

function RankMark({ rank }) {
  if (rank === 1 || rank === 2 || rank === 3) {
    return <span className={`xp-lb-medal rank-${rank}`} aria-hidden="true" />;
  }
  return null;
}

function DuoRow({ row, mine, onOpenDuo }) {
  const medal = row.rank <= 3 ? ` rank-${row.rank}` : '';
  const username = publicUsername(row);
  const clickable = !!username && typeof onOpenDuo === 'function';

  const open = () => {
    if (clickable) onOpenDuo(row);
  };

  return (
    <li
      className={'xp-lb-row' + medal + (mine ? ' mine' : '') + (clickable ? ' clickable' : '')}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? open : undefined}
      onKeyDown={clickable ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      } : undefined}
      title={clickable ? `View ${row.name_a} & ${row.name_b}` : undefined}
    >
      <div className="xp-lb-rank">
        <RankMark rank={row.rank} />
        <span>{row.rank ?? '—'}</span>
      </div>
      <div className="xp-lb-duo">
        <div className="xp-lb-names">
          <span className="pA">{row.name_a}</span>
          <span className="amp"> & </span>
          <span className="pB">{row.name_b}</span>
        </div>
        <div className="xp-lb-title">
          {row.title}
          {clickable && <span className="xp-lb-public-hint"> · Public</span>}
        </div>
      </div>
      <div className="xp-lb-stats">
        <span className="xp-lb-level">Lv {row.level}</span>
        <span className="xp-lb-xp">{fmtXp(row.total_xp)} XP</span>
      </div>
    </li>
  );
}

export default function Leaderboard({
  theme = 'classic',
  embedded = false,
  onBack,
  onOpenDuo,
} = {}) {
  const [board, setBoard] = useState([]);
  const [me, setMe] = useState(null);
  const [status, setStatus] = useState('Loading leaderboard…');

  useEffect(() => {
    applyTheme(theme || 'classic');
  }, [theme]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const sb = await getSupabase();
        const { data: { session } } = await sb.auth.getSession();
        if (!session) {
          if (alive) setStatus('Sign in on the home screen first, then open the leaderboard.');
          return;
        }
        const data = await getLeaderboard(50);
        if (!alive) return;
        // Guard: never surface duo codes if a bad RPC ever leaks them.
        const safeBoard = (data?.board || []).map(r => {
          const { duo_code, code, ...rest } = r || {};
          void duo_code; void code;
          return enrich(rest);
        });
        const rawMe = data?.me || null;
        if (rawMe) {
          const { duo_code, code, ...rest } = rawMe;
          void duo_code; void code;
          setMe(enrich(rest));
        } else {
          setMe(null);
        }
        setBoard(safeBoard);
        setStatus('');
      } catch (e) {
        if (alive) setStatus(e.message || 'Could not load leaderboard.');
      }
    })();
    return () => { alive = false; };
  }, []);

  const meInBoard = board.some(row => isSameDuo(row, me));
  const meClickable = !!publicUsername(me) && typeof onOpenDuo === 'function';

  return (
    <div className={(embedded ? '' : 'arcade-page ') + 'xp-lb-page'}>
      <div className="xp-lb">
        <header className="xp-lb-head">
          <button
            type="button"
            className="btn small ghost btn-theme xp-lb-back"
            onClick={() => {
              if (typeof onBack === 'function') onBack();
            }}
          >
            Back
          </button>
          <div className="xp-lb-heading">
            <p className="xp-lb-kicker">Shared progress</p>
            <h1>Duo Leaderboard</h1>
            <p className="xp-lb-sub">Ranked by total XP earned together. Public duos open on tap.</p>
          </div>
        </header>

        {me && (
          <div
            className={'xp-lb-you' + (meClickable ? ' clickable' : '')}
            aria-label="Your duo standing"
            role={meClickable ? 'button' : undefined}
            tabIndex={meClickable ? 0 : undefined}
            onClick={meClickable ? () => onOpenDuo(me) : undefined}
            onKeyDown={meClickable ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpenDuo(me);
              }
            } : undefined}
            title={meClickable ? `View ${me.name_a} & ${me.name_b}` : undefined}
          >
            <div className="xp-lb-you-rank">#{me.rank ?? '—'}</div>
            <div className="xp-lb-you-copy">
              <span className="xp-lb-you-label">Your duo</span>
              <strong>
                <span className="pA">{me.name_a}</span>
                <span className="amp"> & </span>
                <span className="pB">{me.name_b}</span>
              </strong>
              <span className="xp-lb-you-meta">
                Level {me.level}
                <span className="xp-lb-dot" aria-hidden="true" />
                {me.title}
                <span className="xp-lb-dot" aria-hidden="true" />
                {fmtXp(me.total_xp)} XP
              </span>
            </div>
          </div>
        )}

        {status && <p className="xp-lb-status">{status}</p>}

        {!status && (
          <div className="xp-lb-panel" aria-label="Rankings">
            <div className="xp-lb-cols" aria-hidden="true">
              <span>Rank</span>
              <span>Duo</span>
              <span>XP</span>
            </div>
            <ol className="xp-lb-list">
              {board.length === 0 && (
                <li className="xp-lb-empty">
                  No XP yet — finish a match together to climb the board.
                </li>
              )}
              {board.map(row => (
                <DuoRow
                  key={`${row.rank}-${row.name_a}-${row.name_b}-${row.total_xp}`}
                  row={row}
                  mine={isSameDuo(row, me)}
                  onOpenDuo={onOpenDuo}
                />
              ))}
              {me && !meInBoard && (
                <DuoRow row={me} mine onOpenDuo={onOpenDuo} />
              )}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
