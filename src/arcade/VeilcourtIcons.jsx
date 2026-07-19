// Veilcourt character portraits — detailed human busts (vector, no emoji).

import { useId } from 'react';

const skin = '#e8c4a8';
const skinDeep = '#d4a574';
const line = 'rgba(26,20,36,.55)';

function Face({ cx = 16, cy = 11.5, r = 4.2, tone = skin }) {
  return (
    <>
      <circle cx={cx} cy={cy} r={r} fill={tone} />
      {/* eyes */}
      <circle cx={cx - 1.45} cy={cy - 0.15} r="0.55" fill="#2a2235" />
      <circle cx={cx + 1.45} cy={cy - 0.15} r="0.55" fill="#2a2235" />
      <circle cx={cx - 1.25} cy={cy - 0.3} r="0.2" fill="#fff" opacity=".7" />
      <circle cx={cx + 1.65} cy={cy - 0.3} r="0.2" fill="#fff" opacity=".7" />
      {/* brows */}
      <path d={`M${cx - 2.3} ${cy - 1.35}c.5-.35 1.2-.4 1.8-.15`} stroke={line} strokeWidth=".7" fill="none" strokeLinecap="round" />
      <path d={`M${cx + .5} ${cy - 1.5}c.55-.25 1.25-.2 1.85.1`} stroke={line} strokeWidth=".7" fill="none" strokeLinecap="round" />
      {/* nose */}
      <path d={`M${cx} ${cy + 0.2}v1.35`} stroke={skinDeep} strokeWidth=".85" strokeLinecap="round" />
      {/* mouth */}
      <path d={`M${cx - 1.2} ${cy + 2.1}c.7.55 1.7.55 2.4 0`} stroke="#b56b6b" strokeWidth=".85" fill="none" strokeLinecap="round" />
    </>
  );
}

const inkSoft = 'rgba(26,20,36,.4)';

/** Businesswoman — bob haircut, blazer, briefcase */
function BusinesswomanArt() {
  return (
    <svg viewBox="0 0 32 32" className="cp-role-art" aria-hidden="true">
      {/* hair back */}
      <ellipse cx="16" cy="11" rx="5.6" ry="6.2" fill="#3d2a1a" />
      <Face />
      {/* bob fringe */}
      <path d="M11 9.2c1.2-3.2 3.2-4.6 5-4.6s3.8 1.4 5 4.6c-1.5-1.4-3.2-1.8-5-1.8s-3.5.4-5 1.8Z" fill="#2c1d12" />
      <path d="M10.6 12.5c-.2 2.8.6 5.2 2.2 6.2.2-2.4.8-4.2 1.6-5.4-1.4-.2-2.8-.4-3.8-.8Z" fill="#3d2a1a" />
      <path d="M21.4 12.5c.2 2.8-.6 5.2-2.2 6.2-.2-2.4-.8-4.2-1.6-5.4 1.4-.2 2.8-.4 3.8-.8Z" fill="#3d2a1a" />
      {/* blazer */}
      <path d="M8.8 30 V18.2c0-1.4 2.6-2.8 7.2-2.8s7.2 1.4 7.2 2.8V30Z" fill="currentColor" />
      <path d="M16 15.6v9.5" stroke={inkSoft} strokeWidth="1.1" />
      <path d="M12.4 17.2 16 24.8 19.6 17.2" stroke={inkSoft} strokeWidth="1" fill="none" />
      {/* blouse */}
      <path d="M14.2 15.8h3.6l-.8 4.2h-2Z" fill="#f2ebe3" />
      {/* briefcase */}
      <rect x="21.2" y="21.5" width="7.4" height="5.6" rx="1.1" fill="#2a2235" />
      <path d="M23 21.5v-1.4c0-.7.6-1.3 1.3-1.3h1.2c.7 0 1.3.6 1.3 1.3v1.4" stroke="#2a2235" strokeWidth="1.15" fill="none" />
      <rect x="23.8" y="23.4" width="2.2" height="1.3" rx=".3" fill="currentColor" opacity=".55" />
    </svg>
  );
}

