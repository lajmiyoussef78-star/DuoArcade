import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { totalsOf } from '../lib/util.js';
import { getLeaderboard } from '../lib/xp.js';
import XpBar, { XpTitlePill } from './XpBar.jsx';
import { Avatar } from './avatars.jsx';
import { Ico } from './ui/icons.jsx';

/* Quick section links — same destinations the feature rail uses */
export const HOME_NAV = [
  { id: 'sect-play', label: 'Games', icon: 'play', scroll: true },
  { id: 'sect-watch', label: 'WatchParty', icon: 'watch' },
  { id: 'sect-week', label: 'Timetable', icon: 'week' },
  { id: 'sect-snap', label: 'DuoSnap', icon: 'snap' },
  { id: 'sect-list', label: 'TodoList', icon: 'list' },
  { id: 'sect-bucket', label: 'BucketList', icon: 'bucket' },
  { id: 'arena', label: '2v2 Arena', icon: 'arena', route: '/app/arena' },
  { id: 'sect-wall', label: 'Whiteboard', icon: 'wall' },
];

/**
 * Shared top composition for home + place pages.
 * Returns a fragment so the dashboard column can lay the blocks out directly.
 */
export default function DuoHomeChrome({
  duo, code, isAway, avatars, onBack, activeNavId = null,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const avs = avatars || { avatar_a: null, avatar_b: null };
  const [level, setLevel] = useState(null);
  const [rank, setRank] = useState(null);

  const onXpStats = useCallback(s => {
    setLevel(s?.ready ? s.level : null);
  }, []);

  /* Real placement from the same RPC the leaderboard page uses. */
  useEffect(() => {
    if (!code) return undefined;
    let alive = true;
    getLeaderboard(50)
      .then(data => { if (alive) setRank(data?.me?.rank ?? null); })
      .catch(() => {});
    return () => { alive = false; };
  }, [code]);

  /* After navigating home for Games, scroll to the play shelf */
  useEffect(() => {
    const id = location.state?.scrollTo;
    if (!id) return undefined;
    const t = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      navigate('.', { replace: true, state: {} });
    }, 60);
    return () => window.clearTimeout(t);
  }, [location.state, navigate]);

  const goNav = it => {
    if (it.route) {
      if (it.route.includes('/arena') && code) {
        try { sessionStorage.setItem('duoarcade-home-duo', code); } catch { /* */ }
      }
      navigate(it.route);
      return;
    }
    if (it.scroll) {
      const onHome = location.pathname === '/app' || location.pathname === '/app/';
      if (onHome) {
        document.getElementById(it.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        navigate('/app', { state: { scrollTo: it.id } });
      }
      return;
    }
    navigate(`/app/place/${it.id}`);
  };

  const t = totalsOf(duo);
  const tastePct = duo.tasteTotal > 0 ? Math.round(100 * duo.tasteAgree / duo.tasteTotal) : 0;
  const hasPass = duo.passTier && duo.passTier !== 'free';

  return (
    <>
      {/* Identity + progression read as one block: who you are, then how far
          you have come together. */}
      {/* div, not section: arcade.scoped.css sets section{display:none} unless .on */}
      <div className="dcard dident">
        <div className="duo-head dident-who">
          <div className="duo-head-top">
            <div className="avatars">
              <div className={'av A' + (isAway?.('A') ? ' away' : '') + (avs.avatar_a ? ' av-char' : '')}>
                {avs.avatar_a
                  ? <Avatar id={avs.avatar_a} size={44} />
                  : (duo.nameA || '?')[0].toUpperCase()}
              </div>
              <div className={'av B' + (isAway?.('B') ? ' away' : '') + (avs.avatar_b ? ' av-char' : '')}>
                {avs.avatar_b
                  ? <Avatar id={avs.avatar_b} size={44} />
                  : (duo.nameB || '?')[0].toUpperCase()}
              </div>
              {!isAway?.('A') && !isAway?.('B') && <span className="av-spark" aria-hidden="true">{'❤'}</span>}
            </div>
            <div className="duo-head-id">
              <div className="duo-title h3">
                <span className="pA">{duo.nameA}</span>
                {' '}<span className="amp">&</span>{' '}
                <span className="pB">{duo.nameB}</span>
              </div>
              <div className="duo-badges">
                {hasPass && (
                  <div className="pass-badge">
                    <svg className="pass-badge-ico" viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
                      <path
                        fill="currentColor"
                        d="M12 2.8l2.4 6.2 6.6.5-5 4.3 1.6 6.4L12 16.6 6.4 20.2l1.6-6.4-5-4.3 6.6-.5L12 2.8z"
                      />
                    </svg>
                    <span>{duo.passTier === 'founding' ? 'Founding Duo' : 'Duo Pass'}</span>
                  </div>
                )}
                <XpTitlePill code={code} />
              </div>
            </div>
            <button type="button" className="duo-profile-btn" onClick={onBack}>
              <svg className="duo-profile-btn-ico" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="3.2" />
                <path d="M5.5 19.2c1.2-3.2 3.4-4.8 6.5-4.8s5.3 1.6 6.5 4.8" />
              </svg>
              <span>Profile</span>
            </button>
          </div>
        </div>

        <div className="dident-rank">
          <XpBar code={code} onStats={onXpStats} />
          <span className="dcard-rank-emblem" aria-hidden="true">
            <svg viewBox="0 0 64 64" width="58" height="58">
              <defs>
                <linearGradient id="gemg" x1="0" y1="0" x2="64" y2="64">
                  <stop stopColor="var(--p1)" />
                  <stop offset="1" stopColor="var(--p2)" />
                </linearGradient>
              </defs>
              <path d="M32 5 55 18v28L32 59 9 46V18Z" fill="url(#gemg)" opacity=".28" />
              <path d="M32 5 55 18v28L32 59 9 46V18Z" fill="none" stroke="url(#gemg)" strokeWidth="2" />
              <path d="M32 16 45 23.5v17L32 48 19 40.5v-17Z" fill="url(#gemg)" opacity=".7" />
              <path d="M32 16 45 23.5 32 31 19 23.5Z" fill="#fff" opacity=".22" />
            </svg>
            <span className="dcard-rank-emblem-label">
              {level ? `Level ${level}` : 'Level —'}
            </span>
          </span>
        </div>
      </div>

      <div className="home-stats">
        <div className="hstat hstat-1"><div className="n">{t.games}</div><div className="l">games together</div></div>
        <div className="hstat hstat-2"><div className="n">{duo.tasteTotal || 0}</div><div className="l">watched together</div></div>
        <div className="hstat hstat-3">
          <div className="n">{duo.tasteTotal > 0 ? tastePct + '%' : '—'}</div>
          <div className="l">taste match</div>
          <div className="taste-meter">
            <div className="taste-fill" style={{ width: (duo.tasteTotal > 0 ? tastePct : 0) + '%' }} />
            {duo.tasteTotal > 0 && tastePct > 4 && (
              <span className="taste-heart" aria-hidden="true" style={{ left: tastePct + '%' }}>{'❤'}</span>
            )}
          </div>
        </div>
        <div className="hstat hstat-4">
          <div className="n">{t.a === t.b ? 'tied' : (t.a > t.b ? duo.nameA : duo.nameB)}</div>
          <div className="l">
            {rank ? `overall rank #${rank}` : `overall · ${t.a}–${t.b}`}
          </div>
        </div>
      </div>

      <nav className="home-nav" aria-label="Quick sections">
        {HOME_NAV.map(it => {
          const Icon = Ico[it.icon];
          return (
            <button
              key={it.id}
              type="button"
              className={'home-nav-btn' + (activeNavId === it.id ? ' on' : '')}
              onClick={() => goNav(it)}
            >
              {Icon && <Icon size={16} />}
              <span>{it.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
