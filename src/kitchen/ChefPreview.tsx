import {
  colorToCss,
  normalizeInitial,
  shirtShowsInitial,
  type BootStyle,
  type CharacterId,
  type ChefLook,
  type HatStyle,
  type ShirtStyle,
} from "./game/cosmetics/chefLook";

/** Lightweight SVG preview — same chibi silhouette as the game chef. */
export function ChefPreview({
  look,
  className = "",
  size = 160,
}: {
  look: ChefLook;
  className?: string;
  size?: number;
}) {
  const hat = colorToCss(look.hatColor);
  const shirt = colorToCss(look.shirtColor);
  const apron = colorToCss(look.apronColor);
  const skin = colorToCss(look.skinColor);
  const shoe = colorToCss(look.shoeColor);
  const ink = "#2b1d14";
  const shirtStyle = look.shirtStyle ?? "plain";
  const bootStyle = look.bootStyle ?? "sneakers";
  const initial = normalizeInitial(look.shirtInitial);
  const char = look.characterId ?? "chef";
  const armL = char === "man" ? 15 : char === "kid" ? 20 : 18;
  const armR = char === "man" ? 57 : char === "kid" ? 52 : 54;
  const armOuter = char === "kid" ? 5.5 : 7;
  const armInner = char === "kid" ? 4 : 5;
  const headR = char === "kid" ? 17.5 : 16;
  const faceR = char === "kid" ? 15 : 13.5;

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 72 88"
      role="img"
      aria-label="Character preview"
    >
      <ellipse cx="36" cy="80" rx="18" ry="4" fill="#000" opacity="0.2" />
      <Boots shoe={shoe} ink={ink} style={bootStyle} />
      <Shirt
        shirt={shirt}
        apron={apron}
        ink={ink}
        style={shirtStyle}
        initial={initial}
        wider={char === "man"}
        smaller={char === "kid"}
      />
      <circle cx={armL} cy="58" r={armOuter} fill={ink} />
      <circle cx={armR} cy="58" r={armOuter} fill={ink} />
      <circle cx={armL} cy="58" r={armInner} fill={skin} />
      <circle cx={armR} cy="58" r={armInner} fill={skin} />
      <circle cx="36" cy="36" r={headR} fill={ink} />
      <circle cx="36" cy="36" r={faceR} fill={skin} />
      <ellipse
        cx="28"
        cy="40"
        rx={char === "girl" || char === "lady" ? 4.5 : 4}
        ry="2.5"
        fill="#ffab91"
        opacity="0.9"
      />
      <ellipse
        cx="44"
        cy="40"
        rx={char === "girl" || char === "lady" ? 4.5 : 4}
        ry="2.5"
        fill="#ffab91"
        opacity="0.9"
      />
      <circle cx="31" cy="34" r="2.2" fill={ink} />
      <circle cx="41" cy="34" r="2.2" fill={ink} />
      <circle cx="30.2" cy="33.2" r="0.8" fill="#fff" />
      <circle cx="40.2" cy="33.2" r="0.8" fill="#fff" />
      <ellipse cx="36" cy="42" rx={char === "man" ? 4 : 5} ry="2.5" fill="#e57373" />
      {char === "elder" && (
        <>
          <circle cx="31" cy="34" r="4" fill="none" stroke={ink} strokeWidth="1.4" />
          <circle cx="41" cy="34" r="4" fill="none" stroke={ink} strokeWidth="1.4" />
          <line x1="35" y1="34" x2="37" y2="34" stroke={ink} strokeWidth="1.2" />
        </>
      )}
      <CharacterTop char={char} hatStyle={look.hatStyle} hair={hat} ink={ink} />
    </svg>
  );
}

