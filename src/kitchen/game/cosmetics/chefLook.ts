/** Same chibi silhouette — pick a character, then clothes, boots & colors. */

export type CharacterId =
  | "chef"
  | "girl"
  | "man"
  | "lady"
  | "kid"
  | "sous"
  | "waiter"
  | "elder";

export type HatStyle = "floppy" | "toque";
export type ShirtStyle =
  | "plain"
  | "striped"
  | "checkered"
  | "denim"
  | "hoodie"
  | "suit"
  | "tee"
  | "tee_sport"
  | "tee_badge"
  | "polo"
  | "overalls";
export type BootStyle =
  | "sneakers"
  | "workboots"
  | "rainboots"
  | "hitops"
  | "clogs"
  | "chefs";

export type ChefLook = {
  /** Body / persona silhouette. */
  characterId: CharacterId;
  hatStyle: HatStyle;
  shirtStyle: ShirtStyle;
  bootStyle: BootStyle;
  /** Single letter A–Z shown on initial tees. */
  shirtInitial: string;
  /** Hex 0xRRGGBB — also used as hair color for non-chef characters. */
  hatColor: number;
  shirtColor: number;
  apronColor: number;
  skinColor: number;
  shoeColor: number;
};

export const DEFAULT_CHEF_LOOK: ChefLook = {
  characterId: "chef",
  hatStyle: "floppy",
  shirtStyle: "plain",
  bootStyle: "sneakers",
  shirtInitial: "G",
  hatColor: 0x8e24aa,
  shirtColor: 0xffffff,
  apronColor: 0xff8a65,
  skinColor: 0xffcc80,
  shoeColor: 0x212121,
};

export type ChefLookPreset = {
  id: string;
  name: string;
  look: ChefLook;
};

export const CHEF_LOOK_PRESETS: ChefLookPreset[] = [
  { id: "classic", name: "Classic", look: { ...DEFAULT_CHEF_LOOK } },
  {
    id: "garden",
    name: "Garden",
    look: {
      characterId: "chef",
      hatStyle: "floppy",
      shirtStyle: "plain",
      bootStyle: "sneakers",
      shirtInitial: "G",
      hatColor: 0x43a047,
      shirtColor: 0xffffff,
      apronColor: 0x81c784,
      skinColor: 0xffcc80,
      shoeColor: 0x3e2723,
    },
  },
  {
    id: "midnight",
    name: "Midnight",
    look: {
      characterId: "chef",
      hatStyle: "toque",
      shirtStyle: "plain",
      bootStyle: "sneakers",
      shirtInitial: "M",
      hatColor: 0x263238,
      shirtColor: 0xeceff1,
      apronColor: 0x455a64,
      skinColor: 0xffcc80,
      shoeColor: 0x000000,
    },
  },
  {
    id: "tomato",
    name: "Tomato",
    look: {
      characterId: "chef",
      hatStyle: "floppy",
      shirtStyle: "plain",
      bootStyle: "sneakers",
      shirtInitial: "T",
      hatColor: 0xc62828,
      shirtColor: 0xfff8e1,
      apronColor: 0xef5350,
      skinColor: 0xffcc80,
      shoeColor: 0x4e342e,
    },
  },
  {
    id: "ocean",
    name: "Ocean",
    look: {
      characterId: "chef",
      hatStyle: "toque",
      shirtStyle: "plain",
      bootStyle: "sneakers",
      shirtInitial: "O",
      hatColor: 0x0277bd,
      shirtColor: 0xe3f2fd,
      apronColor: 0x29b6f6,
      skinColor: 0xffcc80,
      shoeColor: 0x1a237e,
    },
  },
  {
    id: "sunset",
    name: "Sunset",
    look: {
      characterId: "chef",
      hatStyle: "floppy",
      shirtStyle: "plain",
      bootStyle: "sneakers",
      shirtInitial: "S",
      hatColor: 0xef6c00,
      shirtColor: 0xfff3e0,
      apronColor: 0xffb74d,
      skinColor: 0xffab91,
      shoeColor: 0x3e2723,
    },
  },
];

