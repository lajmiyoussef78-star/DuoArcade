import { useState } from 'react';
import { ENGINES } from '../engines/index.js';
import { artFor } from '../engines/art.js';
import { other, today, yesterday, totalsOf, loadSeats, THEMES, downloadKeepsake, videoIdFrom } from '../lib/util.js';

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
  duo, code, myRole, isAway, homeStatus, setHomeStatus,
  onStartGame, onStartWatch, onBack, onSetTheme, onRedeem
}) {
  const [mins, setMins] = useState(null);
  const [ytUrl, setYtUrl] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [passStatus, setPassStatus] = useState('');
  const [copied, setCopied] = useState(false);

  const t = totalsOf(duo);
  const partnerRole = other(myRole);
  const partnerName = partnerRole === 'A' ? duo.nameA : duo.nameB;
  const partnerLinked = partnerRole === 'A' ? !!duo.memberA : !!duo.memberB;
  const onStreak = duo.lastDay === today() || duo.lastDay === yesterday();
  const cur = onStreak ? (duo.streak || 0) : 0;
  const tastePct = duo.tasteTotal > 0 ? Math.round(100 * duo.tasteAgree / duo.tasteTotal) : 0;
  const hasPass = duo.passTier && duo.passTier !== 'free';
  const since = duo.createdAt
    ? ' · a duo since ' + new Date(duo.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : '';
  const inviteToken = loadSeats()['invite-' + code];
  const inviteUrl = inviteToken
    ? `${window.location.origin}${window.location.pathname}?duo=${code}&t=${inviteToken}` : null;

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
      <div className="card">
        <div className="duo-head">
          <div className="avatars">
            <div className={'av A' + (isAway('A') ? ' away' : '')}>{(duo.nameA || '?')[0].toUpperCase()}</div>
            <div className={'av B' + (isAway('B') ? ' away' : '')}>{(duo.nameB || '?')[0].toUpperCase()}</div>
          </div>
          <div style={{ flex: 1 }}>
            <div className="duo-title h3">{duo.nameA} <span className="amp">&</span> {duo.nameB}</div>
            <div className="duo-meta">{duo.evenings || 0} evenings together{since}</div>
          </div>
          {hasPass && (
            <div className="pass-badge">
              {'✦ '}{duo.passTier === 'founding' ? 'Founding Duo' : 'Duo Pass'}
            </div>
          )}
          {cur > 1 && (
            <div className="streak-pill" style={{ display: 'inline-block' }}>
              {'🔥 '}{cur}-evening streak{(duo.bestStreak || 0) > cur ? ` · best ${duo.bestStreak}` : ''}
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
            <div className="taste-meter"><div className="taste-fill" style={{ width: (duo.tasteTotal > 0 ? tastePct : 0) + '%' }} /></div>
          </div>
          <div className="hstat">
            <div className="n">{t.a === t.b ? 'tied' : (t.a > t.b ? duo.nameA : duo.nameB)}</div>
            <div className="l">overall · {t.a}–{t.b}</div>
          </div>
        </div>

        <div className="milestones">
          {milestones.map((m, i) => <div className={'ms' + (m.lit ? ' lit' : '')} key={i}>{m.text}</div>)}
        </div>

        <div className="tonight">
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

        <div className="shelf-title">Play</div>
        <div className="shelf">
          {Object.values(ENGINES).map(eng => {
            const rec = (duo.records || {})[eng.meta.id] || { a: 0, b: 0, d: 0 };
            return (
              <div className="gcard" key={eng.meta.id} onClick={() => onStartGame(eng.meta.id)}
                style={{ position: 'relative', overflow: 'hidden' }}>
                {artFor(eng.meta.id) && (
                  <div aria-hidden="true"
                    style={{
                      position: 'absolute', right: -12, top: '50%',
                      transform: 'translateY(-50%)', width: 96, height: 96,
                      opacity: 0.5, pointerEvents: 'none',
                      maskImage: 'linear-gradient(90deg, transparent, black 40%)',
                      WebkitMaskImage: 'linear-gradient(90deg, transparent, black 40%)'
                    }}
                    dangerouslySetInnerHTML={{ __html: artFor(eng.meta.id) }} />
                )}
                <div className="gname" style={{ position: 'relative' }}>{eng.meta.name}</div>
                <div className="gtag" style={{ position: 'relative' }}>{eng.meta.tag}</div>
                <div className="grec" style={{ position: 'relative' }}>{rec.a}–{rec.b}{rec.d ? ' · ' + rec.d + ' draws' : ''}</div>
              </div>
            );
          })}
        </div>

        <div className="shelf-title">Movie night</div>
        <div className="watch-card">
          <h3>{'🎬'} Watch together</h3>
          <p>Paste a YouTube link — playback syncs live between your two screens. Rate it blind afterwards; agreement feeds your taste match.</p>
          <input type="text" id="ytUrl" placeholder="https://youtube.com/watch?v=…"
            value={ytUrl} onChange={e => setYtUrl(e.target.value)} />
          <div className="row"><button className="btn warm small" onClick={startWatch}>Start watch party</button></div>
        </div>

        {!hasPass && (
          <div className="pass-card">
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
          <div className="pass-card">
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