/** Terrorist — dark hoodie, mask, knife */
function TerroristArt() {
  return (
    <svg viewBox="0 0 32 32" className="cp-role-art" aria-hidden="true">
      {/* hoodie hood */}
      <path d="M9.5 13.5c0-5.2 2.8-8.2 6.5-8.2s6.5 3 6.5 8.2v2.2H9.5Z" fill="#1e1828" />
      <path d="M9.5 13.8h13v2.4c0 1.2-.8 2-2.2 2.4l-4.3 1.2-4.3-1.2c-1.4-.4-2.2-1.2-2.2-2.4Z" fill="#2a2235" />
      {/* face in hood */}
      <ellipse cx="16" cy="12.2" rx="3.6" ry="3.8" fill={skinDeep} />
      {/* balaclava eyes */}
      <rect x="12.2" y="11.2" width="7.6" height="2.4" rx="1.1" fill="#1a1424" />
      <circle cx="14.3" cy="12.4" r="0.7" fill="#c9e6ff" />
      <circle cx="17.7" cy="12.4" r="0.7" fill="#c9e6ff" />
      {/* body hoodie */}
      <path d="M8.5 30 V17.5c0-1.3 2.8-2.6 7.5-2.6s7.5 1.3 7.5 2.6V30Z" fill="currentColor" />
      <path d="M16 15.2v10" stroke="#1a1424" strokeWidth="1.2" opacity=".35" />
      {/* knife */}
      <g transform="translate(20.5 16.5) rotate(18)">
        <path d="M1 6.5h2.6L5.2-1.2c.25-1.2 1.7-1.5 2.4-.45l1.1 1.5c.6.85.3 2-.55 2.5L5.2 4.2" fill="#c5ced8" />
        <rect x="0.2" y="6" width="4.2" height="2.8" rx=".6" fill="#2a2235" />
        <path d="M.8 7.4h3" stroke="currentColor" strokeWidth=".7" opacity=".5" />
      </g>
    </svg>
  );
}

/** Politician — styled hair, suit, podium mic */
function PoliticianArt() {
  return (
    <svg viewBox="0 0 32 32" className="cp-role-art" aria-hidden="true">
      {/* hair */}
      <ellipse cx="16" cy="10.2" rx="5.4" ry="5.8" fill="#4a3728" />
      <Face cy={11.2} />
      <path d="M11.2 8.5c1.4-2.6 3.2-3.6 4.8-3.6 1.5 0 3.2 1 4.6 3.4-1.6-.9-3.2-1.2-4.7-1.1-1.6 0-3.2.4-4.7 1.3Z" fill="#3a2a1e" />
      {/* suit shoulders above podium */}
      <path d="M10 17.2c0-1.6 2.4-2.8 6-2.8s6 1.2 6 2.8v1.6H10Z" fill="currentColor" />
      <path d="M16 14.6v3.4" stroke="#f2ebe3" strokeWidth="1.3" />
      {/* podium */}
      <path d="M7 19.2h18l-1.8 10.2H8.8Z" fill="currentColor" />
      <path d="M8.5 19.2h15v1.6H8.5Z" fill="#f2ebe3" opacity=".2" />
      <path d="M10 23h12M11.5 26h9" stroke={inkSoft} strokeWidth="1.1" strokeLinecap="round" />
      {/* mic */}
      <path d="M16 17v2.4" stroke="#2a2235" strokeWidth="1.35" strokeLinecap="round" />
      <circle cx="16" cy="16.5" r="1.65" fill="#2a2235" />
      <circle cx="16" cy="16.5" r="0.7" fill="#8a9bb0" />
    </svg>
  );
}

