// engines/art.js — card artwork for the shelf. One SVG per game, keyed by id.
// Every color is a CSS variable, so the art re-tints itself live when a
// Duo Pass theme changes. No image files, no loading, always crisp.

const svg = inner =>
  `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" fill="none">${inner}</svg>`;

export const ART = {

  ttt: svg(`
    <g stroke="var(--line)" stroke-width="5" stroke-linecap="round">
      <path d="M45 15 V105 M75 15 V105 M15 45 H105 M15 75 H105"/>
    </g>
    <g stroke="var(--p1)" stroke-width="7" stroke-linecap="round">
      <path d="M22 22 L38 38 M38 22 L22 38"/>
      <path d="M82 82 L98 98 M98 82 L82 98"/>
    </g>
    <circle cx="60" cy="60" r="11" stroke="var(--p2)" stroke-width="7"/>
    <circle cx="90" cy="30" r="11" stroke="var(--p2)" stroke-width="7"/>`),

  connect4: svg(`
    <rect x="10" y="22" width="100" height="86" rx="12" fill="var(--room2)" stroke="var(--line)" stroke-width="3"/>
    <g>
      <circle cx="32" cy="88" r="9" fill="var(--p1)"/>
      <circle cx="60" cy="88" r="9" fill="var(--p2)"/>
      <circle cx="88" cy="88" r="9" fill="var(--p1)"/>
      <circle cx="32" cy="64" r="9" fill="var(--p2)"/>
      <circle cx="60" cy="64" r="9" fill="var(--p1)"/>
      <circle cx="88" cy="64" r="9" fill="var(--night)"/>
      <circle cx="32" cy="40" r="9" fill="var(--night)"/>
      <circle cx="60" cy="40" r="9" fill="var(--night)"/>
      <circle cx="88" cy="40" r="9" fill="var(--night)"/>
    </g>
    <circle cx="60" cy="10" r="9" fill="var(--candle)"/>`),

  dots: svg(`
    <rect x="27" y="27" width="33" height="33" fill="var(--p1s)"/>
    <g stroke="var(--candle)" stroke-width="6" stroke-linecap="round">
      <path d="M27 27 H60 M27 60 H60 M27 27 V60 M60 27 V60"/>
      <path d="M60 27 H93"/>
    </g>
    <path d="M93 27 V60" stroke="var(--p2)" stroke-width="6" stroke-linecap="round" stroke-dasharray="2 9"/>
    <g fill="var(--text)">
      <circle cx="27" cy="27" r="6"/><circle cx="60" cy="27" r="6"/><circle cx="93" cy="27" r="6"/>
      <circle cx="27" cy="60" r="6"/><circle cx="60" cy="60" r="6"/><circle cx="93" cy="60" r="6"/>
      <circle cx="27" cy="93" r="6"/><circle cx="60" cy="93" r="6"/><circle cx="93" cy="93" r="6"/>
    </g>`),

  reversi: svg(`
    <circle cx="26" cy="60" r="16" fill="var(--p2)"/>
    <ellipse cx="60" cy="60" rx="7" ry="16" fill="var(--dim)"/>
    <circle cx="94" cy="60" r="16" fill="var(--p1)"/>
    <circle cx="43" cy="26" r="10" fill="var(--p1)" opacity=".8"/>
    <circle cx="77" cy="94" r="10" fill="var(--p2)" opacity=".8"/>`),

  gomoku: svg(`
    <g stroke="var(--line)" stroke-width="3">
      <path d="M15 30 H105 M15 60 H105 M15 90 H105"/>
      <path d="M30 15 V105 M60 15 V105 M90 15 V105"/>
    </g>
    <circle cx="30" cy="90" r="10" fill="var(--p1)"/>
    <circle cx="45" cy="75" r="10" fill="var(--p1)"/>
    <circle cx="60" cy="60" r="10" fill="var(--p1)"/>
    <circle cx="75" cy="45" r="10" fill="var(--p1)"/>
    <circle cx="90" cy="30" r="10" fill="var(--candle)"/>
    <circle cx="90" cy="90" r="10" fill="var(--p2)"/>
    <circle cx="30" cy="30" r="10" fill="var(--p2)"/>`),

  memory: svg(`
    <g transform="rotate(-8 40 62)">
      <rect x="16" y="30" width="46" height="64" rx="9" fill="var(--room2)" stroke="var(--line)" stroke-width="3"/>
      <path d="M28 50 q11 -12 22 0 q-11 14 -22 0 M28 74 q11 -12 22 0 q-11 14 -22 0"
        stroke="var(--dim)" stroke-width="3" opacity=".6"/>
    </g>
    <g transform="rotate(8 82 62)">
      <rect x="58" y="26" width="46" height="64" rx="9" fill="var(--room)" stroke="var(--candle)" stroke-width="3"/>
      <path d="M81 72 C70 62 66 52 74 46 C79 42 81 48 81 50 C81 48 83 42 88 46 C96 52 92 62 81 72 Z"
        fill="var(--p2)"/>
    </g>`),

  pong: svg(`
    <path d="M60 12 V108" stroke="var(--line)" stroke-width="4" stroke-dasharray="6 10"/>
    <rect x="12" y="34" width="9" height="34" rx="4" fill="var(--p1)"/>
    <rect x="99" y="58" width="9" height="34" rx="4" fill="var(--p2)"/>
    <circle cx="72" cy="48" r="8" fill="var(--candle)"/>
    <g stroke="var(--candle)" stroke-width="4" stroke-linecap="round" opacity=".5">
      <path d="M58 56 L48 64 M52 50 L44 56"/>
    </g>`),

  sketch: svg(`
    <path d="M18 86 q18 -34 34 -18 q16 16 30 -8 q8 -14 20 -10"
      stroke="var(--p2)" stroke-width="6" stroke-linecap="round"/>
    <g transform="rotate(38 88 78)">
      <rect x="80" y="52" width="16" height="42" rx="3" fill="var(--candle)"/>
      <path d="M80 94 L88 110 L96 94 Z" fill="var(--text)"/>
      <rect x="80" y="46" width="16" height="8" rx="2" fill="var(--p1)"/>
    </g>`),

  wordrace: svg(`
    <g transform="rotate(-6 34 46)">
      <rect x="16" y="28" width="36" height="36" rx="8" fill="var(--room2)" stroke="var(--p1)" stroke-width="3"/>
      <text x="34" y="54" text-anchor="middle" font-family="'JetBrains Mono',monospace"
        font-weight="700" font-size="22" fill="var(--p1)">G</text>
    </g>
    <g transform="rotate(5 72 58)">
      <rect x="54" y="40" width="36" height="36" rx="8" fill="var(--room2)" stroke="var(--candle)" stroke-width="3"/>
      <text x="72" y="66" text-anchor="middle" font-family="'JetBrains Mono',monospace"
        font-weight="700" font-size="22" fill="var(--candle)">O</text>
    </g>
    <g transform="rotate(-4 96 88)">
      <rect x="78" y="70" width="36" height="36" rx="8" fill="var(--room2)" stroke="var(--p2)" stroke-width="3"/>
      <text x="96" y="96" text-anchor="middle" font-family="'JetBrains Mono',monospace"
        font-weight="700" font-size="22" fill="var(--p2)">!</text>
    </g>`),

  maze: svg(`
    <g stroke="var(--line)" stroke-width="6" stroke-linecap="round">
      <path d="M18 18 H102 V102 H18 V42"/>
      <path d="M42 42 H78 V78 H42"/>
    </g>
    <path d="M18 60 H42 M60 18 V42 M102 60 H78 M60 102 V78"
      stroke="var(--room)" stroke-width="8"/>
    <circle cx="60" cy="60" r="8" fill="var(--candle)"/>
    <circle cx="18" cy="30" r="7" fill="var(--p1)"/>
    <circle cx="102" cy="90" r="7" fill="var(--p2)"/>`),

  reflex: svg(`
    <path d="M66 10 L38 66 H58 L50 110 L86 48 H64 L78 10 Z" fill="var(--candle)"/>
    <circle cx="26" cy="30" r="9" stroke="var(--p1)" stroke-width="5"/>
    <circle cx="98" cy="92" r="9" stroke="var(--p2)" stroke-width="5"/>`),

  mancala: svg(`
    <rect x="8" y="30" width="104" height="60" rx="22" fill="var(--room2)" stroke="var(--line)" stroke-width="3"/>
    <ellipse cx="26" cy="60" rx="12" ry="20" fill="var(--night)" stroke="var(--p1)" stroke-width="3"/>
    <circle cx="54" cy="60" r="12" fill="var(--night)" stroke="var(--line)" stroke-width="3"/>
    <circle cx="88" cy="60" r="12" fill="var(--night)" stroke="var(--line)" stroke-width="3"/>
    <g fill="var(--candle)">
      <circle cx="50" cy="56" r="3.4"/><circle cx="58" cy="58" r="3.4"/><circle cx="53" cy="65" r="3.4"/>
      <circle cx="85" cy="57" r="3.4"/><circle cx="92" cy="62" r="3.4"/>
    </g>
    <g fill="var(--p1)">
      <circle cx="23" cy="50" r="3.4"/><circle cx="29" cy="58" r="3.4"/>
      <circle cx="24" cy="66" r="3.4"/><circle cx="29" cy="72" r="3.4"/>
    </g>`),

  seabattle: svg(`
    <g stroke="var(--p1)" stroke-width="4" stroke-linecap="round" opacity=".7">
      <path d="M10 96 q10 -8 20 0 q10 8 20 0 q10 -8 20 0 q10 8 20 0 q10 -8 20 0"/>
    </g>
    <path d="M30 84 L38 66 H86 L94 84 Z" fill="var(--dim)"/>
    <rect x="52" y="50" width="22" height="16" rx="3" fill="var(--dim)"/>
    <rect x="59" y="36" width="7" height="14" fill="var(--dim)"/>
    <g stroke="var(--p2)" stroke-width="4">
      <circle cx="88" cy="30" r="14"/>
      <path d="M88 10 V22 M88 38 V50 M68 30 H80 M96 30 H108"/>
    </g>
    <circle cx="88" cy="30" r="4" fill="var(--p2)"/>`),

  checkers: svg(`
    <g>
      <rect x="14" y="14" width="46" height="46" fill="var(--room2)"/>
      <rect x="60" y="14" width="46" height="46" fill="var(--room)"/>
      <rect x="14" y="60" width="46" height="46" fill="var(--room)"/>
      <rect x="60" y="60" width="46" height="46" fill="var(--room2)"/>
      <rect x="14" y="14" width="92" height="92" fill="none" stroke="var(--line)" stroke-width="3"/>
    </g>
    <circle cx="37" cy="37" r="15" fill="var(--p2)"/>
    <circle cx="83" cy="83" r="15" fill="var(--p1)"/>
    <path d="M74 80 L77 72 L81 78 L83 70 L85 78 L89 72 L92 80 Z" fill="var(--night)"/>`),

  hex: svg(`
    <path d="M60 16 L82 29 V55 L60 68 L38 55 V29 Z" fill="var(--p1)"/>
    <path d="M35 60 L57 73 V99 L35 112 L13 99 V73 Z" fill="var(--room2)" stroke="var(--line)" stroke-width="3"/>
    <path d="M85 60 L107 73 V99 L85 112 L63 99 V73 Z" fill="var(--p2)"/>`),

  pig: svg(`
    <g transform="rotate(-12 44 52)">
      <rect x="16" y="24" width="56" height="56" rx="12" fill="var(--text)"/>
      <g fill="var(--night)">
        <circle cx="32" cy="40" r="5.5"/><circle cx="56" cy="40" r="5.5"/>
        <circle cx="44" cy="52" r="5.5"/>
        <circle cx="32" cy="64" r="5.5"/><circle cx="56" cy="64" r="5.5"/>
      </g>
    </g>
    <g transform="rotate(14 84 82)">
      <rect x="58" y="56" width="52" height="52" rx="11" fill="var(--candle)"/>
      <circle cx="84" cy="82" r="6" fill="var(--night)"/>
    </g>`)
};

export const artFor = id => ART[id] || null;