function Boots({
  shoe,
  ink,
  style,
}: {
  shoe: string;
  ink: string;
  style: BootStyle;
}) {
  const h =
    style === "sneakers" || style === "clogs" || style === "chefs"
      ? 10
      : style === "hitops"
        ? 14
        : 16;
  const y = 78 - h;
  const fill = style === "chefs" ? "#f5f5f5" : shoe;
  return (
    <g>
      <rect x="24" y={y} width="10" height={h} rx={style === "clogs" ? 4 : 2} fill={ink} />
      <rect x="38" y={y} width="10" height={h} rx={style === "clogs" ? 4 : 2} fill={ink} />
      <rect
        x="25"
        y={y + 1}
        width="8"
        height={h - 2}
        rx={style === "clogs" ? 3 : 1}
        fill={fill}
      />
      <rect
        x="39"
        y={y + 1}
        width="8"
        height={h - 2}
        rx={style === "clogs" ? 3 : 1}
        fill={fill}
      />
      {style === "hitops" && (
        <>
          <rect x="25" y={y + 5} width="8" height="2" fill="#fff" opacity="0.85" />
          <rect x="39" y={y + 5} width="8" height="2" fill="#fff" opacity="0.85" />
        </>
      )}
      {style === "rainboots" && (
        <>
          <rect x="25" y={y + 2} width="8" height="3" fill="#fff" opacity="0.35" />
          <rect x="39" y={y + 2} width="8" height="3" fill="#fff" opacity="0.35" />
        </>
      )}
      {style === "workboots" && (
        <>
          <rect x="26" y={y + h - 4} width="6" height="2" fill="#ffd54f" opacity="0.75" />
          <rect x="40" y={y + h - 4} width="6" height="2" fill="#ffd54f" opacity="0.75" />
        </>
      )}
      {style === "chefs" && (
        <>
          <rect x="25" y={y + h - 3} width="8" height="1.5" fill={ink} opacity="0.35" />
          <rect x="39" y={y + h - 3} width="8" height="1.5" fill={ink} opacity="0.35" />
        </>
      )}
    </g>
  );
}

function Shirt({
  shirt,
  apron,
  ink,
  style,
  initial,
  wider = false,
  smaller = false,
}: {
  shirt: string;
  apron: string;
  ink: string;
  style: ShirtStyle;
  initial: string;
  wider?: boolean;
  smaller?: boolean;
}) {
  const x = smaller ? 24 : wider ? 20 : 22;
  const w = smaller ? 24 : wider ? 32 : 28;
  if (style === "denim") {
    return (
      <g>
        <rect x="22" y="48" width="28" height="22" rx="8" fill="#455a64" />
        <rect x="24" y="52" width="24" height="16" rx="6" fill={shirt} />
        <circle cx="28" cy="54" r="1.5" fill="#ffd54f" />
        <circle cx="44" cy="54" r="1.5" fill="#ffd54f" />
      </g>
    );
  }
  if (style === "hoodie") {
    return (
      <g>
        <rect x="22" y="50" width="28" height="20" rx="8" fill={ink} />
        <rect x="24" y="50" width="24" height="18" rx="7" fill={shirt} />
        <ellipse cx="36" cy="50" rx="14" ry="5" fill={ink} />
        <ellipse cx="36" cy="50" rx="11" ry="3.5" fill={shirt} />
        <rect x="30" y="56" width="12" height="10" rx="3" fill={apron} />
      </g>
    );
  }
  if (style === "suit") {
    return (
      <g>
        <rect x="22" y="50" width="28" height="20" rx="8" fill={ink} />
        <rect x="24" y="52" width="24" height="16" rx="5" fill="#37474f" />
        <polygon points="36,52 28,68 44,68" fill={shirt} />
        <rect x="32" y="56" width="8" height="8" rx="2" fill={apron} />
      </g>
    );
  }
  if (style === "polo") {
    return (
      <g>
        <rect x="22" y="50" width="28" height="20" rx="8" fill={ink} />
        <rect x="24" y="52" width="24" height="16" rx="6" fill={shirt} />
        <polygon points="36,52 30,58 42,58" fill={ink} opacity="0.55" />
        <rect x="33" y="52" width="6" height="3" fill={apron} />
      </g>
    );
  }
  if (style === "overalls") {
    return (
      <g>
        <rect x="22" y="50" width="28" height="20" rx="8" fill={ink} />
        <rect x="24" y="52" width="24" height="16" rx="5" fill={shirt} />
        <rect x="28" y="48" width="16" height="18" rx="3" fill="#455a64" />
        <rect x="30" y="50" width="12" height="5" rx="1" fill="#37474f" />
        <circle cx="32" cy="57" r="1.2" fill="#ffd54f" />
        <circle cx="40" cy="57" r="1.2" fill="#ffd54f" />
      </g>
    );
  }
  if (shirtShowsInitial(style)) {
    return (
      <g>
        <rect x={x} y="50" width={w} height="20" rx="8" fill={ink} />
        <rect x={x + 2} y="52" width={w - 4} height="16" rx="6" fill={shirt} />
        {style === "tee_sport" && (
          <circle cx="36" cy="60" r="6.5" fill={apron} stroke={ink} strokeWidth="1.2" />
        )}
        {style === "tee_badge" && (
          <rect
            x="30"
            y="55"
            width="12"
            height="10"
            rx="2"
            fill={apron}
            stroke={ink}
            strokeWidth="1.2"
          />
        )}
        {style === "tee" && (
          <rect x="31" y="56" width="10" height="9" rx="2" fill={apron} opacity="0.95" />
        )}
        <text
          x="36"
          y={style === "tee_badge" ? 63 : 62}
          textAnchor="middle"
          dominantBaseline="middle"
          fontFamily="Segoe UI, Arial Black, sans-serif"
          fontWeight="800"
          fontSize="9"
          fill={ink}
        >
          {initial}
        </text>
      </g>
    );
  }
  return (
    <g>
      <rect x={x} y="50" width={w} height="20" rx="8" fill={ink} />
      <rect x={x + 2} y="52" width={w - 4} height="16" rx="6" fill={shirt} />
      <rect x="28" y="54" width="16" height="12" rx="4" fill={apron} />
      {style === "striped" && (
        <>
          <rect x="26" y="52" width="2" height="16" fill={ink} opacity="0.35" />
          <rect x="32" y="52" width="2" height="16" fill={ink} opacity="0.35" />
          <rect x="38" y="52" width="2" height="16" fill={ink} opacity="0.35" />
          <rect x="44" y="52" width="2" height="16" fill={ink} opacity="0.35" />
        </>
      )}
      {style === "checkered" && (
        <>
          <rect x="30" y="56" width="4" height="4" fill={ink} opacity="0.3" />
          <rect x="38" y="60" width="4" height="4" fill={ink} opacity="0.3" />
          <rect x="38" y="56" width="4" height="4" fill="#fff" opacity="0.4" />
          <rect x="30" y="60" width="4" height="4" fill="#fff" opacity="0.4" />
        </>
      )}
    </g>
  );
}