/** Thief — beanie, eye mask, striped shirt, sack of loot */
function ThiefArt() {
  return (
    <svg viewBox="0 0 32 32" className="cp-role-art" aria-hidden="true">
      {/* beanie */}
      <path d="M10.5 11.5c0-4 2.4-6.4 5.5-6.4s5.5 2.4 5.5 6.4" fill="#5c4033" />
      <ellipse cx="16" cy="7.2" rx="3.2" ry="1.4" fill="#6d4c3d" />
      <Face cy={12.4} r={3.8} />
      {/* eye mask */}
      <path d="M11.6 12.1h8.8c.4 0 .7.4.6.8l-.35 1.1c-.15.45-.6.75-1.05.75h-7.2c-.45 0-.9-.3-1.05-.75L11 12.9c-.1-.4.2-.8.6-.8Z" fill="#1a1424" />
      <circle cx="13.7" cy="13.1" r="0.55" fill="#fff" opacity=".35" />
      <circle cx="18.3" cy="13.1" r="0.55" fill="#fff" opacity=".35" />
      {/* striped shirt */}
      <path d="M9.5 30 V17.2c0-1.2 2.6-2.5 6.5-2.5s6.5 1.3 6.5 2.5V30Z" fill="currentColor" />
      <path d="M10 19.5h12M10 22.5h12M10 25.5h12" stroke="#1a1424" strokeWidth="1.15" opacity=".28" />
      {/* loot bag */}
      <path d="M20 16.8c3.2-.6 7.2 1.6 7.6 4.8.35 2.6-1.2 5-3.8 5.7-2.4.65-4.8-.55-5.6-2.7-.3-1 .1-2 .8-2.6" fill="#6b5344" />
      <path d="M22.8 16.5c.2-1.6 1.1-2.6 2.5-2.9" stroke="#5a4336" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      <circle cx="24.5" cy="22" r="1.3" fill="#c9a227" />
      <circle cx="22.2" cy="23.6" r="1" fill="#c9a227" opacity=".85" />
    </svg>
  );
}

/** Colonel — military cap, mustache, medals */
function ColonelArt() {
  return (
    <svg viewBox="0 0 32 32" className="cp-role-art" aria-hidden="true">
      {/* cap */}
      <path d="M9.2 10.8h13.6l-1.3-3.6c-.35-.95-1.35-1.6-2.35-1.6h-6.3c-1 0-2 .65-2.35 1.6Z" fill="currentColor" />
      <path d="M8.2 10.8h15.6v1.9H8.2Z" fill="currentColor" />
      <path d="M8.2 12.2h15.6v.7H8.2Z" fill="#1a1424" opacity=".35" />
      <circle cx="16" cy="8.4" r="1.15" fill="#c9a227" />
      {/* head + short hair */}
      <ellipse cx="16" cy="13.6" rx="4.3" ry="3.6" fill="#3a2a1e" />
      <Face cy={14.2} r={3.7} tone={skinDeep} />
      {/* mustache */}
      <path d="M13.6 16.3c.8.7 1.6.9 2.4.9s1.6-.2 2.4-.9" stroke="#2a2235" strokeWidth="1.15" fill="none" strokeLinecap="round" />
      {/* uniform */}
      <path d="M8.8 30 V18.4c0-1.2 2.6-2.5 7.2-2.5s7.2 1.3 7.2 2.5V30Z" fill="currentColor" />
      {/* collar tabs */}
      <path d="M11.5 17.2h3.2v1.6H11.5Z" fill="#c9a227" />
      <path d="M17.3 17.2h3.2v1.6H17.3Z" fill="#c9a227" />
      {/* medals */}
      <circle cx="13.5" cy="22.5" r="1.8" fill="#c9a227" />
      <circle cx="18.5" cy="22.5" r="1.8" fill="#b0b7c3" />
      <path d="M13.5 21.2l.45.9.95.15-.7.7.2 1-.9-.5-.9.5.2-1-.7-.7.95-.15z" fill="#2a2235" opacity=".55" />
    </svg>
  );
}

