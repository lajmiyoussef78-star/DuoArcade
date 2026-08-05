import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ENGINES } from '../engines/index.js';
import { downloadKeepsake, videoIdFrom } from '../lib/util.js';
import { listMovieNights } from '../lib/watchMovie.js';
import WhiteboardCard from './WhiteboardCard.jsx';
import SavedWhiteboards from './SavedWhiteboards.jsx';
import SnapCard from './SnapCard.jsx';
import TodoShelf from './TodoShelf.jsx';
import WeekCard from './WeekCard.jsx';
import ChallengeHistory from './ChallengeHistory.jsx';
import BucketListCard from './BucketListCard.jsx';
import SettingsScreen from './SettingsScreen.jsx';
import { featureRailItem } from './featureRailItems.js';

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

/** Feature body only — chrome lives in DuoHomeLayout so XP bar stays mounted. */
export default function PlaceScreen({
  duo, code, myRole,
  onRedeem, onStartGame, onStartWatch, onStartReels, onStartMovie, onStartStreaming,
  setHomeStatus,
  theme, onSetTheme, onSignOut, onDeleteDuo, onAvatarChange,
  username = '', email = '', onSetUsername = null,
}) {
  const { featureId } = useParams();
  const navigate = useNavigate();
  const meta = featureRailItem(featureId);
  const hasPass = duo.passTier && duo.passTier !== 'free';

  const [mins, setMins] = useState(null);
  const [ytUrl, setYtUrl] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [passStatus, setPassStatus] = useState('');
  const [localStatus, setLocalStatus] = useState('');
  const [hubMode, setHubMode] = useState(null); // null | youtube | streaming | reels | movie
  const [continuity, setContinuity] = useState([]);
  const [coachDismissed, setCoachDismissed] = useState(
    () => localStorage.getItem('wp-hub-coach') === '1'
  );

  useEffect(() => {
    if (featureId === 'sect-play' || featureId === 'sect-favorites' || featureId === 'sect-together') {
      navigate('/app', { replace: true });
    }
  }, [featureId, navigate]);

  useEffect(() => {
    if (featureId !== 'sect-watch' || !code) return;
    listMovieNights(code).then(rows => setContinuity((rows || []).slice(0, 3))).catch(() => {});
  }, [featureId, code]);

  if (featureId === 'sect-settings') {
    return (
      <SettingsScreen
        duo={duo}
        code={code}
        myRole={myRole}
        nameA={duo?.nameA}
        nameB={duo?.nameB}
        theme={theme}
        onSetTheme={onSetTheme}
        canSetTheme={!!(duo && onSetTheme)}
        onSignOut={onSignOut}
        onDeleteDuo={onDeleteDuo}
        onAvatarChange={onAvatarChange}
        username={username}
        email={email}
        onSetUsername={onSetUsername}
      />
    );
  }

  const focusWatch = () => {
    navigate('/app/place/sect-watch');
    setHubMode('youtube');
    setTimeout(() => document.getElementById('ytUrl')?.focus(), 120);
  };

  const plan = (() => {
    if (!mins) return null;
    const fav = ENGINES[favoriteGameId(duo)], close = ENGINES[closestGameId(duo)];
    if (mins === 30) return [
      ['Warm-up', 'Ultimate Tic-Tac-Toe', 'Nine boards — play anywhere, claim the big grid.', '10 min', () => onStartGame('ttt')],
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
    if (!vid) {
      const msg = 'That doesn’t look like a YouTube link.';
      setLocalStatus(msg);
      setHomeStatus?.(msg);
      return;
    }
    setLocalStatus('');
    setHomeStatus?.('');
    onStartWatch(vid);
  };

  const redeem = async () => {
    try { await onRedeem(codeInput); setPassStatus(''); }
    catch (e) { setPassStatus(e.message); }
  };

  const dismissCoach = () => {
    localStorage.setItem('wp-hub-coach', '1');
    setCoachDismissed(true);
  };

  if (!meta || meta.openChat || meta.route) {
    return (
      <div className="home-feature-body">
        <div className="status">That place isn’t here — pick one from the rail or the nav above.</div>
      </div>
    );
  }

  const nameA = duo.nameA || 'You';
  const nameB = duo.nameB || 'Partner';

  return (
    <div className="home-feature-body">
      {featureId === 'sect-challenge-history' && (
        <div id="sect-challenge-history" className="shelf-anchor">
          <ChallengeHistory code={code} myRole={myRole} />
        </div>
      )}

      {featureId === 'sect-tonight' && (
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
      )}

      {featureId === 'sect-wall' && (
        <div id="sect-wall" className="shelf-anchor">
          <WhiteboardCard code={code} />
        </div>
      )}

      {featureId === 'sect-saved-boards' && (
        <div id="sect-saved-boards" className="shelf-anchor">
          <SavedWhiteboards
            code={code}
            myRole={myRole}
            username={username}
          />
        </div>
      )}

      {featureId === 'sect-list' && (
        <div id="sect-list" className="shelf-anchor">
          <TodoShelf code={code} myRole={myRole} duo={duo} />
        </div>
      )}

      {featureId === 'sect-bucket' && (
        <div id="sect-bucket" className="shelf-anchor">
          <BucketListCard code={code} myRole={myRole} duo={duo} />
        </div>
      )}

      {featureId === 'sect-week' && (
        <div id="sect-week" className="shelf-anchor">
          <WeekCard code={code} />
        </div>
      )}

      {featureId === 'sect-snap' && (
        <div id="sect-snap" className="shelf-anchor">
          <SnapCard code={code} />
        </div>
      )}

      {featureId === 'sect-watch' && (
        <div className="wp-hub" id="sect-watch">
          <div className="shelf-title">Tonight’s vibe</div>
          <div className="wp-hub-avatars" aria-hidden="true">
            <span className="wp-hub-av A">{nameA[0]?.toUpperCase()}</span>
            <span className="wp-hub-heart">✦</span>
            <span className="wp-hub-av B">{nameB[0]?.toUpperCase()}</span>
          </div>
          <p className="wp-hub-lead">Dim the lights. Whatever you pick, you’re in your duo room.</p>

          <ol className="wp-steps" aria-label="How a watch party works">
            <li><span className="wp-step-n">1</span> Create a room</li>
            <li><span className="wp-step-n">2</span> Invite your partner</li>
            <li><span className="wp-step-n">3</span> Watch in sync</li>
          </ol>

          {!coachDismissed && (
            <div className="wp-hub-coach">
              <p>No stranger rooms, no codes — just you two.</p>
              <button type="button" className="btn ghost small" onClick={dismissCoach}>Got it</button>
            </div>
          )}

          {continuity.length > 0 && (
            <div className="wp-continuity">
              <div className="wp-continuity-label">Continue our night</div>
              {continuity.map(n => (
                <button
                  key={n.id}
                  type="button"
                  className="wp-continuity-row"
                  onClick={() => onStartMovie?.({
                    resume: true,
                    fingerprint: n.fingerprint,
                    title: n.title,
                    sizeLabel: n.size_label,
                    position: n.position || 0,
                    nightId: n.id,
                  })}
                >
                  <span>{n.title || 'Film'}</span>
                  <span className="wp-muted">{fmtPos(n.position)}</span>
                </button>
              ))}
            </div>
          )}

          {!hubMode && (
            <div className="wp-hub-cards wp-hub-cards-4">
              <button type="button" className="wp-hub-card" onClick={() => setHubMode('youtube')}>
                <div className="wp-hub-card-kicker">Watch a video</div>
                <h3>YouTube Night</h3>
                <p>Paste a link. Playback syncs live. Rate it blind after.</p>
              </button>
              <button type="button" className="wp-hub-card" onClick={() => setHubMode('streaming')}>
                <div className="wp-hub-card-kicker">Streaming</div>
                <h3>Streaming Services</h3>
                <p>Netflix · Disney+ · Max · Prime — start together on your own accounts.</p>
              </button>
              <button type="button" className="wp-hub-card" onClick={() => onStartReels?.()}>
                <div className="wp-hub-card-kicker">Shorts</div>
                <h3>Reels Party</h3>
                <p>Queue Shorts, swipe together, twin-taste likes.</p>
              </button>
              <button type="button" className="wp-hub-card" onClick={() => onStartMovie?.()}>
                <div className="wp-hub-card-kicker">Film</div>
                <h3>Movie Night</h3>
                <p>Same file on both devices — cozy sync & whispers.</p>
              </button>
            </div>
          )}

          {hubMode === 'youtube' && (
            <div className="watch-card">
              <button type="button" className="btn ghost small" onClick={() => setHubMode(null)}>{'←'} Hub</button>
              <h3>YouTube Night</h3>
              <p>Paste a YouTube link. Playback syncs live. Turn on Sparks when you want mind-reads.</p>
              <input type="text" id="ytUrl" placeholder="https://youtube.com/watch?v=…"
                value={ytUrl} onChange={e => setYtUrl(e.target.value)} />
              <div className="row"><button className="btn warm small" onClick={startWatch}>Start watch party</button></div>
            </div>
          )}

          {hubMode === 'streaming' && (
            <div className="watch-card wp-streaming-pick">
              <button type="button" className="btn ghost small" onClick={() => setHubMode(null)}>{'←'} Hub</button>
              <h3>Streaming Services</h3>
              <p className="wp-streaming-honest">
                What are we watching tonight? Playback stays in Netflix, Disney+, Max, or Prime on your own subscriptions.
                DuoArcade is the couple layer — ready ritual, reactions, Sparks, Memory.
              </p>
              <div className="wp-streaming-platforms">
                {[
                  { id: 'netflix', label: 'Netflix', brand: '#E50914' },
                  { id: 'disney_plus', label: 'Disney+', brand: '#3B82F6' },
                  { id: 'max', label: 'Max', brand: '#7B2BF9' },
                  { id: 'prime_video', label: 'Prime Video', brand: '#00A8E1' },
                ].map(p => (
                  <button
                    key={p.id}
                    type="button"
                    className="wp-plat"
                    style={{ '--brand': p.brand }}
                    onClick={() => onStartStreaming?.({ platform: p.id })}
                  >
                    <span className="wp-plat-mark" aria-hidden="true">{p.label[0]}</span>
                    <span className="wp-plat-label">{p.label}</span>
                    <span className="wp-plat-go" aria-hidden="true">Start together</span>
                  </button>
                ))}
              </div>
              <p className="wp-hint">Coordination mode tonight. Deeper sync needs the DuoArcade extension (desktop).</p>
            </div>
          )}
        </div>
      )}

      {featureId === 'sect-pass' && !hasPass && (
        <div className="pass-card" id="sect-pass">
          <h3>{'✦'} Duo Pass</h3>
          <p>One Pass covers both of you: keepsake cards, and everything we ship next. Founding duos keep it for life.</p>
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

      {featureId === 'sect-pass' && hasPass && (
        <div className="pass-card" id="sect-pass">
          <h3>{'✦'} Your Duo Pass</h3>
          <p>Thank you for supporting DuoArcade. Download a keepsake of your shared record anytime.</p>
          <div className="row">
            <button className="btn small" onClick={() => downloadKeepsake(duo)}>Download keepsake card</button>
          </div>
        </div>
      )}

      {localStatus && <div className="status">{localStatus}</div>}
    </div>
  );
}

function fmtPos(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}