export const HAT_SWATCHES = [
  0x8e24aa, 0x43a047, 0xc62828, 0x0277bd, 0xef6c00, 0x263238, 0xf5f5f5, 0xf9a825,
];
export const APRON_SWATCHES = [
  0xff8a65, 0x81c784, 0xef5350, 0x29b6f6, 0xffb74d, 0x455a64, 0xffffff, 0xce93d8,
];
export const SHIRT_SWATCHES = [
  0xffffff, 0xfff8e1, 0xe3f2fd, 0xfff3e0, 0xeceff1, 0xffcdd2, 0xc8e6c9, 0x212121,
];
export const SKIN_SWATCHES = [
  0xffe0b2, 0xffcc80, 0xffab91, 0xd7a86e, 0xb98068, 0x8d5524, 0x5d4037,
];
export const SHOE_SWATCHES = [0x212121, 0x3e2723, 0x4e342e, 0x000000, 0x5d4037, 0x1a237e];

export const SHIRT_STYLES: ShirtStyle[] = [
  "plain",
  "striped",
  "checkered",
  "denim",
  "hoodie",
  "suit",
  "tee",
  "tee_sport",
  "tee_badge",
  "polo",
  "overalls",
];
export const BOOT_STYLES: BootStyle[] = [
  "sneakers",
  "workboots",
  "rainboots",
  "hitops",
  "clogs",
  "chefs",
];

export const CHARACTER_IDS: CharacterId[] = [
  "chef",
  "girl",
  "man",
  "lady",
  "kid",
  "sous",
  "waiter",
  "elder",
];

export const INITIAL_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export type CosmeticShopItem = {
  id: string;
  name: string;
  slot: "shirt" | "boots" | "character";
  priceCoins: number;
  description: string;
  /** Style unlocked when purchased (free starter styles are always owned). */
  shirtStyle?: ShirtStyle;
  bootStyle?: BootStyle;
  characterId?: CharacterId;
};

/** Free defaults — always owned. */
export const FREE_SHIRT_STYLE: ShirtStyle = "plain";
export const FREE_BOOT_STYLE: BootStyle = "sneakers";
export const FREE_CHARACTER_ID: CharacterId = "chef";