/** Taxman — glasses, thinning hair, clipboard + coin */
function TaxmanArt() {
  return (
    <svg viewBox="0 0 32 32" className="cp-role-art" aria-hidden="true">
      {/* hair ring */}
      <path d="M11.2 9.5c.6-2.8 2.4-4.2 4.8-4.2s4.2 1.4 4.8 4.2c-1.4-1-3-1.4-4.8-1.4s-3.4.4-4.8 1.4Z" fill="#6a5a4a" />
      <Face cx={14.2} cy={11.5} r={3.9} />
      {/* glasses */}
      <circle cx="12.5" cy="11.3" r="1.85" stroke="#2a2235" strokeWidth="1.05" fill="none" />
      <circle cx="16" cy="11.3" r="1.85" stroke="#2a2235" strokeWidth="1.05" fill="none" />
      <path d="M14.35 11.3h.3M10.6 11.3H9.5M17.9 11.3h1.2" stroke="#2a2235" strokeWidth=".9" strokeLinecap="round" />
      {/* sweater / shirt */}
      <path d="M8.2 30 V17.5c0-1.2 2.2-2.5 6-2.7l1.2-.1" fill="currentColor" />
      <path d="M8.5 18.5c2.2 0 3.8-1 5.2-1" stroke="#f2ebe3" strokeWidth="1.2" fill="none" opacity=".35" />
      {/* clipboard in hand */}
      <rect x="18" y="13.8" width="10" height="13.5" rx="1.3" fill="#f0e6d4" />
      <rect x="19.8" y="12.4" width="6.4" height="2.4" rx=".55" fill="#8d6e63" />
      <path d="M20.2 18.2h5.6M20.2 21h5.6M20.2 23.8h4" stroke="#5c4a3a" strokeWidth="1.1" strokeLinecap="round" />
      {/* coin */}
      <circle cx="11.2" cy="23.2" r="3.5" fill="#c9a227" />
      <circle cx="11.2" cy="23.2" r="2.5" fill="none" stroke="#8a6a1a" strokeWidth=".8" />
      <text x="11.2" y="25" textAnchor="middle" fontFamily="Fraunces, serif" fontWeight="900" fontSize="5.8" fill="#2a1e05">$</text>
    </svg>
  );
}

/** Cop — police cap, short hair, badge on chest */
function CopArt() {
  return (
    <svg viewBox="0 0 32 32" className="cp-role-art" aria-hidden="true">
      {/* cap */}
      <path d="M9.5 11.5h13c0-3.6-2.7-5.8-6.5-5.8s-6.5 2.2-6.5 5.8Z" fill="currentColor" />
      <path d="M8 11.5h16v2H8Z" fill="currentColor" />
      <path d="M8 13h16v.85H8Z" fill="#1a1424" opacity=".3" />
      <rect x="14.1" y="7.2" width="3.8" height="2.5" rx=".4" fill="#c9a227" />
      {/* head */}
      <ellipse cx="16" cy="14.8" rx="4.1" ry="3.5" fill="#3a2a1e" />
      <Face cy={15.2} r={3.6} tone={skinDeep} />
      {/* jacket */}
      <path d="M8.8 30 V18.6c0-1.2 2.7-2.5 7.2-2.5s7.2 1.3 7.2 2.5V30Z" fill="currentColor" />
      {/* zipper / placket */}
      <path d="M16 16.4v11" stroke="#1a1424" strokeWidth="1.2" opacity=".35" />
      {/* radio on shoulder */}
      <rect x="8.6" y="18.2" width="2.6" height="4.2" rx=".5" fill="#2a2235" />
      {/* badge */}
      <circle cx="20.8" cy="21.8" r="3.2" fill="#c9a227" />
      <circle cx="20.8" cy="21.8" r="2.1" fill="none" stroke="#8a6a1a" strokeWidth=".75" />
      <path d="M20.8 20l.55 1.1 1.2.18-.9.88.22 1.2-1.07-.58-1.07.58.22-1.2-.9-.88 1.2-.18z" fill="#2a2235" opacity=".65" />
    </svg>
  );
}

