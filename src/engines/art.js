// engines/art2.js — "living" card scenes. One animated SVG per game.
// Neon glow + motion trails + drifting particles, all in theme CSS variables.
// Animations are subtle loops and respect prefers-reduced-motion.

import { NEON, NEON_PATHS } from '../components/NeonRpsIcon.jsx';

const scene = (id, defs, inner, anim = '') => `
<svg viewBox="0 0 240 130" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="${id}-bg" cx="50%" cy="20%" r="90%">
      <stop offset="0%" stop-color="var(--room2)"/>
      <stop offset="100%" stop-color="var(--night)"/>
    </radialGradient>
    <filter id="${id}-glow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="4"/>
    </filter>
    <filter id="${id}-glow2" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="8"/>
    </filter>
    ${defs}
  </defs>
  <style>
    @media (prefers-reduced-motion: no-preference) { ${anim} }
  </style>
  <rect width="240" height="130" fill="url(#${id}-bg)"/>
  ${inner}
</svg>`;

const sparks = (id, pts) => pts.map(([x, y, r, c, d], i) =>
  `<circle class="${id}-spark${i}" cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity=".8"/>`).join('');

const sparkAnim = (id, n) => Array.from({ length: n }, (_, i) => `
  .${id}-spark${i} { animation: ${id}-drift ${5 + i * 1.7}s ease-in-out ${i * .9}s infinite alternate; }`).join('') + `
  @keyframes ${id}-drift { from { transform: translate(0,0); opacity:.9 } to { transform: translate(${'-'}6px,-10px); opacity:.3 } }`;

const pulse = (id, cls, dur = 3) => `
  .${cls} { animation: ${id}-pulse ${dur}s ease-in-out infinite; transform-origin:center; transform-box:fill-box; }
  @keyframes ${id}-pulse { 0%,100% { opacity:.55 } 50% { opacity:1 } }`;

