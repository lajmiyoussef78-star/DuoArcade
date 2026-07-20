import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import SettingsMenu from '../arcade/SettingsMenu.jsx';
import { createSync } from '../lib/sync.js';

const GAMES = [
  { tint: 'p1', name: 'Stickman Racing', desc: 'Split-screen neon parkour. First to the flag across ten tracks.', rec: 'real-time · turbo' },
  { tint: 'candle', name: 'Thin Ice', desc: 'Step carefully — every tile you leave sinks forever.', rec: 'strategy · one round' },
  { tint: 'p2', name: 'Minus One', desc: 'Rock-paper-scissors with a twist: keep one, drop one.', rec: 'quick duel' },
  { tint: 'p1', name: 'Micro Soccer', desc: 'Tiny cars, big chaos. Ninety seconds on the pitch.', rec: 'real-time · cars' },
  { tint: 'p2', name: 'Stickman Sword Duel', desc: 'Neon fighters. First to three rounds wins.', rec: 'real-time · combat' },
  { tint: 'candle', name: 'Connect Four', desc: 'The flagship classic. Fast rounds, real depth.', rec: 'head-to-head record' }
];

const FEATURES = [
  { title: 'Play shelf', body: 'Dozens of duo games — classics, parkour, bluffs, and co-op nights — with a shared win record.' },
  { title: 'Favorites', body: 'Star the games you both love. They float to the top for both of you.' },
  { title: 'Whiteboard & lists', body: 'Doodle for each other, keep a shared todo list, and plan the week together.' },
  { title: 'Snaps & movie night', body: 'Send little moments, then pick something to watch and rate it side by side.' }
];

const TINTS = {
  p1: { background: 'rgba(127,168,255,.12)', color: 'var(--p1)', border: '1px solid rgba(127,168,255,.33)' },
  p2: { background: 'rgba(255,127,168,.12)', color: 'var(--p2)', border: '1px solid rgba(255,127,168,.33)' },
  candle: { background: 'rgba(255,198,110,.12)', color: 'var(--candle)', border: '1px solid rgba(255,198,110,.33)' }
};

export default function Landing() {
  const [auth, setAuth] = useState('checking'); // checking | out | in

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sync = await createSync();
        if (!cancelled) setAuth(sync.auth.user() ? 'in' : 'out');
      } catch {
        if (!cancelled) setAuth('out');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (auth === 'checking') {
    return (
      <div className="landing-page">
        <div className="wrap" style={{ padding: '48px 22px', color: 'var(--dim)' }}>Loading…</div>
      </div>
    );
  }
  if (auth === 'in') return <Navigate to="/app" replace />;

  return (
    <div className="landing-page">
      <div className="wrap">
        <nav>
          <Link className="logo" to="/"><span className="a">Duo</span><span className="b">Arcade</span></Link>
          <div className="nav-right">
            <SettingsMenu />
            <Link className="btn ghost" to="/app">Sign in</Link>
            <Link className="btn warm" to="/app">Create account</Link>
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
            <p>Create a duo or join with an invite — then open the shelf whenever you both show up.</p>
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
            <Link className="btn warm" to="/app">Create account</Link>
            <Link className="btn" to="/app">Sign in</Link>
            <span className="note">Free · no ads · works in any browser</span>
          </div>
        </div>

        <div className="steps">
          <div className="step"><div className="n">STEP 1</div><h3>Create an account</h3><p>Email and a password — that’s it. Your duo and records stay tied to you.</p></div>
          <div className="step"><div className="n">STEP 2</div><h3>Create or join a duo</h3><p>Name your pair, or paste the invite link your partner sent. One duo per account.</p></div>
          <div className="step"><div className="n">STEP 3</div><h3>Play together</h3><p>Open the shelf, challenge each other, and build a streak that only the two of you keep.</p></div>
        </div>

        <div className="section-head"><h2>What you get</h2><span>more than a game list</span></div>
        <div className="features">
          {FEATURES.map(f => (
            <div className="feature" key={f.title}>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </div>
          ))}
        </div>

        <div className="section-head"><h2>On the shelf</h2><span>dozens of games · more join regularly</span></div>
        <div className="games">
          {GAMES.map(g => (
            <div className="game" key={g.name}>
              <div className="thumb" style={TINTS[g.tint]} aria-hidden="true" />
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
