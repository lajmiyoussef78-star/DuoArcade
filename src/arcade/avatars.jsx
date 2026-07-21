// src/arcade/avatars.jsx — the DuoArcade avatar library.
//
// 40 cute characters drawn as pure SVG (no emoji, no images): 12 girls
// with different hairstyles, 10 boys, 12 pets, 6 fun characters. Every
// avatar is a 64x64 vector in bright pastel circles that pop on the
// night theme.
//
//   <Avatar id="girl-bob" size={48} />           one avatar
//   <Avatar id={null} fallback="Y" size={48} />  letter fallback
//   <AvatarPicker value={id} onSelect={fn} onClose={fn} />
//
// Ids are stable and stored in the database (see src/lib/avatars.js).

import { AVATAR_GROUPS } from '../lib/avatars.js';
import '../styles/avatars.css';

/* ---------------- shared palette ---------------- */
const BGS = ['#FFD9E8', '#D9E8FF', '#FFF1CF', '#DDF5E5', '#EBDDF5', '#FFE3D2'];
const INK = '#2A2333';

/* ---------------- shared human parts ---------------- */
function Face({ y = 0, blush = true }) {
  return (
    <g transform={`translate(0 ${y})`}>
      <circle cx="26.5" cy="30.5" r="2" fill={INK} />
      <circle cx="37.5" cy="30.5" r="2" fill={INK} />
      <path d="M28.5 36 Q32 39 35.5 36" stroke={INK} strokeWidth="1.6" fill="none" strokeLinecap="round" />
      {blush && <>
        <circle cx="23.5" cy="34.5" r="2" fill="#FF7FA8" opacity=".45" />
        <circle cx="40.5" cy="34.5" r="2" fill="#FF7FA8" opacity=".45" />
      </>}
    </g>
  );
}

function Human({ bg, skin, shirt, behind, front, faceY = 0 }) {
  return (
    <g>
      <circle cx="32" cy="32" r="32" fill={bg} />
      {behind}
      <circle cx="32" cy="69" r="21" fill={shirt} />
      <circle cx="32" cy="31" r="14" fill={skin} />
      <Face y={faceY} />
      {front}
    </g>
  );
}

/* hair building blocks */
const TopArc = ({ c, r = 14, cy = 31 }) => (
  <path d={`M${32 - r} ${cy} a${r} ${r} 0 0 1 ${2 * r} 0 z`} fill={c} />
);
const LongBack = ({ c }) => (
  <path d="M16 30 a16 16 0 0 1 32 0 l0 16 a5 5 0 0 1 -5 5 l-22 0 a5 5 0 0 1 -5 -5 z" fill={c} />
);

/* ---------------- pet parts ---------------- */
function PetFace({ y = 0, mouth = 'smile', nose = null }) {
  return (
    <g transform={`translate(0 ${y})`}>
      <circle cx="26" cy="31" r="2" fill={INK} />
      <circle cx="38" cy="31" r="2" fill={INK} />
      {nose}
      {mouth === 'smile' && <path d="M29 36.5 Q32 39 35 36.5" stroke={INK} strokeWidth="1.6" fill="none" strokeLinecap="round" />}
      {mouth === 'w' && <path d="M28.5 36 Q30.2 38 32 36 Q33.8 38 35.5 36" stroke={INK} strokeWidth="1.5" fill="none" strokeLinecap="round" />}
    </g>
  );
}
const PetHead = ({ c, r = 16 }) => <circle cx="32" cy="33" r={r} fill={c} />;

/* ---------------- the 40 presets ---------------- */
const P = {};