function AllArt() {
  return (
    <svg viewBox="0 0 32 32" className="cp-role-art" aria-hidden="true">
      <circle cx="11.2" cy="12" r="4.6" fill={skin} />
      <circle cx="20.8" cy="12" r="4.6" fill={skinDeep} />
      <circle cx="10.2" cy="10.6" r="2.2" fill="#3d2a1a" />
      <circle cx="21.6" cy="10.4" r="2.3" fill="#2c1d12" />
      <path d="M6.5 28c0-4.2 2.8-6.5 9.5-6.5S25.5 23.8 25.5 28Z" fill="currentColor" />
    </svg>
  );
}

export const ROLE_ART = {
  businessman: BusinesswomanArt,
  assassin: TerroristArt,
  ambassador: PoliticianArt,
  thief: ThiefArt,
  colonel: ColonelArt,
  taxman: TaxmanArt,
  policeman: CopArt,
  __all: AllArt
};

export function RoleArt({ roleId }) {
  const Cmp = ROLE_ART[roleId] || ROLE_ART.__all;
  return <Cmp />;
}

/** Exposition — spotlight revealing a figure (kill action). */
export function ExpositionArt({ className = 'cp-expo-art' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      {/* lamp */}
      <path d="M9 3.5h6l1.2 3.2H7.8Z" fill="#2a2235" />
      <rect x="11.1" y="1.8" width="1.8" height="2.2" rx=".4" fill="#2a2235" />
      {/* beam */}
      <path d="M8.2 6.8 4.2 20.5h15.6L15.8 6.8Z" fill="currentColor" opacity=".35" />
      <path d="M9.2 7.2 6.2 19.2h11.6L14.8 7.2Z" fill="currentColor" opacity=".55" />
      {/* exposed silhouette */}
      <circle cx="12" cy="13.2" r="2.35" fill="#2a2235" opacity=".9" />
      <path d="M8.6 19.6c.4-3.2 2.1-4.4 3.4-4.4s3 1.2 3.4 4.4Z" fill="#2a2235" opacity=".9" />
      {/* flash ring */}
      <circle cx="12" cy="12.5" r="8.2" fill="none" stroke="currentColor" strokeWidth="1.1" opacity=".45" />
    </svg>
  );
}

/** Gold coin — rim, face, embossed V (Veilcourt). */
export function CoinArt({ className = 'cp-coin-art' }) {
  const uid = useId().replace(/:/g, '');
  const face = `cpCoinFace-${uid}`;
  const rim = `cpCoinRim-${uid}`;
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        <radialGradient id={face} cx="38%" cy="32%" r="68%">
          <stop offset="0%" stopColor="#ffe6a8" />
          <stop offset="45%" stopColor="#f0c66e" />
          <stop offset="100%" stopColor="#b8862a" />
        </radialGradient>
        <linearGradient id={rim} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff1c4" />
          <stop offset="40%" stopColor="#d4a84a" />
          <stop offset="100%" stopColor="#8a6218" />
        </linearGradient>
      </defs>
      <ellipse cx="12" cy="12.7" rx="9.2" ry="9.2" fill="#8a6218" opacity=".55" />
      <circle cx="12" cy="12" r="9.2" fill={`url(#${rim})`} />
      <circle cx="12" cy="12" r="7.35" fill={`url(#${face})`} />
      <circle cx="12" cy="12" r="8.15" fill="none" stroke="#fff6d0" strokeWidth=".55" opacity=".35" />
      <circle cx="12" cy="12" r="6.55" fill="none" stroke="#a87220" strokeWidth=".7" opacity=".45" />
      <path
        d="M8.2 8.4 12 16.2 15.8 8.4"
        fill="none"
        stroke="#6e4a12"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity=".75"
      />
      <path
        d="M8.55 8.55 12 15.5 15.45 8.55"
        fill="none"
        stroke="#fff0c0"
        strokeWidth=".7"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity=".55"
      />
      <path d="M6.8 7.2c1.6-1.8 4-2.6 6.2-2.2" fill="none" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" opacity=".35" />
    </svg>
  );
}
