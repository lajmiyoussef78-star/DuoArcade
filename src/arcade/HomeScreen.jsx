import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ENGINES } from '../engines/index.js';
import { artFor } from '../engines/art.js';
import { other, today, yesterday, totalsOf, loadSeats, SEAT_KEY, THEMES, downloadKeepsake, videoIdFrom } from '../lib/util.js';
import { Celebration, TogetherHero } from './CoupleFx.jsx';
import WhiteboardCard from './WhiteboardCard.jsx';
import SnapCard from './SnapCard.jsx';
import TodoShelf from './TodoShelf.jsx';
import WeekCard from './WeekCard.jsx';
import FeatureRail from './FeatureRail.jsx';

const MS_KEY = code => 'duoarcade-ms-' + code;

function favoriteGameId(duo) {
  let best = 'connect4', n = -1;
  for (const [id, r] of Object.entries(duo.records || {})) {
    const total = (r.a || 0) + (r.b || 0) + (r.d || 0);
    if (total > n && ENGINES[id]) { n = total; best = id; }
  }
  return best;
}
function closestGameId(duo) {
  let best = null, gap = 1e9;
  for (const [id, r] of Object.entries(duo.records || {})) {
    if (!ENGINES[id]) continue;
    const g = Math.abs((r.a || 0) - (r.b || 0));
    if (g < gap) { gap = g; best = id; }
  }
  return best || 'ttt';
}