/* ----- girls ----- */
P['girl-bob'] = (
  <Human bg={BGS[0]} skin="#F6D0A9" shirt="#7FA8FF"
    behind={<path d="M15.5 31 a16.5 16.5 0 0 1 33 0 l0 10 a4 4 0 0 1 -4 4 l-2 0 0 -10 a11 11 0 0 0 -21 0 l0 10 -2 0 a4 4 0 0 1 -4 -4 z" fill={INK} />}
    front={<TopArc c={INK} r={14.4} />} />
);
P['girl-long'] = (
  <Human bg={BGS[1]} skin="#E8B48C" shirt="#FF7FA8"
    behind={<LongBack c="#5A3825" />}
    front={<TopArc c="#5A3825" r={14.4} />} />
);
P['girl-pigtails'] = (
  <Human bg={BGS[2]} skin="#F2C9A0" shirt="#6FDCA8"
    behind={<g fill="#B5651D">
      <circle cx="13.5" cy="27" r="5.5" />
      <circle cx="50.5" cy="27" r="5.5" />
    </g>}
    front={<g><TopArc c="#B5651D" r={14.4} />
      <circle cx="17.5" cy="24.5" r="2" fill="#FFC66E" />
      <circle cx="46.5" cy="24.5" r="2" fill="#FFC66E" /></g>} />
);
P['girl-bun'] = (
  <Human bg={BGS[3]} skin="#C98E63" shirt="#FFC66E"
    behind={<circle cx="32" cy="13.5" r="6" fill={INK} />}
    front={<TopArc c={INK} r={14.4} />} />
);
P['girl-curls'] = (
  <Human bg={BGS[4]} skin="#8C5A3C" shirt="#7FA8FF"
    behind={<g fill={INK}>
      <circle cx="20" cy="24" r="7" /><circle cx="28" cy="19.5" r="7" />
      <circle cx="36" cy="19.5" r="7" /><circle cx="44" cy="24" r="7" />
      <circle cx="17.5" cy="32" r="5" /><circle cx="46.5" cy="32" r="5" />
    </g>} />
);
P['girl-braids'] = (
  <Human bg={BGS[5]} skin="#E8B48C" shirt="#B58CE8"
    behind={<g fill="#5A3825">
      <rect x="12.5" y="26" width="6" height="20" rx="3" />
      <rect x="45.5" y="26" width="6" height="20" rx="3" />
    </g>}
    front={<g><TopArc c="#5A3825" r={14.4} />
      <circle cx="15.5" cy="44" r="2.2" fill="#FF7FA8" />
      <circle cx="48.5" cy="44" r="2.2" fill="#FF7FA8" /></g>} />
);
P['girl-pony'] = (
  <Human bg={BGS[1]} skin="#F6D0A9" shirt="#6FDCA8"
    behind={<g fill="#E8C363">
      <rect x="44" y="16" width="7" height="26" rx="3.5" transform="rotate(12 47 29)" />
    </g>}
    front={<g><TopArc c="#E8C363" r={14.4} />
      <circle cx="45.5" cy="19" r="2.2" fill="#FF7FA8" /></g>} />
);
P['girl-wavy'] = (
  <Human bg={BGS[0]} skin="#F2C9A0" shirt="#FF8A8A"
    behind={<g fill="#C94F4F">
      <path d="M16 30 a16 16 0 0 1 32 0 l0 12 a6 6 0 0 1 -6 6 a5 5 0 0 0 1 -5 l0 -8 a11 11 0 0 0 -22 0 l0 8 a5 5 0 0 0 1 5 a6 6 0 0 1 -6 -6 z" />
    </g>}
    front={<TopArc c="#C94F4F" r={14.4} />} />
);
P['girl-spacebuns'] = (
  <Human bg={BGS[3]} skin="#C98E63" shirt="#FFC66E"
    behind={<g fill={INK}>
      <circle cx="18.5" cy="16.5" r="5.5" />
      <circle cx="45.5" cy="16.5" r="5.5" />
    </g>}
    front={<TopArc c={INK} r={14.4} />} />
);
P['girl-hijab'] = (
  <Human bg={BGS[4]} skin="#E8B48C" shirt="#6B4C9A"
    behind={<circle cx="32" cy="30.5" r="16.8" fill="#8C6FC9" />}
    front={<g>
      <path d="M15.2 30.5 a16.8 16.8 0 0 1 33.6 0 l0 6 a4 4 0 0 1 -4 4 l-1.6 0 0 -9 a11.2 11.2 0 0 0 -22.4 0 l0 9 -1.6 0 a4 4 0 0 1 -4 -4 z" fill="#8C6FC9" />
      <path d="M20.8 40.5 q1.6 3.4 4.4 5" stroke="#7A5DB5" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </g>} />
);
P['girl-pixie'] = (
  <Human bg={BGS[2]} skin="#F6D0A9" shirt="#7FA8FF"
    front={<g fill={INK}>
      <TopArc c={INK} r={14.4} />
      <path d="M17.6 31 q-1.4 4 1 7 q0.6 -4 2.4 -6 z" />
    </g>} />
);
P['girl-bow'] = (
  <Human bg={BGS[5]} skin="#F2C9A0" shirt="#FF7FA8"
    behind={<LongBack c={INK} />}
    front={<g><TopArc c={INK} r={14.4} />
      <g fill="#FF7FA8">
        <path d="M40 15.5 l7 -3.6 0 7.2 z" />
        <path d="M40 15.5 l-7 -3.6 0 7.2 z" />
        <circle cx="40" cy="15.5" r="2.2" fill="#E86A93" />
      </g></g>} />
);