function CharacterTop({
  char,
  hatStyle,
  hair,
  ink,
}: {
  char: CharacterId;
  hatStyle: HatStyle;
  hair: string;
  ink: string;
}) {
  if (char === "chef") {
    return hatStyle === "toque" ? <Toque hat={hair} ink={ink} /> : <FloppyHat hat={hair} ink={ink} />;
  }
  if (char === "girl") {
    return (
      <g>
        <ellipse cx="24" cy="42" rx="7" ry="14" fill={ink} />
        <ellipse cx="48" cy="42" rx="7" ry="14" fill={ink} />
        <ellipse cx="24" cy="42" rx="5.5" ry="12" fill={hair} />
        <ellipse cx="48" cy="42" rx="5.5" ry="12" fill={hair} />
        <ellipse cx="36" cy="24" rx="20" ry="8" fill={ink} />
        <ellipse cx="36" cy="24" rx="17" ry="6" fill={hair} />
        <rect x="24" y="24" width="10" height="8" rx="2" fill={ink} />
        <rect x="38" y="24" width="10" height="8" rx="2" fill={ink} />
        <rect x="25" y="25" width="8" height="6" rx="1" fill={hair} />
        <rect x="39" y="25" width="8" height="6" rx="1" fill={hair} />
        <circle cx="48" cy="16" r="3" fill="#e91e63" />
        <polygon points="48,16 56,10 56,22" fill="#e91e63" />
      </g>
    );
  }
  if (char === "lady") {
    return (
      <g>
        <ellipse cx="36" cy="18" rx="14" ry="8" fill={ink} />
        <circle cx="36" cy="12" r="8" fill={ink} />
        <ellipse cx="36" cy="18" rx="11" ry="6" fill={hair} />
        <circle cx="36" cy="12" r="6" fill={hair} />
        <circle cx="20" cy="40" r="2" fill="#ffd54f" />
        <circle cx="52" cy="40" r="2" fill="#ffd54f" />
      </g>
    );
  }
  if (char === "man") {
    return (
      <g>
        <rect x="22" y="18" width="28" height="14" rx="5" fill={ink} />
        <rect x="24" y="20" width="24" height="11" rx="4" fill={hair} />
        <rect x="20" y="30" width="5" height="8" fill={ink} />
        <rect x="47" y="30" width="5" height="8" fill={ink} />
        <rect x="21" y="31" width="3.5" height="6" fill={hair} />
        <rect x="48" y="31" width="3.5" height="6" fill={hair} />
      </g>
    );
  }
  if (char === "kid") {
    return (
      <g>
        <ellipse cx="36" cy="20" rx="18" ry="8" fill={ink} />
        <ellipse cx="36" cy="20" rx="15" ry="6" fill={hair} />
        <polygon points="36,6 30,20 42,20" fill={ink} />
        <polygon points="36,8 31,19 41,19" fill={hair} />
      </g>
    );
  }
  if (char === "sous") {
    return (
      <g>
        <ellipse cx="36" cy="24" rx="18" ry="7" fill={ink} />
        <ellipse cx="36" cy="24" rx="15" ry="5" fill={hair} />
        <rect x="20" y="20" width="32" height="10" rx="4" fill="#c62828" />
        <rect x="20" y="24" width="32" height="2" fill={ink} opacity="0.35" />
        <polygon points="50,24 60,20 56,34" fill="#c62828" />
      </g>
    );
  }
  if (char === "waiter") {
    return (
      <g>
        <ellipse cx="36" cy="22" rx="16" ry="7" fill={ink} />
        <ellipse cx="36" cy="22" rx="13" ry="5" fill={hair} />
        <rect x="35" y="16" width="2" height="10" fill={ink} opacity="0.4" />
      </g>
    );
  }
  // elder
  return (
    <g>
      <ellipse cx="36" cy="22" rx="18" ry="7" fill={ink} />
      <ellipse cx="36" cy="22" rx="15" ry="5" fill="#90a4ae" />
      <ellipse cx="24" cy="36" rx="5" ry="4" fill={ink} />
      <ellipse cx="48" cy="36" rx="5" ry="4" fill={ink} />
      <ellipse cx="24" cy="36" rx="3.5" ry="2.5" fill="#90a4ae" />
      <ellipse cx="48" cy="36" rx="3.5" ry="2.5" fill="#90a4ae" />
    </g>
  );
}

