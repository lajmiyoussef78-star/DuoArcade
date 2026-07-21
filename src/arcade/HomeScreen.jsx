import { useEffect, useState } from 'react';
import { ENGINES } from '../engines/index.js';
import { artFor } from '../engines/art.js';
import { other, today, yesterday, totalsOf, loadSeats, SEAT_KEY } from '../lib/util.js';
import { Celebration, TogetherHero } from './CoupleFx.jsx';
import FeatureRail from './FeatureRail.jsx';
import XpBar, { XpTitlePill } from './XpBar.jsx';
import ChallengeCard from './ChallengeCard.jsx';
import { Avatar } from './avatars.jsx';
import { getDuoAvatars } from '../lib/avatars.js';

const MS_KEY = code => 'duoarcade-ms-' + code;

export default function HomeScreen({
  duo, code, myRole, isAway, presence, geoStatus, homeStatus, setHomeStatus,
  onStartGame, onSetFavoriteGames, onSetAnniversary, onBack, avatarTick = 0,
}) {
  const [copied, setCopied] = useState(false);
  const [celebrate, setCelebrate] = useState(null);
  const [avs, setAvs] = useState({ avatar_a: null, avatar_b: null });

  useEffect(() => {
    if (!code) return undefined;
    let alive = true;
    getDuoAvatars(code)
      .then(data => { if (alive) setAvs(data || { avatar_a: null, avatar_b: null }); })
      .catch(() => {});
    return () => { alive = false; };
  }, [code, avatarTick]);

  const t = totalsOf(duo);
  const partnerRole = other(myRole);
  const partnerName = partnerRole === 'A' ? duo.nameA : duo.nameB;
  const partnerLinked = partnerRole === 'A' ? !!duo.memberA : !!duo.memberB;
  const onStreak = duo.lastDay === today() || duo.lastDay === yesterday();
  const cur = onStreak ? (duo.streak || 0) : 0;
  const tastePct = duo.tasteTotal > 0 ? Math.round(100 * duo.tasteAgree / duo.tasteTotal) : 0;
  const hasPass = duo.passTier && duo.passTier !== 'free';
  const bothLinked = !!duo.memberA && !!duo.memberB;
  const inviteToken = loadSeats()['invite-' + code];
  const inviteUrl = !bothLinked && inviteToken
    ? `${window.location.origin}${window.location.pathname}?duo=${code}&t=${inviteToken}` : null;

  useEffect(() => {
    if (bothLinked && loadSeats()['invite-' + code]) {
      const s = loadSeats();
      delete s['invite-' + code];
      localStorage.setItem(SEAT_KEY, JSON.stringify(s));
    }
  }, [bothLinked, code]);

  useEffect(() => {
    const reached = [10, 25, 50, 100, 250].filter(m => t.games >= m).pop() || 0;
    const seen = Number(localStorage.getItem(MS_KEY(code)) || 0);
    if (reached > seen) {
      localStorage.setItem(MS_KEY(code), String(reached));
      if (seen > 0) {
        setCelebrate({
          title: `${reached} games together`,
          sub: `${duo.nameA} & ${duo.nameB} — here's to many more evenings.`
        });
      }
    }
  }, [t.games, code, duo.nameA, duo.nameB]);

  const copyInvite = async () => {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <section className="on">
      <FeatureRail activeFeature={null} />
      {celebrate && (
        <Celebration title={celebrate.title} sub={celebrate.sub}
          icon={celebrate.icon || '🏆'} onClose={() => setCelebrate(null)} />
      )}
      <div className="card">
        <div className="duo-head">
          <div className="duo-head-top">
            <div className="avatars">
              <div className={'av A' + (isAway('A') ? ' away' : '') + (avs.avatar_a ? ' av-char' : '')}>
                {avs.avatar_a
                  ? <Avatar id={avs.avatar_a} size={44} />
                  : (duo.nameA || '?')[0].toUpperCase()}
              </div>
              <div className={'av B' + (isAway('B') ? ' away' : '') + (avs.avatar_b ? ' av-char' : '')}>
                {avs.avatar_b
                  ? <Avatar id={avs.avatar_b} size={44} />
                  : (duo.nameB || '?')[0].toUpperCase()}
              </div>
              {!isAway('A') && !isAway('B') && <span className="av-spark" aria-hidden="true">{'❤'}</span>}
            </div>
            <div className="duo-title h3">
              <span className="pA">{duo.nameA}</span>
              {' '}<span className="amp">&</span>{' '}
              <span className="pB">{duo.nameB}</span>
            </div>
            <button className="btn small ghost" onClick={onBack}>Profile</button>
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

        <div className="shelf-title" id="sect-favorites">Favorites</div>
        {(Array.isArray(duo.favoriteGames) ? duo.favoriteGames : []).filter(id => ENGINES[id]).length > 0 ? (
          <div className="shelf shelf-favs">
            {(duo.favoriteGames || []).filter(id => ENGINES[id]).map(id => {
              const eng = ENGINES[id];
              const rec = (duo.records || {})[id] || { a: 0, b: 0, d: 0 };
              return (
                <div className="gcard gcard-fav-active" key={'fav-' + id}
                  onClick={() => onStartGame(id)}
                  style={{ position: 'relative', overflow: 'hidden', minHeight: 104 }}>
                  {artFor(id) && (
                    <>
                      <div className="gcard-art" aria-hidden="true"
                        dangerouslySetInnerHTML={{ __html: artFor(id) }} />
                      <div className="gcard-veil" aria-hidden="true" />
                    </>
                  )}
                  <div className="gname" style={{ position: 'relative' }}>{eng.meta.name}</div>
                  <div className="gtag" style={{ position: 'relative' }}>{eng.meta.tag}</div>
                  <div className="grec" style={{ position: 'relative' }}>{rec.a}–{rec.b}{rec.d ? ' · ' + rec.d + ' draws' : ''}</div>
                  <button
                    type="button"
                    className="gcard-fav on"
                    aria-label="Remove from favorites"
                    title="Remove from favorites"
                    onClick={e => {
                      e.stopPropagation();
                      const next = (duo.favoriteGames || []).filter(x => x !== id);
                      onSetFavoriteGames?.(next);
                    }}
                  >★</button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="shelf-favs-empty">Tap ★ on a game below to move it here — shared for both of you.</p>
        )}

        <div className="shelf-title" id="sect-play">Play</div>
        <div className="shelf">
          {Object.values(ENGINES)
            .filter(eng => !(duo.favoriteGames || []).includes(eng.meta.id))
            .map(eng => {
              const rec = (duo.records || {})[eng.meta.id] || { a: 0, b: 0, d: 0 };
              return (
                <div className="gcard" key={eng.meta.id}
                  onClick={() => onStartGame(eng.meta.id)}
                  style={{ position: 'relative', overflow: 'hidden', minHeight: 104 }}>
                  {artFor(eng.meta.id) && (
                    <>
                      <div className="gcard-art" aria-hidden="true"
                        dangerouslySetInnerHTML={{ __html: artFor(eng.meta.id) }} />
                      <div className="gcard-veil" aria-hidden="true" />
                    </>
                  )}
                  <div className="gname" style={{ position: 'relative' }}>{eng.meta.name}</div>
                  <div className="gtag" style={{ position: 'relative' }}>{eng.meta.tag}</div>
                  <div className="grec" style={{ position: 'relative' }}>{rec.a}–{rec.b}{rec.d ? ' · ' + rec.d + ' draws' : ''}</div>
                  <button
                    type="button"
                    className="gcard-fav"
                    aria-label="Add to favorites"
                    title="Add to favorites"
                    onClick={e => {
                      e.stopPropagation();
                      const cur = Array.isArray(duo.favoriteGames) ? duo.favoriteGames : [];
                      onSetFavoriteGames?.([...cur, eng.meta.id]);
                    }}
                  >☆</button>
                </div>
              );
            })}
        </div>

        <ChallengeCard />

        {myRole === 'A' && inviteUrl && (
          <div className="invite-box" style={{ width: '100%', marginTop: 14 }}>
            <div className="share">{inviteUrl}</div>
            <div className="row">
              <button className="btn small" onClick={copyInvite}>{copied ? 'Copied!' : 'Copy invite link'}</button>
            </div>
          </div>
        )}
        <div className="status">
          {!partnerLinked
            ? `⚠ ${partnerName} hasn’t opened the invite link while signed in yet — invitations only reach them while they have this duo open. Send them the invite link below once.`
            : homeStatus}
        </div>
      </div>
    </section>
  );
}
