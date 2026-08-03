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

const TINTS = {
  p1: { background: 'rgba(127,168,255,.12)', color: 'var(--p1)', border: '1px solid rgba(127,168,255,.33)' },
  p2: { background: 'rgba(255,127,168,.12)', color: 'var(--p2)', border: '1px solid rgba(255,127,168,.33)' },
  candle: { background: 'rgba(255,198,110,.12)', color: 'var(--candle)', border: '1px solid rgba(255,198,110,.33)' }
};

const PILLARS = [
  {
    id: 'play',
    title: 'Play Together',
    body: 'Hundreds of games to enjoy with your partner.',
    tone: 'violet',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="7" width="18" height="11" rx="4" />
        <path d="M8 11v3M6.5 12.5h3" />
        <circle cx="16" cy="11.4" r="0.8" fill="currentColor" stroke="none" />
        <circle cx="18" cy="13.4" r="0.8" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    id: 'watch',
    title: 'Watch Together',
    body: 'Sync your favorite shows and movies.',
    tone: 'pink',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5" width="18" height="14" rx="3.5" />
        <path d="M10 9.5 14.5 12 10 14.5v-5Z" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    id: 'grow',
    title: 'Grow Together',
    body: 'Complete challenges and build your bond.',
    tone: 'cyan',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="8" r="3" />
        <circle cx="16" cy="9" r="2.5" />
        <path d="M3.5 18.5c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5" />
        <path d="M14 14c2.2.2 3.9 1.4 4.5 4.5" />
      </svg>
    ),
  },
  {
    id: 'forever',
    title: 'Forever Together',
    body: 'Track your journey and cherish every moment.',
    tone: 'rose',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />
      </svg>
    ),
  },
];

const NEED_ITEMS = [
  'Real-time game sync',
  'Watch parties with chat',
  'Couple challenges & quests',
  'Shared lists and planning',
  'Private rooms & invites',
  'Your relationship journey',
];

const TRUST_AVATARS = ['#8B5CF6', '#EC4899', '#34D399', '#F59E0B', '#38BDF8', '#F472B6'];

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
        <nav className="lp-nav" aria-label="Primary">
          <Link className="logo" to="/">
            <span className="logo-mark" aria-hidden="true">
              <svg viewBox="0 0 32 32" width="28" height="28" fill="none">
                <rect x="1.5" y="1.5" width="29" height="29" rx="9" fill="url(#lpLogoFill)" />
                <path d="M10.5 21V11h3.4a5 5 0 0 1 0 10h-3.4Z" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
                <circle cx="21.6" cy="13.2" r="1.6" fill="#34D399" />
                <circle cx="21.6" cy="18.8" r="1.6" fill="#EC4899" />
                <defs>
                  <linearGradient id="lpLogoFill" x1="0" y1="0" x2="32" y2="32">
                    <stop stopColor="#8B5CF6" stopOpacity=".55" />
                    <stop offset="1" stopColor="#EC4899" stopOpacity=".35" />
                  </linearGradient>
                </defs>
              </svg>
            </span>
            <span className="a">Duo</span><span className="b">Arcade</span>
          </Link>
          <div className="nav-links">
            <a href="#features">Features</a>
            <a href="#games">Games</a>
            <a href="#watch">Watch Party</a>
            <a href="#blog">Blog</a>
            <a href="#about">About</a>
          </div>
          <div className="nav-right">
            <SettingsMenu />
            <Link className="btn ghost nav-login" to="/app">Login</Link>
            <Link className="btn nav-signup" to="/app">Sign up</Link>
          </div>
        </nav>

        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="hero-eyebrow">
              <span className="hero-eyebrow-ico" aria-hidden="true">✦</span>
              Play Together. <em>Watch Together.</em> Grow Together.
            </p>
            <h1 id="hero-title">
              The game home for{' '}
              <span className="hero-grad">
                you two.
                <span className="hero-heart" aria-hidden="true">♥</span>
              </span>
            </h1>
            <p className="hero-sub">
              Play games, watch movies, complete challenges and create unforgettable memories together.
            </p>
            <div className="hero-actions">
              <Link className="btn nav-signup" to="/app">Get Started</Link>
              <a className="btn ghost hero-ghost" href="#features">See Features</a>
            </div>
          </div>

          <div className="hero-visual" aria-hidden="true">
            <div className="hero-desk">
              <div className="hero-desk-screen">
                <img
                  className="hero-desk-img"
                  src="/landing/dashboard-home.png"
                  alt=""
                  width={1280}
                  height={800}
                  decoding="async"
                />
              </div>
              <div className="hero-desk-base" />
            </div>
            <div className="hero-phone">
              <div className="hero-phone-notch" />
              <div className="hero-phone-screen">
                <img
                  className="hero-phone-img"
                  src="/landing/dashboard-home.png"
                  alt=""
                  width={720}
                  height={1280}
                  decoding="async"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="lp-pillars" id="features" aria-label="Features">
          {PILLARS.map(card => (
            <article className={'lp-pillar tone-' + card.tone} key={card.id}>
              <span className="lp-pillar-ico" aria-hidden="true">{card.icon}</span>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
            </article>
          ))}
        </section>

        <section className="lp-need" id="watch" aria-labelledby="need-title">
          <div className="lp-need-copy">
            <h2 id="need-title">
              Everything you need, all in{' '}
              <span className="hero-grad">one place</span>
            </h2>
            <ul className="lp-need-list">
              {NEED_ITEMS.map(item => (
                <li key={item}>
                  <span className="lp-check" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12.5 10 17.5 19 7" />
                    </svg>
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="lp-need-media">
            <div className="lp-need-shot">
              <div className="lp-need-photo">
                <img
                  src="/landing/couple-couch.png"
                  alt="Couple watching together on the couch"
                  width={1600}
                  height={900}
                  decoding="async"
                />
              </div>
              <div className="lp-need-shade" />
              <div className="lp-badge lp-badge-days">
                <span className="lp-badge-dot" aria-hidden="true" />
                394 Days together
              </div>
              <button type="button" className="lp-play" aria-label="Play preview">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
                  <path d="M9 7.5v9l8-4.5-8-4.5Z" />
                </svg>
              </button>
              <div className="lp-badge lp-badge-match">100% Taste Match</div>
            </div>
          </div>
        </section>

        <section className="lp-trust" aria-label="Social proof">
          <p className="lp-trust-label">Trusted by couples worldwide</p>
          <div className="lp-trust-row">
            <div className="lp-trust-rating">
              <span className="lp-stars" aria-hidden="true">
                {'★★★★★'}
              </span>
              <span><b>4.9/5</b> from 10,000+ couples</span>
            </div>
            <div className="lp-trust-avs" aria-hidden="true">
              {TRUST_AVATARS.map((c, i) => (
                <span key={c + i} className="lp-trust-av" style={{ background: c, zIndex: TRUST_AVATARS.length - i }} />
              ))}
              <span className="lp-trust-more">+9.8k</span>
            </div>
          </div>
        </section>

        <div className="section-head" id="games"><h2>On the shelf</h2><span>dozens of games · more join regularly</span></div>
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

        <footer id="about">
          <div id="blog">DuoArcade — free while we build. Made for evenings.</div>
          <div>no stakes, no pots — money never depends on who wins</div>
        </footer>
      </div>
    </div>
  );
}