export const ART = {

  /* ─── Tic-Tac-Toe: neon duel ─── */
  ttt: scene('ttt', '', `
    <g stroke="var(--line)" stroke-width="3" opacity=".7">
      <path d="M96 18 L90 112 M150 18 L144 112 M52 46 H196 M48 82 H192"/>
    </g>
    <g class="ttt-x">
      <path d="M52 48 L86 84 M86 48 L52 84" stroke="var(--p1)" stroke-width="12" stroke-linecap="round" filter="url(#ttt-glow2)" opacity=".8"/>
      <path d="M52 48 L86 84 M86 48 L52 84" stroke="var(--p1)" stroke-width="6" stroke-linecap="round"/>
      <path d="M55 51 L83 81 M83 51 L55 81" stroke="var(--text)" stroke-width="1.6" stroke-linecap="round" opacity=".9"/>
    </g>
    <g class="ttt-o">
      <circle cx="168" cy="64" r="20" stroke="var(--p2)" stroke-width="12" filter="url(#ttt-glow2)" opacity=".8"/>
      <circle cx="168" cy="64" r="20" stroke="var(--p2)" stroke-width="6"/>
      <circle cx="168" cy="64" r="20" stroke="var(--text)" stroke-width="1.6" opacity=".9"/>
    </g>
    <path class="ttt-streak" d="M30 108 L210 22" stroke="var(--candle)" stroke-width="3" stroke-linecap="round"
      stroke-dasharray="200" opacity=".9" filter="url(#ttt-glow)"/>
    ${sparks('ttt', [[210, 30, 2, 'var(--candle)'], [30, 100, 1.6, 'var(--p1)'], [120, 14, 1.4, 'var(--p2)']])}`,
    `${pulse('ttt', 'ttt-x', 3.4)} ${pulse('ttt', 'ttt-o', 4.2)}
     .ttt-streak { animation: ttt-dash 6s ease-in-out infinite; }
     @keyframes ttt-dash { 0%,100% { stroke-dashoffset: 200 } 50% { stroke-dashoffset: 0 } }
     ${sparkAnim('ttt', 3)}`),

  /* ─── Connect Four: the drop ─── */
  connect4: scene('c4', `
    <linearGradient id="c4-trail" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="var(--candle)" stop-opacity="0"/>
      <stop offset="100%" stop-color="var(--candle)" stop-opacity=".9"/>
    </linearGradient>`, `
    <rect x="30" y="66" width="180" height="70" rx="14" fill="var(--room)" stroke="var(--line)" stroke-width="2"/>
    <g>
      ${[0,1,2,3,4].map(i => `<circle cx="${58+31*i}" cy="116" r="11" fill="${['var(--p1)','var(--p2)','var(--night)','var(--p1)','var(--p2)'][i]}"/>`).join('')}
      ${[0,1,2,3,4].map(i => `<circle cx="${58+31*i}" cy="88" r="11" fill="${['var(--p2)','var(--night)','var(--night)','var(--night)','var(--p1)'][i]}"/>`).join('')}
    </g>
    <g class="c4-drop">
      <rect x="114" y="6" width="12" height="46" fill="url(#c4-trail)" rx="6"/>
      <circle cx="120" cy="52" r="12" fill="var(--candle)" filter="url(#c4-glow)" opacity=".7"/>
      <circle cx="120" cy="52" r="11" fill="var(--candle)"/>
      <circle cx="116" cy="48" r="3.5" fill="var(--text)" opacity=".7"/>
    </g>
    ${sparks('c4', [[40, 30, 1.8, 'var(--p1)'], [200, 40, 1.8, 'var(--p2)'], [176, 16, 1.4, 'var(--candle)']])}`,
    `.c4-drop { animation: c4-fall 2.8s cubic-bezier(.4,0,.7,1) infinite; }
     @keyframes c4-fall { 0% { transform: translateY(-26px); opacity:0 } 25% { opacity:1 }
       60%,100% { transform: translateY(24px); opacity:1 } }
     ${sparkAnim('c4', 3)}`),

  /* ─── Dots & Boxes: the closing edge ─── */
  dots: scene('dots', '', `
    <rect x="86" y="30" width="42" height="42" fill="var(--p1s)" class="dots-claim"/>
    <g stroke="var(--candle)" stroke-width="5" stroke-linecap="round" filter="url(#dots-glow)" opacity=".65">
      <path d="M86 30 H128 M86 72 H128 M86 30 V72"/>
    </g>
    <g stroke="var(--candle)" stroke-width="5" stroke-linecap="round">
      <path d="M86 30 H128 M86 72 H128 M86 30 V72 M128 72 H170"/>
    </g>
    <path class="dots-last" d="M128 30 V72" stroke="var(--p2)" stroke-width="5" stroke-linecap="round"
      stroke-dasharray="42" filter="url(#dots-glow)"/>
    <g class="dots-burst" opacity="0">
      <path d="M128 24 L128 12 M136 30 L146 22 M120 30 L110 22" stroke="var(--p2)" stroke-width="3" stroke-linecap="round"/>
    </g>
    <g fill="var(--text)">
      ${[[86,30],[128,30],[170,30],[86,72],[128,72],[170,72],[86,110],[128,110],[170,110],[44,30],[44,72],[44,110]]
        .map(([x,y]) => `<circle cx="${x}" cy="${y}" r="4.5"/>`).join('')}
    </g>
    ${sparks('dots', [[200, 50, 1.8, 'var(--candle)'], [30, 96, 1.6, 'var(--p2)']])}`,
    `.dots-last { animation: dots-draw 3.2s ease-in-out infinite; }
     @keyframes dots-draw { 0% { stroke-dashoffset: 42 } 45%,100% { stroke-dashoffset: 0 } }
     .dots-burst { animation: dots-pop 3.2s ease-in-out infinite; }
     @keyframes dots-pop { 0%,44% { opacity:0 } 52% { opacity:1 } 70%,100% { opacity:0 } }
     .dots-claim { animation: dots-fill 3.2s ease-in-out infinite; }
     @keyframes dots-fill { 0%,45% { opacity:.25 } 60%,100% { opacity:1 } }
     ${sparkAnim('dots', 2)}`),

  /* ─── Reversi: the flip wave ─── */
  reversi: scene('rev', `
    <linearGradient id="rev-sweep" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="var(--text)" stop-opacity="0"/>
      <stop offset="50%" stop-color="var(--text)" stop-opacity=".55"/>
      <stop offset="100%" stop-color="var(--text)" stop-opacity="0"/>
    </linearGradient>`, `
    <g opacity=".25" stroke="var(--line)" stroke-width="2">
      ${[0,1,2,3].map(i => `<path d="M${30+i*48} 18 V112"/>`).join('')}
    </g>
    <circle cx="48" cy="65" r="19" fill="var(--p2)" filter="url(#rev-glow)" opacity=".5"/>
    <circle cx="48" cy="65" r="18" fill="var(--p2)"/>
    <ellipse class="rev-flip" cx="108" cy="65" rx="9" ry="18" fill="var(--dim)"/>
    <circle cx="168" cy="65" r="18" fill="var(--p1)"/>
    <circle cx="212" cy="65" r="18" fill="var(--p1)" filter="url(#rev-glow)" opacity=".5"/>
    <circle cx="212" cy="65" r="18" fill="var(--p1)"/>
    <rect class="rev-light" x="0" y="30" width="70" height="70" fill="url(#rev-sweep)"/>
    ${sparks('rev', [[80, 26, 1.8, 'var(--p2)'], [150, 104, 1.8, 'var(--p1)']])}`,
    `.rev-flip { animation: rev-spin 2.6s ease-in-out infinite; transform-origin:center; transform-box:fill-box; }
     @keyframes rev-spin { 0%,15% { transform: scaleX(1) } 50% { transform: scaleX(.15) } 85%,100% { transform: scaleX(1) } }
     .rev-light { animation: rev-sweepmove 4.5s linear infinite; }
     @keyframes rev-sweepmove { from { transform: translateX(-70px) } to { transform: translateX(240px) } }
     ${sparkAnim('rev', 2)}`),

  /* ─── Gomoku: the comet line ─── */
  gomoku: scene('gmk', `
    <linearGradient id="gmk-tail" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0%" stop-color="var(--candle)" stop-opacity="0"/>
      <stop offset="100%" stop-color="var(--candle)" stop-opacity=".8"/>
    </linearGradient>`, `
    <g stroke="var(--line)" stroke-width="1.6" opacity=".6">
      ${[0,1,2,3,4].map(i => `<path d="M${28+i*46} 12 V118"/>`).join('')}
      ${[0,1,2].map(i => `<path d="M10 ${28+i*38} H230"/>`).join('')}
    </g>
    <path d="M30 112 L186 30" stroke="url(#gmk-tail)" stroke-width="14" stroke-linecap="round" opacity=".55"/>
    <circle cx="55" cy="99" r="11" fill="var(--p1)"/>
    <circle cx="88" cy="82" r="11" fill="var(--p1)"/>
    <circle cx="121" cy="65" r="11" fill="var(--p1)"/>
    <circle cx="154" cy="48" r="11" fill="var(--p1)"/>
    <g class="gmk-head">
      <circle cx="187" cy="31" r="14" fill="var(--candle)" filter="url(#gmk-glow2)" opacity=".8"/>
      <circle cx="187" cy="31" r="11" fill="var(--candle)"/>
    </g>
    <circle cx="55" cy="44" r="11" fill="var(--p2)"/>
    <circle cx="200" cy="94" r="11" fill="var(--p2)"/>
    ${sparks('gmk', [[210, 20, 2, 'var(--candle)'], [160, 60, 1.5, 'var(--text)']])}`,
    `${pulse('gmk', 'gmk-head', 2.4)} ${sparkAnim('gmk', 2)}`),

  /* ─── Memory: the reveal ─── */
  memory: scene('mem', '', `
    <g transform="rotate(-9 78 70)">
      <rect x="48" y="30" width="60" height="80" rx="10" fill="var(--room)" stroke="var(--line)" stroke-width="2.5"/>
      <circle cx="78" cy="58" r="9" stroke="var(--dim)" stroke-width="2.5" opacity=".5"/>
      <path d="M69 84 q9 -10 18 0" stroke="var(--dim)" stroke-width="2.5" opacity=".5"/>
    </g>
    <g class="mem-rays" stroke="var(--candle)" stroke-width="2" stroke-linecap="round" opacity=".7">
      <path d="M162 18 V6 M186 26 L196 16 M138 26 L128 16 M196 52 H208 M128 52 H116"/>
    </g>
    <g transform="rotate(8 162 66)">
      <rect x="132" y="26" width="60" height="80" rx="10" fill="var(--room2)" stroke="var(--candle)" stroke-width="2.5" filter="url(#mem-glow)" opacity=".8"/>
      <rect x="132" y="26" width="60" height="80" rx="10" fill="var(--room2)" stroke="var(--candle)" stroke-width="2.5"/>
      <path class="mem-heart" d="M162 88 C146 74 140 60 151 52 C158 47 162 55 162 58 C162 55 166 47 173 52 C184 60 178 74 162 88 Z"
        fill="var(--p2)" filter="url(#mem-glow)"/>
      <path d="M162 88 C146 74 140 60 151 52 C158 47 162 55 162 58 C162 55 166 47 173 52 C184 60 178 74 162 88 Z" fill="var(--p2)"/>
    </g>
    ${sparks('mem', [[210, 90, 2, 'var(--p2)'], [30, 30, 1.7, 'var(--candle)'], [110, 112, 1.5, 'var(--p2)']])}`,
    `.mem-heart { animation: mem-beat 1.8s ease-in-out infinite; transform-origin:center; transform-box:fill-box; }
     @keyframes mem-beat { 0%,100% { transform: scale(1) } 12% { transform: scale(1.14) } 24% { transform: scale(1) } }
     ${pulse('mem', 'mem-rays', 2.6)} ${sparkAnim('mem', 3)}`),

  /* ─── Duo Pong: the rally ─── */
  pong: scene('pong', `
    <linearGradient id="pong-trail" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="var(--candle)" stop-opacity="0"/>
      <stop offset="100%" stop-color="var(--candle)" stop-opacity=".9"/>
    </linearGradient>`, `
    <path d="M120 10 V120" stroke="var(--line)" stroke-width="3" stroke-dasharray="7 11" opacity=".8"/>
    <rect x="18" y="34" width="9" height="40" rx="4.5" fill="var(--p1)" filter="url(#pong-glow)" opacity=".6"/>
    <rect x="18" y="34" width="9" height="40" rx="4.5" fill="var(--p1)"/>
    <rect x="213" y="58" width="9" height="40" rx="4.5" fill="var(--p2)" filter="url(#pong-glow)" opacity=".6"/>
    <rect x="213" y="58" width="9" height="40" rx="4.5" fill="var(--p2)"/>
    <g class="pong-ball">
      <path d="M50 84 Q110 20 172 56" stroke="url(#pong-trail)" stroke-width="9" stroke-linecap="round" fill="none" opacity=".75"/>
      <circle cx="172" cy="56" r="10" fill="var(--candle)" filter="url(#pong-glow2)" opacity=".8"/>
      <circle cx="172" cy="56" r="8" fill="var(--candle)"/>
    </g>
    <text x="66" y="26" font-family="'JetBrains Mono',monospace" font-weight="700" font-size="17" fill="var(--p1)" opacity=".9">6</text>
    <text x="166" y="26" font-family="'JetBrains Mono',monospace" font-weight="700" font-size="17" fill="var(--p2)" opacity=".9">6</text>
    ${sparks('pong', [[100, 106, 1.7, 'var(--p1)'], [150, 100, 1.7, 'var(--p2)']])}`,
    `.pong-ball { animation: pong-hit 2.2s ease-in-out infinite alternate; }
     @keyframes pong-hit { from { transform: translate(0,0) } to { transform: translate(28px,10px) } }
     ${sparkAnim('pong', 2)}`),

  sparksplash: scene('ss', `
    <linearGradient id="ss-fire" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="#ff7a2f"/><stop offset="100%" stop-color="#ffd23f"/>
    </linearGradient>
    <linearGradient id="ss-water" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="#3fa9ff"/><stop offset="100%" stop-color="#a8e6ff"/>
    </linearGradient>`, `
    <g class="ss-spark">
      <rect x="38" y="72" width="28" height="34" rx="8" fill="url(#ss-fire)" opacity=".85"/>
      <path d="M52 62 Q54 48 64 52" fill="#ffd23f" opacity=".9"/>
    </g>
    <g class="ss-splash">
      <rect x="164" y="68" width="28" height="34" rx="8" fill="url(#ss-water)" opacity=".85"/>
      <path d="M178 58 Q180 44 170 48" fill="#a8e6ff" opacity=".9"/>
    </g>
    <rect x="24" y="108" width="184" height="8" rx="4" fill="var(--line)" opacity=".7"/>
    <rect class="ss-plat" x="88" y="100" width="56" height="16" rx="4" fill="var(--candle)" opacity=".35"/>
    <text class="ss-heart" x="116" y="90" text-anchor="middle" font-size="18" fill="var(--candle)">♥</text>
    ${sparks('ss', [[64, 40, 1.6, '#ff7a2f'], [178, 36, 1.6, '#3fa9ff']])}`,
    `.ss-spark { animation: ss-hop 2.6s ease-in-out infinite; transform-box: fill-box; transform-origin: 52px 90px; }
     .ss-splash { animation: ss-hop 2.6s ease-in-out 1.3s infinite; transform-box: fill-box; transform-origin: 178px 86px; }
     @keyframes ss-hop { 0%,100% { transform: translateY(0) } 42% { transform: translateY(-11px) } 58% { transform: translateY(-11px) } }
     .ss-heart { animation: ss-beat 1.8s ease-in-out infinite; transform-box: fill-box; transform-origin: 116px 86px; }
     @keyframes ss-beat { 0%,100% { opacity: .65; transform: scale(1) } 50% { opacity: 1; transform: scale(1.18) } }
     .ss-plat { animation: ss-glow 2.4s ease-in-out infinite; }
     @keyframes ss-glow { 0%,100% { opacity: .22 } 50% { opacity: .5 } }
     ${sparkAnim('ss', 2)}`),

  /* ─── Sketch & Guess: fresh ink ─── */
  sketch: scene('sk', `
    <linearGradient id="sk-ink" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="var(--p2)" stop-opacity=".25"/>
      <stop offset="100%" stop-color="var(--p2)"/>
    </linearGradient>`, `
    <path class="sk-stroke" d="M42 96 C30 74 44 52 70 52 C92 52 100 68 100 76 C100 68 108 52 130 52 C158 52 170 76 152 96 L120 116"
      stroke="url(#sk-ink)" stroke-width="8" stroke-linecap="round" fill="none"
      stroke-dasharray="330" filter="url(#sk-glow)"/>
    <path class="sk-stroke" d="M42 96 C30 74 44 52 70 52 C92 52 100 68 100 76 C100 68 108 52 130 52 C158 52 170 76 152 96 L120 116"
      stroke="url(#sk-ink)" stroke-width="6" stroke-linecap="round" fill="none" stroke-dasharray="330"/>
    <g class="sk-pen" transform="rotate(40 128 106)">
      <rect x="118" y="60" width="17" height="42" rx="3" fill="var(--candle)"/>
      <rect x="118" y="54" width="17" height="8" rx="2" fill="var(--p1)"/>
      <path d="M118 102 L126.5 120 L135 102 Z" fill="var(--text)"/>
    </g>
    <text x="186" y="46" font-family="'Fraunces',serif" font-weight="900" font-size="22" fill="var(--dim)" opacity=".85">?</text>
    <text x="204" y="70" font-family="'Fraunces',serif" font-weight="900" font-size="15" fill="var(--dim)" opacity=".55">?</text>
    ${sparks('sk', [[52, 44, 1.8, 'var(--p2)'], [166, 100, 1.6, 'var(--candle)']])}`,
    `.sk-stroke { animation: sk-draw 5s ease-in-out infinite; }
     @keyframes sk-draw { 0% { stroke-dashoffset: 330 } 60%,100% { stroke-dashoffset: 0 } }
     .sk-pen { animation: sk-wiggle 5s ease-in-out infinite; }
     @keyframes sk-wiggle { 0%,60%,100% { transform: rotate(40deg) translate(0,0) } 30% { transform: rotate(43deg) translate(-3px,2px) } }
     ${sparkAnim('sk', 2)}`),

  /* ─── Word Race: tiles at speed ─── */
  wordrace: scene('wr', '', `
    <g stroke="var(--dim)" stroke-width="3" stroke-linecap="round" opacity=".5" class="wr-lines">
      <path d="M14 40 H58 M6 66 H44 M18 92 H52"/>
    </g>
    <g class="wr-t1" transform="rotate(-7 96 60)">
      <rect x="72" y="36" width="48" height="48" rx="10" fill="var(--room2)" stroke="var(--p1)" stroke-width="3" filter="url(#wr-glow)" opacity=".7"/>
      <rect x="72" y="36" width="48" height="48" rx="10" fill="var(--room2)" stroke="var(--p1)" stroke-width="3"/>
      <text x="96" y="70" text-anchor="middle" font-family="'JetBrains Mono',monospace" font-weight="700" font-size="28" fill="var(--p1)">G</text>
    </g>
    <g class="wr-t2" transform="rotate(5 150 68)">
      <rect x="126" y="44" width="48" height="48" rx="10" fill="var(--room2)" stroke="var(--candle)" stroke-width="3" filter="url(#wr-glow)" opacity=".7"/>
      <rect x="126" y="44" width="48" height="48" rx="10" fill="var(--room2)" stroke="var(--candle)" stroke-width="3"/>
      <text x="150" y="78" text-anchor="middle" font-family="'JetBrains Mono',monospace" font-weight="700" font-size="28" fill="var(--candle)">O</text>
    </g>
    <g class="wr-t3" transform="rotate(-4 202 58)">
      <rect x="178" y="34" width="48" height="48" rx="10" fill="var(--room2)" stroke="var(--p2)" stroke-width="3" filter="url(#wr-glow)" opacity=".7"/>
      <rect x="178" y="34" width="48" height="48" rx="10" fill="var(--room2)" stroke="var(--p2)" stroke-width="3"/>
      <text x="202" y="68" text-anchor="middle" font-family="'JetBrains Mono',monospace" font-weight="700" font-size="28" fill="var(--p2)">!</text>
    </g>
    ${sparks('wr', [[60, 110, 1.8, 'var(--candle)'], [120, 16, 1.5, 'var(--p1)']])}`,
    `.wr-t1 { animation: wr-bob 2.8s ease-in-out infinite; } .wr-t2 { animation: wr-bob 2.8s ease-in-out .4s infinite; }
     .wr-t3 { animation: wr-bob 2.8s ease-in-out .8s infinite; }
     @keyframes wr-bob { 0%,100% { translate: 0 0 } 50% { translate: 0 -6px } }
     ${pulse('wr', 'wr-lines', 2)} ${sparkAnim('wr', 2)}`),

  /* ─── Maze Race: the lit path ─── */
  maze: scene('mz', '', `
    <g stroke="var(--line)" stroke-width="5" stroke-linecap="round" opacity=".9">
      <path d="M40 20 H200 V110 H40 V50"/>
      <path d="M70 50 H120 M150 50 H200 M70 50 V80 M100 80 H170 M170 80 V50 M120 110 V80"/>
    </g>
    <path class="mz-path" d="M40 35 H55 V95 H85 V65 H135 V95 H185 V35 H200"
      stroke="var(--candle)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"
      fill="none" stroke-dasharray="400" filter="url(#mz-glow)"/>
    <circle cx="40" cy="35" r="8" fill="var(--p1)" filter="url(#mz-glow)"/>
    <g class="mz-goal">
      <circle cx="200" cy="35" r="11" fill="var(--p2)" filter="url(#mz-glow2)" opacity=".7"/>
      <circle cx="200" cy="35" r="8" fill="var(--p2)"/>
    </g>
    ${sparks('mz', [[24, 100, 1.8, 'var(--p1)'], [218, 88, 1.8, 'var(--p2)']])}`,
    `.mz-path { animation: mz-run 4.5s ease-in-out infinite; }
     @keyframes mz-run { 0% { stroke-dashoffset: 400 } 70%,100% { stroke-dashoffset: 0 } }
     ${pulse('mz', 'mz-goal', 2.2)} ${sparkAnim('mz', 2)}`),

  /* ─── Reaction Duel: the strike ─── */
  reflex: scene('rx', '', `
    <g class="rx-ring1"><circle cx="120" cy="65" r="34" stroke="var(--candle)" stroke-width="2.5" opacity=".5"/></g>
    <g class="rx-ring2"><circle cx="120" cy="65" r="50" stroke="var(--candle)" stroke-width="2" opacity=".3"/></g>
    <path d="M126 18 L96 70 H116 L108 112 L146 56 H124 L138 18 Z"
      fill="var(--candle)" filter="url(#rx-glow2)" opacity=".75"/>
    <path class="rx-bolt" d="M126 18 L96 70 H116 L108 112 L146 56 H124 L138 18 Z" fill="var(--candle)"/>
    <g class="rx-tapA">
      <circle cx="38" cy="34" r="12" stroke="var(--p1)" stroke-width="4"/>
      <circle cx="38" cy="34" r="4" fill="var(--p1)"/>
    </g>
    <g class="rx-tapB">
      <circle cx="204" cy="96" r="12" stroke="var(--p2)" stroke-width="4"/>
      <circle cx="204" cy="96" r="4" fill="var(--p2)"/>
    </g>
    ${sparks('rx', [[188, 24, 2, 'var(--candle)'], [50, 106, 1.6, 'var(--text)']])}`,
    `${pulse('rx', 'rx-bolt', 1.6)}
     .rx-ring1 { animation: rx-shock 2.4s ease-out infinite; transform-origin:center; transform-box:fill-box; }
     .rx-ring2 { animation: rx-shock 2.4s ease-out .5s infinite; transform-origin:center; transform-box:fill-box; }
     @keyframes rx-shock { 0% { transform: scale(.4); opacity:.9 } 100% { transform: scale(1.25); opacity:0 } }
     .rx-tapA { animation: rx-tap 2.4s ease-in-out infinite; } .rx-tapB { animation: rx-tap 2.4s ease-in-out 1.2s infinite; }
     @keyframes rx-tap { 0%,100% { opacity:.5 } 50% { opacity:1 } }
     ${sparkAnim('rx', 2)}`),

  /* ─── Mancala: seeds in flight ─── */
  mancala: scene('man', '', `
    <rect x="16" y="62" width="208" height="56" rx="26" fill="var(--room)" stroke="var(--line)" stroke-width="2.5"/>
    <ellipse cx="44" cy="90" rx="17" ry="22" fill="var(--night)" stroke="var(--p1)" stroke-width="2.5"/>
    <circle cx="97" cy="90" r="15" fill="var(--night)" stroke="var(--line)" stroke-width="2.5"/>
    <circle cx="143" cy="90" r="15" fill="var(--night)" stroke="var(--line)" stroke-width="2.5"/>
    <circle cx="189" cy="90" r="15" fill="var(--night)" stroke="var(--line)" stroke-width="2.5"/>
    <path d="M189 74 Q150 8 50 66" stroke="var(--candle)" stroke-width="2.5" stroke-dasharray="3 8" fill="none" opacity=".8"/>
    <g fill="var(--candle)">
      <circle class="man-s0" cx="176" cy="46" r="4.5" filter="url(#man-glow)"/>
      <circle class="man-s1" cx="140" cy="28" r="4.5" filter="url(#man-glow)"/>
      <circle class="man-s2" cx="100" cy="26" r="4.5" filter="url(#man-glow)"/>
      <circle class="man-s3" cx="66" cy="42" r="4.5" filter="url(#man-glow)"/>
    </g>
    <g fill="var(--p1)">
      <circle cx="38" cy="82" r="4"/><circle cx="50" cy="88" r="4"/><circle cx="42" cy="98" r="4"/>
    </g>
    <g fill="var(--candle)" opacity=".95">
      <circle cx="92" cy="86" r="4"/><circle cx="102" cy="92" r="4"/>
      <circle cx="139" cy="92" r="4"/><circle cx="186" cy="87" r="4"/><circle cx="193" cy="94" r="4"/>
    </g>
    ${sparks('man', [[26, 30, 1.8, 'var(--candle)'], [216, 40, 1.6, 'var(--p1)']])}`,
    `${[0,1,2,3].map(i => `.man-s${i} { animation: man-hop 2.4s ease-in-out ${i * .3}s infinite; }`).join('')}
     @keyframes man-hop { 0%,100% { transform: translateY(0); opacity:.5 } 50% { transform: translateY(-7px); opacity:1 } }
     ${sparkAnim('man', 2)}`),

  /* ─── Sea Battle: night watch ─── */
  seabattle: scene('sea', `
    <radialGradient id="sea-moon" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="var(--text)" stop-opacity=".9"/>
      <stop offset="100%" stop-color="var(--text)" stop-opacity="0"/>
    </radialGradient>`, `
    <circle cx="42" cy="30" r="26" fill="url(#sea-moon)" opacity=".6"/>
    <circle cx="42" cy="30" r="12" fill="var(--text)" opacity=".9"/>
    <g class="sea-ship">
      <path d="M74 96 L86 74 H166 L178 96 Z" fill="var(--night)" stroke="var(--dim)" stroke-width="2"/>
      <rect x="112" y="56" width="30" height="18" rx="3" fill="var(--night)" stroke="var(--dim)" stroke-width="2"/>
      <rect x="122" y="40" width="9" height="16" fill="var(--night)" stroke="var(--dim)" stroke-width="2"/>
      <circle cx="126" cy="36" r="3" fill="var(--candle)" class="sea-lamp"/>
    </g>
    <g class="sea-cross" stroke="var(--p2)" stroke-width="3.5">
      <circle cx="196" cy="34" r="17" filter="url(#sea-glow)" opacity=".6"/>
      <circle cx="196" cy="34" r="17"/>
      <path d="M196 10 V24 M196 44 V58 M172 34 H186 M206 34 H220"/>
      <circle cx="196" cy="34" r="4" fill="var(--p2)" stroke="none"/>
    </g>
    <g stroke="var(--p1)" stroke-width="3" stroke-linecap="round" fill="none">
      <path class="sea-w1" d="M14 106 q12 -8 24 0 q12 8 24 0 q12 -8 24 0 q12 8 24 0 q12 -8 24 0 q12 8 24 0 q12 -8 24 0 q12 8 24 0" opacity=".8"/>
      <path class="sea-w2" d="M2 118 q12 -7 24 0 q12 7 24 0 q12 -7 24 0 q12 7 24 0 q12 -7 24 0 q12 7 24 0 q12 -7 24 0 q12 7 24 0 q12 -7 24 0" opacity=".4"/>
    </g>
    ${sparks('sea', [[80, 20, 1.4, 'var(--text)'], [150, 24, 1.2, 'var(--text)']])}`,
    `.sea-ship { animation: sea-bob 4s ease-in-out infinite; }
     @keyframes sea-bob { 0%,100% { transform: translateY(0) rotate(0deg) } 50% { transform: translateY(4px) rotate(-1deg) } }
     .sea-w1 { animation: sea-wave 5s ease-in-out infinite alternate; }
     .sea-w2 { animation: sea-wave 6.5s ease-in-out infinite alternate-reverse; }
     @keyframes sea-wave { from { transform: translateX(0) } to { transform: translateX(-14px) } }
     ${pulse('sea', 'sea-cross', 2.6)} ${pulse('sea', 'sea-lamp', 1.4)} ${sparkAnim('sea', 2)}`),

  /* ─── Checkers: the capture ─── */
  checkers: scene('chk', '', `
    <g>
      ${[0,1,2,3,4,5].map(c => [0,1].map(r =>
        `<rect x="${24+32*c}" y="${66+32*r}" width="32" height="32" fill="${(c+r)%2 ? 'var(--room2)' : 'var(--room)'}"/>`
      ).join('')).join('')}
      <rect x="24" y="66" width="192" height="64" fill="none" stroke="var(--line)" stroke-width="2.5"/>
    </g>
    <g class="chk-jumper">
      <path d="M72 82 Q120 18 168 82" stroke="var(--p1)" stroke-width="3" stroke-dasharray="4 7" fill="none" opacity=".8"/>
      <circle cx="168" cy="80" r="15" fill="var(--p1)" filter="url(#chk-glow)" opacity=".6"/>
      <circle cx="168" cy="80" r="14" fill="var(--p1)"/>
      <path d="M159 78 L162 70 L166 76 L168 68 L170 76 L174 70 L177 78 Z" fill="var(--night)"/>
    </g>
    <g class="chk-victim">
      <circle cx="120" cy="82" r="14" fill="var(--p2)"/>
    </g>
    <circle cx="56" cy="114" r="14" fill="var(--p2)"/>
    <circle cx="184" cy="114" r="14" fill="var(--p1)"/>
    ${sparks('chk', [[40, 30, 1.8, 'var(--p1)'], [204, 40, 1.8, 'var(--p2)']])}`,
    `.chk-victim { animation: chk-fade 3.4s ease-in-out infinite; }
     @keyframes chk-fade { 0%,40% { opacity:1; transform: translateY(0) } 70%,100% { opacity:0; transform: translateY(10px) } }
     ${pulse('chk', 'chk-jumper', 3.4)} ${sparkAnim('chk', 2)}`),

  /* ─── Hex: the bridge ─── */
  hex: scene('hex', '', `
    <g stroke="var(--line)" stroke-width="2" opacity=".6">
      ${[[36,28],[92,28],[148,28],[204,28],[64,66],[176,66],[36,104],[92,104],[204,104]]
        .map(([x,y]) => `<path d="M${x} ${y-20} L${x+17} ${y-10} V${y+10} L${x} ${y+20} L${x-17} ${y+10} V${y-10} Z"/>`).join('')}
    </g>
    ${[[120,66,'hex-c1'],[148,104,'hex-c2'],[92,28,'hex-c0']].map(([x,y,cls]) => `
      <g class="${cls}">
        <path d="M${x} ${+y-20} L${+x+17} ${+y-10} V${+y+10} L${x} ${+y+20} L${+x-17} ${+y+10} V${+y-10} Z"
          fill="var(--p1)" filter="url(#hex-glow)" opacity=".55"/>
        <path d="M${x} ${+y-20} L${+x+17} ${+y-10} V${+y+10} L${x} ${+y+20} L${+x-17} ${+y+10} V${+y-10} Z" fill="var(--p1)"/>
      </g>`).join('')}
    <path d="M176 66 L193 76 V96 L176 106 L159 96 V76 Z" fill="var(--p2)"/>
    <path d="M64 66 L81 76 V96 L64 106 L47 96 V76 Z" fill="var(--p2)" opacity=".85"/>
    <path class="hex-link" d="M92 28 L120 66 L148 104" stroke="var(--text)" stroke-width="3"
      stroke-linecap="round" stroke-dasharray="6 9" fill="none" opacity=".9"/>
    ${sparks('hex', [[220, 24, 1.8, 'var(--p1)'], [22, 110, 1.8, 'var(--p2)']])}`,
    `${[0,1,2].map(i => `.hex-c${i} { animation: hex-glowup 3s ease-in-out ${i * .5}s infinite; }`).join('')}
     @keyframes hex-glowup { 0%,100% { opacity:.75 } 50% { opacity:1 } }
     .hex-link { animation: hex-flow 1.6s linear infinite; }
     @keyframes hex-flow { from { stroke-dashoffset: 30 } to { stroke-dashoffset: 0 } }
     ${sparkAnim('hex', 2)}`),

  /* ─── Pig Race: the tumble ─── */
  pig: scene('pig', '', `
    <path d="M30 100 Q80 40 150 56" stroke="var(--candle)" stroke-width="3" stroke-dasharray="3 9" fill="none" opacity=".7"/>
    <g class="pig-d1" transform="rotate(-14 78 62)">
      <rect x="52" y="36" width="52" height="52" rx="12" fill="var(--text)"/>
      <g fill="var(--night)">
        <circle cx="66" cy="50" r="5"/><circle cx="90" cy="50" r="5"/>
        <circle cx="78" cy="62" r="5"/>
        <circle cx="66" cy="74" r="5"/><circle cx="90" cy="74" r="5"/>
      </g>
    </g>
    <g class="pig-d2" transform="rotate(16 168 78)">
      <rect x="142" y="52" width="52" height="52" rx="12" fill="var(--candle)" filter="url(#pig-glow)" opacity=".65"/>
      <rect x="142" y="52" width="52" height="52" rx="12" fill="var(--candle)"/>
      <g fill="var(--night)">
        <circle cx="156" cy="66" r="5"/><circle cx="180" cy="90" r="5"/>
      </g>
    </g>
    <g class="pig-stars" fill="var(--candle)">
      <path d="M124 26 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 Z"/>
      <path d="M210 44 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z" opacity=".8"/>
    </g>
    ${sparks('pig', [[36, 40, 1.8, 'var(--candle)'], [206, 108, 1.6, 'var(--text)']])}`,
    `.pig-d1 { animation: pig-t1 3.2s ease-in-out infinite; }
     @keyframes pig-t1 { 0%,100% { transform: rotate(-14deg) translateY(0) } 50% { transform: rotate(-6deg) translateY(-8px) } }
     .pig-d2 { animation: pig-t2 3.2s ease-in-out .4s infinite; }
     @keyframes pig-t2 { 0%,100% { transform: rotate(16deg) translateY(0) } 50% { transform: rotate(24deg) translateY(-5px) } }
     ${pulse('pig', 'pig-stars', 2)} ${sparkAnim('pig', 2)}`),

  /* ─── Sticks (Nim): the fateful take ─── */
  nim: scene('nim', '', `
    <g stroke-linecap="round">
      ${[0,1,2].map(i => `<path d="M${72+i*16} 22 V52" stroke="var(--p1)" stroke-width="8"/>`).join('')}
      ${[0,1,2,3,4].map(i => `<path d="M${56+i*16} 66 V96" stroke="var(--p2)" stroke-width="8"/>`).join('')}
    </g>
    <g class="nim-take" stroke-linecap="round">
      <path d="M136 22 V52" stroke="var(--candle)" stroke-width="8" filter="url(#nim-glow)"/>
      <path d="M152 22 V52" stroke="var(--candle)" stroke-width="8" filter="url(#nim-glow)"/>
    </g>
    <path class="nim-last" d="M188 58 V92" stroke="var(--candle)" stroke-width="9" stroke-linecap="round" filter="url(#nim-glow2)"/>
    <text x="180" y="118" font-family="'Fraunces',serif" font-weight="900" font-size="15" fill="var(--dim)">last one loses</text>
    ${sparks('nim', [[40, 30, 1.8, 'var(--candle)'], [210, 40, 1.6, 'var(--p1)']])}`,
    `.nim-take { animation: nim-lift 3s ease-in-out infinite; }
     @keyframes nim-lift { 0%,35% { transform: translateY(0); opacity:1 } 70%,100% { transform: translateY(-16px); opacity:0 } }
     ${pulse('nim', 'nim-last', 1.8)} ${sparkAnim('nim', 2)}`),

  /* ─── Duo Dash: the bump ─── */
  race: scene('race', '', `
    <path d="M28 96 H150 Q176 96 176 70 Q176 44 150 44 H60" stroke="var(--line)" stroke-width="16"
      stroke-linecap="round" fill="none" opacity=".8"/>
    <path d="M28 96 H150 Q176 96 176 70 Q176 44 150 44 H60" stroke="var(--night)" stroke-width="12"
      stroke-linecap="round" fill="none" stroke-dasharray="2 14"/>
    <g class="race-runner">
      <circle cx="98" cy="96" r="12" fill="var(--p1)" filter="url(#race-glow)" opacity=".6"/>
      <circle cx="98" cy="96" r="11" fill="var(--p1)"/>
      <text x="98" y="101" text-anchor="middle" font-family="'JetBrains Mono',monospace" font-weight="700" font-size="12" fill="var(--night)">1</text>
    </g>
    <g class="race-bumped">
      <circle cx="146" cy="96" r="11" fill="var(--p2)"/>
      <text x="146" y="101" text-anchor="middle" font-family="'JetBrains Mono',monospace" font-weight="700" font-size="12" fill="var(--night)">2</text>
    </g>
    <g class="race-die" transform="rotate(-10 202 34)">
      <rect x="184" y="16" width="38" height="38" rx="9" fill="var(--candle)" filter="url(#race-glow)" opacity=".7"/>
      <rect x="184" y="16" width="38" height="38" rx="9" fill="var(--candle)"/>
      <g fill="var(--night)">
        <circle cx="194" cy="26" r="3.4"/><circle cx="212" cy="26" r="3.4"/>
        <circle cx="194" cy="44" r="3.4"/><circle cx="212" cy="44" r="3.4"/>
        <circle cx="194" cy="35" r="3.4"/><circle cx="212" cy="35" r="3.4"/>
      </g>
    </g>
    ${sparks('race', [[36, 30, 1.8, 'var(--p1)'], [130, 20, 1.6, 'var(--candle)']])}`,
    `.race-runner { animation: race-dash 3s ease-in-out infinite; }
     @keyframes race-dash { 0%,20% { transform: translateX(0) } 60%,100% { transform: translateX(34px) } }
     .race-bumped { animation: race-bump 3s ease-in-out infinite; }
     @keyframes race-bump { 0%,55% { transform: translate(0,0); opacity:1 } 80%,100% { transform: translate(18px,-12px); opacity:0 } }
     ${pulse('race', 'race-die', 2.4)} ${sparkAnim('race', 2)}`),

  /* ─── Couple Quiz: two bubbles, one secret ─── */
  couplequiz: scene('cq', '', `
    <g class="cq-b1">
      <path d="M26 34 h84 a10 10 0 0 1 10 10 v26 a10 10 0 0 1 -10 10 h-56 l-14 14 v-14 h-14 a10 10 0 0 1 -10 -10 v-26 a10 10 0 0 1 10 -10 Z"
        fill="var(--room)" stroke="var(--p1)" stroke-width="2.5"/>
      <text x="68" y="63" text-anchor="middle" font-family="'Fraunces',serif" font-weight="900" font-size="26" fill="var(--p1)">?</text>
    </g>
    <g class="cq-b2">
      <path d="M214 52 h-84 a10 10 0 0 0 -10 10 v26 a10 10 0 0 0 10 10 h56 l14 14 v-14 h14 a10 10 0 0 0 10 -10 v-26 a10 10 0 0 0 -10 -10 Z"
        fill="var(--room2)" stroke="var(--p2)" stroke-width="2.5"/>
      <path class="cq-heart" d="M172 92 C160 82 156 72 164 66 C169 63 172 69 172 71 C172 69 175 63 180 66 C188 72 184 82 172 92 Z" fill="var(--p2)" filter="url(#cq-glow)"/>
    </g>
    ${sparks('cq', [[30, 108, 1.8, 'var(--p1)'], [210, 24, 1.8, 'var(--p2)'], [120, 14, 1.5, 'var(--candle)']])}`,
    `.cq-b1 { animation: cq-bob 3.4s ease-in-out infinite; } .cq-b2 { animation: cq-bob 3.4s ease-in-out 1.7s infinite; }
     @keyframes cq-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-5px) } }
     .cq-heart { animation: cq-beat 1.8s ease-in-out infinite; transform-origin:center; transform-box:fill-box; }
     @keyframes cq-beat { 0%,100% { transform: scale(1) } 12% { transform: scale(1.18) } 24% { transform: scale(1) } }
     ${sparkAnim('cq', 3)}`),

  /* ─── Two Truths & a Lie: spot the fib ─── */
  twotruths: scene('ttl', '', `
    <g font-family="'Fraunces',serif" font-weight="900" font-size="15">
      <rect x="34" y="20" width="172" height="26" rx="8" fill="var(--room)" stroke="var(--line)" stroke-width="2"/>
      <text x="48" y="38" fill="var(--dim)">truth ........</text>
      <rect class="ttl-lierow" x="34" y="52" width="172" height="26" rx="8" fill="var(--room2)" stroke="var(--p2)" stroke-width="2.5" filter="url(#ttl-glow)"/>
      <text x="48" y="70" fill="var(--p2)">lie? .........</text>
      <rect x="34" y="84" width="172" height="26" rx="8" fill="var(--room)" stroke="var(--line)" stroke-width="2"/>
      <text x="48" y="102" fill="var(--dim)">truth ........</text>
    </g>
    <g class="ttl-lens">
      <circle cx="196" cy="62" r="17" stroke="var(--candle)" stroke-width="4" fill="none" filter="url(#ttl-glow)"/>
      <path d="M208 74 L222 88" stroke="var(--candle)" stroke-width="5" stroke-linecap="round"/>
    </g>
    ${sparks('ttl', [[24, 110, 1.8, 'var(--candle)'], [220, 20, 1.6, 'var(--p2)']])}`,
    `${pulse('ttl', 'ttl-lierow', 2.4)}
     .ttl-lens { animation: ttl-scan 4s ease-in-out infinite; }
     @keyframes ttl-scan { 0%,100% { transform: translateY(-34px) } 50% { transform: translateY(30px) } }
     ${sparkAnim('ttl', 2)}`),

  /* ─── Code Break: the crack ─── */
  codebreak: scene('cb', '', `
    <g class="cb-lock" transform="translate(118 52)">
      <rect x="-34" y="-22" width="68" height="44" rx="12" fill="var(--room)" stroke="var(--candle)" stroke-width="2.5"/>
      <text x="0" y="8" text-anchor="middle" font-family="'JetBrains Mono',monospace" font-weight="700" font-size="22" fill="var(--candle)">?</text>
    </g>
    <g font-family="'JetBrains Mono',monospace" font-weight="700" font-size="20">
      ${[[48,58,'var(--p1)','g'],[88,58,'var(--candle)','y'],[148,58,'var(--p2)','g'],[188,58,'var(--dim)','.']].map(([x,y,col,cls],i) => `
        <g class="cb-t${i}">
          <rect x="${x-16}" y="${y-16}" width="32" height="32" rx="8" fill="var(--room2)" stroke="${col}" stroke-width="2.5"/>
          <text x="${x}" y="${y+7}" text-anchor="middle" fill="${col}">${['1','2','3','4'][i]}</text>
        </g>`).join('')}
    </g>
    ${sparks('cb', [[30, 30, 1.8, 'var(--p1)'], [210, 90, 1.8, 'var(--p2)'], [120, 18, 1.5, 'var(--candle)']])}`,
    `${[0,1,2,3].map(i => `.cb-t${i} { animation: cb-pop 2.8s ease-in-out ${i * .25}s infinite; }`).join('')}
     @keyframes cb-pop { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-5px) } }
     ${pulse('cb', 'cb-lock', 2.4)} ${sparkAnim('cb', 3)}`),

  /* ─── Stickman Sword Duel: neon fighters ─── */
  stickmanswordduel: scene('ssd', '', `
    <rect x="20" y="100" width="200" height="14" rx="3" fill="var(--room2)" stroke="var(--line)" stroke-width="1.5"/>
    <g class="ssd-p1">
      <circle cx="78" cy="58" r="8" fill="var(--p1)"/>
      <path d="M78 66 V92 M66 74 H90 M78 92 L68 108 M78 92 L88 108" stroke="var(--p1)" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M90 72 L118 54" stroke="var(--candle)" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="118" cy="54" r="3" fill="var(--candle)" filter="url(#ssd-glow)"/>
    </g>
    <g class="ssd-p2">
      <circle cx="162" cy="58" r="8" fill="var(--p2)"/>
      <path d="M162 66 V92 M148 74 H176 M162 92 L152 108 M162 92 L172 108" stroke="var(--p2)" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M148 72 L122 56" stroke="var(--candle)" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="122" cy="56" r="3" fill="var(--candle)" filter="url(#ssd-glow)"/>
    </g>
    ${sparks('ssd', [[40, 28, 1.6, 'var(--p1)'], [200, 36, 1.6, 'var(--p2)'], [120, 22, 1.4, 'var(--candle)']])}`,
    `.ssd-p1 { animation: ssd-lunge 2.4s ease-in-out infinite; }
     .ssd-p2 { animation: ssd-lunge 2.4s ease-in-out .3s infinite reverse; }
     @keyframes ssd-lunge { 0%,100% { transform: translateX(0) } 50% { transform: translateX(6px) } }
     ${sparkAnim('ssd', 3)}`),

  /* ─── Micro Soccer: cars + ball ─── */
  microsoccer: scene('msc', '', `
    <rect x="28" y="28" width="184" height="86" rx="8" fill="#15291B" stroke="var(--line)" stroke-width="2"/>
    <path d="M120 28 V114" stroke="rgba(255,255,255,.2)" stroke-width="2"/>
    <circle cx="120" cy="71" r="16" fill="none" stroke="rgba(255,255,255,.2)" stroke-width="2"/>
    <!-- Left goal: posts + net -->
    <path d="M28 52 L40 56 L40 86 L28 90 Z" fill="var(--p1)" opacity=".18"/>
    <path d="M28 52 L40 56 M28 60 L40 63 M28 68 L40 70 M28 76 L40 77 M28 84 L40 84 M28 90 L40 86"
          stroke="rgba(230,235,240,.35)" stroke-width="0.8" fill="none"/>
    <rect x="28" y="50" width="3" height="42" fill="#F2F4F7"/>
    <rect x="37" y="56" width="3" height="30" fill="#F2F4F7"/>
    <path d="M28 52 L40 56 L40 58 L28 54 Z" fill="#F2F4F7"/>
    <!-- Right goal -->
    <path d="M212 52 L200 56 L200 86 L212 90 Z" fill="var(--p2)" opacity=".18"/>
    <path d="M212 52 L200 56 M212 60 L200 63 M212 68 L200 70 M212 76 L200 77 M212 84 L200 84 M212 90 L200 86"
          stroke="rgba(230,235,240,.35)" stroke-width="0.8" fill="none"/>
    <rect x="209" y="50" width="3" height="42" fill="#F2F4F7"/>
    <rect x="200" y="56" width="3" height="30" fill="#F2F4F7"/>
    <path d="M212 52 L200 56 L200 58 L212 54 Z" fill="#F2F4F7"/>
    <g class="msc-carA">
      <!-- F1 top-down: nose left, rear wing right -->
      <rect x="50" y="62" width="5" height="3" rx="1" fill="#1a1a1e"/>
      <rect x="50" y="77" width="5" height="3" rx="1" fill="#1a1a1e"/>
      <rect x="70" y="61" width="6" height="3" rx="1" fill="#1a1a1e"/>
      <rect x="70" y="78" width="6" height="3" rx="1" fill="#1a1a1e"/>
      <rect x="48" y="64" width="4" height="14" rx="1" fill="var(--p1)"/>
      <path d="M52 68 L62 65 L68 66 L68 76 L62 77 L52 74 Z" fill="var(--p1)"/>
      <ellipse cx="62" cy="71" rx="3.5" ry="2.5" fill="rgba(20,22,28,.85)"/>
      <rect x="72" y="63" width="3" height="16" rx="0.5" fill="var(--p1)" opacity=".85"/>
    </g>
    <g class="msc-carB">
      <rect x="185" y="62" width="5" height="3" rx="1" fill="#1a1a1e"/>
      <rect x="185" y="77" width="5" height="3" rx="1" fill="#1a1a1e"/>
      <rect x="164" y="61" width="6" height="3" rx="1" fill="#1a1a1e"/>
      <rect x="164" y="78" width="6" height="3" rx="1" fill="#1a1a1e"/>
      <rect x="188" y="64" width="4" height="14" rx="1" fill="var(--p2)"/>
      <path d="M188 68 L178 65 L172 66 L172 76 L178 77 L188 74 Z" fill="var(--p2)"/>
      <ellipse cx="178" cy="71" rx="3.5" ry="2.5" fill="rgba(20,22,28,.85)"/>
      <rect x="165" y="63" width="3" height="16" rx="0.5" fill="var(--p2)" opacity=".85"/>
    </g>
    <circle class="msc-ball" cx="120" cy="71" r="7" fill="var(--candle)" filter="url(#msc-glow)"/>
    ${sparks('msc', [[44, 40, 1.5, 'var(--p1)'], [196, 100, 1.5, 'var(--p2)']])}`,
    `.msc-carA { animation: msc-drive 2.4s ease-in-out infinite; }
     .msc-carB { animation: msc-drive 2.4s ease-in-out .4s infinite reverse; }
     @keyframes msc-drive { 0%,100% { transform: translateX(0) } 50% { transform: translateX(8px) } }
     .msc-ball { animation: msc-bounce 1.6s ease-in-out infinite; }
     @keyframes msc-bounce { 0%,100% { transform: translate(0,0) } 50% { transform: translate(10px,-6px) } }
     ${sparkAnim('msc', 2)}`),

  /* ─── Heart Duel: pop grid ─── */
  moleduel: scene('md', '', `
    <g class="md-holes">
      ${[[48,42],[96,42],[144,42],[192,42],[48,82],[96,82],[144,82],[192,82]].map(([x,y]) =>
        `<circle cx="${x}" cy="${y}" r="14" fill="var(--room2)" stroke="var(--line)" stroke-width="2"/>`
      ).join('')}
    </g>
    <g class="md-heart">
      <path d="M96 78 C96 68 108 64 116 72 C124 64 136 68 136 78 C136 90 116 102 116 102 C116 102 96 90 96 78Z"
        fill="var(--p2)" filter="url(#md-glow)"/>
    </g>
    <g class="md-ring">
      <circle cx="144" cy="42" r="9" fill="none" stroke="var(--candle)" stroke-width="3"/>
      <circle cx="149" cy="36" r="3" fill="var(--candle)"/>
    </g>
    ${sparks('md', [[70, 24, 1.5, 'var(--p2)'], [180, 108, 1.5, 'var(--candle)']])}`,
    `.md-heart { animation: md-pop 1.8s ease-in-out infinite; transform-box: fill-box; transform-origin: 116px 90px; }
     .md-ring { animation: md-pop 1.8s ease-in-out .55s infinite; transform-box: fill-box; transform-origin: 144px 42px; }
     @keyframes md-pop { 0%,100% { transform: translateY(10px); opacity: .35 } 40%,60% { transform: translateY(0); opacity: 1 } }
     ${sparkAnim('md', 2)}`),

  /* ─── Auction Duel: trophy cabinet + coins ─── */
  auctionduel: scene('auc', '', `
    <g class="auc-podium">
      <rect x="70" y="78" width="100" height="28" rx="4" fill="var(--room2)" stroke="var(--line)" stroke-width="2"/>
      <rect x="96" y="62" width="48" height="16" rx="3" fill="var(--candle)" opacity=".35"/>
    </g>
    <g class="auc-trophy">
      <circle cx="120" cy="48" r="16" fill="var(--candle)" filter="url(#auc-glow)" opacity=".9"/>
      <path d="M112 42 Q120 34 128 42" stroke="var(--night)" stroke-width="2" fill="none"/>
      <rect x="116" y="54" width="8" height="10" rx="1" fill="var(--candle)"/>
      <rect x="110" y="62" width="20" height="4" rx="1" fill="var(--candle)"/>
    </g>
    <g class="auc-coinL">
      <circle cx="48" cy="70" r="12" fill="var(--p1)" opacity=".85"/>
      <text x="48" y="74" text-anchor="middle" font-family="'Fraunces',serif" font-weight="900" font-size="11" fill="var(--night)">$</text>
    </g>
    <g class="auc-coinR">
      <circle cx="192" cy="70" r="12" fill="var(--p2)" opacity=".85"/>
      <text x="192" y="74" text-anchor="middle" font-family="'Fraunces',serif" font-weight="900" font-size="11" fill="var(--night)">$</text>
    </g>
    <g font-family="'JetBrains Mono',monospace" font-weight="700" font-size="10" fill="var(--dim)">
      <text x="48" y="98" text-anchor="middle">bid?</text>
      <text x="192" y="98" text-anchor="middle">bid?</text>
    </g>
    ${sparks('auc', [[88, 28, 1.5, 'var(--candle)'], [152, 32, 1.4, 'var(--p1)'], [120, 110, 1.5, 'var(--p2)']])}`,
    `.auc-trophy { animation: auc-bob 2.4s ease-in-out infinite; }
     @keyframes auc-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-5px) } }
     .auc-coinL { animation: auc-flip 2.8s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
     .auc-coinR { animation: auc-flip 2.8s ease-in-out .5s infinite; transform-box: fill-box; transform-origin: center; }
     @keyframes auc-flip { 0%,100% { transform: scaleX(1) } 50% { transform: scaleX(.55) } }
     ${sparkAnim('auc', 3)}`),

  /* ─── Number Fortress: IQ bids + towers ─── */
  numberfortress: scene('nf', '', `
    <g class="nf-towerA">
      <rect x="48" y="70" width="36" height="40" rx="4" fill="var(--p1)" opacity=".85"/>
      <rect x="54" y="58" width="24" height="14" rx="3" fill="var(--p1)"/>
      <rect x="60" y="48" width="12" height="12" rx="2" fill="var(--p1)"/>
    </g>
    <g class="nf-towerB">
      <rect x="156" y="78" width="36" height="32" rx="4" fill="var(--p2)" opacity=".85"/>
      <rect x="162" y="68" width="24" height="12" rx="3" fill="var(--p2)"/>
    </g>
    <g class="nf-chip">
      <rect x="88" y="36" width="64" height="22" rx="11" fill="var(--room2)" stroke="var(--candle)" stroke-width="2"/>
      <text x="120" y="51" text-anchor="middle" font-family="'JetBrains Mono',monospace" font-weight="700" font-size="11" fill="var(--candle)">bid 15</text>
    </g>
    <g font-family="'Fraunces',serif" font-weight="900" font-size="18" fill="var(--candle)">
      <text class="nf-qmark" x="120" y="100" text-anchor="middle">?</text>
    </g>
    ${sparks('nf', [[72, 30, 1.4, 'var(--p1)'], [168, 40, 1.5, 'var(--p2)'], [120, 118, 1.4, 'var(--candle)']])}`,
    `.nf-towerA { animation: nf-grow 2.6s ease-in-out infinite; transform-box: fill-box; transform-origin: bottom; }
     .nf-towerB { animation: nf-grow 2.6s ease-in-out .4s infinite; transform-box: fill-box; transform-origin: bottom; }
     @keyframes nf-grow { 0%,100% { transform: scaleY(1) } 50% { transform: scaleY(1.08) } }
     .nf-chip { animation: nf-pulse 2.2s ease-in-out infinite; }
     @keyframes nf-pulse { 0%,100% { opacity: .75 } 50% { opacity: 1 } }
     .nf-qmark { animation: nf-bob 2s ease-in-out infinite; }
     @keyframes nf-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-4px) } }
     ${sparkAnim('nf', 3)}`),

  /* ─── UNO: theme blue / candle / pink-red / pitch-green fan ─── */
  uno: scene('uno', `
    <linearGradient id="uno-blue" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="var(--p1)"/>
      <stop offset="100%" stop-color="color-mix(in srgb, var(--p1) 50%, var(--night))"/>
    </linearGradient>
    <linearGradient id="uno-yellow" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="var(--candle)"/>
      <stop offset="100%" stop-color="color-mix(in srgb, var(--candle) 50%, var(--night))"/>
    </linearGradient>
    <linearGradient id="uno-red" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="var(--p2)"/>
      <stop offset="100%" stop-color="color-mix(in srgb, var(--p2) 50%, var(--night))"/>
    </linearGradient>
    <linearGradient id="uno-green" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#2e5c40"/><stop offset="100%" stop-color="#15291B"/>
    </linearGradient>`, `
    <ellipse cx="148" cy="118" rx="88" ry="14" fill="var(--night)" opacity=".45"/>

    <g transform="translate(96 20) rotate(-22)">
      <g class="uno-c1">
        <rect width="52" height="78" rx="9" fill="url(#uno-blue)" stroke="color-mix(in srgb, var(--text) 45%, transparent)" stroke-width="2"/>
        <rect x="4" y="4" width="44" height="70" rx="7" fill="none" stroke="color-mix(in srgb, var(--text) 22%, transparent)" stroke-width="1.2"/>
        <ellipse cx="26" cy="39" rx="15" ry="24" fill="var(--text)" transform="rotate(-34 26 39)"/>
        <text x="26" y="47" text-anchor="middle" font-family="'Fraunces',serif" font-weight="900" font-size="26" fill="var(--p1)">7</text>
        <text x="11" y="18" font-family="'Fraunces',serif" font-weight="900" font-size="12" fill="var(--text)">7</text>
      </g>
    </g>
    <g transform="translate(122 14) rotate(-6)">
      <g class="uno-c2">
        <rect width="52" height="78" rx="9" fill="url(#uno-yellow)" stroke="color-mix(in srgb, var(--text) 45%, transparent)" stroke-width="2"/>
        <rect x="4" y="4" width="44" height="70" rx="7" fill="none" stroke="color-mix(in srgb, var(--text) 22%, transparent)" stroke-width="1.2"/>
        <ellipse cx="26" cy="39" rx="15" ry="24" fill="var(--text)" transform="rotate(-34 26 39)"/>
        <text x="26" y="47" text-anchor="middle" font-family="'Fraunces',serif" font-weight="900" font-size="26" fill="color-mix(in srgb, var(--candle) 70%, var(--night))">0</text>
        <text x="11" y="18" font-family="'Fraunces',serif" font-weight="900" font-size="12" fill="var(--night)">0</text>
      </g>
    </g>
    <g transform="translate(148 14) rotate(10)">
      <g class="uno-c3">
        <rect width="52" height="78" rx="9" fill="url(#uno-red)" stroke="color-mix(in srgb, var(--text) 45%, transparent)" stroke-width="2"/>
        <rect x="4" y="4" width="44" height="70" rx="7" fill="none" stroke="color-mix(in srgb, var(--text) 22%, transparent)" stroke-width="1.2"/>
        <ellipse cx="26" cy="39" rx="15" ry="24" fill="var(--text)" transform="rotate(-34 26 39)"/>
        <text x="26" y="47" text-anchor="middle" font-family="'Fraunces',serif" font-weight="900" font-size="26" fill="var(--p2)">2</text>
        <text x="11" y="18" font-family="'Fraunces',serif" font-weight="900" font-size="12" fill="var(--text)">2</text>
      </g>
    </g>
    <g transform="translate(174 22) rotate(24)">
      <g class="uno-c4">
        <rect width="52" height="78" rx="9" fill="url(#uno-green)" stroke="color-mix(in srgb, var(--text) 45%, transparent)" stroke-width="2"/>
        <rect x="4" y="4" width="44" height="70" rx="7" fill="none" stroke="color-mix(in srgb, var(--text) 22%, transparent)" stroke-width="1.2"/>
        <ellipse cx="26" cy="39" rx="15" ry="24" fill="var(--text)" transform="rotate(-34 26 39)"/>
        <text x="26" y="46" text-anchor="middle" font-family="'Fraunces',serif" font-weight="900" font-size="18" fill="#15291B">+2</text>
        <text x="9" y="18" font-family="'Fraunces',serif" font-weight="900" font-size="10" fill="var(--text)">+2</text>
      </g>
    </g>
    ${sparks('uno', [[40, 40, 1.4, 'var(--p1)'], [70, 100, 1.3, 'var(--p2)'], [210, 48, 1.4, 'var(--candle)'], [200, 110, 1.3, '#2e5c40']])}`,
    `.uno-c1 { animation: uno-fan 2.8s ease-in-out infinite; }
     .uno-c2 { animation: uno-fan 2.8s ease-in-out .15s infinite; }
     .uno-c3 { animation: uno-fan 2.8s ease-in-out .3s infinite; }
     .uno-c4 { animation: uno-fan 2.8s ease-in-out .45s infinite; }
     @keyframes uno-fan { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-5px) } }
     ${sparkAnim('uno', 4)}`),

  /* ─── Veilcourt: veiled influence fan, coin, court intrigue ─── */
  coup: scene('coup', `
    <linearGradient id="coup-veil" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="var(--p1)" stop-opacity=".18"/>
      <stop offset="100%" stop-color="var(--p2)" stop-opacity=".18"/>
    </linearGradient>
    <linearGradient id="coup-back" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="var(--room2)"/>
      <stop offset="100%" stop-color="var(--night)"/>
    </linearGradient>
    <linearGradient id="coup-face" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="var(--room2)"/>
      <stop offset="100%" stop-color="var(--room)"/>
    </linearGradient>
    <radialGradient id="coup-coinG" cx="35%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#ffe6a8"/>
      <stop offset="55%" stop-color="var(--candle)"/>
      <stop offset="100%" stop-color="color-mix(in srgb, var(--candle) 55%, var(--night))"/>
    </radialGradient>`, `
    <path d="M0 0 C60 40 90 20 120 50 C150 20 180 45 240 0 V130 H0 Z" fill="url(#coup-veil)" opacity=".7"/>
    <ellipse cx="120" cy="128" rx="100" ry="16" fill="var(--night)" opacity=".4"/>

    <g transform="translate(52 28) rotate(-18)">
      <g class="coup-c1">
        <rect width="48" height="72" rx="8" fill="url(#coup-back)" stroke="var(--line)" stroke-width="2"/>
        <rect x="5" y="5" width="38" height="62" rx="5" fill="none" stroke="color-mix(in srgb, var(--p1) 35%, transparent)" stroke-width="1.2"/>
        <circle cx="24" cy="34" r="11" fill="url(#coup-coinG)" opacity=".95"/>
        <text x="24" y="39" text-anchor="middle" font-family="'Fraunces',serif" font-weight="900" font-size="13" fill="var(--night)">V</text>
      </g>
    </g>
    <g transform="translate(86 20) rotate(-4)">
      <g class="coup-c2">
        <rect width="48" height="72" rx="8" fill="url(#coup-back)" stroke="var(--line)" stroke-width="2"/>
        <rect x="5" y="5" width="38" height="62" rx="5" fill="none" stroke="color-mix(in srgb, var(--p1) 35%, transparent)" stroke-width="1.2"/>
        <circle cx="24" cy="34" r="11" fill="url(#coup-coinG)" opacity=".95"/>
        <text x="24" y="39" text-anchor="middle" font-family="'Fraunces',serif" font-weight="900" font-size="13" fill="var(--night)">V</text>
      </g>
    </g>
    <g transform="translate(122 18) rotate(12)">
      <g class="coup-c3">
        <rect width="48" height="72" rx="8" fill="url(#coup-face)" stroke="var(--p2)" stroke-width="2"/>
        <rect x="5" y="5" width="38" height="62" rx="5" fill="none" stroke="color-mix(in srgb, var(--p2) 40%, transparent)" stroke-width="1.2"/>
        <circle cx="24" cy="28" r="8" fill="color-mix(in srgb, var(--p2) 55%, var(--text))" opacity=".9"/>
        <path d="M14 52 C14 40 34 40 34 52 Z" fill="var(--p1)" opacity=".85"/>
        <path d="M16 28 Q24 34 32 28" fill="none" stroke="var(--text)" stroke-width="1.6" stroke-linecap="round" opacity=".55"/>
        <text x="24" y="62" text-anchor="middle" font-family="'JetBrains Mono',monospace" font-weight="700" font-size="7" fill="var(--dim)" letter-spacing="0.5">CLAIM?</text>
      </g>
    </g>

    <g class="coup-coin" transform="translate(186 58)">
      <circle cx="16" cy="16" r="17" fill="var(--candle)" opacity=".22" filter="url(#coup-glow)"/>
      <circle cx="16" cy="16" r="13.5" fill="url(#coup-coinG)" stroke="color-mix(in srgb, var(--candle) 40%, var(--night))" stroke-width="1.5"/>
      <text x="16" y="21" text-anchor="middle" font-family="'Fraunces',serif" font-weight="900" font-size="13" fill="var(--night)">9</text>
    </g>

    <g font-family="'JetBrains Mono',monospace" font-weight="700" font-size="10" letter-spacing="0.4">
      <text x="36" y="118" fill="var(--p1)">bluff</text>
      <text x="96" y="118" fill="var(--p2)">challenge</text>
      <text x="172" y="118" fill="var(--candle)">corrupt</text>
    </g>
    ${sparks('coup', [[28, 36, 1.5, 'var(--p1)'], [210, 40, 1.5, 'var(--candle)'], [200, 108, 1.3, 'var(--p2)'], [70, 100, 1.2, 'var(--candle)']])}`,
    `.coup-c1 { animation: coup-fan 2.8s ease-in-out infinite; }
     .coup-c2 { animation: coup-fan 2.8s ease-in-out .15s infinite; }
     .coup-c3 { animation: coup-fan 2.8s ease-in-out .3s infinite; }
     @keyframes coup-fan { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-5px) } }
     .coup-coin { animation: coup-bob 2.2s ease-in-out infinite; }
     @keyframes coup-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-5px) } }
     ${sparkAnim('coup', 4)}`),

  /* ─── Carrot in a Box: centered gift fan ─── */
  carrot: scene('carrot', `
    <linearGradient id="carrot-boxA" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#4a5a88"/>
      <stop offset="100%" stop-color="#221B2D"/>
    </linearGradient>
    <linearGradient id="carrot-boxB" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#7a3d58"/>
      <stop offset="100%" stop-color="#221B2D"/>
    </linearGradient>
    <linearGradient id="carrot-body" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffb06a"/>
      <stop offset="55%" stop-color="#ff8a2b"/>
      <stop offset="100%" stop-color="#d45510"/>
    </linearGradient>`, `
    <ellipse cx="148" cy="116" rx="78" ry="12" fill="#191420" opacity=".5"/>

    <g transform="translate(98 24) rotate(-14)">
      <g class="carrot-boxA">
        <rect width="64" height="74" rx="11" fill="url(#carrot-boxA)" stroke="var(--p1)" stroke-width="2.6"/>
        <rect x="27" y="0" width="10" height="74" fill="var(--p1)" opacity=".65"/>
        <rect x="0" y="32" width="64" height="10" fill="var(--p1)" opacity=".65"/>
        <text x="32" y="48" text-anchor="middle" font-family="'Fraunces',serif" font-weight="900" font-size="22" fill="#F2EDF7" opacity=".55">?</text>
      </g>
    </g>
    <g transform="translate(138 20) rotate(12)">
      <g class="carrot-boxB">
        <rect width="64" height="74" rx="11" fill="url(#carrot-boxB)" stroke="var(--p2)" stroke-width="2.6"/>
        <rect x="27" y="0" width="10" height="74" fill="var(--p2)" opacity=".65"/>
        <rect x="0" y="32" width="64" height="10" fill="var(--p2)" opacity=".65"/>
        <g transform="translate(19 14)">
          <g class="carrot-veg">
            <path d="M8 15c0 11 2.6 18 5.2 18s5.2-7 5.2-18c0-4.2-2-7.5-5.2-7.5S8 10.8 8 15z" fill="url(#carrot-body)"/>
            <path d="M10.8 9c-1.3-4.6-4-7-4-7 .9 2.4.5 4.8.5 4.8Z" fill="#3d9a4e"/>
            <path d="M13.2 8.2c.2-4.6 3-7.4 3-7.4-.2 2.8.4 5.2.4 5.2Z" fill="#55c068"/>
            <path d="M15.4 9.4c1.7-3.8 4.5-5.6 4.5-5.6-1.5 2.2-1.7 4.6-1.7 4.6Z" fill="#2f7d3c"/>
            <path d="M10 19h6.5M9.6 23h7.2" stroke="#b04810" stroke-width="1" stroke-linecap="round" opacity=".55"/>
          </g>
        </g>
      </g>
    </g>
    ${sparks('carrot', [[72, 36, 1.5, 'var(--p1)'], [210, 34, 1.5, 'var(--p2)'], [148, 118, 1.3, 'var(--candle)']])}`,
    `.carrot-boxA { animation: carrot-bob 2.5s ease-in-out infinite; }
     .carrot-boxB { animation: carrot-bob 2.5s ease-in-out .2s infinite; }
     @keyframes carrot-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-5px) } }
     .carrot-veg { animation: carrot-wiggle 1.7s ease-in-out infinite; transform-origin: 13px 20px; transform-box: fill-box; }
     @keyframes carrot-wiggle { 0%,100% { transform: rotate(-7deg) } 50% { transform: rotate(7deg) } }
     ${sparkAnim('carrot', 3)}`),

  /* ─── Minus One: same logos as in-game NeonRpsIcon ─── */
  minusone: (() => {
    const hand = (id, x, y, rot, s = 0.22) => `
      <g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">
        <g class="mo-${id}">
          <path d="${NEON_PATHS[id]}" fill="${NEON[id]}"/>
        </g>
      </g>`;
    const lbl = (x, y, id, t, size = 7) =>
      `<text x="${x}" y="${y}" text-anchor="middle" font-family="'JetBrains Mono',monospace" font-weight="700" font-size="${size}" fill="${NEON[id]}" letter-spacing="1" opacity=".85">${t}</text>`;

    return scene('mo', '', `
    <ellipse cx="150" cy="118" rx="64" ry="9" fill="#191420" opacity=".4"/>

    <g transform="translate(148 54)">
      <g class="mo-badge">
        <circle r="11" fill="var(--room2)" stroke="var(--candle)" stroke-width="2"/>
        <text text-anchor="middle" y="4" font-family="'Fraunces',serif" font-weight="900" font-size="11" fill="var(--candle)">\u22121</text>
      </g>
    </g>

    ${hand('rock', 78, 42, -14)}
    ${lbl(106, 108, 'rock', 'ROCK')}

    ${hand('scissors', 148, 8, 10, 0.2)}
    ${lbl(174, 72, 'scissors', 'SCISSORS', 6)}

    ${hand('paper', 178, 58, -6, 0.2)}
    ${lbl(204, 118, 'paper', 'PAPER')}

    ${sparks('mo', [[64, 36, 1.4, NEON.rock], [196, 14, 1.4, NEON.scissors], [220, 90, 1.4, NEON.paper]])}`,
    `.mo-badge { animation: mo-badge 2.6s ease-in-out infinite; }
     @keyframes mo-badge { 0%,100% { transform: translate(0,0) scale(1) } 50% { transform: translate(0,-3px) scale(1.05) } }
     .mo-rock { animation: mo-flyA 3.6s ease-in-out infinite; }
     .mo-scissors { animation: mo-flyB 3s ease-in-out .2s infinite; }
     .mo-paper { animation: mo-flyC 3.8s ease-in-out .45s infinite; }
     @keyframes mo-flyA {
       0%,100% { transform: translate(0,0) }
       33% { transform: translate(4px,-7px) }
       66% { transform: translate(-3px,-2px) }
     }
     @keyframes mo-flyB {
       0%,100% { transform: translate(0,0) }
       40% { transform: translate(-5px,4px) }
       70% { transform: translate(3px,-6px) }
     }
     @keyframes mo-flyC {
       0%,100% { transform: translate(0,0) }
       35% { transform: translate(-3px,-7px) }
       65% { transform: translate(5px,2px) }
     }
     ${sparkAnim('mo', 3)}`);
  })(),

  /* ─── Chkobba: French-suited capture fan ─── */
  chkobba: scene('ck', `
    <linearGradient id="ck-face" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FBF6EA"/>
      <stop offset="100%" stop-color="#EDE5D0"/>
    </linearGradient>
    <linearGradient id="ck-back" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#33284A"/>
      <stop offset="100%" stop-color="#2A2140"/>
    </linearGradient>`, `
    <ellipse cx="148" cy="118" rx="86" ry="12" fill="#191420" opacity=".5"/>
    <ellipse cx="148" cy="72" rx="70" ry="42" fill="#23303F" opacity=".55"/>

    <g transform="translate(96 22) rotate(-18)">
      <g class="ck-c1">
        <rect width="50" height="76" rx="8" fill="url(#ck-back)" stroke="var(--line)" stroke-width="2"/>
        <rect x="6" y="8" width="38" height="60" rx="4" fill="none" stroke="var(--candle)" stroke-width="1.2" opacity=".35"/>
      </g>
    </g>
    <g transform="translate(122 16) rotate(-4)">
      <g class="ck-c2">
        <rect width="50" height="76" rx="8" fill="url(#ck-face)" stroke="#c9b89a" stroke-width="1.6"/>
        <text x="10" y="20" font-family="'Fraunces',serif" font-weight="900" font-size="14" fill="#C62828">7</text>
        <text x="10" y="34" font-size="12" fill="#C62828">♦</text>
        <text x="25" y="52" text-anchor="middle" font-size="20" fill="#C62828">♦</text>
        <text x="25" y="70" text-anchor="middle" font-family="'JetBrains Mono',monospace" font-weight="700" font-size="7" fill="#C62828" letter-spacing=".4">7AYA</text>
      </g>
    </g>
    <g transform="translate(150 18) rotate(14)">
      <g class="ck-c3">
        <rect width="50" height="76" rx="8" fill="url(#ck-face)" stroke="#c9b89a" stroke-width="1.6"/>
        <text x="10" y="20" font-family="'Fraunces',serif" font-weight="900" font-size="14" fill="#1E1A24">K</text>
        <text x="10" y="34" font-size="12" fill="#1E1A24">♠</text>
        <text x="25" y="54" text-anchor="middle" font-size="22" fill="#1E1A24">♠</text>
      </g>
    </g>
    ${sparks('ck', [[70, 36, 1.5, 'var(--candle)'], [210, 40, 1.5, 'var(--p2)'], [148, 118, 1.3, 'var(--p1)']])}`,
    `.ck-c1 { animation: ck-bob 2.6s ease-in-out infinite; }
     .ck-c2 { animation: ck-bob 2.6s ease-in-out .15s infinite; }
     .ck-c3 { animation: ck-bob 2.6s ease-in-out .3s infinite; }
     @keyframes ck-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-4px) } }
     ${sparkAnim('ck', 3)}`),

  /* ─── Word Bomb: hot-potato fragment fuse ─── */
  wordbomb: scene('wb', '', `
    <g class="wb-bomb">
      <circle cx="120" cy="72" r="28" fill="var(--room2)" stroke="var(--candle)" stroke-width="2.5"/>
      <circle cx="120" cy="72" r="22" fill="var(--night)" opacity=".55"/>
      <path d="M136 52 Q148 40 156 34" stroke="var(--candle)" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <circle class="wb-spark" cx="158" cy="32" r="4" fill="var(--candle)"/>
      <text x="120" y="78" text-anchor="middle" font-family="'Fraunces',serif" font-weight="900" font-size="18" fill="var(--candle)">OR</text>
    </g>
    <g font-family="'JetBrains Mono',monospace" font-weight="700" font-size="11" fill="var(--dim)">
      <text x="48" y="108" text-anchor="middle">pass</text>
      <text x="192" y="108" text-anchor="middle">boom?</text>
    </g>
    ${sparks('wb', [[88, 36, 1.5, 'var(--candle)'], [168, 48, 1.4, 'var(--p2)'], [120, 118, 1.4, 'var(--p1)']])}`,
    `.wb-bomb { animation: wb-tick 1.6s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
     @keyframes wb-tick { 0%,100% { transform: rotate(-5deg) } 50% { transform: rotate(5deg) } }
     .wb-spark { animation: wb-glow 0.7s ease-in-out infinite; }
     @keyframes wb-glow { 0%,100% { opacity: .45 } 50% { opacity: 1 } }
     ${sparkAnim('wb', 3)}`),

  /* ─── Forbidden Words: trap words in a Q&A ─── */
  forbiddenwords: scene('fw', '', `
    <g class="fw-q">
      <path d="M28 28 h78 a10 10 0 0 1 10 10 v22 a10 10 0 0 1 -10 10 h-50 l-12 12 v-12 h-16 a10 10 0 0 1 -10 -10 v-22 a10 10 0 0 1 10 -10 Z"
        fill="var(--room)" stroke="var(--p1)" stroke-width="2.2"/>
      <text x="72" y="54" text-anchor="middle" font-family="'Fraunces',serif" font-weight="900" font-size="20" fill="var(--p1)">?</text>
    </g>
    <g class="fw-a">
      <path d="M212 42 h-70 a10 10 0 0 0 -10 10 v20 a10 10 0 0 0 10 10 h44 l12 12 v-12 h14 a10 10 0 0 0 10 -10 v-20 a10 10 0 0 0 -10 -10 Z"
        fill="var(--room2)" stroke="var(--p2)" stroke-width="2.2"/>
      <text x="172" y="66" text-anchor="middle" font-family="'JetBrains Mono',monospace" font-weight="700" font-size="11" fill="var(--dim)">····</text>
    </g>
    <g font-family="'JetBrains Mono',monospace" font-weight="700" font-size="12">
      <g class="fw-trap0">
        <rect x="36" y="96" width="52" height="22" rx="11" fill="var(--room2)" stroke="var(--candle)" stroke-width="2"/>
        <text x="62" y="111" text-anchor="middle" fill="var(--candle)">love</text>
        <path d="M44 107 L80 107" stroke="var(--candle)" stroke-width="2.2" stroke-linecap="round"/>
      </g>
      <g class="fw-trap1">
        <rect x="94" y="96" width="52" height="22" rx="11" fill="var(--room2)" stroke="var(--p2)" stroke-width="2"/>
        <text x="120" y="111" text-anchor="middle" fill="var(--p2)">yes</text>
        <path d="M104 107 L136 107" stroke="var(--p2)" stroke-width="2.2" stroke-linecap="round"/>
      </g>
      <g class="fw-trap2">
        <rect x="152" y="96" width="52" height="22" rx="11" fill="var(--room2)" stroke="var(--p1)" stroke-width="2"/>
        <text x="178" y="111" text-anchor="middle" fill="var(--p1)">like</text>
        <path d="M160 107 L196 107" stroke="var(--p1)" stroke-width="2.2" stroke-linecap="round"/>
      </g>
    </g>
    ${sparks('fw', [[118, 24, 1.6, 'var(--candle)'], [48, 86, 1.4, 'var(--p1)'], [200, 88, 1.5, 'var(--p2)']])}`,
    `.fw-q { animation: fw-bob 3.2s ease-in-out infinite; }
     .fw-a { animation: fw-bob 3.2s ease-in-out 1.6s infinite; }
     @keyframes fw-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-4px) } }
     .fw-trap0 { animation: fw-ban 2.6s ease-in-out infinite; }
     .fw-trap1 { animation: fw-ban 2.6s ease-in-out .35s infinite; }
     .fw-trap2 { animation: fw-ban 2.6s ease-in-out .7s infinite; }
     @keyframes fw-ban { 0%,100% { opacity: .7; transform: translateY(0) } 50% { opacity: 1; transform: translateY(-3px) } }
     ${sparkAnim('fw', 3)}`),

  /* ─── Ready, Set, Cook: co-op kitchen ─── */
  readysetcook: scene('rsc', '', `
    <rect x="36" y="88" width="168" height="28" rx="6" fill="var(--room2)" stroke="var(--line)" stroke-width="2"/>
    <path d="M36 102 H204" stroke="var(--line)" stroke-width="1" stroke-dasharray="6 8" opacity=".5"/>
    <g class="rsc-pot">
      <ellipse cx="88" cy="78" rx="26" ry="10" fill="var(--candle)" opacity=".35"/>
      <path d="M68 78 Q68 52 88 48 Q108 52 108 78 Z" fill="var(--room)" stroke="var(--candle)" stroke-width="2.5"/>
      <path d="M74 56 Q88 42 102 56" stroke="var(--p2)" stroke-width="3" fill="none" stroke-linecap="round"/>
    </g>
    <g class="rsc-pan">
      <ellipse cx="156" cy="80" rx="22" ry="8" fill="var(--p1)" opacity=".3"/>
      <ellipse cx="156" cy="76" rx="20" ry="6" fill="var(--room2)" stroke="var(--p1)" stroke-width="2"/>
      <path d="M176 72 L192 64" stroke="var(--dim)" stroke-width="4" stroke-linecap="round"/>
    </g>
    <g class="rsc-chef">
      <circle cx="120" cy="38" r="14" fill="var(--candle)" filter="url(#rsc-glow)" opacity=".5"/>
      <circle cx="120" cy="38" r="12" fill="var(--candle)"/>
      <path d="M108 30 Q120 18 132 30 L128 34 Q120 26 112 34 Z" fill="#FFFBF4" stroke="var(--line)" stroke-width="1"/>
    </g>
    ${sparks('rsc', [[44, 24, 1.8, 'var(--candle)'], [196, 100, 1.6, 'var(--p2)'], [120, 108, 1.5, 'var(--p1)']])}`,
    `.rsc-pot { animation: rsc-bubble 2.6s ease-in-out infinite; }
     .rsc-pan { animation: rsc-sizzle 2.2s ease-in-out .4s infinite; }
     @keyframes rsc-bubble { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-4px) } }
     @keyframes rsc-sizzle { 0%,100% { transform: rotate(0deg) } 50% { transform: rotate(-3deg) } }
     .rsc-chef { animation: rsc-bob 3s ease-in-out infinite; }
     @keyframes rsc-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-3px) } }
     ${sparkAnim('rsc', 3)}`),

  /* ─── Thin Ice: melting lake + two orbs ─── */
  thinice: scene('ti', `
    <linearGradient id="ti-ice" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#DCEBF5"/>
      <stop offset="55%" stop-color="#AFC9DC"/>
      <stop offset="100%" stop-color="#7E9DB8"/>
    </linearGradient>
    <linearGradient id="ti-water" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#131C2C"/>
      <stop offset="100%" stop-color="#0C1524"/>
    </linearGradient>
    <radialGradient id="ti-orbA" cx="34%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#D6E4FF"/>
      <stop offset="45%" stop-color="var(--p1)"/>
      <stop offset="100%" stop-color="#3A5CA8"/>
    </radialGradient>
    <radialGradient id="ti-orbB" cx="34%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#FFDCE8"/>
      <stop offset="45%" stop-color="var(--p2)"/>
      <stop offset="100%" stop-color="#B04A72"/>
    </radialGradient>`, `
    <ellipse cx="120" cy="116" rx="78" ry="10" fill="#191420" opacity=".45"/>
    <rect x="48" y="22" width="144" height="92" rx="14" fill="url(#ti-water)" stroke="var(--line)" stroke-width="2"/>
    <g transform="translate(58 32)">
      ${[0,1,2,3].map(r => [0,1,2,3].map(c => {
        const gone = (r === 1 && c === 1) || (r === 2 && c === 2) || (r === 0 && c === 3);
        return `<rect class="${gone ? 'ti-gone' : 'ti-tile'}" x="${c * 32}" y="${r * 20}" width="28" height="16" rx="4" fill="${gone ? '#0C1524' : 'url(#ti-ice)'}" opacity="${gone ? '.85' : '1'}"/>`;
      }).join('')).join('')}
      <g class="ti-orbA"><circle cx="14" cy="28" r="7" fill="url(#ti-orbA)" filter="url(#ti-glow)"/></g>
      <g class="ti-orbB"><circle cx="110" cy="68" r="7" fill="url(#ti-orbB)" filter="url(#ti-glow)"/></g>
    </g>
    ${sparks('ti', [[42, 28, 1.5, 'var(--p1)'], [198, 40, 1.5, 'var(--p2)'], [120, 108, 1.3, 'var(--candle)']])}`,
    `.ti-orbA { animation: ti-bob 2.4s ease-in-out infinite; }
     .ti-orbB { animation: ti-bob 2.4s ease-in-out .35s infinite; }
     @keyframes ti-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-4px) } }
     .ti-gone { animation: ti-fade 3.2s ease-in-out infinite; }
     @keyframes ti-fade { 0%,100% { opacity: .55 } 50% { opacity: .9 } }
     ${sparkAnim('ti', 3)}`),

  /* ─── Loop Duel: stadium circuit + two cars ─── */
  loopduel: scene('ld', `
    <linearGradient id="ld-grass" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#16211A"/>
      <stop offset="100%" stop-color="#101A14"/>
    </linearGradient>`, `
    <rect width="240" height="130" fill="url(#ld-grass)"/>
    <ellipse cx="120" cy="66" rx="78" ry="42" fill="none" stroke="#2E3038" stroke-width="18"/>
    <ellipse cx="120" cy="66" rx="78" ry="42" fill="none" stroke="var(--candle)" stroke-width="2.5" stroke-dasharray="8 7" opacity=".7"/>
    <rect x="116" y="20" width="8" height="18" fill="#EDE8F2" opacity=".9"/>
    <rect x="116" y="20" width="4" height="9" fill="#1A1420"/>
    <rect x="120" y="29" width="4" height="9" fill="#1A1420"/>
    <g class="ld-carA">
      <rect x="88" y="28" width="16" height="9" rx="3" fill="var(--p1)"/>
      <rect x="96" y="30" width="5" height="5" rx="1" fill="rgba(10,10,18,.5)"/>
    </g>
    <g class="ld-carB">
      <rect x="136" y="94" width="16" height="9" rx="3" fill="var(--p2)"/>
      <rect x="144" y="96" width="5" height="5" rx="1" fill="rgba(10,10,18,.5)"/>
    </g>
    <path d="M148 34 L156 40 L148 46 L151 40 Z" fill="rgba(111,220,168,.8)"/>
    <path d="M158 34 L166 40 L158 46 L161 40 Z" fill="rgba(111,220,168,.8)"/>
    <ellipse cx="92" cy="96" rx="14" ry="7" fill="rgba(70,60,110,.55)"/>
    ${sparks('ld', [[44, 36, 1.5, 'var(--p1)'], [196, 96, 1.5, 'var(--p2)'], [120, 66, 1.3, 'var(--candle)']])}`,
    `.ld-carA { animation: ld-drive 2.8s ease-in-out infinite; }
     .ld-carB { animation: ld-drive 2.8s ease-in-out .5s infinite reverse; }
     @keyframes ld-drive { 0%,100% { transform: translate(0,0) } 50% { transform: translate(10px,4px) } }
     ${sparkAnim('ld', 3)}`)
};

export const artFor = id => ART[id] || null;