/* ----- boys ----- */
P['boy-crop'] = (
  <Human bg={BGS[1]} skin="#F2C9A0" shirt="#6FDCA8"
    front={<path d="M18.4 29 a13.6 13.6 0 0 1 27.2 0 l-3 0 a10.6 10.6 0 0 0 -21.2 0 z" fill={INK} />} />
);
P['boy-spiky'] = (
  <Human bg={BGS[2]} skin="#E8B48C" shirt="#7FA8FF"
    front={<g fill="#5A3825">
      <path d="M20 27 l3 -8 3 7 3.5 -9 3.2 9 3.3 -8 3 8.5 3.5 -6 1.5 8 a14 14 0 0 0 -25.5 0 z" />
    </g>} />
);
P['boy-curly'] = (
  <Human bg={BGS[3]} skin="#8C5A3C" shirt="#FFC66E"
    front={<g fill={INK}>
      <circle cx="22" cy="23.5" r="5.4" /><circle cx="29" cy="20.5" r="5.4" />
      <circle cx="36.5" cy="20.5" r="5.4" /><circle cx="43" cy="24" r="5.4" />
    </g>} />
);
P['boy-side'] = (
  <Human bg={BGS[0]} skin="#F6D0A9" shirt="#B58CE8"
    front={<g fill="#E8C363">
      <TopArc c="#E8C363" r={14.4} />
      <path d="M38 18 q6 1 8.5 7 l-4 1 q-1.5 -5 -4.5 -8 z" />
    </g>} />
);
P['boy-cap'] = (
  <Human bg={BGS[4]} skin="#C98E63" shirt="#FF8A8A"
    front={<g>
      <path d="M18 29 a14 14 0 0 1 28 0 z" fill="#7FA8FF" />
      <rect x="30" y="26.6" width="20" height="4" rx="2" fill="#5C82D6" />
      <circle cx="32" cy="18" r="2.2" fill="#5C82D6" />
    </g>} />
);
P['boy-shaggy'] = (
  <Human bg={BGS[5]} skin="#F2C9A0" shirt="#6FDCA8"
    front={<path d="M17.6 31 a14.4 14.4 0 0 1 28.8 0 l-3.6 2.4 -2.8 -2.4 -3.4 2.6 -3 -2.6 -3 2.6 -3.4 -2.6 -2.8 2.4 z" fill="#B5651D" />} />
);
P['boy-afro'] = (
  <Human bg={BGS[1]} skin="#8C5A3C" shirt="#FFC66E"
    behind={<circle cx="32" cy="24" r="16.5" fill={INK} />} />
);
P['boy-fade'] = (
  <Human bg={BGS[3]} skin="#C98E63" shirt="#7FA8FF"
    front={<path d="M19.6 27.5 a13 13 0 0 1 24.8 0 l-2.6 0 a10.4 10.4 0 0 0 -19.6 0 z" fill={INK} />} />
);
P['boy-curtains'] = (
  <Human bg={BGS[0]} skin="#F6D0A9" shirt="#5C82D6"
    front={<g fill="#5A3825">
      <path d="M32 17 a14.4 14.4 0 0 0 -14.4 14 l4.4 0 q0.6 -8 10 -9.6 z" />
      <path d="M32 17 a14.4 14.4 0 0 1 14.4 14 l-4.4 0 q-0.6 -8 -10 -9.6 z" />
    </g>} />
);
P['boy-beanie'] = (
  <Human bg={BGS[2]} skin="#E8B48C" shirt="#FF7FA8"
    front={<g>
      <path d="M17.6 29.5 a14.4 14.4 0 0 1 28.8 0 z" fill="#6FDCA8" />
      <rect x="17.6" y="27.5" width="28.8" height="4.6" rx="2.3" fill="#4FB886" />
      <circle cx="32" cy="15.5" r="2.6" fill="#4FB886" />
    </g>} />
);

