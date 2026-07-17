import { Link } from 'react-router-dom';
import SettingsMenu from '../arcade/SettingsMenu.jsx';

const GAMES = [
  { icon: '●▌', tint: 'p2', name: 'Duo Pong', desc: 'Real-time. First to 7. The ball speeds up — so do the arguments.', rec: 'live physics, no turns' },
  { icon: '🍀🍀', tint: 'candle', name: 'Memory Match', desc: 'Half the game is remembering what your partner revealed.', rec: 'find a pair, go again' },
  { icon: '⚫⚪', tint: 'p1', name: 'Reversi', desc: 'The deep one. Every disc you flip can flip back on you.', rec: 'for the quiet, scheming evenings' },
  { icon: '×○', tint: 'p1', name: 'Tic-Tac-Toe', desc: 'The two-minute warm-up. Settle who picks the movie.', rec: 'best-of-five friendly' },
  { icon: 'C4', tint: 'p2', name: 'Connect Four', desc: 'The flagship classic. Fast rounds, real depth, endless rematch energy.', rec: 'head-to-head record kept' },
  { icon: '□·□', tint: 'candle', name: 'Dots & Boxes', desc: 'Looks innocent. Turns quietly ruthless. Complete a box, go again.', rec: 'the sneaky one' }
];

const TINTS = {
  p1: { background: 'rgba(127,168,255,.12)', color: 'var(--p1)', border: '1px solid rgba(127,168,255,.33)' },
  p2: { background: 'rgba(255,127,168,.12)', color: 'var(--p2)', border: '1px solid rgba(255,127,168,.33)' },
  candle: { background: 'rgba(255,198,110,.12)', color: 'var(--candle)', border: '1px solid rgba(255,198,110,.33)' }
};

export default function Landing() {
  return (
    <div className="landing-page">
      <div className="wrap">
        <nav>
          <Link className="logo" to="/"><span className="a">Duo</span><span className="b">Arcade</span></Link>
          <div className="nav-right">
            <SettingsMenu />
            <Link className="btn warm" to="/app">Open the arcade</Link>
          </div>
        </nav>

        <div className="hero">
          <div className="half one">
            <div className="tag">Partner one</div>
            <h1>Your games.<br />Your streak.</h1>
            <p>Every match counts toward a history only you two share.</p>
          </div>
          <div className="half two">
            <div className="tag">Partner two</div>
            <h1>Your nights.<br />Your place.</h1>
            <p>Joins with one link, on a phone, mid-call. No signup, no app store.</p>
          </div>
          <div className="seam"></div>
          <div className="hero-connect" aria-hidden="true">
            <svg className="hc-svg" viewBox="0 0 230 60" preserveAspectRatio="none">
              <path className="hc-thread hc-left" d="M4 30 C 40 30, 62 22, 100 28" />
              <path className="hc-thread hc-right" d="M226 30 C 190 30, 168 38, 130 32" />
            </svg>
            <span className="hc-orb one" />
            <span className="hc-orb two" />
            <span className="hc-glow" />
            <span className="hc-heart">{'❤'}</span>
            <span className="hc-float f1">{'❤'}</span>
            <span className="hc-float f2">{'❤'}</span>
            <span className="hc-float f3">{'✦'}</span>
            <span className="hc-float f4">{'❤'}</span>
            <span className="hc-float f5">{'✦'}</span>
          </div>
          <div className="hero-cta">
            <Link className="btn warm" to="/app">Create your duo</Link>
            <span className="note">Free · no ads, ever · works in any browser</span>
          </div>
        </div>

        <div className="steps">
          <div className="step"><div className="n">STEP 1</div><h3>Name your duo</h3><p>You and one person — a partner, a best friend, a sibling. Two names, one shared home.</p></div>
          <div className="step"><div className="n">STEP 2</div><h3>Send one link</h3><p>They tap it and they're in. No account, no download. Works on any phone, mid-call.</p></div>
          <div className="step"><div className="n">STEP 3</div><h3>Build your record</h3><p>Wins, draws, evenings together — your history saves itself and waits for the rematch.</p></div>
        </div>

        <div className="section-head"><h2>The shelf tonight</h2><span>eleven games · more join regularly</span></div>
        <div className="games">
          {GAMES.map(g => (
            <div className="game" key={g.name}>
              <div className="thumb" style={TINTS[g.tint]}>{g.icon}</div>
              <h3>{g.name}</h3><p>{g.desc}</p>
              <div className="rec">{g.rec}</div>
            </div>
          ))}
        </div>

        <div className="promise">
          <div>
            <h2>Built for two. Not for feeds.</h2>
            <p>No ads, no strangers, no matchmaking. Just a small place on the internet that belongs to your duo — and remembers every evening you spend in it.</p>
          </div>
          <Link className="btn warm" to="/app">Start tonight</Link>
        </div>

        <footer>
          <div>DuoArcade — free while we build. Made for evenings.</div>
          <div>no stakes, no pots — money never depends on who wins</div>
        </footer>
      </div>
    </div>
  );
}
