import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ENGINES } from '../engines/index.js';
import { downloadKeepsake, videoIdFrom } from '../lib/util.js';
import WhiteboardCard from './WhiteboardCard.jsx';
import SnapCard from './SnapCard.jsx';
import TodoShelf from './TodoShelf.jsx';
import WeekCard from './WeekCard.jsx';
import ChallengeHistory from './ChallengeHistory.jsx';
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
  onRedeem, onStartGame, onStartWatch, setHomeStatus,
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

  useEffect(() => {
    if (featureId === 'sect-play' || featureId === 'sect-favorites' || featureId === 'sect-together') {
      navigate('/app', { replace: true });
    }
  }, [featureId, navigate]);

  const focusWatch = () => {
    navigate('/app/place/sect-watch');
    setTimeout(() => document.getElementById('ytUrl')?.focus(), 120);
  };

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

  if (!meta || meta.openChat || meta.route) {
    return (
      <div className="home-feature-body">
        <div className="status">That place isn’t here — pick one from the rail or the nav above.</div>
      </div>
    );
  }

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

      {featureId === 'sect-list' && (
        <div id="sect-list" className="shelf-anchor">
          <TodoShelf code={code} myRole={myRole} duo={duo} />
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
        <>
          <div className="shelf-title" id="sect-watch">Movie night</div>
          <div className="watch-card">
            <h3>{'🎬'} Watch together</h3>
            <p>Paste a YouTube link. Playback syncs live between your two screens. Rate it blind afterwards; agreement feeds your taste match.</p>
            <input type="text" id="ytUrl" placeholder="https://youtube.com/watch?v=…"
              value={ytUrl} onChange={e => setYtUrl(e.target.value)} />
            <div className="row"><button className="btn warm small" onClick={startWatch}>Start watch party</button></div>
          </div>
        </>
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