export default function HomeScreen({
  duo, code, myRole, isAway, presence, geoStatus, homeStatus, setHomeStatus,
  onStartGame, onStartWatch, onBack, onSetTheme, onSetAnniversary, onRedeem
}) {
  const [mins, setMins] = useState(null);
  const [ytUrl, setYtUrl] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [passStatus, setPassStatus] = useState('');
  const [copied, setCopied] = useState(false);
  const [celebrate, setCelebrate] = useState(null);

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

  // both accounts linked: the server has burned the tokens, so the invite
  // link is dead — drop our stored copy and never show it again
  useEffect(() => {
    if (bothLinked && loadSeats()['invite-' + code]) {
      const s = loadSeats();
      delete s['invite-' + code];
      localStorage.setItem(SEAT_KEY, JSON.stringify(s));
    }
  }, [bothLinked, code]);

  const milestones = [];
  let nextShown = false;
  for (const m of [10, 25, 50, 100, 250]) {
    if (t.games >= m) milestones.push({ lit: true, text: `🏆 ${m} games together` });
    else if (!nextShown) { milestones.push({ lit: false, text: `${m} games · ${m - t.games} to go` }); nextShown = true; }
  }
  const w = duo.tasteTotal || 0;
  if (w >= 1) milestones.push({ lit: true, text: '🎬 First movie night' });
  for (const m of [25, 10]) {
    if (w >= m) { milestones.push({ lit: true, text: `🎬 ${m} movie nights` }); break; }
  }

  /* celebrate newly crossed game milestones (once per milestone, per device) */
  useEffect(() => {
    const reached = [10, 25, 50, 100, 250].filter(m => t.games >= m).pop() || 0;
    const seen = Number(localStorage.getItem(MS_KEY(code)) || 0);
    if (reached > seen) {
      localStorage.setItem(MS_KEY(code), String(reached));
      if (seen > 0) { // skip the very first visit so old duos aren't spammed
        setCelebrate({
          title: `${reached} games together`,
          sub: `${duo.nameA} & ${duo.nameB} — here's to many more evenings.`
        });
      }
    }
  }, [t.games, code, duo.nameA, duo.nameB]);

  const focusWatch = () => document.getElementById('ytUrl')?.focus();
  const plan = (() => {
    if (!mins) return null;
    const fav = ENGINES[favoriteGameId(duo)], close = ENGINES[closestGameId(duo)];
    if (mins === 30) return [
      ['Warm-up', 'Tic-Tac-Toe', 'Two quick rounds to settle in.', '5 min', () => onStartGame('ttt')],
      ['Main', fav.meta.name, 'Your most-played — the record is on the line.', '20 min', () => onStartGame(fav.meta.id)],
      ['Closer', close.meta.name, 'The tightest record you two have. One decider.', '5 min', () => onStartGame(close.meta.id)]
    ];
    if (mins === 60) return [
      ['Warm-up', fav.meta.name, 'Best of three in your favorite.', '15 min', () => onStartGame(fav.meta.id)],
      ['Main', 'Watch together', 'One episode-length video, synced.', '35 min', focusWatch],
      ['Closer', 'The Verdict', 'Rate it blind — the reveal feeds your taste match.', '10 min', focusWatch]
    ];
    return [
      ['Warm-up', 'Dots & Boxes', 'The sneaky one, while snacks are fetched.', '12 min', () => onStartGame('dots')],
      ['Main', 'Movie night', 'The full film, synced, reactions flying.', '70 min', focusWatch],
      ['Closer', 'The Verdict', 'Blind ratings, the reveal, one rematch if it’s a tie.', '8 min', focusWatch]
    ];
  })();

  const startWatch = () => {
    const vid = videoIdFrom(ytUrl.trim());
    if (!vid) { setHomeStatus('That doesn’t look like a YouTube link.'); return; }
    setHomeStatus('');
    onStartWatch(vid);
  };

  const redeem = async () => {
    try { await onRedeem(codeInput); setPassStatus(''); }
    catch (e) { setPassStatus(e.message); }
  };

  const copyInvite = async () => {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <section className="on">
      <FeatureRail />
      {celebrate && (
        <Celebration title={celebrate.title} sub={celebrate.sub}
          icon={celebrate.icon || '🏆'} onClose={() => setCelebrate(null)} />
      )}
      <div className="card">
        <div className="duo-head">
          <div className="avatars">
            <div className={'av A' + (isAway('A') ? ' away' : '')}>{(duo.nameA || '?')[0].toUpperCase()}</div>
            <div className={'av B' + (isAway('B') ? ' away' : '')}>{(duo.nameB || '?')[0].toUpperCase()}</div>
            {!isAway('A') && !isAway('B') && <span className="av-spark" aria-hidden="true">{'❤'}</span>}
          </div>
          <div style={{ flex: 1 }}>
            <div className="duo-title h3">{duo.nameA} <span className="amp">&</span> {duo.nameB}</div>
            <div className="duo-meta">{duo.evenings || 0} evenings together</div>
          </div>
          {hasPass && (
            <div className="pass-badge">
              {'✦ '}{duo.passTier === 'founding' ? 'Founding Duo' : 'Duo Pass'}
            </div>
          )}
          {cur > 1 && (
            <div className="streak-pill" style={{ display: 'inline-block', position: 'relative' }}>
              {'🔥 '}{cur}-evening streak{(duo.bestStreak || 0) > cur ? ` · best ${duo.bestStreak}` : ''}
              <span className="ember e1" aria-hidden="true" />
              <span className="ember e2" aria-hidden="true" />
              <span className="ember e3" aria-hidden="true" />
            </div>
          )}
          <button className="btn small ghost" onClick={onBack}>My duos</button>
        </div>

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
          <TogetherHero duo={duo} code={code} totals={t} myRole={myRole} presence={presence}
            geoStatus={geoStatus} onSetAnniversary={onSetAnniversary} />
        </div>

        <div className="milestones">
          {milestones.map((m, i) => (
            <div className={'ms' + (m.lit ? ' lit' : '')} key={i}
              title={m.lit ? 'Tap to relive it' : undefined}
              onClick={m.lit ? () => setCelebrate({
                title: m.text.replace(/^[^\w]*\s*/, ''),
                sub: `${duo.nameA} & ${duo.nameB} — you earned this one together.`,
                icon: m.text.includes('🎬') ? '🎬' : '🏆'
              }) : undefined}>
              {m.text}
            </div>
          ))}
        </div>

        <Link className="arena-entry" id="arena" to="/arena">
          <div className="arena-entry-pairs" aria-hidden="true">
            <span className="pair one"><i>{(duo.nameA || '?')[0]}</i><i>{(duo.nameB || '?')[0]}</i></span>
            <b>VS</b>
            <span className="pair two"><i>?</i><i>?</i></span>
          </div>
          <div className="arena-entry-copy">
            <span>Couple vs couple</span>
            <h3>Enter the 2v2 Arena</h3>
            <p>Challenge another duo or find rivals in public matchmaking.</p>
          </div>
          <strong className="arena-entry-arrow">→</strong>
        </Link>

        <div className="tonight" id="sect-tonight">
          <h3>{'🌕'} Tonight Engine</h3>
          <p>How long do you two have? One tap composes tonight from your own favorites.</p>
          <div className="time-row">
            {[[30, '30 minutes'], [60, '1 hour'], [90, 'Whole evening']].map(([m, label]) => (
              <button key={m} className={'time-btn' + (mins === m ? ' on' : '')} onClick={() => setMins(m)}>{label}</button>
            ))}
          </div>
          <div className="plan">
            {plan?.map((c, i) => (
              <div className="plan-card in" key={mins + '-' + i}
                style={{ transitionDelay: `${60 + i * 120}ms` }} onClick={c[4]}>
                <div className="plan-kind">{c[0]}</div><h4>{c[1]}</h4><p>{c[2]}</p>
                <div className="plan-min">{c[3]}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="shelf-title" id="sect-play">Play</div>
        <div className="shelf">
          {Object.values(ENGINES).map(eng => {
            const rec = (duo.records || {})[eng.meta.id] || { a: 0, b: 0, d: 0 };
            return (
              <div className="gcard" key={eng.meta.id} onClick={() => onStartGame(eng.meta.id)}
                style={{ position: 'relative', overflow: 'hidden', minHeight: 104 }}>
                {artFor(eng.meta.id) && (
                  <>
                    <div aria-hidden="true"
                      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
                      dangerouslySetInnerHTML={{ __html: artFor(eng.meta.id) }} />
                    <div aria-hidden="true"
                      style={{
                        position: 'absolute', inset: 0, pointerEvents: 'none',
                        background: 'linear-gradient(90deg, rgba(20,15,26,.82) 0%, rgba(20,15,26,.45) 55%, rgba(20,15,26,.12) 100%)'
                      }} />
                  </>
                )}
                <div className="gname" style={{ position: 'relative' }}>{eng.meta.name}</div>
                <div className="gtag" style={{ position: 'relative' }}>{eng.meta.tag}</div>
                <div className="grec" style={{ position: 'relative' }}>{rec.a}–{rec.b}{rec.d ? ' · ' + rec.d + ' draws' : ''}</div>
              </div>
            );
          })}
        </div>

        <div id="sect-wall" className="shelf-anchor">
          <WhiteboardCard code={code} />
        </div>

        <div id="sect-list" className="shelf-anchor">
          <TodoShelf code={code} myRole={myRole} duo={duo} />
        </div>

        <div id="sect-week" className="shelf-anchor">
          <WeekCard code={code} />
        </div>

        <div id="sect-snap" className="shelf-anchor">
          <SnapCard code={code} />
        </div>

        <div className="shelf-title" id="sect-watch">Movie night</div>
        <div className="watch-card">
          <h3>{'🎬'} Watch together</h3>
          <p>Paste a YouTube link. Playback syncs live between your two screens. Rate it blind afterwards; agreement feeds your taste match.</p>
          <input type="text" id="ytUrl" placeholder="https://youtube.com/watch?v=…"
            value={ytUrl} onChange={e => setYtUrl(e.target.value)} />
          <div className="row"><button className="btn warm small" onClick={startWatch}>Start watch party</button></div>
        </div>

        {!hasPass && (
          <div className="pass-card" id="sect-pass">
            <h3>{'✦'} Duo Pass</h3>
            <p>One Pass covers both of you: duo themes, keepsake cards, and everything we ship next. Founding duos keep it for life.</p>
            <div className="price-row">
              <div className="price-opt"><div className="amt">{'€'}3.99</div><div className="per">per month</div></div>
              <div className="price-opt"><div className="amt">{'€'}29</div><div className="per">per year</div><div className="tagl">2 months free</div></div>
              <div className="price-opt"><div className="amt">{'€'}29</div><div className="per">once {'·'} lifetime</div><div className="tagl">founding {'·'} first 100</div></div>
            </div>
            <div className="row">
              <button className="btn small"
                onClick={() => setPassStatus('Card payments open soon — founding codes are available now (ask us!).')}>
                Get Duo Pass
              </button>
              <button className="btn small ghost" onClick={() => setShowCode(v => !v)}>I have a code</button>
            </div>
            {showCode && (
              <div>
                <label htmlFor="codeInput">Founding code</label>
                <input type="text" id="codeInput" placeholder="FOUND-XXXXXXXX"
                  value={codeInput} onChange={e => setCodeInput(e.target.value)} />
                <div className="row"><button className="btn warm small" onClick={redeem}>Redeem</button></div>
              </div>
            )}
            <div className="status">{passStatus}</div>
          </div>
        )}

        {hasPass && (
          <div className="pass-card" id="sect-pass">
            <h3>{'✦'} Your Duo Pass</h3>
            <p>Duo theme — changes the colors of your whole place, for both of you:</p>
            <div className="theme-row">
              {Object.entries(THEMES).map(([name, th]) => (
                <button key={name}
                  className={'theme-dot' + ((duo.theme || 'night') === name ? ' on' : '')}
                  title={th.label}
                  style={{ background: `linear-gradient(135deg, ${th.p1} 50%, ${th.p2} 50%)` }}
                  onClick={() => onSetTheme(name)} />
              ))}
            </div>
            <div className="row">
              <button className="btn small" onClick={() => downloadKeepsake(duo)}>Download keepsake card</button>
            </div>
          </div>
        )}

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
