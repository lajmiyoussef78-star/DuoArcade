import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { today, yesterday, totalsOf } from '../lib/util.js';
import { TogetherHero } from './CoupleFx.jsx';
import XpBar, { XpTitlePill } from './XpBar.jsx';
import { Avatar } from './avatars.jsx';
import { getDuoAvatars } from '../lib/avatars.js';

/* Quick section links — same destinations the feature rail uses */
export const HOME_NAV = [
  { id: 'sect-play', label: 'Games', scroll: true },
  { id: 'sect-watch', label: 'WatchParty' },
  { id: 'sect-week', label: 'Timetable' },
  { id: 'sect-snap', label: 'DuoSnap' },
  { id: 'sect-list', label: 'TodoList' },
  { id: 'arena', label: '2v2 Arena', route: '/arena' },
  { id: 'sect-wall', label: 'Whiteboard' },
];

/**
 * Shared top composition for home + place pages.
 * Returns a fragment so `.home-card > .duo-head` grid rules still apply.
 */
export default function DuoHomeChrome({
  duo, code, myRole, isAway, presence, geoStatus,
  onSetAnniversary, onBack, avatarTick = 0, activeNavId = null,
}) {
  const [avs, setAvs] = useState({ avatar_a: null, avatar_b: null });
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!code) return undefined;
    let alive = true;
    getDuoAvatars(code)
      .then(data => { if (alive) setAvs(data || { avatar_a: null, avatar_b: null }); })
      .catch(() => {});
    return () => { alive = false; };
  }, [code, avatarTick]);

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
    if (it.route) { navigate(it.route); return; }
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
  const onStreak = duo.lastDay === today() || duo.lastDay === yesterday();
  const cur = onStreak ? (duo.streak || 0) : 0;
  const tastePct = duo.tasteTotal > 0 ? Math.round(100 * duo.tasteAgree / duo.tasteTotal) : 0;
  const hasPass = duo.passTier && duo.passTier !== 'free';

  return (
    <>
      <div className="duo-head">
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
          <div className="duo-title h3">
            <span className="pA">{duo.nameA}</span>
            {' '}<span className="amp">&</span>{' '}
            <span className="pB">{duo.nameB}</span>
          </div>
          <button type="button" className="duo-profile-btn" onClick={onBack}>
            <svg className="duo-profile-btn-ico" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="3.2" />
              <path d="M5.5 19.2c1.2-3.2 3.4-4.8 6.5-4.8s5.3 1.6 6.5 4.8" />
            </svg>
            <span>Profile</span>
          </button>
        </div>
        <div className="duo-badges">
          {hasPass && (
            <div className="pass-badge">
              {'✦ '}{duo.passTier === 'founding' ? 'Founding Duo' : 'Duo Pass'}
            </div>
          )}
          <XpTitlePill code={code} />
          {cur > 1 && (
            <div
              className="streak-pill streak-pill-compact"
              style={{ display: 'inline-flex', position: 'relative' }}
              title={`${cur}-evening streak${(duo.bestStreak || 0) > cur ? ` · best ${duo.bestStreak}` : ''}`}
            >
              <svg className="streak-flame" viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M12 2c1.2 3.2-.2 5.2-1.6 6.6C8.8 10.2 8 11.4 8 13.2 8 16.1 10.1 18 12.6 18c2.3 0 4.4-1.7 4.4-4.2 0-1.7-.7-2.9-1.6-4 .9 2 .6 3.4.6 3.4C18.2 10.5 19 8.2 16.5 5.4 15.2 4 13.6 2.8 12 2zm-1.1 16.8c-2.6-.4-4.4-2.5-4.4-5 0-1.5.6-2.7 1.5-3.8-.2 2.2.6 3.3 1.5 3.9.8.5 1.4 1.2 1.4 2.2 0 1.1-.7 2.1-2 2.7z"
                />
              </svg>
              <span className="streak-n">{cur}</span>
              <span className="ember e1" aria-hidden="true" />
              <span className="ember e2" aria-hidden="true" />
              <span className="ember e3" aria-hidden="true" />
            </div>
          )}
        </div>
      </div>

      <XpBar code={code} />

      <div className="home-stats">
        <div className="hstat"><div className="n">{t.games}</div><div className="l">games together</div></div>
        <div className="hstat"><div className="n">{duo.tasteTotal || 0}</div><div className="l">watched together</div></div>
        <div className="hstat">
          <div className="n">{duo.tasteTotal > 0 ? tastePct + '%' : '—'}</div>
          <div className="l">taste match</div>
          <div className="taste-meter">
            <div className="taste-fill" style={{ width: (duo.tasteTotal > 0 ? tastePct : 0) + '%' }} />
            {duo.tasteTotal > 0 && tastePct > 4 && (
              <span className="taste-heart" aria-hidden="true" style={{ left: tastePct + '%' }}>{'❤'}</span>
            )}
          </div>
        </div>
        <div className="hstat">
          <div className="n">{t.a === t.b ? 'tied' : (t.a > t.b ? duo.nameA : duo.nameB)}</div>
          <div className="l">overall · {t.a}–{t.b}</div>
        </div>
      </div>

      <div id="sect-together" style={{ width: '100%' }}>
        <TogetherHero duo={duo} code={code} myRole={myRole} presence={presence}
          geoStatus={geoStatus} onSetAnniversary={onSetAnniversary} />
      </div>

      <nav className="home-nav" aria-label="Quick sections">
        {HOME_NAV.map(it => (
          <button
            key={it.id}
            type="button"
            className={'home-nav-btn' + (activeNavId === it.id ? ' on' : '')}
            onClick={() => goNav(it)}
          >
            {it.label}
          </button>
        ))}
      </nav>
    </>
  );
}
