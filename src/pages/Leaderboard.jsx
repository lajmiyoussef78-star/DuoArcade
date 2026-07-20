// src/pages/Leaderboard.jsx — route: /leaderboard

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CONFIG } from '../lib/config.js';
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
    title: titleForLevel(level)
  };
}

export default function Leaderboard() {
  const [board, setBoard] = useState([]);
  const [me, setMe] = useState(null);
  const [status, setStatus] = useState('Loading leaderboard…');

  useEffect(() => {
    applyTheme('night');
    let alive = true;
    (async () => {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
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

  const meInBoard = me && board.some(
    r => r.name_a === me.name_a && r.name_b === me.name_b && r.total_xp === me.total_xp
  );

  return (
    <div className="arcade-page">
      <div className="xp-lb">
        <div className="xp-lb-head">
          <Link className="btn small ghost" to="/app">Back</Link>
          <h1>Duo Leaderboard</h1>
        </div>

        {me && (
          <div className="xp-lb-you">
            Your duo: #{me.rank ?? '—'}
            <strong>{me.name_a} & {me.name_b}</strong>
            <span>Level {me.level} · {me.title} · {fmtXp(me.total_xp)} XP</span>
          </div>
        )}

        {status && <p className="xp-lb-status">{status}</p>}

        {!status && (
          <div className="xp-lb-list">
            {board.length === 0 && (
              <p className="xp-lb-status">No XP yet — finish a match together to climb the board.</p>
            )}
            {board.map(row => {
              const mine = me
                && row.name_a === me.name_a
                && row.name_b === me.name_b
                && row.total_xp === me.total_xp;
              const medal = row.rank <= 3 ? ` rank-${row.rank}` : '';
              return (
                <div
                  key={`${row.rank}-${row.name_a}-${row.name_b}-${row.total_xp}`}
                  className={'xp-lb-row' + medal + (mine ? ' mine' : '')}
                >
                  <div className="xp-lb-rank">#{row.rank}</div>
                  <div>
                    <div className="xp-lb-names">{row.name_a} & {row.name_b}</div>
                    <div className="xp-lb-title">{row.title}</div>
                  </div>
                  <div className="xp-lb-stats">
                    <b>Lv {row.level}</b>
                    {fmtXp(row.total_xp)} XP
                  </div>
                </div>
              );
            })}

            {me && !meInBoard && (
              <div className="xp-lb-row mine">
                <div className="xp-lb-rank">#{me.rank ?? '—'}</div>
                <div>
                  <div className="xp-lb-names">{me.name_a} & {me.name_b}</div>
                  <div className="xp-lb-title">{me.title}</div>
                </div>
                <div className="xp-lb-stats">
                  <b>Lv {me.level}</b>
                  {fmtXp(me.total_xp)} XP
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