/* ----- pets ----- */
P['pet-cat'] = (
  <g>
    <circle cx="32" cy="32" r="32" fill={BGS[2]} />
    <path d="M18 24 l-2 -11 10 6 z" fill="#F0A65A" /><path d="M46 24 l2 -11 -10 6 z" fill="#F0A65A" />
    <path d="M19.5 21.5 l-1 -5.5 5 3 z" fill="#FFD9E8" /><path d="M44.5 21.5 l1 -5.5 -5 3 z" fill="#FFD9E8" />
    <PetHead c="#F0A65A" />
    <PetFace mouth="w" nose={<path d="M30.8 34 l2.4 0 -1.2 1.6 z" fill="#E86A93" />} />
  </g>
);
P['pet-dog'] = (
  <g>
    <circle cx="32" cy="32" r="32" fill={BGS[1]} />
    <ellipse cx="16.5" cy="30" rx="5" ry="9" fill="#8C5A3C" />
    <ellipse cx="47.5" cy="30" rx="5" ry="9" fill="#8C5A3C" />
    <PetHead c="#C99B6A" />
    <circle cx="38" cy="28" r="6.5" fill="#8C5A3C" opacity=".55" />
    <PetFace nose={<ellipse cx="32" cy="34.5" rx="2.4" ry="1.8" fill={INK} />} />
  </g>
);
P['pet-bunny'] = (
  <g>
    <circle cx="32" cy="32" r="32" fill={BGS[0]} />
    <ellipse cx="24" cy="13" rx="4.6" ry="10" fill="#F2F2F5" />
    <ellipse cx="40" cy="13" rx="4.6" ry="10" fill="#F2F2F5" />
    <ellipse cx="24" cy="14" rx="2.2" ry="6.5" fill="#FFC1D9" />
    <ellipse cx="40" cy="14" rx="2.2" ry="6.5" fill="#FFC1D9" />
    <PetHead c="#F2F2F5" />
    <PetFace mouth="w" nose={<path d="M30.8 33.8 l2.4 0 -1.2 1.6 z" fill="#FF7FA8" />} />
  </g>
);
P['pet-bear'] = (
  <g>
    <circle cx="32" cy="32" r="32" fill={BGS[3]} />
    <circle cx="19" cy="19" r="6" fill="#8C5A3C" /><circle cx="45" cy="19" r="6" fill="#8C5A3C" />
    <circle cx="19" cy="19" r="3" fill="#C99B6A" /><circle cx="45" cy="19" r="3" fill="#C99B6A" />
    <PetHead c="#8C5A3C" />
    <ellipse cx="32" cy="36" rx="7.5" ry="6" fill="#C99B6A" />
    <PetFace nose={<ellipse cx="32" cy="34" rx="2.6" ry="2" fill={INK} />} />
  </g>
);
P['pet-panda'] = (
  <g>
    <circle cx="32" cy="32" r="32" fill={BGS[4]} />
    <circle cx="19" cy="19.5" r="6" fill={INK} /><circle cx="45" cy="19.5" r="6" fill={INK} />
    <PetHead c="#F5F2F7" />
    <ellipse cx="25.5" cy="30" rx="4.6" ry="5.6" fill={INK} transform="rotate(-14 25.5 30)" />
    <ellipse cx="38.5" cy="30" rx="4.6" ry="5.6" fill={INK} transform="rotate(14 38.5 30)" />
    <circle cx="26" cy="30.5" r="2" fill="#fff" /><circle cx="38" cy="30.5" r="2" fill="#fff" />
    <circle cx="26" cy="30.5" r="1.1" fill={INK} /><circle cx="38" cy="30.5" r="1.1" fill={INK} />
    <ellipse cx="32" cy="36" rx="2.4" ry="1.8" fill={INK} />
    <path d="M29.5 39.5 Q32 41.5 34.5 39.5" stroke={INK} strokeWidth="1.5" fill="none" strokeLinecap="round" />
  </g>
);
P['pet-fox'] = (
  <g>
    <circle cx="32" cy="32" r="32" fill={BGS[5]} />
    <path d="M17 26 l-2 -13 11 7 z" fill="#E8823C" /><path d="M47 26 l2 -13 -11 7 z" fill="#E8823C" />
    <PetHead c="#E8823C" />
    <path d="M18 36 a16 16 0 0 0 28 0 a20 20 0 0 1 -28 0 z" fill="#F7EFE6" />
    <ellipse cx="32" cy="40" rx="9" ry="7.5" fill="#F7EFE6" />
    <PetFace nose={<path d="M30.8 35.4 l2.4 0 -1.2 1.7 z" fill={INK} />} />
  </g>
);
P['pet-penguin'] = (
  <g>
    <circle cx="32" cy="32" r="32" fill={BGS[1]} />
    <PetHead c="#2E2E3C" r={16.5} />
    <ellipse cx="32" cy="36" rx="11" ry="10" fill="#F5F2F7" />
    <circle cx="26" cy="30" r="2" fill={INK} /><circle cx="38" cy="30" r="2" fill={INK} />
    <path d="M29 34 l6 0 -3 4 z" fill="#F0A65A" />
  </g>
);
P['pet-frog'] = (
  <g>
    <circle cx="32" cy="32" r="32" fill={BGS[3]} />
    <circle cx="22" cy="18" r="6.5" fill="#6FBF6A" /><circle cx="42" cy="18" r="6.5" fill="#6FBF6A" />
    <circle cx="22" cy="18" r="3.6" fill="#F5F2F7" /><circle cx="42" cy="18" r="3.6" fill="#F5F2F7" />
    <circle cx="22" cy="18" r="1.8" fill={INK} /><circle cx="42" cy="18" r="1.8" fill={INK} />
    <PetHead c="#6FBF6A" />
    <path d="M26 36 Q32 40.5 38 36" stroke={INK} strokeWidth="1.7" fill="none" strokeLinecap="round" />
    <circle cx="24" cy="35" r="2" fill="#FF7FA8" opacity=".45" />
    <circle cx="40" cy="35" r="2" fill="#FF7FA8" opacity=".45" />
  </g>
);
P['pet-hamster'] = (
  <g>
    <circle cx="32" cy="32" r="32" fill={BGS[0]} />
    <circle cx="20" cy="19" r="5" fill="#E0B084" /><circle cx="44" cy="19" r="5" fill="#E0B084" />
    <PetHead c="#F0CBA0" />
    <circle cx="22" cy="37" r="5.5" fill="#F7DEBC" /><circle cx="42" cy="37" r="5.5" fill="#F7DEBC" />
    <PetFace mouth="w" nose={<path d="M30.9 33.6 l2.2 0 -1.1 1.5 z" fill="#E86A93" />} />
  </g>
);
P['pet-owl'] = (
  <g>
    <circle cx="32" cy="32" r="32" fill={BGS[4]} />
    <path d="M19 20 l-2 -7 7 3 z" fill="#8C6FC9" /><path d="M45 20 l2 -7 -7 3 z" fill="#8C6FC9" />
    <PetHead c="#8C6FC9" />
    <circle cx="25.5" cy="30" r="6.5" fill="#F5F2F7" /><circle cx="38.5" cy="30" r="6.5" fill="#F5F2F7" />
    <circle cx="25.5" cy="30" r="2.4" fill={INK} /><circle cx="38.5" cy="30" r="2.4" fill={INK} />
    <path d="M29.5 36 l5 0 -2.5 3.4 z" fill="#F0A65A" />
  </g>
);
P['pet-koala'] = (
  <g>
    <circle cx="32" cy="32" r="32" fill={BGS[3]} />
    <circle cx="16.5" cy="22" r="8" fill="#9A96A8" /><circle cx="47.5" cy="22" r="8" fill="#9A96A8" />
    <circle cx="16.5" cy="22" r="4.4" fill="#C9C4D6" /><circle cx="47.5" cy="22" r="4.4" fill="#C9C4D6" />
    <PetHead c="#B5B0C2" />
    <ellipse cx="32" cy="34" rx="3.4" ry="4.6" fill={INK} />
    <circle cx="25" cy="30" r="2" fill={INK} /><circle cx="39" cy="30" r="2" fill={INK} />
    <path d="M29 40 Q32 42 35 40" stroke={INK} strokeWidth="1.5" fill="none" strokeLinecap="round" />
  </g>
);
P['pet-mouse'] = (
  <g>
    <circle cx="32" cy="32" r="32" fill={BGS[5]} />
    <circle cx="18" cy="17" r="8" fill="#B5B0C2" /><circle cx="46" cy="17" r="8" fill="#B5B0C2" />
    <circle cx="18" cy="17" r="4.4" fill="#FFC1D9" /><circle cx="46" cy="17" r="4.4" fill="#FFC1D9" />
    <PetHead c="#C9C4D6" />
    <PetFace mouth="w" nose={<circle cx="32" cy="34.5" r="1.8" fill="#FF7FA8" />} />
  </g>
);