function FloppyHat({ hat, ink }: { hat: string; ink: string }) {
  return (
    <g>
      <ellipse cx="36" cy="24" rx="22" ry="7" fill={ink} />
      <ellipse cx="36" cy="24" rx="18" ry="5" fill={hat} />
      <polygon points="36,4 22,28 50,28" fill={ink} />
      <polygon points="36,7 25,26 47,26" fill={hat} />
      <circle cx="44" cy="10" r="4" fill={ink} />
      <circle cx="44" cy="10" r="2.5" fill={hat} />
      <circle cx="28" cy="22" r="2.5" fill="#fff" opacity="0.35" />
    </g>
  );
}

function Toque({ hat, ink }: { hat: string; ink: string }) {
  return (
    <g>
      <ellipse cx="36" cy="24" rx="18" ry="6" fill={ink} />
      <ellipse cx="36" cy="24" rx="15" ry="4" fill={hat} />
      <rect x="26" y="6" width="20" height="20" rx="5" fill={ink} />
      <rect x="28" y="8" width="16" height="17" rx="4" fill={hat} />
      <ellipse cx="36" cy="8" rx="12" ry="8" fill={ink} />
      <ellipse cx="36" cy="8" rx="10" ry="6" fill={hat} />
      <circle cx="32" cy="5" r="2.5" fill="#fff" opacity="0.35" />
      <rect x="26" y="20" width="20" height="4" fill={ink} opacity="0.5" />
    </g>
  );
}

export function hatStyleLabel(style: HatStyle): string {
  return style === "toque" ? "Toque" : "Floppy";
}