/** Buyable clothes, boots & characters — spend kitchen coins from playing. */
export const COSMETIC_SHOP: CosmeticShopItem[] = [
  {
    id: "char_girl",
    name: "Kitchen Girl",
    slot: "character",
    priceCoins: 100,
    description: "Long hair, ribbon, and a softer kitchen look.",
    characterId: "girl",
  },
  {
    id: "char_man",
    name: "Kitchen Man",
    slot: "character",
    priceCoins: 100,
    description: "Short hair and broader shoulders for the line.",
    characterId: "man",
  },
  {
    id: "char_lady",
    name: "Banquet Lady",
    slot: "character",
    priceCoins: 120,
    description: "Elegant bun and earrings for front-of-house.",
    characterId: "lady",
  },
  {
    id: "char_kid",
    name: "Junior Cook",
    slot: "character",
    priceCoins: 90,
    description: "Tiny body, big energy — junior kitchen helper.",
    characterId: "kid",
  },
  {
    id: "char_sous",
    name: "Sous Chef",
    slot: "character",
    priceCoins: 130,
    description: "Bandana and focused stare — second-in-command.",
    characterId: "sous",
  },
  {
    id: "char_waiter",
    name: "Floor Waiter",
    slot: "character",
    priceCoins: 110,
    description: "Neat hair and service smile for the dining room.",
    characterId: "waiter",
  },
  {
    id: "char_elder",
    name: "Head Elder",
    slot: "character",
    priceCoins: 150,
    description: "Gray hair and glasses — kitchen legend energy.",
    characterId: "elder",
  },
  {
    id: "shirt_striped",
    name: "Candy Stripes",
    slot: "shirt",
    priceCoins: 40,
    description: "Bold kitchen stripes down the sleeves.",
    shirtStyle: "striped",
  },
  {
    id: "shirt_checkered",
    name: "Picnic Check",
    slot: "shirt",
    priceCoins: 55,
    description: "Checkerboard apron front — picnic chic.",
    shirtStyle: "checkered",
  },
  {
    id: "shirt_tee",
    name: "Initial Tee",
    slot: "shirt",
    priceCoins: 60,
    description: "Classic tee with your letter on the chest. Pick any A–Z.",
    shirtStyle: "tee",
  },
  {
    id: "shirt_tee_sport",
    name: "Sport Initial Tee",
    slot: "shirt",
    priceCoins: 75,
    description: "Athletic tee with a circle badge for your initial.",
    shirtStyle: "tee_sport",
  },
  {
    id: "shirt_tee_badge",
    name: "Badge Initial Tee",
    slot: "shirt",
    priceCoins: 85,
    description: "Square name-badge tee — choose your letter.",
    shirtStyle: "tee_badge",
  },
  {
    id: "shirt_polo",
    name: "Line Polo",
    slot: "shirt",
    priceCoins: 70,
    description: "Collared polo for front-of-house polish.",
    shirtStyle: "polo",
  },
  {
    id: "shirt_denim",
    name: "Denim Jacket",
    slot: "shirt",
    priceCoins: 80,
    description: "Casual denim overshirt with brass buttons.",
    shirtStyle: "denim",
  },
  {
    id: "shirt_hoodie",
    name: "Line Hoodie",
    slot: "shirt",
    priceCoins: 95,
    description: "Cozy hooded top for cold service nights.",
    shirtStyle: "hoodie",
  },
  {
    id: "shirt_overalls",
    name: "Prep Overalls",
    slot: "shirt",
    priceCoins: 110,
    description: "Denim bib overalls for serious prep shifts.",
    shirtStyle: "overalls",
  },
  {
    id: "shirt_suit",
    name: "Banquet Vest",
    slot: "shirt",
    priceCoins: 120,
    description: "Formal vest for grand banquet shifts.",
    shirtStyle: "suit",
  },
  {
    id: "boots_work",
    name: "Work Boots",
    slot: "boots",
    priceCoins: 50,
    description: "Chunky non-slip kitchen boots.",
    bootStyle: "workboots",
  },
  {
    id: "boots_clogs",
    name: "Kitchen Clogs",
    slot: "boots",
    priceCoins: 55,
    description: "Comfy slip-on clogs for long services.",
    bootStyle: "clogs",
  },
  {
    id: "boots_rain",
    name: "Rain Boots",
    slot: "boots",
    priceCoins: 70,
    description: "Tall waterproof boots for mop duty.",
    bootStyle: "rainboots",
  },
  {
    id: "boots_chefs",
    name: "Chef Whites",
    slot: "boots",
    priceCoins: 80,
    description: "Classic white kitchen shoes.",
    bootStyle: "chefs",
  },
  {
    id: "boots_hitops",
    name: "Court Hi-Tops",
    slot: "boots",
    priceCoins: 90,
    description: "Sporty high-tops with a side stripe.",
    bootStyle: "hitops",
  },
];

export function normalizeInitial(raw?: string | null): string {
  const c = String(raw ?? "G")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .charAt(0);
  return c || "G";
}

export function shirtShowsInitial(style: ShirtStyle): boolean {
  return style === "tee" || style === "tee_sport" || style === "tee_badge";
}

export function characterUsesHat(id: CharacterId): boolean {
  return id === "chef";
}

export function characterLabel(id: CharacterId): string {
  switch (id) {
    case "girl":
      return "Girl";
    case "man":
      return "Man";
    case "lady":
      return "Lady";
    case "kid":
      return "Junior";
    case "sous":
      return "Sous chef";
    case "waiter":
      return "Waiter";
    case "elder":
      return "Elder";
    default:
      return "Chef";
  }
}