/* ----- fun ----- */
P['fun-robot'] = (
  <g>
    <circle cx="32" cy="32" r="32" fill={BGS[1]} />
    <line x1="32" y1="12" x2="32" y2="18" stroke="#8C93A8" strokeWidth="2.4" />
    <circle cx="32" cy="10.5" r="2.6" fill="#FF8A8A" />
    <rect x="17" y="18" width="30" height="26" rx="8" fill="#B8C0D6" />
    <rect x="21.5" y="24" width="21" height="11" rx="4" fill="#2E3448" />
    <circle cx="27.5" cy="29.5" r="2.4" fill="#6FDCA8" />
    <circle cx="36.5" cy="29.5" r="2.4" fill="#6FDCA8" />
    <rect x="26" y="38.5" width="12" height="2.6" rx="1.3" fill="#8C93A8" />
    <rect x="13" y="26" width="4" height="9" rx="2" fill="#8C93A8" />
    <rect x="47" y="26" width="4" height="9" rx="2" fill="#8C93A8" />
  </g>
);
P['fun-ghost'] = (
  <g>
    <circle cx="32" cy="32" r="32" fill={BGS[4]} />
    <path d="M17 30 a15 15 0 0 1 30 0 l0 16 -5 -3.4 -5 3.4 -5 -3.4 -5 3.4 -5 -3.4 -5 3.4 z" fill="#F5F2F7" />
    <ellipse cx="26.5" cy="29" rx="2.4" ry="3.4" fill={INK} />
    <ellipse cx="37.5" cy="29" rx="2.4" ry="3.4" fill={INK} />
    <ellipse cx="32" cy="36.5" rx="2.6" ry="3.2" fill={INK} opacity=".85" />
    <circle cx="21.5" cy="33" r="2.2" fill="#FF7FA8" opacity=".45" />
    <circle cx="42.5" cy="33" r="2.2" fill="#FF7FA8" opacity=".45" />
  </g>
);
P['fun-alien'] = (
  <g>
    <circle cx="32" cy="32" r="32" fill={BGS[3]} />
    <ellipse cx="32" cy="31" rx="15" ry="17" fill="#8CD98C" />
    <ellipse cx="26" cy="30" rx="4" ry="6" fill={INK} />
    <ellipse cx="38" cy="30" rx="4" ry="6" fill={INK} />
    <circle cx="25" cy="27.5" r="1.2" fill="#fff" /><circle cx="37" cy="27.5" r="1.2" fill="#fff" />
    <path d="M29 41 Q32 43 35 41" stroke={INK} strokeWidth="1.6" fill="none" strokeLinecap="round" />
  </g>
);
P['fun-mushroom'] = (
  <g>
    <circle cx="32" cy="32" r="32" fill={BGS[0]} />
    <path d="M14 32 a18 15 0 0 1 36 0 z" fill="#E85C5C" />
    <circle cx="23" cy="24" r="3.4" fill="#FFF1CF" />
    <circle cx="36" cy="20.5" r="2.6" fill="#FFF1CF" />
    <circle cx="43" cy="27" r="2.2" fill="#FFF1CF" />
    <path d="M23 32 l18 0 0 8 a9 9 0 0 1 -18 0 z" fill="#F7EAD8" />
    <circle cx="28.5" cy="37" r="1.8" fill={INK} /><circle cx="35.5" cy="37" r="1.8" fill={INK} />
    <path d="M29.5 41 Q32 43 34.5 41" stroke={INK} strokeWidth="1.4" fill="none" strokeLinecap="round" />
  </g>
);
P['fun-cactus'] = (
  <g>
    <circle cx="32" cy="32" r="32" fill={BGS[2]} />
    <rect x="23" y="16" width="18" height="34" rx="9" fill="#6FBF6A" />
    <rect x="14" y="24" width="8" height="14" rx="4" fill="#6FBF6A" />
    <rect x="42" y="20" width="8" height="14" rx="4" fill="#6FBF6A" />
    <circle cx="28.5" cy="30" r="1.8" fill={INK} /><circle cx="35.5" cy="30" r="1.8" fill={INK} />
    <path d="M29.5 34.5 Q32 36.5 34.5 34.5" stroke={INK} strokeWidth="1.4" fill="none" strokeLinecap="round" />
    <g fill="#3E8C3A">
      <circle cx="26" cy="21" r="1" /><circle cx="38" cy="23" r="1" />
      <circle cx="25" cy="42" r="1" /><circle cx="39" cy="40" r="1" />
    </g>
    <circle cx="32" cy="13.5" r="3.4" fill="#FF7FA8" />
    <circle cx="32" cy="13.5" r="1.4" fill="#FFC66E" />
  </g>
);
P['fun-planet'] = (
  <g>
    <circle cx="32" cy="32" r="32" fill="#241C36" />
    <circle cx="32" cy="31" r="13.5" fill="#8CB8E8" />
    <circle cx="27" cy="27" r="3" fill="#6E9AC9" opacity=".8" />
    <circle cx="37" cy="34" r="2.2" fill="#6E9AC9" opacity=".8" />
    <ellipse cx="32" cy="33" rx="21" ry="6" fill="none" stroke="#FFC66E" strokeWidth="2.4" transform="rotate(-16 32 33)" />
    <circle cx="27.5" cy="29.5" r="1.7" fill={INK} /><circle cx="36.5" cy="29.5" r="1.7" fill={INK} />
    <path d="M29.5 33.5 Q32 35.5 34.5 33.5" stroke={INK} strokeWidth="1.4" fill="none" strokeLinecap="round" />
    <circle cx="14" cy="16" r="1.2" fill="#F2EDF7" opacity=".7" />
    <circle cx="50" cy="14" r="1" fill="#F2EDF7" opacity=".6" />
    <circle cx="49" cy="49" r="1.2" fill="#F2EDF7" opacity=".7" />
  </g>
);

/* ---------------- components ---------------- */

export function Avatar({ id, size = 44, fallback = '?', className = '' }) {
  const art = id ? P[id] : null;
  if (!art) {
    return (
      <span className={'av-fallback ' + className}
        style={{ width: size, height: size, fontSize: size * 0.42 }}>
        {String(fallback || '?').slice(0, 1).toUpperCase()}
      </span>
    );
  }
  const clipId = 'avclip-' + id + '-' + size;
  return (
    <svg className={'av-svg ' + className} width={size} height={size}
      viewBox="0 0 64 64" role="img" aria-label={id}>
      <defs>
        <clipPath id={clipId}><circle cx="32" cy="32" r="32" /></clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>{art}</g>
    </svg>
  );
}

export function AvatarPicker({ value, onSelect, onClose, fallback = '?' }) {
  return (
    <div className="avp-overlay" onClick={onClose}>
      <div className="avp-modal" onClick={e => e.stopPropagation()}>
        <div className="avp-head">
          <span className="avp-title">Pick your character</span>
          <button className="btn small ghost" onClick={onClose}>Close</button>
        </div>
        <div className="avp-scroll">
          <div className="avp-group">
            <div className="avp-grouplabel">None</div>
            <div className="avp-grid">
              <button
                className={'avp-cell' + (value == null ? ' on' : '')}
                onClick={() => onSelect(null)}>
                <Avatar id={null} fallback={fallback} size={46} />
              </button>
            </div>
          </div>
          {AVATAR_GROUPS.map(gr => (
            <div key={gr.id} className="avp-group">
              <div className="avp-grouplabel">{gr.label}</div>
              <div className="avp-grid">
                {gr.ids.map(id => (
                  <button key={id}
                    className={'avp-cell' + (value === id ? ' on' : '')}
                    onClick={() => onSelect(id)}>
                    <Avatar id={id} size={46} />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