export function shirtStyleLabel(style: ShirtStyle): string {
  switch (style) {
    case "striped":
      return "Stripes";
    case "checkered":
      return "Checkered";
    case "denim":
      return "Denim";
    case "hoodie":
      return "Hoodie";
    case "suit":
      return "Vest";
    case "tee":
      return "Initial tee";
    case "tee_sport":
      return "Sport tee";
    case "tee_badge":
      return "Badge tee";
    case "polo":
      return "Polo";
    case "overalls":
      return "Overalls";
    default:
      return "Plain";
  }
}

export function bootStyleLabel(style: BootStyle): string {
  switch (style) {
    case "workboots":
      return "Work boots";
    case "rainboots":
      return "Rain boots";
    case "hitops":
      return "Hi-tops";
    case "clogs":
      return "Clogs";
    case "chefs":
      return "Chef whites";
    default:
      return "Sneakers";
  }
}

export function shopItemForShirt(style: ShirtStyle): CosmeticShopItem | null {
  return COSMETIC_SHOP.find((i) => i.shirtStyle === style) ?? null;
}

export function shopItemForBoot(style: BootStyle): CosmeticShopItem | null {
  return COSMETIC_SHOP.find((i) => i.bootStyle === style) ?? null;
}

export function shopItemForCharacter(id: CharacterId): CosmeticShopItem | null {
  return COSMETIC_SHOP.find((i) => i.characterId === id) ?? null;
}

export function colorToCss(hex: number): string {
  return `#${(hex >>> 0).toString(16).padStart(6, "0")}`;
}

export function cssToColor(css: string): number {
  const cleaned = css.trim().replace("#", "");
  const n = Number.parseInt(
    cleaned.length === 3 ? cleaned.split("").map((c) => c + c).join("") : cleaned,
    16,
  );
  return Number.isFinite(n) ? n : DEFAULT_CHEF_LOOK.hatColor;
}

export function normalizeChefLook(partial?: Partial<ChefLook> | null): ChefLook {
  const shirtStyle = SHIRT_STYLES.includes(partial?.shirtStyle as ShirtStyle)
    ? (partial!.shirtStyle as ShirtStyle)
    : DEFAULT_CHEF_LOOK.shirtStyle;
  const bootStyle = BOOT_STYLES.includes(partial?.bootStyle as BootStyle)
    ? (partial!.bootStyle as BootStyle)
    : DEFAULT_CHEF_LOOK.bootStyle;
  const characterId = CHARACTER_IDS.includes(partial?.characterId as CharacterId)
    ? (partial!.characterId as CharacterId)
    : DEFAULT_CHEF_LOOK.characterId;
  return {
    characterId,
    hatStyle: partial?.hatStyle === "toque" ? "toque" : "floppy",
    shirtStyle,
    bootStyle,
    shirtInitial: normalizeInitial(partial?.shirtInitial),
    hatColor: partial?.hatColor ?? DEFAULT_CHEF_LOOK.hatColor,
    shirtColor: partial?.shirtColor ?? DEFAULT_CHEF_LOOK.shirtColor,
    apronColor: partial?.apronColor ?? DEFAULT_CHEF_LOOK.apronColor,
    skinColor: partial?.skinColor ?? DEFAULT_CHEF_LOOK.skinColor,
    shoeColor: partial?.shoeColor ?? DEFAULT_CHEF_LOOK.shoeColor,
  };
}

/** Peer / secondary chef — distinct default so remotes stay readable. */
export const REMOTE_CHEF_LOOK: ChefLook = {
  characterId: "chef",
  hatStyle: "floppy",
  shirtStyle: "plain",
  bootStyle: "sneakers",
  shirtInitial: "R",
  hatColor: 0x43a047,
  shirtColor: 0xffffff,
  apronColor: 0x66bb6a,
  skinColor: 0xffcc80,
  shoeColor: 0x212121,
};
